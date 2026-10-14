"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface AddItemsToStationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  station: {
    _id: Id<"stations">;
    name: string;
    isMain?: boolean;
    assignedItemCount?: number;
  } | null;
  organizationId?: Id<"organizations">;
  onSuccess?: (assignedCount: number) => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

export function AddItemsToStationDrawer({
  isOpen,
  onClose,
  station,
  organizationId,
  onSuccess,
  triggerRef,
}: AddItemsToStationDrawerProps) {
  // 1. Data queries
  const [selectedMenuId, setSelectedMenuId] = useState<Id<"menus"> | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  // Fetch real assignment and menu routing data from backend
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

  const updateAssignmentsMutation = useMutation(api.stations.updateStationItemAssignments);

  // 2. Initialize selection state when assignmentData is loaded
  const initialAssignedIds = assignmentData?.assignedItemIds;
  useEffect(() => {
    if (initialAssignedIds) {
      setSelectedItemIds(new Set(initialAssignedIds));
    }
  }, [initialAssignedIds]);

  // Reset or setup drawer state upon opening
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setErrorMsg(null);
      setIsSubmitting(false);

      // Auto-expand all categories by default for fast scanning
      if (assignmentData?.categories) {
        const initialExpanded: Record<string, boolean> = {};
        for (const cat of assignmentData.categories) {
          initialExpanded[cat._id] = true;
        }
        setExpandedCategories(initialExpanded);
      }

      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      if (triggerRef?.current) {
        triggerRef.current.focus();
      }
    }
  }, [isOpen, triggerRef]);

  // Handle Escape key to close drawer
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

  // Synchronize expanded categories when categories change
  useEffect(() => {
    if (assignmentData?.categories && Object.keys(expandedCategories).length === 0) {
      const exp: Record<string, boolean> = {};
      for (const cat of assignmentData.categories) {
        exp[cat._id] = true;
      }
      setExpandedCategories(exp);
    }
  }, [assignmentData?.categories, expandedCategories]);

  // 3. Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  // 4. Selection handlers
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
    if (errorMsg) setErrorMsg(null);
  };

  const handleSelectAllCategory = (categoryItemIds: string[]) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      for (const id of categoryItemIds) {
        next.add(id);
      }
      return next;
    });
    if (errorMsg) setErrorMsg(null);
  };

  const handleClearCategory = (categoryItemIds: string[]) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      for (const id of categoryItemIds) {
        next.delete(id);
      }
      return next;
    });
    if (errorMsg) setErrorMsg(null);
  };

  // 5. Filtered categories and items based on search
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

  // Auto-expand categories when user enters search query
  useEffect(() => {
    if (searchQuery.trim() && filteredCategories.length > 0) {
      const exp: Record<string, boolean> = {};
      for (const cat of filteredCategories) {
        exp[cat._id] = true;
      }
      setExpandedCategories((prev) => ({ ...prev, ...exp }));
    }
  }, [searchQuery, filteredCategories]);

  // 6. Submit assignments to Convex
  const handleSaveAssignments = async () => {
    if (!station?._id || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payloadItemIds = Array.from(selectedItemIds) as Id<"items">[];
      const res = await updateAssignmentsMutation({
        organizationId,
        stationId: station._id,
        assignedItemIds: payloadItemIds,
      });

      if (res.success) {
        onSuccess?.(payloadItemIds.length);
        onClose();
      }
    } catch (err: any) {
      console.error("Failed to update station assignments:", err);
      const cleanMsg = (err.message || "").replace(/^.*?Server Error\s*/i, "");
      setErrorMsg(cleanMsg || "Failed to save station item assignments. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currencySymbol = assignmentData?.currencySymbol || "₹";
  const totalAssignedCount = selectedItemIds.size;
  const totalEligibleCount = assignmentData?.totalEligibleItemsCount ?? 0;

  return (
    <>
      {/* Backdrop */}
      <div
        id="assign-items-backdrop"
        data-testid="assign-items-backdrop"
        onClick={() => {
          if (!isSubmitting) onClose();
        }}
        className={`fixed inset-0 bg-[#000000]/30 backdrop-blur-[2px] z-50 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <aside
        ref={drawerRef}
        id="assign-items-drawer"
        data-testid="assign-items-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-items-title"
        className={`fixed top-0 right-0 h-full w-full max-w-xl bg-[#ffffff] z-50 shadow-2xl transition-transform duration-300 flex flex-col justify-between border-l border-[#d0c4be]/40 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-6 bg-[#faf2ee] border-b border-[#e9e1dd] shrink-0">
          <div className="space-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#7f7570] block">
              KDS CONFIGURATION / {station?.name || "STATION"}
            </span>
            <h2
              id="assign-items-title"
              className="text-2xl lg:text-3xl font-garamond text-[#1e1b19] font-normal tracking-tight"
            >
              Add items to station
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close drawer"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#645d58] hover:text-[#1e1b19] hover:bg-[#eae1da] transition-colors focus:outline-none focus:ring-2 focus:ring-[#000000] cursor-pointer disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search, Filter & Assignment Summary Toolbar */}
        <div className="p-5 bg-[#faf2ee]/70 border-b border-[#e9e1dd] space-y-3.5 shrink-0">
          {/* Search Input */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#7f7570]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items or categories..."
              className="w-full pl-10 pr-10 py-2.5 bg-[#ffffff] text-[#1e1b19] placeholder:text-[#7f7570] rounded-full text-xs font-normal border border-[#d0c4be]/60 focus:outline-none focus:border-[#000000] focus:ring-1 focus:ring-[#000000] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#7f7570] hover:text-[#1e1b19] cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Menu Selector & Assignment Summary Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5">
            <div className="flex items-center gap-2">
              <label htmlFor="station-menu-select" className="text-xs font-semibold text-[#1e1b19] shrink-0">
                Select menu:
              </label>
              {assignmentData?.menus && assignmentData.menus.length > 0 ? (
                <select
                  id="station-menu-select"
                  value={selectedMenuId ?? assignmentData.selectedMenuId ?? ""}
                  onChange={(e) => setSelectedMenuId(e.target.value ? (e.target.value as Id<"menus">) : undefined)}
                  className="px-3 py-1.5 bg-[#ffffff] text-[#1e1b19] text-xs font-medium rounded-full border border-[#d0c4be]/70 focus:outline-none focus:border-[#000000] cursor-pointer"
                >
                  {assignmentData.menus.map((menu) => (
                    <option key={menu._id} value={menu._id}>
                      {menu.name} {menu.isDefault ? "(Default)" : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-[#645d58] font-medium">Standard Kitchen Menu</span>
              )}
            </div>

            {/* Assignment Summary Strip */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f4ece8] text-[#1e1b19] text-[11px] font-semibold self-start sm:self-auto border border-[#d0c4be]/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>
                {totalAssignedCount} / {totalEligibleCount} SKUs assigned
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Body: Categories and Item Checkboxes */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-[#1e1b19]">
          {/* Server Error Alert */}
          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-[#ffdad6]/60 border border-[#ba1a1a]/40 text-xs text-[#93000a] flex items-center gap-2"
            >
              <svg className="w-4 h-4 shrink-0 text-[#ba1a1a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
                <circle cx="12" cy="16" r="1" fill="currentColor" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Loading Skeleton */}
          {!assignmentData && (
            <div className="space-y-4 py-8">
              {[1, 2, 3].map((n) => (
                <div key={n} className="rounded-xl border border-[#d0c4be]/40 p-4 space-y-3 animate-pulse">
                  <div className="h-4 bg-[#f4ece8] rounded-md w-1/3" />
                  <div className="space-y-2">
                    <div className="h-10 bg-[#faf2ee] rounded-lg" />
                    <div className="h-10 bg-[#faf2ee] rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty Search Results */}
          {assignmentData && filteredCategories.length === 0 && (
            <div className="text-center py-12 px-4 space-y-2">
              <div className="w-10 h-10 rounded-full bg-[#f4ece8] text-[#7f7570] mx-auto flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-[#1e1b19]">No matching menu items found</h4>
              <p className="text-xs text-[#645d58] max-w-xs mx-auto">
                No items or categories matched &ldquo;{searchQuery}&rdquo;. Try another keyword or clear the search.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-2 text-xs font-semibold text-[#000000] underline cursor-pointer"
              >
                Clear search filter
              </button>
            </div>
          )}

          {/* Category Accordion */}
          {assignmentData &&
            filteredCategories.map((category) => {
              const isExpanded = expandedCategories[category._id] ?? true;
              const categoryItemIds = category.items.map((i) => i._id);
              const assignedInCatCount = categoryItemIds.filter((id) => selectedItemIds.has(id)).length;
              const isAllAssigned = categoryItemIds.length > 0 && assignedInCatCount === categoryItemIds.length;
              const isNoneAssigned = assignedInCatCount === 0;

              return (
                <div
                  key={category._id}
                  className="rounded-2xl border border-[#d0c4be]/40 bg-[#ffffff] overflow-hidden shadow-xs transition-shadow hover:shadow-sm"
                >
                  {/* Category Accordion Header */}
                  <div className="p-4 bg-[#faf2ee] border-b border-[#e9e1dd] flex items-center justify-between gap-3 select-none">
                    <button
                      type="button"
                      onClick={() => toggleCategory(category._id)}
                      className="flex items-center gap-2.5 text-left flex-1 cursor-pointer group"
                    >
                      <svg
                        className={`w-4 h-4 text-[#7f7570] transition-transform duration-200 group-hover:text-[#1e1b19] ${
                          isExpanded ? "rotate-90" : "rotate-0"
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                      <span className="font-semibold text-xs tracking-wider uppercase text-[#1e1b19]">
                        {category.name}
                      </span>
                      <span className="text-[11px] font-medium text-[#645d58] bg-[#eae1da] px-2 py-0.5 rounded-full">
                        {assignedInCatCount} / {category.items.length} assigned
                      </span>
                    </button>

                    {/* Category Quick Actions */}
                    <div className="flex items-center gap-2 shrink-0 text-xs">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectAllCategory(categoryItemIds);
                        }}
                        disabled={isAllAssigned}
                        className="px-2.5 py-1 text-[11px] font-semibold text-[#1e1b19] hover:underline disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        Select all
                      </button>
                      <span className="text-[#d0c4be]">|</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearCategory(categoryItemIds);
                        }}
                        disabled={isNoneAssigned}
                        className="px-2.5 py-1 text-[11px] font-semibold text-[#645d58] hover:underline disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>

                  {/* Expanded Items List */}
                  {isExpanded && (
                    <div className="p-3 space-y-1.5 divide-y divide-[#f4ece8]/80">
                      {category.items.length === 0 ? (
                        <p className="text-xs text-[#645d58] italic p-3 text-center">
                          No eligible dishes found in this category.
                        </p>
                      ) : (
                        category.items.map((item) => {
                          const isChecked = selectedItemIds.has(item._id);

                          return (
                            <label
                              key={item._id}
                              className={`flex items-start justify-between p-3 rounded-xl cursor-pointer transition-colors pt-2.5 pb-2.5 ${
                                isChecked
                                  ? "bg-[#faf2ee]/80 hover:bg-[#faf2ee]"
                                  : "bg-[#ffffff] hover:bg-[#f4ece8]/50"
                              }`}
                            >
                              <div className="flex items-start gap-3 min-w-0 pr-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleItem(item._id)}
                                  className="w-4 h-4 mt-0.5 accent-[#000000] rounded cursor-pointer shrink-0"
                                />
                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold text-[#1e1b19] truncate">
                                      {item.name}
                                    </span>
                                    {item.isVeg !== undefined && (
                                      <span
                                        title={item.isVeg ? "Vegetarian" : "Non-Vegetarian"}
                                        className={`w-2 h-2 rounded-full shrink-0 ${
                                          item.isVeg ? "bg-emerald-600" : "bg-red-600"
                                        }`}
                                      />
                                    )}
                                  </div>
                                  {item.description && (
                                    <p className="text-[11px] text-[#645d58] line-clamp-1">
                                      {item.description}
                                    </p>
                                  )}
                                  <div className="text-[11px] font-medium text-[#7f7570]">
                                    {currencySymbol}
                                    {(item.price / 100).toFixed(2)}
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0 text-right">
                                <span
                                  className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                                    isChecked
                                      ? "bg-[#000000] text-white"
                                      : "bg-[#f4ece8] text-[#7f7570]"
                                  }`}
                                >
                                  {isChecked ? "Routed" : "Unmapped"}
                                </span>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Drawer Sticky Footer */}
        <div className="p-6 bg-[#faf2ee] border-t border-[#e9e1dd] flex items-center justify-between shrink-0">
          <span className="text-xs text-[#645d58] font-medium">
            <strong>{totalAssignedCount}</strong> {totalAssignedCount === 1 ? "dish" : "dishes"} routed to station
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-full text-[#645d58] text-xs font-semibold hover:text-[#1e1b19] hover:bg-[#eae1da] transition-colors focus:outline-none focus:ring-2 focus:ring-[#000000] cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAssignments}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#000000] text-white text-xs font-semibold shadow-xs hover:bg-[#1d1b1a] transition-colors focus:outline-none focus:ring-2 focus:ring-[#000000] cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-1 h-3.5 w-3.5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  <span>Updating assignments...</span>
                </>
              ) : (
                <span>Confirm Assignments</span>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
