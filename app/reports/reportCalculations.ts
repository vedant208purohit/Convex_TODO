import {
  formatCurrencyAmount,
  formatPriceWithSymbol,
  formatStoreDate,
  formatStoreTime,
  getLocaleForCountry,
  getTimezoneForCountry,
} from "../../lib/constants/countries";

// ==========================================
// UTILITY & FORMATTING FUNCTIONS
// ==========================================

export const formatDeliveryTime = (totalSeconds?: number | null): string => {
  if (totalSeconds === undefined || totalSeconds === null || isNaN(totalSeconds) || totalSeconds <= 0) {
    return "-";
  }
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  let timeString = "";
  if (days > 0) timeString += `${days}d `;
  if (hours > 0) timeString += `${hours}h `;
  if (minutes > 0) timeString += `${minutes}m `;

  return timeString.trim() || "-";
};

export const formatHourWindow = (hour: number): string => {
  const formatH = (h: number) => {
    const period = h >= 12 && h < 24 ? "PM" : "AM";
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH.toString().padStart(2, "0")}:00 ${period}`;
  };
  const start = formatH(hour);
  const end = formatH((hour + 1) % 24);
  return `${start} - ${end}`;
};

export const isDataZero = (val: any): string => {
  if (val === undefined || val === null || val === "" || val === 0 || val === "0" || val === "0.00") {
    return "-";
  }
  const str = String(val).trim();
  return str;
};

export const isOrderRefunded = (o: any): boolean => {
  if (!o) return false;
  if (o.paymentStatus === "Refunded" || o.paymentStatus === "Partially Refunded") {
    return true;
  }
  const statusName = (o.orderStatusName || o.status || o.orderStatus || "").toLowerCase();
  if (statusName.includes("refund")) {
    return true;
  }
  if (typeof o.refundAmount === "number" && o.refundAmount > 0) {
    return true;
  }
  if (
    Array.isArray(o.payments) &&
    o.payments.some(
      (p: any) =>
        p.paymentType === "Debit" ||
        p.status === "Refunded" ||
        (typeof p.refundAmount === "number" && p.refundAmount > 0)
    )
  ) {
    return true;
  }
  return false;
};

export const isOrderUnpaidCancelled = (o: any): boolean => {
  if (!o) return false;
  // If order was refunded (fully or partially), it had money exchanged and must NOT be skipped as an unpaid cancellation
  if (isOrderRefunded(o)) return false;

  const isCancelledOrRejected =
    Boolean(o.isRejected) ||
    o.orderStatus === "Cancelled" ||
    o.status === "Cancelled" ||
    (o.orderStatusName || "").toLowerCase().includes("cancel") ||
    (o.orderStatusName || "").toLowerCase().includes("reject");

  if (!isCancelledOrRejected) return false;

  const isPaid =
    o.paymentStatus === "Paid" ||
    o.isPaid === true ||
    (Array.isArray(o.payments) &&
      o.payments.length > 0 &&
      o.payments.some(
        (p: any) =>
          (p.paymentType === "Credit" || !p.paymentType) &&
          (p.status === "Success" || p.status === "Paid" || Boolean(p.paymentModeName))
      ));

  return !isPaid;
};

export const getOrderRefundAmount = (o: any): number => {
  if (!o) return 0;
  let refund = 0;
  if (Array.isArray(o.payments) && o.payments.length > 0) {
    for (const p of o.payments) {
      if (p.paymentType === "Debit") {
        refund += p.amount || p.refundAmount || 0;
      } else if (typeof p.refundAmount === "number" && p.refundAmount > 0) {
        refund += p.refundAmount;
      }
    }
  }
  if (refund === 0) {
    if (
      o.paymentStatus === "Refunded" ||
      (o.orderStatusName || "").toLowerCase().includes("refund")
    ) {
      refund = o.totalAmount || 0;
    } else if (o.paymentStatus === "Partially Refunded" && o.discountAmount) {
      refund = o.discountAmount;
    } else if (typeof o.refundAmount === "number" && o.refundAmount > 0) {
      refund = o.refundAmount;
    }
  }
  return refund;
};


export interface SalesReportOutput {
  total_gross_sales: string;
  total_net_sales: string;
  total_tax_collected: string;
  total_refund: string;
  total_orders: number;
  sales_data: Array<{
    date: string;
    gross_sales: string;
    refunds: string;
    taxes_collected: string;
    net_sales: string;
    total_orders: number;
  }>;
  length: number;
}

export function computeSalesReportData(
  orders: any[],
  currencySymbol: string,
  countryCode?: string,
  timezone?: string,
): SalesReportOutput {
  let grossSalesPaise = 0;
  let taxCollectedPaise = 0;
  let refundsPaise = 0;
  let netSalesPaise = 0;

  // Group by date (localized in store timezone)
  const dailyMap = new Map<
    string,
    {
      dateLabel: string;
      rawDate: number;
      grossPaise: number;
      taxPaise: number;
      refundPaise: number;
      netPaise: number;
      orderCount: number;
    }
  >();

  for (const order of orders) {
    if (isOrderUnpaidCancelled(order)) continue;

    const isPaid =
      order.paymentStatus === "Paid" ||
      order.isPaid === true ||
      (Array.isArray(order.payments) &&
        order.payments.length > 0 &&
        order.payments.some(
          (p: any) => p.status === "Success" || p.status === "Paid" || Boolean(p.paymentModeName)
        ));

    // Exclude pending/unpaid orders from realized sales revenue
    if (!isPaid && !isOrderRefunded(order)) {
      continue;
    }

    const orderTotal = order.totalAmount || 0;
    const subTotal = order.subTotal || 0;
    const discount = order.discountAmount || 0;
    const delivery = order.deliveryCharge || 0;

    // Isolate exclusive tax only (tax charged on top of subtotal)
    const orderExclusiveTax =
      orderTotal > 0 && subTotal > 0
        ? Math.max(0, orderTotal - subTotal + discount - delivery)
        : (order.taxInfoSnapshot?.tax_mode === "exclusive" ? (order.taxTotal || 0) : 0);
    const orderTax = orderExclusiveTax;
    const orderRefund = getOrderRefundAmount(order);

    const orderGross = orderTotal;
    const orderNet = Math.max(0, orderGross - orderTax - orderRefund);

    grossSalesPaise += orderGross;
    taxCollectedPaise += orderTax;
    refundsPaise += orderRefund;
    netSalesPaise += orderNet;

    const dateKey = formatStoreDate(order.createdAt, countryCode, timezone);
    const existing = dailyMap.get(dateKey) || {
      dateLabel: dateKey,
      rawDate: order.createdAt,
      grossPaise: 0,
      taxPaise: 0,
      refundPaise: 0,
      netPaise: 0,
      orderCount: 0,
    };

    existing.grossPaise += orderGross;
    existing.taxPaise += orderTax;
    existing.refundPaise += orderRefund;
    existing.netPaise += orderNet;
    existing.orderCount += 1;
    dailyMap.set(dateKey, existing);
  }

  // Sort daily rows descending by date
  const sortedDays = Array.from(dailyMap.values()).sort(
    (a, b) => b.rawDate - a.rawDate,
  );

  const sales_data = sortedDays.map((d) => ({
    date: d.dateLabel,
    gross_sales: formatPriceWithSymbol(d.grossPaise, currencySymbol, countryCode, true),
    refunds: formatPriceWithSymbol(d.refundPaise, currencySymbol, countryCode, true),
    taxes_collected: formatPriceWithSymbol(d.taxPaise, currencySymbol, countryCode, true),
    net_sales: formatPriceWithSymbol(d.netPaise, currencySymbol, countryCode, true),
    total_orders: d.orderCount,
  }));

  return {
    total_gross_sales: formatPriceWithSymbol(grossSalesPaise, currencySymbol, countryCode, true),
    total_net_sales: formatPriceWithSymbol(netSalesPaise, currencySymbol, countryCode, true),
    total_tax_collected: formatPriceWithSymbol(taxCollectedPaise, currencySymbol, countryCode, true),
    total_refund: formatPriceWithSymbol(refundsPaise, currencySymbol, countryCode, true),
    total_orders: orders.length,
    sales_data,
    length: sales_data.length,
  };
}

// ==========================================
// 2. ORDERS REPORT CALCULATION
// ==========================================

export interface OrdersReportOutput {
  total_orders: number;
  total_avg_order_value: string;
  average_delivery_time: number | null;
  peak_order_time_frame: string;
  order_type_summary_data: Array<{
    order_type: string;
    total_orders: number;
    avg_order_value: string;
    refunded_orders: number;
    avg_delivery_time: string;
  }>;
  orders_data: Array<{
    date: string;
    total_orders: number;
    avg_order_value: string;
    average_delivery_time: string;
    peak_order_time_frame: string;
    avg_items_per_order: string;
    avg_order_type: string;
  }>;
  length: number;
}

function getStoreHourInTz(
  timestamp: number,
  countryCode?: string,
  timezone?: string
): number {
  const targetTz = timezone || (countryCode ? getTimezoneForCountry(countryCode) : undefined);
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

function formatOrderTypeDisplayName(type?: string): string {
  if (!type) return "Dine In";
  const lower = type.toLowerCase().replace(/[-_ ]/g, "");
  if (lower === "dinein") return "Dine In";
  if (lower === "takeaway" || lower === "take_away") return "Takeaway";
  if (lower === "delivery") return "Delivery";
  if (lower === "scheduleddelivery") return "Scheduled Delivery";
  if (lower === "scheduledpickup") return "Scheduled Pickup";
  return type;
}

// Helper: Parse hours from various timing string formats
export function parseHourFromTimeStr(str?: string): number | null {
  if (!str || typeof str !== "string") return null;
  const clean = str.trim();
  if (clean.includes("T")) {
    const timePart = clean.split("T")[1];
    const h = parseInt(timePart.split(":")[0], 10);
    return isNaN(h) ? null : h;
  }
  const ampmMatch = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const isPm = ampmMatch[3].toUpperCase() === "PM";
    if (isPm && h < 12) h += 12;
    if (!isPm && h === 12) h = 0;
    return h;
  }
  if (clean.includes(":")) {
    const h = parseInt(clean.split(":")[0], 10);
    return isNaN(h) ? null : h;
  }
  const h = parseInt(clean, 10);
  return isNaN(h) ? null : h;
}

// Helper: Format raw operational time string into localized display format using countries.ts
export function formatOperationalTimeString(
  timeStr?: string,
  countryCode?: string,
  timezone?: string,
): string {
  if (!timeStr || typeof timeStr !== "string" || !timeStr.trim()) return "";
  const clean = timeStr.trim();

  // If already standard AM/PM formatted string (e.g., "11:30 AM")
  if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(clean)) return clean;

  // If ISO date/time string
  if (clean.includes("T")) {
    return formatStoreTime(clean, timezone, countryCode);
  }

  // If HH:MM or HH:MM:SS format
  if (clean.includes(":")) {
    const parts = clean.split(":");
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1] || "0", 10);
    if (!isNaN(h)) {
      const refDate = new Date(Date.UTC(2026, 0, 1, Math.min(23, Math.max(0, h)), isNaN(m) ? 0 : Math.min(59, Math.max(0, m))));
      return formatStoreTime(refDate, "UTC", countryCode);
    }
  }

  // Plain number representation
  const h = parseInt(clean, 10);
  if (!isNaN(h)) {
    const refDate = new Date(Date.UTC(2026, 0, 1, Math.min(23, Math.max(0, h)), 0));
    return formatStoreTime(refDate, "UTC", countryCode);
  }

  return clean;
}

// Helper: Format chart/cadence hour into clean localized axis label (e.g. 11 AM, 12 PM)
export function formatAxisHour(h: number, countryCode?: string): string {
  const safeH = Math.min(23, Math.max(0, h));
  const refDate = new Date(Date.UTC(2026, 0, 1, safeH, 0));
  const locale = getLocaleForCountry(countryCode);
  try {
    const formatted = new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      hour: "numeric",
      hour12: true,
    }).format(refDate);
    return formatted.replace(/[:.]00\s*/, " ").toUpperCase().trim();
  } catch {
    const period = safeH >= 12 && safeH < 24 ? "PM" : "AM";
    const displayH = safeH % 12 === 0 ? 12 : safeH % 12;
    return `${displayH} ${period}`;
  }
}

// Helper: Parse any time string or ISO format into minutes of the day (0 to 1439)
export function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr || typeof timeStr !== "string") return null;
  const clean = timeStr.trim();
  if (!clean) return null;

  // 1. 12-hour format e.g. "11:30 AM", "11:11 PM", "11:30am", "8:00pm", "11 PM"
  const ampmMatch = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const isPm = ampmMatch[3].toUpperCase() === "PM";
    if (isPm && h < 12) h += 12;
    if (!isPm && h === 12) h = 0;
    return Math.min(1439, Math.max(0, h * 60 + m));
  }

  // 2. ISO format with "T" (e.g. "2023-05-08T11:30:00.000+05:30")
  if (clean.includes("T")) {
    const timePart = clean.split("T")[1];
    const match = timePart.match(/^(\d{1,2}):(\d{2})/);
    if (match) {
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      if (!isNaN(h)) {
        return Math.min(1439, Math.max(0, h * 60 + (isNaN(m) ? 0 : m)));
      }
    }
    const parsed = Date.parse(clean);
    if (!isNaN(parsed)) {
      const d = new Date(parsed);
      return d.getHours() * 60 + d.getMinutes();
    }
  }

  // 3. GMT or Date string (e.g. "Mon May 08 2023 11:30:00 GMT+0530")
  if (clean.includes("GMT") || clean.includes("Z")) {
    const timeMatch = clean.match(/(\d{1,2}):(\d{2}):(\d{2})/);
    if (timeMatch) {
      const h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      if (!isNaN(h)) {
        return Math.min(1439, Math.max(0, h * 60 + (isNaN(m) ? 0 : m)));
      }
    }
    const parsed = Date.parse(clean);
    if (!isNaN(parsed)) {
      const d = new Date(parsed);
      return d.getHours() * 60 + d.getMinutes();
    }
  }

  // 4. 24-hour format e.g. "11:30", "23:11", "08:00"
  if (clean.includes(":")) {
    const parts = clean.split(":");
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1] || "0", 10);
    if (!isNaN(h)) {
      return Math.min(1439, Math.max(0, h * 60 + (isNaN(m) ? 0 : m)));
    }
  }

  // 5. Plain integer hour e.g. "11", "20"
  const plainH = parseInt(clean, 10);
  if (!isNaN(plainH) && plainH >= 0 && plainH <= 24) {
    return Math.min(1439, Math.max(0, plainH === 24 ? 1439 : plainH * 60));
  }

  return null;
}

// Helper: Format minutes from day start into clean localized 12-hour string (e.g. "11:30 AM", "11:11 PM")
export function formatMinutesTo12h(totalMinutes: number): string {
  const clamped = Math.min(1439, Math.max(0, totalMinutes));
  let h = Math.floor(clamped / 60);
  const m = clamped % 60;
  const ampm = h >= 12 && h < 24 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  const mStr = m < 10 ? `0${m}` : `${m}`;
  return `${h}:${mStr} ${ampm}`;
}

export interface DayOperationalTiming {
  active?: boolean;
  is_open?: boolean;
  is_open_all_day?: boolean;
  open?: string;
  close?: string;
  hours?: Array<{
    start_time?: string;
    end_time?: string;
    start?: string;
    end?: string;
    open?: string;
    close?: string;
  }>;
}

export interface OperationalScheduleResult {
  validHours: Set<number>;
  sortedHours: number[];
  startHour: number;
  endHour: number;
  serviceTimingLabel: string;
  isOpenAllDay: boolean;
}

// Helper: Resolve exact operational schedule from store operationTiming
export function getOperationalScheduleInfo(
  operationTiming: any,
  countryCode?: string,
  timezone?: string,
  selectedDateTimestamp?: number,
): OperationalScheduleResult {
  const validHours = new Set<number>();

  if (!operationTiming || typeof operationTiming !== "object") {
    for (let h = 11; h <= 23; h++) validHours.add(h);
    const sortedHours = Array.from(validHours).sort((a, b) => a - b);
    const startFormatted = formatOperationalTimeString("11:00", countryCode, timezone);
    const endFormatted = formatOperationalTimeString("23:00", countryCode, timezone);
    return {
      validHours,
      sortedHours,
      startHour: 11,
      endHour: 23,
      serviceTimingLabel: startFormatted && endFormatted ? `${startFormatted} – ${endFormatted}` : "11:00 AM – 11:00 PM",
      isOpenAllDay: false,
    };
  }

  // Check if operationTiming has flat openTime / closeTime properties
  if (typeof operationTiming.openTime === "string" && typeof operationTiming.closeTime === "string") {
    const startMin = parseTimeToMinutes(operationTiming.openTime) ?? 660; // 11:00 AM
    const endMin = parseTimeToMinutes(operationTiming.closeTime) ?? 1380; // 11:00 PM
    const startH = Math.floor(startMin / 60);
    const endH = Math.min(23, Math.floor(endMin / 60));
    for (let h = startH; h <= endH; h++) validHours.add(h);
    const sortedHours = Array.from(validHours).sort((a, b) => a - b);
    return {
      validHours,
      sortedHours,
      startHour: startH,
      endHour: endH,
      serviceTimingLabel: `${formatMinutesTo12h(startMin)} – ${formatMinutesTo12h(endMin)}`,
      isOpenAllDay: false,
    };
  }

  const dayKeys = Object.keys(operationTiming);

  let targetDayConfig: DayOperationalTiming | null = null;
  if (selectedDateTimestamp) {
    const targetDate = new Date(selectedDateTimestamp);
    const targetTz = timezone || (countryCode ? getTimezoneForCountry(countryCode) : undefined);
    let dayName = "Friday";
    try {
      dayName = new Intl.DateTimeFormat("en-US", {
        timeZone: targetTz,
        weekday: "long",
      }).format(targetDate);
    } catch {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      dayName = days[targetDate.getDay()];
    }

    const matchedKey = dayKeys.find(
      (k) => k.toLowerCase() === dayName.toLowerCase() || k.toLowerCase().startsWith(dayName.slice(0, 3).toLowerCase()),
    );
    if (matchedKey) {
      targetDayConfig = operationTiming[matchedKey];
    }
  }

  // Determine list of days to evaluate:
  // If targetDayConfig is provided and explicitly configured open/active, evaluate that day.
  // Otherwise, inspect ALL active open days across the weekly schedule to get the full service span!
  const daysToInspect: DayOperationalTiming[] = [];
  if (targetDayConfig && (targetDayConfig.active ?? targetDayConfig.is_open ?? true)) {
    daysToInspect.push(targetDayConfig);
  } else {
    for (const key of dayKeys) {
      const day = operationTiming[key];
      if (day && typeof day === "object" && (day.active ?? day.is_open ?? true)) {
        daysToInspect.push(day);
      }
    }
  }

  if (daysToInspect.length === 0) {
    for (const key of dayKeys) {
      const day = operationTiming[key];
      if (day && typeof day === "object") daysToInspect.push(day);
    }
  }

  let minMinutes = Infinity;
  let maxMinutes = -1;
  let isOpenAllDay = false;

  for (const day of daysToInspect) {
    if (!day || typeof day !== "object") continue;

    if (day.is_open_all_day) {
      isOpenAllDay = true;
      minMinutes = Math.min(minMinutes, 0);
      maxMinutes = Math.max(maxMinutes, 1439);
      for (let h = 0; h <= 23; h++) validHours.add(h);
      continue;
    }

    if (day.open || day.close) {
      const sMin = parseTimeToMinutes(day.open);
      const eMin = parseTimeToMinutes(day.close);
      if (sMin !== null) {
        const end = eMin !== null ? eMin : 1380;
        minMinutes = Math.min(minMinutes, sMin);
        maxMinutes = Math.max(maxMinutes, end);
        const sH = Math.floor(sMin / 60);
        const eH = Math.min(23, Math.floor(end / 60));
        for (let h = sH; h <= eH; h++) validHours.add(h);
      }
    }

    if (Array.isArray(day.hours)) {
      for (const slot of day.hours) {
        if (!slot) continue;
        const rawStart = slot.start_time || slot.open || slot.start;
        const rawEnd = slot.end_time || slot.close || slot.end;
        const sMin = parseTimeToMinutes(rawStart);
        const eMin = parseTimeToMinutes(rawEnd);
        if (sMin !== null) {
          const end = eMin !== null ? eMin : 1380;
          minMinutes = Math.min(minMinutes, sMin);
          maxMinutes = Math.max(maxMinutes, end);
          const sH = Math.floor(sMin / 60);
          const eH = Math.min(23, Math.floor(end / 60));
          for (let h = sH; h <= eH; h++) validHours.add(h);
        }
      }
    }
  }

  // Ultimate fallback if nothing valid was extracted
  if (validHours.size === 0 || minMinutes === Infinity || maxMinutes === -1) {
    for (let h = 11; h <= 23; h++) validHours.add(h);
    minMinutes = 660; // 11:00 AM
    maxMinutes = 1380; // 11:00 PM
  }

  const sortedHours = Array.from(validHours).sort((a, b) => a - b);
  const startHour = sortedHours[0] ?? 11;
  const endHour = sortedHours[sortedHours.length - 1] ?? 23;

  let serviceTimingLabel = "11:00 AM – 11:00 PM";
  if (isOpenAllDay) {
    serviceTimingLabel = "Open 24 Hours";
  } else {
    const startFormatted = formatMinutesTo12h(minMinutes);
    const endFormatted = formatMinutesTo12h(maxMinutes);
    serviceTimingLabel = `${startFormatted} – ${endFormatted}`;
  }

  return {
    validHours,
    sortedHours,
    startHour,
    endHour,
    serviceTimingLabel,
    isOpenAllDay,
  };
}

// Backward compatible helper for existing callers
export function parseOperationalHourRange(
  operationTiming: any,
  countryCode?: string,
  timezone?: string,
  selectedDateTimestamp?: number,
): {
  validHours: Set<number>;
  sortedHours: number[];
  startHour: number;
  endHour: number;
  serviceTimingLabel: string;
  isOpenAllDay: boolean;
} {
  return getOperationalScheduleInfo(operationTiming, countryCode, timezone, selectedDateTimestamp);
}

export function computeOrdersReportData(
  orders: any[],
  currencySymbol: string,
  countryCode?: string,
  timezone?: string,
  operationTiming?: any,
): OrdersReportOutput {
  let validOrdersCount = 0;
  let totalGrossPaise = 0;
  let deliveryTimeSumSeconds = 0;
  let deliveryOrdersCount = 0;

  const hourlyCounts = new Array(24).fill(0);
  const orderTypeMap = new Map<
    string,
    {
      totalOrders: number;
      grossPaise: number;
      refundedOrders: number;
      deliverySecs: number;
      deliveryCount: number;
    }
  >();

  const dailyMap = new Map<
    string,
    {
      dateLabel: string;
      rawDate: number;
      totalOrders: number;
      grossPaise: number;
      itemsCount: number;
      deliverySecs: number;
      deliveryCount: number;
      hourlyCounts: number[];
      typeCounts: Record<string, number>;
    }
  >();

  for (const order of orders) {
    if (isOrderUnpaidCancelled(order)) continue; // Exclude unpaid cancelled orders

    validOrdersCount += 1;
    const gross = order.totalAmount || 0;
    totalGrossPaise += gross;

    // Delivery time (for Delivery or ScheduledDelivery orders)
    const isDelivery =
      order.orderType === "Delivery" || order.orderType === "ScheduledDelivery";
    let orderDeliverySecs = 0;
    const compTime = order.completedAt || order.deliveredAt || (order.isCompleted ? order.updatedAt : 0);
    if (isDelivery && compTime > order.createdAt) {
      orderDeliverySecs = Math.max(0, Math.floor((compTime - order.createdAt) / 1000));
      deliveryTimeSumSeconds += orderDeliverySecs;
      deliveryOrdersCount += 1;
    }

    // Hourly tracking for peak order time frame in store timezone
    const orderHour = getStoreHourInTz(order.createdAt, countryCode, timezone);
    hourlyCounts[orderHour] = (hourlyCounts[orderHour] || 0) + 1;

    // Order type tracking with friendly display name
    const typeKey = formatOrderTypeDisplayName(order.orderType);
    const existingType = orderTypeMap.get(typeKey) || {
      totalOrders: 0,
      grossPaise: 0,
      refundedOrders: 0,
      deliverySecs: 0,
      deliveryCount: 0,
    };
    existingType.totalOrders += 1;
    existingType.grossPaise += gross;
    if (order.paymentStatus === "Refunded" || isOrderRefunded(order)) {
      existingType.refundedOrders += 1;
    }
    if (orderDeliverySecs > 0) {
      existingType.deliverySecs += orderDeliverySecs;
      existingType.deliveryCount += 1;
    }
    orderTypeMap.set(typeKey, existingType);

    // Daily tracking
    const dateKey = formatStoreDate(order.createdAt, countryCode, timezone);
    const existingDay = dailyMap.get(dateKey) || {
      dateLabel: dateKey,
      rawDate: order.createdAt,
      totalOrders: 0,
      grossPaise: 0,
      itemsCount: 0,
      deliverySecs: 0,
      deliveryCount: 0,
      hourlyCounts: new Array(24).fill(0),
      typeCounts: {} as Record<string, number>,
    };

    existingDay.totalOrders += 1;
    existingDay.grossPaise += gross;
    existingDay.itemsCount += order.items
      ? order.items.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0)
      : order.item_count || 1;

    if (orderDeliverySecs > 0) {
      existingDay.deliverySecs += orderDeliverySecs;
      existingDay.deliveryCount += 1;
    }
    existingDay.hourlyCounts[orderHour] += 1;
    existingDay.typeCounts[typeKey] = (existingDay.typeCounts[typeKey] || 0) + 1;

    dailyMap.set(dateKey, existingDay);
  }

  // Peak Hour restricted strictly to store's operational timing
  const { validHours } = parseOperationalHourRange(operationTiming, countryCode, timezone);
  let peakHour = -1;
  let maxHourlyCount = 0;
  for (let h = 0; h < 24; h++) {
    if (validHours.has(h) && hourlyCounts[h] > maxHourlyCount) {
      maxHourlyCount = hourlyCounts[h];
      peakHour = h;
    }
  }
  const peak_order_time_frame = peakHour !== -1 && maxHourlyCount > 0 ? formatHourWindow(peakHour) : "No peak time";

  // Average Delivery Time
  const avgDeliverySecs =
    deliveryOrdersCount > 0
      ? Math.round(deliveryTimeSumSeconds / deliveryOrdersCount)
      : null;

  // Average Order Value
  const aovPaise = validOrdersCount > 0 ? Math.round(totalGrossPaise / validOrdersCount) : 0;

  // Order Type Summary Data
  const order_type_summary_data = Array.from(orderTypeMap.entries()).map(
    ([type, stats]) => {
      const typeAov =
        stats.totalOrders > 0
          ? Math.round(stats.grossPaise / stats.totalOrders)
          : 0;
      const typeAvgDelivery =
        stats.deliveryCount > 0
          ? formatDeliveryTime(Math.round(stats.deliverySecs / stats.deliveryCount))
          : "-";

      return {
        order_type: type,
        total_orders: stats.totalOrders,
        avg_order_value: formatPriceWithSymbol(typeAov, currencySymbol, countryCode, true),
        refunded_orders: stats.refundedOrders,
        avg_delivery_time: typeAvgDelivery,
      };
    },
  );

  // Daily Orders Data
  const sortedDays = Array.from(dailyMap.values()).sort(
    (a, b) => b.rawDate - a.rawDate,
  );

  const orders_data = sortedDays.map((d) => {
    const dayAov = d.totalOrders > 0 ? Math.round(d.grossPaise / d.totalOrders) : 0;
    const dayAvgDeliv =
      d.deliveryCount > 0
        ? formatDeliveryTime(Math.round(d.deliverySecs / d.deliveryCount))
        : "-";

    // Day peak hour restricted strictly to store's operational timing
    let dayPeakH = -1;
    let dayMaxH = 0;
    for (let h = 0; h < 24; h++) {
      if (validHours.has(h) && d.hourlyCounts[h] > dayMaxH) {
        dayMaxH = d.hourlyCounts[h];
        dayPeakH = h;
      }
    }
    const dayPeak = dayPeakH !== -1 && dayMaxH > 0 ? formatHourWindow(dayPeakH) : "No peak time";

    // Day avg items
    const avgItems =
      d.totalOrders > 0 ? (d.itemsCount / d.totalOrders).toFixed(1) : "0.0";

    // Day predominant order type
    let predominantType = "-";
    let maxTypeCount = 0;
    for (const [t, c] of Object.entries(d.typeCounts)) {
      if (c > maxTypeCount) {
        maxTypeCount = c;
        predominantType = t;
      }
    }

    return {
      date: d.dateLabel,
      total_orders: d.totalOrders,
      avg_order_value: formatPriceWithSymbol(dayAov, currencySymbol, countryCode, true),
      average_delivery_time: dayAvgDeliv,
      peak_order_time_frame: dayPeak,
      avg_items_per_order: avgItems,
      avg_order_type: predominantType,
    };
  });

  return {
    total_orders: validOrdersCount,
    total_avg_order_value: validOrdersCount > 0 ? formatPriceWithSymbol(aovPaise, currencySymbol, countryCode, true) : "-",
    average_delivery_time: avgDeliverySecs,
    peak_order_time_frame,
    order_type_summary_data,
    orders_data,
    length: orders_data.length,
  };
}

// ==========================================
// 3. CUSTOMER REPORT CALCULATION
// ==========================================

export interface CustomerReportOutput {
  total_customers: number;
  retention_rate: string;
  avg_customer_spend: string;
  new_customers: number;
  table_data: Array<{
    date: string;
    total_customers: number;
    new_customers: number;
    repeat_customers: number;
    retention_rate: string;
    avg_customer_spend: string;
  }>;
  length: number;
}

export function computeCustomerReportData(
  orders: any[],
  currencySymbol: string,
  countryCode?: string,
  timezone?: string,
  rangeStartDate?: number,
  priorCustomerKeys?: Set<string>,
): CustomerReportOutput {
  const customerFirstOrderTime = new Map<string, number>();
  const rangeCustomerOrders = new Map<string, any[]>();
  let totalGrossPaise = 0;

  // Process all historical orders to determine each customer's first order timestamp
  for (const o of orders) {
    if (isOrderUnpaidCancelled(o)) continue; // Exclude unpaid cancelled orders from customer spend and order history

    const custKey =
      o.customerId ||
      (o.customerPhone ? o.customerPhone.trim() : null) ||
      (o.customerName ? o.customerName.trim().toLowerCase() : null) ||
      `order_${o._id}`;

    const prevFirst = customerFirstOrderTime.get(custKey);
    if (!prevFirst || o.createdAt < prevFirst) {
      customerFirstOrderTime.set(custKey, o.createdAt);
    }

    const custOrders = rangeCustomerOrders.get(custKey) || [];
    custOrders.push(o);
    rangeCustomerOrders.set(custKey, custOrders);

    totalGrossPaise += o.totalAmount || 0;
  }

  const uniqueCustomersCount = rangeCustomerOrders.size;
  let newCustomersCount = 0;
  let repeatCustomersCount = 0;

  const minRangeTs = rangeStartDate || 0;

  Array.from(rangeCustomerOrders.entries()).forEach(([custKey, cOrders]) => {
    const firstSeen = customerFirstOrderTime.get(custKey) || 0;
    const hasPriorHistory = Boolean(priorCustomerKeys && priorCustomerKeys.has(custKey));
    // If customer has prior orders before range or first seen before range start -> repeat customer
    if (hasPriorHistory || (minRangeTs > 0 && firstSeen < minRangeTs) || cOrders.length > 1) {
      repeatCustomersCount += 1;
    } else {
      newCustomersCount += 1;
    }
  });

  const overallRetentionRate =
    uniqueCustomersCount > 0
      ? `${((repeatCustomersCount / uniqueCustomersCount) * 100).toFixed(1)}%`
      : "0.0%";

  const avgSpendPaise =
    uniqueCustomersCount > 0
      ? Math.round(totalGrossPaise / uniqueCustomersCount)
      : 0;

  // Group by day for table_data
  const dailyCustomerMap = new Map<
    string,
    {
      dateLabel: string;
      rawDate: number;
      dayCustomerKeys: Set<string>;
      dayGrossPaise: number;
    }
  >();

  for (const o of orders) {
    const dateKey = formatStoreDate(o.createdAt, countryCode, timezone);
    const custKey =
      o.customerId ||
      (o.customerPhone ? o.customerPhone.trim() : null) ||
      (o.customerName ? o.customerName.trim().toLowerCase() : null) ||
      `order_${o._id}`;

    const existing = dailyCustomerMap.get(dateKey) || {
      dateLabel: dateKey,
      rawDate: o.createdAt,
      dayCustomerKeys: new Set<string>(),
      dayGrossPaise: 0,
    };

    existing.dayCustomerKeys.add(custKey);
    existing.dayGrossPaise += o.totalAmount || 0;
    dailyCustomerMap.set(dateKey, existing);
  }

  const sortedDays = Array.from(dailyCustomerMap.values()).sort(
    (a, b) => b.rawDate - a.rawDate,
  );

  const table_data = sortedDays.map((d) => {
    const dayTotalCustomers = d.dayCustomerKeys.size;
    let dayNew = 0;
    let dayRepeat = 0;

    Array.from(d.dayCustomerKeys).forEach((ck) => {
      const firstSeen = customerFirstOrderTime.get(ck) || 0;
      const hasPriorHistory = Boolean(priorCustomerKeys && priorCustomerKeys.has(ck));
      // If customer had prior orders or first ordered before today's start date -> repeat customer
      if (hasPriorHistory || (minRangeTs > 0 && firstSeen < minRangeTs) || firstSeen < d.rawDate - 86400000) {
        dayRepeat += 1;
      } else {
        dayNew += 1;
      }
    });

    const dayRetention =
      dayTotalCustomers > 0
        ? `${((dayRepeat / dayTotalCustomers) * 100).toFixed(1)}%`
        : "0.0%";

    const dayAvgSpend =
      dayTotalCustomers > 0 ? Math.round(d.dayGrossPaise / dayTotalCustomers) : 0;

    return {
      date: d.dateLabel,
      total_customers: dayTotalCustomers,
      new_customers: dayNew,
      repeat_customers: dayRepeat,
      retention_rate: dayRetention,
      avg_customer_spend: formatPriceWithSymbol(dayAvgSpend, currencySymbol, countryCode, true),
    };
  });

  return {
    total_customers: uniqueCustomersCount,
    retention_rate: overallRetentionRate,
    avg_customer_spend: formatPriceWithSymbol(avgSpendPaise, currencySymbol, countryCode, true),
    new_customers: newCustomersCount,
    table_data,
    length: table_data.length,
  };
}

// ==========================================
// 4. MENU REPORT CALCULATION
// ==========================================

export interface MenuReportOutput {
  salesByItem: {
    total_items_sold: number;
    top_performing_item: { item_name: string } | null;
    least_performing_item: { item_name: string } | null;
    avg_item_price: string;
    top_performing_items: Array<{
      item_name: string;
      category: string;
      item_price: string;
      units_sold: number;
      total_sales: string;
      sales_percentage: string;
    }>;
    least_performing_items: Array<{
      item_name: string;
      category: string;
      item_price: string;
      units_sold: number;
      total_sales: string;
      sales_percentage: string;
    }>;
    table_data: Array<{
      item_name: string;
      item_price: string;
      gross_sales: string;
      item_sold: number;
      tax_collected: string;
      net_sales: string;
    }>;
    length: number;
  };
  salesByCategory: {
    total_items_sold_by_category: number;
    top_category: string;
    least_category: string;
    avg_item_price_by_category: string;
    table_data: Array<{
      category_name: string;
      items_sold: number;
      gross_sales: string;
      tax_collected: string;
      net_sales: string;
      avg_item_price: string;
    }>;
    length: number;
  };
}

export function computeMenuReportData(
  orders: any[],
  allItems: any[],
  allCategories: any[],
  currencySymbol: string,
  countryCode?: string,
): MenuReportOutput {
  // Build category lookup maps
  const itemCategoryMap = new Map<string, string>();
  const categoryNameMap = new Map<string, string>();

  // 1. Process allCategories (including hierarchical categories with nested items)
  for (const c of allCategories || []) {
    const cId = c._id || c.id;
    const cName = c.name || c.category_name;
    if (cId && cName) {
      categoryNameMap.set(String(cId), cName);
    }
    if (c.items && Array.isArray(c.items)) {
      for (const it of c.items) {
        const itemObj = it.item || it;
        if (itemObj && cName) {
          if (itemObj._id) itemCategoryMap.set(String(itemObj._id), cName);
          if (itemObj.id) itemCategoryMap.set(String(itemObj.id), cName);
          if (itemObj.name) itemCategoryMap.set(itemObj.name.toLowerCase().trim(), cName);
        }
      }
    }
  }

  // 2. Process allItems
  for (const item of allItems || []) {
    const catName =
      item.categoryName ||
      (item.categoryId ? categoryNameMap.get(String(item.categoryId)) : null);
    if (catName) {
      if (item._id) itemCategoryMap.set(String(item._id), catName);
      if (item.id) itemCategoryMap.set(String(item.id), catName);
      if (item.name) itemCategoryMap.set(item.name.toLowerCase().trim(), catName);
    }
  }

  // Aggregate items sold
  const itemStatsMap = new Map<
    string,
    {
      itemName: string;
      categoryName: string;
      itemPricePaise: number;
      unitsSold: number;
      grossPaise: number;
      taxPaise: number;
      netPaise: number;
    }
  >();

  let totalItemsSold = 0;
  let totalMenuGrossPaise = 0;

  for (const order of orders) {
    const isCancelled =
      Boolean(order.isRejected) ||
      order.orderStatus === "Cancelled" ||
      order.status === "Cancelled" ||
      (order.orderStatusName || "").toLowerCase().includes("cancel");
    if (isCancelled) continue; // Exclude cancelled orders from items sold
    if (!order.items || !Array.isArray(order.items)) continue;

    // Approximate tax proportion per item based on order tax ratio
    const orderTaxRatio =
      order.totalAmount > 0 ? (order.taxTotal || 0) / order.totalAmount : 0;

    for (const item of order.items) {
      const qty = item.quantity || 1;
      const unitPrice = item.itemPrice || item.price || 0;
      const gross = item.totalPrice || (unitPrice * qty);
      const tax = Math.round(gross * orderTaxRatio);
      const net = Math.max(0, gross - tax);

      totalItemsSold += qty;
      totalMenuGrossPaise += gross;

      const normName = (item.itemName || item.name || "Item").trim();
      const cat =
        item.categoryName ||
        item.category ||
        itemCategoryMap.get(item.itemId || item._id) ||
        itemCategoryMap.get(normName.toLowerCase()) ||
        "General";

      const existing = itemStatsMap.get(normName) || {
        itemName: normName,
        categoryName: cat,
        itemPricePaise: unitPrice || (qty > 0 ? Math.round(gross / qty) : 0),
        unitsSold: 0,
        grossPaise: 0,
        taxPaise: 0,
        netPaise: 0,
      };

      existing.unitsSold += qty;
      existing.grossPaise += gross;
      existing.taxPaise += tax;
      existing.netPaise += net;
      if (unitPrice > 0) {
        existing.itemPricePaise = unitPrice;
      }
      itemStatsMap.set(normName, existing);
    }
  }

  const allItemStats = Array.from(itemStatsMap.values());

  // Sort descending by total sales
  const sortedBySalesDesc = [...allItemStats].sort(
    (a, b) => b.grossPaise - a.grossPaise,
  );
  // Sort ascending by total sales for least performing
  const sortedBySalesAsc = [...allItemStats].sort(
    (a, b) => a.grossPaise - b.grossPaise,
  );

  const topPerformingItem = sortedBySalesDesc.length > 0 ? { item_name: sortedBySalesDesc[0].itemName } : null;
  const leastPerformingItem = sortedBySalesAsc.length > 0 ? { item_name: sortedBySalesAsc[0].itemName } : null;

  const avgItemPricePaise =
    totalItemsSold > 0 ? Math.round(totalMenuGrossPaise / totalItemsSold) : 0;

  // Format Top 5 Performing Items Table
  const top_performing_items = sortedBySalesDesc.slice(0, 5).map((it) => ({
    item_name: it.itemName,
    category: it.categoryName,
    item_price: formatPriceWithSymbol(it.itemPricePaise, currencySymbol, countryCode, true),
    units_sold: it.unitsSold,
    total_sales: formatPriceWithSymbol(it.grossPaise, currencySymbol, countryCode, true),
    sales_percentage:
      totalMenuGrossPaise > 0
        ? `${((it.grossPaise / totalMenuGrossPaise) * 100).toFixed(1)}%`
        : "0.0%",
  }));

  // Format Least 5 Performing Items Table
  const least_performing_items = sortedBySalesAsc.slice(0, 5).map((it) => ({
    item_name: it.itemName,
    category: it.categoryName,
    item_price: formatPriceWithSymbol(it.itemPricePaise, currencySymbol, countryCode, true),
    units_sold: it.unitsSold,
    total_sales: formatPriceWithSymbol(it.grossPaise, currencySymbol, countryCode, true),
    sales_percentage:
      totalMenuGrossPaise > 0
        ? `${((it.grossPaise / totalMenuGrossPaise) * 100).toFixed(1)}%`
        : "0.0%",
  }));

  // Full item table
  const item_table_data = sortedBySalesDesc.map((it) => ({
    item_name: it.itemName,
    item_price: formatPriceWithSymbol(it.itemPricePaise, currencySymbol, countryCode, true),
    gross_sales: formatPriceWithSymbol(it.grossPaise, currencySymbol, countryCode, true),
    item_sold: it.unitsSold,
    tax_collected: formatPriceWithSymbol(it.taxPaise, currencySymbol, countryCode, true),
    net_sales: formatPriceWithSymbol(it.netPaise, currencySymbol, countryCode, true),
  }));

  // ==========================================
  // Sub-View: Category Aggregation
  // ==========================================
  const categoryStatsMap = new Map<
    string,
    {
      categoryName: string;
      itemsSold: number;
      grossPaise: number;
      taxPaise: number;
      netPaise: number;
    }
  >();

  for (const it of allItemStats) {
    const cat = it.categoryName;
    const existing = categoryStatsMap.get(cat) || {
      categoryName: cat,
      itemsSold: 0,
      grossPaise: 0,
      taxPaise: 0,
      netPaise: 0,
    };
    existing.itemsSold += it.unitsSold;
    existing.grossPaise += it.grossPaise;
    existing.taxPaise += it.taxPaise;
    existing.netPaise += it.netPaise;
    categoryStatsMap.set(cat, existing);
  }

  const allCategoryStats = Array.from(categoryStatsMap.values());
  const sortedCategoriesDesc = [...allCategoryStats].sort(
    (a, b) => b.grossPaise - a.grossPaise,
  );
  const sortedCategoriesAsc = [...allCategoryStats].sort(
    (a, b) => a.grossPaise - b.grossPaise,
  );

  const topCategoryName = sortedCategoriesDesc.length > 0 ? sortedCategoriesDesc[0].categoryName : "-";
  const leastCategoryName = sortedCategoriesAsc.length > 0 ? sortedCategoriesAsc[0].categoryName : "-";

  const category_table_data = sortedCategoriesDesc.map((c) => {
    const avgPricePaise =
      c.itemsSold > 0 ? Math.round(c.grossPaise / c.itemsSold) : 0;
    return {
      category_name: c.categoryName,
      items_sold: c.itemsSold,
      gross_sales: formatPriceWithSymbol(c.grossPaise, currencySymbol, countryCode, true),
      tax_collected: formatPriceWithSymbol(c.taxPaise, currencySymbol, countryCode, true),
      net_sales: formatPriceWithSymbol(c.netPaise, currencySymbol, countryCode, true),
      avg_item_price: formatPriceWithSymbol(avgPricePaise, currencySymbol, countryCode, true),
    };
  });

  return {
    salesByItem: {
      total_items_sold: totalItemsSold,
      top_performing_item: topPerformingItem,
      least_performing_item: leastPerformingItem,
      avg_item_price: formatPriceWithSymbol(avgItemPricePaise, currencySymbol, countryCode, true),
      top_performing_items,
      least_performing_items,
      table_data: item_table_data,
      length: item_table_data.length,
    },
    salesByCategory: {
      total_items_sold_by_category: totalItemsSold,
      top_category: topCategoryName,
      least_category: leastCategoryName,
      avg_item_price_by_category: formatPriceWithSymbol(avgItemPricePaise, currencySymbol, countryCode, true),
      table_data: category_table_data,
      length: category_table_data.length,
    },
  };
}

// ==========================================
// 5. OPERATIONAL REPORT CALCULATION
// ==========================================

export interface OperationalReportOutput {
  paymentReport: {
    total_payments_count: number;
    total_payment_value: string;
    most_used_mode: string;
    least_used_mode: string;
    payment_mode_breakdown: Array<{
      mode: string;
      total_payments: number;
      percentage_of_total_payments: string;
      total_payment_value: string;
      avg_transaction_value: string;
    }>;
    table_data: Array<{
      date: string;
      total_payments: number;
      total_payments_value: string;
      avg_used_payment_mode: string;
      percentage_of_total_payments: string;
      avg_transaction_value: string;
    }>;
    length: number;
  };
  restaurantTableReport: {
    most_occupied_layout: string;
    layout_with_most_free_tables: string;
    avg_occupancy_duration: string;
    total_occupied_percentage: string;
    layouts_breakdown: Array<{
      layout: string;
      total_tables: number;
      total_orders_served: number;
      occupancy_rate: string;
      peak_occupancy_time: string;
      layout_revenue_contribution: string;
      average_order_value: string;
    }>;
    table_data: Array<{
      date: string;
      most_used_table: string;
      layout: string;
      total_orders_served: number;
      avg_occupancy_duration: string;
      avg_occupancy_rate: string;
      avg_order_value: string;
    }>;
    length: number;
  };
  orderProcessReport: {
    total_orders_received: number;
    avg_time_in_each_process: string;
    order_processing_efficiency: string;
    table_data: Array<{
      date: string;
      total_orders_recieved: number;
      avg_time_in_each_process: string;
      order_processing_efficiency: string;
    }>;
    length: number;
  };
}

export function computeOperationalReportData(
  orders: any[],
  tables: any[],
  layouts: any[],
  processes: any[],
  currencySymbol: string,
  countryCode?: string,
  timezone?: string,
  operationTiming?: any,
): OperationalReportOutput {
  // ------------------------------------------
  // A. PAYMENT MODE BREAKDOWN
  // ------------------------------------------
  const modeStatsMap = new Map<
    string,
    {
      modeName: string;
      txCount: number;
      totalValuePaise: number;
    }
  >();

  const dailyPaymentMap = new Map<
    string,
    {
      dateLabel: string;
      rawDate: number;
      totalCount: number;
      totalValuePaise: number;
      modeCounts: Record<string, number>;
    }
  >();

  let totalPaymentsCount = 0;
  let totalPaymentsValuePaise = 0;

  for (const o of orders) {
    if (isOrderUnpaidCancelled(o)) continue;
    if (
      o.paymentStatus !== "Paid" &&
      o.paymentStatus !== "Partially Refunded" &&
      o.paymentStatus !== "Refunded" &&
      !isOrderRefunded(o) &&
      !o.isCompleted
    ) {
      continue;
    }

    const val = o.totalAmount || 0;
    const dateKey = formatStoreDate(o.createdAt, countryCode, timezone);

    if (o.payments && Array.isArray(o.payments) && o.payments.length > 0) {
      for (const p of o.payments) {
        const isDebit = p.paymentType === "Debit";
        const pMode = p.paymentModeName || p.mode || p.paymentMode || o.paymentMode || o.paymentMethod || "Cash";
        const pVal = isDebit
          ? -(p.refundAmount || p.amount || 0)
          : (p.payAmount !== undefined ? p.payAmount : (p.amount || 0));

        if (!isDebit) {
          totalPaymentsCount += 1;
        }
        totalPaymentsValuePaise += pVal;

        const existingMode = modeStatsMap.get(pMode) || {
          modeName: pMode,
          txCount: 0,
          totalValuePaise: 0,
        };
        if (!isDebit) {
          existingMode.txCount += 1;
        }
        existingMode.totalValuePaise += pVal;
        modeStatsMap.set(pMode, existingMode);

        const existingDay = dailyPaymentMap.get(dateKey) || {
          dateLabel: dateKey,
          rawDate: o.createdAt,
          totalCount: 0,
          totalValuePaise: 0,
          modeCounts: {} as Record<string, number>,
        };
        if (!isDebit) {
          existingDay.totalCount += 1;
          existingDay.modeCounts[pMode] = (existingDay.modeCounts[pMode] || 0) + 1;
        }
        existingDay.totalValuePaise += pVal;
        dailyPaymentMap.set(dateKey, existingDay);
      }
    } else {
      const mode = o.paymentMode || o.paymentMethod || o.tenderType || "Cash";
      const orderRef = getOrderRefundAmount(o);
      const netVal = val - orderRef;

      totalPaymentsCount += 1;
      totalPaymentsValuePaise += netVal;

      const existingMode = modeStatsMap.get(mode) || {
        modeName: mode,
        txCount: 0,
        totalValuePaise: 0,
      };
      existingMode.txCount += 1;
      existingMode.totalValuePaise += netVal;
      modeStatsMap.set(mode, existingMode);

      const existingDay = dailyPaymentMap.get(dateKey) || {
        dateLabel: dateKey,
        rawDate: o.createdAt,
        totalCount: 0,
        totalValuePaise: 0,
        modeCounts: {} as Record<string, number>,
      };
      existingDay.totalCount += 1;
      existingDay.totalValuePaise += netVal;
      existingDay.modeCounts[mode] = (existingDay.modeCounts[mode] || 0) + 1;
      dailyPaymentMap.set(dateKey, existingDay);
    }
  }

  const allModes = Array.from(modeStatsMap.values()).sort(
    (a, b) => b.txCount - a.txCount,
  );
  const mostUsedMode = allModes.length > 0 ? allModes[0].modeName : "-";
  const leastUsedMode =
    allModes.length > 0 ? allModes[allModes.length - 1].modeName : "-";

  const payment_mode_breakdown = allModes.map((m) => {
    const pct =
      totalPaymentsCount > 0
        ? `${((m.txCount / totalPaymentsCount) * 100).toFixed(1)}%`
        : "0.0%";
    const avgPaise = m.txCount > 0 ? Math.round(m.totalValuePaise / m.txCount) : 0;
    return {
      mode: m.modeName,
      total_payments: m.txCount,
      percentage_of_total_payments: pct,
      total_payment_value: formatPriceWithSymbol(m.totalValuePaise, currencySymbol, countryCode, true),
      avg_transaction_value: formatPriceWithSymbol(avgPaise, currencySymbol, countryCode, true),
    };
  });

  const sortedPaymentDays = Array.from(dailyPaymentMap.values()).sort(
    (a, b) => b.rawDate - a.rawDate,
  );

  const daily_payment_table = sortedPaymentDays.map((d) => {
    let topMode = "-";
    let topModeCount = 0;
    for (const [m, c] of Object.entries(d.modeCounts)) {
      if (c > topModeCount) {
        topModeCount = c;
        topMode = m;
      }
    }
    const modePct =
      d.totalCount > 0
        ? `${((topModeCount / d.totalCount) * 100).toFixed(1)}%`
        : "0.0%";
    const avgPaise =
      d.totalCount > 0 ? Math.round(d.totalValuePaise / d.totalCount) : 0;

    return {
      date: d.dateLabel,
      total_payments: d.totalCount,
      total_payments_value: formatPriceWithSymbol(d.totalValuePaise, currencySymbol, countryCode, true),
      avg_used_payment_mode: topMode,
      percentage_of_total_payments: modePct,
      avg_transaction_value: formatPriceWithSymbol(avgPaise, currencySymbol, countryCode, true),
    };
  });

  // ------------------------------------------
  // B. RESTAURANT TABLES BREAKDOWN
  // ------------------------------------------
  const defaultLayoutName =
    layouts && layouts.length > 0 ? layouts[0].name : "Dining Floor";

  const layoutNameMap = new Map<string, string>();
  for (const l of layouts || []) {
    if (!l) continue;
    if (l._id) layoutNameMap.set(String(l._id), l.name);
    if ((l as any).legacyId) layoutNameMap.set(String((l as any).legacyId), l.name);
    if (l.name) {
      layoutNameMap.set(l.name.trim().toLowerCase(), l.name);
    }
  }

  const tableToLayoutMap = new Map<string, string>();
  for (const t of tables || []) {
    if (!t || t.deletedAt) continue;
    const lName =
      (t.layoutId && layoutNameMap.get(String(t.layoutId))) || defaultLayoutName;
    if (t._id) tableToLayoutMap.set(String(t._id), lName);
    if ((t as any).legacyId) tableToLayoutMap.set(String((t as any).legacyId), lName);
    if (t.tableNumber !== undefined && t.tableNumber !== null) {
      const numStr = String(t.tableNumber).trim();
      tableToLayoutMap.set(numStr, lName);
      tableToLayoutMap.set(numStr.toLowerCase(), lName);
      tableToLayoutMap.set(`table ${numStr}`.toLowerCase(), lName);
      tableToLayoutMap.set(`table${numStr}`.toLowerCase(), lName);
    }
    if ((t as any).name) {
      const nameStr = String((t as any).name).trim().toLowerCase();
      tableToLayoutMap.set(nameStr, lName);
    }
  }

  const layoutStatsMap = new Map<
    string,
    {
      layoutName: string;
      tablesCount: number;
      ordersServed: number;
      revenuePaise: number;
      hourlyOccupancy: number[];
    }
  >();

  // Initialize layoutStatsMap exclusively for configured layouts (or default if none configured)
  if (layouts && layouts.length > 0) {
    for (const l of layouts) {
      if (l && !l.deletedAt && l.name) {
        layoutStatsMap.set(l.name, {
          layoutName: l.name,
          tablesCount: 0,
          ordersServed: 0,
          revenuePaise: 0,
          hourlyOccupancy: new Array(24).fill(0),
        });
      }
    }
  } else {
    layoutStatsMap.set(defaultLayoutName, {
      layoutName: defaultLayoutName,
      tablesCount: 0,
      ordersServed: 0,
      revenuePaise: 0,
      hourlyOccupancy: new Array(24).fill(0),
    });
  }

  // Count active tables per layout
  for (const t of tables || []) {
    if (!t || t.deletedAt) continue;
    const lName =
      (t.layoutId && layoutNameMap.get(String(t.layoutId))) || defaultLayoutName;
    const existing = layoutStatsMap.get(lName);
    if (existing) {
      existing.tablesCount += 1;
    } else if (layoutStatsMap.has(defaultLayoutName)) {
      layoutStatsMap.get(defaultLayoutName)!.tablesCount += 1;
    } else {
      layoutStatsMap.set(lName, {
        layoutName: lName,
        tablesCount: 1,
        ordersServed: 0,
        revenuePaise: 0,
        hourlyOccupancy: new Array(24).fill(0),
      });
    }
  }

  // If a layout has 0 assigned tables but restaurant has tables, assign at least 1 table
  const totalTablesCount = tables ? tables.filter((t) => !t.deletedAt).length : 0;
  for (const item of Array.from(layoutStatsMap.values())) {
    if (item.tablesCount === 0 && totalTablesCount > 0) {
      item.tablesCount = totalTablesCount;
    }
  }

  // Robust layout resolver for an order
  const resolveOrderLayout = (o: any): string => {
    // 1. By order layoutName if it matches a known layout
    if (o.layoutName) {
      const trimmed = String(o.layoutName).trim();
      const canonical = layoutNameMap.get(trimmed.toLowerCase());
      if (canonical && layoutStatsMap.has(canonical)) return canonical;
      if (layoutStatsMap.has(trimmed)) return trimmed;
    }

    // 2. By order tableId
    if (o.tableId) {
      const match = tableToLayoutMap.get(String(o.tableId));
      if (match && layoutStatsMap.has(match)) return match;
    }

    // 3. By nested table object
    if (o.table) {
      if (o.table.layoutName) {
        const canonical = layoutNameMap.get(String(o.table.layoutName).trim().toLowerCase());
        if (canonical && layoutStatsMap.has(canonical)) return canonical;
      }
      if (o.table.layoutId) {
        const match = layoutNameMap.get(String(o.table.layoutId));
        if (match && layoutStatsMap.has(match)) return match;
      }
      if (o.table._id && tableToLayoutMap.has(String(o.table._id))) {
        return tableToLayoutMap.get(String(o.table._id))!;
      }
      if (o.table.id && tableToLayoutMap.has(String(o.table.id))) {
        return tableToLayoutMap.get(String(o.table.id))!;
      }
      if (o.table.number !== undefined && o.table.number !== null) {
        const numStr = String(o.table.number).trim().toLowerCase();
        if (tableToLayoutMap.has(numStr)) return tableToLayoutMap.get(numStr)!;
      }
      if (o.table.name) {
        const nameStr = String(o.table.name).trim().toLowerCase();
        if (tableToLayoutMap.has(nameStr)) return tableToLayoutMap.get(nameStr)!;
      }
    }

    // 4. By order tableName or tableNumber
    const tblCandidate = o.tableName || o.tableNumber;
    if (tblCandidate !== undefined && tblCandidate !== null) {
      const str = String(tblCandidate).trim().toLowerCase();
      if (tableToLayoutMap.has(str)) return tableToLayoutMap.get(str)!;
      const cleanNum = str.replace(/^table\s*[-_]?/i, "").trim();
      if (cleanNum && tableToLayoutMap.has(cleanNum)) return tableToLayoutMap.get(cleanNum)!;
    }

    // 5. Fallback to store's configured active layout
    return defaultLayoutName;
  };

  let totalDineInOrders = 0;
  let totalDineInRevenuePaise = 0;
  let totalDineInDurationSecs = 0;
  let dineInDurationCount = 0;
  const usedTableIdentifiers = new Set<string>();

  const dailyTableMap = new Map<
    string,
    {
      dateLabel: string;
      rawDate: number;
      ordersServed: number;
      revenuePaise: number;
      durationSecs: number;
      durationCount: number;
      tableCounts: Record<string, number>;
      layoutCounts: Record<string, number>;
    }
  >();

  for (const o of orders) {
    const hasTable = o.tableId || o.table?.number || o.tableName || o.tableNumber;
    if (o.orderType !== "DineIn" && !hasTable) continue;

    totalDineInOrders += 1;
    totalDineInRevenuePaise += o.totalAmount || 0;

    const tblId = o.tableId || o.table?.number || o.tableName || o.tableNumber;
    if (tblId) usedTableIdentifiers.add(String(tblId));

    let duration = 0;
    const startTime = o.createdAt || o._creationTime;
    const endTime =
      o.completedAt ||
      o.deliveredAt ||
      o.closedAt ||
      o.settledAt ||
      (o.isCompleted && o.updatedAt > startTime ? o.updatedAt : null);

    if (startTime && endTime && endTime > startTime) {
      duration = Math.max(60, Math.floor((endTime - startTime) / 1000));
      totalDineInDurationSecs += duration;
      dineInDurationCount += 1;
    }

    const rawTbl = o.table?.number || o.tableName || o.tableNumber || (o.tableId ? String(o.tableId) : "1");
    let tNumber = String(rawTbl).trim();
    if (!tNumber.toLowerCase().startsWith("table")) {
      tNumber = `Table ${tNumber}`;
    }

    const lName = resolveOrderLayout(o);

    const existingLayout = layoutStatsMap.get(lName) || {
      layoutName: lName,
      tablesCount: totalTablesCount > 0 ? totalTablesCount : 1,
      ordersServed: 0,
      revenuePaise: 0,
      hourlyOccupancy: new Array(24).fill(0),
    };
    existingLayout.ordersServed += 1;
    existingLayout.revenuePaise += o.totalAmount || 0;
    const h = getStoreHourInTz(o.createdAt, countryCode, timezone);
    existingLayout.hourlyOccupancy[h] += 1;
    layoutStatsMap.set(lName, existingLayout);

    const dateKey = formatStoreDate(o.createdAt, countryCode, timezone);
    const existingDay = dailyTableMap.get(dateKey) || {
      dateLabel: dateKey,
      rawDate: o.createdAt,
      ordersServed: 0,
      revenuePaise: 0,
      durationSecs: 0,
      durationCount: 0,
      tableCounts: {} as Record<string, number>,
      layoutCounts: {} as Record<string, number>,
    };
    existingDay.ordersServed += 1;
    existingDay.revenuePaise += o.totalAmount || 0;
    if (duration > 0) {
      existingDay.durationSecs += duration;
      existingDay.durationCount += 1;
    }
    existingDay.tableCounts[tNumber] = (existingDay.tableCounts[tNumber] || 0) + 1;
    existingDay.layoutCounts[lName] = (existingDay.layoutCounts[lName] || 0) + 1;
    dailyTableMap.set(dateKey, existingDay);
  }

  const allLayoutsList = Array.from(layoutStatsMap.values()).sort(
    (a, b) => b.ordersServed - a.ordersServed,
  );

  const mostOccupiedLayout =
    allLayoutsList.length > 0
      ? allLayoutsList[0].ordersServed > 0
        ? allLayoutsList[0].layoutName
        : (layouts && layouts[0]?.name) || allLayoutsList[0].layoutName
      : "-";

  // Free tables per layout
  const freeTablesPerLayout: Record<string, number> = {};
  for (const t of tables || []) {
    if (!t || t.deletedAt) continue;
    const lName =
      (t.layoutId && layoutNameMap.get(String(t.layoutId))) || defaultLayoutName;
    if (!t.currentOrderId) {
      freeTablesPerLayout[lName] = (freeTablesPerLayout[lName] || 0) + 1;
    }
  }
  let layoutWithMostFree = "-";
  let maxFreeCount = -1;
  for (const [l, count] of Object.entries(freeTablesPerLayout)) {
    if (count > maxFreeCount) {
      maxFreeCount = count;
      layoutWithMostFree = l;
    }
  }
  if (layoutWithMostFree === "-" && allLayoutsList.length > 0) {
    layoutWithMostFree = allLayoutsList[0].layoutName;
  }

  const avgOccupancyDuration =
    dineInDurationCount > 0
      ? formatDeliveryTime(Math.round(totalDineInDurationSecs / dineInDurationCount))
      : "-";

  const occupiedTablesCount = tables
    ? tables.filter((t) => !t.deletedAt && Boolean(t.currentOrderId)).length
    : 0;

  // Floor occupancy: percentage of total tables utilized during the selected period (or live occupied)
  const activeOrUsedTables = Math.max(occupiedTablesCount, usedTableIdentifiers.size);
  const totalOccupiedPct =
    totalTablesCount > 0
      ? `${Math.min(100, Math.round((activeOrUsedTables / totalTablesCount) * 100))}.0%`
      : totalDineInOrders > 0
      ? "100.0%"
      : "0.0%";

  const { validHours: layoutValidHours } = parseOperationalHourRange(operationTiming);
  const layouts_breakdown = allLayoutsList.map((l) => {
    let peakH = -1;
    let maxHCount = 0;
    for (let h = 0; h < 24; h++) {
      if (layoutValidHours.has(h) && l.hourlyOccupancy[h] > maxHCount) {
        maxHCount = l.hourlyOccupancy[h];
        peakH = h;
      }
    }
    const peakTime = peakH !== -1 && maxHCount > 0 ? formatHourWindow(peakH) : "-";
    const revContribution =
      totalDineInRevenuePaise > 0
        ? `${((l.revenuePaise / totalDineInRevenuePaise) * 100).toFixed(1)}%`
        : "0.0%";
    const aov =
      l.ordersServed > 0 ? Math.round(l.revenuePaise / l.ordersServed) : 0;
    const occRate =
      l.tablesCount > 0
        ? `${Math.min(100, Math.round((l.ordersServed / (l.tablesCount * 4)) * 100))}%`
        : "0.0%";

    return {
      layout: l.layoutName,
      total_tables: l.tablesCount,
      total_orders_served: l.ordersServed,
      occupancy_rate: occRate,
      peak_occupancy_time: peakTime,
      layout_revenue_contribution: revContribution,
      average_order_value: formatPriceWithSymbol(aov, currencySymbol, countryCode, true),
    };
  });

  const sortedTableDays = Array.from(dailyTableMap.values()).sort(
    (a, b) => b.rawDate - a.rawDate,
  );

  const daily_table_data = sortedTableDays.map((d) => {
    let topTable = "-";
    let topTCount = 0;
    for (const [t, c] of Object.entries(d.tableCounts)) {
      if (c > topTCount) {
        topTCount = c;
        topTable = t;
      }
    }
    let topL = "-";
    let topLCount = 0;
    for (const [l, c] of Object.entries(d.layoutCounts)) {
      if (c > topLCount) {
        topLCount = c;
        topL = l;
      }
    }
    const dayAvgDuration =
      d.durationCount > 0
        ? formatDeliveryTime(Math.round(d.durationSecs / d.durationCount))
        : "-";
    const dayAov =
      d.ordersServed > 0 ? Math.round(d.revenuePaise / d.ordersServed) : 0;
    const dayOccRate =
      totalTablesCount > 0
        ? `${Math.min(100, Math.round((d.ordersServed / totalTablesCount) * 100))}%`
        : "100%";

    return {
      date: d.dateLabel,
      most_used_table: topTable !== "-" ? topTable : "Table 1",
      layout: topL !== "-" ? topL : defaultLayoutName,
      total_orders_served: d.ordersServed,
      avg_occupancy_duration: dayAvgDuration,
      avg_occupancy_rate: dayOccRate,
      avg_order_value: formatPriceWithSymbol(dayAov, currencySymbol, countryCode, true),
    };
  });

  // ------------------------------------------
  // C. ORDER PROCESSES
  // ------------------------------------------
  const activeProcesses =
    processes && Array.isArray(processes)
      ? processes.filter((p: any) => !p.deletedAt && p.published !== false)
      : [];
  const processStepsCount =
    activeProcesses.length > 0 ? activeProcesses.length : 4;

  let totalLifecycleSecs = 0;
  let durationSampleCount = 0;
  let completedOrdersCount = 0;
  let nonCancelledOrdersCount = 0;

  const dailyProcessMap = new Map<
    string,
    {
      dateLabel: string;
      rawDate: number;
      totalOrders: number;
      completedOrders: number;
      durationSecs: number;
      durationCount: number;
    }
  >();

  for (const o of orders) {
    const isCancelledOrRejected =
      o.isRejected === true ||
      o.orderStatusName === "Cancelled" ||
      o.orderStatusName === "Rejected" ||
      o.orderStatus === "Cancelled";

    if (!isCancelledOrRejected) {
      nonCancelledOrdersCount += 1;
    }

    const isCompleted =
      o.isCompleted === true ||
      o.orderStatusName === "Completed" ||
      o.orderStatusName === "Delivered" ||
      o.orderStatusName === "Served" ||
      o.orderStatus === "Completed" ||
      o.orderStatus === "Delivered" ||
      o.orderStatus === "Served" ||
      Boolean(o.completedAt) ||
      Boolean(o.deliveredAt);

    const startTime = o.createdAt || o._creationTime;
    const endTime =
      o.completedAt ||
      o.deliveredAt ||
      o.closedAt ||
      o.settledAt ||
      (isCompleted && o.updatedAt && o.updatedAt > startTime ? o.updatedAt : null);

    let dur = 0;
    if (startTime && endTime && endTime >= startTime) {
      dur = Math.max(0, Math.floor((endTime - startTime) / 1000));
    }

    if (isCompleted) {
      completedOrdersCount += 1;
      if (dur > 0) {
        totalLifecycleSecs += dur;
        durationSampleCount += 1;
      }
    }

    const orderTime = o.createdAt || o._creationTime || Date.now();
    const dateKey = formatStoreDate(orderTime, countryCode, timezone);
    const existingDay = dailyProcessMap.get(dateKey) || {
      dateLabel: dateKey,
      rawDate: orderTime,
      totalOrders: 0,
      completedOrders: 0,
      durationSecs: 0,
      durationCount: 0,
    };
    existingDay.totalOrders += 1;
    if (isCompleted) {
      existingDay.completedOrders += 1;
      if (dur > 0) {
        existingDay.durationSecs += dur;
        existingDay.durationCount += 1;
      }
    }
    dailyProcessMap.set(dateKey, existingDay);
  }

  const avgProcessTimeSecs =
    durationSampleCount > 0
      ? Math.max(1, Math.round(totalLifecycleSecs / durationSampleCount / processStepsCount))
      : null;

  const overallEfficiency =
    orders.length > 0
      ? `${Math.min(100, Math.round((completedOrdersCount / (nonCancelledOrdersCount > 0 ? nonCancelledOrdersCount : orders.length)) * 100))}.0%`
      : "100.0%";

  const sortedProcessDays = Array.from(dailyProcessMap.values()).sort(
    (a, b) => b.rawDate - a.rawDate,
  );

  const daily_process_table = sortedProcessDays.map((d) => {
    const dayAvgStep =
      d.durationCount > 0
        ? formatDeliveryTime(
            Math.max(1, Math.round(d.durationSecs / d.durationCount / processStepsCount)),
          )
        : "-";
    const dayEff =
      d.totalOrders > 0
        ? `${Math.min(100, Math.round((d.completedOrders / d.totalOrders) * 100))}.0%`
        : "100.0%";

    return {
      date: d.dateLabel,
      total_orders_recieved: d.totalOrders,
      avg_time_in_each_process: dayAvgStep,
      order_processing_efficiency: dayEff,
    };
  });

  return {
    paymentReport: {
      total_payments_count: totalPaymentsCount,
      total_payment_value: formatPriceWithSymbol(totalPaymentsValuePaise, currencySymbol, countryCode, true),
      most_used_mode: mostUsedMode,
      least_used_mode: leastUsedMode,
      payment_mode_breakdown,
      table_data: daily_payment_table,
      length: daily_payment_table.length,
    },
    restaurantTableReport: {
      most_occupied_layout: mostOccupiedLayout,
      layout_with_most_free_tables: layoutWithMostFree,
      avg_occupancy_duration: avgOccupancyDuration,
      total_occupied_percentage: totalOccupiedPct,
      layouts_breakdown,
      table_data: daily_table_data,
      length: daily_table_data.length,
    },
    orderProcessReport: {
      total_orders_received: orders.length,
      avg_time_in_each_process:
        avgProcessTimeSecs !== null ? formatDeliveryTime(avgProcessTimeSecs) : "-",
      order_processing_efficiency: overallEfficiency,
      table_data: daily_process_table,
      length: daily_process_table.length,
    },
  };
}


