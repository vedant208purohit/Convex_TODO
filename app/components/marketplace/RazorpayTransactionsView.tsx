"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PosShell } from "../PosShell";
import { Toast, type ToastMessage } from "../Toast";
import { formatCurrencyMinor, getCurrencySymbol } from "../../lib/payments/currency";

export interface RazorpayTransactionsViewProps {
  embeddedInMarketplace?: boolean;
  hideHeaderNav?: boolean;
  onTabChange?: (tab: string) => void;
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

function formatCurrency(amountMinor: number, currency = "INR"): string {
  return formatCurrencyMinor(amountMinor, currency);
}

function formatDate(timestamp: number): string {
  if (!timestamp) return "-";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

export function RazorpayTransactionsView({
  embeddedInMarketplace = false,
  hideHeaderNav = false,
  onTabChange,
}: RazorpayTransactionsViewProps) {
  const router = useRouter();

  // Navigation tab state
  const activeTab: DashboardTab = "Transactions";

  // Toast notification state
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "info", detail?: string) => {
      setToast({ message, type, subtext: detail });
    },
    []
  );

  // Data & loading states
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnectionMissing, setIsConnectionMissing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Filter states
  const [dateRange, setDateRange] = useState<"30D" | "7D" | "24H" | "CUSTOM" | "ALL">("30D");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [methodFilter, setMethodFilter] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Summary Metrics State (from /api/payments/razorpay/dashboard and /api/payments/razorpay/transactions)
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [transactionKpis, setTransactionKpis] = useState<any | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [serverStoreCurrency, setServerStoreCurrency] = useState<string>("INR");

  // Details Drawer State
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Refund Modal State
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundTargetTx, setRefundTargetTx] = useState<any | null>(null);
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [refundAmountInput, setRefundAmountInput] = useState<string>("");
  const [refundReason, setRefundReason] = useState<string>("");
  const [refundSpeed, setRefundSpeed] = useState<"normal" | "optimum">("normal");
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  // Overflow Menu State
  const [openMenuTxId, setOpenMenuTxId] = useState<string | null>(null);

  // Calculate Epoch boundaries for Date Filter
  const dateBoundaries = useMemo(() => {
    const now = Date.now();
    if (dateRange === "24H") {
      return { from: now - 24 * 60 * 60 * 1000, to: now };
    }
    if (dateRange === "7D") {
      return { from: now - 7 * 24 * 60 * 60 * 1000, to: now };
    }
    if (dateRange === "30D") {
      return { from: now - 30 * 24 * 60 * 60 * 1000, to: now };
    }
    if (dateRange === "CUSTOM" && customFrom) {
      const fromMs = new Date(customFrom).getTime();
      const toMs = customTo ? new Date(customTo).getTime() + 24 * 60 * 60 * 1000 - 1 : now;
      return { from: fromMs, to: toMs };
    }
    return { from: undefined, to: undefined };
  }, [dateRange, customFrom, customTo]);

  // Load Dashboard Analytics (for accurate 4-card server-side metrics)
  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch("/api/payments/razorpay/dashboard");
      const data = await res.json();
      if (res.ok && data.success) {
        setAnalytics(data);
        setIsConnectionMissing(false);
      } else if (data?.code === "CONNECTION_NOT_FOUND" || res.status === 404) {
        setIsConnectionMissing(true);
      }
    } catch {
      // Non-fatal: summary cards will fallback to current dataset
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  // Fetch Transactions from API
  const fetchTransactions = useCallback(
    async (targetPage = 1, shouldSync = false) => {
      setLoading(true);
      setError(null);
      if (shouldSync) setIsSyncing(true);

      try {
        const params = new URLSearchParams();
        params.set("page", String(targetPage));
        params.set("limit", String(limit));

        if (statusFilter) params.set("status", statusFilter);
        if (methodFilter) params.set("method", methodFilter);
        if (searchQuery.trim()) params.set("search", searchQuery.trim());
        if (dateBoundaries.from) params.set("from", String(dateBoundaries.from));
        if (dateBoundaries.to) params.set("to", String(dateBoundaries.to));
        if (shouldSync) params.set("sync", "true");

        const res = await fetch(`/api/payments/razorpay/transactions?${params.toString()}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          if (data?.code === "CONNECTION_NOT_FOUND" || res.status === 404) {
            setIsConnectionMissing(true);
            setError(null);
          } else {
            setError(data.error || "Failed to load transactions.");
          }
          setTransactions([]);
          setTotalCount(0);
          setHasMore(false);
        } else {
          setIsConnectionMissing(false);
          setTransactions(data.transactions || []);
          if (data.kpis) {
            setTransactionKpis(data.kpis);
          }
          if (data.storeCurrency) {
            const curr = typeof data.storeCurrency === "object" ? data.storeCurrency?.code : data.storeCurrency;
            setServerStoreCurrency(curr || "INR");
          }
          setTotalCount(data.pagination?.total || 0);
          setHasMore(Boolean(data.pagination?.hasMore));
          setPage(data.pagination?.page || targetPage);

          if (shouldSync) {
            showToast("Transactions synchronized with Razorpay.", "success");
            loadAnalytics();
          }
        }
      } catch (err: any) {
        setError(err.message || "Network error loading transactions.");
        setTransactions([]);
      } finally {
        setLoading(false);
        setIsSyncing(false);
      }
    },
    [limit, statusFilter, methodFilter, searchQuery, dateBoundaries, showToast, loadAnalytics]
  );

  // Initial load
  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    fetchTransactions(page);
  }, [fetchTransactions, page]);

  // Debounced Search Handler
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1); // Reset pagination on new search
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Handle Tab Navigation
  const handleTabClick = (tab: DashboardTab) => {
    if (tab === "Transactions") return;
    if (onTabChange) {
      onTabChange(tab);
    } else {
      router.push(`/marketplace/razorpay/${tab.toLowerCase()}`);
    }
  };

  // Drawer Handlers
  const openDrawer = (tx: any) => {
    setSelectedTx(tx);
    setIsDrawerOpen(true);
    setOpenMenuTxId(null);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedTx(null);
  };

  // Keyboard shortcut (Escape closes drawer and modal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isRefundModalOpen) {
          setIsRefundModalOpen(false);
        } else if (isDrawerOpen) {
          closeDrawer();
        }
        setOpenMenuTxId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen, isRefundModalOpen]);

  // Refund Initiation
  const openRefundDialog = (tx: any) => {
    setRefundTargetTx(tx);
    setRefundType("full");
    const rawTxAmount =
      typeof tx.amountMinor === "number" && tx.amountMinor > 0
        ? tx.amountMinor
        : typeof tx.amount === "number" && tx.amount > 0
          ? tx.amount
          : typeof tx.amountPaise === "number" && tx.amountPaise > 0
            ? tx.amountPaise
            : typeof tx.grossMinor === "number" && tx.grossMinor > 0
              ? tx.grossMinor
              : 0;
    const remainingPaise = Math.max(rawTxAmount - (tx.refundedAmountMinor || 0), 0);
    setRefundAmountInput((remainingPaise / 100).toFixed(2));
    setRefundReason("");
    setRefundSpeed("normal");
    setRefundError(null);
    setIsRefundModalOpen(true);
    setOpenMenuTxId(null);
  };

  const submitRefund = async () => {
    if (!refundTargetTx) return;
    setRefundError(null);

    const rawTxAmount =
      typeof refundTargetTx.amountMinor === "number" && refundTargetTx.amountMinor > 0
        ? refundTargetTx.amountMinor
        : typeof refundTargetTx.amount === "number" && refundTargetTx.amount > 0
          ? refundTargetTx.amount
          : typeof refundTargetTx.amountPaise === "number" && refundTargetTx.amountPaise > 0
            ? refundTargetTx.amountPaise
            : typeof refundTargetTx.grossMinor === "number" && refundTargetTx.grossMinor > 0
              ? refundTargetTx.grossMinor
              : 0;

    const remainingPaise = Math.max(
      rawTxAmount - (refundTargetTx.refundedAmountMinor || 0),
      0
    );

    if (remainingPaise <= 0) {
      setRefundError("This payment has no remaining refundable balance.");
      return;
    }

    let amountPaise = remainingPaise;
    if (refundType === "partial") {
      const parsedAmount = parseFloat(refundAmountInput);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setRefundError("Please enter a valid refund amount.");
        return;
      }
      amountPaise = Math.round(parsedAmount * 100);
      if (amountPaise > remainingPaise) {
        setRefundError(
          `Refund amount exceeds remaining refundable balance of ${formatCurrency(
            remainingPaise,
            refundTargetTx.currency
          )}.`
        );
        return;
      }
    }

    setIsSubmittingRefund(true);
    try {
      const body: any = {
        paymentId: refundTargetTx.providerPaymentId,
        ...(refundType === "partial" ? { amount: amountPaise } : {}),
        ...(refundSpeed === "optimum" ? { speed: "optimum" } : {}),
      };
      if (refundReason.trim()) {
        body.notes = { reason: refundReason.trim() };
      }

      const res = await fetch("/api/payments/razorpay/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setRefundError(data.error || "Failed to process refund.");
      } else {
        showToast(
          `Refund of ${formatCurrency(amountPaise, refundTargetTx.currency)} initiated successfully.`,
          "success",
          `Refund ID: ${data.refund?.providerRefundId || data.refund?.id || "Processed"}`
        );
        setIsRefundModalOpen(false);
        // Refresh transactions and analytics
        fetchTransactions(page);
        loadAnalytics();
        // Update open drawer if target is selected
        if (selectedTx && selectedTx._id === refundTargetTx._id) {
          const updatedRefundedAmount = (selectedTx.refundedAmountMinor || 0) + amountPaise;
          setSelectedTx({
            ...selectedTx,
            refundedAmountMinor: updatedRefundedAmount,
            status:
              updatedRefundedAmount >= (selectedTx.amountMinor || rawTxAmount) ? "refunded" : "partially_refunded",
          });
        }

        // Navigate to the refunds page in Razorpay
        if (onTabChange) {
          onTabChange("Refunds");
        } else {
          router.push("/marketplace/razorpay/refunds");
        }
      }
    } catch (err: any) {
      setRefundError(err.message || "Network error processing refund.");
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  // Full Export Action (Fetches all pages matching current filters)
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const allRecords: any[] = [];
      let fetchPage = 1;
      let hasMoreRecords = true;

      while (hasMoreRecords && fetchPage <= 20) {
        const params = new URLSearchParams();
        params.set("page", String(fetchPage));
        params.set("limit", "100"); // Max page size
        if (statusFilter) params.set("status", statusFilter);
        if (methodFilter) params.set("method", methodFilter);
        if (searchQuery.trim()) params.set("search", searchQuery.trim());
        if (dateBoundaries.from) params.set("from", String(dateBoundaries.from));
        if (dateBoundaries.to) params.set("to", String(dateBoundaries.to));

        const res = await fetch(`/api/payments/razorpay/transactions?${params.toString()}`);
        const data = await res.json();

        if (res.ok && data.success && Array.isArray(data.transactions)) {
          allRecords.push(...data.transactions);
          hasMoreRecords = Boolean(data.pagination?.hasMore) && data.transactions.length > 0;
          fetchPage++;
        } else {
          break;
        }
      }

      if (allRecords.length === 0) {
        showToast("No transactions match the selected filters to export.", "info");
        setIsExporting(false);
        return;
      }

      // Generate CSV
      const headers = [
        "Transaction ID",
        "Order Reference",
        "Customer Name",
        "Customer Email",
        "Customer Phone",
        "Amount",
        "Currency",
        "Payment Method",
        "Status",
        "Created At",
        "Paid At",
      ];

      const escapeCsv = (str: any) => {
        if (str === null || str === undefined) return '""';
        const s = String(str).replace(/"/g, '""');
        return `"${s}"`;
      };

      const rows = allRecords.map((t) => [
        escapeCsv(t.providerPaymentId),
        escapeCsv(t.providerOrderId || t.internalOrderId || ""),
        escapeCsv(t.customerName || ""),
        escapeCsv(t.customerEmail || ""),
        escapeCsv(t.customerPhone || ""),
        escapeCsv(((t.amountMinor || 0) / 100).toFixed(2)),
        escapeCsv(t.currency || "INR"),
        escapeCsv(t.paymentMethod || ""),
        escapeCsv(t.status || ""),
        escapeCsv(t.createdAt ? new Date(t.createdAt).toISOString() : ""),
        escapeCsv(t.paidAt ? new Date(t.paidAt).toISOString() : ""),
      ]);

      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.setAttribute("href", url);
      link.setAttribute("download", `razorpay_transactions_${timestamp}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`Exported ${allRecords.length} transactions successfully.`, "success");
    } catch (err: any) {
      showToast("Failed to export transactions.", "error", err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Method Icon & Text Helper
  const getMethodBadge = (method: string, meta?: any) => {
    const m = (method || "").toLowerCase();
    if (m === "upi") {
      const vpa = meta?.vpa ? ` (${meta.vpa})` : "";
      return (
        <div className="flex items-center gap-1.5 font-medium text-xs text-[#0c0a09]">
          <span className="material-symbols-outlined text-[16px] text-stone-500">account_balance</span>
          <span>UPI{vpa}</span>
        </div>
      );
    }
    if (m === "card") {
      const network = meta?.network || "Card";
      const last4 = meta?.last4 ? ` •••• ${meta.last4}` : "";
      return (
        <div className="flex items-center gap-1.5 font-medium text-xs text-[#0c0a09]">
          <span className="material-symbols-outlined text-[16px] text-stone-500">credit_card</span>
          <span>{network}{last4}</span>
        </div>
      );
    }
    if (m === "netbanking") {
      const bank = meta?.bank ? ` (${meta.bank})` : "";
      return (
        <div className="flex items-center gap-1.5 font-medium text-xs text-[#0c0a09]">
          <span className="material-symbols-outlined text-[16px] text-stone-500">account_balance</span>
          <span>Netbanking{bank}</span>
        </div>
      );
    }
    if (m === "wallet") {
      const wallet = meta?.wallet ? ` (${meta.wallet})` : "";
      return (
        <div className="flex items-center gap-1.5 font-medium text-xs text-[#0c0a09]">
          <span className="material-symbols-outlined text-[16px] text-stone-500">account_balance_wallet</span>
          <span>Wallet{wallet}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 font-medium text-xs text-[#0c0a09]">
        <span className="material-symbols-outlined text-[16px] text-stone-500">payments</span>
        <span className="capitalize">{method || "Unknown"}</span>
      </div>
    );
  };

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    switch (s) {
      case "captured":
      case "paid":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Paid
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            Failed
          </span>
        );
      case "pending":
      case "authorized":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Pending
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
            Refunded
          </span>
        );
      case "partially_refunded":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            Partially Refunded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-700 border border-stone-200 uppercase tracking-wider">
            {status}
          </span>
        );
    }
  };

  // Calculate Metrics from server analytics or current dataset
  const rawCurrency =
    analytics?.metrics?.currency ||
    analytics?.storeCurrency ||
    serverStoreCurrency ||
    "INR";
  const primaryCurrency =
    (typeof rawCurrency === "object" ? rawCurrency?.code : rawCurrency) || "INR";

  const calculateFallbackMetric = useCallback(
    (filterFn?: (t: any) => boolean): string => {
      const eligible = filterFn ? transactions.filter(filterFn) : transactions;
      if (!eligible.length) return formatCurrency(0, primaryCurrency);

      const byCurr: Record<string, number> = {};
      for (const t of eligible) {
        const c = (t.currency || primaryCurrency).toUpperCase();
        const amt =
          typeof t.amountMinor === "number" && !isNaN(t.amountMinor)
            ? t.amountMinor
            : typeof t.amount === "number" && !isNaN(t.amount)
              ? t.amount
              : 0;
        byCurr[c] = (byCurr[c] || 0) + amt;
      }

      const currKeys = Object.keys(byCurr);
      if (currKeys.length === 1) {
        return formatCurrency(byCurr[currKeys[0]], currKeys[0]);
      }

      const primaryAmt = byCurr[primaryCurrency.toUpperCase()] || 0;
      const base = formatCurrency(primaryAmt, primaryCurrency);
      const foreign = currKeys
        .filter((c) => c !== primaryCurrency.toUpperCase())
        .map((c) => formatCurrency(byCurr[c], c));

      if (primaryAmt === 0 && foreign.length > 0) {
        return foreign.join(" + ");
      }
      return `${base} (+ ${foreign.join(", ")})`;
    },
    [transactions, primaryCurrency]
  );

  const totalTransactionsDisplay = useMemo(() => {
    if (transactionKpis?.total?.formattedAmount) {
      return transactionKpis.total.formattedAmount;
    }
    if (transactionKpis?.total?.amountMinor !== undefined) {
      const curr = transactionKpis.dominantCurrency || primaryCurrency;
      return formatCurrency(transactionKpis.total.amountMinor, curr);
    }
    if (analytics?.metrics?.totalPaymentsMetrics?.formattedGross) {
      return analytics.metrics.totalPaymentsMetrics.formattedGross;
    }
    if (analytics?.metrics?.monthlyRevenue?.formattedGross) {
      return analytics.metrics.monthlyRevenue.formattedGross;
    }
    return calculateFallbackMetric();
  }, [transactionKpis, analytics, calculateFallbackMetric, primaryCurrency]);

  const successfulDisplay = useMemo(() => {
    if (transactionKpis?.successful?.formattedAmount) {
      return transactionKpis.successful.formattedAmount;
    }
    if (transactionKpis?.successful?.amountMinor !== undefined) {
      const curr = transactionKpis.dominantCurrency || primaryCurrency;
      return formatCurrency(transactionKpis.successful.amountMinor, curr);
    }
    if (analytics?.metrics?.successfulPaymentsMetrics?.formattedGross) {
      return analytics.metrics.successfulPaymentsMetrics.formattedGross;
    }
    if (analytics?.metrics?.successfulPayments?.formattedGross) {
      return analytics.metrics.successfulPayments.formattedGross;
    }
    return calculateFallbackMetric(
      (t) =>
        t.status === "captured" ||
        t.status === "paid" ||
        t.status === "refunded" ||
        t.status === "partially_refunded"
    );
  }, [transactionKpis, analytics, calculateFallbackMetric, primaryCurrency]);

  const failedDisplay = useMemo(() => {
    if (transactionKpis?.failed?.formattedAmount) {
      return transactionKpis.failed.formattedAmount;
    }
    if (transactionKpis?.failed?.amountMinor !== undefined) {
      const curr = transactionKpis.dominantCurrency || primaryCurrency;
      return formatCurrency(transactionKpis.failed.amountMinor, curr);
    }
    if (analytics?.metrics?.failedPaymentsMetrics?.formattedGross) {
      return analytics.metrics.failedPaymentsMetrics.formattedGross;
    }
    if (analytics?.metrics?.failedPayments?.formattedGross) {
      return analytics.metrics.failedPayments.formattedGross;
    }
    return calculateFallbackMetric((t) => t.status === "failed");
  }, [transactionKpis, analytics, calculateFallbackMetric, primaryCurrency]);

  const pendingDisplay = useMemo(() => {
    if (transactionKpis?.pending?.formattedAmount) {
      return transactionKpis.pending.formattedAmount;
    }
    if (transactionKpis?.pending?.amountMinor !== undefined) {
      const curr = transactionKpis.dominantCurrency || primaryCurrency;
      return formatCurrency(transactionKpis.pending.amountMinor, curr);
    }
    if (analytics?.metrics?.pendingPaymentsMetrics?.formattedGross) {
      return analytics.metrics.pendingPaymentsMetrics.formattedGross;
    }
    if (analytics?.metrics?.pendingPayments?.formattedGross) {
      return analytics.metrics.pendingPayments.formattedGross;
    }
    return calculateFallbackMetric(
      (t) => t.status === "pending" || t.status === "authorized" || t.status === "created"
    );
  }, [transactionKpis, analytics, calculateFallbackMetric, primaryCurrency]);

  const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
  const startRecord = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalCount);

  // Clear all filters
  const clearFilters = () => {
    setDateRange("30D");
    setCustomFrom("");
    setCustomTo("");
    setStatusFilter("");
    setMethodFilter("");
    setSearchInput("");
    setSearchQuery("");
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    dateRange !== "30D" || statusFilter || methodFilter || searchQuery
  );

  const content = (
    <div className="w-full flex-1 flex flex-col p-4 sm:p-6 md:p-8 lg:p-10 max-w-[1400px] mx-auto space-y-6 font-sans">
      {/* 1. Breadcrumb Navigation */}
      {!hideHeaderNav && (
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-xs font-medium text-[#78716c]"
        >
          <Link href="/marketplace" className="hover:text-[#0c0a09] transition-colors">
            Installed Apps
          </Link>
          <span className="material-symbols-outlined text-[16px] text-[#a8a29e]">chevron_right</span>
          <Link href="/marketplace?tab=payments" className="hover:text-[#0c0a09] transition-colors">
            Payments
          </Link>
          <span className="material-symbols-outlined text-[16px] text-[#a8a29e]">chevron_right</span>
          <span className="text-[#0c0a09] font-bold">Razorpay</span>
        </nav>
      )}

      {/* 2. Page Title & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0c0a09]">
            Transactions
          </h1>
          <p className="text-xs sm:text-sm text-[#78716c] mt-0.5">
            Monitor and manage all merchant-level payments.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || totalCount === 0}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-[#e7e5e4] rounded-xl text-[#0c0a09] text-xs sm:text-sm font-semibold hover:bg-stone-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[18px] ${isExporting ? "animate-spin" : ""}`}>
              {isExporting ? "progress_activity" : "download"}
            </span>
            <span>{isExporting ? "Exporting..." : "Export"}</span>
          </button>

          <button
            type="button"
            onClick={() => fetchTransactions(page, true)}
            disabled={isSyncing || isConnectionMissing}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#0c0a09] text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-stone-800 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[18px] ${isSyncing ? "animate-spin" : ""}`}>
              sync
            </span>
            <span>{isSyncing ? "Syncing..." : "Sync"}</span>
          </button>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      {!hideHeaderNav && (
        <div className="border-b border-[#e7e5e4] flex items-center gap-6 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => handleTabClick(tab)}
                data-testid={`tab-${tab.toLowerCase()}`}
                className={`pb-3 text-sm font-semibold whitespace-nowrap transition-all border-b-2 cursor-pointer ${
                  isActive
                    ? "border-[#0c0a09] text-[#0c0a09]"
                    : "border-transparent text-[#78716c] hover:text-[#0c0a09]"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      )}

      {/* 4. Four Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Transactions */}
        <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex justify-between items-center text-[#78716c]">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Transactions</span>
            <span className="material-symbols-outlined text-[20px] text-stone-700">payments</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#0c0a09] tracking-tight">
              {analyticsLoading && !transactionKpis ? "..." : totalTransactionsDisplay}
            </div>
            <div className="text-xs text-[#78716c] mt-1 flex items-center gap-1 font-medium">
              <span>{totalCount} total synchronized records</span>
            </div>
          </div>
        </div>

        {/* Card 2: Successful */}
        <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex justify-between items-center text-[#78716c]">
            <span className="text-xs font-semibold uppercase tracking-wider">Successful</span>
            <span className="material-symbols-outlined text-[20px] text-emerald-600">check_circle</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#0c0a09] tracking-tight">
              {analyticsLoading && !transactionKpis ? "..." : successfulDisplay}
            </div>
            <div className="text-xs text-emerald-700 font-medium mt-1">
              {transactionKpis?.successRate !== undefined
                ? `${transactionKpis.successRate.toFixed(1)}% success rate (${transactionKpis.successful.count} captured)`
                : analytics?.metrics?.successRate !== undefined
                  ? `${analytics.metrics.successRate.toFixed(1)}% success rate`
                  : `${analytics?.metrics?.successfulPaymentsMetrics?.count ?? (typeof analytics?.metrics?.successfulPayments === "number" ? analytics.metrics.successfulPayments : 0)} captured`}
            </div>
          </div>
        </div>

        {/* Card 3: Failed */}
        <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex justify-between items-center text-[#78716c]">
            <span className="text-xs font-semibold uppercase tracking-wider">Failed</span>
            <span className="material-symbols-outlined text-[20px] text-rose-600">error</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#0c0a09] tracking-tight">
              {analyticsLoading && !transactionKpis ? "..." : failedDisplay}
            </div>
            <div className="text-xs text-rose-700 font-medium mt-1">
              {transactionKpis?.failed?.count !== undefined
                ? `${transactionKpis.failed.count} failed payments (${transactionKpis.failureRate.toFixed(1)}% failure rate)`
                : analytics?.metrics?.failedPaymentsMetrics?.count !== undefined
                  ? `${analytics.metrics.failedPaymentsMetrics.count} failed payments`
                  : typeof analytics?.metrics?.failedPayments === "number"
                    ? `${analytics.metrics.failedPayments} failed payments`
                    : `${transactions.filter((t) => t.status === "failed").length} failed`}
            </div>
          </div>
        </div>

        {/* Card 4: Pending */}
        <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex justify-between items-center text-[#78716c]">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending</span>
            <span className="material-symbols-outlined text-[20px] text-amber-600">pending</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#0c0a09] tracking-tight">
              {analyticsLoading && !transactionKpis ? "..." : pendingDisplay}
            </div>
            <div className="text-xs text-[#78716c] font-medium mt-1">
              {transactionKpis?.pending?.count !== undefined
                ? `${transactionKpis.pending.count} active authorizations`
                : analytics?.metrics?.pendingPaymentsMetrics?.count !== undefined
                  ? `${analytics.metrics.pendingPaymentsMetrics.count} active authorizations`
                  : typeof analytics?.metrics?.pendingPayments === "number"
                    ? `${analytics.metrics.pendingPayments} active authorizations`
                    : `${transactions.filter((t) => t.status === "pending" || t.status === "authorized").length} pending`}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Filters & Controls Bar */}
      <div className="bg-white border border-[#e7e5e4] rounded-t-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          {/* Date Range Selector */}
          <div className="relative shrink-0">
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value as any);
                setPage(1);
              }}
              className="appearance-none h-9 pl-3.5 pr-9 bg-[#fafaf9] hover:bg-[#f5f5f4] rounded-xl border border-[#e7e5e4] text-xs font-medium text-[#0c0a09] focus:outline-none focus:border-[#0c0a09] transition-colors cursor-pointer"
            >
              <option value="30D">Last 30 Days</option>
              <option value="7D">Last 7 Days</option>
              <option value="24H">Last 24 Hours</option>
              <option value="ALL">All Time</option>
              <option value="CUSTOM">Custom Range</option>
            </select>
            <span className="material-symbols-outlined text-[16px] text-[#78716c] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
              calendar_month
            </span>
          </div>

          {/* Custom Date Pickers */}
          {dateRange === "CUSTOM" && (
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => {
                  setCustomFrom(e.target.value);
                  setPage(1);
                }}
                className="h-9 px-3 bg-[#fafaf9] rounded-xl border border-[#e7e5e4] text-xs text-[#0c0a09] focus:outline-none focus:border-[#0c0a09]"
              />
              <span className="text-xs text-[#78716c] font-medium">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => {
                  setCustomTo(e.target.value);
                  setPage(1);
                }}
                className="h-9 px-3 bg-[#fafaf9] rounded-xl border border-[#e7e5e4] text-xs text-[#0c0a09] focus:outline-none focus:border-[#0c0a09]"
              />
            </div>
          )}

          {/* Status Selector */}
          <div className="relative shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="appearance-none h-9 pl-3.5 pr-9 bg-[#fafaf9] hover:bg-[#f5f5f4] rounded-xl border border-[#e7e5e4] text-xs font-medium text-[#0c0a09] focus:outline-none focus:border-[#0c0a09] transition-colors cursor-pointer"
            >
              <option value="">All Status</option>
              <option value="captured">Paid / Captured</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending / Authorized</option>
              <option value="refunded">Refunded</option>
              <option value="partially_refunded">Partially Refunded</option>
            </select>
            <span className="material-symbols-outlined text-[16px] text-[#78716c] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
              filter_list
            </span>
          </div>

          {/* Payment Method Selector */}
          <div className="relative shrink-0">
            <select
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setPage(1);
              }}
              className="appearance-none h-9 pl-3.5 pr-9 bg-[#fafaf9] hover:bg-[#f5f5f4] rounded-xl border border-[#e7e5e4] text-xs font-medium text-[#0c0a09] focus:outline-none focus:border-[#0c0a09] transition-colors cursor-pointer"
            >
              <option value="">Payment Method</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="netbanking">Netbanking</option>
              <option value="wallet">Wallet</option>
            </select>
            <span className="material-symbols-outlined text-[16px] text-[#78716c] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
              credit_card
            </span>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <input
              type="text"
              placeholder="Search by Payment ID, customer..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full h-9 pl-9 pr-3.5 bg-[#fafaf9] hover:bg-[#f5f5f4] focus:bg-white rounded-xl border border-[#e7e5e4] text-xs text-[#0c0a09] focus:outline-none focus:border-[#0c0a09] transition-colors placeholder:text-[#a8a29e]"
            />
            <span className="material-symbols-outlined text-[16px] text-[#78716c] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
              search
            </span>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="h-9 inline-flex items-center px-2.5 text-xs text-[#78716c] hover:text-[#0c0a09] font-medium transition-colors cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Counter */}
        <div className="text-xs text-[#78716c] whitespace-nowrap shrink-0 self-center font-medium">
          Showing {startRecord}-{endRecord} of {totalCount} transactions
        </div>
      </div>

      {/* 6. Transactions Table */}
      <div className="bg-white border border-[#e7e5e4] border-t-0 rounded-b-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#fafaf9] border-b border-[#e7e5e4] text-[11px] font-bold text-[#78716c] uppercase tracking-wider">
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7e5e4]">
              {loading ? (
                // Skeletons
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse">
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-28 bg-stone-200 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-3.5 w-32 bg-stone-200 rounded mb-1" />
                      <div className="h-2.5 w-24 bg-stone-100 rounded" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="h-4 w-20 bg-stone-200 rounded ml-auto" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-24 bg-stone-200 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-16 bg-stone-200 rounded-full" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-3.5 w-24 bg-stone-200 rounded" />
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="h-6 w-14 bg-stone-200 rounded ml-auto mr-auto" />
                    </td>
                  </tr>
                ))
              ) : isConnectionMissing ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <div className="flex flex-col items-center justify-center max-w-md mx-auto gap-3 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-[#0c0a09] border border-stone-200">
                        <span className="material-symbols-outlined text-[26px]">link_off</span>
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-[#0c0a09]">Razorpay Not Connected</h3>
                        <p className="text-xs text-[#78716c] mt-1 leading-relaxed">
                          No active Razorpay credentials found for this store. Connect your Razorpay account to start processing live transactions, viewing analytics, and issuing refunds directly from PREST.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => router.push("/marketplace?flow=razorpay-connect")}
                        className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0c0a09] text-white text-xs font-semibold hover:bg-stone-800 transition-colors shadow-2xs cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">add_link</span>
                        Connect Razorpay
                      </button>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[32px] text-rose-500">error</span>
                      <p className="text-sm font-semibold text-[#0c0a09]">{error}</p>
                      <button
                        type="button"
                        onClick={() => fetchTransactions(page)}
                        className="mt-2 px-3.5 py-1.5 rounded-xl bg-[#0c0a09] text-white text-xs font-semibold hover:bg-stone-800 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-[#78716c]">
                      <span className="material-symbols-outlined text-[36px] text-stone-400">
                        receipt_long
                      </span>
                      <p className="text-sm font-medium text-[#0c0a09]">No transactions found</p>
                      <p className="text-xs">
                        {hasActiveFilters
                          ? "Try adjusting your filters or search query."
                          : "Synchronize with Razorpay to pull the latest transaction records."}
                      </p>
                      {hasActiveFilters ? (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="mt-2 text-xs font-semibold text-[#0c0a09] hover:underline"
                        >
                          Clear all filters
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fetchTransactions(1, true)}
                          className="mt-2 px-3.5 py-1.5 rounded-xl bg-[#0c0a09] text-white text-xs font-semibold hover:bg-stone-800"
                        >
                          Sync With Razorpay
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const isCaptured = tx.status === "captured" || tx.status === "paid";
                  const isRefunded =
                    tx.status === "refunded" || tx.status === "partially_refunded";
                  const remainingPaise = Math.max(
                    (tx.amountMinor || 0) - (tx.refundedAmountMinor || 0),
                    0
                  );
                  const isEligibleForRefund =
                    (isCaptured || tx.status === "partially_refunded") && remainingPaise > 0;

                  return (
                    <tr
                      key={tx._id || tx.providerPaymentId}
                      onClick={() => openDrawer(tx)}
                      className="hover:bg-[#fafaf9] transition-colors cursor-pointer group"
                    >
                      {/* Transaction ID */}
                      <td className="py-3 px-4 font-mono font-semibold text-xs text-[#0c0a09] hover:underline">
                        {tx.providerPaymentId}
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs text-[#0c0a09]">
                            {tx.customerName || "Customer details unavailable"}
                          </span>
                          {(tx.customerEmail || tx.customerPhone) && (
                            <span className="text-[11px] text-[#78716c]">
                              {tx.customerEmail || tx.customerPhone}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {tx.currency && tx.currency.toUpperCase() !== primaryCurrency.toUpperCase() && (
                            <span
                              title={`Foreign currency transaction (${tx.currency}) differs from store operating currency (${primaryCurrency})`}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200"
                            >
                              {tx.currency}
                            </span>
                          )}
                          <span className="font-bold text-xs sm:text-sm text-[#0c0a09]">
                            {formatCurrency(tx.amountMinor, tx.currency)}
                          </span>
                        </div>
                        {tx.refundedAmountMinor ? (
                          <div className="text-[10px] text-stone-500">
                            Refunded: {formatCurrency(tx.refundedAmountMinor, tx.currency)}
                          </div>
                        ) : null}
                      </td>

                      {/* Method */}
                      <td className="py-3 px-4">{getMethodBadge(tx.paymentMethod, tx.metadata)}</td>

                      {/* Status */}
                      <td className="py-3 px-4">{getStatusBadge(tx.status)}</td>

                      {/* Date */}
                      <td className="py-3 px-4 text-xs text-[#78716c] whitespace-nowrap">
                        {formatDate(tx.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div
                          className="relative inline-flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isEligibleForRefund ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openRefundDialog(tx);
                              }}
                              className="px-2.5 py-1 bg-white border border-[#e7e5e4] rounded-lg text-[11px] font-semibold text-[#0c0a09] hover:bg-stone-50 transition-colors shadow-2xs cursor-pointer"
                            >
                              Refund
                            </button>
                          ) : isRefunded ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDrawer(tx);
                              }}
                              className="px-2.5 py-1 bg-white border border-[#e7e5e4] rounded-lg text-[11px] font-semibold text-[#0c0a09] hover:bg-stone-50 transition-colors shadow-2xs cursor-pointer"
                            >
                              View Refund
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDrawer(tx);
                              }}
                              className="px-2.5 py-1 bg-white border border-[#e7e5e4] rounded-lg text-[11px] font-semibold text-[#0c0a09] hover:bg-stone-50 transition-colors shadow-2xs cursor-pointer"
                            >
                              View
                            </button>
                          )}

                          {/* Overflow menu toggle */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuTxId(openMenuTxId === tx._id ? null : tx._id);
                            }}
                            className="p-1 text-[#78716c] hover:text-[#0c0a09] transition-colors rounded cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">more_vert</span>
                          </button>

                          {/* Overflow Dropdown */}
                          {openMenuTxId === tx._id && (
                            <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-[#e7e5e4] rounded-xl shadow-lg z-20 py-1 text-left text-xs">
                              <button
                                type="button"
                                onClick={() => openDrawer(tx)}
                                className="w-full px-3 py-1.5 text-left text-[#0c0a09] hover:bg-[#fafaf9] transition-colors flex items-center gap-1.5"
                              >
                                <span className="material-symbols-outlined text-[14px]">info</span>
                                <span>Details</span>
                              </button>
                              {isEligibleForRefund && (
                                <button
                                  type="button"
                                  onClick={() => openRefundDialog(tx)}
                                  className="w-full px-3 py-1.5 text-left text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-1.5"
                                >
                                  <span className="material-symbols-outlined text-[14px]">undo</span>
                                  <span>Issue Refund</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 7. Pagination Controls */}
        <div className="px-4 py-3 flex items-center justify-between border-t border-[#e7e5e4] bg-[#fafaf9] text-xs text-[#78716c]">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            className="px-3 py-1.5 rounded-lg border border-[#e7e5e4] bg-white font-medium text-[#0c0a09] hover:bg-stone-50 transition-colors disabled:opacity-40 cursor-pointer shadow-2xs"
          >
            Previous
          </button>

          <div className="flex items-center gap-1.5">
            <span className="font-medium text-[#0c0a09]">Page {page}</span>
            <span>of</span>
            <span className="font-medium text-[#0c0a09]">{totalPages}</span>
          </div>

          <button
            type="button"
            disabled={!hasMore || loading}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg border border-[#e7e5e4] bg-white font-medium text-[#0c0a09] hover:bg-stone-50 transition-colors disabled:opacity-40 cursor-pointer shadow-2xs"
          >
            Next
          </button>
        </div>
      </div>

      {/* 8. Slide-In Transaction Details Drawer */}
      {isDrawerOpen && selectedTx && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Transaction Details"
          className="fixed inset-0 z-50 overflow-hidden"
        >
          {/* Backdrop */}
          <div
            onClick={closeDrawer}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          {/* Drawer Container */}
          <div className="absolute right-0 top-0 h-full w-full max-w-[480px] bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-5 border-b border-[#e7e5e4] flex justify-between items-center bg-[#fafaf9]">
              <h2 className="text-base font-bold text-[#0c0a09]">Transaction Details</h2>
              <button
                type="button"
                onClick={closeDrawer}
                className="p-1 rounded-lg text-[#78716c] hover:text-[#0c0a09] hover:bg-stone-200 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Payment Hero Summary */}
              <div className="flex flex-col items-center text-center p-4 bg-[#fafaf9] rounded-2xl border border-[#e7e5e4]">
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${
                    selectedTx.status === "captured" || selectedTx.status === "paid"
                      ? "bg-emerald-100 text-emerald-700"
                      : selectedTx.status === "failed"
                      ? "bg-rose-100 text-rose-700"
                      : selectedTx.status === "refunded"
                      ? "bg-stone-200 text-stone-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  <span className="material-symbols-outlined text-[28px]">
                    {selectedTx.status === "captured" || selectedTx.status === "paid"
                      ? "check_circle"
                      : selectedTx.status === "failed"
                      ? "error"
                      : selectedTx.status === "refunded"
                      ? "undo"
                      : "pending"}
                  </span>
                </div>
                <div className="text-2xl font-bold text-[#0c0a09] tracking-tight">
                  {formatCurrency(selectedTx.amountMinor, selectedTx.currency)}
                </div>
                <div className="mt-1">{getStatusBadge(selectedTx.status)}</div>
                {selectedTx.currency && selectedTx.currency.toUpperCase() !== primaryCurrency.toUpperCase() && (
                  <div className="mt-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-left">
                    <div className="flex items-center gap-1.5 text-amber-800 text-xs font-semibold">
                      <span className="material-symbols-outlined text-[16px]">info</span>
                      <span>Foreign Currency Transaction ({selectedTx.currency})</span>
                    </div>
                    <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                      This payment was processed in {selectedTx.currency}, differing from the store operating currency ({primaryCurrency}). Original provider currency and minor-unit precision are strictly preserved.
                    </p>
                  </div>
                )}
                {selectedTx.refundedAmountMinor ? (
                  <p className="text-xs text-[#78716c] mt-1.5">
                    Total Refunded: {formatCurrency(selectedTx.refundedAmountMinor, selectedTx.currency)}
                  </p>
                ) : null}
              </div>

              {/* 1. Basic Information */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#78716c]">
                  Basic Information
                </h3>
                <div className="bg-white border border-[#e7e5e4] rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[#78716c]">Merchant Reference</span>
                    <span className="font-semibold text-[#0c0a09]">
                      {selectedTx.internalOrderId || selectedTx.providerOrderId || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#78716c]">Razorpay Payment ID</span>
                    <span className="font-mono font-semibold text-[#0c0a09]">
                      {selectedTx.providerPaymentId}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#78716c]">Created At</span>
                    <span className="font-medium text-[#0c0a09]">
                      {formatDate(selectedTx.createdAt)}
                    </span>
                  </div>
                  {selectedTx.paidAt ? (
                    <div className="flex justify-between items-center">
                      <span className="text-[#78716c]">Captured At</span>
                      <span className="font-medium text-[#0c0a09]">
                        {formatDate(selectedTx.paidAt)}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* 2. Customer Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#78716c]">
                  Customer Details
                </h3>
                <div className="bg-white border border-[#e7e5e4] rounded-xl p-3.5 space-y-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center font-bold text-xs text-[#0c0a09]">
                      {(selectedTx.customerName || "C").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-[#0c0a09]">
                        {selectedTx.customerName || "Customer details unavailable"}
                      </p>
                      {selectedTx.customerEmail && (
                        <p className="text-[11px] text-[#78716c]">{selectedTx.customerEmail}</p>
                      )}
                    </div>
                  </div>
                  {selectedTx.customerPhone && (
                    <div className="flex justify-between items-center pt-2 border-t border-[#e7e5e4]">
                      <span className="text-[#78716c]">Contact</span>
                      <span className="font-medium text-[#0c0a09]">{selectedTx.customerPhone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Payment Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#78716c]">
                  Payment Details
                </h3>
                <div className="bg-white border border-[#e7e5e4] rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[#78716c]">Method</span>
                    <span className="font-medium text-[#0c0a09] capitalize">
                      {selectedTx.paymentMethod || "Unknown"}
                    </span>
                  </div>
                  {selectedTx.metadata?.vpa && (
                    <div className="flex justify-between items-center">
                      <span className="text-[#78716c]">VPA</span>
                      <span className="font-mono text-[#0c0a09]">{selectedTx.metadata.vpa}</span>
                    </div>
                  )}
                  {selectedTx.metadata?.last4 && (
                    <div className="flex justify-between items-center">
                      <span className="text-[#78716c]">Card</span>
                      <span className="font-medium text-[#0c0a09]">
                        {selectedTx.metadata.network || "Card"} •••• {selectedTx.metadata.last4}
                      </span>
                    </div>
                  )}
                  {selectedTx.metadata?.bank && (
                    <div className="flex justify-between items-center">
                      <span className="text-[#78716c]">Bank</span>
                      <span className="font-medium text-[#0c0a09]">{selectedTx.metadata.bank}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-[#78716c]">Currency</span>
                    <span className="font-medium text-[#0c0a09]">{selectedTx.currency || "INR"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#78716c]">Provider Status</span>
                    <span className="font-mono text-[11px] text-[#0c0a09]">
                      {selectedTx.providerStatus || selectedTx.status}
                    </span>
                  </div>
                  {selectedTx.errorMessage && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                      <span className="font-semibold">Error: </span>
                      {selectedTx.errorMessage} ({selectedTx.errorCode || "FAILURE"})
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Settlement Information */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#78716c]">
                  Settlement Information
                </h3>
                <div className="bg-white border border-[#e7e5e4] rounded-xl p-3.5 space-y-2 text-xs">
                  {selectedTx.metadata?.settlement_id ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-[#78716c]">Settlement Status</span>
                        <span className="font-semibold text-emerald-700">Settled</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#78716c]">Settlement Reference</span>
                        <span className="font-mono text-[#0c0a09]">
                          {selectedTx.metadata.settlement_id}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-[#78716c]">
                      <span className="material-symbols-outlined text-[16px]">info</span>
                      <span>
                        Settlement processing is synchronized via scheduled settlement runs.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Actions Footer */}
            <div className="p-4 border-t border-[#e7e5e4] bg-[#fafaf9] flex items-center gap-3">
              {(selectedTx.status === "captured" || selectedTx.status === "partially_refunded") &&
              (selectedTx.amountMinor || 0) > (selectedTx.refundedAmountMinor || 0) ? (
                <button
                  type="button"
                  onClick={() => openRefundDialog(selectedTx)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors cursor-pointer text-center"
                >
                  Issue Refund
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  const receiptData = JSON.stringify(selectedTx, null, 2);
                  const blob = new Blob([receiptData], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `receipt_${selectedTx.providerPaymentId}.json`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                  showToast("Transaction summary downloaded.", "info");
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#0c0a09] hover:bg-stone-800 text-white text-xs font-semibold transition-colors cursor-pointer text-center"
              >
                Download Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Refund Confirmation Dialog */}
      {isRefundModalOpen && refundTargetTx && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-modal-title"
          className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div
            onClick={() => !isSubmittingRefund && setIsRefundModalOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
          />

          {/* Modal Container */}
          <div className="relative bg-white rounded-2xl border border-[#e7e5e4] shadow-2xl max-w-md w-full p-6 space-y-5 z-10 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start">
              <div>
                <h2 id="refund-modal-title" className="text-lg font-bold text-[#0c0a09]">
                  Issue Refund
                </h2>
                <p className="text-xs text-[#78716c] mt-0.5">
                  Confirm refund details for payment{" "}
                  <span className="font-mono font-semibold">{refundTargetTx.providerPaymentId}</span>
                </p>
              </div>
              <button
                type="button"
                disabled={isSubmittingRefund}
                onClick={() => setIsRefundModalOpen(false)}
                className="p-1 rounded-lg text-[#78716c] hover:text-[#0c0a09] transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Refundable Balance Info */}
            <div className="p-3.5 bg-[#fafaf9] rounded-xl border border-[#e7e5e4] text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#78716c]">Total Payment:</span>
                <span className="font-semibold text-[#0c0a09]">
                  {formatCurrency(refundTargetTx.amountMinor, refundTargetTx.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#78716c]">Remaining Refundable:</span>
                <span className="font-bold text-emerald-700">
                  {formatCurrency(
                    (refundTargetTx.amountMinor || 0) - (refundTargetTx.refundedAmountMinor || 0),
                    refundTargetTx.currency
                  )}
                </span>
              </div>
            </div>

            {/* Error Banner */}
            {refundError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                {refundError}
              </div>
            )}

            {/* Refund Type Selection */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-[#0c0a09]">Refund Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRefundType("full")}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    refundType === "full"
                      ? "border-[#0c0a09] bg-[#0c0a09] text-white"
                      : "border-[#e7e5e4] bg-white text-[#0c0a09] hover:bg-stone-50"
                  }`}
                >
                  Full Refund
                </button>
                <button
                  type="button"
                  onClick={() => setRefundType("partial")}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    refundType === "partial"
                      ? "border-[#0c0a09] bg-[#0c0a09] text-white"
                      : "border-[#e7e5e4] bg-white text-[#0c0a09] hover:bg-stone-50"
                  }`}
                >
                  Partial Refund
                </button>
              </div>

              {refundType === "partial" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#78716c]">
                    Refund Amount ({refundTargetTx.currency || primaryCurrency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={refundAmountInput}
                    onChange={(e) => setRefundAmountInput(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-xl border border-[#e7e5e4] text-xs font-bold text-[#0c0a09] focus:outline-none focus:border-[#0c0a09]"
                  />
                </div>
              )}
            </div>

            {/* Speed Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#0c0a09]">Processing Speed</label>
              <select
                value={refundSpeed}
                onChange={(e) => setRefundSpeed(e.target.value as any)}
                className="w-full px-3 py-2 bg-white rounded-xl border border-[#e7e5e4] text-xs font-medium text-[#0c0a09] focus:outline-none focus:border-[#0c0a09]"
              >
                <option value="normal">Normal (5-7 business days)</option>
                <option value="optimum">Optimum (Instant if supported)</option>
              </select>
            </div>

            {/* Reason Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#0c0a09]">
                Refund Reason (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Customer return, order cancelled..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full px-3 py-2 bg-white rounded-xl border border-[#e7e5e4] text-xs text-[#0c0a09] focus:outline-none focus:border-[#0c0a09]"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmittingRefund}
                onClick={() => setIsRefundModalOpen(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-[#e7e5e4] bg-white hover:bg-stone-50 text-xs font-semibold text-[#0c0a09] transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingRefund}
                onClick={submitRefund}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isSubmittingRefund ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">
                      progress_activity
                    </span>
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Confirm Refund</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );

  if (embeddedInMarketplace) {
    return content;
  }

  return (
    <PosShell
      title="Transactions"
      subtitle="Monitor and manage all merchant-level payments."
    >
      {content}
    </PosShell>
  );
}
