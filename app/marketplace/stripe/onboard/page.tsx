import { Suspense } from "react";
import { Metadata } from "next";
import { StripeOnboard } from "../../../components/marketplace/StripeOnboard";

export const metadata: Metadata = {
  title: "Create or Connect Stripe | PREST Restaurant Suite",
  description:
    "Complete your Stripe account setup and connect it to Prest so you can manage restaurant payment activity.",
};

export default function StripeOnboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Stripe Onboarding...</span>
          </div>
        </div>
      }
    >
      <StripeOnboard embeddedInMarketplace={false} />
    </Suspense>
  );
}

