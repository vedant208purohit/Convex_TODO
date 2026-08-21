import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { includeDeleted: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const orgs = await ctx.db.query("organizations").order("desc").collect();
    if (args.includeDeleted) {
      return orgs;
    }
    return orgs.filter((org) => org.status !== "deleted" && org.deletedAt === undefined);
  },
});

export const get = query({
  args: { id: v.union(v.id("organizations"), v.string()) },
  handler: async (ctx, args) => {
    if (!args.id || args.id.trim() === "") return null;
    const normalizedId = ctx.db.normalizeId("organizations", args.id);
    if (!normalizedId) return null;
    return await ctx.db.get(normalizedId);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    if (!args.slug || !args.slug.trim()) return null;
    return await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const getByLegacyOrganizationId = query({
  args: { legacyOrganizationId: v.string() },
  handler: async (ctx, args) => {
    if (!args.legacyOrganizationId || !args.legacyOrganizationId.trim()) return null;
    return await ctx.db
      .query("organizations")
      .withIndex("by_legacy_organization_id", (q) =>
        q.eq("legacyOrganizationId", args.legacyOrganizationId)
      )
      .first();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    legacyOrganizationId: v.optional(v.string()),
    ownerClerkId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Primary Identity Check by legacyOrganizationId
    if (args.legacyOrganizationId) {
      const existingByLegacy = await ctx.db
        .query("organizations")
        .withIndex("by_legacy_organization_id", (q) =>
          q.eq("legacyOrganizationId", args.legacyOrganizationId!)
        )
        .first();

      if (existingByLegacy) {
        if (existingByLegacy.status === "failed") {
          await ctx.db.patch(existingByLegacy._id, {
            status: "provisioning",
            ownerClerkId: args.ownerClerkId || existingByLegacy.ownerClerkId,
            errorMessage: undefined,
            updatedAt: Date.now(),
          });
          return existingByLegacy._id;
        }
        if (args.ownerClerkId && !existingByLegacy.ownerClerkId) {
          await ctx.db.patch(existingByLegacy._id, {
            ownerClerkId: args.ownerClerkId,
            updatedAt: Date.now(),
          });
        }
        return existingByLegacy._id;
      }
    }

    // 2. Slug handling for stores with identical names/slugs
    let targetSlug = args.slug;
    const existingBySlug = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", targetSlug))
      .first();

    if (existingBySlug) {
      if (
        args.legacyOrganizationId &&
        existingBySlug.legacyOrganizationId !== args.legacyOrganizationId
      ) {
        // Disambiguate slug by appending unique legacy ID suffix
        targetSlug = `${args.slug}-${args.legacyOrganizationId.substring(0, 8)}`;
      } else if (existingBySlug.status === "failed") {
        await ctx.db.patch(existingBySlug._id, {
          status: "provisioning",
          ownerClerkId: args.ownerClerkId || existingBySlug.ownerClerkId,
          errorMessage: undefined,
          updatedAt: Date.now(),
        });
        return existingBySlug._id;
      } else if (existingBySlug.status !== "deleted") {
        throw new Error(
          `Organization with slug "${args.slug}" already exists (status: ${existingBySlug.status}).`
        );
      }
    }

    return await ctx.db.insert("organizations", {
      name: args.name,
      slug: targetSlug,
      legacyOrganizationId: args.legacyOrganizationId,
      ownerClerkId: args.ownerClerkId,
      status: "provisioning",
      createdAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("organizations"),
    status: v.union(
      v.literal("provisioning"),
      v.literal("active"),
      v.literal("failed"),
      v.literal("deleting"),
      v.literal("deleted")
    ),
    projectId: v.optional(v.string()),
    deploymentId: v.optional(v.string()),
    deploymentUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const softDelete = mutation({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.id);
    if (!org) {
      throw new Error("Organization not found");
    }
    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "deleted",
      deletedAt: now,
      updatedAt: now,
    });
    return { success: true };
  },
});

// Backward compatibility alias for softDelete
export const remove = mutation({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.id);
    if (!org) {
      throw new Error("Organization not found");
    }
    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "deleted",
      deletedAt: now,
      updatedAt: now,
    });
    return { success: true };
  },
});
