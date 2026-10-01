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
  },
  handler: async (ctx, args) => {
    const { org } = await requireStaffMember(ctx, args.organizationId);

    const stations = await ctx.db
      .query("stations")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .collect();

    return stations
      .filter((st) => st.deletedAt === undefined)
      .sort((a, b) => {
        if (a.isMain && !b.isMain) return -1;
        if (!a.isMain && b.isMain) return 1;
        return a.name.localeCompare(b.name);
      });
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

      stationOrders.push({
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          tokenNumber: order.tokenNumber,
          orderType: order.orderType,
          orderStatusName: order.orderStatusName,
          orderStatusId: order.orderStatusId,
          processStatus,
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
