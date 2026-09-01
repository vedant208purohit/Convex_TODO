import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { weeklyScheduleValidator } from "./schema";
import {
  requireAuth,
  resolveStoreOrganization,
  getCallerMembership,
  requireMember,
} from "./organizationUsers";

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
// DEFAULT SCHEDULE CONSTANTS & TIME VALIDATOR HELPERS
// ----------------------------------------------------

const DEFAULT_TIME_SLOT = [
  {
    start_time: "Mon May 08 2023 11:00:00 GMT+0530",
    end_time: "Mon May 08 2023 23:59:00 GMT+0530",
  },
];

export const DEFAULT_WEEKLY_SCHEDULE = {
  Monday: { is_open: true, hours: DEFAULT_TIME_SLOT },
  Tuesday: { is_open: true, hours: DEFAULT_TIME_SLOT },
  Wednesday: { is_open: true, hours: DEFAULT_TIME_SLOT },
  Thursday: { is_open: true, hours: DEFAULT_TIME_SLOT },
  Friday: { is_open: true, hours: DEFAULT_TIME_SLOT },
  Saturday: { is_open: true, hours: DEFAULT_TIME_SLOT },
  Sunday: { is_open: true, hours: DEFAULT_TIME_SLOT },
};

function parseTimeToMs(timeStr: string): number {
  const parsed = Date.parse(timeStr);
  if (!isNaN(parsed)) {
    return parsed;
  }
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  }
  throw new Error("invalid time format detected");
}

/**
 * Validates that an operating schedule does not contain overlapping time intervals within any day.
 */
export function validateNoOverlappingHours(schedule: any, scheduleName: string): void {
  if (!schedule) return;

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  for (const day of days) {
    const dayData = schedule[day];
    if (!dayData || !Array.isArray(dayData.hours) || dayData.hours.length <= 1) {
      continue;
    }

    try {
      const intervals = dayData.hours.map((h: any) => ({
        startTime: parseTimeToMs(h.start_time),
        endTime: parseTimeToMs(h.end_time),
      }));

      intervals.sort((a: any, b: any) => a.startTime - b.startTime);

      for (let i = 0; i < intervals.length - 1; i++) {
        const current = intervals[i];
        const next = intervals[i + 1];
        if (next.startTime < current.endTime) {
          throw new Error(`overlapping time ranges found for ${day}`);
        }
      }
    } catch (err: any) {
      if (err.message.includes("overlapping") || err.message.includes("invalid time format")) {
        throw err;
      }
      throw new Error(`invalid time format detected`);
    }
  }
}

// ----------------------------------------------------
// SINGLETON HELPER
// ----------------------------------------------------

/**
 * Retrieves the store's single active configuration or initializes a new default configuration atomically.
 */
export async function getOrInitializeActiveConfig(ctx: MutationCtx) {
  const allConfigs = await ctx.db.query("organizationQueueConfigurations").collect();
  const active = allConfigs.find((c) => c.deletedAt === undefined);

  if (active) {
    return active;
  }

  // Restore soft-deleted configuration if present or insert fresh
  const softDeleted = allConfigs.find((c) => c.deletedAt !== undefined);
  if (softDeleted) {
    const now = Date.now();
    await ctx.db.patch(softDeleted._id, {
      deletedAt: undefined,
      waitlistHours: softDeleted.waitlistHours ?? DEFAULT_WEEKLY_SCHEDULE,
      reservationHours: softDeleted.reservationHours ?? DEFAULT_WEEKLY_SCHEDULE,
      defaultPartySize: softDeleted.defaultPartySize ?? 0,
      customerViewWaitlist: softDeleted.customerViewWaitlist ?? false,
      onlineWaitlist: softDeleted.onlineWaitlist ?? false,
      onlineReservation: softDeleted.onlineReservation ?? false,
      bookingApproval: softDeleted.bookingApproval ?? false,
      geoFence: softDeleted.geoFence ?? false,
      updatedAt: now,
    });
    return (await ctx.db.get(softDeleted._id))!;
  }

  const now = Date.now();
  const configId = await ctx.db.insert("organizationQueueConfigurations", {
    waitlistHours: DEFAULT_WEEKLY_SCHEDULE,
    reservationHours: DEFAULT_WEEKLY_SCHEDULE,
    defaultPartySize: 0,
    customerViewWaitlist: false,
    onlineWaitlist: false,
    onlineReservation: false,
    bookingApproval: false,
    geoFence: false,
    createdAt: now,
    updatedAt: now,
  });

  return (await ctx.db.get(configId))!;
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Fetches the active store organization queue configuration.
 */
export const get = query({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);
    const all = await ctx.db.query("organizationQueueConfigurations").collect();
    const active = all.find((c) => c.deletedAt === undefined);
    if (!active) {
      return null;
    }
    return active;
  },
});

/**
 * Internal query/mutation helper to ensure configuration is initialized during store setup
 */
export const initialize = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCashier(ctx);
    return await getOrInitializeActiveConfig(ctx);
  },
});

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * Updates the store's organization queue configuration atomically.
 */
export const update = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const config = await getOrInitializeActiveConfig(ctx);

    // Validate non-overlapping time ranges for waitlist and reservation schedules
    if (args.waitlistHours !== undefined) {
      validateNoOverlappingHours(args.waitlistHours, "waitlistHours");
    }

    if (args.reservationHours !== undefined) {
      validateNoOverlappingHours(args.reservationHours, "reservationHours");
    }

    const now = Date.now();

    await ctx.db.patch(config._id, {
      waitlistHours:
        args.waitlistHours !== undefined ? args.waitlistHours : config.waitlistHours,
      reservationHours:
        args.reservationHours !== undefined
          ? args.reservationHours
          : config.reservationHours,
      defaultWaitTime:
        args.defaultWaitTime !== undefined
          ? args.defaultWaitTime.trim() || undefined
          : config.defaultWaitTime,
      defaultPartySize:
        args.defaultPartySize !== undefined
          ? args.defaultPartySize
          : config.defaultPartySize,
      customerViewWaitlist:
        args.customerViewWaitlist !== undefined
          ? args.customerViewWaitlist
          : config.customerViewWaitlist,
      onlineWaitlist:
        args.onlineWaitlist !== undefined
          ? args.onlineWaitlist
          : config.onlineWaitlist,
      onlineReservation:
        args.onlineReservation !== undefined
          ? args.onlineReservation
          : config.onlineReservation,
      bookingApproval:
        args.bookingApproval !== undefined
          ? args.bookingApproval
          : config.bookingApproval,
      geoFence: args.geoFence !== undefined ? args.geoFence : config.geoFence,
      geoFenceRadius:
        args.geoFenceRadius !== undefined
          ? args.geoFenceRadius.trim() || undefined
          : config.geoFenceRadius,
      geoFenceLatitude:
        args.geoFenceLatitude !== undefined
          ? args.geoFenceLatitude
          : config.geoFenceLatitude,
      geoFenceLongitude:
        args.geoFenceLongitude !== undefined
          ? args.geoFenceLongitude
          : config.geoFenceLongitude,
      maxBookingPerCustomer:
        args.maxBookingPerCustomer !== undefined
          ? args.maxBookingPerCustomer.trim() || undefined
          : config.maxBookingPerCustomer,
      maxBookingPerCustomerTime:
        args.maxBookingPerCustomerTime !== undefined
          ? args.maxBookingPerCustomerTime.trim() || undefined
          : config.maxBookingPerCustomerTime,
      reservationSlotSize:
        args.reservationSlotSize !== undefined
          ? args.reservationSlotSize.trim() || undefined
          : config.reservationSlotSize,
      reservationPerTimeSlot:
        args.reservationPerTimeSlot !== undefined
          ? args.reservationPerTimeSlot.trim() || undefined
          : config.reservationPerTimeSlot,
      queueTimeFormat:
        args.queueTimeFormat !== undefined
          ? args.queueTimeFormat.trim() || undefined
          : config.queueTimeFormat,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Copies the store's operating hours (operationTiming) to waitlistHours or reservationHours.
 */
export const copyStoreTiming = mutation({
  args: {
    target: v.union(v.literal("waitlist"), v.literal("reservation")),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const config = await getOrInitializeActiveConfig(ctx);

    const org = await ctx.db.query("organizations").first();
    const storeTiming = org?.operationTiming ?? DEFAULT_WEEKLY_SCHEDULE;

    validateNoOverlappingHours(storeTiming, args.target);

    const now = Date.now();

    if (args.target === "waitlist") {
      await ctx.db.patch(config._id, {
        waitlistHours: storeTiming,
        updatedAt: now,
      });
    } else if (args.target === "reservation") {
      await ctx.db.patch(config._id, {
        reservationHours: storeTiming,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Soft deletes the store's queue configuration.
 */
export const remove = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCashier(ctx);

    const all = await ctx.db.query("organizationQueueConfigurations").collect();
    const active = all.find((c) => c.deletedAt === undefined);

    if (!active) {
      throw new Error("Queue configuration not found");
    }

    const now = Date.now();

    await ctx.db.patch(active._id, {
      deletedAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});
