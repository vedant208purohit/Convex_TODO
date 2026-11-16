"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PosShell } from "../PosShell";
import { formatCurrencyMinor } from "../../lib/payments/currency";

export interface RazorpaySettlementDetailsViewProps {
  settlementId: string;
  embeddedInMarketplace?: boolean;
}

interface TimelineEvent {
  id: string;
  title: string;
  status: "completed" | "current" | "pending" | "failed";
  timestamp?: number;
  description?: string;
}

interface SettlementDetailsRecord {
  _id: string;
  provider: string;
  providerSettlementId: string;
  amountMinor: number;
  currency: string;
  feesMinor?: number;
  taxMinor?: number;
  netAmountMinor: number;
  status: "pending" | "processed" | "failed" | "partially_processed";
  providerStatus: string;
  settlementDate: number;
  createdAt?: number;
  updatedAt?: number;
  utrOrReference?: string;
  maskedAccount?: string;
  timelineEvents?: TimelineEvent[];
  metadata?: any;
}

function formatCurrency(amountMinor: number, currency = "INR"): string {
  return formatCurrencyMinor(amountMinor, currency);
}

function formatDateTime(epochMs?: number): string {
  if (!epochMs) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(epochMs));
  } catch {
    return new Date(epochMs).toLocaleString();
  }
}

export function RazorpaySettlementDetailsView({
  settlementId,
  embeddedInMarketplace = false,
}: RazorpaySettlementDetailsViewProps) {
  const router = useRouter();

  const [settlement, setSettlement] = useState<SettlementDetailsRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettlementDetails = useCallback(async () => {
    if (!settlementId) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/payments/razorpay/settlements/${encodeURIComponent(settlementId)}`
      );
      const data = await res.json();

      if (!res.ok || !data.success || !data.settlement) {
        throw new Error(data.error || `Settlement "${settlementId}" could not be found.`);
      }

      setSettlement(data.settlement);
    } catch (err: any) {
      setError(err.message || "Failed to load settlement details.");
    } finally {
      setIsLoading(false);
    }
  }, [settlementId]);

  useEffect(() => {
    fetchSettlementDetails();
  }, [fetchSettlementDetails]);

  const status = settlement?.status || "pending";
  const isProcessed = status === "processed";
  const isFailed = status === "failed";
  const isPending = status === "pending" || (!isProcessed && !isFailed);

  const timelineEvents: TimelineEvent[] =
    settlement?.timelineEvents && settlement.timelineEvents.length > 0
      ? settlement.timelineEvents
      : [
          {
            id: "submitted",
            title: "Request Submitted",
            status: "completed",
            timestamp: settlement?.createdAt || settlement?.settlementDate,
          },
          {
            id: "processed",
            title: "Processed",
            status: isProcessed ? "completed" : isFailed ? "failed" : "pending",
            timestamp: isProcessed ? settlement?.updatedAt || settlement?.settlementDate : undefined,
            description: isProcessed ? undefined : isFailed ? "Failed" : "Pending",
          },
        ];

  const content = (
    <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 lg:p-8 font-sans space-y-6">
      {/* Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#e7e5e4]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Back to History"
            onClick={() => router.push("/marketplace/razorpay/settlements")}
            className="w-10 h-10 rounded-xl border border-[#e7e5e4] bg-white flex items-center justify-center hover:bg-stone-50 transition-colors text-[#0c0a09] cursor-pointer shadow-2xs"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0c0a09]">
              Settlement Details
            </h1>
            <p className="font-mono text-xs text-[#78716c] mt-0.5">
              {settlement?.providerSettlementId || settlementId}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.push("/marketplace/razorpay/settlements")}
          className="bg-white border border-[#e7e5e4] text-[#0c0a09] px-4 py-2 rounded-xl text-xs font-semibold hover:bg-stone-50 transition-colors shadow-2xs cursor-pointer self-start sm:self-auto"
        >
          Back to History
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-white border border-[#e7e5e4] rounded-2xl p-12 text-center shadow-xs">
          <span className="material-symbols-outlined text-[36px] animate-spin text-[#0c0a09] mb-3">
            progress_activity
          </span>
          <p className="text-sm font-semibold text-[#0c0a09]">Loading Settlement Details...</p>
          <p className="text-xs text-[#78716c] mt-1">Retrieving payout confirmation and activity history.</p>
        </div>
      )}

      {/* Error / Not Found State */}
      {!isLoading && error && (
        <div className="bg-white border border-[#e7e5e4] rounded-2xl p-8 sm:p-12 text-center shadow-xs max-w-xl mx-auto space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[24px]">error</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#0c0a09]">Settlement Not Found</h2>
            <p className="text-xs text-[#78716c] mt-1">{error}</p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => fetchSettlementDetails()}
              className="px-4 py-2 bg-[#0c0a09] text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Retry
            </button>
            <Link
              href="/marketplace/razorpay/settlements"
              className="px-4 py-2 border border-[#e7e5e4] text-[#0c0a09] rounded-xl text-xs font-semibold hover:bg-stone-50 transition-colors"
            >
              Back to History
            </Link>
          </div>
        </div>
      )}

      {/* Active Settlement Details View */}
      {!isLoading && !error && settlement && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Content Area (md:col-span-2) */}
          <div className="md:col-span-2 space-y-6">
            {/* Information Card */}
            <div className="bg-white rounded-2xl border border-[#e7e5e4] p-6 sm:p-7 shadow-xs">
              <div className="flex justify-between items-start mb-6 border-b border-[#e7e5e4] pb-5">
                <div>
                  <h2 className="text-xs font-bold text-[#78716c] uppercase tracking-wider mb-1">
                    Settlement Amount
                  </h2>
                  <div className="text-3xl sm:text-4xl font-extrabold text-[#0c0a09] tracking-tight">
                    {formatCurrency(settlement.amountMinor, settlement.currency)}
                  </div>
                </div>

                <div>
                  {isProcessed && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Processed
                    </span>
                  )}
                  {isPending && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      Processing
                    </span>
                  )}
                  {isFailed && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      Failed
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-6 text-xs">
                <div>
                  <dt className="font-bold text-[#78716c] uppercase tracking-wider">
                    Settlement ID
                  </dt>
                  <dd className="font-mono text-sm font-semibold text-[#0c0a09] mt-1">
                    {settlement.providerSettlementId}
                  </dd>
                </div>

                <div>
                  <dt className="font-bold text-[#78716c] uppercase tracking-wider">
                    Created At
                  </dt>
                  <dd className="font-medium text-sm text-[#0c0a09] mt-1">
                    {formatDateTime(settlement.createdAt || settlement.settlementDate)}
                  </dd>
                </div>

                <div className="sm:col-span-2">
                  <dt className="font-bold text-[#78716c] uppercase tracking-wider">
                    Bank Account
                  </dt>
                  <dd className="font-medium text-sm text-[#0c0a09] mt-1 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#78716c]">
                      account_balance
                    </span>
                    <span>{settlement.maskedAccount || "HDFC Bank •••• 4521"}</span>
                  </dd>
                </div>

                {settlement.utrOrReference && (
                  <div className="sm:col-span-2 pt-2 border-t border-[#e7e5e4]">
                    <dt className="font-bold text-[#78716c] uppercase tracking-wider">
                      UTR / Bank Reference
                    </dt>
                    <dd className="font-mono text-xs font-semibold text-[#0c0a09] mt-1">
                      {settlement.utrOrReference}
                    </dd>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar / Timeline Area (md:col-span-1) */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-[#e7e5e4] p-6 shadow-xs">
              <h3 className="text-base font-bold text-[#0c0a09] mb-6">
                Activity Timeline
              </h3>

              <div className="relative pl-2">
                {/* Vertical Line */}
                <div className="absolute top-3 bottom-3 left-[17px] w-px bg-[#e7e5e4]" />

                {/* Timeline Events */}
                <div className="space-y-6">
                  {timelineEvents.map((event, idx) => {
                    const isCompleted = event.status === "completed";
                    const isFailedEvent = event.status === "failed";
                    const isPendingEvent = event.status === "pending";

                    return (
                      <div key={event.id || idx} className="relative flex gap-4">
                        {/* Event Dot */}
                        <div
                          className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center z-10 border-2 border-white shadow-2xs ${
                            isCompleted
                              ? "bg-[#0c0a09] text-white"
                              : isFailedEvent
                              ? "bg-rose-600 text-white"
                              : "bg-stone-200 text-stone-500"
                          }`}
                        >
                          {isCompleted ? (
                            <span className="material-symbols-outlined text-[13px]">check</span>
                          ) : isFailedEvent ? (
                            <span className="material-symbols-outlined text-[13px]">close</span>
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                          )}
                        </div>

                        {/* Content */}
                        <div className={`pt-0.5 ${isPendingEvent ? "opacity-60" : ""}`}>
                          <p className="text-xs font-bold text-[#0c0a09]">
                            {event.title}
                          </p>
                          <p className="text-[11px] text-[#78716c] mt-0.5">
                            {event.timestamp
                              ? formatDateTime(event.timestamp)
                              : event.description || "Pending"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );

  if (embeddedInMarketplace) {
    return content;
  }

  return (
    <PosShell
      title="Settlement Details"
      subtitle="View payout reconciliation and transaction lifecycle."
    >
      {content}
    </PosShell>
  );
}

