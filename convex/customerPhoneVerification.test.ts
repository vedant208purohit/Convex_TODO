/// <reference types="vite/client" />
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import { clearMockSmsHistory, mockSmsHistory, MockTestSmsProvider } from "./smsProvider";
import { hashOtp } from "./customers";

const modules = import.meta.glob("./**/*.*s");

describe("Customer Mobile OTP Verification, Identity Linking & Order History Parity Tests", () => {
  beforeEach(() => {
    clearMockSmsHistory();
  });

  async function setupStore(t: any) {
    return await t.run(async (ctx: any) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Prest Flagship Bistro",
        slug: "prest-bistro",
        published: true,
        isTest: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isGst: false,
        inclusiveGst: false,
        separateGst: false,
        isFssai: false,
        receiptPrintCount: 1,
        menuBasedPrintToken: false,
        showQrCode: true,
        isDineIn: true,
        isTakeAway: true,
        isOrders: true,
        isCustomer: true,
        onlineStore: true,
        isDelivery: true,
        isMenu: true,
        defaultCurrency: "INR",
        defaultCurrencySymbol: "₹",
        country: "India",
        phoneCode: "+91",
      });

      const otherOrgId = await ctx.db.insert("organizations", {
        name: "Other Store Bistro",
        slug: "other-store",
        published: true,
        isTest: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isGst: false,
        isDineIn: true,
        isOrders: true,
        isCustomer: true,
        onlineStore: true,
        defaultCurrency: "INR",
        defaultCurrencySymbol: "₹",
      });

      const tableId = await ctx.db.insert("organizationTables", {
        organizationId: orgId,
        tableNumber: "T-01",
        seatingCapacity: 4,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const itemId = await ctx.db.insert("items", {
        organizationId: orgId,
        name: "Artisan Truffle Pizza",
        price: 55000,
        published: true,
        isAvailable: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return { orgId, otherOrgId, tableId, itemId };
    });
  }

  // =========================================================================
  // 1. SECURE OTP LIFECYCLE TESTS
  // =========================================================================
  describe("1. Secure OTP Lifecycle Tests", () => {
    it("1.1 Generates secure OTP, sends via SMS provider, and successful verification succeeds", async () => {
      const t = convexTest(schema, modules);
      const { orgId } = await setupStore(t);

      const clerkUser = t.withIdentity({
        subject: "user_clerk_101",
        email: "priya.sharma@example.com",
        name: "Priya Sharma",
      });

      // Step A: Send OTP
      const sendRes = await clerkUser.mutation(api.customers.sendCustomerPhoneOtp, {
        phone: "9876543210",
        countryCode: "+91",
        organizationId: orgId,
      });

      expect(sendRes.success).toBe(true);
      expect(sendRes.cooldownSeconds).toBe(60);
      expect(mockSmsHistory.length).toBe(1);
      expect(mockSmsHistory[0].to).toBe("+919876543210");
      const dispatchedOtp = mockSmsHistory[0].otp;
      expect(dispatchedOtp).toMatch(/^\d{6}$/);

      // Verify OTP is hashed in DB, never plaintext
      await t.run(async (ctx) => {
        const record = await ctx.db.get(sendRes.verificationId);
        expect(record?.otpHash).toBeDefined();
        expect(record?.otpHash).not.toBe(dispatchedOtp);
        expect((record as any).otp).toBeUndefined();
      });

      // Step B: Verify OTP
      const verifyRes = await clerkUser.mutation(api.customers.verifyCustomerPhoneOtp, {
        phone: "9876543210",
        countryCode: "+91",
        otp: dispatchedOtp,
        organizationId: orgId,
      });

      expect(verifyRes.success).toBe(true);
      expect(verifyRes.isPhoneVerified).toBe(true);
      expect(verifyRes.customerId).toBeDefined();

      // Step C: getCurrentCustomer returns verified profile
      const currentCust = await clerkUser.query(api.customers.getCurrentCustomer, {});
      expect(currentCust.isPhoneVerified).toBe(true);
      expect(currentCust.phone).toBe("+919876543210");
      expect(currentCust.email).toBe("priya.sharma@example.com");
    });

    it("1.2 Rejects invalid OTP with decremented attempts feedback", async () => {
      const t = convexTest(schema, modules);
      const { orgId } = await setupStore(t);

      const clerkUser = t.withIdentity({
        subject: "user_clerk_102",
        email: "rohit.test@example.com",
        name: "Rohit Test",
      });

      await clerkUser.mutation(api.customers.sendCustomerPhoneOtp, {
        phone: "9876500001",
        countryCode: "+91",
        organizationId: orgId,
      });

      // Attempt with wrong OTP
      await expect(
        clerkUser.mutation(api.customers.verifyCustomerPhoneOtp, {
          phone: "9876500001",
          countryCode: "+91",
          otp: "000000",
          organizationId: orgId,
        })
      ).rejects.toThrow(/Invalid verification code\. 4 attempts remaining/);
    });

    it("1.3 Rejects expired OTP", async () => {
      const t = convexTest(schema, modules);
      const { orgId } = await setupStore(t);

      const clerkUser = t.withIdentity({
        subject: "user_clerk_103",
        email: "expired.test@example.com",
      });

      const sendRes = await clerkUser.mutation(api.customers.sendCustomerPhoneOtp, {
        phone: "9876500002",
        countryCode: "+91",
        organizationId: orgId,
      });

      // Manually simulate expiration in DB
      await t.run(async (ctx) => {
        await ctx.db.patch(sendRes.verificationId, {
          expiresAt: Date.now() - 1000,
        });
      });

      const otp = mockSmsHistory[0].otp;
      await expect(
        clerkUser.mutation(api.customers.verifyCustomerPhoneOtp, {
          phone: "9876500002",
          countryCode: "+91",
          otp,
          organizationId: orgId,
        })
      ).rejects.toThrow(/Verification code has expired/);
    });

    it("1.4 Rejects reused single-use OTP", async () => {
      const t = convexTest(schema, modules);
      const { orgId } = await setupStore(t);

      const clerkUser = t.withIdentity({
        subject: "user_clerk_104",
        email: "singleuse@example.com",
      });

      await clerkUser.mutation(api.customers.sendCustomerPhoneOtp, {
        phone: "9876500003",
        countryCode: "+91",
        organizationId: orgId,
      });

      const otp = mockSmsHistory[0].otp;
      // First verification succeeds
      const res1 = await clerkUser.mutation(api.customers.verifyCustomerPhoneOtp, {
        phone: "9876500003",
        countryCode: "+91",
        otp,
        organizationId: orgId,
      });
      expect(res1.success).toBe(true);

      // Second verification of same code fails
      await expect(
        clerkUser.mutation(api.customers.verifyCustomerPhoneOtp, {
          phone: "9876500003",
          countryCode: "+91",
          otp,
          organizationId: orgId,
        })
      ).rejects.toThrow(/already been used/);
    });

    it("1.5 Enforces 60-second resend cooldown rate limit", async () => {
      const t = convexTest(schema, modules);
      const { orgId } = await setupStore(t);

      const clerkUser = t.withIdentity({
        subject: "user_clerk_105",
        email: "cooldown@example.com",
      });

      await clerkUser.mutation(api.customers.sendCustomerPhoneOtp, {
        phone: "9876500004",
        countryCode: "+91",
        organizationId: orgId,
      });

      // Immediate resend must be rejected with cooldown countdown
      await expect(
        clerkUser.mutation(api.customers.sendCustomerPhoneOtp, {
          phone: "9876500004",
          countryCode: "+91",
          organizationId: orgId,
        })
      ).rejects.toThrow(/Please wait \d+ seconds before requesting a new code/);
    });
  });

  // =========================================================================
  // 2. CASHIER & QR CUSTOMER RECOGNITION & DUPLICATE PREVENTION
  // =========================================================================
  describe("2. Cashier & QR Identification and Parity Tests", () => {
    it("2.1 Automatically links existing customer created by Cashier in pos-default", async () => {
      const t = convexTest(schema, modules);
      const { orgId } = await setupStore(t);

      // Simulate customer created earlier by Cashier in pos-default with 10-digit phone
      const cashierCustomerId = await t.run(async (ctx) => {
        return await ctx.db.insert("customers", {
          firstName: "Ananya",
          lastName: "Patel",
          phone: "9876511223", // Cashier entered 10 digits
          countryCode: "+91",
          createdAt: Date.now() - 10000,
          updatedAt: Date.now() - 10000,
        });
      });

      // Ananya scans QR, signs in with Clerk email
      const ananyaUser = t.withIdentity({
        subject: "clerk_ananya_sub",
        email: "ananya.patel@gmail.com",
        name: "Ananya Patel",
      });

      // Send OTP to Ananya's phone
      await ananyaUser.mutation(api.customers.sendCustomerPhoneOtp, {
        phone: "9876511223",
        countryCode: "+91",
        organizationId: orgId,
      });

      const otp = mockSmsHistory[0].otp;
      const verifyRes = await ananyaUser.mutation(api.customers.verifyCustomerPhoneOtp, {
        phone: "9876511223",
        countryCode: "+91",
        otp,
        organizationId: orgId,
      });

      // Must reuse existing Cashier customer ID!
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.created).toBe(false);
      expect(verifyRes.customerId).toBe(cashierCustomerId);

      // Verify DB customer record has been linked to Clerk user and phone is verified
      await t.run(async (ctx) => {
        const cust = await ctx.db.get(cashierCustomerId);
        expect(cust?.clerkUserId).toBe("clerk_ananya_sub");
        expect(cust?.isPhoneVerified).toBe(true);
        expect(cust?.email).toBe("ananya.patel@gmail.com");
      });
    });

    it("2.2 Duplicate prevention: Repeated verification does not create duplicate customer records", async () => {
      const t = convexTest(schema, modules);
      const { orgId } = await setupStore(t);

      const clerkUser = t.withIdentity({
        subject: "clerk_user_repeat",
        email: "repeat.test@example.com",
        name: "Repeat User",
      });

      // 1st verification
      await clerkUser.mutation(api.customers.sendCustomerPhoneOtp, {
        phone: "9876522334",
        countryCode: "+91",
        organizationId: orgId,
      });
      const otp1 = mockSmsHistory[0].otp;
      const res1 = await clerkUser.mutation(api.customers.verifyCustomerPhoneOtp, {
        phone: "9876522334",
        countryCode: "+91",
        otp: otp1,
        organizationId: orgId,
      });
      expect(res1.created).toBe(true);
      const createdCustId = res1.customerId;

      // Repeat verification for same phone & user after cooldown
      await t.run(async (ctx) => {
        // clear cooldown
        const verifications = await ctx.db.query("customerPhoneVerifications").collect();
        for (const v of verifications) {
          await ctx.db.delete(v._id);
        }
      });

      await clerkUser.mutation(api.customers.sendCustomerPhoneOtp, {
        phone: "9876522334",
        countryCode: "+91",
        organizationId: orgId,
      });
      const otp2 = mockSmsHistory[1].otp;
      const res2 = await clerkUser.mutation(api.customers.verifyCustomerPhoneOtp, {
        phone: "9876522334",
        countryCode: "+91",
        otp: otp2,
        organizationId: orgId,
      });

      // Must reuse existing customer, NOT duplicate!
      expect(res2.created).toBe(false);
      expect(res2.customerId).toBe(createdCustId);

      // Assert total customers with this phone is strictly 1
      await t.run(async (ctx) => {
        const allCusts = await ctx.db.query("customers").collect();
        const matches = allCusts.filter((c) => c.phone.includes("9876522334"));
        expect(matches.length).toBe(1);
      });
    });

    it("2.3 Returns controlled EMAIL_MISMATCH conflict when phone is registered to a different customer email", async () => {
      const t = convexTest(schema, modules);
      const { orgId } = await setupStore(t);

      // Existing customer belongs to Alice
      await t.run(async (ctx) => {
        await ctx.db.insert("customers", {
          firstName: "Alice",
          phone: "+919876533445",
          email: "alice@example.com",
          clerkUserId: "clerk_alice",
          isPhoneVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Bob logs in with his email, attempts to verify Alice's phone number
      const bobUser = t.withIdentity({
        subject: "clerk_bob",
        email: "bob@example.com",
        name: "Bob",
      });

      await bobUser.mutation(api.customers.sendCustomerPhoneOtp, {
        phone: "9876533445",
        countryCode: "+91",
        organizationId: orgId,
      });

      const otp = mockSmsHistory[0].otp;
      const conflictRes = await bobUser.mutation(api.customers.verifyCustomerPhoneOtp, {
        phone: "9876533445",
        countryCode: "+91",
        otp,
        organizationId: orgId,
      });

      // Must trigger controlled conflict, preserving Alice's data!
      expect(conflictRes.success).toBe(false);
      expect(conflictRes.conflict).toBe("EMAIL_MISMATCH");
      expect(conflictRes.customerId).toBeNull();
    });
  });

  // =========================================================================
  // 3. ORDER HISTORY & SAVED ADDRESSES CROSS-FLOW INTEGRATION
  // =========================================================================
  describe("3. Order History, Checkout Linking & Saved Addresses Tests", () => {
    it("3.1 Orders placed via Cashier in pos-default appear in QR customer history after phone verification", async () => {
      const t = convexTest(schema, modules);
      const { orgId, itemId } = await setupStore(t);

      // Cashier in pos-default punches an order for Vikram
      const cashierCustId = await t.run(async (ctx) => {
        const custId = await ctx.db.insert("customers", {
          firstName: "Vikram",
          phone: "+919876544556",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Insert order punched at counter Cashier
        await ctx.db.insert("orders", {
          organizationId: orgId,
          orderNumber: "ORD-CASHIER-101",
          tokenNumber: "T-55",
          orderType: "TakeAway",
          orderSource: "Prest-Cashier",
          orderStatusName: "Completed",
          isCompleted: true,
          isRejected: false,
          isModify: false,
          customerId: custId,
          customerPhone: "+919876544556",
          subTotal: 55000,
          taxTotal: 0,
          totalAmount: 55000,
          paymentMode: "Cash",
          paymentStatus: "Paid",
          createdAt: Date.now() - 5000,
          updatedAt: Date.now() - 5000,
        });

        return custId;
      });

      // Vikram opens QR ordering and logs in with Clerk
      const vikramUser = t.withIdentity({
        subject: "clerk_vikram",
        email: "vikram@example.com",
        name: "Vikram Malhotra",
      });

      // Verify phone
      await vikramUser.mutation(api.customers.sendCustomerPhoneOtp, {
        phone: "9876544556",
        countryCode: "+91",
        organizationId: orgId,
      });
      const otp = mockSmsHistory[0].otp;
      await vikramUser.mutation(api.customers.verifyCustomerPhoneOtp, {
        phone: "9876544556",
        countryCode: "+91",
        otp,
        organizationId: orgId,
      });

      // Fetch customer orders in QR view
      const customerOrders = await vikramUser.query(api.orders.listCustomerOrders, {
        organizationId: orgId,
      });

      expect(customerOrders.length).toBeGreaterThanOrEqual(1);
      const cashierOrder = customerOrders.find((o) => o.orderNumber === "ORD-CASHIER-101");
      expect(cashierOrder).toBeDefined();
      expect(cashierOrder?.customerId).toBe(cashierCustId);
    });

    it("3.2 QR checkout automatically links customerId and saves delivery address", async () => {
      const t = convexTest(schema, modules);
      const { orgId, itemId } = await setupStore(t);

      const customer = t.withIdentity({
        subject: "clerk_order_user",
        email: "orderuser@example.com",
        name: "Meera Sen",
      });

      // Verify phone
      await customer.mutation(api.customers.sendCustomerPhoneOtp, {
        phone: "9876555667",
        countryCode: "+91",
        organizationId: orgId,
      });
      const otp = mockSmsHistory[0].otp;
      const verifyRes = await customer.mutation(api.customers.verifyCustomerPhoneOtp, {
        phone: "9876555667",
        countryCode: "+91",
        otp,
        organizationId: orgId,
      });
      const customerId = verifyRes.customerId!;

      // Save a delivery address
      const addressId = await customer.mutation(api.userAddresses.createUserAddress, {
        customerId,
        addressLine1: "Flat 402, Lotus Towers",
        addressLine2: "S.G. Highway",
        landmark: "Opposite Grand Mall",
        city: "Ahmedabad",
        zipCode: "380054",
        addressType: "Home",
        isDefault: true,
      });

      // Query saved addresses: must return address with default flag
      const savedAddresses = await customer.query(api.userAddresses.getCustomerAddresses, {
        customerId,
      });
      expect(savedAddresses.length).toBe(1);
      expect(savedAddresses[0].addressLine1).toBe("Flat 402, Lotus Towers");
      expect(savedAddresses[0].isDefault).toBe(true);

      // Place a delivery order through QR
      const orderRes = await customer.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "Delivery",
        orderSource: "PREST-QR",
        customerId,
        userAddressId: addressId,
        items: [{ itemId, quantity: 2 }],
      });

      expect(orderRes.orderId).toBeDefined();

      // Verify order record in DB has authoritative customerId and addressId
      await t.run(async (ctx) => {
        const orderDoc = await ctx.db.get(orderRes.orderId);
        expect(orderDoc?.customerId).toBe(customerId);
        expect(orderDoc?.userAddressId).toBe(addressId);
        expect(orderDoc?.customerPhone).toBe("+919876555667");
      });

      // Order appears in customer's order history
      const history = await customer.query(api.orders.listCustomerOrders, {
        organizationId: orgId,
      });
      expect(history.some((o) => o._id === orderRes.orderId)).toBe(true);
    });

    it("3.3 Multi-tenant Store Isolation: Customer in Store A cannot see orders or addresses from Store B", async () => {
      const t = convexTest(schema, modules);
      const { orgId, otherOrgId, itemId } = await setupStore(t);

      const customer = t.withIdentity({
        subject: "clerk_isolated_user",
        email: "isolated@example.com",
      });

      // Place order in Store A
      await customer.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "TakeAway",
        orderSource: "PREST-QR",
        customerPhone: "+919876566778",
        customerEmail: "isolated@example.com",
        items: [{ itemId, quantity: 1 }],
      });

      // Querying Store B orders returns 0 orders
      const storeBOrders = await customer.query(api.orders.listCustomerOrders, {
        organizationId: otherOrgId,
      });
      expect(storeBOrders.length).toBe(0);
    });

    it("3.4 Security: Customer cannot fetch another customer's addresses", async () => {
      const t = convexTest(schema, modules);
      const { orgId } = await setupStore(t);

      // Customer A
      const custAId = await t.run(async (ctx) => {
        return await ctx.db.insert("customers", {
          firstName: "User A",
          phone: "+919876577889",
          clerkUserId: "clerk_user_a",
          isPhoneVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("userAddresses", {
          customerId: custAId,
          addressLine1: "Secret Villa 99",
          city: "Mumbai",
          zipCode: "400001",
          addressType: "Home",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Customer B tries to query Customer A's addresses
      const userB = t.withIdentity({
        subject: "clerk_user_b",
        email: "userb@example.com",
      });

      const addresses = await userB.query(api.userAddresses.getCustomerAddresses, {
        customerId: custAId,
      });

      // Must be empty (access blocked)
      expect(addresses.length).toBe(0);
    });
  });
});
