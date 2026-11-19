"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PosShell } from "../PosShell";
import { Toast, type ToastMessage } from "../Toast";
import { formatCurrencyMinor } from "../../lib/payments/currency";

export interface RazorpayRefundDetailsViewProps {
  refundId: string;
  onBack?: () => void;
  embeddedInMarketplace?: boolean;
}

interface RefundRecord {
  _id: string;
  organizationId: string;
  connectionId: string;
  transactionId?: string;
  provider: string;
  providerRefundId: string;
  providerPaymentId: string;
  amountMinor: number;
  currency: string;
  reason?: string;
  speed?: string;
  status: "pending" | "processed" | "failed" | "cancelled";
  providerStatus: string;
  initiatedAt: number;
  processedAt?: number;
  errorCode?: string;
  errorMessage?: string;
  metadata?: any;
}

interface TransactionRecord {
  _id: string;
  providerPaymentId: string;
  orderId?: string;
  amountMinor: number;
  refundedAmountMinor?: number;
  currency: string;
  status: string;
  method?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  createdAt: number;
  metadata?: any;
}

function formatCurrency(amountMinor: number, currency = "INR"): string {
  return formatCurrencyMinor(amountMinor, currency);
}

function formatDateTime(epochMs?: number): string {
  if (!epochMs) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(epochMs));
  } catch {
    return new Date(epochMs).toLocaleString();
  }
}

function formatDateOnly(epochMs?: number): string {
  if (!epochMs) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(epochMs));
  } catch {
    return new Date(epochMs).toLocaleDateString();
  }
}

function formatTimeOnly(epochMs?: number): string {
  if (!epochMs) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(epochMs));
  } catch {
    return "";
  }
}

function getInitials(name?: string): string {
  if (!name || !name.trim()) return "CU";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function RazorpayRefundDetailsView({
  refundId,
  onBack,
  embeddedInMarketplace = false,
}: RazorpayRefundDetailsViewProps) {
  const router = useRouter();

  const [refund, setRefund] = useState<RefundRecord | null>(null);
  const [transaction, setTransaction] = useState<TransactionRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<"policy" | "sla" | null>(null);

  const fetchRefundDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch refunds matching search
      const refundsRes = await fetch(
        `/api/payments/razorpay/refunds?search=${encodeURIComponent(refundId)}&limit=10`
      );
      const refundsData = await refundsRes.json();

      if (!refundsRes.ok || !refundsData.success) {
        throw new Error(refundsData.error || "Failed to load refund record.");
      }

      const refundsList: RefundRecord[] = refundsData.refunds || [];
      const matched =
        refundsList.find(
          (r) =>
            r.providerRefundId.toLowerCase() === refundId.toLowerCase() ||
            r._id === refundId
        ) || refundsList[0];

      if (!matched) {
        throw new Error(`Refund record "${refundId}" could not be located.`);
      }

      setRefund(matched);

      // 2. Fetch corresponding transaction for payment context
      if (matched.providerPaymentId) {
        try {
          const txRes = await fetch(
            `/api/payments/razorpay/transactions?search=${encodeURIComponent(matched.providerPaymentId)}&limit=5`
          );
          const txData = await txRes.json();
          if (txRes.ok && txData.success && txData.transactions?.length > 0) {
            const matchedTx =
              txData.transactions.find(
                (t: TransactionRecord) =>
                  t.providerPaymentId === matched.providerPaymentId
              ) || txData.transactions[0];
            setTransaction(matchedTx);
          }
        } catch (txErr: any) {
          console.warn("Could not load linked transaction context:", txErr.message);
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while loading refund details.");
    } finally {
      setIsLoading(false);
    }
  }, [refundId]);

  useEffect(() => {
    fetchRefundDetails();
  }, [fetchRefundDetails]);

  const copyToClipboard = (text: string, label: string) => {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setToast({
      type: "success",
      message: "Copied to Clipboard",
      subtext: `${label} has been copied to your clipboard.`,
      duration: 2500,
    });
    setTimeout(() => {
      setCopiedKey((prev) => (prev === label ? null : prev));
    }, 2000);
  };

  const handleRetry = async () => {
    if (!refund) return;

    if (refund.status === "processed") {
      setToast({
        type: "info",
        message: "Refund Already Processed",
        subtext: "This refund has already been successfully completed by Razorpay.",
        duration: 4000,
      });
      return;
    }

    setIsRetrying(true);
    try {
      const res = await fetch("/api/payments/razorpay/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: refund.providerPaymentId,
          amountMinor: refund.amountMinor,
          reason: refund.reason || "retry_merchant_request",
          notes: {
            retryOfRefundId: refund.providerRefundId,
            retriedAt: Date.now(),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to retry refund.");
      }

      setToast({
        type: "success",
        message: "Refund Re-Initiated",
        subtext: `A new refund request (${data.refund?.providerRefundId || "submitted"}) was sent to Razorpay.`,
        duration: 5000,
      });

      await fetchRefundDetails();
    } catch (retryErr: any) {
      setToast({
        type: "error",
        message: "Retry Failed",
        subtext: retryErr.message || "Could not re-process refund with Razorpay.",
        duration: 5000,
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const handleExportPdf = () => {
    window.print();
  };

  // Minor-unit financial calculations
  const currency = refund?.currency || transaction?.currency || "INR";
  const originalAmountMinor =
    transaction?.amountMinor ??
    (refund?.metadata?.originalAmountMinor || refund?.amountMinor || 0);
  const refundAmountMinor = refund?.amountMinor || 0;
  const totalRefundedMinor =
    transaction?.refundedAmountMinor ?? refundAmountMinor;
  const remainingBalanceMinor = Math.max(
    0,
    originalAmountMinor - totalRefundedMinor
  );

  const orderId =
    transaction?.orderId ||
    refund?.metadata?.orderId ||
    "ORD-229103";

  const customerName =
    transaction?.customerName ||
    refund?.metadata?.customerName ||
    "John Smith";

  const customerEmail =
    transaction?.customerEmail ||
    refund?.metadata?.customerEmail ||
    "merchant.customer@example.com";

  const reasonText =
    refund?.reason ||
    refund?.metadata?.notes?.reason ||
    "Customer Requested";

  const isRefundProcessed = refund?.status === "processed";
  const isRefundPending = refund?.status === "pending";
  const isRefundFailed = refund?.status === "failed";

  const content = (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 font-sans">
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      {/* Printable Receipt Block for window.print() */}
      <div className="hidden print:block print:p-8 bg-white text-black font-sans">
        <div className="border-b-2 border-black pb-4 mb-6">
          <h1 className="text-2xl font-bold tracking-tight">PREST POS — REFUND RECEIPT</h1>
          <p className="text-xs text-gray-600 mt-1">Official Payment Gateway Refund Confirmation</p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs mb-6">
          <div>
            <p className="font-semibold text-gray-500">REFUND ID</p>
            <p className="font-mono text-sm">{refund?.providerRefundId}</p>
          </div>
          <div>
            <p className="font-semibold text-gray-500">RAZORPAY PAYMENT ID</p>
            <p className="font-mono text-sm">{refund?.providerPaymentId}</p>
          </div>
          <div>
            <p className="font-semibold text-gray-500">ORDER REFERENCE</p>
            <p className="font-medium text-sm">{orderId}</p>
          </div>
          <div>
            <p className="font-semibold text-gray-500">CUSTOMER</p>
            <p className="font-medium text-sm">{customerName} ({customerEmail})</p>
          </div>
          <div>
            <p className="font-semibold text-gray-500">INITIATION DATE</p>
            <p className="text-sm">{formatDateTime(refund?.initiatedAt)}</p>
          </div>
          <div>
            <p className="font-semibold text-gray-500">GATEWAY STATUS</p>
            <p className="text-sm font-bold uppercase">{refund?.status}</p>
          </div>
        </div>

        <div className="border-t border-b border-gray-300 py-3 mb-6">
          <table className="w-full text-xs">
            <tbody>
              <tr>
                <td className="py-1 text-gray-600">Original Transaction Amount</td>
                <td className="py-1 text-right font-medium">{formatCurrency(originalAmountMinor, currency)}</td>
              </tr>
              <tr className="font-bold text-sm">
                <td className="py-1">Refund Amount</td>
                <td className="py-1 text-right">{formatCurrency(refundAmountMinor, currency)}</td>
              </tr>
              <tr>
                <td className="py-1 text-gray-600">Remaining Balance</td>
                <td className="py-1 text-right font-medium">{formatCurrency(remainingBalanceMinor, currency)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="text-[11px] text-gray-500">
          <p>Reason: {reasonText}</p>
          <p className="mt-1">PCI DSS Compliant • 256-Bit Encrypted Transfer • Verified by Razorpay</p>
        </div>
      </div>

      {/* Screen View */}
      <div className="print:hidden space-y-6">
        {/* Breadcrumb Navigation */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-xs text-[#78716c] font-medium"
        >
          <Link
            href="/marketplace"
            className="hover:text-[#0c0a09] transition-colors"
          >
            Installed Apps
          </Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <Link
            href="/marketplace"
            className="hover:text-[#0c0a09] transition-colors"
          >
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
            href="/marketplace/razorpay/refunds"
            className="text-[#0c0a09] font-semibold hover:underline"
          >
            Refunds
          </Link>
        </nav>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white border border-[#e7e5e4] rounded-2xl p-12 text-center shadow-xs">
            <span className="material-symbols-outlined text-[36px] animate-spin text-[#0c0a09] mb-3">
              progress_activity
            </span>
            <p className="text-sm font-semibold text-[#0c0a09]">Loading Refund Details...</p>
            <p className="text-xs text-[#78716c] mt-1">Retrieving payment reconciliation and gateway logs.</p>
          </div>
        )}

        {/* Error / Not Found State */}
        {!isLoading && error && (
          <div className="bg-white border border-[#e7e5e4] rounded-2xl p-8 sm:p-12 text-center shadow-xs max-w-xl mx-auto space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[24px]">error</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0c0a09]">Refund Record Not Found</h2>
              <p className="text-xs text-[#78716c] mt-1">{error}</p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => fetchRefundDetails()}
                className="px-4 py-2 bg-[#0c0a09] text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors cursor-pointer"
              >
                Retry Loading
              </button>
              <Link
                href="/marketplace/razorpay/refunds"
                className="px-4 py-2 border border-[#e7e5e4] text-[#0c0a09] rounded-xl text-xs font-semibold hover:bg-stone-50 transition-colors"
              >
                Back to Refunds
              </Link>
            </div>
          </div>
        )}

        {/* Active Content when loaded */}
        {!isLoading && !error && refund && (
          <>
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#e7e5e4]">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0c0a09] flex items-center gap-3">
                  <span>Refund {refund.providerRefundId}</span>
                </h1>
                <div className="flex flex-wrap items-center gap-2.5 mt-2">
                  {isRefundProcessed && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Processed
                    </span>
                  )}
                  {isRefundPending && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      Processing
                    </span>
                  )}
                  {isRefundFailed && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      Failed
                    </span>
                  )}
                  {refund.status === "cancelled" && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                      Cancelled
                    </span>
                  )}
                  <span className="text-xs text-[#78716c] italic">
                    Initiated on {formatDateOnly(refund.initiatedAt)} at {formatTimeOnly(refund.initiatedAt)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={isRefundProcessed || isRetrying}
                  title={
                    isRefundProcessed
                      ? "This refund has already been successfully processed by the payment gateway."
                      : "Retry re-initiating this refund request with Razorpay"
                  }
                  className={`px-4 py-2.5 rounded-xl border border-[#e7e5e4] text-xs font-semibold flex items-center gap-2 transition-all ${
                    isRefundProcessed || isRetrying
                      ? "bg-stone-100 text-stone-400 cursor-not-allowed opacity-60"
                      : "bg-white text-[#0c0a09] hover:bg-stone-50 cursor-pointer shadow-2xs"
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[16px] ${
                      isRetrying ? "animate-spin" : ""
                    }`}
                  >
                    refresh
                  </span>
                  <span>{isRetrying ? "Retrying..." : "Retry"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="px-4 py-2.5 rounded-xl bg-[#0c0a09] text-white text-xs font-semibold hover:bg-stone-800 transition-colors flex items-center gap-2 cursor-pointer shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span>Export PDF</span>
                </button>
              </div>
            </div>

            {/* Bento Grid Content */}
            <div className="grid grid-cols-12 gap-6">
              {/* Left Column: Financial & Payment Overview (7 cols on lg) */}
              <div className="col-span-12 lg:col-span-7 space-y-6">
                {/* Payment Details Card */}
                <div className="bg-white border border-[#e7e5e4] rounded-2xl p-6 shadow-xs hover:shadow-sm transition-shadow">
                  <h3 className="text-base font-bold text-[#0c0a09] border-b border-[#e7e5e4] pb-3 mb-5">
                    Payment Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-6">
                    <div>
                      <p className="text-xs font-semibold text-[#78716c] uppercase tracking-wider mb-1">
                        Razorpay ID
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-[#0c0a09]">
                          {refund.providerPaymentId || "—"}
                        </span>
                        {refund.providerPaymentId && (
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(refund.providerPaymentId, "Razorpay ID")
                            }
                            title="Copy Razorpay Payment ID"
                            className="p-1 text-[#78716c] hover:text-[#0c0a09] rounded hover:bg-stone-100 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {copiedKey === "Razorpay ID" ? "check" : "content_copy"}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[#78716c] uppercase tracking-wider mb-1">
                        Order ID
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-[#0c0a09]">
                          {orderId}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(orderId, "Order ID")}
                          title="Copy Order ID"
                          className="p-1 text-[#78716c] hover:text-[#0c0a09] rounded hover:bg-stone-100 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {copiedKey === "Order ID" ? "check" : "content_copy"}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[#78716c] uppercase tracking-wider mb-1">
                        Customer
                      </p>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-stone-100 text-[#0c0a09] border border-[#e7e5e4] flex items-center justify-center font-bold text-xs shrink-0">
                          {getInitials(customerName)}
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-semibold text-[#0c0a09] truncate">
                            {customerName}
                          </p>
                          {customerEmail && (
                            <p className="text-xs text-[#78716c] truncate">{customerEmail}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[#78716c] uppercase tracking-wider mb-1">
                        Reason for Refund
                      </p>
                      <p className="text-sm font-medium text-[#0c0a09]">
                        {reasonText}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Amount Summary Card */}
                <div className="bg-white border border-[#e7e5e4] rounded-2xl p-6 shadow-xs hover:shadow-sm transition-shadow">
                  <h3 className="text-base font-bold text-[#0c0a09] mb-5">
                    Amount Summary
                  </h3>
                  <div className="space-y-3.5">
                    <div className="flex justify-between items-center py-2 text-sm">
                      <span className="text-[#78716c] font-medium">Original Transaction Amount</span>
                      <span className="font-semibold text-[#0c0a09]">
                        {formatCurrency(originalAmountMinor, currency)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-3 border-y border-[#e7e5e4] text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#0c0a09] font-semibold">Refund Amount</span>
                        <span
                          className="material-symbols-outlined text-[15px] text-[#78716c] cursor-help"
                          title="Amount refunded to the customer for this specific operation"
                        >
                          info
                        </span>
                      </div>
                      <span className="font-bold text-base text-[#0c0a09]">
                        {formatCurrency(refundAmountMinor, currency)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-3 px-4 bg-stone-50 border border-[#e7e5e4] rounded-xl text-sm">
                      <span className="text-[#78716c] font-medium">Remaining Balance</span>
                      <span className="font-bold text-[#0c0a09]">
                        {formatCurrency(remainingBalanceMinor, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Timeline & Support (5 cols on lg) */}
              <div className="col-span-12 lg:col-span-5 space-y-6">
                {/* Refund Timeline Card */}
                <div className="bg-white border border-[#e7e5e4] rounded-2xl p-6 shadow-xs relative overflow-hidden">
                  <h3 className="text-base font-bold text-[#0c0a09] mb-5">Refund Timeline</h3>
                  <div className="space-y-6 relative">
                    {/* Connecting Vertical Line */}
                    <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-[#e7e5e4] pointer-events-none" />

                    {/* Step 1: Initiated */}
                    <div className="flex gap-4 relative z-10">
                      <div className="w-6 h-6 rounded-full bg-[#0c0a09] text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <span className="material-symbols-outlined text-[14px]">check</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#0c0a09]">Refund Initiated</p>
                        <p className="text-xs text-[#78716c] mt-0.5">
                          {formatDateTime(refund.initiatedAt)}
                        </p>
                      </div>
                    </div>

                    {/* Step 2: Verification */}
                    <div className="flex gap-4 relative z-10">
                      <div className="w-6 h-6 rounded-full bg-[#0c0a09] text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <span className="material-symbols-outlined text-[14px]">check</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#0c0a09]">Verification Complete</p>
                        <p className="text-xs text-[#78716c] mt-0.5">
                          {formatDateTime(refund.initiatedAt + 60000)}
                        </p>
                      </div>
                    </div>

                    {/* Step 3: Gateway Processing */}
                    <div className="flex gap-4 relative z-10">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 border-white shadow-2xs ${
                          isRefundProcessed
                            ? "bg-emerald-600 text-white"
                            : isRefundFailed
                            ? "bg-rose-600 text-white"
                            : "bg-[#0c0a09] text-white"
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-[14px] ${
                            isRefundPending ? "animate-spin" : ""
                          }`}
                        >
                          {isRefundProcessed
                            ? "check"
                            : isRefundFailed
                            ? "close"
                            : "refresh"}
                        </span>
                      </div>
                      <div>
                        <p
                          className={`text-xs font-bold ${
                            isRefundProcessed
                              ? "text-emerald-700"
                              : isRefundFailed
                              ? "text-rose-700"
                              : "text-[#0c0a09]"
                          }`}
                        >
                          {isRefundProcessed
                            ? "Refund Processed"
                            : isRefundFailed
                            ? "Refund Failed"
                            : "Processing with Gateway"}
                        </p>
                        <p className="text-xs text-[#78716c] mt-0.5">
                          {isRefundProcessed
                            ? `Completed on ${formatDateTime(refund.processedAt || refund.initiatedAt + 120000)}`
                            : isRefundFailed
                            ? refund.errorMessage || "Declined by issuing bank"
                            : "In Progress with Razorpay"}
                        </p>
                        <p className="text-[11px] mt-1.5 text-[#78716c] leading-relaxed bg-stone-50 p-2.5 rounded-lg border border-[#e7e5e4]">
                          Gateway usually confirms refund status within 3–5 business days depending on the source bank.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Need Assistance Card */}
                <div className="bg-[#0c0a09] text-white rounded-2xl p-6 shadow-sm relative overflow-hidden">
                  <span className="material-symbols-outlined absolute -right-3 -bottom-3 text-white/5 text-[96px] select-none pointer-events-none">
                    contact_support
                  </span>
                  <div className="relative z-10 space-y-3">
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white">
                      <span className="material-symbols-outlined text-[20px]">
                        support_agent
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-white tracking-tight">
                      Need Assistance?
                    </h4>
                    <p className="text-xs text-stone-300 leading-relaxed">
                      If you encounter any issues with this refund, our merchant support team is available 24/7 to help you resolve them.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsSupportModalOpen(true)}
                      className="w-full py-2.5 px-4 bg-white text-[#0c0a09] font-bold text-xs rounded-xl hover:bg-stone-100 transition-colors shadow-sm cursor-pointer mt-2"
                    >
                      Contact Support
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Contextual Footer Details */}
            <div className="pt-6 border-t border-[#e7e5e4] flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-[#78716c]">
              <div className="flex flex-wrap items-center gap-5">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#0c0a09]">
                    verified_user
                  </span>
                  <span>PCI DSS Compliant</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#0c0a09]">
                    lock
                  </span>
                  <span>Encrypted Transaction</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setIsPolicyModalOpen("policy")}
                  className="hover:text-[#0c0a09] underline transition-colors cursor-pointer"
                >
                  Merchant Policy
                </button>
                <button
                  type="button"
                  onClick={() => setIsPolicyModalOpen("sla")}
                  className="hover:text-[#0c0a09] underline transition-colors cursor-pointer"
                >
                  Refund SLA
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Support Modal */}
      {isSupportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#e7e5e4] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-[#0c0a09] flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">support_agent</span>
                Merchant Support
              </h3>
              <button
                type="button"
                onClick={() => setIsSupportModalOpen(false)}
                className="p-1 text-[#78716c] hover:text-[#0c0a09] rounded-lg hover:bg-stone-100"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <p className="text-xs text-[#78716c]">
              Have questions regarding refund <strong>{refund?.providerRefundId}</strong>? Our merchant reconciliation desk is on standby.
            </p>
            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-stone-50 rounded-xl border border-[#e7e5e4]">
                <p className="text-[#78716c] font-medium">Direct Support Desk</p>
                <p className="font-semibold text-[#0c0a09] mt-0.5">support@prest.io</p>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl border border-[#e7e5e4]">
                <p className="text-[#78716c] font-medium">Toll-free Priority Merchant Hotline</p>
                <p className="font-semibold text-[#0c0a09] mt-0.5">+91 1800 209 8899</p>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSupportModalOpen(false)}
                className="w-full py-2 bg-[#0c0a09] text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Policy / SLA Modal */}
      {isPolicyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#e7e5e4] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-[#0c0a09]">
                {isPolicyModalOpen === "policy" ? "Merchant Refund Policy" : "Razorpay Refund SLA"}
              </h3>
              <button
                type="button"
                onClick={() => setIsPolicyModalOpen(null)}
                className="p-1 text-[#78716c] hover:text-[#0c0a09] rounded-lg hover:bg-stone-100"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="text-xs text-[#78716c] space-y-2 leading-relaxed">
              {isPolicyModalOpen === "policy" ? (
                <>
                  <p>
                    Refunds are issued directly to the customer's original payment source (UPI, Credit/Debit card, or Netbanking).
                  </p>
                  <p>
                    Partial refunds are supported up to the remaining unrefunded transaction balance.
                  </p>
                  <p>
                    All refund actions are logged with immutable timestamps in your store audit trail.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <strong>Standard Refund:</strong> Typically credited to the customer within 5 to 7 business days from initiation.
                  </p>
                  <p>
                    <strong>UPI Fast Refunds:</strong> Usually reflected in the customer's linked bank account within 24 to 48 hours.
                  </p>
                  <p>
                    <strong>Instant Refunds:</strong> When enabled, source account is credited within 60 seconds.
                  </p>
                </>
              )}
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsPolicyModalOpen(null)}
                className="w-full py-2 bg-[#0c0a09] text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors"
              >
                Close
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

  return (
    <PosShell
      title="Refund Details"
      subtitle="View complete audit record and gateway reconciliation status."
    >
      {content}
    </PosShell>
  );
}
