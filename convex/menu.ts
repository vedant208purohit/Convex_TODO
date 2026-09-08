import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ==========================================
// MENU MANAGEMENT MUTATIONS & QUERIES
// ==========================================

export const listMenus = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const menus = await ctx.db
      .query("menus")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    return menus.sort((a, b) => a.position - b.position);
  },
});

export const getMenu = query({
  args: { id: v.id("menus") },
  handler: async (ctx, args) => {
    const menu = await ctx.db.get(args.id);
    if (!menu || menu.deletedAt !== undefined) return null;
    return menu;
  },
});

export const createMenu = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    position: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existingMenus = await ctx.db
      .query("menus")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const isFirstMenu = existingMenus.length === 0;
    const shouldBeDefault = args.isDefault ?? isFirstMenu;

    if (shouldBeDefault && !isFirstMenu) {
      for (const menu of existingMenus) {
        if (menu.isDefault) {
          await ctx.db.patch(menu._id, { isDefault: false, updatedAt: Date.now() });
        }
      }
    }

    const now = Date.now();
    const position = args.position ?? existingMenus.length;

    return await ctx.db.insert("menus", {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      isDefault: shouldBeDefault,
      isActive: args.isActive ?? true,
      position,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const setDefaultMenu = mutation({
  args: {
    id: v.id("menus"),
  },
  handler: async (ctx, args) => {
    const targetMenu = await ctx.db.get(args.id);
    if (!targetMenu || targetMenu.deletedAt !== undefined) {
      throw new Error("Menu not found");
    }

    const existingMenus = await ctx.db
      .query("menus")
      .withIndex("by_org", (q) => q.eq("organizationId", targetMenu.organizationId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const now = Date.now();
    for (const menu of existingMenus) {
      if (menu._id === args.id) {
        await ctx.db.patch(menu._id, { isDefault: true, isActive: true, updatedAt: now });
      } else if (menu.isDefault) {
        await ctx.db.patch(menu._id, { isDefault: false, updatedAt: now });
      }
    }

    return { success: true };
  },
});

export const updateMenu = mutation({
  args: {
    id: v.id("menus"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    position: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Menu not found");
    }

    const cleanUpdates: Record<string, any> = { updatedAt: Date.now() };
    if (updates.name !== undefined) cleanUpdates.name = updates.name;
    if (updates.description !== undefined) cleanUpdates.description = updates.description;
    if (updates.isActive !== undefined) cleanUpdates.isActive = updates.isActive;
    if (updates.position !== undefined) cleanUpdates.position = updates.position;

    await ctx.db.patch(id, cleanUpdates);
    return await ctx.db.get(id);
  },
});

export const deleteMenu = mutation({
  args: { id: v.id("menus") },
  handler: async (ctx, args) => {
    const menu = await ctx.db.get(args.id);
    if (!menu) throw new Error("Menu not found");

    const now = Date.now();
    await ctx.db.patch(args.id, { deletedAt: now, updatedAt: now });

    // Soft delete all categories under this menu
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_menu", (q) => q.eq("menuId", args.id))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    for (const cat of categories) {
      await ctx.db.patch(cat._id, { deletedAt: now, updatedAt: now });

      const catItems = await ctx.db
        .query("categoryItems")
        .withIndex("by_category", (q) => q.eq("categoryId", cat._id))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      for (const ci of catItems) {
        await ctx.db.patch(ci._id, { deletedAt: now });
      }
    }

    return { success: true };
  },
});

// ==========================================
// CATEGORY, ITEM & ITEM TYPE MUTATIONS
// ==========================================

export const createItemType = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("itemTypes", {
      organizationId: args.organizationId,
      name: args.name,
      icon: args.icon,
      createdAt: Date.now(),
    });
  },
});

export const listItemTypes = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("itemTypes")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
  },
});

export const ensureDefaultItemTypes = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("itemTypes")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    if (existing.length === 0) {
      const defaults = [
        { name: "Vegetarian", icon: "🟢" },
        { name: "Non-Veg", icon: "🔴" },
        { name: "Vegan", icon: "🌿" },
        { name: "Jain", icon: "🟡" },
        { name: "Contains Egg", icon: "🥚" },
      ];
      const now = Date.now();
      const created = [];
      for (const d of defaults) {
        const id = await ctx.db.insert("itemTypes", {
          organizationId: args.organizationId,
          name: d.name,
          icon: d.icon,
          createdAt: now,
        });
        created.push({ _id: id, name: d.name, icon: d.icon, organizationId: args.organizationId, createdAt: now });
      }
      return created;
    }
    return existing;
  },
});

export const createCategory = mutation({
  args: {
    organizationId: v.id("organizations"),
    menuId: v.id("menus"),
    name: v.string(),
    position: v.optional(v.number()),
    published: v.optional(v.boolean()),
    name_hi: v.optional(v.string()),
    name_gu: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("categories", {
      organizationId: args.organizationId,
      menuId: args.menuId,
      name: args.name,
      position: args.position ?? 0,
      published: args.published ?? true,
      name_hi: args.name_hi,
      name_gu: args.name_gu,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const createItem = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    price: v.number(),
    description: v.optional(v.string()),
    published: v.optional(v.boolean()),
    isAvailable: v.optional(v.boolean()),
    isGst: v.optional(v.boolean()),
    taxGroupId: v.optional(v.id("taxGroups")),
    taxMode: v.optional(v.union(v.literal("inclusive"), v.literal("exclusive"))),
    isVeg: v.optional(v.boolean()),
    isSpicy: v.optional(v.boolean()),
    showItemType: v.optional(v.boolean()),
    showQuantity: v.optional(v.boolean()),
    quantity: v.optional(v.number()),
    quantityUnit: v.optional(v.string()),
    skuNumber: v.optional(v.string()),
    markAsBestseller: v.optional(v.boolean()),
    favouriteItem: v.optional(v.boolean()),
    showCalorie: v.optional(v.boolean()),
    calorie: v.optional(v.string()),
    calorieMetric: v.optional(v.string()),
    daysOfUnavailable: v.optional(v.number()),
    servingSize: v.optional(v.string()),
    serving: v.optional(v.number()),
    caloriesPerServing: v.optional(v.string()),
    itemTypeIds: v.optional(v.array(v.id("itemTypes"))),
    imageStorageId: v.optional(v.id("_storage")),
    threeDModelStorageId: v.optional(v.id("_storage")),
    threeDModelIosStorageId: v.optional(v.id("_storage")),
    videoStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("items", {
      organizationId: args.organizationId,
      name: args.name,
      price: args.price,
      description: args.description,
      published: args.published ?? true,
      isAvailable: args.isAvailable ?? true,
      isGst: args.isGst ?? false,
      taxGroupId: args.taxGroupId,
      taxMode: args.taxMode,
      isVeg: args.isVeg ?? true,
      isSpicy: args.isSpicy ?? false,
      showItemType: args.showItemType ?? true,
      showQuantity: args.showQuantity ?? false,
      quantity: args.quantity,
      quantityUnit: args.quantityUnit,
      skuNumber: args.skuNumber,
      markAsBestseller: args.markAsBestseller ?? false,
      favouriteItem: args.favouriteItem ?? false,
      showCalorie: args.showCalorie ?? false,
      calorie: args.calorie,
      calorieMetric: args.calorieMetric ?? "kcal",
      daysOfUnavailable: args.daysOfUnavailable ?? 0,
      servingSize: args.servingSize,
      serving: args.serving,
      caloriesPerServing: args.caloriesPerServing,
      itemTypeIds: args.itemTypeIds,
      imageStorageId: args.imageStorageId,
      threeDModelStorageId: args.threeDModelStorageId,
      threeDModelIosStorageId: args.threeDModelIosStorageId,
      videoStorageId: args.videoStorageId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const addCategoryItem = mutation({
  args: {
    organizationId: v.id("organizations"),
    categoryId: v.id("categories"),
    itemId: v.id("items"),
    position: v.optional(v.number()),
    published: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("categoryItems", {
      organizationId: args.organizationId,
      categoryId: args.categoryId,
      itemId: args.itemId,
      position: args.position ?? 0,
      published: args.published ?? true,
      createdAt: Date.now(),
    });
  },
});

export const createCustomization = mutation({
  args: {
    organizationId: v.id("organizations"),
    itemId: v.id("items"),
    name: v.string(),
    customizationType: v.union(v.literal("AddOns"), v.literal("Preparations")),
    required: v.optional(v.boolean()),
    maxSelected: v.optional(v.number()),
    position: v.optional(v.number()),
    published: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("customizations", {
      organizationId: args.organizationId,
      itemId: args.itemId,
      name: args.name,
      customizationType: args.customizationType,
      required: args.required ?? false,
      maxSelected: args.maxSelected ?? 0,
      position: args.position ?? 0,
      published: args.published ?? true,
      createdAt: Date.now(),
    });
  },
});

export const createCustomizationItem = mutation({
  args: {
    organizationId: v.id("organizations"),
    customizationId: v.id("customizations"),
    name: v.string(),
    price: v.number(),
    isGst: v.optional(v.boolean()),
    taxGroupId: v.optional(v.id("taxGroups")),
    taxMode: v.optional(v.union(v.literal("inclusive"), v.literal("exclusive"))),
    isVeg: v.optional(v.boolean()),
    dietaryType: v.optional(v.string()),
    showQuantity: v.optional(v.boolean()),
    quantity: v.optional(v.number()),
    quantityUnit: v.optional(v.string()),
    description: v.optional(v.string()),
    showCalorie: v.optional(v.boolean()),
    calorie: v.optional(v.string()),
    calorieMetric: v.optional(v.string()),
    daysOfUnavailable: v.optional(v.number()),
    isAvailable: v.optional(v.boolean()),
    position: v.optional(v.number()),
    itemTypeIds: v.optional(v.array(v.id("itemTypes"))),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("customizationItems", {
      organizationId: args.organizationId,
      customizationId: args.customizationId,
      name: args.name,
      price: args.price,
      isGst: args.isGst ?? false,
      taxGroupId: args.taxGroupId,
      taxMode: args.taxMode,
      isVeg: args.isVeg ?? true,
      dietaryType: args.dietaryType,
      showQuantity: args.showQuantity ?? false,
      quantity: args.quantity,
      quantityUnit: args.quantityUnit,
      description: args.description,
      showCalorie: args.showCalorie ?? false,
      calorie: args.calorie,
      calorieMetric: args.calorieMetric ?? "kcal",
      daysOfUnavailable: args.daysOfUnavailable ?? 0,
      isAvailable: args.isAvailable ?? true,
      position: args.position ?? 0,
      itemTypeIds: args.itemTypeIds,
      imageStorageId: args.imageStorageId,
      createdAt: Date.now(),
    });
  },
});

export const listAllCustomizations = query({
  args: {
    organizationId: v.id("organizations"),
    currentItemId: v.optional(v.id("items")),
  },
  handler: async (ctx, args) => {
    const customizations = await ctx.db
      .query("customizations")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const results: Array<any> = [];
    for (const cust of customizations) {
      // Exclude customizations already belonging to the current item
      if (args.currentItemId && cust.itemId === args.currentItemId) {
        continue;
      }

      // Check if item exists, is active, and is valid
      const item = await ctx.db.get(cust.itemId);
      if (!item || item.deletedAt !== undefined) continue;

      // Only include customizations from items linked to an active category
      const catItem = await ctx.db
        .query("categoryItems")
        .filter((q) =>
          q.and(
            q.eq(q.field("itemId"), item._id),
            q.eq(q.field("deletedAt"), undefined)
          )
        )
        .first();

      if (!catItem) continue;

      const cat = await ctx.db.get(catItem.categoryId);
      if (!cat || cat.deletedAt !== undefined) continue;

      // Count child choice items
      const choices = await ctx.db
        .query("customizationItems")
        .withIndex("by_customization", (q) => q.eq("customizationId", cust._id))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      results.push({
        _id: cust._id,
        name: cust.name,
        customizationType: cust.customizationType,
        required: cust.required,
        maxSelected: cust.maxSelected,
        published: cust.published,
        itemId: cust.itemId,
        itemName: item.name,
        categoryName: cat.name,
        choiceCount: choices.length,
        choices: choices.map((c) => ({
          _id: c._id,
          name: c.name,
          price: c.price,
        })),
      });
    }

    return results;
  },
});

export const copyCustomizationToItem = mutation({
  args: {
    organizationId: v.id("organizations"),
    targetItemId: v.id("items"),
    customizationIds: v.array(v.id("customizations")),
  },
  handler: async (ctx, args) => {
    const currentCusts = await ctx.db
      .query("customizations")
      .filter((q) =>
        q.and(
          q.eq(q.field("itemId"), args.targetItemId),
          q.eq(q.field("deletedAt"), undefined)
        )
      )
      .collect();

    let nextPosition = currentCusts.length;
    const createdCustomizationIds: Array<any> = [];

    for (const sourceCustId of args.customizationIds) {
      const sourceCust = await ctx.db.get(sourceCustId);
      if (!sourceCust || sourceCust.deletedAt !== undefined) continue;

      const newCustId = await ctx.db.insert("customizations", {
        organizationId: args.organizationId,
        itemId: args.targetItemId,
        name: sourceCust.name,
        customizationType: sourceCust.customizationType,
        required: sourceCust.required,
        maxSelected: sourceCust.maxSelected,
        position: nextPosition++,
        published: sourceCust.published ?? true,
        createdAt: Date.now(),
      });

      createdCustomizationIds.push(newCustId);

      // Copy child choice items
      const sourceChoices = await ctx.db
        .query("customizationItems")
        .withIndex("by_customization", (q) => q.eq("customizationId", sourceCustId))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      for (const choice of sourceChoices) {
        await ctx.db.insert("customizationItems", {
          organizationId: args.organizationId,
          customizationId: newCustId,
          name: choice.name,
          price: choice.price,
          isGst: choice.isGst ?? false,
          showQuantity: choice.showQuantity ?? false,
          quantity: choice.quantity,
          quantityUnit: choice.quantityUnit,
          description: choice.description,
          showCalorie: choice.showCalorie ?? false,
          calorie: choice.calorie,
          calorieMetric: choice.calorieMetric ?? "kcal",
          daysOfUnavailable: choice.daysOfUnavailable ?? 0,
          isAvailable: choice.isAvailable ?? true,
          position: choice.position ?? 0,
          itemTypeIds: choice.itemTypeIds,
          imageStorageId: choice.imageStorageId,
          createdAt: Date.now(),
        });
      }
    }

    return { success: true, createdCustomizationIds };
  },
});

// ==========================================
// ORGANIZATION MENU EXECUTION QUERY (get_organization_menu)
// ==========================================

export const getOrganizationMenu = query({
  args: {
    organizationId: v.id("organizations"),
    menuId: v.optional(v.id("menus")),
    search: v.optional(v.string()),
    isVeg: v.optional(v.boolean()),
    isSpicy: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // 1. Resolve Target Menu
    let targetMenuId = args.menuId;

    if (!targetMenuId) {
      const defaultMenus = await ctx.db
        .query("menus")
        .withIndex("by_org_default", (q) =>
          q.eq("organizationId", args.organizationId).eq("isDefault", true)
        )
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      const activeDefault = defaultMenus.find((m) => m.isActive);
      if (activeDefault) {
        targetMenuId = activeDefault._id;
      } else {
        const orgMenus = await ctx.db
          .query("menus")
          .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
          .filter((q) => q.eq(q.field("deletedAt"), undefined))
          .collect();
        const firstActive = orgMenus.find((m) => m.isActive);
        if (firstActive) {
          targetMenuId = firstActive._id;
        }
      }
    }

    if (!targetMenuId) {
      return [];
    }

    const targetMenu = await ctx.db.get(targetMenuId);
    if (!targetMenu || targetMenu.deletedAt !== undefined) {
      return [];
    }

    // 2. Query Categories for the resolved menu
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_menu", (q) => q.eq("menuId", targetMenuId!))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const activeCategories = categories
      .filter((c) => c.published)
      .sort((a, b) => a.position - b.position);

    const resultMenu: Array<any> = [];
    const searchQuery = args.search?.trim().toLowerCase();

    for (const category of activeCategories) {
      // 3. Query Category Items
      const catItems = await ctx.db
        .query("categoryItems")
        .withIndex("by_category", (q) => q.eq("categoryId", category._id))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      const activeCatItems = catItems
        .filter((ci) => ci.published)
        .sort((a, b) => a.position - b.position);

      const serializedItems: Array<any> = [];

      for (const ci of activeCatItems) {
        const item = await ctx.db.get(ci.itemId);
        if (!item || item.deletedAt !== undefined || !item.published) continue;

        // Apply attribute filters
        if (args.isVeg !== undefined && item.isVeg !== args.isVeg) continue;
        if (args.isSpicy !== undefined && item.isSpicy !== args.isSpicy) continue;

        // Apply search query filter
        if (searchQuery) {
          const matchName = item.name.toLowerCase().includes(searchQuery);
          const matchDesc = item.description?.toLowerCase().includes(searchQuery) ?? false;
          if (!matchName && !matchDesc) continue;
        }

        // Resolve Image & Media Storage URLs
        const imageUrl = item.imageStorageId
          ? await ctx.storage.getUrl(item.imageStorageId)
          : null;
        const threeDModelUrl = item.threeDModelStorageId
          ? await ctx.storage.getUrl(item.threeDModelStorageId)
          : null;
        const threeDModelIosUrl = item.threeDModelIosStorageId
          ? await ctx.storage.getUrl(item.threeDModelIosStorageId)
          : null;
        const videoUrl = item.videoStorageId
          ? await ctx.storage.getUrl(item.videoStorageId)
          : null;

        // Resolve Item Types (Veg, Non-Veg, Jain, Vegan, etc.)
        const resolvedItemTypes: Array<any> = [];
        if (item.itemTypeIds) {
          for (const typeId of item.itemTypeIds) {
            const itemTypeObj = await ctx.db.get(typeId);
            if (itemTypeObj && itemTypeObj.deletedAt === undefined) {
              resolvedItemTypes.push({
                id: itemTypeObj._id,
                name: itemTypeObj.name,
                icon: itemTypeObj.icon,
              });
            }
          }
        }

        // Fetch Customizations for Item
        const itemCustomizations = await ctx.db
          .query("customizations")
          .withIndex("by_item", (q) => q.eq("itemId", item._id))
          .filter((q) => q.eq(q.field("deletedAt"), undefined))
          .collect();

        const activeCustomizations = itemCustomizations
          .filter((cust) => cust.published)
          .sort((a, b) => a.position - b.position);

        const serializedCustomizations: Array<any> = [];

        for (const cust of activeCustomizations) {
          const custItems = await ctx.db
            .query("customizationItems")
            .withIndex("by_customization", (q) => q.eq("customizationId", cust._id))
            .filter((q) => q.eq(q.field("deletedAt"), undefined))
            .collect();

          const sortedCustItems = custItems.sort((a, b) => a.position - b.position);

          const serializedCustItems: Array<any> = [];
          for (const ciOpt of sortedCustItems) {
            const custOptImgUrl = ciOpt.imageStorageId
              ? await ctx.storage.getUrl(ciOpt.imageStorageId)
              : null;

            const custItemTypes: Array<any> = [];
            if (ciOpt.itemTypeIds) {
              for (const typeId of ciOpt.itemTypeIds) {
                const itemTypeObj = await ctx.db.get(typeId);
                if (itemTypeObj) {
                  custItemTypes.push({
                    id: itemTypeObj._id,
                    name: itemTypeObj.name,
                    icon: itemTypeObj.icon,
                  });
                }
              }
            }

            serializedCustItems.push({
              id: ciOpt._id,
              name: ciOpt.name,
              price: ciOpt.price,
              display_price: (ciOpt.price / 100).toFixed(2),
              is_gst: ciOpt.isGst ?? false,
              show_quantity: ciOpt.showQuantity ?? false,
              quantity: ciOpt.quantity,
              quantity_unit: ciOpt.quantityUnit,
              description: ciOpt.description,
              show_calorie: ciOpt.showCalorie ?? false,
              calorie: ciOpt.calorie,
              calorie_metric: ciOpt.calorieMetric ?? "kcal",
              days_of_unavailable: ciOpt.daysOfUnavailable ?? 0,
              is_available: ciOpt.isAvailable,
              position: ciOpt.position,
              customization_item_image_url: custOptImgUrl ? { original: custOptImgUrl } : {},
              items_item_types: custItemTypes,
            });
          }

          serializedCustomizations.push({
            id: cust._id,
            name: cust.name,
            customization_type: cust.customizationType === "AddOns" ? "Add-Ons" : "Preparations",
            required: cust.required,
            max_selected: cust.maxSelected,
            position: cust.position,
            published: cust.published,
            customization_items: serializedCustItems,
          });
        }

        // Resolve Tax Calculation if is_gst is true
        let taxInfo: any = {
          is_gst: item.isGst,
          tax_mode: "exclusive",
          total_tax_rate: 0,
          tax_amount: "0.00",
          base_price: (item.price / 100).toFixed(2),
          final_price: (item.price / 100).toFixed(2),
          components: [],
        };

        if (item.isGst) {
          const defaultTaxGroups = await ctx.db
            .query("taxGroups")
            .withIndex("by_org_default", (q) =>
              q.eq("organizationId", args.organizationId).eq("isDefault", true)
            )
            .collect();

          if (defaultTaxGroups.length > 0) {
            const taxGroup = defaultTaxGroups[0];
            let totalRate = 0;
            const components: Array<any> = [];

            for (const compId of taxGroup.componentIds) {
              const comp = await ctx.db.get(compId);
              if (comp) {
                components.push(comp);
                totalRate += comp.rate;
              }
            }

            const rawPrice = item.price / 100.0;
            let basePrice = rawPrice;
            let taxAmount = 0;
            let finalPrice = rawPrice;

            if (taxGroup.taxMode === "inclusive") {
              taxAmount = rawPrice * (totalRate / (100 + totalRate));
              basePrice = rawPrice - taxAmount;
              finalPrice = rawPrice;
            } else {
              taxAmount = rawPrice * (totalRate / 100.0);
              basePrice = rawPrice;
              finalPrice = rawPrice + taxAmount;
            }

            const compBreakdown = components.map((c) => {
              const compTaxVal = totalRate > 0 ? taxAmount * (c.rate / totalRate) : 0;
              return {
                name: c.name,
                code: c.code ?? c.name,
                rate: c.rate,
                tax_amount: compTaxVal.toFixed(2),
              };
            });

            taxInfo = {
              is_gst: true,
              tax_mode: taxGroup.taxMode,
              tax_group_name: taxGroup.name,
              total_tax_rate: totalRate,
              tax_amount: taxAmount.toFixed(2),
              base_price: basePrice.toFixed(2),
              final_price: finalPrice.toFixed(2),
              components: compBreakdown,
            };
          }
        }

        // Format complete item output matching defx-pos v1 OrganizationMenuSerializer
        serializedItems.push({
          category_item_id: ci._id,
          item: {
            id: item._id,
            name: item.name,
            price: item.price,
            display_price: (item.price / 100).toFixed(2),
            description: item.description,
            published: item.published,
            is_available: item.isAvailable,
            is_gst: item.isGst,
            is_veg: item.isVeg,
            is_spicy: item.isSpicy,
            show_quantity: item.showQuantity,
            quantity: item.quantity,
            quantity_unit: item.quantityUnit,
            sku_number: item.skuNumber,
            mark_as_bestseller: item.markAsBestseller,
            favourite_item: item.favouriteItem ?? false,
            show_calorie: item.showCalorie,
            calorie: item.calorie,
            calorie_metric: item.calorieMetric ?? "kcal",
            days_of_unavailable: item.daysOfUnavailable ?? 0,
            serving_size: item.servingSize,
            serving: item.serving,
            calories_per_serving: item.caloriesPerServing,
            items_item_types: resolvedItemTypes,
            tax_info: taxInfo,
          },
          customizations: serializedCustomizations,
          item_image_url: imageUrl,
          item_3d_image_url: threeDModelUrl,
          item_3d_image_for_ios_url: threeDModelIosUrl,
          item_video_url: videoUrl,
        });
      }

      if (serializedItems.length > 0 || !searchQuery) {
        resultMenu.push({
          category: {
            id: category._id,
            name: category.name,
            name_hi: category.name_hi,
            name_gu: category.name_gu,
            position: category.position,
            published: category.published,
            items: serializedItems,
          },
        });
      }
    }

    return resultMenu;
  },
});

// ==========================================
// CATEGORY & ITEM MANAGEMENT HANDLERS
// ==========================================

export const listCategories = query({
  args: { menuId: v.id("menus") },
  handler: async (ctx, args) => {
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_menu", (q) => q.eq("menuId", args.menuId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    return categories.sort((a, b) => a.position - b.position);
  },
});

export const reorderCategories = mutation({
  args: {
    categoryIds: v.array(v.id("categories")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.categoryIds.length; i++) {
      await ctx.db.patch(args.categoryIds[i], {
        position: i,
        updatedAt: Date.now(),
      });
    }
    return { success: true };
  },
});

export const reorderCategoryItems = mutation({
  args: {
    categoryItemIds: v.array(v.id("categoryItems")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.categoryItemIds.length; i++) {
      await ctx.db.patch(args.categoryItemIds[i], {
        position: i,
      });
    }
    return { success: true };
  },
});

export const updateCategory = mutation({
  args: {
    id: v.id("categories"),
    name: v.optional(v.string()),
    position: v.optional(v.number()),
    published: v.optional(v.boolean()),
    name_hi: v.optional(v.string()),
    name_gu: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const cat = await ctx.db.get(id);
    if (!cat || cat.deletedAt !== undefined) throw new Error("Category not found");

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

export const toggleCategoryPublished = mutation({
  args: {
    id: v.id("categories"),
    published: v.boolean(),
  },
  handler: async (ctx, args) => {
    const cat = await ctx.db.get(args.id);
    if (!cat || cat.deletedAt !== undefined) throw new Error("Category not found");

    await ctx.db.patch(args.id, {
      published: args.published,
      updatedAt: Date.now(),
    });
    return { success: true, published: args.published };
  },
});

export const deleteCategory = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    const cat = await ctx.db.get(args.id);
    if (!cat) throw new Error("Category not found");

    const now = Date.now();
    await ctx.db.patch(args.id, { deletedAt: now, updatedAt: now });

    // Soft delete all categoryItems under this category
    const catItems = await ctx.db
      .query("categoryItems")
      .withIndex("by_category", (q) => q.eq("categoryId", args.id))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    for (const ci of catItems) {
      await ctx.db.patch(ci._id, { deletedAt: now });
    }

    return { success: true };
  },
});

export const listCategoryItems = query({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    const catItems = await ctx.db
      .query("categoryItems")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const sortedCatItems = catItems.sort((a, b) => a.position - b.position);
    const results: Array<any> = [];

    for (const ci of sortedCatItems) {
      const item = await ctx.db.get(ci.itemId);
      if (!item || item.deletedAt !== undefined) continue;

      const imageUrl = item.imageStorageId
        ? await ctx.storage.getUrl(item.imageStorageId)
        : null;

      results.push({
        categoryItemId: ci._id,
        position: ci.position,
        published: ci.published,
        item: {
          _id: item._id,
          name: item.name,
          price: item.price,
          displayPrice: (item.price / 100).toFixed(2),
          description: item.description,
          published: item.published,
          isAvailable: item.isAvailable,
          daysOfUnavailable: item.daysOfUnavailable ?? 0,
          isVeg: item.isVeg,
          isSpicy: item.isSpicy,
          markAsBestseller: item.markAsBestseller,
          imageUrl,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        },
      });
    }

    return results;
  },
});

export const listAllItems = query({
  args: {
    organizationId: v.id("organizations"),
    categoryId: v.optional(v.id("categories")),
  },
  handler: async (ctx, args) => {
    let excludedItemIds = new Set<string>();
    if (args.categoryId) {
      const catItems = await ctx.db
        .query("categoryItems")
        .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId!))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();
      for (const ci of catItems) {
        excludedItemIds.add(ci.itemId);
      }
    }

    const items = await ctx.db
      .query("items")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const results: Array<any> = [];
    for (const item of items) {
      if (excludedItemIds.has(item._id)) continue;

      const catItem = await ctx.db
        .query("categoryItems")
        .filter((q) =>
          q.and(
            q.eq(q.field("itemId"), item._id),
            q.eq(q.field("deletedAt"), undefined)
          )
        )
        .first();

      // Only include items currently linked to a valid active category (skip unlinked/deleted items)
      if (!catItem) continue;

      const cat = await ctx.db.get(catItem.categoryId);
      if (!cat || cat.deletedAt !== undefined) continue;
      const categoryName = cat.name;

      const imageUrl = item.imageStorageId
        ? await ctx.storage.getUrl(item.imageStorageId)
        : null;

      results.push({
        _id: item._id,
        name: item.name,
        price: item.price,
        displayPrice: (item.price / 100).toFixed(2),
        description: item.description,
        published: item.published,
        isAvailable: item.isAvailable,
        daysOfUnavailable: item.daysOfUnavailable ?? 0,
        isVeg: item.isVeg,
        isSpicy: item.isSpicy,
        imageUrl,
        categoryName,
      });
    }

    return results;
  },
});

export const addExistingItemToCategory = mutation({
  args: {
    organizationId: v.id("organizations"),
    categoryId: v.id("categories"),
    itemId: v.id("items"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("categoryItems")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .filter((q) => q.eq(q.field("itemId"), args.itemId))
      .first();

    if (existing) {
      if (existing.deletedAt !== undefined) {
        await ctx.db.patch(existing._id, { deletedAt: undefined, published: true });
      }
      return { success: true, categoryItemId: existing._id };
    }

    const currentItems = await ctx.db
      .query("categoryItems")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const categoryItemId = await ctx.db.insert("categoryItems", {
      organizationId: args.organizationId,
      categoryId: args.categoryId,
      itemId: args.itemId,
      position: currentItems.length,
      published: true,
      createdAt: Date.now(),
    });

    return { success: true, categoryItemId };
  },
});

export const toggleItemAvailability = mutation({
  args: {
    id: v.id("items"),
    isAvailable: v.boolean(),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item || item.deletedAt !== undefined) throw new Error("Item not found");

    await ctx.db.patch(args.id, {
      isAvailable: args.isAvailable,
      daysOfUnavailable: args.isAvailable ? 0 : item.daysOfUnavailable,
      updatedAt: Date.now(),
    });
    return { success: true, isAvailable: args.isAvailable };
  },
});

export const setItemUnavailability = mutation({
  args: {
    id: v.id("items"),
    isAvailable: v.boolean(),
    daysOfUnavailable: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item || item.deletedAt !== undefined) throw new Error("Item not found");

    await ctx.db.patch(args.id, {
      isAvailable: args.isAvailable,
      daysOfUnavailable: args.isAvailable ? 0 : (args.daysOfUnavailable ?? 1),
      updatedAt: Date.now(),
    });
    return { success: true, isAvailable: args.isAvailable, daysOfUnavailable: args.daysOfUnavailable ?? 0 };
  },
});

export const updateItem = mutation({
  args: {
    id: v.id("items"),
    name: v.optional(v.string()),
    price: v.optional(v.number()),
    description: v.optional(v.string()),
    published: v.optional(v.boolean()),
    isAvailable: v.optional(v.boolean()),
    isGst: v.optional(v.boolean()),
    taxGroupId: v.optional(v.id("taxGroups")),
    taxMode: v.optional(v.union(v.literal("inclusive"), v.literal("exclusive"))),
    isVeg: v.optional(v.boolean()),
    isSpicy: v.optional(v.boolean()),
    showItemType: v.optional(v.boolean()),
    showQuantity: v.optional(v.boolean()),
    quantity: v.optional(v.number()),
    quantityUnit: v.optional(v.string()),
    skuNumber: v.optional(v.string()),
    markAsBestseller: v.optional(v.boolean()),
    itemTypeIds: v.optional(v.array(v.id("itemTypes"))),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const item = await ctx.db.get(id);
    if (!item || item.deletedAt !== undefined) throw new Error("Item not found");

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

export const deleteItem = mutation({
  args: {
    id: v.id("items"),
    categoryId: v.optional(v.id("categories")),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) return { success: true };

    const now = Date.now();

    if (args.categoryId) {
      const catItems = await ctx.db
        .query("categoryItems")
        .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId!))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      for (const ci of catItems) {
        if (ci.itemId === args.id) {
          await ctx.db.patch(ci._id, { deletedAt: now });
        }
      }

      // Check if item is still linked to any other active category
      const remainingCatItem = await ctx.db
        .query("categoryItems")
        .filter((q) =>
          q.and(
            q.eq(q.field("itemId"), args.id),
            q.eq(q.field("deletedAt"), undefined)
          )
        )
        .first();

      // If no other category links this item, soft-delete the item and its customizations
      if (!remainingCatItem) {
        const customizations = await ctx.db
          .query("customizations")
          .filter((q) =>
            q.and(
              q.eq(q.field("itemId"), args.id),
              q.eq(q.field("deletedAt"), undefined)
            )
          )
          .collect();
        for (const cust of customizations) {
          const custItems = await ctx.db
            .query("customizationItems")
            .filter((q) =>
              q.and(
                q.eq(q.field("customizationId"), cust._id),
                q.eq(q.field("deletedAt"), undefined)
              )
            )
            .collect();
          for (const ci of custItems) {
            await ctx.db.patch(ci._id, { deletedAt: now });
          }
          await ctx.db.patch(cust._id, { deletedAt: now });
        }
        await ctx.db.patch(args.id, { deletedAt: now, updatedAt: now });
      }
    } else {
      // Remove all category associations
      const allCatItems = await ctx.db
        .query("categoryItems")
        .filter((q) =>
          q.and(
            q.eq(q.field("itemId"), args.id),
            q.eq(q.field("deletedAt"), undefined)
          )
        )
        .collect();
      for (const ci of allCatItems) {
        await ctx.db.patch(ci._id, { deletedAt: now });
      }
      const customizations = await ctx.db
        .query("customizations")
        .filter((q) =>
          q.and(
            q.eq(q.field("itemId"), args.id),
            q.eq(q.field("deletedAt"), undefined)
          )
        )
        .collect();
      for (const cust of customizations) {
        const custItems = await ctx.db
          .query("customizationItems")
          .filter((q) =>
            q.and(
              q.eq(q.field("customizationId"), cust._id),
              q.eq(q.field("deletedAt"), undefined)
            )
          )
          .collect();
        for (const ci of custItems) {
          await ctx.db.patch(ci._id, { deletedAt: now });
        }
        await ctx.db.patch(cust._id, { deletedAt: now });
      }
      await ctx.db.patch(args.id, { deletedAt: now, updatedAt: now });
    }

    return { success: true };
  },
});

export const seedSampleMenu = mutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const existingMenus = await ctx.db
      .query("menus")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    if (existingMenus.length > 0) {
      return existingMenus[0]._id;
    }

    const now = Date.now();
    const menuId = await ctx.db.insert("menus", {
      organizationId: args.organizationId,
      name: "Main Menu",
      description: "Default restaurant dining & bar menu",
      isDefault: true,
      isActive: true,
      position: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Seed sample categories
    const viralFoodId = await ctx.db.insert("categories", {
      organizationId: args.organizationId,
      menuId,
      name: "Viral Food",
      position: 0,
      published: true,
      createdAt: now,
      updatedAt: now,
    });

    const startersId = await ctx.db.insert("categories", {
      organizationId: args.organizationId,
      menuId,
      name: "Starters",
      position: 1,
      published: false,
      createdAt: now,
      updatedAt: now,
    });

    const mainsId = await ctx.db.insert("categories", {
      organizationId: args.organizationId,
      menuId,
      name: "Mains",
      position: 2,
      published: true,
      createdAt: now,
      updatedAt: now,
    });

    // Seed sample items for Viral Food
    const item1Id = await ctx.db.insert("items", {
      organizationId: args.organizationId,
      name: "Truffle Umami Burger",
      price: 2400, // $24.00
      description: "Wagyu beef, black truffle aioli, aged cheddar, brioche bun",
      published: true,
      isAvailable: true,
      isVeg: false,
      isSpicy: false,
      isGst: false,
      showQuantity: false,
      showCalorie: false,
      daysOfUnavailable: 0,
      markAsBestseller: true,
      createdAt: now,
      updatedAt: now,
    });

    const item2Id = await ctx.db.insert("items", {
      organizationId: args.organizationId,
      name: "Spicy Tuna Crispy Rice",
      price: 1850, // $18.50
      description: "Sushi grade tuna, jalapeño, sweet soy glaze, scallions",
      published: true,
      isAvailable: true,
      isVeg: false,
      isSpicy: true,
      isGst: false,
      showQuantity: false,
      showCalorie: false,
      daysOfUnavailable: 0,
      markAsBestseller: false,
      createdAt: now,
      updatedAt: now,
    });

    const item3Id = await ctx.db.insert("items", {
      organizationId: args.organizationId,
      name: "Matcha Lava Cake",
      price: 1400, // $14.00
      description: "Warm matcha green tea cake, molten center, vanilla bean gelato",
      published: true,
      isAvailable: false, // SOLD OUT
      isVeg: true,
      isSpicy: false,
      isGst: false,
      showQuantity: false,
      showCalorie: false,
      daysOfUnavailable: 0,
      markAsBestseller: false,
      createdAt: now,
      updatedAt: now,
    });

    // Link items to Viral Food category
    await ctx.db.insert("categoryItems", {
      organizationId: args.organizationId,
      categoryId: viralFoodId,
      itemId: item1Id,
      position: 0,
      published: true,
      createdAt: now,
    });

    await ctx.db.insert("categoryItems", {
      organizationId: args.organizationId,
      categoryId: viralFoodId,
      itemId: item2Id,
      position: 1,
      published: true,
      createdAt: now,
    });

    await ctx.db.insert("categoryItems", {
      organizationId: args.organizationId,
      categoryId: viralFoodId,
      itemId: item3Id,
      position: 2,
      published: true,
      createdAt: now,
    });

    return menuId;
  },
});

export const listCustomizations = query({
  args: { itemId: v.id("items") },
  handler: async (ctx, args) => {
    const customizations = await ctx.db
      .query("customizations")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const results = [];
    for (const cust of customizations) {
      const items = await ctx.db
        .query("customizationItems")
        .withIndex("by_customization", (q) => q.eq("customizationId", cust._id))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      results.push({
        ...cust,
        items: items.sort((a, b) => a.position - b.position),
      });
    }

    return results.sort((a, b) => a.position - b.position);
  },
});

export const updateCustomization = mutation({
  args: {
    id: v.id("customizations"),
    name: v.optional(v.string()),
    customizationType: v.optional(v.union(v.literal("AddOns"), v.literal("Preparations"))),
    required: v.optional(v.boolean()),
    maxSelected: v.optional(v.number()),
    published: v.optional(v.boolean()),
    position: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing || existing.deletedAt !== undefined) throw new Error("Customization not found");

    await ctx.db.patch(id, updates);
    return await ctx.db.get(id);
  },
});

export const deleteCustomization = mutation({
  args: { id: v.id("customizations") },
  handler: async (ctx, args) => {
    const cust = await ctx.db.get(args.id);
    if (!cust) return { success: true };

    const now = Date.now();
    await ctx.db.patch(args.id, { deletedAt: now });

    const items = await ctx.db
      .query("customizationItems")
      .withIndex("by_customization", (q) => q.eq("customizationId", args.id))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    for (const item of items) {
      await ctx.db.patch(item._id, { deletedAt: now });
    }

    return { success: true };
  },
});

export const updateCustomizationItem = mutation({
  args: {
    id: v.id("customizationItems"),
    name: v.optional(v.string()),
    price: v.optional(v.number()),
    description: v.optional(v.string()),
    isGst: v.optional(v.boolean()),
    taxGroupId: v.optional(v.id("taxGroups")),
    taxMode: v.optional(v.union(v.literal("inclusive"), v.literal("exclusive"))),
    isVeg: v.optional(v.boolean()),
    dietaryType: v.optional(v.string()),
    showQuantity: v.optional(v.boolean()),
    quantity: v.optional(v.number()),
    quantityUnit: v.optional(v.string()),
    showCalorie: v.optional(v.boolean()),
    calorie: v.optional(v.string()),
    calorieMetric: v.optional(v.string()),
    isAvailable: v.optional(v.boolean()),
    position: v.optional(v.number()),
    itemTypeIds: v.optional(v.array(v.id("itemTypes"))),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing || existing.deletedAt !== undefined) throw new Error("Customization item not found");

    await ctx.db.patch(id, updates);
    return await ctx.db.get(id);
  },
});

export const deleteCustomizationItem = mutation({
  args: { id: v.id("customizationItems") },
  handler: async (ctx, args) => {
    const choice = await ctx.db.get(args.id);
    if (!choice) return { success: true };

    await ctx.db.patch(args.id, { deletedAt: Date.now() });
    return { success: true };
  },
});

export const duplicateItem = mutation({
  args: {
    organizationId: v.id("organizations"),
    itemId: v.id("items"),
    categoryId: v.id("categories"),
    newName: v.string(),
  },
  handler: async (ctx, args) => {
    const originalItem = await ctx.db.get(args.itemId);
    if (!originalItem || originalItem.deletedAt !== undefined) {
      throw new Error("Item not found");
    }

    const now = Date.now();
    const { _id, _creationTime, deletedAt, ...itemFields } = originalItem;

    // Create cloned item
    const newItemId = await ctx.db.insert("items", {
      ...itemFields,
      name: args.newName,
      createdAt: now,
      updatedAt: now,
    });

    // Link to category
    await ctx.db.insert("categoryItems", {
      organizationId: args.organizationId,
      categoryId: args.categoryId,
      itemId: newItemId,
      position: 999,
      published: true,
      createdAt: now,
    });

    // Copy customizations & customizationItems
    const customizations = await ctx.db
      .query("customizations")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    for (const cust of customizations) {
      const { _id: custId, _creationTime: cct, deletedAt: cdAt, ...custFields } = cust;
      const newCustId = await ctx.db.insert("customizations", {
        ...custFields,
        itemId: newItemId,
        createdAt: now,
      });

      const custItems = await ctx.db
        .query("customizationItems")
        .withIndex("by_customization", (q) => q.eq("customizationId", custId))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      for (const cItem of custItems) {
        const { _id: cItemId, _creationTime: cict, deletedAt: cidAt, ...cItemFields } = cItem;
        await ctx.db.insert("customizationItems", {
          ...cItemFields,
          customizationId: newCustId,
          createdAt: now,
        });
      }
    }

    return newItemId;
  },
});

export const duplicateCustomizationItem = mutation({
  args: {
    organizationId: v.id("organizations"),
    customizationItemId: v.id("customizationItems"),
    newName: v.string(),
  },
  handler: async (ctx, args) => {
    const original = await ctx.db.get(args.customizationItemId);
    if (!original || original.deletedAt !== undefined) {
      throw new Error("Customization item not found");
    }

    const { _id, _creationTime, deletedAt, ...fields } = original;
    const now = Date.now();

    const newId = await ctx.db.insert("customizationItems", {
      ...fields,
      name: args.newName,
      createdAt: now,
    });

    return newId;
  },
});

export const setCustomizationItemUnavailability = mutation({
  args: {
    id: v.id("customizationItems"),
    isAvailable: v.boolean(),
    daysOfUnavailable: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) throw new Error("Customization item not found");

    await ctx.db.patch(args.id, {
      isAvailable: args.isAvailable,
      daysOfUnavailable: args.daysOfUnavailable ?? 0,
    });
    return await ctx.db.get(args.id);
  },
});

export const reorderCustomizationItems = mutation({
  args: {
    itemIds: v.array(v.id("customizationItems")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.itemIds.length; i++) {
      await ctx.db.patch(args.itemIds[i], {
        position: i,
      });
    }
    return { success: true };
  },
});

export const reorderCustomizations = mutation({
  args: {
    customizationIds: v.array(v.id("customizations")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.customizationIds.length; i++) {
      await ctx.db.patch(args.customizationIds[i], {
        position: i,
      });
    }
    return { success: true };
  },
});



