import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireMember } from "./organizationUsers";

// Session inactivity threshold: 30 minutes in milliseconds
const SESSION_ACTIVITY_WINDOW_MS = 30 * 60 * 1000;

// Helper to generate readable random ID strings if not provided
function generateId(prefix: string): string {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}_${rand}`;
}

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * 1. Record Scan & Manage Session Journey
 * When a customer scans a QR code:
 * - Checks if QR is active. If inactive, rejects with QR_INACTIVE.
 * - Increments scan counter on QR code.
 * - Reuses existing session if active and within 30-minute activity window, or creates a new session.
 * - Records a telemetry scan event in organizationQrScans.
 */
export const recordScan = mutation({
  args: {
    qrId: v.string(),
    sessionId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    deviceType: v.optional(v.string()),
    os: v.optional(v.string()),
    browser: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    region: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    referrer: v.optional(v.string()),
    screenResolution: v.optional(v.string()),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let qr: Doc<"organizationQrCodes"> | null = null;
    try {
      qr = await ctx.db.get(args.qrId as Id<"organizationQrCodes">);
    } catch {
      // Ignore format error
    }

    if (!qr) {
      const legacyMatches = await ctx.db
        .query("organizationQrCodes")
        .withIndex("by_legacy_id", (q) => q.eq("legacyId", args.qrId))
        .collect();
      qr = legacyMatches.find((q) => q.deletedAt === undefined) ?? null;
    }

    if (!qr) {
      const tableQrs = await ctx.db
        .query("organizationQrCodes")
        .withIndex("by_table", (q) => q.eq("tableId", args.qrId))
        .collect();
      qr = tableQrs.find((q) => q.deletedAt === undefined) ?? null;
    }

    if (!qr || qr.deletedAt !== undefined) {
      throw new Error("QR_NOT_FOUND");
    }

    const currentStatus = qr.status ?? "ACTIVE";
    if (currentStatus === "INACTIVE") {
      throw new Error("QR_INACTIVE");
    }

    const now = Date.now();

    // 1. Increment QR scan counter
    await ctx.db.patch(qr._id, {
      counter: (qr.counter ?? 0) + 1,
      updatedAt: now,
    });

    let effectiveSessionId: string | null = null;
    let existingSession: Doc<"organizationOrderingSessions"> | null = null;

    // 2. Check provided sessionId or find active existing session
    if (args.sessionId) {
      const sessions = await ctx.db
        .query("organizationOrderingSessions")
        .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId!))
        .collect();

      const activeMatch = sessions.find(
        (s) => s.qrId === qr._id && s.deletedAt === undefined && s.status === "ACTIVE",
      );

      if (activeMatch) {
        existingSession = activeMatch;
        effectiveSessionId = activeMatch.sessionId;
      }
    }

    // If no session ID passed or previous session expired, check recent session for QR
    if (!effectiveSessionId) {
      const recentSessions = await ctx.db
        .query("organizationOrderingSessions")
        .withIndex("by_qr", (q) => q.eq("qrId", qr._id))
        .collect();

      const validRecent = recentSessions.find(
        (s) =>
          s.deletedAt === undefined &&
          s.status === "ACTIVE" &&
          now - s.lastActivityAt <= SESSION_ACTIVITY_WINDOW_MS,
      );

      if (validRecent) {
        existingSession = validRecent;
        effectiveSessionId = validRecent.sessionId;
      }
    }

    // Create a new session if none can be reused
    if (!effectiveSessionId || !existingSession) {
      effectiveSessionId = args.sessionId || generateId("session");

      await ctx.db.insert("organizationOrderingSessions", {
        sessionId: effectiveSessionId,
        qrId: qr._id,
        organizationId: qr.organizationId,
        tableId: qr.tableId,
        status: "ACTIVE",
        startedAt: now,
        lastActivityAt: now,
      });
    } else {
      // Update activity timestamp on existing session
      await ctx.db.patch(existingSession._id, {
        lastActivityAt: now,
      });
    }

    // 3. Log scan telemetry event with rich telemetry
    const scanDocId = await ctx.db.insert("organizationQrScans", {
      qrId: qr._id,
      organizationId: qr.organizationId,
      tableId: qr.tableId,
      sessionId: effectiveSessionId,
      scannedAt: now,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      deviceType: args.deviceType,
      os: args.os,
      browser: args.browser,
      city: args.city,
      country: args.country,
      region: args.region,
      latitude: args.latitude,
      longitude: args.longitude,
      referrer: args.referrer,
      screenResolution: args.screenResolution,
      language: args.language,
    });

    return {
      scanId: scanDocId,
      qrId: qr._id,
      sessionId: effectiveSessionId,
      tableId: qr.tableId,
      scannedAt: new Date(now).toISOString(),
    };
  },
});

/**
 * 2. Record Cart Activity
 * When a customer adds/modifies items in their cart:
 * - Associates cart with session_id, qr_id, organizationId, tableId.
 * - Tracks item count and whether the session has created a cart (hasItems = itemCount > 0).
 */
export const recordCartActivity = mutation({
  args: {
    sessionId: v.string(),
    cartId: v.optional(v.string()),
    itemCount: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let activeSession: Doc<"organizationOrderingSessions"> | null = null;

    // 1. Try direct Convex ID lookup first
    try {
      const doc = await ctx.db.get(args.sessionId as Id<"organizationOrderingSessions">);
      if (doc && doc.deletedAt === undefined) {
        activeSession = doc;
      }
    } catch {
      // Ignore if string is not a valid Convex Id format
    }

    // 2. Fallback to index search by sessionId string field
    if (!activeSession) {
      const sessions = await ctx.db
        .query("organizationOrderingSessions")
        .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
        .collect();
      activeSession = sessions.find((s) => s.deletedAt === undefined) ?? null;
    }

    // 3. Fallback to full lookup match by _id or sessionId property
    if (!activeSession) {
      const allSessions = await ctx.db
        .query("organizationOrderingSessions")
        .collect();
      activeSession =
        allSessions.find(
          (s) =>
            s.deletedAt === undefined &&
            (String(s._id) === args.sessionId || (s as any).sessionId === args.sessionId),
        ) ?? null;
    }

    if (!activeSession) {
      return { cartId: args.cartId || `cart_${args.sessionId}`, itemCount: args.itemCount, hasItems: args.itemCount > 0 };
    }

    // Patch ordering session with cartItemCount and activity time
    await ctx.db.patch(activeSession._id, {
      cartItemCount: Math.max(0, args.itemCount),
      lastActivityAt: now,
      updatedAt: now,
    });

    const effectiveCartId = args.cartId || `cart_${args.sessionId}`;

    const existingCarts = await ctx.db
      .query("organizationCarts")
      .withIndex("by_cart_id", (q) => q.eq("cartId", effectiveCartId))
      .collect();

    const existing = existingCarts.find((c) => c.deletedAt === undefined);
    const hasItems = args.itemCount > 0;

    if (existing) {
      await ctx.db.patch(existing._id, {
        itemCount: args.itemCount,
        hasItems,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("organizationCarts", {
        cartId: effectiveCartId,
        sessionId: (activeSession as any).sessionId || String(activeSession._id),
        qrId: activeSession.qrId,
        organizationId: activeSession.organizationId,
        tableId: activeSession.tableId,
        itemCount: args.itemCount,
        hasItems,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      cartId: effectiveCartId,
      sessionId: (activeSession as any).sessionId || String(activeSession._id),
      qrId: activeSession.qrId,
      tableId: activeSession.tableId,
      itemCount: args.itemCount,
      hasItems,
    };
  },
});

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Fetches session and scan journey stats for a given QR code.
 */
export const getQrJourneyStats = query({
  args: {
    qrId: v.id("organizationQrCodes"),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    const scans = await ctx.db
      .query("organizationQrScans")
      .withIndex("by_qr", (q) => q.eq("qrId", args.qrId))
      .collect();

    const activeScans = scans.filter((s) => s.deletedAt === undefined);

    const sessions = await ctx.db
      .query("organizationOrderingSessions")
      .withIndex("by_qr", (q) => q.eq("qrId", args.qrId))
      .collect();

    const activeSessions = sessions.filter((s) => s.deletedAt === undefined);

    const carts = await ctx.db
      .query("organizationCarts")
      .withIndex("by_qr", (q) => q.eq("qrId", args.qrId))
      .collect();

    const cartCreatedSessions = carts.filter(
      (c) => c.deletedAt === undefined && c.hasItems,
    );

    const scanCount = activeScans.length;
    const sessionCount = activeSessions.length;
    const cartCreatedCount = cartCreatedSessions.length;

    const cartConversion =
      sessionCount > 0
        ? Number(((cartCreatedCount / sessionCount) * 100).toFixed(2))
        : 0;

    return {
      qrId: args.qrId,
      scanCount,
      sessionCount,
      cartCreatedCount,
      cartConversion,
    };
  },
});

/**
 * 3. Record Order Conversion (Backward-Compatible Alias)
 * Attributes an order to a customer ordering session and QR code.
 */
export const recordOrderConversion = mutation({
  args: {
    sessionId: v.optional(v.string()),
    qrId: v.optional(v.string()),
    orderId: v.optional(v.string()),
    totalAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.orderId) {
      return { success: false, reason: "NO_ORDER_ID" };
    }

    let resolvedOrder: Doc<"orders"> | null = null;
    try {
      resolvedOrder = await ctx.db.get(args.orderId as Id<"orders">);
    } catch {
      // Ignore
    }

    if (!resolvedOrder) {
      const allOrders = await ctx.db.query("orders").collect();
      resolvedOrder = allOrders.find((o) => o.orderNumber === args.orderId || o._id === (args.orderId as any)) ?? null;
    }

    if (!resolvedOrder) {
      return { success: false, reason: "ORDER_NOT_FOUND" };
    }

    let resolvedQrId: Id<"organizationQrCodes"> | null = null;
    if (args.qrId) {
      try {
        const qrDoc = await ctx.db.get(args.qrId as Id<"organizationQrCodes">);
        if (qrDoc && qrDoc.deletedAt === undefined) resolvedQrId = qrDoc._id;
      } catch {}

      if (!resolvedQrId) {
        const legacyMatches = await ctx.db
          .query("organizationQrCodes")
          .withIndex("by_legacy_id", (q) => q.eq("legacyId", args.qrId!))
          .collect();
        const activeLegacyQr = legacyMatches.find((q) => q.deletedAt === undefined);
        if (activeLegacyQr) resolvedQrId = activeLegacyQr._id;
      }

      if (!resolvedQrId) {
        const tableQrs = await ctx.db
          .query("organizationQrCodes")
          .withIndex("by_table", (q) => q.eq("tableId", args.qrId!))
          .collect();
        const activeTableQr = tableQrs.find((q) => q.deletedAt === undefined);
        if (activeTableQr) resolvedQrId = activeTableQr._id;
      }
    }

    if (!resolvedQrId && args.sessionId) {
      try {
        const sDoc = await ctx.db.get(args.sessionId as Id<"organizationOrderingSessions">);
        if (sDoc && sDoc.qrId) resolvedQrId = sDoc.qrId;
      } catch {}
    }

    const now = Date.now();
    await ctx.db.patch(resolvedOrder._id, {
      qrId: resolvedQrId ?? resolvedOrder.qrId,
      sessionId: args.sessionId ?? resolvedOrder.sessionId,
      updatedAt: now,
    });

    if (args.sessionId) {
      const sessions = await ctx.db
        .query("organizationOrderingSessions")
        .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId!))
        .collect();

      const activeSession = sessions.find((s) => s.deletedAt === undefined);
      if (activeSession) {
        await ctx.db.patch(activeSession._id, {
          status: "COMPLETED",
          lastActivityAt: now,
        });
      }
    }

    return {
      success: true,
      orderId: resolvedOrder._id,
      qrId: resolvedQrId ?? resolvedOrder.qrId,
      sessionId: args.sessionId,
    };
  },
});
