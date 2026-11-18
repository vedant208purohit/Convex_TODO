import { Suspense } from "react";
import { Metadata } from "next";
import { StripeSettingsView } from "../../../components/marketplace/StripeSettingsView";

export const metadata: Metadata = {
  title: "Stripe Settings | PREST Restaurant Suite",
  description:
    "Manage your connected Stripe account and payment gateway configuration.",
};

export default function StripeSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Stripe Settings...</span>
          </div>
        </div>
      }
    >
      <StripeSettingsView embeddedInMarketplace={false} />
    </Suspense>
  );
}

