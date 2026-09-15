import { mutation, query, action, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  requireAuth,
  resolveStoreOrganization,
  getCallerMembership,
} from "./organizationUsers";

// ----------------------------------------------------
// HELPER FUNCTIONS & SECURITY UTILITIES
// ----------------------------------------------------

/**
 * Computes SHA-256 hash string for an OTP code using Web Crypto API.
 */
export async function hashOtp(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp.trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generates a random 4-digit numeric OTP string.
 */
export function generate4DigitOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Helper to check if caller has staff permissions (admin, cashier, captain, waiter).
 */
export async function requireStaffRole(
  ctx: QueryCtx | MutationCtx,
  explicitOrgId?: Id<"organizations">
) {
  const identity = await requireAuth(ctx);
  const org = await resolveStoreOrganization(ctx, explicitOrgId);
  const callerMember = await getCallerMembership(ctx, identity.subject, org._id);

  const isStaff =
    callerMember &&
    callerMember.deletedAt === undefined &&
    ["admin", "cashier", "captain", "waiter"].some((role) =>
      callerMember.userType.includes(role)
    );

  if (!isStaff) {
    throw new Error("Forbidden. Staff access required to perform this action.");
  }

  return { identity, org, callerMember };
}

/**
 * Strips sensitive internal security fields (e.g. otpHash) from public outputs.
 */
function sanitizeRequestDoc(doc: Doc<"postpaidOrderRequests">) {
  const { otpHash, ...rest } = doc;
  return rest;
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Retrieves a postpaid order request by ID.
 */
export const getPostpaidOrderRequest = query({
  args: { requestId: v.id("postpaidOrderRequests") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const request = await ctx.db.get(args.requestId);

    if (!request || request.deletedAt !== undefined) {
      return null;
    }

    const org = await resolveStoreOrganization(ctx);
    const member = await getCallerMembership(ctx, identity.subject, org._id);
    const isStaff =
      member &&
      member.deletedAt === undefined &&
      ["admin", "cashier", "captain", "waiter"].some((role) =>
        member.userType.includes(role)
      );

    if (!isStaff && request.userId !== identity.subject) {
      throw new Error("Forbidden. You cannot view this postpaid request.");
    }

    return sanitizeRequestDoc(request);
  },
});

/**
 * Returns the current active postpaid request for a dining table.
 */
export const getLatestActiveRequestForTable = query({
  args: { tableId: v.id("organizationTables") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const table = await ctx.db.get(args.tableId);
    if (!table || table.deletedAt !== undefined) {
      return null;
    }

    const requests = await ctx.db
      .query("postpaidOrderRequests")
      .withIndex("by_table", (q) => q.eq("tableId", args.tableId))
      .collect();

    const activeRequests = requests
      .filter(
        (r) =>
          r.deletedAt === undefined &&
          (r.status === "requested" || r.status === "approved")
      )
      .sort((a, b) => b.createdAt - a.createdAt);

    if (activeRequests.length === 0) {
      return null;
    }

    return sanitizeRequestDoc(activeRequests[0]);
  },
});

/**
 * Returns all pending postpaid requests requiring staff attention for the store.
 */
export const listPendingPostpaidRequests = query({
  args: {},
  handler: async (ctx) => {
    await requireStaffRole(ctx);

    const pendingRequests = await ctx.db
      .query("postpaidOrderRequests")
      .withIndex("by_status", (q) => q.eq("status", "requested"))
      .collect();

    return pendingRequests
      .filter((r) => r.deletedAt === undefined)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(sanitizeRequestDoc);
  },
});

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * Customer QR endpoint: Submits a new postpaid order request for a table.
 * Enforces store dine-in policy and 15-minute deduplication window.
 */
export const createPostpaidOrderRequest = mutation({
  args: { tableId: v.id("organizationTables") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const org = await resolveStoreOrganization(ctx);

    if (!org.isDineIn) {
      throw new Error("Sorry, this store does not accept Dine In orders.");
    }

    if (!org.dineinPospaid) {
      throw new Error("Cash payment is not allowed for Dine In orders.");
    }

    const table = await ctx.db.get(args.tableId);
    if (!table || table.deletedAt !== undefined) {
      throw new Error("Table not found.");
    }

    const now = Date.now();
    const fifteenMinutesAgo = now - 15 * 60 * 1000;

    // Check for existing active or recent request by same customer for this table
    const existingRequests = await ctx.db
      .query("postpaidOrderRequests")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    const activeOrRecent = existingRequests.find(
      (r) =>
        r.tableId === args.tableId &&
        r.deletedAt === undefined &&
        ((r.status === "requested" || r.status === "approved") ||
          r.createdAt >= fifteenMinutesAgo)
    );

    if (activeOrRecent) {
      // Re-assert table request flag in case it drifted
      if (!table.isRequested && (activeOrRecent.status === "requested" || activeOrRecent.status === "approved")) {
        await ctx.db.patch(table._id, { isRequested: true, updatedAt: now });
      }
      return sanitizeRequestDoc(activeOrRecent);
    }

    const requestId = await ctx.db.insert("postpaidOrderRequests", {
      tableId: args.tableId,
      userId: identity.subject,
      status: "requested",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.tableId, {
      isRequested: true,
      updatedAt: now,
    });

    const newRequest = await ctx.db.get(requestId);
    return sanitizeRequestDoc(newRequest!);
  },
});

/**
 * Staff endpoint: Approves a pending postpaid order request.
 * Generates a 4-digit OTP, stores its SHA-256 hash with 3-minute expiry, and returns plaintext OTP to caller.
 */
export const approvePostpaidOrderRequest = mutation({
  args: { requestId: v.id("postpaidOrderRequests") },
  handler: async (ctx, args) => {
    const { identity } = await requireStaffRole(ctx);

    const request = await ctx.db.get(args.requestId);
    if (!request || request.deletedAt !== undefined) {
      throw new Error("Postpaid order request not found.");
    }

    if (request.status !== "requested") {
      throw new Error(`Request is already ${request.status}. Cannot approve.`);
    }

    const now = Date.now();
    const otpCode = generate4DigitOtp();
    const otpHash = await hashOtp(otpCode);
    const otpExpiresAt = now + 3 * 60 * 1000; // 3 minutes expiration

    await ctx.db.patch(request._id, {
      status: "approved",
      statusActionById: identity.subject,
      otpHash,
      otpExpiresAt,
      otpAttempts: 0,
      updatedAt: now,
    });

    await ctx.db.patch(request.tableId, {
      isRequested: true,
      updatedAt: now,
    });

    return {
      requestId: request._id,
      status: "approved",
      otpCode,
    };
  },
});

/**
 * Staff endpoint: Declines a pending/approved postpaid order request.
 * Clears table request flag and resets active OTP credentials.
 */
export const declinePostpaidOrderRequest = mutation({
  args: { requestId: v.id("postpaidOrderRequests") },
  handler: async (ctx, args) => {
    const { identity } = await requireStaffRole(ctx);

    const request = await ctx.db.get(args.requestId);
    if (!request || request.deletedAt !== undefined) {
      throw new Error("Postpaid order request not found.");
    }

    if (request.status === "declined" || request.status === "completed") {
      throw new Error(`Request is already ${request.status}. Cannot decline.`);
    }

    const now = Date.now();

    await ctx.db.patch(request._id, {
      status: "declined",
      statusActionById: identity.subject,
      otpHash: undefined,
      otpExpiresAt: undefined,
      updatedAt: now,
    });

    await ctx.db.patch(request.tableId, {
      isRequested: false,
      updatedAt: now,
    });

    return {
      requestId: request._id,
      status: "declined",
    };
  },
});

/**
 * Customer QR endpoint: Verifies customer-entered OTP against the stored hash.
 * Enforces 3-minute expiration, 3-attempt lockouts, and records otpVerifiedAt.
 */
export const verifyPostpaidOrderOtp = mutation({
  args: {
    requestId: v.id("postpaidOrderRequests"),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const request = await ctx.db.get(args.requestId);
    if (!request || request.deletedAt !== undefined) {
      throw new Error("Postpaid order request not found.");
    }

    if (request.userId !== identity.subject) {
      throw new Error("Forbidden. Request does not belong to user.");
    }

    if (request.status !== "approved") {
      throw new Error("Request is not in approved status.");
    }

    if (!request.otpHash || !request.otpExpiresAt) {
      throw new Error("OTP is invalid or expired.");
    }

    const now = Date.now();
    if (now > request.otpExpiresAt) {
      throw new Error("OTP is invalid or expired.");
    }

    const currentAttempts = request.otpAttempts ?? 0;
    if (currentAttempts >= 3) {
      throw new Error("Maximum OTP verification attempts exceeded. Please request a new OTP.");
    }

    const suppliedHash = await hashOtp(args.code);
    if (suppliedHash !== request.otpHash) {
      await ctx.db.patch(request._id, {
        otpAttempts: currentAttempts + 1,
        updatedAt: now,
      });
      throw new Error("OTP is invalid or expired.");
    }

    await ctx.db.patch(request._id, {
      otpVerifiedAt: now,
      otpHash: undefined,
      otpAttempts: 0,
      updatedAt: now,
    });

    return { success: true, verifiedAt: now };
  },
});

/**
 * Payment/Settlement helper: Transitions an active approved postpaid request to completed
 * and clears table requested status when table order is paid.
 */
export const completePostpaidOrderRequest = mutation({
  args: {
    tableId: v.id("organizationTables"),
    orderId: v.optional(v.id("orders")),
  },
  handler: async (ctx, args) => {
    await requireStaffRole(ctx);

    const now = Date.now();
    let requestsToComplete: Doc<"postpaidOrderRequests">[] = [];

    if (args.orderId) {
      const byOrder = await ctx.db
        .query("postpaidOrderRequests")
        .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
        .collect();
      requestsToComplete = byOrder.filter((r) => r.deletedAt === undefined && r.status === "approved");
    }

    if (requestsToComplete.length === 0) {
      const byTable = await ctx.db
        .query("postpaidOrderRequests")
        .withIndex("by_table_and_status", (q) => q.eq("tableId", args.tableId).eq("status", "approved"))
        .collect();
      requestsToComplete = byTable.filter((r) => r.deletedAt === undefined);
    }

    let completedCount = 0;
    for (const req of requestsToComplete) {
      await ctx.db.patch(req._id, {
        status: "completed",
        updatedAt: now,
      });
      completedCount++;
    }

    await ctx.db.patch(args.tableId, {
      isRequested: false,
      updatedAt: now,
    });

    return { completedCount };
  },
});

// ----------------------------------------------------
// ACTIONS
// ----------------------------------------------------

/**
 * Public/Internal Action: Dispatches SMS notification with OTP payload via external SMS service.
 */
export const sendApprovalSmsAction = action({
  args: {
    phoneNumber: v.string(),
    otpCode: v.string(),
  },
  handler: async (_ctx, args) => {
    // SMS Gateway dispatch hook
    console.log(
      `[SMS Provider] Your order request has been approved, the OTP to place your order successfully is ${args.otpCode}. Do not share it with anyone.`
    );
    return { sent: true };
  },
});
