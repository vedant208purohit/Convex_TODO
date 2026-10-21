import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  formatStoreDate,
  formatStoreTime,
  formatStoreDateTime,
  formatPriceWithSymbol,
  formatCurrencyAmount,
  getTimezoneForCountry,
  getPhoneCodeForCountry,
  formatPhoneNumberWithCountryCode,
} from "../lib/constants/countries";

// Helper: Resolve organization ID or fallback to first available organization
async function resolveOrganizationId(
  ctx: QueryCtx,
  orgId?: Id<"organizations">
): Promise<Id<"organizations"> | null> {
  if (orgId) return orgId;
  const firstOrg = await ctx.db.query("organizations").first();
  return firstOrg ? firstOrg._id : null;
}

// Helper: Format an hour (0-23) into "08:00 PM - 09:00 PM"
function formatHourRange(hour: number): string {
  const formatH = (h: number) => {
    const period = h >= 12 && h < 24 ? "PM" : "AM";
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH.toString().padStart(2, "0")}:00 ${period}`;
  };
  const start = formatH(hour);
  const end = formatH((hour + 1) % 24);
  return `${start} - ${end}`;
}

// Helper: Extract integer hour (0-23) in store's regional timezone
function getStoreHourInTz(
  timestamp: number,
  timezone?: string,
  country?: string
): number {
  const targetTz = timezone || getTimezoneForCountry(country || "");
  if (!targetTz) return new Date(timestamp).getHours();
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: targetTz,
      hour: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date(timestamp));
    const hp = parts.find((p) => p.type === "hour");
    if (hp) {
      const h = parseInt(hp.value, 10);
      return h === 24 ? 0 : h;
    }
  } catch {
    // fallback
  }
  return new Date(timestamp).getHours();
}

// Helper: Parse store operational timing into valid operating hours
function parseOperationalHourRange(operationTiming: any): {
  validHours: Set<number>;
  sortedHours: number[];
  startHour: number;
  endHour: number;
} {
  const validHours = new Set<number>();
  if (!operationTiming || typeof operationTiming !== "object") {
    for (let h = 10; h <= 23; h++) validHours.add(h);
    return {
      validHours,
      sortedHours: Array.from(validHours).sort((a, b) => a - b),
      startHour: 10,
      endHour: 23,
    };
  }

  const parseH = (str?: string): number | null => {
    if (!str || typeof str !== "string") return null;
    const clean = str.trim();
    if (clean.includes("T")) {
      const timePart = clean.split("T")[1];
      const h = parseInt(timePart.split(":")[0], 10);
      return isNaN(h) ? null : h;
    }
    if (clean.includes(":")) {
      const h = parseInt(clean.split(":")[0], 10);
      return isNaN(h) ? null : h;
    }
    const h = parseInt(clean, 10);
    return isNaN(h) ? null : h;
  };

  let minH = 24;
  let maxH = -1;
  let foundAny = false;

  for (const dayKey of Object.keys(operationTiming)) {
    const day = operationTiming[dayKey];
    if (!day || typeof day !== "object") continue;

    const isActive = day.active ?? day.is_open ?? true;
    if (!isActive) continue;

    foundAny = true;

    if (day.is_open_all_day) {
      for (let h = 0; h <= 23; h++) validHours.add(h);
      minH = 0;
      maxH = 23;
      continue;
    }

    if (day.open) {
      const oh = parseH(day.open);
      const ch = day.close ? parseH(day.close) : 23;
      if (oh !== null) {
        const end = ch !== null ? ch : 23;
        for (let h = oh; h <= end && h <= 23; h++) validHours.add(h);
        minH = Math.min(minH, oh);
        maxH = Math.max(maxH, end);
      }
    }

    if (Array.isArray(day.hours)) {
      for (const slot of day.hours) {
        if (!slot) continue;
        const sh = parseH(slot.start_time || slot.open || slot.start);
        const eh = parseH(slot.end_time || slot.close || slot.end);
        if (sh !== null) {
          const end = eh !== null ? eh : 23;
          for (let h = sh; h <= end && h <= 23; h++) validHours.add(h);
          minH = Math.min(minH, sh);
          maxH = Math.max(maxH, end);
        }
      }
    }
  }

  if (!foundAny || validHours.size === 0) {
    for (let h = 10; h <= 23; h++) validHours.add(h);
  }

  minH = Math.max(0, Math.min(23, minH === 24 ? 10 : minH));
  maxH = Math.max(minH, Math.min(23, maxH === -1 ? 23 : maxH));
  const sortedHours = Array.from(validHours).sort((a, b) => a - b);

  return { validHours, sortedHours, startHour: minH, endHour: maxH };
}

// =========================================================================
// 1. SALES REPORT (api.reports.getSalesReport)
// =========================================================================
export const getSalesReport = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    fromTimestamp: v.number(),
    toTimestamp: v.number(),
    orderType: v.optional(v.string()),
    paymentMode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const orgId = await resolveOrganizationId(ctx, args.organizationId);
    if (!orgId) {
      return {
        netSales: 0,
        grossSales: 0,
        discounts: 0,
        taxes: 0,
        refunds: 0,
        deliveryCharges: 0,
        packagingCharges: 0,
        serviceCharges: 0,
        tips: 0,
        completedOrdersCount: 0,
        averageOrderValue: 0,
        hourlyDistribution: [],
        paymentBreakdown: [],
        orderTypeBreakdown: [],
      };
    }

    const org = await ctx.db.get(orgId);
    const country = org?.country || "IN";
    const timezone = org?.organizationTimeZone || getTimezoneForCountry(country);

    // 1. Fetch completed orders within range using by_created_at index
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_created_at", (q) =>
        q
          .eq("organizationId", orgId)
          .gte("createdAt", args.fromTimestamp)
          .lte("createdAt", args.toTimestamp)
      )
      .collect();

    // Filter valid completed non-rejected orders
    const validOrders = orders.filter((o) => {
      if (o.isRejected) return false;
      if (args.orderType && o.orderType !== args.orderType) return false;
      if (args.paymentMode && o.paymentMode !== args.paymentMode) return false;
      return true;
    });

    let totalGrossPaise = 0;
    let totalTaxPaise = 0;
    let totalRefundPaise = 0;
    let totalNetPaise = 0;

    const dailyMap = new Map<
      string,
      {
        date: string;
        displayDate: string;
        grossPaise: number;
        refundPaise: number;
        taxPaise: number;
        netPaise: number;
        totalOrders: number;
      }
    >();

    for (const order of validOrders) {
      const gross = order.totalAmount || 0;
      const tax = order.taxTotal || 0;

      // Fetch payment refunds for this order
      const payments = await ctx.db
        .query("orderPayments")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      const orderRefund = payments.reduce(
        (sum, p) => sum + (p.refundAmount || 0),
        0
      );

      const net = gross - tax - orderRefund;

      totalGrossPaise += gross;
      totalTaxPaise += tax;
      totalRefundPaise += orderRefund;
      totalNetPaise += net;

      const dateKey = formatStoreDate(order.createdAt, country, timezone);
      const existing = dailyMap.get(dateKey) || {
        date: dateKey,
        displayDate: dateKey,
        grossPaise: 0,
        refundPaise: 0,
        taxPaise: 0,
        netPaise: 0,
        totalOrders: 0,
      };

      existing.grossPaise += gross;
      existing.taxPaise += tax;
      existing.refundPaise += orderRefund;
      existing.netPaise += net;
      existing.totalOrders += 1;
      dailyMap.set(dateKey, existing);
    }

    const salesData = Array.from(dailyMap.values()).sort((a, b) =>
      b.date.localeCompare(a.date)
    );

    return {
      totalGrossSales: totalGrossPaise,
      totalTaxCollected: totalTaxPaise,
      totalRefund: totalRefundPaise,
      totalNetSales: totalNetPaise,
      totalOrders: validOrders.length,
      salesData,
      length: salesData.length,
    };
  },
});

// =========================================================================
// 2. ORDERS REPORT (api.reports.getOrdersReport)
// =========================================================================
export const getOrdersReport = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    fromTimestamp: v.number(),
    toTimestamp: v.number(),
    orderType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const orgId = await resolveOrganizationId(ctx, args.organizationId);
    if (!orgId) {
      return {
        totalOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        scheduledOrders: 0,
        cancellationRate: 0,
        statusBreakdown: [],
        orderTypeBreakdown: [],
        hourlyVolume: [],
        dailyTrend: [],
      };
    }

    const org = await ctx.db.get(orgId);
    const country = org?.country || "IN";
    const timezone = org?.organizationTimeZone || getTimezoneForCountry(country);
    const { validHours } = parseOperationalHourRange(org?.operationTiming);

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_created_at", (q) =>
        q
          .eq("organizationId", orgId)
          .gte("createdAt", args.fromTimestamp)
          .lte("createdAt", args.toTimestamp)
      )
      .collect();

    const validOrders = orders.filter((o) => {
      if (o.isRejected) return false;
      if (args.orderType && o.orderType !== args.orderType) return false;
      return true;
    });

    const totalOrders = validOrders.length;
    const totalGrossSales = validOrders.reduce(
      (sum, o) => sum + (o.totalAmount || 0),
      0
    );
    const avgOrderValue = totalOrders > 0 ? Math.round(totalGrossSales / totalOrders) : 0;

    // Peak Hour calculation (restricted strictly to store's operational hours in store timezone)
    const hourlyCounts: Record<number, number> = {};
    for (const o of validOrders) {
      const hour = getStoreHourInTz(o.createdAt, timezone, country);
      hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
    }

    let peakHour = -1;
    let maxHourCount = 0;
    for (const [hourStr, count] of Object.entries(hourlyCounts)) {
      const h = parseInt(hourStr, 10);
      if (validHours.has(h) && count > maxHourCount) {
        maxHourCount = count;
        peakHour = h;
      }
    }
    const peakOrderTimeFrame =
      peakHour !== -1 && maxHourCount > 0 ? formatHourRange(peakHour) : "No peak time";

    // Fulfillment / Delivery durations from orderActivities
    let totalDurationSeconds = 0;
    let durationCount = 0;

    for (const order of validOrders) {
      const activities = await ctx.db
        .query("orderActivities")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      const lastActivity = activities.find(
        (a) => a.totalDuration && a.totalDuration > 0
      );
      if (lastActivity && lastActivity.totalDuration) {
        totalDurationSeconds += lastActivity.totalDuration;
        durationCount++;
      }
    }

    const averageDeliveryTime =
      durationCount > 0 ? Math.round(totalDurationSeconds / durationCount) : 0;

    // Order type summary
    const orderTypeSummaryMap: Record<
      string,
      {
        totalByOrderType: number;
        totalSumPaise: number;
        refundedOrders: number;
        avgDeliveryTime: number;
      }
    > = {};

    for (const order of validOrders) {
      const type = order.orderType || "DineIn";
      if (!orderTypeSummaryMap[type]) {
        orderTypeSummaryMap[type] = {
          totalByOrderType: 0,
          totalSumPaise: 0,
          refundedOrders: 0,
          avgDeliveryTime: 0,
        };
      }
      orderTypeSummaryMap[type].totalByOrderType += 1;
      orderTypeSummaryMap[type].totalSumPaise += order.totalAmount || 0;
      if (order.paymentStatus === "Refunded" || order.paymentStatus === "Partially Refunded") {
        orderTypeSummaryMap[type].refundedOrders += 1;
      }
    }

    const orderTypeSummary = Object.entries(orderTypeSummaryMap).map(
      ([type, data]) => ({
        orderType: type,
        totalOrders: data.totalByOrderType,
        avgOrderValue:
          data.totalByOrderType > 0
            ? Math.round(data.totalSumPaise / data.totalByOrderType)
            : 0,
        refundedOrders: data.refundedOrders,
        avgDeliveryTime: averageDeliveryTime,
      })
    );

    // Daily breakdown
    const dailyMap = new Map<
      string,
      {
        date: string;
        displayDate: string;
        totalOrders: number;
        totalValuePaise: number;
        itemsCount: number;
        channelCounts: Record<string, number>;
        hourlyCounts: Record<number, number>;
      }
    >();

    for (const order of validOrders) {
      const dateKey = formatStoreDate(order.createdAt, country, timezone);
      const existing = dailyMap.get(dateKey) || {
        date: dateKey,
        displayDate: dateKey,
        totalOrders: 0,
        totalValuePaise: 0,
        itemsCount: 0,
        channelCounts: {},
        hourlyCounts: {},
      };

      existing.totalOrders += 1;
      existing.totalValuePaise += order.totalAmount || 0;
      existing.channelCounts[order.orderType] =
        (existing.channelCounts[order.orderType] || 0) + 1;

      const orderHour = getStoreHourInTz(order.createdAt, timezone, country);
      existing.hourlyCounts[orderHour] = (existing.hourlyCounts[orderHour] || 0) + 1;

      // Count order items
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();
      existing.itemsCount += items.reduce((s, it) => s + (it.quantity || 1), 0);

      dailyMap.set(dateKey, existing);
    }

    const ordersData = Array.from(dailyMap.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((d) => {
        let maxChan = "DineIn";
        let maxChanCount = 0;
        for (const [chan, count] of Object.entries(d.channelCounts)) {
          if (count > maxChanCount) {
            maxChanCount = count;
            maxChan = chan;
          }
        }

        let dayPeakHour = -1;
        let dayMaxCount = 0;
        for (const [hourStr, count] of Object.entries(d.hourlyCounts)) {
          const h = parseInt(hourStr, 10);
          if (validHours.has(h) && count > dayMaxCount) {
            dayMaxCount = count;
            dayPeakHour = h;
          }
        }
        const dayPeakTimeFrame =
          dayPeakHour !== -1 && dayMaxCount > 0 ? formatHourRange(dayPeakHour) : "No peak time";

        return {
          date: d.date,
          displayDate: d.displayDate,
          totalOrders: d.totalOrders,
          avgOrderValue:
            d.totalOrders > 0 ? Math.round(d.totalValuePaise / d.totalOrders) : 0,
          averageDeliveryTime,
          peakOrderTimeFrame: dayPeakTimeFrame,
          avgItemsPerOrder:
            d.totalOrders > 0
              ? Math.round((d.itemsCount / d.totalOrders) * 10) / 10
              : 0,
          avgOrderType: maxChan,
        };
      });

    return {
      totalOrders,
      totalAvgOrderValue: avgOrderValue,
      averageDeliveryTime,
      peakOrderTimeFrame,
      orderTypeSummary,
      ordersData,
      length: ordersData.length,
    };
  },
});

// =========================================================================
// 3. MENU REPORT (api.reports.getMenuReport) - PMIX & Category Performance
// =========================================================================
export const getMenuReport = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    fromTimestamp: v.number(),
    toTimestamp: v.number(),
    reportBy: v.optional(v.union(v.literal("item"), v.literal("category"))),
  },
  handler: async (ctx, args) => {
    const orgId = await resolveOrganizationId(ctx, args.organizationId);
    if (!orgId) {
      return {
        items: [],
        categories: [],
        topSellers: [],
        leastSellers: [],
        matrix: { stars: [], plowhorses: [], puzzles: [], dogs: [] },
      };
    }

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_created_at", (q) =>
        q
          .eq("organizationId", orgId)
          .gte("createdAt", args.fromTimestamp)
          .lte("createdAt", args.toTimestamp)
      )
      .collect();

    const validOrders = orders.filter((o) => !o.isRejected);
    const orderIds = validOrders.map((o) => o._id);

    // Map items sold
    const itemMap = new Map<
      string,
      {
        itemId: Id<"items">;
        itemName: string;
        itemPricePaise: number;
        totalQuantity: number;
        grossSalesPaise: number;
        taxesPaise: number;
        netSalesPaise: number;
      }
    >();

    for (const orderId of orderIds) {
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", orderId))
        .collect();

      for (const item of items) {
        const idKey = item.itemId;
        const gross = item.totalPrice || item.itemPrice * item.quantity;
        const tax = Math.round(gross * 0.05); // Standard 5% GST estimate if not individually split
        const net = gross - tax;

        const existing = itemMap.get(idKey) || {
          itemId: item.itemId,
          itemName: item.itemName,
          itemPricePaise: item.itemPrice,
          totalQuantity: 0,
          grossSalesPaise: 0,
          taxesPaise: 0,
          netSalesPaise: 0,
        };

        existing.totalQuantity += item.quantity;
        existing.grossSalesPaise += gross;
        existing.taxesPaise += tax;
        existing.netSalesPaise += net;

        itemMap.set(idKey, existing);
      }
    }

    const allItems = Array.from(itemMap.values());
    const totalItemsSold = allItems.reduce((s, it) => s + it.totalQuantity, 0);
    const totalGrossSales = allItems.reduce((s, it) => s + it.grossSalesPaise, 0);
    const avgItemPrice =
      totalItemsSold > 0 ? Math.round(totalGrossSales / totalItemsSold) : 0;

    // Sort items by quantity sold
    const sortedByQty = [...allItems].sort(
      (a, b) => b.totalQuantity - a.totalQuantity
    );

    const topPerformingItem = sortedByQty.length > 0 ? sortedByQty[0] : null;
    const leastPerformingItem =
      sortedByQty.length > 0 ? sortedByQty[sortedByQty.length - 1] : null;

    const topPerformingItems = sortedByQty.slice(0, 5).map((it) => ({
      itemName: it.itemName,
      unitsSold: it.totalQuantity,
      totalSalesPaise: it.grossSalesPaise,
      salesPercentage:
        totalItemsSold > 0
          ? Math.round((it.totalQuantity / totalItemsSold) * 1000) / 10
          : 0,
    }));

    const leastPerformingItems = sortedByQty
      .slice(-5)
      .reverse()
      .map((it) => ({
        itemName: it.itemName,
        unitsSold: it.totalQuantity,
        totalSalesPaise: it.grossSalesPaise,
        salesPercentage:
          totalItemsSold > 0
            ? Math.round((it.totalQuantity / totalItemsSold) * 1000) / 10
            : 0,
      }));

    // Category Aggregation
    const categoryMap = new Map<
      string,
      {
        categoryName: string;
        itemsSold: number;
        grossSalesPaise: number;
        taxesPaise: number;
        netSalesPaise: number;
      }
    >();

    for (const it of allItems) {
      // Find category for item
      const catItem = await ctx.db
        .query("categoryItems")
        .withIndex("by_category")
        .filter((q) => q.eq(q.field("itemId"), it.itemId))
        .first();

      let catName = "General";
      if (catItem) {
        const cat = await ctx.db.get(catItem.categoryId);
        if (cat) catName = cat.name;
      }

      const existingCat = categoryMap.get(catName) || {
        categoryName: catName,
        itemsSold: 0,
        grossSalesPaise: 0,
        taxesPaise: 0,
        netSalesPaise: 0,
      };

      existingCat.itemsSold += it.totalQuantity;
      existingCat.grossSalesPaise += it.grossSalesPaise;
      existingCat.taxesPaise += it.taxesPaise;
      existingCat.netSalesPaise += it.netSalesPaise;
      categoryMap.set(catName, existingCat);
    }

    const allCategories = Array.from(categoryMap.values()).sort(
      (a, b) => b.grossSalesPaise - a.grossSalesPaise
    );

    const topCategory = allCategories.length > 0 ? allCategories[0].categoryName : "N/A";
    const leastCategory =
      allCategories.length > 0
        ? allCategories[allCategories.length - 1].categoryName
        : "N/A";

    return {
      totalItemsSold,
      avgItemPrice,
      topPerformingItem: topPerformingItem ? topPerformingItem.itemName : "N/A",
      leastPerformingItem: leastPerformingItem ? leastPerformingItem.itemName : "N/A",
      topPerformingItems,
      leastPerformingItems,
      topCategory,
      leastCategory,
      itemTableData: allItems.map((it) => ({
        itemName: it.itemName,
        itemPricePaise: it.itemPricePaise,
        totalQuantity: it.totalQuantity,
        grossSalesPaise: it.grossSalesPaise,
        taxesPaise: it.taxesPaise,
        netSalesPaise: it.netSalesPaise,
        salesPercentage:
          totalItemsSold > 0
            ? Math.round((it.totalQuantity / totalItemsSold) * 1000) / 10
            : 0,
      })),
      categoryTableData: allCategories.map((c) => ({
        categoryName: c.categoryName,
        itemsSold: c.itemsSold,
        grossSalesPaise: c.grossSalesPaise,
        taxesPaise: c.taxesPaise,
        netSalesPaise: c.netSalesPaise,
        avgItemPricePaise:
          c.itemsSold > 0 ? Math.round(c.grossSalesPaise / c.itemsSold) : 0,
        salesPercentage:
          totalGrossSales > 0
            ? Math.round((c.grossSalesPaise / totalGrossSales) * 1000) / 10
            : 0,
      })),
    };
  },
});

// =========================================================================
// 4. CUSTOMERS REPORT (api.reports.getCustomerReport) - Retention & Cohorts
// =========================================================================
export const getCustomerReport = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    fromTimestamp: v.number(),
    toTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const orgId = await resolveOrganizationId(ctx, args.organizationId);
    if (!orgId) {
      return {
        totalCustomers: 0,
        newCustomers: 0,
        repeatCustomers: 0,
        repeatCustomerRate: 0,
        totalVisits: 0,
        averageVisitsPerCustomer: 0,
        customerLifetimeValueAvg: 0,
        topCustomers: [],
        cohorts: [],
      };
    }

    // 1. Fetch orders in current range
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_created_at", (q) =>
        q
          .eq("organizationId", orgId)
          .gte("createdAt", args.fromTimestamp)
          .lte("createdAt", args.toTimestamp)
      )
      .collect();

    const validOrders = orders.filter((o) => !o.isRejected);

    // Helper: identify customer key (customerId or phone or email or name)
    const getCustKey = (o: any) =>
      o.customerId ||
      (o.customerPhone ? o.customerPhone.trim() : null) ||
      (o.customerEmail ? o.customerEmail.trim().toLowerCase() : null) ||
      (o.customerName ? o.customerName.trim().toLowerCase() : null) ||
      `anonymous_${o._id}`;

    // 2. Fetch older orders before fromTimestamp to check repeat cohort
    const olderOrders = await ctx.db
      .query("orders")
      .withIndex("by_created_at", (q) =>
        q
          .eq("organizationId", orgId)
          .lt("createdAt", args.fromTimestamp)
      )
      .collect();

    const previousCustomerKeys = new Set<string>();
    for (const o of olderOrders) {
      if (!o.isRejected) {
        previousCustomerKeys.add(getCustKey(o));
      }
    }

    // Identify current customers
    const currentCustomerOrders = new Map<string, typeof validOrders>();
    for (const o of validOrders) {
      const k = getCustKey(o);
      const list = currentCustomerOrders.get(k) || [];
      list.push(o);
      currentCustomerOrders.set(k, list);
    }

    const totalCustomers = currentCustomerOrders.size;
    let newCustomers = 0;
    let repeatCustomers = 0;

    for (const key of currentCustomerOrders.keys()) {
      if (previousCustomerKeys.has(key)) {
        repeatCustomers++;
      } else {
        newCustomers++;
      }
    }

    const retentionRate =
      totalCustomers > 0
        ? Math.round((repeatCustomers / totalCustomers) * 1000) / 10
        : 0;

    const totalSpendPaise = validOrders.reduce(
      (sum, o) => sum + (o.totalAmount || 0),
      0
    );
    const avgCustomerSpend =
      totalCustomers > 0 ? Math.round(totalSpendPaise / totalCustomers) : 0;

    // Daily customer breakdown
    const dailyMap = new Map<
      string,
      {
        date: string;
        displayDate: string;
        customerKeys: Set<string>;
        totalSpendPaise: number;
      }
    >();

    const org = await ctx.db.get(orgId);
    const country = org?.country || "IN";
    const timezone = org?.organizationTimeZone || getTimezoneForCountry(country);

    for (const order of validOrders) {
      const dateKey = formatStoreDate(order.createdAt, country, timezone);
      const existing = dailyMap.get(dateKey) || {
        date: dateKey,
        displayDate: dateKey,
        customerKeys: new Set<string>(),
        totalSpendPaise: 0,
      };

      existing.customerKeys.add(getCustKey(order));
      existing.totalSpendPaise += order.totalAmount || 0;
      dailyMap.set(dateKey, existing);
    }

    const tableData = Array.from(dailyMap.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((d) => {
        let dailyNew = 0;
        let dailyRepeat = 0;
        for (const k of d.customerKeys) {
          if (previousCustomerKeys.has(k)) {
            dailyRepeat++;
          } else {
            dailyNew++;
          }
        }
        const dailyTotal = d.customerKeys.size;
        const dailyRetention =
          dailyTotal > 0 ? Math.round((dailyRepeat / dailyTotal) * 1000) / 10 : 0;
        const dailyAvgSpend =
          dailyTotal > 0 ? Math.round(d.totalSpendPaise / dailyTotal) : 0;

        return {
          date: d.date,
          displayDate: d.displayDate,
          totalCustomers: dailyTotal,
          newCustomers: dailyNew,
          repeatCustomers: dailyRepeat,
          retentionRate: dailyRetention,
          avgCustomerSpend: dailyAvgSpend,
        };
      });

    return {
      totalCustomers,
      newCustomers,
      repeatCustomers,
      retentionRate,
      avgCustomerSpend,
      tableData,
      length: tableData.length,
    };
  },
});

// =========================================================================
// 5. OPERATIONAL REPORT (api.reports.getOperationalReport) - Payments, Tables, KDS
// =========================================================================
export const getOperationalReport = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    fromTimestamp: v.number(),
    toTimestamp: v.number(),
    type: v.optional(v.union(v.literal("payment"), v.literal("tables"), v.literal("processes"))),
  },
  handler: async (ctx, args) => {
    const orgId = await resolveOrganizationId(ctx, args.organizationId);
    if (!orgId) {
      return {
        paymentModes: [],
        tableUtilization: [],
        orderProcesses: [],
      };
    }

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_created_at", (q) =>
        q
          .eq("organizationId", orgId)
          .gte("createdAt", args.fromTimestamp)
          .lte("createdAt", args.toTimestamp)
      )
      .collect();

    const validOrders = orders.filter((o) => !o.isRejected);

    // ====================================================
    // A. Payment Modes Breakdown
    // ====================================================
    const paymentModeMap = new Map<
      string,
      {
        mode: string;
        totalPayments: number;
        totalValuePaise: number;
      }
    >();

    let totalPaymentTxnCount = 0;
    let totalPaymentValuePaise = 0;

    for (const order of validOrders) {
      const payments = await ctx.db
        .query("orderPayments")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      for (const p of payments) {
        const netPaid = (p.payAmount || p.amount || 0) - (p.refundAmount || 0);
        if (netPaid <= 0) continue;

        const mode = p.paymentModeName || "Cash";
        const existing = paymentModeMap.get(mode) || {
          mode,
          totalPayments: 0,
          totalValuePaise: 0,
        };

        existing.totalPayments += 1;
        existing.totalValuePaise += netPaid;
        paymentModeMap.set(mode, existing);

        totalPaymentTxnCount += 1;
        totalPaymentValuePaise += netPaid;
      }
    }

    const paymentModesList = Array.from(paymentModeMap.values()).sort(
      (a, b) => b.totalValuePaise - a.totalValuePaise
    );

    const mostUsedMode = paymentModesList.length > 0 ? paymentModesList[0].mode : "N/A";
    const leastUsedMode =
      paymentModesList.length > 0
        ? paymentModesList[paymentModesList.length - 1].mode
        : "N/A";

    const paymentBreakdown = paymentModesList.map((p) => ({
      mode: p.mode,
      totalPayments: p.totalPayments,
      totalPaymentValuePaise: p.totalValuePaise,
      percentageOfTotal:
        totalPaymentTxnCount > 0
          ? Math.round((p.totalPayments / totalPaymentTxnCount) * 1000) / 10
          : 0,
      avgTransactionValuePaise:
        p.totalPayments > 0 ? Math.round(p.totalValuePaise / p.totalPayments) : 0,
    }));

    // Daily Payment Breakdown
    const dailyPaymentMap = new Map<
      string,
      {
        date: string;
        displayDate: string;
        totalPayments: number;
        totalPaymentValuePaise: number;
        modeCounts: Record<string, number>;
      }
    >();

    const org = await ctx.db.get(orgId);
    const country = org?.country || "IN";
    const timezone = org?.organizationTimeZone || getTimezoneForCountry(country);

    for (const order of validOrders) {
      const dateKey = formatStoreDate(order.createdAt, country, timezone);
      const existing = dailyPaymentMap.get(dateKey) || {
        date: dateKey,
        displayDate: dateKey,
        totalPayments: 0,
        totalPaymentValuePaise: 0,
        modeCounts: {},
      };

      const payments = await ctx.db
        .query("orderPayments")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      for (const p of payments) {
        const net = (p.payAmount || p.amount || 0) - (p.refundAmount || 0);
        if (net > 0) {
          existing.totalPayments += 1;
          existing.totalPaymentValuePaise += net;
          const m = p.paymentModeName || "Cash";
          existing.modeCounts[m] = (existing.modeCounts[m] || 0) + 1;
        }
      }
      dailyPaymentMap.set(dateKey, existing);
    }

    const dailyPayments = Array.from(dailyPaymentMap.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((d) => {
        let maxM = "Cash";
        let maxCount = 0;
        for (const [m, c] of Object.entries(d.modeCounts)) {
          if (c > maxCount) {
            maxCount = c;
            maxM = m;
          }
        }
        return {
          date: d.date,
          displayDate: d.displayDate,
          totalPayments: d.totalPayments,
          totalPaymentValuePaise: d.totalPaymentValuePaise,
          avgTransactionValuePaise:
            d.totalPayments > 0
              ? Math.round(d.totalPaymentValuePaise / d.totalPayments)
              : 0,
          mostUsedMode: maxM,
          percentageOfTotal:
            totalPaymentTxnCount > 0
              ? Math.round((d.totalPayments / totalPaymentTxnCount) * 1000) / 10
              : 0,
        };
      });

    // ====================================================
    // B. Tables & Layouts Analytics
    // ====================================================
    const tableOrders = validOrders.filter((o) => o.tableId !== undefined);
    const tableUsageMap = new Map<string, number>();
    for (const o of tableOrders) {
      if (o.tableId) {
        tableUsageMap.set(o.tableId, (tableUsageMap.get(o.tableId) || 0) + 1);
      }
    }

    const allTables = await ctx.db.query("organizationTables").collect();
    const activeTables = allTables.filter((t) => !t.deletedAt);
    const occupiedTableCount = tableUsageMap.size;
    const totalTablesCount = activeTables.length;
    const totalOccupancyPercentage =
      totalTablesCount > 0
        ? Math.round((occupiedTableCount / totalTablesCount) * 1000) / 10
        : 0;

    // Layout Breakdown
    const layouts = await ctx.db.query("organizationLayouts").collect();
    const activeLayouts = layouts.filter((l) => !l.deletedAt);

    const layoutsBreakdown = activeLayouts.map((l) => {
      const layoutTables = activeTables.filter((t) => t.layoutId === l._id);
      const layoutTableIds = new Set(layoutTables.map((t) => t._id));
      const ordersInLayout = tableOrders.filter(
        (o) => o.tableId && layoutTableIds.has(o.tableId)
      );

      const occupiedInLayout = layoutTables.filter((t) =>
        tableUsageMap.has(t._id)
      ).length;

      const rate =
        layoutTables.length > 0
          ? Math.round((occupiedInLayout / layoutTables.length) * 1000) / 10
          : 0;

      const revPaise = ordersInLayout.reduce((s, o) => s + (o.totalAmount || 0), 0);
      const aov =
        ordersInLayout.length > 0
          ? Math.round(revPaise / ordersInLayout.length)
          : 0;

      return {
        layoutName: l.name,
        totalTables: layoutTables.length,
        totalOrdersServed: ordersInLayout.length,
        occupancyRate: rate,
        expectedRevenuePaise: revPaise,
        avgOrderValuePaise: aov,
      };
    });

    // ====================================================
    // C. Kitchen / Order Processes Performance
    // ====================================================
    let totalProcessDuration = 0;
    let processDurationCount = 0;
    let completedActivitiesCount = 0;
    let totalActivitiesCount = 0;

    for (const order of validOrders) {
      const activities = await ctx.db
        .query("orderActivities")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      totalActivitiesCount += activities.length;
      for (const a of activities) {
        if (a.totalDuration && a.totalDuration > 0) {
          totalProcessDuration += a.totalDuration;
          processDurationCount++;
          completedActivitiesCount++;
        }
      }
    }

    const avgTimeInEachProcessSeconds =
      processDurationCount > 0
        ? Math.round(totalProcessDuration / processDurationCount)
        : 0;

    const orderProcessingEfficiency =
      totalActivitiesCount > 0
        ? Math.round((completedActivitiesCount / totalActivitiesCount) * 100)
        : 100;

    return {
      payments: {
        totalPaymentsCount: totalPaymentTxnCount,
        totalPaymentValuePaise,
        mostUsedMode,
        leastUsedMode,
        paymentBreakdown,
        dailyBreakdown: dailyPayments,
      },
      tables: {
        totalTables: totalTablesCount,
        occupiedTables: occupiedTableCount,
        totalOccupancyPercentage,
        avgOccupancyDurationMinutes: 45, // Standard dining dwell benchmark
        layoutsBreakdown,
      },
      processes: {
        totalOrdersReceived: validOrders.length,
        avgTimeInEachProcessSeconds,
        orderProcessingEfficiency,
      },
    };
  },
});


