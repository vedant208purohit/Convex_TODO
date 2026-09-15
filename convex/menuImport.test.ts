/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Menu CSV Import Backend Tests", () => {
  // Helper: Setup store with an initial admin user
  async function setupStoreWithAdmin(adminClerkId = "clerk_admin_1") {
    const t = convexTest(schema, modules);

    // Create store organization with initial owner
    const orgId = await t.mutation(api.organizations.create, {
      name: "Spice Garden Store",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    return { t, orgId, adminClerkId, asAdmin };
  }

  // ----------------------------------------------------
  // 1. AUTHENTICATION & AUTHORIZATION TESTS
  // ----------------------------------------------------
  describe("1. Authentication & Authorization", () => {
    test("Unauthenticated import call is rejected", async () => {
      const { t, orgId } = await setupStoreWithAdmin();

      const csv = `category_name,item_name,price\nStarters,Paneer Tikka,12.50`;

      await expect(
        t.mutation(api.menuImport.importCsv, {
          organizationId: orgId,
          csvContent: csv,
        })
      ).rejects.toThrow("Unauthenticated");
    });

    test("Non-admin role (e.g. waiter) is rejected with Forbidden", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      // Register non-admin user
      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "clerk_waiter_1",
        email: "waiter@dhaba.com",
        firstName: "Waiter",
        lastName: "Raju",
        userType: ["waiter"],
      });

      const waiterCaller = t.withIdentity({
        subject: "clerk_waiter_1",
        email: "waiter@dhaba.com",
      });

      const csv = `category_name,item_name,price\nStarters,Paneer Tikka,12.50`;

      await expect(
        waiterCaller.mutation(api.menuImport.importCsv, {
          organizationId: orgId,
          csvContent: csv,
        })
      ).rejects.toThrow("Forbidden. Admin access required.");
    });

    test("Store Admin succeeds with menu import", async () => {
      const { orgId, asAdmin } = await setupStoreWithAdmin();

      const csv = `category_name,item_name,price\nStarters,Paneer Tikka,12.50`;

      const result = await asAdmin.mutation(api.menuImport.importCsv, {
        organizationId: orgId,
        csvContent: csv,
      });

      expect(result.success).toBe(true);
      expect(result.totalRows).toBe(1);
      expect(result.categoriesCreated).toBe(1);
      expect(result.itemsCreated).toBe(1);
      expect(result.categoryItemsLinked).toBe(1);
    });
  });

  // ----------------------------------------------------
  // 2. CSV VALIDATION & ERROR HANDLING
  // ----------------------------------------------------
  describe("2. CSV Validation & Error Handling", () => {
    test("Rejects empty or whitespace-only CSV", async () => {
      const { orgId, asAdmin } = await setupStoreWithAdmin();

      await expect(
        asAdmin.mutation(api.menuImport.importCsv, {
          organizationId: orgId,
          csvContent: "   \n  \n  ",
        })
      ).rejects.toThrow("Menu file is missing or empty");
    });

    test("Rejects CSV missing required headers", async () => {
      const { orgId, asAdmin } = await setupStoreWithAdmin();

      // Missing 'price' header
      const invalidCsv = `category_name,item_name,code\nStarters,Paneer Tikka,SKU101`;

      await expect(
        asAdmin.mutation(api.menuImport.importCsv, {
          organizationId: orgId,
          csvContent: invalidCsv,
        })
      ).rejects.toThrow("Missing required CSV headers: price");
    });

    test("Row-level error reporting for malformed rows while processing valid rows", async () => {
      const { orgId, asAdmin } = await setupStoreWithAdmin();

      const mixedCsv = [
        "category_name,item_name,price",
        "Starters,Paneer Tikka,12.50",
        ",Butter Chicken,15.00", // Missing category_name
        "Main Course,,14.00", // Missing item_name
        "Beverages,Mango Lassi,invalid_price", // Invalid price
        "Beverages,Masala Chai,3.00", // Valid
      ].join("\n");

      const result = await asAdmin.mutation(api.menuImport.importCsv, {
        organizationId: orgId,
        csvContent: mixedCsv,
      });

      expect(result.success).toBe(false);
      expect(result.totalRows).toBe(5);
      expect(result.skippedRows).toBe(3);
      expect(result.itemsCreated).toBe(2);
      expect(result.errors.length).toBe(3);

      expect(result.errors[0]).toEqual({
        row: 3,
        error: "category_name is required",
      });
      expect(result.errors[1]).toEqual({
        row: 4,
        error: "item_name is required",
      });
      expect(result.errors[2].row).toBe(5);
      expect(result.errors[2].error).toContain("price must be a valid non-negative number");
    });
  });

  // ----------------------------------------------------
  // 3. FULL IMPORT & UPSERT SEMANTICS
  // ----------------------------------------------------
  describe("3. Full Import & Upsert Semantics", () => {
    test("Correctly maps all legacy fields and creates menu relations", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin("clerk_admin_curry");

      const fullCsv = [
        "category_name,category_name_gu,item_name,item_name_gu,code,item_description,price,vegetarian,non_vegetarian,quantity,quantity_unit,taxable,calorie,calorie_metric",
        'Starters,શરૂઆત,Paneer Chilli,પનીર ચીલી,SKU-001,"Crispy paneer cubes in spicy chili sauce",14.50,true,false,250,grams,true,380,kcal',
        'Main Course,મુખ્ય ભોજન,Chicken Biryani,ચિકન બિરયાની,SKU-002,"Aromatic basmati rice with spiced chicken",18.00,false,true,1,plate,true,650,kcal',
      ].join("\n");

      const result = await asAdmin.mutation(api.menuImport.importCsv, {
        organizationId: orgId,
        csvContent: fullCsv,
      });

      expect(result.success).toBe(true);
      expect(result.totalRows).toBe(2);
      expect(result.categoriesCreated).toBe(2);
      expect(result.itemsCreated).toBe(2);
      expect(result.categoryItemsLinked).toBe(2);

      // Verify menus & categories created
      const menus = await t.query(api.menu.listMenus, { organizationId: orgId });
      expect(menus.length).toBe(1);
      const defaultMenu = menus[0];

      const categories = await t.query(api.menu.listCategories, { menuId: defaultMenu._id });
      expect(categories.length).toBe(2);
      const startersCat = categories.find((c) => c.name === "Starters");
      expect(startersCat).toBeDefined();
      expect(startersCat?.name_gu).toBe("શરૂઆત");

      // Verify items created
      const items = await t.query(api.menu.listAllItems, { organizationId: orgId });
      expect(items.length).toBe(2);

      const paneerItem = items.find((i) => i.name === "Paneer Chilli");
      expect(paneerItem).toBeDefined();
      expect(paneerItem?.price).toBe(1450); // Minor units: 14.50 * 100
      expect(paneerItem?.skuNumber).toBe("SKU-001");
      expect(paneerItem?.description).toBe("Crispy paneer cubes in spicy chili sauce");
      expect(paneerItem?.isVeg).toBe(true);
      expect(paneerItem?.isGst).toBe(true);
      expect(paneerItem?.showQuantity).toBe(true);
      expect(paneerItem?.quantity).toBe(250);
      expect(paneerItem?.quantityUnit).toBe("grams");
      expect(paneerItem?.showCalorie).toBe(true);
      expect(paneerItem?.calorie).toBe("380");
      expect(paneerItem?.calorieMetric).toBe("kcal");

      const biryaniItem = items.find((i) => i.name === "Chicken Biryani");
      expect(biryaniItem).toBeDefined();
      expect(biryaniItem?.price).toBe(1800);
      expect(biryaniItem?.skuNumber).toBe("SKU-002");
      expect(biryaniItem?.isVeg).toBe(false);

      // Verify ItemTypes created and linked
      const itemTypes = await t.query(api.menu.listItemTypes, { organizationId: orgId });
      const vegType = itemTypes.find((it) => it.name === "Vegetarian");
      const nonVegType = itemTypes.find((it) => it.name === "Non vegetarian");
      expect(vegType).toBeDefined();
      expect(nonVegType).toBeDefined();
      expect(paneerItem?.itemTypeIds).toContain(vegType?._id);
      expect(biryaniItem?.itemTypeIds).toContain(nonVegType?._id);

      // Verify Category-Item relations
      const categoryItems = await t.query(api.menu.listCategoryItems, {
        categoryId: startersCat!._id,
      });
      expect(categoryItems.length).toBe(1);
      expect(categoryItems[0].item._id).toBe(paneerItem!._id);
    });

    test("Idempotent re-import updates existing categories/items without duplication", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin("clerk_admin_royal");

      const initialCsv = [
        "category_name,item_name,price,item_description",
        "Beverages,Masala Chai,2.50,Hot spiced tea",
        "Beverages,Cold Coffee,4.00,Chilled sweet brew",
      ].join("\n");

      // 1. Initial import
      const firstResult = await asAdmin.mutation(api.menuImport.importCsv, {
        organizationId: orgId,
        csvContent: initialCsv,
      });

      expect(firstResult.categoriesCreated).toBe(1);
      expect(firstResult.itemsCreated).toBe(2);
      expect(firstResult.categoriesUpdated).toBe(0);
      expect(firstResult.itemsUpdated).toBe(0);

      // 2. Updated CSV with changed prices, modified description, and same items
      const updatedCsv = [
        "category_name,item_name,price,item_description",
        "Beverages,Masala Chai,3.00,Signature hot spiced tea with cardamom",
        "beverages,cold coffee,4.50,Double shot cold coffee", // Different case
      ].join("\n");

      const secondResult = await asAdmin.mutation(api.menuImport.importCsv, {
        organizationId: orgId,
        csvContent: updatedCsv,
      });

      expect(secondResult.success).toBe(true);
      expect(secondResult.categoriesCreated).toBe(0);
      expect(secondResult.categoriesUpdated).toBe(1); // 1 distinct category updated
      expect(secondResult.itemsCreated).toBe(0);
      expect(secondResult.itemsUpdated).toBe(2); // 2 distinct items updated
      expect(secondResult.categoryItemsLinked).toBe(0); // Already linked, no duplicates

      // Verify no duplicates created
      const allItems = await t.query(api.menu.listAllItems, { organizationId: orgId });
      expect(allItems.length).toBe(2);

      const chai = allItems.find((i) => i.name.toLowerCase() === "masala chai");
      expect(chai?.price).toBe(300); // 3.00 * 100
      expect(chai?.description).toBe("Signature hot spiced tea with cardamom");

      const coffee = allItems.find((i) => i.name.toLowerCase() === "cold coffee");
      expect(coffee?.price).toBe(450); // 4.50 * 100
      expect(coffee?.description).toBe("Double shot cold coffee");
    });

    test("Import supports custom explicit target menuId", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin("clerk_admin_multi");

      // Create a specific Breakfast Menu
      const breakfastMenuId = await asAdmin.mutation(api.menu.createMenu, {
        organizationId: orgId,
        name: "Breakfast Specials",
      });

      const csv = `category_name,item_name,price\nBreakfast,Idli Sambhar,6.00`;

      const result = await asAdmin.mutation(api.menuImport.importCsv, {
        organizationId: orgId,
        menuId: breakfastMenuId,
        csvContent: csv,
      });

      expect(result.success).toBe(true);

      const categories = await t.query(api.menu.listCategories, { menuId: breakfastMenuId });
      const breakfastCat = categories.find((c) => c.name === "Breakfast");
      expect(breakfastCat?.menuId).toBe(breakfastMenuId);
    });
  });

  // ----------------------------------------------------
  // 4. ORGANIZATION ISOLATION TESTS
  // ----------------------------------------------------
  describe("4. Organization Isolation", () => {
    test("User from Store A cannot import into Store B", async () => {
      const t = convexTest(schema, modules);

      const orgA = await t.mutation(api.organizations.create, {
        name: "Store Alpha",
        ownerClerkId: "clerk_owner_alpha",
      });
      const orgB = await t.mutation(api.organizations.create, {
        name: "Store Beta",
        ownerClerkId: "clerk_owner_beta",
      });

      const alphaCaller = t.withIdentity({
        subject: "clerk_owner_alpha",
        email: "alpha@store.com",
      });

      const csv = `category_name,item_name,price\nStarters,Papad,2.00`;

      // Alpha caller attempting to import into Store B
      await expect(
        alphaCaller.mutation(api.menuImport.importCsv, {
          organizationId: orgB,
          csvContent: csv,
        })
      ).rejects.toThrow("Forbidden. Admin access required.");
    });
  });

  // ----------------------------------------------------
  // 5. ADVANCED CSV PARSING TESTS (QUOTES, COMMAS, ESCAPES)
  // ----------------------------------------------------
  describe("5. Advanced CSV RFC-4180 Parsing", () => {
    test("Handles quoted strings with commas and escaped quotes", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin("clerk_admin_bistro");

      const complexCsv = [
        "category_name,item_name,price,item_description",
        '"Chef\'s Special, Premium","Truffle, Garlic Pizza",22.50,"Contains ""real"" white truffle oil, roasted garlic, and mozzarella"',
      ].join("\n");

      const result = await asAdmin.mutation(api.menuImport.importCsv, {
        organizationId: orgId,
        csvContent: complexCsv,
      });

      expect(result.success).toBe(true);
      expect(result.itemsCreated).toBe(1);

      const items = await t.query(api.menu.listAllItems, { organizationId: orgId });
      const pizza = items.find((i) => i.name === "Truffle, Garlic Pizza");
      expect(pizza).toBeDefined();
      expect(pizza?.price).toBe(2250);
      expect(pizza?.description).toBe(
        'Contains "real" white truffle oil, roasted garlic, and mozzarella'
      );

      const menus = await t.query(api.menu.listMenus, { organizationId: orgId });
      const categories = await t.query(api.menu.listCategories, { menuId: menus[0]._id });
      const specCat = categories.find((c) => c.name === "Chef's Special, Premium");
      expect(specCat).toBeDefined();
    });
  });
});
