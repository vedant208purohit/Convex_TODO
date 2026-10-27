import { Suspense } from "react";
import { MarketplaceAddMoneyView } from "../../../components/marketplace/MarketplaceAddMoneyView";

export const metadata = {
  title: "Add Money to Wallet | PREST Marketplace",
  description: "Fund your restaurant billing wallet for zero-surcharge marketplace purchases and SaaS subscriptions.",
};

export default function MarketplaceAddMoneyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
            <span>Loading Add Money...</span>
          </div>
        </div>
      }
    >
      <MarketplaceAddMoneyView />
    </Suspense>
  );
}
