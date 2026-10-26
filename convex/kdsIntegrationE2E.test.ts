/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Critical KDS Integration, Dine-In Table Mapping & Live Tracking Tests", () => {
  async function setupKitchenEnvironment() {
    const t = convexTest(schema, modules);
    const adminClerkId = "clerk_chef_admin_99";
    const asAdmin = t.withIdentity({ subject: adminClerkId });

    // 1. Create Organization
    const orgId = await t.mutation(api.organizations.create, {
      name: "The Royal Dine Bistro",
      ownerClerkId: adminClerkId,
      isDineIn: true,
      isTakeAway: true,
      isDelivery: true,
      dineinPrepaid: false,
      dineinPospaid: true,
      deliveryOnlinePayment: true,
      deliveryCashOnDelivery: true,
    });

    // 2. Setup Order Processes in Settings -> Order Statuses
    const procAcceptedId = await asAdmin.mutation(api.organizationOrderProcesses.create, {
      name: "Accepted",
      position: 1,
      published: true,
      isSequence: true,
      processColor: "#262626",
    });

    const procCookingId = await asAdmin.mutation(api.organizationOrderProcesses.create, {
      name: "Cooking & Plating",
      position: 2,
      published: true,
      isSequence: true,
      processColor: "#EA9C1B",
    });

    const procReadyId = await asAdmin.mutation(api.organizationOrderProcesses.create, {
      name: "Ready to Serve",
      position: 3,
      published: true,
      isSequence: true,
      processColor: "#FC8019",
    });

    const procServedId = await asAdmin.mutation(api.organizationOrderProcesses.create, {
      name: "Served at Table",
      position: 4,
      published: true,
      isSequence: true,
      processColor: "#219653",
    });

    // 3. Create Kitchen Workstations (Main Station and Bar/Dessert Station)
    const mainStationRes = await asAdmin.mutation(api.stations.create, {
      name: "Main Kitchen",
      isMain: true,
    });
    const mainStationId = mainStationRes.id;

    const barStationRes = await asAdmin.mutation(api.stations.create, {
      name: "Bar Station",
      isMain: false,
    });
    const barStationId = barStationRes.id;

    // 4. Create Tables and QR Codes
    const tableFiveId = await asAdmin.mutation(api.organizationTables.create, {
      tableNumber: "T-FIVE",
      seatingCapacity: 4,
    });

    const tableTenId = await asAdmin.mutation(api.organizationTables.create, {
      tableNumber: "T-TEN",
      seatingCapacity: 2,
    });

    const qrFiveRes = await asAdmin.mutation(api.organizationQrCodes.create, {
      name: "QR Table T-FIVE",
      tableId: tableFiveId,
      qrType: "DineIn",
      tableNumber: "T-FIVE",
    });
    const qrFiveId = qrFiveRes._id;

    const qrTenRes = await asAdmin.mutation(api.organizationQrCodes.create, {
      name: "QR Table T-TEN",
      tableId: tableTenId,
      qrType: "DineIn",
      tableNumber: "T-TEN",
    });
    const qrTenId = qrTenRes._id;

    // 5. Seed Menu Items
    const starterItemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Paneer Tikka",
      price: 28000,
    });

    const beverageItemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Mango Lassi",
      price: 12000,
    });

    const unmappedItemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Chef Special Curry",
      price: 35000,
    });

    // Map beverage to Bar Station
    await asAdmin.mutation(api.stations.assignItemToStation, {
      stationId: barStationId,
      itemId: beverageItemId,
    });

    return {
      t,
      asAdmin,
      orgId,
      procAcceptedId,
      procCookingId,
      procReadyId,
      procServedId,
      mainStationId,
      barStationId,
      tableFiveId,
      tableTenId,
      qrFiveId,
      qrTenId,
      starterItemId,
      beverageItemId,
      unmappedItemId,
    };
  }

  describe("Phase 2 & 3: Canonical Persistence, Dine-In Table Mapping & KDS Visibility", () => {
    test("Dine-In order with Table T-FIVE QR code resolves table number and displays on KDS", async () => {
      const env = await setupKitchenEnvironment();

      // Customer places order through QR code for Table T-FIVE
      const orderRes = await env.asAdmin.mutation(api.orders.createOrder, {
        organizationId: env.orgId,
        orderType: "DineIn",
        orderSource: "PREST-QR",
        qrId: env.qrFiveId,
        items: [{ itemId: env.starterItemId, quantity: 2 }],
      });

      expect(orderRes.orderId).toBeDefined();

      // 1. Verify Convex persistence
      const persistedOrder = await env.t.run(async (ctx) => {
        return await ctx.db.get(orderRes.orderId);
      });

      expect(persistedOrder).toBeDefined();
      expect(persistedOrder?.isCompleted).toBe(false); // Active lifecycle
      expect(persistedOrder?.tableId).toBe(env.tableFiveId); // Authoritatively resolved
      expect(persistedOrder?.qrId).toBe(env.qrFiveId);

      // 2. Query KDS for Main Station
      const kdsOrders = await env.asAdmin.query(api.stations.getStationOrders, {
        stationId: env.mainStationId,
      });

      expect(kdsOrders.orders.length).toBe(1);
      const ticket = kdsOrders.orders[0];
      expect(ticket.order.tableNumber).toBe("T-FIVE");
      expect(ticket.order.tableId).toBe(env.tableFiveId);
      expect(ticket.order.isStationAccepted).toBe(true);
      expect(ticket.order.isStationInProgress).toBe(false);
      expect(ticket.order.isStationReady).toBe(false);
    });

    test("Two different table QR codes isolate their own correct tables in KDS", async () => {
      const env = await setupKitchenEnvironment();

      const order1 = await env.asAdmin.mutation(api.orders.createOrder, {
        organizationId: env.orgId,
        orderType: "DineIn",
        qrId: env.qrFiveId,
        items: [{ itemId: env.starterItemId, quantity: 1 }],
      });

      const order2 = await env.asAdmin.mutation(api.orders.createOrder, {
        organizationId: env.orgId,
        orderType: "DineIn",
        qrId: env.qrTenId,
        items: [{ itemId: env.starterItemId, quantity: 1 }],
      });

      const kdsOrders = await env.asAdmin.query(api.stations.getStationOrders, {
        stationId: env.mainStationId,
      });

      expect(kdsOrders.orders.length).toBe(2);
      const ticket1 = kdsOrders.orders.find((o) => o.order._id === order1.orderId);
      const ticket2 = kdsOrders.orders.find((o) => o.order._id === order2.orderId);

      expect(ticket1?.order.tableNumber).toBe("T-FIVE");
      expect(ticket2?.order.tableNumber).toBe("T-TEN");
    });

    test("Unmapped menu items route to Main station by default", async () => {
      const env = await setupKitchenEnvironment();

      // Place order with unmapped item
      const orderRes = await env.asAdmin.mutation(api.orders.createOrder, {
        organizationId: env.orgId,
        orderType: "DineIn",
        qrId: env.qrFiveId,
        items: [{ itemId: env.unmappedItemId, quantity: 1 }],
      });

      // Query Main station KDS
      const mainKds = await env.asAdmin.query(api.stations.getStationOrders, {
        stationId: env.mainStationId,
      });

      expect(mainKds.orders.some((o) => o.order._id === orderRes.orderId)).toBe(true);

      // Bar station should NOT see the unmapped item
      const barKds = await env.asAdmin.query(api.stations.getStationOrders, {
        stationId: env.barStationId,
      });

      expect(barKds.orders.some((o) => o.order._id === orderRes.orderId)).toBe(false);
    });
  });

  describe("Phase 4, 5 & 6: Order Status Transitions & Dine-In Lifecycle", () => {
    test("Kitchen preparation and readiness actions update persisted state without premature completion", async () => {
      const env = await setupKitchenEnvironment();

      const orderRes = await env.asAdmin.mutation(api.orders.createOrder, {
        organizationId: env.orgId,
        orderType: "DineIn",
        qrId: env.qrFiveId,
        items: [{ itemId: env.starterItemId, quantity: 2 }],
      });

      // 1. Chef starts preparing ticket
      await env.asAdmin.mutation(api.stations.startPreparingStationTicket, {
        stationId: env.mainStationId,
        orderId: orderRes.orderId,
      });

      let orderDoc = await env.t.run(async (ctx) => ctx.db.get(orderRes.orderId));
      expect(orderDoc?.orderStatusName).toBe("Cooking & Plating");
      expect(orderDoc?.isCompleted).toBe(false);

      // 2. Chef marks all station items ready
      await env.asAdmin.mutation(api.stations.markStationTicketReady, {
        stationId: env.mainStationId,
        orderId: orderRes.orderId,
      });

      orderDoc = await env.t.run(async (ctx) => ctx.db.get(orderRes.orderId));
      expect(orderDoc?.orderStatusName).toBe("Ready to Serve");
      expect(orderDoc?.isCompleted).toBe(false); // Still NOT complete until served!

      // 3. Waiter serves order at table
      await env.asAdmin.mutation(api.stations.advanceStationTicketProcess, {
        stationId: env.mainStationId,
        orderId: orderRes.orderId,
        targetProcessId: env.procServedId,
      });

      orderDoc = await env.t.run(async (ctx) => ctx.db.get(orderRes.orderId));
      expect(orderDoc?.orderStatusName).toBe("Served at Table");

      // Staff completes order via completeOrder
      await env.asAdmin.mutation(api.orders.completeOrder, {
        orderId: orderRes.orderId,
      });
      orderDoc = await env.t.run(async (ctx) => ctx.db.get(orderRes.orderId));
      expect(orderDoc?.isCompleted).toBe(true);
    });

    test("Advancing to 'Ready to deliver' process keeps isCompleted: false and visible in KDS", async () => {
      const env = await setupKitchenEnvironment();

      await env.asAdmin.mutation(api.organizationOrderProcesses.update, {
        id: env.procReadyId,
        name: "Ready to deliver",
      });

      const orderRes = await env.asAdmin.mutation(api.orders.createOrder, {
        organizationId: env.orgId,
        orderType: "Delivery",
        paymentMode: "Razorpay",
        paymentStatus: "Paid",
        items: [{ itemId: env.starterItemId, quantity: 1 }],
      });

      // Move to Ready to deliver via advanceStationTicketProcess
      await env.asAdmin.mutation(api.stations.advanceStationTicketProcess, {
        stationId: env.mainStationId,
        orderId: orderRes.orderId,
        targetProcessId: env.procReadyId,
      });

      const orderDoc = await env.t.run(async (ctx) => ctx.db.get(orderRes.orderId));
      expect(orderDoc?.orderStatusName).toBe("Ready to deliver");
      expect(orderDoc?.isCompleted).toBe(false); // MUST NOT be prematurely completed!

      // Verify ticket is still returned in KDS query
      const kds = await env.asAdmin.query(api.stations.getStationOrders, {
        stationId: env.mainStationId,
      });
      const ticket = kds.orders.find((o) => o.order._id === orderRes.orderId);
      expect(ticket).toBeDefined();
      expect(ticket?.order.isCompleted).toBe(false);
      expect(ticket?.order.orderStatusName).toBe("Ready to deliver");
    });
  });

  describe("Phase 7: Takeaway Lifecycle & Payment Confirmation", () => {
    test("Online payment confirmation does NOT prematurely complete Takeaway order", async () => {
      const env = await setupKitchenEnvironment();

      const orderRes = await env.asAdmin.mutation(api.orders.createOrder, {
        organizationId: env.orgId,
        orderType: "TakeAway",
        paymentMode: "Razorpay",
        paymentStatus: "Pending",
        items: [{ itemId: env.starterItemId, quantity: 1 }],
      });

      // Customer completes online payment via Razorpay
      await env.asAdmin.mutation(api.orders.confirmOrderPayment, {
        orderId: orderRes.orderId,
        paymentMode: "Razorpay",
        transactionReference: "pay_test_998877",
      });

      const orderDoc = await env.t.run(async (ctx) => ctx.db.get(orderRes.orderId));
      expect(orderDoc?.paymentStatus).toBe("Paid");
      expect(orderDoc?.isCompleted).toBe(false); // Still visible in kitchen queue!

      // Appears in KDS as active
      const kds = await env.asAdmin.query(api.stations.getStationOrders, {
        stationId: env.mainStationId,
      });
      expect(kds.activeOrdersCount).toBeGreaterThanOrEqual(1);
      expect(kds.orders.some((o) => o.order._id === orderRes.orderId)).toBe(true);
    });
  });

  describe("Phase 8: Delivery Lifecycle & Real Map Location Updates", () => {
    test("Real courier coordinates update delivery record and do not fabricate movement", async () => {
      const env = await setupKitchenEnvironment();

      const orderRes = await env.asAdmin.mutation(api.orders.createOrder, {
        organizationId: env.orgId,
        orderType: "Delivery",
        items: [{ itemId: env.starterItemId, quantity: 1 }],
      });

      // Dispatch delivery
      const dispatchRes = await env.asAdmin.mutation(api.orderDelivers.dispatchOrderDelivery, {
        orderId: orderRes.orderId,
      });

      expect(dispatchRes.deliveryId).toBeDefined();

      // Dispatch success
      await env.t.mutation(internal.orderDelivers.finalizePorterDispatchSuccess, {
        deliveryId: dispatchRes.deliveryId,
        providerOrderId: "cr_order_112233",
      });

      // Live location ping from courier (e.g. lat: 23.0305, lng: 72.5801)
      await env.asAdmin.mutation(api.orderDelivers.updateDeliveryLocation, {
        deliveryId: dispatchRes.deliveryId,
        latitude: 23.0305,
        longitude: 72.5801,
      });

      // Verify updated coordinates in delivery query
      const deliveryAttempt = await env.asAdmin.query(api.orderDelivers.getDeliveryAttempt, {
        id: dispatchRes.deliveryId,
      });

      expect(deliveryAttempt?.partnerInfo?.latitude).toBe(23.0305);
      expect(deliveryAttempt?.partnerInfo?.longitude).toBe(72.5801);

      // Rejects invalid coordinates
      await expect(
        env.asAdmin.mutation(api.orderDelivers.updateDeliveryLocation, {
          deliveryId: dispatchRes.deliveryId,
          latitude: 999, // Out of range [-90, 90]
          longitude: 72.5801,
        })
      ).rejects.toThrow("Invalid latitude or longitude values");
    });
  });

  describe("Multi-Station Order Routing", () => {
    test("Order with starter and beverage routes items to respective stations without duplicating tickets", async () => {
      const env = await setupKitchenEnvironment();

      const orderRes = await env.asAdmin.mutation(api.orders.createOrder, {
        organizationId: env.orgId,
        orderType: "DineIn",
        qrId: env.qrFiveId,
        items: [
          { itemId: env.starterItemId, quantity: 1 },
          { itemId: env.beverageItemId, quantity: 2 },
        ],
      });

      // 1. Main Kitchen KDS should see only the starter item
      const mainKds = await env.asAdmin.query(api.stations.getStationOrders, {
        stationId: env.mainStationId,
      });
      const mainTicket = mainKds.orders.find((o) => o.order._id === orderRes.orderId);
      expect(mainTicket).toBeDefined();
      expect(mainTicket?.orderItems.length).toBe(1);
      expect(mainTicket?.orderItems[0].itemName).toBe("Paneer Tikka");

      // 2. Bar Station KDS should see only the beverage item
      const barKds = await env.asAdmin.query(api.stations.getStationOrders, {
        stationId: env.barStationId,
      });
      const barTicket = barKds.orders.find((o) => o.order._id === orderRes.orderId);
      expect(barTicket).toBeDefined();
      expect(barTicket?.orderItems.length).toBe(1);
      expect(barTicket?.orderItems[0].itemName).toBe("Mango Lassi");

      // 3. Completing the starter at Main Kitchen does NOT complete overall order
      await env.asAdmin.mutation(api.stations.markStationTicketReady, {
        stationId: env.mainStationId,
        orderId: orderRes.orderId,
      });

      let orderDoc = await env.t.run(async (ctx) => ctx.db.get(orderRes.orderId));
      expect(orderDoc?.orderStatusName).not.toBe("Ready to Serve"); // Bar is still not ready!

      // 4. Completing beverage at Bar Station completes overall order readiness
      await env.asAdmin.mutation(api.stations.markStationTicketReady, {
        stationId: env.barStationId,
        orderId: orderRes.orderId,
      });

      orderDoc = await env.t.run(async (ctx) => ctx.db.get(orderRes.orderId));
      expect(orderDoc?.orderStatusName).toBe("Ready to Serve");
    });
  });
});
