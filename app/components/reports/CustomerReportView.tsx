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
  getCurrencyForCountry,
} from "../../../lib/constants/countries";
import { DateRange } from "./ReportHeader";
import {
  computeCustomerReportData,
  CustomerReportOutput,
} from "../../reports/reportCalculations";
import { Toast, type ToastMessage } from "../Toast";
import { OrderDateRangePicker } from "../OrderDateRangePicker";

interface CustomerReportViewProps {
  orders: any[];
  backendData?: any;
  loading?: boolean;
  currencySymbol?: string;
  countryCode?: string;
  timezone?: string;
  operationTiming?: any;
  startDateMs?: number;
  selectedRange?: DateRange;
  onRangeChange?: (range: DateRange) => void;
  priorCustomerKeys?: Set<string>;
}

export interface RecentOrderItem {
  check: string;
  session: string;
  amountPaise: number;
  orderNumber?: string;
  orderType?: string;
  createdAt?: number;
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

function ChevronRightIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

export function CustomerReportView({
  orders = [],
  backendData,
  loading = false,
  currencySymbol,
  countryCode = "IN",
  timezone,
  operationTiming,
  startDateMs,
  selectedRange,
  onRangeChange,
  priorCustomerKeys,
}: CustomerReportViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "repeat" | "single" | "high-value"
  >("all");
  const [selectedDiner, setSelectedDiner] = useState<DinerRecord | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [drawerOrderPage, setDrawerOrderPage] = useState(1);
  const drawerPageSize = 5;

  const handleOpenDinerProfile = (diner: DinerRecord) => {
    setSelectedDiner(diner);
    setDrawerOrderPage(1);
  };

  // Standard Menu Toaster Notification State
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "info",
    subtext?: string,
  ) => {
    setToast({ message, type, subtext });
  };

  const phoneDialCode = getPhoneCodeForCountry(countryCode || "IN");
  const storeTz = timezone || getTimezoneForCountry(countryCode || "IN");
  const resolvedCurrencySymbol =
    currencySymbol || getCurrencyForCountry(countryCode || "IN").symbol || "₹";

  // 1. Calculate Summary & Daily Breakdown (matching old defx-pos-frontend report data model)
  const summaryReport: CustomerReportOutput = useMemo(() => {
    if (backendData) {
      return {
        total_customers: backendData.totalCustomers || 0,
        new_customers: backendData.newCustomers || 0,
        repeat_customers: backendData.repeatCustomers || 0,
        retention_rate: `${backendData.retentionRate || 0}%`,
        avg_customer_spend: formatPriceWithSymbol(
          backendData.avgCustomerSpend || 0,
          resolvedCurrencySymbol,
          countryCode,
          true
        ),
        table_data: (backendData.tableData || []).map((d: any) => ({
          date: d.displayDate || d.date,
          total_customers: d.totalCustomers || 0,
          new_customers: d.newCustomers || 0,
          repeat_customers: d.repeatCustomers || 0,
          retention_rate: `${d.retentionRate || 0}%`,
          avg_customer_spend: formatPriceWithSymbol(
            d.avgCustomerSpend || 0,
            resolvedCurrencySymbol,
            countryCode,
            true
          ),
        })),
        length: backendData.tableData ? backendData.tableData.length : 0,
      };
    }
    return computeCustomerReportData(
      orders,
      resolvedCurrencySymbol,
      countryCode,
      storeTz,
      startDateMs,
      priorCustomerKeys,
    );
  }, [backendData, orders, resolvedCurrencySymbol, countryCode, storeTz, startDateMs, priorCustomerKeys]);

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
      const orderTime =
        Number(order.createdAt || order._creationTime) || Date.now();
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

      const formattedOrderNumber = order.orderNumber
        ? (order.orderNumber.startsWith("#") ? order.orderNumber : `#${order.orderNumber}`)
        : `#${existing.orders}`;

      existing.recentOrders.push({
        check: formattedOrderNumber,
        session: `${formatStoreDateTime(orderTime, countryCode, storeTz)} • ${tableSession}`,
        amountPaise: spend,
        orderNumber: order.orderNumber,
        orderType,
        createdAt: orderTime,
      });
    }

    const liveList = Array.from(customerMap.values()).map((c) => {
      // Sort orders descending (latest / newest first)
      c.recentOrders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

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

      // Sort recent orders newest / latest first
      c.recentOrders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

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
        recentOrders: c.recentOrders,
      };
    });

    liveList.sort((a, b) => b.totalSpendPaise - a.totalSpendPaise);
    return liveList;
  }, [orders, countryCode, storeTz]);

  // Pure live customer diner data from store orders (NO sample/demo fallback)
  const diners: DinerRecord[] = liveCustomerData;

  // Exact KPI metrics calculated from real database orders
  const totalDiners =
    summaryReport.total_customers > 0
      ? summaryReport.total_customers
      : diners.length;
  const repeatDiners = diners.filter(
    (d: DinerRecord) => d.retentionType === "repeat",
  ).length;
  const singleDiners = diners.filter(
    (d: DinerRecord) => d.retentionType === "single",
  ).length;
  const newDiners =
    summaryReport.new_customers > 0
      ? summaryReport.new_customers
      : singleDiners > 0
        ? singleDiners
        : Math.max(0, totalDiners - repeatDiners);
  const repeatRatio =
    summaryReport.retention_rate && summaryReport.retention_rate !== "0%"
      ? summaryReport.retention_rate
      : totalDiners > 0
        ? `${((repeatDiners / totalDiners) * 100).toFixed(1)}%`
        : "0.0%";
  const acquisitionIndex =
    totalDiners > 0 ? ((newDiners / totalDiners) * 100).toFixed(1) : "0.0";

  const totalSpendPaise = diners.reduce(
    (sum: number, d: DinerRecord) => sum + d.totalSpendPaise,
    0,
  );
  const totalCompletedOrders = diners.reduce(
    (sum: number, d: DinerRecord) => sum + d.orders,
    0,
  );
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

  // Paginated Drawer Orders (guaranteed sorted newest / latest first)
  const allDrawerOrders = useMemo(() => {
    const list = [...(selectedDiner?.recentOrders || [])];
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return list;
  }, [selectedDiner]);
  const totalDrawerOrderPages = Math.ceil(allDrawerOrders.length / drawerPageSize) || 1;
  const paginatedDrawerOrders = useMemo(() => {
    const start = (drawerOrderPage - 1) * drawerPageSize;
    return allDrawerOrders.slice(start, start + drawerPageSize);
  }, [allDrawerOrders, drawerOrderPage, drawerPageSize]);

  // Export CSV (Exports customer registry ledger data)
  const handleExportCsv = () => {
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
  };

  return (
    <div className="flex flex-col w-full">
      {/* Page Header & Date Range Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div>
          {/* Breadcrumbs */}
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
              Customer Report
            </span>
          </nav>
          {/* Title */}
          <h1
            className="font-garamond text-[32px] md:text-[36px] text-[#0c0a09] font-normal leading-tight"
            style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
          >
            Customer Report
          </h1>
          <p className="text-[#5e5e5e] text-[14px] mt-1 font-normal max-w-xl">
            Understand guest patronage, cumulative spend trajectories, and repeat dining cadences across service consoles.
          </p>
        </div>

        {/* Date Range Selector & Action Bar */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap sm:flex-nowrap w-full sm:w-auto self-start lg:self-end shrink-0">
          {/* Order Calendar Date Range Picker */}
          {selectedRange && onRangeChange ? (
            <OrderDateRangePicker
              startDate={selectedRange.startDate}
              endDate={selectedRange.endDate}
              preset={selectedRange.preset}
              onChange={onRangeChange}
              countryCode={countryCode}
              timezone={storeTz}
              align="right"
            />
          ) : null}

          {/* Export CSV Action */}
          <button
            onClick={handleExportCsv}
            type="button"
            className="h-10 px-4 bg-white text-[#0c0a09] rounded-lg shadow-2xs border border-[#e7e5e4] flex items-center gap-2 hover:bg-[#f1edec] transition-all text-xs font-medium cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-[#0c0a09]">file_download</span>
            <span>Export CSV</span>
          </button>

          {/* Print Summary Action (Disabled / Low Opacity) */}
          <button
            type="button"
            disabled
            title="Print Customer Report"
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white text-[#a8a29e] border border-[#e7e5e4] shadow-2xs opacity-40 cursor-not-allowed select-none shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
          </button>
        </div>
      </div>


      {/* 4 Core Analytical Metric Cards (Exact Orders Screen Alignment) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8 font-sans">
        {/* Card 1: Registry Volume */}
        <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
              Registry Volume
            </span>
            <span className="w-7 h-7 rounded-full bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] shrink-0 border border-[#e7e5e4]">
              <span className="material-symbols-outlined text-[16px]">
                groups
              </span>
            </span>
          </div>
          <div>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-[#f1edec] rounded w-1/2"></div>
                <div className="h-4 bg-[#f1edec] rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-garamond text-3xl font-medium text-[#141010] tracking-tight truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {totalDiners}
                  </span>
                  <span className="text-[11px] sm:text-xs text-[#5e5e5e]">
                    diner records
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  Registered diners in directory
                </p>
              </>
            )}
          </div>
          <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#5e5e5e] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#78716c] shrink-0"></span>
            <span className="truncate">Active diner registry</span>
          </div>
        </div>

        {/* Card 2: First-Time Patrons */}
        <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
              First-Time Patrons
            </span>
            <span className="w-7 h-7 rounded-full bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] shrink-0 border border-[#e7e5e4]">
              <span className="material-symbols-outlined text-[16px]">
                person_add
              </span>
            </span>
          </div>
          <div>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-[#f1edec] rounded w-1/2"></div>
                <div className="h-4 bg-[#f1edec] rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-garamond text-3xl font-medium text-[#141010] tracking-tight truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {newDiners}
                  </span>
                  <span className="text-[11px] sm:text-xs text-[#5e5e5e]">
                    new profiles
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  First visit recorded in this period
                </p>
              </>
            )}
          </div>
          <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#5e5e5e] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#78716c] shrink-0"></span>
            <span className="truncate">{acquisitionIndex}% acquisition index</span>
          </div>
        </div>

        {/* Card 3: Repeat Patronage */}
        <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
              Repeat Patronage
            </span>
            <span className="w-7 h-7 rounded-full bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] shrink-0 border border-[#e7e5e4]">
              <span className="material-symbols-outlined text-[16px]">
                sync_alt
              </span>
            </span>
          </div>
          <div>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-[#f1edec] rounded w-1/2"></div>
                <div className="h-4 bg-[#f1edec] rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-garamond text-3xl font-medium text-[#141010] tracking-tight truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {repeatRatio}
                  </span>
                  <span className="text-[11px] sm:text-xs text-[#5e5e5e]">
                    ratio
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  {repeatDiners} diners with ≥ 2 completed orders
                </p>
              </>
            )}
          </div>
          <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#5e5e5e] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0c0a09] shrink-0"></span>
            <span className="truncate">High-retention dining roster</span>
          </div>
        </div>

        {/* Card 4: Average Spend / Diner */}
        <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
              Average Spend / Diner
            </span>
            <span className="w-7 h-7 rounded-full bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] shrink-0 border border-[#e7e5e4]">
              <span className="material-symbols-outlined text-[16px]">
                payments
              </span>
            </span>
          </div>
          <div>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-[#f1edec] rounded w-1/2"></div>
                <div className="h-4 bg-[#f1edec] rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-garamond text-3xl font-medium text-[#141010] tracking-tight tabular-nums truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {formatPriceWithSymbol(
                      avgSpendPerDinerPaise,
                      resolvedCurrencySymbol,
                      countryCode,
                      true,
                    )}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  Calculated across {totalCompletedOrders} total completed orders
                </p>
              </>
            )}
          </div>
          <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#5e5e5e] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#78716c] shrink-0"></span>
            <span className="truncate">
              Gross sales pool:{" "}
              {formatPriceWithSymbol(
                totalSpendPaise,
                resolvedCurrencySymbol,
                countryCode,
                true,
              )}
            </span>
          </div>
        </div>
      </div>

      {/* DINER LEDGER & PROFILES */}
      <>
          {/* Search & Segment Filtration Ribbon */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-xs border border-[#e7e5e4] mb-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4 font-sans">
            {/* Search Field */}
            <div className="relative flex-1 min-w-[200px] sm:min-w-[260px]">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5e5e5e] text-[20px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={`Search customer by name, mobile number (${phoneDialCode}...)...`}
                className="w-full pl-10 pr-4 py-2.5 bg-[#fdf8f7] text-[#0c0a09] rounded-lg text-xs placeholder:text-[#5e5e5e] focus:outline-none focus:bg-white focus:border-[#0c0a09] transition-all border border-[#e7e5e4]"
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
                className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shadow-xs transition-all cursor-pointer ${
                  activeFilter === "all"
                    ? "bg-[#0c0a09] text-white"
                    : "bg-white hover:bg-[#f1edec] text-[#0c0a09] border border-[#e7e5e4]"
                }`}
              >
                All Customers ({diners.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveFilter("repeat");
                  setCurrentPage(1);
                }}
                className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shadow-xs transition-all cursor-pointer ${
                  activeFilter === "repeat"
                    ? "bg-[#0c0a09] text-white"
                    : "bg-white hover:bg-[#f1edec] text-[#0c0a09] border border-[#e7e5e4]"
                }`}
              >
                Repeat Diners ({repeatDiners})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveFilter("single");
                  setCurrentPage(1);
                }}
                className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shadow-xs transition-all cursor-pointer ${
                  activeFilter === "single"
                    ? "bg-[#0c0a09] text-white"
                    : "bg-white hover:bg-[#f1edec] text-[#0c0a09] border border-[#e7e5e4]"
                }`}
              >
                Single Visit ({singleDiners})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveFilter("high-value");
                  setCurrentPage(1);
                }}
                className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shadow-xs transition-all cursor-pointer ${
                  activeFilter === "high-value"
                    ? "bg-[#0c0a09] text-white"
                    : "bg-white hover:bg-[#f1edec] text-[#0c0a09] border border-[#e7e5e4]"
                }`}
              >
                High Value (&gt;{" "}
                {formatPriceWithSymbol(
                  300000,
                  resolvedCurrencySymbol,
                  countryCode,
                  true,
                ).replace(/\.00$/, "")}
                )
              </button>
            </div>
          </div>

          {/* Customer Performance Table Panel (Styled matching Orders Table) */}
          <div className="bg-white rounded-xl shadow-xs border border-[#e7e5e4] overflow-hidden flex flex-col font-sans">
            {/* Table Header Info Bar */}
            <div className="px-5 py-3.5 bg-[#fdf8f7] flex items-center justify-between border-b border-[#e7e5e4]">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-semibold text-[#0c0a09]">
                  Diner Ledger &amp; Velocity
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#f1edec] text-[11px] font-medium text-[#5e5e5e] border border-[#e7e5e4]">
                  {filteredDiners.length} matching records
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#5e5e5e]">
                <span className="material-symbols-outlined text-[16px] text-emerald-600">
                  verified
                </span>
                <span className="font-medium">Active Customer Ledger</span>
              </div>
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="border-b border-[#e7e5e4] bg-[#fdf8f7] text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold whitespace-nowrap min-w-[170px]">Customer Profile</th>
                    <th className="py-3 px-3 font-semibold text-center whitespace-nowrap min-w-[90px]">Total Orders</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap min-w-[170px]">Last Order</th>
                    <th className="py-3 px-4 font-semibold text-right whitespace-nowrap min-w-[110px]">Total Spend</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap min-w-[140px]">Retention Tier</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap min-w-[110px]">Primary Source</th>
                    <th className="py-3 px-4 font-semibold text-right whitespace-nowrap min-w-[120px]">Avg Order Value</th>
                    <th className="py-3 px-4 font-semibold text-right whitespace-nowrap min-w-[110px]">Action</th>
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
                          <p className="font-semibold text-base text-[#0c0a09]">
                            No Customer Records Found
                          </p>
                          <p className="text-xs text-[#5e5e5e] max-w-sm">
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
                              className="mt-2 px-4 py-1.5 rounded-lg bg-[#0c0a09] text-white text-xs font-semibold cursor-pointer shadow-xs"
                            >
                              Clear Filter Query
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedDiners.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-[#fdf8f7] transition-colors group cursor-default"
                      >
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-[#0c0a09] text-[13px] whitespace-nowrap">
                                {row.name}
                              </span>
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  row.retentionType === "repeat"
                                    ? "bg-[#0c0a09]"
                                    : "bg-[#d0c4be]"
                                }`}
                                title={
                                  row.retentionType === "repeat"
                                    ? "Active regular patron"
                                    : "First visit patron"
                                }
                              ></span>
                            </div>
                            <div className="text-[12px] text-[#5e5e5e] font-sans whitespace-nowrap">
                              {formatPhoneNumberWithCountryCode(
                                row.phone,
                                phoneDialCode,
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-center font-medium text-[#0c0a09] text-[13px] tabular-nums whitespace-nowrap">
                          {row.orders}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-medium text-[#0c0a09] text-[13px] whitespace-nowrap">
                            {row.lastOrderDate}
                          </div>
                          <div className="text-[11px] text-[#5e5e5e] whitespace-nowrap">
                            {row.lastOrderSession}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-bold text-[#0c0a09] text-[13px] whitespace-nowrap">
                          {formatPriceWithSymbol(
                            row.totalSpendPaise,
                            resolvedCurrencySymbol,
                            countryCode,
                            true,
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {row.retentionType === "repeat" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0c0a09] text-white text-[11px] font-medium whitespace-nowrap">
                              <span className="material-symbols-outlined text-[13px]">
                                military_tech
                              </span>
                              <span>{row.retentionTier}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#f1edec] text-[#0c0a09] text-[11px] font-medium border border-[#e7e5e4] whitespace-nowrap">
                              <span className="material-symbols-outlined text-[13px] text-[#5e5e5e]">
                                person
                              </span>
                              <span>{row.retentionTier}</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#f1edec] text-[#0c0a09] text-[11px] font-medium border border-[#e7e5e4] whitespace-nowrap">
                            {row.source}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-bold text-[#0c0a09] text-[13px] whitespace-nowrap">
                          {formatPriceWithSymbol(
                            row.avgOrderValuePaise,
                            resolvedCurrencySymbol,
                            countryCode,
                            true,
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenDinerProfile(row)}
                            className="h-8 px-3.5 bg-[#f1edec] hover:bg-[#0c0a09] hover:text-white text-[#0c0a09] text-xs font-semibold rounded-lg border border-[#e7e5e4] transition-all inline-flex items-center gap-1 cursor-pointer shadow-xs whitespace-nowrap"
                          >
                            <span>View Profile</span>
                            <span className="material-symbols-outlined text-[14px]">
                              arrow_forward
                            </span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {filteredDiners.length > 0 && (
              <div className="px-5 py-4 bg-[#fdf8f7] flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#e7e5e4] text-center sm:text-left">
                <div className="text-xs text-[#5e5e5e]">
                  Showing{" "}
                  <span className="font-semibold text-[#0c0a09]">
                    {(currentPage - 1) * pageSize + 1} –{" "}
                    {Math.min(currentPage * pageSize, filteredDiners.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-[#0c0a09]">
                    {filteredDiners.length}
                  </span>{" "}
                  Customers
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-end">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0c0a09] bg-[#f1edec] border border-[#e7e5e4] disabled:opacity-40 hover:bg-[#e7e5e4] transition-colors cursor-pointer"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalDinerPages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                        currentPage === i + 1
                          ? "bg-[#0c0a09] text-white shadow-xs"
                          : "hover:bg-[#f1edec] text-[#0c0a09] border border-[#e7e5e4]"
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
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0c0a09] bg-[#f1edec] border border-[#e7e5e4] disabled:opacity-40 hover:bg-[#e7e5e4] transition-colors cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>

      {/* Detail Profile Slide-Over Drawer Modal */}
      {selectedDiner && (
        <div className="fixed inset-0 z-50 flex justify-end font-sans">
          {/* Backdrop Wash */}
          <div
            className="absolute inset-0 bg-black/25 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedDiner(null)}
          ></div>

          {/* Modal Card Sheet */}
          <div className="relative w-full max-w-full sm:max-w-md bg-white shadow-2xl flex flex-col justify-between p-4 sm:p-6 overflow-y-auto z-10 border-l border-[#e7e5e4]">
            <div>
              <div className="flex items-center justify-between pb-3 sm:pb-4 mb-3 sm:mb-4 border-b border-[#e7e5e4]">
                <div className="flex items-center gap-2 text-[#5e5e5e] text-[11px] sm:text-xs uppercase tracking-wider font-semibold">
                  <span className="material-symbols-outlined text-[16px]">
                    account_box
                  </span>
                  <span>Customer Profile Folio</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDiner(null)}
                  className="w-8 h-8 rounded-full bg-[#f1edec] hover:bg-[#e7e5e4] flex items-center justify-center text-[#0c0a09] transition-colors cursor-pointer shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    close
                  </span>
                </button>
              </div>

              {/* Customer Identity Core */}
              <div className="text-center py-5 bg-[#fdf8f7] rounded-xl mb-4 border border-[#e7e5e4]">
                <div className="w-14 h-14 rounded-full bg-[#f1edec] text-[#0c0a09] flex items-center justify-center text-lg font-bold mx-auto mb-2 border border-[#e7e5e4]">
                  {selectedDiner.name
                    .split(" ")
                    .filter(Boolean)
                    .map((n) => n[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase() || "GU"}
                </div>
                <h2 className="text-xl text-[#0c0a09] leading-tight font-bold">
                  {selectedDiner.name}
                </h2>
                <p className="text-xs text-[#5e5e5e] mt-0.5">
                  {formatPhoneNumberWithCountryCode(
                    selectedDiner.phone,
                    phoneDialCode,
                  )}
                </p>
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#0c0a09] text-white text-xs font-semibold">
                  <span className="material-symbols-outlined text-[13px]">
                    military_tech
                  </span>
                  <span>{selectedDiner.retentionTier}</span>
                </div>
              </div>

              {/* Metric Grid */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mb-4">
                <div className="bg-[#fdf8f7] p-3 sm:p-4 rounded-xl border border-[#e7e5e4]">
                  <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold block mb-1 truncate">
                    Cumulative Spend
                  </span>
                  <span
                    className="font-garamond text-2xl font-medium text-[#141010] tabular-nums"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {formatPriceWithSymbol(
                      selectedDiner.totalSpendPaise,
                      resolvedCurrencySymbol,
                      countryCode,
                      true,
                    )}
                  </span>
                </div>
                <div className="bg-[#fdf8f7] p-3 sm:p-4 rounded-xl border border-[#e7e5e4]">
                  <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold block mb-1 truncate">
                    Orders Placed
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="font-garamond text-2xl font-medium text-[#141010] tabular-nums"
                      style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                    >
                      {selectedDiner.orders}
                    </span>
                    <span className="text-xs font-medium text-[#5e5e5e] font-sans">
                      {selectedDiner.orders === 1 ? "Order" : "Orders"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Service Channel Habit */}
              <div className="mb-4">
                <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold block mb-2">
                  Service Channel Preference
                </span>
                <div className="flex items-center justify-between p-3 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4]">
                  <span className="text-xs text-[#0c0a09] flex items-center gap-2 font-medium">
                    <span className="material-symbols-outlined text-[18px] text-[#5e5e5e]">
                      {selectedDiner.sourceIcon}
                    </span>
                    <span>Primary Channel</span>
                  </span>
                  <span className="text-xs font-semibold text-[#0c0a09]">
                    {selectedDiner.source}
                  </span>
                </div>
              </div>

              {/* Order History Chronology with Pagination */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
                    Order History Chronology
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#f1edec] text-[10px] font-semibold text-[#5e5e5e] border border-[#e7e5e4]">
                    {allDrawerOrders.length} {allDrawerOrders.length === 1 ? "Order" : "Orders"}
                  </span>
                </div>

                <div className="space-y-2">
                  {paginatedDrawerOrders.length > 0 ? (
                    paginatedDrawerOrders.map((ro, i) => (
                      <div
                        key={i}
                        className="p-3 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] flex items-center justify-between text-xs hover:border-[#d0c4be] transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[#0c0a09] text-[13px]">
                              {ro.check}
                            </span>
                            {ro.orderType && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#f1edec] border border-[#e7e5e4] text-[#5e5e5e]">
                                {ro.orderType}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#5e5e5e]">
                            {ro.session}
                          </div>
                        </div>
                        <span className="font-bold tabular-nums text-[#0c0a09] text-[13px]">
                          {formatPriceWithSymbol(
                            ro.amountPaise,
                            resolvedCurrencySymbol,
                            countryCode,
                            true,
                          )}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] text-center text-xs text-[#5e5e5e]">
                      No individual orders recorded for this customer in this period.
                    </div>
                  )}
                </div>

                {/* Drawer Order Pagination Controls */}
                {totalDrawerOrderPages > 1 && (
                  <div className="mt-3 pt-3 border-t border-[#e7e5e4] flex items-center justify-between text-xs text-[#5e5e5e]">
                    <div>
                      Showing{" "}
                      <span className="font-semibold text-[#0c0a09]">
                        {(drawerOrderPage - 1) * drawerPageSize + 1}–{Math.min(drawerOrderPage * drawerPageSize, allDrawerOrders.length)}
                      </span>{" "}
                      of{" "}
                      <span className="font-semibold text-[#0c0a09]">
                        {allDrawerOrders.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={drawerOrderPage === 1}
                        onClick={() => setDrawerOrderPage((p) => Math.max(1, p - 1))}
                        className="px-2 py-1 rounded text-xs font-semibold text-[#0c0a09] bg-[#f1edec] border border-[#e7e5e4] disabled:opacity-40 hover:bg-[#e7e5e4] transition-colors cursor-pointer"
                      >
                        Prev
                      </button>
                      {Array.from({ length: totalDrawerOrderPages }).map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setDrawerOrderPage(idx + 1)}
                          className={`w-6 h-6 rounded text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                            drawerOrderPage === idx + 1
                              ? "bg-[#0c0a09] text-white shadow-xs"
                              : "hover:bg-[#f1edec] text-[#0c0a09] border border-[#e7e5e4]"
                          }`}
                        >
                          {idx + 1}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={drawerOrderPage === totalDrawerOrderPages}
                        onClick={() =>
                          setDrawerOrderPage((p) =>
                            Math.min(totalDrawerOrderPages, p + 1),
                          )
                        }
                        className="px-2 py-1 rounded text-xs font-semibold text-[#0c0a09] bg-[#f1edec] border border-[#e7e5e4] disabled:opacity-40 hover:bg-[#e7e5e4] transition-colors cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer CTA */}
            <div className="pt-4 mt-4 border-t border-[#e7e5e4]">
              <button
                type="button"
                onClick={() => setSelectedDiner(null)}
                className="w-full py-2.5 rounded-lg bg-[#0c0a09] text-white text-xs font-semibold shadow-xs hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Return to Registry
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
