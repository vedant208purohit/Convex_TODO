"use client";

import React, { useState, useMemo, useRef, useEffect, Fragment } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  formatCurrencyAmount,
  getCurrencyForCountry,
  formatStoreDate,
  getPhoneCodeForCountry,
} from "@/lib/constants/countries";
import { downloadPurchaseOrderPdf } from "@/app/utils/generatePurchaseOrderPdf";
import { Toast, type ToastMessage, type ToastType } from "@/app/components/Toast";

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
  const updatePODetailsMutation = useMutation(api.inventory.updatePurchaseOrderDetails);
  const addItemsMutation = useMutation(api.inventory.addItemsToPurchaseOrder);
  const removeItemsMutation = useMutation(api.inventory.removePurchaseOrderItems);
  const updateItemQtyMutation = useMutation(api.inventory.updatePurchaseOrderItemQuantity);
  const autoFillQtyMutation = useMutation(api.inventory.autoFillPOOrderedQuantity);
  const placePOMutation = useMutation(api.inventory.placePurchaseOrder);
  const cancelPOMutation = useMutation(api.inventory.cancelPurchaseOrder);
  const updateReceivingMutation = useMutation(api.inventory.updatePOItemReceivingStatus);
  const settlePOMutation = useMutation(api.inventory.settlePurchaseOrder);
  const attachPOInvoiceMutation = useMutation(api.inventory.attachPOInvoice);
  const updatePOItemDetailsMutation = useMutation(api.inventory.updatePurchaseOrderItemDetails);

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
  const [rowMenuPos, setRowMenuPos] = useState<{ top: number; right: number; openUp: boolean } | null>(null);

  // Column Sorting state for PO Master List
  const [poSortField, setPoSortField] = useState<
    "poNumber" | "supplierName" | "itemsCount" | "priority" | "status" | "total" | null
  >(null);
  const [poSortOrder, setPoSortOrder] = useState<"asc" | "desc">("asc");

  const handlePoSort = (
    field: "poNumber" | "supplierName" | "itemsCount" | "priority" | "status" | "total"
  ) => {
    if (poSortField === field) {
      setPoSortOrder(poSortOrder === "asc" ? "desc" : "asc");
    } else {
      setPoSortField(field);
      setPoSortOrder("asc");
    }
  };

  useEffect(() => {
    if (!openRowMenuPoId) return;
    const handleClose = () => {
      setOpenRowMenuPoId(null);
      setRowMenuPos(null);
    };
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [openRowMenuPoId]);

  // 3-Dots Row Actions Modals State
  const [poForSupplierEdit, setPoForSupplierEdit] = useState<any | null>(null);
  const [newSupplierId, setNewSupplierId] = useState<string>("");
  const [isUpdatingSupplier, setIsUpdatingSupplier] = useState(false);

  const [poForDetailsEdit, setPoForDetailsEdit] = useState<any | null>(null);
  const [editPriority, setEditPriority] = useState<"high" | "medium" | "low">("low");
  const [editNotes, setEditNotes] = useState("");
  const [isUpdatingDetails, setIsUpdatingDetails] = useState(false);

  const [poForCancel, setPoForCancel] = useState<any | null>(null);
  const [isCancellingPo, setIsCancellingPo] = useState(false);

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
  const [localQuantities, setLocalQuantities] = useState<Record<string, string>>({});
  const [localPrices, setLocalPrices] = useState<Record<string, string>>({});
  const [localReceivedQtys, setLocalReceivedQtys] = useState<Record<string, string>>({});
  const debounceTimersRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Confirmation Modals State
  const [isPlaceOrderConfirmOpen, setIsPlaceOrderConfirmOpen] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isSettleConfirmOpen, setIsSettleConfirmOpen] = useState(false);
  const [isOrderReceivedConfirmOpen, setIsOrderReceivedConfirmOpen] = useState(false);
  const [isOrderMissingConfirmOpen, setIsOrderMissingConfirmOpen] = useState(false);
  const [isPerformingAction, setIsPerformingAction] = useState(false);

  // Placed Order Detail Tabs: "ordered" | "received" | "missing"
  const [detailTab, setDetailTab] = useState<"ordered" | "received" | "missing">("ordered");

  // Standard Menu-style Toast Notification (top-right)
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (message: string, type: ToastType = "success", subtext?: string) => {
    setToast({ message, type, subtext });
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
    if (poSortField) {
      list = [...list].sort((a: any, b: any) => {
        let valA: string | number = "";
        let valB: string | number = "";
        if (poSortField === "poNumber") {
          valA = (a.poNumber || "").toLowerCase();
          valB = (b.poNumber || "").toLowerCase();
        } else if (poSortField === "supplierName") {
          valA = (a.supplierName || "").toLowerCase();
          valB = (b.supplierName || "").toLowerCase();
        } else if (poSortField === "itemsCount") {
          valA = a.itemsCount ?? a.items?.length ?? 0;
          valB = b.itemsCount ?? b.items?.length ?? 0;
        } else if (poSortField === "priority") {
          valA = (a.priority || "").toLowerCase();
          valB = (b.priority || "").toLowerCase();
        } else if (poSortField === "status") {
          valA = (a.status || "").toLowerCase();
          valB = (b.status || "").toLowerCase();
        } else if (poSortField === "total") {
          valA = a.totalAmount ?? 0;
          valB = b.totalAmount ?? 0;
        }
        if (valA < valB) return poSortOrder === "asc" ? -1 : 1;
        if (valA > valB) return poSortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [allPOs, activeTabStatus, searchQuery, poSortField, poSortOrder]);

  // Pagination State for PO Master List (View 1) - 10 rows per page
  const [poCurrentPage, setPoCurrentPage] = useState(1);
  const poItemsPerPage = 10;
  const totalPoPages = Math.max(1, Math.ceil(filteredPOs.length / poItemsPerPage));
  const paginatedPOs = useMemo(() => {
    const start = (poCurrentPage - 1) * poItemsPerPage;
    return filteredPOs.slice(start, start + poItemsPerPage);
  }, [filteredPOs, poCurrentPage, poItemsPerPage]);

  // Pagination State for PO Detail Items (View 2) - 10 items per page
  const [detailCurrentPage, setDetailCurrentPage] = useState(1);
  const detailItemsPerPage = 10;

  // Synchronize Detail Tab based on active PO status (settled POs default to "received")
  React.useEffect(() => {
    if (!activePODetails) return;
    if (activePODetails.status === "settled") {
      setDetailTab("received");
    } else if (activePODetails.status === "sent" || activePODetails.status === "drafted") {
      setDetailTab("ordered");
    }
    setDetailCurrentPage(1);
    setSelectedItemIds([]);
  }, [activePODetails?._id, activePODetails?.status]);

  // Reset detail page on tab or query change
  React.useEffect(() => {
    setDetailCurrentPage(1);
  }, [detailTab, detailSearchQuery]);

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
  const handleConfirmPlaceOrder = async (targetItemsToOrder: any[]) => {
    if (!activePODetails) return;
    setIsPerformingAction(true);
    try {
      // 1. Sync all quantities, zeroing out any omitted lines
      const activeItems = activePODetails.items || [];
      const orderItemIds = new Set(targetItemsToOrder.map((it: any) => it._id));
      for (const item of activeItems) {
        if (!orderItemIds.has(item._id)) {
          await updateItemQtyMutation({
            purchaseOrderItemId: item._id,
            orderedQuantity: 0,
          });
        } else if (localQuantities[item._id] !== undefined) {
          const parsed = parseFloat(localQuantities[item._id]);
          const validQty = isNaN(parsed) || parsed < 0 ? 0 : parsed;
          await updateItemQtyMutation({
            purchaseOrderItemId: item._id,
            orderedQuantity: validQty,
          });
        }
      }

      // 2. Call placePurchaseOrder (removes 0-quantity items and sets status to sent)
      const res = await placePOMutation({
        purchaseOrderId: activePODetails._id,
      });

      setIsPlaceOrderConfirmOpen(false);
      showToast(
        `Purchase order ${activePODetails.poNumber} placed successfully (${res.itemsCount ?? targetItemsToOrder.length} item(s))!`,
        "success"
      );
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

  // Handler: Confirm Order Received (Marks selected items as received & moves to Received Items tab)
  const handleConfirmOrderReceived = async () => {
    if (!activePODetails || selectedItemIds.length === 0) return;
    setIsPerformingAction(true);
    try {
      await updateReceivingMutation({
        purchaseOrderId: activePODetails._id,
        itemIds: selectedItemIds as Id<"purchaseOrderItems">[],
        statusType: "received",
      });
      const receivedCount = selectedItemIds.length;
      setSelectedItemIds([]);
      setIsOrderReceivedConfirmOpen(false);
      setDetailTab("received");
      showToast(
        `Selected ${receivedCount} item(s) marked as received.`,
        "success"
      );
    } catch (err: any) {
      console.error("Failed to mark items as received:", err);
      showToast(err?.message || "Failed to mark items as received.", "error");
    } finally {
      setIsPerformingAction(false);
    }
  };

  // Handler: Confirm Order Missing (Marks selected items as missing & moves to Missing Items tab)
  const handleConfirmOrderMissing = async () => {
    if (!activePODetails || selectedItemIds.length === 0) return;
    setIsPerformingAction(true);
    try {
      await updateReceivingMutation({
        purchaseOrderId: activePODetails._id,
        itemIds: selectedItemIds as Id<"purchaseOrderItems">[],
        statusType: "missing",
      });
      const missingCount = selectedItemIds.length;
      setSelectedItemIds([]);
      setIsOrderMissingConfirmOpen(false);
      setDetailTab("missing");
      showToast(
        `Selected ${missingCount} item(s) marked as missing.`,
        "success"
      );
    } catch (err: any) {
      console.error("Failed to mark items as missing:", err);
      showToast(err?.message || "Failed to mark items as missing.", "error");
    } finally {
      setIsPerformingAction(false);
    }
  };

  // Handlers for Row Action Menu (All 7 Options)
  const openEditSupplierModal = (po: any) => {
    setPoForSupplierEdit(po);
    setNewSupplierId(po.supplierId || suppliers?.[0]?._id || "");
  };

  const handleSaveSupplierChange = async () => {
    if (!poForSupplierEdit || !newSupplierId) return;
    setIsUpdatingSupplier(true);
    try {
      await updatePODetailsMutation({
        purchaseOrderId: poForSupplierEdit._id,
        supplierId: newSupplierId as Id<"suppliers">,
      });
      showToast(`Supplier updated for ${poForSupplierEdit.poNumber}.`, "success");
      setPoForSupplierEdit(null);
    } catch (err: any) {
      console.error("Failed to update supplier on PO:", err);
      showToast(err?.message || "Failed to update supplier.", "error");
    } finally {
      setIsUpdatingSupplier(false);
    }
  };

  const openEditDetailsModal = (po: any) => {
    setPoForDetailsEdit(po);
    setEditPriority(po.purchasePriority || "low");
    setEditNotes(po.notes || "");
  };

  const handleSaveDetailsChange = async () => {
    if (!poForDetailsEdit) return;
    setIsUpdatingDetails(true);
    try {
      await updatePODetailsMutation({
        purchaseOrderId: poForDetailsEdit._id,
        purchasePriority: editPriority,
        notes: editNotes.trim() || undefined,
      });
      showToast(`PO details updated for ${poForDetailsEdit.poNumber}.`, "success");
      setPoForDetailsEdit(null);
    } catch (err: any) {
      console.error("Failed to update PO details:", err);
      showToast(err?.message || "Failed to update PO details.", "error");
    } finally {
      setIsUpdatingDetails(false);
    }
  };

  const getSupplierChatNumber = (po: any): string | null => {
    const s = suppliers?.find((sup) => sup._id === po.supplierId);
    const raw = po.supplierWhatsappNumber || s?.whatsappNumber || po.supplierPhoneNumber || s?.phoneNumber;
    if (!raw) return null;
    let digits = raw.replace(/\D/g, "");
    if (digits.length === 10) {
      const dialCode = getPhoneCodeForCountry(s?.country || activeOrg?.country || "India").replace(/\D/g, "");
      digits = `${dialCode}${digits}`;
    }
    return digits.length >= 10 ? digits : null;
  };

  const handleViewChat = (po: any) => {
    const digits = getSupplierChatNumber(po);
    if (!digits) {
      showToast("No WhatsApp number available for this supplier.", "error");
      return;
    }
    const msg = encodeURIComponent(`Hello ${po.supplierName}, regarding Purchase Order ${po.poNumber}`);
    window.open(`https://wa.me/${digits}?text=${msg}`, "_blank");
  };

  const handleConfirmCancelPo = async () => {
    if (!poForCancel) return;
    setIsCancellingPo(true);
    try {
      await cancelPOMutation({
        purchaseOrderId: poForCancel._id,
        reason: "Cancelled by store manager",
      });
      showToast(`Purchase order ${poForCancel.poNumber} cancelled.`, "success");
      setPoForCancel(null);
    } catch (err: any) {
      console.error("Failed to cancel purchase order:", err);
      showToast(err?.message || "Failed to cancel purchase order.", "error");
    } finally {
      setIsCancellingPo(false);
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
  // VIEW 2: ADD ITEMS IN PO#XXXX / PLACED PO TABS VIEW (EXACT MATCH FOR PHOTOS 1, 2, 3)
  // =========================================================================
  if (activePoId && activePODetails) {
    const isDraft = activePODetails.status === "drafted";
    const isSent = activePODetails.status === "sent";
    const isSettled = activePODetails.status === "settled";

    // When PO is settled, default to "received" tab so received items are immediately visible
    const effectiveDetailTab: "ordered" | "received" | "missing" =
      isDraft
        ? "ordered"
        : isSettled
        ? detailTab === "missing"
          ? "missing"
          : "received"
        : detailTab;

    const allItems = activePODetails.items || [];
    const totalReceivedItems = allItems.filter((it: any) => it.isReceived === true);
    const totalMissingItems = allItems.filter((it: any) => it.isMissing === true);
    const totalOrderedItems = allItems.filter(
      (it: any) => !it.isReceived && !it.isMissing
    );

    // Active items to display based on status & current active tab
    const activeItemsList = isDraft
      ? allItems
      : effectiveDetailTab === "ordered"
      ? totalOrderedItems
      : effectiveDetailTab === "received"
      ? totalReceivedItems
      : totalMissingItems;

    const filteredDetailItems = activeItemsList.filter((item: any) => {
      if (!detailSearchQuery.trim()) return true;
      const q = detailSearchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.sku && item.sku.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    });

    const totalDetailPages = Math.max(1, Math.ceil(filteredDetailItems.length / detailItemsPerPage));
    const paginatedDetailItems = filteredDetailItems.slice(
      (detailCurrentPage - 1) * detailItemsPerPage,
      detailCurrentPage * detailItemsPerPage
    );

    const isAllSelected =
      paginatedDetailItems.length > 0 &&
      paginatedDetailItems.every((it: any) => selectedItemIds.includes(it._id));

    // Instant quantity getters for Draft Mode
    const getItemQuantity = (item: any): number => {
      if (localQuantities[item._id] !== undefined) {
        const parsed = parseFloat(localQuantities[item._id]);
        return isNaN(parsed) || parsed < 0 ? 0 : parsed;
      }
      return item.orderedQuantity ?? 0;
    };

    const getItemRawQuantityStr = (item: any): string => {
      if (localQuantities[item._id] !== undefined) {
        return localQuantities[item._id];
      }
      return (item.orderedQuantity ?? 0) > 0 ? String(item.orderedQuantity) : "";
    };

    // Valid items to order (must have quantity > 0)
    const itemsWithQty = allItems.filter((it: any) => getItemQuantity(it) > 0);
    const itemsToOrder =
      selectedItemIds.length > 0
        ? allItems.filter((it: any) => selectedItemIds.includes(it._id) && getItemQuantity(it) > 0)
        : itemsWithQty;

    const unquantifiedOrUnselected = allItems.filter(
      (it: any) => !itemsToOrder.some((ordered: any) => ordered._id === it._id)
    );

    const hasItemsWithQty = itemsToOrder.length > 0;

    const totalDraftAmount = itemsToOrder.reduce(
      (acc: number, it: any) => acc + getItemQuantity(it) * (it.unitCost || 0),
      0
    );

    return (
      <div className="flex-1 flex flex-col min-w-0 w-full bg-[#faf9f8] p-6 md:p-8 space-y-6">
        {/* Toast Notification (Top-Right Standard Menu Toast) */}
        <Toast toast={toast} onClose={() => setToast(null)} />

        {/* Hidden File Input for Supplier Invoice Upload */}
        <input
          type="file"
          ref={invoiceFileInputRef}
          onChange={handleInvoiceFileUpload}
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
        />

        {/* 1. Header & Breadcrumb (Screenshot 2: Purchase order > Add items in OR Photo 2/3: Purchase order > PO#XXXX) */}
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
            <span className="text-[#0c0a09] font-medium">
              {isDraft ? "Add items in" : activePODetails.poNumber}
            </span>
          </div>

          {/* If Draft, show the classic H1 title "Add items in PO-XXXX" */}
          {isDraft && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#0c0a09] tracking-tight">
                Add items in {activePODetails.poNumber}
              </h1>
            </div>
          )}
        </div>

        {/* 2. Top Bar: TABS (Photo 2 & 3) + SEARCH + ACTIONS + PRIMARY BUTTON */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 pt-1 border-b border-[#e7e5e4] pb-2">
          {/* TABS (Photos 2 & 3: Ordered Items, Received Items, Missing Items) */}
          {!isDraft ? (
            <div className="flex items-center space-x-8 overflow-x-auto pb-1 lg:pb-0">
              {isSent && (
                <button
                  type="button"
                  onClick={() => {
                    setDetailTab("ordered");
                    setSelectedItemIds([]);
                  }}
                  className={`pb-2.5 text-sm font-semibold transition cursor-pointer relative shrink-0 ${
                    effectiveDetailTab === "ordered"
                      ? "text-[#0c0a09]"
                      : "text-[#78716c] hover:text-[#0c0a09]"
                  }`}
                >
                  <span>Ordered Items ({totalOrderedItems.length})</span>
                  {effectiveDetailTab === "ordered" && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0c0a09]" />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setDetailTab("received");
                  setSelectedItemIds([]);
                }}
                className={`pb-2.5 text-sm font-semibold transition cursor-pointer relative shrink-0 ${
                  effectiveDetailTab === "received"
                    ? "text-[#0c0a09]"
                    : "text-[#78716c] hover:text-[#0c0a09]"
                }`}
              >
                <span>Received Items ({totalReceivedItems.length})</span>
                {effectiveDetailTab === "received" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0c0a09]" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDetailTab("missing");
                  setSelectedItemIds([]);
                }}
                className={`pb-2.5 text-sm font-semibold transition cursor-pointer relative shrink-0 ${
                  effectiveDetailTab === "missing"
                    ? "text-[#0c0a09]"
                    : "text-[#78716c] hover:text-[#0c0a09]"
                }`}
              >
                <span>Missing Items ({totalMissingItems.length})</span>
                {effectiveDetailTab === "missing" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0c0a09]" />
                )}
              </button>
            </div>
          ) : (
            <div className="text-xs text-stone-500 font-medium">
              Configure items and quantities before placing order
            </div>
          )}

          {/* Right Action Controls: Search + Actions Dropdown + Primary Button */}
          <div className="flex items-center space-x-3 shrink-0">
            {/* Search Box */}
            <div className="relative w-64 sm:w-72">
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
                  {isDraft && (
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
                  )}

                  {/* Actions for Placed PO in Ordered Items tab (Photo 4) */}
                  {isSent && effectiveDetailTab === "ordered" && (
                    <div className="py-1">
                      <button
                        type="button"
                        disabled={selectedItemIds.length === 0}
                        onClick={() => {
                          setIsActionsMenuOpen(false);
                          setIsOrderReceivedConfirmOpen(true);
                        }}
                        className="w-full text-left px-3.5 py-2 text-stone-700 hover:bg-stone-50 transition cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        Selected items received
                      </button>
                      <button
                        type="button"
                        disabled={selectedItemIds.length === 0}
                        onClick={() => {
                          setIsActionsMenuOpen(false);
                          setIsOrderMissingConfirmOpen(true);
                        }}
                        className="w-full text-left px-3.5 py-2 text-stone-700 hover:bg-stone-50 transition cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent"
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
                        const supp =
                          suppliers?.find(
                            (s) =>
                              s._id ===
                              (activePODetails.supplierId || activePODetails.supplier?._id)
                          ) || activePODetails.supplier;
                        downloadPurchaseOrderPdf({
                          po: activePODetails,
                          org: activeOrg,
                          supplier: supp,
                        });
                      }}
                      className="w-full text-left px-3.5 py-2 text-stone-700 hover:bg-stone-50 transition cursor-pointer"
                    >
                      Download PDF
                    </button>

                    <button
                      type="button"
                      disabled={isUploadingInvoice}
                      onClick={() => {
                        setIsActionsMenuOpen(false);
                        invoiceFileInputRef.current?.click();
                      }}
                      className="w-full text-left px-3.5 py-2 text-stone-700 hover:bg-stone-50 transition cursor-pointer"
                    >
                      {isUploadingInvoice
                        ? "Uploading invoice..."
                        : activePODetails.invoiceUrl || activePODetails.invoiceAssetId
                        ? "Replace Invoice"
                        : "Upload Supplier Invoice"}
                    </button>

                    {(activePODetails.invoiceUrl || activePODetails.invoiceAssetId) && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsActionsMenuOpen(false);
                          if (activePODetails.invoiceUrl) {
                            window.open(activePODetails.invoiceUrl, "_blank");
                          } else {
                            showToast("Invoice attached to this purchase order.", "success");
                          }
                        }}
                        className="w-full text-left px-3.5 py-2 text-stone-700 hover:bg-stone-50 transition cursor-pointer"
                      >
                        View Invoice
                      </button>
                    )}

                    {!isSettled && activePODetails.status !== "cancelled" && (
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

            {/* PRIMARY BUTTON BASED ON VIEW & STATUS */}
            {/* 1. Draft mode: "Place order" button */}
            {isDraft && (
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

            {/* 2. Placed mode & Ordered Items Tab: "Order received" button (Photo 2) */}
            {isSent && effectiveDetailTab === "ordered" && (
              <button
                type="button"
                disabled={selectedItemIds.length === 0 || isPerformingAction}
                onClick={() => setIsOrderReceivedConfirmOpen(true)}
                className={`px-5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs ${
                  selectedItemIds.length > 0
                    ? "bg-[#1c1917] hover:bg-[#292524] text-white !text-white"
                    : "bg-[#78716c] text-[#d6d3d1] cursor-not-allowed opacity-75"
                }`}
              >
                Order received
              </button>
            )}

            {/* 3. Placed mode & Received Items Tab: "Settle & Restock PO" button */}
            {isSent && effectiveDetailTab === "received" && (
              <button
                type="button"
                disabled={isPerformingAction}
                onClick={() => setIsSettleConfirmOpen(true)}
                className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white !text-white text-xs font-semibold transition cursor-pointer shadow-2xs"
              >
                Settle &amp; Restock PO
              </button>
            )}

            {/* 4. Settled status badge */}
            {isSettled && (
              <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                Settled &amp; Restocked
              </span>
            )}
          </div>
        </div>

        {/* 3. ITEMS TABLE (MATCHING EXACT COLUMNS OF SCREENSHOT 2, PHOTO 2, PHOTO 3) */}
        <div className="bg-white border border-[#e7e5e4] rounded-xl overflow-hidden shadow-2xs">
          {filteredDetailItems.length === 0 ? (
            <div className="py-16 text-center text-stone-400 text-xs">
              <p className="font-medium text-stone-500 mb-1">
                {isDraft
                  ? "No items added to this purchase order yet."
                  : effectiveDetailTab === "ordered"
                  ? "All items in this purchase order have been marked as received."
                  : effectiveDetailTab === "received"
                  ? "No items marked as received yet. Select items in 'Ordered Items' and click 'Order received'."
                  : "No items marked as missing in this purchase order."}
              </p>
              {isDraft && (
                <p className="text-[11px]">
                  Use "Actions &gt; Prefill assigned items" or "Add new item" to populate items.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#e7e5e4] bg-[#fafaf9] text-[11px] font-semibold text-[#78716c]">
                    {/* Checkbox column only in Draft OR Placed Ordered Items tab */}
                    {(isDraft || (!isDraft && effectiveDetailTab === "ordered")) && (
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
                    )}

                    <th className="py-3 px-4 w-16">Sr no</th>
                    <th className="py-3 px-6">Item name</th>
                    <th className="py-3 px-6 w-60">Available stock</th>
                    <th className="py-3 px-6 w-28">SKU no</th>

                    {/* Columns for Draft mode */}
                    {isDraft && <th className="py-3 px-6 w-44">Item quantity</th>}

                    {/* Columns for Placed: Ordered Items tab (Photo 2) */}
                    {!isDraft && effectiveDetailTab === "ordered" && (
                      <>
                        <th className="py-3 px-6 w-32">Buying unit</th>
                        <th className="py-3 px-6 w-36">Ordered quantity</th>
                      </>
                    )}

                    {/* Columns for Placed: Received Items tab (Photo 3) */}
                    {!isDraft && effectiveDetailTab === "received" && (
                      <>
                        <th className="py-3 px-6 w-44">Price of item</th>
                        <th className="py-3 px-6 w-44">Received quantity</th>
                        <th className="py-3 px-6 w-32">Buying unit</th>
                        <th className="py-3 px-6 w-36">Ordered quantity</th>
                      </>
                    )}

                    {/* Columns for Missing Items tab */}
                    {!isDraft && effectiveDetailTab === "missing" && (
                      <>
                        <th className="py-3 px-6 w-36">Missing quantity</th>
                        <th className="py-3 px-6 w-32">Buying unit</th>
                        <th className="py-3 px-6 w-36">Ordered quantity</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f5f5f4]">
                  {paginatedDetailItems.map((item: any, idx: number) => {
                    const isSelected = selectedItemIds.includes(item._id);
                    const stockNum = parseFloat(item.stock) || 0;
                    const stockFillPercent = Math.min(100, Math.max(8, (stockNum / 100) * 100));
                    const srNo = (detailCurrentPage - 1) * detailItemsPerPage + idx + 1;

                    return (
                      <tr
                        key={item._id}
                        className={`hover:bg-[#fafaf9] transition-colors ${
                          isSelected ? "bg-stone-50" : ""
                        }`}
                      >
                        {/* Checkbox (Draft OR Placed Ordered Tab) */}
                        {(isDraft || (!isDraft && effectiveDetailTab === "ordered")) && (
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
                        )}

                        {/* Sr no */}
                        <td className="py-4 px-4 text-stone-500 font-medium">{srNo}</td>

                        {/* Item name + Category (Photo 2 & 3: bold name, category underneath) */}
                        <td className="py-4 px-6">
                          <p className="font-bold text-[#0c0a09]">{item.name}</p>
                          <p className="text-[11px] text-[#78716c]">{item.category || "General"}</p>
                        </td>

                        {/* Available Stock + Progress Bar (Photo 2 & 3) */}
                        <td className="py-4 px-6">
                          <div className="w-48 space-y-1">
                            <div className="text-[11px] font-medium text-right text-stone-600">
                              {item.stock}
                            </div>
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

                        {/* 1. DRAFT MODE: Enter quantity input */}
                        {isDraft && (
                          <td className="py-4 px-6">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="Enter quantity"
                              value={getItemRawQuantityStr(item)}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLocalQuantities((prev) => ({ ...prev, [item._id]: val }));
                                const num = parseFloat(val);
                                const validQty = isNaN(num) || num < 0 ? 0 : num;

                                if (validQty > 0) {
                                  setSelectedItemIds((prev) =>
                                    prev.includes(item._id) ? prev : [...prev, item._id]
                                  );
                                } else {
                                  setSelectedItemIds((prev) => prev.filter((id) => id !== item._id));
                                }

                                if (debounceTimersRef.current[item._id]) {
                                  clearTimeout(debounceTimersRef.current[item._id]);
                                }
                                debounceTimersRef.current[item._id] = setTimeout(async () => {
                                  try {
                                    await updateItemQtyMutation({
                                      purchaseOrderItemId: item._id,
                                      orderedQuantity: validQty,
                                    });
                                  } catch (err) {
                                    console.error("Failed to sync quantity:", err);
                                  }
                                }, 300);
                              }}
                              onBlur={async (e) => {
                                const val = e.target.value;
                                const num = parseFloat(val);
                                const validQty = isNaN(num) || num < 0 ? 0 : num;
                                if (debounceTimersRef.current[item._id]) {
                                  clearTimeout(debounceTimersRef.current[item._id]);
                                }
                                try {
                                  await updateItemQtyMutation({
                                    purchaseOrderItemId: item._id,
                                    orderedQuantity: validQty,
                                  });
                                } catch (err) {
                                  console.error("Failed to sync quantity on blur:", err);
                                }
                              }}
                              className="w-32 px-3 py-1.5 border border-[#d6d3d1] rounded-md text-xs font-medium focus:outline-none focus:border-stone-800 bg-white shadow-2xs transition"
                            />
                          </td>
                        )}

                        {/* 2. PLACED MODE: Ordered Items Tab (Photo 2) */}
                        {!isDraft && effectiveDetailTab === "ordered" && (
                          <>
                            <td className="py-4 px-6 text-stone-700 font-medium">
                              {item.buyingUnit || "piece"}
                            </td>
                            <td className="py-4 px-6 font-semibold text-stone-900">
                              {item.orderedQuantity}
                            </td>
                          </>
                        )}

                        {/* 3. PLACED MODE: Received Items Tab (Photo 3) */}
                        {!isDraft && effectiveDetailTab === "received" && (
                          <>
                            {/* Price of item with currency prefix */}
                            <td className="py-4 px-6">
                              {isSettled ? (
                                <span className="font-semibold text-stone-900">
                                  {currencySymbol}
                                  {item.unitCost ?? 0}
                                </span>
                              ) : (
                                <div className="relative w-36">
                                  <span className="absolute left-3 top-2 text-stone-500 font-medium text-xs">
                                    {currencySymbol}
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    placeholder="0"
                                    value={
                                      localPrices[item._id] !== undefined
                                        ? localPrices[item._id]
                                        : item.unitCost !== undefined
                                        ? String(item.unitCost)
                                        : "0"
                                    }
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setLocalPrices((prev) => ({ ...prev, [item._id]: val }));
                                      const num = parseFloat(val);
                                      const validPrice = isNaN(num) || num < 0 ? 0 : num;

                                      if (debounceTimersRef.current[`price_${item._id}`]) {
                                        clearTimeout(debounceTimersRef.current[`price_${item._id}`]);
                                      }
                                      debounceTimersRef.current[`price_${item._id}`] = setTimeout(
                                        async () => {
                                          try {
                                            await updatePOItemDetailsMutation({
                                              purchaseOrderItemId: item._id,
                                              priceOfItem: validPrice,
                                            });
                                          } catch (err) {
                                            console.error("Failed to sync price:", err);
                                          }
                                        },
                                        350
                                      );
                                    }}
                                    onBlur={async (e) => {
                                      const val = e.target.value;
                                      const num = parseFloat(val);
                                      const validPrice = isNaN(num) || num < 0 ? 0 : num;
                                      if (debounceTimersRef.current[`price_${item._id}`]) {
                                        clearTimeout(debounceTimersRef.current[`price_${item._id}`]);
                                      }
                                      try {
                                        await updatePOItemDetailsMutation({
                                          purchaseOrderItemId: item._id,
                                          priceOfItem: validPrice,
                                        });
                                      } catch (err) {
                                        console.error("Failed to sync price on blur:", err);
                                      }
                                    }}
                                    className="w-full pl-7 pr-3 py-1.5 border border-[#d6d3d1] rounded-md text-xs font-medium focus:outline-none focus:border-stone-800 bg-white shadow-2xs transition"
                                  />
                                </div>
                              )}
                            </td>

                            {/* Received quantity input */}
                            <td className="py-4 px-6">
                              {isSettled ? (
                                <span className="font-semibold text-stone-900">
                                  {item.receivedQuantity ?? 0}
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder="0"
                                  value={
                                    localReceivedQtys[item._id] !== undefined
                                      ? localReceivedQtys[item._id]
                                      : item.receivedQuantity !== undefined
                                      ? String(item.receivedQuantity)
                                      : "0"
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setLocalReceivedQtys((prev) => ({ ...prev, [item._id]: val }));
                                    const num = parseFloat(val);
                                    const validQty = isNaN(num) || num < 0 ? 0 : num;

                                    if (debounceTimersRef.current[`rcv_${item._id}`]) {
                                      clearTimeout(debounceTimersRef.current[`rcv_${item._id}`]);
                                    }
                                    debounceTimersRef.current[`rcv_${item._id}`] = setTimeout(
                                      async () => {
                                        try {
                                          await updatePOItemDetailsMutation({
                                            purchaseOrderItemId: item._id,
                                            receivedQuantity: validQty,
                                          });
                                        } catch (err) {
                                          console.error("Failed to sync received qty:", err);
                                        }
                                      },
                                      350
                                    );
                                  }}
                                  onBlur={async (e) => {
                                    const val = e.target.value;
                                    const num = parseFloat(val);
                                    const validQty = isNaN(num) || num < 0 ? 0 : num;
                                    if (debounceTimersRef.current[`rcv_${item._id}`]) {
                                      clearTimeout(debounceTimersRef.current[`rcv_${item._id}`]);
                                    }
                                    try {
                                      await updatePOItemDetailsMutation({
                                        purchaseOrderItemId: item._id,
                                        receivedQuantity: validQty,
                                      });
                                    } catch (err) {
                                      console.error("Failed to sync received qty on blur:", err);
                                    }
                                  }}
                                  className="w-28 px-3 py-1.5 border border-[#d6d3d1] rounded-md text-xs font-medium focus:outline-none focus:border-stone-800 bg-white shadow-2xs transition"
                                />
                              )}
                            </td>

                            {/* Buying unit */}
                            <td className="py-4 px-6 text-stone-700 font-medium">
                              {item.buyingUnit || "piece"}
                            </td>

                            {/* Ordered quantity */}
                            <td className="py-4 px-6 font-semibold text-stone-900">
                              {item.orderedQuantity}
                            </td>
                          </>
                        )}

                        {/* 4. PLACED MODE: Missing Items Tab */}
                        {!isDraft && effectiveDetailTab === "missing" && (
                          <>
                            <td className="py-4 px-6 font-bold text-rose-600">
                              {item.missingQuantity ??
                                Math.max(0, item.orderedQuantity - (item.receivedQuantity ?? 0))}
                            </td>
                            <td className="py-4 px-6 text-stone-700 font-medium">
                              {item.buyingUnit || "piece"}
                            </td>
                            <td className="py-4 px-6 font-semibold text-stone-900">
                              {item.orderedQuantity}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* View 2 Detail Items Pagination Controls (10 items per page) */}
          {totalDetailPages > 1 && (
            <div className="py-3 px-6 border-t border-[#e7e5e4] bg-[#fafaf9]/60 flex items-center justify-between text-xs text-[#78716c]">
              <span>
                Showing{" "}
                <strong className="text-[#0c0a09]">
                  {(detailCurrentPage - 1) * detailItemsPerPage + 1} -{" "}
                  {Math.min(detailCurrentPage * detailItemsPerPage, filteredDetailItems.length)}
                </strong>{" "}
                of <strong className="text-[#0c0a09]">{filteredDetailItems.length}</strong> items
              </span>
              <div className="flex items-center space-x-2 text-xs">
                <button
                  type="button"
                  disabled={detailCurrentPage <= 1}
                  onClick={() => setDetailCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 border border-[#e7e5e4] rounded-lg bg-white text-[#1c1917] hover:bg-[#f5f5f4] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs font-medium"
                >
                  Previous
                </button>
                <span className="px-2 font-medium text-[#0c0a09]">
                  {detailCurrentPage} / {totalDetailPages}
                </span>
                <button
                  type="button"
                  disabled={detailCurrentPage >= totalDetailPages}
                  onClick={() => setDetailCurrentPage((p) => Math.min(totalDetailPages, p + 1))}
                  className="px-3 py-1 border border-[#e7e5e4] rounded-lg bg-white text-[#1c1917] hover:bg-[#f5f5f4] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs font-medium"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Table Footer with Summary */}
          <div className="py-3 px-6 bg-[#fafaf9] border-t border-[#e7e5e4] flex items-center justify-between text-xs text-stone-500">
            {isDraft ? (
              <>
                <span>
                  Showing <strong>{filteredDetailItems.length}</strong> items in purchase order •{" "}
                  <strong className="text-emerald-700">{itemsToOrder.length}</strong> item(s) selected
                  to order
                </span>
                <span className="font-medium text-[#0c0a09]">
                  Estimated Cost: {currencySymbol}
                  {formatCurrencyAmount(totalDraftAmount, activeOrg?.country)}
                </span>
              </>
            ) : effectiveDetailTab === "ordered" ? (
              <>
                <span>
                  Showing <strong>{filteredDetailItems.length}</strong> ordered item(s) •{" "}
                  <strong className="text-stone-900">{selectedItemIds.length}</strong> item(s) selected
                  to receive
                </span>
                <span className="font-medium text-[#0c0a09]">
                  Total Placed PO Amount: {currencySymbol}
                  {formatCurrencyAmount(activePODetails.totalAmount || 0, activeOrg?.country)}
                </span>
              </>
            ) : effectiveDetailTab === "received" ? (
              <>
                <span>
                  Showing <strong>{filteredDetailItems.length}</strong> received item(s)
                </span>
                <span className="font-medium text-[#0c0a09]">
                  Total Restock Amount: {currencySymbol}
                  {formatCurrencyAmount(activePODetails.totalAmount || 0, activeOrg?.country)}
                </span>
              </>
            ) : (
              <>
                <span>
                  Showing <strong>{filteredDetailItems.length}</strong> missing item(s)
                </span>
                <span className="text-rose-600 font-medium">
                  {filteredDetailItems.length > 0
                    ? "Items shortfall will not be restocked into inventory"
                    : "No missing items"}
                </span>
              </>
            )}
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
                    const alreadyInPO = allItems.some((line: any) => line.inventoryItemId === it._id);
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
            <div className="bg-white rounded-2xl shadow-xl border border-stone-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <h3 className="text-base font-bold text-[#0c0a09]">
                Are you sure you want to place this purchase order?
              </h3>
              <div className="text-xs text-stone-600 bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-500">Supplier:</span>
                  <span className="font-semibold text-stone-900">
                    {activePODetails.companyName || activePODetails.supplierName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">PO Number:</span>
                  <span className="font-semibold text-stone-900">{activePODetails.poNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Total Items to Order:</span>
                  <span className="font-bold text-emerald-700">{itemsToOrder.length} item(s)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Estimated Total:</span>
                  <span className="font-bold text-stone-900">
                    {currencySymbol}
                    {formatCurrencyAmount(totalDraftAmount, activeOrg?.country)}
                  </span>
                </div>

                {/* Breakdown of ordered items */}
                <div className="pt-2 border-t border-stone-200 space-y-1">
                  <p className="font-semibold text-[11px] text-stone-700 uppercase tracking-wider">
                    Order items breakdown:
                  </p>
                  {itemsToOrder.map((it: any) => (
                    <div key={it._id} className="flex items-center justify-between text-xs py-0.5">
                      <span className="text-stone-800 font-medium">• {it.name}</span>
                      <span className="text-stone-700 font-semibold">
                        {getItemQuantity(it)} {it.buyingUnit}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Clear notice if any item in the table has 0 quantity */}
                {unquantifiedOrUnselected.length > 0 && (
                  <div className="pt-2 border-t border-amber-200/60 text-[11px] text-amber-800 flex items-start space-x-1.5">
                    <svg
                      className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>
                      {unquantifiedOrUnselected.length} item(s) without quantity (
                      {unquantifiedOrUnselected.map((it: any) => it.name).join(", ")}
                      ) will be omitted from this finalized order.
                    </span>
                  </div>
                )}
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
                  disabled={isPerformingAction || itemsToOrder.length === 0}
                  onClick={() => handleConfirmPlaceOrder(itemsToOrder)}
                  className="px-5 py-2 rounded-lg bg-[#0c0a09] hover:bg-[#292524] text-white !text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isPerformingAction ? "Placing..." : "Confirm & Place Order"}
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

        {/* Order Received Confirmation Modal (Photo 2) */}
        {isOrderReceivedConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
            <div className="bg-white rounded-2xl shadow-xl border border-stone-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <h3 className="text-base font-bold text-[#0c0a09]">
                Are you sure you want to mark these {selectedItemIds.length} items as received?
              </h3>
              <p className="text-xs text-stone-600">
                These items will be marked as received and moved to the <strong>Received Items</strong> tab, where you can enter the received quantity and item price before restocking.
              </p>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOrderReceivedConfirmOpen(false)}
                  className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 text-xs font-medium cursor-pointer hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPerformingAction}
                  onClick={handleConfirmOrderReceived}
                  className="px-5 py-2 rounded-lg bg-[#0c0a09] hover:bg-[#292524] text-white !text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isPerformingAction ? "Receiving..." : "Confirm Received"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Order Missing Confirmation Modal */}
        {isOrderMissingConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
            <div className="bg-white rounded-2xl shadow-xl border border-stone-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <h3 className="text-base font-bold text-[#0c0a09]">
                Are you sure you want to mark these {selectedItemIds.length} items as missing?
              </h3>
              <p className="text-xs text-stone-600">
                These items will be marked as missing and moved to the <strong>Missing Items</strong> tab. They will not be restocked into inventory when this order is settled.
              </p>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOrderMissingConfirmOpen(false)}
                  className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 text-xs font-medium cursor-pointer hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPerformingAction}
                  onClick={handleConfirmOrderMissing}
                  className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white !text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isPerformingAction ? "Updating..." : "Confirm Missing"}
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
    <div className="flex-1 flex flex-col min-w-0 w-full bg-[#faf9f8] p-6 md:p-8 space-y-6">
      {/* Toast Notification (Top-Right Standard Menu Toast) */}
      <Toast toast={toast} onClose={() => setToast(null)} />

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
              onClick={() => {
                setActiveTabStatus(tab.id);
                setPoCurrentPage(1);
              }}
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
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPoCurrentPage(1);
            }}
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
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#e7e5e4] bg-[#fafaf9] text-[11px] font-semibold text-[#78716c] uppercase tracking-wider select-none sticky top-0 z-20">
                  <th
                    className="py-3 px-5 cursor-pointer hover:text-stone-900 select-none"
                    onClick={() => handlePoSort("poNumber")}
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>PO Number</span>
                      {poSortField === "poNumber" ? (
                        <span className="text-stone-900 font-bold">
                          {poSortOrder === "asc" ? "↑" : "↓"}
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
                    onClick={() => handlePoSort("supplierName")}
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Supplier</span>
                      {poSortField === "supplierName" ? (
                        <span className="text-stone-900 font-bold">
                          {poSortOrder === "asc" ? "↑" : "↓"}
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
                    className="py-3 px-4 cursor-pointer hover:text-stone-900 select-none"
                    onClick={() => handlePoSort("itemsCount")}
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Items Count</span>
                      {poSortField === "itemsCount" ? (
                        <span className="text-stone-900 font-bold">
                          {poSortOrder === "asc" ? "↑" : "↓"}
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
                    className="py-3 px-4 cursor-pointer hover:text-stone-900 select-none"
                    onClick={() => handlePoSort("priority")}
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Priority</span>
                      {poSortField === "priority" ? (
                        <span className="text-stone-900 font-bold">
                          {poSortOrder === "asc" ? "↑" : "↓"}
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
                    className="py-3 px-4 cursor-pointer hover:text-stone-900 select-none"
                    onClick={() => handlePoSort("status")}
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Status</span>
                      {poSortField === "status" ? (
                        <span className="text-stone-900 font-bold">
                          {poSortOrder === "asc" ? "↑" : "↓"}
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
                    onClick={() => handlePoSort("total")}
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Est. Total</span>
                      {poSortField === "total" ? (
                        <span className="text-stone-900 font-bold">
                          {poSortOrder === "asc" ? "↑" : "↓"}
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
                  <th className="py-3 px-5 text-right font-semibold select-none">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f5f5f4]">
                {paginatedPOs.map((po: any) => {
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
                          <p className="text-[11px] text-stone-900 font-medium pl-6">
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
                            <div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (openRowMenuPoId === po._id) {
                                    setOpenRowMenuPoId(null);
                                    setRowMenuPos(null);
                                  } else {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const spaceBelow = window.innerHeight - rect.bottom;
                                    const openUp = spaceBelow < 280;
                                    setRowMenuPos({
                                      top: openUp ? rect.top - 6 : rect.bottom + 6,
                                      right: window.innerWidth - rect.right,
                                      openUp,
                                    });
                                    setOpenRowMenuPoId(po._id);
                                  }
                                }}
                                className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition cursor-pointer"
                                title="Actions"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                </svg>
                              </button>

                              {openRowMenuPoId === po._id && rowMenuPos && (
                                <>
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenRowMenuPoId(null);
                                      setRowMenuPos(null);
                                    }}
                                  />
                                  <div
                                    className="fixed z-50 w-44 bg-white border border-[#e7e5e4] rounded-xl shadow-xl py-1.5 text-left"
                                    style={{
                                      top: rowMenuPos.openUp ? undefined : `${rowMenuPos.top}px`,
                                      bottom: rowMenuPos.openUp ? `${window.innerHeight - rowMenuPos.top}px` : undefined,
                                      right: `${rowMenuPos.right}px`,
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {/* 1. Add items */}
                                    <button
                                      type="button"
                                      disabled={po.status !== "drafted"}
                                      onClick={() => {
                                        setOpenRowMenuPoId(null);
                                        setRowMenuPos(null);
                                        setActivePoId(po._id);
                                      }}
                                      className={`w-full px-3.5 py-2 text-xs font-medium text-left flex items-center transition ${
                                        po.status === "drafted"
                                          ? "text-stone-700 hover:bg-stone-50 cursor-pointer"
                                          : "text-stone-300 cursor-not-allowed"
                                      }`}
                                    >
                                      <span>Add items</span>
                                    </button>

                                    {/* 2. Edit supplier */}
                                    <button
                                      type="button"
                                      disabled={po.status !== "drafted"}
                                      onClick={() => {
                                        setOpenRowMenuPoId(null);
                                        setRowMenuPos(null);
                                        openEditSupplierModal(po);
                                      }}
                                      className={`w-full px-3.5 py-2 text-xs font-medium text-left flex items-center transition ${
                                        po.status === "drafted"
                                          ? "text-stone-700 hover:bg-stone-50 cursor-pointer"
                                          : "text-stone-300 cursor-not-allowed"
                                      }`}
                                    >
                                      <span>Edit supplier</span>
                                    </button>

                                    {/* 3. Edit PO details */}
                                    <button
                                      type="button"
                                      disabled={po.status !== "drafted"}
                                      onClick={() => {
                                        setOpenRowMenuPoId(null);
                                        setRowMenuPos(null);
                                        openEditDetailsModal(po);
                                      }}
                                      className={`w-full px-3.5 py-2 text-xs font-medium text-left flex items-center transition ${
                                        po.status === "drafted"
                                          ? "text-stone-700 hover:bg-stone-50 cursor-pointer"
                                          : "text-stone-300 cursor-not-allowed"
                                      }`}
                                    >
                                      <span>Edit PO details</span>
                                    </button>

                                    {/* 4. View order */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenRowMenuPoId(null);
                                        setRowMenuPos(null);
                                        setActivePoId(po._id);
                                      }}
                                      className="w-full px-3.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 flex items-center text-left cursor-pointer transition"
                                    >
                                      <span>View order</span>
                                    </button>

                                    {/* 5. View chat */}
                                    <button
                                      type="button"
                                      disabled={!getSupplierChatNumber(po)}
                                      onClick={() => {
                                        setOpenRowMenuPoId(null);
                                        setRowMenuPos(null);
                                        handleViewChat(po);
                                      }}
                                      className={`w-full px-3.5 py-2 text-xs font-medium text-left flex items-center transition ${
                                        getSupplierChatNumber(po)
                                          ? "text-stone-700 hover:bg-stone-50 cursor-pointer"
                                          : "text-stone-300 cursor-not-allowed"
                                      }`}
                                      title={
                                        getSupplierChatNumber(po)
                                          ? "Open WhatsApp chat with supplier"
                                          : "No WhatsApp number configured for this supplier"
                                      }
                                    >
                                      <span>View chat</span>
                                    </button>

                                    {/* 6. Download PDF */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenRowMenuPoId(null);
                                        setRowMenuPos(null);
                                        const supp = suppliers?.find((s) => s._id === (po.supplierId || po.supplier?._id)) || po.supplier;
                                        downloadPurchaseOrderPdf({ po, org: activeOrg, supplier: supp });
                                        showToast("The purchase order PDF was downloaded successfully.", "success");
                                      }}
                                      className="w-full px-3.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 flex items-center text-left cursor-pointer transition"
                                    >
                                      <span>Download PDF</span>
                                    </button>

                                    {/* 7. Cancel PO */}
                                    <button
                                      type="button"
                                      disabled={po.status === "settled" || po.status === "cancelled"}
                                      onClick={() => {
                                        setOpenRowMenuPoId(null);
                                        setRowMenuPos(null);
                                        setPoForCancel(po);
                                      }}
                                      className={`w-full px-3.5 py-2 text-xs font-medium text-left flex items-center transition ${
                                        po.status !== "settled" && po.status !== "cancelled"
                                          ? "text-rose-600 hover:bg-rose-50 cursor-pointer"
                                          : "text-rose-300 cursor-not-allowed"
                                      }`}
                                    >
                                      <span>Cancel PO</span>
                                    </button>
                                  </div>
                                </>
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

          {/* Pagination Controls (10 rows per page) */}
          <div className="py-3.5 px-5 border-t border-[#e7e5e4] bg-[#fafaf9]/60 flex items-center justify-between text-xs text-[#78716c] shrink-0">
            <span>
              Showing{" "}
              <strong className="text-[#0c0a09]">
                {filteredPOs.length === 0
                  ? 0
                  : `${(poCurrentPage - 1) * poItemsPerPage + 1} - ${Math.min(
                      poCurrentPage * poItemsPerPage,
                      filteredPOs.length
                    )}`}
              </strong>{" "}
              of <strong className="text-[#0c0a09]">{filteredPOs.length}</strong> purchase orders
            </span>
            <div className="flex items-center space-x-2 text-xs">
              <button
                type="button"
                disabled={poCurrentPage <= 1}
                onClick={() => setPoCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 border border-[#e7e5e4] rounded-lg bg-white text-[#1c1917] hover:bg-[#f5f5f4] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs font-medium"
              >
                Previous
              </button>
              <span className="px-2 font-medium text-[#0c0a09]">
                {poCurrentPage} / {totalPoPages}
              </span>
              <button
                type="button"
                disabled={poCurrentPage >= totalPoPages}
                onClick={() => setPoCurrentPage((p) => Math.min(totalPoPages, p + 1))}
                className="px-3 py-1 border border-[#e7e5e4] rounded-lg bg-white text-[#1c1917] hover:bg-[#f5f5f4] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs font-medium"
              >
                Next
              </button>
            </div>
          </div>
        </>
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

      {/* Edit Supplier Modal (from row menu) */}
      {poForSupplierEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-stone-900">Edit Supplier</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Update supplier for {poForSupplierEdit.poNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPoForSupplierEdit(null)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-full hover:bg-stone-100 transition cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Current Supplier
                </label>
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                  <p className="font-semibold text-stone-900">{poForSupplierEdit.supplierName}</p>
                  {poForSupplierEdit.companyName && (
                    <p className="text-[11px] text-stone-500 mt-0.5">{poForSupplierEdit.companyName}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Select New Supplier <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newSupplierId}
                  onChange={(e) => setNewSupplierId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-stone-800 bg-white"
                >
                  {suppliers?.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.supplierName} {s.companyName ? `(${s.companyName})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-lg text-[11px] text-amber-800 flex items-start space-x-2">
                <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  Reassigning will update the supplier on this draft purchase order.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setPoForSupplierEdit(null)}
                className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 text-xs font-medium cursor-pointer hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdatingSupplier || !newSupplierId}
                onClick={handleSaveSupplierChange}
                className="px-5 py-2 rounded-lg bg-[#0c0a09] hover:bg-[#292524] text-white !text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {isUpdatingSupplier ? "Updating..." : "Update Supplier"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit PO Details Modal (from row menu) */}
      {poForDetailsEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-stone-900">Edit PO Details</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Update priority and instructions for {poForDetailsEdit.poNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPoForDetailsEdit(null)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-full hover:bg-stone-100 transition cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Purchase Priority
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "High", value: "high", color: "border-rose-400 bg-rose-50 text-rose-700 font-bold" },
                    { label: "Medium", value: "medium", color: "border-amber-400 bg-amber-50 text-amber-700 font-bold" },
                    { label: "Low", value: "low", color: "border-emerald-400 bg-emerald-50 text-emerald-700 font-bold" },
                  ].map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setEditPriority(p.value as any)}
                      className={`py-2 px-3 rounded-lg border text-xs text-center transition cursor-pointer ${
                        editPriority === p.value
                          ? `${p.color} ring-2 ring-stone-900 shadow-2xs`
                          : "border-stone-200 text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Special Notes / Delivery Instructions
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add delivery instructions, terms, or notes..."
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-stone-800 bg-white resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setPoForDetailsEdit(null)}
                className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 text-xs font-medium cursor-pointer hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdatingDetails}
                onClick={handleSaveDetailsChange}
                className="px-5 py-2 rounded-lg bg-[#0c0a09] hover:bg-[#292524] text-white !text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {isUpdatingDetails ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel PO Confirmation Modal (from row menu) */}
      {poForCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-stone-900">
              Cancel order - {poForCancel.poNumber}
            </h3>

            <div className="space-y-1.5 text-xs">
              <p className="text-stone-600">
                <span className="font-semibold text-stone-700">Supplier name:</span>{" "}
                {poForCancel.supplierName}
              </p>
              <p className="text-stone-600">
                <span className="font-semibold text-stone-700">Total items:</span>{" "}
                {poForCancel.itemsCount ?? poForCancel.items?.length ?? 0}
              </p>
              <p className="text-stone-600 pt-2 font-medium">
                Are you sure you want to cancel this purchase order?
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setPoForCancel(null)}
                className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 text-xs font-medium cursor-pointer hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isCancellingPo}
                onClick={handleConfirmCancelPo}
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white !text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {isCancellingPo ? "Cancelling..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
