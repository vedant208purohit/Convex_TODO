"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PosShell } from "../PosShell";
import { Toast, type ToastMessage } from "../Toast";
import {
  razorpayDashboardMetrics,
  razorpayPaymentTrends,
  razorpayRecentTransactions,
  razorpayIntegrationStatus,
  type TrendBarPoint,
  type RazorpayTransactionItem,
} from "../../lib/mockRazorpayDashboardData";

interface RazorpayDashboardViewProps {
  embeddedInMarketplace?: boolean;
}

type DashboardTab =
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

export function RazorpayDashboardView({
  embeddedInMarketplace = false,
}: RazorpayDashboardViewProps) {
  const router = useRouter();

  // Navigation State
  const [activeTab, setActiveTab] = useState<DashboardTab>("Dashboard");
  const [selectedRange, setSelectedRange] = useState<"7D" | "30D" | "1Y">("7D");

  // Chart Hover Tooltip State
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // Credentials Modal State
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);

  // Toast State
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // =========================================================================
  // TAB 1: TRANSACTIONS STATE
  // =========================================================================
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);
  const [txHasMore, setTxHasMore] = useState(false);
  const [txStatusFilter, setTxStatusFilter] = useState<string>("");
  const [txMethodFilter, setTxMethodFilter] = useState<string>("");
  const [txSearch, setTxSearch] = useState("");
  const [isSyncingTx, setIsSyncingTx] = useState(false);

  // =========================================================================
  // TAB 2: REFUNDS STATE & MODAL
  // =========================================================================
  const [refunds, setRefunds] = useState<any[]>([]);
  const [refLoading, setRefLoading] = useState(false);
  const [refPage, setRefPage] = useState(1);
  const [refTotal, setRefTotal] = useState(0);
  const [refStatusFilter, setRefStatusFilter] = useState("");
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundFormPaymentId, setRefundFormPaymentId] = useState("");
  const [refundFormAmount, setRefundFormAmount] = useState<string>("");
  const [refundFormSpeed, setRefundFormSpeed] = useState<"normal" | "optimum">("normal");
  const [refundFormReason, setRefundFormReason] = useState("");
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [isConfirmingRefund, setIsConfirmingRefund] = useState(false);

  // =========================================================================
  // TAB 3: SETTLEMENTS STATE
  // =========================================================================
  const [settlements, setSettlements] = useState<any[]>([]);
  const [stlLoading, setStlLoading] = useState(false);
  const [stlPage, setStlPage] = useState(1);
  const [stlTotal, setStlTotal] = useState(0);
  const [stlStatusFilter, setStlStatusFilter] = useState("");
  const [isSyncingStl, setIsSyncingStl] = useState(false);

  // =========================================================================
  // TAB 0: DASHBOARD ANALYTICS LIVE STATE
  // =========================================================================
  const [dashboardMetrics, setDashboardMetrics] = useState<any | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // =========================================================================
  // TAB 4: HEALTH MONITORING & LIFECYCLE LIVE STATE
  // =========================================================================
  const [healthData, setHealthData] = useState<any | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Connection Lifecycle State
  const [connectionStatus, setConnectionStatus] = useState<any | null>(null);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isReconnectModalOpen, setIsReconnectModalOpen] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectKeyId, setReconnectKeyId] = useState("");
  const [reconnectKeySecret, setReconnectKeySecret] = useState("");
  const [useFreshCredentials, setUseFreshCredentials] = useState(false);

  const loadHealthData = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await fetch("/api/payments/razorpay/health");
      const data = await res.json();
      if (data.success && data.data) {
        setHealthData(data.data);
      } else {
        setHealthError(data.error || "Failed to load health telemetry");
      }
    } catch (err: any) {
      setHealthError(err.message || "Network error checking health");
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const loadConnectionStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/payments/razorpay/status");
      const data = await res.json();
      if (data.success && data.data) {
        setConnectionStatus(data.data);
      }
    } catch {
      // Ignore background check failure
    }
  }, []);

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const res = await fetch("/api/payments/razorpay/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(
          "Razorpay gateway disconnected.",
          "info",
          "Live payments & sync paused. Historical records preserved."
        );
        setIsDisconnectModalOpen(false);
        loadConnectionStatus();
        loadHealthData();
      } else {
        showToast(data.error || "Failed to disconnect gateway", "error");
      }
    } catch (err: any) {
      showToast("Network error disconnecting gateway", "error", err.message);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      const body: any = {};
      if (useFreshCredentials) {
        if (!reconnectKeyId.trim() || !reconnectKeySecret.trim()) {
          showToast("Key ID and Key Secret are required.", "error");
          setIsReconnecting(false);
          return;
        }
        body.keyId = reconnectKeyId.trim();
        body.keySecret = reconnectKeySecret.trim();
      }

      const res = await fetch("/api/payments/razorpay/reconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(
          "Razorpay reconnected and verified successfully.",
          "success",
          "Live operations and synchronization resumed."
        );
        setIsReconnectModalOpen(false);
        setReconnectKeyId("");
        setReconnectKeySecret("");
        loadConnectionStatus();
        loadHealthData();
        loadDashboardMetrics();
      } else {
        showToast(data.error || "Reconnection failed.", "error");
      }
    } catch (err: any) {
      showToast("Network error reconnecting gateway", "error", err.message);
    } finally {
      setIsReconnecting(false);
    }
  };

  const loadDashboardMetrics = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const res = await fetch("/api/payments/razorpay/dashboard");
      const data = await res.json();
      if (data.success && data.metrics) {
        setDashboardMetrics(data.metrics);
      } else {
        setDashboardError(data.error || "Failed to load dashboard metrics");
      }
    } catch (err: any) {
      setDashboardError(err.message || "Network error loading metrics");
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "info",
    subtext?: string
  ) => {
    setToast({ message, type, subtext });
  };

  // =========================================================================
  // DATA FETCHING: TRANSACTIONS
  // =========================================================================
  const loadTransactions = useCallback(
    async (page = 1, sync = false) => {
      setTxLoading(true);
      if (sync) setIsSyncingTx(true);
      try {
        const queryParams = new URLSearchParams({
          page: String(page),
          limit: "10",
        });
        if (txStatusFilter) queryParams.set("status", txStatusFilter);
        if (txMethodFilter) queryParams.set("method", txMethodFilter);
        if (txSearch) queryParams.set("search", txSearch);
        if (sync) queryParams.set("sync", "true");

        const res = await fetch(`/api/payments/razorpay/transactions?${queryParams.toString()}`);
        const data = await res.json();
        if (data.success) {
          setTransactions(data.transactions || []);
          setTxTotal(data.pagination?.total || 0);
          setTxHasMore(data.pagination?.hasMore || false);
          setTxPage(data.pagination?.page || page);
          if (sync) {
            showToast("Transactions synchronized with Razorpay.", "success");
          }
        }
      } catch (err: any) {
        showToast("Failed to load transactions.", "error", err.message);
      } finally {
        setTxLoading(false);
        setIsSyncingTx(false);
      }
    },
    [txStatusFilter, txMethodFilter, txSearch]
  );

  // =========================================================================
  // DATA FETCHING: REFUNDS
  // =========================================================================
  const loadRefunds = useCallback(
    async (page = 1, sync = false) => {
      setRefLoading(true);
      try {
        const queryParams = new URLSearchParams({
          page: String(page),
          limit: "10",
        });
        if (refStatusFilter) queryParams.set("status", refStatusFilter);
        if (sync) queryParams.set("sync", "true");

        const res = await fetch(`/api/payments/razorpay/refunds?${queryParams.toString()}`);
        const data = await res.json();
        if (data.success) {
          setRefunds(data.refunds || []);
          setRefTotal(data.pagination?.total || 0);
          setRefPage(data.pagination?.page || page);
          if (sync) {
            showToast("Refunds synchronized with Razorpay.", "success");
          }
        }
      } catch (err: any) {
        showToast("Failed to load refunds.", "error", err.message);
      } finally {
        setRefLoading(false);
      }
    },
    [refStatusFilter]
  );

  // =========================================================================
  // DATA FETCHING: SETTLEMENTS
  // =========================================================================
  const loadSettlements = useCallback(
    async (page = 1, sync = false) => {
      setStlLoading(true);
      if (sync) setIsSyncingStl(true);
      try {
        const queryParams = new URLSearchParams({
          page: String(page),
          limit: "10",
        });
        if (stlStatusFilter) queryParams.set("status", stlStatusFilter);
        if (sync) queryParams.set("sync", "true");

        const res = await fetch(`/api/payments/razorpay/settlements?${queryParams.toString()}`);
        const data = await res.json();
        if (data.success) {
          setSettlements(data.settlements || []);
          setStlTotal(data.pagination?.total || 0);
          setStlPage(data.pagination?.page || page);
          if (sync) {
            showToast("Settlement payouts synchronized with Razorpay.", "success");
          }
        }
      } catch (err: any) {
        showToast("Failed to load settlements.", "error", err.message);
      } finally {
        setStlLoading(false);
        setIsSyncingStl(false);
      }
    },
    [stlStatusFilter]
  );

  useEffect(() => {
    loadConnectionStatus();
  }, [loadConnectionStatus]);

  useEffect(() => {
    if (activeTab === "Dashboard") {
      loadDashboardMetrics();
    } else if (activeTab === "Transactions") {
      loadTransactions(txPage);
    } else if (activeTab === "Refunds") {
      loadRefunds(refPage);
    } else if (activeTab === "Settlements") {
      loadSettlements(stlPage);
    } else if (activeTab === "Health") {
      loadHealthData();
    }
  }, [
    activeTab,
    txPage,
    refPage,
    stlPage,
    loadDashboardMetrics,
    loadTransactions,
    loadRefunds,
    loadSettlements,
    loadHealthData,
  ]);

  const handleTabClick = (tab: DashboardTab) => {
    setActiveTab(tab);
  };

  const handleViewAllTransactions = () => {
    setActiveTab("Transactions");
  };

  // Submit refund
  const handleInitiateRefund = async () => {
    if (!refundFormPaymentId.trim()) {
      showToast("Payment ID is required.", "error");
      return;
    }

    setRefundSubmitting(true);
    try {
      const body: any = {
        payment_id: refundFormPaymentId.trim(),
        speed: refundFormSpeed,
      };

      if (refundFormAmount.trim()) {
        const parsed = parseFloat(refundFormAmount);
        if (isNaN(parsed) || parsed <= 0) {
          showToast("Invalid refund amount.", "error");
          setRefundSubmitting(false);
          return;
        }
        body.amount = Math.round(parsed * 100); // convert ₹ to paise
      }

      if (refundFormReason.trim()) {
        body.notes = { reason: refundFormReason.trim() };
      }

      const res = await fetch("/api/payments/razorpay/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || "Refund initiation failed.", "error");
      } else {
        showToast(
          `Refund ${data.refund?.providerRefundId} initiated successfully.`,
          "success",
          `Status: ${data.refund?.status}`
        );
        setIsRefundModalOpen(false);
        setIsConfirmingRefund(false);
        setRefundFormPaymentId("");
        setRefundFormAmount("");
        setRefundFormReason("");
        loadRefunds(1, true);
      }
    } catch (err: any) {
      showToast("Network error initiating refund.", "error", err.message);
    } finally {
      setRefundSubmitting(false);
    }
  };

  const currentTrendData: TrendBarPoint[] = razorpayPaymentTrends[selectedRange];

  const content = (
    <div className="w-full flex-1 flex flex-col p-4 sm:p-6 md:p-8 lg:p-10 max-w-[1400px] mx-auto space-y-6">
      {/* 1. Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        data-testid="dashboard-breadcrumbs"
        className="flex items-center gap-1.5 text-xs font-medium text-[#78716c]"
      >
        <Link
          href="/marketplace"
          className="hover:text-[#0c0a09] transition-colors"
        >
          Installed Apps
        </Link>
        <span className="material-symbols-outlined text-[16px] text-[#a8a29e]">chevron_right</span>
        <Link
          href="/marketplace?tab=payments"
          className="hover:text-[#0c0a09] transition-colors"
        >
          Payments
        </Link>
        <span className="material-symbols-outlined text-[16px] text-[#a8a29e]">chevron_right</span>
        <span className="text-[#0c0a09] font-bold">Razorpay</span>
      </nav>

      {/* 2. Header & Internal Navigation Tabs */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1
              data-testid="dashboard-title"
              className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0c0a09]"
            >
              Razorpay Payments
            </h1>
            <p className="text-xs sm:text-sm text-[#78716c] mt-0.5">
              Live gateway operations, transaction telemetry, and settlement reconciliation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 self-start sm:self-auto bg-white border border-[#e7e5e4] px-3 py-1.5 rounded-full shadow-2xs text-xs font-semibold text-[#0c0a09]">
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus?.status === "connected"
                    ? "bg-emerald-600 animate-pulse"
                    : connectionStatus?.status === "disconnected"
                    ? "bg-stone-400"
                    : "bg-amber-500"
                }`}
              />
              <span>
                {connectionStatus?.status === "connected"
                  ? `Gateway Active (${connectionStatus?.accountMode === "test" ? "Test" : "Live"} Mode)`
                  : connectionStatus?.status === "disconnected"
                  ? "Gateway Disconnected"
                  : "Gateway Active (Live Mode)"}
              </span>
            </div>

            {connectionStatus?.status === "connected" ? (
              <button
                type="button"
                onClick={() => setIsDisconnectModalOpen(true)}
                data-testid="btn-disconnect-gateway"
                className="px-3.5 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">power_settings_new</span>
                <span>Disconnect</span>
              </button>
            ) : connectionStatus?.status === "disconnected" ? (
              <button
                type="button"
                onClick={() => setIsReconnectModalOpen(true)}
                data-testid="btn-reconnect-gateway"
                className="px-3.5 py-1.5 rounded-xl border border-[#0c0a09] bg-[#0c0a09] hover:bg-stone-800 text-xs font-semibold text-white transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                <span>Reconnect</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setIsCredentialsModalOpen(true)}
              data-testid="btn-view-credentials"
              className="px-3.5 py-1.5 rounded-xl border border-[#e7e5e4] bg-white hover:bg-[#fafaf9] text-xs font-semibold text-[#0c0a09] transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">key</span>
              <span>API Credentials</span>
            </button>
          </div>
        </div>

        {/* Internal Navigation Tabs */}
        <div className="border-b border-[#e7e5e4] flex items-center gap-6 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
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
      </div>

      {/* ========================================================================= */}
      {/* VIEW A: MAIN DASHBOARD OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === "Dashboard" && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          {(() => {
            const cards = dashboardMetrics
              ? [
                  {
                    id: "today-revenue",
                    title: "Today's Revenue",
                    value: dashboardMetrics.todayRevenue?.formattedNet || "₹0.00",
                    supportingText: `Gross: ${dashboardMetrics.todayRevenue?.formattedGross || "₹0.00"} • Refunds: ${dashboardMetrics.todayRevenue?.formattedRefunds || "₹0.00"}`,
                    icon: "payments",
                  },
                  {
                    id: "monthly-revenue",
                    title: "Monthly Revenue",
                    value: dashboardMetrics.monthlyRevenue?.formattedNet || "₹0.00",
                    supportingText: `Gross: ${dashboardMetrics.monthlyRevenue?.formattedGross || "₹0.00"}`,
                    icon: "calendar_month",
                  },
                  {
                    id: "successful-payments",
                    title: "Successful Payments",
                    value: String(dashboardMetrics.successfulPayments ?? 0),
                    badge: `${dashboardMetrics.successRate ?? 100}%`,
                    supportingText: `${dashboardMetrics.successRate ?? 100}% Success Rate`,
                    icon: "check_circle",
                  },
                  {
                    id: "failed-payments",
                    title: "Failed Payments",
                    value: String(dashboardMetrics.failedPayments ?? 0),
                    badge: "Failed",
                    supportingText: `${dashboardMetrics.failedPayments ?? 0} failed attempts`,
                    icon: "cancel",
                  },
                  {
                    id: "pending-payments",
                    title: "Pending Payments",
                    value: String(dashboardMetrics.pendingPayments ?? 0),
                    badge: "Pending",
                    supportingText: "Awaiting confirmation",
                    icon: "schedule",
                  },
                  {
                    id: "refunds-count",
                    title: "Total Refunds",
                    value: String(dashboardMetrics.refundCount ?? 0),
                    badge: "Refunds",
                    supportingText: "Processed refunds",
                    icon: "currency_exchange",
                  },
                ]
              : razorpayDashboardMetrics;

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-5">
                {cards.map((card) => (
                  <div
                    key={card.id}
                    data-testid={`metric-card-${card.id}`}
                    className={`bg-white border border-[#e7e5e4] rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-stone-400 hover:shadow-md transition-all duration-200 ${
                      dashboardLoading ? "opacity-75 animate-pulse" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium text-[#78716c] uppercase tracking-wider">
                        {card.title}
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-[#f5f5f4] border border-[#e7e5e4] flex items-center justify-center text-[#0c0a09] shrink-0">
                        <span className="material-symbols-outlined text-[18px]">{card.icon}</span>
                      </div>
                    </div>

                    <div className="mt-4 space-y-1.5">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-[#0c0a09] tracking-tight">
                          {card.value}
                        </span>
                        {card.badge && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border border-[#e7e5e4] bg-[#fafaf9] text-[#0c0a09]">
                            {card.badge}
                          </span>
                        )}
                      </div>
                      <p
                        className="text-xs text-[#78716c] font-medium truncate"
                        title={card.supportingText}
                      >
                        {card.supportingText}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Middle Section: Trends & Status */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
            {/* Chart Card */}
            <div
              data-testid="payment-trends-card"
              className="lg:col-span-8 bg-white border border-[#e7e5e4] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#0c0a09]">Payment Trends</h2>
                  <p className="text-xs text-[#78716c]">
                    Volume & settlement velocity across selected interval.
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-[#fafaf9] p-1 rounded-xl border border-[#e7e5e4] self-start sm:self-auto">
                  {(["7D", "30D", "1Y"] as const).map((range) => {
                    const isSelected = selectedRange === range;
                    return (
                      <button
                        key={range}
                        type="button"
                        onClick={() => setSelectedRange(range)}
                        data-testid={`range-btn-${range}`}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#0c0a09] text-white shadow-2xs"
                            : "text-[#78716c] hover:text-[#0c0a09]"
                        }`}
                      >
                        {range}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="relative pt-6 pb-2 min-h-[220px] flex items-end justify-between gap-2 sm:gap-4 px-2">
                {currentTrendData.map((bar, idx) => {
                  const isHovered = hoveredBarIndex === idx;
                  return (
                    <div
                      key={bar.label}
                      onMouseEnter={() => setHoveredBarIndex(idx)}
                      onMouseLeave={() => setHoveredBarIndex(null)}
                      className="flex-1 flex flex-col items-center gap-2 group relative cursor-pointer"
                    >
                      {isHovered && (
                        <div
                          data-testid="chart-tooltip"
                          className="absolute -top-12 z-20 bg-[#0c0a09] text-white text-[11px] font-semibold py-1 px-2.5 rounded-lg shadow-lg whitespace-nowrap animate-fade-in pointer-events-none"
                        >
                          <span>{bar.formattedAmount}</span>
                          <div className="w-2 h-2 bg-[#0c0a09] rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2" />
                        </div>
                      )}

                      <div className="w-full h-40 flex items-end justify-center rounded-lg bg-[#f5f5f4]/60 p-1">
                        <div
                          style={{ height: `${bar.value}%` }}
                          className={`w-full max-w-[36px] rounded-md transition-all duration-300 ${
                            bar.isLatest
                              ? "bg-[#0c0a09]"
                              : isHovered
                              ? "bg-[#57534e]"
                              : "bg-[#a8a29e]"
                          }`}
                        />
                      </div>

                      <span className="text-[11px] font-medium text-[#78716c] group-hover:text-[#0c0a09] transition-colors truncate max-w-full">
                        {bar.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Integration Status Card */}
            <div
              data-testid="integration-status-card"
              className="lg:col-span-4 bg-white border border-[#e7e5e4] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#78716c] uppercase tracking-wider">
                    {razorpayIntegrationStatus.statusText}
                  </span>
                  <span
                    data-testid="status-indicator-live"
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-emerald-300 bg-emerald-50 text-emerald-900"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                    <span>Live</span>
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#0c0a09]">
                    {razorpayIntegrationStatus.headline}
                  </h3>
                  <p className="text-xs text-[#78716c] leading-relaxed">
                    {razorpayIntegrationStatus.description}
                  </p>
                </div>

                <div className="p-3.5 bg-[#fafaf9] border border-[#e7e5e4] rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#78716c]">Active Mode</span>
                    <span className="font-semibold text-[#0c0a09]">
                      {razorpayIntegrationStatus.environment}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#78716c]">Key ID</span>
                    <span className="font-mono font-medium text-[#0c0a09]">
                      {razorpayIntegrationStatus.maskedKeyId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#78716c]">Webhook Endpoint</span>
                    <span className="font-semibold text-emerald-700">Healthy</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-[#e7e5e4]">
                <button
                  type="button"
                  onClick={() => setIsCredentialsModalOpen(true)}
                  data-testid="btn-view-api-keys"
                  className="w-full py-2.5 rounded-xl border border-[#0c0a09] bg-transparent hover:bg-[#fafaf9] text-xs font-semibold text-[#0c0a09] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  <span>View API Credentials</span>
                </button>
              </div>
            </div>
          </div>

          {/* Recent Transactions Preview */}
          <div
            data-testid="recent-transactions-card"
            className="bg-white border border-[#e7e5e4] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#0c0a09]">Recent Transactions</h2>
                <p className="text-xs text-[#78716c]">
                  Real-time settlement activity and payment lifecycle log.
                </p>
              </div>

              <button
                type="button"
                onClick={handleViewAllTransactions}
                data-testid="btn-view-all-transactions"
                className="text-xs font-semibold text-[#0c0a09] hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
              >
                <span>View All Transactions</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>

            <div className="overflow-x-auto -mx-5 sm:mx-0">
              <table className="w-full text-left text-xs sm:text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-[#e7e5e4] text-[#78716c] text-[10px] sm:text-xs uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Payment ID</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7e5e4]/70">
                  {razorpayRecentTransactions.map((tx: RazorpayTransactionItem) => (
                    <tr
                      key={tx.id}
                      onClick={() => handleViewAllTransactions()}
                      data-testid={`transaction-row-${tx.id}`}
                      className="hover:bg-[#fafaf9] transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-mono font-medium text-[#0c0a09]">
                        {tx.truncatedId}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#0c0a09]">{tx.amount}</td>
                      <td className="py-3.5 px-4 text-[#78716c]">{tx.customerEmail}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-[#0c0a09] font-medium">
                          <span className="material-symbols-outlined text-[16px] text-[#78716c]">
                            {tx.methodIcon}
                          </span>
                          <span>{tx.paymentMethod}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[#78716c] whitespace-nowrap">{tx.date}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span
                          data-testid={`tx-status-${tx.status.toLowerCase()}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[#e7e5e4] bg-[#fafaf9] text-[#0c0a09]"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {tx.statusIcon}
                          </span>
                          <span>{tx.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW B: FULL TRANSACTIONS TAB */}
      {/* ========================================================================= */}
      {activeTab === "Transactions" && (
        <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#0c0a09]">Transactions Ledger</h2>
              <p className="text-xs text-[#78716c]">
                Complete synchronized payment transactions directly from Razorpay.
              </p>
            </div>
            <button
              type="button"
              disabled={isSyncingTx}
              onClick={() => loadTransactions(1, true)}
              className="px-3.5 py-2 rounded-xl bg-[#0c0a09] text-white text-xs font-semibold hover:bg-[#262626] transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] ${isSyncingTx ? "animate-spin" : ""}`}>
                sync
              </span>
              <span>{isSyncingTx ? "Syncing..." : "Sync With Razorpay"}</span>
            </button>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-[#fafaf9] rounded-xl border border-[#e7e5e4]">
            <input
              type="text"
              placeholder="Search by Payment ID, email..."
              value={txSearch}
              onChange={(e) => setTxSearch(e.target.value)}
              className="px-3 py-1.5 bg-white border border-[#e7e5e4] rounded-lg text-xs text-[#0c0a09] focus:outline-none focus:border-[#0c0a09]"
            />
            <select
              value={txStatusFilter}
              onChange={(e) => setTxStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-[#e7e5e4] rounded-lg text-xs text-[#0c0a09] focus:outline-none focus:border-[#0c0a09]"
            >
              <option value="">All Statuses</option>
              <option value="captured">Captured (Success)</option>
              <option value="authorized">Authorized</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
              <option value="partially_refunded">Partially Refunded</option>
            </select>
            <select
              value={txMethodFilter}
              onChange={(e) => setTxMethodFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-[#e7e5e4] rounded-lg text-xs text-[#0c0a09] focus:outline-none focus:border-[#0c0a09]"
            >
              <option value="">All Payment Methods</option>
              <option value="upi">UPI</option>
              <option value="card">Cards</option>
              <option value="netbanking">Net Banking</option>
              <option value="wallet">Wallets</option>
            </select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[#e7e5e4] text-[#78716c] text-[10px] sm:text-xs uppercase font-semibold">
                  <th className="py-3 px-4">Transaction ID</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e7e5e4]">
                {txLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#78716c]">
                      <div className="flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                        <span>Loading transactions...</span>
                      </div>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#78716c]">
                      No transactions found. Click &quot;Sync With Razorpay&quot; to fetch latest records.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx._id || tx.providerPaymentId} className="hover:bg-[#fafaf9]">
                      <td className="py-3 px-4 font-mono font-medium text-[#0c0a09]">
                        {tx.providerPaymentId}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#0c0a09]">
                        ₹{(tx.amountMinor / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 uppercase text-[11px] font-semibold text-[#78716c]">
                        {tx.paymentMethod}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-[#e7e5e4] bg-[#fafaf9] text-[#0c0a09]">
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#78716c] whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {(tx.status === "captured" || tx.status === "partially_refunded") && (
                          <button
                            type="button"
                            onClick={() => {
                              setRefundFormPaymentId(tx.providerPaymentId);
                              setIsRefundModalOpen(true);
                              setActiveTab("Refunds");
                            }}
                            className="text-xs font-semibold text-[#0c0a09] hover:underline cursor-pointer"
                          >
                            Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 border-t border-[#e7e5e4] text-xs text-[#78716c]">
            <span>Total: {txTotal} records</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={txPage <= 1}
                onClick={() => setTxPage((p) => Math.max(p - 1, 1))}
                className="px-3 py-1.5 rounded-lg border border-[#e7e5e4] hover:bg-[#fafaf9] disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span>Page {txPage}</span>
              <button
                type="button"
                disabled={!txHasMore}
                onClick={() => setTxPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-[#e7e5e4] hover:bg-[#fafaf9] disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW C: FULL REFUNDS TAB */}
      {/* ========================================================================= */}
      {activeTab === "Refunds" && (
        <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#0c0a09]">Refunds Management</h2>
              <p className="text-xs text-[#78716c]">
                Initiate full or partial refunds and track Razorpay refund processing states.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadRefunds(1, true)}
                className="px-3.5 py-2 rounded-xl border border-[#e7e5e4] bg-white hover:bg-[#fafaf9] text-[#0c0a09] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">sync</span>
                <span>Refresh</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRefundFormPaymentId("");
                  setRefundFormAmount("");
                  setIsRefundModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-[#0c0a09] text-white text-xs font-semibold hover:bg-[#262626] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Initiate Refund</span>
              </button>
            </div>
          </div>

          {/* Refunds Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[#e7e5e4] text-[#78716c] text-[10px] sm:text-xs uppercase font-semibold">
                  <th className="py-3 px-4">Refund ID</th>
                  <th className="py-3 px-4">Payment ID</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Speed</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e7e5e4]">
                {refLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#78716c]">
                      Loading refunds...
                    </td>
                  </tr>
                ) : refunds.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#78716c]">
                      No refunds recorded yet.
                    </td>
                  </tr>
                ) : (
                  refunds.map((rf) => (
                    <tr key={rf._id || rf.providerRefundId} className="hover:bg-[#fafaf9]">
                      <td className="py-3 px-4 font-mono font-medium text-[#0c0a09]">
                        {rf.providerRefundId}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#78716c]">
                        {rf.providerPaymentId}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#0c0a09]">
                        ₹{(rf.amountMinor / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 uppercase text-[11px] text-[#78716c]">
                        {rf.speed || "normal"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-[#e7e5e4] bg-[#fafaf9] text-[#0c0a09]">
                          {rf.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#78716c] whitespace-nowrap">
                        {new Date(rf.initiatedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW D: SETTLEMENTS TAB */}
      {/* ========================================================================= */}
      {activeTab === "Settlements" && (
        <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#0c0a09]">Settlement Payouts</h2>
              <p className="text-xs text-[#78716c]">
                Track automatic payouts deposited by Razorpay into your verified merchant bank account.
              </p>
            </div>
            <button
              type="button"
              disabled={isSyncingStl}
              onClick={() => loadSettlements(1, true)}
              className="px-3.5 py-2 rounded-xl bg-[#0c0a09] text-white text-xs font-semibold hover:bg-[#262626] transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] ${isSyncingStl ? "animate-spin" : ""}`}>
                sync
              </span>
              <span>{isSyncingStl ? "Syncing..." : "Sync Settlements"}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[#e7e5e4] text-[#78716c] text-[10px] sm:text-xs uppercase font-semibold">
                  <th className="py-3 px-4">Settlement ID</th>
                  <th className="py-3 px-4">Gross Amount</th>
                  <th className="py-3 px-4">Fees & Tax</th>
                  <th className="py-3 px-4">Net Payout</th>
                  <th className="py-3 px-4">UTR Reference</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Transfer Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e7e5e4]">
                {stlLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#78716c]">
                      Loading settlements...
                    </td>
                  </tr>
                ) : settlements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#78716c]">
                      No settlement payout records found.
                    </td>
                  </tr>
                ) : (
                  settlements.map((stl) => (
                    <tr key={stl._id || stl.providerSettlementId} className="hover:bg-[#fafaf9]">
                      <td className="py-3 px-4 font-mono font-medium text-[#0c0a09]">
                        {stl.providerSettlementId}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#78716c]">
                        ₹{(stl.amountMinor / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-[#78716c]">
                        ₹{(((stl.feesMinor || 0) + (stl.taxMinor || 0)) / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#0c0a09]">
                        ₹{(stl.netAmountMinor / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#78716c]">
                        {stl.utrOrReference || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-[#e7e5e4] bg-[#fafaf9] text-[#0c0a09]">
                          {stl.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#78716c] whitespace-nowrap">
                        {new Date(stl.settlementDate).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW E: HEALTH TAB */}
      {/* ========================================================================= */}
      {activeTab === "Health" && (
        <div className="space-y-6">
          <div className="bg-white border border-[#e7e5e4] rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-[#0c0a09]">Integration Health Probe</h2>
                {healthData && (
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                      healthData.overallStatus === "healthy"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : healthData.overallStatus === "warning"
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : healthData.overallStatus === "degraded"
                        ? "bg-orange-50 text-orange-800 border-orange-200"
                        : healthData.overallStatus === "disconnected"
                        ? "bg-stone-100 text-stone-700 border-stone-200"
                        : "bg-red-50 text-red-800 border-red-200"
                    }`}
                  >
                    {healthData.overallStatus}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#78716c] mt-1">
                Real-time API probe, webhook ingestion health, and 15-minute background synchronization telemetry.
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadHealthData()}
              disabled={healthLoading}
              data-testid="btn-probe-health"
              className="px-3.5 py-2 rounded-xl border border-[#e7e5e4] bg-[#fafaf9] hover:bg-stone-100 text-xs font-semibold text-[#0c0a09] transition-all flex items-center gap-2 self-start sm:self-auto cursor-pointer disabled:opacity-50"
            >
              <span
                className={`material-symbols-outlined text-[16px] ${
                  healthLoading ? "animate-spin" : ""
                }`}
              >
                autorenew
              </span>
              <span>{healthLoading ? "Probing Gateway..." : "Probe Health Now"}</span>
            </button>
          </div>

          {/* 4 Health Dimension Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* 1. Connection Status Card */}
            <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-[#78716c] uppercase tracking-wider">
                  Gateway Connection
                </span>
                <span className="material-symbols-outlined text-[18px] text-[#0c0a09]">link</span>
              </div>
              <div className="mt-4 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-[#0c0a09] capitalize">
                    {healthData?.connection?.status || "Checking..."}
                  </span>
                  {healthData?.connection?.mode && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-[#e7e5e4] bg-[#fafaf9]">
                      {healthData.connection.mode}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#78716c]">
                  Key ID: {healthData?.connection?.maskedKeyId || "—"}
                </p>
              </div>
            </div>

            {/* 2. API Status Card */}
            <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-[#78716c] uppercase tracking-wider">
                  Razorpay REST API
                </span>
                <span className="material-symbols-outlined text-[18px] text-[#0c0a09]">dns</span>
              </div>
              <div className="mt-4 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-[#0c0a09] capitalize">
                    {healthData?.api?.status || "Checking..."}
                  </span>
                  {healthData?.api?.latencyMs && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800">
                      {healthData.api.latencyMs}ms
                    </span>
                  )}
                </div>
                <p
                  className="text-xs text-[#78716c] truncate"
                  title={healthData?.api?.message || healthData?.api?.error}
                >
                  {healthData?.api?.error ||
                    healthData?.api?.message ||
                    "Read probe: payments?count=1"}
                </p>
              </div>
            </div>

            {/* 3. Webhook Delivery Card */}
            <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-[#78716c] uppercase tracking-wider">
                  Webhook Ingestion
                </span>
                <span className="material-symbols-outlined text-[18px] text-[#0c0a09]">webhook</span>
              </div>
              <div className="mt-4 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-[#0c0a09] capitalize">
                    {healthData?.webhook?.status || "Checking..."}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#e7e5e4] bg-[#fafaf9]">
                    {healthData?.webhook?.totalEvents || 0} events
                  </span>
                </div>
                <p className="text-xs text-[#78716c]">
                  {healthData?.webhook?.failedEvents > 0 ? (
                    <span className="text-red-600 font-semibold">
                      {healthData.webhook.failedEvents} failures (24h)
                    </span>
                  ) : (
                    "HMAC-SHA256 signature verified"
                  )}
                </p>
              </div>
            </div>

            {/* 4. Automated 15-Minute Sync Engine Card */}
            <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-[#78716c] uppercase tracking-wider">
                  Sync Engine (15m)
                </span>
                <span className="material-symbols-outlined text-[18px] text-[#0c0a09]">schedule</span>
              </div>
              <div className="mt-4 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-[#0c0a09]">Active</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#e7e5e4] bg-[#fafaf9]">
                    Convex Cron
                  </span>
                </div>
                <p className="text-xs text-[#78716c]">
                  Runs every 15 min with 5m overlap buffer
                </p>
              </div>
            </div>
          </div>

          {/* Sync Engine Telemetry Table */}
          <div className="bg-white border border-[#e7e5e4] rounded-2xl overflow-hidden shadow-xs">
            <div className="p-5 border-b border-[#e7e5e4]">
              <h3 className="text-sm font-bold text-[#0c0a09]">
                Synchronization Cursors & Run Audit
              </h3>
              <p className="text-xs text-[#78716c] mt-0.5">
                Telemetry from payment_sync_runs and payment_sync_cursors.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e7e5e4] bg-[#fafaf9] text-[#78716c] font-semibold">
                    <th className="py-3 px-5">Resource Entity</th>
                    <th className="py-3 px-5">Execution Status</th>
                    <th className="py-3 px-5">Last Synced At</th>
                    <th className="py-3 px-5">Last Successful Sync</th>
                    <th className="py-3 px-5">Fetched / Created / Updated</th>
                    <th className="py-3 px-5">Last Log / Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7e5e4]">
                  {(["transactions", "refunds", "settlements"] as const).map((entity) => {
                    const info = healthData?.sync?.[entity];
                    return (
                      <tr key={entity} className="hover:bg-[#fafaf9] transition-colors">
                        <td className="py-3.5 px-5 font-bold text-[#0c0a09] capitalize">
                          {entity}
                        </td>
                        <td className="py-3.5 px-5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              info?.status === "success" || info?.status === "completed"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : info?.status === "failed"
                                ? "bg-red-50 text-red-800 border-red-200"
                                : info?.status === "running"
                                ? "bg-blue-50 text-blue-800 border-blue-200"
                                : "bg-stone-50 text-stone-600 border-stone-200"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                info?.status === "success" || info?.status === "completed"
                                  ? "bg-emerald-600"
                                  : info?.status === "failed"
                                  ? "bg-red-600"
                                  : "bg-stone-400"
                              }`}
                            />
                            {info?.status || "never"}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-[#78716c]">
                          {info?.lastSyncedAt
                            ? new Date(info.lastSyncedAt).toLocaleString()
                            : "Never"}
                        </td>
                        <td className="py-3.5 px-5 text-[#78716c]">
                          {info?.lastSuccessfulSyncAt
                            ? new Date(info.lastSuccessfulSyncAt).toLocaleString()
                            : "Never"}
                        </td>
                        <td className="py-3.5 px-5 font-mono text-[#0c0a09]">
                          {info?.recordsFetched ?? 0} / {info?.recordsCreated ?? 0} /{" "}
                          {info?.recordsUpdated ?? 0}
                        </td>
                        <td
                          className="py-3.5 px-5 text-[#78716c] truncate max-w-[200px]"
                          title={info?.lastError || "None"}
                        >
                          {info?.lastError || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW F: SETTINGS TAB */}
      {/* ========================================================================= */}
      {activeTab === "Settings" && (
        <div className="bg-white border border-[#e7e5e4] rounded-2xl p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[#0c0a09]">Gateway Connection Settings</h2>
            <p className="text-xs text-[#78716c] mt-0.5">
              Security encryption, provider account details, and connection lifecycle management.
            </p>
          </div>

          <div className="p-4 bg-[#fafaf9] border border-[#e7e5e4] rounded-xl space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-[#e7e5e4]">
              <span className="text-[#78716c]">Provider</span>
              <span className="font-semibold text-[#0c0a09]">Razorpay (Polymorphic Gateway)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#e7e5e4]">
              <span className="text-[#78716c]">Account Mode</span>
              <span className="font-semibold text-[#0c0a09] uppercase">
                {connectionStatus?.accountMode || "Live"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#e7e5e4]">
              <span className="text-[#78716c]">Credential Encryption</span>
              <span className="font-semibold text-emerald-700">
                AES-256-GCM Authenticated Envelope
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#e7e5e4]">
              <span className="text-[#78716c]">Automatic Sync</span>
              <span className="font-semibold text-[#0c0a09]">
                Convex 15-Minute Cron (Every :00, :15, :30, :45)
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#78716c]">Financial Audit Policy</span>
              <span className="font-semibold text-[#0c0a09]">
                Non-destructive: Disconnect preserves all transaction records
              </span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-[#e7e5e4]">
            <div>
              <h4 className="text-xs font-bold text-[#0c0a09]">Gateway Lifecycle Action</h4>
              <p className="text-[11px] text-[#78716c]">
                {connectionStatus?.status === "connected"
                  ? "Disconnect Razorpay to pause live collections and automated background synchronization."
                  : "Reconnect Razorpay using verified credentials to resume operations."}
              </p>
            </div>

            {connectionStatus?.status === "connected" ? (
              <button
                type="button"
                onClick={() => setIsDisconnectModalOpen(true)}
                className="px-4 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700 transition-all cursor-pointer"
              >
                Disconnect Gateway
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsReconnectModalOpen(true)}
                className="px-4 py-2 rounded-xl border border-[#0c0a09] bg-[#0c0a09] hover:bg-stone-800 text-xs font-semibold text-white transition-all cursor-pointer"
              >
                Reconnect Gateway
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DISCONNECT GATEWAY MODAL */}
      {/* ========================================================================= */}
      {isDisconnectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e7e5e4] rounded-2xl p-6 max-w-[480px] w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-700 shrink-0">
                <span className="material-symbols-outlined text-[20px]">warning</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0c0a09]">Disconnect Razorpay Gateway?</h3>
                <p className="text-xs text-[#78716c]">Please review this action before proceeding.</p>
              </div>
            </div>

            <div className="p-3.5 bg-[#fafaf9] border border-[#e7e5e4] rounded-xl text-xs text-[#78716c] space-y-2">
              <p>
                <strong className="text-[#0c0a09]">Financial Data Retention:</strong> All historical
                payment transactions, refunds, and settlement reports will remain completely
                preserved in PREST POS.
              </p>
              <p>
                <strong className="text-[#0c0a09]">Sync & Operations:</strong> Live payment
                operations, webhook processing, and automated 15-minute background synchronization
                will be paused until reconnected.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsDisconnectModalOpen(false)}
                disabled={isDisconnecting}
                className="px-4 py-2 rounded-xl border border-[#e7e5e4] bg-white hover:bg-[#fafaf9] text-xs font-semibold text-[#0c0a09] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                data-testid="btn-confirm-disconnect"
                className="px-4 py-2 rounded-xl border border-red-600 bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-50"
              >
                {isDisconnecting ? "Disconnecting..." : "Confirm Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: RECONNECT GATEWAY MODAL */}
      {/* ========================================================================= */}
      {isReconnectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e7e5e4] rounded-2xl p-6 max-w-[480px] w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#e7e5e4] pb-3">
              <h3 className="text-base font-bold text-[#0c0a09]">Reconnect Razorpay Gateway</h3>
              <button
                type="button"
                onClick={() => setIsReconnectModalOpen(false)}
                className="text-[#78716c] hover:text-[#0c0a09] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-[#0c0a09]">
                <input
                  type="checkbox"
                  checked={useFreshCredentials}
                  onChange={(e) => setUseFreshCredentials(e.target.checked)}
                  className="rounded border-[#e7e5e4]"
                />
                <span>Supply new API Key & Secret (optional)</span>
              </label>

              {useFreshCredentials ? (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block font-semibold text-[#0c0a09] mb-1">
                      Razorpay Key ID *
                    </label>
                    <input
                      type="text"
                      placeholder="rzp_live_..."
                      value={reconnectKeyId}
                      onChange={(e) => setReconnectKeyId(e.target.value)}
                      className="w-full px-3 py-2 border border-[#e7e5e4] rounded-xl text-xs font-mono text-[#0c0a09] focus:outline-none focus:border-[#0c0a09]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#0c0a09] mb-1">
                      Razorpay Key Secret *
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={reconnectKeySecret}
                      onChange={(e) => setReconnectKeySecret(e.target.value)}
                      className="w-full px-3 py-2 border border-[#e7e5e4] rounded-xl text-xs font-mono text-[#0c0a09] focus:outline-none focus:border-[#0c0a09]"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-[#78716c] bg-[#fafaf9] p-3 rounded-xl border border-[#e7e5e4]">
                  PREST will verify previously encrypted credentials and resume live operations and
                  automated 15-minute synchronization.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsReconnectModalOpen(false)}
                disabled={isReconnecting}
                className="px-4 py-2 rounded-xl border border-[#e7e5e4] bg-white hover:bg-[#fafaf9] text-xs font-semibold text-[#0c0a09] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReconnect}
                disabled={isReconnecting}
                data-testid="btn-confirm-reconnect"
                className="px-4 py-2 rounded-xl border border-[#0c0a09] bg-[#0c0a09] hover:bg-stone-800 text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-50"
              >
                {isReconnecting ? "Verifying..." : "Verify & Reconnect"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: INITIATE REFUND MODAL */}
      {/* ========================================================================= */}
      {isRefundModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e7e5e4] rounded-2xl p-6 max-w-[500px] w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#e7e5e4] pb-3">
              <h3 className="text-base font-bold text-[#0c0a09]">Initiate Razorpay Refund</h3>
              <button
                type="button"
                onClick={() => {
                  setIsRefundModalOpen(false);
                  setIsConfirmingRefund(false);
                }}
                className="text-[#78716c] hover:text-[#0c0a09] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {!isConfirmingRefund ? (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#0c0a09] mb-1">
                    Razorpay Payment ID *
                  </label>
                  <input
                    type="text"
                    placeholder="pay_..."
                    value={refundFormPaymentId}
                    onChange={(e) => setRefundFormPaymentId(e.target.value)}
                    className="w-full px-3 py-2 border border-[#e7e5e4] rounded-xl text-xs font-mono text-[#0c0a09] focus:outline-none focus:border-[#0c0a09]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#0c0a09] mb-1">
                    Refund Amount in ₹ (leave blank for full refund)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 50.00"
                    value={refundFormAmount}
                    onChange={(e) => setRefundFormAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-[#e7e5e4] rounded-xl text-xs text-[#0c0a09] focus:outline-none focus:border-[#0c0a09]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#0c0a09] mb-1">
                    Refund Speed
                  </label>
                  <select
                    value={refundFormSpeed}
                    onChange={(e) => setRefundFormSpeed(e.target.value as any)}
                    className="w-full px-3 py-2 border border-[#e7e5e4] rounded-xl text-xs text-[#0c0a09] focus:outline-none focus:border-[#0c0a09]"
                  >
                    <option value="normal">Normal (5–7 banking days)</option>
                    <option value="optimum">Optimum / Instant (if supported by customer bank)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#0c0a09] mb-1">
                    Reason / Customer Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Order cancelled, item returned"
                    value={refundFormReason}
                    onChange={(e) => setRefundFormReason(e.target.value)}
                    className="w-full px-3 py-2 border border-[#e7e5e4] rounded-xl text-xs text-[#0c0a09] focus:outline-none focus:border-[#0c0a09]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRefundModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-[#e7e5e4] text-[#0c0a09] font-medium hover:bg-[#fafaf9] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!refundFormPaymentId.trim()}
                    onClick={() => setIsConfirmingRefund(true)}
                    className="px-4 py-2 rounded-xl bg-[#0c0a09] text-white font-medium hover:bg-[#262626] disabled:opacity-40 cursor-pointer"
                  >
                    Review & Confirm
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 leading-relaxed">
                  <strong>Please confirm refund:</strong> This will instruct Razorpay to debit your account and initiate credit to the customer.
                </div>

                <div className="space-y-1.5 p-3 bg-[#fafaf9] rounded-xl border border-[#e7e5e4]">
                  <div className="flex justify-between">
                    <span className="text-[#78716c]">Payment ID:</span>
                    <span className="font-mono font-bold text-[#0c0a09]">{refundFormPaymentId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#78716c]">Amount:</span>
                    <span className="font-bold text-[#0c0a09]">
                      {refundFormAmount ? `₹${parseFloat(refundFormAmount).toFixed(2)}` : "Full Balance"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#78716c]">Speed:</span>
                    <span className="uppercase font-semibold text-[#0c0a09]">{refundFormSpeed}</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={refundSubmitting}
                    onClick={() => setIsConfirmingRefund(false)}
                    className="px-4 py-2 rounded-xl border border-[#e7e5e4] text-[#0c0a09] font-medium hover:bg-[#fafaf9] cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={refundSubmitting}
                    onClick={handleInitiateRefund}
                    className="px-4 py-2 rounded-xl bg-[#0c0a09] text-white font-medium hover:bg-[#262626] disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {refundSubmitting ? "Submitting to Razorpay..." : "Confirm Refund Submission"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: MASKED CREDENTIALS MODAL */}
      {/* ========================================================================= */}
      {isCredentialsModalOpen && (
        <div
          data-testid="credentials-modal-overlay"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsCredentialsModalOpen(false)}
        >
          <div
            data-testid="credentials-modal-content"
            className="bg-white border border-[#e7e5e4] rounded-2xl p-6 sm:p-7 max-w-[500px] w-full shadow-2xl space-y-5 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-[#78716c] uppercase tracking-wider">
                  SECURITY CREDENTIALS
                </span>
                <h3 className="text-lg font-bold text-[#0c0a09]">Razorpay API Keys</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCredentialsModalOpen(false)}
                data-testid="btn-close-credentials-modal"
                className="w-8 h-8 rounded-lg border border-[#e7e5e4] flex items-center justify-center text-[#78716c] hover:text-[#0c0a09] hover:bg-[#fafaf9] transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="text-xs text-[#78716c] leading-relaxed">
              For security, credentials are encrypted via AES-256-GCM.
            </p>

            <div className="space-y-3">
              <div className="p-3.5 bg-[#fafaf9] border border-[#e7e5e4] rounded-xl space-y-1">
                <span className="text-[11px] font-semibold text-[#78716c]">Key ID</span>
                <p className="text-xs font-mono font-semibold text-[#0c0a09]">
                  {razorpayIntegrationStatus.maskedKeyId}
                </p>
              </div>

              <div className="p-3.5 bg-[#fafaf9] border border-[#e7e5e4] rounded-xl space-y-1">
                <span className="text-[11px] font-semibold text-[#78716c]">Key Secret</span>
                <p className="text-xs font-mono font-semibold text-[#0c0a09]">
                  {razorpayIntegrationStatus.maskedSecret}
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsCredentialsModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-[#0c0a09] hover:bg-[#262626] text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          toast={toast}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );

  if (embeddedInMarketplace) {
    return content;
  }

  return (
    <PosShell
      title="Razorpay Payments"
      subtitle="Live gateway operations, transaction telemetry, and settlement reconciliation."
    >
      {content}
    </PosShell>
  );
}
