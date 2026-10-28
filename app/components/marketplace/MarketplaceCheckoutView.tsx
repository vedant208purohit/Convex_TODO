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
      <div className="w-full min-h-full py-4 sm:py-6 lg:py-8 px-2.5 xs:px-4 sm:px-6 lg:px-8 bg-[#faf8f5] flex flex-col items-center">
        {/* Ambient Subtle Texture (isolated) */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#eae1da]/40 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#ede7e4]/60 blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-5xl flex flex-col gap-3.5 sm:gap-5 pb-8 sm:pb-12">
          {/* Top Breadcrumb & Live Verification Header */}
          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2.5 sm:gap-3 w-full">
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-[#5e5e5e] font-medium flex-wrap">
              <Link href="/marketplace" className="hover:text-[#0c0a09] transition-colors">
                Marketplace
              </Link>
              <span className="material-symbols-outlined text-[13px] sm:text-[14px]">chevron_right</span>
              <span className="text-[#0c0a09] font-semibold">Order Verification</span>
            </div>

            <div className="inline-flex items-center gap-1.5 sm:gap-2 self-start xs:self-auto bg-white px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full shadow-2xs border border-[#e7e5e4] text-[#0c0a09] text-[10px] sm:text-xs">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] sm:text-[10px] tracking-wider uppercase text-[#5e5e5e] font-semibold">
                Live Verification
              </span>
              <span className="text-[#e7e5e4] text-[9px] sm:text-[10px]">/</span>
              <span className="text-[10px] sm:text-xs text-[#0c0a09] font-semibold">Ready for Entitlement</span>
            </div>
          </div>

          {/* MAIN UNIFIED EDITORIAL PURCHASE CARD - Fully Responsive for Mobile, Fold, Tablet, Mac, Windows */}
          <div className="w-full bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-[#e7e5e4] overflow-hidden flex flex-col">
            {/* Unified Top Stepper Header */}
            <div className="bg-[#fdf8f7] px-3.5 xs:px-5 sm:px-8 py-3 sm:py-4.5 border-b border-[#e7e5e4] flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[#5e5e5e] font-semibold">
                  Order Verification
                </span>
                <span className="text-[#e7e5e4] text-xs">•</span>
                <span className="text-[11px] sm:text-xs text-[#5e5e5e] font-mono">Ref #WA-88219</span>
                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white text-[#0c0a09] font-bold border border-[#e7e5e4] ml-1">
                  Tier 1 Outlet
                </span>
              </div>

              {/* Progress Steps Flow - responsive overflow & sizing */}
              <div className="flex items-center gap-1.5 sm:gap-3 overflow-x-auto scrollbar-none py-0.5">
                {/* Step 1 */}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center justify-center text-[9px] sm:text-[10px] font-bold shrink-0">
                    <span className="material-symbols-outlined text-[10px] sm:text-[12px]">check</span>
                  </div>
                  <span className="text-[11px] sm:text-xs text-[#5e5e5e] font-medium hidden sm:inline">1. Summary</span>
                </div>

                <div className="h-0.5 w-4 sm:w-8 bg-emerald-300 shrink-0" />

                {/* Step 2: Active */}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <div
                    className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold shrink-0 shadow-2xs ${
                      activeStep >= 2
                        ? "bg-[#0c0a09] text-white"
                        : "bg-white text-[#5e5e5e] border border-[#e7e5e4]"
                    }`}
                  >
                    {activeStep > 2 ? (
                      <span className="material-symbols-outlined text-[10px] sm:text-[12px]">check</span>
                    ) : (
                      "2"
                    )}
                  </div>
                  <span className="text-[11px] sm:text-xs text-[#0c0a09] font-bold">2. Wallet Audit</span>
                </div>

                <div
                  className={`h-0.5 w-4 sm:w-8 shrink-0 ${
                    activeStep >= 3 ? "bg-[#0c0a09]" : "bg-[#e7e5e4]"
                  }`}
                />

                {/* Step 3 */}
                <div
                  className={`flex items-center gap-1 sm:gap-1.5 shrink-0 ${
                    activeStep < 3 ? "opacity-50" : ""
                  }`}
                >
                  <div
                    className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold shrink-0 ${
                      activeStep >= 3
                        ? "bg-[#0c0a09] text-white"
                        : "bg-white text-[#5e5e5e] border border-[#e7e5e4]"
                    }`}
                  >
                    3
                  </div>
                  <span className="text-[11px] sm:text-xs text-[#5e5e5e] font-medium hidden sm:inline">3. Activation</span>
                </div>
              </div>
            </div>

            {/* Split Panel: Left Details (Col 7) + Right Action (Col 5) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-0">
              {/* LEFT PANEL (7 COLS): Product Details + Financial Breakdown + Wallet Status */}
              <div className="lg:col-span-7 p-4 xs:p-5 sm:p-7 flex flex-col gap-4 sm:gap-5 border-b lg:border-b-0 lg:border-r border-[#e7e5e4]">
                {/* Product Identity */}
                <div className="flex items-start gap-3 sm:gap-3.5 pb-3.5 sm:pb-4 border-b border-[#f1edec]">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#fdf8f7] flex items-center justify-center shrink-0 shadow-xs text-[#0c0a09] border border-[#e7e5e4]">
                    <span className="material-symbols-outlined text-[24px] sm:text-[28px] text-[#0c0a09]">
                      {app.iconName}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full bg-[#fdf8f7] text-[#0c0a09] text-[9px] sm:text-[10px] font-semibold border border-[#e7e5e4]">
                        Official Integration
                      </span>
                      <span className="text-[11px] sm:text-xs text-[#5e5e5e] font-medium">• Perpetual</span>
                    </div>
                    <h1 className="font-garamond text-lg xs:text-xl sm:text-2xl font-bold text-[#0c0a09] leading-tight break-words">
                      {app.title}
                    </h1>
                    <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-0.5 leading-relaxed">
                      Lifetime Organization License. Debited directly from your PREST Escrow Wallet.
                    </p>
                  </div>
                </div>

                {/* Purchase Specification Table */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#f1edec]">
                    <span className="text-[9px] sm:text-[10px] text-[#5e5e5e] uppercase tracking-wider font-semibold">
                      Purchase Specification
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-[#5e5e5e] uppercase tracking-wider font-semibold">
                      Amount (INR)
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-[#0c0a09] text-[11px] sm:text-xs">
                        Base License (Unlimited Outlets)
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-[#5e5e5e]">
                        Includes automated reservation & bill dispatches
                      </span>
                    </div>
                    <span className="font-mono text-[11px] sm:text-xs font-semibold text-[#0c0a09] shrink-0 text-right">
                      ₹{appPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[#5e5e5e] font-medium text-[11px] sm:text-xs">Payment Gateway & Processing</span>
                      <span className="material-symbols-outlined text-stone-400 text-[13px] sm:text-[14px] shrink-0">info</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 font-mono shrink-0 text-right">
                      <span className="text-[10px] sm:text-[11px] text-[#5e5e5e] line-through">₹125.00</span>
                      <span className="text-[11px] sm:text-xs text-emerald-600 font-bold">₹0.00 Free</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[#5e5e5e] font-medium text-[11px] sm:text-xs">GST (18% Inclusive)</span>
                      <span className="text-[10px] sm:text-[11px] text-[#5e5e5e]">
                        HSN Code 998313 • Invoiced to The Grand Bistro
                      </span>
                    </div>
                    <span className="font-mono text-[11px] sm:text-xs font-medium text-[#0c0a09] shrink-0 text-right">
                      ₹0.00
                    </span>
                  </div>

                  {/* Total Net Payable Highlight Bar */}
                  <div className="pt-2 sm:pt-2.5 mt-1 flex items-baseline justify-between bg-[#fdf8f7] rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 border border-[#e7e5e4] gap-2 flex-wrap xs:flex-nowrap">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[#5e5e5e] font-bold">
                        Total Net Payable
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-[#5e5e5e]">One-time payment • No renewal fees</span>
                    </div>
                    <span className="font-mono text-lg sm:text-2xl font-bold text-[#0c0a09] tracking-tight shrink-0">
                      ₹{appPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Live Wallet Balance Verification */}
                <div className="rounded-xl sm:rounded-2xl p-3.5 sm:p-4 bg-[#fdf8f7]/70 border border-[#e7e5e4] flex flex-col gap-2.5 sm:gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                        <span className="material-symbols-outlined text-[13px] sm:text-[15px]">verified_user</span>
                      </span>
                      <span className="text-[11px] sm:text-xs font-bold text-[#0c0a09] truncate">
                        Sufficient Wallet Balance Verified
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-emerald-600 text-[16px] sm:text-[18px] shrink-0">
                      check_circle
                    </span>
                  </div>

                  {/* 3 Metrics Cards - responsive for Fold, Mobile, Desktop */}
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-white flex flex-col border border-[#e7e5e4] min-w-0">
                      <span className="text-[8px] xs:text-[9px] text-[#5e5e5e] font-semibold uppercase tracking-wider truncate">
                        Available
                      </span>
                      <span className="font-mono text-[11px] xs:text-xs sm:text-sm font-bold text-[#0c0a09] mt-0.5 truncate">
                        ₹{walletBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-rose-50/70 flex flex-col border border-rose-100 min-w-0">
                      <span className="text-[8px] xs:text-[9px] text-rose-600 font-semibold uppercase tracking-wider truncate">
                        Debit
                      </span>
                      <span className="font-mono text-[11px] xs:text-xs sm:text-sm font-bold text-rose-700 mt-0.5 truncate">
                        −₹{appPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-emerald-50/80 flex flex-col border border-emerald-200/70 min-w-0">
                      <span className="text-[8px] xs:text-[9px] text-emerald-700 font-semibold uppercase tracking-wider truncate">
                        Projected
                      </span>
                      <span className="font-mono text-[11px] xs:text-xs sm:text-sm font-bold text-emerald-800 mt-0.5 truncate">
                        ₹{projectedBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Escrow Lock Note */}
                  <div className="flex items-start gap-1.5 pt-0.5 text-xs text-[#5e5e5e] leading-relaxed">
                    <span className="material-symbols-outlined text-[13px] sm:text-[14px] text-stone-400 shrink-0 mt-0.5">
                      lock
                    </span>
                    <p className="text-[9px] sm:text-[10px]">
                      Upon confirmation, ₹{appPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })} is committed instantly to the automated escrow pool with setup tokens provisioned.
                    </p>
                  </div>
                </div>
              </div>

              {/* RIGHT PANEL (5 COLS): Payment Action & Guarantees */}
              <div className="lg:col-span-5 bg-[#fdf8f7] p-4 xs:p-5 sm:p-7 flex flex-col justify-between gap-4 sm:gap-5">
                <div className="flex flex-col gap-3.5 sm:gap-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#e7e5e4]">
                    <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
                      Payment Authorization
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                      Ready to Charge
                    </span>
                  </div>

                  {/* Summary Breakdown Mini-Table */}
                  <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-[#e7e5e4] flex flex-col gap-2 sm:gap-2.5 text-xs">
                    <div className="flex items-center justify-between text-[#5e5e5e] text-[11px] sm:text-xs gap-2">
                      <span className="shrink-0">Application</span>
                      <span className="font-semibold text-[#0c0a09] truncate text-right">{app.title}</span>
                    </div>
                    <div className="flex items-center justify-between text-[#5e5e5e] text-[11px] sm:text-xs">
                      <span>Billing Method</span>
                      <span className="font-semibold text-[#0c0a09]">Escrow Wallet</span>
                    </div>
                    <div className="flex items-center justify-between text-[#5e5e5e] text-[11px] sm:text-xs">
                      <span>Billing Frequency</span>
                      <span className="font-semibold text-[#0c0a09]">Perpetual / Lifetime</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[#f1edec] font-semibold text-xs">
                      <span>Total Debit</span>
                      <span className="font-mono text-sm sm:text-base font-bold text-[#0c0a09]">
                        ₹{appPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Big Primary Action Button */}
                  <div className="flex flex-col gap-2 pt-0.5 sm:pt-1">
                    <button
                      type="button"
                      disabled={isAuthorizing || isSuccess}
                      onClick={handleConfirmPurchase}
                      className="w-full flex items-center justify-between px-3.5 sm:px-5 py-3 sm:py-3.5 rounded-xl bg-[#0c0a09] text-white hover:bg-[#262626] transition-all shadow-md group cursor-pointer disabled:opacity-85"
                    >
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <span className="material-symbols-outlined text-[17px] sm:text-[19px] shrink-0">shopping_bag</span>
                        <span className="text-xs sm:text-sm font-semibold tracking-wide truncate">
                          {isAuthorizing ? (
                            <span className="flex items-center gap-1.5 sm:gap-2">
                              <span className="material-symbols-outlined animate-spin text-[14px] sm:text-[16px] shrink-0">
                                progress_activity
                              </span>
                              <span className="truncate">Authorizing Escrow...</span>
                            </span>
                          ) : isSuccess ? (
                            <span>Purchase Authorized ✓</span>
                          ) : (
                            `Confirm & Pay ₹${appPrice.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}`
                          )}
                        </span>
                      </div>
                      {!isAuthorizing && !isSuccess && (
                        <span className="material-symbols-outlined text-[16px] sm:text-[18px] transition-transform group-hover:translate-x-1 shrink-0 ml-1">
                          arrow_forward
                        </span>
                      )}
                    </button>

                    <Link
                      href="/marketplace"
                      className="w-full text-center py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-[#5e5e5e] hover:text-[#0c0a09] transition-colors"
                    >
                      Cancel and Return to Marketplace
                    </Link>
                  </div>
                </div>

                {/* Bottom Trust & Preview Section */}
                <div className="flex flex-col gap-2.5 sm:gap-3 pt-2.5 sm:pt-3 border-t border-[#e7e5e4]">
                  {/* Trust badges */}
                  <div className="flex flex-col gap-1.5 text-[10px] sm:text-[11px] text-[#5e5e5e]">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] sm:text-[15px] shrink-0 text-[#5e5e5e]">
                        policy
                      </span>
                      <span>RBI-compliant billing wallet escrow</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] sm:text-[15px] shrink-0 text-[#5e5e5e]">
                        bolt
                      </span>
                      <span>Instant entitlement allocation</span>
                    </div>
                  </div>

                  {/* Simulated Preview Box (neatly integrated inside right panel) */}
                  <div
                    className={`p-2.5 sm:p-3 rounded-xl border text-xs flex flex-col gap-1 sm:gap-1.5 transition-colors ${
                      isSuccess
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : "bg-white border-[#e7e5e4] text-[#0c0a09]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-[10px] sm:text-[11px]">
                        <span className="material-symbols-outlined text-[15px] sm:text-[16px] text-emerald-600 shrink-0">
                          {isSuccess ? "verified" : "task_alt"}
                        </span>
                        <span>State Preview</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleConfirmPurchase}
                        className="text-[9px] sm:text-[10px] font-semibold underline hover:text-[#0c0a09] cursor-pointer"
                      >
                        Trigger Test
                      </button>
                    </div>
                    <p className="text-[9px] sm:text-[10px] text-[#5e5e5e] leading-snug">
                      Remaining Balance:{" "}
                      <strong className="font-mono text-[#0c0a09]">
                        ₹{projectedBalance.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </strong>{" "}
                      • Status: <strong className="text-[#0c0a09]">Installed</strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PosShell>
  );
}
