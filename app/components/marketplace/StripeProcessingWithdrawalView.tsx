"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface StripeProcessingWithdrawalViewProps {
  embeddedInMarketplace?: boolean;
  amount?: number;
  onComplete?: () => void;
}

export function StripeProcessingWithdrawalView({
  embeddedInMarketplace = false,
  amount: initialAmount,
  onComplete,
}: StripeProcessingWithdrawalViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryAmount = searchParams?.get("amount");
  const parsedAmount = initialAmount ?? (queryAmount ? parseFloat(queryAmount) : 2000.0);
  const payoutAmount = isNaN(parsedAmount) || parsedAmount <= 0 ? 2000.0 : parsedAmount;

  const [progress, setProgress] = useState(15);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setIsDone(true);
          return 100;
        }
        const step = Math.floor(Math.random() * 20) + 15;
        const next = prev + step;
        return next > 100 ? 100 : next;
      });
    }, 450);

    return () => clearInterval(timer);
  }, []);

  const handleFinish = () => {
    if (onComplete) {
      onComplete();
    } else {
      router.push(`/marketplace/stripe/payouts/success?amount=${payoutAmount}`);
    }
  };

  const formattedAmount = payoutAmount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const circumference = 2 * Math.PI * 80;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const content = (
    <div className="w-full flex-1 max-w-2xl mx-auto px-4 py-12 flex flex-col items-center justify-center font-sans">
      {/* Content Card */}
      <div className="w-full bg-white border border-[#e0d8d5] rounded-xl shadow-sm p-8 sm:p-12 flex flex-col items-center text-center space-y-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Animated Spinner / Progress Ring */}
        <div className="relative w-44 h-44 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background Track */}
            <circle
              cx="88"
              cy="88"
              r="74"
              fill="transparent"
              stroke="#eee7e3"
              strokeWidth="7"
            />
            {/* Progress Stroke */}
            <circle
              cx="88"
              cy="88"
              r="74"
              fill="transparent"
              stroke="#191716"
              strokeWidth="7"
              strokeDasharray={2 * Math.PI * 74}
              strokeDashoffset={2 * Math.PI * 74 - (progress / 100) * (2 * Math.PI * 74)}
              strokeLinecap="round"
              className="transition-all duration-300 ease-out"
            />
          </svg>

          {/* Central Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xs transition-colors duration-500 ${
              isDone ? "bg-emerald-600 text-white" : "bg-[#191716] text-[#fff8f5]"
            }`}>
              {isDone ? (
                <svg className="w-9 h-9 animate-in zoom-in" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-2.5">
          <h1 className="text-2xl sm:text-3xl font-serif text-[#191716] tracking-tight">
            {isDone ? "Withdrawal Submitted Successfully" : "Processing Your Withdrawal"}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 max-w-md mx-auto leading-relaxed">
            {isDone
              ? `Your payout of $${formattedAmount} USD has been queued with Stripe and will transfer to your Chase Commercial account.`
              : "We're securely sending your payout request to Stripe."}
          </p>
          <div className="pt-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#f7f3f2] rounded-full text-neutral-600 text-xs font-medium border border-[#e0d8d5]">
              <svg className={`w-3.5 h-3.5 text-neutral-500 ${isDone ? "" : "animate-spin"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>
                {isDone ? "Complete" : "This usually takes a few seconds."}
              </span>
            </div>
          </div>
        </div>

        {/* Bento Information Grid */}
        <div className="grid grid-cols-2 gap-3 w-full pt-4 border-t border-[#e0d8d5]">
          <div className="p-4 bg-[#faf8f6] rounded-lg text-left border border-[#e0d8d5]">
            <p className="text-[10px] font-bold text-neutral-500 mb-1 uppercase tracking-wider">
              Target Account
            </p>
            <div className="flex items-center gap-2 text-[#191716]">
              <svg className="w-4 h-4 text-neutral-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 2l9 5H3l9-5z" />
              </svg>
              <span className="font-semibold text-sm sm:text-base">•••• 4242</span>
            </div>
          </div>
          <div className="p-4 bg-[#faf8f6] rounded-lg text-left border border-[#e0d8d5]">
            <p className="text-[10px] font-bold text-neutral-500 mb-1 uppercase tracking-wider">
              Est. Completion
            </p>
            <div className="flex items-center gap-2 text-[#191716]">
              <svg className="w-4 h-4 text-neutral-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="font-semibold text-sm sm:text-base">{isDone ? "Settled" : "< 1 min"}</span>
            </div>
          </div>
        </div>

        {/* Action Button after completion or manual navigation */}
        {isDone ? (
          <div className="w-full pt-2">
            <button
              type="button"
              onClick={handleFinish}
              className="w-full py-3 rounded-lg bg-[#191716] text-white text-xs uppercase tracking-widest font-medium hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              <span>Return to Payout Ledger</span>
              <span>→</span>
            </button>
          </div>
        ) : (
          /* Security Assurance */
          <div className="flex items-center justify-center gap-1.5 text-neutral-400 text-xs pt-2">
            <svg className="w-4 h-4 text-neutral-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clipRule="evenodd" />
            </svg>
            <span>Secured by Stripe End-to-End Encryption</span>
          </div>
        )}
      </div>
    </div>
  );

  if (embeddedInMarketplace) {
    return content;
  }

  // Standalone Layout with PREST Suite Topbar and Sidebar
  return (
    <div className="bg-[#fff8f5] text-[#191716] min-h-screen flex flex-col font-sans">
      {/* Top Header */}
      <header className="fixed top-0 w-full z-50 flex items-center justify-between px-6 bg-[#fffcf9] border-b border-[#e0d8d5] h-16 shadow-xs">
        <div className="flex items-center gap-8">
          <div className="flex items-baseline gap-2.5">
            <span className="font-serif text-2xl font-medium tracking-tight text-[#191716]">
              Prest
            </span>
            <span className="text-xs uppercase tracking-widest text-neutral-500 font-medium pl-2 border-l border-[#e0d8d5]">
              Restaurant Suite
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-xs text-neutral-600 font-medium">
            <button
              onClick={() => router.push("/marketplace/stripe/dashboard")}
              className="hover:text-neutral-900 transition-colors"
            >
              Dashboard
            </button>
            <button
              onClick={() => router.push("/marketplace/stripe/transactions")}
              className="hover:text-neutral-900 transition-colors"
            >
              Transactions
            </button>
            <button
              onClick={() => router.push("/marketplace/stripe/refunds")}
              className="hover:text-neutral-900 transition-colors"
            >
              Refunds
            </button>
            <button
              onClick={() => router.push("/marketplace/stripe/payouts")}
              className="text-[#191716] font-semibold border-b-2 border-[#191716] pb-1"
            >
              Payouts
            </button>
            <button
              onClick={() => {}}
              className="hover:text-neutral-900 transition-colors"
            >
              Insights
            </button>
            <button
              onClick={() => {}}
              className="hover:text-neutral-900 transition-colors"
            >
              Settings
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button className="w-8 h-8 rounded-full border border-[#e0d8d5] flex items-center justify-center text-neutral-600 hover:bg-neutral-50">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-full bg-[#191716] text-[#fff8f5] flex items-center justify-center text-xs font-serif font-medium">
            BA
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-16 h-full">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col h-[calc(100vh-64px)] w-[260px] bg-[#fff8f5] border-r border-[#e0d8d5] p-5 gap-3 fixed left-0">
          <div className="flex items-center gap-2.5 pb-4 border-b border-[#e0d8d5]">
            <div className="w-9 h-9 rounded-lg bg-[#191716] flex items-center justify-center text-white">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 2l9 5H3l9-5z" />
              </svg>
            </div>
            <div>
              <div className="font-serif text-sm font-semibold text-[#191716]">Prest Suite</div>
              <div className="text-[10px] text-neutral-400">Stripe Integration</div>
            </div>
          </div>

          <nav className="flex flex-col gap-1 text-xs text-neutral-600 flex-1 pt-2">
            <button
              onClick={() => router.push("/marketplace/stripe/dashboard")}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#f5ede8] hover:text-[#191716] text-left transition-colors"
            >
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => router.push("/marketplace/stripe/transactions")}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#f5ede8] hover:text-[#191716] text-left transition-colors"
            >
              <span>Transactions</span>
            </button>
            <button
              onClick={() => router.push("/marketplace/stripe/refunds")}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#f5ede8] hover:text-[#191716] text-left transition-colors"
            >
              <span>Refunds</span>
            </button>
            <button
              onClick={() => router.push("/marketplace/stripe/payouts")}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#efeae6] text-[#191716] font-semibold text-left shadow-xs"
            >
              <span>Payouts</span>
            </button>
            <button
              onClick={() => {}}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#f5ede8] hover:text-[#191716] text-left transition-colors"
            >
              <span>Insights</span>
            </button>
            <button
              onClick={() => {}}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#f5ede8] hover:text-[#191716] text-left transition-colors"
            >
              <span>Settings</span>
            </button>
          </nav>

          <div className="mt-auto pt-4 border-t border-[#e0d8d5]">
            <div className="bg-[#faf8f6] border border-[#e0d8d5] rounded-lg p-3 text-[11px] text-neutral-600 space-y-1">
              <div className="font-semibold text-[#191716] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Stripe Active
              </div>
              <p className="text-neutral-500 text-[10px]">Secure withdrawal in progress</p>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 lg:ml-[260px] flex items-center justify-center p-6 sm:p-12">
          {content}
        </main>
      </div>
    </div>
  );
}

