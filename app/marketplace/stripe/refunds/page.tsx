import { Suspense } from "react";
import { Metadata } from "next";
import { StripeRefundsView } from "../../../components/marketplace/StripeRefundsView";

export const metadata: Metadata = {
  title: "Restaurant Payment Refunds | PREST Restaurant Suite",
  description:
    "Review and manage refunds for payments received through your restaurant orders.",
};

export default function StripeRefundsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Payment Refunds...</span>
          </div>
        </div>
      }
    >
      <StripeRefundsView embeddedInMarketplace={false} />
    </Suspense>
  );
}

