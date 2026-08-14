import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("companies").order("desc").collect();
  },
});

export const get = query({
  args: { id: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("companies")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("companies")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      if (existing.status === "failed") {
        // Reset for retry
        await ctx.db.patch(existing._id, {
          status: "provisioning",
          errorMessage: undefined,
        });
        return existing._id;
      }
      throw new Error(`Company with slug "${args.slug}" already exists (status: ${existing.status}).`);
    }

    return await ctx.db.insert("companies", {
      name: args.name,
      slug: args.slug,
      status: "provisioning",
      createdAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("companies"),
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
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("companies") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
