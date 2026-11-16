import { Suspense } from "react";
import { Metadata } from "next";
import { RazorpayRefundsView } from "../../../components/marketplace/RazorpayRefundsView";

export const metadata: Metadata = {
  title: "Razorpay Refunds | PREST Marketplace",
  description: "Manage and track all customer refund requests.",
};

export default function RazorpayRefundsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Refunds...</span>
          </div>
        </div>
      }
    >
      <RazorpayRefundsView embeddedInMarketplace={false} />
    </Suspense>
  );
}

