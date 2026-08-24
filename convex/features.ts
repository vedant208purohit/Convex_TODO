import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Global Features Catalog Functions (Master App)
 */

async function requireSuperAdmin(ctx: { auth: { getUserIdentity: () => Promise<unknown> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity) {
    const role =
      (identity as any).role ||
      (identity as any).globalRole ||
      (identity as any).userType;
    if (role !== "super_admin" && role !== "SYSTEM_ADMIN" && role !== "admin") {
      throw new Error("Unauthorized: Only Super Admin users can manage global features catalog.");
    }
  }
}

export const list = query({
  args: { includeDeleted: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const features = await ctx.db.query("features").order("desc").collect();
    if (args.includeDeleted) {
      return features;
    }
    return features.filter((feature) => feature.deletedAt === undefined);
  },
});

export const get = query({
  args: {
    id: v.optional(v.union(v.id("features"), v.string())),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.id) {
      const normalizedId = ctx.db.normalizeId("features", args.id);
      if (!normalizedId) return null;
      const feature = await ctx.db.get(normalizedId);
      if (!feature || feature.deletedAt !== undefined) return null;
      return feature;
    }

    if (args.name) {
      const trimmedName = args.name.trim().toLowerCase();
      const allFeatures = await ctx.db.query("features").collect();
      const match = allFeatures.find(
        (f) => f.deletedAt === undefined && f.name.toLowerCase() === trimmedName
      );
      return match || null;
    }

    return null;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    displayName: v.string(),
    description: v.optional(v.string()),
    displayDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const trimmedName = args.name.trim();
    if (!trimmedName) {
      throw new Error("Feature name can't be blank");
    }

    const trimmedDisplayName = args.displayName.trim();
    if (!trimmedDisplayName) {
      throw new Error("Feature displayName can't be blank");
    }

    // Uniqueness check: feature names must be unique case-insensitively within non-deleted features
    const allFeatures = await ctx.db.query("features").collect();
    const existing = allFeatures.find(
      (f) =>
        f.deletedAt === undefined &&
        f.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existing) {
      throw new Error(
        `Feature with name "${trimmedName}" already exists (case-insensitive collision).`
      );
    }

    const now = Date.now();
    return await ctx.db.insert("features", {
      name: trimmedName,
      displayName: trimmedDisplayName,
      description: args.description,
      displayDescription: args.displayDescription,
      createdAt: now,
    });
  },
});

export const updateMetadata = mutation({
  args: {
    id: v.id("features"),
    displayName: v.optional(v.string()),
    description: v.optional(v.string()),
    displayDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const feature = await ctx.db.get(args.id);
    if (!feature || feature.deletedAt !== undefined) {
      throw new Error("Feature not found");
    }

    const updates: Partial<{
      displayName: string;
      description?: string;
      displayDescription?: string;
      updatedAt: number;
    }> = {
      updatedAt: Date.now(),
    };

    if (args.displayName !== undefined) {
      const trimmed = args.displayName.trim();
      if (!trimmed) {
        throw new Error("Feature displayName can't be blank");
      }
      updates.displayName = trimmed;
    }

    if (args.description !== undefined) {
      updates.description = args.description;
    }

    if (args.displayDescription !== undefined) {
      updates.displayDescription = args.displayDescription;
    }

    await ctx.db.patch(args.id, updates);
    return { success: true };
  },
});

export const softDelete = mutation({
  args: { id: v.id("features") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const feature = await ctx.db.get(args.id);
    if (!feature || feature.deletedAt !== undefined) {
      throw new Error("Feature not found");
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      deletedAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});
