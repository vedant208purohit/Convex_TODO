import { Suspense } from "react";
import { Metadata } from "next";
import { RazorpayDashboardView } from "../../../components/marketplace/RazorpayDashboardView";

export const metadata: Metadata = {
  title: "Razorpay Payments Dashboard | PREST Marketplace",
  description: "Live gateway operations, transaction telemetry, and settlement reconciliation.",
};

export default function RazorpayDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Razorpay Dashboard...</span>
          </div>
        </div>
      }
    >
      <RazorpayDashboardView embeddedInMarketplace={false} />
    </Suspense>
  );
}

