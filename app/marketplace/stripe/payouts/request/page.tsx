import { Suspense } from "react";
import { Metadata } from "next";
import { StripeRequestPayoutView } from "../../../../components/marketplace/StripeRequestPayoutView";

export const metadata: Metadata = {
  title: "Request Payout | PREST Restaurant Suite",
  description:
    "Request an eligible payout from your Stripe account to your linked bank account.",
};

export default function StripeRequestPayoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Payout Request...</span>
          </div>
        </div>
      }
    >
      <StripeRequestPayoutView embeddedInMarketplace={false} />
    </Suspense>
  );
}

