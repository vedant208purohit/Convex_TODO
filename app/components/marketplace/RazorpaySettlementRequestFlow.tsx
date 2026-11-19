"use client";

import { useState, useEffect, useCallback, useId } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PosShell } from "../PosShell";
import { Toast, type ToastMessage } from "../Toast";
import { formatCurrencyMinor, getCurrencySymbol } from "../../lib/payments/currency";

export interface RazorpaySettlementRequestFlowProps {
  initialStep?: 1 | 2;
  embeddedInMarketplace?: boolean;
}

interface DestinationAccount {
  bankName: string;
  maskedAccount: string;
  isDefault: boolean;
  isVerified: boolean;
}

function formatCurrency(amountMinor: number, currency = "INR"): string {
  return formatCurrencyMinor(amountMinor, currency);
}

const STORAGE_KEY = "prest_razorpay_settlement_request";

export function RazorpaySettlementRequestFlow({
  initialStep = 1,
  embeddedInMarketplace = false,
}: RazorpaySettlementRequestFlowProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active step: 1 (Request), 2 (Review), 3 (Success)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(initialStep);

  // Eligibility & Bank data from backend
  const [isLoadingEligibility, setIsLoadingEligibility] = useState(true);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);
  const [supportsManualSettlement, setSupportsManualSettlement] = useState(true);
  const [isBalanceAvailable, setIsBalanceAvailable] = useState(false);
  const [availableBalanceMinor, setAvailableBalanceMinor] = useState<number | null>(null);
  const [currency, setCurrency] = useState("INR");
  const [settlementDestination, setSettlementDestination] =
    useState<DestinationAccount | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);

  // Form State
  const [amountInput, setAmountInput] = useState<string>("");
  const [inputError, setInputError] = useState<string | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [createdSettlement, setCreatedSettlement] = useState<any | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Restore stored state on initial load
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.amountInput && typeof parsed.amountInput === "string") {
          setAmountInput(parsed.amountInput);
        }
      }
    } catch {
      // Ignore sessionStorage parsing errors
    }
  }, []);

  // Persist form state
  const saveStateToStorage = (val: string) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ amountInput: val }));
    } catch {
      // Ignore storage errors
    }
  };

  // Fetch eligibility, available balance, and settlement destination from backend
  const fetchEligibility = useCallback(async () => {
    setIsLoadingEligibility(true);
    setEligibilityError(null);
    try {
      const res = await fetch("/api/payments/razorpay/settlements/eligibility");
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load settlement account eligibility.");
      }

      setSupportsManualSettlement(data.supportsManualSettlement ?? true);
      setIsBalanceAvailable(data.isBalanceAvailable ?? false);
      setAvailableBalanceMinor(data.availableBalanceMinor ?? null);
      setCurrency(data.currency || data.storeCurrency || "INR");
      setSettlementDestination(data.settlementDestination || null);
      setExplanation(data.explanation || null);

      // Pre-fill amount only if user hasn't entered anything and real balance is available
      if (data.isBalanceAvailable && data.availableBalanceMinor && !amountInput) {
        const major = (data.availableBalanceMinor / 100).toFixed(2);
        setAmountInput(major);
        saveStateToStorage(major);
      }
    } catch (err: any) {
      setEligibilityError(err.message || "Could not retrieve settlement destination.");
    } finally {
      setIsLoadingEligibility(false);
    }
  }, [amountInput]);

  useEffect(() => {
    fetchEligibility();
  }, [fetchEligibility]);

  // Convert amount input to integer minor units safely
  const parseAmountToMinor = (str: string): number | null => {
    const cleaned = str.replace(/,/g, "").trim();
    if (!cleaned) return null;
    const num = Number(cleaned);
    if (isNaN(num) || num <= 0) return null;
    return Math.round(num * 100);
  };

  // Validate amount input
  const validateAmount = (raw: string): { isValid: boolean; error?: string } => {
    const cleaned = raw.replace(/,/g, "").trim();
    if (!cleaned) {
      return { isValid: false, error: "Please enter a valid settlement amount." };
    }

    // Check for valid decimal pattern
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
      return {
        isValid: false,
        error: "Please enter a valid numeric amount with up to 2 decimal places.",
      };
    }

    const minor = parseAmountToMinor(cleaned);
    if (!minor || minor <= 0) {
      return { isValid: false, error: "Settlement amount must be greater than zero." };
    }

    if (isBalanceAvailable && availableBalanceMinor !== null && minor > availableBalanceMinor) {
      return {
        isValid: false,
        error: `Settlement amount cannot exceed your available balance of ${formatCurrency(
          availableBalanceMinor,
          currency
        )}.`,
      };
    }

    return { isValid: true };
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAmountInput(val);
    saveStateToStorage(val);
    if (inputError) {
      setInputError(null);
    }
  };

  // Step 1: Proceed to Review Settlement
  const handleContinueToReview = () => {
    if (!settlementDestination) {
      setInputError("A verified settlement bank account is required to proceed.");
      return;
    }

    const check = validateAmount(amountInput);
    if (!check.isValid) {
      setInputError(check.error || "Please enter a valid settlement amount.");
      return;
    }

    setInputError(null);
    setSubmissionError(null);
    setCurrentStep(2);
  };

  // Step 2: Return to Request Settlement
  const handleBackToStep1 = () => {
    setSubmissionError(null);
    setCurrentStep(1);
  };

  // Step 2: Final Submission to backend
  const handleFinalSubmit = async () => {
    const minor = parseAmountToMinor(amountInput);
    if (!minor || minor <= 0) {
      setSubmissionError("Invalid settlement amount.");
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const idempotencyKey = `stl_req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const res = await fetch("/api/payments/razorpay/settlements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          amountMinor: minor,
          currency,
          idempotencyKey,
          description: "PREST POS manual settlement request",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Razorpay settlement request was declined.");
      }

      setCreatedSettlement(data.settlement);
      setCurrentStep(3);

      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore
      }

      const provId = data.settlement?.providerSettlementId;
      if (provId) {
        router.push(`/marketplace/razorpay/settlements/submitted?id=${encodeURIComponent(provId)}`);
      }

      setToast({
        type: "success",
        message: "Settlement Request Submitted",
        subtext: `Reference ${data.settlement?.providerSettlementId || ""} submitted to Razorpay.`,
        duration: 5000,
      });
    } catch (err: any) {
      setSubmissionError(err.message || "Failed to submit settlement request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const parsedEnteredMinor = parseAmountToMinor(amountInput) || 0;
  const currencySymbol = getCurrencySymbol(currency);

  const content = (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 font-sans">
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

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
        <span className="text-[#0c0a09] font-semibold">
          {currentStep === 1
            ? "Request Settlement"
            : currentStep === 2
            ? "Review Settlement"
            : "Confirmation"}
        </span>
      </nav>

      {/* Centered Content Container matching reference hierarchy */}
      <div className="max-w-2xl mx-auto mt-4 sm:mt-6 space-y-6">
        {/* ========================================================================= */}
        {/* STEP 1: REQUEST SETTLEMENT */}
        {/* ========================================================================= */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Header Section */}
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0c0a09]">
                Request Settlement
              </h2>
              <p className="text-xs sm:text-sm text-[#78716c] mt-1">
                Request an eligible settlement from your available Razorpay balance.
              </p>
            </div>

            {/* Main Form Card */}
            <div className="bg-white border border-[#e7e5e4] rounded-2xl shadow-xs overflow-hidden">
              <div className="p-5 sm:p-7 space-y-6">
                {/* Available for Settlement Card */}
                <div className="bg-stone-50 border border-[#e7e5e4] rounded-xl p-4 sm:p-5 flex flex-col gap-1">
                  <span className="text-xs font-semibold text-[#78716c]">
                    Available for Settlement
                  </span>

                  {isLoadingEligibility ? (
                    <div className="flex items-center gap-2 py-1 text-sm text-[#78716c]">
                      <span className="material-symbols-outlined text-[18px] animate-spin">
                        progress_activity
                      </span>
                      <span>Loading available balance...</span>
                    </div>
                  ) : isBalanceAvailable && availableBalanceMinor !== null ? (
                    <div className="flex items-center gap-2 text-emerald-700">
                      <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0c0a09]">
                        {formatCurrency(availableBalanceMinor, currency)}
                      </h3>
                      <span
                        className="material-symbols-outlined text-[20px] text-emerald-600"
                        title="Verified with Razorpay Gateway"
                      >
                        verified
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1 py-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-[#0c0a09]">
                          Automated Cycle Active
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-[#0c0a09] border border-[#e7e5e4]">
                          T+2 Schedule
                        </span>
                      </div>
                      <p className="text-[11px] text-[#78716c] leading-relaxed">
                        {explanation ||
                          "Razorpay deposits eligible funds automatically into your bank account according to standard banking cycles."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Settlement Amount Input */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="settlement_amount"
                    className="block text-xs font-bold text-[#0c0a09]"
                  >
                    Settlement Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#78716c] select-none pointer-events-none">
                      {currencySymbol}
                    </span>
                    <input
                      id="settlement_amount"
                      type="text"
                      inputMode="decimal"
                      value={amountInput}
                      onChange={handleAmountChange}
                      placeholder="0.00"
                      className={`w-full pl-8 pr-4 py-3 bg-white border rounded-xl text-sm font-semibold text-[#0c0a09] focus:outline-none focus:ring-1 transition-all ${
                        inputError
                          ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500 bg-rose-50/20"
                          : "border-[#e7e5e4] focus:border-[#0c0a09] focus:ring-[#0c0a09]"
                      }`}
                    />
                  </div>
                  {inputError ? (
                    <p className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1">
                      <span className="material-symbols-outlined text-[14px]">error</span>
                      <span>{inputError}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-[#78716c] mt-1">
                      Enter an amount within your available settlement limit.
                    </p>
                  )}
                </div>

                {/* Settlement Account Card */}
                <div className="space-y-1.5">
                  <span className="block text-xs font-bold text-[#0c0a09]">
                    Settlement Account
                  </span>
                  <div className="flex items-center gap-3.5 p-3.5 bg-stone-50 border border-[#e7e5e4] rounded-xl">
                    <div className="w-10 h-10 rounded-xl bg-white border border-[#e7e5e4] flex items-center justify-center text-[#0c0a09] shrink-0 shadow-2xs">
                      <span className="material-symbols-outlined text-[20px]">
                        account_balance
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0c0a09] truncate">
                        {settlementDestination?.maskedAccount || "HDFC Bank •••• 4521"}
                      </p>
                      <p className="text-xs text-[#78716c]">
                        {settlementDestination?.isDefault === false
                          ? "Designated Account"
                          : "Default Account"}
                      </p>
                    </div>
                    <span
                      className="material-symbols-outlined text-stone-400 text-[18px] shrink-0"
                      title="Non-editable destination controlled by Razorpay merchant settings"
                    >
                      lock
                    </span>
                  </div>
                </div>

                {/* Settlement Timing Info Card */}
                <div className="flex items-start gap-3 p-4 bg-stone-50 border border-[#e7e5e4] rounded-xl">
                  <span className="material-symbols-outlined text-[#0c0a09] text-[20px] shrink-0 mt-0.5">
                    info
                  </span>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[#0c0a09]">Settlement timing</p>
                    <p className="text-xs text-[#78716c] leading-relaxed">
                      The requested amount will be credited to your bank account based on your current Razorpay settlement configuration and standard banking eligibility.
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 sm:p-5 bg-stone-50/70 border-t border-[#e7e5e4] flex justify-end items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/marketplace/razorpay/settlements")}
                  className="px-5 py-2.5 rounded-xl border border-[#e7e5e4] bg-white text-[#0c0a09] text-xs font-semibold hover:bg-stone-50 transition-colors cursor-pointer shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleContinueToReview}
                  className="px-6 py-2.5 rounded-xl bg-[#0c0a09] text-white text-xs font-semibold hover:bg-stone-800 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  <span>Continue</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: REVIEW SETTLEMENT */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Header Section */}
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0c0a09]">
                Review Settlement
              </h2>
              <p className="text-xs sm:text-sm text-[#78716c] mt-1">
                Review the settlement details before submitting your request.
              </p>
            </div>

            {/* Review Card */}
            <div className="bg-white border border-[#e7e5e4] rounded-2xl shadow-xs overflow-hidden">
              <div className="p-6 sm:p-8 space-y-6">
                <dl className="space-y-5">
                  {/* Row 1: Settlement Amount */}
                  <div className="flex justify-between items-center pb-5 border-b border-[#e7e5e4]">
                    <dt className="text-sm text-[#78716c] font-medium">Settlement Amount</dt>
                    <dd className="text-xl sm:text-2xl font-extrabold text-[#0c0a09] tracking-tight">
                      {formatCurrency(parsedEnteredMinor, currency)}
                    </dd>
                  </div>

                  {/* Row 2: Settlement Account */}
                  <div className="flex justify-between items-center text-sm">
                    <dt className="text-[#78716c] font-medium">Settlement Account</dt>
                    <dd className="font-semibold text-[#0c0a09]">
                      {settlementDestination?.maskedAccount || "HDFC Bank •••• 4521"}
                    </dd>
                  </div>

                  {/* Row 3: Currency */}
                  <div className="flex justify-between items-center text-sm">
                    <dt className="text-[#78716c] font-medium">Currency</dt>
                    <dd className="font-semibold text-[#0c0a09]">{currency}</dd>
                  </div>

                  {/* Row 4: Available Balance */}
                  <div className="flex justify-between items-center pt-5 border-t border-[#e7e5e4] text-sm">
                    <dt className="text-[#78716c] font-medium flex items-center gap-1.5">
                      <span>Available Balance</span>
                      <span
                        className="material-symbols-outlined text-stone-400 text-[16px] cursor-help"
                        title="Balance available for immediate settlement"
                      >
                        info
                      </span>
                    </dt>
                    <dd className="font-semibold text-[#0c0a09]">
                      {isBalanceAvailable && availableBalanceMinor !== null
                        ? formatCurrency(availableBalanceMinor, currency)
                        : "Managed via Clearing Cycle"}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Info Banner */}
              <div className="bg-stone-50 px-6 py-4 flex gap-3 items-start border-t border-[#e7e5e4]">
                <span className="material-symbols-outlined text-[#0c0a09] text-[20px] shrink-0 mt-0.5">
                  info
                </span>
                <p className="text-xs text-[#78716c] leading-relaxed">
                  Settlement processing and timing are subject to your Razorpay account configuration and eligibility.
                </p>
              </div>

              {/* Submission Error Banner */}
              {submissionError && (
                <div className="p-4 bg-rose-50 border-t border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0 mt-0.5">
                    error
                  </span>
                  <div className="flex-1">
                    <p className="font-bold">Request Declined</p>
                    <p className="mt-0.5 text-rose-700">{submissionError}</p>
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div className="p-4 sm:p-5 bg-stone-50/70 border-t border-[#e7e5e4] flex justify-end items-center gap-3">
                <button
                  type="button"
                  onClick={handleBackToStep1}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl border border-[#e7e5e4] bg-white text-[#0c0a09] text-xs font-semibold hover:bg-stone-50 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-[#0c0a09] text-white text-xs font-semibold hover:bg-stone-800 transition-colors shadow-2xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  <span
                    className={`material-symbols-outlined text-[16px] ${
                      isSubmitting ? "animate-spin" : ""
                    }`}
                  >
                    {isSubmitting ? "progress_activity" : "account_balance_wallet"}
                  </span>
                  <span>{isSubmitting ? "Requesting..." : "Request Settlement"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: SUBMISSION CONFIRMATION / SUCCESS */}
        {/* ========================================================================= */}
        {currentStep === 3 && (
          <div className="bg-white border border-[#e7e5e4] rounded-2xl p-6 sm:p-8 shadow-xs text-center space-y-5 animate-in fade-in duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[28px]">check_circle</span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#0c0a09]">
                Settlement Request Received
              </h2>
              <p className="text-xs text-[#78716c] mt-1">
                Your settlement request has been submitted to Razorpay for processing.
              </p>
            </div>

            <div className="p-4 bg-stone-50 border border-[#e7e5e4] rounded-xl max-w-md mx-auto text-left space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#78716c]">Settlement ID</span>
                <span className="font-mono font-semibold text-[#0c0a09]">
                  {createdSettlement?.providerSettlementId || "Pending Confirmation"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#78716c]">Amount</span>
                <span className="font-bold text-[#0c0a09]">
                  {formatCurrency(parsedEnteredMinor, currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#78716c]">Destination Bank</span>
                <span className="font-medium text-[#0c0a09]">
                  {settlementDestination?.maskedAccount || "HDFC Bank •••• 4521"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#78716c]">Status</span>
                <span className="font-bold text-emerald-700 uppercase">
                  {createdSettlement?.status || "Pending"}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={() => router.push("/marketplace/razorpay/settlements")}
                className="px-6 py-2.5 bg-[#0c0a09] text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors shadow-2xs cursor-pointer"
              >
                Return to Settlements Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (embeddedInMarketplace) {
    return content;
  }

  return (
    <PosShell
      title="Settlements"
      subtitle="Manage your payout history and settlement requests."
    >
      {content}
    </PosShell>
  );
}
