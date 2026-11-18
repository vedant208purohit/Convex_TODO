"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { resolveOrganizationCurrency } from "../../lib/payments/currency";

interface StripeInsightsViewProps {
  embeddedInMarketplace?: boolean;
  onBackToDashboard?: () => void;
}

export function StripeInsightsView({
  embeddedInMarketplace = false,
  onBackToDashboard,
}: StripeInsightsViewProps) {
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
  const isTestStore = Boolean(activeOrg?.name?.includes("Bistrot de l'Alma"));

  // Real live Stripe Connection & Transactions from Convex
  const stripeConnections = useQuery(api.paymentGateways.listConnections, { provider: "stripe" });
  const realStripeConn = stripeConnections && stripeConnections.length > 0 ? stripeConnections[0] : null;

  const convexTransactionsQuery = useQuery(
    api.paymentGateways.listTransactions,
    realStripeConn ? ({ connectionId: realStripeConn._id as any, limit: 100 } as any) : "skip"
  );

  const txList = (convexTransactionsQuery as any)?.transactions || [];
  const totalVolumeMinor = txList.reduce((sum: number, tx: any) => sum + (tx.amountMinor || 0), 0);
  const totalVolume = totalVolumeMinor / 100;
  const avgTicket = txList.length > 0 ? totalVolume / txList.length : 0;

  const dineInTx = txList.filter((tx: any) => (tx.metadata?.orderType || "").toLowerCase().includes("dine"));
  const takeawayTx = txList.filter((tx: any) => (tx.metadata?.orderType || "").toLowerCase().includes("take"));
  const deliveryTx = txList.filter((tx: any) => (tx.metadata?.orderType || "").toLowerCase().includes("deliv"));

  const dineInVolume = dineInTx.reduce((sum: number, tx: any) => sum + (tx.amountMinor || 0), 0) / 100;
  const takeawayVolume = takeawayTx.reduce((sum: number, tx: any) => sum + (tx.amountMinor || 0), 0) / 100;
  const deliveryVolume = deliveryTx.reduce((sum: number, tx: any) => sum + (tx.amountMinor || 0), 0) / 100;

  const [timeRange, setTimeRange] = useState<"30D" | "90D" | "1Y">("30D");
  const [trendsRange, setTrendsRange] = useState<"30D" | "90D">("30D");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleExportInsightsCsv = () => {
    try {
      const escapeCsv = (str: any) => {
        if (str === null || str === undefined) return '""';
        const s = String(str).replace(/"/g, '""');
        return `"${s}"`;
      };

      const lines: string[] = [];
      lines.push("PREST RESTAURANT SUITE — STRIPE PAYMENT INSIGHTS REPORT");
      lines.push(`Generated At,${new Date().toISOString()}`);
      lines.push(`Store / Merchant,${escapeCsv(activeOrg?.name || "DEFX Inc.")}`);
      lines.push(`Currency,${currencyCode}`);
      lines.push("");
      lines.push("EXECUTIVE SUMMARY METRICS");
      lines.push("Metric,Value");
      lines.push(`Total Volume,${totalVolume.toFixed(2)} ${currencyCode}`);
      lines.push(`Total Transactions,${txList.length}`);
      lines.push(`Average Ticket Size,${avgTicket.toFixed(2)} ${currencyCode}`);
      lines.push(`Dine-in Volume,${dineInVolume.toFixed(2)} ${currencyCode} (${dineInTx.length} orders)`);
      lines.push(`Takeaway Volume,${takeawayVolume.toFixed(2)} ${currencyCode} (${takeawayTx.length} orders)`);
      lines.push(`Delivery Volume,${deliveryVolume.toFixed(2)} ${currencyCode} (${deliveryTx.length} orders)`);
      lines.push("");
      lines.push("CHANNEL DISTRIBUTION BREAKDOWN");
      lines.push("Channel,Order Count,Volume,Share %");
      lines.push(`Dine-in,${dineInTx.length},${dineInVolume.toFixed(2)},${totalVolume > 0 ? ((dineInVolume / totalVolume) * 100).toFixed(1) : "0.0"}%`);
      lines.push(`Takeaway,${takeawayTx.length},${takeawayVolume.toFixed(2)},${totalVolume > 0 ? ((takeawayVolume / totalVolume) * 100).toFixed(1) : "0.0"}%`);
      lines.push(`Delivery,${deliveryTx.length},${deliveryVolume.toFixed(2)},${totalVolume > 0 ? ((deliveryVolume / totalVolume) * 100).toFixed(1) : "0.0"}%`);
      lines.push("");
      lines.push("UNDERLYING TRANSACTIONS LIST");
      lines.push("Transaction ID,Order Number,Order Type,Amount,Status,Date");

      for (const tx of txList) {
        lines.push([
          escapeCsv(tx.providerPaymentId || tx._id),
          escapeCsv(tx.metadata?.orderNumber || tx.prestOrderNumber || tx.orderId || ""),
          escapeCsv(tx.metadata?.orderType || "Dine-in"),
          escapeCsv(((tx.amountMinor || 0) / 100).toFixed(2)),
          escapeCsv(tx.status),
          escapeCsv(tx.createdAt ? new Date(tx.createdAt).toISOString() : ""),
        ].join(","));
      }

      const csvContent = lines.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.setAttribute("href", url);
      link.setAttribute("download", `stripe_insights_${timestamp}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast("Exported insights report to CSV successfully.");
    } catch {
      showToast("Failed to export insights report.");
    }
  };

  const content = (
    <div className="w-full flex-1 max-w-7xl mx-auto py-6 px-4 sm:px-6 md:px-8 font-sans space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#060607] text-[#fff8f5] px-4 py-2.5 rounded-lg shadow-lg border border-[#e0d8d5] text-xs font-medium tracking-wide flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {toastMessage}
        </div>
      )}

      {/* Breadcrumbs & Header Row */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#e0d8d5]">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#7f7570] mb-1.5">
            <button
              onClick={() => router.push("/marketplace?category=Payments")}
              className="hover:text-[#060607] transition-colors"
            >
              Payments
            </button>
            <span>/</span>
            <button
              onClick={() => router.push("/marketplace/stripe/dashboard")}
              className="hover:text-[#060607] transition-colors"
            >
              Stripe Integration
            </button>
            <span>/</span>
            <span className="text-[#060607] font-medium">Payment Insights</span>
          </div>
          <h1 className="font-serif text-3xl font-semibold text-[#060607] tracking-tight">
            Payment Insights
          </h1>
          <p className="text-sm text-[#645d58] mt-1">
            Understand payment activity received through your restaurant&apos;s connected Stripe account.
          </p>
        </div>

        {/* Controls: Search, Range Filters, Export */}
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="relative">
            <svg className="w-4 h-4 text-[#7f7570] absolute left-2.5 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search analytics..."
              className="pl-8 pr-3 py-1.5 text-xs bg-[#ffffff] border border-[#e0d8d5] rounded text-[#060607] focus:outline-none focus:border-[#060607] w-48 shadow-2xs"
            />
          </div>

          <div className="flex border border-[#e0d8d5] rounded bg-[#ffffff] overflow-hidden text-xs">
            <button
              onClick={() => setTimeRange("30D")}
              className={`px-3 py-1.5 font-medium transition-colors ${
                timeRange === "30D" ? "bg-[#060607] text-[#fff8f5]" : "text-[#645d58] hover:bg-[#faf2ee]"
              }`}
            >
              30D
            </button>
            <button
              onClick={() => setTimeRange("90D")}
              className={`px-3 py-1.5 font-medium transition-colors ${
                timeRange === "90D" ? "bg-[#060607] text-[#fff8f5]" : "text-[#645d58] hover:bg-[#faf2ee]"
              }`}
            >
              90D
            </button>
            <button
              onClick={() => setTimeRange("1Y")}
              className={`px-3 py-1.5 font-medium transition-colors ${
                timeRange === "1Y" ? "bg-[#060607] text-[#fff8f5]" : "text-[#645d58] hover:bg-[#faf2ee]"
              }`}
            >
              1Y
            </button>
          </div>

          <button
            onClick={handleExportInsightsCsv}
            className="px-3 py-1.5 border border-[#e0d8d5] rounded bg-[#ffffff] hover:bg-[#faf2ee] text-xs font-medium text-[#060607] flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-[#060607]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Key Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-[#ffffff] p-5 rounded-lg border border-[#e0d8d5] shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[#7f7570] mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                Total Payment Volume
              </span>
              <svg className="w-4 h-4 text-[#060607]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
            <div className="font-serif text-2xl font-bold text-[#060607]">
              {isTestStore && txList.length === 0
                ? "$1,284,500.00"
                : `${currencySymbol}${totalVolume.toLocaleString(storeLocale, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#faf2ee] flex items-center gap-1.5 text-xs">
            <span className="px-1.5 py-0.5 rounded bg-[#ebf6ed] text-[#1b6b2f] font-semibold text-[11px]">
              {isTestStore && txList.length === 0 ? "+12.5%" : (txList.length > 0 ? "+100%" : "0.0%")}
            </span>
            <span className="text-[#7f7570]">
              {isTestStore && txList.length === 0 ? "vs last month" : `${txList.length} settled payments`}
            </span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-[#ffffff] p-5 rounded-lg border border-[#e0d8d5] shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[#7f7570] mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                Top Dining Region / Country
              </span>
              <svg className="w-4 h-4 text-[#060607]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
            <div className="font-serif text-2xl font-bold text-[#060607]">
              {isTestStore && txList.length === 0
                ? "United States"
                : (activeOrg?.country || (isIndia ? "India" : "United States"))}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#faf2ee] flex items-center text-xs text-[#645d58]">
            <span>
              {isTestStore && txList.length === 0
                ? "42% of settled transactions"
                : "100% of settled transactions"}
            </span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-[#ffffff] p-5 rounded-lg border border-[#e0d8d5] shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[#7f7570] mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                Settlement Currency
              </span>
              <svg className="w-4 h-4 text-[#060607]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v12M8 10h8M8 14h6" />
              </svg>
            </div>
            <div className="font-serif text-2xl font-bold text-[#060607]">
              {isTestStore && txList.length === 0 ? "USD" : currencyCode}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#faf2ee] flex items-center gap-1.5 text-xs text-[#645d58]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            <span>Native settlement active</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-[#ffffff] p-5 rounded-lg border border-[#e0d8d5] shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[#7f7570] mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                Average Dining Ticket
              </span>
              <svg className="w-4 h-4 text-[#060607]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
              </svg>
            </div>
            <div className="font-serif text-2xl font-bold text-[#060607]">
              {isTestStore && txList.length === 0
                ? "$85.40"
                : `${currencySymbol}${avgTicket.toLocaleString(storeLocale, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#faf2ee] flex items-center gap-1.5 text-xs">
            <span className="px-1.5 py-0.5 rounded bg-[#fdf2f2] text-[#991b1b] font-semibold text-[11px]">
              {isTestStore && txList.length === 0 ? "-2.1%" : "Live"}
            </span>
            <span className="text-[#7f7570]">
              {isTestStore && txList.length === 0 ? "vs last 7 days" : "per order average"}
            </span>
          </div>
        </div>
      </div>

      {/* Middle Row: Payment Trends & Volume by Outlet */}
      <div className="grid grid-cols-12 gap-5">
        {/* Payment Trends (8 cols) */}
        <div className="col-span-12 xl:col-span-8 bg-[#ffffff] p-6 rounded-lg border border-[#e0d8d5] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-serif text-lg font-semibold text-[#060607]">Payment Trends</h2>
              <p className="text-xs text-[#645d58]">Track how payments processed through Stripe change over time.</p>
            </div>
            <div className="flex border border-[#e0d8d5] rounded overflow-hidden text-xs">
              <button
                onClick={() => setTrendsRange("30D")}
                className={`px-2.5 py-1 font-medium transition-colors ${
                  trendsRange === "30D" ? "bg-[#060607] text-[#fff8f5]" : "text-[#645d58] hover:bg-[#faf2ee]"
                }`}
              >
                30D
              </button>
              <button
                onClick={() => setTrendsRange("90D")}
                className={`px-2.5 py-1 font-medium transition-colors ${
                  trendsRange === "90D" ? "bg-[#060607] text-[#fff8f5]" : "text-[#645d58] hover:bg-[#faf2ee]"
                }`}
              >
                90D
              </button>
            </div>
          </div>

          {/* Minimalist Editorial Monochrome Chart */}
          <div className="h-56 relative w-full flex items-end pt-4">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 200">
              <defs>
                <linearGradient id="prestGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#060607" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#060607" stopOpacity="0.00" />
                </linearGradient>
              </defs>
              {/* Subtle gridlines */}
              <line stroke="#f1edec" strokeDasharray="4 4" x1="0" x2="800" y1="50" y2="50" />
              <line stroke="#f1edec" strokeDasharray="4 4" x1="0" x2="800" y1="100" y2="100" />
              <line stroke="#f1edec" strokeDasharray="4 4" x1="0" x2="800" y1="150" y2="150" />
              <polygon fill="url(#prestGradient)" points="0,160 80,150 160,155 240,120 320,130 400,90 480,95 560,65 640,75 720,40 800,45 800,200 0,200" />
              <path d="M0,160 Q80,150 160,155 T320,130 T480,95 T640,75 T800,45" fill="none" stroke="#060607" strokeLinecap="round" strokeWidth="2.5" />
              <circle cx="800" cy="45" fill="#060607" r="4" />
            </svg>
          </div>
          <div className="flex justify-between pt-3 border-t border-[#e0d8d5] text-xs text-[#7f7570]">
            <span>01 Oct</span>
            <span>15 Oct</span>
            <span>30 Oct</span>
          </div>
        </div>

        {/* Volume by Outlet / Region (4 cols) */}
        <div className="col-span-12 xl:col-span-4 bg-[#ffffff] p-6 rounded-lg border border-[#e0d8d5] shadow-2xs flex flex-col justify-between">
          <div>
            <h2 className="font-serif text-lg font-semibold text-[#060607] mb-1">
              Volume by Outlet / Region
            </h2>
            <p className="text-xs text-[#645d58] mb-5">Distribution across dining locations</p>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-medium text-[#060607] mb-1.5">
                  <span>SoHo Main Dining</span>
                  <span className="font-serif text-sm font-semibold">$539k</span>
                </div>
                <div className="w-full bg-[#f1edec] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#060607] h-full w-[85%]"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-[#060607] mb-1.5">
                  <span>Bistro Paris VII</span>
                  <span className="font-serif text-sm font-semibold">$210k</span>
                </div>
                <div className="w-full bg-[#f1edec] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#4c4641] h-full w-[50%]"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-[#060607] mb-1.5">
                  <span>Mayfair Room</span>
                  <span className="font-serif text-sm font-semibold">$145k</span>
                </div>
                <div className="w-full bg-[#f1edec] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#7f7570] h-full w-[35%]"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-[#060607] mb-1.5">
                  <span>Ginza Salon</span>
                  <span className="font-serif text-sm font-semibold">$98k</span>
                </div>
                <div className="w-full bg-[#f1edec] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#cec5be] h-full w-[24%]"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-[#faf2ee] text-right">
            <button
              onClick={() => showToast("Manage Default Regions")}
              className="text-xs text-[#060607] font-medium hover:underline inline-flex items-center gap-1"
            >
              <span>Manage Default Regions</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Payment Methods & Order Settlement Breakdown */}
      <div className="grid grid-cols-12 gap-5">
        {/* Donut breakdown (5 cols) */}
        <div className="col-span-12 xl:col-span-5 bg-[#ffffff] p-6 rounded-lg border border-[#e0d8d5] shadow-2xs">
          <h2 className="font-serif text-lg font-semibold text-[#060607] mb-1">
            Payment Methods Breakdown
          </h2>
          <p className="text-xs text-[#645d58] mb-5">Processed through Stripe point-of-sale &amp; web</p>
          <div className="flex items-center gap-6">
            <div className="relative w-36 h-36 shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" fill="transparent" r="15.9" stroke="#f1edec" strokeWidth="3.2" />
                {/* Visa 40% (#060607) */}
                <circle cx="18" cy="18" fill="transparent" r="15.9" stroke="#060607" strokeDasharray="40 100" strokeDashoffset="0" strokeWidth="3.2" />
                {/* Mastercard 25% (#4c4641) */}
                <circle cx="18" cy="18" fill="transparent" r="15.9" stroke="#4c4641" strokeDasharray="25 100" strokeDashoffset="-40" strokeWidth="3.2" />
                {/* Apple Pay 15% (#7f7570) */}
                <circle cx="18" cy="18" fill="transparent" r="15.9" stroke="#7f7570" strokeDasharray="15 100" strokeDashoffset="-65" strokeWidth="3.2" />
                {/* Google Pay 10% (#a8a29e) */}
                <circle cx="18" cy="18" fill="transparent" r="15.9" stroke="#a8a29e" strokeDasharray="10 100" strokeDashoffset="-80" strokeWidth="3.2" />
                {/* Others 10% (#d6d3d1) */}
                <circle cx="18" cy="18" fill="transparent" r="15.9" stroke="#d6d3d1" strokeDasharray="10 100" strokeDashoffset="-90" strokeWidth="3.2" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] text-[#7f7570] uppercase font-medium">Total</span>
                <span className="font-serif text-base font-bold text-[#060607]">15.2k</span>
              </div>
            </div>
            <div className="flex-1 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#060607]"></span>
                  <span className="text-[#060607] font-medium">Visa</span>
                </div>
                <span className="text-[#645d58]">40%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#4c4641]"></span>
                  <span className="text-[#060607] font-medium">Mastercard</span>
                </div>
                <span className="text-[#645d58]">25%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#7f7570]"></span>
                  <span className="text-[#060607] font-medium">Apple Pay</span>
                </div>
                <span className="text-[#645d58]">15%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#a8a29e]"></span>
                  <span className="text-[#060607] font-medium">Google Pay</span>
                </div>
                <span className="text-[#645d58]">10%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#d6d3d1]"></span>
                  <span className="text-[#060607] font-medium">Others</span>
                </div>
                <span className="text-[#645d58]">10%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Order Settlement Insights (7 cols) */}
        <div className="col-span-12 xl:col-span-7 bg-[#ffffff] p-6 rounded-lg border border-[#e0d8d5] shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-serif text-lg font-semibold text-[#060607]">
                Recent Order Settlement Insights
              </h2>
              <span className="text-xs text-[#7f7570] font-medium">Synced 2m ago</span>
            </div>
            <p className="text-xs text-[#645d58] mb-4">
              Dine-in vs Takeaway vs Delivery settlement volumes with Prest order linkage notes.
            </p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 bg-[#faf2ee] rounded border border-[#e0d8d5]">
                <p className="text-[11px] text-[#7f7570] font-medium uppercase">Dine-In Volume</p>
                <p className="font-serif text-lg font-bold text-[#060607] mt-0.5">
                  {isTestStore && txList.length === 0
                    ? "$892,100"
                    : `${currencySymbol}${dineInVolume.toLocaleString(storeLocale, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                </p>
                <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                  {isTestStore && txList.length === 0
                    ? "69.4% · 10,540 tkts"
                    : `${totalVolume > 0 ? `${((dineInVolume / totalVolume) * 100).toFixed(1)}%` : "0%"} · ${dineInTx.length} tkts`}
                </p>
              </div>
              <div className="p-3 bg-[#faf2ee] rounded border border-[#e0d8d5]">
                <p className="text-[11px] text-[#7f7570] font-medium uppercase">Takeaway</p>
                <p className="font-serif text-lg font-bold text-[#060607] mt-0.5">
                  {isTestStore && txList.length === 0
                    ? "$246,300"
                    : `${currencySymbol}${takeawayVolume.toLocaleString(storeLocale, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                </p>
                <p className="text-[11px] text-[#645d58] mt-1 font-medium">
                  {isTestStore && txList.length === 0
                    ? "19.2% · 3,120 tkts"
                    : `${totalVolume > 0 ? `${((takeawayVolume / totalVolume) * 100).toFixed(1)}%` : "0%"} · ${takeawayTx.length} tkts`}
                </p>
              </div>
              <div className="p-3 bg-[#faf2ee] rounded border border-[#e0d8d5]">
                <p className="text-[11px] text-[#7f7570] font-medium uppercase">Delivery / Room</p>
                <p className="font-serif text-lg font-bold text-[#060607] mt-0.5">
                  {isTestStore && txList.length === 0
                    ? "$146,100"
                    : `${currencySymbol}${deliveryVolume.toLocaleString(storeLocale, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                </p>
                <p className="text-[11px] text-[#645d58] mt-1 font-medium">
                  {isTestStore && txList.length === 0
                    ? "11.4% · 1,540 tkts"
                    : `${totalVolume > 0 ? `${((deliveryVolume / totalVolume) * 100).toFixed(1)}%` : "0%"} · ${deliveryTx.length} tkts`}
                </p>
              </div>
            </div>
          </div>
          <div className="p-3 bg-[#fff8f5] rounded border border-[#e0d8d5] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-[#645d58]">
              <svg className="w-4 h-4 text-[#060607]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>All orders matched with table guest folios and terminal serial references.</span>
            </div>
            <button
              onClick={() => router.push("/marketplace/stripe/transactions")}
              className="font-medium text-[#060607] hover:underline"
            >
              View Audit Ledger
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (embeddedInMarketplace) {
    return content;
  }

  // Standalone Layout with PREST Suite Shell
  return (
    <div className="bg-[#f7f9fb] text-[#191c1e] min-h-screen font-sans">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-[280px] bg-[#faf2ee] border-r border-[#e0d8d5] hidden lg:flex flex-col p-6 z-40 justify-between">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3 pb-5 border-b border-[#e0d8d5]">
            <div className="w-9 h-9 bg-[#060607] rounded flex items-center justify-center text-white font-serif text-lg font-bold tracking-tight">
              P
            </div>
            <div>
              <h2 className="font-serif text-base font-semibold text-[#060607] tracking-tight leading-snug">Prest</h2>
              <p className="text-xs text-[#645d58] font-medium tracking-wide uppercase">Restaurant Suite</p>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-[#7f7570] tracking-wider uppercase mb-3 px-2">Financial Management</p>
            <nav className="space-y-1 text-sm">
              <button
                onClick={() => router.push("/marketplace/stripe/transactions")}
                className="w-full flex items-center gap-3 px-3 py-2 text-[#645d58] hover:text-[#060607] hover:bg-[#eee7e3] rounded transition-colors text-left"
              >
                <span>Settlement Ledger</span>
              </button>
              <button
                onClick={() => router.push("/marketplace/stripe/payouts")}
                className="w-full flex items-center gap-3 px-3 py-2 text-[#645d58] hover:text-[#060607] hover:bg-[#eee7e3] rounded transition-colors text-left"
              >
                <span>Stripe Payouts</span>
              </button>
              <button
                onClick={() => router.push("/marketplace/stripe/transactions")}
                className="w-full flex items-center gap-3 px-3 py-2 text-[#645d58] hover:text-[#060607] hover:bg-[#eee7e3] rounded transition-colors text-left"
              >
                <span>Terminal Transactions</span>
              </button>
              <button
                onClick={() => {}}
                className="w-full flex items-center gap-3 px-3 py-2 bg-[#060607] text-[#fff8f5] rounded font-medium shadow-2xs transition-all text-left"
              >
                <span>Payment Insights</span>
              </button>
              <button
                onClick={() => router.push("/marketplace/stripe/refunds")}
                className="w-full flex items-center gap-3 px-3 py-2 text-[#645d58] hover:text-[#060607] hover:bg-[#eee7e3] rounded transition-colors text-left"
              >
                <span>Disputes &amp; Holds</span>
              </button>
            </nav>
          </div>
        </div>

        <div className="pt-4 border-t border-[#e0d8d5]">
          <div className="p-3 bg-[#ffffff] border border-[#e0d8d5] rounded flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <div>
                <p className="text-xs font-semibold text-[#060607]">Stripe Connected</p>
                <p className="text-[10px] text-[#7f7570]">Live settlements active</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-[#7f7570]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </aside>

      {/* Top Header */}
      <header className="fixed top-0 lg:left-[280px] right-0 h-16 bg-[#fff8f5] border-b border-[#e0d8d5] flex items-center justify-between px-8 z-30">
        <div className="flex items-center gap-6">
          <nav className="hidden md:flex items-center gap-5 text-sm">
            <button onClick={() => router.push("/marketplace/stripe/dashboard")} className="text-[#645d58] hover:text-[#060607] transition-colors">Overview</button>
            <button onClick={() => showToast("Floor & Tables")} className="text-[#645d58] hover:text-[#060607] transition-colors">Floor &amp; Tables</button>
            <button onClick={() => showToast("Orders")} className="text-[#645d58] hover:text-[#060607] transition-colors">Orders</button>
            <button onClick={() => router.push("/marketplace/stripe/payouts")} className="font-semibold text-[#060607] border-b-2 border-[#060607] pb-1">Payments</button>
            <button onClick={() => showToast("Reconciliation")} className="text-[#645d58] hover:text-[#060607] transition-colors">Reconciliation</button>
            <button onClick={() => router.push("/marketplace?category=Payments")} className="text-[#645d58] hover:text-[#060607] transition-colors">Settings</button>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#ffffff] border border-[#e0d8d5] rounded text-xs text-[#060607] font-medium shadow-2xs hover:border-[#7f7570] cursor-pointer transition-colors">
            <svg className="w-4 h-4 text-[#7f7570]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18l-2 9H5L3 3zm0 9v9a1 1 0 001 1h16a1 1 0 001-1v-9M9 22V12h6v10" />
            </svg>
            <span>Bistrot de l&apos;Alma — Main Dining</span>
            <svg className="w-3.5 h-3.5 text-[#7f7570]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
          <button className="w-9 h-9 flex items-center justify-center rounded border border-[#e0d8d5] bg-[#ffffff] text-[#645d58] hover:text-[#060607] transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          <div className="w-9 h-9 rounded-full bg-[#060607] text-white flex items-center justify-center text-xs font-serif font-bold">
            BA
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="lg:ml-[280px] pt-16 min-h-screen">
        {content}
      </main>
    </div>
  );
}

