"use node";

import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";
import { action } from "./_generated/server";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicDomain?: string;
  endpoint: string;
}

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
