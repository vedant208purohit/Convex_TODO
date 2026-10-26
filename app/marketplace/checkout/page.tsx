import { Suspense } from "react";
import { MarketplaceCheckoutView } from "../../components/marketplace/MarketplaceCheckoutView";

export const metadata = {
  title: "Order Verification & Wallet Audit | PREST Marketplace",
  description: "Verify order specification and authorize PREST Escrow Wallet allocation.",
};

export default function MarketplaceCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
            <span>Loading order verification...</span>
          </div>
        </div>
      }
    >
      <MarketplaceCheckoutView />
    </Suspense>
  );
}
