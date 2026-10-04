import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  requireMember,
} from "./organizationUsers";
import { requireAdminOrCashier } from "./organizationOrderProcesses";

// ----------------------------------------------------
// TYPES & INTERFACES
// ----------------------------------------------------

export type TransferStatus =
  | "created"
  | "processed"
  | "failed"
  | "reversed"
  | "pending";

export type SettlementStatus = "pending" | "settled";

export interface TransferSplitResult {
  grossAmount: number;
  transferPercentage: number;
  charges: number;
  transferAmount: number;
  holdSeconds: number;
  onHold: number;
  onHoldUntil?: number;
}

export interface TransferEligibilityResult {
  eligible: boolean;
  reason?: string;
  linkedAccountId?: string;
}

// ----------------------------------------------------
// PURE CALCULATION UTILITIES
// ----------------------------------------------------

/**
 * Calculates marketplace transfer amounts and hold schedule.
 * Formula matches legacy Rails:
 * charges = round(amount * transfer_percentage)
 * transfer_amount = amount - charges
 *
 * @param amount - Gross payment amount in minor currency units (paise / cents integer)
 * @param transferPercentage - Platform fee proportion (e.g. 0.03 for 3%)
 * @param transferHoldTime - Hold delay in seconds (e.g. 18000 for 5 hours)
 * @param timestamp - Base timestamp in milliseconds
 */
export function calculateTransferSplit(
  amount: number,
  transferPercentage = 0.03,
  transferHoldTime = 18000,
  timestamp = Date.now()
): TransferSplitResult {
  if (typeof amount !== "number" || isNaN(amount) || amount < 0) {
    throw new Error("Invalid transfer amount. Amount must be a positive integer in minor units.");
  }

  const intAmount = Math.round(amount);
  const effectivePercentage =
    typeof transferPercentage === "number" && !isNaN(transferPercentage) && transferPercentage >= 0
      ? transferPercentage
      : 0.03;

  const charges = Math.round(intAmount * effectivePercentage);
  const transferAmount = Math.max(0, intAmount - charges);

  const holdSeconds =
    typeof transferHoldTime === "number" && transferHoldTime > 0
      ? Math.round(transferHoldTime)
      : 0;

  const onHold = holdSeconds > 0 ? 1 : 0;
  const onHoldUntil =
    holdSeconds > 0 ? Math.floor(timestamp / 1000) + holdSeconds : undefined;

  return {
    grossAmount: intAmount,
    transferPercentage: effectivePercentage,
    charges,
    transferAmount,
    holdSeconds,
    onHold,
    onHoldUntil,
  };
}

/**
 * Evaluates whether an order payment qualifies for a platform marketplace payout transfer.
 * Legacy Rails Condition:
 * 1. order_payments.present?
 * 2. order_from == "Prest-Online"
 * 3. is_completed == true
 * 4. Store does NOT have custom direct Razorpay keys
 * 5. Store HAS a linked merchant account id
 */
export function checkTransferEligibility(
  order: Doc<"orders"> | any,
  organization: Doc<"organizations"> | any,
  orderPayment: Doc<"orderPayments"> | any
): TransferEligibilityResult {
  if (!order) {
    return { eligible: false, reason: "Order not found" };
  }

  if (!order.isCompleted) {
    return { eligible: false, reason: "Order is not completed" };
  }

  const source = (order.orderSource || order.orderFrom || "").trim();
  const isOnline =
    source === "Prest-Online" ||
    order.orderType === "Delivery" ||
    order.orderType === "ScheduledDelivery" ||
    order.orderType === "ScheduledPickup";

  if (!isOnline) {
    return { eligible: false, reason: "Not an online/platform order" };
  }

  if (!orderPayment || !orderPayment.amount || orderPayment.amount <= 0) {
    return { eligible: false, reason: "No valid order payment transaction found" };
  }

  // If organization has custom direct Razorpay gateway keys, payments bypass platform transfer
  const hasCustomGateway = Boolean(
    organization?.razorPayKeyId?.trim() || organization?.razorPayApiKey?.trim()
  );

  if (hasCustomGateway) {
    return {
      eligible: false,
      reason: "Store uses direct gateway credentials (payout transfer bypassed)",
    };
  }

  // Linked account in paymentSplitting
  const linkedAccountId =
    organization?.paymentSplitting?.linked_account_id ||
    organization?.paymentSplitting?.linkedAccountId;

  if (!linkedAccountId || typeof linkedAccountId !== "string" || !linkedAccountId.trim()) {
    return {
      eligible: false,
      reason: "Store has no connected linked merchant account configured",
    };
  }

  return {
    eligible: true,
    linkedAccountId: linkedAccountId.trim(),
  };
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Retrieves the active provider payment transfer associated with an order payment.
 */
export const getByOrderPayment = query({
  args: { orderPaymentId: v.id("orderPayments") },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    const transfer = await ctx.db
      .query("providerPaymentTransfers")
      .withIndex("by_order_payment", (q) =>
        q.eq("orderPaymentId", args.orderPaymentId)
      )
      .first();

    if (!transfer || transfer.deletedAt !== undefined) {
      return null;
    }

    return transfer;
  },
});

/**
 * Retrieves a provider payment transfer by external transfer ID.
 */
export const getByTransferId = query({
  args: { transferId: v.string() },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    const transfer = await ctx.db
      .query("providerPaymentTransfers")
      .withIndex("by_transfer_id", (q) => q.eq("transferId", args.transferId))
      .first();

    if (!transfer || transfer.deletedAt !== undefined) {
      return null;
    }

    return transfer;
  },
});

/**
 * Lists all active provider payment transfers for the store deployment.
 */
export const listByOrganization = query({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);

    const allTransfers = await ctx.db
      .query("providerPaymentTransfers")
      .collect();

    return allTransfers.filter((t) => t.deletedAt === undefined);
  },
});

/**
 * Inspects transfer eligibility and preview calculation for an order payment.
 */
export const getEligibilityAndSplit = query({
  args: { orderPaymentId: v.id("orderPayments") },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    const orderPayment = await ctx.db.get(args.orderPaymentId);
    if (!orderPayment) {
      throw new Error("Order payment not found");
    }

    const order = await ctx.db.get(orderPayment.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const org = await ctx.db.get(order.organizationId);

    const eligibility = checkTransferEligibility(order, org, orderPayment);
    const split = calculateTransferSplit(
      orderPayment.amount,
      org?.transferPercentage,
      org?.transferHoldTime
    );

    const existingTransfer = await ctx.db
      .query("providerPaymentTransfers")
      .withIndex("by_order_payment", (q) =>
        q.eq("orderPaymentId", args.orderPaymentId)
      )
      .first();

    return {
      eligibility,
      split,
      existingTransfer:
        existingTransfer && existingTransfer.deletedAt === undefined
          ? existingTransfer
          : null,
    };
  },
});

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * Records a provider payment transfer ledger entry.
 * Enforces 1:1 relationship and idempotency per orderPaymentId.
 */
export const recordTransfer = mutation({
  args: {
    orderPaymentId: v.id("orderPayments"),
    organizationId: v.optional(v.id("organizations")),
    transferId: v.optional(v.string()),
    transferAmount: v.number(),
    transferStatus: v.union(
      v.literal("created"),
      v.literal("processed"),
      v.literal("failed"),
      v.literal("reversed"),
      v.literal("pending")
    ),
    settlementStatus: v.optional(
      v.union(v.literal("pending"), v.literal("settled"))
    ),
    errorMessage: v.optional(v.string()),
    legacyId: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const payment = await ctx.db.get(args.orderPaymentId);
    if (!payment) {
      throw new Error("Order payment not found");
    }

    // 1. Idempotency Check: Verify if active transfer already exists
    const existing = await ctx.db
      .query("providerPaymentTransfers")
      .withIndex("by_order_payment", (q) =>
        q.eq("orderPaymentId", args.orderPaymentId)
      )
      .first();

    if (existing && existing.deletedAt === undefined) {
      return {
        id: existing._id,
        alreadyExists: true,
        transfer: existing,
      };
    }

    const now = Date.now();

    const transferDocId = await ctx.db.insert("providerPaymentTransfers", {
      legacyId: args.legacyId,
      orderPaymentId: args.orderPaymentId,
      organizationId: args.organizationId ?? payment.organizationId,
      transferId: args.transferId,
      transferAmount: Math.round(args.transferAmount),
      transferStatus: args.transferStatus,
      settlementStatus: args.settlementStatus ?? "pending",
      errorMessage: args.errorMessage,
      createdAt: args.createdAt ?? now,
      updatedAt: args.updatedAt ?? now,
    });

    return {
      id: transferDocId,
      alreadyExists: false,
    };
  },
});

/**
 * Updates mutable status fields on a provider payment transfer.
 * Financial amounts and order payment links remain immutable.
 */
export const updateStatus = mutation({
  args: {
    id: v.id("providerPaymentTransfers"),
    transferStatus: v.optional(
      v.union(
        v.literal("created"),
        v.literal("processed"),
        v.literal("failed"),
        v.literal("reversed"),
        v.literal("pending")
      )
    ),
    settlementStatus: v.optional(
      v.union(v.literal("pending"), v.literal("settled"))
    ),
    errorMessage: v.optional(v.string()),
    transferId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Provider payment transfer record not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      ...(args.transferStatus !== undefined
        ? { transferStatus: args.transferStatus }
        : {}),
      ...(args.settlementStatus !== undefined
        ? { settlementStatus: args.settlementStatus }
        : {}),
      ...(args.errorMessage !== undefined
        ? { errorMessage: args.errorMessage }
        : {}),
      ...(args.transferId !== undefined ? { transferId: args.transferId } : {}),
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Soft deletes a provider payment transfer record.
 */
export const remove = mutation({
  args: { id: v.id("providerPaymentTransfers") },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Provider payment transfer record not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      deletedAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Automated hook to evaluate and record marketplace transfer intent on order completion.
 * Ensures that failure or ineligibility never blocks order workflow completion.
 */
export async function handleOrderCompletionTransfer(
  ctx: MutationCtx,
  orderId: Id<"orders">
): Promise<{ processed: boolean; reason?: string; transferId?: Id<"providerPaymentTransfers"> }> {
  try {
    const order = await ctx.db.get(orderId);
    if (!order || !order.isCompleted) {
      return { processed: false, reason: "Order is not completed" };
    }

    const orderPayments = await ctx.db
      .query("orderPayments")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();

    const payment = orderPayments[0];
    if (!payment) {
      return { processed: false, reason: "No payment transaction found" };
    }

    const org = await ctx.db.get(order.organizationId);
    const eligibility = checkTransferEligibility(order, org, payment);

    if (!eligibility.eligible) {
      return { processed: false, reason: eligibility.reason };
    }

    // Check idempotency
    const existing = await ctx.db
      .query("providerPaymentTransfers")
      .withIndex("by_order_payment", (q) =>
        q.eq("orderPaymentId", payment._id)
      )
      .first();

    if (existing && existing.deletedAt === undefined) {
      return { processed: true, transferId: existing._id, reason: "Already recorded" };
    }

    const split = calculateTransferSplit(
      payment.amount,
      org?.transferPercentage,
      org?.transferHoldTime
    );

    const now = Date.now();
    // Records explicit transfer intent (status: "pending") awaiting background provider execution
    const newTransferId = await ctx.db.insert("providerPaymentTransfers", {
      orderPaymentId: payment._id,
      organizationId: order.organizationId,
      transferAmount: split.transferAmount,
      transferStatus: "pending",
      settlementStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return { processed: true, transferId: newTransferId };
  } catch (err: any) {
    console.error("[ProviderPaymentTransfer] Error processing completion transfer:", err);
    return { processed: false, reason: err?.message ?? "Transfer evaluation error" };
  }
}
