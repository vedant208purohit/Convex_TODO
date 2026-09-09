import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Creates an organization_assets record with initial "pending" status.
 */
export const createPending = mutation({
  args: {
    organizationId: v.id("organizations"),
    storageKey: v.string(),
    fileName: v.string(),
    contentType: v.string(),
    fileSize: v.number(),
    assetType: v.string(),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const assetId = await ctx.db.insert("organization_assets", {
      organizationId: args.organizationId,
      storageKey: args.storageKey,
      fileName: args.fileName,
      contentType: args.contentType,
      fileSize: args.fileSize,
      assetType: args.assetType,
      status: "pending",
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    });
    return assetId;
  },
});

/**
 * Internal mutation variant of createPending for server-to-server action calls.
 */
export const internalCreatePending = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    storageKey: v.string(),
    fileName: v.string(),
    contentType: v.string(),
    fileSize: v.number(),
    assetType: v.string(),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("organization_assets", {
      organizationId: args.organizationId,
      storageKey: args.storageKey,
      fileName: args.fileName,
      contentType: args.contentType,
      fileSize: args.fileSize,
      assetType: args.assetType,
      status: "pending",
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Retrieves an asset record by ID.
 */
export const get = query({
  args: { id: v.id("organization_assets") },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.id);
    if (!asset || asset.deletedAt !== undefined) {
      return null;
    }
    return asset;
  },
});

/**
 * Internal query to retrieve asset record by ID including raw status.
 */
export const internalGet = internalQuery({
  args: { id: v.id("organization_assets") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Retrieves an asset by its unique Cloudflare R2 storageKey.
 */
export const getByStorageKey = query({
  args: { storageKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organization_assets")
      .withIndex("by_storage_key", (q) => q.eq("storageKey", args.storageKey))
      .first();
  },
});

/**
 * Marks an asset as successfully "uploaded" after R2 object verification.
 * Enforces lifecycle state transition rules.
 */
export const markUploaded = mutation({
  args: {
    assetId: v.id("organization_assets"),
    fileSize: v.optional(v.number()),
    contentType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) {
      throw new Error(`Asset not found: ${args.assetId}`);
    }

    if (asset.status === "deleted" || asset.deletedAt !== undefined) {
      throw new Error("Invalid state transition: Cannot mark a deleted asset as uploaded.");
    }

    const now = Date.now();
    const patch: {
      status: "uploaded";
      updatedAt: number;
      fileSize?: number;
      contentType?: string;
    } = {
      status: "uploaded",
      updatedAt: now,
    };

    if (args.fileSize !== undefined && args.fileSize > 0) {
      patch.fileSize = args.fileSize;
    }
    if (args.contentType) {
      patch.contentType = args.contentType;
    }

    await ctx.db.patch(args.assetId, patch);
    return await ctx.db.get(args.assetId);
  },
});

/**
 * Internal mutation variant of markUploaded.
 */
export const internalMarkUploaded = internalMutation({
  args: {
    assetId: v.id("organization_assets"),
    fileSize: v.optional(v.number()),
    contentType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) {
      throw new Error(`Asset not found: ${args.assetId}`);
    }

    if (asset.status === "deleted" || asset.deletedAt !== undefined) {
      throw new Error("Invalid state transition: Cannot mark a deleted asset as uploaded.");
    }

    const now = Date.now();
    const patch: {
      status: "uploaded";
      updatedAt: number;
      fileSize?: number;
      contentType?: string;
    } = {
      status: "uploaded",
      updatedAt: now,
    };

    if (args.fileSize !== undefined && args.fileSize > 0) {
      patch.fileSize = args.fileSize;
    }
    if (args.contentType) {
      patch.contentType = args.contentType;
    }

    await ctx.db.patch(args.assetId, patch);
    return await ctx.db.get(args.assetId);
  },
});

/**
 * Marks an asset as "failed" when R2 verification fails.
 */
export const markFailed = mutation({
  args: {
    assetId: v.id("organization_assets"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) {
      throw new Error(`Asset not found: ${args.assetId}`);
    }

    if (asset.status === "deleted") {
      return asset;
    }

    await ctx.db.patch(args.assetId, {
      status: "failed",
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.assetId);
  },
});

/**
 * Internal mutation variant of markFailed.
 */
export const internalMarkFailed = internalMutation({
  args: {
    assetId: v.id("organization_assets"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) {
      throw new Error(`Asset not found: ${args.assetId}`);
    }

    if (asset.status === "deleted") {
      return asset;
    }

    await ctx.db.patch(args.assetId, {
      status: "failed",
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.assetId);
  },
});

/**
 * Lists active assets for an organization with optional assetType filter.
 */
export const listByOrganization = query({
  args: {
    organizationId: v.id("organizations"),
    assetType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.assetType) {
      return await ctx.db
        .query("organization_assets")
        .withIndex("by_organization_asset_type", (q) =>
          q.eq("organizationId", args.organizationId).eq("assetType", args.assetType!)
        )
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();
    }

    return await ctx.db
      .query("organization_assets")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
  },
});
