"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { PosShell } from "../components/PosShell";
import { CreateStationDrawer } from "../components/kds/CreateStationDrawer";
import { AddItemsToStationDrawer } from "../components/kds/AddItemsToStationDrawer";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export default function KdsStationDashboardPage() {
  const router = useRouter();
  const addStationBtnRef = useRef<HTMLButtonElement>(null);
  const emptyAddStationBtnRef = useRef<HTMLButtonElement>(null);

  // 1. Organization & Store Context
  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;

  // 2. Reactive Stations Query with Operational Summary Metrics
  const stations = useQuery(
    api.stations.list,
    activeOrg ? { organizationId: activeOrg._id, includeSummary: true } : "skip"
  );

  // 3. Deletion Mutation
  const deleteStationMutation = useMutation(api.stations.remove);

  // 4. Local State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDrawer, setActiveDrawer] = useState<null | "create" | "items" | "update">(null);
  const [selectedStation, setSelectedStation] = useState<any | null>(null);
  const [deleteConfirmStation, setDeleteConfirmStation] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [currentTime, setCurrentTime] = useState<string>("");

  // Live Clock effect
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Toast Helper
  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Filter Stations by Search Query
  const filteredStations = useMemo(() => {
    if (!stations) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return stations;

    return stations.filter((station: any, idx: number) => {
      const lineTag = station.isMain
        ? "station line 00 main expo"
        : `station line ${idx < 9 ? "0" + (idx + 1) : idx + 1}`;
      const nameMatch = station.name?.toLowerCase().includes(query);
      const lineMatch = lineTag.includes(query);
      const legacyMatch = station.legacyId?.toLowerCase().includes(query);
      const itemsMatch = station.sampleItems?.some((item: string) =>
        item.toLowerCase().includes(query)
      );
      const categoriesMatch = station.sampleCategories?.some((cat: string) =>
        cat.toLowerCase().includes(query)
      );
      return nameMatch || lineMatch || legacyMatch || itemsMatch || categoriesMatch;
    });
  }, [stations, searchQuery]);

  // Drawer Handlers
  const handleOpenCreateDrawer = () => {
    setSelectedStation(null);
    setActiveDrawer("create");
  };

  const handleOpenEditDrawer = (station: any) => {
    setSelectedStation(station);
    setActiveDrawer("update");
  };

  const handleOpenItemsDrawer = (station?: any) => {
    if (station) {
      setSelectedStation(station);
    } else if (!selectedStation && stations && stations.length > 0) {
      setSelectedStation(stations[0]);
    }
    setActiveDrawer("items");
  };

  const handleCloseDrawer = () => {
    setActiveDrawer(null);
  };

  // Station Deletion Handler
  const handleDeleteStation = async () => {
    if (!deleteConfirmStation) return;
    setIsDeleting(true);
    try {
      await deleteStationMutation({ id: deleteConfirmStation._id as Id<"stations"> });
      showToast(
        `Station "${deleteConfirmStation.name}" decommissioned. Active tickets rolled back to MAIN Expo.`,
        "success"
      );
      setDeleteConfirmStation(null);
      if (selectedStation?._id === deleteConfirmStation._id) {
        setSelectedStation(null);
      }
    } catch (err: any) {
      console.error("Failed to delete station:", err);
      showToast(err.message || "Failed to remove station", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // View Station Navigation
  const handleViewStation = (station: any) => {
    // Navigate to dedicated station viewport preserving store and station context
    router.push(`/kds/stations/${station._id}`);
  };

  return (
    <PosShell title="KDS" subtitle="Station Management">
      <div className="flex-1 min-h-0 overflow-y-auto bg-[#fff8f5] flex flex-col">
        {/* Top Bar with Live Network & Clock */}
        <div className="px-6 lg:px-8 py-3 bg-[#f4ece8] border-b border-[#e9e1dd] shrink-0 shadow-xs">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#7f7570]">
                Station Management Console
              </span>
              <span className="w-1 h-1 rounded-full bg-[#7f7570]" />
              <span className="text-xs text-[#645d58]">Terminal Routing Control</span>
            </div>

            <div className="flex items-center gap-4 text-xs text-[#645d58]">
              {currentTime && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#faf2ee] border border-[#d0c4be]/50 text-[#1e1b19] font-mono font-medium">
                  <svg className="w-3.5 h-3.5 text-[#7f7570]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth="2" />
                    <polyline points="12 6 12 12 16 14" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span>{currentTime}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-medium text-[#4d4541]">Kitchen Network: Synchronized</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="max-w-7xl w-full mx-auto px-6 lg:px-8 py-8 space-y-8 flex-1">
          {/* Header Row */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-[#7f7570]">
                  Brigade Console
                </span>
                <span className="w-1 h-1 rounded-full bg-[#7f7570]" />
                <span className="text-xs text-[#645d58]">Route Mapping</span>
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-garamond text-[#1e1b19] tracking-tight font-normal">
                Kitchen display system (KDS)
              </h1>
              <p className="text-base text-[#645d58]">
                Manage kitchen stations and control which menu items are prepared at each station.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                ref={addStationBtnRef}
                type="button"
                onClick={handleOpenCreateDrawer}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#000000] text-white font-medium text-sm shadow-xs hover:bg-[#1d1b1a] transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>Add station</span>
              </button>
            </div>
          </div>

          {/* Search & Total Active Counter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-[#7f7570]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stations..."
                className="w-full pl-11 pr-4 py-2.5 bg-[#ffffff] text-[#1e1b19] placeholder:text-[#7f7570] text-sm rounded-full border border-[#d0c4be]/60 shadow-xs focus:outline-none focus:border-[#000000] focus:ring-1 focus:ring-[#000000] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#7f7570] hover:text-[#1e1b19]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <span className="text-xs uppercase tracking-wider text-[#7f7570] font-medium">
                Total active lines:
              </span>
              <span className="px-3.5 py-1 rounded-full bg-[#f4ece8] text-xs font-semibold text-[#1e1b19] tabular-nums border border-[#d0c4be]/40">
                {stations === undefined ? "..." : `${stations.length} operational`}
              </span>
            </div>
          </div>

          {/* Loading State */}
          {stations === undefined && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="bg-[#ffffff] rounded-2xl p-6 border border-[#d0c4be]/40 shadow-xs animate-pulse space-y-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 w-2/3">
                      <div className="h-3 bg-[#eae1da] rounded-full w-24" />
                      <div className="h-6 bg-[#eae1da] rounded-md w-36" />
                      <div className="h-3 bg-[#eae1da] rounded-full w-28" />
                    </div>
                    <div className="h-6 bg-[#eae1da] rounded-full w-16" />
                  </div>
                  <div className="h-20 bg-[#f4ece8] rounded-xl" />
                  <div className="flex justify-between pt-4 border-t border-[#f4ece8]">
                    <div className="h-8 bg-[#eae1da] rounded-full w-16" />
                    <div className="h-8 bg-[#eae1da] rounded-full w-24" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State: No Stations Created */}
          {stations !== undefined && stations.length === 0 && (
            <div className="rounded-3xl border border-[#d0c4be]/40 bg-[#ffffff] p-12 text-center max-w-xl mx-auto shadow-xs space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#f4ece8] text-[#1e1b19] flex items-center justify-center mx-auto">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" x2="16" y1="21" y2="21" />
                  <line x1="12" x2="12" y1="17" y2="21" />
                </svg>
              </div>
              <h2 className="text-xl font-garamond font-semibold text-[#1e1b19]">
                No kitchen stations configured
              </h2>
              <p className="text-sm text-[#645d58] max-w-sm mx-auto">
                Set up your primary Expo / Pass or prep lines to route menu items and manage live kitchen tickets.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleOpenCreateDrawer}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#000000] text-white text-xs font-semibold shadow-xs hover:bg-[#1d1b1a] transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Create first station</span>
                </button>
              </div>
            </div>
          )}

          {/* Search Empty State */}
          {stations !== undefined && stations.length > 0 && filteredStations.length === 0 && (
            <div className="rounded-3xl border border-[#d0c4be]/40 bg-[#ffffff] p-10 text-center max-w-md mx-auto shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#f4ece8] text-[#7f7570] flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="8" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <h3 className="text-lg font-garamond font-semibold text-[#1e1b19]">
                No matching stations found
              </h3>
              <p className="text-xs text-[#645d58]">
                No kitchen stations match <span className="font-semibold text-[#1e1b19]">&ldquo;{searchQuery}&rdquo;</span>.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-2 inline-flex items-center px-4 py-1.5 rounded-full bg-[#f4ece8] text-xs font-semibold text-[#1e1b19] hover:bg-[#eae1da] transition-colors"
              >
                Clear filter
              </button>
            </div>
          )}

          {/* Stations Grid */}
          {filteredStations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="stations-grid">
              {filteredStations.map((station: any, index: number) => {
                const lineLabel = station.isMain
                  ? "STATION LINE 00"
                  : `STATION LINE ${index < 9 ? "0" + (index + 1) : index + 1}`;

                const operationalSubtitle = station.isMain
                  ? "Main / Expo Station"
                  : station.sampleCategories?.length > 0
                    ? `${station.sampleCategories.join(" & ")}`
                    : "Line Workstation";

                return (
                  <div
                    key={station._id}
                    className="station-card bg-[#ffffff] rounded-2xl p-6 border border-[#d0c4be]/40 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="space-y-4">
                      {/* Top Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <span className="text-[11px] font-semibold uppercase tracking-widest text-[#7f7570]">
                            {lineLabel}
                          </span>
                          <h2 className="text-xl font-garamond text-[#1e1b19] font-normal truncate tracking-tight uppercase">
                            {station.name}
                          </h2>
                          <p className="text-xs text-[#645d58] truncate">{operationalSubtitle}</p>
                        </div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#000000] text-white shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider">Active</span>
                          <span className="text-[10px] font-bold ml-0.5">{station.activeOrdersCount ?? 0}</span>
                        </div>
                      </div>

                      {/* Routing Rules Box */}
                      <div
                        onClick={() => handleOpenItemsDrawer(station)}
                        className="p-4 rounded-xl bg-[#faf2ee] border border-[#d0c4be]/30 space-y-1 cursor-pointer hover:bg-[#eae1da]/70 transition-colors"
                        title={`Manage assigned items for ${station.name}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] font-bold text-[#7f7570] uppercase tracking-wider">
                            Routing Rules
                          </div>
                          <span className="text-[10px] font-semibold text-[#645d58] hover:underline">
                            Edit →
                          </span>
                        </div>
                        <div className="text-sm text-[#1e1b19] font-medium leading-snug">
                          {station.isMain
                            ? "All kitchen menu items (Consolidated)"
                            : station.assignedItemCount > 0
                              ? `${station.assignedItemCount} items assigned${
                                  station.categoryCount > 0
                                    ? ` across ${station.categoryCount} categories`
                                    : ""
                                }`
                              : "No menu items assigned yet"}
                        </div>
                        <div className="text-xs text-[#645d58] line-clamp-1">
                          {station.isMain
                            ? station.hasPrinter
                              ? `Master fire printer active (${station.printerDetails?.url || "LAN"})`
                              : "Synchronized master fire ticket printer active"
                            : station.sampleItems?.length > 0
                              ? station.sampleItems.join(", ")
                              : station.hasPrinter
                                ? `Dedicated KOT printer active (${station.printerDetails?.url || "LAN"})`
                                : "Auto-routes ordered items to this kitchen line"}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="pt-5 mt-4 border-t border-[#f4ece8] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Manage menu items for ${station.name} station`}
                          title="Manage items"
                          onClick={() => handleOpenItemsDrawer(station)}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[#645d58] hover:text-[#1e1b19] hover:bg-[#f4ece8] transition-colors cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          aria-label={`Edit ${station.name} station`}
                          title="Edit station"
                          onClick={() => handleOpenEditDrawer(station)}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[#645d58] hover:text-[#1e1b19] hover:bg-[#f4ece8] transition-colors cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${station.name} station`}
                          title="Delete station"
                          onClick={() => setDeleteConfirmStation(station)}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[#645d58] hover:text-[#ba1a1a] hover:bg-[#ffdad6]/40 transition-colors cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                            />
                          </svg>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleViewStation(station)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#f4ece8] text-[#1e1b19] text-xs font-semibold hover:bg-[#eae1da] transition-colors cursor-pointer"
                      >
                        <span>View station</span>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Drawer Backdrop (for stub drawer Screen 4) */}
        <div
          id="drawer-backdrop"
          onClick={handleCloseDrawer}
          className={`fixed inset-0 bg-[#000000]/25 backdrop-blur-[2px] z-50 transition-opacity duration-300 ${
            activeDrawer === "update"
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
        />

        {/* Screen 2: Create Station Drawer */}
        <CreateStationDrawer
          isOpen={activeDrawer === "create"}
          onClose={handleCloseDrawer}
          organizationId={activeOrg?._id}
          existingStationNames={stations ? stations.map((s: any) => s.name) : []}
          onSuccess={(_id, name) => {
            showToast(`Station "${name}" created successfully.`, "success");
            setSelectedStation({ _id, name, isMain: false, assignedItemCount: 0 });
          }}
          triggerRef={addStationBtnRef}
        />

        {/* Screen 3: Add Items to Station Drawer */}
        <AddItemsToStationDrawer
          isOpen={activeDrawer === "items"}
          onClose={handleCloseDrawer}
          station={selectedStation}
          organizationId={activeOrg?._id}
          onSuccess={(count) => {
            showToast(
              `Updated menu items for ${selectedStation?.name || "station"} (${count} items routed).`,
              "success"
            );
          }}
        />

        {/* Screen 4: Update Station Drawer (Follow-up Screen Entry Point) */}
        <aside
          id="update-station-drawer"
          className={`fixed top-0 right-0 h-full w-full max-w-lg bg-[#ffffff] z-50 shadow-2xl transition-transform duration-300 flex flex-col justify-between border-l border-[#d0c4be]/40 ${
            activeDrawer === "update" ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-6 bg-[#faf2ee] border-b border-[#e9e1dd]">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#7f7570]">
                Station Specifications
              </span>
              <h3 className="text-2xl font-garamond text-[#1e1b19] font-normal" id="update-drawer-title">
                Update Station {selectedStation ? `— ${selectedStation.name}` : ""}
              </h3>
            </div>
            <button
              type="button"
              aria-label="Close drawer"
              onClick={handleCloseDrawer}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#645d58] hover:text-[#1e1b19] hover:bg-[#eae1da] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-[#1e1b19]">
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/60 text-xs text-amber-900 flex items-start gap-2.5">
              <svg className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="16" r="1" fill="currentColor" />
              </svg>
              <span>
                <strong>Screen 4 Entry Point:</strong> Station Update Drawer for station{" "}
                <span className="font-semibold underline">{selectedStation?.name}</span> (ID:{" "}
                <span className="font-mono text-[11px]">{selectedStation?._id}</span>) will be implemented in Screen 4.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1e1b19]">Display Title</label>
              <input
                type="text"
                disabled
                value={selectedStation?.name || ""}
                className="w-full px-4 py-2.5 bg-[#f4ece8] text-[#1e1b19] rounded-full text-sm border border-[#d0c4be]/40 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1e1b19]">Assigned Routing</label>
              <div className="p-4 rounded-xl bg-[#faf2ee] border border-[#d0c4be]/30 space-y-1">
                <div className="text-xs font-medium text-[#1e1b19]">
                  {selectedStation?.assignedItemCount ?? 0} active dishes mapped
                </div>
                <div className="text-[11px] text-[#645d58]">
                  Auto-route assigned items directly upon order placement.
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-[#faf2ee] border-t border-[#e9e1dd] flex items-center justify-between">
            {selectedStation && (
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmStation(selectedStation);
                  handleCloseDrawer();
                }}
                className="text-[#ba1a1a] hover:underline text-xs font-semibold cursor-pointer"
              >
                Delete Station
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={handleCloseDrawer}
                className="px-4 py-2 rounded-full text-[#645d58] text-xs font-semibold hover:bg-[#eae1da] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleCloseDrawer();
                  showToast("Station update entry point invoked.", "success");
                }}
                className="px-5 py-2 rounded-full bg-[#000000] text-white text-xs font-semibold shadow-xs hover:bg-[#1d1b1a] transition-colors cursor-pointer"
              >
                Update Station
              </button>
            </div>
          </div>
        </aside>

        {/* Deletion Confirmation Modal */}
        {deleteConfirmStation && (
          <div className="fixed inset-0 bg-[#000000]/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
            <div className="bg-[#ffffff] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#d0c4be]/40 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-garamond font-semibold text-[#1e1b19]">
                    Delete Station &ldquo;{deleteConfirmStation.name}&rdquo;?
                  </h3>
                  <p className="text-xs text-[#645d58]">Decommission preparation line</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#faf2ee] border border-[#d0c4be]/40 text-xs text-[#4d4541] space-y-1.5 leading-relaxed">
                <p>
                  Remove station <strong>&ldquo;{deleteConfirmStation.name}&rdquo;</strong> from kitchen line mapping?
                  Active tickets will roll back to MAIN Expo.
                </p>
                {deleteConfirmStation.activeOrdersCount > 0 && (
                  <p className="text-amber-800 font-medium">
                    ⚠️ Notice: This station has {deleteConfirmStation.activeOrdersCount} active ticket(s). Dependent item mappings will be soft-deleted and order history will be preserved.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteConfirmStation(null)}
                  className="px-4 py-2 rounded-full text-[#645d58] text-xs font-semibold hover:bg-[#f4ece8] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeleteStation}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#ba1a1a] text-white text-xs font-semibold shadow-xs hover:bg-[#93000a] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete Station"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Feedback Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 transform transition-all duration-300 pointer-events-none">
            <div
              className={`px-5 py-3 rounded-full shadow-lg flex items-center gap-2.5 text-xs font-medium text-white ${
                toastType === "error" ? "bg-[#ba1a1a]" : "bg-[#000000]"
              }`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                {toastType === "error" ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                )}
              </svg>
              <span>{toastMessage}</span>
            </div>
          </div>
        )}
      </div>
    </PosShell>
  );
}
