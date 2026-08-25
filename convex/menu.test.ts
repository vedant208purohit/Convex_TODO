/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Multi-Menu Architecture Tests", () => {
  test("1. Multi-Menu Creation & Default Menu Setting", async () => {
    const t = convexTest(schema, modules);

    // Create an Organization
    const orgId = await t.mutation(api.organizations.create, {
      name: "Spice Garden",
    });

    // Create First Menu -> Should auto-set as default
    const breakfastMenuId = await t.mutation(api.menu.createMenu, {
      organizationId: orgId,
      name: "Breakfast Menu",
      description: "Morning specials",
    });

    const breakfastMenu = await t.query(api.menu.getMenu, { id: breakfastMenuId });
    expect(breakfastMenu?.isDefault).toBe(true);
    expect(breakfastMenu?.name).toBe("Breakfast Menu");

    // Create Second Menu -> Should default to isDefault: false
    const lunchMenuId = await t.mutation(api.menu.createMenu, {
      organizationId: orgId,
      name: "Lunch Menu",
      description: "Afternoon thali & mains",
    });

    const lunchMenu = await t.query(api.menu.getMenu, { id: lunchMenuId });
    expect(lunchMenu?.isDefault).toBe(false);

    // Change default menu to Lunch Menu
    await t.mutation(api.menu.setDefaultMenu, { id: lunchMenuId });

    const updatedBreakfast = await t.query(api.menu.getMenu, { id: breakfastMenuId });
    const updatedLunch = await t.query(api.menu.getMenu, { id: lunchMenuId });

    expect(updatedBreakfast?.isDefault).toBe(false);
    expect(updatedLunch?.isDefault).toBe(true);

    // List menus for org
    const menus = await t.query(api.menu.listMenus, { organizationId: orgId });
    expect(menus.length).toBe(2);
  });

  test("2. Full Organization Menu Tree Construction & Retrieval", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Royal Dining",
    });

    // 1. Create Menu
    const menuId = await t.mutation(api.menu.createMenu, {
      organizationId: orgId,
      name: "Main Menu",
    });

    // 2. Create Category
    const startersCatId = await t.mutation(api.menu.createCategory, {
      organizationId: orgId,
      menuId: menuId,
      name: "Starters",
      position: 1,
    });

    // 3. Create Items
    const item1Id = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Paneer Tikka",
      price: 25000, // 250.00
      description: "Charcoal grilled cottage cheese",
      isVeg: true,
      isSpicy: true,
    });

    const item2Id = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Chicken Malai Tikka",
      price: 32000, // 320.00
      description: "Creamy grilled chicken morsels",
      isVeg: false,
      isSpicy: false,
    });

    // 4. Link Items to Category
    await t.mutation(api.menu.addCategoryItem, {
      organizationId: orgId,
      categoryId: startersCatId,
      itemId: item1Id,
      position: 1,
    });

    await t.mutation(api.menu.addCategoryItem, {
      organizationId: orgId,
      categoryId: startersCatId,
      itemId: item2Id,
      position: 2,
    });

    // 5. Add Customization to Paneer Tikka
    const custId = await t.mutation(api.menu.createCustomization, {
      organizationId: orgId,
      itemId: item1Id,
      name: "Dips & Sauces",
      customizationType: "AddOns",
      required: false,
    });

    await t.mutation(api.menu.createCustomizationItem, {
      organizationId: orgId,
      customizationId: custId,
      name: "Mint Chutney",
      price: 3000, // 30.00
    });

    // 6. Query Organization Menu (Resolves Default Menu)
    const fullMenu = await t.query(api.menu.getOrganizationMenu, {
      organizationId: orgId,
    });

    expect(fullMenu.length).toBe(1);
    expect(fullMenu[0].category.name).toBe("Starters");
    expect(fullMenu[0].category.items.length).toBe(2);

    const firstItem = fullMenu[0].category.items[0];
    expect(firstItem.item.name).toBe("Paneer Tikka");
    expect(firstItem.item.display_price).toBe("250.00");
    expect(firstItem.customizations.length).toBe(1);
    expect(firstItem.customizations[0].name).toBe("Dips & Sauces");
    expect(firstItem.customizations[0].customization_items[0].name).toBe("Mint Chutney");

    // 7. Test Search Filter
    const searchRes = await t.query(api.menu.getOrganizationMenu, {
      organizationId: orgId,
      search: "Paneer",
    });

    expect(searchRes.length).toBe(1);
    expect(searchRes[0].category.items.length).toBe(1);
    expect(searchRes[0].category.items[0].item.name).toBe("Paneer Tikka");

    // 8. Test Veg Attribute Filter
    const vegRes = await t.query(api.menu.getOrganizationMenu, {
      organizationId: orgId,
      isVeg: true,
    });

    expect(vegRes[0].category.items.length).toBe(1);
    expect(vegRes[0].category.items[0].item.name).toBe("Paneer Tikka");
  });
});
