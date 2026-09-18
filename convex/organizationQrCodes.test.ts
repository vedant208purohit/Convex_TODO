/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Organization QR Codes Domain Unit & Integration Tests", () => {
  async function setupStoreWithAdmin(adminClerkId = "user_admin_99") {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "QR Test Store",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    return { t, orgId, adminClerkId, asAdmin };
  }

  // 1. Creation & Validations
  describe("Creation & Validations", () => {
    test("TakeAway and Queue QR code creation sets counter to 0 and builds qrUrl", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const qrTakeAway = await asAdmin.mutation(api.organizationQrCodes.create, {
        name: "Main Takeaway Counter",
        qrType: "TakeAway",
        description: "Counter #1 Takeaway QR",
      });

      expect(qrTakeAway).toBeDefined();
      expect(qrTakeAway.name).toBe("Main Takeaway Counter");
      expect(qrTakeAway.qrType).toBe("TakeAway");
      expect(qrTakeAway.counter).toBe(0);
      expect(qrTakeAway.qrUrl).toContain("type=TakeAway");
      expect(qrTakeAway.qrUrl).toContain(qrTakeAway._id);

      const qrQueue = await asAdmin.mutation(api.organizationQrCodes.create, {
        name: "Entrance Waitlist Queue",
        qrType: "Queue",
      });

      expect(qrQueue.qrType).toBe("Queue");
      expect(qrQueue.qrUrl).toContain("type=Queue");
    });

    test("DineIn creation requires a valid dining table reference", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await expect(
        asAdmin.mutation(api.organizationQrCodes.create, {
          name: "Orphan DineIn QR",
          qrType: "DineIn",
        })
      ).rejects.toThrow("Dining table reference is required for DineIn QR codes.");
    });

    test("DineIn creation succeeds when valid tableId and tableNumber are supplied", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const dineInQr = await asAdmin.mutation(api.organizationQrCodes.create, {
        name: "Table T-10",
        qrType: "DineIn",
        tableNumber: "T-10",
        tableId: "tbl_1001",
      });

      expect(dineInQr).toBeDefined();
      expect(dineInQr.name).toBe("Table T-10");
      expect(dineInQr.qrType).toBe("DineIn");
      expect(dineInQr.tableId).toBe("tbl_1001");
      expect(dineInQr.qrUrl).toContain("table_id=tbl_1001");
    });

    test("Duplicate active QR name throws validation error", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationQrCodes.create, {
        name: "TakeAway Front",
        qrType: "TakeAway",
      });

      await expect(
        asAdmin.mutation(api.organizationQrCodes.create, {
          name: "TakeAway Front",
          qrType: "TakeAway",
        })
      ).rejects.toThrow("Hey! TakeAway Front is already taken.");
    });

    test("Same name is allowed after previous record is soft-deleted", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const first = await asAdmin.mutation(api.organizationQrCodes.create, {
        name: "TakeAway Station",
        qrType: "TakeAway",
      });

      await asAdmin.mutation(api.organizationQrCodes.remove, { id: first._id });

      const second = await asAdmin.mutation(api.organizationQrCodes.create, {
        name: "TakeAway Station",
        qrType: "TakeAway",
      });

      expect(second).toBeDefined();
      expect(second._id).not.toBe(first._id);
    });
  });

  // 2. Public Resolution & Scan Counter
  describe("Public Resolution & Scan Counter", () => {
    test("resolvePublic resolves active QR code by Convex ID or Table ID", async () => {
      const { t, asAdmin } = await setupStoreWithAdmin();

      const qr = await asAdmin.mutation(api.organizationQrCodes.create, {
        name: "Table T-5",
        qrType: "DineIn",
        tableNumber: "T-5",
        tableId: "tbl_5005",
      });

      // Resolve by QR Convex ID
      const resolvedById = await t.query(api.organizationQrCodes.resolvePublic, {
        identifier: qr._id,
      });

      expect(resolvedById).not.toBeNull();
      expect(resolvedById?.name).toBe("Table T-5");

      // Resolve by Table ID
      const resolvedByTable = await t.query(api.organizationQrCodes.resolvePublic, {
        identifier: "tbl_5005",
      });

      expect(resolvedByTable).not.toBeNull();
      expect(resolvedByTable?._id).toBe(qr._id);
    });

    test("Public incrementCounter increases scan count by exactly 1", async () => {
      const { t, asAdmin } = await setupStoreWithAdmin();

      const qr = await asAdmin.mutation(api.organizationQrCodes.create, {
        name: "Public Takeaway",
        qrType: "TakeAway",
      });

      expect(qr.counter).toBe(0);

      const res1 = await t.mutation(api.organizationQrCodes.incrementCounter, {
        id: qr._id,
      });
      expect(res1.counter).toBe(1);

      const res2 = await t.mutation(api.organizationQrCodes.incrementCounter, {
        id: qr._id,
      });
      expect(res2.counter).toBe(2);

      const updated = await asAdmin.query(api.organizationQrCodes.get, { id: qr._id });
      expect(updated?.counter).toBe(2);
    });
  });

  // 3. Authorization & Soft Delete
  describe("Authorization & Soft Delete", () => {
    test("Staff/Waiter cannot create, update, or remove QR codes", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_waiter_88",
        userType: ["waiter"],
      });

      const asWaiter = t.withIdentity({ subject: "user_waiter_88" });

      const list = await asWaiter.query(api.organizationQrCodes.list, {});
      expect(Array.isArray(list)).toBe(true);

      await expect(
        asWaiter.mutation(api.organizationQrCodes.create, {
          name: "Forbidden QR",
          qrType: "TakeAway",
        })
      ).rejects.toThrow("Forbidden. Admin or Cashier access required.");
    });

    test("remove soft-deletes QR code and excludes it from queries", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const qr = await asAdmin.mutation(api.organizationQrCodes.create, {
        name: "Temporary QR",
        qrType: "TakeAway",
      });

      await asAdmin.mutation(api.organizationQrCodes.remove, { id: qr._id });

      const fetched = await asAdmin.query(api.organizationQrCodes.get, { id: qr._id });
      expect(fetched).toBeNull();
    });
  });

  // 4. Customer Table Session Resolution (Screen 1 Read-Only Public Query)
  describe("Customer Table Session Resolution (resolveCustomerSession)", () => {
    test("resolves active table session with layout name and org details without mutating counters", async () => {
      const { t, asAdmin } = await setupStoreWithAdmin();

      // Create layout
      const layoutId = await asAdmin.mutation(api.organizationLayouts.create, {
        name: "Ground Terrace",
      });

      // Create table
      const tableId = await asAdmin.mutation(api.organizationTables.create, {
        tableNumber: "T12",
        seatingCapacity: 4,
        layoutId,
        placement: "Terrace Window",
      });

      // Create QR
      const qr = await asAdmin.mutation(api.organizationQrCodes.create, {
        name: "Table T12 QR",
        qrType: "DineIn",
        tableNumber: "T12",
        tableId: tableId,
      });

      // Query customer session (Public unauthenticated)
      const session = await t.query(api.organizationQrCodes.resolveCustomerSession, {
        qrId: qr._id,
      });

      expect(session.valid).toBe(true);
      expect(session.organization).toBeDefined();
      expect(session.organization?.name).toBe("QR Test Store");
      expect(session.table).toBeDefined();
      expect(session.table?.tableNumber).toBe("T12");
      expect(session.table?.layoutName).toBe("Ground Terrace");
      expect(session.table?.isBlock).toBe(false);
      expect(session.qr?.name).toBe("Table T12 QR");

      // Verify read-only: counter did not increment
      const qrDoc = await asAdmin.query(api.organizationQrCodes.get, { id: qr._id });
      expect(qrDoc?.counter).toBe(0);
    });

    test("returns TABLE_NOT_FOUND when non-existent table is requested", async () => {
      const { t } = await setupStoreWithAdmin();

      const session = await t.query(api.organizationQrCodes.resolveCustomerSession, {
        tableNumber: "NON_EXISTENT_999",
      });

      expect(session.valid).toBe(false);
      expect(session.errorCode).toBe("TABLE_NOT_FOUND");
      expect(session.error).toContain("This table QR code is no longer active");
    });

    test("returns TABLE_BLOCKED when table has isBlock enabled", async () => {
      const { t, asAdmin } = await setupStoreWithAdmin();

      const tableId = await asAdmin.mutation(api.organizationTables.create, {
        tableNumber: "T99",
        seatingCapacity: 2,
        isBlock: true,
      });

      const session = await t.query(api.organizationQrCodes.resolveCustomerSession, {
        tableId: tableId,
      });

      expect(session.valid).toBe(false);
      expect(session.errorCode).toBe("TABLE_BLOCKED");
      expect(session.error).toContain("This table is currently unavailable");
    });
  });
});

