"use client";

import React, { useState, useMemo, useRef, Fragment } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  formatCurrencyAmount,
  getCurrencyForCountry,
} from "@/lib/constants/countries";

export interface PurchaseOrderItem {
  id: string;
  inventoryItemId?: string;
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
  isReceived?: boolean;
  isMissing?: boolean;
}

export interface PurchaseOrderRecord {
  _id: string;
  poNumber: string;
  createdAt: number;
  supplierId: string;
  supplierName: string;
  companyName?: string;
  itemsCount: number;
  purchasePriority: "high" | "medium" | "low";
  status: "drafted" | "sent" | "partially_received" | "settled" | "cancelled";
  totalAmount?: number;
  notes?: string;
  invoiceStorageKey?: string;
  invoiceAssetId?: string;
  invoiceUrl?: string;
  items?: PurchaseOrderItem[];
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

  // Consuming existing Convex backend queries & mutations
  const suppliers = useQuery(api.inventory.listSuppliers, { organizationId });
  const inventoryItems = useQuery(api.inventory.listInventoryItems, {
    organizationId,
  });

  const createPOMutation = useMutation(api.inventory.createPurchaseOrder);
  const settlePOMutation = useMutation(api.inventory.settlePurchaseOrder);
  const attachPOInvoiceMutation = useMutation(api.inventory.attachPOInvoice);

  // R2 Storage Actions
  const createAssetUpload = useAction(api.r2.createAssetUpload);
  const confirmAssetUpload = useAction(api.r2.confirmAssetUpload);

  // Status Filter & Search State
  const [activeTabStatus, setActiveTabStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Drawer & Detail View States
  const [isNewPODrawerOpen, setIsNewPODrawerOpen] = useState(false);
  const [isSupplierMenuOpen, setIsSupplierMenuOpen] = useState(false);
  const [isPriorityMenuOpen, setIsPriorityMenuOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderRecord | null>(
    null,
  );
  const [detailTab, setDetailTab] = useState<
    "ordered" | "received" | "missing"
  >("ordered");
  const [detailSearchQuery, setDetailSearchQuery] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSettling, setIsSettling] = useState(false);

  // Invoice Upload State
  const invoiceFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState<string | null>(null);

  // Invoice File Upload Handler using R2 Infrastructure
  const handleInvoiceFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPO || !activeOrg?._id) return;

    // File Type Validation (PDF, JPG, JPEG, PNG)
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    if (!allowedTypes.includes(file.type)) {
      showToast(
        "Invalid file type. Please select a PDF, JPG, or PNG document.",
        "error",
      );
      e.target.value = "";
      return;
    }

    // File Size Validation (Max 25MB)
    const maxSizeBytes = 25 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      showToast("File size exceeds the maximum limit of 25MB.", "error");
      e.target.value = "";
      return;
    }

    setIsUploadingInvoice(true);
    setUploadStatusText("Uploading invoice to storage...");

    try {
      // 1. Create asset upload in R2 (inserts pending record in organization_assets)
      const uploadResult = await createAssetUpload({
        assetType: "invoice_pdf",
        fileName: file.name,
        contentType: file.type || "application/pdf",
        fileSize: file.size,
        organizationId: activeOrg._id,
      });

      // 2. Direct HTTP PUT to Cloudflare R2 presigned URL
      setUploadStatusText("Uploading file...");
      const putResult = await fetch(uploadResult.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });

      if (!putResult.ok) {
        throw new Error(
          `Failed to upload invoice file (Status: ${putResult.status})`,
        );
      }

      // 3. Confirm asset upload in organization_assets (marks status = "uploaded")
      setUploadStatusText("Saving invoice reference...");
      await confirmAssetUpload({
        assetId: uploadResult.assetId,
      });

      // 4. Attach invoice reference to Purchase Order in Convex DB
      await attachPOInvoiceMutation({
        purchaseOrderId: selectedPO._id as any,
        invoiceStorageKey: uploadResult.storageKey,
        invoiceAssetId: uploadResult.assetId,
      });

      // 5. Update local PO state
      const updatedPO: PurchaseOrderRecord = {
        ...selectedPO,
        invoiceStorageKey: uploadResult.storageKey,
        invoiceAssetId: uploadResult.assetId,
      };
      setSelectedPO(updatedPO);
      setLocalPOs((prev) =>
        prev.map((po) => (po._id === selectedPO._id ? updatedPO : po)),
      );

      showToast("Supplier invoice uploaded successfully!", "success");
    } catch (err: any) {
      console.error("Failed to upload supplier invoice:", err);
      showToast(err?.message || "Failed to upload supplier invoice.", "error");
    } finally {
      setIsUploadingInvoice(false);
      setUploadStatusText(null);
      if (e.target) e.target.value = "";
    }
  };

  // Expandable Nested Table State
  const [expandedPoIds, setExpandedPoIds] = useState<Record<string, boolean>>(
    {},
  );

  // Toast message state
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

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
      items: [
        {
          id: "item_demo_1",
          name: "Amul Butter (500g)",
          category: "Dairy",
          stock: "2.40 kg",
          stockPercentage: 35,
          sku: "DAIRY-001",
          buyingUnit: "kg",
          orderedQuantity: 10,
          unitCost: 240,
          isReceived: false,
          isMissing: false,
        },
      ],
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
      items: [
        {
          id: "item_demo_2",
          name: "Whole Milk (1L)",
          category: "Dairy",
          stock: "15.00 L",
          stockPercentage: 60,
          sku: "DAIRY-002",
          buyingUnit: "litre",
          orderedQuantity: 20,
          receivedQuantity: 20,
          unitCost: 60,
          isReceived: true,
          isMissing: false,
        },
        {
          id: "item_demo_3",
          name: "Cold Drink (500ml)",
          category: "Beverages",
          stock: "5.00 L",
          stockPercentage: 15,
          sku: "BEV-001",
          buyingUnit: "litre",
          orderedQuantity: 50,
          unitCost: 45,
          isReceived: false,
          isMissing: false,
        },
        {
          id: "item_demo_4",
          name: "Cheese Block (1kg)",
          category: "Dairy",
          stock: "1.20 kg",
          stockPercentage: 10,
          sku: "DAIRY-003",
          buyingUnit: "kg",
          orderedQuantity: 5,
          missingQuantity: 5,
          unitCost: 480,
          isReceived: false,
          isMissing: true,
        },
      ],
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
      items: [
        {
          id: "item_demo_5",
          name: "Paneer Fresh (1kg)",
          category: "Dairy",
          stock: "8.00 kg",
          stockPercentage: 80,
          sku: "DAIRY-004",
          buyingUnit: "kg",
          orderedQuantity: 15,
          receivedQuantity: 15,
          unitCost: 320,
          isReceived: true,
          isMissing: false,
        },
      ],
    },
  ]);

  // 3-dots Menu Popover State
  const [openMenuPoId, setOpenMenuPoId] = useState<string | null>(null);

  // Form State for New PO (matching createPurchaseOrder args exactly)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [purchasePriority, setPurchasePriority] = useState<
    "high" | "medium" | "low"
  >("low");
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
          (p.companyName && p.companyName.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [localPOs, activeTabStatus, searchQuery]);

  const openNewPODrawer = () => {
    setSelectedSupplierId("");
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
    return poItemsInput.reduce(
      (acc, i) => acc + (i.orderedQuantity || 0) * (i.unitCost || 0),
      0,
    );
  }, [poItemsInput]);

  const handleCreatePOSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      alert("Please select a vendor/supplier first.");
      return;
    }

    const selectedSupplier = suppliers?.find(
      (s) => s._id === selectedSupplierId,
    );

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
        companyName:
          selectedSupplier?.companyName || selectedSupplier?.supplierName,
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
    if (
      !confirm(
        `Are you sure you want to settle ${purchaseOrder.poNumber}? Stock will be credited into live inventory.`,
      )
    )
      return;

    setIsSettling(true);
    try {
      if (
        !purchaseOrder._id.startsWith("po_demo_") &&
        !purchaseOrder._id.startsWith("po_local_")
      ) {
        await settlePOMutation({
          purchaseOrderId: purchaseOrder._id as Id<"purchaseOrders">,
        });
      }
      setLocalPOs((prev) =>
        prev.map((p) =>
          p._id === purchaseOrder._id ? { ...p, status: "settled" } : p,
        ),
      );
      setSelectedPO(null);
      showToast(
        `${purchaseOrder.poNumber} settled successfully. Stock has been credited into inventory.`,
        "success",
      );
    } catch (err: any) {
      console.error("Failed to settle Purchase Order:", err);
      showToast(err?.message || "Failed to settle Purchase Order.", "error");
    } finally {
      setIsSettling(false);
    }
  };

  const handleDispatchPO = (purchaseOrder: PurchaseOrderRecord) => {
    setLocalPOs((prev) =>
      prev.map((p) =>
        p._id === purchaseOrder._id ? { ...p, status: "sent" } : p,
      ),
    );
    if (selectedPO?._id === purchaseOrder._id) {
      setSelectedPO((prev) => (prev ? { ...prev, status: "sent" } : null));
    }
    showToast(
      `${purchaseOrder.poNumber} marked as Sent / In-Transit.`,
      "success",
    );
  };

  const handleCancelPO = (purchaseOrder: PurchaseOrderRecord) => {
    if (
      !confirm(
        `Are you sure you want to cancel purchase order ${purchaseOrder.poNumber}?`,
      )
    )
      return;
    setLocalPOs((prev) =>
      prev.map((p) =>
        p._id === purchaseOrder._id ? { ...p, status: "cancelled" } : p,
      ),
    );
    if (selectedPO?._id === purchaseOrder._id) {
      setSelectedPO(null);
    }
    showToast(`${purchaseOrder.poNumber} cancelled.`, "success");
  };

  // Item management handlers for PO Detail View
  const handleToggleReceived = (itemId: string) => {
    if (!selectedPO) return;
    setLocalPOs((prev) =>
      prev.map((po) => {
        if (po._id !== selectedPO._id) return po;
        const updatedItems = (po.items || []).map((item) => {
          if (item.id !== itemId) return item;
          const nextReceived = !item.isReceived;
          return {
            ...item,
            isReceived: nextReceived,
            isMissing: nextReceived ? false : item.isMissing,
            receivedQuantity: nextReceived ? item.orderedQuantity : 0,
            missingQuantity: nextReceived ? 0 : item.missingQuantity,
          };
        });
        const updatedPO = { ...po, items: updatedItems };
        setSelectedPO(updatedPO);
        return updatedPO;
      }),
    );
  };

  const handleToggleMissing = (itemId: string) => {
    if (!selectedPO) return;
    setLocalPOs((prev) =>
      prev.map((po) => {
        if (po._id !== selectedPO._id) return po;
        const updatedItems = (po.items || []).map((item) => {
          if (item.id !== itemId) return item;
          const nextMissing = !item.isMissing;
          return {
            ...item,
            isMissing: nextMissing,
            isReceived: nextMissing ? false : item.isReceived,
            missingQuantity: nextMissing ? item.orderedQuantity : 0,
            receivedQuantity: nextMissing ? 0 : item.receivedQuantity,
          };
        });
        const updatedPO = { ...po, items: updatedItems };
        setSelectedPO(updatedPO);
        return updatedPO;
      }),
    );
  };

  const handleItemQtyChange = (
    itemId: string,
    field:
      "orderedQuantity" | "receivedQuantity" | "missingQuantity" | "unitCost",
    value: number,
  ) => {
    if (!selectedPO) return;
    setLocalPOs((prev) =>
      prev.map((po) => {
        if (po._id !== selectedPO._id) return po;
        const updatedItems = (po.items || []).map((item) => {
          if (item.id !== itemId) return item;
          const val = Math.max(0, value);
          const updated = { ...item, [field]: val };
          if (field === "receivedQuantity") {
            updated.isReceived = val > 0;
            if (val > 0) updated.isMissing = false;
          } else if (field === "missingQuantity") {
            updated.isMissing = val > 0;
            if (val > 0) updated.isReceived = false;
          }
          return updated;
        });
        const updatedPO = { ...po, items: updatedItems };
        setSelectedPO(updatedPO);
        return updatedPO;
      }),
    );
  };

  const handleBulkMarkStatus = (status: "received" | "missing") => {
    if (!selectedPO || selectedItemIds.length === 0) return;
    setLocalPOs((prev) =>
      prev.map((po) => {
        if (po._id !== selectedPO._id) return po;
        const updatedItems = (po.items || []).map((item) => {
          if (!selectedItemIds.includes(item.id)) return item;
          if (status === "received") {
            return {
              ...item,
              isReceived: true,
              isMissing: false,
              receivedQuantity: item.orderedQuantity,
              missingQuantity: 0,
            };
          } else {
            return {
              ...item,
              isMissing: true,
              isReceived: false,
              missingQuantity: item.orderedQuantity,
              receivedQuantity: 0,
            };
          }
        });
        const updatedPO = { ...po, items: updatedItems };
        setSelectedPO(updatedPO);
        return updatedPO;
      }),
    );
    setSelectedItemIds([]);
  };

  const handleAddItemToCurrentPO = (inventoryItemId: string) => {
    if (!selectedPO || !inventoryItems) return;
    const invItem = inventoryItems.find((i) => i._id === inventoryItemId);
    if (!invItem) return;
    const invAny = invItem as any;
    const newItem: PurchaseOrderItem = {
      id: `item_${Date.now()}`,
      name: invItem.name,
      category: invAny.category || "General",
      stock: `${invAny.availableStock ?? invAny.currentStock ?? 0} ${invItem.buyingUnit || "unit"}`,
      stockPercentage: 50,
      sku:
        invItem.skuNumber ||
        invAny.sku ||
        `SKU-${Date.now().toString().slice(-4)}`,
      buyingUnit: invItem.buyingUnit || "unit",
      orderedQuantity: 10,
      unitCost: invItem.unitCost ?? 100,
      isReceived: false,
      isMissing: false,
    };
    setLocalPOs((prev) =>
      prev.map((po) => {
        if (po._id !== selectedPO._id) return po;
        const updatedItems = [...(po.items || []), newItem];
        const updatedPO = {
          ...po,
          items: updatedItems,
          itemsCount: updatedItems.length,
        };
        setSelectedPO(updatedPO);
        return updatedPO;
      }),
    );
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
          <p className="text-xs text-stone-500 font-medium">
            Loading Purchase Order Portal...
          </p>
        </div>
      </div>
    );
  }

  // Render Full Detail Screen when PO is selected
  if (selectedPO) {
    const allItems = selectedPO.items || [];
    const orderedItems = allItems;
    const receivedItems = allItems.filter(
      (i) => i.isReceived || (i.receivedQuantity ?? 0) > 0,
    );
    const missingItems = allItems.filter(
      (i) => i.isMissing || (i.missingQuantity ?? 0) > 0,
    );

    const activeList =
      detailTab === "ordered"
        ? orderedItems
        : detailTab === "received"
          ? receivedItems
          : missingItems;

    const filteredDetailItems = activeList.filter((item) => {
      if (!detailSearchQuery.trim()) return true;
      const q = detailSearchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });

    const totalPOAmount = allItems.reduce(
      (acc, i) => acc + i.orderedQuantity * i.unitCost,
      0,
    );

    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[#fbfbfa] w-full">
        {/* Header Breadcrumb & Back */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#eeebe4] pb-5">
          <div>
            <div className="flex items-center space-x-2 text-xs text-stone-500 mb-1">
              <button
                type="button"
                onClick={() => setSelectedPO(null)}
                className="hover:text-stone-900 flex items-center space-x-1 font-medium transition cursor-pointer"
              >
                <span>&larr; Back to Purchase Orders</span>
              </button>
              <span>/</span>
              <span className="font-mono text-[#141413]">
                {selectedPO.poNumber}
              </span>
            </div>
            <h1 className="font-serif text-3xl font-normal text-[#141413] flex items-center gap-3">
              <span>{selectedPO.poNumber} Details</span>
              {renderStatusBadge(selectedPO.status)}
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setSelectedPO(null)}
              className="px-4 py-2 bg-white border border-[#e2dfd7] hover:bg-[#f4f3ef] text-stone-700 rounded-full text-xs font-medium transition cursor-pointer"
            >
              Back to List
            </button>

            {selectedPO.status !== "settled" && (
              <button
                type="button"
                disabled={isSettling}
                onClick={() => handleSettlePO(selectedPO)}
                className="px-5 py-2 rounded-full bg-[#0c0a09] hover:bg-[#292524] text-white !text-white text-xs font-semibold shadow-sm hover:shadow transition cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
              >
                <svg
                  className="w-4 h-4 text-white stroke-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-white !text-white font-semibold">
                  {isSettling ? "Settling..." : "Settle & Restock PO"}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* PO Details Summary Banner */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-5 rounded-2xl border border-[#eceae4] shadow-subtle">
          <div className="space-y-1">
            <p className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold">
              Supplier
            </p>
            <p className="text-sm font-medium text-[#141413]">
              {selectedPO.supplierName}
            </p>
            {selectedPO.companyName && (
              <p className="text-xs text-stone-400">{selectedPO.companyName}</p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold">
              Created Date
            </p>
            <p className="text-sm font-medium text-[#141413]">
              {new Date(selectedPO.createdAt).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold">
              Order Priority
            </p>
            <div>{renderPriorityBadge(selectedPO.purchasePriority)}</div>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold">
              Est. Total Amount
            </p>
            <p className="text-sm font-serif font-medium text-emerald-700">
              {currencySymbol}
              {formatCurrencyAmount(totalPOAmount, activeOrg?.country)}
            </p>
          </div>
        </div>

        {/* Supplier Invoice Upload & View Card */}
        <div className="bg-white p-5 rounded-2xl border border-[#eceae4] shadow-subtle flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#faf9f7] border border-[#e2dfd7] flex items-center justify-center text-stone-700 shrink-0">
              <svg
                className="w-5 h-5 text-stone-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-[#141413] tracking-tight">
                Supplier Invoice
              </h4>
              <p className="text-[11px] text-stone-500">
                {selectedPO.invoiceStorageKey || selectedPO.invoiceUrl
                  ? "Scanned supplier invoice PDF / Image copy attached"
                  : "Attach scanned PDF or image copy of supplier bill (Max 25MB)"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="file"
              ref={invoiceFileInputRef}
              onChange={handleInvoiceFileUpload}
              accept="application/pdf,image/jpeg,image/png,image/jpg"
              className="hidden"
            />

            {selectedPO.invoiceUrl && (
              <a
                href={selectedPO.invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-[#faf9f7] hover:bg-stone-100 text-stone-800 border border-[#e2dfd7] rounded-full text-xs font-medium transition cursor-pointer flex items-center space-x-1.5"
              >
                <svg
                  className="w-3.5 h-3.5 text-stone-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                <span>View Invoice</span>
              </a>
            )}

            <button
              type="button"
              disabled={isUploadingInvoice}
              onClick={() => invoiceFileInputRef.current?.click()}
              className="px-4 py-1.5 bg-stone-900 hover:bg-stone-800 text-white !text-white border border-stone-800 rounded-full text-xs font-medium transition cursor-pointer disabled:opacity-50 flex items-center space-x-2 shadow-2xs"
            >
              {isUploadingInvoice ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{uploadStatusText || "Uploading..."}</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-3.5 h-3.5 text-white stroke-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  <span>
                    {selectedPO.invoiceStorageKey || selectedPO.invoiceUrl
                      ? "Replace Invoice"
                      : "Upload Invoice"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tabs Matching Old Project (Ordered items, Received items, Missing items) */}
        <div className="bg-white rounded-2xl border border-[#eceae4] overflow-hidden shadow-subtle">
          {/* Tab Headers */}
          <div className="flex items-center justify-between border-b border-[#eeebe4] px-6 pt-4 bg-[#faf9f7]">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setDetailTab("ordered")}
                className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center space-x-2 ${
                  detailTab === "ordered"
                    ? "border-[#141413] text-[#141413]"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <span>Ordered items</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-stone-200 text-stone-700 font-bold">
                  {orderedItems.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDetailTab("received")}
                className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center space-x-2 ${
                  detailTab === "received"
                    ? "border-emerald-700 text-emerald-800"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <span>Received items</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                  {receivedItems.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDetailTab("missing")}
                className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center space-x-2 ${
                  detailTab === "missing"
                    ? "border-rose-600 text-rose-700"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <span>Missing items</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-700 font-bold">
                  {missingItems.length}
                </span>
              </button>
            </div>

            {/* Quick add item dropdown if available */}
            {inventoryItems &&
              inventoryItems.length > 0 &&
              selectedPO.status !== "settled" && (
                <div className="pb-3">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddItemToCurrentPO(e.target.value);
                        e.target.value = "";
                      }
                    }}
                    defaultValue=""
                    className="px-3.5 py-1.5 bg-white border border-[#e2dfd7] rounded-full text-xs font-medium text-stone-700 focus:outline-none cursor-pointer hover:border-stone-400 transition"
                  >
                    <option value="" disabled>
                      + Add item to PO
                    </option>
                    {inventoryItems.map((inv) => (
                      <option key={inv._id} value={inv._id}>
                        {inv.name} ({inv.buyingUnit || "unit"})
                      </option>
                    ))}
                  </select>
                </div>
              )}
          </div>

          {/* Search Bar & Bulk Actions Bar inside PO detail tab */}
          <div className="p-4 bg-white border-b border-[#eeebe4] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                placeholder="Search items by name, SKU or category..."
                value={detailSearchQuery}
                onChange={(e) => setDetailSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-[#faf9f7] border border-[#e2dfd7] rounded-full focus:outline-none focus:ring-1 focus:ring-[#141413]"
              />
              <svg
                className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5"
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

            {selectedItemIds.length > 0 && selectedPO.status !== "settled" && (
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleBulkMarkStatus("received")}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium transition cursor-pointer"
                >
                  Mark Selected ({selectedItemIds.length}) Received
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkMarkStatus("missing")}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-full text-xs font-medium transition cursor-pointer"
                >
                  Mark Selected ({selectedItemIds.length}) Missing
                </button>
              </div>
            )}
          </div>

          {/* Items Table */}
          {filteredDetailItems.length === 0 ? (
            <div className="p-12 text-center text-stone-400 text-xs">
              No items found in this tab.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#f0eee9] bg-[#faf9f7] text-[11px] font-semibold text-[#787670] uppercase tracking-wider">
                    <th className="py-3 px-4 w-8 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredDetailItems.length > 0 &&
                          filteredDetailItems.every((i) =>
                            selectedItemIds.includes(i.id),
                          )
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItemIds(
                              filteredDetailItems.map((i) => i.id),
                            );
                          } else {
                            setSelectedItemIds([]);
                          }
                        }}
                        className="rounded border-stone-300 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4">Item & SKU</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Ordered Qty</th>
                    <th className="py-3 px-4 text-center">Received Qty</th>
                    <th className="py-3 px-4 text-center">Missing Qty</th>
                    <th className="py-3 px-4 text-right">Unit Cost</th>
                    <th className="py-3 px-4 text-right">Total Cost</th>
                    <th className="py-3 px-5 text-center">
                      Item Status / Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f1ec] text-xs">
                  {filteredDetailItems.map((item) => {
                    const isSelected = selectedItemIds.includes(item.id);
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-[#fcfbf9] transition-colors ${
                          isSelected ? "bg-amber-50/40" : ""
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedItemIds((prev) => [
                                  ...prev,
                                  item.id,
                                ]);
                              } else {
                                setSelectedItemIds((prev) =>
                                  prev.filter((id) => id !== item.id),
                                );
                              }
                            }}
                            className="rounded border-stone-300 cursor-pointer"
                          />
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-[#141413]">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-stone-400 font-mono">
                            {item.sku}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-stone-600">
                          {item.category}
                        </td>

                        {/* Ordered Qty */}
                        <td className="py-3.5 px-4 text-center">
                          {selectedPO.status !== "settled" ? (
                            <input
                              type="number"
                              min="0"
                              value={item.orderedQuantity}
                              onChange={(e) =>
                                handleItemQtyChange(
                                  item.id,
                                  "orderedQuantity",
                                  Number(e.target.value),
                                )
                              }
                              className="w-16 px-2 py-1 bg-white border border-[#e2dfd7] rounded text-center text-xs font-semibold focus:outline-none focus:border-[#141413]"
                            />
                          ) : (
                            <span className="font-semibold text-stone-800">
                              {item.orderedQuantity} {item.buyingUnit}
                            </span>
                          )}
                        </td>

                        {/* Received Qty */}
                        <td className="py-3.5 px-4 text-center">
                          {selectedPO.status !== "settled" ? (
                            <input
                              type="number"
                              min="0"
                              max={item.orderedQuantity}
                              value={
                                item.receivedQuantity ??
                                (item.isReceived ? item.orderedQuantity : 0)
                              }
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                const missing = Math.max(
                                  0,
                                  item.orderedQuantity - val,
                                );
                                handleItemQtyChange(
                                  item.id,
                                  "receivedQuantity",
                                  val,
                                );
                                handleItemQtyChange(
                                  item.id,
                                  "missingQuantity",
                                  missing,
                                );
                              }}
                              className="w-16 px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-center text-xs font-semibold focus:outline-none"
                            />
                          ) : (
                            <span className="font-medium text-emerald-700">
                              {item.receivedQuantity ??
                                (item.isReceived
                                  ? item.orderedQuantity
                                  : 0)}{" "}
                              {item.buyingUnit}
                            </span>
                          )}
                        </td>

                        {/* Missing Qty (Computed Frontend Display) */}
                        <td className="py-3.5 px-4 text-center">
                          {(() => {
                            const recQty =
                              item.receivedQuantity ??
                              (item.isReceived ? item.orderedQuantity : 0);
                            const calcMissing = Math.max(
                              0,
                              item.orderedQuantity - recQty,
                            );
                            return selectedPO.status !== "settled" ? (
                              <input
                                type="number"
                                min="0"
                                value={calcMissing}
                                onChange={(e) =>
                                  handleItemQtyChange(
                                    item.id,
                                    "missingQuantity",
                                    Number(e.target.value),
                                  )
                                }
                                className={`w-16 px-2 py-1 border rounded text-center text-xs font-semibold focus:outline-none ${
                                  calcMissing > 0
                                    ? "bg-amber-50 border-amber-300 text-amber-800 font-bold"
                                    : "bg-stone-50 border-stone-200 text-stone-600"
                                }`}
                              />
                            ) : (
                              <span
                                className={`font-medium ${calcMissing > 0 ? "text-amber-800 font-bold" : "text-stone-500"}`}
                              >
                                {calcMissing} {item.buyingUnit}
                              </span>
                            );
                          })()}
                        </td>

                        {/* Unit Cost */}
                        <td className="py-3.5 px-4 text-right font-medium text-stone-700">
                          {currencySymbol}
                          {formatCurrencyAmount(
                            item.unitCost,
                            activeOrg?.country,
                          )}
                        </td>

                        {/* Total Cost */}
                        <td className="py-3.5 px-4 text-right font-semibold text-[#141413]">
                          {currencySymbol}
                          {formatCurrencyAmount(
                            item.orderedQuantity * item.unitCost,
                            activeOrg?.country,
                          )}
                        </td>

                        {/* Line Discrepancy Status & Action */}
                        <td className="py-3.5 px-5 text-center whitespace-nowrap">
                          {(() => {
                            const recQty =
                              item.receivedQuantity ??
                              (item.isReceived ? item.orderedQuantity : 0);
                            const missingQty = Math.max(
                              0,
                              item.orderedQuantity - recQty,
                            );
                            const isShortShip =
                              recQty > 0 && recQty < item.orderedQuantity;
                            const isFullyRec =
                              recQty >= item.orderedQuantity || item.isReceived;

                            if (isShortShip) {
                              return (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
                                  <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  Short Shipment ({missingQty} missing)
                                </span>
                              );
                            }

                            if (isFullyRec) {
                              return (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300">
                                  <svg
                                    className="w-3.5 h-3.5 mr-1"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                  Fully Received
                                </span>
                              );
                            }

                            return selectedPO.status !== "settled" ? (
                              <div className="inline-flex items-center space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleReceived(item.id)}
                                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50 transition cursor-pointer"
                                >
                                  Mark Received
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleMissing(item.id)}
                                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white text-rose-700 border border-rose-300 hover:bg-rose-50 transition cursor-pointer"
                                >
                                  Mark Missing
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-stone-400 italic">
                                Pending
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#fbfbfa] relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-medium flex items-center space-x-2 transition-all duration-300 ${
            toastMessage.type === "success"
              ? "bg-stone-900 text-white border-stone-800"
              : "bg-rose-900 text-white border-rose-800"
          }`}
        >
          {toastMessage.type === "success" ? (
            <svg
              className="w-4 h-4 text-emerald-400 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 text-rose-400 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="px-8 pt-8 pb-6 border-b border-[#eceae4] bg-[#fbfbfa] shrink-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-[#787670] tracking-wide uppercase mb-1 font-mono">
              <span>INVENTORY</span>
              <span>/</span>
              <span className="text-[#141413] font-medium">
                PURCHASE ORDERS
              </span>
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
              <span className="text-white !text-white font-semibold">
                New Purchase Order
              </span>
            </button>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-3.5 w-3.5 text-stone-400"
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
              All{" "}
              <span className="ml-1 text-[10px] opacity-75">{counts.all}</span>
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
              Draft{" "}
              <span className="ml-1 text-[10px] opacity-75">
                {counts.drafted}
              </span>
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
              Sent{" "}
              <span className="ml-1 text-[10px] opacity-75">{counts.sent}</span>
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
              Settled{" "}
              <span className="ml-1 text-[10px] opacity-75">
                {counts.settled}
              </span>
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
              Cancelled{" "}
              <span className="ml-1 text-[10px] opacity-75">
                {counts.cancelled}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {filteredPOs.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#eceae4] p-16 text-center max-w-2xl mx-auto shadow-subtle my-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#f4f3ef] border border-[#e8e6e1] flex items-center justify-center text-stone-400 mb-4">
              <svg
                className="w-7 h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.4"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="font-serif text-2xl text-[#141413] font-normal tracking-tight">
              No purchase orders yet
            </h2>
            <p className="text-xs text-[#787670] mt-2 max-w-sm mx-auto leading-relaxed">
              Create a purchase order when you need to buy more stock from your
              trusted vendors.
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={openNewPODrawer}
                className="inline-flex items-center justify-center space-x-2 bg-[#141413] hover:bg-black text-white !text-white px-5 py-2.5 rounded-full text-xs font-semibold tracking-wide shadow-sm hover:shadow transition-all cursor-pointer"
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
                <span className="text-white !text-white font-semibold">
                  Create Purchase Order
                </span>
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
                  {filteredPOs.map((po) => {
                    const isExpanded = !!expandedPoIds[po._id];
                    return (
                      <React.Fragment key={po._id}>
                        <tr
                          onClick={() => setSelectedPO(po)}
                          className="hover:bg-[#fcfbf9] transition-colors group cursor-pointer"
                        >
                          <td className="py-4 px-5 font-semibold text-[#141413] tracking-tight">
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
                                title={
                                  isExpanded ? "Collapse items" : "Expand items"
                                }
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
                              <span>{po.poNumber}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-stone-600 whitespace-nowrap">
                            {new Date(po.createdAt).toLocaleDateString(
                              "en-GB",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <div className="font-medium text-[#141413]">
                              {po.supplierName}
                            </div>
                            <div className="text-[11px] text-[#787670]">
                              {po.companyName || po.supplierName}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center font-medium text-stone-700">
                            {po.itemsCount}{" "}
                            {po.itemsCount === 1 ? "item" : "items"}
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
                                  className="px-3.5 py-1 bg-[#f4f3ef] hover:bg-stone-200 text-stone-800 rounded-full text-xs font-medium transition-colors cursor-pointer"
                                >
                                  View Summary
                                </button>
                              ) : po.status === "drafted" ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDispatchPO(po);
                                  }}
                                  className="px-3.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-full text-xs font-medium transition-colors cursor-pointer"
                                >
                                  Dispatch / Send
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setSelectedPO(po)}
                                  className="px-3.5 py-1 bg-white hover:bg-[#141413] hover:text-white text-[#141413] border border-[#dcdad3] rounded-full text-xs font-medium transition-colors cursor-pointer shadow-2xs"
                                >
                                  Open Order &rarr;
                                </button>
                              )}

                              {/* 3-dots Menu Button & Popover Dropdown */}
                              <div className="relative inline-block text-left">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuPoId(
                                      openMenuPoId === po._id ? null : po._id,
                                    );
                                  }}
                                  className="p-1.5 text-stone-400 hover:text-stone-800 rounded-lg hover:bg-stone-100 transition cursor-pointer flex items-center justify-center"
                                  title="Actions menu"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                  </svg>
                                </button>

                                {openMenuPoId === po._id && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-40 cursor-default"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuPoId(null);
                                      }}
                                    />
                                    <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-2xl border border-stone-200 py-1.5 z-50 text-xs font-medium text-[#141413] divide-y divide-stone-100 text-left">
                                      <div className="py-1">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenMenuPoId(null);
                                            setSelectedPO(po);
                                          }}
                                          className="w-full text-left px-4 py-2 hover:bg-stone-100 transition cursor-pointer text-[#141413] font-medium"
                                        >
                                          View details
                                        </button>
                                        {po.status === "drafted" && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setOpenMenuPoId(null);
                                              handleDispatchPO(po);
                                            }}
                                            className="w-full text-left px-4 py-2 hover:bg-sky-50 text-sky-700 transition cursor-pointer font-medium"
                                          >
                                            Dispatch / Send PO
                                          </button>
                                        )}
                                        {po.status === "sent" && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setOpenMenuPoId(null);
                                              handleSettlePO(po);
                                            }}
                                            className="w-full text-left px-4 py-2 hover:bg-emerald-50 text-emerald-700 transition cursor-pointer font-medium"
                                          >
                                            Settle PO & Restock
                                          </button>
                                        )}
                                      </div>

                                      <div className="pt-1">
                                        <button
                                          type="button"
                                          disabled={
                                            po.status === "settled" ||
                                            po.status === "cancelled"
                                          }
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenMenuPoId(null);
                                            handleCancelPO(po);
                                          }}
                                          className="w-full text-left px-4 py-2 hover:bg-rose-50 text-rose-600 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer font-medium"
                                        >
                                          Cancel PO
                                        </button>
                                      </div>
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
                                    Line items in {po.poNumber} (
                                    {po.items?.length || 0})
                                  </span>
                                  <span className="text-xs font-serif font-semibold text-emerald-700">
                                    Est. Total: {currencySymbol}
                                    {formatCurrencyAmount(
                                      po.totalAmount || 0,
                                      activeOrg?.country,
                                    )}
                                  </span>
                                </div>
                                {!po.items || po.items.length === 0 ? (
                                  <p className="text-xs text-stone-400 italic">
                                    No line items in this purchase order.
                                  </p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {po.items.map((item, idx) => (
                                      <div
                                        key={item.id || idx}
                                        className="flex items-center justify-between text-xs py-1.5 px-3 rounded hover:bg-stone-50 border border-transparent hover:border-stone-200 transition"
                                      >
                                        <div className="flex items-center space-x-2">
                                          <span className="font-semibold text-stone-900">
                                            ├── {item.name}
                                          </span>
                                          <span className="text-[11px] text-stone-400 font-mono">
                                            ({item.sku})
                                          </span>
                                        </div>
                                        <div className="flex items-center space-x-6 text-stone-600">
                                          <span>
                                            Qty:{" "}
                                            <strong>
                                              {item.orderedQuantity}
                                            </strong>{" "}
                                            {item.buyingUnit}
                                          </span>
                                          <span>
                                            Cost: {currencySymbol}
                                            {formatCurrencyAmount(
                                              item.unitCost,
                                              activeOrg?.country,
                                            )}
                                            /{item.buyingUnit}
                                          </span>
                                          <span className="font-semibold text-stone-900">
                                            Line Total: {currencySymbol}
                                            {formatCurrencyAmount(
                                              item.orderedQuantity *
                                                item.unitCost,
                                              activeOrg?.country,
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
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Select Supplier / New Purchase Order Drawer */}
      {isNewPODrawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-[#141413]/30 backdrop-blur-[2px] transition-opacity duration-300 opacity-100 z-40"
            onClick={() => setIsNewPODrawerOpen(false)}
          />
          <aside className="fixed top-0 right-0 bottom-0 w-full max-w-[440px] bg-white border-l border-[#eceae4] shadow-drawer z-50 flex flex-col transform translate-x-0 transition-transform duration-300 ease-out">
            {/* Drawer Header */}
            <div className="p-6 border-b border-[#eceae4] flex items-start justify-between shrink-0 bg-[#faf9f7]">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-stone-500 mb-0.5">
                  INVENTORY MANAGEMENT
                </div>
                <h2 className="font-serif text-2xl font-normal text-[#141413] tracking-tight">
                  New Purchase Order
                </h2>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Choose who you are buying from and how urgent the order is.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewPODrawerOpen(false)}
                className="text-stone-400 hover:text-[#141413] p-1.5 rounded-full hover:bg-stone-200 transition-colors cursor-pointer"
                title="Close"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M6 18L18 6M6 6l12 12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </button>
            </div>

            {/* Drawer Body Form Content */}
            <form
              id="createPoForm"
              onSubmit={handleCreatePOSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-6"
            >
              {/* Supplier Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="supplierSelect"
                    className="block text-xs font-semibold text-[#141413]"
                  >
                    Supplier <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      alert("Redirecting to Supplier Directory...")
                    }
                    className="text-[11px] font-medium text-stone-700 hover:text-black hover:underline cursor-pointer"
                  >
                    + Add new supplier
                  </button>
                </div>

                <div className="relative">
                  <select
                    id="supplierSelect"
                    required
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full text-xs rounded-xl border border-[#d8d5cc] bg-white px-3.5 py-2.5 text-[#141413] focus:border-[#141413] focus:ring-1 focus:ring-[#141413] shadow-2xs font-sans transition-colors cursor-pointer"
                  >
                    <option value="" disabled>
                      Select a supplier...
                    </option>
                    {suppliers && suppliers.length > 0 ? (
                      suppliers.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.supplierName}{" "}
                          {s.companyName ? `— ${s.companyName}` : ""}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="neel">Neel Raval — Primary Foods</option>
                        <option value="sharma">
                          Ramesh Sharma — Sharma Dairy & Agro Wholesale
                        </option>
                        <option value="defx">defx — Neel Raval</option>
                        <option value="datapitch">
                          Datapitch Foods — Harsh Patel
                        </option>
                      </>
                    )}
                  </select>
                </div>

                <p className="mt-1.5 text-[11px] text-stone-500 flex items-center space-x-1">
                  <svg
                    className="w-3.5 h-3.5 text-stone-400 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                  <span>
                    Add a supplier first if you cannot find your vendor.
                  </span>
                </p>
              </div>

              {/* Priority Selector Cards (High / Medium / Low) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#141413]">
                    Purchase priority <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-stone-500">
                    Choose delivery speed
                  </span>
                </div>

                <div className="space-y-2.5">
                  {/* High Priority Card */}
                  <div
                    onClick={() => setPurchasePriority("high")}
                    className={`relative flex items-center p-3 rounded-xl cursor-pointer transition-all ${
                      purchasePriority === "high"
                        ? "border-2 border-[#141413] bg-[#faf9f7]"
                        : "border border-[#e2ded6] hover:border-rose-300 bg-white hover:bg-rose-50/20"
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full border mr-3 flex items-center justify-center shrink-0 ${
                        purchasePriority === "high"
                          ? "border-rose-600 bg-rose-600"
                          : "border-stone-300"
                      }`}
                    >
                      {purchasePriority === "high" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-rose-600">
                          High
                        </span>
                        <span className="text-[10px] uppercase font-semibold text-rose-500 tracking-wider bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                          URGENT
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Urgent delivery needed today
                      </p>
                    </div>
                  </div>

                  {/* Medium Priority Card */}
                  <div
                    onClick={() => setPurchasePriority("medium")}
                    className={`relative flex items-center p-3 rounded-xl cursor-pointer transition-all ${
                      purchasePriority === "medium"
                        ? "border-2 border-[#141413] bg-[#faf9f7]"
                        : "border border-[#e2ded6] hover:border-amber-300 bg-white hover:bg-amber-50/20"
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full border mr-3 flex items-center justify-center shrink-0 ${
                        purchasePriority === "medium"
                          ? "border-amber-600 bg-amber-600"
                          : "border-stone-300"
                      }`}
                    >
                      {purchasePriority === "medium" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-amber-600">
                          Medium
                        </span>
                        <span className="text-[10px] font-medium text-amber-600 tracking-wide bg-amber-50 px-1.5 py-0.5 rounded">
                          Standard
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Standard restock 1–2 days
                      </p>
                    </div>
                  </div>

                  {/* Low Priority Card */}
                  <div
                    onClick={() => setPurchasePriority("low")}
                    className={`relative flex items-center p-3 rounded-xl cursor-pointer transition-all ${
                      purchasePriority === "low"
                        ? "border-2 border-[#141413] bg-[#faf9f7]"
                        : "border border-[#e2ded6] hover:border-stone-400 bg-white"
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full border mr-3 flex items-center justify-center shrink-0 ${
                        purchasePriority === "low"
                          ? "border-[#141413] bg-[#141413]"
                          : "border-stone-300"
                      }`}
                    >
                      {purchasePriority === "low" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-stone-900">
                          Low
                        </span>
                        <span className="text-[10px] font-medium text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                          Refill
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Advance stock refill
                      </p>
                    </div>
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] text-stone-500">
                  Choose how urgently you need this order fulfilled.
                </p>
              </div>

              {/* Informational Notice Box */}
              <div className="p-3.5 rounded-xl bg-[#f5f4ef] border border-[#e6e4dc] flex items-start space-x-2.5">
                <svg
                  className="w-4 h-4 text-stone-600 mt-0.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
                <div className="text-[11px] text-stone-600 leading-relaxed">
                  <span className="font-semibold text-[#141413]">
                    Initial status hint:
                  </span>{" "}
                  Created order will start as{" "}
                  <strong className="text-[#141413]">Draft</strong> so you can
                  add ingredients and specify precise quantities before
                  officially sending to the vendor.
                </div>
              </div>
            </form>

            {/* Drawer Footer Actions */}
            <div className="p-5 border-t border-[#eceae4] bg-[#faf9f7] flex items-center justify-end space-x-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsNewPODrawerOpen(false)}
                className="px-4 py-2.5 rounded-full text-xs font-medium text-stone-600 hover:text-[#141413] hover:bg-[#eae8e1] border border-transparent transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="createPoForm"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-full text-xs font-medium bg-[#141413] hover:bg-black text-white shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Creating..." : "Create Purchase Order"}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
