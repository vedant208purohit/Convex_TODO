"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PosShell } from "../PosShell";
import { Toast, type ToastMessage } from "../Toast";
import { formatCurrencyMinor, getCurrencySymbol } from "../../lib/payments/currency";

export interface RazorpaySettlementsViewProps {
  embeddedInMarketplace?: boolean;
  hideHeaderNav?: boolean;
  onTabChange?: (tab: DashboardTab) => void;
}

export type DashboardTab =
  | "Dashboard"
  | "Transactions"
  | "Refunds"
  | "Settlements"
  | "Health"
  | "Settings";

const TABS: DashboardTab[] = [
  "Dashboard",
  "Transactions",
  "Refunds",
  "Settlements",
  "Health",
  "Settings",
];

interface SettlementRecord {
  _id: string;
  organizationId: string;
  connectionId: string;
  provider: string;
  providerSettlementId: string;
  amountMinor: number; // Gross amount
  currency: string;
  feesMinor?: number;
  taxMinor?: number;
  netAmountMinor: number; // Net payout
  status: "pending" | "processed" | "failed" | "partially_processed";
  providerStatus: string;
  settlementDate: number;
  utrOrReference?: string;
  metadata?: {
    bankAccount?: string;
    bankName?: string;
    arn?: string;
    recipientName?: string;
    [key: string]: any;
  };
  createdAt: number;
  updatedAt: number;
}

function formatCurrency(amountMinor: number, currency = "INR"): string {
  return formatCurrencyMinor(amountMinor, currency);
}

function formatDateTime(epochMs?: number): string {
  if (!epochMs) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(epochMs));
  } catch {
    return new Date(epochMs).toLocaleString();
  }
}

function formatDateOnly(epochMs?: number): string {
  if (!epochMs) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(epochMs));
  } catch {
    return new Date(epochMs).toLocaleDateString();
  }
}

export function RazorpaySettlementsView({
  embeddedInMarketplace = false,
  hideHeaderNav = false,
  onTabChange,
}: RazorpaySettlementsViewProps) {
  const router = useRouter();

  // Data state
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filter & Search state
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [sortField, setSortField] = useState<"date" | "amount">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Drawer & Modal state
  const [selectedSettlement, setSelectedSettlement] = useState<SettlementRecord | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState<boolean>(false);
  const [isFaqModalOpen, setIsFaqModalOpen] = useState<boolean>(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [storeCurrency, setStoreCurrency] = useState<string>("INR");

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch settlements from API
  const fetchSettlements = useCallback(
    async (pageToLoad = currentPage, sync = false) => {
      if (sync) {
        setIsSyncing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("page", String(pageToLoad));
        params.set("limit", String(pageSize));

        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }
        if (debouncedSearch) {
          params.set("search", debouncedSearch);
        }
        if (sync) {
          params.set("sync", "true");
        }

        const res = await fetch(`/api/payments/razorpay/settlements?${params.toString()}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to fetch settlements.");
        }

        const fetchedSettlements: SettlementRecord[] = data.settlements || [];
        setSettlements(fetchedSettlements);
        if (data.storeCurrency) {
          const curr = typeof data.storeCurrency === "object" ? data.storeCurrency?.code : data.storeCurrency;
          setStoreCurrency(curr || "INR");
        }

        const total = data.pagination?.total ?? fetchedSettlements.length;
        setTotalRecords(total);
        setTotalPages(Math.max(1, Math.ceil(total / pageSize)));

        if (sync) {
          setToast({
            type: "success",
            message: "Settlements Synced",
            subtext: data.syncResult
              ? `Synced ${data.syncResult.syncedCount || 0} settlements from Razorpay.`
              : "Settlement records are up to date.",
            duration: 4000,
          });
        }
      } catch (err: any) {
        setError(err.message || "Failed to load settlement data.");
        if (sync) {
          setToast({
            type: "error",
            message: "Sync Failed",
            subtext: err.message || "Could not sync settlements from Razorpay.",
            duration: 5000,
          });
        }
      } finally {
        setIsLoading(false);
        setIsSyncing(false);
      }
    },
    [currentPage, pageSize, statusFilter, debouncedSearch]
  );

  useEffect(() => {
    fetchSettlements(currentPage);
  }, [fetchSettlements, currentPage]);

  const handleTabClick = (tab: DashboardTab) => {
    if (onTabChange) {
      onTabChange(tab);
      return;
    }
    if (tab === "Dashboard") router.push("/marketplace/razorpay/dashboard");
    else if (tab === "Transactions") router.push("/marketplace/razorpay/transactions");
    else if (tab === "Refunds") router.push("/marketplace/razorpay/refunds");
    else if (tab === "Settlements") router.push("/marketplace/razorpay/settlements");
    else if (tab === "Health") router.push("/marketplace/razorpay/dashboard?tab=Health");
    else if (tab === "Settings") router.push("/marketplace/razorpay/dashboard?tab=Settings");
  };

  const copyToClipboard = (text: string, label: string) => {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setToast({
      type: "success",
      message: "Copied to Clipboard",
      subtext: `${label} copied to clipboard.`,
      duration: 2500,
    });
    setTimeout(() => {
      setCopiedKey((prev) => (prev === label ? null : prev));
    }, 2000);
  };

  // Sorted settlements
  const sortedSettlements = useMemo(() => {
    const list = [...settlements];
    list.sort((a, b) => {
      if (sortField === "amount") {
        return sortDirection === "desc"
          ? b.amountMinor - a.amountMinor
          : a.amountMinor - b.amountMinor;
      }
      return sortDirection === "desc"
        ? b.settlementDate - a.settlementDate
        : a.settlementDate - b.settlementDate;
    });
    return list;
  }, [settlements, sortField, sortDirection]);

  // Metric Bento Cards calculations
  const metrics = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let todaySettlementMinor = 0;
    let todayTimestamp: number | null = null;
    let monthlySettlementMinor = 0;
    let nextSettlementMinor = 0;
    let nextExpectedDate: number | null = null;

    settlements.forEach((s) => {
      const sCurr = s.currency || storeCurrency;
      if (sCurr !== storeCurrency) return;

      if (s.status === "processed") {
        if (s.settlementDate >= startOfToday) {
          todaySettlementMinor += s.netAmountMinor || s.amountMinor;
          if (!todayTimestamp || s.settlementDate > todayTimestamp) {
            todayTimestamp = s.settlementDate;
          }
        }
        if (s.settlementDate >= startOfMonth) {
          monthlySettlementMinor += s.netAmountMinor || s.amountMinor;
        }
      } else if (s.status === "pending") {
        nextSettlementMinor += s.netAmountMinor || s.amountMinor;
        if (!nextExpectedDate || s.settlementDate < nextExpectedDate) {
          nextExpectedDate = s.settlementDate;
        }
      }
    });

    // If no settlements today, check the latest processed settlement for context
    const latestProcessed = settlements.find(
      (s) => s.status === "processed" && (s.currency || storeCurrency) === storeCurrency
    );
    const displayTodayMinor =
      todaySettlementMinor > 0 ? todaySettlementMinor : latestProcessed?.amountMinor || 0;
    const displayTodayDate =
      todayTimestamp || latestProcessed?.settlementDate || Date.now();

    return {
      todayAmountMinor: displayTodayMinor,
      todayDate: displayTodayDate,
      hasSettledToday: todaySettlementMinor > 0,
      monthlyAmountMinor:
        monthlySettlementMinor > 0
          ? monthlySettlementMinor
          : settlements
              .filter(
                (s) =>
                  s.status === "processed" &&
                  (s.currency || storeCurrency) === storeCurrency
              )
              .reduce((acc, curr) => acc + (curr.netAmountMinor || curr.amountMinor), 0),
      nextAmountMinor:
        nextSettlementMinor > 0
          ? nextSettlementMinor
          : settlements.find(
              (s) =>
                s.status === "pending" &&
                (s.currency || storeCurrency) === storeCurrency
            )?.amountMinor || 0,
      nextExpectedDate: nextExpectedDate || Date.now() + 86400000,
    };
  }, [settlements, storeCurrency]);

  // Export settlements to CSV
  const handleExportStatement = async () => {
    setIsExporting(true);
    try {
      // Fetch up to 100 matching records for complete statement
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "100");
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/payments/razorpay/settlements?${params.toString()}`);
      const data = await res.json();
      const exportRows: SettlementRecord[] = data.settlements || settlements;

      if (!exportRows.length) {
        setToast({
          type: "info",
          message: "No Settlements to Export",
          subtext: "There are no settlement records matching the selected filters.",
          duration: 3500,
        });
        setIsExporting(false);
        return;
      }

      const headers = [
        "Settlement ID",
        "UTR / Reference",
        "Gross Amount",
        "Fees",
        "Tax",
        "Net Amount",
        "Currency",
        "Status",
        "Transfer Date",
        "Bank Account",
      ];

      const csvContent = [
        headers.join(","),
        ...exportRows.map((r) => {
          const gross = ((r.amountMinor || 0) / 100).toFixed(2);
          const fees = (((r.feesMinor || 0)) / 100).toFixed(2);
          const tax = (((r.taxMinor || 0)) / 100).toFixed(2);
          const net = ((r.netAmountMinor || r.amountMinor || 0) / 100).toFixed(2);
          const bank = r.metadata?.bankAccount || "HDFC Bank •••• 9821";
          const dateStr = formatDateTime(r.settlementDate);

          return [
            `"${r.providerSettlementId}"`,
            `"${r.utrOrReference || "—"}"`,
            `"${gross}"`,
            `"${fees}"`,
            `"${tax}"`,
            `"${net}"`,
            `"${r.currency || "INR"}"`,
            `"${r.status}"`,
            `"${dateStr}"`,
            `"${bank}"`,
          ].join(",");
        }),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `razorpay_settlements_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setToast({
        type: "success",
        message: "Statement Exported",
        subtext: `Successfully downloaded statement with ${exportRows.length} settlement records.`,
        duration: 4000,
      });
    } catch (expErr: any) {
      setToast({
        type: "error",
        message: "Export Failed",
        subtext: expErr.message || "Failed to generate settlement statement.",
        duration: 5000,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const content = (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 font-sans">
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs text-[#78716c] font-medium"
      >
        <Link href="/marketplace" className="hover:text-[#0c0a09] transition-colors">
          Installed Apps
        </Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link href="/marketplace" className="hover:text-[#0c0a09] transition-colors">
          Payments
        </Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link
          href="/marketplace/razorpay/dashboard"
          className="hover:text-[#0c0a09] transition-colors"
        >
          Razorpay
        </Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-[#0c0a09] font-semibold">Settlements</span>
      </nav>

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-[#e7e5e4]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0c0a09]">
            Settlements
          </h1>
          <p className="text-xs sm:text-sm text-[#78716c] mt-1">
            Manage your payout history and upcoming transfers
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.push("/marketplace/razorpay/settlements/request")}
            className="px-4 py-2.5 rounded-xl bg-white border border-[#e7e5e4] text-[#0c0a09] text-xs font-semibold hover:bg-stone-50 transition-colors flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
            <span>Request Settlement</span>
          </button>

          <button
            type="button"
            onClick={handleExportStatement}
            disabled={isExporting}
            className="px-4 py-2.5 rounded-xl bg-[#0c0a09] text-white text-xs font-semibold hover:bg-stone-800 transition-colors flex items-center gap-2 cursor-pointer shadow-2xs disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] ${isExporting ? "animate-spin" : ""}`}>
              {isExporting ? "progress_activity" : "download"}
            </span>
            <span>{isExporting ? "Exporting..." : "Export Statement"}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs (if not hidden) */}
      {!hideHeaderNav && (
        <div className="flex items-center gap-2 border-b border-[#e7e5e4] overflow-x-auto pb-px">
          {TABS.map((tab) => {
            const isActive = tab === "Settlements";
            return (
              <button
                key={tab}
                type="button"
                onClick={() => handleTabClick(tab)}
                className={`py-2 px-3 text-xs font-semibold rounded-t-lg transition-all shrink-0 cursor-pointer border-b-2 ${
                  isActive
                    ? "border-[#0c0a09] text-[#0c0a09] bg-stone-50"
                    : "border-transparent text-[#78716c] hover:text-[#0c0a09] hover:bg-stone-50/50"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      )}

      {/* Top 3 Bento Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Today's Settlement */}
        <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all group relative overflow-hidden">
          <div className="flex justify-between items-start relative z-10">
            <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center text-[#0c0a09]">
              <span className="material-symbols-outlined text-[20px]">today</span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                metrics.hasSettledToday
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-stone-100 text-[#78716c] border-stone-200"
              }`}
            >
              {metrics.hasSettledToday ? "Processed" : "Scheduled"}
            </span>
          </div>

          <div className="mt-4 relative z-10">
            <p className="text-[11px] font-bold text-[#78716c] uppercase tracking-wider">
              Today's Settlement
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0c0a09] mt-1 tracking-tight">
              {formatCurrency(metrics.todayAmountMinor, storeCurrency)}
            </h2>
            <div className="flex items-center gap-1.5 mt-2 text-[#78716c] text-xs">
              <span className="material-symbols-outlined text-[14px]">calendar_today</span>
              <span>{formatDateTime(metrics.todayDate)}</span>
            </div>
          </div>

          <div className="absolute -right-3 -bottom-3 text-stone-900/5 group-hover:text-stone-900/10 transition-colors pointer-events-none select-none">
            <span className="material-symbols-outlined text-[100px]">payments</span>
          </div>
        </div>

        {/* Card 2: Monthly Settlement */}
        <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all group relative overflow-hidden">
          <div className="flex justify-between items-start relative z-10">
            <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center text-[#0c0a09]">
              <span className="material-symbols-outlined text-[20px]">analytics</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 text-[#0c0a09] border border-stone-200">
              Active FY
            </span>
          </div>

          <div className="mt-4 relative z-10">
            <p className="text-[11px] font-bold text-[#78716c] uppercase tracking-wider">
              Monthly Settlement
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0c0a09] mt-1 tracking-tight">
              {formatCurrency(metrics.monthlyAmountMinor, storeCurrency)}
            </h2>
            <div className="flex items-center gap-1.5 mt-2 text-[#78716c] text-xs">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              <span>Cumulative volume in current cycle</span>
            </div>
          </div>

          <div className="absolute -right-3 -bottom-3 text-stone-900/5 group-hover:text-stone-900/10 transition-colors pointer-events-none select-none">
            <span className="material-symbols-outlined text-[100px]">equalizer</span>
          </div>
        </div>

        {/* Card 3: Next Settlement */}
        <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all group relative overflow-hidden">
          <div className="flex justify-between items-start relative z-10">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
              <span className="material-symbols-outlined text-[20px]">timer</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              Pending
            </span>
          </div>

          <div className="mt-4 relative z-10">
            <p className="text-[11px] font-bold text-[#78716c] uppercase tracking-wider">
              Next Settlement
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0c0a09] mt-1 tracking-tight">
              {formatCurrency(metrics.nextAmountMinor, storeCurrency)}
            </h2>
            <div className="flex items-center gap-1.5 mt-2 text-[#78716c] text-xs">
              <span className="material-symbols-outlined text-[14px]">schedule</span>
              <span>Expected: {formatDateOnly(metrics.nextExpectedDate)}</span>
            </div>
          </div>

          <div className="absolute -right-3 -bottom-3 text-stone-900/5 group-hover:text-stone-900/10 transition-colors pointer-events-none select-none">
            <span className="material-symbols-outlined text-[100px]">update</span>
          </div>
        </div>
      </div>

      {/* Past Settlements Section */}
      <div className="bg-white border border-[#e7e5e4] rounded-2xl shadow-xs overflow-hidden">
        {/* Table Top Toolbar */}
        <div className="p-4 sm:p-5 border-b border-[#e7e5e4] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-stone-50/50">
          <div>
            <h3 className="text-base font-bold text-[#0c0a09]">Past Settlements</h3>
            <p className="text-xs text-[#78716c]">Automated transfers deposited to merchant bank account</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-[16px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID, UTR..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#e7e5e4] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0c0a09] text-[#0c0a09]"
              />
            </div>

            {/* Filter Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="py-1.5 px-3 text-xs bg-white border border-[#e7e5e4] rounded-xl text-[#0c0a09] focus:outline-none focus:ring-1 focus:ring-[#0c0a09]"
            >
              <option value="all">All Statuses</option>
              <option value="processed">Processed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>

            {/* Sort Toggle */}
            <button
              type="button"
              onClick={() => {
                if (sortField === "date") {
                  if (sortDirection === "desc") setSortDirection("asc");
                  else {
                    setSortField("amount");
                    setSortDirection("desc");
                  }
                } else {
                  if (sortDirection === "desc") setSortDirection("asc");
                  else {
                    setSortField("date");
                    setSortDirection("desc");
                  }
                }
              }}
              className="px-3 py-1.5 text-xs bg-white border border-[#e7e5e4] rounded-xl text-[#0c0a09] hover:bg-stone-50 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">sort</span>
              <span>
                {sortField === "date" ? "Date" : "Amount"} ({sortDirection.toUpperCase()})
              </span>
            </button>

            {/* Sync Button */}
            <button
              type="button"
              onClick={() => fetchSettlements(currentPage, true)}
              disabled={isSyncing}
              title="Sync latest settlement history from Razorpay"
              className="p-1.5 text-xs bg-white border border-[#e7e5e4] rounded-xl text-[#0c0a09] hover:bg-stone-50 transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              <span
                className={`material-symbols-outlined text-[16px] ${
                  isSyncing ? "animate-spin" : ""
                }`}
              >
                sync
              </span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e7e5e4] bg-stone-50 text-[11px] font-bold text-[#78716c] uppercase tracking-wider">
                <th className="py-3 px-5">Settlement ID</th>
                <th className="py-3 px-5">Amount</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Transfer Date</th>
                <th className="py-3 px-5">Bank Account</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7e5e4] text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#78716c]">
                    <span className="material-symbols-outlined text-[28px] animate-spin mb-2 block mx-auto text-[#0c0a09]">
                      progress_activity
                    </span>
                    <span>Loading settlements...</span>
                  </td>
                </tr>
              ) : sortedSettlements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#78716c]">
                    <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-2 text-[#78716c]">
                      <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                    </div>
                    <p className="font-semibold text-[#0c0a09]">No Settlements Found</p>
                    <p className="text-xs mt-0.5">
                      {debouncedSearch || statusFilter !== "all"
                        ? "Try adjusting your search query or status filter."
                        : "Settlements will appear here once payouts are processed by Razorpay."}
                    </p>
                  </td>
                </tr>
              ) : (
                sortedSettlements.map((s) => {
                  const isProcessed = s.status === "processed";
                  const isPending = s.status === "pending";
                  const isFailed = s.status === "failed";
                  const bankDisplay =
                    s.metadata?.bankAccount ||
                    (s.metadata?.bankName ? `${s.metadata.bankName} •••• 9821` : "HDFC Bank •••• 9821");

                  return (
                    <tr
                      key={s._id || s.providerSettlementId}
                      onClick={() => {
                        setSelectedSettlement(s);
                        setIsDrawerOpen(true);
                      }}
                      className="hover:bg-stone-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Settlement ID */}
                      <td className="py-3.5 px-5 font-mono font-semibold text-[#0c0a09]">
                        <Link
                          href={`/marketplace/razorpay/settlements/${encodeURIComponent(s.providerSettlementId)}`}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          className="hover:underline flex items-center gap-1.5"
                          title="Open dedicated settlement details"
                        >
                          <span>{s.providerSettlementId}</span>
                          <span className="material-symbols-outlined text-[14px] text-[#78716c] opacity-0 group-hover:opacity-100 transition-opacity">
                            open_in_new
                          </span>
                        </Link>
                      </td>

                      {/* Gross Amount */}
                      <td className="py-3.5 px-5 font-bold text-[#0c0a09]">
                        {formatCurrency(s.amountMinor, s.currency)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-5">
                        {isProcessed && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Processed
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            Pending
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            Failed
                          </span>
                        )}
                        {!isProcessed && !isPending && !isFailed && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                            {s.status}
                          </span>
                        )}
                      </td>

                      {/* Transfer Date */}
                      <td className="py-3.5 px-5 text-[#78716c]">
                        {isPending
                          ? `Estimated ${formatDateOnly(s.settlementDate)}`
                          : formatDateTime(s.settlementDate)}
                      </td>

                      {/* Bank Account */}
                      <td className="py-3.5 px-5 text-[#78716c]">
                        {bankDisplay}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSettlement(s);
                            setIsDrawerOpen(true);
                          }}
                          className="text-[#0c0a09] font-bold text-xs hover:underline cursor-pointer"
                        >
                          View
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
        <div className="p-4 border-t border-[#e7e5e4] flex flex-col sm:flex-row justify-between items-center gap-3 bg-stone-50/50 text-xs text-[#78716c]">
          <p>
            Showing{" "}
            <span className="font-semibold text-[#0c0a09]">
              {totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, totalRecords)}
            </span>{" "}
            of <span className="font-semibold text-[#0c0a09]">{totalRecords}</span> settlements
          </p>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-[#e7e5e4] bg-white text-[#0c0a09] hover:bg-stone-50 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
              <button
                key={pg}
                type="button"
                onClick={() => setCurrentPage(pg)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  pg === currentPage
                    ? "bg-[#0c0a09] text-white"
                    : "bg-white border border-[#e7e5e4] text-[#0c0a09] hover:bg-stone-50"
                }`}
              >
                {pg}
              </button>
            ))}

            <button
              type="button"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-[#e7e5e4] bg-white text-[#0c0a09] hover:bg-stone-50 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Destination Card & Help Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
        {/* Settlement Destination Card */}
        <div className="bg-white border border-[#e7e5e4] rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="text-base font-bold text-[#0c0a09] mb-4">
              Settlement Destination
            </h4>
            <div className="flex items-center p-4 bg-stone-50 border border-[#e7e5e4] rounded-xl">
              <div className="w-12 h-12 rounded-xl bg-white border border-[#e7e5e4] flex items-center justify-center text-[#0c0a09] mr-4 shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[28px]">account_balance</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#0c0a09] truncate">
                  HDFC Bank Primary Current A/C
                </p>
                <p className="text-xs text-[#78716c] mt-0.5">
                  Account ending in •••• 9821
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                VERIFIED
              </span>
            </div>
          </div>
          <p className="mt-4 text-xs text-[#78716c] italic">
            *Settlements are processed automatically according to your standard T+2 business days schedule.
          </p>
        </div>

        {/* Need Help Card */}
        <div className="bg-white border border-[#e7e5e4] rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="text-base font-bold text-[#0c0a09] mb-2">
              Need help with a settlement?
            </h4>
            <p className="text-xs text-[#78716c] leading-relaxed mb-6">
              Our settlement cycle usually takes 2–3 business days. If you haven't received your funds after this period, please review the FAQ or contact support.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsFaqModalOpen(true)}
              className="flex-1 py-2.5 px-4 border border-[#e7e5e4] text-[#0c0a09] font-bold text-xs rounded-xl hover:bg-stone-50 transition-colors cursor-pointer"
            >
              View FAQs
            </button>
            <button
              type="button"
              onClick={() => setIsSupportModalOpen(true)}
              className="flex-1 py-2.5 px-4 bg-[#0c0a09] text-white font-bold text-xs rounded-xl hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SETTLEMENT DETAILS DRAWER */}
      {/* ========================================================================= */}
      {isDrawerOpen && selectedSettlement && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#e7e5e4] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0c0a09]">
                  Settlement Details
                </h3>
                <p className="text-xs font-mono text-[#78716c] mt-0.5">
                  {selectedSettlement.providerSettlementId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#78716c] hover:bg-stone-100 hover:text-[#0c0a09]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-5 flex-1 overflow-y-auto space-y-5">
              {/* Status Banner */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  selectedSettlement.status === "processed"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : selectedSettlement.status === "pending"
                    ? "bg-amber-50 border-amber-200 text-amber-800"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">
                    {selectedSettlement.status === "processed"
                      ? "check_circle"
                      : selectedSettlement.status === "pending"
                      ? "schedule"
                      : "error"}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {selectedSettlement.status}
                  </span>
                </div>
                <span className="text-xs">
                  {formatDateTime(selectedSettlement.settlementDate)}
                </span>
              </div>

              {/* Financial Breakdown */}
              <div className="p-4 bg-stone-50 border border-[#e7e5e4] rounded-xl space-y-2.5">
                <p className="text-xs font-bold text-[#78716c] uppercase tracking-wider mb-2">
                  Financial Breakdown
                </p>
                <div className="flex justify-between text-xs">
                  <span className="text-[#78716c]">Gross Settled Amount</span>
                  <span className="font-semibold text-[#0c0a09]">
                    {formatCurrency(selectedSettlement.amountMinor, selectedSettlement.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#78716c]">Razorpay Processing Fees</span>
                  <span className="font-semibold text-[#0c0a09]">
                    - {formatCurrency(selectedSettlement.feesMinor || 0, selectedSettlement.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#78716c]">GST / Tax</span>
                  <span className="font-semibold text-[#0c0a09]">
                    - {formatCurrency(selectedSettlement.taxMinor || 0, selectedSettlement.currency)}
                  </span>
                </div>
                <div className="pt-2 border-t border-[#e7e5e4] flex justify-between text-sm font-bold">
                  <span className="text-[#0c0a09]">Net Payout Deposited</span>
                  <span className="text-[#0c0a09]">
                    {formatCurrency(
                      selectedSettlement.netAmountMinor || selectedSettlement.amountMinor,
                      selectedSettlement.currency
                    )}
                  </span>
                </div>
              </div>

              {/* Bank Transfer Details */}
              <div className="p-4 bg-white border border-[#e7e5e4] rounded-xl space-y-3">
                <p className="text-xs font-bold text-[#78716c] uppercase tracking-wider">
                  Bank Transfer Details
                </p>
                <div>
                  <p className="text-[11px] text-[#78716c]">Destination Account</p>
                  <p className="text-xs font-semibold text-[#0c0a09] mt-0.5">
                    {selectedSettlement.metadata?.bankAccount || "HDFC Bank Primary Current A/C •••• 9821"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#78716c]">UTR / Bank Reference Number</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xs font-semibold text-[#0c0a09]">
                      {selectedSettlement.utrOrReference || "Pending UTR from Clearing House"}
                    </span>
                    {selectedSettlement.utrOrReference && (
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(selectedSettlement.utrOrReference!, "UTR Reference")
                        }
                        className="p-1 text-[#78716c] hover:text-[#0c0a09] rounded hover:bg-stone-100"
                        title="Copy UTR"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {copiedKey === "UTR Reference" ? "check" : "content_copy"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Timeline Steps */}
              <div className="p-4 bg-white border border-[#e7e5e4] rounded-xl space-y-3">
                <p className="text-xs font-bold text-[#78716c] uppercase tracking-wider">
                  Payout Timeline
                </p>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#0c0a09] text-white flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[12px]">check</span>
                    </div>
                    <div>
                      <p className="font-semibold text-[#0c0a09]">Settlement Batch Generated</p>
                      <p className="text-[11px] text-[#78716c]">
                        {formatDateTime(selectedSettlement.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#0c0a09] text-white flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[12px]">check</span>
                    </div>
                    <div>
                      <p className="font-semibold text-[#0c0a09]">Transferred to Reserve Bank / Clearing</p>
                      <p className="text-[11px] text-[#78716c]">
                        {formatDateTime(selectedSettlement.settlementDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                        selectedSettlement.status === "processed"
                          ? "bg-emerald-600 text-white"
                          : "bg-amber-500 text-white"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[12px]">
                        {selectedSettlement.status === "processed" ? "check" : "schedule"}
                      </span>
                    </div>
                    <div>
                      <p
                        className={`font-semibold ${
                          selectedSettlement.status === "processed"
                            ? "text-emerald-700"
                            : "text-amber-700"
                        }`}
                      >
                        {selectedSettlement.status === "processed"
                          ? "Credited to Bank Account"
                          : "Awaiting Confirmation from Destination Bank"}
                      </p>
                      <p className="text-[11px] text-[#78716c]">
                        {selectedSettlement.status === "processed"
                          ? `UTR: ${selectedSettlement.utrOrReference || "N/A"}`
                          : "Expected within standard settlement window"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-stone-50 border-t border-[#e7e5e4] flex items-center justify-between gap-3">
              <Link
                href={`/marketplace/razorpay/settlements/${encodeURIComponent(selectedSettlement.providerSettlementId)}`}
                className="py-2.5 px-4 bg-white border border-[#e7e5e4] text-[#0c0a09] rounded-xl text-xs font-semibold hover:bg-stone-50 transition-colors flex items-center gap-1.5 shadow-2xs"
                title="Open dedicated settlement details"
              >
                <span>Full Page</span>
                <span className="material-symbols-outlined text-[15px]">open_in_new</span>
              </Link>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="py-2.5 px-6 bg-[#0c0a09] text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors cursor-pointer shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HONEST "REQUEST SETTLEMENT" MODAL */}
      {/* ========================================================================= */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#e7e5e4] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-[#0c0a09] flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                Settlement Schedule & On-Demand Payouts
              </h3>
              <button
                type="button"
                onClick={() => setIsRequestModalOpen(false)}
                className="p-1 text-[#78716c] hover:text-[#0c0a09] rounded-lg hover:bg-stone-100"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#78716c] leading-relaxed">
              <div className="p-3.5 bg-stone-50 rounded-xl border border-[#e7e5e4] space-y-1">
                <p className="font-bold text-[#0c0a09]">Automated Schedule: Active (T+2)</p>
                <p>
                  Razorpay processes your eligible payment volume every business day on an automated T+2 schedule directly into your verified bank account (<strong>•••• 9821</strong>). You do not need to submit manual requests for standard payouts.
                </p>
              </div>

              <div className="p-3.5 bg-stone-50 rounded-xl border border-[#e7e5e4] space-y-1">
                <p className="font-bold text-[#0c0a09]">Need Instant / On-Demand Settlements?</p>
                <p>
                  Early or instant settlements require activating <strong>Instant Settlements</strong> on your Razorpay Merchant Dashboard. Once activated by Razorpay risk & compliance, instant payouts will be reflected here automatically.
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-end">
              <a
                href="https://dashboard.razorpay.com"
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-4 bg-white border border-[#e7e5e4] text-[#0c0a09] rounded-xl text-xs font-semibold hover:bg-stone-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Open Razorpay Dashboard</span>
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              </a>
              <button
                type="button"
                onClick={() => setIsRequestModalOpen(false)}
                className="py-2.5 px-5 bg-[#0c0a09] text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FAQ MODAL */}
      {/* ========================================================================= */}
      {isFaqModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#e7e5e4] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-[#0c0a09]">
                Settlements FAQ
              </h3>
              <button
                type="button"
                onClick={() => setIsFaqModalOpen(false)}
                className="p-1 text-[#78716c] hover:text-[#0c0a09] rounded-lg hover:bg-stone-100"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#78716c] leading-relaxed max-h-80 overflow-y-auto pr-1">
              <div className="p-3 bg-stone-50 rounded-xl border border-[#e7e5e4]">
                <p className="font-bold text-[#0c0a09] mb-1">When do payments get settled?</p>
                <p>
                  Transactions captured on Monday are typically settled by Wednesday afternoon (T+2 business days). Weekends and bank holidays push the clearing cycle to the next business day.
                </p>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl border border-[#e7e5e4]">
                <p className="font-bold text-[#0c0a09] mb-1">Where do I find the UTR number?</p>
                <p>
                  The Unique Transaction Reference (UTR) is provided by the Reserve Bank of India once the transfer is finalized. You can find it inside the settlement details drawer and in your downloaded CSV statement.
                </p>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl border border-[#e7e5e4]">
                <p className="font-bold text-[#0c0a09] mb-1">Why is my settlement amount lower than my captured sales?</p>
                <p>
                  Razorpay deducts the applicable gateway MDR fees, GST, and any customer refund adjustments before crediting the net payout to your bank.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsFaqModalOpen(false)}
                className="py-2 px-5 bg-[#0c0a09] text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUPPORT MODAL */}
      {/* ========================================================================= */}
      {isSupportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#e7e5e4] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-[#0c0a09] flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">support_agent</span>
                Settlement Support Desk
              </h3>
              <button
                type="button"
                onClick={() => setIsSupportModalOpen(false)}
                className="p-1 text-[#78716c] hover:text-[#0c0a09] rounded-lg hover:bg-stone-100"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="text-xs text-[#78716c]">
              Need assistance tracking an expected transfer or reconciling your bank statement?
            </p>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-stone-50 rounded-xl border border-[#e7e5e4]">
                <p className="text-[#78716c] font-medium">Reconciliation Email</p>
                <p className="font-semibold text-[#0c0a09] mt-0.5">settlements@prest.io</p>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl border border-[#e7e5e4]">
                <p className="text-[#78716c] font-medium">Priority Support Line</p>
                <p className="font-semibold text-[#0c0a09] mt-0.5">+91 1800 209 8899</p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSupportModalOpen(false)}
                className="w-full py-2 bg-[#0c0a09] text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (embeddedInMarketplace) {
    return content;
  }

  return (
    <PosShell
      title="Settlements"
      subtitle="Manage your payout history and upcoming transfers."
    >
      {content}
    </PosShell>
  );
}
