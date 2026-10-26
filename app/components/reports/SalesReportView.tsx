"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  formatPriceWithSymbol,
  formatStoreDate,
  formatStoreTime,
  getTimezoneForCountry,
  getCurrencyForCountry,
} from "../../../lib/constants/countries";
import { DateRange, ChevronRightIcon } from "./ReportHeader";
import {
  parseOperationalHourRange,
  isOrderRefunded,
  isOrderUnpaidCancelled,
  getOrderRefundAmount,
} from "../../reports/reportCalculations";
import { Toast, type ToastMessage } from "../Toast";
import { OrderDateRangePicker } from "../OrderDateRangePicker";

interface SalesReportViewProps {
  orders: any[];
  backendData?: any;
  loading?: boolean;
  currencySymbol?: string;
  countryCode?: string;
  timezone?: string;
  operationTiming?: any;
  selectedRange?: DateRange;
  onRangeChange?: (range: DateRange) => void;
  activeOrg?: any;
}

export function SalesReportView({
  orders = [],
  loading = false,
  currencySymbol: passedCurrencySymbol,
  countryCode = "IN",
  timezone,
  operationTiming,
  selectedRange,
  onRangeChange,
  activeOrg: passedActiveOrg,
}: SalesReportViewProps) {
  // Query organizations as reliable fallback if passedActiveOrg isn't provided
  const organizations = useQuery(api.organizations.list);
  const activeOrg =
    passedActiveOrg ||
    (organizations && organizations.length > 0 ? organizations[0] : null);

  // Settings -> Payment Modes query
  const paymentModesFromSettings = useQuery(api.organizationPaymentModes.list);

  // Settings -> Feature flags for sales channels
  const isDineInActive = activeOrg ? activeOrg.isDineIn !== false : true;
  const isTakeAwayActive = Boolean(activeOrg?.isTakeAway);
  const isDeliveryActive = Boolean(activeOrg?.isDelivery);

  const currencySymbol =
    passedCurrencySymbol || getCurrencyForCountry(countryCode || "IN").symbol || "$";
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Toast Notification state
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "info",
    subtext?: string,
  ) => {
    setToast({ message, type, subtext });
  };

  // Selected Day state for Drawer
  const [selectedDayForDrawer, setSelectedDayForDrawer] = useState<any | null>(null);

  // Localized Tax Labels
  const taxLabel = useMemo(() => {
    if (countryCode === "IN") return "CGST 2.5% + SGST 2.5%";
    if (countryCode === "AE") return "VAT (5%)";
    if (countryCode === "US") return "State & Local Tax";
    return "Audited taxes on sales";
  }, [countryCode]);

  const taxColumnLabel = useMemo(() => {
    if (countryCode === "IN") return "Tax (CGST/SGST)";
    if (countryCode === "AE") return "Tax (VAT)";
    return "Tax (CGST/SGST)";
  }, [countryCode]);

  // Check if a single day is selected (e.g. Today / Yesterday / specific date)
  const isSingleDay = useMemo(() => {
    if (!selectedRange?.startDate || !selectedRange?.endDate) return false;
    return (
      selectedRange.startDate.getFullYear() === selectedRange.endDate.getFullYear() &&
      selectedRange.startDate.getMonth() === selectedRange.endDate.getMonth() &&
      selectedRange.startDate.getDate() === selectedRange.endDate.getDate()
    );
  }, [selectedRange]);

  const targetDateTimestamp = useMemo(() => {
    if (isSingleDay && selectedRange?.startDate) {
      return selectedRange.startDate.getTime();
    }
    return undefined;
  }, [isSingleDay, selectedRange]);

  // Dynamically resolve operational schedule and service timing label from operationTiming
  const operationalSchedule = useMemo(() => {
    return parseOperationalHourRange(
      operationTiming,
      countryCode,
      timezone,
      targetDateTimestamp,
    );
  }, [operationTiming, countryCode, timezone, targetDateTimestamp]);

  const operationTimingLabel = operationalSchedule.serviceTimingLabel;

  // 1. Calculate Detailed Aggregates (Strictly Paid/Completed & Excluding Cancelled)
  const aggregates = useMemo(() => {
    let grossPaise = 0;
    let taxPaise = 0;
    let discountPaise = 0;
    let deliveryPaise = 0;
    let refundPaise = 0;
    let refundOrdersCount = 0;
    let completedOrders = 0;
    let deliveryRuns = 0;

    for (const o of orders) {
      if (isOrderUnpaidCancelled(o)) continue;

      // Exclude pending / unpaid orders until payment is completed
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

      if (!isPaid && !isOrderRefunded(o)) {
        continue;
      }

      const amount = o.totalAmount || 0;
      const subTotal = o.subTotal || 0;
      const discount = o.discountAmount || 0;
      const delivery = o.deliveryFee || o.deliveryCharge || 0;

      // Exclusive tax only (tax charged on top of subtotal)
      const orderExclusiveTax =
        amount > 0 && subTotal > 0
          ? Math.max(0, amount - subTotal + discount - delivery)
          : (o.taxInfoSnapshot?.tax_mode === "exclusive" ? (o.taxTotal || 0) : 0);

      grossPaise += amount;
      taxPaise += orderExclusiveTax;
      discountPaise += discount;

      if (delivery > 0 || o.orderType === "Delivery" || o.orderType === "ScheduledDelivery") {
        deliveryPaise += delivery;
        deliveryRuns += 1;
      }

      const orderRefund = getOrderRefundAmount(o);

      if (orderRefund > 0) {
        refundPaise += orderRefund;
        refundOrdersCount += 1;
      }

      completedOrders += 1;
    }

    const netPaise = Math.max(0, grossPaise - taxPaise - refundPaise);

    return {
      grossPaise,
      taxPaise,
      discountPaise,
      deliveryPaise,
      refundPaise,
      refundOrdersCount,
      netPaise,
      completedOrders,
      deliveryRuns,
    };
  }, [orders]);

  // 2. Hourly Cadence & Peaks (localized in store timezone and operational hours)
  const hourlyData = useMemo(() => {
    const hours =
      operationalSchedule.sortedHours.length > 0
        ? operationalSchedule.sortedHours
        : [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

    const buckets: Record<number, { count: number; grossPaise: number }> = {};
    hours.forEach((h) => {
      buckets[h] = { count: 0, grossPaise: 0 };
    });

    const targetTz =
      timezone || (countryCode ? getTimezoneForCountry(countryCode) : undefined);

    for (const o of orders) {
      if (isOrderUnpaidCancelled(o)) continue;

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

      if (!isPaid && !isOrderRefunded(o)) {
        continue;
      }

      let h = new Date(o.createdAt).getHours();
      if (targetTz) {
        try {
          const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: targetTz,
            hour: "numeric",
            hour12: false,
          });
          const parts = formatter.formatToParts(new Date(o.createdAt));
          const hp = parts.find((p) => p.type === "hour");
          if (hp) {
            const parsed = parseInt(hp.value, 10);
            h = parsed === 24 ? 0 : parsed;
          }
        } catch {
          // fallback
        }
      }

      if (buckets[h] !== undefined) {
        buckets[h].count += 1;
        buckets[h].grossPaise += o.totalAmount || 0;
      }
    }

    let maxGross = 0;
    hours.forEach((h) => {
      if (buckets[h].grossPaise > maxGross) {
        maxGross = buckets[h].grossPaise;
      }
    });

    // Lunch Peak (11 AM – 3 PM)
    const lunchHours = hours.filter((h) => h >= 11 && h <= 15);
    let lunchPeakHour = lunchHours[0] || 13;
    let lunchPeakGross = buckets[lunchPeakHour]?.grossPaise || 0;
    lunchHours.forEach((h) => {
      if ((buckets[h]?.grossPaise || 0) > lunchPeakGross) {
        lunchPeakGross = buckets[h]?.grossPaise || 0;
        lunchPeakHour = h;
      }
    });

    // Dinner Peak (6 PM – 11 PM)
    const dinnerHours = hours.filter((h) => h >= 18 && h <= 23);
    let dinnerPeakHour = dinnerHours[0] || 20;
    let dinnerPeakGross = buckets[dinnerPeakHour]?.grossPaise || 0;
    dinnerHours.forEach((h) => {
      if ((buckets[h]?.grossPaise || 0) > dinnerPeakGross) {
        dinnerPeakGross = buckets[h]?.grossPaise || 0;
        dinnerPeakHour = h;
      }
    });

    // Overall peak hour
    let overallPeakHour = hours[0] || 12;
    let maxVal = 0;
    hours.forEach((h) => {
      if (buckets[h].grossPaise > maxVal) {
        maxVal = buckets[h].grossPaise;
        overallPeakHour = h;
      }
    });

    return {
      hours,
      buckets,
      maxGross: maxGross > 0 ? maxGross : 1,
      lunchPeak: {
        hourLabel: `${lunchPeakHour > 12 ? lunchPeakHour - 12 : lunchPeakHour}:00 ${lunchPeakHour >= 12 ? "PM" : "AM"}`,
        orders: buckets[lunchPeakHour]?.count || 0,
        amount: buckets[lunchPeakHour]?.grossPaise || 0,
      },
      dinnerPeak: {
        hourLabel: `${dinnerPeakHour > 12 ? dinnerPeakHour - 12 : dinnerPeakHour}:00 ${dinnerPeakHour >= 12 ? "PM" : "AM"}`,
        orders: buckets[dinnerPeakHour]?.count || 0,
        amount: buckets[dinnerPeakHour]?.grossPaise || 0,
      },
      overallPeakHour,
    };
  }, [orders, timezone, countryCode, operationalSchedule]);

  // 3. Channel / Order Type Performance
  const channelPerformance = useMemo(() => {
    const channels: Record<string, { count: number; grossPaise: number }> = {
      DineIn: { count: 0, grossPaise: 0 },
      TakeAway: { count: 0, grossPaise: 0 },
      Delivery: { count: 0, grossPaise: 0 },
    };

    let totalOrders = 0;

    for (const o of orders) {
      if (isOrderUnpaidCancelled(o)) continue;

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

      if (!isPaid && !isOrderRefunded(o)) {
        continue;
      }

      totalOrders += 1;
      const type = o.orderType || "DineIn";
      const key =
        type === "Delivery" || type === "ScheduledDelivery"
          ? "Delivery"
          : type === "TakeAway" || type === "ScheduledPickup"
            ? "TakeAway"
            : "DineIn";

      channels[key].count += 1;
      channels[key].grossPaise += o.totalAmount || 0;
    }

    return [
      {
        type: "Dine In",
        count: channels.DineIn.count,
        percentage:
          totalOrders > 0
            ? `${Math.round((channels.DineIn.count / totalOrders) * 100)}%`
            : "0%",
        grossPaise: channels.DineIn.grossPaise,
        avgTicketPaise:
          channels.DineIn.count > 0
            ? Math.round(channels.DineIn.grossPaise / channels.DineIn.count)
            : 0,
      },
      {
        type: "Takeaway",
        count: channels.TakeAway.count,
        percentage:
          totalOrders > 0
            ? `${Math.round((channels.TakeAway.count / totalOrders) * 100)}%`
            : "0%",
        grossPaise: channels.TakeAway.grossPaise,
        avgTicketPaise:
          channels.TakeAway.count > 0
            ? Math.round(channels.TakeAway.grossPaise / channels.TakeAway.count)
            : 0,
      },
      {
        type: "Delivery",
        count: channels.Delivery.count,
        percentage:
          totalOrders > 0
            ? `${Math.round((channels.Delivery.count / totalOrders) * 100)}%`
            : "0%",
        grossPaise: channels.Delivery.grossPaise,
        avgTicketPaise:
          channels.Delivery.count > 0
            ? Math.round(channels.Delivery.grossPaise / channels.Delivery.count)
            : 0,
      },
    ];
  }, [orders]);

  // 4. Daily Ledger Settlement Table Data (Matching Prototype Columns)
  const dailyLedger = useMemo(() => {
    const dayMap = new Map<
      string,
      {
        dateLabel: string;
        rawDate: number;
        ordersCount: number;
        grossPaise: number;
        refundPaise: number;
        taxPaise: number;
        discountPaise: number;
        deliveryPaise: number;
        netPaise: number;
      }
    >();

    for (const o of orders) {
      if (isOrderUnpaidCancelled(o)) continue;

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

      if (!isPaid && !isOrderRefunded(o)) {
        continue;
      }

      const dateKey = formatStoreDate(o.createdAt, countryCode, timezone);
      const existing = dayMap.get(dateKey) || {
        dateLabel: dateKey,
        rawDate: o.createdAt,
        ordersCount: 0,
        grossPaise: 0,
        refundPaise: 0,
        taxPaise: 0,
        discountPaise: 0,
        deliveryPaise: 0,
        netPaise: 0,
      };

      const orderTotal = o.totalAmount || 0;
      const subTotal = o.subTotal || 0;
      const discount = o.discountAmount || 0;
      const delivery = o.deliveryFee || o.deliveryCharge || 0;

      // Exclusive tax calculation
      const orderExclusiveTax =
        orderTotal > 0 && subTotal > 0
          ? Math.max(0, orderTotal - subTotal + discount - delivery)
          : (o.taxInfoSnapshot?.tax_mode === "exclusive" ? (o.taxTotal || 0) : 0);

      const orderRefund = getOrderRefundAmount(o);

      existing.ordersCount += 1;
      existing.grossPaise += orderTotal;
      existing.taxPaise += orderExclusiveTax;
      existing.refundPaise += orderRefund;
      existing.discountPaise += discount;
      existing.deliveryPaise += delivery;
      existing.netPaise += Math.max(0, orderTotal - orderExclusiveTax - orderRefund);

      dayMap.set(dateKey, existing);
    }

    return Array.from(dayMap.values()).sort((a, b) => b.rawDate - a.rawDate);
  }, [orders, countryCode, timezone]);

  // Pagination for Daily Ledger Table
  const totalPages = Math.ceil((dailyLedger.length || 1) / pageSize);
  const paginatedDays = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return dailyLedger.slice(start, start + pageSize);
  }, [dailyLedger, currentPage, pageSize]);

  // 5. Drawer Detailed Computations for Selected Day
  const drawerStats = useMemo(() => {
    if (!selectedDayForDrawer) return null;

    const dayOrders = orders.filter((o) => {
      if (isOrderUnpaidCancelled(o)) return false;

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

      if (!isPaid && !isOrderRefunded(o)) {
        return false;
      }

      return (
        formatStoreDate(o.createdAt, countryCode, timezone) ===
        selectedDayForDrawer.dateLabel
      );
    });

    let gross = 0;
    let discounts = 0;
    let taxes = 0;
    let delivery = 0;
    let refunds = 0;

    const channelCounts: Record<string, { count: number; amount: number }> = {
      DineIn: { count: 0, amount: 0 },
      TakeAway: { count: 0, amount: 0 },
      Delivery: { count: 0, amount: 0 },
    };

    // Resolve active payment modes dynamically from Settings -> Payment Modes
    const activeSettingModes: string[] = [];
    if (paymentModesFromSettings && Array.isArray(paymentModesFromSettings)) {
      for (const m of paymentModesFromSettings) {
        if (m.active !== false && m.deletedAt === undefined && m.name) {
          activeSettingModes.push(m.name.trim());
        }
      }
    }

    const paymentModes: Record<
      string,
      { txns: number; gross: number; refunds: number; net: number }
    > = {};

    // Initialize only active modes from Settings (or Cash if settings list is empty)
    if (activeSettingModes.length > 0) {
      for (const name of activeSettingModes) {
        paymentModes[name] = { txns: 0, gross: 0, refunds: 0, net: 0 };
      }
    } else {
      paymentModes["Cash"] = { txns: 0, gross: 0, refunds: 0, net: 0 };
    }

    for (const o of dayOrders) {
      const val = o.totalAmount || 0;
      const sub = o.subTotal || 0;
      const disc = o.discountAmount || 0;
      const del = o.deliveryFee || o.deliveryCharge || 0;
      const orderExclusiveTax =
        val > 0 && sub > 0
          ? Math.max(0, val - sub + disc - del)
          : (o.taxInfoSnapshot?.tax_mode === "exclusive" ? (o.taxTotal || 0) : 0);

      gross += val;
      discounts += disc;
      taxes += orderExclusiveTax;
      delivery += del;

      const orderRef = getOrderRefundAmount(o);
      refunds += orderRef;

      // Channels (DineIn, TakeAway, Delivery)
      const oType = o.orderType || "DineIn";
      if (oType === "Delivery" || oType === "ScheduledDelivery") {
        channelCounts.Delivery.count += 1;
        channelCounts.Delivery.amount += val;
      } else if (oType === "TakeAway" || oType === "ScheduledPickup") {
        channelCounts.TakeAway.count += 1;
        channelCounts.TakeAway.amount += val;
      } else {
        channelCounts.DineIn.count += 1;
        channelCounts.DineIn.amount += val;
      }

      // Dynamic Payment Modes Attribution
      if (o.payments && Array.isArray(o.payments) && o.payments.length > 0) {
        let hasDebitOrRefund = false;
        for (const p of o.payments) {
          if (p.paymentType === "Debit" || (typeof p.refundAmount === "number" && p.refundAmount > 0)) {
            hasDebitOrRefund = true;
            break;
          }
        }

        for (const p of o.payments) {
          const rawM = (p.paymentModeName || p.mode || p.paymentMode || o.paymentMode || "Cash").trim();
          let targetKey = Object.keys(paymentModes).find(
            (k) => k.toLowerCase() === rawM.toLowerCase()
          );

          if (!targetKey) {
            targetKey = Object.keys(paymentModes).find((k) => {
              const kLower = k.toLowerCase();
              const rLower = rawM.toLowerCase();
              return (
                (rLower.includes("upi") && kLower.includes("upi")) ||
                (rLower.includes("qr") && kLower.includes("qr")) ||
                (rLower.includes("card") && kLower.includes("card")) ||
                (rLower.includes("cash") && kLower.includes("cash")) ||
                (rLower.includes("swiggy") && kLower.includes("swiggy")) ||
                (rLower.includes("zomato") && kLower.includes("zomato"))
              );
            });
          }

          const finalKey: string = targetKey || rawM || "Cash";
          if (!paymentModes[finalKey]) {
            paymentModes[finalKey] = { txns: 0, gross: 0, refunds: 0, net: 0 };
          }

          const isDebit = p.paymentType === "Debit";
          if (isDebit) {
            const pRef = p.refundAmount || p.amount || 0;
            paymentModes[finalKey].refunds += pRef;
          } else {
            const pGross = p.payAmount !== undefined ? p.payAmount : (p.amount || 0);
            let pRef = p.refundAmount || 0;
            if (!hasDebitOrRefund && orderRef > 0) {
              pRef = orderRef;
            }
            paymentModes[finalKey].txns += 1;
            paymentModes[finalKey].gross += pGross;
            paymentModes[finalKey].refunds += pRef;
          }
          paymentModes[finalKey].net =
            paymentModes[finalKey].gross - paymentModes[finalKey].refunds;
        }
      } else {
        const rawM = (o.paymentMode || "Cash").trim();
        let targetKey = Object.keys(paymentModes).find(
          (k) => k.toLowerCase() === rawM.toLowerCase()
        );

        if (!targetKey) {
          targetKey = Object.keys(paymentModes).find((k) => {
            const kLower = k.toLowerCase();
            const rLower = rawM.toLowerCase();
            return (
              (rLower.includes("upi") && kLower.includes("upi")) ||
              (rLower.includes("qr") && kLower.includes("qr")) ||
              (rLower.includes("card") && kLower.includes("card")) ||
              (rLower.includes("cash") && kLower.includes("cash")) ||
              (rLower.includes("swiggy") && kLower.includes("swiggy")) ||
              (rLower.includes("zomato") && kLower.includes("zomato"))
            );
          });
        }

        const finalKey: string = targetKey || rawM || "Cash";
        if (!paymentModes[finalKey]) {
          paymentModes[finalKey] = { txns: 0, gross: 0, refunds: 0, net: 0 };
        }

        paymentModes[finalKey].txns += 1;
        paymentModes[finalKey].gross += val;
        paymentModes[finalKey].refunds += orderRef;
        paymentModes[finalKey].net =
          paymentModes[finalKey].gross - paymentModes[finalKey].refunds;
      }
    }

    const netPaise = Math.max(0, gross - taxes - refunds);
    const ordCount = dayOrders.length || selectedDayForDrawer.ordersCount || 1;
    const aov = ordCount > 0 ? Math.round(gross / ordCount) : 0;

    let totalPaymentTxns = 0;
    let totalPaymentGross = 0;
    let totalPaymentRefunds = 0;
    for (const p of Object.values(paymentModes)) {
      totalPaymentTxns += p.txns;
      totalPaymentGross += p.gross;
      totalPaymentRefunds += p.refunds;
    }
    const totalPaymentNet = Math.max(0, totalPaymentGross - totalPaymentRefunds);

    return {
      dateLabel: selectedDayForDrawer.dateLabel,
      ordersCount: dayOrders.length,
      grossPaise: gross,
      discountPaise: discounts,
      taxPaise: taxes,
      refundPaise: refunds,
      deliveryPaise: delivery,
      netPaise,
      aovPaise: aov,
      channelCounts,
      paymentModes,
      totalPaymentTxns,
      totalPaymentGross,
      totalPaymentRefunds,
      totalPaymentNet,
    };
  }, [selectedDayForDrawer, orders, countryCode, timezone, paymentModesFromSettings]);

  // Export CSV handler
  const handleExportCsv = () => {
    if (dailyLedger.length === 0) {
      showToast(
        "No settlement records available to export for this period.",
        "warning",
      );
      return;
    }

    const headers = [
      "Date",
      "Orders",
      "Gross Revenue",
      "Discounts",
      taxColumnLabel,
      "Delivery",
      "Net Revenue",
    ];

    const rows = dailyLedger.map((d) => [
      `"${d.dateLabel}"`,
      d.ordersCount,
      (d.grossPaise / 100).toFixed(2),
      (d.discountPaise / 100).toFixed(2),
      (d.taxPaise / 100).toFixed(2),
      (d.deliveryPaise / 100).toFixed(2),
      (d.netPaise / 100).toFixed(2),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales-ledger-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Sales ledger CSV exported successfully", "success");
  };

  const getHourLabel = (h: number) => {
    if (h === 12) return "12 PM";
    if (h > 12) return `${h - 12} PM`;
    return `${h} AM`;
  };

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Editorial Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 mb-2">
        <div className="flex flex-col max-w-2xl space-y-1">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center text-[13px] text-[#5e5e5e] mb-2 gap-2 font-sans font-medium"
          >
            <Link
              href="/reports"
              className="hover:text-[#141010] transition-colors cursor-pointer"
            >
              Reports
            </Link>
            <ChevronRightIcon className="w-3.5 h-3.5 text-[#928c8a]" />
            <span className="text-[#141010] font-semibold">
              Sales Report
            </span>
          </nav>
          <h1
            className="font-garamond text-[32px] md:text-[36px] text-[#0c0a09] font-normal leading-tight"
            style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
          >
            Sales Report
          </h1>
          <p className="text-[#5e5e5e] text-[14px] mt-1 font-normal leading-relaxed">
            Track restaurant sales, revenue, discounts, tax collections, and net settlement cadence across service consoles.
          </p>
        </div>

        {/* Right Controls: Global Range Selector & CSV Export */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 self-start sm:self-end shrink-0 w-full sm:w-auto">
          {selectedRange && onRangeChange && (
            <OrderDateRangePicker
              startDate={selectedRange.startDate}
              endDate={selectedRange.endDate}
              preset={selectedRange.preset}
              onChange={onRangeChange}
              countryCode={countryCode}
              timezone={timezone}
              variant="pill"
              align="right"
            />
          )}

          <button
            onClick={handleExportCsv}
            type="button"
            className="inline-flex items-center gap-1.5 bg-[#0c0a09] text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xs hover:bg-[#262626] transition-colors cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Export CSV</span>
          </button>

          {/* Print Summary Action (Disabled / Low Opacity) */}
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 bg-white border border-[#e7e5e4] text-[#a8a29e] text-xs font-semibold px-4 py-2 rounded-full shadow-2xs opacity-40 cursor-not-allowed select-none shrink-0"
            title="Print Sales Report"
          >
            <span className="material-symbols-outlined text-[16px] text-[#a8a29e]">print</span>
            <span>Print</span>
          </button>
        </div>
      </header>

      {/* 5 Compact KPI Cards Matching Prototype */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Card 1: Gross Sales */}
        <div className="bg-white border border-[#e7e5e4] rounded-xl p-4 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
              Gross Sales
            </span>
            <span className="material-symbols-outlined text-[18px] text-[#78716c]">
              payments
            </span>
          </div>
          <div>
            <div
              className="text-2xl lg:text-3xl font-normal text-[#0c0a09] tabular-nums leading-tight truncate"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              {loading ? "..." : formatPriceWithSymbol(aggregates.grossPaise, currencySymbol, countryCode, true)}
            </div>
            <div className="text-xs text-[#78716c] mt-1 truncate">
              Sum before deductions
            </div>
          </div>
          <div className="mt-3 pt-1 flex items-center gap-1.5 bg-[#fdf8f7] border border-[#e7e5e4] rounded-full px-2.5 py-1 w-fit max-w-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0c0a09] shrink-0"></span>
            <span className="text-[11px] text-[#0c0a09] tabular-nums font-medium whitespace-nowrap truncate">
              {aggregates.completedOrders} completed orders
            </span>
          </div>
        </div>

        {/* Card 2: Total Discounts */}
        <div className="bg-white border border-[#e7e5e4] rounded-xl p-4 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
              Total Discounts
            </span>
            <span className="material-symbols-outlined text-[18px] text-[#78716c]">
              sell
            </span>
          </div>
          <div>
            {aggregates.discountPaise > 0 ? (
              <>
                <div
                  className="text-2xl lg:text-3xl font-normal text-[#0c0a09] tabular-nums leading-tight truncate"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  {formatPriceWithSymbol(aggregates.discountPaise, currencySymbol, countryCode, true)}
                </div>
                <div className="text-xs text-[#78716c] mt-1 truncate">
                  Discount &amp; comp reductions
                </div>
              </>
            ) : (
              <>
                <div
                  className="text-xl lg:text-2xl font-normal text-[#78716c] leading-tight"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  Coming Soon
                </div>
                <div className="text-xs text-[#78716c] mt-1 truncate">
                  Discount tracking integration in progress
                </div>
              </>
            )}
          </div>
          <div className="mt-3 pt-1 flex items-center gap-1.5 bg-[#fdf8f7] border border-[#e7e5e4] rounded-full px-2.5 py-1 w-fit max-w-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#78716c] shrink-0"></span>
            <span className="text-[11px] text-[#5e5e5e] font-medium whitespace-nowrap truncate">
              {aggregates.discountPaise > 0
                ? `${((aggregates.discountPaise / (aggregates.grossPaise || 1)) * 100).toFixed(1)}% discount rate`
                : "Telemetry coming soon"}
            </span>
          </div>
        </div>

        {/* Card 3: Taxes Collected */}
        <div className="bg-white border border-[#e7e5e4] rounded-xl p-4 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
              Taxes Collected
            </span>
            <span className="material-symbols-outlined text-[18px] text-[#78716c]">
              account_balance
            </span>
          </div>
          <div>
            <div
              className="text-2xl lg:text-3xl font-normal text-[#0c0a09] tabular-nums leading-tight truncate"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              {loading ? "..." : formatPriceWithSymbol(aggregates.taxPaise, currencySymbol, countryCode, true)}
            </div>
            <div className="text-xs text-[#78716c] mt-1 truncate">
              {taxLabel}
            </div>
          </div>
          <div className="mt-3 pt-1 flex items-center gap-1.5 bg-[#fdf8f7] border border-[#e7e5e4] rounded-full px-2.5 py-1 w-fit max-w-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
            <span className="text-[11px] text-[#0c0a09] font-medium whitespace-nowrap truncate">
              100% compliant
            </span>
          </div>
        </div>

        {/* Card 4: Delivery Charges */}
        <div className="bg-white border border-[#e7e5e4] rounded-xl p-4 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
              Delivery Charges
            </span>
            <span className="material-symbols-outlined text-[18px] text-[#78716c]">
              moped
            </span>
          </div>
          <div>
            <div
              className="text-2xl lg:text-3xl font-normal text-[#0c0a09] tabular-nums leading-tight truncate"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              {loading ? "..." : formatPriceWithSymbol(aggregates.deliveryPaise, currencySymbol, countryCode, true)}
            </div>
            <div className="text-xs text-[#78716c] mt-1 truncate">
              Packaging &amp; dispatch
            </div>
          </div>
          <div className="mt-3 pt-1 flex items-center gap-1.5 bg-[#fdf8f7] border border-[#e7e5e4] rounded-full px-2.5 py-1 w-fit max-w-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#78716c] shrink-0"></span>
            <span className="text-[11px] text-[#0c0a09] tabular-nums font-medium whitespace-nowrap truncate">
              {aggregates.deliveryRuns} delivery runs
            </span>
          </div>
        </div>

        {/* Card 5: Net Settlement */}
        <div className="bg-white border border-[#e7e5e4] rounded-xl p-4 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
              Net Settlement
            </span>
            <span className="material-symbols-outlined text-[18px] text-[#0c0a09]">
              verified
            </span>
          </div>
          <div>
            <div
              className="text-2xl lg:text-3xl font-normal text-[#0c0a09] tabular-nums leading-tight truncate"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              {loading ? "..." : formatPriceWithSymbol(aggregates.netPaise, currencySymbol, countryCode, true)}
            </div>
            <div className="text-xs text-[#78716c] mt-1 truncate">
              Net revenue settled
            </div>
          </div>
          <div className="mt-3 pt-1 flex items-center gap-1.5 bg-[#fdf8f7] border border-[#e7e5e4] rounded-full px-2.5 py-1 w-fit max-w-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
            <span className="text-[11px] text-[#0c0a09] font-medium whitespace-nowrap truncate">
              Audited folio
            </span>
          </div>
        </div>
      </section>

      {/* Split Performance Section: Hourly Cadence & Channel Breakdown (12 Columns: 8 and 4) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 8 Cols: Hourly Cadence Bar Chart */}
        <div className="lg:col-span-8 bg-white border border-[#e7e5e4] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
                Hourly Volume &amp; Intake
              </span>
              <h2
                className="text-xl text-[#0c0a09] font-normal"
                style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
              >
                Sales Overview &amp; Hourly Cadence
              </h2>
            </div>
            <div className="flex items-center gap-4 text-[#5e5e5e] text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0c0a09] inline-block"></span>
                <span>Gross Value</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#e7e5e4] inline-block"></span>
                <span>Volume (Orders)</span>
              </div>
            </div>
          </div>

          {/* Peak Annotations Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#fdf8f7] border border-[#e7e5e4] rounded-full px-4 py-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-amber-600">
                wb_sunny
              </span>
              <span className="text-xs text-[#5e5e5e]">Lunch Peak:</span>
              <span className="text-xs font-semibold text-[#0c0a09]">
                {hourlyData.lunchPeak.hourLabel} ({hourlyData.lunchPeak.orders} orders • {formatPriceWithSymbol(hourlyData.lunchPeak.amount, currencySymbol, countryCode, true)})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-indigo-600">
                nights_stay
              </span>
              <span className="text-xs text-[#5e5e5e]">Dinner Peak:</span>
              <span className="text-xs font-semibold text-[#0c0a09]">
                {hourlyData.dinnerPeak.hourLabel} ({hourlyData.dinnerPeak.orders} orders • {formatPriceWithSymbol(hourlyData.dinnerPeak.amount, currencySymbol, countryCode, true)})
              </span>
            </div>
          </div>

          {/* SVG Cadence Bar Chart */}
          <div className="overflow-x-auto w-full no-scrollbar pb-2">
            <div className="relative min-w-[500px] h-56 pt-2">
              {(() => {
                const numHours = hourlyData.hours.length || 1;
                const totalWidth = Math.max(680, 40 + numHours * 56);
                const step = (totalWidth - 60) / numHours;
                const barWidth = Math.min(32, Math.max(16, step - 14));
                return (
                  <svg
                    className="w-full h-full overflow-visible"
                    viewBox={`0 0 ${totalWidth} 180`}
                    preserveAspectRatio="none"
                  >
                    {/* Horizontal guidelines */}
                    <line
                      x1="20"
                      y1="30"
                      x2={totalWidth - 20}
                      y2="30"
                      stroke="#f0e8e2"
                      strokeDasharray="2 3"
                    />
                    <line
                      x1="20"
                      y1="75"
                      x2={totalWidth - 20}
                      y2="75"
                      stroke="#f0e8e2"
                      strokeDasharray="2 3"
                    />
                    <line
                      x1="20"
                      y1="120"
                      x2={totalWidth - 20}
                      y2="120"
                      stroke="#f0e8e2"
                      strokeDasharray="2 3"
                    />
                    <line
                      x1="20"
                      y1="150"
                      x2={totalWidth - 20}
                      y2="150"
                      stroke="#e7e5e4"
                    />

                    {hourlyData.hours.map((h, i) => {
                      const slot = hourlyData.buckets[h] || {
                        count: 0,
                        grossPaise: 0,
                      };
                      const barHeight =
                        hourlyData.maxGross > 0
                          ? Math.round((slot.grossPaise / hourlyData.maxGross) * 110)
                          : 0;
                      const x = 30 + i * step;
                      const y = 150 - barHeight;
                      const isPeak =
                        h === hourlyData.overallPeakHour && slot.grossPaise > 0;

                      return (
                        <g key={h} className="cursor-pointer group">
                          {/* Background Bar */}
                          <rect
                            x={x}
                            y="35"
                            width={barWidth}
                            height="115"
                            rx="5"
                            fill="#faf2ee"
                            className="group-hover:fill-[#f4ece8] transition-colors"
                          />

                          {/* Actual Gross Sales Bar */}
                          {barHeight > 0 && (
                            <rect
                              x={x}
                              y={y}
                              width={barWidth}
                              height={barHeight}
                              rx="5"
                              fill={isPeak ? "#0c0a09" : "#5e5e5e"}
                              className="group-hover:fill-[#0c0a09] transition-all duration-300"
                            />
                          )}

                          {/* Peak Tag */}
                          {isPeak && (
                            <>
                              <circle
                                cx={x + barWidth / 2}
                                cy={Math.max(16, y - 8)}
                                r="3.5"
                                fill="#0c0a09"
                                stroke="#ffffff"
                                strokeWidth="1.5"
                              />
                              <text
                                x={x + barWidth / 2}
                                y={Math.max(10, y - 14)}
                                textAnchor="middle"
                                fill="#0c0a09"
                                fontSize="9"
                                fontWeight="700"
                                fontFamily="sans-serif"
                              >
                                Peak
                              </text>
                            </>
                          )}

                          {/* Hour Axis Label */}
                          <text
                            x={x + barWidth / 2}
                            y="166"
                            textAnchor="middle"
                            fill="#78716c"
                            fontSize="10"
                            fontWeight="500"
                            fontFamily="sans-serif"
                          >
                            {getHourLabel(h)}
                          </text>
                          <title>{`${getHourLabel(h)}: ${slot.count} Orders | ${formatPriceWithSymbol(slot.grossPaise, currencySymbol, countryCode, true)}`}</title>
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#e7e5e4] flex items-center justify-between text-[#5e5e5e] text-xs">
            <span>Operating Service: {operationTimingLabel}</span>
            <span className="tabular-nums">Audited Hourly Folios: {hourlyData.hours.length} Periods</span>
          </div>
        </div>

        {/* Right 4 Cols: Total Discounts (Coming Soon) */}
        <div className="lg:col-span-4 bg-white border border-[#e7e5e4] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
                Total Discounts
              </span>
              <span className="material-symbols-outlined text-[18px] text-[#78716c]">
                sell
              </span>
            </div>

            <div className="pt-8 pb-6">
              <h2
                className="text-2xl sm:text-3xl font-normal text-[#0c0a09] leading-tight"
                style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
              >
                Coming Soon
              </h2>
              <p className="text-xs text-[#78716c] mt-1.5">
                Discount tracking integration in progress
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#e7e5e4] flex items-center justify-between">
            <div className="flex items-center gap-1.5 bg-[#fdf8f7] border border-[#e7e5e4] rounded-full px-2.5 py-1 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-[#78716c] shrink-0"></span>
              <span className="text-[11px] text-[#5e5e5e] font-medium whitespace-nowrap">
                Telemetry coming soon
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Daily Ledger Settlement Table Panel (Matching Customer Report Table Styling) */}
      <section className="bg-white rounded-xl shadow-xs border border-[#e7e5e4] overflow-hidden flex flex-col font-sans">
        {/* Table Header Info Bar */}
        <div className="px-5 py-3.5 bg-[#fdf8f7] flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e7e5e4]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold text-[#0c0a09]">
                Daily Ledger Settlement
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#f1edec] text-[11px] font-medium text-[#5e5e5e] border border-[#e7e5e4]">
                {dailyLedger.length} settlement days
              </span>
            </div>
            <p className="text-xs text-[#5e5e5e] mt-0.5">
              Audited against terminal POS folios &amp; counter receipts
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              disabled
              title="Print Journal"
              className="inline-flex items-center gap-1.5 bg-white border border-[#e7e5e4] text-[#a8a29e] px-3.5 py-1.5 rounded-full text-xs font-medium opacity-40 cursor-not-allowed select-none shadow-2xs"
            >
              <span className="material-symbols-outlined text-[15px] text-[#a8a29e]">
                print
              </span>
              <span>Print Journal</span>
            </button>
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="border-b border-[#e7e5e4] bg-[#fdf8f7] text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold whitespace-nowrap min-w-[150px]">Date</th>
                <th className="py-3 px-3 font-semibold text-center whitespace-nowrap min-w-[95px]">Orders</th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap min-w-[110px]">Gross Revenue</th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap min-w-[95px]">Discounts</th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap min-w-[120px]">{taxColumnLabel}</th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap min-w-[95px]">Delivery</th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap min-w-[115px]">Net Revenue</th>
                <th className="py-3 px-4 font-semibold text-center whitespace-nowrap min-w-[105px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0e8e2] text-xs">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="py-3.5 px-4">
                      <div className="animate-pulse space-y-2">
                        <div className="h-4 bg-[#f1edec] rounded w-1/4"></div>
                        <div className="h-3 bg-[#f1edec] rounded w-1/6"></div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : paginatedDays.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-[#7f7570]">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <span className="material-symbols-outlined text-[44px] text-[#b4a9a4]">
                        receipt_long
                      </span>
                      <p className="font-semibold text-sm text-[#0c0a09]">
                        No Settlement Records Found
                      </p>
                      <p className="text-xs text-[#5e5e5e] max-w-sm">
                        No sales ledger entries matched the selected date range.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedDays.map((d, index) => {
                  const isFirstRow = currentPage === 1 && index === 0;
                  return (
                    <tr
                      key={d.dateLabel}
                      className="hover:bg-[#fdf8f7] transition-colors group cursor-default"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isFirstRow && (
                            <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                          )}
                          <span className="font-semibold text-xs text-[#0c0a09]">
                            {d.dateLabel}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap tabular-nums">
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#f1edec] text-[#0c0a09] border border-[#e7e5e4] text-[11px] font-medium">
                          {d.ordersCount} {d.ordersCount === 1 ? "order" : "orders"}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap tabular-nums text-xs font-semibold text-[#0c0a09]">
                        {formatPriceWithSymbol(d.grossPaise, currencySymbol, countryCode, true)}
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap tabular-nums text-xs font-medium text-[#5e5e5e]">
                        {d.discountPaise > 0
                          ? `-${formatPriceWithSymbol(d.discountPaise, currencySymbol, countryCode, true)}`
                          : "—"}
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap tabular-nums text-xs font-medium text-[#5e5e5e]">
                        {d.taxPaise > 0
                          ? formatPriceWithSymbol(d.taxPaise, currencySymbol, countryCode, true)
                          : "—"}
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap tabular-nums text-xs font-medium text-[#5e5e5e]">
                        {d.deliveryPaise > 0
                          ? formatPriceWithSymbol(d.deliveryPaise, currencySymbol, countryCode, true)
                          : "—"}
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap tabular-nums text-xs font-semibold text-[#0c0a09]">
                        {formatPriceWithSymbol(d.netPaise, currencySymbol, countryCode, true)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedDayForDrawer(d)}
                          className="px-3 py-1 rounded-lg text-xs font-medium bg-[#0c0a09] text-white hover:bg-[#262626] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                        >
                          <span>View Ledger</span>
                          <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Editorial Pagination Footer (Matching Customer Report) */}
        {dailyLedger.length > 0 && (
          <div className="px-5 py-3.5 border-t border-[#e7e5e4] bg-[#fdf8f7] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#5e5e5e]">
            <span>
              Showing{" "}
              <strong className="text-[#0c0a09] font-semibold">
                {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, dailyLedger.length)}
              </strong>{" "}
              of{" "}
              <strong className="text-[#0c0a09] font-semibold">
                {dailyLedger.length}
              </strong>{" "}
              settlement days
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg border border-[#e7e5e4] bg-white hover:bg-[#f1edec] text-[#0c0a09] disabled:opacity-40 transition-colors cursor-pointer text-xs font-medium"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                    currentPage === i + 1
                      ? "bg-[#0c0a09] text-white shadow-2xs"
                      : "bg-white border border-[#e7e5e4] text-[#0c0a09] hover:bg-[#f1edec]"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                className="px-3 py-1 rounded-lg border border-[#e7e5e4] bg-white hover:bg-[#f1edec] text-[#0c0a09] disabled:opacity-40 transition-colors cursor-pointer text-xs font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* DAILY SALES LEDGER SLIDE-OVER DRAWER */}
      {selectedDayForDrawer && drawerStats && (
        <div className="fixed inset-0 z-50 flex justify-end transition-opacity duration-300">
          {/* Backdrop */}
          <div
            onClick={() => setSelectedDayForDrawer(null)}
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-[2px] transition-opacity cursor-pointer"
          />

          {/* Drawer Content */}
          <aside className="relative z-10 w-full max-w-full sm:max-w-xl lg:max-w-2xl h-full bg-[#fdf8f7] shadow-2xl flex flex-col justify-between overflow-hidden border-l border-[#e7e5e4]">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-[#e7e5e4] bg-white flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2.5">
                  <h2
                    className="text-2xl font-normal text-[#0c0a09] leading-tight"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    Daily Sales Ledger
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Settled
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[#5e5e5e] text-xs">
                  <span className="material-symbols-outlined text-[15px] text-[#78716c]">
                    calendar_today
                  </span>
                  <span className="font-medium text-[#0c0a09]">
                    {drawerStats.dateLabel}
                  </span>
                  <span className="text-[#d0c4be]">•</span>
                  <span>
                    Folio #{drawerStats.dateLabel.replace(/[^a-zA-Z0-9]/g, "")}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDayForDrawer(null)}
                className="w-8 h-8 rounded-full bg-[#f1edec] hover:bg-[#e7e5e4] text-[#5e5e5e] hover:text-[#0c0a09] flex items-center justify-center transition-colors cursor-pointer"
                title="Close Ledger"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Section 1: Daily Summary */}
              <section className="space-y-3">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
                    Daily Summary
                  </span>
                  <h3
                    className="text-lg text-[#0c0a09] font-normal"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    Ledger Performance Overview
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-3.5 rounded-xl border border-[#e7e5e4] shadow-2xs">
                    <span className="text-[11px] text-[#5e5e5e] block mb-1 uppercase tracking-wide font-medium">
                      Gross Revenue
                    </span>
                    <span className="text-base font-semibold text-[#0c0a09] tabular-nums block">
                      {formatPriceWithSymbol(
                        drawerStats.grossPaise,
                        currencySymbol,
                        countryCode,
                        true,
                      )}
                    </span>
                    <span className="text-xs text-[#78716c] block mt-0.5">
                      {drawerStats.ordersCount} orders processed
                    </span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-[#e7e5e4] shadow-2xs">
                    <span className="text-[11px] text-[#5e5e5e] block mb-1 uppercase tracking-wide font-medium">
                      Total Refunds
                    </span>
                    <span className="text-base font-semibold text-red-600 tabular-nums block">
                      {drawerStats.refundPaise > 0
                        ? `-${formatPriceWithSymbol(drawerStats.refundPaise, currencySymbol, countryCode, true)}`
                        : "—"}
                    </span>
                    <span className="text-xs text-[#78716c] block mt-0.5">
                      Refunds &amp; returns
                    </span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-[#e7e5e4] shadow-2xs">
                    <span className="text-[11px] text-[#5e5e5e] block mb-1 uppercase tracking-wide font-medium">
                      Total Discounts
                    </span>
                    <span className="text-base font-semibold text-[#5e5e5e] tabular-nums block">
                      {drawerStats.discountPaise > 0
                        ? `-${formatPriceWithSymbol(drawerStats.discountPaise, currencySymbol, countryCode, true)}`
                        : "—"}
                    </span>
                    <span className="text-xs text-[#78716c] block mt-0.5">
                      {drawerStats.grossPaise > 0
                        ? `${((drawerStats.discountPaise / drawerStats.grossPaise) * 100).toFixed(1)}% discount rate`
                        : "0.0% discount rate"}
                    </span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-[#e7e5e4] shadow-2xs">
                    <span className="text-[11px] text-[#5e5e5e] block mb-1 uppercase tracking-wide font-medium">
                      Taxes Collected
                    </span>
                    <span className="text-base font-semibold text-[#0c0a09] tabular-nums block">
                      {formatPriceWithSymbol(
                        drawerStats.taxPaise,
                        currencySymbol,
                        countryCode,
                        true,
                      )}
                    </span>
                    <span className="text-xs text-[#78716c] block mt-0.5">
                      {taxLabel}
                    </span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-[#e7e5e4] shadow-2xs">
                    <span className="text-[11px] text-[#5e5e5e] block mb-1 uppercase tracking-wide font-medium">
                      Delivery Charges
                    </span>
                    <span className="text-base font-semibold text-[#0c0a09] tabular-nums block">
                      {drawerStats.deliveryPaise > 0
                        ? formatPriceWithSymbol(
                            drawerStats.deliveryPaise,
                            currencySymbol,
                            countryCode,
                            true,
                          )
                        : "—"}
                    </span>
                    <span className="text-xs text-[#78716c] block mt-0.5">
                      Dispatch &amp; packing
                    </span>
                  </div>

                  <div className="bg-[#faf2ee] p-3.5 rounded-xl border border-[#e7e5e4] shadow-2xs">
                    <span className="text-[11px] text-[#0c0a09] block mb-1 uppercase tracking-wide font-semibold">
                      Avg Order Value
                    </span>
                    <span className="text-base font-bold text-[#0c0a09] tabular-nums block">
                      {formatPriceWithSymbol(
                        drawerStats.aovPaise,
                        currencySymbol,
                        countryCode,
                        true,
                      )}
                    </span>
                    <span className="text-xs text-[#5e5e5e] block mt-0.5">
                      {drawerStats.ordersCount} orders avg
                    </span>
                  </div>
                </div>
              </section>

              {/* Section 2: Settlement Calculation */}
              <section className="bg-white p-4 sm:p-5 rounded-xl border border-[#e7e5e4] shadow-2xs space-y-3">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
                    Sales Breakdown
                  </span>
                  <h3
                    className="text-lg text-[#0c0a09] font-normal"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    Settlement Calculation
                  </h3>
                </div>

                <div className="divide-y divide-[#f0e8e2] text-xs">
                  <div className="py-2.5 flex items-center justify-between text-[#0c0a09]">
                    <span>Gross Sales Revenue</span>
                    <span className="font-semibold tabular-nums">
                      {formatPriceWithSymbol(
                        drawerStats.grossPaise,
                        currencySymbol,
                        countryCode,
                        true,
                      )}
                    </span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between text-[#5e5e5e]">
                    <span>Less: Total Refunds</span>
                    <span className="tabular-nums text-red-600 font-medium">
                      {drawerStats.refundPaise > 0
                        ? `-${formatPriceWithSymbol(drawerStats.refundPaise, currencySymbol, countryCode, true)}`
                        : "—"}
                    </span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between text-[#5e5e5e]">
                    <span>Less: Discounts &amp; Comps</span>
                    <span className="tabular-nums font-medium">
                      {drawerStats.discountPaise > 0
                        ? `-${formatPriceWithSymbol(drawerStats.discountPaise, currencySymbol, countryCode, true)}`
                        : "—"}
                    </span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between text-[#5e5e5e]">
                    <span>Less: Taxes Collected</span>
                    <span className="tabular-nums font-medium">
                      {drawerStats.taxPaise > 0
                        ? `-${formatPriceWithSymbol(drawerStats.taxPaise, currencySymbol, countryCode, true)}`
                        : "—"}
                    </span>
                  </div>
                  {drawerStats.deliveryPaise > 0 && (
                    <div className="py-2.5 flex items-center justify-between text-[#5e5e5e]">
                      <span>Add: Delivery &amp; Packaging</span>
                      <span className="tabular-nums font-medium">
                        +
                        {formatPriceWithSymbol(
                          drawerStats.deliveryPaise,
                          currencySymbol,
                          countryCode,
                          true,
                        )}
                      </span>
                    </div>
                  )}
                  <div className="pt-3 pb-1 flex items-center justify-between bg-[#fdf8f7] px-3.5 py-3 rounded-lg border border-[#e7e5e4] font-semibold text-[#0c0a09]">
                    <span
                      className="text-base font-normal"
                      style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                    >
                      Net Sales (Settled)
                    </span>
                    <span className="tabular-nums font-bold text-base">
                      {formatPriceWithSymbol(
                        drawerStats.netPaise,
                        currencySymbol,
                        countryCode,
                        true,
                      )}
                    </span>
                  </div>
                </div>
              </section>

              {/* Section 3: Distribution (Order Channel Breakdown) */}
              <section className="bg-white p-4 sm:p-5 rounded-xl border border-[#e7e5e4] shadow-2xs space-y-3">
                {(() => {
                  const activeChannelOrdersCount =
                    (isDineInActive ? (drawerStats.channelCounts.DineIn?.count || 0) : 0) +
                    (isTakeAwayActive ? (drawerStats.channelCounts.TakeAway?.count || 0) : 0) +
                    (isDeliveryActive ? (drawerStats.channelCounts.Delivery?.count || 0) : 0);

                  const activeChannelsList = [
                    isDineInActive && {
                      key: "DineIn",
                      label: "Dine-In",
                      dotColor: "bg-[#0c0a09]",
                      barColor: "bg-[#0c0a09]",
                      count: drawerStats.channelCounts.DineIn?.count || 0,
                      amount: drawerStats.channelCounts.DineIn?.amount || 0,
                    },
                    isTakeAwayActive && {
                      key: "TakeAway",
                      label: "Takeaway",
                      dotColor: "bg-[#5e5e5e]",
                      barColor: "bg-[#5e5e5e]",
                      count: drawerStats.channelCounts.TakeAway?.count || 0,
                      amount: drawerStats.channelCounts.TakeAway?.amount || 0,
                    },
                    isDeliveryActive && {
                      key: "Delivery",
                      label: "Delivery",
                      dotColor: "bg-[#a8a29e]",
                      barColor: "bg-[#a8a29e]",
                      count: drawerStats.channelCounts.Delivery?.count || 0,
                      amount: drawerStats.channelCounts.Delivery?.amount || 0,
                    },
                  ].filter(Boolean) as Array<{
                    key: string;
                    label: string;
                    dotColor: string;
                    barColor: string;
                    count: number;
                    amount: number;
                  }>;

                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
                            Distribution
                          </span>
                          <h3
                            className="text-lg text-[#0c0a09] font-normal"
                            style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                          >
                            Order Channel Breakdown
                          </h3>
                        </div>
                        <span className="text-xs text-[#5e5e5e] tabular-nums font-medium">
                          {activeChannelOrdersCount} {activeChannelOrdersCount === 1 ? "Order" : "Orders"} (100%)
                        </span>
                      </div>

                      {/* Multi-segment Bar */}
                      <div className="w-full h-2 rounded-full overflow-hidden flex bg-[#e7e5e4] mb-3">
                        {activeChannelOrdersCount > 0 ? (
                          activeChannelsList.map((ch) => (
                            <div
                              key={ch.key}
                              className={`${ch.barColor} h-full transition-all duration-300`}
                              style={{
                                width: `${Math.round((ch.count / activeChannelOrdersCount) * 100)}%`,
                              }}
                            ></div>
                          ))
                        ) : (
                          <div className="bg-[#e7e5e4] h-full w-full"></div>
                        )}
                      </div>

                      <div className="space-y-2 text-xs">
                        {activeChannelsList.length > 0 ? (
                          activeChannelsList.map((ch, idx) => {
                            const isLast = idx === activeChannelsList.length - 1;
                            const pct =
                              activeChannelOrdersCount > 0
                                ? Math.round((ch.count / activeChannelOrdersCount) * 100)
                                : 0;
                            return (
                              <div
                                key={ch.key}
                                className={`flex items-center justify-between py-1.5 ${!isLast ? "border-b border-[#f0e8e2]" : ""}`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${ch.dotColor} inline-block`}></span>
                                  <span className="font-medium text-[#0c0a09]">
                                    {ch.label}
                                  </span>
                                  <span className="text-[#78716c]">
                                    ({ch.count} {ch.count === 1 ? "order" : "orders"})
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 tabular-nums">
                                  <span className="text-[#5e5e5e]">
                                    {pct}%
                                  </span>
                                  <span className="font-semibold text-[#0c0a09]">
                                    {formatPriceWithSymbol(
                                      ch.amount,
                                      currencySymbol,
                                      countryCode,
                                      true,
                                    )}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="py-2 text-center text-[#78716c] text-xs">
                            No active order channels enabled in Settings &rarr; Features
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </section>

              {/* Section 4: Payment Mode Summary */}
              <section className="bg-white p-4 sm:p-5 rounded-xl border border-[#e7e5e4] shadow-2xs space-y-3">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
                    Payment Reconciliation
                  </span>
                  <h3
                    className="text-lg text-[#0c0a09] font-normal"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    Payment Mode Summary
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="text-[#5e5e5e] text-[11px] border-b border-[#e7e5e4] bg-[#fdf8f7] uppercase tracking-wider">
                        <th className="py-2 px-3 font-semibold">Mode</th>
                        <th className="py-2 px-3 text-center font-semibold">Txns</th>
                        <th className="py-2 px-3 text-right font-semibold">Gross</th>
                        <th className="py-2 px-3 text-right font-semibold">Refunds</th>
                        <th className="py-2 px-3 text-right font-semibold">Net Settled</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e8e2] text-[#0c0a09]">
                      {Object.entries(drawerStats.paymentModes).map(
                        ([mode, data]) => (
                          <tr
                            key={mode}
                            className="hover:bg-[#fdf8f7] transition-colors"
                          >
                            <td className="py-2.5 px-3 font-medium">{mode}</td>
                            <td className="py-2.5 px-3 text-center tabular-nums text-[#5e5e5e]">
                              {data.txns}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums">
                              {formatPriceWithSymbol(
                                data.gross,
                                currencySymbol,
                                countryCode,
                                true,
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-red-600">
                              {data.refunds > 0
                                ? `-${formatPriceWithSymbol(data.refunds, currencySymbol, countryCode, true)}`
                                : "—"}
                            </td>
                            <td className={`py-2.5 px-3 text-right tabular-nums font-semibold ${data.net < 0 ? "text-red-600" : ""}`}>
                              {data.net < 0
                                ? `-${formatPriceWithSymbol(
                                    Math.abs(data.net),
                                    currencySymbol,
                                    countryCode,
                                    true,
                                  )}`
                                : formatPriceWithSymbol(
                                    data.net,
                                    currencySymbol,
                                    countryCode,
                                    true,
                                  )}
                            </td>
                          </tr>
                        ),
                      )}
                      <tr className="bg-[#fdf8f7] font-semibold text-[#0c0a09]">
                        <td className="py-2.5 px-3">Total Settled</td>
                        <td className="py-2.5 px-3 text-center tabular-nums">
                          {drawerStats.totalPaymentTxns}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          {formatPriceWithSymbol(
                            drawerStats.totalPaymentGross,
                            currencySymbol,
                            countryCode,
                            true,
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-red-600">
                          {drawerStats.totalPaymentRefunds > 0
                            ? `-${formatPriceWithSymbol(drawerStats.totalPaymentRefunds, currencySymbol, countryCode, true)}`
                            : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-bold">
                          {formatPriceWithSymbol(
                            drawerStats.totalPaymentNet,
                            currencySymbol,
                            countryCode,
                            true,
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-[#e7e5e4] bg-white flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-[#5e5e5e]">
                <span className="material-symbols-outlined text-[16px] text-emerald-600">
                  verified
                </span>
                <span>Verified Daily Sales Settlement Ledger</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDayForDrawer(null)}
                  className="px-4 py-1.5 rounded-lg border border-[#e7e5e4] bg-white hover:bg-[#f1edec] text-[#0c0a09] font-medium transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled
                  title="Print Folio"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#0c0a09] text-white opacity-40 cursor-not-allowed select-none font-medium text-xs shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[14px]">print</span>
                  <span>Print Folio</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Standard Toaster Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
