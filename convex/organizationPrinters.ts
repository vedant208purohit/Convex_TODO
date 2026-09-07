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
 * Requires caller to be an active Store Admin or Cashier in the target organization
 */
export async function requireAdminOrCashier(
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
    ["admin", "store_admin", "org_admin", "super_admin", "cashier"].includes(
      (role || "").trim().toLowerCase()
    )
  );

  if (!hasAuthorizedRole) {
    throw new Error("Forbidden. Admin or Cashier access required.");
  }

  return { identity, org, callerMember };
}

// ----------------------------------------------------
// VALIDATION HELPERS
// ----------------------------------------------------

/**
 * Checks active uniqueness for printer_use_for role within the store database.
 */
async function validateUniquePrinterUseFor(
  ctx: QueryCtx | MutationCtx,
  printerUseFor: "Cashier" | "Station" | "WorkStation",
  excludeId?: Id<"organizationPrinters">
): Promise<void> {
  const existing = await ctx.db
    .query("organizationPrinters")
    .withIndex("by_use_for", (q) => q.eq("printerUseFor", printerUseFor))
    .filter((q) => q.eq(q.field("deletedAt"), undefined))
    .first();

  if (existing && (!excludeId || existing._id !== excludeId)) {
    throw new Error(`Hey! ${printerUseFor} printer is already taken.`);
  }
}

/**
 * Validates conditional requirement: LAN station printers must have a stationId.
 */
function validateStationRequirement(
  printerType: "Lan" | "Bluetooth" | "Usb",
  printerUseFor: "Cashier" | "Station" | "WorkStation",
  stationId?: string
): void {
  if (printerType === "Lan" && printerUseFor === "Station") {
    if (!stationId || !stationId.trim()) {
      throw new Error("Station reference is required for LAN station printers.");
    }
  }
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Lists all active (non-deleted) organization printers for the store
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);
    const printers = await ctx.db.query("organizationPrinters").collect();
    return printers.filter((printer) => printer.deletedAt === undefined);
  },
});

/**
 * Fetches a single organization printer by ID
 */
export const get = query({
  args: { id: v.id("organizationPrinters") },
  handler: async (ctx, args) => {
    await requireMember(ctx);
    const printer = await ctx.db.get(args.id);
    if (!printer || printer.deletedAt !== undefined) {
      return null;
    }
    return printer;
  },
});

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * Creates a new organization printer configuration
 */
export const create = mutation({
  args: {
    printerUrl: v.string(),
    printerPort: v.optional(v.string()),
    printerType: v.union(
      v.literal("Lan"),
      v.literal("Bluetooth"),
      v.literal("Usb")
    ),
    printerUseFor: v.union(
      v.literal("Cashier"),
      v.literal("Station"),
      v.literal("WorkStation")
    ),
    stationId: v.optional(v.string()),
    legacyId: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    // 1. Validate required printerUrl presence
    if (!args.printerUrl || !args.printerUrl.trim()) {
      throw new Error("Printer URL can't be blank");
    }

    const trimmedUrl = args.printerUrl.trim();
    const trimmedPort = args.printerPort ? args.printerPort.trim() : undefined;
    const trimmedStationId = args.stationId ? args.stationId.trim() : undefined;

    // 2. Validate conditional station requirement (Lan + Station requires stationId)
    validateStationRequirement(args.printerType, args.printerUseFor, trimmedStationId);

    // 3. Validate active uniqueness of printerUseFor
    await validateUniquePrinterUseFor(ctx, args.printerUseFor);

    const now = Date.now();

    // 4. Insert Document
    const printerId = await ctx.db.insert("organizationPrinters", {
      legacyId: args.legacyId,
      printerUrl: trimmedUrl,
      printerPort: trimmedPort,
      printerType: args.printerType,
      printerUseFor: args.printerUseFor,
      stationId: trimmedStationId,
      createdAt: args.createdAt ?? now,
      updatedAt: args.updatedAt ?? now,
    });

    return printerId;
  },
});

/**
 * Updates an existing organization printer configuration
 */
export const update = mutation({
  args: {
    id: v.id("organizationPrinters"),
    printerUrl: v.optional(v.string()),
    printerPort: v.optional(v.string()),
    printerType: v.optional(
      v.union(v.literal("Lan"), v.literal("Bluetooth"), v.literal("Usb"))
    ),
    printerUseFor: v.optional(
      v.union(v.literal("Cashier"), v.literal("Station"), v.literal("WorkStation"))
    ),
    stationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Printer not found");
    }

    let trimmedUrl: string | undefined = undefined;
    if (args.printerUrl !== undefined) {
      if (!args.printerUrl || !args.printerUrl.trim()) {
        throw new Error("Printer URL can't be blank");
      }
      trimmedUrl = args.printerUrl.trim();
    }

    const trimmedPort = args.printerPort !== undefined ? args.printerPort.trim() : undefined;
    const trimmedStationId = args.stationId !== undefined ? args.stationId.trim() : undefined;

    const effectiveType = args.printerType ?? existing.printerType;
    const effectiveUseFor = args.printerUseFor ?? existing.printerUseFor;
    const effectiveStationId =
      args.stationId !== undefined ? trimmedStationId : existing.stationId;

    // Validate conditional station requirement on effective values
    validateStationRequirement(effectiveType, effectiveUseFor, effectiveStationId);

    // Validate active uniqueness of printerUseFor if changing role
    if (args.printerUseFor !== undefined && args.printerUseFor !== existing.printerUseFor) {
      await validateUniquePrinterUseFor(ctx, args.printerUseFor, args.id);
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      printerUrl: trimmedUrl ?? existing.printerUrl,
      printerPort: trimmedPort ?? existing.printerPort,
      printerType: effectiveType,
      printerUseFor: effectiveUseFor,
      stationId: effectiveStationId,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Soft deletes an organization printer configuration
 */
export const remove = mutation({
  args: { id: v.id("organizationPrinters") },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Printer not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      deletedAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});
