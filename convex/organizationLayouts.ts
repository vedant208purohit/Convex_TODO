import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAdmin, requireMember } from "./organizationUsers";

// ----------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------

/**
 * Checks case-insensitive uniqueness for layout name among active records.
 */
async function validateUniqueName(
  ctx: QueryCtx | MutationCtx,
  name: string,
  excludeId?: Id<"organizationLayouts">
): Promise<void> {
  const normalizedName = name.trim().toLowerCase();
  const allLayouts = await ctx.db.query("organizationLayouts").collect();

  const duplicate = allLayouts.find(
    (layout) =>
      layout.deletedAt === undefined &&
      (!excludeId || layout._id !== excludeId) &&
      layout.name.toLowerCase() === normalizedName
  );

  if (duplicate) {
    throw new Error(`Hey! ${name.trim()} is already taken.`);
  }
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Lists all active (non-deleted) organization layouts for the store
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);
    const layouts = await ctx.db.query("organizationLayouts").collect();
    return layouts.filter((layout) => layout.deletedAt === undefined);
  },
});

/**
 * Fetches a single organization layout by ID
 */
export const get = query({
  args: { id: v.id("organizationLayouts") },
  handler: async (ctx, args) => {
    await requireMember(ctx);
    const layout = await ctx.db.get(args.id);
    if (!layout || layout.deletedAt !== undefined) {
      return null;
    }
    return layout;
  },
});

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * Creates a new organization layout section in the store
 */
export const create = mutation({
  args: {
    name: v.string(),
    displayOrder: v.optional(v.number()),
    legacyId: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // 1. Validate Name presence & normalize whitespace (StripSpaces concern)
    if (!args.name || !args.name.trim()) {
      throw new Error("Name can't be blank");
    }

    const trimmedName = args.name.trim();

    // 2. Uniqueness Validation (Case-insensitive, active records only)
    await validateUniqueName(ctx, trimmedName);

    const now = Date.now();

    // 3. Insert Document
    const layoutId = await ctx.db.insert("organizationLayouts", {
      legacyId: args.legacyId,
      name: trimmedName,
      displayOrder: args.displayOrder,
      createdAt: args.createdAt ?? now,
      updatedAt: args.updatedAt ?? now,
    });

    return layoutId;
  },
});

/**
 * Updates an existing organization layout section
 */
export const update = mutation({
  args: {
    id: v.id("organizationLayouts"),
    name: v.optional(v.string()),
    displayOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Layout not found");
    }

    let trimmedName: string | undefined = undefined;
    if (args.name !== undefined) {
      if (!args.name || !args.name.trim()) {
        throw new Error("Name can't be blank");
      }
      trimmedName = args.name.trim();
      if (trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
        await validateUniqueName(ctx, trimmedName, args.id);
      }
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      name: trimmedName ?? existing.name,
      displayOrder: args.displayOrder ?? existing.displayOrder,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Soft deletes an organization layout section
 */
export const remove = mutation({
  args: { id: v.id("organizationLayouts") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Layout not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      deletedAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});
