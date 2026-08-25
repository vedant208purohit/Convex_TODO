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
    legacyId: v.optional(v.string()), // PostgreSQL Organization UUID (optional for Convex-native orgs)

    // Core Identity & Metadata
    name: v.string(),
    slug: v.string(),
    legalEntityName: v.optional(v.string()),
    published: v.boolean(),
    isTest: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),

    // Store Contact, Location & Compliance Details
    phone: v.optional(v.string()),
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    landmark: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    mobile: v.optional(v.string()),
    email: v.optional(v.string()),
    fax: v.optional(v.string()),
    areaCode: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    operationTiming: v.optional(v.any()), // Weekly operating hours JSON grid

    // GST Tax Compliance Configuration
    isGst: v.boolean(),
    inclusiveGst: v.boolean(),
    separateGst: v.boolean(),
    gstNumber: v.optional(v.string()),

    // FSSAI Food Safety Compliance Configuration
    isFssai: v.boolean(),
    fssaiRegistrationNumber: v.optional(v.string()),
    expiryDate: v.optional(v.number()),

    // Currency & Regional Timezone Configuration
    defaultCurrency: v.optional(v.string()),
    defaultCurrencySymbol: v.optional(v.string()),
    organizationTimeZone: v.optional(v.string()),

    // Hardware & Printing Configuration
    receiptPrintCount: v.number(),
    menuBasedPrintToken: v.boolean(),
    showQrCode: v.boolean(),

    // Branding Configuration
    primaryColor: v.optional(v.string()),
    secondaryColor: v.optional(v.string()),
    theme: v.optional(v.string()),

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

    // Payment Gateway Credentials & Secrets
    razorPayKeyId: v.optional(v.string()),
    razorPayApiKey: v.optional(v.string()), // Sensitive credential
    stripePublishableKey: v.optional(v.string()),
    stripeSecretKey: v.optional(v.string()), // Sensitive credential

    // Delivery Configuration
    deliveryAggregator: v.boolean(),
    deliverPartner: v.optional(v.string()),
    porterLagTime: v.number(),
    porterIntegration: v.optional(v.any()), // Porter logistics metadata JSON

    // Integration & External Reference Fields
    frenchyId: v.optional(v.string()),
    chargebeeCustomerId: v.optional(v.string()),
    whatsappIntegration: v.boolean(),
    prestWhatsappIntegration: v.boolean(),
    whatsappPhoneNumber: v.optional(v.string()),
    whatsappAccessToken: v.optional(v.string()), // Sensitive credential

    // Provisioning & Owner Metadata
    ownerClerkId: v.optional(v.string()),
    provisioningToken: v.optional(v.string()),
    timestamp: v.optional(v.number()),
  })
    .index("by_legacy_id", ["legacyId"])
    .index("by_slug", ["slug"]),

  // Phase 1 Seeded Support Entities
  orderProcesses: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    stepOrder: v.number(),
    createdAt: v.number(),
  }).index("by_org", ["organizationId"]),

  stations: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    isMain: v.boolean(),
    createdAt: v.number(),
  }).index("by_org", ["organizationId"]),

  paymentModes: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    active: v.boolean(),
    createdAt: v.number(),
  }).index("by_org", ["organizationId"]),

  inventoryCategories: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_org", ["organizationId"]),

  // Organization Users Domain Table
  organizationUsers: defineTable({
    organizationId: v.id("organizations"),
    userId: v.string(), // Clerk User ID (identity.subject)
    userType: v.array(v.string()), // Array of string role/type tags (e.g. ["admin", "orders", "inventory"])
    userPermission: v.optional(v.any()), // JSON object mapping role tags to CRUD boolean flags
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()), // Soft-deletion timestamp
  })
    .index("by_user", ["userId"])
    .index("by_org", ["organizationId"])
    .index("by_user_and_org", ["userId", "organizationId"]),

  // Organization Languages Domain Table
  organizationLanguages: defineTable({
    legacyId: v.optional(v.string()),
    name: v.string(),
    code: v.string(),
    isDefault: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_legacy_id", ["legacyId"]),
});

