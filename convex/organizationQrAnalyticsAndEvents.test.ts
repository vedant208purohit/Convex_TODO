/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Subtickets 04, 05, 06: QR Analytics, Dashboard & Webhook Event Integration Tests", () => {
  async function setupStoreWithAdmin(adminClerkId = "user_admin_99") {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Analytics & Webhooks Test Store",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    return { t, orgId, adminClerkId, asAdmin };
  }

  test("Subticket 04: Individual QR Analytics calculates conversion rates, hourly distribution & top items", async () => {
    const { t, orgId, asAdmin } = await setupStoreWithAdmin();

    const qr = await asAdmin.mutation(api.organizationQrCodes.create, {
      name: "Table 03 QR",
      qrType: "DINE_IN",
      tableNumber: "T-03",
      tableId: "tbl_03",
    });

    // Record scan, session, cart
    const scan = await t.mutation(api.organizationQrCustomerJourney.recordScan, {
      qrId: qr.qrId,
    });

    await t.mutation(api.organizationQrCustomerJourney.recordCartActivity, {
      sessionId: scan.sessionId,
      itemCount: 2,
    });

    // Create valid order
    const orderId = await t.run(async (ctx) => {
      const oId = await ctx.db.insert("orders", {
        organizationId: orgId,
        orderNumber: "ORD-5001",
        tokenNumber: "TK-03",
        orderType: "DineIn",
        orderSource: "QR",
        orderStatusName: "Completed",
        isCompleted: true,
        isRejected: false,
        isModify: false,
        subTotal: 500,
        taxTotal: 60,
        totalAmount: 560,
        paymentMode: "UPI",
        paymentStatus: "Paid",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Insert item
      await ctx.db.insert("orderItems", {
        organizationId: orgId,
        orderId: oId,
        itemId: "item_01" as any,
        itemName: "Masala Tea",
        itemPrice: 50,
        quantity: 2,
        totalPrice: 100,
        isReady: true,
        createdAt: Date.now(),
      });

      return oId;
    });

    await asAdmin.mutation(api.organizationQrOrderAttribution.attributeOrderToQr, {
      orderId,
      qrId: qr.qrId,
      sessionId: scan.sessionId,
    });

    const analytics = await asAdmin.query(api.organizationQrAnalytics.getIndividualAnalytics, {
      qrId: qr.qrId,
    });

    expect(analytics.scans).toBe(1);
    expect(analytics.sessions).toBe(1);
    expect(analytics.carts).toBe(1);
    expect(analytics.orders).toBe(1);
    expect(analytics.revenue).toBe(560);
    expect(analytics.sessionConversion).toBe(100);
    expect(analytics.cartConversion).toBe(100);
    expect(analytics.orderConversion).toBe(100);
    expect(analytics.topItems.length).toBeGreaterThan(0);
    expect(analytics.topItems[0].name).toBe("Masala Tea");
  }, 20000);

  test("Subticket 05: Overall Performance API & Paginated List API", async () => {
    const { asAdmin, orgId } = await setupStoreWithAdmin();

    await asAdmin.mutation(api.organizationQrCodes.create, {
      name: "DineIn Table 1",
      qrType: "DINE_IN",
      tableNumber: "T-01",
      tableId: "tbl_01",
    });

    await asAdmin.mutation(api.organizationQrCodes.create, {
      name: "TakeAway Counter 1",
      qrType: "TAKEAWAY",
    });

    const perf = await asAdmin.query(api.organizationQrAnalytics.getOverallPerformance, {
      outletId: orgId,
      type: "ALL",
    });

    expect(perf.summary.totalQr).toBe(2);
    expect(perf.summary.activeQr).toBe(2);
    expect(perf.rows.length).toBe(2);

    const listRes = await asAdmin.query(api.organizationQrAnalytics.listPaginated, {
      outletId: orgId,
      search: "TakeAway",
    });

    expect(listRes.total).toBe(1);
    expect(listRes.items[0].displayName).toBe("TakeAway Counter 1");
  }, 20000);

  test("Subticket 05: createBatch creates multiple DineIn QRs and handles duplicate active table QRs", async () => {
    const { asAdmin, orgId } = await setupStoreWithAdmin();

    const batchRes = await asAdmin.mutation(api.organizationQrCodes.createBatch, {
      outletId: orgId,
      type: "DINE_IN",
      tableIds: ["table_001", "table_002"],
    });

    expect(batchRes.created.length).toBe(2);
    expect(batchRes.failed.length).toBe(0);

    // Duplicate batch attempt should report active QR already exists
    const duplicateBatchRes = await asAdmin.mutation(api.organizationQrCodes.createBatch, {
      outletId: orgId,
      type: "DINE_IN",
      tableIds: ["table_001", "table_003"],
    });

    expect(duplicateBatchRes.created.length).toBe(1);
    expect(duplicateBatchRes.failed.length).toBe(1);
    expect(duplicateBatchRes.failed[0].tableId).toBe("table_001");
    expect(duplicateBatchRes.failed[0].reason).toBe("ACTIVE_QR_ALREADY_EXISTS");
  }, 20000);

  test("Subticket 06: processEvent guarantees Idempotency on duplicate eventId", async () => {
    const { t, asAdmin } = await setupStoreWithAdmin();

    const qr = await asAdmin.mutation(api.organizationQrCodes.create, {
      name: "Idempotent QR",
      qrType: "TAKEAWAY",
    });

    // 1st webhook call
    const event1 = await t.mutation(api.organizationQrEventsAndWebhooks.processEvent, {
      eventId: "evt_duplicate_001",
      eventType: "QR_SCANNED",
      payload: { qrId: qr.qrId, sessionId: "sess_idempotent_01" },
    });

    expect(event1.duplicateSkipped).toBe(false);
    expect(event1.status).toBe("PROCESSED");

    // 2nd webhook call with exact same eventId
    const event2 = await t.mutation(api.organizationQrEventsAndWebhooks.processEvent, {
      eventId: "evt_duplicate_001",
      eventType: "QR_SCANNED",
      payload: { qrId: qr.qrId, sessionId: "sess_idempotent_01" },
    });

    expect(event2.duplicateSkipped).toBe(true);
    expect(event2.status).toBe("PROCESSED");

    // Scan counter should only be 1, not 2
    const fetchedQr = await asAdmin.query(api.organizationQrCodes.get, { id: qr.qrId });
    expect(fetchedQr?.counter).toBe(1);
  }, 20000);
});
