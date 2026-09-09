"use node";

import { PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import {
  getR2Config,
  getR2Client,
  generateR2StorageKey,
  sanitizeFileName,
  ALLOWED_MIME_TYPES,
} from "./r2";
import { MigrationCandidate } from "./migrateStorageToR2Db";

// -----------------------------------------------------------------------------
// TYPES & INTERFACES
// -----------------------------------------------------------------------------

export interface MigrationItemResult {
  table: string;
  recordId: string;
  organizationId: string;
  assetType: string;
  legacyField: string;
  targetField: string;
  storageId: string;
  assetId?: string;
  storageKey?: string;
  fileName?: string;
  fileSize?: number;
  contentType?: string;
  status: "migrated" | "already_migrated" | "skipped" | "failed" | "dry_run_candidate";
  reason?: string;
}

export interface MigrationSummaryReport {
  dryRun: boolean;
  totalCandidates: number;
  successfullyMigrated: number;
  alreadyMigrated: number;
  skipped: number;
  failed: number;
  missingStorageObjects: number;
  oversizedFiles: number;
  invalidMetadata: number;
  items: MigrationItemResult[];
  nextCursor?: string | null;
  hasMore: boolean;
}

// -----------------------------------------------------------------------------
// ASSET TYPE MAPPINGS & HELPERS
// -----------------------------------------------------------------------------

/**
 * Derives a deterministic fallback MIME type based on the asset category.
 */
export function getFallbackContentType(assetType: string): string {
  switch (assetType) {
    case "logo":
      return "image/png";
    case "document":
      return "application/pdf";
    case "menu_image":
      return "image/jpeg";
    case "menu_3d_model":
      return "model/gltf-binary";
    case "menu_3d_model_ios":
      return "model/gltf-binary";
    case "menu_video":
      return "video/mp4";
    case "carousel_image":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}

/**
 * Validates whether the given file size conforms to R2 bounds for the given content type.
 */
export function validateFileSize(fileSize: number, contentType: string): { valid: boolean; maxAllowed: number; reason?: string } {
  const mimeConfig = ALLOWED_MIME_TYPES[contentType];
  const maxAllowed = mimeConfig?.maxSizeBytes || 50 * 1024 * 1024; // Default 50MB ceiling

  if (fileSize <= 0) {
    return { valid: false, maxAllowed, reason: "File size must be greater than 0 bytes." };
  }

  if (fileSize > maxAllowed) {
    const maxMb = (maxAllowed / (1024 * 1024)).toFixed(1);
    const actualMb = (fileSize / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      maxAllowed,
      reason: `File size (${actualMb}MB) exceeds the maximum allowed limit of ${maxMb}MB for '${contentType}'.`,
    };
  }

  return { valid: true, maxAllowed };
}

// -----------------------------------------------------------------------------
// CORE MIGRATION ACTION
// -----------------------------------------------------------------------------

/**
 * Executes server-side migration of Convex Storage binaries to Cloudflare R2.
 * Supports dry-run inspection, batching, pagination, idempotency, and failure isolation.
 */
export const migrateStorageToR2 = action({
  args: {
    dryRun: v.optional(v.boolean()),
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
  handler: async (ctx, args): Promise<MigrationSummaryReport> => {
    const isDryRun = args.dryRun === true;

    // 1. Fetch candidate records from database
    const { candidates, hasMore, nextCursor }: { candidates: MigrationCandidate[]; hasMore: boolean; nextCursor: string | null } = await ctx.runQuery(
      internal.migrateStorageToR2Db.internalListCandidates,
      {
        table: args.table,
        limit: args.limit,
        cursor: args.cursor,
      }
    );

    const report: MigrationSummaryReport = {
      dryRun: isDryRun,
      totalCandidates: candidates.length,
      successfullyMigrated: 0,
      alreadyMigrated: 0,
      skipped: 0,
      failed: 0,
      missingStorageObjects: 0,
      oversizedFiles: 0,
      invalidMetadata: 0,
      items: [],
      nextCursor,
      hasMore,
    };

    if (candidates.length === 0) {
      return report;
    }

    const config = getR2Config();
    const client = getR2Client();

    // 2. Process each candidate
    for (const candidate of candidates) {
      const storageIdStr = String(candidate.storageId);

      // A. Check if parent record already has target Asset ID
      if (candidate.currentAssetId) {
        const existingAsset: Doc<"organization_assets"> | null = await ctx.runQuery(
          internal.organizationAssets.internalGet,
          { id: candidate.currentAssetId }
        );

        if (existingAsset && existingAsset.status === "uploaded") {
          report.alreadyMigrated++;
          report.items.push({
            table: candidate.table,
            recordId: candidate.recordId,
            organizationId: String(candidate.organizationId),
            assetType: candidate.assetType,
            legacyField: candidate.legacyField,
            targetField: candidate.targetField,
            storageId: storageIdStr,
            assetId: existingAsset._id,
            storageKey: existingAsset.storageKey,
            fileName: existingAsset.fileName,
            fileSize: existingAsset.fileSize,
            contentType: existingAsset.contentType,
            status: "already_migrated",
            reason: "Parent record already references verified uploaded asset.",
          });
          continue;
        }
      }

      // B. Check if organization_assets already has this legacy storageId indexed
      const indexedAsset: Doc<"organization_assets"> | null = await ctx.runQuery(
        internal.migrateStorageToR2Db.internalGetAssetByLegacyId,
        { legacyId: storageIdStr }
      );

      if (indexedAsset && indexedAsset.status === "uploaded") {
        if (!isDryRun) {
          // Reconcile parent link with existing verified asset
          await ctx.runMutation(internal.migrateStorageToR2Db.internalRecordMigratedAsset, {
            table: candidate.table,
            recordId: candidate.recordId,
            targetField: candidate.targetField,
            organizationId: candidate.organizationId,
            storageKey: indexedAsset.storageKey,
            fileName: indexedAsset.fileName,
            contentType: indexedAsset.contentType,
            fileSize: indexedAsset.fileSize,
            assetType: indexedAsset.assetType,
            legacyStorageId: storageIdStr,
            existingAssetId: indexedAsset._id,
          });
        }

        report.alreadyMigrated++;
        report.items.push({
          table: candidate.table,
          recordId: candidate.recordId,
          organizationId: String(candidate.organizationId),
          assetType: candidate.assetType,
          legacyField: candidate.legacyField,
          targetField: candidate.targetField,
          storageId: storageIdStr,
          assetId: indexedAsset._id,
          storageKey: indexedAsset.storageKey,
          fileName: indexedAsset.fileName,
          fileSize: indexedAsset.fileSize,
          contentType: indexedAsset.contentType,
          status: "already_migrated",
          reason: "Existing R2 asset found by legacyId and reconciled.",
        });
        continue;
      }

      // C. Read binary and metadata from Convex Storage
      let blob: Blob | null = null;
      try {
        blob = await ctx.storage.get(candidate.storageId);
      } catch (err: unknown) {
        report.failed++;
        report.missingStorageObjects++;
        report.items.push({
          table: candidate.table,
          recordId: candidate.recordId,
          organizationId: String(candidate.organizationId),
          assetType: candidate.assetType,
          legacyField: candidate.legacyField,
          targetField: candidate.targetField,
          storageId: storageIdStr,
          status: "failed",
          reason: `Failed to read Convex Storage binary: ${err instanceof Error ? err.message : String(err)}`,
        });
        continue;
      }

      if (!blob) {
        report.failed++;
        report.missingStorageObjects++;
        report.items.push({
          table: candidate.table,
          recordId: candidate.recordId,
          organizationId: String(candidate.organizationId),
          assetType: candidate.assetType,
          legacyField: candidate.legacyField,
          targetField: candidate.targetField,
          storageId: storageIdStr,
          status: "failed",
          reason: "Convex Storage object not found (null binary).",
        });
        continue;
      }

      // D. Determine metadata (file size, content type, safe file name)
      const metadata = await ctx.storage.getMetadata(candidate.storageId);
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileSize = buffer.length || blob.size || metadata?.size || 0;

      let contentType = metadata?.contentType || blob.type || "";
      if (!contentType || contentType === "application/octet-stream" || !ALLOWED_MIME_TYPES[contentType]) {
        const fallback = getFallbackContentType(candidate.assetType);
        contentType = ALLOWED_MIME_TYPES[contentType] ? contentType : fallback;
      }

      // E. Validate file size against R2 limits
      const sizeValidation = validateFileSize(fileSize, contentType);
      if (!sizeValidation.valid) {
        report.failed++;
        report.oversizedFiles++;
        report.items.push({
          table: candidate.table,
          recordId: candidate.recordId,
          organizationId: String(candidate.organizationId),
          assetType: candidate.assetType,
          legacyField: candidate.legacyField,
          targetField: candidate.targetField,
          storageId: storageIdStr,
          fileSize,
          contentType,
          status: "failed",
          reason: sizeValidation.reason,
        });
        continue;
      }

      const defaultExt = ALLOWED_MIME_TYPES[contentType]?.defaultExt || "bin";
      const { baseName, ext } = sanitizeFileName(candidate.preferredFileName || candidate.assetType, defaultExt);
      const fileName = `${baseName}.${ext}`;

      // F. If DRY RUN, record candidate and skip physical writes
      if (isDryRun) {
        report.successfullyMigrated++;
        report.items.push({
          table: candidate.table,
          recordId: candidate.recordId,
          organizationId: String(candidate.organizationId),
          assetType: candidate.assetType,
          legacyField: candidate.legacyField,
          targetField: candidate.targetField,
          storageId: storageIdStr,
          fileName,
          fileSize,
          contentType,
          status: "dry_run_candidate",
          reason: "Candidate validated and ready for migration.",
        });
        continue;
      }

      // G. REAL MIGRATION: Upload to R2 -> Verify via HeadObject -> Save metadata -> Patch parent
      try {
        const storageKey = generateR2StorageKey(
          String(candidate.organizationId),
          candidate.assetType,
          fileName,
          contentType
        );

        // 1. Upload binary to Cloudflare R2
        await client.send(
          new PutObjectCommand({
            Bucket: config.bucketName,
            Key: storageKey,
            Body: buffer,
            ContentType: contentType,
            ContentLength: fileSize,
          })
        );

        // 2. Verify R2 object existence via HeadObject
        await client.send(
          new HeadObjectCommand({
            Bucket: config.bucketName,
            Key: storageKey,
          })
        );

        // 3. Create organization_assets record and link parent document
        const newAssetId = await ctx.runMutation(
          internal.migrateStorageToR2Db.internalRecordMigratedAsset,
          {
            table: candidate.table,
            recordId: candidate.recordId,
            targetField: candidate.targetField,
            organizationId: candidate.organizationId,
            storageKey,
            fileName,
            contentType,
            fileSize,
            assetType: candidate.assetType,
            legacyStorageId: storageIdStr,
          }
        );

        report.successfullyMigrated++;
        report.items.push({
          table: candidate.table,
          recordId: candidate.recordId,
          organizationId: String(candidate.organizationId),
          assetType: candidate.assetType,
          legacyField: candidate.legacyField,
          targetField: candidate.targetField,
          storageId: storageIdStr,
          assetId: newAssetId,
          storageKey,
          fileName,
          fileSize,
          contentType,
          status: "migrated",
          reason: "Successfully migrated to R2, verified, and linked to parent record.",
        });
      } catch (uploadErr: unknown) {
        report.failed++;
        report.items.push({
          table: candidate.table,
          recordId: candidate.recordId,
          organizationId: String(candidate.organizationId),
          assetType: candidate.assetType,
          legacyField: candidate.legacyField,
          targetField: candidate.targetField,
          storageId: storageIdStr,
          fileSize,
          contentType,
          status: "failed",
          reason: `R2 migration error: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`,
        });
      }
    }

    return report;
  },
});
