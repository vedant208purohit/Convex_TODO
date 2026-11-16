import { Suspense } from "react";
import { Metadata } from "next";
import { RazorpaySettlementRequestFlow } from "../../../../components/marketplace/RazorpaySettlementRequestFlow";

export const metadata: Metadata = {
  title: "Review Settlement | Razorpay | PREST Marketplace",
  description: "Review the settlement details before submitting your request.",
};

export default function RazorpayReviewSettlementPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Review Settlement...</span>
          </div>
        </div>
      }
    >
      <RazorpaySettlementRequestFlow initialStep={2} embeddedInMarketplace={false} />
    </Suspense>
  );
}

