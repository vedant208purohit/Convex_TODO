import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAuth, resolveStoreOrganization, getCallerMembership } from "./organizationUsers";

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
// VALIDATION HELPERS
// ----------------------------------------------------

export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export async function validateUniqueName(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organizations">,
  name: string,
  excludeId?: Id<"paymentModes">
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Payment mode name is required.");
  }

  const normalized = normalizeName(trimmed);

  const existingModes = await ctx.db
    .query("paymentModes")
    .withIndex("by_org", (q) => q.eq("organizationId", orgId))
    .collect();

  const duplicate = existingModes.find(
    (m) => (excludeId === undefined || m._id !== excludeId) && normalizeName(m.name) === normalized
  );

  if (duplicate) {
    throw new Error(`Hey! ${trimmed} is already taken.`);
  }
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Lists active payment modes for the caller's organization.
 * Safe for unauthenticated / loading callers.
 */
export const list = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    try {
      const org = await resolveStoreOrganization(ctx, args.organizationId);
      const callerMember = await getCallerMembership(ctx, identity.subject, org._id);
      if (!callerMember) {
        return [];
      }

      const modes = await ctx.db
        .query("paymentModes")
        .withIndex("by_org", (q) => q.eq("organizationId", org._id))
        .collect();

      return modes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch {
      return [];
    }
  },
});

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * Creates a new payment mode.
 */
export const create = mutation({
  args: {
    name: v.string(),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { org } = await requireAdminOrCashier(ctx);

    const trimmedName = args.name.trim();
    if (!trimmedName) {
      throw new Error("Payment mode name is required.");
    }

    await validateUniqueName(ctx, org._id, trimmedName);

    const newId = await ctx.db.insert("paymentModes", {
      organizationId: org._id,
      name: trimmedName,
      active: args.active ?? true,
      createdAt: Date.now(),
    });

    return newId;
  },
});

/**
 * Updates an existing payment mode.
 */
export const update = mutation({
  args: {
    id: v.id("paymentModes"),
    name: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { org } = await requireAdminOrCashier(ctx);

    const paymentMode = await ctx.db.get(args.id);
    if (!paymentMode || paymentMode.organizationId !== org._id) {
      throw new Error("Payment mode not found.");
    }

    const updates: Partial<{ name: string; active: boolean }> = {};

    if (args.name !== undefined) {
      const trimmedName = args.name.trim();
      if (!trimmedName) {
        throw new Error("Payment mode name cannot be empty.");
      }
      if (trimmedName !== paymentMode.name) {
        await validateUniqueName(ctx, org._id, trimmedName, args.id);
        updates.name = trimmedName;
      }
    }

    if (args.active !== undefined) {
      updates.active = args.active;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.id, updates);
    }

    return args.id;
  },
});

/**
 * Quick-toggle cashier availability / active status for a payment mode.
 */
export const toggleActive = mutation({
  args: {
    id: v.id("paymentModes"),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { org } = await requireAdminOrCashier(ctx);

    const paymentMode = await ctx.db.get(args.id);
    if (!paymentMode || paymentMode.organizationId !== org._id) {
      throw new Error("Payment mode not found.");
    }

    await ctx.db.patch(args.id, { active: args.active });
    return args.id;
  },
});

/**
 * Deletes a payment mode.
 */
export const remove = mutation({
  args: {
    id: v.id("paymentModes"),
  },
  handler: async (ctx, args) => {
    const { org } = await requireAdminOrCashier(ctx);

    const paymentMode = await ctx.db.get(args.id);
    if (!paymentMode || paymentMode.organizationId !== org._id) {
      throw new Error("Payment mode not found.");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
