import { Suspense } from "react";
import { Metadata } from "next";
import { RazorpayApiKeysForm } from "../../../components/marketplace/RazorpayApiKeysForm";

export const metadata: Metadata = {
  title: "Connect Using API Keys | PREST Marketplace",
  description: "Securely link your Razorpay environment using API credentials.",
};

export default function RazorpayApiKeysPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading API Keys Setup...</span>
          </div>
        </div>
      }
    >
      <RazorpayApiKeysForm embeddedInMarketplace={false} />
    </Suspense>
  );
}

