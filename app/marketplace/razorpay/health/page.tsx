import { Suspense } from "react";
import { Metadata } from "next";
import { RazorpayHealthView } from "../../../components/marketplace/RazorpayHealthView";

export const metadata: Metadata = {
  title: "Razorpay Health Monitoring | PREST Marketplace",
  description: "Monitor the health and status of your Razorpay integration.",
};

export default function RazorpayHealthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Health Monitoring...</span>
          </div>
        </div>
      }
    >
      <RazorpayHealthView embeddedInMarketplace={false} />
    </Suspense>
  );
}

