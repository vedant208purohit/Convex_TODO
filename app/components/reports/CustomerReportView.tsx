"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  formatPriceWithSymbol,
  formatStoreDate,
  formatStoreTime,
  formatStoreDateTime,
  getPhoneCodeForCountry,
  formatPhoneNumberWithCountryCode,
  getTimezoneForCountry,
} from "../../../lib/constants/countries";
import { DateRange } from "./ReportHeader";
import {
  computeCustomerReportData,
  CustomerReportOutput,
} from "../../reports/reportCalculations";
import { Toast, type ToastMessage } from "../Toast";

interface CustomerReportViewProps {
  orders: any[];
  loading?: boolean;
  currencySymbol?: string;
  countryCode?: string;
  timezone?: string;
  startDateMs?: number;
  selectedRange?: DateRange;
  onRangeChange?: (range: DateRange) => void;
  priorCustomerKeys?: Set<string>;
}

export interface RecentOrderItem {
  check: string;
  session: string;
  amountPaise: number;
}

export interface DinerRecord {
  id: string;
  name: string;
  phone: string;
  orders: number;
  lastOrderDate: string;
  lastOrderSession: string;
  totalSpendPaise: number;
  avgOrderValuePaise: number;
  retentionTier: string;
  retentionType: "repeat" | "single";
  isHighValue: boolean;
  source: string;
  sourceIcon: string;
  recentOrders?: RecentOrderItem[];
}

interface LiveCustomerAgg {
  id: string;
  name: string;
  phone: string;
  orders: number;
  lastOrderTime: number;
  lastOrderSession: string;
  totalSpendPaise: number;
  sourceCounts: Record<string, number>;
  recentOrders: RecentOrderItem[];
}

export function CustomerReportView({
  orders = [],
  loading = false,
  currencySymbol = "₹",
  countryCode = "IN",
  timezone,
  startDateMs,
  selectedRange,
  onRangeChange,
  priorCustomerKeys,
}: CustomerReportViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "repeat" | "single" | "high-value"
  >("all");
  const [viewMode, setViewMode] = useState<"directory" | "daily">("directory");
  const [selectedDiner, setSelectedDiner] = useState<DinerRecord | null>(null);
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [dailyPage, setDailyPage] = useState(1);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
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

  // Close date dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dateDropdownRef.current &&
        !dateDropdownRef.current.contains(event.target as Node)
      ) {
        setIsDateOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const phoneDialCode = getPhoneCodeForCountry(countryCode || "IN");
  const storeTz = timezone || getTimezoneForCountry(countryCode || "IN");

  // 1. Calculate Summary & Daily Breakdown (matching old defx-pos-frontend report data model)
  const summaryReport: CustomerReportOutput = useMemo(() => {
    return computeCustomerReportData(
      orders,
      currencySymbol,
      countryCode,
      storeTz,
      startDateMs,
      priorCustomerKeys,
    );
  }, [orders, currencySymbol, countryCode, storeTz, startDateMs, priorCustomerKeys]);

  // 2. Compute live customer aggregations dynamically from orders (NO hardcoded data)
  const liveCustomerData = useMemo(() => {
    const customerMap = new Map<string, LiveCustomerAgg>();

    for (const order of orders) {
      // Exclude rejected / cancelled orders
      if (order.isRejected === true) continue;
      const statusLower = (order.orderStatusName || "").toLowerCase();
      if (statusLower.includes("reject") || statusLower.includes("cancel")) {
        continue;
      }

      const phone = (
        order.customerPhone ||
        order.phoneNumber ||
        order.phone ||
        ""
      ).trim();
      const rawName = (order.customerName || order.name || "").trim();

      let key = "";
      let displayName = "";
      if (phone) {
        key = phone;
        displayName = rawName || `Guest ${phone.slice(-4)}`;
      } else if (order.customerId) {
        key = String(order.customerId);
        displayName =
          rawName || `Customer #${String(order.customerId).slice(-6)}`;
      } else if (rawName) {
        key = rawName.toLowerCase();
        displayName = rawName;
      } else if (order.tableName || order.table?.number) {
        const tbl = order.tableName || order.table?.number;
        key = `table_${tbl}`;
        displayName = `Table ${tbl} Guest`;
      } else {
        const num =
          order.orderNumber ||
          order.tokenNumber ||
          String(order._id || "").slice(-4);
        key = `order_${num}`;
        displayName = `Walk-in Guest (${num})`;
      }

      const spend =
        order.totalAmount || order.finalAmount || order.totalPrice || 0;
      const orderTime = order.createdAt || order._creationTime || Date.now();
      const orderType = order.orderType || order.serviceType || "DineIn";
      const tableSession =
        order.tableName || order.table?.number
          ? `Table ${order.tableName || order.table?.number}`
          : orderType;

      let existing = customerMap.get(key);
      if (!existing) {
        existing = {
          id: `cust-${key}`,
          name: displayName,
          phone: phone || "No Mobile Registered",
          orders: 0,
          lastOrderTime: 0,
          lastOrderSession: tableSession,
          totalSpendPaise: 0,
          sourceCounts: {},
          recentOrders: [],
        };
        customerMap.set(key, existing);
      }

      existing.orders += 1;
      existing.totalSpendPaise += spend;
      existing.sourceCounts[orderType] =
        (existing.sourceCounts[orderType] || 0) + 1;

      if (orderTime >= existing.lastOrderTime) {
        existing.lastOrderTime = orderTime;
        existing.lastOrderSession = tableSession;
        if (rawName && existing.name.startsWith("Guest ")) {
          existing.name = rawName;
        }
      }

      existing.recentOrders.push({
        check: order.orderNumber
          ? `Check #${order.orderNumber}`
          : `Check #${existing.orders}`,
        session: `${formatStoreDateTime(orderTime, countryCode, storeTz)} • ${tableSession}`,
        amountPaise: spend,
      });
    }

    const liveList = Array.from(customerMap.values()).map((c) => {
      const avgOrderValuePaise =
        c.orders > 0
          ? Math.round(c.totalSpendPaise / c.orders)
          : c.totalSpendPaise;
      const hasPrior = Boolean(
        priorCustomerKeys &&
          (priorCustomerKeys.has(c.id) ||
            priorCustomerKeys.has(c.phone) ||
            priorCustomerKeys.has(c.name.toLowerCase()))
      );
      const isRepeat = c.orders >= 2 || hasPrior;
      const isHighValue = c.totalSpendPaise >= 300000;

      // Determine predominant channel
      let predominantSource = "DineIn";
      let maxSourceCount = 0;
      for (const [src, cnt] of Object.entries(c.sourceCounts)) {
        if (cnt > maxSourceCount) {
          maxSourceCount = cnt;
          predominantSource = src;
        }
      }

      const sourceIcon =
        predominantSource.toLowerCase().includes("takeaway") ||
        predominantSource.toLowerCase().includes("pickup")
          ? "takeout_dining"
          : predominantSource.toLowerCase().includes("delivery") ||
              predominantSource.toLowerCase().includes("online")
            ? "shopping_bag"
            : "table_restaurant";

      const lastOrderDate = formatStoreDateTime(
        c.lastOrderTime || Date.now(),
        countryCode,
        storeTz,
      );

      // Sort recent orders newest first
      c.recentOrders.sort((a, b) => b.amountPaise - a.amountPaise);

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        orders: c.orders,
        lastOrderDate,
        lastOrderSession: c.lastOrderSession,
        totalSpendPaise: c.totalSpendPaise,
        avgOrderValuePaise,
        retentionTier: isRepeat ? `Repeat (${c.orders} visits)` : "First Visit",
        retentionType: isRepeat ? ("repeat" as const) : ("single" as const),
        isHighValue,
        source: predominantSource,
        sourceIcon,
        recentOrders: c.recentOrders.slice(0, 5),
      };
    });

    liveList.sort((a, b) => b.totalSpendPaise - a.totalSpendPaise);
    return liveList;
  }, [orders, countryCode, storeTz]);

  // Purely dynamic diner data - ZERO hardcoded mock users
  const diners = liveCustomerData;

  // Exact KPI metrics calculated from real data
  const totalDiners = summaryReport.total_customers;
  const repeatDiners = diners.filter(
    (d) => d.retentionType === "repeat",
  ).length;
  const newDiners = summaryReport.new_customers;
  const repeatRatio = summaryReport.retention_rate;
  const acquisitionIndex =
    totalDiners > 0 ? ((newDiners / totalDiners) * 100).toFixed(1) : "0.0";

  const totalSpendPaise = diners.reduce((sum, d) => sum + d.totalSpendPaise, 0);
  const totalCompletedOrders = diners.reduce((sum, d) => sum + d.orders, 0);
  const avgSpendPerDinerPaise =
    totalDiners > 0 ? Math.round(totalSpendPaise / totalDiners) : 0;

  // Filtered Diners based on search and segment chips
  const filteredDiners = useMemo(() => {
    return diners.filter((d) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.phone.toLowerCase().includes(q) ||
        d.source.toLowerCase().includes(q);

      let matchesFilter = true;
      if (activeFilter === "repeat") {
        matchesFilter = d.retentionType === "repeat";
      } else if (activeFilter === "single") {
        matchesFilter = d.retentionType === "single";
      } else if (activeFilter === "high-value") {
        matchesFilter = d.totalSpendPaise >= 300000;
      }

      return matchesSearch && matchesFilter;
    });
  }, [diners, searchQuery, activeFilter]);

  // Paginated Diner Table Rows
  const totalDinerPages = Math.ceil(filteredDiners.length / pageSize) || 1;
  const paginatedDiners = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDiners.slice(start, start + pageSize);
  }, [filteredDiners, currentPage, pageSize]);

  // Paginated Daily Summary Rows
  const dailyTableData = summaryReport.table_data || [];
  const totalDailyPages = Math.ceil(dailyTableData.length / pageSize) || 1;
  const paginatedDailyData = useMemo(() => {
    const start = (dailyPage - 1) * pageSize;
    return dailyTableData.slice(start, start + pageSize);
  }, [dailyTableData, dailyPage, pageSize]);

  // Date Preset Selection
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
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date();
    }

    onRangeChange({ startDate: start, endDate: end, preset: presetName });
  };

  // Export CSV (Exports active view data)
  const handleExportCsv = () => {
    if (viewMode === "directory") {
      if (filteredDiners.length === 0) {
        showToast("No customer records available to export.", "warning");
        return;
      }
      const headers = [
        "Customer Name",
        "Mobile",
        "Orders",
        "Last Order",
        "Total Spend",
        "Retention Tier",
        "Primary Source",
        "Avg Order Value",
      ];

      const rows = filteredDiners.map((d) => [
        `"${d.name}"`,
        `"${d.phone}"`,
        d.orders,
        `"${d.lastOrderDate}"`,
        (d.totalSpendPaise / 100).toFixed(2),
        `"${d.retentionTier}"`,
        `"${d.source}"`,
        (d.avgOrderValuePaise / 100).toFixed(2),
      ]);

      const csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `customer-registry-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Customer registry CSV exported successfully", "success");
    } else {
      if (dailyTableData.length === 0) {
        showToast("No customer daily records available to export.", "warning");
        return;
      }
      const headers = [
        "Date",
        "Total Customers",
        "New Customers",
        "Repeat Customers",
        "Retention Rate",
        "Avg Customer Spend",
      ];

      const rows = dailyTableData.map((d) => [
        `"${d.date}"`,
        d.total_customers,
        d.new_customers,
        d.repeat_customers,
        `"${d.retention_rate}"`,
        `"${d.avg_customer_spend}"`,
      ]);

      const csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `customer-daily-report-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Customer daily report CSV exported successfully", "success");
    }
  };

  return (
    <div className="flex flex-col w-full">
      {/* Page Header & Date Range Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div>
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#645d58] mb-1">
            <Link
              href="/reports"
              className="hover:text-[#000000] transition-colors cursor-pointer"
            >
              Reports
            </Link>
            <span className="text-[#d0c4be]">/</span>
            <span className="text-[#000000] font-semibold">
              Customer Report
            </span>
          </nav>
          {/* Title */}
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl text-[#000000] tracking-tight leading-tight mb-1 font-normal"
            style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
          >
            Customer Report
          </h1>
          <p className="text-xs sm:text-sm text-[#645d58] max-w-xl">
            Audit guest retention rates, cumulative dining spend, and patron
            return frequency derived in real-time from active store
            transactions.
          </p>
        </div>

        {/* Date Range Selector & Export Action */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap sm:flex-nowrap w-full sm:w-auto self-start lg:self-end shrink-0">
          {/* Date Preset Dropdown */}
          <div className="relative" ref={dateDropdownRef}>
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
                {[
                  "Today",
                  "Yesterday",
                  "Last 7 Days",
                  "This Month",
                  "Last Month",
                ].map((preset) => (
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

          {/* Export CSV Button */}
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
              Export {viewMode === "directory" ? "Ledger" : "Summary"}
            </span>
          </button>
        </div>
      </div>

      {/* View Mode Tabs: Customer Directory vs Daily Summary */}
      <div className="border-b border-[#e9e1dd] flex items-center gap-4 sm:gap-6 mb-6 overflow-x-auto no-scrollbar whitespace-nowrap">
        <button
          type="button"
          onClick={() => {
            setViewMode("directory");
            setCurrentPage(1);
          }}
          className={`pb-3 text-xs sm:text-sm font-semibold transition-colors cursor-pointer relative ${
            viewMode === "directory"
              ? "text-[#1e1b19]"
              : "text-[#7f7570] hover:text-[#1e1b19]"
          }`}
        >
          <span>Customer Directory</span>
          {viewMode === "directory" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1e1b19] rounded-full"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setViewMode("daily");
            setDailyPage(1);
          }}
          className={`pb-3 text-xs sm:text-sm font-semibold transition-colors cursor-pointer relative ${
            viewMode === "daily"
              ? "text-[#1e1b19]"
              : "text-[#7f7570] hover:text-[#1e1b19]"
          }`}
        >
          <span>Daily Summary</span>
          {viewMode === "daily" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1e1b19] rounded-full"></span>
          )}
        </button>
      </div>

      {/* 4 Core Analytical Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {/* Card 1: Total Customers */}
        <div className="bg-white p-3.5 sm:p-5 lg:p-6 rounded-2xl shadow-xs border border-[#d0c4be]/40 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1 mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#645d58] font-semibold leading-tight">
              Total Customers
            </span>
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#f4ece8] flex items-center justify-center text-[#645d58] shrink-0">
              <span className="material-symbols-outlined text-[16px] sm:text-[18px]">
                groups
              </span>
            </span>
          </div>
          <div>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-[#f4ece8] rounded w-1/2"></div>
                <div className="h-4 bg-[#f4ece8] rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="text-xl sm:text-2xl lg:text-3xl text-[#000000] tracking-tight font-normal truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {totalDiners}
                  </span>
                  <span className="text-[11px] sm:text-xs text-[#645d58] font-normal">
                    patrons
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#645d58] mt-0.5 sm:mt-1 truncate">
                  Unique guests in selected period
                </p>
              </>
            )}
          </div>
          <div className="mt-3 sm:mt-4 pt-1 flex items-center gap-1.5 text-[#645d58] text-[10px] sm:text-xs font-semibold whitespace-nowrap truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#4d4541] shrink-0"></span>
            <span className="truncate">Active dining ledger</span>
          </div>
        </div>

        {/* Card 2: Customer Retention Rate */}
        <div className="bg-white p-3.5 sm:p-5 lg:p-6 rounded-2xl shadow-xs border border-[#d0c4be]/40 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1 mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#645d58] font-semibold leading-tight">
              Retention Rate
            </span>
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#f4ece8] flex items-center justify-center text-[#645d58] shrink-0">
              <span className="material-symbols-outlined text-[16px] sm:text-[18px]">
                sync_alt
              </span>
            </span>
          </div>
          <div>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-[#f4ece8] rounded w-1/2"></div>
                <div className="h-4 bg-[#f4ece8] rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="text-xl sm:text-2xl lg:text-3xl text-[#000000] tracking-tight font-normal truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {repeatRatio}
                  </span>
                  <span className="text-[11px] sm:text-xs text-[#645d58] font-normal">
                    rate
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#645d58] mt-0.5 sm:mt-1 truncate">
                  {repeatDiners} returning patrons
                </p>
              </>
            )}
          </div>
          <div className="mt-3 sm:mt-4 pt-1 flex items-center gap-1.5 text-[#645d58] text-[10px] sm:text-xs font-semibold whitespace-nowrap truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#000000] shrink-0"></span>
            <span className="truncate">Repeat guest patronage</span>
          </div>
        </div>

        {/* Card 3: Avg Customer Spend */}
        <div className="bg-white p-3.5 sm:p-5 lg:p-6 rounded-2xl shadow-xs border border-[#d0c4be]/40 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1 mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#645d58] font-semibold leading-tight">
              Avg Guest Spend
            </span>
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#f4ece8] flex items-center justify-center text-[#645d58] shrink-0">
              <span className="material-symbols-outlined text-[16px] sm:text-[18px]">
                payments
              </span>
            </span>
          </div>
          <div>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-[#f4ece8] rounded w-1/2"></div>
                <div className="h-4 bg-[#f4ece8] rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="text-xl sm:text-2xl lg:text-3xl text-[#000000] tracking-tight font-normal tabular-nums truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {formatPriceWithSymbol(
                      avgSpendPerDinerPaise,
                      currencySymbol,
                      countryCode,
                      true,
                    )}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#645d58] mt-0.5 sm:mt-1 truncate">
                  Across {totalCompletedOrders} completed orders
                </p>
              </>
            )}
          </div>
          <div className="mt-3 sm:mt-4 pt-1 flex items-center gap-1.5 text-[#645d58] text-[10px] sm:text-xs font-semibold whitespace-nowrap truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#4d4541] shrink-0"></span>
            <span className="truncate">
              Pool:{" "}
              {formatPriceWithSymbol(
                totalSpendPaise,
                currencySymbol,
                countryCode,
                true,
              )}
            </span>
          </div>
        </div>

        {/* Card 4: New Customers */}
        <div className="bg-white p-3.5 sm:p-5 lg:p-6 rounded-2xl shadow-xs border border-[#d0c4be]/40 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1 mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#645d58] font-semibold leading-tight">
              New Customers
            </span>
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#f4ece8] flex items-center justify-center text-[#645d58] shrink-0">
              <span className="material-symbols-outlined text-[16px] sm:text-[18px]">
                person_add
              </span>
            </span>
          </div>
          <div>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-[#f4ece8] rounded w-1/2"></div>
                <div className="h-4 bg-[#f4ece8] rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="text-xl sm:text-2xl lg:text-3xl text-[#000000] tracking-tight font-normal truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {newDiners}
                  </span>
                  <span className="text-[11px] sm:text-xs text-[#645d58] font-normal">
                    profiles
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#645d58] mt-0.5 sm:mt-1 truncate">
                  First visit registered in this period
                </p>
              </>
            )}
          </div>
          <div className="mt-3 sm:mt-4 pt-1 flex items-center gap-1.5 text-[#645d58] text-[10px] sm:text-xs font-semibold whitespace-nowrap truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#4d4541] shrink-0"></span>
            <span className="truncate">{acquisitionIndex}% acquisition rate</span>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: DINER LEDGER & PROFILES */}
      {viewMode === "directory" && (
        <>
          {/* Search & Segment Filtration Ribbon */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-xs border border-[#d0c4be]/40 mb-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4">
            {/* Search Field */}
            <div className="relative flex-1 min-w-[200px] sm:min-w-[260px]">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#645d58] text-[20px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={`Search patron by name, mobile (${phoneDialCode}...)...`}
                className="w-full pl-11 pr-4 py-2.5 bg-[#faf2ee] text-[#1e1b19] rounded-full text-xs placeholder:text-[#7f7570] focus:outline-none focus:bg-white focus:shadow-xs transition-all border border-transparent focus:border-[#d0c4be]"
              />
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1 lg:pb-0 whitespace-nowrap">
              <button
                type="button"
                onClick={() => {
                  setActiveFilter("all");
                  setCurrentPage(1);
                }}
                className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-xs transition-all cursor-pointer ${
                  activeFilter === "all"
                    ? "bg-[#000000] text-white"
                    : "bg-[#eee7e3] hover:bg-[#e9e1dd] text-[#1e1b19]"
                }`}
              >
                All Diners ({diners.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveFilter("repeat");
                  setCurrentPage(1);
                }}
                className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-xs transition-all cursor-pointer ${
                  activeFilter === "repeat"
                    ? "bg-[#000000] text-white"
                    : "bg-[#eee7e3] hover:bg-[#e9e1dd] text-[#1e1b19]"
                }`}
              >
                Repeat Patrons ({repeatDiners})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveFilter("single");
                  setCurrentPage(1);
                }}
                className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-xs transition-all cursor-pointer ${
                  activeFilter === "single"
                    ? "bg-[#000000] text-white"
                    : "bg-[#eee7e3] hover:bg-[#e9e1dd] text-[#1e1b19]"
                }`}
              >
                Single Visit (
                {diners.filter((d) => d.retentionType === "single").length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveFilter("high-value");
                  setCurrentPage(1);
                }}
                className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-xs transition-all cursor-pointer ${
                  activeFilter === "high-value"
                    ? "bg-[#000000] text-white"
                    : "bg-[#eee7e3] hover:bg-[#e9e1dd] text-[#1e1b19]"
                }`}
              >
                High Value (&gt;{" "}
                {formatPriceWithSymbol(
                  300000,
                  currencySymbol,
                  countryCode,
                  true,
                ).replace(/\.00$/, "")}
                )
              </button>
            </div>
          </div>

          {/* Customer Performance Table Panel */}
          <div className="bg-white rounded-2xl shadow-xs border border-[#d0c4be]/40 overflow-hidden flex flex-col">
            {/* Table Header Info Bar */}
            <div className="px-6 py-3.5 bg-[#faf2ee] flex items-center justify-between border-b border-[#e9e1dd]">
              <div className="flex items-center gap-3">
                <span
                  className="text-lg text-[#000000] font-normal"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  Diner Ledger &amp; Velocity
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#f4ece8] text-[11px] font-semibold text-[#645d58] border border-[#e9e1dd]">
                  {filteredDiners.length} matching records
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#645d58]">
                <span className="material-symbols-outlined text-[16px]">
                  verified
                </span>
                <span>Active Customer Ledger</span>
              </div>
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-[#faf2ee] text-[#645d58] text-[11px] uppercase tracking-wider font-semibold">
                    <th className="py-3 px-6">Customer Profile</th>
                    <th className="py-3 px-4 text-center">Total Orders</th>
                    <th className="py-3 px-4">Last Order</th>
                    <th className="py-3 px-4 text-right">Total Spend</th>
                    <th className="py-3 px-4">Retention Tier</th>
                    <th className="py-3 px-4">Primary Source</th>
                    <th className="py-3 px-4 text-right">Avg Order Value</th>
                    <th className="py-3 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4ece8] text-xs">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={8} className="py-4 px-6">
                          <div className="animate-pulse flex items-center gap-4">
                            <div className="w-9 h-9 rounded-full bg-[#f4ece8]"></div>
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-[#f4ece8] rounded w-1/4"></div>
                              <div className="h-3 bg-[#f4ece8] rounded w-1/6"></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : paginatedDiners.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-16 text-center text-[#7f7570]"
                      >
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <span className="material-symbols-outlined text-[48px] text-[#b4a9a4]">
                            person_off
                          </span>
                          <p className="font-semibold text-base text-[#1e1b19]">
                            No Customer Records Found
                          </p>
                          <p className="text-xs text-[#645d58] max-w-sm">
                            {orders.length === 0
                              ? "No customer orders have been recorded in this selected timeframe. Transactions will appear dynamically as orders are created."
                              : "No customers match the active search keyword or segment filter."}
                          </p>
                          {searchQuery && (
                            <button
                              onClick={() => {
                                setSearchQuery("");
                                setActiveFilter("all");
                              }}
                              type="button"
                              className="mt-2 px-4 py-1.5 rounded-full bg-[#000000] text-white text-xs font-semibold cursor-pointer shadow-xs"
                            >
                              Clear Filter Query
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedDiners.map((row) => {
                      const initials =
                        row.name
                          .split(" ")
                          .filter(Boolean)
                          .map((n) => n[0])
                          .join("")
                          .substring(0, 2)
                          .toUpperCase() || "GU";

                      return (
                        <tr
                          key={row.id}
                          className="hover:bg-[#faf2ee]/50 transition-colors group"
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-[#eae1da] text-[#1f1b17] flex items-center justify-center text-xs font-semibold shrink-0">
                                {initials}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-[#000000] text-sm">
                                    {row.name}
                                  </span>
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      row.retentionType === "repeat"
                                        ? "bg-[#000000]"
                                        : "bg-[#d0c4be]"
                                    }`}
                                    title={
                                      row.retentionType === "repeat"
                                        ? "Active regular patron"
                                        : "First visit patron"
                                    }
                                  ></span>
                                </div>
                                <div className="text-[11px] text-[#645d58] font-mono tracking-tight">
                                  {formatPhoneNumberWithCountryCode(
                                    row.phone,
                                    phoneDialCode,
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center tabular-nums font-semibold text-[#000000]">
                            #{row.orders}
                          </td>
                          <td className="py-4 px-4 text-[#000000]">
                            <div className="font-medium text-xs">
                              {row.lastOrderDate}
                            </div>
                            <div className="text-[11px] text-[#645d58]">
                              {row.lastOrderSession}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right tabular-nums font-bold text-[#000000]">
                            {formatPriceWithSymbol(
                              row.totalSpendPaise,
                              currencySymbol,
                              countryCode,
                              true,
                            )}
                          </td>
                          <td className="py-4 px-4">
                            {row.retentionType === "repeat" ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#000000] text-white text-[11px] font-semibold">
                                <span className="material-symbols-outlined text-[13px]">
                                  military_tech
                                </span>
                                <span>{row.retentionTier}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#f4ece8] text-[#645d58] text-[11px] font-semibold">
                                <span className="material-symbols-outlined text-[13px]">
                                  person
                                </span>
                                <span>{row.retentionTier}</span>
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eee7e3] text-[#1e1b19] text-[11px] font-semibold">
                              <span className="material-symbols-outlined text-[14px] text-[#645d58]">
                                {row.sourceIcon}
                              </span>
                              <span>{row.source}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right tabular-nums font-medium text-[#645d58]">
                            {formatPriceWithSymbol(
                              row.avgOrderValuePaise,
                              currencySymbol,
                              countryCode,
                              true,
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedDiner(row)}
                              className="h-8 px-4 bg-[#eee7e3] hover:bg-[#000000] hover:text-white text-[#000000] text-xs font-semibold rounded-full transition-all inline-flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              <span>View Profile</span>
                              <span className="material-symbols-outlined text-[14px]">
                                arrow_forward
                              </span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {filteredDiners.length > 0 && (
              <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-[#faf2ee] flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 border-t border-[#e9e1dd] text-center sm:text-left">
                <div className="text-xs text-[#645d58]">
                  Showing{" "}
                  <span className="font-semibold text-[#000000]">
                    {(currentPage - 1) * pageSize + 1} –{" "}
                    {Math.min(currentPage * pageSize, filteredDiners.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-[#000000]">
                    {filteredDiners.length}
                  </span>{" "}
                  customers
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-end">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-full text-xs font-semibold text-[#645d58] bg-[#f4ece8] disabled:opacity-40 hover:bg-[#eee7e3] transition-colors cursor-pointer"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalDinerPages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                        currentPage === i + 1
                          ? "bg-[#000000] text-white shadow-xs"
                          : "hover:bg-[#eee7e3] text-[#1e1b19]"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={
                      currentPage === totalDinerPages || totalDinerPages === 0
                    }
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalDinerPages, p + 1))
                    }
                    className="px-3 py-1 rounded-full text-xs font-semibold text-[#1e1b19] bg-[#f4ece8] disabled:opacity-40 hover:bg-[#eee7e3] transition-colors cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* VIEW MODE 2: DAILY PATRONAGE SUMMARY (Exact Match with Old Project defx-pos-frontend Table) */}
      {viewMode === "daily" && (
        <div className="bg-white rounded-2xl shadow-xs border border-[#d0c4be]/40 overflow-hidden flex flex-col">
          {/* Table Header Info Bar */}
          <div className="px-4 sm:px-6 py-3 sm:py-3.5 bg-[#faf2ee] flex items-center justify-between border-b border-[#e9e1dd]">
            <div className="flex items-center gap-2 sm:gap-3">
              <span
                className="text-base sm:text-lg text-[#000000] font-normal"
                style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
              >
                Daily Customer Patronage Ledger
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#f4ece8] text-[10px] sm:text-[11px] font-semibold text-[#645d58] border border-[#e9e1dd]">
                {dailyTableData.length} dates
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#645d58]">
              <span className="material-symbols-outlined text-[16px]">
                calendar_view_day
              </span>
              <span>Daily Breakdown</span>
            </div>
          </div>

          {/* Daily Table (Matches columns: Date, Total customers, New customers, Repeat customers, Retention rate, Avg customer spend) */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-[#faf2ee] text-[#645d58] text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-4 text-center">Total Customers</th>
                  <th className="py-3 px-4 text-center">New Customers</th>
                  <th className="py-3 px-4 text-center">Repeat Customers</th>
                  <th className="py-3 px-4 text-center">Retention Rate</th>
                  <th className="py-3 px-6 text-right">Avg Customer Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4ece8] text-xs">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="py-4 px-6">
                        <div className="animate-pulse h-4 bg-[#f4ece8] rounded w-full"></div>
                      </td>
                    </tr>
                  ))
                ) : paginatedDailyData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-16 text-center text-[#7f7570]"
                    >
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <span className="material-symbols-outlined text-[48px] text-[#b4a9a4]">
                          event_busy
                        </span>
                        <p className="font-semibold text-base text-[#1e1b19]">
                          No Daily Customer Transactions Available
                        </p>
                        <p className="text-xs text-[#645d58] max-w-sm">
                          Daily records will appear dynamically once customer
                          transactions are logged during this date range.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedDailyData.map((row, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-[#faf2ee]/50 transition-colors"
                    >
                      <td className="py-4 px-6 font-semibold text-[#000000]">
                        {row.date}
                      </td>
                      <td className="py-4 px-4 text-center tabular-nums font-semibold text-[#000000]">
                        {row.total_customers}
                      </td>
                      <td className="py-4 px-4 text-center tabular-nums text-[#645d58]">
                        {row.new_customers}
                      </td>
                      <td className="py-4 px-4 text-center tabular-nums text-[#000000]">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#f4ece8] font-semibold text-[11px]">
                          {row.repeat_customers}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center tabular-nums font-semibold text-[#000000]">
                        {row.retention_rate}
                      </td>
                      <td className="py-4 px-6 text-right tabular-nums font-bold text-[#000000]">
                        {row.avg_customer_spend}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Daily Pagination Footer */}
          {dailyTableData.length > 0 && (
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-[#faf2ee] flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 border-t border-[#e9e1dd] text-center sm:text-left">
              <div className="text-xs text-[#645d58]">
                Showing{" "}
                <span className="font-semibold text-[#000000]">
                  {(dailyPage - 1) * pageSize + 1} –{" "}
                  {Math.min(dailyPage * pageSize, dailyTableData.length)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-[#000000]">
                  {dailyTableData.length}
                </span>{" "}
                days
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-end">
                <button
                  type="button"
                  disabled={dailyPage === 1}
                  onClick={() => setDailyPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-full text-xs font-semibold text-[#645d58] bg-[#f4ece8] disabled:opacity-40 hover:bg-[#eee7e3] transition-colors cursor-pointer"
                >
                  Previous
                </button>
                {Array.from({ length: totalDailyPages }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setDailyPage(i + 1)}
                    className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                      dailyPage === i + 1
                        ? "bg-[#000000] text-white shadow-xs"
                        : "hover:bg-[#eee7e3] text-[#1e1b19]"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={
                    dailyPage === totalDailyPages || totalDailyPages === 0
                  }
                  onClick={() =>
                    setDailyPage((p) => Math.min(totalDailyPages, p + 1))
                  }
                  className="px-3 py-1 rounded-full text-xs font-semibold text-[#1e1b19] bg-[#f4ece8] disabled:opacity-40 hover:bg-[#eee7e3] transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Profile Slide-Over Drawer Modal */}
      {selectedDiner && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop Wash */}
          <div
            className="absolute inset-0 bg-black/25 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedDiner(null)}
          ></div>

          {/* Modal Card Sheet */}
          <div className="relative w-full max-w-full sm:max-w-md bg-white shadow-2xl flex flex-col justify-between p-4 sm:p-6 lg:p-8 overflow-y-auto z-10 border-l border-[#e9e1dd]">
            <div>
              <div className="flex items-center justify-between pb-3 sm:pb-4 mb-3 sm:mb-4 border-b border-[#f4ece8]">
                <div className="flex items-center gap-2 text-[#645d58] text-[11px] sm:text-xs uppercase tracking-wider font-semibold">
                  <span className="material-symbols-outlined text-[16px]">
                    account_box
                  </span>
                  <span>Customer Profile Folio</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDiner(null)}
                  className="w-8 h-8 rounded-full bg-[#faf2ee] hover:bg-[#eee7e3] flex items-center justify-center text-[#1e1b19] transition-colors cursor-pointer shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    close
                  </span>
                </button>
              </div>

              {/* Customer Identity Core */}
              <div className="text-center py-4 sm:py-6 bg-[#faf2ee] rounded-2xl mb-4 sm:mb-6 border border-[#e9e1dd]">
                <div
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#eae1da] text-[#1f1b17] flex items-center justify-center text-lg sm:text-xl font-normal mx-auto mb-2"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  {selectedDiner.name
                    .split(" ")
                    .filter(Boolean)
                    .map((n) => n[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase() || "GU"}
                </div>
                <h2
                  className="text-xl sm:text-2xl text-[#000000] leading-tight font-normal"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  {selectedDiner.name}
                </h2>
                <p className="text-xs text-[#645d58] font-mono mt-0.5">
                  {formatPhoneNumberWithCountryCode(
                    selectedDiner.phone,
                    phoneDialCode,
                  )}
                </p>
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1 rounded-full bg-[#000000] text-white text-xs font-semibold">
                  <span className="material-symbols-outlined text-[13px]">
                    military_tech
                  </span>
                  <span>{selectedDiner.retentionTier}</span>
                </div>
              </div>

              {/* Metric Grid */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mb-4 sm:mb-6">
                <div className="bg-[#faf2ee] p-3 sm:p-4 rounded-xl border border-[#e9e1dd]">
                  <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#645d58] font-semibold block mb-1 truncate">
                    Cumulative Spend
                  </span>
                  <span
                    className="text-lg sm:text-xl text-[#000000] font-normal tabular-nums"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {formatPriceWithSymbol(
                      selectedDiner.totalSpendPaise,
                      currencySymbol,
                      countryCode,
                      true,
                    )}
                  </span>
                </div>
                <div className="bg-[#faf2ee] p-3 sm:p-4 rounded-xl border border-[#e9e1dd]">
                  <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#645d58] font-semibold block mb-1 truncate">
                    Orders Placed
                  </span>
                  <span
                    className="text-lg sm:text-xl text-[#000000] font-normal tabular-nums"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {selectedDiner.orders} Orders
                  </span>
                </div>
              </div>

              {/* Service Channel Habit */}
              <div className="mb-4 sm:mb-6">
                <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#645d58] font-semibold block mb-2">
                  Service Channel Preference
                </span>
                <div className="flex items-center justify-between p-3 sm:p-4 bg-[#faf2ee] rounded-xl border border-[#e9e1dd]">
                  <span className="text-xs text-[#1e1b19] flex items-center gap-2 font-medium">
                    <span className="material-symbols-outlined text-[18px] text-[#645d58]">
                      {selectedDiner.sourceIcon}
                    </span>
                    <span>Primary Channel</span>
                  </span>
                  <span className="text-xs font-semibold text-[#000000]">
                    {selectedDiner.source}
                  </span>
                </div>
              </div>

              {/* Recent Audit Chronology */}
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold block mb-2">
                  Order History Chronology
                </span>
                <div className="space-y-2">
                  {selectedDiner.recentOrders &&
                  selectedDiner.recentOrders.length > 0 ? (
                    selectedDiner.recentOrders.map((ro, i) => (
                      <div
                        key={i}
                        className="p-3 bg-[#faf2ee] rounded-xl border border-[#e9e1dd] flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-[#000000]">
                            {ro.check}
                          </div>
                          <div className="text-[11px] text-[#645d58]">
                            {ro.session}
                          </div>
                        </div>
                        <span className="font-bold tabular-nums text-[#000000]">
                          {formatPriceWithSymbol(
                            ro.amountPaise,
                            currencySymbol,
                            countryCode,
                            true,
                          )}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 bg-[#faf2ee] rounded-xl border border-[#e9e1dd] flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-[#000000]">
                          Order Checkout
                        </div>
                        <div className="text-[11px] text-[#645d58]">
                          {selectedDiner.lastOrderDate}
                        </div>
                      </div>
                      <span className="font-bold tabular-nums text-[#000000]">
                        {formatPriceWithSymbol(
                          selectedDiner.totalSpendPaise,
                          currencySymbol,
                          countryCode,
                          true,
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer CTA */}
            <div className="pt-6 mt-6 border-t border-[#f4ece8]">
              <button
                type="button"
                onClick={() => setSelectedDiner(null)}
                className="w-full py-2.5 rounded-full bg-[#000000] text-white text-xs font-semibold shadow-xs hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standard Menu Toaster Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
