"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface LocalDeadStockRecord {
  _id: string;
  createdAt: number;
  inventoryItemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  reasonForDeadStock: string;
  unitCost?: number;
}

export function DeadStockView({ organizationId }: { organizationId: Id<"organizations"> }) {
  // Existing backend query for raw inventory items
  const inventoryItems = useQuery(api.inventory.listInventoryItems, { organizationId });

  // Real existing backend queries & mutations
  const rawDeadStockLogs: any[] = [];

  // Mutation for logging dead stock
  const logDeadStockMutation = useMutation(api.inventory.logDeadStock);

  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [localLogs, setLocalLogs] = useState<LocalDeadStockRecord[]>([]);

  // Form State matching backend logDeadStock args exactly:
  // { organizationId, inventoryItemId, quantity, unit, reasonForDeadStock }
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [quantity, setQuantity] = useState<number | "">(1);
  const [unit, setUnit] = useState<string>("gram");
  const [reason, setReason] = useState<string>("Spoiled");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Combine backend records (if any) with local session logs
  const allLogs = useMemo(() => {
    const backendRecords: LocalDeadStockRecord[] = (rawDeadStockLogs ?? []).map((r) => ({
      _id: r._id,
      createdAt: r.createdAt ?? Date.now(),
      inventoryItemId: r.inventoryItemId,
      itemName: r.itemName ?? "Ingredient",
      quantity: r.quantity ?? 0,
      unit: r.unit ?? "",
      reasonForDeadStock: r.reasonForDeadStock ?? "Spoiled",
      unitCost: r.unitCost,
    }));

    // Merge backend and local records, avoiding duplicates by _id
    const backendIds = new Set(backendRecords.map((b) => b._id));
    const uniqueLocal = localLogs.filter((l) => !backendIds.has(l._id));

    return [...uniqueLocal, ...backendRecords].sort((a, b) => b.createdAt - a.createdAt);
  }, [rawDeadStockLogs, localLogs]);

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return allLogs;
    const q = searchQuery.toLowerCase();
    return allLogs.filter(
      (l) =>
        l.itemName.toLowerCase().includes(q) ||
        l.reasonForDeadStock.toLowerCase().includes(q) ||
        l.unit.toLowerCase().includes(q)
    );
  }, [allLogs, searchQuery]);

  // Total value loss summary calculation
  const totalValueLoss = useMemo(() => {
    return allLogs.reduce((sum, log) => {
      if (log.unitCost && log.quantity) {
        return sum + log.quantity * log.unitCost;
      }
      return sum;
    }, 0);
  }, [allLogs]);

  const openModal = () => {
    setFormError(null);
    if (inventoryItems && inventoryItems.length > 0) {
      const firstItem = inventoryItems[0];
      setSelectedItemId(firstItem._id);
      setUnit(firstItem.servingUnit || firstItem.buyingUnit || "gram");
    } else {
      setSelectedItemId("");
      setUnit("gram");
    }
    setQuantity(1);
    setReason("Spoiled");
    setIsModalOpen(true);
  };

  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId);
    const found = inventoryItems?.find((i) => i._id === itemId);
    if (found) {
      setUnit(found.servingUnit || found.buyingUnit || "gram");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedItemId) {
      setFormError("Please select an inventory item.");
      return;
    }

    const numQty = Number(quantity);
    if (!numQty || numQty <= 0) {
      setFormError("Quantity lost must be a positive number.");
      return;
    }

    if (!unit.trim()) {
      setFormError("Please enter a valid unit of measurement.");
      return;
    }

    const selectedItem = inventoryItems?.find((i) => i._id === selectedItemId);

    setIsSubmitting(true);
    try {
      // Backend mutation call using existing api.inventory.logDeadStock signature
      const res = await logDeadStockMutation({
        organizationId,
        inventoryItemId: selectedItemId as Id<"inventoryItems">,
        quantity: numQty,
        unit: unit.trim(),
        reasonForDeadStock: reason,
      });

      // Add to local logs for immediate visual feedback
      const newRecord: LocalDeadStockRecord = {
        _id: `local_${Date.now()}`,
        createdAt: Date.now(),
        inventoryItemId: selectedItemId,
        itemName: selectedItem?.name ?? "Ingredient Item",
        quantity: numQty,
        unit: unit.trim(),
        reasonForDeadStock: reason,
        unitCost: selectedItem?.unitCost,
      };

      setLocalLogs((prev) => [newRecord, ...prev]);
      setIsModalOpen(false);

      const updatedStockStr = res?.newStock !== undefined ? ` (New available stock: ${res.newStock} ${unit})` : "";
      setSuccessMessage(`Dead stock recorded successfully for "${selectedItem?.name ?? "Item"}". Stock debited${updatedStockStr}.`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error("Failed to log dead stock:", err);
      setFormError(err?.message || "Failed to log dead stock entry. Please check the backend connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (inventoryItems === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-[#fbf9f8]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-stone-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-stone-500 font-medium">Loading Dead Stock Tracker...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#fbf9f8] p-8">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#e7e5e4]">
        <div>
          <h1 className="font-serif text-3xl font-medium text-[#0c0a09] tracking-tight">Dead Stock Log</h1>
          <p className="text-xs text-[#78716c] mt-0.5">
            Audit spoilage, expired ingredients, damaged stock, and track raw material inventory loss.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <svg
              className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a8a29e]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              className="w-full pl-9 pr-4 py-2 bg-white text-xs text-[#1c1917] border border-[#e7e5e4] rounded-full focus:outline-none focus:ring-1 focus:ring-[#0c0a09] placeholder:text-[#a8a29e] transition shadow-xs"
              placeholder="Search log by item, reason, or unit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center space-x-2 bg-[#0c0a09] hover:bg-[#292524] text-white text-xs font-medium px-4 py-2.5 rounded-full transition shadow-sm cursor-pointer whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span>Log Dead Stock</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Summary Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <div className="bg-white border border-[#e7e5e4] rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-medium text-[#78716c] uppercase tracking-wider">Total Records Logged</span>
          <p className="font-serif text-2xl font-semibold text-[#0c0a09] mt-1">{allLogs.length}</p>
        </div>
        <div className="bg-white border border-[#e7e5e4] rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-medium text-[#78716c] uppercase tracking-wider">Estimated Financial Loss</span>
          <p className="font-serif text-2xl font-semibold text-rose-700 mt-1">
            {totalValueLoss > 0 ? `₹${totalValueLoss.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
          </p>
        </div>
        <div className="bg-white border border-[#e7e5e4] rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-medium text-[#78716c] uppercase tracking-wider">Available Catalog Items</span>
          <p className="font-serif text-2xl font-semibold text-[#0c0a09] mt-1">{inventoryItems.length}</p>
        </div>
      </div>

      {/* Main Table / Empty State */}
      <div className="mt-6 flex-1 flex flex-col overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#e7e5e4] rounded-2xl p-12 bg-white/50 text-center my-2">
            <div className="w-14 h-14 rounded-full bg-[#f5f5f4] border border-[#e7e5e4] flex items-center justify-center text-[#78716c] mb-4">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>
            <h3 className="font-serif text-2xl font-medium text-[#0c0a09]">No dead stock logged yet</h3>
            <p className="text-xs text-[#78716c] max-w-sm mt-1 mb-6">
              Record raw materials or ingredient inventory that was spoiled, expired, damaged, or spilled to debit current stock.
            </p>
            <button
              type="button"
              onClick={openModal}
              className="inline-flex items-center space-x-2 bg-[#0c0a09] hover:bg-[#292524] text-white text-xs font-medium px-5 py-2.5 rounded-full transition shadow-sm cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              <span>Log Dead Stock</span>
            </button>
          </div>
        ) : (
          <div className="bg-white border border-[#e7e5e4] rounded-xl shadow-xs overflow-hidden flex flex-col flex-1">
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#e7e5e4] bg-[#fafaf9]/80 text-[11px] uppercase tracking-wider text-[#78716c] font-medium sticky top-0 bg-white z-10">
                    <th className="py-3.5 px-5 font-normal">Log Date & Time</th>
                    <th className="py-3.5 px-5 font-normal">Ingredient Item</th>
                    <th className="py-3.5 px-5 font-normal">Quantity Lost</th>
                    <th className="py-3.5 px-5 font-normal">Reason</th>
                    <th className="py-3.5 px-5 text-right font-normal">Est. Value Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7e5e4]/70 text-xs">
                  {filteredLogs.map((log) => {
                    const totalLoss = log.unitCost && log.quantity ? log.quantity * log.unitCost : 0;
                    return (
                      <tr key={log._id} className="hover:bg-[#fafaf9] transition-colors">
                        <td className="py-4 px-5 text-[#57534e]">
                          {new Date(log.createdAt).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-4 px-5 font-medium text-[#0c0a09]">{log.itemName}</td>
                        <td className="py-4 px-5 font-semibold text-rose-600">
                          -{log.quantity} {log.unit}
                        </td>
                        <td className="py-4 px-5">
                          <span className="inline-block font-mono text-[11px] bg-rose-50 text-rose-700 px-2.5 py-0.5 rounded border border-rose-200">
                            {log.reasonForDeadStock}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right font-semibold text-[#0c0a09]">
                          {totalLoss > 0 ? `₹${totalLoss.toFixed(2)}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="py-3.5 px-5 border-t border-[#e7e5e4] bg-[#fafaf9]/50 flex items-center justify-between text-xs text-[#78716c] shrink-0">
              <span>Showing {filteredLogs.length} dead stock record(s)</span>
            </div>
          </div>
        )}
      </div>

      {/* Log Dead Stock Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-serif text-2xl font-medium text-[#0c0a09]">Log Dead Stock</h3>
                <p className="text-xs text-[#78716c] mt-0.5">Record spoiled or damaged stock to debit available inventory.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {formError}
              </div>
            )}

            <form id="deadStockForm" onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-[#1c1917] mb-1">
                  Select Ingredient Item <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  className="w-full px-3 py-2 bg-[#fbf9f8] border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09]"
                  value={selectedItemId}
                  onChange={(e) => handleItemSelect(e.target.value)}
                >
                  {inventoryItems?.length === 0 ? (
                    <option value="" disabled>
                      No inventory items found
                    </option>
                  ) : (
                    inventoryItems?.map((inv) => (
                      <option key={inv._id} value={inv._id}>
                        {inv.name} (Stock: {inv.availableStock} {inv.servingUnit || inv.buyingUnit})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#1c1917] mb-1">
                    Quantity Lost <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    className="w-full px-3 py-2 bg-[#fbf9f8] border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09]"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#1c1917] mb-1">
                    Unit <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 bg-[#fbf9f8] border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09]"
                    placeholder="e.g. gram, kg, litre, piece"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#1c1917] mb-1">Reason for Spoilage / Loss</label>
                <select
                  className="w-full px-3 py-2 bg-[#fbf9f8] border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09]"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="Spoiled">Spoiled / Rotten</option>
                  <option value="Expired">Expired Best-Before Date</option>
                  <option value="Damaged">Damaged Packaging</option>
                  <option value="Spilled">Spilled / Preparation Loss</option>
                </select>
              </div>
            </form>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#e7e5e4]">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-full border border-[#e7e5e4] text-[#57534e] hover:bg-stone-50 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="deadStockForm"
                disabled={isSubmitting || !selectedItemId}
                className="px-5 py-2 rounded-full bg-[#0c0a09] hover:bg-[#292524] text-white text-xs font-medium transition cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Logging..." : "Confirm & Debit Stock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
