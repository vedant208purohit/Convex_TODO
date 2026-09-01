/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Inventory, Recipes and Procurement Integration Suite", () => {
  test("1. Supplier CRUD and Inventory Item Management", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Fresh Ingredients Co",
    });

    // Create Supplier
    const supplierResult = await t.mutation(api.inventory.createSupplier, {
      organizationId: orgId,
      supplierName: "Amul Dairy Corp",
      companyName: "Amul Ltd",
      phoneNumber: "+919876543210",
      email: "orders@amul.com",
    });

    expect(supplierResult.supplierId).not.toBeNull();

    const suppliersList = await t.query(api.inventory.listSuppliers, {
      organizationId: orgId,
    });
    expect(suppliersList).toHaveLength(1);
    expect(suppliersList[0].supplierName).toBe("Amul Dairy Corp");

    // Create Inventory Raw Item
    const itemResult = await t.mutation(api.inventory.createInventoryItem, {
      organizationId: orgId,
      name: "Fresh Cheese",
      skuNumber: "SKU-CHEESE-01",
      buyingUnit: "kilogram",
      servingUnit: "gram",
      minimumStockRefillLevel: 500, // 500g low stock alert threshold
      initialStock: 2000, // 2000g initial stock
      unitCost: 50, // ?0.50 per gram
    });

    expect(itemResult.inventoryItemId).not.toBeNull();

    const inventoryList = await t.query(api.inventory.listInventoryItems, {
      organizationId: orgId,
    });

    expect(inventoryList).toHaveLength(1);
    expect(inventoryList[0].name).toBe("Fresh Cheese");
    expect(inventoryList[0].availableStock).toBe(2000);
    expect(inventoryList[0].isLowStock).toBe(false);
  });

  test("2. Dish Recipe Formula Linking and Low Stock Warning Trigger", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Pizza Palace",
    });

    // Create Raw Material (Mozzarella Cheese - 300g initial stock)
    const cheeseResult = await t.mutation(api.inventory.createInventoryItem, {
      organizationId: orgId,
      name: "Mozzarella Cheese",
      buyingUnit: "kilogram",
      servingUnit: "gram",
      minimumStockRefillLevel: 500, // Threshold 500g
      initialStock: 300, // 300g (currently below threshold)
    });

    // Verify Low Stock Query
    const lowStockItems = await t.query(api.inventory.getLowStockItems, {
      organizationId: orgId,
    });

    expect(lowStockItems).toHaveLength(1);
    expect(lowStockItems[0].name).toBe("Mozzarella Cheese");

    // Create Menu Item (Margherita Pizza)
    const itemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Margherita Pizza",
      price: 35000,
    });

    // Link Recipe: 1 Margherita Pizza requires 150g Mozzarella Cheese
    const recipeResult = await t.mutation(api.inventory.linkItemRecipe, {
      organizationId: orgId,
      itemId,
      inventoryItemId: cheeseResult.inventoryItemId,
      quantity: 150,
      unit: "gram",
    });

    expect(recipeResult.recipeId).not.toBeNull();

    // Query Recipe Formula for Dish
    const dishRecipe = await t.query(api.inventory.getItemRecipe, {
      itemId,
    });

    expect(dishRecipe).toHaveLength(1);
    expect(dishRecipe[0].ingredientName).toBe("Mozzarella Cheese");
    expect(dishRecipe[0].quantity).toBe(150);
  });

  test("3. Purchase Order Restocking Settlement and Dead Stock Spoilage", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Burger Haven",
    });

    const supplierResult = await t.mutation(api.inventory.createSupplier, {
      organizationId: orgId,
      supplierName: "Baking Supplies Ltd",
    });

    const bunItem = await t.mutation(api.inventory.createInventoryItem, {
      organizationId: orgId,
      name: "Burger Buns",
      buyingUnit: "packet",
      servingUnit: "piece",
      minimumStockRefillLevel: 20,
      initialStock: 10,
    });

    // Create Purchase Order (PO) for 100 Buns
    const poResult = await t.mutation(api.inventory.createPurchaseOrder, {
      organizationId: orgId,
      supplierId: supplierResult.supplierId,
      purchasePriority: "high",
      items: [
        {
          inventoryItemId: bunItem.inventoryItemId,
          unit: "piece",
          orderedQuantity: 100,
          unitCost: 1000, // ?10 per bun
        },
      ],
    });

    expect(poResult.poNumber).toContain("PO-");

    // Settle PO (Recieves 100 Buns into Inventory)
    await t.mutation(api.inventory.settlePurchaseOrder, {
      purchaseOrderId: poResult.purchaseOrderId,
    });

    const itemsAfterPO = await t.query(api.inventory.listInventoryItems, {
      organizationId: orgId,
    });
    // 10 initial + 100 PO = 110 total available stock
    expect(itemsAfterPO[0].availableStock).toBe(110);

    // Log Dead Stock (5 Buns spoiled/damaged)
    await t.mutation(api.inventory.logDeadStock, {
      organizationId: orgId,
      inventoryItemId: bunItem.inventoryItemId,
      quantity: 5,
      unit: "piece",
      reasonForDeadStock: "Spoiled",
    });

    const itemsAfterDeadStock = await t.query(api.inventory.listInventoryItems, {
      organizationId: orgId,
    });
    expect(itemsAfterDeadStock[0].availableStock).toBe(105);
  });

  test("4. POS Order Completion Automatic Stock Deduction Hook", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Steakhouse POS",
    });

    // Raw Material: Coffee Beans (1000g initial stock)
    const beansItem = await t.mutation(api.inventory.createInventoryItem, {
      organizationId: orgId,
      name: "Espresso Beans",
      buyingUnit: "kilogram",
      servingUnit: "gram",
      minimumStockRefillLevel: 100,
      initialStock: 1000,
    });

    // Menu Item: Espresso Shot
    const itemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Espresso",
      price: 15000,
    });

    // Recipe: 1 Espresso requires 18g Beans
    await t.mutation(api.inventory.linkItemRecipe, {
      organizationId: orgId,
      itemId,
      inventoryItemId: beansItem.inventoryItemId,
      quantity: 18,
      unit: "gram",
    });

    // Customer places POS Order for 2 Espresso Shots (consumes 36g Beans)
    const orderResult = await t.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "TakeAway",
      items: [{ itemId, quantity: 2 }],
    });

    // Complete POS Order (Triggers automatic stock destruction hook)
    await t.mutation(api.orders.completeOrder, {
      orderId: orderResult.orderId,
    });

    // Verify Stock Reduction: 1000g - 36g = 964g
    const itemsAfterSale = await t.query(api.inventory.listInventoryItems, {
      organizationId: orgId,
    });

    expect(itemsAfterSale[0].availableStock).toBe(964);
  });
});
