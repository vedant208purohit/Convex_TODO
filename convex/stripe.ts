import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { resolveNotificationsForOrderStatus } from "./processNotifications";
import { handleOrderCompletionTransfer } from "./providerPaymentTransfers";
import { getCurrencyForCountry } from "../lib/constants/countries";

// ============================================================================
// 1. CREATE STRIPE PAYMENT INTENT MUTATION (Validation & Credential Prep)
// ============================================================================
export const createStripePaymentIntent = mutation({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error(`Order ${args.orderId} not found`);
    }

    if (order.paymentStatus === "Paid") {
      throw new Error(`Order ${order.orderNumber} is already paid`);
    }

    const org = await ctx.db.get(order.organizationId);
    if (!org) {
      throw new Error(`Organization ${order.organizationId} not found`);
    }

    const countryCurrency = getCurrencyForCountry(org.country || "IN");
    const currency = (org.defaultCurrency?.trim() || countryCurrency.code || "USD").toLowerCase();

    // Authoritative Amount: strictly taken from internal order totalAmount (in minor units)
    const amountMinorUnits = order.totalAmount;
    if (amountMinorUnits <= 0) {
      throw new Error(`Invalid order amount: ${(amountMinorUnits / 100).toFixed(2)} ${currency.toUpperCase()}`);
    }

    // Resolve public publishable key: check payment_gateway_connections, org settings, or env
    let publishableKey =
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ||
      process.env.STRIPE_PUBLISHABLE_KEY?.trim() ||
      "";

    const stripeConn = await ctx.db
      .query("payment_gateway_connections")
      .withIndex("by_org_and_provider", (q) =>
        q.eq("organizationId", org._id).eq("provider", "stripe")
      )
      .first();

    if (!stripeConn || stripeConn.status !== "connected") {
      throw new Error(
        "Stripe payment gateway is not connected or active for this store. Please connect Stripe in Marketplace."
      );
    }

    const connMetadata = stripeConn.metadata as any;
    if (connMetadata?.publishableKey) {
      publishableKey = connMetadata.publishableKey;
    } else if (stripeConn.providerAccountId && stripeConn.providerAccountId.startsWith("pk_")) {
      publishableKey = stripeConn.providerAccountId;
    }

    return {
      success: true,
      orderId: order._id,
      orderNumber: order.orderNumber,
      amount: amountMinorUnits,
      currency,
      publishableKey,
      customerName: order.customerName,
      customerEmail: order.customerEmail || "",
      customerPhone: order.customerPhone,
      organizationName: org.name,
    };
  },
});

// ============================================================================
// 2. VERIFY STRIPE PAYMENT MUTATION
// ============================================================================
export const verifyStripePayment = mutation({
  args: {
    orderId: v.id("orders"),
    paymentIntentId: v.string(),
    paymentMethod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error(`Order ${args.orderId} not found`);
    }

    // Idempotency check: if order is already Paid
    if (order.paymentStatus === "Paid") {
      return {
        success: true,
        alreadyPaid: true,
        orderId: order._id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
      };
    }

    const org = await ctx.db.get(order.organizationId);
    if (!org) {
      throw new Error(`Organization ${order.organizationId} not found`);
    }

    const now = Date.now();

    // 1. Advance Order Status to first active sequence process if pending
    const orgProcesses = await ctx.db
      .query("organizationOrderProcesses")
      .collect();

    const sequenceProcesses = orgProcesses
      .filter((p) => p.published && p.isSequence)
      .sort((a, b) => a.position - b.position);

    const activeStatus = sequenceProcesses.length > 0 ? sequenceProcesses[0] : null;

    // 2. Update Order Record to Paid (without prematurely completing kitchen order)
    await ctx.db.patch(order._id, {
      paymentStatus: "Paid",
      paymentMode: "Stripe",
      updatedAt: now,
    });

    // 3. Persist Immutable Order Payment Record in orderPayments
    const existingPayments = await ctx.db
      .query("orderPayments")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();

    const alreadyLogged = existingPayments.some(
      (p) => p.transactionReference === args.paymentIntentId
    );

    if (!alreadyLogged) {
      await ctx.db.insert("orderPayments", {
        organizationId: order.organizationId,
        orderId: order._id,
        paymentModeName: "Stripe",
        paymentType: "Credit",
        amount: order.totalAmount,
        payAmount: order.totalAmount,
        refundAmount: 0,
        transactionReference: args.paymentIntentId,
        createdAt: now,
      });
    }

    // 4. Also persist to shared polymorphic payment_transactions table
    const stripeConn = await ctx.db
      .query("payment_gateway_connections")
      .withIndex("by_org_and_provider", (q) =>
        q.eq("organizationId", org._id).eq("provider", "stripe")
      )
      .first();

    if (stripeConn) {
      const existingTx = await ctx.db
        .query("payment_transactions")
        .withIndex("by_provider_payment_id", (q) =>
          q.eq("providerPaymentId", args.paymentIntentId)
        )
        .first();

      if (!existingTx) {
        await ctx.db.insert("payment_transactions", {
          organizationId: org._id,
          connectionId: stripeConn._id,
          provider: "stripe",
          providerPaymentId: args.paymentIntentId,
          internalOrderId: order._id,
          amountMinor: order.totalAmount,
          currency: (org.defaultCurrency || "USD").toUpperCase(),
          status: "captured",
          providerStatus: "succeeded",
          paidAt: now,
          paymentMethod: args.paymentMethod || "card",
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          createdAt: now,
          updatedAt: now,
          metadata: {
            orderNumber: order.orderNumber,
            orderType: order.orderType,
          },
        });
      }
    }

    // 5. Log Order Activity
    await ctx.db.insert("orderActivities", {
      organizationId: order.organizationId,
      orderId: order._id,
      processId: activeStatus?._id ?? order.orderStatusId,
      processName: activeStatus?.name ?? "Paid",
      position: activeStatus?.position ?? 1,
      createdAt: now,
    });

    // 6. Trigger Real-time Notifications & Provider Payout Transfers
    const targetProcessId = activeStatus?._id ?? order.orderStatusId;
    if (targetProcessId) {
      await resolveNotificationsForOrderStatus(ctx, order, targetProcessId);
    }

    await handleOrderCompletionTransfer(ctx, order._id);

    return {
      success: true,
      orderId: order._id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
    };
  },
});

// ============================================================================
// 3. RECORD PAYMENT FAILURE MUTATION
// ============================================================================
export const recordPaymentFailure = mutation({
  args: {
    orderId: v.id("orders"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error(`Order ${args.orderId} not found`);
    }

    if (order.paymentStatus === "Paid") {
      return { success: false, message: "Order is already paid" };
    }

    await ctx.db.patch(order._id, {
      paymentStatus: "Failed",
      updatedAt: Date.now(),
    });

    return {
      success: true,
      orderId: order._id,
      orderNumber: order.orderNumber,
      paymentStatus: "Failed",
    };
  },
});

// ============================================================================
// 4. GET STRIPE ORDER PAYMENT STATUS QUERY
// ============================================================================
export const getOrderPaymentStatus = query({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) return null;

    const payments = await ctx.db
      .query("orderPayments")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();

    return {
      orderId: order._id,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      paymentMode: order.paymentMode,
      totalAmount: order.totalAmount,
      payments,
    };
  },
});
