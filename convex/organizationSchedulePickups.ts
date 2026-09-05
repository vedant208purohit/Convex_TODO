import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Infer, v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAuth, resolveStoreOrganization, getCallerMembership, requireMember } from "./organizationUsers";
import { weeklyScheduleValidator } from "./schema";

// ----------------------------------------------------
// AUTHORIZATION HELPERS
// ----------------------------------------------------

/**
 * Requires caller to be an active Store Admin or Cashier in the store database.
 */
export async function requireAdminOrCashier(
  ctx: QueryCtx | MutationCtx,
  explicitOrgId?: Id<"organizations">
) {
  const identity = await requireAuth(ctx);
  const org = await resolveStoreOrganization(ctx, explicitOrgId);
  const callerMember = await getCallerMembership(ctx, identity.subject, org._id);

  if (
    !callerMember ||
    (!callerMember.userType.includes("admin") &&
      !callerMember.userType.includes("cashier"))
  ) {
    throw new Error("Forbidden. Admin or Cashier access required.");
  }

  return { identity, org, callerMember };
}

// ----------------------------------------------------
// DEFAULT SCHEDULE GENERATOR & INITIALIZATION HELPERS
// ----------------------------------------------------

/**
 * Generates default weekly operating schedule for Monday through Sunday (11:00 AM to 11:59 PM).
 */
export function generateDefaultWeeklySchedule(): Infer<typeof weeklyScheduleValidator> {
  const defaultDay = {
    is_open: true,
    hours: [
      {
        start_time: "Mon May 08 2023 11:00:00 GMT+0530",
        end_time: "Mon May 08 2023 23:59:00 GMT+0530",
      },
    ],
  };

  return {
    Monday: defaultDay,
    Tuesday: defaultDay,
    Wednesday: defaultDay,
    Thursday: defaultDay,
    Friday: defaultDay,
    Saturday: defaultDay,
    Sunday: defaultDay,
  };
}

/**
 * Ensures an active schedule pickup configuration document exists in mutation context.
 */
export async function ensureActiveConfig(ctx: MutationCtx): Promise<Doc<"organizationSchedulePickups">> {
  const all = await ctx.db.query("organizationSchedulePickups").collect();
  const active = all.find((c) => c.deletedAt === undefined);

  if (active) {
    return active;
  }

  const now = Date.now();
  const defaultPickupTimings = generateDefaultWeeklySchedule();
  const defaultDeliveryTimings = generateDefaultWeeklySchedule();

  const docId = await ctx.db.insert("organizationSchedulePickups", {
    advanceOrderTimeLimit: "12",
    advancePickupLimit: 1,
    advancePickupLimitType: "months",
    pickupTimings: defaultPickupTimings,
    pickupTimeSlotSize: "15",

    advanceScheduleDeliveryOrderTimeLimit: "12",
    advanceDeliveryLimit: 1,
    advanceDeliveryLimitType: "months",
    deliveryTimings: defaultDeliveryTimings,
    deliveryTimeSlotSize: "15",

    createdAt: now,
    updatedAt: now,
  });

  return (await ctx.db.get(docId))!;
}

/**
 * Formats document into safe response representation.
 */
export function toConfigResponse(doc: Doc<"organizationSchedulePickups">) {
  return {
    _id: doc._id,
    legacyId: doc.legacyId,
    advanceOrderTimeLimit: doc.advanceOrderTimeLimit ?? "12",
    advancePickupLimit: doc.advancePickupLimit ?? 1,
    advancePickupLimitType: doc.advancePickupLimitType ?? "months",
    pickupTimings: doc.pickupTimings ?? generateDefaultWeeklySchedule(),
    pickupTimeSlotSize: doc.pickupTimeSlotSize ?? "15",

    pickupAddressLine1: doc.pickupAddressLine1,
    pickupAddressLine2: doc.pickupAddressLine2,
    city: doc.city,
    state: doc.state,
    country: doc.country,
    zipcode: doc.zipcode,

    advanceScheduleDeliveryOrderTimeLimit: doc.advanceScheduleDeliveryOrderTimeLimit ?? "12",
    advanceDeliveryLimit: doc.advanceDeliveryLimit ?? 1,
    advanceDeliveryLimitType: doc.advanceDeliveryLimitType ?? "months",
    deliveryTimings: doc.deliveryTimings ?? generateDefaultWeeklySchedule(),
    deliveryTimeSlotSize: doc.deliveryTimeSlotSize ?? "15",

    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Formats doc into clean, safe public response for customer storefront checkout.
 */
export function toPublicConfigResponse(doc: Doc<"organizationSchedulePickups">) {
  return {
    _id: doc._id,
    advanceOrderTimeLimit: doc.advanceOrderTimeLimit ?? "12",
    advancePickupLimit: doc.advancePickupLimit ?? 1,
    advancePickupLimitType: doc.advancePickupLimitType ?? "months",
    pickupTimings: doc.pickupTimings ?? generateDefaultWeeklySchedule(),
    pickupTimeSlotSize: doc.pickupTimeSlotSize ?? "15",

    advanceScheduleDeliveryOrderTimeLimit: doc.advanceScheduleDeliveryOrderTimeLimit ?? "12",
    advanceDeliveryLimit: doc.advanceDeliveryLimit ?? 1,
    advanceDeliveryLimitType: doc.advanceDeliveryLimitType ?? "months",
    deliveryTimings: doc.deliveryTimings ?? generateDefaultWeeklySchedule(),
    deliveryTimeSlotSize: doc.deliveryTimeSlotSize ?? "15",
  };
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Authenticated query fetching store schedule pickup configuration.
 * Returns active config or default timing structure if uninitialized.
 */
export const get = query({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);

    const all = await ctx.db.query("organizationSchedulePickups").collect();
    const active = all.find((c) => c.deletedAt === undefined);

    if (active) {
      return toConfigResponse(active);
    }

    // Default uninitialized fallback structure
    return {
      _id: undefined,
      legacyId: undefined,
      advanceOrderTimeLimit: "12",
      advancePickupLimit: 1,
      advancePickupLimitType: "months",
      pickupTimings: generateDefaultWeeklySchedule(),
      pickupTimeSlotSize: "15",

      pickupAddressLine1: undefined,
      pickupAddressLine2: undefined,
      city: undefined,
      state: undefined,
      country: undefined,
      zipcode: undefined,

      advanceScheduleDeliveryOrderTimeLimit: "12",
      advanceDeliveryLimit: 1,
      advanceDeliveryLimitType: "months",
      deliveryTimings: generateDefaultWeeklySchedule(),
      deliveryTimeSlotSize: "15",

      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  },
});

/**
 * Public unauthenticated query (V3) fetching active schedule pickup configuration for storefront checkout.
 */
export const getPublic = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("organizationSchedulePickups").collect();

    // If soft-deleted docs exist and no active doc exists, return null (revoked/disabled)
    const active = all.find((c) => c.deletedAt === undefined);

    if (all.length > 0 && !active) {
      return null;
    }

    if (active) {
      return toPublicConfigResponse(active);
    }

    // Default active public fallback if uninitialized
    return {
      _id: undefined,
      advanceOrderTimeLimit: "12",
      advancePickupLimit: 1,
      advancePickupLimitType: "months",
      pickupTimings: generateDefaultWeeklySchedule(),
      pickupTimeSlotSize: "15",

      advanceScheduleDeliveryOrderTimeLimit: "12",
      advanceDeliveryLimit: 1,
      advanceDeliveryLimitType: "months",
      deliveryTimings: generateDefaultWeeklySchedule(),
      deliveryTimeSlotSize: "15",
    };
  },
});

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * Explicit mutation initializing active schedule pickup configuration.
 */
export const initialize = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCashier(ctx);
    const active = await ensureActiveConfig(ctx);
    return toConfigResponse(active);
  },
});

/**
 * Updates schedule pickup & delivery configuration parameters, timings, and address details.
 */
export const update = mutation({
  args: {
    id: v.optional(v.id("organizationSchedulePickups")),
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
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    let config = await ensureActiveConfig(ctx);

    if (args.id !== undefined && args.id !== config._id) {
      const specified = await ctx.db.get(args.id);
      if (!specified || specified.deletedAt !== undefined) {
        throw new Error("Organization schedule pickup configuration not found.");
      }
      config = specified;
    }

    const now = Date.now();

    await ctx.db.patch(config._id, {
      advanceOrderTimeLimit:
        args.advanceOrderTimeLimit !== undefined
          ? args.advanceOrderTimeLimit
          : config.advanceOrderTimeLimit,
      advancePickupLimit:
        args.advancePickupLimit !== undefined
          ? args.advancePickupLimit
          : config.advancePickupLimit,
      advancePickupLimitType:
        args.advancePickupLimitType !== undefined
          ? args.advancePickupLimitType
          : config.advancePickupLimitType,
      pickupTimings:
        args.pickupTimings !== undefined ? args.pickupTimings : config.pickupTimings,
      pickupTimeSlotSize:
        args.pickupTimeSlotSize !== undefined
          ? args.pickupTimeSlotSize
          : config.pickupTimeSlotSize,

      pickupAddressLine1:
        args.pickupAddressLine1 !== undefined
          ? args.pickupAddressLine1
          : config.pickupAddressLine1,
      pickupAddressLine2:
        args.pickupAddressLine2 !== undefined
          ? args.pickupAddressLine2
          : config.pickupAddressLine2,
      city: args.city !== undefined ? args.city : config.city,
      state: args.state !== undefined ? args.state : config.state,
      country: args.country !== undefined ? args.country : config.country,
      zipcode: args.zipcode !== undefined ? args.zipcode : config.zipcode,

      advanceScheduleDeliveryOrderTimeLimit:
        args.advanceScheduleDeliveryOrderTimeLimit !== undefined
          ? args.advanceScheduleDeliveryOrderTimeLimit
          : config.advanceScheduleDeliveryOrderTimeLimit,
      advanceDeliveryLimit:
        args.advanceDeliveryLimit !== undefined
          ? args.advanceDeliveryLimit
          : config.advanceDeliveryLimit,
      advanceDeliveryLimitType:
        args.advanceDeliveryLimitType !== undefined
          ? args.advanceDeliveryLimitType
          : config.advanceDeliveryLimitType,
      deliveryTimings:
        args.deliveryTimings !== undefined
          ? args.deliveryTimings
          : config.deliveryTimings,
      deliveryTimeSlotSize:
        args.deliveryTimeSlotSize !== undefined
          ? args.deliveryTimeSlotSize
          : config.deliveryTimeSlotSize,

      updatedAt: now,
    });

    const updated = (await ctx.db.get(config._id))!;
    return toConfigResponse(updated);
  },
});

/**
 * Soft deletes / revokes schedule pickup configuration and disables store feature flags.
 */
export const remove = mutation({
  args: { id: v.optional(v.id("organizationSchedulePickups")) },
  handler: async (ctx, args) => {
    const { org } = await requireAdminOrCashier(ctx);

    const config = await ensureActiveConfig(ctx);
    const targetId = args.id ?? config._id;
    const targetConfig = await ctx.db.get(targetId);
    if (!targetConfig || targetConfig.deletedAt !== undefined) {
      throw new Error("Organization schedule pickup configuration not found.");
    }

    const now = Date.now();

    // Soft delete configuration document
    await ctx.db.patch(targetConfig._id, {
      deletedAt: now,
      updatedAt: now,
    });

    // Synchronize feature flags: set scheduledPickup = false and scheduledDelivery = false
    await ctx.db.patch(org._id, {
      scheduledPickup: false,
      scheduledDelivery: false,
      updatedAt: now,
    });

    return { success: true };
  },
});
