/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Unified Workstation, KDS, Orders & Lifecycle Synchronization Tests", () => {
  async function setupWorkstationEnvironment() {
    const t = convexTest(schema, modules);
    const adminClerkId = "clerk_chef_workstation_admin";
    const asAdmin = t.withIdentity({ subject: adminClerkId });

    // 1. Create Organization
    const orgId = await t.mutation(api.organizations.create, {
      name: "The Grand Prest Brasserie",
      ownerClerkId: adminClerkId,
      isDineIn: true,
      isTakeAway: true,
      isDelivery: true,
      isWorkstation: true,
      isKds: true,
      dineinPrepaid: true,
      dineinPospaid: false,
      deliveryOnlinePayment: true,
      deliveryCashOnDelivery: true,
    });

    // 2. Setup Order Processes
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

    // 3. Create Kitchen Stations (Hearth/Oven Station & Cold Pantry)
    const hearthStationRes = await asAdmin.mutation(api.stations.create, {
      name: "Hot Hearth & Oven",
      isMain: true,
    });
    const hearthStationId = hearthStationRes.id;

    const pantryStationRes = await asAdmin.mutation(api.stations.create, {
      name: "Cold Pantry & Garde",
      isMain: false,
    });
    const pantryStationId = pantryStationRes.id;

    // 4. Create Tables
    const tableId = await asAdmin.mutation(api.organizationTables.create, {
      tableNumber: "T-04",
      seatingCapacity: 4,
    });

    // 5. Create Menu Items
    const itemBreadId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Cheese filled garlic bread",
      price: 1600, // ₹16.00
    });

    const itemSaladId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Truffle Burrata salad",
      price: 1800, // ₹18.00
    });

    // Assign items to stations: Bread -> Hearth, Salad -> Pantry
    await asAdmin.mutation(api.stations.assignItemToStation, {
      stationId: hearthStationId,
      itemId: itemBreadId,
    });

    await asAdmin.mutation(api.stations.assignItemToStation, {
      stationId: pantryStationId,
      itemId: itemSaladId,
    });

    return {
      t,
      asAdmin,
      adminClerkId,
      orgId,
      hearthStationId,
      pantryStationId,
      tableId,
      itemBreadId,
      itemSaladId,
    };
  }

  test("Scenario 1: Dine-in order full lifecycle progression from Workstation", async () => {
    const { t, asAdmin, adminClerkId, orgId, tableId, itemBreadId } = await setupWorkstationEnvironment();

    // 1. Create a Dine-In order
    const orderRes = await asAdmin.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "DineIn",
      orderSource: "Prest-Captain",
      tableId,
      waiterUserId: adminClerkId,
      customerName: "Neel Raval",
      customerPhone: "+91 98250 88990",
      membersOnTable: 4,
      items: [{ itemId: itemBreadId, quantity: 2 }],
    });
    const orderId = orderRes.orderId;

    // 2. Query Workstation Active Queue
    const initialQueue = await asAdmin.query(api.workstation.listWorkstationOrders, {
      organizationId: orgId,
      filter: "all",
      viewMode: "active",
    });

    expect(initialQueue.orders.length).toBe(1);
    const orderTicket = initialQueue.orders[0];
    expect(orderTicket.customerName).toBe("Neel Raval");
    expect(orderTicket.destinationDetails).toContain("Table T-04");
    expect(orderTicket.statusKey).toBe("ACCEPTED");
    expect(orderTicket.nextActionLabel).toBe("START PREPARING");
    expect(orderTicket.nextActionStatus).toBe("IN_PROGRESS");
    expect(initialQueue.counts.dineIn).toBe(1);

    // 3. Advance to IN_PROGRESS
    const prepRes = await asAdmin.mutation(api.workstation.advanceOrderLifecycle, {
      orderId,
    });
    expect(prepRes.success).toBe(true);
    expect(prepRes.statusKey).toBe("IN_PROGRESS");

    const inProgressQueue = await asAdmin.query(api.workstation.listWorkstationOrders, {
      organizationId: orgId,
      viewMode: "active",
    });
    expect(inProgressQueue.orders[0].statusKey).toBe("IN_PROGRESS");
    expect(inProgressQueue.orders[0].nextActionLabel).toBe("MARK READY");
    expect(inProgressQueue.orders[0].nextActionStatus).toBe("READY");

    // 4. Advance to READY
    const readyRes = await asAdmin.mutation(api.workstation.advanceOrderLifecycle, {
      orderId,
    });
    expect(readyRes.success).toBe(true);
    expect(readyRes.statusKey).toBe("READY");

    const readyQueue = await asAdmin.query(api.workstation.listWorkstationOrders, {
      organizationId: orgId,
      viewMode: "active",
    });
    expect(readyQueue.orders[0].statusKey).toBe("READY");
    expect(readyQueue.orders[0].nextActionLabel).toBe("MARK SERVED");
    expect(readyQueue.orders[0].allItemsReady).toBe(true);

    // 5. Advance to COMPLETED (Served at Table)
    const servedRes = await asAdmin.mutation(api.workstation.advanceOrderLifecycle, {
      orderId,
    });
    expect(servedRes.success).toBe(true);
    expect(servedRes.isCompleted).toBe(true);

    // 6. Verify Active Queue is now empty and Completed History contains the order
    const emptyActiveQueue = await asAdmin.query(api.workstation.listWorkstationOrders, {
      organizationId: orgId,
      viewMode: "active",
    });
    expect(emptyActiveQueue.orders.length).toBe(0);
    expect(emptyActiveQueue.counts.all).toBe(0);
    expect(emptyActiveQueue.counts.completed).toBe(1);

    const historyQueue = await asAdmin.query(api.workstation.listWorkstationOrders, {
      organizationId: orgId,
      viewMode: "completed",
    });
    expect(historyQueue.orders.length).toBe(1);
    expect(historyQueue.orders[0].statusKey).toBe("COMPLETED");
    expect(historyQueue.orders[0].statusBadgeText).toBe("SERVED");
  });

  test("Scenario 2: Multi-station item routing and Workstation/KDS synchronization", async () => {
    const { asAdmin, adminClerkId, orgId, tableId, itemBreadId, itemSaladId, hearthStationId, pantryStationId } =
      await setupWorkstationEnvironment();

    // Create order with Bread (routed to Hearth) and Salad (routed to Pantry)
    const orderRes = await asAdmin.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "DineIn",
      orderSource: "Prest-Cashier",
      tableId,
      cashierUserId: adminClerkId,
      customerName: "Multi Station Guest",
      customerPhone: "+91 98989 89898",
      items: [
        { itemId: itemBreadId, quantity: 1 },
        { itemId: itemSaladId, quantity: 1 },
      ],
    });
    const orderId = orderRes.orderId;

    // Check Hearth station orders on KDS
    const hearthKds = await asAdmin.query(api.stations.getStationOrders, {
      stationId: hearthStationId,
      organizationId: orgId,
    });
    expect(hearthKds.orders.length).toBe(1);
    expect(hearthKds.orders[0].orderItems.length).toBe(1);
    expect(hearthKds.orders[0].orderItems[0].itemName).toBe("Cheese filled garlic bread");

    // Check Pantry station orders on KDS
    const pantryKds = await asAdmin.query(api.stations.getStationOrders, {
      stationId: pantryStationId,
      organizationId: orgId,
    });
    expect(pantryKds.orders.length).toBe(1);
    expect(pantryKds.orders[0].orderItems.length).toBe(1);
    expect(pantryKds.orders[0].orderItems[0].itemName).toBe("Truffle Burrata salad");

    // Mark Hearth station ticket ready on KDS
    const hearthReadyRes = await asAdmin.mutation(api.stations.markStationTicketReady, {
      stationId: hearthStationId,
      orderId,
    });
    // Order is NOT yet ready overall because Pantry station has not finished
    expect(hearthReadyRes.allOrderItemsReady).toBe(false);

    // Verify Workstation reflects partial readiness
    const workstationQueue = await asAdmin.query(api.workstation.listWorkstationOrders, {
      organizationId: orgId,
      viewMode: "active",
    });
    expect(workstationQueue.orders[0].allItemsReady).toBe(false);
    expect(workstationQueue.orders[0].someItemsReady).toBe(true);

    // Now mark Pantry station ticket ready on KDS
    const pantryReadyRes = await asAdmin.mutation(api.stations.markStationTicketReady, {
      stationId: pantryStationId,
      orderId,
    });
    // Now ALL items are ready!
    expect(pantryReadyRes.allOrderItemsReady).toBe(true);

    // Verify Workstation immediately reflects READY state!
    const workstationReadyQueue = await asAdmin.query(api.workstation.listWorkstationOrders, {
      organizationId: orgId,
      viewMode: "active",
    });
    expect(workstationReadyQueue.orders[0].statusKey).toBe("READY");
    expect(workstationReadyQueue.orders[0].allItemsReady).toBe(true);
    expect(workstationReadyQueue.orders[0].nextActionLabel).toBe("MARK SERVED");
  });

  test("Scenario 3: Takeaway & Delivery lifecycle handling and filter segregation", async () => {
    const { asAdmin, adminClerkId, orgId, itemBreadId } = await setupWorkstationEnvironment();

    // Create Takeaway order
    const takeawayRes = await asAdmin.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "TakeAway",
      orderSource: "Prest-Cashier",
      cashierUserId: adminClerkId,
      customerName: "Priya Patel",
      customerPhone: "+91 97123 45678",
      items: [{ itemId: itemBreadId, quantity: 1 }],
    });
    const takeawayOrderId = takeawayRes.orderId;

    // Create Delivery order
    const deliveryRes = await asAdmin.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "Delivery",
      orderSource: "Prest-Online",
      customerName: "Arjun Mehta",
      customerPhone: "+91 99044 11223",
      deliveryAddress: {
        addressLine1: "Flat 402, Sunset Towers",
        city: "Mumbai",
      },
      items: [{ itemId: itemBreadId, quantity: 1 }],
    });
    const deliveryOrderId = deliveryRes.orderId;

    // Test Takeaway filter
    const takeawayOnly = await asAdmin.query(api.workstation.listWorkstationOrders, {
      organizationId: orgId,
      filter: "takeaway",
      viewMode: "active",
    });
    expect(takeawayOnly.orders.length).toBe(1);
    expect(takeawayOnly.orders[0].orderNumber).toBeDefined();
    expect(takeawayOnly.orders[0].destinationTypeLabel).toBe("Takeaway");

    // Test Delivery filter
    const deliveryOnly = await asAdmin.query(api.workstation.listWorkstationOrders, {
      organizationId: orgId,
      filter: "delivery",
      viewMode: "active",
    });
    expect(deliveryOnly.orders.length).toBe(1);
    expect(deliveryOnly.orders[0].destinationTypeLabel).toBe("Delivery");
    expect(deliveryOnly.orders[0].destinationDetails).toContain("Flat 402, Sunset Towers");

    // Advance Takeaway order to Ready -> Handed Over
    await asAdmin.mutation(api.workstation.advanceOrderLifecycle, { orderId: takeawayOrderId }); // IN_PROGRESS
    await asAdmin.mutation(api.workstation.advanceOrderLifecycle, { orderId: takeawayOrderId }); // READY
    const takeawayReadyQueue = await asAdmin.query(api.workstation.listWorkstationOrders, {
      organizationId: orgId,
      filter: "takeaway",
      viewMode: "active",
    });
    expect(takeawayReadyQueue.orders[0].nextActionLabel).toBe("MARK HANDED OVER");

    await asAdmin.mutation(api.workstation.advanceOrderLifecycle, { orderId: takeawayOrderId }); // COMPLETED
    const takeawayCompleted = await asAdmin.query(api.workstation.listWorkstationOrders, {
      organizationId: orgId,
      filter: "takeaway",
      viewMode: "completed",
    });
    expect(takeawayCompleted.orders.length).toBe(1);
    expect(takeawayCompleted.orders[0].statusBadgeText).toBe("PICKED UP");

    // Advance Delivery order to Delivered
    await asAdmin.mutation(api.workstation.advanceOrderLifecycle, { orderId: deliveryOrderId }); // IN_PROGRESS
    await asAdmin.mutation(api.workstation.advanceOrderLifecycle, { orderId: deliveryOrderId }); // READY
    const deliveryReadyQueue = await asAdmin.query(api.workstation.listWorkstationOrders, {
      organizationId: orgId,
      filter: "delivery",
      viewMode: "active",
    });
    expect(deliveryReadyQueue.orders[0].nextActionLabel).toBe("MARK DELIVERED");

    await asAdmin.mutation(api.workstation.advanceOrderLifecycle, { orderId: deliveryOrderId }); // COMPLETED
    const deliveryCompleted = await asAdmin.query(api.workstation.listWorkstationOrders, {
      organizationId: orgId,
      filter: "delivery",
      viewMode: "completed",
    });
    expect(deliveryCompleted.orders.length).toBe(1);
    expect(deliveryCompleted.orders[0].statusBadgeText).toBe("DELIVERED");
  });

  test("Scenario 4: Rejection of invalid transitions on completed orders", async () => {
    const { asAdmin, adminClerkId, orgId, itemBreadId } = await setupWorkstationEnvironment();

    const orderRes = await asAdmin.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "TakeAway",
      orderSource: "Prest-Cashier",
      cashierUserId: adminClerkId,
      customerName: "Test Order",
      customerPhone: "+91 90000 00000",
      items: [{ itemId: itemBreadId, quantity: 1 }],
    });
    const orderId = orderRes.orderId;

    // Advance to COMPLETED
    await asAdmin.mutation(api.workstation.advanceOrderLifecycle, { orderId });
    await asAdmin.mutation(api.workstation.advanceOrderLifecycle, { orderId });
    await asAdmin.mutation(api.workstation.advanceOrderLifecycle, { orderId });

    // Attempting to advance again must fail
    await expect(
      asAdmin.mutation(api.workstation.advanceOrderLifecycle, { orderId })
    ).rejects.toThrow("Cannot advance a completed or cancelled order");
  });
});
