"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { formatCurrencyMinor, formatCurrency } from "../../lib/payments/currency";
import { RazorpayTransactionsView } from "./RazorpayTransactionsView";
import { RazorpayRefundsView } from "./RazorpayRefundsView";
import { RazorpaySettlementsView } from "./RazorpaySettlementsView";
import { RazorpayHealthView } from "./RazorpayHealthView";
import { RazorpaySettingsView } from "./RazorpaySettingsView";

interface RazorpayDashboardViewProps {
  embeddedInMarketplace?: boolean;
  initialTab?: DashboardTab;
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
  initialTab = "Dashboard",
}: RazorpayDashboardViewProps) {
  const router = useRouter();

  // Navigation State
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);
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
  const [dashboardMetrics, setDashboardMetrics] = useState<any>(null);
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

  const loadDashboardAnalytics = useCallback(async () => {
    try {
      const res = await fetch("/api/payments/razorpay/dashboard");
      const data = await res.json();
      if (data.success && data.metrics) {
        setDashboardMetrics(data.metrics);
      }
    } catch {
      // Fallback gracefully to baseline
    }
  }, []);

  useEffect(() => {
    if (activeTab === "Dashboard") {
      loadDashboardAnalytics();
      loadTransactions(1);
    } else if (activeTab === "Transactions") {
      loadTransactions(txPage);
    } else if (activeTab === "Refunds") {
      loadRefunds(refPage);
    } else if (activeTab === "Settlements") {
      loadSettlements(stlPage);
    }
  }, [activeTab, txPage, refPage, stlPage, loadDashboardAnalytics, loadTransactions, loadRefunds, loadSettlements]);

  const handleTabClick = (tab: DashboardTab) => {
    setActiveTab(tab);
  };

  const handleViewAllTransactions = () => {
    setActiveTab("Transactions");
  };

  const dashboardCards = useMemo(() => {
    const storeCurr =
      (typeof dashboardMetrics?.currency === "object"
        ? dashboardMetrics?.currency?.code
        : dashboardMetrics?.currency) || "INR";
    const defaultZeroRevenue = formatCurrencyMinor(0, storeCurr);

    return razorpayDashboardMetrics.map((card) => {
      if (!dashboardMetrics) {
        if (card.id === "today-revenue") {
          return {
            ...card,
            value: defaultZeroRevenue,
            supportingText: "Real-time daily telemetry",
          };
        }
        return card;
      }
      if (card.id === "today-revenue") {
        return {
          ...card,
          value: dashboardMetrics.todayRevenue?.formattedGross || defaultZeroRevenue,
          supportingText: dashboardMetrics.todayRevenue?.formattedNet
            ? `Net: ${dashboardMetrics.todayRevenue.formattedNet}`
            : card.supportingText,
        };
      }
      if (card.id === "successful-payments") {
        const count =
          typeof dashboardMetrics.successfulPayments === "object"
            ? dashboardMetrics.successfulPayments?.count
            : dashboardMetrics.successfulPayments;
        return {
          ...card,
          value: String(count ?? 0),
          supportingText: `${dashboardMetrics.successRate ?? 100}% Success Rate`,
        };
      }
      if (card.id === "failed-payments") {
        const count =
          typeof dashboardMetrics.failedPayments === "object"
            ? dashboardMetrics.failedPayments?.count
            : dashboardMetrics.failedPayments;
        return {
          ...card,
          value: String(count ?? 0),
          supportingText: count ? `${dashboardMetrics.failureRate ? dashboardMetrics.failureRate.toFixed(1) : "0"}% failure rate` : card.supportingText,
        };
      }
      if (card.id === "pending-payments") {
        const count =
          typeof dashboardMetrics.pendingPayments === "object"
            ? dashboardMetrics.pendingPayments?.count
            : dashboardMetrics.pendingPayments;
        return {
          ...card,
          value: String(count ?? 0),
        };
      }
      return card;
    });
  }, [dashboardMetrics]);

  const displayTransactions = useMemo(() => {
    if (transactions && transactions.length > 0) {
      return transactions.slice(0, 4).map((tx) => ({
        id: tx.providerPaymentId,
        truncatedId:
          tx.providerPaymentId.length > 14
            ? `${tx.providerPaymentId.slice(0, 10)}...`
            : tx.providerPaymentId,
        amount: formatCurrencyMinor(tx.amountMinor, tx.currency || dashboardMetrics?.currency || "INR"),
        customerEmail: tx.customerEmail || tx.customerPhone || "Guest Customer",
        paymentMethod: (tx.paymentMethod || "card").toUpperCase(),
        methodIcon:
          tx.paymentMethod === "upi"
            ? "qr_code_2"
            : tx.paymentMethod === "card"
            ? "credit_card"
            : "payments",
        date: new Date(tx.paidAt || tx.createdAt).toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        status:
          tx.status === "captured"
            ? "Success"
            : tx.status === "failed"
            ? "Failed"
            : "Pending",
        statusIcon:
          tx.status === "captured"
            ? "check_circle"
            : tx.status === "failed"
            ? "cancel"
            : "schedule",
      }));
    }
    return [];
  }, [transactions, dashboardMetrics]);

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

  const currentTrendData: TrendBarPoint[] = useMemo(() => {
    if (dashboardMetrics?.paymentTrends?.[selectedRange]) {
      return dashboardMetrics.paymentTrends[selectedRange];
    }
    return razorpayPaymentTrends[selectedRange] || [];
  }, [dashboardMetrics, selectedRange]);

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
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>Gateway Active (Live Mode)</span>
            </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {dashboardCards.map((card) => (
              <div
                key={card.id}
                data-testid={`metric-card-${card.id}`}
                className="bg-white border border-[#e7e5e4] rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-stone-400 hover:shadow-md transition-all duration-200"
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
                    <span className="text-2xl sm:text-3xl font-bold text-[#0c0a09] tracking-tight">
                      {card.value}
                    </span>
                    {card.badge && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border border-[#e7e5e4] bg-[#fafaf9] text-[#0c0a09]">
                        {card.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#78716c] font-medium">{card.supportingText}</p>
                </div>
              </div>
            ))}
          </div>

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
                  {displayTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#78716c] text-xs">
                        No recent transactions found for this store.
                      </td>
                    </tr>
                  ) : (
                    displayTransactions.map((tx: any) => (
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
                    ))
                  )}
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
        <RazorpayTransactionsView
          embeddedInMarketplace={true}
          hideHeaderNav={true}
          onTabChange={(tab) => handleTabClick(tab as any)}
        />
      )}

      {/* ========================================================================= */}
      {/* VIEW C: FULL REFUNDS TAB */}
      {/* ========================================================================= */}
      {activeTab === "Refunds" && (
        <RazorpayRefundsView
          embeddedInMarketplace={true}
          hideHeaderNav={true}
          onTabChange={(tab) => handleTabClick(tab as any)}
        />
      )}

      {/* ========================================================================= */}
      {/* VIEW D: SETTLEMENTS TAB */}
      {/* ========================================================================= */}
      {activeTab === "Settlements" && (
        <RazorpaySettlementsView
          embeddedInMarketplace={true}
          hideHeaderNav={true}
          onTabChange={(tab) => handleTabClick(tab as any)}
        />
      )}

      {/* ========================================================================= */}
      {/* VIEW E: HEALTH TAB */}
      {/* ========================================================================= */}
      {activeTab === "Health" && (
        <RazorpayHealthView
          embeddedInMarketplace={true}
          hideHeaderNav={true}
          onTabChange={(tab) => handleTabClick(tab as any)}
        />
      )}

      {/* ========================================================================= */}
      {/* VIEW F: SETTINGS TAB */}
      {/* ========================================================================= */}
      {activeTab === "Settings" && (
        <RazorpaySettingsView
          embeddedInMarketplace={true}
          hideHeaderNav={true}
          onTabChange={(tab) => handleTabClick(tab as any)}
        />
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
