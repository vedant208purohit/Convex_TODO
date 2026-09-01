import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  organizations: defineTable({
    // Legacy PostgreSQL Identity
    legacyId: v.optional(v.string()),

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
    operationTiming: v.optional(v.any()),

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
    paymentSplitting: v.optional(v.any()),
    transferPercentage: v.number(),
    transferHoldTime: v.number(),

    // Payment Gateway Credentials & Secrets
    razorPayKeyId: v.optional(v.string()),
    razorPayApiKey: v.optional(v.string()),
    stripePublishableKey: v.optional(v.string()),
    stripeSecretKey: v.optional(v.string()),

    // Delivery Configuration
    deliveryAggregator: v.boolean(),
    deliverPartner: v.optional(v.string()),
    porterLagTime: v.number(),
    porterIntegration: v.optional(v.any()),

    // Integration & External Reference Fields
    frenchyId: v.optional(v.string()),
    chargebeeCustomerId: v.optional(v.string()),
    whatsappIntegration: v.boolean(),
    prestWhatsappIntegration: v.boolean(),
    whatsappPhoneNumber: v.optional(v.string()),
    whatsappAccessToken: v.optional(v.string()),

    // Provisioning & Owner Metadata
    ownerClerkId: v.optional(v.string()),
    provisioningToken: v.optional(v.string()),
    timestamp: v.optional(v.number()),
  })
    .index("by_legacy_id", ["legacyId"])
    .index("by_slug", ["slug"]),

  // Phase 1 Seeded Support Entities
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
    userId: v.string(),
    userType: v.array(v.string()),
    userPermission: v.optional(v.any()),
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_org", ["organizationId"])
    .index("by_user_and_org", ["userId", "organizationId"]),

  // Organization Feature Flags
  organizationFeatures: defineTable({
    organizationId: v.optional(v.id("organizations")),
    featureKey: v.string(),
    active: v.boolean(),
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_feature_key", ["featureKey"])
    .index("by_active", ["active"])
    .index("by_org", ["organizationId"]),

  // Multi-Menu Domain Entities
  menus: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    isDefault: v.boolean(),
    isActive: v.boolean(),
    position: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_default", ["organizationId", "isDefault"]),

  categories: defineTable({
    organizationId: v.id("organizations"),
    menuId: v.id("menus"),
    name: v.string(),
    position: v.number(),
    published: v.boolean(),
    name_hi: v.optional(v.string()),
    name_gu: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_menu", ["menuId"])
    .index("by_org", ["organizationId"]),

  items: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    price: v.number(),
    description: v.optional(v.string()),
    published: v.boolean(),
    isAvailable: v.boolean(),
    isGst: v.boolean(),
    isVeg: v.boolean(),
    isSpicy: v.boolean(),
    showQuantity: v.boolean(),
    quantity: v.optional(v.number()),
    quantityUnit: v.optional(v.string()),
    skuNumber: v.optional(v.string()),
    markAsBestseller: v.boolean(),
    favouriteItem: v.optional(v.boolean()),
    showCalorie: v.boolean(),
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
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_org", ["organizationId"]),

  categoryItems: defineTable({
    organizationId: v.id("organizations"),
    categoryId: v.id("categories"),
    itemId: v.id("items"),
    position: v.number(),
    published: v.boolean(),
    createdAt: v.number(),
  }).index("by_category", ["categoryId"]),

  itemTypes: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    icon: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_org", ["organizationId"]),

  customizations: defineTable({
    organizationId: v.id("organizations"),
    itemId: v.id("items"),
    name: v.string(),
    customizationType: v.union(
      v.literal("AddOns"),
      v.literal("Preparations")
    ),
    required: v.boolean(),
    maxSelected: v.number(),
    position: v.number(),
    published: v.boolean(),
    createdAt: v.number(),
  }).index("by_item", ["itemId"]),

  customizationItems: defineTable({
    organizationId: v.id("organizations"),
    customizationId: v.id("customizations"),
    name: v.string(),
    price: v.number(),
    isGst: v.optional(v.boolean()),
    showQuantity: v.optional(v.boolean()),
    quantity: v.optional(v.number()),
    quantityUnit: v.optional(v.string()),
    description: v.optional(v.string()),
    showCalorie: v.optional(v.boolean()),
    calorie: v.optional(v.string()),
    calorieMetric: v.optional(v.string()),
    daysOfUnavailable: v.optional(v.number()),
    isAvailable: v.boolean(),
    position: v.number(),
    itemTypeIds: v.optional(v.array(v.id("itemTypes"))),
    imageStorageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
  }).index("by_customization", ["customizationId"]),

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

  // Organization Layouts Domain Table
  organizationLayouts: defineTable({
    legacyId: v.optional(v.string()),
    name: v.string(),
    displayOrder: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_name", ["name"])
    .index("by_legacy_id", ["legacyId"]),
  // Organization Printers Domain Table
  organizationPrinters: defineTable({
    legacyId: v.optional(v.string()),
    printerUrl: v.string(),
    printerPort: v.optional(v.string()),
    printerType: v.union(
      v.literal("Lan"),
      v.literal("Bluetooth"),
      v.literal("Usb")
    ),
    printerUseFor: v.union(
      v.literal("Cashier"),
      v.literal("Station"),
      v.literal("WorkStation")
    ),
    stationId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_use_for", ["printerUseFor"])
    .index("by_station", ["stationId"])
    .index("by_legacy_id", ["legacyId"]),
  // Organization Order Processes Domain Table
  organizationOrderProcesses: defineTable({
    legacyId: v.optional(v.string()),
    name: v.string(),
    position: v.number(),
    published: v.boolean(),
    isSequence: v.boolean(),
    processColor: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_position", ["isSequence", "position"])
    .index("by_published", ["published"])
    .index("by_legacy_id", ["legacyId"]),
  // International Taxation Domain Entities
  taxComponents: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    rate: v.number(),
    code: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_org", ["organizationId"]),
  taxGroups: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    taxMode: v.union(
      v.literal("inclusive"),
      v.literal("exclusive")
    ),
    componentIds: v.array(v.id("taxComponents")),
    isDefault: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_default", ["organizationId", "isDefault"]),
  storeTaxSettings: defineTable({
    organizationId: v.id("organizations"),
    countryCode: v.string(),
    stateCode: v.optional(v.string()),
    currencyCode: v.string(),
    currencySymbol: v.string(),
    defaultTaxGroupId: v.optional(v.id("taxGroups")),
    updatedAt: v.number(),
  }).index("by_org", ["organizationId"]),
  // Organization Tables Domain Table
  organizationTables: defineTable({
    legacyId: v.optional(v.string()),
    tableNumber: v.string(),
    seatingCapacity: v.number(),
    placement: v.optional(v.string()),
    xPosition: v.optional(v.string()),
    yPosition: v.optional(v.string()),
    kidsSeatAvailability: v.optional(v.boolean()),
    disabledSeatAvailability: v.optional(v.boolean()),
    barbequeGrillAvailability: v.optional(v.boolean()),
    isBlock: v.optional(v.boolean()),
    isRequested: v.optional(v.boolean()),
    currentOrderId: v.optional(v.string()),
    layoutId: v.optional(v.id("organizationLayouts")),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_layout", ["layoutId"])
    .index("by_table_number", ["tableNumber"])
    .index("by_legacy_id", ["legacyId"]),
}, { schemaValidation: false });