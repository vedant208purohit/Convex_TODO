/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Organization QR Customer Journey Telemetry & Isolation Tests", () => {
  it("1. Resolves authoritative organization and table for DineIn QR code scan", async () => {
    const t = convexTest(schema, modules);

    // Seed store organization
    const orgId = await t.mutation(api.organizations.create, {
      name: "Balwant Indian Dining",
      slug: "balwant-indian-dining",
      phone: "9876543210",
      country: "IN",
      isDineIn: true,
      dineinPrepaid: true,
      isTakeAway: true,
      takeAwayOnlinePayment: true,
      isDelivery: true,
      deliveryOnlinePayment: true,
    });

    const admin = t.withIdentity({ subject: "admin_user" });
    await t.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "admin_user",
      userType: ["admin"],
    });

    // Create table using admin identity
    const tableId = await admin.mutation(api.organizationTables.create, {
      tableNumber: "T-01",
      seatingCapacity: 4,
    });

    // Create DineIn QR code
    const qrDoc = await admin.mutation(api.organizationQrCodes.create, {
      name: "Table 01 Main Hall",
      qrType: "DineIn",
      tableId: tableId.toString(),
      tableNumber: "T-01",
    });

    // Unauthenticated customer scans QR code
    const scanRes = await t.mutation(
      api.organizationQrCustomerJourney.recordScan,
      {
        qrId: qrDoc._id,
        deviceType: "mobile",
        os: "iOS",
        browser: "Safari",
        screenResolution: "390x844",
        language: "en-US",
      }
    );

    expect(scanRes.success).toBe(true);
    expect(scanRes.organizationId).toBe(orgId);
    expect(scanRes.tableId).toBe(tableId.toString());
    expect(scanRes.qrType).toBe("DineIn");
    expect(scanRes.scanCount).toBe(1);

    // Verify session document in database
    const session = await t.query(
      api.organizationQrCustomerJourney.getSession,
      { id: scanRes.sessionId }
    );
    expect(session).not.toBeNull();
    expect(session?.organizationId).toBe(orgId);
    expect(session?.tableId).toBe(tableId.toString());
    expect(session?.status).toBe("active");
    expect(session?.cartItemCount).toBe(0);
    expect(session?.deviceType).toBe("mobile");
    expect(session?.browser).toBe("Safari");
    expect(session?.os).toBe("iOS");

    // Verify scan event telemetry log
    const scans = await t.query(
      api.organizationQrCustomerJourney.listScansByQr,
      { qrId: qrDoc._id }
    );
    expect(scans.length).toBe(1);
    expect(scans[0].organizationId).toBe(orgId);
    expect(scans[0].tableId).toBe(tableId.toString());
    expect(scans[0].deviceType).toBe("mobile");
    expect(scans[0].os).toBe("iOS");
    expect(scans[0].browser).toBe("Safari");
    expect(scans[0].screenResolution).toBe("390x844");
    expect(scans[0].language).toBe("en-US");
  });

  it("2. TakeAway QR code scan attributes organization but keeps tableId null", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Takeaway Express",
      slug: "takeaway-express",
      phone: "9876543211",
      country: "IN",
      isDineIn: false,
      isTakeAway: true,
      takeAwayOnlinePayment: true,
      isDelivery: false,
    });

    const admin = t.withIdentity({ subject: "admin_takeaway" });
    await t.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "admin_takeaway",
      userType: ["admin"],
    });

    const qrDoc = await admin.mutation(api.organizationQrCodes.create, {
      name: "Pickup Counter QR",
      qrType: "TakeAway",
    });

    const scanRes = await t.mutation(
      api.organizationQrCustomerJourney.recordScan,
      {
        qrId: qrDoc._id,
        deviceType: "desktop",
        os: "macOS",
        browser: "Chrome",
      }
    );

    expect(scanRes.success).toBe(true);
    expect(scanRes.organizationId).toBe(orgId);
    expect(scanRes.tableId).toBeUndefined();
    expect(scanRes.qrType).toBe("TakeAway");

    const session = await t.query(
      api.organizationQrCustomerJourney.getSession,
      { id: scanRes.sessionId }
    );
    expect(session?.tableId).toBeUndefined();
    expect(session?.status).toBe("active");
  });

  it("3. Multi-Store Isolation: QR ID authoritatively resolves store ownership", async () => {
    const t = convexTest(schema, modules);

    // Store A
    const orgAId = await t.mutation(api.organizations.create, {
      name: "Store Alpha",
      slug: "store-alpha",
      phone: "9876543212",
      country: "IN",
      isDineIn: false,
      isTakeAway: true,
      takeAwayOnlinePayment: true,
      isDelivery: false,
    });
    const adminA = t.withIdentity({ subject: "admin_a" });
    await t.mutation(api.organizationUsers.create, {
      organizationId: orgAId,
      userId: "admin_a",
      userType: ["admin"],
    });
    const qrA = await adminA.mutation(api.organizationQrCodes.create, {
      name: "Store A QR",
      qrType: "TakeAway",
    });

    // Store B - Create QR directly with organizationId explicitly attached
    const orgBId = await t.mutation(api.organizations.create, {
      name: "Store Beta",
      slug: "store-beta",
      phone: "9876543213",
      country: "IN",
      isDineIn: false,
      isTakeAway: true,
      takeAwayOnlinePayment: true,
      isDelivery: false,
    });
    const adminB = t.withIdentity({ subject: "admin_b" });
    await t.mutation(api.organizationUsers.create, {
      organizationId: orgBId,
      userId: "admin_b",
      userType: ["admin"],
    });

    // Store B QR with explicit organizationId
    const now = Date.now();
    const qrBId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizationQrCodes", {
        organizationId: orgBId,
        name: "Store B QR",
        qrType: "TakeAway",
        counter: 0,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Scan Store A QR
    const scanA = await t.mutation(
      api.organizationQrCustomerJourney.recordScan,
      { qrId: qrA._id }
    );
    expect(scanA.organizationId).toBe(orgAId);

    // Scan Store B QR
    const scanB = await t.mutation(
      api.organizationQrCustomerJourney.recordScan,
      { qrId: qrBId }
    );
    expect(scanB.organizationId).toBe(orgBId);

    // Verify that Store A's scans list does NOT contain Store B's scan
    const scansA = await t.query(
      api.organizationQrCustomerJourney.listScansByQr,
      { qrId: qrA._id }
    );
    expect(scansA.length).toBe(1);
    expect(scansA[0].organizationId).toBe(orgAId);

    const scansB = await t.query(
      api.organizationQrCustomerJourney.listScansByQr,
      { qrId: qrBId }
    );
    expect(scansB.length).toBe(1);
    expect(scansB[0].organizationId).toBe(orgBId);
  });

  it("4. Multi-Table Isolation: Table 01 scan is strictly isolated from Table 02", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Multi-Table Cafe",
      slug: "multi-table-cafe",
      phone: "9876543214",
      country: "IN",
      isDineIn: true,
      dineinPrepaid: true,
      isTakeAway: false,
      isDelivery: false,
    });
    const admin = t.withIdentity({ subject: "admin_cafe" });
    await t.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "admin_cafe",
      userType: ["admin"],
    });

    const table1 = await admin.mutation(api.organizationTables.create, {
      tableNumber: "01",
      seatingCapacity: 2,
    });
    const table2 = await admin.mutation(api.organizationTables.create, {
      tableNumber: "02",
      seatingCapacity: 4,
    });

    const qrTable1 = await admin.mutation(api.organizationQrCodes.create, {
      name: "Table 01",
      qrType: "DineIn",
      tableId: table1.toString(),
      tableNumber: "01",
    });

    const qrTable2 = await admin.mutation(api.organizationQrCodes.create, {
      name: "Table 02",
      qrType: "DineIn",
      tableId: table2.toString(),
      tableNumber: "02",
    });

    // Scan Table 1
    const scan1 = await t.mutation(
      api.organizationQrCustomerJourney.recordScan,
      { qrId: qrTable1._id }
    );
    expect(scan1.tableId).toBe(table1.toString());

    // Scan Table 2
    const scan2 = await t.mutation(
      api.organizationQrCustomerJourney.recordScan,
      { qrId: qrTable2._id }
    );
    expect(scan2.tableId).toBe(table2.toString());

    expect(scan1.tableId).not.toBe(scan2.tableId);
  });

  it("5. Tracks cart activity accurately on active session", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Cart Tracking Diner",
      slug: "cart-tracking-diner",
      phone: "9876543215",
      country: "IN",
      isDineIn: false,
      isTakeAway: true,
      takeAwayOnlinePayment: true,
      isDelivery: false,
    });
    const admin = t.withIdentity({ subject: "admin_cart" });
    await t.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "admin_cart",
      userType: ["admin"],
    });

    const qr = await admin.mutation(api.organizationQrCodes.create, {
      name: "Counter QR",
      qrType: "TakeAway",
    });

    const scan = await t.mutation(
      api.organizationQrCustomerJourney.recordScan,
      { qrId: qr._id }
    );

    // Initial cart item count: 0 -> 2 (Item A x 1, Item B x 1)
    const cartRes1 = await t.mutation(
      api.organizationQrCustomerJourney.recordCartActivity,
      {
        sessionId: scan.sessionId,
        itemCount: 2,
      }
    );
    expect(cartRes1.success).toBe(true);
    expect(cartRes1.cartItemCount).toBe(2);

    let session = await t.query(
      api.organizationQrCustomerJourney.getSession,
      { id: scan.sessionId }
    );
    expect(session?.cartItemCount).toBe(2);

    // Update cart item count: 2 -> 4 (2 products x 2 each)
    const cartRes2 = await t.mutation(
      api.organizationQrCustomerJourney.recordCartActivity,
      {
        sessionId: scan.sessionId,
        itemCount: 4,
      }
    );
    expect(cartRes2.success).toBe(true);
    expect(cartRes2.cartItemCount).toBe(4);

    session = await t.query(
      api.organizationQrCustomerJourney.getSession,
      { id: scan.sessionId }
    );
    expect(session?.cartItemCount).toBe(4);
  });

  it("6. Attributes successful order conversion and enforces idempotency", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Conversion Bistro",
      slug: "conversion-bistro",
      phone: "9876543216",
      country: "IN",
      isDineIn: false,
      isTakeAway: true,
      takeAwayOnlinePayment: true,
      isDelivery: false,
    });
    const admin = t.withIdentity({ subject: "admin_conv" });
    await t.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "admin_conv",
      userType: ["admin"],
    });

    // Seed menu and item
    const menuId = await admin.mutation(api.menu.createMenu, {
      organizationId: orgId,
      name: "Main Menu",
      isDefault: true,
    });
    const catId = await admin.mutation(api.menu.createCategory, {
      organizationId: orgId,
      menuId,
      name: "Beverages",
    });
    const item = await admin.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Artisan Coffee",
      price: 25000, // ₹250.00
      isVeg: true,
    });

    const qr = await admin.mutation(api.organizationQrCodes.create, {
      name: "Takeaway 1",
      qrType: "TakeAway",
    });

    const scan = await t.mutation(
      api.organizationQrCustomerJourney.recordScan,
      { qrId: qr._id }
    );

    // Authenticated customer places order
    const customer = t.withIdentity({ subject: "cust_jane_123" });
    const orderRes = await customer.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "TakeAway",
      orderSource: "PREST-QR",
      customerName: "Jane Doe",
      customerPhone: "9876543299",
      items: [{ itemId: item, quantity: 2 }],
      paymentMode: "UPI / Online",
      paymentStatus: "Paid",
    });

    expect(orderRes.orderId).toBeDefined();

    // Record conversion
    const convRes = await t.mutation(
      api.organizationQrCustomerJourney.recordOrderConversion,
      {
        sessionId: scan.sessionId,
        qrId: qr._id,
        orderId: orderRes.orderId,
        totalAmount: 50000,
      }
    );

    expect(convRes.success).toBe(true);
    expect(convRes.orderId).toBe(orderRes.orderId);

    // Verify session updated in database
    const session = await t.query(
      api.organizationQrCustomerJourney.getSession,
      { id: scan.sessionId }
    );
    expect(session?.status).toBe("converted");
    expect(session?.orderId).toBe(orderRes.orderId);
    expect(session?.orderTotalAmount).toBe(50000);
    expect(session?.convertedAt).toBeDefined();

    // Repeated call must be idempotent
    const repeatConv = await t.mutation(
      api.organizationQrCustomerJourney.recordOrderConversion,
      {
        sessionId: scan.sessionId,
        qrId: qr._id,
        orderId: orderRes.orderId,
        totalAmount: 50000,
      }
    );

    expect(repeatConv.success).toBe(true);
    expect(repeatConv.alreadyConverted).toBe(true);

    // Check QR analytics summary
    const summary = await t.query(
      api.organizationQrCustomerJourney.getQrAnalyticsSummary,
      { qrId: qr._id }
    );
    expect(summary.totalScans).toBe(1);
    expect(summary.totalSessions).toBe(1);
    expect(summary.totalConversions).toBe(1);
    expect(summary.conversionRate).toBe(100);
    expect(summary.totalRevenuePaise).toBe(50000);
  });

  it("7. Rejects invalid QR IDs gracefully with descriptive error", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.organizationQrCustomerJourney.recordScan, {
        qrId: "non_existent_qr_id",
      })
    ).rejects.toThrow("QR code 'non_existent_qr_id' not found or inactive.");
  });
});
