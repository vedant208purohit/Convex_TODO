import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAuth, resolveStoreOrganization, getCallerMembership, requireMember } from "./organizationUsers";

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
// TICKET NUMBER & STATUS HELPERS
// ----------------------------------------------------

/**
 * Helper to generate sequential daily ticket numbers e.g. "05-08-2026.QN001" or "05-08-2026.RN001"
 */
async function generateNextQueueNumber(
  ctx: MutationCtx,
  queueType: "waitlist" | "reservation" | "waitlist_off" | "reservation_off",
  reservationDate: string
): Promise<string | undefined> {
  if (queueType === "waitlist_off" || queueType === "reservation_off") {
    return undefined;
  }

  const prefix = queueType === "waitlist" ? "QN" : "RN";
  
  // Normalize reservationDate format for ticket string (DD-MM-YYYY)
  let datePart = reservationDate;
  if (reservationDate.includes("-") && reservationDate.split("-")[0].length === 4) {
    // YYYY-MM-DD to DD-MM-YYYY
    const [yyyy, mm, dd] = reservationDate.split("-");
    datePart = `${dd}-${mm}-${yyyy}`;
  } else if (reservationDate.includes("/")) {
    // DD/MM/YYYY to DD-MM-YYYY
    datePart = reservationDate.replace(/\//g, "-");
  }

  const patternPrefix = `${datePart}.${prefix}`;

  const existingEntries = await ctx.db
    .query("organizationQueues")
    .withIndex("by_reservation_date", (q) =>
      q.eq("reservationDate", reservationDate).eq("queueType", queueType)
    )
    .collect();

  let maxDigits = 0;

  for (const entry of existingEntries) {
    if (entry.queueNumber && entry.queueNumber.startsWith(patternPrefix)) {
      const digitsPart = entry.queueNumber.substring(patternPrefix.length);
      const parsed = parseInt(digitsPart, 10);
      if (!isNaN(parsed) && parsed > maxDigits) {
        maxDigits = parsed;
      }
    }
  }

  const nextDigits = String(maxDigits + 1).padStart(3, "0");
  return `${patternPrefix}${nextDigits}`;
}

/**
 * Log QueueActivity audit entry when queue status changes or upon creation.
 */
async function recordQueueActivity(
  ctx: MutationCtx,
  queueId: Id<"organizationQueues">,
  activityType: string,
  actorId?: string,
  reason?: string
) {
  const now = Date.now();
  await ctx.db.insert("queueActivities", {
    queueId,
    activityType,
    actorId,
    reason,
    createdAt: now,
  });
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Lists active organization queues with optional filters.
 */
export const list = query({
  args: {
    queueType: v.optional(
      v.union(
        v.literal("waitlist"),
        v.literal("reservation"),
        v.literal("waitlist_off"),
        v.literal("reservation_off")
      )
    ),
    queueStatus: v.optional(
      v.union(
        v.literal("booked"),
        v.literal("pending"),
        v.literal("arrived"),
        v.literal("running_late"),
        v.literal("completed"),
        v.literal("rejected"),
        v.literal("close"),
        v.literal("cancelled_by_user"),
        v.literal("cancelled_by_admin")
      )
    ),
    reservationDate: v.optional(v.string()),
    userId: v.optional(v.string()),
    queueNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    let items = await ctx.db.query("organizationQueues").collect();

    // Filter soft-deleted
    items = items.filter((i) => i.deletedAt === undefined);

    if (args.queueType !== undefined) {
      items = items.filter((i) => i.queueType === args.queueType);
    }

    if (args.queueStatus !== undefined) {
      if (args.queueStatus === "cancelled_by_admin" || args.queueStatus === "cancelled_by_user") {
        items = items.filter(
          (i) =>
            i.queueStatus === "cancelled_by_admin" ||
            i.queueStatus === "cancelled_by_user"
        );
      } else {
        items = items.filter((i) => i.queueStatus === args.queueStatus);
      }
    }

    if (args.reservationDate !== undefined) {
      items = items.filter((i) => i.reservationDate === args.reservationDate);
    }

    if (args.userId !== undefined) {
      items = items.filter((i) => i.userId === args.userId);
    }

    if (args.queueNumber !== undefined) {
      const searchTerm = args.queueNumber.toLowerCase();
      items = items.filter(
        (i) => i.queueNumber && i.queueNumber.toLowerCase().includes(searchTerm)
      );
    }

    // Populate associated layout & table details
    const populated = await Promise.all(
      items.map(async (item) => {
        const layout = item.layoutId
          ? ((await ctx.db.get(item.layoutId)) as any)
          : null;
        const table = item.tableId
          ? ((await (ctx.db as any).get(item.tableId)) as any)
          : null;
        return {
          ...item,
          layout,
          table,
        };
      })
    );

    return populated.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Fetches a single queue entry by ID along with activity logs.
 */
export const get = query({
  args: { id: v.id("organizationQueues") },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    const queue = await ctx.db.get(args.id);
    if (!queue || queue.deletedAt !== undefined) {
      return null;
    }

    const layout = queue.layoutId
      ? ((await ctx.db.get(queue.layoutId)) as any)
      : null;
    const table = queue.tableId
      ? ((await (ctx.db as any).get(queue.tableId)) as any)
      : null;

    const activities = await ctx.db
      .query("queueActivities")
      .withIndex("by_queue", (q) => q.eq("queueId", queue._id))
      .collect();

    return {
      ...queue,
      layout,
      table,
      activities: activities
        .filter((a) => a.deletedAt === undefined)
        .sort((a, b) => b.createdAt - a.createdAt),
    };
  },
});

/**
 * Returns available dining tables for advance table reservation.
 */
export const availableTablesForReservation = query({
  args: {
    queueType: v.literal("reservation"),
    reservationDate: v.string(), // YYYY-MM-DD
    reservationTime: v.number(), // UTC epoch ms
    seatingCapacity: v.number(),
    layoutId: v.optional(v.id("organizationLayouts")),
  },
  handler: async (ctx, args) => {
    const oneHourMs = 3600000;
    const startTime = args.reservationTime - oneHourMs;
    const endTime = args.reservationTime + oneHourMs;

    // Find conflicting reservations in window
    const existingQueues = await ctx.db
      .query("organizationQueues")
      .withIndex("by_reservation_date", (q) =>
        q.eq("reservationDate", args.reservationDate).eq("queueType", "reservation")
      )
      .collect();

    const activeConflictingTableIds = new Set<string>();

    for (const q of existingQueues) {
      if (
        q.deletedAt === undefined &&
        q.tableId &&
        q.reservationTime &&
        q.reservationTime >= startTime &&
        q.reservationTime <= endTime &&
        q.queueStatus !== "cancelled_by_user" &&
        q.queueStatus !== "cancelled_by_admin" &&
        q.queueStatus !== "rejected" &&
        q.queueStatus !== "completed"
      ) {
        activeConflictingTableIds.add(q.tableId);
      }
    }

    let allTables: Array<any> = await ctx.db.query("organizationTables" as any).collect();
    allTables = allTables.filter(
      (t: any) =>
        t.deletedAt === undefined &&
        t.seatingCapacity >= args.seatingCapacity &&
        !t.isBlock &&
        !activeConflictingTableIds.has(t._id)
    );

    if (args.layoutId !== undefined) {
      allTables = allTables.filter((t: any) => t.layoutId === args.layoutId);
    }

    return allTables;
  },
});

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * Creates a new Organization Queue or Reservation entry.
 */
export const create = mutation({
  args: {
    queueType: v.union(
      v.literal("waitlist"),
      v.literal("reservation"),
      v.literal("waitlist_off"),
      v.literal("reservation_off")
    ),
    totalGuests: v.optional(v.number()),
    kidsSeat: v.optional(v.boolean()),
    disabledSeat: v.optional(v.boolean()),
    barbequeSeat: v.optional(v.boolean()),
    reservationDate: v.string(), // YYYY-MM-DD
    reservationTime: v.optional(v.number()),
    notes: v.optional(v.string()),
    reason: v.optional(v.string()),
    layoutId: v.optional(v.id("organizationLayouts")),
    tableId: v.optional(v.id("organizationTables")),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireAdminOrCashier(ctx);

    // 1. Verify Queue Off Restrictions for Date
    const existingDateQueues = await ctx.db
      .query("organizationQueues")
      .withIndex("by_reservation_date", (q) =>
        q.eq("reservationDate", args.reservationDate)
      )
      .collect();

    if (args.queueType === "waitlist") {
      const waitlistOff = existingDateQueues.find(
        (q) => q.deletedAt === undefined && q.queueType === "waitlist_off"
      );
      if (waitlistOff) {
        throw new Error(
          `Waitlist is turned off on ${args.reservationDate}`
        );
      }
    }

    if (args.queueType === "reservation") {
      const reservationOff = existingDateQueues.find(
        (q) => q.deletedAt === undefined && q.queueType === "reservation_off"
      );
      if (reservationOff) {
        throw new Error(
          `Reservation is turned off on ${args.reservationDate}`
        );
      }
    }

    // 2. Resolve Queue Status
    let queueStatus:
      | "booked"
      | "pending"
      | "arrived"
      | "running_late"
      | "completed"
      | "rejected"
      | "close"
      | "cancelled_by_user"
      | "cancelled_by_admin" = "arrived";

    if (args.queueType === "waitlist_off" || args.queueType === "reservation_off") {
      queueStatus = "close";
    } else if (args.queueType === "reservation") {
      // Look up store configuration for bookingApproval setting
      const configs = await ctx.db.query("organizationQueueConfigurations" as any).collect();
      const activeConfig = configs.find((c: any) => c.deletedAt === undefined);
      const bookingApproval = (activeConfig as any)?.bookingApproval ?? false;
      queueStatus = bookingApproval ? "pending" : "booked";
    } else if (args.queueType === "waitlist") {
      queueStatus = "arrived";
    }

    // 3. Generate Sequential Daily Ticket Number
    const queueNumber = await generateNextQueueNumber(
      ctx,
      args.queueType,
      args.reservationDate
    );

    const now = Date.now();

    const queueId = await ctx.db.insert("organizationQueues", {
      queueType: args.queueType,
      queueStatus,
      queueNumber,
      totalGuests: args.totalGuests,
      kidsSeat: args.kidsSeat ?? false,
      disabledSeat: args.disabledSeat ?? false,
      barbequeSeat: args.barbequeSeat ?? false,
      reservationDate: args.reservationDate,
      reservationTime: args.reservationTime ?? now,
      notes: args.notes?.trim() || undefined,
      reason: args.reason?.trim() || undefined,
      layoutId: args.layoutId,
      tableId: args.tableId,
      userId: args.userId ?? identity.subject,
      createdAt: now,
      updatedAt: now,
    });

    // 4. Record Initial Queue Activity Audit Log
    await recordQueueActivity(ctx, queueId, queueStatus, identity.subject, args.reason);

    return (await ctx.db.get(queueId))!;
  },
});

/**
 * Updates properties and status of an existing organization queue.
 */
export const update = mutation({
  args: {
    id: v.id("organizationQueues"),
    totalGuests: v.optional(v.number()),
    kidsSeat: v.optional(v.boolean()),
    disabledSeat: v.optional(v.boolean()),
    barbequeSeat: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    reason: v.optional(v.string()),
    queueStatus: v.optional(
      v.union(
        v.literal("booked"),
        v.literal("pending"),
        v.literal("arrived"),
        v.literal("running_late"),
        v.literal("completed"),
        v.literal("rejected"),
        v.literal("close"),
        v.literal("cancelled_by_user"),
        v.literal("cancelled_by_admin")
      )
    ),
    layoutId: v.optional(v.id("organizationLayouts")),
    tableId: v.optional(v.id("organizationTables")),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireAdminOrCashier(ctx);

    const queue = await ctx.db.get(args.id);
    if (!queue || queue.deletedAt !== undefined) {
      throw new Error("Organization queue entry not found");
    }

    const now = Date.now();
    const isStatusChanged =
      args.queueStatus !== undefined && args.queueStatus !== queue.queueStatus;

    let cancellationTime = queue.cancellationTime;
    let completionTime = queue.completionTime;

    if (isStatusChanged && args.queueStatus) {
      if (
        args.queueStatus === "cancelled_by_admin" ||
        args.queueStatus === "cancelled_by_user"
      ) {
        cancellationTime = now;
      } else if (args.queueStatus === "completed") {
        completionTime = now;
      }
    }

    await ctx.db.patch(args.id, {
      totalGuests: args.totalGuests !== undefined ? args.totalGuests : queue.totalGuests,
      kidsSeat: args.kidsSeat !== undefined ? args.kidsSeat : queue.kidsSeat,
      disabledSeat: args.disabledSeat !== undefined ? args.disabledSeat : queue.disabledSeat,
      barbequeSeat: args.barbequeSeat !== undefined ? args.barbequeSeat : queue.barbequeSeat,
      notes: args.notes !== undefined ? args.notes.trim() || undefined : queue.notes,
      reason: args.reason !== undefined ? args.reason.trim() || undefined : queue.reason,
      queueStatus: args.queueStatus !== undefined ? args.queueStatus : queue.queueStatus,
      layoutId: args.layoutId !== undefined ? args.layoutId : queue.layoutId,
      tableId: args.tableId !== undefined ? args.tableId : queue.tableId,
      cancellationTime,
      completionTime,
      updatedAt: now,
    });

    // Record QueueActivity log if status changed
    if (isStatusChanged && args.queueStatus) {
      await recordQueueActivity(ctx, queue._id, args.queueStatus, identity.subject, args.reason);
    }

    return (await ctx.db.get(args.id))!;
  },
});

/**
 * Assigns a dining table to a queue entry and updates layout/table references.
 */
export const assignTable = mutation({
  args: {
    id: v.id("organizationQueues"),
    tableId: v.id("organizationTables"),
    layoutId: v.optional(v.id("organizationLayouts")),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireAdminOrCashier(ctx);

    const queue = await ctx.db.get(args.id);
    if (!queue || queue.deletedAt !== undefined) {
      throw new Error("Organization queue entry not found");
    }

    const table = (await (ctx.db as any).get(args.tableId)) as any;
    if (!table || table.deletedAt !== undefined) {
      throw new Error("Organization table not found");
    }

    if (table.isBlock || table.currentOrderId) {
      throw new Error("The table is busy now");
    }

    const resolvedLayoutId = args.layoutId ?? table.layoutId ?? queue.layoutId;
    const now = Date.now();

    await ctx.db.patch(queue._id, {
      tableId: table._id,
      layoutId: resolvedLayoutId,
      updatedAt: now,
    });

    await recordQueueActivity(
      ctx,
      queue._id,
      "table_assigned",
      identity.subject,
      `Table ${table.tableNumber} assigned`
    );

    return (await ctx.db.get(queue._id))!;
  },
});

/**
 * Soft deletes an organization queue entry.
 */
export const remove = mutation({
  args: { id: v.id("organizationQueues") },
  handler: async (ctx, args) => {
    const { identity } = await requireAdminOrCashier(ctx);

    const queue = await ctx.db.get(args.id);
    if (!queue || queue.deletedAt !== undefined) {
      throw new Error("Organization queue entry not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      deletedAt: now,
      updatedAt: now,
    });

    await recordQueueActivity(ctx, queue._id, "deleted", identity.subject);

    return { success: true };
  },
});
