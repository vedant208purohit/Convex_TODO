import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  companies: defineTable({
    name: v.string(),
    slug: v.string(),
    projectId: v.optional(v.string()),
    deploymentId: v.optional(v.string()),
    deploymentUrl: v.optional(v.string()),
    status: v.union(
      v.literal("provisioning"),
      v.literal("active"),
      v.literal("failed"),
      v.literal("deleting")
    ),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_slug", ["slug"]),
});
