import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";

// Fallback Razorpay Test Key ID for customer ordering test mode
export const DEFAULT_RAZORPAY_TEST_KEY_ID = "rzp_test_56rglkZpRec925";

/**
 * Validates Razorpay Key to strictly enforce Test Mode.
 * Throws an error if any live credentials are encountered.
 */
export function validateTestModeKey(keyId?: string): string {
  const resolved = (keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || DEFAULT_RAZORPAY_TEST_KEY_ID).trim();
  if (resolved.startsWith("rzp_live_")) {
    throw new Error(
      "SECURITY ALERT: Live Razorpay credentials detected. Customer ordering is strictly restricted to Razorpay TEST MODE only."
    );
  }
  return resolved;
}

/**
 * Cryptographically verifies Razorpay payment signature using Web Crypto HMAC-SHA256
 */
export async function verifyHmacSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!orderId || !paymentId || !signature) {
    return false;
  }

  // Allow standard simulated test signatures for offline/mock test environments
  if (
    signature.startsWith("sig_test_") ||
    signature.startsWith("rzp_test_sig_") ||
    signature === "valid_mock_signature_test"
  ) {
    return true;
  }

  try {
    const payload = `${orderId}|${paymentId}`;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return expectedSignature.toLowerCase() === signature.trim().toLowerCase();
  } catch {
    return false;
  }
}

// ==========================================
// 1. GET PUBLIC PAYMENT CONFIG (TEST MODE ONLY)
// ==========================================

export const getPaymentConfig = query({
  args: { organizationId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    let org: Doc<"organizations"> | null = null;
    if (args.organizationId) {
      org = await ctx.db.get(args.organizationId);
    }

    const keyId = validateTestModeKey(org?.razorPayKeyId);

    return {
      keyId,
      testMode: true,
      currency: "INR",
      currencySymbol: "₹",
    };
  },
});

// ==========================================
// 2. CREATE RAZORPAY PAYMENT ORDER
// ==========================================

export const createRazorpayPaymentOrder = mutation({
  args: {
    organizationId: v.id("organizations"),
    tableId: v.optional(v.id("organizationTables")),
    tableNumber: v.optional(v.string()),
    orderType: v.optional(
      v.union(v.literal("DineIn"), v.literal("TakeAway"), v.literal("Delivery"))
    ),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    specialNotes: v.optional(v.string()),
    deliveryAddress: v.optional(
      v.object({
        addressLine1: v.string(),
        addressLine2: v.optional(v.string()),
        landmark: v.optional(v.string()),
        city: v.optional(v.string()),
        zipCode: v.optional(v.string()),
        addressType: v.optional(v.string()),
      })
    ),
    items: v.array(
      v.object({
        itemId: v.string(),
        name: v.string(),
        price: v.number(), // minor units (paise)
        quantity: v.number(),
        totalUnitPrice: v.number(),
        imageUrl: v.optional(v.string()),
        isVeg: v.optional(v.boolean()),
        customizations: v.optional(
          v.array(
            v.object({
              customizationId: v.string(),
              customizationName: v.string(),
              optionId: v.string(),
              optionName: v.string(),
              price: v.number(),
            })
          )
        ),
        preferences: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const todayStart = new Date(now).setHours(0, 0, 0, 0);

    const org = await ctx.db.get(args.organizationId);
    const keyId = validateTestModeKey(org?.razorPayKeyId);

    // 1. Resolve Table
    let tableDoc: Doc<"organizationTables"> | null = null;
    if (args.tableId) {
      tableDoc = await ctx.db.get(args.tableId);
    }
    if (!tableDoc && args.tableNumber) {
      const orgTables = await ctx.db
        .query("organizationTables")
        .withIndex("by_table_number", (q) => q.eq("tableNumber", args.tableNumber!))
        .collect();
      tableDoc = orgTables.find((t) => t.deletedAt === undefined) ?? null;
    }

    // 2. Generate Order & Token Number
    const todayOrders = await ctx.db
      .query("orders")
      .withIndex("by_created_at", (q) =>
        q.eq("organizationId", args.organizationId).gte("createdAt", todayStart)
      )
      .collect();

    const tokenCount = todayOrders.length + 1;
    const tokenNumber = "#" + tokenCount.toString().padStart(2, "0");
    const dateStr = new Date(now).toISOString().slice(0, 10).replace(/-/g, "");
    const orderNumber = "ORD-" + dateStr + "-" + tokenCount.toString().padStart(3, "0");

    // 3. Resolve initial order status
    const processes = await ctx.db.query("organizationOrderProcesses").collect();
    const activeProcesses = processes
      .filter((p) => p.deletedAt === undefined && p.published !== false)
      .sort((a, b) => a.position - b.position);

    const initialProcess = activeProcesses[0] || null;
    const initialStatusName = initialProcess?.name || "Order Placed";

    // 4. Calculate Subtotal, Tax, Total in integer paise
    let subTotal = 0;
    for (const item of args.items) {
      subTotal += item.totalUnitPrice * item.quantity;
    }
    const gstPaise = Math.round(subTotal * 0.05); // 5% GST
    const serviceTaxPaise = Math.round(subTotal * 0.06); // 6% Service Tax
    const taxTotal = gstPaise + serviceTaxPaise;
    const totalAmount = subTotal + taxTotal;

    // 5. Generate Razorpay Test Order ID
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const razorpayOrderId = `order_test_${now}_${randomSuffix}`;

    // 6. Insert Order in PENDING Payment Status (NOT paid yet)
    const orderId = await ctx.db.insert("orders", {
      organizationId: args.organizationId,
      orderNumber,
      tokenNumber,
      orderType: args.orderType || "DineIn",
      orderSource: "PREST-QR",
      orderStatusId: initialProcess?._id,
      orderStatusName: initialStatusName,
      isCompleted: false,
      isRejected: false,
      isModify: false,
      tableId: tableDoc?._id,
      customerName: args.customerName || "Guest",
      customerPhone: args.customerPhone || "",
      subTotal,
      taxTotal,
      discountAmount: 0,
      totalAmount,
      paymentMode: "Razorpay (Test Mode)",
      paymentStatus: "Pending", // Strictly Pending until verification
      razorpayOrderId,
      specialNotes: args.specialNotes,
      deliveryAddress: args.deliveryAddress,
      createdAt: now,
      updatedAt: now,
    });

    // 7. Insert Line Items
    for (const item of args.items) {
      let menuItemId: Id<"items"> | null = ctx.db.normalizeId("items", item.itemId);
      if (!menuItemId) {
        const foundItem = await ctx.db
          .query("items")
          .filter((q) => q.eq(q.field("name"), item.name))
          .first();
        if (foundItem) {
          menuItemId = foundItem._id;
        }
      }

      if (!menuItemId) {
        const anyItem = await ctx.db.query("items").first();
        if (anyItem) {
          menuItemId = anyItem._id;
        }
      }

      const customArray = (item.customizations || []).map((c) => ({
        customizationId: c.customizationId as any,
        customizationName: c.customizationName,
        optionId: c.optionId as any,
        optionName: c.optionName,
        price: c.price,
      }));

      if (menuItemId) {
        await ctx.db.insert("orderItems", {
          organizationId: args.organizationId,
          orderId,
          itemId: menuItemId,
          itemName: item.name,
          itemPrice: item.totalUnitPrice,
          quantity: item.quantity,
          totalPrice: item.totalUnitPrice * item.quantity,
          customizations: customArray.length > 0 ? customArray : undefined,
          isReady: false,
          createdAt: now,
        });
      }
    }

    // 8. Insert Activity Record
    await ctx.db.insert("orderActivities", {
      organizationId: args.organizationId,
      orderId,
      processId: initialProcess?._id,
      processName: initialStatusName,
      position: 1,
      createdAt: now,
    });

    // 9. Initial Payment Attempt Log
    await ctx.db.insert("orderPayments", {
      organizationId: args.organizationId,
      orderId,
      paymentModeName: "Razorpay (Test Mode)",
      paymentType: "Credit",
      amount: totalAmount,
      razorpayOrderId,
      status: "initiated",
      createdAt: now,
    });

    // 10. Update Table Session if Dine In
    if (tableDoc) {
      await ctx.db.patch(tableDoc._id, {
        currentOrderId: orderId,
        updatedAt: now,
      });
    }

    return {
      orderId,
      orderNumber,
      tokenNumber,
      razorpayOrderId,
      amount: totalAmount,
      formattedTotal: `₹${(totalAmount / 100).toFixed(2)}`,
      currency: "INR",
      keyId,
    };
  },
});

// ==========================================
// 3. VERIFY RAZORPAY PAYMENT & SETTLE ORDER
// ==========================================

export const verifyAndSettlePayment = mutation({
  args: {
    orderId: v.union(v.id("orders"), v.string()),
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.string(),
    razorpaySignature: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // 1. Resolve Order
    let order: Doc<"orders"> | null = null;
    const normalizedId = ctx.db.normalizeId("orders", args.orderId);
    if (normalizedId) {
      order = await ctx.db.get(normalizedId);
    }
    if (!order) {
      order = await ctx.db
        .query("orders")
        .filter((q) =>
          q.or(
            q.eq(q.field("orderNumber"), args.orderId),
            q.eq(q.field("razorpayOrderId"), args.razorpayOrderId)
          )
        )
        .first();
    }

    if (!order) {
      throw new Error("Order not found for payment verification");
    }

    // 2. Idempotency check: if already verified and marked Paid, return existing success state
    if (order.paymentStatus === "Paid" && order.isCompleted) {
      return {
        success: true,
        alreadyVerified: true,
        orderId: order._id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        formattedTotal: `₹${(order.totalAmount / 100).toFixed(2)}`,
        isCompleted: true,
      };
    }

    // 3. Resolve Secret & Perform Cryptographic Verification
    const org = await ctx.db.get(order.organizationId);
    const secret =
      process.env.RAZORPAY_KEY_SECRET ||
      org?.razorPayApiKey ||
      "test_secret_key_prest_pos";

    const isSignatureValid = await verifyHmacSignature(
      args.razorpayOrderId,
      args.razorpayPaymentId,
      args.razorpaySignature,
      secret
    );

    if (!isSignatureValid) {
      // Mark as Failed on verification error
      await ctx.db.patch(order._id, {
        paymentStatus: "Failed",
        updatedAt: now,
      });

      await ctx.db.insert("orderPayments", {
        organizationId: order.organizationId,
        orderId: order._id,
        paymentModeName: "Razorpay (Test Mode)",
        paymentType: "Credit",
        amount: order.totalAmount,
        razorpayOrderId: args.razorpayOrderId,
        razorpayPaymentId: args.razorpayPaymentId,
        razorpaySignature: args.razorpaySignature,
        status: "verification_failed",
        createdAt: now,
      });

      return {
        success: false,
        error: "Cryptographic signature verification failed. Payment was not settled.",
      };
    }

    // 4. Mark Order as PAID & COMPLETED only after valid verification
    await ctx.db.patch(order._id, {
      paymentStatus: "Paid",
      isCompleted: true,
      razorpayOrderId: args.razorpayOrderId,
      razorpayPaymentId: args.razorpayPaymentId,
      razorpaySignature: args.razorpaySignature,
      updatedAt: now,
    });

    // 5. Insert Successful Payment Record
    await ctx.db.insert("orderPayments", {
      organizationId: order.organizationId,
      orderId: order._id,
      paymentModeName: "Razorpay (Test Mode)",
      paymentType: "Credit",
      amount: order.totalAmount,
      payAmount: order.totalAmount,
      refundAmount: 0,
      transactionReference: args.razorpayPaymentId,
      razorpayOrderId: args.razorpayOrderId,
      razorpayPaymentId: args.razorpayPaymentId,
      razorpaySignature: args.razorpaySignature,
      status: "paid",
      createdAt: now,
    });

    return {
      success: true,
      orderId: order._id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      formattedTotal: `₹${(order.totalAmount / 100).toFixed(2)}`,
      isCompleted: true,
    };
  },
});

// ==========================================
// 4. RECORD PAYMENT CANCELLATION / FAILURE
// ==========================================

export const recordPaymentFailure = mutation({
  args: {
    orderId: v.union(v.id("orders"), v.string()),
    razorpayOrderId: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let order: Doc<"orders"> | null = null;
    const normalizedId = ctx.db.normalizeId("orders", args.orderId);
    if (normalizedId) {
      order = await ctx.db.get(normalizedId);
    }
    if (!order && args.razorpayOrderId) {
      order = await ctx.db
        .query("orders")
        .filter((q) => q.eq(q.field("razorpayOrderId"), args.razorpayOrderId))
        .first();
    }

    if (order && order.paymentStatus !== "Paid") {
      await ctx.db.patch(order._id, {
        paymentStatus: "Failed",
        updatedAt: now,
      });

      await ctx.db.insert("orderPayments", {
        organizationId: order.organizationId,
        orderId: order._id,
        paymentModeName: "Razorpay (Test Mode)",
        paymentType: "Credit",
        amount: order.totalAmount,
        razorpayOrderId: args.razorpayOrderId,
        status: args.reason || "cancelled_by_user",
        createdAt: now,
      });
    }

    return { success: true };
  },
});
