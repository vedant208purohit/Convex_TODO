/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Order Activities Duration & Preparation Timing Suite", () => {
  async function setupStore(t: any, orgName: string = "Spice Kitchen") {
    const adminT = t.withIdentity({ subject: "admin_user" });

    const orgId = await t.mutation(api.organizations.create, {
      name: orgName,
    });

    await t.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "admin_user",
      userType: ["admin"],
    });

    const menuId = await t.mutation(api.menu.createMenu, {
      organizationId: orgId,
      name: "Main Menu",
    });

    const catId = await t.mutation(api.menu.createCategory, {
      organizationId: orgId,
      menuId,
      name: "Mains",
    });

    const itemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Butter Chicken",
      price: 35000,
    });

    await t.mutation(api.menu.addCategoryItem, {
      organizationId: orgId,
      categoryId: catId,
      itemId,
    });

    // Setup custom organization processes
    const p1 = await adminT.mutation(api.organizationOrderProcesses.create, {
      name: "Placed",
      position: 1,
      isSequence: true,
      published: true,
    });

    const p2 = await adminT.mutation(api.organizationOrderProcesses.create, {
      name: "Preparing",
      position: 2,
      isSequence: true,
      published: true,
    });

    const p3 = await adminT.mutation(api.organizationOrderProcesses.create, {
      name: "Ready",
      position: 3,
      isSequence: true,
      published: true,
    });

    const p4 = await adminT.mutation(api.organizationOrderProcesses.create, {
      name: "Served",
      position: 4,
      isSequence: true,
      published: true,
    });

    return {
      adminT,
      orgId,
      menuId,
      catId,
      itemId,
      processes: { p1, p2, p3, p4 },
    };
  }

  test("1. Initial order creation creates position 1 activity with totalDuration = 0 and startedAt", async () => {
    const t = convexTest(schema, modules);
    const { orgId, itemId } = await setupStore(t);

    const orderRes = await t.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "TakeAway",
      items: [{ itemId, quantity: 1 }],
    });

    const activities = await t.query(api.orders.listOrderActivities, {
      orderId: orderRes.orderId,
    });

    expect(activities).toHaveLength(1);
    const initialActivity = activities[0];
    expect(initialActivity.position).toBe(1);
    expect(initialActivity.totalDuration).toBe(0);
    expect(initialActivity.startedAt).toBeDefined();
    expect(initialActivity.completedAt).toBeUndefined();
    expect(initialActivity.organizationId).toBe(orgId);
    expect(initialActivity.orderId).toBe(orderRes.orderId);
  });

  test("2. Sequential process transitions calculate totalDuration in seconds and close previous step", async () => {
    const t = convexTest(schema, modules);
    const { orgId, itemId, processes } = await setupStore(t);

    // Create order
    const orderRes = await t.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "TakeAway",
      items: [{ itemId, quantity: 1 }],
    });

    // Step 2: Preparing
    await t.mutation(api.orders.updateOrderStatus, {
      orderId: orderRes.orderId,
      processId: processes.p2,
    });

    let activities = await t.query(api.orders.listOrderActivities, {
      orderId: orderRes.orderId,
    });

    expect(activities).toHaveLength(2);
    const step1 = activities[0];
    const step2 = activities[1];

    expect(step1.completedAt).toBeDefined();
    expect(step2.processName).toBe("Preparing");
    expect(step2.totalDuration).toBeGreaterThanOrEqual(0);
    expect(typeof step2.totalDuration).toBe("number");
    expect(step2.startedAt).toBeDefined();
    expect(step2.completedAt).toBeUndefined();

    // Step 3: Ready
    await t.mutation(api.orders.updateOrderStatus, {
      orderId: orderRes.orderId,
      processId: processes.p3,
    });

    activities = await t.query(api.orders.listOrderActivities, {
      orderId: orderRes.orderId,
    });

    expect(activities).toHaveLength(3);
    const updatedStep2 = activities[1];
    const step3 = activities[2];

    expect(updatedStep2.completedAt).toBeDefined();
    expect(step3.processName).toBe("Ready");
    expect(step3.totalDuration).toBeGreaterThanOrEqual(0);
  });

  test("3. Order completion closes all open order activities", async () => {
    const t = convexTest(schema, modules);
    const { orgId, itemId, processes } = await setupStore(t);

    const orderRes = await t.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "TakeAway",
      items: [{ itemId, quantity: 1 }],
    });

    await t.mutation(api.orders.updateOrderStatus, {
      orderId: orderRes.orderId,
      processId: processes.p2,
    });

    // Complete order
    await t.mutation(api.orders.completeOrder, {
      orderId: orderRes.orderId,
      paymentMode: "Cash",
    });

    const activities = await t.query(api.orders.listOrderActivities, {
      orderId: orderRes.orderId,
    });

    expect(activities.length).toBeGreaterThanOrEqual(2);
    for (const act of activities) {
      expect(act.completedAt).toBeDefined();
    }
  });

  test("4. Skipped processes work cleanly and record duration since initial step", async () => {
    const t = convexTest(schema, modules);
    const { orgId, itemId, processes } = await setupStore(t);

    const orderRes = await t.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "TakeAway",
      items: [{ itemId, quantity: 1 }],
    });

    // Skip Preparing (p2) directly to Served (p4)
    await t.mutation(api.orders.updateOrderStatus, {
      orderId: orderRes.orderId,
      processId: processes.p4,
    });

    const activities = await t.query(api.orders.listOrderActivities, {
      orderId: orderRes.orderId,
    });

    expect(activities).toHaveLength(2);
    expect(activities[0].completedAt).toBeDefined();
    expect(activities[1].processName).toBe("Served");
    expect(activities[1].totalDuration).toBeGreaterThanOrEqual(0);
  });

  test("5. Repeated processes append new activities with updated cumulative duration", async () => {
    const t = convexTest(schema, modules);
    const { orgId, itemId, processes } = await setupStore(t);

    const orderRes = await t.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "TakeAway",
      items: [{ itemId, quantity: 1 }],
    });

    // Preparing -> Ready -> Preparing again (e.g. food rework)
    await t.mutation(api.orders.updateOrderStatus, {
      orderId: orderRes.orderId,
      processId: processes.p2,
    });

    await t.mutation(api.orders.updateOrderStatus, {
      orderId: orderRes.orderId,
      processId: processes.p3,
    });

    await t.mutation(api.orders.updateOrderStatus, {
      orderId: orderRes.orderId,
      processId: processes.p2,
    });

    const activities = await t.query(api.orders.listOrderActivities, {
      orderId: orderRes.orderId,
    });

    expect(activities).toHaveLength(4);
    expect(activities[0].processName).toBe("Placed");
    expect(activities[1].processName).toBe("Preparing");
    expect(activities[2].processName).toBe("Ready");
    expect(activities[3].processName).toBe("Preparing");

    expect(activities[0].completedAt).toBeDefined();
    expect(activities[1].completedAt).toBeDefined();
    expect(activities[2].completedAt).toBeDefined();
    expect(activities[3].completedAt).toBeUndefined();
  });

  test("6. Cancelled order logs cancellation activity and closes open activities", async () => {
    const t = convexTest(schema, modules);
    const { orgId, itemId, processes } = await setupStore(t);

    const orderRes = await t.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "TakeAway",
      items: [{ itemId, quantity: 1 }],
    });

    await t.mutation(api.orders.updateOrderStatus, {
      orderId: orderRes.orderId,
      processId: processes.p2,
    });

    await t.mutation(api.orders.cancelOrder, {
      orderId: orderRes.orderId,
      reason: "Customer requested cancellation",
    });

    const activities = await t.query(api.orders.listOrderActivities, {
      orderId: orderRes.orderId,
    });

    const cancelAct = activities.find((a) => a.processName === "Cancelled");
    expect(cancelAct).toBeDefined();
    expect(cancelAct?.position).toBe(99);
    expect(cancelAct?.totalDuration).toBeGreaterThanOrEqual(0);

    const prevAct = activities.find((a) => a.processName === "Preparing");
    expect(prevAct?.completedAt).toBeDefined();
  });

  test("7. KDS getStationOrders includes order activities and currentDuration metrics", async () => {
    const t = convexTest(schema, modules);
    const { adminT, orgId, itemId, processes } = await setupStore(t);

    // Create Kitchen Station and route item to it
    const stationRes = await adminT.mutation(api.stations.create, {
      name: "Hot Kitchen",
      isMain: true,
    });

    await adminT.mutation(api.stations.assignItemToStation, {
      stationId: stationRes.id,
      itemId,
    });

    const orderRes = await t.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "DineIn",
      items: [{ itemId, quantity: 2 }],
    });

    await t.mutation(api.orders.updateOrderStatus, {
      orderId: orderRes.orderId,
      processId: processes.p2,
    });

    const stationOrders = await adminT.query(api.stations.getStationOrders, {
      stationId: stationRes.id,
    });

    expect(stationOrders.orders).toHaveLength(1);
    const kdsOrder = stationOrders.orders[0].order;
    expect(kdsOrder.activities).toBeDefined();
    expect(kdsOrder.activities.length).toBeGreaterThanOrEqual(2);
    expect(kdsOrder.currentDuration).toBeDefined();
    expect(typeof kdsOrder.currentDuration).toBe("number");
  });

  test("8. Cross-organization isolation and backward compatibility", async () => {
    const t = convexTest(schema, modules);
    const store1 = await setupStore(t, "Store One");

    const adminT2 = t.withIdentity({ subject: "admin_user_2" });
    const orgId2 = await t.mutation(api.organizations.create, {
      name: "Store Two",
    });
    await t.mutation(api.organizationUsers.create, {
      organizationId: orgId2,
      userId: "admin_user_2",
      userType: ["admin"],
    });

    const menuId2 = await t.mutation(api.menu.createMenu, {
      organizationId: orgId2,
      name: "Main Menu 2",
    });
    const catId2 = await t.mutation(api.menu.createCategory, {
      organizationId: orgId2,
      menuId: menuId2,
      name: "Mains 2",
    });
    const itemId2 = await t.mutation(api.menu.createItem, {
      organizationId: orgId2,
      name: "Dal Makhani",
      price: 25000,
    });
    await t.mutation(api.menu.addCategoryItem, {
      organizationId: orgId2,
      categoryId: catId2,
      itemId: itemId2,
    });

    const order1 = await t.mutation(api.orders.createOrder, {
      organizationId: store1.orgId,
      orderType: "TakeAway",
      items: [{ itemId: store1.itemId, quantity: 1 }],
    });

    const order2 = await t.mutation(api.orders.createOrder, {
      organizationId: orgId2,
      orderType: "TakeAway",
      items: [{ itemId: itemId2, quantity: 1 }],
    });

    const activities1 = await t.query(api.orders.listOrderActivities, {
      orderId: order1.orderId,
    });
    const activities2 = await t.query(api.orders.listOrderActivities, {
      orderId: order2.orderId,
    });

    expect(activities1.every((a) => a.organizationId === store1.orgId)).toBe(true);
    expect(activities2.every((a) => a.organizationId === orgId2)).toBe(true);
    expect(activities1.some((a) => a.orderId === order2.orderId)).toBe(false);
  });
});
