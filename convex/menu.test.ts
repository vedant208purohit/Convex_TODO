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

  test("3. Customization Item Duplication & Unavailability", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Burger Station",
    });

    const menuId = await t.mutation(api.menu.createMenu, {
      organizationId: orgId,
      name: "Burger Menu",
    });

    const catId = await t.mutation(api.menu.createCategory, {
      organizationId: orgId,
      menuId,
      name: "Burgers",
    });

    const itemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Cheeseburger",
      price: 15000,
    });

    await t.mutation(api.menu.addCategoryItem, {
      organizationId: orgId,
      categoryId: catId,
      itemId,
    });

    const custId = await t.mutation(api.menu.createCustomization, {
      organizationId: orgId,
      itemId,
      name: "Spice Level",
      customizationType: "AddOns",
    });

    const choiceId = await t.mutation(api.menu.createCustomizationItem, {
      organizationId: orgId,
      customizationId: custId,
      name: "Extra Spicy",
      price: 2000,
    });

    // Test Duplicating Customization Item
    const clonedChoiceId = await t.mutation(api.menu.duplicateCustomizationItem, {
      organizationId: orgId,
      customizationItemId: choiceId,
      newName: "Extra Spicy(1)",
    });

    const custs = await t.query(api.menu.listCustomizations, { itemId });
    expect(custs[0].items.length).toBe(2);
    expect(custs[0].items[1].name).toBe("Extra Spicy(1)");
    expect(custs[0].items[1].price).toBe(2000);

    // Test Setting Unavailability
    await t.mutation(api.menu.setCustomizationItemUnavailability, {
      id: clonedChoiceId,
      isAvailable: false,
      daysOfUnavailable: 1,
    });

    const updatedCusts = await t.query(api.menu.listCustomizations, { itemId });
    const unavailableChoice = updatedCusts[0].items.find((i) => i._id === clonedChoiceId);
    expect(unavailableChoice?.isAvailable).toBe(false);
    expect(unavailableChoice?.daysOfUnavailable).toBe(1);

    // Test Reordering Customization Items
    await t.mutation(api.menu.reorderCustomizationItems, {
      itemIds: [clonedChoiceId, choiceId],
    });

    const reorderedCusts = await t.query(api.menu.listCustomizations, { itemId });
    expect(reorderedCusts[0].items[0]._id).toBe(clonedChoiceId);
    expect(reorderedCusts[0].items[1]._id).toBe(choiceId);
  });

  test("4. Complete Soft Delete (deletedAt) Across Menu Hierarchy", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Paranoid Cafe",
    });

    const menuId = await t.mutation(api.menu.createMenu, {
      organizationId: orgId,
      name: "Drinks Menu",
    });

    const catId = await t.mutation(api.menu.createCategory, {
      organizationId: orgId,
      menuId,
      name: "Coffee",
    });

    const itemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Cold Brew",
      price: 15000,
    });

    await t.mutation(api.menu.addCategoryItem, {
      organizationId: orgId,
      categoryId: catId,
      itemId,
    });

    const custId = await t.mutation(api.menu.createCustomization, {
      organizationId: orgId,
      itemId,
      name: "Milk Type",
      customizationType: "AddOns",
    });

    const choiceId = await t.mutation(api.menu.createCustomizationItem, {
      organizationId: orgId,
      customizationId: custId,
      name: "Oat Milk",
      price: 3000,
    });

    // Verify initial active state
    let menus = await t.query(api.menu.listMenus, { organizationId: orgId });
    expect(menus.length).toBe(1);

    let catItems = await t.query(api.menu.listCategoryItems, { categoryId: catId });
    expect(catItems.length).toBe(1);

    let custs = await t.query(api.menu.listCustomizations, { itemId });
    expect(custs.length).toBe(1);
    expect(custs[0].items.length).toBe(1);

    // 1. Soft delete customization item
    await t.mutation(api.menu.deleteCustomizationItem, { id: choiceId });
    custs = await t.query(api.menu.listCustomizations, { itemId });
    expect(custs[0].items.length).toBe(0);

    // 2. Soft delete customization group
    await t.mutation(api.menu.deleteCustomization, { id: custId });
    custs = await t.query(api.menu.listCustomizations, { itemId });
    expect(custs.length).toBe(0);

    // 3. Soft delete item from category
    await t.mutation(api.menu.deleteItem, { id: itemId, categoryId: catId });
    catItems = await t.query(api.menu.listCategoryItems, { categoryId: catId });
    expect(catItems.length).toBe(0);

    let allItems = await t.query(api.menu.listAllItems, { organizationId: orgId });
    expect(allItems.length).toBe(0);

    // 4. Soft delete category
    await t.mutation(api.menu.deleteCategory, { id: catId });
    let categories = await t.query(api.menu.listCategories, { menuId });
    expect(categories.length).toBe(0);

    // 5. Soft delete menu
    await t.mutation(api.menu.deleteMenu, { id: menuId });
    menus = await t.query(api.menu.listMenus, { organizationId: orgId });
    expect(menus.length).toBe(0);
  });

  test("5. Item and Customization Item R2 Asset ID Persistence", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "R2 Menu Store",
    });

    const menuImageAssetId = await t.run(async (ctx) => {
      return await ctx.db.insert("organization_assets", {
        organizationId: orgId,
        storageKey: `organizations/${orgId}/menu_image/burger.jpg`,
        fileName: "burger.jpg",
        contentType: "image/jpeg",
        fileSize: 5000,
        assetType: "menu_image",
        status: "uploaded",
        createdBy: "user_test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const threeDAssetId = await t.run(async (ctx) => {
      return await ctx.db.insert("organization_assets", {
        organizationId: orgId,
        storageKey: `organizations/${orgId}/menu_3d_model/burger.glb`,
        fileName: "burger.glb",
        contentType: "model/gltf-binary",
        fileSize: 50000,
        assetType: "menu_3d_model",
        status: "uploaded",
        createdBy: "user_test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const threeDIosAssetId = await t.run(async (ctx) => {
      return await ctx.db.insert("organization_assets", {
        organizationId: orgId,
        storageKey: `organizations/${orgId}/menu_3d_model_ios/burger.usdz`,
        fileName: "burger.usdz",
        contentType: "model/vnd.usdz+zip",
        fileSize: 50000,
        assetType: "menu_3d_model_ios",
        status: "uploaded",
        createdBy: "user_test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const videoAssetId = await t.run(async (ctx) => {
      return await ctx.db.insert("organization_assets", {
        organizationId: orgId,
        storageKey: `organizations/${orgId}/menu_video/burger.mp4`,
        fileName: "burger.mp4",
        contentType: "video/mp4",
        fileSize: 200000,
        assetType: "menu_video",
        status: "uploaded",
        createdBy: "user_test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const itemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Truffle Burger",
      price: 1500,
      imageAssetId: menuImageAssetId,
      threeDModelAssetId: threeDAssetId,
      threeDModelIosAssetId: threeDIosAssetId,
      videoAssetId: videoAssetId,
    });

    const item = await t.run(async (ctx) => await ctx.db.get(itemId));
    expect(item?.imageAssetId).toBe(menuImageAssetId);
    expect(item?.threeDModelAssetId).toBe(threeDAssetId);
    expect(item?.threeDModelIosAssetId).toBe(threeDIosAssetId);
    expect(item?.videoAssetId).toBe(videoAssetId);

    // Update item with new asset
    const newImageAssetId = await t.run(async (ctx) => {
      return await ctx.db.insert("organization_assets", {
        organizationId: orgId,
        storageKey: `organizations/${orgId}/menu_image/burger_new.jpg`,
        fileName: "burger_new.jpg",
        contentType: "image/jpeg",
        fileSize: 6000,
        assetType: "menu_image",
        status: "uploaded",
        createdBy: "user_test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.mutation(api.menu.updateItem, {
      id: itemId,
      imageAssetId: newImageAssetId,
    });

    const updatedItem = await t.run(async (ctx) => await ctx.db.get(itemId));
    expect(updatedItem?.imageAssetId).toBe(newImageAssetId);

    // Customization Item Asset ID test
    const custId = await t.mutation(api.menu.createCustomization, {
      organizationId: orgId,
      itemId,
      name: "Add Extra Cheese",
      customizationType: "AddOns",
    });

    const choiceId = await t.mutation(api.menu.createCustomizationItem, {
      organizationId: orgId,
      customizationId: custId,
      name: "Cheddar",
      price: 200,
      imageAssetId: menuImageAssetId,
    });

    const choice = await t.run(async (ctx) => await ctx.db.get(choiceId));
    expect(choice?.imageAssetId).toBe(menuImageAssetId);
  });
});


