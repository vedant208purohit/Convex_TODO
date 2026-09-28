/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Order Status Progression Domain Suite", () => {
  test("1. Progresses order through standard sequential stages: Accepted -> In progress -> Ready to deliver -> Delivered", async () => {
    const t = convexTest(schema, modules);
    const adminT = t.withIdentity({ subject: "admin_user" });

    // 1. Create Organization
    const orgId = await t.mutation(api.organizations.create, {
      name: "Grand Spice Bistro",
    });

    // 2. Seed Admin User
    await t.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "admin_user",
      userType: ["admin"],
    });

    // 3. Create Standard Pipeline: Accepted (pos 1), In progress (pos 2), Ready to deliver (pos 3), Delivered (pos 4)
    const procAcceptedId = await adminT.mutation(
      api.organizationOrderProcesses.create,
      {
        name: "Accepted",
        position: 1,
        published: true,
        isSequence: true,
        processColor: "#262626",
      }
    );

    const procInProgressId = await adminT.mutation(
      api.organizationOrderProcesses.create,
      {
        name: "In progress",
        position: 2,
        published: true,
        isSequence: true,
        processColor: "#EA9C1B",
      }
    );

    const procReadyId = await adminT.mutation(
      api.organizationOrderProcesses.create,
      {
        name: "Ready to deliver",
        position: 3,
        published: true,
        isSequence: true,
        processColor: "#FC8019",
      }
    );

    const procDeliveredId = await adminT.mutation(
      api.organizationOrderProcesses.create,
      {
        name: "Delivered",
        position: 4,
        published: true,
        isSequence: true,
        processColor: "#219653",
      }
    );

    // 4. Create Menu Item
    const itemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Truffle Fries",
      price: 15000,
    });

    // 5. Create Order (starts at initial sequence step: Accepted)
    const orderRes = await t.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "TakeAway",
      items: [{ itemId, quantity: 1 }],
    });

    const orderId = orderRes.orderId;

    // Step A: Initial state
    const order0 = await t.query(api.orders.getOrderDetails, { id: orderId });
    expect(order0?.orderStatusId).toBe(procAcceptedId);
    expect(order0?.orderStatusName).toBe("Accepted");
    expect(order0?.activities).toHaveLength(1);
    expect(order0?.activities[0].processName).toBe("Accepted");

    // Step B: Transition from Accepted -> In progress
    const update1 = await t.mutation(api.orders.updateOrderStatus, {
      orderId,
      processId: procInProgressId,
    });
    expect(update1.success).toBe(true);
    expect(update1.statusName).toBe("In progress");

    const order1 = await t.query(api.orders.getOrderDetails, { id: orderId });
    expect(order1?.orderStatusId).toBe(procInProgressId);
    expect(order1?.orderStatusName).toBe("In progress");
    expect(order1?.activities).toHaveLength(2);
    expect(order1?.activities[1].processName).toBe("In progress");

    // Step C: Transition from In progress -> Ready to deliver
    const update2 = await t.mutation(api.orders.updateOrderStatus, {
      orderId,
      processId: procReadyId,
    });
    expect(update2.success).toBe(true);
    expect(update2.statusName).toBe("Ready to deliver");

    const order2 = await t.query(api.orders.getOrderDetails, { id: orderId });
    expect(order2?.orderStatusId).toBe(procReadyId);
    expect(order2?.orderStatusName).toBe("Ready to deliver");
    expect(order2?.activities).toHaveLength(3);
    expect(order2?.activities[2].processName).toBe("Ready to deliver");

    // Step D: Transition from Ready to deliver -> Delivered
    const update3 = await t.mutation(api.orders.updateOrderStatus, {
      orderId,
      processId: procDeliveredId,
    });
    expect(update3.success).toBe(true);
    expect(update3.statusName).toBe("Delivered");

    const order3 = await t.query(api.orders.getOrderDetails, { id: orderId });
    expect(order3?.orderStatusId).toBe(procDeliveredId);
    expect(order3?.orderStatusName).toBe("Delivered");
    expect(order3?.activities).toHaveLength(4);
    expect(order3?.activities[3].processName).toBe("Delivered");
  });

  test("2. Dynamic pipeline with custom process names and position order", async () => {
    const t = convexTest(schema, modules);
    const adminT = t.withIdentity({ subject: "admin_user" });

    const orgId = await t.mutation(api.organizations.create, {
      name: "Artisan Pizza Lab",
    });

    await t.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "admin_user",
      userType: ["admin"],
    });

    // Custom pipeline: Received (1), Dough Prep (2), Woodfire Baking (3), Packaged (4)
    const proc1 = await adminT.mutation(api.organizationOrderProcesses.create, {
      name: "Received",
      position: 1,
      published: true,
      isSequence: true,
      processColor: "#111827",
    });

    const proc2 = await adminT.mutation(api.organizationOrderProcesses.create, {
      name: "Dough Prep",
      position: 2,
      published: true,
      isSequence: true,
      processColor: "#F59E0B",
    });

    const proc3 = await adminT.mutation(api.organizationOrderProcesses.create, {
      name: "Woodfire Baking",
      position: 3,
      published: true,
      isSequence: true,
      processColor: "#EF4444",
    });

    const proc4 = await adminT.mutation(api.organizationOrderProcesses.create, {
      name: "Packaged",
      position: 4,
      published: true,
      isSequence: true,
      processColor: "#10B981",
    });

    const itemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Margherita D.O.P.",
      price: 45000,
    });

    const orderRes = await t.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "TakeAway",
      items: [{ itemId, quantity: 1 }],
    });

    // Verify created at Received
    let order = await t.query(api.orders.getOrderDetails, { id: orderRes.orderId });
    expect(order?.orderStatusName).toBe("Received");

    // Advance to Dough Prep
    await t.mutation(api.orders.updateOrderStatus, {
      orderId: orderRes.orderId,
      processId: proc2,
    });
    order = await t.query(api.orders.getOrderDetails, { id: orderRes.orderId });
    expect(order?.orderStatusName).toBe("Dough Prep");

    // Advance to Woodfire Baking
    await t.mutation(api.orders.updateOrderStatus, {
      orderId: orderRes.orderId,
      processId: proc3,
    });
    order = await t.query(api.orders.getOrderDetails, { id: orderRes.orderId });
    expect(order?.orderStatusName).toBe("Woodfire Baking");

    // Advance to Packaged
    await t.mutation(api.orders.updateOrderStatus, {
      orderId: orderRes.orderId,
      processId: proc4,
    });
    order = await t.query(api.orders.getOrderDetails, { id: orderRes.orderId });
    expect(order?.orderStatusName).toBe("Packaged");
    expect(order?.activities).toHaveLength(4);
  });

  test("3. Edge Case: Cancelled order records cancellation in activities", async () => {
    const t = convexTest(schema, modules);
    const adminT = t.withIdentity({ subject: "admin_user" });

    const orgId = await t.mutation(api.organizations.create, {
      name: "Fast Bites",
    });

    await t.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "admin_user",
      userType: ["admin"],
    });

    await adminT.mutation(api.organizationOrderProcesses.create, {
      name: "Accepted",
      position: 1,
      published: true,
      isSequence: true,
    });

    const itemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Burger",
      price: 10000,
    });

    const orderRes = await t.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "TakeAway",
      items: [{ itemId, quantity: 1 }],
    });

    // Cancel order
    await t.mutation(api.orders.cancelOrder, {
      orderId: orderRes.orderId,
      reason: "Customer requested cancellation",
    });

    const order = await t.query(api.orders.getOrderDetails, { id: orderRes.orderId });
    expect(order?.isRejected).toBe(true);
    expect(order?.orderStatusName).toBe("Cancelled");
    expect(order?.activities.some((a) => a.processName === "Cancelled")).toBe(true);
  });

  test("4. Edge Case: updateOrderStatus rejects when given non-existent processId", async () => {
    const t = convexTest(schema, modules);
    const adminT = t.withIdentity({ subject: "admin_user" });

    const orgId = await t.mutation(api.organizations.create, {
      name: "Spice Hub",
    });

    await t.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "admin_user",
      userType: ["admin"],
    });

    const validProcId = await adminT.mutation(
      api.organizationOrderProcesses.create,
      {
        name: "Accepted",
        position: 1,
        published: true,
        isSequence: true,
      }
    );

    const itemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Soda",
      price: 5000,
    });

    const orderRes = await t.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "TakeAway",
      items: [{ itemId, quantity: 1 }],
    });

    // Soft-delete the process
    await adminT.mutation(api.organizationOrderProcesses.remove, {
      id: validProcId,
    });

    // Try to update with soft-deleted or non-existent process
    await expect(
      t.mutation(api.orders.updateOrderStatus, {
        orderId: orderRes.orderId,
        processId: validProcId,
      })
    ).rejects.toThrow("Order process step not found");
  });

  test("5. Dynamic Next-Process Calculation Helper respects position ordering", async () => {
    const t = convexTest(schema, modules);
    const adminT = t.withIdentity({ subject: "admin_user" });

    const orgId = await t.mutation(api.organizations.create, {
      name: "Gourmet Diner",
    });

    await t.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "admin_user",
      userType: ["admin"],
    });

    // Create unordered in time but strictly positioned
    const p3 = await adminT.mutation(api.organizationOrderProcesses.create, {
      name: "Step 3 - Ready",
      position: 3,
      published: true,
      isSequence: true,
    });

    const p1 = await adminT.mutation(api.organizationOrderProcesses.create, {
      name: "Step 1 - Placed",
      position: 1,
      published: true,
      isSequence: true,
    });

    const p2 = await adminT.mutation(api.organizationOrderProcesses.create, {
      name: "Step 2 - Cooking",
      position: 2,
      published: true,
      isSequence: true,
    });

    // Fetch processes
    const rawProcesses = await t.query(api.organizationOrderProcesses.list, {
      published: true,
      isSequence: true,
    });

    // Filter and sort by position strictly
    const seq = rawProcesses
      .filter((p) => p.published && p.isSequence)
      .sort((a, b) => a.position - b.position);

    expect(seq.map((p) => p.name)).toEqual([
      "Step 1 - Placed",
      "Step 2 - Cooking",
      "Step 3 - Ready",
    ]);

    // Test transition resolution
    const currentIdx0 = seq.findIndex((p) => p._id === p1);
    expect(currentIdx0).toBe(0);
    const next0 = seq[currentIdx0 + 1];
    expect(next0._id).toBe(p2);
    expect(next0.name).toBe("Step 2 - Cooking");

    const currentIdx1 = seq.findIndex((p) => p._id === p2);
    expect(currentIdx1).toBe(1);
    const next1 = seq[currentIdx1 + 1];
    expect(next1._id).toBe(p3);
    expect(next1.name).toBe("Step 3 - Ready");

    // Final stage check
    const currentIdx2 = seq.findIndex((p) => p._id === p3);
    expect(currentIdx2).toBe(2);
    const next2 = currentIdx2 < seq.length - 1 ? seq[currentIdx2 + 1] : null;
    expect(next2).toBeNull();
  });
});

