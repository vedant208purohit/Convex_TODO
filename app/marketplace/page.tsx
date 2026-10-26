import { Suspense } from "react";
import { Metadata } from "next";
import { MarketplaceView } from "../components/marketplace/MarketplaceView";

export const metadata: Metadata = {
  title: "Marketplace | PREST POS",
  description: "Browse, activate, and manage restaurant extensions and integrations.",
};

export default function MarketplacePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
            <span>Loading Marketplace...</span>
          </div>
        </div>
      }
    >
      <MarketplaceView />
    </Suspense>
  );
}

