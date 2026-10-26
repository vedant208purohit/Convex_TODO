"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PosShell } from "../PosShell";

export function MarketplaceAddMoneyView() {
  const router = useRouter();

  const BASE_BALANCE = 14500;
  const [amount, setAmount] = useState<number>(2000);
  const [inputValue, setInputValue] = useState<string>("2,000");
  const [activeStep, setActiveStep] = useState<number>(1); // 1: Amount, 2: Payment Method, 3: Review & Pay
  const [selectedMethod, setSelectedMethod] = useState<string>("upi");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

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

  const handleAuthorizePayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/marketplace/wallet");
      }, 1800);
    }, 1500);
  };

  return (
    <PosShell title="Marketplace" subtitle="Wallet">
      <div className="p-6 lg:p-8 flex flex-col gap-6 w-full bg-[#FAF7F2] min-h-full">
        {/* Top Bar: Breadcrumb (Left) + Stepper (Right) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-6xl mx-auto w-full">
          {/* Breadcrumb Bar */}
          <div className="flex items-center gap-2 text-xs text-stone-500 font-medium">
            <Link href="/marketplace" className="hover:text-stone-900 transition-colors">
              Marketplace
            </Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <Link href="/marketplace/wallet" className="hover:text-stone-900 transition-colors">
              Wallet
            </Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-stone-900 font-bold">Add Money</span>
          </div>

          {/* Stepper Pill */}
          <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-full border border-stone-200/90 shadow-2xs">
            {/* Step 1: Amount */}
            <button
              type="button"
              onClick={() => setActiveStep(1)}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all ${
                  activeStep === 1
                    ? "bg-[#141010] text-white"
                    : activeStep > 1
                    ? "bg-emerald-600 text-white"
                    : "bg-stone-100 border border-stone-300 text-stone-500"
                }`}
              >
                {activeStep > 1 ? (
                  <span className="material-symbols-outlined text-[12px]">check</span>
                ) : (
                  "1"
                )}
              </div>
              <span
                className={`text-xs transition-colors ${
                  activeStep === 1
                    ? "font-bold text-stone-900"
                    : "font-medium text-stone-500 group-hover:text-stone-900"
                }`}
              >
                Amount
              </span>
            </button>

            {/* Line Divider */}
            <div
              className={`h-[1px] w-8 rounded-full transition-colors ${
                activeStep > 1 ? "bg-emerald-500" : "bg-stone-300"
              }`}
            />

            {/* Step 2: Payment */}
            <button
              type="button"
              disabled={!isAmountValid}
              onClick={() => isAmountValid && setActiveStep(2)}
              className="flex items-center gap-2 cursor-pointer group disabled:cursor-not-allowed"
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all ${
                  activeStep === 2
                    ? "bg-[#141010] text-white"
                    : activeStep > 2
                    ? "bg-emerald-600 text-white"
                    : "bg-stone-100 border border-stone-300 text-stone-500"
                }`}
              >
                {activeStep > 2 ? (
                  <span className="material-symbols-outlined text-[12px]">check</span>
                ) : (
                  "2"
                )}
              </div>
              <span
                className={`text-xs whitespace-nowrap transition-colors ${
                  activeStep === 2
                    ? "font-bold text-stone-900"
                    : "font-medium text-stone-500 group-hover:text-stone-900"
                }`}
              >
                Payment
              </span>
            </button>

            {/* Line Divider */}
            <div
              className={`h-[1px] w-8 rounded-full transition-colors ${
                activeStep > 2 ? "bg-emerald-500" : "bg-stone-300"
              }`}
            />

            {/* Step 3: Review */}
            <button
              type="button"
              disabled={!isAmountValid}
              onClick={() => isAmountValid && setActiveStep(3)}
              className="flex items-center gap-2 cursor-pointer group disabled:cursor-not-allowed"
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all ${
                  activeStep === 3
                    ? "bg-[#141010] text-white"
                    : "bg-stone-100 border border-stone-300 text-stone-500"
                }`}
              >
                3
              </div>
              <span
                className={`text-xs whitespace-nowrap transition-colors ${
                  activeStep === 3
                    ? "font-bold text-stone-900"
                    : "font-medium text-stone-500 group-hover:text-stone-900"
                }`}
              >
                Review
              </span>
            </button>
          </div>
        </div>

        {/* 2-Column Side-by-Side Main Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch w-full max-w-6xl mx-auto">
          {/* LEFT CARD (5 cols): Visual, Header, Available Balance & Escrow Note */}
          <div className="lg:col-span-5 bg-[#FAF6F0] rounded-[28px] p-7 sm:p-8 border border-[#E8E2D8] flex flex-col justify-between shadow-2xs">
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FAF0E2] border border-[#E8D4B8] text-[#9A6218] text-[11px] font-bold uppercase tracking-wider w-fit mb-4">
                <span className="w-2 h-2 rounded-full bg-[#D97706] animate-pulse" />
                <span>Instant Escrow Funding</span>
              </div>

              {/* Title & Subtitle */}
              <h1 className="font-garamond text-3xl sm:text-[38px] text-[#181818] font-normal leading-[1.15] mb-2.5">
                {activeStep === 1
                  ? "Add Money to Your Wallet"
                  : activeStep === 2
                  ? "Select Payment Instrument"
                  : "Authorize Escrow Deposit"}
              </h1>
              <p className="text-stone-600 text-xs sm:text-[13px] leading-relaxed mb-4">
                {activeStep === 1
                  ? "Choose an amount to fund your PREST Marketplace purchases and recurring subscriptions with zero surcharge."
                  : activeStep === 2
                  ? "Zero convenience fee. Funds will be deposited directly to your Escrow ledger."
                  : `Confirm instant credit of ₹${formatINR(amount)} into your PREST Billing Wallet.`}
              </p>

              {/* 3D PREST Wallet Vector Illustration */}
              <div className="py-2 flex items-center justify-center my-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="PREST Wallet"
                  className="w-48 sm:w-56 h-auto drop-shadow-md transition-transform duration-300 hover:scale-105"
                  src="/images/prest-wallet.svg"
                />
              </div>
            </div>

            <div>
              {/* Available Balance Box */}
              <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-2xs flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-stone-500">
                  AVAILABLE WALLET BALANCE
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-garamond text-3xl sm:text-[34px] font-bold text-stone-900 leading-tight">
                    ₹{formatINR(BASE_BALANCE)}
                  </span>
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    INR
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#16834A] font-semibold pt-1">
                  <span className="w-2 h-2 rounded-full bg-[#16834A] shrink-0" />
                  <span>Active &amp; Ready for Instant Surcharge-free Payments</span>
                </div>
              </div>

              {/* Escrow Regulatory Note */}
              <div className="flex items-start gap-2.5 text-stone-600 text-[11px] leading-relaxed pt-5 mt-1">
                <span className="material-symbols-outlined text-[18px] text-stone-400 shrink-0 mt-0.5">
                  verified_user
                </span>
                <span>
                  Funds are held in an authorized escrow ledger dedicated to PREST Marketplace operations. RBI compliant &amp; 256-bit encrypted.
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT CARD (7 cols): Amount Input, Chips, Ledger Preview & CTA */}
          <div className="lg:col-span-7 bg-[#FAF8F5] rounded-[28px] p-7 sm:p-8 border border-[#E8E2D8] shadow-sm flex flex-col justify-between gap-6">
            {/* STEP 1: AMOUNT SELECTION */}
            {activeStep === 1 && (
              <>
                <div className="flex flex-col gap-4">
                  {/* Header Row */}
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="amount-input"
                      className="text-[11px] font-bold tracking-wider text-stone-600 uppercase"
                    >
                      ENTER AMOUNT TO ADD
                    </label>
                    <span className="text-[10px] font-bold tracking-wide uppercase px-3 py-1 rounded-md bg-[#EDE6DF] text-stone-700">
                      Tax Exempt Transfer
                    </span>
                  </div>

                  {/* Editable Big Amount Box */}
                  <div className="bg-[#FFF9F6] rounded-2xl px-6 py-4 border border-[#E8E2D8] shadow-2xs flex items-center justify-between focus-within:ring-2 focus-within:ring-stone-900 focus-within:bg-white transition-all">
                    <div className="flex items-center flex-1">
                      <span className="font-garamond text-3xl sm:text-[40px] text-stone-900 font-medium select-none mr-2 leading-none">
                        ₹
                      </span>
                      <input
                        id="amount-input"
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        placeholder="0"
                        className="w-full bg-transparent text-3xl sm:text-[40px] font-medium text-stone-900 tracking-tight focus:outline-none placeholder:text-stone-400 font-garamond border-none p-0 focus:ring-0 leading-none"
                      />
                    </div>
                    <div className="flex items-center ml-2">
                      <span className="text-xs font-bold px-3 py-1 rounded-md bg-[#EDE6DF] text-stone-800 tracking-wider uppercase">
                        INR
                      </span>
                    </div>
                  </div>

                  {/* Quick Allocation Chips */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
                    {quickChips.map((chipVal) => {
                      const isChipActive = amount === chipVal;
                      return (
                        <button
                          key={chipVal}
                          type="button"
                          onClick={() => handleChipClick(chipVal)}
                          className={`py-2 px-1 rounded-full text-xs font-bold transition-all text-center cursor-pointer border ${
                            isChipActive
                              ? "bg-[#141010] text-white border-[#141010] shadow-xs"
                              : "bg-white border-[#E8E2D8] text-stone-800 hover:bg-[#F3ECEA] hover:border-[#D0C4BE]"
                          }`}
                        >
                          ₹{new Intl.NumberFormat("en-IN").format(chipVal)}
                        </button>
                      );
                    })}
                  </div>

                  {/* Helper Limits & Surcharge Copy */}
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <span className="flex items-center gap-1.5 text-[11px] text-stone-600">
                      <span className="material-symbols-outlined text-[15px] text-stone-400">
                        info
                      </span>
                      Configured limits: Min ₹500 • Max ₹1,00,000 per transaction
                    </span>
                    <span className="font-bold text-stone-900 text-[11px]">
                      Zero convenience surcharge
                    </span>
                  </div>
                </div>

                {/* Ledger Estimate Preview Box */}
                <div className="bg-white rounded-2xl p-5 border border-[#E8E2D8] flex flex-col gap-2.5 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-stone-600">
                    <span className="uppercase tracking-wider font-bold text-[11px]">
                      LEDGER ESTIMATE PREVIEW
                    </span>
                    <span className="text-[11px] text-stone-400">Real-time balance update</span>
                  </div>

                  <div className="flex flex-col gap-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs sm:text-[13px] text-stone-600">
                      <span>Current Balance:</span>
                      <span className="font-mono font-medium text-stone-900 tabular-nums">
                        ₹{formatINR(BASE_BALANCE)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs sm:text-[13px] text-stone-600">
                      <span className="flex items-center gap-1.5">
                        Amount being added:
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D9911E]" />
                      </span>
                      <span className="font-mono font-bold text-stone-900 tabular-nums">
                        +₹{formatINR(amount)}
                      </span>
                    </div>

                    <div className="h-px bg-[#E8E2D8] my-1" />

                    <div className="flex items-baseline justify-between pt-0.5">
                      <span className="text-xs sm:text-[13px] font-bold text-stone-900">
                        Projected New Balance:
                      </span>
                      <span className="font-mono text-xl font-bold tabular-nums px-4 py-1.5 rounded-xl bg-[#FFF9ED] border border-[#E2B870] text-[#9A6218] shadow-2xs">
                        ₹{formatINR(projectedBalance)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons & Navigation */}
                <div className="flex flex-col items-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={!isAmountValid}
                    onClick={() => setActiveStep(2)}
                    className="w-full flex items-center justify-center gap-2 bg-[#141010] hover:bg-black text-white px-8 py-4 rounded-full font-semibold text-sm sm:text-base shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <span>Continue to Payment Method</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              </>
            )}

            {/* STEP 2: PAYMENT METHOD SELECTION */}
            {activeStep === 2 && (
              <div className="flex flex-col gap-5">
                <span className="text-[11px] tracking-wider font-bold text-stone-600 uppercase">
                  Select Deposit Method
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: "upi", label: "Instant UPI", sub: "GPay, PhonePe, Paytm", icon: "qr_code_2" },
                    { id: "netbanking", label: "Net Banking", sub: "HDFC, ICICI, SBI, Axis", icon: "account_balance" },
                    { id: "card", label: "Corporate Card", sub: "Visa, Mastercard, RuPay", icon: "credit_card" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMethod(m.id)}
                      className={`p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                        selectedMethod === m.id
                          ? "bg-white border-stone-900 shadow-sm ring-1 ring-stone-900"
                          : "bg-white/60 border-stone-200 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="material-symbols-outlined text-[24px] text-stone-800">
                          {m.icon}
                        </span>
                        <span
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            selectedMethod === m.id
                              ? "border-stone-900 bg-stone-900 text-white"
                              : "border-stone-300"
                          }`}
                        >
                          {selectedMethod === m.id && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-stone-900">{m.label}</p>
                        <p className="text-[11px] text-stone-500">{m.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="p-4 bg-white rounded-2xl border border-stone-200 flex items-center justify-between text-xs">
                  <span className="text-stone-600">Deposit Amount:</span>
                  <span className="font-mono font-bold text-base text-stone-900">
                    ₹{formatINR(amount)}
                  </span>
                </div>

                <div className="flex flex-col items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveStep(3)}
                    className="w-full flex items-center justify-center gap-2 bg-[#141010] hover:bg-black text-white px-8 py-4 rounded-full font-semibold text-sm sm:text-base shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                  >
                    <span>Proceed to Review</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStep(1)}
                    className="text-xs text-stone-600 hover:text-stone-900 py-1 transition-colors text-center cursor-pointer"
                  >
                    ← Back to Amount Selection
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: REVIEW & AUTHORIZE */}
            {activeStep === 3 && (
              <div className="flex flex-col gap-5">
                <div className="p-5 bg-white rounded-2xl border border-stone-200 flex flex-col gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    Deposit Summary
                  </span>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-600">Destination:</span>
                    <span className="font-semibold text-stone-900">The Grand Bistro HQ Escrow Wallet</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-600">Method:</span>
                    <span className="font-semibold text-stone-900 uppercase">{selectedMethod}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-600">Surcharge:</span>
                    <span className="font-semibold text-emerald-600">₹0.00 (Free)</span>
                  </div>
                  <div className="h-px bg-stone-100 my-1" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-stone-900">Total Net Debit:</span>
                    <span className="font-mono font-bold text-xl text-stone-900">₹{formatINR(amount)}</span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isProcessing || isSuccess}
                    onClick={handleAuthorizePayment}
                    className="w-full py-4 px-8 rounded-full bg-[#141010] hover:bg-black text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-80 transition-all hover:scale-[1.01] active:scale-[0.99]"
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
                        <span className="material-symbols-outlined text-emerald-400 text-[20px]">
                          check_circle
                        </span>
                        <span>Deposit Successful! Redirecting...</span>
                      </>
                    ) : (
                      <>
                        <span>Authorize Deposit of ₹{formatINR(amount)}</span>
                        <span className="material-symbols-outlined text-[18px]">lock</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    className="text-xs text-stone-600 hover:text-stone-900 py-1 transition-colors text-center cursor-pointer"
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
