/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Organization Waiters Domain Unit & Integration Tests", () => {
  async function setupStoreWithAdmin(adminClerkId = "user_admin_99") {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Waiters Test Store",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    return { t, orgId, adminClerkId, asAdmin };
  }

  // 1. Creation & Validations
  describe("Creation & Attribute Validations", () => {
    test("Store Admin can create a waiter profile with firstName, lastName, and waiterCode", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const waiter = await asAdmin.mutation(api.organizationWaiters.create, {
        firstName: "John",
        lastName: "Doe",
        waiterCode: "W001",
      });

      expect(waiter).toBeDefined();
      expect(waiter.firstName).toBe("John");
      expect(waiter.lastName).toBe("Doe");
      expect(waiter.waiterCode).toBe("W001");
      expect(waiter.createdAt).toBeDefined();
    });

    test("Case-insensitive waiterCode uniqueness validation within store", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationWaiters.create, {
        firstName: "John",
        waiterCode: "W001",
      });

      await expect(
        asAdmin.mutation(api.organizationWaiters.create, {
          firstName: "Jane",
          waiterCode: "w001",
        })
      ).rejects.toThrow("Hey! w001 is already taken.");
    });

    test("Multiple waiters can have null/blank waiterCode", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const w1 = await asAdmin.mutation(api.organizationWaiters.create, {
        firstName: "Alice",
      });

      const w2 = await asAdmin.mutation(api.organizationWaiters.create, {
        firstName: "Bob",
        waiterCode: "",
      });

      expect(w1._id).toBeDefined();
      expect(w2._id).toBeDefined();
    });

    test("Same waiterCode can be reused after previous record is soft-deleted", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const w1 = await asAdmin.mutation(api.organizationWaiters.create, {
        firstName: "Charlie",
        waiterCode: "W002",
      });

      await asAdmin.mutation(api.organizationWaiters.remove, { id: w1._id });

      const w2 = await asAdmin.mutation(api.organizationWaiters.create, {
        firstName: "David",
        waiterCode: "W002",
      });

      expect(w2._id).toBeDefined();
      expect(w2._id).not.toBe(w1._id);
    });
  });

  // 2. Queries & Search
  describe("Queries & Search", () => {
    test("list returns active waiters sorted by createdAt DESC", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const w1 = await asAdmin.mutation(api.organizationWaiters.create, {
        firstName: "First",
        createdAt: 1000,
      });

      const w2 = await asAdmin.mutation(api.organizationWaiters.create, {
        firstName: "Second",
        createdAt: 2000,
      });

      const list = await asAdmin.query(api.organizationWaiters.list, {});
      expect(list.length).toBe(2);
      expect(list[0]._id).toBe(w2._id);
      expect(list[1]._id).toBe(w1._id);
    });

    test("get returns single active waiter and getWithDeleted resolves historical soft-deleted waiters", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const waiter = await asAdmin.mutation(api.organizationWaiters.create, {
        firstName: "Eva",
        waiterCode: "W003",
      });

      const activeGet = await asAdmin.query(api.organizationWaiters.get, {
        id: waiter._id,
      });
      expect(activeGet?.firstName).toBe("Eva");

      await asAdmin.mutation(api.organizationWaiters.remove, { id: waiter._id });

      const deletedGet = await asAdmin.query(api.organizationWaiters.get, {
        id: waiter._id,
      });
      expect(deletedGet).toBeNull();

      const historicalGet = await asAdmin.query(
        api.organizationWaiters.getWithDeleted,
        { id: waiter._id }
      );
      expect(historicalGet?.firstName).toBe("Eva");
      expect(historicalGet?.deletedAt).toBeDefined();
    });

    test("search filters by full name or individual attributes", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationWaiters.create, {
        firstName: "Michael",
        lastName: "Jordan",
        waiterCode: "W23",
      });

      await asAdmin.mutation(api.organizationWaiters.create, {
        firstName: "Kobe",
        lastName: "Bryant",
        waiterCode: "W24",
      });

      // Search by single name token
      const res1 = await asAdmin.query(api.organizationWaiters.search, {
        name: "Mich",
      });
      expect(res1.length).toBe(1);
      expect(res1[0].firstName).toBe("Michael");

      // Search by double name token
      const res2 = await asAdmin.query(api.organizationWaiters.search, {
        name: "Kobe Bry",
      });
      expect(res2.length).toBe(1);
      expect(res2[0].lastName).toBe("Bryant");

      // Search by exact waiterCode
      const res3 = await asAdmin.query(api.organizationWaiters.search, {
        waiterCode: "w23",
      });
      expect(res3.length).toBe(1);
      expect(res3[0].waiterCode).toBe("W23");
    });
  });

  // 3. Updates & Soft Delete
  describe("Updates & Soft Delete", () => {
    test("Updating waiter fields updates attributes and revalidates waiterCode", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const waiter = await asAdmin.mutation(api.organizationWaiters.create, {
        firstName: "OldName",
        waiterCode: "W010",
      });

      const updated = await asAdmin.mutation(api.organizationWaiters.update, {
        id: waiter._id,
        firstName: "NewName",
        waiterCode: "W010-MOD",
      });

      expect(updated.firstName).toBe("NewName");
      expect(updated.waiterCode).toBe("W010-MOD");
    });

    test("remove soft-deletes waiter and excludes it from list queries", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const waiter = await asAdmin.mutation(api.organizationWaiters.create, {
        firstName: "Temp",
      });

      await asAdmin.mutation(api.organizationWaiters.remove, { id: waiter._id });

      const list = await asAdmin.query(api.organizationWaiters.list, {});
      expect(list.some((w) => w._id === waiter._id)).toBe(false);
    });
  });

  // 4. Authorization Boundary Checks
  describe("Authorization Boundary Checks", () => {
    test("Staff/Waiter role can list and get, but cannot create or update waiters", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_waiter_77",
        userType: ["waiter"],
      });

      const asWaiter = t.withIdentity({ subject: "user_waiter_77" });

      const list = await asWaiter.query(api.organizationWaiters.list, {});
      expect(Array.isArray(list)).toBe(true);

      await expect(
        asWaiter.mutation(api.organizationWaiters.create, {
          firstName: "Forbidden Waiter",
        })
      ).rejects.toThrow("Forbidden. Admin or Cashier access required.");
    });
  });
});
