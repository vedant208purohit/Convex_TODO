/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Orders, Order Items and KDS Integration Suite", () => {
  test("1. Order Creation, Token Generation (#01), Tax Snapshot and Table Locking", async () => {
    const t = convexTest(schema, modules);
    const adminT = t.withIdentity({ subject: "admin_user" });

    // Create Org
    const orgId = await t.mutation(api.organizations.create, {
      name: "Grand Spice Bistro",
    });

    // Seed Admin User
    await t.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "admin_user",
      userType: ["admin"],
    });

    const setupTax = await t.mutation(api.taxation.autoSetupStoreTaxation, {
      organizationId: orgId,
      countryCode: "IN",
    });

    // Create Menu, Category and Item
    const menuId = await t.mutation(api.menu.createMenu, {
      organizationId: orgId,
      name: "Main Menu",
    });

    const catId = await t.mutation(api.menu.createCategory, {
      organizationId: orgId,
      menuId,
      name: "Starters",
    });

    const itemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Paneer Tikka",
      price: 25000,
      isGst: true,
    });

    await t.mutation(api.menu.addCategoryItem, {
      organizationId: orgId,
      categoryId: catId,
      itemId,
    });

    // Create Layout and Table
    const layoutId = await adminT.mutation(api.organizationLayouts.create, {
      name: "Main Hall",
    });

    const tableId = await adminT.mutation(api.organizationTables.create, {
      tableNumber: "T-01",
      seatingCapacity: 4,
      layoutId,
    });

    // Create Order
    const orderResult = await t.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "DineIn",
      tableId,
      items: [
        {
          itemId,
          quantity: 2,
        },
      ],
    });

    expect(orderResult.tokenNumber).toBe("#01");
    expect(orderResult.orderNumber).toContain("ORD-");

    // Verify Dine-In Table Locking
    const tableState = await adminT.query(api.organizationTables.get, { id: tableId });
    expect(tableState?.currentOrderId).toBe(orderResult.orderId.toString());

    // Verify Order Details
    const orderDetails = await t.query(api.orders.getOrderDetails, {
      id: orderResult.orderId,
    });

    expect(orderDetails).not.toBeNull();
    expect(orderDetails?.tokenNumber).toBe("#01");
    expect(orderDetails?.items).toHaveLength(1);
    expect(orderDetails?.items[0].itemName).toBe("Paneer Tikka");
    expect(orderDetails?.items[0].quantity).toBe(2);
    expect(orderDetails?.taxInfoSnapshot).not.toBeNull();
  });

  test("2. Live KDS Order Stream and Line Item Readiness Toggle", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Fast Bites KDS",
    });

    const itemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Veg Burger",
      price: 15000,
    });

    const orderResult = await t.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "TakeAway",
      items: [{ itemId, quantity: 1 }],
    });

    // Query Live Orders for Kitchen Display
    const liveOrders = await t.query(api.orders.listLiveOrders, {
      organizationId: orgId,
    });

    expect(liveOrders).toHaveLength(1);
    expect(liveOrders[0].items[0].isReady).toBe(false);

    // Kitchen Staff marks item as ready
    const orderItemId = liveOrders[0].items[0]._id;
    await t.mutation(api.orders.toggleOrderItemReady, {
      orderItemId,
      isReady: true,
    });

    const updatedLiveOrders = await t.query(api.orders.listLiveOrders, {
      organizationId: orgId,
    });
    expect(updatedLiveOrders[0].items[0].isReady).toBe(true);
  });

  test("3. Order Status Progression and Table Completion Workflow", async () => {
    const t = convexTest(schema, modules);
    const adminT = t.withIdentity({ subject: "admin_user" });

    const orgId = await t.mutation(api.organizations.create, {
      name: "Royal Dining",
    });

    await t.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "admin_user",
      userType: ["admin"],
    });

    // Create Order Status Processes
    const procAcceptedId = await adminT.mutation(api.organizationOrderProcesses.create, {
      name: "Accepted",
      position: 1,
      published: true,
      isSequence: true,
      processColor: "#22C55E",
    });

    const procCookingId = await adminT.mutation(api.organizationOrderProcesses.create, {
      name: "In progress",
      position: 2,
      published: true,
      isSequence: true,
      processColor: "#EAB308",
    });

    const layoutId = await adminT.mutation(api.organizationLayouts.create, {
      name: "Patio",
    });

    const tableId = await adminT.mutation(api.organizationTables.create, {
      tableNumber: "T-05",
      seatingCapacity: 2,
      layoutId,
    });

    const itemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Cold Coffee",
      price: 12000,
    });

    const orderResult = await t.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "DineIn",
      tableId,
      items: [{ itemId, quantity: 1 }],
    });

    // Advance Order Status to Cooking
    await t.mutation(api.orders.updateOrderStatus, {
      orderId: orderResult.orderId,
      processId: procCookingId,
    });

    const detailsAfterAdvance = await t.query(api.orders.getOrderDetails, {
      id: orderResult.orderId,
    });
    expect(detailsAfterAdvance?.orderStatusName).toBe("In progress");
    expect(detailsAfterAdvance?.activities).toHaveLength(2);

    // Complete Order and Clear Table
    const completeResult = await t.mutation(api.orders.completeOrder, {
      orderId: orderResult.orderId,
      transactionReference: "TXN-998877",
    });

    expect(completeResult.isCompleted).toBe(true);

    // Verify Table is Unlocked
    const tableAfterComplete = await adminT.query(api.organizationTables.get, {
      id: tableId,
    });
    expect(tableAfterComplete?.currentOrderId).toBeUndefined();

    // Verify Order is no longer in Live Orders stream
    const activeOrders = await t.query(api.orders.listLiveOrders, {
      organizationId: orgId,
    });
    expect(activeOrders).toHaveLength(0);
  });
});
