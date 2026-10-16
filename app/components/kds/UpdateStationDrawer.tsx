"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface UpdateStationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  station: {
    _id: Id<"stations">;
    name: string;
    isMain?: boolean;
    legacyId?: string;
    assignedItemCount?: number;
  } | null;
  organizationId?: Id<"organizations">;
  existingStationNames?: string[];
  onSuccess?: (updatedName: string, assignedCount: number) => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

export function UpdateStationDrawer({
  isOpen,
  onClose,
  station,
  organizationId,
  existingStationNames = [],
  onSuccess,
  triggerRef,
}: UpdateStationDrawerProps) {
  // 1. Form and Filter State
  const [stationName, setStationName] = useState("");
  const [selectedMenuId, setSelectedMenuId] = useState<Id<"menus"> | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const menuDropdownRef = useRef<HTMLDivElement>(null);

  // 2. Fetch real station assignment & menu data
  const assignmentData = useQuery(
    api.stations.getStationAssignmentData,
    isOpen && station?._id
      ? {
          stationId: station._id,
          organizationId,
          menuId: selectedMenuId,
        }
      : "skip"
  );

  const updateStationWithAssignmentsMutation = useMutation(
    api.stations.updateStationWithAssignments
  );

  // 3. Initialize state from persisted station & assignments when opened or when data arrives
  const initialAssignedIds = assignmentData?.assignedItemIds;
  useEffect(() => {
    if (isOpen && station) {
      setStationName(station.name || "");
      setNameError(null);
      setServerError(null);
      setSearchQuery("");
      setIsSubmitting(false);
      setIsMenuDropdownOpen(false);

      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      if (triggerRef?.current) {
        triggerRef.current.focus();
      }
    }
  }, [isOpen, station, triggerRef]);

  // Sync loaded assignments into pending selection
  useEffect(() => {
    if (initialAssignedIds) {
      setSelectedItemIds(new Set(initialAssignedIds));
    }
  }, [initialAssignedIds]);

  // Synchronize expanded categories when categories load
  useEffect(() => {
    if (assignmentData?.categories && Object.keys(expandedCategories).length === 0) {
      const exp: Record<string, boolean> = {};
      // Expand the first category by default, others collapsed or based on assignments
      assignmentData.categories.forEach((cat, index) => {
        // Expand first 2 categories or categories with assignments
        const hasAssigned = cat.items.some((item) =>
          initialAssignedIds?.includes(item._id)
        );
        exp[cat._id] = index < 2 || hasAssigned;
      });
      setExpandedCategories(exp);
    }
  }, [assignmentData?.categories, expandedCategories, initialAssignedIds]);

  // Close menu dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuDropdownRef.current &&
        !menuDropdownRef.current.contains(e.target as Node)
      ) {
        setIsMenuDropdownOpen(false);
      }
    };
    if (isMenuDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isMenuDropdownOpen]);

  // Handle Escape key to dismiss drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // 4. Accordion Toggle
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  // 5. Item Selection Handlers
  const handleToggleItem = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
    if (serverError) setServerError(null);
  };

  const handleSelectAllCategory = (categoryItemIds: string[]) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      categoryItemIds.forEach((id) => next.add(id));
      return next;
    });
    if (serverError) setServerError(null);
  };

  const handleClearCategory = (categoryItemIds: string[]) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      categoryItemIds.forEach((id) => next.delete(id));
      return next;
    });
    if (serverError) setServerError(null);
  };

  // 6. Name Validation
  const validateStationName = (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) {
      return "Station name is required.";
    }

    // Check duplicate name within active stations (excluding current station's original name)
    const isDuplicate = existingStationNames.some(
      (existing) =>
        existing.trim().toLowerCase() === trimmed.toLowerCase() &&
        existing.trim().toLowerCase() !== station?.name.trim().toLowerCase()
    );

    if (isDuplicate) {
      return `Hey! ${trimmed} is already taken.`;
    }

    return null;
  };

  const handleNameChange = (val: string) => {
    setStationName(val);
    if (nameError) setNameError(null);
    if (serverError) setServerError(null);
  };

  // 7. Search and Menu Filtering
  const filteredCategories = useMemo(() => {
    if (!assignmentData?.categories) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return assignmentData.categories;

    return assignmentData.categories
      .map((cat) => {
        const catNameMatches = cat.name.toLowerCase().includes(query);
        const matchingItems = cat.items.filter(
          (item) =>
            catNameMatches ||
            item.name.toLowerCase().includes(query) ||
            (item.description && item.description.toLowerCase().includes(query)) ||
            (item.skuNumber && item.skuNumber.toLowerCase().includes(query))
        );

        return {
          ...cat,
          items: catNameMatches ? cat.items : matchingItems,
          hasMatch: catNameMatches || matchingItems.length > 0,
        };
      })
      .filter((cat) => cat.hasMatch);
  }, [assignmentData?.categories, searchQuery]);

  // Auto-expand categories matching search
  useEffect(() => {
    if (searchQuery.trim() && filteredCategories.length > 0) {
      const exp: Record<string, boolean> = {};
      filteredCategories.forEach((cat) => {
        exp[cat._id] = true;
      });
      setExpandedCategories((prev) => ({ ...prev, ...exp }));
    }
  }, [searchQuery, filteredCategories]);

  // 8. Dynamic Metrics Calculation
  const assignedItemsCount = selectedItemIds.size;

  // Count distinct categories that have at least 1 item in selectedItemIds
  const assignedCategoriesCount = useMemo(() => {
    if (!assignmentData?.categories) return 0;
    return assignmentData.categories.filter((cat) =>
      cat.items.some((item) => selectedItemIds.has(item._id))
    ).length;
  }, [assignmentData?.categories, selectedItemIds]);

  // Station identifier derivation
  const stationIdentifier = useMemo(() => {
    const rawLegacy = assignmentData?.station?.legacyId || station?.legacyId;
    if (rawLegacy) {
      return `KDS-ST-${String(rawLegacy).padStart(2, "0")}`;
    }
    if (station?._id) {
      return `KDS-ST-${station._id.slice(-6).toUpperCase()}`;
    }
    return "KDS-ST-02";
  }, [assignmentData?.station?.legacyId, station]);

  const currencySymbol = assignmentData?.currencySymbol || "₹";

  // Selected menu title
  const currentMenuTitle = useMemo(() => {
    if (!selectedMenuId) return "All Menus";
    const found = assignmentData?.menus?.find((m) => m._id === selectedMenuId);
    return found ? found.name : "All Menus";
  }, [selectedMenuId, assignmentData?.menus]);

  // 9. Save Update to Convex
  const handleUpdate = async () => {
    if (!station?._id || isSubmitting) return;

    const trimmed = stationName.trim();
    const error = validateStationName(trimmed);
    if (error) {
      setNameError(error);
      nameInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    setServerError(null);

    try {
      const payloadItemIds = Array.from(selectedItemIds) as Id<"items">[];
      const res = await updateStationWithAssignmentsMutation({
        organizationId,
        stationId: station._id,
        name: trimmed,
        assignedItemIds: payloadItemIds,
      });

      if (res.success) {
        onSuccess?.(res.name, res.totalAssigned);
        onClose();
      }
    } catch (err: any) {
      console.error("Failed to update station:", err);
      const cleanMsg = (err.message || "").replace(/^.*?Server Error\s*/i, "");
      setServerError(cleanMsg || "Failed to update station. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Warm Editorial Scrim Backdrop */}
      <div
        id="update-station-backdrop"
        data-testid="update-station-backdrop"
        onClick={() => {
          if (!isSubmitting) onClose();
        }}
        className={`fixed inset-0 bg-[#000000]/30 backdrop-blur-[2px] z-50 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* RIGHT-SIDE SLIDING DRAWER: Update Station */}
      <aside
        ref={drawerRef}
        id="update-station-drawer"
        data-testid="update-station-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-station-title"
        className={`fixed top-0 right-0 bottom-0 h-full w-full sm:w-[560px] md:w-[580px] bg-[#ffffff] z-50 shadow-2xl transition-transform duration-300 flex flex-col justify-between border-l border-[#d0c4be]/40 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="h-20 px-6 sm:px-8 flex items-center justify-between bg-[#faf2ee]/70 backdrop-blur-md border-b border-[#e9e1dd] shrink-0">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#7f7570]">
                Configuration Module
              </span>
              <span className="inline-block w-1 h-1 rounded-full bg-[#7f7570]" />
              <span className="text-[11px] font-medium text-[#645d58]">
                {stationIdentifier}
              </span>
            </div>
            <h2
              id="update-station-title"
              className="text-2xl font-garamond text-[#000000] tracking-tight font-normal"
            >
              Update station
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close drawer"
            title="Close Drawer"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-[#f4ece8] text-[#4d4541] hover:bg-[#eee7e3] hover:text-[#1e1b19] transition-colors cursor-pointer disabled:opacity-50"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-6">
          {/* Server Error Alert */}
          {serverError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-[#ffdad6]/60 border border-[#ba1a1a]/40 text-xs text-[#93000a] flex items-center gap-2"
            >
              <svg
                className="w-4 h-4 shrink-0 text-[#ba1a1a]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
                <circle cx="12" cy="16" r="1" fill="currentColor" />
              </svg>
              <span>{serverError}</span>
            </div>
          )}

          {/* Section 1: Station Details Card */}
          <div className="bg-[#faf2ee]/70 rounded-2xl p-5 sm:p-6 space-y-2.5 border border-[#e9e1dd] shadow-xs">
            <label
              htmlFor="station-name-input"
              className="block text-[11px] font-semibold uppercase tracking-wider text-[#1e1b19]"
            >
              Station name <span className="text-[#ba1a1a]">*</span>
            </label>
            <div className="relative">
              <input
                ref={nameInputRef}
                id="station-name-input"
                data-testid="station-name-input"
                type="text"
                value={stationName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. starter, Hot Line"
                disabled={isSubmitting}
                className={`w-full bg-[#ffffff] rounded-full px-5 py-2.5 text-base font-medium text-[#1e1b19] placeholder:text-[#7f7570] focus:outline-none focus:ring-2 focus:ring-[#000000] border transition-all shadow-xs ${
                  nameError ? "border-[#ba1a1a] ring-1 ring-[#ba1a1a]" : "border-[#d0c4be]/40"
                }`}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[#7f7570] pointer-events-none">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
                  />
                </svg>
              </div>
            </div>

            {nameError && (
              <p className="text-xs text-[#ba1a1a] font-medium pt-0.5">{nameError}</p>
            )}

            <p className="text-xs text-[#645d58] leading-relaxed">
              This label appears on physical KDS screens, captain folios, and expeditor prints.
            </p>
          </div>

          {/* Section 2: Assignment Summary Header & Metrics */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-garamond text-[#000000] font-normal">
                  Add items to station
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                    assignedItemsCount > 0
                      ? "bg-[#eae1da] text-[#1f1b17]"
                      : "bg-[#f4ece8] text-[#7f7570]"
                  }`}
                >
                  {assignedItemsCount > 0 ? "Routing active" : "Routing inactive"}
                </span>
              </div>
              <p className="text-xs text-[#645d58] mt-0.5">
                Control which menu items are routed to this{" "}
                <span className="font-medium text-[#1e1b19]">
                  {stationName.trim() || station?.name || "station"}
                </span>{" "}
                automatically upon firing.
              </p>
            </div>

            {/* Metric Badges Card */}
            <div className="bg-[#faf2ee] rounded-2xl p-4 space-y-3.5 border border-[#e9e1dd]">
              <div className="grid grid-cols-2 gap-3">
                {/* Metric 1: Assigned Items */}
                <div className="bg-[#ffffff] p-3 rounded-xl flex items-center gap-3 shadow-xs border border-[#d0c4be]/20">
                  <div className="w-8 h-8 rounded-full bg-[#000000] flex items-center justify-center text-white shrink-0">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] uppercase font-semibold text-[#7f7570] tracking-wider truncate">
                      Assigned items
                    </span>
                    <span
                      id="assigned-items-count"
                      data-testid="assigned-items-count"
                      className="text-sm font-semibold text-[#1e1b19]"
                    >
                      {assignedItemsCount} items
                    </span>
                  </div>
                </div>

                {/* Metric 2: Assigned Categories */}
                <div className="bg-[#ffffff] p-3 rounded-xl flex items-center gap-3 shadow-xs border border-[#d0c4be]/20">
                  <div className="w-8 h-8 rounded-full bg-[#eae1da] flex items-center justify-center text-[#1f1b17] shrink-0">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="3" width="7" height="7" rx="1.5" />
                      <rect x="14" y="3" width="7" height="7" rx="1.5" />
                      <rect x="3" y="14" width="7" height="7" rx="1.5" />
                      <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    </svg>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] uppercase font-semibold text-[#7f7570] tracking-wider truncate">
                      Assigned categories
                    </span>
                    <span
                      id="assigned-categories-count"
                      data-testid="assigned-categories-count"
                      className="text-sm font-semibold text-[#1e1b19]"
                    >
                      {assignedCategoriesCount} categories
                    </span>
                  </div>
                </div>
              </div>

              {/* Filters: Search and Menu Dropdown */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <div className="relative flex-1">
                  <svg
                    className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7f7570]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search item or category..."
                    className="w-full bg-[#ffffff] pl-9.5 pr-8 py-2 rounded-full text-xs text-[#1e1b19] placeholder:text-[#7f7570] focus:outline-none focus:ring-1 focus:ring-[#000000] border border-[#d0c4be]/30 shadow-xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7f7570] hover:text-[#1e1b19] p-0.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Menu Dropdown */}
                <div className="relative min-w-[140px]" ref={menuDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsMenuDropdownOpen((prev) => !prev)}
                    className="w-full bg-[#ffffff] px-4 py-2 rounded-full text-xs text-[#1e1b19] flex items-center justify-between shadow-xs border border-[#d0c4be]/30 hover:bg-[#faf2ee] transition-colors cursor-pointer"
                  >
                    <span className="font-medium truncate pr-1">{currentMenuTitle}</span>
                    <svg
                      className={`w-4 h-4 text-[#7f7570] shrink-0 transition-transform ${
                        isMenuDropdownOpen ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>

                  {isMenuDropdownOpen && (
                    <div className="absolute top-full right-0 mt-1 w-48 bg-[#ffffff] rounded-2xl shadow-xl border border-[#d0c4be]/40 py-1.5 z-20 max-h-56 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMenuId(undefined);
                          setIsMenuDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-xs transition-colors flex items-center justify-between ${
                          !selectedMenuId
                            ? "bg-[#faf2ee] font-semibold text-[#000000]"
                            : "text-[#1e1b19] hover:bg-[#f4ece8]"
                        }`}
                      >
                        <span>All Menus</span>
                        {!selectedMenuId && (
                          <svg className="w-3.5 h-3.5 text-[#000000]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        )}
                      </button>

                      {assignmentData?.menus?.map((m) => (
                        <button
                          key={m._id}
                          type="button"
                          onClick={() => {
                            setSelectedMenuId(m._id);
                            setIsMenuDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-xs transition-colors flex items-center justify-between ${
                            selectedMenuId === m._id
                              ? "bg-[#faf2ee] font-semibold text-[#000000]"
                              : "text-[#1e1b19] hover:bg-[#f4ece8]"
                          }`}
                        >
                          <span className="truncate">{m.name}</span>
                          {selectedMenuId === m._id && (
                            <svg className="w-3.5 h-3.5 text-[#000000]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Categories Accordion */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#7f7570]">
                Menu Categories Directory
              </span>
              <span className="text-xs text-[#645d58]">
                {filteredCategories.length} categories total
              </span>
            </div>

            {/* Loading Skeleton */}
            {!assignmentData && (
              <div className="space-y-3 py-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="rounded-2xl border border-[#d0c4be]/30 p-4 space-y-2.5 animate-pulse bg-white">
                    <div className="h-4 bg-[#f4ece8] rounded-md w-1/3" />
                    <div className="h-9 bg-[#faf2ee] rounded-xl" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty Search State */}
            {assignmentData && filteredCategories.length === 0 && (
              <div className="text-center py-10 px-4 space-y-2 bg-[#faf2ee]/50 rounded-2xl border border-[#e9e1dd]">
                <div className="w-10 h-10 rounded-full bg-[#f4ece8] text-[#7f7570] mx-auto flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <h4 className="text-sm font-semibold text-[#1e1b19]">No matching categories or items</h4>
                <p className="text-xs text-[#645d58] max-w-xs mx-auto">
                  No items matched &ldquo;{searchQuery}&rdquo;. Try another search keyword.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-1 text-xs font-semibold text-[#000000] underline cursor-pointer"
                >
                  Clear search
                </button>
              </div>
            )}

            {/* Categories List */}
            <div className="space-y-2">
              {assignmentData &&
                filteredCategories.map((category) => {
                  const isExpanded = expandedCategories[category._id] ?? false;
                  const categoryItemIds = category.items.map((i) => i._id);
                  const assignedCount = categoryItemIds.filter((id) =>
                    selectedItemIds.has(id)
                  ).length;
                  const totalCount = category.items.length;
                  const isAll = totalCount > 0 && assignedCount === totalCount;
                  const isPartial = assignedCount > 0 && assignedCount < totalCount;

                  return (
                    <div
                      key={category._id}
                      className="bg-[#ffffff] rounded-2xl shadow-xs border border-[#d0c4be]/30 overflow-hidden transition-all"
                    >
                      {/* Accordion Header Row */}
                      <button
                        type="button"
                        onClick={() => toggleCategory(category._id)}
                        className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors cursor-pointer ${
                          isExpanded ? "bg-[#faf2ee]/80" : "hover:bg-[#faf2ee]/50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <svg
                            className={`w-4 h-4 transition-transform duration-200 ${
                              isExpanded ? "rotate-90 text-[#000000]" : "rotate-0 text-[#7f7570]"
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                          </svg>
                          <span
                            className={`text-sm ${
                              isExpanded
                                ? "font-semibold text-[#000000]"
                                : "font-medium text-[#1e1b19]"
                            }`}
                          >
                            {category.name}
                          </span>
                        </div>

                        {/* Assignment Badge */}
                        <div className="flex items-center gap-2">
                          {isAll ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-[#000000] text-white text-[11px] font-semibold tracking-wide">
                              Full: {assignedCount} / {totalCount} assigned
                            </span>
                          ) : isPartial ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-[#eae1da] text-[#1e1b19] text-[11px] font-medium">
                              Partial: {assignedCount} / {totalCount} assigned
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-[#f4ece8] text-[#7f7570] text-[11px] font-medium">
                              0 / {totalCount} assigned
                            </span>
                          )}
                        </div>
                      </button>

                      {/* Expanded Section */}
                      {isExpanded && (
                        <div className="divide-y divide-[#f4ece8]">
                          {/* Bulk Actions Strip */}
                          <div className="px-4 py-2 bg-[#ffffff] flex items-center justify-between border-t border-[#e9e1dd]/60">
                            <span className="text-[11px] text-[#7f7570]">
                              All station items in this course
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectAllCategory(categoryItemIds);
                                }}
                                disabled={isAll}
                                className="text-[11px] text-[#000000] hover:underline font-medium disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                              >
                                [ Select all ]
                              </button>
                              <span className="text-[#d0c4be]">•</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleClearCategory(categoryItemIds);
                                }}
                                disabled={assignedCount === 0}
                                className="text-[11px] text-[#645d58] hover:underline font-medium disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                              >
                                [ Clear all ]
                              </button>
                            </div>
                          </div>

                          {/* Items List */}
                          <div className="p-3 space-y-1.5 bg-[#ffffff]">
                            {category.items.length === 0 ? (
                              <p className="text-xs text-[#7f7570] italic p-3 text-center">
                                No menu items in this category.
                              </p>
                            ) : (
                              category.items.map((item) => {
                                const isChecked = selectedItemIds.has(item._id);

                                return (
                                  <label
                                    key={item._id}
                                    onClick={() => handleToggleItem(item._id)}
                                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors group select-none ${
                                      isChecked
                                        ? "bg-[#faf2ee]/70 hover:bg-[#faf2ee]"
                                        : "hover:bg-[#faf2ee]/40"
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0 pr-2">
                                      {/* Checkmark circle */}
                                      <div
                                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                          isChecked
                                            ? "bg-[#000000] text-white"
                                            : "border border-[#d0c4be] group-hover:border-[#7f7570]"
                                        }`}
                                      >
                                        {isChecked && (
                                          <svg
                                            className="w-3.5 h-3.5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              d="m4.5 12.75 6 6 9-13.5"
                                            />
                                          </svg>
                                        )}
                                      </div>

                                      <div className="flex flex-col min-w-0">
                                        <span
                                          className={`text-xs font-medium truncate transition-colors ${
                                            isChecked
                                              ? "text-[#000000]"
                                              : "text-[#1e1b19] group-hover:text-[#000000]"
                                          }`}
                                        >
                                          {item.name}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Price and Optional Station / Course Tag */}
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-xs text-[#7f7570] font-mono">
                                        {currencySymbol}
                                        {(item.price / 100).toFixed(2)}
                                      </span>
                                      <span className="px-2 py-0.5 rounded-full bg-[#eae1da] text-[#1f1b17] text-[10px] font-medium tracking-wide">
                                        {category.name}
                                      </span>
                                    </div>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Drawer Footer (Sticky at bottom) */}
        <div className="h-20 px-6 sm:px-8 bg-[#ffffff] border-t border-[#e9e1dd] flex items-center justify-between shadow-lg shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#000000]" />
            <span className="text-xs text-[#1e1b19]">
              <strong className="font-semibold text-[#000000]">
                {assignedItemsCount} items
              </strong>{" "}
              assigned to{" "}
              <span className="font-medium">
                {stationName.trim() || station?.name || "Station"}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-full bg-[#faf2ee] hover:bg-[#eae1da] text-[#1e1b19] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              id="update-station-submit-btn"
              data-testid="update-station-submit-btn"
              onClick={handleUpdate}
              disabled={isSubmitting || !stationName.trim()}
              className="px-6 py-2.5 rounded-full bg-[#000000] hover:bg-[#1d1b1a] text-white text-xs font-semibold shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-2"
            >
              {isSubmitting && (
                <svg
                  className="w-3.5 h-3.5 animate-spin text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              Update
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
