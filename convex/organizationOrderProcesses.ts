import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
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
 * Requires caller to be an active Store Admin or Cashier in the target organization
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
// VALIDATION HELPERS
// ----------------------------------------------------

const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

/**
 * Validates process color hex format when isSequence is true.
 */
function validateProcessColor(processColor?: string, isSequence = true): void {
  if (isSequence && processColor !== undefined && processColor !== null) {
    if (!HEX_COLOR_REGEX.test(processColor)) {
      throw new Error("is not a valid color");
    }
  }
}

/**
 * Validates case-insensitive name uniqueness for active processes within the store.
 * Note: Case-insensitive name comparison across store processes requires inspecting active records
 * as Convex indexes do not support case-insensitive text transformations.
 */
async function validateUniqueName(
  ctx: QueryCtx | MutationCtx,
  name: string,
  excludeId?: Id<"organizationOrderProcesses">
): Promise<void> {
  const activeProcesses = await ctx.db
    .query("organizationOrderProcesses")
    .filter((q) => q.eq(q.field("deletedAt"), undefined))
    .collect();
  const normalizedInput = name.trim().toLowerCase();

  const duplicate = activeProcesses.find(
    (proc) =>
      (!excludeId || proc._id !== excludeId) &&
      proc.name.trim().toLowerCase() === normalizedInput
  );

  if (duplicate) {
    throw new Error(`Hey! ${name.trim()} is already taken.`);
  }
}

/**
 * Validates position uniqueness scoped to (isSequence, active).
 */
async function validateUniquePosition(
  ctx: QueryCtx | MutationCtx,
  isSequence: boolean,
  position: number,
  excludeId?: Id<"organizationOrderProcesses">
): Promise<void> {
  const existing = await ctx.db
    .query("organizationOrderProcesses")
    .withIndex("by_position", (q) =>
      q.eq("isSequence", isSequence).eq("position", position)
    )
    .filter((q) => q.eq(q.field("deletedAt"), undefined))
    .first();

  if (existing && (!excludeId || existing._id !== excludeId)) {
    throw new Error(`A organization order process exists at this position ${position}`);
  }
}

/**
 * Auto-generates position as max(active position for isSequence) + 1.
 */
async function generatePosition(
  ctx: QueryCtx | MutationCtx,
  isSequence: boolean
): Promise<number> {
  const highest = await ctx.db
    .query("organizationOrderProcesses")
    .withIndex("by_position", (q) => q.eq("isSequence", isSequence))
    .order("desc")
    .filter((q) => q.eq(q.field("deletedAt"), undefined))
    .first();

  return highest ? highest.position + 1 : 1;
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Lists active (non-deleted) organization order processes with optional filtering
 */
export const list = query({
  args: {
    published: v.optional(v.boolean()),
    isSequence: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    let active: Doc<"organizationOrderProcesses">[];

    if (args.isSequence !== undefined) {
      active = await ctx.db
        .query("organizationOrderProcesses")
        .withIndex("by_position", (q) => q.eq("isSequence", args.isSequence!))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();
    } else if (args.published !== undefined) {
      active = await ctx.db
        .query("organizationOrderProcesses")
        .withIndex("by_published", (q) => q.eq("published", args.published!))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();
    } else {
      active = await ctx.db
        .query("organizationOrderProcesses")
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();
    }

    if (args.published !== undefined && args.isSequence !== undefined) {
      active = active.filter((proc) => proc.published === args.published);
    }

    // Sort by isSequence (descending so true comes before false) then position (ascending)
    active.sort((a, b) => {
      if (a.isSequence !== b.isSequence) {
        return a.isSequence ? -1 : 1;
      }
      return a.position - b.position;
    });

    return active;
  },
});

/**
 * Fetches a single organization order process by ID
 */
export const get = query({
  args: { id: v.id("organizationOrderProcesses") },
  handler: async (ctx, args) => {
    await requireMember(ctx);
    const processDoc = await ctx.db.get(args.id);
    if (!processDoc || processDoc.deletedAt !== undefined) {
      return null;
    }
    return processDoc;
  },
});

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * Creates a new organization order process
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    position: v.optional(v.number()),
    published: v.optional(v.boolean()),
    isSequence: v.optional(v.boolean()),
    processColor: v.optional(v.string()),
    legacyId: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    if (!args.name || !args.name.trim()) {
      throw new Error("Name can't be blank");
    }

    const trimmedName = args.name.trim();
    const effectiveIsSequence = args.isSequence ?? true;
    const effectivePublished = args.published ?? false;

    // 1. Validate process color hex format when isSequence is true
    validateProcessColor(args.processColor, effectiveIsSequence);

    // 2. Validate case-insensitive name uniqueness among active processes
    await validateUniqueName(ctx, trimmedName);

    // 3. Resolve or validate position
    let finalPosition: number;
    if (args.position !== undefined && args.position !== null) {
      if (args.position < 1) {
        throw new Error("Position must be a positive number");
      }
      await validateUniquePosition(ctx, effectiveIsSequence, args.position);
      finalPosition = args.position;
    } else {
      finalPosition = await generatePosition(ctx, effectiveIsSequence);
    }

    const now = Date.now();

    const processId = await ctx.db.insert("organizationOrderProcesses", {
      legacyId: args.legacyId,
      name: trimmedName,
      description: args.description ? args.description.trim() : undefined,
      position: finalPosition,
      published: effectivePublished,
      isSequence: effectiveIsSequence,
      processColor: args.processColor ? args.processColor.trim() : undefined,
      createdAt: args.createdAt ?? now,
      updatedAt: args.updatedAt ?? now,
    });

    return processId;
  },
});

/**
 * Updates an existing organization order process
 */
export const update = mutation({
  args: {
    id: v.id("organizationOrderProcesses"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    position: v.optional(v.number()),
    published: v.optional(v.boolean()),
    isSequence: v.optional(v.boolean()),
    processColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Process not found");
    }

    let trimmedName: string | undefined = undefined;
    if (args.name !== undefined) {
      if (!args.name || !args.name.trim()) {
        throw new Error("Name can't be blank");
      }
      trimmedName = args.name.trim();
      await validateUniqueName(ctx, trimmedName, args.id);
    }

    const effectiveIsSequence = args.isSequence ?? existing.isSequence;
    const effectiveProcessColor =
      args.processColor !== undefined ? args.processColor : existing.processColor;

    // Validate process color when isSequence is true
    validateProcessColor(effectiveProcessColor, effectiveIsSequence);

    let effectivePosition = existing.position;
    if (
      args.position !== undefined &&
      (args.position !== existing.position || args.isSequence !== existing.isSequence)
    ) {
      if (args.position < 1) {
        throw new Error("Position must be a positive number");
      }
      await validateUniquePosition(ctx, effectiveIsSequence, args.position, args.id);
      effectivePosition = args.position;
    } else if (args.isSequence !== undefined && args.isSequence !== existing.isSequence) {
      // Switched isSequence scope without position argument -> generate position in new scope
      effectivePosition = await generatePosition(ctx, effectiveIsSequence);
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      name: trimmedName ?? existing.name,
      description: args.description !== undefined ? (args.description ? args.description.trim() : undefined) : existing.description,
      position: effectivePosition,
      published: args.published ?? existing.published,
      isSequence: effectiveIsSequence,
      processColor: effectiveProcessColor ? effectiveProcessColor.trim() : undefined,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Reorders an organization order process to a new contiguous position within its sequence scope
 */
export const reorder = mutation({
  args: {
    id: v.id("organizationOrderProcesses"),
    position: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const target = await ctx.db.get(args.id);
    if (!target || target.deletedAt !== undefined) {
      throw new Error("Process not found");
    }

    if (args.position < 1) {
      throw new Error("Position must be a positive number");
    }

    // Get all active processes for the target's isSequence scope in position order
    const activeSameScope = await ctx.db
      .query("organizationOrderProcesses")
      .withIndex("by_position", (q) => q.eq("isSequence", target.isSequence))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Remove target from current list
    const currentList = activeSameScope.filter((proc) => proc._id !== target._id);

    // Clamp new index between 0 and currentList.length
    const newIndex = Math.max(0, Math.min(args.position - 1, currentList.length));

    // Insert target at new index
    currentList.splice(newIndex, 0, target);

    const now = Date.now();

    // Re-index contiguously 1..N
    for (let index = 0; index < currentList.length; index++) {
      const proc = currentList[index];
      const newPos = index + 1;
      if (proc.position !== newPos || proc._id === target._id) {
        await ctx.db.patch(proc._id, {
          position: newPos,
          updatedAt: now,
        });
      }
    }

    return { success: true };
  },
});

/**
 * Soft deletes an organization order process
 */
export const remove = mutation({
  args: { id: v.id("organizationOrderProcesses") },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Process not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      deletedAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});
