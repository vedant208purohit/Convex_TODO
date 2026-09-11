"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

// ==========================================
// PIXEL-PERFECT PREST POS SVG ICONS
// ==========================================

function PlusIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EditIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertCircleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}

function InfoIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CreditCardOffIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Helper: Format creation date
function formatDate(timestamp?: number): string {
  if (!timestamp) return "Aug 10, 2026";
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

// Helper: Code slug based on name
function getCodeSlug(name: string): string {
  const upper = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "_");
  if (upper.includes("CASH")) return "CODE: CASH_DEFAULT";
  if (upper.includes("CREDIT")) return "CODE: CC_GATEWAY";
  if (upper.includes("DEBIT")) return "CODE: DEBIT_DIRECT";
  if (upper.includes("UPI") || upper.includes("QR")) return "CODE: UPI_INSTANT";
  if (upper.includes("ROOM")) return "CODE: HOTEL_PMS_ROOM";
  return `CODE: ${upper.slice(0, 12)}_MODE`;
}

interface PaymentModeDoc {
  _id: Id<"paymentModes">;
  name: string;
  active: boolean;
  createdAt: number;
}

export function OrganizationPaymentModes() {
  // ------------------------------------------
  // CONVEX HOOKS & AUTH SAFEGUARDS
  // ------------------------------------------
  const paymentModesRaw = useQuery(api.organizationPaymentModes.list);
  const isLoading = paymentModesRaw === undefined;
  const paymentModes = useMemo(() => paymentModesRaw || [], [paymentModesRaw]);

  const createMode = useMutation(api.organizationPaymentModes.create);
  const updateMode = useMutation(api.organizationPaymentModes.update);
  const toggleActiveMode = useMutation(api.organizationPaymentModes.toggleActive);
  const removeMode = useMutation(api.organizationPaymentModes.remove);

  // ------------------------------------------
  // LOCAL UI STATES
  // ------------------------------------------
  const [searchQuery, setSearchQuery] = useState("");

  // Toast Banner State
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
    subtext?: string;
  } | null>(null);

  // Drawer Modal State (Add or Edit)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PaymentModeDoc | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    active: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirmation Dialog State
  const [deletingItem, setDeletingItem] = useState<PaymentModeDoc | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = (text: string, type: "success" | "error" = "success", subtext?: string) => {
    setToast({ text, type, subtext });
  };

  const closeToast = () => setToast(null);

  // Metrics summary calculations
  const activeCount = useMemo(() => paymentModes.filter((m) => m.active).length, [paymentModes]);
  const disabledCount = useMemo(() => paymentModes.filter((m) => !m.active).length, [paymentModes]);
  const totalCount = paymentModes.length;

  // Filtered payment modes
  const filteredModes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return paymentModes;
    return paymentModes.filter((m) => m.name.toLowerCase().includes(query));
  }, [paymentModes, searchQuery]);

  // Duplicate name validation check for drawer
  const nameError = useMemo(() => {
    const trimmed = formData.name.trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();

    const isDuplicate = paymentModes.some((m) => {
      if (editingItem && m._id === editingItem._id) return false;
      return m.name.trim().toLowerCase() === lower;
    });

    if (isDuplicate) {
      return `Hey! ${trimmed} is already taken.`;
    }
    return null;
  }, [formData.name, editingItem, paymentModes]);

  // ------------------------------------------
  // DRAWER HANDLERS
  // ------------------------------------------
  const handleOpenAddDrawer = () => {
    setEditingItem(null);
    setFormData({ name: "", active: true });
    setIsDrawerOpen(true);
  };

  const handleOpenEditDrawer = (item: PaymentModeDoc) => {
    setEditingItem(item);
    setFormData({ name: item.name, active: item.active });
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    if (isSaving) return;
    setIsDrawerOpen(false);
    setEditingItem(null);
  };

  const handleSaveDrawer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || nameError || isSaving) return;

    setIsSaving(true);
    try {
      if (editingItem) {
        await updateMode({
          id: editingItem._id,
          name: formData.name.trim(),
          active: formData.active,
        });
        showToast(
          `Successfully updated ${formData.name.trim()} payment mode.`,
          "success",
          "Changes sync in real-time across active Cashier POS terminals."
        );
      } else {
        await createMode({
          name: formData.name.trim(),
          active: formData.active,
        });
        showToast(
          `Successfully created ${formData.name.trim()} payment mode.`,
          "success",
          "New payment mode is now available for cashier checkout."
        );
      }
      setIsDrawerOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      showToast(err.message || "Failed to save payment mode", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // ------------------------------------------
  // TOGGLE ACTIVE HANDLER
  // ------------------------------------------
  const handleToggleActive = async (item: PaymentModeDoc) => {
    const nextActive = !item.active;
    try {
      await toggleActiveMode({
        id: item._id,
        active: nextActive,
      });
      showToast(
        `Successfully ${nextActive ? "Published" : "Unpublished"} ${item.name} Payment Mode`,
        "success",
        nextActive ? `${item.name} is now visible on Cashier.` : `${item.name} is hidden from Cashier.`
      );
    } catch (err: any) {
      showToast(err.message || "Failed to toggle payment mode status", "error");
    }
  };

  // ------------------------------------------
  // DELETE HANDLERS
  // ------------------------------------------
  const handleConfirmDelete = async () => {
    if (!deletingItem || isDeleting) return;

    setIsDeleting(true);
    try {
      await removeMode({ id: deletingItem._id });
      showToast(
        `Successfully deleted ${deletingItem.name} payment mode.`,
        "success"
      );
      setDeletingItem(null);
    } catch (err: any) {
      showToast(err.message || "Failed to delete payment mode", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden select-none font-sans">
      {/* Subtle Toast Notification Hint Banner */}
      {toast && (
        <div
          className={`flex items-center justify-between px-4 py-2.5 mb-3 rounded-lg border shadow-sm transition-all shrink-0 ${
            toast.type === "success"
              ? "bg-white border-[#eadfd6]"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === "success" ? (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            ) : (
              <AlertCircleIcon className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <p className="text-xs text-[#141010] font-medium">
              <span className={`font-semibold ${toast.type === "success" ? "text-emerald-800" : "text-rose-800"}`}>
                {toast.type === "success" ? "Changes synchronized:" : "Error:"}
              </span>{" "}
              {toast.text}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {toast.subtext && (
              <span className="text-[11px] text-[#5e5e5e] hidden sm:inline">{toast.subtext}</span>
            )}
            <button
              type="button"
              onClick={closeToast}
              className="text-neutral-400 hover:text-[#141010] text-xs font-semibold px-1"
              aria-label="Dismiss toast"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Page Title Bar (Fixed Header) */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e7e5e4]/60">
        <div>
          <h1 className="font-garamond text-[30px] font-normal tracking-tight text-[#141010] leading-none">
            Payment
          </h1>
          <p className="font-sans text-sm text-[#5e5e5e] mt-1.5 leading-normal">
            Manage payment methods available across your PREST POS terminals and dining checkout channels.
          </p>
        </div>
        {/* Add Payment Mode Button */}
        <div>
          <button
            type="button"
            onClick={handleOpenAddDrawer}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0c0a09] text-white text-xs font-semibold hover:bg-neutral-800 active:scale-[0.98] transition-all shadow-sm cursor-pointer border border-[#0c0a09]"
          >
            <PlusIcon className="w-3.5 h-3.5 text-white" />
            <span className="text-white font-semibold">Add payment mode</span>
          </button>
        </div>
      </div>

      {/* Main Scrollable Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto pt-4 pb-8 pr-2 space-y-6">
        {/* Metric Summary Cards */}
        <section aria-label="Payment modes summary statistics" className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Metric 1: Active Methods */}
          <article className="bg-[#ffffff] border border-[#eadfd6] rounded-xl p-4 flex items-center justify-between min-w-0">
            <div className="min-w-0 pr-2">
              <p className="text-[11px] font-medium tracking-wide uppercase text-[#5e5e5e] truncate">Active Methods</p>
              <p className="font-garamond text-3xl font-medium text-[#141010] mt-0.5">{isLoading ? "..." : activeCount}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/50 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
              Ready at POS
            </span>
          </article>

          {/* Metric 2: Disabled Methods */}
          <article className="bg-[#ffffff] border border-[#eadfd6] rounded-xl p-4 flex items-center justify-between min-w-0">
            <div className="min-w-0 pr-2">
              <p className="text-[11px] font-medium tracking-wide uppercase text-[#5e5e5e] truncate">Disabled Methods</p>
              <p className="font-garamond text-3xl font-medium text-[#141010] mt-0.5">{isLoading ? "..." : disabledCount}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-600 border border-neutral-200 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400"></span>
              Hidden
            </span>
          </article>

          {/* Metric 3: Total Configured */}
          <article className="bg-[#ffffff] border border-[#eadfd6] rounded-xl p-4 flex items-center justify-between min-w-0">
            <div className="min-w-0 pr-2">
              <p className="text-[11px] font-medium tracking-wide uppercase text-[#5e5e5e] truncate">Total Configured</p>
              <p className="font-garamond text-3xl font-medium text-[#141010] mt-0.5">{isLoading ? "..." : totalCount}</p>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-stone-100 text-stone-700 border border-stone-200 shrink-0">
              All Terminals
            </span>
          </article>
        </section>

      {/* Main Payment Modes Table Card */}
      <section aria-labelledby="modes-heading" className="bg-[#ffffff] border border-[#eadfd6] rounded-xl shadow-none overflow-hidden">
        {/* Card Header & Live Search Bar */}
        <div className="p-6 pb-4 border-b border-[#e7e5e4] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-garamond text-[22px] font-medium text-[#141010]" id="modes-heading">
              Payment modes
            </h2>
            <p className="font-sans text-xs text-[#5e5e5e] mt-0.5">
              Control which payment methods are available to cashiers during checkout.
            </p>
          </div>
          {/* Search Controls */}
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                <SearchIcon className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search payment modes..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#141010] focus:border-[#141010] placeholder-neutral-400 transition"
              />
            </div>
            <span className="text-xs text-[#5e5e5e] whitespace-nowrap">
              Showing {filteredModes.length} methods
            </span>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50/60 border-b border-[#e7e5e4] text-[#5e5e5e] font-semibold uppercase tracking-wider text-[11px]">
                <th scope="col" className="py-3 px-6">PAYMENT MODE</th>
                <th scope="col" className="py-3 px-6">CASHIER AVAILABILITY</th>
                <th scope="col" className="py-3 px-6">CREATED</th>
                <th scope="col" className="py-3 px-6 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7e5e4] text-[#141010]">
              {isLoading ? (
                // Loading Skeleton Rows
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-6">
                      <div className="h-4 bg-neutral-200 rounded w-28 mb-1"></div>
                      <div className="h-3 bg-neutral-100 rounded w-20"></div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="h-5 bg-neutral-200 rounded-full w-10"></div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="h-3 bg-neutral-200 rounded w-24"></div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="h-4 bg-neutral-200 rounded w-12 ml-auto"></div>
                    </td>
                  </tr>
                ))
              ) : filteredModes.length === 0 ? (
                // Empty State Row
                <tr>
                  <td colSpan={4} className="py-12 text-center text-[#5e5e5e]">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <CreditCardOffIcon className="w-10 h-10 text-neutral-300" />
                      <p className="font-garamond text-xl font-medium text-[#141010]">No payment modes found</p>
                      <p className="text-xs text-[#5e5e5e]">
                        {searchQuery ? `No methods match "${searchQuery}".` : "Add a payment mode to enable settlement options."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredModes.map((mode) => (
                  <tr key={mode._id} className="hover:bg-stone-50/40 transition-colors">
                    <td className="py-4 px-6 font-medium">
                      <div>
                        <span className={`font-medium text-sm ${mode.active ? "text-[#141010]" : "text-neutral-600"}`}>
                          {mode.name}
                        </span>
                        <span className="block text-[11px] text-[#5e5e5e] font-mono mt-0.5">
                          {getCodeSlug(mode.name)}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={mode.active}
                            onChange={() => handleToggleActive(mode)}
                            aria-label={`Toggle ${mode.name} cashier availability`}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-5 bg-[#e7e5e4] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-200 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10b981]"></div>
                        </label>
                        <div className="leading-tight">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-[#141010] font-medium">Show on Cashier</span>
                            <span className={`text-[11px] font-bold uppercase tracking-wide ${mode.active ? "text-emerald-700" : "text-neutral-400"}`}>
                              {mode.active ? "On" : "Off"}
                            </span>
                          </div>
                          <span className={`text-[11px] font-medium ${mode.active ? "text-emerald-600" : "text-[#8a7e75]"}`}>
                            {mode.active ? "Shown on Cashier" : "Hidden from Cashier"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-[#5e5e5e] font-sans">
                      {formatDate(mode.createdAt)}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditDrawer(mode)}
                          title={`Edit ${mode.name}`}
                          aria-label={`Edit ${mode.name}`}
                          className="p-1.5 text-neutral-400 hover:text-[#141010] hover:bg-neutral-100 rounded-md transition-colors cursor-pointer"
                        >
                          <EditIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingItem(mode)}
                          title={`Delete ${mode.name}`}
                          aria-label={`Delete ${mode.name}`}
                          className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Synchronization Note */}
        <div className="p-4 bg-[#fbf9f8] border-t border-[#e7e5e4] text-[11px] text-[#5e5e5e] flex items-start sm:items-center gap-2">
          <InfoIcon className="w-4 h-4 text-stone-400 flex-shrink-0 mt-0.5 sm:mt-0" />
          <span>
            Changes sync in real-time across active Cashier POS terminals. Historical orders retain recorded payment method attribution.
          </span>
        </div>
      </section>
      </div>

      {/* Slide-over Right Drawer Overlay for Add/Edit */}
      {isDrawerOpen && (
        <>
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-black/45 backdrop-blur-[1px] z-40 transition-opacity"
            onClick={handleCloseDrawer}
            aria-hidden="true"
          />

          {/* Right Drawer Panel */}
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
            className="fixed top-0 right-0 bottom-0 w-[440px] max-w-full bg-white border-l border-[#e7e5e4] shadow-2xl z-50 flex flex-col justify-between"
          >
            {/* Drawer Header */}
            <header className="p-6 border-b border-[#e7e5e4] bg-white relative shrink-0">
              <button
                type="button"
                onClick={handleCloseDrawer}
                aria-label="Close drawer"
                className="absolute top-6 right-6 text-[#8a7e75] hover:text-[#141010] p-1.5 rounded-full hover:bg-[#f5f2f0] transition-colors focus:outline-none"
              >
                <XIcon className="w-5 h-5" />
              </button>
              {editingItem && (
                <span className="inline-block text-[10px] font-bold tracking-wider uppercase text-[#8a7e75] font-sans mb-1">
                  EDITING ID: {editingItem._id.slice(-6).toUpperCase()}
                </span>
              )}
              <h2 id="drawer-title" className="font-garamond text-[26px] font-normal text-[#141010] leading-tight">
                {editingItem ? "Edit payment mode" : "Add payment mode"}
              </h2>
              <p className="font-sans text-[13px] text-[#5e5e5e] mt-1.5 leading-relaxed pr-6">
                {editingItem
                  ? "Modify payment method details and cashier terminal availability."
                  : "Create a payment method that cashiers can use during settlement."}
              </p>
            </header>

            {/* Drawer Body Form */}
            <form onSubmit={handleSaveDrawer} className="flex-1 p-6 space-y-6 overflow-y-auto bg-white">
              {/* Field 1: PAYMENT MODE NAME */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="payment-mode-name" className="block font-sans text-[11px] font-semibold tracking-wide uppercase text-[#5e5e5e]">
                    Payment mode name <span className="text-[#dc2626] font-bold">*</span>
                  </label>
                  {editingItem && (
                    <span className="text-[10px] text-[#8a7e75] font-medium uppercase tracking-wider">Required</span>
                  )}
                </div>

                <div className="relative">
                  <input
                    id="payment-mode-name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter payment mode name"
                    className={`w-full rounded-lg border px-4 py-3 text-sm text-[#141010] placeholder-[#a8a29e] shadow-sm outline-none transition ${
                      nameError
                        ? "border-[#ef4444] ring-1 ring-[#ef4444] focus:border-[#ef4444]"
                        : "border-[#e7e5e4] focus:border-[#141010] focus:ring-1 focus:ring-[#141010]"
                    }`}
                  />
                  {nameError && (
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#ef4444]">
                      <AlertCircleIcon className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Validation Error Message */}
                {nameError ? (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[#ef4444] text-[13px] leading-none">⚠</span>
                    <p className="font-sans text-[12px] font-medium text-[#ef4444] tracking-tight">
                      {nameError}
                    </p>
                  </div>
                ) : (
                  <p className="font-sans text-[12px] text-[#8a7e75] leading-normal">
                    Use a clear name that your cashiers will recognize on the settlement keypad.
                  </p>
                )}
              </div>

              {/* Field 2: CASHIER AVAILABILITY */}
              <div className="bg-[#f7f3f2] border border-[#eadfd6] rounded-lg p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="cashier-active-toggle" className="font-sans text-sm font-medium text-[#141010] cursor-pointer select-none">
                    Show on Cashier
                  </label>
                  <button
                    type="button"
                    id="cashier-active-toggle"
                    role="switch"
                    aria-checked={formData.active}
                    onClick={() => setFormData({ ...formData, active: !formData.active })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      formData.active ? "bg-[#10b981]" : "bg-stone-300"
                    }`}
                  >
                    <span className="sr-only">Toggle payment mode cashier availability</span>
                    <span
                      aria-hidden="true"
                      className={`translate-x-0 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        formData.active ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                <p className="font-sans text-xs text-[#5e5e5e] leading-relaxed">
                  When enabled, this payment method will be available during Cashier checkout.
                </p>
              </div>

              {/* Info Banner for Edit Mode */}
              {editingItem && (
                <div className="bg-[#fdf8f7] border border-[#e7e5e4] rounded-lg p-4 flex gap-3.5 items-start">
                  <InfoIcon className="w-4 h-4 text-[#8a7e75] shrink-0 mt-0.5" />
                  <p className="font-sans text-[12px] text-[#5e5e5e] leading-relaxed">
                    Created on <strong className="font-semibold text-stone-800">{formatDate(editingItem.createdAt)}</strong>. Updating the payment mode name will apply to all subsequent KOT settlements while keeping historical reports intact.
                  </p>
                </div>
              )}

              {/* Drawer Footer Actions */}
              <div className="pt-6 border-t border-[#e7e5e4] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseDrawer}
                  className="bg-[#f1edec] hover:bg-[#e7e2e0] border border-[#e7e5e4] rounded-full px-5 py-2.5 text-sm font-medium text-[#141010] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formData.name.trim() || !!nameError || isSaving}
                  className={`rounded-full px-6 py-2.5 text-sm font-medium tracking-tight shadow-md transition-all ${
                    !formData.name.trim() || !!nameError || isSaving
                      ? "bg-[#0c0a09] text-white opacity-60 cursor-not-allowed"
                      : "bg-[#0c0a09] hover:bg-black text-white cursor-pointer"
                  }`}
                >
                  {isSaving ? "Saving..." : editingItem ? "Update payment mode" : "Create payment mode"}
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div
          className="fixed inset-0 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4 z-50 select-none"
          onClick={() => !isDeleting && setDeletingItem(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            aria-describedby="modal-description"
            className="w-full max-w-[480px] bg-white border border-[#eadfd6] rounded-2xl p-6 shadow-2xl mx-auto transform transition-all relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shadow-inner">
                <TrashIcon className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => !isDeleting && setDeletingItem(null)}
                aria-label="Close modal"
                className="text-stone-400 hover:text-[#141010] p-1 rounded-lg transition"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Heading */}
            <div className="mb-4">
              <h2 id="modal-title" className="font-garamond text-[24px] font-normal leading-tight text-[#141010]">
                Delete payment mode?
              </h2>
              <p id="modal-description" className="text-[13px] text-[#5e5e5e] mt-1 font-normal leading-snug">
                Permanently remove this payment option from POS terminals.
              </p>
            </div>

            {/* Prompt */}
            <div>
              <p className="text-[14px] font-medium text-[#141010] leading-snug">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-[#141010] underline decoration-[#e7e5e4] underline-offset-4">
                  {deletingItem.name}
                </span>
                ?
              </p>

              <div className="bg-[#fdf8f7] border border-[#e7e5e4] rounded-xl p-4 my-4 space-y-2.5 text-[12.5px] leading-relaxed text-stone-700">
                <div className="flex items-start gap-2">
                  <span className="text-rose-600 font-bold select-none">•</span>
                  <p>This payment method will immediately be removed from Cashier POS checkout and captain billing.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-stone-400 select-none">•</span>
                  <p>Historical payments, shift closure reports, and daily reconciliations will retain their recorded payment mode name (‘{deletingItem.name}’).</p>
                </div>
                <div className="flex items-start gap-2 pt-1 border-t border-[#e7e5e4] font-mono text-[11px] text-stone-500">
                  <span className="text-stone-400 select-none">•</span>
                  <p>
                    Backend mutation: <span className="bg-white px-1.5 py-0.5 rounded border border-stone-200 text-stone-700 font-semibold">organizationPaymentModes.remove</span> will execute immediately.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                disabled={isDeleting}
                className="bg-[#f1edec] border border-[#e7e5e4] hover:bg-stone-200/80 rounded-full px-5 py-2.5 text-sm font-medium text-[#141010] transition active:scale-[0.98] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-full px-6 py-2.5 text-sm font-medium shadow-sm transition active:scale-[0.98] flex items-center gap-1.5 cursor-pointer"
              >
                <span>{isDeleting ? "Deleting..." : "Delete payment mode"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
