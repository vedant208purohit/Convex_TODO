import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getR2Config,
  getR2Client,
  resetR2ClientCache,
  testConnection,
  generateUploadUrl,
  validateUploadRequest,
  sanitizeFileName,
  generateR2StorageKey,
} from "./r2";
import { uploadFileToR2 } from "../app/lib/r2Upload";
import { S3Client, HeadBucketCommand, HeadBucketCommandOutput, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async (client: S3Client, command: PutObjectCommand, options?: { expiresIn?: number }) => {
    return `https://presigned.r2.cloudflarestorage.com/${command.input.Bucket}/${command.input.Key}?expiresIn=${options?.expiresIn || 900}`;
  }),
}));

describe("Cloudflare R2 Client & Configuration Tests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
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

  describe("Upload Request Validation (validateUploadRequest)", () => {
    it("should allow valid asset types, MIME types, and file sizes within limits", () => {
      expect(() =>
        validateUploadRequest({
          assetType: "menu_image",
          fileName: "burger.png",
          contentType: "image/png",
          fileSize: 2 * 1024 * 1024, // 2MB <= 10MB limit
        })
      ).not.toThrow();

      expect(() =>
        validateUploadRequest({
          assetType: "invoice_pdf",
          fileName: "invoice-001.pdf",
          contentType: "application/pdf",
          fileSize: 15 * 1024 * 1024, // 15MB <= 25MB limit
        })
      ).not.toThrow();
    });

    it("should reject invalid or malicious asset types", () => {
      expect(() =>
        validateUploadRequest({
          assetType: "../../../etc",
          fileName: "test.jpg",
          contentType: "image/jpeg",
          fileSize: 1024,
        })
      ).toThrowError(/Invalid assetType/);
    });

    it("should reject unsupported MIME types", () => {
      expect(() =>
        validateUploadRequest({
          assetType: "general",
          fileName: "script.exe",
          contentType: "application/x-msdownload",
          fileSize: 1024,
        })
      ).toThrowError(/Unsupported contentType 'application\/x-msdownload'/);
    });

    it("should reject invalid file size values (<= 0 or NaN)", () => {
      expect(() =>
        validateUploadRequest({
          assetType: "logo",
          fileName: "logo.png",
          contentType: "image/png",
          fileSize: 0,
        })
      ).toThrowError(/Invalid fileSize/);

      expect(() =>
        validateUploadRequest({
          assetType: "logo",
          fileName: "logo.png",
          contentType: "image/png",
          fileSize: -500,
        })
      ).toThrowError(/Invalid fileSize/);
    });

    it("should enforce per-MIME-type maximum size limits", () => {
      // 12MB JPEG exceeds 10MB limit
      expect(() =>
        validateUploadRequest({
          assetType: "menu_image",
          fileName: "large.jpg",
          contentType: "image/jpeg",
          fileSize: 12 * 1024 * 1024,
        })
      ).toThrowError(/exceeds the maximum allowed size of 10.0MB/);

      // 30MB PDF exceeds 25MB limit
      expect(() =>
        validateUploadRequest({
          assetType: "menu_pdf",
          fileName: "huge-menu.pdf",
          contentType: "application/pdf",
          fileSize: 30 * 1024 * 1024,
        })
      ).toThrowError(/exceeds the maximum allowed size of 25.0MB/);
    });
  });

  describe("Filename Sanitization & Key Generation", () => {
    it("should remove directory traversal sequences (../, absolute paths) and control chars", () => {
      const { baseName, ext } = sanitizeFileName("../../secret/menu.pdf", "pdf");
      expect(baseName).toBe("secret_menu");
      expect(ext).toBe("pdf");
      expect(baseName).not.toContain("..");
      expect(baseName).not.toContain("/");
    });

    it("should fallback to default extension if raw filename has none", () => {
      const { baseName, ext } = sanitizeFileName("uploaded-file", "png");
      expect(baseName).toBe("uploaded-file");
      expect(ext).toBe("png");
    });

    it("should fallback to generic base name if filename contains only illegal characters", () => {
      const { baseName, ext } = sanitizeFileName("../...///", "jpg");
      expect(baseName).toBe("asset");
      expect(ext).toBe("jpg");
    });

    it("should construct a strictly scoped R2 key: organizations/<orgId>/<assetType>/<timestamp>-<randomId>-<baseName>.<ext>", () => {
      const key = generateR2StorageKey("org_test_123", "menu_image", "pizza-margherita.png", "image/png");
      expect(key).toMatch(/^organizations\/org_test_123\/menu_image\/\d+-[a-z0-9]+-pizza-margherita\.png$/);
    });

    it("should prevent cross-tenant key pollution by stripping invalid characters from organizationId", () => {
      const key = generateR2StorageKey("../org_456/../", "logo", "store.jpg", "image/jpeg");
      expect(key).toMatch(/^organizations\/org_456\/logo\/\d+-[a-z0-9]+-store\.jpg$/);
      expect(key).not.toContain("../");
    });

    it("should generate distinct unique keys for consecutive calls with the same input", () => {
      const key1 = generateR2StorageKey("org_1", "logo", "logo.png", "image/png");
      const key2 = generateR2StorageKey("org_1", "logo", "logo.png", "image/png");
      expect(key1).not.toBe(key2);
    });
  });

  describe("Phase 1 Connectivity Action (testConnection)", () => {
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

  describe("Phase 2 Presigned Upload URL Action (generateUploadUrl)", () => {
    type GenerateUploadHandler = {
      _handler: (
        ctx: { auth: { getUserIdentity: () => Promise<{ subject: string; name?: string } | null> }; runQuery: (query: unknown) => Promise<unknown> },
        args: { assetType: string; fileName: string; contentType: string; fileSize: number; organizationId?: string }
      ) => Promise<{ uploadUrl: string; storageKey: string; expiresAt: number; contentType: string }>;
    };

    it("should reject unauthenticated requests", async () => {
      const handler = (generateUploadUrl as unknown as GenerateUploadHandler)._handler;
      const mockCtx = {
        auth: { getUserIdentity: async () => null },
        runQuery: async () => [{ _id: "org_123" }],
      };

      await expect(
        handler(mockCtx, {
          assetType: "menu_image",
          fileName: "test.png",
          contentType: "image/png",
          fileSize: 1024,
        })
      ).rejects.toThrowError(/Unauthenticated: A valid Clerk session is required/);
    });

    it("should resolve store organization and return a valid presigned PUT URL and storageKey", async () => {
      process.env.R2_ACCOUNT_ID = "abc123def456";
      process.env.R2_ACCESS_KEY_ID = "key_id_123";
      process.env.R2_SECRET_ACCESS_KEY = "secret_key_456";
      process.env.R2_BUCKET_NAME = "pos-assets";

      const handler = (generateUploadUrl as unknown as GenerateUploadHandler)._handler;
      const mockCtx = {
        auth: { getUserIdentity: async () => ({ subject: "user_clerk_123" }) },
        runQuery: async () => [{ _id: "org_auto_123" }],
      };

      const result = await handler(mockCtx, {
        assetType: "menu_image",
        fileName: "burger.png",
        contentType: "image/png",
        fileSize: 2048,
      });

      expect(result.uploadUrl).toContain("https://presigned.r2.cloudflarestorage.com/pos-assets/");
      expect(result.storageKey).toMatch(/^organizations\/org_auto_123\/menu_image\/\d+-[a-z0-9]+-burger\.png$/);
      expect(result.contentType).toBe("image/png");
      expect(result.expiresAt).toBeGreaterThan(Date.now());
      expect(vi.mocked(getSignedUrl)).toHaveBeenCalledTimes(1);
    });

    it("should use explicit organizationId when provided", async () => {
      process.env.R2_ACCOUNT_ID = "abc123def456";
      process.env.R2_ACCESS_KEY_ID = "key_id_123";
      process.env.R2_SECRET_ACCESS_KEY = "secret_key_456";
      process.env.R2_BUCKET_NAME = "pos-assets";

      const handler = (generateUploadUrl as unknown as GenerateUploadHandler)._handler;
      const mockCtx = {
        auth: { getUserIdentity: async () => ({ subject: "user_clerk_123" }) },
        runQuery: async () => [{ _id: "org_default" }],
      };

      const result = await handler(mockCtx, {
        assetType: "invoice_pdf",
        fileName: "inv.pdf",
        contentType: "application/pdf",
        fileSize: 5000,
        organizationId: "org_custom_999",
      });

      expect(result.storageKey).toContain("organizations/org_custom_999/invoice_pdf/");
    });

    it("should throw when store organization cannot be resolved and no organizationId is provided", async () => {
      process.env.R2_ACCOUNT_ID = "abc123def456";
      process.env.R2_ACCESS_KEY_ID = "key_id_123";
      process.env.R2_SECRET_ACCESS_KEY = "secret_key_456";
      process.env.R2_BUCKET_NAME = "pos-assets";

      const handler = (generateUploadUrl as unknown as GenerateUploadHandler)._handler;
      const mockCtx = {
        auth: { getUserIdentity: async () => ({ subject: "user_clerk_123" }) },
        runQuery: async () => [], // No orgs found
      };

      await expect(
        handler(mockCtx, {
          assetType: "logo",
          fileName: "logo.png",
          contentType: "image/png",
          fileSize: 1024,
        })
      ).rejects.toThrowError(/Organization not found/);
    });
  });

  describe("Frontend Upload Utility (uploadFileToR2)", () => {
    it("should throw if no file is provided", async () => {
      await expect(
        uploadFileToR2({
          file: null as unknown as File,
          assetType: "logo",
          generateUploadUrlAction: vi.fn(),
        })
      ).rejects.toThrowError(/No file provided/);
    });

    it("should perform direct HTTP PUT upload to R2 and return the storage key", async () => {
      const mockFile = new File(["dummy binary content"], "test-logo.png", { type: "image/png" });
      const mockAction = vi.fn().mockResolvedValue({
        uploadUrl: "https://presigned.r2.cloudflarestorage.com/upload-target",
        storageKey: "organizations/org_1/logo/123-test-logo.png",
        expiresAt: Date.now() + 900000,
        contentType: "image/png",
      });

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
      } as Response);

      const result = await uploadFileToR2({
        file: mockFile,
        assetType: "logo",
        generateUploadUrlAction: mockAction,
        organizationId: "org_1",
      });

      expect(mockAction).toHaveBeenCalledWith({
        assetType: "logo",
        fileName: "test-logo.png",
        contentType: "image/png",
        fileSize: mockFile.size,
        organizationId: "org_1",
      });

      expect(fetchSpy).toHaveBeenCalledWith("https://presigned.r2.cloudflarestorage.com/upload-target", {
        method: "PUT",
        headers: {
          "Content-Type": "image/png",
        },
        body: mockFile,
      });

      expect(result.storageKey).toBe("organizations/org_1/logo/123-test-logo.png");
    });

    it("should throw descriptive error when PUT upload request fails", async () => {
      const mockFile = new File(["sample"], "bad.pdf", { type: "application/pdf" });
      const mockAction = vi.fn().mockResolvedValue({
        uploadUrl: "https://presigned.r2.cloudflarestorage.com/upload-target",
        storageKey: "organizations/org_1/invoice_pdf/123-bad.pdf",
        expiresAt: Date.now() + 900000,
        contentType: "application/pdf",
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      } as Response);

      await expect(
        uploadFileToR2({
          file: mockFile,
          assetType: "invoice_pdf",
          generateUploadUrlAction: mockAction,
        })
      ).rejects.toThrowError(/Failed to upload file to storage: 403 Forbidden/);
    });
  });
});
