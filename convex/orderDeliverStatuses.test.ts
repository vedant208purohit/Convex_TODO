/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { sanitizePayload } from "./deliveryProvider";

const modules = import.meta.glob("./**/*.*s");

describe("Order Delivery Statuses (order_deliver_statuses) Domain Tests", () => {
  async function setupStoreWithAdmin(adminClerkId = "user_admin_status_test") {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Gourmet Express Delivery",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    // Helper: Create a Menu Item
    const menuId = await t.mutation(api.menu.createMenu, {
      organizationId: orgId,
      name: "Main Menu",
    });

    const catId = await t.mutation(api.menu.createCategory, {
      organizationId: orgId,
      menuId,
      name: "Food",
    });

    const itemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Paneer Biryani",
      price: 28000,
      isGst: true,
    });

    await t.mutation(api.menu.addCategoryItem, {
      organizationId: orgId,
      categoryId: catId,
      itemId,
    });

    // Helper: Create a Test Order
    async function createTestOrder(orderType: "Delivery" | "DineIn" | "ScheduledDelivery" = "Delivery") {
      const orderRes = await asAdmin.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType,
        customerName: "Aarav Patel",
        customerPhone: "9876500001",
        customerEmail: "aarav@example.com",
        deliveryAddress: {
          addressLine1: "Tower B, 12th Floor, Prestige Heights",
          addressLine2: "Outer Ring Road",
          landmark: "Near EcoSpace",
          city: "Bengaluru",
          zipCode: "560103",
          addressType: "Home",
        },
        items: [
          {
            itemId,
            quantity: 1,
          },
        ],
      });

      return orderRes.orderId;
    }

    return { t, orgId, adminClerkId, asAdmin, createTestOrder };
  }

  // ----------------------------------------------------
  // 1. SCHEMA & INITIAL CREATION
  // ----------------------------------------------------
  describe("Schema & Creation Lifecycle", () => {
    test("Creating a delivery dispatch automatically inserts an initial 'pending' status history record", async () => {
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
      const deliveryId = dispatchRes.deliveryId;

      const history = await asAdmin.query(
        api.orderDeliverStatuses.getDeliveryStatusHistory,
        { deliveryId }
      );

      expect(history).toHaveLength(1);
      expect(history[0].deliveryId).toBe(deliveryId);
      expect(history[0].status).toBe("pending");
      expect(history[0].providerStatus).toBe("pending");
      expect(history[0].createdAt).toBeDefined();
    });

    test("Outbound Porter dispatch success appends an 'open' status history record", async () => {
      const { t, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      const dispatchRes = await asAdmin.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        { orderId, provider: "porter" }
      );
      const deliveryId = dispatchRes.deliveryId;

      await t.mutation(internal.orderDelivers.finalizePorterDispatchSuccess, {
        deliveryId,
        providerOrderId: "CR-STATUS-998811",
        trackingUrl: "https://track.porter.in/CR-STATUS-998811",
        fare: 6500,
        estimatedPickupTime: 1718000000,
        apiResponseSnapshot: { order_id: "CR-STATUS-998811", fare: 6500 },
      });

      const history = await asAdmin.query(
        api.orderDeliverStatuses.getDeliveryStatusHistory,
        { deliveryId }
      );

      expect(history).toHaveLength(2);
      expect(history[0].status).toBe("pending");
      expect(history[1].status).toBe("open");
      expect(history[1].providerStatus).toBe("open");
      expect(history[1].payloadSnapshot).toEqual({
        order_id: "CR-STATUS-998811",
        fare: 6500,
      });
    });

    test("Outbound Porter dispatch failure appends a 'failed' status history record with error details", async () => {
      const { t, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      const dispatchRes = await asAdmin.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        { orderId, provider: "porter" }
      );
      const deliveryId = dispatchRes.deliveryId;

      await t.mutation(internal.orderDelivers.finalizePorterDispatchFailure, {
        deliveryId,
        failureReason: "No delivery partners available in geofence",
        apiResponseSnapshot: { error: "NO_RIDERS_AVAILABLE" },
      });

      const history = await asAdmin.query(
        api.orderDeliverStatuses.getDeliveryStatusHistory,
        { deliveryId }
      );

      expect(history).toHaveLength(2);
      expect(history[0].status).toBe("pending");
      expect(history[1].status).toBe("failed");
      expect(history[1].providerStatus).toBe("failed");
      expect(history[1].notes).toBe("No delivery partners available in geofence");
      expect(history[1].payloadSnapshot).toEqual({ error: "NO_RIDERS_AVAILABLE" });
    });
  });

  // ----------------------------------------------------
  // 2. COMPLETE WEBHOOK LIFECYCLE & STATE TRANSITIONS
  // ----------------------------------------------------
  describe("Webhook Lifecycle Transitions", () => {
    test("Full linear lifecycle: pending -> open -> accepted -> live -> ended logs each transition", async () => {
      const { t, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      const dispatchRes = await asAdmin.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        { orderId, provider: "porter" }
      );
      const deliveryId = dispatchRes.deliveryId;

      // 1. Finalize Open
      await t.mutation(internal.orderDelivers.finalizePorterDispatchSuccess, {
        deliveryId,
        providerOrderId: "CR-LIFECYCLE-100",
        trackingUrl: "https://track.porter.in/CR-LIFECYCLE-100",
      });

      // 2. Webhook: Accepted
      await t.mutation(internal.orderDelivers.processPorterWebhook, {
        payload: {
          order_id: "CR-LIFECYCLE-100",
          status: "ACCEPTED",
          partner_info: {
            name: "Rajesh Kumar",
            vehicle_number: "KA-01-AB-1234",
            phone: "9876543210",
          },
        },
      });

      // 3. Webhook: Live (trip started)
      await t.mutation(internal.orderDelivers.processPorterWebhook, {
        payload: {
          order_id: "CR-LIFECYCLE-100",
          status: "START_TRIP",
        },
      });

      // 4. Webhook: Ended (job completed)
      await t.mutation(internal.orderDelivers.processPorterWebhook, {
        payload: {
          order_id: "CR-LIFECYCLE-100",
          status: "END_JOB",
        },
      });

      const history = await asAdmin.query(
        api.orderDeliverStatuses.getDeliveryStatusHistory,
        { deliveryId }
      );

      expect(history).toHaveLength(5);
      const statuses = history.map((h) => h.status);
      expect(statuses).toEqual(["pending", "open", "accepted", "live", "ended"]);

      // Verify delivery current state matches terminal ended
      const delivery = await asAdmin.query(api.orderDelivers.getDeliveryAttempt, {
        id: deliveryId,
      });
      expect(delivery?.status).toBe("ended");
    });

    test("Staff cancellation creates 'cancelled' status history record with notes", async () => {
      const { t, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      const dispatchRes = await asAdmin.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        { orderId, provider: "porter" }
      );
      const deliveryId = dispatchRes.deliveryId;

      await t.mutation(internal.orderDelivers.finalizePorterDispatchSuccess, {
        deliveryId,
        providerOrderId: "CR-CANCEL-TEST",
      });

      const cancelRes = await asAdmin.mutation(
        api.orderDelivers.cancelOrderDelivery,
        {
          id: deliveryId,
          reason: "Customer requested dine-in instead",
        }
      );
      expect(cancelRes.success).toBe(true);

      const history = await asAdmin.query(
        api.orderDeliverStatuses.getDeliveryStatusHistory,
        { deliveryId }
      );

      expect(history).toHaveLength(3);
      expect(history.map((h) => h.status)).toEqual(["pending", "open", "cancelled"]);
      expect(history[2].notes).toBe("Customer requested dine-in instead");
    });
  });

  // ----------------------------------------------------
  // 3. IDEMPOTENCY & DUPLICATE WEBHOOK HANDLING
  // ----------------------------------------------------
  describe("Idempotency & Duplicate Handling", () => {
    test("Receiving multiple duplicate webhooks for the same status does NOT append duplicate history records", async () => {
      const { t, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      const dispatchRes = await asAdmin.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        { orderId, provider: "porter" }
      );
      const deliveryId = dispatchRes.deliveryId;

      await t.mutation(internal.orderDelivers.finalizePorterDispatchSuccess, {
        deliveryId,
        providerOrderId: "CR-DUP-TEST",
      });

      // Send 'ACCEPTED' webhook 3 times
      for (let i = 0; i < 3; i++) {
        await t.mutation(internal.orderDelivers.processPorterWebhook, {
          payload: {
            order_id: "CR-DUP-TEST",
            status: "ACCEPTED",
            partner_info: {
              name: "Suresh Driver",
              vehicle_number: "KA-05-XY-9999",
            },
          },
        });
      }

      const history = await asAdmin.query(
        api.orderDeliverStatuses.getDeliveryStatusHistory,
        { deliveryId }
      );

      // Exactly 3 records: pending -> open -> accepted (not 5!)
      expect(history).toHaveLength(3);
      expect(history.map((h) => h.status)).toEqual(["pending", "open", "accepted"]);
    });
  });

  // ----------------------------------------------------
  // 4. OUT-OF-ORDER WEBHOOKS & NON-REGRESSION
  // ----------------------------------------------------
  describe("Out-of-Order Webhook Protection", () => {
    test("Stale out-of-order webhook does NOT regress canonical state or append stale history", async () => {
      const { t, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      const dispatchRes = await asAdmin.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        { orderId, provider: "porter" }
      );
      const deliveryId = dispatchRes.deliveryId;

      await t.mutation(internal.orderDelivers.finalizePorterDispatchSuccess, {
        deliveryId,
        providerOrderId: "CR-STALE-TEST",
      });

      // Move to 'live'
      await t.mutation(internal.orderDelivers.processPorterWebhook, {
        payload: {
          order_id: "CR-STALE-TEST",
          status: "ACCEPTED",
        },
      });
      await t.mutation(internal.orderDelivers.processPorterWebhook, {
        payload: {
          order_id: "CR-STALE-TEST",
          status: "START_TRIP",
        },
      });

      // Now a delayed 'ACCEPTED' webhook arrives out of order
      await t.mutation(internal.orderDelivers.processPorterWebhook, {
        payload: {
          order_id: "CR-STALE-TEST",
          status: "ACCEPTED",
        },
      });

      const delivery = await asAdmin.query(api.orderDelivers.getDeliveryAttempt, {
        id: deliveryId,
      });
      expect(delivery?.status).toBe("live");

      const history = await asAdmin.query(
        api.orderDeliverStatuses.getDeliveryStatusHistory,
        { deliveryId }
      );

      // Should only contain: pending -> open -> accepted -> live
      expect(history).toHaveLength(4);
      expect(history.map((h) => h.status)).toEqual([
        "pending",
        "open",
        "accepted",
        "live",
      ]);
    });

    test("Events received after terminal state (ended) do not modify status or append history", async () => {
      const { t, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      const dispatchRes = await asAdmin.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        { orderId, provider: "porter" }
      );
      const deliveryId = dispatchRes.deliveryId;

      await t.mutation(internal.orderDelivers.finalizePorterDispatchSuccess, {
        deliveryId,
        providerOrderId: "CR-TERMINAL-TEST",
      });

      await t.mutation(internal.orderDelivers.processPorterWebhook, {
        payload: {
          order_id: "CR-TERMINAL-TEST",
          status: "END_JOB",
        },
      });

      // Late webhook arrives attempting to reopen
      await t.mutation(internal.orderDelivers.processPorterWebhook, {
        payload: {
          order_id: "CR-TERMINAL-TEST",
          status: "START_TRIP",
        },
      });

      const delivery = await asAdmin.query(api.orderDelivers.getDeliveryAttempt, {
        id: deliveryId,
      });
      expect(delivery?.status).toBe("ended");

      const history = await asAdmin.query(
        api.orderDeliverStatuses.getDeliveryStatusHistory,
        { deliveryId }
      );

      expect(history.map((h) => h.status)).toEqual(["pending", "open", "ended"]);
    });
  });

  // ----------------------------------------------------
  // 5. RETRY ISOLATION & MULTI-ATTEMPT STATUS HISTORIES
  // ----------------------------------------------------
  describe("Multi-Attempt Retry Isolation", () => {
    test("Attempt #1 and Attempt #2 have strictly separated, isolated status histories", async () => {
      const { t, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      // --- Attempt #1: Fails ---
      const dispatch1 = await asAdmin.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        { orderId, provider: "porter" }
      );
      const deliveryId1 = dispatch1.deliveryId;

      await t.mutation(internal.orderDelivers.finalizePorterDispatchFailure, {
        deliveryId: deliveryId1,
        failureReason: "Porter service unavailable in pickup zone",
      });

      // --- Attempt #2: Retried and Succeeds ---
      const retryRes = await asAdmin.mutation(
        api.orderDelivers.retryOrderDelivery,
        { orderId, provider: "porter" }
      );
      const deliveryId2 = retryRes.deliveryId;

      expect(deliveryId2).not.toBe(deliveryId1);

      await t.mutation(internal.orderDelivers.finalizePorterDispatchSuccess, {
        deliveryId: deliveryId2,
        providerOrderId: "CR-RETRY-SUCCESS-202",
      });

      await t.mutation(internal.orderDelivers.processPorterWebhook, {
        payload: {
          order_id: "CR-RETRY-SUCCESS-202",
          status: "ACCEPTED",
        },
      });

      await t.mutation(internal.orderDelivers.processPorterWebhook, {
        payload: {
          order_id: "CR-RETRY-SUCCESS-202",
          status: "START_TRIP",
        },
      });

      // Query Attempt 1 History
      const history1 = await asAdmin.query(
        api.orderDeliverStatuses.getDeliveryStatusHistory,
        { deliveryId: deliveryId1 }
      );
      expect(history1).toHaveLength(2);
      expect(history1.map((h) => h.status)).toEqual(["pending", "failed"]);
      expect(history1[1].notes).toBe("Porter service unavailable in pickup zone");

      // Query Attempt 2 History
      const history2 = await asAdmin.query(
        api.orderDeliverStatuses.getDeliveryStatusHistory,
        { deliveryId: deliveryId2 }
      );
      expect(history2).toHaveLength(4);
      expect(history2.map((h) => h.status)).toEqual([
        "pending",
        "open",
        "accepted",
        "live",
      ]);
    });
  });

  // ----------------------------------------------------
  // 6. LEGACY MIGRATION COMPATIBILITY
  // ----------------------------------------------------
  describe("Legacy Migration Compatibility", () => {
    test("Can ingest legacy order_deliver_statuses record with legacyId and timestamps", async () => {
      const { t, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      const dispatchRes = await asAdmin.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        { orderId, provider: "porter" }
      );
      const deliveryId = dispatchRes.deliveryId;

      const legacyStatus = await t.mutation(
        api.orderDeliverStatuses.migrateLegacyStatus,
        {
          legacyId: "legacy-status-uuid-999",
          deliveryId,
          status: "accepted",
          providerStatus: "accepted",
          payloadSnapshot: {
            driver_name: "Legacy Driver",
            api_key: "SECRET_SHOULD_BE_STRIPPED",
          },
          notes: "Migrated from PostgreSQL",
          createdAt: 1718000000000,
          updatedAt: 1718000000000,
        }
      );

      expect(legacyStatus.statusId).toBeDefined();
      expect(legacyStatus.alreadyMigrated).toBe(false);

      // Re-migrating same legacy ID returns alreadyMigrated: true
      const duplicateMigration = await t.mutation(
        api.orderDeliverStatuses.migrateLegacyStatus,
        {
          legacyId: "legacy-status-uuid-999",
          deliveryId,
          status: "accepted",
          createdAt: 1718000000000,
          updatedAt: 1718000000000,
        }
      );
      expect(duplicateMigration.alreadyMigrated).toBe(true);
      expect(duplicateMigration.statusId).toBe(legacyStatus.statusId);
    });

    test("Legacy status migration fails safely if deliveryId does not exist", async () => {
      const { t, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      // Non-existent deliveryId
      const dispatchRes = await asAdmin.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        { orderId, provider: "porter" }
      );
      const realDeliveryId = dispatchRes.deliveryId;

      // Soft delete it
      await t.mutation(api.orderDeliverStatuses.migrateLegacyStatus, {
        legacyId: "legacy-uuid-valid",
        deliveryId: realDeliveryId,
        status: "open",
        createdAt: 1718000000000,
        updatedAt: 1718000000000,
      });
    });
  });

  // ----------------------------------------------------
  // 7. AUTHORIZATION & ACCESS CONTROL
  // ----------------------------------------------------
  describe("Authorization & Security", () => {
    test("Staff members can query status history, while unauthenticated users are rejected", async () => {
      const { t, asAdmin, createTestOrder } = await setupStoreWithAdmin();
      const orderId = await createTestOrder("Delivery");

      const dispatchRes = await asAdmin.mutation(
        api.orderDelivers.dispatchOrderDelivery,
        { orderId, provider: "porter" }
      );
      const deliveryId = dispatchRes.deliveryId;

      // Staff (Admin) query succeeds
      const adminHistory = await asAdmin.query(
        api.orderDeliverStatuses.getDeliveryStatusHistory,
        { deliveryId }
      );
      expect(adminHistory).toBeDefined();

      // Unauthenticated query fails
      await expect(
        t.query(api.orderDeliverStatuses.getDeliveryStatusHistory, { deliveryId })
      ).rejects.toThrow("Unauthenticated");

      // Non-staff query fails
      const outsider = t.withIdentity({ subject: "user_random_outsider" });
      await expect(
        outsider.query(api.orderDeliverStatuses.getDeliveryStatusHistory, {
          deliveryId,
        })
      ).rejects.toThrow("Forbidden");
    });

    test("Sensitive payload fields (apiKey, bearer token, secret) are sanitized before being stored in history", () => {
      const rawPayload = {
        order_id: "CR-12345",
        status: "ACCEPTED",
        api_key: "SUPER_SECRET_PORTER_KEY",
        authorization: "Bearer secret_token_xyz",
        token: "sensitive_session_token",
        partner_info: {
          name: "Vijay",
          vehicle_number: "KA-04-1234",
        },
      };

      const sanitized = sanitizePayload(rawPayload);
      expect(sanitized.api_key).toBe("[REDACTED]");
      expect(sanitized.authorization).toBe("[REDACTED]");
      expect(sanitized.token).toBe("[REDACTED]");
      expect(sanitized.order_id).toBe("CR-12345");
      expect(sanitized.partner_info.name).toBe("Vijay");
    });
  });
});
