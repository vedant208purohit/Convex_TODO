"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { PosShell } from "../components/PosShell";
import { api } from "../../convex/_generated/api";

import { ItemLibraryView } from "../components/inventory/ItemLibraryView";
import { SuppliersView } from "../components/inventory/SuppliersView";
import { PurchaseOrdersView } from "../components/inventory/PurchaseOrdersView";
import { ItemRecipesView } from "../components/inventory/ItemRecipesView";
import { DeadStockView } from "../components/inventory/DeadStockView";
import { StockLedgerView } from "../components/inventory/StockLedgerView";

function InventoryContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "purchaseOrders";

  // Query Organization
  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;

  if (organizations === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-[#fbf9f8]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-stone-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-stone-500 font-medium">Loading Inventory Portal...</p>
        </div>
      </div>
    );
  }

  if (!activeOrg) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-[#fbf9f8]">
        <div className="bg-white border border-[#e7e5e4] rounded-2xl p-8 max-w-md text-center shadow-xs">
          <h2 className="font-serif text-xl font-medium text-[#0c0a09]">No Active Organization</h2>
          <p className="text-xs text-[#78716c] mt-2">
            Please select or set up an organization to access inventory features.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#fbf9f8]">
      {activeTab === "purchaseOrders" && <PurchaseOrdersView organizationId={activeOrg._id} />}
      {activeTab === "suppliers" && <SuppliersView organizationId={activeOrg._id} />}
      {activeTab === "itemLibrary" && <ItemLibraryView organizationId={activeOrg._id} />}
      {activeTab === "deadStock" && <DeadStockView organizationId={activeOrg._id} />}
      {activeTab === "itemRecipes" && <ItemRecipesView organizationId={activeOrg._id} />}
      {activeTab === "stockLedger" && <StockLedgerView organizationId={activeOrg._id} />}
    </div>
  );
}

export default function InventoryPage() {
  return (
    <PosShell title="Inventory" subtitle="Management Portal">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center p-12 bg-[#fbf9f8]">
            <div className="w-8 h-8 border-2 border-stone-800 border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <InventoryContent />
      </Suspense>
    </PosShell>
  );
}
