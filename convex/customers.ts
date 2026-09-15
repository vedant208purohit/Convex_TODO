import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  requireAuth,
  resolveStoreOrganization,
  getCallerMembership,
} from "./organizationUsers";

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
