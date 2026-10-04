/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import {
  calculateTransferSplit,
  checkTransferEligibility,
} from "./providerPaymentTransfers";

const modules = import.meta.glob("./**/*.*s");

describe("Provider Payment Transfers Domain Unit & Integration Tests", () => {
  // Helper: Setup store with admin user and standard payment configuration
  async function setupStoreWithAdmin(adminClerkId = "user_admin_1") {
    const t = convexTest(schema, modules);

    // Create store organization with initial owner
    const orgId = await t.mutation(api.organizations.create, {
      name: "Spice Symphony Bistro",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    // Configure linked account on organization
    await asAdmin.mutation(api.organizations.update, {
      id: orgId,
      transferPercentage: 0.03, // 3% platform commission
      transferHoldTime: 18000,  // 5 hours
      paymentSplitting: {
        linked_account_id: "acc_test_merchant_12345",
        stakeholder_account_id: "stk_test_67890",
      },
    });

    // Seed menu item for test orders
    const itemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Paneer Tikka",
      price: 25000, // ₹250.00 in minor units (paise)
    });

    return {
      t,
      orgId,
      adminClerkId,
      asAdmin,
      itemId,
    };
  }

  // ==========================================
  // 1. PURE CALCULATION UTILITIES
  // ==========================================
  describe("Transfer Split Calculations (calculateTransferSplit)", () => {
    test("Calculates standard 3% commission on ₹1,000.00 (100,000 paise)", () => {
      const split = calculateTransferSplit(100000, 0.03, 18000, 1700000000000);

      expect(split.grossAmount).toBe(100000);
      expect(split.transferPercentage).toBe(0.03);
      expect(split.charges).toBe(3000);        // ₹30.00 platform fee
      expect(split.transferAmount).toBe(97000); // ₹970.00 merchant payout
      expect(split.onHold).toBe(1);
      expect(split.holdSeconds).toBe(18000);
      expect(split.onHoldUntil).toBe(1700000000 + 18000);
    });

    test("Handles rounding boundaries accurately for odd minor unit amounts", () => {
      // 99999 paise * 0.03 = 2999.97 -> round to 3000
      const split1 = calculateTransferSplit(99999, 0.03);
      expect(split1.charges).toBe(3000);
      expect(split1.transferAmount).toBe(96999);

      // 10001 paise * 0.03 = 300.03 -> round to 300
      const split2 = calculateTransferSplit(10001, 0.03);
      expect(split2.charges).toBe(300);
      expect(split2.transferAmount).toBe(9701);
    });

    test("Sets onHold to 0 when transferHoldTime is 0 or negative", () => {
      const split = calculateTransferSplit(50000, 0.05, 0);
      expect(split.charges).toBe(2500);
      expect(split.transferAmount).toBe(47500);
      expect(split.onHold).toBe(0);
      expect(split.holdSeconds).toBe(0);
      expect(split.onHoldUntil).toBeUndefined();
    });

    test("Handles small amounts and 0 gross amount gracefully", () => {
      const split = calculateTransferSplit(100, 0.03); // ₹1.00
      expect(split.charges).toBe(3);
      expect(split.transferAmount).toBe(97);

      const splitZero = calculateTransferSplit(0, 0.03);
      expect(splitZero.charges).toBe(0);
      expect(splitZero.transferAmount).toBe(0);
    });
  });

  // ==========================================
  // 2. TRANSFER ELIGIBILITY RULES
  // ==========================================
  describe("Transfer Eligibility Evaluation (checkTransferEligibility)", () => {
    test("Qualifies online completed order on platform gateway with linked account", () => {
      const order = { isCompleted: true, orderSource: "Prest-Online", orderType: "Delivery" };
      const org = {
        razorPayKeyId: undefined,
        razorPayApiKey: undefined,
        paymentSplitting: { linked_account_id: "acc_active_123" },
      };
      const payment = { amount: 50000 };

      const res = checkTransferEligibility(order, org, payment);
      expect(res.eligible).toBe(true);
      expect(res.linkedAccountId).toBe("acc_active_123");
    });

    test("Rejects incomplete order", () => {
      const order = { isCompleted: false, orderSource: "Prest-Online" };
      const org = { paymentSplitting: { linked_account_id: "acc_123" } };
      const payment = { amount: 50000 };

      const res = checkTransferEligibility(order, org, payment);
      expect(res.eligible).toBe(false);
      expect(res.reason).toContain("not completed");
    });

    test("Bypasses transfer when store uses direct custom gateway credentials", () => {
      const order = { isCompleted: true, orderSource: "Prest-Online" };
      const org = {
        razorPayKeyId: "rzp_custom_key_123",
        razorPayApiKey: "rzp_custom_secret_456",
        paymentSplitting: { linked_account_id: "acc_123" },
      };
      const payment = { amount: 50000 };

      const res = checkTransferEligibility(order, org, payment);
      expect(res.eligible).toBe(false);
      expect(res.reason).toContain("direct gateway credentials");
    });

    test("Rejects when linked merchant account is missing", () => {
      const order = { isCompleted: true, orderSource: "Prest-Online" };
      const org = {
        razorPayKeyId: undefined,
        razorPayApiKey: undefined,
        paymentSplitting: undefined,
      };
      const payment = { amount: 50000 };

      const res = checkTransferEligibility(order, org, payment);
      expect(res.eligible).toBe(false);
      expect(res.reason).toContain("linked merchant account");
    });
  });

  // ==========================================
  // 3. CRUD & IDEMPOTENCY
  // ==========================================
  describe("CRUD Operations & Idempotency", () => {
    test("Can record, get, update, and soft-delete a provider payment transfer", async () => {
      const { t, orgId, asAdmin, itemId } = await setupStoreWithAdmin();

      // 1. Create and complete an order
      const orderRes = await asAdmin.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "Delivery",
        orderSource: "Prest-Online",
        customerName: "Ananya Patel",
        items: [{ itemId, quantity: 2 }],
      });

      // 2. Record payment
      const paymentRes = await asAdmin.mutation(api.orderPayments.recordOrderPayment, {
        orderId: orderRes.orderId,
        paymentModeName: "Razorpay Online",
        amount: 50000,
        transactionReference: "pay_test_rzp_9988",
      });

      // 3. Record transfer entry
      const recordRes = await asAdmin.mutation(api.providerPaymentTransfers.recordTransfer, {
        orderPaymentId: paymentRes.paymentId,
        transferId: "trf_sample_rzp_1122",
        transferAmount: 48500,
        transferStatus: "created",
        settlementStatus: "pending",
        legacyId: "rails-uuid-trf-99",
      });

      expect(recordRes.alreadyExists).toBe(false);
      expect(recordRes.id).toBeDefined();

      // 4. Query by order payment ID
      const byPayment = await asAdmin.query(api.providerPaymentTransfers.getByOrderPayment, {
        orderPaymentId: paymentRes.paymentId,
      });
      expect(byPayment).not.toBeNull();
      expect(byPayment?.transferId).toBe("trf_sample_rzp_1122");
      expect(byPayment?.transferAmount).toBe(48500);
      expect(byPayment?.transferStatus).toBe("created");
      expect(byPayment?.settlementStatus).toBe("pending");
      expect(byPayment?.legacyId).toBe("rails-uuid-trf-99");

      // 5. Query by external transfer ID
      const byTransferId = await asAdmin.query(api.providerPaymentTransfers.getByTransferId, {
        transferId: "trf_sample_rzp_1122",
      });
      expect(byTransferId?._id).toBe(recordRes.id);

      // 6. Update mutable status
      await asAdmin.mutation(api.providerPaymentTransfers.updateStatus, {
        id: recordRes.id,
        transferStatus: "processed",
        settlementStatus: "settled",
      });

      const updated = await asAdmin.query(api.providerPaymentTransfers.getByTransferId, {
        transferId: "trf_sample_rzp_1122",
      });
      expect(updated?.transferStatus).toBe("processed");
      expect(updated?.settlementStatus).toBe("settled");

      // 7. Soft delete
      const removeRes = await asAdmin.mutation(api.providerPaymentTransfers.remove, {
        id: recordRes.id,
      });
      expect(removeRes.success).toBe(true);

      const afterDelete = await asAdmin.query(api.providerPaymentTransfers.getByOrderPayment, {
        orderPaymentId: paymentRes.paymentId,
      });
      expect(afterDelete).toBeNull();
    });

    test("Enforces idempotency: repeated recordTransfer calls return existing record", async () => {
      const { asAdmin, orgId, itemId } = await setupStoreWithAdmin();

      const orderRes = await asAdmin.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "Delivery",
        orderSource: "Prest-Online",
        items: [{ itemId, quantity: 1 }],
      });

      const paymentRes = await asAdmin.mutation(api.orderPayments.recordOrderPayment, {
        orderId: orderRes.orderId,
        paymentModeName: "Razorpay Online",
        amount: 25000,
      });

      // First call
      const first = await asAdmin.mutation(api.providerPaymentTransfers.recordTransfer, {
        orderPaymentId: paymentRes.paymentId,
        transferId: "trf_idemp_1",
        transferAmount: 24250,
        transferStatus: "created",
      });
      expect(first.alreadyExists).toBe(false);

      // Second duplicate call
      const second = await asAdmin.mutation(api.providerPaymentTransfers.recordTransfer, {
        orderPaymentId: paymentRes.paymentId,
        transferId: "trf_idemp_DUPLICATE",
        transferAmount: 24250,
        transferStatus: "created",
      });
      expect(second.alreadyExists).toBe(true);
      expect(second.id).toBe(first.id);

      // Total count remains 1
      const all = await asAdmin.query(api.providerPaymentTransfers.listByOrganization, {});
      const matches = all.filter((t) => t.orderPaymentId === paymentRes.paymentId);
      expect(matches.length).toBe(1);
    });
  });

  // ==========================================
  // 4. AUTHORIZATION & ACCESS CONTROL
  // ==========================================
  describe("Authorization & Access Control", () => {
    test("Unauthenticated calls are rejected", async () => {
      const { t, asAdmin, orgId, itemId } = await setupStoreWithAdmin();

      const orderRes = await asAdmin.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "Delivery",
        items: [{ itemId, quantity: 1 }],
      });

      const paymentRes = await asAdmin.mutation(api.orderPayments.recordOrderPayment, {
        orderId: orderRes.orderId,
        paymentModeName: "Online",
        amount: 25000,
      });

      await expect(
        t.mutation(api.providerPaymentTransfers.recordTransfer, {
          orderPaymentId: paymentRes.paymentId,
          transferAmount: 24000,
          transferStatus: "created",
        })
      ).rejects.toThrow();
    });

    test("Unauthorized roles cannot mutate transfer records", async () => {
      const { t, orgId, asAdmin, itemId } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_waiter_99",
        userType: ["waiter"],
      });

      const asWaiter = t.withIdentity({ subject: "user_waiter_99" });

      const orderRes = await asAdmin.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "Delivery",
        items: [{ itemId, quantity: 1 }],
      });

      const paymentRes = await asAdmin.mutation(api.orderPayments.recordOrderPayment, {
        orderId: orderRes.orderId,
        paymentModeName: "Online",
        amount: 25000,
      });

      await expect(
        asWaiter.mutation(api.providerPaymentTransfers.recordTransfer, {
          orderPaymentId: paymentRes.paymentId,
          transferAmount: 24000,
          transferStatus: "created",
        })
      ).rejects.toThrow(/Forbidden/);
    });
  });

  // ==========================================
  // 5. ORDER COMPLETION HOOK & ISOLATION
  // ==========================================
  describe("Order Completion Workflow Integration", () => {
    test("Automated transfer ledger is created when eligible online order completes", async () => {
      const { asAdmin, orgId, itemId } = await setupStoreWithAdmin();

      // Create an online delivery order
      const orderRes = await asAdmin.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "Delivery",
        orderSource: "Prest-Online",
        items: [{ itemId, quantity: 4 }], // total 100,000 paise
      });

      // Complete the order with payment
      const completeRes = await asAdmin.mutation(api.orders.completeOrder, {
        orderId: orderRes.orderId,
        transactionReference: "pay_rzp_online_live",
      });

      expect(completeRes.success).toBe(true);

      // Verify provider transfer ledger record was automatically generated
      const allTransfers = await asAdmin.query(
        api.providerPaymentTransfers.listByOrganization,
        {}
      );
      expect(allTransfers.length).toBe(1);

      const transfer = allTransfers[0];
      // ₹1,000.00 - 3% (₹30.00) = ₹970.00 (97,000 paise)
      expect(transfer.transferAmount).toBe(97000);
      expect(transfer.transferStatus).toBe("pending");
      expect(transfer.settlementStatus).toBe("pending");
    });

    test("Order completion succeeds smoothly even when transfer is ineligible", async () => {
      const { asAdmin, orgId, itemId } = await setupStoreWithAdmin();

      // Dine In order (ineligible for platform route transfer)
      const orderRes = await asAdmin.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "DineIn",
        orderSource: "POS-Cashier",
        items: [{ itemId, quantity: 1 }],
      });

      const completeRes = await asAdmin.mutation(api.orders.completeOrder, {
        orderId: orderRes.orderId,
      });

      expect(completeRes.success).toBe(true);
      expect(completeRes.isCompleted).toBe(true);
    });
  });
});
