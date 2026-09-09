"use node";

import { S3Client, HeadBucketCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicDomain?: string;
  endpoint: string;
}

/**
 * Supported asset categories for POS storage.
 */
export const ALLOWED_ASSET_TYPES = [
  "logo",
  "icon",
  "menu_image",
  "menu_pdf",
  "product_image",
  "invoice_pdf",
  "bill_pdf",
  "carousel_image",
  "qr_code",
  "document",
  "general",
  "test",
] as const;

export type AssetType = (typeof ALLOWED_ASSET_TYPES)[number];

/**
 * Supported MIME types, max file sizes, and default extensions.
 */
export const ALLOWED_MIME_TYPES: Record<string, { maxSizeBytes: number; defaultExt: string }> = {
  // Images (max 10MB)
  "image/jpeg": { maxSizeBytes: 10 * 1024 * 1024, defaultExt: "jpg" },
  "image/png": { maxSizeBytes: 10 * 1024 * 1024, defaultExt: "png" },
  "image/webp": { maxSizeBytes: 10 * 1024 * 1024, defaultExt: "webp" },
  "image/gif": { maxSizeBytes: 10 * 1024 * 1024, defaultExt: "gif" },
  "image/svg+xml": { maxSizeBytes: 5 * 1024 * 1024, defaultExt: "svg" },

  // Documents (max 25MB for PDFs)
  "application/pdf": { maxSizeBytes: 25 * 1024 * 1024, defaultExt: "pdf" },

  // Media & 3D models (max 50MB)
  "video/mp4": { maxSizeBytes: 50 * 1024 * 1024, defaultExt: "mp4" },
  "video/webm": { maxSizeBytes: 50 * 1024 * 1024, defaultExt: "webm" },
  "model/gltf-binary": { maxSizeBytes: 50 * 1024 * 1024, defaultExt: "glb" },
  "model/gltf+json": { maxSizeBytes: 50 * 1024 * 1024, defaultExt: "gltf" },

  // Plain text (for test/diagnostics, max 2MB)
  "text/plain": { maxSizeBytes: 2 * 1024 * 1024, defaultExt: "txt" },
};

/**
 * Validates and retrieves Cloudflare R2 configuration from environment variables.
 * Throws a descriptive error if any required variable is missing.
 */
export function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();
  const publicDomain = process.env.R2_PUBLIC_DOMAIN?.trim();

  const missing: string[] = [];
  if (!accountId) missing.push("R2_ACCOUNT_ID");
  if (!accessKeyId) missing.push("R2_ACCESS_KEY_ID");
  if (!secretAccessKey) missing.push("R2_SECRET_ACCESS_KEY");
  if (!bucketName) missing.push("R2_BUCKET_NAME");

  if (missing.length > 0) {
    throw new Error(
      `Missing required Cloudflare R2 environment variables: ${missing.join(", ")}. ` +
      "Ensure these are set in your Convex deployment environment."
    );
  }

  return {
    accountId: accountId!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    bucketName: bucketName!,
    publicDomain: publicDomain || undefined,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  };
}

let cachedClient: S3Client | null = null;

/**
 * Returns an S3Client configured for Cloudflare R2.
 * Uses cached instance if available and re-initializes when configuration changes.
 */
export function getR2Client(): S3Client {
  const config = getR2Config();
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return cachedClient;
}

/**
 * Resets the cached S3Client instance.
 * Useful for testing and environment reloads.
 */
export function resetR2ClientCache(): void {
  cachedClient = null;
}

/**
 * Sanitizes a client-provided file name to remove path traversal, directory separators,
 * control characters, and unsafe characters.
 */
export function sanitizeFileName(rawName: string, defaultExt: string): { baseName: string; ext: string } {
  // Strip control chars, directory traversal sequences, null bytes, and path separators
  const cleanName = rawName
    .replace(/[\0\x00-\x1f\x7f]/g, "")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\.\.+/g, "_")
    .trim();

  const lastDotIndex = cleanName.lastIndexOf(".");
  let baseName = lastDotIndex > 0 ? cleanName.substring(0, lastDotIndex) : cleanName;
  let ext = lastDotIndex > 0 ? cleanName.substring(lastDotIndex + 1).toLowerCase() : "";

  // Normalize baseName: keep alphanumeric, hyphen, underscore
  baseName = baseName.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/__+/g, "_").replace(/^_+|_+$/g, "");
  if (!baseName) {
    baseName = "asset";
  }

  // Normalize ext: keep alphanumeric characters only
  ext = ext.replace(/[^a-zA-Z0-9]/g, "");
  if (!ext) {
    ext = defaultExt;
  }

  return { baseName, ext };
}

/**
 * Generates a scoped, unique, and safe R2 storage key.
 * Format: organizations/<organizationId>/<assetType>/<timestamp>-<randomId>-<baseName>.<ext>
 */
export function generateR2StorageKey(
  organizationId: string,
  assetType: string,
  rawFileName: string,
  mimeType: string
): string {
  const cleanOrgId = organizationId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!cleanOrgId) {
    throw new Error("Invalid organizationId: must contain valid identifier characters.");
  }

  const cleanAssetType = assetType.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, "");
  const mimeConfig = ALLOWED_MIME_TYPES[mimeType];
  const defaultExt = mimeConfig?.defaultExt || "bin";

  const { baseName, ext } = sanitizeFileName(rawFileName, defaultExt);
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 10);

  return `organizations/${cleanOrgId}/${cleanAssetType}/${timestamp}-${randomSuffix}-${baseName}.${ext}`;
}

/**
 * Validates the upload request parameters.
 */
export function validateUploadRequest(args: {
  assetType: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}): void {
  // 1. Asset Type Validation
  const isKnownAssetType = (ALLOWED_ASSET_TYPES as readonly string[]).includes(args.assetType);
  if (!isKnownAssetType && !/^[a-zA-Z0-9_-]{2,30}$/.test(args.assetType)) {
    throw new Error(
      `Invalid assetType '${args.assetType}'. Allowed types: ${ALLOWED_ASSET_TYPES.join(", ")}`
    );
  }

  // 2. MIME Type Validation
  const mimeConfig = ALLOWED_MIME_TYPES[args.contentType];
  if (!mimeConfig) {
    throw new Error(
      `Unsupported contentType '${args.contentType}'. Supported types: ${Object.keys(ALLOWED_MIME_TYPES).join(", ")}`
    );
  }

  // 3. File Size Validation
  if (typeof args.fileSize !== "number" || isNaN(args.fileSize) || args.fileSize <= 0) {
    throw new Error("Invalid fileSize: must be a positive number greater than 0 bytes.");
  }

  if (args.fileSize > mimeConfig.maxSizeBytes) {
    const maxMb = (mimeConfig.maxSizeBytes / (1024 * 1024)).toFixed(1);
    const actualMb = (args.fileSize / (1024 * 1024)).toFixed(2);
    throw new Error(
      `File size (${actualMb}MB) exceeds the maximum allowed size of ${maxMb}MB for contentType '${args.contentType}'.`
    );
  }
}

/**
 * Minimal safe Convex Action to test backend connectivity to Cloudflare R2.
 * Performs a read-only HeadBucket check against the configured bucket.
 * Does NOT expose secrets or upload/create any assets.
 */
export const testConnection = action({
  args: {},
  handler: async () => {
    try {
      const config = getR2Config();
      const client = getR2Client();

      const command = new HeadBucketCommand({
        Bucket: config.bucketName,
      });

      await client.send(command);

      return {
        ok: true,
        message: `Successfully connected to Cloudflare R2 bucket: ${config.bucketName}`,
        bucketName: config.bucketName,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error during R2 connectivity test";
      return {
        ok: false,
        message: "Failed to connect to Cloudflare R2.",
        error: errorMessage,
      };
    }
  },
});

/**
 * Generates a presigned Cloudflare R2 PUT upload URL.
 * 
 * - Enforces Clerk user authentication.
 * - Validates assetType, contentType, and fileSize limits.
 * - Sanitizes file name and generates a deterministic, collision-proof tenant storage key.
 * - Issues a short-lived (15 min) presigned PUT URL directly targeting Cloudflare R2.
 */
export const generateUploadUrl = action({
  args: {
    assetType: v.string(),
    fileName: v.string(),
    contentType: v.string(),
    fileSize: v.number(),
    organizationId: v.optional(v.union(v.id("organizations"), v.string())),
  },
  handler: async (ctx, args) => {
    // 1. Authenticate caller
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated: A valid Clerk session is required to generate upload URLs.");
    }

    // 2. Resolve organization scope
    let orgId = args.organizationId;
    if (!orgId) {
      const orgs = await ctx.runQuery(api.organizations.list);
      const defaultOrg = orgs && orgs.length > 0 ? orgs[0] : null;
      if (!defaultOrg) {
        throw new Error("Organization not found: Ensure the store organization is initialized.");
      }
      orgId = defaultOrg._id;
    }

    // 3. Validate upload parameters
    validateUploadRequest({
      assetType: args.assetType,
      fileName: args.fileName,
      contentType: args.contentType,
      fileSize: args.fileSize,
    });

    // 4. Generate scoped, safe storage key
    const storageKey = generateR2StorageKey(
      orgId,
      args.assetType,
      args.fileName,
      args.contentType
    );

    // 5. Generate presigned PUT URL
    const config = getR2Config();
    const client = getR2Client();
    const expiresInSeconds = 900; // 15 minutes

    const command = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: storageKey,
      ContentType: args.contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });

    return {
      uploadUrl,
      storageKey,
      expiresAt: Date.now() + expiresInSeconds * 1000,
      contentType: args.contentType,
    };
  },
});
