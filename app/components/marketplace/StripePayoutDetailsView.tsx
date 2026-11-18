"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { resolveOrganizationCurrency } from "../../lib/payments/currency";

interface StripePayoutDetailsViewProps {
  embeddedInMarketplace?: boolean;
  payoutId?: string;
  amount?: number;
  onBack?: () => void;
}

export function StripePayoutDetailsView({
  embeddedInMarketplace = false,
  payoutId: initialId,
  amount: initialAmount,
  onBack,
}: StripePayoutDetailsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const queryId = searchParams?.get("id");
  const payoutId = initialId || queryId || "#PO_238912";

  const isTestStore = activeOrg?.name?.includes("Bistrot de l'Alma");
  const cleanPayoutId = payoutId.replace(/^#/, "");
  const settlementData = useQuery(
    api.paymentGateways.getSettlement,
    !isTestStore && cleanPayoutId && !cleanPayoutId.startsWith("PO_")
      ? { settlementId: cleanPayoutId }
      : "skip"
  );

  const queryAmount = searchParams?.get("amount");
  const resolvedAmount = settlementData?.amountMinor
    ? settlementData.amountMinor / 100
    : initialAmount ?? (queryAmount ? parseFloat(queryAmount) : 2000.0);
  const parsedAmount = resolvedAmount;
  const payoutAmount = isNaN(parsedAmount) || parsedAmount <= 0 ? 2000.0 : parsedAmount;

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push("/marketplace/stripe/payouts");
    }
  };

  const formattedAmount = payoutAmount.toLocaleString(storeLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const content = (
    <div className="w-full flex-1 max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-8 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#1e1b19] text-[#fff8f5] px-4 py-2.5 rounded-lg shadow-lg border border-[#e5e2e1] text-xs font-medium tracking-wide flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {toastMessage}
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-[#7f7570] mb-3">
        <button
          type="button"
          onClick={() => router.push("/marketplace?category=Payments")}
          className="hover:text-[#1e1b19] transition-colors"
        >
          Payments &amp; Banking
        </button>
        <span className="text-[#c4c7c7]">/</span>
        <button
          type="button"
          onClick={handleBack}
          className="hover:text-[#1e1b19] transition-colors"
        >
          Stripe Payouts
        </button>
        <span className="text-[#c4c7c7]">/</span>
        <span className="font-medium text-[#1e1b19] font-mono">{payoutId}</span>
      </nav>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 mb-8 border-b border-[#e5e2e1]">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl font-normal text-[#1e1b19] tracking-tight leading-tight">
            Payout Details <span className="font-mono font-normal text-2xl text-[#645d58]">{payoutId}</span>
          </h1>
          <p className="text-sm text-[#7f7570] mt-1.5 font-sans">
            View the details of funds transferred from your Stripe account to your registered commercial bank account.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => showToast("Receipt downloaded.")}
            className="px-4 py-2 border border-[#7f7570]/40 text-[#1e1b19] text-xs font-semibold tracking-wide uppercase rounded hover:bg-[#f7f3f2] transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-[#7f7570]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Download Receipt</span>
          </button>
          <button
            type="button"
            onClick={() => showToast("Opening Stripe Dashboard in secure view...")}
            className="px-4 py-2 bg-[#1e1b19] text-[#fff8f5] text-xs font-semibold tracking-wide uppercase rounded hover:bg-[#313030] transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-neutral-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span>View in Stripe</span>
          </button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Primary Summary Card (Span 8) */}
        <div className="md:col-span-8 bg-white border border-[#e5e2e1] rounded-lg p-6 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start mb-6 pb-6 border-b border-[#f1edec]">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#7f7570] mb-1 font-sans">
                Total Payout Amount
              </p>
              <div className="flex items-baseline gap-2">
                <h2 className="font-serif text-4xl md:text-5xl font-normal text-[#1e1b19]">
                  {currencySymbol}{formattedAmount}
                </h2>
                <span className="text-sm font-semibold text-[#7f7570] font-mono tracking-wider">{currencyCode}</span>
              </div>
            </div>
            <div className="px-3 py-1 bg-[#ebe1da] text-[#1e1b19] border border-[#cec5be] rounded-full flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#645d58] animate-pulse"></span>
              <span className="text-xs font-medium font-sans">Processing</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#7f7570] mb-1 font-sans">
                Created Date
              </p>
              <p className="text-sm font-medium text-[#1e1b19]">Oct 24, 2023</p>
              <p className="text-[11px] text-[#7f7570]">09:00 CET</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#7f7570] mb-1 font-sans">
                Est. Arrival
              </p>
              <p className="text-sm font-medium text-[#1e1b19]">Oct 25, 2023</p>
              <p className="text-[11px] text-emerald-700 font-medium">On schedule</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#7f7570] mb-1 font-sans">
                Destination
              </p>
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-[#7f7570]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 2l9 5H3l9-5z" />
                </svg>
                <p className="text-sm font-medium text-[#1e1b19]">
                  {isTestStore
                    ? "Chase Comm."
                    : activeOrg?.paymentSplitting?.bankDetails?.bankName || (isIndia ? "HDFC Bank" : "Chase Comm.")}
                </p>
              </div>
              <p className="text-[11px] text-[#7f7570]">Checking</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#7f7570] mb-1 font-sans">
                Account
              </p>
              <p className="text-sm font-mono font-medium text-[#1e1b19]">
                {isTestStore
                  ? "•••• 4582"
                  : activeOrg?.paymentSplitting?.bankDetails?.accountNumber
                    ? `•••• ${activeOrg.paymentSplitting.bankDetails.accountNumber.slice(-4)}`
                    : "•••• 4582"}
              </p>
              <p className="text-[11px] text-[#7f7570]">Verified</p>
            </div>
          </div>
        </div>

        {/* Reference & Clearance Callout (Span 4) */}
        <div className="md:col-span-4 bg-[#1e1b19] text-[#fff8f5] rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-[#cbc5c2]">
                Stripe Reference
              </p>
              <svg className="w-4 h-4 text-[#cec5be]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v2H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-1V6a4 4 0 00-4-4zm2 6V6a2 2 0 10-4 0v2h4z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-mono text-2xl font-bold tracking-tight text-white mb-4">
              {isTestStore
                ? "Ref-8239"
                : settlementData?.utrOrReference || settlementData?.providerSettlementId || payoutId}
            </h3>
            <p className="text-xs text-[#cbc5c2] leading-relaxed mb-4">
              {isTestStore
                ? "Transfer initiated automatically via daily revenue sweep for Bistrot de l'Alma."
                : `Transfer initiated automatically via revenue sweep for ${activeOrg?.name || "your store"}.`}
            </p>
          </div>
          <div className="p-3 bg-[#313030] rounded border border-white/10 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-[#cec5be] shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="text-[11px] text-[#e7e1de] leading-snug">
              {isTestStore
                ? "Funds are credited within 1–2 business days depending on Chase Commercial settlement cutoff times."
                : "Funds are credited within 1–2 business days depending on commercial bank settlement cutoff times."}
            </span>
          </div>
        </div>

        {/* Payout Timeline Card (Span 12) */}
        <div className="md:col-span-12 bg-white border border-[#e5e2e1] rounded-lg p-6 shadow-xs">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-serif text-lg font-bold text-[#1e1b19]">Payout Timeline</h3>
              <p className="text-xs text-[#7f7570]">Real-time status updates from Stripe Banking Infrastructure</p>
            </div>
            <span className="text-xs font-mono text-[#7f7570]">Updated 14 mins ago</span>
          </div>
          <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-y-8 px-2 md:px-8">
            {/* Base Track */}
            <div className="absolute left-[23px] top-4 bottom-4 md:left-8 md:right-8 md:top-[18px] md:bottom-auto w-[2px] md:w-auto md:h-[2px] bg-[#e5e2e1] z-0"></div>
            {/* Active Progress Track */}
            <div className="absolute left-[23px] top-4 h-[35%] md:left-8 md:w-[35%] md:h-[2px] bg-[#1e1b19] z-0"></div>

            {/* Step 1: Payout Requested */}
            <div className="relative z-10 flex md:flex-col items-center gap-3 text-left md:text-center">
              <div className="w-9 h-9 rounded-full bg-[#1e1b19] text-white flex items-center justify-center">
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-[#1e1b19]">Payout Requested</p>
                <p className="text-[11px] text-[#7f7570]">Oct 24, 09:00 AM</p>
              </div>
            </div>

            {/* Step 2: Processing (Active) */}
            <div className="relative z-10 flex md:flex-col items-center gap-3 text-left md:text-center">
              <div className="w-9 h-9 rounded-full bg-white border-2 border-[#1e1b19] text-[#1e1b19] ring-4 ring-[#ebe1da] flex items-center justify-center">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-[#1e1b19]">Processing</p>
                <p className="text-[11px] font-semibold text-[#645d58]">In Progress</p>
              </div>
            </div>

            {/* Step 3: Sent to Bank */}
            <div className="relative z-10 flex md:flex-col items-center gap-3 text-left md:text-center">
              <div className="w-9 h-9 rounded-full bg-[#f1edec] border border-[#cec5be] text-[#7f7570] flex items-center justify-center">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 2l9 5H3l9-5z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-[#7f7570]">Sent to Bank</p>
                <p className="text-[11px] text-[#7f7570]">Expected Oct 25</p>
              </div>
            </div>

            {/* Step 4: Completed */}
            <div className="relative z-10 flex md:flex-col items-center gap-3 text-left md:text-center">
              <div className="w-9 h-9 rounded-full bg-[#f1edec] border border-[#cec5be] text-[#7f7570] flex items-center justify-center">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-[#7f7570]">Completed</p>
                <p className="text-[11px] text-[#7f7570]">Expected Oct 25</p>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Details Card (Span 12) */}
        <div className="md:col-span-12 bg-white border border-[#e5e2e1] rounded-lg shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e5e2e1] bg-[#faf2ee] flex justify-between items-center">
            <h3 className="font-serif text-base font-bold text-[#1e1b19]">Additional Details</h3>
            <span className="text-xs font-sans text-[#7f7570]">Stripe Payout Protocol v2</span>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
            <div className="flex justify-between items-center py-2.5 border-b border-[#f1edec]">
              <span className="text-sm text-[#7f7570]">Currency</span>
              <span className="text-sm font-semibold font-mono text-[#1e1b19]">{currencyCode} ({currencySymbol})</span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-[#f1edec]">
              <span className="text-sm text-[#7f7570]">Payout Type</span>
              <span className="text-sm font-medium text-[#1e1b19]">Standard Daily Batch Sweep</span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-[#f1edec]">
              <span className="text-sm text-[#7f7570]">Processing Fee</span>
              <span className="text-sm font-semibold text-[#1e1b19]">
                {currencySymbol}0.00 <span className="text-[11px] text-[#7f7570] font-normal">(Included in plan)</span>
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-[#f1edec]">
              <span className="text-sm text-[#7f7570]">Bank Reference Code</span>
              <span className="text-sm font-mono font-medium text-[#1e1b19] uppercase">BNK-8921-X2</span>
            </div>
            <div className="flex justify-between items-center pt-4 col-span-1 md:col-span-2">
              <div>
                <span className="font-serif text-lg font-bold text-[#1e1b19]">Net Settlement Amount</span>
                <p className="text-xs text-[#7f7570]">
                  {isTestStore
                    ? "Credited directly to Chase Commercial Checking Account"
                    : `Credited directly to registered settlement account for ${activeOrg?.name || "your store"}`}
                </p>
              </div>
              <span className="font-serif text-2xl md:text-3xl font-bold text-[#1e1b19]">
                {currencySymbol}{formattedAmount} {currencyCode}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Bento Callout Cards (Span 6 each) */}
        <div className="md:col-span-6 bg-[#faf2ee] border border-[#e5e2e1] rounded-lg p-5 flex items-center gap-4">
          <div className="w-11 h-11 bg-white border border-[#e5e2e1] rounded flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-[#1e1b19]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-[#1e1b19] mb-0.5">Secure Financial Transfer</p>
            <p className="text-xs text-[#7f7570]">Protected by 256-bit TLS bank transmission &amp; PCI-DSS Level 1 compliance.</p>
          </div>
        </div>

        <div className="md:col-span-6 bg-[#faf2ee] border border-[#e5e2e1] rounded-lg p-5 flex items-center gap-4">
          <div className="w-11 h-11 bg-white border border-[#e5e2e1] rounded flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-[#1e1b19]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-[#1e1b19] mb-0.5">Settlement Frequency</p>
            <p className="text-xs text-[#7f7570]">This is your 12th payout this month. Automatic daily sweeps active.</p>
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
    <div className="bg-[#fff8f5] text-[#1e1b19] font-body-md min-h-screen flex flex-col font-sans">
      {/* SideNavBar */}
      <aside className="fixed left-0 top-0 h-full w-[280px] bg-[#f7f3f2] border-r border-[#e5e2e1] hidden lg:flex flex-col z-50">
        <div className="p-6 border-b border-[#e5e2e1]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#1e1b19] rounded flex items-center justify-center text-white font-serif text-lg font-bold tracking-tight">
              P
            </div>
            <div>
              <h2 className="font-serif text-[1.125rem] font-bold text-[#1e1b19] tracking-tight leading-tight">
                PREST
              </h2>
              <p className="text-[10px] tracking-[0.16em] uppercase text-[#7f7570] font-medium font-sans">
                Restaurant Suite
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6">
          <div>
            <span className="px-3 text-[10px] font-semibold tracking-[0.14em] uppercase text-[#7f7570]">
              Floor &amp; Service
            </span>
            <nav className="mt-2 flex flex-col gap-0.5">
              <button
                onClick={() => showToast("Floor & Tables")}
                className="flex items-center gap-3 px-3 py-2 text-sm text-[#444748] hover:bg-[#eee7e3] rounded transition-colors text-left"
              >
                <span>Floor &amp; Tables</span>
              </button>
              <button
                onClick={() => showToast("Active Orders")}
                className="flex items-center gap-3 px-3 py-2 text-sm text-[#444748] hover:bg-[#eee7e3] rounded transition-colors text-left"
              >
                <span>Active Orders</span>
              </button>
            </nav>
          </div>

          <div>
            <span className="px-3 text-[10px] font-semibold tracking-[0.14em] uppercase text-[#7f7570]">
              Financial Management
            </span>
            <nav className="mt-2 flex flex-col gap-0.5">
              <button
                onClick={() => router.push("/marketplace/stripe/transactions")}
                className="flex items-center gap-3 px-3 py-2 text-sm text-[#444748] hover:bg-[#eee7e3] rounded transition-colors text-left"
              >
                <span>Settlement Ledger</span>
              </button>
              <button
                onClick={() => router.push("/marketplace/stripe/payouts")}
                className="flex items-center gap-3 px-3 py-2 text-sm font-semibold text-[#1e1b19] bg-[#ebe1da] rounded transition-colors text-left"
              >
                <span>Stripe Payouts</span>
              </button>
              <button
                onClick={() => router.push("/marketplace/stripe/transactions")}
                className="flex items-center gap-3 px-3 py-2 text-sm text-[#444748] hover:bg-[#eee7e3] rounded transition-colors text-left"
              >
                <span>Terminal Transactions</span>
              </button>
              <button
                onClick={() => showToast("Tax & Service Charges")}
                className="flex items-center gap-3 px-3 py-2 text-sm text-[#444748] hover:bg-[#eee7e3] rounded transition-colors text-left"
              >
                <span>Tax &amp; Service Charges</span>
              </button>
              <button
                onClick={() => router.push("/marketplace/stripe/refunds")}
                className="flex items-center gap-3 px-3 py-2 text-sm text-[#444748] hover:bg-[#eee7e3] rounded transition-colors text-left"
              >
                <span>Disputes &amp; Holds</span>
              </button>
            </nav>
          </div>

          <div>
            <span className="px-3 text-[10px] font-semibold tracking-[0.14em] uppercase text-[#7f7570]">
              System
            </span>
            <nav className="mt-2 flex flex-col gap-0.5">
              <button
                onClick={() => showToast("Reconciliation")}
                className="flex items-center gap-3 px-3 py-2 text-sm text-[#444748] hover:bg-[#eee7e3] rounded transition-colors text-left"
              >
                <span>Reconciliation</span>
              </button>
              <button
                onClick={() => router.push("/marketplace?category=Payments")}
                className="flex items-center gap-3 px-3 py-2 text-sm text-[#444748] hover:bg-[#eee7e3] rounded transition-colors text-left"
              >
                <span>Settings</span>
              </button>
            </nav>
          </div>
        </div>

        <div className="p-4 border-t border-[#e5e2e1] bg-[#f1edec]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <span className="text-xs font-medium text-[#1e1b19]">Stripe Connect Active</span>
            </div>
            <span className="text-[10px] text-[#7f7570] font-mono">v4.18</span>
          </div>
          <p className="text-[11px] text-[#7f7570] mt-1 font-mono">Account: acct_1Nzkp4A</p>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="lg:ml-[280px] min-h-screen flex flex-col">
        {/* TopNavBar */}
        <header className="fixed top-0 right-0 left-0 lg:left-[280px] h-16 bg-[#fff8f5] border-b border-[#e5e2e1] px-6 lg:px-10 flex items-center justify-between z-40">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f7f3f2] border border-[#e5e2e1] rounded text-sm text-[#1e1b19]">
              <svg className="w-4 h-4 text-[#7f7570]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18l-2 9H5L3 3zm0 9v9a1 1 0 001 1h16a1 1 0 001-1v-9M9 22V12h6v10" />
              </svg>
              <span className="font-medium">Bistrot de l'Alma — Paris VII</span>
              <svg className="w-3.5 h-3.5 text-[#7f7570]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="hidden md:flex items-center gap-1 text-xs text-[#7f7570]">
              <span className="font-mono font-medium text-[#1e1b19]">Terminal POS: Bar / Main Salon</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => showToast("Manage Default Regions")}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#444748] hover:text-[#1e1b19] border border-[#e5e2e1] bg-white rounded hover:bg-[#f7f3f2] transition-colors"
            >
              <span>Manage Default Regions</span>
            </button>
            <div className="h-5 w-px bg-[#e5e2e1]"></div>
            <button
              onClick={() => showToast("Notifications")}
              className="relative p-1.5 text-[#444748] hover:text-[#1e1b19] rounded transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#ba1a1a] rounded-full"></span>
            </button>
            <div className="flex items-center gap-2.5 pl-2 cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-[#1e1b19] text-white flex items-center justify-center font-serif text-xs font-semibold tracking-wide">
                CS
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-[#1e1b19] leading-tight">Claire St. Laurent</p>
                <p className="text-[10px] text-[#7f7570] leading-none">General Manager</p>
              </div>
            </div>
          </div>
        </header>

        <div className="mt-16 flex-1 flex flex-col justify-between">
          {content}
          <footer className="mt-16 py-6 px-6 lg:px-10 border-t border-[#e5e2e1] text-[#7f7570] text-xs flex flex-col md:flex-row justify-between items-center gap-4 bg-[#fff8f5]">
            <div className="flex items-center gap-2">
              <span className="font-serif font-bold text-[#1e1b19]">PREST</span>
              <span>© 2024 Prest Editorial POS Suites. Powered by Stripe Connect.</span>
            </div>
            <div className="flex gap-6 text-xs text-[#7f7570]">
              <button onClick={() => showToast("Privacy Policy")} className="hover:text-[#1e1b19] transition-colors">Privacy Policy</button>
              <button onClick={() => showToast("Terms of Service")} className="hover:text-[#1e1b19] transition-colors">Terms of Service</button>
              <button onClick={() => showToast("Merchant Settlement Agreement")} className="hover:text-[#1e1b19] transition-colors">Merchant Settlement Agreement</button>
              <button onClick={() => showToast("Support Desk")} className="hover:text-[#1e1b19] transition-colors">Support Desk</button>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}

