/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Organization Tables Domain Unit & Business Logic Tests", () => {
  async function setupStoreWithAdmin(adminClerkId = "user_admin_1") {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Tables Test Store",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    return { t, orgId, adminClerkId, asAdmin };
  }

  // 1. Creation Tests
  describe("Creation Logic & Validations", () => {
    test("Store Admin can create an organization table with explicit coordinates", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const tableId = await asAdmin.mutation(api.organizationTables.create, {
        tableNumber: "T1",
        seatingCapacity: 4,
        placement: "Indoor",
        xPosition: "100",
        yPosition: "100",
      });

      expect(tableId).toBeDefined();

      const tableDoc = await asAdmin.query(api.organizationTables.get, { id: tableId });
      expect(tableDoc).not.toBeNull();
      expect(tableDoc?.tableNumber).toBe("T1");
      expect(tableDoc?.seatingCapacity).toBe(4);
      expect(tableDoc?.placement).toBe("Indoor");
      expect(tableDoc?.xPosition).toBe("100");
      expect(tableDoc?.yPosition).toBe("100");
      expect(tableDoc?.kidsSeatAvailability).toBe(false);
      expect(tableDoc?.disabledSeatAvailability).toBe(false);
      expect(tableDoc?.barbequeGrillAvailability).toBe(false);
      expect(tableDoc?.isBlock).toBe(false);
      expect(tableDoc?.isRequested).toBe(false);
    });

    test("Cashier staff can create a table", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_cashier_10",
        userType: ["cashier"],
      });

      const asCashier = t.withIdentity({ subject: "user_cashier_10" });

      const tableId = await asCashier.mutation(api.organizationTables.create, {
        tableNumber: "T2",
        seatingCapacity: 2,
      });

      expect(tableId).toBeDefined();
    });

    test("Non-admin/non-cashier staff (e.g. waiter) cannot create a table", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_waiter_1",
        userType: ["waiter"],
      });

      const asWaiter = t.withIdentity({ subject: "user_waiter_1" });

      await expect(
        asWaiter.mutation(api.organizationTables.create, {
          tableNumber: "T3",
          seatingCapacity: 4,
        })
      ).rejects.toThrow("Forbidden. Admin or Cashier access required.");
    });

    test("Unauthenticated user cannot create a table", async () => {
      const { t } = await setupStoreWithAdmin();

      await expect(
        t.mutation(api.organizationTables.create, {
          tableNumber: "T4",
          seatingCapacity: 4,
        })
      ).rejects.toThrow("Unauthenticated");
    });

    test("Blank or whitespace table number fails and whitespace is trimmed", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await expect(
        asAdmin.mutation(api.organizationTables.create, {
          tableNumber: "",
          seatingCapacity: 4,
        })
      ).rejects.toThrow("Table number can't be blank");

      await expect(
        asAdmin.mutation(api.organizationTables.create, {
          tableNumber: "   ",
          seatingCapacity: 4,
        })
      ).rejects.toThrow("Table number can't be blank");

      // Valid table number with whitespace gets trimmed
      const id = await asAdmin.mutation(api.organizationTables.create, {
        tableNumber: "  T5  ",
        seatingCapacity: 4,
      });
      const doc = await asAdmin.query(api.organizationTables.get, { id });
      expect(doc?.tableNumber).toBe("T5");
    });

    test("Invalid seating capacity fails validation", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await expect(
        asAdmin.mutation(api.organizationTables.create, {
          tableNumber: "T6",
          seatingCapacity: 0,
        })
      ).rejects.toThrow("Seating capacity must be a positive integer");

      await expect(
        asAdmin.mutation(api.organizationTables.create, {
          tableNumber: "T7",
          seatingCapacity: -2,
        })
      ).rejects.toThrow("Seating capacity must be a positive integer");

      await expect(
        asAdmin.mutation(api.organizationTables.create, {
          tableNumber: "T8",
          seatingCapacity: 3.5,
        })
      ).rejects.toThrow("Seating capacity must be a positive integer");
    });
  });

  // 2. Uniqueness Tests
  describe("Table Number Uniqueness Scope", () => {
    test("Duplicate active table number in the same layout is rejected case-insensitively", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const layoutId = await asAdmin.mutation(api.organizationLayouts.create, {
        name: "Main Hall",
      });

      await asAdmin.mutation(api.organizationTables.create, {
        tableNumber: "T1",
        seatingCapacity: 4,
        layoutId,
      });

      await expect(
        asAdmin.mutation(api.organizationTables.create, {
          tableNumber: "t1",
          seatingCapacity: 2,
          layoutId,
        })
      ).rejects.toThrow("Hey! t1 is already taken.");
    });

    test("Same table number in different layouts is allowed", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const layout1 = await asAdmin.mutation(api.organizationLayouts.create, { name: "Indoor" });
      const layout2 = await asAdmin.mutation(api.organizationLayouts.create, { name: "Patio" });

      const t1 = await asAdmin.mutation(api.organizationTables.create, {
        tableNumber: "T1",
        seatingCapacity: 4,
        layoutId: layout1,
      });

      const t2 = await asAdmin.mutation(api.organizationTables.create, {
        tableNumber: "T1",
        seatingCapacity: 4,
        layoutId: layout2,
      });

      expect(t1).toBeDefined();
      expect(t2).toBeDefined();
    });

    test("Soft-deleted table number can be reused", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const oldId = await asAdmin.mutation(api.organizationTables.create, {
        tableNumber: "T1",
        seatingCapacity: 4,
      });

      await asAdmin.mutation(api.organizationTables.remove, { id: oldId });

      const newId = await asAdmin.mutation(api.organizationTables.create, {
        tableNumber: "T1",
        seatingCapacity: 4,
      });

      expect(newId).toBeDefined();
    });
  });

  // 3. Automatic Grid Coordinates Math
  describe("Automatic Grid Coordinates Math", () => {
    test("Coordinates auto-generate when omitted (60, 60 for first table)", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const t1 = await asAdmin.mutation(api.organizationTables.create, {
        tableNumber: "A1",
        seatingCapacity: 4,
      });

      const doc1 = await asAdmin.query(api.organizationTables.get, { id: t1 });
      expect(doc1?.xPosition).toBe("60");
      expect(doc1?.yPosition).toBe("60");

      // Second table receives second grid coordinate (220, 60)
      const t2 = await asAdmin.mutation(api.organizationTables.create, {
        tableNumber: "A2",
        seatingCapacity: 4,
      });

      const doc2 = await asAdmin.query(api.organizationTables.get, { id: t2 });
      expect(doc2?.xPosition).toBe("220");
      expect(doc2?.yPosition).toBe("60");
    });
  });

  // 4. Update & Clear Order Operations
  describe("Update & Clear Order Operations", () => {
    test("Store Admin can update table attributes and revalidate uniqueness", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const layout1 = await asAdmin.mutation(api.organizationLayouts.create, { name: "L1" });
      const layout2 = await asAdmin.mutation(api.organizationLayouts.create, { name: "L2" });

      const tableId = await asAdmin.mutation(api.organizationTables.create, {
        tableNumber: "OldNumber",
        seatingCapacity: 2,
        layoutId: layout1,
      });

      await asAdmin.mutation(api.organizationTables.update, {
        id: tableId,
        tableNumber: "NewNumber",
        seatingCapacity: 6,
        layoutId: layout2,
        isBlock: true,
      });

      const updated = await asAdmin.query(api.organizationTables.get, { id: tableId });
      expect(updated?.tableNumber).toBe("NewNumber");
      expect(updated?.seatingCapacity).toBe(6);
      expect(updated?.layoutId).toBe(layout2);
      expect(updated?.isBlock).toBe(true);
    });

    test("clearOrder resets currentOrderId, isRequested, and isBlock flags atomically", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const tableId = await asAdmin.mutation(api.organizationTables.create, {
        tableNumber: "T10",
        seatingCapacity: 4,
        isBlock: true,
        isRequested: true,
        currentOrderId: "order_legacy_999",
      });

      await asAdmin.mutation(api.organizationTables.clearOrder, { id: tableId });

      const cleared = await asAdmin.query(api.organizationTables.get, { id: tableId });
      expect(cleared?.currentOrderId).toBeUndefined();
      expect(cleared?.isRequested).toBe(false);
      expect(cleared?.isBlock).toBe(false);
    });
  });

  // 5. Soft Delete Operations
  describe("Soft Delete Operations", () => {
    test("Remove soft deletes table and excludes it from list & get", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const tableId = await asAdmin.mutation(api.organizationTables.create, {
        tableNumber: "T100",
        seatingCapacity: 4,
      });

      await asAdmin.mutation(api.organizationTables.remove, { id: tableId });

      const getDoc = await asAdmin.query(api.organizationTables.get, { id: tableId });
      expect(getDoc).toBeNull();

      const list = await asAdmin.query(api.organizationTables.list, {});
      expect(list.some((t) => t._id === tableId)).toBe(false);
    });
  });
});
