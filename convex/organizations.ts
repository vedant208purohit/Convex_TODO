import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByLegacyId = query({
  args: { legacyId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_legacy_id", (q) => q.eq("legacyId", args.legacyId))
      .first();
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("organizations").collect();
  },
});

export const create = mutation({
  args: {
    legacyId: v.string(),
    name: v.string(),
    slug: v.string(),
    legalEntityName: v.optional(v.string()),
    published: v.optional(v.boolean()),
    isTest: v.optional(v.boolean()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),

    // POS Feature Flags
    isDineIn: v.optional(v.boolean()),
    isTakeAway: v.optional(v.boolean()),
    isDashboard: v.optional(v.boolean()),
    isInventory: v.optional(v.boolean()),
    isOrders: v.optional(v.boolean()),
    isWorkstation: v.optional(v.boolean()),
    isCashier: v.optional(v.boolean()),
    isSettings: v.optional(v.boolean()),
    onlineStore: v.optional(v.boolean()),
    isDelivery: v.optional(v.boolean()),
    isMenu: v.optional(v.boolean()),
    isQueue: v.optional(v.boolean()),
    isKds: v.optional(v.boolean()),
    isSurveys: v.optional(v.boolean()),
    isCustomer: v.optional(v.boolean()),
    isCaptain: v.optional(v.boolean()),
    isReport: v.optional(v.boolean()),
    isVeg: v.optional(v.boolean()),
    digitalStoreStatus: v.optional(v.boolean()),

    // Payment Flags
    deliveryCashOnDelivery: v.optional(v.boolean()),
    dineinPrepaid: v.optional(v.boolean()),
    dineinPospaid: v.optional(v.boolean()),
    takeAwayOnlinePayment: v.optional(v.boolean()),
    takeAwayCashPayment: v.optional(v.boolean()),
    deliveryOnlinePayment: v.optional(v.boolean()),
    scheduledPickup: v.optional(v.boolean()),
    scheduledPickupOnlinePayment: v.optional(v.boolean()),
    scheduledDeliveryOnlinePayment: v.optional(v.boolean()),
    scheduledDelivery: v.optional(v.boolean()),
    scheduledPickupCashPayment: v.optional(v.boolean()),
    scheduledDeliveryCashPayment: v.optional(v.boolean()),
    paymentSplitting: v.optional(v.any()),
    transferPercentage: v.optional(v.number()),
    transferHoldTime: v.optional(v.number()),

    // Delivery Config
    deliveryAggregator: v.optional(v.boolean()),
    deliverPartner: v.optional(v.string()),
    porterLagTime: v.optional(v.number()),

    // Integrations
    frenchyId: v.optional(v.string()),
    chargebeeCustomerId: v.optional(v.string()),
    whatsappIntegration: v.optional(v.boolean()),
    prestWhatsappIntegration: v.optional(v.boolean()),
    whatsappPhoneNumber: v.optional(v.string()),
    whatsappAccessToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_legacy_id", (q) => q.eq("legacyId", args.legacyId))
      .first();

    if (existing) {
      throw new Error(`Organization with legacyId "${args.legacyId}" already exists.`);
    }

    const now = Date.now();

    return await ctx.db.insert("organizations", {
      legacyId: args.legacyId,
      name: args.name,
      slug: args.slug,
      legalEntityName: args.legalEntityName,
      published: args.published ?? false,
      isTest: args.isTest ?? false,
      createdAt: args.createdAt ?? now,
      updatedAt: args.updatedAt ?? now,
      deletedAt: args.deletedAt,

      // POS Feature Defaults (matching PostgreSQL defaults)
      isDineIn: args.isDineIn ?? false,
      isTakeAway: args.isTakeAway ?? true,
      isDashboard: args.isDashboard ?? true,
      isInventory: args.isInventory ?? false,
      isOrders: args.isOrders ?? true,
      isWorkstation: args.isWorkstation ?? false,
      isCashier: args.isCashier ?? true,
      isSettings: args.isSettings ?? true,
      onlineStore: args.onlineStore ?? false,
      isDelivery: args.isDelivery ?? false,
      isMenu: args.isMenu ?? false,
      isQueue: args.isQueue ?? false,
      isKds: args.isKds ?? false,
      isSurveys: args.isSurveys ?? false,
      isCustomer: args.isCustomer ?? true,
      isCaptain: args.isCaptain ?? false,
      isReport: args.isReport ?? false,
      isVeg: args.isVeg ?? true,
      digitalStoreStatus: args.digitalStoreStatus ?? false,

      // Payment Config Defaults
      deliveryCashOnDelivery: args.deliveryCashOnDelivery ?? false,
      dineinPrepaid: args.dineinPrepaid ?? false,
      dineinPospaid: args.dineinPospaid ?? false,
      takeAwayOnlinePayment: args.takeAwayOnlinePayment ?? false,
      takeAwayCashPayment: args.takeAwayCashPayment ?? false,
      deliveryOnlinePayment: args.deliveryOnlinePayment ?? false,
      scheduledPickup: args.scheduledPickup ?? false,
      scheduledPickupOnlinePayment: args.scheduledPickupOnlinePayment ?? false,
      scheduledDeliveryOnlinePayment: args.scheduledDeliveryOnlinePayment ?? false,
      scheduledDelivery: args.scheduledDelivery ?? false,
      scheduledPickupCashPayment: args.scheduledPickupCashPayment ?? false,
      scheduledDeliveryCashPayment: args.scheduledDeliveryCashPayment ?? false,
      paymentSplitting: args.paymentSplitting,
      transferPercentage: args.transferPercentage ?? 0.0,
      transferHoldTime: args.transferHoldTime ?? 0,

      // Delivery Defaults
      deliveryAggregator: args.deliveryAggregator ?? false,
      deliverPartner: args.deliverPartner,
      porterLagTime: args.porterLagTime ?? 0,

      // Integrations
      frenchyId: args.frenchyId,
      chargebeeCustomerId: args.chargebeeCustomerId,
      whatsappIntegration: args.whatsappIntegration ?? false,
      prestWhatsappIntegration: args.prestWhatsappIntegration ?? false,
      whatsappPhoneNumber: args.whatsappPhoneNumber,
      whatsappAccessToken: args.whatsappAccessToken,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("organizations"),
    name: v.optional(v.string()),
    legalEntityName: v.optional(v.string()),
    published: v.optional(v.boolean()),
    isTest: v.optional(v.boolean()),
    isDineIn: v.optional(v.boolean()),
    isTakeAway: v.optional(v.boolean()),
    isDashboard: v.optional(v.boolean()),
    isInventory: v.optional(v.boolean()),
    isOrders: v.optional(v.boolean()),
    isWorkstation: v.optional(v.boolean()),
    isCashier: v.optional(v.boolean()),
    isSettings: v.optional(v.boolean()),
    onlineStore: v.optional(v.boolean()),
    isDelivery: v.optional(v.boolean()),
    isMenu: v.optional(v.boolean()),
    isQueue: v.optional(v.boolean()),
    isKds: v.optional(v.boolean()),
    isSurveys: v.optional(v.boolean()),
    isCustomer: v.optional(v.boolean()),
    isCaptain: v.optional(v.boolean()),
    isReport: v.optional(v.boolean()),
    isVeg: v.optional(v.boolean()),
    digitalStoreStatus: v.optional(v.boolean()),
    deliveryCashOnDelivery: v.optional(v.boolean()),
    dineinPrepaid: v.optional(v.boolean()),
    dineinPospaid: v.optional(v.boolean()),
    takeAwayOnlinePayment: v.optional(v.boolean()),
    takeAwayCashPayment: v.optional(v.boolean()),
    deliveryOnlinePayment: v.optional(v.boolean()),
    scheduledPickup: v.optional(v.boolean()),
    scheduledPickupOnlinePayment: v.optional(v.boolean()),
    scheduledDeliveryOnlinePayment: v.optional(v.boolean()),
    scheduledDelivery: v.optional(v.boolean()),
    scheduledPickupCashPayment: v.optional(v.boolean()),
    scheduledDeliveryCashPayment: v.optional(v.boolean()),
    paymentSplitting: v.optional(v.any()),
    transferPercentage: v.optional(v.number()),
    transferHoldTime: v.optional(v.number()),
    deliveryAggregator: v.optional(v.boolean()),
    deliverPartner: v.optional(v.string()),
    porterLagTime: v.optional(v.number()),
    whatsappIntegration: v.optional(v.boolean()),
    whatsappPhoneNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
