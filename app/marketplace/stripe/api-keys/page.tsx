import { Suspense } from "react";
import { Metadata } from "next";
import { StripeApiKeysForm } from "../../../components/marketplace/StripeApiKeysForm";

export const metadata: Metadata = {
  title: "Connect Stripe Using API Keys | PREST Marketplace",
  description: "Securely link your Stripe environment using API credentials.",
};

export default function StripeApiKeysPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fbf8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Stripe Credentials Setup...</span>
          </div>
        </div>
      }
    >
      <StripeApiKeysForm embeddedInMarketplace={false} />
    </Suspense>
  );
}

