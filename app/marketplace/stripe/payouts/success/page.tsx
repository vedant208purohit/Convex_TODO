import { Suspense } from "react";
import { Metadata } from "next";
import { StripeWithdrawalSuccessView } from "../../../../components/marketplace/StripeWithdrawalSuccessView";

export const metadata: Metadata = {
  title: "Withdrawal Successful | PREST Restaurant Suite",
  description:
    "Your Stripe payout request has been successfully submitted.",
};

export default function StripeWithdrawalSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Payout Success...</span>
          </div>
        </div>
      }
    >
      <StripeWithdrawalSuccessView embeddedInMarketplace={false} />
    </Suspense>
  );
}

