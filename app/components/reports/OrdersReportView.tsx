"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  formatPriceWithSymbol,
  formatStoreDate,
  formatStoreTime,
} from "../../../lib/constants/countries";
import { DateRange } from "./ReportHeader";
import {
  computeOrdersReportData,
  formatDeliveryTime,
  isDataZero,
} from "../../reports/reportCalculations";
import { Toast, type ToastMessage } from "../Toast";

interface OrdersReportViewProps {
  orders: any[];
  loading?: boolean;
  currencySymbol?: string;
  countryCode?: string;
  timezone?: string;
  selectedRange?: DateRange;
  onRangeChange?: (range: DateRange) => void;
}

export function OrdersReportView({
  orders = [],
  loading = false,
  currencySymbol = "₹",
  countryCode = "IN",
  timezone,
  selectedRange,
  onRangeChange,
}: OrdersReportViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Standard Menu Toaster Notification State
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "info",
    subtext?: string,
  ) => {
    setToast({ message, type, subtext });
  };

  // Search & Filter state for Daily Orders Table
  const [searchQuery, setSearchQuery] = useState("");
  const [orderTypeFilter, setOrderTypeFilter] = useState("all");

  // Selected Day state for Drawer
  const [selectedDayForDrawer, setSelectedDayForDrawer] = useState<any | null>(
    null,
  );

  // Date range dropdown state
  const [isDateOpen, setIsDateOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Channel filter dropdown state
  const [isChannelOpen, setIsChannelOpen] = useState(false);
  const channelDropdownRef = useRef<HTMLDivElement>(null);

  const channelOptions = [
    { value: "all", label: "All Channels" },
    { value: "dine", label: "Dine In" },
    { value: "takeaway", label: "Takeaway" },
    { value: "delivery", label: "Delivery" },
  ];
  const currentChannelLabel =
    channelOptions.find((c) => c.value === orderTypeFilter)?.label ||
    "All Channels";

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDateOpen(false);
      }
      if (
        channelDropdownRef.current &&
        !channelDropdownRef.current.contains(event.target as Node)
      ) {
        setIsChannelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const datePresets = [
    "Today",
    "Yesterday",
    "Last 7 Days",
    "This Month",
    "Last Month",
  ];
  const currentDateLabel = selectedRange?.preset || "Today";

  const handleSelectPreset = (presetName: string) => {
    setIsDateOpen(false);
    if (!onRangeChange) return;

    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (presetName === "Today") {
      start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
      );
      end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
      );
    } else if (presetName === "Yesterday") {
      start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
        0,
        0,
        0,
      );
      end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
        23,
        59,
        59,
      );
    } else if (presetName === "Last 7 Days") {
      start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 6,
        0,
        0,
        0,
      );
      end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
      );
    } else if (presetName === "This Month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
      );
    } else if (presetName === "Last Month") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }

    onRangeChange({ startDate: start, endDate: end, preset: presetName });
  };

  // Compute 100% Dynamic Orders Report Data matching defx-pos-frontend OrdersReport.jsx
  const reportData = useMemo(() => {
    return computeOrdersReportData(
      orders,
      currencySymbol,
      countryCode,
      timezone,
    );
  }, [orders, currencySymbol, countryCode, timezone]);

  // Aggregate Metrics & Fulfillment Channel Overview
  const channelBreakdown = useMemo(() => {
    const channels: Record<
      string,
      { count: number; grossPaise: number; refunded: number }
    > = {
      "Dine In": { count: 0, grossPaise: 0, refunded: 0 },
      Takeaway: { count: 0, grossPaise: 0, refunded: 0 },
      Delivery: { count: 0, grossPaise: 0, refunded: 0 },
    };

    let totalCompleted = 0;
    let totalRefunded = 0;

    for (const o of orders) {
      if (o.isRejected) continue;
      const type = (o.orderType || "").toLowerCase();
      let key = "Dine In";
      if (type.includes("delivery")) key = "Delivery";
      else if (type.includes("takeaway") || type.includes("pickup"))
        key = "Takeaway";

      channels[key].count += 1;
      channels[key].grossPaise += o.totalAmount || 0;
      if (o.paymentStatus === "Refunded") {
        channels[key].refunded += 1;
        totalRefunded += 1;
      } else {
        totalCompleted += 1;
      }
    }

    const totalValid = orders.filter((o) => !o.isRejected).length;

    return {
      channels: Object.entries(channels).map(([name, stats]) => ({
        name,
        count: stats.count,
        grossPaise: stats.grossPaise,
        refunded: stats.refunded,
        percentage:
          totalValid > 0 ? Math.round((stats.count / totalValid) * 100) : 0,
        aov: stats.count > 0 ? Math.round(stats.grossPaise / stats.count) : 0,
      })),
      totalValid,
      totalCompleted,
      totalRefunded,
    };
  }, [orders]);

  // Filtered Daily Orders Table Data
  const filteredDailyData = useMemo(() => {
    return reportData.orders_data.filter((row) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        row.date.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.avg_order_type.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType =
        orderTypeFilter === "all" ||
        row.avg_order_type
          .toLowerCase()
          .includes(orderTypeFilter.toLowerCase());

      return matchesSearch && matchesType;
    });
  }, [reportData.orders_data, searchQuery, orderTypeFilter]);

  // Paginated Daily Orders Table
  const totalPages = Math.ceil((filteredDailyData.length || 1) / pageSize);
  const paginatedDailyData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDailyData.slice(start, start + pageSize);
  }, [filteredDailyData, currentPage]);

  // Drawer stats for selected day
  const drawerStats = useMemo(() => {
    if (!selectedDayForDrawer) return null;

    const dayOrders = orders.filter(
      (o) =>
        !o.isRejected &&
        formatStoreDate(o.createdAt, countryCode, timezone) ===
          selectedDayForDrawer.date,
    );

    let gross = 0;
    let refunds = 0;
    const typeCounts: Record<string, number> = {
      "Dine In": 0,
      Takeaway: 0,
      Delivery: 0,
    };

    for (const o of dayOrders) {
      gross += o.totalAmount || 0;
      if (o.paymentStatus === "Refunded") {
        refunds += o.totalAmount || 0;
      }
      const type = (o.orderType || "").toLowerCase();
      if (type.includes("delivery")) typeCounts.Delivery += 1;
      else if (type.includes("takeaway") || type.includes("pickup"))
        typeCounts.Takeaway += 1;
      else typeCounts["Dine In"] += 1;
    }

    return {
      date: selectedDayForDrawer.date,
      ordersCount: dayOrders.length,
      grossPaise: gross,
      refundPaise: refunds,
      typeCounts,
      dayOrders: dayOrders.sort((a, b) => b.createdAt - a.createdAt),
    };
  }, [selectedDayForDrawer, orders, countryCode, timezone]);

  // Export CSV handler
  const handleExportCsv = () => {
    if (reportData.orders_data.length === 0) {
      showToast("No orders available to export for this period.", "warning");
      return;
    }

    const headers = [
      "Date",
      "Total Orders",
      "Avg Order Value",
      "Avg Delivery Time",
      "Peak Order Time Frame",
      "Avg Items Per Order",
      "Predominant Order Type",
    ];

    const rows = reportData.orders_data.map((d) => [
      `"${d.date}"`,
      d.total_orders,
      `"${d.avg_order_value}"`,
      `"${d.average_delivery_time}"`,
      `"${d.peak_order_time_frame}"`,
      d.avg_items_per_order,
      `"${d.avg_order_type}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `orders-report-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Orders report CSV exported successfully", "success");
  };

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Editorial Page Header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 sm:gap-6 mb-2">
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
              Orders Report
            </span>
          </nav>
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl text-[#1e1b19] tracking-tight leading-none font-normal"
            style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
          >
            Orders Report
          </h1>
          <p className="text-xs sm:text-sm text-[#645d58] leading-relaxed pt-0.5">
            Review fulfillment throughput, channel performance, turnaround
            velocity, and peak store cadence.
          </p>
        </div>

        {/* Right Controls: Global Range Selector, Print, and CSV Export */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 self-start lg:self-end shrink-0 w-full sm:w-auto">
          {selectedRange && onRangeChange && (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDateOpen(!isDateOpen)}
                className="appearance-none bg-white border border-[#e9e1dd] text-[#1e1b19] text-xs font-semibold pl-3.5 sm:pl-4 pr-8 sm:pr-9 py-2 sm:py-2.5 rounded-full shadow-xs hover:bg-[#faf2ee] transition-colors cursor-pointer flex items-center gap-2"
              >
                <span>{currentDateLabel}</span>
                <svg
                  className="w-4 h-4 text-[#7f7570] absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isDateOpen && (
                <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-48 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl py-2 z-50 border border-[#e9e1dd]">
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
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] text-[#1e1b19] hover:bg-[#eee7e3] px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-full text-xs font-semibold transition-colors cursor-pointer"
            title="Print Orders Report"
          >
            <svg
              className="w-4 h-4 text-[#645d58]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <span className="hidden sm:inline">Print</span>
          </button>

          <button
            onClick={handleExportCsv}
            type="button"
            style={{ backgroundColor: "#0c0a09", color: "#ffffff" }}
            className="btn-primary inline-flex items-center gap-2 bg-[#0c0a09] !text-white text-xs font-semibold px-4 sm:px-5 py-2 sm:py-2.5 rounded-full shadow-xs hover:bg-[#262626] transition-colors cursor-pointer shrink-0"
          >
            <svg
              className="w-4 h-4 !text-white stroke-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
              />
              <polyline
                strokeLinecap="round"
                strokeLinejoin="round"
                points="7 10 12 15 17 10"
              />
              <line
                strokeLinecap="round"
                strokeLinejoin="round"
                x1="12"
                y1="15"
                x2="12"
                y2="3"
              />
            </svg>
            <span
              className="!text-white font-semibold"
              style={{ color: "#ffffff" }}
            >
              Export CSV
            </span>
          </button>
        </div>
      </header>
      {/* 4 KPI Cards Matching defx-pos-frontend OrdersReport.jsx */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total orders */}
        <div className="bg-white border border-[#e9e1dd] rounded-2xl p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1 mb-2">
            <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#645d58] font-semibold leading-tight">
              Total orders
            </span>
            <svg
              className="w-4 h-4 text-[#7f7570] shrink-0 mt-0.5"
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
              className="text-xl sm:text-2xl lg:text-3xl font-normal text-[#1e1b19] tabular-nums leading-tight truncate"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              {loading
                ? "..."
                : reportData.total_orders === 0
                  ? "-"
                  : reportData.total_orders}
            </div>
            <div className="text-[11px] sm:text-xs text-[#7f7570] mt-0.5 sm:mt-1 truncate">
              Orders processed in period
            </div>
          </div>
          <div className="mt-3 sm:mt-4 pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1 w-fit max-w-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1b873f] shrink-0"></span>
            <span className="text-[10px] sm:text-[11px] text-[#1e1b19] tabular-nums font-medium whitespace-nowrap truncate">
              {channelBreakdown.totalCompleted} fulfilled
            </span>
          </div>
        </div>

        {/* Card 2: Avg order value */}
        <div className="bg-white border border-[#e9e1dd] rounded-2xl p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1 mb-2">
            <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#645d58] font-semibold leading-tight">
              Avg order value
            </span>
            <svg
              className="w-4 h-4 text-[#7f7570] shrink-0 mt-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div>
            <div
              className="text-xl sm:text-2xl lg:text-3xl font-normal text-[#1e1b19] tabular-nums leading-tight truncate"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              {loading ? "..." : isDataZero(reportData.total_avg_order_value)}
            </div>
            <div className="text-[11px] sm:text-xs text-[#7f7570] mt-0.5 sm:mt-1 truncate">
              Average check size
            </div>
          </div>
          <div className="mt-3 sm:mt-4 pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1 w-fit max-w-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#645d58] shrink-0"></span>
            <span className="text-[10px] sm:text-[11px] text-[#645d58] font-medium tabular-nums whitespace-nowrap truncate">
              Avg check size
            </span>
          </div>
        </div>

        {/* Card 3: Avg delivery time */}
        <div className="bg-white border border-[#e9e1dd] rounded-2xl p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1 mb-2">
            <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#645d58] font-semibold leading-tight">
              Avg delivery time
            </span>
            <svg
              className="w-4 h-4 text-[#7f7570] shrink-0 mt-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <div
              className="text-xl sm:text-2xl lg:text-3xl font-normal text-[#1e1b19] tabular-nums leading-tight truncate"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              {loading
                ? "..."
                : reportData.average_delivery_time !== null
                  ? formatDeliveryTime(reportData.average_delivery_time)
                  : "-"}
            </div>
            <div className="text-[11px] sm:text-xs text-[#7f7570] mt-0.5 sm:mt-1 truncate">
              Delivery turnaround duration
            </div>
          </div>
          <div className="mt-3 sm:mt-4 pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1 w-fit max-w-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1e1b19] shrink-0"></span>
            <span className="text-[10px] sm:text-[11px] text-[#1e1b19] font-medium whitespace-nowrap truncate">
              Dispatch cadence
            </span>
          </div>
        </div>

        {/* Card 4: Peak order time frame */}
        <div className="bg-white border border-[#e9e1dd] rounded-2xl p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1 mb-2">
            <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#645d58] font-semibold leading-tight">
              Peak order time
            </span>
            <svg
              className="w-4 h-4 text-[#7f7570] shrink-0 mt-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          </div>
          <div>
            <div
              className="text-xl sm:text-2xl lg:text-3xl font-normal text-[#1e1b19] tabular-nums leading-tight truncate"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              {loading ? "..." : isDataZero(reportData.peak_order_time_frame)}
            </div>
            <div className="text-[11px] sm:text-xs text-[#7f7570] mt-0.5 sm:mt-1 truncate">
              Busiest customer intake hour
            </div>
          </div>
          <div className="mt-3 sm:mt-4 pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1 w-fit max-w-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1e1b19] shrink-0"></span>
            <span className="text-[10px] sm:text-[11px] text-[#1e1b19] font-medium tabular-nums whitespace-nowrap truncate">
              Peak hour
            </span>
          </div>
        </div>
      </section>

      {/* Channel Volume & Fulfillment Overview */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {channelBreakdown.channels.map((ch) => (
          <div
            key={ch.name}
            className="bg-white border border-[#e9e1dd] rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#1e1b19] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#1e1b19]"></span>
                  {ch.name}
                </span>
                <span className="text-[11px] px-2 py-0.5 bg-[#faf2ee] border border-[#e9e1dd] text-[#1e1b19] rounded-full font-medium tabular-nums">
                  {ch.percentage}% share
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-3">
                <span
                  className="text-2xl font-normal text-[#1e1b19] tabular-nums"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  {formatPriceWithSymbol(
                    ch.grossPaise,
                    currencySymbol,
                    countryCode,
                    true,
                  )}
                </span>
                <span className="text-xs text-[#645d58] tabular-nums">
                  {ch.count} {ch.count === 1 ? "order" : "orders"}
                </span>
              </div>
              <div className="w-full bg-[#faf2ee] h-1.5 rounded-full overflow-hidden mt-3 border border-[#e9e1dd]">
                <div
                  className="bg-[#1e1b19] h-full rounded-full transition-all duration-300"
                  style={{ width: `${ch.percentage}%` }}
                ></div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#f4ece8] flex items-center justify-between text-[11px] text-[#645d58]">
              <span>Avg Check</span>
              <span className="font-semibold text-[#1e1b19] tabular-nums">
                {formatPriceWithSymbol(
                  ch.aov,
                  currencySymbol,
                  countryCode,
                  true,
                )}
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* Table 1: Order Type Summary Matching defx-pos-frontend OrdersReport.jsx */}
      <section className="bg-white border border-[#e9e1dd] rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="mb-4">
          <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
            Channel Distribution
          </span>
          <h2
            className="text-lg sm:text-xl text-[#1e1b19] font-normal"
            style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
          >
            Order type summary
          </h2>
          <p className="text-xs text-[#7f7570] mt-0.5">
            Breakdown of order volumes, ticket sizes, and refunds across
            fulfillment channels
          </p>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[560px]">
            <thead>
              <tr className="bg-[#faf2ee] text-[#645d58] text-[11px] uppercase tracking-wider border-b border-[#e9e1dd]">
                <th className="py-3 px-4 font-semibold">Order type</th>
                <th className="py-3 px-4 font-semibold text-center">
                  Total orders
                </th>
                <th className="py-3 px-4 font-semibold text-right">
                  Avg order value
                </th>
                <th className="py-3 px-4 font-semibold text-center">
                  Refunded orders
                </th>
                <th className="py-3 px-4 font-semibold text-center">
                  Avg delivery time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4ece8] text-[#1e1b19] text-xs">
              {reportData.order_type_summary_data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[#7f7570]">
                    <div className="flex flex-col items-center justify-center space-y-1.5">
                      <span className="text-xl">📋</span>
                      <p className="font-medium text-xs text-[#1e1b19]">
                        No Order Types Recorded
                      </p>
                      <p className="text-[11px] text-[#7f7570]">
                        Channel breakdowns will populate with incoming orders.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                reportData.order_type_summary_data.map((row) => (
                  <tr
                    key={row.order_type}
                    className="hover:bg-[#faf2ee] transition-colors"
                  >
                    <td className="py-3.5 px-4 font-semibold text-[#1e1b19]">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#1e1b19]"></span>
                        <span>{row.order_type}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center tabular-nums">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#faf2ee] border border-[#e9e1dd] text-[#1e1b19] font-medium text-[11px]">
                        {row.total_orders}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-[#1e1b19]">
                      {row.avg_order_value}
                    </td>
                    <td className="py-3.5 px-4 text-center tabular-nums">
                      {row.refunded_orders > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium text-[11px]">
                          {row.refunded_orders}
                        </span>
                      ) : (
                        <span className="text-[#7f7570]">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center tabular-nums text-[#645d58]">
                      {row.avg_delivery_time || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Table 2: Daily Orders General Table Matching defx-pos-frontend OrdersReport.jsx */}
      <section className="bg-white border border-[#e9e1dd] rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
              Daily Ledger
            </span>
            <h2
              className="text-lg sm:text-xl text-[#1e1b19] font-normal"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              Daily Orders Summary
            </h2>
            <p className="text-xs text-[#7f7570] mt-0.5">
              Day-by-day fulfillment log with throughput, average basket size,
              and peak order times
            </p>
          </div>

          {/* Search & Channel Filter */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial min-w-[160px] sm:min-w-[200px]">
              <input
                type="text"
                placeholder="Search date or channel..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-[#faf2ee] border border-[#e9e1dd] text-[#1e1b19] text-xs pl-8 pr-4 py-2 rounded-full focus:outline-none focus:border-[#1e1b19]"
              />
              <svg
                className="w-3.5 h-3.5 text-[#7f7570] absolute left-2.5 top-1/2 -translate-y-1/2"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>

            <div className="relative shrink-0" ref={channelDropdownRef}>
              <button
                type="button"
                onClick={() => setIsChannelOpen(!isChannelOpen)}
                className="appearance-none bg-white border border-[#e9e1dd] text-[#1e1b19] text-xs font-semibold pl-3.5 sm:pl-4 pr-7 sm:pr-8 py-2 rounded-full shadow-xs hover:bg-[#faf2ee] transition-colors cursor-pointer flex items-center gap-2"
              >
                <span>{currentChannelLabel}</span>
                <svg
                  className="w-3.5 h-3.5 text-[#7f7570] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isChannelOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-2xl shadow-xl py-2 z-30 border border-[#e9e1dd]">
                  {channelOptions.map((ch) => (
                    <button
                      key={ch.value}
                      type="button"
                      className={`w-full text-left px-4 py-2 text-xs transition-colors cursor-pointer ${
                        orderTypeFilter === ch.value
                          ? "font-semibold text-[#1e1b19] bg-[#faf2ee]"
                          : "text-[#645d58] hover:bg-[#eee7e3]"
                      }`}
                      onClick={() => {
                        setOrderTypeFilter(ch.value);
                        setCurrentPage(1);
                        setIsChannelOpen(false);
                      }}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Responsive Table Matching defx-pos-frontend columns */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-[#faf2ee] text-[#645d58] text-[11px] uppercase tracking-wider border-b border-[#e9e1dd]">
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold text-center">
                  Total orders
                </th>
                <th className="py-3 px-4 font-semibold text-right">
                  Avg order value
                </th>
                <th className="py-3 px-4 font-semibold text-center">
                  Avg delivery time
                </th>
                <th className="py-3 px-4 font-semibold text-center">
                  Peak order time frame
                </th>
                <th className="py-3 px-4 font-semibold text-center">
                  Avg items / order
                </th>
                <th className="py-3 px-4 font-semibold text-center">
                  Avg order type
                </th>
                <th className="py-3 px-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4ece8] text-[#1e1b19] text-xs">
              {paginatedDailyData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#7f7570]">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <span className="text-2xl">📋</span>
                      <p className="font-medium text-sm text-[#1e1b19]">
                        No Reports Available Yet
                      </p>
                      <p className="text-xs text-[#7f7570]">
                        Reports will appear once you start recording
                        transactions.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedDailyData.map((d, index) => {
                  const isFirstRow = currentPage === 1 && index === 0;
                  return (
                    <tr
                      key={d.date}
                      className="hover:bg-[#faf2ee] transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          {isFirstRow && (
                            <span className="w-2 h-2 rounded-full bg-[#1b873f]"></span>
                          )}
                          <span className="font-semibold text-[#1e1b19]">
                            {d.date}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center tabular-nums">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#faf2ee] border border-[#e9e1dd] text-[#1e1b19] font-medium text-[11px]">
                          {d.total_orders}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-[#1e1b19]">
                        {d.avg_order_value}
                      </td>
                      <td className="py-3.5 px-4 text-center tabular-nums text-[#645d58]">
                        {d.average_delivery_time || "—"}
                      </td>
                      <td className="py-3.5 px-4 text-center tabular-nums text-[#1e1b19]">
                        <span className="px-2 py-0.5 rounded-full bg-[#faf2ee] text-[11px] font-medium">
                          {d.peak_order_time_frame || "—"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center tabular-nums font-medium text-[#1e1b19]">
                        {d.avg_items_per_order}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#faf2ee] border border-[#e9e1dd] text-[#1e1b19] text-[11px] font-medium">
                          {d.avg_order_type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedDayForDrawer(d)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] bg-[#faf2ee] border border-[#e9e1dd] text-[#1e1b19] font-medium group-hover:bg-[#1e1b19] group-hover:text-white transition-colors cursor-pointer"
                        >
                          <span>View Day</span>
                          <svg
                            className="w-3 h-3"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
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

        {/* Editorial Pagination Footer Matching GeneralCommanReportTable */}
        {filteredDailyData.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#e9e1dd] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#645d58] text-center sm:text-left">
            <span>
              Showing{" "}
              <strong className="text-[#1e1b19] font-semibold">
                {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, filteredDailyData.length)}
              </strong>{" "}
              of{" "}
              <strong className="text-[#1e1b19] font-semibold">
                {filteredDailyData.length}
              </strong>{" "}
              settlement days
            </span>
            <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-end">
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
                  style={
                    currentPage === i + 1
                      ? { backgroundColor: "#0c0a09", color: "#ffffff" }
                      : undefined
                  }
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
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                className="px-3 py-1 rounded-full border border-[#e9e1dd] bg-[#faf2ee] hover:bg-[#eee7e3] text-[#1e1b19] disabled:opacity-40 transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Slide-over Day Details Drawer */}
      {selectedDayForDrawer && drawerStats && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedDayForDrawer(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
            <div className="w-screen max-w-full sm:max-w-lg bg-white shadow-2xl flex flex-col">
              {/* Drawer Header */}
              <div className="p-4 sm:p-6 border-b border-[#e9e1dd] flex items-center justify-between bg-[#faf2ee]">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                    Order Details Breakdown
                  </div>
                  <h3
                    className="text-xl sm:text-2xl text-[#1e1b19] font-normal"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {drawerStats.date}
                  </h3>
                  <p className="text-xs text-[#7f7570] mt-0.5">
                    {drawerStats.ordersCount}{" "}
                    {drawerStats.ordersCount === 1 ? "order" : "orders"}{" "}
                    recorded on this date
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDayForDrawer(null)}
                  className="w-8 h-8 rounded-full border border-[#e9e1dd] bg-white hover:bg-[#f4ece8] flex items-center justify-center text-[#1e1b19] transition-colors cursor-pointer shrink-0"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Day Summary Cards */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  <div className="bg-[#faf2ee] border border-[#e9e1dd] rounded-xl p-3 sm:p-3.5">
                    <span className="text-[10px] uppercase tracking-wider text-[#645d58] font-semibold">
                      Gross Intake
                    </span>
                    <div
                      className="text-lg sm:text-xl font-normal text-[#1e1b19] tabular-nums mt-0.5"
                      style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                    >
                      {formatPriceWithSymbol(
                        drawerStats.grossPaise,
                        currencySymbol,
                        countryCode,
                        true,
                      )}
                    </div>
                  </div>
                  <div className="bg-[#faf2ee] border border-[#e9e1dd] rounded-xl p-3.5">
                    <span className="text-[10px] uppercase tracking-wider text-[#645d58] font-semibold">
                      Refunds Issued
                    </span>
                    <div
                      className="text-xl font-normal text-red-600 tabular-nums mt-0.5"
                      style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                    >
                      {drawerStats.refundPaise > 0
                        ? `-${formatPriceWithSymbol(drawerStats.refundPaise, currencySymbol, countryCode, true)}`
                        : "—"}
                    </div>
                  </div>
                </div>

                {/* Day Channel Distribution */}
                <div className="border border-[#e9e1dd] rounded-xl p-4 bg-white space-y-2">
                  <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                    Fulfillment Types
                  </span>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="p-2 bg-[#faf2ee] rounded-lg border border-[#e9e1dd]">
                      <span className="text-[10px] text-[#645d58] block">
                        Dine In
                      </span>
                      <strong className="text-sm text-[#1e1b19] tabular-nums">
                        {drawerStats.typeCounts["Dine In"]}
                      </strong>
                    </div>
                    <div className="p-2 bg-[#faf2ee] rounded-lg border border-[#e9e1dd]">
                      <span className="text-[10px] text-[#645d58] block">
                        Takeaway
                      </span>
                      <strong className="text-sm text-[#1e1b19] tabular-nums">
                        {drawerStats.typeCounts.Takeaway}
                      </strong>
                    </div>
                    <div className="p-2 bg-[#faf2ee] rounded-lg border border-[#e9e1dd]">
                      <span className="text-[10px] text-[#645d58] block">
                        Delivery
                      </span>
                      <strong className="text-sm text-[#1e1b19] tabular-nums">
                        {drawerStats.typeCounts.Delivery}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Orders List for Day */}
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold block mb-3">
                    Order Checks
                  </span>
                  <div className="space-y-2.5">
                    {drawerStats.dayOrders.length === 0 ? (
                      <p className="text-xs text-[#7f7570] text-center py-6">
                        No individual orders found.
                      </p>
                    ) : (
                      drawerStats.dayOrders.map((ord: any) => {
                        const ordTime = formatStoreTime(
                          ord.createdAt,
                          timezone,
                          countryCode,
                        );
                        const itemsCount = ord.items
                          ? ord.items.reduce(
                              (acc: number, it: any) =>
                                acc + (it.quantity || 1),
                              0,
                            )
                          : ord.item_count || 1;

                        return (
                          <div
                            key={ord._id}
                            className="p-3.5 bg-[#faf2ee]/70 border border-[#e9e1dd] rounded-xl flex items-center justify-between hover:bg-[#faf2ee] transition-colors"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-[#1e1b19]">
                                  #
                                  {ord.orderNumber ||
                                    ord._id.slice(-6).toUpperCase()}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-[#e9e1dd] text-[#645d58] font-medium">
                                  {ord.orderType || "DineIn"}
                                </span>
                                {ord.paymentStatus === "Refunded" && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-100 text-red-700 font-semibold">
                                    Refunded
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#7f7570]">
                                {ordTime} • {itemsCount}{" "}
                                {itemsCount === 1 ? "item" : "items"}
                                {ord.tableName
                                  ? ` • Table ${ord.tableName}`
                                  : ""}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-semibold text-[#1e1b19] tabular-nums block">
                                {formatPriceWithSymbol(
                                  ord.totalAmount,
                                  currencySymbol,
                                  countryCode,
                                  true,
                                )}
                              </span>
                              <span className="text-[10px] text-[#645d58]">
                                {ord.paymentMode || ord.paymentStatus || "Paid"}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-[#e9e1dd] bg-[#faf2ee] flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedDayForDrawer(null)}
                  style={{ backgroundColor: "#0c0a09", color: "#ffffff" }}
                  className="btn-primary px-4 py-2 bg-[#0c0a09] !text-white text-xs font-semibold rounded-full hover:bg-[#262626] transition-colors cursor-pointer"
                >
                  <span className="!text-white" style={{ color: "#ffffff" }}>
                    Close
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Standard Menu Toaster Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
