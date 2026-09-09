import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveAssetOrStorageUrl } from "./assetResolver";
import { toScreenResponse, toPublicResponse } from "./organizationCarouselScreens";
import { getStorageUrl } from "./organizations";
import { getOrganizationMenu, listCategoryItems, listAllItems } from "./menu";
import { Id, Doc } from "./_generated/dataModel";

type StorageMock = {
  getUrl: (id: unknown) => Promise<string | null>;
};

type DbMock = {
  get: (id: unknown) => Promise<unknown>;
  query?: (table: string) => unknown;
};

type QueryCtxMock = {
  db: DbMock;
  storage: StorageMock;
};

type GenericHandler<TArgs, TResult> = {
  _handler: (ctx: QueryCtxMock, args: TArgs) => Promise<TResult>;
};

describe("Backend Asset Resolver Transition Tests (R2 First, Convex Storage Fallback)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.R2_ACCOUNT_ID = "acc_test_123";
    process.env.R2_ACCESS_KEY_ID = "key_test_123";
    process.env.R2_SECRET_ACCESS_KEY = "sec_test_123";
    process.env.R2_BUCKET_NAME = "pos-assets";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("1. Core Resolver Matrix (resolveAssetOrStorageUrl)", () => {
    it("Test 1 — R2 asset exists & uploaded: R2 URL MUST win over legacy Storage", async () => {
      const mockOrgId = "org_alpha" as Id<"organizations">;
      const mockAssetId = "asset_1" as Id<"organization_assets">;
      const mockStorageId = "storage_1" as Id<"_storage">;

      const mockDb: DbMock = {
        get: vi.fn(async (id: unknown) => {
          if (id === mockAssetId) {
            return {
              _id: mockAssetId,
              organizationId: mockOrgId,
              storageKey: "organizations/org_alpha/menu_image/pizza.jpg",
              status: "uploaded",
            };
          }
          return null;
        }),
      };

      const mockStorage: StorageMock = {
        getUrl: vi.fn(async () => "https://convex.cloud/api/storage/legacy-url"),
      };

      const result = await resolveAssetOrStorageUrl(
        { db: mockDb as never, storage: mockStorage as never },
        {
          assetId: mockAssetId,
          storageId: mockStorageId,
          organizationId: mockOrgId,
        }
      );

      expect(result).not.toBeNull();
      expect(result).toContain("https://acc_test_123.r2.cloudflarestorage.com/pos-assets/organizations/org_alpha/menu_image/pizza.jpg");
      expect(result).toContain("X-Amz-Signature=");
      // Storage getUrl must NOT have been called because R2 won
      expect(mockStorage.getUrl).not.toHaveBeenCalled();
    });

    it("Test 2 — Only legacy Storage exists: returns Convex Storage URL", async () => {
      const mockOrgId = "org_alpha" as Id<"organizations">;
      const mockStorageId = "storage_1" as Id<"_storage">;

      const mockDb: DbMock = {
        get: vi.fn(async () => null),
      };

      const mockStorage: StorageMock = {
        getUrl: vi.fn(async () => "https://convex.cloud/api/storage/legacy-url-2"),
      };

      const result = await resolveAssetOrStorageUrl(
        { db: mockDb as never, storage: mockStorage as never },
        {
          assetId: undefined,
          storageId: mockStorageId,
          organizationId: mockOrgId,
        }
      );

      expect(result).toBe("https://convex.cloud/api/storage/legacy-url-2");
      expect(mockStorage.getUrl).toHaveBeenCalledWith(mockStorageId);
    });

    it("Test 3 — Neither exists: returns null", async () => {
      const mockOrgId = "org_alpha" as Id<"organizations">;
      const mockDb: DbMock = { get: vi.fn(async () => null) };
      const mockStorage: StorageMock = { getUrl: vi.fn(async () => null) };

      const result = await resolveAssetOrStorageUrl(
        { db: mockDb as never, storage: mockStorage as never },
        {
          assetId: undefined,
          storageId: undefined,
          organizationId: mockOrgId,
        }
      );

      expect(result).toBeNull();
    });

    it("Test 4 — Asset status pending: falls back to legacy Storage", async () => {
      const mockOrgId = "org_alpha" as Id<"organizations">;
      const mockAssetId = "asset_pending" as Id<"organization_assets">;
      const mockStorageId = "storage_fallback" as Id<"_storage">;

      const mockDb: DbMock = {
        get: vi.fn(async () => ({
          _id: mockAssetId,
          organizationId: mockOrgId,
          storageKey: "organizations/org_alpha/logo/logo.png",
          status: "pending",
        })),
      };

      const mockStorage: StorageMock = {
        getUrl: vi.fn(async () => "https://convex.cloud/api/storage/fallback-url"),
      };

      const result = await resolveAssetOrStorageUrl(
        { db: mockDb as never, storage: mockStorage as never },
        {
          assetId: mockAssetId,
          storageId: mockStorageId,
          organizationId: mockOrgId,
        }
      );

      expect(result).toBe("https://convex.cloud/api/storage/fallback-url");
      expect(mockStorage.getUrl).toHaveBeenCalledWith(mockStorageId);
    });

    it("Test 5 — Asset status deleted: falls back to legacy Storage", async () => {
      const mockOrgId = "org_alpha" as Id<"organizations">;
      const mockAssetId = "asset_deleted" as Id<"organization_assets">;
      const mockStorageId = "storage_fallback" as Id<"_storage">;

      const mockDb: DbMock = {
        get: vi.fn(async () => ({
          _id: mockAssetId,
          organizationId: mockOrgId,
          storageKey: "organizations/org_alpha/logo/logo.png",
          status: "deleted",
          deletedAt: Date.now(),
        })),
      };

      const mockStorage: StorageMock = {
        getUrl: vi.fn(async () => "https://convex.cloud/api/storage/fallback-url"),
      };

      const result = await resolveAssetOrStorageUrl(
        { db: mockDb as never, storage: mockStorage as never },
        {
          assetId: mockAssetId,
          storageId: mockStorageId,
          organizationId: mockOrgId,
        }
      );

      expect(result).toBe("https://convex.cloud/api/storage/fallback-url");
    });

    it("Test 6 — Asset record missing from DB: falls back to legacy Storage", async () => {
      const mockOrgId = "org_alpha" as Id<"organizations">;
      const mockAssetId = "asset_missing" as Id<"organization_assets">;
      const mockStorageId = "storage_fallback" as Id<"_storage">;

      const mockDb: DbMock = { get: vi.fn(async () => null) };
      const mockStorage: StorageMock = {
        getUrl: vi.fn(async () => "https://convex.cloud/api/storage/fallback-url"),
      };

      const result = await resolveAssetOrStorageUrl(
        { db: mockDb as never, storage: mockStorage as never },
        {
          assetId: mockAssetId,
          storageId: mockStorageId,
          organizationId: mockOrgId,
        }
      );

      expect(result).toBe("https://convex.cloud/api/storage/fallback-url");
    });

    it("Test 7 — Cross-organization asset: DENIED and falls back to storageId", async () => {
      const mockOrgAlpha = "org_alpha" as Id<"organizations">;
      const mockOrgBeta = "org_beta" as Id<"organizations">;
      const mockAssetId = "asset_beta" as Id<"organization_assets">;
      const mockStorageId = "storage_alpha" as Id<"_storage">;

      const mockDb: DbMock = {
        get: vi.fn(async () => ({
          _id: mockAssetId,
          organizationId: mockOrgBeta, // Belongs to Beta
          storageKey: "organizations/org_beta/secret/doc.pdf",
          status: "uploaded",
        })),
      };

      const mockStorage: StorageMock = {
        getUrl: vi.fn(async () => "https://convex.cloud/api/storage/alpha-fallback"),
      };

      // Alpha attempts to resolve Beta's asset
      const result = await resolveAssetOrStorageUrl(
        { db: mockDb as never, storage: mockStorage as never },
        {
          assetId: mockAssetId,
          storageId: mockStorageId,
          organizationId: mockOrgAlpha,
        }
      );

      // Should NOT return Beta's R2 URL, should fall back to Alpha's storage
      expect(result).toBe("https://convex.cloud/api/storage/alpha-fallback");
      expect(result).not.toContain("org_beta");
    });

    it("Test 8 — R2 URL generation failure: falls back gracefully to legacy storage without exposing secrets", async () => {
      const mockOrgId = "org_alpha" as Id<"organizations">;
      const mockAssetId = "asset_fail" as Id<"organization_assets">;
      const mockStorageId = "storage_fallback" as Id<"_storage">;

      // Delete R2 config to force R2 signing error
      delete process.env.R2_ACCOUNT_ID;

      const mockDb: DbMock = {
        get: vi.fn(async () => ({
          _id: mockAssetId,
          organizationId: mockOrgId,
          storageKey: "organizations/org_alpha/logo/logo.png",
          status: "uploaded",
        })),
      };

      const mockStorage: StorageMock = {
        getUrl: vi.fn(async () => "https://convex.cloud/api/storage/fallback-after-r2-fail"),
      };

      const result = await resolveAssetOrStorageUrl(
        { db: mockDb as never, storage: mockStorage as never },
        {
          assetId: mockAssetId,
          storageId: mockStorageId,
          organizationId: mockOrgId,
        }
      );

      expect(result).toBe("https://convex.cloud/api/storage/fallback-after-r2-fail");
    });
  });

  describe("2. Carousel Screen Resolution (toScreenResponse & toPublicResponse)", () => {
    it("Test 10 — should resolve assetId to R2 first with storageId fallback in toScreenResponse", async () => {
      const mockOrgId = "org_1" as Id<"organizations">;
      const mockAssetId = "asset_screen" as Id<"organization_assets">;
      const mockStorageId = "storage_screen" as Id<"_storage">;

      const mockDb: DbMock = {
        get: vi.fn(async (id: unknown) => {
          if (id === mockAssetId) {
            return {
              _id: mockAssetId,
              organizationId: mockOrgId,
              storageKey: "organizations/org_1/carousel_image/banner.webp",
              status: "uploaded",
            };
          }
          return null;
        }),
      };

      const mockStorage: StorageMock = {
        getUrl: vi.fn(async () => "https://convex.cloud/api/storage/legacy-banner"),
      };

      const doc: Doc<"organizationCarouselScreens"> = {
        _id: "screen_1" as Id<"organizationCarouselScreens">,
        _creationTime: 1000,
        position: 1,
        fileName: "banner.webp",
        storageId: mockStorageId,
        assetId: mockAssetId,
        createdAt: 1000,
        updatedAt: 1000,
      };

      const screenRes = await toScreenResponse({ db: mockDb as never, storage: mockStorage as never } as never, doc, mockOrgId);
      expect(screenRes.imageUrl).toContain("https://acc_test_123.r2.cloudflarestorage.com/pos-assets/organizations/org_1/carousel_image/banner.webp");
      expect(screenRes.assetId).toBe(mockAssetId);
      expect(screenRes.storageId).toBe(mockStorageId);

      const publicRes = await toPublicResponse({ db: mockDb as never, storage: mockStorage as never } as never, doc, mockOrgId);
      expect(publicRes.imageUrl).toContain("https://acc_test_123.r2.cloudflarestorage.com/pos-assets/organizations/org_1/carousel_image/banner.webp");
    });
  });

  describe("3. Organizations getStorageUrl Query", () => {
    it("Test 11 — should resolve assetId via R2 or storageId via Convex Storage", async () => {
      const mockOrgId = "org_1" as Id<"organizations">;
      const mockAssetId = "asset_logo" as Id<"organization_assets">;

      const mockDb: DbMock = {
        get: vi.fn(async (id: unknown) => {
          if (id === mockAssetId) {
            return {
              _id: mockAssetId,
              organizationId: mockOrgId,
              storageKey: "organizations/org_1/logo/logo.png",
              status: "uploaded",
            };
          }
          return null;
        }),
      };

      const mockStorage: StorageMock = {
        getUrl: vi.fn(async () => "https://convex.cloud/api/storage/logo-fallback"),
      };

      const handler = (getStorageUrl as unknown as GenericHandler<
        { storageId?: Id<"_storage">; assetId?: Id<"organization_assets">; organizationId?: Id<"organizations"> },
        string | null
      >)._handler;

      const result = await handler(
        { db: mockDb, storage: mockStorage },
        { assetId: mockAssetId, organizationId: mockOrgId }
      );

      expect(result).toContain("https://acc_test_123.r2.cloudflarestorage.com/pos-assets/organizations/org_1/logo/logo.png");
    });
  });

  describe("4. Menu Media Resolution (getOrganizationMenu, listCategoryItems, listAllItems)", () => {
    it("Test 9 — should resolve all item media types (image, 3D model, iOS 3D model, video) and customization images R2 first", async () => {
      const mockOrgId = "org_1" as Id<"organizations">;
      const mockMenuId = "menu_1" as Id<"menus">;
      const mockCategoryId = "cat_1" as Id<"categories">;
      const mockItemId = "item_1" as Id<"items">;
      const mockCustId = "cust_1" as Id<"customizations">;
      const mockCiId = "ci_1" as Id<"customizationItems">;

      const mockAssetImg = "asset_img" as Id<"organization_assets">;
      const mockAsset3d = "asset_3d" as Id<"organization_assets">;
      const mockAssetIos = "asset_ios" as Id<"organization_assets">;
      const mockAssetVid = "asset_vid" as Id<"organization_assets">;
      const mockAssetCust = "asset_cust" as Id<"organization_assets">;

      const assetsMap: Record<string, unknown> = {
        [mockAssetImg]: { _id: mockAssetImg, organizationId: mockOrgId, storageKey: "organizations/org_1/menu_image/dish.jpg", status: "uploaded" },
        [mockAsset3d]: { _id: mockAsset3d, organizationId: mockOrgId, storageKey: "organizations/org_1/menu_3d_model/dish.glb", status: "uploaded" },
        [mockAssetIos]: { _id: mockAssetIos, organizationId: mockOrgId, storageKey: "organizations/org_1/menu_3d_model_ios/dish.usdz", status: "uploaded" },
        [mockAssetVid]: { _id: mockAssetVid, organizationId: mockOrgId, storageKey: "organizations/org_1/menu_video/dish.mp4", status: "uploaded" },
        [mockAssetCust]: { _id: mockAssetCust, organizationId: mockOrgId, storageKey: "organizations/org_1/menu_image/cheese.jpg", status: "uploaded" },
      };

      const mockDb: DbMock = {
        get: vi.fn(async (id: unknown) => {
          if (typeof id === "string" && assetsMap[id]) return assetsMap[id];
          if (id === mockMenuId) return { _id: mockMenuId, organizationId: mockOrgId, isDefault: true, isActive: true };
          if (id === mockItemId) {
            return {
              _id: mockItemId,
              organizationId: mockOrgId,
              name: "Deluxe Pizza",
              price: 1500,
              published: true,
              imageAssetId: mockAssetImg,
              threeDModelAssetId: mockAsset3d,
              threeDModelIosAssetId: mockAssetIos,
              videoAssetId: mockAssetVid,
            };
          }
          if (id === mockCategoryId) return { _id: mockCategoryId, name: "Pizzas", published: true };
          return null;
        }),
        query: vi.fn((table: string) => ({
          withIndex: vi.fn(() => ({
            filter: vi.fn(() => ({
              collect: vi.fn(async () => {
                if (table === "menus") return [{ _id: mockMenuId, organizationId: mockOrgId, isDefault: true, isActive: true }];
                if (table === "categories") return [{ _id: mockCategoryId, menuId: mockMenuId, position: 1, published: true }];
                if (table === "categoryItems") return [{ _id: "ci_link_1", categoryId: mockCategoryId, itemId: mockItemId, position: 1, published: true }];
                if (table === "customizations") return [{ _id: mockCustId, itemId: mockItemId, name: "Crust", published: true, position: 1, customizationType: "AddOns" }];
                if (table === "customizationItems") return [{ _id: mockCiId, customizationId: mockCustId, name: "Cheese Burst", price: 200, isAvailable: true, position: 1, imageAssetId: mockAssetCust }];
                if (table === "items") return [{ _id: mockItemId, organizationId: mockOrgId, name: "Deluxe Pizza", price: 1500, published: true, imageAssetId: mockAssetImg }];
                return [];
              }),
            })),
          })),
          filter: vi.fn(() => ({
            first: vi.fn(async () => ({ _id: "ci_link_1", categoryId: mockCategoryId, itemId: mockItemId, published: true })),
            collect: vi.fn(async () => []),
          })),
        })),
      };

      const mockStorage: StorageMock = { getUrl: vi.fn(async () => null) };

      // 1. Test getOrganizationMenu
      type MenuResultItem = {
        category_item_id: string;
        item: Record<string, unknown>;
        item_image_url?: string;
        item_3d_image_url?: string;
        item_3d_image_for_ios_url?: string;
        item_video_url?: string;
        customizations: Array<{
          customization_items: Array<{
            customization_item_image_url: { original?: string };
          }>;
        }>;
      };
      type MenuResultEntry = {
        category: {
          id: string;
          items: MenuResultItem[];
        };
      };

      const menuHandler = (getOrganizationMenu as unknown as GenericHandler<{ organizationId: Id<"organizations"> }, MenuResultEntry[]>)._handler;
      const menuResult = await menuHandler({ db: mockDb, storage: mockStorage }, { organizationId: mockOrgId });

      expect(menuResult.length).toBe(1);
      const category = menuResult[0].category;
      expect(category.items.length).toBe(1);
      const itemEntry = category.items[0];

      expect(itemEntry.item_image_url).toContain("https://acc_test_123.r2.cloudflarestorage.com/pos-assets/organizations/org_1/menu_image/dish.jpg");
      expect(itemEntry.item_3d_image_url).toContain("https://acc_test_123.r2.cloudflarestorage.com/pos-assets/organizations/org_1/menu_3d_model/dish.glb");
      expect(itemEntry.item_3d_image_for_ios_url).toContain("https://acc_test_123.r2.cloudflarestorage.com/pos-assets/organizations/org_1/menu_3d_model_ios/dish.usdz");
      expect(itemEntry.item_video_url).toContain("https://acc_test_123.r2.cloudflarestorage.com/pos-assets/organizations/org_1/menu_video/dish.mp4");

      // Customization item image
      const custItem = itemEntry.customizations[0].customization_items[0];
      expect(custItem.customization_item_image_url.original).toContain("https://acc_test_123.r2.cloudflarestorage.com/pos-assets/organizations/org_1/menu_image/cheese.jpg");

      // 2. Test listCategoryItems
      type CatItemsResult = Array<{ item: { imageUrl?: string } }>;
      const listCatHandler = (listCategoryItems as unknown as GenericHandler<{ categoryId: Id<"categories"> }, CatItemsResult>)._handler;
      const catItemsResult = await listCatHandler({ db: mockDb, storage: mockStorage }, { categoryId: mockCategoryId });
      expect(catItemsResult[0].item.imageUrl).toContain("https://acc_test_123.r2.cloudflarestorage.com/pos-assets/organizations/org_1/menu_image/dish.jpg");

      // 3. Test listAllItems
      type AllItemsResult = Array<{ imageUrl?: string }>;
      const listAllHandler = (listAllItems as unknown as GenericHandler<{ organizationId: Id<"organizations"> }, AllItemsResult>)._handler;
      const allItemsResult = await listAllHandler({ db: mockDb, storage: mockStorage }, { organizationId: mockOrgId });
      expect(allItemsResult[0].imageUrl).toContain("https://acc_test_123.r2.cloudflarestorage.com/pos-assets/organizations/org_1/menu_image/dish.jpg");
    });
  });
});
