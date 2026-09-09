import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export interface MigrationCandidate {
  table: "organizations" | "items" | "customizationItems" | "organizationCarouselScreens";
  recordId: string;
  organizationId: Id<"organizations">;
  assetType: string;
  legacyField: string;
  targetField: string;
  storageId: Id<"_storage">;
  currentAssetId?: Id<"organization_assets">;
  preferredFileName?: string;
}

/**
 * Internal query: Scans database tables to discover all candidate records with legacy Storage IDs.
 */
export const internalListCandidates = internalQuery({
  args: {
    table: v.optional(
      v.union(
        v.literal("all"),
        v.literal("organizations"),
        v.literal("items"),
        v.literal("customizationItems"),
        v.literal("organizationCarouselScreens")
      )
    ),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ candidates: MigrationCandidate[]; hasMore: boolean; nextCursor: string | null }> => {
    const targetTable = args.table || "all";
    const candidates: MigrationCandidate[] = [];

    // 1. Resolve default store organization if needed for tables without direct organizationId
    const primaryOrg = await ctx.db.query("organizations").first();
    const primaryOrgId = primaryOrg?._id;

    // 2. Scan organizations table
    if (targetTable === "all" || targetTable === "organizations") {
      const orgs = await ctx.db.query("organizations").collect();
      for (const org of orgs) {
        if (org.deletedAt !== undefined) continue;

        if (org.logoStorageId) {
          candidates.push({
            table: "organizations",
            recordId: org._id,
            organizationId: org._id,
            assetType: "logo",
            legacyField: "logoStorageId",
            targetField: "logoAssetId",
            storageId: org.logoStorageId,
            currentAssetId: org.logoAssetId,
            preferredFileName: org.name ? `${org.name}-logo` : "store-logo",
          });
        }

        if (org.fssaiDocumentStorageId) {
          candidates.push({
            table: "organizations",
            recordId: org._id,
            organizationId: org._id,
            assetType: "document",
            legacyField: "fssaiDocumentStorageId",
            targetField: "fssaiDocumentAssetId",
            storageId: org.fssaiDocumentStorageId,
            currentAssetId: org.fssaiDocumentAssetId,
            preferredFileName: "fssai-document",
          });
        }

        if (org.gstDocumentStorageId) {
          candidates.push({
            table: "organizations",
            recordId: org._id,
            organizationId: org._id,
            assetType: "document",
            legacyField: "gstDocumentStorageId",
            targetField: "gstDocumentAssetId",
            storageId: org.gstDocumentStorageId,
            currentAssetId: org.gstDocumentAssetId,
            preferredFileName: "gst-document",
          });
        }
      }
    }

    // 3. Scan items table
    if (targetTable === "all" || targetTable === "items") {
      const items = await ctx.db.query("items").collect();
      for (const item of items) {
        if (item.deletedAt !== undefined) continue;
        const orgId = item.organizationId || primaryOrgId;
        if (!orgId) continue;

        if (item.imageStorageId) {
          candidates.push({
            table: "items",
            recordId: item._id,
            organizationId: orgId,
            assetType: "menu_image",
            legacyField: "imageStorageId",
            targetField: "imageAssetId",
            storageId: item.imageStorageId,
            currentAssetId: item.imageAssetId,
            preferredFileName: item.name ? `${item.name}-image` : "menu-item-image",
          });
        }

        if (item.threeDModelStorageId) {
          candidates.push({
            table: "items",
            recordId: item._id,
            organizationId: orgId,
            assetType: "menu_3d_model",
            legacyField: "threeDModelStorageId",
            targetField: "threeDModelAssetId",
            storageId: item.threeDModelStorageId,
            currentAssetId: item.threeDModelAssetId,
            preferredFileName: item.name ? `${item.name}-3d-model` : "item-3d-model",
          });
        }

        if (item.threeDModelIosStorageId) {
          candidates.push({
            table: "items",
            recordId: item._id,
            organizationId: orgId,
            assetType: "menu_3d_model_ios",
            legacyField: "threeDModelIosStorageId",
            targetField: "threeDModelIosAssetId",
            storageId: item.threeDModelIosStorageId,
            currentAssetId: item.threeDModelIosAssetId,
            preferredFileName: item.name ? `${item.name}-3d-model-ios` : "item-3d-model-ios",
          });
        }

        if (item.videoStorageId) {
          candidates.push({
            table: "items",
            recordId: item._id,
            organizationId: orgId,
            assetType: "menu_video",
            legacyField: "videoStorageId",
            targetField: "videoAssetId",
            storageId: item.videoStorageId,
            currentAssetId: item.videoAssetId,
            preferredFileName: item.name ? `${item.name}-video` : "item-video",
          });
        }
      }
    }

    // 4. Scan customizationItems table
    if (targetTable === "all" || targetTable === "customizationItems") {
      const customizationItems = await ctx.db.query("customizationItems").collect();
      for (const ci of customizationItems) {
        if (ci.deletedAt !== undefined) continue;
        const orgId = ci.organizationId || primaryOrgId;
        if (!orgId) continue;

        if (ci.imageStorageId) {
          candidates.push({
            table: "customizationItems",
            recordId: ci._id,
            organizationId: orgId,
            assetType: "menu_image",
            legacyField: "imageStorageId",
            targetField: "imageAssetId",
            storageId: ci.imageStorageId,
            currentAssetId: ci.imageAssetId,
            preferredFileName: ci.name ? `${ci.name}-image` : "customization-image",
          });
        }
      }
    }

    // 5. Scan organizationCarouselScreens table
    if (targetTable === "all" || targetTable === "organizationCarouselScreens") {
      const screens = await ctx.db.query("organizationCarouselScreens").collect();
      for (const screen of screens) {
        if (screen.deletedAt !== undefined) continue;
        if (!primaryOrgId) continue;

        if (screen.storageId) {
          candidates.push({
            table: "organizationCarouselScreens",
            recordId: screen._id,
            organizationId: primaryOrgId,
            assetType: "carousel_image",
            legacyField: "storageId",
            targetField: "assetId",
            storageId: screen.storageId,
            currentAssetId: screen.assetId,
            preferredFileName: screen.fileName || `carousel-screen-${screen.position || 1}`,
          });
        }
      }
    }

    // Apply limit / pagination if requested
    const limit = args.limit || candidates.length;
    const startIndex = args.cursor ? parseInt(args.cursor, 10) : 0;
    const paginated = candidates.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < candidates.length;
    const nextCursor = hasMore ? String(startIndex + limit) : null;

    return {
      candidates: paginated,
      hasMore,
      nextCursor,
    };
  },
});

/**
 * Internal query: Checks if an asset record exists with the given legacy storage ID.
 */
export const internalGetAssetByLegacyId = internalQuery({
  args: { legacyId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organization_assets")
      .withIndex("by_legacy_id", (q) => q.eq("legacyId", args.legacyId))
      .first();
  },
});

/**
 * Internal mutation: Persists migrated asset metadata and links the parent document's AssetId field.
 * Keeps the legacy Storage ID intact.
 */
export const internalRecordMigratedAsset = internalMutation({
  args: {
    table: v.string(),
    recordId: v.string(),
    targetField: v.string(),
    organizationId: v.id("organizations"),
    storageKey: v.string(),
    fileName: v.string(),
    contentType: v.string(),
    fileSize: v.number(),
    assetType: v.string(),
    legacyStorageId: v.string(),
    existingAssetId: v.optional(v.id("organization_assets")),
  },
  handler: async (ctx, args): Promise<Id<"organization_assets">> => {
    const now = Date.now();
    let assetId: Id<"organization_assets">;

    if (args.existingAssetId) {
      assetId = args.existingAssetId;
    } else {
      assetId = await ctx.db.insert("organization_assets", {
        organizationId: args.organizationId,
        storageKey: args.storageKey,
        fileName: args.fileName,
        contentType: args.contentType,
        fileSize: args.fileSize,
        assetType: args.assetType,
        status: "uploaded",
        legacyId: args.legacyStorageId,
        createdBy: "migration:convex_to_r2",
        createdAt: now,
        updatedAt: now,
      });
    }

    // Patch parent document with target AssetId
    switch (args.table) {
      case "organizations": {
        const orgId = args.recordId as Id<"organizations">;
        await ctx.db.patch(orgId, {
          [args.targetField]: assetId,
          updatedAt: now,
        });
        break;
      }
      case "items": {
        const itemId = args.recordId as Id<"items">;
        await ctx.db.patch(itemId, {
          [args.targetField]: assetId,
          updatedAt: now,
        });
        break;
      }
      case "customizationItems": {
        const ciId = args.recordId as Id<"customizationItems">;
        await ctx.db.patch(ciId, {
          [args.targetField]: assetId,
        });
        break;
      }
      case "organizationCarouselScreens": {
        const screenId = args.recordId as Id<"organizationCarouselScreens">;
        await ctx.db.patch(screenId, {
          [args.targetField]: assetId,
          updatedAt: now,
        });
        break;
      }
      default:
        throw new Error(`Unsupported table for migration patch: ${args.table}`);
    }

    return assetId;
  },
});
