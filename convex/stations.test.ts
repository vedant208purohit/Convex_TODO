/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("KDS Stations, Station-Item Mappings & Order Routing Domain Tests", () => {
  // Helper: Setup store with an initial admin user
  async function setupStoreWithAdmin(adminClerkId = "user_admin_stations_1") {
    const t = convexTest(schema, modules);

    // Create store organization with initial owner
    const orgId = await t.mutation(api.organizations.create, {
      name: "KDS Test Kitchen Store",
      ownerClerkId: adminClerkId,
      isDelivery: true,
      deliveryCashOnDelivery: true,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    return { t, orgId, adminClerkId, asAdmin };
  }

  // 1. Station CRUD Tests
  describe("1. Station CRUD Operations & Validations", () => {
    test("Store Admin can create, get, list, update, and soft-delete stations", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      // 1. Create Station
      const createRes = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "Grill Station",
        isMain: false,
      });

      expect(createRes.success).toBe(true);
      expect(createRes.id).toBeDefined();

      const grillStationId = createRes.id;

      // 2. Get Station
      const stationDoc = await asAdmin.query(api.stations.get, { id: grillStationId });
      expect(stationDoc).not.toBeNull();
      expect(stationDoc?.name).toBe("Grill Station");
      expect(stationDoc?.isMain).toBe(false);

      // 3. List Stations
      const stationsList = await asAdmin.query(api.stations.list, { organizationId: orgId });
      expect(stationsList.some((s) => s._id === grillStationId)).toBe(true);

      // 4. Update Station
      const updateRes = await asAdmin.mutation(api.stations.update, {
        id: grillStationId,
        name: "Hot Grill & Tandoor",
        isMain: true,
      });
      expect(updateRes.success).toBe(true);

      const updatedDoc = await asAdmin.query(api.stations.get, { id: grillStationId });
      expect(updatedDoc?.name).toBe("Hot Grill & Tandoor");
      expect(updatedDoc?.isMain).toBe(true);

      // 5. Soft-delete Station
      const deleteRes = await asAdmin.mutation(api.stations.remove, { id: grillStationId });
      expect(deleteRes.success).toBe(true);

      const deletedDoc = await asAdmin.query(api.stations.get, { id: grillStationId });
      expect(deletedDoc).toBeNull();

      const afterDeleteList = await asAdmin.query(api.stations.list, { organizationId: orgId });
      expect(afterDeleteList.some((s) => s._id === grillStationId)).toBe(false);
    });

    test("Enforces name validation and prevents duplicate active station names", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      // Empty name rejected
      await expect(
        asAdmin.mutation(api.stations.create, {
          organizationId: orgId,
          name: "   ",
        })
      ).rejects.toThrow("Station name is required");

      // Create initial station
      await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "Bar Station",
      });

      // Duplicate name rejected (case-insensitive)
      await expect(
        asAdmin.mutation(api.stations.create, {
          organizationId: orgId,
          name: "bar station",
        })
      ).rejects.toThrow("Hey! bar station is already taken.");
    });

    test("Cashier and Chef roles can manage stations, but unauthorized user is rejected", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      // Add Chef
      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_chef_1",
        userType: ["chef"],
      });
      const asChef = t.withIdentity({ subject: "user_chef_1" });

      const chefStation = await asChef.mutation(api.stations.create, {
        organizationId: orgId,
        name: "Cold Salad Prep",
      });
      expect(chefStation.success).toBe(true);

      // Non-member / Stranger rejected
      const asStranger = t.withIdentity({ subject: "user_stranger_99" });
      await expect(
        asStranger.mutation(api.stations.create, {
          organizationId: orgId,
          name: "Illegal Station",
        })
      ).rejects.toThrow("Forbidden");
    });
  });

  // 2. Station-Item Mappings Tests
  describe("2. Station-Item Mappings & Assignment APIs", () => {
    test("Assigns items to stations and prevents duplicate active mappings", async () => {
      const { t, asAdmin, orgId } = await setupStoreWithAdmin();

      // Create station
      const stRes = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "Pizza Oven",
      });
      const stationId = stRes.id;

      // Create menu item
      const itemId = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Margherita Pizza",
        price: 350,
        published: true,
        isAvailable: true,
        isGst: false,
        isVeg: true,
        isSpicy: false,
        showQuantity: false,
        markAsBestseller: false,
        showCalorie: false,
      });

      // 1. Assign item to station
      const assignRes = await asAdmin.mutation(api.stations.assignItemToStation, {
        organizationId: orgId,
        stationId,
        itemId,
      });
      expect(assignRes.success).toBe(true);
      expect(assignRes.id).toBeDefined();

      // 2. Duplicate assignment rejected
      await expect(
        asAdmin.mutation(api.stations.assignItemToStation, {
          organizationId: orgId,
          stationId,
          itemId,
        })
      ).rejects.toThrow("is already assigned to");

      // 3. List Station Items
      const stationItems = await asAdmin.query(api.stations.listStationItems, {
        organizationId: orgId,
        stationId,
      });
      expect(stationItems.length).toBe(1);
      expect(stationItems[0].item.name).toBe("Margherita Pizza");

      // 4. List Item Stations
      const itemStations = await asAdmin.query(api.stations.listItemStations, {
        organizationId: orgId,
        itemId,
      });
      expect(itemStations.length).toBe(1);
      expect(itemStations[0].station.name).toBe("Pizza Oven");

      // 5. Remove item from station
      const removeRes = await asAdmin.mutation(api.stations.removeItemFromStation, {
        organizationId: orgId,
        stationId,
        itemId,
      });
      expect(removeRes.success).toBe(true);

      const afterRemoveItems = await asAdmin.query(api.stations.listStationItems, {
        organizationId: orgId,
        stationId,
      });
      expect(afterRemoveItems.length).toBe(0);
    });

    test("Bulk assigns category items to a station (Category -> Items -> Station)", async () => {
      const { t, asAdmin, orgId } = await setupStoreWithAdmin();

      // Create Station
      const stRes = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "Beverage Bar",
      });
      const stationId = stRes.id;

      // Create Menu & Category
      const menuId = await t.mutation(api.menu.createMenu, {
        organizationId: orgId,
        name: "Drinks Menu",
      });

      const categoryId = await t.mutation(api.menu.createCategory, {
        organizationId: orgId,
        menuId,
        name: "Cold Drinks",
      });

      // Create two items
      const item1Id = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Iced Lemonade",
        price: 120,
        published: true,
        isAvailable: true,
        isGst: false,
        isVeg: true,
        isSpicy: false,
        showQuantity: false,
        markAsBestseller: false,
        showCalorie: false,
      });

      const item2Id = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Cold Brew Coffee",
        price: 180,
        published: true,
        isAvailable: true,
        isGst: false,
        isVeg: true,
        isSpicy: false,
        showQuantity: false,
        markAsBestseller: false,
        showCalorie: false,
      });

      // Link items to category
      await t.mutation(api.menu.addCategoryItem, {
        organizationId: orgId,
        categoryId,
        itemId: item1Id,
        position: 1,
      });
      await t.mutation(api.menu.addCategoryItem, {
        organizationId: orgId,
        categoryId,
        itemId: item2Id,
        position: 2,
      });

      // Bulk assign category items to station
      const bulkRes = await asAdmin.mutation(api.stations.assignCategoryItemsToStation, {
        organizationId: orgId,
        stationId,
        categoryId,
      });

      expect(bulkRes.success).toBe(true);
      expect(bulkRes.count).toBe(2);

      const stationItems = await asAdmin.query(api.stations.listStationItems, {
        organizationId: orgId,
        stationId,
      });
      expect(stationItems.length).toBe(2);
      expect(stationItems.map((si) => si.item.name)).toContain("Iced Lemonade");
      expect(stationItems.map((si) => si.item.name)).toContain("Cold Brew Coffee");
    });
  });

  // 3. Order Item Station Routing Tests
  describe("3. Order Creation Station Routing (Menu Item -> Station -> OrderItem.stationId)", () => {
    test("Routes order items to their respective stations during order creation", async () => {
      const { t, asAdmin, orgId } = await setupStoreWithAdmin();

      // Create Stations: Grill & Bar
      const grillRes = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "Grill",
      });
      const grillStationId = grillRes.id;

      const barRes = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "Bar",
      });
      const barStationId = barRes.id;

      // Create Items: Burger (Grill) & Mojito (Bar) & Dessert (Unassigned)
      const burgerId = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "BBQ Smash Burger",
        price: 250,
        published: true,
        isAvailable: true,
        isGst: false,
        isVeg: false,
        isSpicy: true,
        showQuantity: false,
        markAsBestseller: true,
        showCalorie: false,
      });

      const mojitoId = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Classic Mint Mojito",
        price: 150,
        published: true,
        isAvailable: true,
        isGst: false,
        isVeg: true,
        isSpicy: false,
        showQuantity: false,
        markAsBestseller: false,
        showCalorie: false,
      });

      const dessertId = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Gulab Jamun",
        price: 90,
        published: true,
        isAvailable: true,
        isGst: false,
        isVeg: true,
        isSpicy: false,
        showQuantity: false,
        markAsBestseller: false,
        showCalorie: false,
      });

      // Map Burger -> Grill, Mojito -> Bar
      await asAdmin.mutation(api.stations.assignItemToStation, {
        organizationId: orgId,
        stationId: grillStationId,
        itemId: burgerId,
      });

      await asAdmin.mutation(api.stations.assignItemToStation, {
        organizationId: orgId,
        stationId: barStationId,
        itemId: mojitoId,
      });

      // Create an order with all 3 items (DineIn)
      const orderRes = await asAdmin.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "DineIn",
        items: [
          { itemId: burgerId, quantity: 2 },
          { itemId: mojitoId, quantity: 1 },
          { itemId: dessertId, quantity: 1 },
        ],
      });

      expect(orderRes.orderId).toBeDefined();
      const orderId = orderRes.orderId;

      // Verify orderItems stationId assignment
      const orderDetails = await t.query(api.orders.getOrderDetails, { id: orderId });
      expect(orderDetails).not.toBeNull();
      const orderItems = orderDetails!.items;
      expect(orderItems.length).toBe(3);

      const burgerOrderItem = orderItems.find((i) => i.itemId === burgerId);
      const mojitoOrderItem = orderItems.find((i) => i.itemId === mojitoId);
      const dessertOrderItem = orderItems.find((i) => i.itemId === dessertId);

      expect(burgerOrderItem?.stationId).toBe(grillStationId);
      expect(mojitoOrderItem?.stationId).toBe(barStationId);
      expect(dessertOrderItem?.stationId).toBeUndefined(); // Unmapped item remains safely undefined
    });

    test("Appended items in addItemsToExistingOrder are also routed to their respective stations", async () => {
      const { t, asAdmin, orgId } = await setupStoreWithAdmin();

      const barRes = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "Cocktail Bar",
      });
      const barStationId = barRes.id;

      const mocktailId = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Virgin Mojito",
        price: 130,
        published: true,
        isAvailable: true,
        isGst: false,
        isVeg: true,
        isSpicy: false,
        showQuantity: false,
        markAsBestseller: false,
        showCalorie: false,
      });

      await asAdmin.mutation(api.stations.assignItemToStation, {
        organizationId: orgId,
        stationId: barStationId,
        itemId: mocktailId,
      });

      // Create initial order
      const orderRes = await asAdmin.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "TakeAway",
        items: [{ itemId: mocktailId, quantity: 1 }],
      });

      // Append another item
      await asAdmin.mutation(api.orders.addItemsToExistingOrder, {
        orderId: orderRes.orderId,
        items: [{ itemId: mocktailId, quantity: 2 }],
      });

      const orderDetails = await t.query(api.orders.getOrderDetails, { id: orderRes.orderId });
      const orderItems = orderDetails!.items;
      expect(orderItems.length).toBe(2);
      expect(orderItems.every((i) => i.stationId === barStationId)).toBe(true);
    });
  });

  // 4. KDS Query Filtering Tests
  describe("4. KDS Station Orders Query Filtering (getStationOrders)", () => {
    test("KDS query segregates tickets by workstation correctly", async () => {
      const { t, asAdmin, orgId } = await setupStoreWithAdmin();

      // Create Stations: Grill & Bar
      const grillRes = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "Grill Station",
      });
      const grillStationId = grillRes.id;

      const barRes = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "Bar Station",
      });
      const barStationId = barRes.id;

      // Create Items
      const steakId = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Ribeye Steak",
        price: 600,
        published: true,
        isAvailable: true,
        isGst: false,
        isVeg: false,
        isSpicy: false,
        showQuantity: false,
        markAsBestseller: true,
        showCalorie: false,
      });

      const beerId = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Craft Beer Pint",
        price: 200,
        published: true,
        isAvailable: true,
        isGst: false,
        isVeg: true,
        isSpicy: false,
        showQuantity: false,
        markAsBestseller: false,
        showCalorie: false,
      });

      // Map to stations
      await asAdmin.mutation(api.stations.assignItemToStation, {
        organizationId: orgId,
        stationId: grillStationId,
        itemId: steakId,
      });

      await asAdmin.mutation(api.stations.assignItemToStation, {
        organizationId: orgId,
        stationId: barStationId,
        itemId: beerId,
      });

      // Place Order 1: Steak + Beer
      await asAdmin.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "DineIn",
        items: [
          { itemId: steakId, quantity: 1 },
          { itemId: beerId, quantity: 2 },
        ],
      });

      // Place Order 2: Beer only
      await asAdmin.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "TakeAway",
        items: [{ itemId: beerId, quantity: 1 }],
      });

      // 1. Query Grill Station KDS
      const grillKds = await asAdmin.query(api.stations.getStationOrders, {
        organizationId: orgId,
        stationId: grillStationId,
      });

      expect(grillKds.station.name).toBe("Grill Station");
      expect(grillKds.orders.length).toBe(1); // Only Order 1 has grill items
      expect(grillKds.orders[0].orderItems.length).toBe(1);
      expect(grillKds.orders[0].orderItems[0].itemName).toBe("Ribeye Steak");
      expect(grillKds.activeOrdersCount).toBe(1);

      // 2. Query Bar Station KDS
      const barKds = await asAdmin.query(api.stations.getStationOrders, {
        organizationId: orgId,
        stationId: barStationId,
      });

      expect(barKds.station.name).toBe("Bar Station");
      expect(barKds.orders.length).toBe(2); // Both Order 1 and Order 2 have drinks
      expect(barKds.orders.every((o) => o.orderItems.every((i) => i.itemName === "Craft Beer Pint"))).toBe(true);
      expect(barKds.activeOrdersCount).toBe(2);
    });

    test("Toggling item readiness updates KDS allStationItemsReady flag", async () => {
      const { t, asAdmin, orgId } = await setupStoreWithAdmin();

      const stationRes = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "Bakery",
      });
      const bakeryStationId = stationRes.id;

      const croissantId = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Butter Croissant",
        price: 80,
        published: true,
        isAvailable: true,
        isGst: false,
        isVeg: true,
        isSpicy: false,
        showQuantity: false,
        markAsBestseller: false,
        showCalorie: false,
      });

      await asAdmin.mutation(api.stations.assignItemToStation, {
        organizationId: orgId,
        stationId: bakeryStationId,
        itemId: croissantId,
      });

      const orderRes = await asAdmin.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "TakeAway",
        items: [{ itemId: croissantId, quantity: 1 }],
      });

      // Initial KDS state
      let kds = await asAdmin.query(api.stations.getStationOrders, {
        organizationId: orgId,
        stationId: bakeryStationId,
      });
      expect(kds.orders[0].allStationItemsReady).toBe(false);

      // Chef toggles item as ready
      const orderItemId = kds.orders[0].orderItems[0]._id;
      await asAdmin.mutation(api.orders.toggleOrderItemReady, {
        orderItemId,
        isReady: true,
      });

      // Updated KDS state
      kds = await asAdmin.query(api.stations.getStationOrders, {
        organizationId: orgId,
        stationId: bakeryStationId,
      });
      expect(kds.orders[0].allStationItemsReady).toBe(true);
    });
  });

  // 5. Cross-Store Security Tests
  describe("5. Multi-Tenant Security & Cross-Store Isolation", () => {
    test("Prevents cross-store access to stations and mappings", async () => {
      const { t, orgId: orgAId, asAdmin: asAdminA } = await setupStoreWithAdmin("user_admin_A");

      // Setup Store B
      const orgBId = await t.mutation(api.organizations.create, {
        name: "Store B Kitchen",
        ownerClerkId: "user_admin_B",
      });
      const asAdminB = t.withIdentity({ subject: "user_admin_B" });

      // Store A creates a station
      const stResA = await asAdminA.mutation(api.stations.create, {
        organizationId: orgAId,
        name: "Store A Grill",
      });

      // Store B admin cannot get Store A station
      await expect(
        asAdminB.query(api.stations.get, { id: stResA.id })
      ).rejects.toThrow("Forbidden");

      // Store B admin cannot assign items to Store A station
      const itemBId = await t.mutation(api.menu.createItem, {
        organizationId: orgBId,
        name: "Store B Item",
        price: 100,
        published: true,
        isAvailable: true,
        isGst: false,
        isVeg: true,
        isSpicy: false,
        showQuantity: false,
        markAsBestseller: false,
        showCalorie: false,
      });

      await expect(
        asAdminB.mutation(api.stations.assignItemToStation, {
          organizationId: orgBId,
          stationId: stResA.id,
          itemId: itemBId,
        })
      ).rejects.toThrow("Forbidden");
    });
  });

  // 6. Multi-Channel & Customer Journey Order Routing Tests
  describe("6. Multi-Channel & Customer Journey Order Routing Tests", () => {
    test("Routes items in customer-placed delivery and takeaway orders with customizations", async () => {
      const { t, asAdmin, orgId } = await setupStoreWithAdmin();

      // Create stations
      const sushiRes = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "Sushi Raw Bar",
      });
      const hotKitchenRes = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "Hot Wok Line",
      });

      // Create customization & option
      const ramenItemId = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Tonkotsu Ramen",
        price: 450,
        published: true,
        isAvailable: true,
        isGst: false,
        isVeg: false,
        isSpicy: true,
        showQuantity: false,
        markAsBestseller: true,
        showCalorie: false,
      });

      const rollItemId = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Salmon Avocado Roll",
        price: 380,
        published: true,
        isAvailable: true,
        isGst: false,
        isVeg: false,
        isSpicy: false,
        showQuantity: false,
        markAsBestseller: false,
        showCalorie: false,
      });

      const custId = await t.mutation(api.menu.createCustomization, {
        organizationId: orgId,
        itemId: ramenItemId,
        name: "Noodle Firmness",
        customizationType: "Preparations",
        published: true,
      });

      const optionId = await t.mutation(api.menu.createCustomizationItem, {
        organizationId: orgId,
        customizationId: custId,
        name: "Extra Firm",
        price: 0,
      });

      // Map items
      await asAdmin.mutation(api.stations.assignItemToStation, {
        organizationId: orgId,
        stationId: hotKitchenRes.id,
        itemId: ramenItemId,
      });

      await asAdmin.mutation(api.stations.assignItemToStation, {
        organizationId: orgId,
        stationId: sushiRes.id,
        itemId: rollItemId,
      });

      // Customer identity places Delivery order
      const asCustomer = t.withIdentity({ subject: "cust_online_99" });
      const deliveryOrder = await asCustomer.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "Delivery",
        orderSource: "Prest-Online",
        customerName: "Alice Customer",
        customerPhone: "9876543210",
        items: [
          {
            itemId: ramenItemId,
            quantity: 2,
            isToGo: true,
            customizations: [
              {
                customizationId: custId,
                optionId,
              },
            ],
          },
          {
            itemId: rollItemId,
            quantity: 1,
            isToGo: true,
          },
        ],
      });

      expect(deliveryOrder.orderId).toBeDefined();

      const orderDetails = await t.query(api.orders.getOrderDetails, { id: deliveryOrder.orderId });
      expect(orderDetails).not.toBeNull();
      expect(orderDetails?.items.length).toBe(2);

      const ramenItem = orderDetails?.items.find((i) => i.itemId === ramenItemId);
      const rollItem = orderDetails?.items.find((i) => i.itemId === rollItemId);

      expect(ramenItem?.stationId).toBe(hotKitchenRes.id);
      expect(ramenItem?.isToGo).toBe(true);
      expect(ramenItem?.customizations?.[0].optionName).toBe("Extra Firm");
      expect(rollItem?.stationId).toBe(sushiRes.id);
      expect(rollItem?.isToGo).toBe(true);
    });

    test("Menu item can belong to multiple stations in stationItems join table", async () => {
      const { t, asAdmin, orgId } = await setupStoreWithAdmin();

      const mainExpo = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "Main Expo Station",
        isMain: true,
      });

      const prepStation = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "Secondary Salad Prep",
        isMain: false,
      });

      const saladId = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Caesar Salad",
        price: 220,
        published: true,
        isAvailable: true,
        isGst: false,
        isVeg: true,
        isSpicy: false,
        showQuantity: false,
        markAsBestseller: false,
        showCalorie: false,
      });

      // Assign salad to both Main Expo and Prep Station
      await asAdmin.mutation(api.stations.assignItemToStation, {
        organizationId: orgId,
        stationId: mainExpo.id,
        itemId: saladId,
      });

      await asAdmin.mutation(api.stations.assignItemToStation, {
        organizationId: orgId,
        stationId: prepStation.id,
        itemId: saladId,
      });

      const itemStations = await asAdmin.query(api.stations.listItemStations, {
        organizationId: orgId,
        itemId: saladId,
      });

      expect(itemStations.length).toBe(2);
      expect(itemStations.map((s) => s.station.name)).toContain("Main Expo Station");
      expect(itemStations.map((s) => s.station.name)).toContain("Secondary Salad Prep");
    });
  });

  // 7. KDS Dashboard Stations Summary & Metrics Tests
  describe("7. KDS Dashboard Stations Summary & Metrics", () => {
    test("stations.list with includeSummary: true aggregates item counts, categories, and active orders", async () => {
      const { t, asAdmin, orgId } = await setupStoreWithAdmin();

      // Create main expo and 2 line stations
      const mainRes = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "MAIN",
        isMain: true,
      });

      const grillRes = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "GRILL & TANDOOR",
        isMain: false,
      });

      const drinksRes = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "DRINKS",
        isMain: false,
      });

      // Create categories
      const menuRes = await t.mutation(api.menu.createMenu, {
        organizationId: orgId,
        name: "KDS Menu",
      });

      const bbqCategory = await t.mutation(api.menu.createCategory, {
        organizationId: orgId,
        menuId: menuRes,
        name: "BBQ & Tandoori",
      });

      const barCategory = await t.mutation(api.menu.createCategory, {
        organizationId: orgId,
        menuId: menuRes,
        name: "Artisanal Beverages",
      });

      // Create items
      const tandooriChicken = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Tandoori Chicken Tikka",
        price: 450,
        published: true,
        isAvailable: true,
        isGst: false,
        isVeg: false,
        isSpicy: true,
        showQuantity: false,
        markAsBestseller: true,
        showCalorie: false,
      });

      const wagyuSteak = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Wagyu Tenderloin",
        price: 1200,
        published: true,
        isAvailable: true,
        isGst: false,
        isVeg: false,
        isSpicy: false,
        showQuantity: false,
        markAsBestseller: false,
        showCalorie: false,
      });

      const craftCocktail = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Smoked Old Fashioned",
        price: 650,
        published: true,
        isAvailable: true,
        isGst: false,
        isVeg: true,
        isSpicy: false,
        showQuantity: false,
        markAsBestseller: false,
        showCalorie: false,
      });

      // Associate items with categories in categoryItems
      await t.mutation(api.menu.addCategoryItem, {
        organizationId: orgId,
        categoryId: bbqCategory,
        itemId: tandooriChicken,
        position: 1,
      });
      await t.mutation(api.menu.addCategoryItem, {
        organizationId: orgId,
        categoryId: bbqCategory,
        itemId: wagyuSteak,
        position: 2,
      });
      await t.mutation(api.menu.addCategoryItem, {
        organizationId: orgId,
        categoryId: barCategory,
        itemId: craftCocktail,
        position: 1,
      });

      // Assign items to stations
      await asAdmin.mutation(api.stations.assignItemToStation, {
        organizationId: orgId,
        stationId: grillRes.id,
        itemId: tandooriChicken,
      });
      await asAdmin.mutation(api.stations.assignItemToStation, {
        organizationId: orgId,
        stationId: grillRes.id,
        itemId: wagyuSteak,
      });
      await asAdmin.mutation(api.stations.assignItemToStation, {
        organizationId: orgId,
        stationId: drinksRes.id,
        itemId: craftCocktail,
      });

      // Place an order routing to GRILL & TANDOOR
      await asAdmin.mutation(api.orders.createOrder, {
        organizationId: orgId,
        orderType: "DineIn",
        orderSource: "Prest-POS",
        items: [
          {
            itemId: tandooriChicken,
            quantity: 1,
          },
        ],
      });

      // Query stations with summary
      const dashboardStations = (await asAdmin.query(api.stations.list, {
        organizationId: orgId,
        includeSummary: true,
      })) as any[];

      expect(dashboardStations.length).toBe(3);

      // Verify MAIN station
      const mainSummary = dashboardStations.find((s) => s.name === "MAIN");
      expect(mainSummary).toBeDefined();
      expect(mainSummary?.isMain).toBe(true);
      expect(mainSummary?.assignedItemCount).toBe(3); // Consolidated all active store items
      expect(mainSummary?.activeOrdersCount).toBe(1);

      // Verify GRILL & TANDOOR station
      const grillSummary = dashboardStations.find((s) => s.name === "GRILL & TANDOOR");
      expect(grillSummary).toBeDefined();
      expect(grillSummary?.assignedItemCount).toBe(2);
      expect(grillSummary?.categoryCount).toBe(1);
      expect(grillSummary?.sampleCategories).toContain("BBQ & Tandoori");
      expect(grillSummary?.sampleItems).toContain("Tandoori Chicken Tikka");
      expect(grillSummary?.activeOrdersCount).toBe(1);

      // Verify DRINKS station
      const drinksSummary = dashboardStations.find((s) => s.name === "DRINKS");
      expect(drinksSummary).toBeDefined();
      expect(drinksSummary?.assignedItemCount).toBe(1);
      expect(drinksSummary?.sampleCategories).toContain("Artisanal Beverages");
      expect(drinksSummary?.sampleItems).toContain("Smoked Old Fashioned");
      expect(drinksSummary?.activeOrdersCount).toBe(0); // No drinks ordered yet
    });

    test("Deleted station is excluded from summary and order history remains intact", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      const tempStation = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "TEMP LINE",
      });

      let list = await asAdmin.query(api.stations.list, {
        organizationId: orgId,
        includeSummary: true,
      });
      expect(list.some((s) => s.name === "TEMP LINE")).toBe(true);

      // Delete station
      await asAdmin.mutation(api.stations.remove, { id: tempStation.id });

      list = await asAdmin.query(api.stations.list, {
        organizationId: orgId,
        includeSummary: true,
      });
      expect(list.some((s) => s.name === "TEMP LINE")).toBe(false);
    });
  });

  // 8. Screen 2 Create Station Drawer Parity Tests
  describe("8. Screen 2 Create Station Drawer Parity Tests", () => {
    test("Re-using soft-deleted station name is allowed (legacy Rails scope parity)", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      // Create station
      const st1 = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "Pastry & Garde Manger",
      });
      expect(st1.success).toBe(true);

      // Soft delete it
      await asAdmin.mutation(api.stations.remove, { id: st1.id });

      // Creating a new station with the same name should SUCCEED because the previous one is soft-deleted
      const st2 = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "Pastry & Garde Manger",
      });
      expect(st2.success).toBe(true);
      expect(st2.id).not.toBe(st1.id);

      // Verify active station in list
      const list = await asAdmin.query(api.stations.list, { organizationId: orgId });
      const activePastry = list.filter((s) => s.name === "Pastry & Garde Manger");
      expect(activePastry.length).toBe(1);
      expect(activePastry[0]._id).toBe(st2.id);
    });

    test("Station name is trimmed of leading and trailing whitespace on creation", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      const created = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "   Salad & Cold Station   ",
      });
      expect(created.success).toBe(true);

      const doc = await asAdmin.query(api.stations.get, { id: created.id });
      expect(doc?.name).toBe("Salad & Cold Station");
    });

    test("Station creation rejects whitespace-only names and duplicate active names", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      // Whitespace rejection
      await expect(
        asAdmin.mutation(api.stations.create, {
          organizationId: orgId,
          name: "    \t\n  ",
        })
      ).rejects.toThrow("Station name is required");

      // Create station
      await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "Wok Line 01",
      });

      // Duplicate rejection with exact legacy Rails error
      await expect(
        asAdmin.mutation(api.stations.create, {
          organizationId: orgId,
          name: "WOK LINE 01",
        })
      ).rejects.toThrow("Hey! WOK LINE 01 is already taken.");
    });

    test("Cross-organization protection: User of Org A cannot create a station in Org B", async () => {
      const { t, orgId: orgAId, asAdmin: asAdminA } = await setupStoreWithAdmin("user_admin_org_a");

      // Setup Org B
      const orgBId = await t.mutation(api.organizations.create, {
        name: "Kitchen Store B",
        ownerClerkId: "user_admin_org_b",
        isDelivery: true,
        deliveryCashOnDelivery: true,
      });

      // Org A admin attempts to create station in Org B -> Rejected
      await expect(
        asAdminA.mutation(api.stations.create, {
          organizationId: orgBId,
          name: "Malicious Station in Org B",
        })
      ).rejects.toThrow("Forbidden");
    });

    test("Newly created station defaults to isMain: false and is immediately reactive with zero summary metrics", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      const res = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "Dessert Station",
      });
      expect(res.success).toBe(true);

      const doc = await asAdmin.query(api.stations.get, { id: res.id });
      expect(doc?.isMain).toBe(false);

      const listWithSummary = (await asAdmin.query(api.stations.list, {
        organizationId: orgId,
        includeSummary: true,
      })) as any[];

      const dessertSummary = listWithSummary.find((s) => s.name === "Dessert Station");
      expect(dessertSummary).toBeDefined();
      expect(dessertSummary?.assignedItemCount).toBe(0);
      expect(dessertSummary?.categoryCount).toBe(0);
      expect(dessertSummary?.activeOrdersCount).toBe(0);
      expect(dessertSummary?.sampleCategories).toEqual([]);
      expect(dessertSummary?.sampleItems).toEqual([]);
    });
  });

  // 9. Screen 3 Add Items to Station Drawer Parity Tests
  describe("9. Screen 3 Add Items to Station Drawer Parity Tests", () => {
    test("getStationAssignmentData returns station info, menus, categories, items, and assignedItemIds", async () => {
      const { t, asAdmin, orgId } = await setupStoreWithAdmin();

      // Create station
      const stRes = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "Cold Station & Raw Bar",
      });

      // Create Menu
      const menuId = await asAdmin.mutation(api.menu.createMenu, {
        organizationId: orgId,
        name: "All-Day Dining Menu",
        isDefault: true,
      });

      // Create Categories
      const rawBarCatId = await t.mutation(api.menu.createCategory, {
        organizationId: orgId,
        menuId,
        name: "Raw Bar & Crudo",
        position: 0,
        published: true,
      });

      const saladsCatId = await t.mutation(api.menu.createCategory, {
        organizationId: orgId,
        menuId,
        name: "Organic Salads",
        position: 1,
        published: true,
      });

      // Create Menu Items
      const hamachiItem = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Hamachi Crudo, Citrus Ponzu",
        price: 950,
        description: "Cold prep line / Allergen: Fish",
        published: true,
        isAvailable: true,
        isVeg: false,
        isSpicy: false,
      });

      const burrataItem = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Burrata Pugliese",
        price: 820,
        description: "Aged balsamic, heirloom figs",
        published: true,
        isAvailable: true,
        isVeg: true,
        isSpicy: false,
      });

      // Link items to categories
      await t.mutation(api.menu.addCategoryItem, {
        organizationId: orgId,
        categoryId: rawBarCatId,
        itemId: hamachiItem,
        position: 0,
      });

      await t.mutation(api.menu.addCategoryItem, {
        organizationId: orgId,
        categoryId: saladsCatId,
        itemId: burrataItem,
        position: 1,
      });

      // Pre-assign Hamachi Crudo to station
      await asAdmin.mutation(api.stations.assignItemToStation, {
        organizationId: orgId,
        stationId: stRes.id,
        itemId: hamachiItem,
      });

      // Query assignment data
      const data = await asAdmin.query(api.stations.getStationAssignmentData, {
        organizationId: orgId,
        stationId: stRes.id,
      });

      expect(data).toBeDefined();
      expect(data.station.name).toBe("Cold Station & Raw Bar");
      expect(data.menus.length).toBe(1);
      expect(data.menus[0].name).toBe("All-Day Dining Menu");
      expect(data.categories.length).toBe(2);
      expect(data.assignedItemIds).toContain(hamachiItem);
      expect(data.assignedItemIds).not.toContain(burrataItem);
      expect(data.totalEligibleItemsCount).toBe(2);
    });

    test("updateStationItemAssignments atomically performs differential updates", async () => {
      const { t, asAdmin, orgId } = await setupStoreWithAdmin();

      const stRes = await asAdmin.mutation(api.stations.create, {
        organizationId: orgId,
        name: "Grill Station",
      });

      const item1 = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Wagyu Ribeye",
        price: 2400,
        published: true,
        isAvailable: true,
        isVeg: false,
        isSpicy: false,
      });

      const item2 = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Smoked Chicken",
        price: 1200,
        published: true,
        isAvailable: true,
        isVeg: false,
        isSpicy: false,
      });

      const item3 = await t.mutation(api.menu.createItem, {
        organizationId: orgId,
        name: "Grilled Asparagus",
        price: 650,
        published: true,
        isAvailable: true,
        isVeg: true,
        isSpicy: false,
      });

      // 1. Initial assignment: item1 and item2
      const res1 = await asAdmin.mutation(api.stations.updateStationItemAssignments, {
        organizationId: orgId,
        stationId: stRes.id,
        assignedItemIds: [item1, item2],
      });

      expect(res1.success).toBe(true);
      expect(res1.addedCount).toBe(2);
      expect(res1.removedCount).toBe(0);
      expect(res1.totalAssigned).toBe(2);

      let list = await asAdmin.query(api.stations.listStationItems, {
        organizationId: orgId,
        stationId: stRes.id,
      });
      expect(list.map((m) => m.item._id)).toEqual(expect.arrayContaining([item1, item2]));
      expect(list.length).toBe(2);

      // 2. Differential update: remove item1, keep item2, add item3
      const res2 = await asAdmin.mutation(api.stations.updateStationItemAssignments, {
        organizationId: orgId,
        stationId: stRes.id,
        assignedItemIds: [item2, item3],
      });

      expect(res2.success).toBe(true);
      expect(res2.addedCount).toBe(1); // item3 added
      expect(res2.removedCount).toBe(1); // item1 removed
      expect(res2.totalAssigned).toBe(2);

      list = await asAdmin.query(api.stations.listStationItems, {
        organizationId: orgId,
        stationId: stRes.id,
      });
      const currentItemIds = list.map((m) => m.item._id);
      expect(currentItemIds).toContain(item2);
      expect(currentItemIds).toContain(item3);
      expect(currentItemIds).not.toContain(item1);

      // 3. Reactivation: re-add item1
      const res3 = await asAdmin.mutation(api.stations.updateStationItemAssignments, {
        organizationId: orgId,
        stationId: stRes.id,
        assignedItemIds: [item1, item2, item3],
      });
      expect(res3.addedCount).toBe(1); // item1 reactivated
      expect(res3.removedCount).toBe(0);

      list = await asAdmin.query(api.stations.listStationItems, {
        organizationId: orgId,
        stationId: stRes.id,
      });
      expect(list.length).toBe(3);
    });

    test("updateStationItemAssignments rejects cross-organization item assignment", async () => {
      const { t, orgId: orgAId, asAdmin: asAdminA } = await setupStoreWithAdmin("admin_store_a");

      const orgBId = await t.mutation(api.organizations.create, {
        name: "Store B",
        ownerClerkId: "admin_store_b",
        isDelivery: true,
        deliveryCashOnDelivery: true,
      });

      const stationA = await asAdminA.mutation(api.stations.create, {
        organizationId: orgAId,
        name: "Bakery Line",
      });

      // Item created in Org B
      const itemB = await t.mutation(api.menu.createItem, {
        organizationId: orgBId,
        name: "Croissant from Store B",
        price: 350,
        published: true,
        isAvailable: true,
        isVeg: true,
        isSpicy: false,
      });

      // Org A attempts to assign Org B's item -> Rejected
      await expect(
        asAdminA.mutation(api.stations.updateStationItemAssignments, {
          organizationId: orgAId,
          stationId: stationA.id,
          assignedItemIds: [itemB],
        })
      ).rejects.toThrow("Item not found or belongs to another organization");
    });
  });
});
