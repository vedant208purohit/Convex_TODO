"use client";

import { useState, useMemo, useEffect } from "react";
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
  getCurrencyForCountry,
} from "../../lib/constants/countries";

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

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterLastOrder, setFilterLastOrder] = useState("all");

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

  // Query Active Organization for currency symbol
  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;

  const currencySymbol =
    activeOrg?.defaultCurrencySymbol ||
    (activeOrg?.country ? getCurrencyForCountry(activeOrg.country).symbol : "₹");

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

  // Unified Data Aggregation: Combine Convex `customers` + customer data extracted from `orders`
  const aggregatedCustomers = useMemo(() => {
    const customerMap = new Map<string, CustomerRowData>();

    // A. Populate from Convex `customers` table
    if (searchResults && Array.isArray(searchResults)) {
      for (const cust of searchResults) {
        const cleanPhone = (cust.phone || "").replace(/\D/g, "");
        const key = cust._id
          ? String(cust._id)
          : cleanPhone
          ? `phone_${cleanPhone}`
          : cust.email
          ? `email_${cust.email}`
          : `cust_${cust._id}`;

        const fullName = `${cust.firstName || ""} ${cust.lastName || ""}`.trim();
        const displayName = fullName || "Guest Customer";

        customerMap.set(key, {
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
        });
      }
    }

    // B. Aggregate metrics from real `orders` database
    const ordersList = ordersResponse?.orders || [];
    const sourceCountsMap = new Map<string, Record<string, number>>();

    for (const ord of ordersList) {
      const cleanPhone = (ord.customerPhone || "").replace(/\D/g, "");
      const orderCustId = ord.customerId ? String(ord.customerId) : null;
      const rawName = ord.customerName?.trim() || "";
      const orderCustName = rawName !== "Guest Customer" ? rawName : "";

      // Look for existing key in customerMap
      let key: string | null = null;
      if (orderCustId && customerMap.has(orderCustId)) {
        key = orderCustId;
      } else if (cleanPhone && customerMap.has(`phone_${cleanPhone}`)) {
        key = `phone_${cleanPhone}`;
      } else {
        // Match existing entry by phone, convexId, or name
        for (const [k, c] of customerMap.entries()) {
          if (orderCustId && c.convexId && String(c.convexId) === orderCustId) {
            key = k;
            break;
          }
          if (cleanPhone && c.phone && c.phone.replace(/\D/g, "") === cleanPhone) {
            key = k;
            break;
          }
          if (
            orderCustName &&
            c.name.toLowerCase() === orderCustName.toLowerCase()
          ) {
            key = k;
            break;
          }
        }
      }

      // Generate a stable key if no match found
      if (!key) {
        if (orderCustId) key = orderCustId;
        else if (cleanPhone) key = `phone_${cleanPhone}`;
        else if (orderCustName) key = `name_${orderCustName.toLowerCase().replace(/\s+/g, "_")}`;
        else key = `ordcust_${ord._id}`;
      }

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
        entry.lastOrderDisplay = formatStoreDateTime(ord.createdAt, activeOrg?.country, activeOrg?.timezone);
        entry.lastOrderNumber = `ORD-${(ord._id || "").slice(-4).toUpperCase()}`;
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

    if (filterLastOrder !== "all") {
      const now = Date.now();
      let limitMs = 0;
      if (filterLastOrder === "7d") limitMs = 7 * 24 * 60 * 60 * 1000;
      else if (filterLastOrder === "30d") limitMs = 30 * 24 * 60 * 60 * 1000;
      else if (filterLastOrder === "90d") limitMs = 90 * 24 * 60 * 60 * 1000;

      if (limitMs > 0) {
        list = list.filter(
          (c) => c.lastOrderDate && now - c.lastOrderDate <= limitMs
        );
      }
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
  }, [aggregatedCustomers, debouncedSearch, filterLastOrder, sortField, sortOrder]);

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
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          {/* Editorial Header */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="flex flex-col gap-1 max-w-2xl">
                <div className="flex items-center gap-2 text-[11px] font-mono font-semibold text-stone-500 uppercase tracking-widest">
                  <span>Patronage & Hospitality Records</span>
                  <span>•</span>
                  <span>Registry 2026</span>
                </div>
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

                {/* Filter Dropdown */}
                <div className="inline-flex items-center bg-white px-3.5 py-2 rounded-full border border-stone-200 shadow-xs text-stone-800 text-xs">
                  <span className="text-stone-400 mr-2">📅</span>
                  <span className="font-mono text-[10px] text-stone-500 uppercase tracking-wider mr-1">
                    Filter:
                  </span>
                  <select
                    value={filterLastOrder}
                    onChange={(e) => {
                      setFilterLastOrder(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-transparent text-stone-900 font-medium focus:outline-none cursor-pointer pr-1 text-xs"
                  >
                    <option value="all">All Time</option>
                    <option value="7d">Within Past 7 Days</option>
                    <option value="30d">This Month (30 Days)</option>
                    <option value="90d">Past 90 Days</option>
                  </select>
                </div>
              </div>
            </div>

            {/* REAL METRICS RIBBON */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
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
                  <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
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
                  <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
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
                  <tr className="bg-[#faf2ee] text-stone-600 font-mono text-[10px] uppercase tracking-wider border-b border-stone-200 select-none">
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
                      <td colSpan={8} className="py-12 text-center text-stone-400 font-mono">
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
                        ? formatPhoneNumberWithCountryCode(cust.phone, cust.countryCode || activeOrg?.phoneCode || "+91")
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
                                <span className="text-xs text-stone-500 font-mono tracking-tight">
                                  {formattedPhone}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Total Orders */}
                          <td className="py-4 px-5 font-mono font-medium text-stone-900">
                            {cust.totalOrders > 0 ? `#${cust.totalOrders}` : "—"}
                          </td>

                          {/* Last Order */}
                          <td className="py-4 px-5">
                            {cust.lastOrderDisplay !== "—" ? (
                              <div className="flex flex-col">
                                <span className="text-xs text-stone-900 font-medium">
                                  {cust.lastOrderDisplay}
                                </span>
                                <span className="font-mono text-[10px] text-stone-500">
                                  {cust.lastOrderNumber}
                                </span>
                              </div>
                            ) : (
                              <span className="text-stone-400 font-mono">—</span>
                            )}
                          </td>

                          {/* Total Spend */}
                          <td className="py-4 px-5 font-mono font-semibold text-stone-900">
                            {cust.totalSpend > 0
                              ? `${currencySymbol}${formatCurrencyAmount(cust.totalSpend, activeOrg?.country)}`
                              : "—"}
                          </td>

                          {/* Retention */}
                          <td className="py-4 px-5">
                            {cust.retentionPercent > 0 ? (
                              <span className="px-2.5 py-1 rounded-full bg-stone-100 text-stone-800 font-mono text-[11px] font-medium border border-stone-200">
                                {cust.retentionPercent}%
                              </span>
                            ) : (
                              <span className="text-stone-400 font-mono">—</span>
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
                              <span className="text-stone-400 font-mono">—</span>
                            )}
                          </td>

                          {/* Average Order Value */}
                          <td className="py-4 px-5 font-mono text-stone-700">
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

                <div className="flex items-center gap-1 font-mono text-xs">
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
