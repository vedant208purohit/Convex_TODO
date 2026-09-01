import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./organizationUsers";

/**
 * Audited Store Default Feature Catalog Keys & Initial States
 */
export const DEFAULT_STORE_FEATURES = [
  {
    featureKey: "skip_phone_number_required",
    active: false,
  },
  {
    featureKey: "show_waiter_on_cashier_card",
    active: false,
  },
  {
    featureKey: "skip_payment_on_cashier_card",
    active: false,
  },
  {
    featureKey: "show_table_on_cashier_card",
    active: false,
  },
  {
    featureKey: "show_member_number_on_cashier_card",
    active: false,
  },
  {
    featureKey: "show_table_tab_in_cashier",
    active: false,
  },
  {
    featureKey: "auto_accept",
    active: false,
  },
];

/**
 * Helper: Idempotently seed store default features
 * Preserves existing `active` state if feature flag already exists.
 * Does NOT resurrect soft-deleted feature flags.
 */
export async function initializeDefaultsHelper(ctx: MutationCtx) {
  const now = Date.now();

  for (const defaultFeature of DEFAULT_STORE_FEATURES) {
    const existing = await ctx.db
      .query("organizationFeatures")
      .withIndex("by_feature_key", (q) =>
        q.eq("featureKey", defaultFeature.featureKey)
      )
      .first();

    if (!existing) {
      // Only insert if feature flag has never been created for this store
      await ctx.db.insert("organizationFeatures", {
        featureKey: defaultFeature.featureKey,
        active: defaultFeature.active,
        createdAt: now,
        updatedAt: now,
      });
    }
    // If flag exists (whether active or soft-deleted), preserve existing configuration & deletion state.
  }
}

/**
 * Query feature flag state by key
 */
export const get = query({
  args: { featureKey: v.string() },
  handler: async (ctx, args) => {
    if (!args.featureKey || !args.featureKey.trim()) return null;

    const flag = await ctx.db
      .query("organizationFeatures")
      .withIndex("by_feature_key", (q) => q.eq("featureKey", args.featureKey.trim()))
      .first();

    if (!flag || flag.deletedAt !== undefined) {
      return null;
    }

    return flag;
  },
});

/**
 * Query all feature flags for the single store database
 */
export const list = query({
  args: { includeDeleted: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const flags = await ctx.db
      .query("organizationFeatures")
      .collect();

    if (args.includeDeleted) {
      return flags;
    }

    return flags.filter((f) => f.deletedAt === undefined);
  },
});

/**
 * Store Admin Mutation: Toggle Feature Flag
 * Server-side authorization: verified via requireAdmin helper
 */
export const toggle = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    featureKey: v.string(),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    // 1. Authenticate & Authorize Admin for target organization
    const auth = await requireAdmin(ctx, args.organizationId);

    // 2. Feature Key Lookup
    const key = args.featureKey.trim();
    const existing = await ctx.db
      .query("organizationFeatures")
      .withIndex("by_feature_key", (q) => q.eq("featureKey", key))
      .first();

    if (!existing || existing.deletedAt !== undefined) {
      throw new Error(`Feature flag "${key}" not found.`);
    }

    // 3. Organization boundary validation
    if (existing.organizationId && existing.organizationId !== auth.organization._id) {
      throw new Error("Forbidden. Feature flag belongs to another organization.");
    }

    // 4. Update Flag State
    const now = Date.now();
    await ctx.db.patch(existing._id, {
      active: args.active,
      updatedAt: now,
    });

    return { success: true, featureKey: key, active: args.active };
  },
});

/**
 * Store Provisioning Mutation: Seed Default Feature Flags
 */
export const initializeDefaults = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx) => {
    await initializeDefaultsHelper(ctx);
    return { success: true };
  },
});

/**
 * Soft Delete Feature Flag
 */
export const softDelete = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    featureKey: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAdmin(ctx, args.organizationId);

    const key = args.featureKey.trim();
    const existing = await ctx.db
      .query("organizationFeatures")
      .withIndex("by_feature_key", (q) => q.eq("featureKey", key))
      .first();

    if (!existing || existing.deletedAt !== undefined) {
      throw new Error(`Feature flag "${key}" not found.`);
    }

    if (existing.organizationId && existing.organizationId !== auth.organization._id) {
      throw new Error("Forbidden. Feature flag belongs to another organization.");
    }

    const now = Date.now();
    await ctx.db.patch(existing._id, {
      deletedAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});
