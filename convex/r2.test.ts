import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getR2Config,
  resetR2ClientCache,
  createAssetUpload,
  confirmAssetUpload,
  getAssetDownloadUrl,
  deleteAsset,
  validateUploadRequest,
  sanitizeFileName,
  generateR2StorageKey,
} from "./r2";
import { S3Client, PutObjectCommand, HeadObjectCommand, HeadObjectCommandOutput, DeleteObjectCommand, DeleteObjectCommandOutput } from "@aws-sdk/client-s3";
import { Id } from "./_generated/dataModel";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async (_client: S3Client, command: PutObjectCommand, options?: { expiresIn?: number }) => {
    return `https://presigned.r2.cloudflarestorage.com/${command.input.Bucket}/${command.input.Key}?expiresIn=${options?.expiresIn || 900}`;
  }),
}));

describe("Cloudflare R2 Client, Validation & Phase 3 Confirmation Tests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    resetR2ClientCache();
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

  describe("1. Configuration Validation (getR2Config)", () => {
    it("should throw a descriptive error when required R2 environment variables are missing", () => {
      expect(() => getR2Config()).toThrowError(
        /Missing required Cloudflare R2 environment variables/
      );
    });

    it("should construct configuration properly when variables are valid", () => {
      process.env.R2_ACCOUNT_ID = "acc_123";
      process.env.R2_ACCESS_KEY_ID = "key_123";
      process.env.R2_SECRET_ACCESS_KEY = "sec_123";
      process.env.R2_BUCKET_NAME = "pos-assets";

      const config = getR2Config();
      expect(config.accountId).toBe("acc_123");
      expect(config.endpoint).toBe("https://acc_123.r2.cloudflarestorage.com");
    });
  });

  describe("2. Upload Request Validation", () => {
    it("should reject invalid assetType", () => {
      expect(() =>
        validateUploadRequest({
          assetType: "../../../etc",
          fileName: "test.jpg",
          contentType: "image/jpeg",
          fileSize: 1024,
        })
      ).toThrowError(/Invalid assetType/);
    });

    it("should reject unsupported MIME type", () => {
      expect(() =>
        validateUploadRequest({
          assetType: "menu_image",
          fileName: "script.sh",
          contentType: "application/x-sh",
          fileSize: 1024,
        })
      ).toThrowError(/Unsupported contentType/);
    });

    it("should accept all Phase 4 asset types", () => {
      const types = [
        { type: "logo", mime: "image/png" },
        { type: "document", mime: "application/pdf" },
        { type: "carousel_image", mime: "image/jpeg" },
        { type: "menu_image", mime: "image/webp" },
        { type: "menu_3d_model", mime: "model/gltf-binary" },
        { type: "menu_3d_model_ios", mime: "model/vnd.usdz+zip" },
        { type: "menu_video", mime: "video/mp4" },
      ];

      for (const t of types) {
        expect(() =>
          validateUploadRequest({
            assetType: t.type,
            fileName: `sample.${t.mime.split("/")[1]}`,
            contentType: t.mime,
            fileSize: 1024 * 1024,
          })
        ).not.toThrow();
      }
    });
  });

  describe("3. Filename Sanitization and Key Generation", () => {
    it("should sanitize path traversal characters from filename", () => {
      const { baseName, ext } = sanitizeFileName("../../../var/log/menu.pdf", "pdf");
      expect(baseName).toBe("var_log_menu");
      expect(ext).toBe("pdf");
    });

    it("should generate strictly scoped unique key", () => {
      const key = generateR2StorageKey("org_100", "menu_pdf", "dinner.pdf", "application/pdf");
      expect(key).toMatch(/^organizations\/org_100\/menu_pdf\/\d+-[a-z0-9]+-dinner\.pdf$/);
    });
  });

  describe("4. Phase 3 createAssetUpload Action", () => {
    type CreateAssetUploadHandler = {
      _handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
          runQuery: (q: unknown) => Promise<unknown>;
          runMutation: (m: unknown, args: unknown) => Promise<unknown>;
        },
        args: { assetType: string; fileName: string; contentType: string; fileSize: number; organizationId?: string }
      ) => Promise<{ assetId: string; uploadUrl: string; storageKey: string; expiresAt: number; contentType: string }>;
    };

    it("should reject unauthenticated caller", async () => {
      const handler = (createAssetUpload as unknown as CreateAssetUploadHandler)._handler;
      const mockCtx = {
        auth: { getUserIdentity: async () => null },
        runQuery: async () => [{ _id: "org_1" }],
        runMutation: async () => "asset_123",
      };

      await expect(
        handler(mockCtx, {
          assetType: "menu_image",
          fileName: "burger.png",
          contentType: "image/png",
          fileSize: 1024,
        })
      ).rejects.toThrowError(/Unauthenticated/);
    });

    it("should insert pending asset record and return presigned PUT URL and assetId", async () => {
      process.env.R2_ACCOUNT_ID = "acc_123";
      process.env.R2_ACCESS_KEY_ID = "key_123";
      process.env.R2_SECRET_ACCESS_KEY = "sec_123";
      process.env.R2_BUCKET_NAME = "pos-assets";

      const handler = (createAssetUpload as unknown as CreateAssetUploadHandler)._handler;
      const mutationMock = vi.fn().mockResolvedValue("asset_created_999");
      const mockCtx = {
        auth: { getUserIdentity: async () => ({ subject: "user_clerk_1" }) },
        runQuery: async () => [{ _id: "org_store_1" }],
        runMutation: mutationMock,
      };

      const result = await handler(mockCtx, {
        assetType: "menu_image",
        fileName: "burger.png",
        contentType: "image/png",
        fileSize: 2048,
      });

      expect(result.assetId).toBe("asset_created_999");
      expect(result.uploadUrl).toContain("https://presigned.r2.cloudflarestorage.com/pos-assets/");
      expect(result.storageKey).toMatch(/^organizations\/org_store_1\/menu_image\/\d+-[a-z0-9]+-burger\.png$/);
      expect(mutationMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          organizationId: "org_store_1",
          fileName: "burger.png",
          contentType: "image/png",
          fileSize: 2048,
          assetType: "menu_image",
          createdBy: "user_clerk_1",
        })
      );
    });
  });

  describe("5. Phase 3 confirmAssetUpload Action", () => {
    type ConfirmAssetUploadHandler = {
      _handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
          runQuery: (q: unknown, args: unknown) => Promise<unknown>;
          runMutation: (m: unknown, args: unknown) => Promise<unknown>;
        },
        args: { assetId: Id<"organization_assets"> }
      ) => Promise<{ success: boolean; assetId: string; storageKey: string; status: string; alreadyConfirmed?: boolean }>;
    };

    it("should reject unauthenticated caller", async () => {
      const handler = (confirmAssetUpload as unknown as ConfirmAssetUploadHandler)._handler;
      const mockCtx = {
        auth: { getUserIdentity: async () => null },
        runQuery: async () => ({ _id: "asset_1" }),
        runMutation: async () => ({}),
      };

      await expect(handler(mockCtx, { assetId: "asset_1" as Id<"organization_assets"> })).rejects.toThrowError(/Unauthenticated/);
    });

    it("should reject confirmation of a deleted asset", async () => {
      const handler = (confirmAssetUpload as unknown as ConfirmAssetUploadHandler)._handler;
      const mockCtx = {
        auth: { getUserIdentity: async () => ({ subject: "user_1" }) },
        runQuery: async () => ({
          _id: "asset_1",
          status: "deleted",
          storageKey: "organizations/org_1/menu_image/123-burger.png",
        }),
        runMutation: async () => ({}),
      };

      await expect(handler(mockCtx, { assetId: "asset_1" as Id<"organization_assets"> })).rejects.toThrowError(
        /Cannot confirm a deleted asset/
      );
    });

    it("should verify R2 object exists and transition status from pending to uploaded", async () => {
      process.env.R2_ACCOUNT_ID = "acc_123";
      process.env.R2_ACCESS_KEY_ID = "key_123";
      process.env.R2_SECRET_ACCESS_KEY = "sec_123";
      process.env.R2_BUCKET_NAME = "pos-assets";

      const sendMock = vi.spyOn(S3Client.prototype, "send").mockImplementation(async (command) => {
        expect(command).toBeInstanceOf(HeadObjectCommand);
        expect((command as HeadObjectCommand).input.Bucket).toBe("pos-assets");
        expect((command as HeadObjectCommand).input.Key).toBe("organizations/org_1/logo/123-logo.png");
        return {
          ContentLength: 4096,
          ContentType: "image/png",
        } as HeadObjectCommandOutput;
      });

      const mutationMock = vi.fn().mockResolvedValue({
        _id: "asset_1",
        status: "uploaded",
      });

      const handler = (confirmAssetUpload as unknown as ConfirmAssetUploadHandler)._handler;
      const mockCtx = {
        auth: { getUserIdentity: async () => ({ subject: "user_1" }) },
        runQuery: async () => ({
          _id: "asset_1",
          organizationId: "org_1",
          status: "pending",
          storageKey: "organizations/org_1/logo/123-logo.png",
          fileSize: 4000,
          contentType: "image/png",
        }),
        runMutation: mutationMock,
      };

      const result = await handler(mockCtx, { assetId: "asset_1" as Id<"organization_assets"> });

      expect(result.success).toBe(true);
      expect(result.status).toBe("uploaded");
      expect(result.storageKey).toBe("organizations/org_1/logo/123-logo.png");
      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(mutationMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          assetId: "asset_1",
          fileSize: 4096,
          contentType: "image/png",
        })
      );
    });

    it("should mark status as failed and throw when R2 HeadObject indicates object not found", async () => {
      process.env.R2_ACCOUNT_ID = "acc_123";
      process.env.R2_ACCESS_KEY_ID = "key_123";
      process.env.R2_SECRET_ACCESS_KEY = "sec_123";
      process.env.R2_BUCKET_NAME = "pos-assets";

      vi.spyOn(S3Client.prototype, "send").mockRejectedValue(new Error("NotFound: 404"));
      const mutationMock = vi.fn().mockResolvedValue({});

      const handler = (confirmAssetUpload as unknown as ConfirmAssetUploadHandler)._handler;
      const mockCtx = {
        auth: { getUserIdentity: async () => ({ subject: "user_1" }) },
        runQuery: async () => ({
          _id: "asset_1",
          organizationId: "org_1",
          status: "pending",
          storageKey: "organizations/org_1/menu_image/missing.png",
          fileSize: 1000,
          contentType: "image/png",
        }),
        runMutation: mutationMock,
      };

      await expect(handler(mockCtx, { assetId: "asset_1" as Id<"organization_assets"> })).rejects.toThrowError(
        /Failed to confirm asset upload: Object 'organizations\/org_1\/menu_image\/missing\.png' not found/
      );

      expect(mutationMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          assetId: "asset_1",
          reason: expect.stringContaining("NotFound"),
        })
      );
    });

    it("should handle repeated confirmation idempotently if asset is already uploaded and object exists", async () => {
      process.env.R2_ACCOUNT_ID = "acc_123";
      process.env.R2_ACCESS_KEY_ID = "key_123";
      process.env.R2_SECRET_ACCESS_KEY = "sec_123";
      process.env.R2_BUCKET_NAME = "pos-assets";

      vi.spyOn(S3Client.prototype, "send").mockImplementation(async () => ({} as unknown as HeadObjectCommandOutput));

      const handler = (confirmAssetUpload as unknown as ConfirmAssetUploadHandler)._handler;
      const mockCtx = {
        auth: { getUserIdentity: async () => ({ subject: "user_1" }) },
        runQuery: async () => ({
          _id: "asset_1",
          organizationId: "org_1",
          status: "uploaded",
          storageKey: "organizations/org_1/menu_image/already-there.png",
        }),
        runMutation: vi.fn(),
      };

      const result = await handler(mockCtx, { assetId: "asset_1" as Id<"organization_assets"> });

      expect(result.success).toBe(true);
      expect(result.alreadyConfirmed).toBe(true);
      expect(result.status).toBe("uploaded");
    });
  });

  describe("6. Phase 3 getAssetDownloadUrl Action", () => {
    type GetAssetDownloadUrlHandler = {
      _handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
          runQuery: (q: unknown, args: unknown) => Promise<unknown>;
        },
        args: { assetId: Id<"organization_assets">; expiresInSeconds?: number }
      ) => Promise<{ downloadUrl: string; expiresAt: number; fileName: string; contentType: string; fileSize: number; assetId: string }>;
    };

    it("should reject unauthenticated caller", async () => {
      const handler = (getAssetDownloadUrl as unknown as GetAssetDownloadUrlHandler)._handler;
      const mockCtx = {
        auth: { getUserIdentity: async () => null },
        runQuery: async () => ({ _id: "asset_1" }),
      };

      await expect(
        handler(mockCtx, { assetId: "asset_1" as Id<"organization_assets"> })
      ).rejects.toThrowError(/Unauthenticated/);
    });

    it("should reject when asset is not found or is deleted", async () => {
      const handler = (getAssetDownloadUrl as unknown as GetAssetDownloadUrlHandler)._handler;
      const mockCtx = {
        auth: { getUserIdentity: async () => ({ subject: "user_1" }) },
        runQuery: async () => null,
      };

      await expect(
        handler(mockCtx, { assetId: "asset_nonexistent" as Id<"organization_assets"> })
      ).rejects.toThrowError(/Asset not found/);
    });

    it("should reject when asset organization does not exist or access is denied", async () => {
      const handler = (getAssetDownloadUrl as unknown as GetAssetDownloadUrlHandler)._handler;
      const mockCtx = {
        auth: { getUserIdentity: async () => ({ subject: "user_1" }) },
        runQuery: async (q: unknown) => {
          // If querying asset:
          if (typeof q === "object" && q !== null) {
            return {
              _id: "asset_1",
              organizationId: "org_foreign",
              status: "uploaded",
              storageKey: "organizations/org_foreign/menu_image/123-burger.png",
              fileName: "burger.png",
              contentType: "image/png",
              fileSize: 1024,
            };
          }
          return null;
        },
      };

      // When organization query returns null:
      let queryCallCount = 0;
      mockCtx.runQuery = async () => {
        queryCallCount++;
        if (queryCallCount === 1) {
          return {
            _id: "asset_1",
            organizationId: "org_foreign",
            status: "uploaded",
            storageKey: "organizations/org_foreign/menu_image/123-burger.png",
            fileName: "burger.png",
            contentType: "image/png",
            fileSize: 1024,
          };
        }
        return null; // Org not found
      };

      await expect(
        handler(mockCtx, { assetId: "asset_1" as Id<"organization_assets"> })
      ).rejects.toThrowError(/Organization not found or access denied/);
    });

    it("should reject download when asset is in pending state", async () => {
      const handler = (getAssetDownloadUrl as unknown as GetAssetDownloadUrlHandler)._handler;
      let queryCallCount = 0;
      const mockCtx = {
        auth: { getUserIdentity: async () => ({ subject: "user_1" }) },
        runQuery: async () => {
          queryCallCount++;
          if (queryCallCount === 1) {
            return {
              _id: "asset_1",
              organizationId: "org_1",
              status: "pending",
              storageKey: "organizations/org_1/menu_image/123-burger.png",
            };
          }
          return { _id: "org_1" };
        },
      };

      await expect(
        handler(mockCtx, { assetId: "asset_1" as Id<"organization_assets"> })
      ).rejects.toThrowError(/Asset upload is still pending confirmation/);
    });

    it("should reject download when asset is in failed state", async () => {
      const handler = (getAssetDownloadUrl as unknown as GetAssetDownloadUrlHandler)._handler;
      let queryCallCount = 0;
      const mockCtx = {
        auth: { getUserIdentity: async () => ({ subject: "user_1" }) },
        runQuery: async () => {
          queryCallCount++;
          if (queryCallCount === 1) {
            return {
              _id: "asset_1",
              organizationId: "org_1",
              status: "failed",
              storageKey: "organizations/org_1/menu_image/123-burger.png",
            };
          }
          return { _id: "org_1" };
        },
      };

      await expect(
        handler(mockCtx, { assetId: "asset_1" as Id<"organization_assets"> })
      ).rejects.toThrowError(/Asset upload failed/);
    });

    it("should generate signed GET URL for uploaded asset using stored storageKey", async () => {
      process.env.R2_ACCOUNT_ID = "acc_123";
      process.env.R2_ACCESS_KEY_ID = "key_123";
      process.env.R2_SECRET_ACCESS_KEY = "sec_123";
      process.env.R2_BUCKET_NAME = "pos-assets";

      const handler = (getAssetDownloadUrl as unknown as GetAssetDownloadUrlHandler)._handler;
      let queryCallCount = 0;
      const mockCtx = {
        auth: { getUserIdentity: async () => ({ subject: "user_1" }) },
        runQuery: async () => {
          queryCallCount++;
          if (queryCallCount === 1) {
            return {
              _id: "asset_valid_1",
              organizationId: "org_1",
              status: "uploaded",
              storageKey: "organizations/org_1/logo/17889-logo.png",
              fileName: "brand_logo.png",
              contentType: "image/png",
              fileSize: 4096,
            };
          }
          return { _id: "org_1", name: "Main Store" };
        },
      };

      const result = await handler(mockCtx, {
        assetId: "asset_valid_1" as Id<"organization_assets">,
      });

      expect(result.assetId).toBe("asset_valid_1");
      expect(result.downloadUrl).toContain("https://presigned.r2.cloudflarestorage.com/pos-assets/organizations/org_1/logo/17889-logo.png");
      expect(result.fileName).toBe("brand_logo.png");
      expect(result.contentType).toBe("image/png");
      expect(result.fileSize).toBe(4096);
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe("7. Phase 3 deleteAsset Action", () => {
    type DeleteAssetHandler = {
      _handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
          runQuery: (q: unknown, args: unknown) => Promise<unknown>;
          runMutation: (m: unknown, args: unknown) => Promise<unknown>;
        },
        args: { assetId: Id<"organization_assets"> }
      ) => Promise<{ success: boolean; assetId: string; storageKey: string; status: "deleted"; deletedAt: number; alreadyDeleted?: boolean }>;
    };

    it("should reject unauthenticated caller", async () => {
      const handler = (deleteAsset as unknown as DeleteAssetHandler)._handler;
      const mockCtx = {
        auth: { getUserIdentity: async () => null },
        runQuery: async () => ({ _id: "asset_1" }),
        runMutation: async () => ({}),
      };

      await expect(
        handler(mockCtx, { assetId: "asset_1" as Id<"organization_assets"> })
      ).rejects.toThrowError(/Unauthenticated/);
    });

    it("should reject when asset is not found", async () => {
      const handler = (deleteAsset as unknown as DeleteAssetHandler)._handler;
      const mockCtx = {
        auth: { getUserIdentity: async () => ({ subject: "user_1" }) },
        runQuery: async () => null,
        runMutation: async () => ({}),
      };

      await expect(
        handler(mockCtx, { assetId: "asset_missing" as Id<"organization_assets"> })
      ).rejects.toThrowError(/Asset not found/);
    });

    it("should reject when caller's organization does not match or access is denied", async () => {
      const handler = (deleteAsset as unknown as DeleteAssetHandler)._handler;
      let queryCallCount = 0;
      const mockCtx = {
        auth: { getUserIdentity: async () => ({ subject: "user_1" }) },
        runQuery: async () => {
          queryCallCount++;
          if (queryCallCount === 1) {
            return {
              _id: "asset_1",
              organizationId: "org_foreign",
              status: "uploaded",
              storageKey: "organizations/org_foreign/menu_image/123-burger.png",
            };
          }
          return null; // Foreign organization not found for caller
        },
        runMutation: async () => ({}),
      };

      await expect(
        handler(mockCtx, { assetId: "asset_1" as Id<"organization_assets"> })
      ).rejects.toThrowError(/Organization not found or access denied/);
    });

    it("should handle already deleted asset idempotently without re-issuing R2 delete", async () => {
      process.env.R2_ACCOUNT_ID = "acc_123";
      process.env.R2_ACCESS_KEY_ID = "key_123";
      process.env.R2_SECRET_ACCESS_KEY = "sec_123";
      process.env.R2_BUCKET_NAME = "pos-assets";

      const sendMock = vi.spyOn(S3Client.prototype, "send");

      const handler = (deleteAsset as unknown as DeleteAssetHandler)._handler;
      let queryCallCount = 0;
      const mockCtx = {
        auth: { getUserIdentity: async () => ({ subject: "user_1" }) },
        runQuery: async () => {
          queryCallCount++;
          if (queryCallCount === 1) {
            return {
              _id: "asset_1",
              organizationId: "org_1",
              status: "deleted",
              deletedAt: 1700000000000,
              storageKey: "organizations/org_1/menu_image/already_deleted.png",
            };
          }
          return { _id: "org_1" };
        },
        runMutation: vi.fn(),
      };

      const result = await handler(mockCtx, { assetId: "asset_1" as Id<"organization_assets"> });

      expect(result.success).toBe(true);
      expect(result.alreadyDeleted).toBe(true);
      expect(result.status).toBe("deleted");
      expect(result.deletedAt).toBe(1700000000000);
      expect(sendMock).not.toHaveBeenCalled();
    });

    it("should issue DeleteObjectCommand to R2 and mark Convex asset as deleted", async () => {
      process.env.R2_ACCOUNT_ID = "acc_123";
      process.env.R2_ACCESS_KEY_ID = "key_123";
      process.env.R2_SECRET_ACCESS_KEY = "sec_123";
      process.env.R2_BUCKET_NAME = "pos-assets";

      const sendMock = vi.spyOn(S3Client.prototype, "send").mockImplementation(async (command) => {
        expect(command).toBeInstanceOf(DeleteObjectCommand);
        expect((command as DeleteObjectCommand).input.Bucket).toBe("pos-assets");
        expect((command as DeleteObjectCommand).input.Key).toBe("organizations/org_1/logo/17889-logo.png");
        return {} as unknown as DeleteObjectCommandOutput;
      });

      const mutationMock = vi.fn().mockResolvedValue({
        _id: "asset_1",
        status: "deleted",
        deletedAt: 1788900000,
      });

      const handler = (deleteAsset as unknown as DeleteAssetHandler)._handler;
      let queryCallCount = 0;
      const mockCtx = {
        auth: { getUserIdentity: async () => ({ subject: "user_1" }) },
        runQuery: async () => {
          queryCallCount++;
          if (queryCallCount === 1) {
            return {
              _id: "asset_1",
              organizationId: "org_1",
              status: "uploaded",
              storageKey: "organizations/org_1/logo/17889-logo.png",
            };
          }
          return { _id: "org_1" };
        },
        runMutation: mutationMock,
      };

      const result = await handler(mockCtx, { assetId: "asset_1" as Id<"organization_assets"> });

      expect(result.success).toBe(true);
      expect(result.status).toBe("deleted");
      expect(result.storageKey).toBe("organizations/org_1/logo/17889-logo.png");
      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(mutationMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          assetId: "asset_1",
        })
      );
    });

    it("should NOT mark Convex record as deleted if R2 DeleteObject fails", async () => {
      process.env.R2_ACCOUNT_ID = "acc_123";
      process.env.R2_ACCESS_KEY_ID = "key_123";
      process.env.R2_SECRET_ACCESS_KEY = "sec_123";
      process.env.R2_BUCKET_NAME = "pos-assets";

      vi.spyOn(S3Client.prototype, "send").mockRejectedValue(new Error("R2 Network Timeout"));
      const mutationMock = vi.fn();

      const handler = (deleteAsset as unknown as DeleteAssetHandler)._handler;
      let queryCallCount = 0;
      const mockCtx = {
        auth: { getUserIdentity: async () => ({ subject: "user_1" }) },
        runQuery: async () => {
          queryCallCount++;
          if (queryCallCount === 1) {
            return {
              _id: "asset_1",
              organizationId: "org_1",
              status: "uploaded",
              storageKey: "organizations/org_1/logo/17889-logo.png",
            };
          }
          return { _id: "org_1" };
        },
        runMutation: mutationMock,
      };

      await expect(
        handler(mockCtx, { assetId: "asset_1" as Id<"organization_assets"> })
      ).rejects.toThrowError(/Failed to delete asset from R2 storage/);

      expect(mutationMock).not.toHaveBeenCalled();
    });
  });
});


