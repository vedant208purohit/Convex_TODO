import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  requireAuth,
  resolveStoreOrganization,
  getCallerMembership,
  requireMember,
  requireAdmin,
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
  const { identity, org, callerMember } = await requireMember(ctx, explicitOrgId);

  const isOwnerOrUnowned = !org.ownerClerkId || org.ownerClerkId === identity.subject;
  if (isOwnerOrUnowned) {
    return { identity, org, callerMember };
  }

  const roles = Array.isArray(callerMember?.userType)
    ? callerMember!.userType
    : typeof callerMember?.userType === "string"
      ? [callerMember!.userType]
      : [];

  const hasAuthorizedRole = roles.some((role) =>
    ["admin", "store_admin", "org_admin", "super_admin", "cashier"].includes(
      (role || "").trim().toLowerCase()
    )
  );

  if (!hasAuthorizedRole) {
    throw new Error("Forbidden. Admin or Cashier access required.");
  }

  return { identity, org, callerMember };
}

// ----------------------------------------------------
// VALIDATION & NORMALIZATION HELPERS
// ----------------------------------------------------

/**
 * Normalizes payment mode name by trimming whitespace.
 * Rejects empty or blank strings.
 */
export function normalizePaymentModeName(name: string): string {
  if (!name || !name.trim()) {
    throw new Error("Payment mode name can't be blank");
  }
  return name.trim();
}

/**
 * Validates case-insensitive payment mode uniqueness for active records within an organization.
 * Matches legacy Rails error message: "Hey! <name> is already taken."
 */
export async function validateUniquePaymentModeName(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  name: string,
  excludeId?: Id<"paymentModes">
): Promise<void> {
  const normalized = name.trim().toLowerCase();
  const allModes = await ctx.db
    .query("paymentModes")
    .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
    .collect();

  const duplicate = allModes.find(
    (mode) =>
      mode.deletedAt === undefined &&
      (!excludeId || mode._id !== excludeId) &&
      mode.name.trim().toLowerCase() === normalized
  );

  if (duplicate) {
    throw new Error(`Hey! ${name.trim()} is already taken.`);
  }
}

/**
 * Validates that a payment mode is active and available for cashier / checkout use.
 * Throws an error if the payment mode is disabled, soft-deleted, or does not belong to the organization.
 */
export async function validateActivePaymentMode(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  modeRef: { paymentModeId?: Id<"paymentModes">; paymentModeName?: string }
): Promise<void> {
  if (modeRef.paymentModeId) {
    const pm = await ctx.db.get(modeRef.paymentModeId);
    if (!pm || pm.organizationId !== organizationId || pm.deletedAt !== undefined) {
      throw new Error("Payment mode not found.");
    }
    if (!pm.active) {
      throw new Error(`Payment mode "${pm.name}" is disabled and cannot be used for cashier checkout.`);
    }
    return;
  }

  if (modeRef.paymentModeName) {
    const trimmed = modeRef.paymentModeName.trim();
    const lower = trimmed.toLowerCase();
    if (!trimmed || lower === "split" || lower === "split payment" || lower === "pending") {
      return;
    }

    const allModes = await ctx.db
      .query("paymentModes")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .collect();

    const matched = allModes.find(
      (m) => m.deletedAt === undefined && m.name.trim().toLowerCase() === lower
    );

    if (matched && !matched.active) {
      throw new Error(`Payment mode "${matched.name}" is disabled and cannot be used for cashier checkout.`);
    }
  }
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Lists payment modes for the current store organization.
 * - Supports `activeOnly: true` filter for POS checkout/cashier workflows.
 * - Enforces active-only visibility for non-admin callers (e.g. Cashiers).
 * - Excludes soft-deleted records.
 * - Returns results sorted deterministically by creation time ASC.
 */
export const list = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { org, callerMember, identity } = await requireMember(ctx, args.organizationId);

    const isOwner = !org.ownerClerkId || org.ownerClerkId === identity.subject;
    const roles = Array.isArray(callerMember?.userType)
      ? callerMember!.userType
      : typeof callerMember?.userType === "string"
        ? [callerMember!.userType]
        : [];
    const isAdmin =
      isOwner ||
      roles.some((role) =>
        ["admin", "store_admin", "org_admin", "super_admin"].includes(
          (role || "").trim().toLowerCase()
        )
      );

    const filterActive = args.activeOnly === true || !isAdmin;

    let modes: Doc<"paymentModes">[];
    if (filterActive) {
      modes = await ctx.db
        .query("paymentModes")
        .withIndex("by_org_active", (q) =>
          q.eq("organizationId", org._id).eq("active", true)
        )
        .collect();
    } else {
      modes = await ctx.db
        .query("paymentModes")
        .withIndex("by_org", (q) => q.eq("organizationId", org._id))
        .collect();
    }

    const activeModes = modes.filter((m) => m.deletedAt === undefined);
    return activeModes.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  },
});

/**
 * Fetches a single payment mode by ID.
 * - Verifies caller organization membership.
 * - Returns null if nonexistent or soft-deleted.
 */
export const get = query({
  args: { id: v.id("paymentModes") },
  handler: async (ctx, args) => {
    const mode = await ctx.db.get(args.id);
    if (!mode || mode.deletedAt !== undefined) {
      return null;
    }

    await requireMember(ctx, mode.organizationId);
    return mode;
  },
});

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * Creates a new payment mode for the store organization.
 * - Requires Admin or Cashier role.
 * - Enforces case-insensitive name uniqueness per organization.
 */
export const create = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    name: v.string(),
    active: v.optional(v.boolean()),
    legacyId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org } = await requireAdminOrCashier(ctx, args.organizationId);
    const trimmedName = normalizePaymentModeName(args.name);
    await validateUniquePaymentModeName(ctx, org._id, trimmedName);

    const now = Date.now();
    const id = await ctx.db.insert("paymentModes", {
      organizationId: org._id,
      name: trimmedName,
      active: args.active !== undefined ? args.active : true,
      legacyId: args.legacyId,
      createdAt: now,
    });

    const created = await ctx.db.get(id);
    return created!;
  },
});

/**
 * Updates an existing payment mode (name, active state).
 * - Requires Admin or Cashier role.
 * - Enforces case-insensitive uniqueness if name is changed.
 */
export const update = mutation({
  args: {
    id: v.id("paymentModes"),
    name: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const mode = await ctx.db.get(args.id);
    if (!mode || mode.deletedAt !== undefined) {
      throw new Error("Payment mode not found");
    }

    await requireAdminOrCashier(ctx, mode.organizationId);

    const updates: { name?: string; active?: boolean } = {};

    if (args.name !== undefined) {
      const trimmedName = normalizePaymentModeName(args.name);
      await validateUniquePaymentModeName(
        ctx,
        mode.organizationId,
        trimmedName,
        mode._id
      );
      updates.name = trimmedName;
    }

    if (args.active !== undefined) {
      updates.active = args.active;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.id, updates);
    }

    const updated = await ctx.db.get(args.id);
    return updated!;
  },
});

/**
 * Toggles the active status of a payment mode (active <-> inactive).
 * - Requires Admin or Cashier role.
 */
export const toggleActive = mutation({
  args: { id: v.id("paymentModes") },
  handler: async (ctx, args) => {
    const mode = await ctx.db.get(args.id);
    if (!mode || mode.deletedAt !== undefined) {
      throw new Error("Payment mode not found");
    }

    await requireAdminOrCashier(ctx, mode.organizationId);

    const nextActive = !mode.active;
    await ctx.db.patch(args.id, { active: nextActive });

    const updated = await ctx.db.get(args.id);
    return updated!;
  },
});

/**
 * Soft deletes a payment mode from the store organization.
 * - Requires Admin role.
 * - Sets `deletedAt: Date.now()`.
 * - Preserves historical snapshots in orders and orderPayments.
 */
export const remove = mutation({
  args: { id: v.id("paymentModes") },
  handler: async (ctx, args) => {
    const mode = await ctx.db.get(args.id);
    if (!mode || mode.deletedAt !== undefined) {
      throw new Error("Payment mode not found");
    }

    await requireAdmin(ctx, mode.organizationId);

    const now = Date.now();
    await ctx.db.patch(args.id, { deletedAt: now });

    return { success: true, id: args.id };
  },
});
