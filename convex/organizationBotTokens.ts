import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAuth, resolveStoreOrganization, getCallerMembership, requireMember } from "./organizationUsers";

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
  const identity = await requireAuth(ctx);
  const org = await resolveStoreOrganization(ctx, explicitOrgId);
  const callerMember = await getCallerMembership(ctx, identity.subject, org._id);

  if (
    !callerMember ||
    (!callerMember.userType.includes("admin") &&
      !callerMember.userType.includes("cashier"))
  ) {
    throw new Error("Forbidden. Admin or Cashier access required.");
  }

  return { identity, org, callerMember };
}

// ----------------------------------------------------
// BOT USER & TOKEN PROVISIONING HELPERS
// ----------------------------------------------------

/**
 * Generates a random UUID v4 token string.
 */
export function generateTokenString(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback random UUID v4 string
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Ensures token string uniqueness across active and soft-deleted records.
 */
export async function ensureUniqueToken(
  ctx: QueryCtx | MutationCtx,
  candidateToken?: string
): Promise<string> {
  let token = candidateToken?.trim() || generateTokenString();

  let existing = await ctx.db
    .query("organizationBotTokens")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();

  while (existing !== null) {
    token = generateTokenString();
    existing = await ctx.db
      .query("organizationBotTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
  }

  return token;
}

/**
 * Provisions a guest Bot User identity and binds an organizationUsers record with userType ["bot"].
 */
export async function provisionBotUser(
  ctx: MutationCtx,
  orgId: Id<"organizations">
): Promise<string> {
  const botUserId = `bot_user_${generateTokenString()}`;

  await ctx.db.insert("organizationUsers", {
    organizationId: orgId,
    userId: botUserId,
    userType: ["bot"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return botUserId;
}

/**
 * Formats doc into safe response representation.
 */
export function toTokenResponse(doc: Doc<"organizationBotTokens">) {
  const tokenPrefix = doc.token ? doc.token.slice(0, 8) + "..." : undefined;

  return {
    _id: doc._id,
    legacyId: doc.legacyId,
    token: doc.token,
    tokenPrefix,
    env: doc.env,
    userId: doc.userId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Authenticated query listing active bot tokens for the store.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("organizationBotTokens").collect();
    const active = all.filter((t) => t.deletedAt === undefined);

    active.sort((a, b) => {
      if (b.createdAt !== a.createdAt) {
        return b.createdAt - a.createdAt;
      }
      return b._creationTime - a._creationTime;
    });

    return active.map(toTokenResponse);
  },
});

/**
 * Authenticated query fetching single active bot token by ID.
 */
export const get = query({
  args: { id: v.id("organizationBotTokens") },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    const doc = await ctx.db.get(args.id);
    if (!doc || doc.deletedAt !== undefined) {
      return null;
    }

    return toTokenResponse(doc);
  },
});

/**
 * Server-side V4 API authentication query validating an incoming Organization-Bot-Token header.
 */
export const validateBotToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const rawToken = args.token.trim();
    if (!rawToken) {
      return { valid: false, reason: "Missing token" };
    }

    const doc = await ctx.db
      .query("organizationBotTokens")
      .withIndex("by_token", (q) => q.eq("token", rawToken))
      .first();

    if (!doc || doc.deletedAt !== undefined) {
      return { valid: false, reason: "Invalid or revoked token" };
    }

    const orgs = await ctx.db.query("organizations").collect();
    const activeOrg = orgs.find((o) => o.deletedAt === undefined);

    if (!activeOrg) {
      return { valid: false, reason: "Store organization not found" };
    }

    return {
      valid: true,
      botTokenId: doc._id,
      userId: doc.userId,
      env: doc.env,
      organization: {
        _id: activeOrg._id,
        name: activeOrg.name,
        slug: activeOrg.slug,
      },
    };
  },
});

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * Issues a new organization bot token and provisions dedicated Bot User membership.
 */
export const create = mutation({
  args: {
    token: v.optional(v.string()),
    env: v.optional(v.string()),
    userId: v.optional(v.string()),
    legacyId: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { org } = await requireAdminOrCashier(ctx);

    const now = Date.now();
    const effectiveToken = await ensureUniqueToken(ctx, args.token);

    let effectiveUserId = args.userId;
    if (!effectiveUserId) {
      effectiveUserId = await provisionBotUser(ctx, org._id);
    }

    const docId = await ctx.db.insert("organizationBotTokens", {
      legacyId: args.legacyId,
      token: effectiveToken,
      env: args.env?.trim() || undefined,
      userId: effectiveUserId,
      createdAt: args.createdAt ?? now,
      updatedAt: args.updatedAt ?? now,
    });

    const created = (await ctx.db.get(docId))!;
    return toTokenResponse(created);
  },
});

/**
 * Updates env designation of an existing bot token.
 */
export const update = mutation({
  args: {
    id: v.id("organizationBotTokens"),
    env: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Organization bot token not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      env: args.env !== undefined ? args.env.trim() || undefined : existing.env,
      updatedAt: now,
    });

    const updated = (await ctx.db.get(args.id))!;
    return toTokenResponse(updated);
  },
});

/**
 * Soft deletes / revokes an organization bot token.
 */
export const remove = mutation({
  args: { id: v.id("organizationBotTokens") },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Organization bot token not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      deletedAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});
