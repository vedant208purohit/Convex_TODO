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
// VALIDATION & NORMALIZATION HELPERS
// ----------------------------------------------------

/**
 * Normalizes a waiter code for case-insensitive uniqueness checks.
 * Returns undefined if code is missing or whitespace-only.
 */
export function normalizeWaiterCode(code?: string): string | undefined {
  if (!code || !code.trim()) {
    return undefined;
  }
  return code.trim().toLowerCase();
}

/**
 * Validates case-insensitive waiterCode uniqueness for active records within the store database.
 */
export async function validateUniqueWaiterCode(
  ctx: QueryCtx | MutationCtx,
  waiterCode?: string,
  excludeId?: Id<"organizationWaiters">
): Promise<string | undefined> {
  const normalized = normalizeWaiterCode(waiterCode);
  if (!normalized) {
    return undefined;
  }

  const existing = await ctx.db
    .query("organizationWaiters")
    .withIndex("by_waiter_code", (q) => q.eq("normalizedWaiterCode", normalized))
    .collect();

  const activeDuplicates = existing.filter(
    (w) => w.deletedAt === undefined && (excludeId === undefined || w._id !== excludeId)
  );

  if (activeDuplicates.length > 0) {
    throw new Error(`Hey! ${waiterCode?.trim()} is already taken.`);
  }

  return normalized;
}

/**
 * Formats a raw document into a clean, narrow public response.
 */
function toWaiterResponse(doc: Doc<"organizationWaiters">) {
  return {
    _id: doc._id,
    legacyId: doc.legacyId,
    firstName: doc.firstName,
    lastName: doc.lastName,
    waiterCode: doc.waiterCode,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Lists active organization waiters for the store ordered by creation date descending.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);

    const items = await ctx.db.query("organizationWaiters").collect();

    const active = items.filter((w) => w.deletedAt === undefined);

    active.sort((a, b) => b.createdAt - a.createdAt);

    return active.map(toWaiterResponse);
  },
});

/**
 * Fetches a single active organization waiter profile by ID.
 */
export const get = query({
  args: { id: v.id("organizationWaiters") },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    const waiter = await ctx.db.get(args.id);
    if (!waiter || waiter.deletedAt !== undefined) {
      return null;
    }

    return toWaiterResponse(waiter);
  },
});

/**
 * Resolves a waiter profile by ID including soft-deleted records for historical order resolution.
 */
export const getWithDeleted = query({
  args: { id: v.id("organizationWaiters") },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    const waiter = await ctx.db.get(args.id);
    if (!waiter) {
      return null;
    }

    return {
      ...toWaiterResponse(waiter),
      deletedAt: waiter.deletedAt,
    };
  },
});

/**
 * Searches active store waiters by name or exact attributes (case-insensitive prefix search).
 */
export const search = query({
  args: {
    name: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    waiterCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    const all = await ctx.db.query("organizationWaiters").collect();
    let active = all.filter((w) => w.deletedAt === undefined);

    if (args.name !== undefined && args.name.trim() !== "") {
      const parts = args.name.trim().toLowerCase().split(/\s+/);
      if (parts.length >= 2) {
        const fPart = parts[0];
        const lPart = parts.slice(1).join(" ");
        active = active.filter(
          (w) =>
            (w.firstName?.toLowerCase().startsWith(fPart) ?? false) &&
            (w.lastName?.toLowerCase().startsWith(lPart) ?? false)
        );
      } else if (parts.length === 1) {
        const searchTerm = parts[0];
        active = active.filter(
          (w) =>
            (w.firstName?.toLowerCase().startsWith(searchTerm) ?? false) ||
            (w.lastName?.toLowerCase().startsWith(searchTerm) ?? false)
        );
      }
    }

    if (args.firstName !== undefined && args.firstName.trim() !== "") {
      const qFirst = args.firstName.trim().toLowerCase();
      active = active.filter((w) => w.firstName?.toLowerCase() === qFirst);
    }

    if (args.lastName !== undefined && args.lastName.trim() !== "") {
      const qLast = args.lastName.trim().toLowerCase();
      active = active.filter((w) => w.lastName?.toLowerCase() === qLast);
    }

    if (args.waiterCode !== undefined && args.waiterCode.trim() !== "") {
      const qCode = args.waiterCode.trim().toLowerCase();
      active = active.filter((w) => w.normalizedWaiterCode === qCode);
    }

    active.sort((a, b) => b.createdAt - a.createdAt);

    return active.map(toWaiterResponse);
  },
});

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * Creates a new organization waiter profile.
 */
export const create = mutation({
  args: {
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    waiterCode: v.optional(v.string()),
    legacyId: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const rawCode = args.waiterCode?.trim() || undefined;
    const normalizedWaiterCode = await validateUniqueWaiterCode(ctx, rawCode);

    const now = Date.now();

    const waiterId = await ctx.db.insert("organizationWaiters", {
      legacyId: args.legacyId,
      firstName: args.firstName?.trim() || undefined,
      lastName: args.lastName?.trim() || undefined,
      waiterCode: rawCode,
      normalizedWaiterCode,
      createdAt: args.createdAt ?? now,
      updatedAt: args.updatedAt ?? now,
    });

    return toWaiterResponse((await ctx.db.get(waiterId))!);
  },
});

/**
 * Updates an existing organization waiter profile.
 */
export const update = mutation({
  args: {
    id: v.id("organizationWaiters"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    waiterCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Organization waiter not found");
    }

    let effectiveCode = existing.waiterCode;
    let normalizedCode = existing.normalizedWaiterCode;

    if (args.waiterCode !== undefined) {
      effectiveCode = args.waiterCode.trim() || undefined;
      normalizedCode = await validateUniqueWaiterCode(ctx, effectiveCode, args.id);
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      firstName:
        args.firstName !== undefined
          ? args.firstName.trim() || undefined
          : existing.firstName,
      lastName:
        args.lastName !== undefined
          ? args.lastName.trim() || undefined
          : existing.lastName,
      waiterCode: effectiveCode,
      normalizedWaiterCode: normalizedCode,
      updatedAt: now,
    });

    return toWaiterResponse((await ctx.db.get(args.id))!);
  },
});

/**
 * Soft deletes an organization waiter profile.
 */
export const remove = mutation({
  args: { id: v.id("organizationWaiters") },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Organization waiter not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      deletedAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});
