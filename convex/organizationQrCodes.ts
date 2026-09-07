import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAuth, resolveStoreOrganization, getCallerMembership, requireMember } from "./organizationUsers";

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
// URL BUILDER UTILITY
// ----------------------------------------------------

/**
 * Builds canonical frontend deep-link QR URL strings.
 */
export function buildQrUrl(
  qrId: string,
  qrType: "DineIn" | "TakeAway" | "Queue",
  name: string,
  tableId?: string
): string {
  const baseUrl = process.env.FRONT_END_URL || "https://pos.app";
  const encodedName = encodeURIComponent(name.trim());

  if (qrType === "DineIn") {
    return `${baseUrl}/store?qr_id=${qrId}&type=DineIn&qr_name=${encodedName}&table_id=${tableId ?? ""}`;
  } else if (qrType === "Queue") {
    return `${baseUrl}/queue?qr_id=${qrId}&type=Queue&qr_name=${encodedName}`;
  } else {
    return `${baseUrl}/store?qr_id=${qrId}&type=TakeAway&qr_name=${encodedName}`;
  }
}

// ----------------------------------------------------
// VALIDATION HELPERS
// ----------------------------------------------------

function normalizeQrName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("QR code name is required and cannot be empty.");
  }
  return trimmed;
}

async function validateUniqueQrName(
  ctx: QueryCtx | MutationCtx,
  name: string,
  excludeId?: Id<"organizationQrCodes">
): Promise<void> {
  const existing = await ctx.db
    .query("organizationQrCodes")
    .withIndex("by_name", (q) => q.eq("name", name))
    .collect();

  const activeDuplicates = existing.filter(
    (q) => q.deletedAt === undefined && (excludeId === undefined || q._id !== excludeId)
  );

  if (activeDuplicates.length > 0) {
    throw new Error(`Hey! ${name} is already taken.`);
  }
}

function validateDineInTable(tableId?: string): string {
  if (!tableId || !tableId.trim()) {
    throw new Error("Dining table reference is required for DineIn QR codes.");
  }
  return tableId.trim();
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Lists active organization QR codes with optional qrType filter.
 */
export const list = query({
  args: {
    qrType: v.optional(
      v.union(
        v.literal("DineIn"),
        v.literal("TakeAway"),
        v.literal("Queue")
      )
    ),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    let items = await ctx.db.query("organizationQrCodes").collect();

    // Filter soft-deleted
    items = items.filter((i) => i.deletedAt === undefined);

    if (args.qrType !== undefined) {
      items = items.filter((i) => i.qrType === args.qrType);
    }

    return items.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Fetches a single organization QR code by ID.
 */
export const get = query({
  args: { id: v.id("organizationQrCodes") },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    const qr = await ctx.db.get(args.id);
    if (!qr || qr.deletedAt !== undefined) {
      return null;
    }

    return qr;
  },
});

/**
 * Fetches active DineIn QR code by table ID.
 */
export const getByTable = query({
  args: { tableId: v.string() },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    const items = await ctx.db
      .query("organizationQrCodes")
      .withIndex("by_table", (q) => q.eq("tableId", args.tableId))
      .collect();

    const active = items.find((i) => i.deletedAt === undefined);
    return active ?? null;
  },
});

/**
 * Public query for customer QR code resolution (accepts Convex ID, legacy UUID, or table ID).
 */
export const resolvePublic = query({
  args: {
    identifier: v.string(), // Convex ID, legacy UUID, or Table ID
  },
  handler: async (ctx, args) => {
    let qr: Doc<"organizationQrCodes"> | null = null;

    // 1. Try lookup by legacyId
    const legacyMatches = await ctx.db
      .query("organizationQrCodes")
      .withIndex("by_legacy_id", (q) => q.eq("legacyId", args.identifier))
      .collect();

    qr = legacyMatches.find((q) => q.deletedAt === undefined) ?? null;

    // 2. Try direct Convex ID lookup if valid ID string
    if (!qr) {
      try {
        const doc = (await ctx.db.get(args.identifier as Id<"organizationQrCodes">)) as any;
        if (doc && doc.qrType !== undefined && doc.deletedAt === undefined) {
          qr = doc as Doc<"organizationQrCodes">;
        }
      } catch {
        // Invalid ID format ignored
      }
    }

    // 3. Try lookup by tableId
    if (!qr) {
      try {
        const tableQrs = await ctx.db
          .query("organizationQrCodes")
          .withIndex("by_table", (q) => q.eq("tableId", args.identifier))
          .collect();
        qr = tableQrs.find((q) => q.deletedAt === undefined) ?? null;
      } catch {
        // Invalid table ID format ignored
      }
    }

    if (!qr || qr.deletedAt !== undefined) {
      return null;
    }

    return {
      _id: qr._id,
      legacyId: qr.legacyId,
      name: qr.name,
      qrType: qr.qrType,
      qrUrl: qr.qrUrl,
      counter: qr.counter,
      tableNumber: qr.tableNumber,
      tableId: qr.tableId,
    };
  },
});

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * Creates a new Organization QR Code.
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    qrType: v.union(
      v.literal("DineIn"),
      v.literal("TakeAway"),
      v.literal("Queue")
    ),
    tableNumber: v.optional(v.string()),
    tableId: v.optional(v.string()),
    legacyId: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const trimmedName = normalizeQrName(args.name);
    await validateUniqueQrName(ctx, trimmedName);

    let effectiveTableId: string | undefined = undefined;

    if (args.qrType === "DineIn") {
      effectiveTableId = validateDineInTable(args.tableId);
    }

    const now = Date.now();

    const qrId = await ctx.db.insert("organizationQrCodes", {
      legacyId: args.legacyId,
      name: trimmedName,
      description: args.description?.trim() || undefined,
      qrType: args.qrType,
      counter: 0,
      tableNumber: args.tableNumber?.trim() || undefined,
      tableId: effectiveTableId,
      createdAt: args.createdAt ?? now,
      updatedAt: args.updatedAt ?? now,
    });

    const qrUrl = buildQrUrl(qrId, args.qrType, trimmedName, effectiveTableId);
    await ctx.db.patch(qrId, { qrUrl, updatedAt: now });

    return (await ctx.db.get(qrId))!;
  },
});

/**
 * Updates properties of an existing organization QR code.
 */
export const update = mutation({
  args: {
    id: v.id("organizationQrCodes"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    qrType: v.optional(
      v.union(
        v.literal("DineIn"),
        v.literal("TakeAway"),
        v.literal("Queue")
      )
    ),
    tableNumber: v.optional(v.string()),
    tableId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Organization QR code not found");
    }

    const effectiveName =
      args.name !== undefined ? normalizeQrName(args.name) : existing.name;

    if (args.name !== undefined) {
      await validateUniqueQrName(ctx, effectiveName, args.id);
    }

    const effectiveType = args.qrType ?? existing.qrType;
    let effectiveTableId = args.tableId !== undefined ? args.tableId : existing.tableId;
    let effectiveTableNumber =
      args.tableNumber !== undefined ? args.tableNumber.trim() || undefined : existing.tableNumber;

    if (effectiveType === "DineIn") {
      effectiveTableId = validateDineInTable(effectiveTableId);
    } else {
      effectiveTableId = undefined;
      effectiveTableNumber = undefined;
    }

    const now = Date.now();
    const newUrl = buildQrUrl(existing._id, effectiveType, effectiveName, effectiveTableId);

    await ctx.db.patch(args.id, {
      name: effectiveName,
      description:
        args.description !== undefined
          ? args.description.trim() || undefined
          : existing.description,
      qrType: effectiveType,
      qrUrl: newUrl,
      tableNumber: effectiveTableNumber,
      tableId: effectiveTableId,
      updatedAt: now,
    });

    return (await ctx.db.get(args.id))!;
  },
});

/**
 * Public mutation to increment scan counter when a customer scans a QR code.
 */
export const incrementCounter = mutation({
  args: { id: v.id("organizationQrCodes") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Organization QR code not found");
    }

    const now = Date.now();
    const updatedCounter = (existing.counter ?? 0) + 1;

    await ctx.db.patch(args.id, {
      counter: updatedCounter,
      updatedAt: now,
    });

    return { success: true, counter: updatedCounter };
  },
});

/**
 * Soft deletes an organization QR code.
 */
export const remove = mutation({
  args: { id: v.id("organizationQrCodes") },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Organization QR code not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      deletedAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});
