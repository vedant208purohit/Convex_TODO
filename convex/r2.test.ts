import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getR2Config, getR2Client, resetR2ClientCache, testConnection } from "./r2";
import { S3Client, HeadBucketCommand, HeadBucketCommandOutput } from "@aws-sdk/client-s3";

describe("Cloudflare R2 Client & Configuration Tests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    resetR2ClientCache();
    // Clear R2 env vars
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.R2_PUBLIC_DOMAIN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetR2ClientCache();
  });

  describe("Configuration Validation (getR2Config)", () => {
    it("should throw a descriptive error when all R2 environment variables are missing", () => {
      expect(() => getR2Config()).toThrowError(
        /Missing required Cloudflare R2 environment variables: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME/
      );
    });

    it("should throw when only some R2 environment variables are missing", () => {
      process.env.R2_ACCOUNT_ID = "test-account-id";
      process.env.R2_BUCKET_NAME = "pos-assets";

      expect(() => getR2Config()).toThrowError(
        /Missing required Cloudflare R2 environment variables: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY/
      );
    });

    it("should correctly construct R2 configuration and endpoint URL when all variables are valid", () => {
      process.env.R2_ACCOUNT_ID = "abc123def456";
      process.env.R2_ACCESS_KEY_ID = "key_id_123";
      process.env.R2_SECRET_ACCESS_KEY = "secret_key_456";
      process.env.R2_BUCKET_NAME = "pos-default-bucket";
      process.env.R2_PUBLIC_DOMAIN = "https://cdn.example.com";

      const config = getR2Config();

      expect(config.accountId).toBe("abc123def456");
      expect(config.accessKeyId).toBe("key_id_123");
      expect(config.secretAccessKey).toBe("secret_key_456");
      expect(config.bucketName).toBe("pos-default-bucket");
      expect(config.publicDomain).toBe("https://cdn.example.com");
      expect(config.endpoint).toBe("https://abc123def456.r2.cloudflarestorage.com");
    });

    it("should trim whitespace from environment variable values", () => {
      process.env.R2_ACCOUNT_ID = "  abc123def456  ";
      process.env.R2_ACCESS_KEY_ID = "  key_id_123 ";
      process.env.R2_SECRET_ACCESS_KEY = " secret_key_456  ";
      process.env.R2_BUCKET_NAME = " pos-default-bucket ";

      const config = getR2Config();

      expect(config.accountId).toBe("abc123def456");
      expect(config.accessKeyId).toBe("key_id_123");
      expect(config.secretAccessKey).toBe("secret_key_456");
      expect(config.bucketName).toBe("pos-default-bucket");
      expect(config.endpoint).toBe("https://abc123def456.r2.cloudflarestorage.com");
    });
  });

  describe("S3Client Factory (getR2Client)", () => {
    it("should instantiate an S3Client with auto region and R2 endpoint", () => {
      process.env.R2_ACCOUNT_ID = "abc123def456";
      process.env.R2_ACCESS_KEY_ID = "key_id_123";
      process.env.R2_SECRET_ACCESS_KEY = "secret_key_456";
      process.env.R2_BUCKET_NAME = "pos-default-bucket";

      const client = getR2Client();
      expect(client).toBeInstanceOf(S3Client);
    });

    it("should cache and reuse the client instance until cache is reset", () => {
      process.env.R2_ACCOUNT_ID = "abc123def456";
      process.env.R2_ACCESS_KEY_ID = "key_id_123";
      process.env.R2_SECRET_ACCESS_KEY = "secret_key_456";
      process.env.R2_BUCKET_NAME = "pos-default-bucket";

      const client1 = getR2Client();
      const client2 = getR2Client();
      expect(client1).toBe(client2);

      resetR2ClientCache();
      const client3 = getR2Client();
      expect(client3).not.toBe(client1);
    });
  });

  describe("Connectivity Verification Action (testConnection)", () => {
    type TestActionHandler = { _handler: (ctx: Record<string, unknown>, args?: Record<string, unknown>) => Promise<{ ok: boolean; message: string; bucketName?: string; error?: string }> };

    it("should return ok: false if R2 environment variables are not configured", async () => {
      const handler = (testConnection as unknown as TestActionHandler)._handler;
      const result = await handler({});

      expect(result.ok).toBe(false);
      expect(result.message).toBe("Failed to connect to Cloudflare R2.");
      expect(result.error).toContain("Missing required Cloudflare R2 environment variables");
    });

    it("should return ok: true when HeadBucketCommand succeeds", async () => {
      process.env.R2_ACCOUNT_ID = "abc123def456";
      process.env.R2_ACCESS_KEY_ID = "key_id_123";
      process.env.R2_SECRET_ACCESS_KEY = "secret_key_456";
      process.env.R2_BUCKET_NAME = "pos-default-bucket";

      const sendMock = vi.spyOn(S3Client.prototype, "send").mockImplementation(async (command) => {
        expect(command).toBeInstanceOf(HeadBucketCommand);
        expect((command as HeadBucketCommand).input.Bucket).toBe("pos-default-bucket");
        return {} as HeadBucketCommandOutput;
      });

      const handler = (testConnection as unknown as TestActionHandler)._handler;
      const result = await handler({});

      expect(result.ok).toBe(true);
      expect(result.bucketName).toBe("pos-default-bucket");
      expect(result.message).toContain("Successfully connected to Cloudflare R2 bucket: pos-default-bucket");
      expect(sendMock).toHaveBeenCalledTimes(1);
    });

    it("should return ok: false with error details when HeadBucketCommand fails", async () => {
      process.env.R2_ACCOUNT_ID = "abc123def456";
      process.env.R2_ACCESS_KEY_ID = "key_id_123";
      process.env.R2_SECRET_ACCESS_KEY = "secret_key_456";
      process.env.R2_BUCKET_NAME = "pos-default-bucket";

      vi.spyOn(S3Client.prototype, "send").mockRejectedValue(new Error("403 Forbidden: Invalid Access Key"));

      const handler = (testConnection as unknown as TestActionHandler)._handler;
      const result = await handler({});

      expect(result.ok).toBe(false);
      expect(result.message).toBe("Failed to connect to Cloudflare R2.");
      expect(result.error).toBe("403 Forbidden: Invalid Access Key");
    });
  });
});
