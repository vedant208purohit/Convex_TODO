"use client";

import React, { useState, useMemo, useRef, Fragment } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  formatCurrencyAmount,
  getCurrencyForCountry,
  formatStoreDate,
} from "@/lib/constants/countries";
import { downloadPurchaseOrderPdf } from "@/app/utils/generatePurchaseOrderPdf";

export interface PurchaseOrderItem {
  _id?: string;
  id?: string;
  inventoryItemId: string;
  name: string;
  category: string;
  stock: string;
  stockPercentage: number;
  sku: string;
  buyingUnit: string;
  orderedQuantity: number;
  receivedQuantity?: number;
  missingQuantity?: number;
  unitCost: number;
  totalCost?: number;
  isReceived?: boolean;
  isMissing?: boolean;
}

export function PurchaseOrdersView({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const organizations = useQuery(api.organizations.list);
  const activeOrg =
    organizations?.find((o) => o?._id === organizationId) || organizations?.[0];
  const currencySymbol =
    activeOrg?.defaultCurrencySymbol ||
    (activeOrg?.country
      ? getCurrencyForCountry(activeOrg.country).symbol
      : "₹");

  // Live Convex Queries
  const suppliers = useQuery(api.inventory.listSuppliers, { organizationId });
  const inventoryItems = useQuery(api.inventory.listInventoryItems, { organizationId });
  const rawPOs = useQuery(api.inventory.listPurchaseOrders, { organizationId });
  const allPOs = useMemo(() => rawPOs ?? [], [rawPOs]);

  // Active PO state (if not null, renders the Detail/Add Items Screen matching Screenshot 1 & 2)
  const [activePoId, setActivePoId] = useState<Id<"purchaseOrders"> | null>(null);
  const activePODetails = useQuery(
    api.inventory.getPurchaseOrder,
    activePoId ? { purchaseOrderId: activePoId } : "skip"
  );

  // Live Convex Mutations
  const createPOMutation = useMutation(api.inventory.createPurchaseOrder);
  const addItemsMutation = useMutation(api.inventory.addItemsToPurchaseOrder);
  const removeItemsMutation = useMutation(api.inventory.removePurchaseOrderItems);
  const updateItemQtyMutation = useMutation(api.inventory.updatePurchaseOrderItemQuantity);
  const autoFillQtyMutation = useMutation(api.inventory.autoFillPOOrderedQuantity);
  const placePOMutation = useMutation(api.inventory.placePurchaseOrder);
  const cancelPOMutation = useMutation(api.inventory.cancelPurchaseOrder);
  const updateReceivingMutation = useMutation(api.inventory.updatePOItemReceivingStatus);
  const settlePOMutation = useMutation(api.inventory.settlePurchaseOrder);
  const attachPOInvoiceMutation = useMutation(api.inventory.attachPOInvoice);

  // R2 Storage Actions for Invoice Upload
  const createAssetUpload = useAction(api.r2.createAssetUpload);
  const confirmAssetUpload = useAction(api.r2.confirmAssetUpload);
  const invoiceFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState<string | null>(null);

  // List View Filter & Search State
  const [activeTabStatus, setActiveTabStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPoIds, setExpandedPoIds] = useState<Record<string, boolean>>({});
  const [openRowMenuPoId, setOpenRowMenuPoId] = useState<string | null>(null);

  // Create PO Drawer State
  const [isNewPODrawerOpen, setIsNewPODrawerOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [purchasePriority, setPurchasePriority] = useState<"high" | "medium" | "low">("low");
  const [poNotes, setPoNotes] = useState("");
  const [isCreatingPO, setIsCreatingPO] = useState(false);

  // Prefill Modal State (Screenshot 1)
  const [isPrefillModalOpen, setIsPrefillModalOpen] = useState(false);
  const [hasPromptedPrefillForPo, setHasPromptedPrefillForPo] = useState<Record<string, boolean>>({});

  // Add Item Drawer (inside Add Items screen)
  const [isAddItemDrawerOpen, setIsAddItemDrawerOpen] = useState(false);
  const [addItemSearchQuery, setAddItemSearchQuery] = useState("");

  // Table Selection & Actions Menu State (Screenshot 2)
  const [detailSearchQuery, setDetailSearchQuery] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);

  // Confirmation Modals State
  const [isPlaceOrderConfirmOpen, setIsPlaceOrderConfirmOpen] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isSettleConfirmOpen, setIsSettleConfirmOpen] = useState(false);
  const [isPerformingAction, setIsPerformingAction] = useState(false);

  // Placed Order Detail Tabs: "ordered" | "received" | "missing"
  const [detailTab, setDetailTab] = useState<"ordered" | "received" | "missing">("ordered");

  // Toast message state
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Status Counts for List View Tabs
  const counts = useMemo(() => {
    return {
      all: allPOs.length,
      drafted: allPOs.filter((p: any) => p.status === "drafted").length,
      sent: allPOs.filter((p: any) => p.status === "sent" || p.status === "partially_received").length,
      settled: allPOs.filter((p: any) => p.status === "settled").length,
      cancelled: allPOs.filter((p: any) => p.status === "cancelled").length,
    };
  }, [allPOs]);

  // Filtered List of POs
  const filteredPOs = useMemo(() => {
    let list = allPOs;
    if (activeTabStatus !== "all") {
      if (activeTabStatus === "sent") {
        list = list.filter((p: any) => p.status === "sent" || p.status === "partially_received");
      } else {
        list = list.filter((p: any) => p.status === activeTabStatus);
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p: any) =>
          (p.poNumber && p.poNumber.toLowerCase().includes(q)) ||
          (p.supplierName && p.supplierName.toLowerCase().includes(q)) ||
          (p.companyName && p.companyName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [allPOs, activeTabStatus, searchQuery]);

  // Check if Prefill Modal should automatically show on entering PO
  React.useEffect(() => {
    if (
      activePODetails &&
      activePODetails.status === "drafted" &&
      activePODetails.items.length === 0 &&
      (activePODetails.supplierItemsCount ?? 0) > 0 &&
      !hasPromptedPrefillForPo[activePODetails._id]
    ) {
      setHasPromptedPrefillForPo((prev) => ({ ...prev, [activePODetails._id]: true }));
      setIsPrefillModalOpen(true);
    }
  }, [activePODetails, hasPromptedPrefillForPo]);

  // Handler: Create Purchase Order (Draft)
  const handleCreatePOSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      showToast("Please select a supplier.", "error");
      return;
    }

    setIsCreatingPO(true);
    try {
      const res = await createPOMutation({
        organizationId,
        supplierId: selectedSupplierId as Id<"suppliers">,
        purchasePriority,
        notes: poNotes.trim() || undefined,
        items: [],
      });

      setIsNewPODrawerOpen(false);
      setSelectedSupplierId("");
      setPoNotes("");
      setPurchasePriority("low");

      if (res?.purchaseOrderId) {
        setActivePoId(res.purchaseOrderId as Id<"purchaseOrders">);
      }
      showToast(`Purchase order ${res.poNumber} created.`, "success");
    } catch (err: any) {
      console.error("Failed to create PO:", err);
      showToast(err?.message || "Failed to create purchase order.", "error");
    } finally {
      setIsCreatingPO(false);
    }
  };

  // Handler: Prefill Assigned Items (Screenshot 1 & 2 Action)
  const handlePrefillAssignedItems = async () => {
    if (!activePODetails || !activePODetails.supplierAssignedItemIds) return;
    setIsPerformingAction(true);
    try {
      await addItemsMutation({
        organizationId,
        purchaseOrderId: activePODetails._id,
        inventoryItemIds: activePODetails.supplierAssignedItemIds,
      });
      setIsPrefillModalOpen(false);
      setIsActionsMenuOpen(false);
      showToast(
        `Prefilled ${activePODetails.supplierAssignedItemIds.length} assigned item(s).`,
        "success"
      );
    } catch (err: any) {
      console.error("Failed to prefill items:", err);
      showToast(err?.message || "Failed to prefill items.", "error");
    } finally {
      setIsPerformingAction(false);
    }
  };

  // Handler: Add Single Item from Item Picker Drawer
  const handleAddItemToPO = async (inventoryItemId: Id<"inventoryItems">) => {
    if (!activePODetails) return;
    try {
      await addItemsMutation({
        organizationId,
        purchaseOrderId: activePODetails._id,
        inventoryItemIds: [inventoryItemId],
      });
      showToast("Item added to purchase order.", "success");
    } catch (err: any) {
      console.error("Failed to add item:", err);
      showToast(err?.message || "Failed to add item.", "error");
    }
  };

  // Handler: Remove Selected Items
  const handleRemoveSelectedItems = async () => {
    if (!activePODetails || selectedItemIds.length === 0) return;
    setIsPerformingAction(true);
    try {
      await removeItemsMutation({
        purchaseOrderId: activePODetails._id,
        purchaseOrderItemIds: selectedItemIds as Id<"purchaseOrderItems">[],
      });
      setSelectedItemIds([]);
      setIsActionsMenuOpen(false);
      showToast("Selected items removed from purchase order.", "success");
    } catch (err: any) {
      console.error("Failed to remove items:", err);
      showToast(err?.message || "Failed to remove items.", "error");
    } finally {
      setIsPerformingAction(false);
    }
  };

  // Handler: Autofill Quantity
  const handleAutofillQuantity = async () => {
    if (!activePODetails) return;
    setIsPerformingAction(true);
    try {
      await autoFillQtyMutation({
        purchaseOrderId: activePODetails._id,
      });
      setIsActionsMenuOpen(false);
      showToast("Quantities auto-calculated from refill requirements.", "success");
    } catch (err: any) {
      console.error("Failed to autofill quantity:", err);
      showToast(err?.message || "Failed to autofill quantity.", "error");
    } finally {
      setIsPerformingAction(false);
    }
  };

  // Handler: Item Quantity Change in table input
  const handleItemQtyChange = async (
    purchaseOrderItemId: Id<"purchaseOrderItems">,
    qtyValue: string
  ) => {
    const num = parseFloat(qtyValue);
    const validQty = isNaN(num) || num < 0 ? 0 : num;
    try {
      await updateItemQtyMutation({
        purchaseOrderItemId,
        orderedQuantity: validQty,
      });
    } catch (err) {
      console.error("Failed to update item quantity:", err);
    }
  };

  // Handler: Place Order (Screenshot 2: Place order button)
  const handleConfirmPlaceOrder = async () => {
    if (!activePODetails) return;
    setIsPerformingAction(true);
    try {
      await placePOMutation({
        purchaseOrderId: activePODetails._id,
      });
      setIsPlaceOrderConfirmOpen(false);
      showToast(`Purchase order ${activePODetails.poNumber} placed successfully!`, "success");
    } catch (err: any) {
      console.error("Failed to place purchase order:", err);
      showToast(err?.message || "Failed to place purchase order.", "error");
    } finally {
      setIsPerformingAction(false);
    }
  };

  // Handler: Cancel Purchase Order
  const handleConfirmCancelPO = async () => {
    if (!activePODetails) return;
    setIsPerformingAction(true);
    try {
      await cancelPOMutation({
        purchaseOrderId: activePODetails._id,
        reason: "Cancelled by store manager",
      });
      setIsCancelConfirmOpen(false);
      setIsActionsMenuOpen(false);
      showToast(`Purchase order ${activePODetails.poNumber} cancelled.`, "success");
    } catch (err: any) {
      console.error("Failed to cancel purchase order:", err);
      showToast(err?.message || "Failed to cancel purchase order.", "error");
    } finally {
      setIsPerformingAction(false);
    }
  };

  // Handler: Cancel Single PO from table row action menu
  const handleCancelSinglePO = async (po: any) => {
    if (!confirm(`Are you sure you want to cancel purchase order ${po.poNumber}?`)) return;
    try {
      await cancelPOMutation({
        purchaseOrderId: po._id,
        reason: "Cancelled by store manager",
      });
      showToast(`Purchase order ${po.poNumber} cancelled.`, "success");
    } catch (err: any) {
      console.error("Failed to cancel purchase order:", err);
      showToast(err?.message || "Failed to cancel purchase order.", "error");
    }
  };

  // Handler: Mark Items Received / Missing
  const handleUpdateItemReceiving = async (statusType: "received" | "missing") => {
    if (!activePODetails || selectedItemIds.length === 0) return;
    setIsPerformingAction(true);
    try {
      await updateReceivingMutation({
        purchaseOrderId: activePODetails._id,
        itemIds: selectedItemIds as Id<"purchaseOrderItems">[],
        statusType,
      });
      setSelectedItemIds([]);
      setIsActionsMenuOpen(false);
      showToast(`Items marked as ${statusType}.`, "success");
    } catch (err: any) {
      console.error("Failed to update receiving status:", err);
      showToast(err?.message || "Failed to update item receiving status.", "error");
    } finally {
      setIsPerformingAction(false);
    }
  };

  // Handler: Settle PO & Credit live inventory
  const handleConfirmSettlePO = async () => {
    if (!activePODetails) return;
    setIsPerformingAction(true);
    try {
      await settlePOMutation({
        purchaseOrderId: activePODetails._id,
      });
      setIsSettleConfirmOpen(false);
      showToast(`${activePODetails.poNumber} settled. Live stock updated!`, "success");
    } catch (err: any) {
      console.error("Failed to settle PO:", err);
      showToast(err?.message || "Failed to settle purchase order.", "error");
    } finally {
      setIsPerformingAction(false);
    }
  };

  // Handler: Upload Invoice to Cloudflare R2
  const handleInvoiceFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activePODetails || !activeOrg?._id) return;

    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      showToast("Invalid file type. Please select PDF, JPG, or PNG.", "error");
      e.target.value = "";
      return;
    }

    setIsUploadingInvoice(true);
    setUploadStatusText("Uploading invoice to R2...");
    try {
      const uploadResult = await createAssetUpload({
        assetType: "invoice_pdf",
        fileName: file.name,
        contentType: file.type || "application/pdf",
        fileSize: file.size,
        organizationId: activeOrg._id,
      });

      const putRes = await fetch(uploadResult.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });

      if (!putRes.ok) throw new Error("Failed to upload invoice to storage.");

      await confirmAssetUpload({ assetId: uploadResult.assetId });

      await attachPOInvoiceMutation({
        purchaseOrderId: activePODetails._id,
        invoiceStorageKey: uploadResult.storageKey,
        invoiceAssetId: uploadResult.assetId,
      });

      showToast("Supplier invoice uploaded successfully!", "success");
    } catch (err: any) {
      console.error("Failed to upload supplier invoice:", err);
      showToast(err?.message || "Failed to upload invoice.", "error");
    } finally {
      setIsUploadingInvoice(false);
      setUploadStatusText(null);
      if (e.target) e.target.value = "";
    }
  };

  // Loading state
  if (suppliers === undefined || inventoryItems === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-[#fbf9f8]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-stone-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-stone-500 font-medium">Loading Purchase Orders...</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: ADD ITEMS IN PO#XXXX (EXACT MATCH FOR SCREENSHOT 1 & 2)
  // =========================================================================
  if (activePoId && activePODetails) {
    const items = activePODetails.items || [];
    const filteredDetailItems = items.filter((item: any) => {
      if (!detailSearchQuery.trim()) return true;
      const q = detailSearchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.sku && item.sku.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    });

    const isAllSelected =
      filteredDetailItems.length > 0 &&
      filteredDetailItems.every((it: any) => selectedItemIds.includes(it._id));

    const totalPOAmount = items.reduce(
      (acc: number, it: any) => acc + (it.orderedQuantity || 0) * (it.unitCost || 0),
      0
    );

    const hasItemsWithQty = items.some((it: any) => (it.orderedQuantity || 0) > 0);

    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#faf9f8] p-6 md:p-8 space-y-6">
        {/* Toast Notification */}
        {toastMessage && (
          <div
            className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-semibold flex items-center space-x-2 transition ${
              toastMessage.type === "success"
                ? "bg-emerald-900 border-emerald-800 text-white"
                : "bg-rose-900 border-rose-800 text-white"
            }`}
          >
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* 1. Header & Breadcrumb (Screenshot 2: Purchase order > Add items in) */}
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs text-[#78716c]">
            <button
              type="button"
              onClick={() => {
                setActivePoId(null);
                setSelectedItemIds([]);
                setDetailSearchQuery("");
              }}
              className="hover:text-[#0c0a09] font-medium transition cursor-pointer"
            >
              Purchase order
            </button>
            <span>&gt;</span>
            <span className="text-[#0c0a09] font-medium">Add items in</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0c0a09] tracking-tight">
              Add items in {activePODetails.poNumber}
            </h1>

            {/* If PO is in Sent status, show Settle Button */}
            {activePODetails.status === "sent" && (
              <button
                type="button"
                onClick={() => setIsSettleConfirmOpen(true)}
                className="px-5 py-2.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white !text-white text-xs font-semibold shadow-sm transition cursor-pointer flex items-center space-x-2 shrink-0 self-start sm:self-auto"
              >
                <span>Settle & Restock PO</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Top Action Controls Bar (Screenshot 2: Search input + Actions button + Place order button) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search by item name, sku no"
              value={detailSearchQuery}
              onChange={(e) => setDetailSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-[#e7e5e4] rounded-lg focus:outline-none focus:border-stone-800 shadow-2xs"
            />
            <svg
              className="w-4 h-4 text-stone-400 absolute left-3 top-2.5"
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
          </div>

          {/* Action Buttons: Actions dropdown + Place order */}
          <div className="flex items-center space-x-3 relative">
            {/* Actions Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsActionsMenuOpen(!isActionsMenuOpen)}
                className="px-4 py-2 bg-white border border-[#d6d3d1] hover:border-stone-800 text-[#0c0a09] rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-2 shadow-2xs"
              >
                <span>Actions</span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${isActionsMenuOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isActionsMenuOpen && (
                <div className="absolute right-0 top-11 w-52 bg-white border border-[#e7e5e4] rounded-xl shadow-xl py-1.5 z-40 text-left divide-y divide-[#f5f5f4] text-xs">
                  {/* Actions for Drafted PO */}
                  {activePODetails.status === "drafted" && (
                    <>
                      <div className="py-1">
                        <button
                          type="button"
                          disabled={(activePODetails.supplierItemsCount ?? 0) === 0}
                          onClick={handlePrefillAssignedItems}
                          className="w-full text-left px-3.5 py-2 text-stone-700 hover:bg-stone-50 transition cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                          Prefill assigned items
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsActionsMenuOpen(false);
                            setIsAddItemDrawerOpen(true);
                          }}
                          className="w-full text-left px-3.5 py-2 text-stone-700 hover:bg-stone-50 transition cursor-pointer"
                        >
                          Add new item
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedItemIds(filteredDetailItems.map((i: any) => i._id));
                            setIsActionsMenuOpen(false);
                          }}
                          className="w-full text-left px-3.5 py-2 text-stone-700 hover:bg-stone-50 transition cursor-pointer"
                        >
                          Select all items
                        </button>
                        <button
                          type="button"
                          disabled={selectedItemIds.length === 0}
                          onClick={handleRemoveSelectedItems}
                          className="w-full text-left px-3.5 py-2 text-stone-700 hover:bg-stone-50 transition cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                          Remove selected items
                        </button>
                        <button
                          type="button"
                          onClick={handleAutofillQuantity}
                          className="w-full text-left px-3.5 py-2 text-stone-700 hover:bg-stone-50 transition cursor-pointer"
                        >
                          Autofill quantity
                        </button>
                      </div>
                    </>
                  )}

                  {/* Actions for Sent / Placed PO */}
                  {activePODetails.status === "sent" && (
                    <div className="py-1">
                      <button
                        type="button"
                        disabled={selectedItemIds.length === 0}
                        onClick={() => handleUpdateItemReceiving("received")}
                        className="w-full text-left px-3.5 py-2 text-emerald-700 hover:bg-emerald-50 transition cursor-pointer disabled:opacity-40"
                      >
                        Selected items received
                      </button>
                      <button
                        type="button"
                        disabled={selectedItemIds.length === 0}
                        onClick={() => handleUpdateItemReceiving("missing")}
                        className="w-full text-left px-3.5 py-2 text-rose-700 hover:bg-rose-50 transition cursor-pointer disabled:opacity-40"
                      >
                        Selected items missing
                      </button>
                    </div>
                  )}

                  {/* Common Actions */}
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsMenuOpen(false);
                        downloadPurchaseOrderPdf({ po: activePODetails, org: activeOrg });
                      }}
                      className="w-full text-left px-3.5 py-2 text-stone-700 hover:bg-stone-50 transition cursor-pointer"
                    >
                      Download PDF
                    </button>
                    {activePODetails.status !== "cancelled" && activePODetails.status !== "settled" && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsActionsMenuOpen(false);
                          setIsCancelConfirmOpen(true);
                        }}
                        className="w-full text-left px-3.5 py-2 text-rose-600 hover:bg-rose-50 font-medium transition cursor-pointer"
                      >
                        Cancel PO
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Place Order Button (Screenshot 2) */}
            {activePODetails.status === "drafted" && (
              <button
                type="button"
                disabled={!hasItemsWithQty || isPerformingAction}
                onClick={() => setIsPlaceOrderConfirmOpen(true)}
                className={`px-5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs ${
                  hasItemsWithQty
                    ? "bg-[#1c1917] hover:bg-[#292524] text-white !text-white"
                    : "bg-[#78716c] text-[#d6d3d1] cursor-not-allowed opacity-80"
                }`}
              >
                Place order
              </button>
            )}
          </div>
        </div>

        {/* 3. Items Table (Screenshot 2) */}
        <div className="bg-white border border-[#e7e5e4] rounded-xl overflow-hidden shadow-2xs">
          {filteredDetailItems.length === 0 ? (
            <div className="py-16 text-center text-stone-400 text-xs">
              <p className="font-medium text-stone-500 mb-1">No items added to this purchase order yet.</p>
              <p className="text-[11px]">Use "Actions &gt; Prefill assigned items" or "Add new item" to populate items.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#e7e5e4] bg-[#fafaf9] text-[11px] font-semibold text-[#78716c]">
                    <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItemIds(filteredDetailItems.map((i: any) => i._id));
                          } else {
                            setSelectedItemIds([]);
                          }
                        }}
                        className="rounded border-stone-300 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4 w-16">Sr no</th>
                    <th className="py-3 px-6">Item name</th>
                    <th className="py-3 px-6 w-64">Available stock</th>
                    <th className="py-3 px-6 w-32">SKU no</th>
                    <th className="py-3 px-6 w-44">Item quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f5f5f4]">
                  {filteredDetailItems.map((item: any, idx: number) => {
                    const isSelected = selectedItemIds.includes(item._id);
                    const stockNum = parseFloat(item.stock) || 0;
                    // Visual stock bar: 100% when stock >= 100 or baseline, proportional fill
                    const stockFillPercent = Math.min(100, Math.max(8, (stockNum / 100) * 100));

                    return (
                      <tr
                        key={item._id}
                        className={`hover:bg-[#fafaf9] transition-colors ${
                          isSelected ? "bg-stone-50" : ""
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-4 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedItemIds((prev) => [...prev, item._id]);
                              } else {
                                setSelectedItemIds((prev) => prev.filter((id) => id !== item._id));
                              }
                            }}
                            className="rounded border-stone-300 cursor-pointer"
                          />
                        </td>

                        {/* Sr no */}
                        <td className="py-4 px-4 text-stone-500 font-medium">{idx + 1}</td>

                        {/* Item name + Category (Screenshot 2: bold name, category underneath) */}
                        <td className="py-4 px-6">
                          <p className="font-bold text-[#0c0a09]">{item.name}</p>
                          <p className="text-[11px] text-[#78716c]">{item.category || "Beverages"}</p>
                        </td>

                        {/* Available Stock + Progress Bar (Screenshot 2) */}
                        <td className="py-4 px-6">
                          <div className="w-48 space-y-1">
                            <div className="text-[11px] font-medium text-right text-stone-600">
                              {item.stock}
                            </div>
                            {/* Horizontal Progress Bar */}
                            <div className="w-full h-3 bg-[#e7e5e4] rounded-sm overflow-hidden p-0.5">
                              <div
                                className="h-full bg-[#16a34a] rounded-xs transition-all"
                                style={{ width: `${stockFillPercent}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* SKU no */}
                        <td className="py-4 px-6 text-stone-500 text-xs">
                          {item.sku || "—"}
                        </td>

                        {/* Item quantity (Screenshot 2: Input box "Enter quantity") */}
                        <td className="py-4 px-6">
                          {activePODetails.status === "drafted" ? (
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="Enter quantity"
                              defaultValue={item.orderedQuantity > 0 ? item.orderedQuantity : ""}
                              onBlur={(e) => handleItemQtyChange(item._id, e.target.value)}
                              className="w-32 px-3 py-1.5 border border-[#d6d3d1] rounded-md text-xs font-medium focus:outline-none focus:border-stone-800 bg-white shadow-2xs"
                            />
                          ) : (
                            <div className="font-semibold text-stone-900">
                              {item.orderedQuantity} {item.buyingUnit}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Footer with Summary */}
          <div className="py-3 px-6 bg-[#fafaf9] border-t border-[#e7e5e4] flex items-center justify-between text-xs text-stone-500">
            <span>
              Showing <strong>{filteredDetailItems.length}</strong> items in purchase order
            </span>
            <span className="font-medium text-[#0c0a09]">
              Estimated Cost: {currencySymbol}
              {formatCurrencyAmount(totalPOAmount, activeOrg?.country)}
            </span>
          </div>
        </div>

        {/* 4. PREFILL MODAL (EXACT MATCH FOR SCREENSHOT 1) */}
        {isPrefillModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
            <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-lg w-full p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <h3 className="text-base sm:text-lg font-bold text-[#0c0a09] leading-snug">
                Would you like to prefill all the items assigned to the supplier or search &amp; add the items manually in PO?
              </h3>

              <div className="text-xs text-[#57534e] space-y-1 bg-[#fafaf9] p-3.5 rounded-xl border border-stone-200/80">
                <p>
                  <strong className="text-stone-700">Supplier:</strong>{" "}
                  {activePODetails.companyName || activePODetails.supplierName}
                </p>
                <p>
                  <strong className="text-stone-700">Total items assigned:</strong>{" "}
                  {activePODetails.supplierItemsCount ?? 0}
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                {/* Secondary Button: Search & Add Items Manually */}
                <button
                  type="button"
                  onClick={() => {
                    setIsPrefillModalOpen(false);
                    setIsAddItemDrawerOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-lg bg-[#e7e5e4] hover:bg-[#d6d3d1] text-[#1c1917] text-xs font-semibold transition cursor-pointer"
                >
                  Search &amp; Add Items Manually
                </button>

                {/* Primary Button: Prefill Assigned Items */}
                <button
                  type="button"
                  disabled={isPerformingAction}
                  onClick={handlePrefillAssignedItems}
                  className="px-5 py-2.5 rounded-lg bg-[#1c1917] hover:bg-[#292524] text-white !text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  Prefill Assigned Items ({activePODetails.supplierItemsCount ?? 0})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. ADD ITEM DRAWER (Search & pick from item library) */}
        {isAddItemDrawerOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-2xs">
            <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
              <div className="p-5 border-b border-[#e7e5e4] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-[#0c0a09]">Add Items to Purchase Order</h3>
                  <p className="text-[11px] text-stone-500">Pick items from your inventory catalog</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddItemDrawerOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 border-b border-[#e7e5e4]">
                <input
                  type="text"
                  placeholder="Search item name or SKU..."
                  value={addItemSearchQuery}
                  onChange={(e) => setAddItemSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#d6d3d1] rounded-lg focus:outline-none focus:border-stone-800"
                />
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-[#f5f5f4] p-2">
                {(inventoryItems ?? [])
                  .filter((it: any) => {
                    if (!addItemSearchQuery.trim()) return true;
                    const q = addItemSearchQuery.toLowerCase();
                    return it.name.toLowerCase().includes(q) || (it.skuNumber && it.skuNumber.toLowerCase().includes(q));
                  })
                  .map((it: any) => {
                    const alreadyInPO = items.some((line: any) => line.inventoryItemId === it._id);
                    return (
                      <div key={it._id} className="p-3 hover:bg-stone-50 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-xs text-[#0c0a09]">{it.name}</p>
                          <p className="text-[11px] text-stone-400">
                            Stock: {it.availableStock ?? 0} {it.buyingUnit} • SKU: {it.skuNumber || "N/A"}
                          </p>
                        </div>
                        {alreadyInPO ? (
                          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">
                            Added
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddItemToPO(it._id)}
                            className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white !text-white text-xs font-semibold cursor-pointer"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>

              <div className="p-4 border-t border-[#e7e5e4] text-right">
                <button
                  type="button"
                  onClick={() => setIsAddItemDrawerOpen(false)}
                  className="px-4 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6. CONFIRMATION MODALS */}
        {/* Place Order Confirmation Modal */}
        {isPlaceOrderConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
            <div className="bg-white rounded-2xl shadow-xl border border-stone-200 max-w-md w-full p-6 space-y-4">
              <h3 className="text-base font-bold text-[#0c0a09]">
                Are you sure you want to place this purchase order?
              </h3>
              <div className="text-xs text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-1">
                <p>
                  <strong>Supplier:</strong> {activePODetails.companyName || activePODetails.supplierName}
                </p>
                <p>
                  <strong>PO Number:</strong> {activePODetails.poNumber}
                </p>
                <p>
                  <strong>Total Items:</strong> {items.length}
                </p>
              </div>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPlaceOrderConfirmOpen(false)}
                  className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 text-xs font-medium cursor-pointer hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPerformingAction}
                  onClick={handleConfirmPlaceOrder}
                  className="px-5 py-2 rounded-lg bg-[#0c0a09] hover:bg-[#292524] text-white !text-white text-xs font-semibold cursor-pointer"
                >
                  Confirm &amp; Place Order
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cancel PO Confirmation Modal */}
        {isCancelConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
            <div className="bg-white rounded-2xl shadow-xl border border-stone-200 max-w-md w-full p-6 space-y-4">
              <h3 className="text-base font-bold text-rose-700">Cancel Purchase Order</h3>
              <p className="text-xs text-stone-600">
                Are you sure you want to cancel {activePODetails.poNumber}? This will mark the order as cancelled.
              </p>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCancelConfirmOpen(false)}
                  className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 text-xs font-medium cursor-pointer"
                >
                  No, Keep PO
                </button>
                <button
                  type="button"
                  disabled={isPerformingAction}
                  onClick={handleConfirmCancelPO}
                  className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white !text-white text-xs font-semibold cursor-pointer"
                >
                  Yes, Cancel PO
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settle PO Confirmation Modal */}
        {isSettleConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
            <div className="bg-white rounded-2xl shadow-xl border border-stone-200 max-w-md w-full p-6 space-y-4">
              <h3 className="text-base font-bold text-emerald-800">Settle Purchase Order &amp; Restock</h3>
              <p className="text-xs text-stone-600">
                Are you sure you want to settle {activePODetails.poNumber}? All received quantities will be automatically credited to your live inventory stock ledger.
              </p>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSettleConfirmOpen(false)}
                  className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPerformingAction}
                  onClick={handleConfirmSettlePO}
                  className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white !text-white text-xs font-semibold cursor-pointer"
                >
                  Confirm Settle &amp; Restock
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: PURCHASE ORDER MASTER LIST VIEW
  // =========================================================================
  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#faf9f8] p-6 md:p-8 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-semibold flex items-center space-x-2 transition ${
            toastMessage.type === "success"
              ? "bg-emerald-900 border-emerald-800 text-white"
              : "bg-rose-900 border-rose-800 text-white"
          }`}
        >
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0c0a09] tracking-tight">Purchase Orders</h1>
          <p className="text-xs text-[#78716c] mt-1">Manage vendor procurement, orders, and restock shipments</p>
        </div>

        <button
          type="button"
          onClick={() => setIsNewPODrawerOpen(true)}
          className="px-5 py-2.5 rounded-full bg-[#0c0a09] hover:bg-[#292524] text-white !text-white text-xs font-semibold shadow-sm transition cursor-pointer flex items-center space-x-2 shrink-0 self-start sm:self-auto"
        >
          <svg className="w-4 h-4 text-white stroke-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-white !text-white font-semibold">Create Purchase Order</span>
        </button>
      </div>

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-[#e7e5e4] pb-3">
        {/* Status Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "All", count: counts.all },
            { id: "drafted", label: "Drafted", count: counts.drafted },
            { id: "sent", label: "Placed / Sent", count: counts.sent },
            { id: "settled", label: "Settled", count: counts.settled },
            { id: "cancelled", label: "Cancelled", count: counts.cancelled },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTabStatus(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                activeTabStatus === tab.id
                  ? "bg-[#0c0a09] text-white !text-white shadow-2xs"
                  : "text-[#78716c] hover:text-[#0c0a09] hover:bg-stone-100"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTabStatus === tab.id
                    ? "bg-stone-800 text-white"
                    : "bg-stone-200 text-stone-700"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search PO number, supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#e7e5e4] rounded-lg focus:outline-none focus:border-stone-800"
          />
          <svg
            className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* PO Master Table */}
      <div className="bg-white border border-[#e7e5e4] rounded-xl overflow-hidden shadow-2xs">
        {filteredPOs.length === 0 ? (
          <div className="py-20 text-center text-stone-400 text-xs">
            <svg className="w-12 h-12 mx-auto text-stone-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="font-semibold text-stone-600 text-sm mb-1">No purchase orders found</p>
            <p className="text-stone-400 text-xs">Create your first purchase order to restock inventory.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#e7e5e4] bg-[#fafaf9] text-[11px] font-semibold text-[#78716c] uppercase tracking-wider">
                  <th className="py-3 px-5">PO Number</th>
                  <th className="py-3 px-5">Supplier</th>
                  <th className="py-3 px-4">Items Count</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5">Est. Total</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f5f5f4]">
                {filteredPOs.map((po: any) => {
                  const itemsCount = po.itemsCount ?? po.items?.length ?? 0;
                  const isExpanded = !!expandedPoIds[po._id];
                  return (
                    <Fragment key={po._id}>
                      <tr
                        onClick={() => setActivePoId(po._id)}
                        className="hover:bg-[#fafaf9] transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-5">
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedPoIds((prev) => ({
                                  ...prev,
                                  [po._id]: !prev[po._id],
                                }));
                              }}
                              className="p-1 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded transition cursor-pointer"
                              title={isExpanded ? "Collapse items" : "Expand items"}
                            >
                              <svg
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                  isExpanded ? "rotate-90" : ""
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </button>
                            <span className="font-semibold text-stone-900 hover:underline">
                              {po.poNumber}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-400 pl-6">
                            {formatStoreDate(po.createdAt, activeOrg?.country, activeOrg?.organizationTimeZone) || "—"}
                          </p>
                        </td>
                        <td className="py-3.5 px-5">
                          <p className="font-semibold text-stone-900">{po.supplierName}</p>
                          {po.companyName && <p className="text-[11px] text-stone-500">{po.companyName}</p>}
                        </td>
                        <td className="py-3.5 px-4 text-stone-600 font-medium">
                          {itemsCount} item(s)
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              po.purchasePriority === "high"
                                ? "bg-rose-100 text-rose-700"
                                : po.purchasePriority === "medium"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {po.purchasePriority}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              po.status === "drafted"
                                ? "bg-stone-100 text-stone-700"
                                : po.status === "sent"
                                ? "bg-sky-50 text-sky-700 border border-sky-200"
                                : po.status === "settled"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {po.status === "drafted" ? "Drafted" : po.status === "sent" ? "Sent / Placed" : po.status === "settled" ? "Settled" : "Cancelled"}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 font-semibold text-stone-900">
                          {currencySymbol}
                          {formatCurrencyAmount(po.totalAmount || 0, activeOrg?.country)}
                        </td>
                        <td className="py-3.5 px-5 text-right relative" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => setActivePoId(po._id)}
                              className="px-3 py-1.5 rounded-lg border border-[#d6d3d1] hover:bg-stone-100 text-[11px] font-semibold text-stone-800 transition cursor-pointer"
                            >
                              {po.status === "drafted" ? "Add / Edit items" : "View Order"}
                            </button>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setOpenRowMenuPoId(openRowMenuPoId === po._id ? null : po._id)}
                                className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition cursor-pointer"
                                title="Actions"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                </svg>
                              </button>

                              {openRowMenuPoId === po._id && (
                                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#e7e5e4] rounded-xl shadow-lg py-1.5 z-30 text-left">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenRowMenuPoId(null);
                                      setActivePoId(po._id);
                                    }}
                                    className="w-full px-3.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 flex items-center space-x-2 text-left cursor-pointer"
                                  >
                                    <span>{po.status === "drafted" ? "Add / Edit items" : "View order details"}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenRowMenuPoId(null);
                                      downloadPurchaseOrderPdf({ po, org: activeOrg });
                                    }}
                                    className="w-full px-3.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 flex items-center space-x-2 text-left cursor-pointer"
                                  >
                                    <span>Download PDF</span>
                                  </button>
                                  {po.status !== "cancelled" && po.status !== "settled" && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenRowMenuPoId(null);
                                        handleCancelSinglePO(po);
                                      }}
                                      className="w-full px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center space-x-2 text-left cursor-pointer"
                                    >
                                      <span>Cancel PO</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Child Table Row */}
                      {isExpanded && (
                        <tr className="bg-[#faf9f7] border-b border-[#e8e5dc]">
                          <td colSpan={7} className="py-3 px-6">
                            <div className="bg-white border border-[#e4e1d8] rounded-xl p-4 shadow-2xs">
                              <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-100">
                                <span className="text-xs font-semibold text-stone-800">
                                  Line items in {po.poNumber} ({po.items?.length || itemsCount})
                                </span>
                                <span className="text-xs font-semibold text-emerald-700">
                                  Est. Total: {currencySymbol}
                                  {formatCurrencyAmount(po.totalAmount || 0, activeOrg?.country)}
                                </span>
                              </div>
                              {!po.items || po.items.length === 0 ? (
                                <p className="text-xs text-stone-400 italic">
                                  No line items in this purchase order. Click &apos;Add / Edit items&apos; to add ingredients.
                                </p>
                              ) : (
                                <div className="space-y-1.5">
                                  {po.items.map((item: any, idx: number) => (
                                    <div
                                      key={item.id || item._id || idx}
                                      className="flex items-center justify-between text-xs py-1.5 px-3 rounded hover:bg-stone-50 border border-transparent hover:border-stone-200 transition"
                                    >
                                      <div className="flex items-center space-x-2">
                                        <span className="font-semibold text-stone-900">
                                          ├── {item.name || item.inventoryItemName}
                                        </span>
                                        {item.sku && (
                                          <span className="text-[11px] text-stone-400">
                                            ({item.sku})
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center space-x-6 text-stone-600">
                                        <span>
                                          Qty: <strong>{item.orderedQuantity}</strong> {item.buyingUnit || item.unit || ""}
                                        </span>
                                        <span>
                                          Cost: {currencySymbol}
                                          {formatCurrencyAmount(item.unitCost || 0, activeOrg?.country)}/{item.buyingUnit || item.unit || "unit"}
                                        </span>
                                        <span className="font-semibold text-stone-900">
                                          Line Total: {currencySymbol}
                                          {formatCurrencyAmount(
                                            (item.orderedQuantity || 0) * (item.unitCost || 0),
                                            activeOrg?.country
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE PURCHASE ORDER DRAWER */}
      {isNewPODrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-2xs">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="p-5 border-b border-[#e7e5e4] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#0c0a09]">Select supplier</h3>
                <p className="text-[11px] text-stone-500">Create a new purchase order for vendor restock</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewPODrawerOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreatePOSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Supplier <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#d6d3d1] rounded-lg focus:outline-none focus:border-stone-800 bg-white"
                >
                  <option value="">Select supplier</option>
                  {(suppliers ?? []).map((s: any) => (
                    <option key={s._id} value={s._id}>
                      {s.supplierName} {s.companyName ? `(${s.companyName})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Purchase priority <span className="text-rose-500">*</span>
                </label>
                <select
                  value={purchasePriority}
                  onChange={(e) => setPurchasePriority(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-[#d6d3d1] rounded-lg focus:outline-none focus:border-stone-800 bg-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Special Notes / Delivery Instructions
                </label>
                <textarea
                  rows={3}
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="Optional delivery instructions or purchase notes..."
                  className="w-full px-3 py-2 text-xs border border-[#d6d3d1] rounded-lg focus:outline-none focus:border-stone-800 resize-none"
                />
              </div>

              <div className="pt-4 border-t border-[#e7e5e4] flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsNewPODrawerOpen(false)}
                  className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 text-xs font-medium cursor-pointer hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingPO}
                  className="px-5 py-2 rounded-lg bg-[#0c0a09] hover:bg-[#292524] text-white !text-white text-xs font-semibold shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isCreatingPO ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
