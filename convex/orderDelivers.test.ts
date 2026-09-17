/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import {
  sanitizePayload,
  mapPorterStatusToCanonical,
} from "./deliveryProvider";

const modules = import.meta.glob("./**/*.*s");

describe("Order Delivery / 3PL Logistics Domain Tests", () => {
  async function setupStoreWithAdmin(adminClerkId = "user_admin_delivery_1") {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Delivery Bistro",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    // Helper: Create a Menu Item
    const menuId = await t.mutation(api.menu.createMenu, {
      organizationId: orgId,
      name: "Delivery Menu",
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
      isGst: true,
    });

    await t.mutation(api.menu.addCategoryItem, {
      organizationId: orgId,
      categoryId: catId,
      itemId,
    });

    // Helper: Create an Order
    async function createTestOrder(orderType: "Delivery" | "DineIn" | "ScheduledDelivery" = "Delivery") {
      const orderRes = await asAdmin.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType,
        customerName: "Rahul Sharma",
        customerPhone: "9876543210",
        customerEmail: "rahul@example.com",
        deliveryAddress: {
          addressLine1: "Flat 402, Sunshine Apts",
          addressLine2: "1st Cross Road",
          landmark: "Near City Park",
          city: "Bengaluru",
          zipCode: "560034",
          addressType: "Home",
        },
        items: [
          {
            itemId,
            quantity: 2,
          },
        ],
      });

      return orderRes.orderId;
    }

    return { t, orgId, adminClerkId, asAdmin, createTestOrder };
  }

  // ----------------------------------------------------
  // 1. DISPATCH CREATION & VALIDATION TESTS
  // ----------------------------------------------------
  describe("Dispatch Creation & Concurrency", () => {
    test("Admin can dispatch delivery for an eligible Delivery order (status: pending)", async () => {
      const { asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      const dispatchRes = await asAdmin.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        {
          orderId,
          provider: "porter",
        }
      );

      expect(dispatchRes.success).toBe(true);
      expect(dispatchRes.deliveryId).toBeDefined();

      const delivery = await asAdmin.query(api.orderDelivers.getDeliveryAttempt, {
        id: dispatchRes.deliveryId,
      });

      expect(delivery).toBeDefined();
      expect(delivery?.orderId).toBe(orderId);
      expect(delivery?.status).toBe("pending");
      expect(delivery?.provider).toBe("porter");
    });

    test("Rejects dispatch if order is not Delivery/ScheduledDelivery (e.g. DineIn)", async () => {
      const { asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const dineInOrderId = await createTestOrder("DineIn");

      await expect(
        asAdmin.mutation(api.orderDelivers.dispatchOrderDelivery, {
          orderId: dineInOrderId,
        })
      ).rejects.toThrow("Order is not eligible for delivery dispatch");
    });

    test("Rejects duplicate active dispatch while a previous attempt is pending/open/active", async () => {
      const { asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      // First dispatch attempt
      await asAdmin.mutation(api.orderDelivers.dispatchOrderDelivery, {
        orderId,
      });

      // Second concurrent attempt
      await expect(
        asAdmin.mutation(api.orderDelivers.dispatchOrderDelivery, {
          orderId,
        })
      ).rejects.toThrow("An active delivery dispatch is already in progress");
    });
  });

  // ----------------------------------------------------
  // 2. STATE MACHINE & FINALIZATION TESTS
  // ----------------------------------------------------
  describe("State Machine & Finalization", () => {
    test("Finalizes successful dispatch (pending -> open) and syncs delivery charge to order", async () => {
      const { t, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      const { deliveryId } = await asAdmin.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        { orderId }
      );

      // Internal mutation simulating Porter success callback
      await t.mutation(internal.orderDelivers.finalizePorterDispatchSuccess, {
        deliveryId,
        providerOrderId: "CR_PORTER_1001",
        trackingUrl: "https://porter.in/track/CR_PORTER_1001",
        fare: 6500, // Rs 65.00 in minor units
        partnerInfo: {
          name: "Suresh Kumar",
          phone: "9988776655",
          vehicleNumber: "KA-01-AB-1234",
          vehicleType: "2 Wheeler",
        },
        estimatedPickupTime: Date.now() + 15 * 60 * 1000,
      });

      const updatedDelivery = await asAdmin.query(
        api.orderDelivers.getDeliveryAttempt,
        { id: deliveryId }
      );

      expect(updatedDelivery?.status).toBe("open");
      expect(updatedDelivery?.providerOrderId).toBe("CR_PORTER_1001");
      expect(updatedDelivery?.trackingUrl).toBe("https://porter.in/track/CR_PORTER_1001");
      expect(updatedDelivery?.fare).toBe(6500);
      expect(updatedDelivery?.partnerInfo?.name).toBe("Suresh Kumar");

      // Check that order delivery charge was updated
      const orderDoc = await asAdmin.query(api.orders.getOrderDetails, {
        id: orderId,
      });
      expect(orderDoc?.deliveryCharge).toBe(6500);
    });

    test("Finalizes failed dispatch (pending -> failed) and records failureReason", async () => {
      const { t, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      const { deliveryId } = await asAdmin.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        { orderId }
      );

      await t.mutation(internal.orderDelivers.finalizePorterDispatchFailure, {
        deliveryId,
        failureReason: "No delivery partner available in radius",
      });

      const updatedDelivery = await asAdmin.query(
        api.orderDelivers.getDeliveryAttempt,
        { id: deliveryId }
      );

      expect(updatedDelivery?.status).toBe("failed");
      expect(updatedDelivery?.failureReason).toBe("No delivery partner available in radius");
    });
  });

  // ----------------------------------------------------
  // 3. RETRY & MULTI-ATTEMPT TESTS
  // ----------------------------------------------------
  describe("Multi-Attempt & Retries", () => {
    test("Staff can retry after a failed dispatch, creating a new attempt while retaining old history", async () => {
      const { t, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      // Attempt 1: Fails
      const firstRes = await asAdmin.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        { orderId }
      );
      await t.mutation(internal.orderDelivers.finalizePorterDispatchFailure, {
        deliveryId: firstRes.deliveryId,
        failureReason: "Driver timeout",
      });

      // Attempt 2: Retry
      const retryRes = await asAdmin.mutation(
        api.orderDelivers.retryOrderDelivery,
        { orderId }
      );

      expect(retryRes.deliveryId).not.toBe(firstRes.deliveryId);

      // Verify both records exist in history
      const allDeliveries = await asAdmin.query(
        api.orderDelivers.getOrderDeliveries,
        { orderId }
      );

      expect(allDeliveries).toHaveLength(2);
      expect(allDeliveries[1]._id).toBe(firstRes.deliveryId);
      expect(allDeliveries[1].status).toBe("failed");
      expect(allDeliveries[0]._id).toBe(retryRes.deliveryId);
      expect(allDeliveries[0].status).toBe("pending");
    });

    test("Cannot retry while an active attempt is still in progress", async () => {
      const { asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      await asAdmin.mutation(api.orderDelivers.dispatchOrderDelivery, {
        orderId,
      });

      await expect(
        asAdmin.mutation(api.orderDelivers.retryOrderDelivery, {
          orderId,
        })
      ).rejects.toThrow("Cannot retry while delivery attempt");
    });
  });

  // ----------------------------------------------------
  // 4. CANCELLATION TESTS
  // ----------------------------------------------------
  describe("Cancellation & Charge Reset", () => {
    test("Admin can cancel active delivery and it resets order delivery charge", async () => {
      const { t, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      const { deliveryId } = await asAdmin.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        { orderId }
      );

      // Finalize to open with 5000 fare
      await t.mutation(internal.orderDelivers.finalizePorterDispatchSuccess, {
        deliveryId,
        providerOrderId: "CR_PORTER_2002",
        fare: 5000,
      });

      const cancelRes = await asAdmin.mutation(
        api.orderDelivers.cancelOrderDelivery,
        { id: deliveryId, reason: "Customer requested cancellation" }
      );

      expect(cancelRes.success).toBe(true);

      const delivery = await asAdmin.query(api.orderDelivers.getDeliveryAttempt, {
        id: deliveryId,
      });
      expect(delivery?.status).toBe("cancelled");

      const order = await asAdmin.query(api.orders.getOrderDetails, { id: orderId });
      expect(order?.deliveryCharge).toBe(0);
    });
  });

  // ----------------------------------------------------
  // 5. WEBHOOK & IDEMPOTENCY TESTS
  // ----------------------------------------------------
  describe("Porter Webhook Processing & Idempotency", () => {
    test("Webhook processes 'accepted' -> updates partner info & order timings", async () => {
      const { t, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      const { deliveryId } = await asAdmin.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        { orderId }
      );

      await t.mutation(internal.orderDelivers.finalizePorterDispatchSuccess, {
        deliveryId,
        providerOrderId: "CR_WEBHOOK_1",
      });

      // Simulate webhook: accepted
      const webhookRes = await t.mutation(
        internal.orderDelivers.processPorterWebhook,
        {
          payload: {
            order_id: "CR_WEBHOOK_1",
            status: "accepted",
            partner_info: {
              name: "Vikram Singh",
              vehicle_number: "KA-05-CD-5678",
              vehicle_type: "TWO_WHEELER",
              mobile: { number: "9876543210" },
              location: { lat: 12.935, long: 77.609 },
            },
          },
        }
      );

      expect(webhookRes.acknowledged).toBe(true);
      expect(webhookRes.status).toBe("accepted");

      const delivery = await asAdmin.query(api.orderDelivers.getDeliveryAttempt, {
        id: deliveryId,
      });
      expect(delivery?.status).toBe("accepted");
      expect(delivery?.partnerInfo?.name).toBe("Vikram Singh");
      expect(delivery?.partnerInfo?.vehicleNumber).toBe("KA-05-CD-5678");
      expect(delivery?.orderTimings?.orderAcceptedTime).toBeDefined();
    });

    test("Webhook processes 'live' -> updates trip start time and pickup time", async () => {
      const { t, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      const { deliveryId } = await asAdmin.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        { orderId }
      );

      await t.mutation(internal.orderDelivers.finalizePorterDispatchSuccess, {
        deliveryId,
        providerOrderId: "CR_WEBHOOK_2",
      });

      await t.mutation(internal.orderDelivers.processPorterWebhook, {
        payload: { order_id: "CR_WEBHOOK_2", status: "accepted" },
      });

      await t.mutation(internal.orderDelivers.processPorterWebhook, {
        payload: { order_id: "CR_WEBHOOK_2", status: "live" },
      });

      const delivery = await asAdmin.query(api.orderDelivers.getDeliveryAttempt, {
        id: deliveryId,
      });
      expect(delivery?.status).toBe("live");
      expect(delivery?.orderTimings?.orderStartedTime).toBeDefined();
    });

    test("Webhook processes 'ended' -> marks delivery completed (ended)", async () => {
      const { t, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      const { deliveryId } = await asAdmin.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        { orderId }
      );

      await t.mutation(internal.orderDelivers.finalizePorterDispatchSuccess, {
        deliveryId,
        providerOrderId: "CR_WEBHOOK_3",
      });

      await t.mutation(internal.orderDelivers.processPorterWebhook, {
        payload: { order_id: "CR_WEBHOOK_3", status: "ended" },
      });

      const delivery = await asAdmin.query(api.orderDelivers.getDeliveryAttempt, {
        id: deliveryId,
      });
      expect(delivery?.status).toBe("ended");
      expect(delivery?.orderTimings?.orderEndedTime).toBeDefined();
    });

    test("Terminal state protection: Webhook cannot regress an 'ended' or 'cancelled' delivery", async () => {
      const { t, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      const { deliveryId } = await asAdmin.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        { orderId }
      );

      await t.mutation(internal.orderDelivers.finalizePorterDispatchSuccess, {
        deliveryId,
        providerOrderId: "CR_WEBHOOK_4",
      });

      // End delivery
      await t.mutation(internal.orderDelivers.processPorterWebhook, {
        payload: { order_id: "CR_WEBHOOK_4", status: "ended" },
      });

      // Out of order late webhook saying accepted
      await t.mutation(internal.orderDelivers.processPorterWebhook, {
        payload: { order_id: "CR_WEBHOOK_4", status: "accepted" },
      });

      const delivery = await asAdmin.query(api.orderDelivers.getDeliveryAttempt, {
        id: deliveryId,
      });
      expect(delivery?.status).toBe("ended"); // Protected!
    });

    test("Webhook for unknown providerOrderId returns acknowledged false without crashing", async () => {
      const { t } = await setupStoreWithAdmin();

      const webhookRes = await t.mutation(
        internal.orderDelivers.processPorterWebhook,
        {
          payload: { order_id: "CR_UNKNOWN_9999", status: "live" },
        }
      );

      expect(webhookRes.acknowledged).toBe(true);
      expect(webhookRes.found).toBe(false);
    });
  });

  // ----------------------------------------------------
  // 6. PUBLIC TRACKING & SECURITY TESTS
  // ----------------------------------------------------
  describe("Public Tracking & Security", () => {
    test("getDeliveryTracking returns sanitized details and strictly omits internal snapshots", async () => {
      const { t, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      const { deliveryId } = await asAdmin.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        { orderId }
      );

      await t.mutation(internal.orderDelivers.finalizePorterDispatchSuccess, {
        deliveryId,
        providerOrderId: "CR_PUBLIC_1",
        trackingUrl: "https://porter.in/track/CR_PUBLIC_1",
        fare: 4500,
        partnerInfo: {
          name: "Ramesh Patel",
          phone: "9123456789",
          vehicleNumber: "KA-03-EF-9999",
        },
        apiRequestSnapshot: { secret_token: "supersecret123", raw_address: "Secret" },
        apiResponseSnapshot: { internal_id: "xyz_987" },
      });

      const tracking = await asAdmin.query(
        api.orderDelivers.getDeliveryTracking,
        {
          orderId,
        }
      );

      expect(tracking).toBeDefined();
      expect(tracking?.status).toBe("open");
      expect(tracking?.trackingUrl).toBe("https://porter.in/track/CR_PUBLIC_1");
      expect(tracking?.partnerInfo?.name).toBe("Ramesh Patel");

      // Verify snapshots and internals are strictly undefined/omitted
      expect((tracking as any)?.apiRequestSnapshot).toBeUndefined();
      expect((tracking as any)?.apiResponseSnapshot).toBeUndefined();
      expect((tracking as any)?.failureReason).toBeUndefined();
    });

    test("Customer A cannot view Customer B's delivery tracking without authorization", async () => {
      const { t, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      await asAdmin.mutation(api.orderDelivers.dispatchOrderDelivery, {
        orderId,
      });

      // Customer A is logged in as a non-staff user with different details
      const asCustomerA = t.withIdentity({
        subject: "unrelated_customer_A",
        name: "Different Person",
        email: "different@example.com",
        phoneNumber: "9999999999",
      });

      await expect(
        asCustomerA.query(api.orderDelivers.getDeliveryTracking, {
          orderId,
        })
      ).rejects.toThrow("Forbidden. You are not authorized to view delivery tracking");
    });

    test("Guest caller with valid trackingToken can access delivery tracking", async () => {
      const { t, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      const { deliveryId } = await asAdmin.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        { orderId }
      );

      await t.mutation(internal.orderDelivers.finalizePorterDispatchSuccess, {
        deliveryId,
        providerOrderId: "CR_TOKEN_TEST",
        trackingUrl: "https://porter.in/track/CR_TOKEN_TEST",
      });

      const tracking = await t.query(api.orderDelivers.getDeliveryTracking, {
        orderId,
        trackingToken: "valid_guest_token_123",
      });

      expect(tracking).toBeDefined();
      expect(tracking?.status).toBe("open");
    });
  });

  // ----------------------------------------------------
  // 7. ROLE-BASED AUTHORIZATION TESTS
  // ----------------------------------------------------
  describe("Role-Based Authorization", () => {
    test("Cashier staff can dispatch delivery", async () => {
      const { t, orgId, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_cashier_delivery",
        userType: ["cashier"],
      });

      const asCashier = t.withIdentity({ subject: "user_cashier_delivery" });
      const res = await asCashier.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        {
          orderId,
        }
      );

      expect(res.success).toBe(true);
    });

    test("Non-staff (e.g. Waiter) cannot dispatch delivery", async () => {
      const { t, orgId, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_waiter_delivery",
        userType: ["waiter"],
      });

      const asWaiter = t.withIdentity({ subject: "user_waiter_delivery" });

      await expect(
        asWaiter.mutation(api.orderDelivers.dispatchOrderDelivery, {
          orderId,
        })
      ).rejects.toThrow("Forbidden. Admin or Cashier access required.");
    });

    test("Unauthenticated user cannot dispatch delivery", async () => {
      const { t, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      await expect(
        t.mutation(api.orderDelivers.dispatchOrderDelivery, {
          orderId,
        })
      ).rejects.toThrow("Unauthenticated");
    });
  });

  // ----------------------------------------------------
  // 8. PAYLOAD SANITIZATION & PROVIDER HELPERS
  // ----------------------------------------------------
  describe("Payload Sanitization & Provider Helper Tests", () => {
    test("sanitizePayload redacts sensitive API keys and secrets", () => {
      const dirty = {
        request_id: "req_123",
        "x-api-key": "secret_api_key_value",
        nested: {
          apiKey: "secret_nested_key",
          authorization: "Bearer 12345",
          normalField: "keep_this",
        },
      };

      const clean = sanitizePayload(dirty);
      expect(clean["x-api-key"]).toBe("[REDACTED]");
      expect(clean.nested.apiKey).toBe("[REDACTED]");
      expect(clean.nested.authorization).toBe("[REDACTED]");
      expect(clean.nested.normalField).toBe("keep_this");
      expect(clean.request_id).toBe("req_123");
    });

    test("mapPorterStatusToCanonical correctly maps all legacy status variants", () => {
      expect(mapPorterStatusToCanonical("open")).toBe("open");
      expect(mapPorterStatusToCanonical("created")).toBe("open");
      expect(mapPorterStatusToCanonical("reopen")).toBe("open");
      expect(mapPorterStatusToCanonical("accepted")).toBe("accepted");
      expect(mapPorterStatusToCanonical("driver_assigned")).toBe("accepted");
      expect(mapPorterStatusToCanonical("live")).toBe("live");
      expect(mapPorterStatusToCanonical("started")).toBe("live");
      expect(mapPorterStatusToCanonical("ended")).toBe("ended");
      expect(mapPorterStatusToCanonical("completed")).toBe("ended");
      expect(mapPorterStatusToCanonical("delivered")).toBe("ended");
      expect(mapPorterStatusToCanonical("cancelled")).toBe("cancelled");
      expect(mapPorterStatusToCanonical("failure")).toBe("failed");
    });
  });
});
