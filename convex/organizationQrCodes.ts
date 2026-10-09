import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  requireAuth,
  resolveStoreOrganization,
  getCallerMembership,
  requireMember,
} from "./organizationUsers";
import { resolveAssetOrStorageUrl } from "./assetResolver";

// ----------------------------------------------------
// AUTHORIZATION HELPERS
// ----------------------------------------------------

/**
 * Requires caller to be an active Store Admin or Cashier in the store database.
 */
export async function requireAdminOrCashier(
  ctx: QueryCtx | MutationCtx,
  explicitOrgId?: Id<"organizations">,
) {
  const identity = await requireAuth(ctx);
  const org = await resolveStoreOrganization(ctx, explicitOrgId);
  const callerMember = await getCallerMembership(
    ctx,
    identity.subject,
    org._id,
  );

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
// TYPE & URL HELPERS
// ----------------------------------------------------

export function normalizeQrType(
  rawType: string,
): "DineIn" | "TakeAway" | "Delivery" | "Queue" {
  if (!rawType || typeof rawType !== "string") return "DineIn";
  const upper = rawType.toUpperCase().trim().replace(/[-_\s]/g, "");
  if (upper === "DINEIN") return "DineIn";
  if (upper === "TAKEAWAY") return "TakeAway";
  if (upper === "DELIVERY") return "Delivery";
  if (upper === "QUEUE") return "Queue";
  if (
    rawType === "DineIn" ||
    rawType === "TakeAway" ||
    rawType === "Delivery" ||
    rawType === "Queue"
  ) {
    return rawType;
  }
  return "DineIn";
}

export function formatContractQrType(
  qrType: "DineIn" | "TakeAway" | "Delivery" | "Queue" | string,
): string {
  if (qrType === "DineIn") return "DINE_IN";
  if (qrType === "TakeAway") return "TAKEAWAY";
  if (qrType === "Delivery") return "DELIVERY";
  return qrType.toUpperCase();
}

/**
 * Builds canonical frontend deep-link QR URL strings.
 */
export function buildQrUrl(
  qrId: string,
  qrType: "DineIn" | "TakeAway" | "Delivery" | "Queue",
  name: string,
  tableId?: string,
  storeSlug?: string,
): string {
  const encodedName = encodeURIComponent(name.trim());
  const storeParam = storeSlug ? `store=${encodeURIComponent(storeSlug)}&` : "";

  if (qrType === "DineIn") {
    return `/store?${storeParam}qr_id=${qrId}&type=DineIn&qr_name=${encodedName}&table_id=${tableId ?? ""}`;
  } else if (qrType === "Queue") {
    return `/queue?${storeParam}qr_id=${qrId}&type=Queue&qr_name=${encodedName}`;
  } else if (qrType === "Delivery") {
    return `/delivery?${storeParam}qr_id=${qrId}&type=Delivery&qr_name=${encodedName}`;
  } else {
    return `/store?${storeParam}qr_id=${qrId}&type=TakeAway&qr_name=${encodedName}`;
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
  excludeId?: Id<"organizationQrCodes">,
): Promise<void> {
  const existing = await ctx.db
    .query("organizationQrCodes")
    .withIndex("by_name", (q) => q.eq("name", name))
    .collect();

  const activeDuplicates = existing.filter(
    (q) =>
      q.deletedAt === undefined &&
      (excludeId === undefined || q._id !== excludeId),
  );

  if (activeDuplicates.length > 0) {
    throw new Error(`Hey! ${name} is already taken.`);
  }
}

async function validateDineInTable(
  ctx: QueryCtx | MutationCtx,
  tableId?: string,
  orgId?: Id<"organizations">,
): Promise<string> {
  if (!tableId || !tableId.trim()) {
    throw new Error("Dining table reference is required for DineIn QR codes.");
  }
  const cleanId = tableId.trim();

  try {
    const tableDoc = await ctx.db.get(cleanId as Id<"organizationTables">);
    if (tableDoc) {
      if (tableDoc.deletedAt !== undefined) {
        throw new Error("TABLE_NOT_FOUND");
      }
    }
  } catch (err: any) {
    if (err.message === "TABLE_NOT_FOUND" || err.message === "TABLE_NOT_BELONG_TO_OUTLET") {
      throw err;
    }
  }

  return cleanId;
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Lists active organization QR codes with optional qrType filter.
 */
export const list = query({
  args: {
    qrType: v.optional(v.string()),
    status: v.optional(v.union(v.literal("ACTIVE"), v.literal("INACTIVE"))),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    let items = await ctx.db.query("organizationQrCodes").collect();

    // Filter soft-deleted
    items = items.filter((i) => i.deletedAt === undefined);

    if (args.qrType !== undefined) {
      const normalized = normalizeQrType(args.qrType);
      items = items.filter((i) => i.qrType === normalized || i.qrType === args.qrType);
    }

    if (args.status !== undefined) {
      items = items.filter((i) => (i.status ?? "ACTIVE") === args.status);
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

    return {
      ...qr,
      status: qr.status ?? "ACTIVE",
      destination: qr.destination || qr.qrUrl,
    };
  },
});

/**
 * Fetches active DineIn QR code by table ID.
 */
export const getByTable = query({
  args: { tableId: v.string() },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("organizationQrCodes")
      .withIndex("by_table", (q) => q.eq("tableId", args.tableId))
      .collect();

    const active = items.find((i) => i.deletedAt === undefined);
    if (!active) return null;

    return {
      ...active,
      status: active.status ?? "ACTIVE",
      destination: active.destination || active.qrUrl,
    };
  },
});

/**
 * Public query for customer QR code resolution.
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
        const doc = (await ctx.db.get(
          args.identifier as Id<"organizationQrCodes">,
        )) as any;
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

    const currentStatus = qr.status ?? "ACTIVE";

    if (currentStatus === "INACTIVE") {
      return {
        code: "QR_INACTIVE",
        message: "This QR code is currently inactive.",
        status: "INACTIVE",
      };
    }

    return {
      qrId: qr._id,
      legacyId: qr.legacyId,
      displayName: qr.name,
      name: qr.name,
      type: formatContractQrType(qr.qrType),
      qrType: qr.qrType,
      outletId: qr.organizationId,
      destination: qr.destination || qr.qrUrl,
      qrUrl: qr.qrUrl,
      counter: qr.counter,
      tableNumber: qr.tableNumber,
      tableName: qr.tableNumber || qr.name,
      tableId: qr.tableId,
      status: "ACTIVE",
    };
  },
});

export const resolveCustomerSession = query({
  args: {
    organizationId: v.optional(v.union(v.id("organizations"), v.string())),
    slug: v.optional(v.string()),
    qrId: v.optional(v.string()),
    tableId: v.optional(v.string()),
    tableNumber: v.optional(v.string()),
    identifier: v.optional(v.string()), // general token or composite id
  },
  handler: async (ctx, args) => {
    // 0. If absolutely no parameters were provided, immediately reject with ORG_NOT_FOUND
    const hasAnyParam =
      (args.organizationId !== undefined && args.organizationId.trim() !== "") ||
      (args.slug !== undefined && args.slug.trim() !== "") ||
      (args.identifier !== undefined && args.identifier.trim() !== "") ||
      (args.qrId !== undefined && args.qrId.trim() !== "") ||
      (args.tableId !== undefined && args.tableId.trim() !== "") ||
      (args.tableNumber !== undefined && args.tableNumber.trim() !== "");

    if (!hasAnyParam) {
      return {
        valid: false,
        error: "Scan the restaurant QR code to start ordering.",
        errorCode: "ORG_NOT_FOUND" as const,
      };
    }

    // 1. Resolve Store / Organization
    let activeOrg: Doc<"organizations"> | null = null;

    // A. By explicit organizationId
    if (args.organizationId && args.organizationId.trim() !== "") {
      const rawOrgId = args.organizationId.trim();
      try {
        const normalizedId = ctx.db.normalizeId("organizations", rawOrgId);
        if (normalizedId) {
          const doc = await ctx.db.get(normalizedId);
          if (doc && doc.deletedAt === undefined) {
            activeOrg = doc;
          }
        }
      } catch {
        // Invalid ID format ignored
      }

      if (!activeOrg) {
        // Try legacyId lookup
        const legacyMatch = await ctx.db
          .query("organizations")
          .withIndex("by_legacy_id", (q) => q.eq("legacyId", rawOrgId))
          .first();
        if (legacyMatch && legacyMatch.deletedAt === undefined) {
          activeOrg = legacyMatch;
        }
      }
    }

    // B. By explicit slug
    if (!activeOrg && args.slug && args.slug.trim() !== "") {
      const normalizedSlug = args.slug.trim().toLowerCase();
      const slugMatch = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", normalizedSlug))
        .first();
      if (slugMatch && slugMatch.deletedAt === undefined) {
        activeOrg = slugMatch;
      }
    }

    // C. Check if identifier matches an org slug, legacyId, or Convex ID
    if (!activeOrg && args.identifier && args.identifier.trim() !== "") {
      const rawIdent = args.identifier.trim();

      // Try slug match
      const slugMatch = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", rawIdent.toLowerCase()))
        .first();
      if (slugMatch && slugMatch.deletedAt === undefined) {
        activeOrg = slugMatch;
      }

      // Try legacyId match
      if (!activeOrg) {
        const legacyMatch = await ctx.db
          .query("organizations")
          .withIndex("by_legacy_id", (q) => q.eq("legacyId", rawIdent))
          .first();
        if (legacyMatch && legacyMatch.deletedAt === undefined) {
          activeOrg = legacyMatch;
        }
      }

      // Try direct ID match
      if (!activeOrg) {
        try {
          const normalizedId = ctx.db.normalizeId("organizations", rawIdent);
          if (normalizedId) {
            const doc = await ctx.db.get(normalizedId);
            if (doc && doc.deletedAt === undefined) {
              activeOrg = doc;
            }
          }
        } catch {
          // ignore
        }
      }
    }

    // D. Check if QR code was provided and has any context
    let qrDoc: Doc<"organizationQrCodes"> | null = null;
    let targetTableId: string | undefined = args.tableId?.trim() || undefined;
    let targetTableNumber: string | undefined = args.tableNumber?.trim() || undefined;

    const effectiveQrIdentifier =
      args.qrId?.trim() ||
      (args.identifier && (!activeOrg || args.identifier.trim() !== activeOrg.slug)
        ? args.identifier.trim()
        : undefined);

    if (effectiveQrIdentifier) {
      // Lookup by legacyId
      const legacyMatches = await ctx.db
        .query("organizationQrCodes")
        .withIndex("by_legacy_id", (q) => q.eq("legacyId", effectiveQrIdentifier))
        .collect();
      qrDoc = legacyMatches.find((q) => q.deletedAt === undefined) ?? null;

      // Direct Convex ID lookup
      if (!qrDoc) {
        try {
          const doc = (await ctx.db.get(
            effectiveQrIdentifier as Id<"organizationQrCodes">
          )) as any;
          if (doc && doc.qrType !== undefined && doc.deletedAt === undefined) {
            qrDoc = doc as Doc<"organizationQrCodes">;
          }
        } catch {
          // Ignore invalid id format
        }
      }

      // Lookup by tableId if still not found
      if (!qrDoc) {
        try {
          const tableQrs = await ctx.db
            .query("organizationQrCodes")
            .withIndex("by_table", (q) => q.eq("tableId", effectiveQrIdentifier))
            .collect();
          qrDoc = tableQrs.find((q) => q.deletedAt === undefined) ?? null;
        } catch {
          // Ignore
        }
      }

      if (qrDoc) {
        if (!targetTableId && qrDoc.tableId) {
          targetTableId = qrDoc.tableId;
        }
        if (!targetTableNumber && qrDoc.tableNumber) {
          targetTableNumber = qrDoc.tableNumber;
        }
      } else {
        // If not a QR record, but identifier was passed without explicit table fields
        if (!targetTableId && !targetTableNumber && !activeOrg) {
          targetTableId = effectiveQrIdentifier;
          targetTableNumber = effectiveQrIdentifier;
        }
      }
    }

    // 2. Resolve Organization Table (if table-specific context was requested)
    let tableDoc: Doc<"organizationTables"> | null = null;
    const hasTableRequest =
      !!targetTableId ||
      !!targetTableNumber ||
      (qrDoc !== null && qrDoc.qrType === "DineIn");

    if (hasTableRequest) {
      const allTables = await ctx.db.query("organizationTables").collect();
      const activeTables = allTables.filter((t) => t.deletedAt === undefined);

      if (targetTableId) {
        // Direct Convex ID lookup
        try {
          const doc = (await ctx.db.get(
            targetTableId as Id<"organizationTables">
          )) as any;
          if (doc && doc.tableNumber !== undefined && doc.deletedAt === undefined) {
            tableDoc = doc as Doc<"organizationTables">;
          }
        } catch {
          // Ignore invalid id format
        }

        // Legacy ID lookup
        if (!tableDoc) {
          tableDoc = activeTables.find((t) => t.legacyId === targetTableId) ?? null;
        }
      }

      // Lookup by tableNumber if not found by ID
      if (!tableDoc && targetTableNumber) {
        const normalizedNum = targetTableNumber.toLowerCase();
        tableDoc =
          activeTables.find(
            (t) => t.tableNumber.trim().toLowerCase() === normalizedNum
          ) ?? null;
      }

      // If still not found, check qrDoc tableNumber
      if (!tableDoc && qrDoc?.tableNumber) {
        const normalizedNum = qrDoc.tableNumber.trim().toLowerCase();
        tableDoc =
          activeTables.find(
            (t) => t.tableNumber.trim().toLowerCase() === normalizedNum
          ) ?? null;
      }

      if (!tableDoc) {
        return {
          valid: false,
          error: "This table QR code is no longer active or the table was not found.",
          errorCode: "TABLE_NOT_FOUND" as const,
        };
      }

      // Check if table is blocked
      if (tableDoc.isBlock) {
        return {
          valid: false,
          error:
            "This table is currently unavailable. Please ask a member of staff for assistance.",
          errorCode: "TABLE_BLOCKED" as const,
          table: {
            _id: tableDoc._id,
            tableNumber: tableDoc.tableNumber,
            placement: tableDoc.placement,
            seatingCapacity: tableDoc.seatingCapacity,
            isBlock: true,
          },
        };
      }
    }

    // If activeOrg was not explicitly specified via organizationId or slug,
    // but a valid tableDoc or qrDoc was found in the database, resolve the store organization:
    if (!activeOrg && (tableDoc || qrDoc)) {
      const orgs = await ctx.db.query("organizations").collect();
      const activeOrgs = orgs.filter((o) => o.deletedAt === undefined);
      if (activeOrgs.length === 1) {
        activeOrg = activeOrgs[0];
      }
    }

    // If activeOrg is still not resolved, strictly return ORG_NOT_FOUND
    if (!activeOrg) {
      return {
        valid: false,
        error: "Scan the restaurant QR code to start ordering.",
        errorCode: "ORG_NOT_FOUND" as const,
      };
    }

    // Safe organization profile with asset-based logo resolution
    let resolvedLogoUrl: string | null = null;
    if (activeOrg.logoAssetId || activeOrg.logoStorageId) {
      try {
        const storageOrR2Url = await resolveAssetOrStorageUrl(ctx, {
          assetId: activeOrg.logoAssetId,
          storageId: activeOrg.logoStorageId,
          organizationId: activeOrg._id,
        });
        if (storageOrR2Url) {
          resolvedLogoUrl = storageOrR2Url;
        }
      } catch {}
    }

    if (!resolvedLogoUrl && activeOrg.logoUrl && typeof activeOrg.logoUrl === "string") {
      const trimmed = activeOrg.logoUrl.trim();
      if (
        (trimmed.startsWith("http://") || trimmed.startsWith("https://")) &&
        !trimmed.startsWith("blob:")
      ) {
        resolvedLogoUrl = trimmed;
      }
    }

    const orgProfile = {
      _id: activeOrg._id,
      name: activeOrg.name,
      slug: activeOrg.slug,
      logoUrl: resolvedLogoUrl,
      isVeg: activeOrg.isVeg ?? false,
      isDineIn: activeOrg.isDineIn ?? true,
      isTakeAway: activeOrg.isTakeAway ?? true,
      isDelivery: activeOrg.isDelivery ?? true,
      scheduledPickup: activeOrg.scheduledPickup ?? false,
      scheduledDelivery: activeOrg.scheduledDelivery ?? false,
      organizationTimeZone: activeOrg.organizationTimeZone ?? "Asia/Kolkata",
      takeAwayOnlinePayment: activeOrg.takeAwayOnlinePayment ?? false,
      takeAwayCashPayment: activeOrg.takeAwayCashPayment ?? false,
      scheduledPickupOnlinePayment: activeOrg.scheduledPickupOnlinePayment ?? false,
      scheduledPickupCashPayment: activeOrg.scheduledPickupCashPayment ?? false,
      scheduledDeliveryOnlinePayment: activeOrg.scheduledDeliveryOnlinePayment ?? false,
      scheduledDeliveryCashPayment: activeOrg.scheduledDeliveryCashPayment ?? false,
      dineinPrepaid: activeOrg.dineinPrepaid ?? false,
      dineinPospaid: activeOrg.dineinPospaid ?? false,
      deliveryCashOnDelivery: activeOrg.deliveryCashOnDelivery ?? false,
      deliveryOnlinePayment: activeOrg.deliveryOnlinePayment ?? false,
      defaultCurrencySymbol: activeOrg.defaultCurrencySymbol ?? "₹",
      defaultCurrency: activeOrg.defaultCurrency ?? "INR",
    };

    // 3. Resolve Layout Name
    let layoutName: string | null = null;
    if (tableDoc && tableDoc.layoutId) {
      const layoutDoc = await ctx.db.get(tableDoc.layoutId);
      if (layoutDoc && layoutDoc.deletedAt === undefined) {
        layoutName = layoutDoc.name;
      }
    }

    return {
      valid: true,
      table: tableDoc
        ? {
            _id: tableDoc._id,
            tableNumber: tableDoc.tableNumber,
            placement: tableDoc.placement,
            seatingCapacity: tableDoc.seatingCapacity,
            layoutName: layoutName ?? tableDoc.placement ?? null,
            isBlock: tableDoc.isBlock ?? false,
            isRequested: tableDoc.isRequested ?? false,
          }
        : null,
      qr: qrDoc
        ? {
            _id: qrDoc._id,
            name: qrDoc.name,
            qrType: qrDoc.qrType,
          }
        : null,
      organization: orgProfile,
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
    name: v.optional(v.string()),
    displayName: v.optional(v.string()),
    description: v.optional(v.string()),
    qrType: v.string(),
    status: v.optional(v.union(v.literal("ACTIVE"), v.literal("INACTIVE"))),
    tableNumber: v.optional(v.string()),
    tableId: v.optional(v.string()),
    outletId: v.optional(v.id("organizations")),
    organizationId: v.optional(v.id("organizations")),
    legacyId: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const targetOrgId = args.outletId ?? args.organizationId;
    const { org } = await requireAdminOrCashier(ctx, targetOrgId);

    const rawName = args.displayName || args.name;
    if (!rawName) {
      throw new Error("QR code name or displayName is required.");
    }
    const trimmedName = normalizeQrName(rawName);
    await validateUniqueQrName(ctx, trimmedName);

    const normalizedType = normalizeQrType(args.qrType);

    let effectiveTableId: string | undefined = undefined;

    if (normalizedType === "DineIn") {
      effectiveTableId = await validateDineInTable(ctx, args.tableId, org._id);
    }

    const now = Date.now();
    const statusVal = args.status ?? "ACTIVE";

    const qrId = await ctx.db.insert("organizationQrCodes", {
      organizationId: org._id,
      legacyId: args.legacyId,
      name: trimmedName,
      description: args.description?.trim() || undefined,
      qrType: normalizedType,
      status: statusVal,
      counter: 0,
      tableNumber: args.tableNumber?.trim() || undefined,
      tableId: effectiveTableId,
      createdAt: args.createdAt ?? now,
      updatedAt: args.updatedAt ?? now,
      activatedAt: statusVal === "ACTIVE" ? now : undefined,
      disabledAt: statusVal === "INACTIVE" ? now : undefined,
    });

    const destination = buildQrUrl(qrId, normalizedType, trimmedName, effectiveTableId, org.slug);
    await ctx.db.patch(qrId, { qrUrl: destination, destination, updatedAt: now });

    const inserted = await ctx.db.get(qrId);

    return {
      qrId: inserted!._id,
      _id: inserted!._id,
      outletId: org._id,
      organizationId: org._id,
      type: formatContractQrType(normalizedType),
      qrType: normalizedType,
      tableId: effectiveTableId,
      displayName: trimmedName,
      name: trimmedName,
      status: statusVal,
      destination,
      qrUrl: destination,
      createdAt: new Date(inserted!.createdAt).toISOString(),
    };
  },
});

/**
 * Updates properties of an existing organization QR code (preserves stable QR identity).
 */
export const update = mutation({
  args: {
    id: v.id("organizationQrCodes"),
    name: v.optional(v.string()),
    displayName: v.optional(v.string()),
    description: v.optional(v.string()),
    qrType: v.optional(v.string()),
    status: v.optional(v.union(v.literal("ACTIVE"), v.literal("INACTIVE"))),
    tableNumber: v.optional(v.string()),
    tableId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org } = await requireAdminOrCashier(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("QR_NOT_FOUND");
    }

    await requireAdminOrCashier(ctx, existing.organizationId);

    const inputName = args.displayName ?? args.name;
    const effectiveName =
      inputName !== undefined ? normalizeQrName(inputName) : existing.name;

    if (inputName !== undefined) {
      await validateUniqueQrName(ctx, effectiveName, args.id);
    }

    const effectiveType = normalizeQrType(
      args.qrType !== undefined ? args.qrType : existing.qrType,
    );
    let effectiveTableId =
      args.tableId !== undefined ? args.tableId : existing.tableId;
    let effectiveTableNumber =
      args.tableNumber !== undefined
        ? args.tableNumber.trim() || undefined
        : existing.tableNumber;

    if (effectiveType === "DineIn") {
      effectiveTableId = await validateDineInTable(ctx, effectiveTableId, existing.organizationId);
    } else {
      effectiveTableId = undefined;
      effectiveTableNumber = undefined;
    }

    const now = Date.now();
    const newDestination = buildQrUrl(
      existing._id,
      effectiveType,
      effectiveName,
      effectiveTableId,
      org.slug,
    );

    const newStatus = args.status ?? existing.status ?? "ACTIVE";
    let activatedAt = existing.activatedAt;
    let disabledAt = existing.disabledAt;

    if (args.status !== undefined && args.status !== existing.status) {
      if (args.status === "ACTIVE") {
        activatedAt = now;
      } else if (args.status === "INACTIVE") {
        disabledAt = now;
      }
    }

    await ctx.db.patch(args.id, {
      name: effectiveName,
      description:
        args.description !== undefined
          ? args.description.trim() || undefined
          : existing.description,
      qrType: effectiveType,
      status: newStatus,
      qrUrl: newDestination,
      destination: newDestination,
      tableNumber: effectiveTableNumber,
      tableId: effectiveTableId,
      updatedAt: now,
      activatedAt,
      disabledAt,
    });

    const updated = (await ctx.db.get(args.id))!;

    return {
      qrId: updated._id,
      _id: updated._id,
      outletId: updated.organizationId,
      type: formatContractQrType(updated.qrType),
      tableId: updated.tableId,
      displayName: updated.name,
      name: updated.name,
      status: newStatus,
      destination: newDestination,
      qrUrl: newDestination,
      updatedAt: new Date(updated.updatedAt).toISOString(),
    };
  },
});

/**
 * Disables a QR code so it cannot start new sessions.
 */
export const disable = mutation({
  args: { id: v.id("organizationQrCodes") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("QR_NOT_FOUND");
    }

    await requireAdminOrCashier(ctx, existing.organizationId);

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "INACTIVE",
      disabledAt: now,
      updatedAt: now,
    });

    return {
      qrId: existing._id,
      status: "INACTIVE" as const,
    };
  },
});

/**
 * Enables an inactive QR code.
 */
export const enable = mutation({
  args: { id: v.id("organizationQrCodes") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("QR_NOT_FOUND");
    }

    await requireAdminOrCashier(ctx, existing.organizationId);

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "ACTIVE",
      activatedAt: now,
      updatedAt: now,
    });

    return {
      qrId: existing._id,
      status: "ACTIVE" as const,
    };
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
      throw new Error("QR_NOT_FOUND");
    }

    if ((existing.status ?? "ACTIVE") === "INACTIVE") {
      throw new Error("QR_INACTIVE");
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
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("QR_NOT_FOUND");
    }

    await requireAdminOrCashier(ctx, existing.organizationId);

    const now = Date.now();

    await ctx.db.patch(args.id, {
      deletedAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Creates multiple DineIn QR Codes in batch for a list of table IDs.
 * Performs per-table validation and returns created and failed lists.
 */
export const createBatch = mutation({
  args: {
    outletId: v.optional(v.id("organizations")),
    organizationId: v.optional(v.id("organizations")),
    type: v.string(), // "DINE_IN"
    tableIds: v.array(v.string()),
    status: v.optional(v.union(v.literal("ACTIVE"), v.literal("INACTIVE"))),
  },
  handler: async (ctx, args) => {
    const targetOrgId = args.outletId ?? args.organizationId;
    const { org } = await requireAdminOrCashier(ctx, targetOrgId);

    const normalizedType = normalizeQrType(args.type);
    const statusVal = args.status ?? "ACTIVE";

    const created: any[] = [];
    const failed: any[] = [];

    for (const tableId of args.tableIds) {
      try {
        const cleanTableId = tableId.trim();
        let tableName = `Table ${cleanTableId}`;

        // Check table doc in organizationTables
        try {
          const tableDoc = await ctx.db.get(cleanTableId as Id<"organizationTables">);
          if (tableDoc) {
            if (tableDoc.deletedAt !== undefined) {
              failed.push({ tableId: cleanTableId, reason: "TABLE_NOT_FOUND" });
              continue;
            }
            tableName = `Table ${tableDoc.tableNumber}`;
          }
        } catch {
          // Table lookup fallback
        }

        // Check if an active QR already exists for this table
        const existingTableQrs = await ctx.db
          .query("organizationQrCodes")
          .withIndex("by_table", (q) => q.eq("tableId", cleanTableId))
          .collect();

        const activeQr = existingTableQrs.find(
          (q) => q.deletedAt === undefined && (q.status ?? "ACTIVE") === "ACTIVE",
        );

        if (activeQr) {
          failed.push({
            tableId: cleanTableId,
            reason: "ACTIVE_QR_ALREADY_EXISTS",
          });
          continue;
        }

        const now = Date.now();
        const displayName = `${tableName} QR`;

        const qrId = await ctx.db.insert("organizationQrCodes", {
          organizationId: org._id,
          name: displayName,
          qrType: normalizedType,
          status: statusVal,
          counter: 0,
          tableId: cleanTableId,
          tableNumber: tableName,
          createdAt: now,
          updatedAt: now,
          activatedAt: statusVal === "ACTIVE" ? now : undefined,
        });

        const destination = buildQrUrl(qrId, normalizedType, displayName, cleanTableId, org.slug);
        await ctx.db.patch(qrId, { qrUrl: destination, destination, updatedAt: now });

        created.push({
          qrId,
          tableId: cleanTableId,
          displayName,
          status: statusVal,
          destination,
        });
      } catch (err: any) {
        failed.push({
          tableId,
          reason: err.message || "CREATE_FAILED",
        });
      }
    }

    return {
      created,
      failed,
    };
  },
});
