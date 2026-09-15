/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Digital Storefront Images Domain Unit & Business Logic Tests", () => {
  async function setupStoreWithAdmin(adminClerkId = "user_admin_1") {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Digital Store Test",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    // Helper: Create an uploaded asset
    async function createMockAsset(
      assetType = "carousel_image",
      status: "uploaded" | "pending" | "failed" | "deleted" = "uploaded",
      overrideOrgId?: any
    ) {
      const targetOrg = overrideOrgId ?? orgId;
      const assetId = await t.mutation(api.organizationAssets.createPending, {
        organizationId: targetOrg,
        storageKey: `org_${targetOrg}/images/${Date.now()}_${Math.random()}.webp`,
        fileName: "banner.webp",
        contentType: "image/webp",
        fileSize: 1024 * 500,
        assetType,
      });

      if (status === "uploaded") {
        await t.mutation(api.organizationAssets.markUploaded, { assetId });
      } else if (status === "failed") {
        await t.mutation(api.organizationAssets.markFailed, { assetId });
      } else if (status === "deleted") {
        await t.mutation(api.organizationAssets.markDeleted, { assetId });
      }

      return assetId;
    }

    return { t, orgId, adminClerkId, asAdmin, createMockAsset };
  }

  // ----------------------------------------------------
  // 1. CREATION TESTS
  // ----------------------------------------------------
  describe("Creation Logic & Position Sequences", () => {
    test("Admin can create carousel image and gets auto-assigned position 1", async () => {
      const { asAdmin, createMockAsset } = await setupStoreWithAdmin();
      const assetId = await createMockAsset("carousel_image");

      const created = await asAdmin.mutation(
        api.digitalStoreImages.createDigitalStoreImage,
        {
          assetId,
          imageType: "carousel_image",
        }
      );

      expect(created).toBeDefined();
      expect(created?.imageType).toBe("carousel_image");
      expect(created?.position).toBe(1);
      expect(created?.assetId).toBe(assetId);
    });

    test("Subsequent carousel images auto-increment position (2, 3...)", async () => {
      const { asAdmin, createMockAsset } = await setupStoreWithAdmin();
      const asset1 = await createMockAsset("carousel_image");
      const asset2 = await createMockAsset("carousel_image");

      const img1 = await asAdmin.mutation(
        api.digitalStoreImages.createDigitalStoreImage,
        {
          assetId: asset1,
          imageType: "carousel_image",
        }
      );

      const img2 = await asAdmin.mutation(
        api.digitalStoreImages.createDigitalStoreImage,
        {
          assetId: asset2,
          imageType: "carousel_image",
        }
      );

      expect(img1?.position).toBe(1);
      expect(img2?.position).toBe(2);
    });

    test("About Us images maintain an independent position sequence starting at 1", async () => {
      const { asAdmin, createMockAsset } = await setupStoreWithAdmin();
      const carouselAsset = await createMockAsset("carousel_image");
      const aboutUsAsset = await createMockAsset("about_us_image");

      const carouselImg = await asAdmin.mutation(
        api.digitalStoreImages.createDigitalStoreImage,
        {
          assetId: carouselAsset,
          imageType: "carousel_image",
        }
      );

      const aboutUsImg = await asAdmin.mutation(
        api.digitalStoreImages.createDigitalStoreImage,
        {
          assetId: aboutUsAsset,
          imageType: "about_us_image",
        }
      );

      expect(carouselImg?.position).toBe(1);
      expect(aboutUsImg?.position).toBe(1); // Separate sequence!
    });

    test("Rejects creation if asset is still in pending status", async () => {
      const { asAdmin, createMockAsset } = await setupStoreWithAdmin();
      const pendingAsset = await createMockAsset("carousel_image", "pending");

      await expect(
        asAdmin.mutation(api.digitalStoreImages.createDigitalStoreImage, {
          assetId: pendingAsset,
          imageType: "carousel_image",
        })
      ).rejects.toThrow("Asset upload is not completed");
    });

    test("Rejects creation if asset belongs to another organization", async () => {
      const { t, asAdmin, createMockAsset } = await setupStoreWithAdmin();

      // Create a second store
      const otherOrgId = await t.mutation(api.organizations.create, {
        name: "Second Store",
        ownerClerkId: "other_user",
      });

      const otherAsset = await createMockAsset(
        "carousel_image",
        "uploaded",
        otherOrgId
      );

      await expect(
        asAdmin.mutation(api.digitalStoreImages.createDigitalStoreImage, {
          assetId: otherAsset,
          imageType: "carousel_image",
        })
      ).rejects.toThrow("does not belong to current store organization");
    });
  });

  // ----------------------------------------------------
  // 2. QUERY TESTS
  // ----------------------------------------------------
  describe("Public Storefront Queries & Sorting", () => {
    test("listStorefrontImages returns active images sorted ascending by position", async () => {
      const { t, asAdmin, createMockAsset } = await setupStoreWithAdmin();
      const asset1 = await createMockAsset("carousel_image");
      const asset2 = await createMockAsset("carousel_image");

      await asAdmin.mutation(api.digitalStoreImages.createDigitalStoreImage, {
        assetId: asset1,
        imageType: "carousel_image",
      });

      await asAdmin.mutation(api.digitalStoreImages.createDigitalStoreImage, {
        assetId: asset2,
        imageType: "carousel_image",
      });

      // Public / guest caller
      const publicList = await t.query(
        api.digitalStoreImages.listStorefrontImages,
        {
          imageType: "carousel_image",
        }
      );

      expect(publicList).toHaveLength(2);
      expect(publicList[0].position).toBe(1);
      expect(publicList[1].position).toBe(2);
    });

    test("Filters correctly by imageType", async () => {
      const { t, asAdmin, createMockAsset } = await setupStoreWithAdmin();
      const asset1 = await createMockAsset("carousel_image");
      const asset2 = await createMockAsset("about_us_image");

      await asAdmin.mutation(api.digitalStoreImages.createDigitalStoreImage, {
        assetId: asset1,
        imageType: "carousel_image",
      });

      await asAdmin.mutation(api.digitalStoreImages.createDigitalStoreImage, {
        assetId: asset2,
        imageType: "about_us_image",
      });

      const carouselOnly = await t.query(
        api.digitalStoreImages.listStorefrontImages,
        {
          imageType: "carousel_image",
        }
      );

      const aboutUsOnly = await t.query(
        api.digitalStoreImages.listStorefrontImages,
        {
          imageType: "about_us_image",
        }
      );

      expect(carouselOnly).toHaveLength(1);
      expect(carouselOnly[0].imageType).toBe("carousel_image");

      expect(aboutUsOnly).toHaveLength(1);
      expect(aboutUsOnly[0].imageType).toBe("about_us_image");
    });

    test("Soft-deleted images are excluded from list results", async () => {
      const { t, asAdmin, createMockAsset } = await setupStoreWithAdmin();
      const asset1 = await createMockAsset("carousel_image");
      const asset2 = await createMockAsset("carousel_image");

      const img1 = await asAdmin.mutation(
        api.digitalStoreImages.createDigitalStoreImage,
        {
          assetId: asset1,
          imageType: "carousel_image",
        }
      );

      await asAdmin.mutation(api.digitalStoreImages.createDigitalStoreImage, {
        assetId: asset2,
        imageType: "carousel_image",
      });

      // Delete first image
      await asAdmin.mutation(api.digitalStoreImages.removeDigitalStoreImage, {
        id: img1!._id,
      });

      const list = await t.query(api.digitalStoreImages.listStorefrontImages, {
        imageType: "carousel_image",
      });

      expect(list).toHaveLength(1);
      expect(list[0].assetId).toBe(asset2);
    });
  });

  // ----------------------------------------------------
  // 3. REORDERING TESTS
  // ----------------------------------------------------
  describe("Transactional Reordering", () => {
    test("Admin can reorder images sequentially (1..N)", async () => {
      const { asAdmin, createMockAsset } = await setupStoreWithAdmin();
      const a1 = await createMockAsset("carousel_image");
      const a2 = await createMockAsset("carousel_image");
      const a3 = await createMockAsset("carousel_image");

      const img1 = await asAdmin.mutation(
        api.digitalStoreImages.createDigitalStoreImage,
        { assetId: a1, imageType: "carousel_image" }
      );
      const img2 = await asAdmin.mutation(
        api.digitalStoreImages.createDigitalStoreImage,
        { assetId: a2, imageType: "carousel_image" }
      );
      const img3 = await asAdmin.mutation(
        api.digitalStoreImages.createDigitalStoreImage,
        { assetId: a3, imageType: "carousel_image" }
      );

      // Reorder to [img3, img1, img2]
      const reorderRes = await asAdmin.mutation(
        api.digitalStoreImages.reorderImages,
        {
          imageType: "carousel_image",
          imageIds: [img3!._id, img1!._id, img2!._id],
        }
      );

      expect(reorderRes.success).toBe(true);

      const updated3 = await asAdmin.query(
        api.digitalStoreImages.getDigitalStoreImage,
        { id: img3!._id }
      );
      const updated1 = await asAdmin.query(
        api.digitalStoreImages.getDigitalStoreImage,
        { id: img1!._id }
      );
      const updated2 = await asAdmin.query(
        api.digitalStoreImages.getDigitalStoreImage,
        { id: img2!._id }
      );

      expect(updated3?.position).toBe(1);
      expect(updated1?.position).toBe(2);
      expect(updated2?.position).toBe(3);
    });

    test("Rejects reordering with duplicate IDs", async () => {
      const { asAdmin, createMockAsset } = await setupStoreWithAdmin();
      const a1 = await createMockAsset("carousel_image");
      const img1 = await asAdmin.mutation(
        api.digitalStoreImages.createDigitalStoreImage,
        { assetId: a1, imageType: "carousel_image" }
      );

      await expect(
        asAdmin.mutation(api.digitalStoreImages.reorderImages, {
          imageType: "carousel_image",
          imageIds: [img1!._id, img1!._id],
        })
      ).rejects.toThrow("Duplicate image IDs detected");
    });

    test("Rejects reordering with mixed image types", async () => {
      const { asAdmin, createMockAsset } = await setupStoreWithAdmin();
      const cAsset = await createMockAsset("carousel_image");
      const aAsset = await createMockAsset("about_us_image");

      const carouselImg = await asAdmin.mutation(
        api.digitalStoreImages.createDigitalStoreImage,
        { assetId: cAsset, imageType: "carousel_image" }
      );
      const aboutUsImg = await asAdmin.mutation(
        api.digitalStoreImages.createDigitalStoreImage,
        { assetId: aAsset, imageType: "about_us_image" }
      );

      await expect(
        asAdmin.mutation(api.digitalStoreImages.reorderImages, {
          imageType: "carousel_image",
          imageIds: [carouselImg!._id, aboutUsImg!._id],
        })
      ).rejects.toThrow("does not match target imageType");
    });

    test("updateImagePosition moves image forward (e.g. 2 -> 4) and shifts siblings without gaps or duplicates", async () => {
      const { asAdmin, createMockAsset } = await setupStoreWithAdmin();
      const a1 = await createMockAsset("carousel_image");
      const a2 = await createMockAsset("carousel_image");
      const a3 = await createMockAsset("carousel_image");
      const a4 = await createMockAsset("carousel_image");

      const img1 = await asAdmin.mutation(api.digitalStoreImages.createDigitalStoreImage, {
        assetId: a1,
        imageType: "carousel_image",
      });
      const img2 = await asAdmin.mutation(api.digitalStoreImages.createDigitalStoreImage, {
        assetId: a2,
        imageType: "carousel_image",
      });
      const img3 = await asAdmin.mutation(api.digitalStoreImages.createDigitalStoreImage, {
        assetId: a3,
        imageType: "carousel_image",
      });
      const img4 = await asAdmin.mutation(api.digitalStoreImages.createDigitalStoreImage, {
        assetId: a4,
        imageType: "carousel_image",
      });

      // Initially: img1=1, img2=2, img3=3, img4=4
      // Move img2 (position 2) -> position 4
      await asAdmin.mutation(api.digitalStoreImages.updateImagePosition, {
        id: img2!._id,
        position: 4,
      });

      const res1 = await asAdmin.query(api.digitalStoreImages.getDigitalStoreImage, { id: img1!._id });
      const res2 = await asAdmin.query(api.digitalStoreImages.getDigitalStoreImage, { id: img2!._id });
      const res3 = await asAdmin.query(api.digitalStoreImages.getDigitalStoreImage, { id: img3!._id });
      const res4 = await asAdmin.query(api.digitalStoreImages.getDigitalStoreImage, { id: img4!._id });

      // Expected order: img1 (1), img3 (2), img4 (3), img2 (4)
      expect(res1?.position).toBe(1);
      expect(res3?.position).toBe(2);
      expect(res4?.position).toBe(3);
      expect(res2?.position).toBe(4);

      // Verify storefront list ordering matches expected sequence [img1, img3, img4, img2]
      const publicList = await asAdmin.query(api.digitalStoreImages.listStorefrontImages, {
        imageType: "carousel_image",
      });
      expect(publicList.map((i) => i._id)).toEqual([
        img1!._id,
        img3!._id,
        img4!._id,
        img2!._id,
      ]);
      expect(publicList.map((i) => i.position)).toEqual([1, 2, 3, 4]);
    });

    test("updateImagePosition moves image backward (e.g. 4 -> 2) and shifts siblings", async () => {
      const { asAdmin, createMockAsset } = await setupStoreWithAdmin();
      const a1 = await createMockAsset("carousel_image");
      const a2 = await createMockAsset("carousel_image");
      const a3 = await createMockAsset("carousel_image");
      const a4 = await createMockAsset("carousel_image");

      const img1 = await asAdmin.mutation(api.digitalStoreImages.createDigitalStoreImage, {
        assetId: a1,
        imageType: "carousel_image",
      });
      const img2 = await asAdmin.mutation(api.digitalStoreImages.createDigitalStoreImage, {
        assetId: a2,
        imageType: "carousel_image",
      });
      const img3 = await asAdmin.mutation(api.digitalStoreImages.createDigitalStoreImage, {
        assetId: a3,
        imageType: "carousel_image",
      });
      const img4 = await asAdmin.mutation(api.digitalStoreImages.createDigitalStoreImage, {
        assetId: a4,
        imageType: "carousel_image",
      });

      // Move img4 (position 4) -> position 2
      await asAdmin.mutation(api.digitalStoreImages.updateImagePosition, {
        id: img4!._id,
        position: 2,
      });

      const res1 = await asAdmin.query(api.digitalStoreImages.getDigitalStoreImage, { id: img1!._id });
      const res2 = await asAdmin.query(api.digitalStoreImages.getDigitalStoreImage, { id: img2!._id });
      const res3 = await asAdmin.query(api.digitalStoreImages.getDigitalStoreImage, { id: img3!._id });
      const res4 = await asAdmin.query(api.digitalStoreImages.getDigitalStoreImage, { id: img4!._id });

      // Expected order: img1 (1), img4 (2), img2 (3), img3 (4)
      expect(res1?.position).toBe(1);
      expect(res4?.position).toBe(2);
      expect(res2?.position).toBe(3);
      expect(res3?.position).toBe(4);
    });

    test("updateImagePosition clamps oversized positions and preserves continuous sequence", async () => {
      const { asAdmin, createMockAsset } = await setupStoreWithAdmin();
      const a1 = await createMockAsset("carousel_image");
      const a2 = await createMockAsset("carousel_image");

      const img1 = await asAdmin.mutation(api.digitalStoreImages.createDigitalStoreImage, {
        assetId: a1,
        imageType: "carousel_image",
      });
      const img2 = await asAdmin.mutation(api.digitalStoreImages.createDigitalStoreImage, {
        assetId: a2,
        imageType: "carousel_image",
      });

      // Pass position 50 when only 2 images exist
      await asAdmin.mutation(api.digitalStoreImages.updateImagePosition, {
        id: img1!._id,
        position: 50,
      });

      const res1 = await asAdmin.query(api.digitalStoreImages.getDigitalStoreImage, { id: img1!._id });
      const res2 = await asAdmin.query(api.digitalStoreImages.getDigitalStoreImage, { id: img2!._id });

      // img1 clamped to position 2 (last), img2 shifted to position 1
      expect(res2?.position).toBe(1);
      expect(res1?.position).toBe(2);
    });
  });

  // ----------------------------------------------------
  // 4. DELETION & CASCADING TESTS
  // ----------------------------------------------------
  describe("Deletion & Cascading Cleanup", () => {
    test("Deleting storefront image marks asset deleted when no active references remain", async () => {
      const { asAdmin, createMockAsset } = await setupStoreWithAdmin();
      const assetId = await createMockAsset("carousel_image");

      const img = await asAdmin.mutation(
        api.digitalStoreImages.createDigitalStoreImage,
        {
          assetId,
          imageType: "carousel_image",
        }
      );

      const deleteRes = await asAdmin.mutation(
        api.digitalStoreImages.removeDigitalStoreImage,
        { id: img!._id }
      );

      expect(deleteRes.success).toBe(true);

      const assetDoc = await asAdmin.query(api.organizationAssets.get, {
        id: assetId,
      });
      // Asset is marked deleted
      expect(assetDoc).toBeNull();
    });

    test("Repeated deletion is idempotent", async () => {
      const { asAdmin, createMockAsset } = await setupStoreWithAdmin();
      const assetId = await createMockAsset("carousel_image");

      const img = await asAdmin.mutation(
        api.digitalStoreImages.createDigitalStoreImage,
        {
          assetId,
          imageType: "carousel_image",
        }
      );

      await asAdmin.mutation(api.digitalStoreImages.removeDigitalStoreImage, {
        id: img!._id,
      });

      const secondDelete = await asAdmin.mutation(
        api.digitalStoreImages.removeDigitalStoreImage,
        { id: img!._id }
      );

      expect(secondDelete.success).toBe(true);
      expect(secondDelete.alreadyDeleted).toBe(true);
    });
  });

  // ----------------------------------------------------
  // 5. AUTHORIZATION TESTS
  // ----------------------------------------------------
  describe("Role-Based Authorization", () => {
    test("Cashier staff can create and manage storefront images", async () => {
      const { t, orgId, asAdmin, createMockAsset } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_cashier_5",
        userType: ["cashier"],
      });

      const asCashier = t.withIdentity({ subject: "user_cashier_5" });
      const assetId = await createMockAsset("carousel_image");

      const created = await asCashier.mutation(
        api.digitalStoreImages.createDigitalStoreImage,
        {
          assetId,
          imageType: "carousel_image",
        }
      );

      expect(created).toBeDefined();
    });

    test("Non-staff (e.g. Waiter / Customer) cannot create storefront images", async () => {
      const { t, orgId, asAdmin, createMockAsset } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_waiter_9",
        userType: ["waiter"],
      });

      const asWaiter = t.withIdentity({ subject: "user_waiter_9" });
      const assetId = await createMockAsset("carousel_image");

      await expect(
        asWaiter.mutation(api.digitalStoreImages.createDigitalStoreImage, {
          assetId,
          imageType: "carousel_image",
        })
      ).rejects.toThrow("Forbidden. Admin or Cashier access required.");
    });

    test("Unauthenticated user cannot create storefront images", async () => {
      const { t, createMockAsset } = await setupStoreWithAdmin();
      const assetId = await createMockAsset("carousel_image");

      await expect(
        t.mutation(api.digitalStoreImages.createDigitalStoreImage, {
          assetId,
          imageType: "carousel_image",
        })
      ).rejects.toThrow("Unauthenticated");
    });
  });
});
