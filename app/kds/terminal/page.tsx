"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { KdsTerminalView } from "../../components/kds/KdsTerminalView";
import { api } from "../../../convex/_generated/api";

export default function KdsTerminalRoutePage() {
  const router = useRouter();

  // 1. Organization Context
  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;

  // 2. Fetch Active Stations
  const stations = useQuery(
    api.stations.list,
    activeOrg ? { organizationId: activeOrg._id } : "skip"
  );

  if (stations === undefined || activeOrg === undefined) {
    return (
      <div className="min-h-screen bg-[#f7f6f4] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-stone-300 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  // Find expo station or first station
  const targetStation =
    stations?.find((s) => s.isMain) || (stations && stations.length > 0 ? stations[0] : null);

  if (!targetStation) {
    return (
      <div className="min-h-screen bg-[#f7f6f4] flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl border border-[#e7e5e4] text-center space-y-4 max-w-md shadow-xs">
          <h2 className="text-xl font-bold text-[#1c1917]">No Active Stations Found</h2>
          <p className="text-xs text-stone-600">
            Please configure at least one kitchen station in KDS Station Management before opening the terminal.
          </p>
          <div>
            <button
              type="button"
              onClick={() => router.push("/kds")}
              className="px-5 py-2.5 rounded-full bg-black text-white text-xs font-semibold"
            >
              Go to Station Management
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <KdsTerminalView
      stationId={targetStation._id}
      organizationId={activeOrg?._id}
      onBack={() => router.push("/kds")}
    />
  );
}
