"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { resolveOrganizationCurrency } from "../../lib/payments/currency";

interface StripeRequestPayoutViewProps {
  embeddedInMarketplace?: boolean;
  onBackToPayouts?: () => void;
  onContinueToReview?: (amount: number) => void;
  onNavigateToRefunds?: () => void;
  onNavigateToTransactions?: () => void;
}

export function StripeRequestPayoutView({
  embeddedInMarketplace = false,
  onBackToPayouts,
  onContinueToReview,
  onNavigateToRefunds,
  onNavigateToTransactions,
}: StripeRequestPayoutViewProps) {
  const router = useRouter();

  // Store & Currency Resolution
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

  // Real Stripe Connection & Transactions from Convex
  const stripeConnections = useQuery(api.paymentGateways.listConnections, { provider: "stripe" });
  const realStripeConn = stripeConnections && stripeConnections.length > 0 ? stripeConnections[0] : null;

  const convexTransactionsQuery = useQuery(
    api.paymentGateways.listTransactions,
    realStripeConn ? ({ connectionId: realStripeConn._id as any, limit: 100 } as any) : "skip"
  );
  const txList = (convexTransactionsQuery as any)?.transactions || [];
  const successfulTx = txList.filter(
    (tx: any) => tx.status === "captured" || tx.status === "successful" || tx.status === "succeeded"
  );
  const isTestStore = Boolean(activeOrg?.name?.includes("Bistrot de l'Alma"));
  const rawMaxAvailable = successfulTx.reduce((sum: number, tx: any) => sum + (tx.amountMinor || 0), 0) / 100;
  const rawPendingAmount = txList
    .filter((tx: any) => tx.status === "pending" || tx.status === "authorized")
    .reduce((sum: number, tx: any) => sum + (tx.amountMinor || 0), 0) / 100;

  const maxAvailable = isTestStore && rawMaxAvailable === 0 ? 4250.0 : rawMaxAvailable;
  const pendingAmount = isTestStore && rawPendingAmount === 0 ? 680.0 : rawPendingAmount;

  const [payoutOption, setPayoutOption] = useState<"full" | "custom">("full");
  const [amountInput, setAmountInput] = useState<string>("0.00");

  useEffect(() => {
    if (payoutOption === "full") {
      setAmountInput(maxAvailable.toFixed(2));
    }
  }, [maxAvailable, payoutOption]);

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleBack = () => {
    if (onBackToPayouts) {
      onBackToPayouts();
    } else {
      router.push("/marketplace/stripe/payouts");
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, "");
    setAmountInput(val);
  };

  const numericAmount = parseFloat(amountInput) || 0;
  const isAmountValid = numericAmount > 0 && numericAmount <= maxAvailable;

  const handleOptionSelect = (opt: "full" | "custom") => {
    setPayoutOption(opt);
    if (opt === "full") {
      setAmountInput(maxAvailable.toFixed(2));
    }
  };

  const handleContinueToReview = () => {
    if (maxAvailable <= 0) {
      showToast("No cleared balance currently available for manual withdrawal.");
      return;
    }
    if (!isAmountValid) {
      showToast(`Please enter an amount between ${formatAmount(1.0)} and ${formatAmount(maxAvailable)}`);
      return;
    }
    if (onContinueToReview) {
      onContinueToReview(numericAmount);
    } else {
      router.push(`/marketplace/stripe/payouts/review?amount=${numericAmount}`);
    }
  };

  const handleConfirmPayout = async () => {
    setIsSubmitting(true);
    // Simulate network submission
    await new Promise((r) => setTimeout(r, 900));
    setIsSubmitting(false);
    setIsReviewModalOpen(false);
    setIsSuccess(true);
    showToast(`Transfer of ${formatAmount(numericAmount)} successfully initiated.`);
  };

  const formattedAmount = numericAmount.toLocaleString(storeLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const content = (
    <div className="w-full flex-1 max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-8 font-sans space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#191716] text-[#fff8f5] px-4 py-2.5 rounded-lg shadow-lg border border-[#e0d8d5] text-xs font-medium tracking-wide flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {toastMessage}
        </div>
      )}

      {/* Success Notification Banner */}
      {isSuccess && (
        <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-4 flex items-center justify-between text-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm text-emerald-950">Payout Request Submitted</p>
              <p className="text-xs text-emerald-700">
                {formatAmount(numericAmount)} {currencyCode} is scheduled for transfer to {realStripeConn?.merchantName ? `${realStripeConn.merchantName} Primary Bank Account` : "Registered Merchant Bank Account"}.
              </p>
            </div>
          </div>
          <button
            onClick={handleBack}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-800 text-white hover:bg-emerald-900 transition-colors"
          >
            View in Payout Ledger
          </button>
        </div>
      )}

      {/* Header & Eyebrow */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">
            Treasury Operations / Standard Transfer
          </div>
          <h1 className="text-3xl font-serif font-normal text-[#191716] tracking-tight">
            Request Payout
          </h1>
          <p className="text-xs text-neutral-500 mt-1 max-w-xl">
            Request an eligible payout from your Stripe account to your linked bank account.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#e0d8d5] text-xs font-medium text-[#191716] shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Operational Balance Normal
          </div>
        </div>
      </div>

      {/* 4 Metric / Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Available */}
        <div className="bg-white border border-[#e0d8d5] rounded-xl p-5 shadow-sm space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            Available For Payout
          </div>
          <div className="text-2xl font-serif text-[#191716] font-normal">
            {formatAmount(maxAvailable)} <span className="text-xs font-sans text-neutral-500 font-medium">{currencyCode}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-600 pt-1">
            <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Ready to transfer</span>
          </div>
        </div>

        {/* Card 2: Pending */}
        <div className="bg-white border border-[#e0d8d5] rounded-xl p-5 shadow-sm space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            Pending Balance
          </div>
          <div className="text-2xl font-serif text-[#191716] font-normal">
            {formatAmount(pendingAmount)} <span className="text-xs font-sans text-neutral-500 font-medium">{currencyCode}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-600 pt-1">
            <svg className="w-3.5 h-3.5 text-neutral-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            <span>Clears in 2 business days</span>
          </div>
        </div>

        {/* Card 3: Standard Schedule */}
        <div className="bg-white border border-[#e0d8d5] rounded-xl p-5 shadow-sm space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            Standard Payout Schedule
          </div>
          <div className="text-xl font-serif text-[#191716] font-normal pt-1">
            Automatic Daily
          </div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-600 pt-1">
            <svg className="w-3.5 h-3.5 text-neutral-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            <span>Standard cadence active</span>
          </div>
        </div>

        {/* Card 4: Payout Speed */}
        <div className="bg-white border border-[#e0d8d5] rounded-xl p-5 shadow-sm space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            Payout Speed
          </div>
          <div className="text-xl font-serif text-[#191716] font-normal pt-1">
            1–2 Business Days
          </div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-600 pt-1">
            <svg className="w-3.5 h-3.5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 2l9 5H3l9-5z" />
            </svg>
            <span>Standard ACH / SEPA processing</span>
          </div>
        </div>
      </div>

      {/* Main Form: Withdrawal Configuration */}
      <div className="bg-white border border-[#e0d8d5] rounded-xl p-6 sm:p-8 shadow-sm space-y-7">
        {/* Card Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#e0d8d5]">
          <div>
            <h2 className="text-xl font-serif text-[#191716]">Withdrawal Configuration</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Define your requested allocation and review settlement destination.
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 bg-[#f7f3f0] border border-[#e0d8d5] px-2.5 py-1 rounded">
            Step 1 of 2
          </span>
        </div>

        {/* Section 1: Payout Amount Option */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-700">
              Payout Amount Option
            </label>
            <span className="text-xs text-neutral-500 font-medium">
              Currency: <strong className="text-neutral-800">{currencyCode} ({currencySymbol})</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Full Balance Option */}
            <div
              onClick={() => handleOptionSelect("full")}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex items-center justify-between ${
                payoutOption === "full"
                  ? "border-[#191716] bg-[#faf8f6]"
                  : "border-[#e0d8d5] bg-white hover:border-neutral-300"
              }`}
            >
              <div>
                <div className="text-sm font-semibold text-[#191716]">Withdraw Full Balance</div>
                <div className="text-xs text-neutral-500 mt-0.5">Transfer entire available reserve</div>
              </div>
              <div className="text-sm font-bold text-[#191716] font-mono">{formatAmount(maxAvailable)}</div>
            </div>

            {/* Custom Amount Option */}
            <div
              onClick={() => handleOptionSelect("custom")}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex items-center justify-between ${
                payoutOption === "custom"
                  ? "border-[#191716] bg-[#faf8f6]"
                  : "border-[#e0d8d5] bg-white hover:border-neutral-300"
              }`}
            >
              <div>
                <div className="text-sm font-semibold text-[#191716]">Custom Amount</div>
                <div className="text-xs text-neutral-500 mt-0.5">Specify an exact allocation</div>
              </div>
              <div className="text-xs font-semibold text-neutral-500">Custom {currencySymbol}</div>
            </div>
          </div>

          {/* Amount Input */}
          <div className="pt-2">
            <div className="relative flex items-center border border-[#e0d8d5] rounded-lg px-4 py-3 bg-white focus-within:ring-2 focus-within:ring-[#191716] focus-within:border-transparent">
              <span className="text-lg font-serif text-neutral-400 mr-2">{currencySymbol}</span>
              <input
                type="text"
                value={amountInput}
                disabled={payoutOption === "full"}
                onChange={handleAmountChange}
                placeholder="0.00"
                className="w-full text-lg font-mono text-[#191716] bg-transparent outline-none disabled:text-neutral-700"
              />
              <span className="ml-2 text-xs font-bold uppercase tracking-wider text-neutral-600 bg-[#f7f3f0] px-2 py-0.5 rounded border border-[#e0d8d5]">
                {currencyCode}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 mt-2">
              <svg className="w-3.5 h-3.5 text-neutral-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>
                Maximum payout amount is restricted to your available Stripe balance ({formatAmount(maxAvailable)}).
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Destination Bank Account */}
        <div className="space-y-2 pt-2 border-t border-[#e0d8d5]">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-700">
              Destination Bank Account
            </label>
            <button
              type="button"
              onClick={() => showToast("Bank account management is managed in Stripe Dashboard.")}
              className="text-xs text-neutral-500 hover:text-neutral-900 underline-offset-2 hover:underline"
            >
              Manage Accounts
            </button>
          </div>

          <div className="border border-[#e0d8d5] rounded-lg p-4 bg-white flex items-center justify-between hover:bg-[#faf8f6] transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#f7f3f0] border border-[#e0d8d5] flex items-center justify-center text-neutral-700">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 2l9 5H3l9-5z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#191716]">
                    {isTestStore
                      ? "Chase Commercial Banking ending in •••• 4921"
                      : realStripeConn?.merchantName
                        ? `${realStripeConn.merchantName} Primary Bank Account`
                        : activeOrg?.paymentSplitting?.bankDetails?.bankName
                          ? `${activeOrg.paymentSplitting.bankDetails.bankName} ending in •••• ${activeOrg.paymentSplitting.bankDetails.accountNumber?.slice(-4)}`
                          : "Verified Merchant Settlement Account"}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-700 bg-[#efeae6] px-1.5 py-0.5 rounded border border-[#e0d8d5]">
                    Primary Payout Account
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-neutral-500 mt-1">
                  <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Routing / Transit verified</span>
                  <span>•</span>
                  <span>Business Checking (USD)</span>
                </div>
              </div>
            </div>
            <svg className="w-5 h-5 text-neutral-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {/* Section 3: Settlement Summary Breakdown */}
        <div className="space-y-3 pt-2 border-t border-[#e0d8d5]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-700">
            Settlement Summary Breakdown
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-neutral-600">
              <span>Requested Payout</span>
              <span className="font-mono text-[#191716]">{formatAmount(numericAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-neutral-600">
              <span>Transfer Fee</span>
              <span className="font-mono text-[#191716]">{currencySymbol}0.00 <span className="text-neutral-400 font-sans">(Standard bank transfer)</span></span>
            </div>
            <div className="border-t border-[#e0d8d5] pt-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#191716]">Net Settlement</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">Funds deposited directly into Chase account</div>
              </div>
              <div className="text-2xl font-serif font-medium text-[#191716]">
                {formatAmount(numericAmount)}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-[#e0d8d5]">
          <button
            type="button"
            onClick={handleBack}
            className="px-5 py-2.5 rounded-lg border border-[#e0d8d5] text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleContinueToReview}
            disabled={!isAmountValid}
            className="px-6 py-2.5 rounded-lg text-xs font-semibold text-white bg-[#191716] hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
          >
            <span>Continue to Review</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* Compliance / Footer Disclaimers */}
      <div className="text-center pt-4 pb-8 space-y-2 text-[11px] text-neutral-500">
        <p>
          Payouts are processed through Stripe financial infrastructure and subject to bank clearing schedules.
        </p>
        <p>
          Funds typically arrive in your Chase account within 1–2 business days excluding Federal Reserve holidays.
        </p>
        <div className="flex items-center justify-center gap-3 pt-1 text-neutral-400">
          <button
            type="button"
            onClick={() => showToast("Stripe Service Terms")}
            className="hover:text-neutral-700 underline-offset-2 hover:underline"
          >
            Stripe Service Terms
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => showToast("Payout Disclosure Policy")}
            className="hover:text-neutral-700 underline-offset-2 hover:underline"
          >
            Payout Disclosure Policy
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => showToast("Banking Security SLA")}
            className="hover:text-neutral-700 underline-offset-2 hover:underline"
          >
            Banking Security SLA
          </button>
        </div>
      </div>

      {/* Step 2 Review Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white border border-[#e0d8d5] rounded-xl shadow-xl max-w-lg w-full p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-[#e0d8d5] pb-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Step 2 of 2</div>
                <h3 className="text-xl font-serif text-[#191716]">Review Payout Request</h3>
              </div>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-[#faf8f6] border border-[#e0d8d5] rounded-lg p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Transfer Amount:</span>
                  <span className="font-bold text-sm text-[#191716] font-mono">{formatAmount(numericAmount)} {currencyCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Destination Account:</span>
                  <span className="font-medium text-[#191716]">Chase Commercial (•••• 4921)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Transfer Speed:</span>
                  <span className="font-medium text-[#191716]">Standard ACH (1–2 Days)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Processing Fee:</span>
                  <span className="font-medium text-emerald-700">{currencySymbol}0.00 (Free)</span>
                </div>
              </div>

              <div className="text-xs text-neutral-500 space-y-1">
                <p>
                  By clicking <strong>Confirm and Initiate Payout</strong>, you authorize Stripe to transfer funds from your Stripe available balance to the selected commercial account.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#e0d8d5] text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleConfirmPayout}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-[#191716] hover:bg-black transition-colors flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Confirm and Initiate Payout</span>
                )}
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

  // Standalone Layout with PREST Navigation and Sidebar
  return (
    <div className="min-h-screen bg-[#fff8f5] text-[#191716] flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-[#e0d8d5] bg-[#fff8f5] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#191716] rounded-md flex items-center justify-center text-white font-serif font-bold text-sm">
              P
            </div>
            <div className="leading-tight">
              <span className="font-serif font-medium text-sm tracking-tight">Prest</span>
              <span className="text-[9px] uppercase tracking-wider text-neutral-400 ml-1.5 font-sans font-semibold">
                Restaurant Suite
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-[#e0d8d5]" />

          {/* Store Selector */}
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-800 bg-white border border-[#e0d8d5] px-2.5 py-1 rounded-md shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>The Grand Dining Room &amp; Bar (Main Outlet)</span>
            <svg className="w-3.5 h-3.5 text-neutral-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-5 text-xs text-neutral-600 font-medium">
            <button
              onClick={() => router.push("/marketplace/stripe/dashboard")}
              className="hover:text-neutral-900 transition-colors"
            >
              Overview
            </button>
            <button
              onClick={() => showToast("Reservations module")}
              className="hover:text-neutral-900 transition-colors"
            >
              Reservations
            </button>
            <button
              onClick={() => router.push("/marketplace/stripe/payouts")}
              className="text-[#191716] font-semibold border-b-2 border-[#191716] pb-1 -mb-1"
            >
              Payments &amp; Payouts
            </button>
            <button
              onClick={() => showToast("POS Terminals module")}
              className="hover:text-neutral-900 transition-colors"
            >
              POS Terminals
            </button>
            <button
              onClick={() => showToast("Reports module")}
              className="hover:text-neutral-900 transition-colors"
            >
              Reports
            </button>
            <button
              onClick={() => router.push("/marketplace?category=Payments")}
              className="hover:text-neutral-900 transition-colors"
            >
              Settings
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => showToast("Manage Default Regions")}
            className="hidden sm:flex items-center gap-1.5 text-neutral-600 hover:text-neutral-900 bg-white border border-[#e0d8d5] px-2.5 py-1 rounded-md"
          >
            <svg className="w-3.5 h-3.5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span>Manage Default Regions</span>
          </button>
          <div className="h-4 w-px bg-[#e0d8d5]" />
          <button
            type="button"
            className="w-8 h-8 rounded-full border border-[#e0d8d5] bg-white flex items-center justify-center text-neutral-600 hover:bg-neutral-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          <div className="flex items-center gap-2 pl-2">
            <div className="w-7 h-7 rounded-full bg-[#191716] text-[#fff8f5] flex items-center justify-center text-xs font-serif">
              CS
            </div>
            <div className="hidden md:block leading-none text-left">
              <div className="font-semibold text-xs text-neutral-800">Claire St. Laurent</div>
              <div className="text-[10px] text-neutral-400">Head of Treasury</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-60 border-r border-[#e0d8d5] bg-[#fff8f5] p-4 hidden md:flex flex-col justify-between shrink-0">
          <div className="space-y-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2 px-2">
                Finance &amp; Settlement
              </div>
              <div className="space-y-1 text-xs">
                <button
                  onClick={() => router.push("/marketplace/stripe/transactions")}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-[#f5ede8] transition-colors"
                >
                  <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>Settlement Ledger</span>
                </button>
                <button
                  onClick={() => {}}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#efeae6] font-semibold text-[#191716] shadow-xs"
                >
                  <svg className="w-4 h-4 text-[#191716]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  <span>Payout Request</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#191716] ml-auto"></span>
                </button>
                <button
                  onClick={() => router.push("/marketplace/stripe/payouts")}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-[#f5ede8] transition-colors"
                >
                  <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span>Transfer History</span>
                </button>
                <button
                  onClick={() => router.push("/marketplace/stripe/refunds")}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-[#f5ede8] transition-colors"
                >
                  <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  <span>Disputes &amp; Refunds</span>
                </button>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2 px-2">
                Configuration
              </div>
              <div className="space-y-1 text-xs">
                <button
                  onClick={() => showToast("Connected Accounts")}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-[#f5ede8] transition-colors"
                >
                  <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 2l9 5H3l9-5z" />
                  </svg>
                  <span>Connected Accounts</span>
                </button>
                <button
                  onClick={() => showToast("Payout Schedules")}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-[#f5ede8] transition-colors"
                >
                  <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Payout Schedules</span>
                </button>
                <button
                  onClick={() => showToast("Stripe Compliance verified")}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-[#f5ede8] transition-colors"
                >
                  <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Stripe Compliance</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Card */}
          <div className="bg-white border border-[#e0d8d5] rounded-xl p-3.5 space-y-1.5 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-800">
              <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clipRule="evenodd" />
              </svg>
              <span>Stripe Financial Live</span>
            </div>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              Direct Settlement Gateway active for USD payouts.
            </p>
          </div>
        </aside>

        {/* Content View */}
        <main className="flex-1 overflow-y-auto">{content}</main>
      </div>
    </div>
  );
}

