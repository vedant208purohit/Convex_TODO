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
    existingSessionId: v.optional(v.string()),
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

    const requestedSessionId = (args.sessionId || args.existingSessionId || "").trim();
    let existingSession: Doc<"organizationOrderingSessions"> | null = null;

    // 1. Direct Convex ID lookup for requestedSessionId
    if (requestedSessionId) {
      try {
        const doc = await ctx.db.get(requestedSessionId as Id<"organizationOrderingSessions">);
        if (
          doc &&
          doc.deletedAt === undefined &&
          (doc.qrId === qr._id || (qr.tableId && doc.tableId === qr.tableId)) &&
          (doc.status === "ACTIVE" || (doc.status as string) === "active") &&
          now - (doc.lastActivityAt || doc.startedAt || 0) <= SESSION_ACTIVITY_WINDOW_MS
        ) {
          existingSession = doc;
        }
      } catch {}
    }

    // 2. Lookup by sessionId index
    if (!existingSession && requestedSessionId) {
      const sessions = await ctx.db
        .query("organizationOrderingSessions")
        .withIndex("by_session_id", (q) => q.eq("sessionId", requestedSessionId))
        .collect();

      const activeMatch = sessions.find(
        (s) =>
          (s.qrId === qr._id || (qr.tableId && s.tableId === qr.tableId)) &&
          s.deletedAt === undefined &&
          (s.status === "ACTIVE" || (s.status as string) === "active") &&
          now - (s.lastActivityAt || s.startedAt || 0) <= SESSION_ACTIVITY_WINDOW_MS
      );

      if (activeMatch) {
        existingSession = activeMatch;
      }
    }

    let effectiveSessionId: string;
    if (!existingSession) {
      effectiveSessionId = requestedSessionId || generateId("session");
      await ctx.db.insert("organizationOrderingSessions", {
        sessionId: effectiveSessionId,
        qrId: qr._id,
        organizationId: qr.organizationId,
        tableId: qr.tableId,
        status: "ACTIVE",
        startedAt: now,
        firstScanAt: now,
        lastActivityAt: now,
        updatedAt: now,
      });
    } else {
      effectiveSessionId = existingSession.sessionId;
      await ctx.db.patch(existingSession._id, {
        lastActivityAt: now,
        updatedAt: now,
      });
    }

    // 15-Minute Scan Deduplication: Page refreshes & scans within 15 min do NOT inflate scan count
    const SCAN_DEDUPE_WINDOW_MS = 15 * 60 * 1000;
    let isDuplicateScan = false;
    let scanDocId: Id<"organizationQrScans">;

    if (existingSession || requestedSessionId) {
      const recentScans = await ctx.db
        .query("organizationQrScans")
        .withIndex("by_qr", (q) => q.eq("qrId", qr._id))
        .collect();

      const existingScan = recentScans.find((s) => {
        if (s.deletedAt !== undefined) return false;
        const matchesSession =
          s.sessionId === effectiveSessionId ||
          (requestedSessionId && s.sessionId === requestedSessionId) ||
          (existingSession && s.sessionId === existingSession.sessionId);
        const withinWindow = now - s.scannedAt <= SCAN_DEDUPE_WINDOW_MS;
        return matchesSession && withinWindow;
      });

      if (existingScan) {
        isDuplicateScan = true;
        scanDocId = existingScan._id;
      }
    }

    if (!isDuplicateScan) {
      // Increment physical scan counter and insert scan telemetry ONLY for new scans
      await ctx.db.patch(qr._id, {
        counter: (qr.counter ?? 0) + 1,
        updatedAt: now,
      });

      scanDocId = await ctx.db.insert("organizationQrScans", {
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
    }

    return {
      success: true,
      scanId: scanDocId,
      qrId: qr._id,
      organizationId: qr.organizationId,
      sessionId: effectiveSessionId,
      tableId: qr.tableId,
      qrType: qr.qrType,
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
    tableId: v.optional(v.string()),
    qrId: v.optional(v.string()),
    organizationId: v.optional(v.string()),
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
    } catch {}

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

    // 4. Fallback to match by tableId or qrId if provided
    if (!activeSession && (args.tableId || args.qrId)) {
      const allSessions = await ctx.db
        .query("organizationOrderingSessions")
        .collect();
      const matching = allSessions.filter((s) => {
        if (s.deletedAt !== undefined) return false;
        if (args.tableId && s.tableId === args.tableId) return true;
        if (args.qrId && (String(s.qrId) === args.qrId || (s as any).qrId === args.qrId)) return true;
        return false;
      });
      matching.sort((a, b) => (b.lastActivityAt || b.startedAt || 0) - (a.lastActivityAt || a.startedAt || 0));
      if (matching.length > 0) {
        activeSession = matching[0];
      }
    }

    // 5. If STILL no session, create one for table / QR so cart count is never lost
    if (!activeSession && (args.tableId || args.qrId)) {
      let resolvedQr: Doc<"organizationQrCodes"> | null = null;
      if (args.qrId) {
        try {
          const q = await ctx.db.get(args.qrId as Id<"organizationQrCodes">);
          if (q) resolvedQr = q;
        } catch {}
      }
      if (!resolvedQr && args.tableId) {
        const tableQrs = await ctx.db
          .query("organizationQrCodes")
          .withIndex("by_table", (q) => q.eq("tableId", args.tableId))
          .collect();
        resolvedQr = tableQrs.find((q) => q.deletedAt === undefined) ?? null;
      }

      if (resolvedQr) {
        const newSessionId = await ctx.db.insert("organizationOrderingSessions", {
          sessionId: args.sessionId,
          qrId: resolvedQr._id,
          organizationId: resolvedQr.organizationId,
          tableId: args.tableId || resolvedQr.tableId,
          status: "ACTIVE",
          startedAt: now,
          firstScanAt: now,
          lastActivityAt: now,
          cartItemCount: Math.max(0, args.itemCount),
          updatedAt: now,
        });
        activeSession = await ctx.db.get(newSessionId);
      }
    }

    if (activeSession) {
      await ctx.db.patch(activeSession._id, {
        cartItemCount: Math.max(0, args.itemCount),
        lastActivityAt: now,
        updatedAt: now,
      });
    }

    // Always upsert organizationCarts
    const effectiveCartId = args.cartId || `cart_${args.sessionId}`;
    const existingCarts = await ctx.db
      .query("organizationCarts")
      .withIndex("by_cart_id", (q) => q.eq("cartId", effectiveCartId))
      .collect();

    const existing = existingCarts.find((c) => c.deletedAt === undefined);
    const hasItems = args.itemCount > 0;
    const effectiveQrId = activeSession?.qrId || (args.qrId as any);
    const effectiveOrgId = activeSession?.organizationId || (args.organizationId as any);
    const effectiveTableId = activeSession?.tableId || args.tableId;

    if (existing) {
      await ctx.db.patch(existing._id, {
        itemCount: args.itemCount,
        hasItems,
        tableId: effectiveTableId || existing.tableId,
        updatedAt: now,
      });
    } else if (effectiveQrId) {
      await ctx.db.insert("organizationCarts", {
        cartId: effectiveCartId,
        sessionId: activeSession ? ((activeSession as any).sessionId || String(activeSession._id)) : args.sessionId,
        qrId: effectiveQrId,
        organizationId: effectiveOrgId,
        tableId: effectiveTableId,
        itemCount: args.itemCount,
        hasItems,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      cartId: effectiveCartId,
      sessionId: activeSession ? ((activeSession as any).sessionId || String(activeSession._id)) : args.sessionId,
      qrId: effectiveQrId,
      tableId: effectiveTableId,
      itemCount: args.itemCount,
      hasItems,
    };
  },
});

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
