import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ==========================================
// 1. SUPPLIER MANAGEMENT MUTATIONS & QUERIES
// ==========================================

export const createSupplier = mutation({
  args: {
    organizationId: v.id("organizations"),
    supplierName: v.string(),
    companyName: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    whatsappNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    gstNumber: v.optional(v.string()),
    fssaiLicNumber: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("suppliers", {
      organizationId: args.organizationId,
      supplierName: args.supplierName,
      companyName: args.companyName,
      phoneNumber: args.phoneNumber,
      whatsappNumber: args.whatsappNumber,
      email: args.email,
      gstNumber: args.gstNumber,
      fssaiLicNumber: args.fssaiLicNumber,
      address: args.address,
      city: args.city,
      createdAt: now,
      updatedAt: now,
    });
    return { supplierId: id };
  },
});

export const updateSupplier = mutation({
  args: {
    id: v.id("suppliers"),
    supplierName: v.optional(v.string()),
    companyName: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const supplier = await ctx.db.get(args.id);
    if (!supplier) throw new Error("Supplier not found");

    const patch: any = { updatedAt: Date.now() };
    if (args.supplierName !== undefined) patch.supplierName = args.supplierName;
    if (args.companyName !== undefined) patch.companyName = args.companyName;
    if (args.phoneNumber !== undefined) patch.phoneNumber = args.phoneNumber;
    if (args.email !== undefined) patch.email = args.email;
    if (args.address !== undefined) patch.address = args.address;
    if (args.city !== undefined) patch.city = args.city;

    await ctx.db.patch(args.id, patch);
    return { success: true };
  },
});

export const listSuppliers = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("suppliers")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();
  },
});

export const deleteSupplier = mutation({
  args: { id: v.id("suppliers") },
  handler: async (ctx, args) => {
    const supplier = await ctx.db.get(args.id);
    if (!supplier) throw new Error("Supplier not found");
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// ==========================================
// 2. INVENTORY STOCK CATALOG & LOW-STOCK ALERTS
// ==========================================

export const createInventoryItem = mutation({
  args: {
    organizationId: v.id("organizations"),
    categoryId: v.optional(v.id("inventoryCategories")),
    name: v.string(),
    description: v.optional(v.string()),
    skuNumber: v.optional(v.string()),
    buyingUnit: v.string(), // "kilogram", "litre", "packet", "piece"
    servingUnit: v.string(), // "gram", "millilitre", "piece"
    minimumStockRefillLevel: v.number(),
    baselineStockLevel: v.optional(v.number()),
    initialStock: v.optional(v.number()),
    unitCost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const availableStock = args.initialStock ?? 0;

    const itemId = await ctx.db.insert("inventoryItems", {
      organizationId: args.organizationId,
      categoryId: args.categoryId,
      name: args.name,
      description: args.description,
      skuNumber: args.skuNumber,
      buyingUnit: args.buyingUnit,
      servingUnit: args.servingUnit,
      minimumStockRefillLevel: args.minimumStockRefillLevel,
      baselineStockLevel: args.baselineStockLevel,
      availableStock,
      unitCost: args.unitCost,
      createdAt: now,
      updatedAt: now,
    });

    if (availableStock > 0) {
      await ctx.db.insert("inventoryItemStocks", {
        organizationId: args.organizationId,
        inventoryItemId: itemId,
        stockType: "credit",
        quantity: availableStock,
        unit: args.servingUnit,
        sourceType: "ManualAdjustment",
        createdAt: now,
      });
    }

    return { inventoryItemId: itemId };
  },
});

export const updateInventoryItem = mutation({
  args: {
    id: v.id("inventoryItems"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    minimumStockRefillLevel: v.optional(v.number()),
    unitCost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Inventory item not found");

    const patch: any = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.description !== undefined) patch.description = args.description;
    if (args.minimumStockRefillLevel !== undefined) patch.minimumStockRefillLevel = args.minimumStockRefillLevel;
    if (args.unitCost !== undefined) patch.unitCost = args.unitCost;

    await ctx.db.patch(args.id, patch);
    return { success: true };
  },
});

export const listInventoryItems = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("inventoryItems")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    return items.map((i) => ({
      ...i,
      isLowStock: i.availableStock <= i.minimumStockRefillLevel,
    }));
  },
});

export const getLowStockItems = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("inventoryItems")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    return items.filter((i) => i.availableStock <= i.minimumStockRefillLevel);
  },
});

// ==========================================
// 3. RECIPES & INGREDIENT FORMULA BUILDER
// ==========================================

export const linkItemRecipe = mutation({
  args: {
    organizationId: v.id("organizations"),
    itemId: v.optional(v.id("items")),
    customizationItemId: v.optional(v.id("customizationItems")),
    inventoryItemId: v.id("inventoryItems"),
    quantity: v.number(),
    unit: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.itemId && !args.customizationItemId) {
      throw new Error("Recipe must link to either a menu item or a customization choice");
    }

    const now = Date.now();
    const recipeId = await ctx.db.insert("recipes", {
      organizationId: args.organizationId,
      itemId: args.itemId,
      customizationItemId: args.customizationItemId,
      inventoryItemId: args.inventoryItemId,
      quantity: args.quantity,
      unit: args.unit,
      createdAt: now,
      updatedAt: now,
    });

    return { recipeId };
  },
});

export const getItemRecipe = query({
  args: {
    itemId: v.optional(v.id("items")),
    customizationItemId: v.optional(v.id("customizationItems")),
  },
  handler: async (ctx, args) => {
    let recipesList: Array<any> = [];

    if (args.itemId) {
      recipesList = await ctx.db
        .query("recipes")
        .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
        .collect();
    } else if (args.customizationItemId) {
      recipesList = await ctx.db
        .query("recipes")
        .withIndex("by_customization", (q) => q.eq("customizationItemId", args.customizationItemId))
        .collect();
    }

    const result: Array<any> = [];
    for (const r of recipesList) {
      const invItem = await ctx.db.get(r.inventoryItemId);
      result.push({
        ...r,
        ingredientName: invItem?.name ?? "Unknown Ingredient",
        buyingUnit: invItem?.buyingUnit,
        servingUnit: invItem?.servingUnit,
      });
    }

    return result;
  },
});

export const removeItemRecipe = mutation({
  args: { id: v.id("recipes") },
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.id);
    if (!r) throw new Error("Recipe not found");
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// ==========================================
// 4. PURCHASE ORDERS & RESTOCKING
// ==========================================

export const createPurchaseOrder = mutation({
  args: {
    organizationId: v.id("organizations"),
    supplierId: v.id("suppliers"),
    purchasePriority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    notes: v.optional(v.string()),
    items: v.array(
      v.object({
        inventoryItemId: v.id("inventoryItems"),
        unit: v.string(),
        orderedQuantity: v.number(),
        unitCost: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const todayStart = new Date(now).setHours(0, 0, 0, 0);

    const todayPOs = await ctx.db
      .query("purchaseOrders")
      .withIndex("by_status", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const poCount = todayPOs.length + 1;
    const dateStr = new Date(now).toISOString().slice(0, 10).replace(/-/g, "");
    const poNumber = "PO-" + dateStr + "-" + poCount.toString().padStart(3, "0");

    let totalAmount = 0;
    const poItemsConfig: Array<any> = [];

    for (const itemInput of args.items) {
      const totalCost = itemInput.orderedQuantity * itemInput.unitCost;
      totalAmount += totalCost;
      poItemsConfig.push({
        inventoryItemId: itemInput.inventoryItemId,
        unit: itemInput.unit,
        orderedQuantity: itemInput.orderedQuantity,
        unitCost: itemInput.unitCost,
        totalCost,
      });
    }

    const purchaseOrderId = await ctx.db.insert("purchaseOrders", {
      organizationId: args.organizationId,
      supplierId: args.supplierId,
      poNumber,
      purchasePriority: args.purchasePriority,
      status: "drafted",
      totalAmount,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });

    for (const line of poItemsConfig) {
      await ctx.db.insert("purchaseOrderItems", {
        organizationId: args.organizationId,
        purchaseOrderId,
        inventoryItemId: line.inventoryItemId,
        unit: line.unit,
        orderedQuantity: line.orderedQuantity,
        receivedQuantity: line.orderedQuantity,
        unitCost: line.unitCost,
        totalCost: line.totalCost,
        createdAt: now,
      });
    }

    return { purchaseOrderId, poNumber, totalAmount };
  },
});

export const settlePurchaseOrder = mutation({
  args: { purchaseOrderId: v.id("purchaseOrders") },
  handler: async (ctx, args) => {
    const po = await ctx.db.get(args.purchaseOrderId);
    if (!po) throw new Error("Purchase Order not found");
    if (po.status === "settled") throw new Error("Purchase Order is already settled");

    const now = Date.now();
    const poItems = await ctx.db
      .query("purchaseOrderItems")
      .withIndex("by_po", (q) => q.eq("purchaseOrderId", po._id))
      .collect();

    for (const line of poItems) {
      const invItem = await ctx.db.get(line.inventoryItemId);
      if (invItem) {
        const addedQty = line.receivedQuantity ?? line.orderedQuantity;

        // Credit Stock Ledger Entry
        await ctx.db.insert("inventoryItemStocks", {
          organizationId: po.organizationId,
          inventoryItemId: line.inventoryItemId,
          stockType: "credit",
          quantity: addedQty,
          unit: line.unit,
          sourceType: "PurchaseOrder",
          purchaseOrderId: po._id,
          supplierId: po.supplierId,
          createdAt: now,
        });

        // Increase Available Stock
        await ctx.db.patch(line.inventoryItemId, {
          availableStock: invItem.availableStock + addedQty,
          unitCost: line.unitCost,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(po._id, {
      status: "settled",
      settledAt: now,
      updatedAt: now,
    });

    return { success: true, status: "settled" };
  },
});

// ==========================================
// 5. DEAD STOCK LOGGING & SPOILAGE TRACKER
// ==========================================

export const logDeadStock = mutation({
  args: {
    organizationId: v.id("organizations"),
    inventoryItemId: v.id("inventoryItems"),
    quantity: v.number(),
    unit: v.string(),
    reasonForDeadStock: v.string(), // "Spoiled", "Expired", "Damaged", "Spilled"
  },
  handler: async (ctx, args) => {
    const invItem = await ctx.db.get(args.inventoryItemId);
    if (!invItem) throw new Error("Inventory item not found");

    const now = Date.now();

    // Debit Stock Ledger Entry for Dead Stock
    await ctx.db.insert("inventoryItemStocks", {
      organizationId: args.organizationId,
      inventoryItemId: args.inventoryItemId,
      stockType: "debit",
      quantity: args.quantity,
      unit: args.unit,
      sourceType: "DeadStock",
      isDeadStock: true,
      reasonForDeadStock: args.reasonForDeadStock,
      createdAt: now,
    });

    // Reduce Available Stock
    const newStock = Math.max(0, invItem.availableStock - args.quantity);
    await ctx.db.patch(args.inventoryItemId, {
      availableStock: newStock,
      updatedAt: now,
    });

    return { success: true, newStock };
  },
});
