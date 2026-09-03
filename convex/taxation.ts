import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Helper: Organization Ownership Guard Enforcer
async function verifyOrgOwnership(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">
) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity) {
    const org = await ctx.db.get(organizationId);
    if (!org || org.deletedAt !== undefined) {
      throw new Error("Organization not found");
    }
    const isOwner = !org.ownerClerkId || org.ownerClerkId === identity.subject;
    if (isOwner) return;

    const membership = await ctx.db
      .query("organizationUsers")
      .withIndex("by_user_and_org", (q) =>
        q.eq("userId", identity.subject).eq("organizationId", organizationId)
      )
      .first();

    if (!membership || membership.deletedAt !== undefined) {
      throw new Error("Forbidden. Cross-organization access denied.");
    }
  }
}

// ==========================================
// TAX COMPONENTS & TAX GROUPS CRUD
// ==========================================

export const listTaxComponents = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("taxComponents")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();
  },
});

export const createTaxComponent = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    rate: v.number(),
    code: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("taxComponents", {
      organizationId: args.organizationId,
      name: args.name,
      rate: args.rate,
      code: args.code,
      createdAt: Date.now(),
    });
  },
});

export const updateTaxComponent = mutation({
  args: {
    id: v.id("taxComponents"),
    name: v.optional(v.string()),
    rate: v.optional(v.number()),
    code: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const component = await ctx.db.get(args.id);
    if (!component) throw new Error("Tax component not found");

    await verifyOrgOwnership(ctx, component.organizationId);

    const { id, ...updates } = args;
    const patchData: Record<string, any> = {};

    if (updates.name !== undefined) {
      if (!updates.name || !updates.name.trim()) {
        throw new Error("Tax component name cannot be blank");
      }
      patchData.name = updates.name.trim();
    }

    if (updates.rate !== undefined) {
      if (typeof updates.rate !== "number" || updates.rate < 0) {
        throw new Error("Tax rate must be a non-negative number");
      }
      patchData.rate = updates.rate;
    }

    if (updates.code !== undefined) {
      patchData.code = updates.code;
    }

    await ctx.db.patch(id, patchData);
    return { success: true };
  },
});

export const removeTaxComponent = mutation({
  args: { id: v.id("taxComponents") },
  handler: async (ctx, args) => {
    const component = await ctx.db.get(args.id);
    if (!component) throw new Error("Tax component not found");

    await verifyOrgOwnership(ctx, component.organizationId);

    // Inspect whether component is referenced by any tax group in the organization
    const taxGroups = await ctx.db
      .query("taxGroups")
      .withIndex("by_org", (q) => q.eq("organizationId", component.organizationId))
      .collect();

    const isReferenced = taxGroups.some((g) => g.componentIds.includes(args.id));
    if (isReferenced) {
      throw new Error("Cannot delete tax component because it is referenced by one or more tax groups");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const listTaxGroups = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("taxGroups")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();
  },
});

export const createTaxGroup = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    taxMode: v.union(v.literal("inclusive"), v.literal("exclusive")),
    componentIds: v.array(v.id("taxComponents")),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existingGroups = await ctx.db
      .query("taxGroups")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const isFirstGroup = existingGroups.length === 0;
    const shouldBeDefault = args.isDefault ?? isFirstGroup;

    if (shouldBeDefault && !isFirstGroup) {
      for (const group of existingGroups) {
        if (group.isDefault) {
          await ctx.db.patch(group._id, { isDefault: false, updatedAt: Date.now() });
        }
      }
    }

    const now = Date.now();
    return await ctx.db.insert("taxGroups", {
      organizationId: args.organizationId,
      name: args.name,
      taxMode: args.taxMode,
      componentIds: args.componentIds,
      isDefault: shouldBeDefault,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateTaxGroup = mutation({
  args: {
    id: v.id("taxGroups"),
    name: v.optional(v.string()),
    taxMode: v.optional(v.union(v.literal("inclusive"), v.literal("exclusive"))),
    componentIds: v.optional(v.array(v.id("taxComponents"))),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.id);
    if (!group) throw new Error("Tax group not found");

    await verifyOrgOwnership(ctx, group.organizationId);

    const { id, ...updates } = args;
    const now = Date.now();
    const patchData: Record<string, any> = { updatedAt: now };

    if (updates.name !== undefined) {
      if (!updates.name || !updates.name.trim()) {
        throw new Error("Tax group name cannot be blank");
      }
      patchData.name = updates.name.trim();
    }

    if (updates.taxMode !== undefined) {
      patchData.taxMode = updates.taxMode;
    }

    if (updates.componentIds !== undefined) {
      for (const compId of updates.componentIds) {
        const comp = await ctx.db.get(compId);
        if (!comp || comp.organizationId !== group.organizationId) {
          throw new Error(`Tax component ${compId} not found in organization`);
        }
      }
      patchData.componentIds = updates.componentIds;
    }

    if (updates.isDefault === true) {
      const existingGroups = await ctx.db
        .query("taxGroups")
        .withIndex("by_org", (q) => q.eq("organizationId", group.organizationId))
        .collect();

      for (const g of existingGroups) {
        if (g._id !== group._id && g.isDefault) {
          await ctx.db.patch(g._id, { isDefault: false, updatedAt: now });
        }
      }
      patchData.isDefault = true;
    } else if (updates.isDefault === false) {
      patchData.isDefault = false;
    }

    await ctx.db.patch(id, patchData);
    return { success: true };
  },
});

export const removeTaxGroup = mutation({
  args: { id: v.id("taxGroups") },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.id);
    if (!group) throw new Error("Tax group not found");

    await verifyOrgOwnership(ctx, group.organizationId);

    // Protect group if referenced in storeTaxSettings as defaultTaxGroupId
    const storeSettings = await ctx.db
      .query("storeTaxSettings")
      .withIndex("by_org", (q) => q.eq("organizationId", group.organizationId))
      .first();

    if (storeSettings && storeSettings.defaultTaxGroupId === group._id) {
      throw new Error("Cannot delete tax group referenced as default in store tax settings");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const setDefaultTaxGroup = mutation({
  args: { id: v.id("taxGroups") },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.id);
    if (!group) throw new Error("Tax group not found");

    await verifyOrgOwnership(ctx, group.organizationId);

    const existingGroups = await ctx.db
      .query("taxGroups")
      .withIndex("by_org", (q) => q.eq("organizationId", group.organizationId))
      .collect();

    const now = Date.now();
    for (const g of existingGroups) {
      await ctx.db.patch(g._id, {
        isDefault: g._id === args.id,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

// ==========================================
// STORE TAX SETTINGS & AUTO COUNTRY SETUP
// ==========================================

export const getStoreTaxSettings = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("storeTaxSettings")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .first();
  },
});

export const autoSetupStoreTaxation = mutation({
  args: {
    organizationId: v.id("organizations"),
    countryCode: v.string(), // "IN", "US", "CA", "AU", "UK"
    stateCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const code = args.countryCode.toUpperCase().trim();
    const now = Date.now();

    let currencyCode = "USD";
    let currencySymbol = "$";
    let defaultTaxMode: "inclusive" | "exclusive" = "exclusive";
    const componentDefs: Array<{ name: string; rate: number; code?: string }> = [];
    let groupName = "Standard Sales Tax";

    if (code === "IN") {
      currencyCode = "INR";
      currencySymbol = "₹";
      defaultTaxMode = "inclusive";
      groupName = "Food GST 5%";
      componentDefs.push({ name: "CGST", rate: 2.5, code: "CGST" });
      componentDefs.push({ name: "SGST", rate: 2.5, code: "SGST" });
    } else if (code === "US") {
      currencyCode = "USD";
      currencySymbol = "$";
      defaultTaxMode = "exclusive";
      groupName = "US Combined Sales Tax 8.5%";
      componentDefs.push({ name: "State Sales Tax", rate: 6.0, code: "STATE_TAX" });
      componentDefs.push({ name: "Local City Tax", rate: 2.5, code: "CITY_TAX" });
    } else if (code === "CA") {
      currencyCode = "CAD";
      currencySymbol = "$";
      defaultTaxMode = "exclusive";
      groupName = "Canada GST + PST 12%";
      componentDefs.push({ name: "Federal GST", rate: 5.0, code: "GST" });
      componentDefs.push({ name: "Provincial PST", rate: 7.0, code: "PST" });
    } else if (code === "AU") {
      currencyCode = "AUD";
      currencySymbol = "$";
      defaultTaxMode = "inclusive";
      groupName = "Australia GST 10%";
      componentDefs.push({ name: "Goods & Services Tax", rate: 10.0, code: "GST" });
    } else if (code === "UK" || code === "GB") {
      currencyCode = "GBP";
      currencySymbol = "£";
      defaultTaxMode = "inclusive";
      groupName = "UK Standard VAT 20%";
      componentDefs.push({ name: "Value Added Tax", rate: 20.0, code: "VAT" });
    } else {
      // Default fallback
      currencyCode = "USD";
      currencySymbol = "$";
      defaultTaxMode = "exclusive";
      groupName = "Standard Store Tax 5%";
      componentDefs.push({ name: "Store Tax", rate: 5.0 });
    }

    // 1. Create Tax Components
    const createdComponentIds: Array<any> = [];
    for (const comp of componentDefs) {
      const compId = await ctx.db.insert("taxComponents", {
        organizationId: args.organizationId,
        name: comp.name,
        rate: comp.rate,
        code: comp.code,
        createdAt: now,
      });
      createdComponentIds.push(compId);
    }

    // 2. Create Default Tax Group
    const taxGroupId = await ctx.db.insert("taxGroups", {
      organizationId: args.organizationId,
      name: groupName,
      taxMode: defaultTaxMode,
      componentIds: createdComponentIds,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });

    // 3. Save Store Tax Settings
    const existingSettings = await ctx.db
      .query("storeTaxSettings")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .first();

    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, {
        countryCode: code,
        stateCode: args.stateCode,
        currencyCode,
        currencySymbol,
        defaultTaxGroupId: taxGroupId,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("storeTaxSettings", {
        organizationId: args.organizationId,
        countryCode: code,
        stateCode: args.stateCode,
        currencyCode,
        currencySymbol,
        defaultTaxGroupId: taxGroupId,
        updatedAt: now,
      });
    }

    return {
      countryCode: code,
      currencyCode,
      currencySymbol,
      taxGroupId,
    };
  },
});

// ==========================================
// ITEM TAX CALCULATION UTILITY QUERY
// ==========================================

export const calculateItemTax = query({
  args: {
    organizationId: v.id("organizations"),
    price: v.number(), // Price in minor units (e.g. 25000 = 250.00)
    isGst: v.boolean(),
    taxGroupId: v.optional(v.id("taxGroups")),
  },
  handler: async (ctx, args) => {
    if (!args.isGst || args.price <= 0) {
      return {
        is_gst: false,
        tax_mode: "exclusive",
        total_tax_rate: 0,
        tax_amount: "0.00",
        base_price: (args.price / 100).toFixed(2),
        final_price: (args.price / 100).toFixed(2),
        components: [],
      };
    }

    // Resolve Tax Group
    let targetGroup: any = null;
    if (args.taxGroupId) {
      targetGroup = await ctx.db.get(args.taxGroupId);
    }

    if (!targetGroup) {
      // Fallback to store default tax group
      const defaultGroups = await ctx.db
        .query("taxGroups")
        .withIndex("by_org_default", (q) =>
          q.eq("organizationId", args.organizationId).eq("isDefault", true)
        )
        .collect();

      if (defaultGroups.length > 0) {
        targetGroup = defaultGroups[0];
      }
    }

    if (!targetGroup || targetGroup.componentIds.length === 0) {
      return {
        is_gst: true,
        tax_mode: "exclusive",
        total_tax_rate: 0,
        tax_amount: "0.00",
        base_price: (args.price / 100).toFixed(2),
        final_price: (args.price / 100).toFixed(2),
        components: [],
      };
    }

    // Fetch tax components
    const components: Array<any> = [];
    let totalTaxRate = 0;

    for (const compId of targetGroup.componentIds) {
      const comp = (await ctx.db.get(compId)) as any;
      if (comp) {
        components.push(comp);
        totalTaxRate += (comp as any).rate;
      }
    }

    const rawPrice = args.price / 100.0;
    let basePrice = rawPrice;
    let taxAmount = 0;
    let finalPrice = rawPrice;

    if (targetGroup.taxMode === "inclusive") {
      // Tax is included inside rawPrice: Tax = Price * (Rate / (100 + Rate))
      taxAmount = rawPrice * (totalTaxRate / (100 + totalTaxRate));
      basePrice = rawPrice - taxAmount;
      finalPrice = rawPrice;
    } else {
      // Tax is exclusive: Tax = Price * (Rate / 100)
      taxAmount = rawPrice * (totalTaxRate / 100.0);
      basePrice = rawPrice;
      finalPrice = rawPrice + taxAmount;
    }

    // Split component line calculations
    const componentBreakdown = components.map((comp) => {
      const compRatio = totalTaxRate > 0 ? comp.rate / totalTaxRate : 0;
      const compTaxVal = taxAmount * compRatio;
      return {
        name: comp.name,
        code: comp.code ?? comp.name,
        rate: comp.rate,
        tax_amount: compTaxVal.toFixed(2),
      };
    });

    return {
      is_gst: true,
      tax_mode: targetGroup.taxMode,
      tax_group_name: targetGroup.name,
      total_tax_rate: totalTaxRate,
      tax_amount: taxAmount.toFixed(2),
      base_price: basePrice.toFixed(2),
      final_price: finalPrice.toFixed(2),
      components: componentBreakdown,
    };
  },
});
