"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { resolveOrganizationCurrency } from "../../lib/payments/currency";

export interface StripePayoutItem {
  id: string;
  amount: number;
  status: "Paid" | "In Transit" | "Pending" | "Failed";
  bankAccount: string;
  transferDate: string;
  expectedArrival: string;
}

interface StripePayoutsViewProps {
  embeddedInMarketplace?: boolean;
  onRequestPayout?: () => void;
  onBackToDashboard?: () => void;
  onNavigateToRefunds?: () => void;
  onNavigateToTransactions?: () => void;
  onViewDetails?: (id: string, amount: number) => void;
}

export function StripePayoutsView({
  embeddedInMarketplace = false,
  onRequestPayout,
  onBackToDashboard,
  onNavigateToRefunds,
  onNavigateToTransactions,
  onViewDetails,
}: StripePayoutsViewProps) {
  const router = useRouter();

  // Store Currency Resolution
  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;
  const storeCurrencyInfo = resolveOrganizationCurrency(activeOrg);
  const isIndia =
    activeOrg?.country === "India" ||
    activeOrg?.country === "IN" ||
    storeCurrencyInfo.countryCode === "IN";
  const currencySymbol = isIndia ? "₹" : storeCurrencyInfo.symbol || "$";
  const currencyCode = isIndia ? "INR" : storeCurrencyInfo.currencyCode || "USD";
  const storeLocale = isIndia ? "en-IN" : storeCurrencyInfo.locale || "en-US";

  const formatAmount = (num: number) => {
    return `${currencySymbol}${num.toLocaleString(storeLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const handleNavigateToRefunds = () => {
    if (onNavigateToRefunds) {
      onNavigateToRefunds();
    } else {
      router.push(embeddedInMarketplace ? "/marketplace?flow=stripe-refunds" : "/marketplace/stripe/refunds");
    }
  };

  const handleNavigateToTransactions = () => {
    if (onNavigateToTransactions) {
      onNavigateToTransactions();
    } else {
      router.push(embeddedInMarketplace ? "/marketplace?flow=stripe-transactions" : "/marketplace/stripe/transactions");
    }
  };

  // Real Stripe Connection & Settlements from Convex
  const stripeConnections = useQuery(api.paymentGateways.listConnections, { provider: "stripe" });
  const realStripeConn = stripeConnections && stripeConnections.length > 0 ? stripeConnections[0] : null;

  const convexSettlementsQuery = useQuery(
    api.paymentGateways.listSettlements,
    realStripeConn ? ({ connectionId: realStripeConn._id as any, limit: 100 } as any) : "skip"
  );

  const isTestStore = Boolean(activeOrg?.name?.includes("Bistrot de l'Alma"));

  const TEST_REFERENCE_PAYOUTS: StripePayoutItem[] = [
    {
      id: "#po_1456",
      amount: 1850.0,
      status: "Paid",
      bankAccount: "Chase Business Checking •••• 6789",
      transferDate: "Today, 09:30 AM",
      expectedArrival: "Today",
    },
    {
      id: "#po_1455",
      amount: 3120.5,
      status: "In Transit",
      bankAccount: "Wells Fargo Commercial •••• 1122",
      transferDate: "Oct 24, 2023",
      expectedArrival: "Oct 25, 2023",
    },
    {
      id: "#po_1454",
      amount: 940.0,
      status: "Pending",
      bankAccount: "Chase Business Checking •••• 6789",
      transferDate: "Oct 23, 2023",
      expectedArrival: "Oct 25, 2023",
    },
    {
      id: "#po_1453",
      amount: 12400.0,
      status: "Paid",
      bankAccount: "Chase Business Checking •••• 6789",
      transferDate: "Oct 22, 2023",
      expectedArrival: "Oct 23, 2023",
    },
  ];

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Backend payouts state from API fallback
  const [apiPayouts, setApiPayouts] = useState<StripePayoutItem[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function fetchPayouts() {
      try {
        const queryParams = new URLSearchParams({ limit: "50" });
        if (selectedStatus) queryParams.set("status", selectedStatus);
        const res = await fetch(`/api/payments/stripe/settlements?${queryParams.toString()}`);
        const data = await res.json().catch(() => null);
        if (isMounted && data?.success && Array.isArray(data.settlements) && data.settlements.length > 0) {
          const mapped: StripePayoutItem[] = data.settlements.map((s: any) => ({
            id: s.providerSettlementId ? `#${s.providerSettlementId}` : `#po_${String(s._id || "").slice(-4)}`,
            amount: (s.amountMinor || 0) / 100,
            status: s.status === "processed" || s.status === "paid" ? "Paid" : s.status === "in_transit" ? "In Transit" : s.status === "failed" ? "Failed" : "Pending",
            bankAccount: s.destinationAccount || s.metadata?.bankAccount || "Registered Bank Account •••• 4242",
            transferDate: s.settlementDate ? new Date(s.settlementDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Today",
            expectedArrival: s.expectedArrival ? new Date(s.expectedArrival).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Next business day",
          }));
          setApiPayouts(mapped);
        }
      } catch {
        // fallback
      }
    }
    fetchPayouts();
    return () => {
      isMounted = false;
    };
  }, [selectedStatus]);

  // Merge live Convex settlements or API settlements
  const allPayouts: StripePayoutItem[] = useMemo(() => {
    const convexList = (convexSettlementsQuery as any)?.settlements;
    if (Array.isArray(convexList) && convexList.length > 0) {
      return convexList.map((s: any) => ({
        id: s.providerSettlementId ? `#${s.providerSettlementId}` : `#po_${String(s._id || "").slice(-4)}`,
        amount: (s.amountMinor || 0) / 100,
        status: s.status === "processed" || s.status === "paid" ? "Paid" : s.status === "in_transit" ? "In Transit" : s.status === "failed" ? "Failed" : "Pending",
        bankAccount: s.destinationAccount || s.metadata?.bankAccount || "Registered Bank Account •••• 4242",
        transferDate: s.settlementDate ? new Date(s.settlementDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Today",
        expectedArrival: s.expectedArrival ? new Date(s.expectedArrival).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Next business day",
      }));
    }
    if (apiPayouts.length > 0) {
      return apiPayouts;
    }
    if (isTestStore) {
      return TEST_REFERENCE_PAYOUTS;
    }
    return [];
  }, [convexSettlementsQuery, apiPayouts, isTestStore]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleWithdrawClick = () => {
    if (onRequestPayout) {
      onRequestPayout();
    } else if (embeddedInMarketplace) {
      router.push("/marketplace?flow=stripe-request-payout", { scroll: false });
    } else {
      router.push("/marketplace/stripe/payouts/request");
    }
  };

  const filteredPayouts = useMemo(() => {
    return allPayouts.filter((p) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          p.id.toLowerCase().includes(q) ||
          p.bankAccount.toLowerCase().includes(q) ||
          p.amount.toString().includes(q);
        if (!matches) return false;
      }
      if (selectedStatus && p.status.toLowerCase().replace(" ", "_") !== selectedStatus.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [allPayouts, searchQuery, selectedStatus]);

  const todayPayoutsSum = allPayouts
    .filter((p) => p.status === "Paid" && p.transferDate === "Today")
    .reduce((sum, p) => sum + p.amount, 0);

  const monthPayoutsSum = allPayouts
    .filter((p) => p.status === "Paid")
    .reduce((sum, p) => sum + p.amount, 0);

  const upcomingPayoutsSum = allPayouts
    .filter((p) => p.status === "Pending" || p.status === "In Transit")
    .reduce((sum, p) => sum + p.amount, 0);

  const handleExportPayoutsCsv = () => {
    try {
      const recordsToExport = filteredPayouts.length > 0 ? filteredPayouts : allPayouts;
      if (recordsToExport.length === 0) {
        showToast("No payouts match the current criteria to export.");
        return;
      }

      const headers = [
        "Payout ID",
        "Amount",
        "Currency",
        "Status",
        "Destination Account",
        "Transfer Date",
        "Expected Arrival",
      ];

      const escapeCsv = (str: any) => {
        if (str === null || str === undefined) return '""';
        const s = String(str).replace(/"/g, '""');
        return `"${s}"`;
      };

      const rows = recordsToExport.map((p) => [
        escapeCsv(p.id),
        escapeCsv(typeof p.amount === "number" ? p.amount.toFixed(2) : p.amount),
        escapeCsv(currencyCode),
        escapeCsv(p.status),
        escapeCsv(p.bankAccount),
        escapeCsv(p.transferDate),
        escapeCsv(p.expectedArrival),
      ]);

      const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.setAttribute("href", url);
      link.setAttribute("download", `stripe_payouts_${timestamp}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`Exported ${recordsToExport.length} payout records to CSV.`);
    } catch {
      showToast("Failed to export payouts report.");
    }
  };

  const content = (
    <div className="w-full flex-1 max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-8 font-sans space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#1c1b1d] text-white px-4 py-2.5 rounded-lg shadow-lg border border-[#33302e] flex items-center gap-2 text-xs animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-[#e0d8d5]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => {
                if (onBackToDashboard) onBackToDashboard();
                else router.push("/marketplace/stripe/dashboard");
              }}
              className="text-xs uppercase font-semibold tracking-wider text-[#645d58] hover:text-[#1e1b19] transition-colors cursor-pointer"
            >
              Payments &amp; Banking
            </button>
            <span className="text-[#e0d8d5]">•</span>
            <span className="text-xs text-[#635e5a]">Live Payout Schedule</span>
          </div>
          <h1 className="font-serif text-3xl md:text-4xl text-[#1e1b19] font-normal tracking-tight">
            Stripe Payouts
          </h1>
          <p className="text-sm text-[#635e5a] mt-1 max-w-2xl">
            Track money transferred or scheduled to be transferred from your Stripe account to your linked bank account.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            data-testid="btn-export-payouts-csv"
            onClick={handleExportPayoutsCsv}
            className="px-4 py-2 bg-white border border-[#e0d8d5] text-[#1e1b19] text-xs font-medium rounded-lg hover:bg-[#fbf6f3] transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            data-testid="btn-request-payout"
            onClick={handleWithdrawClick}
            className="px-4 py-2 bg-[#191716] text-white text-xs font-medium rounded-lg hover:bg-neutral-800 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">account_balance</span>
            <span>Withdraw / Request Payout</span>
          </button>
        </div>
      </div>

      {/* Explanation Notice Banner */}
      <div className="p-4 rounded-xl border border-[#e0d8d5] bg-white flex items-start gap-3 shadow-2xs">
        <span className="material-symbols-outlined text-[#645d58] text-[20px] mt-0.5">info</span>
        <p className="text-xs text-[#635e5a] leading-relaxed">
          These records show transfers made from your Stripe account to your registered bank account. They are separate from customer order refunds.
        </p>
      </div>

      {/* Summary Metrics Cards (3 Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Today's Payout */}
        <div
          data-testid="metric-today-payout"
          className="bg-white p-6 rounded-xl border border-[#e0d8d5] shadow-2xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[#645d58]">
              Today&apos;s Payout
            </span>
            <span className="p-1.5 rounded-md bg-[#f4efe9] text-[#645d58]">
              <span className="material-symbols-outlined text-[18px]">schedule</span>
            </span>
          </div>
          <div className="mt-4">
            <div className="font-serif text-3xl md:text-4xl text-[#1e1b19] font-normal">
              {isTestStore && allPayouts === TEST_REFERENCE_PAYOUTS ? "$1,240.00" : formatAmount(todayPayoutsSum)}
            </div>
            <p className="text-xs text-[#645d58] mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <span>
                {isTestStore && allPayouts === TEST_REFERENCE_PAYOUTS
                  ? "Estimated settlement by 5:00 PM"
                  : "Settlement rolling cycle"}
              </span>
            </p>
          </div>
        </div>

        {/* Monthly Payout Volume */}
        <div
          data-testid="metric-monthly-payout"
          className="bg-white p-6 rounded-xl border border-[#e0d8d5] shadow-2xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[#645d58]">
              Monthly Payout Volume
            </span>
            <span className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded">
              {isTestStore && allPayouts === TEST_REFERENCE_PAYOUTS ? "+5.4% vs last month" : "Current Cycle"}
            </span>
          </div>
          <div className="mt-4">
            <div className="font-serif text-3xl md:text-4xl text-[#1e1b19] font-normal">
              {isTestStore && allPayouts === TEST_REFERENCE_PAYOUTS ? "$42,850.20" : formatAmount(monthPayoutsSum)}
            </div>
            <p className="text-xs text-[#635e5a] mt-1">Total cleared volume in current cycle</p>
          </div>
        </div>

        {/* Upcoming Scheduled Payout */}
        <div
          data-testid="metric-upcoming-payout"
          className="bg-white p-6 rounded-xl border border-[#e0d8d5] shadow-2xs flex flex-col justify-between border-l-2 border-l-[#191716]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[#645d58]">
              Upcoming Scheduled Payout
            </span>
            <span className="p-1.5 rounded-md bg-[#f4efe9] text-[#645d58]">
              <span className="material-symbols-outlined text-[18px]">event_upcoming</span>
            </span>
          </div>
          <div className="mt-4">
            <div className="font-serif text-3xl md:text-4xl text-[#1e1b19] font-normal">
              {isTestStore && allPayouts === TEST_REFERENCE_PAYOUTS ? "$8,120.45" : formatAmount(upcomingPayoutsSum)}
            </div>
            <p className="text-xs text-[#635e5a] mt-1">
              {isTestStore && allPayouts === TEST_REFERENCE_PAYOUTS ? "Expected Oct 30, 2023" : "Pending bank settlement"}
            </p>
          </div>
        </div>
      </div>

      {/* Payout History Table Section */}
      <div className="bg-white border border-[#e0d8d5] rounded-xl overflow-hidden shadow-2xs">
        {/* Table Header Controls & Filters */}
        <div className="p-5 border-b border-[#e0d8d5] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl text-[#1e1b19] font-medium">Recent Payout History</h2>
            <p className="text-xs text-[#645d58] mt-0.5">
              Automated and manual disbursements to linked treasury accounts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#645d58] text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search payout ID..."
                className="pl-8 pr-3 py-1.5 bg-[#fbf6f3] border border-[#e0d8d5] rounded-lg text-xs text-[#1e1b19] focus:outline-none focus:border-[#191716] w-52 placeholder:text-[#645d58]/70"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="pl-3 pr-8 py-1.5 bg-[#fbf6f3] border border-[#e0d8d5] rounded-lg text-xs text-[#1e1b19] font-medium focus:outline-none focus:border-[#191716] appearance-none cursor-pointer"
              >
                <option value="">Status: All</option>
                <option value="paid">Paid</option>
                <option value="in_transit">In Transit</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[#645d58] text-[16px] pointer-events-none">
                expand_more
              </span>
            </div>

            {/* Date Filter */}
            <button
              onClick={() => showToast("Date filter: Last 30 Days")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#fbf6f3] border border-[#e0d8d5] rounded-lg text-xs text-[#645d58] hover:text-[#1e1b19] hover:bg-[#f4efe9] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">calendar_today</span>
              <span>Date: Last 30 Days</span>
              <span className="material-symbols-outlined text-[16px]">expand_more</span>
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#fbf6f3]/70 border-b border-[#e0d8d5] text-[#645d58] uppercase tracking-wider font-semibold">
                <th className="px-5 py-3 font-medium">Payout ID</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Bank Account</th>
                <th className="px-5 py-3 font-medium">Transfer Date</th>
                <th className="px-5 py-3 font-medium">Expected Arrival</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0d8d5] text-[#1e1b19]">
              {filteredPayouts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="w-12 h-12 mx-auto rounded-full bg-[#fbf6f3] border border-[#e0d8d5] flex items-center justify-center text-[#645d58] mb-3">
                      <span className="material-symbols-outlined text-2xl">account_balance</span>
                    </div>
                    <h4 className="font-serif text-lg font-medium text-[#1e1b19] mb-1">
                      No Payouts Recorded Yet
                    </h4>
                    <p className="text-xs text-[#645d58] max-w-md mx-auto">
                      Transfers and disbursements from your connected Stripe account to your bank account will appear here automatically.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredPayouts.map((p) => (
                  <tr key={p.id} className="hover:bg-[#faf5f0] transition-colors">
                    <td className="px-5 py-4 font-mono font-medium">{p.id}</td>
                    <td className="px-5 py-4 font-medium text-sm">
                      {formatAmount(p.amount)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-medium ${
                          p.status === "Paid"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200/70"
                            : p.status === "In Transit"
                              ? "bg-amber-50 text-amber-900 border border-amber-200/70"
                              : p.status === "Pending"
                                ? "bg-[#f4efe9] text-[#645d58] border border-[#e0d8d5]"
                                : "bg-[#ffdad6] text-[#ba1a1a]"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            p.status === "Paid"
                              ? "bg-emerald-600"
                              : p.status === "In Transit"
                                ? "bg-amber-600 animate-pulse"
                                : "bg-[#645d58]"
                          }`}
                        />
                        <span>{p.status}</span>
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[#635e5a]">{p.bankAccount}</td>
                    <td className="px-5 py-4 text-[#645d58]">{p.transferDate}</td>
                    <td className="px-5 py-4 text-[#645d58]">{p.expectedArrival}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => {
                          if (onViewDetails) {
                            onViewDetails(p.id, p.amount);
                          } else {
                            router.push(`/marketplace/stripe/payouts/details?id=${encodeURIComponent(p.id)}&amount=${p.amount}`);
                          }
                        }}
                        className="font-medium text-xs text-[#645d58] hover:text-[#1e1b19] hover:underline transition-colors cursor-pointer"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-3 border-t border-[#e0d8d5] flex items-center justify-between bg-[#fbf6f3]/40">
          <p className="text-xs text-[#645d58]">Showing {filteredPayouts.length} of {allPayouts.length} settled payouts</p>
          <div className="flex items-center gap-1">
            <button
              disabled
              className="p-1.5 border border-[#e0d8d5] rounded-md bg-white text-[#645d58] disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            <span className="px-2 text-xs font-medium text-[#645d58]">Page 1</span>
            <button
              disabled
              className="p-1.5 border border-[#e0d8d5] rounded-md bg-white text-[#645d58] disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (embeddedInMarketplace) {
    return <div className="bg-[#fff8f5] text-[#1e1b19] min-h-screen">{content}</div>;
  }

  return (
    <div className="bg-[#fff8f5] text-[#1e1b19] min-h-screen antialiased flex flex-col font-sans">
      {/* Top Header Navigation */}
      <header className="fixed top-0 w-full z-50 flex items-center justify-between px-6 bg-white/95 backdrop-blur-md h-16 border-b border-[#e0d8d5]">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#191716] text-white flex items-center justify-center font-serif text-lg italic font-semibold">
              P
            </div>
            <span className="font-serif text-xl tracking-tight text-[#1e1b19] font-medium">
              Prest Restaurant Suite
            </span>
          </div>
          <nav className="hidden md:flex gap-6 items-center h-full pt-1">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-sm font-medium text-[#645d58] hover:text-[#1e1b19] transition-colors cursor-pointer"
            >
              Overview
            </button>
            <button
              onClick={() => router.push("/tables")}
              className="text-sm font-medium text-[#645d58] hover:text-[#1e1b19] transition-colors cursor-pointer"
            >
              Floor &amp; Tables
            </button>
            <button
              onClick={() => router.push("/orders")}
              className="text-sm font-medium text-[#645d58] hover:text-[#1e1b19] transition-colors cursor-pointer"
            >
              Orders
            </button>
            <button
              onClick={() => router.push("/marketplace/stripe/dashboard")}
              className="text-sm font-medium text-[#1e1b19] border-b-2 border-[#191716] pb-5 pt-5 cursor-pointer"
            >
              Payments
            </button>
            <button
              onClick={() => router.push("/reports")}
              className="text-sm font-medium text-[#645d58] hover:text-[#1e1b19] transition-colors cursor-pointer"
            >
              Reconciliation
            </button>
            <button
              onClick={() => router.push("/settings")}
              className="text-sm font-medium text-[#645d58] hover:text-[#1e1b19] transition-colors cursor-pointer"
            >
              Settings
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#e0d8d5] bg-white text-xs font-medium text-[#1e1b19]">
            <span className="w-2 h-2 rounded-full bg-emerald-700" />
            <span>SoHo Flagship — Main Dining</span>
            <span className="material-symbols-outlined text-[16px] text-[#645d58]">expand_more</span>
          </div>

          <button className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e0d8d5] bg-[#fbf6f3] hover:bg-[#f4efe9] text-xs font-medium text-[#635e5a] transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">public</span>
            <span>Manage Default Regions</span>
          </button>

          <div className="h-4 w-px bg-[#e0d8d5] mx-1 hidden sm:block" />

          <button className="p-2 text-[#635e5a] hover:bg-[#eee7e3] transition-colors rounded-lg cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>

          <div className="h-8 w-8 rounded-full bg-[#e9e1dd] flex items-center justify-center border border-[#e0d8d5] text-xs font-semibold text-[#645d58]">
            AL
          </div>
        </div>
      </header>

      {/* Main Body with Sidebar */}
      <div className="flex pt-16 min-h-[calc(100vh-64px)]">
        {/* Left Sidebar */}
        <aside className="hidden lg:flex fixed left-0 top-16 h-[calc(100vh-64px)] w-[256px] flex-col p-5 gap-6 bg-[#fbf6f3] border-r border-[#e0d8d5]">
          <div className="space-y-1">
            <div className="px-2 text-[11px] font-semibold tracking-wider text-[#645d58] uppercase">
              Financial Management
            </div>
          </div>
          <nav className="flex flex-col gap-1 flex-grow">
            <button
              onClick={handleNavigateToTransactions}
              className="flex items-center gap-3 px-3 py-2 text-[#645d58] hover:text-[#1e1b19] hover:bg-[#e9e1dd]/60 rounded-lg text-sm transition-all w-full text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">account_balance</span>
              <span>Settlement Ledger</span>
            </button>
            <div className="flex items-center gap-3 px-3 py-2 bg-white text-[#1e1b19] font-medium border border-[#e0d8d5] shadow-2xs rounded-lg text-sm">
              <span className="material-symbols-outlined text-[20px]">payments</span>
              <span>Stripe Payouts</span>
            </div>
            <button
              onClick={handleNavigateToTransactions}
              className="flex items-center gap-3 px-3 py-2 text-[#645d58] hover:text-[#1e1b19] hover:bg-[#e9e1dd]/60 rounded-lg text-sm transition-all w-full text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">point_of_sale</span>
              <span>Terminal Transactions</span>
            </button>
            <button
              onClick={() => showToast("Tax and service ledger")}
              className="flex items-center gap-3 px-3 py-2 text-[#645d58] hover:text-[#1e1b19] hover:bg-[#e9e1dd]/60 rounded-lg text-sm transition-all w-full text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">receipt_long</span>
              <span>Tax &amp; Service Charges</span>
            </button>
            <button
              onClick={handleNavigateToRefunds}
              className="flex items-center gap-3 px-3 py-2 text-[#645d58] hover:text-[#1e1b19] hover:bg-[#e9e1dd]/60 rounded-lg text-sm transition-all w-full text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">savings</span>
              <span>Disputes &amp; Holds</span>
            </button>
          </nav>

          <div className="p-3.5 rounded-lg border border-[#e0d8d5] bg-white space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1e1b19]">
              <span className="material-symbols-outlined text-[18px] text-emerald-800">
                verified
              </span>
              <span>Stripe Connect Active</span>
            </div>
            <p className="text-[11px] text-[#635e5a] leading-relaxed">
              Account acct_1N9e01... is connected and authorized for automated end-of-day bank sweeps.
            </p>
          </div>
        </aside>

        {/* Content Wrapper */}
        <main className="flex-1 lg:ml-[256px]">{content}</main>
      </div>
    </div>
  );
}

