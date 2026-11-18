import { Suspense } from "react";
import { Metadata } from "next";
import { StripeDashboardView } from "../../../components/marketplace/StripeDashboardView";

export const metadata: Metadata = {
  title: "Stripe Payments Dashboard | PREST Restaurant Suite",
  description:
    "Monitor payments received through your restaurant and manage payment activity from Prest.",
};

export default function StripeDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Stripe Payments...</span>
          </div>
        </div>
      }
    >
      <StripeDashboardView embeddedInMarketplace={false} />
    </Suspense>
  );
}

