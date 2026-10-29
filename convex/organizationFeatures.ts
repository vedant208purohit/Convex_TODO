import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAdmin } from "./organizationUsers";

/**
 * Standard Store Feature Flags Catalog
 * Seeded without the "test" flag as required.
 */
export const DEFAULT_STORE_FEATURES = [
  {
    featureKey: "auto_accept",
    name: "auto_accept",
    displayName: "Auto Accept",
    description: "Order Auto Accepted",
    active: false,
  },
  {
    featureKey: "show_table_tab_in_cashier",
    name: "show_table_tab_in_cashier",
    displayName: "Show Table Tab In Cashier",
    description: "Show table tab in cashier",
    active: false,
  },
  {
    featureKey: "show_member_number_on_cashier_card",
    name: "show_member_number_on_cashier_card",
    displayName: "Show Member Number On Cashier Card",
    description: "Show member number on cashier card",
    active: false,
  },
  {
    featureKey: "show_table_on_cashier_card",
    name: "show_table_on_cashier_card",
    displayName: "Show Table On Cashier Card",
    description: "Show table on cashier card",
    active: false,
  },
  {
    featureKey: "show_waiter_on_cashier_card",
    name: "show_waiter_on_cashier_card",
    displayName: "Show Waiter On Cashier Card",
    description: "Show waiter on cashier card",
    active: false,
  },
  {
    featureKey: "skip_payment_on_cashier_card",
    name: "skip_payment_on_cashier_card",
    displayName: "Skip Payment On Cashier Card",
    description: "Skip payment on cashier card",
    active: false,
  },
  {
    featureKey: "skip_phone_number_required",
    name: "skip_phone_number_required",
    displayName: "Skip Phone Number Required",
    description: "Skip phone number required",
    active: false,
  },
  // KDS & Kitchen Thermal Printing Feature Flags
  {
    featureKey: "kds_print_waiter_name",
    name: "kds_print_waiter_name",
    displayName: "Show Waiter / Server Name on KOT",
    description: "Display the server who took the order on the printed KOT",
    active: true,
  },
  {
    featureKey: "kds_print_guest_count",
    name: "kds_print_guest_count",
    displayName: "Show Guest Count on KOT",
    description: "Print the number of seated guests on the kitchen ticket",
    active: false,
  },
  {
    featureKey: "kds_print_customer_info",
    name: "kds_print_customer_info",
    displayName: "Show Customer Name & Phone on KOT",
    description: "Include customer contact details on takeaway and delivery kitchen tickets",
    active: false,
  },
  {
    featureKey: "kds_print_order_type",
    name: "kds_print_order_type",
    displayName: "Highlight Order Type Badge on KOT",
    description: "Print high-contrast tags ([DINE-IN], [TAKEAWAY], [DELIVERY]) on the ticket",
    active: true,
  },
  {
    featureKey: "kds_print_timestamp",
    name: "kds_print_timestamp",
    displayName: "Show Fired Time & Seconds on KOT",
    description: "Include exact timestamp (HH:MM:SS) on the kitchen ticket",
    active: true,
  },
  {
    featureKey: "kds_print_item_modifiers",
    name: "kds_print_item_modifiers",
    displayName: "Show Item Modifiers on KOT",
    description: "Print indented item modifiers beneath each dish description",
    active: true,
  },
  {
    featureKey: "kds_print_special_notes",
    name: "kds_print_special_notes",
    displayName: "Show Custom Cooking Notes on KOT",
    description: "Print custom kitchen instructions and chef preparation notes",
    active: true,
  },
  {
    featureKey: "kds_print_show_prices",
    name: "kds_print_show_prices",
    displayName: "Print Prices on KOT",
    description: "Include individual item prices and subtotal on the kitchen ticket",
    active: false,
  },
  {
    featureKey: "kds_print_combo_breakdown",
    name: "kds_print_combo_breakdown",
    displayName: "Expand Combo / Meal Components on KOT",
    description: "Print individual combo components indented under the parent combo package",
    active: true,
  },
  {
    featureKey: "kds_auto_print_on_fire",
    name: "kds_auto_print_on_fire",
    displayName: "Auto-Print KOT on Order Fired",
    description: "Automatically dispatch and print KOT ticket to station printer when order arrives on KDS",
    active: false,
  },
];

/**
 * Helper: Idempotently seed store default features
 * Preserves existing `active` state if feature flag already exists.
 * Does NOT resurrect soft-deleted feature flags unless specified.
 */
export async function initializeDefaultsHelper(
  ctx: MutationCtx,
  organizationId?: Id<"organizations">,
  resurrectDeleted: boolean = false
) {
  const now = Date.now();

  for (const defaultFeature of DEFAULT_STORE_FEATURES) {
    // Check master feature catalog ID if available
    const masterFeature = await ctx.db
      .query("features")
      .withIndex("by_name", (q) => q.eq("name", defaultFeature.name))
      .first();

    const existing = await ctx.db
      .query("organizationFeatures")
      .withIndex("by_feature_key", (q) =>
        q.eq("featureKey", defaultFeature.featureKey)
      )
      .first();

    if (!existing) {
      await ctx.db.insert("organizationFeatures", {
        organizationId,
        featureId: masterFeature?._id,
        featureKey: defaultFeature.featureKey,
        name: defaultFeature.name,
        displayName: defaultFeature.displayName,
        description: defaultFeature.description,
        active: defaultFeature.active,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      // Patch name, displayName, description, or featureId if missing or outdated
      const patchData: Record<string, any> = {};
      if (resurrectDeleted && existing.deletedAt !== undefined) {
        patchData.deletedAt = undefined;
      }
      if (!existing.name && defaultFeature.name) patchData.name = defaultFeature.name;
      if (!existing.displayName && defaultFeature.displayName)
        patchData.displayName = defaultFeature.displayName;
      if (!existing.description && defaultFeature.description)
        patchData.description = defaultFeature.description;
      if (!existing.featureId && masterFeature?._id)
        patchData.featureId = masterFeature._id;
      if (!existing.organizationId && organizationId)
        patchData.organizationId = organizationId;

      if (Object.keys(patchData).length > 0) {
        patchData.updatedAt = now;
        await ctx.db.patch(existing._id, patchData);
      }
    }
  }

  // Clean up any test flags if present in DB
  const testFlag = await ctx.db
    .query("organizationFeatures")
    .withIndex("by_feature_key", (q) => q.eq("featureKey", "test"))
    .first();
  if (testFlag && testFlag.deletedAt === undefined) {
    await ctx.db.patch(testFlag._id, {
      deletedAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Query feature flag state by key
 */
export const get = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    featureKey: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.featureKey || !args.featureKey.trim()) return null;

    const key = args.featureKey.trim();
    const flag = await ctx.db
      .query("organizationFeatures")
      .withIndex("by_feature_key", (q) => q.eq("featureKey", key))
      .first();

    if (flag) {
      if (flag.deletedAt !== undefined) {
        return null;
      }
      return flag;
    }

    // Fallback if not yet in database: check standard catalog default
    const fallback = DEFAULT_STORE_FEATURES.find((f) => f.featureKey === key);
    if (fallback) {
      return {
        _id: `default_${key}` as unknown as Id<"organizationFeatures">,
        featureKey: fallback.featureKey,
        name: fallback.name,
        displayName: fallback.displayName,
        description: fallback.description,
        active: fallback.active,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    return null;
  },
});

/**
 * Query all feature flags for the store
 */
export const list = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    includeDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const flags = await ctx.db.query("organizationFeatures").collect();

    // If database has records, return filtered records merged with any missing catalog defaults
    if (flags.length > 0) {
      const filtered = flags.filter(
        (f) => (args.includeDeleted || f.deletedAt === undefined) && f.featureKey !== "test"
      );

      // Merge unseeded default catalog features (not yet created in DB and not soft-deleted)
      const dbAllKeys = new Set(flags.map((f) => f.featureKey));
      for (const df of DEFAULT_STORE_FEATURES) {
        if (!dbAllKeys.has(df.featureKey)) {
          filtered.push({
            _id: `default_${df.featureKey}` as unknown as Id<"organizationFeatures">,
            organizationId: args.organizationId,
            featureKey: df.featureKey,
            name: df.name,
            displayName: df.displayName,
            description: df.description,
            active: df.active,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          } as any);
        }
      }

      return filtered.sort((a, b) => {
        const idxA = DEFAULT_STORE_FEATURES.findIndex((f) => f.featureKey === a.featureKey);
        const idxB = DEFAULT_STORE_FEATURES.findIndex((f) => f.featureKey === b.featureKey);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.featureKey.localeCompare(b.featureKey);
      });
    }

    // If database is completely empty, return standard catalog defaults
    return DEFAULT_STORE_FEATURES.map((df) => ({
      _id: `default_${df.featureKey}` as unknown as Id<"organizationFeatures">,
      featureKey: df.featureKey,
      name: df.name,
      displayName: df.displayName,
      description: df.description,
      active: df.active,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
  },
});

/**
 * Store Admin Mutation: Toggle Feature Flag
 * Server-side authorization: verified via requireAdmin helper.
 * Auto-creates the feature flag if it doesn't exist yet in the database.
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

    const now = Date.now();

    if (!existing) {
      // Auto-provision if flag was in standard catalog but not yet in DB
      const meta = DEFAULT_STORE_FEATURES.find((f) => f.featureKey === key);
      if (!meta) {
        throw new Error(`Feature flag "${key}" not found.`);
      }

      const newId = await ctx.db.insert("organizationFeatures", {
        organizationId: auth.organization._id,
        featureKey: key,
        name: meta.name,
        description: meta.description,
        active: args.active,
        createdAt: now,
        updatedAt: now,
      });

      return { success: true, featureKey: key, active: args.active, id: newId };
    }

    // 3. Organization boundary validation
    if (existing.organizationId && existing.organizationId !== auth.organization._id) {
      throw new Error("Forbidden. Feature flag belongs to another organization.");
    }

    // 4. Update Flag State (resurrect if previously soft-deleted)
    await ctx.db.patch(existing._id, {
      active: args.active,
      deletedAt: undefined,
      updatedAt: now,
    });

    return { success: true, featureKey: key, active: args.active, id: existing._id };
  },
});

/**
 * Store Provisioning Mutation: Seed Default Feature Flags
 */
export const initializeDefaults = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    await initializeDefaultsHelper(ctx, args.organizationId);
    return { success: true, seededCount: DEFAULT_STORE_FEATURES.length };
  },
});

/**
 * Public/Admin Mutation: Explicit Seed Features
 */
export const seedDefaultFeatures = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    resurrectDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await initializeDefaultsHelper(ctx, args.organizationId, args.resurrectDeleted ?? true);
    return { success: true, seededFeatures: DEFAULT_STORE_FEATURES.map((f) => f.featureKey) };
  },
});

/**
 * Create a new feature flag
 */
export const create = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    name: v.string(),
    description: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAdmin(ctx, args.organizationId);
    const featureKey = args.name.trim().toLowerCase().replace(/\s+/g, "_");

    const existing = await ctx.db
      .query("organizationFeatures")
      .withIndex("by_feature_key", (q) => q.eq("featureKey", featureKey))
      .first();

    const now = Date.now();

    if (existing) {
      if (existing.deletedAt !== undefined) {
        await ctx.db.patch(existing._id, {
          name: args.name.trim(),
          description: args.description?.trim(),
          active: args.active ?? false,
          deletedAt: undefined,
          updatedAt: now,
        });
        return { success: true, id: existing._id, featureKey };
      }
      throw new Error(`Feature "${featureKey}" already exists.`);
    }

    const id = await ctx.db.insert("organizationFeatures", {
      organizationId: auth.organization._id,
      featureKey,
      name: args.name.trim(),
      description: args.description?.trim() || args.name.trim(),
      active: args.active ?? false,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, id, featureKey };
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
