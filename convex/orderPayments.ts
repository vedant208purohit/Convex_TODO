import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, resolveStoreOrganization, getCallerMembership } from "./organizationUsers";
import { handleOrderCompletionTransfer } from "./providerPaymentTransfers";
import { validateActivePaymentMode } from "./paymentModes";

/**
 * Retrieves payment transaction records for a specific order.
 */
export const getPaymentsByOrder = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const payments = await ctx.db
      .query("orderPayments")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();
    return payments;
  },
});

/**
 * Records a payment against an order and completes active postpaid order requests.
 */
export const recordOrderPayment = mutation({
  args: {
    orderId: v.id("orders"),
    paymentModeId: v.optional(v.id("paymentModes")),
    paymentModeName: v.string(),
    amount: v.number(),
    transactionReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const org = await resolveStoreOrganization(ctx);
    const member = await getCallerMembership(ctx, identity.subject, org._id);

    const isStaff =
      member &&
      member.deletedAt === undefined &&
      ["admin", "cashier", "captain", "waiter"].some((role) =>
        member.userType.includes(role)
      );

    if (!isStaff) {
      throw new Error("Forbidden. Staff access required to record payments.");
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found.");
    }

    await validateActivePaymentMode(ctx, order.organizationId, {
      paymentModeId: args.paymentModeId,
      paymentModeName: args.paymentModeName,
    });

    const now = Date.now();

    const paymentId = await ctx.db.insert("orderPayments", {
      organizationId: order.organizationId,
      orderId: order._id,
      paymentModeId: args.paymentModeId,
      paymentModeName: args.paymentModeName,
      amount: args.amount,
      transactionReference: args.transactionReference,
      createdAt: now,
    });

    await ctx.db.patch(order._id, {
      isCompleted: true,
      paymentStatus: "Paid",
      updatedAt: now,
    });

    // Complete associated postpaid request and clear table requested state
    if (order.tableId) {
      const postpaidByOrder = await ctx.db
        .query("postpaidOrderRequests")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      const toComplete =
        postpaidByOrder.length > 0
          ? postpaidByOrder
          : await ctx.db
              .query("postpaidOrderRequests")
              .withIndex("by_table_and_status", (q) =>
                q.eq("tableId", order.tableId!).eq("status", "approved")
              )
              .collect();

      for (const req of toComplete) {
        if (
          req.deletedAt === undefined &&
          (req.status === "approved" || req.status === "requested")
        ) {
          await ctx.db.patch(req._id, {
            status: "completed",
            updatedAt: now,
          });
        }
      }

      const table = await ctx.db.get(order.tableId);
      if (table && table.currentOrderId === order._id.toString()) {
        await ctx.db.patch(order.tableId, {
          currentOrderId: undefined,
          isRequested: false,
          updatedAt: now,
        });
      }
    }

    // Automated Provider Payment Transfer Hook (Fail-safe marketplace payout routing)
    await handleOrderCompletionTransfer(ctx, order._id);

    return { paymentId, success: true };
  },
});
