import { Suspense } from "react";
import { Metadata } from "next";
import { RazorpaySuccessView } from "../../../components/marketplace/RazorpaySuccessView";

export const metadata: Metadata = {
  title: "Razorpay Connected Successfully | PREST Marketplace",
  description: "Your merchant account is now successfully integrated with PREST.",
};

export default function RazorpaySuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Connection Success...</span>
          </div>
        </div>
      }
    >
      <RazorpaySuccessView embeddedInMarketplace={false} />
    </Suspense>
  );
}

