import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getFallbackContentType,
  validateFileSize,
  migrateStorageToR2,
  MigrationSummaryReport,
} from "./migrateStorageToR2";
import {
  internalListCandidates,
  internalRecordMigratedAsset,
  MigrationCandidate,
} from "./migrateStorageToR2Db";
import { resetR2ClientCache } from "./r2";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Id } from "./_generated/dataModel";

type ListCandidatesHandler = {
  _handler: (
    ctx: {
      db: {
        query: (table: string) => {
          first: () => Promise<unknown>;
          collect: () => Promise<unknown[]>;
        };
      };
    },
    args: { table?: string; limit?: number; cursor?: string }
  ) => Promise<{ candidates: MigrationCandidate[]; hasMore: boolean; nextCursor: string | null }>;
};

type RecordMigratedAssetHandler = {
  _handler: (
    ctx: {
      db: {
        insert: (table: string, data: unknown) => Promise<Id<"organization_assets">>;
        patch: (id: unknown, data: unknown) => Promise<void>;
      };
    },
    args: {
      table: string;
      recordId: string;
      targetField: string;
      organizationId: Id<"organizations">;
      storageKey: string;
      fileName: string;
      contentType: string;
      fileSize: number;
      assetType: string;
      legacyStorageId: string;
      existingAssetId?: Id<"organization_assets">;
    }
  ) => Promise<Id<"organization_assets">>;
};

type MigrateActionHandler = {
  _handler: (
    ctx: {
      runQuery: (q: unknown, args: unknown) => Promise<unknown>;
      runMutation: (m: unknown, args: unknown) => Promise<unknown>;
      storage: {
        get: (id: unknown) => Promise<Blob | null>;
        getMetadata?: (id: unknown) => Promise<{ size: number; contentType: string; sha256: string } | null>;
      };
    },
    args: { dryRun?: boolean; table?: string; limit?: number; cursor?: string }
  ) => Promise<MigrationSummaryReport>;
};

describe("Convex Storage to Cloudflare R2 Physical Migration Tests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    resetR2ClientCache();
    process.env.R2_ACCOUNT_ID = "acc_test_123";
    process.env.R2_ACCESS_KEY_ID = "key_test_123";
    process.env.R2_SECRET_ACCESS_KEY = "sec_test_123";
    process.env.R2_BUCKET_NAME = "pos-assets";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetR2ClientCache();
  });

  describe("1. Metadata Helpers & File Size Validation", () => {
    it("should provide correct deterministic fallback content types", () => {
      expect(getFallbackContentType("logo")).toBe("image/png");
      expect(getFallbackContentType("document")).toBe("application/pdf");
      expect(getFallbackContentType("menu_image")).toBe("image/jpeg");
      expect(getFallbackContentType("menu_3d_model")).toBe("model/gltf-binary");
      expect(getFallbackContentType("menu_3d_model_ios")).toBe("model/gltf-binary");
      expect(getFallbackContentType("menu_video")).toBe("video/mp4");
      expect(getFallbackContentType("carousel_image")).toBe("image/jpeg");
      expect(getFallbackContentType("unknown")).toBe("application/octet-stream");
    });

    it("should accept valid file sizes within bounds", () => {
      const result = validateFileSize(5 * 1024 * 1024, "image/png");
      expect(result.valid).toBe(true);
      expect(result.maxAllowed).toBe(10 * 1024 * 1024);
    });

    it("should reject 0 or negative file sizes", () => {
      const resultZero = validateFileSize(0, "image/png");
      expect(resultZero.valid).toBe(false);
      expect(resultZero.reason).toMatch(/greater than 0/);

      const resultNeg = validateFileSize(-100, "image/png");
      expect(resultNeg.valid).toBe(false);
    });

    it("should reject oversized files exceeding R2 max bounds", () => {
      const result = validateFileSize(15 * 1024 * 1024, "image/png"); // 15MB > 10MB
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/exceeds the maximum allowed limit/);
    });
  });

  describe("2. Candidate Discovery (internalListCandidates)", () => {
    it("should discover all 9 legacy storage fields across all 4 tables", async () => {
      const mockOrgId = "org_1" as Id<"organizations">;

      const mockDb = {
        query: vi.fn((table: string) => ({
          first: vi.fn(async () => ({ _id: mockOrgId, name: "Store Alpha" })),
          collect: vi.fn(async () => {
            if (table === "organizations") {
              return [
                {
                  _id: mockOrgId,
                  name: "Store Alpha",
                  logoStorageId: "storage_logo" as Id<"_storage">,
                  fssaiDocumentStorageId: "storage_fssai" as Id<"_storage">,
                  gstDocumentStorageId: "storage_gst" as Id<"_storage">,
                },
              ];
            }
            if (table === "items") {
              return [
                {
                  _id: "item_1" as Id<"items">,
                  organizationId: mockOrgId,
                  name: "Pizza Margherita",
                  imageStorageId: "storage_item_img" as Id<"_storage">,
                  threeDModelStorageId: "storage_item_3d" as Id<"_storage">,
                  threeDModelIosStorageId: "storage_item_ios" as Id<"_storage">,
                  videoStorageId: "storage_item_vid" as Id<"_storage">,
                },
              ];
            }
            if (table === "customizationItems") {
              return [
                {
                  _id: "ci_1" as Id<"customizationItems">,
                  organizationId: mockOrgId,
                  name: "Extra Cheese",
                  imageStorageId: "storage_ci_img" as Id<"_storage">,
                },
              ];
            }
            if (table === "organizationCarouselScreens") {
              return [
                {
                  _id: "screen_1" as Id<"organizationCarouselScreens">,
                  position: 1,
                  fileName: "banner1.webp",
                  storageId: "storage_screen_img" as Id<"_storage">,
                },
              ];
            }
            return [];
          }),
        })),
      };

      const ctx = { db: mockDb };
      const handler = (internalListCandidates as unknown as ListCandidatesHandler)._handler;
      const result = await handler(ctx, { table: "all" });

      expect(result.candidates.length).toBe(9);

      // Verify all 9 mappings
      const types = result.candidates.map((c: MigrationCandidate) => `${c.table}.${c.legacyField} -> ${c.targetField} (${c.assetType})`);
      expect(types).toContain("organizations.logoStorageId -> logoAssetId (logo)");
      expect(types).toContain("organizations.fssaiDocumentStorageId -> fssaiDocumentAssetId (document)");
      expect(types).toContain("organizations.gstDocumentStorageId -> gstDocumentAssetId (document)");
      expect(types).toContain("items.imageStorageId -> imageAssetId (menu_image)");
      expect(types).toContain("items.threeDModelStorageId -> threeDModelAssetId (menu_3d_model)");
      expect(types).toContain("items.threeDModelIosStorageId -> threeDModelIosAssetId (menu_3d_model_ios)");
      expect(types).toContain("items.videoStorageId -> videoAssetId (menu_video)");
      expect(types).toContain("customizationItems.imageStorageId -> imageAssetId (menu_image)");
      expect(types).toContain("organizationCarouselScreens.storageId -> assetId (carousel_image)");
    });

    it("should filter by specific table", async () => {
      const mockOrgId = "org_1" as Id<"organizations">;
      const mockDb = {
        query: vi.fn((table: string) => ({
          first: vi.fn(async () => ({ _id: mockOrgId })),
          collect: vi.fn(async () => {
            if (table === "organizations") {
              return [{ _id: mockOrgId, logoStorageId: "storage_logo" as Id<"_storage"> }];
            }
            return [];
          }),
        })),
      };

      const ctx = { db: mockDb };
      const handler = (internalListCandidates as unknown as ListCandidatesHandler)._handler;
      const result = await handler(ctx, { table: "organizations" });
      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].table).toBe("organizations");
    });
  });

  describe("3. Parent Document Linking & Metadata Mutation (internalRecordMigratedAsset)", () => {
    it("should insert organization_assets record with legacyId and patch parent record", async () => {
      const mockOrgId = "org_1" as Id<"organizations">;
      const mockItemId = "item_1" as Id<"items">;
      const mockAssetId = "asset_123" as Id<"organization_assets">;

      const insertedRecord: { table?: string; legacyId?: string; status?: string; organizationId?: string } = {};
      const patchedRecord: { id?: unknown; imageAssetId?: unknown } = {};

      const mockDb = {
        insert: vi.fn(async (table: string, data: unknown) => {
          const typedData = data as Record<string, unknown>;
          insertedRecord.table = table;
          insertedRecord.legacyId = typedData.legacyId as string;
          insertedRecord.status = typedData.status as string;
          insertedRecord.organizationId = typedData.organizationId as string;
          return mockAssetId;
        }),
        patch: vi.fn(async (id: unknown, data: unknown) => {
          const typedData = data as Record<string, unknown>;
          patchedRecord.id = id;
          patchedRecord.imageAssetId = typedData.imageAssetId;
        }),
      };

      const ctx = { db: mockDb };
      const handler = (internalRecordMigratedAsset as unknown as RecordMigratedAssetHandler)._handler;
      const assetId = await handler(ctx, {
        table: "items",
        recordId: mockItemId,
        targetField: "imageAssetId",
        organizationId: mockOrgId,
        storageKey: "organizations/org_1/menu_image/123-dish.jpg",
        fileName: "dish.jpg",
        contentType: "image/jpeg",
        fileSize: 1024,
        assetType: "menu_image",
        legacyStorageId: "storage_legacy_456",
      });

      expect(assetId).toBe(mockAssetId);
      expect(insertedRecord.table).toBe("organization_assets");
      expect(insertedRecord.legacyId).toBe("storage_legacy_456");
      expect(insertedRecord.status).toBe("uploaded");
      expect(insertedRecord.organizationId).toBe(mockOrgId);

      expect(patchedRecord.id).toBe(mockItemId);
      expect(patchedRecord.imageAssetId).toBe(mockAssetId);
    });
  });

  describe("4. Core Migration Action (migrateStorageToR2)", () => {
    it("should execute dry run without performing R2 uploads or DB mutations", async () => {
      const mockOrgId = "org_1" as Id<"organizations">;
      const s3SendMock = vi.spyOn(S3Client.prototype, "send");

      const mockRunQuery = vi.fn(async (_fn: unknown, args: unknown) => {
        const typedArgs = args as { id?: string; legacyId?: string };
        if (typedArgs?.id || typedArgs?.legacyId) return null;
        return {
          candidates: [
            {
              table: "organizations",
              recordId: mockOrgId,
              organizationId: mockOrgId,
              assetType: "logo",
              legacyField: "logoStorageId",
              targetField: "logoAssetId",
              storageId: "storage_logo_1" as Id<"_storage">,
              preferredFileName: "store-logo",
            },
          ],
          hasMore: false,
          nextCursor: null,
        };
      });

      const mockRunMutation = vi.fn();
      const mockStorage = {
        get: vi.fn(async () => new Blob(["test image content"], { type: "image/png" })),
        getMetadata: vi.fn(async () => ({ size: 18, contentType: "image/png", sha256: "abc" })),
      };

      const ctx = {
        runQuery: mockRunQuery,
        runMutation: mockRunMutation,
        storage: mockStorage,
      };

      const handler = (migrateStorageToR2 as unknown as MigrateActionHandler)._handler;
      const report = await handler(ctx, { dryRun: true });

      expect(report.dryRun).toBe(true);
      expect(report.totalCandidates).toBe(1);
      expect(report.successfullyMigrated).toBe(1);
      expect(report.items[0].status).toBe("dry_run_candidate");

      // Verify zero R2 uploads and zero mutations
      expect(s3SendMock).not.toHaveBeenCalled();
      expect(mockRunMutation).not.toHaveBeenCalled();
    });

    it("should migrate physical storage binary to R2 and link parent record", async () => {
      const mockOrgId = "org_1" as Id<"organizations">;
      const mockItemId = "item_1" as Id<"items">;
      const mockAssetId = "asset_new_999" as Id<"organization_assets">;

      const s3SendMock = vi.spyOn(S3Client.prototype, "send").mockImplementation(async (command: unknown) => {
        if (command instanceof PutObjectCommand) {
          return {} as never;
        }
        if (command instanceof HeadObjectCommand) {
          return { ContentLength: 18, ContentType: "image/jpeg" } as never;
        }
        return {} as never;
      });

      const mockRunQuery = vi.fn(async (_fn: unknown, args: unknown) => {
        const typedArgs = args as { id?: string; legacyId?: string };
        if (typedArgs?.id || typedArgs?.legacyId) return null;
        return {
          candidates: [
            {
              table: "items",
              recordId: mockItemId,
              organizationId: mockOrgId,
              assetType: "menu_image",
              legacyField: "imageStorageId",
              targetField: "imageAssetId",
              storageId: "storage_item_1" as Id<"_storage">,
              preferredFileName: "pizza",
            },
          ],
          hasMore: false,
          nextCursor: null,
        };
      });

      const mockRunMutation = vi.fn(async () => mockAssetId);
      const mockStorage = {
        get: vi.fn(async () => new Blob(["image binary bytes"], { type: "image/jpeg" })),
        getMetadata: vi.fn(async () => ({ size: 18, contentType: "image/jpeg", sha256: "def" })),
      };

      const ctx = {
        runQuery: mockRunQuery,
        runMutation: mockRunMutation,
        storage: mockStorage,
      };

      const handler = (migrateStorageToR2 as unknown as MigrateActionHandler)._handler;
      const report = await handler(ctx, { dryRun: false });

      expect(report.dryRun).toBe(false);
      expect(report.totalCandidates).toBe(1);
      expect(report.successfullyMigrated).toBe(1);
      expect(report.failed).toBe(0);
      expect(report.items[0].status).toBe("migrated");
      expect(report.items[0].assetId).toBe(mockAssetId);

      // Verify PutObject and HeadObject were called
      expect(s3SendMock).toHaveBeenCalledTimes(2);
      expect(mockRunMutation).toHaveBeenCalledTimes(1);
    });

    it("should handle missing Convex Storage objects safely without aborting or modifying parent", async () => {
      const mockOrgId = "org_1" as Id<"organizations">;

      const mockRunQuery = vi.fn(async (_fn: unknown, args: unknown) => {
        const typedArgs = args as { id?: string; legacyId?: string };
        if (typedArgs?.id || typedArgs?.legacyId) return null;
        return {
          candidates: [
            {
              table: "organizations",
              recordId: mockOrgId,
              organizationId: mockOrgId,
              assetType: "logo",
              legacyField: "logoStorageId",
              targetField: "logoAssetId",
              storageId: "storage_missing" as Id<"_storage">,
              preferredFileName: "store-logo",
            },
          ],
          hasMore: false,
          nextCursor: null,
        };
      });

      const mockRunMutation = vi.fn();
      const mockStorage = {
        get: vi.fn(async () => null), // Missing file
        getMetadata: vi.fn(async () => null),
      };

      const ctx = {
        runQuery: mockRunQuery,
        runMutation: mockRunMutation,
        storage: mockStorage,
      };

      const handler = (migrateStorageToR2 as unknown as MigrateActionHandler)._handler;
      const report = await handler(ctx, { dryRun: false });

      expect(report.totalCandidates).toBe(1);
      expect(report.successfullyMigrated).toBe(0);
      expect(report.failed).toBe(1);
      expect(report.missingStorageObjects).toBe(1);
      expect(report.items[0].status).toBe("failed");
      expect(report.items[0].reason).toMatch(/Convex Storage object not found/);

      // Verify no DB mutations occurred
      expect(mockRunMutation).not.toHaveBeenCalled();
    });

    it("should reject oversized files exceeding R2 boundaries", async () => {
      const mockOrgId = "org_1" as Id<"organizations">;

      const mockRunQuery = vi.fn(async (_fn: unknown, args: unknown) => {
        const typedArgs = args as { id?: string; legacyId?: string };
        if (typedArgs?.id || typedArgs?.legacyId) return null;
        return {
          candidates: [
            {
              table: "organizations",
              recordId: mockOrgId,
              organizationId: mockOrgId,
              assetType: "logo",
              legacyField: "logoStorageId",
              targetField: "logoAssetId",
              storageId: "storage_oversized" as Id<"_storage">,
              preferredFileName: "huge-logo",
            },
          ],
          hasMore: false,
          nextCursor: null,
        };
      });

      const mockRunMutation = vi.fn();
      // 15MB buffer exceeds 10MB logo limit
      const largeBuffer = Buffer.alloc(15 * 1024 * 1024);
      const mockStorage = {
        get: vi.fn(async () => new Blob([largeBuffer], { type: "image/png" })),
        getMetadata: vi.fn(async () => ({ size: 15 * 1024 * 1024, contentType: "image/png", sha256: "large" })),
      };

      const ctx = {
        runQuery: mockRunQuery,
        runMutation: mockRunMutation,
        storage: mockStorage,
      };

      const handler = (migrateStorageToR2 as unknown as MigrateActionHandler)._handler;
      const report = await handler(ctx, { dryRun: false });

      expect(report.totalCandidates).toBe(1);
      expect(report.failed).toBe(1);
      expect(report.oversizedFiles).toBe(1);
      expect(report.items[0].status).toBe("failed");
      expect(report.items[0].reason).toMatch(/exceeds the maximum allowed limit/);
      expect(mockRunMutation).not.toHaveBeenCalled();
    });

    it("should be idempotent and skip already migrated records with verified Asset IDs", async () => {
      const mockOrgId = "org_1" as Id<"organizations">;
      const mockAssetId = "asset_existing_111" as Id<"organization_assets">;

      const mockRunQuery = vi.fn(async (_fn: unknown, args: unknown) => {
        const typedArgs = args as { id?: string; legacyId?: string };
        if (typedArgs?.id === mockAssetId) {
          return {
            _id: mockAssetId,
            status: "uploaded",
            storageKey: "organizations/org_1/logo/123-store-logo.png",
            fileName: "store-logo.png",
            fileSize: 1024,
            contentType: "image/png",
          };
        }
        if (typedArgs?.legacyId) return null;
        return {
          candidates: [
            {
              table: "organizations",
              recordId: mockOrgId,
              organizationId: mockOrgId,
              assetType: "logo",
              legacyField: "logoStorageId",
              targetField: "logoAssetId",
              storageId: "storage_logo_already" as Id<"_storage">,
              currentAssetId: mockAssetId,
              preferredFileName: "store-logo",
            },
          ],
          hasMore: false,
          nextCursor: null,
        };
      });

      const mockRunMutation = vi.fn();
      const mockStorage = {
        get: vi.fn(),
      };

      const ctx = {
        runQuery: mockRunQuery,
        runMutation: mockRunMutation,
        storage: mockStorage,
      };

      const handler = (migrateStorageToR2 as unknown as MigrateActionHandler)._handler;
      const report = await handler(ctx, { dryRun: false });

      expect(report.totalCandidates).toBe(1);
      expect(report.alreadyMigrated).toBe(1);
      expect(report.successfullyMigrated).toBe(0);
      expect(report.items[0].status).toBe("already_migrated");
      expect(report.items[0].assetId).toBe(mockAssetId);

      // Storage get, R2 upload, and DB mutations should not be called
      expect(mockStorage.get).not.toHaveBeenCalled();
      expect(mockRunMutation).not.toHaveBeenCalled();
    });

    it("should reconcile legacyId if asset was already uploaded to R2 without parent link", async () => {
      const mockOrgId = "org_1" as Id<"organizations">;
      const mockItemId = "item_1" as Id<"items">;
      const mockIndexedAssetId = "asset_indexed_222" as Id<"organization_assets">;

      const mockRunQuery = vi.fn(async (_fn: unknown, args: unknown) => {
        const typedArgs = args as { id?: string; legacyId?: string };
        if (typedArgs?.legacyId === "storage_legacy_match") {
          return {
            _id: mockIndexedAssetId,
            status: "uploaded",
            storageKey: "organizations/org_1/menu_image/456-pizza.jpg",
            fileName: "pizza.jpg",
            fileSize: 2048,
            contentType: "image/jpeg",
            assetType: "menu_image",
          };
        }
        if (typedArgs?.id) return null;
        return {
          candidates: [
            {
              table: "items",
              recordId: mockItemId,
              organizationId: mockOrgId,
              assetType: "menu_image",
              legacyField: "imageStorageId",
              targetField: "imageAssetId",
              storageId: "storage_legacy_match" as Id<"_storage">,
              preferredFileName: "pizza",
            },
          ],
          hasMore: false,
          nextCursor: null,
        };
      });

      const mockRunMutation = vi.fn(async () => mockIndexedAssetId);
      const mockStorage = {
        get: vi.fn(),
      };

      const ctx = {
        runQuery: mockRunQuery,
        runMutation: mockRunMutation,
        storage: mockStorage,
      };

      const handler = (migrateStorageToR2 as unknown as MigrateActionHandler)._handler;
      const report = await handler(ctx, { dryRun: false });

      expect(report.alreadyMigrated).toBe(1);
      expect(report.items[0].status).toBe("already_migrated");
      expect(report.items[0].reason).toMatch(/reconciled/);
      expect(report.items[0].assetId).toBe(mockIndexedAssetId);

      // Mutation called to link parent document with existing verified assetId
      expect(mockRunMutation).toHaveBeenCalledTimes(1);
      // No re-upload to R2
      expect(mockStorage.get).not.toHaveBeenCalled();
    });
  });
});
