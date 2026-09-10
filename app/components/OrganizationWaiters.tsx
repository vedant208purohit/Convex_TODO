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
      <path d="M12 4v16m8-8H4" />
    </svg>
  );
}

function SearchIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function EditIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}

function TrashIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function XIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function AlertCircleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function InfoIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

// Helper: Format creation date
function formatDate(timestamp?: number): string {
  if (!timestamp) return "Sep 04, 2026";
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export function OrganizationWaiters() {
  // ------------------------------------------
  // CONVEX HOOKS
  // ------------------------------------------
  const waiters = useQuery(api.organizationWaiters.list);
  const isLoading = waiters === undefined;

  const createWaiter = useMutation(api.organizationWaiters.create);
  const updateWaiter = useMutation(api.organizationWaiters.update);
  const removeWaiter = useMutation(api.organizationWaiters.remove);

  // ------------------------------------------
  // LOCAL UI STATES
  // ------------------------------------------
  const [searchQuery, setSearchQuery] = useState("");

  // Toast Feedback State
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToast({ type, text });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Drawer Form State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingWaiter, setEditingWaiter] = useState<any | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [waiterCode, setWaiterCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Modal Confirmation State
  const [deletingWaiter, setDeletingWaiter] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter waiters based on search query
  const filteredWaiters = useMemo(() => {
    if (!waiters) return [];
    if (!searchQuery.trim()) return waiters;

    const q = searchQuery.toLowerCase().trim();
    return waiters.filter((w) => {
      const fn = w.firstName?.toLowerCase() || "";
      const ln = w.lastName?.toLowerCase() || "";
      const fullName = `${fn} ${ln}`.trim();
      const code = w.waiterCode?.toLowerCase() || "";

      return fn.includes(q) || ln.includes(q) || fullName.includes(q) || code.includes(q);
    });
  }, [waiters, searchQuery]);

  // Open Create Drawer
  const handleOpenCreate = () => {
    setEditingWaiter(null);
    setFirstName("");
    setLastName("");
    setWaiterCode("");
    setFormError(null);
    setIsDrawerOpen(true);
  };

  // Open Edit Drawer
  const handleOpenEdit = (waiter: any) => {
    setEditingWaiter(waiter);
    setFirstName(waiter.firstName || "");
    setLastName(waiter.lastName || "");
    setWaiterCode(waiter.waiterCode || "");
    setFormError(null);
    setIsDrawerOpen(true);
  };

  // Close Drawer
  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setEditingWaiter(null);
    setFormError(null);
  };

  // Form Submit Handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedCode = waiterCode.trim();

    if (!trimmedFirst) {
      setFormError("First name is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingWaiter) {
        await updateWaiter({
          id: editingWaiter._id as Id<"organizationWaiters">,
          firstName: trimmedFirst || undefined,
          lastName: trimmedLast || undefined,
          waiterCode: trimmedCode || undefined,
        });
        showToast(`Waiter profile updated successfully.`);
      } else {
        await createWaiter({
          firstName: trimmedFirst || undefined,
          lastName: trimmedLast || undefined,
          waiterCode: trimmedCode || undefined,
        });
        showToast(`New floor server added successfully.`);
      }
      handleCloseDrawer();
    } catch (err: any) {
      const rawMsg = err?.message?.replace("Uncaught Error: ", "") || "";
      if (rawMsg.includes("is already taken")) {
        setFormError(`Hey! ${trimmedCode || "This code"} is already taken.`);
      } else {
        setFormError(rawMsg || "Failed to save floor server profile.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Confirm Handler
  const handleConfirmDelete = async () => {
    if (!deletingWaiter) return;

    setIsDeleting(true);
    try {
      await removeWaiter({ id: deletingWaiter._id as Id<"organizationWaiters"> });
      showToast(`Waiter "${deletingWaiter.firstName || deletingWaiter.waiterCode || "Waiter"}" deleted successfully.`);
      setDeletingWaiter(null);
    } catch (err: any) {
      showToast(err?.message || "Failed to delete floor server.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center">
        <div className="w-8 h-8 mx-auto border-2 border-[#141010] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-[#5e5e5e]">Loading Floor Staff Roster...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
      {/* Toast Notification Banner */}
      {toast && (
        <div
          className={`p-4 mb-4 rounded-xl border text-sm font-medium transition-all shrink-0 ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-rose-50 text-rose-900 border-rose-200"
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Fixed Top Header & Toolbar Section */}
      <div className="shrink-0 space-y-4 pb-4 border-b border-[#e7e5e4] bg-[#fdf8f7]">
        {/* Editorial Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-[30px] leading-tight font-normal text-[#141010]" style={{ fontFamily: "'EB Garamond', Georgia, serif" }}>
              Waiters &amp; Floor Servers
            </h1>
            <p className="text-[14px] text-[#5e5e5e] mt-1 font-normal">
              Manage floor staff, server badge codes, and table assignment profiles.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            style={{ color: "#ffffff", backgroundColor: "#0c0a09" }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#0c0a09] hover:bg-[#292524] active:scale-[0.98] text-white font-semibold text-[13px] transition shadow-xs cursor-pointer"
          >
            <PlusIcon className="w-3.5 h-3.5 text-white" />
            <span className="text-white" style={{ color: "#ffffff" }}>Add Waiter</span>
          </button>
        </div>

        {/* Action Toolbar (Search + Count Badge) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1 px-0.5">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8a7e75]">
              <SearchIcon className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or waiter code..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-[#e7e5e4] rounded-lg text-[13px] text-[#141010] placeholder-[#928c8a] focus:outline-none focus:border-[#141010] focus:ring-1 focus:ring-[#141010] transition shadow-xs"
            />
          </div>

          {/* Meta Count Badge */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[12px] text-[#5e5e5e]">Total Active Waiters:</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white text-[#141010] border border-[#e7e5e4] shadow-xs">
              {filteredWaiters.length} active
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable Table Content Area */}
      <div className="flex-1 overflow-y-auto pt-4 pb-8 pr-1 min-h-0">

        {/* Table Container */}
        <div className="bg-white rounded-xl border border-[#e7e5e4] overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f7f3f2] border-b border-[#e7e5e4] text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">
                <th className="py-3.5 px-6 w-36">BADGE / CODE</th>
                <th className="py-3.5 px-6">WAITER NAME</th>
                <th className="py-3.5 px-6 w-44">CREATED DATE</th>
                <th className="py-3.5 px-6 w-32">STATUS</th>
                <th className="py-3.5 px-6 w-28 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7e5e4] text-[14px] text-[#1c1b1b]">
              {filteredWaiters.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#8a7e75] text-xs">
                    {searchQuery ? `No floor servers found matching "${searchQuery}"` : "No floor servers registered yet."}
                  </td>
                </tr>
              ) : (
                filteredWaiters.map((waiter) => {
                  const fullName = [waiter.firstName, waiter.lastName].filter(Boolean).join(" ") || "Unnamed Server";

                  return (
                    <tr key={waiter._id} className="hover:bg-[#fdf8f7] transition-colors">
                      {/* Badge / Code */}
                      <td className="py-4 px-6 font-mono text-[13px]">
                        {waiter.waiterCode ? (
                          <span className="inline-block px-2.5 py-0.5 rounded bg-[#f1edec] text-[#141010] font-medium border border-[#e7e5e4]">
                            {waiter.waiterCode}
                          </span>
                        ) : (
                          <span className="text-[#8a7e75]">—</span>
                        )}
                      </td>

                      {/* Waiter Name */}
                      <td className="py-4 px-6 font-medium text-[#141010]">
                        {fullName}
                      </td>

                      {/* Created Date */}
                      <td className="py-4 px-6 text-[#5e5e5e] text-[13px]">
                        {formatDate(waiter.createdAt)}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-[#10b981] border border-emerald-200/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                          Active
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(waiter)}
                            className="p-1.5 text-[#5e5e5e] hover:text-[#141010] hover:bg-[#f1edec] rounded-md transition cursor-pointer"
                            title="Edit Server"
                          >
                            <EditIcon className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingWaiter(waiter)}
                            className="p-1.5 text-[#5e5e5e] hover:text-[#ef4444] hover:bg-red-50 rounded-md transition cursor-pointer"
                            title="Delete Server"
                            aria-label="Delete Server"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Table Footer / Attribution Notice */}
          <div className="py-3 px-6 bg-[#fdf8f7] border-t border-[#e7e5e4] flex items-center justify-between text-[12px] text-[#8a7e75]">
            <div>
              Sorted by created date (newest first) • Displaying {filteredWaiters.length} of {waiters?.length ?? 0} active floor servers
            </div>
            <div>
              Floor server assignments affect Captain orders &amp; thermal receipts
            </div>
          </div>
        </div>

      </div>

      {/* ------------------------------------------ */}
      {/* SUBTLE DARK TRANSLUCENT OVERLAY (FOR DRAWER & DIALOG) */}
      {/* ------------------------------------------ */}
      {(isDrawerOpen || deletingWaiter) && (
        <div
          className="fixed inset-0 bg-[#0c0a09]/30 backdrop-blur-[1px] z-30 transition-opacity"
          onClick={() => {
            if (isDrawerOpen) handleCloseDrawer();
            if (deletingWaiter) setDeletingWaiter(null);
          }}
        />
      )}

      {/* ------------------------------------------ */}
      {/* ADD / EDIT WAITER RIGHT-SIDE DRAWER */}
      {/* ------------------------------------------ */}
      {isDrawerOpen && (
        <aside className="fixed right-0 top-0 bottom-0 w-[460px] bg-white z-40 shadow-2xl flex flex-col justify-between border-l border-[#e7e5e4] animate-in slide-in-from-right duration-200">
          
          {/* Drawer Header */}
          <div className="px-7 py-6 border-b border-[#e7e5e4] flex items-center justify-between bg-[#fdf8f7]">
            <div>
              <h2 className="text-[24px] font-normal text-[#141010] leading-snug" style={{ fontFamily: "'EB Garamond', Georgia, serif" }}>
                {editingWaiter ? "Edit Floor Server" : "Add New Floor Server"}
              </h2>
              <p className="text-[12px] text-[#5e5e5e] mt-0.5">
                {editingWaiter
                  ? "Modify waiter identification details and active badge allocation."
                  : "Register a waiter profile for dining table assignment and KOT orders."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCloseDrawer}
              className="p-2 text-[#5e5e5e] hover:text-[#141010] hover:bg-[#f1edec] rounded-full transition cursor-pointer"
              title="Close Drawer"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Form Content */}
          <form onSubmit={handleFormSubmit} className="p-7 flex-1 overflow-y-auto space-y-6">
            
            {/* Field 1: First Name (Required) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold text-[#141010] tracking-wider uppercase">
                  FIRST NAME <span className="text-[#ef4444]">*</span>
                </label>
                <span className="text-[11px] text-[#8a7e75]">Required • max 50 chars</span>
              </div>
              <input
                type="text"
                maxLength={50}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter first name"
                className="w-full px-3.5 py-2.5 bg-white border border-[#e7e5e4] rounded-lg text-[14px] text-[#141010] placeholder-[#928c8a] focus:outline-none focus:border-[#141010] focus:ring-1 focus:ring-[#141010] transition"
              />
            </div>

            {/* Field 2: Last Name (Optional) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold text-[#141010] tracking-wider uppercase">
                  LAST NAME
                </label>
                <span className="text-[11px] text-[#8a7e75]">Optional</span>
              </div>
              <input
                type="text"
                maxLength={50}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter last name"
                className="w-full px-3.5 py-2.5 bg-white border border-[#e7e5e4] rounded-lg text-[14px] text-[#141010] placeholder-[#928c8a] focus:outline-none focus:border-[#141010] focus:ring-1 focus:ring-[#141010] transition"
              />
            </div>

            {/* Field 3: Waiter Code / Badge ID (Optional) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold text-[#141010] tracking-wider uppercase">
                  WAITER CODE / BADGE ID
                </label>
                <span className="text-[11px] text-[#8a7e75]">Optional • max 20 chars</span>
              </div>
              <input
                type="text"
                maxLength={20}
                value={waiterCode}
                onChange={(e) => setWaiterCode(e.target.value)}
                placeholder="e.g. W-04 or #14"
                className={`w-full px-3.5 py-2.5 bg-white border rounded-lg text-[14px] font-mono text-[#141010] placeholder-[#928c8a] focus:outline-none transition ${
                  formError ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500" : "border-[#e7e5e4] focus:border-[#141010] focus:ring-1 focus:ring-[#141010]"
                }`}
              />
              <p className="text-[12px] text-[#8a7e75] leading-relaxed pt-1">
                Unique short code printed on kitchen order tickets (KOT) &amp; receipts. Leave blank if not using badge codes.
              </p>
            </div>

            {/* Form Error Banner (Duplicate Code Handling) */}
            {formError && (
              <div className="p-3.5 bg-red-50/80 border border-red-200 rounded-lg text-xs text-red-700 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-red-800">
                  <AlertCircleIcon className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
                <p className="text-[11px] text-red-600 pl-5 leading-normal">
                  Each active floor waiter requires an exclusive badge code for thermal printing &amp; register assignment.
                </p>
              </div>
            )}

            {/* Attribution Note Box */}
            <div className="p-3.5 rounded-lg bg-[#f7f3f2] border border-[#eadfd6] text-[12px] text-[#5e5e5e] space-y-1">
              <div className="font-medium text-[#141010] flex items-center gap-1.5">
                <InfoIcon className="w-3.5 h-3.5 text-[#8a7e75]" />
                <span>{editingWaiter ? "Record Attribution" : "Floor Staff Attribution Note"}</span>
              </div>
              <p className="leading-relaxed">
                {editingWaiter
                  ? `Created on ${formatDate(editingWaiter.createdAt)}. Updating this profile updates live terminal rosters immediately while keeping prior order audit records intact.`
                  : "This profile is strictly used for order taker tagging, table coverage, and cashier receipts. Sensitive data (passwords, PINs, phone numbers) are never stored here."}
              </p>
            </div>

          </form>

          {/* Sticky Drawer Footer */}
          <div className="px-7 py-4 border-t border-[#e7e5e4] bg-[#fdf8f7] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCloseDrawer}
              className="px-5 py-2 rounded-lg text-[13px] font-medium text-[#141010] bg-white border border-[#e7e5e4] hover:bg-[#f1edec] transition shadow-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleFormSubmit}
              disabled={isSubmitting}
              style={{ color: "#ffffff", backgroundColor: "#0c0a09" }}
              className="px-6 py-2 rounded-full text-[13px] font-semibold text-white bg-[#0c0a09] hover:bg-[#292524] active:scale-[0.98] transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-white" style={{ color: "#ffffff" }}>Saving...</span>
                </>
              ) : (
                <span className="text-white" style={{ color: "#ffffff" }}>{editingWaiter ? "Update Waiter" : "Save Waiter"}</span>
              )}
            </button>
          </div>

        </aside>
      )}

      {/* ------------------------------------------ */}
      {/* DELETE CONFIRMATION CENTERED DIALOG */}
      {/* ------------------------------------------ */}
      {deletingWaiter && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-[#e7e5e4] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-[#e7e5e4] flex items-start justify-between bg-[#fdf8f7]">
              <div className="flex items-center gap-3">
                <div
                  style={{
                    backgroundColor: "rgb(254, 242, 242)",
                    color: "rgb(239, 68, 68)",
                    border: "1px solid rgb(254, 226, 226)",
                  }}
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                >
                  <TrashIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[24px] font-normal text-[#141010] leading-snug" style={{ fontFamily: "'EB Garamond', Georgia, serif" }}>
                    Delete Floor Server?
                  </h3>
                  <p className="text-[12px] text-[#8a7e75] font-medium">
                    Permanently remove operational waiter profile
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletingWaiter(null)}
                className="p-1.5 text-[#5e5e5e] hover:text-[#141010] hover:bg-[#f1edec] rounded-full transition cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <p className="text-[15px] font-normal text-[#1c1b1b] leading-relaxed">
                Are you sure you want to delete{" "}
                <span className="font-medium text-[#141010]">
                  {[deletingWaiter.firstName, deletingWaiter.lastName].filter(Boolean).join(" ") || "this waiter"}
                </span>{" "}
                {deletingWaiter.waiterCode && (
                  <span className="text-xs bg-[#f1edec] text-[#141010] px-2 py-0.5 rounded font-mono">
                    {deletingWaiter.waiterCode}
                  </span>
                )}
                ? This action cannot be undone.
              </p>

              {/* Authoritative Backend Rules List */}
              <div className="p-4 rounded-xl bg-[#f7f3f2] border border-[#eadfd6] space-y-2.5 text-[13px] text-[#4e4543]">
                <div className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8a7e75] mt-1.5 shrink-0" />
                  <span>This server profile will be permanently removed from your active staff roster.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8a7e75] mt-1.5 shrink-0" />
                  <span>The server will no longer appear in POS terminal station logins or order assignment dropdowns.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8a7e75] mt-1.5 shrink-0" />
                  <span>
                    Code <strong className="font-mono text-[#141010]">"{deletingWaiter.waiterCode || "—"}"</strong> will be immediately released and available for reassignment to new staff.
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-[#fdf8f7] border-t border-[#e7e5e4] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingWaiter(null)}
                disabled={isDeleting}
                className="px-5 py-2 rounded-lg text-[13px] font-medium text-[#141010] bg-white border border-[#e7e5e4] hover:bg-[#f1edec] transition shadow-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 rounded-full text-[13px] font-medium text-white bg-[#ef4444] hover:bg-[#dc2626] active:scale-[0.98] transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <TrashIcon className="w-3.5 h-3.5" />
                <span>{isDeleting ? "Deleting..." : "Delete Server"}</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
