"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import { PosShell } from "../../components/PosShell";
import { api } from "../../../convex/_generated/api";
import { DeadStockView } from "../../components/inventory/DeadStockView";

function DeadStockContent() {
  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;

  if (organizations === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-[#fbf9f8]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-stone-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-stone-500 font-medium">Loading Dead Stock...</p>
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
            Please select or set up an organization to access dead stock features.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#fbf9f8]">
      <DeadStockView organizationId={activeOrg._id} />
    </div>
  );
}

export default function DeadStockPage() {
  return (
    <PosShell title="Inventory" subtitle="Dead Stock">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center p-12 bg-[#fbf9f8]">
            <div className="w-8 h-8 border-2 border-stone-800 border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <DeadStockContent />
      </Suspense>
    </PosShell>
  );
}
