import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

// ----------------------------------------------------
// VALID USER TYPES & DEFAULT PERMISSIONS
// ----------------------------------------------------

export const VALID_USER_TYPES = [
  "admin",
  "cashier",
  "captain",
  "waiter",
  "chef",
  "worker",
  "customer",
  "customer_data",
  "bot",
  "dashboard",
  "orders",
  "menu",
  "kds",
  "queue",
  "inventory",
  "report",
  "survey",
] as const;

export type ValidUserType = (typeof VALID_USER_TYPES)[number];

export const DEFAULT_PERMISSIONS: Record<
  string,
  { create: boolean; read: boolean; update: boolean; delete: boolean }
> = {
  admin: { create: true, read: true, update: true, delete: true },
  captain: { create: true, read: true, update: true, delete: true },
  waiter: { create: true, read: true, update: true, delete: true },
  worker: { create: true, read: true, update: true, delete: true },
  cashier: { create: true, read: true, update: true, delete: true },
  customer: { create: true, read: true, update: true, delete: true },
  customer_data: { create: true, read: true, update: true, delete: true },
  chef: { create: true, read: true, update: true, delete: true },
  dashboard: { create: true, read: true, update: true, delete: true },
  orders: { create: true, read: true, update: true, delete: true },
  menu: { create: true, read: true, update: true, delete: true },
  kds: { create: true, read: true, update: true, delete: true },
  queue: { create: true, read: true, update: true, delete: true },
  inventory: { create: true, read: true, update: true, delete: true },
  report: { create: true, read: true, update: true, delete: true },
  survey: { create: true, read: true, update: true, delete: true },
  bot: { create: true, read: true, update: true, delete: true },
};

// ----------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------

/**
 * Validates and normalizes user type strings against allowed list
 */
export function validateAndNormalizeUserTypes(types: string[]): string[] {
  if (!Array.isArray(types) || types.length === 0) {
    throw new Error("User types cannot be empty");
  }

  const validSet = new Set<string>(VALID_USER_TYPES);
  const normalizedSet = new Set<string>();

  for (const t of types) {
    const trimmed = (t || "").trim().toLowerCase();
    if (!trimmed) {
      throw new Error("User type cannot be blank");
    }
    if (!validSet.has(trimmed)) {
      throw new Error(`Invalid user type: ${t}`);
    }
    normalizedSet.add(trimmed);
  }

  return Array.from(normalizedSet);
}

/**
 * Automatically synchronizes granular CRUD permissions based on userType array.
 * Mirrors legacy Rails `update_permissions` callback:
 * - Injects default CRUD permissions for newly assigned roles.
 * - Prunes (`slice!`) permission keys for roles that are no longer assigned.
 */
export function syncPermissions(
  userType: string[],
  existingPermissions?: Record<string, any> | null
): Record<string, { create: boolean; read: boolean; update: boolean; delete: boolean }> {
  const currentPermissions: Record<string, any> = { ...(existingPermissions || {}) };

  for (const type of userType) {
    if (!currentPermissions[type] && DEFAULT_PERMISSIONS[type]) {
      currentPermissions[type] = { ...DEFAULT_PERMISSIONS[type] };
    }
  }

  // Prune any permissions not in userType
  const userTypeSet = new Set(userType);
  for (const key of Object.keys(currentPermissions)) {
    if (!userTypeSet.has(key)) {
      delete currentPermissions[key];
    }
  }

  return currentPermissions;
}

/**
 * Centralized admin role validator supporting standard store & system admin role tags
 */
export function isAdminRole(role?: string | null): boolean {
  if (!role || typeof role !== "string") return false;
  const normalizedRole = role.trim().toLowerCase();
  return [
    "admin",
    "store_admin",
    "org_admin",
    "super_admin",
  ].includes(normalizedRole);
}

/**
 * Requires an authenticated user from Clerk JWT
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated. Please provide a valid authentication token.");
  }
  return identity;
}

/**
 * Resolves the primary store organization for this isolated deployment
 */
export async function resolveStoreOrganization(
  ctx: QueryCtx | MutationCtx,
  explicitOrgId?: Id<"organizations">
): Promise<Doc<"organizations">> {
  if (explicitOrgId) {
    const org = await ctx.db.get(explicitOrgId);
    if (!org || org.deletedAt !== undefined) {
      throw new Error("Organization not found");
    }
    return org;
  }

  const firstOrg = await ctx.db.query("organizations").first();
  if (!firstOrg || firstOrg.deletedAt !== undefined) {
    throw new Error("Store organization not initialized");
  }
  return firstOrg;
}

/**
 * Resolves caller's active membership in the target organization
 */
export async function getCallerMembership(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  organizationId: Id<"organizations">
): Promise<Doc<"organizationUsers"> | null> {
  const member = await ctx.db
    .query("organizationUsers")
    .withIndex("by_user_and_org", (q) =>
      q.eq("userId", userId).eq("organizationId", organizationId)
    )
    .first();

  if (!member || member.deletedAt !== undefined) {
    return null;
  }
  return member;
}

/**
 * Counts the number of active admins in an organization
 */
export async function countActiveAdmins(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">
): Promise<number> {
  const allMembers = await ctx.db
    .query("organizationUsers")
    .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
    .collect();

  return allMembers.filter(
    (m) => m.deletedAt === undefined && m.userType.some((r) => isAdminRole(r))
  ).length;
}

/**
 * Requires caller to be an active admin of the target organization
 */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
  explicitOrgId?: Id<"organizations">
) {
  const identity = await requireAuth(ctx);
  const org = await resolveStoreOrganization(ctx, explicitOrgId);

  // 1. Primary Authorization: Database store membership record
  let callerMember = await getCallerMembership(ctx, identity.subject, org._id);

  // 2. Store Owner / Pre-existing Store Repair Check
  const isStoreOwnerOrUnowned = Boolean(
    !org.ownerClerkId || org.ownerClerkId === identity.subject
  );

  const callerRoles = Array.isArray(callerMember?.userType)
    ? callerMember.userType
    : typeof callerMember?.userType === "string"
      ? [callerMember.userType]
      : [];

  const isMemberAdmin = Boolean(
    callerMember && callerRoles.some((role) => isAdminRole(role))
  );

  // 3. Secondary Authorization: Trusted identity claim role (if present on auth identity)
  const tokenRole = (identity as any).role ? String((identity as any).role) : undefined;
  const isTokenAdmin = isAdminRole(tokenRole);

  if (!isMemberAdmin && !isStoreOwnerOrUnowned && !isTokenAdmin) {
    throw new Error("Forbidden. Admin access required.");
  }

  // Auto-repair/seed store owner membership & backfill ownerClerkId if missing
  if (isStoreOwnerOrUnowned && "insert" in ctx.db) {
    const now = Date.now();

    // Backfill ownerClerkId on organization document if missing
    if (!org.ownerClerkId && "patch" in ctx.db) {
      await (ctx as MutationCtx).db.patch(org._id, {
        ownerClerkId: identity.subject,
        updatedAt: now,
      });
    }

    if (!callerMember) {
      const newId = await (ctx as MutationCtx).db.insert("organizationUsers", {
        organizationId: org._id,
        userId: identity.subject,
        userType: ["admin"],
        userPermission: {
          admin: { create: true, read: true, update: true, delete: true },
        },
        createdAt: now,
        updatedAt: now,
      });
      callerMember = await ctx.db.get(newId);
    }
  }

  return {
    identity,
    org,
    organization: org,
    callerMember,
    membership: callerMember,
  };
}

/**
 * Requires caller to be an active member of the target organization
 */
export async function requireMember(
  ctx: QueryCtx | MutationCtx,
  explicitOrgId?: Id<"organizations">
) {
  const identity = await requireAuth(ctx);
  const org = await resolveStoreOrganization(ctx, explicitOrgId);
  const callerMember = await getCallerMembership(ctx, identity.subject, org._id);

  const isOwnerOrUnowned = !org.ownerClerkId || org.ownerClerkId === identity.subject;

  if (!callerMember && !isOwnerOrUnowned) {
    throw new Error("Forbidden. Active store membership required.");
  }

  return {
    identity,
    org,
    organization: org,
    callerMember,
    membership: callerMember,
  };
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Fetches the active organization membership for the currently authenticated caller
 */
export const getCurrentMembership = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    let org: Doc<"organizations"> | null = null;
    try {
      org = await resolveStoreOrganization(ctx, args.organizationId);
    } catch {
      return null;
    }

    const member = await getCallerMembership(ctx, identity.subject, org._id);
    if (member) {
      // Normalize userType if stored as a single string in legacy records
      const normalizedUserType = Array.isArray(member.userType)
        ? member.userType
        : typeof member.userType === "string"
          ? [member.userType]
          : ["admin"];
      return {
        ...member,
        userType: normalizedUserType,
      };
    }

    // Return owner membership document if authenticated identity matches store ownerClerkId or if store ownerClerkId is unassigned
    const isOwnerOrUnowned = !org.ownerClerkId || org.ownerClerkId === identity.subject;
    if (isOwnerOrUnowned) {
      return {
        _id: org._id as any,
        organizationId: org._id,
        userId: identity.subject,
        userType: ["admin"],
        userPermission: {
          admin: { create: true, read: true, update: true, delete: true },
        },
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
      };
    }

    return null;
  },
});

/**
 * Fetches a single organization user by document ID
 */
export const get = query({
  args: {
    id: v.id("organizationUsers"),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.id);
    if (!member || member.deletedAt !== undefined) return null;

    // Caller must be authenticated and belong to the organization
    await requireMember(ctx, member.organizationId);

    return member;
  },
});

/**
 * Fetches an active organization user by Clerk userId
 */
export const getByUserId = query({
  args: {
    userId: v.string(),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const org = await resolveStoreOrganization(ctx, args.organizationId);
    await requireMember(ctx, org._id);

    return await getCallerMembership(ctx, args.userId, org._id);
  },
});

/**
 * Lists all active members of the store organization.
 * By default, excludes customer-only records (matching staff list PRD semantics).
 */
export const list = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    includeCustomers: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const org = await resolveStoreOrganization(ctx, args.organizationId);
    await requireMember(ctx, org._id);

    const members = await ctx.db
      .query("organizationUsers")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .collect();

    const activeMembers = members.filter((m) => m.deletedAt === undefined);

    if (args.includeCustomers === true) {
      return activeMembers;
    }

    // Exclude records whose only role is 'customer' or 'bot'
    return activeMembers.filter((m) => {
      const nonStaffRoles = m.userType.filter(
        (t) => t !== "customer" && t !== "customer_data" && t !== "bot"
      );
      return nonStaffRoles.length > 0;
    });
  },
});

/**
 * Searches active organization members by userType
 */
export const search = query({
  args: {
    userType: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const org = await resolveStoreOrganization(ctx, args.organizationId);
    await requireMember(ctx, org._id);

    const members = await ctx.db
      .query("organizationUsers")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .collect();

    let active = members.filter((m) => m.deletedAt === undefined);

    if (args.userType) {
      const targetType = args.userType.trim().toLowerCase();
      active = active.filter((m) => m.userType.includes(targetType));
    }

    return active;
  },
});

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * Creates a new OrganizationUser record (Staff onboarding)
 */
export const create = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    userId: v.string(), // Clerk User ID
    userType: v.array(v.string()),
    userPermission: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    if (!args.userId || !args.userId.trim()) {
      throw new Error("User ID is required");
    }

    const org = await resolveStoreOrganization(ctx, args.organizationId);

    // Authorization: If members already exist, require admin rights.
    // If no active members exist in the store, allow initial bootstrapping.
    const allMembers = await ctx.db
      .query("organizationUsers")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .collect();

    const activeMembers = allMembers.filter((m) => m.deletedAt === undefined);
    if (activeMembers.length > 0) {
      await requireAdmin(ctx, org._id);
    }

    const normalizedTypes = validateAndNormalizeUserTypes(args.userType);

    // Check for duplicate active membership
    const existing = await getCallerMembership(ctx, args.userId.trim(), org._id);
    if (existing) {
      throw new Error(
        `User "${args.userId}" is already a member of ${org.name}.`
      );
    }

    const now = Date.now();
    const finalPermissions = syncPermissions(
      normalizedTypes,
      args.userPermission
    );

    const newId = await ctx.db.insert("organizationUsers", {
      organizationId: org._id,
      userId: args.userId.trim(),
      userType: normalizedTypes,
      userPermission: finalPermissions,
      createdAt: now,
      updatedAt: now,
    });

    return newId;
  },
});

/**
 * Updates roles and/or custom permissions for an existing member
 */
export const update = mutation({
  args: {
    id: v.id("organizationUsers"),
    userType: v.optional(v.array(v.string())),
    userPermission: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.id);
    if (!member || member.deletedAt !== undefined) {
      throw new Error("Organization user not found");
    }

    await requireAdmin(ctx, member.organizationId);

    let updatedTypes = member.userType;
    if (args.userType !== undefined) {
      updatedTypes = validateAndNormalizeUserTypes(args.userType);

      // Sole Admin Protection: If removing admin role, ensure another admin remains
      if (member.userType.includes("admin") && !updatedTypes.includes("admin")) {
        const adminCount = await countActiveAdmins(ctx, member.organizationId);
        if (adminCount <= 1) {
          throw new Error("Cannot remove the sole admin of the organization.");
        }
      }
    }

    const updatedPermissions = syncPermissions(
      updatedTypes,
      args.userPermission !== undefined ? args.userPermission : member.userPermission
    );

    const now = Date.now();
    await ctx.db.patch(args.id, {
      userType: updatedTypes,
      userPermission: updatedPermissions,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Adds new userType roles to an existing organization user
 */
export const addType = mutation({
  args: {
    id: v.id("organizationUsers"),
    types: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.id);
    if (!member || member.deletedAt !== undefined) {
      throw new Error("Organization user not found");
    }

    await requireAdmin(ctx, member.organizationId);

    const typesToAdd = validateAndNormalizeUserTypes(args.types);
    const combinedTypes = Array.from(new Set([...member.userType, ...typesToAdd]));

    const updatedPermissions = syncPermissions(combinedTypes, member.userPermission);
    const now = Date.now();

    await ctx.db.patch(args.id, {
      userType: combinedTypes,
      userPermission: updatedPermissions,
      updatedAt: now,
    });

    return { success: true, userType: combinedTypes };
  },
});

/**
 * Removes specified userType roles from an existing organization user.
 * If userType becomes empty, soft-deletes the record.
 */
export const removeType = mutation({
  args: {
    id: v.id("organizationUsers"),
    types: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.id);
    if (!member || member.deletedAt !== undefined) {
      throw new Error("Organization user not found");
    }

    await requireAdmin(ctx, member.organizationId);

    const typesToRemove = new Set(
      args.types.map((t) => (t || "").trim().toLowerCase())
    );

    // Sole Admin Protection
    if (typesToRemove.has("admin") && member.userType.includes("admin")) {
      const adminCount = await countActiveAdmins(ctx, member.organizationId);
      if (adminCount <= 1) {
        throw new Error("Cannot remove the sole admin of the organization.");
      }
    }

    const remainingTypes = member.userType.filter((t) => !typesToRemove.has(t));
    const now = Date.now();

    // Legacy Business Rule: If userType becomes empty, soft-delete the record
    if (remainingTypes.length === 0) {
      await ctx.db.patch(args.id, {
        userType: [],
        deletedAt: now,
        updatedAt: now,
      });
      return { success: true, deleted: true, userType: [] };
    }

    const updatedPermissions = syncPermissions(remainingTypes, member.userPermission);

    await ctx.db.patch(args.id, {
      userType: remainingTypes,
      userPermission: updatedPermissions,
      updatedAt: now,
    });

    return { success: true, deleted: false, userType: remainingTypes };
  },
});

/**
 * Soft deletes an organization user membership.
 * Enforces:
 * 1. Self-Removal Prevention: "Sorry, you can't remove yourself"
 * 2. Sole Admin Protection: "Cannot remove the sole admin of the organization."
 */
export const remove = mutation({
  args: {
    id: v.id("organizationUsers"),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.id);
    if (!member || member.deletedAt !== undefined) {
      throw new Error("Organization user not found");
    }

    const { identity } = await requireAdmin(ctx, member.organizationId);

    // 1. Self-Removal Prevention
    if (member.userId === identity.subject) {
      throw new Error("Sorry, you can't remove yourself");
    }

    // 2. Sole Admin Protection
    if (member.userType.includes("admin")) {
      const adminCount = await countActiveAdmins(ctx, member.organizationId);
      if (adminCount <= 1) {
        throw new Error("Cannot remove the sole admin of the organization.");
      }
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      deletedAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});
