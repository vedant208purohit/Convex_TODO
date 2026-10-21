"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatStoreDate } from "@/lib/constants/countries";
import { ComingSoonOverlay } from "../ComingSoonOverlay";

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
  supplierName?: string;
  purchaseOrderId?: string;
  poNumber?: string;
}

export function DeadStockView({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations?.find((o) => o?._id === organizationId) || organizations?.[0];
  const inventoryItems = useQuery(api.inventory.listInventoryItems, { organizationId });
  const suppliers = useQuery(api.inventory.listSuppliers, { organizationId });
  const dbDeadStocks = useQuery(api.inventory.listDeadStock, { organizationId });
  const dbPurchaseOrders = useQuery(api.inventory.listPurchaseOrders, { organizationId });

  const purchaseOrders = useMemo(() => {
    if (dbPurchaseOrders && dbPurchaseOrders.length > 0) {
      return dbPurchaseOrders.map((po) => ({
        _id: po._id,
        poNumber: po.poNumber,
        supplierName: po.supplierName,
        supplierId: po.supplierId,
      }));
    }
    return [];
  }, [dbPurchaseOrders]);

  const logDeadStockMutation = useMutation(api.inventory.logDeadStock);
  const updateDeadStockMutation = useMutation(api.inventory.updateDeadStock);
  const deleteDeadStockMutation = useMutation(api.inventory.deleteDeadStock);

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Column Sorting state
  const [sortField, setSortField] = useState<
    "itemName" | "type" | "quantity" | "reason" | "markedDate" | null
  >(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Drawer & Log State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LocalDeadStockRecord | null>(null);
  const [localLogs, setLocalLogs] = useState<LocalDeadStockRecord[]>([]);

  // Filtered & Sorted Records
  const allDeadStockLogs = useMemo(() => {
    const fromDb = (dbDeadStocks ?? []).map((ds: any) => ({
      _id: ds._id,
      createdAt: ds.createdAt,
      inventoryItemId: ds.inventoryItemId,
      itemName: ds.itemName,
      quantity: ds.quantity,
      unit: ds.unit,
      reasonForDeadStock: ds.reasonForDeadStock,
      markedDate: ds.markedDate,
      supplierId: ds.supplierId,
      supplierName: ds.supplierName,
      purchaseOrderId: ds.purchaseOrderId,
      poNumber: ds.poNumber,
    }));
    const dbIds = new Set(fromDb.map((d) => d._id));
    const extraLocal = localLogs.filter((l) => !dbIds.has(l._id));
    return [...fromDb, ...extraLocal];
  }, [dbDeadStocks, localLogs]);

  // Allowed dates (only today and yesterday)
  const { todayStr, yesterdayStr } = useMemo(() => {
    const toYmd = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    const now = new Date();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return {
      todayStr: toYmd(now),
      yesterdayStr: toYmd(yesterday),
    };
  }, []);

  // Form State
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [itemSearchText, setItemSearchText] = useState<string>("");
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);
  const [quantity, setQuantity] = useState<number | "">("");
  const [unit, setUnit] = useState<string>("piece");
  const [supplierId, setSupplierId] = useState<string>("");
  const [poNumber, setPoNumber] = useState<string>("");
  const [markedDate, setMarkedDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  const [reason, setReason] = useState<string>("Expired");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active Dropdown menu state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Sorting Handler
  const handleSort = (
    field: "itemName" | "type" | "quantity" | "reason" | "markedDate"
  ) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Filtered & Sorted Records
  const filteredAndSortedLogs = useMemo(() => {
    let list = [...allDeadStockLogs];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          l.itemName.toLowerCase().includes(q) ||
          l.reasonForDeadStock.toLowerCase().includes(q) ||
          l.unit.toLowerCase().includes(q) ||
          (l.supplierName && l.supplierName.toLowerCase().includes(q)) ||
          (l.poNumber && l.poNumber.toLowerCase().includes(q))
      );
    }

    if (sortField) {
      list.sort((a, b) => {
        let valA: string | number = "";
        let valB: string | number = "";
        if (sortField === "itemName") {
          valA = a.itemName.toLowerCase();
          valB = b.itemName.toLowerCase();
        } else if (sortField === "type") {
          valA = ((a as any).type || "inventory item").toLowerCase();
          valB = ((b as any).type || "inventory item").toLowerCase();
        } else if (sortField === "quantity") {
          valA = Number(a.quantity) || 0;
          valB = Number(b.quantity) || 0;
        } else if (sortField === "reason") {
          valA = (a.reasonForDeadStock || "").toLowerCase();
          valB = (b.reasonForDeadStock || "").toLowerCase();
        } else if (sortField === "markedDate") {
          valA = a.markedDate || "";
          valB = b.markedDate || "";
        }
        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [allDeadStockLogs, searchQuery, sortField, sortOrder]);

  // Paginated List
  const totalPages = Math.ceil(filteredAndSortedLogs.length / itemsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedLogs.slice(start, start + itemsPerPage);
  }, [filteredAndSortedLogs, currentPage]);

  const openAddDrawer = () => {
    setEditingRecord(null);
    setSelectedItemId("");
    setItemSearchText("");
    setShowSearchDropdown(false);
    setUnit("piece");
    setQuantity("");
    setSupplierId("");
    setPoNumber("");
    setMarkedDate(todayStr);
    setReason("Expired");
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (rec: LocalDeadStockRecord) => {
    setEditingRecord(rec);
    setSelectedItemId(rec.inventoryItemId);
    setItemSearchText(rec.itemName);
    setShowSearchDropdown(false);
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
      setItemSearchText(found.name);
      setUnit(found.buyingUnit || found.servingUnit || "piece");
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalItemId = selectedItemId;
    let finalItemName = itemSearchText;

    if (!finalItemId && itemSearchText) {
      const match = inventoryItems?.find(
        (i) => i.name.toLowerCase() === itemSearchText.toLowerCase()
      );
      if (match) {
        finalItemId = match._id;
        finalItemName = match.name;
      } else {
        finalItemId = `item_${Date.now()}`;
      }
    }

    if (!finalItemId && !finalItemName) {
      alert("Please select or enter an inventory item.");
      return;
    }

    const numQty = Number(quantity);
    if (!numQty || numQty <= 0) {
      alert("Quantity must be greater than zero.");
      return;
    }

    if (markedDate > todayStr || markedDate < yesterdayStr) {
      alert("Invalid date: only today and yesterday are allowed.");
      return;
    }

    const selectedItem = inventoryItems?.find((i) => i._id === finalItemId);
    const selectedSupplier = suppliers?.find((s) => s._id === supplierId);
    const selectedPo = purchaseOrders.find((p) => p.poNumber === poNumber);

    setIsSubmitting(true);
    try {
      if (editingRecord) {
        if (!editingRecord._id.startsWith("dead_")) {
          await updateDeadStockMutation({
            id: editingRecord._id as Id<"inventoryItemStocks">,
            quantity: numQty,
            unit: unit.trim(),
            reasonForDeadStock: reason,
            supplierId: supplierId ? (supplierId as Id<"suppliers">) : undefined,
            purchaseOrderId: selectedPo?._id ? (selectedPo._id as Id<"purchaseOrders">) : undefined,
            poNumber: poNumber || undefined,
            markedDate: new Date(markedDate).getTime(),
          });
        }
        setLocalLogs((prev) =>
          prev.map((l) =>
            l._id === editingRecord._id
              ? {
                  ...l,
                  inventoryItemId: finalItemId,
                  itemName: selectedItem?.name ?? finalItemName,
                  quantity: numQty,
                  unit,
                  reasonForDeadStock: reason,
                  markedDate,
                  supplierId: supplierId || undefined,
                  supplierName: selectedSupplier?.supplierName || l.supplierName,
                  purchaseOrderId: selectedPo?._id || undefined,
                  poNumber: poNumber || undefined,
                }
              : l
          )
        );
      } else {
        if (selectedItem) {
          await logDeadStockMutation({
            organizationId,
            inventoryItemId: selectedItem._id,
            quantity: numQty,
            unit: unit.trim(),
            reasonForDeadStock: reason,
            supplierId: supplierId ? (supplierId as Id<"suppliers">) : undefined,
            purchaseOrderId: selectedPo?._id ? (selectedPo._id as Id<"purchaseOrders">) : undefined,
            poNumber: poNumber || undefined,
            markedDate: new Date(markedDate).getTime(),
          });
          // Note: Do NOT add to localLogs here because Convex dbDeadStocks automatically updates reactively
        } else {
          const newRec: LocalDeadStockRecord = {
            _id: `dead_${Date.now()}`,
            createdAt: Date.now(),
            inventoryItemId: finalItemId,
            itemName: finalItemName,
            quantity: numQty,
            unit: unit.trim(),
            reasonForDeadStock: reason,
            markedDate,
            supplierId: supplierId || undefined,
            supplierName: selectedSupplier?.supplierName,
            purchaseOrderId: selectedPo?._id,
            poNumber: poNumber || undefined,
          };
          setLocalLogs((prev) => [newRec, ...prev]);
        }
      }
      setIsDrawerOpen(false);
    } catch (err) {
      console.error("Failed to log dead stock:", err);
      alert("Failed to record dead stock entry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm("Are you sure you want to delete this dead stock entry?")) return;
    try {
      if (!id.startsWith("dead_")) {
        await deleteDeadStockMutation({ id: id as Id<"inventoryItemStocks"> });
      }
    } catch (e) {
      console.error("Failed to delete dead stock:", e);
    }
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
    <div className="flex-1 flex flex-col min-w-0 bg-[#fbf9f8] p-8">
      {/* Page Title & Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#e7e5e4]/70">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            Dead stock log
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Track spoiled, expired, or damaged non-moving inventory logs.
          </p>
        </div>

        {/* Actions & Search */}
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <svg
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
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
              className="w-full pl-9 pr-3 py-2 bg-white text-xs text-stone-900 border border-[#e7e5e4] rounded-lg focus:outline-none focus:border-stone-800 placeholder:text-stone-400 transition shadow-2xs"
              placeholder="Search by item name/recipe name"
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
            className="inline-flex items-center space-x-2 bg-stone-900 hover:bg-stone-800 text-white !text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow-2xs cursor-pointer whitespace-nowrap"
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
            <span>Record dead stock</span>
          </button>
        </div>
      </div>

      {/* Main Table / Empty State Container */}
      <div className="mt-6 flex-1 flex flex-col">
        {filteredAndSortedLogs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#e7e5e4] rounded-2xl p-12 bg-white/50 text-center my-2">
            <div className="w-14 h-14 rounded-full bg-[#f5f5f4] border border-[#e7e5e4] flex items-center justify-center text-stone-500 mb-4">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-stone-900">
              No dead stock logs yet
            </h3>
            <p className="text-xs md:text-sm text-stone-500 max-w-sm mt-1 mb-6">
              Keep an eye on your non-moving inventory. Update dead stock to see logs in this section.
            </p>
            <button
              type="button"
              onClick={openAddDrawer}
              className="inline-flex items-center space-x-2 bg-stone-900 hover:bg-stone-800 text-white !text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition shadow-2xs cursor-pointer"
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
              <span>Record dead stock</span>
            </button>
          </div>
        ) : (
          <div className="bg-white border border-[#e7e5e4] rounded-xl shadow-2xs overflow-hidden flex flex-col flex-1">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#e7e5e4] bg-[#fafaf9] text-[11px] font-semibold uppercase tracking-wider text-[#78716c] select-none">
                    <th
                      className="py-3 px-5 cursor-pointer hover:text-stone-900"
                      onClick={() => handleSort("itemName")}
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>Item name</span>
                        {sortField === "itemName" ? (
                          <span className="text-stone-900 font-bold">
                            {sortOrder === "asc" ? "↑" : "↓"}
                          </span>
                        ) : (
                          <svg
                            className="w-3 h-3 text-stone-300"
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
                    <th
                      className="py-3 px-5 cursor-pointer hover:text-stone-900 select-none"
                      onClick={() => handleSort("type")}
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>Stockable type</span>
                        {sortField === "type" ? (
                          <span className="text-stone-900 font-bold">
                            {sortOrder === "asc" ? "↑" : "↓"}
                          </span>
                        ) : (
                          <svg
                            className="w-3 h-3 text-stone-300"
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
                    <th
                      className="py-3 px-5 cursor-pointer hover:text-stone-900 select-none"
                      onClick={() => handleSort("quantity")}
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>Quantity</span>
                        {sortField === "quantity" ? (
                          <span className="text-stone-900 font-bold">
                            {sortOrder === "asc" ? "↑" : "↓"}
                          </span>
                        ) : (
                          <svg
                            className="w-3 h-3 text-stone-300"
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
                    <th
                      className="py-3 px-5 cursor-pointer hover:text-stone-900 select-none"
                      onClick={() => handleSort("reason")}
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>Reason</span>
                        {sortField === "reason" ? (
                          <span className="text-stone-900 font-bold">
                            {sortOrder === "asc" ? "↑" : "↓"}
                          </span>
                        ) : (
                          <svg
                            className="w-3 h-3 text-stone-300"
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
                    <th
                      className="py-3 px-5 cursor-pointer hover:text-stone-900 select-none"
                      onClick={() => handleSort("markedDate")}
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>Marked date</span>
                        {sortField === "markedDate" ? (
                          <span className="text-stone-900 font-bold">
                            {sortOrder === "asc" ? "↑" : "↓"}
                          </span>
                        ) : (
                          <svg
                            className="w-3 h-3 text-stone-300"
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
                    <th className="py-3 px-5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f5f5f4] text-xs">
                  {paginatedLogs.map((log) => (
                    <tr
                      key={log._id}
                      className="hover:bg-[#fafaf9] transition-colors group"
                    >
                      <td className="py-3.5 px-5">
                        <div
                          className="cursor-pointer"
                          onClick={() => openEditDrawer(log)}
                        >
                          <p className="font-semibold text-stone-900 hover:underline">
                            {log.itemName}
                          </p>
                          {log.poNumber ? (
                            <p className="text-[11px] font-mono text-stone-500 mt-0.5">
                              PO: {log.poNumber} {log.supplierName ? `• ${log.supplierName}` : ""}
                            </p>
                          ) : log.supplierName ? (
                            <p className="text-[11px] text-stone-500 mt-0.5">
                              Supplier: {log.supplierName}
                            </p>
                          ) : (
                            <p className="text-[11px] text-stone-500 mt-0.5">Recorded log</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-stone-700 font-medium">
                        Inventory Item
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-rose-600">
                        {log.quantity} {log.unit}
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="inline-block font-mono text-[11px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200 font-medium">
                          {log.reasonForDeadStock}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-stone-900 font-medium whitespace-nowrap">
                        {formatStoreDate(log.markedDate, activeOrg?.country, activeOrg?.organizationTimeZone) || log.markedDate || "—"}
                      </td>
                      <td className="py-3.5 px-5 text-right relative">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveMenuId(activeMenuId === log._id ? null : log._id)
                          }
                          className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>
                        {activeMenuId === log._id && (
                          <div className="absolute right-5 top-11 w-36 bg-white border border-[#e7e5e4] rounded-lg shadow-lg py-1 z-30 text-left font-sans text-xs">
                            <button
                              type="button"
                              onClick={() => openEditDrawer(log)}
                              className="w-full text-left px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 cursor-pointer"
                            >
                              Edit record
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(log._id)}
                              className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 cursor-pointer"
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
            <div className="py-3.5 px-5 border-t border-[#e7e5e4] bg-[#fafaf9]/60 flex items-center justify-between text-xs text-[#78716c] shrink-0">
              <span>
                Showing{" "}
                <strong className="text-stone-900">
                  {filteredAndSortedLogs.length === 0
                    ? 0
                    : `${(currentPage - 1) * itemsPerPage + 1} - ${Math.min(
                        currentPage * itemsPerPage,
                        filteredAndSortedLogs.length
                      )}`}
                </strong>{" "}
                of <strong className="text-stone-900">{filteredAndSortedLogs.length}</strong> dead stock logs
              </span>
              <div className="flex items-center space-x-2 text-xs">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 border border-[#e7e5e4] rounded-lg bg-white text-stone-800 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs font-medium"
                >
                  Previous
                </button>
                <span className="px-2 font-medium text-stone-900">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 border border-[#e7e5e4] rounded-lg bg-white text-stone-800 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs font-medium"
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
          onClick={() => {
            setIsDrawerOpen(false);
            setShowSearchDropdown(false);
          }}
        />
      )}

      {/* SLIDE-OVER DRAWER: Record item dead stock (Matches Old Project Screenshot 2 Exactly) */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md md:max-w-lg bg-white border-l border-stone-200 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header: Record item dead stock */}
        <div className="p-6 border-b border-stone-200 flex items-center justify-between bg-white shrink-0">
          <h2 className="text-xl text-stone-900 font-semibold tracking-tight">
            Record item dead stock
          </h2>
          <button
            type="button"
            onClick={() => {
              setIsDrawerOpen(false);
              setShowSearchDropdown(false);
            }}
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

        {/* Drawer Form Body - All fields matching old screenshot */}
        <form
          id="deadStockFormRecord"
          onSubmit={handleFormSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-stone-800"
        >
          {/* Field 1: Inventory item/ Recipe * (Search Input with Icon & Clear button) */}
          <div className="relative">
            <label className="block font-medium mb-1.5 text-stone-800 text-[13px]">
              Inventory item/ Recipe <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <svg
                className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
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
                required
                className="w-full pl-10 pr-9 py-2.5 bg-[#fafaf8] text-xs md:text-[13px] border border-[#e5e7eb] rounded-md focus:outline-none focus:bg-white focus:ring-1 focus:ring-stone-900 transition placeholder:text-stone-400 font-medium text-stone-800"
                placeholder="Search by inventory item name/recipe"
                value={itemSearchText}
                onChange={(e) => {
                  setItemSearchText(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onFocus={() => setShowSearchDropdown(true)}
              />
              {itemSearchText && (
                <button
                  type="button"
                  onClick={() => {
                    setItemSearchText("");
                    setSelectedItemId("");
                    setShowSearchDropdown(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5 cursor-pointer"
                  title="Clear input"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {showSearchDropdown && inventoryItems && inventoryItems.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-stone-200 rounded-md shadow-lg z-50 py-1">
                  {inventoryItems
                    .filter((item) =>
                      item.name.toLowerCase().includes(itemSearchText.toLowerCase())
                    )
                    .map((item) => (
                      <button
                        key={item._id}
                        type="button"
                        className="w-full px-3.5 py-2 text-left text-xs hover:bg-stone-50 text-stone-900 font-medium transition cursor-pointer"
                        onClick={() => {
                          handleItemSelect(item._id);
                          setShowSearchDropdown(false);
                        }}
                      >
                        {item.name}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Field 2: Quantity * | (i) Measured unit */}
          <div className="grid grid-cols-3 gap-3 items-start">
            <div className="col-span-2">
              <label className="block font-medium mb-1.5 text-stone-800 text-[13px]">
                Quantity <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                required
                className="w-full px-3.5 py-2.5 bg-[#fafaf8] text-xs md:text-[13px] border border-[#e5e7eb] rounded-md focus:outline-none focus:bg-white focus:ring-1 focus:ring-stone-900 transition placeholder:text-stone-400 text-stone-800"
                placeholder="Enter the item quantity"
                value={quantity}
                onChange={(e) =>
                  setQuantity(e.target.value === "" ? "" : Number(e.target.value))
                }
              />
            </div>
            <div className="relative">
              <label className="block font-medium mb-1.5 text-stone-600 text-[13px] flex items-center space-x-1.5 group/tooltip cursor-pointer w-fit">
                <div className="relative flex items-center">
                  <svg
                    className="w-4 h-4 text-stone-400 group-hover/tooltip:text-stone-700 transition shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.75"
                      d="M12 11.5v4.5m0-7h.01"
                    />
                  </svg>
                  {/* Tooltip Popup on Hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:flex flex-col items-center pointer-events-none z-50 whitespace-nowrap">
                    <div className="bg-[#1c1917] text-white text-[11px] font-semibold px-3 py-1.5 rounded-md shadow-lg border border-stone-800">
                      Enter the amount of this item being marked as dead stock.
                    </div>
                    {/* Tooltip Arrow */}
                    <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-[#1c1917] -mt-px" />
                  </div>
                </div>
                <span>Measured unit</span>
              </label>
              <input
                type="text"
                disabled
                className="w-full px-3.5 py-2.5 bg-[#fafaf8] text-stone-600 border border-[#e5e7eb] rounded-md text-xs md:text-[13px] font-medium"
                value={unit}
              />
            </div>
          </div>

          {/* Field 3: Supplier */}
          <div>
            <label className="block font-medium mb-1.5 text-stone-800 text-[13px]">
              Supplier
            </label>
            <div className="relative">
              <select
                className="w-full px-3.5 py-2.5 bg-[#fafaf8] border border-[#e5e7eb] rounded-md focus:outline-none focus:bg-white focus:ring-1 focus:ring-stone-900 transition text-xs md:text-[13px] text-stone-800 font-medium appearance-none cursor-pointer pr-9"
                value={supplierId}
                onChange={(e) => {
                  const newSupId = e.target.value;
                  setSupplierId(newSupId);
                  if (poNumber) {
                    const matchingPo = purchaseOrders.find(
                      (p) => p.poNumber === poNumber && (!newSupId || p.supplierId === newSupId)
                    );
                    if (!matchingPo) setPoNumber("");
                  }
                }}
              >
                <option value="">Select supplier</option>
                {suppliers?.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.supplierName}
                  </option>
                ))}
              </select>
              <svg
                className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Field 4: PO number */}
          <div>
            <label className="block font-medium mb-1.5 text-stone-800 text-[13px]">
              PO number
            </label>
            <div className="relative">
              <select
                className="w-full px-3.5 py-2.5 bg-[#fafaf8] border border-[#e5e7eb] rounded-md focus:outline-none focus:bg-white focus:ring-1 focus:ring-stone-900 transition text-xs md:text-[13px] text-stone-800 font-medium appearance-none cursor-pointer pr-9"
                value={poNumber}
                onChange={(e) => {
                  const selectedPoNo = e.target.value;
                  setPoNumber(selectedPoNo);
                  if (selectedPoNo) {
                    const foundPo = purchaseOrders.find((p) => p.poNumber === selectedPoNo);
                    if (foundPo && foundPo.supplierId) {
                      setSupplierId(foundPo.supplierId);
                    }
                  }
                }}
              >
                <option value="">Search purchase order number</option>
                {purchaseOrders
                  .filter((p) => !supplierId || p.supplierId === supplierId)
                  .map((p) => (
                    <option key={p._id} value={p.poNumber}>
                      {p.poNumber} {p.supplierName ? `(${p.supplierName})` : ""}
                    </option>
                  ))}
              </select>
              <svg
                className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Field 5: Marked date */}
          <div>
            <label className="block font-medium mb-1.5 text-stone-800 text-[13px]">
              Marked date
            </label>
            <input
              type="date"
              className="w-full px-3.5 py-2.5 bg-[#fafaf8] border border-[#e5e7eb] rounded-md focus:outline-none focus:bg-white focus:ring-1 focus:ring-stone-900 transition text-xs md:text-[13px] text-stone-800 font-medium cursor-pointer"
              value={markedDate}
              min={yesterdayStr}
              max={todayStr}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  setMarkedDate(val);
                  return;
                }
                if (val > todayStr) {
                  setMarkedDate(todayStr);
                } else if (val < yesterdayStr) {
                  setMarkedDate(yesterdayStr);
                } else {
                  setMarkedDate(val);
                }
              }}
            />
            <p className="text-[11px] text-stone-500 mt-1.5">
              Note: Select a date to mark dead stock: only today and yesterday are allowed.
            </p>
          </div>

          {/* Field 6: Reason for recording dead stock */}
          <div>
            <label className="block font-medium mb-1.5 text-stone-800 text-[13px]">
              Reason for recording dead stock
            </label>
            <div className="relative">
              <select
                className="w-full px-3.5 py-2.5 bg-[#fafaf8] border border-[#e5e7eb] rounded-md focus:outline-none focus:bg-white focus:ring-1 focus:ring-stone-900 transition text-xs md:text-[13px] text-stone-800 font-medium appearance-none cursor-pointer pr-9"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="Expired">Expired</option>
                <option value="Damaged">Damaged</option>
                <option value="Low demand">Low demand</option>
              </select>
              <svg
                className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <p className="text-[11px] text-stone-500 mt-2 leading-relaxed">
              Note: You can edit dead stock quantities only on the same day they are recorded. After that, editing is locked; you may remove the entry and add a new one if needed.
            </p>
          </div>
        </form>

        {/* Drawer Footer Actions matching Screenshot 2 */}
        <div className="p-4 px-6 border-t border-stone-200 bg-white flex items-center justify-between space-x-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsDrawerOpen(false);
              setShowSearchDropdown(false);
            }}
            className="w-1/2 py-2.5 rounded-md bg-[#f3f4f6] hover:bg-[#e5e7eb] text-[#111827] text-xs font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="deadStockFormRecord"
            disabled={isSubmitting}
            className="w-1/2 py-2.5 rounded-md bg-[#111827] hover:bg-[#1f2937] text-white !text-white text-xs font-semibold transition shadow-xs cursor-pointer disabled:opacity-50"
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
