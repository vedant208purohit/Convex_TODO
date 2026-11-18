"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { resolveOrganizationCurrency } from "../../lib/payments/currency";

interface StripeWithdrawalSuccessViewProps {
  embeddedInMarketplace?: boolean;
  amount?: number;
  payoutId?: string;
  onViewHistory?: () => void;
  onBackToDashboard?: () => void;
  onViewDetails?: (id: string) => void;
}

export function StripeWithdrawalSuccessView({
  embeddedInMarketplace = false,
  amount: initialAmount,
  payoutId = "PO_238912",
  onViewHistory,
  onBackToDashboard,
  onViewDetails,
}: StripeWithdrawalSuccessViewProps) {
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
  const storeLocale = isIndia ? "en-IN" : storeCurrencyInfo.locale || "en-US";

  const queryAmount = searchParams?.get("amount");
  const parsedAmount = initialAmount ?? (queryAmount ? parseFloat(queryAmount) : 2000.0);
  const payoutAmount = isNaN(parsedAmount) || parsedAmount <= 0 ? 2000.0 : parsedAmount;

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleViewHistory = () => {
    if (onViewHistory) {
      onViewHistory();
    } else {
      router.push("/marketplace/stripe/payouts");
    }
  };

  const handleBackToDashboard = () => {
    if (onBackToDashboard) {
      onBackToDashboard();
    } else {
      router.push("/marketplace/stripe/dashboard");
    }
  };

  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails(payoutId);
    } else {
      router.push(`/marketplace/stripe/payouts/details?id=${payoutId}&amount=${payoutAmount}`);
    }
  };

  const formattedAmount = payoutAmount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const content = (
    <div className="w-full flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-10 font-sans flex flex-col items-center">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#191716] text-[#fff8f5] px-4 py-2.5 rounded-lg shadow-lg border border-[#e0d8d5] text-xs font-medium tracking-wide flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {toastMessage}
        </div>
      )}

      {/* Main Success Container Card */}
      <div className="w-full bg-white border border-[#e0d8d5] rounded-xl shadow-lg overflow-hidden flex flex-col md:flex-row animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Left Hero Side (Defx Stripe Indigo/Purple) */}
        <div className="w-full md:w-1/3 bg-gradient-to-br from-[#635bff] to-[#493ee5] p-8 flex flex-col items-center justify-center text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mb-4 ring-4 ring-white/10">
            <svg className="w-8 h-8 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white leading-tight">
            Withdrawal Successful
          </h2>
          <p className="text-xs text-white/80 mt-2 leading-relaxed">
            Payout transmission to Stripe Banking Infrastructure initiated.
          </p>
        </div>

        {/* Right Info Side */}
        <div className="w-full md:w-2/3 p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#7f7570] mb-1">
                Requested Amount
              </p>
              <h1 className="text-3xl sm:text-4xl text-[#493ee5] font-bold tracking-tight">
                {currencySymbol}{formattedAmount}
              </h1>
            </div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-[11px] rounded-full border border-emerald-200 uppercase tracking-wider">
              Processing
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-b border-[#e0d8d5] py-5 text-xs">
            <div>
              <p className="text-[10px] font-bold text-[#7f7570] mb-1 uppercase tracking-wider">
                Destination
              </p>
              <div className="flex items-center gap-1.5 text-[#191716] font-semibold text-sm">
                <svg className="w-4 h-4 text-[#7f7570] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 2l9 5H3l9-5z" />
                </svg>
                <span>
                  {activeOrg?.name?.includes("Bistrot de l'Alma")
                    ? "HDFC / Chase"
                    : activeOrg?.paymentSplitting?.bankDetails?.bankName || (isIndia ? "HDFC Bank" : "Chase Commercial")}
                </span>
              </div>
              <p className="text-[11px] text-[#7f7570] mt-0.5">Settlement Account •••• 4242</p>
            </div>

            <div>
              <p className="text-[10px] font-bold text-[#7f7570] mb-1 uppercase tracking-wider">
                Estimated Arrival
              </p>
              <div className="flex items-center gap-1.5 text-[#191716] font-semibold text-sm">
                <svg className="w-4 h-4 text-[#7f7570] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Tomorrow</span>
              </div>
              <p className="text-[11px] text-[#7f7570] mt-0.5">By 5:00 PM EST</p>
            </div>

            <div>
              <p className="text-[10px] font-bold text-[#7f7570] mb-1 uppercase tracking-wider">
                Reference ID
              </p>
              <button
                type="button"
                onClick={handleViewDetails}
                className="bg-[#f2f4f6] px-2 py-0.5 rounded font-mono text-xs font-semibold text-[#493ee5] border border-[#e0d8d5] hover:bg-[#e8ebf0] transition-colors"
                title="Click to view full payout details"
              >
                {payoutId}
              </button>
            </div>

            <div>
              <p className="text-[10px] font-bold text-[#7f7570] mb-1 uppercase tracking-wider">
                Status Updates
              </p>
              <p className="text-[#191716] text-xs font-medium">Sent to email address</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={handleViewHistory}
              className="w-full py-3 bg-[#493ee5] hover:bg-[#3d32cc] text-white rounded-lg text-xs uppercase tracking-wider font-semibold transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <svg className="w-4 h-4 text-white/90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>View Payout History</span>
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => showToast("Receipt downloaded successfully.")}
                className="py-2.5 border border-[#e0d8d5] text-[#191716] rounded-lg text-xs uppercase tracking-wider font-semibold hover:bg-[#f7f9fb] transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 text-[#7f7570]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download Receipt</span>
              </button>

              <button
                type="button"
                onClick={handleBackToDashboard}
                className="py-2.5 border border-[#e0d8d5] text-[#191716] rounded-lg text-xs uppercase tracking-wider font-semibold hover:bg-[#f7f9fb] transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 text-[#7f7570]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                <span>Back to Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Advisory Note */}
      <p className="text-center mt-6 text-neutral-500 text-xs max-w-md mx-auto leading-relaxed">
        Funds are typically available within 24 hours depending on your bank's processing times. If you have any questions, visit our{" "}
        <button
          type="button"
          onClick={() => showToast("Help Center")}
          className="text-[#191716] font-medium underline underline-offset-2 hover:text-black"
        >
          Help Center
        </button>.
      </p>
    </div>
  );

  if (embeddedInMarketplace) {
    return content;
  }

  // Standalone Layout with Prest Suite Shell
  return (
    <div className="bg-[#fff8f5] text-[#1e1b19] min-h-screen flex flex-col font-sans">
      {/* Top Header */}
      <header className="fixed top-0 w-full z-50 flex items-center justify-between px-6 bg-[#fff8f5]/95 backdrop-blur-sm h-16 border-b border-[#e0d8d5]">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#060607] text-white flex items-center justify-center font-serif text-lg font-medium">
              P
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-base font-semibold text-[#060607] leading-none">
                Prest
              </span>
              <span className="text-[10px] tracking-wider text-[#645d58] uppercase font-semibold">
                Restaurant Suite
              </span>
            </div>
          </div>
          <span className="text-xs text-[#645d58] pl-3 border-l border-[#e0d8d5]">
            Stripe Integration
          </span>
        </div>
      </header>

      <div className="flex flex-1 pt-16 h-full items-center justify-center p-6 sm:p-12">
        {content}
      </div>
    </div>
  );
}

