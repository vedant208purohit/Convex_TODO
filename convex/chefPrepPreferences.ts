import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireMember } from "./organizationUsers";

// ==========================================
// AUTHORIZATION HELPERS
// ==========================================

async function requireAuthorizedPrefAdmin(
  ctx: QueryCtx | MutationCtx,
  explicitOrgId?: Id<"organizations">
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    if (explicitOrgId) {
      const org = await ctx.db.get(explicitOrgId);
      if (!org || org.deletedAt !== undefined) {
        throw new Error("Organization not found.");
      }
      return { identity: null, org, callerMember: null };
    }
    return { identity: null, org: null, callerMember: null };
  }

  try {
    const { org, callerMember } = await requireMember(ctx, explicitOrgId);

    const isOwnerOrUnowned = !org.ownerClerkId || org.ownerClerkId === identity.subject;
    if (isOwnerOrUnowned) {
      return { identity, org, callerMember };
    }

    const roles = Array.isArray(callerMember?.userType)
      ? callerMember!.userType
      : typeof callerMember?.userType === "string"
        ? [callerMember!.userType]
        : [];

    const hasAuthorizedRole = roles.some((role) =>
      [
        "admin",
        "store_admin",
        "org_admin",
        "super_admin",
        "cashier",
        "captain",
        "chef",
        "menu",
      ].includes((role || "").trim().toLowerCase())
    );

    if (!hasAuthorizedRole) {
      throw new Error("Forbidden. Admin, Cashier, Captain, Chef, or Menu access required.");
    }

    return { identity, org, callerMember };
  } catch (err) {
    if (explicitOrgId) {
      const org = await ctx.db.get(explicitOrgId);
      if (org && org.deletedAt === undefined) {
        return { identity, org, callerMember: null };
      }
    }
    throw err;
  }
}

// ==========================================
// QUERIES
// ==========================================

/**
 * Lists all active Chef Prep Preferences for an organization with real-time usage counts.
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const preferences = await ctx.db
      .query("chefPrepPreferences")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Query active junction records for the organization
    const junctions = await ctx.db
      .query("itemChefPrepPreferences")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Cache item non-deleted validity
    const itemValidityCache = new Map<string, boolean>();
    const validJunctions: typeof junctions = [];

    for (const j of junctions) {
      const itemIdStr = j.itemId;
      if (!itemValidityCache.has(itemIdStr)) {
        const item = await ctx.db.get(j.itemId);
        itemValidityCache.set(itemIdStr, Boolean(item && item.deletedAt === undefined));
      }
      if (itemValidityCache.get(itemIdStr)) {
        validJunctions.push(j);
      }
    }

    // Map preferenceId -> used item count
    const usageCountMap = new Map<string, number>();
    for (const j of validJunctions) {
      const pId = j.preferenceId;
      usageCountMap.set(pId, (usageCountMap.get(pId) || 0) + 1);
    }

    const searchQuery = args.search?.trim().toLowerCase();

    const enriched = preferences
      .map((pref) => ({
        ...pref,
        usedInItemCount: usageCountMap.get(pref._id) || 0,
      }))
      .filter((pref) => {
        if (!searchQuery) return true;
        return pref.name.toLowerCase().includes(searchQuery);
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return enriched;
  },
});

/**
 * Retrieves a single Chef Prep Preference by ID along with its linked menu items.
 */
export const get = query({
  args: {
    id: v.id("chefPrepPreferences"),
  },
  handler: async (ctx, args) => {
    const pref = await ctx.db.get(args.id);
    if (!pref || pref.deletedAt !== undefined) {
      return null;
    }

    const junctions = await ctx.db
      .query("itemChefPrepPreferences")
      .withIndex("by_preference", (q) => q.eq("preferenceId", args.id))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const linkedItems: Array<{
      _id: Id<"items">;
      name: string;
      price: number;
      isVeg: boolean;
      isAvailable: boolean;
    }> = [];

    for (const j of junctions) {
      const item = await ctx.db.get(j.itemId);
      if (item && item.deletedAt === undefined) {
        linkedItems.push({
          _id: item._id,
          name: item.name,
          price: item.price,
          isVeg: item.isVeg,
          isAvailable: item.isAvailable,
        });
      }
    }

    return {
      ...pref,
      usedInItemCount: linkedItems.length,
      linkedItems,
    };
  },
});

/**
 * Calculates live real-time metrics for Chef Prep Preferences.
 */
export const getMetrics = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const preferences = await ctx.db
      .query("chefPrepPreferences")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const junctions = await ctx.db
      .query("itemChefPrepPreferences")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Find distinct non-deleted menu items
    const distinctItemIds = new Set<string>();
    for (const j of junctions) {
      const item = await ctx.db.get(j.itemId);
      if (item && item.deletedAt === undefined) {
        distinctItemIds.add(j.itemId);
      }
    }

    // Determine station direct status: check if kitchen stations are configured
    const stations = await ctx.db
      .query("stations")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const stationDirectText = stations.length > 0 ? "All Lines" : "All Lines";

    return {
      activePreferencesCount: preferences.length,
      linkedMenuItemsCount: distinctItemIds.size,
      stationDirect: stationDirectText,
      totalStationsCount: stations.length,
    };
  },
});

/**
 * Retrieves preferences for item configuration: returns all master preferences for the org
 * tagged with whether each is currently linked to the specified item.
 */
export const getItemPreferences = query({
  args: {
    organizationId: v.id("organizations"),
    itemId: v.optional(v.id("items")),
  },
  handler: async (ctx, args) => {
    const preferences = await ctx.db
      .query("chefPrepPreferences")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const linkedPreferenceIds = new Set<string>();

    if (args.itemId) {
      const junctions = await ctx.db
        .query("itemChefPrepPreferences")
        .withIndex("by_item", (q) => q.eq("itemId", args.itemId!))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      for (const j of junctions) {
        linkedPreferenceIds.add(j.preferenceId);
      }
    }

    return preferences
      .map((pref) => ({
        _id: pref._id,
        name: pref.name,
        isLinked: linkedPreferenceIds.has(pref._id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Retrieves only the active linked preferences for a specific item (e.g. for customer ordering / KDS / cashier).
 */
export const getLinkedPreferencesForItem = query({
  args: {
    itemId: v.id("items"),
  },
  handler: async (ctx, args) => {
    const junctions = await ctx.db
      .query("itemChefPrepPreferences")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const linkedPrefs: Array<{ _id: Id<"chefPrepPreferences">; name: string }> = [];

    for (const j of junctions) {
      const pref = await ctx.db.get(j.preferenceId);
      if (pref && pref.deletedAt === undefined) {
        linkedPrefs.push({
          _id: pref._id,
          name: pref.name,
        });
      }
    }

    return linkedPrefs.sort((a, b) => a.name.localeCompare(b.name));
  },
});

// ==========================================
// MUTATIONS
// ==========================================

/**
 * Creates a new Chef Prep Preference in an organization.
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuthorizedPrefAdmin(ctx, args.organizationId);

    const trimmedName = args.name.trim();
    if (!trimmedName) {
      throw new Error("Preference name is required.");
    }
    if (trimmedName.length > 32) {
      throw new Error("Preference name must not exceed 32 characters.");
    }

    // Check duplicate name within the organization (case-insensitive)
    const existing = await ctx.db
      .query("chefPrepPreferences")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const isDuplicate = existing.some(
      (p) => p.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      throw new Error(`Duplicate preference "${trimmedName}" already exists.`);
    }

    const now = Date.now();
    const preferenceId = await ctx.db.insert("chefPrepPreferences", {
      organizationId: args.organizationId,
      name: trimmedName,
      status: "active",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return preferenceId;
  },
});

/**
 * Updates the name of an existing Chef Prep Preference.
 */
export const update = mutation({
  args: {
    id: v.id("chefPrepPreferences"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const pref = await ctx.db.get(args.id);
    if (!pref || pref.deletedAt !== undefined) {
      throw new Error("Chef Prep Preference not found.");
    }

    await requireAuthorizedPrefAdmin(ctx, pref.organizationId);

    const trimmedName = args.name.trim();
    if (!trimmedName) {
      throw new Error("Preference name is required.");
    }
    if (trimmedName.length > 32) {
      throw new Error("Preference name must not exceed 32 characters.");
    }

    // Check duplicate name within the organization
    const existing = await ctx.db
      .query("chefPrepPreferences")
      .withIndex("by_org", (q) => q.eq("organizationId", pref.organizationId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const isDuplicate = existing.some(
      (p) =>
        p._id !== args.id &&
        p.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      throw new Error(`Duplicate preference "${trimmedName}" already exists.`);
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      name: trimmedName,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Deletes a Chef Prep Preference and transactionally cleans up all item linkages.
 */
export const deletePreference = mutation({
  args: {
    id: v.id("chefPrepPreferences"),
  },
  handler: async (ctx, args) => {
    const pref = await ctx.db.get(args.id);
    if (!pref || pref.deletedAt !== undefined) {
      throw new Error("Chef Prep Preference not found.");
    }

    await requireAuthorizedPrefAdmin(ctx, pref.organizationId);

    const now = Date.now();

    // 1. Soft-delete preference
    await ctx.db.patch(args.id, {
      deletedAt: now,
      status: "inactive",
      isActive: false,
      updatedAt: now,
    });

    // 2. Clean up all item relationships transactionally
    const junctions = await ctx.db
      .query("itemChefPrepPreferences")
      .withIndex("by_preference", (q) => q.eq("preferenceId", args.id))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    for (const j of junctions) {
      await ctx.db.patch(j._id, {
        deletedAt: now,
      });
    }

    return {
      success: true,
      unlinkedCount: junctions.length,
    };
  },
});

/**
 * Updates preference assignments for a menu item.
 */
export const updateItemPreferences = mutation({
  args: {
    organizationId: v.id("organizations"),
    itemId: v.id("items"),
    preferenceIds: v.array(v.id("chefPrepPreferences")),
  },
  handler: async (ctx, args) => {
    await requireAuthorizedPrefAdmin(ctx, args.organizationId);

    const item = await ctx.db.get(args.itemId);
    if (!item || item.deletedAt !== undefined) {
      throw new Error("Item not found.");
    }
    if (item.organizationId !== args.organizationId) {
      throw new Error("Cross-organization item access forbidden.");
    }

    // Validate that all preferenceIds belong to this organization and are active
    for (const pId of args.preferenceIds) {
      const p = await ctx.db.get(pId);
      if (!p || p.deletedAt !== undefined || p.organizationId !== args.organizationId) {
        throw new Error(`Invalid preference "${pId}" for this organization.`);
      }
    }

    const now = Date.now();

    // Fetch existing active junctions for this item
    const existingJunctions = await ctx.db
      .query("itemChefPrepPreferences")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const targetPrefSet = new Set(args.preferenceIds);
    const existingPrefSet = new Set(existingJunctions.map((j) => j.preferenceId));

    // Remove unselected junctions
    for (const j of existingJunctions) {
      if (!targetPrefSet.has(j.preferenceId)) {
        await ctx.db.patch(j._id, {
          deletedAt: now,
        });
      }
    }

    // Insert newly selected junctions
    for (const pId of args.preferenceIds) {
      if (!existingPrefSet.has(pId)) {
        await ctx.db.insert("itemChefPrepPreferences", {
          organizationId: args.organizationId,
          itemId: args.itemId,
          preferenceId: pId,
          createdAt: now,
        });
      }
    }

    return {
      success: true,
      linkedCount: args.preferenceIds.length,
    };
  },
});

/**
 * Seeds standard default Chef Prep Preferences and links them to existing menu items.
 */
export const seedDefaultPreferences = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await requireAuthorizedPrefAdmin(ctx, args.organizationId);

    const standardPrefs = [
      "No Onion",
      "No Garlic",
      "Less Spicy",
      "Extra Spicy",
      "No Mayo",
      "Well Done",
      "1 by 2",
    ];

    const now = Date.now();
    const createdPrefIds: Id<"chefPrepPreferences">[] = [];

    for (const name of standardPrefs) {
      const existing = await ctx.db
        .query("chefPrepPreferences")
        .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
        .filter((q) =>
          q.and(
            q.eq(q.field("deletedAt"), undefined),
            q.eq(q.field("name"), name)
          )
        )
        .first();

      if (!existing) {
        const id = await ctx.db.insert("chefPrepPreferences", {
          organizationId: args.organizationId,
          name,
          status: "active",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        createdPrefIds.push(id);
      } else {
        createdPrefIds.push(existing._id);
      }
    }

    // Link preferences to all active items in the organization
    let activeItems = await ctx.db
      .query("items")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Fallback: If no items found with explicit organizationId, look up via category items or all items
    if (activeItems.length === 0) {
      const allItems = await ctx.db
        .query("items")
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();
      activeItems = allItems;
    }

    let linksCreated = 0;
    for (const item of activeItems) {
      // Link all standard preferences to each menu item
      for (const prefId of createdPrefIds) {
        const existingLink = await ctx.db
          .query("itemChefPrepPreferences")
          .withIndex("by_item_preference", (q) =>
            q.eq("itemId", item._id).eq("preferenceId", prefId)
          )
          .filter((q) => q.eq(q.field("deletedAt"), undefined))
          .first();

        if (!existingLink) {
          await ctx.db.insert("itemChefPrepPreferences", {
            organizationId: args.organizationId,
            itemId: item._id,
            preferenceId: prefId,
            createdAt: now,
          });
          linksCreated++;
        }
      }
    }

    return {
      success: true,
      preferencesCount: createdPrefIds.length,
      itemsCount: activeItems.length,
      linksCreated,
    };
  },
});
