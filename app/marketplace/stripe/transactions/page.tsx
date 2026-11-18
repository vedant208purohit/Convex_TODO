import { Suspense } from "react";
import { Metadata } from "next";
import { StripeTransactionsView } from "../../../components/marketplace/StripeTransactionsView";

export const metadata: Metadata = {
  title: "Payment Transactions | PREST Restaurant Suite",
  description:
    "View payments received for your dine-in, takeaway, delivery and other supported restaurant orders.",
};

export default function StripeTransactionsPage() {
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
      <StripeTransactionsView embeddedInMarketplace={false} />
    </Suspense>
  );
}

