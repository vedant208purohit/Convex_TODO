import { query, internalMutation, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireStaffMember, requireAdminOrCashier } from "./orderDelivers";
import { sanitizePayload, DeliveryStatus } from "./deliveryProvider";

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Staff Query: Retrieves the complete chronological status & event history for a delivery attempt.
 * Strictly verifies staff authorization and filters out soft-deleted records.
 */
export const getDeliveryStatusHistory = query({
  args: {
    deliveryId: v.id("orderDelivers"),
  },
  handler: async (ctx, args) => {
    await requireStaffMember(ctx);

    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery || delivery.deletedAt !== undefined) {
      throw new Error("Delivery record not found.");
    }

    const statuses = await ctx.db
      .query("orderDeliverStatuses")
      .withIndex("by_delivery", (q) => q.eq("deliveryId", args.deliveryId))
      .collect();

    return statuses
      .filter((s) => s.deletedAt === undefined)
      .sort((a, b) => a.createdAt - b.createdAt || a._creationTime - b._creationTime);
  },
});

// ----------------------------------------------------
// INTERNAL MUTATIONS (STATUS APPEND & AUDIT LOGGING)
// ----------------------------------------------------

/**
 * Internal Helper/Mutation: Appends a status history record to a delivery attempt.
 */
export const appendStatusRecord = internalMutation({
  args: {
    deliveryId: v.id("orderDelivers"),
    status: v.union(
      v.literal("pending"),
      v.literal("open"),
      v.literal("accepted"),
      v.literal("live"),
      v.literal("ended"),
      v.literal("cancelled"),
      v.literal("failed")
    ),
    providerStatus: v.optional(v.string()),
    payloadSnapshot: v.optional(v.any()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery || delivery.deletedAt !== undefined) {
      throw new Error("Delivery record not found for status append.");
    }

    const now = Date.now();
    const sanitizedSnapshot = args.payloadSnapshot
      ? sanitizePayload(args.payloadSnapshot)
      : undefined;

    const statusId = await ctx.db.insert("orderDeliverStatuses", {
      deliveryId: args.deliveryId,
      status: args.status,
      providerStatus: args.providerStatus,
      payloadSnapshot: sanitizedSnapshot,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });

    return statusId;
  },
});

/**
 * Migration Mutation: Ingests a legacy Rails `order_deliver_statuses` row.
 * Preserves legacy ID, validates delivery relationship, and guards against duplicate migration.
 */
export const migrateLegacyStatus = mutation({
  args: {
    legacyId: v.string(),
    deliveryId: v.id("orderDelivers"),
    status: v.union(
      v.literal("pending"),
      v.literal("open"),
      v.literal("accepted"),
      v.literal("live"),
      v.literal("ended"),
      v.literal("cancelled"),
      v.literal("failed")
    ),
    providerStatus: v.optional(v.string()),
    payloadSnapshot: v.optional(v.any()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if delivery attempt exists
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) {
      throw new Error(
        `Migration Error: Parent delivery ${args.deliveryId} not found for status ${args.legacyId}.`
      );
    }

    // Check for duplicate legacy ID
    const existing = await ctx.db
      .query("orderDeliverStatuses")
      .withIndex("by_legacy_id", (q) => q.eq("legacyId", args.legacyId))
      .first();

    if (existing) {
      return { statusId: existing._id, alreadyMigrated: true };
    }

    const sanitizedSnapshot = args.payloadSnapshot
      ? sanitizePayload(args.payloadSnapshot)
      : undefined;

    const statusId = await ctx.db.insert("orderDeliverStatuses", {
      legacyId: args.legacyId,
      deliveryId: args.deliveryId,
      status: args.status,
      providerStatus: args.providerStatus,
      payloadSnapshot: sanitizedSnapshot,
      notes: args.notes,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
      deletedAt: args.deletedAt,
    });

    return { statusId, alreadyMigrated: false };
  },
});
