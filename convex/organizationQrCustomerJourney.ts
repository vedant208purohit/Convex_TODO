import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { resolveStoreOrganization } from "./organizationUsers";

// ----------------------------------------------------
// TELEMETRY & CUSTOMER JOURNEY MUTATIONS
// ----------------------------------------------------

/**
 * Public mutation to record a customer QR scan event and initialize or refresh an ordering session.
 * Multi-store and multi-table isolation is guaranteed because the QR document is the authoritative identity.
 */
export const recordScan = mutation({
  args: {
    qrId: v.string(), // Accepts Convex Id<"organizationQrCodes">, legacyId, or valid string ID
    existingSessionId: v.optional(v.string()),
    deviceType: v.optional(v.string()),
    os: v.optional(v.string()),
    browser: v.optional(v.string()),
    screenResolution: v.optional(v.string()),
    language: v.optional(v.string()),
    referrer: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // 1. Authoritatively resolve QR document from database
    let qrDoc: Doc<"organizationQrCodes"> | null = null;

    // 1.1 Direct Convex ID lookup
    try {
      const doc = (await ctx.db.get(
        args.qrId as Id<"organizationQrCodes">
      )) as any;
      if (doc && doc.qrType !== undefined && doc.deletedAt === undefined) {
        qrDoc = doc as Doc<"organizationQrCodes">;
      }
    } catch {
      // Ignore invalid Convex ID string format
    }

    // 1.2 Lookup by legacyId if not found
    if (!qrDoc) {
      const legacyMatches = await ctx.db
        .query("organizationQrCodes")
        .withIndex("by_legacy_id", (q) => q.eq("legacyId", args.qrId))
        .collect();
      qrDoc = legacyMatches.find((q) => q.deletedAt === undefined) ?? null;
    }

    // 1.3 Lookup by tableId if not found
    if (!qrDoc) {
      const tableQrs = await ctx.db
        .query("organizationQrCodes")
        .withIndex("by_table", (q) => q.eq("tableId", args.qrId))
        .collect();
      qrDoc = tableQrs.find((q) => q.deletedAt === undefined) ?? null;
    }

    if (!qrDoc || qrDoc.deletedAt !== undefined) {
      throw new Error(`QR code '${args.qrId}' not found or inactive.`);
    }

    // 2. Authoritatively resolve organizationId
    let orgId: Id<"organizations">;
    if (qrDoc.organizationId) {
      orgId = qrDoc.organizationId;
    } else {
      const resolvedOrg = await resolveStoreOrganization(ctx);
      orgId = resolvedOrg._id;
    }

    // 3. Authoritatively resolve tableId for DineIn QR codes
    const effectiveTableId =
      qrDoc.qrType === "DineIn" ? qrDoc.tableId ?? undefined : undefined;

    // 4. Increment the QR code physical scan counter
    const updatedCounter = (qrDoc.counter ?? 0) + 1;
    await ctx.db.patch(qrDoc._id, {
      counter: updatedCounter,
      updatedAt: now,
    });

    // 5. Create or reuse active ordering session
    let sessionDoc: Doc<"organizationOrderingSessions"> | null = null;

    if (args.existingSessionId) {
      try {
        const existing = await ctx.db.get(
          args.existingSessionId as Id<"organizationOrderingSessions">
        );
        if (
          existing &&
          existing.deletedAt === undefined &&
          existing.status === "active" &&
          existing.qrId === qrDoc._id &&
          existing.organizationId === orgId
        ) {
          sessionDoc = existing;
          await ctx.db.patch(existing._id, {
            lastActivityAt: now,
            updatedAt: now,
          });
        }
      } catch {
        // Invalid session ID ignored
      }
    }

    if (!sessionDoc) {
      const newSessionId = await ctx.db.insert("organizationOrderingSessions", {
        organizationId: orgId,
        qrId: qrDoc._id,
        tableId: effectiveTableId,
        qrType: qrDoc.qrType,
        status: "active",
        cartItemCount: 0,
        firstScanAt: now,
        lastActivityAt: now,
        deviceType: args.deviceType,
        browser: args.browser,
        os: args.os,
        createdAt: now,
        updatedAt: now,
      });
      sessionDoc = (await ctx.db.get(newSessionId))!;
    }

    // 6. Record Scan Event Telemetry Audit Log
    const scanId = await ctx.db.insert("organizationQrScans", {
      organizationId: orgId,
      qrId: qrDoc._id,
      tableId: effectiveTableId,
      sessionId: sessionDoc._id,
      deviceType: args.deviceType,
      os: args.os,
      browser: args.browser,
      screenResolution: args.screenResolution,
      language: args.language,
      referrer: args.referrer,
      ipAddress: args.ipAddress,
      latitude: args.latitude,
      longitude: args.longitude,
      createdAt: now,
    });

    return {
      success: true,
      sessionId: sessionDoc._id,
      scanId,
      qrId: qrDoc._id,
      organizationId: orgId,
      tableId: effectiveTableId,
      qrType: qrDoc.qrType,
      tableNumber: qrDoc.tableNumber,
      scanCount: updatedCounter,
    };
  },
});

/**
 * Public mutation to record cart item quantity changes during an active customer ordering session.
 */
export const recordCartActivity = mutation({
  args: {
    sessionId: v.id("organizationOrderingSessions"),
    itemCount: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const session = await ctx.db.get(args.sessionId);

    if (!session || session.deletedAt !== undefined) {
      return { success: false, reason: "Session not found or inactive" };
    }

    if (session.status !== "active") {
      return { success: false, reason: `Session is ${session.status}` };
    }

    const safeItemCount = Math.max(0, Math.floor(args.itemCount));

    await ctx.db.patch(args.sessionId, {
      cartItemCount: safeItemCount,
      lastActivityAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      sessionId: args.sessionId,
      cartItemCount: safeItemCount,
    };
  },
});

/**
 * Public mutation to attribute a successfully placed store order to the customer's QR session.
 * Guaranteed idempotent to protect against payment/webhook retries or page refreshes.
 */
export const recordOrderConversion = mutation({
  args: {
    sessionId: v.id("organizationOrderingSessions"),
    qrId: v.id("organizationQrCodes"),
    orderId: v.id("orders"),
    totalAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // 1. Verify that the order exists
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    // 2. Verify that the ordering session exists
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.deletedAt !== undefined) {
      throw new Error("Ordering session not found");
    }

    // 3. Idempotency Check: if already converted for this order, return existing conversion
    if (session.status === "converted" && session.orderId === args.orderId) {
      return {
        success: true,
        alreadyConverted: true,
        sessionId: session._id,
        orderId: order._id,
        totalAmount: session.orderTotalAmount ?? order.totalAmount,
      };
    }

    const finalAmount = args.totalAmount ?? order.totalAmount;

    await ctx.db.patch(args.sessionId, {
      status: "converted",
      orderId: order._id,
      orderTotalAmount: finalAmount,
      convertedAt: now,
      lastActivityAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      sessionId: session._id,
      orderId: order._id,
      totalAmount: finalAmount,
    };
  },
});

// ----------------------------------------------------
// ANALYTICS & INSPECTION QUERIES
// ----------------------------------------------------

/**
 * Public query to fetch session information.
 */
export const getSession = query({
  args: { id: v.id("organizationOrderingSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session || session.deletedAt !== undefined) {
      return null;
    }
    return session;
  },
});

/**
 * Query all scans recorded for a specific QR code.
 */
export const listScansByQr = query({
  args: { qrId: v.id("organizationQrCodes") },
  handler: async (ctx, args) => {
    const scans = await ctx.db
      .query("organizationQrScans")
      .withIndex("by_qr_id", (q) => q.eq("qrId", args.qrId))
      .collect();

    return scans.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Query all ordering sessions for a specific QR code.
 */
export const listSessionsByQr = query({
  args: { qrId: v.id("organizationQrCodes") },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("organizationOrderingSessions")
      .withIndex("by_qr_id", (q) => q.eq("qrId", args.qrId))
      .collect();

    return sessions
      .filter((s) => s.deletedAt === undefined)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Computes QR analytics summary for an organization or specific QR code.
 */
export const getQrAnalyticsSummary = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    qrId: v.optional(v.id("organizationQrCodes")),
  },
  handler: async (ctx, args) => {
    let scans = await ctx.db.query("organizationQrScans").collect();
    let sessions = await ctx.db.query("organizationOrderingSessions").collect();

    if (args.qrId) {
      scans = scans.filter((s) => s.qrId === args.qrId);
      sessions = sessions.filter((s) => s.qrId === args.qrId);
    } else if (args.organizationId) {
      scans = scans.filter((s) => s.organizationId === args.organizationId);
      sessions = sessions.filter((s) => s.organizationId === args.organizationId);
    }

    const totalScans = scans.length;
    const totalSessions = sessions.length;
    const convertedSessions = sessions.filter((s) => s.status === "converted");
    const totalConversions = convertedSessions.length;
    const totalRevenuePaise = convertedSessions.reduce(
      (sum, s) => sum + (s.orderTotalAmount ?? 0),
      0
    );
    const conversionRate =
      totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0;

    return {
      totalScans,
      totalSessions,
      totalConversions,
      conversionRate: Number(conversionRate.toFixed(2)),
      totalRevenuePaise,
    };
  },
});
