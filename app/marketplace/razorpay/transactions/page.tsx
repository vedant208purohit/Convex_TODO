import { Suspense } from "react";
import { Metadata } from "next";
import { RazorpayTransactionsView } from "../../../components/marketplace/RazorpayTransactionsView";

export const metadata: Metadata = {
  title: "Razorpay Transactions | PREST Marketplace",
  description: "Monitor and manage all merchant-level payments.",
};

export default function RazorpayTransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Transactions...</span>
          </div>
        </div>
      }
    >
      <RazorpayTransactionsView embeddedInMarketplace={false} />
    </Suspense>
  );
}
