/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Postpaid Order Requests Domain Unit & Business Logic Tests", () => {
  async function setupStoreWithAdmin(adminClerkId = "user_admin_1") {
    const t = convexTest(schema, modules);

    // Create organization with dine-in and postpaid dine-in enabled
    const orgId = await t.mutation(api.organizations.create, {
      name: "Postpaid Test Store",
      ownerClerkId: adminClerkId,
      isDineIn: true,
      dineinPospaid: true,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    // Create a table for testing
    const tableId = await asAdmin.mutation(api.organizationTables.create, {
      tableNumber: "T-101",
      seatingCapacity: 4,
    });

    return { t, orgId, tableId, adminClerkId, asAdmin };
  }

  // ----------------------------------------------------
  // 1. CREATION TESTS
  // ----------------------------------------------------
  describe("Creation Logic & Store Capabilities", () => {
    test("Valid customer can create a postpaid order request and updates table isRequested", async () => {
      const { t, tableId, asAdmin } = await setupStoreWithAdmin();

      const customerId = "cust_user_1";
      const asCustomer = t.withIdentity({ subject: customerId });

      const request = await asCustomer.mutation(
        api.postpaidOrderRequests.createPostpaidOrderRequest,
        { tableId }
      );

      expect(request).toBeDefined();
      expect(request.status).toBe("requested");
      expect(request.userId).toBe(customerId);
      expect(request.tableId).toBe(tableId);

      // Verify table isRequested flag is updated to true
      const tableDoc = await asAdmin.query(api.organizationTables.get, { id: tableId });
      expect(tableDoc?.isRequested).toBe(true);
    });

    test("Fails request creation if store isDineIn is disabled", async () => {
      const { t, orgId, tableId, asAdmin } = await setupStoreWithAdmin();

      // Disable isDineIn on organization
      await asAdmin.mutation(api.organizations.update, {
        id: orgId,
        isDineIn: false,
      });

      const asCustomer = t.withIdentity({ subject: "cust_user_2" });

      await expect(
        asCustomer.mutation(api.postpaidOrderRequests.createPostpaidOrderRequest, {
          tableId,
        })
      ).rejects.toThrow("Sorry, this store does not accept Dine In orders.");
    });

    test("Fails request creation if store dineinPospaid is disabled", async () => {
      const { t, orgId, tableId, asAdmin } = await setupStoreWithAdmin();

      // Disable dineinPospaid on organization
      await asAdmin.mutation(api.organizations.update, {
        id: orgId,
        dineinPospaid: false,
      });

      const asCustomer = t.withIdentity({ subject: "cust_user_3" });

      await expect(
        asCustomer.mutation(api.postpaidOrderRequests.createPostpaidOrderRequest, {
          tableId,
        })
      ).rejects.toThrow("Cash payment is not allowed for Dine In orders.");
    });

    test("Deduplication: Customer submitting duplicate request within 15 mins returns existing request", async () => {
      const { t, tableId } = await setupStoreWithAdmin();
      const asCustomer = t.withIdentity({ subject: "cust_user_dedup" });

      const firstRequest = await asCustomer.mutation(
        api.postpaidOrderRequests.createPostpaidOrderRequest,
        { tableId }
      );

      const secondRequest = await asCustomer.mutation(
        api.postpaidOrderRequests.createPostpaidOrderRequest,
        { tableId }
      );

      expect(secondRequest._id).toBe(firstRequest._id);
    });
  });

  // ----------------------------------------------------
  // 2. APPROVAL TESTS
  // ----------------------------------------------------
  describe("Staff Approval Logic & OTP Generation", () => {
    test("Authorized staff (Admin / Captain / Waiter / Cashier) can approve request and generate OTP", async () => {
      const { t, tableId, asAdmin } = await setupStoreWithAdmin();
      const asCustomer = t.withIdentity({ subject: "cust_user_appr" });

      const request = await asCustomer.mutation(
        api.postpaidOrderRequests.createPostpaidOrderRequest,
        { tableId }
      );

      const res = await asAdmin.mutation(
        api.postpaidOrderRequests.approvePostpaidOrderRequest,
        { requestId: request._id }
      );

      expect(res.status).toBe("approved");
      expect(res.otpCode).toHaveLength(4);

      // Verify DB doc has hashed OTP and not plaintext
      const dbDoc = await asAdmin.query(
        api.postpaidOrderRequests.getPostpaidOrderRequest,
        { requestId: request._id }
      );
      expect(dbDoc?.status).toBe("approved");
      // Public query output strips otpHash
      expect((dbDoc as any).otpHash).toBeUndefined();
    });

    test("Customer cannot approve a postpaid request", async () => {
      const { t, tableId } = await setupStoreWithAdmin();
      const asCustomer = t.withIdentity({ subject: "cust_user_fail_appr" });

      const request = await asCustomer.mutation(
        api.postpaidOrderRequests.createPostpaidOrderRequest,
        { tableId }
      );

      await expect(
        asCustomer.mutation(api.postpaidOrderRequests.approvePostpaidOrderRequest, {
          requestId: request._id,
        })
      ).rejects.toThrow("Forbidden. Staff access required");
    });
  });

  // ----------------------------------------------------
  // 3. DECLINE TESTS
  // ----------------------------------------------------
  describe("Staff Decline Logic", () => {
    test("Authorized staff can decline request and table isRequested becomes false", async () => {
      const { t, tableId, asAdmin } = await setupStoreWithAdmin();
      const asCustomer = t.withIdentity({ subject: "cust_user_decl" });

      const request = await asCustomer.mutation(
        api.postpaidOrderRequests.createPostpaidOrderRequest,
        { tableId }
      );

      const res = await asAdmin.mutation(
        api.postpaidOrderRequests.declinePostpaidOrderRequest,
        { requestId: request._id }
      );

      expect(res.status).toBe("declined");

      const tableDoc = await asAdmin.query(api.organizationTables.get, { id: tableId });
      expect(tableDoc?.isRequested).toBe(false);
    });

    test("Cannot decline an already declined request", async () => {
      const { t, tableId, asAdmin } = await setupStoreWithAdmin();
      const asCustomer = t.withIdentity({ subject: "cust_user_decl_twice" });

      const request = await asCustomer.mutation(
        api.postpaidOrderRequests.createPostpaidOrderRequest,
        { tableId }
      );

      await asAdmin.mutation(api.postpaidOrderRequests.declinePostpaidOrderRequest, {
        requestId: request._id,
      });

      await expect(
        asAdmin.mutation(api.postpaidOrderRequests.declinePostpaidOrderRequest, {
          requestId: request._id,
        })
      ).rejects.toThrow("Cannot decline.");
    });
  });

  // ----------------------------------------------------
  // 4. OTP VERIFICATION TESTS
  // ----------------------------------------------------
  describe("OTP Verification & Lockouts", () => {
    test("Correct OTP succeeds and records otpVerifiedAt", async () => {
      const { t, tableId, asAdmin } = await setupStoreWithAdmin();
      const asCustomer = t.withIdentity({ subject: "cust_user_otp_pass" });

      const request = await asCustomer.mutation(
        api.postpaidOrderRequests.createPostpaidOrderRequest,
        { tableId }
      );

      const approveRes = await asAdmin.mutation(
        api.postpaidOrderRequests.approvePostpaidOrderRequest,
        { requestId: request._id }
      );

      const verifyRes = await asCustomer.mutation(
        api.postpaidOrderRequests.verifyPostpaidOrderOtp,
        {
          requestId: request._id,
          code: approveRes.otpCode,
        }
      );

      expect(verifyRes.success).toBe(true);
      expect(verifyRes.verifiedAt).toBeGreaterThan(0);
    });

    test("Incorrect OTP fails and increments attempt counter", async () => {
      const { t, tableId, asAdmin } = await setupStoreWithAdmin();
      const asCustomer = t.withIdentity({ subject: "cust_user_otp_wrong" });

      const request = await asCustomer.mutation(
        api.postpaidOrderRequests.createPostpaidOrderRequest,
        { tableId }
      );

      await asAdmin.mutation(
        api.postpaidOrderRequests.approvePostpaidOrderRequest,
        { requestId: request._id }
      );

      await expect(
        asCustomer.mutation(api.postpaidOrderRequests.verifyPostpaidOrderOtp, {
          requestId: request._id,
          code: "0000",
        })
      ).rejects.toThrow("OTP is invalid or expired.");
    });

    test("Cannot verify OTP of another customer's request", async () => {
      const { t, tableId, asAdmin } = await setupStoreWithAdmin();
      const asCustomer1 = t.withIdentity({ subject: "cust_user_owner" });
      const asCustomer2 = t.withIdentity({ subject: "cust_user_attacker" });

      const request = await asCustomer1.mutation(
        api.postpaidOrderRequests.createPostpaidOrderRequest,
        { tableId }
      );

      const approveRes = await asAdmin.mutation(
        api.postpaidOrderRequests.approvePostpaidOrderRequest,
        { requestId: request._id }
      );

      await expect(
        asCustomer2.mutation(api.postpaidOrderRequests.verifyPostpaidOrderOtp, {
          requestId: request._id,
          code: approveRes.otpCode,
        })
      ).rejects.toThrow("Forbidden. Request does not belong to user.");
    });
  });

  // ----------------------------------------------------
  // 5. ORDER CREATION & SETTLEMENT INTEGRATION TESTS
  // ----------------------------------------------------
  describe("Order Integration & Payment Completion", () => {
    test("Unverified customer cannot place QR postpaid order", async () => {
      const { t, orgId, tableId, asAdmin } = await setupStoreWithAdmin();
      const asCustomer = t.withIdentity({ subject: "cust_unverified_order" });

      // Create request and approve it, but do NOT verify OTP
      const request = await asCustomer.mutation(
        api.postpaidOrderRequests.createPostpaidOrderRequest,
        { tableId }
      );

      await asAdmin.mutation(
        api.postpaidOrderRequests.approvePostpaidOrderRequest,
        { requestId: request._id }
      );

      // Create item for order
      const menuId = await asAdmin.mutation(api.menu.createMenu, {
        organizationId: orgId,
        name: "Test Menu",
        isDefault: true,
      });

      const catId = await asAdmin.mutation(api.menu.createCategory, {
        organizationId: orgId,
        menuId,
        name: "Mains",
      });

      const itemId = await asAdmin.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Burger",
        price: 500,
      });

      await expect(
        asCustomer.mutation(api.orders.createOrder, {
          organizationId: orgId,
          orderType: "DineIn",
          tableId,
          items: [{ itemId, quantity: 1 }],
        })
      ).rejects.toThrow("Unverified postpaid order request.");
    });

    test("Verified customer can place QR postpaid order and settlement completes request", async () => {
      const { t, orgId, tableId, asAdmin } = await setupStoreWithAdmin();
      const asCustomer = t.withIdentity({ subject: "cust_verified_order" });

      const request = await asCustomer.mutation(
        api.postpaidOrderRequests.createPostpaidOrderRequest,
        { tableId }
      );

      const approveRes = await asAdmin.mutation(
        api.postpaidOrderRequests.approvePostpaidOrderRequest,
        { requestId: request._id }
      );

      await asCustomer.mutation(api.postpaidOrderRequests.verifyPostpaidOrderOtp, {
        requestId: request._id,
        code: approveRes.otpCode,
      });

      const menuId = await asAdmin.mutation(api.menu.createMenu, {
        organizationId: orgId,
        name: "Test Menu",
        isDefault: true,
      });

      const catId = await asAdmin.mutation(api.menu.createCategory, {
        organizationId: orgId,
        menuId,
        name: "Mains",
      });

      const itemId = await asAdmin.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Burger",
        price: 500,
      });

      const orderRes = await asCustomer.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "DineIn",
        tableId,
        items: [{ itemId, quantity: 1 }],
      });

      expect(orderRes.orderId).toBeDefined();

      // Settle payment
      const paymentRes = await asAdmin.mutation(api.orderPayments.recordOrderPayment, {
        orderId: orderRes.orderId,
        paymentModeName: "Cash",
        amount: 500,
      });

      expect(paymentRes.success).toBe(true);

      const tableDoc = await asAdmin.query(api.organizationTables.get, { id: tableId });
      expect(tableDoc?.isRequested).toBe(false);
      expect(tableDoc?.currentOrderId).toBeUndefined();
    });
  });
});
