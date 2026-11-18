import { Suspense } from "react";
import { Metadata } from "next";
import { StripeHealthView } from "../../../components/marketplace/StripeHealthView";

export const metadata: Metadata = {
  title: "Stripe Health Monitoring | PREST Restaurant Suite",
  description:
    "Monitor live connection health, latency, webhooks, and ledger synchronization between Prest and Stripe.",
};

export default function StripeHealthPage() {
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
      <StripeHealthView embeddedInMarketplace={false} />
    </Suspense>
  );
}

