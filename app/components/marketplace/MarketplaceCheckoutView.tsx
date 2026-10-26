"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PosShell } from "../PosShell";
import { INITIAL_MARKETPLACE_APPS } from "../../lib/services/marketplaceService";
import { MarketplaceApp } from "./types";

export function MarketplaceCheckoutView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appId = searchParams.get("appId") || "app-1";
  
  const app: MarketplaceApp =
    INITIAL_MARKETPLACE_APPS.find((a) => a.id === appId || a.slug === appId) ||
    INITIAL_MARKETPLACE_APPS[0];

  const [walletBalance, setWalletBalance] = useState<number>(8000);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(2); // Step 2: Wallet Audit

  const appPrice = app.priceAmount > 0 ? app.priceAmount : 5000;
  const projectedBalance = walletBalance - appPrice;

  const handleConfirmPurchase = () => {
    setIsAuthorizing(true);
    setTimeout(() => {
      setIsAuthorizing(false);
      setIsSuccess(true);
      setActiveStep(3);
      setWalletBalance((prev) => Math.max(0, prev - appPrice));
    }, 1200);
  };

  return (
    <PosShell title="Marketplace" subtitle="Order Verification">
      <div className="relative w-full min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-10 flex flex-col items-center justify-center overflow-hidden bg-[#fff8f5]">
        {/* Ambient Warm Editorial Texture Accents */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#eae1da]/40 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#ede7e4]/60 blur-3xl pointer-events-none" />

        {/* Top Floating Meta Status Pill */}
        <div className="absolute top-6 right-8 hidden md:flex items-center gap-2 bg-white px-4 py-1.5 rounded-full shadow-xs border border-stone-200/80 text-stone-800 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] tracking-wider uppercase text-stone-500 font-semibold">
            Live Verification
          </span>
          <span className="text-stone-300 text-[10px]">/</span>
          <span className="text-xs text-stone-900 font-semibold">Ready for Entitlement</span>
        </div>

        {/* Breadcrumb Bar */}
        <div className="w-full max-w-[640px] flex items-center gap-1.5 text-xs text-stone-500 font-medium mb-1">
          <Link href="/marketplace" className="hover:text-stone-900 transition-colors">
            Marketplace
          </Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-stone-900 font-semibold">Order Verification</span>
        </div>

        {/* Centered Editorial Purchase Card (640px max width) */}
        <div className="relative w-full max-w-[640px] flex flex-col bg-white rounded-3xl shadow-xl border border-stone-200/80 overflow-hidden my-4">
          {/* Stepper Header Section */}
          <div className="bg-[#faf2ee] px-6 sm:px-8 pt-7 pb-6 flex flex-col gap-6 border-b border-stone-200/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-stone-500 font-semibold">
                  Order Verification
                </span>
                <span className="text-stone-300 text-xs">•</span>
                <span className="text-xs text-stone-600 font-mono">Ref #WA-88219</span>
              </div>
              <span className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#ede7e4] text-stone-800 font-bold border border-stone-300/40">
                Tier 1 Outlet
              </span>
            </div>

            {/* Progress Flow Indicator */}
            <div className="flex items-center justify-between gap-2">
              {/* Step 1 */}
              <div className="flex items-center gap-2 flex-1">
                <div className="w-6 h-6 rounded-full bg-[#eae1da] text-stone-800 flex items-center justify-center text-xs font-semibold shrink-0">
                  <span className="material-symbols-outlined text-[14px]">check</span>
                </div>
                <span className="text-xs text-stone-500 hidden sm:inline font-medium">1. Summary</span>
              </div>

              <div className="h-0.5 w-8 sm:w-16 bg-[#eae1da]" />

              {/* Step 2: Active */}
              <div className="flex items-center gap-2 flex-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shadow-xs shrink-0 ${
                    activeStep >= 2
                      ? "bg-[#141010] text-white"
                      : "bg-[#ede7e4] text-stone-500"
                  }`}
                >
                  {activeStep > 2 ? <span className="material-symbols-outlined text-[14px]">check</span> : "2"}
                </div>
                <span className="text-xs text-stone-900 font-bold">2. Wallet Audit</span>
              </div>

              <div className={`h-0.5 w-8 sm:w-16 ${activeStep >= 3 ? "bg-[#141010]" : "bg-stone-200"}`} />

              {/* Step 3 */}
              <div className={`flex items-center gap-2 flex-1 ${activeStep < 3 ? "opacity-50" : ""}`}>
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                    activeStep >= 3
                      ? "bg-[#141010] text-white"
                      : "bg-stone-200 text-stone-600"
                  }`}
                >
                  3
                </div>
                <span className="text-xs text-stone-700 hidden sm:inline font-medium">3. Activation</span>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-6 sm:p-8 flex flex-col gap-6">
            {/* Product Identity Header */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#f3ecea] flex items-center justify-center shrink-0 shadow-xs text-stone-900 border border-stone-200/80">
                <span className="material-symbols-outlined text-[32px] text-[#141010]">
                  {app.iconName}
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full bg-[#faf2ee] text-stone-700 text-[10px] font-semibold border border-stone-200">
                    Official Integration
                  </span>
                  <span className="text-xs text-stone-500 font-medium">• Perpetual</span>
                </div>
                <h1 className="font-garamond text-2xl font-bold text-stone-900 leading-tight">
                  {app.title}
                </h1>
                <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                  Lifetime Organization License. Funds will be debited directly from your verified PREST Escrow Wallet.
                </p>
              </div>
            </div>

            {/* Financial Breakdown Ledger */}
            <div className="bg-[#faf2ee] rounded-2xl p-5 flex flex-col gap-3.5 border border-stone-200/60 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-stone-200/50">
                <span className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">
                  Purchase Specification
                </span>
                <span className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">
                  Amount (INR)
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex flex-col">
                  <span className="font-semibold text-stone-900">Base License (Unlimited Outlets)</span>
                  <span className="text-[11px] text-stone-500">Includes automated reservation & bill dispatches</span>
                </div>
                <span className="font-mono text-xs font-semibold text-stone-900">
                  ₹{appPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-stone-700 font-medium">Payment Gateway & Processing</span>
                  <span className="material-symbols-outlined text-stone-400 text-[15px]">info</span>
                </div>
                <div className="flex items-baseline gap-1.5 font-mono">
                  <span className="text-[11px] text-stone-400 line-through">₹125.00</span>
                  <span className="text-xs text-emerald-600 font-bold">₹0.00</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex flex-col">
                  <span className="text-stone-700 font-medium">GST (18% Inclusive)</span>
                  <span className="text-[11px] text-stone-500">HSN Code 998313 • Invoiced to The Grand Bistro</span>
                </div>
                <span className="font-mono text-xs text-stone-700 font-medium">₹0.00</span>
              </div>

              {/* Total Due Row */}
              <div className="pt-3 mt-1 flex items-baseline justify-between bg-white rounded-xl px-4 py-3 border border-stone-200/70">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">
                    Total Net Payable
                  </span>
                  <span className="text-[11px] text-stone-500">One-time payment • No renewal fees</span>
                </div>
                <span className="font-mono text-2xl font-bold text-stone-900 tracking-tight">
                  ₹{appPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Live Wallet Balance Verification Box */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200/80 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                    <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-stone-900">
                      Sufficient Wallet Balance Verified
                    </span>
                    <span className="text-[11px] text-stone-500">
                      Instant ledger confirmation active
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-emerald-600 text-[20px]">check_circle</span>
              </div>

              {/* Ledger Delta Math Visualizer */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="p-3 rounded-xl bg-stone-50 flex flex-col border border-stone-200/60">
                  <span className="text-[10px] text-stone-500 font-semibold uppercase tracking-wider">
                    Current Available
                  </span>
                  <span className="font-mono text-base font-bold text-stone-900 mt-1">
                    ₹{walletBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-rose-50/60 flex flex-col border border-rose-100">
                  <span className="text-[10px] text-rose-600 font-semibold uppercase tracking-wider">
                    Purchase Debit
                  </span>
                  <span className="font-mono text-base font-bold text-rose-700 mt-1">
                    −₹{appPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/80 flex flex-col border border-emerald-200/70">
                  <span className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider">
                    Projected Balance
                  </span>
                  <span className="font-mono text-base font-bold text-emerald-800 mt-1">
                    ₹{projectedBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Explanatory Notice */}
              <div className="flex items-start gap-2 pt-1 text-xs text-stone-600 leading-relaxed">
                <span className="material-symbols-outlined text-[16px] text-stone-400 shrink-0 mt-0.5">
                  lock
                </span>
                <p className="text-[11px]">
                  Upon confirmation, ₹{appPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })} will be committed instantly to the automated escrow pool. <strong className="text-stone-900 font-medium">{app.title}</strong> will immediately appear in your Installed Applications with setup tokens provisioned.
                </p>
              </div>
            </div>

            {/* Confirmation Actions */}
            <div className="flex flex-col gap-2.5 pt-1">
              <button
                type="button"
                disabled={isAuthorizing || isSuccess}
                onClick={handleConfirmPurchase}
                className="w-full flex items-center justify-between px-6 py-3.5 rounded-full bg-[#141010] text-white hover:bg-black transition-all shadow-md group cursor-pointer disabled:opacity-85"
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
                  <span className="text-sm font-semibold tracking-wide">
                    {isAuthorizing ? (
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                        <span>Committing Escrow Allocation...</span>
                      </span>
                    ) : isSuccess ? (
                      <span>Purchase Authorized • Balance Updated</span>
                    ) : (
                      `Confirm & Pay ₹${appPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                    )}
                  </span>
                </div>
                {!isAuthorizing && !isSuccess && (
                  <span className="material-symbols-outlined text-[20px] transition-transform group-hover:translate-x-1">
                    arrow_forward
                  </span>
                )}
              </button>

              <Link
                href="/marketplace"
                className="w-full text-center py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
              >
                Cancel and Return to Marketplace
              </Link>
            </div>

            {/* Trust & Compliance Guarantee Line */}
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left text-stone-500 text-[11px] bg-[#faf2ee] px-4 py-2.5 rounded-xl border border-stone-200/50">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-stone-600">policy</span>
                <span>RBI-compliant billing wallet escrow</span>
              </div>
              <span className="hidden sm:inline text-stone-300">•</span>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-stone-600">bolt</span>
                <span>Instant entitlement allocation</span>
              </div>
            </div>
          </div>

          {/* Simulated Success State Drawer Banner */}
          <div
            className={`p-4 flex items-center justify-between text-xs transition-colors border-t border-stone-200/80 ${
              isSuccess ? "bg-emerald-50 text-emerald-900" : "bg-[#f3ecea] text-stone-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-emerald-600">
                {isSuccess ? "verified" : "task_alt"}
              </span>
              <span className="text-[11px]">
                <strong className="font-semibold text-stone-900">Simulated State Preview:</strong> Remaining Balance: <strong className="font-mono font-semibold">₹{projectedBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong> • Status: <strong className="font-semibold">Installed — Setup Required</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={handleConfirmPurchase}
              className="text-[11px] font-semibold underline hover:text-stone-900 cursor-pointer"
            >
              Trigger Animation
            </button>
          </div>
        </div>
      </div>
    </PosShell>
  );
}
