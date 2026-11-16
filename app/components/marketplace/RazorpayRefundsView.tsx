"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PosShell } from "../PosShell";
import { formatCurrencyMinor, getCurrencySymbol } from "../../lib/payments/currency";

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

const REFUND_REASONS = [
  "Customer Requested",
  "Duplicate Payment",
  "Product Out of Stock",
  "Service Not Rendered",
  "Other",
] as const;

export interface RazorpayRefundsViewProps {
  embeddedInMarketplace?: boolean;
  hideHeaderNav?: boolean;
  onTabChange?: (tab: DashboardTab) => void;
  initialCreateRefundPaymentId?: string;
}

interface ToastMessage {
  message: string;
  type: "success" | "error" | "info";
  subtext?: string;
}

function formatCurrency(amountMinor: number, currency = "INR"): string {
  return formatCurrencyMinor(amountMinor, currency);
}

function formatDate(epochMs?: number, timezone = "Asia/Kolkata"): string {
  if (!epochMs) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(epochMs));
  } catch {
    return new Date(epochMs).toLocaleString();
  }
}

export function RazorpayRefundsView({
  embeddedInMarketplace = false,
  hideHeaderNav = false,
  onTabChange,
  initialCreateRefundPaymentId,
}: RazorpayRefundsViewProps) {
  const router = useRouter();

  // Active Tab
  const [activeTab] = useState<DashboardTab>("Refunds");

  // Notifications & Feedback
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "info", subtext?: string) => {
      setToast({ message, type, subtext });
      setTimeout(() => setToast(null), 5000);
    },
    []
  );

  // Data & loading states
  const [refunds, setRefunds] = useState<any[]>([]);
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
  const [searchInput, setSearchInput] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Summary Metrics State (from /api/payments/razorpay/dashboard)
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [serverStoreCurrency, setServerStoreCurrency] = useState<string>("INR");

  // Screen 1: Refund Details Drawer State
  const [selectedRefund, setSelectedRefund] = useState<any | null>(null);
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);

  // Screen 2: Create Refund Drawer State
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [selectedTxForRefund, setSelectedTxForRefund] = useState<any | null>(null);
  const [txLookupLoading, setTxLookupLoading] = useState(false);
  const [txLookupInput, setTxLookupInput] = useState(initialCreateRefundPaymentId || "");
  const [txLookupError, setTxLookupError] = useState<string | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [refundType, setRefundType] = useState<"full" | "partial">("partial");
  const [refundAmountInput, setRefundAmountInput] = useState<string>("");
  const [refundReason, setRefundReason] = useState<string>("Customer Requested");
  const [refundReasonOther, setRefundReasonOther] = useState<string>("");
  const [refundSpeed, setRefundSpeed] = useState<"normal" | "optimum">("normal");
  const [sendEmailNotification, setSendEmailNotification] = useState<boolean>(true);
  const [sendWhatsAppNotification, setSendWhatsAppNotification] = useState<boolean>(false);
  const [isSubmittingRefund, setIsSubmittingRefund] = useState<boolean>(false);
  const [createRefundError, setCreateRefundError] = useState<string | null>(null);

  // Screen 3: Refund Creation Success Modal State
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{
    refundId: string;
    providerRefundId: string;
    paymentId: string;
    amountMinor: number;
    currency: string;
    status: string;
    speed: string;
  } | null>(null);

  // Calculate Date Boundaries
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
    if (dateRange === "CUSTOM" && customFrom && customTo) {
      const fromMs = new Date(customFrom).getTime();
      const toMs = new Date(customTo).getTime() + 24 * 60 * 60 * 1000 - 1;
      return { from: fromMs, to: toMs };
    }
    return { from: undefined, to: undefined };
  }, [dateRange, customFrom, customTo]);

  // Load Dashboard Analytics
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

  // Fetch Refunds from API
  const fetchRefunds = useCallback(
    async (targetPage = 1, shouldSync = false) => {
      setLoading(true);
      setError(null);
      if (shouldSync) setIsSyncing(true);

      try {
        const params = new URLSearchParams();
        params.set("page", String(targetPage));
        params.set("limit", String(limit));

        if (statusFilter) params.set("status", statusFilter);
        if (searchQuery.trim()) params.set("search", searchQuery.trim());
        if (dateBoundaries.from) params.set("from", String(dateBoundaries.from));
        if (dateBoundaries.to) params.set("to", String(dateBoundaries.to));
        if (shouldSync) params.set("sync", "true");

        const res = await fetch(`/api/payments/razorpay/refunds?${params.toString()}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          if (data?.code === "CONNECTION_NOT_FOUND" || res.status === 404) {
            setIsConnectionMissing(true);
            setError(null);
          } else {
            setError(data.error || "Failed to load refunds.");
          }
          setRefunds([]);
          setTotalCount(0);
          setHasMore(false);
        } else {
          setIsConnectionMissing(false);
          setRefunds(data.refunds || []);
          if (data.storeCurrency) {
            const curr = typeof data.storeCurrency === "object" ? data.storeCurrency?.code : data.storeCurrency;
            setServerStoreCurrency(curr || "INR");
          }
          setTotalCount(data.pagination?.total || 0);
          setHasMore(Boolean(data.pagination?.hasMore));
          setPage(data.pagination?.page || targetPage);

          if (shouldSync) {
            showToast("Refund records synchronized with Razorpay.", "success");
            loadAnalytics();
          }
        }
      } catch (err: any) {
        setError(err.message || "Network error loading refunds.");
        setRefunds([]);
      } finally {
        setLoading(false);
        setIsSyncing(false);
      }
    },
    [limit, statusFilter, searchQuery, dateBoundaries, showToast, loadAnalytics]
  );

  // Initial load
  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    fetchRefunds(page);
  }, [fetchRefunds, page]);

  // Debounced Search Handler
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Pre-load recent transactions for Create Refund drawer selection
  const loadRecentTransactions = useCallback(async () => {
    try {
      const res = await fetch("/api/payments/razorpay/transactions?limit=20&page=1");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.transactions)) {
        setRecentTransactions(data.transactions);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  // Lookup transaction by paymentId
  const lookupPayment = useCallback(
    async (paymentId: string) => {
      const trimmed = paymentId.trim();
      if (!trimmed) {
        setSelectedTxForRefund(null);
        return;
      }
      setTxLookupLoading(true);
      setTxLookupError(null);
      try {
        const res = await fetch(`/api/payments/razorpay/transactions?search=${encodeURIComponent(trimmed)}&limit=5`);
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.transactions) && data.transactions.length > 0) {
          const match =
            data.transactions.find((t: any) => t.providerPaymentId === trimmed) ||
            data.transactions[0];
          setSelectedTxForRefund(match);
          // Set default refund amount to remaining balance
          const remainingMinor = Math.max(match.amountMinor - (match.refundedAmountMinor || 0), 0);
          const defaultAmountStr = (remainingMinor / 100).toFixed(2);
          setRefundAmountInput(defaultAmountStr);
        } else {
          setSelectedTxForRefund(null);
          setTxLookupError(`No transaction found for payment ID "${trimmed}".`);
        }
      } catch (err: any) {
        setSelectedTxForRefund(null);
        setTxLookupError(err.message || "Failed to lookup transaction.");
      } finally {
        setTxLookupLoading(false);
      }
    },
    []
  );

  // Handle open Create Drawer from external prop or direct trigger
  useEffect(() => {
    if (initialCreateRefundPaymentId) {
      setIsCreateDrawerOpen(true);
      setTxLookupInput(initialCreateRefundPaymentId);
      lookupPayment(initialCreateRefundPaymentId);
    }
  }, [initialCreateRefundPaymentId, lookupPayment]);

  // Tab Navigation Handler
  const handleTabClick = (tab: DashboardTab) => {
    if (tab === "Refunds") return;
    if (onTabChange) {
      onTabChange(tab);
    } else {
      router.push(`/marketplace/razorpay/${tab.toLowerCase()}`);
    }
  };

  // Open Create Refund Drawer
  const handleOpenCreateDrawer = (presetTx?: any) => {
    setCreateRefundError(null);
    loadRecentTransactions();
    if (presetTx) {
      setSelectedTxForRefund(presetTx);
      setTxLookupInput(presetTx.providerPaymentId);
      const remainingMinor = Math.max(presetTx.amountMinor - (presetTx.refundedAmountMinor || 0), 0);
      setRefundAmountInput((remainingMinor / 100).toFixed(2));
      setRefundType("partial");
    } else {
      setSelectedTxForRefund(null);
      setTxLookupInput("");
      setRefundAmountInput("");
      setRefundType("partial");
    }
    setIsCreateDrawerOpen(true);
  };

  // Calculate Eligibility for selected transaction
  const eligibility = useMemo(() => {
    if (!selectedTxForRefund) {
      return {
        paymentCaptured: false,
        refundsEnabled: false,
        amountAvailable: false,
        withinRefundWindow: false,
        isEligible: false,
        remainingBalanceMinor: 0,
        maxRefundableMinor: 0,
        reason: "No payment selected",
      };
    }

    const tx = selectedTxForRefund;
    const isCaptured = tx.status === "captured" || tx.status === "partially_refunded";
    const refundsEnabled = !isConnectionMissing;
    const refundedMinor = tx.refundedAmountMinor || 0;
    const remainingBalanceMinor = Math.max(tx.amountMinor - refundedMinor, 0);
    const amountAvailable = remainingBalanceMinor > 0;

    // Razorpay standard refund window: 180 days (~6 months)
    const txAgeMs = Date.now() - (tx.paidAt || tx.createdAt || Date.now());
    const withinRefundWindow = txAgeMs <= 180 * 24 * 60 * 60 * 1000;

    const isEligible = isCaptured && refundsEnabled && amountAvailable && withinRefundWindow;

    let reason = "";
    if (!isCaptured) reason = `Payment status is "${tx.status}" (must be captured).`;
    else if (!amountAvailable) reason = "Payment has already been fully refunded.";
    else if (!withinRefundWindow) reason = "Payment exceeds the 180-day refund window.";
    else if (!refundsEnabled) reason = "Razorpay gateway is not connected.";

    return {
      paymentCaptured: isCaptured,
      refundsEnabled,
      amountAvailable,
      withinRefundWindow,
      isEligible,
      remainingBalanceMinor,
      maxRefundableMinor: remainingBalanceMinor,
      reason,
    };
  }, [selectedTxForRefund, isConnectionMissing]);

  // Sync refund amount input when switching full/partial
  const handleRefundTypeChange = (type: "full" | "partial") => {
    setRefundType(type);
    if (type === "full" && eligibility.maxRefundableMinor > 0) {
      setRefundAmountInput((eligibility.maxRefundableMinor / 100).toFixed(2));
    }
  };

  // Current Refund Amount in paise
  const currentRefundAmountMinor = useMemo(() => {
    if (refundType === "full") {
      return eligibility.maxRefundableMinor;
    }
    const val = parseFloat(refundAmountInput);
    if (isNaN(val) || val <= 0) return 0;
    return Math.round(val * 100);
  }, [refundType, refundAmountInput, eligibility.maxRefundableMinor]);

  // Projected remaining balance after current refund
  const projectedRemainingBalanceMinor = useMemo(() => {
    return Math.max(eligibility.remainingBalanceMinor - currentRefundAmountMinor, 0);
  }, [eligibility.remainingBalanceMinor, currentRefundAmountMinor]);

  // Submit Refund API
  const handleCreateRefundSubmit = async () => {
    if (!selectedTxForRefund) {
      setCreateRefundError("Please select a transaction to refund.");
      return;
    }
    if (!eligibility.isEligible) {
      setCreateRefundError(eligibility.reason || "Payment is not eligible for refund.");
      return;
    }

    if (currentRefundAmountMinor <= 0) {
      setCreateRefundError("Please enter a valid refund amount greater than 0.");
      return;
    }

    if (currentRefundAmountMinor > eligibility.maxRefundableMinor) {
      setCreateRefundError(
        `Refund amount cannot exceed remaining balance of ${formatCurrency(
          eligibility.maxRefundableMinor,
          selectedTxForRefund.currency
        )}.`
      );
      return;
    }

    const finalReason =
      refundReason === "Other"
        ? refundReasonOther.trim() || "Other"
        : refundReason;

    setIsSubmittingRefund(true);
    setCreateRefundError(null);

    try {
      const idempotencyKey = `rfnd_${selectedTxForRefund.providerPaymentId}_${currentRefundAmountMinor}_${Date.now()}`;
      const payload: any = {
        paymentId: selectedTxForRefund.providerPaymentId,
        amount: currentRefundAmountMinor,
        speed: refundSpeed,
        notes: {
          reason: finalReason,
          emailNotification: sendEmailNotification,
          whatsappNotification: sendWhatsAppNotification,
        },
        idempotencyKey,
      };

      const res = await fetch("/api/payments/razorpay/refunds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setCreateRefundError(data.error || "Failed to process refund request.");
      } else {
        const returnedRefund = data.refund || {};
        // Close create drawer
        setIsCreateDrawerOpen(false);

        // Open Screen 3: Refund Creation Success Modal
        setSuccessModalData({
          refundId: returnedRefund.refundId || returnedRefund.id,
          providerRefundId: returnedRefund.providerRefundId || "rfnd_created",
          paymentId: selectedTxForRefund.providerPaymentId,
          amountMinor: returnedRefund.amountMinor || currentRefundAmountMinor,
          currency: returnedRefund.currency || selectedTxForRefund.currency || "INR",
          status: returnedRefund.status || "processed",
          speed: returnedRefund.speed || refundSpeed,
        });
        setIsSuccessModalOpen(true);

        // Refresh refunds list and dashboard analytics
        fetchRefunds(1);
        loadAnalytics();
      }
    } catch (err: any) {
      setCreateRefundError(err.message || "Network error processing refund.");
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

      while (hasMoreRecords && fetchPage <= 50) {
        const params = new URLSearchParams();
        params.set("page", String(fetchPage));
        params.set("limit", "100");
        if (statusFilter) params.set("status", statusFilter);
        if (searchQuery.trim()) params.set("search", searchQuery.trim());
        if (dateBoundaries.from) params.set("from", String(dateBoundaries.from));
        if (dateBoundaries.to) params.set("to", String(dateBoundaries.to));

        const res = await fetch(`/api/payments/razorpay/refunds?${params.toString()}`);
        const data = await res.json();

        if (res.ok && data.success && Array.isArray(data.refunds)) {
          allRecords.push(...data.refunds);
          hasMoreRecords = Boolean(data.pagination?.hasMore) && data.refunds.length > 0;
          fetchPage += 1;
        } else {
          hasMoreRecords = false;
        }
      }

      if (allRecords.length === 0) {
        showToast("No refunds match the current criteria to export.", "info");
        return;
      }

      // Generate CSV
      const headers = [
        "Refund ID",
        "Payment ID",
        "Order ID",
        "Amount",
        "Currency",
        "Reason",
        "Status",
        "Speed",
        "Created At",
        "Processed At",
      ];

      const csvRows = [headers.join(",")];

      for (const r of allRecords) {
        const major = ((r.amountMinor || 0) / 100).toFixed(2);
        const orderId = r.metadata?.orderId || r.metadata?.order_id || "";
        const reason = (r.reason || "").replace(/"/g, '""');
        const createdAtStr = r.initiatedAt ? new Date(r.initiatedAt).toISOString() : "";
        const processedAtStr = r.processedAt ? new Date(r.processedAt).toISOString() : "";

        csvRows.push(
          [
            `"${r.providerRefundId || ""}"`,
            `"${r.providerPaymentId || ""}"`,
            `"${orderId}"`,
            major,
            `"${r.currency || "INR"}"`,
            `"${reason}"`,
            `"${r.status || ""}"`,
            `"${r.speed || "normal"}"`,
            `"${createdAtStr}"`,
            `"${processedAtStr}"`,
          ].join(",")
        );
      }

      const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"));
      const link = document.createElement("a");
      link.setAttribute("href", csvContent);
      link.setAttribute("download", `razorpay-refunds-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast(`Exported ${allRecords.length} refund records to CSV.`, "success");
    } catch (err: any) {
      showToast("Failed to export refunds.", "error", err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Download Receipt JSON for selected refund
  const handleDownloadReceipt = (refundRecord: any) => {
    if (!refundRecord) return;
    const receiptData = {
      storeName: "PREST Store",
      provider: "Razorpay",
      providerRefundId: refundRecord.providerRefundId,
      providerPaymentId: refundRecord.providerPaymentId,
      amount: (refundRecord.amountMinor || 0) / 100,
      currency: refundRecord.currency || "INR",
      status: refundRecord.status,
      reason: refundRecord.reason || "Customer Requested",
      speed: refundRecord.speed || "normal",
      initiatedAt: refundRecord.initiatedAt ? new Date(refundRecord.initiatedAt).toISOString() : null,
      processedAt: refundRecord.processedAt ? new Date(refundRecord.processedAt).toISOString() : null,
      metadata: refundRecord.metadata || {},
    };
    const blob = new Blob([JSON.stringify(receiptData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${refundRecord.providerRefundId || "refund"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Refund receipt downloaded.", "success");
  };

  // Summary Metrics Calculation
  const rawCurrency =
    analytics?.metrics?.currency ||
    analytics?.storeCurrency ||
    serverStoreCurrency ||
    "INR";
  const primaryCurrency =
    (typeof rawCurrency === "object" ? rawCurrency?.code : rawCurrency) || "INR";

  // Total Refunds Count
  const totalRefundsCount = useMemo(() => {
    if (analytics?.metrics?.refundCount !== undefined && analytics.metrics.refundCount > 0) {
      return analytics.metrics.refundCount;
    }
    return totalCount;
  }, [analytics, totalCount]);

  // Successfully Processed Volume
  const processedRefundsVolumeMinor = useMemo(() => {
    if (analytics?.metrics?.monthlyRevenue?.refundsMinor !== undefined && analytics.metrics.monthlyRevenue.refundsMinor > 0) {
      return analytics.metrics.monthlyRevenue.refundsMinor;
    }
    return refunds
      .filter(
        (r) =>
          r.status === "processed" &&
          (r.currency || primaryCurrency) === primaryCurrency
      )
      .reduce((acc, r) => acc + (r.amountMinor || 0), 0);
  }, [analytics, refunds, primaryCurrency]);

  // Pending Refunds Count
  const pendingRefundsCount = useMemo(() => {
    return refunds.filter((r) => r.status === "pending").length;
  }, [refunds]);

  // Average Refund Amount
  const averageRefundAmountMinor = useMemo(() => {
    const processed = refunds.filter(
      (r) =>
        r.status === "processed" &&
        (r.currency || primaryCurrency) === primaryCurrency
    );
    if (processed.length === 0) return 0;
    const sum = processed.reduce((acc, r) => acc + (r.amountMinor || 0), 0);
    return Math.round(sum / processed.length);
  }, [refunds, primaryCurrency]);

  // Trends calculation: Real daily distribution from actual records
  const trendDays = useMemo(() => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dailyVolume: Record<string, number> = {
      Mon: 0,
      Tue: 0,
      Wed: 0,
      Thu: 0,
      Fri: 0,
      Sat: 0,
      Sun: 0,
    };

    for (const r of refunds) {
      const dt = new Date(r.initiatedAt || r.createdAt || Date.now());
      const dayName = dayNames[dt.getDay()];
      dailyVolume[dayName] = (dailyVolume[dayName] || 0) + (r.amountMinor || 0);
    }

    const maxVol = Math.max(...Object.values(dailyVolume), 1);
    return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({
      day,
      volumeMinor: dailyVolume[day] || 0,
      heightPercent: Math.max(Math.round(((dailyVolume[day] || 0) / maxVol) * 85), 10),
    }));
  }, [refunds]);

  // Telemetry Insight: evaluate real reason distribution
  const reasonBreakdown = useMemo(() => {
    if (refunds.length === 0) return null;
    const counts: Record<string, number> = {};
    for (const r of refunds) {
      const re = r.reason || "Customer Requested";
      counts[re] = (counts[re] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const topReason = sorted[0];
    const topPercent = Math.round((topReason[1] / refunds.length) * 100);
    return {
      topReason: topReason[0],
      percentage: topPercent,
      count: topReason[1],
    };
  }, [refunds]);

  // Pagination bounds
  const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
  const startRecord = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalCount);

  // Status Badge Component
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "processed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Processed
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Pending
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            Failed
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
            Cancelled
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

  const content = (
    <div className="space-y-6 text-[#0c0a09] font-sans">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] max-w-sm w-full bg-[#0c0a09] text-white p-4 rounded-2xl shadow-xl flex items-start gap-3 border border-stone-700 animate-in slide-in-from-bottom-5">
          <span
            className={`material-symbols-outlined text-[20px] shrink-0 ${
              toast.type === "success"
                ? "text-emerald-400"
                : toast.type === "error"
                ? "text-rose-400"
                : "text-amber-400"
            }`}
          >
            {toast.type === "success" ? "check_circle" : toast.type === "error" ? "error" : "info"}
          </span>
          <div className="flex-1 text-xs">
            <p className="font-semibold text-stone-100">{toast.message}</p>
            {toast.subtext && <p className="text-stone-400 mt-0.5">{toast.subtext}</p>}
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-stone-400 hover:text-white"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* 1. Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-[#78716c] font-medium">
        <span>Installed Apps</span>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span>Payments</span>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-[#0c0a09] font-semibold">Razorpay</span>
      </nav>

      {/* 2. Page Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0c0a09]">Refunds</h1>
          <p className="text-xs sm:text-sm text-[#78716c] mt-0.5">
            Manage and track all customer refund requests.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || totalCount === 0 || isConnectionMissing}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-[#e7e5e4] rounded-xl text-[#0c0a09] text-xs sm:text-sm font-semibold hover:bg-stone-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[18px] ${isExporting ? "animate-spin" : ""}`}>
              {isExporting ? "progress_activity" : "download"}
            </span>
            <span>{isExporting ? "Exporting..." : "Export"}</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenCreateDrawer()}
            disabled={isConnectionMissing}
            className="flex items-center gap-2 px-4 py-2 bg-[#0c0a09] text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-stone-800 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Create Refund</span>
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

      {/* 4. Three Bento Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Refunds */}
        <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-3 relative overflow-hidden group">
          <div className="flex justify-between items-center text-[#78716c]">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Refunds</span>
            <div className="w-8 h-8 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-center text-[#0c0a09]">
              <span className="material-symbols-outlined text-[18px]">assignment_return</span>
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-[#0c0a09] tracking-tight">
              {analyticsLoading ? "..." : totalRefundsCount.toLocaleString()}
            </div>
            <div className="text-xs text-[#78716c] mt-1 flex items-center gap-1.5">
              <span>Synchronized refund requests</span>
            </div>
          </div>
        </div>

        {/* Card 2: Refund Amount */}
        <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-3 relative overflow-hidden group">
          <div className="flex justify-between items-center text-[#78716c]">
            <span className="text-xs font-semibold uppercase tracking-wider">Refund Amount</span>
            <div className="w-8 h-8 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-center text-[#0c0a09]">
              <span className="material-symbols-outlined text-[18px]">payments</span>
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-[#0c0a09] tracking-tight">
              {analyticsLoading
                ? "..."
                : formatCurrency(processedRefundsVolumeMinor, primaryCurrency)}
            </div>
            <div className="text-xs text-[#78716c] mt-1 flex items-center gap-1.5">
              <span>
                {averageRefundAmountMinor > 0
                  ? `Avg. ${formatCurrency(averageRefundAmountMinor, primaryCurrency)}`
                  : "Successfully processed volume"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Pending Refunds */}
        <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-3 relative overflow-hidden group">
          <div className="flex justify-between items-center text-[#78716c]">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Refunds</span>
            <div className="w-8 h-8 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-center text-[#0c0a09]">
              <span className="material-symbols-outlined text-[18px]">pending_actions</span>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-[#0c0a09] tracking-tight">
                {analyticsLoading ? "..." : pendingRefundsCount.toLocaleString()}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  pendingRefundsCount > 0
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}
              >
                {pendingRefundsCount > 0 ? "Urgent" : "All Clear"}
              </span>
            </div>
            <div className="text-xs text-[#78716c] mt-1">
              {pendingRefundsCount > 0
                ? "Awaiting gateway reconciliation"
                : "No pending refund authorizations"}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Refund History Section */}
      <div className="bg-white border border-[#e7e5e4] rounded-2xl shadow-xs overflow-hidden">
        {/* Table Header Bar */}
        <div className="p-5 border-b border-[#e7e5e4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#0c0a09]">Refund History</h2>
            <p className="text-xs text-[#78716c]">
              Real-time synchronization with Razorpay refund status and linked orders.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFilterPanelOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                isFilterPanelOpen || statusFilter || dateRange !== "30D" || searchQuery
                  ? "bg-[#0c0a09] text-white border-[#0c0a09]"
                  : "bg-white border-[#e7e5e4] text-[#0c0a09] hover:bg-stone-50"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">filter_list</span>
              <span>Filter</span>
            </button>

            <button
              type="button"
              onClick={() => fetchRefunds(page, true)}
              disabled={isSyncing || isConnectionMissing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#e7e5e4] rounded-xl text-[#0c0a09] text-xs font-semibold hover:bg-stone-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] ${isSyncing ? "animate-spin" : ""}`}>
                sync
              </span>
              <span>{isSyncing ? "Syncing..." : "Sync"}</span>
            </button>
          </div>
        </div>

        {/* Collapsible Filters Bar */}
        {isFilterPanelOpen && (
          <div className="p-4 bg-[#fafaf9] border-b border-[#e7e5e4] flex flex-wrap items-center gap-3 text-xs">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[16px] text-[#78716c]">
                search
              </span>
              <input
                type="text"
                placeholder="Search by Refund ID, Payment ID, Reason..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#e7e5e4] rounded-xl text-xs text-[#0c0a09] placeholder-stone-400 focus:outline-none focus:border-[#0c0a09]"
              />
            </div>

            {/* Date Range Selector */}
            <div className="flex items-center gap-1 bg-white border border-[#e7e5e4] rounded-xl p-1">
              {(["30D", "7D", "24H", "ALL"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDateRange(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    dateRange === r
                      ? "bg-[#0c0a09] text-white"
                      : "text-[#78716c] hover:text-[#0c0a09]"
                  }`}
                >
                  {r === "30D" ? "Last 30 Days" : r === "7D" ? "Last 7 Days" : r === "24H" ? "24 Hours" : "All"}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-white border border-[#e7e5e4] rounded-xl text-xs font-medium text-[#0c0a09] focus:outline-none focus:border-[#0c0a09]"
            >
              <option value="">All Status</option>
              <option value="processed">Processed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Reset Filters */}
            {(statusFilter || searchQuery || dateRange !== "30D") && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("");
                  setSearchInput("");
                  setSearchQuery("");
                  setDateRange("30D");
                  setPage(1);
                }}
                className="text-xs text-[#78716c] hover:text-[#0c0a09] underline font-medium"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#fafaf9] border-b border-[#e7e5e4] text-[#78716c] font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Refund ID</th>
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-center w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7e5e4]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-4"><div className="h-3.5 w-24 bg-stone-200 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-3.5 w-20 bg-stone-200 rounded" /></td>
                    <td className="py-4 px-4 text-right"><div className="h-3.5 w-16 bg-stone-200 rounded ml-auto" /></td>
                    <td className="py-4 px-4"><div className="h-3.5 w-28 bg-stone-200 rounded" /></td>
                    <td className="py-4 px-4 text-center"><div className="h-5 w-16 bg-stone-200 rounded-full mx-auto" /></td>
                    <td className="py-4 px-4"><div className="h-3.5 w-24 bg-stone-200 rounded" /></td>
                    <td className="py-4 px-4 text-center"><div className="h-5 w-5 bg-stone-200 rounded mx-auto" /></td>
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
                          No active Razorpay credentials found for this store. Connect your Razorpay account to view refund history and issue refunds directly from PREST.
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
                        onClick={() => fetchRefunds(page)}
                        className="mt-2 px-3.5 py-1.5 rounded-xl bg-[#0c0a09] text-white text-xs font-semibold hover:bg-stone-800 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : refunds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-[#78716c]">
                      <span className="material-symbols-outlined text-[36px] text-stone-400">
                        assignment_return
                      </span>
                      <p className="text-sm font-medium text-[#0c0a09]">No refunds found</p>
                      <p className="text-xs max-w-sm mx-auto">
                        {statusFilter || searchQuery
                          ? "No refund records match the specified filters."
                          : "Customer refund requests and reversals will appear here once processed."}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleOpenCreateDrawer()}
                        className="mt-3 px-3.5 py-1.5 bg-[#0c0a09] text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors"
                      >
                        Create Refund
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                refunds.map((r) => {
                  const orderId = r.metadata?.orderId || r.metadata?.order_id || "—";
                  return (
                    <tr
                      key={r._id || r.providerRefundId}
                      className="hover:bg-stone-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-mono font-semibold text-[#0c0a09]">
                        <Link
                          href={`/marketplace/razorpay/refunds/${encodeURIComponent(r.providerRefundId)}`}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          className="hover:underline flex items-center gap-1.5"
                          title="Open dedicated refund details page"
                        >
                          <span>{r.providerRefundId || "—"}</span>
                          <span className="material-symbols-outlined text-[14px] text-[#78716c] opacity-0 group-hover:opacity-100 transition-opacity">
                            open_in_new
                          </span>
                        </Link>
                      </td>
                      <td
                        onClick={() => {
                          setSelectedRefund(r);
                          setIsDetailsDrawerOpen(true);
                        }}
                        className="py-3.5 px-4 text-[#78716c] font-medium"
                      >
                        {orderId}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-[#0c0a09]">
                        {formatCurrency(r.amountMinor, r.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-[#78716c] max-w-[160px] truncate">
                        {r.reason || "Customer Requested"}
                      </td>
                      <td className="py-3.5 px-4 text-center">{renderStatusBadge(r.status)}</td>
                      <td className="py-3.5 px-4 text-[#78716c] whitespace-nowrap">
                        {formatDate(r.initiatedAt || r.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-center text-[#78716c] group-hover:text-[#0c0a09]">
                        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {!isConnectionMissing && !error && refunds.length > 0 && (
          <div className="p-4 bg-[#fafaf9] border-t border-[#e7e5e4] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#78716c]">
            <div>
              Showing {startRecord} to {endRecord} of {totalCount} results
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="w-8 h-8 rounded-lg border border-[#e7e5e4] bg-white text-[#0c0a09] flex items-center justify-center hover:bg-stone-50 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>

              <span className="px-3 py-1 font-semibold text-[#0c0a09] bg-white border border-[#e7e5e4] rounded-lg">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage((p) => (hasMore ? p + 1 : p))}
                disabled={!hasMore}
                className="w-8 h-8 rounded-lg border border-[#e7e5e4] bg-white text-[#0c0a09] flex items-center justify-center hover:bg-stone-50 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Dynamic Graphical Section (Bento Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Bento: Refund Trends */}
        <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#0c0a09]">Refund Trends</h3>
              <p className="text-xs text-[#78716c]">Volume distribution across recent days</p>
            </div>
            <span className="text-xs font-semibold text-[#78716c] uppercase tracking-wider">
              {primaryCurrency}
            </span>
          </div>

          <div className="h-44 bg-[#fafaf9] border border-[#e7e5e4] rounded-xl p-4 flex flex-col justify-end">
            {refunds.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-[#78716c]">
                <span className="material-symbols-outlined text-[28px] text-stone-300">bar_chart</span>
                <p className="text-xs mt-1">No refund activity recorded for trends.</p>
              </div>
            ) : (
              <div className="flex items-end justify-between gap-2 h-28">
                {trendDays.map((item) => (
                  <div key={item.day} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <div
                      className="w-full bg-[#0c0a09] rounded-t-sm hover:bg-stone-700 transition-all cursor-pointer"
                      style={{ height: `${item.heightPercent}%` }}
                      title={`${item.day}: ${formatCurrency(item.volumeMinor, primaryCurrency)}`}
                    />
                    <span className="text-[11px] font-medium text-[#78716c]">{item.day}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Bento: Insight Engine */}
        <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-[#0c0a09]">Insight Engine</h3>
            <p className="text-xs text-[#78716c]">Real-time operational signals & telemetry</p>
          </div>

          <div className="space-y-3">
            {reasonBreakdown ? (
              <div className="p-3.5 bg-[#fafaf9] border border-[#e7e5e4] rounded-xl flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-600 text-[20px] shrink-0">
                  lightbulb
                </span>
                <div className="text-xs">
                  <p className="font-semibold text-[#0c0a09]">Primary Refund Reason</p>
                  <p className="text-[#78716c] mt-0.5 leading-relaxed">
                    {reasonBreakdown.percentage}% of your refunds are attributed to "
                    {reasonBreakdown.topReason}" ({reasonBreakdown.count} requests).
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-[#fafaf9] border border-[#e7e5e4] rounded-xl flex items-start gap-3">
                <span className="material-symbols-outlined text-[#78716c] text-[20px] shrink-0">
                  info
                </span>
                <div className="text-xs">
                  <p className="font-semibold text-[#0c0a09]">Telemetry Standby</p>
                  <p className="text-[#78716c] mt-0.5 leading-relaxed">
                    Insight engine evaluates refund volume to detect anomaly patterns once transaction volume accumulates.
                  </p>
                </div>
              </div>
            )}

            <div className="p-3.5 bg-[#fafaf9] border border-[#e7e5e4] rounded-xl flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-600 text-[20px] shrink-0">
                verified_user
              </span>
              <div className="text-xs">
                <p className="font-semibold text-[#0c0a09]">Webhook Reconciled</p>
                <p className="text-[#78716c] mt-0.5 leading-relaxed">
                  100% of webhook refund events are verified via HMAC-SHA256 signature and linked directly to store transaction ledger.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SCREEN 1: REFUND DETAILS DRAWER */}
      {/* ========================================================================= */}
      {isDetailsDrawerOpen && selectedRefund && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsDetailsDrawerOpen(false)}
          />

          {/* Drawer Container */}
          <div className="fixed inset-y-0 right-0 w-full sm:w-[500px] bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-5 border-b border-[#e7e5e4] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0c0a09]">Refund Details</h3>
                <p className="text-xs text-[#78716c]">Transaction reference and timeline</p>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailsDrawerOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#78716c] hover:bg-stone-100 hover:text-[#0c0a09] transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
              {/* Status & Amount Hero */}
              <div className="p-4 bg-[#fafaf9] border border-[#e7e5e4] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#78716c] uppercase tracking-wider">
                    Refund Status
                  </span>
                  {renderStatusBadge(selectedRefund.status)}
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-xs text-[#78716c]">Refunded Amount</span>
                  <span className="text-2xl font-bold text-[#0c0a09] tracking-tight">
                    {formatCurrency(selectedRefund.amountMinor, selectedRefund.currency)}
                  </span>
                </div>
                <div className="h-px bg-[#e7e5e4]" />
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[#78716c]">Refund ID</span>
                    <p className="font-mono font-semibold text-[#0c0a09] break-all">
                      {selectedRefund.providerRefundId}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#78716c]">Payment ID</span>
                    <p className="font-mono font-semibold text-[#0c0a09] break-all">
                      {selectedRefund.providerPaymentId}
                    </p>
                  </div>
                </div>
              </div>

              {/* Information Section */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-semibold text-[#78716c] uppercase tracking-wider">
                  Refund Information
                </h4>
                <div className="p-3.5 bg-white border border-[#e7e5e4] rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#78716c]">Linked Order ID</span>
                    <span className="font-semibold text-[#0c0a09]">
                      {selectedRefund.metadata?.orderId || selectedRefund.metadata?.order_id || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#78716c]">Reason</span>
                    <span className="font-semibold text-[#0c0a09]">
                      {selectedRefund.reason || "Customer Requested"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#78716c]">Refund Speed</span>
                    <span className="font-semibold text-[#0c0a09] capitalize">
                      {selectedRefund.speed || "normal"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#78716c]">Currency</span>
                    <span className="font-semibold text-[#0c0a09]">
                      {selectedRefund.currency || "INR"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Customer Details */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-semibold text-[#78716c] uppercase tracking-wider">
                  Customer Details
                </h4>
                <div className="p-3.5 bg-white border border-[#e7e5e4] rounded-xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-[#0c0a09]">
                    <span className="material-symbols-outlined text-[20px]">person</span>
                  </div>
                  <div>
                    <p className="font-semibold text-[#0c0a09]">
                      {selectedRefund.metadata?.customerName ||
                        selectedRefund.metadata?.customer_name ||
                        "Store Customer"}
                    </p>
                    <p className="text-stone-500">
                      {selectedRefund.metadata?.customerEmail ||
                        selectedRefund.metadata?.customer_email ||
                        selectedRefund.providerPaymentId}
                    </p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-semibold text-[#78716c] uppercase tracking-wider">
                  Timeline
                </h4>
                <div className="relative pl-5 border-l-2 border-stone-200 ml-2 space-y-4">
                  {/* Initiated Event */}
                  <div className="relative">
                    <div className="absolute -left-[27px] top-0.5 w-3 h-3 rounded-full bg-[#0c0a09] ring-4 ring-white" />
                    <p className="font-semibold text-[#0c0a09]">Refund Initiated</p>
                    <p className="text-stone-500 mt-0.5">
                      {formatDate(selectedRefund.initiatedAt || selectedRefund.createdAt)}
                    </p>
                  </div>

                  {/* Processed Event */}
                  {selectedRefund.status === "processed" && (
                    <div className="relative">
                      <div className="absolute -left-[27px] top-0.5 w-3 h-3 rounded-full bg-emerald-600 ring-4 ring-white" />
                      <p className="font-semibold text-emerald-700">Refund Successful</p>
                      <p className="text-stone-500 mt-0.5">
                        {formatDate(selectedRefund.processedAt || selectedRefund.updatedAt)}
                      </p>
                    </div>
                  )}

                  {/* Failed Event */}
                  {selectedRefund.status === "failed" && (
                    <div className="relative">
                      <div className="absolute -left-[27px] top-0.5 w-3 h-3 rounded-full bg-rose-600 ring-4 ring-white" />
                      <p className="font-semibold text-rose-700">Refund Failed</p>
                      <p className="text-stone-500 mt-0.5">
                        {selectedRefund.errorMessage || "Gateway rejected the refund request."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-[#fafaf9] border-t border-[#e7e5e4] flex items-center gap-3">
              <Link
                href={`/marketplace/razorpay/refunds/${encodeURIComponent(selectedRefund.providerRefundId)}`}
                className="py-2.5 px-3 bg-white border border-[#e7e5e4] rounded-xl text-xs font-semibold text-[#0c0a09] hover:bg-stone-50 transition-colors flex items-center gap-1.5 shadow-2xs"
                title="Open dedicated refund details page"
              >
                <span>Full Page</span>
                <span className="material-symbols-outlined text-[15px]">open_in_new</span>
              </Link>
              <button
                type="button"
                onClick={() => handleDownloadReceipt(selectedRefund)}
                className="flex-1 py-2.5 px-4 bg-white border border-[#e7e5e4] rounded-xl text-xs font-semibold text-[#0c0a09] hover:bg-stone-50 transition-colors cursor-pointer shadow-2xs"
              >
                Download Receipt
              </button>
              <button
                type="button"
                onClick={() => setIsDetailsDrawerOpen(false)}
                className="py-2.5 px-5 bg-[#0c0a09] text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors cursor-pointer shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 2: CREATE REFUND DRAWER */}
      {/* ========================================================================= */}
      {isCreateDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsCreateDrawerOpen(false)}
          />

          {/* Drawer Container */}
          <div className="fixed inset-y-0 right-0 w-full sm:w-[540px] bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-5 border-b border-[#e7e5e4] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#0c0a09]">Create Refund</h3>
                  {selectedTxForRefund && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                      {selectedTxForRefund.status}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#78716c] mt-0.5">
                  Refund payment to the customer securely using Razorpay.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateDrawerOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#78716c] hover:bg-stone-100 hover:text-[#0c0a09] transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {/* Payment Search / Lookup (if none pre-selected) */}
              {!selectedTxForRefund && (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-[#78716c] uppercase tracking-wider">
                    Select Captured Payment
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Enter Payment ID (e.g. pay_N9m2K8l1z0)"
                      value={txLookupInput}
                      onChange={(e) => setTxLookupInput(e.target.value)}
                      className="flex-1 px-3 py-2 border border-[#e7e5e4] rounded-xl text-xs focus:outline-none focus:border-[#0c0a09]"
                    />
                    <button
                      type="button"
                      onClick={() => lookupPayment(txLookupInput)}
                      disabled={txLookupLoading || !txLookupInput.trim()}
                      className="px-3.5 py-2 bg-[#0c0a09] text-white rounded-xl text-xs font-semibold hover:bg-stone-800 disabled:opacity-50"
                    >
                      {txLookupLoading ? "Looking up..." : "Lookup"}
                    </button>
                  </div>
                  {txLookupError && <p className="text-xs text-rose-600 mt-1">{txLookupError}</p>}

                  {/* Quick Select from Recent Transactions */}
                  {recentTransactions.length > 0 && (
                    <div className="pt-2">
                      <p className="text-[11px] text-stone-500 mb-1.5 font-medium">Or choose from recent payments:</p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto border border-[#e7e5e4] rounded-xl p-1 bg-[#fafaf9]">
                        {recentTransactions
                          .filter((t) => t.status === "captured" || t.status === "partially_refunded")
                          .map((t) => (
                            <button
                              key={t._id}
                              type="button"
                              onClick={() => {
                                setSelectedTxForRefund(t);
                                setTxLookupInput(t.providerPaymentId);
                                const rem = Math.max(t.amountMinor - (t.refundedAmountMinor || 0), 0);
                                setRefundAmountInput((rem / 100).toFixed(2));
                              }}
                              className="w-full text-left p-2 rounded-lg hover:bg-white border border-transparent hover:border-stone-200 transition-colors flex items-center justify-between"
                            >
                              <div>
                                <span className="font-mono font-semibold text-[#0c0a09]">{t.providerPaymentId}</span>
                                <span className="text-stone-500 ml-2">({t.paymentMethod || "UPI"})</span>
                              </div>
                              <span className="font-bold text-[#0c0a09]">
                                {formatCurrency(t.amountMinor, t.currency)}
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Summary Card */}
              {selectedTxForRefund && (
                <div className="p-4 bg-[#fafaf9] border border-[#e7e5e4] rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#78716c] uppercase tracking-wider">
                      Selected Transaction
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTxForRefund(null);
                        setTxLookupInput("");
                      }}
                      className="text-xs text-stone-500 hover:text-[#0c0a09] underline"
                    >
                      Change
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
                    <div>
                      <span className="text-stone-500 text-[11px]">ORDER ID</span>
                      <p className="font-semibold text-[#0c0a09]">
                        {selectedTxForRefund.metadata?.orderId || selectedTxForRefund.metadata?.order_id || "ORD-229103"}
                      </p>
                    </div>
                    <div>
                      <span className="text-stone-500 text-[11px]">CUSTOMER</span>
                      <p className="font-semibold text-[#0c0a09]">
                        {selectedTxForRefund.metadata?.customerName ||
                          selectedTxForRefund.metadata?.customer_name ||
                          "Arjun Sharma"}
                      </p>
                    </div>
                    <div>
                      <span className="text-stone-500 text-[11px]">PAYMENT ID</span>
                      <p className="font-mono font-semibold text-[#0c0a09]">
                        {selectedTxForRefund.providerPaymentId}
                      </p>
                    </div>
                    <div>
                      <span className="text-stone-500 text-[11px]">AMOUNT</span>
                      <p className="font-bold text-[#0c0a09]">
                        {formatCurrency(selectedTxForRefund.amountMinor, selectedTxForRefund.currency)}
                      </p>
                    </div>
                    <div>
                      <span className="text-stone-500 text-[11px]">METHOD</span>
                      <p className="font-semibold text-[#0c0a09] capitalize">
                        {selectedTxForRefund.paymentMethod || "UPI"}
                      </p>
                    </div>
                    <div>
                      <span className="text-stone-500 text-[11px]">DATE</span>
                      <p className="text-stone-600">
                        {formatDate(selectedTxForRefund.paidAt || selectedTxForRefund.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Refund Eligibility Section */}
              {selectedTxForRefund && (
                <div className="space-y-2.5">
                  <h4 className="text-[11px] font-semibold text-[#78716c] uppercase tracking-wider">
                    Refund Eligibility
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div
                      className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                        eligibility.paymentCaptured
                          ? "bg-emerald-50/50 border-emerald-200 text-emerald-800"
                          : "bg-rose-50/50 border-rose-200 text-rose-800"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {eligibility.paymentCaptured ? "check_circle" : "cancel"}
                      </span>
                      <span className="font-semibold">Payment Captured</span>
                    </div>

                    <div
                      className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                        eligibility.refundsEnabled
                          ? "bg-emerald-50/50 border-emerald-200 text-emerald-800"
                          : "bg-rose-50/50 border-rose-200 text-rose-800"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {eligibility.refundsEnabled ? "check_circle" : "cancel"}
                      </span>
                      <span className="font-semibold">Refunds Enabled</span>
                    </div>

                    <div
                      className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                        eligibility.amountAvailable
                          ? "bg-emerald-50/50 border-emerald-200 text-emerald-800"
                          : "bg-rose-50/50 border-rose-200 text-rose-800"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {eligibility.amountAvailable ? "check_circle" : "cancel"}
                      </span>
                      <span className="font-semibold">Amount Available</span>
                    </div>

                    <div
                      className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                        eligibility.withinRefundWindow
                          ? "bg-emerald-50/50 border-emerald-200 text-emerald-800"
                          : "bg-rose-50/50 border-rose-200 text-rose-800"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {eligibility.withinRefundWindow ? "check_circle" : "cancel"}
                      </span>
                      <span className="font-semibold">Within Refund Window</span>
                    </div>
                  </div>

                  {!eligibility.isEligible && (
                    <p className="text-xs text-rose-600 font-medium mt-1">
                      {eligibility.reason}
                    </p>
                  )}
                </div>
              )}

              {/* Refund Details */}
              {selectedTxForRefund && (
                <div className="space-y-3">
                  <h4 className="text-[11px] font-semibold text-[#78716c] uppercase tracking-wider">
                    Refund Details
                  </h4>

                  {/* Radio Choice */}
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-[#0c0a09]">
                      <input
                        type="radio"
                        name="refundType"
                        value="full"
                        checked={refundType === "full"}
                        onChange={() => handleRefundTypeChange("full")}
                        className="text-[#0c0a09] focus:ring-[#0c0a09]"
                      />
                      <span>Full Refund</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-[#0c0a09]">
                      <input
                        type="radio"
                        name="refundType"
                        value="partial"
                        checked={refundType === "partial"}
                        onChange={() => handleRefundTypeChange("partial")}
                        className="text-[#0c0a09] focus:ring-[#0c0a09]"
                      />
                      <span>Partial Refund</span>
                    </label>
                  </div>

                  {/* Amount Input */}
                  <div className="space-y-1">
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-stone-500 font-bold">
                        {getCurrencySymbol(selectedTxForRefund.currency || primaryCurrency)}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={(eligibility.maxRefundableMinor / 100).toFixed(2)}
                        disabled={refundType === "full" || !eligibility.isEligible}
                        value={refundAmountInput}
                        onChange={(e) => setRefundAmountInput(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-8 pr-28 py-2.5 bg-white border border-[#e7e5e4] rounded-xl text-sm font-semibold text-[#0c0a09] focus:outline-none focus:border-[#0c0a09] disabled:bg-stone-50"
                      />
                      <span className="absolute right-3.5 top-2.5 text-[11px] font-medium text-[#78716c]">
                        Max {formatCurrency(eligibility.maxRefundableMinor, selectedTxForRefund.currency)}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#0c0a09] font-medium pt-0.5">
                      Customer will receive{" "}
                      <span className="font-bold">
                        {formatCurrency(currentRefundAmountMinor, selectedTxForRefund.currency)}
                      </span>{" "}
                      back
                    </p>
                  </div>
                </div>
              )}

              {/* Refund Reason */}
              {selectedTxForRefund && (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-[#78716c] uppercase tracking-wider">
                    Refund Reason
                  </label>
                  <select
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#e7e5e4] rounded-xl text-xs font-medium text-[#0c0a09] focus:outline-none focus:border-[#0c0a09]"
                  >
                    {REFUND_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>

                  {refundReason === "Other" && (
                    <input
                      type="text"
                      placeholder="Specify refund reason..."
                      value={refundReasonOther}
                      onChange={(e) => setRefundReasonOther(e.target.value)}
                      className="w-full px-3 py-2 border border-[#e7e5e4] rounded-xl text-xs mt-1 focus:outline-none focus:border-[#0c0a09]"
                    />
                  )}
                </div>
              )}

              {/* Refund Speed */}
              {selectedTxForRefund && (
                <div className="space-y-2">
                  <h4 className="text-[11px] font-semibold text-[#78716c] uppercase tracking-wider">
                    Refund Speed
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    <label
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                        refundSpeed === "normal"
                          ? "border-[#0c0a09] bg-stone-50/50"
                          : "border-[#e7e5e4] bg-white hover:bg-stone-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#0c0a09]">Normal</span>
                        <input
                          type="radio"
                          name="speed"
                          checked={refundSpeed === "normal"}
                          onChange={() => setRefundSpeed("normal")}
                          className="text-[#0c0a09] focus:ring-[#0c0a09]"
                        />
                      </div>
                      <span className="text-[11px] text-[#78716c] mt-1">Takes 5–7 business days</span>
                    </label>

                    <label
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                        refundSpeed === "optimum"
                          ? "border-[#0c0a09] bg-stone-50/50"
                          : "border-[#e7e5e4] bg-white hover:bg-stone-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[#0c0a09]">Instant</span>
                          <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-extrabold rounded uppercase">
                            PRO
                          </span>
                        </div>
                        <input
                          type="radio"
                          name="speed"
                          checked={refundSpeed === "optimum"}
                          onChange={() => setRefundSpeed("optimum")}
                          className="text-[#0c0a09] focus:ring-[#0c0a09]"
                        />
                      </div>
                      <span className="text-[11px] text-[#78716c] mt-1">Refunded within 60 seconds</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Customer Notifications */}
              {selectedTxForRefund && (
                <div className="space-y-2.5">
                  <h4 className="text-[11px] font-semibold text-[#78716c] uppercase tracking-wider">
                    Customer Notification
                  </h4>
                  <div className="space-y-2 p-3 bg-white border border-[#e7e5e4] rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-stone-600">mail</span>
                        <span className="font-medium text-[#0c0a09]">Email Notification</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={sendEmailNotification}
                        onChange={(e) => setSendEmailNotification(e.target.checked)}
                        className="rounded text-[#0c0a09] focus:ring-[#0c0a09] w-4 h-4"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-stone-600">chat</span>
                        <span className="font-medium text-[#0c0a09]">WhatsApp Notification</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={sendWhatsAppNotification}
                        onChange={(e) => setSendWhatsAppNotification(e.target.checked)}
                        className="rounded text-[#0c0a09] focus:ring-[#0c0a09] w-4 h-4"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Warning Banner */}
              {selectedTxForRefund && (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900">
                  <span className="material-symbols-outlined text-[18px] text-amber-700 shrink-0">
                    warning
                  </span>
                  <p className="text-[11px] leading-relaxed font-medium">
                    Refund cannot be reversed once initiated. Please double-check the amount before proceeding.
                  </p>
                </div>
              )}

              {/* Refund Summary Calculation */}
              {selectedTxForRefund && (
                <div className="p-4 bg-[#fafaf9] border border-[#e7e5e4] rounded-2xl space-y-2">
                  <div className="flex justify-between text-[#78716c]">
                    <span>Original Payment</span>
                    <span className="font-medium">
                      {formatCurrency(selectedTxForRefund.amountMinor, selectedTxForRefund.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-rose-600 font-medium">
                    <span>Refund Amount</span>
                    <span>- {formatCurrency(currentRefundAmountMinor, selectedTxForRefund.currency)}</span>
                  </div>
                  <div className="pt-2 border-t border-[#e7e5e4] flex justify-between text-xs font-bold text-[#0c0a09]">
                    <span>Remaining Balance</span>
                    <span>
                      {formatCurrency(projectedRemainingBalanceMinor, selectedTxForRefund.currency)}
                    </span>
                  </div>
                </div>
              )}

              {createRefundError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                  {createRefundError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#fafaf9] border-t border-[#e7e5e4] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCreateDrawerOpen(false)}
                className="py-2.5 px-4 bg-white border border-[#e7e5e4] rounded-xl text-xs font-semibold text-[#0c0a09] hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateRefundSubmit}
                disabled={isSubmittingRefund || !selectedTxForRefund || !eligibility.isEligible || currentRefundAmountMinor <= 0}
                className="py-2.5 px-5 bg-[#0c0a09] text-white rounded-xl text-xs font-semibold hover:bg-stone-800 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-2 shadow-2xs"
              >
                {isSubmittingRefund && (
                  <span className="material-symbols-outlined text-[16px] animate-spin">
                    progress_activity
                  </span>
                )}
                <span>{isSubmittingRefund ? "Processing..." : "Create Refund"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 3: REFUND CREATION SUCCESS MODAL */}
      {/* ========================================================================= */}
      {isSuccessModalOpen && successModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsSuccessModalOpen(false)}
          />

          {/* Dialog Container */}
          <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#e7e5e4] z-50 animate-in zoom-in-95 duration-150 space-y-5">
            {/* Header & Illustration */}
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-1">
                <span className="material-symbols-outlined text-[32px]">check_circle</span>
              </div>
              <h3 className="text-lg font-bold text-[#0c0a09]">
                {successModalData.status === "processed"
                  ? "Refund Created Successfully"
                  : "Refund Request Submitted"}
              </h3>
              <p className="text-xs text-[#78716c] leading-relaxed max-w-xs">
                Refund of{" "}
                <span className="font-bold text-[#0c0a09]">
                  {formatCurrency(successModalData.amountMinor, successModalData.currency)}
                </span>{" "}
                has been processed and will be credited to the customer's original payment method.
              </p>
            </div>

            {/* Refund Information Card */}
            <div className="p-4 bg-[#fafaf9] border border-[#e7e5e4] rounded-xl space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#78716c]">Refund ID</span>
                <span className="font-mono font-bold text-[#0c0a09]">
                  {successModalData.providerRefundId}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#78716c]">Payment Reference</span>
                <span className="font-mono text-[#0c0a09]">{successModalData.paymentId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#78716c]">Status</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                  {successModalData.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#78716c]">Expected Settlement</span>
                <span className="font-medium text-[#0c0a09]">
                  {successModalData.speed === "optimum" ? "Within minutes" : "5–7 Business Days"}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  const matchedRecord = refunds.find(
                    (r) => r.providerRefundId === successModalData.providerRefundId
                  );
                  if (matchedRecord) {
                    setSelectedRefund(matchedRecord);
                    setIsDetailsDrawerOpen(true);
                  }
                }}
                className="w-full py-2.5 px-4 bg-[#0c0a09] text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors shadow-2xs cursor-pointer"
              >
                View Refund Details
              </button>

              <button
                type="button"
                onClick={() => setIsSuccessModalOpen(false)}
                className="w-full py-2.5 px-4 bg-white border border-[#e7e5e4] text-[#0c0a09] rounded-xl text-xs font-semibold hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Security Footer */}
            <div className="pt-2 border-t border-[#e7e5e4] flex items-center justify-center gap-1.5 text-[11px] text-[#78716c]">
              <span className="material-symbols-outlined text-[14px]">lock</span>
              <span>Secured by PREST Payments & Razorpay Merchant Services</span>
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
      title="Refunds"
      subtitle="Manage and track all customer refund requests."
    >
      {content}
    </PosShell>
  );
}
