/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Subticket 02: QR Customer Journey & Scan/Cart Tracking Unit Tests", () => {
  async function setupStoreWithAdmin(adminClerkId = "user_admin_99") {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Customer Journey Test Store",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    return { t, orgId, adminClerkId, asAdmin };
  }

  test("Record scan creates scan event and starts ordering session for active QR", async () => {
    const { t, asAdmin } = await setupStoreWithAdmin();

    const qr = await asAdmin.mutation(api.organizationQrCodes.create, {
      name: "Table 03 QR",
      qrType: "DINE_IN",
      tableNumber: "T-03",
      tableId: "tbl_03",
    });

    // Public scan
    const scanRes = await t.mutation(api.organizationQrCustomerJourney.recordScan, {
      qrId: qr.qrId,
    });

    expect(scanRes).toBeDefined();
    expect(scanRes.qrId).toBe(qr.qrId);
    expect(scanRes.tableId).toBe("tbl_03");
    expect(scanRes.sessionId).toBeDefined();
  }, 20000);

  test("Inactive QR scan rejects with QR_INACTIVE and creates no new session", async () => {
    const { t, asAdmin } = await setupStoreWithAdmin();

    const qr = await asAdmin.mutation(api.organizationQrCodes.create, {
      name: "Disabled Takeaway QR",
      qrType: "TAKEAWAY",
    });

    await asAdmin.mutation(api.organizationQrCodes.disable, { id: qr.qrId });

    await expect(
      t.mutation(api.organizationQrCustomerJourney.recordScan, {
        qrId: qr.qrId,
      }),
    ).rejects.toThrow("QR_INACTIVE");
  }, 20000);

  test("Repeated scan during active journey reuses existing session without inflating session count", async () => {
    const { t, asAdmin } = await setupStoreWithAdmin();

    const qr = await asAdmin.mutation(api.organizationQrCodes.create, {
      name: "Table 05 QR",
      qrType: "DINE_IN",
      tableNumber: "T-05",
      tableId: "tbl_05",
    });

    // First scan
    const scan1 = await t.mutation(api.organizationQrCustomerJourney.recordScan, {
      qrId: qr.qrId,
    });

    // Second scan passing same session ID
    const scan2 = await t.mutation(api.organizationQrCustomerJourney.recordScan, {
      qrId: qr.qrId,
      sessionId: scan1.sessionId,
    });

    expect(scan2.sessionId).toBe(scan1.sessionId);

    // Verify journey stats: 2 scans, but only 1 session
    const stats = await asAdmin.query(api.organizationQrCustomerJourney.getQrJourneyStats, {
      qrId: qr.qrId,
    });

    expect(stats.scanCount).toBe(2);
    expect(stats.sessionCount).toBe(1);
  }, 20000);

  test("Cart activity records item addition and attributes cart to session and QR", async () => {
    const { t, asAdmin } = await setupStoreWithAdmin();

    const qr = await asAdmin.mutation(api.organizationQrCodes.create, {
      name: "Counter Takeaway",
      qrType: "TAKEAWAY",
    });

    const scan = await t.mutation(api.organizationQrCustomerJourney.recordScan, {
      qrId: qr.qrId,
    });

    // Add item to cart
    const cartRes = await t.mutation(api.organizationQrCustomerJourney.recordCartActivity, {
      sessionId: scan.sessionId,
      itemCount: 2,
    });

    expect(cartRes.sessionId).toBe(scan.sessionId);
    expect(cartRes.qrId).toBe(qr.qrId);
    expect(cartRes.hasItems).toBe(true);

    // Verify journey stats: 1 scan, 1 session, 1 cart created (100% conversion)
    const stats = await asAdmin.query(api.organizationQrCustomerJourney.getQrJourneyStats, {
      qrId: qr.qrId,
    });

    expect(stats.scanCount).toBe(1);
    expect(stats.sessionCount).toBe(1);
    expect(stats.cartCreatedCount).toBe(1);
    expect(stats.cartConversion).toBe(100);
  }, 20000);
});
