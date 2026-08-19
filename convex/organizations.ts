import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated: Access denied.");
    }
    return await ctx.db.query("organizations").order("desc").collect();
  },
});

export const get = query({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated: Access denied.");
    }
    return await ctx.db.get(args.id);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated: Access denied.");
    }
    return await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const getByLegacyOrganizationId = query({
  args: { legacyOrganizationId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated: Access denied.");
    }
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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated: Access denied.");
    }

    // 1. Primary Identity Check by legacyOrganizationId
    if (args.legacyOrganizationId) {
      const existingByLegacy = await ctx.db
        .query("organizations")
        .withIndex("by_legacy_organization_id", (q) =>
          q.eq("legacyOrganizationId", args.legacyOrganizationId)
        )
        .first();

      if (existingByLegacy) {
        if (existingByLegacy.status === "failed") {
          await ctx.db.patch(existingByLegacy._id, {
            status: "provisioning",
            errorMessage: undefined,
            updatedAt: Date.now(),
          });
          return existingByLegacy._id;
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
      if (args.legacyOrganizationId && existingBySlug.legacyOrganizationId !== args.legacyOrganizationId) {
        // Disambiguate slug by appending unique legacy ID suffix
        targetSlug = `${args.slug}-${args.legacyOrganizationId.substring(0, 8)}`;
      } else if (existingBySlug.status === "failed") {
        await ctx.db.patch(existingBySlug._id, {
          status: "provisioning",
          errorMessage: undefined,
          updatedAt: Date.now(),
        });
        return existingBySlug._id;
      } else {
        throw new Error(`Organization with slug "${args.slug}" already exists (status: ${existingBySlug.status}).`);
      }
    }

    return await ctx.db.insert("organizations", {
      name: args.name,
      slug: targetSlug,
      legacyOrganizationId: args.legacyOrganizationId,
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
      v.literal("deleting")
    ),
    projectId: v.optional(v.string()),
    deploymentId: v.optional(v.string()),
    deploymentUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated: Access denied.");
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated: Access denied.");
    }

    await ctx.db.delete(args.id);
  },
});
