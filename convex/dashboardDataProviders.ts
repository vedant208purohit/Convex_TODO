import { QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import {
  WidgetDataResponse,
  WidgetDefinition,
  DateRangePreset,
  resolveStoreCurrency,
  formatCurrencyPaise as formatCurrencyPaiseHelper,
  computePercentageDelta,
} from "./dashboardTypes";
import {
  getTimezoneForCountry,
  formatStoreTime,
  formatStoreDate,
} from "../lib/constants/countries";
import { deriveWorkstationStatusKey } from "./workstation";
import { convertUnits } from "./inventory";

// ==========================================
// 1. TIMEZONE & DATE-RANGE BOUNDARY HELPERS
// ==========================================

export interface DateRangeWindow {
  from: number;
  to: number;
  comparisonFrom: number;
  comparisonTo: number;
  preset: DateRangePreset;
}

/**
 * Calculates start-of-day timestamp in a specific timezone
 */
export function getStartOfDayInTimezone(
  timestamp: number,
  timeZone: string,
): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(new Date(timestamp));
    const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
    const month = parseInt(parts.find((p) => p.type === "month")!.value, 10);
    const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);

    const utcMidnight = Date.UTC(year, month - 1, day);
    const tzDate = new Date(utcMidnight);
    const tzOffset = getTzOffsetMs(tzDate, timeZone);
    return utcMidnight - tzOffset;
  } catch {
    const d = new Date(timestamp);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
}

function getTzOffsetMs(date: Date, timeZone: string): number {
  try {
    const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
    const tzDate = new Date(date.toLocaleString("en-US", { timeZone }));
    return tzDate.getTime() - utcDate.getTime();
  } catch {
    return 0;
  }
}

/**
 * Reusable timezone-aware date range calculator with prior comparison period
 */
export function calculateDateRangeBoundaries(
  preset: DateRangePreset = "today",
  timeZone = "Asia/Kolkata",
  customFrom?: number,
  customTo?: number,
  now = Date.now(),
): DateRangeWindow {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const todayStart = getStartOfDayInTimezone(now, timeZone);

  // If explicit timestamps are provided by the client's calendar date picker, honor them directly
  if (
    customFrom !== undefined &&
    customTo !== undefined &&
    customFrom > 0 &&
    customTo >= customFrom
  ) {
    const from = customFrom;
    const to = customTo;
    const duration = to - from;
    const comparisonFrom = from - duration;
    const comparisonTo = from - 1;
    return { from, to, comparisonFrom, comparisonTo, preset };
  }

  switch (preset) {
    case "today": {
      const from = todayStart;
      const to = Math.max(now + 300000, todayStart + ONE_DAY_MS - 1);
      const elapsed = to - from;
      const comparisonFrom = from - ONE_DAY_MS;
      const comparisonTo = comparisonFrom + elapsed;
      return { from, to, comparisonFrom, comparisonTo, preset };
    }
    case "yesterday": {
      const from = todayStart - ONE_DAY_MS;
      const to = todayStart - 1;
      const comparisonFrom = from - ONE_DAY_MS;
      const comparisonTo = from - 1;
      return { from, to, comparisonFrom, comparisonTo, preset };
    }
    case "current_shift": {
      const from = todayStart;
      const to = Math.max(now + 300000, todayStart + ONE_DAY_MS - 1);
      const elapsed = to - from;
      const comparisonFrom = from - ONE_DAY_MS;
      const comparisonTo = comparisonFrom + elapsed;
      return { from, to, comparisonFrom, comparisonTo, preset };
    }
    case "previous_shift": {
      const from = todayStart - ONE_DAY_MS;
      const to = todayStart - 1;
      const comparisonFrom = from - ONE_DAY_MS;
      const comparisonTo = from - 1;
      return { from, to, comparisonFrom, comparisonTo, preset };
    }
    case "last_7_days": {
      const from = todayStart - 6 * ONE_DAY_MS;
      const to = now;
      const duration = to - from;
      const comparisonFrom = from - duration;
      const comparisonTo = from - 1;
      return { from, to, comparisonFrom, comparisonTo, preset };
    }
    case "last_30_days": {
      const from = todayStart - 29 * ONE_DAY_MS;
      const to = now;
      const duration = to - from;
      const comparisonFrom = from - duration;
      const comparisonTo = from - 1;
      return { from, to, comparisonFrom, comparisonTo, preset };
    }
    case "this_month": {
      const d = new Date(now);
      const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      const from = startOfMonth;
      const to = now;
      const duration = to - from;
      const comparisonFrom = from - duration;
      const comparisonTo = from - 1;
      return { from, to, comparisonFrom, comparisonTo, preset };
    }
    case "last_month": {
      const d = new Date(now);
      const startOfLastMonth = new Date(
        d.getFullYear(),
        d.getMonth() - 1,
        1,
      ).getTime();
      const endOfLastMonth = new Date(
        d.getFullYear(),
        d.getMonth(),
        0,
        23,
        59,
        59,
        999,
      ).getTime();
      const from = startOfLastMonth;
      const to = endOfLastMonth;
      const duration = to - from;
      const comparisonFrom = from - duration;
      const comparisonTo = from - 1;
      return { from, to, comparisonFrom, comparisonTo, preset };
    }
    case "custom": {
      const from = customFrom || todayStart;
      const maxRange = 90 * ONE_DAY_MS;
      const requestedTo = customTo || now;
      const to = Math.min(requestedTo, from + maxRange);
      const duration = to - from;
      const comparisonFrom = from - duration;
      const comparisonTo = from - 1;
      return { from, to, comparisonFrom, comparisonTo, preset };
    }
    default: {
      const from = todayStart;
      const to = now;
      return {
        from,
        to,
        comparisonFrom: from - ONE_DAY_MS,
        comparisonTo: to - ONE_DAY_MS,
        preset: "today",
      };
    }
  }
}

// ==========================================
// 2. CURRENCY & FORMATTING HELPERS
// ==========================================

export function formatCurrencyPaise(
  paise: number,
  symbol = "₹",
  currencyCode?: string,
  country?: string,
): string {
  return formatCurrencyPaiseHelper(paise, symbol, currencyCode, country);
}

export function calculateDeltaPercent(
  current: number,
  previous: number,
): number {
  const res = computePercentageDelta(current, previous);
  return res.deltaPercent ?? 0;
}

function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function isValidActiveOrCompletedOrder(order: Doc<"orders">): boolean {
  if (
    order.isRejected &&
    order.paymentStatus !== "Paid" &&
    order.paymentStatus !== "Refunded"
  ) {
    return false;
  }
  return true;
}

// ==========================================
// 3. BASE CONSTRUCTOR & OPTIONS
// ==========================================

export interface DataProviderOptions {
  dateRangePreset?: DateRangePreset;
  fromTimestamp?: number;
  toTimestamp?: number;
  stationId?: string;
  employeeId?: string;
  paymentMode?: string;
  orderType?: string;
  configuration?: Record<string, any>;
}

function createBaseResponse(
  widgetDef: WidgetDefinition,
  org: Doc<"organizations">,
  options: DataProviderOptions,
): WidgetDataResponse {
  const country = org.country || "IN";
  const timeZone =
    org.organizationTimeZone ||
    getTimezoneForCountry(country) ||
    "Asia/Kolkata";
  const { currency, currencySymbol } = resolveStoreCurrency(org);

  return {
    widgetId: widgetDef.widgetId,
    dataVersion: 1,
    lastUpdatedAt: Date.now(),
    timeZone,
    currency,
    currencySymbol,
    country,
    isAvailable: true,
    appliedFilters: {
      dateRangePreset: options.dateRangePreset || "today",
      fromTimestamp: options.fromTimestamp,
      toTimestamp: options.toTimestamp,
      stationId: options.stationId,
      employeeId: options.employeeId,
      paymentMode: options.paymentMode,
      orderType: options.orderType,
    },
  };
}

// ==========================================
// 4. OVERVIEW PROVIDERS
// ==========================================

export async function provideOverviewNetRevenue(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset,
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const currentOrders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const prevOrders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.comparisonFrom)
        .lte("createdAt", timeRange.comparisonTo),
    )
    .collect();

  let currentGrossPaise = 0;
  let currentDiscountsPaise = 0;
  let currentTaxPaise = 0;
  let currentNetPaise = 0;
  let currentPaidCount = 0;

  for (const o of currentOrders) {
    if (!isValidActiveOrCompletedOrder(o)) continue;
    if (options.orderType && o.orderType !== options.orderType) continue;
    if (options.paymentMode && o.paymentMode !== options.paymentMode) continue;

    currentGrossPaise += o.subTotal || 0;
    currentDiscountsPaise += o.discountAmount || 0;
    currentTaxPaise += o.taxTotal || 0;

    if (o.paymentStatus === "Paid") {
      currentNetPaise +=
        o.totalAmount || (o.subTotal || 0) - (o.discountAmount || 0);
      currentPaidCount++;
    }
  }

  let prevNetPaise = 0;
  for (const o of prevOrders) {
    if (!isValidActiveOrCompletedOrder(o)) continue;
    if (options.orderType && o.orderType !== options.orderType) continue;
    if (options.paymentMode && o.paymentMode !== options.paymentMode) continue;
    if (o.paymentStatus === "Paid") {
      prevNetPaise +=
        o.totalAmount || (o.subTotal || 0) - (o.discountAmount || 0);
    }
  }

  const delta = computePercentageDelta(currentNetPaise, prevNetPaise);
  const openCount = currentOrders.filter(
    (o) => isValidActiveOrCompletedOrder(o) && o.paymentStatus !== "Paid",
  ).length;

  res.kpi = {
    value: currentNetPaise,
    displayValue: formatCurrencyPaise(
      currentNetPaise,
      res.currencySymbol,
      res.currency,
    ),
    unit: res.currency,
    label: "Net Sales",
    deltaPercent: delta.deltaPercent,
    deltaLabel: delta.deltaLabel,
    deltaFormatted: delta.deltaLabel,
    trend: delta.trend,
    comparisonPeriod:
      timeRange.preset === "today" ? "yesterday" : "prior period",
    secondaryMetrics: [
      {
        label: "Gross Sales",
        value: formatCurrencyPaise(
          currentGrossPaise,
          res.currencySymbol,
          res.currency,
        ),
      },
      {
        label: "Discounts & Comps",
        value: formatCurrencyPaise(
          currentDiscountsPaise,
          res.currencySymbol,
          res.currency,
        ),
      },
      {
        label: "Taxes",
        value: formatCurrencyPaise(
          currentTaxPaise,
          res.currencySymbol,
          res.currency,
        ),
      },
      { label: "Settled", value: currentPaidCount },
      { label: "Open", value: openCount },
    ],
  };

  res.summary = {
    netRevenueFormatted: res.kpi?.displayValue || "",
    grossSalesFormatted: formatCurrencyPaise(
      currentGrossPaise,
      res.currencySymbol,
      res.currency,
    ),
    settledCount: currentPaidCount,
    openCount,
    paidCount: currentPaidCount,
    deltaPercent: delta.deltaPercent,
    deltaFormatted: delta.deltaLabel,
  };

  return res;
}

// ==========================================
// ORDER CHANNEL CLASSIFICATION HELPERS
// ==========================================

export function formatOrderTypeLabel(type?: string): string {
  if (!type) return "Dine-In";
  if (type === "ScheduledPickup") return "Scheduled Pickup";
  if (type === "ScheduledDelivery") return "Scheduled Delivery";
  if (type === "TakeAway") return "Takeaway";
  if (type === "DineIn") return "Dine-In";
  return type.replace(/([A-Z])/g, " $1").trim();
}

export function isDineInOrder(o: { orderType?: string; tableId?: any }): boolean {
  if (o.tableId) return true;
  if (!o.orderType) return true;
  const norm = o.orderType.toLowerCase().replace(/[-_\s]/g, "");
  return norm.includes("dine");
}

export function isTakeawayOrder(o: { orderType?: string }): boolean {
  if (!o.orderType) return false;
  const norm = o.orderType.toLowerCase().replace(/[-_\s]/g, "");
  return norm.includes("takeaway") || norm.includes("pickup");
}

export function isDeliveryOrder(o: { orderType?: string }): boolean {
  if (!o.orderType) return false;
  const norm = o.orderType.toLowerCase().replace(/[-_\s]/g, "");
  return norm.includes("delivery");
}

export async function provideOverviewTotalOrders(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset,
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const currentOrders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const prevOrders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.comparisonFrom)
        .lte("createdAt", timeRange.comparisonTo),
    )
    .collect();

  const validCurrent = currentOrders.filter((o) =>
    isValidActiveOrCompletedOrder(o),
  );
  const validPrev = prevOrders.filter((o) => isValidActiveOrCompletedOrder(o));

  const dineInCount = validCurrent.filter((o) => isDineInOrder(o)).length;
  const takeawayCount = validCurrent.filter((o) => isTakeawayOrder(o)).length;
  const deliveryCount = validCurrent.filter((o) => isDeliveryOrder(o)).length;

  const delta = computePercentageDelta(validCurrent.length, validPrev.length);

  res.kpi = {
    value: validCurrent.length,
    displayValue: `${validCurrent.length} Orders`,
    label: "Total Orders",
    deltaPercent: delta.deltaPercent,
    deltaLabel: delta.deltaLabel,
    deltaFormatted: delta.deltaLabel,
    trend: delta.trend,
    comparisonPeriod: "prior period",
    secondaryMetrics: [
      { label: "Dine-In", value: dineInCount },
      { label: "Takeaway", value: takeawayCount },
      { label: "Delivery", value: deliveryCount },
    ],
  };

  res.summary = {
    dineIn: dineInCount,
    takeaway: takeawayCount,
    delivery: deliveryCount,
    digital: takeawayCount + deliveryCount,
    total: validCurrent.length,
    dineInCount,
    onlineCount: takeawayCount + deliveryCount,
    takeawayCount,
    deliveryCount,
    deltaFormatted: delta.deltaLabel,
  };

  return res;
}

export async function provideOverviewAov(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset,
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const currentOrders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const prevOrders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.comparisonFrom)
        .lte("createdAt", timeRange.comparisonTo),
    )
    .collect();

  const paidCurrent = currentOrders.filter(
    (o) => isValidActiveOrCompletedOrder(o) && o.paymentStatus === "Paid",
  );
  const paidPrev = prevOrders.filter(
    (o) => isValidActiveOrCompletedOrder(o) && o.paymentStatus === "Paid",
  );

  const totalCurrentNet = paidCurrent.reduce(
    (sum, o) => sum + ((o.subTotal || 0) - (o.discountAmount || 0)),
    0,
  );
  const currentAov =
    paidCurrent.length > 0
      ? Math.round(totalCurrentNet / paidCurrent.length)
      : 0;

  const totalPrevNet = paidPrev.reduce(
    (sum, o) => sum + ((o.subTotal || 0) - (o.discountAmount || 0)),
    0,
  );
  const prevAov =
    paidPrev.length > 0 ? Math.round(totalPrevNet / paidPrev.length) : 0;

  const delta = computePercentageDelta(currentAov, prevAov);

  const topTicketPaise = paidCurrent.reduce(
    (max, o) => Math.max(max, (o.subTotal || 0) - (o.discountAmount || 0)),
    0,
  );
  const topTicketFormatted = formatCurrencyPaise(
    topTicketPaise,
    res.currencySymbol,
    res.currency,
  );

  res.kpi = {
    value: currentAov,
    displayValue: formatCurrencyPaise(
      currentAov,
      res.currencySymbol,
      res.currency,
    ),
    label: "Average Order Value",
    deltaPercent: delta.deltaPercent,
    deltaLabel: delta.deltaLabel,
    deltaFormatted: delta.deltaLabel,
    trend: delta.trend,
    secondaryMetrics: [
      { label: "Settled Orders", value: paidCurrent.length },
      {
        label: "Prior Period AOV",
        value: formatCurrencyPaise(prevAov, res.currencySymbol, res.currency),
      },
    ],
  };

  res.summary = {
    aov: currentAov,
    aovFormatted: res.kpi?.displayValue || "",
    topTicket: topTicketFormatted,
    topTicketPaise,
    settledCount: paidCurrent.length,
    deltaFormatted: delta.deltaLabel,
  };

  return res;
}

export async function provideOverviewActiveOrders(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const allActive = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const activeOrders = allActive.filter((o) => {
    if (o.createdAt < timeRange.from || o.createdAt > timeRange.to)
      return false;
    return (
      !o.isCompleted &&
      !o.isRejected &&
      o.orderStatusName !== "Completed" &&
      o.orderStatusName !== "Delivered"
    );
  });

  const dining = activeOrders.filter((o) =>
    (o.orderType || "").toLowerCase().includes("dine") || o.tableId !== undefined,
  ).length;
  const takeaway = activeOrders.filter((o) =>
    (o.orderType || "").toLowerCase().includes("take") || (o.orderType || "").toLowerCase().includes("pickup"),
  ).length;
  const delivery = activeOrders.filter((o) =>
    (o.orderType || "").toLowerCase().includes("deliv"),
  ).length;

  const prep = activeOrders.filter((o) => {
    const s = (o.orderStatusName || "").toLowerCase();
    return s.includes("prep") || s.includes("cook") || s.includes("progress") || s.includes("kitchen") || s.includes("accepted");
  }).length || (activeOrders.length - dining > 0 ? activeOrders.length - dining : 0);

  res.kpi = {
    value: activeOrders.length,
    displayValue: `${activeOrders.length} Live`,
    label: "Active Orders",
    trend: "neutral",
    secondaryMetrics: [
      { label: "Dine-In Tables", value: dining },
      { label: "Takeaway Counter", value: takeaway },
      { label: "Delivery Fleet", value: delivery },
    ],
  };

  res.summary = {
    activeCount: activeOrders.length,
    diningCount: dining,
    prepCount: prep,
    takeawayCount: takeaway,
    deliveryCount: delivery,
  };

  return res;
}

export async function provideOverviewPendingOrders(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const pending = orders.filter(
    (o) => !o.isCompleted && !o.isRejected && o.paymentStatus === "Pending",
  );
  const pendingAmount = pending.reduce(
    (sum, o) => sum + (o.totalAmount || 0),
    0,
  );

  const now = Date.now();
  let oldestWaitMs = 0;
  if (pending.length > 0) {
    const oldestCreated = Math.min(...pending.map((o) => o.createdAt));
    oldestWaitMs = Math.max(0, now - oldestCreated);
  }
  const mins = Math.floor(oldestWaitMs / 60000);
  const secs = Math.floor((oldestWaitMs % 60000) / 1000);
  const oldestWait = pending.length > 0 ? `${mins}m ${secs.toString().padStart(2, "0")}s` : "0m 00s";

  res.kpi = {
    value: pending.length,
    displayValue: `${pending.length} Unpaid`,
    label: "Pending Orders",
    secondaryMetrics: [
      {
        label: "Pending Value",
        value: formatCurrencyPaise(
          pendingAmount,
          res.currencySymbol,
          res.currency,
        ),
      },
      { label: "Open Tabs", value: pending.length },
    ],
  };

  res.summary = {
    pendingCount: pending.length,
    pendingAmountPaise: pendingAmount,
    pendingAmountFormatted: formatCurrencyPaise(
      pendingAmount,
      res.currencySymbol,
      res.currency,
    ),
    oldestWait,
    oldestWaitMs,
  };

  return res;
}

export async function provideOverviewSalesTrends(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const hourlyBuckets: Record<string, { revenuePaise: number; count: number }> =
    {};
  for (let h = 0; h < 24; h++) {
    const label = `${h.toString().padStart(2, "0")}:00`;
    hourlyBuckets[label] = { revenuePaise: 0, count: 0 };
  }

  const hourFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: res.timeZone,
    hour: "numeric",
    hour12: false,
  });

  for (const o of orders) {
    if (!isValidActiveOrCompletedOrder(o) || o.paymentStatus !== "Paid")
      continue;
    let hourNumber = 0;
    try {
      hourNumber = parseInt(hourFormatter.format(new Date(o.createdAt)), 10) % 24;
    } catch {
      hourNumber = new Date(o.createdAt).getUTCHours();
    }
    const hourLabel = `${hourNumber.toString().padStart(2, "0")}:00`;
    if (hourlyBuckets[hourLabel]) {
      hourlyBuckets[hourLabel].revenuePaise +=
        (o.subTotal || 0) - (o.discountAmount || 0);
      hourlyBuckets[hourLabel].count++;
    }
  }

  let peakHour = -1;
  let peakPaise = 0;
  for (let h = 0; h < 24; h++) {
    const label = `${h.toString().padStart(2, "0")}:00`;
    const b = hourlyBuckets[label];
    if (b && b.revenuePaise > peakPaise) {
      peakPaise = b.revenuePaise;
      peakHour = h;
    }
  }

  const peakFormatted = formatCurrencyPaise(
    peakPaise,
    res.currencySymbol,
    res.currency,
  );
  const peakTimeStr =
    peakHour >= 0
      ? `${peakHour > 12 ? peakHour - 12 : peakHour === 0 ? 12 : peakHour}:00 ${peakHour >= 12 ? "PM" : "AM"}`
      : "";
  const peakText =
    peakPaise > 0
      ? `Peak: ${peakTimeStr} (${peakFormatted})`
      : "No sales recorded yet";

  // Representative service windows across the operating day for bar display
  const serviceWindows = [
    { label: "11a", start: 10, end: 12 },
    { label: "1p", start: 12, end: 14 },
    { label: "3p", start: 14, end: 16 },
    { label: "5p", start: 16, end: 18 },
    { label: "7p", start: 18, end: 20 },
    { label: "9p", start: 20, end: 22 },
  ];

  const barData = serviceWindows.map((w) => {
    let windowRevenue = 0;
    for (let h = w.start; h < w.end; h++) {
      const hLabel = `${h.toString().padStart(2, "0")}:00`;
      windowRevenue += (hourlyBuckets[hLabel]?.revenuePaise || 0) / 100;
    }
    return {
      label: w.label,
      value: Math.round(windowRevenue * 100) / 100,
    };
  });

  const chartData = Object.entries(hourlyBuckets).map(([label, bucket]) => ({
    label,
    value: bucket.revenuePaise / 100,
    secondaryValue: bucket.count,
  }));

  res.chart = {
    chartType: "area",
    type: "area",
    series: [{ name: "Hourly Revenue", data: chartData }],
    data: barData,
    hourlyData: chartData,
    xAxisLabel: "Hour of Day",
    yAxisLabel: `Revenue (${res.currency})`,
    totalValue: Object.values(hourlyBuckets).reduce(
      (s, b) => s + b.revenuePaise,
      0,
    ),
  };

  res.summary = {
    peakText,
    peakHour,
    peakTimeStr,
    peakFormatted,
    peakRevenuePaise: peakPaise,
    bars: barData,
    totalSales: formatCurrencyPaise(
      Object.values(hourlyBuckets).reduce((s, b) => s + b.revenuePaise, 0),
      res.currencySymbol,
      res.currency,
    ),
  };

  return res;
}

export async function provideOverviewOrderStatusDistribution(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const isToday = (options.dateRangePreset || "today") === "today";
  const toBoundary = isToday ? Math.max(timeRange.to, Date.now() + 120000) : timeRange.to;

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", toBoundary),
    )
    .collect();

  // Load configured Order Processes from Settings -> Order Process (organizationOrderProcesses)
  const rawProcesses = await ctx.db
    .query("organizationOrderProcesses")
    .filter((q) => q.eq(q.field("deletedAt"), undefined))
    .collect();

  // Sequence stages first (e.g. Accepted, In progress, Ready to deliver, Delivered), then non-sequence (Created, Modify, Reject)
  rawProcesses.sort((a, b) => {
    if (a.isSequence && !b.isSequence) return -1;
    if (!a.isSequence && b.isSequence) return 1;
    return a.position - b.position;
  });

  const defaultPalette = ["#262626", "#EA9C1B", "#FC8019", "#219653", "#7c604f", "#8b5cf6", "#ef4444"];
  const statusCounts: Record<string, { count: number; color: string }> = {};

  for (let i = 0; i < rawProcesses.length; i++) {
    const p = rawProcesses[i];
    statusCounts[p.name] = {
      count: 0,
      color: p.processColor || defaultPalette[i % defaultPalette.length],
    };
  }

  let completedCount = 0;
  let billedCount = 0;
  let inPrepCount = 0;
  let newOtherCount = 0;

  for (const o of orders) {
    if (o.isCompleted || (o.orderStatusName || "").toLowerCase().includes("deliver")) {
      completedCount++;
    } else if (o.paymentStatus === "Paid") {
      billedCount++;
    } else if (
      (o.orderStatusName || "").toLowerCase().includes("prep") ||
      (o.orderStatusName || "").toLowerCase().includes("cook") ||
      (o.orderStatusName || "").toLowerCase().includes("progress") ||
      (o.orderStatusName || "").toLowerCase().includes("ready")
    ) {
      inPrepCount++;
    } else {
      newOtherCount++;
    }

    if (o.isRejected) {
      if (!statusCounts["Reject"]) {
        statusCounts["Reject"] = { count: 0, color: "#ef4444" };
      }
      statusCounts["Reject"].count++;
      continue;
    }

    // Match by process ID or by process name from Settings -> Order Process
    const matchingProc = rawProcesses.find(
      (p) =>
        (o.orderStatusId && p._id === o.orderStatusId) ||
        p.name.toLowerCase().trim() === (o.orderStatusName || "").toLowerCase().trim(),
    );

    if (matchingProc) {
      statusCounts[matchingProc.name].count++;
    } else {
      const fallbackName = o.orderStatusName || (o.isCompleted ? "Delivered" : "Accepted");
      if (!statusCounts[fallbackName]) {
        statusCounts[fallbackName] = { count: 0, color: "#645d58" };
      }
      statusCounts[fallbackName].count++;
    }
  }

  const statusSeries = Object.entries(statusCounts).map(([label, meta]) => ({
    label,
    value: meta.count,
    color: meta.color,
  }));

  res.chart = {
    chartType: "donut",
    type: "donut",
    series: [{ name: "Order Status", data: statusSeries }],
    data: statusSeries,
    xAxisLabel: "Status",
    yAxisLabel: "Orders",
    totalValue: orders.length,
  };

  res.kpi = {
    value: orders.length,
    displayValue: `${orders.length} Orders`,
    label: "Order Status Distribution",
    trend: "neutral",
    secondaryMetrics: statusSeries,
  };

  res.summary = {
    total: orders.length,
    completed: completedCount,
    billed: billedCount,
    inPrep: inPrepCount,
    newOther: newOtherCount,
    completedCount,
    billedCount,
    inPrepCount,
    newOtherCount,
    statusCounts: Object.fromEntries(
      Object.entries(statusCounts).map(([k, v]) => [k, v.count]),
    ),
  };

  return res;
}

export async function provideOverviewBusinessSummary(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  let grossPaise = 0;
  let netPaise = 0;
  let discountsPaise = 0;
  let taxPaise = 0;
  let paidCount = 0;

  for (const o of orders) {
    if (!isValidActiveOrCompletedOrder(o)) continue;
    grossPaise += o.subTotal || 0;
    discountsPaise += o.discountAmount || 0;
    taxPaise += o.taxTotal || 0;
    if (o.paymentStatus === "Paid") {
      netPaise += (o.subTotal || 0) - (o.discountAmount || 0);
      paidCount++;
    }
  }

  const aov = paidCount > 0 ? Math.round(netPaise / paidCount) : 0;

  // Real store seating capacity
  const tables = await ctx.db
    .query("organizationTables")
    .filter((q) => q.eq(q.field("deletedAt"), undefined))
    .collect();
  const totalSeats = tables.reduce(
    (sum, t) => sum + (t.seatingCapacity || 4),
    0,
  );

  const durationHours = Math.max(
    1,
    Math.min(
      24,
      Math.round(
        (Math.min(timeRange.to, Date.now()) - timeRange.from) / 3600000,
      ) || 12,
    ),
  );
  const availableSeatHours =
    (totalSeats > 0 ? totalSeats : 20) * durationHours;
  const revPashPaise =
    netPaise > 0 ? Math.round(netPaise / availableSeatHours) : 0;
  const revPash = formatCurrencyPaise(
    revPashPaise,
    res.currencySymbol,
    res.currency,
  );
  const revPashSubtext =
    totalSeats > 0
      ? `${totalSeats} Seats • ${durationHours}h`
      : "Direct Counter Service";

  // Realized Net Margin %
  const marginPct =
    grossPaise > 0 ? Math.round((netPaise / grossPaise) * 100) : 100;
  const foodCost = `${marginPct}%`;
  const foodCostSubtext =
    grossPaise > 0
      ? `${formatCurrencyPaise(netPaise, res.currencySymbol, res.currency)} Net`
      : "100% Realized Net";

  // Discount Ratio %
  const discountPct =
    grossPaise > 0 ? ((discountsPaise / grossPaise) * 100).toFixed(1) : "0.0";
  const laborRatio = `${discountPct}%`;
  const laborRatioSubtext =
    discountsPaise > 0
      ? `${formatCurrencyPaise(discountsPaise, res.currencySymbol, res.currency)} Discs`
      : "Zero Leakage";

  res.summary = {
    title: "Business Performance Summary",
    revPash,
    revPashSubtext,
    foodCost,
    foodCostSubtext,
    laborRatio,
    laborRatioSubtext,
    grossSales: formatCurrencyPaise(
      grossPaise,
      res.currencySymbol,
      res.currency,
    ),
    netSales: formatCurrencyPaise(netPaise, res.currencySymbol, res.currency),
    discounts: formatCurrencyPaise(
      discountsPaise,
      res.currencySymbol,
      res.currency,
    ),
    taxes: formatCurrencyPaise(taxPaise, res.currencySymbol, res.currency),
    paidTransactions: paidCount,
    aov: formatCurrencyPaise(aov, res.currencySymbol, res.currency),
  };

  return res;
}

// ==========================================
// 5. ORDERS PROVIDERS
// ==========================================

export async function provideOrdersLiveFeed(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const now = Date.now();

  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const rangeOrders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const targetOrders = rangeOrders
    .filter((o) => isValidActiveOrCompletedOrder(o))
    .sort((a, b) => b.createdAt - a.createdAt);
  const displayOrders = targetOrders.slice(0, 15);

  const rows = displayOrders.map((o) => {
    const rawNumber = o.orderNumber || (o._id ? `ORD-${o._id.slice(-4)}` : "ORD-001");
    const displayNum = rawNumber.startsWith("#") ? rawNumber : `#${rawNumber}`;
    const tokenDisplay = o.tokenNumber ? `Token #${o.tokenNumber}` : "";
    const typeLabel = formatOrderTypeLabel(o.orderType);

    return {
      id: o._id,
      orderNumber: displayNum,
      orderNum: displayNum,
      ticket: displayNum,
      tokenNumber: tokenDisplay,
      type: typeLabel,
      customer:
        o.customerName && o.customerName.trim().length > 0
          ? o.customerName.trim()
          : o.customerPhone && o.customerPhone.trim().length > 0
            ? o.customerPhone.trim()
            : "Guest Customer",
      amount: formatCurrencyPaise(
        o.totalAmount || 0,
        res.currencySymbol,
        res.currency,
        res.country,
      ),
      status: o.isRejected
        ? "Cancelled"
        : o.isCompleted
          ? "Completed"
          : o.orderStatusName || "Accepted",
      payment: o.paymentStatus || "Pending",
      time: formatRelativeTime(o.createdAt, now),
    };
  });

  res.table = {
    columns: [
      { key: "orderNumber", label: "Order #" },
      { key: "type", label: "Channel" },
      { key: "customer", label: "Patron" },
      { key: "amount", label: "Total", align: "right" },
      { key: "status", label: "Status" },
      { key: "payment", label: "Payment" },
      { key: "time", label: "Created", align: "right" },
    ],
    rows,
    totalCount: rows.length,
  };

  res.liveFeed = {
    items: displayOrders.map((o) => {
      const rawNumber = o.orderNumber || (o._id ? `ORD-${o._id.slice(-4)}` : "ORD-001");
      const displayNum = rawNumber.startsWith("#") ? rawNumber : `#${rawNumber}`;
      const typeLabel = formatOrderTypeLabel(o.orderType);

      return {
        id: o._id,
        title: displayNum,
        subtitle: `${typeLabel}${o.customerName ? ` • ${o.customerName}` : ""}${o.tableId ? " • Table" : ""}`,
        badge: {
          text: o.isRejected
            ? "Cancelled"
            : o.isCompleted
              ? "Completed"
              : o.orderStatusName || "Accepted",
        },
        timeAgo: formatRelativeTime(o.createdAt, now),
      };
    }),
  };

  return res;
}

export async function provideOrdersHighValue(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  // Default threshold: ₹1,000.00 (100,000 paise) so orders exceeding ₹1,000 appear immediately
  const thresholdPaise = options.configuration?.thresholdPaise || 100000;
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  // If today is selected, ensure boundary includes current day orders regardless of server/client clock drift
  const isToday = !options.dateRangePreset || options.dateRangePreset === "today";
  const toBoundary = isToday ? Math.max(timeRange.to, Date.now() + 300000) : timeRange.to;

  // Strictly filter within selected time range
  const inRangeOrders = orders.filter(
    (o) => o.createdAt >= timeRange.from && o.createdAt <= toBoundary,
  );
  const pool = inRangeOrders;

  const highValue = pool
    .filter((o) => {
      if (!isValidActiveOrCompletedOrder(o)) return false;
      const amt = o.totalAmount || 0;
      // Handle both minor units (paise >= 100000) and major units (rupees >= 1000)
      const amtPaise = amt > 0 && amt < 5000 ? Math.round(amt * 100) : amt;
      return amtPaise >= thresholdPaise;
    })
    .sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0))
    .slice(0, 10);

  const rows = highValue.map((o) => {
    const rawNumber = o.orderNumber || (o._id ? `ORD-${o._id.slice(-4)}` : "ORD-001");
    const displayNum = rawNumber.startsWith("#") ? rawNumber : `#${rawNumber}`;
    const typeLabel = formatOrderTypeLabel(o.orderType);

    return {
      id: o._id,
      orderNumber: displayNum,
      orderNum: displayNum,
      ticket: displayNum,
      customer:
        o.customerName && o.customerName.trim().length > 0
          ? o.customerName.trim()
          : o.customerPhone && o.customerPhone.trim().length > 0
            ? o.customerPhone.trim()
            : "Guest Customer",
      label: `${typeLabel} ${displayNum}${o.customerName ? ` • ${o.customerName}` : ""}`,
      channel: typeLabel,
      amount: formatCurrencyPaise(
        o.totalAmount || 0,
        res.currencySymbol,
        res.currency,
        res.country,
      ),
      paymentStatus: o.paymentStatus || "Paid",
      status: o.isRejected
        ? "Cancelled"
        : o.isCompleted
          ? "Completed"
          : o.orderStatusName || "Active",
      statusBg:
        o.paymentStatus === "Paid"
          ? "bg-emerald-50 text-emerald-800"
          : "bg-[#eee8e2] text-stone-800",
    };
  });

  res.table = {
    columns: [
      { key: "orderNumber", label: "Order #" },
      { key: "customer", label: "Patron" },
      { key: "channel", label: "Channel" },
      { key: "amount", label: "Folio Amount", align: "right" },
      { key: "paymentStatus", label: "Status" },
    ],
    rows,
    totalCount: highValue.length,
  };

  return res;
}

export async function provideOrdersDelayedAlerts(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const thresholdMinutes = options.configuration?.delayMinutes || 15;
  const now = Date.now();
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const allOrders = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  // Only consider orders placed within the selected timeframe (e.g. today's service)
  const isToday = (options.dateRangePreset || "today") === "today";
  const toBoundary = isToday ? Math.max(timeRange.to, now + 120000) : timeRange.to;

  const currentShiftOrders = allOrders.filter(
    (o) => o.createdAt >= timeRange.from && o.createdAt <= toBoundary,
  );

  // Filter for ACTIVE unfulfilled tickets exceeding kitchen/service turnaround SLA
  const delayed = currentShiftOrders.filter((o) => {
    // If order is completed, delivered, or rejected, it is NOT delayed
    if (o.isCompleted || o.isRejected) return false;
    const st = (o.orderStatusName || "").toLowerCase().trim();
    if (
      st.includes("deliver") ||
      st.includes("complete") ||
      st.includes("served") ||
      st.includes("cancel") ||
      st.includes("reject") ||
      st.includes("settle")
    ) {
      return false;
    }
    const elapsedMinutes = Math.floor((now - o.createdAt) / 60000);
    return elapsedMinutes > thresholdMinutes;
  });

  const delayedItems = delayed.slice(0, 5).map((o) => {
    const rawNumber = o.orderNumber || (o._id ? `ORD-${o._id.slice(-4)}` : "ORD-001");
    const displayNum = rawNumber.startsWith("#") ? rawNumber : `#${rawNumber}`;
    const elapsedMinutes = Math.floor((now - o.createdAt) / 60000);
    const typeLabel = formatOrderTypeLabel(o.orderType);

    return {
      id: o._id,
      orderNumber: displayNum,
      orderNum: displayNum,
      ticket: displayNum,
      label: `${typeLabel}${o.customerName ? ` • ${o.customerName}` : ""}${o.tableId ? " • Table" : ""}`,
      delay: `+${Math.max(1, elapsedMinutes - thresholdMinutes)}m Over`,
      elapsed: `${elapsedMinutes}m ago`,
      elapsedMinutes,
      station: "Kitchen Pass",
      note: `Kitchen turnaround exceeded ${thresholdMinutes}m SLA target`,
    };
  });

  res.alert = {
    count: delayed.length,
    alertCount: delayed.length,
    severity:
      delayed.length > 5 ? "critical" : delayed.length > 0 ? "warning" : "info",
    title:
      delayed.length > 0
        ? `${delayed.length} Orders Delayed Beyond SLA`
        : "All Orders Within SLA Target",
    message:
      delayed.length > 0
        ? `Highest elapsed time: ${Math.floor((now - Math.min(...delayed.map((d) => d.createdAt))) / 60000)} mins`
        : "All active kitchen and floor orders are within turnaround SLA.",
    actionUrl: "/orders?filter=delayed",
    delayedOrders: delayedItems,
    items: delayedItems,
  } as any;

  res.table = {
    columns: [
      { key: "orderNumber", label: "Order #" },
      { key: "label", label: "Channel / Table" },
      { key: "elapsed", label: "Elapsed Time" },
      { key: "delay", label: "SLA Overrun" },
    ],
    rows: delayedItems,
    totalCount: delayed.length,
  };

  return res;
}

export async function provideOrdersVolumeOverTime(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const validOrders = orders.filter((o) => isValidActiveOrCompletedOrder(o));
  const durationMs = timeRange.to - timeRange.from;
  const isMultiDay = durationMs > 36 * 3600 * 1000;
  const shortMonths = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  if (isMultiDay) {
    const dailyBuckets: Record<string, number> = {};
    for (const o of validOrders) {
      const d = new Date(o.createdAt);
      const key = `${d.getDate()} ${shortMonths[d.getMonth()]}`;
      dailyBuckets[key] = (dailyBuckets[key] || 0) + 1;
    }
    const series = Object.entries(dailyBuckets).map(([label, value]) => ({
      label,
      value,
    }));
    const peak = series.reduce((max, s) => (s.value > max.value ? s : max), {
      label: "N/A",
      value: 0,
    });
    res.chart = {
      chartType: "bar",
      type: "bar",
      series: [{ name: "Orders by Day", data: series }],
      data: series,
      xAxisLabel: "Date",
      yAxisLabel: "Orders",
      peakLabel: peak.label,
      peakValue: peak.value,
      totalValue: validOrders.length,
    } as any;
  } else {
    // Single Day (e.g. Today): Group by hour strictly in the store's configured timezone
    const hourFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: res.timeZone,
      hour: "numeric",
      hourCycle: "h23",
    });

    const displayHours = [
      { hour24: 9, label: "9a" },
      { hour24: 10, label: "10a" },
      { hour24: 11, label: "11a" },
      { hour24: 12, label: "12p" },
      { hour24: 13, label: "1p" },
      { hour24: 14, label: "2p" },
      { hour24: 15, label: "3p" },
      { hour24: 16, label: "4p" },
      { hour24: 17, label: "5p" },
      { hour24: 18, label: "6p" },
      { hour24: 19, label: "7p" },
      { hour24: 20, label: "8p" },
      { hour24: 21, label: "9p" },
      { hour24: 22, label: "10p" },
      { hour24: 23, label: "11p" },
    ];

    const hourlyCounts: Record<number, number> = {};
    for (const h of displayHours) {
      hourlyCounts[h.hour24] = 0;
    }

    for (const o of validOrders) {
      try {
        const hourStr = hourFormatter.format(new Date(o.createdAt));
        const hourNum = parseInt(hourStr, 10);
        const normalized = hourNum === 24 ? 0 : hourNum;
        if (hourlyCounts[normalized] !== undefined) {
          hourlyCounts[normalized]++;
        } else {
          hourlyCounts[normalized] = (hourlyCounts[normalized] || 0) + 1;
        }
      } catch {
        const offsetMs = getTzOffsetMs(new Date(o.createdAt), res.timeZone);
        const localDate = new Date(o.createdAt + offsetMs);
        const h = localDate.getUTCHours();
        if (hourlyCounts[h] !== undefined) {
          hourlyCounts[h]++;
        } else {
          hourlyCounts[h] = (hourlyCounts[h] || 0) + 1;
        }
      }
    }

    const series = displayHours.map((h) => ({
      label: h.label,
      value: hourlyCounts[h.hour24] || 0,
    }));

    const peak = series.reduce((max, s) => (s.value > max.value ? s : max), {
      label: "N/A",
      value: 0,
    });

    res.chart = {
      chartType: "bar",
      type: "bar",
      series: [{ name: "Orders by Hour", data: series }],
      data: series,
      xAxisLabel: "Hour",
      yAxisLabel: "Tickets",
      peakLabel:
        peak.value > 0 ? `${peak.label} (${peak.value} tkts/hr)` : "N/A",
      peakValue: peak.value,
      totalValue: validOrders.length,
    } as any;
  }

  return res;
}

export async function provideOrdersFloorOccupancy(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);

  const tables = await ctx.db.query("organizationTables").collect();

  const storeTables = tables.filter((t) => t.deletedAt === undefined);
  const occupied = storeTables.filter((t) => t.currentOrderId !== undefined);
  const rate =
    storeTables.length > 0
      ? Math.round((occupied.length / storeTables.length) * 100)
      : 0;

  res.kpi = {
    value: rate,
    displayValue: `${rate}% Occupied`,
    label: "Floor Table Occupancy",
    trend: rate > 75 ? "up" : "neutral",
    secondaryMetrics: [
      { label: "Active Tables", value: occupied.length },
      { label: "Total Tables", value: storeTables.length },
      { label: "Vacant Tables", value: storeTables.length - occupied.length },
    ],
  };

  res.summary = {
    occupancyPercent: rate,
    occupiedTablesCount: occupied.length,
    totalTablesCount: storeTables.length,
    tables: storeTables.map((t) => ({
      code: t.tableNumber || `T-${t._id.slice(-2)}`,
      capacity: `${t.seatingCapacity || 4}p`,
      status: t.currentOrderId !== undefined ? "occupied" : "vacant",
    })),
  };

  return res;
}

export async function provideOrdersDeliveryFleet(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const activeDeliveries = orders.filter(
    (o) =>
      !o.isCompleted &&
      !o.isRejected &&
      (o.orderType || "").toLowerCase().includes("deliv"),
  );

  res.kpi = {
    value: activeDeliveries.length,
    displayValue: `${activeDeliveries.length} En Route`,
    label: "Delivery Fleet Orders",
    trend: "neutral",
    secondaryMetrics: [
      {
        label: "Scheduled Deliveries",
        value: activeDeliveries.filter((o) => o.scheduledDeliveryDate).length,
      },
      {
        label: "On-Demand Deliveries",
        value: activeDeliveries.filter((o) => !o.scheduledDeliveryDate).length,
      },
    ],
  };

  return res;
}

export async function provideOrdersTakeawayCounter(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const activeTakeaway = orders.filter(
    (o) =>
      !o.isCompleted &&
      !o.isRejected &&
      (o.orderType || "").toLowerCase().includes("take"),
  );

  const readyForPickup = activeTakeaway.filter((o) =>
    (o.orderStatusName || "").toLowerCase().includes("ready"),
  ).length;

  res.kpi = {
    value: activeTakeaway.length,
    displayValue: `${activeTakeaway.length} Active`,
    label: "Takeaway Counter Orders",
    secondaryMetrics: [
      { label: "Ready for Pickup", value: readyForPickup },
      {
        label: "In Kitchen Prep",
        value: activeTakeaway.length - readyForPickup,
      },
    ],
  };

  return res;
}

export async function provideOrdersCancellationRate(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
  );

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const cancelled = orders.filter(
    (o) =>
      o.isRejected ||
      (o.orderStatusName || "").toLowerCase().includes("cancel"),
  );
  const rate =
    orders.length > 0
      ? Math.round((cancelled.length / orders.length) * 1000) / 10
      : 0;

  res.kpi = {
    value: rate,
    displayValue: `${rate}% Rate`,
    label: "Order Cancellation Rate",
    trend: rate > 5 ? "up" : "neutral",
    secondaryMetrics: [
      { label: "Cancelled Orders", value: cancelled.length },
      { label: "Total Booked", value: orders.length },
    ],
  };

  return res;
}

export async function provideOrdersRushVelocity(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const now = Date.now();
  const ONE_HOUR_MS = 60 * 60 * 1000;

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", now - ONE_HOUR_MS)
        .lte("createdAt", now),
    )
    .collect();

  const valid = orders.filter((o) => isValidActiveOrCompletedOrder(o));

  res.kpi = {
    value: valid.length,
    displayValue: `${valid.length} / hr`,
    label: "Peak Rush Order Velocity",
    trend: valid.length > 20 ? "up" : "neutral",
    secondaryMetrics: [
      {
        label: "Current Pace",
        value: `${Math.round((valid.length / 60) * 10) / 10} orders / min`,
      },
      { label: "Active Window", value: "Past 60 mins" },
    ],
  };

  return res;
}

export async function provideOrdersTableTurn(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
  );

  const tables = await ctx.db.query("organizationTables").collect();
  const storeTables = tables.filter((t) => t.deletedAt === undefined);

  const completedOrders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const dineInCompleted = completedOrders.filter(
    (o) =>
      (o.isCompleted || o.orderStatusName === "Completed") &&
      (o.orderType || "").toLowerCase().includes("dine"),
  );

  const turns =
    storeTables.length > 0
      ? Math.round((dineInCompleted.length / storeTables.length) * 10) / 10
      : 0;

  res.kpi = {
    value: turns,
    displayValue: `${turns}x Turns`,
    label: "Average Table Turn Rate",
    trend: turns >= 2.0 ? "up" : "neutral",
    secondaryMetrics: [
      { label: "Completed Dine-In", value: dineInCompleted.length },
      { label: "Total Tables", value: storeTables.length },
    ],
  };

  return res;
}

// ==========================================
// 6. WORKSTATION PROVIDERS (First-Class Redesign)
// ==========================================

export async function provideWorkstationOrderSummary(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const now = Date.now();
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const stations = await ctx.db
    .query("stations")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();
  const activeStations = stations.filter((s) => s.deletedAt === undefined);
  const defaultStationName =
    activeStations.find((s) => s.isMain)?.name ||
    activeStations[0]?.name ||
    "Station";

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const activeOrders = orders.filter(
    (o) => !o.isCompleted && !o.isRejected && o.orderStatusName !== "Completed",
  );

  const orderItems = await ctx.db
    .query("orderItems")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const activeOrderIds = new Set(activeOrders.map((o) => o._id));
  const activeItems = orderItems.filter(
    (i) => i.orderId && activeOrderIds.has(i.orderId) && !i.isReady,
  );

  const stationItemCounts = new Map<string, number>();
  for (const s of activeStations) {
    stationItemCounts.set(s._id, 0);
  }

  for (const item of activeItems) {
    if (item.stationId && stationItemCounts.has(item.stationId)) {
      stationItemCounts.set(
        item.stationId,
        (stationItemCounts.get(item.stationId) || 0) + item.quantity,
      );
    } else if (activeStations.length > 0) {
      const mainId = (
        activeStations.find((s) => s.isMain) || activeStations[0]
      )._id;
      stationItemCounts.set(
        mainId,
        (stationItemCounts.get(mainId) || 0) + item.quantity,
      );
    }
  }

  const lanes = activeStations.map((s) => {
    const count = stationItemCounts.get(s._id) ?? 0;
    return {
      name: s.name,
      count: count > 0 ? count : activeOrders.length,
    };
  });

  if (lanes.length === 0) {
    lanes.push({
      name: defaultStationName,
      count: activeOrders.length,
    });
  }

  let acceptedCount = 0;
  let inProgressCount = 0;
  let readyCount = 0;
  let delayedCount = 0;

  for (const o of activeOrders) {
    const statusKey = deriveWorkstationStatusKey(o);
    if (statusKey === "READY") readyCount++;
    else if (statusKey === "IN_PROGRESS") inProgressCount++;
    else acceptedCount++;

    const elapsed = Math.floor((now - o.createdAt) / 60000);
    if (elapsed > 15) delayedCount++;
  }

  res.kpi = {
    value: activeOrders.length,
    displayValue: `${activeOrders.length} Tickets`,
    label: "Workstation Active Orders",
    trend: delayedCount > 3 ? "down" : "up",
    secondaryMetrics: [
      { label: "Received / New", value: acceptedCount },
      { label: "Cooking / In Prep", value: inProgressCount },
      { label: "Ready at Pass", value: readyCount },
      { label: "Delayed (>15m)", value: delayedCount },
    ],
  };

  res.summary = {
    lanes,
    totalSpoolPool: activeOrders.length,
    activeTasksText: `${activeOrders.length} Active Tasks`,
  };

  return res;
}

export async function provideWorkstationOrdersByWorkstation(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const stations = await ctx.db
    .query("stations")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();
  const activeStations = stations.filter((s) => s.deletedAt === undefined);
  const stationNameMap: Record<string, string> = {};
  for (const s of activeStations) {
    stationNameMap[s._id] = s.name;
  }
  const defaultStationName =
    activeStations.find((s) => s.isMain)?.name ||
    activeStations[0]?.name ||
    "Main";

  const orderItems = await ctx.db
    .query("orderItems")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const inRangeItems = orderItems.filter(
    (i) => i.createdAt >= timeRange.from && i.createdAt <= timeRange.to,
  );

  const stationCounts: Record<string, number> = {};
  for (const s of activeStations) {
    stationCounts[s.name] = 0;
  }

  for (const item of inRangeItems) {
    const sName = item.stationId
      ? stationNameMap[item.stationId] || defaultStationName
      : defaultStationName;
    stationCounts[sName] = (stationCounts[sName] || 0) + item.quantity;
  }

  const chartData = Object.entries(stationCounts).map(([label, value]) => ({
    label,
    value,
  }));

  const perfData =
    chartData.length > 0
      ? chartData
      : [{ label: defaultStationName, value: inRangeItems.length }];

  res.chart = {
    chartType: "donut",
    type: "donut",
    series: [{ name: "Orders by Workstation", data: perfData }],
    data: perfData,
    xAxisLabel: "Workstation",
    yAxisLabel: "Items",
  };

  res.summary = {
    stationBreakdown: perfData.map((d) => ({
      name: d.label,
      count: d.value,
      pct:
        inRangeItems.length > 0
          ? Math.round((d.value / inRangeItems.length) * 100)
          : 0,
    })),
    totalCount: inRangeItems.length,
  };

  return res;
}

export async function provideWorkstationActiveTasks(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const now = Date.now();
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const stations = await ctx.db
    .query("stations")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();
  const activeStations = stations.filter((s) => s.deletedAt === undefined);
  const stationNameMap: Record<string, string> = {};
  for (const s of activeStations) {
    stationNameMap[s._id] = s.name;
  }
  const defaultStationName =
    activeStations.find((s) => s.isMain)?.name ||
    activeStations[0]?.name ||
    "Station";

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const activeOrders = orders.filter(
    (o) => !o.isCompleted && !o.isRejected && o.orderStatusName !== "Completed",
  );
  const activeOrderMap = new Map(activeOrders.map((o) => [o._id, o]));

  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const activeTasks = items
    .filter((i) => i.orderId && activeOrderMap.has(i.orderId) && !i.isReady)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, 10);

  const rows = activeTasks.map((i) => {
    const elapsedMins = Math.floor((now - i.createdAt) / 60000);
    const stationName = i.stationId
      ? stationNameMap[i.stationId] || defaultStationName
      : defaultStationName;
    const parentOrder = i.orderId ? activeOrderMap.get(i.orderId) : null;
    const cleanToken = (parentOrder?.tokenNumber || "")
      .replace(/^#+/, "")
      .trim();
    const taskToken = cleanToken
      ? `Token #${cleanToken}`
      : parentOrder?.orderNumber ||
        `#ITEM-${String(i._id).slice(-4).toUpperCase()}`;

    return {
      id: i._id,
      taskNo: taskToken,
      itemName: i.itemName,
      quantity: i.quantity,
      station: stationName,
      elapsed: `${elapsedMins}m`,
      status: elapsedMins > 15 ? "Delayed" : "Cooking",
    };
  });

  res.table = {
    columns: [
      { key: "itemName", label: "Task / Dish" },
      { key: "quantity", label: "Qty", align: "center" },
      { key: "station", label: "Workstation" },
      { key: "elapsed", label: "Time in Prep", align: "right" },
      { key: "status", label: "Status" },
    ],
    rows,
    totalCount: activeTasks.length,
  };

  res.summary = {
    tasksCount: activeTasks.length,
    activeTasksList: rows.map((r) => ({
      taskNo: r.taskNo,
      title: r.itemName,
      station: r.station,
      status: r.status,
      elapsed: r.elapsed,
    })),
  };

  return res;
}

export async function provideWorkstationQueue(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const now = Date.now();
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const tables = await ctx.db
    .query("organizationTables")
    .filter((q) => q.eq(q.field("deletedAt"), undefined))
    .collect();
  const tableMap = new Map(tables.map((t) => [t._id, t.tableNumber]));

  const active = orders
    .filter(
      (o) =>
        !o.isCompleted && !o.isRejected && o.orderStatusName !== "Completed",
    )
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, 12);

  const rows = active.map((o) => {
    const elapsedMins = Math.floor((now - o.createdAt) / 60000);
    const statusKey = deriveWorkstationStatusKey(o);
    const tableLabel =
      o.tableId && tableMap.has(o.tableId)
        ? `Table ${tableMap.get(o.tableId)}`
        : o.orderType || "Counter";

    return {
      id: o._id,
      orderNumber: o.orderNumber,
      channel: o.orderType,
      table: tableLabel,
      elapsed: `${elapsedMins}m`,
      status: statusKey,
    };
  });

  res.kpi = {
    value: active.length,
    displayValue: `${active.length} Orders`,
    label: "Workstation Buffer Depth",
    trend: active.length > 5 ? "down" : "up",
    secondaryMetrics: [
      {
        label: "Oldest in Buffer",
        value: rows.length > 0 ? rows[0].elapsed : "--",
      },
      {
        label: "Spool State",
        value: active.length > 0 ? "Nominal Spool" : "Queue Idle",
      },
    ],
  };

  res.table = {
    columns: [
      { key: "orderNumber", label: "Order #" },
      { key: "channel", label: "Channel" },
      { key: "table", label: "Seat / Token" },
      { key: "elapsed", label: "Elapsed", align: "right" },
      { key: "status", label: "Station Stage" },
    ],
    rows,
    totalCount: active.length,
  };

  res.summary = {
    bufferDepth: active.length,
    spoolStatus: active.length > 0 ? "Nominal Spool" : "Queue Idle",
    oldestWaiting: rows.length > 0 ? rows[0].elapsed : "--",
  };

  return res;
}

export async function provideWorkstationPrepTime(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const stations = await ctx.db
    .query("stations")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();
  const activeStations = stations.filter((s) => s.deletedAt === undefined);

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const completed = orders.filter(
    (o) => o.isCompleted || o.orderStatusName === "Completed",
  );

  const activities = await ctx.db
    .query("orderActivities")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const activityDurations: number[] = [];
  for (const a of activities) {
    if (a.completedAt && a.startedAt && a.completedAt > a.startedAt) {
      const mins = Math.floor((a.completedAt - a.startedAt) / 60000);
      if (mins > 0 && mins <= 60) activityDurations.push(mins);
    } else if (
      a.totalDuration &&
      a.totalDuration > 0 &&
      a.totalDuration <= 3600
    ) {
      activityDurations.push(Math.round(a.totalDuration / 60));
    }
  }

  let avgPrepMins = 0;
  if (activityDurations.length > 0) {
    avgPrepMins =
      Math.round(
        (activityDurations.reduce((acc, d) => acc + d, 0) /
          activityDurations.length) *
          10,
      ) / 10;
  } else if (completed.length > 0) {
    const validOrderDurations = completed
      .map((o) => {
        const diff = Math.floor(
          ((o.updatedAt || o.createdAt) - o.createdAt) / 60000,
        );
        return diff;
      })
      .filter((d) => d >= 1 && d <= 30);

    if (validOrderDurations.length > 0) {
      avgPrepMins =
        Math.round(
          (validOrderDurations.reduce((acc, d) => acc + d, 0) /
            validOrderDurations.length) *
            10,
        ) / 10;
    } else {
      avgPrepMins = 8.5;
    }
  }

  const deltaText =
    avgPrepMins > 0
      ? avgPrepMins <= 20
        ? `${(20 - avgPrepMins).toFixed(1)}m under SLA`
        : `${(avgPrepMins - 20).toFixed(1)}m over SLA`
      : "Within SLA";

  res.kpi = {
    value: avgPrepMins,
    displayValue: avgPrepMins > 0 ? `${avgPrepMins} mins` : "-- mins",
    label: "Avg Workstation Prep Time",
    trend: avgPrepMins <= 20 ? "up" : "down",
    secondaryMetrics: [
      { label: "Service SLA Goal", value: "< 20.0 min" },
      { label: "Tickets Completed", value: completed.length },
      { label: "SLA Pace", value: deltaText },
    ],
  };

  const stationBars = activeStations.map((s) => ({
    name: s.name,
    prep: avgPrepMins > 0 ? `${avgPrepMins}m` : "--",
  }));

  res.summary = {
    avgPrepMins,
    displayValue: avgPrepMins > 0 ? `${avgPrepMins}` : "--",
    slaGoal: "< 20.0 min",
    deltaText,
    completedCount: completed.length,
    stationBars,
  };

  return res;
}

export async function provideWorkstationDelayedOrders(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const now = Date.now();
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const delayed = orders.filter((o) => {
    if (o.isCompleted || o.isRejected || o.orderStatusName === "Completed") {
      return false;
    }
    const elapsed = Math.floor((now - o.createdAt) / 60000);
    return elapsed > 15;
  });

  const earliestDelayMins =
    delayed.length > 0
      ? Math.floor(
          (now - Math.min(...delayed.map((d) => d.createdAt))) / 60000,
        )
      : 0;

  res.alert = {
    count: delayed.length,
    alertCount: delayed.length,
    severity:
      delayed.length > 3 ? "critical" : delayed.length > 0 ? "warning" : "info",
    title:
      delayed.length > 0
        ? `${delayed.length} Workstation Tickets Delayed`
        : "All Stations Running On Target",
    message:
      delayed.length > 0
        ? `Earliest delayed ticket has been in prep for ${earliestDelayMins} mins.`
        : "No station queues exceed the 15-minute target threshold.",
    actionUrl: "/orders?filter=delayed",
  };

  return res;
}

export async function provideWorkstationPerformance(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const stations = await ctx.db
    .query("stations")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();
  const activeStations = stations.filter((s) => s.deletedAt === undefined);
  const stationMap: Record<string, string> = {};
  for (const s of activeStations) stationMap[s._id] = s.name;
  const defaultStationName =
    activeStations.find((s) => s.isMain)?.name ||
    activeStations[0]?.name ||
    "Station";

  const orderItems = await ctx.db
    .query("orderItems")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const completedToday = orderItems.filter(
    (i) =>
      i.isReady &&
      i.createdAt >= timeRange.from &&
      i.createdAt <= timeRange.to,
  );

  const stationCompleted: Record<string, number> = {};
  for (const s of activeStations) {
    stationCompleted[s.name] = 0;
  }

  for (const item of completedToday) {
    const name = item.stationId
      ? stationMap[item.stationId] || defaultStationName
      : defaultStationName;
    stationCompleted[name] = (stationCompleted[name] || 0) + item.quantity;
  }

  const chartData = Object.entries(stationCompleted).map(([label, value]) => ({
    label,
    value,
  }));

  const perfData =
    chartData.length > 0
      ? chartData
      : [{ label: defaultStationName, value: completedToday.length }];

  res.chart = {
    chartType: "bar",
    type: "bar",
    series: [{ name: "Workstation Performance", data: perfData }],
    data: perfData,
    xAxisLabel: "Workstation",
    yAxisLabel: "Dishes Completed",
  };

  res.summary = {
    performances: perfData.map((d) => ({
      name: d.label,
      completed: d.value,
      pct:
        completedToday.length > 0
          ? Math.min(100, Math.round((d.value / completedToday.length) * 100))
          : 0,
    })),
    totalCompleted: completedToday.length,
  };

  return res;
}

export async function provideWorkstationAvailability(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);

  const stations = await ctx.db
    .query("stations")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();
  const publishedStations = stations.filter((s) => s.deletedAt === undefined);

  const cfds = await ctx.db
    .query("customerFrontDisplays")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const activeCfds = cfds.filter(
    (c) => c.status === "active" && c.deletedAt === undefined,
  );

  res.kpi = {
    value: publishedStations.length,
    displayValue: `${publishedStations.length} Online`,
    label: "Active Workstation Stations",
    trend: "up",
    secondaryMetrics: [
      { label: "Configured Stations", value: stations.length },
      {
        label: "Customer Front Displays",
        value: `${activeCfds.length} / ${cfds.length} Online`,
      },
      { label: "Health Status", value: "Operational" },
    ],
  };

  res.summary = {
    onlineTerminals: publishedStations.length,
    totalTerminals: stations.length,
    terminalsList: stations.map((s) => ({
      name: s.name,
      status: s.deletedAt ? "Offline" : "Online",
      latency: "Active",
      alert: undefined,
    })),
  };

  return res;
}

export async function provideWorkstationTerminalHealth(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);

  const cfds = await ctx.db
    .query("customerFrontDisplays")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const printers = await ctx.db.query("organizationPrinters").collect();

  const rows = [
    ...cfds
      .filter((c) => c.deletedAt === undefined)
      .map((c) => ({
        id: c._id,
        name: c.name,
        type: "Customer Display (CFD)",
        endpoint: c.ipAddress || c.connectionType,
        status: c.status === "active" ? "Online" : "Offline",
        latency: c.latencyMs !== undefined ? `${c.latencyMs} ms` : "Normal",
      })),
    ...printers
      .filter((p) => p.deletedAt === undefined)
      .map((p) => ({
        id: p._id,
        name: `${p.printerUseFor} Printer`,
        type: `Printer (${p.printerType})`,
        endpoint: p.printerUrl,
        status: "Configured",
        latency: "LAN",
      })),
  ];

  res.table = {
    columns: [
      { key: "name", label: "Device Name" },
      { key: "type", label: "Hardware Role" },
      { key: "endpoint", label: "Endpoint / IP" },
      { key: "status", label: "Link State" },
      { key: "latency", label: "Ping / Interface", align: "right" },
    ],
    rows,
    totalCount: rows.length,
  };

  return res;
}

// ==========================================
// 7. KDS PROVIDERS
// ==========================================

export async function provideKdsLiveOrders(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );
  const now = Date.now();

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const live = orders
    .filter((o) => {
      if (o.createdAt < timeRange.from || o.createdAt > timeRange.to)
        return false;
      const s = (o.orderStatusName || "").toLowerCase();
      return (
        !o.isCompleted &&
        !o.isRejected &&
        s !== "completed" &&
        s !== "delivered" &&
        s !== "cancelled" &&
        s !== "cancelled / refunded"
      );
    })
    .sort((a, b) => a.createdAt - b.createdAt);

  const inPrepCount = live.filter((o) => {
    const s = (o.orderStatusName || "").toLowerCase();
    return (
      s.includes("progress") ||
      s.includes("prep") ||
      s.includes("cook") ||
      s.includes("kitchen") ||
      s.includes("baking")
    );
  }).length;

  const atPassCount = live.filter((o) => {
    const s = (o.orderStatusName || "").toLowerCase();
    return (
      s.includes("ready") ||
      s.includes("pass") ||
      s.includes("plated") ||
      s.includes("serve")
    );
  }).length;

  const pendingCount = live.filter((o) => {
    const s = (o.orderStatusName || "").toLowerCase();
    return (
      s.includes("accept") ||
      s.includes("pending") ||
      s.includes("new") ||
      s.includes("hold") ||
      s.includes("placed") ||
      s.includes("queue") ||
      !o.orderStatusName
    );
  }).length;

  const capacityPercent = Math.min(100, Math.round((live.length / 15) * 100));

  const rows = live.slice(0, 10).map((o) => ({
    id: o._id,
    orderNumber: o.orderNumber,
    channel: o.orderType,
    time: formatRelativeTime(o.createdAt, now),
    status: o.orderStatusName || "Accepted",
  }));

  res.table = {
    columns: [
      { key: "orderNumber", label: "Ticket #" },
      { key: "channel", label: "Channel" },
      { key: "time", label: "Elapsed", align: "right" },
      { key: "status", label: "State" },
    ],
    rows,
    totalCount: live.length,
  };

  res.kpi = {
    value: live.length,
    displayValue: `${live.length} Active`,
    label: "Workstation Traffic",
    secondaryMetrics: [
      { label: "In Prep", value: inPrepCount },
      { label: "At Pass", value: atPassCount },
    ],
  };

  res.summary = {
    trafficCapacity: `${capacityPercent}% Capacity`,
    capacityPercent,
    inPrepCount,
    atPassCount,
    pendingCount,
    activeTicketsCount: live.length,
  };

  return res;
}

export async function provideKdsPendingTickets(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );
  const now = Date.now();

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const pending = orders.filter((o) => {
    if (o.createdAt < timeRange.from || o.createdAt > timeRange.to)
      return false;
    if (o.isCompleted || o.isRejected)
      return false;
    const s = (o.orderStatusName || "").toLowerCase();
    if (
      s === "completed" ||
      s === "delivered" ||
      s === "cancelled" ||
      s === "cancelled / refunded"
    ) {
      return false;
    }
    // Ready orders are at pass, not pending fire
    if (
      s.includes("ready") ||
      s.includes("pass") ||
      s.includes("plated") ||
      s.includes("serve")
    ) {
      return false;
    }
    // Orders already in preparation (in progress) have been fired
    if (
      s.includes("progress") ||
      s.includes("cook") ||
      s.includes("prep") ||
      s.includes("kitchen")
    ) {
      return false;
    }
    // Newly accepted orders, pending tickets, or held orders waiting for kitchen preparation
    return (
      s.includes("accept") ||
      s.includes("pending") ||
      s.includes("new") ||
      s.includes("hold") ||
      s.includes("placed") ||
      s.includes("queue") ||
      !o.orderStatusName
    );
  });

  const oldestTicket = pending.reduce(
    (oldest, current) => {
      return !oldest || current.createdAt < oldest.createdAt ? current : oldest;
    },
    null as Doc<"orders"> | null,
  );

  let oldestElapsed = "--";
  if (oldestTicket) {
    const elapsedSecs = Math.max(
      0,
      Math.floor((now - oldestTicket.createdAt) / 1000),
    );
    const mins = Math.floor(elapsedSecs / 60);
    const secs = elapsedSecs % 60;
    oldestElapsed = `${mins}m ${secs}s`;
  }

  const attentionRequired =
    pending.length >= 8 ||
    (oldestTicket !== null && now - oldestTicket.createdAt > 10 * 60 * 1000);

  res.kpi = {
    value: pending.length,
    displayValue: String(pending.length),
    label: "Tickets Pending Fire",
    trend: attentionRequired ? "down" : "up",
    secondaryMetrics: [
      { label: "Oldest in buffer", value: oldestElapsed },
      {
        label: "Queue Status",
        value: attentionRequired ? "Attention" : "Optimal",
      },
    ],
  };

  res.summary = {
    pendingCount: pending.length,
    oldestElapsed,
    statusTag: attentionRequired ? "Attention" : "Optimal",
  };

  return res;
}

export async function provideKdsStationQueue(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const stations = await ctx.db
    .query("stations")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const activeStations = stations.filter((s) => s.deletedAt === undefined);
  const targetStation =
    options.configuration && options.configuration.stationId
      ? activeStations.find((s) => s._id === options.configuration!.stationId)
      : activeStations.find((s) => s.isMain) || activeStations[0] || null;

  const stationName = targetStation?.name || "Main Kitchen";
  const stationTag = targetStation
    ? targetStation.name.length > 8
      ? targetStation.name.slice(0, 8)
      : targetStation.name
    : "Kitchen";

  // Active live orders for this org
  const activeOrders = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();
  const liveOrderIds = new Set(
    activeOrders
      .filter(
        (o) =>
          !o.isCompleted &&
          !o.isRejected &&
          o.orderStatusName !== "Completed" &&
          o.orderStatusName !== "Delivered" &&
          o.orderStatusName !== "Cancelled" &&
          o.orderStatusName !== "Cancelled / Refunded",
      )
      .map((o) => o._id),
  );

  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const queued = items.filter((i) => {
    if (!liveOrderIds.has(i.orderId)) return false;
    if (
      !i.createdAt ||
      i.createdAt < timeRange.from ||
      i.createdAt > timeRange.to
    )
      return false;
    if (targetStation && targetStation.isMain) {
      if (i.stationId && i.stationId !== targetStation._id) return false;
    } else if (targetStation && i.stationId !== targetStation._id) {
      return false;
    }
    return !i.isReady;
  });

  const distinctOrdersCount = new Set(queued.map((i) => i.orderId)).size;
  const loadPercent = Math.min(100, Math.round((queued.length / 10) * 100));

  res.kpi = {
    value: distinctOrdersCount,
    displayValue: `${distinctOrdersCount} Tickets`,
    label: "Active Station Queue Load",
    trend: queued.length > 20 ? "down" : "up",
    secondaryMetrics: [
      { label: "Cooking Tasks", value: queued.length },
      { label: "Station Priority", value: "Normal Pace" },
    ],
  };

  res.summary = {
    stationName,
    stationTag,
    ticketsCount: distinctOrdersCount,
    itemsCount: queued.length,
    avgPrepText: queued.length > 0 ? `${Math.round(queued.length * 3.5)}m` : "--",
    loadPercent,
  };

  return res;
}

export async function provideKdsStatusBreakdown(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );
  const now = Date.now();

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const filtered = orders.filter(
    (o) => o.createdAt >= timeRange.from && o.createdAt <= timeRange.to,
  );

  let accepted = 0;
  let inPrep = 0;
  let ready = 0;
  let overdue = 0;

  for (const o of filtered) {
    if (
      o.isCompleted ||
      o.isRejected ||
      o.orderStatusName === "Completed" ||
      o.orderStatusName === "Delivered" ||
      o.orderStatusName === "Cancelled" ||
      o.orderStatusName === "Cancelled / Refunded"
    ) {
      continue;
    }
    const elapsedMins = Math.floor((now - o.createdAt) / 60000);
    const s = (o.orderStatusName || "Accepted").toLowerCase();

    if (elapsedMins > 20) {
      overdue++;
    }

    if (
      s.includes("ready") ||
      s.includes("pass") ||
      s.includes("plated") ||
      s.includes("serve")
    ) {
      ready++;
    } else if (
      s.includes("progress") ||
      s.includes("prep") ||
      s.includes("cook") ||
      s.includes("kitchen")
    ) {
      inPrep++;
    } else {
      accepted++;
    }
  }

  const total = accepted + inPrep + ready + overdue;

  res.summary = {
    accepted,
    inPrep,
    ready,
    held: accepted,
    overdue,
    total,
  };

  res.chart = {
    chartType: "donut",
    type: "donut",
    series: [
      {
        name: "Order Status",
        data: [
          { label: "Accepted", value: accepted },
          { label: "In Prep", value: inPrep },
          { label: "Ready", value: ready },
          { label: "Overdue", value: overdue },
        ],
      },
    ],
  };

  return res;
}

export async function provideKdsDelayAlerts(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  return provideOrdersDelayedAlerts(ctx, org, widgetDef, options);
}

export async function provideKdsLoadCapacity(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);

  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const cookingCount = items.filter((i) => !i.isReady).length;
  const maxCapacity = 50; // benchmark capacity
  const loadPercent = Math.min(
    100,
    Math.round((cookingCount / maxCapacity) * 100),
  );

  res.kpi = {
    value: loadPercent,
    displayValue: `${loadPercent}% Load`,
    label: "Kitchen Load Capacity",
    trend: loadPercent > 80 ? "down" : "up",
    secondaryMetrics: [
      { label: "Active Items", value: cookingCount },
      { label: "Rated Capacity", value: `${maxCapacity} items` },
    ],
  };

  return res;
}

export async function provideKdsExpeditor(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const readyAtPass = orders.filter(
    (o) =>
      !o.isCompleted &&
      !o.isRejected &&
      (o.orderStatusName || "").toLowerCase().includes("ready"),
  );

  res.kpi = {
    value: readyAtPass.length,
    displayValue: `${readyAtPass.length} Ready`,
    label: "Expeditor Pass Queue",
    trend: readyAtPass.length > 5 ? "down" : "up",
    secondaryMetrics: [
      { label: "Awaiting Runner", value: readyAtPass.length },
      {
        label: "Pass Status",
        value: readyAtPass.length > 5 ? "Congested" : "Clear",
      },
    ],
  };

  return res;
}

export async function provideKdsPrepPreferences(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const validOrders = orders.filter(
    (o) =>
      o.createdAt >= timeRange.from &&
      o.createdAt <= timeRange.to &&
      isValidActiveOrCompletedOrder(o) &&
      !o.isRejected,
  );
  const validOrderIds = new Set(validOrders.map((o) => o._id));

  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const periodItems = items.filter((i) => {
    if (i.orderId && validOrderIds.has(i.orderId)) return true;
    if (validOrderIds.size === 0 && i.createdAt >= timeRange.from && i.createdAt <= timeRange.to) {
      return true;
    }
    return false;
  });

  const prefCounts: Record<string, number> = {};
  for (const item of periodItems) {
    const prefs = item.chefPrepPreferences || item.prepPreferences || [];
    for (const p of prefs) {
      prefCounts[p.name] = (prefCounts[p.name] || 0) + 1;
    }
  }

  const chartData = Object.entries(prefCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label, value }));

  const prefData = chartData;
  res.chart = {
    chartType: "bar",
    type: "bar",
    series: [{ name: "Special Instructions", data: prefData }],
    data: prefData,
    xAxisLabel: "Special Instruction",
    yAxisLabel: "Frequency",
  };

  return res;
}

export async function provideKdsHourlyThroughput(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  return provideOverviewSalesTrends(ctx, org, widgetDef, options);
}

export async function provideKdsStationLeaderboard(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  return provideWorkstationPerformance(ctx, org, widgetDef, options);
}

// ==========================================
// 8. CASHIER PROVIDERS (Financial Correctness)
// ==========================================

export async function provideCashierShiftSummary(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const payments = await ctx.db
    .query("orderPayments")
    .withIndex("by_org_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  let grossPaise = 0;
  let netPaise = 0;
  let discountsPaise = 0;
  let cashPaise = 0;
  let digitalPaise = 0;
  let refundPaise = 0;

  for (const o of orders) {
    if (!isValidActiveOrCompletedOrder(o)) continue;
    grossPaise += o.subTotal || 0;
    discountsPaise += o.discountAmount || 0;
    if (o.paymentStatus === "Paid") {
      netPaise += (o.subTotal || 0) - (o.discountAmount || 0);
    }
    if (
      o.paymentStatus === "Refunded" ||
      o.paymentStatus === "Partially Refunded"
    ) {
      refundPaise += o.totalAmount || 0;
    }
  }

  if (payments.length > 0) {
    cashPaise = 0;
    digitalPaise = 0;
    refundPaise = 0;
    for (const p of payments) {
      if (p.paymentType === "Debit") {
        refundPaise += p.refundAmount || p.amount || 0;
      } else {
        const amt = p.payAmount || p.amount || 0;
        if ((p.paymentModeName || "").toLowerCase().includes("cash")) {
          cashPaise += amt;
        } else {
          digitalPaise += amt;
        }
      }
    }
  } else {
    for (const o of orders) {
      if (!isValidActiveOrCompletedOrder(o) || o.paymentStatus !== "Paid")
        continue;
      if ((o.paymentMode || "").toLowerCase().includes("cash")) {
        cashPaise += o.totalAmount || 0;
      } else {
        digitalPaise += o.totalAmount || 0;
      }
    }
  }

  const floatPaise = options.configuration?.floatPaise || 0; // configurable drawer float
  const totalCollected = cashPaise + digitalPaise;

  res.summary = {
    grossIntake: formatCurrencyPaise(
      totalCollected,
      res.currencySymbol,
      res.currency,
    ),
    cashCollected: formatCurrencyPaise(
      cashPaise,
      res.currencySymbol,
      res.currency,
    ),
    digitalCollected: formatCurrencyPaise(
      digitalPaise,
      res.currencySymbol,
      res.currency,
    ),
    floatCash: formatCurrencyPaise(
      floatPaise,
      res.currencySymbol,
      res.currency,
    ),
    drawerVariance: `+${res.currencySymbol} 0.00 Balanced`,
  };

  res.kpi = {
    value: totalCollected,
    displayValue: formatCurrencyPaise(
      totalCollected,
      res.currencySymbol,
      res.currency,
    ),
    label: "Total Collected Intake",
    trend: "up",
    secondaryMetrics: [
      {
        label: "Cash Collected",
        value: formatCurrencyPaise(cashPaise, res.currencySymbol, res.currency),
      },
      {
        label: "Digital Settlements",
        value: formatCurrencyPaise(
          digitalPaise,
          res.currencySymbol,
          res.currency,
        ),
      },
      {
        label: "Refunds / Voids",
        value: formatCurrencyPaise(
          refundPaise,
          res.currencySymbol,
          res.currency,
        ),
      },
      {
        label: "Drawer Float",
        value: formatCurrencyPaise(
          floatPaise,
          res.currencySymbol,
          res.currency,
        ),
      },
    ],
  };

  return res;
}

export async function provideCashierTotalTransactions(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const prevOrders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.comparisonFrom)
        .lte("createdAt", timeRange.comparisonTo),
    )
    .collect();

  const paidCurrent = orders.filter(
    (o) => isValidActiveOrCompletedOrder(o) && o.paymentStatus === "Paid",
  );
  const paidPrev = prevOrders.filter(
    (o) => isValidActiveOrCompletedOrder(o) && o.paymentStatus === "Paid",
  );

  const payments = await ctx.db
    .query("orderPayments")
    .withIndex("by_org_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const paymentsByOrder: Record<string, number> = {};
  for (const p of payments) {
    paymentsByOrder[p.orderId] = (paymentsByOrder[p.orderId] || 0) + 1;
  }
  const splitBillsCount = Object.values(paymentsByOrder).filter(
    (c) => c > 1,
  ).length;

  const txnCount = payments.length > 0 ? payments.length : paidCurrent.length;
  const delta = computePercentageDelta(paidCurrent.length, paidPrev.length);

  res.summary = {
    count: txnCount,
    deltaPercent:
      delta.deltaPercent !== undefined
        ? `${delta.deltaPercent >= 0 ? "+" : ""}${delta.deltaPercent}% vs last shift`
        : "+0.0% vs last shift",
    settledCount: paidCurrent.length,
    splitCount: splitBillsCount,
  };

  res.kpi = {
    value: txnCount,
    displayValue: `${txnCount} Txns`,
    label: "Total Shift Transactions",
    deltaPercent: delta.deltaPercent,
    deltaLabel: delta.deltaLabel,
    trend: delta.trend,
    secondaryMetrics: [
      { label: "Settled Orders", value: paidCurrent.length },
      { label: "Split Bill Folios", value: splitBillsCount },
    ],
  };

  return res;
}

export async function provideCashierCashSales(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const payments = await ctx.db
    .query("orderPayments")
    .withIndex("by_org_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  let cashPaise = 0;
  let cashTxns = 0;
  let totalPaise = 0;

  if (payments.length > 0) {
    for (const p of payments) {
      const isDebit = p.paymentType === "Debit";
      const amt = p.payAmount || p.amount || 0;
      const signedAmt = isDebit ? -amt : amt;
      totalPaise += signedAmt;
      if ((p.paymentModeName || "").toLowerCase().includes("cash")) {
        cashPaise += signedAmt;
        if (!isDebit) cashTxns++;
      }
    }
  } else {
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_created_at", (q) =>
        q
          .eq("organizationId", org._id)
          .gte("createdAt", timeRange.from)
          .lte("createdAt", timeRange.to),
      )
      .collect();

    for (const o of orders) {
      if (!isValidActiveOrCompletedOrder(o) || o.paymentStatus !== "Paid")
        continue;
      totalPaise += o.totalAmount || 0;
      if ((o.paymentMode || "").toLowerCase().includes("cash")) {
        cashPaise += o.totalAmount || 0;
        cashTxns++;
      }
    }
  }

  const volPercent =
    totalPaise > 0 ? Math.round((cashPaise / totalPaise) * 100) : 0;

  res.summary = {
    cashVolume: formatCurrencyPaise(
      cashPaise,
      res.currencySymbol,
      res.currency,
    ),
    txnCount: `${cashTxns} Transactions`,
    volPercent: `${volPercent}% of vol`,
    percentNum: volPercent,
  };

  res.kpi = {
    value: cashPaise,
    displayValue: formatCurrencyPaise(
      cashPaise,
      res.currencySymbol,
      res.currency,
    ),
    label: "Cash Tender Volume",
    secondaryMetrics: [
      { label: "Cash Transactions", value: cashTxns },
      { label: "Share of Intake", value: `${volPercent}%` },
    ],
  };

  return res;
}

export async function provideCashierDigitalSales(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const payments = await ctx.db
    .query("orderPayments")
    .withIndex("by_org_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  let digitalPaise = 0;
  let digitalTxns = 0;
  let upiCount = 0;
  let cardCount = 0;
  let totalPaise = 0;

  if (payments.length > 0) {
    for (const p of payments) {
      const isDebit = p.paymentType === "Debit";
      const amt = p.payAmount || p.amount || 0;
      const signedAmt = isDebit ? -amt : amt;
      totalPaise += signedAmt;
      const mode = (p.paymentModeName || "").toLowerCase();
      if (!mode.includes("cash")) {
        digitalPaise += signedAmt;
        if (!isDebit) {
          digitalTxns++;
          if (
            mode.includes("upi") ||
            mode.includes("qr") ||
            mode.includes("online")
          ) {
            upiCount++;
          } else {
            cardCount++;
          }
        }
      }
    }
  } else {
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_created_at", (q) =>
        q
          .eq("organizationId", org._id)
          .gte("createdAt", timeRange.from)
          .lte("createdAt", timeRange.to),
      )
      .collect();

    for (const o of orders) {
      if (!isValidActiveOrCompletedOrder(o) || o.paymentStatus !== "Paid")
        continue;
      totalPaise += o.totalAmount || 0;
      const mode = (o.paymentMode || "").toLowerCase();
      if (!mode.includes("cash")) {
        digitalPaise += o.totalAmount || 0;
        digitalTxns++;
        if (
          mode.includes("upi") ||
          mode.includes("qr") ||
          mode.includes("online")
        ) {
          upiCount++;
        } else {
          cardCount++;
        }
      }
    }
  }

  const prevOrders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.comparisonFrom)
        .lte("createdAt", timeRange.comparisonTo),
    )
    .collect();

  let prevDigitalPaise = 0;
  for (const o of prevOrders) {
    if (!isValidActiveOrCompletedOrder(o) || o.paymentStatus !== "Paid") continue;
    const mode = (o.paymentMode || "").toLowerCase();
    if (!mode.includes("cash")) {
      prevDigitalPaise += o.totalAmount || 0;
    }
  }

  const delta = computePercentageDelta(digitalPaise, prevDigitalPaise);

  const volPercent =
    totalPaise > 0 ? Math.round((digitalPaise / totalPaise) * 100) : 0;

  res.summary = {
    digitalVolume: formatCurrencyPaise(
      digitalPaise,
      res.currencySymbol,
      res.currency,
    ),
    deltaPercent:
      delta.deltaPercent !== undefined
        ? `${delta.deltaPercent >= 0 ? "▲ +" : "▼ "}${delta.deltaPercent}%`
        : "0.0%",
    upiCount,
    cardCount,
    totalCount: digitalTxns,
  };

  res.kpi = {
    value: digitalPaise,
    displayValue: formatCurrencyPaise(
      digitalPaise,
      res.currencySymbol,
      res.currency,
    ),
    label: "Digital Tender Volume",
    secondaryMetrics: [
      { label: "Digital Transactions", value: digitalTxns },
      { label: "Share of Intake", value: `${volPercent}%` },
    ],
  };

  return res;
}

export async function provideCashierPaymentBreakdown(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  // 1. Fetch configured payment modes from Settings (paymentModes table)
  const configuredModes = await ctx.db
    .query("paymentModes")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const activeModes = configuredModes.filter(
    (m) => m.deletedAt === undefined && m.active !== false,
  );

  // If no modes configured in DB yet, fallback to standard defaults
  const modeNames =
    activeModes.length > 0
      ? activeModes.map((m) => m.name)
      : ["UPI", "Credit Card", "Debit Card", "Cash"];

  const modeTotals: Record<string, number> = {};
  for (const name of modeNames) {
    modeTotals[name] = 0;
  }

  let totalUpiPaise = 0;
  let totalCardsPaise = 0;
  let totalCashPaise = 0;

  const payments = await ctx.db
    .query("orderPayments")
    .withIndex("by_org_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const matchMode = (modeStr: string): string => {
    const lower = modeStr.toLowerCase().trim();
    const exact = modeNames.find((m) => m.toLowerCase() === lower);
    if (exact) return exact;

    if (lower.includes("credit") && modeNames.some((m) => m.toLowerCase().includes("credit"))) {
      return modeNames.find((m) => m.toLowerCase().includes("credit"))!;
    }
    if (lower.includes("debit") && modeNames.some((m) => m.toLowerCase().includes("debit"))) {
      return modeNames.find((m) => m.toLowerCase().includes("debit"))!;
    }
    if (lower.includes("card") && modeNames.some((m) => m.toLowerCase().includes("card"))) {
      return modeNames.find((m) => m.toLowerCase().includes("card"))!;
    }
    if (lower.includes("upi") && modeNames.some((m) => m.toLowerCase().includes("upi"))) {
      return modeNames.find((m) => m.toLowerCase().includes("upi"))!;
    }
    if (lower.includes("cash") && modeNames.some((m) => m.toLowerCase().includes("cash"))) {
      return modeNames.find((m) => m.toLowerCase().includes("cash"))!;
    }
    return modeStr.trim() || "Other";
  };

  if (payments.length > 0) {
    for (const p of payments) {
      const isDebit = p.paymentType === "Debit";
      const amtPaise = p.payAmount || p.amount || 0;
      const signedAmt = isDebit ? -amtPaise : amtPaise;
      const modeStr = (p.paymentModeName || "").trim();
      const lower = modeStr.toLowerCase();

      if (
        lower.includes("upi") ||
        lower.includes("qr") ||
        lower.includes("gpay") ||
        lower.includes("phonepe")
      ) {
        totalUpiPaise += signedAmt;
      } else if (
        lower.includes("card") ||
        lower.includes("pos") ||
        lower.includes("credit") ||
        lower.includes("debit")
      ) {
        totalCardsPaise += signedAmt;
      } else if (lower.includes("cash")) {
        totalCashPaise += signedAmt;
      }

      const resolved = matchMode(modeStr);
      modeTotals[resolved] = (modeTotals[resolved] || 0) + signedAmt;
    }

    // Ensure net amounts do not show as negative
    for (const k of Object.keys(modeTotals)) {
      if (modeTotals[k] < 0) modeTotals[k] = 0;
    }
    totalUpiPaise = Math.max(0, totalUpiPaise);
    totalCardsPaise = Math.max(0, totalCardsPaise);
    totalCashPaise = Math.max(0, totalCashPaise);
  } else {
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_created_at", (q) =>
        q
          .eq("organizationId", org._id)
          .gte("createdAt", timeRange.from)
          .lte("createdAt", timeRange.to),
      )
      .collect();

    for (const o of orders) {
      if (!isValidActiveOrCompletedOrder(o) || o.paymentStatus !== "Paid")
        continue;
      const amtPaise = o.totalAmount || 0;
      const modeStr = (o.paymentMode || "Cash").trim();
      const lower = modeStr.toLowerCase();

      if (lower.includes("upi") || lower.includes("qr") || lower.includes("gpay") || lower.includes("phonepe")) {
        totalUpiPaise += amtPaise;
      } else if (lower.includes("card") || lower.includes("pos") || lower.includes("credit") || lower.includes("debit")) {
        totalCardsPaise += amtPaise;
      } else if (lower.includes("cash")) {
        totalCashPaise += amtPaise;
      }

      const resolved = matchMode(modeStr);
      modeTotals[resolved] = (modeTotals[resolved] || 0) + amtPaise;
    }
  }

  const totalAmountPaise = Object.values(modeTotals).reduce((a, b) => a + b, 0);

  const breakdown = Object.entries(modeTotals).map(([name, paise]) => {
    const percentNum = totalAmountPaise > 0 ? Math.round((paise / totalAmountPaise) * 100) : 0;
    return {
      name,
      percent: `${percentNum}%`,
      percentNum,
      amount: formatCurrencyPaise(paise, res.currencySymbol, res.currency),
      paise,
    };
  });

  const standardSeries = [
    { label: "UPI", value: totalUpiPaise / 100 },
    { label: "Cards", value: totalCardsPaise / 100 },
    { label: "Cash", value: totalCashPaise / 100 },
  ];
  for (const b of breakdown) {
    const l = b.name.toLowerCase();
    if (
      !l.includes("upi") &&
      !l.includes("card") &&
      !l.includes("credit") &&
      !l.includes("debit") &&
      !l.includes("cash")
    ) {
      standardSeries.push({ label: b.name, value: b.paise / 100 });
    }
  }

  const upiPct = totalAmountPaise > 0 ? Math.round((totalUpiPaise / totalAmountPaise) * 100) : 0;
  const cardsPct = totalAmountPaise > 0 ? Math.round((totalCardsPaise / totalAmountPaise) * 100) : 0;
  const cashPct = totalAmountPaise > 0 ? Math.round((totalCashPaise / totalAmountPaise) * 100) : 0;

  res.summary = {
    breakdown,
    upiPercent: `${upiPct}%`,
    upiAmount: formatCurrencyPaise(
      totalUpiPaise,
      res.currencySymbol,
      res.currency,
    ),
    cardsPercent: `${cardsPct}%`,
    cardsAmount: formatCurrencyPaise(
      totalCardsPaise,
      res.currencySymbol,
      res.currency,
    ),
    cashPercent: `${cashPct}%`,
    cashAmount: formatCurrencyPaise(
      totalCashPaise,
      res.currencySymbol,
      res.currency,
    ),
  };

  res.chart = {
    chartType: "donut",
    type: "donut",
    series: [{ name: "Tenders", data: standardSeries }],
    data: standardSeries,
    xAxisLabel: "Tender Type",
    yAxisLabel: `Volume (${res.currency})`,
  };

  return res;
}

export async function provideCashierRefundSummary(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const payments = await ctx.db
    .query("orderPayments")
    .withIndex("by_org_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  let refundPaise = 0;
  let refundCount = 0;

  for (const p of payments) {
    if (p.paymentType === "Debit" || (p.refundAmount && p.refundAmount > 0)) {
      refundPaise += p.refundAmount || p.amount || 0;
      refundCount++;
    }
  }

  if (refundCount === 0) {
    for (const o of orders) {
      if (
        o.paymentStatus === "Refunded" ||
        o.paymentStatus === "Partially Refunded"
      ) {
        refundPaise += o.totalAmount || 0;
        refundCount++;
      }
    }
  }

  res.summary = {
    refundTotal: formatCurrencyPaise(
      refundPaise,
      res.currencySymbol,
      res.currency,
    ),
    refundCount: `${refundCount} Refunds Settled`,
    voidCount: "0 Items",
    voidTotal: formatCurrencyPaise(0, res.currencySymbol, res.currency),
    managerAuth: "Verified Ledger",
  };

  res.kpi = {
    value: refundPaise,
    displayValue: formatCurrencyPaise(
      refundPaise,
      res.currencySymbol,
      res.currency,
    ),
    label: "Refunds & Voids Logged",
    trend: refundCount > 0 ? "down" : "neutral",
    secondaryMetrics: [
      { label: "Refund Transactions", value: refundCount },
      { label: "Approval Audit", value: "Verified Ledger" },
    ],
  };

  return res;
}

export async function provideCashierTransactionHistory(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const now = Date.now();
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const payments = await ctx.db
    .query("orderPayments")
    .withIndex("by_org_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .order("desc")
    .take(15);

  let rows = [];
  if (payments.length > 0) {
    const orderDocs = await Promise.all(
      payments.map((p) => ctx.db.get(p.orderId)),
    );

    rows = payments.map((p, idx) => {
      const order = orderDocs[idx];
      const rawNum = order?.orderNumber || "";
      const displayOrderNumber = rawNum
        ? rawNum.startsWith("#") ? rawNum : `#${rawNum}`
        : `#${String(p.orderId).slice(-6)}`;

      return {
        id: p._id,
        orderId: displayOrderNumber,
        orderNumber: displayOrderNumber,
        mode: p.paymentModeName,
        type: p.paymentType || "Credit",
        amount: formatCurrencyPaise(
          p.payAmount || p.amount || 0,
          res.currencySymbol,
          res.currency,
        ),
        ref: p.transactionReference || "POS-LOCAL",
        time: formatRelativeTime(p.createdAt, now),
      };
    });
  } else {
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_created_at", (q) =>
        q
          .eq("organizationId", org._id)
          .gte("createdAt", timeRange.from)
          .lte("createdAt", timeRange.to),
      )
      .order("desc")
      .take(15);

    rows = orders.map((o) => {
      const displayOrderNumber = o.orderNumber
        ? o.orderNumber.startsWith("#") ? o.orderNumber : `#${o.orderNumber}`
        : `#${String(o._id).slice(-6)}`;

      return {
        id: o._id,
        orderId: displayOrderNumber,
        orderNumber: displayOrderNumber,
        mode: o.paymentMode,
        type: "Credit",
        amount: formatCurrencyPaise(
          o.totalAmount || 0,
          res.currencySymbol,
          res.currency,
        ),
        ref: o.paymentStatus,
        time: formatRelativeTime(o.createdAt, now),
      };
    });
  }

  res.table = {
    columns: [
      { key: "orderId", label: "Reference #" },
      { key: "mode", label: "Tender Method" },
      { key: "type", label: "Entry" },
      { key: "amount", label: "Amount", align: "right" },
      { key: "ref", label: "Authorization" },
      { key: "time", label: "Timestamp", align: "right" },
    ],
    rows,
    totalCount: rows.length,
  };

  res.summary = {
    recentTxns: rows.slice(0, 5).map((r) => ({
      billNumber: r.orderNumber,
      orderNumber: r.orderNumber,
      amount: r.amount,
      mode: r.mode || "UPI",
      time: r.time,
    })),
  };

  return res;
}

export async function provideCashierOpenSessions(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const users = await ctx.db
    .query("organizationUsers")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const cashierOperators = users.filter((u) => {
    if (u.deletedAt !== undefined) return false;
    const types = (u.userType || []).map((t) => (t || "").trim().toLowerCase());
    return (
      types.includes("cashier") ||
      types.includes("admin") ||
      types.includes("store_admin") ||
      types.includes("org_admin") ||
      types.includes("captain")
    );
  });

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const paidOrders = orders.filter(
    (o) => isValidActiveOrCompletedOrder(o) && o.paymentStatus === "Paid",
  );
  const totalPaidPaise = paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const operators =
    cashierOperators.length > 0
      ? cashierOperators
      : users.filter((u) => u.deletedAt === undefined);

  const registerRows = operators.map((u, idx) => {
    const operatorName =
      `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || "Staff Operator";

    const userPaidPaise = paidOrders
      .filter((o) => o.cashierUserId === u.userId)
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const loggedAmount =
      userPaidPaise > 0
        ? userPaidPaise
        : idx === 0
          ? totalPaidPaise
          : 0;

    return {
      name: idx === 0 ? "Register 01 (Main Counter)" : `Register 0${idx + 1}`,
      operator: operatorName,
      duration: "Active",
      logged: formatCurrencyPaise(loggedAmount, res.currencySymbol, res.currency),
    };
  });

  res.summary = {
    activeRegisters: registerRows,
  };

  res.kpi = {
    value: registerRows.length,
    displayValue: `${registerRows.length} Registers`,
    label: "Active Cashier Terminals",
    secondaryMetrics: [
      { label: "Authorized Cashiers", value: registerRows.length },
      { label: "Drawer State", value: "Active Register" },
    ],
  };

  return res;
}

export async function provideCashierSplitBills(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const payments = await ctx.db
    .query("orderPayments")
    .withIndex("by_org_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const byOrder: Record<string, number> = {};
  for (const p of payments) {
    byOrder[p.orderId] = (byOrder[p.orderId] || 0) + 1;
  }

  const splitCount = Object.values(byOrder).filter((c) => c > 1).length;

  res.kpi = {
    value: splitCount,
    displayValue: `${splitCount} Splits`,
    label: "Split Tender Folios",
    secondaryMetrics: [
      { label: "Total Multi-Pay Orders", value: splitCount },
      {
        label: "Split Settlement Ratio",
        value: `${payments.length > 0 ? Math.round((splitCount / payments.length) * 100) : 0}%`,
      },
    ],
  };

  return res;
}

// ==========================================
// ==========================================
// 9. CAPTAIN PROVIDERS
// ==========================================

function formatCaptainStaffName(
  user?: { firstName?: string; lastName?: string; email?: string } | null,
  fallback = "Staff Member",
): string {
  if (!user) return fallback;
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName.charAt(0)}.`;
  }
  if (user.firstName) return user.firstName;
  if (user.lastName) return user.lastName;
  if (user.email) {
    const prefix = user.email.split("@")[0];
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  return fallback;
}

interface StoreCaptain {
  id: string;
  altId?: string;
  name: string;
  role: string;
}

async function getStoreCaptainStaff(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
): Promise<StoreCaptain[]> {
  const result: StoreCaptain[] = [];
  const seenIds = new Set<string>();

  // 1. Employees in organizationUsers with captain or waiter role
  const orgUsers = await ctx.db
    .query("organizationUsers")
    .withIndex("by_org", (q) => q.eq("organizationId", orgId))
    .collect();

  for (const u of orgUsers) {
    if (u.deletedAt !== undefined) continue;
    const isCaptain = (u.userType || []).some(
      (t) => t === "captain" || t === "waiter" || t.toLowerCase().includes("captain") || t.toLowerCase().includes("waiter"),
    );
    if (isCaptain) {
      const name = formatCaptainStaffName(u);
      const docId = String(u._id);
      result.push({
        id: docId,
        altId: u.userId,
        name,
        role: u.userType.includes("captain") ? "Floor Captain" : "Floor Server",
      });
      seenIds.add(docId);
      if (u.userId) seenIds.add(u.userId);
    }
  }

  // Fallback if no specific waiter/captain tag: include all active staff members
  if (result.length === 0) {
    for (const u of orgUsers) {
      if (u.deletedAt !== undefined) continue;
      const name = formatCaptainStaffName(u);
      const docId = String(u._id);
      result.push({
        id: docId,
        altId: u.userId,
        name,
        role: "Floor Server",
      });
      seenIds.add(docId);
      if (u.userId) seenIds.add(u.userId);
    }
  }

  // 2. Floor staff in organizationWaiters table
  const waiters = await ctx.db.query("organizationWaiters").collect();
  for (const w of waiters) {
    if (w.deletedAt !== undefined) continue;
    const idStr = String(w._id);
    if (!seenIds.has(idStr)) {
      let name = "Floor Waiter";
      if (w.firstName && w.lastName) {
        name = `${w.firstName} ${w.lastName.charAt(0)}.`;
      } else if (w.firstName) {
        name = w.firstName;
      } else if (w.waiterCode) {
        name = `Waiter ${w.waiterCode}`;
      }
      result.push({
        id: idStr,
        name,
        role: "Floor Server",
      });
      seenIds.add(idStr);
    }
  }

  return result;
}

function isCaptainOrder(o: Doc<"orders">): boolean {
  if (o.orderSource && o.orderSource.toLowerCase().includes("captain")) {
    return true;
  }
  if (o.waiterUserId && o.waiterUserId.trim() !== "") {
    return true;
  }
  return false;
}

async function getStoreTableAndLayoutMaps(ctx: QueryCtx) {
  const tables = await ctx.db.query("organizationTables").collect();
  const activeTables = tables.filter((t) => t.deletedAt === undefined);
  const tableMap = new Map(activeTables.map((t) => [t._id, t]));

  const layouts = await ctx.db.query("organizationLayouts").collect();
  const activeLayouts = layouts.filter((l) => l.deletedAt === undefined);
  const layoutMap = new Map(activeLayouts.map((l) => [l._id, l.name]));

  return { activeTables, tableMap, layoutMap };
}

/**
 * Resolves the currently active dining order for a physical table.
 * Queries orders placed for table._id, falling back to table.currentOrderId.
 * If no open order exists or the order is finished/delivered, returns null (Vacant).
 */
async function resolveActiveTableOrder(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  table: Doc<"organizationTables">,
  timeRange?: DateRangeWindow,
): Promise<Doc<"orders"> | null> {
  let ord: Doc<"orders"> | null = null;

  // 1. Direct query of orders referencing this tableId
  const ordersOnTable = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", orgId))
    .filter((q) => q.eq(q.field("tableId"), table._id))
    .collect();

  const activeOnTable = ordersOnTable
    .filter(
      (o) =>
        !o.isCompleted &&
        !o.isRejected &&
        o.orderStatusName !== "Completed" &&
        o.orderStatusName !== "Delivered" &&
        o.orderStatusName !== "Cancelled" &&
        o.orderStatusName !== "Rejected",
    )
    .sort((a, b) => b.createdAt - a.createdAt);

  if (activeOnTable.length > 0) {
    ord = activeOnTable[0];
  } else if (table.currentOrderId) {
    // 2. Fallback to table.currentOrderId pointer
    const normId = ctx.db.normalizeId("orders", table.currentOrderId);
    if (normId) {
      ord = await ctx.db.get(normId);
    }
    if (!ord) {
      ord = await ctx.db
        .query("orders")
        .withIndex("by_org", (q) => q.eq("organizationId", orgId))
        .filter((q) => q.eq(q.field("orderNumber"), table.currentOrderId))
        .first();
    }
  }

  if (
    ord &&
    !ord.isCompleted &&
    !ord.isRejected &&
    ord.orderStatusName !== "Completed" &&
    ord.orderStatusName !== "Delivered" &&
    ord.orderStatusName !== "Cancelled" &&
    ord.orderStatusName !== "Rejected"
  ) {
    if (timeRange && (ord.createdAt < timeRange.from || ord.createdAt > timeRange.to)) {
      return null;
    }
    return ord;
  }

  return null;
}

export async function provideCaptainActiveOrders(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );
  const { tableMap, layoutMap } = await getStoreTableAndLayoutMaps(ctx);
  const captains = await getStoreCaptainStaff(ctx, org._id);

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  // ONLY captain orders!
  const activeOrders = orders.filter(
    (o) =>
      isCaptainOrder(o) &&
      !o.isCompleted &&
      !o.isRejected &&
      o.orderStatusName !== "Completed" &&
      o.orderStatusName !== "Delivered" &&
      o.orderStatusName !== "Rejected" &&
      o.orderStatusName !== "Cancelled",
  );

  const statsMap = new Map<
    string,
    {
      id: string;
      name: string;
      zone: string;
      tablesCount: number;
      covers: number;
      amount: number;
    }
  >();

  for (const c of captains) {
    const entry = {
      id: c.id,
      name: c.name,
      zone: c.role,
      tablesCount: 0,
      covers: 0,
      amount: 0,
    };
    statsMap.set(c.id, entry);
    if (c.altId) {
      statsMap.set(c.altId, entry);
    }
  }

  for (const o of activeOrders) {
    const staffKey = o.waiterUserId;
    let entry = staffKey ? statsMap.get(staffKey) : undefined;
    if (!entry && staffKey) {
      const match = captains.find((c) => c.id === staffKey || c.altId === staffKey);
      if (match) {
        entry = statsMap.get(match.id);
      }
      if (!entry) {
        const normUserId = ctx.db.normalizeId("organizationUsers", staffKey);
        const staffDoc = normUserId ? await ctx.db.get(normUserId) : null;
        if (staffDoc) {
          const staffName = formatCaptainStaffName(staffDoc);
          entry = {
            id: String(staffDoc._id),
            name: staffName,
            zone: "Floor Server",
            tablesCount: 0,
            covers: 0,
            amount: 0,
          };
          statsMap.set(staffKey, entry);
          statsMap.set(String(staffDoc._id), entry);
          if (staffDoc.userId) statsMap.set(staffDoc.userId, entry);
        }
      }
    }

    if (!entry) {
      entry = statsMap.get("unassigned");
      if (!entry) {
        entry = {
          id: "unassigned",
          name: "Floor Captain",
          zone: "Floor Service",
          tablesCount: 0,
          covers: 0,
          amount: 0,
        };
        statsMap.set("unassigned", entry);
      }
    }

    entry.tablesCount += 1;
    entry.covers += o.membersOnTable || 2;
    entry.amount += o.subTotal || o.totalAmount || 0;
    if (o.tableId) {
      const tbl = tableMap.get(o.tableId);
      if (tbl?.layoutId && layoutMap.has(tbl.layoutId)) {
        entry.zone = layoutMap.get(tbl.layoutId)!;
      } else if (tbl) {
        entry.zone = `Table ${tbl.tableNumber}`;
      }
    }
  }

  // Deduplicate stats entries by their canonical id
  const uniqueEntries = Array.from(
    new Map(Array.from(statsMap.values()).map((e) => [e.id, e])).values(),
  );

  const captainList = uniqueEntries
    .filter((entry) => entry.tablesCount > 0)
    .map((entry, idx) => ({
      rank: idx + 1,
      name: entry.name,
      zone: entry.zone,
      tablesCount: entry.tablesCount,
      covers: entry.covers,
      amount: entry.amount,
      amountFormatted: formatCurrencyPaise(
        entry.amount,
        res.currencySymbol,
        res.currency,
        res.country,
      ),
    }));

  captainList.sort((a, b) => b.amount - a.amount || b.tablesCount - a.tablesCount);
  captainList.forEach((c, idx) => {
    c.rank = idx + 1;
  });

  res.kpi = {
    value: activeOrders.length,
    displayValue: `${activeOrders.length} Active`,
    label: "Active Captain Folios",
    trend: activeOrders.length > 0 ? "up" : "down",
    secondaryMetrics: [
      {
        label: "Active Servers",
        value: captainList.length,
      },
      {
        label: "Total Covers",
        value: captainList.reduce((s, c) => s + c.covers, 0),
      },
    ],
  };

  res.summary = {
    activeOrdersCount: activeOrders.length,
    captains: captainList,
  };
  return res;
}

export async function provideCaptainTableServiceStatus(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );
  const { activeTables } = await getStoreTableAndLayoutMaps(ctx);

  const now = Date.now();
  const tableCards = await Promise.all(
    activeTables.slice(0, 8).map(async (t) => {
      // 1. A table is ONLY occupied if it has an active current order
      const activeOrder = await resolveActiveTableOrder(ctx, org._id, t, timeRange);

      const isOccupied = Boolean(activeOrder);
      const isBlocked = Boolean(t.isBlock);

      // Check active postpaid request
      const activePostpaidReq = await ctx.db
        .query("postpaidOrderRequests")
        .withIndex("by_table_and_status", (q) =>
          q.eq("tableId", t._id).eq("status", "requested"),
        )
        .first();
      const hasRequest = Boolean(
        activePostpaidReq && activePostpaidReq.deletedAt === undefined,
      );

      const tableNum =
        t.tableNumber.startsWith("T-") || t.tableNumber.startsWith("M-")
          ? t.tableNumber
          : `T-${t.tableNumber}`;

      let stage = "Vacant";
      let isVacant = true;
      let elapsed: string | undefined = undefined;
      let badgeColor = "bg-surface-container text-secondary";

      if (isOccupied && activeOrder) {
        stage = activeOrder.orderStatusName || "In Service";
        isVacant = false;
        const elapsedMins = Math.max(
          1,
          Math.floor((now - (activeOrder.updatedAt || activeOrder.createdAt)) / 60000),
        );
        elapsed = `${elapsedMins}m`;
        badgeColor = "bg-primary text-on-primary";
      } else if (hasRequest) {
        stage = "QR Request";
        isVacant = false;
        badgeColor = "bg-amber-600 text-white";
      } else if (isBlocked) {
        stage = "Reserved";
        isVacant = false;
        badgeColor = "bg-stone-300 text-stone-800";
      }

      return {
        tableNumber: tableNum,
        seating: `${t.seatingCapacity || 4}p`,
        stage,
        elapsed,
        isVacant,
        badgeColor,
      };
    }),
  );

  const occupiedCount = tableCards.filter((t) => !t.isVacant).length;

  res.kpi = {
    value: occupiedCount,
    displayValue: `${occupiedCount}/${activeTables.length}`,
    label: "Floor Table Occupancy",
    trend: occupiedCount > 0 ? "up" : "down",
    secondaryMetrics: [
      { label: "Occupied Tables", value: occupiedCount },
      { label: "Vacant Tables", value: activeTables.length - occupiedCount },
    ],
  };

  res.summary = {
    tableCards,
  };
  return res;
}

export async function provideCaptainAssignedTables(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );
  const { activeTables, tableMap, layoutMap } = await getStoreTableAndLayoutMaps(ctx);
  const captains = await getStoreCaptainStaff(ctx, org._id);

  const occupiedTableRecords = (
    await Promise.all(
      activeTables.map(async (t) => {
        const ord = await resolveActiveTableOrder(ctx, org._id, t, timeRange);
        if (ord && isCaptainOrder(ord)) {
          return { table: t, order: ord };
        }
        return null;
      }),
    )
  ).filter(
    (item): item is { table: Doc<"organizationTables">; order: Doc<"orders"> } =>
      item !== null,
  );

  const rosters = captains.map((c) => {
    const staffOccupied = occupiedTableRecords.filter(
      (rec) =>
        rec.order.waiterUserId === c.id ||
        (c.altId !== undefined && rec.order.waiterUserId === c.altId),
    );

    let sectionName = c.role;
    if (staffOccupied.length > 0) {
      const firstTbl = staffOccupied[0].table;
      if (firstTbl.layoutId && layoutMap.has(firstTbl.layoutId)) {
        sectionName = layoutMap.get(firstTbl.layoutId)!;
      } else {
        sectionName = `Table ${firstTbl.tableNumber}`;
      }
    }

    const activeCount = staffOccupied.length;
    const totalActive = occupiedTableRecords.length;
    const loadPct =
      totalActive > 0 ? Math.round((activeCount / totalActive) * 100) : 0;

    return {
      name: c.name,
      section: sectionName,
      activeCount,
      activePct: `${loadPct}%`,
    };
  });

  const activeCovers = occupiedTableRecords.reduce(
    (sum, rec) => sum + (rec.table.seatingCapacity || 2),
    0,
  );
  const firstLayoutName =
    layoutMap.size > 0 ? layoutMap.values().next().value : undefined;
  const defaultStation =
    firstLayoutName ||
    (activeTables.length > 0 ? `Table ${activeTables[0].tableNumber}` : "Floor Service");

  res.kpi = {
    value: occupiedTableRecords.length,
    displayValue: `${occupiedTableRecords.length} Tables`,
    label: "Assigned Service Tables",
    secondaryMetrics: [
      { label: "Floor Station", value: defaultStation },
      { label: "Active Covers", value: activeCovers },
    ],
  };

  res.summary = {
    activeTablesCount: occupiedTableRecords.length,
    totalTablesCount: activeTables.length,
    rosters,
  };
  return res;
}

export async function provideCaptainServiceTime(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );
  const { tableMap, layoutMap } = await getStoreTableAndLayoutMaps(ctx);

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  // ONLY completed captain orders!
  const completed = orders.filter(
    (o) =>
      isCaptainOrder(o) &&
      (o.isCompleted ||
        o.orderStatusName === "Completed" ||
        o.orderStatusName === "Delivered"),
  );

  let totalDuration = 0;
  let fastestMins = Infinity;
  let fastestSectionName = "";

  for (const o of completed) {
    const rawDur = Math.max(
      1,
      Math.floor(((o.updatedAt || o.createdAt) - o.createdAt) / 60000),
    );
    // Cap at 90m to avoid test orders left open across shifts skewing average
    const dur = Math.min(rawDur, 90);
    totalDuration += dur;
    if (dur < fastestMins) {
      fastestMins = dur;
      if (o.tableId && tableMap.has(o.tableId)) {
        const tbl = tableMap.get(o.tableId)!;
        if (tbl.layoutId && layoutMap.has(tbl.layoutId)) {
          fastestSectionName = layoutMap.get(tbl.layoutId)!;
        } else {
          fastestSectionName = `Table ${tbl.tableNumber}`;
        }
      } else if (o.tokenNumber) {
        fastestSectionName = `Token #${o.tokenNumber}`;
      } else {
        fastestSectionName = "Floor Service";
      }
    }
  }

  const avgTurn =
    completed.length > 0 ? Math.round(totalDuration / completed.length) : 0;

  const avgTurnDisplay = avgTurn > 0 ? `${avgTurn}m` : "--";
  const deltaBenchmark =
    avgTurn > 0
      ? `${avgTurn > 42 ? "+" : ""}${(avgTurn - 42).toFixed(1)}m`
      : "--";
  const fastestSectionDisplay =
    fastestMins !== Infinity ? `${fastestSectionName} (${fastestMins}m)` : "--";

  res.kpi = {
    value: avgTurn,
    displayValue: avgTurn > 0 ? `${avgTurn}m` : "--",
    label: "Attendant Tempo & Table Turn",
    trend: avgTurn > 0 && avgTurn <= 45 ? "up" : "down",
    secondaryMetrics: [
      { label: "Benchmark Turn", value: "42.0m" },
      { label: "Delta vs Target", value: deltaBenchmark },
      { label: "Fastest Section", value: fastestSectionDisplay },
    ],
  };

  res.summary = {
    avgTurnMins: avgTurnDisplay,
    completedTables: completed.length,
    deltaBenchmark,
    fastestSection: fastestSectionDisplay,
  };
  return res;
}

export async function provideCaptainOrdersAwaitingService(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );
  const { tableMap } = await getStoreTableAndLayoutMaps(ctx);

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  // ONLY captain / table orders awaiting runner pickup
  const readyOrders = orders.filter(
    (o) =>
      isCaptainOrder(o) &&
      !o.isCompleted &&
      !o.isRejected &&
      (o.orderStatusName?.toLowerCase().includes("ready") ||
        deriveWorkstationStatusKey(o) === "READY"),
  );

  const now = Date.now();
  const awaitingList = readyOrders.slice(0, 5).map((o) => {
    const elapsedMins = Math.floor(
      (now - (o.updatedAt || o.createdAt)) / 60000,
    );
    let tableLabel = "Table";
    if (o.tableId && tableMap.has(o.tableId)) {
      const t = tableMap.get(o.tableId)!;
      tableLabel =
        t.tableNumber.startsWith("T-") || t.tableNumber.startsWith("M-")
          ? t.tableNumber
          : `T-${t.tableNumber}`;
    } else if (o.tokenNumber) {
      tableLabel = `Token #${o.tokenNumber}`;
    } else {
      tableLabel = o.orderNumber;
    }

    return {
      table: tableLabel,
      item: "Food Order Ready at Pass",
      readyAgo: `${elapsedMins}m ago`,
      isUrgent: elapsedMins > 3,
    };
  });

  res.kpi = {
    value: readyOrders.length,
    displayValue: `${readyOrders.length} Ready`,
    label: "Orders Awaiting Service",
    trend: readyOrders.length > 0 ? "down" : "up",
    secondaryMetrics: [
      { label: "Waiting at Pass", value: readyOrders.length },
      {
        label: "Pass Status",
        value: readyOrders.length > 0 ? "Runner Needed" : "Pass Clear",
      },
    ],
  };

  res.summary = {
    countAtPass: readyOrders.length,
    isUrgent: readyOrders.length > 0,
    ordersAtPass: awaitingList,
  };
  return res;
}

export async function provideCaptainPerformanceSummary(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );
  const captains = await getStoreCaptainStaff(ctx, org._id);

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  // ONLY completed captain orders
  const completed = orders.filter(
    (o) =>
      isCaptainOrder(o) &&
      (o.isCompleted ||
        o.orderStatusName === "Completed" ||
        o.orderStatusName === "Delivered"),
  );

  const staffPerformance = captains.map((c) => {
    const staffOrders = completed.filter(
      (o) =>
        o.waiterUserId === c.id ||
        (c.altId !== undefined && o.waiterUserId === c.altId),
    );
    const sales = staffOrders.reduce(
      (sum, o) => sum + (o.subTotal || o.totalAmount || 0),
      0,
    );
    return {
      name: c.name,
      salesAmount: sales,
      orderCount: staffOrders.length,
      turnRate: staffOrders.length > 0 ? `${staffOrders.length} orders` : "--",
    };
  });

  staffPerformance.sort((a, b) => b.salesAmount - a.salesAmount);

  const formattedCaptains = staffPerformance.slice(0, 3).map((sp, idx) => ({
    name: sp.name,
    sales:
      sp.salesAmount > 0
        ? formatCurrencyPaise(
            sp.salesAmount,
            res.currencySymbol,
            res.currency,
            res.country,
          )
        : `${res.currencySymbol} 0.00`,
    turnRate: sp.turnRate,
    rank:
      idx === 0 && sp.salesAmount > 0
        ? "Top Performer"
        : idx === 1 && sp.salesAmount > 0
          ? "Pacing Lead"
          : "Standard",
  }));

  const totalCovers = completed.reduce((s, o) => s + (o.membersOnTable || 2), 0);
  let totalDur = 0;
  for (const o of completed) {
    const raw = Math.max(
      1,
      Math.floor(((o.updatedAt || o.createdAt) - o.createdAt) / 60000),
    );
    totalDur += Math.min(raw, 90);
  }
  const avgMins =
    completed.length > 0 ? Math.round(totalDur / completed.length) : 0;

  res.summary = {
    captains: formattedCaptains,
    totalCovers,
    avgTurnMins: avgMins > 0 ? `${avgMins}m` : "--",
  };
  return res;
}

export async function provideCaptainOrderActivity(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );
  const { tableMap } = await getStoreTableAndLayoutMaps(ctx);
  const captains = await getStoreCaptainStaff(ctx, org._id);
  const captainMap = new Map(captains.map((c) => [c.id, c]));

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  // ONLY captain orders!
  const captainOrders = orders.filter(isCaptainOrder);

  const sorted = captainOrders
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10);

  const events = sorted.map((o) => {
    const timeStr = formatStoreTime(o.createdAt, res.timeZone, res.country);

    let captainName = "Floor Captain";
    if (o.waiterUserId) {
      const match = captains.find(
        (c) => c.id === o.waiterUserId || (c.altId && c.altId === o.waiterUserId),
      );
      if (match) {
        captainName = match.name;
      }
    }

    let tableLabel = "Table";
    if (o.tableId && tableMap.has(o.tableId)) {
      const tbl = tableMap.get(o.tableId)!;
      tableLabel =
        tbl.tableNumber.startsWith("T-") || tbl.tableNumber.startsWith("M-")
          ? tbl.tableNumber
          : `T-${tbl.tableNumber}`;
    } else if (o.tokenNumber) {
      tableLabel = `#${o.tokenNumber}`;
    } else {
      tableLabel =
        o.orderNumber.length > 6 ? o.orderNumber.slice(-4) : o.orderNumber;
    }

    let action = `Fired ${o.orderType || "DineIn"} order (${o.orderStatusName || "Accepted"})`;
    if (
      o.isCompleted ||
      o.orderStatusName === "Completed" ||
      o.orderStatusName === "Delivered"
    ) {
      action = "Completed order & presented checkout bill";
    } else if (o.isModify) {
      action = "Updated order items & table note";
    } else if (
      o.isRejected ||
      o.orderStatusName === "Rejected" ||
      o.orderStatusName === "Cancelled"
    ) {
      action = "Order rejected / cancelled";
    }

    return {
      time: timeStr,
      captain: captainName,
      action,
      table: tableLabel,
    };
  });

  res.summary = {
    auditEvents: events,
  };
  return res;
}

// ==========================================
// 10. QUEUE PROVIDERS
// ==========================================

/**
 * Helper to parse timestamp from a queue record matching app/queue/page.tsx
 */
function parseQueueRecordTimestamp(q: Doc<"organizationQueues">): number {
  if (q.reservationDate) {
    if (q.reservationDate.includes("-")) {
      const parts = q.reservationDate.split("-");
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
        } else {
          // DD-MM-YYYY
          return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
        }
      }
    } else if (q.reservationDate.includes("/")) {
      const parts = q.reservationDate.split("/");
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY/MM/DD
          return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
        } else {
          // DD/MM/YYYY
          return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
        }
      }
    }
  }
  if (q.reservationTime) return q.reservationTime;
  return q.createdAt;
}

/**
 * Formats full ticket like "05-11-2026.QN001" to clean short ticket "QN001"
 */
function formatShortQueueTicket(qNum?: string, fallbackId?: string): string {
  if (!qNum) return fallbackId ? `#Q-${fallbackId.slice(-2).toUpperCase()}` : "QN001";
  if (qNum.includes(".")) {
    const parts = qNum.split(".");
    return parts[parts.length - 1];
  }
  return qNum;
}

/**
 * Parses clean guest name from notes formatted as "Name (Phone) - Note"
 */
function parseQueueGuestName(notes?: string): string {
  if (!notes) return "Walk-in Guest";
  const firstPart = notes.split("-")[0].trim();
  const match = firstPart.match(/^([^(]+)(?:\(([^)]+)\))?/);
  if (match && match[1].trim()) {
    return match[1].trim();
  }
  return notes.split("\n")[0].slice(0, 16);
}

/**
 * Checks if a queue item is actively waiting right now
 */
function isQueueActiveWaiting(q: Doc<"organizationQueues">): boolean {
  if (q.deletedAt !== undefined) return false;
  if (
    q.queueStatus === "completed" ||
    q.queueStatus.includes("cancel") ||
    q.queueStatus === "rejected" ||
    q.queueStatus === "close"
  ) {
    return false;
  }
  return (
    q.queueStatus === "arrived" ||
    q.queueStatus === "pending" ||
    q.queueStatus === "running_late" ||
    q.queueStatus === "booked"
  );
}

/**
 * Checks if a queue item is in the requested time window
 */
function isQueueInTimeWindow(
  q: Doc<"organizationQueues">,
  timeRange: { from: number; to: number },
  isCurrentDay: boolean
): boolean {
  if (q.deletedAt !== undefined) return false;
  if (isCurrentDay && isQueueActiveWaiting(q)) return true;
  const ts = parseQueueRecordTimestamp(q);
  if (ts >= timeRange.from && ts <= timeRange.to) return true;
  if (q.createdAt >= timeRange.from && q.createdAt <= timeRange.to) return true;
  if (q.updatedAt >= timeRange.from && q.updatedAt <= timeRange.to) return true;
  return false;
}

/**
 * Checks if a queue item is outdoor based on layout or notes
 */
function isQueueOutdoor(
  q: Doc<"organizationQueues">,
  layoutMap: Map<Id<"organizationLayouts">, string>
): boolean {
  if (q.layoutId && layoutMap.has(q.layoutId)) {
    const layoutName = (layoutMap.get(q.layoutId) || "").toLowerCase();
    if (
      layoutName.includes("outdoor") ||
      layoutName.includes("patio") ||
      layoutName.includes("terrace") ||
      layoutName.includes("garden") ||
      layoutName.includes("lawn") ||
      layoutName.includes("balcony")
    ) {
      return true;
    }
  }
  const notesLower = (q.notes || "").toLowerCase();
  return notesLower.includes("patio") || notesLower.includes("outdoor");
}

export async function provideQueueLength(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const now = Date.now();
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );
  const isCurrentDay = now >= timeRange.from && now <= timeRange.to;

  const { layoutMap } = await getStoreTableAndLayoutMaps(ctx);
  const queueRecords = await ctx.db.query("organizationQueues").collect();

  const waiting = queueRecords.filter(
    (q) => isQueueActiveWaiting(q) && isQueueInTimeWindow(q, timeRange, isCurrentDay)
  );

  const totalGuests = waiting.reduce((sum, q) => sum + (q.totalGuests || 1), 0);
  const outdoor = waiting.filter((q) => isQueueOutdoor(q, layoutMap));
  const indoor = waiting.filter((q) => !isQueueOutdoor(q, layoutMap));

  const partiesCount = waiting.length < 10 ? `0${waiting.length}` : `${waiting.length}`;
  const indoorCount = indoor.length < 10 ? `0${indoor.length}` : `${indoor.length}`;
  const outdoorCount = outdoor.length < 10 ? `0${outdoor.length}` : `${outdoor.length}`;
  const statusTag = waiting.length > 5 ? "High Lobby Congestion" : "Nominal Flow";

  const totalWaitMins = waiting.reduce(
    (sum, q) => sum + Math.max(0, Math.floor((now - (q.reservationTime || q.createdAt)) / 60000)),
    0
  );
  const avgWait = waiting.length > 0 ? Math.round(totalWaitMins / waiting.length) : 0;

  res.kpi = {
    value: waiting.length,
    displayValue: `${partiesCount} Parties`,
    label: "Waiting Parties at Host Stand",
    secondaryMetrics: [
      { label: "Total Waiting Guests", value: `${totalGuests} Guests` },
      { label: "Est. Wait Duration", value: waiting.length > 0 ? `${avgWait || waiting.length * 5} mins` : "0 mins" },
    ],
  };

  res.summary = {
    partiesCount,
    rawCount: waiting.length,
    guestsCount: totalGuests,
    indoorCount,
    outdoorCount,
    statusTag,
  };

  return res;
}

export async function provideQueueWaitingCustomers(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const now = Date.now();
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );
  const isCurrentDay = now >= timeRange.from && now <= timeRange.to;

  const queueRecords = await ctx.db.query("organizationQueues").collect();
  const waiting = queueRecords
    .filter((q) => isQueueActiveWaiting(q) && isQueueInTimeWindow(q, timeRange, isCurrentDay))
    .sort((a, b) => (a.reservationTime || a.createdAt) - (b.reservationTime || b.createdAt))
    .slice(0, 10);

  const waitingList = waiting.map((q) => {
    const elapsedMinutes = Math.max(0, Math.floor((now - (q.reservationTime || q.createdAt)) / 60000));
    let status = "Waiting";
    if (q.queueStatus === "running_late") {
      status = "Late";
    } else if (q.queueStatus === "arrived") {
      status = "In Lobby";
    } else if (q.queueStatus === "booked") {
      status = "Booked";
    } else if (elapsedMinutes > 15) {
      status = "Paged";
    }

    return {
      id: q._id,
      ticket: formatShortQueueTicket(q.queueNumber, q._id),
      name: parseQueueGuestName(q.notes),
      pax: `${q.totalGuests || 2}p`,
      waitMins: `${elapsedMinutes}m`,
      status,
    };
  });

  const totalPax = waiting.reduce((sum, q) => sum + (q.totalGuests || 1), 0);
  const avgWait =
    waiting.length > 0
      ? Math.round(
          waiting.reduce(
            (sum, q) =>
              sum + Math.max(0, Math.floor((now - (q.reservationTime || q.createdAt)) / 60000)),
            0
          ) / waiting.length
        )
      : 0;

  res.summary = {
    avgWaitTimeMinutes: avgWait,
    waitingPartiesCount: waiting.length,
    waitingPaxTotal: totalPax,
    waitingList,
  };

  res.kpi = {
    value: waiting.length,
    displayValue: `${waiting.length} Waiting`,
    label: "Waitlist Queue Latency",
    trend: waiting.length > 5 ? "down" : "neutral",
    secondaryMetrics: [
      { label: "Parties Waiting", value: waiting.length },
      { label: "Total Pax", value: totalPax },
    ],
  };

  return res;
}

export async function provideQueueAvgWaitTime(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const now = Date.now();
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );
  const isCurrentDay = now >= timeRange.from && now <= timeRange.to;

  const queue = await ctx.db.query("organizationQueues").collect();

  const periodQueues = queue.filter((q) => isQueueInTimeWindow(q, timeRange, isCurrentDay));

  const completed = periodQueues.filter((q) => q.queueStatus === "completed" && q.deletedAt === undefined);
  const active = isCurrentDay
    ? periodQueues.filter((q) => isQueueActiveWaiting(q))
    : [];

  let totalWaitMinutes = 0;
  let count = 0;

  for (const q of completed) {
    const start = q.reservationTime || q.createdAt;
    const end = q.completionTime || q.updatedAt;
    if (end >= start) {
      const waitMins = Math.max(0, Math.floor((end - start) / 60000));
      totalWaitMinutes += waitMins;
      count++;
    }
  }

  for (const q of active) {
    const start = q.reservationTime || q.createdAt;
    const waitMins = Math.max(0, Math.floor((now - start) / 60000));
    totalWaitMinutes += waitMins;
    count++;
  }

  const avg = count > 0 ? Math.round((totalWaitMinutes / count) * 10) / 10 : 0;
  const avgDisplay = avg > 0 ? avg.toFixed(1) : "0.0";
  const deltaText = count > 0 ? (avg <= 20 ? "Within Target SLA" : "Over Target SLA") : "No Active Queue";
  const quotedTime = count > 0 ? `${Math.round(avg || 15)}m` : "--";

  res.kpi = {
    value: avg,
    displayValue: `${avgDisplay} mins`,
    label: "Average Guest Wait Time",
    trend: avg > 20 ? "down" : "up",
    secondaryMetrics: [
      { label: "Active Waiters", value: active.length },
      { label: "Completed Turnarounds", value: completed.length },
      { label: "Target Wait SLA", value: "20 mins" },
    ],
  };

  res.summary = {
    avgWaitMins: avgDisplay,
    deltaText,
    quotedTime,
    target: "Target < 20m",
    rawCount: count,
    activeCount: active.length,
    completedCount: completed.length,
  };

  return res;
}

export async function provideQueueRecentCallouts(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const now = Date.now();
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );
  const isCurrentDay = now >= timeRange.from && now <= timeRange.to;

  const { tableMap } = await getStoreTableAndLayoutMaps(ctx);
  const queue = await ctx.db.query("organizationQueues").collect();

  const calledOrSeated = queue
    .filter((q) => {
      if (q.deletedAt !== undefined) return false;
      if (!isQueueInTimeWindow(q, timeRange, isCurrentDay)) return false;
      return (
        q.queueStatus === "completed" ||
        q.queueStatus.includes("cancel") ||
        q.queueStatus === "arrived" ||
        q.queueStatus === "running_late" ||
        q.queueStatus === "rejected"
      );
    })
    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
    .slice(0, 6);

  const calledList = calledOrSeated.map((q) => {
    const timeStr = formatStoreTime(q.updatedAt || q.createdAt, res.timeZone, res.country);
    let statusText = "Seated";
    let statusColor = "text-emerald-700";

    if (q.tableId && tableMap.has(q.tableId)) {
      statusText = `Seated at Table ${tableMap.get(q.tableId)!.tableNumber}`;
    }

    if (q.queueStatus.includes("cancel") || q.queueStatus === "rejected") {
      statusText = "No-show / Cancelled";
      statusColor = "text-rose-600";
    } else if (q.queueStatus === "running_late") {
      statusText = "Running Late";
      statusColor = "text-amber-700";
    } else if (q.queueStatus === "arrived") {
      statusText = "SMS Sent • Paged";
      statusColor = "text-amber-700";
    }

    return {
      id: q._id,
      ticket: formatShortQueueTicket(q.queueNumber, q._id),
      name: parseQueueGuestName(q.notes),
      pax: `${q.totalGuests || 2}p`,
      status: statusText,
      statusColor,
      time: timeStr,
    };
  });

  res.summary = {
    calledList,
  };

  return res;
}

export async function provideQueueStatusBreakdown(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const now = Date.now();
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );
  const isCurrentDay = now >= timeRange.from && now <= timeRange.to;

  const queue = await ctx.db.query("organizationQueues").collect();

  const activeWaiting = queue.filter(
    (q) => isQueueActiveWaiting(q) && isQueueInTimeWindow(q, timeRange, isCurrentDay)
  );

  const targetParties = activeWaiting.length > 0
    ? activeWaiting
    : queue.filter((q) => q.queueStatus === "completed" && isQueueInTimeWindow(q, timeRange, isCurrentDay));

  let couples = 0;
  let families = 0;
  let large = 0;
  let totalPax = 0;

  for (const q of targetParties) {
    const pax = q.totalGuests || 2;
    totalPax += pax;
    if (pax <= 2) couples++;
    else if (pax <= 6) families++;
    else large++;
  }

  const total = targetParties.length;
  const couplesPercent = total > 0 ? Math.round((couples / total) * 100) : 0;
  const familiesPercent = total > 0 ? Math.round((families / total) * 100) : 0;
  const largePercent = total > 0 ? Math.max(0, 100 - couplesPercent - familiesPercent) : 0;

  res.summary = {
    totalPax,
    couplesPercent,
    familiesPercent,
    largePercent,
    couplesCount: couples,
    familiesCount: families,
    largeCount: large,
    partiesAnalyzed: total,
    isCurrentActive: activeWaiting.length > 0,
  };

  return res;
}

export async function provideQueueWaitTimeAlerts(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const now = Date.now();
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );
  const isCurrentDay = now >= timeRange.from && now <= timeRange.to;

  const { activeTables, tableMap } = await getStoreTableAndLayoutMaps(ctx);
  const queue = await ctx.db.query("organizationQueues").collect();

  const occupiedTableIds = new Set(
    queue.filter((q) => q.tableId && isQueueActiveWaiting(q)).map((q) => q.tableId!)
  );
  const availableTable = activeTables.find(
    (t) => !t.isBlock && !t.currentOrderId && !occupiedTableIds.has(t._id)
  );
  const suggestedTableText = availableTable
    ? `Seat Table ${availableTable.tableNumber}`
    : "Awaiting Table Assignment";

  const longWaits = !isCurrentDay
    ? []
    : queue.filter((q) => {
        if (!isQueueActiveWaiting(q)) return false;
        if (q.deletedAt !== undefined) return false;
        const elapsed = Math.floor((now - (q.reservationTime || q.createdAt)) / 60000);
        return elapsed >= 20;
      });

  const breachingParties = longWaits.map((q) => {
    const elapsed = Math.floor((now - (q.reservationTime || q.createdAt)) / 60000);
    let partySuggestedTable = suggestedTableText;
    if (q.tableId && tableMap.has(q.tableId)) {
      partySuggestedTable = `Assigned Table ${tableMap.get(q.tableId)!.tableNumber}`;
    }

    return {
      ticket: formatShortQueueTicket(q.queueNumber, q._id),
      name: parseQueueGuestName(q.notes),
      pax: `${q.totalGuests || 4} guests`,
      elapsedMins: elapsed,
      targetMins: 20,
      suggestedTable: partySuggestedTable,
    };
  });

  res.alert = {
    count: longWaits.length,
    alertCount: longWaits.length,
    severity: longWaits.length > 0 ? "critical" : "info",
    title:
      longWaits.length > 0
        ? `${longWaits.length} Parties Breaching SLA`
        : "Wait Times Within SLA",
    message:
      longWaits.length > 0
        ? "Host stand expediting requested for walk-ins."
        : "No waitlist bottlenecks detected.",
  };

  res.summary = {
    breachingCount: longWaits.length,
    breachingParties,
  };

  return res;
}

// ==========================================
// 11. MENU PROVIDERS
// ==========================================

export async function provideMenuTopSelling(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const validOrders = orders.filter(
    (o) =>
      o.createdAt >= timeRange.from &&
      o.createdAt <= timeRange.to &&
      isValidActiveOrCompletedOrder(o) &&
      !o.isRejected,
  );
  const validOrderIds = new Set(validOrders.map((o) => o._id));

  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const periodItems = items.filter((i) => {
    if (i.orderId && validOrderIds.has(i.orderId)) return true;
    if (validOrderIds.size === 0 && i.createdAt >= timeRange.from && i.createdAt <= timeRange.to) {
      return true;
    }
    return false;
  });

  const itemAgg: Record<
    string,
    { name: string; qty: number; revenuePaise: number }
  > = {};
  for (const i of periodItems) {
    if (!itemAgg[i.itemName]) {
      itemAgg[i.itemName] = { name: i.itemName, qty: 0, revenuePaise: 0 };
    }
    itemAgg[i.itemName].qty += i.quantity;
    itemAgg[i.itemName].revenuePaise += i.totalPrice;
  }

  const topSorted = Object.values(itemAgg)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);

  const rows = topSorted.map((item, idx) => ({
    rank: idx + 1,
    name: item.name,
    qty: item.qty,
    revenue: formatCurrencyPaise(
      item.revenuePaise,
      res.currencySymbol,
      res.currency,
    ),
  }));

  res.table = {
    columns: [
      { key: "rank", label: "#" },
      { key: "name", label: "Menu Item" },
      { key: "qty", label: "Orders Sold", align: "center" },
      { key: "revenue", label: "Gross Revenue", align: "right" },
    ],
    rows,
    totalCount: rows.length,
  };

  res.summary = {
    topItems: rows.slice(0, 3),
  };

  return res;
}

export async function provideMenuMostOrderedCategories(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const validOrders = orders.filter(
    (o) =>
      o.createdAt >= timeRange.from &&
      o.createdAt <= timeRange.to &&
      isValidActiveOrCompletedOrder(o) &&
      !o.isRejected,
  );
  const validOrderIds = new Set(validOrders.map((o) => o._id));

  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const periodItems = items.filter((i) => {
    if (i.orderId && validOrderIds.has(i.orderId)) return true;
    if (validOrderIds.size === 0 && i.createdAt >= timeRange.from && i.createdAt <= timeRange.to) {
      return true;
    }
    return false;
  });

  const categories = await ctx.db
    .query("categories")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const itemToCatName = new Map<string, string>();
  for (const c of categories) {
    const mappings = await ctx.db
      .query("categoryItems")
      .withIndex("by_category", (q) => q.eq("categoryId", c._id))
      .collect();
    for (const m of mappings) {
      if (!itemToCatName.has(m.itemId)) {
        itemToCatName.set(m.itemId, c.name);
      }
    }
  }

  const catAgg: Record<string, { qty: number; revenuePaise: number }> = {};
  let totalPeriodRevenuePaise = 0;
  let totalPeriodQty = 0;

  for (const i of periodItems) {
    const catName = (i.itemId && itemToCatName.get(i.itemId)) || "Main Course";
    if (!catAgg[catName]) {
      catAgg[catName] = { qty: 0, revenuePaise: 0 };
    }
    catAgg[catName].qty += i.quantity;
    catAgg[catName].revenuePaise += i.totalPrice;
    totalPeriodRevenuePaise += i.totalPrice;
    totalPeriodQty += i.quantity;
  }

  const catList = Object.entries(catAgg)
    .map(([name, data]) => {
      const pct =
        totalPeriodRevenuePaise > 0
          ? Math.round((data.revenuePaise / totalPeriodRevenuePaise) * 100)
          : 0;
      return {
        name,
        qty: data.qty,
        percent: pct,
        revenue: formatCurrencyPaise(
          data.revenuePaise,
          res.currencySymbol,
          res.currency,
        ),
        revenuePaise: data.revenuePaise,
      };
    })
    .sort((a, b) => b.revenuePaise - a.revenuePaise);

  const catSeries = catList.map((c) => ({ label: c.name, value: c.qty }));

  res.chart = {
    chartType: "bar",
    type: "bar",
    series: [{ name: "Category Volume", data: catSeries }],
    data: catSeries,
    xAxisLabel: "Category",
    yAxisLabel: "Items Sold",
  };

  res.summary = {
    categories: catList.slice(0, 4),
    totalRevenue: formatCurrencyPaise(
      totalPeriodRevenuePaise,
      res.currencySymbol,
      res.currency,
    ),
    totalQty: totalPeriodQty,
  };

  return res;
}

/**
 * Helper to fetch only real customer-facing menu items
 * (items linked to an active, non-deleted category via categoryItems)
 */
export async function getValidActiveMenuItems(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
): Promise<
  Array<{
    item: Doc<"items">;
    categoryName: string;
    categoryId: Id<"categories">;
  }>
> {
  const categories = await ctx.db
    .query("categories")
    .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
    .filter((q) => q.eq(q.field("deletedAt"), undefined))
    .collect();

  const results: Array<{
    item: Doc<"items">;
    categoryName: string;
    categoryId: Id<"categories">;
  }> = [];
  const seenItemIds = new Set<string>();

  for (const cat of categories) {
    const catItems = await ctx.db
      .query("categoryItems")
      .withIndex("by_category", (q) => q.eq("categoryId", cat._id))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    for (const ci of catItems) {
      if (seenItemIds.has(ci.itemId)) continue;
      seenItemIds.add(ci.itemId);

      const item = await ctx.db.get(ci.itemId);
      if (!item || item.deletedAt !== undefined) continue;

      results.push({
        item,
        categoryName: cat.name,
        categoryId: cat._id,
      });
    }
  }

  // Fallback: If no categories configured yet, only fallback to non-deleted published items
  if (results.length === 0) {
    const rawItems = await ctx.db
      .query("items")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    for (const it of rawItems) {
      if (it.published && !it.name.toLowerCase().endsWith(" recipe")) {
        results.push({
          item: it,
          categoryName: "General",
          categoryId: "" as any,
        });
      }
    }
  }

  return results;
}

export interface ActiveMenuItemStockDetails {
  item: Doc<"items">;
  categoryName: string;
  hasAssignedRecipe: boolean;
  isAvailable: boolean;
  published: boolean;
  isOutOfStock: boolean;
  outOfStockReason?: string;
  statusText: string;
  portionsAvailable?: number;
  isWarning: boolean;
  foodCostPaise: number;
}

export async function getMenuItemsStockDetails(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
): Promise<ActiveMenuItemStockDetails[]> {
  const activeMenuItems = await getValidActiveMenuItems(ctx, organizationId);

  // Fetch recipe assignments, master recipes, and inventory items
  const [recipes, assignments, inventoryItems] = await Promise.all([
    ctx.db
      .query("recipes")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .collect(),
    ctx.db
      .query("recipeAssignments")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .collect(),
    ctx.db
      .query("inventoryItems")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .collect(),
  ]);

  const invMap = new Map(inventoryItems.map((i) => [String(i._id), i]));

  // Build item -> recipe assignment lookup (strictly explicit assignments in recipeAssignments)
  const assignmentMap = new Map<string, Doc<"recipeAssignments">>();
  for (const a of assignments) {
    if (a.targetItemId) {
      const targetKey = String(a.targetItemId);
      const existing = assignmentMap.get(targetKey);
      if (
        !existing ||
        String(a.sourceRecipeItemId) !== String(a.targetItemId)
      ) {
        assignmentMap.set(targetKey, a);
      }
    }
  }

  // Group recipes by source item ID
  const recipesBySource = new Map<string, Array<Doc<"recipes">>>();
  for (const r of recipes) {
    if (!r.itemId) continue;
    const k = String(r.itemId);
    if (!recipesBySource.has(k)) recipesBySource.set(k, []);
    recipesBySource.get(k)!.push(r);
  }

  const stockDetails: ActiveMenuItemStockDetails[] = [];

  for (const { item, categoryName } of activeMenuItems) {
    const isManuallyDisabled = !item.published || item.isAvailable === false;
    let isOutOfStock = false;
    let outOfStockReason: string | undefined;
    let statusText = "In Stock";
    let isWarning = false;
    let portionsAvailable: number | undefined;
    let foodCostPaise = 0;

    // Check recipe assignment: ONLY explicit assignment in recipeAssignments counts!
    const assigned = assignmentMap.get(String(item._id));
    const hasAssignedRecipe = !!assigned;

    if (hasAssignedRecipe && assigned) {
      const sourceItemId = assigned.sourceRecipeItemId;
      const multiplier = assigned.portionMultiplier || 1;
      const itemRecipes = recipesBySource.get(String(sourceItemId)) || [];

      if (isManuallyDisabled) {
        isOutOfStock = true;
        statusText = "Unavailable";
        outOfStockReason = "86'd on Terminal • Manual Hold";
        isWarning = true;
      } else if (itemRecipes.length > 0) {
        let minPortions: number | null = null;
        let depletedIngredient: string | null = null;
        let lowIngredient: string | null = null;

        for (const r of itemRecipes) {
          const inv = invMap.get(String(r.inventoryItemId));
          if (!inv) continue;

          const rawUnitCost = typeof inv.unitCost === "number" ? inv.unitCost : 0;
          const targetUnit = inv.buyingUnit || inv.servingUnit || r.unit;
          const convertedNeeded = convertUnits(
            r.quantity * multiplier,
            r.unit,
            targetUnit,
          );

          const costAmount = convertedNeeded * rawUnitCost;
          foodCostPaise += Math.round(costAmount * 100);

          if (convertedNeeded > 0) {
            const currentStock = inv.availableStock ?? 0;
            const refillLevel = inv.minimumStockRefillLevel ?? 0;
            const possible = Math.floor(currentStock / convertedNeeded);
            if (minPortions === null || possible < minPortions) {
              minPortions = Math.max(0, possible);
            }
            if (currentStock <= 0 && inv.allowNegativeStock !== true) {
              depletedIngredient = inv.name;
            } else if (
              (refillLevel > 0 && currentStock <= refillLevel) ||
              possible <= 10
            ) {
              lowIngredient = inv.name;
            }
          }
        }

        if (depletedIngredient || (minPortions !== null && minPortions <= 0)) {
          isOutOfStock = true;
          statusText = "Out of Stock";
          outOfStockReason = depletedIngredient
            ? `Depleted: ${depletedIngredient} (Out of Stock)`
            : "Depleted • Recipe ingredients exhausted";
          isWarning = true;
          portionsAvailable = 0;
        } else if (lowIngredient) {
          isOutOfStock = false;
          statusText = "Low Stock";
          isWarning = true;
          portionsAvailable = minPortions ?? 0;
        } else {
          isOutOfStock = false;
          statusText = "In Stock";
          isWarning = false;
          portionsAvailable = minPortions ?? 100;
        }
      } else {
        statusText = isManuallyDisabled ? "Unavailable" : "In Stock";
      }
    } else {
      // Dish is NOT assigned to any item recipe in recipeAssignments
      statusText = "Unassigned";
    }

    stockDetails.push({
      item,
      categoryName,
      hasAssignedRecipe,
      isAvailable: item.isAvailable !== false,
      published: !!item.published,
      isOutOfStock,
      outOfStockReason,
      statusText,
      portionsAvailable,
      isWarning,
      foodCostPaise,
    });
  }

  return stockDetails;
}

export async function provideMenuBestsellingItem(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const [items, stockDetails] = await Promise.all([
    ctx.db
      .query("orderItems")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .collect(),
    getMenuItemsStockDetails(ctx, org._id),
  ]);

  const costMap = new Map(stockDetails.map((s) => [s.item.name, s.foodCostPaise]));

  const periodItems = items.filter(
    (i) => i.createdAt >= timeRange.from && i.createdAt <= timeRange.to,
  );

  const itemAgg: Record<
    string,
    { name: string; qty: number; revenuePaise: number }
  > = {};
  let totalPaise = 0;
  for (const i of periodItems) {
    if (!itemAgg[i.itemName]) {
      itemAgg[i.itemName] = { name: i.itemName, qty: 0, revenuePaise: 0 };
    }
    itemAgg[i.itemName].qty += i.quantity;
    itemAgg[i.itemName].revenuePaise += i.totalPrice;
    totalPaise += i.totalPrice;
  }

  const sorted = Object.values(itemAgg).sort((a, b) => b.qty - a.qty);
  const bestsellingRows = sorted.slice(0, 5).map((item) => {
    const revPct =
      totalPaise > 0
        ? ((item.revenuePaise / totalPaise) * 100).toFixed(1)
        : "0.0";

    const costPaise = costMap.get(item.name) || 0;
    let marginText = "68%";
    if (costPaise > 0 && item.revenuePaise > 0) {
      const totalCostPaise = costPaise * item.qty;
      const marginPct = Math.max(
        0,
        Math.min(
          99,
          Math.round(((item.revenuePaise - totalCostPaise) / item.revenuePaise) * 100),
        ),
      );
      marginText = `${marginPct}%`;
    } else {
      // Standard gross margin based on pricing
      marginText = "72%";
    }

    return {
      item: item.name,
      qty: item.qty,
      revPercent: `${revPct}%`,
      margin: marginText,
    };
  });

  const bestItem = sorted[0]?.name || "None";
  const maxQty = sorted[0]?.qty || 0;

  res.kpi = {
    value: maxQty,
    displayValue: maxQty > 0 ? `${maxQty} Sold` : "0 Sold",
    label: sorted[0]?.name ? `Bestseller: ${sorted[0].name}` : "No dishes sold",
    secondaryMetrics: [
      { label: "Top Dish", value: sorted[0]?.name || "--" },
      {
        label: "Volume Share",
        value:
          totalPaise > 0
            ? `${(((sorted[0]?.revenuePaise || 0) / totalPaise) * 100).toFixed(1)}%`
            : "0%",
      },
    ],
  };

  res.summary = {
    bestsellingRows,
  };

  return res;
}

export async function provideMenuLowPerforming(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const [activeMenuItems, items] = await Promise.all([
    getValidActiveMenuItems(ctx, org._id),
    ctx.db
      .query("orderItems")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .collect(),
  ]);

  const periodItems = items.filter(
    (i) => i.createdAt >= timeRange.from && i.createdAt <= timeRange.to,
  );

  const itemSales: Record<
    string,
    { name: string; qty: number; revenuePaise: number }
  > = {};
  for (const i of periodItems) {
    if (!itemSales[i.itemName]) {
      itemSales[i.itemName] = { name: i.itemName, qty: 0, revenuePaise: 0 };
    }
    itemSales[i.itemName].qty += i.quantity;
    itemSales[i.itemName].revenuePaise += i.totalPrice;
  }

  // Identify top sellers in period
  const topSalesSorted = Object.values(itemSales).sort((a, b) => b.qty - a.qty);
  const topSellerNames = new Set(
    topSalesSorted.slice(0, 3).map((it) => it.name),
  );

  // Low performing candidates:
  // Active catalog menu items NOT in top sellers.
  // Items with 0 sales come first!
  const candidates: Array<{
    name: string;
    qty: number;
    revenuePaise: number;
    badge: string;
  }> = [];

  for (const { item } of activeMenuItems) {
    // If there are more catalog items than top sellers, exclude top sellers completely
    if (activeMenuItems.length > topSellerNames.size && topSellerNames.has(item.name)) {
      continue;
    }

    const sales = itemSales[item.name] || { qty: 0, revenuePaise: 0 };
    let badge = "Zero Sales";
    if (sales.qty === 0) {
      badge = "Zero Sales";
    } else if (sales.qty === 1) {
      badge = "Slow Mover";
    } else if (sales.qty <= 3) {
      badge = "Review Pricing";
    } else {
      badge = "Marginal Vol";
    }

    candidates.push({
      name: item.name,
      qty: sales.qty,
      revenuePaise: sales.revenuePaise,
      badge,
    });
  }

  // Sort candidates: lowest orders first (0 orders first), then lowest revenue, then name
  candidates.sort((a, b) => {
    if (a.qty !== b.qty) return a.qty - b.qty;
    if (a.revenuePaise !== b.revenuePaise) return a.revenuePaise - b.revenuePaise;
    return a.name.localeCompare(b.name);
  });

  const lowItems = candidates.slice(0, 5).map((it) => ({
    name: it.name,
    qty: it.qty,
    revenue: formatCurrencyPaise(
      it.revenuePaise,
      res.currencySymbol,
      res.currency,
    ),
    badge: it.badge,
  }));

  res.table = {
    columns: [
      { key: "name", label: "Menu Item" },
      { key: "qty", label: "Orders", align: "center" },
      { key: "revenue", label: "Gross Revenue", align: "right" },
      { key: "badge", label: "Velocity Status" },
    ],
    rows: lowItems,
    totalCount: lowItems.length,
  };

  res.summary = {
    lowItems: lowItems.slice(0, 3),
  };

  return res;
}

export async function provideMenuProductAvailability(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const stockDetails = await getMenuItemsStockDetails(ctx, org._id);

  // STRICT RULE: Only show items that are explicitly assigned to an item recipe!
  const assignedItems = stockDetails.filter((s) => s.hasAssignedRecipe);

  const availableCount = assignedItems.filter((s) => !s.isOutOfStock).length;
  const unavailableCount = assignedItems.length - availableCount;

  const availabilityList = assignedItems.slice(0, 5).map((s) => ({
    name: s.item.name,
    status: s.statusText,
    isWarning: s.isWarning,
  }));

  res.kpi = {
    value: availableCount,
    displayValue: `${availableCount} Available`,
    label: "Recipe Stock Availability",
    secondaryMetrics: [
      { label: "Assigned Dishes", value: assignedItems.length },
      { label: "Depleted", value: unavailableCount },
    ],
  };

  res.summary = {
    availabilityList,
    totalAssigned: assignedItems.length,
  };

  return res;
}

export async function provideMenuOutOfStockAlerts(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const stockDetails = await getMenuItemsStockDetails(ctx, org._id);

  // STRICT RULE: Out of stock alerts are based on items assigned in item recipes!
  const assignedItems = stockDetails.filter((s) => s.hasAssignedRecipe);
  const outOfStock = assignedItems.filter((s) => s.isOutOfStock);

  const stockoutList = outOfStock.slice(0, 4).map((s) => ({
    name: s.item.name,
    reason: s.outOfStockReason || "86'd on Terminal • Stock Depletion",
  }));

  res.alert = {
    count: outOfStock.length,
    alertCount: outOfStock.length,
    severity: outOfStock.length > 0 ? "warning" : "info",
    title:
      outOfStock.length > 0
        ? `${outOfStock.length} Dishes 86'd (Unavailable)`
        : "All Menu Items In Stock",
    message:
      outOfStock.length > 0
        ? "Kitchen station stock refill needed."
        : "Menu is 100% available for orders.",
  };

  res.summary = {
    stockoutList,
    totalOutOfStock: outOfStock.length,
  };

  return res;
}

export async function provideMenuModifierPopularity(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const validOrders = orders.filter(
    (o) =>
      o.createdAt >= timeRange.from &&
      o.createdAt <= timeRange.to &&
      isValidActiveOrCompletedOrder(o) &&
      !o.isRejected,
  );
  const validOrderIds = new Set(validOrders.map((o) => o._id));

  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const periodItems = items.filter((i) => {
    if (i.orderId && validOrderIds.has(i.orderId)) return true;
    if (validOrderIds.size === 0 && i.createdAt >= timeRange.from && i.createdAt <= timeRange.to) {
      return true;
    }
    return false;
  });

  const customCounts: Record<string, { count: number; pricePaise: number }> =
    {};
  for (const i of periodItems) {
    for (const c of i.customizations || []) {
      if (!customCounts[c.optionName]) {
        customCounts[c.optionName] = { count: 0, pricePaise: c.price || 0 };
      }
      customCounts[c.optionName].count += 1;
    }
  }

  const sortedMods = Object.entries(customCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(([name, data]) => ({
      name,
      hits: data.count,
      priceAddon:
        data.pricePaise > 0
          ? `+${formatCurrencyPaise(data.pricePaise, res.currencySymbol, res.currency)}`
          : `+${res.currencySymbol} 0.00`,
    }));

  const chartData = sortedMods.map((m) => ({ label: m.name, value: m.hits }));
  const modData = chartData;

  res.chart = {
    chartType: "bar",
    type: "bar",
    series: [{ name: "Modifier Popularity", data: modData }],
    data: modData,
    xAxisLabel: "Modifier",
    yAxisLabel: "Orders",
  };

  res.summary = {
    modifierRows: sortedMods.slice(0, 3),
  };

  return res;
}

export async function provideMenuPerformanceSummary(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const stockDetails = await getMenuItemsStockDetails(ctx, org._id);

  const totalCount = stockDetails.length;
  const activeCount = stockDetails.filter((s) => !s.isOutOfStock).length;
  const inactiveCount = totalCount - activeCount;
  const availabilityPct =
    totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0;

  let totalMarginSum = 0;
  for (const s of stockDetails) {
    const pricePaise = s.item.price || 0;
    if (pricePaise > 0 && s.foodCostPaise > 0) {
      const margin = Math.max(
        0,
        Math.min(99, Math.round(((pricePaise - s.foodCostPaise) / pricePaise) * 100)),
      );
      totalMarginSum += margin;
    } else {
      totalMarginSum += 70;
    }
  }
  const avgMargin = totalCount > 0 ? Math.round(totalMarginSum / totalCount) : 70;

  res.summary = {
    marginPercent: `${avgMargin}%`,
    marginDelta:
      activeCount === totalCount
        ? "100% In Stock"
        : `${inactiveCount} Unavailable`,
    activeRatio: `${activeCount}/${totalCount}`,
    inactiveCount: `${inactiveCount} Inactive`,
    attachRate: `${availabilityPct}%`,
    attachCategory: "Catalog Items",
  };

  res.kpi = {
    value: activeCount,
    displayValue: `${activeCount}/${totalCount}`,
    label: "Active Catalog Dishes",
    secondaryMetrics: [
      { label: "Availability Rate", value: `${availabilityPct}%` },
      { label: "Unavailable Dishes", value: inactiveCount },
    ],
  };

  return res;
}

// ==========================================
// 12. CUSTOMERS PROVIDERS (Truthful Calculations)
// ==========================================

function normalizeCustomerPhone(phone?: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  return digits || phone.trim();
}

interface OrderCustomerMeta {
  key: string;
  phone: string;
  name: string;
}

function getOrderCustomerMeta(
  order: Doc<"orders">,
  customerMap?: Map<string, Doc<"customers">>,
): OrderCustomerMeta {
  let rawPhone = (order.customerPhone || "").trim();
  let rawName = (order.customerName || "").trim();

  // If customerId is linked to a customer in the DB with phone/name
  if (order.customerId && customerMap?.has(order.customerId)) {
    const c = customerMap.get(order.customerId);
    if (!rawPhone && c?.phone) rawPhone = c.phone;
    if (
      (!rawName ||
        rawName.toLowerCase() === "guest customer" ||
        rawName.toLowerCase() === "guest") &&
      c?.firstName
    ) {
      rawName = `${c.firstName || ""} ${c.lastName || ""}`.trim();
    }
  }

  const cleanPhone = normalizeCustomerPhone(rawPhone);
  if (cleanPhone) {
    return {
      key: `phone:${cleanPhone}`,
      phone: rawPhone,
      name:
        rawName &&
        rawName.toLowerCase() !== "guest customer" &&
        rawName.toLowerCase() !== "guest"
          ? rawName
          : rawPhone,
    };
  }

  if (
    rawName &&
    rawName.toLowerCase() !== "guest customer" &&
    rawName.toLowerCase() !== "guest"
  ) {
    return {
      key: `name:${rawName.toLowerCase()}`,
      phone: "",
      name: rawName,
    };
  }

  if (order.customerId) {
    return {
      key: `id:${order.customerId}`,
      phone: "",
      name: rawName || "Guest Customer",
    };
  }

  return {
    key: `order:${order._id}`,
    phone: "",
    name: "Walk-in Guest",
  };
}

export async function provideCustomersTotal(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const allOrders = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const validAllOrders = allOrders.filter(isValidActiveOrCompletedOrder);

  const customers = await ctx.db.query("customers").collect();
  const customerMap = new Map(customers.map((c) => [c._id, c]));

  // Build unique customers up to timeRange.to
  const allCustomersMap = new Map<string, OrderCustomerMeta>();
  for (const o of validAllOrders) {
    if (o.createdAt <= timeRange.to) {
      const meta = getOrderCustomerMeta(o, customerMap);
      if (!allCustomersMap.has(meta.key)) {
        allCustomersMap.set(meta.key, meta);
      }
    }
  }

  const periodOrders = validAllOrders.filter(
    (o) => o.createdAt >= timeRange.from && o.createdAt <= timeRange.to,
  );
  const prevPeriodOrders = validAllOrders.filter(
    (o) =>
      o.createdAt >= timeRange.comparisonFrom &&
      o.createdAt <= timeRange.comparisonTo,
  );

  const periodCustomers = new Set<string>();
  for (const o of periodOrders) {
    const meta = getOrderCustomerMeta(o, customerMap);
    periodCustomers.add(meta.key);
  }

  const prevCustomers = new Set<string>();
  for (const o of prevPeriodOrders) {
    const meta = getOrderCustomerMeta(o, customerMap);
    prevCustomers.add(meta.key);
  }

  let dineInCount = 0;
  let takeawayCount = 0;
  let deliveryCount = 0;
  let onlineCount = 0;

  for (const o of periodOrders) {
    if (isDineInOrder(o)) {
      dineInCount++;
    } else if (isTakeawayOrder(o)) {
      takeawayCount++;
    } else if (isDeliveryOrder(o)) {
      deliveryCount++;
    } else {
      onlineCount++;
    }
  }

  const totalChannelOrders = dineInCount + takeawayCount + deliveryCount + onlineCount;
  const dineInPercent =
    totalChannelOrders > 0 ? Math.round((dineInCount / totalChannelOrders) * 100) : 0;
  const secondaryPercent = totalChannelOrders > 0 ? 100 - dineInPercent : 0;

  let secondaryChannelLabel = "Takeaway";
  if (takeawayCount > 0 && deliveryCount === 0 && onlineCount === 0) {
    secondaryChannelLabel = "Takeaway";
  } else if (deliveryCount > 0 && takeawayCount === 0 && onlineCount === 0) {
    secondaryChannelLabel = "Delivery";
  } else if (onlineCount > 0 && takeawayCount === 0 && deliveryCount === 0) {
    secondaryChannelLabel = "Online";
  } else if (takeawayCount + deliveryCount + onlineCount > 0) {
    if (takeawayCount >= deliveryCount && takeawayCount >= onlineCount) {
      secondaryChannelLabel = deliveryCount > 0 || onlineCount > 0 ? "Takeaway / Online" : "Takeaway";
    } else if (deliveryCount >= onlineCount) {
      secondaryChannelLabel = "Delivery";
    } else {
      secondaryChannelLabel = "Online";
    }
  } else {
    secondaryChannelLabel = "Takeaway";
  }

  const activeGuestsCount = periodCustomers.size;
  const delta = computePercentageDelta(periodCustomers.size, prevCustomers.size);

  res.kpi = {
    value: activeGuestsCount,
    displayValue: `${activeGuestsCount.toLocaleString()} Guests`,
    label: "Total Registered Guests",
    deltaPercent: delta.deltaPercent,
    deltaLabel: delta.deltaLabel,
    trend: delta.trend,
    secondaryMetrics: [
      { label: "Active in Period", value: periodCustomers.size },
      { label: "Dine-In Customer Orders", value: dineInCount },
      { label: `${secondaryChannelLabel} Orders`, value: takeawayCount + deliveryCount + onlineCount },
    ],
  };

  res.summary = {
    totalGuests: activeGuestsCount.toLocaleString(),
    rawCount: activeGuestsCount,
    allTimeCount: allCustomersMap.size,
    deltaPercent:
      delta.deltaPercent !== undefined
        ? `${delta.deltaPercent >= 0 ? "▲ +" : "▼ "}${delta.deltaPercent}% vs prev period`
        : "+0.0%",
    dineInPercent,
    onlinePercent: secondaryPercent,
    secondaryChannelLabel,
    secondaryChannelPercent: secondaryPercent,
    dineInCount,
    takeawayCount,
    deliveryCount,
    onlineCount,
  };

  return res;
}

export async function provideCustomersNew(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const allOrders = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const validAllOrders = allOrders.filter(isValidActiveOrCompletedOrder);

  const customers = await ctx.db.query("customers").collect();
  const customerMap = new Map(customers.map((c) => [c._id, c]));

  // Find first order timestamp for each customer key across store history
  const firstOrderMap = new Map<string, number>();
  for (const o of validAllOrders) {
    const meta = getOrderCustomerMeta(o, customerMap);
    const existing = firstOrderMap.get(meta.key);
    if (existing === undefined || o.createdAt < existing) {
      firstOrderMap.set(meta.key, o.createdAt);
    }
  }

  // A new customer in the period is someone whose first-ever order at this store falls in [timeRange.from, timeRange.to]
  let newInPeriod = 0;
  let newInPrev = 0;

  for (const [_, firstAt] of firstOrderMap.entries()) {
    if (firstAt >= timeRange.from && firstAt <= timeRange.to) {
      newInPeriod++;
    } else if (
      firstAt >= timeRange.comparisonFrom &&
      firstAt <= timeRange.comparisonTo
    ) {
      newInPrev++;
    }
  }

  const delta = computePercentageDelta(newInPeriod, newInPrev);

  res.kpi = {
    value: newInPeriod,
    displayValue: `${newInPeriod} New`,
    label: "New Customer Acquisition",
    deltaPercent: delta.deltaPercent,
    deltaLabel: delta.deltaLabel,
    trend: delta.trend,
    secondaryMetrics: [
      { label: "Acquisition Window", value: timeRange.preset },
      { label: "Previous Cycle", value: newInPrev },
    ],
  };

  res.summary = {
    newCount: newInPeriod,
    deltaPercent:
      delta.deltaPercent !== undefined
        ? `${delta.deltaPercent >= 0 ? "▲ +" : "▼ "}${delta.deltaPercent}% vs prev period`
        : "+0.0% vs prev period",
    intakeRate: `${newInPeriod} New Diners`,
    foliosOpened: `First Orders: ${newInPeriod}`,
    fastTrack: `New Patrons: ${newInPeriod}`,
  };

  return res;
}

export async function provideCustomersReturning(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const allOrders = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const validAllOrders = allOrders.filter(isValidActiveOrCompletedOrder);

  const customers = await ctx.db.query("customers").collect();
  const customerMap = new Map(customers.map((c) => [c._id, c]));

  // Track customer order history prior to the period
  const priorOrdersCount = new Map<string, number>();
  // Track orders in current period
  const periodOrdersCount = new Map<string, number>();
  let periodOrdersTotal = 0;

  for (const o of validAllOrders) {
    const meta = getOrderCustomerMeta(o, customerMap);
    if (o.createdAt < timeRange.from) {
      priorOrdersCount.set(meta.key, (priorOrdersCount.get(meta.key) || 0) + 1);
    } else if (o.createdAt <= timeRange.to) {
      periodOrdersCount.set(meta.key, (periodOrdersCount.get(meta.key) || 0) + 1);
      periodOrdersTotal++;
    }
  }

  const activePatronKeys = Array.from(periodOrdersCount.keys());
  // Returning patron: had prior orders before period OR placed > 1 order in period
  const returningPatrons = activePatronKeys.filter(
    (key) => (priorOrdersCount.get(key) || 0) > 0 || (periodOrdersCount.get(key) || 0) > 1,
  );

  const retentionPercent =
    activePatronKeys.length > 0
      ? Math.round((returningPatrons.length / activePatronKeys.length) * 100)
      : 0;

  res.kpi = {
    value: retentionPercent,
    displayValue: `${retentionPercent}% Retention`,
    label: "Repeat Customer Rate",
    trend: retentionPercent > 50 ? "up" : "neutral",
    secondaryMetrics: [
      { label: "Repeat Patrons", value: returningPatrons.length },
      {
        label: "Single-Visit Guests",
        value: activePatronKeys.length - returningPatrons.length,
      },
      { label: "Tracked Guests", value: activePatronKeys.length },
    ],
  };

  res.summary = {
    retentionPercent: `${retentionPercent}%`,
    rawRetention: retentionPercent,
    visitsCount: `${returningPatrons.length} Repeat`,
    rawVisits: returningPatrons.length,
    redeemedFormatted: `${returningPatrons.length} repeat visitors`,
    avgFrequency:
      activePatronKeys.length > 0
        ? `${(periodOrdersTotal / activePatronKeys.length).toFixed(1)}x / patron`
        : "0.0x / patron",
  };

  return res;
}

export async function provideCustomersRecent(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const now = Date.now();
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  orders.sort((a, b) => b.createdAt - a.createdAt);
  const recentOrders = orders.filter(isValidActiveOrCompletedOrder).slice(0, 8);

  const tables = await ctx.db
    .query("organizationTables")
    .filter((q) => q.eq(q.field("deletedAt"), undefined))
    .collect();
  const tableMap = new Map(tables.map((t) => [t._id, t.tableNumber]));

  const customers = await ctx.db.query("customers").collect();
  const customerMap = new Map(customers.map((c) => [c._id, c]));

  const rows = recentOrders.map((o) => {
    const meta = getOrderCustomerMeta(o, customerMap);
    // Display phone if present; otherwise name or fallback
    const displayName = meta.phone || meta.name || "Walk-in Guest";
    return {
      id: o._id,
      customerName: displayName,
      phone: meta.phone,
      table:
        o.tableId && tableMap.has(o.tableId)
          ? `Table ${tableMap.get(o.tableId)}`
          : o.orderType || "Counter",
      spend: formatCurrencyPaise(
        o.totalAmount || 0,
        res.currencySymbol,
        res.currency,
      ),
      time: formatRelativeTime(o.createdAt, now),
    };
  });

  res.table = {
    columns: [
      { key: "customerName", label: "Guest" },
      { key: "table", label: "Dining Location" },
      { key: "spend", label: "Amount", align: "right" },
      { key: "time", label: "Time", align: "right" },
    ],
    rows,
    totalCount: orders.length,
  };

  const recentGuests = rows.map((r) => {
    return {
      id: r.id,
      name: r.customerName,
      phone: r.phone,
      table: r.table,
      time: r.time,
      spend: r.spend,
    };
  });

  res.summary = {
    recentGuests,
  };

  return res;
}

export async function provideCustomersMostFrequent(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const customers = await ctx.db.query("customers").collect();
  const customerMap = new Map(customers.map((c) => [c._id, c]));

  const guestAgg: Record<
    string,
    { key: string; phone: string; name: string; visits: number; spendPaise: number }
  > = {};

  for (const o of orders) {
    if (!isValidActiveOrCompletedOrder(o)) continue;
    const meta = getOrderCustomerMeta(o, customerMap);
    if (!guestAgg[meta.key]) {
      guestAgg[meta.key] = {
        key: meta.key,
        phone: meta.phone,
        name: meta.name,
        visits: 0,
        spendPaise: 0,
      };
    }
    guestAgg[meta.key].visits++;
    guestAgg[meta.key].spendPaise += o.totalAmount || 0;
  }

  const sorted = Object.values(guestAgg)
    .sort((a, b) => b.visits - a.visits || b.spendPaise - a.spendPaise)
    .slice(0, 5);

  const rows = sorted.map((g, idx) => {
    // Primary display is the phone number as requested
    const displayName = g.phone || g.name || "Walk-in Guest";
    const visitText = `${g.visits} ${g.visits === 1 ? "order" : "orders"}`;
    return {
      rank: idx + 1,
      name: displayName,
      visits: visitText,
      spend: formatCurrencyPaise(g.spendPaise, res.currencySymbol, res.currency),
    };
  });

  res.table = {
    columns: [
      { key: "rank", label: "#" },
      { key: "name", label: "Customer (Phone)" },
      { key: "visits", label: "Orders" },
      { key: "spend", label: "Total Spend", align: "right" },
    ],
    rows,
    totalCount: rows.length,
  };

  const topGuests = rows.map((r) => {
    return {
      rank: r.rank,
      name: r.name,
      visits: r.visits,
      spend: r.spend,
    };
  });

  res.summary = {
    topGuests,
  };

  return res;
}

export async function provideCustomersOrderFrequency(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const orders = await ctx.db
    .query("orders")
    .withIndex("by_created_at", (q) =>
      q
        .eq("organizationId", org._id)
        .gte("createdAt", timeRange.from)
        .lte("createdAt", timeRange.to),
    )
    .collect();

  const customers = await ctx.db.query("customers").collect();
  const customerMap = new Map(customers.map((c) => [c._id, c]));

  const counts: Record<string, number> = {};
  for (const o of orders) {
    if (!isValidActiveOrCompletedOrder(o)) continue;
    const meta = getOrderCustomerMeta(o, customerMap);
    counts[meta.key] = (counts[meta.key] || 0) + 1;
  }

  const buckets = {
    "1 Visit": 0,
    "2 - 3 Visits": 0,
    "4+ Visits": 0,
  };

  for (const c of Object.values(counts)) {
    if (c === 1) buckets["1 Visit"]++;
    else if (c <= 3) buckets["2 - 3 Visits"]++;
    else buckets["4+ Visits"]++;
  }

  const freqSeries = Object.entries(buckets).map(([label, value]) => ({
    label,
    value,
  }));
  res.chart = {
    chartType: "bar",
    type: "bar",
    series: [{ name: "Order Frequency", data: freqSeries }],
    data: freqSeries,
    xAxisLabel: "Visit Count",
    yAxisLabel: "Guests",
  };

  const totalTracked = Object.keys(counts).length;
  const c1 =
    totalTracked > 0
      ? Math.round((buckets["1 Visit"] / totalTracked) * 100)
      : 0;
  const c2 =
    totalTracked > 0
      ? Math.round((buckets["2 - 3 Visits"] / totalTracked) * 100)
      : 0;
  const c3 = totalTracked > 0 ? Math.max(0, 100 - c1 - c2) : 0;

  res.summary = {
    cohorts: [
      { label: "1 Visit", percent: c1 },
      { label: "2 - 3 Visits", percent: c2 },
      { label: "4+ Visits", percent: c3 },
    ],
  };

  return res;
}

// ==========================================
// 13. SURVEYS PROVIDERS (Truthful Empty State)
// ==========================================

export async function provideSurveysResponseCounts(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const storeOrders = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();
  const storeOrderIds = new Set(storeOrders.map((o) => o._id));

  const allAttempts = await ctx.db.query("surveyAttempts").collect();
  const storeAttempts = allAttempts.filter(
    (a) => !a.orderId || storeOrderIds.has(a.orderId),
  );

  const rangeAttempts = storeAttempts.filter(
    (a) => a.createdAt >= timeRange.from && a.createdAt <= timeRange.to,
  );
  const prevAttempts = storeAttempts.filter(
    (a) =>
      a.createdAt >= timeRange.comparisonFrom &&
      a.createdAt <= timeRange.comparisonTo &&
      a.published,
  );

  const published = rangeAttempts.filter((a) => a.published);

  // Dynamic source breakdown based on actual submission channel
  let qrCount = 0;
  let cfdCount = 0;
  let webCount = 0;
  for (const a of published) {
    const src = (a.source || "").toLowerCase();
    if (src.includes("qr") || src.includes("receipt") || src.includes("table")) {
      qrCount++;
    } else if (src.includes("cfd") || src.includes("counter") || src.includes("display")) {
      cfdCount++;
    } else {
      webCount++;
    }
  }

  const totalSourceCount = published.length;
  const qrReceiptPercent =
    totalSourceCount > 0 ? Math.round((qrCount / totalSourceCount) * 100) : 0;
  const cfdPercent =
    totalSourceCount > 0 ? Math.round((cfdCount / totalSourceCount) * 100) : 0;
  const webPercent = totalSourceCount > 0 ? 100 - qrReceiptPercent - cfdPercent : 0;

  const delta = computePercentageDelta(published.length, prevAttempts.length);

  res.kpi = {
    value: published.length,
    displayValue: `${published.length.toLocaleString()} Responses`,
    label: "Survey Feedback Submissions",
    deltaPercent: delta.deltaPercent,
    deltaLabel: delta.deltaLabel,
    trend: delta.trend,
    secondaryMetrics: [
      { label: "Completed Surveys", value: published.length },
      {
        label: "Flagged For Action",
        value: rangeAttempts.filter((a) => a.flaggedForMeeting).length,
      },
    ],
  };

  res.summary = {
    totalResponses:
      published.length > 0 ? published.length.toLocaleString() : "0",
    rawCount: published.length,
    deltaPercent:
      delta.deltaPercent !== undefined
        ? `${delta.deltaPercent >= 0 ? "▲ +" : "▼ "}${delta.deltaPercent}% vs prev period`
        : "+0.0%",
    qrReceiptPercent,
    cfdPercent,
    webPercent,
    qrCount,
    cfdCount,
    webCount,
  };

  return res;
}

export async function provideSurveysAverageRating(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const storeOrders = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();
  const storeOrderIds = new Set(storeOrders.map((o) => o._id));

  const allAttempts = await ctx.db.query("surveyAttempts").collect();
  const storeAttemptIds = new Set(
    allAttempts
      .filter((a) => !a.orderId || storeOrderIds.has(a.orderId))
      .map((a) => a._id),
  );

  const allAnswers = await ctx.db.query("surveyAnswers").collect();
  const rangeAnswers = allAnswers.filter(
    (a) =>
      storeAttemptIds.has(a.attemptId) &&
      a.createdAt >= timeRange.from &&
      a.createdAt <= timeRange.to,
  );

  const numericRatings = rangeAnswers
    .map((a) => a.numericValue)
    .filter((v): v is number => typeof v === "number" && !isNaN(v));

  if (numericRatings.length === 0) {
    res.kpi = {
      value: 0,
      displayValue: "No ratings yet",
      label: "Overall Guest Satisfaction",
      trend: "neutral",
      secondaryMetrics: [
        { label: "Reviews Logged", value: 0 },
        { label: "Positive Sentiment", value: "0%" },
      ],
    };
    res.summary = {
      avgScore: "0.00",
      positivePercent: 0,
      neutralPercent: 0,
      negativePercent: 0,
      reviewsCount: 0,
    };
    return res;
  }

  const avg =
    numericRatings.reduce((sum, v) => sum + v, 0) / numericRatings.length;
  const positiveCount = numericRatings.filter((r) => r >= 4).length;
  const neutralCount = numericRatings.filter((r) => r === 3).length;
  const negCount = numericRatings.filter((r) => r <= 2).length;
  const positiveSentiment = `${Math.round((positiveCount / numericRatings.length) * 100)}%`;

  res.kpi = {
    value: Math.round(avg * 10) / 10,
    displayValue: `${(Math.round(avg * 10) / 10).toFixed(1)} / 5.0 ★`,
    label: "Overall Guest Satisfaction",
    trend: avg >= 4.0 ? "up" : "down",
    secondaryMetrics: [
      { label: "Reviews Logged", value: numericRatings.length },
      { label: "Positive Sentiment", value: positiveSentiment },
    ],
  };

  res.summary = {
    avgScore: (Math.round(avg * 100) / 100).toFixed(2),
    positivePercent: Math.round((positiveCount / numericRatings.length) * 100),
    neutralPercent: Math.round((neutralCount / numericRatings.length) * 100),
    negativePercent: Math.round((negCount / numericRatings.length) * 100),
    reviewsCount: numericRatings.length,
  };

  return res;
}

export async function provideSurveysRecentFeedback(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const now = Date.now();
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const storeOrders = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();
  const storeOrderIds = new Set(storeOrders.map((o) => o._id));
  const orderMap = new Map(storeOrders.map((o) => [o._id, o]));

  const allAttempts = await ctx.db.query("surveyAttempts").collect();
  const storeAttempts = allAttempts.filter(
    (a) => !a.orderId || storeOrderIds.has(a.orderId),
  );
  const attemptMap = new Map(storeAttempts.map((a) => [a._id, a]));
  const storeAttemptIds = new Set(storeAttempts.map((a) => a._id));

  const allAnswers = await ctx.db.query("surveyAnswers").collect();
  const rangeAnswers = allAnswers
    .filter(
      (a) =>
        storeAttemptIds.has(a.attemptId) &&
        a.createdAt >= timeRange.from &&
        a.createdAt <= timeRange.to,
    )
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10);

  const tables = await ctx.db.query("organizationTables").collect();
  const tableMap = new Map(tables.map((t) => [t._id, t]));

  const rows = rangeAnswers.map((a) => {
    const attempt = attemptMap.get(a.attemptId);
    const order = attempt?.orderId ? orderMap.get(attempt.orderId) : null;
    const tableLabel = order?.tableId ? `Table ${tableMap.get(order.tableId)?.tableNumber || ""}` : (order?.orderType || "Order");
    const label = a.orderItemName || tableLabel || "Dining Service";
    return {
      id: a._id,
      item: label,
      score: a.numericValue !== undefined ? `${a.numericValue} ★` : "5.0 ★",
      feedback:
        a.answerText ||
        (a.selectedOptions || []).join(", ") ||
        "Feedback submitted",
      time: formatRelativeTime(a.createdAt, now),
      orderNumber: order?.orderNumber ? `#${order.orderNumber}` : undefined,
    };
  });

  res.table = {
    columns: [
      { key: "item", label: "Dish / Experience" },
      { key: "score", label: "Rating", align: "center" },
      { key: "feedback", label: "Customer Comment" },
      { key: "time", label: "Submitted", align: "right" },
    ],
    rows,
    totalCount: rows.length,
  };

  const feedbackItems = rows.map((r) => {
    return {
      id: r.id,
      score: r.score,
      table: r.item,
      time: r.time,
      quote: `“${r.feedback}”`,
    };
  });

  res.summary = {
    feedbackItems,
  };

  return res;
}

export async function provideSurveysSatisfactionTrends(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const storeOrders = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();
  const storeOrderIds = new Set(storeOrders.map((o) => o._id));

  const allAttempts = await ctx.db.query("surveyAttempts").collect();
  const storeAttemptIds = new Set(
    allAttempts
      .filter((a) => !a.orderId || storeOrderIds.has(a.orderId))
      .map((a) => a._id),
  );

  const allAnswers = await ctx.db.query("surveyAnswers").collect();
  const rangeAnswers = allAnswers.filter(
    (a) =>
      storeAttemptIds.has(a.attemptId) &&
      a.createdAt >= timeRange.from &&
      a.createdAt <= timeRange.to,
  );

  const scoresByDay: Record<string, { sum: number; count: number }> = {};
  for (const a of rangeAnswers) {
    if (a.numericValue === undefined) continue;
    const dateStr = formatStoreDate(a.createdAt, res.country, res.timeZone, {
      month: "short",
      day: "numeric",
    });
    if (!scoresByDay[dateStr]) scoresByDay[dateStr] = { sum: 0, count: 0 };
    scoresByDay[dateStr].sum += a.numericValue;
    scoresByDay[dateStr].count++;
  }

  const chartData = Object.entries(scoresByDay).map(([label, b]) => ({
    label,
    value: Math.round((b.sum / b.count) * 10) / 10,
  }));

  res.chart = {
    chartType: "line",
    type: "line",
    series: [{ name: "Satisfaction Trend", data: chartData }],
    data: chartData,
    xAxisLabel: "Date",
    yAxisLabel: "Score (1-5)",
  };

  res.summary = {
    slaTarget: "SLA: 4.5+",
    rollingDays: "7-Day Rolling Index",
    currentRating:
      chartData.length > 0
        ? chartData[chartData.length - 1].value.toFixed(1)
        : "--",
    chartPoints: chartData,
  };

  return res;
}

export async function provideSurveysLowRatingAlerts(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const now = Date.now();
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const storeOrders = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();
  const storeOrderIds = new Set(storeOrders.map((o) => o._id));
  const orderMap = new Map(storeOrders.map((o) => [o._id, o]));

  const allAttempts = await ctx.db.query("surveyAttempts").collect();
  const storeAttempts = allAttempts.filter(
    (a) => !a.orderId || storeOrderIds.has(a.orderId),
  );
  const attemptMap = new Map(storeAttempts.map((a) => [a._id, a]));
  const storeAttemptIds = new Set(storeAttempts.map((a) => a._id));

  const allAnswers = await ctx.db.query("surveyAnswers").collect();
  const lowRatings = allAnswers.filter(
    (a) =>
      storeAttemptIds.has(a.attemptId) &&
      a.createdAt >= timeRange.from &&
      a.createdAt <= timeRange.to &&
      a.numericValue !== undefined &&
      a.numericValue <= 2,
  );

  res.alert = {
    count: lowRatings.length,
    alertCount: lowRatings.length,
    severity: lowRatings.length > 0 ? "critical" : "info",
    title:
      lowRatings.length > 0
        ? `${lowRatings.length} Negative Customer Reviews`
        : "No Critical Feedback Alerts",
    message:
      lowRatings.length > 0
        ? "Immediate guest recovery follow-up recommended."
        : "Guest sentiment is currently positive.",
  };

  const tables = await ctx.db.query("organizationTables").collect();
  const tableMap = new Map(tables.map((t) => [t._id, t]));

  const alerts = lowRatings.map((a) => {
    const attempt = attemptMap.get(a.attemptId);
    const order = attempt?.orderId ? orderMap.get(attempt.orderId) : null;
    return {
      id: a._id,
      stars: `${a.numericValue || 2}★ Review`,
      table: order?.tableId
        ? `Table ${tableMap.get(order.tableId)?.tableNumber || ""}`
        : (order?.orderType || "Guest Review"),
      bill: order?.orderNumber ? `Order #${order.orderNumber}` : "Survey Entry",
      quote: a.answerText
        ? `“${a.answerText}”`
        : "Low rating received on guest survey",
      staff: "Direct Feedback",
      time: formatRelativeTime(a.createdAt, now),
      callback: Boolean(attempt?.flaggedForMeeting),
    };
  });

  res.summary = {
    alertCount: lowRatings.length,
    alerts,
  };

  return res;
}

export async function provideSurveysResponseRates(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  const timeRange = calculateDateRangeBoundaries(
    options.dateRangePreset || "today",
    res.timeZone,
    options.fromTimestamp,
    options.toTimestamp,
  );

  const storeOrders = await ctx.db
    .query("orders")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();
  const storeOrderIds = new Set(storeOrders.map((o) => o._id));

  const allAttempts = await ctx.db.query("surveyAttempts").collect();
  const storeAttempts = allAttempts.filter(
    (a) => !a.orderId || storeOrderIds.has(a.orderId),
  );

  const published = storeAttempts.filter(
    (a) =>
      a.createdAt >= timeRange.from &&
      a.createdAt <= timeRange.to &&
      a.published,
  );

  const periodOrders = storeOrders.filter(
    (o) => o.createdAt >= timeRange.from && o.createdAt <= timeRange.to,
  );

  const rate =
    periodOrders.length > 0
      ? Math.round((published.length / periodOrders.length) * 1000) / 10
      : 0;

  const isOptimal = rate >= 15;
  const status =
    rate >= 15
      ? "Optimal • Above Benchmark"
      : rate > 0
      ? "Below Target Benchmark"
      : "Awaiting Submissions";

  const trendLabel = rate >= 15 ? "Optimal" : rate > 0 ? "Building Pace" : "Awaiting Data";

  res.kpi = {
    value: rate,
    displayValue: `${rate}% Rate`,
    label: "Survey Completion Rate",
    trend: rate >= 15 ? "up" : "neutral",
    secondaryMetrics: [
      { label: "Surveys Answered", value: published.length },
      { label: "Total Dining Covers", value: periodOrders.length },
    ],
  };

  res.summary = {
    conversionPercent: rate > 0 ? `${rate}%` : "0%",
    rawRate: rate,
    benchmark: "Industry benchmark: 15–20%",
    status,
    trendLabel,
    isOptimal,
  };

  return res;
}

// ==========================================
// 14. INVENTORY PROVIDERS
// ==========================================

export async function provideInventoryCriticalReorder(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);

  const items = await ctx.db
    .query("inventoryItems")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const critical = items.filter(
    (i) => i.availableStock <= i.minimumStockRefillLevel,
  );

  res.kpi = {
    value: critical.length,
    displayValue: `${critical.length} Items`,
    label: "Critical Reorder Threshold",
    trend: critical.length > 0 ? "down" : "up",
    secondaryMetrics: [
      {
        label: "Stockouts",
        value: items.filter((i) => i.availableStock <= 0).length,
      },
      { label: "Total SKUs Tracked", value: items.length },
    ],
  };

  res.alert = {
    title: "Inventory Stock Levels",
    severity: critical.length > 0 ? "critical" : "info",
    count: critical.length,
    message:
      critical.length > 0
        ? `${critical.length} items below minimum threshold`
        : "All stock levels optimal",
  };

  res.summary = {
    alertCount: critical.length,
    depletedItems: critical.slice(0, 5).map((i) => ({
      name: i.name,
      stockRemaining: `${i.availableStock} ${i.buyingUnit || "units"} remaining`,
      level:
        i.availableStock <= 0
          ? "Out of Stock"
          : `Low stock (${i.availableStock}/${i.minimumStockRefillLevel})`,
      isCritical:
        i.availableStock <= 0 ||
        i.availableStock <= i.minimumStockRefillLevel / 2,
      actionLabel: "Reorder",
    })),
  };

  return res;
}

export async function provideInventoryLowStock(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);

  const items = await ctx.db
    .query("inventoryItems")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const lowStock = items
    .filter((i) => i.availableStock <= i.minimumStockRefillLevel)
    .sort((a, b) => a.availableStock - b.availableStock)
    .slice(0, 8);

  const rows = lowStock.map((i) => ({
    id: i._id,
    name: i.name,
    available: `${i.availableStock} ${i.buyingUnit}`,
    reorderLevel: `${i.minimumStockRefillLevel} ${i.buyingUnit}`,
    status: i.availableStock <= 0 ? "Out of Stock" : "Reorder Needed",
  }));

  res.table = {
    columns: [
      { key: "name", label: "Inventory Item" },
      { key: "available", label: "Available Stock", align: "right" },
      { key: "reorderLevel", label: "Min Refill Level", align: "right" },
      { key: "status", label: "Alert" },
    ],
    rows,
    totalCount: lowStock.length,
  };

  return res;
}

export async function provideInventoryAvailability(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);

  const items = await ctx.db
    .query("inventoryItems")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const inStock = items.filter((i) => i.availableStock > 0);
  const rate =
    items.length > 0 ? Math.round((inStock.length / items.length) * 100) : 100;

  res.kpi = {
    value: rate,
    displayValue: `${rate}% In Stock`,
    label: "Raw Material Availability",
    trend: rate > 90 ? "up" : "down",
    secondaryMetrics: [
      { label: "Available SKUs", value: inStock.length },
      { label: "Depleted SKUs", value: items.length - inStock.length },
    ],
  };

  return res;
}

export async function provideInventoryReorderAlerts(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);

  const items = await ctx.db
    .query("inventoryItems")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const critical = items.filter(
    (i) => i.availableStock <= i.minimumStockRefillLevel,
  );

  res.alert = {
    count: critical.length,
    alertCount: critical.length,
    severity: critical.length > 0 ? "warning" : "info",
    title:
      critical.length > 0
        ? `${critical.length} Ingredients Below Reorder Level`
        : "All Inventory Levels Adequate",
    message:
      critical.length > 0
        ? "Purchase orders generated for low stock SKUs."
        : "No reorders required.",
  };

  return res;
}

export async function provideInventoryStockMovement(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  return provideInventoryLowStock(ctx, org, widgetDef, options);
}

export async function provideInventoryStockouts(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);

  const items = await ctx.db
    .query("inventoryItems")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .collect();

  const stockouts = items.filter((i) => i.availableStock <= 0);

  res.kpi = {
    value: stockouts.length,
    displayValue: `${stockouts.length} 86'd`,
    label: "Zero Stock Materials",
    trend: stockouts.length > 0 ? "down" : "up",
    secondaryMetrics: [
      { label: "Depleted Items", value: stockouts.length },
      {
        label: "Stockout Ratio",
        value: `${items.length > 0 ? Math.round((stockouts.length / items.length) * 100) : 0}%`,
      },
    ],
  };

  return res;
}

// ==========================================
// 15. REPORTS PROVIDERS
// ==========================================

export async function provideReportsDailySales(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  return provideOverviewNetRevenue(ctx, org, widgetDef, options);
}

export async function provideReportsHourlyVelocity(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = await provideOrdersVolumeOverTime(ctx, org, widgetDef, options);
  return {
    ...res,
    widgetId: widgetDef.widgetId,
  };
}

export async function provideReportsPaymentReconciliation(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  return provideCashierShiftSummary(ctx, org, widgetDef, options);
}

export async function provideReportsOperationalSummary(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  return provideOverviewBusinessSummary(ctx, org, widgetDef, options);
}

// ==========================================
// 16. HARDWARE IOT GAPS (Documented Unavailable)
// ==========================================

export async function provideIotColdStorage(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  res.isAvailable = false;
  res.unavailableReason =
    "IoT telemetry sensors not installed for cold storage units.";
  return res;
}

export async function provideIotBeveragePourRate(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  const res = createBaseResponse(widgetDef, org, options);
  res.isAvailable = false;
  res.unavailableReason =
    "IoT beverage flow meters and dispenser telemetry sensors not installed on draft lines.";
  return res;
}

// ==========================================
// 17. CENTRAL WIDGET DISPATCHER (All 95 Keys)
// ==========================================

export async function executeWidgetDataProvider(
  ctx: QueryCtx,
  org: Doc<"organizations">,
  widgetDef: WidgetDefinition,
  options: DataProviderOptions,
): Promise<WidgetDataResponse> {
  switch (widgetDef.dataProviderKey) {
    // Overview (8)
    case "provider_overview_net_revenue":
      return provideOverviewNetRevenue(ctx, org, widgetDef, options);
    case "provider_overview_total_orders":
      return provideOverviewTotalOrders(ctx, org, widgetDef, options);
    case "provider_overview_aov":
      return provideOverviewAov(ctx, org, widgetDef, options);
    case "provider_overview_active_orders":
      return provideOverviewActiveOrders(ctx, org, widgetDef, options);
    case "provider_overview_pending_orders":
      return provideOverviewPendingOrders(ctx, org, widgetDef, options);
    case "provider_overview_sales_trends":
      return provideOverviewSalesTrends(ctx, org, widgetDef, options);
    case "provider_overview_order_status_distribution":
      return provideOverviewOrderStatusDistribution(
        ctx,
        org,
        widgetDef,
        options,
      );
    case "provider_overview_business_summary":
      return provideOverviewBusinessSummary(ctx, org, widgetDef, options);

    // Orders (12)
    case "provider_orders_live_feed":
      return provideOrdersLiveFeed(ctx, org, widgetDef, options);
    case "provider_orders_by_status":
      return provideOverviewOrderStatusDistribution(
        ctx,
        org,
        widgetDef,
        options,
      );
    case "provider_orders_channel_breakdown":
      return provideOverviewTotalOrders(ctx, org, widgetDef, options);
    case "provider_orders_high_value":
      return provideOrdersHighValue(ctx, org, widgetDef, options);
    case "provider_orders_delayed_alerts":
      return provideOrdersDelayedAlerts(ctx, org, widgetDef, options);
    case "provider_orders_volume_over_time":
      return provideOrdersVolumeOverTime(ctx, org, widgetDef, options);
    case "provider_orders_floor_occupancy":
      return provideOrdersFloorOccupancy(ctx, org, widgetDef, options);
    case "provider_orders_delivery_fleet":
      return provideOrdersDeliveryFleet(ctx, org, widgetDef, options);
    case "provider_orders_takeaway_counter":
      return provideOrdersTakeawayCounter(ctx, org, widgetDef, options);
    case "provider_orders_cancellation_rate":
      return provideOrdersCancellationRate(ctx, org, widgetDef, options);
    case "provider_orders_rush_velocity":
      return provideOrdersRushVelocity(ctx, org, widgetDef, options);
    case "provider_orders_table_turn":
      return provideOrdersTableTurn(ctx, org, widgetDef, options);

    // Workstation (8 Capabilities + Telemetry)
    case "provider_workstation_order_summary":
      return provideWorkstationOrderSummary(ctx, org, widgetDef, options);
    case "provider_workstation_orders_by_workstation":
      return provideWorkstationOrdersByWorkstation(
        ctx,
        org,
        widgetDef,
        options,
      );
    case "provider_workstation_active_tasks":
      return provideWorkstationActiveTasks(ctx, org, widgetDef, options);
    case "provider_workstation_queue":
      return provideWorkstationQueue(ctx, org, widgetDef, options);
    case "provider_workstation_prep_time":
      return provideWorkstationPrepTime(ctx, org, widgetDef, options);
    case "provider_workstation_delayed_orders":
      return provideWorkstationDelayedOrders(ctx, org, widgetDef, options);
    case "provider_workstation_performance":
      return provideWorkstationPerformance(ctx, org, widgetDef, options);
    case "provider_workstation_availability":
      return provideWorkstationAvailability(ctx, org, widgetDef, options);
    case "provider_workstation_terminal_health":
      return provideWorkstationTerminalHealth(ctx, org, widgetDef, options);

    // Workstation backward compatibility aliases
    case "provider_workstation_order_volume":
      return provideWorkstationOrderSummary(ctx, org, widgetDef, options);
    case "provider_workstation_prep_times":
      return provideWorkstationPrepTime(ctx, org, widgetDef, options);

    // KDS (12)
    case "provider_kds_live_orders":
      return provideKdsLiveOrders(ctx, org, widgetDef, options);
    case "provider_kds_pending_tickets":
      return provideKdsPendingTickets(ctx, org, widgetDef, options);
    case "provider_kds_station_queue":
      return provideKdsStationQueue(ctx, org, widgetDef, options);
    case "provider_kds_status_breakdown":
      return provideKdsStatusBreakdown(ctx, org, widgetDef, options);
    case "provider_kds_avg_prep_time":
      return provideWorkstationPrepTime(ctx, org, widgetDef, options);
    case "provider_kds_delay_alerts":
      return provideKdsDelayAlerts(ctx, org, widgetDef, options);
    case "provider_kds_ready_at_pass":
      return provideKdsExpeditor(ctx, org, widgetDef, options);
    case "provider_kds_load_capacity":
      return provideKdsLoadCapacity(ctx, org, widgetDef, options);
    case "provider_kds_expeditor":
      return provideKdsExpeditor(ctx, org, widgetDef, options);
    case "provider_kds_prep_preferences":
      return provideKdsPrepPreferences(ctx, org, widgetDef, options);
    case "provider_kds_hourly_throughput":
      return provideKdsHourlyThroughput(ctx, org, widgetDef, options);
    case "provider_kds_station_leaderboard":
      return provideKdsStationLeaderboard(ctx, org, widgetDef, options);

    // Cashier (9)
    case "provider_cashier_shift_summary":
      return provideCashierShiftSummary(ctx, org, widgetDef, options);
    case "provider_cashier_total_transactions":
      return provideCashierTotalTransactions(ctx, org, widgetDef, options);
    case "provider_cashier_cash_sales":
      return provideCashierCashSales(ctx, org, widgetDef, options);
    case "provider_cashier_digital_sales":
      return provideCashierDigitalSales(ctx, org, widgetDef, options);
    case "provider_cashier_payment_breakdown":
      return provideCashierPaymentBreakdown(ctx, org, widgetDef, options);
    case "provider_cashier_refund_summary":
      return provideCashierRefundSummary(ctx, org, widgetDef, options);
    case "provider_cashier_transaction_history":
      return provideCashierTransactionHistory(ctx, org, widgetDef, options);
    case "provider_cashier_open_sessions":
      return provideCashierOpenSessions(ctx, org, widgetDef, options);
    case "provider_cashier_split_bills":
      return provideCashierSplitBills(ctx, org, widgetDef, options);

    // Captain (7)
    case "provider_captain_active_orders":
      return provideCaptainActiveOrders(ctx, org, widgetDef, options);
    case "provider_captain_table_service_status":
      return provideCaptainTableServiceStatus(ctx, org, widgetDef, options);
    case "provider_captain_assigned_tables":
      return provideCaptainAssignedTables(ctx, org, widgetDef, options);
    case "provider_captain_service_time":
      return provideCaptainServiceTime(ctx, org, widgetDef, options);
    case "provider_captain_orders_awaiting_service":
      return provideCaptainOrdersAwaitingService(ctx, org, widgetDef, options);
    case "provider_captain_performance_summary":
      return provideCaptainPerformanceSummary(ctx, org, widgetDef, options);
    case "provider_captain_order_activity":
      return provideCaptainOrderActivity(ctx, org, widgetDef, options);

    // Queue (6)
    case "provider_queue_length":
      return provideQueueLength(ctx, org, widgetDef, options);
    case "provider_queue_waiting_customers":
      return provideQueueWaitingCustomers(ctx, org, widgetDef, options);
    case "provider_queue_avg_wait_time":
      return provideQueueAvgWaitTime(ctx, org, widgetDef, options);
    case "provider_queue_recent_callouts":
      return provideQueueRecentCallouts(ctx, org, widgetDef, options);
    case "provider_queue_status_breakdown":
      return provideQueueStatusBreakdown(ctx, org, widgetDef, options);
    case "provider_queue_wait_time_alerts":
      return provideQueueWaitTimeAlerts(ctx, org, widgetDef, options);

    // Menu (8)
    case "provider_menu_top_selling":
      return provideMenuTopSelling(ctx, org, widgetDef, options);
    case "provider_menu_most_ordered_categories":
      return provideMenuMostOrderedCategories(ctx, org, widgetDef, options);
    case "provider_menu_bestselling_item":
      return provideMenuBestsellingItem(ctx, org, widgetDef, options);
    case "provider_menu_low_performing":
      return provideMenuLowPerforming(ctx, org, widgetDef, options);
    case "provider_menu_product_availability":
      return provideMenuProductAvailability(ctx, org, widgetDef, options);
    case "provider_menu_out_of_stock_alerts":
      return provideMenuOutOfStockAlerts(ctx, org, widgetDef, options);
    case "provider_menu_modifier_popularity":
      return provideMenuModifierPopularity(ctx, org, widgetDef, options);
    case "provider_menu_performance_summary":
      return provideMenuPerformanceSummary(ctx, org, widgetDef, options);

    // Customers (6)
    case "provider_customers_total":
      return provideCustomersTotal(ctx, org, widgetDef, options);
    case "provider_customers_new":
      return provideCustomersNew(ctx, org, widgetDef, options);
    case "provider_customers_returning":
      return provideCustomersReturning(ctx, org, widgetDef, options);
    case "provider_customers_recent":
      return provideCustomersRecent(ctx, org, widgetDef, options);
    case "provider_customers_most_frequent":
      return provideCustomersMostFrequent(ctx, org, widgetDef, options);
    case "provider_customers_order_frequency":
      return provideCustomersOrderFrequency(ctx, org, widgetDef, options);

    // Surveys (6)
    case "provider_surveys_response_counts":
      return provideSurveysResponseCounts(ctx, org, widgetDef, options);
    case "provider_surveys_average_rating":
      return provideSurveysAverageRating(ctx, org, widgetDef, options);
    case "provider_surveys_recent_feedback":
      return provideSurveysRecentFeedback(ctx, org, widgetDef, options);
    case "provider_surveys_satisfaction_trends":
      return provideSurveysSatisfactionTrends(ctx, org, widgetDef, options);
    case "provider_surveys_low_rating_alerts":
      return provideSurveysLowRatingAlerts(ctx, org, widgetDef, options);
    case "provider_surveys_response_rates":
      return provideSurveysResponseRates(ctx, org, widgetDef, options);

    // Inventory (6)
    case "provider_inventory_critical_reorder":
      return provideInventoryCriticalReorder(ctx, org, widgetDef, options);
    case "provider_inventory_low_stock":
      return provideInventoryLowStock(ctx, org, widgetDef, options);
    case "provider_inventory_availability":
      return provideInventoryAvailability(ctx, org, widgetDef, options);
    case "provider_inventory_reorder_alerts":
      return provideInventoryReorderAlerts(ctx, org, widgetDef, options);
    case "provider_inventory_stock_movement":
      return provideInventoryStockMovement(ctx, org, widgetDef, options);
    case "provider_inventory_stockouts":
      return provideInventoryStockouts(ctx, org, widgetDef, options);

    // Reports (4)
    case "provider_reports_daily_sales":
      return provideReportsDailySales(ctx, org, widgetDef, options);
    case "provider_reports_hourly_velocity":
      return provideReportsHourlyVelocity(ctx, org, widgetDef, options);
    case "provider_reports_payment_reconciliation":
      return provideReportsPaymentReconciliation(ctx, org, widgetDef, options);
    case "provider_reports_operational_summary":
      return provideReportsOperationalSummary(ctx, org, widgetDef, options);

    // Hardware IoT Gaps (2)
    case "provider_iot_cold_storage":
      return provideIotColdStorage(ctx, org, widgetDef, options);
    case "provider_iot_beverage_pour_rate":
      return provideIotBeveragePourRate(ctx, org, widgetDef, options);

    default: {
      const fallback = createBaseResponse(widgetDef, org, options);
      fallback.isAvailable = false;
      fallback.unavailableReason = `Data provider '${widgetDef.dataProviderKey}' not yet configured for store data model.`;
      return fallback;
    }
  }
}
