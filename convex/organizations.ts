import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

// Helper: Slug Normalization
function generateBaseSlug(name: string): string {
  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "org";
}

// Helper: Web Crypto HMAC SHA-256 Signature Generator
export async function generateHmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Helper: Provisioning Authentication Guard Enforcer (Master -> Default Server-to-Server)
export async function requireProvisioningAuth(
  ctx: QueryCtx | MutationCtx,
  args: { slug: string; provisioningToken?: string; timestamp?: number }
) {
  const secret = process.env.PROVISIONING_SECRET;
  if (!secret) {
    throw new Error("PROVISIONING_SECRET environment variable is not configured on server.");
  }

  if (!args.provisioningToken || !args.timestamp) {
    throw new Error("Unauthenticated provisioning request: missing token or timestamp.");
  }

  // 1. Time Window Check (5-minute expiration / drift threshold)
  const now = Date.now();
  const maxDriftMs = 5 * 60 * 1000;
  if (Math.abs(now - args.timestamp) > maxDriftMs) {
    throw new Error("Expired or invalid provisioning token timestamp.");
  }

  // 2. HMAC SHA-256 Signature Verification
  const expectedToken = await generateHmacSha256(secret, `${args.slug}:${args.timestamp}`);

  if (args.provisioningToken !== expectedToken) {
    throw new Error("Invalid provisioning authentication token.");
  }
}

// Helper: Unique Slug Generation
async function resolveUniqueSlug(
  ctx: QueryCtx | MutationCtx,
  baseSlug: string,
  currentOrgId?: Id<"organizations">
): Promise<string> {
  let candidate = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .first();

    // Available if no record found OR it's the current organization itself (and not deleted)
    if (!existing || (currentOrgId && existing._id === currentOrgId)) {
      return candidate;
    }

    if (existing.deletedAt !== undefined) {
      // Ignore soft-deleted organizations when checking uniqueness if candidate matches
      return candidate;
    }

    candidate = `${baseSlug}-${counter}`;
    counter++;
  }
}

// Helper: Secret Stripping for Frontend Queries
function stripSecrets(org: Doc<"organizations"> | null) {
  if (!org) return null;
  const { whatsappAccessToken, ...safeOrg } = org;
  return safeOrg;
}

// Helper: Reusable Organization Business Rule Validation
function validateOrganizationState(org: {
  isDineIn: boolean;
  isTakeAway: boolean;
  isDelivery: boolean;
  dineinPrepaid: boolean;
  dineinPospaid: boolean;
  takeAwayCashPayment: boolean;
  takeAwayOnlinePayment: boolean;
  deliveryCashOnDelivery: boolean;
  deliveryOnlinePayment: boolean;
  deliveryAggregator: boolean;
  latitude?: number;
  longitude?: number;
  phone?: string;
}) {
  // RULE 1: At least one service type must be enabled
  if (!org.isDineIn && !org.isTakeAway && !org.isDelivery) {
    throw new Error(
      "At least one of 'is_dine_in', 'is_take_away', or 'is_delivery' must be accept."
    );
  }

  // RULE 2: If dine-in enabled, at least one dine-in payment option must be enabled
  if (org.isDineIn && !org.dineinPrepaid && !org.dineinPospaid) {
    throw new Error(
      "At least one of 'dinein_prepaid' or 'dinein_pospaid' must be accept."
    );
  }

  // RULE 4: If takeaway enabled, at least one takeaway payment option must be enabled
  if (
    org.isTakeAway &&
    !org.takeAwayCashPayment &&
    !org.takeAwayOnlinePayment
  ) {
    throw new Error(
      "At least one of 'take_away_cash_payment' or 'take_away_online_payment' must be accept."
    );
  }

  // RULE 5: If delivery enabled, at least one delivery payment option must be enabled
  if (
    org.isDelivery &&
    !org.deliveryCashOnDelivery &&
    !org.deliveryOnlinePayment
  ) {
    throw new Error(
      "At least one of 'delivery_cash_on_delivery' or 'delivery_online_payment' must be accept."
    );
  }

  // RULE 6: If delivery aggregator enabled, GPS coordinates and contact phone are required
  if (org.deliveryAggregator) {
    const hasLat = org.latitude !== undefined && org.latitude !== null;
    const hasLng = org.longitude !== undefined && org.longitude !== null;
    const hasPhone = org.phone !== undefined && org.phone !== null && org.phone.trim() !== "";

    if (!hasLat || !hasLng || !hasPhone) {
      throw new Error(
        "Cannot enable delivery — please ensure latitude, longitude, and phone number are set in organization details."
      );
    }
  }
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

export const get = query({
  args: { id: v.union(v.id("organizations"), v.string()) },
  handler: async (ctx, args) => {
    if (!args.id || args.id.trim() === "") return null;
    const normalizedId = ctx.db.normalizeId("organizations", args.id);
    if (!normalizedId) return null;
    const org = await ctx.db.get(normalizedId);
    if (!org || org.deletedAt !== undefined) return null;
    return stripSecrets(org);
  },
});

export const getByLegacyId = query({
  args: { legacyId: v.string() },
  handler: async (ctx, args) => {
    if (!args.legacyId || !args.legacyId.trim()) return null;
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_legacy_id", (q) => q.eq("legacyId", args.legacyId))
      .first();

    if (!org || org.deletedAt !== undefined) return null;
    return stripSecrets(org);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    if (!args.slug || !args.slug.trim()) return null;
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!org || org.deletedAt !== undefined) return null;
    return stripSecrets(org);
  },
});

export const list = query({
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect();
    return orgs
      .filter((org) => org.deletedAt === undefined)
      .map((org) => stripSecrets(org));
  },
});

// Internal/Admin query that includes sensitive integration secrets and soft-deleted records when needed
export const getWithSecrets = query({
  args: { id: v.union(v.id("organizations"), v.string()) },
  handler: async (ctx, args) => {
    if (!args.id || args.id.trim() === "") return null;
    const normalizedId = ctx.db.normalizeId("organizations", args.id);
    if (!normalizedId) return null;
    return await ctx.db.get(normalizedId);
  },
});

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

export const create = mutation({
  args: {
    legacyId: v.optional(v.string()),
    name: v.string(),
    slug: v.optional(v.string()),
    legalEntityName: v.optional(v.string()),
    published: v.optional(v.boolean()),
    isTest: v.optional(v.boolean()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),

    // Contact & Location Fields
    phone: v.optional(v.string()),
    addressLine1: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    operationTiming: v.optional(v.any()),

    // Branding
    primaryColor: v.optional(v.string()),
    secondaryColor: v.optional(v.string()),
    theme: v.optional(v.string()),

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
    porterIntegration: v.optional(v.any()),

    // Integrations
    frenchyId: v.optional(v.string()),
    chargebeeCustomerId: v.optional(v.string()),
    whatsappIntegration: v.optional(v.boolean()),
    prestWhatsappIntegration: v.optional(v.boolean()),
    whatsappPhoneNumber: v.optional(v.string()),
    whatsappAccessToken: v.optional(v.string()),

    // Server-to-Server Provisioning Credentials
    provisioningToken: v.optional(v.string()),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // 1. Validate Name Presence
    if (!args.name || !args.name.trim()) {
      throw new Error("Name can't be blank");
    }

    // 2. Legacy ID duplicate check if legacyId supplied
    if (args.legacyId) {
      const existingLegacy = await ctx.db
        .query("organizations")
        .withIndex("by_legacy_id", (q) => q.eq("legacyId", args.legacyId!))
        .first();

      if (existingLegacy && existingLegacy.deletedAt === undefined) {
        throw new Error(
          `Organization with legacyId "${args.legacyId}" already exists.`
        );
      }
    }

    // 3. Resolve Slug (Auto-generate if missing or deduplicate)
    let finalSlug: string;
    if (args.slug && args.slug.trim()) {
      const explicitSlug = args.slug.trim();
      const existingSlug = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", explicitSlug))
        .first();

      if (existingSlug && existingSlug.deletedAt === undefined) {
        throw new Error(`Hey! ${explicitSlug} is already taken.`);
      }
      finalSlug = explicitSlug;
    } else {
      const baseSlug = generateBaseSlug(args.name);
      finalSlug = await resolveUniqueSlug(ctx, baseSlug);
    }

    // Enforce Server-to-Server Provisioning Authentication Guard
    await requireProvisioningAuth(ctx, {
      slug: finalSlug,
      provisioningToken: args.provisioningToken,
      timestamp: args.timestamp,
    });

    const now = Date.now();

    // 4. Resolve Confirmed Creation Defaults from PRD
    const isDineIn = args.isDineIn ?? false;
    const isTakeAway = args.isTakeAway ?? true;
    const isDelivery = args.isDelivery ?? false;

    // RULE 3: Dine-In Prepaid / Postpaid Exclusivity
    let dineinPrepaid = args.dineinPrepaid ?? false;
    let dineinPospaid = args.dineinPospaid ?? false;
    if (dineinPrepaid && dineinPospaid) {
      // Default to prepaid if both supplied true
      dineinPospaid = false;
    }

    const takeAwayOnlinePayment = args.takeAwayOnlinePayment ?? true;
    const takeAwayCashPayment = args.takeAwayCashPayment ?? false;
    const deliveryCashOnDelivery = args.deliveryCashOnDelivery ?? false;
    const deliveryOnlinePayment = args.deliveryOnlinePayment ?? false;
    const deliveryAggregator = args.deliveryAggregator ?? false;

    // 5. Evaluate Business Rule Validation
    validateOrganizationState({
      isDineIn,
      isTakeAway,
      isDelivery,
      dineinPrepaid,
      dineinPospaid,
      takeAwayCashPayment,
      takeAwayOnlinePayment,
      deliveryCashOnDelivery,
      deliveryOnlinePayment,
      deliveryAggregator,
      latitude: args.latitude,
      longitude: args.longitude,
      phone: args.phone,
    });

    const orgId = await ctx.db.insert("organizations", {
      legacyId: args.legacyId,
      name: args.name.trim(),
      slug: finalSlug,
      legalEntityName: args.legalEntityName,
      published: args.published ?? false,
      isTest: args.isTest ?? false,
      createdAt: args.createdAt ?? now,
      updatedAt: args.updatedAt ?? now,
      deletedAt: args.deletedAt,

      // Contact & Location
      phone: args.phone,
      addressLine1: args.addressLine1,
      city: args.city,
      state: args.state,
      country: args.country,
      zipCode: args.zipCode,
      latitude: args.latitude,
      longitude: args.longitude,
      operationTiming: args.operationTiming,

      // Branding
      primaryColor: args.primaryColor,
      secondaryColor: args.secondaryColor,
      theme: args.theme,

      // POS Feature & Module Configuration Defaults
      isDineIn,
      isTakeAway,
      isDashboard: args.isDashboard ?? true,
      isInventory: args.isInventory ?? false,
      isOrders: args.isOrders ?? true,
      isWorkstation: args.isWorkstation ?? false,
      isCashier: args.isCashier ?? true,
      isSettings: args.isSettings ?? true,
      onlineStore: args.onlineStore ?? false,
      isDelivery,
      isMenu: args.isMenu ?? false,
      isQueue: args.isQueue ?? true, // API default is queue active
      isKds: args.isKds ?? false,
      isSurveys: args.isSurveys ?? false,
      isCustomer: args.isCustomer ?? true,
      isCaptain: args.isCaptain ?? false,
      isReport: args.isReport ?? false,
      isVeg: args.isVeg ?? false,
      digitalStoreStatus: args.digitalStoreStatus ?? false,

      // Payment Config Defaults
      deliveryCashOnDelivery,
      dineinPrepaid,
      dineinPospaid,
      takeAwayOnlinePayment,
      takeAwayCashPayment,
      deliveryOnlinePayment,
      scheduledPickup: args.scheduledPickup ?? false,
      scheduledPickupOnlinePayment: args.scheduledPickupOnlinePayment ?? false,
      scheduledDeliveryOnlinePayment: args.scheduledDeliveryOnlinePayment ?? false,
      scheduledDelivery: args.scheduledDelivery ?? false,
      scheduledPickupCashPayment: args.scheduledPickupCashPayment ?? false,
      scheduledDeliveryCashPayment: args.scheduledDeliveryCashPayment ?? false,
      paymentSplitting: args.paymentSplitting,
      transferPercentage: args.transferPercentage ?? 0.03, // Confirmed PRD default 3%
      transferHoldTime: args.transferHoldTime ?? 18000, // Confirmed PRD default 5h

      // Delivery Defaults
      deliveryAggregator,
      deliverPartner: args.deliverPartner,
      porterLagTime: args.porterLagTime ?? 0,
      porterIntegration: args.porterIntegration,

      // Integrations
      frenchyId: args.frenchyId,
      chargebeeCustomerId: args.chargebeeCustomerId,
      whatsappIntegration: args.whatsappIntegration ?? false,
      prestWhatsappIntegration: args.prestWhatsappIntegration ?? false,
      whatsappPhoneNumber: args.whatsappPhoneNumber,
      whatsappAccessToken: args.whatsappAccessToken,
    });

    return orgId;
  },
});

export const update = mutation({
  args: {
    id: v.id("organizations"),
    name: v.optional(v.string()),
    legalEntityName: v.optional(v.string()),
    published: v.optional(v.boolean()),
    isTest: v.optional(v.boolean()),

    // Contact & Location
    phone: v.optional(v.string()),
    addressLine1: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    operationTiming: v.optional(v.any()),

    // Branding
    primaryColor: v.optional(v.string()),
    secondaryColor: v.optional(v.string()),
    theme: v.optional(v.string()),

    // Module & Feature Flags
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
    porterIntegration: v.optional(v.any()),

    // Integrations
    whatsappIntegration: v.optional(v.boolean()),
    prestWhatsappIntegration: v.optional(v.boolean()),
    whatsappPhoneNumber: v.optional(v.string()),
    whatsappAccessToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Organization not found");
    }

    const { id, ...updates } = args;

    // 1. Validate Name if updated
    if (updates.name !== undefined) {
      if (!updates.name || !updates.name.trim()) {
        throw new Error("Name can't be blank");
      }
      updates.name = updates.name.trim();
    }

    // 2. Online Store Lock Restriction
    // If published == true AND isTest == false, Store Admins cannot directly modify onlineStore
    if (
      existing.published === true &&
      existing.isTest === false &&
      updates.onlineStore !== undefined &&
      updates.onlineStore !== existing.onlineStore
    ) {
      throw new Error("Please contact support");
    }

    // 3. Payment Defaults Auto-Activation when Service Types are turned ON
    let dineinPrepaid = updates.dineinPrepaid ?? existing.dineinPrepaid;
    let dineinPospaid = updates.dineinPospaid ?? existing.dineinPospaid;

    // Dine-In Exclusivity Handling
    if (updates.dineinPrepaid === true) {
      dineinPospaid = false;
    } else if (updates.dineinPospaid === true) {
      dineinPrepaid = false;
    }

    const isDineIn = updates.isDineIn ?? existing.isDineIn;
    if (isDineIn && !dineinPrepaid && !dineinPospaid) {
      // Auto-enable prepaid default when dine-in enabled
      dineinPrepaid = true;
    }

    let takeAwayOnlinePayment =
      updates.takeAwayOnlinePayment ?? existing.takeAwayOnlinePayment;
    let takeAwayCashPayment =
      updates.takeAwayCashPayment ?? existing.takeAwayCashPayment;
    const isTakeAway = updates.isTakeAway ?? existing.isTakeAway;
    if (isTakeAway && !takeAwayOnlinePayment && !takeAwayCashPayment) {
      takeAwayOnlinePayment = true;
    }

    let deliveryOnlinePayment =
      updates.deliveryOnlinePayment ?? existing.deliveryOnlinePayment;
    let deliveryCashOnDelivery =
      updates.deliveryCashOnDelivery ?? existing.deliveryCashOnDelivery;
    const isDelivery = updates.isDelivery ?? existing.isDelivery;
    if (isDelivery && !deliveryOnlinePayment && !deliveryCashOnDelivery) {
      deliveryOnlinePayment = true;
    }

    let scheduledPickupOnlinePayment =
      updates.scheduledPickupOnlinePayment ?? existing.scheduledPickupOnlinePayment;
    const scheduledPickup = updates.scheduledPickup ?? existing.scheduledPickup;
    if (
      scheduledPickup &&
      !scheduledPickupOnlinePayment &&
      !(updates.scheduledPickupCashPayment ?? existing.scheduledPickupCashPayment)
    ) {
      scheduledPickupOnlinePayment = true;
    }

    let scheduledDeliveryOnlinePayment =
      updates.scheduledDeliveryOnlinePayment ?? existing.scheduledDeliveryOnlinePayment;
    const scheduledDelivery = updates.scheduledDelivery ?? existing.scheduledDelivery;
    if (
      scheduledDelivery &&
      !scheduledDeliveryOnlinePayment &&
      !(updates.scheduledDeliveryCashPayment ?? existing.scheduledDeliveryCashPayment)
    ) {
      scheduledDeliveryOnlinePayment = true;
    }

    // 4. Construct and Validate FINAL Resulting State
    const finalState = {
      ...existing,
      ...updates,
      isDineIn,
      isTakeAway,
      isDelivery,
      dineinPrepaid,
      dineinPospaid,
      takeAwayOnlinePayment,
      takeAwayCashPayment,
      deliveryOnlinePayment,
      deliveryCashOnDelivery,
      scheduledPickupOnlinePayment,
      scheduledDeliveryOnlinePayment,
    };

    validateOrganizationState(finalState);

    await ctx.db.patch(id, {
      ...updates,
      dineinPrepaid,
      dineinPospaid,
      takeAwayOnlinePayment,
      takeAwayCashPayment,
      deliveryOnlinePayment,
      deliveryCashOnDelivery,
      scheduledPickupOnlinePayment,
      scheduledDeliveryOnlinePayment,
      updatedAt: Date.now(),
    });
  },
});

// Dedicated Publishing Mutation (`liveOrganization`)
export const liveOrganization = mutation({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.id);
    if (!org || org.deletedAt !== undefined) {
      throw new Error("Organization not found");
    }

    // Legacy publishing gate: Can only publish directly if onlineStore == false
    if (org.onlineStore === true) {
      throw new Error("Please contact support");
    }

    await ctx.db.patch(args.id, {
      published: true,
      updatedAt: Date.now(),
    });
  },
});

// Store Initialization & Seeding Mutation (`initializeStore`)
export const initializeStore = mutation({
  args: {
    id: v.id("organizations"),
    slug: v.optional(v.string()),
    provisioningToken: v.optional(v.string()),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.id);
    if (!org || org.deletedAt !== undefined) {
      throw new Error("Organization not found");
    }

    // Enforce Server-to-Server Provisioning Authentication Guard
    const targetSlug = args.slug || org.slug;
    await requireProvisioningAuth(ctx, {
      slug: targetSlug,
      provisioningToken: args.provisioningToken,
      timestamp: args.timestamp,
    });

    const now = Date.now();

    // 1. Order Processes Seeding (Idempotent)
    const existingProcesses = await ctx.db
      .query("orderProcesses")
      .withIndex("by_org", (q) => q.eq("organizationId", args.id))
      .collect();

    if (existingProcesses.length === 0) {
      const defaultProcesses = [
        { name: "Accepted", stepOrder: 1 },
        { name: "In progress", stepOrder: 2 },
        { name: "Ready to deliver", stepOrder: 3 },
        { name: "Delivered", stepOrder: 4 },
        { name: "Created", stepOrder: 5 },
        { name: "Modify", stepOrder: 6 },
        { name: "Reject", stepOrder: 7 },
      ];

      for (const proc of defaultProcesses) {
        await ctx.db.insert("orderProcesses", {
          organizationId: args.id,
          name: proc.name,
          stepOrder: proc.stepOrder,
          createdAt: now,
        });
      }
    }

    // 2. Prep Stations Seeding (Idempotent)
    const existingStations = await ctx.db
      .query("stations")
      .withIndex("by_org", (q) => q.eq("organizationId", args.id))
      .collect();

    if (existingStations.length === 0) {
      await ctx.db.insert("stations", {
        organizationId: args.id,
        name: "Main",
        isMain: true,
        createdAt: now,
      });
    }

    // 3. Payment Modes Seeding (Idempotent)
    const existingPaymentModes = await ctx.db
      .query("paymentModes")
      .withIndex("by_org", (q) => q.eq("organizationId", args.id))
      .collect();

    if (existingPaymentModes.length === 0) {
      const modes = ["Cash", "Credit Card", "Debit Card", "UPI"];
      for (const mode of modes) {
        await ctx.db.insert("paymentModes", {
          organizationId: args.id,
          name: mode,
          active: true,
          createdAt: now,
        });
      }
    }

    // 4. Inventory Categories Seeding (Idempotent)
    const existingCategories = await ctx.db
      .query("inventoryCategories")
      .withIndex("by_org", (q) => q.eq("organizationId", args.id))
      .collect();

    if (existingCategories.length === 0) {
      const defaultCategories = [
        "Baked items",
        "Beverages",
        "Dairy items",
        "Dry items",
        "Frozen foods",
        "Fresh produce",
        "Meat & poultry",
        "Seafood",
        "Spices & seasonings",
        "Staples",
      ];

      for (const cat of defaultCategories) {
        await ctx.db.insert("inventoryCategories", {
          organizationId: args.id,
          name: cat,
          createdAt: now,
        });
      }
    }

    // 5. Operating Hours Seeding on Organization Document
    if (!org.operationTiming) {
      const defaultTimings = {
        monday: { open: "11:00", close: "23:59", active: true },
        tuesday: { open: "11:00", close: "23:59", active: true },
        wednesday: { open: "11:00", close: "23:59", active: true },
        thursday: { open: "11:00", close: "23:59", active: true },
        friday: { open: "11:00", close: "23:59", active: true },
        saturday: { open: "11:00", close: "23:59", active: true },
        sunday: { open: "11:00", close: "23:59", active: true },
      };

      await ctx.db.patch(args.id, {
        operationTiming: defaultTimings,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

// Soft Deletion Mutation (`remove`)
export const remove = mutation({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.id);
    if (!org || org.deletedAt !== undefined) {
      throw new Error("Organization not found");
    }

    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
