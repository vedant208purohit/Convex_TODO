"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface StripeOnboardProps {
  embeddedInMarketplace?: boolean;
  onBackToMarketplace?: () => void;
  onContinueWithStripe?: () => void;
}

export function StripeOnboard({
  embeddedInMarketplace = false,
  onBackToMarketplace,
  onContinueWithStripe,
}: StripeOnboardProps) {
  const router = useRouter();
  const [isInitiating, setIsInitiating] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "info" | "success" | "error";
    description?: string;
  } | null>(null);

  const showToast = (message: string, type: "info" | "success" | "error", description?: string) => {
    setToast({ message, type, description });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const handleExit = () => {
    if (onBackToMarketplace) {
      onBackToMarketplace();
    } else {
      router.push("/marketplace?category=Payments");
    }
  };

  const handleContinue = async () => {
    if (onContinueWithStripe) {
      onContinueWithStripe();
      return;
    }

    setIsInitiating(true);
    showToast(
      "Connecting with Stripe...",
      "info",
      "Initiating Stripe Connect guided onboarding session for your restaurant."
    );

    // Simulate onboarding redirect / connection handshake
    setTimeout(() => {
      setIsInitiating(false);
      showToast(
        "Stripe Onboarding Window Ready",
        "success",
        "Stripe verification session initialized. In production, operators complete verification on Stripe's secure portal."
      );
    }, 1200);
  };

  const content = (
    <div className="w-full flex-1 flex flex-col items-center justify-between min-h-[calc(100vh-64px)] px-4 sm:px-6 md:px-10 py-8 font-sans">
      {/* Toast Notification */}
      {toast && (
        <div
          data-testid="stripe-onboard-toast"
          className="fixed top-6 right-6 z-50 max-w-sm w-full bg-[#1c1b1d] text-white p-4 rounded-xl shadow-xl border border-[#33302e] flex items-start gap-3 animate-in fade-in slide-in-from-top-3 duration-200"
        >
          <span className="material-symbols-outlined text-amber-400 text-xl mt-0.5 shrink-0">
            {toast.type === "success" ? "check_circle" : toast.type === "error" ? "error" : "info"}
          </span>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold">{toast.message}</h4>
            {toast.description && (
              <p className="text-xs text-stone-300 mt-0.5 leading-relaxed">{toast.description}</p>
            )}
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-stone-400 hover:text-white transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Embedded back button if inside marketplace */}
      {embeddedInMarketplace && (
        <div className="w-full max-w-4xl mb-4 flex items-center justify-between">
          <button
            onClick={handleExit}
            data-testid="btn-embedded-back"
            className="flex items-center gap-1.5 text-xs text-[#645d58] hover:text-[#1e1b19] font-medium transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>Back to Payment Integrations</span>
          </button>
          <div className="text-[11px] uppercase tracking-wider text-[#7f7570] font-semibold">
            Stripe Connect Flow
          </div>
        </div>
      )}

      <div className="flex flex-col items-center justify-center max-w-2xl w-full mx-auto my-auto text-center">
        {/* Abstract Illustration Flow Area */}
        <div className="relative w-full mb-8 sm:mb-10 py-4 flex items-center justify-center">
          <div className="relative z-10 flex items-center justify-between w-full max-w-xl px-2 sm:px-4">
            {/* Step 1: Restaurant POS */}
            <div className="flex flex-col items-center gap-2 group">
              <div className="w-14 h-14 rounded-lg bg-white border border-[#e0d8d5] flex items-center justify-center shadow-xs group-hover:border-[#1e1b19] transition-all">
                <span className="material-symbols-outlined text-[#1e1b19] text-[26px]">
                  restaurant
                </span>
              </div>
              <span className="text-xs font-medium text-[#645d58]">Restaurant POS</span>
            </div>

            {/* Connecting Flow 1 */}
            <div className="flex-grow flex flex-col items-center px-2 sm:px-4 relative">
              <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-[#d6ccc7] to-transparent opacity-80" />
              <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-center">
                <span className="material-symbols-outlined text-[#7f7570] text-sm bg-[#fff8f5] px-1">
                  arrow_forward
                </span>
              </div>
            </div>

            {/* Step 2: Stripe Gateway */}
            <div className="flex flex-col items-center gap-2 group">
              <div className="w-16 h-16 rounded-xl bg-[#1c1b1d] text-white flex items-center justify-center shadow-md ring-4 ring-[#ebe1da]/60 transition-all">
                <span className="material-symbols-outlined text-white text-[28px]">
                  credit_card
                </span>
              </div>
              <span className="text-xs font-semibold text-[#1e1b19] tracking-wide">
                Stripe Gateway
              </span>
            </div>

            {/* Connecting Flow 2 */}
            <div className="flex-grow flex flex-col items-center px-2 sm:px-4 relative">
              <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-[#d6ccc7] to-transparent opacity-80" />
              <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-center">
                <span className="material-symbols-outlined text-[#7f7570] text-sm bg-[#fff8f5] px-1">
                  arrow_forward
                </span>
              </div>
            </div>

            {/* Step 3: Prest Operations */}
            <div className="flex flex-col items-center gap-2 group">
              <div className="w-14 h-14 rounded-lg bg-white border border-[#e0d8d5] flex items-center justify-center shadow-xs group-hover:border-[#1e1b19] transition-all">
                <span className="material-symbols-outlined text-[#1e1b19] text-[26px]">
                  point_of_sale
                </span>
              </div>
              <span className="text-xs font-medium text-[#645d58]">Prest Operations</span>
            </div>
          </div>
        </div>

        {/* Header Content */}
        <div className="space-y-3 mb-8 sm:mb-10">
          <h1 className="font-serif text-3xl sm:text-4xl text-[#1e1b19] font-normal tracking-tight">
            Create or Connect Stripe
          </h1>
          <p className="text-sm sm:text-base text-[#645d58] max-w-xl mx-auto leading-relaxed">
            Complete your Stripe account setup and connect it to Prest so you can manage restaurant payment activity.
          </p>
        </div>

        {/* Benefits Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 w-full mb-8 sm:mb-10">
          {/* Card 1 */}
          <div
            data-testid="benefit-card-payments"
            className="p-5 sm:p-6 bg-white rounded-lg border border-[#e0d8d5] text-left hover:border-[#1e1b19] transition-all shadow-xs hover:shadow-sm group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-md bg-[#faf2ee] border border-[#e0d8d5]/60 flex items-center justify-center mb-4 text-[#1e1b19] group-hover:bg-[#1c1b1d] group-hover:text-white transition-colors">
              <span className="material-symbols-outlined text-xl">payments</span>
            </div>
            <h3 className="font-serif text-base sm:text-lg font-bold text-[#1e1b19] mb-1.5">
              Accept Customer Payments
            </h3>
            <p className="text-xs text-[#645d58] leading-relaxed">
              Authorize Prest to connect with your existing Stripe account and access supported payment processing.
            </p>
          </div>

          {/* Card 2 */}
          <div
            data-testid="benefit-card-onboarding"
            className="p-5 sm:p-6 bg-white rounded-lg border border-[#e0d8d5] text-left hover:border-[#1e1b19] transition-all shadow-xs hover:shadow-sm group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-md bg-[#faf2ee] border border-[#e0d8d5]/60 flex items-center justify-center mb-4 text-[#1e1b19] group-hover:bg-[#1c1b1d] group-hover:text-white transition-colors">
              <span className="material-symbols-outlined text-xl">assignment_turned_in</span>
            </div>
            <h3 className="font-serif text-base sm:text-lg font-bold text-[#1e1b19] mb-1.5">
              Guided Account Setup
            </h3>
            <p className="text-xs text-[#645d58] leading-relaxed">
              Create your Stripe account and complete the required business details before connecting it to Prest.
            </p>
          </div>

          {/* Card 3 */}
          <div
            data-testid="benefit-card-tables"
            className="p-5 sm:p-6 bg-white rounded-lg border border-[#e0d8d5] text-left hover:border-[#1e1b19] transition-all shadow-xs hover:shadow-sm group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-md bg-[#faf2ee] border border-[#e0d8d5]/60 flex items-center justify-center mb-4 text-[#1e1b19] group-hover:bg-[#1c1b1d] group-hover:text-white transition-colors">
              <span className="material-symbols-outlined text-xl">table_restaurant</span>
            </div>
            <h3 className="font-serif text-base sm:text-lg font-bold text-[#1e1b19] mb-1.5">
              Modern Table &amp; Digital Payments
            </h3>
            <p className="text-xs text-[#645d58] leading-relaxed">
              Enable contactless dining, digital wallets, and split-bill payment settlement.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="w-full flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={handleContinue}
            disabled={isInitiating}
            data-testid="btn-continue-with-stripe"
            className="w-full md:w-auto min-w-[280px] px-8 h-12 bg-[#060607] hover:bg-[#1f1f1f] disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-xs hover:shadow active:scale-[0.99] cursor-pointer"
          >
            {isInitiating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Initializing Stripe Session...</span>
              </>
            ) : (
              <>
                <span>Continue with Stripe</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </>
            )}
          </button>

          {/* Verification Notice */}
          <div className="w-full max-w-lg bg-[#faf2ee]/80 border border-[#e0d8d5] rounded-md px-4 py-2.5 text-center">
            <p className="text-xs text-[#645d58] leading-normal">
              <span className="font-semibold text-[#1e1b19]">
                Stripe Standard Verification Notice:
              </span>{" "}
              Stripe may ask you to complete additional business verification before your restaurant account can accept live customer payments.
            </p>
          </div>

          <p className="text-xs text-[#7f7570] flex items-center gap-1.5 mt-1">
            <span className="material-symbols-outlined text-[15px]">lock</span>
            <span>Secured by Stripe Identity and AES-256 Encryption</span>
          </p>
        </div>
      </div>

      {/* Footer Security Banner */}
      <footer className="w-full mt-10 pt-4 pb-2 border-t border-[#e0d8d5] flex flex-wrap justify-center items-center gap-3 sm:gap-5 text-xs text-[#645d58]">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">verified_user</span>
          <span className="text-[10px] uppercase tracking-wider font-semibold">
            PCI-DSS Compliant
          </span>
        </div>
        <div className="h-3 w-[1px] bg-[#e0d8d5]" />
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">security</span>
          <span className="text-[10px] uppercase tracking-wider font-semibold">
            3D Secure 2.0
          </span>
        </div>
        <div className="h-3 w-[1px] bg-[#e0d8d5]" />
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">hub</span>
          <span className="text-[10px] uppercase tracking-wider font-semibold">
            Official Stripe Connect Partner
          </span>
        </div>
      </footer>

      {/* Help Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[#FCFBF7] border border-[#EBE7DF] rounded-xl max-w-md w-full p-6 text-left shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-xl font-bold text-[#1A1A1A]">Stripe Support &amp; Onboarding</h3>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="text-[#736B5E] hover:text-[#1A1A1A] cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <p className="text-sm text-[#736B5E] leading-relaxed mb-4">
              Need assistance setting up your Stripe account? Stripe Connect allows restaurants to accept in-person, online, and QR payments with end-to-end reconciliation.
            </p>
            <div className="space-y-2 text-xs text-[#1A1A1A] mb-6">
              <div className="p-3 bg-white border border-[#EBE7DF] rounded-lg">
                <span className="font-semibold block mb-0.5">Documentation:</span>
                Access the official Stripe documentation at{" "}
                <a
                  href="https://stripe.com/docs/connect"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#8B3A2B] underline"
                >
                  stripe.com/docs/connect
                </a>
              </div>
              <div className="p-3 bg-white border border-[#EBE7DF] rounded-lg">
                <span className="font-semibold block mb-0.5">API Keys Option:</span>
                Already have credentials? You can switch to direct API Key connection anytime.
              </div>
            </div>
            <button
              onClick={() => setIsHelpOpen(false)}
              className="w-full py-2 bg-[#1A1A1A] text-white rounded-lg text-xs font-medium hover:bg-[#33302e] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (embeddedInMarketplace) {
    return <div className="bg-[#fff8f5] text-[#1e1b19] min-h-[600px] w-full">{content}</div>;
  }

  return (
    <div className="bg-[#fff8f5] text-[#1e1b19] min-h-screen flex flex-col selection:bg-[#ebe1da] selection:text-[#1e1b19]">
      {/* Standalone Header */}
      <header className="w-full h-16 flex items-center justify-between px-4 sm:px-6 md:px-10 sticky top-0 bg-[#fff8f5]/90 backdrop-blur-sm z-40 border-b border-[#e0d8d5]/40">
        <div className="flex items-center gap-2.5">
          <span className="font-serif text-2xl font-bold tracking-tight text-[#1e1b19]">
            Prest
          </span>
          <span className="text-[11px] uppercase tracking-widest px-2 py-0.5 rounded border border-[#e0d8d5] text-[#645d58] bg-[#f4ece8]/60 font-semibold">
            POS Partner
          </span>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <button
            onClick={() => setIsHelpOpen(true)}
            data-testid="btn-help-support"
            className="text-[#645d58] text-xs font-semibold hover:text-[#000000] transition-colors cursor-pointer"
          >
            Help &amp; Support
          </button>
          <button
            onClick={handleExit}
            data-testid="btn-save-exit"
            className="text-[#645d58] text-xs font-semibold hover:text-[#000000] transition-colors cursor-pointer"
          >
            Save &amp; Exit
          </button>
        </div>
      </header>

      {/* Main View */}
      <main className="flex-1 flex flex-col">{content}</main>
    </div>
  );
}

