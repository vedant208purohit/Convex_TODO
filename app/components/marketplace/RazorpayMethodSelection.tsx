"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PosShell } from "../PosShell";
import { RazorpayIcon } from "./MarketplaceCard";
import { Toast, type ToastMessage } from "../Toast";

interface RazorpayMethodSelectionProps {
  embeddedInMarketplace?: boolean;
  onBackToMarketplace?: () => void;
  onSelectApiKeys?: () => void;
  onSelectOnboarding?: () => void;
}

export function RazorpayMethodSelection({
  embeddedInMarketplace = false,
  onBackToMarketplace,
  onSelectApiKeys,
  onSelectOnboarding,
}: RazorpayMethodSelectionProps) {
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
    if (onBackToMarketplace) {
      onBackToMarketplace();
    } else {
      router.push("/marketplace");
    }
  };

  const handleApiKeysClick = () => {
    if (onSelectApiKeys) {
      onSelectApiKeys();
    } else {
      router.push("/marketplace/razorpay/api-keys");
    }
  };

  const handleOnboardingClick = () => {
    if (onSelectOnboarding) {
      onSelectOnboarding();
    } else {
      router.push("/marketplace/razorpay/onboarding");
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
          onClick={handleBack}
          className="hover:text-[#0c0a09] transition-colors cursor-pointer"
        >
          Marketplace
        </button>
        <span className="material-symbols-outlined text-[16px] text-[#a8a29e]">chevron_right</span>
        <button
          type="button"
          onClick={handleBack}
          className="hover:text-[#0c0a09] transition-colors cursor-pointer"
        >
          Payment Providers
        </button>
        <span className="material-symbols-outlined text-[16px] text-[#a8a29e]">chevron_right</span>
        <span className="text-[#0c0a09] font-bold">Razorpay Setup</span>
      </nav>

      {/* 2. Header Section */}
      <section className="max-w-3xl mb-8 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#0c0a09] tracking-tight mb-2">
          Connect Your Razorpay Account
        </h1>
        <p className="text-sm sm:text-base text-[#78716c]">
          Choose how you want to connect Razorpay with Defx.
        </p>
      </section>

      {/* 3. Connection Options Grid (Desktop: 2 side-by-side; Mobile: stacked) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-5xl mb-12">
        {/* CARD 1: Existing Razorpay merchant */}
        <div
          data-testid="razorpay-option-existing"
          className="group flex flex-col justify-between bg-white border border-[#e7e5e4] rounded-2xl p-6 sm:p-8 transition-all duration-200 shadow-xs hover:border-[#0c0a09]/40 hover:shadow-md"
        >
          <div>
            {/* Link Icon Container */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#f5f5f4] border border-[#e7e5e4] flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-200">
              <span className="material-symbols-outlined text-[#0c0a09] text-[28px] sm:text-[32px]">
                link
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-[#0c0a09] mb-2.5">
              I Already Have Razorpay
            </h2>

            <p className="text-sm text-[#78716c] leading-relaxed mb-8">
              Connect using existing Razorpay API credentials. This method allows you to use your
              current business configurations and transaction history.
            </p>
          </div>

          {/* Button: White background, black text, thin neutral border */}
          <Link
            href="/marketplace/razorpay/api-keys"
            onClick={onSelectApiKeys}
            data-testid="btn-connect-api-keys"
            className="w-full py-3 sm:py-3.5 px-4 bg-white border border-[#e7e5e4] hover:border-[#0c0a09] hover:bg-[#f5f5f4] active:bg-[#e7e5e4] text-[#0c0a09] font-semibold text-sm rounded-xl transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
          >
            <span>Connect Using API Keys</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
        </div>

        {/* CARD 2: New Razorpay merchant */}
        <div
          data-testid="razorpay-option-new"
          className="group flex flex-col justify-between bg-white border border-[#e7e5e4] rounded-2xl p-6 sm:p-8 transition-all duration-200 shadow-xs hover:border-[#0c0a09]/40 hover:shadow-md"
        >
          <div>
            {/* Trending Up Icon Container */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#0c0a09]/5 border border-[#e7e5e4] flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-200">
              <span className="material-symbols-outlined text-[#0c0a09] text-[28px] sm:text-[32px]">
                trending_up
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-[#0c0a09] mb-2.5">
              I'm New To Razorpay
            </h2>

            <p className="text-sm text-[#78716c] leading-relaxed mb-8">
              Create or connect a Razorpay account through guided onboarding. Ideal for businesses
              looking to scale their payments infrastructure with Defx.
            </p>
          </div>

          {/* Button: Black background, white text */}
          <Link
            href="/marketplace/razorpay/onboarding"
            onClick={onSelectOnboarding}
            data-testid="btn-continue-onboarding"
            className="w-full py-3 sm:py-3.5 px-4 bg-[#0c0a09] hover:bg-[#27272a] active:scale-[0.98] text-white font-semibold text-sm rounded-xl transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <span>Continue With Razorpay</span>
            <span className="material-symbols-outlined text-[18px]">launch</span>
          </Link>
        </div>
      </div>

      {/* 4. Security Information Section */}
      <div className="max-w-5xl pt-6 border-t border-[#e7e5e4] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-12">
        <div className="flex items-center gap-2.5">
          <span
            className="material-symbols-outlined text-[#0c0a09] text-[20px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            verified_user
          </span>
          <p className="text-xs sm:text-sm text-[#78716c]">
            Your credentials are encrypted and never stored in plain text.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 opacity-60 grayscale hover:grayscale-0 transition-all">
            <RazorpayIcon className="w-5 h-5 text-[#0c0a09]" />
            <span className="text-xs font-semibold text-[#0c0a09] tracking-tight">Razorpay</span>
          </div>
          <div className="h-4 w-[1px] bg-[#e7e5e4]" />
          <p className="text-xs sm:text-sm text-[#78716c] italic">Powered by Defx Secure Connect</p>
        </div>
      </div>

      {/* 5. Bottom Decorative Tiles (Monochrome, Equal-width, Subtle borders) */}
      <div className="max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 opacity-40 grayscale pointer-events-none select-none">
        <div
          data-testid="decorative-tile-security"
          className="h-28 sm:h-32 bg-[#fafaf9] rounded-xl border border-[#e7e5e4] flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-3xl sm:text-4xl text-[#78716c]">
            security
          </span>
        </div>
        <div
          data-testid="decorative-tile-bank"
          className="h-28 sm:h-32 bg-[#fafaf9] rounded-xl border border-[#e7e5e4] flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-3xl sm:text-4xl text-[#78716c]">
            account_balance
          </span>
        </div>
        <div
          data-testid="decorative-tile-api"
          className="h-28 sm:h-32 bg-[#fafaf9] rounded-xl border border-[#e7e5e4] flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-3xl sm:text-4xl text-[#78716c]">
            api
          </span>
        </div>
      </div>

      {/* Toast Feedback */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );

  if (embeddedInMarketplace) {
    return content;
  }

  return (
    <PosShell title="Marketplace" subtitle="Razorpay Setup">
      {content}
    </PosShell>
  );
}

