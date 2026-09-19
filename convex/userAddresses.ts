import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireStaffMember } from "./customers";

// ----------------------------------------------------
// NORMALIZATION & FORMATTING HELPERS
// ----------------------------------------------------

/**
 * Composes a full descriptive address from individual address fields if completeAddress is not explicitly given.
 */
export function buildFormattedAddress(params: {
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  zipCode: string;
}): string {
  const parts = [
    params.addressLine1.trim(),
    params.addressLine2?.trim(),
    params.landmark?.trim() ? `Near ${params.landmark.trim()}` : undefined,
    params.city.trim(),
    params.zipCode.trim(),
  ].filter(Boolean);

  return parts.join(", ");
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Retrieves a single user address by ID.
 */
export const getUserAddress = query({
  args: {
    id: v.id("userAddresses"),
  },
  handler: async (ctx, args) => {
    const address = await ctx.db.get(args.id);
    if (!address || address.deletedAt !== undefined) {
      return null;
    }
    return address;
  },
});

/**
 * Retrieves all active addresses for a specific customer.
 * Sorted with default address first, followed by most recently created addresses.
 */
export const getCustomerAddresses = query({
  args: {
    customerId: v.id("customers"),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.deletedAt !== undefined) {
      return [];
    }

    const addresses = await ctx.db
      .query("userAddresses")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .collect();

    const activeAddresses = addresses.filter((a) => a.deletedAt === undefined);

    return activeAddresses.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return b.createdAt - a.createdAt || b._creationTime - a._creationTime;
    });
  },
});

/**
 * Retrieves an active address by legacy Rails ID.
 */
export const getUserAddressByLegacyId = query({
  args: {
    legacyId: v.string(),
  },
  handler: async (ctx, args) => {
    const address = await ctx.db
      .query("userAddresses")
      .withIndex("by_legacy_id", (q) => q.eq("legacyId", args.legacyId))
      .first();

    if (!address || address.deletedAt !== undefined) {
      return null;
    }
    return address;
  },
});

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * Creates a new address for a customer.
 * Automatically manages isDefault flag to guarantee at most one default address per customer.
 */
export const createUserAddress = mutation({
  args: {
    customerId: v.id("customers"),
    addressLine1: v.string(),
    addressLine2: v.optional(v.string()),
    landmark: v.optional(v.string()),
    city: v.string(),
    zipCode: v.string(),
    otherLocationDetail: v.optional(v.string()),
    addressType: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    completeAddress: v.optional(v.string()),
    deliveryInstructions: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.deletedAt !== undefined) {
      throw new Error("Customer not found.");
    }

    if (!args.addressLine1.trim()) {
      throw new Error("Address line 1 is required.");
    }
    if (!args.city.trim()) {
      throw new Error("City is required.");
    }
    if (!args.zipCode.trim()) {
      throw new Error("Zip code is required.");
    }

    const now = Date.now();
    const existingAddresses = await ctx.db
      .query("userAddresses")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .collect();

    const activeExisting = existingAddresses.filter((a) => a.deletedAt === undefined);

    // If this is customer's first address, or if isDefault is explicitly true, make it default
    const shouldBeDefault = args.isDefault ?? activeExisting.length === 0;

    if (shouldBeDefault && activeExisting.length > 0) {
      // Unset default on previous addresses
      for (const addr of activeExisting) {
        if (addr.isDefault) {
          await ctx.db.patch(addr._id, { isDefault: false, updatedAt: now });
        }
      }
    }

    const formattedAddress =
      args.completeAddress?.trim() ||
      buildFormattedAddress({
        addressLine1: args.addressLine1,
        addressLine2: args.addressLine2,
        landmark: args.landmark,
        city: args.city,
        zipCode: args.zipCode,
      });

    const addressId = await ctx.db.insert("userAddresses", {
      customerId: args.customerId,
      addressLine1: args.addressLine1.trim(),
      addressLine2: args.addressLine2?.trim(),
      landmark: args.landmark?.trim(),
      city: args.city.trim(),
      zipCode: args.zipCode.trim(),
      otherLocationDetail: args.otherLocationDetail?.trim(),
      addressType: args.addressType?.trim() || "Home",
      latitude: args.latitude,
      longitude: args.longitude,
      completeAddress: formattedAddress,
      deliveryInstructions: args.deliveryInstructions?.trim(),
      isDefault: shouldBeDefault,
      createdAt: now,
      updatedAt: now,
    });

    return addressId;
  },
});

/**
 * Updates an existing customer address.
 */
export const updateUserAddress = mutation({
  args: {
    id: v.id("userAddresses"),
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    landmark: v.optional(v.string()),
    city: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    otherLocationDetail: v.optional(v.string()),
    addressType: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    completeAddress: v.optional(v.string()),
    deliveryInstructions: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const address = await ctx.db.get(args.id);
    if (!address || address.deletedAt !== undefined) {
      throw new Error("Address not found.");
    }

    const now = Date.now();
    const updates: Record<string, any> = { updatedAt: now };

    if (args.addressLine1 !== undefined) {
      if (!args.addressLine1.trim()) throw new Error("Address line 1 cannot be blank.");
      updates.addressLine1 = args.addressLine1.trim();
    }
    if (args.addressLine2 !== undefined) {
      updates.addressLine2 = args.addressLine2.trim();
    }
    if (args.landmark !== undefined) {
      updates.landmark = args.landmark.trim();
    }
    if (args.city !== undefined) {
      if (!args.city.trim()) throw new Error("City cannot be blank.");
      updates.city = args.city.trim();
    }
    if (args.zipCode !== undefined) {
      if (!args.zipCode.trim()) throw new Error("Zip code cannot be blank.");
      updates.zipCode = args.zipCode.trim();
    }
    if (args.otherLocationDetail !== undefined) {
      updates.otherLocationDetail = args.otherLocationDetail.trim();
    }
    if (args.addressType !== undefined) {
      updates.addressType = args.addressType.trim() || "Home";
    }
    if (args.latitude !== undefined) {
      updates.latitude = args.latitude;
    }
    if (args.longitude !== undefined) {
      updates.longitude = args.longitude;
    }
    if (args.deliveryInstructions !== undefined) {
      updates.deliveryInstructions = args.deliveryInstructions.trim();
    }

    // Rebuild completeAddress if address components changed and completeAddress was not provided
    if (args.completeAddress !== undefined) {
      updates.completeAddress = args.completeAddress.trim();
    } else if (
      args.addressLine1 !== undefined ||
      args.addressLine2 !== undefined ||
      args.landmark !== undefined ||
      args.city !== undefined ||
      args.zipCode !== undefined
    ) {
      updates.completeAddress = buildFormattedAddress({
        addressLine1: updates.addressLine1 ?? address.addressLine1,
        addressLine2: updates.addressLine2 ?? address.addressLine2,
        landmark: updates.landmark ?? address.landmark,
        city: updates.city ?? address.city,
        zipCode: updates.zipCode ?? address.zipCode,
      });
    }

    // Handle isDefault update
    if (args.isDefault === true && !address.isDefault) {
      const otherAddresses = await ctx.db
        .query("userAddresses")
        .withIndex("by_customer", (q) => q.eq("customerId", address.customerId))
        .collect();

      for (const other of otherAddresses) {
        if (other._id !== address._id && other.deletedAt === undefined && other.isDefault) {
          await ctx.db.patch(other._id, { isDefault: false, updatedAt: now });
        }
      }
      updates.isDefault = true;
    } else if (args.isDefault !== undefined) {
      updates.isDefault = args.isDefault;
    }

    await ctx.db.patch(address._id, updates);
    return { success: true };
  },
});

/**
 * Sets an address as the default for its customer.
 */
export const setDefaultUserAddress = mutation({
  args: {
    id: v.id("userAddresses"),
  },
  handler: async (ctx, args) => {
    const address = await ctx.db.get(args.id);
    if (!address || address.deletedAt !== undefined) {
      throw new Error("Address not found.");
    }

    const now = Date.now();
    const otherAddresses = await ctx.db
      .query("userAddresses")
      .withIndex("by_customer", (q) => q.eq("customerId", address.customerId))
      .collect();

    for (const other of otherAddresses) {
      if (other.deletedAt === undefined) {
        const isTarget = other._id === address._id;
        if (other.isDefault !== isTarget) {
          await ctx.db.patch(other._id, { isDefault: isTarget, updatedAt: now });
        }
      }
    }

    return { success: true };
  },
});

/**
 * Soft deletes an address.
 */
export const deleteUserAddress = mutation({
  args: {
    id: v.id("userAddresses"),
  },
  handler: async (ctx, args) => {
    const address = await ctx.db.get(args.id);
    if (!address || address.deletedAt !== undefined) {
      throw new Error("Address not found.");
    }

    const now = Date.now();
    await ctx.db.patch(address._id, {
      deletedAt: now,
      isDefault: false,
      updatedAt: now,
    });

    // If deleted address was default, promote the newest remaining active address to default
    if (address.isDefault) {
      const remaining = await ctx.db
        .query("userAddresses")
        .withIndex("by_customer", (q) => q.eq("customerId", address.customerId))
        .collect();

      const activeRemaining = remaining
        .filter((a) => a._id !== address._id && a.deletedAt === undefined)
        .sort((a, b) => b.createdAt - a.createdAt);

      if (activeRemaining.length > 0) {
        await ctx.db.patch(activeRemaining[0]._id, { isDefault: true, updatedAt: now });
      }
    }

    return { success: true };
  },
});

/**
 * Migration Mutation: Ingests a legacy Rails `user_addresses` record.
 * Validates customer relationship, enforces idempotency via legacyId, and preserves timestamps.
 */
export const migrateLegacyUserAddress = mutation({
  args: {
    legacyId: v.string(),
    customerId: v.id("customers"),
    addressLine1: v.string(),
    addressLine2: v.optional(v.string()),
    landmark: v.optional(v.string()),
    city: v.string(),
    zipCode: v.string(),
    otherLocationDetail: v.optional(v.string()),
    addressType: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    completeAddress: v.optional(v.string()),
    deliveryInstructions: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // 1. Verify parent customer exists
    const customer = await ctx.db.get(args.customerId);
    if (!customer) {
      throw new Error(
        `Migration Error: Parent customer ${args.customerId} not found for legacy address ${args.legacyId}.`
      );
    }

    // 2. Idempotency Check
    const existing = await ctx.db
      .query("userAddresses")
      .withIndex("by_legacy_id", (q) => q.eq("legacyId", args.legacyId))
      .first();

    if (existing) {
      return { addressId: existing._id, alreadyMigrated: true };
    }

    const formattedAddress =
      args.completeAddress?.trim() ||
      buildFormattedAddress({
        addressLine1: args.addressLine1,
        addressLine2: args.addressLine2,
        landmark: args.landmark,
        city: args.city,
        zipCode: args.zipCode,
      });

    const addressId = await ctx.db.insert("userAddresses", {
      legacyId: args.legacyId,
      customerId: args.customerId,
      addressLine1: args.addressLine1.trim(),
      addressLine2: args.addressLine2?.trim(),
      landmark: args.landmark?.trim(),
      city: args.city.trim(),
      zipCode: args.zipCode.trim(),
      otherLocationDetail: args.otherLocationDetail?.trim(),
      addressType: args.addressType?.trim() || "Home",
      latitude: args.latitude,
      longitude: args.longitude,
      completeAddress: formattedAddress,
      deliveryInstructions: args.deliveryInstructions?.trim(),
      isDefault: args.isDefault ?? false,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
      deletedAt: args.deletedAt,
    });

    return { addressId, alreadyMigrated: false };
  },
});
