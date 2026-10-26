"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { PosShell } from "../components/PosShell";
import { api } from "../../convex/_generated/api";
import { Doc, Id } from "../../convex/_generated/dataModel";

import { EditCustomerModal } from "../components/customers/EditCustomerModal";
import { DeleteCustomerModal } from "../components/customers/DeleteCustomerModal";

import {
  formatPhoneNumberWithCountryCode,
  formatCurrencyAmount,
  formatStoreDateTime,
  formatStoreDate,
  getCurrencyForCountry,
  getPhoneCodeForCountry,
  getTimezoneForCountry,
} from "../../lib/constants/countries";

function CalendarIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ChevronDownIcon({
  className = "w-3.5 h-3.5",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        d="M19 9l-7 7-7-7"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

const MONTH_NAMES = [
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
] as const;

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function getStartOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function getEndOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function getPresetDateRange(preset: string): { start: Date; end: Date } {
  const now = new Date();
  const today = getStartOfDay(now);
  if (preset === "Today") {
    return { start: today, end: today };
  }
  if (preset === "Yesterday") {
    const y = new Date(today);
    y.setDate(today.getDate() - 1);
    return { start: y, end: y };
  }
  if (preset === "Last 7 Days") {
    const past = new Date(today);
    past.setDate(today.getDate() - 6);
    return { start: past, end: today };
  }
  if (preset === "Last 30 Days") {
    const past = new Date(today);
    past.setDate(today.getDate() - 29);
    return { start: past, end: today };
  }
  if (preset === "This Month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start, end: today };
  }
  if (preset === "Last Month") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { start, end };
  }
  return { start: today, end: today };
}

const DATE_RANGE_OPTIONS = [
  "All Time",
  "Today",
  "Yesterday",
  "Last 7 Days",
  "Last 30 Days",
  "This Month",
  "Last Month",
  "Custom Range",
] as const;

export interface CustomerRowData {
  id: string; // Stable unique lookup key
  convexId?: Id<"customers">;
  name: string;
  phone: string;
  countryCode: string;
  email: string;
  totalOrders: number;
  lastOrderDate?: number;
  lastOrderDisplay: string;
  lastOrderNumber: string;
  totalSpend: number; // in currency units
  retentionPercent: number;
  averageOrderSource: string;
  averageOrderValue: number;
}

export default function CustomersPage() {
  const router = useRouter();

  // Query Active Organization for currency symbol and timezone
  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;

  const currencySymbol =
    activeOrg?.defaultCurrencySymbol ||
    (activeOrg?.country ? getCurrencyForCountry(activeOrg.country).symbol : "₹");
  const storeTimezone =
    activeOrg?.organizationTimeZone ||
    (activeOrg?.country ? getTimezoneForCountry(activeOrg.country) : "Asia/Kolkata");
  const storePhoneCode = activeOrg?.country ? getPhoneCodeForCountry(activeOrg.country) : "+91";

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // Applied Date Filter
  const [appliedPreset, setAppliedPreset] = useState<string>("All Time");
  const [appliedStartDate, setAppliedStartDate] = useState<Date>(() => getPresetDateRange("Today").start);
  const [appliedEndDate, setAppliedEndDate] = useState<Date>(() => getPresetDateRange("Today").end);

  // Draft Date Filter (while popover is open)
  const [draftPreset, setDraftPreset] = useState<string>("All Time");
  const [draftStartDate, setDraftStartDate] = useState<Date>(() => getPresetDateRange("Today").start);
  const [draftEndDate, setDraftEndDate] = useState<Date>(() => getPresetDateRange("Today").end);
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dateDropdownRef.current &&
        !dateDropdownRef.current.contains(e.target as Node)
      ) {
        setIsDateDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formattedDateRangeText = useMemo(() => {
    if (appliedPreset === "All Time") return "All Time";
    return `${formatStoreDate(appliedStartDate, activeOrg?.country, storeTimezone)} - ${formatStoreDate(appliedEndDate, activeOrg?.country, storeTimezone)}`;
  }, [appliedPreset, appliedStartDate, appliedEndDate, activeOrg, storeTimezone]);

  const handleOpenDateDropdown = () => {
    setDraftPreset(appliedPreset);
    setDraftStartDate(new Date(appliedStartDate));
    setDraftEndDate(new Date(appliedEndDate));
    setViewMonth(
      new Date(appliedStartDate.getFullYear(), appliedStartDate.getMonth(), 1)
    );
    setIsDateDropdownOpen(true);
  };

  const handlePresetClick = (preset: string) => {
    setDraftPreset(preset);
    if (preset === "All Time") {
      const now = new Date();
      const today = getStartOfDay(now);
      setDraftStartDate(new Date(2020, 0, 1));
      setDraftEndDate(today);
      setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    } else if (preset !== "Custom Range") {
      const { start, end } = getPresetDateRange(preset);
      setDraftStartDate(start);
      setDraftEndDate(end);
      setViewMonth(new Date(start.getFullYear(), start.getMonth(), 1));
    }
  };

  const handleNavigateMonth = (direction: -1 | 1) => {
    setViewMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1)
    );
  };

  const handleDateCellClick = (clickedDate: Date) => {
    const normClicked = getStartOfDay(clickedDate);
    const normStart = getStartOfDay(draftStartDate);
    const normEnd = getStartOfDay(draftEndDate);

    if (draftPreset === "All Time" || normStart.getTime() === normEnd.getTime()) {
      if (normClicked.getTime() < normStart.getTime()) {
        setDraftStartDate(normClicked);
        setDraftEndDate(normStart);
      } else {
        setDraftEndDate(normClicked);
      }
    } else {
      setDraftStartDate(normClicked);
      setDraftEndDate(normClicked);
    }
    setDraftPreset("Custom Range");
  };

  const handleApplyDate = () => {
    setAppliedPreset(draftPreset);
    setAppliedStartDate(draftStartDate);
    setAppliedEndDate(draftEndDate);
    setCurrentPage(1);
    setIsDateDropdownOpen(false);
  };

  const handleCancelDate = () => {
    setIsDateDropdownOpen(false);
  };

  const renderMonthCalendar = (
    year: number,
    month: number,
    isFirstMonth: boolean,
    isLastMonth: boolean
  ) => {
    const monthName = MONTH_NAMES[month];
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: Array<{
      date: Date;
      isCurrentMonth: boolean;
      dayNum: number;
    }> = [];

    // Prev month trailing days
    for (let i = 0; i < firstDayOfWeek; i++) {
      const dayNum = daysInPrevMonth - firstDayOfWeek + 1 + i;
      cells.push({
        date: new Date(year, month - 1, dayNum),
        isCurrentMonth: false,
        dayNum,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
        dayNum: i,
      });
    }

    // Next month leading days to complete grid (up to 42 cells)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        dayNum: i,
      });
    }

    const startNorm = draftPreset === "All Time" ? 0 : getStartOfDay(draftStartDate).getTime();
    const endNorm = draftPreset === "All Time" ? 0 : getStartOfDay(draftEndDate).getTime();

    return (
      <div className="w-56 font-sans">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-2">
          {isFirstMonth ? (
            <button
              type="button"
              onClick={() => handleNavigateMonth(-1)}
              className="p-1 hover:bg-[#f1edec] rounded text-[#5e5e5e] hover:text-[#141010] cursor-pointer"
            >
              &lt;
            </button>
          ) : (
            <div className="w-6" />
          )}

          <div className="text-xs font-semibold text-[#0c0a09]">
            {monthName} {year}
          </div>

          {isLastMonth ? (
            <button
              type="button"
              onClick={() => handleNavigateMonth(1)}
              className="p-1 hover:bg-[#f1edec] rounded text-[#5e5e5e] hover:text-[#141010] cursor-pointer"
            >
              &gt;
            </button>
          ) : (
            <div className="w-6" />
          )}
        </div>

        {/* Day Labels */}
        <div className="grid grid-cols-7 text-center text-[10px] font-medium text-[#7a716b] mb-1">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* Day Cells */}
        <div className="grid grid-cols-7 gap-y-0.5 text-center text-xs">
          {cells.map((cell, idx) => {
            const time = getStartOfDay(cell.date).getTime();
            const isSelectedStart = draftPreset !== "All Time" && time === startNorm;
            const isSelectedEnd = draftPreset !== "All Time" && time === endNorm;
            const isInRange = draftPreset !== "All Time" && time >= startNorm && time <= endNorm;
            const isToday = isSameDay(cell.date, new Date());

            let bgClass = "hover:bg-[#f1edec]";
            let textClass = cell.isCurrentMonth
              ? "text-[#0c0a09]"
              : "text-[#b0a8a0]";

            if (isSelectedStart || isSelectedEnd) {
              bgClass = "bg-[#0c0a09] text-white font-semibold rounded-full";
              textClass = "text-white";
            } else if (isInRange) {
              bgClass = "bg-[#e5e7eb] rounded-none";
              textClass = "text-[#0c0a09]";
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleDateCellClick(cell.date)}
                className={`w-7 h-7 flex items-center justify-center mx-auto text-xs cursor-pointer transition-colors ${bgClass} ${textClass} ${
                  isToday && !isSelectedStart && !isSelectedEnd
                    ? "border border-[#0c0a09] font-bold"
                    : ""
                }`}
              >
                {cell.dayNum}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Sorting States
  const [sortField, setSortField] = useState<
    "name" | "totalOrders" | "lastOrderDate" | "totalSpend" | "retentionPercent" | "averageOrderValue"
  >("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Action Modals
  const [editingCustomer, setEditingCustomer] = useState<Doc<"customers"> | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Doc<"customers"> | null>(null);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // 1. Query Customers Table
  const activeSearchTerm = debouncedSearch || "a";
  const searchResults = useQuery(
    api.customers.searchCustomers,
    { query: activeSearchTerm, limit: 100 }
  );

  // 2. Query Store Orders (to aggregate real customer data from orders)
  const ordersResponse = useQuery(
    api.orders.listOrders,
    activeOrg ? { organizationId: activeOrg._id, pageSize: 500 } : "skip"
  );

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Helper to normalize email addresses for deduplication
  const normalizeEmail = (raw?: string | null): string | null => {
    if (!raw) return null;
    const cleaned = raw.toLowerCase().trim();
    if (
      !cleaned ||
      cleaned === "null" ||
      cleaned === "undefined" ||
      cleaned === "none" ||
      cleaned === "guest@example.com" ||
      cleaned === "customer@example.com" ||
      cleaned === "guest" ||
      !cleaned.includes("@")
    ) {
      return null;
    }
    return cleaned;
  };

  // Unified Data Aggregation: Combine Convex `customers` + customer data extracted from `orders`
  const aggregatedCustomers = useMemo(() => {
    const customerMap = new Map<string, CustomerRowData>();
    const convexIdToKey = new Map<string, string>();
    const phoneToKey = new Map<string, string>();
    const emailToKey = new Map<string, string>();
    const nameToKey = new Map<string, string>();

    const sourceCountsMap = new Map<string, Record<string, number>>();

    // Helper to find or resolve customer key by checking existing indexes
    const resolveCustomerKey = (
      convexId: string | null,
      cleanPhone: string | null,
      normEmail: string | null,
      normName: string | null,
      fallbackId?: string
    ): string => {
      const matchedKeysSet = new Set<string>();

      // Check primary strong identifiers first
      if (convexId && convexIdToKey.has(convexId)) {
        matchedKeysSet.add(convexIdToKey.get(convexId)!);
      }
      if (cleanPhone && phoneToKey.has(cleanPhone)) {
        matchedKeysSet.add(phoneToKey.get(cleanPhone)!);
      }
      if (normEmail && emailToKey.has(normEmail)) {
        matchedKeysSet.add(emailToKey.get(normEmail)!);
      }

      // Check secondary identifier (name) only if no primary identifier matched
      if (matchedKeysSet.size === 0 && normName && nameToKey.has(normName)) {
        matchedKeysSet.add(nameToKey.get(normName)!);
      }

      const matchedKeys = Array.from(matchedKeysSet).filter((k) => customerMap.has(k));

      let primaryKey: string;

      if (matchedKeys.length === 0) {
        if (convexId) primaryKey = convexId;
        else if (cleanPhone) primaryKey = `phone_${cleanPhone}`;
        else if (normEmail) primaryKey = `email_${normEmail}`;
        else if (normName) primaryKey = `name_${normName.replace(/\s+/g, "_")}`;
        else primaryKey = fallbackId || `cust_${Math.random().toString(36).substring(2, 9)}`;
      } else {
        primaryKey = matchedKeys[0];

        // Merge duplicate entries if multiple indexes matched different existing records
        for (let i = 1; i < matchedKeys.length; i++) {
          const duplicateKey = matchedKeys[i];
          if (duplicateKey === primaryKey) continue;

          const primaryEntry = customerMap.get(primaryKey);
          const duplicateEntry = customerMap.get(duplicateKey);

          if (primaryEntry && duplicateEntry) {
            primaryEntry.totalOrders += duplicateEntry.totalOrders;
            primaryEntry.totalSpend += duplicateEntry.totalSpend;

            if (duplicateEntry.convexId && !primaryEntry.convexId) {
              primaryEntry.convexId = duplicateEntry.convexId;
            }
            if (duplicateEntry.phone && !primaryEntry.phone) {
              primaryEntry.phone = duplicateEntry.phone;
            }
            if (duplicateEntry.email && !primaryEntry.email) {
              primaryEntry.email = duplicateEntry.email;
            }
            if (
              (!primaryEntry.name || primaryEntry.name === "Guest Customer" || primaryEntry.name.startsWith("+91")) &&
              duplicateEntry.name &&
              duplicateEntry.name !== "Guest Customer"
            ) {
              primaryEntry.name = duplicateEntry.name;
            }

            if (
              duplicateEntry.lastOrderDate &&
              (!primaryEntry.lastOrderDate || duplicateEntry.lastOrderDate > primaryEntry.lastOrderDate)
            ) {
              primaryEntry.lastOrderDate = duplicateEntry.lastOrderDate;
              primaryEntry.lastOrderDisplay = duplicateEntry.lastOrderDisplay;
              primaryEntry.lastOrderNumber = duplicateEntry.lastOrderNumber;
            }

            const dupCounts = sourceCountsMap.get(duplicateKey);
            if (dupCounts) {
              const primCounts = sourceCountsMap.get(primaryKey) || {};
              for (const [src, cnt] of Object.entries(dupCounts)) {
                primCounts[src] = (primCounts[src] || 0) + cnt;
              }
              sourceCountsMap.set(primaryKey, primCounts);
              sourceCountsMap.delete(duplicateKey);
            }

            for (const [id, target] of Array.from(convexIdToKey.entries())) {
              if (target === duplicateKey) convexIdToKey.set(id, primaryKey);
            }
            for (const [p, target] of Array.from(phoneToKey.entries())) {
              if (target === duplicateKey) phoneToKey.set(p, primaryKey);
            }
            for (const [e, target] of Array.from(emailToKey.entries())) {
              if (target === duplicateKey) emailToKey.set(e, primaryKey);
            }
            for (const [n, target] of Array.from(nameToKey.entries())) {
              if (target === duplicateKey) nameToKey.set(n, primaryKey);
            }

            customerMap.delete(duplicateKey);
          }
        }
      }

      if (convexId) convexIdToKey.set(convexId, primaryKey);
      if (cleanPhone) phoneToKey.set(cleanPhone, primaryKey);
      if (normEmail) emailToKey.set(normEmail, primaryKey);
      if (normName) nameToKey.set(normName, primaryKey);

      return primaryKey;
    };

    // A. Populate from Convex `customers` table
    if (searchResults && Array.isArray(searchResults)) {
      for (const cust of searchResults) {
        const convexId = cust._id ? String(cust._id) : null;
        const cleanPhone = (cust.phone || "").replace(/\D/g, "") || null;
        const normEmail = normalizeEmail(cust.email);
        const fullName = `${cust.firstName || ""} ${cust.lastName || ""}`.trim();
        const normName = fullName && fullName !== "Guest Customer" ? fullName.toLowerCase() : null;

        const key = resolveCustomerKey(convexId, cleanPhone, normEmail, normName, cust._id ? String(cust._id) : undefined);

        let entry = customerMap.get(key);
        if (!entry) {
          const displayName = fullName || "Guest Customer";
          entry = {
            id: key,
            convexId: cust._id,
            name: displayName,
            phone: cust.phone || "",
            countryCode: cust.countryCode || "+91",
            email: cust.email || "",
            totalOrders: 0,
            totalSpend: 0,
            lastOrderDisplay: "—",
            lastOrderNumber: "—",
            retentionPercent: 0,
            averageOrderSource: "Dine In",
            averageOrderValue: 0,
          };
          customerMap.set(key, entry);
        } else {
          if (
            (!entry.name || entry.name === "Guest Customer" || entry.name.startsWith("+91")) &&
            fullName
          ) {
            entry.name = fullName;
          }
          if (!entry.phone && cust.phone) {
            entry.phone = cust.phone;
          }
          if (!entry.email && cust.email) {
            entry.email = cust.email;
          }
          if (!entry.convexId && cust._id) {
            entry.convexId = cust._id;
          }
        }
      }
    }

    // B. Aggregate metrics from real `orders` database
    const ordersList = ordersResponse?.orders || [];

    for (const ord of ordersList) {
      const cleanPhone = (ord.customerPhone || "").replace(/\D/g, "") || null;
      const orderCustId = ord.customerId ? String(ord.customerId) : null;
      const rawName = ord.customerName?.trim() || "";
      const orderCustName = rawName && rawName !== "Guest Customer" ? rawName : "";
      const normName = orderCustName ? orderCustName.toLowerCase() : null;
      const normEmail = normalizeEmail(ord.customerEmail);

      const key = resolveCustomerKey(orderCustId, cleanPhone, normEmail, normName, `ordcust_${ord._id}`);

      let entry = customerMap.get(key);

      if (!entry) {
        const name = orderCustName || "Guest Customer";

        entry = {
          id: key,
          convexId: ord.customerId,
          name,
          phone: ord.customerPhone || "",
          countryCode: "+91",
          email: ord.customerEmail || "",
          totalOrders: 0,
          totalSpend: 0,
          lastOrderDisplay: "—",
          lastOrderNumber: "—",
          retentionPercent: 0,
          averageOrderSource: ord.orderType || "Dine In",
          averageOrderValue: 0,
        };
        customerMap.set(key, entry);
      } else {
        // Upgrade entry details if missing or default
        if (
          (!entry.name ||
            entry.name === "Guest Customer" ||
            entry.name.startsWith("+91")) &&
          orderCustName
        ) {
          entry.name = orderCustName;
        }
        if (!entry.phone && ord.customerPhone) {
          entry.phone = ord.customerPhone;
        }
        if (!entry.email && ord.customerEmail) {
          entry.email = ord.customerEmail;
        }
        if (!entry.convexId && ord.customerId) {
          entry.convexId = ord.customerId;
        }
      }

      // Increment metrics
      entry.totalOrders += 1;

      // Amount in currency units (divide paise by 100)
      const amountInUnits = (ord.totalAmount || 0) / 100;
      entry.totalSpend += amountInUnits;

      // Latest order tracking
      if (!entry.lastOrderDate || ord.createdAt > entry.lastOrderDate) {
        entry.lastOrderDate = ord.createdAt;
        entry.lastOrderDisplay = formatStoreDateTime(ord.createdAt, activeOrg?.country, storeTimezone);
        entry.lastOrderNumber = ord.orderNumber || (ord._id ? `#${ord._id.slice(-4).toUpperCase()}` : "—");
      }

      // Track order source frequency
      if (!sourceCountsMap.has(key)) {
        sourceCountsMap.set(key, {});
      }
      const counts = sourceCountsMap.get(key)!;
      const type = ord.orderType || "Dine In";
      counts[type] = (counts[type] || 0) + 1;
    }

    // C. Finalize metrics calculation
    const result: CustomerRowData[] = [];

    for (const [key, entry] of customerMap.entries()) {
      const counts = sourceCountsMap.get(key);
      if (counts) {
        let maxCount = 0;
        let topSource = "Dine In";
        for (const [src, cnt] of Object.entries(counts)) {
          if (cnt > maxCount) {
            maxCount = cnt;
            topSource = src;
          }
        }
        entry.averageOrderSource = topSource;
      }

      entry.averageOrderValue =
        entry.totalOrders > 0 ? entry.totalSpend / entry.totalOrders : 0;

      entry.retentionPercent =
        entry.totalOrders > 1
          ? Math.min(100, Number(((entry.totalOrders / 12) * 100).toFixed(2)))
          : 0;

      result.push(entry);
    }

    return result;
  }, [searchResults, ordersResponse]);

  // REAL AGGREGATED METRICS CALCULATIONS
  const realMetrics = useMemo(() => {
    const totalCustCount = aggregatedCustomers.length;
    if (totalCustCount === 0) {
      return {
        totalCustomers: 0,
        averageSpendDisplay: `${currencySymbol}0.00`,
        repeatCustomerRateDisplay: "0.0%",
      };
    }

    const totalGrossSpend = aggregatedCustomers.reduce(
      (acc, c) => acc + c.totalSpend,
      0
    );
    const avgSpendVal = totalGrossSpend / totalCustCount;
    const repeatCustCount = aggregatedCustomers.filter(
      (c) => c.totalOrders > 1
    ).length;
    const repeatRateVal = (repeatCustCount / totalCustCount) * 100;

    return {
      totalCustomers: totalCustCount,
      averageSpendDisplay: `${currencySymbol}${formatCurrencyAmount(avgSpendVal, activeOrg?.country)}`,
      repeatCustomerRateDisplay: `${repeatRateVal.toFixed(1)}%`,
    };
  }, [aggregatedCustomers, currencySymbol, activeOrg]);

  // Filter & Search matching
  const filteredCustomers = useMemo(() => {
    let list = [...aggregatedCustomers];

    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      list = list.filter((c) => {
        const nameMatch = c.name.toLowerCase().includes(term);
        const phoneMatch = c.phone.includes(term);
        const emailMatch = c.email.toLowerCase().includes(term);
        return nameMatch || phoneMatch || emailMatch;
      });
    }

    if (appliedPreset !== "All Time") {
      const startMs = getStartOfDay(appliedStartDate).getTime();
      const endMs = getEndOfDay(appliedEndDate).getTime();
      list = list.filter(
        (c) => c.lastOrderDate && c.lastOrderDate >= startMs && c.lastOrderDate <= endMs
      );
    }

    // Sorting Logic
    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === "name") {
        valA = (a.name || "").toLowerCase();
        valB = (b.name || "").toLowerCase();
      } else if (sortField === "lastOrderDate") {
        valA = a.lastOrderDate || 0;
        valB = b.lastOrderDate || 0;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [aggregatedCustomers, debouncedSearch, appliedPreset, appliedStartDate, appliedEndDate, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, currentPage, pageSize]);

  const handleSortToggle = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getInitials = (str: string) => {
    if (!str) return "GC";
    const clean = str.replace(/[^a-zA-Z\s]/g, "").trim();
    if (!clean) return "GC";
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  const isLoading = searchResults === undefined && ordersResponse === undefined;

  return (
    <PosShell title="Customers" subtitle="Customer Relationship Management">
      <div className="flex-1 overflow-y-auto bg-[#fff8f5] p-6 lg:p-8">
        <div className="w-full flex flex-col gap-6">
          {/* Editorial Header */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
              <div className="flex flex-col gap-1 w-full xl:max-w-2xl">

                <h1 className="font-serif text-3xl lg:text-4xl text-stone-900 leading-tight">
                  Customers
                </h1>
                <p className="text-sm text-stone-600 leading-relaxed">
                  Search guests, view past orders, spend metrics, and dining history across all order channels.
                </p>
              </div>

              {/* Controls Header Bar */}
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                {/* Search Bar */}
                <div className="relative w-full sm:w-80">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search by customer name or phone..."
                    className="w-full bg-white text-stone-900 text-xs pl-10 pr-9 py-2.5 rounded-full border border-stone-200 shadow-xs focus:outline-none focus:border-stone-900 placeholder:text-stone-400 font-sans"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Date Range Selector Dropdown */}
                <div className="relative" ref={dateDropdownRef}>
                  <button
                    type="button"
                    onClick={() => {
                      if (isDateDropdownOpen) {
                        setIsDateDropdownOpen(false);
                      } else {
                        handleOpenDateDropdown();
                      }
                    }}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-stone-200 rounded-full text-xs font-medium text-stone-900 hover:bg-[#fdf8f7] transition-colors focus:ring-1 focus:ring-stone-900 cursor-pointer shadow-2xs"
                  >
                    <CalendarIcon className="w-4 h-4 text-stone-500" />
                    <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mr-0.5">
                      Filter:
                    </span>
                    <span className="font-medium text-xs text-stone-900">
                      {formattedDateRangeText}
                    </span>
                    <ChevronDownIcon
                      className={`w-3.5 h-3.5 text-stone-500 ml-1 transition-transform duration-150 ${
                        isDateDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isDateDropdownOpen && (
                    <div
                      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:static"
                      onClick={(e) => {
                        if (e.target === e.currentTarget) {
                          setIsDateDropdownOpen(false);
                        }
                      }}
                    >
                      <div
                        className="relative bg-white border border-[#d1d5db] rounded-2xl sm:rounded-lg shadow-2xl z-50 font-sans w-full max-w-[340px] sm:max-w-none sm:w-auto sm:absolute sm:right-0 sm:top-full sm:mt-2.5 overflow-hidden sm:overflow-visible"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Top pointer notch arrow on desktop only */}
                        <div className="hidden sm:block absolute right-8 -top-1.5 w-3 h-3 bg-white border-t border-l border-[#d1d5db] rotate-45 z-10" />

                        {/* Mobile Modal Title Bar */}
                        <div className="sm:hidden flex items-center justify-between px-4 py-3 border-b border-[#e5e7eb] bg-stone-50">
                          <span className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                            Select Date Range
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsDateDropdownOpen(false)}
                            className="w-6 h-6 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-200 text-xs cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Main section: Presets list + Dual calendar */}
                        <div className="flex flex-col sm:flex-row">
                          {/* Mobile Presets: horizontal scrollable pills */}
                          <div className="sm:hidden flex items-center gap-1.5 p-2.5 overflow-x-auto border-b border-[#e5e7eb] bg-[#faf8f5]">
                            {DATE_RANGE_OPTIONS.map((preset) => {
                              const isSelected = draftPreset === preset;
                              return (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => handlePresetClick(preset)}
                                  className={`px-3 py-1.5 rounded-full text-xs shrink-0 whitespace-nowrap transition-colors cursor-pointer ${
                                    isSelected
                                      ? "bg-[#0085d4] text-white font-medium"
                                      : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50 font-normal"
                                  }`}
                                >
                                  {preset}
                                </button>
                              );
                            })}
                          </div>

                          {/* Desktop Presets: Left Sidebar */}
                          <div className="hidden sm:flex w-36 border-r border-[#e5e7eb] py-2 flex-col bg-white shrink-0">
                            {DATE_RANGE_OPTIONS.map((preset) => {
                              const isSelected = draftPreset === preset;
                              return (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => handlePresetClick(preset)}
                                  className={`w-full text-left px-4 py-2 text-xs transition-colors cursor-pointer ${
                                    isSelected
                                      ? "bg-[#0085d4] text-white font-medium"
                                      : "text-stone-800 hover:bg-stone-100 font-normal"
                                  }`}
                                >
                                  {preset}
                                </button>
                              );
                            })}
                          </div>

                          {/* Mobile: 1 centered month calendar with both < and > navigation */}
                          <div className="p-3 sm:hidden flex justify-center bg-white">
                            {renderMonthCalendar(
                              viewMonth.getFullYear(),
                              viewMonth.getMonth(),
                              true,
                              true,
                            )}
                          </div>

                          {/* Desktop (sm and up): Dual side-by-side months */}
                          <div className="hidden sm:flex p-4 flex-row gap-6 bg-white">
                            {renderMonthCalendar(
                              viewMonth.getFullYear(),
                              viewMonth.getMonth(),
                              true,
                              false,
                            )}
                            {renderMonthCalendar(
                              new Date(
                                viewMonth.getFullYear(),
                                viewMonth.getMonth() + 1,
                                1,
                              ).getFullYear(),
                              new Date(
                                viewMonth.getFullYear(),
                                viewMonth.getMonth() + 1,
                                1,
                              ).getMonth(),
                              false,
                              true,
                            )}
                          </div>
                        </div>

                        {/* Bottom Footer Bar */}
                        <div className="border-t border-[#e5e7eb] px-4 py-2.5 bg-white flex items-center justify-between gap-2">
                          <div className="text-xs font-medium text-stone-700 truncate">
                            {draftPreset === "All Time"
                              ? "All Time"
                              : `${formatStoreDate(draftStartDate, activeOrg?.country, storeTimezone)} - ${formatStoreDate(draftEndDate, activeOrg?.country, storeTimezone)}`}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={handleCancelDate}
                              className="px-3 sm:px-4 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleApplyDate}
                              className="px-4 sm:px-5 py-1.5 text-xs font-semibold text-white bg-[#0c0a09] hover:bg-[#262626] rounded-md transition-colors cursor-pointer"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* REAL METRICS RIBBON */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Total Customers
                  </span>
                  <span className="text-stone-400">👥</span>
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="font-serif text-2xl font-medium text-stone-900">
                    {realMetrics.totalCustomers}
                  </span>
                  <span className="text-[11px] text-stone-500 font-normal">
                    registered guests
                  </span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Average Spend
                  </span>
                  <span className="text-stone-400">💳</span>
                </div>
                <div className="mt-2">
                  <span className="font-serif text-2xl font-medium text-stone-900">
                    {realMetrics.averageSpendDisplay}
                  </span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Repeat Customer Rate
                  </span>
                  <span className="text-stone-400">🔄</span>
                </div>
                <div className="mt-2">
                  <span className="font-serif text-2xl font-medium text-stone-900">
                    {realMetrics.repeatCustomerRateDisplay}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Directory Table Card */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#faf2ee] text-stone-600 text-[11px] font-semibold uppercase tracking-wider border-b border-stone-200 select-none">
                    <th
                      className="py-3 px-5 font-semibold cursor-pointer hover:text-stone-900"
                      onClick={() => handleSortToggle("name")}
                    >
                      <div className="flex items-center gap-1">
                        <span>Number / Name</span>
                        {sortField === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                      </div>
                    </th>
                    <th
                      className="py-3 px-5 font-semibold cursor-pointer hover:text-stone-900"
                      onClick={() => handleSortToggle("totalOrders")}
                    >
                      <div className="flex items-center gap-1">
                        <span>Total Orders</span>
                        {sortField === "totalOrders" && (sortOrder === "asc" ? "↑" : "↓")}
                      </div>
                    </th>
                    <th
                      className="py-3 px-5 font-semibold cursor-pointer hover:text-stone-900"
                      onClick={() => handleSortToggle("lastOrderDate")}
                    >
                      <div className="flex items-center gap-1">
                        <span>Last Order</span>
                        {sortField === "lastOrderDate" && (sortOrder === "asc" ? "↑" : "↓")}
                      </div>
                    </th>
                    <th
                      className="py-3 px-5 font-semibold cursor-pointer hover:text-stone-900"
                      onClick={() => handleSortToggle("totalSpend")}
                    >
                      <div className="flex items-center gap-1">
                        <span>Total Spend</span>
                        {sortField === "totalSpend" && (sortOrder === "asc" ? "↑" : "↓")}
                      </div>
                    </th>
                    <th
                      className="py-3 px-5 font-semibold cursor-pointer hover:text-stone-900"
                      onClick={() => handleSortToggle("retentionPercent")}
                    >
                      <div className="flex items-center gap-1">
                        <span>Retention</span>
                        {sortField === "retentionPercent" && (sortOrder === "asc" ? "↑" : "↓")}
                      </div>
                    </th>
                    <th className="py-3 px-5 font-semibold">Average Order Source</th>
                    <th
                      className="py-3 px-5 font-semibold cursor-pointer hover:text-stone-900"
                      onClick={() => handleSortToggle("averageOrderValue")}
                    >
                      <div className="flex items-center gap-1">
                        <span>Average Order Value</span>
                        {sortField === "averageOrderValue" && (sortOrder === "asc" ? "↑" : "↓")}
                      </div>
                    </th>
                    <th className="py-3 px-5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs text-stone-800">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-stone-400 text-xs">
                        Loading customer database...
                      </td>
                    </tr>
                  ) : paginatedCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-3 text-xl">
                            👤
                          </div>
                          <h2 className="font-serif text-lg text-stone-900 mb-1">
                            No customers found
                          </h2>
                          <p className="text-xs text-stone-500 max-w-sm mb-4">
                            We couldn't find any guests matching “
                            <span className="font-medium text-stone-800">
                              {searchQuery}
                            </span>
                            ”. Check spelling or try a phone search.
                          </p>
                          {searchQuery && (
                            <button
                              type="button"
                              onClick={() => setSearchQuery("")}
                              className="px-4 py-2 rounded-full bg-stone-100 text-stone-700 font-semibold text-xs hover:bg-stone-200 transition-colors cursor-pointer"
                            >
                              Clear Search Filter
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedCustomers.map((cust) => {
                      const initials = getInitials(cust.name);
                      const formattedPhone = cust.phone
                        ? formatPhoneNumberWithCountryCode(cust.phone, cust.countryCode || storePhoneCode)
                        : "—";

                      const cleanPhone = cust.phone ? cust.phone.replace(/\D/g, "") : "";
                      const targetId = cust.convexId || (cleanPhone ? `phone_${cleanPhone}` : cust.id);

                      return (
                        <tr
                          key={cust.id}
                          onClick={() => {
                            if (targetId) {
                              router.push(`/customers/${encodeURIComponent(targetId)}`);
                            }
                          }}
                          className="hover:bg-[#faf2ee]/50 transition-colors cursor-pointer group"
                        >
                          {/* Number / Name */}
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-stone-100 text-stone-800 font-semibold text-xs flex items-center justify-center shrink-0 border border-stone-200">
                                {initials}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-medium text-sm text-stone-900 group-hover:text-black">
                                  {cust.name}
                                </span>
                                <span className="text-xs text-stone-500 tracking-tight">
                                  {formattedPhone}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Total Orders */}
                          <td className="py-4 px-5 text-sm font-medium text-stone-900">
                            {cust.totalOrders > 0 ? `#${cust.totalOrders}` : "—"}
                          </td>

                          {/* Last Order */}
                          <td className="py-4 px-5">
                            {cust.lastOrderDisplay !== "—" ? (
                              <div className="flex flex-col">
                                <span className="text-xs text-stone-900 font-medium">
                                  {cust.lastOrderDisplay}
                                </span>
                                <span className="text-[10px] text-stone-500 font-medium">
                                  {cust.lastOrderNumber}
                                </span>
                              </div>
                            ) : (
                              <span className="text-stone-400">—</span>
                            )}
                          </td>

                          {/* Total Spend */}
                          <td className="py-4 px-5 text-sm font-semibold text-stone-900">
                            {cust.totalSpend > 0
                              ? `${currencySymbol}${formatCurrencyAmount(cust.totalSpend, activeOrg?.country)}`
                              : "—"}
                          </td>

                          {/* Retention */}
                          <td className="py-4 px-5">
                            {cust.retentionPercent > 0 ? (
                              <span className="px-2.5 py-1 rounded-full bg-stone-100 text-stone-800 text-[11px] font-medium border border-stone-200">
                                {cust.retentionPercent}%
                              </span>
                            ) : (
                              <span className="text-stone-400">—</span>
                            )}
                          </td>

                          {/* Average Order Source */}
                          <td className="py-4 px-5">
                            {cust.totalOrders > 0 ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 text-stone-700 text-xs font-medium border border-stone-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-stone-900"></span>
                                {cust.averageOrderSource}
                              </span>
                            ) : (
                              <span className="text-stone-400">—</span>
                            )}
                          </td>

                          {/* Average Order Value */}
                          <td className="py-4 px-5 text-sm font-medium text-stone-700">
                            {cust.averageOrderValue > 0
                              ? `${currencySymbol}${formatCurrencyAmount(cust.averageOrderValue, activeOrg?.country)}`
                              : "—"}
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (targetId) {
                                    router.push(`/customers/${encodeURIComponent(targetId)}`);
                                  }
                                }}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-stone-900 hover:underline cursor-pointer"
                              >
                                <span>View Profile</span>
                                <span>→</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {!isLoading && filteredCustomers.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-[#faf2ee]/40 border-t border-stone-200 text-xs text-stone-600">
                <span>
                  Showing{" "}
                  <span className="font-semibold text-stone-900">
                    {(currentPage - 1) * pageSize + 1}–
                    {Math.min(currentPage * pageSize, filteredCustomers.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-stone-900">
                    {filteredCustomers.length}
                  </span>{" "}
                  customers
                </span>

                <div className="flex items-center gap-1 text-xs font-medium">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-full bg-white text-stone-600 hover:text-stone-900 border border-stone-200 disabled:opacity-40 cursor-pointer"
                  >
                    Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      className={`w-7 h-7 rounded-full font-semibold flex items-center justify-center cursor-pointer ${
                        currentPage === p
                          ? "bg-stone-900 text-white"
                          : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
                      }`}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 rounded-full bg-white text-stone-600 hover:text-stone-900 border border-stone-200 disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit & Delete Action Modals if editing customer record */}
      <EditCustomerModal
        isOpen={!!editingCustomer}
        customer={editingCustomer}
        onClose={() => setEditingCustomer(null)}
      />

      <DeleteCustomerModal
        isOpen={!!deletingCustomer}
        customer={deletingCustomer}
        onClose={() => setDeletingCustomer(null)}
      />
    </PosShell>
  );
}
