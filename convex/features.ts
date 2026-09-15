import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Standard 7 Master Store Features (Synced from Super Admin without "test")
 */
export const DEFAULT_MASTER_FEATURES = [
  {
    name: "auto_accept",
    displayName: "Auto Accept",
    description: "Order Auto Accepted",
    displayDescription: undefined,
  },
  {
    name: "show_table_tab_in_cashier",
    displayName: "Show Table Tab In Cashier",
    description: "Show table tab in cashier",
    displayDescription: undefined,
  },
  {
    name: "show_member_number_on_cashier_card",
    displayName: "Show Member Number On Cashier Card",
    description: "Show member number on cashier card",
    displayDescription: undefined,
  },
  {
    name: "show_table_on_cashier_card",
    displayName: "Show Table On Cashier Card",
    description: "Show table on cashier card",
    displayDescription: undefined,
  },
  {
    name: "show_waiter_on_cashier_card",
    displayName: "Show Waiter On Cashier Card",
    description: "Show waiter on cashier card",
    displayDescription: undefined,
  },
  {
    name: "skip_payment_on_cashier_card",
    displayName: "Skip Payment On Cashier Card",
    description: "Skip payment on cashier card",
    displayDescription: undefined,
  },
  {
    name: "skip_phone_number_required",
    displayName: "Skip Phone Number Required",
    description: "Skip phone number required",
    displayDescription: undefined,
  },
];

/**
 * Helper to seed master features in the database
 */
export async function seedMasterFeaturesHelper(ctx: MutationCtx) {
  const now = Date.now();
  const createdIds: Record<string, Id<"features">> = {};

  for (const feat of DEFAULT_MASTER_FEATURES) {
    const existing = await ctx.db
      .query("features")
      .withIndex("by_name", (q) => q.eq("name", feat.name))
      .first();

    if (!existing) {
      const id = await ctx.db.insert("features", {
        name: feat.name,
        displayName: feat.displayName,
        description: feat.description,
        displayDescription: feat.displayDescription,
        createdAt: now,
        updatedAt: now,
      });
      createdIds[feat.name] = id;
    } else {
      createdIds[feat.name] = existing._id;
      const patchData: Record<string, any> = {};
      if (existing.deletedAt !== undefined) {
        patchData.deletedAt = undefined;
      }
      if (!existing.displayName && feat.displayName) patchData.displayName = feat.displayName;
      if (!existing.description && feat.description) patchData.description = feat.description;
      if (Object.keys(patchData).length > 0) {
        patchData.updatedAt = now;
        await ctx.db.patch(existing._id, patchData);
      }
    }
  }

  // Soft delete any 'test' master feature if present
  const testFeature = await ctx.db
    .query("features")
    .withIndex("by_name", (q) => q.eq("name", "test"))
    .first();
  if (testFeature && testFeature.deletedAt === undefined) {
    await ctx.db.patch(testFeature._id, {
      deletedAt: now,
      updatedAt: now,
    });
  }

  return createdIds;
}

/**
 * Query: List master features (matches GET /api/features from Super Admin)
 */
export const list = query({
  args: {
    includeDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("features").collect();

    if (all.length > 0) {
      const filtered = all.filter(
        (f) => (args.includeDeleted || f.deletedAt === undefined) && f.name !== "test"
      );

      return filtered.sort((a, b) => {
        const idxA = DEFAULT_MASTER_FEATURES.findIndex((f) => f.name === a.name);
        const idxB = DEFAULT_MASTER_FEATURES.findIndex((f) => f.name === b.name);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.name.localeCompare(b.name);
      });
    }

    // Default fallback if table is not yet seeded
    return DEFAULT_MASTER_FEATURES.map((f, i) => ({
      _id: `default_feature_${i}` as unknown as Id<"features">,
      name: f.name,
      displayName: f.displayName,
      description: f.description,
      displayDescription: f.displayDescription,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
  },
});

/**
 * Query: Get a single master feature by name
 */
export const getByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const key = args.name.trim();
    const existing = await ctx.db
      .query("features")
      .withIndex("by_name", (q) => q.eq("name", key))
      .first();

    if (existing && existing.deletedAt === undefined) {
      return existing;
    }

    const fallback = DEFAULT_MASTER_FEATURES.find((f) => f.name === key);
    if (fallback) {
      return {
        _id: `default_feature_${key}` as unknown as Id<"features">,
        name: fallback.name,
        displayName: fallback.displayName,
        description: fallback.description,
        displayDescription: fallback.displayDescription,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    return null;
  },
});

/**
 * Mutation: Seed or sync master features
 */
export const seedMasterFeatures = mutation({
  args: {},
  handler: async (ctx) => {
    const ids = await seedMasterFeaturesHelper(ctx);
    return { success: true, count: Object.keys(ids).length };
  },
});
