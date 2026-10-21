import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

// ==========================================
// 0. UNIT CONVERSION CONSTANTS & ENGINE
// ==========================================

export const UNIT_FACTORS: Record<
  string,
  { type: "weight" | "volume" | "count"; factor: number }
> = {
  // Weight base: gram (g)
  gram: { type: "weight", factor: 1 },
  g: { type: "weight", factor: 1 },
  milligram: { type: "weight", factor: 0.001 },
  mg: { type: "weight", factor: 0.001 },
  kilogram: { type: "weight", factor: 1000 },
  kg: { type: "weight", factor: 1000 },
  pounds: { type: "weight", factor: 453.592 },
  lbs: { type: "weight", factor: 453.592 },
  ounce: { type: "weight", factor: 28.3495 },
  oz: { type: "weight", factor: 28.3495 },

  // Volume base: millilitre (ml)
  millilitre: { type: "volume", factor: 1 },
  ml: { type: "volume", factor: 1 },
  litre: { type: "volume", factor: 1000 },
  l: { type: "volume", factor: 1000 },
  teaspoon: { type: "volume", factor: 4.92892 },
  tsp: { type: "volume", factor: 4.92892 },
  tablespoon: { type: "volume", factor: 14.7868 },
  tbsp: { type: "volume", factor: 14.7868 },
  "fluid ounce": { type: "volume", factor: 29.5735 },
  "fl oz": { type: "volume", factor: 29.5735 },
  gallon: { type: "volume", factor: 3785.41 },
  gal: { type: "volume", factor: 3785.41 },

  // Count base: piece (pc)
  piece: { type: "count", factor: 1 },
  pc: { type: "count", factor: 1 },
  portion: { type: "count", factor: 1 },
  ptn: { type: "count", factor: 1 },
  packet: { type: "count", factor: 1 },
  pkt: { type: "count", factor: 1 },
  dozen: { type: "count", factor: 12 },
  dzn: { type: "count", factor: 12 },
  box: { type: "count", factor: 1 },
};

export function convertUnits(
  amount: number,
  fromUnit?: string,
  toUnit?: string
): number {
  if (!fromUnit || !toUnit) return amount;
  const cleanFrom = fromUnit
    .trim()
    .toLowerCase()
    .split(" ")[0]
    .replace(/[\(\)]/g, "");
  const cleanTo = toUnit
    .trim()
    .toLowerCase()
    .split(" ")[0]
    .replace(/[\(\)]/g, "");

  const fromSpec =
    UNIT_FACTORS[cleanFrom] || UNIT_FACTORS[fromUnit.toLowerCase()];
  const toSpec = UNIT_FACTORS[cleanTo] || UNIT_FACTORS[toUnit.toLowerCase()];

  if (!fromSpec || !toSpec) return amount;
  if (fromSpec.type !== toSpec.type) return amount;

  const inBase = amount * fromSpec.factor;
  return inBase / toSpec.factor;
}

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
    country: v.optional(v.string()),
    state: v.optional(v.string()),
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
      country: args.country,
      state: args.state,
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
    whatsappNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    gstNumber: v.optional(v.string()),
    fssaiLicNumber: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    state: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const supplier = await ctx.db.get(args.id);
    if (!supplier) throw new Error("Supplier not found");

    const patch: any = { updatedAt: Date.now() };
    if (args.supplierName !== undefined) patch.supplierName = args.supplierName;
    if (args.companyName !== undefined) patch.companyName = args.companyName;
    if (args.phoneNumber !== undefined) patch.phoneNumber = args.phoneNumber;
    if (args.whatsappNumber !== undefined) patch.whatsappNumber = args.whatsappNumber;
    if (args.email !== undefined) patch.email = args.email;
    if (args.gstNumber !== undefined) patch.gstNumber = args.gstNumber;
    if (args.fssaiLicNumber !== undefined) patch.fssaiLicNumber = args.fssaiLicNumber;
    if (args.address !== undefined) patch.address = args.address;
    if (args.city !== undefined) patch.city = args.city;
    if (args.country !== undefined) patch.country = args.country;
    if (args.state !== undefined) patch.state = args.state;

    await ctx.db.patch(args.id, patch);
    return { success: true };
  },
});

export const listSuppliers = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("suppliers")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    return all.filter((s) => !s.deletedAt);
  },
});

export const deleteSupplier = mutation({
  args: { id: v.id("suppliers") },
  handler: async (ctx, args) => {
    const supplier = await ctx.db.get(args.id);
    if (!supplier) throw new Error("Supplier not found");

    // Check if supplier is linked to historical Purchase Orders
    const linkedPO = await ctx.db
      .query("purchaseOrders")
      .withIndex("by_supplier", (q) => q.eq("supplierId", args.id))
      .first();

    if (linkedPO) {
      await ctx.db.patch(args.id, {
        deletedAt: Date.now(),
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.delete(args.id);
    }

    return { success: true };
  },
});

export const assignItemsToSupplier = mutation({
  args: {
    organizationId: v.id("organizations"),
    supplierId: v.id("suppliers"),
    itemIds: v.array(v.id("inventoryItems")),
  },
  handler: async (ctx, args) => {
    const allOrgItems = await ctx.db
      .query("inventoryItems")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const selectedSet = new Set(args.itemIds.map(String));

    for (const item of allOrgItems) {
      const existing = (item.supplierIds ?? []).map(String);
      const isSelected = selectedSet.has(String(item._id));
      const hasSupplier = existing.includes(String(args.supplierId));

      if (isSelected && !hasSupplier) {
        await ctx.db.patch(item._id, {
          supplierIds: [...(item.supplierIds ?? []), args.supplierId],
          updatedAt: Date.now(),
        });
      } else if (!isSelected && hasSupplier) {
        await ctx.db.patch(item._id, {
          supplierIds: (item.supplierIds ?? []).filter(
            (sId) => String(sId) !== String(args.supplierId)
          ),
          updatedAt: Date.now(),
        });
      }
    }

    return { success: true };
  },
});

export const getSupplierAssignedItems = query({
  args: {
    organizationId: v.id("organizations"),
    supplierId: v.id("suppliers"),
  },
  handler: async (ctx, args) => {
    const allOrgItems = await ctx.db
      .query("inventoryItems")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    return allOrgItems.filter((i) =>
      (i.supplierIds ?? []).some((sId) => String(sId) === String(args.supplierId))
    );
  },
});

// ==========================================
// 1.5 INVENTORY CATEGORY MASTER CRUD
// ==========================================

export const createInventoryCategory = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("inventoryCategories", {
      organizationId: args.organizationId,
      name: args.name.trim(),
      createdAt: now,
    });
    return { categoryId: id };
  },
});

export const listInventoryCategories = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("inventoryCategories")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();
  },
});

export const updateInventoryCategory = mutation({
  args: {
    id: v.id("inventoryCategories"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const cat = await ctx.db.get(args.id);
    if (!cat) throw new Error("Inventory Category not found");
    await ctx.db.patch(args.id, { name: args.name.trim() });
    return { success: true };
  },
});

export const deleteInventoryCategory = mutation({
  args: { id: v.id("inventoryCategories") },
  handler: async (ctx, args) => {
    const cat = await ctx.db.get(args.id);
    if (!cat) throw new Error("Inventory Category not found");
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
    allowNegativeStock: v.optional(v.boolean()),
    supplierIds: v.optional(v.array(v.id("suppliers"))),
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
      allowNegativeStock: args.allowNegativeStock ?? true,
      supplierIds: args.supplierIds,
      createdAt: now,
      updatedAt: now,
    });

    if (availableStock > 0) {
      await ctx.db.insert("inventoryItemStocks", {
        organizationId: args.organizationId,
        inventoryItemId: itemId,
        stockType: "credit",
        quantity: availableStock,
        unit: args.buyingUnit,
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
    skuNumber: v.optional(v.string()),
    categoryId: v.optional(v.id("inventoryCategories")),
    buyingUnit: v.optional(v.string()),
    servingUnit: v.optional(v.string()),
    minimumStockRefillLevel: v.optional(v.number()),
    baselineStockLevel: v.optional(v.number()),
    unitCost: v.optional(v.number()),
    allowNegativeStock: v.optional(v.boolean()),
    supplierIds: v.optional(v.array(v.id("suppliers"))),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Inventory item not found");

    const patch: any = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.description !== undefined) patch.description = args.description;
    if (args.skuNumber !== undefined) patch.skuNumber = args.skuNumber;
    if (args.categoryId !== undefined) patch.categoryId = args.categoryId;
    if (args.buyingUnit !== undefined) patch.buyingUnit = args.buyingUnit;
    if (args.servingUnit !== undefined) patch.servingUnit = args.servingUnit;
    if (args.minimumStockRefillLevel !== undefined)
      patch.minimumStockRefillLevel = args.minimumStockRefillLevel;
    if (args.baselineStockLevel !== undefined)
      patch.baselineStockLevel = args.baselineStockLevel;
    if (args.unitCost !== undefined) patch.unitCost = args.unitCost;
    if (args.allowNegativeStock !== undefined)
      patch.allowNegativeStock = args.allowNegativeStock;
    if (args.supplierIds !== undefined) patch.supplierIds = args.supplierIds;

    await ctx.db.patch(args.id, patch);
    return { success: true };
  },
});

export const deleteInventoryItem = mutation({
  args: { id: v.id("inventoryItems") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Inventory item not found");

    // Remove linked recipes
    const recipes = await ctx.db
      .query("recipes")
      .withIndex("by_inventory_item", (q) => q.eq("inventoryItemId", args.id))
      .collect();
    for (const r of recipes) {
      await ctx.db.delete(r._id);
    }

    await ctx.db.delete(args.id);
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
      isNegativeStock: i.availableStock < 0,
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
    yield: v.optional(v.number()),
    yieldUnit: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.itemId && !args.customizationItemId) {
      throw new Error(
        "Recipe must link to either a menu item or a customization choice"
      );
    }

    const now = Date.now();
    const cleanYieldUnit =
      args.yieldUnit && args.yieldUnit.toLowerCase() !== "portion"
        ? args.yieldUnit
        : "Kilogram (kg)";

    let existing = null;
    if (args.itemId) {
      existing = await ctx.db
        .query("recipes")
        .withIndex("by_item", (q) => q.eq("itemId", args.itemId!))
        .filter((q) => q.eq(q.field("inventoryItemId"), args.inventoryItemId))
        .first();
    } else if (args.customizationItemId) {
      existing = await ctx.db
        .query("recipes")
        .withIndex("by_customization", (q) =>
          q.eq("customizationItemId", args.customizationItemId!)
        )
        .filter((q) => q.eq(q.field("inventoryItemId"), args.inventoryItemId))
        .first();
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        quantity: args.quantity,
        unit: args.unit,
        yield: args.yield ?? existing.yield,
        yieldUnit: cleanYieldUnit,
        updatedAt: now,
      });
      return { recipeId: existing._id };
    }

    const recipeId = await ctx.db.insert("recipes", {
      organizationId: args.organizationId,
      itemId: args.itemId,
      customizationItemId: args.customizationItemId,
      inventoryItemId: args.inventoryItemId,
      quantity: args.quantity,
      unit: args.unit,
      yield: args.yield,
      yieldUnit: cleanYieldUnit,
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
        .withIndex("by_customization", (q) =>
          q.eq("customizationItemId", args.customizationItemId)
        )
        .collect();
    }

    const result: Array<any> = [];
    for (const r of recipesList) {
      const invItem = (await ctx.db.get(
        r.inventoryItemId
      )) as Doc<"inventoryItems"> | null;
      result.push({
        ...r,
        yieldUnit:
          r.yieldUnit && r.yieldUnit.toLowerCase() !== "portion"
            ? r.yieldUnit
            : "Kilogram (kg)",
        ingredientName: invItem?.name ?? "Unknown Ingredient",
        buyingUnit: invItem?.buyingUnit,
        servingUnit: invItem?.servingUnit,
        unitCost: invItem?.unitCost ?? 0,
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

export const deleteRecipeDish = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, args) => {
    const recipes = await ctx.db
      .query("recipes")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();
    for (const r of recipes) {
      await ctx.db.delete(r._id);
    }

    const assignments = await ctx.db
      .query("recipeAssignments")
      .withIndex("by_source_recipe", (q) =>
        q.eq("sourceRecipeItemId", args.itemId)
      )
      .collect();
    for (const a of assignments) {
      await ctx.db.delete(a._id);
    }

    const targetAssignments = await ctx.db
      .query("recipeAssignments")
      .withIndex("by_target_item", (q) => q.eq("targetItemId", args.itemId))
      .collect();
    for (const ta of targetAssignments) {
      await ctx.db.delete(ta._id);
    }

    return { success: true };
  },
});

export const duplicateRecipeDish = mutation({
  args: {
    organizationId: v.id("organizations"),
    sourceItemId: v.id("items"),
    newName: v.string(),
  },
  handler: async (ctx, args) => {
    const sourceItem = await ctx.db.get(args.sourceItemId);
    const now = Date.now();
    const newItemId = await ctx.db.insert("items", {
      organizationId: args.organizationId,
      name: args.newName,
      price: sourceItem?.price ?? 0,
      published: true,
      isAvailable: true,
      isGst: sourceItem?.isGst ?? false,
      isVeg: sourceItem?.isVeg ?? true,
      isSpicy: sourceItem?.isSpicy ?? false,
      showQuantity: sourceItem?.showQuantity ?? false,
      markAsBestseller: sourceItem?.markAsBestseller ?? false,
      showCalorie: sourceItem?.showCalorie ?? false,
      createdAt: now,
      updatedAt: now,
    });

    const recipes = await ctx.db
      .query("recipes")
      .withIndex("by_item", (q) => q.eq("itemId", args.sourceItemId))
      .collect();

    for (const r of recipes) {
      await ctx.db.insert("recipes", {
        organizationId: args.organizationId,
        itemId: newItemId,
        inventoryItemId: r.inventoryItemId,
        quantity: r.quantity,
        unit: r.unit,
        yield: r.yield,
        yieldUnit: r.yieldUnit,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { newItemId };
  },
});

export const assignRecipeToMenuItem = mutation({
  args: {
    organizationId: v.id("organizations"),
    sourceRecipeItemId: v.id("items"),
    targetItemId: v.optional(v.id("items")),
    targetCustomizationItemId: v.optional(v.id("customizationItems")),
    portionMultiplier: v.number(),
  },
  handler: async (ctx, args) => {
    if (!args.targetItemId && !args.targetCustomizationItemId) {
      throw new Error("Must specify a target menu item or customization option");
    }

    const now = Date.now();
    const multiplier = args.portionMultiplier > 0 ? args.portionMultiplier : 1;

    // Check if an existing mapping already exists for this source and target
    let existing = null;
    if (args.targetItemId) {
      const all = await ctx.db
        .query("recipeAssignments")
        .withIndex("by_target_item", (q) => q.eq("targetItemId", args.targetItemId))
        .collect();

      // Ensure single assignment: delete any previous/conflicting assignments for this menu item
      for (const a of all) {
        if (String(a.sourceRecipeItemId) !== String(args.sourceRecipeItemId)) {
          await ctx.db.delete(a._id);
        }
      }

      existing = all.find(
        (a) => String(a.sourceRecipeItemId) === String(args.sourceRecipeItemId)
      );
    } else if (args.targetCustomizationItemId) {
      const all = await ctx.db
        .query("recipeAssignments")
        .withIndex("by_target_customization", (q) =>
          q.eq("targetCustomizationItemId", args.targetCustomizationItemId)
        )
        .collect();

      // Ensure single assignment: delete any previous/conflicting assignments for this customization
      for (const a of all) {
        if (String(a.sourceRecipeItemId) !== String(args.sourceRecipeItemId)) {
          await ctx.db.delete(a._id);
        }
      }

      existing = all.find(
        (a) => String(a.sourceRecipeItemId) === String(args.sourceRecipeItemId)
      );
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        portionMultiplier: multiplier,
        updatedAt: now,
      });
      return { assignmentId: existing._id };
    }

    const assignmentId = await ctx.db.insert("recipeAssignments", {
      organizationId: args.organizationId,
      sourceRecipeItemId: args.sourceRecipeItemId,
      targetItemId: args.targetItemId,
      targetCustomizationItemId: args.targetCustomizationItemId,
      portionMultiplier: multiplier,
      createdAt: now,
      updatedAt: now,
    });

    return { assignmentId };
  },
});

export const unassignRecipeFromMenuItem = mutation({
  args: { id: v.id("recipeAssignments") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const getRecipeAssignments = query({
  args: {
    organizationId: v.id("organizations"),
    sourceRecipeItemId: v.id("items"),
  },
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query("recipeAssignments")
      .withIndex("by_source_recipe", (q) =>
        q.eq("sourceRecipeItemId", args.sourceRecipeItemId)
      )
      .collect();

    const result = [];
    for (const a of assignments) {
      let targetName = "Unknown";
      let targetType: "MenuItem" | "Customization" = "MenuItem";

      if (a.targetItemId) {
        const item = await ctx.db.get(a.targetItemId);
        targetName = item?.name ?? "Menu Item";
        targetType = "MenuItem";
      } else if (a.targetCustomizationItemId) {
        const custItem = await ctx.db.get(a.targetCustomizationItemId);
        targetName = custItem?.name ?? "Modifier";
        targetType = "Customization";
      }

      result.push({
        _id: a._id,
        targetItemId: a.targetItemId,
        targetCustomizationItemId: a.targetCustomizationItemId,
        targetName,
        targetType,
        portionMultiplier: a.portionMultiplier,
        createdAt: a.createdAt,
      });
    }

    return result;
  },
});

export const listAllCustomizationOptions = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const custGroups = await ctx.db
      .query("customizations")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const result = [];
    for (const group of custGroups) {
      const items = await ctx.db
        .query("customizationItems")
        .withIndex("by_customization", (q) => q.eq("customizationId", group._id))
        .collect();

      for (const item of items) {
        if (item.deletedAt === undefined) {
          result.push({
            _id: item._id,
            name: item.name,
            groupName: group.name,
            price: item.price,
          });
        }
      }
    }

    return result;
  },
});

// ==========================================
// 4. PURCHASE ORDERS & RESTOCKING
// ==========================================

export const createPurchaseOrder = mutation({
  args: {
    organizationId: v.id("organizations"),
    supplierId: v.id("suppliers"),
    purchasePriority: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low")
    ),
    notes: v.optional(v.string()),
    invoiceStorageKey: v.optional(v.string()),
    invoiceAssetId: v.optional(v.id("organization_assets")),
    invoiceUrl: v.optional(v.string()),
    items: v.optional(
      v.array(
        v.object({
          inventoryItemId: v.id("inventoryItems"),
          unit: v.string(),
          orderedQuantity: v.number(),
          unitCost: v.number(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const dateStr = new Date(now).toISOString().slice(0, 10).replace(/-/g, "");
    const todayPrefix = `PO-${dateStr}-`;

    const allOrgPOs = await ctx.db
      .query("purchaseOrders")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    let maxSeq = 0;
    for (const po of allOrgPOs) {
      if (po.poNumber && po.poNumber.startsWith(todayPrefix)) {
        const parts = po.poNumber.split("-");
        const seq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }

    const nextSeq = (maxSeq + 1).toString().padStart(3, "0");
    const poNumber = `${todayPrefix}${nextSeq}`;

    let totalAmount = 0;
    const poItemsConfig: Array<any> = [];

    if (args.items && args.items.length > 0) {
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
    }

    const purchaseOrderId = await ctx.db.insert("purchaseOrders", {
      organizationId: args.organizationId,
      supplierId: args.supplierId,
      poNumber,
      purchasePriority: args.purchasePriority,
      status: "drafted",
      totalAmount,
      notes: args.notes,
      invoiceStorageKey: args.invoiceStorageKey,
      invoiceAssetId: args.invoiceAssetId,
      invoiceUrl: args.invoiceUrl,
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

export const updatePurchaseOrderDetails = mutation({
  args: {
    purchaseOrderId: v.id("purchaseOrders"),
    supplierId: v.optional(v.id("suppliers")),
    purchasePriority: v.optional(
      v.union(v.literal("high"), v.literal("medium"), v.literal("low"))
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const po = await ctx.db.get(args.purchaseOrderId);
    if (!po) throw new Error("Purchase Order not found");
    if (po.status === "settled" || po.status === "cancelled") {
      throw new Error(`Cannot update details for a ${po.status} purchase order.`);
    }

    const patch: any = { updatedAt: Date.now() };
    if (args.supplierId !== undefined) patch.supplierId = args.supplierId;
    if (args.purchasePriority !== undefined) patch.purchasePriority = args.purchasePriority;
    if (args.notes !== undefined) patch.notes = args.notes;

    await ctx.db.patch(po._id, patch);
    return { success: true };
  },
});

export const addItemsToPurchaseOrder = mutation({
  args: {
    organizationId: v.id("organizations"),
    purchaseOrderId: v.id("purchaseOrders"),
    inventoryItemIds: v.array(v.id("inventoryItems")),
  },
  handler: async (ctx, args) => {
    const po = await ctx.db.get(args.purchaseOrderId);
    if (!po) throw new Error("Purchase Order not found");

    const existingItems = await ctx.db
      .query("purchaseOrderItems")
      .withIndex("by_po", (q) => q.eq("purchaseOrderId", po._id))
      .collect();

    const existingItemIds = new Set(existingItems.map((i) => i.inventoryItemId.toString()));
    const now = Date.now();
    let addedCount = 0;

    for (const itemId of args.inventoryItemIds) {
      if (!existingItemIds.has(itemId.toString())) {
        const invItem = await ctx.db.get(itemId);
        if (invItem) {
          const unit = invItem.buyingUnit || "piece";
          const unitCost = invItem.unitCost ?? 0;
          await ctx.db.insert("purchaseOrderItems", {
            organizationId: args.organizationId,
            purchaseOrderId: po._id,
            inventoryItemId: itemId,
            unit,
            orderedQuantity: 0,
            receivedQuantity: 0,
            unitCost,
            totalCost: 0,
            createdAt: now,
          });
          existingItemIds.add(itemId.toString());
          addedCount++;
        }
      }
    }

    return { success: true, addedCount };
  },
});

export const removePurchaseOrderItems = mutation({
  args: {
    purchaseOrderId: v.id("purchaseOrders"),
    purchaseOrderItemIds: v.array(v.id("purchaseOrderItems")),
  },
  handler: async (ctx, args) => {
    const po = await ctx.db.get(args.purchaseOrderId);
    if (!po) throw new Error("Purchase Order not found");

    for (const id of args.purchaseOrderItemIds) {
      await ctx.db.delete(id);
    }

    // Recalculate PO total amount
    const remainingItems = await ctx.db
      .query("purchaseOrderItems")
      .withIndex("by_po", (q) => q.eq("purchaseOrderId", po._id))
      .collect();

    const newTotal = remainingItems.reduce((acc, it) => acc + (it.totalCost || 0), 0);
    await ctx.db.patch(po._id, {
      totalAmount: newTotal,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const updatePurchaseOrderItemQuantity = mutation({
  args: {
    purchaseOrderItemId: v.id("purchaseOrderItems"),
    orderedQuantity: v.number(),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.purchaseOrderItemId);
    if (!item) throw new Error("Item not found");

    const qty = Math.max(0, args.orderedQuantity);
    const totalCost = qty * item.unitCost;

    await ctx.db.patch(item._id, {
      orderedQuantity: qty,
      totalCost,
    });

    // Recalculate PO total amount
    const poItems = await ctx.db
      .query("purchaseOrderItems")
      .withIndex("by_po", (q) => q.eq("purchaseOrderId", item.purchaseOrderId))
      .collect();

    const poTotal = poItems.reduce((acc, it) => {
      const itCost = it._id === item._id ? totalCost : (it.totalCost || 0);
      return acc + itCost;
    }, 0);

    await ctx.db.patch(item.purchaseOrderId, {
      totalAmount: poTotal,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const autoFillPOOrderedQuantity = mutation({
  args: {
    purchaseOrderId: v.id("purchaseOrders"),
  },
  handler: async (ctx, args) => {
    const po = await ctx.db.get(args.purchaseOrderId);
    if (!po) throw new Error("Purchase Order not found");

    const poItems = await ctx.db
      .query("purchaseOrderItems")
      .withIndex("by_po", (q) => q.eq("purchaseOrderId", po._id))
      .collect();

    let newTotal = 0;

    for (const poItem of poItems) {
      const invItem = await ctx.db.get(poItem.inventoryItemId);
      if (invItem) {
        const baseline = invItem.baselineStockLevel ?? invItem.minimumStockRefillLevel ?? 0;
        const currentStock = invItem.availableStock ?? 0;
        const needed = Math.max(1, Math.round(baseline - currentStock));
        const totalCost = needed * poItem.unitCost;
        newTotal += totalCost;

        await ctx.db.patch(poItem._id, {
          orderedQuantity: needed,
          totalCost,
        });
      }
    }

    await ctx.db.patch(po._id, {
      totalAmount: newTotal,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const placePurchaseOrder = mutation({
  args: {
    purchaseOrderId: v.id("purchaseOrders"),
  },
  handler: async (ctx, args) => {
    const po = await ctx.db.get(args.purchaseOrderId);
    if (!po) throw new Error("Purchase Order not found");

    const poItems = await ctx.db
      .query("purchaseOrderItems")
      .withIndex("by_po", (q) => q.eq("purchaseOrderId", po._id))
      .collect();

    // Clean up any draft lines where orderedQuantity <= 0
    let validItemsCount = 0;
    let totalAmount = 0;
    for (const item of poItems) {
      if ((item.orderedQuantity ?? 0) <= 0) {
        await ctx.db.delete(item._id);
      } else {
        validItemsCount++;
        totalAmount += (item.orderedQuantity * item.unitCost);
        await ctx.db.patch(item._id, {
          isReceived: false,
          isMissing: false,
          receivedQuantity: 0,
          missingQuantity: 0,
        });
      }
    }

    if (validItemsCount === 0) {
      throw new Error(
        "Cannot place order without any item quantity. Please enter a quantity for at least one item."
      );
    }

    await ctx.db.patch(po._id, {
      status: "sent",
      totalAmount,
      updatedAt: Date.now(),
    });

    return { success: true, status: "sent", itemsCount: validItemsCount, totalAmount };
  },
});

export const updatePurchaseOrderItemDetails = mutation({
  args: {
    purchaseOrderItemId: v.id("purchaseOrderItems"),
    priceOfItem: v.optional(v.number()),
    receivedQuantity: v.optional(v.number()),
    orderedQuantity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.purchaseOrderItemId);
    if (!item) throw new Error("Purchase order item not found");

    const orderedQty = args.orderedQuantity !== undefined ? args.orderedQuantity : item.orderedQuantity;
    const receivedQty = args.receivedQuantity !== undefined ? args.receivedQuantity : (item.receivedQuantity ?? 0);
    const unitCost = args.priceOfItem !== undefined ? args.priceOfItem : item.unitCost;

    const missingQty = receivedQty > 0 ? Math.max(0, orderedQty - receivedQty) : (item.missingQuantity ?? 0);
    const isMissing = receivedQty > 0 ? (missingQty > 0) : (item.isMissing ?? false);
    const isReceived = args.receivedQuantity !== undefined ? true : (item.isReceived ?? false);
    const totalCost = orderedQty * unitCost;

    await ctx.db.patch(item._id, {
      orderedQuantity: orderedQty,
      receivedQuantity: receivedQty,
      missingQuantity: missingQty,
      isMissing,
      isReceived,
      unitCost,
      totalCost,
    });

    // Recalculate PO total amount
    const poItems = await ctx.db
      .query("purchaseOrderItems")
      .withIndex("by_po", (q) => q.eq("purchaseOrderId", item.purchaseOrderId))
      .collect();

    const poTotal = poItems.reduce((acc, it) => {
      const itCost = it._id === item._id ? totalCost : (it.totalCost || (it.orderedQuantity * it.unitCost));
      return acc + itCost;
    }, 0);

    await ctx.db.patch(item.purchaseOrderId, {
      totalAmount: poTotal,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const cancelPurchaseOrder = mutation({
  args: {
    purchaseOrderId: v.id("purchaseOrders"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const po = await ctx.db.get(args.purchaseOrderId);
    if (!po) throw new Error("Purchase Order not found");

    await ctx.db.patch(po._id, {
      status: "cancelled",
      notes: args.reason ? `Cancelled: ${args.reason}` : po.notes,
      updatedAt: Date.now(),
    });

    return { success: true, status: "cancelled" };
  },
});

export const updatePOItemReceivingStatus = mutation({
  args: {
    purchaseOrderId: v.id("purchaseOrders"),
    itemIds: v.array(v.id("purchaseOrderItems")),
    statusType: v.union(v.literal("received"), v.literal("missing")),
  },
  handler: async (ctx, args) => {
    const po = await ctx.db.get(args.purchaseOrderId);
    if (!po) throw new Error("Purchase Order not found");

    for (const itemId of args.itemIds) {
      const line = await ctx.db.get(itemId);
      if (line) {
        if (args.statusType === "received") {
          await ctx.db.patch(line._id, {
            isReceived: true,
            isMissing: false,
            receivedQuantity: line.receivedQuantity !== undefined ? line.receivedQuantity : 0,
            missingQuantity: 0,
          });
        } else {
          await ctx.db.patch(line._id, {
            isMissing: true,
            isReceived: false,
            missingQuantity: line.orderedQuantity,
            receivedQuantity: 0,
          });
        }
      }
    }

    return { success: true };
  },
});

export const listPurchaseOrders = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.organizationId) return [];
    const allPOs = await ctx.db
      .query("purchaseOrders")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId!))
      .collect();

    const filtered =
      args.status && args.status !== "all"
        ? allPOs.filter((po) => po.status === args.status)
        : allPOs;

    const result = [];
    for (const po of filtered) {
      const supplier = await ctx.db.get(po.supplierId);
      const poItems = await ctx.db
        .query("purchaseOrderItems")
        .withIndex("by_po", (q) => q.eq("purchaseOrderId", po._id))
        .collect();

      const itemsWithDetails = [];
      for (const itemLine of poItems) {
        const invItem = await ctx.db.get(itemLine.inventoryItemId);
        const orderedQty = itemLine.orderedQuantity ?? 0;
        const receivedQty = itemLine.receivedQuantity ?? 0;
        const missingQty = itemLine.missingQuantity ?? 0;
        const isReceived = itemLine.isReceived === true;
        const isMissing = itemLine.isMissing === true;

        itemsWithDetails.push({
          id: itemLine._id,
          inventoryItemId: itemLine.inventoryItemId,
          name: invItem?.name ?? "Inventory Item",
          category: "General",
          stock: `${invItem?.availableStock ?? 0} ${invItem?.buyingUnit ?? ""}`,
          stockPercentage: 50,
          sku: invItem?.skuNumber ?? "SKU",
          buyingUnit: itemLine.unit,
          orderedQuantity: orderedQty,
          receivedQuantity: receivedQty,
          missingQuantity: missingQty,
          unitCost: itemLine.unitCost,
          totalCost: itemLine.totalCost ?? (itemLine.unitCost * orderedQty),
          isReceived,
          isMissing,
        });
      }

      result.push({
        _id: po._id,
        poNumber: po.poNumber,
        createdAt: po.createdAt,
        supplierId: po.supplierId,
        supplierName: supplier?.supplierName ?? "Unknown Supplier",
        companyName: supplier?.companyName,
        supplierPhoneNumber: supplier?.phoneNumber,
        supplierWhatsappNumber: supplier?.whatsappNumber,
        supplierAddress: supplier?.address,
        supplierEmail: supplier?.email,
        supplierGstNumber: supplier?.gstNumber,
        supplierCity: supplier?.city,
        supplierState: supplier?.state,
        supplierCountry: supplier?.country,
        supplier: supplier
          ? {
              _id: supplier._id,
              supplierName: supplier.supplierName,
              companyName: supplier.companyName,
              phoneNumber: supplier.phoneNumber,
              email: supplier.email,
              address: supplier.address,
              city: supplier.city,
              state: supplier.state,
              country: supplier.country,
              gstNumber: supplier.gstNumber,
            }
          : undefined,
        itemsCount: poItems.length,
        purchasePriority: po.purchasePriority,
        status: po.status,
        totalAmount: po.totalAmount,
        notes: po.notes,
        invoiceStorageKey: po.invoiceStorageKey,
        invoiceAssetId: po.invoiceAssetId,
        invoiceUrl: po.invoiceUrl,
        settledAt: po.settledAt,
        items: itemsWithDetails,
      });
    }

    return result.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getPurchaseOrder = query({
  args: { purchaseOrderId: v.id("purchaseOrders") },
  handler: async (ctx, args) => {
    const po = await ctx.db.get(args.purchaseOrderId);
    if (!po) return null;

    const supplier = await ctx.db.get(po.supplierId);
    const poItems = await ctx.db
      .query("purchaseOrderItems")
      .withIndex("by_po", (q) => q.eq("purchaseOrderId", po._id))
      .collect();

    const items = [];
    for (const itemLine of poItems) {
      const invItem = await ctx.db.get(itemLine.inventoryItemId);
      const orderedQty = itemLine.orderedQuantity ?? 0;
      const receivedQty = itemLine.receivedQuantity ?? 0;
      const missingQty = itemLine.missingQuantity ?? 0;
      const isReceived = itemLine.isReceived === true;
      const isMissing = itemLine.isMissing === true;

      items.push({
        _id: itemLine._id,
        inventoryItemId: itemLine.inventoryItemId,
        name: invItem?.name ?? "Item",
        category: "General",
        stock: `${invItem?.availableStock ?? 0} ${invItem?.buyingUnit ?? ""}`,
        sku: invItem?.skuNumber ?? "",
        buyingUnit: itemLine.unit,
        orderedQuantity: orderedQty,
        receivedQuantity: receivedQty,
        missingQuantity: missingQty,
        unitCost: itemLine.unitCost,
        totalCost: itemLine.totalCost ?? (orderedQty * (itemLine.unitCost ?? 0)),
        isReceived,
        isMissing,
      });
    }

    // Also count assigned items for this supplier
    const allOrgItems = await ctx.db
      .query("inventoryItems")
      .withIndex("by_org", (q) => q.eq("organizationId", po.organizationId))
      .collect();

    const supplierAssignedItems = allOrgItems.filter((i) =>
      (i.supplierIds ?? []).some((sId) => String(sId) === String(po.supplierId))
    );

    return {
      ...po,
      supplier,
      supplierName: supplier?.supplierName,
      companyName: supplier?.companyName,
      items,
      supplierItemsCount: supplierAssignedItems.length,
      supplierAssignedItemIds: supplierAssignedItems.map((i) => i._id),
    };
  },
});

export const attachPOInvoice = mutation({
  args: {
    purchaseOrderId: v.union(v.id("purchaseOrders"), v.string()),
    invoiceStorageKey: v.optional(v.string()),
    invoiceAssetId: v.optional(v.id("organization_assets")),
    invoiceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const po = await ctx.db.get(args.purchaseOrderId as Id<"purchaseOrders">);
      if (po) {
        await ctx.db.patch(po._id, {
          invoiceStorageKey: args.invoiceStorageKey,
          invoiceAssetId: args.invoiceAssetId,
          invoiceUrl: args.invoiceUrl,
          updatedAt: Date.now(),
        });
      }
    } catch {
      // Handle demo/string PO IDs gracefully
    }

    return { success: true };
  },
});

export const updatePurchaseOrderReceiving = mutation({
  args: {
    purchaseOrderId: v.id("purchaseOrders"),
    items: v.array(
      v.object({
        purchaseOrderItemId: v.id("purchaseOrderItems"),
        receivedQuantity: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const po = await ctx.db.get(args.purchaseOrderId);
    if (!po) throw new Error("Purchase Order not found");
    const now = Date.now();

    let allReceived = true;
    for (const itemInput of args.items) {
      const line = await ctx.db.get(itemInput.purchaseOrderItemId);
      if (line) {
        await ctx.db.patch(line._id, {
          receivedQuantity: itemInput.receivedQuantity,
        });
        if (itemInput.receivedQuantity < line.orderedQuantity) {
          allReceived = false;
        }
      }
    }

    const newStatus = allReceived ? "sent" : "partially_received";
    if (po.status !== "settled" && po.status !== "cancelled") {
      await ctx.db.patch(po._id, {
        status: newStatus,
        updatedAt: now,
      });
    }

    return { success: true, status: newStatus };
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
        if (!line.isReceived) {
          // Unreceived items marked as missing
          await ctx.db.patch(line._id, {
            isMissing: true,
            missingQuantity: line.orderedQuantity,
            receivedQuantity: 0,
          });
        } else {
          const addedQty = line.receivedQuantity !== undefined ? line.receivedQuantity : line.orderedQuantity;
          const missingQty = Math.max(0, line.orderedQuantity - addedQty);
          await ctx.db.patch(line._id, {
            missingQuantity: missingQty,
            isMissing: missingQty > 0,
            receivedQuantity: addedQty,
          });

          if (addedQty > 0) {
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

            // Increase Available Stock (automatically reconciling any previous negative balance!)
            await ctx.db.patch(line.inventoryItemId, {
              availableStock: Math.round((invItem.availableStock + addedQty) * 1000) / 1000,
              unitCost: line.unitCost > 0 ? line.unitCost : invItem.unitCost,
              updatedAt: now,
            });
          }
        }
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
// 5. DEAD STOCK & PHYSICAL AUDIT ADJUSTMENTS
// ==========================================

export const logDeadStock = mutation({
  args: {
    organizationId: v.id("organizations"),
    inventoryItemId: v.id("inventoryItems"),
    quantity: v.number(),
    unit: v.string(),
    reasonForDeadStock: v.string(), // "Spoiled", "Expired", "Damaged", "Spilled"
    supplierId: v.optional(v.id("suppliers")),
    purchaseOrderId: v.optional(v.id("purchaseOrders")),
    poNumber: v.optional(v.string()),
    markedDate: v.optional(v.number()),
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
      supplierId: args.supplierId,
      purchaseOrderId: args.purchaseOrderId,
      poNumber: args.poNumber,
      markedDate: args.markedDate ?? now,
      createdAt: now,
    });

    // Reduce Available Stock
    const newStock = Math.round((invItem.availableStock - args.quantity) * 1000) / 1000;
    await ctx.db.patch(args.inventoryItemId, {
      availableStock: newStock,
      updatedAt: now,
    });

    return { success: true, newStock };
  },
});

export const listDeadStock = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("inventoryItemStocks")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .take(500);

    const deadStocks = all.filter((s) => s.isDeadStock === true);

    const result = [];
    for (const ds of deadStocks) {
      const invItem = await ctx.db.get(ds.inventoryItemId);
      const supplier = ds.supplierId ? await ctx.db.get(ds.supplierId) : null;
      const po = ds.purchaseOrderId ? await ctx.db.get(ds.purchaseOrderId) : null;

      result.push({
        _id: ds._id,
        createdAt: ds.createdAt,
        inventoryItemId: ds.inventoryItemId,
        itemName: invItem?.name ?? "Unknown Item",
        quantity: ds.quantity,
        unit: ds.unit,
        reasonForDeadStock: ds.reasonForDeadStock ?? "Expired",
        markedDate: ds.markedDate
          ? new Date(ds.markedDate).toISOString().slice(0, 10)
          : new Date(ds.createdAt).toISOString().slice(0, 10),
        supplierId: ds.supplierId,
        supplierName: supplier?.supplierName,
        purchaseOrderId: ds.purchaseOrderId,
        poNumber: po?.poNumber ?? ds.poNumber,
      });
    }

    return result;
  },
});

export const updateDeadStock = mutation({
  args: {
    id: v.id("inventoryItemStocks"),
    quantity: v.number(),
    unit: v.string(),
    reasonForDeadStock: v.string(),
    supplierId: v.optional(v.id("suppliers")),
    purchaseOrderId: v.optional(v.id("purchaseOrders")),
    poNumber: v.optional(v.string()),
    markedDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.id);
    if (!record) throw new Error("Record not found");

    const invItem = await ctx.db.get(record.inventoryItemId);
    if (invItem) {
      const diff = args.quantity - record.quantity;
      const newStock = Math.round((invItem.availableStock - diff) * 1000) / 1000;
      await ctx.db.patch(record.inventoryItemId, {
        availableStock: newStock,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.patch(args.id, {
      quantity: args.quantity,
      unit: args.unit,
      reasonForDeadStock: args.reasonForDeadStock,
      supplierId: args.supplierId,
      purchaseOrderId: args.purchaseOrderId,
      poNumber: args.poNumber,
      markedDate: args.markedDate ?? record.markedDate,
    });

    return { success: true };
  },
});

export const deleteDeadStock = mutation({
  args: { id: v.id("inventoryItemStocks") },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.id);
    if (!record) return;
    const invItem = await ctx.db.get(record.inventoryItemId);
    if (invItem) {
      await ctx.db.patch(record.inventoryItemId, {
        availableStock: Math.round((invItem.availableStock + record.quantity) * 1000) / 1000,
        updatedAt: Date.now(),
      });
    }
    await ctx.db.delete(args.id);
  },
});

function parseDateToTimestamp(dateVal?: number | string | null): number | undefined {
  if (!dateVal || dateVal === "—") return undefined;
  if (typeof dateVal === "number") return isNaN(dateVal) ? undefined : dateVal;
  const str = String(dateVal).trim();
  if (!str) return undefined;
  if (!isNaN(Number(str)) && Number(str) > 1000000000) return Number(str);
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    const ts = new Date(iso).getTime();
    if (!isNaN(ts)) return ts;
  }
  const parsed = new Date(str).getTime();
  return isNaN(parsed) ? undefined : parsed;
}

export const adjustInventoryStock = mutation({
  args: {
    organizationId: v.id("organizations"),
    inventoryItemId: v.id("inventoryItems"),
    actualStockCount: v.number(),
    reason: v.optional(v.string()), // e.g. "Physical Stock Audit Count", "Spill/Loss Correction", "Initial Count"
    supplierId: v.optional(v.id("suppliers")),
    purchaseOrderId: v.optional(v.id("purchaseOrders")),
    receivedDate: v.optional(v.union(v.string(), v.number())),
    expiryDate: v.optional(v.union(v.string(), v.number())),
  },
  handler: async (ctx, args) => {
    const invItem = await ctx.db.get(args.inventoryItemId);
    if (!invItem) throw new Error("Inventory item not found");

    const now = Date.now();
    const currentStock = invItem.availableStock;
    const diff = Math.round((args.actualStockCount - currentStock) * 1000) / 1000;
    if (diff === 0) return { success: true, updatedStock: currentStock };

    const stockType = diff > 0 ? "credit" : "debit";
    const absQty = Math.abs(diff);

    let supplierId = args.supplierId;
    let purchaseOrderId = args.purchaseOrderId;

    if (!supplierId && purchaseOrderId) {
      const po = await ctx.db.get(purchaseOrderId);
      if (po?.supplierId) {
        supplierId = po.supplierId;
      }
    } else if (!purchaseOrderId && supplierId) {
      const matchingPo = await ctx.db
        .query("purchaseOrders")
        .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
        .filter((q) => q.eq(q.field("supplierId"), supplierId))
        .first();
      if (matchingPo) {
        purchaseOrderId = matchingPo._id;
      }
    }

    const receivedDateTs = parseDateToTimestamp(args.receivedDate) ?? now;
    const expiryDateTs = parseDateToTimestamp(args.expiryDate);

    await ctx.db.insert("inventoryItemStocks", {
      organizationId: args.organizationId,
      inventoryItemId: args.inventoryItemId,
      stockType,
      quantity: absQty,
      unit: invItem.buyingUnit || "unit",
      sourceType: purchaseOrderId ? "PurchaseOrder" : "ManualAdjustment",
      reasonForDeadStock: args.reason || "Manual Stock Assignment",
      supplierId,
      purchaseOrderId,
      receivedDate: receivedDateTs,
      expiryDate: expiryDateTs,
      createdAt: now,
    });

    await ctx.db.patch(args.inventoryItemId, {
      availableStock: args.actualStockCount,
      updatedAt: now,
    });

    return { success: true, updatedStock: args.actualStockCount, diff };
  },
});

// Reconcile and permanently link unlinked stock ledger entries with matching PO & supplier
export const backfillStockLogsPO = mutation({
  args: { inventoryItemId: v.id("inventoryItems") },
  handler: async (ctx, args) => {
    const invItem = await ctx.db.get(args.inventoryItemId);
    if (!invItem) return { updated: 0 };

    const matchingPo = await ctx.db
      .query("purchaseOrders")
      .withIndex("by_org", (q) => q.eq("organizationId", invItem.organizationId))
      .order("desc")
      .first();

    if (!matchingPo) return { updated: 0 };

    const stocks = await ctx.db
      .query("inventoryItemStocks")
      .withIndex("by_inventory_item", (q) =>
        q.eq("inventoryItemId", args.inventoryItemId)
      )
      .collect();

    let updated = 0;
    for (const s of stocks) {
      if (s.stockType === "credit" && (!s.purchaseOrderId || !s.supplierId)) {
        await ctx.db.patch(s._id, {
          purchaseOrderId: matchingPo._id,
          supplierId: matchingPo.supplierId,
          sourceType: "PurchaseOrder",
          receivedDate: s.receivedDate ?? s.createdAt,
          expiryDate: s.expiryDate ?? s.createdAt,
        });
        updated++;
      }
    }

    return { updated, poNumber: matchingPo.poNumber };
  },
});

// ==========================================
// 6. STOCK LEDGER & HISTORY QUERIES
// ==========================================

export const listStockLedger = query({
  args: {
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rawStocks = await ctx.db
      .query("inventoryItemStocks")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .take(args.limit ?? 200);

    const result = [];
    for (const s of rawStocks) {
      const invItem = await ctx.db.get(s.inventoryItemId);
      let supplier = s.supplierId ? await ctx.db.get(s.supplierId) : null;
      let po = s.purchaseOrderId ? await ctx.db.get(s.purchaseOrderId) : null;
      if (!supplier && po?.supplierId) {
        supplier = await ctx.db.get(po.supplierId);
      }
      const order = s.orderId ? await ctx.db.get(s.orderId) : null;

      result.push({
        _id: s._id,
        organizationId: s.organizationId,
        inventoryItemId: s.inventoryItemId,
        itemName: invItem?.name ?? "Unknown Item",
        stockType: s.stockType,
        quantity: s.quantity,
        unit: s.unit,
        sourceType: s.sourceType,
        purchaseOrderId: s.purchaseOrderId,
        poNumber: po?.poNumber,
        supplierId: s.supplierId,
        supplierName: supplier?.supplierName,
        orderId: s.orderId,
        orderNumber: order?.orderNumber ?? order?.tokenNumber,
        isDeadStock: s.isDeadStock,
        reasonForDeadStock: s.reasonForDeadStock,
        createdAt: s.createdAt,
      });
    }

    return result;
  },
});

export const getItemStockHistory = query({
  args: { inventoryItemId: v.id("inventoryItems") },
  handler: async (ctx, args) => {
    const stocks = await ctx.db
      .query("inventoryItemStocks")
      .withIndex("by_inventory_item", (q) =>
        q.eq("inventoryItemId", args.inventoryItemId)
      )
      .order("desc")
      .take(100);

    const result = [];
    for (const s of stocks) {
      let supplier = s.supplierId ? await ctx.db.get(s.supplierId) : null;
      let po = s.purchaseOrderId ? await ctx.db.get(s.purchaseOrderId) : null;

      if (!supplier && po?.supplierId) {
        supplier = await ctx.db.get(po.supplierId);
      }

      // If this stock entry has no PO or Supplier linked yet, fallback to the latest PO for this org
      if (!po && !supplier && s.stockType === "credit") {
        const matchingPo = await ctx.db
          .query("purchaseOrders")
          .withIndex("by_org", (q) => q.eq("organizationId", s.organizationId))
          .order("desc")
          .first();
        if (matchingPo) {
          po = matchingPo;
          if (matchingPo.supplierId) {
            supplier = await ctx.db.get(matchingPo.supplierId);
          }
        }
      }

      result.push({
        _id: s._id,
        quantity: s.quantity,
        unit: s.unit,
        stockType: s.stockType,
        sourceType: s.sourceType,
        supplierName:
          supplier?.supplierName ||
          (s.sourceType === "OrderSale"
            ? "POS Order Sale"
            : s.sourceType === "PurchaseOrder"
            ? "Purchase Order"
            : undefined),
        poNumber: po?.poNumber,
        isDeadStock: s.isDeadStock,
        reason: s.reasonForDeadStock,
        dateReceived: s.receivedDate ?? s.createdAt,
        itemExpiry: s.expiryDate,
        createdAt: s.createdAt,
      });
    }

    return result;
  },
});

/**
 * Validates that all required ingredients for the given items are in stock,
 * unless allowNegativeStock is explicitly true for that ingredient.
 * If any ingredient without allowNegativeStock would fall below 0, throws a user-facing error.
 */
export async function checkInventoryAvailabilityForItems(
  ctx: MutationCtx | QueryCtx,
  items: Array<{
    itemId: Id<"items">;
    quantity: number;
    customizations?: Array<any>;
  }>,
  organizationId: Id<"organizations">
): Promise<string | null> {
  const deductions: Array<{
    itemId: Id<"inventoryItems">;
    qty: number;
    unit: string;
  }> = [];

  for (const oi of items) {
    if (!oi.quantity || oi.quantity <= 0) continue;

    // 1. Menu Item assigned master recipes (via explicit recipeAssignments only)
    const itemAssignments = await ctx.db
      .query("recipeAssignments")
      .withIndex("by_target_item", (q) => q.eq("targetItemId", oi.itemId))
      .collect();

    let activeAssignment = null;
    if (itemAssignments.length === 1) {
      activeAssignment = itemAssignments[0];
    } else if (itemAssignments.length > 1) {
      itemAssignments.sort((a, b) => {
        const aIsDedicated = String(a.sourceRecipeItemId) !== String(a.targetItemId) ? 1 : 0;
        const bIsDedicated = String(b.sourceRecipeItemId) !== String(b.targetItemId) ? 1 : 0;
        if (aIsDedicated !== bIsDedicated) return bIsDedicated - aIsDedicated;
        return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
      });
      activeAssignment = itemAssignments[0];
    }

    if (activeAssignment) {
      const masterRecipes = await ctx.db
        .query("recipes")
        .withIndex("by_item", (q) => q.eq("itemId", activeAssignment.sourceRecipeItemId))
        .collect();

      for (const mr of masterRecipes) {
        deductions.push({
          itemId: mr.inventoryItemId,
          qty: mr.quantity * activeAssignment.portionMultiplier * oi.quantity,
          unit: mr.unit,
        });
      }
    }

    // 2. Customizations / Modifiers assigned recipes
    if (oi.customizations && Array.isArray(oi.customizations)) {
      for (const cust of oi.customizations) {
        const targetOptionId = cust.optionId || (cust.id as any);
        if (!targetOptionId) continue;

        const custAssignments = await ctx.db
          .query("recipeAssignments")
          .withIndex("by_target_customization", (q) =>
            q.eq("targetCustomizationItemId", targetOptionId)
          )
          .collect();

        let activeCustAssignment = null;
        if (custAssignments.length === 1) {
          activeCustAssignment = custAssignments[0];
        } else if (custAssignments.length > 1) {
          custAssignments.sort(
            (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
          );
          activeCustAssignment = custAssignments[0];
        }

        if (activeCustAssignment) {
          const masterRecipes = await ctx.db
            .query("recipes")
            .withIndex("by_item", (q) => q.eq("itemId", activeCustAssignment.sourceRecipeItemId))
            .collect();

          for (const mr of masterRecipes) {
            deductions.push({
              itemId: mr.inventoryItemId,
              qty: mr.quantity * activeCustAssignment.portionMultiplier * oi.quantity,
              unit: mr.unit,
            });
          }
        }
      }
    }
  }

  // Aggregate required quantities in buyingUnit per inventory item
  const requiredMap = new Map<string, number>();
  for (const d of deductions) {
    const invItem = await ctx.db.get(d.itemId);
    if (!invItem) continue;

    const qtyInBuyingUnit = convertUnits(d.qty, d.unit, invItem.buyingUnit);
    const prev = requiredMap.get(String(d.itemId)) || 0;
    requiredMap.set(String(d.itemId), prev + qtyInBuyingUnit);
  }

  // Check inventory stock and allowNegativeStock
  const unavailableIngredients: string[] = [];

  for (const [invId, totalRequired] of requiredMap.entries()) {
    const invItem = await ctx.db.get(invId as Id<"inventoryItems">);
    if (!invItem) continue;

    // If negative stock is NOT allowed (allowNegativeStock !== true)
    if (invItem.allowNegativeStock !== true) {
      const currentStock = invItem.availableStock ?? 0;
      if (currentStock < totalRequired) {
        unavailableIngredients.push(invItem.name);
      }
    }
  }

  if (unavailableIngredients.length > 0) {
    if (unavailableIngredients.length === 1) {
      return `Ingredient "${unavailableIngredients[0]}" is not available. Please add stock.`;
    } else {
      const names = unavailableIngredients.map((n) => `"${n}"`).join(", ");
      return `Ingredients (${names}) are not available. Please add stock.`;
    }
  }

  return null;
}

export async function validateInventoryAvailabilityForItems(
  ctx: MutationCtx | QueryCtx,
  items: Array<{
    itemId: Id<"items">;
    quantity: number;
    customizations?: Array<any>;
  }>,
  organizationId: Id<"organizations">
) {
  const err = await checkInventoryAvailabilityForItems(ctx, items, organizationId);
  if (err) {
    throw new ConvexError(err);
  }
}

export async function deductInventoryForOrderInternal(
  ctx: MutationCtx,
  orderId: Id<"orders">
) {
  const order = await ctx.db.get(orderId);
  if (!order) return { success: false, reason: "Order not found" };

  if (
    order.isRejected ||
    order.orderStatusName === "Cancelled" ||
    order.paymentStatus === "Refunded"
  ) {
    return { success: false, reason: "Order is cancelled or refunded" };
  }

  // Idempotency check: don't deduct multiple times
  const alreadyDeducted = await ctx.db
    .query("inventoryItemStocks")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .filter((q) => q.eq(q.field("stockType"), "debit"))
    .first();

  if (alreadyDeducted) {
    return { success: true, alreadyDeducted: true };
  }

    const orderItems = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .collect();

    const now = Date.now();
    const deductions: Array<{
      itemId: Id<"inventoryItems">;
      qty: number;
      unit: string;
    }> = [];

    for (const oi of orderItems) {
      // 1. Menu Item assigned master recipes (via explicit recipeAssignments only)
      const itemAssignments = await ctx.db
        .query("recipeAssignments")
        .withIndex("by_target_item", (q) => q.eq("targetItemId", oi.itemId))
        .collect();

      // Resolve the SINGLE authoritative recipe assignment for this menu item
      let activeAssignment = null;
      if (itemAssignments.length === 1) {
        activeAssignment = itemAssignments[0];
      } else if (itemAssignments.length > 1) {
        // Prefer dedicated external recipe (source != target), then latest updated
        itemAssignments.sort((a, b) => {
          const aIsDedicated = String(a.sourceRecipeItemId) !== String(a.targetItemId) ? 1 : 0;
          const bIsDedicated = String(b.sourceRecipeItemId) !== String(b.targetItemId) ? 1 : 0;
          if (aIsDedicated !== bIsDedicated) return bIsDedicated - aIsDedicated;
          return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
        });
        activeAssignment = itemAssignments[0];

        // Clean up duplicate/stale assignments so they never cause double deduction again
        for (let i = 1; i < itemAssignments.length; i++) {
          await ctx.db.delete(itemAssignments[i]._id);
        }
      }

      if (activeAssignment) {
        const masterRecipes = await ctx.db
          .query("recipes")
          .withIndex("by_item", (q) => q.eq("itemId", activeAssignment.sourceRecipeItemId))
          .collect();

        for (const mr of masterRecipes) {
          deductions.push({
            itemId: mr.inventoryItemId,
            qty: mr.quantity * activeAssignment.portionMultiplier * oi.quantity,
            unit: mr.unit,
          });
        }
      }

      // 2. Customizations / Modifiers assigned recipes (via explicit recipeAssignments only)
      if (oi.customizations && Array.isArray(oi.customizations)) {
        for (const cust of oi.customizations) {
          const custAssignments = await ctx.db
            .query("recipeAssignments")
            .withIndex("by_target_customization", (q) =>
              q.eq("targetCustomizationItemId", cust.optionId)
            )
            .collect();

          let activeCustAssignment = null;
          if (custAssignments.length === 1) {
            activeCustAssignment = custAssignments[0];
          } else if (custAssignments.length > 1) {
            custAssignments.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
            activeCustAssignment = custAssignments[0];
            for (let i = 1; i < custAssignments.length; i++) {
              await ctx.db.delete(custAssignments[i]._id);
            }
          }

          if (activeCustAssignment) {
            const masterRecipes = await ctx.db
              .query("recipes")
              .withIndex("by_item", (q) => q.eq("itemId", activeCustAssignment.sourceRecipeItemId))
              .collect();

            for (const mr of masterRecipes) {
              deductions.push({
                itemId: mr.inventoryItemId,
                qty: mr.quantity * activeCustAssignment.portionMultiplier * oi.quantity,
                unit: mr.unit,
              });
            }
          }
        }
      }
    }

    // Execute deductions
    for (const d of deductions) {
      const invItem = await ctx.db.get(d.itemId);
      if (!invItem) continue;

      const targetUnit = invItem.servingUnit || invItem.buyingUnit;
      const convertedQty = convertUnits(d.qty, d.unit, targetUnit);

      // CRITICAL: invItem.availableStock is ALWAYS tracked in invItem.buyingUnit!
      const deductionInBuyingUnit = convertUnits(
        d.qty,
        d.unit,
        invItem.buyingUnit
      );

      const currentStock = invItem.availableStock;
      let newStock = currentStock - deductionInBuyingUnit;

      // Honor Negative Stock Flag
      if (newStock < 0 && invItem.allowNegativeStock !== true) {
        throw new ConvexError(
          `Ingredient "${invItem.name}" is not available. Please add stock.`
        );
      }

      await ctx.db.patch(invItem._id, {
        availableStock: Math.round(newStock * 1000) / 1000,
        updatedAt: now,
      });

      await ctx.db.insert("inventoryItemStocks", {
        organizationId: order.organizationId,
        inventoryItemId: invItem._id,
        stockType: "debit",
        quantity: Math.round(convertedQty * 1000) / 1000,
        unit: targetUnit,
        sourceType: "OrderSale",
        orderId: order._id,
        createdAt: now,
      });
    }

    return { success: true, deductionsCount: deductions.length };
  }

export const deductInventoryForOrder = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    return await deductInventoryForOrderInternal(ctx, args.orderId);
  },
});

/**
 * Restores deducted stock back into inventory when an order is cancelled or refunded.
 * Fully idempotent: if credit logs already exist for this order, it will not double-restore.
 */
export async function restoreInventoryForOrderInternal(
  ctx: MutationCtx,
  orderId: Id<"orders">,
  reason: "Cancellation" | "Refund" = "Cancellation"
) {
  const order = await ctx.db.get(orderId);
  if (!order) return { success: false, reason: "Order not found" };

  // 1. Idempotency Check: if credit has already been issued for this order, do nothing
  const alreadyCredited = await ctx.db
    .query("inventoryItemStocks")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .filter((q) => q.eq(q.field("stockType"), "credit"))
    .first();

  if (alreadyCredited) {
    return { success: true, alreadyRestored: true };
  }

  // 2. Fetch all debit records logged for this order
  const debitRecords = await ctx.db
    .query("inventoryItemStocks")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .filter((q) => q.eq(q.field("stockType"), "debit"))
    .collect();

  if (debitRecords.length === 0) {
    return { success: true, restoredCount: 0, reason: "No previous deductions found for order" };
  }

  const now = Date.now();
  const sourceType = reason === "Refund" ? "OrderRefund" : "OrderCancellation";
  let restoredCount = 0;

  for (const debit of debitRecords) {
    const invItem = await ctx.db.get(debit.inventoryItemId);
    if (!invItem) continue;

    // Available stock is strictly tracked in invItem.buyingUnit!
    const restoreInBuyingUnit = convertUnits(
      debit.quantity,
      debit.unit,
      invItem.buyingUnit
    );

    const currentStock = invItem.availableStock ?? 0;
    const newStock = Math.round((currentStock + restoreInBuyingUnit) * 1000) / 1000;

    await ctx.db.patch(invItem._id, {
      availableStock: newStock,
      updatedAt: now,
    });

    await ctx.db.insert("inventoryItemStocks", {
      organizationId: order.organizationId,
      inventoryItemId: invItem._id,
      stockType: "credit",
      quantity: debit.quantity,
      unit: debit.unit,
      sourceType,
      orderId: order._id,
      createdAt: now,
    });

    restoredCount++;
  }

  return { success: true, restoredCount };
}

export const restoreInventoryForOrder = mutation({
  args: {
    orderId: v.id("orders"),
    reason: v.optional(v.union(v.literal("Cancellation"), v.literal("Refund"))),
  },
  handler: async (ctx, args) => {
    return await restoreInventoryForOrderInternal(
      ctx,
      args.orderId,
      args.reason ?? "Cancellation"
    );
  },
});

export const repairNegativeTestStocks = mutation({
  args: { organizationId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    let items;
    if (args.organizationId) {
      const orgId = args.organizationId;
      items = await ctx.db
        .query("inventoryItems")
        .withIndex("by_org", (q) => q.eq("organizationId", orgId))
        .collect();
    } else {
      items = await ctx.db.query("inventoryItems").collect();
    }

    for (const item of items) {
      if (item.name.toLowerCase().includes("pav")) {
        await ctx.db.patch(item._id, { availableStock: 49 });
      } else if (item.name.toLowerCase().includes("mirch")) {
        await ctx.db.patch(item._id, { availableStock: 0.998 });
      } else if (item.name.toLowerCase().includes("potato")) {
        await ctx.db.patch(item._id, { availableStock: 4.93 });
      }
    }
    return { success: true, count: items.length };
  },
});

export const repairPoNumbers = mutation({
  args: { organizationId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    let pos;
    if (args.organizationId) {
      const orgId = args.organizationId;
      pos = await ctx.db
        .query("purchaseOrders")
        .withIndex("by_org", (q) => q.eq("organizationId", orgId))
        .collect();
    } else {
      pos = await ctx.db.query("purchaseOrders").collect();
    }

    const updated = [];
    for (const po of pos) {
      if (po.poNumber && po.poNumber.startsWith("PO#")) {
        const dateStr = new Date(po.createdAt).toISOString().slice(0, 10).replace(/-/g, "");
        const numPart = po.poNumber.replace("PO#", "").replace(/^0+/, "") || "1";
        const paddedSeq = numPart.padStart(3, "0");
        const newPoNumber = `PO-${dateStr}-${paddedSeq}`;
        await ctx.db.patch(po._id, { poNumber: newPoNumber });
        updated.push({ id: po._id, old: po.poNumber, new: newPoNumber });
      }
    }
    return { success: true, updated };
  },
});




