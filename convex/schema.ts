import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    legacyOrganizationId: v.optional(v.string()), // PostgreSQL Organization UUID
    ownerClerkId: v.optional(v.string()), // Clerk User ID of Store Creator/Owner
    projectId: v.optional(v.string()),
    deploymentId: v.optional(v.string()),
    deploymentUrl: v.optional(v.string()),
    status: v.union(
      v.literal("provisioning"),
      v.literal("active"),
      v.literal("failed"),
      v.literal("deleting"),
      v.literal("deleted")
    ),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_legacy_organization_id", ["legacyOrganizationId"])
    .index("by_status", ["status"]),

  features: defineTable({
    name: v.string(),
    displayName: v.string(),
    description: v.optional(v.string()),
    displayDescription: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  }).index("by_name", ["name"]),
});
