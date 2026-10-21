import { action, internalMutation, mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  requireAuth,
  resolveStoreOrganization,
  getCallerMembership,
} from "./organizationUsers";
import { getSmsProvider } from "./smsProvider";

// ----------------------------------------------------
// VALIDATION & NORMALIZATION HELPERS
// ----------------------------------------------------

/**
 * Normalizes a phone string by trimming whitespace, dashes, and special formatting characters.
 */
export function normalizePhone(rawPhone: string): string {
  if (!rawPhone) return "";
  const cleaned = rawPhone.replace(/[\s\-\(\)\/\+]/g, "");
  return cleaned;
}

/**
 * Validates normalized phone format.
 */
export function validatePhone(phone: string, countryCode?: string): void {
  const normalized = normalizePhone(phone);
  if (!normalized || !/^\d+$/.test(normalized)) {
    throw new Error("Phone number must contain only digits.");
  }

  // Support typical phone length boundaries (7-15 digits E.164 compatible)
  if (normalized.length < 7 || normalized.length > 15) {
    throw new Error("Phone number must be between 7 and 15 digits.");
  }
}

/**
 * Validates email format if provided.
 */
export function validateEmail(email?: string): void {
  if (!email || email.trim() === "") return;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    throw new Error("Invalid email address format.");
  }
}

// ----------------------------------------------------
// AUTHORIZATION HELPERS
// ----------------------------------------------------

/**
 * Ensures caller is an active store staff member (Admin, Cashier, Captain, Waiter).
 */
export async function requireStaffMember(
  ctx: QueryCtx | MutationCtx,
  explicitOrgId?: Id<"organizations">
) {
  const identity = await requireAuth(ctx);
  const org = await resolveStoreOrganization(ctx, explicitOrgId);
  const callerMember = await getCallerMembership(ctx, identity.subject, org._id);

  const isStaff =
    callerMember &&
    callerMember.deletedAt === undefined &&
    ["admin", "cashier", "captain", "waiter"].some((role) =>
      callerMember.userType.includes(role)
    );

  if (!isStaff) {
    throw new Error("Forbidden. Staff access required.");
  }

  return { identity, org, callerMember };
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Retrieves a customer record by ID.
 */
export const getCustomer = query({
  args: {
    id: v.id("customers"),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.id);
    if (!customer || customer.deletedAt !== undefined) {
      return null;
    }
    return customer;
  },
});

/**
 * Retrieves an active customer by phone number.
 * Supports flexible phone lookup (exact, trailing 10 digits, or 91 country code prefix).
 */
export const getCustomerByPhone = query({
  args: {
    phone: v.string(),
    countryCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalized = normalizePhone(args.phone);
    if (!normalized) return null;

    // 1. Direct match on phone index
    const directMatches = await ctx.db
      .query("customers")
      .withIndex("by_phone", (q) => q.eq("phone", normalized))
      .collect();

    const activeDirect = directMatches.find((c) => c.deletedAt === undefined);
    if (activeDirect) return activeDirect;

    // 2. Trailing 10-digit match if input has country code prefix (e.g. 919870011223 -> 9870011223)
    if (normalized.length === 12 && normalized.startsWith("91")) {
      const tenDigit = normalized.slice(2);
      const matches = await ctx.db
        .query("customers")
        .withIndex("by_phone", (q) => q.eq("phone", tenDigit))
        .collect();
      const active = matches.find((c) => c.deletedAt === undefined);
      if (active) return active;
    }

    // 3. 91-prefixed match if input is 10 digits (e.g. 9870011223 -> 919870011223)
    if (normalized.length === 10) {
      const twelveDigit = `91${normalized}`;
      const matches = await ctx.db
        .query("customers")
        .withIndex("by_phone", (q) => q.eq("phone", twelveDigit))
        .collect();
      const active = matches.find((c) => c.deletedAt === undefined);
      if (active) return active;
    }

    return null;
  },
});

/**
 * Retrieves an active customer by legacy Rails ID.
 */
export const getCustomerByLegacyId = query({
  args: {
    legacyId: v.string(),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("by_legacy_id", (q) => q.eq("legacyId", args.legacyId))
      .first();

    if (!customer || customer.deletedAt !== undefined) {
      return null;
    }
    return customer;
  },
});

/**
 * Staff Query: Searches customers by name prefix, phone, or email.
 */
export const searchCustomers = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireStaffMember(ctx);

    const searchTerm = args.query.trim().toLowerCase();
    if (!searchTerm) {
      return [];
    }

    const maxResults = Math.min(args.limit ?? 20, 50);
    const normalizedDigits = normalizePhone(searchTerm);

    // 1. Direct phone index match if digits provided
    if (normalizedDigits && normalizedDigits.length >= 3) {
      const phoneMatches = await ctx.db
        .query("customers")
        .withIndex("by_phone", (q) => q.eq("phone", normalizedDigits))
        .collect();

      const activePhoneMatches = phoneMatches.filter((c) => c.deletedAt === undefined);
      if (activePhoneMatches.length > 0) {
        return activePhoneMatches.slice(0, maxResults);
      }
    }

    // 2. Scan active customers for substring matches on name, phone, or email
    const allCustomers = await ctx.db.query("customers").collect();
    const matches = allCustomers.filter((c) => {
      if (c.deletedAt !== undefined) return false;

      const fullName = `${c.firstName || ""} ${c.lastName || ""}`.trim().toLowerCase();
      const email = (c.email || "").toLowerCase();
      const phone = c.phone;

      return (
        fullName.includes(searchTerm) ||
        email.includes(searchTerm) ||
        phone.includes(searchTerm) ||
        (c.legacyId && c.legacyId.toLowerCase().includes(searchTerm))
      );
    });

    return matches.slice(0, maxResults);
  },
});

/**
 * Staff Query: Retrieves order history for a specific customer.
 */
export const getCustomerOrders = query({
  args: {
    customerId: v.id("customers"),
  },
  handler: async (ctx, args) => {
    await requireStaffMember(ctx);

    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.deletedAt !== undefined) {
      throw new Error("Customer not found.");
    }

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .collect();

    return orders.sort((a, b) => b.createdAt - a.createdAt || b._creationTime - a._creationTime);
  },
});

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * Creates a new customer record.
 * Enforces phone presence, format, and uniqueness among active customers.
 */
export const createCustomer = mutation({
  args: {
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.string(),
    countryCode: v.optional(v.string()),
    email: v.optional(v.string()),
    razorpayCustomerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedPhone = normalizePhone(args.phone);
    validatePhone(normalizedPhone, args.countryCode);
    validateEmail(args.email);

    // Check uniqueness among non-deleted customers
    const existing = await ctx.db
      .query("customers")
      .withIndex("by_phone", (q) => q.eq("phone", normalizedPhone))
      .collect();

    const activeExisting = existing.find((c) => c.deletedAt === undefined);
    if (activeExisting) {
      throw new Error(`Customer with phone number ${normalizedPhone} already exists.`);
    }

    const now = Date.now();
    const customerId = await ctx.db.insert("customers", {
      firstName: args.firstName?.trim(),
      lastName: args.lastName?.trim(),
      phone: normalizedPhone,
      countryCode: args.countryCode?.trim() || "+91",
      email: args.email?.trim().toLowerCase(),
      razorpayCustomerId: args.razorpayCustomerId?.trim(),
      createdAt: now,
      updatedAt: now,
    });

    return customerId;
  },
});

/**
 * Idempotent lookup or creation helper for POS Cashier and Online order placements.
 * If customer with phone exists, updates missing name/email and returns existing customer.
 */
export const getOrCreateCustomer = mutation({
  args: {
    phone: v.string(),
    countryCode: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedPhone = normalizePhone(args.phone);
    validatePhone(normalizedPhone, args.countryCode);
    validateEmail(args.email);

    const existing = await ctx.db
      .query("customers")
      .withIndex("by_phone", (q) => q.eq("phone", normalizedPhone))
      .collect();

    const activeCustomer = existing.find((c) => c.deletedAt === undefined);
    const now = Date.now();

    if (activeCustomer) {
      const updates: Record<string, any> = {};
      if (args.firstName && args.firstName.trim() !== activeCustomer.firstName) {
        updates.firstName = args.firstName.trim();
      }
      if (args.lastName && args.lastName.trim() !== activeCustomer.lastName) {
        updates.lastName = args.lastName.trim();
      }
      if (args.email && args.email.trim().toLowerCase() !== activeCustomer.email) {
        updates.email = args.email.trim().toLowerCase();
      }
      if (args.countryCode && args.countryCode.trim() !== activeCustomer.countryCode) {
        updates.countryCode = args.countryCode.trim();
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = now;
        await ctx.db.patch(activeCustomer._id, updates);
      }

      return { customerId: activeCustomer._id, created: false };
    }

    const newCustomerId = await ctx.db.insert("customers", {
      firstName: args.firstName?.trim(),
      lastName: args.lastName?.trim(),
      phone: normalizedPhone,
      countryCode: args.countryCode?.trim() || "+91",
      email: args.email?.trim().toLowerCase(),
      createdAt: now,
      updatedAt: now,
    });

    return { customerId: newCustomerId, created: true };
  },
});

/**
 * Updates an existing customer profile.
 */
export const updateCustomer = mutation({
  args: {
    id: v.id("customers"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    email: v.optional(v.string()),
    razorpayCustomerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.id);
    if (!customer || customer.deletedAt !== undefined) {
      throw new Error("Customer not found.");
    }

    const updates: Record<string, any> = {};

    if (args.phone !== undefined) {
      const normalizedPhone = normalizePhone(args.phone);
      validatePhone(normalizedPhone, args.countryCode ?? customer.countryCode);

      if (normalizedPhone !== customer.phone) {
        // Verify no collision with another active customer
        const collisions = await ctx.db
          .query("customers")
          .withIndex("by_phone", (q) => q.eq("phone", normalizedPhone))
          .collect();

        const activeCollision = collisions.find(
          (c) => c._id !== customer._id && c.deletedAt === undefined
        );
        if (activeCollision) {
          throw new Error(`Phone number ${normalizedPhone} is already in use by another customer.`);
        }
        updates.phone = normalizedPhone;
      }
    }

    if (args.email !== undefined) {
      validateEmail(args.email);
      updates.email = args.email ? args.email.trim().toLowerCase() : undefined;
    }

    if (args.firstName !== undefined) {
      updates.firstName = args.firstName.trim();
    }
    if (args.lastName !== undefined) {
      updates.lastName = args.lastName.trim();
    }
    if (args.countryCode !== undefined) {
      updates.countryCode = args.countryCode.trim();
    }
    if (args.razorpayCustomerId !== undefined) {
      updates.razorpayCustomerId = args.razorpayCustomerId.trim();
    }

    updates.updatedAt = Date.now();
    await ctx.db.patch(customer._id, updates);

    return { success: true };
  },
});

/**
 * Soft deletes a customer record.
 */
export const deleteCustomer = mutation({
  args: {
    id: v.id("customers"),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.id);
    if (!customer || customer.deletedAt !== undefined) {
      throw new Error("Customer not found.");
    }

    const now = Date.now();
    await ctx.db.patch(customer._id, {
      deletedAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Migration Mutation: Ingests a legacy Rails `users` record where role is customer.
 * Supports idempotent re-runs, legacy ID tracking, and timestamp preservation.
 */
export const migrateLegacyCustomer = mutation({
  args: {
    legacyId: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.string(),
    countryCode: v.optional(v.string()),
    email: v.optional(v.string()),
    razorpayCustomerId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // 1. Idempotency Check by legacyId
    const existing = await ctx.db
      .query("customers")
      .withIndex("by_legacy_id", (q) => q.eq("legacyId", args.legacyId))
      .first();

    if (existing) {
      return { customerId: existing._id, alreadyMigrated: true };
    }

    const normalizedPhone = normalizePhone(args.phone);

    const customerId = await ctx.db.insert("customers", {
      legacyId: args.legacyId,
      firstName: args.firstName?.trim(),
      lastName: args.lastName?.trim(),
      phone: normalizedPhone || args.phone,
      countryCode: args.countryCode?.trim() || "+91",
      email: args.email?.trim().toLowerCase(),
      razorpayCustomerId: args.razorpayCustomerId?.trim(),
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
      deletedAt: args.deletedAt,
    });

    return { customerId, alreadyMigrated: false };
  },
});

// ----------------------------------------------------
// CUSTOMER PHONE OTP & CLERK IDENTITY VERIFICATION
// ----------------------------------------------------

/**
 * Normalizes a phone string to E.164 format.
 */
export function normalizeToE164(rawPhone: string, defaultCountryCode: string = "+91"): string {
  if (!rawPhone) return "";
  const trimmed = rawPhone.trim();

  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return `+${digits}`;
  }

  const digits = trimmed.replace(/\D/g, "");
  const cleanCode = defaultCountryCode.replace(/\D/g, "") || "91";

  const cleanDigits = digits.startsWith("0") ? digits.slice(1) : digits;

  if (cleanDigits.length > 10 && cleanDigits.startsWith(cleanCode)) {
    return `+${cleanDigits}`;
  }

  return `+${cleanCode}${cleanDigits}`;
}

/**
 * Cryptographically secure 4-digit OTP generation using Web Crypto.
 * Preserves leading zeros as a string (e.g. 15 -> "0015").
 */
export function generateSecureOtp(length: number = 4): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const max = Math.pow(10, length);
  const otpNumber = array[0] % max;
  return otpNumber.toString().padStart(length, "0");
}

/**
 * Computes secure SHA-256 hash of normalized phone, OTP, and secret salt.
 */
export async function hashOtp(
  phone: string,
  otp: string,
  salt: string = process.env.OTP_SECRET || "prest_customer_otp_secret_salt_v1"
): Promise<string> {
  const normalized = normalizeToE164(phone);
  const data = new TextEncoder().encode(`${normalized}:${otp}:${salt}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Helper to find customer across E.164 and local phone representations.
 */
export async function findCustomerByPhoneHelper(
  ctx: QueryCtx | MutationCtx,
  rawPhone: string,
  countryCode?: string
): Promise<Doc<"customers"> | null> {
  const e164 = normalizeToE164(rawPhone, countryCode || "+91");
  const digits = normalizePhone(rawPhone);
  if (!digits) return null;

  // 1. Direct match on E.164 format (e.g. "+919876543210")
  const e164Matches = await ctx.db
    .query("customers")
    .withIndex("by_phone", (q) => q.eq("phone", e164))
    .collect();
  const activeE164 = e164Matches.find((c) => c.deletedAt === undefined);
  if (activeE164) return activeE164;

  // 2. Direct match on digits (e.g. "9876543210" or "919876543210")
  const digitMatches = await ctx.db
    .query("customers")
    .withIndex("by_phone", (q) => q.eq("phone", digits))
    .collect();
  const activeDigits = digitMatches.find((c) => c.deletedAt === undefined);
  if (activeDigits) return activeDigits;

  // 3. Trailing 10 digits match if input has country code
  if (digits.length === 12 && digits.startsWith("91")) {
    const tenDigit = digits.slice(2);
    const tenMatches = await ctx.db
      .query("customers")
      .withIndex("by_phone", (q) => q.eq("phone", tenDigit))
      .collect();
    const activeTen = tenMatches.find((c) => c.deletedAt === undefined);
    if (activeTen) return activeTen;
  }

  // 4. 91-prefixed match if input is 10 digits
  if (digits.length === 10) {
    const twelveDigit = `91${digits}`;
    const twelveMatches = await ctx.db
      .query("customers")
      .withIndex("by_phone", (q) => q.eq("phone", twelveDigit))
      .collect();
    const activeTwelve = twelveMatches.find((c) => c.deletedAt === undefined);
    if (activeTwelve) return activeTwelve;
  }

  return null;
}

/**
 * Retrieves the current authenticated customer record linked to the Clerk session.
 */
export const getCurrentCustomer = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        customer: null,
        isPhoneVerified: false,
        isAuthenticated: false,
      };
    }

    const clerkUserId = identity.subject;
    const userEmail = identity.email?.toLowerCase().trim();

    // 1. Look up by clerkUserId index
    const linked = await ctx.db
      .query("customers")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .first();

    if (linked) {
      const addresses = await ctx.db
        .query("userAddresses")
        .withIndex("by_customer", (q) => q.eq("customerId", linked._id))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      return {
        customer: linked,
        customerId: linked._id,
        isPhoneVerified: Boolean(linked.isPhoneVerified),
        phone: linked.phone,
        countryCode: linked.countryCode,
        email: linked.email,
        name: [linked.firstName, linked.lastName].filter(Boolean).join(" ") || identity.name,
        addressesCount: addresses.length,
        isAuthenticated: true,
      };
    }

    // 2. Fallback check by email
    if (userEmail) {
      const emailMatches = await ctx.db
        .query("customers")
        .withIndex("by_email", (q) => q.eq("email", userEmail))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      const activeEmailCustomer = emailMatches[0];
      if (activeEmailCustomer && activeEmailCustomer.isPhoneVerified) {
        return {
          customer: activeEmailCustomer,
          customerId: activeEmailCustomer._id,
          isPhoneVerified: Boolean(activeEmailCustomer.isPhoneVerified),
          phone: activeEmailCustomer.phone,
          countryCode: activeEmailCustomer.countryCode,
          email: activeEmailCustomer.email,
          name: [activeEmailCustomer.firstName, activeEmailCustomer.lastName].filter(Boolean).join(" ") || identity.name,
          addressesCount: 0,
          isAuthenticated: true,
        };
      }
    }

    return {
      customer: null,
      isPhoneVerified: false,
      isAuthenticated: true,
      email: userEmail,
      name: identity.name,
    };
  },
});

/**
 * Sends a cryptographically secure OTP to customer phone.
 */
/**
 * Internal mutation to prepare OTP record, perform rate-limiting, and generate secure OTP.
 */
export const prepareCustomerPhoneOtp = internalMutation({
  args: {
    phone: v.string(),
    countryCode: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
    clerkUserId: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    verificationId: Id<"customerPhoneVerifications">;
    normalizedPhone: string;
    otp: string;
    storeName: string;
    cooldownSeconds: number;
    resendAvailableAt: number;
    expiresAt: number;
  }> => {
    const clerkUserId = args.clerkUserId;
    const defaultCode = args.countryCode?.trim() || "+91";
    const normalizedPhone = normalizeToE164(args.phone, defaultCode);
    validatePhone(normalizedPhone, defaultCode);

    const now = Date.now();
    const COOLDOWN_MS = 60 * 1000;
    const EXPIRY_MS = 2 * 60 * 1000; // 2 minutes (120 seconds) - matches approved DLT template
    const HOURLY_WINDOW_MS = 60 * 60 * 1000;
    const MAX_HOURLY_REQUESTS = 5;

    // Rate Limiting: Check resend cooldown
    const recentUserVerifications = await ctx.db
      .query("customerPhoneVerifications")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", clerkUserId))
      .order("desc")
      .take(10);

    const activeCooldown = recentUserVerifications.find(
      (v) => v.phone === normalizedPhone && v.resendAvailableAt > now && !v.verifiedAt
    );

    if (activeCooldown) {
      const waitSeconds = Math.ceil((activeCooldown.resendAvailableAt - now) / 1000);
      throw new Error(`Please wait ${waitSeconds} seconds before requesting a new code.`);
    }

    // Rate Limiting: Check hourly requests
    const oneHourAgo = now - HOURLY_WINDOW_MS;
    const hourlyRequests = recentUserVerifications.filter(
      (v) => v.phone === normalizedPhone && v.createdAt > oneHourAgo
    );

    if (hourlyRequests.length >= MAX_HOURLY_REQUESTS) {
      throw new Error("Too many OTP requests. Please try again after an hour.");
    }

    // Invalidate prior unverified verification
    for (const prior of recentUserVerifications) {
      if (prior.phone === normalizedPhone && !prior.verifiedAt) {
        await ctx.db.delete(prior._id);
      }
    }

    const otp = generateSecureOtp(4);
    const otpHash = await hashOtp(normalizedPhone, otp);

    let storeName = "Prest";
    if (args.organizationId) {
      const org = await ctx.db.get(args.organizationId);
      if (org?.name) storeName = org.name;
    }

    const resendAvailableAt = now + COOLDOWN_MS;
    const expiresAt = now + EXPIRY_MS;

    const verificationId = await ctx.db.insert("customerPhoneVerifications", {
      phone: normalizedPhone,
      countryCode: defaultCode,
      otpHash,
      expiresAt,
      attempts: 0,
      maxAttempts: 5,
      resendAvailableAt,
      clerkUserId,
      organizationId: args.organizationId,
      createdAt: now,
      updatedAt: now,
    });

    return {
      verificationId,
      normalizedPhone,
      otp,
      storeName,
      cooldownSeconds: 60,
      resendAvailableAt,
      expiresAt,
    };
  },
});

/**
 * Internal mutation to remove verification record if external SMS dispatch fails.
 */
export const removeFailedCustomerPhoneOtp = internalMutation({
  args: {
    verificationId: v.id("customerPhoneVerifications"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.verificationId);
  },
});

/**
 * Sends a cryptographically secure OTP to customer phone.
 * Runs as an action to allow external HTTP fetch() requests.
 */
export const sendCustomerPhoneOtp = action({
  args: {
    phone: v.string(),
    countryCode: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    verificationId: Id<"customerPhoneVerifications">;
    cooldownSeconds: number;
    resendAvailableAt: number;
    expiresAt: number;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required. Please sign in before verifying your mobile number.");
    }

    const prep: {
      verificationId: Id<"customerPhoneVerifications">;
      normalizedPhone: string;
      otp: string;
      storeName: string;
      cooldownSeconds: number;
      resendAvailableAt: number;
      expiresAt: number;
    } = await ctx.runMutation(internal.customers.prepareCustomerPhoneOtp, {
      phone: args.phone,
      countryCode: args.countryCode,
      organizationId: args.organizationId,
      clerkUserId: identity.subject,
    });

    const maskedPhone =
      prep.normalizedPhone.length > 5
        ? `${prep.normalizedPhone.slice(0, 3)}******${prep.normalizedPhone.slice(-4)}`
        : "******";

    console.log(
      `[sendCustomerPhoneOtp] Dispatched OTP to ${maskedPhone} (Store: ${prep.storeName}, VerificationId: ${prep.verificationId})`
    );

    // Send OTP via SMS Provider (HTTP fetch call allowed in Convex actions)
    const provider = getSmsProvider();
    const sendResult = await provider.sendOtp({
      to: prep.normalizedPhone,
      otp: prep.otp,
      storeName: prep.storeName,
    });

    if (!sendResult.success) {
      await ctx.runMutation(internal.customers.removeFailedCustomerPhoneOtp, {
        verificationId: prep.verificationId,
      });
      throw new Error(sendResult.error || "Failed to deliver OTP via SMS provider.");
    }

    return {
      success: true,
      verificationId: prep.verificationId,
      cooldownSeconds: prep.cooldownSeconds,
      resendAvailableAt: prep.resendAvailableAt,
      expiresAt: prep.expiresAt,
    };
  },
});

/**
 * Verifies customer OTP and links customer profile to authenticated Clerk session.
 */
export const verifyCustomerPhoneOtp = mutation({
  args: {
    phone: v.string(),
    countryCode: v.optional(v.string()),
    otp: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required. Please sign in to verify your mobile number.");
    }

    const clerkUserId = identity.subject;
    const userEmail = identity.email?.toLowerCase().trim();
    const defaultCode = args.countryCode?.trim() || "+91";
    const normalizedPhone = normalizeToE164(args.phone, defaultCode);
    const cleanOtp = args.otp.trim();

    if (!cleanOtp || (cleanOtp.length !== 4 && cleanOtp.length !== 6) || !/^\d+$/.test(cleanOtp)) {
      throw new Error("Please enter a valid 4-digit verification code.");
    }

    const now = Date.now();

    const verifications = await ctx.db
      .query("customerPhoneVerifications")
      .withIndex("by_phone_and_user", (q) =>
        q.eq("phone", normalizedPhone).eq("clerkUserId", clerkUserId)
      )
      .order("desc")
      .take(1);

    const verification = verifications[0];

    if (!verification) {
      throw new Error("No pending verification request found. Please request a new code.");
    }

    if (verification.verifiedAt !== undefined) {
      throw new Error("This verification code has already been used.");
    }

    if (now > verification.expiresAt) {
      throw new Error("Verification code has expired. Please request a new one.");
    }

    if (verification.attempts >= verification.maxAttempts) {
      throw new Error("Maximum verification attempts exceeded. Please request a new OTP.");
    }

    // 2. Validate OTP Hash
    const computedHash = await hashOtp(normalizedPhone, cleanOtp);
    const isValidOtp = computedHash === verification.otpHash;

    if (!isValidOtp) {
      const newAttempts = verification.attempts + 1;
      await ctx.db.patch(verification._id, {
        attempts: newAttempts,
        updatedAt: now,
      });

      const remaining = verification.maxAttempts - newAttempts;
      if (remaining <= 0) {
        throw new Error("Invalid code. Maximum attempts reached. Please request a new OTP.");
      }
      throw new Error(`Invalid verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`);
    }

    await ctx.db.patch(verification._id, {
      verifiedAt: now,
      updatedAt: now,
    });

    const existingCustomer = await findCustomerByPhoneHelper(ctx, normalizedPhone, defaultCode);

    let customerId: Id<"customers">;
    let isNewCustomer = false;

    if (existingCustomer) {
      if (
        existingCustomer.email &&
        userEmail &&
        existingCustomer.email.toLowerCase() !== userEmail
      ) {
        return {
          success: false,
          conflict: "EMAIL_MISMATCH",
          message: `This mobile number is already linked to another email account (${existingCustomer.email.replace(/(.{2})(.*)(@.*)/, "$1***$3")}). Please sign in with that email address.`,
          customerId: null,
          isPhoneVerified: false,
        };
      }

      const updates: Record<string, any> = {
        clerkUserId,
        isPhoneVerified: true,
        phoneVerifiedAt: now,
        updatedAt: now,
      };

      if (!existingCustomer.email && userEmail) {
        updates.email = userEmail;
      }
      if (!existingCustomer.firstName && (args.firstName || identity.name)) {
        updates.firstName = (args.firstName || identity.name || "").trim();
      }
      if (args.lastName && !existingCustomer.lastName) {
        updates.lastName = args.lastName.trim();
      }
      if (!existingCustomer.countryCode && defaultCode) {
        updates.countryCode = defaultCode;
      }

      await ctx.db.patch(existingCustomer._id, updates);
      customerId = existingCustomer._id;
    } else {
      isNewCustomer = true;
      customerId = await ctx.db.insert("customers", {
        firstName: (args.firstName || identity.name || "").trim() || undefined,
        lastName: args.lastName?.trim() || undefined,
        phone: normalizedPhone,
        countryCode: defaultCode,
        email: userEmail,
        clerkUserId,
        isPhoneVerified: true,
        phoneVerifiedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    const addresses = await ctx.db
      .query("userAddresses")
      .withIndex("by_customer", (q) => q.eq("customerId", customerId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    return {
      success: true,
      customerId,
      created: isNewCustomer,
      phone: normalizedPhone,
      countryCode: defaultCode,
      isPhoneVerified: true,
      addressesCount: addresses.length,
      message: isNewCustomer ? "Welcome to Prest!" : "Welcome back!",
    };
  },
});

/**
 * Updates customer profile details for the authenticated user.
 */
export const updateCustomerProfile = mutation({
  args: {
    customerId: v.id("customers"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required.");
    }

    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.deletedAt !== undefined) {
      throw new Error("Customer record not found.");
    }

    if (customer.clerkUserId && customer.clerkUserId !== identity.subject) {
      throw new Error("Forbidden. You cannot update another customer's profile.");
    }

    const updates: Record<string, any> = { updatedAt: Date.now() };
    if (args.firstName !== undefined) updates.firstName = args.firstName.trim();
    if (args.lastName !== undefined) updates.lastName = args.lastName.trim();

    await ctx.db.patch(args.customerId, updates);
    return { success: true };
  },
});

