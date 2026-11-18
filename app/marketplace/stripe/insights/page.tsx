import { Suspense } from "react";
import { Metadata } from "next";
import { StripeInsightsView } from "../../../components/marketplace/StripeInsightsView";

export const metadata: Metadata = {
  title: "Payment Insights | PREST Restaurant Suite",
  description:
    "Understand payment activity received through your restaurant's connected Stripe account.",
};

export default function StripeInsightsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Payment Insights...</span>
          </div>
        </div>
      }
    >
      <StripeInsightsView embeddedInMarketplace={false} />
    </Suspense>
  );
}

