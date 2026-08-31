// import { mutation, query } from "./_generated/server";
// import { v } from "convex/values";

// export const get = query({
//   args: { id: v.id("organizations") },
//   handler: async (ctx, args) => {
//     return await ctx.db.get(args.id);
//   },
// });

// export const getByLegacyId = query({
//   args: { legacyId: v.string() },
//   handler: async (ctx, args) => {
//     return await ctx.db
//       .query("organizations")
//       .withIndex("by_legacy_id", (q) => q.eq("legacyId", args.legacyId))
//       .first();
//   },
// });

// export const getBySlug = query({
//   args: { slug: v.string() },
//   handler: async (ctx, args) => {
//     return await ctx.db
//       .query("organizations")
//       .withIndex("by_slug", (q) => q.eq("slug", args.slug))
//       .first();
//   },
// });

// export const list = query({
//   handler: async (ctx) => {
//     return await ctx.db.query("organizations").collect();
//   },
// });

// export const create = mutation({
//   args: {
//     legacyId: v.string(),
//     name: v.string(),
//     slug: v.string(),
//     legalEntityName: v.optional(v.string()),
//     published: v.optional(v.boolean()),
//     isTest: v.optional(v.boolean()),
//     createdAt: v.optional(v.number()),
//     updatedAt: v.optional(v.number()),
//     deletedAt: v.optional(v.number()),

//     // POS Feature Flags
//     isDineIn: v.optional(v.boolean()),
//     isTakeAway: v.optional(v.boolean()),
//     isDashboard: v.optional(v.boolean()),
//     isInventory: v.optional(v.boolean()),
//     isOrders: v.optional(v.boolean()),
//     isWorkstation: v.optional(v.boolean()),
//     isCashier: v.optional(v.boolean()),
//     isSettings: v.optional(v.boolean()),
//     onlineStore: v.optional(v.boolean()),
//     isDelivery: v.optional(v.boolean()),
//     isMenu: v.optional(v.boolean()),
//     isQueue: v.optional(v.boolean()),
//     isKds: v.optional(v.boolean()),
//     isSurveys: v.optional(v.boolean()),
//     isCustomer: v.optional(v.boolean()),
//     isCaptain: v.optional(v.boolean()),
//     isReport: v.optional(v.boolean()),
//     isVeg: v.optional(v.boolean()),
//     digitalStoreStatus: v.optional(v.boolean()),

//     // Payment Flags
//     deliveryCashOnDelivery: v.optional(v.boolean()),
//     dineinPrepaid: v.optional(v.boolean()),
//     dineinPospaid: v.optional(v.boolean()),
//     takeAwayOnlinePayment: v.optional(v.boolean()),
//     takeAwayCashPayment: v.optional(v.boolean()),
//     deliveryOnlinePayment: v.optional(v.boolean()),
//     scheduledPickup: v.optional(v.boolean()),
//     scheduledPickupOnlinePayment: v.optional(v.boolean()),
//     scheduledDeliveryOnlinePayment: v.optional(v.boolean()),
//     scheduledDelivery: v.optional(v.boolean()),
//     scheduledPickupCashPayment: v.optional(v.boolean()),
//     scheduledDeliveryCashPayment: v.optional(v.boolean()),
//     paymentSplitting: v.optional(v.any()),
//     transferPercentage: v.optional(v.number()),
//     transferHoldTime: v.optional(v.number()),

//     // Delivery Config
//     deliveryAggregator: v.optional(v.boolean()),
//     deliverPartner: v.optional(v.string()),
//     porterLagTime: v.optional(v.number()),

//     // Integrations
//     frenchyId: v.optional(v.string()),
//     chargebeeCustomerId: v.optional(v.string()),
//     whatsappIntegration: v.optional(v.boolean()),
//     prestWhatsappIntegration: v.optional(v.boolean()),
//     whatsappPhoneNumber: v.optional(v.string()),
//     whatsappAccessToken: v.optional(v.string()),
//   },
//   handler: async (ctx, args) => {
//     const existing = await ctx.db
//       .query("organizations")
//       .withIndex("by_legacy_id", (q) => q.eq("legacyId", args.legacyId))
//       .first();

//     if (existing) {
//       throw new Error(`Organization with legacyId "${args.legacyId}" already exists.`);
//     }

//     const now = Date.now();

//     return await ctx.db.insert("organizations", {
//       legacyId: args.legacyId,
//       name: args.name,
//       slug: args.slug,
//       legalEntityName: args.legalEntityName,
//       published: args.published ?? false,
//       isTest: args.isTest ?? false,
//       createdAt: args.createdAt ?? now,
//       updatedAt: args.updatedAt ?? now,
//       deletedAt: args.deletedAt,

//       // POS Feature Defaults (matching PostgreSQL defaults)
//       isDineIn: args.isDineIn ?? false,
//       isTakeAway: args.isTakeAway ?? true,
//       isDashboard: args.isDashboard ?? true,
//       isInventory: args.isInventory ?? false,
//       isOrders: args.isOrders ?? true,
//       isWorkstation: args.isWorkstation ?? false,
//       isCashier: args.isCashier ?? true,
//       isSettings: args.isSettings ?? true,
//       onlineStore: args.onlineStore ?? false,
//       isDelivery: args.isDelivery ?? false,
//       isMenu: args.isMenu ?? false,
//       isQueue: args.isQueue ?? false,
//       isKds: args.isKds ?? false,
//       isSurveys: args.isSurveys ?? false,
//       isCustomer: args.isCustomer ?? true,
//       isCaptain: args.isCaptain ?? false,
//       isReport: args.isReport ?? false,
//       isVeg: args.isVeg ?? true,
//       digitalStoreStatus: args.digitalStoreStatus ?? false,

//       // Payment Config Defaults
//       deliveryCashOnDelivery: args.deliveryCashOnDelivery ?? false,
//       dineinPrepaid: args.dineinPrepaid ?? false,
//       dineinPospaid: args.dineinPospaid ?? false,
//       takeAwayOnlinePayment: args.takeAwayOnlinePayment ?? false,
//       takeAwayCashPayment: args.takeAwayCashPayment ?? false,
//       deliveryOnlinePayment: args.deliveryOnlinePayment ?? false,
//       scheduledPickup: args.scheduledPickup ?? false,
//       scheduledPickupOnlinePayment: args.scheduledPickupOnlinePayment ?? false,
//       scheduledDeliveryOnlinePayment: args.scheduledDeliveryOnlinePayment ?? false,
//       scheduledDelivery: args.scheduledDelivery ?? false,
//       scheduledPickupCashPayment: args.scheduledPickupCashPayment ?? false,
//       scheduledDeliveryCashPayment: args.scheduledDeliveryCashPayment ?? false,
//       paymentSplitting: args.paymentSplitting,
//       transferPercentage: args.transferPercentage ?? 0.0,
//       transferHoldTime: args.transferHoldTime ?? 0,

//       // Delivery Defaults
//       deliveryAggregator: args.deliveryAggregator ?? false,
//       deliverPartner: args.deliverPartner,
//       porterLagTime: args.porterLagTime ?? 0,

//       // Integrations
//       frenchyId: args.frenchyId,
//       chargebeeCustomerId: args.chargebeeCustomerId,
//       whatsappIntegration: args.whatsappIntegration ?? false,
//       prestWhatsappIntegration: args.prestWhatsappIntegration ?? false,
//       whatsappPhoneNumber: args.whatsappPhoneNumber,
//       whatsappAccessToken: args.whatsappAccessToken,
//     });
//   },
// });

// export const update = mutation({
//   args: {
//     id: v.id("organizations"),
//     name: v.optional(v.string()),
//     legalEntityName: v.optional(v.string()),
//     published: v.optional(v.boolean()),
//     isTest: v.optional(v.boolean()),
//     isDineIn: v.optional(v.boolean()),
//     isTakeAway: v.optional(v.boolean()),
//     isDashboard: v.optional(v.boolean()),
//     isInventory: v.optional(v.boolean()),
//     isOrders: v.optional(v.boolean()),
//     isWorkstation: v.optional(v.boolean()),
//     isCashier: v.optional(v.boolean()),
//     isSettings: v.optional(v.boolean()),
//     onlineStore: v.optional(v.boolean()),
//     isDelivery: v.optional(v.boolean()),
//     isMenu: v.optional(v.boolean()),
//     isQueue: v.optional(v.boolean()),
//     isKds: v.optional(v.boolean()),
//     isSurveys: v.optional(v.boolean()),
//     isCustomer: v.optional(v.boolean()),
//     isCaptain: v.optional(v.boolean()),
//     isReport: v.optional(v.boolean()),
//     isVeg: v.optional(v.boolean()),
//     digitalStoreStatus: v.optional(v.boolean()),
//     deliveryCashOnDelivery: v.optional(v.boolean()),
//     dineinPrepaid: v.optional(v.boolean()),
//     dineinPospaid: v.optional(v.boolean()),
//     takeAwayOnlinePayment: v.optional(v.boolean()),
//     takeAwayCashPayment: v.optional(v.boolean()),
//     deliveryOnlinePayment: v.optional(v.boolean()),
//     scheduledPickup: v.optional(v.boolean()),
//     scheduledPickupOnlinePayment: v.optional(v.boolean()),
//     scheduledDeliveryOnlinePayment: v.optional(v.boolean()),
//     scheduledDelivery: v.optional(v.boolean()),
//     scheduledPickupCashPayment: v.optional(v.boolean()),
//     scheduledDeliveryCashPayment: v.optional(v.boolean()),
//     paymentSplitting: v.optional(v.any()),
//     transferPercentage: v.optional(v.number()),
//     transferHoldTime: v.optional(v.number()),
//     deliveryAggregator: v.optional(v.boolean()),
//     deliverPartner: v.optional(v.string()),
//     porterLagTime: v.optional(v.number()),
//     whatsappIntegration: v.optional(v.boolean()),
//     whatsappPhoneNumber: v.optional(v.string()),
//   },
//   handler: async (ctx, args) => {
//     const { id, ...updates } = args;
//     await ctx.db.patch(id, {
//       ...updates,
//       updatedAt: Date.now(),
//     });
//   },
// });

// export const remove = mutation({
//   args: { id: v.id("organizations") },
//   handler: async (ctx, args) => {
//     await ctx.db.delete(args.id);
//   },
// });








import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAuth } from "./organizationUsers";
import { initializeDefaultsHelper } from "./organizationFeatures";



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
    return;
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
  const { whatsappAccessToken, razorPayApiKey, stripeSecretKey, ...safeOrg } = org;
  return safeOrg;
}

// Helper: Country-Specific Phone Validation & Normalization
function validatePhoneWithCountryCode(phone?: string, country?: string): string | undefined {
  if (!phone || !phone.trim()) return undefined;

  const raw = phone.trim();

  // Check for invalid formatting characters (spaces, hyphens, slashes, alphabetic characters)
  if (/[^0-9+]/.test(raw) || (raw.includes("+") && !raw.startsWith("+"))) {
    throw new Error("Phone must contain only digits, with no spaces, hyphens, or slashes");
  }

  const digitsOnly = raw.replace(/\D/g, "");

  const isUae =
    country === "United Arab Emirates" ||
    country === "UAE" ||
    country === "+971" ||
    raw.startsWith("+971");

  if (isUae) {
    let uaeDigits = digitsOnly;
    if (uaeDigits.startsWith("971")) {
      uaeDigits = uaeDigits.slice(3);
    }

    if (uaeDigits.length !== 9) {
      throw new Error("Phone must be 9 digits long for UAE");
    }

    return `+971${uaeDigits}`;
  } else {
    let otherDigits = digitsOnly;
    if (otherDigits.startsWith("91") && otherDigits.length === 12) {
      otherDigits = otherDigits.slice(2);
    }

    if (otherDigits.length !== 10) {
      throw new Error("Phone must be 10 digits long for other countries");
    }

    if (raw.startsWith("+")) {
      return raw;
    }
    return `+91${otherDigits}`;
  }
}

// Helper: Normalize All-Day Operating Hours
function normalizeAllDayHours(operationTiming: any): any {
  if (!operationTiming || typeof operationTiming !== "object") return operationTiming;

  const fullDayStart = "2023-05-08T00:00:00.000+05:30";
  const fullDayEnd = "2023-05-08T23:59:59.000+05:30";

  const updatedTiming = { ...operationTiming };
  for (const day of Object.keys(updatedTiming)) {
    const dayData = updatedTiming[day];
    if (dayData && typeof dayData === "object" && dayData.is_open_all_day === true) {
      updatedTiming[day] = {
        ...dayData,
        hours: [
          {
            start_time: fullDayStart,
            end_time: fullDayEnd,
          },
        ],
      };
    }
  }
  return updatedTiming;
}

// Helper: Operating Hours Overlap Validation
function validateOperatingHoursOverlap(operationTiming: any): void {
  if (!operationTiming || typeof operationTiming !== "object") return;

  for (const dayKey of Object.keys(operationTiming)) {
    const dayConfig = operationTiming[dayKey];
    if (!dayConfig || typeof dayConfig !== "object") continue;

    const hours = dayConfig.hours;
    if (!Array.isArray(hours) || hours.length <= 1) continue;

    const parsedSlots: Array<{ start: number; end: number }> = [];

    for (const hourObj of hours) {
      if (!hourObj.start_time || !hourObj.end_time) continue;

      let startMs: number;
      let endMs: number;

      if (
        hourObj.start_time.includes("T") ||
        hourObj.start_time.includes("GMT") ||
        hourObj.start_time.includes(" ")
      ) {
        startMs = new Date(hourObj.start_time).getTime();
        endMs = new Date(hourObj.end_time).getTime();
      } else {
        const [sh, sm] = hourObj.start_time.split(":").map(Number);
        const [eh, em] = hourObj.end_time.split(":").map(Number);
        startMs = sh * 60 + sm;
        endMs = eh * 60 + em;
      }

      if (isNaN(startMs) || isNaN(endMs)) {
        throw new Error("invalid time format detected");
      }

      parsedSlots.push({ start: startMs, end: endMs });
    }

    parsedSlots.sort((a, b) => a.start - b.start);

    for (let i = 0; i < parsedSlots.length - 1; i++) {
      if (parsedSlots[i + 1].start < parsedSlots[i].end) {
        throw new Error(`overlapping time ranges found for ${dayKey}`);
      }
    }
  }
}

// Helper: Resolve Default Currency & Symbol from Country Fallback
function resolveCurrencyAndSymbol(
  explicitCurrency?: string,
  explicitSymbol?: string,
  country?: string
): { defaultCurrency?: string; defaultCurrencySymbol?: string } {
  if (explicitCurrency && explicitSymbol) {
    return {
      defaultCurrency: explicitCurrency,
      defaultCurrencySymbol: explicitSymbol,
    };
  }

  if (country) {
    const c = country.trim().toLowerCase();
    if (c === "india" || c === "in" || c === "+91") {
      return {
        defaultCurrency: explicitCurrency || "INR",
        defaultCurrencySymbol: explicitSymbol || "₹",
      };
    }
    if (c === "united arab emirates" || c === "uae" || c === "+971") {
      return {
        defaultCurrency: explicitCurrency || "AED",
        defaultCurrencySymbol: explicitSymbol || "AED",
      };
    }
    if (c === "united states" || c === "us" || c === "usa" || c === "+1") {
      return {
        defaultCurrency: explicitCurrency || "USD",
        defaultCurrencySymbol: explicitSymbol || "$",
      };
    }
  }

  return {
    defaultCurrency: explicitCurrency || "INR",
    defaultCurrencySymbol: explicitSymbol || "₹",
  };
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
  receiptPrintCount?: number;
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

  // RULE 7: receiptPrintCount validation
  if (org.receiptPrintCount !== undefined && org.receiptPrintCount < 1) {
    throw new Error("receiptPrintCount must be at least 1");
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
    await requireAuth(ctx);
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

    // Extended Contact & Location
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

    // GST Compliance
    isGst: v.optional(v.boolean()),
    inclusiveGst: v.optional(v.boolean()),
    separateGst: v.optional(v.boolean()),
    gstNumber: v.optional(v.string()),

    // FSSAI Compliance
    isFssai: v.optional(v.boolean()),
    fssaiRegistrationNumber: v.optional(v.string()),
    expiryDate: v.optional(v.number()),

    // Currency & Regional Timezone
    defaultCurrency: v.optional(v.string()),
    defaultCurrencySymbol: v.optional(v.string()),
    organizationTimeZone: v.optional(v.string()),

    // Printing
    receiptPrintCount: v.optional(v.number()),
    menuBasedPrintToken: v.optional(v.boolean()),
    showQrCode: v.optional(v.boolean()),

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

    // Payment Gateway Secrets
    razorPayKeyId: v.optional(v.string()),
    razorPayApiKey: v.optional(v.string()),
    stripePublishableKey: v.optional(v.string()),
    stripeSecretKey: v.optional(v.string()),

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
    ownerClerkId: v.optional(v.string()), // Initial Owner/Admin Clerk User ID (for store provisioning)
    provisioningToken: v.optional(v.string()), // Server-to-server HMAC SHA-256 provisioning token
    timestamp: v.optional(v.number()), // Server-to-server HMAC timestamp (ms)
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

    // 4. Resolve Phone Validation & Normalization
    const validatedPhone = validatePhoneWithCountryCode(args.phone, args.country);

    // 5. Resolve Operating Hours Normalization & Overlap Validation
    let normalizedTiming = args.operationTiming;
    if (normalizedTiming) {
      normalizedTiming = normalizeAllDayHours(normalizedTiming);
      validateOperatingHoursOverlap(normalizedTiming);
    }

    // 6. Resolve Currency Defaults
    const { defaultCurrency, defaultCurrencySymbol } = resolveCurrencyAndSymbol(
      args.defaultCurrency,
      args.defaultCurrencySymbol,
      args.country
    );

    // 7. Resolve Organization Profile & Compliance Defaults from PRD
    const isGst = args.isGst ?? false;
    const inclusiveGst = args.inclusiveGst ?? false;
    const separateGst = args.separateGst ?? true;
    const isFssai = args.isFssai ?? false;
    const receiptPrintCount = args.receiptPrintCount ?? 1;
    const menuBasedPrintToken = args.menuBasedPrintToken ?? false;
    const showQrCode = args.showQrCode ?? false;
    const organizationTimeZone = args.organizationTimeZone ?? "UTC";

    // Service Mode Defaults
    const isDineIn = args.isDineIn ?? false;
    const isTakeAway = args.isTakeAway ?? true;
    const isDelivery = args.isDelivery ?? false;

    // Dine-In Prepaid / Postpaid Exclusivity
    let dineinPrepaid = args.dineinPrepaid ?? false;
    let dineinPospaid = args.dineinPospaid ?? false;
    if (dineinPrepaid && dineinPospaid) {
      dineinPospaid = false;
    }

    const takeAwayOnlinePayment = args.takeAwayOnlinePayment ?? true;
    const takeAwayCashPayment = args.takeAwayCashPayment ?? false;
    const deliveryCashOnDelivery = args.deliveryCashOnDelivery ?? false;
    const deliveryOnlinePayment = args.deliveryOnlinePayment ?? false;
    const deliveryAggregator = args.deliveryAggregator ?? false;

    // 8. Evaluate Business Rule Validation
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
      phone: validatedPhone,
      receiptPrintCount,
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
      phone: validatedPhone,
      addressLine1: args.addressLine1,
      addressLine2: args.addressLine2,
      landmark: args.landmark,
      city: args.city,
      state: args.state,
      country: args.country,
      zipCode: args.zipCode,
      mobile: args.mobile,
      email: args.email,
      fax: args.fax,
      areaCode: args.areaCode,
      latitude: args.latitude,
      longitude: args.longitude,
      operationTiming: normalizedTiming,

      // GST Compliance
      isGst,
      inclusiveGst,
      separateGst,
      gstNumber: args.gstNumber,

      // FSSAI Compliance
      isFssai,
      fssaiRegistrationNumber: args.fssaiRegistrationNumber,
      expiryDate: args.expiryDate,

      // Currency & Regional Timezone
      defaultCurrency,
      defaultCurrencySymbol,
      organizationTimeZone,

      // Printing
      receiptPrintCount,
      menuBasedPrintToken,
      showQrCode,

      // Branding
      primaryColor: args.primaryColor,
      secondaryColor: args.secondaryColor,
      theme: args.theme,

      // POS Feature Flags Defaults
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
      isQueue: args.isQueue ?? true,
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
      transferPercentage: args.transferPercentage ?? 0.03,
      transferHoldTime: args.transferHoldTime ?? 18000,

      // Payment Secrets
      razorPayKeyId: args.razorPayKeyId,
      razorPayApiKey: args.razorPayApiKey,
      stripePublishableKey: args.stripePublishableKey,
      stripeSecretKey: args.stripeSecretKey,

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

      // Provisioning Owner Metadata
      ownerClerkId: args.ownerClerkId?.trim() || (await ctx.auth.getUserIdentity())?.subject,
    });

    // 6. Initial Owner Seeding during Provisioning / Creation
    const effectiveOwnerId =
      args.ownerClerkId?.trim() || (await ctx.auth.getUserIdentity())?.subject;

    if (effectiveOwnerId) {
      const existingOwner = await ctx.db
        .query("organizationUsers")
        .withIndex("by_user_and_org", (q) =>
          q.eq("userId", effectiveOwnerId).eq("organizationId", orgId)
        )
        .first();

      if (!existingOwner) {
        await ctx.db.insert("organizationUsers", {
          organizationId: orgId,
          userId: effectiveOwnerId,
          userType: ["admin"],
          userPermission: {
            admin: { create: true, read: true, update: true, delete: true },
          },
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return orgId;
  },
});

// Dedicated Provisioning Mutation for Initial Owner
export const createInitialOwner = mutation({
  args: {
    organizationId: v.id("organizations"),
    ownerClerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org || org.deletedAt !== undefined) {
      throw new Error("Organization not found");
    }

    const ownerId = args.ownerClerkId.trim();
    if (!ownerId) {
      throw new Error("Owner Clerk ID cannot be blank");
    }

    const existingOwner = await ctx.db
      .query("organizationUsers")
      .withIndex("by_user_and_org", (q) =>
        q.eq("userId", ownerId).eq("organizationId", args.organizationId)
      )
      .first();

    const now = Date.now();
    if (existingOwner) {
      if (existingOwner.deletedAt !== undefined) {
        await ctx.db.patch(existingOwner._id, {
          deletedAt: undefined,
          userType: Array.from(new Set([...existingOwner.userType, "admin"])),
          updatedAt: now,
        });
        return existingOwner._id;
      }
      return existingOwner._id;
    }

    return await ctx.db.insert("organizationUsers", {
      organizationId: args.organizationId,
      userId: ownerId,
      userType: ["admin"],
      userPermission: {
        admin: { create: true, read: true, update: true, delete: true },
      },
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Idempotent Repair Mutation: Safely backfill ownerClerkId and admin membership for pre-existing store organization
 */
export const repairStoreOwnerAdmin = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    let orgId = args.organizationId;
    if (!orgId) {
      const firstOrg = await ctx.db.query("organizations").first();
      if (!firstOrg || firstOrg.deletedAt !== undefined) {
        throw new Error("Store organization not initialized");
      }
      orgId = firstOrg._id;
    }

    const org = await ctx.db.get(orgId);
    if (!org || org.deletedAt !== undefined) {
      throw new Error("Organization not found");
    }

    // Ownership Takeover Guard: If organization already has an owner assigned to another user
    if (org.ownerClerkId && org.ownerClerkId !== identity.subject) {
      const existingCallerMember = await ctx.db
        .query("organizationUsers")
        .withIndex("by_user_and_org", (q) =>
          q.eq("userId", identity.subject).eq("organizationId", org._id)
        )
        .first();

      const isAlreadyAdmin = Boolean(
        existingCallerMember &&
          existingCallerMember.deletedAt === undefined &&
          existingCallerMember.userType.some((t: string) =>
            ["admin", "store_admin", "org_admin", "super_admin"].includes(
              (t || "").trim().toLowerCase()
            )
          )
      );
      if (!isAlreadyAdmin) {
        throw new Error("Forbidden. Organization owner is assigned to another user.");
      }
      return { success: true, repaired: false };
    }

    const now = Date.now();

    // Safe Backfill: Only set ownerClerkId if org.ownerClerkId is unassigned
    if (!org.ownerClerkId) {
      await ctx.db.patch(org._id, {
        ownerClerkId: identity.subject,
        updatedAt: now,
      });
    }

    // Ensure organizationUsers admin membership record exists
    const existingMember = await ctx.db
      .query("organizationUsers")
      .withIndex("by_user_and_org", (q) =>
        q.eq("userId", identity.subject).eq("organizationId", org._id)
      )
      .first();

    if (!existingMember) {
      const newMemberId = await ctx.db.insert("organizationUsers", {
        organizationId: org._id,
        userId: identity.subject,
        userType: ["admin"],
        userPermission: {
          admin: { create: true, read: true, update: true, delete: true },
        },
        createdAt: now,
        updatedAt: now,
      });
      return { success: true, repaired: true, membershipId: newMemberId };
    } else {
      const hasAdmin = existingMember.userType.some((t) =>
        ["admin", "store_admin", "org_admin", "super_admin"].includes(
          (t || "").trim().toLowerCase()
        )
      );
      if (!hasAdmin || existingMember.deletedAt !== undefined) {
        await ctx.db.patch(existingMember._id, {
          userType: Array.from(new Set([...existingMember.userType, "admin"])),
          deletedAt: undefined,
          updatedAt: now,
        });
        return { success: true, repaired: true, membershipId: existingMember._id };
      }
    }

    return { success: true, repaired: false };
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

    // GST Compliance
    isGst: v.optional(v.boolean()),
    inclusiveGst: v.optional(v.boolean()),
    separateGst: v.optional(v.boolean()),
    gstNumber: v.optional(v.string()),

    // FSSAI Compliance
    isFssai: v.optional(v.boolean()),
    fssaiRegistrationNumber: v.optional(v.string()),
    expiryDate: v.optional(v.number()),

    // Currency & Regional Timezone
    defaultCurrency: v.optional(v.string()),
    defaultCurrencySymbol: v.optional(v.string()),
    organizationTimeZone: v.optional(v.string()),

    // Printing
    receiptPrintCount: v.optional(v.number()),
    menuBasedPrintToken: v.optional(v.boolean()),
    showQrCode: v.optional(v.boolean()),

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

    // Payment Gateway Secrets
    razorPayKeyId: v.optional(v.string()),
    razorPayApiKey: v.optional(v.string()),
    stripePublishableKey: v.optional(v.string()),
    stripeSecretKey: v.optional(v.string()),

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
    await requireAuth(ctx);
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
    if (
      existing.published === true &&
      existing.isTest === false &&
      updates.onlineStore !== undefined &&
      updates.onlineStore !== existing.onlineStore
    ) {
      throw new Error("Please contact support");
    }

    // 3. Phone Validation if updated
    if (updates.phone !== undefined) {
      const targetCountry = updates.country ?? existing.country;
      updates.phone = validatePhoneWithCountryCode(updates.phone, targetCountry);
    }

    // 4. Operating Hours Normalization & Overlap Validation if updated
    if (updates.operationTiming !== undefined) {
      updates.operationTiming = normalizeAllDayHours(updates.operationTiming);
      validateOperatingHoursOverlap(updates.operationTiming);
    }

    // 5. Payment Defaults Auto-Activation when Service Types are turned ON
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

    // 6. Construct and Validate FINAL Resulting State
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
    await requireAuth(ctx);
    const org = await ctx.db.get(args.id);
    if (!org || org.deletedAt !== undefined) {
      throw new Error("Organization not found");
    }

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

    // 5. Operating Hours Seeding on Organization Document (Idempotent)
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

    // 6. Ensure Missing Profile Defaults for Existing partially-initialized Orgs
    const patches: Record<string, any> = {};
    if (org.isGst === undefined) patches.isGst = false;
    if (org.inclusiveGst === undefined) patches.inclusiveGst = false;
    if (org.separateGst === undefined) patches.separateGst = true;
    if (org.isFssai === undefined) patches.isFssai = false;
    if (org.receiptPrintCount === undefined) patches.receiptPrintCount = 1;
    if (org.menuBasedPrintToken === undefined) patches.menuBasedPrintToken = false;
    if (org.showQrCode === undefined) patches.showQrCode = false;

    if (Object.keys(patches).length > 0) {
      patches.updatedAt = now;
      await ctx.db.patch(args.id, patches);
    }

    // 7. Default Organization Feature Flags Seeding (Idempotent)
    await initializeDefaultsHelper(ctx);

    // 8. Default Organization Layout Seeding (Idempotent)
    const existingLayouts = await ctx.db.query("organizationLayouts").collect();
    const activeIndoorDineIn = existingLayouts.find(
      (l) => l.deletedAt === undefined && l.name.toLowerCase() === "indoor-dinein"
    );

    if (!activeIndoorDineIn) {
      await ctx.db.insert("organizationLayouts", {
        name: "Indoor-DineIn",
        createdAt: now,
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
    await requireAuth(ctx);
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

export const seedDefault = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("organizations").first();
    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    return await ctx.db.insert("organizations", {
      legacyId: `legacy-${now}`,
      name: "DEFx POS Main Store",
      slug: "defx-pos-main-store",
      legalEntityName: "DEFx POS Private Limited",
      published: true,
      isTest: false,
      createdAt: now,
      updatedAt: now,
      isGst: false,
      inclusiveGst: false,
      separateGst: false,
      isFssai: false,
      receiptPrintCount: 1,
      menuBasedPrintToken: false,
      showQrCode: false,
      isDineIn: true,
      isTakeAway: true,
      isDashboard: true,
      isInventory: true,
      isOrders: true,
      isWorkstation: true,
      isCashier: true,
      isSettings: true,
      onlineStore: true,
      isDelivery: true,
      isMenu: true,
      isQueue: true,
      isKds: true,
      isSurveys: true,
      isCustomer: true,
      isCaptain: true,
      isReport: true,
      isVeg: true,
      digitalStoreStatus: true,
      deliveryCashOnDelivery: true,
      dineinPrepaid: true,
      dineinPospaid: false,
      takeAwayOnlinePayment: true,
      takeAwayCashPayment: true,
      deliveryOnlinePayment: true,
      scheduledPickup: true,
      scheduledPickupOnlinePayment: true,
      scheduledDeliveryOnlinePayment: true,
      scheduledDelivery: true,
      scheduledPickupCashPayment: true,
      scheduledDeliveryCashPayment: true,
      transferPercentage: 0,
      transferHoldTime: 0,
      deliveryAggregator: false,
      porterLagTime: 0,
      whatsappIntegration: false,
      prestWhatsappIntegration: false,
    });
  },
});