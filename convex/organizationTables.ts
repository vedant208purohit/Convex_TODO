import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  requireAuth,
  resolveStoreOrganization,
  getCallerMembership,
  requireMember,
} from "./organizationUsers";

// ----------------------------------------------------
// AUTHORIZATION HELPERS
// ----------------------------------------------------

/**
 * Requires caller to be an active Store Admin or Cashier in the store database.
 */
export async function requireAdminOrCashier(
  ctx: QueryCtx | MutationCtx,
  explicitOrgId?: Id<"organizations">
) {
  const identity = await requireAuth(ctx);
  const org = await resolveStoreOrganization(ctx, explicitOrgId);
  const callerMember = await getCallerMembership(ctx, identity.subject, org._id);

  if (
    !callerMember ||
    (!callerMember.userType.includes("admin") &&
      !callerMember.userType.includes("cashier"))
  ) {
    throw new Error("Forbidden. Admin or Cashier access required.");
  }

  return { identity, org, callerMember };
}

// ----------------------------------------------------
// VALIDATION & MATH HELPERS
// ----------------------------------------------------

/**
 * Normalizes table number by trimming surrounding whitespace.
 */
export function normalizeTableNumber(tableNumber: string): string {
  if (!tableNumber || !tableNumber.trim()) {
    throw new Error("Table number can't be blank");
  }
  return tableNumber.trim();
}

/**
 * Validates that seating capacity is a positive integer > 0.
 */
export function validateSeatingCapacity(seatingCapacity: number): void {
  if (
    typeof seatingCapacity !== "number" ||
    !Number.isInteger(seatingCapacity) ||
    seatingCapacity <= 0
  ) {
    throw new Error("Seating capacity must be a positive integer");
  }
}

/**
 * Validates table number case-insensitive uniqueness scoped to (active, layoutId).
 */
export async function validateUniqueTableNumber(
  ctx: QueryCtx | MutationCtx,
  tableNumber: string,
  layoutId?: Id<"organizationLayouts">,
  excludeId?: Id<"organizationTables">
): Promise<void> {
  const normalized = tableNumber.trim().toLowerCase();
  const allTables = await ctx.db.query("organizationTables").collect();

  const duplicate = allTables.find(
    (table) =>
      table.deletedAt === undefined &&
      (!excludeId || table._id !== excludeId) &&
      table.layoutId === layoutId &&
      table.tableNumber.trim().toLowerCase() === normalized
  );

  if (duplicate) {
    throw new Error(`Hey! ${tableNumber.trim()} is already taken.`);
  }
}

/**
 * Calculates automatic grid coordinates (xPosition, yPosition) on a 1600x1600 canvas
 * matching the audited legacy grid math algorithm.
 */
export async function calculateAutoCoordinates(
  ctx: QueryCtx | MutationCtx,
  layoutId?: Id<"organizationLayouts">
): Promise<{ xPosition: string; yPosition: string }> {
  const canvasWidth = 1600;
  const canvasHeight = 1600;
  const blockSize = 100;
  const padding = 60;
  const effectiveBlockSize = blockSize + padding; // 160

  const rows = Math.floor(canvasHeight / effectiveBlockSize); // 10
  const columns = Math.floor(canvasWidth / effectiveBlockSize); // 10

  const allTables = await ctx.db.query("organizationTables").collect();
  const existingActiveInScope = allTables.filter(
    (table) =>
      table.deletedAt === undefined &&
      table.layoutId === layoutId &&
      table.xPosition !== undefined &&
      table.yPosition !== undefined
  );

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const newX = c * effectiveBlockSize + padding;
      const newY = r * effectiveBlockSize + padding;

      if (newX + blockSize > canvasWidth || newY + blockSize > canvasHeight) {
        throw new Error(`Coordinates (${newX}, ${newY}) are out of canvas bounds`);
      }

      const overlap = existingActiveInScope.some((table) => {
        const tableX = parseInt(table.xPosition!, 10);
        const tableY = parseInt(table.yPosition!, 10);
        if (isNaN(tableX) || isNaN(tableY)) return false;

        const effectiveSize = blockSize + 10; // 110
        return (
          newX < tableX + effectiveSize &&
          newX + effectiveSize > tableX &&
          newY < tableY + effectiveSize &&
          newY + effectiveSize > tableY
        );
      });

      if (!overlap) {
        return {
          xPosition: newX.toString(),
          yPosition: newY.toString(),
        };
      }
    }
  }

  throw new Error("No space available for a new table");
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Lists active organization tables with optional layoutId and tableNumber filtering.
 */
export const list = query({
  args: {
    layoutId: v.optional(v.id("organizationLayouts")),
    tableNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx);
    const all = await ctx.db.query("organizationTables").collect();

    let active = all.filter((table) => table.deletedAt === undefined);

    if (args.layoutId !== undefined) {
      active = active.filter((table) => table.layoutId === args.layoutId);
    }

    if (args.tableNumber !== undefined && args.tableNumber.trim() !== "") {
      const queryNumber = args.tableNumber.trim().toLowerCase();
      active = active.filter(
        (table) => table.tableNumber.trim().toLowerCase() === queryNumber
      );
    }

    // Sort by tableNumber naturally
    active.sort((a, b) =>
      a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true })
    );

    return active;
  },
});

/**
 * Fetches a single organization table by ID
 */
export const get = query({
  args: { id: v.id("organizationTables") },
  handler: async (ctx, args) => {
    await requireMember(ctx);
    const tableDoc = await ctx.db.get(args.id);
    if (!tableDoc || tableDoc.deletedAt !== undefined) {
      return null;
    }
    return tableDoc;
  },
});

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * Creates a new organization table
 */
export const create = mutation({
  args: {
    tableNumber: v.string(),
    seatingCapacity: v.number(),
    placement: v.optional(v.string()),
    xPosition: v.optional(v.string()),
    yPosition: v.optional(v.string()),
    kidsSeatAvailability: v.optional(v.boolean()),
    disabledSeatAvailability: v.optional(v.boolean()),
    barbequeGrillAvailability: v.optional(v.boolean()),
    isBlock: v.optional(v.boolean()),
    isRequested: v.optional(v.boolean()),
    currentOrderId: v.optional(v.string()),
    layoutId: v.optional(v.id("organizationLayouts")),
    legacyId: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const trimmedTableNumber = normalizeTableNumber(args.tableNumber);
    validateSeatingCapacity(args.seatingCapacity);

    if (args.layoutId) {
      const layout = await ctx.db.get(args.layoutId);
      if (!layout || layout.deletedAt !== undefined) {
        throw new Error("Organization layout not found");
      }
    }

    await validateUniqueTableNumber(ctx, trimmedTableNumber, args.layoutId);

    // Coordinate resolution: preserve explicit coordinates if supplied, else auto-calculate
    let finalX = args.xPosition;
    let finalY = args.yPosition;

    if (!finalX || !finalY) {
      const autoCoords = await calculateAutoCoordinates(ctx, args.layoutId);
      finalX = finalX ?? autoCoords.xPosition;
      finalY = finalY ?? autoCoords.yPosition;
    }

    const now = Date.now();

    const tableId = await ctx.db.insert("organizationTables", {
      legacyId: args.legacyId,
      tableNumber: trimmedTableNumber,
      seatingCapacity: args.seatingCapacity,
      placement: args.placement ? args.placement.trim() : undefined,
      xPosition: finalX,
      yPosition: finalY,
      kidsSeatAvailability: args.kidsSeatAvailability ?? false,
      disabledSeatAvailability: args.disabledSeatAvailability ?? false,
      barbequeGrillAvailability: args.barbequeGrillAvailability ?? false,
      isBlock: args.isBlock ?? false,
      isRequested: args.isRequested ?? false,
      currentOrderId: args.currentOrderId ? args.currentOrderId.trim() : undefined,
      layoutId: args.layoutId,
      createdAt: args.createdAt ?? now,
      updatedAt: args.updatedAt ?? now,
    });

    return tableId;
  },
});

/**
 * Updates an existing organization table
 */
export const update = mutation({
  args: {
    id: v.id("organizationTables"),
    tableNumber: v.optional(v.string()),
    seatingCapacity: v.optional(v.number()),
    placement: v.optional(v.string()),
    xPosition: v.optional(v.string()),
    yPosition: v.optional(v.string()),
    kidsSeatAvailability: v.optional(v.boolean()),
    disabledSeatAvailability: v.optional(v.boolean()),
    barbequeGrillAvailability: v.optional(v.boolean()),
    isBlock: v.optional(v.boolean()),
    isRequested: v.optional(v.boolean()),
    currentOrderId: v.optional(v.string()),
    layoutId: v.optional(v.id("organizationLayouts")),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Organization table not found");
    }

    let effectiveTableNumber = existing.tableNumber;
    if (args.tableNumber !== undefined) {
      effectiveTableNumber = normalizeTableNumber(args.tableNumber);
    }

    if (args.seatingCapacity !== undefined) {
      validateSeatingCapacity(args.seatingCapacity);
    }

    const effectiveLayoutId =
      args.layoutId !== undefined ? args.layoutId : existing.layoutId;

    if (effectiveLayoutId) {
      const layout = await ctx.db.get(effectiveLayoutId);
      if (!layout || layout.deletedAt !== undefined) {
        throw new Error("Organization layout not found");
      }
    }

    if (
      args.tableNumber !== undefined ||
      args.layoutId !== undefined
    ) {
      await validateUniqueTableNumber(
        ctx,
        effectiveTableNumber,
        effectiveLayoutId,
        args.id
      );
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      tableNumber: effectiveTableNumber,
      seatingCapacity: args.seatingCapacity ?? existing.seatingCapacity,
      placement: args.placement !== undefined ? args.placement.trim() : existing.placement,
      xPosition: args.xPosition !== undefined ? args.xPosition : existing.xPosition,
      yPosition: args.yPosition !== undefined ? args.yPosition : existing.yPosition,
      kidsSeatAvailability:
        args.kidsSeatAvailability !== undefined
          ? args.kidsSeatAvailability
          : existing.kidsSeatAvailability,
      disabledSeatAvailability:
        args.disabledSeatAvailability !== undefined
          ? args.disabledSeatAvailability
          : existing.disabledSeatAvailability,
      barbequeGrillAvailability:
        args.barbequeGrillAvailability !== undefined
          ? args.barbequeGrillAvailability
          : existing.barbequeGrillAvailability,
      isBlock: args.isBlock !== undefined ? args.isBlock : existing.isBlock,
      isRequested:
        args.isRequested !== undefined ? args.isRequested : existing.isRequested,
      currentOrderId:
        args.currentOrderId !== undefined
          ? args.currentOrderId.trim() || undefined
          : existing.currentOrderId,
      layoutId: effectiveLayoutId,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Clears current order from table and resets request/block flags atomically
 */
export const clearOrder = mutation({
  args: { id: v.id("organizationTables") },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Organization table not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      currentOrderId: undefined,
      isRequested: false,
      isBlock: false,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Soft deletes an organization table
 */
export const remove = mutation({
  args: { id: v.id("organizationTables") },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Organization table not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      deletedAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});
