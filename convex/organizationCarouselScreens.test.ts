/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Organization Carousel Screens Domain Unit & Integration Tests", () => {
  async function setupStoreWithAdmin(adminClerkId = "user_admin_99") {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Carousel Test Store",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    return { t, orgId, adminClerkId, asAdmin };
  }

  // 1. Creation & Auto Position
  describe("Creation & Auto Position", () => {
    test("Creation auto-generates position 1 when no active screens exist", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const screen = await asAdmin.mutation(
        api.organizationCarouselScreens.create,
        {
          fileName: "banner1.png",
          imageUrl: "https://example.com/banner1.png",
        }
      );

      expect(screen).toBeDefined();
      expect(screen.position).toBe(1);
      expect(screen.fileName).toBe("banner1.png");
      expect(screen.imageUrl).toBe("https://example.com/banner1.png");
    });

    test("Subsequent creations without position receive max_position + 1", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const s1 = await asAdmin.mutation(api.organizationCarouselScreens.create, {
        fileName: "s1.png",
      });
      const s2 = await asAdmin.mutation(api.organizationCarouselScreens.create, {
        fileName: "s2.png",
      });
      const s3 = await asAdmin.mutation(api.organizationCarouselScreens.create, {
        fileName: "s3.png",
      });

      expect(s1.position).toBe(1);
      expect(s2.position).toBe(2);
      expect(s3.position).toBe(3);
    });

    test("Creation with explicit position stores requested position", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const screen = await asAdmin.mutation(
        api.organizationCarouselScreens.create,
        {
          position: 10,
          fileName: "explicit.png",
        }
      );

      expect(screen.position).toBe(10);
    });
  });

  // 2. Public V3 Playback & Queries
  describe("Public V3 Playback & Queries", () => {
    test("listPublic allows unauthenticated access and returns active screens ordered by position ASC", async () => {
      const { t, asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationCarouselScreens.create, {
        position: 2,
        fileName: "second.png",
        imageUrl: "https://example.com/second.png",
      });

      await asAdmin.mutation(api.organizationCarouselScreens.create, {
        position: 1,
        fileName: "first.png",
        imageUrl: "https://example.com/first.png",
      });

      // Unauthenticated public V3 list query
      const publicList = await t.query(
        api.organizationCarouselScreens.listPublic,
        {}
      );

      expect(publicList.length).toBe(2);
      expect(publicList[0].position).toBe(1);
      expect(publicList[0].fileName).toBe("first.png");
      expect(publicList[1].position).toBe(2);
      expect(publicList[1].fileName).toBe("second.png");
    });

    test("getPublic returns safe public view of a single screen", async () => {
      const { t, asAdmin } = await setupStoreWithAdmin();

      const created = await asAdmin.mutation(
        api.organizationCarouselScreens.create,
        {
          fileName: "public_slide.png",
          imageUrl: "https://example.com/public.png",
        }
      );

      const publicScreen = await t.query(
        api.organizationCarouselScreens.getPublic,
        { id: created._id }
      );

      expect(publicScreen).not.toBeNull();
      expect(publicScreen?._id).toBe(created._id);
      expect(publicScreen?.fileName).toBe("public_slide.png");
    });
  });

  // 3. Reordering (acts_as_list Semantics)
  describe("Reordering (acts_as_list Semantics)", () => {
    test("reorder shifts positions atomically without creating duplicates", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const a = await asAdmin.mutation(api.organizationCarouselScreens.create, {
        fileName: "A",
      }); // pos 1
      const b = await asAdmin.mutation(api.organizationCarouselScreens.create, {
        fileName: "B",
      }); // pos 2
      const c = await asAdmin.mutation(api.organizationCarouselScreens.create, {
        fileName: "C",
      }); // pos 3
      const d = await asAdmin.mutation(api.organizationCarouselScreens.create, {
        fileName: "D",
      }); // pos 4

      // Move D (pos 4) -> pos 2
      await asAdmin.mutation(api.organizationCarouselScreens.reorder, {
        id: d._id,
        position: 2,
      });

      const list = await asAdmin.query(api.organizationCarouselScreens.list, {});
      const positions = list.map((item) => ({
        fileName: item.fileName,
        position: item.position,
      }));

      expect(positions).toEqual([
        { fileName: "A", position: 1 },
        { fileName: "D", position: 2 },
        { fileName: "B", position: 3 },
        { fileName: "C", position: 4 },
      ]);
    });
  });

  // 4. Updates & Soft Delete
  describe("Updates & Soft Delete", () => {
    test("update modifies image and position", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const screen = await asAdmin.mutation(
        api.organizationCarouselScreens.create,
        {
          fileName: "old.png",
          imageUrl: "https://example.com/old.png",
        }
      );

      const updated = await asAdmin.mutation(
        api.organizationCarouselScreens.update,
        {
          id: screen._id,
          fileName: "new.png",
          imageUrl: "https://example.com/new.png",
        }
      );

      expect(updated.fileName).toBe("new.png");
      expect(updated.imageUrl).toBe("https://example.com/new.png");
    });

    test("remove soft-deletes screen and excludes it from active and public queries", async () => {
      const { t, asAdmin } = await setupStoreWithAdmin();

      const screen = await asAdmin.mutation(
        api.organizationCarouselScreens.create,
        {
          fileName: "temp.png",
        }
      );

      await asAdmin.mutation(api.organizationCarouselScreens.remove, {
        id: screen._id,
      });

      const list = await asAdmin.query(api.organizationCarouselScreens.list, {});
      expect(list.some((s) => s._id === screen._id)).toBe(false);

      const publicList = await t.query(
        api.organizationCarouselScreens.listPublic,
        {}
      );
      expect(publicList.some((s) => s._id === screen._id)).toBe(false);
    });
  });

  // 5. Authorization Boundary Checks
  describe("Authorization Boundary Checks", () => {
    test("Staff/Waiter cannot create, update, reorder, or remove screens", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_waiter_55",
        userType: ["waiter"],
      });

      const asWaiter = t.withIdentity({ subject: "user_waiter_55" });

      const list = await asWaiter.query(
        api.organizationCarouselScreens.list,
        {}
      );
      expect(Array.isArray(list)).toBe(true);

      await expect(
        asWaiter.mutation(api.organizationCarouselScreens.create, {
          fileName: "Forbidden.png",
        })
      ).rejects.toThrow("Forbidden. Admin or Cashier access required.");
    });
  });

  // 6. R2 Asset ID Support
  describe("R2 Asset ID Support", () => {
    test("Can create and update carousel screen with R2 assetId", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      const assetId = await t.run(async (ctx) => {
        return await ctx.db.insert("organization_assets", {
          organizationId: orgId,
          storageKey: `organizations/${orgId}/carousel_image/banner1.jpg`,
          fileName: "banner1.jpg",
          contentType: "image/jpeg",
          fileSize: 4096,
          assetType: "carousel_image",
          status: "uploaded",
          createdBy: "user_admin_99",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const created = await asAdmin.mutation(
        api.organizationCarouselScreens.create,
        {
          fileName: "banner1.jpg",
          assetId,
        }
      );

      expect(created.assetId).toBe(assetId);

      // Verify list returns assetId
      const list = await asAdmin.query(api.organizationCarouselScreens.list, {});
      const found = list.find((s) => s._id === created._id);
      expect(found?.assetId).toBe(assetId);

      // Update with new assetId
      const newAssetId = await t.run(async (ctx) => {
        return await ctx.db.insert("organization_assets", {
          organizationId: orgId,
          storageKey: `organizations/${orgId}/carousel_image/banner2.jpg`,
          fileName: "banner2.jpg",
          contentType: "image/jpeg",
          fileSize: 8192,
          assetType: "carousel_image",
          status: "uploaded",
          createdBy: "user_admin_99",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const updated = await asAdmin.mutation(
        api.organizationCarouselScreens.update,
        {
          id: created._id,
          assetId: newAssetId,
        }
      );

      expect(updated.assetId).toBe(newAssetId);
    });
  });
});
