/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Customers (legacy users -> customers) Domain Tests", () => {
  async function setupStoreWithAdmin(adminClerkId = "user_admin_customer_test") {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Spice Garden Bistro",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    // Helper: Create Menu & Item for order tests
    const menuId = await t.mutation(api.menu.createMenu, {
      organizationId: orgId,
      name: "Dining Menu",
    });

    const catId = await t.mutation(api.menu.createCategory, {
      organizationId: orgId,
      menuId,
      name: "Starters",
    });

    const itemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Tandoori Paneer Tikka",
      price: 24000,
      isGst: true,
    });

    await t.mutation(api.menu.addCategoryItem, {
      organizationId: orgId,
      categoryId: catId,
      itemId,
    });

    return { t, orgId, adminClerkId, asAdmin, itemId };
  }

  // ----------------------------------------------------
  // 1. CUSTOMER CREATION & VALIDATION
  // ----------------------------------------------------
  describe("Creation & Input Validation", () => {
    test("Can create a customer with full profile details", async () => {
      const { t } = await setupStoreWithAdmin();

      const customerId = await t.mutation(api.customers.createCustomer, {
        firstName: "Rohan",
        lastName: "Verma",
        phone: "9876543210",
        countryCode: "+91",
        email: "rohan.verma@example.com",
        razorpayCustomerId: "cust_rzp_123456",
      });

      expect(customerId).toBeDefined();

      const customer = await t.query(api.customers.getCustomer, { id: customerId });
      expect(customer).not.toBeNull();
      expect(customer?.firstName).toBe("Rohan");
      expect(customer?.lastName).toBe("Verma");
      expect(customer?.phone).toBe("9876543210");
      expect(customer?.countryCode).toBe("+91");
      expect(customer?.email).toBe("rohan.verma@example.com");
      expect(customer?.razorpayCustomerId).toBe("cust_rzp_123456");
      expect(customer?.createdAt).toBeDefined();
    });

    test("Can create a minimum valid customer with only phone", async () => {
      const { t } = await setupStoreWithAdmin();

      const customerId = await t.mutation(api.customers.createCustomer, {
        phone: "+91 99887 76655",
      });

      const customer = await t.query(api.customers.getCustomer, { id: customerId });
      expect(customer?.phone).toBe("919988776655");
      expect(customer?.firstName).toBeUndefined();
    });

    test("Rejects invalid phone format", async () => {
      const { t } = await setupStoreWithAdmin();

      // Too short
      await expect(
        t.mutation(api.customers.createCustomer, { phone: "123" })
      ).rejects.toThrow("Phone number must be between 7 and 15 digits");

      // Non-digit characters only
      await expect(
        t.mutation(api.customers.createCustomer, { phone: "abcdefg" })
      ).rejects.toThrow("Phone number must contain only digits");
    });

    test("Rejects invalid email format", async () => {
      const { t } = await setupStoreWithAdmin();

      await expect(
        t.mutation(api.customers.createCustomer, {
          phone: "9876543210",
          email: "invalid-email-address",
        })
      ).rejects.toThrow("Invalid email address format");
    });
  });

  // ----------------------------------------------------
  // 2. IDEMPOTENT GET OR CREATE FLOW (POS / ONLINE ORDERS)
  // ----------------------------------------------------
  describe("getOrCreateCustomer Workflow", () => {
    test("Creates customer if not existing, or returns existing without duplicate insertion", async () => {
      const { t } = await setupStoreWithAdmin();

      // First call -> Created
      const res1 = await t.mutation(api.customers.getOrCreateCustomer, {
        phone: "9123456789",
        firstName: "Priya",
        email: "priya@example.com",
      });
      expect(res1.created).toBe(true);
      expect(res1.customerId).toBeDefined();

      // Second call with same phone -> Reuses existing and updates lastName
      const res2 = await t.mutation(api.customers.getOrCreateCustomer, {
        phone: "9123456789",
        lastName: "Sharma",
      });
      expect(res2.created).toBe(false);
      expect(res2.customerId).toBe(res1.customerId);

      const customer = await t.query(api.customers.getCustomer, { id: res1.customerId });
      expect(customer?.firstName).toBe("Priya");
      expect(customer?.lastName).toBe("Sharma");
      expect(customer?.email).toBe("priya@example.com");
    });
  });

  // ----------------------------------------------------
  // 3. PHONE UNIQUENESS & DEDUPLICATION
  // ----------------------------------------------------
  describe("Phone Uniqueness", () => {
    test("Prevent creating duplicate active customers with same phone", async () => {
      const { t } = await setupStoreWithAdmin();

      await t.mutation(api.customers.createCustomer, {
        phone: "9876512345",
        firstName: "Customer A",
      });

      await expect(
        t.mutation(api.customers.createCustomer, {
          phone: "98765 12345", // Normalized to same digits
          firstName: "Customer B",
        })
      ).rejects.toThrow("already exists");
    });

    test("Can create new customer with same phone if previous customer was soft-deleted", async () => {
      const { t } = await setupStoreWithAdmin();

      const customerId1 = await t.mutation(api.customers.createCustomer, {
        phone: "9876500000",
        firstName: "Archived Customer",
      });

      // Soft delete
      await t.mutation(api.customers.deleteCustomer, { id: customerId1 });

      // Create new customer with same phone
      const customerId2 = await t.mutation(api.customers.createCustomer, {
        phone: "9876500000",
        firstName: "Active Customer",
      });

      expect(customerId2).not.toBe(customerId1);
      const active = await t.query(api.customers.getCustomerByPhone, { phone: "9876500000" });
      expect(active?._id).toBe(customerId2);
      expect(active?.firstName).toBe("Active Customer");
    });
  });

  // ----------------------------------------------------
  // 4. LOOKUP & SEARCH
  // ----------------------------------------------------
  describe("Lookup & Search", () => {
    test("Staff can search customers by name prefix, phone, or email", async () => {
      const { t, asAdmin } = await setupStoreWithAdmin();

      await t.mutation(api.customers.createCustomer, {
        firstName: "Aarav",
        lastName: "Kapoor",
        phone: "9811122233",
        email: "aarav.kapoor@example.com",
      });

      await t.mutation(api.customers.createCustomer, {
        firstName: "Ananya",
        lastName: "Pandey",
        phone: "9822233344",
        email: "ananya@example.com",
      });

      // Search by name
      const nameResults = await asAdmin.query(api.customers.searchCustomers, {
        query: "aarav",
      });
      expect(nameResults).toHaveLength(1);
      expect(nameResults[0].firstName).toBe("Aarav");

      // Search by phone digits
      const phoneResults = await asAdmin.query(api.customers.searchCustomers, {
        query: "98222",
      });
      expect(phoneResults).toHaveLength(1);
      expect(phoneResults[0].firstName).toBe("Ananya");

      // Search by email substring
      const emailResults = await asAdmin.query(api.customers.searchCustomers, {
        query: "example.com",
      });
      expect(emailResults).toHaveLength(2);
    });

    test("Customer lookup by phone normalizes input", async () => {
      const { t } = await setupStoreWithAdmin();

      await t.mutation(api.customers.createCustomer, {
        firstName: "Vikram",
        phone: "9870011223",
      });

      const found = await t.query(api.customers.getCustomerByPhone, {
        phone: "+91 98700-11223",
      });
      expect(found).not.toBeNull();
      expect(found?.firstName).toBe("Vikram");
    });
  });

  // ----------------------------------------------------
  // 5. UPDATES & SOFT DELETION
  // ----------------------------------------------------
  describe("Updates & Soft Deletion", () => {
    test("Can update customer profile details", async () => {
      const { t } = await setupStoreWithAdmin();

      const customerId = await t.mutation(api.customers.createCustomer, {
        firstName: "Deepak",
        phone: "9800011122",
      });

      const updateRes = await t.mutation(api.customers.updateCustomer, {
        id: customerId,
        firstName: "Deepak Kumar",
        email: "deepak.kumar@example.com",
      });
      expect(updateRes.success).toBe(true);

      const updated = await t.query(api.customers.getCustomer, { id: customerId });
      expect(updated?.firstName).toBe("Deepak Kumar");
      expect(updated?.email).toBe("deepak.kumar@example.com");
    });

    test("Updating phone checks for collisions with existing customers", async () => {
      const { t } = await setupStoreWithAdmin();

      const cust1 = await t.mutation(api.customers.createCustomer, {
        phone: "9111111111",
        firstName: "Cust 1",
      });

      const cust2 = await t.mutation(api.customers.createCustomer, {
        phone: "9222222222",
        firstName: "Cust 2",
      });

      await expect(
        t.mutation(api.customers.updateCustomer, {
          id: cust2,
          phone: "9111111111", // Conflict with cust1
        })
      ).rejects.toThrow("already in use");
    });

    test("Soft-deleted customer is omitted from lookups and queries", async () => {
      const { t, asAdmin } = await setupStoreWithAdmin();

      const customerId = await t.mutation(api.customers.createCustomer, {
        phone: "9999888877",
        firstName: "Temporary Customer",
      });

      await t.mutation(api.customers.deleteCustomer, { id: customerId });

      const byId = await t.query(api.customers.getCustomer, { id: customerId });
      expect(byId).toBeNull();

      const byPhone = await t.query(api.customers.getCustomerByPhone, { phone: "9999888877" });
      expect(byPhone).toBeNull();

      const searchRes = await asAdmin.query(api.customers.searchCustomers, {
        query: "Temporary",
      });
      expect(searchRes).toHaveLength(0);
    });
  });

  // ----------------------------------------------------
  // 6. LEGACY MIGRATION COMPATIBILITY
  // ----------------------------------------------------
  describe("Legacy Rails Migration Compatibility", () => {
    test("Can ingest legacy users record with legacyId and timestamps", async () => {
      const { t } = await setupStoreWithAdmin();

      const migrationRes = await t.mutation(api.customers.migrateLegacyCustomer, {
        legacyId: "legacy-user-uuid-101",
        firstName: "Legacy",
        lastName: "Customer",
        phone: "9876540001",
        countryCode: "+91",
        email: "legacy@example.com",
        razorpayCustomerId: "cust_legacy_rzp_99",
        createdAt: 1715000000000,
        updatedAt: 1715000000000,
      });

      expect(migrationRes.customerId).toBeDefined();
      expect(migrationRes.alreadyMigrated).toBe(false);

      const customer = await t.query(api.customers.getCustomerByLegacyId, {
        legacyId: "legacy-user-uuid-101",
      });
      expect(customer).not.toBeNull();
      expect(customer?.firstName).toBe("Legacy");
      expect(customer?.createdAt).toBe(1715000000000);

      // Re-running migration with same legacyId is idempotent
      const rerun = await t.mutation(api.customers.migrateLegacyCustomer, {
        legacyId: "legacy-user-uuid-101",
        phone: "9876540001",
        createdAt: 1715000000000,
        updatedAt: 1715000000000,
      });
      expect(rerun.alreadyMigrated).toBe(true);
      expect(rerun.customerId).toBe(migrationRes.customerId);
    });
  });

  // ----------------------------------------------------
  // 7. ORDER RELATIONSHIP & CUSTOMER ORDER HISTORY
  // ----------------------------------------------------
  describe("Order Relationship", () => {
    test("Can link orders to customer and query customer order history", async () => {
      const { t, orgId, asAdmin, itemId } = await setupStoreWithAdmin();

      const customerId = await t.mutation(api.customers.createCustomer, {
        firstName: "Meera",
        lastName: "Nair",
        phone: "9833344455",
        email: "meera@example.com",
      });

      // Place 2 orders linked to this customer
      const order1 = await asAdmin.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "TakeAway",
        customerId,
        customerName: "Meera Nair",
        customerPhone: "9833344455",
        items: [{ itemId, quantity: 1 }],
      });

      const order2 = await asAdmin.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "Delivery",
        customerId,
        customerName: "Meera Nair",
        customerPhone: "9833344455",
        items: [{ itemId, quantity: 2 }],
      });

      const customerOrders = await asAdmin.query(api.customers.getCustomerOrders, {
        customerId,
      });

      expect(customerOrders).toHaveLength(2);
      expect(customerOrders.map((o) => o._id)).toContain(order1.orderId);
      expect(customerOrders.map((o) => o._id)).toContain(order2.orderId);
    });
  });

  // ----------------------------------------------------
  // 8. AUTHORIZATION & ACCESS CONTROL
  // ----------------------------------------------------
  describe("Authorization & Security", () => {
    test("Staff can query customer search and history, unauthenticated is rejected", async () => {
      const { t, asAdmin } = await setupStoreWithAdmin();

      const customerId = await t.mutation(api.customers.createCustomer, {
        phone: "9844455566",
        firstName: "Security Test",
      });

      // Staff query succeeds
      const searchRes = await asAdmin.query(api.customers.searchCustomers, { query: "Security" });
      expect(searchRes).toHaveLength(1);

      // Unauthenticated query fails
      await expect(
        t.query(api.customers.searchCustomers, { query: "Security" })
      ).rejects.toThrow("Unauthenticated");

      // Non-staff query fails
      const outsider = t.withIdentity({ subject: "user_random_stranger" });
      await expect(
        outsider.query(api.customers.searchCustomers, { query: "Security" })
      ).rejects.toThrow("Forbidden");
    });
  });
});
