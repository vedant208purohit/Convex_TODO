import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireMember, requireAdminOrCashier } from "./organizationUsers";
import { computeOrderNetRevenue } from "./organizationQrAnalytics";

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * Attributes an existing POS/Online Order to a QR code and customer ordering session.
 * Reuses the existing orders table as source-of-truth.
 */
export const attributeOrderToQr = mutation({
  args: {
    orderId: v.id("orders"),
    qrId: v.id("organizationQrCodes"),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("ORDER_NOT_FOUND");
    }

    const qr = await ctx.db.get(args.qrId);
    if (!qr || qr.deletedAt !== undefined) {
      throw new Error("QR_NOT_FOUND");
    }

    // Validate outlet matching
    if (order.organizationId !== qr.organizationId) {
      throw new Error("UNAUTHORIZED_QR_ACCESS");
    }

    const effectiveTableId = qr.tableId || order.tableId;

    const now = Date.now();
    await ctx.db.patch(order._id, {
      qrId: qr._id,
      sessionId: args.sessionId,
      tableId: effectiveTableId as Id<"organizationTables"> | undefined,
      updatedAt: now,
    });

    // Mark ordering session as COMPLETED if active session exists
    if (args.sessionId) {
      const sessions = await ctx.db
        .query("organizationOrderingSessions")
        .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId!))
        .collect();

      const activeSession = sessions.find((s) => s.deletedAt === undefined);
      if (activeSession) {
        await ctx.db.patch(activeSession._id, {
          status: "COMPLETED",
          lastActivityAt: now,
        });
      }
    }

    return {
      orderId: order._id,
      qrId: qr._id,
      sessionId: args.sessionId,
      tableId: effectiveTableId,
      totalAmount: order.totalAmount,
      paymentStatus: order.paymentStatus,
    };
  },
});

/**
 * Updates order payment / status attribution without duplicating order logic.
 */
export const updateOrderPaymentStatus = mutation({
  args: {
    orderId: v.id("orders"),
    paymentStatus: v.union(
      v.literal("Pending"),
      v.literal("Paid"),
      v.literal("Failed"),
      v.literal("Refunded"),
      v.literal("Partially Refunded"),
    ),
    isCompleted: v.optional(v.boolean()),
    isRejected: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("ORDER_NOT_FOUND");
    }

    await requireAdminOrCashier(ctx, order.organizationId);

    const now = Date.now();
    await ctx.db.patch(order._id, {
      paymentStatus: args.paymentStatus,
      isCompleted: args.isCompleted ?? order.isCompleted,
      isRejected: args.isRejected ?? order.isRejected,
      updatedAt: now,
    });

    return {
      orderId: order._id,
      paymentStatus: args.paymentStatus,
      isCompleted: args.isCompleted ?? order.isCompleted,
      isRejected: args.isRejected ?? order.isRejected,
    };
  },
});

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Computes Order Attribution, Revenue, and Conversion Stats for a QR code.
 * Follows exact financial source-of-truth definitions:
 * - Valid Orders: !isRejected AND paymentStatus != "Refunded" AND paymentStatus != "Failed"
 * - Order Conversion = (Valid Orders / Sessions) * 100
 * - Cart -> Order Conversion = (Valid Orders / Cart Sessions) * 100
 */
export const getOrderAttributionStats = query({
  args: {
    qrId: v.id("organizationQrCodes"),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    const qr = await ctx.db.get(args.qrId);
    if (!qr || qr.deletedAt !== undefined) {
      throw new Error("QR_NOT_FOUND");
    }

    // 1. Fetch attributed orders from orders table
    const attributedOrders = await ctx.db
      .query("orders")
      .withIndex("by_qr", (q) => q.eq("qrId", args.qrId))
      .collect();

    // Filter valid vs cancelled orders
    const validOrders = attributedOrders.filter(
      (o) =>
        !o.isRejected &&
        o.paymentStatus !== "Refunded" &&
        o.paymentStatus !== "Failed",
    );

    const cancelledOrders = attributedOrders.filter(
      (o) => o.isRejected || o.paymentStatus === "Refunded",
    );

    // Sum net revenue from source of truth totalAmount
    const totalRevenue = validOrders.reduce((sum, o) => sum + Math.round(computeOrderNetRevenue(o) * 100), 0);

    // 2. Fetch sessions and carts for conversion rates
    const sessions = await ctx.db
      .query("organizationOrderingSessions")
      .withIndex("by_qr", (q) => q.eq("qrId", args.qrId))
      .collect();
    const activeSessions = sessions.filter((s) => s.deletedAt === undefined);

    const carts = await ctx.db
      .query("organizationCarts")
      .withIndex("by_qr", (q) => q.eq("qrId", args.qrId))
      .collect();
    const cartCreatedSessions = carts.filter(
      (c) => c.deletedAt === undefined && c.hasItems,
    );

    const validOrderCount = validOrders.length;
    const sessionCount = activeSessions.length;
    const cartCreatedCount = cartCreatedSessions.length;

    // Calculations
    const orderConversion =
      sessionCount > 0
        ? Number(((validOrderCount / sessionCount) * 100).toFixed(2))
        : 0;

    const cartToOrderConversion =
      cartCreatedCount > 0
        ? Number(((validOrderCount / cartCreatedCount) * 100).toFixed(2))
        : 0;

    return {
      qrId: args.qrId,
      totalOrders: attributedOrders.length,
      validOrders: validOrderCount,
      cancelledOrders: cancelledOrders.length,
      totalRevenue,
      sessionCount,
      cartCreatedCount,
      orderConversion,
      cartToOrderConversion,
    };
  },
});
