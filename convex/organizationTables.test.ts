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
      ).rejects.toThrow("Forbidden. Admin, Cashier, or Captain access required.");
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

    test("toggleTableBlock toggles table block status", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const tableId = await asAdmin.mutation(api.organizationTables.create, {
        tableNumber: "T200",
        seatingCapacity: 4,
      });

      const res1 = await asAdmin.mutation(api.organizationTables.toggleTableBlock, {
        id: tableId,
      });
      expect(res1.isBlock).toBe(true);

      const tableDoc = await asAdmin.query(api.organizationTables.get, { id: tableId });
      expect(tableDoc?.isBlock).toBe(true);

      const res2 = await asAdmin.mutation(api.organizationTables.toggleTableBlock, {
        id: tableId,
        isBlock: false,
      });
      expect(res2.isBlock).toBe(false);
    });

    test("listCaptainTables returns enriched table with layout and active order details", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      const layoutId = await asAdmin.mutation(api.organizationLayouts.create, {
        name: "Main Patio",
      });

      const tableId = await asAdmin.mutation(api.organizationTables.create, {
        tableNumber: "T300",
        seatingCapacity: 6,
        layoutId,
      });

      const tables = await asAdmin.query(api.organizationTables.listCaptainTables, {
        layoutId,
      });

      expect(tables.length).toBe(1);
      expect(tables[0].tableNumber).toBe("T300");
      expect(tables[0].layoutName).toBe("Main Patio");
      expect(tables[0].currentOrder).toBeNull();
    });
  });

  // ----------------------------------------------------
  // Dine-In QR Auto-Provisioning & Telemetry Integration
  // ----------------------------------------------------
  describe("Dine-In QR Code Auto-Provisioning & Telemetry Integration", () => {
    test("Table creation automatically provisions a Dine-In QR document with matching organizationId, tableId, tableNumber, and canonical qrUrl", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      const tableId = await asAdmin.mutation(api.organizationTables.create, {
        tableNumber: "T12",
        seatingCapacity: 4,
      });

      // Query the auto-provisioned QR code by table
      const qrDoc = await asAdmin.query(api.organizationQrCodes.getByTable, {
        tableId: tableId.toString(),
      });

      expect(qrDoc).not.toBeNull();
      expect(qrDoc?.organizationId).toBe(orgId);
      expect(qrDoc?.tableId).toBe(tableId.toString());
      expect(qrDoc?.tableNumber).toBe("T12");
      expect(qrDoc?.qrType).toBe("DineIn");
      expect(qrDoc?.name).toBe("Table T12");
      expect(qrDoc?.counter).toBe(0);

      // Verify canonical qrUrl contains the Convex QR document ID
      expect(qrDoc?.qrUrl).toBeDefined();
      expect(qrDoc?.qrUrl).toContain(`qr_id=${qrDoc?._id}`);
      expect(qrDoc?.qrUrl).toContain("type=DineIn");
      expect(qrDoc?.qrUrl).toContain(`table_id=${tableId}`);
    });

    test("Table update syncs QR code name, tableNumber, and qrUrl when tableNumber changes", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const tableId = await asAdmin.mutation(api.organizationTables.create, {
        tableNumber: "T10",
        seatingCapacity: 2,
      });

      let qrDoc = await asAdmin.query(api.organizationQrCodes.getByTable, {
        tableId: tableId.toString(),
      });
      expect(qrDoc?.tableNumber).toBe("T10");
      expect(qrDoc?.name).toBe("Table T10");

      // Update tableNumber to T10-VIP
      await asAdmin.mutation(api.organizationTables.update, {
        id: tableId,
        tableNumber: "T10-VIP",
      });

      qrDoc = await asAdmin.query(api.organizationQrCodes.getByTable, {
        tableId: tableId.toString(),
      });
      expect(qrDoc?.tableNumber).toBe("T10-VIP");
      expect(qrDoc?.name).toBe("Table T10-VIP");
      expect(qrDoc?.qrUrl).toContain("qr_name=Table%20T10-VIP");
    });

    test("Table removal soft-deletes the associated Dine-In QR code", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const tableId = await asAdmin.mutation(api.organizationTables.create, {
        tableNumber: "T50",
        seatingCapacity: 4,
      });

      let qrDoc = await asAdmin.query(api.organizationQrCodes.getByTable, {
        tableId: tableId.toString(),
      });
      expect(qrDoc).not.toBeNull();

      // Soft-delete the table
      await asAdmin.mutation(api.organizationTables.remove, { id: tableId });

      qrDoc = await asAdmin.query(api.organizationQrCodes.getByTable, {
        tableId: tableId.toString(),
      });
      expect(qrDoc).toBeNull();
    });

    test("backfillTableQrCodes safely provisions QR documents for existing tables without QRs", async () => {
      const { t, asAdmin, orgId } = await setupStoreWithAdmin();

      // Create a table directly without calling the create mutation helper (or simulating legacy data)
      const now = Date.now();
      const legacyTableId = await t.run(async (ctx) => {
        return await ctx.db.insert("organizationTables", {
          tableNumber: "T-LEGACY",
          seatingCapacity: 4,
          createdAt: now,
          updatedAt: now,
        });
      });

      // Verify no QR exists initially for the legacy table
      let qrDoc = await asAdmin.query(api.organizationQrCodes.getByTable, {
        tableId: legacyTableId.toString(),
      });
      expect(qrDoc).toBeNull();

      // Run backfill
      const backfillResult = await asAdmin.mutation(
        api.organizationTables.backfillTableQrCodes,
        {}
      );
      expect(backfillResult.success).toBe(true);
      expect(backfillResult.provisionedCount).toBeGreaterThanOrEqual(1);

      // Verify QR document now exists with canonical qr_id
      qrDoc = await asAdmin.query(api.organizationQrCodes.getByTable, {
        tableId: legacyTableId.toString(),
      });
      expect(qrDoc).not.toBeNull();
      expect(qrDoc?.tableNumber).toBe("T-LEGACY");
      expect(qrDoc?.qrUrl).toContain(`qr_id=${qrDoc?._id}`);

      // Run backfill again to verify idempotency (zero new provisions)
      const idempotentResult = await asAdmin.mutation(
        api.organizationTables.backfillTableQrCodes,
        {}
      );
      expect(idempotentResult.provisionedCount).toBe(0);
    });

    test("Multi-store isolation: Store A and Store B tables receive strictly isolated QR codes", async () => {
      // Store A isolated deployment
      const tA = convexTest(schema, modules);
      const orgA = await tA.mutation(api.organizations.create, {
        name: "Store Alpha",
        ownerClerkId: "admin_a",
      });
      const adminA = tA.withIdentity({ subject: "admin_a" });

      // Store B isolated deployment
      const tB = convexTest(schema, modules);
      const orgB = await tB.mutation(api.organizations.create, {
        name: "Store Beta",
        ownerClerkId: "admin_b",
      });
      const adminB = tB.withIdentity({ subject: "admin_b" });

      const tableA = await adminA.mutation(api.organizationTables.create, {
        tableNumber: "T1",
        seatingCapacity: 4,
      });

      const tableB = await adminB.mutation(api.organizationTables.create, {
        tableNumber: "T1",
        seatingCapacity: 4,
      });

      const qrA = await adminA.query(api.organizationQrCodes.getByTable, {
        tableId: tableA.toString(),
      });
      const qrB = await adminB.query(api.organizationQrCodes.getByTable, {
        tableId: tableB.toString(),
      });

      expect(qrA).not.toBeNull();
      expect(qrB).not.toBeNull();
      expect(qrA?.organizationId).toBe(orgA);
      expect(qrB?.organizationId).toBe(orgB);
      expect(qrA?.tableId).toBe(tableA.toString());
      expect(qrB?.tableId).toBe(tableB.toString());
      expect(qrA?.qrType).toBe("DineIn");
      expect(qrB?.qrType).toBe("DineIn");
    });

    test("Multi-table isolation: Table T11 and Table T12 within one store have distinct QR docs and URLs", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      const table11 = await asAdmin.mutation(api.organizationTables.create, {
        tableNumber: "T11",
        seatingCapacity: 2,
      });
      const table12 = await asAdmin.mutation(api.organizationTables.create, {
        tableNumber: "T12",
        seatingCapacity: 4,
      });

      const qr11 = await asAdmin.query(api.organizationQrCodes.getByTable, {
        tableId: table11.toString(),
      });
      const qr12 = await asAdmin.query(api.organizationQrCodes.getByTable, {
        tableId: table12.toString(),
      });

      expect(qr11?._id).not.toBe(qr12?._id);
      expect(qr11?.tableId).toBe(table11.toString());
      expect(qr12?.tableId).toBe(table12.toString());
      expect(qr11?.qrUrl).toContain(`qr_id=${qr11?._id}`);
      expect(qr12?.qrUrl).toContain(`qr_id=${qr12?._id}`);
    });

    test("Auto-provisioned QR URL is immediately consumable by telemetry recordScan", async () => {
      const { t, asAdmin, orgId } = await setupStoreWithAdmin();

      const tableId = await asAdmin.mutation(api.organizationTables.create, {
        tableNumber: "T12",
        seatingCapacity: 4,
      });

      const qrDoc = await asAdmin.query(api.organizationQrCodes.getByTable, {
        tableId: tableId.toString(),
      });
      expect(qrDoc).not.toBeNull();

      // Customer scans the generated QR code (public unauthenticated scan)
      const scanRes = await t.mutation(
        api.organizationQrCustomerJourney.recordScan,
        {
          qrId: qrDoc!._id,
          deviceType: "mobile",
          os: "iOS",
          browser: "Safari",
        }
      );

      expect(scanRes).toBeDefined();
      expect(scanRes.qrId).toBe(qrDoc!._id);
      expect(scanRes.organizationId).toBe(orgId);
      expect(scanRes.tableId).toBe(tableId.toString());
      expect(scanRes.tableNumber).toBe("T12");
      expect(scanRes.sessionId).toBeDefined();

      // Verify scan log and session created in database
      const analytics = await asAdmin.query(
        api.organizationQrCustomerJourney.getQrAnalyticsSummary,
        { qrId: qrDoc!._id }
      );
      expect(analytics.totalScans).toBe(1);
      expect(analytics.totalSessions).toBe(1);
    });
  });
});
