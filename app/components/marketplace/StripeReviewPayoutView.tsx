"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { resolveOrganizationCurrency } from "../../lib/payments/currency";

interface StripeReviewPayoutViewProps {
  embeddedInMarketplace?: boolean;
  amount?: number;
  onBack?: () => void;
  onConfirmPayout?: (amount: number) => void;
}

export function StripeReviewPayoutView({
  embeddedInMarketplace = false,
  amount: initialAmount,
  onBack,
  onConfirmPayout,
}: StripeReviewPayoutViewProps) {
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

  // Read amount from props or searchParams (defaulting to 2000.00 as in reference)
  const queryAmount = searchParams?.get("amount");
  const parsedAmount = initialAmount ?? (queryAmount ? parseFloat(queryAmount) : 2000.0);
  const payoutAmount = isNaN(parsedAmount) || parsedAmount <= 0 ? 2000.0 : parsedAmount;

  const [isConfirmed, setIsConfirmed] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push("/marketplace/stripe/payouts/request");
    }
  };

  const handleSubmit = () => {
    if (!isConfirmed) return;
    if (onConfirmPayout) {
      onConfirmPayout(payoutAmount);
    } else {
      router.push(`/marketplace/stripe/payouts/processing?amount=${payoutAmount}`);
    }
  };

  const formattedAmount = payoutAmount.toLocaleString(storeLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const content = (
    <div className="w-full flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-10 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#1f1f1f] text-[#fff8f5] px-4 py-2.5 rounded-lg shadow-lg border border-[#e5e0db] text-xs font-medium tracking-wide flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {toastMessage}
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-[#645d58] mb-5 tracking-wide">
        <button
          type="button"
          onClick={() => router.push("/marketplace?category=Payments")}
          className="hover:text-[#1f1f1f] transition-colors"
        >
          Payments
        </button>
        <span className="text-[#e5e0db] text-[10px]">/</span>
        <button
          type="button"
          onClick={() => router.push("/marketplace/stripe/payouts")}
          className="hover:text-[#1f1f1f] transition-colors"
        >
          Stripe Payouts
        </button>
        <span className="text-[#e5e0db] text-[10px]">/</span>
        <span className="text-[#1f1f1f] font-medium">Review Request</span>
      </nav>

      {/* Page Title & Subtitle */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-[#1f1f1f]">
          Review Payout Request
        </h1>
        <p className="font-sans text-sm text-[#625d59] mt-2 leading-relaxed">
          Please check your payout transfer details before submitting to Stripe.
        </p>
      </div>

      {/* Main Review Container Card */}
      <div className="bg-white border border-[#e5e0db] rounded-lg shadow-xs divide-y divide-[#e5e0db] mb-6 overflow-hidden">
        {/* Card Header with Lock Badge */}
        <div className="px-6 sm:px-7 py-5 flex items-center justify-between bg-[#fdfbf9]">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-[#645d58]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            <h2 className="font-serif text-lg text-[#1f1f1f] font-normal">Payout Transfer Summary</h2>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#eee7e3]/60 border border-[#e5e0db] text-[11px] font-medium tracking-wide text-[#645d58] uppercase">
            <svg className="w-3.5 h-3.5 text-[#645d58]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v2H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-1V6a4 4 0 00-4-4zm2 6V6a2 2 0 10-4 0v2h4z" clipRule="evenodd" />
            </svg>
            Secure Financial Transfer
          </span>
        </div>

        {/* Details Rows */}
        <div className="px-6 sm:px-7 py-6 space-y-4 text-sm">
          {/* Payout Amount */}
          <div className="flex items-center justify-between py-1">
            <span className="text-[#645d58] font-light">Payout Amount</span>
            <span className="text-[#1f1f1f] font-medium tracking-tight text-base font-mono">
              {currencySymbol}{formattedAmount} {currencyCode}
            </span>
          </div>

          {/* Processing Fee */}
          <div className="flex items-center justify-between py-1 border-t border-dashed border-[#e5e0db] pt-3">
            <span className="text-[#645d58] font-light">Processing Fee</span>
            <span className="text-[#1e1b19] font-medium font-mono">{currencySymbol}0.00</span>
          </div>

          {/* Destination Bank */}
          <div className="flex items-center justify-between py-1 border-t border-dashed border-[#e5e0db] pt-3">
            <span className="text-[#645d58] font-light">Destination Bank</span>
            <div className="flex items-center gap-2 text-[#1f1f1f] font-medium">
              <svg className="w-4 h-4 text-[#645d58]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 2l9 5H3l9-5z" />
              </svg>
              <span>{isIndia ? "HDFC Bank Settlement Account (•••• 4242)" : "Chase Commercial Checking (•••• 4291)"}</span>
            </div>
          </div>

          {/* Account Holder */}
          <div className="flex items-center justify-between py-1 border-t border-dashed border-[#e5e0db] pt-3">
            <span className="text-[#645d58] font-light">Account Holder</span>
            <span className="text-[#1f1f1f] font-medium">{activeOrg?.name || "Bistrot de l'Alma LLC"}</span>
          </div>

          {/* Estimated Arrival */}
          <div className="flex items-center justify-between py-1 border-t border-dashed border-[#e5e0db] pt-3">
            <span className="text-[#645d58] font-light">Estimated Arrival</span>
            <span className="text-[#1f1f1f] font-medium">Tomorrow by end of business day</span>
          </div>

          {/* Total to Settle Box */}
          <div className="mt-6 p-5 rounded-lg bg-[#f7f3f2] border border-[#e5e0db] flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold block">
                Total to Settle
              </span>
              <span className="font-serif text-3xl text-[#1f1f1f] font-normal tracking-tight mt-1 block">
                {currencySymbol}{formattedAmount}{" "}
                <span className="text-base font-sans text-[#645d58] font-normal">{currencyCode}</span>
              </span>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#e9e1dd] flex items-center justify-center text-[#645d58] border border-[#e5e0db]">
              <svg className="w-5 h-5 text-[#2e2b2a]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Checkbox */}
      <div className="mb-6 px-1">
        <label className="flex items-start gap-3 cursor-pointer group select-none">
          <input
            type="checkbox"
            checked={isConfirmed}
            onChange={(e) => setIsConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[#8a817c] text-[#1f1f1f] focus:ring-[#1f1f1f] cursor-pointer"
          />
          <span className="text-xs sm:text-sm text-[#625d59] leading-relaxed group-hover:text-[#1f1f1f] transition-colors">
            I confirm that the payout details are correct and acknowledge that bank settlement times depend on clearing protocols.
          </span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3 mb-8">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isConfirmed}
          className="w-full sm:w-auto px-7 py-3 rounded bg-[#1f1f1f] text-white text-xs uppercase tracking-widest font-medium hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-xs"
        >
          <span>Confirm &amp; Submit Payout</span>
          <span className="text-sm font-light">→</span>
        </button>
        <button
          type="button"
          onClick={handleBack}
          className="w-full sm:w-auto px-6 py-3 rounded border border-[#8a817c] text-[#645d58] text-xs uppercase tracking-widest font-medium hover:bg-[#f1edec] hover:text-[#1f1f1f] transition-colors flex items-center justify-center"
        >
          Back
        </button>
      </div>

      {/* Advisory Note Banner */}
      <div className="p-4 rounded-lg bg-[#f6f2ee] border border-[#e5e0db] flex items-start gap-3">
        <svg className="w-5 h-5 text-[#645d58] shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <p className="text-xs text-[#645d58] leading-relaxed">
          Payout requests submitted before 4:00 PM EST are processed on the current business day. Track progress in the Payout History table.
        </p>
      </div>
    </div>
  );

  if (embeddedInMarketplace) {
    return content;
  }

  // Standalone Layout with Prest Luxury Editorial Header & Footer
  return (
    <div className="bg-[#fff8f5] text-[#1e1b19] min-h-screen antialiased flex flex-col font-sans">
      {/* Top Editorial Header */}
      <header className="w-full bg-[#fffcf9] border-b border-[#e5e0db] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            {/* Brand & Suite Label */}
            <div className="flex items-baseline gap-2.5">
              <span className="font-serif text-2xl font-medium tracking-tight text-[#1f1f1f]">
                Prest
              </span>
              <span className="text-xs uppercase tracking-widest text-[#645d58] font-medium pl-2 border-l border-[#e5e0db]">
                Restaurant Suite
              </span>
            </div>
            {/* Main Navigation */}
            <nav className="hidden md:flex items-center gap-7 text-[13px] tracking-wide text-[#645d58]">
              <button
                onClick={() => router.push("/marketplace/stripe/dashboard")}
                className="hover:text-[#1f1f1f] transition-colors py-1"
              >
                Overview
              </button>
              <button
                onClick={() => router.push("/marketplace/stripe/payouts")}
                className="text-[#1f1f1f] font-medium border-b border-[#1f1f1f] py-1"
              >
                Payments
              </button>
              <button
                onClick={() => showToast("Menus & Orders module")}
                className="hover:text-[#1f1f1f] transition-colors py-1"
              >
                Menus &amp; Orders
              </button>
              <button
                onClick={() => router.push("/marketplace/stripe/transactions")}
                className="hover:text-[#1f1f1f] transition-colors py-1"
              >
                Settlements
              </button>
              <button
                onClick={() => showToast("Reports module")}
                className="hover:text-[#1f1f1f] transition-colors py-1"
              >
                Reports
              </button>
            </nav>
          </div>

          {/* Outlet Selector & Meta Controls */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-[#f7f3f2] px-3 py-1.5 rounded border border-[#e5e0db] text-xs text-[#1e1b19]">
              <svg className="w-4 h-4 text-[#645d58]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18l-2 9H5L3 3zm0 9v9a1 1 0 001 1h16a1 1 0 001-1v-9M9 22V12h6v10" />
              </svg>
              <span className="font-medium">Bistrot de l'Alma — Paris VII</span>
              <svg className="w-3.5 h-3.5 text-[#645d58]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
            <button
              onClick={() => showToast("Default regions settings")}
              className="hidden lg:inline-flex text-[12px] text-[#645d58] hover:text-[#1f1f1f] underline decoration-[#e5e0db] underline-offset-4 font-medium transition-colors"
            >
              Manage Default Regions
            </button>
            <div className="h-4 w-px bg-[#e5e0db] hidden sm:block"></div>
            <button
              onClick={() => showToast("No new notifications")}
              className="w-8 h-8 rounded-full border border-[#e5e0db] flex items-center justify-center text-[#645d58] hover:text-[#1f1f1f] hover:bg-[#f7f3f2] transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <div className="w-8 h-8 rounded-full bg-[#eee7e3] border border-[#e5e0db] flex items-center justify-center text-xs font-serif text-[#1f1f1f] font-medium">
              BA
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Workspace */}
      <main className="flex-1">{content}</main>

      {/* Refined Editorial Footer Note */}
      <footer className="border-t border-[#e5e0db] bg-[#fffcf9] py-6 px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-[#645d58] gap-3">
          <span className="font-serif italic text-[13px] text-[#625d59]">
            Prest Financial Settlement Engine © 2025
          </span>
          <div className="flex items-center gap-6">
            <button onClick={() => showToast("Clearing Protocol")} className="hover:text-[#1f1f1f] transition-colors">
              Clearing Protocol
            </button>
            <button onClick={() => showToast("Security Disclosures")} className="hover:text-[#1f1f1f] transition-colors">
              Security Disclosures
            </button>
            <button onClick={() => showToast("Help Concierge")} className="hover:text-[#1f1f1f] transition-colors">
              Help Concierge
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

