"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PosShell } from "../PosShell";
import { useMarketplaceRazorpay, PaymentMethodType } from "./useMarketplaceRazorpay";

export function MarketplaceAddMoneyView() {
  const router = useRouter();
  const { openCheckout } = useMarketplaceRazorpay();

  // 1. Live Convex Queries & Mutations
  const wallet = useQuery(api.marketplace.getWallet, {});
  const recordPendingTopupMutation = useMutation(api.marketplace.recordPendingRazorpayTopup);
  const confirmRazorpayTopupMutation = useMutation(api.marketplace.confirmRazorpayTopup);

  const BASE_BALANCE = wallet?.balance ?? 14500;
  const storeName = wallet?.storeName ?? "The Grand Bistro HQ";

  const [amount, setAmount] = useState<number>(2000);
  const [inputValue, setInputValue] = useState<string>("2,000");
  const [activeStep, setActiveStep] = useState<number>(1); // 1: Amount, 2: Payment Method, 3: Review & Pay
  const [selectedMethod, setSelectedMethod] = useState<string>("upi");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const quickChips = [500, 1000, 2000, 5000, 10000, 25000];

  const formatINR = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(val);
  };

  const handleChipClick = (val: number) => {
    setAmount(val);
    setInputValue(new Intl.NumberFormat("en-IN").format(val));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/[^0-9]/g, "");
    const num = parseInt(clean, 10);
    if (!isNaN(num)) {
      setAmount(num);
      setInputValue(new Intl.NumberFormat("en-IN").format(num));
    } else {
      setAmount(0);
      setInputValue("");
    }
  };

  const isAmountValid = amount >= 500 && amount <= 100000;
  const projectedBalance = BASE_BALANCE + (isAmountValid ? amount : 0);

  const handleAuthorizePayment = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);

        // 1. Create Order via server route
        const createOrderRes = await fetch("/api/marketplace/razorpay/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            paymentMethod: selectedMethod,
            organizationName: storeName,
          }),
        });

  const orderData = await createOrderRes.json().catch(() => ({}));
  if (!createOrderRes.ok || !orderData.success) {
    throw new Error(orderData.error || "Failed to initialize payment gateway order.");
  }

  // 2. Record pending transaction in Convex ledger
  try {
    await recordPendingTopupMutation({
      amount,
      paymentMethod: selectedMethod,
      razorpayOrderId: orderData.orderId,
    });
  } catch (ledgerErr) {
    console.warn("[Marketplace Add Money] Non-blocking pending ledger note:", ledgerErr);
  }

  // 3. Open Razorpay modal with strict instrument restriction
  await openCheckout({
    keyId: orderData.keyId,
    amount: orderData.amount,
    orderId: orderData.orderId,
    isRemoteOrder: orderData.isRemoteOrder,
    storeName,
    selectedMethod: selectedMethod as PaymentMethodType,
    onSuccess: async (paymentResponse) => {
      try {
        // 4. Verify cryptographic signature on server
        const verifyRes = await fetch("/api/marketplace/razorpay/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpayOrderId: paymentResponse.razorpay_order_id || orderData.orderId,
            razorpayPaymentId: paymentResponse.razorpay_payment_id,
            razorpaySignature: paymentResponse.razorpay_signature,
            amount,
            paymentMethod: selectedMethod,
          }),
        });

        const verifyData = await verifyRes.json().catch(() => ({}));
        if (!verifyRes.ok || !verifyData.success) {
          throw new Error(verifyData.error || "Payment signature verification failed.");
        }

        // 5. Atomically credit organization wallet in Convex
        await confirmRazorpayTopupMutation({
          razorpayOrderId: paymentResponse.razorpay_order_id || orderData.orderId,
          razorpayPaymentId: paymentResponse.razorpay_payment_id,
          razorpaySignature: paymentResponse.razorpay_signature,
          amount,
          paymentMethod: selectedMethod,
        });

        setIsProcessing(false);
        setIsSuccess(true);
        setTimeout(() => {
          router.push("/marketplace/wallet");
        }, 1500);
      } catch (verifyErr: unknown) {
        setIsProcessing(false);
        const msg = verifyErr instanceof Error ? verifyErr.message : "Payment verification failed.";
        setErrorMessage(msg);
      }
    },
    onFailure: (err) => {
      setIsProcessing(false);
      const msg =
        err?.description ||
        err?.message ||
        "Payment authorization was declined or encountered an error.";
      setErrorMessage(msg);
    },
    onDismiss: () => {
      setIsProcessing(false);
    },
  });
} catch (err: unknown) {
  setIsProcessing(false);
  const msg = err instanceof Error ? err.message : "Failed to authorize deposit.";
  setErrorMessage(msg);
}
  };

return (
  <PosShell title="Marketplace" subtitle="Wallet">
    <div className="p-3.5 sm:p-5 md:p-6 lg:p-8 flex flex-col gap-4 sm:gap-6 w-full bg-[#faf8f5] min-h-full max-w-[1920px] mx-auto">
      {/* Top Bar: Breadcrumb (Left) + Stepper (Right) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 max-w-6xl mx-auto w-full">
        {/* Breadcrumb Bar */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-[#5e5e5e] font-medium flex-wrap">
          <Link href="/marketplace" className="hover:text-[#0c0a09] transition-colors">
            Marketplace
          </Link>
          <span className="material-symbols-outlined text-[13px] sm:text-[14px]">chevron_right</span>
          <Link href="/marketplace/wallet" className="hover:text-[#0c0a09] transition-colors">
            Wallet
          </Link>
          <span className="material-symbols-outlined text-[13px] sm:text-[14px]">chevron_right</span>
          <span className="text-[#0c0a09] font-bold">Add Money</span>
        </div>

        {/* Stepper Pill */}
        <div className="flex items-center justify-between sm:justify-start gap-1.5 xs:gap-2.5 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2 bg-white rounded-full border border-[#e7e5e4] shadow-2xs overflow-x-auto scrollbar-none w-full sm:w-auto">
          {/* Step 1: Amount */}
          <button
            type="button"
            onClick={() => setActiveStep(1)}
            className="flex items-center gap-1.5 sm:gap-2 cursor-pointer group shrink-0"
          >
            <div
              className={`w-4 h-4 xs:w-5 xs:h-5 rounded-full flex items-center justify-center text-[9px] xs:text-[10px] font-bold shrink-0 transition-all ${activeStep === 1
                ? "bg-[#0c0a09] text-white"
                : activeStep > 1
                  ? "bg-emerald-600 text-white"
                  : "bg-[#fdf8f7] border border-[#e7e5e4] text-[#5e5e5e]"
                }`}
            >
              {activeStep > 1 ? (
                <span className="material-symbols-outlined text-[11px] xs:text-[12px]">check</span>
              ) : (
                "1"
              )}
            </div>
            <span
              className={`text-[11px] sm:text-xs transition-colors ${activeStep === 1
                ? "font-bold text-[#0c0a09]"
                : "font-medium text-[#5e5e5e] group-hover:text-[#0c0a09]"
                }`}
            >
              Amount
            </span>
          </button>

          {/* Line Divider */}
          <div
            className={`h-[1px] w-3 xs:w-6 sm:w-8 shrink-0 rounded-full transition-colors ${activeStep > 1 ? "bg-emerald-500" : "bg-[#e7e5e4]"
              }`}
          />

          {/* Step 2: Payment */}
          <button
            type="button"
            disabled={!isAmountValid}
            onClick={() => isAmountValid && setActiveStep(2)}
            className="flex items-center gap-1.5 sm:gap-2 cursor-pointer group disabled:cursor-not-allowed shrink-0"
          >
            <div
              className={`w-4 h-4 xs:w-5 xs:h-5 rounded-full flex items-center justify-center text-[9px] xs:text-[10px] font-bold shrink-0 transition-all ${activeStep === 2
                ? "bg-[#0c0a09] text-white"
                : activeStep > 2
                  ? "bg-emerald-600 text-white"
                  : "bg-[#fdf8f7] border border-[#e7e5e4] text-[#5e5e5e]"
                }`}
            >
              {activeStep > 2 ? (
                <span className="material-symbols-outlined text-[11px] xs:text-[12px]">check</span>
              ) : (
                "2"
              )}
            </div>
            <span
              className={`text-[11px] sm:text-xs whitespace-nowrap transition-colors ${activeStep === 2
                ? "font-bold text-[#0c0a09]"
                : "font-medium text-[#5e5e5e] group-hover:text-[#0c0a09]"
                }`}
            >
              Payment
            </span>
          </button>

          {/* Line Divider */}
          <div
            className={`h-[1px] w-3 xs:w-6 sm:w-8 shrink-0 rounded-full transition-colors ${activeStep > 2 ? "bg-emerald-500" : "bg-[#e7e5e4]"
              }`}
          />

          {/* Step 3: Review */}
          <button
            type="button"
            disabled={!isAmountValid}
            onClick={() => isAmountValid && setActiveStep(3)}
            className="flex items-center gap-1.5 sm:gap-2 cursor-pointer group disabled:cursor-not-allowed shrink-0"
          >
            <div
              className={`w-4 h-4 xs:w-5 xs:h-5 rounded-full flex items-center justify-center text-[9px] xs:text-[10px] font-bold shrink-0 transition-all ${activeStep === 3
                ? "bg-[#0c0a09] text-white"
                : "bg-[#fdf8f7] border border-[#e7e5e4] text-[#5e5e5e]"
                }`}
            >
              3
            </div>
            <span
              className={`text-[11px] sm:text-xs whitespace-nowrap transition-colors ${activeStep === 3
                ? "font-bold text-[#0c0a09]"
                : "font-medium text-[#5e5e5e] group-hover:text-[#0c0a09]"
                }`}
            >
              Review
            </span>
          </button>
        </div>
      </div>

      {/* 2-Column Side-by-Side Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 lg:gap-8 items-stretch w-full max-w-6xl mx-auto">
        {/* LEFT CARD (5 cols): Visual, Header, Available Balance & Escrow Note */}
        <div className="lg:col-span-5 bg-[#faf8f5] rounded-2xl sm:rounded-[28px] p-4 sm:p-6 md:p-7 lg:p-8 border border-[#e7e5e4] flex flex-col justify-between shadow-2xs">
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-[#FAF0E2] border border-[#E8D4B8] text-[#9A6218] text-[10px] sm:text-[11px] font-bold uppercase tracking-wider w-fit mb-3 sm:mb-4">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#D97706] animate-pulse" />
              <span>Instant Escrow Funding</span>
            </div>

            {/* Title & Subtitle */}
            <h1 className="font-garamond text-2xl xs:text-3xl sm:text-[34px] lg:text-[38px] text-[#0c0a09] font-normal leading-[1.15] mb-2 sm:mb-2.5">
              {activeStep === 1
                ? "Add Money to Your Wallet"
                : activeStep === 2
                  ? "Select Payment Instrument"
                  : "Authorize Escrow Deposit"}
            </h1>
            <p className="text-[#5e5e5e] text-xs sm:text-[13px] leading-relaxed mb-3 sm:mb-4">
              {activeStep === 1
                ? "Choose an amount to fund your PREST Marketplace purchases and recurring subscriptions with zero surcharge."
                : activeStep === 2
                  ? "Zero convenience fee. Funds will be deposited directly to your Escrow ledger."
                  : `Confirm instant credit of ₹${formatINR(amount)} into your PREST Billing Wallet.`}
            </p>

            {/* 3D PREST Wallet Vector Illustration */}
            <div className="py-2 flex items-center justify-center my-2 sm:my-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="PREST Wallet"
                className="w-36 xs:w-44 sm:w-52 md:w-56 h-auto drop-shadow-md transition-transform duration-300 hover:scale-105"
                src="/images/prest-wallet.svg"
              />
            </div>
          </div>

          <div className="pt-3">
            {/* Available Balance Box */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-[#e7e5e4] shadow-2xs flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#5e5e5e]">
                AVAILABLE WALLET BALANCE
              </span>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="font-garamond text-2xl xs:text-3xl sm:text-[34px] font-bold text-[#0c0a09] leading-tight">
                  ₹{formatINR(BASE_BALANCE)}
                </span>
                <span className="text-[11px] font-bold text-[#5e5e5e] uppercase tracking-wider">
                  INR
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-[#16834A] font-semibold pt-1">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#16834A] shrink-0" />
                <span>Active &amp; Ready for Instant Surcharge-free Payments</span>
              </div>
            </div>

            {/* Escrow Regulatory Note */}
            <div className="flex items-start gap-2 text-[#5e5e5e] text-[10.5px] sm:text-[11px] leading-relaxed pt-3 sm:pt-4">
              <span className="material-symbols-outlined text-[16px] sm:text-[18px] text-stone-400 shrink-0 mt-0.5">
                verified_user
              </span>
              <span>
                Funds are held in an authorized escrow ledger dedicated to PREST Marketplace operations. RBI compliant &amp; 256-bit encrypted.
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT CARD (7 cols): Amount Input, Chips, Ledger Preview & CTA */}
        <div className="lg:col-span-7 bg-[#faf8f5] rounded-2xl sm:rounded-[28px] p-4 sm:p-6 md:p-7 lg:p-8 border border-[#e7e5e4] shadow-sm flex flex-col justify-between gap-5 sm:gap-6">
          {/* STEP 1: AMOUNT SELECTION */}
          {activeStep === 1 && (
            <>
              <div className="flex flex-col gap-3 sm:gap-4">
                {/* Header Row */}
                <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1.5">
                  <label
                    htmlFor="amount-input"
                    className="text-[10px] sm:text-[11px] font-bold tracking-wider text-[#5e5e5e] uppercase"
                  >
                    ENTER AMOUNT TO ADD
                  </label>
                  <span className="text-[10px] font-bold tracking-wide uppercase px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-md bg-[#fdf8f7] text-[#0c0a09] border border-[#e7e5e4] w-fit">
                    Tax Exempt Transfer
                  </span>
                </div>

                {/* Editable Big Amount Box */}
                <div className="bg-white rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 border border-[#e7e5e4] shadow-2xs flex items-center justify-between focus-within:ring-2 focus-within:ring-[#0c0a09] transition-all">
                  <div className="flex items-center flex-1 min-w-0">
                    <span className="font-garamond text-2xl xs:text-3xl sm:text-[40px] text-[#0c0a09] font-medium select-none mr-2 leading-none shrink-0">
                      ₹
                    </span>
                    <input
                      id="amount-input"
                      type="text"
                      value={inputValue}
                      onChange={handleInputChange}
                      placeholder="0"
                      style={{ backgroundColor: "transparent" }}
                      className="w-full !bg-transparent text-2xl xs:text-3xl sm:text-[40px] font-medium text-[#0c0a09] tracking-tight focus:outline-none placeholder:text-stone-400 font-garamond border-none p-0 focus:ring-0 leading-none min-w-0"
                    />
                  </div>
                  <div className="flex items-center ml-2 shrink-0">
                    <span className="text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 rounded-md bg-[#fdf8f7] text-[#0c0a09] border border-[#e7e5e4] tracking-wider uppercase">
                      INR
                    </span>
                  </div>
                </div>

                {/* Quick Allocation Chips */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2 pt-0.5">
                  {quickChips.map((chipVal) => {
                    const isChipActive = amount === chipVal;
                    return (
                      <button
                        key={chipVal}
                        type="button"
                        onClick={() => handleChipClick(chipVal)}
                        className={`py-1.5 sm:py-2 px-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all text-center cursor-pointer border ${isChipActive
                          ? "bg-[#0c0a09] text-white border-[#0c0a09] shadow-xs"
                          : "bg-white border-[#e7e5e4] text-[#0c0a09] hover:bg-[#f1edec]"
                          }`}
                      >
                        ₹{new Intl.NumberFormat("en-IN").format(chipVal)}
                      </button>
                    );
                  })}
                </div>

                {/* Helper Limits & Surcharge Copy */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10.5px] sm:text-xs pt-0.5">
                  <span className="flex items-center gap-1.5 text-[#5e5e5e]">
                    <span className="material-symbols-outlined text-[14px] sm:text-[15px] text-stone-400 shrink-0">
                      info
                    </span>
                    <span>Configured limits: Min ₹500 • Max ₹1,00,000</span>
                  </span>
                  <span className="font-bold text-[#0c0a09]">
                    Zero convenience surcharge
                  </span>
                </div>
              </div>

              {/* Ledger Estimate Preview Box */}
              <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-[#e7e5e4] flex flex-col gap-2.5 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-[#5e5e5e]">
                  <span className="uppercase tracking-wider font-bold text-[10px] sm:text-[11px]">
                    LEDGER ESTIMATE PREVIEW
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-stone-400">Real-time update</span>
                </div>

                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs sm:text-[13px] text-[#5e5e5e]">
                    <span>Current Balance:</span>
                    <span className="font-mono font-medium text-[#0c0a09] tabular-nums">
                      ₹{formatINR(BASE_BALANCE)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs sm:text-[13px] text-[#5e5e5e]">
                    <span className="flex items-center gap-1.5">
                      Amount being added:
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D9911E]" />
                    </span>
                    <span className="font-mono font-bold text-[#0c0a09] tabular-nums">
                      +₹{formatINR(amount)}
                    </span>
                  </div>

                  <div className="h-px bg-[#e7e5e4] my-0.5 sm:my-1" />

                  <div className="flex items-baseline justify-between pt-0.5 flex-wrap gap-1">
                    <span className="text-xs sm:text-[13px] font-bold text-[#0c0a09]">
                      Projected New Balance:
                    </span>
                    <span className="font-mono text-lg sm:text-xl font-bold tabular-nums px-3 sm:px-4 py-1 sm:py-1.5 rounded-xl bg-[#FFF9ED] border border-[#E2B870] text-[#9A6218] shadow-2xs">
                      ₹{formatINR(projectedBalance)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons & Navigation */}
              <div className="flex flex-col items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={!isAmountValid}
                  onClick={() => setActiveStep(2)}
                  className="w-full flex items-center justify-center gap-2 bg-[#0c0a09] hover:bg-[#262626] text-white px-5 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold text-xs sm:text-sm md:text-base shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span>Continue to Payment Method</span>
                  <span className="material-symbols-outlined text-[16px] sm:text-[18px]">arrow_forward</span>
                </button>
              </div>
            </>
          )}

          {/* STEP 2: PAYMENT METHOD SELECTION */}
          {activeStep === 2 && (
            <div className="flex flex-col gap-4 sm:gap-5">
              <span className="text-[10px] sm:text-[11px] tracking-wider font-bold text-[#5e5e5e] uppercase">
                Select Deposit Method
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                {[
                  { id: "upi", label: "Instant UPI", sub: "GPay, PhonePe, Paytm", icon: "qr_code_2" },
                  { id: "netbanking", label: "Net Banking", sub: "HDFC, ICICI, SBI, Axis", icon: "account_balance" },
                  { id: "card", label: "Corporate Card", sub: "Visa, Mastercard, RuPay", icon: "credit_card" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMethod(m.id)}
                    className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${selectedMethod === m.id
                      ? "bg-white border-[#0c0a09] shadow-sm ring-1 ring-[#0c0a09]"
                      : "bg-white/60 border-[#e7e5e4] hover:bg-white"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="material-symbols-outlined text-[20px] sm:text-[24px] text-[#0c0a09]">
                        {m.icon}
                      </span>
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedMethod === m.id
                          ? "border-[#0c0a09] bg-[#0c0a09] text-white"
                          : "border-stone-300"
                          }`}
                      >
                        {selectedMethod === m.id && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#0c0a09]">{m.label}</p>
                      <p className="text-[10.5px] sm:text-[11px] text-[#5e5e5e]">{m.sub}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="p-3.5 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-[#e7e5e4] flex items-center justify-between text-xs">
                <span className="text-[#5e5e5e]">Deposit Amount:</span>
                <span className="font-mono font-bold text-sm sm:text-base text-[#0c0a09]">
                  ₹{formatINR(amount)}
                </span>
              </div>

              <div className="flex flex-col items-center gap-2.5 sm:gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  className="w-full flex items-center justify-center gap-2 bg-[#0c0a09] hover:bg-[#262626] text-white px-5 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold text-xs sm:text-sm md:text-base shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  <span>Proceed to Review</span>
                  <span className="material-symbols-outlined text-[16px] sm:text-[18px]">arrow_forward</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep(1)}
                  className="text-xs text-[#5e5e5e] hover:text-[#0c0a09] py-1 transition-colors text-center cursor-pointer"
                >
                  ← Back to Amount Selection
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW & AUTHORIZE */}
          {activeStep === 3 && (
            <div className="flex flex-col gap-4 sm:gap-5">
              <div className="p-4 sm:p-5 bg-white rounded-xl sm:rounded-2xl border border-[#e7e5e4] flex flex-col gap-2.5 sm:gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5e5e5e]">
                  Deposit Summary
                </span>
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="text-[#5e5e5e] shrink-0">Destination:</span>
                  <span className="font-semibold text-[#0c0a09] text-right truncate">{storeName} Escrow Wallet</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#5e5e5e]">Method:</span>
                  <span className="font-semibold text-[#0c0a09] uppercase">{selectedMethod}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#5e5e5e]">Surcharge:</span>
                  <span className="font-semibold text-emerald-600">₹0.00 (Free)</span>
                </div>
                <div className="h-px bg-[#e7e5e4] my-1" />
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-bold text-[#0c0a09]">Total Net Debit:</span>
                  <span className="font-mono font-bold text-lg sm:text-xl text-[#0c0a09]">₹{formatINR(amount)}</span>
                </div>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-600 text-[18px] shrink-0">
                    error
                  </span>
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="flex flex-col items-center gap-2.5 sm:gap-3 pt-1">
                <button
                  type="button"
                  disabled={isProcessing || isSuccess}
                  onClick={handleAuthorizePayment}
                  className="w-full py-3.5 sm:py-4 px-5 sm:px-8 rounded-lg bg-[#0c0a09] hover:bg-[#262626] text-white font-semibold text-xs sm:text-sm md:text-base flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-80 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  {isProcessing ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[18px]">
                        progress_activity
                      </span>
                      <span>Securing Escrow Deposit...</span>
                    </>
                  ) : isSuccess ? (
                    <>
                      <span className="material-symbols-outlined text-emerald-400 text-[18px] sm:text-[20px]">
                        check_circle
                      </span>
                      <span>Deposit Successful! Redirecting...</span>
                    </>
                  ) : (
                    <>
                      <span>Authorize Deposit of ₹{formatINR(amount)}</span>
                      <span className="material-symbols-outlined text-[16px] sm:text-[18px]">lock</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className="text-xs text-[#5e5e5e] hover:text-[#0c0a09] py-1 transition-colors text-center cursor-pointer"
                >
                  ← Back to Payment Methods
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </PosShell>
);
}
