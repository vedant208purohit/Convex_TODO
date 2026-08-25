import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAdmin, requireMember } from "./organizationUsers";

// ----------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------

/**
 * Checks case-insensitive uniqueness for language name among active records.
 */
async function validateUniqueName(
  ctx: QueryCtx | MutationCtx,
  name: string,
  excludeId?: Id<"organizationLanguages">
): Promise<void> {
  const normalizedName = name.trim().toLowerCase();
  const allLanguages = await ctx.db.query("organizationLanguages").collect();

  const duplicate = allLanguages.find(
    (lang) =>
      lang.deletedAt === undefined &&
      (!excludeId || lang._id !== excludeId) &&
      lang.name.toLowerCase() === normalizedName
  );

  if (duplicate) {
    throw new Error(`Hey! ${name.trim()} is already taken.`);
  }
}

/**
 * Checks case-insensitive uniqueness for language code among active records.
 */
async function validateUniqueCode(
  ctx: QueryCtx | MutationCtx,
  code: string,
  excludeId?: Id<"organizationLanguages">
): Promise<void> {
  const normalizedCode = code.trim().toLowerCase();
  const allLanguages = await ctx.db.query("organizationLanguages").collect();

  const duplicate = allLanguages.find(
    (lang) =>
      lang.deletedAt === undefined &&
      (!excludeId || lang._id !== excludeId) &&
      lang.code.toLowerCase() === normalizedCode
  );

  if (duplicate) {
    throw new Error(`Hey! ${code.trim()} is already taken.`);
  }
}

/**
 * Unsets any existing active default language in the store database.
 */
async function unsetExistingActiveDefault(
  ctx: MutationCtx,
  excludeId?: Id<"organizationLanguages">,
  now: number = Date.now()
): Promise<void> {
  const allLanguages = await ctx.db.query("organizationLanguages").collect();

  const activeDefault = allLanguages.find(
    (lang) =>
      lang.deletedAt === undefined &&
      lang.isDefault === true &&
      (!excludeId || lang._id !== excludeId)
  );

  if (activeDefault) {
    await ctx.db.patch(activeDefault._id, {
      isDefault: false,
      updatedAt: now,
    });
  }
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Lists all active (non-deleted) organization languages for the store
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);
    const languages = await ctx.db.query("organizationLanguages").collect();
    return languages.filter((lang) => lang.deletedAt === undefined);
  },
});

/**
 * Fetches a single organization language by ID
 */
export const get = query({
  args: { id: v.id("organizationLanguages") },
  handler: async (ctx, args) => {
    await requireMember(ctx);
    const language = await ctx.db.get(args.id);
    if (!language || language.deletedAt !== undefined) {
      return null;
    }
    return language;
  },
});

/**
 * Fetches an active organization language by code (case-insensitive)
 */
export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    await requireMember(ctx);
    if (!args.code || !args.code.trim()) return null;

    const normalizedCode = args.code.trim().toLowerCase();
    const languages = await ctx.db.query("organizationLanguages").collect();

    const match = languages.find(
      (lang) => lang.deletedAt === undefined && lang.code.toLowerCase() === normalizedCode
    );

    return match || null;
  },
});

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * Creates a new organization language in the store
 */
export const create = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    isDefault: v.optional(v.boolean()),
    legacyId: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // 1. Validate Name
    if (!args.name || !args.name.trim()) {
      throw new Error("Name can't be blank");
    }

    // 2. Validate Code
    if (!args.code || !args.code.trim()) {
      throw new Error("Code can't be blank");
    }

    const trimmedName = args.name.trim();
    const trimmedCode = args.code.trim();

    // 3. Uniqueness Validations (Case-insensitive, active records only)
    await validateUniqueName(ctx, trimmedName);
    await validateUniqueCode(ctx, trimmedCode);

    const now = Date.now();
    const targetIsDefault = args.isDefault ?? false;

    // 4. Default Language Exclusivity (If target is default, unset any active default)
    if (targetIsDefault) {
      await unsetExistingActiveDefault(ctx, undefined, now);
    }

    // 5. Insert Document
    const langId = await ctx.db.insert("organizationLanguages", {
      legacyId: args.legacyId,
      name: trimmedName,
      code: trimmedCode,
      isDefault: targetIsDefault,
      createdAt: args.createdAt ?? now,
      updatedAt: args.updatedAt ?? now,
    });

    return langId;
  },
});

/**
 * Updates an existing organization language
 */
export const update = mutation({
  args: {
    id: v.id("organizationLanguages"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Language not found");
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

    let trimmedCode: string | undefined = undefined;
    if (args.code !== undefined) {
      if (!args.code || !args.code.trim()) {
        throw new Error("Code can't be blank");
      }
      trimmedCode = args.code.trim();
      if (trimmedCode.toLowerCase() !== existing.code.toLowerCase()) {
        await validateUniqueCode(ctx, trimmedCode, args.id);
      }
    }

    const now = Date.now();
    const targetIsDefault = args.isDefault ?? existing.isDefault;

    // Handle Default exclusivity if changing to isDefault = true
    if (args.isDefault === true && existing.isDefault !== true) {
      await unsetExistingActiveDefault(ctx, args.id, now);
    }

    await ctx.db.patch(args.id, {
      name: trimmedName ?? existing.name,
      code: trimmedCode ?? existing.code,
      isDefault: targetIsDefault,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Sets a specific organization language as the active store default
 */
export const setDefault = mutation({
  args: { id: v.id("organizationLanguages") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Language not found");
    }

    if (existing.isDefault === true) {
      return { success: true };
    }

    const now = Date.now();
    await unsetExistingActiveDefault(ctx, args.id, now);

    await ctx.db.patch(args.id, {
      isDefault: true,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Soft deletes an organization language
 */
export const remove = mutation({
  args: { id: v.id("organizationLanguages") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Language not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      isDefault: false,
      deletedAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});
