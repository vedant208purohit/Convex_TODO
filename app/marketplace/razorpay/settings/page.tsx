import { Suspense } from "react";
import { Metadata } from "next";
import { RazorpaySettingsView } from "../../../components/marketplace/RazorpaySettingsView";

export const metadata: Metadata = {
  title: "Razorpay Settings | PREST Marketplace",
  description: "Manage your Razorpay account connection and payment preferences.",
};

export default function RazorpaySettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Settings...</span>
          </div>
        </div>
      }
    >
      <RazorpaySettingsView embeddedInMarketplace={false} />
    </Suspense>
  );
}

