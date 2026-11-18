import { Suspense } from "react";
import { Metadata } from "next";
import { StripeMethodSelection } from "../../../components/marketplace/StripeMethodSelection";

export const metadata: Metadata = {
  title: "Connect Your Stripe Account | PREST Marketplace",
  description: "Connect Stripe to accept payments for eligible restaurant orders.",
};

export default function StripeConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Stripe Setup...</span>
          </div>
        </div>
      }
    >
      <StripeMethodSelection embeddedInMarketplace={false} />
    </Suspense>
  );
}

