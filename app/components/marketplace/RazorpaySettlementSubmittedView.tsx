"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PosShell } from "../PosShell";
import { formatCurrencyMinor } from "../../lib/payments/currency";

export interface RazorpaySettlementSubmittedViewProps {
  settlementId?: string;
  embeddedInMarketplace?: boolean;
}

interface SettlementRecord {
  _id: string;
  providerSettlementId: string;
  amountMinor: number;
  currency: string;
  status: "pending" | "processed" | "failed" | "partially_processed";
  providerStatus: string;
  settlementDate: number;
  createdAt?: number;
  maskedAccount?: string;
  metadata?: any;
}

function formatCurrency(amountMinor: number, currency = "INR"): string {
  return formatCurrencyMinor(amountMinor, currency);
}

export function RazorpaySettlementSubmittedView({
  settlementId: propSettlementId,
  embeddedInMarketplace = false,
}: RazorpaySettlementSubmittedViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const settlementId = propSettlementId || searchParams.get("id") || "";

  const [settlement, setSettlement] = useState<SettlementRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettlement = useCallback(async () => {
    if (!settlementId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/payments/razorpay/settlements/${encodeURIComponent(settlementId)}`
      );
      const data = await res.json();

      if (!res.ok || !data.success || !data.settlement) {
        throw new Error(data.error || "Failed to load settlement details.");
      }

      setSettlement(data.settlement);
    } catch (err: any) {
      setError(err.message || "Could not retrieve settlement record.");
    } finally {
      setIsLoading(false);
    }
  }, [settlementId]);

  useEffect(() => {
    fetchSettlement();
  }, [fetchSettlement]);

  const status = settlement?.status || "pending";
  const isProcessed = status === "processed";
  const isFailed = status === "failed";
  const isProcessing = status === "pending" || (!isProcessed && !isFailed);

  // Status-dependent headings and descriptions per requirements
  const headingText = isProcessed
    ? "Settlement Processed"
    : isFailed
    ? "Settlement Failed"
    : "Request Submitted";

  const descriptionText = isProcessed
    ? "Your settlement request has been successfully processed and transferred to your bank."
    : isFailed
    ? "Your settlement request could not be completed by Razorpay."
    : "Your settlement request has been submitted and is currently being processed.";

  const content = (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 font-sans">
      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs text-[#78716c] font-medium"
      >
        <Link href="/marketplace" className="hover:text-[#0c0a09] transition-colors">
          Installed Apps
        </Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link href="/marketplace" className="hover:text-[#0c0a09] transition-colors">
          Payments
        </Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link
          href="/marketplace/razorpay/dashboard"
          className="hover:text-[#0c0a09] transition-colors"
        >
          Razorpay
        </Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link
          href="/marketplace/razorpay/settlements"
          className="hover:text-[#0c0a09] transition-colors"
        >
          Settlements
        </Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-[#0c0a09] font-semibold">Request Submitted</span>
      </nav>

      {/* Main Centered Card Container */}
      <div className="max-w-2xl mx-auto mt-4 sm:mt-8">
        <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-xs overflow-hidden relative">
          {/* Subtle decorative top wash */}
          <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-stone-50 to-transparent pointer-events-none" />

          <div className="p-8 sm:p-12 flex flex-col items-center text-center relative z-10">
            {/* Minimalist Processing / Confirmation Visual with decorative ring */}
            <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
              {/* Outer rotating dash ring */}
              <svg
                className="absolute inset-0 w-full h-full text-[#0c0a09] opacity-15 animate-[spin_10s_linear_infinite]"
                viewBox="0 0 100 100"
              >
                <circle
                  cx="50"
                  cy="50"
                  fill="none"
                  r="46"
                  stroke="currentColor"
                  strokeDasharray="10 20"
                  strokeLinecap="round"
                  strokeWidth="3.5"
                />
              </svg>

              {/* Inner container */}
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xs ${
                  isProcessed
                    ? "bg-emerald-50 text-emerald-700"
                    : isFailed
                    ? "bg-rose-50 text-rose-700"
                    : "bg-stone-100 text-[#0c0a09]"
                }`}
              >
                <span className="material-symbols-outlined text-3xl">
                  {isProcessed
                    ? "check_circle"
                    : isFailed
                    ? "error"
                    : "payments"}
                </span>
              </div>
            </div>

            {/* Heading & Description */}
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0c0a09] mb-2">
              {headingText}
            </h1>
            <p className="text-xs sm:text-sm text-[#78716c] max-w-md mx-auto mb-8 leading-relaxed">
              {descriptionText}
            </p>

            {/* Settlement Summary Card */}
            {isLoading ? (
              <div className="w-full bg-stone-50 border border-[#e7e5e4] rounded-xl p-6 text-center text-xs text-[#78716c]">
                <span className="material-symbols-outlined text-[20px] animate-spin mb-1 block mx-auto text-[#0c0a09]">
                  progress_activity
                </span>
                <span>Loading settlement record...</span>
              </div>
            ) : error || !settlement ? (
              <div className="w-full bg-stone-50 border border-[#e7e5e4] rounded-xl p-5 text-left text-xs">
                <p className="font-semibold text-[#0c0a09]">Request Registered</p>
                <p className="text-[#78716c] mt-0.5">
                  {error ||
                    "Settlement has been recorded with Razorpay. Full audit details will appear in your settlement history."}
                </p>
              </div>
            ) : (
              <div className="w-full bg-stone-50/70 border border-[#e7e5e4] rounded-xl p-5 sm:p-6 text-left shadow-2xs space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Settlement ID */}
                  <div>
                    <span className="block text-[11px] font-bold text-[#78716c] uppercase tracking-wider mb-1">
                      Settlement ID
                    </span>
                    <span className="font-mono text-sm font-semibold text-[#0c0a09]">
                      {settlement.providerSettlementId}
                    </span>
                  </div>

                  {/* Amount */}
                  <div>
                    <span className="block text-[11px] font-bold text-[#78716c] uppercase tracking-wider mb-1">
                      Amount
                    </span>
                    <span className="font-extrabold text-base text-[#0c0a09]">
                      {formatCurrency(settlement.amountMinor, settlement.currency)}
                    </span>
                  </div>

                  {/* Status */}
                  <div>
                    <span className="block text-[11px] font-bold text-[#78716c] uppercase tracking-wider mb-1.5">
                      Status
                    </span>
                    <div>
                      {isProcessed && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Processed
                        </span>
                      )}
                      {isProcessing && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          Processing
                        </span>
                      )}
                      {isFailed && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          Failed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Account */}
                  <div>
                    <span className="block text-[11px] font-bold text-[#78716c] uppercase tracking-wider mb-1">
                      Settlement Account
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#78716c]">
                        account_balance
                      </span>
                      <span className="text-xs font-semibold text-[#0c0a09]">
                        {settlement.maskedAccount || "HDFC Bank •••• 4521"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px w-full bg-[#e7e5e4]" />

                {/* Note Banner */}
                <div className="flex items-start gap-2.5 bg-white p-3 rounded-lg border border-[#e7e5e4]">
                  <span className="material-symbols-outlined text-[#0c0a09] text-[18px] mt-0.5 shrink-0">
                    info
                  </span>
                  <p className="text-xs text-[#78716c] leading-relaxed">
                    Settlement timing will be updated based on the latest status from Razorpay.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-5 sm:p-6 bg-stone-50/70 border-t border-[#e7e5e4] flex flex-col-reverse sm:flex-row justify-end items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/marketplace/razorpay/settlements")}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[#e7e5e4] bg-white text-[#0c0a09] text-xs font-semibold hover:bg-stone-50 transition-colors cursor-pointer shadow-2xs text-center"
            >
              Back to Settlements
            </button>
            <button
              type="button"
              onClick={() => {
                const targetId = settlement?.providerSettlementId || settlementId;
                if (targetId) {
                  router.push(
                    `/marketplace/razorpay/settlements/${encodeURIComponent(targetId)}`
                  );
                } else {
                  router.push("/marketplace/razorpay/settlements");
                }
              }}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#0c0a09] text-white text-xs font-semibold hover:bg-stone-800 transition-colors shadow-2xs cursor-pointer text-center"
            >
              View Settlement
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (embeddedInMarketplace) {
    return content;
  }

  return (
    <PosShell
      title="Settlements"
      subtitle="Track payout execution and gateway reconciliation."
    >
      {content}
    </PosShell>
  );
}

