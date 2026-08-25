/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Organization Layouts Domain Unit & Business Logic Tests", () => {
  // Helper: Setup store with an initial admin user
  async function setupStoreWithAdmin(adminClerkId = "user_admin_1") {
    const t = convexTest(schema, modules);

    // Create store organization with initial owner
    const orgId = await t.mutation(api.organizations.create, {
      name: "Grand Palace Store",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    return { t, orgId, adminClerkId, asAdmin };
  }

  // 1. Creation Tests
  describe("Creation Logic & Validations", () => {
    test("Store Admin can create a layout with normalized name and displayOrder", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const layoutId = await asAdmin.mutation(api.organizationLayouts.create, {
        name: "  Patio  ",
        displayOrder: 1,
      });

      expect(layoutId).toBeDefined();

      const layout = await asAdmin.query(api.organizationLayouts.get, { id: layoutId });
      expect(layout).not.toBeNull();
      expect(layout?.name).toBe("Patio");
      expect(layout?.displayOrder).toBe(1);
    });

    test("Non-admin store member cannot create a layout", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      // Create a cashier staff member
      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_cashier_1",
        userType: ["cashier"],
      });

      const asCashier = t.withIdentity({ subject: "user_cashier_1" });

      await expect(
        asCashier.mutation(api.organizationLayouts.create, {
          name: "VIP Lounge",
        })
      ).rejects.toThrow("Forbidden. Admin access required.");
    });

    test("Unauthenticated user cannot create a layout", async () => {
      const { t } = await setupStoreWithAdmin();

      await expect(
        t.mutation(api.organizationLayouts.create, {
          name: "Rooftop",
        })
      ).rejects.toThrow("Unauthenticated");
    });

    test("Blank or whitespace-only name is rejected", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await expect(
        asAdmin.mutation(api.organizationLayouts.create, {
          name: "",
        })
      ).rejects.toThrow("Name can't be blank");

      await expect(
        asAdmin.mutation(api.organizationLayouts.create, {
          name: "   ",
        })
      ).rejects.toThrow("Name can't be blank");
    });

    test("Duplicate active name is rejected case-insensitively", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationLayouts.create, {
        name: "Main Dining Room",
      });

      await expect(
        asAdmin.mutation(api.organizationLayouts.create, {
          name: "main dining room",
        })
      ).rejects.toThrow("Hey! main dining room is already taken.");
    });

    test("Soft-deleted layout name can be reused for a new layout", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const oldId = await asAdmin.mutation(api.organizationLayouts.create, {
        name: "Terrace",
      });

      // Soft delete layout
      await asAdmin.mutation(api.organizationLayouts.remove, { id: oldId });

      // Creating a new layout with the same name is permitted
      const newId = await asAdmin.mutation(api.organizationLayouts.create, {
        name: "Terrace",
      });

      expect(newId).toBeDefined();
      const newLayout = await asAdmin.query(api.organizationLayouts.get, { id: newId });
      expect(newLayout?.name).toBe("Terrace");
    });
  });

  // 2. Listing & Read Tests
  describe("Listing & Get Operations", () => {
    test("Authenticated store member can list active layouts and exclude soft-deleted ones", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const l1 = await asAdmin.mutation(api.organizationLayouts.create, {
        name: "Indoor Hall",
      });

      const l2 = await asAdmin.mutation(api.organizationLayouts.create, {
        name: "Poolside",
      });

      let listRes = await asAdmin.query(api.organizationLayouts.list, {});
      expect(listRes).toHaveLength(2);

      // Soft delete l1
      await asAdmin.mutation(api.organizationLayouts.remove, { id: l1 });

      listRes = await asAdmin.query(api.organizationLayouts.list, {});
      expect(listRes).toHaveLength(1);
      expect(listRes[0]._id).toBe(l2);
    });

    test("Get returns active layout and null for missing or soft-deleted layout", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const lId = await asAdmin.mutation(api.organizationLayouts.create, {
        name: "Balcony",
      });

      const active = await asAdmin.query(api.organizationLayouts.get, { id: lId });
      expect(active?.name).toBe("Balcony");

      await asAdmin.mutation(api.organizationLayouts.remove, { id: lId });

      const deleted = await asAdmin.query(api.organizationLayouts.get, { id: lId });
      expect(deleted).toBeNull();
    });
  });

  // 3. Update Operations
  describe("Update Logic & Validations", () => {
    test("Admin can update layout name and displayOrder", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const lId = await asAdmin.mutation(api.organizationLayouts.create, {
        name: "Garden",
        displayOrder: 5,
      });

      await asAdmin.mutation(api.organizationLayouts.update, {
        id: lId,
        name: "  Beer Garden  ",
        displayOrder: 2,
      });

      const updated = await asAdmin.query(api.organizationLayouts.get, { id: lId });
      expect(updated?.name).toBe("Beer Garden");
      expect(updated?.displayOrder).toBe(2);
    });

    test("Update validates duplicate names case-insensitively", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationLayouts.create, {
        name: "Zone A",
      });

      const l2 = await asAdmin.mutation(api.organizationLayouts.create, {
        name: "Zone B",
      });

      await expect(
        asAdmin.mutation(api.organizationLayouts.update, {
          id: l2,
          name: "zone a",
        })
      ).rejects.toThrow("Hey! zone a is already taken.");
    });

    test("Updating layout to its own current name succeeds", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const lId = await asAdmin.mutation(api.organizationLayouts.create, {
        name: "Basement",
      });

      await asAdmin.mutation(api.organizationLayouts.update, {
        id: lId,
        name: "BASEMENT",
      });

      const updated = await asAdmin.query(api.organizationLayouts.get, { id: lId });
      expect(updated?.name).toBe("BASEMENT");
    });

    test("Soft-deleted layout cannot be updated", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const lId = await asAdmin.mutation(api.organizationLayouts.create, {
        name: "Sky Deck",
      });

      await asAdmin.mutation(api.organizationLayouts.remove, { id: lId });

      await expect(
        asAdmin.mutation(api.organizationLayouts.update, {
          id: lId,
          name: "New Sky Deck",
        })
      ).rejects.toThrow("Layout not found");
    });
  });

  // 4. Soft Delete Tests
  describe("Soft Deletion Logic", () => {
    test("Remove sets deletedAt and removes layout from listing", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const lId = await asAdmin.mutation(api.organizationLayouts.create, {
        name: "Deck",
      });

      const res = await asAdmin.mutation(api.organizationLayouts.remove, { id: lId });
      expect(res.success).toBe(true);

      const listRes = await asAdmin.query(api.organizationLayouts.list, {});
      expect(listRes.find((l) => l._id === lId)).toBeUndefined();
    });
  });

  // 5. Store Provisioning Integration Tests
  describe("Store Provisioning Initialization Flow", () => {
    test("initializeStore seeds Indoor-DineIn layout idempotently", async () => {
      const t = convexTest(schema, modules);

      const orgId = await t.mutation(api.organizations.create, {
        name: "Provisioning Test Store",
      });

      // Run initializeStore
      await t.mutation(api.organizations.initializeStore, { id: orgId });

      const admin = t.withIdentity({ subject: "admin_tester" });

      // Create admin user membership
      await t.mutation(api.organizations.createInitialOwner, {
        organizationId: orgId,
        ownerClerkId: "admin_tester",
      });

      let layouts = await admin.query(api.organizationLayouts.list, {});
      expect(layouts.some((l) => l.name === "Indoor-DineIn")).toBe(true);

      const indoorCountFirst = layouts.filter((l) => l.name === "Indoor-DineIn").length;
      expect(indoorCountFirst).toBe(1);

      // Re-run initializeStore (idempotency check)
      await t.mutation(api.organizations.initializeStore, { id: orgId });

      layouts = await admin.query(api.organizationLayouts.list, {});
      const indoorCountSecond = layouts.filter((l) => l.name === "Indoor-DineIn").length;
      expect(indoorCountSecond).toBe(1);
    });

    test("initializeStore creates new active Indoor-DineIn if existing one was soft-deleted", async () => {
      const t = convexTest(schema, modules);

      const orgId = await t.mutation(api.organizations.create, {
        name: "Re-provisioning Store",
      });

      await t.mutation(api.organizations.initializeStore, { id: orgId });

      await t.mutation(api.organizations.createInitialOwner, {
        organizationId: orgId,
        ownerClerkId: "admin_tester_2",
      });

      const admin = t.withIdentity({ subject: "admin_tester_2" });

      let layouts = await admin.query(api.organizationLayouts.list, {});
      const indoorLayout = layouts.find((l) => l.name === "Indoor-DineIn");
      expect(indoorLayout).toBeDefined();

      // Soft delete Indoor-DineIn
      await admin.mutation(api.organizationLayouts.remove, { id: indoorLayout!._id });

      layouts = await admin.query(api.organizationLayouts.list, {});
      expect(layouts.find((l) => l.name === "Indoor-DineIn")).toBeUndefined();

      // Re-run initializeStore
      await t.mutation(api.organizations.initializeStore, { id: orgId });

      layouts = await admin.query(api.organizationLayouts.list, {});
      expect(layouts.some((l) => l.name === "Indoor-DineIn")).toBe(true);
    });
  });
});
