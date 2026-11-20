import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Strongly Typed Weekly Operating Schedule Validator for Queue Configurations
const hourIntervalValidator = v.object({
  start_time: v.string(),
  end_time: v.string(),
});

const dayScheduleValidator = v.object({
  is_open: v.boolean(),
  hours: v.array(hourIntervalValidator),
});

export const weeklyScheduleValidator = v.object({
  Monday: dayScheduleValidator,
  Tuesday: dayScheduleValidator,
  Wednesday: dayScheduleValidator,
  Thursday: dayScheduleValidator,
  Friday: dayScheduleValidator,
  Saturday: dayScheduleValidator,
  Sunday: dayScheduleValidator,
});

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
    gstDocumentStorageId: v.optional(v.id("_storage")),
    gstDocumentAssetId: v.optional(v.id("organization_assets")),
    gstDocumentUrl: v.optional(v.string()),

    // FSSAI Food Safety Compliance Configuration
    isFssai: v.boolean(),
    fssaiRegistrationNumber: v.optional(v.string()),
    expiryDate: v.optional(v.number()),
    fssaiDocumentStorageId: v.optional(v.id("_storage")),
    fssaiDocumentAssetId: v.optional(v.id("organization_assets")),
    fssaiDocumentUrl: v.optional(v.string()),

    // Currency & Regional Timezone Configuration
    defaultCurrency: v.optional(v.string()),
    defaultCurrencySymbol: v.optional(v.string()),
    organizationTimeZone: v.optional(v.string()),

    // Hardware & Printing Configuration
    receiptPrintCount: v.number(),
    menuBasedPrintToken: v.boolean(),
    showQrCode: v.boolean(),
    autoCutPaper: v.optional(v.boolean()),
    popCashDrawer: v.optional(v.boolean()),

    // Branding Configuration
    primaryColor: v.optional(v.string()),
    secondaryColor: v.optional(v.string()),
    theme: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    logoAssetId: v.optional(v.id("organization_assets")),

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

    // Digital Store Configuration
    aboutUsContent: v.optional(v.string()),
    facebookAccountLink: v.optional(v.string()),
    instagramAccountLink: v.optional(v.string()),
    policyLink: v.optional(v.string()),
    refundLink: v.optional(v.string()),
    termAndConditionLink: v.optional(v.string()),
    aboutUsImageStorageId: v.optional(v.id("_storage")),
    aboutUsImageUrl: v.optional(v.string()),

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
    activePaymentGateway: v.optional(v.string()), // "razorpay" | "stripe" | "none"
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

    // Onboarding State & Attributes
    onboardingCompleted: v.optional(v.boolean()),
    onboardingStep: v.optional(v.number()),
    onboardingCompletedAt: v.optional(v.number()),
    businessType: v.optional(v.string()), // "fsg" | "qsr" | "fc" | "cafe" | "bakery" | "bar" | "truck" | "ghost" | "other"
    locationsCount: v.optional(v.string()), // "one" | "multiple"
    floorModel: v.optional(v.string()), // "table" | "counter" | "hybrid"
    deliveryFleetType: v.optional(v.string()), // "inhouse" | "thirdparty" | "blended"
    operatingHoursTemplate: v.optional(v.string()), // "standard" | "custom" | "later"
    suiteUnit: v.optional(v.string()),
    language: v.optional(v.string()),
    onboardingDismissedBanner: v.optional(v.boolean()),
    onboardingChecklist: v.optional(v.array(v.number())),
  })
    .index("by_legacy_id", ["legacyId"])
    .index("by_slug", ["slug"]),

  // Phase 1 Seeded Support Entities
  stations: defineTable({
    legacyId: v.optional(v.string()),
    organizationId: v.id("organizations"),
    name: v.string(),
    isMain: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_deleted", ["organizationId", "deletedAt"])
    .index("by_legacy_id", ["legacyId"]),

  stationItems: defineTable({
    legacyId: v.optional(v.string()),
    organizationId: v.id("organizations"),
    stationId: v.id("stations"),
    itemId: v.id("items"),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_station", ["organizationId", "stationId"])
    .index("by_org_item", ["organizationId", "itemId"])
    .index("by_station_item", ["stationId", "itemId"])
    .index("by_legacy_id", ["legacyId"]),

  paymentModes: defineTable({
    legacyId: v.optional(v.string()),
    organizationId: v.id("organizations"),
    name: v.string(),
    active: v.boolean(),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_active", ["organizationId", "active"])
    .index("by_legacy_id", ["legacyId"]),

  inventoryCategories: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_org", ["organizationId"]),

  // Organization Users Domain Table
  organizationUsers: defineTable({
    organizationId: v.id("organizations"),
    userId: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    userType: v.array(v.string()),
    userPermission: v.optional(v.any()),
    status: v.optional(v.string()), // "invited" | "active" | "inactive" | "suspended"
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_org", ["organizationId"])
    .index("by_user_and_org", ["userId", "organizationId"])
    .index("by_email", ["email"]),

  // Customer Domain Table (Migrated from legacy Rails users where user_type includes 'customer')
  customers: defineTable({
    // Legacy PostgreSQL Migration Tracking
    legacyId: v.optional(v.string()),

    // Identity & Contact Details
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.string(),
    countryCode: v.optional(v.string()),
    email: v.optional(v.string()),

    // Payment Gateway Identifier (e.g. Razorpay Customer ID from legacy user.razorpay_customer_id)
    razorpayCustomerId: v.optional(v.string()),

    // Clerk Identity & Phone Verification Status
    clerkUserId: v.optional(v.string()),
    isPhoneVerified: v.optional(v.boolean()),
    phoneVerifiedAt: v.optional(v.number()),

    // Optional Avatar Asset / Storage reference
    avatarStorageId: v.optional(v.id("_storage")),
    avatarAssetId: v.optional(v.id("organization_assets")),

    // Standard Timestamps & Soft Deletion
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_phone", ["phone"])
    .index("by_email", ["email"])
    .index("by_legacy_id", ["legacyId"])
    .index("by_clerk_user_id", ["clerkUserId"]),

  // Customer Addresses Domain Table (Migrated from legacy Rails user_addresses)
  userAddresses: defineTable({
    // Legacy PostgreSQL Migration Tracking
    legacyId: v.optional(v.string()),

    // Customer Relationship
    customerId: v.id("customers"),

    // Address Details
    addressLine1: v.string(),
    addressLine2: v.optional(v.string()),
    landmark: v.optional(v.string()),
    city: v.string(),
    zipCode: v.string(),
    otherLocationDetail: v.optional(v.string()),
    addressType: v.string(), // "Home", "Work", "Other", etc.

    // Geocoordinates (Decimal in Rails)
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),

    // Formatted & Delivery Notes
    completeAddress: v.optional(v.string()),
    deliveryInstructions: v.optional(v.string()),

    // Default Address Flag
    isDefault: v.optional(v.boolean()),

    // Standard Timestamps & Soft Deletion
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_customer", ["customerId"])
    .index("by_legacy_id", ["legacyId"]),

  // Customer Mobile Phone OTP Verification Domain Table
  customerPhoneVerifications: defineTable({
    phone: v.string(), // E.164 normalized phone, e.g. "+919876543210"
    countryCode: v.string(), // e.g. "+91"
    otpHash: v.string(), // Secure SHA-256 hash of normalized phone + OTP + secret
    expiresAt: v.number(), // Expiration timestamp ms
    attempts: v.number(), // Failed verification count
    maxAttempts: v.number(), // Max attempts allowed (e.g. 5)
    resendAvailableAt: v.number(), // Cooldown timestamp ms
    verifiedAt: v.optional(v.number()),
    clerkUserId: v.string(), // Associated Clerk user subject
    organizationId: v.optional(v.id("organizations")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_phone", ["phone"])
    .index("by_clerk_user", ["clerkUserId"])
    .index("by_phone_and_user", ["phone", "clerkUserId"]),

  // Master Global Features Catalog (Super Admin & Base Features)
  features: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    displayName: v.optional(v.string()),
    displayDescription: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_name", ["name"]),

  // Organization Feature Flags (Per-store runtime active toggles)
  organizationFeatures: defineTable({
    organizationId: v.optional(v.id("organizations")),
    featureId: v.optional(v.id("features")),
    featureKey: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    displayName: v.optional(v.string()),
    displayDescription: v.optional(v.string()),
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
    deletedAt: v.optional(v.number()),
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
    deletedAt: v.optional(v.number()),
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
    showItemType: v.optional(v.boolean()),
    taxGroupId: v.optional(v.id("taxGroups")),
    taxMode: v.optional(v.union(v.literal("inclusive"), v.literal("exclusive"))),
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
    protein: v.optional(v.string()),
    carbs: v.optional(v.string()),
    fat: v.optional(v.string()),
    fiber: v.optional(v.string()),
    sugar: v.optional(v.string()),
    sodium: v.optional(v.string()),
    showAllergenContents: v.optional(v.boolean()),
    allergens: v.optional(v.array(v.string())),
    nutrients: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          quantity: v.optional(v.string()),
          dailyValue: v.optional(v.string()),
          children: v.optional(
            v.array(
              v.object({
                id: v.string(),
                name: v.string(),
                quantity: v.optional(v.string()),
                dailyValue: v.optional(v.string()),
              })
            )
          ),
        })
      )
    ),
    itemTypeIds: v.optional(v.array(v.id("itemTypes"))),
    imageStorageId: v.optional(v.id("_storage")),
    imageAssetId: v.optional(v.id("organization_assets")),
    threeDModelStorageId: v.optional(v.id("_storage")),
    threeDModelAssetId: v.optional(v.id("organization_assets")),
    threeDModelIosStorageId: v.optional(v.id("_storage")),
    threeDModelIosAssetId: v.optional(v.id("organization_assets")),
    videoStorageId: v.optional(v.id("_storage")),
    videoAssetId: v.optional(v.id("organization_assets")),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index("by_org", ["organizationId"]),

  categoryItems: defineTable({
    organizationId: v.id("organizations"),
    categoryId: v.id("categories"),
    itemId: v.id("items"),
    position: v.number(),
    published: v.boolean(),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index("by_category", ["categoryId"]),

  itemTypes: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    icon: v.optional(v.string()),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
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
    deletedAt: v.optional(v.number()),
  })
    .index("by_item", ["itemId"])
    .index("by_org", ["organizationId"]),

  customizationItems: defineTable({
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
    isAvailable: v.boolean(),
    position: v.number(),
    itemTypeIds: v.optional(v.array(v.id("itemTypes"))),
    imageStorageId: v.optional(v.id("_storage")),
    imageAssetId: v.optional(v.id("organization_assets")),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index("by_customization", ["customizationId"]),

  // Chef Prep Preferences Master Table
  chefPrepPreferences: defineTable({
    legacyId: v.optional(v.string()),
    organizationId: v.id("organizations"),
    name: v.string(),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
    isActive: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_name", ["organizationId", "name"])
    .index("by_org_deleted", ["organizationId", "deletedAt"]),

  // Item to Chef Prep Preferences Junction Table (Normalized Multi-Relationship)
  itemChefPrepPreferences: defineTable({
    legacyId: v.optional(v.string()),
    organizationId: v.id("organizations"),
    itemId: v.id("items"),
    preferenceId: v.id("chefPrepPreferences"),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_org", ["organizationId"])
    .index("by_item", ["itemId"])
    .index("by_preference", ["preferenceId"])
    .index("by_item_preference", ["itemId", "preferenceId"])
    .index("by_org_preference", ["organizationId", "preferenceId"]),

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
    description: v.optional(v.string()),
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

  // Digital Storefront Images Domain Table (Migrated from legacy ssr_images)
digitalStoreImages: defineTable({
  legacyId: v.optional(v.string()),

  assetId: v.optional(v.id("organization_assets")),
  storageId: v.optional(v.id("_storage")),

  imageType: v.union(
    v.literal("carousel_image"),
    v.literal("about_us_image")
  ),

  position: v.number(),

  createdAt: v.number(),
  updatedAt: v.number(),
  deletedAt: v.optional(v.number()),
})
  .index("by_type_and_position", ["imageType", "position"])
  .index("by_image_type", ["imageType"])
  .index("by_asset", ["assetId"])
  .index("by_legacy_id", ["legacyId"]),

// Postpaid Order Requests Domain Table
postpaidOrderRequests: defineTable({
  tableId: v.id("organizationTables"),
  userId: v.string(),
  orderId: v.optional(v.id("orders")),

  status: v.union(
    v.literal("requested"),
    v.literal("approved"),
    v.literal("declined"),
    v.literal("completed")
  ),

  statusActionById: v.optional(v.string()),

  otpHash: v.optional(v.string()),
  otpExpiresAt: v.optional(v.number()),
  otpVerifiedAt: v.optional(v.number()),
  otpAttempts: v.optional(v.number()),

  createdAt: v.number(),
  updatedAt: v.number(),
  deletedAt: v.optional(v.number()),
})
  .index("by_table", ["tableId"])
  .index("by_table_and_status", ["tableId", "status"])
  .index("by_user", ["userId"])
  .index("by_order", ["orderId"])
  .index("by_status", ["status"]),

  // Order Delivery / 3PL Logistics Domain Table (Migrated from legacy order_delivers)
  orderDelivers: defineTable({
    // Legacy PostgreSQL Migration Tracking
    legacyId: v.optional(v.string()),

    // Relationship to Store Order
    orderId: v.id("orders"),

    // Delivery Provider & Status Classification
    provider: v.union(
      v.literal("porter"),
      v.literal("internal"),
      v.literal("custom")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("open"),
      v.literal("accepted"),
      v.literal("live"),
      v.literal("ended"),
      v.literal("cancelled"),
      v.literal("failed")
    ),

    // External Provider Identifiers & Tracking
    providerOrderId: v.optional(v.string()),
    trackingUrl: v.optional(v.string()),

    // Financials (Delivery Fee in Minor Units / Paise / Cents) - Optional for historical migration compatibility
    fare: v.optional(v.number()),

    // Assigned Delivery Partner / Driver Details
    partnerInfo: v.optional(
      v.object({
        name: v.optional(v.string()),
        vehicleNumber: v.optional(v.string()),
        vehicleType: v.optional(v.string()),
        phone: v.optional(v.string()),
        secondaryPhone: v.optional(v.string()),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
      })
    ),

    // Timing Estimates & Actual Milestones
    estimatedPickupTime: v.optional(v.number()),
    orderTimings: v.optional(
      v.object({
        orderAcceptedTime: v.optional(v.number()),
        pickupTime: v.optional(v.number()),
        orderStartedTime: v.optional(v.number()),
        orderEndedTime: v.optional(v.number()),
      })
    ),

    // Outbound Request & Response Audit Snapshots
    apiRequestSnapshot: v.optional(v.any()),
    apiResponseSnapshot: v.optional(v.any()),
    failureReason: v.optional(v.string()),

    // Standard Timestamps & Soft Deletion
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_order", ["orderId"])
    .index("by_provider_order_id", ["providerOrderId"])
    .index("by_status", ["status"])
    .index("by_legacy_id", ["legacyId"]),

  // Order Delivery Status History Domain Table (Migrated from legacy order_deliver_statuses)
  orderDeliverStatuses: defineTable({
    // Legacy PostgreSQL Migration Tracking
    legacyId: v.optional(v.string()),

    // Delivery Attempt Relationship
    deliveryId: v.id("orderDelivers"),

    // Canonical Status
    status: v.union(
      v.literal("pending"),
      v.literal("open"),
      v.literal("accepted"),
      v.literal("live"),
      v.literal("ended"),
      v.literal("cancelled"),
      v.literal("failed")
    ),

    // Provider Raw / Descriptive Status
    providerStatus: v.optional(v.string()),

    // Sanitized Webhook or API Payload Snapshot
    payloadSnapshot: v.optional(v.any()),

    // Optional Event Message / Error / Notes
    notes: v.optional(v.string()),

    // Standard Timestamps & Soft Deletion
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_delivery", ["deliveryId"])
    .index("by_status", ["status"])
    .index("by_legacy_id", ["legacyId"]),

  // Organization QR Codes Domain Table
  organizationQrCodes: defineTable({
    legacyId: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),

    name: v.string(),
    description: v.optional(v.string()),

    qrType: v.union(
      v.literal("DineIn"),
      v.literal("TakeAway"),
      v.literal("Delivery"),
      v.literal("Queue"),
      v.literal("DINE_IN"),
      v.literal("TAKEAWAY"),
      v.literal("DELIVERY")
    ),

    status: v.optional(
      v.union(v.literal("ACTIVE"), v.literal("INACTIVE"))
    ),

    qrUrl: v.optional(v.string()),
    destination: v.optional(v.string()),
    publicToken: v.optional(v.string()),
    counter: v.number(),

    tableNumber: v.optional(v.string()),
    tableId: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
    activatedAt: v.optional(v.number()),
    disabledAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_name", ["name"])
    .index("by_table", ["tableId"])
    .index("by_qr_type", ["qrType"])
    .index("by_status", ["status"])
    .index("by_public_token", ["publicToken"])
    .index("by_legacy_id", ["legacyId"]),

  // Organization QR Scans Telemetry Table
  organizationQrScans: defineTable({
    qrId: v.id("organizationQrCodes"),
    organizationId: v.optional(v.id("organizations")),
    tableId: v.optional(v.string()),
    sessionId: v.string(),
    scannedAt: v.number(),
    deletedAt: v.optional(v.number()),
    // Rich Telemetry Fields
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    deviceType: v.optional(v.string()),
    os: v.optional(v.string()),
    browser: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    region: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    referrer: v.optional(v.string()),
    screenResolution: v.optional(v.string()),
    language: v.optional(v.string()),
  })
    .index("by_qr", ["qrId"])
    .index("by_session", ["sessionId"])
    .index("by_organization", ["organizationId"])
    .index("by_scanned_at", ["scannedAt"]),

  // Organization Ordering Sessions Domain Table
  organizationOrderingSessions: defineTable({
    sessionId: v.string(),
    qrId: v.id("organizationQrCodes"),
    organizationId: v.optional(v.id("organizations")),
    tableId: v.optional(v.string()),
    status: v.union(
      v.literal("ACTIVE"),
      v.literal("EXPIRED"),
      v.literal("COMPLETED")
    ),
    startedAt: v.number(),
    firstScanAt: v.optional(v.number()),
    lastActivityAt: v.number(),
    cartItemCount: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_session_id", ["sessionId"])
    .index("by_qr", ["qrId"])
    .index("by_organization", ["organizationId"])
    .index("by_started_at", ["startedAt"]),

  // Organization Carts Domain Table
  organizationCarts: defineTable({
    cartId: v.string(),
    sessionId: v.string(),
    qrId: v.id("organizationQrCodes"),
    organizationId: v.optional(v.id("organizations")),
    tableId: v.optional(v.string()),
    itemCount: v.number(),
    hasItems: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_cart_id", ["cartId"])
    .index("by_session", ["sessionId"])
    .index("by_qr", ["qrId"])
    .index("by_organization", ["organizationId"]),

  // Organization Event Audit Logs Table (Subticket 06)
  organizationEventLogs: defineTable({
    eventId: v.string(),
    eventType: v.string(),
    entityId: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
    processingStatus: v.union(
      v.literal("RECEIVED"),
      v.literal("PROCESSED"),
      v.literal("FAILED")
    ),
    error: v.optional(v.string()),
    payloadSnapshot: v.optional(v.any()),
  })
    .index("by_event_id", ["eventId"])
    .index("by_event_type", ["eventType"])
    .index("by_status", ["processingStatus"]),

  // Organization Queue Configurations Domain Table
  organizationQueueConfigurations: defineTable({
    legacyId: v.optional(v.string()),

    waitlistHours: v.optional(weeklyScheduleValidator),
    reservationHours: v.optional(weeklyScheduleValidator),

    defaultWaitTime: v.optional(v.string()),
    defaultPartySize: v.optional(v.number()),

    customerViewWaitlist: v.optional(v.boolean()),
    onlineWaitlist: v.optional(v.boolean()),
    onlineReservation: v.optional(v.boolean()),
    bookingApproval: v.optional(v.boolean()),

    geoFence: v.optional(v.boolean()),
    geoFenceRadius: v.optional(v.string()),
    geoFenceLatitude: v.optional(v.number()),
    geoFenceLongitude: v.optional(v.number()),

    maxBookingPerCustomer: v.optional(v.string()),
    maxBookingPerCustomerTime: v.optional(v.string()),

    reservationSlotSize: v.optional(v.string()),
    reservationPerTimeSlot: v.optional(v.string()),

    queueTimeFormat: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index("by_legacy_id", ["legacyId"]),

  // Organization Queues Domain Table
  organizationQueues: defineTable({
    legacyId: v.optional(v.string()),

    queueType: v.union(
      v.literal("waitlist"),
      v.literal("reservation"),
      v.literal("waitlist_off"),
      v.literal("reservation_off")
    ),

    queueStatus: v.union(
      v.literal("booked"),
      v.literal("pending"),
      v.literal("arrived"),
      v.literal("running_late"),
      v.literal("completed"),
      v.literal("rejected"),
      v.literal("close"),
      v.literal("cancelled_by_user"),
      v.literal("cancelled_by_admin")
    ),

    queueNumber: v.optional(v.string()),
    totalGuests: v.optional(v.number()),

    kidsSeat: v.optional(v.boolean()),
    disabledSeat: v.optional(v.boolean()),
    barbequeSeat: v.optional(v.boolean()),

    reservationDate: v.optional(v.string()),
    reservationTime: v.optional(v.number()),

    notes: v.optional(v.string()),
    reason: v.optional(v.string()),

    layoutId: v.optional(v.id("organizationLayouts")),
    tableId: v.optional(v.id("organizationTables")),
    orderId: v.optional(v.string()),
    userId: v.optional(v.string()),

    cancellationTime: v.optional(v.number()),
    completionTime: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_reservation_date", ["reservationDate", "queueType"])
    .index("by_status", ["queueStatus"])
    .index("by_table", ["tableId"])
    .index("by_user", ["userId"])
    .index("by_legacy_id", ["legacyId"]),

  // Queue Activities Audit Log Domain Table
  queueActivities: defineTable({
    legacyId: v.optional(v.string()),
    queueId: v.id("organizationQueues"),
    activityType: v.string(),
    actorId: v.optional(v.string()),
    reason: v.optional(v.string()),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_queue", ["queueId"])
    .index("by_legacy_id", ["legacyId"]),

  // Organization Carousel Screens Domain Table
  organizationCarouselScreens: defineTable({
    legacyId: v.optional(v.string()),

    position: v.number(),

    storageId: v.optional(v.id("_storage")),
    assetId: v.optional(v.id("organization_assets")),
    imageUrl: v.optional(v.string()),
    fileName: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_position", ["position"])
    .index("by_legacy_id", ["legacyId"]),

  // Organization Waiters Domain Table
  organizationWaiters: defineTable({
    legacyId: v.optional(v.string()),

    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),

    waiterCode: v.optional(v.string()),
    normalizedWaiterCode: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_waiter_code", ["normalizedWaiterCode"])
    .index("by_legacy_id", ["legacyId"]),
  // Orders & Order Items Domain Entities
  orders: defineTable({
    organizationId: v.id("organizations"),
    orderNumber: v.string(),
    tokenNumber: v.string(),
    orderType: v.union(
      v.literal("DineIn"),
      v.literal("TakeAway"),
      v.literal("Delivery"),
      v.literal("ScheduledPickup"),
      v.literal("ScheduledDelivery")
    ),
    orderSource: v.string(),

    // Status Tracking
    orderStatusId: v.optional(v.id("organizationOrderProcesses")),
    orderStatusName: v.string(),
    isCompleted: v.boolean(),
    isRejected: v.boolean(),
    isModify: v.boolean(),

    // Table & Staff Associations
    tableId: v.optional(v.id("organizationTables")),
    waiterUserId: v.optional(v.string()),
    cashierUserId: v.optional(v.string()),
    membersOnTable: v.optional(v.number()),

    // QR & Session Attribution (Subticket 03)
    qrId: v.optional(v.id("organizationQrCodes")),
    sessionId: v.optional(v.string()),

    // Customer Relationship & Information (from Frontend POS / Online)
    customerId: v.optional(v.id("customers")),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    customerEmail: v.optional(v.string()),

    // Financial Totals (minor units / paise / cents)
    subTotal: v.number(),
    taxTotal: v.number(),
    discountAmount: v.optional(v.number()),
    deliveryCharge: v.optional(v.number()),
    totalAmount: v.number(),

    // Historical Currency Integrity Snapshot
    currency: v.optional(v.string()),
    currencySymbol: v.optional(v.string()),

    // Delivery Address Details
    userAddressId: v.optional(v.id("userAddresses")),
    deliveryAddress: v.optional(
      v.object({
        addressLine1: v.string(),
        addressLine2: v.optional(v.string()),
        landmark: v.optional(v.string()),
        city: v.optional(v.string()),
        zipCode: v.optional(v.string()),
        addressType: v.optional(v.string()),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
      })
    ),

    // Scheduled Delivery Timing (First-class schema fields for scheduled orders)
    scheduledDeliveryDate: v.optional(v.string()),
    scheduledDeliveryTime: v.optional(v.string()),

    paymentMode: v.string(),
    paymentStatus: v.union(
      v.literal("Pending"),
      v.literal("Paid"),
      v.literal("Failed"),
      v.literal("Refunded"),
      v.literal("Partially Refunded")
    ),

    specialNotes: v.optional(v.string()),
    taxInfoSnapshot: v.optional(v.any()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_status", ["organizationId", "orderStatusId"])
    .index("by_org_table", ["organizationId", "tableId"])
    .index("by_created_at", ["organizationId", "createdAt"])
    .index("by_customer", ["customerId"])
    .index("by_user_address", ["userAddressId"])
    .index("by_qr", ["qrId"])
    .index("by_session", ["sessionId"]),

  orderItems: defineTable({
    organizationId: v.id("organizations"),
    orderId: v.id("orders"),
    itemId: v.id("items"),
    itemName: v.string(),
    itemPrice: v.number(),
    quantity: v.number(),
    totalPrice: v.number(),
    customizations: v.optional(
      v.array(
        v.object({
          customizationId: v.id("customizations"),
          customizationName: v.string(),
          optionId: v.id("customizationItems"),
          optionName: v.string(),
          price: v.number(),
        })
      )
    ),
    prepPreferences: v.optional(
      v.array(
        v.object({
          preferenceId: v.optional(v.id("chefPrepPreferences")),
          name: v.string(),
        })
      )
    ),
    chefPrepPreferences: v.optional(
      v.array(
        v.object({
          preferenceId: v.optional(v.id("chefPrepPreferences")),
          name: v.string(),
        })
      )
    ),
    isReady: v.boolean(),
    isToGo: v.optional(v.boolean()),
    stationId: v.optional(v.id("stations")),
    createdAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_org", ["organizationId"])
    .index("by_station", ["stationId"])
    .index("by_org_station", ["organizationId", "stationId"])
    .index("by_created_at", ["organizationId", "createdAt"]),

  orderActivities: defineTable({
    legacyId: v.optional(v.string()),
    organizationId: v.id("organizations"),
    orderId: v.id("orders"),
    processId: v.optional(v.id("organizationOrderProcesses")),
    processName: v.string(),
    position: v.number(),
    totalDuration: v.optional(v.number()), // Total duration in seconds elapsed since initial order step
    startedAt: v.optional(v.number()), // Epoch timestamp in ms
    completedAt: v.optional(v.number()), // Epoch timestamp in ms
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_order", ["orderId"])
    .index("by_org", ["organizationId"])
    .index("by_created_at", ["organizationId", "createdAt"])
    .index("by_order_process", ["orderId", "processId"])
    .index("by_legacy_id", ["legacyId"]),

  orderPayments: defineTable({
    organizationId: v.id("organizations"),
    orderId: v.id("orders"),
    paymentModeId: v.optional(v.id("paymentModes")),
    paymentModeName: v.string(),
    paymentType: v.optional(v.union(v.literal("Credit"), v.literal("Debit"))),
    amount: v.number(),
    payAmount: v.optional(v.number()),
    refundAmount: v.optional(v.number()),
    currency: v.optional(v.string()),
    currencySymbol: v.optional(v.string()),
    transactionReference: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_org", ["organizationId"])
    .index("by_org_created_at", ["organizationId", "createdAt"]),

  // Inventory, Suppliers, Recipes & Purchase Orders Domain Entities
  suppliers: defineTable({
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
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index("by_org", ["organizationId"]),

  inventoryItems: defineTable({
    organizationId: v.id("organizations"),
    categoryId: v.optional(v.id("inventoryCategories")),
    name: v.string(),
    description: v.optional(v.string()),
    skuNumber: v.optional(v.string()),
    buyingUnit: v.string(),
    servingUnit: v.string(),
    minimumStockRefillLevel: v.number(),
    baselineStockLevel: v.optional(v.number()),
    availableStock: v.number(),
    unitCost: v.optional(v.number()),
    allowNegativeStock: v.optional(v.boolean()),
    supplierIds: v.optional(v.array(v.id("suppliers"))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_category", ["organizationId", "categoryId"]),

  recipes: defineTable({
    organizationId: v.id("organizations"),
    itemId: v.optional(v.id("items")),
    customizationItemId: v.optional(v.id("customizationItems")),
    inventoryItemId: v.id("inventoryItems"),
    quantity: v.number(),
    unit: v.string(),
    yield: v.optional(v.number()),
    yieldUnit: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_item", ["itemId"])
    .index("by_customization", ["customizationItemId"])
    .index("by_inventory_item", ["inventoryItemId"])
    .index("by_org", ["organizationId"]),

  recipeAssignments: defineTable({
    organizationId: v.id("organizations"),
    sourceRecipeItemId: v.id("items"), // The master recipe / dish item being mapped from
    targetItemId: v.optional(v.id("items")), // The menu item that gets ordered
    targetCustomizationItemId: v.optional(v.id("customizationItems")), // Or the modifier option that gets ordered
    portionMultiplier: v.number(), // Portion deducted per order (e.g. 1, 2, 0.5)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_source_recipe", ["sourceRecipeItemId"])
    .index("by_target_item", ["targetItemId"])
    .index("by_target_customization", ["targetCustomizationItemId"]),

  purchaseOrders: defineTable({
    organizationId: v.id("organizations"),
    supplierId: v.id("suppliers"),
    poNumber: v.string(),
    purchasePriority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    status: v.union(
      v.literal("drafted"),
      v.literal("sent"),
      v.literal("partially_received"),
      v.literal("settled"),
      v.literal("cancelled")
    ),
    totalAmount: v.number(),
    notes: v.optional(v.string()),
    invoiceStorageKey: v.optional(v.string()),
    invoiceAssetId: v.optional(v.id("organization_assets")),
    invoiceUrl: v.optional(v.string()),
    settledAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_supplier", ["supplierId"])
    .index("by_status", ["organizationId", "status"])
    .index("by_org_created", ["organizationId", "createdAt"]),

  purchaseOrderItems: defineTable({
    organizationId: v.id("organizations"),
    purchaseOrderId: v.id("purchaseOrders"),
    inventoryItemId: v.id("inventoryItems"),
    unit: v.string(),
    orderedQuantity: v.number(),
    receivedQuantity: v.optional(v.number()),
    missingQuantity: v.optional(v.number()),
    isReceived: v.optional(v.boolean()),
    isMissing: v.optional(v.boolean()),
    unitCost: v.number(),
    totalCost: v.number(),
    createdAt: v.number(),
  }).index("by_po", ["purchaseOrderId"]),

  inventoryItemStocks: defineTable({
    organizationId: v.id("organizations"),
    inventoryItemId: v.id("inventoryItems"),
    stockType: v.union(v.literal("credit"), v.literal("debit")),
    quantity: v.number(),
    unit: v.string(),
    sourceType: v.string(), // "PurchaseOrder", "OrderSale", "ManualAdjustment", "DeadStock"
    purchaseOrderId: v.optional(v.id("purchaseOrders")),
    poNumber: v.optional(v.string()),
    supplierId: v.optional(v.id("suppliers")),
    orderId: v.optional(v.id("orders")),
    isDeadStock: v.optional(v.boolean()),
    reasonForDeadStock: v.optional(v.string()),
    expiryDate: v.optional(v.number()),
    receivedDate: v.optional(v.number()),
    markedDate: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_inventory_item", ["inventoryItemId"])
    .index("by_org", ["organizationId"])
    .index("by_po", ["purchaseOrderId"])
    .index("by_order", ["orderId"])
    .index("by_org_created", ["organizationId", "createdAt"])
    .index("by_org_deadstock", ["organizationId", "isDeadStock"]),

  // Organization Schedule Pickups Domain Table
  organizationSchedulePickups: defineTable({
    legacyId: v.optional(v.string()),

    advanceOrderTimeLimit: v.optional(v.string()),
    advancePickupLimit: v.optional(v.number()),
    advancePickupLimitType: v.optional(v.string()),
    pickupTimings: v.optional(weeklyScheduleValidator),
    pickupTimeSlotSize: v.optional(v.string()),

    pickupAddressLine1: v.optional(v.string()),
    pickupAddressLine2: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
    zipcode: v.optional(v.string()),

    advanceScheduleDeliveryOrderTimeLimit: v.optional(v.string()),
    advanceDeliveryLimit: v.optional(v.number()),
    advanceDeliveryLimitType: v.optional(v.string()),
    deliveryTimings: v.optional(weeklyScheduleValidator),
    deliveryTimeSlotSize: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_legacy_id", ["legacyId"]),

  // Organization Bot Tokens Domain Table
  organizationBotTokens: defineTable({
    legacyId: v.optional(v.string()),

    token: v.string(),
    env: v.optional(v.string()),
    userId: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_legacy_id", ["legacyId"]),

  // Organization Assets Domain Table (Cloudflare R2 Metadata & References)
  organization_assets: defineTable({
    legacyId: v.optional(v.string()),

    organizationId: v.id("organizations"),
    storageKey: v.string(),
    fileName: v.string(),
    contentType: v.string(),
    fileSize: v.number(),
    assetType: v.string(),

    status: v.union(
      v.literal("pending"),
      v.literal("uploaded"),
      v.literal("failed"),
      v.literal("deleted")
    ),

    createdBy: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_asset_type", ["organizationId", "assetType"])
    .index("by_storage_key", ["storageKey"])
    .index("by_status", ["status"])
    .index("by_legacy_id", ["legacyId"]),

  // Process Notifications Domain Table
  processNotifications: defineTable({
    legacyId: v.optional(v.string()),
    organizationOrderProcessId: v.id("organizationOrderProcesses"),

    notificationType: v.union(
      v.literal("At"),
      v.literal("Before"),
      v.literal("After")
    ),

    notificationVia: v.union(
      v.literal("sms"),
      v.literal("whatsapp"),
      v.literal("push"),
      v.literal("email")
    ),

    notificationText: v.string(),

    customerType: v.optional(
      v.union(
        v.literal("all"),
        v.literal("dine_in"),
        v.literal("takeaway"),
        v.literal("delivery")
      )
    ),

    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_process", ["organizationOrderProcessId"])
    .index("by_legacy_id", ["legacyId"]),

  // Provider Payment Transfers Domain Table (Marketplace Payout / Split Ledger)
  providerPaymentTransfers: defineTable({
    legacyId: v.optional(v.string()),
    orderPaymentId: v.id("orderPayments"),
    organizationId: v.optional(v.id("organizations")),

    transferId: v.optional(v.string()),
    transferAmount: v.number(), // Minor currency units (paise / cents integer)
    transferStatus: v.union(
      v.literal("created"),
      v.literal("processed"),
      v.literal("failed"),
      v.literal("reversed"),
      v.literal("pending")
    ),
    settlementStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("settled")
      )
    ),

    errorMessage: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_order_payment", ["orderPaymentId"])
    .index("by_transfer_id", ["transferId"])
    .index("by_legacy_id", ["legacyId"]),

  // ==========================================
  // CUSTOMER FEEDBACK & RAPIDFIRE SURVEY DOMAIN
  // ==========================================

  surveys: defineTable({
    legacyId: v.optional(v.string()),
    name: v.string(),
    introduction: v.optional(v.string()),
    afterSurveyContent: v.optional(v.string()),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_active", ["active"])
    .index("by_legacy_id", ["legacyId"]),

  surveyQuestions: defineTable({
    legacyId: v.optional(v.string()),
    surveyId: v.id("surveys"),
    type: v.union(
      v.literal("numeric"),
      v.literal("checkbox"),
      v.literal("radio"),
      v.literal("select"),
      v.literal("short"),
      v.literal("long"),
      v.literal("date")
    ),
    questionText: v.string(),
    defaultText: v.optional(v.string()),
    placeholder: v.optional(v.string()),
    position: v.number(),
    answerOptions: v.optional(v.array(v.string())),
    validationRules: v.optional(
      v.object({
        presence: v.optional(v.boolean()),
        minimumLength: v.optional(v.number()),
        maximumLength: v.optional(v.number()),
        greaterThanOrEqualTo: v.optional(v.number()),
        lessThanOrEqualTo: v.optional(v.number()),
      })
    ),
    ratingDisplayMode: v.optional(
      v.union(v.literal("stars"), v.literal("numeric"))
    ),
    lowLabel: v.optional(v.string()),
    highLabel: v.optional(v.string()),
    frequency: v.optional(
      v.union(v.literal("once_per_order"), v.literal("per_order_item"))
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_survey_id", ["surveyId"])
    .index("by_survey_position", ["surveyId", "position"])
    .index("by_legacy_id", ["legacyId"]),

  surveyAttempts: defineTable({
    legacyId: v.optional(v.string()),
    surveyId: v.id("surveys"),
    orderId: v.optional(v.id("orders")),
    customerId: v.optional(v.string()),
    published: v.boolean(),
    submittedAt: v.optional(v.number()),
    flaggedForMeeting: v.optional(v.boolean()),
    overallRating: v.optional(v.number()),
    source: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_survey_id", ["surveyId"])
    .index("by_survey_published", ["surveyId", "published"])
    .index("by_order_id", ["orderId"])
    .index("by_order_survey", ["orderId", "surveyId"])
    .index("by_customer_id", ["customerId"])
    .index("by_created_at", ["createdAt"])
    .index("by_legacy_id", ["legacyId"]),

  surveyAnswers: defineTable({
    legacyId: v.optional(v.string()),
    attemptId: v.id("surveyAttempts"),
    questionId: v.id("surveyQuestions"),
    orderItemId: v.optional(v.string()),
    orderItemName: v.optional(v.string()),
    answerText: v.optional(v.string()),
    selectedOptions: v.optional(v.array(v.string())),
    numericValue: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_attempt_id", ["attemptId"])
    .index("by_attempt_question", ["attemptId", "questionId"])
    .index("by_question_id", ["questionId"])
    .index("by_legacy_id", ["legacyId"]),

  // ==========================================
  // Customer Front Display (CFD) Domain Entities
  // ==========================================

  organizationFrontDisplaySettings: defineTable({
    legacyId: v.optional(v.string()),
    organizationId: v.id("organizations"),
    cfdEnabled: v.boolean(),
    displayLayout: v.union(
      v.literal("split"),
      v.literal("cart"),
      v.literal("media")
    ),
    theme: v.union(
      v.literal("light"),
      v.literal("dark"),
      v.literal("warm")
    ),
    showPaymentQr: v.boolean(),
    storeUpiAddress: v.optional(v.string()),
    showCashTenderedChangeDue: v.boolean(),
    merchantDisplayName: v.optional(v.string()),
    showStarRatingSurvey: v.boolean(),
    showWhatsappReceipt: v.boolean(),
    returnToWelcomeTimeout: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_org", ["organizationId"])
    .index("by_legacy_id", ["legacyId"]),

  customerFrontDisplays: defineTable({
    legacyId: v.optional(v.string()),
    organizationId: v.id("organizations"),
    terminalId: v.optional(v.string()),
    name: v.string(),
    workstationName: v.optional(v.string()),
    connectionType: v.union(v.literal("hdmi"), v.literal("network")),
    ipAddress: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("offline"),
      v.literal("pending_pair")
    ),
    latencyMs: v.optional(v.number()),
    lastSeenAt: v.number(),
    pairingCode: v.optional(v.string()),
    pairingCodeExpiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_org", ["organizationId"])
    .index("by_terminal", ["terminalId"])
    .index("by_pairing_code", ["pairingCode"])
    .index("by_legacy_id", ["legacyId"]),

  frontDisplaySessions: defineTable({
    organizationId: v.id("organizations"),
    terminalId: v.string(),
    state: v.union(
      v.literal("idle"),
      v.literal("ringing"),
      v.literal("payment_qr"),
      v.literal("cash_tender"),
      v.literal("completed")
    ),
    payload: v.any(),
    updatedAt: v.number(),
  })
    .index("by_org_terminal", ["organizationId", "terminalId"]),

  // ==========================================
  // MODULAR WIDGET-DRIVEN DASHBOARD DOMAIN
  // ==========================================

  dashboards: defineTable({
    organizationId: v.id("organizations"),
    userId: v.string(), // Clerk subject ID, or "system" / "store_default"
    name: v.string(),
    description: v.optional(v.string()),
    scope: v.union(
      v.literal("user"),
      v.literal("store_default"),
      v.literal("template")
    ),
    templateKey: v.optional(v.string()), // e.g. "executive_dinner_peak", "breakfast_buffet_bakery", etc.
    revision: v.number(), // Optimistic concurrency tracking
    isDefault: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_user", ["organizationId", "userId"])
    .index("by_org_scope", ["organizationId", "scope"])
    .index("by_org_template", ["organizationId", "templateKey"]),

  dashboardPlacements: defineTable({
    organizationId: v.id("organizations"),
    dashboardId: v.id("dashboards"),
    widgetId: v.string(),
    gridRow: v.number(),
    gridCol: v.number(), // 0 to 11 in a 12-col grid
    width: v.number(), // Col span (e.g. 4, 6, 8, 12)
    height: v.number(), // Row span / height units
    displayOrder: v.number(),
    isEnabled: v.boolean(),
    configuration: v.optional(v.any()),
    configurationVersion: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_dashboard", ["dashboardId"])
    .index("by_dashboard_widget", ["dashboardId", "widgetId"])
    .index("by_org", ["organizationId"]),

  dashboardDrafts: defineTable({
    organizationId: v.id("organizations"),
    dashboardId: v.id("dashboards"),
    userId: v.string(),
    baseRevision: v.number(),
    placements: v.array(
      v.object({
        widgetId: v.string(),
        gridRow: v.number(),
        gridCol: v.number(),
        width: v.number(),
        height: v.number(),
        displayOrder: v.number(),
        isEnabled: v.boolean(),
        configuration: v.optional(v.any()),
        configurationVersion: v.number(),
      })
    ),
    updatedAt: v.number(),
  })
    .index("by_org_user_dashboard", ["organizationId", "userId", "dashboardId"])
    .index("by_dashboard", ["dashboardId"]),

  dashboardPreferences: defineTable({
    organizationId: v.id("organizations"),
    userId: v.string(),
    activeDashboardId: v.optional(v.id("dashboards")),
    autoAlign: v.optional(v.boolean()),
    gridResolution: v.optional(v.string()), // e.g. "1440px Fluid", "Compact 1200px"
    selectedTemplateKey: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_org_user", ["organizationId", "userId"]),

  // -------------------------------------------------------------------------
  // Marketplace Domain Tables
  // -------------------------------------------------------------------------
  marketplaceListings: defineTable({
    slug: v.string(),
    title: v.string(),
    subtitle: v.string(),
    vendor: v.string(),
    category: v.string(),
    description: v.string(),
    badge: v.optional(v.string()),
    iconName: v.string(),
    rating: v.optional(v.string()),
    version: v.optional(v.string()),
    statusText: v.string(),
    statusType: v.string(),
    priceText: v.string(),
    priceAmount: v.number(),
    isOneTime: v.optional(v.boolean()),
    actionText: v.string(),
    actionType: v.string(),
    practicalFeatures: v.optional(
      v.array(
        v.object({
          icon: v.string(),
          title: v.string(),
          description: v.string(),
        })
      )
    ),
    prerequisites: v.optional(
      v.array(
        v.object({
          icon: v.string(),
          title: v.string(),
          detail: v.string(),
        })
      )
    ),
    permissions: v.optional(v.array(v.string())),
    terms: v.optional(
      v.object({
        licenseType: v.string(),
        platformSurcharge: v.string(),
        taxes: v.string(),
      })
    ),
    isPublished: v.boolean(),
    displayOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_category", ["category"])
    .index("by_published", ["isPublished"])
    .index("by_display_order", ["displayOrder"]),

  marketplaceInstallations: defineTable({
    organizationId: v.id("organizations"),
    listingId: v.id("marketplaceListings"),
    appSlug: v.string(),
    status: v.string(), // "installed" | "live" | "attention" | "uninstalled"
    statusText: v.optional(v.string()),
    actionType: v.optional(v.string()),
    isPaid: v.boolean(),
    licenseType: v.string(), // "one_time" | "subscription" | "free"
    purchasedAt: v.optional(v.number()),
    installedAt: v.number(),
    uninstalledAt: v.optional(v.number()),
    installedByUserId: v.string(),
    configuration: v.optional(v.any()),
    lastSyncedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_and_app", ["organizationId", "appSlug"])
    .index("by_org_and_listing", ["organizationId", "listingId"])
    .index("by_status", ["organizationId", "status"]),

  marketplaceWallets: defineTable({
    organizationId: v.id("organizations"),
    balance: v.number(),
    escrowId: v.string(),
    currency: v.string(),
    autoTopupEnabled: v.boolean(),
    autoTopupThreshold: v.number(),
    autoTopupAmount: v.number(),
    status: v.string(), // "active" | "suspended" | "locked"
    lastTopupAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"]),

  marketplaceTransactions: defineTable({
    organizationId: v.id("organizations"),
    walletId: v.id("marketplaceWallets"),
    code: v.string(), // e.g. "TXN-994820"
    type: v.string(), // "topup" | "purchase" | "subscription" | "refund"
    typeLabel: v.string(),
    amount: v.number(), // positive for credit, negative for debit
    balanceBefore: v.number(),
    balanceAfter: v.number(),
    description: v.string(),
    detail: v.optional(v.string()),
    status: v.string(), // "confirmed" | "pending" | "failed"
    statusLabel: v.string(),
    actionText: v.string(),
    appSlug: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
    razorpayOrderId: v.optional(v.string()),
    razorpayPaymentId: v.optional(v.string()),
    razorpaySignature: v.optional(v.string()),
    initiatedByUserId: v.string(),
    createdAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_wallet", ["walletId"])
    .index("by_org_and_type", ["organizationId", "type"])
    .index("by_org_and_code", ["organizationId", "code"])
    .index("by_idempotency", ["organizationId", "idempotencyKey"])
    .index("by_razorpay_order_id", ["organizationId", "razorpayOrderId"])
    .index("by_razorpay_payment_id", ["organizationId", "razorpayPaymentId"])
    .index("by_created_at", ["organizationId", "createdAt"]),

  // =========================================================================
  // POLYMORPHIC PAYMENT GATEWAYS DOMAIN (Razorpay, Stripe, PayPal, etc.)
  // Shared normalized data model supporting multiple payment providers
  // =========================================================================

  payment_gateway_connections: defineTable({
    organizationId: v.id("organizations"),
    provider: v.string(), // "razorpay" | "stripe" | "paypal"
    connectionType: v.union(v.literal("api_key"), v.literal("oauth")),
    providerAccountId: v.optional(v.string()), // Merchant ID or account identifier
    merchantName: v.optional(v.string()),
    accountMode: v.union(v.literal("test"), v.literal("live")),
    status: v.union(
      v.literal("pending"),
      v.literal("connected"),
      v.literal("needs_attention"),
      v.literal("disconnected"),
      v.literal("error")
    ),
    encryptedCredentials: v.optional(v.string()), // AES-256-GCM authenticated payload
    encryptionKeyVersion: v.optional(v.number()),
    credentialsUpdatedAt: v.optional(v.number()),
    connectedAt: v.optional(v.number()),
    disconnectedAt: v.optional(v.number()),
    lastVerifiedAt: v.optional(v.number()),
    lastSyncAt: v.optional(v.number()),
    lastErrorCode: v.optional(v.string()),
    lastErrorMessage: v.optional(v.string()),
    isDefault: v.boolean(),
    metadata: v.optional(v.any()), // Non-sensitive provider metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_provider", ["provider"])
    .index("by_org_and_provider", ["organizationId", "provider"])
    .index("by_status", ["status"])
    .index("by_org_and_status", ["organizationId", "status"])
    .index("by_provider_account", ["providerAccountId"])
    .index("by_org_provider_account", ["organizationId", "provider", "providerAccountId"]),

  payment_transactions: defineTable({
    organizationId: v.id("organizations"),
    connectionId: v.id("payment_gateway_connections"),
    provider: v.string(),
    providerPaymentId: v.string(), // e.g. "pay_29QQoUBi66xm2f"
    providerOrderId: v.optional(v.string()),
    internalOrderId: v.optional(v.id("orders")),
    customerId: v.optional(v.id("customers")),
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    amountMinor: v.number(), // Integer minor currency units (paise / cents)
    currency: v.string(), // ISO 4217 code (e.g. "INR", "USD")
    paymentMethod: v.string(), // "upi" | "card" | "netbanking" | "wallet" | "emi"
    status: v.union(
      v.literal("created"),
      v.literal("authorized"),
      v.literal("captured"),
      v.literal("failed"),
      v.literal("pending"),
      v.literal("refunded"),
      v.literal("partially_refunded"),
      v.literal("cancelled")
    ),
    providerStatus: v.string(), // Raw provider status (e.g. "captured", "succeeded")
    paidAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    refundedAmountMinor: v.optional(v.number()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_connection", ["connectionId"])
    .index("by_provider", ["provider"])
    .index("by_provider_payment_id", ["providerPaymentId"])
    .index("by_provider_order_id", ["providerOrderId"])
    .index("by_internal_order", ["internalOrderId"])
    .index("by_customer", ["customerId"])
    .index("by_status", ["status"])
    .index("by_paid_at", ["paidAt"])
    .index("by_created_at", ["createdAt"])
    .index("by_connection_and_provider_payment", ["connectionId", "providerPaymentId"])
    .index("by_provider_and_payment_id", ["provider", "providerPaymentId"])
    .index("by_org_and_created_at", ["organizationId", "createdAt"])
    .index("by_connection_and_created_at", ["connectionId", "createdAt"])
    .index("by_connection_and_status", ["connectionId", "status"]),

  payment_refunds: defineTable({
    organizationId: v.id("organizations"),
    connectionId: v.id("payment_gateway_connections"),
    transactionId: v.optional(v.id("payment_transactions")),
    provider: v.string(),
    providerRefundId: v.string(),
    providerPaymentId: v.string(),
    amountMinor: v.number(), // Integer minor units
    currency: v.string(), // ISO 4217
    reason: v.optional(v.string()),
    speed: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("processed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    providerStatus: v.string(),
    initiatedAt: v.number(),
    processedAt: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_connection", ["connectionId"])
    .index("by_provider", ["provider"])
    .index("by_provider_refund_id", ["providerRefundId"])
    .index("by_transaction", ["transactionId"])
    .index("by_provider_payment_id", ["providerPaymentId"])
    .index("by_status", ["status"])
    .index("by_connection_and_provider_refund", ["connectionId", "providerRefundId"])
    .index("by_org_and_initiated_at", ["organizationId", "initiatedAt"])
    .index("by_connection_and_initiated_at", ["connectionId", "initiatedAt"])
    .index("by_connection_and_status", ["connectionId", "status"]),

  payment_settlements: defineTable({
    organizationId: v.id("organizations"),
    connectionId: v.id("payment_gateway_connections"),
    provider: v.string(),
    providerSettlementId: v.string(),
    amountMinor: v.number(), // Gross amount in minor units
    currency: v.string(), // ISO 4217
    feesMinor: v.optional(v.number()),
    taxMinor: v.optional(v.number()),
    netAmountMinor: v.number(), // Net payout in minor units
    status: v.union(
      v.literal("pending"),
      v.literal("processed"),
      v.literal("failed"),
      v.literal("partially_processed")
    ),
    providerStatus: v.string(),
    settlementDate: v.number(),
    utrOrReference: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_connection", ["connectionId"])
    .index("by_provider", ["provider"])
    .index("by_provider_settlement_id", ["providerSettlementId"])
    .index("by_settlement_date", ["settlementDate"])
    .index("by_status", ["status"])
    .index("by_connection_and_provider_settlement", ["connectionId", "providerSettlementId"])
    .index("by_connection_and_settlement_date", ["connectionId", "settlementDate"])
    .index("by_connection_and_status", ["connectionId", "status"]),

  payment_webhook_events: defineTable({
    organizationId: v.id("organizations"),
    connectionId: v.optional(v.id("payment_gateway_connections")),
    provider: v.string(),
    providerEventId: v.string(),
    eventType: v.string(),
    eventCategory: v.optional(v.string()),
    payload: v.string(), // Sanitized JSON string
    signatureVerified: v.boolean(),
    processingStatus: v.union(
      v.literal("received"),
      v.literal("verified"),
      v.literal("processing"),
      v.literal("processed"),
      v.literal("failed"),
      v.literal("ignored")
    ),
    attemptCount: v.number(),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_connection", ["connectionId"])
    .index("by_provider", ["provider"])
    .index("by_provider_event_id", ["providerEventId"])
    .index("by_provider_and_event_id", ["provider", "providerEventId"])
    .index("by_event_type", ["eventType"])
    .index("by_processing_status", ["processingStatus"])
    .index("by_org_and_status", ["organizationId", "processingStatus"])
    .index("by_received_at", ["receivedAt"]),

  payment_sync_runs: defineTable({
    organizationId: v.id("organizations"),
    connectionId: v.id("payment_gateway_connections"),
    provider: v.string(),
    resourceType: v.union(
      v.literal("transactions"),
      v.literal("refunds"),
      v.literal("settlements")
    ),
    syncType: v.union(
      v.literal("initial"),
      v.literal("incremental"),
      v.literal("manual"),
      v.literal("scheduled")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("partial"),
      v.literal("failed")
    ),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    recordsFetched: v.number(),
    recordsCreated: v.number(),
    recordsUpdated: v.number(),
    recordsSkipped: v.number(),
    errorCount: v.number(),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_connection", ["connectionId"])
    .index("by_provider", ["provider"])
    .index("by_resource_type", ["resourceType"])
    .index("by_status", ["status"])
    .index("by_started_at", ["startedAt"])
    .index("by_connection_and_resource", ["connectionId", "resourceType"]),

  payment_sync_cursors: defineTable({
    organizationId: v.id("organizations"),
    connectionId: v.id("payment_gateway_connections"),
    provider: v.string(),
    resourceType: v.union(
      v.literal("transactions"),
      v.literal("refunds"),
      v.literal("settlements")
    ),
    cursor: v.optional(v.string()),
    lastSuccessfulSyncAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_connection", ["connectionId"])
    .index("by_provider", ["provider"])
    .index("by_resource_type", ["resourceType"])
    .index("by_connection_and_resource", ["connectionId", "resourceType"]),

}, { schemaValidation: false });

