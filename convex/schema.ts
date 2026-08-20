// import { defineSchema, defineTable } from "convex/server";
// import { v } from "convex/values";

// export default defineSchema({
//   organizations: defineTable({
//     // Legacy PostgreSQL Identity
//     legacyId: v.string(), // PostgreSQL Organization UUID

//     // Core Identity & Metadata
//     name: v.string(),
//     slug: v.string(),
//     legalEntityName: v.optional(v.string()),
//     published: v.boolean(),
//     isTest: v.boolean(),
//     createdAt: v.number(),
//     updatedAt: v.number(),
//     deletedAt: v.optional(v.number()),

//     // POS Feature & Module Configuration
//     isDineIn: v.boolean(),
//     isTakeAway: v.boolean(),
//     isDashboard: v.boolean(),
//     isInventory: v.boolean(),
//     isOrders: v.boolean(),
//     isWorkstation: v.boolean(),
//     isCashier: v.boolean(),
//     isSettings: v.boolean(),
//     onlineStore: v.boolean(),
//     isDelivery: v.boolean(),
//     isMenu: v.boolean(),
//     isQueue: v.boolean(),
//     isKds: v.boolean(),
//     isSurveys: v.boolean(),
//     isCustomer: v.boolean(),
//     isCaptain: v.boolean(),
//     isReport: v.boolean(),
//     isVeg: v.boolean(),
//     digitalStoreStatus: v.boolean(),

//     // Payment Configuration
//     deliveryCashOnDelivery: v.boolean(),
//     dineinPrepaid: v.boolean(),
//     dineinPospaid: v.boolean(),
//     takeAwayOnlinePayment: v.boolean(),
//     takeAwayCashPayment: v.boolean(),
//     deliveryOnlinePayment: v.boolean(),
//     scheduledPickup: v.boolean(),
//     scheduledPickupOnlinePayment: v.boolean(),
//     scheduledDeliveryOnlinePayment: v.boolean(),
//     scheduledDelivery: v.boolean(),
//     scheduledPickupCashPayment: v.boolean(),
//     scheduledDeliveryCashPayment: v.boolean(),
//     paymentSplitting: v.optional(v.any()), // JSON structure in PostgreSQL
//     transferPercentage: v.number(),
//     transferHoldTime: v.number(),

//     // Delivery Configuration
//     deliveryAggregator: v.boolean(),
//     deliverPartner: v.optional(v.string()),
//     porterLagTime: v.number(),

//     // Integration & External Reference Fields
//     frenchyId: v.optional(v.string()),
//     chargebeeCustomerId: v.optional(v.string()),
//     whatsappIntegration: v.boolean(),
//     prestWhatsappIntegration: v.boolean(),
//     whatsappPhoneNumber: v.optional(v.string()),
//     whatsappAccessToken: v.optional(v.string()), // Security note: Requires secret storage review
//   })
//     .index("by_legacy_id", ["legacyId"])
//     .index("by_slug", ["slug"]),
// });


import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  organizations: defineTable({
    // Legacy PostgreSQL Identity
    legacyId: v.optional(v.string()), // PostgreSQL Organization UUID

    // Core Identity & Metadata
    name: v.string(),
    slug: v.string(),
    legalEntityName: v.optional(v.string()),
    published: v.boolean(),
    isTest: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),

    // POS Feature & Module Configuration
    isDineIn: v.boolean(),
    isTakeAway: v.boolean(),
    isDashboard: v.boolean(),
    isInventory: v.boolean(),
    isOrders: v.boolean(),
    isWorkstation: v.boolean(),
    isCashier: v.boolean(),
    isSettings: v.boolean(),
    onlineStore: v.boolean(),
    isDelivery: v.boolean(),
    isMenu: v.boolean(),
    isQueue: v.boolean(),
    isKds: v.boolean(),
    isSurveys: v.boolean(),
    isCustomer: v.boolean(),
    isCaptain: v.boolean(),
    isReport: v.boolean(),
    isVeg: v.boolean(),
    digitalStoreStatus: v.boolean(),

    // Payment Configuration
    deliveryCashOnDelivery: v.boolean(),
    dineinPrepaid: v.boolean(),
    dineinPospaid: v.boolean(),
    takeAwayOnlinePayment: v.boolean(),
    takeAwayCashPayment: v.boolean(),
    deliveryOnlinePayment: v.boolean(),
    scheduledPickup: v.boolean(),
    scheduledPickupOnlinePayment: v.boolean(),
    scheduledDeliveryOnlinePayment: v.boolean(),
    scheduledDelivery: v.boolean(),
    scheduledPickupCashPayment: v.boolean(),
    scheduledDeliveryCashPayment: v.boolean(),
    paymentSplitting: v.optional(v.any()), // JSON structure in PostgreSQL
    transferPercentage: v.number(),
    transferHoldTime: v.number(),

    // Delivery Configuration
    deliveryAggregator: v.boolean(),
    deliverPartner: v.optional(v.string()),
    porterLagTime: v.number(),

    // Integration & External Reference Fields
    frenchyId: v.optional(v.string()),
    chargebeeCustomerId: v.optional(v.string()),
    whatsappIntegration: v.boolean(),
    prestWhatsappIntegration: v.boolean(),
    whatsappPhoneNumber: v.optional(v.string()),
    whatsappAccessToken: v.optional(v.string()), // Security note: Requires secret storage review
  })
    .index("by_legacy_id", ["legacyId"])
    .index("by_slug", ["slug"]),
}, { schemaValidation: false });