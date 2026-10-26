import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("POS-Default Service Modes & Scheduling Synchronization Tests", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  async function seedTestStore(overrides: Partial<any> = {}) {
    const now = Date.now();
    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Sync Test Store",
        slug: "sync-test-store",
        published: true,
        isTest: false,
        isGst: false,
        inclusiveGst: false,
        separateGst: false,
        isFssai: false,
        defaultCurrency: "INR",
        defaultCurrencySymbol: "₹",
        organizationTimeZone: "Asia/Kolkata",
        receiptPrintCount: 1,
        menuBasedPrintToken: false,
        showQrCode: true,

        // Service Mode Flags
        isDineIn: overrides.isDineIn ?? true,
        isTakeAway: overrides.isTakeAway ?? true,
        isDelivery: overrides.isDelivery ?? true,
        scheduledPickup: overrides.scheduledPickup ?? true,
        scheduledDelivery: overrides.scheduledDelivery ?? true,

        isDashboard: true,
        isInventory: true,
        isOrders: true,
        isWorkstation: true,
        isCashier: true,
        isSettings: true,
        onlineStore: true,
        isMenu: true,
        isQueue: true,
        isKds: true,
        isSurveys: true,
        isCustomer: true,
        isCaptain: true,
        isReport: true,
        isVeg: false,
        digitalStoreStatus: true,
        deliveryCashOnDelivery: true,
        dineinPrepaid: false,
        dineinPospaid: false,
        takeAwayOnlinePayment: true,
        takeAwayCashPayment: true,
        deliveryOnlinePayment: true,
        scheduledPickupOnlinePayment: true,
        scheduledDeliveryOnlinePayment: true,
        scheduledPickupCashPayment: true,
        scheduledDeliveryCashPayment: true,
        transferPercentage: 0,
        transferHoldTime: 0,
        deliveryAggregator: false,
        porterLagTime: 0,
        whatsappIntegration: false,
        prestWhatsappIntegration: false,
        createdAt: now,
        updatedAt: now,
        ...overrides,
      });
    });

    // Seed schedule config
    await t.run(async (ctx) => {
      const defaultTimings = {
        Monday: { is_open: true, hours: [{ start_time: "10:00 AM", end_time: "10:00 PM" }] },
        Tuesday: { is_open: true, hours: [{ start_time: "10:00 AM", end_time: "10:00 PM" }] },
        Wednesday: { is_open: true, hours: [{ start_time: "10:00 AM", end_time: "10:00 PM" }] },
        Thursday: { is_open: true, hours: [{ start_time: "10:00 AM", end_time: "10:00 PM" }] },
        Friday: { is_open: true, hours: [{ start_time: "10:00 AM", end_time: "10:00 PM" }] },
        Saturday: { is_open: true, hours: [{ start_time: "10:00 AM", end_time: "10:00 PM" }] },
        Sunday: { is_open: false, hours: [] },
      };

      await ctx.db.insert("organizationSchedulePickups", {
        advanceOrderTimeLimit: "15 mins",
        advancePickupLimit: 1,
        advancePickupLimitType: "months",
        pickupTimings: defaultTimings,
        pickupTimeSlotSize: "30",

        advanceScheduleDeliveryOrderTimeLimit: "15 mins",
        advanceDeliveryLimit: 1,
        advanceDeliveryLimitType: "months",
        deliveryTimings: defaultTimings,
        deliveryTimeSlotSize: "30",
        createdAt: now,
        updatedAt: now,
      });
    });

    // Seed an item
    const itemId = await t.run(async (ctx) => {
      const catId = await ctx.db.insert("categories", {
        organizationId: orgId,
        name: "Burgers",
        position: 1,
        published: true,
        createdAt: now,
        updatedAt: now,
      });

      return await ctx.db.insert("items", {
        organizationId: orgId,
        categoryId: catId,
        name: "Classic Burger",
        price: 25000,
        published: true,
        is_available: true,
        isGst: false,
        createdAt: now,
        updatedAt: now,
      });
    });

    return { orgId, itemId };
  }

  it("1. Rejects orders when service mode is disabled in Features configuration", async () => {
    // A. DineIn Disabled
    const { orgId: dineInOffOrg, itemId } = await seedTestStore({ isDineIn: false });
    await expect(
      t.mutation(api.orders.createOrder, {
        organizationId: dineInOffOrg,
        orderType: "DineIn",
        orderSource: "PREST-QR",
        items: [{ itemId, quantity: 1 }],
      })
    ).rejects.toThrow("Dine In service is currently disabled for this store.");

    // B. TakeAway Disabled
    const { orgId: takeAwayOffOrg } = await seedTestStore({ isTakeAway: false });
    await expect(
      t.mutation(api.orders.createOrder, {
        organizationId: takeAwayOffOrg,
        orderType: "TakeAway",
        orderSource: "PREST-QR",
        items: [{ itemId, quantity: 1 }],
      })
    ).rejects.toThrow("Takeaway service is currently disabled for this store.");

    // C. ScheduledPickup Disabled
    const { orgId: schedPickupOffOrg } = await seedTestStore({ scheduledPickup: false });
    await expect(
      t.mutation(api.orders.createOrder, {
        organizationId: schedPickupOffOrg,
        orderType: "ScheduledPickup",
        orderSource: "PREST-QR",
        scheduledPickupDate: "2026-10-15",
        scheduledPickupTime: "02:00 PM – 02:30 PM",
        items: [{ itemId, quantity: 1 }],
      })
    ).rejects.toThrow("Scheduled pickup is currently disabled for this store.");

    // D. Delivery Disabled
    const { orgId: deliveryOffOrg } = await seedTestStore({ isDelivery: false });
    await expect(
      t.mutation(api.orders.createOrder, {
        organizationId: deliveryOffOrg,
        orderType: "Delivery",
        orderSource: "PREST-QR",
        deliveryAddress: { addressLine1: "123 Street", city: "Ahmedabad" },
        items: [{ itemId, quantity: 1 }],
      })
    ).rejects.toThrow("Delivery service is currently disabled for this store.");

    // E. ScheduledDelivery Disabled
    const { orgId: schedDelivOffOrg } = await seedTestStore({ scheduledDelivery: false });
    await expect(
      t.mutation(api.orders.createOrder, {
        organizationId: schedDelivOffOrg,
        orderType: "ScheduledDelivery",
        orderSource: "PREST-QR",
        scheduledDeliveryDate: "2026-10-15",
        scheduledDeliveryTime: "02:00 PM – 02:30 PM",
        deliveryAddress: { addressLine1: "123 Street", city: "Ahmedabad" },
        items: [{ itemId, quantity: 1 }],
      })
    ).rejects.toThrow("Scheduled delivery is currently disabled for this store.");
  });

  it("2. Validates scheduled operating hours and rejects closed days & outside hours", async () => {
    const { orgId, itemId } = await seedTestStore();

    // Rejects slot outside 10:00 AM - 10:00 PM
    await expect(
      t.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "ScheduledPickup",
        scheduledPickupDate: "2026-10-16", // Friday
        scheduledPickupTime: "07:00 AM – 07:30 AM",
        items: [{ itemId, quantity: 1 }],
      })
    ).rejects.toThrow("Selected time slot is outside the store's configured operating hours.");

    // Rejects Sunday which is closed in seeded timings
    await expect(
      t.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "ScheduledDelivery",
        scheduledDeliveryDate: "2026-10-18", // Sunday
        scheduledDeliveryTime: "02:00 PM – 02:30 PM",
        deliveryAddress: { addressLine1: "123 Street", city: "Ahmedabad" },
        items: [{ itemId, quantity: 1 }],
      })
    ).rejects.toThrow("The store is closed for delivery on Sunday.");
  });

  it("3. Enforces real-time slot filtering: at 12:39, 12:00-12:30 and 12:30-13:00 are rejected", async () => {
    const { orgId, itemId } = await seedTestStore();

    // We simulate current time as 2026-10-16 12:39:00 IST (UTC: 2026-10-16 07:09:00Z)
    // 2026-10-16 is a Friday.
    const fakeClockMs = new Date("2026-10-16T07:09:00Z").getTime();

    // Test helper directly with deterministic clock
    const { validateScheduledOrderSlot } = await import("./orders");

    // 1. 12:00 PM - 12:30 PM has ended -> Error
    expect(() =>
      validateScheduledOrderSlot({
        dateStr: "2026-10-16",
        timeSlotStr: "12:00 PM – 12:30 PM",
        isPickup: true,
        scheduleConfig: { advanceOrderTimeLimit: "15 mins" },
        timeZone: "Asia/Kolkata",
        currentTimeMs: fakeClockMs,
      })
    ).toThrow("Selected time slot has already ended. Please select an upcoming slot.");

    // 2. 12:30 PM - 01:00 PM has already started (at 12:39) -> Error
    expect(() =>
      validateScheduledOrderSlot({
        dateStr: "2026-10-16",
        timeSlotStr: "12:30 PM – 01:00 PM",
        isPickup: true,
        scheduleConfig: { advanceOrderTimeLimit: "15 mins" },
        timeZone: "Asia/Kolkata",
        currentTimeMs: fakeClockMs,
      })
    ).toThrow("Selected time slot is no longer available. Please select an upcoming slot.");

    // 3. 01:00 PM - 01:30 PM is in the future (> 12:39 + 15m lead time = 12:54) -> Allowed
    expect(() =>
      validateScheduledOrderSlot({
        dateStr: "2026-10-16",
        timeSlotStr: "01:00 PM – 01:30 PM",
        isPickup: true,
        scheduleConfig: { advanceOrderTimeLimit: "15 mins" },
        timeZone: "Asia/Kolkata",
        currentTimeMs: fakeClockMs,
      })
    ).not.toThrow();
  });

  it("4. Persists scheduled dates, times, and orderType correctly", async () => {
    const { orgId, itemId } = await seedTestStore();

    // Place scheduled pickup order for a future date
    const res = await t.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "ScheduledPickup",
      customerName: "Alice Customer",
      customerPhone: "+91 9876543210",
      scheduledPickupDate: "2026-10-20",
      scheduledPickupTime: "03:00 PM – 03:30 PM",
      items: [{ itemId, quantity: 2 }],
    });

    expect(res.orderId).toBeDefined();

    const orderDoc = await t.query(api.orders.getOrderDetails, { id: res.orderId });
    expect(orderDoc?.orderType).toBe("ScheduledPickup");
    expect(orderDoc?.scheduledDeliveryDate).toBe("2026-10-20");
    expect(orderDoc?.scheduledDeliveryTime).toBe("03:00 PM – 03:30 PM");

    // Check getCustomerStats
    const stats = await t.query(api.orders.getCustomerStats, {
      organizationId: orgId,
      phone: "9876543210",
    });
    expect(stats.takeawayCount).toBe(1);
    expect(stats.recentOrders[0].scheduledDeliveryDate).toBe("2026-10-20");
    expect(stats.recentOrders[0].scheduledDeliveryTime).toBe("03:00 PM – 03:30 PM");
    expect(stats.recentOrders[0].orderType).toBe("ScheduledPickup");
  });

  it("5. Enforces advanceOrderTimeLimit (e.g. 24 hours notice)", async () => {
    const { orgId, itemId } = await seedTestStore();

    // Update schedule config to require 24 hours advance notice
    await t.run(async (ctx) => {
      const all = await ctx.db.query("organizationSchedulePickups").collect();
      if (all[0]) {
        await ctx.db.patch(all[0]._id, {
          advanceOrderTimeLimit: "24",
        });
      }
    });

    const fakeClockMs = new Date("2026-10-16T07:00:00Z").getTime();
    const { validateScheduledOrderSlot } = await import("./orders");

    // Attempt slot for today when 24 hrs is required -> Rejected
    expect(() =>
      validateScheduledOrderSlot({
        dateStr: "2026-10-16",
        timeSlotStr: "04:00 PM – 04:30 PM",
        isPickup: true,
        scheduleConfig: { advanceOrderTimeLimit: "24" },
        timeZone: "Asia/Kolkata",
        currentTimeMs: fakeClockMs,
      })
    ).toThrow("Selected time slot does not meet the minimum advance preparation lead time.");
  });

  it("6. Enforces advance booking horizon limit (e.g. 7 days max)", async () => {
    const fakeClockMs = new Date("2026-10-16T07:00:00Z").getTime();
    const { validateScheduledOrderSlot } = await import("./orders");

    // Attempt booking 20 days in the future when limit is 7 days -> Rejected
    expect(() =>
      validateScheduledOrderSlot({
        dateStr: "2026-11-15",
        timeSlotStr: "02:00 PM – 02:30 PM",
        isPickup: true,
        scheduleConfig: { advancePickupLimit: 7, advancePickupLimitType: "days" },
        timeZone: "Asia/Kolkata",
        currentTimeMs: fakeClockMs,
      })
    ).toThrow("Selected date is beyond the maximum advance booking limit (7 days).");
  });
});

