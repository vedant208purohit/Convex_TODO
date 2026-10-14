import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  requireAuth,
  resolveStoreOrganization,
  requireMember,
  requireAdmin,
} from "./organizationUsers";

// ==========================================
// AUTHORIZATION HELPERS
// ==========================================

/**
 * Requires caller to be an active Store Admin, Cashier, or Chef in the target organization.
 * Store owner or super admin also permitted.
 */
export async function requireStationAdmin(
  ctx: QueryCtx | MutationCtx,
  explicitOrgId?: Id<"organizations">
) {
  const { identity, org, callerMember } = await requireMember(ctx, explicitOrgId);

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
    ["admin", "store_admin", "org_admin", "super_admin", "cashier", "chef"].includes(
      (role || "").trim().toLowerCase()
    )
  );

  if (!hasAuthorizedRole) {
    throw new Error("Forbidden. Admin, Cashier, or Chef access required.");
  }

  return { identity, org, callerMember };
}

/**
 * Requires caller to be an active Store Staff member (Admin, Cashier, Captain, Waiter, Chef, KDS, Worker).
 */
export async function requireStaffMember(
  ctx: QueryCtx | MutationCtx,
  explicitOrgId?: Id<"organizations">
) {
  const { identity, org, callerMember } = await requireMember(ctx, explicitOrgId);

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
      "waiter",
      "chef",
      "worker",
      "kds",
      "orders",
      "dashboard",
    ].includes((role || "").trim().toLowerCase())
  );

  if (!hasAuthorizedRole) {
    throw new Error("Forbidden. Staff access required.");
  }

  return { identity, org, callerMember };
}

// ==========================================
// SHARED SERVER-SIDE ITEM ROUTING HELPER
// ==========================================

/**
 * Resolves the target kitchen station for an order item based on active station-item mappings.
 * Returns the station Id or undefined if not mapped.
 */
export async function resolveOrderItemStation(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  itemId: Id<"items">
): Promise<Id<"stations"> | undefined> {
  const mappings = await ctx.db
    .query("stationItems")
    .withIndex("by_org_item", (q) =>
      q.eq("organizationId", organizationId).eq("itemId", itemId)
    )
    .collect();

  const activeMappings = mappings.filter((m) => m.deletedAt === undefined);
  if (activeMappings.length === 0) {
    return undefined;
  }

  for (const mapping of activeMappings) {
    const station = await ctx.db.get(mapping.stationId);
    if (station && station.deletedAt === undefined) {
      return station._id;
    }
  }

  return undefined;
}

// ==========================================
// 1. STATIONS CRUD
// ==========================================

/**
 * Creates a new kitchen workstation for the store.
 */
export const create = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    name: v.string(),
    isMain: v.optional(v.boolean()),
    legacyId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org } = await requireStationAdmin(ctx, args.organizationId);

    const trimmedName = args.name.trim();
    if (!trimmedName) {
      throw new Error("Station name is required");
    }

    // Check duplicate active name in the same store (legacy behavior)
    const existingStations = await ctx.db
      .query("stations")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .collect();

    const isDuplicate = existingStations.some(
      (st) =>
        st.deletedAt === undefined &&
        st.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      throw new Error(`Hey! ${trimmedName} is already taken.`);
    }

    const now = Date.now();
    const stationId = await ctx.db.insert("stations", {
      organizationId: org._id,
      name: trimmedName,
      isMain: args.isMain ?? false,
      legacyId: args.legacyId,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, id: stationId };
  },
});

/**
 * Updates an existing kitchen workstation.
 */
export const update = mutation({
  args: {
    id: v.id("stations"),
    name: v.optional(v.string()),
    isMain: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const station = await ctx.db.get(args.id);
    if (!station || station.deletedAt !== undefined) {
      throw new Error("Station not found");
    }

    const { org } = await requireStationAdmin(ctx, station.organizationId);

    const patchPayload: Record<string, any> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      const trimmedName = args.name.trim();
      if (!trimmedName) {
        throw new Error("Station name cannot be empty");
      }

      if (trimmedName.toLowerCase() !== station.name.trim().toLowerCase()) {
        const existingStations = await ctx.db
          .query("stations")
          .withIndex("by_org", (q) => q.eq("organizationId", org._id))
          .collect();

        const isDuplicate = existingStations.some(
          (st) =>
            st._id !== station._id &&
            st.deletedAt === undefined &&
            st.name.trim().toLowerCase() === trimmedName.toLowerCase()
        );

        if (isDuplicate) {
          throw new Error(`Hey! ${trimmedName} is already taken.`);
        }
      }

      patchPayload.name = trimmedName;
    }

    if (args.isMain !== undefined) {
      patchPayload.isMain = args.isMain;
    }

    await ctx.db.patch(station._id, patchPayload);
    return { success: true };
  },
});

/**
 * Soft deletes a kitchen workstation and all its active station-item mappings.
 */
export const remove = mutation({
  args: {
    id: v.id("stations"),
  },
  handler: async (ctx, args) => {
    const station = await ctx.db.get(args.id);
    if (!station || station.deletedAt !== undefined) {
      throw new Error("Station not found");
    }

    await requireStationAdmin(ctx, station.organizationId);

    const now = Date.now();

    // 1. Soft-delete station
    await ctx.db.patch(station._id, {
      deletedAt: now,
      updatedAt: now,
    });

    // 2. Soft-delete all associated station items
    const stationItems = await ctx.db
      .query("stationItems")
      .withIndex("by_org_station", (q) =>
        q.eq("organizationId", station.organizationId).eq("stationId", station._id)
      )
      .collect();

    for (const item of stationItems) {
      if (item.deletedAt === undefined) {
        await ctx.db.patch(item._id, {
          deletedAt: now,
          updatedAt: now,
        });
      }
    }

    return { success: true };
  },
});

/**
 * Gets a single kitchen workstation by ID.
 */
export const get = query({
  args: {
    id: v.id("stations"),
  },
  handler: async (ctx, args) => {
    const station = await ctx.db.get(args.id);
    if (!station || station.deletedAt !== undefined) {
      return null;
    }

    await requireStaffMember(ctx, station.organizationId);
    return station;
  },
});

/**
 * Lists all active kitchen workstations for the current organization.
 */
export const list = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    includeSummary: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { org } = await requireStaffMember(ctx, args.organizationId);

    const stations = await ctx.db
      .query("stations")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .collect();

    const activeStations = stations
      .filter((st) => st.deletedAt === undefined)
      .sort((a, b) => {
        if (a.isMain && !b.isMain) return -1;
        if (!a.isMain && b.isMain) return 1;
        return a.name.localeCompare(b.name);
      });

    if (!args.includeSummary) {
      return activeStations;
    }

    // 1. Fetch total items for store once (for isMain consolidated routing)
    const storeItems = await ctx.db
      .query("items")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .collect();
    const activeStoreItems = storeItems.filter((i) => i.deletedAt === undefined);
    const storeItemMap = new Map(activeStoreItems.map((i) => [i._id, i]));

    // 2. Fetch categories for store once
    const storeCategories = await ctx.db
      .query("categories")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .collect();
    const activeCategoryMap = new Map(
      storeCategories.filter((c) => c.deletedAt === undefined).map((c) => [c._id, c.name])
    );

    // Map item -> category name
    const itemCategoryNameMap = new Map<string, string>();
    for (const [catId, catName] of activeCategoryMap.entries()) {
      const catItems = await ctx.db
        .query("categoryItems")
        .withIndex("by_category", (q) => q.eq("categoryId", catId as Id<"categories">))
        .collect();
      for (const ci of catItems) {
        if (ci.deletedAt === undefined) {
          itemCategoryNameMap.set(ci.itemId, catName);
        }
      }
    }

    // 3. Fetch printers for store
    const printers = await ctx.db
      .query("organizationPrinters")
      .collect();
    const activePrinters = printers.filter((p) => p.deletedAt === undefined);

    // 4. Fetch uncompleted orders for store
    const storeOrders = await ctx.db
      .query("orders")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .collect();
    const activeOrders = storeOrders.filter((o) => !o.isCompleted && !o.isRejected);
    const activeOrderIdSet = new Set(activeOrders.map((o) => o._id));

    return await Promise.all(
      activeStations.map(async (st) => {
        // Fetch station items
        const stationMappings = await ctx.db
          .query("stationItems")
          .withIndex("by_org_station", (q) =>
            q.eq("organizationId", org._id).eq("stationId", st._id)
          )
          .collect();

        const activeMappings = stationMappings.filter((m) => m.deletedAt === undefined);
        const assignedItemCount = st.isMain ? activeStoreItems.length : activeMappings.length;

        const sampleItems: string[] = [];
        const categoryNamesSet = new Set<string>();

        for (const mapping of activeMappings) {
          const item = storeItemMap.get(mapping.itemId);
          if (item) {
            if (sampleItems.length < 4) {
              sampleItems.push(item.name);
            }
            const catName = itemCategoryNameMap.get(mapping.itemId);
            if (catName) {
              categoryNamesSet.add(catName);
            }
          }
        }

        const categoryNames = Array.from(categoryNamesSet);

        // Active orders count
        let stationActiveOrdersCount = 0;
        if (st.isMain) {
          stationActiveOrdersCount = activeOrders.length;
        } else {
          const stationOrderItems = await ctx.db
            .query("orderItems")
            .withIndex("by_org_station", (q) =>
              q.eq("organizationId", org._id).eq("stationId", st._id)
            )
            .collect();

          const orderIdSetForStation = new Set<string>();
          for (const oi of stationOrderItems) {
            if (activeOrderIdSet.has(oi.orderId)) {
              orderIdSetForStation.add(oi.orderId);
            }
          }
          stationActiveOrdersCount = orderIdSetForStation.size;
        }

        // Printer association
        const linkedPrinter = activePrinters.find(
          (p) =>
            p.stationId === st._id ||
            (st.legacyId && p.stationId === st.legacyId) ||
            (st.isMain && p.printerUseFor === "Cashier")
        );

        return {
          ...st,
          assignedItemCount,
          categoryCount: categoryNames.length,
          sampleCategories: categoryNames.slice(0, 3),
          sampleItems,
          activeOrdersCount: stationActiveOrdersCount,
          hasPrinter: Boolean(linkedPrinter),
          printerDetails: linkedPrinter
            ? {
                url: linkedPrinter.printerUrl,
                type: linkedPrinter.printerType,
                port: linkedPrinter.printerPort,
              }
            : null,
        };
      })
    );
  },
});

// ==========================================
// 2. STATION-ITEM MAPPINGS
// ==========================================

/**
 * Assigns a menu item to a kitchen preparation workstation.
 */
export const assignItemToStation = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    stationId: v.id("stations"),
    itemId: v.id("items"),
    legacyId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const station = await ctx.db.get(args.stationId);
    if (!station || station.deletedAt !== undefined) {
      throw new Error("Station not found");
    }

    const { org } = await requireStationAdmin(ctx, station.organizationId);

    const item = await ctx.db.get(args.itemId);
    if (!item || item.deletedAt !== undefined || item.organizationId !== org._id) {
      throw new Error("Item not found");
    }

    // Check existing mapping
    const existingMappings = await ctx.db
      .query("stationItems")
      .withIndex("by_station_item", (q) =>
        q.eq("stationId", station._id).eq("itemId", item._id)
      )
      .collect();

    const active = existingMappings.find((m) => m.deletedAt === undefined);
    if (active) {
      throw new Error(`Hey! '${item.name}' is already assigned to '${station.name}'.`);
    }

    const now = Date.now();

    // Check if soft-deleted record exists to reactivate
    const softDeleted = existingMappings.find((m) => m.deletedAt !== undefined);
    if (softDeleted) {
      await ctx.db.patch(softDeleted._id, {
        deletedAt: undefined,
        updatedAt: now,
      });
      return { success: true, id: softDeleted._id, reactivated: true };
    }

    const newId = await ctx.db.insert("stationItems", {
      organizationId: org._id,
      stationId: station._id,
      itemId: item._id,
      legacyId: args.legacyId,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, id: newId, reactivated: false };
  },
});

/**
 * Removes a menu item from a kitchen preparation workstation.
 */
export const removeItemFromStation = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    stationId: v.id("stations"),
    itemId: v.id("items"),
  },
  handler: async (ctx, args) => {
    const station = await ctx.db.get(args.stationId);
    if (!station || station.deletedAt !== undefined) {
      throw new Error("Station not found");
    }

    await requireStationAdmin(ctx, station.organizationId);

    const mappings = await ctx.db
      .query("stationItems")
      .withIndex("by_station_item", (q) =>
        q.eq("stationId", station._id).eq("itemId", args.itemId)
      )
      .collect();

    const active = mappings.filter((m) => m.deletedAt === undefined);
    if (active.length === 0) {
      throw new Error("Item is not assigned to this station");
    }

    const now = Date.now();
    for (const m of active) {
      await ctx.db.patch(m._id, {
        deletedAt: now,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Bulk assigns all items belonging to a category to a workstation.
 * (Legacy parity: Category -> Category Items -> Station)
 */
export const assignCategoryItemsToStation = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    stationId: v.id("stations"),
    categoryId: v.id("categories"),
  },
  handler: async (ctx, args) => {
    const station = await ctx.db.get(args.stationId);
    if (!station || station.deletedAt !== undefined) {
      throw new Error("Station not found");
    }

    const { org } = await requireStationAdmin(ctx, station.organizationId);

    const category = await ctx.db.get(args.categoryId);
    if (!category || category.deletedAt !== undefined || category.organizationId !== org._id) {
      throw new Error("Category not found");
    }

    // Fetch active items in category
    const categoryItems = await ctx.db
      .query("categoryItems")
      .withIndex("by_category", (q) => q.eq("categoryId", category._id))
      .collect();

    const activeCatItems = categoryItems.filter(
      (ci) => ci.deletedAt === undefined && ci.published !== false
    );

    const itemIdsToAssign = activeCatItems.map((ci) => ci.itemId);
    const assignedItemIds: Id<"items">[] = [];
    const now = Date.now();

    for (const itemId of itemIdsToAssign) {
      const item = await ctx.db.get(itemId);
      if (!item || item.deletedAt !== undefined) continue;

      const existingMappings = await ctx.db
        .query("stationItems")
        .withIndex("by_station_item", (q) =>
          q.eq("stationId", station._id).eq("itemId", item._id)
        )
        .collect();

      const active = existingMappings.find((m) => m.deletedAt === undefined);
      if (active) {
        // Already assigned, skip duplicate
        continue;
      }

      const softDeleted = existingMappings.find((m) => m.deletedAt !== undefined);
      if (softDeleted) {
        await ctx.db.patch(softDeleted._id, {
          deletedAt: undefined,
          updatedAt: now,
        });
        assignedItemIds.push(item._id);
      } else {
        await ctx.db.insert("stationItems", {
          organizationId: org._id,
          stationId: station._id,
          itemId: item._id,
          createdAt: now,
          updatedAt: now,
        });
        assignedItemIds.push(item._id);
      }
    }

    return {
      success: true,
      count: assignedItemIds.length,
      assignedItemIds,
    };
  },
});

/**
 * Lists all menu items assigned to a workstation.
 */
export const listStationItems = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    stationId: v.id("stations"),
  },
  handler: async (ctx, args) => {
    const station = await ctx.db.get(args.stationId);
    if (!station || station.deletedAt !== undefined) {
      throw new Error("Station not found");
    }

    const { org } = await requireStaffMember(ctx, station.organizationId);

    const stationItems = await ctx.db
      .query("stationItems")
      .withIndex("by_org_station", (q) =>
        q.eq("organizationId", org._id).eq("stationId", station._id)
      )
      .collect();

    const activeMappings = stationItems.filter((m) => m.deletedAt === undefined);

    const results = [];
    for (const mapping of activeMappings) {
      const item = await ctx.db.get(mapping.itemId);
      if (item && item.deletedAt === undefined) {
        results.push({
          mappingId: mapping._id,
          stationId: station._id,
          item: {
            _id: item._id,
            name: item.name,
            price: item.price,
            isAvailable: item.isAvailable,
            published: item.published,
            isVeg: item.isVeg,
            isSpicy: item.isSpicy,
          },
          createdAt: mapping.createdAt,
        });
      }
    }

    return results;
  },
});

/**
 * Lists all stations assigned to a menu item.
 */
export const listItemStations = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    itemId: v.id("items"),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item || item.deletedAt !== undefined) {
      throw new Error("Item not found");
    }

    const { org } = await requireStaffMember(ctx, item.organizationId);

    const mappings = await ctx.db
      .query("stationItems")
      .withIndex("by_org_item", (q) =>
        q.eq("organizationId", org._id).eq("itemId", item._id)
      )
      .collect();

    const activeMappings = mappings.filter((m) => m.deletedAt === undefined);

    const results = [];
    for (const mapping of activeMappings) {
      const station = await ctx.db.get(mapping.stationId);
      if (station && station.deletedAt === undefined) {
        results.push({
          mappingId: mapping._id,
          station: {
            _id: station._id,
            name: station.name,
            isMain: station.isMain,
          },
          createdAt: mapping.createdAt,
        });
      }
    }

    return results;
  },
});

/**
 * Retrieves menus, categories with eligible items, and current item assignments for a workstation.
 * Powers Screen 3: Add Items to Station Drawer.
 */
export const getStationAssignmentData = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    stationId: v.id("stations"),
    menuId: v.optional(v.id("menus")),
  },
  handler: async (ctx, args) => {
    const station = await ctx.db.get(args.stationId);
    if (!station || station.deletedAt !== undefined) {
      throw new Error("Station not found");
    }

    const { org } = await requireStaffMember(ctx, station.organizationId);

    // 1. Fetch all active menus for this store
    const menus = await ctx.db
      .query("menus")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const activeMenus = menus
      .filter((m) => m.isActive !== false)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    // Resolve target menu
    let resolvedMenuId = args.menuId;
    if (!resolvedMenuId && activeMenus.length > 0) {
      const defaultMenu = activeMenus.find((m) => m.isDefault) || activeMenus[0];
      resolvedMenuId = defaultMenu._id;
    }

    // 2. Fetch categories for resolved menu (or all store categories if no menu exists)
    let categories: any[] = [];
    if (resolvedMenuId) {
      categories = await ctx.db
        .query("categories")
        .withIndex("by_menu", (q) => q.eq("menuId", resolvedMenuId!))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();
    } else {
      categories = await ctx.db
        .query("categories")
        .withIndex("by_org", (q) => q.eq("organizationId", org._id))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();
    }

    const activeCategories = categories
      .filter((c) => c.published !== false)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    // 3. For each category, fetch category items and resolve items
    const categoriesWithItems = [];
    const storeItemMap = new Map<string, any>();

    for (const cat of activeCategories) {
      const catItems = await ctx.db
        .query("categoryItems")
        .withIndex("by_category", (q) => q.eq("categoryId", cat._id))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      const activeCatItems = catItems
        .filter((ci) => ci.published !== false)
        .sort((a, b) => a.position - b.position);

      const itemsInCat = [];
      for (const ci of activeCatItems) {
        let item = storeItemMap.get(ci.itemId);
        if (!item) {
          item = await ctx.db.get(ci.itemId);
          if (item) storeItemMap.set(ci.itemId, item);
        }

        if (item && item.deletedAt === undefined && item.published !== false) {
          itemsInCat.push({
            _id: item._id,
            name: item.name,
            description: item.description,
            price: item.price,
            isVeg: item.isVeg,
            isSpicy: item.isSpicy,
            isAvailable: item.isAvailable,
            skuNumber: item.skuNumber,
          });
        }
      }

      categoriesWithItems.push({
        _id: cat._id,
        name: cat.name,
        position: cat.position,
        items: itemsInCat,
      });
    }

    // 4. Fetch currently assigned items for this station
    const stationMappings = await ctx.db
      .query("stationItems")
      .withIndex("by_org_station", (q) =>
        q.eq("organizationId", org._id).eq("stationId", station._id)
      )
      .collect();

    const activeMappings = stationMappings.filter((m) => m.deletedAt === undefined);
    const assignedItemIds = activeMappings.map((m) => m.itemId);

    // 5. Total unique eligible items across current menu/categories
    const allItemIdsInMenu = new Set<string>();
    for (const cat of categoriesWithItems) {
      for (const item of cat.items) {
        allItemIdsInMenu.add(item._id);
      }
    }

    return {
      station: {
        _id: station._id,
        name: station.name,
        isMain: station.isMain,
      },
      menus: activeMenus.map((m) => ({
        _id: m._id,
        name: m.name,
        isDefault: m.isDefault,
        isActive: m.isActive,
      })),
      selectedMenuId: resolvedMenuId,
      categories: categoriesWithItems,
      assignedItemIds,
      totalEligibleItemsCount: allItemIdsInMenu.size,
      currencySymbol: org.defaultCurrencySymbol || "₹",
    };
  },
});

/**
 * Atomically updates the complete set of assigned menu items for a station.
 * Performs safe differential updates: soft-deletes removed items, reactivates/inserts added items.
 */
export const updateStationItemAssignments = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    stationId: v.id("stations"),
    assignedItemIds: v.array(v.id("items")),
  },
  handler: async (ctx, args) => {
    const station = await ctx.db.get(args.stationId);
    if (!station || station.deletedAt !== undefined) {
      throw new Error("Station not found");
    }

    const { org } = await requireStationAdmin(ctx, station.organizationId);

    // Validate that all assignedItemIds belong to this organization and are not deleted
    for (const itemId of args.assignedItemIds) {
      const item = await ctx.db.get(itemId);
      if (!item || item.deletedAt !== undefined || item.organizationId !== org._id) {
        throw new Error(`Item not found or belongs to another organization: ${itemId}`);
      }
    }

    // Existing mappings for this station
    const existingMappings = await ctx.db
      .query("stationItems")
      .withIndex("by_org_station", (q) =>
        q.eq("organizationId", org._id).eq("stationId", station._id)
      )
      .collect();

    const targetSet = new Set<string>(args.assignedItemIds);
    const now = Date.now();
    let addedCount = 0;
    let removedCount = 0;

    // 1. Soft-delete mappings that are not in targetSet
    for (const mapping of existingMappings) {
      if (mapping.deletedAt === undefined && !targetSet.has(mapping.itemId)) {
        await ctx.db.patch(mapping._id, {
          deletedAt: now,
          updatedAt: now,
        });
        removedCount++;
      }
    }

    // 2. Add or reactivate mappings for items in targetSet
    for (const itemId of args.assignedItemIds) {
      const existing = existingMappings.find((m) => m.itemId === itemId);
      if (!existing) {
        await ctx.db.insert("stationItems", {
          organizationId: org._id,
          stationId: station._id,
          itemId,
          createdAt: now,
          updatedAt: now,
        });
        addedCount++;
      } else if (existing.deletedAt !== undefined) {
        await ctx.db.patch(existing._id, {
          deletedAt: undefined,
          updatedAt: now,
        });
        addedCount++;
      }
    }

    return {
      success: true,
      addedCount,
      removedCount,
      totalAssigned: args.assignedItemIds.length,
    };
  },
});

// ==========================================
// 3. KDS STATION ORDERS & TICKET STREAM QUERY
// ==========================================

/**
 * Retrieves orders and order items routed to a specific kitchen workstation.
 * Supports reactive KDS screen rendering and active order counting.
 */
export const getStationOrders = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    stationId: v.id("stations"),
  },
  handler: async (ctx, args) => {
    const station = await ctx.db.get(args.stationId);
    if (!station || station.deletedAt !== undefined) {
      throw new Error("Station not found");
    }

    const { org } = await requireStaffMember(ctx, station.organizationId);

    // Fetch order items assigned to this station for this organization
    const stationOrderItems = await ctx.db
      .query("orderItems")
      .withIndex("by_org_station", (q) =>
        q.eq("organizationId", org._id).eq("stationId", station._id)
      )
      .collect();

    if (stationOrderItems.length === 0) {
      return {
        station: {
          _id: station._id,
          name: station.name,
          isMain: station.isMain,
        },
        orders: [],
        activeOrdersCount: 0,
      };
    }

    // Group order items by parent orderId
    const itemsByOrderId = new Map<string, typeof stationOrderItems>();
    for (const oi of stationOrderItems) {
      const existing = itemsByOrderId.get(oi.orderId) ?? [];
      existing.push(oi);
      itemsByOrderId.set(oi.orderId, existing);
    }

    const stationOrders = [];
    let activeOrdersCount = 0;

    for (const [orderIdStr, itemsForStation] of itemsByOrderId.entries()) {
      const order = await ctx.db.get(orderIdStr as Id<"orders">);
      if (!order) continue;

      if (!order.isCompleted) {
        activeOrdersCount++;
      }

      let tableNumber = undefined;
      if (order.tableId) {
        const table = await ctx.db.get(order.tableId);
        tableNumber = table?.tableNumber;
      }

      let processStatus = undefined;
      if (order.orderStatusId) {
        const proc = await ctx.db.get(order.orderStatusId);
        if (proc) {
          processStatus = {
            _id: proc._id,
            name: proc.name,
            position: proc.position,
            isSequence: proc.isSequence,
            processColor: proc.processColor,
          };
        }
      }

      // Fetch order activities with duration metrics
      const activities = await ctx.db
        .query("orderActivities")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      const sortedActivities = activities
        .filter((a) => a.deletedAt === undefined)
        .sort((a, b) => a.position - b.position || a.createdAt - b.createdAt);

      const latestActivity = sortedActivities[sortedActivities.length - 1];
      const currentDuration = latestActivity?.totalDuration ?? 0;

      stationOrders.push({
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          tokenNumber: order.tokenNumber,
          orderType: order.orderType,
          orderStatusName: order.orderStatusName,
          orderStatusId: order.orderStatusId,
          processStatus,
          activities: sortedActivities,
          currentDuration,
          specialNotes: order.specialNotes,
          isCompleted: order.isCompleted,
          isRejected: order.isRejected,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          tableNumber,
          tableId: order.tableId,
          customerId: order.customerId,
          customerName: order.customerName,
        },
        orderItems: itemsForStation,
        allStationItemsReady: itemsForStation.every((i) => i.isReady),
      });
    }

    // Sort tickets by order creation time ascending (first in, first out)
    stationOrders.sort((a, b) => a.order.createdAt - b.order.createdAt);

    return {
      station: {
        _id: station._id,
        name: station.name,
        isMain: station.isMain,
      },
      orders: stationOrders,
      activeOrdersCount,
    };
  },
});
