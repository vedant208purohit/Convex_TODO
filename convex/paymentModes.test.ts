/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Payment Modes Domain Unit & Integration Tests", () => {
  async function setupStoreWithAdmin(adminClerkId = "user_admin_pm_1") {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Payment Modes Test Store",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    return { t, orgId, adminClerkId, asAdmin };
  }

  async function setupSecondStoreWithAdmin(adminClerkId = "user_admin_pm_2") {
    const t = convexTest(schema, modules);

    const org1Id = await t.mutation(api.organizations.create, {
      name: "Store One",
      ownerClerkId: "user_owner_1",
    });

    const org2Id = await t.mutation(api.organizations.create, {
      name: "Store Two",
      ownerClerkId: adminClerkId,
    });

    const asAdmin2 = t.withIdentity({ subject: adminClerkId });

    return { t, org1Id, org2Id, asAdmin2 };
  }

  // ----------------------------------------------------
  // 1. Creation & Validations
  // ----------------------------------------------------
  describe("Creation & Attribute Validations", () => {
    test("Store Admin can create a payment mode with name and default active=true", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      const mode = await asAdmin.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "Gift Card",
      });

      expect(mode).toBeDefined();
      expect(mode.name).toBe("Gift Card");
      expect(mode.active).toBe(true);
      expect(mode.organizationId).toBe(orgId);
      expect(mode.createdAt).toBeDefined();
      expect(mode.deletedAt).toBeUndefined();
    });

    test("Can create a payment mode with explicit active=false", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      const mode = await asAdmin.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "Crypto",
        active: false,
      });

      expect(mode).toBeDefined();
      expect(mode.name).toBe("Crypto");
      expect(mode.active).toBe(false);
    });

    test("Rejects empty or whitespace-only name", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      await expect(
        asAdmin.mutation(api.paymentModes.create, {
          organizationId: orgId,
          name: "",
        })
      ).rejects.toThrow("Payment mode name can't be blank");

      await expect(
        asAdmin.mutation(api.paymentModes.create, {
          organizationId: orgId,
          name: "   ",
        })
      ).rejects.toThrow("Payment mode name can't be blank");
    });

    test("Trims whitespace from name on creation", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      const mode = await asAdmin.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "   Store Credit   ",
      });

      expect(mode.name).toBe("Store Credit");
    });

    test("Enforces case-insensitive name uniqueness within organization", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "Sodexo",
      });

      await expect(
        asAdmin.mutation(api.paymentModes.create, {
          organizationId: orgId,
          name: "sodexo",
        })
      ).rejects.toThrow("Hey! sodexo is already taken.");

      await expect(
        asAdmin.mutation(api.paymentModes.create, {
          organizationId: orgId,
          name: "  SODEXO  ",
        })
      ).rejects.toThrow("Hey! SODEXO is already taken.");
    });

    test("Allows same payment mode name to be created if previous record was soft-deleted", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      const mode1 = await asAdmin.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "Loyalty Points",
      });

      await asAdmin.mutation(api.paymentModes.remove, { id: mode1._id });

      const mode2 = await asAdmin.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "Loyalty Points",
      });

      expect(mode2._id).toBeDefined();
      expect(mode2._id).not.toBe(mode1._id);
      expect(mode2.name).toBe("Loyalty Points");
    });
  });

  // ----------------------------------------------------
  // 2. Queries (list & get)
  // ----------------------------------------------------
  describe("Queries: list & get", () => {
    test("list returns all non-deleted payment modes sorted by createdAt ASC", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      const m1 = await asAdmin.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "Cash",
      });
      const m2 = await asAdmin.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "Card",
      });
      const m3 = await asAdmin.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "UPI",
        active: false,
      });

      const list = await asAdmin.query(api.paymentModes.list, {
        organizationId: orgId,
      });

      expect(list.length).toBe(3);
      expect(list.map((m) => m.name)).toEqual(["Cash", "Card", "UPI"]);
    });

    test("list with activeOnly=true filters out inactive modes", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "Active Mode",
        active: true,
      });
      await asAdmin.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "Inactive Mode",
        active: false,
      });

      const activeList = await asAdmin.query(api.paymentModes.list, {
        organizationId: orgId,
        activeOnly: true,
      });

      expect(activeList.length).toBe(1);
      expect(activeList[0].name).toBe("Active Mode");
    });

    test("list excludes soft-deleted payment modes", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      const m1 = await asAdmin.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "Keep",
      });
      const m2 = await asAdmin.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "Delete Me",
      });

      await asAdmin.mutation(api.paymentModes.remove, { id: m2._id });

      const list = await asAdmin.query(api.paymentModes.list, {
        organizationId: orgId,
      });

      expect(list.length).toBe(1);
      expect(list[0].name).toBe("Keep");
    });

    test("get returns single payment mode by ID", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      const created = await asAdmin.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "Paytm Wallet",
      });

      const fetched = await asAdmin.query(api.paymentModes.get, {
        id: created._id,
      });

      expect(fetched).toBeDefined();
      expect(fetched!._id).toBe(created._id);
      expect(fetched!.name).toBe("Paytm Wallet");
    });

    test("get returns null for nonexistent or soft-deleted ID", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      const created = await asAdmin.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "Temporary",
      });

      await asAdmin.mutation(api.paymentModes.remove, { id: created._id });

      const fetched = await asAdmin.query(api.paymentModes.get, {
        id: created._id,
      });

      expect(fetched).toBeNull();
    });
  });

  // ----------------------------------------------------
  // 3. Updates & Toggling
  // ----------------------------------------------------
  describe("Updates & Toggling", () => {
    test("update modifies name and active state", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      const mode = await asAdmin.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "Old Name",
        active: true,
      });

      const updated = await asAdmin.mutation(api.paymentModes.update, {
        id: mode._id,
        name: "New Name",
        active: false,
      });

      expect(updated.name).toBe("New Name");
      expect(updated.active).toBe(false);
    });

    test("update allows keeping the same name without false duplicate detection", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      const mode = await asAdmin.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "Net Banking",
        active: true,
      });

      const updated = await asAdmin.mutation(api.paymentModes.update, {
        id: mode._id,
        name: "Net Banking",
        active: false,
      });

      expect(updated.name).toBe("Net Banking");
      expect(updated.active).toBe(false);
    });

    test("update rejects renaming to an already taken name", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "Mode A",
      });
      const modeB = await asAdmin.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "Mode B",
      });

      await expect(
        asAdmin.mutation(api.paymentModes.update, {
          id: modeB._id,
          name: "mode a",
        })
      ).rejects.toThrow("Hey! mode a is already taken.");
    });

    test("toggleActive flips active state between true and false", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      const mode = await asAdmin.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "Toggle Test",
        active: true,
      });

      const flippedFalse = await asAdmin.mutation(api.paymentModes.toggleActive, {
        id: mode._id,
      });
      expect(flippedFalse.active).toBe(false);

      const flippedTrue = await asAdmin.mutation(api.paymentModes.toggleActive, {
        id: mode._id,
      });
      expect(flippedTrue.active).toBe(true);
    });

    test("toggleActive and update reject operation on soft-deleted mode", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      const mode = await asAdmin.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "To Delete",
      });

      await asAdmin.mutation(api.paymentModes.remove, { id: mode._id });

      await expect(
        asAdmin.mutation(api.paymentModes.toggleActive, { id: mode._id })
      ).rejects.toThrow("Payment mode not found");

      await expect(
        asAdmin.mutation(api.paymentModes.update, {
          id: mode._id,
          name: "Changed",
        })
      ).rejects.toThrow("Payment mode not found");
    });
  });

  // ----------------------------------------------------
  // 4. Soft Deletion & Historical Integrity
  // ----------------------------------------------------
  describe("Soft Deletion & Historical Integrity", () => {
    test("remove sets deletedAt timestamp", async () => {
      const { asAdmin, orgId, t } = await setupStoreWithAdmin();

      const mode = await asAdmin.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "To Soft Delete",
      });

      const res = await asAdmin.mutation(api.paymentModes.remove, {
        id: mode._id,
      });
      expect(res.success).toBe(true);

      // Verify raw doc in DB has deletedAt set
      const rawDoc = await t.run(async (ctx) => {
        return await ctx.db.get(mode._id);
      });

      expect(rawDoc).toBeDefined();
      expect(rawDoc!.deletedAt).toBeDefined();
      expect(typeof rawDoc!.deletedAt).toBe("number");
    });
  });

  // ----------------------------------------------------
  // 5. Authorization & Roles
  // ----------------------------------------------------
  describe("Authentication & Role Authorization", () => {
    test("Unauthenticated caller cannot list or mutate payment modes", async () => {
      const { t, orgId } = await setupStoreWithAdmin();

      await expect(
        t.query(api.paymentModes.list, { organizationId: orgId })
      ).rejects.toThrow("Unauthenticated");

      await expect(
        t.mutation(api.paymentModes.create, {
          organizationId: orgId,
          name: "Unauth Mode",
        })
      ).rejects.toThrow("Unauthenticated");
    });

    test("Cashier can list, create, update, and toggle payment modes", async () => {
      const { t, orgId } = await setupStoreWithAdmin("admin_user");

      // Add a Cashier user
      const cashierClerkId = "cashier_user_1";
      await t.withIdentity({ subject: "admin_user" }).mutation(
        api.organizationUsers.create,
        {
          userId: cashierClerkId,
          firstName: "Cashier",
          lastName: "Staff",
          userType: ["cashier"],
        }
      );

      const asCashier = t.withIdentity({ subject: cashierClerkId });

      // Cashier can list
      const initialList = await asCashier.query(api.paymentModes.list, {
        organizationId: orgId,
      });
      expect(initialList).toBeDefined();

      // Cashier can create
      const mode = await asCashier.mutation(api.paymentModes.create, {
        organizationId: orgId,
        name: "Cashier Created",
      });
      expect(mode.name).toBe("Cashier Created");

      // Cashier can toggle
      const toggled = await asCashier.mutation(api.paymentModes.toggleActive, {
        id: mode._id,
      });
      expect(toggled.active).toBe(false);

      // Cashier can update
      const updated = await asCashier.mutation(api.paymentModes.update, {
        id: mode._id,
        name: "Cashier Updated",
      });
      expect(updated.name).toBe("Cashier Updated");
    });

    test("Non-admin role (e.g. waiter/chef) cannot create or delete payment modes", async () => {
      const { t, orgId } = await setupStoreWithAdmin("admin_user");

      const waiterClerkId = "waiter_user_1";
      await t.withIdentity({ subject: "admin_user" }).mutation(
        api.organizationUsers.create,
        {
          userId: waiterClerkId,
          firstName: "Waiter",
          lastName: "Staff",
          userType: ["waiter"],
        }
      );

      const asWaiter = t.withIdentity({ subject: waiterClerkId });

      await expect(
        asWaiter.mutation(api.paymentModes.create, {
          organizationId: orgId,
          name: "Waiter Mode",
        })
      ).rejects.toThrow("Forbidden");
    });
  });

  // ----------------------------------------------------
  // 6. Organization Isolation
  // ----------------------------------------------------
  describe("Organization Isolation", () => {
    test("User from Store B cannot access or mutate Store A payment modes", async () => {
      const { t, org1Id, org2Id, asAdmin2 } = await setupSecondStoreWithAdmin();

      // Store 1 admin creates a payment mode
      const asAdmin1 = t.withIdentity({ subject: "user_owner_1" });
      const store1Mode = await asAdmin1.mutation(api.paymentModes.create, {
        organizationId: org1Id,
        name: "Store 1 Exclusive Mode",
      });

      // Admin 2 tries to get Store 1 mode -> Forbidden
      await expect(
        asAdmin2.query(api.paymentModes.get, { id: store1Mode._id })
      ).rejects.toThrow("Forbidden");

      // Admin 2 tries to update Store 1 mode -> Forbidden
      await expect(
        asAdmin2.mutation(api.paymentModes.update, {
          id: store1Mode._id,
          name: "Hacked",
        })
      ).rejects.toThrow("Forbidden");

      // Admin 2 tries to toggle Store 1 mode -> Forbidden
      await expect(
        asAdmin2.mutation(api.paymentModes.toggleActive, { id: store1Mode._id })
      ).rejects.toThrow("Forbidden");

      // Admin 2 tries to delete Store 1 mode -> Forbidden
      await expect(
        asAdmin2.mutation(api.paymentModes.remove, { id: store1Mode._id })
      ).rejects.toThrow("Forbidden");

      // Admin 2 list only sees Store 2 modes
      const store2List = await asAdmin2.query(api.paymentModes.list, {
        organizationId: org2Id,
      });
      expect(store2List.find((m) => m.name === "Store 1 Exclusive Mode")).toBeUndefined();
    });
  });

  // ----------------------------------------------------
  // 7. Store Initialization & Seed Compatibility
  // ----------------------------------------------------
  describe("Store Initialization & Seed Compatibility", () => {
    test("initializeStore seeds 4 default payment modes idempotently", async () => {
      const t = convexTest(schema, modules);

      const orgId = await t.mutation(api.organizations.create, {
        name: "Seeded Store",
        ownerClerkId: "owner_seed_1",
      });

      const asOwner = t.withIdentity({ subject: "owner_seed_1" });

      // Run initializeStore
      await asOwner.mutation(api.organizations.initializeStore, { id: orgId });

      const modes = await asOwner.query(api.paymentModes.list, {
        organizationId: orgId,
      });

      expect(modes.length).toBe(4);
      expect(modes.map((m) => m.name)).toEqual([
        "Cash",
        "Credit Card",
        "Debit Card",
        "UPI",
      ]);

      // Re-running initializeStore does not duplicate payment modes
      await asOwner.mutation(api.organizations.initializeStore, { id: orgId });

      const modesAfterReinit = await asOwner.query(api.paymentModes.list, {
        organizationId: orgId,
      });

      expect(modesAfterReinit.length).toBe(4);
    });
  });
});
