import { query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireMember } from "./organizationUsers";
import { formatContractQrType, normalizeQrType } from "./organizationQrCodes";
import { getTimezoneForCountry } from "../lib/constants/countries";

/**
 * Extracts local 0-23 hour for a timestamp using the store's dynamic IANA timezone.
 */
function getLocalHour(timestamp: number, timeZone?: string): number {
  if (!timeZone) return new Date(timestamp).getHours();
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date(timestamp));
    const hourPart = parts.find((p) => p.type === "hour");
    if (hourPart) {
      const h = parseInt(hourPart.value, 10);
      return h === 24 ? 0 : h;
    }
  } catch {}
  return new Date(timestamp).getHours();
}

/**
 * Calculates net paid revenue for an order (excluding Pending, Failed, Refunded orders).
 */
export function computeOrderNetRevenue(order: {
  paymentStatus: string;
  isRejected?: boolean;
  totalAmount?: number;
  refundAmount?: number;
}): number {
  if (
    order.isRejected ||
    order.paymentStatus === "Pending" ||
    order.paymentStatus === "Failed" ||
    order.paymentStatus === "Refunded"
  ) {
    return 0;
  }
  if (order.paymentStatus === "Partially Refunded") {
    const netPaise = Math.max(0, (order.totalAmount || 0) - (order.refundAmount || 0));
    return netPaise / 100;
  }
  if (order.paymentStatus === "Paid") {
    return (order.totalAmount || 0) / 100;
  }
  return 0;
}

// Helper for date range filtering in store's local day boundaries
function parseDateBounds(from?: string, to?: string): { startTs: number; endTs: number } {
  const now = new Date();

  let startTs: number;
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    const [y, m, d] = from.split("-").map(Number);
    startTs = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  } else if (from) {
    const parsed = new Date(from);
    startTs = isNaN(parsed.getTime()) ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30).getTime() : parsed.getTime();
  } else {
    startTs = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0).getTime();
  }

  let endTs: number;
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const [y, m, d] = to.split("-").map(Number);
    endTs = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  } else if (to) {
    const parsed = new Date(to);
    endTs = isNaN(parsed.getTime()) ? now.getTime() : parsed.getTime();
  } else {
    endTs = now.getTime();
  }

  return { startTs, endTs };
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Subticket 04: Individual QR Analytics API
 * Returns complete performance metrics for a single QR code:
 * - Scans, Sessions, Cart Created, Orders, Revenue
 * - Conversion metrics: sessionConversion, cartConversion, orderConversion, cartToOrderConversion
 * - ordersByTime: Hourly ordering breakdown (0-23)
 * - topItems: Top ordered menu items aggregated from valid orders
 */
export const getIndividualAnalytics = query({
  args: {
    qrId: v.id("organizationQrCodes"),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    const qr = await ctx.db.get(args.qrId);
    if (!qr || qr.deletedAt !== undefined) {
      throw new Error("QR_NOT_FOUND");
    }

    // Resolve store's dynamic IANA timezone from organization
    let targetTz = args.timezone;
    if (!targetTz && qr.organizationId) {
      const org = await ctx.db.get(qr.organizationId);
      if (org) {
        targetTz = org.organizationTimeZone || (org.country ? getTimezoneForCountry(org.country) : undefined);
      }
    }
    if (!targetTz) {
      targetTz = "Asia/Kolkata";
    }

    const { startTs, endTs } = parseDateBounds(args.from, args.to);

    const qrIdsToMatch = new Set<string>([String(qr._id)]);
    if (qr.legacyId) qrIdsToMatch.add(qr.legacyId);
    if ((qr as any).id) qrIdsToMatch.add(String((qr as any).id));

    // 1. Fetch telemetry scan records matching any QR identifier or tableId
    const rawScans = await ctx.db
      .query("organizationQrScans")
      .collect();

    const allScans = rawScans.filter((s: any) => {
      if (s.deletedAt !== undefined) return false;
      const sid = String(s.qrId || "");
      return qrIdsToMatch.has(sid) || (qr.tableId && s.tableId === qr.tableId);
    });

    const telemetryScansCount = allScans.filter(
      (s) => s.scannedAt >= startTs && s.scannedAt <= endTs,
    ).length;

    const hasDateFilter = Boolean(args.from || args.to);
    const scans = hasDateFilter || allScans.length > 0
      ? telemetryScansCount
      : Math.max(telemetryScansCount, qr.counter || 0);

    // 2. Fetch ordering sessions matching any QR identifier or tableId
    const rawSessions = await ctx.db
      .query("organizationOrderingSessions")
      .collect();

    const allSessions = rawSessions.filter((s: any) => {
      if (s.deletedAt !== undefined) return false;
      const sid = String(s.qrId || "");
      return qrIdsToMatch.has(sid) || (qr.tableId && s.tableId === qr.tableId);
    });

    const telemetrySessionsCount = allSessions.filter((s: any) => {
      const st = s.startedAt ?? s.firstScanAt ?? s.createdAt ?? 0;
      return st >= startTs && st <= endTs;
    }).length;

    const sessions = telemetrySessionsCount;

    // Collect all session IDs for this QR code to attribute session-linked orders (Takeaway, Delivery, DineIn)
    const qrSessionIds = new Set<string>();
    for (const s of allSessions) {
      qrSessionIds.add(String(s._id));
      if ((s as any).sessionId) qrSessionIds.add(String((s as any).sessionId));
    }

    // 4. Fetch orders attributed to QR, table, or QR session
    const allOrders = await ctx.db.query("orders").collect();
    const validOrders = allOrders.filter(
      (o: any) =>
        (qrIdsToMatch.has(String(o.qrId || "")) ||
          (qr.tableId && o.tableId === qr.tableId) ||
          (o.sessionId && qrSessionIds.has(String(o.sessionId)))) &&
        !o.isRejected &&
        o.paymentStatus !== "Refunded" &&
        o.paymentStatus !== "Failed" &&
        o.createdAt >= startTs &&
        o.createdAt <= endTs,
    );

    const rawCarts = await ctx.db
      .query("organizationCarts")
      .collect();

    const allCarts = rawCarts.filter((c: any) => {
      if (c.deletedAt !== undefined) return false;
      const cid = String(c.qrId || "");
      return qrIdsToMatch.has(cid) || (qr.tableId && c.tableId === qr.tableId);
    });

    const cartSessionSet = new Set<string>();

    for (const c of allCarts) {
      if (
        (c.hasItems || (c.itemCount ?? 0) > 0) &&
        c.createdAt >= startTs &&
        c.createdAt <= endTs
      ) {
        if (c.sessionId) cartSessionSet.add(String(c.sessionId));
      }
    }

    for (const s of allSessions) {
      const st = (s as any).startedAt ?? (s as any).firstScanAt ?? (s as any).createdAt ?? 0;
      if (
        ((s as any).cartItemCount ?? 0) > 0 &&
        st >= startTs &&
        st <= endTs
      ) {
        cartSessionSet.add(String(s._id));
        if ((s as any).sessionId) cartSessionSet.add(String((s as any).sessionId));
      }
    }

    const untrackedOrdersCount = validOrders.filter(
      (o) => !o.sessionId || !cartSessionSet.has(String(o.sessionId)),
    ).length;

    const carts = Math.max(cartSessionSet.size + untrackedOrdersCount, validOrders.length);

    const ordersCount = validOrders.length;
    const revenue = validOrders.reduce((sum, o) => sum + computeOrderNetRevenue(o), 0);

    // Conversions
    const sessionConversion = scans > 0 ? Number(((sessions / scans) * 100).toFixed(2)) : 0;
    const cartConversion = sessions > 0 ? Number(((carts / sessions) * 100).toFixed(2)) : 0;
    const orderConversion = sessions > 0 ? Number(((ordersCount / sessions) * 100).toFixed(2)) : 0;
    const cartToOrderConversion = carts > 0 ? Number(((ordersCount / carts) * 100).toFixed(2)) : 0;

    // 5. Orders by Time (Hourly distribution 0-23 in store's local timezone)
    const hourlyMap: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourlyMap[h] = 0;

    for (const order of validOrders) {
      const hour = getLocalHour(order.createdAt, targetTz);
      hourlyMap[hour] = (hourlyMap[hour] || 0) + 1;
    }

    const ordersByTime = Object.keys(hourlyMap)
      .map((h) => Number(h))
      .sort((a, b) => a - b)
      .filter((h) => hourlyMap[h] > 0)
      .map((hour) => ({
        hour,
        orders: hourlyMap[hour],
      }));

    // 6. Derive Peak Time string (e.g., "7 PM – 9 PM")
    let peakHour = -1;
    let maxHourOrders = 0;
    for (let h = 0; h < 24; h++) {
      if (hourlyMap[h] > maxHourOrders) {
        maxHourOrders = hourlyMap[h];
        peakHour = h;
      }
    }

    let peakTime = "N/A";
    if (peakHour >= 0 && maxHourOrders > 0) {
      const startPeriod = peakHour >= 12 ? (peakHour === 12 ? "12 PM" : `${peakHour - 12} PM`) : (peakHour === 0 ? "12 AM" : `${peakHour} AM`);
      const endHour = (peakHour + 2) % 24;
      const endPeriod = endHour >= 12 ? (endHour === 12 ? "12 PM" : `${endHour - 12} PM`) : (endHour === 0 ? "12 AM" : `${endHour} AM`);
      peakTime = `${startPeriod} – ${endPeriod}`;
    }

    // 7. Top 5 items aggregated from orderItems
    const itemMap: Record<string, { itemId: string; name: string; quantity: number }> = {};

    for (const order of validOrders) {
      const orderItems = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      for (const item of orderItems) {
        const key = item.itemId;
        if (!itemMap[key]) {
          itemMap[key] = {
            itemId: item.itemId,
            name: item.itemName,
            quantity: 0,
          };
        }
        itemMap[key].quantity += item.quantity;
      }
    }

    const topItems = Object.values(itemMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // 8. Dynamic Table Usage Metrics (Avg Session Duration & Avg Guests per session)
    const now = Date.now();
    let totalSessionMs = 0;
    const sessionRecordsFiltered = allSessions.filter(
      (s) => s.deletedAt === undefined && s.startedAt >= startTs && s.startedAt <= endTs,
    );

    for (const s of sessionRecordsFiltered) {
      const endActivity = s.lastActivityAt && s.lastActivityAt > s.startedAt ? s.lastActivityAt : now;
      const duration = endActivity - s.startedAt;
      totalSessionMs += Math.max(0, duration);
    }

    let avgSessionMinutes = 0;
    let avgSessionMinutesDisplay = "0 min";

    if (sessionRecordsFiltered.length > 0) {
      const avgMs = totalSessionMs / sessionRecordsFiltered.length;
      if (avgMs < 45000) {
        avgSessionMinutes = 0;
        avgSessionMinutesDisplay = "< 1 min";
      } else {
        avgSessionMinutes = Math.max(1, Math.round(avgMs / 60000));
        avgSessionMinutesDisplay = `${avgSessionMinutes} min`;
      }
    }

    const normType = (qr.qrType || "").toUpperCase();
    const isTakeAwayOrDelivery = normType.includes("TAKEAWAY") || normType.includes("DELIVERY");

    let avgGuests: number | string = 0;

    if (isTakeAwayOrDelivery) {
      avgGuests = "N/A";
    } else {
      let seatCapacity = 0;
      if (qr.tableId) {
        try {
          const tableDoc = await ctx.db.get(qr.tableId as Id<"organizationTables">);
          if (tableDoc && tableDoc.seatingCapacity) {
            seatCapacity = tableDoc.seatingCapacity;
          }
        } catch {
          // Fallback
        }
      }

      const ordersWithMembers = validOrders.filter(
        (o) => typeof (o as any).membersOnTable === "number" && (o as any).membersOnTable > 0,
      );

      if (ordersWithMembers.length > 0) {
        const sumGuests = ordersWithMembers.reduce((sum, o) => sum + (o as any).membersOnTable, 0);
        avgGuests = Number((sumGuests / ordersWithMembers.length).toFixed(1));
      } else if (seatCapacity > 0) {
        avgGuests = seatCapacity;
      } else {
        avgGuests = 0;
      }
    }

    return {
      qrId: qr._id,
      tableId: qr.tableId,
      scans,
      sessions,
      carts,
      orders: ordersCount,
      sessionConversion,
      cartConversion,
      orderConversion,
      cartToOrderConversion,
      revenue,
      ordersByTime,
      peakTime,
      topItems,
      avgSessionMinutes,
      avgSessionMinutesDisplay,
      avgGuests,
    };
  },
});

/**
 * Subticket 05: Overall Performance API
 * Aggregates overall performance metrics across all QR codes for an outlet.
 */
export const getOverallPerformance = query({
  args: {
    outletId: v.optional(v.id("organizations")),
    type: v.optional(v.string()), // "ALL", "DINE_IN", "TAKEAWAY", "DELIVERY"
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    const { startTs, endTs } = parseDateBounds(args.from, args.to);

    let qrs = await ctx.db.query("organizationQrCodes").collect();
    qrs = qrs.filter((q) => q.deletedAt === undefined);

    if (args.outletId) {
      qrs = qrs.filter((q) => q.organizationId === args.outletId);
    }

    if (args.type && args.type.toUpperCase() !== "ALL" && args.type.toUpperCase() !== "ALL_TYPES") {
      try {
        const norm = normalizeQrType(args.type);
        const upperType = args.type.toUpperCase().trim();
        qrs = qrs.filter(
          (q) => q.qrType === norm || q.qrType === args.type || q.qrType?.toUpperCase() === upperType,
        );
      } catch {
        // Safe fallback
      }
    }

    const rows = [];
    let totalScans = 0;
    let totalSessions = 0;
    let totalOrders = 0;
    let totalRevenue = 0;
    let activeQrCount = 0;

    const hourlyScans = new Array(24).fill(0);
    const hourlyOrders = new Array(24).fill(0);

    let overallOrgTz = args.timezone;
    if (!overallOrgTz && args.outletId) {
      const org = await ctx.db.get(args.outletId);
      if (org) {
        overallOrgTz = org.organizationTimeZone || (org.country ? getTimezoneForCountry(org.country) : undefined);
      }
    }
    if (!overallOrgTz) overallOrgTz = "Asia/Kolkata";

    for (const qr of qrs) {
      const isAct = (qr.status ?? "ACTIVE") === "ACTIVE";
      if (isAct) activeQrCount++;

      const scanRecords = (
        await ctx.db
          .query("organizationQrScans")
          .withIndex("by_qr", (q) => q.eq("qrId", qr._id))
          .collect()
      ).filter((s) => s.deletedAt === undefined && s.scannedAt >= startTs && s.scannedAt <= endTs);

      const hasDateFilter = Boolean(args.from || args.to);
      const scans = hasDateFilter ? scanRecords.length : Math.max(scanRecords.length, qr.counter || 0);
      for (const s of scanRecords) {
        const hour = getLocalHour(s.scannedAt, overallOrgTz);
        hourlyScans[hour] = (hourlyScans[hour] || 0) + 1;
      }

      const sessionRecords = (
        await ctx.db
          .query("organizationOrderingSessions")
          .withIndex("by_qr", (q) => q.eq("qrId", qr._id))
          .collect()
      ).filter((s: any) => {
        if (s.deletedAt !== undefined) return false;
        const st = s.startedAt ?? s.firstScanAt ?? s.createdAt ?? 0;
        return st >= startTs && st <= endTs;
      });

      const sessions = sessionRecords.length;

      const sessionIdsForQr = new Set<string>();
      for (const s of sessionRecords) {
        sessionIdsForQr.add(String(s._id));
        if ((s as any).sessionId) sessionIdsForQr.add(String((s as any).sessionId));
      }

      const attributedOrders = (
        await ctx.db
          .query("orders")
          .collect()
      ).filter(
        (o: any) =>
          (o.qrId === qr._id ||
            (qr.tableId && o.tableId === qr.tableId) ||
            (o.sessionId && sessionIdsForQr.has(String(o.sessionId)))) &&
          !o.isRejected &&
          o.paymentStatus !== "Refunded" &&
          o.paymentStatus !== "Failed" &&
          o.createdAt >= startTs &&
          o.createdAt <= endTs,
      );

      const orders = attributedOrders.length;
      for (const o of attributedOrders) {
        const hour = getLocalHour(o.createdAt, overallOrgTz);
        hourlyOrders[hour] = (hourlyOrders[hour] || 0) + 1;
      }

      const revenue = attributedOrders.reduce((sum, o) => sum + computeOrderNetRevenue(o), 0);
      const conversion = sessions > 0 ? Number(((orders / sessions) * 100).toFixed(2)) : 0;

      totalScans += scans;
      totalSessions += sessions;
      totalOrders += orders;
      totalRevenue += revenue;

      let zonePlacement = "Indoor / Window";
      if (qr.tableId) {
        try {
          const tDoc = await ctx.db.get(qr.tableId as Id<"organizationTables">);
          if (tDoc && tDoc.placement) {
            zonePlacement = tDoc.placement;
          }
        } catch {
          // Fallback
        }
      }

      rows.push({
        qrId: qr._id,
        name: qr.name,
        type: formatContractQrType(qr.qrType),
        zone: zonePlacement,
        placement: zonePlacement,
        scans,
        sessions,
        orders,
        conversion,
        revenue,
      });
    }

    const summaryConversion =
      totalSessions > 0 ? Number(((totalOrders / totalSessions) * 100).toFixed(2)) : 0;

    return {
      summary: {
        totalQr: qrs.length,
        activeQr: activeQrCount,
        scans: totalScans,
        sessions: totalSessions,
        orders: totalOrders,
        revenue: totalRevenue,
        conversion: summaryConversion,
        hourlyScans,
        hourlyOrders,
      },
      rows,
    };
  },
});

/**
 * Subticket 05: Paginated QR List API with search and filtering
 */
export const listPaginated = query({
  args: {
    outletId: v.optional(v.id("organizations")),
    type: v.optional(v.string()),
    status: v.optional(v.union(v.literal("ACTIVE"), v.literal("INACTIVE"))),
    search: v.optional(v.string()),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    let items = await ctx.db.query("organizationQrCodes").collect();
    items = items.filter((q) => q.deletedAt === undefined);

    if (args.outletId) {
      items = items.filter((q) => q.organizationId === args.outletId);
    }

    if (args.type && args.type.toUpperCase() !== "ALL" && args.type.toUpperCase() !== "ALL_TYPES") {
      try {
        const norm = normalizeQrType(args.type);
        const upperType = args.type.toUpperCase().trim();
        items = items.filter(
          (q) => q.qrType === norm || q.qrType === args.type || q.qrType?.toUpperCase() === upperType,
        );
      } catch {
        // Safe fallback
      }
    }

    if (args.status) {
      items = items.filter((q) => (q.status ?? "ACTIVE") === args.status);
    }

    if (args.search && args.search.trim()) {
      const term = args.search.trim().toLowerCase();
      items = items.filter(
        (q) =>
          q.name.toLowerCase().includes(term) ||
          (q.tableNumber && q.tableNumber.toLowerCase().includes(term)),
      );
    }

    const total = items.length;
    const page = args.page || 1;
    const limit = args.limit || 20;
    const startIdx = (page - 1) * limit;
    const paginated = items.slice(startIdx, startIdx + limit);

    const formattedRows = [];
    for (const qr of paginated) {
      let tableInfo = null;
      if (qr.tableId) {
        try {
          const tableDoc = await ctx.db.get(qr.tableId as Id<"organizationTables">);
          if (tableDoc) {
            tableInfo = {
              id: tableDoc._id,
              name: tableDoc.tableNumber,
              capacity: tableDoc.seatingCapacity,
              placement: tableDoc.placement || "Indoor",
            };
          }
        } catch {
          // Table doc format fallback
        }
      }

      formattedRows.push({
        qrId: qr._id,
        displayName: qr.name,
        type: formatContractQrType(qr.qrType),
        status: qr.status ?? "ACTIVE",
        table: tableInfo,
        scanCount: qr.counter ?? 0,
      });
    }

    return {
      items: formattedRows,
      page,
      limit,
      total,
    };
  },
});
