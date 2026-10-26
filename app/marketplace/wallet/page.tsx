import { Suspense } from "react";
import { MarketplaceWalletView } from "../../components/marketplace/MarketplaceWalletView";

export const metadata = {
  title: "Billing Wallet | PREST Marketplace",
  description: "Manage your PREST restaurant marketplace billing wallet balance, top-ups, and transaction history.",
};

export default function MarketplaceWalletPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
            <span>Loading Marketplace Wallet...</span>
          </div>
        </div>
      }
    >
      <MarketplaceWalletView />
    </Suspense>
  );
}
