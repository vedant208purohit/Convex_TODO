import { Suspense } from "react";
import { Metadata } from "next";
import { StripePayoutDetailsView } from "../../../../components/marketplace/StripePayoutDetailsView";

export const metadata: Metadata = {
  title: "Payout Details | PREST Restaurant Suite",
  description:
    "View detailed payout status, timeline, and bank settlement information.",
};

export default function StripePayoutDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Payout Details...</span>
          </div>
        </div>
      }
    >
      <StripePayoutDetailsView embeddedInMarketplace={false} />
    </Suspense>
  );
}

