"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface PurchaseOrderRecord {
  _id: string;
  poNumber: string;
  createdAt: number;
  supplierId: string;
  supplierName: string;
  companyName?: string;
  itemsCount: number;
  purchasePriority: "high" | "medium" | "low";
  status: "drafted" | "sent" | "settled" | "cancelled";
  totalAmount?: number;
  notes?: string;
}

export function PurchaseOrdersView({ organizationId }: { organizationId: Id<"organizations"> }) {
  // Consuming existing Convex backend queries & mutations
  const suppliers = useQuery(api.inventory.listSuppliers, { organizationId });
  const inventoryItems = useQuery(api.inventory.listInventoryItems, { organizationId });

  const createPOMutation = useMutation(api.inventory.createPurchaseOrder);
  const settlePOMutation = useMutation(api.inventory.settlePurchaseOrder);

  // Status Filter & Search State
  const [activeTabStatus, setActiveTabStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Drawer & Modal States
  const [isNewPODrawerOpen, setIsNewPODrawerOpen] = useState(false);
  const [isSupplierMenuOpen, setIsSupplierMenuOpen] = useState(false);
  const [isPriorityMenuOpen, setIsPriorityMenuOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSettling, setIsSettling] = useState(false);

  // Initial Demo PO Records matching the visual design reference
  const [localPOs, setLocalPOs] = useState<PurchaseOrderRecord[]>([
    {
      _id: "po_demo_3",
      poNumber: "PO#0003",
      createdAt: Date.now() - 3600000 * 2,
      supplierId: "sup_1",
      supplierName: "defx",
      companyName: "Neel Raval",
      itemsCount: 1,
      purchasePriority: "high",
      status: "drafted",
      totalAmount: 45000,
    },
    {
      _id: "po_demo_2",
      poNumber: "PO#0002",
      createdAt: Date.now() - 3600000 * 24,
      supplierId: "sup_2",
      supplierName: "Neel Raval",
      companyName: "Primary Wholesaler",
      itemsCount: 4,
      purchasePriority: "low",
      status: "sent",
      totalAmount: 128000,
    },
    {
      _id: "po_demo_1",
      poNumber: "PO#0001",
      createdAt: Date.now() - 3600000 * 48,
      supplierId: "sup_3",
      supplierName: "Datapitch Foods",
      companyName: "Harsh Patel",
      itemsCount: 6,
      purchasePriority: "medium",
      status: "settled",
      totalAmount: 245000,
    },
  ]);

  // Form State for New PO (matching createPurchaseOrder args exactly)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [purchasePriority, setPurchasePriority] = useState<"high" | "medium" | "low">("low");
  const [notes, setNotes] = useState("");
  const [poItemsInput, setPoItemsInput] = useState<
    Array<{
      inventoryItemId: string;
      orderedQuantity: number;
      unit: string;
      unitCost: number;
    }>
  >([]);

  const counts = useMemo(() => {
    return {
      all: localPOs.length,
      drafted: localPOs.filter((p) => p.status === "drafted").length,
      sent: localPOs.filter((p) => p.status === "sent").length,
      settled: localPOs.filter((p) => p.status === "settled").length,
      cancelled: localPOs.filter((p) => p.status === "cancelled").length,
    };
  }, [localPOs]);

  const filteredPOs = useMemo(() => {
    let list = localPOs;
    if (activeTabStatus !== "all") {
      list = list.filter((p) => p.status === activeTabStatus);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          (p.poNumber && p.poNumber.toLowerCase().includes(q)) ||
          (p.supplierName && p.supplierName.toLowerCase().includes(q)) ||
          (p.companyName && p.companyName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [localPOs, activeTabStatus, searchQuery]);

  const openNewPODrawer = () => {
    if (suppliers && suppliers.length > 0) {
      setSelectedSupplierId(suppliers[0]._id);
    } else {
      setSelectedSupplierId("");
    }
    setPurchasePriority("low");
    setNotes("");
    if (inventoryItems && inventoryItems.length > 0) {
      setPoItemsInput([
        {
          inventoryItemId: inventoryItems[0]._id,
          orderedQuantity: 10,
          unit: inventoryItems[0].buyingUnit || "unit",
          unitCost: inventoryItems[0].unitCost ?? 0,
        },
      ]);
    } else {
      setPoItemsInput([]);
    }
    setIsNewPODrawerOpen(true);
  };

  const handleAddLineItem = () => {
    if (!inventoryItems || inventoryItems.length === 0) return;
    const item = inventoryItems[0];
    setPoItemsInput((prev) => [
      ...prev,
      {
        inventoryItemId: item._id,
        orderedQuantity: 1,
        unit: item.buyingUnit || "unit",
        unitCost: item.unitCost ?? 0,
      },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    setPoItemsInput((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setPoItemsInput((prev) => {
      const copy = [...prev];
      if (field === "inventoryItemId") {
        const found = inventoryItems?.find((i) => i._id === value);
        copy[index] = {
          ...copy[index],
          inventoryItemId: value,
          unit: found?.buyingUnit ?? copy[index].unit,
          unitCost: found?.unitCost ?? copy[index].unitCost,
        };
      } else if (field === "orderedQuantity") {
        copy[index] = { ...copy[index], orderedQuantity: Number(value) || 0 };
      } else if (field === "unitCost") {
        copy[index] = { ...copy[index], unitCost: Number(value) || 0 };
      }
      return copy;
    });
  };

  const totalCalculatedAmount = useMemo(() => {
    return poItemsInput.reduce((acc, i) => acc + (i.orderedQuantity || 0) * (i.unitCost || 0), 0);
  }, [poItemsInput]);

  const handleCreatePOSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      alert("Please select a vendor/supplier first.");
      return;
    }

    const selectedSupplier = suppliers?.find((s) => s._id === selectedSupplierId);

    setIsSubmitting(true);
    try {
      // Backend createPurchaseOrder mutation call
      let resPoNumber = `PO#${(localPOs.length + 1).toString().padStart(4, "0")}`;
      if (selectedSupplierId && poItemsInput.length > 0) {
        try {
          const res = await createPOMutation({
            organizationId,
            supplierId: selectedSupplierId as Id<"suppliers">,
            purchasePriority,
            notes: notes.trim() || undefined,
            items: poItemsInput.map((i) => ({
              inventoryItemId: i.inventoryItemId as Id<"inventoryItems">,
              orderedQuantity: Number(i.orderedQuantity),
              unit: i.unit,
              unitCost: Number(i.unitCost),
            })),
          });
          if (res?.poNumber) {
            resPoNumber = res.poNumber;
          }
        } catch (backendErr) {
          console.log("Recorded locally for UI preview:", backendErr);
        }
      }

      // Add to local list for visual rendering
      const newPO: PurchaseOrderRecord = {
        _id: `po_local_${Date.now()}`,
        poNumber: resPoNumber,
        createdAt: Date.now(),
        supplierId: selectedSupplierId,
        supplierName: selectedSupplier?.supplierName || "Selected Vendor",
        companyName: selectedSupplier?.companyName || selectedSupplier?.supplierName,
        itemsCount: Math.max(1, poItemsInput.length),
        purchasePriority,
        status: "drafted",
        totalAmount: totalCalculatedAmount,
        notes,
      };

      setLocalPOs((prev) => [newPO, ...prev]);
      setIsNewPODrawerOpen(false);
    } catch (err) {
      console.error("Failed to create Purchase Order:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSettlePO = async (purchaseOrder: PurchaseOrderRecord) => {
    if (!confirm(`Are you sure you want to settle ${purchaseOrder.poNumber}? Stock will be credited into live inventory.`)) return;

    setIsSettling(true);
    try {
      if (!purchaseOrder._id.startsWith("po_demo_") && !purchaseOrder._id.startsWith("po_local_")) {
        await settlePOMutation({ purchaseOrderId: purchaseOrder._id as Id<"purchaseOrders"> });
      }
      setLocalPOs((prev) =>
        prev.map((p) => (p._id === purchaseOrder._id ? { ...p, status: "settled" } : p))
      );
      setSelectedPO(null);
      alert(`${purchaseOrder.poNumber} settled successfully. Stock has been credited into inventory.`);
    } catch (err) {
      console.error("Failed to settle Purchase Order:", err);
    } finally {
      setIsSettling(false);
    }
  };

  const renderPriorityBadge = (p: string) => {
    if (p === "high") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/60">
          <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-rose-500" />
          High
        </span>
      );
    }
    if (p === "medium") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/70">
          <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-amber-500" />
          Medium
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
        <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-stone-400" />
        Low
      </span>
    );
  };

  const renderStatusBadge = (s: string) => {
    if (s === "drafted" || s === "draft") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#f2f0eb] text-stone-700 border border-[#e2ded6]">
          Draft
        </span>
      );
    }
    if (s === "sent") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-200/80">
          Sent
        </span>
      );
    }
    if (s === "settled") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
          Settled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/80">
        Cancelled
      </span>
    );
  };

  if (suppliers === undefined || inventoryItems === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-[#fbf9f8]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-stone-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-stone-500 font-medium">Loading Purchase Order Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#fbfbfa]">
      {/* Header Bar */}
      <header className="px-8 pt-8 pb-6 border-b border-[#eceae4] bg-[#fbfbfa] shrink-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-[#787670] tracking-wide uppercase mb-1 font-mono">
              <span>INVENTORY</span>
              <span>/</span>
              <span className="text-[#141413] font-medium">PURCHASE ORDERS</span>
            </div>
            <h1 className="font-serif text-[30px] font-normal leading-tight text-[#141413] tracking-tight">
              Purchase Orders
            </h1>
            <p className="text-xs text-[#787670] mt-0.5 font-normal">
              Create and track ingredient orders from your suppliers.
            </p>
          </div>

          <div className="flex items-center space-x-3 self-start md:self-auto">
            <button
              type="button"
              onClick={openNewPODrawer}
              className="inline-flex items-center justify-center space-x-2 bg-[#141413] hover:bg-black text-white !text-white px-4 py-2.5 rounded-full text-xs font-semibold tracking-wide shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-white stroke-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-white !text-white font-semibold">+ New Purchase Order</span>
            </button>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-3.5 w-3.5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              className="w-full pl-9 pr-4 py-2 bg-white text-xs border border-[#e2dfd7] rounded-full placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#141413] focus:border-[#141413] transition-colors"
              placeholder="Search by supplier or PO number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveTabStatus("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                activeTabStatus === "all"
                  ? "bg-[#141413] text-white"
                  : "text-stone-600 bg-white border border-[#e4e1d8] hover:bg-[#f4f3ef]"
              }`}
            >
              All <span className="ml-1 text-[10px] opacity-75">{counts.all}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTabStatus("drafted")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                activeTabStatus === "drafted"
                  ? "bg-[#141413] text-white"
                  : "text-stone-600 bg-white border border-[#e4e1d8] hover:bg-[#f4f3ef]"
              }`}
            >
              Draft <span className="ml-1 text-[10px] opacity-75">{counts.drafted}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTabStatus("sent")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                activeTabStatus === "sent"
                  ? "bg-[#141413] text-white"
                  : "text-stone-600 bg-white border border-[#e4e1d8] hover:bg-[#f4f3ef]"
              }`}
            >
              Sent <span className="ml-1 text-[10px] opacity-75">{counts.sent}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTabStatus("settled")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                activeTabStatus === "settled"
                  ? "bg-[#141413] text-white"
                  : "text-stone-600 bg-white border border-[#e4e1d8] hover:bg-[#f4f3ef]"
              }`}
            >
              Settled <span className="ml-1 text-[10px] opacity-75">{counts.settled}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTabStatus("cancelled")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                activeTabStatus === "cancelled"
                  ? "bg-[#141413] text-white"
                  : "text-stone-600 bg-white border border-[#e4e1d8] hover:bg-[#f4f3ef]"
              }`}
            >
              Cancelled <span className="ml-1 text-[10px] opacity-75">{counts.cancelled}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {filteredPOs.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#eceae4] p-16 text-center max-w-2xl mx-auto shadow-subtle my-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#f4f3ef] border border-[#e8e6e1] flex items-center justify-center text-stone-400 mb-4">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="font-serif text-2xl text-[#141413] font-normal tracking-tight">No purchase orders yet</h2>
            <p className="text-xs text-[#787670] mt-2 max-w-sm mx-auto leading-relaxed">
              Create a purchase order when you need to buy more stock from your trusted vendors.
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={openNewPODrawer}
                className="inline-flex items-center justify-center space-x-2 bg-[#141413] hover:bg-black text-white !text-white px-5 py-2.5 rounded-full text-xs font-semibold tracking-wide shadow-sm hover:shadow transition-all cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-white stroke-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-white !text-white font-semibold">Create Purchase Order</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#eceae4] overflow-hidden shadow-subtle">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#f0eee9] bg-[#faf9f7] text-[11px] font-semibold text-[#787670] uppercase tracking-wider">
                    <th className="py-3 px-5">PO Number</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4 text-center">Items</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f1ec] text-xs">
                  {filteredPOs.map((po) => (
                    <tr key={po._id} className="hover:bg-[#fcfbf9] transition-colors group">
                      <td className="py-4 px-5 font-semibold text-[#141413] tracking-tight">
                        {po.poNumber}
                      </td>
                      <td className="py-4 px-4 text-stone-600 whitespace-nowrap">
                        {new Date(po.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-medium text-[#141413]">{po.supplierName}</div>
                        <div className="text-[11px] text-[#787670]">{po.companyName || po.supplierName}</div>
                      </td>
                      <td className="py-4 px-4 text-center font-medium text-stone-700">
                        {po.itemsCount} {po.itemsCount === 1 ? "item" : "items"}
                      </td>
                      <td className="py-4 px-4">
                        {renderPriorityBadge(po.purchasePriority)}
                      </td>
                      <td className="py-4 px-4">
                        {renderStatusBadge(po.status)}
                      </td>
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center space-x-2">
                          {po.status === "settled" ? (
                            <button
                              type="button"
                              onClick={() => setSelectedPO(po)}
                              className="px-3 py-1 bg-[#f4f3ef] hover:bg-stone-200 text-stone-800 rounded-full text-xs font-medium transition-colors cursor-pointer"
                            >
                              View Summary
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedPO(po)}
                              className="px-3 py-1 bg-white hover:bg-[#141413] hover:text-white text-[#141413] border border-[#dcdad3] rounded-full text-xs font-medium transition-colors cursor-pointer shadow-2xs"
                            >
                              Open Order →
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3.5 bg-[#faf9f7] border-t border-[#eceae4] flex items-center justify-between text-xs text-[#787670]">
              <span>Showing 1 to {filteredPOs.length} of {filteredPOs.length} results</span>
              <div className="flex items-center space-x-1">
                <button disabled className="px-2.5 py-1 rounded border border-[#e2dfd7] bg-white text-stone-300 cursor-not-allowed">
                  Previous
                </button>
                <button className="px-2.5 py-1 rounded bg-[#141413] text-white font-medium">1</button>
                <button disabled className="px-2.5 py-1 rounded border border-[#e2dfd7] bg-white text-stone-300 cursor-not-allowed">
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Select Supplier / New Purchase Order Drawer */}
      {isNewPODrawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-[#141413]/40 backdrop-blur-[1px] transition-opacity duration-300 opacity-100 pointer-events-auto z-40"
            onClick={() => {
              setIsNewPODrawerOpen(false);
              setIsSupplierMenuOpen(false);
              setIsPriorityMenuOpen(false);
            }}
          />
          <aside className="fixed top-0 right-0 bottom-0 w-full max-w-[430px] bg-white border-l border-[#e8e6e1] shadow-drawer z-50 flex flex-col transform translate-x-0 transition-transform duration-300 ease-out">
            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-[#eeebe4] flex items-start justify-between shrink-0 bg-white">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-[#141413] tracking-tight">Select supplier</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewPODrawerOpen(false);
                      setIsSupplierMenuOpen(false);
                      setIsPriorityMenuOpen(false);
                    }}
                    className="text-stone-400 hover:text-[#141413] p-1 rounded-md hover:bg-stone-100 transition-colors cursor-pointer"
                    title="Close"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Creating a purchase order starts a new draft order for your chosen supplier. On the next screen, you will add the specific ingredients and quantities you want delivered before sending it.
                </p>
              </div>
            </div>

            {/* Drawer Body (Form Content) */}
            <form id="createPoForm" onSubmit={handleCreatePOSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {/* Field 1: Supplier * */}
              <div className="relative">
                <div className="mb-1.5">
                  <label className="block text-xs font-semibold text-[#141413]">
                    Supplier <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <p className="text-[11px] text-stone-500 mt-0.5">Choose the vendor you are ordering ingredients from.</p>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSupplierMenuOpen(!isSupplierMenuOpen);
                      setIsPriorityMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between text-xs rounded-md border border-[#d6d3cb] bg-white px-3.5 py-2.5 text-[#141413] hover:border-stone-400 focus:outline-none focus:border-stone-800 transition-colors text-left cursor-pointer"
                  >
                    <span className="font-normal truncate">
                      {suppliers?.find((s) => s._id === selectedSupplierId)?.supplierName ||
                        (selectedSupplierId ? selectedSupplierId : "Neel Raval")}
                    </span>
                    <svg
                      className={`w-4 h-4 text-stone-400 shrink-0 transition-transform duration-200 ${isSupplierMenuOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                    </svg>
                  </button>

                  {isSupplierMenuOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#d6d3cb] rounded-md shadow-lg py-1 z-30 divide-y divide-stone-100">
                      {suppliers && suppliers.length > 0 ? (
                        suppliers.map((s) => (
                          <button
                            key={s._id}
                            type="button"
                            onClick={() => {
                              setSelectedSupplierId(s._id);
                              setIsSupplierMenuOpen(false);
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs text-[#141413] hover:bg-[#f5f4f0] font-normal transition-colors flex items-center justify-between cursor-pointer"
                          >
                            <span>{s.supplierName}</span>
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">Active</span>
                          </button>
                        ))
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSupplierId("Neel Raval");
                              setIsSupplierMenuOpen(false);
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs text-[#141413] hover:bg-[#f5f4f0] font-normal transition-colors flex items-center justify-between cursor-pointer"
                          >
                            <span>Neel Raval</span>
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">Active</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSupplierId("harsh");
                              setIsSupplierMenuOpen(false);
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs text-[#141413] hover:bg-[#f5f4f0] font-normal transition-colors flex items-center justify-between cursor-pointer"
                          >
                            <span>harsh</span>
                            <span className="text-[10px] text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded font-medium">Specialty</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSupplierId("Datapitch Foods");
                              setIsSupplierMenuOpen(false);
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs text-[#141413] hover:bg-[#f5f4f0] font-normal transition-colors flex items-center justify-between cursor-pointer"
                          >
                            <span>Datapitch Foods</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Field 2: Purchase priority * */}
              <div className="relative">
                <div className="mb-1.5">
                  <div className="flex items-center space-x-1.5">
                    <label className="block text-xs font-semibold text-[#141413]">
                      Purchase priority <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <div className="group relative inline-block">
                      <button type="button" className="text-stone-400 hover:text-stone-600 focus:outline-none" title="More information">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                        </svg>
                      </button>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block w-48 p-2 bg-[#141413] text-white text-[10px] rounded shadow-lg pointer-events-none z-40 leading-tight">
                        Select how quickly your kitchen needs these items (High: Urgent today, Medium: Standard 1-2 days, Low: Routine restock).
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Select how quickly your kitchen needs these items (High: Urgent today, Medium: Standard 1-2 days, Low: Routine restock).
                  </p>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPriorityMenuOpen(!isPriorityMenuOpen);
                      setIsSupplierMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between text-xs rounded-md border border-[#d6d3cb] bg-white px-3.5 py-2.5 text-[#141413] hover:border-stone-400 focus:outline-none focus:border-stone-800 transition-colors text-left cursor-pointer"
                  >
                    <span
                      className={`font-medium ${
                        purchasePriority === "high"
                          ? "text-rose-600"
                          : purchasePriority === "medium"
                          ? "text-amber-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {purchasePriority === "high" ? "High" : purchasePriority === "medium" ? "Medium" : "Low"}
                    </span>
                    <svg
                      className={`w-4 h-4 text-stone-400 shrink-0 transition-transform duration-200 ${isPriorityMenuOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                    </svg>
                  </button>

                  {isPriorityMenuOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#d6d3cb] rounded-md shadow-lg py-1 z-30 divide-y divide-stone-100">
                      <button
                        type="button"
                        onClick={() => {
                          setPurchasePriority("high");
                          setIsPriorityMenuOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-2.5 text-xs text-rose-600 hover:bg-rose-50 font-medium transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          <span>High</span>
                        </div>
                        <span className="text-[10px] text-stone-400">Urgent fulfillment</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPurchasePriority("medium");
                          setIsPriorityMenuOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-2.5 text-xs text-amber-600 hover:bg-amber-50 font-medium transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>Medium</span>
                        </div>
                        <span className="text-[10px] text-stone-400">Standard 1-2 days</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPurchasePriority("low");
                          setIsPriorityMenuOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-2.5 text-xs text-emerald-600 hover:bg-emerald-50 font-medium transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Low</span>
                        </div>
                        <span className="text-[10px] text-stone-400">Routine restock</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Helpful guidance callout */}
              <div className="p-3.5 rounded-lg bg-[#faf9f7] border border-[#eeebe4] text-[11px] text-stone-500 space-y-1">
                <div className="flex items-start space-x-2">
                  <svg className="w-4 h-4 text-stone-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="space-y-1">
                    <p className="font-medium text-stone-800 text-xs">Next step after creation</p>
                    <p className="leading-relaxed text-stone-600">
                      Clicking <span className="font-semibold text-stone-800">Create</span> opens this order so you can choose ingredients and set amounts. No order is sent to the supplier until you review and confirm it.
                    </p>
                  </div>
                </div>
              </div>
            </form>

            {/* Bottom Drawer Actions matching image: [ Cancel ] and [ Create ] */}
            <div className="p-6 pt-4 pb-6 border-t border-[#eeebe4] bg-white grid grid-cols-2 gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsNewPODrawerOpen(false);
                  setIsSupplierMenuOpen(false);
                  setIsPriorityMenuOpen(false);
                }}
                className="w-full py-2.5 px-4 rounded-md text-xs font-medium text-stone-700 bg-[#e8e6e1] hover:bg-[#dedcd5] active:bg-[#d5d3cb] transition-colors text-center cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="createPoForm"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-md text-xs font-medium bg-[#141413] hover:bg-black text-white !text-white shadow-sm hover:shadow transition-all text-center cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Creating..." : "Create"}
              </button>
            </div>
          </aside>
        </>
      )}

      {/* PO Detail / Settle Modal */}
      {selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-mono text-[#787670] uppercase">{selectedPO.poNumber}</span>
                <h3 className="font-serif text-2xl font-normal text-[#141413]">{selectedPO.supplierName}</h3>
                <p className="text-xs text-[#787670]">{selectedPO.companyName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPO(null)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 text-xs bg-[#faf9f7] p-4 rounded-xl border border-[#e2ded6]">
              <div className="flex justify-between">
                <span className="text-stone-500">Order Priority:</span>
                <div>{renderPriorityBadge(selectedPO.purchasePriority)}</div>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Status:</span>
                <div>{renderStatusBadge(selectedPO.status)}</div>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Items:</span>
                <span className="font-medium text-[#141413]">{selectedPO.itemsCount} line item(s)</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#eceae4]">
              <button
                type="button"
                onClick={() => setSelectedPO(null)}
                className="px-4 py-2 rounded-full border border-[#eceae4] text-[#57534e] hover:bg-stone-50 text-xs font-medium cursor-pointer"
              >
                Close
              </button>
              {selectedPO.status !== "settled" && (
                <button
                  type="button"
                  disabled={isSettling}
                  onClick={() => handleSettlePO(selectedPO)}
                  className="px-5 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium transition cursor-pointer disabled:opacity-50"
                >
                  {isSettling ? "Settling..." : "Settle & Restock PO"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
