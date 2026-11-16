import { Suspense } from "react";
import { Metadata } from "next";
import { RazorpaySettlementsView } from "../../../components/marketplace/RazorpaySettlementsView";

export const metadata: Metadata = {
  title: "Razorpay Settlements | PREST Marketplace",
  description: "Manage your payout history and upcoming transfers.",
};

export default function RazorpaySettlementsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Settlements...</span>
          </div>
        </div>
      }
    >
      <RazorpaySettlementsView embeddedInMarketplace={false} />
    </Suspense>
  );
}

