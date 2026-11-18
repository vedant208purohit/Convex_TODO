import { Suspense } from "react";
import { Metadata } from "next";
import { StripeReviewPayoutView } from "../../../../components/marketplace/StripeReviewPayoutView";

export const metadata: Metadata = {
  title: "Review Payout Request | PREST Restaurant Suite",
  description:
    "Review your payout transfer details before submitting to Stripe.",
};

export default function StripeReviewPayoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Payout Review...</span>
          </div>
        </div>
      }
    >
      <StripeReviewPayoutView embeddedInMarketplace={false} />
    </Suspense>
  );
}

