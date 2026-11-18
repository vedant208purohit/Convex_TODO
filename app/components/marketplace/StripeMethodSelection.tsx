"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PosShell } from "../PosShell";
import { Toast, type ToastMessage } from "../Toast";

interface StripeMethodSelectionProps {
  embeddedInMarketplace?: boolean;
  onBackToMarketplace?: () => void;
  onSelectExistingAccount?: () => void;
  onSelectNewAccount?: () => void;
}

export function StripeMethodSelection({
  embeddedInMarketplace = false,
  onBackToMarketplace,
  onSelectExistingAccount,
  onSelectNewAccount,
}: StripeMethodSelectionProps) {
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
      router.push("/marketplace?category=Payments");
    }
  };

  const handleExistingClick = () => {
    if (onSelectExistingAccount) {
      onSelectExistingAccount();
    } else if (embeddedInMarketplace) {
      showToast("Existing account connection selected", "info", "Navigating to credentials setup...");
      router.push("/marketplace?flow=stripe-api-keys");
    } else {
      router.push("/marketplace/stripe/api-keys");
    }
  };

  const handleNewClick = () => {
    if (onSelectNewAccount) {
      onSelectNewAccount();
    } else if (embeddedInMarketplace) {
      showToast("Stripe Onboarding selected", "info", "Navigating to guided restaurant onboarding...");
      router.push("/marketplace?flow=stripe-onboarding");
    } else {
      router.push("/marketplace/stripe/onboard");
    }
  };

  const content = (
    <div className="w-full flex-1 flex flex-col p-4 sm:p-6 md:p-8 lg:p-10 max-w-5xl mx-auto font-sans">
      {/* Top Center Header */}
      <div className="text-center mb-8 sm:mb-10 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f4ece8] border border-[#e0d8d5] text-[#645d58] text-xs uppercase tracking-wider mb-4">
          <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
          <span className="font-semibold">Payment Integration</span>
        </div>

        <h1 className="font-garamond text-3xl sm:text-4xl text-[#1e1b19] font-bold tracking-tight mb-3">
          Connect Your Stripe Account
        </h1>

        <p className="text-[#645d58] text-sm sm:text-base leading-relaxed">
          Connect Stripe to start receiving payments from your restaurant customers through supported Prest payment channels.
        </p>
      </div>

      {/* 2-Card Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-10">
        {/* Card 1: Existing Stripe Account */}
        <div
          data-testid="stripe-option-existing"
          className="bg-white border border-[#e0d8d5] rounded-xl p-6 sm:p-8 flex flex-col justify-between hover:shadow-lg transition-all duration-300 relative group"
        >
          <div className="absolute -top-3 left-6">
            <span className="bg-[#f4ece8] text-[#1e1b19] text-xs font-semibold px-3 py-1 rounded-full border border-[#e0d8d5] shadow-2xs">
              Fastest Connection
            </span>
          </div>

          <div>
            <div className="w-12 h-12 rounded-lg bg-[#faf2ee] border border-[#e0d8d5] flex items-center justify-center text-[#1e1b19] mb-6 mt-1">
              <span className="material-symbols-outlined text-2xl">sync_alt</span>
            </div>

            <h2 className="font-garamond text-xl font-bold text-[#1e1b19] mb-2">
              I Already Have a Stripe Account
            </h2>

            <p className="text-[#645d58] text-sm leading-relaxed mb-6">
              I already use Stripe for my restaurant and want to connect my existing account to Prest.
            </p>

            <div className="pt-4 border-t border-[#e0d8d5]/60 mb-6">
              <h3 className="text-xs uppercase tracking-wider text-[#645d58] font-semibold mb-3">
                What you&apos;ll need:
              </h3>
              <ul className="space-y-2.5">
                <li className="flex items-start gap-2.5 text-xs text-[#1e1b19]">
                  <span className="material-symbols-outlined text-emerald-700 text-base mt-0.5 shrink-0">
                    check_circle
                  </span>
                  <span>Active, verified Stripe account</span>
                </li>
                <li className="flex items-start gap-2.5 text-xs text-[#1e1b19]">
                  <span className="material-symbols-outlined text-emerald-700 text-base mt-0.5 shrink-0">
                    check_circle
                  </span>
                  <span>Access to your Stripe Dashboard</span>
                </li>
                <li className="flex items-start gap-2.5 text-xs text-[#1e1b19]">
                  <span className="material-symbols-outlined text-emerald-700 text-base mt-0.5 shrink-0">
                    check_circle
                  </span>
                  <span>Authorization or API credentials for Prest</span>
                </li>
              </ul>
            </div>

            <p className="text-xs text-[#7f7570] italic mb-6">
              Use your existing Stripe account to connect payment processing with your restaurant management system.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExistingClick}
            data-testid="btn-connect-existing-stripe"
            className="w-full py-3 px-5 border border-[#1e1b19] text-[#1e1b19] font-medium text-sm rounded-lg hover:bg-[#1e1b19] hover:text-white transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.99]"
          >
            <span>Connect Existing Account</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>

        {/* Card 2: New to Stripe */}
        <div
          data-testid="stripe-option-new"
          className="bg-white border-2 border-[#1e1b19] rounded-xl p-6 sm:p-8 flex flex-col justify-between hover:shadow-xl transition-all duration-300 relative group"
        >
          <div className="absolute -top-3 left-6">
            <span className="bg-[#1e1b19] text-white text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
              Recommended for New Restaurants
            </span>
          </div>

          <div>
            <div className="w-12 h-12 rounded-lg bg-[#faf2ee] border border-[#e0d8d5] flex items-center justify-center text-[#1e1b19] mb-6 mt-1">
              <span className="material-symbols-outlined text-2xl">add_business</span>
            </div>

            <h2 className="font-garamond text-xl font-bold text-[#1e1b19] mb-2">
              I&apos;m New to Stripe
            </h2>

            <p className="text-[#645d58] text-sm leading-relaxed mb-6">
              I don&apos;t have a Stripe account yet. I want to create one before connecting it to Prest.
            </p>

            <div className="pt-4 border-t border-[#e0d8d5]/60 mb-6">
              <h3 className="text-xs uppercase tracking-wider text-[#645d58] font-semibold mb-3">
                Onboarding includes:
              </h3>
              <ul className="space-y-2.5">
                <li className="flex items-start gap-2.5 text-xs text-[#1e1b19]">
                  <span className="material-symbols-outlined text-emerald-700 text-base mt-0.5 shrink-0">
                    check_circle
                  </span>
                  <span>Guided setup for restaurant operators</span>
                </li>
                <li className="flex items-start gap-2.5 text-xs text-[#1e1b19]">
                  <span className="material-symbols-outlined text-emerald-700 text-base mt-0.5 shrink-0">
                    check_circle
                  </span>
                  <span>Direct onboarding via Stripe</span>
                </li>
                <li className="flex items-start gap-2.5 text-xs text-[#1e1b19]">
                  <span className="material-symbols-outlined text-emerald-700 text-base mt-0.5 shrink-0">
                    check_circle
                  </span>
                  <span>Automatic sync with Prest order settlement</span>
                </li>
              </ul>
            </div>

            <p className="text-xs text-[#7f7570] italic mb-6">
              Complete the required Stripe account setup and return to Prest to finish connecting your payment gateway.
            </p>
          </div>

          <button
            type="button"
            onClick={handleNewClick}
            data-testid="btn-create-stripe-account"
            className="w-full py-3 px-5 bg-[#1e1b19] text-white font-medium text-sm rounded-lg hover:bg-[#33302e] shadow-md transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <span>Create Stripe Account</span>
            <span className="material-symbols-outlined text-sm">north_east</span>
          </button>
        </div>
      </div>

      {/* Bottom Navigation & Trust Badges Strip */}
      <div className="flex flex-col items-center gap-6 mt-auto">
        <button
          type="button"
          onClick={handleBack}
          data-testid="btn-back-payment-gateways"
          className="flex items-center gap-1.5 text-xs text-[#645d58] hover:text-[#1e1b19] transition-colors font-medium cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          <span>Back to Payment Gateways</span>
        </button>

        <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-8 pt-6 border-t border-[#e0d8d5] w-full max-w-2xl text-[#645d58]">
          <div className="flex items-center gap-2 text-xs">
            <span className="material-symbols-outlined text-base text-[#645d58]">verified_user</span>
            <span className="font-semibold tracking-wide uppercase text-[11px]">PCI-DSS Compliant</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="material-symbols-outlined text-base text-[#645d58]">lock</span>
            <span className="font-semibold tracking-wide uppercase text-[11px]">Secure 256-bit Encryption</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="material-symbols-outlined text-base text-[#645d58]">handshake</span>
            <span className="font-semibold tracking-wide uppercase text-[11px]">Official Stripe Partner</span>
          </div>
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );

  if (embeddedInMarketplace) {
    return content;
  }

  return (
    <PosShell
      title="Payment Gateways"
      subtitle="Connect Stripe"
    >
      <div className="bg-[#fff8f5] min-h-[calc(100vh-64px)] flex flex-col justify-center">
        {content}
      </div>
    </PosShell>
  );
}

