import { Suspense } from "react";
import { Metadata } from "next";
import { RazorpayOnboardingIntro } from "../../../components/marketplace/RazorpayOnboardingIntro";

export const metadata: Metadata = {
  title: "Create Or Connect Razorpay | PREST Marketplace",
  description: "Guided onboarding for new Razorpay merchant accounts.",
};

export default function RazorpayOnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Onboarding Introduction...</span>
          </div>
        </div>
      }
    >
      <RazorpayOnboardingIntro embeddedInMarketplace={false} />
    </Suspense>
  );
}

