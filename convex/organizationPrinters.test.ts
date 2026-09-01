/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Organization Printers Domain Unit & Business Logic Tests", () => {
  // Helper: Setup store with an initial admin user
  async function setupStoreWithAdmin(adminClerkId = "user_admin_1") {
    const t = convexTest(schema, modules);

    // Create store organization with initial owner
    const orgId = await t.mutation(api.organizations.create, {
      name: "Printer Test Store",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    return { t, orgId, adminClerkId, asAdmin };
  }

  // 1. Creation Tests
  describe("Creation Logic & Validations", () => {
    test("Store Admin can create a Cashier printer", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const printerId = await asAdmin.mutation(api.organizationPrinters.create, {
        printerUrl: "192.168.1.100",
        printerPort: "9100",
        printerType: "Lan",
        printerUseFor: "Cashier",
      });

      expect(printerId).toBeDefined();

      const printer = await asAdmin.query(api.organizationPrinters.get, { id: printerId });
      expect(printer).not.toBeNull();
      expect(printer?.printerUrl).toBe("192.168.1.100");
      expect(printer?.printerPort).toBe("9100");
      expect(printer?.printerType).toBe("Lan");
      expect(printer?.printerUseFor).toBe("Cashier");
    });

    test("Cashier staff can create a printer", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      // Add a cashier user
      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_cashier_10",
        userType: ["cashier"],
      });

      const asCashier = t.withIdentity({ subject: "user_cashier_10" });

      const printerId = await asCashier.mutation(api.organizationPrinters.create, {
        printerUrl: "192.168.1.101",
        printerType: "Usb",
        printerUseFor: "WorkStation",
      });

      expect(printerId).toBeDefined();
    });

    test("Non-admin and non-cashier staff (e.g. waiter) cannot create a printer", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_waiter_1",
        userType: ["waiter"],
      });

      const asWaiter = t.withIdentity({ subject: "user_waiter_1" });

      await expect(
        asWaiter.mutation(api.organizationPrinters.create, {
          printerUrl: "192.168.1.102",
          printerType: "Bluetooth",
          printerUseFor: "WorkStation",
        })
      ).rejects.toThrow("Forbidden. Admin or Cashier access required.");
    });

    test("Non-admin and non-cashier staff (e.g. waiter) cannot update or remove a printer", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      const printerId = await asAdmin.mutation(api.organizationPrinters.create, {
        printerUrl: "192.168.1.100",
        printerType: "Lan",
        printerUseFor: "Cashier",
      });

      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_waiter_1",
        userType: ["waiter"],
      });

      const asWaiter = t.withIdentity({ subject: "user_waiter_1" });

      await expect(
        asWaiter.mutation(api.organizationPrinters.update, {
          id: printerId,
          printerUrl: "192.168.1.200",
        })
      ).rejects.toThrow("Forbidden. Admin or Cashier access required.");

      await expect(
        asWaiter.mutation(api.organizationPrinters.remove, {
          id: printerId,
        })
      ).rejects.toThrow("Forbidden. Admin or Cashier access required.");
    });

    test("Unauthenticated user cannot create, update, or remove a printer", async () => {
      const { t, asAdmin } = await setupStoreWithAdmin();

      const printerId = await asAdmin.mutation(api.organizationPrinters.create, {
        printerUrl: "192.168.1.100",
        printerType: "Lan",
        printerUseFor: "Cashier",
      });

      await expect(
        t.mutation(api.organizationPrinters.create, {
          printerUrl: "192.168.1.103",
          printerType: "Lan",
          printerUseFor: "WorkStation",
        })
      ).rejects.toThrow("Unauthenticated");

      await expect(
        t.mutation(api.organizationPrinters.update, {
          id: printerId,
          printerUrl: "192.168.1.200",
        })
      ).rejects.toThrow("Unauthenticated");

      await expect(
        t.mutation(api.organizationPrinters.remove, {
          id: printerId,
        })
      ).rejects.toThrow("Unauthenticated");
    });

    test("Blank or whitespace-only printerUrl is rejected", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await expect(
        asAdmin.mutation(api.organizationPrinters.create, {
          printerUrl: "",
          printerType: "Lan",
          printerUseFor: "Cashier",
        })
      ).rejects.toThrow("Printer URL can't be blank");

      await expect(
        asAdmin.mutation(api.organizationPrinters.create, {
          printerUrl: "   ",
          printerType: "Lan",
          printerUseFor: "Cashier",
        })
      ).rejects.toThrow("Printer URL can't be blank");
    });
  });

  // 2. Station Validation Tests
  describe("Station Reference Validations", () => {
    test("Lan + Station printer without stationId is rejected", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await expect(
        asAdmin.mutation(api.organizationPrinters.create, {
          printerUrl: "192.168.1.200",
          printerType: "Lan",
          printerUseFor: "Station",
        })
      ).rejects.toThrow("Station reference is required for LAN station printers.");
    });

    test("Lan + Station printer with stationId succeeds", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const printerId = await asAdmin.mutation(api.organizationPrinters.create, {
        printerUrl: "192.168.1.200",
        printerType: "Lan",
        printerUseFor: "Station",
        stationId: "station_uuid_123",
      });

      expect(printerId).toBeDefined();
      const printer = await asAdmin.query(api.organizationPrinters.get, { id: printerId });
      expect(printer?.stationId).toBe("station_uuid_123");
    });

    test("Cashier and WorkStation printers do not require stationId", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const cashierId = await asAdmin.mutation(api.organizationPrinters.create, {
        printerUrl: "192.168.1.201",
        printerType: "Lan",
        printerUseFor: "Cashier",
      });
      expect(cashierId).toBeDefined();

      const wsId = await asAdmin.mutation(api.organizationPrinters.create, {
        printerUrl: "192.168.1.202",
        printerType: "Usb",
        printerUseFor: "WorkStation",
      });
      expect(wsId).toBeDefined();
    });
  });

  // 3. Uniqueness Tests
  describe("Active Uniqueness of printerUseFor", () => {
    test("Enforces maximum 1 active printer per printerUseFor role per store", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationPrinters.create, {
        printerUrl: "192.168.1.50",
        printerType: "Lan",
        printerUseFor: "Cashier",
      });

      // Second Cashier printer fails
      await expect(
        asAdmin.mutation(api.organizationPrinters.create, {
          printerUrl: "192.168.1.51",
          printerType: "Usb",
          printerUseFor: "Cashier",
        })
      ).rejects.toThrow("Hey! Cashier printer is already taken.");
    });

    test("Soft-deleted printer does not block creation of new printer with same purpose", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const oldId = await asAdmin.mutation(api.organizationPrinters.create, {
        printerUrl: "192.168.1.60",
        printerType: "Lan",
        printerUseFor: "Cashier",
      });

      // Soft delete
      await asAdmin.mutation(api.organizationPrinters.remove, { id: oldId });

      // New Cashier printer creation succeeds
      const newId = await asAdmin.mutation(api.organizationPrinters.create, {
        printerUrl: "192.168.1.61",
        printerType: "Lan",
        printerUseFor: "Cashier",
      });

      expect(newId).toBeDefined();
    });
  });

  // 4. Listing & Get Tests
  describe("Listing & Read Operations", () => {
    test("Staff member can list active printers and exclude soft-deleted ones", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      const p1 = await asAdmin.mutation(api.organizationPrinters.create, {
        printerUrl: "192.168.1.70",
        printerType: "Lan",
        printerUseFor: "Cashier",
      });

      const p2 = await asAdmin.mutation(api.organizationPrinters.create, {
        printerUrl: "192.168.1.71",
        printerType: "Usb",
        printerUseFor: "WorkStation",
      });

      // Add a waiter staff member
      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_waiter_99",
        userType: ["waiter"],
      });

      const asWaiter = t.withIdentity({ subject: "user_waiter_99" });

      let listRes = await asWaiter.query(api.organizationPrinters.list, {});
      expect(listRes).toHaveLength(2);

      // Soft delete p1
      await asAdmin.mutation(api.organizationPrinters.remove, { id: p1 });

      listRes = await asWaiter.query(api.organizationPrinters.list, {});
      expect(listRes).toHaveLength(1);
      expect(listRes[0]._id).toBe(p2);
    });

    test("Get returns active printer and null for soft-deleted printer", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const pId = await asAdmin.mutation(api.organizationPrinters.create, {
        printerUrl: "192.168.1.80",
        printerType: "Bluetooth",
        printerUseFor: "WorkStation",
      });

      const active = await asAdmin.query(api.organizationPrinters.get, { id: pId });
      expect(active?.printerUrl).toBe("192.168.1.80");

      await asAdmin.mutation(api.organizationPrinters.remove, { id: pId });

      const deleted = await asAdmin.query(api.organizationPrinters.get, { id: pId });
      expect(deleted).toBeNull();
    });
  });

  // 5. Update Operations
  describe("Update Logic & Validations", () => {
    test("Store Admin can update printer attributes", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const pId = await asAdmin.mutation(api.organizationPrinters.create, {
        printerUrl: "192.168.1.90",
        printerPort: "9100",
        printerType: "Lan",
        printerUseFor: "Cashier",
      });

      await asAdmin.mutation(api.organizationPrinters.update, {
        id: pId,
        printerUrl: "192.168.1.99",
        printerPort: "9000",
        printerType: "Bluetooth",
      });

      const updated = await asAdmin.query(api.organizationPrinters.get, { id: pId });
      expect(updated?.printerUrl).toBe("192.168.1.99");
      expect(updated?.printerPort).toBe("9000");
      expect(updated?.printerType).toBe("Bluetooth");
    });

    test("Updating printer purpose checks uniqueness against other active printers", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationPrinters.create, {
        printerUrl: "192.168.1.10",
        printerType: "Lan",
        printerUseFor: "Cashier",
      });

      const p2 = await asAdmin.mutation(api.organizationPrinters.create, {
        printerUrl: "192.168.1.11",
        printerType: "Usb",
        printerUseFor: "WorkStation",
      });

      // Updating p2 purpose to Cashier collides with p1
      await expect(
        asAdmin.mutation(api.organizationPrinters.update, {
          id: p2,
          printerUseFor: "Cashier",
        })
      ).rejects.toThrow("Hey! Cashier printer is already taken.");
    });

    test("Updating a printer while preserving its own purpose succeeds", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const pId = await asAdmin.mutation(api.organizationPrinters.create, {
        printerUrl: "192.168.1.20",
        printerType: "Lan",
        printerUseFor: "Cashier",
      });

      await asAdmin.mutation(api.organizationPrinters.update, {
        id: pId,
        printerUrl: "192.168.1.25",
        printerUseFor: "Cashier",
      });

      const updated = await asAdmin.query(api.organizationPrinters.get, { id: pId });
      expect(updated?.printerUrl).toBe("192.168.1.25");
    });

    test("Soft-deleted printer cannot be updated", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const pId = await asAdmin.mutation(api.organizationPrinters.create, {
        printerUrl: "192.168.1.30",
        printerType: "Lan",
        printerUseFor: "Cashier",
      });

      await asAdmin.mutation(api.organizationPrinters.remove, { id: pId });

      await expect(
        asAdmin.mutation(api.organizationPrinters.update, {
          id: pId,
          printerUrl: "192.168.1.31",
        })
      ).rejects.toThrow("Printer not found");
    });
  });

  // 6. Soft Delete Tests
  describe("Soft Deletion Logic", () => {
    test("Remove sets deletedAt and frees up the printer purpose role", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const pId = await asAdmin.mutation(api.organizationPrinters.create, {
        printerUrl: "192.168.1.40",
        printerType: "Lan",
        printerUseFor: "Cashier",
      });

      const res = await asAdmin.mutation(api.organizationPrinters.remove, { id: pId });
      expect(res.success).toBe(true);

      const listRes = await asAdmin.query(api.organizationPrinters.list, {});
      expect(listRes).toHaveLength(0);

      // Freed Cashier purpose role can now be assigned to a new printer
      const newPId = await asAdmin.mutation(api.organizationPrinters.create, {
        printerUrl: "192.168.1.41",
        printerType: "Lan",
        printerUseFor: "Cashier",
      });
      expect(newPId).toBeDefined();
    });
  });

  // 7. Migration Compatibility Tests
  describe("Migration Traceability & Attributes", () => {
    test("Supports legacyId, createdAt, updatedAt, deletedAt attributes", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const legacyUuid = "prn-uuid-99887766";
      const customCreatedAt = 1672531199000;

      const pId = await asAdmin.mutation(api.organizationPrinters.create, {
        printerUrl: "192.168.1.111",
        printerType: "Lan",
        printerUseFor: "Cashier",
        legacyId: legacyUuid,
        createdAt: customCreatedAt,
      });

      const printer = await asAdmin.query(api.organizationPrinters.get, { id: pId });
      expect(printer?.legacyId).toBe(legacyUuid);
      expect(printer?.createdAt).toBe(customCreatedAt);
    });
  });
});
