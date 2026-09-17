import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  requireAuth,
  resolveStoreOrganization,
  getCallerMembership,
} from "./organizationUsers";
import { resolveAssetOrStorageUrl } from "./assetResolver";

// ----------------------------------------------------
// AUTHORIZATION HELPERS
// ----------------------------------------------------

/**
 * Requires caller to be an active Store Admin or Cashier in the store database.
 */
async function requireAdminOrCashier(
  ctx: QueryCtx | MutationCtx,
  explicitOrgId?: Id<"organizations">
) {
  const identity = await requireAuth(ctx);
  const org = await resolveStoreOrganization(ctx, explicitOrgId);
  const callerMember = await getCallerMembership(ctx, identity.subject, org._id);

  if (
    !callerMember ||
    callerMember.deletedAt !== undefined ||
    (!callerMember.userType.includes("admin") &&
      !callerMember.userType.includes("cashier"))
  ) {
    throw new Error("Forbidden. Admin or Cashier access required.");
  }

  return { identity, org, callerMember };
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Public/Storefront Query: Lists active storefront images sorted by position ascending.
 * Resolves the Cloudflare R2 download URL dynamically.
 */
export const listStorefrontImages = query({
  args: {
    imageType: v.optional(
      v.union(v.literal("carousel_image"), v.literal("about_us_image"))
    ),
  },
  handler: async (ctx, args) => {
    let images: Doc<"digitalStoreImages">[] = [];

    if (args.imageType) {
      images = await ctx.db
        .query("digitalStoreImages")
        .withIndex("by_type_and_position", (q) =>
          q.eq("imageType", args.imageType!)
        )
        .collect();
    } else {
      images = await ctx.db.query("digitalStoreImages").collect();
    }

    const activeImages = images
      .filter((img) => img.deletedAt === undefined)
      .sort((a, b) => a.position - b.position);

    const results = [];
    for (const img of activeImages) {
      const asset = img.assetId
        ? ((await ctx.db.get(img.assetId)) as Doc<"organization_assets"> | null)
        : null;
      const imageUrl = await resolveAssetOrStorageUrl(ctx, {
        assetId: img.assetId,
        storageId: img.storageId,
        organizationId: asset?.organizationId,
      });

      results.push({
        _id: img._id,
        _creationTime: img._creationTime,
        assetId: img.assetId,
        storageId: img.storageId,
        imageType: img.imageType,
        position: img.position,
        legacyId: img.legacyId,
        createdAt: img.createdAt,
        updatedAt: img.updatedAt,
        imageUrl,
        fileName: asset?.fileName || `Photo ${img.position}`,
        contentType: asset?.contentType,
        fileSize: asset?.fileSize,
      });
    }

    return results;
  },
});

/**
 * Public/Storefront Query: Retrieves a single storefront image by ID with resolved URL.
 */
export const getDigitalStoreImage = query({
  args: {
    id: v.id("digitalStoreImages"),
  },
  handler: async (ctx, args) => {
    const img = await ctx.db.get(args.id);
    if (!img || img.deletedAt !== undefined) {
      return null;
    }

    const asset = img.assetId
      ? ((await ctx.db.get(img.assetId)) as Doc<"organization_assets"> | null)
      : null;
    const imageUrl = await resolveAssetOrStorageUrl(ctx, {
      assetId: img.assetId,
      storageId: img.storageId,
      organizationId: asset?.organizationId,
    });

    return {
      _id: img._id,
      _creationTime: img._creationTime,
      assetId: img.assetId,
      storageId: img.storageId,
      imageType: img.imageType,
      position: img.position,
      legacyId: img.legacyId,
      createdAt: img.createdAt,
      updatedAt: img.updatedAt,
      imageUrl,
      fileName: asset?.fileName || `Photo ${img.position}`,
      contentType: asset?.contentType,
      fileSize: asset?.fileSize,
    };
  },
});

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * Staff Mutation: Creates a new digital storefront image record linking to a validated R2 asset or Convex storage.
 * Auto-assigns sequential position if omitted.
 */
export const createDigitalStoreImage = mutation({
  args: {
    assetId: v.optional(v.id("organization_assets")),
    storageId: v.optional(v.id("_storage")),
    imageType: v.union(
      v.literal("carousel_image"),
      v.literal("about_us_image")
    ),
    position: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    // 1. Calculate next sequential position if not provided
    let position = args.position;
    if (position === undefined || position === null) {
      const existingImages = await ctx.db
        .query("digitalStoreImages")
        .withIndex("by_type_and_position", (q) =>
          q.eq("imageType", args.imageType)
        )
        .collect();

      const activePositions = existingImages
        .filter((img) => img.deletedAt === undefined)
        .map((img) => img.position);

      position = activePositions.length > 0 ? Math.max(...activePositions) + 1 : 1;
    } else if (position < 1 || !Number.isInteger(position)) {
      throw new Error("Position must be a positive integer >= 1.");
    }

    const now = Date.now();
    const imageId = await ctx.db.insert("digitalStoreImages", {
      assetId: args.assetId,
      storageId: args.storageId,
      imageType: args.imageType,
      position,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(imageId);
  },
});

/**
 * Staff Mutation: Updates the display position of an existing storefront image with atomic sibling shifting.
 */
export const updateImagePosition = mutation({
  args: {
    id: v.id("digitalStoreImages"),
    position: v.number(),
  },
  handler: async (ctx, args) => {
    const { org } = await requireAdminOrCashier(ctx);

    const img = await ctx.db.get(args.id);
    if (!img || img.deletedAt !== undefined) {
      throw new Error("Digital store image not found or deleted.");
    }

    const asset = img.assetId
      ? ((await ctx.db.get(img.assetId)) as Doc<"organization_assets"> | null)
      : null;
    if (asset && String(asset.organizationId) !== String(org._id)) {
      throw new Error("Forbidden. Image does not belong to current store organization.");
    }

    if (args.position < 1 || !Number.isInteger(args.position)) {
      throw new Error("Position must be a positive integer >= 1.");
    }

    const allImages = await ctx.db
      .query("digitalStoreImages")
      .withIndex("by_type_and_position", (q) =>
        q.eq("imageType", img.imageType)
      )
      .collect();

    const activeImages = allImages
      .filter((item) => item.deletedAt === undefined)
      .sort((a, b) => a.position - b.position);

    const currentIndex = activeImages.findIndex(
      (item) => String(item._id) === String(img._id)
    );

    if (currentIndex === -1) {
      throw new Error("Image not found in active list.");
    }

    // Clamp target position between 1 and activeImages.length
    const targetPosition = Math.min(
      Math.max(1, args.position),
      activeImages.length
    );
    const targetIndex = targetPosition - 1;

    if (currentIndex !== targetIndex) {
      const reordered = [...activeImages];
      const [movedItem] = reordered.splice(currentIndex, 1);
      reordered.splice(targetIndex, 0, movedItem);

      const now = Date.now();
      for (let i = 0; i < reordered.length; i++) {
        const item = reordered[i];
        const newPos = i + 1;
        if (item.position !== newPos) {
          await ctx.db.patch(item._id, {
            position: newPos,
            updatedAt: now,
          });
        }
      }
    }

    return await ctx.db.get(img._id);
  },
});

/**
 * Staff Mutation: Atomically reindexes positions (1..N) for an ordered array of image IDs within an imageType.
 */
export const reorderImages = mutation({
  args: {
    imageType: v.union(
      v.literal("carousel_image"),
      v.literal("about_us_image")
    ),
    imageIds: v.array(v.id("digitalStoreImages")),
  },
  handler: async (ctx, args) => {
    const { org } = await requireAdminOrCashier(ctx);

    if (args.imageIds.length === 0) {
      return { success: true, count: 0 };
    }

    // 1. Duplicate check
    const uniqueIds = new Set(args.imageIds);
    if (uniqueIds.size !== args.imageIds.length) {
      throw new Error("Duplicate image IDs detected in reorder list.");
    }

    // 2. Fetch all target images and validate
    const targetImages: Doc<"digitalStoreImages">[] = [];
    for (const id of args.imageIds) {
      const img = await ctx.db.get(id);
      if (!img || img.deletedAt !== undefined) {
        throw new Error(`Image not found or deleted: ${id}`);
      }

      if (img.imageType !== args.imageType) {
        throw new Error(`Image ${id} does not match target imageType ${args.imageType}.`);
      }

      const asset = img.assetId
        ? ((await ctx.db.get(img.assetId)) as Doc<"organization_assets"> | null)
        : null;
      if (asset && String(asset.organizationId) !== String(org._id)) {
        throw new Error(`Forbidden. Image ${id} does not belong to current store.`);
      }

      targetImages.push(img);
    }

    // 3. Atomically assign sequential positions 1..N
    const now = Date.now();
    for (let i = 0; i < args.imageIds.length; i++) {
      const id = args.imageIds[i];
      const newPos = i + 1;
      await ctx.db.patch(id, {
        position: newPos,
        updatedAt: now,
      });
    }

    return { success: true, count: args.imageIds.length };
  },
});

/**
 * Staff Mutation: Soft-deletes a digitalStoreImages record and cleans up the R2 asset if unreferenced.
 */
export const removeDigitalStoreImage = mutation({
  args: {
    id: v.id("digitalStoreImages"),
  },
  handler: async (ctx, args) => {
    const { org } = await requireAdminOrCashier(ctx);

    const img = await ctx.db.get(args.id);
    if (!img || img.deletedAt !== undefined) {
      return { success: true, alreadyDeleted: true };
    }

    const asset = img.assetId
      ? ((await ctx.db.get(img.assetId)) as Doc<"organization_assets"> | null)
      : null;
    if (asset && String(asset.organizationId) !== String(org._id)) {
      throw new Error("Forbidden. Image does not belong to current store organization.");
    }

    const now = Date.now();

    // 1. Soft delete the digitalStoreImages record
    await ctx.db.patch(img._id, {
      deletedAt: now,
      updatedAt: now,
    });

    // 2. Check if any other active digitalStoreImages record references this asset
    if (img.assetId) {
      const remainingRefs = await ctx.db
        .query("digitalStoreImages")
        .withIndex("by_asset", (q) => q.eq("assetId", img.assetId!))
        .collect();

      const activeRemaining = remainingRefs.filter(
        (r) => r.deletedAt === undefined && String(r._id) !== String(img._id)
      );

      // 3. If no active references remain, mark asset deleted
      if (activeRemaining.length === 0 && asset && asset.deletedAt === undefined) {
        await ctx.db.patch(asset._id, {
          status: "deleted",
          deletedAt: now,
          updatedAt: now,
        });
      }
    }

    return { success: true, assetId: img.assetId };
  },
});
