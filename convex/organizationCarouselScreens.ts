import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAuth, resolveStoreOrganization, getCallerMembership, requireMember } from "./organizationUsers";
import { resolveAssetOrStorageUrl } from "./assetResolver";

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
// POSITION & STORAGE HELPERS
// ----------------------------------------------------

/**
 * Calculates max(position) + 1 for active carousel screens (or 1 if no active screens exist).
 */
export async function getNextPosition(ctx: QueryCtx | MutationCtx): Promise<number> {
  const all = await ctx.db.query("organizationCarouselScreens").collect();
  const active = all.filter((s) => s.deletedAt === undefined);

  if (active.length === 0) {
    return 1;
  }

  const maxPos = Math.max(...active.map((s) => s.position ?? 0));
  return maxPos + 1;
}

/**
 * Formats doc into response object, resolving storage URL from assetId (R2 first) or storageId fallback.
 */
export async function toScreenResponse(
  ctx: QueryCtx | MutationCtx,
  doc: Doc<"organizationCarouselScreens">,
  explicitOrgId?: Id<"organizations">
) {
  let resolvedUrl: string | null = doc.imageUrl ?? null;
  const storageOrR2Url = await resolveAssetOrStorageUrl(ctx, {
    assetId: doc.assetId,
    storageId: doc.storageId,
    organizationId: explicitOrgId,
  });
  if (storageOrR2Url) {
    resolvedUrl = storageOrR2Url;
  }

  return {
    _id: doc._id,
    legacyId: doc.legacyId,
    position: doc.position,
    fileName: doc.fileName,
    imageUrl: resolvedUrl,
    storageId: doc.storageId,
    assetId: doc.assetId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Formats doc into clean, safe public response for customer display devices.
 */
export async function toPublicResponse(
  ctx: QueryCtx | MutationCtx,
  doc: Doc<"organizationCarouselScreens">,
  explicitOrgId?: Id<"organizations">
) {
  let resolvedUrl: string | null = doc.imageUrl ?? null;
  const storageOrR2Url = await resolveAssetOrStorageUrl(ctx, {
    assetId: doc.assetId,
    storageId: doc.storageId,
    organizationId: explicitOrgId,
  });
  if (storageOrR2Url) {
    resolvedUrl = storageOrR2Url;
  }

  return {
    _id: doc._id,
    position: doc.position,
    fileName: doc.fileName,
    imageUrl: resolvedUrl,
  };
}

/**
 * Reorders an active screen to a target position sequence using acts_as_list semantics.
 */
export async function reorderScreenPosition(
  ctx: MutationCtx,
  targetDoc: Doc<"organizationCarouselScreens">,
  targetPosition: number
): Promise<void> {
  const all = await ctx.db.query("organizationCarouselScreens").collect();
  let active = all.filter((s) => s.deletedAt === undefined);

  active.sort((a, b) => a.position - b.position);

  const clampedTarget = Math.max(1, Math.min(targetPosition, active.length));
  const currentPos = targetDoc.position;

  if (currentPos === clampedTarget) {
    return;
  }

  const now = Date.now();

  if (clampedTarget < currentPos) {
    // Shift screens in range [clampedTarget, currentPos - 1] down (+1)
    const shiftList = active.filter(
      (s) => s.position >= clampedTarget && s.position < currentPos && s._id !== targetDoc._id
    );
    for (const screen of shiftList) {
      await ctx.db.patch(screen._id, {
        position: screen.position + 1,
        updatedAt: now,
      });
    }
  } else {
    // Shift screens in range [currentPos + 1, clampedTarget] up (-1)
    const shiftList = active.filter(
      (s) => s.position > currentPos && s.position <= clampedTarget && s._id !== targetDoc._id
    );
    for (const screen of shiftList) {
      await ctx.db.patch(screen._id, {
        position: screen.position - 1,
        updatedAt: now,
      });
    }
  }

  await ctx.db.patch(targetDoc._id, {
    position: clampedTarget,
    updatedAt: now,
  });
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Authenticated query listing active carousel screens ordered by position ascending.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);

    const all = await ctx.db.query("organizationCarouselScreens").collect();
    const active = all.filter((s) => s.deletedAt === undefined);

    active.sort((a, b) => a.position - b.position);

    return Promise.all(active.map((s) => toScreenResponse(ctx, s)));
  },
});

/**
 * Authenticated query fetching single active carousel screen by ID.
 */
export const get = query({
  args: { id: v.id("organizationCarouselScreens") },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    const doc = await ctx.db.get(args.id);
    if (!doc || doc.deletedAt !== undefined) {
      return null;
    }

    return toScreenResponse(ctx, doc);
  },
});

/**
 * Public unauthenticated query (V3) listing active carousel screens for customer displays.
 */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("organizationCarouselScreens").collect();
    const active = all.filter((s) => s.deletedAt === undefined);

    active.sort((a, b) => a.position - b.position);

    return Promise.all(active.map((s) => toPublicResponse(ctx, s)));
  },
});

/**
 * Public unauthenticated query (V3) fetching single active carousel screen for customer displays.
 */
export const getPublic = query({
  args: { id: v.id("organizationCarouselScreens") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.deletedAt !== undefined) {
      return null;
    }

    return toPublicResponse(ctx, doc);
  },
});

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * Generates an upload URL for client-side storage uploads.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCashier(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Creates a new organization carousel screen slide.
 */
export const create = mutation({
  args: {
    position: v.optional(v.number()),
    storageId: v.optional(v.id("_storage")),
    imageUrl: v.optional(v.string()),
    fileName: v.optional(v.string()),
    legacyId: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const now = Date.now();
    let effectivePos = args.position;

    if (effectivePos === undefined) {
      effectivePos = await getNextPosition(ctx);
    }

    const docId = await ctx.db.insert("organizationCarouselScreens", {
      legacyId: args.legacyId,
      position: effectivePos,
      storageId: args.storageId,
      imageUrl: args.imageUrl?.trim() || undefined,
      fileName: args.fileName?.trim() || undefined,
      createdAt: args.createdAt ?? now,
      updatedAt: args.updatedAt ?? now,
    });

    const created = (await ctx.db.get(docId))!;
    return toScreenResponse(ctx, created);
  },
});

/**
 * Updates properties or image attachment of an existing carousel screen slide.
 */
export const update = mutation({
  args: {
    id: v.id("organizationCarouselScreens"),
    position: v.optional(v.number()),
    storageId: v.optional(v.id("_storage")),
    imageUrl: v.optional(v.string()),
    fileName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Organization carousel screen not found");
    }

    const now = Date.now();

    // If storageId is updated, delete old storageId
    if (args.storageId !== undefined && existing.storageId && args.storageId !== existing.storageId) {
      try {
        await ctx.storage.delete(existing.storageId);
      } catch {
        // Ignore deletion errors for legacy or non-existent files
      }
    }

    const updatedStorageId = args.storageId !== undefined ? args.storageId : existing.storageId;
    const updatedImageUrl =
      args.imageUrl !== undefined ? args.imageUrl.trim() || undefined : existing.imageUrl;
    const updatedFileName =
      args.fileName !== undefined ? args.fileName.trim() || undefined : existing.fileName;

    await ctx.db.patch(args.id, {
      storageId: updatedStorageId,
      imageUrl: updatedImageUrl,
      fileName: updatedFileName,
      updatedAt: now,
    });

    if (args.position !== undefined && args.position !== existing.position) {
      await reorderScreenPosition(ctx, (await ctx.db.get(args.id))!, args.position);
    }

    const updated = (await ctx.db.get(args.id))!;
    return toScreenResponse(ctx, updated);
  },
});

/**
 * Reorders a carousel screen to a specified position using acts_as_list semantics.
 */
export const reorder = mutation({
  args: {
    id: v.id("organizationCarouselScreens"),
    position: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Organization carousel screen not found.");
    }

    await reorderScreenPosition(ctx, existing, args.position);

    const updated = (await ctx.db.get(args.id))!;
    return toScreenResponse(ctx, updated);
  },
});

/**
 * Soft deletes an organization carousel screen slide.
 */
export const remove = mutation({
  args: { id: v.id("organizationCarouselScreens") },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Organization carousel screen not found");
    }

    const now = Date.now();

    if (existing.storageId) {
      try {
        await ctx.storage.delete(existing.storageId);
      } catch {
        // Storage cleanup
      }
    }

    await ctx.db.patch(args.id, {
      deletedAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});
