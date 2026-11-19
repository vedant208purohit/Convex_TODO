import { Suspense } from "react";
import { Metadata } from "next";
import { RazorpayMethodSelection } from "../../../components/marketplace/RazorpayMethodSelection";

export const metadata: Metadata = {
  title: "Connect Your Razorpay Account | PREST Marketplace",
  description: "Choose how to connect Razorpay with Defx.",
};

export default function RazorpayConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Razorpay Setup...</span>
          </div>
        </div>
      }
    >
      <RazorpayMethodSelection embeddedInMarketplace={false} />
    </Suspense>
  );
}

