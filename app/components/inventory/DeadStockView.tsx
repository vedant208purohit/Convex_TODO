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
  markedDate: string;
  supplierId?: string;
  poNumber?: string;
}

export function DeadStockView({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const inventoryItems = useQuery(api.inventory.listInventoryItems, { organizationId });
  const suppliers = useQuery(api.inventory.listSuppliers, { organizationId });
  const purchaseOrders = [
    { _id: "po_1", poNumber: "PO-2026-001", supplierName: "Self Employee" },
    { _id: "po_2", poNumber: "PO-2026-002", supplierName: "Fresh Wholesale" },
  ];

  const logDeadStockMutation = useMutation(api.inventory.logDeadStock);

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Column Sorting state
  const [sortField, setSortField] = useState<"itemName" | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Drawer & Log State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LocalDeadStockRecord | null>(null);
  const [localLogs, setLocalLogs] = useState<LocalDeadStockRecord[]>([]);

  // Form State
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [quantity, setQuantity] = useState<number | "">(1);
  const [unit, setUnit] = useState<string>("litre (l)");
  const [supplierId, setSupplierId] = useState<string>("");
  const [poNumber, setPoNumber] = useState<string>("");
  const [markedDate, setMarkedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [reason, setReason] = useState<string>("Expired");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active Dropdown menu state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Sorting Handler
  const handleSort = (field: "itemName") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Filtered & Sorted Records
  const filteredAndSortedLogs = useMemo(() => {
    let list = [...localLogs];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          l.itemName.toLowerCase().includes(q) ||
          l.reasonForDeadStock.toLowerCase().includes(q) ||
          l.unit.toLowerCase().includes(q)
      );
    }

    if (sortField) {
      list.sort((a, b) => {
        const valA = a.itemName.toLowerCase();
        const valB = b.itemName.toLowerCase();
        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [localLogs, searchQuery, sortField, sortOrder]);

  // Paginated List
  const totalPages = Math.ceil(filteredAndSortedLogs.length / itemsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedLogs.slice(start, start + itemsPerPage);
  }, [filteredAndSortedLogs, currentPage]);

  const openAddDrawer = () => {
    setEditingRecord(null);
    if (inventoryItems && inventoryItems.length > 0) {
      const first = inventoryItems[0];
      setSelectedItemId(first._id);
      setUnit(first.buyingUnit || first.servingUnit || "litre (l)");
    } else {
      setSelectedItemId("");
      setUnit("litre (l)");
    }
    setQuantity(1);
    setSupplierId("");
    setPoNumber("");
    setMarkedDate(new Date().toISOString().slice(0, 10));
    setReason("Expired");
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (rec: LocalDeadStockRecord) => {
    setEditingRecord(rec);
    setSelectedItemId(rec.inventoryItemId);
    setQuantity(rec.quantity);
    setUnit(rec.unit);
    setSupplierId(rec.supplierId || "");
    setPoNumber(rec.poNumber || "");
    setMarkedDate(rec.markedDate);
    setReason(rec.reasonForDeadStock);
    setActiveMenuId(null);
    setIsDrawerOpen(true);
  };

  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId);
    const found = inventoryItems?.find((i) => i._id === itemId);
    if (found) {
      setUnit(found.buyingUnit || found.servingUnit || "litre (l)");
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) {
      alert("Please select an inventory item.");
      return;
    }
    const numQty = Number(quantity);
    if (!numQty || numQty <= 0) {
      alert("Quantity must be greater than zero.");
      return;
    }

    const selectedItem = inventoryItems?.find((i) => i._id === selectedItemId);

    setIsSubmitting(true);
    try {
      if (editingRecord) {
        setLocalLogs((prev) =>
          prev.map((l) =>
            l._id === editingRecord._id
              ? {
                  ...l,
                  inventoryItemId: selectedItemId,
                  itemName: selectedItem?.name ?? l.itemName,
                  quantity: numQty,
                  unit,
                  supplierId,
                  poNumber,
                  reasonForDeadStock: reason,
                  markedDate,
                }
              : l
          )
        );
      } else {
        await logDeadStockMutation({
          organizationId,
          inventoryItemId: selectedItemId as Id<"inventoryItems">,
          quantity: numQty,
          unit: unit.trim(),
          reasonForDeadStock: reason,
        });

        const newRec: LocalDeadStockRecord = {
          _id: `dead_${Date.now()}`,
          createdAt: Date.now(),
          inventoryItemId: selectedItemId,
          itemName: selectedItem?.name ?? "Ingredient Item",
          quantity: numQty,
          unit: unit.trim(),
          reasonForDeadStock: reason,
          markedDate,
        };
        setLocalLogs((prev) => [newRec, ...prev]);
      }
      setIsDrawerOpen(false);
    } catch (err) {
      console.error("Failed to log dead stock:", err);
      alert("Failed to record dead stock entry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRecord = (id: string) => {
    if (!confirm("Are you sure you want to delete this dead stock entry?")) return;
    setLocalLogs((prev) => prev.filter((l) => l._id !== id));
    setActiveMenuId(null);
  };

  if (inventoryItems === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-[#fbf9f8]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-stone-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-stone-500 font-medium">Loading Dead Stock logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#fbf9f8] p-8">
      {/* Page Title & Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#e7e5e4]/70">
        <div>
          <h1 className="font-serif text-3xl md:text-[32px] text-[#0c0a09] font-medium tracking-tight">
            Dead stock
          </h1>
          <p className="text-xs md:text-sm text-[#78716c] mt-0.5">
            Track spoiled, expired, or damaged non-moving inventory logs.
          </p>
        </div>

        {/* Actions & Search */}
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <svg
              className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a8a29e]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              className="w-full pl-9.5 pr-4 py-2 bg-white text-xs text-[#1c1917] border border-[#e7e5e4] rounded-full focus:outline-none focus:ring-1 focus:ring-[#0c0a09] placeholder:text-[#a8a29e] transition shadow-2xs"
              placeholder="Search by item name or reason..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <button
            type="button"
            onClick={openAddDrawer}
            className="inline-flex items-center space-x-2 bg-[#0c0a09] hover:bg-[#292524] text-white !text-white text-xs font-medium px-4 py-2.5 rounded-full transition shadow-sm cursor-pointer whitespace-nowrap"
          >
            <svg
              className="w-3.5 h-3.5 text-white stroke-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span className="text-white !text-white font-medium">Record dead stock</span>
          </button>
        </div>
      </div>

      {/* Main Table / Empty State Container */}
      <div className="mt-6 flex-1 flex flex-col overflow-hidden">
        {filteredAndSortedLogs.length === 0 ? (
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
            <h3 className="font-serif text-2xl font-medium text-[#0c0a09]">
              No dead stock logs yet
            </h3>
            <p className="text-xs md:text-sm text-[#78716c] max-w-sm mt-1 mb-6">
              Keep an eye on your non-moving inventory. Update dead stock to see logs in this section.
            </p>
            <button
              type="button"
              onClick={openAddDrawer}
              className="inline-flex items-center space-x-2 bg-[#0c0a09] hover:bg-[#292524] text-white !text-white text-xs font-medium px-5 py-2.5 rounded-full transition shadow-sm cursor-pointer"
            >
              <svg
                className="w-3.5 h-3.5 text-white stroke-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="text-white !text-white font-medium">Record dead stock</span>
            </button>
          </div>
        ) : (
          <div className="bg-white border border-[#e7e5e4] rounded-xl shadow-xs overflow-hidden flex flex-col flex-1">
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#e7e5e4] bg-[#fafaf9]/80 text-[11px] uppercase tracking-wider text-[#78716c] font-medium sticky top-0 bg-white z-10 select-none">
                    <th
                      className="py-3 px-5 font-normal cursor-pointer hover:text-[#0c0a09]"
                      onClick={() => handleSort("itemName")}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Item name</span>
                        {sortField === "itemName" ? (
                          <span className="text-[#0c0a09] font-bold">
                            {sortOrder === "asc" ? "↑" : "↓"}
                          </span>
                        ) : (
                          <svg
                            className="w-3 h-3 text-[#d6d3d1]"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                            />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th className="py-3 px-5 font-normal">Stockable type</th>
                    <th className="py-3 px-5 font-normal">Quantity</th>
                    <th className="py-3 px-5 font-normal">Reason</th>
                    <th className="py-3 px-5 font-normal">Marked date</th>
                    <th className="py-3 px-5 text-right font-normal">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7e5e4]/70 text-xs">
                  {paginatedLogs.map((log) => (
                    <tr
                      key={log._id}
                      className="hover:bg-[#fafaf9] transition-colors group"
                    >
                      <td className="py-4 px-5">
                        <div
                          className="flex items-center space-x-3 cursor-pointer"
                          onClick={() => openEditDrawer(log)}
                        >
                          <div className="w-7 h-7 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center font-serif font-medium text-xs shrink-0">
                            {log.itemName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-[#0c0a09] hover:underline">
                              {log.itemName}
                            </p>
                            <p className="text-[11px] text-[#a8a29e]">Recorded log</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-[#44403c] font-medium">
                        Inventory Item
                      </td>
                      <td className="py-4 px-5 font-semibold text-rose-600">
                        {log.quantity} {log.unit}
                      </td>
                      <td className="py-4 px-5">
                        <span className="inline-block font-mono text-[11px] bg-rose-50 text-rose-700 px-2.5 py-0.5 rounded border border-rose-200">
                          {log.reasonForDeadStock}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-[#57534e] text-[11px]">
                        {log.markedDate}
                      </td>
                      <td className="py-4 px-5 text-right relative">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveMenuId(activeMenuId === log._id ? null : log._id)
                          }
                          className="text-[#78716c] hover:text-[#0c0a09] p-1.5 rounded hover:bg-[#e7e5e4]/50 transition cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>
                        {activeMenuId === log._id && (
                          <div className="absolute right-5 top-12 w-36 bg-white border border-[#e7e5e4] rounded-lg shadow-lg py-1 z-30 text-left">
                            <button
                              type="button"
                              onClick={() => openEditDrawer(log)}
                              className="w-full text-left px-3 py-1.5 text-xs text-[#0c0a09] hover:bg-[#fafaf9] cursor-pointer"
                            >
                              Edit record
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(log._id)}
                              className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              Delete log
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="py-3.5 px-5 border-t border-[#e7e5e4] bg-[#fafaf9]/50 flex items-center justify-between text-xs text-[#78716c] shrink-0">
              <span>
                Showing <strong className="text-[#0c0a09]">{paginatedLogs.length}</strong>{" "}
                of <strong className="text-[#0c0a09]">{filteredAndSortedLogs.length}</strong>{" "}
                dead stock logs
              </span>
              <div className="flex items-center space-x-2 text-xs">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 border border-[#e7e5e4] rounded bg-white text-[#1c1917] hover:bg-[#f5f5f4] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Previous
                </button>
                <span className="px-2 font-medium text-[#0c0a09]">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 border border-[#e7e5e4] rounded bg-white text-[#1c1917] hover:bg-[#f5f5f4] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drawer Overlay Backdrop */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-stone-900/30 backdrop-blur-[2px] z-40 transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* SLIDE-OVER DRAWER: Record item dead stock (Matches Image 1 for Add & Image 2 for Edit) */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md md:max-w-lg bg-white border-l border-stone-200 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header (Title: Record item dead stock for both) */}
        <div className="p-6 border-b border-stone-200 flex items-center justify-between bg-white shrink-0">
          <h2 className="text-xl text-stone-900 font-semibold tracking-tight">
            Record item dead stock
          </h2>
          <button
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            className="text-stone-500 hover:text-stone-900 p-1 rounded-md transition cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Drawer Form Body */}
        <form
          id="deadStockFormRecord"
          onSubmit={handleFormSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-stone-800"
        >
          {/* Field 1: Inventory item/ Recipe * */}
          <div>
            <label className="block font-medium mb-1 text-stone-800">
              Inventory item/ Recipe <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                required
                className="w-full appearance-none px-3.5 py-2.5 bg-white text-xs border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition cursor-pointer pr-9 font-medium text-stone-800"
                value={selectedItemId}
                onChange={(e) => handleItemSelect(e.target.value)}
              >
                {inventoryItems?.length === 0 ? (
                  <option value="" disabled>
                    Search by inventory item name/recipe
                  </option>
                ) : (
                  inventoryItems?.map((inv) => (
                    <option key={inv._id} value={inv._id}>
                      {inv.name}
                    </option>
                  ))
                )}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-stone-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Field 2: Quantity * | Measured unit */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block font-medium mb-1 text-stone-800">
                Quantity <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                required
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition placeholder:text-stone-400"
                placeholder="Enter the item quantity"
                value={quantity}
                onChange={(e) =>
                  setQuantity(e.target.value === "" ? "" : Number(e.target.value))
                }
              />
            </div>
            <div>
              <label className="block font-medium mb-1 text-stone-600">
                Measured unit
              </label>
              <input
                type="text"
                disabled
                className="w-full px-3 py-2 bg-stone-100 text-stone-600 border border-stone-300 rounded-md capitalize font-medium"
                value={unit}
              />
            </div>
          </div>

          {/* EDIT MODE ONLY EXTRA FIELDS: Supplier & PO number (Matching Image 2) */}
          {editingRecord && (
            <>
              {/* Field 3: Supplier (Only in Edit mode) */}
              <div>
                <label className="block font-medium mb-1 text-stone-800">
                  Supplier
                </label>
                <select
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition text-stone-700"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  <option value="">Select supplier</option>
                  {suppliers?.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.supplierName} ({s.companyName || "Supplier"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Field 4: PO number (Only in Edit mode) */}
              <div>
                <label className="block font-medium mb-1 text-stone-800">
                  PO number
                </label>
                <select
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition text-stone-700"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                >
                  <option value="">Search purchase order number</option>
                  {purchaseOrders?.map((po: any) => (
                    <option key={po._id} value={po.poNumber}>
                      {po.poNumber} ({po.supplierName || "PO"})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Field 5: Marked date */}
          <div>
            <label className="block font-medium mb-1 text-stone-800">Marked date</label>
            <input
              type="date"
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition"
              value={markedDate}
              onChange={(e) => setMarkedDate(e.target.value)}
            />
            <p className="text-[11px] text-stone-500 mt-1">
              Note: Select a date to mark dead stock: only today and yesterday are allowed.
            </p>
          </div>

          {/* Field 6: Reason for recording dead stock */}
          <div>
            <label className="block font-medium mb-1 text-stone-800">
              Reason for recording dead stock
            </label>
            <select
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="Expired">Expired</option>
              <option value="Damaged">Damaged</option>
              <option value="Low demand">Low demand</option>
              <option value="Spoiled">Spoiled</option>
            </select>
            <p className="text-[11px] text-stone-500 mt-2 leading-normal">
              Note: You can edit dead stock quantities only on the same day they are recorded. After that, editing is locked; you may remove the entry and add a new one if needed.
            </p>
          </div>
        </form>

        {/* Drawer Footer Actions */}
        <div className="p-4 px-6 border-t border-stone-200 bg-white flex items-center justify-end space-x-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            className="w-1/2 py-2.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 text-xs font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="deadStockFormRecord"
            disabled={isSubmitting}
            className="w-1/2 py-2.5 rounded-lg bg-[#1c1917] hover:bg-[#292524] text-white !text-white text-xs font-semibold transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isSubmitting
              ? "Saving..."
              : editingRecord
              ? "Edit record"
              : "Record dead stock"}
          </button>
        </div>
      </aside>
    </div>
  );
}
