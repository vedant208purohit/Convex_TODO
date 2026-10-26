"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { PosShell } from "../../components/PosShell";
import { Toast } from "../../components/Toast";

export default function ChefPrepPreferencesPage() {
  const organizations = useQuery(api.organizations.list);
  const organization = organizations && organizations.length > 0 ? organizations[0] : null;
  const organizationId = organization?._id;

  // Real-time Queries
  const preferences = useQuery(
    api.chefPrepPreferences.list,
    organizationId ? { organizationId } : "skip"
  );
  const metrics = useQuery(
    api.chefPrepPreferences.getMetrics,
    organizationId ? { organizationId } : "skip"
  );

  // Mutations
  const createPreferenceMutation = useMutation(api.chefPrepPreferences.create);
  const updatePreferenceMutation = useMutation(api.chefPrepPreferences.update);
  const deletePreferenceMutation = useMutation(api.chefPrepPreferences.deletePreference);
  const seedDefaultPreferencesMutation = useMutation(api.chefPrepPreferences.seedDefaultPreferences);

  // Auto-seed standard preferences if organization has none
  const hasAttemptedAutoSeed = useRef(false);
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedDefaults = async () => {
    if (!organizationId || isSeeding) return;
    try {
      setIsSeeding(true);
      const res = await seedDefaultPreferencesMutation({ organizationId });
      if (res && res.preferencesCount > 0) {
        showToast(
          `Linked ${res.preferencesCount} preferences to ${res.itemsCount ?? "all"} menu items!`,
          "success"
        );
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to initialize standard preferences.", "error");
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    if (organizationId && preferences && preferences.length === 0 && !hasAttemptedAutoSeed.current) {
      hasAttemptedAutoSeed.current = true;
      handleSeedDefaults();
    }
  }, [organizationId, preferences]);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Drawer & Modal States
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [editingPreference, setEditingPreference] = useState<{
    _id: Id<"chefPrepPreferences">;
    name: string;
    usedInItemCount: number;
  } | null>(null);
  const [editName, setEditName] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [targetDeletePreference, setTargetDeletePreference] = useState<{
    _id: Id<"chefPrepPreferences">;
    name: string;
    usedInItemCount: number;
    sampleItemNames?: string[];
  } | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // Active Dropdown Row ID
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" | "warning" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" | "info" | "warning" = "success") => {
    setToast({ message: msg, type });
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleWindowClick = () => setActiveDropdownId(null);
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  // Filter preferences by search
  const filteredPreferences = useMemo(() => {
    if (!preferences) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return preferences;
    return preferences.filter((p) => p.name.toLowerCase().includes(q));
  }, [preferences, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredPreferences.length / itemsPerPage));

  const paginatedPreferences = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredPreferences.slice(start, start + itemsPerPage);
  }, [filteredPreferences, currentPage]);

  // Handle Add Preference
  const handleOpenAdd = () => {
    setAddName("");
    setAddError(null);
    setIsAddDrawerOpen(true);
  };

  const handleCreateSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!organizationId) {
      setAddError("Store organization not loaded.");
      return;
    }
    const trimmed = addName.trim();
    if (!trimmed) {
      setAddError("Please enter a preference name.");
      return;
    }
    if (trimmed.length > 32) {
      setAddError("Preference name must be 32 characters or fewer.");
      return;
    }

    try {
      setIsSubmittingAdd(true);
      setAddError(null);
      await createPreferenceMutation({
        organizationId,
        name: trimmed,
      });
      setIsAddDrawerOpen(false);
      setAddName("");
      showToast(`Preference "${trimmed}" created successfully.`, "success");
    } catch (err: any) {
      const msg = err?.message || "Failed to create preference.";
      setAddError(msg.replace("Uncaught Error: ", ""));
      showToast(msg.replace("Uncaught Error: ", ""), "error");
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Handle Edit Preference
  const handleOpenEdit = (pref: {
    _id: Id<"chefPrepPreferences">;
    name: string;
    usedInItemCount: number;
  }) => {
    setEditingPreference(pref);
    setEditName(pref.name);
    setEditError(null);
    setIsEditDrawerOpen(true);
    setActiveDropdownId(null);
  };

  const handleUpdateSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingPreference) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError("Please enter a preference name.");
      return;
    }
    if (trimmed.length > 32) {
      setEditError("Preference name must be 32 characters or fewer.");
      return;
    }

    try {
      setIsSubmittingEdit(true);
      setEditError(null);
      await updatePreferenceMutation({
        id: editingPreference._id,
        name: trimmed,
      });
      setIsEditDrawerOpen(false);
      setEditingPreference(null);
      showToast(`Preference updated to "${trimmed}".`, "success");
    } catch (err: any) {
      const msg = err?.message || "Failed to update preference.";
      setEditError(msg.replace("Uncaught Error: ", ""));
      showToast(msg.replace("Uncaught Error: ", ""), "error");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handle Delete Preference
  const handleOpenDelete = (pref: {
    _id: Id<"chefPrepPreferences">;
    name: string;
    usedInItemCount: number;
  }) => {
    setTargetDeletePreference(pref);
    setIsDeleteModalOpen(true);
    setActiveDropdownId(null);
  };

  const handleDeleteConfirm = async () => {
    if (!targetDeletePreference) return;
    try {
      setIsSubmittingDelete(true);
      const res = await deletePreferenceMutation({
        id: targetDeletePreference._id,
      });
      setIsDeleteModalOpen(false);
      setTargetDeletePreference(null);
      showToast(
        `Deleted "${targetDeletePreference.name}"${res.unlinkedCount > 0 ? ` and unlinked from ${res.unlinkedCount} items` : ""
        }.`,
        "success"
      );
    } catch (err: any) {
      showToast(err?.message || "Failed to delete preference.", "error");
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  const isLoading = preferences === undefined || metrics === undefined;

  return (
    <PosShell title="Menu" subtitle="Chef Prep Preferences">
      <div className="flex-1 h-full overflow-y-auto bg-[#fff8f5] px-6 lg:px-10 pt-6 pb-32 text-[#1e1b19] font-sans">
        <div className="max-w-7xl mx-auto flex flex-col gap-6 pb-16">
          {/* Breadcrumbs & Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
            <div>
              <h1 className="font-garamond text-3xl md:text-4xl text-[#1e1b19] font-normal tracking-tight">
                Chef Prep Preferences
              </h1>
              <p className="text-sm text-[#645d58] mt-1">
                Create common preparation options that can be used while ordering items.
              </p>
            </div>

            {/* Actions: Search & Add Button */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <svg
                  className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7f7570]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="8" strokeWidth="2" />
                  <path d="m21 21-4.3-4.3" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search preference"
                  className="w-64 pl-10 pr-4 py-2 rounded-full bg-white border border-[#d0c4be]/60 text-sm text-[#1e1b19] placeholder:text-[#7f7570] focus:outline-none focus:ring-2 focus:ring-[#1e1b19]/20 shadow-xs transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setCurrentPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#7f7570] hover:text-[#1e1b19]"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleOpenAdd}
                style={{ color: "#ffffff", backgroundColor: "#000000" }}
                className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#000000] !text-white text-sm font-medium hover:bg-[#33302d] shadow-sm transition-all duration-150 cursor-pointer shrink-0"
              >
                <svg className="w-4 h-4 !text-white stroke-white" fill="none" stroke="#ffffff" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span className="!text-white font-medium" style={{ color: "#ffffff" }}>Add preference</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#e9e1dd] shadow-xs flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#645d58] uppercase tracking-wider">
                  Active Preferences
                </span>
                <span className="font-garamond text-3xl text-[#1e1b19] font-normal mt-1">
                  {isLoading ? "—" : metrics?.activePreferencesCount ?? 0}
                </span>
              </div>
              <div className="w-11 h-11 rounded-full bg-[#f4ece8] flex items-center justify-center text-[#1e1b19]">
                <span className="material-symbols-outlined text-[20px]">room_service</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#e9e1dd] shadow-xs flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#645d58] uppercase tracking-wider">
                  Linked Menu Items
                </span>
                <span className="font-garamond text-3xl text-[#1e1b19] font-normal mt-1">
                  {isLoading ? "—" : metrics?.linkedMenuItemsCount ?? 0}
                </span>
              </div>
              <div className="w-11 h-11 rounded-full bg-[#f4ece8] flex items-center justify-center text-[#1e1b19]">
                <span className="material-symbols-outlined text-[20px]">restaurant_menu</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#e9e1dd] shadow-xs flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#645d58] uppercase tracking-wider">
                  Kitchen Station Direct
                </span>
                <span className="font-garamond text-3xl text-[#1e1b19] font-normal mt-1">
                  {isLoading ? "—" : metrics?.stationDirect ?? "All Lines"}
                </span>
              </div>
              <div className="w-11 h-11 rounded-full bg-[#f4ece8] flex items-center justify-center text-[#1e1b19]">
                <span className="material-symbols-outlined text-[20px]">soup_kitchen</span>
              </div>
            </div>
          </div>

          {/* Table or Empty State */}
          {isLoading ? (
            <div className="w-full bg-white rounded-2xl border border-[#e9e1dd] p-12 text-center shadow-xs">
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-[#1e1b19] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium text-[#645d58]">Loading preferences...</span>
              </div>
            </div>
          ) : preferences.length === 0 ? (
            /* Scenario 7: Empty State */
            <div className="w-full flex flex-col items-center justify-center py-20 px-6 text-center bg-white rounded-3xl border border-[#e9e1dd] shadow-xs">
              <div className="w-20 h-20 rounded-full bg-[#faf2ee] flex items-center justify-center text-[#645d58] mb-6">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="font-garamond text-2xl md:text-3xl text-[#1e1b19] font-normal">
                No chef prep preferences yet
              </h2>
              <p className="text-sm text-[#645d58] max-w-md mt-2 mb-8">
                Create common options like No Onion, No Garlic, or Less Spicy so they can be offered during ordering.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={handleSeedDefaults}
                  disabled={isSeeding}
                  style={{ color: "#ffffff", backgroundColor: "#000000" }}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#000000] !text-white text-sm font-medium hover:bg-[#33302d] shadow-sm transition-all duration-150 cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4 !text-white stroke-white" fill="none" stroke="#ffffff" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="!text-white font-medium" style={{ color: "#ffffff" }}>
                    {isSeeding ? "Linking Preferences..." : "Generate & Link Common Preferences"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  style={{ color: "#1e1b19", backgroundColor: "#ffffff" }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-[#d0c4be] text-sm font-medium text-[#1e1b19] hover:bg-[#faf2ee] shadow-2xs transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>+ Custom Preference</span>
                </button>
              </div>
            </div>
          ) : (
            /* Scenario 1: Master Table View */
            <div className="w-full bg-white rounded-2xl border border-[#e9e1dd] shadow-xs overflow-hidden mb-6">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#faf2ee] text-[#645d58] text-xs font-semibold uppercase tracking-wider border-b border-[#e9e1dd]">
                      <th className="py-4 px-6" scope="col">
                        Preference Name
                      </th>
                      <th className="py-4 px-6" scope="col">
                        Used In Items
                      </th>
                      <th className="py-4 px-6 text-right" scope="col">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#faf2ee] text-sm text-[#1e1b19]">
                    {paginatedPreferences.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-12 text-center text-[#645d58]">
                          No preferences match &ldquo;{searchQuery}&rdquo;.
                        </td>
                      </tr>
                    ) : (
                      paginatedPreferences.map((pref, idx) => {
                        const isDropdownOpen = activeDropdownId === pref._id;
                        const isNearBottom = idx >= Math.max(1, paginatedPreferences.length - 2);

                        return (
                          <tr
                            key={pref._id}
                            className={`hover:bg-[#faf2ee]/50 transition-colors group relative ${isDropdownOpen ? "z-40" : "z-auto"
                              }`}
                          >
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <span className="w-2 h-2 rounded-full bg-[#1e1b19] shrink-0" />
                                <span className="font-medium text-[15px] text-[#1e1b19]">
                                  {pref.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f4ece8] text-xs font-medium text-[#645d58]">
                                {pref.usedInItemCount} {pref.usedInItemCount === 1 ? "item" : "items"}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <div className="relative inline-block text-left">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveDropdownId(isDropdownOpen ? null : pref._id);
                                  }}
                                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#f4ece8] text-[#645d58] transition-colors cursor-pointer"
                                  title="Actions"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <circle cx="12" cy="5" r="2" />
                                    <circle cx="12" cy="12" r="2" />
                                    <circle cx="12" cy="19" r="2" />
                                  </svg>
                                </button>

                                {isDropdownOpen && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className={`absolute right-0 w-36 bg-white rounded-2xl shadow-xl border border-[#e9e1dd] p-1.5 z-50 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100 ${isNearBottom
                                      ? "bottom-full mb-1 origin-bottom-right"
                                      : "top-full mt-1 origin-top-right"
                                      }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEdit(pref)}
                                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs font-medium text-[#1e1b19] hover:bg-[#f4ece8] transition-colors cursor-pointer"
                                    >
                                      <svg
                                        className="w-3.5 h-3.5 text-[#645d58]"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth="2"
                                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                        />
                                      </svg>
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenDelete(pref)}
                                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                    >
                                      <svg
                                        className="w-3.5 h-3.5 text-red-600"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth="2"
                                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                      </svg>
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary & Pagination Footer */}
              <div className="p-4 px-6 bg-white border-t border-[#e9e1dd] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#645d58] shrink-0">
                <span className="font-medium">
                  Showing {filteredPreferences.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(currentPage * itemsPerPage, filteredPreferences.length)} of {filteredPreferences.length} preferences
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-[#e9e1dd] bg-white text-[#1e1b19] hover:bg-[#faf2ee] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium transition-colors cursor-pointer"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        style={
                          pageNum === currentPage
                            ? { color: "#ffffff", backgroundColor: "#1e1b19" }
                            : undefined
                        }
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all cursor-pointer ${pageNum === currentPage
                          ? "bg-[#1e1b19] !text-white"
                          : "text-[#645d58] hover:bg-[#faf2ee]"
                          }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border border-[#e9e1dd] bg-white text-[#1e1b19] hover:bg-[#faf2ee] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium transition-colors cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scenario 2: Add Preference Drawer */}
      {isAddDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-[#1e1b19]/40 backdrop-blur-xs flex justify-end transition-opacity">
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col justify-between h-full animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-6 bg-[#faf2ee] border-b border-[#e9e1dd] flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                  New Modifier
                </span>
                <h2 className="font-garamond text-2xl text-[#1e1b19] font-normal mt-0.5">
                  Add Chef Prep Preference
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAddDrawerOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#f4ece8] text-[#645d58] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <form onSubmit={handleCreateSubmit} className="p-6 flex-1 overflow-y-auto flex flex-col gap-6">
              {addError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {addError}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[#1e1b19] flex items-center justify-between">
                  <span>
                    Preference name <span className="text-red-500">*</span>
                  </span>
                  <span className="text-[#7f7570] font-normal text-[11px]">
                    {addName.length}/32 chars
                  </span>
                </label>
                <input
                  type="text"
                  maxLength={32}
                  value={addName}
                  onChange={(e) => {
                    setAddName(e.target.value);
                    if (addError) setAddError(null);
                  }}
                  placeholder="e.g. No Onion, Less Spicy"
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-full bg-[#faf2ee] border border-[#d0c4be]/60 text-sm text-[#1e1b19] placeholder:text-[#7f7570] focus:outline-none focus:ring-2 focus:ring-[#1e1b19]/20 transition-all shadow-2xs"
                />
                <p className="text-xs text-[#645d58]">
                  Example: No Onion, No Garlic, Less Spicy, Well Done, 1 by 2
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#faf2ee] border border-[#e9e1dd] flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-[#645d58] shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <path d="M12 16v-4m0-4h.01" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <p className="text-xs text-[#645d58] leading-relaxed">
                  This preference will be available to link across your menu items during item setup. It instructs the prep station without altering inventory deductions or pricing structures.
                </p>
              </div>
            </form>

            {/* Drawer Footer */}
            <div className="p-6 bg-[#faf2ee] border-t border-[#e9e1dd] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAddDrawerOpen(false)}
                className="px-5 py-2 rounded-full text-xs font-medium text-[#645d58] hover:bg-[#f4ece8] hover:text-[#1e1b19] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingAdd || !addName.trim()}
                onClick={() => handleCreateSubmit()}
                style={{ color: "#ffffff", backgroundColor: "#000000" }}
                className="px-6 py-2 rounded-full text-xs font-medium bg-[#000000] !text-white hover:bg-[#33302d] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all duration-150 cursor-pointer"
              >
                <span className="!text-white font-medium" style={{ color: "#ffffff" }}>
                  {isSubmittingAdd ? "Creating..." : "Create preference"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scenario 3: Edit Preference Drawer */}
      {isEditDrawerOpen && editingPreference && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-[#1e1b19]/40 backdrop-blur-xs flex justify-end transition-opacity">
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col justify-between h-full animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-6 bg-[#faf2ee] border-b border-[#e9e1dd] flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                  Registry Update
                </span>
                <h2 className="font-garamond text-2xl text-[#1e1b19] font-normal mt-0.5">
                  Edit Chef Prep Preference
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsEditDrawerOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#f4ece8] text-[#645d58] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <form onSubmit={handleUpdateSubmit} className="p-6 flex-1 overflow-y-auto flex flex-col gap-6">
              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {editError}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[#1e1b19] flex items-center justify-between">
                  <span>
                    Preference name <span className="text-red-500">*</span>
                  </span>
                  <span className="text-[#7f7570] font-normal text-[11px]">
                    {editName.length}/32 chars
                  </span>
                </label>
                <input
                  type="text"
                  maxLength={32}
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    if (editError) setEditError(null);
                  }}
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-full bg-[#faf2ee] border border-[#d0c4be]/60 text-sm text-[#1e1b19] placeholder:text-[#7f7570] focus:outline-none focus:ring-2 focus:ring-[#1e1b19]/20 transition-all shadow-2xs"
                />
              </div>

              <div className="p-4 rounded-2xl bg-[#faf2ee] border border-[#e9e1dd] flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-[#645d58] shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-[#1e1b19]">Linked Synchronization</span>
                  <p className="text-xs text-[#645d58] mt-1 leading-relaxed">
                    Currently used in {editingPreference.usedInItemCount}{" "}
                    {editingPreference.usedInItemCount === 1 ? "menu item" : "menu items"}. Any name updates will automatically reflect on attached items and active kitchen prep queues.
                  </p>
                </div>
              </div>
            </form>

            {/* Drawer Footer */}
            <div className="p-6 bg-[#faf2ee] border-t border-[#e9e1dd] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditDrawerOpen(false)}
                className="px-5 py-2 rounded-full text-xs font-medium text-[#645d58] hover:bg-[#f4ece8] hover:text-[#1e1b19] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingEdit || !editName.trim()}
                onClick={() => handleUpdateSubmit()}
                style={{ color: "#ffffff", backgroundColor: "#000000" }}
                className="px-6 py-2 rounded-full text-xs font-medium bg-[#000000] !text-white hover:bg-[#33302d] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all duration-150 cursor-pointer"
              >
                <span className="!text-white font-medium" style={{ color: "#ffffff" }}>
                  {isSubmittingEdit ? "Saving..." : "Save changes"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scenario 4: Delete Confirmation Modal */}
      {isDeleteModalOpen && targetDeletePreference && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1e1b19]/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 md:p-8 flex flex-col gap-6 border border-[#e9e1dd] animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div className="flex flex-col">
                <h3 className="font-garamond text-2xl text-[#1e1b19] font-normal">
                  Delete &ldquo;{targetDeletePreference.name}&rdquo;?
                </h3>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-red-600 mt-0.5">
                  Irreversible Action
                </span>
              </div>
            </div>

            <p className="text-sm text-[#645d58] leading-relaxed">
              This preference will no longer be available for items using it. It is currently linked to{" "}
              <strong className="text-[#1e1b19]">{targetDeletePreference.usedInItemCount}</strong>{" "}
              {targetDeletePreference.usedInItemCount === 1 ? "item" : "items"} and will be removed from their customization choices.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-5 py-2 rounded-full text-xs font-medium text-[#645d58] hover:bg-[#f4ece8] hover:text-[#1e1b19] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingDelete}
                onClick={handleDeleteConfirm}
                style={{ color: "#ffffff", backgroundColor: "#dc2626" }}
                className="px-6 py-2 rounded-full text-xs font-medium bg-red-600 !text-white hover:bg-red-700 disabled:opacity-50 shadow-sm transition-all duration-150 cursor-pointer"
              >
                <span className="!text-white font-medium" style={{ color: "#ffffff" }}>
                  {isSubmittingDelete ? "Deleting..." : "Delete preference"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </PosShell>
  );
}
