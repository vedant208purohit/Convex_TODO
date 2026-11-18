import { Suspense } from "react";
import { Metadata } from "next";
import { StripeSuccessView } from "../../../components/marketplace/StripeSuccessView";

export const metadata: Metadata = {
  title: "Stripe Connected Successfully | PREST Restaurant Suite",
  description:
    "Your Stripe account is now connected to Prest. You can manage your restaurant payment activity through the Prest admin panel.",
};

export default function StripeSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Connection Summary...</span>
          </div>
        </div>
      }
    >
      <StripeSuccessView embeddedInMarketplace={false} />
    </Suspense>
  );
}

