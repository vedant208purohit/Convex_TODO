/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import {
  renderNotificationTemplate,
  isCustomerTypeMatch,
  NotificationTemplateData,
} from "./processNotifications";

const modules = import.meta.glob("./**/*.*s");

describe("Process Notifications Domain Unit & Integration Tests", () => {
  // Helper: Setup store with admin user and default order processes
  async function setupStoreWithAdmin(adminClerkId = "user_admin_1") {
    const t = convexTest(schema, modules);

    // Create store organization with initial owner
    const orgId = await t.mutation(api.organizations.create, {
      name: "Tandoori Flames Bistro",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    // Seed default processes and retrieve them
    const procAcceptedId = await asAdmin.mutation(api.organizationOrderProcesses.create, {
      name: "Accepted",
      position: 1,
      isSequence: true,
      published: true,
      processColor: "#262626",
    });

    const procCookingId = await asAdmin.mutation(api.organizationOrderProcesses.create, {
      name: "In progress",
      position: 2,
      isSequence: true,
      published: true,
      processColor: "#EA9C1B",
    });

    const procReadyId = await asAdmin.mutation(api.organizationOrderProcesses.create, {
      name: "Ready to deliver",
      position: 3,
      isSequence: true,
      published: true,
      processColor: "#FC8019",
    });

    return {
      t,
      orgId,
      adminClerkId,
      asAdmin,
      procAcceptedId,
      procCookingId,
      procReadyId,
    };
  }

  // ==========================================
  // 1. TEMPLATE INTERPOLATION ENGINE (PURE TESTS)
  // ==========================================
  describe("Template Interpolation Engine (renderNotificationTemplate)", () => {
    test("Interpolates all 15 confirmed legacy variables", () => {
      const template =
        "Order [order_number] (ID: [id], Token: [token_number]) for [customer_name] at [organization_name]. " +
        "Status: [order_status], Type: [order_type], Total: ₹[order_total], Paid via: [payment_mode] on [order_date] via [order_from]. " +
        "Track: [track_order_url] | Bill: [invoice_url] | Past: [past_order_url] | Feedback: [survey_qr_url]";

      const sampleData: NotificationTemplateData = {
        id: "ord_abc123",
        tokenNumber: "T-42",
        paymentMode: "Credit Card",
        orderDate: "16-Sep-2026 12:30 PM",
        orderType: "DineIn",
        orderStatus: "Ready to deliver",
        orderNumber: "ORD-1088",
        orderTotal: "850.50",
        orderFrom: "QR Order",
        trackOrderUrl: "https://track.pos.com/o/1088",
        invoiceUrl: "https://bill.pos.com/inv/1088",
        pastOrderUrl: "https://store.pos.com/history",
        surveyQrUrl: "https://survey.pos.com/s/1088",
        customerName: "Priya Sharma",
        organizationName: "Tandoori Flames Bistro",
      };

      const result = renderNotificationTemplate(template, sampleData);

      expect(result).toContain("Order ORD-1088 (ID: ord_abc123, Token: T-42) for Priya Sharma at Tandoori Flames Bistro.");
      expect(result).toContain("Status: Ready to deliver, Type: DineIn, Total: ₹850.50, Paid via: Credit Card on 16-Sep-2026 12:30 PM via QR Order.");
      expect(result).toContain("Track: https://track.pos.com/o/1088 | Bill: https://bill.pos.com/inv/1088 | Past: https://store.pos.com/history | Feedback: https://survey.pos.com/s/1088");
    });

    test("Falls back customer name to 'Customer' when empty or undefined", () => {
      const template = "Hello [customer_name], order [order_number] is accepted!";
      
      const res1 = renderNotificationTemplate(template, { orderNumber: "ORD-1" });
      expect(res1).toBe("Hello Customer, order ORD-1 is accepted!");

      const res2 = renderNotificationTemplate(template, { customerName: "   ", orderNumber: "ORD-2" });
      expect(res2).toBe("Hello Customer, order ORD-2 is accepted!");
    });

    test("Substitutes missing URLs with empty strings", () => {
      const template = "Track here: [track_order_url] and invoice: [invoice_url]";
      const result = renderNotificationTemplate(template, {});
      expect(result).toBe("Track here:  and invoice: ");
    });

    test("Preserves unknown placeholders as literal text", () => {
      const template = "Dear [customer_name], your [discount_code] has expired! [unknown_placeholder]";
      const result = renderNotificationTemplate(template, { customerName: "Rahul" });
      expect(result).toBe("Dear Rahul, your [discount_code] has expired! [unknown_placeholder]");
    });

    test("Handles templates with repeated placeholders and plain text", () => {
      const template = "Token [token_number]! Please check token [token_number] at counter.";
      const result = renderNotificationTemplate(template, { tokenNumber: "99" });
      expect(result).toBe("Token 99! Please check token 99 at counter.");
    });

    test("Handles empty or null templates gracefully", () => {
      expect(renderNotificationTemplate("", {})).toBe("");
    });
  });

  // ==========================================
  // 2. CUSTOMER TYPE MATCHING HELPER
  // ==========================================
  describe("Customer Type Filtering Helper (isCustomerTypeMatch)", () => {
    test("Matches 'all' or undefined customerType against any orderType", () => {
      expect(isCustomerTypeMatch("all", "DineIn")).toBe(true);
      expect(isCustomerTypeMatch(undefined, "TakeAway")).toBe(true);
      expect(isCustomerTypeMatch("all", "Delivery")).toBe(true);
    });

    test("Filters specifically for dine_in", () => {
      expect(isCustomerTypeMatch("dine_in", "DineIn")).toBe(true);
      expect(isCustomerTypeMatch("dine_in", "dine_in")).toBe(true);
      expect(isCustomerTypeMatch("dine_in", "TakeAway")).toBe(false);
      expect(isCustomerTypeMatch("dine_in", "Delivery")).toBe(false);
    });

    test("Filters specifically for takeaway", () => {
      expect(isCustomerTypeMatch("takeaway", "TakeAway")).toBe(true);
      expect(isCustomerTypeMatch("takeaway", "take_away")).toBe(true);
      expect(isCustomerTypeMatch("takeaway", "DineIn")).toBe(false);
    });

    test("Filters specifically for delivery and scheduled delivery", () => {
      expect(isCustomerTypeMatch("delivery", "Delivery")).toBe(true);
      expect(isCustomerTypeMatch("delivery", "ScheduledDelivery")).toBe(true);
      expect(isCustomerTypeMatch("delivery", "scheduled_delivery")).toBe(true);
      expect(isCustomerTypeMatch("delivery", "DineIn")).toBe(false);
    });
  });

  // ==========================================
  // 3. SCHEMA & VALIDATION TESTS
  // ==========================================
  describe("Schema Validations & Edge Cases", () => {
    test("Rejects blank or whitespace-only notification text", async () => {
      const { asAdmin, procAcceptedId } = await setupStoreWithAdmin();

      await expect(
        asAdmin.mutation(api.processNotifications.create, {
          organizationOrderProcessId: procAcceptedId,
          notificationType: "At",
          notificationVia: "sms",
          notificationText: "   ",
        })
      ).rejects.toThrow("Notification text can't be blank");

      await expect(
        asAdmin.mutation(api.processNotifications.create, {
          organizationOrderProcessId: procAcceptedId,
          notificationType: "At",
          notificationVia: "sms",
          notificationText: "",
        })
      ).rejects.toThrow("Notification text can't be blank");
    });

    test("Rejects creation on nonexistent or deleted process ID", async () => {
      const { asAdmin, procAcceptedId } = await setupStoreWithAdmin();

      // Soft-delete the process
      await asAdmin.mutation(api.organizationOrderProcesses.remove, { id: procAcceptedId });

      await expect(
        asAdmin.mutation(api.processNotifications.create, {
          organizationOrderProcessId: procAcceptedId,
          notificationType: "At",
          notificationVia: "sms",
          notificationText: "Order accepted!",
        })
      ).rejects.toThrow("Order process not found");
    });
  });

  // ==========================================
  // 4. CRUD OPERATIONS
  // ==========================================
  describe("CRUD Operations", () => {
    test("Can create, get, list, update, and soft-delete process notification", async () => {
      const { asAdmin, procAcceptedId } = await setupStoreWithAdmin();

      // 1. Create
      const notifId = await asAdmin.mutation(api.processNotifications.create, {
        organizationOrderProcessId: procAcceptedId,
        notificationType: "At",
        notificationVia: "sms",
        notificationText: "Hi [customer_name], order [order_number] is accepted!",
        customerType: "all",
        legacyId: "rails-uuid-101",
      });

      expect(notifId).toBeDefined();

      // 2. Get
      const doc = await asAdmin.query(api.processNotifications.get, { id: notifId });
      expect(doc).not.toBeNull();
      expect(doc?.notificationType).toBe("At");
      expect(doc?.notificationVia).toBe("sms");
      expect(doc?.notificationText).toBe("Hi [customer_name], order [order_number] is accepted!");
      expect(doc?.customerType).toBe("all");
      expect(doc?.legacyId).toBe("rails-uuid-101");

      // 3. List by Process
      const processList = await asAdmin.query(api.processNotifications.listByProcess, {
        organizationOrderProcessId: procAcceptedId,
      });
      expect(processList.length).toBe(1);
      expect(processList[0]._id).toBe(notifId);

      // 4. List by Organization
      const orgList = await asAdmin.query(api.processNotifications.listByOrganization, {});
      expect(orgList.length).toBe(1);

      // 5. Update
      await asAdmin.mutation(api.processNotifications.update, {
        id: notifId,
        notificationText: "Updated message for [customer_name]",
        notificationVia: "whatsapp",
        customerType: "takeaway",
      });

      const updatedDoc = await asAdmin.query(api.processNotifications.get, { id: notifId });
      expect(updatedDoc?.notificationText).toBe("Updated message for [customer_name]");
      expect(updatedDoc?.notificationVia).toBe("whatsapp");
      expect(updatedDoc?.customerType).toBe("takeaway");

      // 6. Soft Delete
      const removeResult = await asAdmin.mutation(api.processNotifications.remove, { id: notifId });
      expect(removeResult.success).toBe(true);

      // 7. Verify soft deletion exclusion
      const docAfterDelete = await asAdmin.query(api.processNotifications.get, { id: notifId });
      expect(docAfterDelete).toBeNull();

      const processListAfterDelete = await asAdmin.query(
        api.processNotifications.listByProcess,
        { organizationOrderProcessId: procAcceptedId }
      );
      expect(processListAfterDelete.length).toBe(0);

      const orgListAfterDelete = await asAdmin.query(
        api.processNotifications.listByOrganization,
        {}
      );
      expect(orgListAfterDelete.length).toBe(0);
    });

    test("Allows multiple notifications (e.g. SMS and WhatsApp) on a single process", async () => {
      const { asAdmin, procReadyId } = await setupStoreWithAdmin();

      const smsId = await asAdmin.mutation(api.processNotifications.create, {
        organizationOrderProcessId: procReadyId,
        notificationType: "At",
        notificationVia: "sms",
        notificationText: "SMS: Food is ready for pickup!",
      });

      const whatsappId = await asAdmin.mutation(api.processNotifications.create, {
        organizationOrderProcessId: procReadyId,
        notificationType: "At",
        notificationVia: "whatsapp",
        notificationText: "WhatsApp: Food is ready for pickup!",
      });

      const list = await asAdmin.query(api.processNotifications.listByProcess, {
        organizationOrderProcessId: procReadyId,
      });

      expect(list.length).toBe(2);
      expect(list.map((n) => n._id)).toEqual(expect.arrayContaining([smsId, whatsappId]));
    });
  });

  // ==========================================
  // 5. AUTHORIZATION & ACCESS CONTROL
  // ==========================================
  describe("Authorization & Access Control", () => {
    test("Unauthenticated calls are rejected", async () => {
      const { t, procAcceptedId } = await setupStoreWithAdmin();

      await expect(
        t.mutation(api.processNotifications.create, {
          organizationOrderProcessId: procAcceptedId,
          notificationType: "At",
          notificationVia: "sms",
          notificationText: "Test text",
        })
      ).rejects.toThrow();
    });

    test("Cashier staff can create and read notifications", async () => {
      const { t, orgId, asAdmin, procAcceptedId } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_cashier_1",
        userType: ["cashier"],
      });

      const asCashier = t.withIdentity({ subject: "user_cashier_1" });

      const notifId = await asCashier.mutation(api.processNotifications.create, {
        organizationOrderProcessId: procAcceptedId,
        notificationType: "At",
        notificationVia: "sms",
        notificationText: "Created by cashier",
      });

      const doc = await asCashier.query(api.processNotifications.get, { id: notifId });
      expect(doc?.notificationText).toBe("Created by cashier");
    });

    test("Unauthorized roles (e.g. waiter) cannot mutate process notifications", async () => {
      const { t, orgId, asAdmin, procAcceptedId } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_waiter_1",
        userType: ["waiter"],
      });

      const asWaiter = t.withIdentity({ subject: "user_waiter_1" });

      await expect(
        asWaiter.mutation(api.processNotifications.create, {
          organizationOrderProcessId: procAcceptedId,
          notificationType: "At",
          notificationVia: "sms",
          notificationText: "Illegal attempt",
        })
      ).rejects.toThrow(/Forbidden/);
    });
  });

  // ==========================================
  // 6. NOTIFICATION RESOLVER & ORDER INTEGRATION
  // ==========================================
  describe("Notification Resolution & Order Flow Integration", () => {
    test("Resolves notifications and renders templates on order status advancement", async () => {
      const { t, orgId, asAdmin, procReadyId } = await setupStoreWithAdmin();

      const itemId = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Butter Chicken",
        price: 35000,
      });

      // Configure notification for 'Ready to deliver' process
      await asAdmin.mutation(api.processNotifications.create, {
        organizationOrderProcessId: procReadyId,
        notificationType: "At",
        notificationVia: "sms",
        notificationText: "Dear [customer_name], order [order_number] is ready for pickup!",
        customerType: "all",
      });

      // Create an order
      const orderResult = await asAdmin.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "TakeAway",
        customerName: "Aditi Rao",
        customerPhone: "+919876543210",
        items: [{ itemId, quantity: 1 }],
      });

      const orderDetails = await t.query(api.orders.getOrderDetails, { id: orderResult.orderId });
      expect(orderDetails).not.toBeNull();

      // Update status to 'Ready to deliver'
      const updateRes = await asAdmin.mutation(api.orders.updateOrderStatus, {
        orderId: orderResult.orderId,
        processId: procReadyId,
      });

      expect(updateRes.success).toBe(true);
      expect(updateRes.notifications).toBeDefined();
      expect(updateRes.notifications.length).toBe(1);

      const resolved = updateRes.notifications[0];
      expect(resolved.renderedText).toContain("Dear Aditi Rao, order ");
      expect(resolved.renderedText).toContain("is ready for pickup!");
      expect(resolved.recipientPhone).toBe("+919876543210");
      expect(resolved.notificationVia).toBe("sms");
    });

    test("Customer type filtering resolves only matching notifications", async () => {
      const { t, orgId, asAdmin, procReadyId } = await setupStoreWithAdmin();

      const itemId = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Naan",
        price: 5000,
      });

      // Dine In notification
      await asAdmin.mutation(api.processNotifications.create, {
        organizationOrderProcessId: procReadyId,
        notificationType: "At",
        notificationVia: "sms",
        notificationText: "DineIn: Table order [order_number] is ready!",
        customerType: "dine_in",
      });

      // Takeaway notification
      await asAdmin.mutation(api.processNotifications.create, {
        organizationOrderProcessId: procReadyId,
        notificationType: "At",
        notificationVia: "sms",
        notificationText: "TakeAway: Counter order [order_number] is packed!",
        customerType: "takeaway",
      });

      // Create a TakeAway order
      const orderResult = await asAdmin.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "TakeAway",
        customerName: "Vikram Singh",
        items: [{ itemId, quantity: 2 }],
      });

      const updateRes = await asAdmin.mutation(api.orders.updateOrderStatus, {
        orderId: orderResult.orderId,
        processId: procReadyId,
      });

      expect(updateRes.notifications.length).toBe(1);
      expect(updateRes.notifications[0].renderedText).toContain("TakeAway: Counter order");
    });

    test("Order transition succeeds smoothly even when no notifications are configured", async () => {
      const { t, asAdmin, orgId, procAcceptedId } = await setupStoreWithAdmin();

      const itemId = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Dal Makhani",
        price: 25000,
      });

      const orderResult = await asAdmin.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "DineIn",
        customerName: "No Notif Customer",
        items: [{ itemId, quantity: 1 }],
      });

      const res = await asAdmin.mutation(api.orders.updateOrderStatus, {
        orderId: orderResult.orderId,
        processId: procAcceptedId,
      });

      expect(res.success).toBe(true);
      expect(res.notifications).toEqual([]);
    });
  });

  // ==========================================
  // 7. DEFAULT SEEDING & PREVIEW QUERY
  // ==========================================
  describe("Default Seeding & Preview Query", () => {
    test("seedDefaults populates standard notifications for default processes", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.processNotifications.seedDefaults, {});

      const all = await asAdmin.query(api.processNotifications.listByOrganization, {});
      expect(all.length).toBeGreaterThanOrEqual(3);

      const texts = all.map((n) => n.notificationText);
      expect(texts).toEqual(
        expect.arrayContaining([
          expect.stringContaining("token is [token_number]"),
          expect.stringContaining("Your order is in progress."),
          expect.stringContaining("Your order is ready to pick up."),
        ])
      );
    });

    test("Preview query renders customized sample templates correctly", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const rendered = await asAdmin.query(api.processNotifications.preview, {
        template: "Hello [customer_name], token is [token_number]!",
        sampleData: {
          customerName: "Rohit",
          tokenNumber: "T-77",
        },
      });

      expect(rendered).toBe("Hello Rohit, token is T-77!");
    });
  });
});
