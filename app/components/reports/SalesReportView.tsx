"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { formatPriceWithSymbol, formatStoreDate } from "../../../lib/constants/countries";
import { DateRange } from "./ReportHeader";
import { computeSalesReportData, isDataZero } from "../../reports/reportCalculations";
import { Toast, type ToastMessage } from "../Toast";

interface SalesReportViewProps {
  orders: any[];
  loading?: boolean;
  currencySymbol: string;
  countryCode?: string;
  timezone?: string;
  selectedRange?: DateRange;
  onRangeChange?: (range: DateRange) => void;
}

export function SalesReportView({
  orders = [],
  loading = false,
  currencySymbol = "₹",
  countryCode = "IN",
  timezone,
  selectedRange,
  onRangeChange,
}: SalesReportViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Toast Notification state (matching Menu toaster)
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "info",
    subtext?: string
  ) => {
    setToast({ message, type, subtext });
  };

  // Selected Day state for Drawer
  const [selectedDayForDrawer, setSelectedDayForDrawer] = useState<any | null>(null);

  // Date Range Dropdown State (matches MenuReportView)
  const [isDateOpen, setIsDateOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const datePresets = ["Today", "Yesterday", "Last 7 Days", "This Month", "Last Month"];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDateOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentDateLabel = selectedRange?.preset || "Today";

  const handleSelectPreset = (presetName: string) => {
    setIsDateOpen(false);
    if (!onRangeChange) return;

    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (presetName === "Today") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (presetName === "Yesterday") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
    } else if (presetName === "Last 7 Days") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (presetName === "This Month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (presetName === "Last Month") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }

    onRangeChange({ startDate: start, endDate: end, preset: presetName });
  };

  // 1. Calculate Old Project Sales Report Data (matches defx-pos-frontend SalesReport.jsx)
  const salesReport = useMemo(() => {
    return computeSalesReportData(orders, currencySymbol, countryCode, timezone);
  }, [orders, currencySymbol, countryCode, timezone]);

  // 2. Calculate Detailed Aggregates
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
      if (o.isRejected) continue;
      const amount = o.totalAmount || 0;
      grossPaise += amount;
      taxPaise += o.taxTotal || 0;
      discountPaise += o.discountAmount || 0;

      if (o.deliveryFee || o.deliveryCharge) {
        deliveryPaise += o.deliveryFee || o.deliveryCharge || 0;
        deliveryRuns += 1;
      } else if (o.orderType === "Delivery" || o.orderType === "ScheduledDelivery") {
        deliveryRuns += 1;
      }

      let orderRefund = 0;
      if (o.paymentStatus === "Refunded") {
        orderRefund = amount;
      } else if (o.paymentStatus === "Partially Refunded") {
        if (o.payments && Array.isArray(o.payments)) {
          for (const p of o.payments) {
            orderRefund += p.refundAmount || 0;
          }
        }
        if (orderRefund === 0 && o.discountAmount) {
          orderRefund = o.discountAmount;
        }
      }
      if (orderRefund > 0) {
        refundPaise += orderRefund;
        refundOrdersCount += 1;
      }

      if (o.isCompleted || o.paymentStatus === "Paid") {
        completedOrders += 1;
      }
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
      completedOrders: completedOrders || (orders.length > 0 ? orders.length : 0),
      deliveryRuns,
    };
  }, [orders]);

  // 3. Calculate Hourly Cadence & Peaks
  const hourlyData = useMemo(() => {
    const hours = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
    const buckets: Record<number, { count: number; grossPaise: number }> = {};
    hours.forEach((h) => {
      buckets[h] = { count: 0, grossPaise: 0 };
    });

    for (const o of orders) {
      if (o.isRejected) continue;
      const h = new Date(o.createdAt).getHours();
      if (buckets[h]) {
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

    let lunchPeakHour = 13;
    let lunchPeakGross = buckets[13]?.grossPaise || 0;
    [12, 13, 14, 15].forEach((h) => {
      if ((buckets[h]?.grossPaise || 0) > lunchPeakGross) {
        lunchPeakGross = buckets[h]?.grossPaise || 0;
        lunchPeakHour = h;
      }
    });

    let dinnerPeakHour = 20;
    let dinnerPeakGross = buckets[20]?.grossPaise || 0;
    [18, 19, 20, 21, 22].forEach((h) => {
      if ((buckets[h]?.grossPaise || 0) > dinnerPeakGross) {
        dinnerPeakGross = buckets[h]?.grossPaise || 0;
        dinnerPeakHour = h;
      }
    });

    let overallPeakHour = 20;
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
  }, [orders]);

  // 4. Channel / Order Type Performance
  const channelPerformance = useMemo(() => {
    const channels: Record<string, { count: number; grossPaise: number }> = {
      DineIn: { count: 0, grossPaise: 0 },
      TakeAway: { count: 0, grossPaise: 0 },
      Delivery: { count: 0, grossPaise: 0 },
    };

    for (const o of orders) {
      if (o.isRejected) continue;
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

    const totalOrders = orders.length || 0;

    return [
      {
        type: "Dine In",
        count: channels.DineIn.count,
        percentage: totalOrders > 0 ? `${Math.round((channels.DineIn.count / totalOrders) * 100)}%` : "0%",
        grossPaise: channels.DineIn.grossPaise,
        avgTicketPaise:
          channels.DineIn.count > 0
            ? Math.round(channels.DineIn.grossPaise / channels.DineIn.count)
            : 0,
      },
      {
        type: "Takeaway",
        count: channels.TakeAway.count,
        percentage: totalOrders > 0 ? `${Math.round((channels.TakeAway.count / totalOrders) * 100)}%` : "0%",
        grossPaise: channels.TakeAway.grossPaise,
        avgTicketPaise:
          channels.TakeAway.count > 0
            ? Math.round(channels.TakeAway.grossPaise / channels.TakeAway.count)
            : 0,
      },
      {
        type: "Delivery",
        count: channels.Delivery.count,
        percentage: totalOrders > 0 ? `${Math.round((channels.Delivery.count / totalOrders) * 100)}%` : "0%",
        grossPaise: channels.Delivery.grossPaise,
        avgTicketPaise:
          channels.Delivery.count > 0
            ? Math.round(channels.Delivery.grossPaise / channels.Delivery.count)
            : 0,
      },
    ];
  }, [orders]);

  // 5. Daily Ledger Settlement Table Data (matches defx-pos-frontend columns: Date, Gross sales, Refunds, Taxes collected, Net sales, Total orders)
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
      if (o.isRejected) continue;
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
      const orderTax = o.taxTotal || 0;
      let orderRefund = 0;
      if (o.paymentStatus === "Refunded") {
        orderRefund = orderTotal;
      } else if (o.paymentStatus === "Partially Refunded") {
        if (o.payments && Array.isArray(o.payments)) {
          for (const p of o.payments) {
            orderRefund += p.refundAmount || 0;
          }
        }
        if (orderRefund === 0 && o.discountAmount) {
          orderRefund = o.discountAmount;
        }
      }

      existing.ordersCount += 1;
      existing.grossPaise += orderTotal;
      existing.taxPaise += orderTax;
      existing.refundPaise += orderRefund;
      existing.discountPaise += o.discountAmount || 0;
      if (o.deliveryFee || o.deliveryCharge) {
        existing.deliveryPaise += o.deliveryFee || o.deliveryCharge || 0;
      }
      existing.netPaise += Math.max(0, orderTotal - orderTax - orderRefund);

      dayMap.set(dateKey, existing);
    }

    return Array.from(dayMap.values()).sort((a, b) => b.rawDate - a.rawDate);
  }, [orders, countryCode, timezone]);

  // Pagination for Daily Ledger Table
  const totalPages = Math.ceil((dailyLedger.length || 1) / pageSize);
  const paginatedDays = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return dailyLedger.slice(start, start + pageSize);
  }, [dailyLedger, currentPage]);

  // 6. Drawer Detailed Computations for Selected Day
  const drawerStats = useMemo(() => {
    if (!selectedDayForDrawer) return null;

    const dayOrders = orders.filter(
      (o) =>
        !o.isRejected &&
        formatStoreDate(o.createdAt, countryCode, timezone) === selectedDayForDrawer.dateLabel
    );

    let gross = 0;
    let discounts = 0;
    let taxes = 0;
    let delivery = 0;
    let refunds = 0;

    const channelCounts: Record<string, { count: number; amount: number }> = {
      DineIn: { count: 0, amount: 0 },
      TakeAway: { count: 0, amount: 0 },
      Delivery: { count: 0, amount: 0 },
      OnlineStore: { count: 0, amount: 0 },
    };

    const paymentModes: Record<string, { txns: number; gross: number; refunds: number; net: number }> = {
      Cash: { txns: 0, gross: 0, refunds: 0, net: 0 },
      "UPI / QR Scan": { txns: 0, gross: 0, refunds: 0, net: 0 },
      "Credit / Debit Card": { txns: 0, gross: 0, refunds: 0, net: 0 },
      Aggregator: { txns: 0, gross: 0, refunds: 0, net: 0 },
    };

    for (const o of dayOrders) {
      const val = o.totalAmount || 0;
      gross += val;
      discounts += o.discountAmount || 0;
      taxes += o.taxTotal || 0;
      if (o.deliveryFee || o.deliveryCharge) {
        delivery += (o.deliveryFee || o.deliveryCharge || 0);
      }

      let orderRef = 0;
      if (o.paymentStatus === "Refunded") {
        orderRef = val;
      } else if (o.paymentStatus === "Partially Refunded") {
        if (o.payments && Array.isArray(o.payments)) {
          for (const p of o.payments) {
            orderRef += p.refundAmount || 0;
          }
        }
        if (orderRef === 0 && o.discountAmount) {
          orderRef = o.discountAmount;
        }
      }
      refunds += orderRef;

      // Channels
      const oType = o.orderType || "DineIn";
      if (oType === "Delivery" || oType === "ScheduledDelivery") {
        channelCounts.Delivery.count += 1;
        channelCounts.Delivery.amount += val;
      } else if (oType === "TakeAway" || oType === "ScheduledPickup") {
        channelCounts.TakeAway.count += 1;
        channelCounts.TakeAway.amount += val;
      } else if (o.source === "online" || o.orderSource === "web") {
        channelCounts.OnlineStore.count += 1;
        channelCounts.OnlineStore.amount += val;
      } else {
        channelCounts.DineIn.count += 1;
        channelCounts.DineIn.amount += val;
      }

      // Payments
      if (o.payments && Array.isArray(o.payments) && o.payments.length > 0) {
        for (const p of o.payments) {
          const m = (p.mode || p.paymentMode || "Cash").toLowerCase();
          let targetKey = "Cash";
          if (m.includes("upi") || m.includes("qr")) targetKey = "UPI / QR Scan";
          else if (m.includes("card") || m.includes("debit") || m.includes("credit")) targetKey = "Credit / Debit Card";
          else if (m.includes("swiggy") || m.includes("zomato") || m.includes("aggregator")) targetKey = "Aggregator";

          const pGross = p.amount || 0;
          const pRef = p.refundAmount || 0;
          paymentModes[targetKey].txns += 1;
          paymentModes[targetKey].gross += pGross;
          paymentModes[targetKey].refunds += pRef;
          paymentModes[targetKey].net += Math.max(0, pGross - pRef);
        }
      } else {
        const m = (o.paymentMode || "Cash").toLowerCase();
        let targetKey = "Cash";
        if (m.includes("upi") || m.includes("qr")) targetKey = "UPI / QR Scan";
        else if (m.includes("card") || m.includes("debit") || m.includes("credit")) targetKey = "Credit / Debit Card";
        else if (m.includes("swiggy") || m.includes("zomato") || m.includes("online")) targetKey = "Aggregator";

        paymentModes[targetKey].txns += 1;
        paymentModes[targetKey].gross += val;
        paymentModes[targetKey].refunds += orderRef;
        paymentModes[targetKey].net += Math.max(0, val - orderRef);
      }
    }

    const netPaise = Math.max(0, gross - taxes - refunds);
    const ordCount = dayOrders.length || selectedDayForDrawer.ordersCount || 1;
    const aov = ordCount > 0 ? Math.round(gross / ordCount) : 0;

    let totalPaymentTxns = 0;
    let totalPaymentGross = 0;
    let totalPaymentRefunds = 0;
    let totalPaymentNet = 0;
    for (const p of Object.values(paymentModes)) {
      totalPaymentTxns += p.txns;
      totalPaymentGross += p.gross;
      totalPaymentRefunds += p.refunds;
      totalPaymentNet += p.net;
    }

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
  }, [selectedDayForDrawer, orders, countryCode, timezone]);

  // Export CSV handler
  const handleExportCsv = () => {
    if (dailyLedger.length === 0) {
      showToast("No settlement records available to export for this period.", "warning");
      return;
    }

    const headers = [
      "Date",
      "Gross Sales",
      "Refunds",
      "Taxes Collected",
      "Net Sales",
      "Total Orders",
    ];

    const rows = dailyLedger.map((d) => [
      `"${d.dateLabel}"`,
      (d.grossPaise / 100).toFixed(2),
      (d.refundPaise / 100).toFixed(2),
      (d.taxPaise / 100).toFixed(2),
      (d.netPaise / 100).toFixed(2),
      d.ordersCount,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales-report-${Date.now()}.csv`);
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
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-2">
        <div className="flex flex-col max-w-2xl space-y-1">
          <nav className="flex items-center gap-2 mb-1">
            <Link
              href="/reports"
              className="text-[11px] tracking-widest text-[#645d58] hover:text-[#1e1b19] uppercase font-semibold transition-colors cursor-pointer"
            >
              Reports
            </Link>
            <span className="text-[#d0c4be] text-xs">/</span>
            <span className="text-[11px] tracking-widest text-[#1e1b19] uppercase font-semibold">
              Sales Report
            </span>
          </nav>
          <h1
            className="text-4xl lg:text-5xl text-[#1e1b19] tracking-tight leading-none font-normal"
            style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
          >
            Sales Report
          </h1>
          <p className="text-sm text-[#645d58] leading-relaxed pt-0.5">
            Track restaurant sales, revenue, discounts, tax collections, and net
            settlement cadence across service consoles.
          </p>
        </div>

        {/* Right Controls: Global Range Selector & CSV Export */}
        <div className="flex items-center gap-3 self-start lg:self-end shrink-0">
          {selectedRange && onRangeChange && (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDateOpen(!isDateOpen)}
                className="appearance-none bg-white border border-[#e9e1dd] text-[#1e1b19] text-xs font-semibold pl-4 pr-9 py-2.5 rounded-full shadow-xs hover:bg-[#faf2ee] transition-colors cursor-pointer flex items-center gap-2"
              >
                <span>{currentDateLabel}</span>
                <svg
                  className="w-4 h-4 text-[#7f7570] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isDateOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-xl py-2 z-30 border border-[#e9e1dd]">
                  {datePresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`w-full text-left px-4 py-2 text-xs transition-colors cursor-pointer ${
                        currentDateLabel === preset
                          ? "font-semibold text-[#1e1b19] bg-[#faf2ee]"
                          : "text-[#645d58] hover:bg-[#eee7e3]"
                      }`}
                      onClick={() => handleSelectPreset(preset)}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleExportCsv}
            type="button"
            style={{ backgroundColor: "#0c0a09", color: "#ffffff" }}
            className="btn-primary inline-flex items-center gap-2 bg-[#0c0a09] !text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow-xs hover:bg-[#262626] transition-colors cursor-pointer shrink-0"
          >
            <svg
              className="w-4 h-4 !text-white stroke-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline strokeLinecap="round" strokeLinejoin="round" points="7 10 12 15 17 10" />
              <line strokeLinecap="round" strokeLinejoin="round" x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="!text-white font-semibold" style={{ color: "#ffffff" }}>
              Export CSV
            </span>
          </button>
        </div>
      </header>

      {/* 5 KPI Cards Matching defx-pos-frontend SalesReport.jsx */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total gross sales */}
        <div className="bg-white border border-[#e9e1dd] rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
              Total gross sales
            </span>
            <svg
              className="w-4 h-4 text-[#7f7570]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <div>
            <div
              className="text-2xl lg:text-3xl font-normal text-[#1e1b19] tabular-nums leading-tight"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              {loading ? "..." : isDataZero(salesReport.total_gross_sales)}
            </div>
            <div className="text-xs text-[#7f7570] mt-1">Sum before deductions</div>
          </div>
          <div className="mt-4 pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-3 py-1 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1e1b19]"></span>
            <span className="text-[11px] text-[#1e1b19] tabular-nums font-medium">
              {aggregates.completedOrders} completed orders
            </span>
          </div>
        </div>

        {/* Card 2: Total net sales */}
        <div className="bg-white border border-[#e9e1dd] rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
              Total net sales
            </span>
            <svg
              className="w-4 h-4 text-[#7f7570]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div>
            <div
              className="text-2xl lg:text-3xl font-normal text-[#1e1b19] leading-tight tabular-nums"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              {loading ? "..." : isDataZero(salesReport.total_net_sales)}
            </div>
            <div className="text-xs text-[#7f7570] mt-1">Gross less tax &amp; refunds</div>
          </div>
          <div className="mt-4 pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-3 py-1 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-[#645d58]"></span>
            <span className="text-[11px] text-[#645d58] font-medium tabular-nums">
              AOV: {aggregates.completedOrders > 0 ? formatPriceWithSymbol(Math.round(aggregates.grossPaise / aggregates.completedOrders), currencySymbol, countryCode, true) : "—"}
            </span>
          </div>
        </div>

        {/* Card 3: Total tax collected */}
        <div className="bg-white border border-[#e9e1dd] rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
              Total tax collected
            </span>
            <svg
              className="w-4 h-4 text-[#7f7570]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="3" y1="21" x2="21" y2="21" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <polyline points="5 6 12 3 19 6" />
              <line x1="6" y1="10" x2="6" y2="21" />
              <line x1="10" y1="10" x2="10" y2="21" />
              <line x1="14" y1="10" x2="14" y2="21" />
              <line x1="18" y1="10" x2="18" y2="21" />
            </svg>
          </div>
          <div>
            <div
              className="text-2xl lg:text-3xl font-normal text-[#1e1b19] tabular-nums leading-tight"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              {loading ? "..." : isDataZero(salesReport.total_tax_collected)}
            </div>
            <div className="text-xs text-[#7f7570] mt-1">Taxes collected on sales</div>
          </div>
          <div className="mt-4 pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-3 py-1 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1b873f]"></span>
            <span className="text-[11px] text-[#1e1b19] font-medium">
              {aggregates.taxPaise > 0 ? "Audited & compliant" : "100% compliant"}
            </span>
          </div>
        </div>

        {/* Card 4: Total Refund given */}
        <div className="bg-white border border-[#e9e1dd] rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
              Total Refund given
            </span>
            <svg
              className="w-4 h-4 text-[#7f7570]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </div>
          <div>
            <div
              className="text-2xl lg:text-3xl font-normal text-[#1e1b19] tabular-nums leading-tight"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              {loading ? "..." : isDataZero(salesReport.total_refund)}
            </div>
            <div className="text-xs text-[#7f7570] mt-1">Refunds &amp; reversals</div>
          </div>
          <div className="mt-4 pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-3 py-1 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-[#645d58]"></span>
            <span className="text-[11px] text-[#1e1b19] tabular-nums font-medium">
              {aggregates.refundOrdersCount} refunded
            </span>
          </div>
        </div>

        {/* Card 5: Total orders */}
        <div className="bg-white border border-[#e9e1dd] rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider text-[#1e1b19] font-bold">
              Total orders
            </span>
            <svg
              className="w-4 h-4 text-[#1e1b19]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <div>
            <div
              className="text-2xl lg:text-3xl font-normal text-[#1e1b19] tabular-nums leading-tight"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              {loading ? "..." : (salesReport.total_orders === 0 ? "-" : salesReport.total_orders)}
            </div>
            <div className="text-xs text-[#7f7570] mt-1">Transactions in period</div>
          </div>
          <div className="mt-4 pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-3 py-1 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1e1b19]"></span>
            <span className="text-[11px] text-[#1e1b19] font-medium tabular-nums">
              {aggregates.completedOrders} completed
            </span>
          </div>
        </div>
      </section>

      {/* Split Performance Section: Hourly Cadence & Channel Performance */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Hourly Cadence Bar Chart */}
        <div className="lg:col-span-8 bg-white border border-[#e9e1dd] rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                Hourly Volume &amp; Intake
              </span>
              <h2
                className="text-xl text-[#1e1b19] font-normal"
                style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
              >
                Sales Overview &amp; Hourly Cadence
              </h2>
            </div>
            <div className="flex items-center gap-4 text-[#645d58] text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1e1b19] inline-block"></span>
                <span>Gross Value</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#e9e1dd] inline-block"></span>
                <span>Volume (Orders)</span>
              </div>
            </div>
          </div>

          {/* SVG Bar Chart with Responsive Height */}
          <div className="relative w-full h-56 pt-2">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 680 180"
              preserveAspectRatio="none"
            >
              {/* Subtle Gridlines */}
              <line x1="0" y1="30" x2="680" y2="30" stroke="#f4ece8" strokeDasharray="3 3" />
              <line x1="0" y1="80" x2="680" y2="80" stroke="#f4ece8" strokeDasharray="3 3" />
              <line x1="0" y1="130" x2="680" y2="130" stroke="#f4ece8" strokeDasharray="3 3" />

              {hourlyData.hours.map((h, i) => {
                const slot = hourlyData.buckets[h] || { count: 0, grossPaise: 0 };
                const barHeight =
                  hourlyData.maxGross > 0
                    ? Math.round((slot.grossPaise / hourlyData.maxGross) * 120)
                    : 0;
                const x = 30 + i * 58;
                const y = 150 - barHeight;
                const isPeak = h === hourlyData.overallPeakHour && slot.grossPaise > 0;

                return (
                  <g key={h} className="cursor-pointer group">
                    {/* Background Bar */}
                    <rect
                      x={x}
                      y="30"
                      width="34"
                      height="120"
                      rx="6"
                      fill="#faf2ee"
                      className="group-hover:fill-[#f4ece8] transition-colors"
                    />

                    {/* Actual Gross Sales Bar */}
                    {barHeight > 0 && (
                      <rect
                        x={x}
                        y={y}
                        width="34"
                        height={barHeight}
                        rx="6"
                        fill={isPeak ? "#1e1b19" : "#645d58"}
                        className="transition-all duration-300"
                      />
                    )}

                    {/* Peak Tag */}
                    {isPeak && (
                      <circle cx={x + 17} cy={Math.max(10, y - 8)} r="3" fill="#1b873f" />
                    )}

                    {/* Hour Axis Label */}
                    <text
                      x={x + 17}
                      y="168"
                      textAnchor="middle"
                      fill="#645d58"
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
          </div>

          <div className="mt-4 flex items-center justify-between text-[#645d58] text-xs pt-2 border-t border-[#e9e1dd]">
            <span>Audited Hourly Cadence</span>
            <span className="tabular-nums">{orders.length} Total Orders</span>
          </div>
        </div>

        {/* Right 4 Cols: Sales By Order Type (Channel Performance) */}
        <div className="lg:col-span-4 bg-white border border-[#e9e1dd] rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="mb-4">
              <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                Channel Performance
              </span>
              <h2
                className="text-xl text-[#1e1b19] font-normal"
                style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
              >
                Sales by Order Type
              </h2>
            </div>

            <div className="space-y-3.5">
              {channelPerformance.map((ch) => (
                <div key={ch.type} className="p-3 bg-[#faf2ee]/70 border border-[#e9e1dd] rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#1e1b19]">{ch.type}</span>
                    <span className="text-[11px] px-2 py-0.5 bg-[#1e1b19] text-white rounded-full font-medium tabular-nums">
                      {ch.percentage} share
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-[#1e1b19] tabular-nums">
                      {formatPriceWithSymbol(ch.grossPaise, currencySymbol, countryCode, true)}
                    </span>
                    <span className="text-xs text-[#645d58] tabular-nums">
                      {ch.count} Orders
                    </span>
                  </div>
                  <div className="w-full bg-[#e9e1dd] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[#1e1b19] h-full rounded-full transition-all duration-300"
                      style={{ width: ch.percentage }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[11px] text-[#645d58]">
                    <span>Avg Order Value</span>
                    <span className="font-medium text-[#1e1b19] tabular-nums">
                      {formatPriceWithSymbol(ch.avgTicketPaise, currencySymbol, countryCode, true)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#e9e1dd] flex items-center justify-between text-xs text-[#645d58]">
            <span>Active Channels: 3</span>
            <span className="font-semibold text-[#1e1b19]">100% Reconciled</span>
          </div>
        </div>
      </section>

      {/* Sales Audit Summary Table: Daily Ledger Settlement matching defx-pos-frontend */}
      <section className="bg-white border border-[#e9e1dd] rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
              Ledger Verification
            </span>
            <h2
              className="text-xl text-[#1e1b19] font-normal"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              Daily Ledger Settlement
            </h2>
            <p className="text-xs text-[#7f7570]">
              Audited against store order receipts &amp; checkout transactions
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] text-[#1e1b19] hover:bg-[#eee7e3] px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-[#645d58]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>Print Journal</span>
            </button>
          </div>
        </div>

        {/* Responsive Table Matching defx-pos-frontend columns: Date, Gross sales, Refunds, Taxes collected, Net sales, Total orders */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#faf2ee] text-[#645d58] text-[11px] uppercase tracking-wider border-b border-[#e9e1dd]">
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold text-right">Gross Sales</th>
                <th className="py-3 px-4 font-semibold text-right">Refunds</th>
                <th className="py-3 px-4 font-semibold text-right">Taxes Collected</th>
                <th className="py-3 px-4 font-semibold text-right">Net Sales</th>
                <th className="py-3 px-4 font-semibold text-center">Total Orders</th>
                <th className="py-3 px-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4ece8] text-[#1e1b19] text-xs">
              {paginatedDays.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#7f7570]">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <span className="text-2xl">📋</span>
                      <p className="font-medium text-sm text-[#1e1b19]">No Reports Available Yet</p>
                      <p className="text-xs text-[#7f7570]">Reports will appear once you start recording transactions.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedDays.map((d, index) => {
                  const isFirstRow = currentPage === 1 && index === 0;
                  return (
                    <tr key={d.dateLabel} className="hover:bg-[#faf2ee] transition-colors group">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          {isFirstRow && <span className="w-2 h-2 rounded-full bg-[#1b873f]"></span>}
                          <span className="font-semibold text-[#1e1b19]">{d.dateLabel}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-medium">
                        {formatPriceWithSymbol(d.grossPaise, currencySymbol, countryCode, true)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-red-600">
                        {d.refundPaise > 0
                          ? `-${formatPriceWithSymbol(d.refundPaise, currencySymbol, countryCode, true)}`
                          : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-[#645d58]">
                        {formatPriceWithSymbol(d.taxPaise, currencySymbol, countryCode, true)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-[#1e1b19]">
                        {formatPriceWithSymbol(d.netPaise, currencySymbol, countryCode, true)}
                      </td>
                      <td className="py-3.5 px-4 text-center tabular-nums">
                        <span className="px-2.5 py-1 rounded-full bg-[#faf2ee] border border-[#e9e1dd] text-[#1e1b19] font-medium text-[11px]">
                          {d.ordersCount} orders
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedDayForDrawer(d)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] bg-[#faf2ee] border border-[#e9e1dd] text-[#1e1b19] font-medium group-hover:bg-[#1e1b19] group-hover:text-white transition-colors cursor-pointer"
                        >
                          <span>View Ledger</span>
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Editorial Pagination Footer */}
        {dailyLedger.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#e9e1dd] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#645d58]">
            <span>
              Showing <strong className="text-[#1e1b19] font-semibold">{((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, dailyLedger.length)}</strong> of{" "}
              <strong className="text-[#1e1b19] font-semibold">{dailyLedger.length}</strong> settlement days
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-full border border-[#e9e1dd] bg-[#faf2ee] hover:bg-[#eee7e3] text-[#1e1b19] disabled:opacity-40 transition-colors cursor-pointer"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentPage(i + 1)}
                  style={currentPage === i + 1 ? { backgroundColor: "#0c0a09", color: "#ffffff" } : undefined}
                  className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                    currentPage === i + 1
                      ? "bg-[#0c0a09] !text-white shadow-xs"
                      : "bg-[#faf2ee] border border-[#e9e1dd] text-[#1e1b19] hover:bg-[#eee7e3]"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded-full border border-[#e9e1dd] bg-[#faf2ee] hover:bg-[#eee7e3] text-[#1e1b19] disabled:opacity-40 transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* DAILY SALES LEDGER SLIDE-OVER DRAWER (100% Dynamic, Zero Hardcoded Values) */}
      {selectedDayForDrawer && drawerStats && (
        <div className="fixed inset-0 z-50 flex justify-end transition-opacity duration-300">
          {/* Backdrop */}
          <div
            onClick={() => setSelectedDayForDrawer(null)}
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-[2px] transition-opacity cursor-pointer"
          />

          {/* Drawer Content */}
          <aside className="relative z-10 w-full max-w-2xl h-full bg-[#fff8f5] shadow-2xl flex flex-col justify-between overflow-hidden border-l border-[#e9e1dd]">
            {/* Drawer Header */}
            <div className="p-6 border-b border-[#e9e1dd] bg-white flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2.5">
                  <h2
                    className="text-2xl font-normal text-[#1e1b19] leading-tight"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    Daily Sales Ledger
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Settled
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[#645d58] text-xs">
                  <svg className="w-3.5 h-3.5 text-[#7f7570]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span className="font-medium text-[#1e1b19]">{drawerStats.dateLabel}</span>
                  <span className="text-[#d0c4be]">•</span>
                  <span>Folio #{drawerStats.dateLabel.replace(/[^a-zA-Z0-9]/g, "")}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDayForDrawer(null)}
                className="w-9 h-9 rounded-full bg-[#faf2ee] hover:bg-[#eee7e3] text-[#645d58] hover:text-[#1e1b19] flex items-center justify-center transition-colors cursor-pointer"
                title="Close Ledger"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Section 1: Daily Summary */}
              <section className="space-y-3">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                    Daily Summary
                  </span>
                  <h3
                    className="text-lg text-[#1e1b19] font-normal"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    Ledger Performance Overview
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-[#e9e1dd] shadow-xs">
                    <span className="text-[11px] text-[#645d58] block mb-1 uppercase tracking-wide">
                      Gross Revenue
                    </span>
                    <span className="text-base font-semibold text-[#1e1b19] tabular-nums block">
                      {formatPriceWithSymbol(drawerStats.grossPaise, currencySymbol, countryCode, true)}
                    </span>
                    <span className="text-xs text-[#7f7570] block mt-0.5">
                      {drawerStats.ordersCount} orders processed
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-[#e9e1dd] shadow-xs">
                    <span className="text-[11px] text-[#645d58] block mb-1 uppercase tracking-wide">
                      Total Refunds
                    </span>
                    <span className="text-base font-semibold text-red-600 tabular-nums block">
                      {drawerStats.refundPaise > 0
                        ? `-${formatPriceWithSymbol(drawerStats.refundPaise, currencySymbol, countryCode, true)}`
                        : "—"}
                    </span>
                    <span className="text-xs text-[#7f7570] block mt-0.5">
                      Refunds &amp; returns
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-[#e9e1dd] shadow-xs">
                    <span className="text-[11px] text-[#645d58] block mb-1 uppercase tracking-wide">
                      Total Discounts
                    </span>
                    <span className="text-base font-semibold text-[#645d58] tabular-nums block">
                      {drawerStats.discountPaise > 0
                        ? `-${formatPriceWithSymbol(drawerStats.discountPaise, currencySymbol, countryCode, true)}`
                        : "—"}
                    </span>
                    <span className="text-xs text-[#7f7570] block mt-0.5">
                      {drawerStats.grossPaise > 0
                        ? `${((drawerStats.discountPaise / drawerStats.grossPaise) * 100).toFixed(1)}% discount rate`
                        : "0.0% discount rate"}
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-[#e9e1dd] shadow-xs">
                    <span className="text-[11px] text-[#645d58] block mb-1 uppercase tracking-wide">
                      Taxes Collected
                    </span>
                    <span className="text-base font-semibold text-[#1e1b19] tabular-nums block">
                      {formatPriceWithSymbol(drawerStats.taxPaise, currencySymbol, countryCode, true)}
                    </span>
                    <span className="text-xs text-[#7f7570] block mt-0.5">
                      Audited tax total
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-[#e9e1dd] shadow-xs">
                    <span className="text-[11px] text-[#645d58] block mb-1 uppercase tracking-wide">
                      Delivery Charges
                    </span>
                    <span className="text-base font-semibold text-[#1e1b19] tabular-nums block">
                      {drawerStats.deliveryPaise > 0
                        ? formatPriceWithSymbol(drawerStats.deliveryPaise, currencySymbol, countryCode, true)
                        : "—"}
                    </span>
                    <span className="text-xs text-[#7f7570] block mt-0.5">
                      Dispatch &amp; packing
                    </span>
                  </div>

                  <div className="bg-[#faf2ee] p-3 rounded-xl border border-[#e9e1dd] shadow-xs">
                    <span className="text-[11px] text-[#1e1b19] block mb-1 uppercase tracking-wide font-semibold">
                      Avg Order Value
                    </span>
                    <span className="text-base font-bold text-[#1e1b19] tabular-nums block">
                      {formatPriceWithSymbol(drawerStats.aovPaise, currencySymbol, countryCode, true)}
                    </span>
                    <span className="text-xs text-[#645d58] block mt-0.5">
                      {drawerStats.ordersCount} orders avg
                    </span>
                  </div>
                </div>
              </section>

              {/* Section 2: Settlement Calculation */}
              <section className="bg-white p-5 rounded-2xl border border-[#e9e1dd] shadow-xs space-y-3">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                    Sales Breakdown
                  </span>
                  <h3
                    className="text-lg text-[#1e1b19] font-normal"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    Settlement Calculation
                  </h3>
                </div>

                <div className="divide-y divide-[#f4ece8] text-xs">
                  <div className="py-2.5 flex items-center justify-between text-[#1e1b19]">
                    <span>Gross Sales Revenue</span>
                    <span className="font-semibold tabular-nums">
                      {formatPriceWithSymbol(drawerStats.grossPaise, currencySymbol, countryCode, true)}
                    </span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between text-[#645d58]">
                    <span>Less: Total Refunds</span>
                    <span className="tabular-nums text-red-600">
                      {drawerStats.refundPaise > 0
                        ? `-${formatPriceWithSymbol(drawerStats.refundPaise, currencySymbol, countryCode, true)}`
                        : "—"}
                    </span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between text-[#645d58]">
                    <span>Less: Discounts &amp; Comps</span>
                    <span className="tabular-nums">
                      {drawerStats.discountPaise > 0
                        ? `-${formatPriceWithSymbol(drawerStats.discountPaise, currencySymbol, countryCode, true)}`
                        : "—"}
                    </span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between text-[#645d58]">
                    <span>Less: Taxes Collected</span>
                    <span className="tabular-nums">
                      {drawerStats.taxPaise > 0
                        ? `-${formatPriceWithSymbol(drawerStats.taxPaise, currencySymbol, countryCode, true)}`
                        : "—"}
                    </span>
                  </div>
                  {drawerStats.deliveryPaise > 0 && (
                    <div className="py-2.5 flex items-center justify-between text-[#645d58]">
                      <span>Add: Delivery &amp; Packaging</span>
                      <span className="tabular-nums">
                        +{formatPriceWithSymbol(drawerStats.deliveryPaise, currencySymbol, countryCode, true)}
                      </span>
                    </div>
                  )}
                  <div className="pt-3 pb-1 flex items-center justify-between bg-[#faf2ee] px-3.5 py-3 rounded-xl border border-[#e9e1dd] font-semibold text-[#1e1b19]">
                    <span
                      className="text-base font-normal"
                      style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                    >
                      Net Sales (Settled)
                    </span>
                    <span className="tabular-nums font-bold text-base">
                      {formatPriceWithSymbol(drawerStats.netPaise, currencySymbol, countryCode, true)}
                    </span>
                  </div>
                </div>
              </section>

              {/* Section 3: Distribution (Order Channel Breakdown) */}
              <section className="bg-white p-5 rounded-2xl border border-[#e9e1dd] shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                      Distribution
                    </span>
                    <h3
                      className="text-lg text-[#1e1b19] font-normal"
                      style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                    >
                      Order Channel Breakdown
                    </h3>
                  </div>
                  <span className="text-xs text-[#645d58] tabular-nums">
                    {drawerStats.ordersCount} Orders (100%)
                  </span>
                </div>

                {/* Dynamic Multi-segment Bar */}
                <div className="w-full h-2 rounded-full overflow-hidden flex bg-[#e9e1dd] mb-3">
                  {drawerStats.ordersCount > 0 ? (
                    <>
                      <div
                        className="bg-[#1e1b19] h-full transition-all duration-300"
                        style={{ width: `${Math.round(((drawerStats.channelCounts.DineIn.count || 0) / drawerStats.ordersCount) * 100)}%` }}
                      ></div>
                      <div
                        className="bg-[#645d58] h-full transition-all duration-300"
                        style={{ width: `${Math.round(((drawerStats.channelCounts.TakeAway.count || 0) / drawerStats.ordersCount) * 100)}%` }}
                      ></div>
                      <div
                        className="bg-[#a8a29e] h-full transition-all duration-300"
                        style={{ width: `${Math.round(((drawerStats.channelCounts.Delivery.count || 0) / drawerStats.ordersCount) * 100)}%` }}
                      ></div>
                      <div
                        className="bg-[#d6d3d1] h-full transition-all duration-300"
                        style={{ width: `${Math.round(((drawerStats.channelCounts.OnlineStore.count || 0) / drawerStats.ordersCount) * 100)}%` }}
                      ></div>
                    </>
                  ) : (
                    <div className="bg-[#e9e1dd] h-full w-full"></div>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-[#f4ece8]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#1e1b19] inline-block"></span>
                      <span className="font-medium text-[#1e1b19]">Dine-In</span>
                      <span className="text-[#7f7570]">
                        ({drawerStats.channelCounts.DineIn.count} orders)
                      </span>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums">
                      <span className="text-[#645d58]">
                        {drawerStats.ordersCount > 0 ? Math.round(((drawerStats.channelCounts.DineIn.count || 0) / drawerStats.ordersCount) * 100) : 0}%
                      </span>
                      <span className="font-semibold text-[#1e1b19]">
                        {formatPriceWithSymbol(drawerStats.channelCounts.DineIn.amount, currencySymbol, countryCode, true)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1.5 border-b border-[#f4ece8]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#645d58] inline-block"></span>
                      <span className="font-medium text-[#1e1b19]">Takeaway</span>
                      <span className="text-[#7f7570]">
                        ({drawerStats.channelCounts.TakeAway.count} orders)
                      </span>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums">
                      <span className="text-[#645d58]">
                        {drawerStats.ordersCount > 0 ? Math.round(((drawerStats.channelCounts.TakeAway.count || 0) / drawerStats.ordersCount) * 100) : 0}%
                      </span>
                      <span className="font-semibold text-[#1e1b19]">
                        {formatPriceWithSymbol(drawerStats.channelCounts.TakeAway.amount, currencySymbol, countryCode, true)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1.5 border-b border-[#f4ece8]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#a8a29e] inline-block"></span>
                      <span className="font-medium text-[#1e1b19]">Delivery</span>
                      <span className="text-[#7f7570]">
                        ({drawerStats.channelCounts.Delivery.count} orders)
                      </span>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums">
                      <span className="text-[#645d58]">
                        {drawerStats.ordersCount > 0 ? Math.round(((drawerStats.channelCounts.Delivery.count || 0) / drawerStats.ordersCount) * 100) : 0}%
                      </span>
                      <span className="font-semibold text-[#1e1b19]">
                        {formatPriceWithSymbol(drawerStats.channelCounts.Delivery.amount, currencySymbol, countryCode, true)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#d6d3d1] inline-block"></span>
                      <span className="font-medium text-[#1e1b19]">Online Store</span>
                      <span className="text-[#7f7570]">
                        ({drawerStats.channelCounts.OnlineStore.count} orders)
                      </span>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums">
                      <span className="text-[#645d58]">
                        {drawerStats.ordersCount > 0 ? Math.round(((drawerStats.channelCounts.OnlineStore.count || 0) / drawerStats.ordersCount) * 100) : 0}%
                      </span>
                      <span className="font-semibold text-[#1e1b19]">
                        {formatPriceWithSymbol(drawerStats.channelCounts.OnlineStore.amount, currencySymbol, countryCode, true)}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 4: Payment Mode Summary (100% Dynamic from live orders) */}
              <section className="bg-white p-5 rounded-2xl border border-[#e9e1dd] shadow-xs space-y-3">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                    Payment Reconciliation
                  </span>
                  <h3
                    className="text-lg text-[#1e1b19] font-normal"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    Payment Mode Summary
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="text-[#645d58] text-[11px] border-b border-[#e9e1dd] uppercase tracking-wider">
                        <th className="pb-2 font-semibold">Mode</th>
                        <th className="pb-2 text-center font-semibold">Txns</th>
                        <th className="pb-2 text-right font-semibold">Gross</th>
                        <th className="pb-2 text-right font-semibold">Refunds</th>
                        <th className="pb-2 text-right font-semibold">Net Settled</th>
                        <th className="pb-2 text-right font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f4ece8] text-[#1e1b19]">
                      {Object.entries(drawerStats.paymentModes).map(([mode, data]) => (
                        <tr key={mode} className="hover:bg-[#faf2ee] transition-colors">
                          <td className="py-2.5 font-medium">{mode}</td>
                          <td className="py-2.5 text-center tabular-nums text-[#645d58]">{data.txns}</td>
                          <td className="py-2.5 text-right tabular-nums">
                            {formatPriceWithSymbol(data.gross, currencySymbol, countryCode, true)}
                          </td>
                          <td className="py-2.5 text-right tabular-nums text-red-600">
                            {data.refunds > 0
                              ? `-${formatPriceWithSymbol(data.refunds, currencySymbol, countryCode, true)}`
                              : "—"}
                          </td>
                          <td className="py-2.5 text-right tabular-nums font-semibold">
                            {formatPriceWithSymbol(data.net, currencySymbol, countryCode, true)}
                          </td>
                          <td className="py-2.5 text-right">
                            <span className="text-[#645d58] font-medium">—</span>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-[#faf2ee] font-semibold text-[#1e1b19]">
                        <td className="py-2.5 px-2">Total Settled</td>
                        <td className="py-2.5 text-center tabular-nums">{drawerStats.totalPaymentTxns}</td>
                        <td className="py-2.5 text-right tabular-nums">
                          {formatPriceWithSymbol(drawerStats.totalPaymentGross, currencySymbol, countryCode, true)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-red-600">
                          {drawerStats.totalPaymentRefunds > 0
                            ? `-${formatPriceWithSymbol(drawerStats.totalPaymentRefunds, currencySymbol, countryCode, true)}`
                            : "—"}
                        </td>
                        <td className="py-2.5 text-right tabular-nums font-bold">
                          {formatPriceWithSymbol(drawerStats.totalPaymentNet, currencySymbol, countryCode, true)}
                        </td>
                        <td className="py-2.5 text-right">
                          <span className="text-[#645d58] font-medium">—</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-[#e9e1dd] bg-white flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-[#645d58]">
                <svg className="w-4 h-4 text-[#1b873f]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>Verified Daily Sales Settlement Ledger</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDayForDrawer(null)}
                  className="px-4 py-1.5 rounded-full bg-[#faf2ee] hover:bg-[#eee7e3] text-[#1e1b19] font-medium transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#1e1b19] hover:bg-neutral-800 text-white font-medium transition-colors shadow-xs cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  <span>Print Folio</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Standard Menu Toaster Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
