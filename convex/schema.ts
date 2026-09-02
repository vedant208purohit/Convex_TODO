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
    logoUrl: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),

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

  // Organization QR Codes Domain Table
  organizationQrCodes: defineTable({
    legacyId: v.optional(v.string()),

    name: v.string(),
    description: v.optional(v.string()),

    qrType: v.union(
      v.literal("DineIn"),
      v.literal("TakeAway"),
      v.literal("Queue")
    ),

    qrUrl: v.optional(v.string()),
    counter: v.number(),

    tableNumber: v.optional(v.string()),
    tableId: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_name", ["name"])
    .index("by_table", ["tableId"])
    .index("by_qr_type", ["qrType"])
    .index("by_legacy_id", ["legacyId"]),

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

    // Customer Information (from Frontend POS / Online)
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    customerEmail: v.optional(v.string()),

    // Financial Totals (minor units / paise / cents)
    subTotal: v.number(),
    taxTotal: v.number(),
    discountAmount: v.optional(v.number()),
    deliveryCharge: v.optional(v.number()),
    totalAmount: v.number(),

    // Delivery Address Details
    deliveryAddress: v.optional(
      v.object({
        addressLine1: v.string(),
        addressLine2: v.optional(v.string()),
        landmark: v.optional(v.string()),
        city: v.optional(v.string()),
        zipCode: v.optional(v.string()),
        addressType: v.optional(v.string()),
      })
    ),

    paymentMode: v.string(),
    paymentStatus: v.union(v.literal("Pending"), v.literal("Paid"), v.literal("Failed")),

    specialNotes: v.optional(v.string()),
    taxInfoSnapshot: v.optional(v.any()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_status", ["organizationId", "orderStatusId"])
    .index("by_org_table", ["organizationId", "tableId"])
    .index("by_created_at", ["organizationId", "createdAt"]),

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
    isReady: v.boolean(),
    stationId: v.optional(v.id("stations")),
    createdAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_org", ["organizationId"]),

  orderActivities: defineTable({
    organizationId: v.id("organizations"),
    orderId: v.id("orders"),
    processId: v.optional(v.id("organizationOrderProcesses")),
    processName: v.string(),
    position: v.number(),
    createdAt: v.number(),
  }).index("by_order", ["orderId"]),

  orderPayments: defineTable({
    organizationId: v.id("organizations"),
    orderId: v.id("orders"),
    paymentModeId: v.optional(v.id("paymentModes")),
    paymentModeName: v.string(),
    amount: v.number(),
    transactionReference: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_order", ["orderId"]),

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
    createdAt: v.number(),
    updatedAt: v.number(),
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_item", ["itemId"])
    .index("by_customization", ["customizationItemId"])
    .index("by_inventory_item", ["inventoryItemId"]),

  purchaseOrders: defineTable({
    organizationId: v.id("organizations"),
    supplierId: v.id("suppliers"),
    poNumber: v.string(),
    purchasePriority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    status: v.union(
      v.literal("drafted"),
      v.literal("sent"),
      v.literal("settled"),
      v.literal("cancelled")
    ),
    totalAmount: v.number(),
    notes: v.optional(v.string()),
    settledAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_supplier", ["supplierId"])
    .index("by_status", ["organizationId", "status"]),

  purchaseOrderItems: defineTable({
    organizationId: v.id("organizations"),
    purchaseOrderId: v.id("purchaseOrders"),
    inventoryItemId: v.id("inventoryItems"),
    unit: v.string(),
    orderedQuantity: v.number(),
    receivedQuantity: v.optional(v.number()),
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
    supplierId: v.optional(v.id("suppliers")),
    orderId: v.optional(v.id("orders")),
    isDeadStock: v.optional(v.boolean()),
    reasonForDeadStock: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_inventory_item", ["inventoryItemId"])
    .index("by_org", ["organizationId"])
    .index("by_po", ["purchaseOrderId"])
    .index("by_order", ["orderId"]),
}, { schemaValidation: false });
