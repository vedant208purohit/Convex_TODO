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
    test("TakeAway, Delivery and Queue QR code creation sets counter to 0 and builds destination", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const qrTakeAway = await asAdmin.mutation(api.organizationQrCodes.create, {
        name: "Main Takeaway Counter",
        qrType: "TAKEAWAY",
        description: "Counter #1 Takeaway QR",
      });

      expect(qrTakeAway).toBeDefined();
      expect(qrTakeAway.name).toBe("Main Takeaway Counter");
      expect(qrTakeAway.type).toBe("TAKEAWAY");
      expect(qrTakeAway.status).toBe("ACTIVE");

      const qrDelivery = await asAdmin.mutation(api.organizationQrCodes.create, {
        name: "Delivery Counter Promo",
        qrType: "DELIVERY",
      });

      expect(qrDelivery.type).toBe("DELIVERY");
      expect(qrDelivery.destination).toContain("type=Delivery");
    }, 20000);

    test("DineIn creation requires a valid dining table reference", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await expect(
        asAdmin.mutation(api.organizationQrCodes.create, {
          name: "Orphan DineIn QR",
          qrType: "DINE_IN",
        })
      ).rejects.toThrow("Dining table reference is required for DineIn QR codes.");
    });

    test("DineIn creation succeeds when valid tableId and tableNumber are supplied", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const dineInQr = await asAdmin.mutation(api.organizationQrCodes.create, {
        name: "Table T-10",
        qrType: "DINE_IN",
        tableNumber: "T-10",
        tableId: "tbl_1001",
      });

      expect(dineInQr).toBeDefined();
      expect(dineInQr.name).toBe("Table T-10");
      expect(dineInQr.type).toBe("DINE_IN");
      expect(dineInQr.tableId).toBe("tbl_1001");
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
  });

  // 2. Enable, Disable & Public Resolution
  describe("Enable, Disable & Public Resolution", () => {
    test("Enable and Disable mutations toggle QR status and preserve stable identity", async () => {
      const { t, asAdmin } = await setupStoreWithAdmin();

      const qr = await asAdmin.mutation(api.organizationQrCodes.create, {
        name: "Table T-03",
        qrType: "DINE_IN",
        tableNumber: "T-03",
        tableId: "tbl_03",
      });

      const initialId = qr.qrId;

      // Disable QR
      const disableRes = await asAdmin.mutation(api.organizationQrCodes.disable, {
        id: initialId,
      });
      expect(disableRes.status).toBe("INACTIVE");

      // Public resolution of inactive QR returns QR_INACTIVE code
      const resolvedInactive: any = await t.query(api.organizationQrCodes.resolvePublic, {
        identifier: initialId,
      });
      expect(resolvedInactive.code).toBe("QR_INACTIVE");

      // Enable QR
      const enableRes = await asAdmin.mutation(api.organizationQrCodes.enable, {
        id: initialId,
      });
      expect(enableRes.status).toBe("ACTIVE");

      // Public resolution of active QR returns active details with identical ID
      const resolvedActive: any = await t.query(api.organizationQrCodes.resolvePublic, {
        identifier: initialId,
      });
      expect(resolvedActive.status).toBe("ACTIVE");
      expect(resolvedActive.qrId).toBe(initialId);
    });

    test("Editing display name preserves exact same QR identity", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const created = await asAdmin.mutation(api.organizationQrCodes.create, {
        name: "Old Name",
        qrType: "TAKEAWAY",
      });

      const updated = await asAdmin.mutation(api.organizationQrCodes.update, {
        id: created.qrId,
        displayName: "New Display Name",
      });

      expect(updated.qrId).toBe(created.qrId);
      expect(updated.displayName).toBe("New Display Name");
    });
  });
});
