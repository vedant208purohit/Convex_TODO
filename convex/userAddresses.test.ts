/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("User Addresses (legacy user_addresses -> userAddresses) Domain Tests", () => {
  async function setupStoreWithAdmin(adminClerkId = "user_admin_address_test") {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Bistro Delights",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    // Helper: Create Menu & Item for order tests
    const menuId = await t.mutation(api.menu.createMenu, {
      organizationId: orgId,
      name: "Delivery Menu",
    });

    const catId = await t.mutation(api.menu.createCategory, {
      organizationId: orgId,
      menuId,
      name: "Main Course",
    });

    const itemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Dal Makhani",
      price: 22000,
      isGst: true,
    });

    await t.mutation(api.menu.addCategoryItem, {
      organizationId: orgId,
      categoryId: catId,
      itemId,
    });

    // Helper: Create a Customer
    const customerId = await t.mutation(api.customers.createCustomer, {
      firstName: "Sameer",
      lastName: "Kulkarni",
      phone: "9876543210",
      email: "sameer@example.com",
    });

    return { t, orgId, adminClerkId, asAdmin, itemId, customerId };
  }

  // ----------------------------------------------------
  // 1. CREATION & VALIDATION
  // ----------------------------------------------------
  describe("Creation & Input Validation", () => {
    test("Can create a customer address with full details and coordinates", async () => {
      const { t, customerId } = await setupStoreWithAdmin();

      const addressId = await t.mutation(api.userAddresses.createUserAddress, {
        customerId,
        addressLine1: "Flat 501, Oakwood Residency",
        addressLine2: "14th Main Road, Sector 3",
        landmark: "Near BDA Complex",
        city: "Bengaluru",
        zipCode: "560102",
        otherLocationDetail: "Gate 2 Entrance",
        addressType: "Home",
        latitude: 12.9279,
        longitude: 77.6271,
        deliveryInstructions: "Ring doorbell twice and leave at doorstep",
      });

      expect(addressId).toBeDefined();

      const address = await t.query(api.userAddresses.getUserAddress, { id: addressId });
      expect(address).not.toBeNull();
      expect(address?.customerId).toBe(customerId);
      expect(address?.addressLine1).toBe("Flat 501, Oakwood Residency");
      expect(address?.addressLine2).toBe("14th Main Road, Sector 3");
      expect(address?.landmark).toBe("Near BDA Complex");
      expect(address?.city).toBe("Bengaluru");
      expect(address?.zipCode).toBe("560102");
      expect(address?.addressType).toBe("Home");
      expect(address?.latitude).toBe(12.9279);
      expect(address?.longitude).toBe(77.6271);
      expect(address?.completeAddress).toBe(
        "Flat 501, Oakwood Residency, 14th Main Road, Sector 3, Near Near BDA Complex, Bengaluru, 560102"
      );
      expect(address?.deliveryInstructions).toBe("Ring doorbell twice and leave at doorstep");
      expect(address?.isDefault).toBe(true); // First address is automatically default
    });

    test("Rejects creation with missing required fields", async () => {
      const { t, customerId } = await setupStoreWithAdmin();

      // Missing addressLine1
      await expect(
        t.mutation(api.userAddresses.createUserAddress, {
          customerId,
          addressLine1: "   ",
          city: "Bengaluru",
          zipCode: "560001",
        })
      ).rejects.toThrow("Address line 1 is required");

      // Missing city
      await expect(
        t.mutation(api.userAddresses.createUserAddress, {
          customerId,
          addressLine1: "MG Road",
          city: "",
          zipCode: "560001",
        })
      ).rejects.toThrow("City is required");

      // Missing zipCode
      await expect(
        t.mutation(api.userAddresses.createUserAddress, {
          customerId,
          addressLine1: "MG Road",
          city: "Bengaluru",
          zipCode: "   ",
        })
      ).rejects.toThrow("Zip code is required");
    });
  });

  // ----------------------------------------------------
  // 2. RETRIEVAL & LISTING
  // ----------------------------------------------------
  describe("Retrieval & Listing", () => {
    test("Lists customer addresses with default address sorted first", async () => {
      const { t, customerId } = await setupStoreWithAdmin();

      // Address 1: Home (Default)
      const addr1 = await t.mutation(api.userAddresses.createUserAddress, {
        customerId,
        addressLine1: "Home Address",
        city: "Bengaluru",
        zipCode: "560001",
        addressType: "Home",
      });

      // Address 2: Work (Non-default)
      const addr2 = await t.mutation(api.userAddresses.createUserAddress, {
        customerId,
        addressLine1: "Office Tech Park",
        city: "Bengaluru",
        zipCode: "560100",
        addressType: "Work",
        isDefault: false,
      });

      // Address 3: Parents (Set as Default -> Replaces addr1 as default)
      const addr3 = await t.mutation(api.userAddresses.createUserAddress, {
        customerId,
        addressLine1: "Parents Villa",
        city: "Bengaluru",
        zipCode: "560034",
        addressType: "Other",
        isDefault: true,
      });

      const addresses = await t.query(api.userAddresses.getCustomerAddresses, {
        customerId,
      });

      expect(addresses).toHaveLength(3);
      // addr3 is default, so it must be first
      expect(addresses[0]._id).toBe(addr3);
      expect(addresses[0].isDefault).toBe(true);
      expect(addresses[1].isDefault).toBe(false);
      expect(addresses[2].isDefault).toBe(false);
    });
  });

  // ----------------------------------------------------
  // 3. UPDATES & DEFAULT ADDRESS MANAGEMENT
  // ----------------------------------------------------
  describe("Updates & Default State Transitions", () => {
    test("Can update address fields and rebuild complete address", async () => {
      const { t, customerId } = await setupStoreWithAdmin();

      const addressId = await t.mutation(api.userAddresses.createUserAddress, {
        customerId,
        addressLine1: "Old Street 1",
        city: "Old City",
        zipCode: "560001",
      });

      await t.mutation(api.userAddresses.updateUserAddress, {
        id: addressId,
        addressLine1: "New Street 24",
        landmark: "City Metro",
        city: "Bengaluru",
      });

      const updated = await t.query(api.userAddresses.getUserAddress, { id: addressId });
      expect(updated?.addressLine1).toBe("New Street 24");
      expect(updated?.landmark).toBe("City Metro");
      expect(updated?.city).toBe("Bengaluru");
      expect(updated?.completeAddress).toBe("New Street 24, Near City Metro, Bengaluru, 560001");
    });

    test("setDefaultUserAddress maintains invariant that only one address is default", async () => {
      const { t, customerId } = await setupStoreWithAdmin();

      const addr1 = await t.mutation(api.userAddresses.createUserAddress, {
        customerId,
        addressLine1: "Address 1",
        city: "Bengaluru",
        zipCode: "560001",
      });

      const addr2 = await t.mutation(api.userAddresses.createUserAddress, {
        customerId,
        addressLine1: "Address 2",
        city: "Bengaluru",
        zipCode: "560002",
      });

      // Initially addr1 is default
      let a1 = await t.query(api.userAddresses.getUserAddress, { id: addr1 });
      let a2 = await t.query(api.userAddresses.getUserAddress, { id: addr2 });
      expect(a1?.isDefault).toBe(true);
      expect(a2?.isDefault).toBe(false);

      // Set addr2 as default
      await t.mutation(api.userAddresses.setDefaultUserAddress, { id: addr2 });

      a1 = await t.query(api.userAddresses.getUserAddress, { id: addr1 });
      a2 = await t.query(api.userAddresses.getUserAddress, { id: addr2 });
      expect(a1?.isDefault).toBe(false);
      expect(a2?.isDefault).toBe(true);
    });
  });

  // ----------------------------------------------------
  // 4. SOFT DELETION
  // ----------------------------------------------------
  describe("Soft Deletion", () => {
    test("Soft deleting an address excludes it from queries and promotes next address if default was deleted", async () => {
      const { t, customerId } = await setupStoreWithAdmin();

      const addr1 = await t.mutation(api.userAddresses.createUserAddress, {
        customerId,
        addressLine1: "Primary Address",
        city: "Bengaluru",
        zipCode: "560001",
      });

      const addr2 = await t.mutation(api.userAddresses.createUserAddress, {
        customerId,
        addressLine1: "Secondary Address",
        city: "Bengaluru",
        zipCode: "560002",
        isDefault: false,
      });

      // Delete the default address
      await t.mutation(api.userAddresses.deleteUserAddress, { id: addr1 });

      const deletedAddr = await t.query(api.userAddresses.getUserAddress, { id: addr1 });
      expect(deletedAddr).toBeNull();

      const activeList = await t.query(api.userAddresses.getCustomerAddresses, { customerId });
      expect(activeList).toHaveLength(1);
      expect(activeList[0]._id).toBe(addr2);
      expect(activeList[0].isDefault).toBe(true); // Promoted to default!
    });
  });

  // ----------------------------------------------------
  // 5. LEGACY MIGRATION COMPATIBILITY
  // ----------------------------------------------------
  describe("Legacy Rails Migration Compatibility", () => {
    test("Can ingest legacy user_addresses record with legacyId and coordinates", async () => {
      const { t, customerId } = await setupStoreWithAdmin();

      const migrationRes = await t.mutation(api.userAddresses.migrateLegacyUserAddress, {
        legacyId: "legacy-addr-uuid-777",
        customerId,
        addressLine1: "Legacy Apartment 3B",
        city: "Mumbai",
        zipCode: "400001",
        addressType: "Home",
        latitude: 18.922,
        longitude: 72.8347,
        completeAddress: "Legacy Apartment 3B, Mumbai, 400001",
        createdAt: 1716000000000,
        updatedAt: 1716000000000,
      });

      expect(migrationRes.addressId).toBeDefined();
      expect(migrationRes.alreadyMigrated).toBe(false);

      const address = await t.query(api.userAddresses.getUserAddressByLegacyId, {
        legacyId: "legacy-addr-uuid-777",
      });
      expect(address).not.toBeNull();
      expect(address?.addressLine1).toBe("Legacy Apartment 3B");
      expect(address?.latitude).toBe(18.922);
      expect(address?.createdAt).toBe(1716000000000);

      // Re-running migration with same legacyId is idempotent
      const duplicateRes = await t.mutation(api.userAddresses.migrateLegacyUserAddress, {
        legacyId: "legacy-addr-uuid-777",
        customerId,
        addressLine1: "Legacy Apartment 3B",
        city: "Mumbai",
        zipCode: "400001",
        createdAt: 1716000000000,
        updatedAt: 1716000000000,
      });
      expect(duplicateRes.alreadyMigrated).toBe(true);
      expect(duplicateRes.addressId).toBe(migrationRes.addressId);
    });
  });

  // ----------------------------------------------------
  // 6. ORDER RELATIONSHIP
  // ----------------------------------------------------
  describe("Order Relationship", () => {
    test("Can create order linked to userAddressId", async () => {
      const { t, orgId, asAdmin, itemId, customerId } = await setupStoreWithAdmin();

      const userAddressId = await t.mutation(api.userAddresses.createUserAddress, {
        customerId,
        addressLine1: "123 Delivery Road",
        city: "Bengaluru",
        zipCode: "560001",
      });

      const order = await asAdmin.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "Delivery",
        customerId,
        userAddressId,
        customerName: "Sameer Kulkarni",
        customerPhone: "9876543210",
        deliveryAddress: {
          addressLine1: "123 Delivery Road",
          city: "Bengaluru",
          zipCode: "560001",
          addressType: "Home",
        },
        items: [{ itemId, quantity: 1 }],
      });

      expect(order.orderId).toBeDefined();

      const orderDoc = await t.query(api.orders.getOrderDetails, { id: order.orderId });
      expect(orderDoc?.userAddressId).toBe(userAddressId);
      expect(orderDoc?.customerId).toBe(customerId);
    });
  });

  // ----------------------------------------------------
  // 7. ISOLATION
  // ----------------------------------------------------
  describe("Customer Address Isolation", () => {
    test("Customer A addresses are strictly isolated from Customer B", async () => {
      const { t, customerId: customerA } = await setupStoreWithAdmin();

      const customerB = await t.mutation(api.customers.createCustomer, {
        firstName: "Anjali",
        phone: "9122334455",
      });

      await t.mutation(api.userAddresses.createUserAddress, {
        customerId: customerA,
        addressLine1: "Customer A Address",
        city: "Bengaluru",
        zipCode: "560001",
      });

      await t.mutation(api.userAddresses.createUserAddress, {
        customerId: customerB,
        addressLine1: "Customer B Address",
        city: "Bengaluru",
        zipCode: "560002",
      });

      const listA = await t.query(api.userAddresses.getCustomerAddresses, { customerId: customerA });
      const listB = await t.query(api.userAddresses.getCustomerAddresses, { customerId: customerB });

      expect(listA).toHaveLength(1);
      expect(listA[0].addressLine1).toBe("Customer A Address");

      expect(listB).toHaveLength(1);
      expect(listB[0].addressLine1).toBe("Customer B Address");
    });
  });
});
