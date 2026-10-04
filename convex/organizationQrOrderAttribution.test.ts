/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Subticket 03: QR Order Attribution Unit & Integration Tests", () => {
  async function setupStoreWithAdmin(adminClerkId = "user_admin_99") {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Order Attribution Test Store",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    return { t, orgId, adminClerkId, asAdmin };
  }

  test("attributeOrderToQr links order to qrId, sessionId, and tableId", async () => {
    const { t, orgId, asAdmin } = await setupStoreWithAdmin();

    const qr = await asAdmin.mutation(api.organizationQrCodes.create, {
      name: "Table 03 QR",
      qrType: "DINE_IN",
      tableNumber: "T-03",
      tableId: "tbl_03",
    });

    // Record scan and cart
    const scan = await t.mutation(api.organizationQrCustomerJourney.recordScan, {
      qrId: qr.qrId,
    });

    await t.mutation(api.organizationQrCustomerJourney.recordCartActivity, {
      sessionId: scan.sessionId,
      itemCount: 2,
    });

    // Insert order in orders table directly
    const orderId = await t.run(async (ctx) => {
      return await ctx.db.insert("orders", {
        organizationId: orgId,
        orderNumber: "ORD-1001",
        tokenNumber: "TK-01",
        orderType: "DineIn",
        orderSource: "QR",
        orderStatusName: "New Order",
        isCompleted: false,
        isRejected: false,
        isModify: false,
        subTotal: 50000,
        taxTotal: 2500,
        totalAmount: 52500,
        paymentMode: "UPI",
        paymentStatus: "Paid",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Attribute order
    const attribRes = await asAdmin.mutation(api.organizationQrOrderAttribution.attributeOrderToQr, {
      orderId,
      qrId: qr.qrId,
      sessionId: scan.sessionId,
    });

    expect(attribRes.orderId).toBe(orderId);
    expect(attribRes.qrId).toBe(qr.qrId);
    expect(attribRes.sessionId).toBe(scan.sessionId);
    expect(attribRes.tableId).toBe("tbl_03");

    // Fetch attribution stats
    const stats = await asAdmin.query(api.organizationQrOrderAttribution.getOrderAttributionStats, {
      qrId: qr.qrId,
    });

    expect(stats.validOrders).toBe(1);
    expect(stats.totalRevenue).toBe(52500);
    expect(stats.orderConversion).toBe(100);
    expect(stats.cartToOrderConversion).toBe(100);
  }, 20000);

  test("Cancelled or rejected orders are excluded from completed revenue and valid order count", async () => {
    const { t, orgId, asAdmin } = await setupStoreWithAdmin();

    const qr = await asAdmin.mutation(api.organizationQrCodes.create, {
      name: "Takeaway Promo QR",
      qrType: "TAKEAWAY",
    });

    const scan = await t.mutation(api.organizationQrCustomerJourney.recordScan, {
      qrId: qr.qrId,
    });

    await t.mutation(api.organizationQrCustomerJourney.recordCartActivity, {
      sessionId: scan.sessionId,
      itemCount: 1,
    });

    // Insert order that gets cancelled
    const orderId = await t.run(async (ctx) => {
      return await ctx.db.insert("orders", {
        organizationId: orgId,
        orderNumber: "ORD-1002",
        tokenNumber: "TK-02",
        orderType: "TakeAway",
        orderSource: "QR",
        orderStatusName: "Cancelled",
        isCompleted: false,
        isRejected: true,
        isModify: false,
        subTotal: 30000,
        taxTotal: 1500,
        totalAmount: 31500,
        paymentMode: "Cash",
        paymentStatus: "Refunded",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await asAdmin.mutation(api.organizationQrOrderAttribution.attributeOrderToQr, {
      orderId,
      qrId: qr.qrId,
      sessionId: scan.sessionId,
    });

    const stats = await asAdmin.query(api.organizationQrOrderAttribution.getOrderAttributionStats, {
      qrId: qr.qrId,
    });

    expect(stats.totalOrders).toBe(1);
    expect(stats.validOrders).toBe(0);
    expect(stats.cancelledOrders).toBe(1);
    expect(stats.totalRevenue).toBe(0);
    expect(stats.orderConversion).toBe(0);
  }, 20000);
});
