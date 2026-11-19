"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PosShell } from "../PosShell";
import { Toast, type ToastMessage } from "../Toast";

interface RazorpayOnboardingIntroProps {
  embeddedInMarketplace?: boolean;
  onBack?: () => void;
  onContinue?: () => void;
}

const ONBOARDING_FEATURES = [
  {
    icon: "payments",
    title: "Accept UPI",
    description: "Enable instant UPI transfers from all major apps.",
  },
  {
    icon: "credit_card",
    title: "Accept Cards",
    description: "Process Visa, Mastercard, and Rupay credit/debit cards.",
  },
  {
    icon: "account_balance_wallet",
    title: "Receive Settlements",
    description: "Direct settlements to your verified bank account.",
  },
  {
    icon: "monitoring",
    title: "Track Payments",
    description: "Real-time reconciliation through the Defx dashboard.",
  },
];

export function RazorpayOnboardingIntro({
  embeddedInMarketplace = false,
  onBack,
  onContinue,
}: RazorpayOnboardingIntroProps) {
  const router = useRouter();
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "info",
    subtext?: string
  ) => {
    setToast({ message, type, subtext });
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push("/marketplace?flow=razorpay-connect");
    }
  };

  const handleContinue = () => {
    if (onContinue) {
      onContinue();
    } else {
      router.push("/marketplace/razorpay/success?method=oauth&mode=live");
    }
  };

  const content = (
    <div className="w-full flex-1 flex flex-col p-4 sm:p-6 md:p-8 lg:p-10 max-w-[1280px] mx-auto">
      {/* 1. Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs sm:text-sm text-[#78716c] mb-6 flex-wrap"
      >
        <button
          type="button"
          onClick={() => router.push("/marketplace")}
          className="hover:text-[#0c0a09] transition-colors cursor-pointer"
        >
          Marketplace
        </button>
        <span className="material-symbols-outlined text-[16px] text-[#a8a29e]">chevron_right</span>
        <button
          type="button"
          onClick={() => router.push("/marketplace")}
          className="hover:text-[#0c0a09] transition-colors cursor-pointer"
        >
          Payment Providers
        </button>
        <span className="material-symbols-outlined text-[16px] text-[#a8a29e]">chevron_right</span>
        <button
          type="button"
          onClick={handleBack}
          className="hover:text-[#0c0a09] transition-colors cursor-pointer"
        >
          Razorpay Setup
        </button>
        <span className="material-symbols-outlined text-[16px] text-[#a8a29e]">chevron_right</span>
        <span className="text-[#0c0a09] font-bold">Onboarding</span>
      </nav>

      {/* 2. Main Two-Column Layout (Desktop: Content left, spacious visual area right; Mobile: single-column) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center flex-1 max-w-5xl">
        {/* Left Column: Content & Features */}
        <div className="lg:col-span-6 space-y-6">
          {/* Onboarding Phase 1 Badge */}
          <div>
            <span
              data-testid="onboarding-phase-badge"
              className="inline-flex items-center px-3 py-1 bg-[#f5f5f4] text-[#0c0a09] border border-[#e7e5e4] rounded-full text-[10px] font-bold uppercase tracking-widest shadow-2xs"
            >
              Onboarding Phase 1
            </span>
          </div>

          {/* Heading & Exact Description */}
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#0c0a09] tracking-tight">
              Create Or Connect Razorpay
            </h1>
            <p className="text-sm sm:text-base text-[#78716c] leading-relaxed">
              Don't have a Razorpay account yet? We'll guide you through account creation and
              connection to unlock seamless payment processing for your business.
            </p>
          </div>

          {/* 4 Feature Highlights */}
          <div className="space-y-4 pt-1">
            {ONBOARDING_FEATURES.map((feature) => (
              <div key={feature.title} className="flex items-start gap-3.5 group">
                <div className="w-10 h-10 rounded-xl bg-[#f5f5f4] border border-[#e7e5e4] flex items-center justify-center text-[#0c0a09] shrink-0 transition-transform duration-200 group-hover:scale-105 shadow-2xs">
                  <span className="material-symbols-outlined text-[20px]">
                    {feature.icon}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0c0a09]">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-[#78716c] leading-relaxed mt-0.5">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Primary Action Button */}
          <div className="pt-4">
            <Link
              href="/marketplace/razorpay/success?method=oauth&mode=live"
              onClick={onContinue}
              data-testid="btn-continue-razorpay"
              className="group w-full md:w-auto px-8 py-3.5 bg-[#0c0a09] hover:bg-[#27272a] active:scale-[0.98] text-white font-semibold text-sm rounded-xl shadow-xs transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue With Razorpay</span>
              <span className="material-symbols-outlined text-[18px] transition-transform duration-200 group-hover:translate-x-1">
                arrow_forward
              </span>
            </Link>
          </div>
        </div>

        {/* Right Column: Preserves spacious visual layout from reference (no unnecessary large illustration invented) */}
        <div className="hidden lg:flex lg:col-span-6 items-center justify-center p-8">
          <div className="w-full max-w-sm p-8 rounded-2xl border border-dashed border-[#e7e5e4] bg-[#fafaf9]/60 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#f5f5f4] border border-[#e7e5e4] flex items-center justify-center text-[#78716c]">
              <span className="material-symbols-outlined text-[24px]">verified</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#0c0a09]">Guided Business Onboarding</p>
              <p className="text-[11px] text-[#78716c] mt-1 leading-relaxed">
                Seamless digital KYC, instant merchant activation, and direct settlement routing.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Trust Footer */}
      <footer className="mt-16 pt-8 border-t border-[#e7e5e4] flex flex-col md:flex-row justify-between items-center gap-4 text-[#78716c]">
        {/* Left: PCI DSS & ISO Restrained Badges */}
        <div className="flex items-center gap-4 opacity-75 grayscale hover:grayscale-0 transition-all">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#e7e5e4] bg-[#fafaf9] text-[10px] font-semibold text-[#0c0a09]">
            <span className="material-symbols-outlined text-[14px]">shield</span>
            <span>PCI DSS Level 1</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#e7e5e4] bg-[#fafaf9] text-[10px] font-semibold text-[#0c0a09]">
            <span className="material-symbols-outlined text-[14px]">verified_user</span>
            <span>ISO 27001 Certified</span>
          </div>
        </div>

        {/* Right: Security Guarantee copy */}
        <div className="flex items-center gap-2 text-xs">
          <span className="material-symbols-outlined text-[#0c0a09] text-[16px]">lock</span>
          <p className="text-xs text-[#78716c]">
            Your financial data is encrypted and handled securely by Razorpay.
          </p>
        </div>
      </footer>

      {/* Toast Feedback */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );

  if (embeddedInMarketplace) {
    return content;
  }

  return (
    <PosShell title="Marketplace" subtitle="Razorpay Onboarding">
      {content}
    </PosShell>
  );
}

