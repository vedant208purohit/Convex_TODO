"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { getCurrencyForCountry, formatStoreDate, formatStoreDateTime } from "@/lib/constants/countries";
import { ComingSoonOverlay } from "../ComingSoonOverlay";

// Preset Buying Units & Relatable Serving Units matching old project
const BUYING_UNITS = [
  { label: "Kilogram (kg)", value: "kilogram", shortform: "kg" },
  { label: "Gram (g)", value: "gram", shortform: "g" },
  { label: "Milligram (mg)", value: "milligram", shortform: "mg" },
  { label: "Litre (l)", value: "litre", shortform: "l" },
  { label: "Millilitre (ml)", value: "millilitre", shortform: "ml" },
  { label: "Dozen (dzn)", value: "dozen", shortform: "dzn" },
  { label: "Pounds (lbs)", value: "pounds", shortform: "lbs" },
  { label: "Ounce (oz)", value: "ounce", shortform: "oz" },
  { label: "Fluid ounce (fl oz)", value: "fluid ounce", shortform: "fl oz" },
  { label: "Gallon (gal)", value: "gallon", shortform: "gal" },
  { label: "Piece (pc)", value: "piece", shortform: "pc" },
  { label: "Packet (pkt)", value: "packet", shortform: "pkt" },
  { label: "Box", value: "box", shortform: "box" },
];

const RELATABLE_UNITS_MAP: Record<
  string,
  Array<{ label: string; value: string; shortform: string }>
> = {
  kilogram: [
    { label: "Kilogram (kg)", value: "kilogram", shortform: "kg" },
    { label: "Gram (g)", value: "gram", shortform: "g" },
    { label: "Milligram (mg)", value: "milligram", shortform: "mg" },
    { label: "Teaspoon (tsp)", value: "teaspoon", shortform: "tsp" },
    { label: "Tablespoon (tbsp)", value: "tablespoon", shortform: "tbsp" },
  ],
  gram: [
    { label: "Gram (g)", value: "gram", shortform: "g" },
    { label: "Milligram (mg)", value: "milligram", shortform: "mg" },
    { label: "Kilogram (kg)", value: "kilogram", shortform: "kg" },
  ],
  milligram: [
    { label: "Milligram (mg)", value: "milligram", shortform: "mg" },
    { label: "Gram (g)", value: "gram", shortform: "g" },
  ],
  litre: [
    { label: "Litre (l)", value: "litre", shortform: "l" },
    { label: "Millilitre (ml)", value: "millilitre", shortform: "ml" },
    { label: "Fluid ounce (fl oz)", value: "fluid ounce", shortform: "fl oz" },
  ],
  millilitre: [
    { label: "Millilitre (ml)", value: "millilitre", shortform: "ml" },
    { label: "Litre (l)", value: "litre", shortform: "l" },
  ],
  dozen: [
    { label: "Piece (pc)", value: "piece", shortform: "pc" },
    { label: "Dozen (dzn)", value: "dozen", shortform: "dzn" },
  ],
  piece: [
    { label: "Piece (pc)", value: "piece", shortform: "pc" },
    { label: "Portion", value: "portion", shortform: "ptn" },
  ],
  packet: [
    { label: "Gram (g)", value: "gram", shortform: "g" },
    { label: "Piece (pc)", value: "piece", shortform: "pc" },
    { label: "Packet (pkt)", value: "packet", shortform: "pkt" },
  ],
  box: [
    { label: "Piece (pc)", value: "piece", shortform: "pc" },
    { label: "Packet (pkt)", value: "packet", shortform: "pkt" },
    { label: "Box", value: "box", shortform: "box" },
  ],
};

const DEFAULT_CATEGORIES = [
  "Baked items",
  "Beverages",
  "Dairy items",
  "Dry items",
  "Frozen foods",
  "Fresh produce",
  "Meat & poultry",
  "Seafood",
  "Spices & seasonings",
  "Staples",
];

function getShortUnit(unitName: string): string {
  const match = BUYING_UNITS.find(
    (u) => u.value.toLowerCase() === unitName.toLowerCase()
  );
  if (match) return match.shortform;
  if (unitName.toLowerCase().startsWith("kg") || unitName.toLowerCase().startsWith("kilo"))
    return "kg";
  if (unitName.toLowerCase().startsWith("g") || unitName.toLowerCase().startsWith("gram"))
    return "g";
  if (unitName.toLowerCase().startsWith("l") || unitName.toLowerCase().startsWith("litr"))
    return "l";
  if (unitName.toLowerCase().startsWith("ml")) return "ml";
  if (unitName.toLowerCase().startsWith("pc")) return "pc";
  return unitName;
}

const UNIT_FACTORS: Record<
  string,
  { type: "weight" | "volume" | "count"; factor: number }
> = {
  gram: { type: "weight", factor: 1 },
  g: { type: "weight", factor: 1 },
  milligram: { type: "weight", factor: 0.001 },
  mg: { type: "weight", factor: 0.001 },
  kilogram: { type: "weight", factor: 1000 },
  kg: { type: "weight", factor: 1000 },
  pounds: { type: "weight", factor: 453.592 },
  lbs: { type: "weight", factor: 453.592 },
  ounce: { type: "weight", factor: 28.3495 },
  oz: { type: "weight", factor: 28.3495 },

  millilitre: { type: "volume", factor: 1 },
  ml: { type: "volume", factor: 1 },
  litre: { type: "volume", factor: 1000 },
  l: { type: "volume", factor: 1000 },
  teaspoon: { type: "volume", factor: 4.92892 },
  tsp: { type: "volume", factor: 4.92892 },
  tablespoon: { type: "volume", factor: 14.7868 },
  tbsp: { type: "volume", factor: 14.7868 },
  "fluid ounce": { type: "volume", factor: 29.5735 },
  "fl oz": { type: "volume", factor: 29.5735 },
  gallon: { type: "volume", factor: 3785.41 },
  gal: { type: "volume", factor: 3785.41 },

  piece: { type: "count", factor: 1 },
  pc: { type: "count", factor: 1 },
  portion: { type: "count", factor: 1 },
  ptn: { type: "count", factor: 1 },
  packet: { type: "count", factor: 1 },
  pkt: { type: "count", factor: 1 },
  dozen: { type: "count", factor: 12 },
  dzn: { type: "count", factor: 12 },
  box: { type: "count", factor: 1 },
};

function formatUnitDisplay(unitName?: string): string {
  if (!unitName) return "Piece (pc)";
  const match = BUYING_UNITS.find(
    (u) => u.value.toLowerCase() === unitName.toLowerCase()
  );
  if (match) return match.label;
  const short = getShortUnit(unitName);
  return `${unitName.charAt(0).toUpperCase() + unitName.slice(1)} (${short})`;
}

function convertStockUnits(
  amount: number,
  fromUnit?: string,
  toUnit?: string
): number {
  if (!fromUnit || !toUnit) return amount;
  const cleanFrom = fromUnit
    .trim()
    .toLowerCase()
    .split(" ")[0]
    .replace(/[\(\)]/g, "");
  const cleanTo = toUnit
    .trim()
    .toLowerCase()
    .split(" ")[0]
    .replace(/[\(\)]/g, "");

  const fromSpec =
    UNIT_FACTORS[cleanFrom] || UNIT_FACTORS[fromUnit.toLowerCase()];
  const toSpec = UNIT_FACTORS[cleanTo] || UNIT_FACTORS[toUnit.toLowerCase()];

  if (!fromSpec || !toSpec) return amount;
  if (fromSpec.type !== toSpec.type) return amount;

  const inBase = amount * fromSpec.factor;
  return inBase / toSpec.factor;
}

export function ItemLibraryView({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations?.find((o) => o?._id === organizationId) || organizations?.[0];
  const currencySymbol = activeOrg?.defaultCurrencySymbol || (activeOrg?.country ? getCurrencyForCountry(activeOrg.country).symbol : "₹");
  const rawItems = useQuery(api.inventory.listInventoryItems, organizationId ? { organizationId } : "skip");
  const items = useMemo(() => rawItems ?? [], [rawItems]);

  const suppliers = useQuery(api.inventory.listSuppliers, organizationId ? { organizationId } : "skip");
  const rawPOs = useQuery(api.inventory.listPurchaseOrders, organizationId ? { organizationId } : "skip");
  const purchaseOrders = useMemo(() => rawPOs ?? [], [rawPOs]);

  const createItemMutation = useMutation(api.inventory.createInventoryItem);
  const updateItemMutation = useMutation(api.inventory.updateInventoryItem);
  const deleteItemMutation = useMutation(api.inventory.deleteInventoryItem);
  const adjustStockMutation = useMutation(api.inventory.adjustInventoryStock);
  const backfillStockLogsMutation = useMutation(api.inventory.backfillStockLogsPO);

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selected item for full detail page view (e.g. TEA PREMIX)
  const [selectedItemDetail, setSelectedItemDetail] = useState<any | null>(null);
  const [detailActiveTab, setDetailActiveTab] = useState<
    "added_logs" | "sales_logs" | "dead_logs"
  >("added_logs");
  const [detailPage, setDetailPage] = useState(1);
  const detailLogsPerPage = 10;

  useEffect(() => {
    setDetailPage(1);
  }, [selectedItemDetail?._id, detailActiveTab]);

  // Live Stock Logs for Selected Item
  const liveItemHistory = useQuery(
    api.inventory.getItemStockHistory,
    selectedItemDetail ? { inventoryItemId: selectedItemDetail._id } : "skip"
  );

  // Auto-reconcile unlinked stock logs for selected item
  useEffect(() => {
    if (selectedItemDetail?._id) {
      backfillStockLogsMutation({ inventoryItemId: selectedItemDetail._id }).catch(() => {});
    }
  }, [selectedItemDetail?._id, backfillStockLogsMutation]);

  // Negative Stock Flag
  const [allowNegativeStock, setAllowNegativeStock] = useState<boolean>(true);

  // Column Sorting state
  const [sortField, setSortField] = useState<
    "name" | "category" | "sku" | "availableStock" | "createdAt" | null
  >(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Drawer & Modal States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<
    "create" | "edit" | "assign_stock" | "log_dead_stock"
  >("create");
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Stock Logs per Item ID
  const [stockLogsMap, setStockLogsMap] = useState<
    Record<
      string,
      Array<{
        _id: string;
        quantity: number;
        unit: string;
        supplierName?: string;
        poNumber?: string;
        dateReceived: string;
        itemExpiry?: string;
      }>
    >
  >({});

  // Dead Stock Logs per Item ID
  const [deadStockLogsMap, setDeadStockLogsMap] = useState<
    Record<
      string,
      Array<{
        _id: string;
        quantity: number;
        unit: string;
        reason: string;
        markedDate: string;
      }>
    >
  >({});

  // Delete Modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);

  // Active Dropdown menu state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Form State (Edit / Add Item)
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Dairy items");
  const [description, setDescription] = useState("");
  const [skuNumber, setSkuNumber] = useState("");
  const [buyingUnit, setBuyingUnit] = useState("piece");
  const [servingUnit, setServingUnit] = useState("piece");
  const [minimumStockRefillLevel, setMinimumStockRefillLevel] = useState<number>(1);
  const [baselineStockLevel, setBaselineStockLevel] = useState<number>(1);
  const [initialStock, setInitialStock] = useState<number>(0);
  const [unitCost, setUnitCost] = useState<number>(0);

  // Form Validation Error States
  const [nameError, setNameError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [buyingUnitError, setBuyingUnitError] = useState("");
  const [servingUnitError, setServingUnitError] = useState("");
  const [minRefillError, setMinRefillError] = useState("");
  const [baselineError, setBaselineError] = useState("");

  // Add Item Stock Drawer Form State
  const [addStockQuantity, setAddStockQuantity] = useState<number | "">("");
  const [addStockUnit, setAddStockUnit] = useState<string>("");
  const [addStockSupplierId, setAddStockSupplierId] = useState<string>("");
  const [addStockPoNumber, setAddStockPoNumber] = useState<string>("");
  const [addStockPoId, setAddStockPoId] = useState<string>("");
  const [addStockDateReceived, setAddStockDateReceived] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [addStockItemExpiry, setAddStockItemExpiry] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Relatable units list based on buying unit selection
  const relatableUnits = useMemo(() => {
    return (
      RELATABLE_UNITS_MAP[buyingUnit] || [
        {
          label: servingUnit,
          value: servingUnit,
          shortform: getShortUnit(servingUnit),
        },
      ]
    );
  }, [buyingUnit, servingUnit]);

  // Sorting Handler
  const handleSort = (
    field: "name" | "category" | "sku" | "availableStock" | "createdAt"
  ) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Filtered and Sorted List
  const filteredAndSortedItems = useMemo(() => {
    let list = [...items];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.skuNumber && i.skuNumber.toLowerCase().includes(q)) ||
          (i.description && i.description.toLowerCase().includes(q))
      );
    }

    if (sortField) {
      list.sort((a, b) => {
        let valA: string | number = "";
        let valB: string | number = "";
        if (sortField === "name") {
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
        } else if (sortField === "category") {
          valA = "dairy items";
          valB = "dairy items";
        } else if (sortField === "sku") {
          valA = (a.skuNumber || "").toLowerCase();
          valB = (b.skuNumber || "").toLowerCase();
        } else if (sortField === "availableStock") {
          valA = a.availableStock ?? 0;
          valB = b.availableStock ?? 0;
        } else if (sortField === "createdAt") {
          valA = a.updatedAt || a._creationTime || 0;
          valB = b.updatedAt || b._creationTime || 0;
        }
        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [items, searchQuery, sortField, sortOrder]);

  // Paginated List
  const totalPages = Math.ceil(filteredAndSortedItems.length / itemsPerPage) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedItems.slice(start, start + itemsPerPage);
  }, [filteredAndSortedItems, currentPage]);

  const openAddDrawer = () => {
    setEditingItem(null);
    setDrawerMode("create");
    setName("");
    setCategory("");
    setDescription("");
    setSkuNumber("");
    setBuyingUnit("");
    setServingUnit("");
    setMinimumStockRefillLevel("" as any);
    setBaselineStockLevel("" as any);
    setInitialStock(0);
    setUnitCost(0);
    setAllowNegativeStock(true);
    setNameError("");
    setCategoryError("");
    setBuyingUnitError("");
    setServingUnitError("");
    setMinRefillError("");
    setBaselineError("");
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (item: any) => {
    setEditingItem(item);
    setDrawerMode("edit");
    setName(item.name || "");
    setCategory(item.category || "Dairy items");
    setDescription(item.description || "");
    setSkuNumber(item.skuNumber || "");
    setBuyingUnit(item.buyingUnit || "");
    setServingUnit(item.servingUnit || "");
    setMinimumStockRefillLevel(item.minimumStockRefillLevel ?? "");
    setBaselineStockLevel(item.baselineStockLevel ?? "");
    setInitialStock(item.availableStock || 0);
    setUnitCost(item.unitCost || 0);
    setAllowNegativeStock(item.allowNegativeStock !== false);
    setNameError("");
    setCategoryError("");
    setBuyingUnitError("");
    setServingUnitError("");
    setMinRefillError("");
    setBaselineError("");
    setActiveMenuId(null);
    setIsDrawerOpen(true);
  };

  const openAssignStockDrawer = (item: any) => {
    setEditingItem(item);
    setDrawerMode("assign_stock");
    setAddStockQuantity("");
    setAddStockUnit(item.buyingUnit || "piece");
    setAddStockSupplierId("");
    setAddStockPoNumber("");
    setAddStockPoId("");
    setAddStockDateReceived(new Date().toISOString().slice(0, 10));
    setAddStockItemExpiry(new Date().toISOString().slice(0, 10));
    setActiveMenuId(null);
    setIsDrawerOpen(true);
  };

  const openDeleteModal = (item: any) => {
    setItemToDelete(item);
    setActiveMenuId(null);
    setIsDeleteModalOpen(true);
  };

  const handleBuyingUnitChange = (unitVal: string) => {
    setBuyingUnit(unitVal);
    const related = RELATABLE_UNITS_MAP[unitVal];
    if (related && related.length > 0) {
      setServingUnit(related[0].value);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (drawerMode === "assign_stock") {
      const rawQty = Number(addStockQuantity);
      if (!rawQty || rawQty <= 0) {
        alert("Please enter a valid stock quantity.");
        return;
      }
      setIsSubmitting(true);
      try {
        if (editingItem) {
          const baseUnit = editingItem.buyingUnit || "piece";
          const chosenUnit = addStockUnit || baseUnit;
          const convertedQty = convertStockUnits(rawQty, chosenUnit, baseUnit);

          const currentStock = Number(editingItem.availableStock || 0);
          const newTotalStock = Math.round((currentStock + convertedQty) * 1000) / 1000;

          const selectedPo = purchaseOrders?.find(
            (p: any) => p._id === addStockPoId || p.poNumber === addStockPoNumber
          );
          const finalSupplierId = addStockSupplierId || selectedPo?.supplierId;

          await adjustStockMutation({
            organizationId,
            inventoryItemId: editingItem._id,
            actualStockCount: newTotalStock,
            reason: "Manual Stock Assignment",
            supplierId: finalSupplierId ? (finalSupplierId as Id<"suppliers">) : undefined,
            purchaseOrderId: selectedPo?._id ? (selectedPo._id as Id<"purchaseOrders">) : undefined,
            receivedDate: addStockDateReceived,
            expiryDate: addStockItemExpiry,
          });

          if (unitCost !== undefined && unitCost !== null && Number(unitCost) > 0) {
            await updateItemMutation({
              id: editingItem._id,
              unitCost: Number(unitCost),
            });
          }

          // Add to local stock logs
          const supplierObj = suppliers?.find((s) => s._id === addStockSupplierId);
          const newLog = {
            _id: `log_${Date.now()}`,
            quantity: rawQty,
            unit: formatUnitDisplay(chosenUnit),
            supplierName: supplierObj?.supplierName || undefined,
            poNumber: addStockPoNumber || undefined,
            dateReceived: addStockDateReceived,
            itemExpiry: addStockItemExpiry,
          };

          setStockLogsMap((prev) => ({
            ...prev,
            [editingItem._id]: [newLog, ...(prev[editingItem._id] || [])],
          }));

          if (selectedItemDetail && selectedItemDetail._id === editingItem._id) {
            setSelectedItemDetail((prev: any) =>
              prev ? { ...prev, availableStock: newTotalStock } : null
            );
          }
        }
        setIsDrawerOpen(false);
      } catch (err) {
        console.error("Failed to add stock:", err);
        alert("Failed to add item stock.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    let hasValidationError = false;

    if (!name.trim()) {
      setNameError("Item name is required.");
      hasValidationError = true;
    } else {
      setNameError("");
    }

    if (!category.trim()) {
      setCategoryError("Select category is required.");
      hasValidationError = true;
    } else {
      setCategoryError("");
    }

    if (!buyingUnit.trim()) {
      setBuyingUnitError("Buying unit is required.");
      hasValidationError = true;
    } else {
      setBuyingUnitError("");
    }

    if (!servingUnit.trim()) {
      setServingUnitError("Serving unit is required.");
      hasValidationError = true;
    } else {
      setServingUnitError("");
    }

    if (
      minimumStockRefillLevel === undefined ||
      minimumStockRefillLevel === null ||
      minimumStockRefillLevel === ("" as any) ||
      isNaN(Number(minimumStockRefillLevel))
    ) {
      setMinRefillError("Minimum stock refill level is required.");
      hasValidationError = true;
    } else {
      setMinRefillError("");
    }

    if (
      baselineStockLevel === undefined ||
      baselineStockLevel === null ||
      baselineStockLevel === ("" as any) ||
      isNaN(Number(baselineStockLevel))
    ) {
      setBaselineError("Baseline stock level is required.");
      hasValidationError = true;
    } else {
      setBaselineError("");
    }

    if (hasValidationError) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (drawerMode === "edit" && editingItem) {
        await updateItemMutation({
          id: editingItem._id,
          name: name.trim(),
          description: description.trim() || undefined,
          minimumStockRefillLevel: Number(minimumStockRefillLevel),
          unitCost: Number(unitCost),
          allowNegativeStock,
        });
      } else {
        await createItemMutation({
          organizationId,
          name: name.trim(),
          description: description.trim() || undefined,
          skuNumber: skuNumber.trim() || undefined,
          buyingUnit,
          servingUnit,
          minimumStockRefillLevel: Number(minimumStockRefillLevel),
          baselineStockLevel: Number(baselineStockLevel) || undefined,
          initialStock: Number(initialStock),
          unitCost: Number(unitCost),
          allowNegativeStock,
        });
      }
      setIsDrawerOpen(false);
    } catch (err) {
      console.error("Failed to save inventory item:", err);
      alert("Failed to save inventory item. Please check details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      try {
        await deleteItemMutation({ id: itemToDelete._id });
        if (selectedItemDetail && selectedItemDetail._id === itemToDelete._id) {
          setSelectedItemDetail(null);
        }
      } catch (err) {
        console.error("Failed to delete item:", err);
        alert("Failed to delete item from inventory.");
      }
    }
    setIsDeleteModalOpen(false);
    setItemToDelete(null);
  };

  // Shared Add Item Stock Drawer Content
  const renderAddStockDrawer = () => {
    if (!editingItem) return null;
    const baseUnit = editingItem.buyingUnit || "piece";
    const servingUnitVal = editingItem.servingUnit || "";
    const hasDifferentServingUnit =
      servingUnitVal &&
      servingUnitVal.toLowerCase() !== baseUnit.toLowerCase();

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-stone-200 flex items-start justify-between bg-white shrink-0">
          <div>
            <h2 className="text-xl text-stone-900 font-semibold tracking-tight">
              Add item stock
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {editingItem.name}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            className="text-stone-500 hover:text-stone-900 p-1 rounded-md transition cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form
          id="addStockForm"
          onSubmit={handleFormSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-stone-800"
        >
          {/* Quantity & Unit */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block font-medium mb-1 text-stone-800">
                Quantity <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0.001"
                step="any"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition placeholder:text-stone-400"
                placeholder="Enter the item quantity"
                value={addStockQuantity}
                onChange={(e) =>
                  setAddStockQuantity(
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
              />
            </div>
            <div>
              <label className="block font-medium mb-1 text-stone-800">Unit *</label>
              <select
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition text-stone-800 font-medium"
                value={addStockUnit}
                onChange={(e) => setAddStockUnit(e.target.value)}
              >
                <option value={baseUnit}>
                  {formatUnitDisplay(baseUnit)} (Buying unit)
                </option>
                {hasDifferentServingUnit && (
                  <option value={servingUnitVal}>
                    {formatUnitDisplay(servingUnitVal)} (Serving unit)
                  </option>
                )}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-stone-500 leading-normal">
            {addStockUnit.toLowerCase() !== baseUnit.toLowerCase() ? (
              <span>
                Note: Adding in <strong>{formatUnitDisplay(addStockUnit)}</strong> will automatically convert to <strong>{formatUnitDisplay(baseUnit)}</strong> when adding to total inventory.
              </span>
            ) : (
              <span>
                Note: Buying unit is <strong>{formatUnitDisplay(baseUnit)}</strong>. You can switch to <strong>{formatUnitDisplay(servingUnitVal || baseUnit)}</strong> above if needed.
              </span>
            )}
          </p>

          {/* Supplier */}
          <div>
            <label className="block font-medium mb-1 text-stone-800">Supplier</label>
            <select
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition text-stone-700"
              value={addStockSupplierId}
              onChange={(e) => setAddStockSupplierId(e.target.value)}
            >
              <option value="">Search supplier</option>
              {suppliers?.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.supplierName} ({s.companyName || "Supplier"})
                </option>
              ))}
            </select>
          </div>

          {/* PO Number */}
          <div>
            <label className="block font-medium mb-1 text-stone-800">PO number</label>
            <select
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition text-stone-700"
              value={addStockPoId || addStockPoNumber}
              onChange={(e) => {
                const val = e.target.value;
                setAddStockPoId(val);
                const selectedPo = purchaseOrders?.find(
                  (po: any) => po._id === val || po.poNumber === val
                );
                setAddStockPoNumber(selectedPo?.poNumber || "");
                if (selectedPo?.supplierId && !addStockSupplierId) {
                  setAddStockSupplierId(selectedPo.supplierId);
                }
              }}
            >
              <option value="">Select purchase order number</option>
              {purchaseOrders?.map((po: any) => (
                <option key={po._id} value={po._id}>
                  {po.poNumber} ({po.supplierName || "PO"})
                </option>
              ))}
            </select>
          </div>

          {/* Date received & Item expiry */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1 text-stone-800">
                Date received <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition"
                value={addStockDateReceived}
                onChange={(e) => setAddStockDateReceived(e.target.value)}
              />
            </div>
            <div>
              <label className="block font-medium mb-1 text-stone-800">Item expiry</label>
              <input
                type="date"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition"
                value={addStockItemExpiry}
                onChange={(e) => setAddStockItemExpiry(e.target.value)}
              />
            </div>
          </div>
          <p className="text-[11px] text-stone-500 leading-normal">
            Note: You can edit or remove the stock quantity in 24 hours after it was added. Once the 24 hours are completed, everything is locked.
          </p>
        </form>

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
            form="addStockForm"
            disabled={isSubmitting}
            className="w-1/2 py-2.5 rounded-lg bg-[#1c1917] hover:bg-[#292524] text-white !text-white text-xs font-semibold transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? "Adding..." : "Add stock"}
          </button>
        </div>
      </div>
    );
  };

  if (rawItems === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-[#fbf9f8]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-stone-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-stone-500 font-medium">Loading Item Library...</p>
        </div>
      </div>
    );
  }

  // RENDER DETAILED ITEM PAGE (Matching Screenshots 1, 2, 3, 4)
  if (selectedItemDetail) {
    const liveAddedLogs = (liveItemHistory ?? [])
      .filter((l) => !l.isDeadStock && l.stockType !== "debit")
      .map((l) => ({
        _id: l._id,
        quantity: l.quantity,
        unit: l.unit,
        supplierName: l.supplierName && l.supplierName !== "—" ? l.supplierName : "—",
        poNumber: l.poNumber && l.poNumber !== "—" ? l.poNumber : "—",
        dateReceived: l.dateReceived,
        itemExpiry: l.itemExpiry,
      }));

    const liveSalesLogs = (liveItemHistory ?? [])
      .filter((l) => !l.isDeadStock && l.stockType === "debit")
      .map((l) => ({
        _id: l._id,
        quantity: l.quantity,
        unit: l.unit,
        sourceType: l.sourceType,
        date: l.dateReceived || l.createdAt,
      }));

    const liveDeadLogs = (liveItemHistory ?? [])
      .filter((l) => l.isDeadStock)
      .map((l) => ({
        _id: l._id,
        quantity: l.quantity,
        unit: l.unit,
        reason: l.reason || "Wasted / Expired",
        markedDate: l.dateReceived,
      }));

    const itemLogs =
      liveAddedLogs.length > 0 ? liveAddedLogs : stockLogsMap[selectedItemDetail._id] || [];
    const itemDeadLogs =
      liveDeadLogs.length > 0 ? liveDeadLogs : deadStockLogsMap[selectedItemDetail._id] || [];

    const totalDetailPages = Math.max(1, Math.ceil(itemLogs.length / detailLogsPerPage));
    const paginatedItemLogs = itemLogs.slice(
      (detailPage - 1) * detailLogsPerPage,
      detailPage * detailLogsPerPage
    );

    const totalSalesPages = Math.max(1, Math.ceil(liveSalesLogs.length / detailLogsPerPage));
    const paginatedSalesLogs = liveSalesLogs.slice(
      (detailPage - 1) * detailLogsPerPage,
      detailPage * detailLogsPerPage
    );

    const totalDeadPages = Math.max(1, Math.ceil(itemDeadLogs.length / detailLogsPerPage));
    const paginatedDeadLogs = itemDeadLogs.slice(
      (detailPage - 1) * detailLogsPerPage,
      detailPage * detailLogsPerPage
    );

    return (
      <div className="flex-1 flex flex-col min-w-0 bg-[#fbf9f8] p-8 overflow-y-auto">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center space-x-2 text-xs text-stone-500 mb-4 font-sans">
          <button
            type="button"
            onClick={() => setSelectedItemDetail(null)}
            className="hover:text-stone-900 transition cursor-pointer"
          >
            Item library
          </button>
          <span>&gt;</span>
          <span className="font-semibold text-stone-900">{selectedItemDetail.name}</span>
        </div>

        {/* Page Title & Header Actions */}
        <div className="flex items-center justify-between pb-6">
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            {selectedItemDetail.name}
          </h1>

          <div className="flex items-center space-x-3">
            {/* Edit Pencil Button */}
            <button
              type="button"
              onClick={() => openEditDrawer(selectedItemDetail)}
              className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-lg transition cursor-pointer"
              title="Edit item"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </button>

            {/* Delete Trash Button */}
            <button
              type="button"
              onClick={() => openDeleteModal(selectedItemDetail)}
              className="p-2 text-stone-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
              title="Delete item"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>

            {/* Add Item Stock Button - Only visible when Added Stock Logs tab is active */}
            {detailActiveTab === "added_logs" && (
              <button
                type="button"
                onClick={() => openAssignStockDrawer(selectedItemDetail)}
                className="bg-stone-900 hover:bg-stone-800 text-white !text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow-2xs cursor-pointer inline-flex items-center space-x-1.5"
              >
                <span>Add item stock</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-8 border-b border-[#e7e5e4] text-xs font-medium mb-6">
          <button
            type="button"
            onClick={() => setDetailActiveTab("added_logs")}
            className={`pb-3 transition-colors cursor-pointer border-b-2 font-semibold ${
              detailActiveTab === "added_logs"
                ? "border-stone-900 text-stone-900"
                : "border-transparent text-stone-500 hover:text-stone-900"
            }`}
          >
            Added Stock Logs
          </button>
          <button
            type="button"
            onClick={() => setDetailActiveTab("sales_logs")}
            className={`pb-3 transition-colors cursor-pointer border-b-2 font-semibold ${
              detailActiveTab === "sales_logs"
                ? "border-stone-900 text-stone-900"
                : "border-transparent text-stone-500 hover:text-stone-900"
            }`}
          >
            Order Sales Deductions
          </button>
          <button
            type="button"
            onClick={() => setDetailActiveTab("dead_logs")}
            className={`pb-3 transition-colors cursor-pointer border-b-2 font-semibold ${
              detailActiveTab === "dead_logs"
                ? "border-stone-900 text-stone-900"
                : "border-transparent text-stone-500 hover:text-stone-900"
            }`}
          >
            Dead Stock Logs
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 flex flex-col min-h-0">
          {detailActiveTab === "added_logs" ? (
            itemLogs.length === 0 ? (
              /* Added Stock Logs Empty State */
              <div className="bg-white border border-[#e7e5e4] rounded-xl shadow-2xs p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-stone-100/80 border border-stone-200 flex items-center justify-center text-stone-400 mb-4">
                  <svg className="w-8 h-8 stroke-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 10l4 4m0-4l-4 4" />
                  </svg>
                </div>
                <h3 className="font-bold text-stone-900 text-base">
                  No stock logs available for this item
                </h3>
                <p className="text-xs text-stone-500 max-w-sm mt-1 mb-5">
                  Update your item stocks, and the logs will automatically appear here.
                </p>
                <button
                  type="button"
                  onClick={() => openAssignStockDrawer(selectedItemDetail)}
                  className="bg-stone-900 hover:bg-stone-800 text-white !text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow-2xs cursor-pointer"
                >
                  Add item stock
                </button>
              </div>
            ) : (
              /* Added Stock Logs Table */
              <div className="bg-white border border-[#e7e5e4] rounded-xl shadow-2xs overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#e7e5e4] bg-[#fafaf9] text-[11px] uppercase tracking-wider text-[#78716c] font-semibold sticky top-0 z-10 select-none">
                        <th className="py-3 px-5">Quantity added</th>
                        <th className="py-3 px-5">Supplier</th>
                        <th className="py-3 px-5">PO number</th>
                        <th className="py-3 px-5">Date received</th>
                        <th className="py-3 px-5">Expiry date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f5f5f4]">
                      {paginatedItemLogs.map((log) => (
                        <tr key={log._id} className="hover:bg-stone-50/80 transition-colors">
                          <td className="py-3.5 px-5 font-semibold text-stone-900">
                            {log.quantity} {formatUnitDisplay(log.unit)}
                          </td>
                          <td className="py-3.5 px-5 text-stone-700 font-medium">
                            {log.supplierName || "—"}
                          </td>
                          <td className="py-3.5 px-5 font-mono text-stone-600">
                            {log.poNumber || "—"}
                          </td>
                          <td className="py-3.5 px-5 text-stone-900 font-medium whitespace-nowrap">
                            {formatStoreDate(log.dateReceived, activeOrg?.country, activeOrg?.organizationTimeZone) || "—"}
                          </td>
                          <td className="py-3.5 px-5 text-stone-900 font-medium whitespace-nowrap">
                            {log.itemExpiry && log.itemExpiry !== "—"
                              ? formatStoreDate(log.itemExpiry, activeOrg?.country, activeOrg?.organizationTimeZone) || "—"
                              : "—"}
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
                      {itemLogs.length === 0
                        ? 0
                        : `${(detailPage - 1) * detailLogsPerPage + 1} - ${Math.min(
                            detailPage * detailLogsPerPage,
                            itemLogs.length
                          )}`}
                    </strong>{" "}
                    of <strong className="text-stone-900">{itemLogs.length}</strong> logs
                  </span>
                  <div className="flex items-center space-x-2 text-xs">
                    <button
                      type="button"
                      disabled={detailPage <= 1}
                      onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1 border border-[#e7e5e4] rounded-lg bg-white text-stone-800 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs font-medium"
                    >
                      Previous
                    </button>
                    <span className="px-2 font-medium text-stone-900">
                      {detailPage} / {totalDetailPages}
                    </span>
                    <button
                      type="button"
                      disabled={detailPage >= totalDetailPages}
                      onClick={() => setDetailPage((p) => Math.min(totalDetailPages, p + 1))}
                      className="px-3 py-1 border border-[#e7e5e4] rounded-lg bg-white text-stone-800 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs font-medium"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )
          ) : detailActiveTab === "sales_logs" ? (
            liveSalesLogs.length === 0 ? (
              <div className="bg-white border border-[#e7e5e4] rounded-xl shadow-2xs p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-stone-100/80 border border-stone-200 flex items-center justify-center text-stone-400 mb-4">
                  <svg className="w-8 h-8 stroke-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="font-bold text-stone-900 text-base">
                  No POS deductions yet
                </h3>
                <p className="text-xs text-stone-500 max-w-sm mt-1">
                  When menu items linked to this ingredient are sold at POS, recipe usage logs will appear here.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-[#e7e5e4] rounded-xl shadow-2xs overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#e7e5e4] bg-[#fafaf9] text-[11px] uppercase tracking-wider text-[#78716c] font-semibold sticky top-0 z-10 select-none">
                        <th className="py-3 px-5">Quantity deducted</th>
                        <th className="py-3 px-5">Source</th>
                        <th className="py-3 px-5">Date & Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f5f5f4]">
                      {paginatedSalesLogs.map((log) => (
                        <tr key={log._id} className="hover:bg-stone-50/80 transition-colors">
                          <td className="py-3.5 px-5 font-semibold text-rose-600">
                            - {log.quantity} {formatUnitDisplay(log.unit)}
                          </td>
                          <td className="py-3.5 px-5 text-stone-700 font-medium">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-medium bg-stone-100 text-stone-700 border border-stone-200">
                              POS Order Sale
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-stone-900 font-medium whitespace-nowrap">
                            {formatStoreDate(log.date, activeOrg?.country, activeOrg?.organizationTimeZone) || "—"}
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
                      {liveSalesLogs.length === 0
                        ? 0
                        : `${(detailPage - 1) * detailLogsPerPage + 1} - ${Math.min(
                            detailPage * detailLogsPerPage,
                            liveSalesLogs.length
                          )}`}
                    </strong>{" "}
                    of <strong className="text-stone-900">{liveSalesLogs.length}</strong> deductions
                  </span>
                  <div className="flex items-center space-x-2 text-xs">
                    <button
                      type="button"
                      disabled={detailPage <= 1}
                      onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1 border border-[#e7e5e4] rounded-lg bg-white text-stone-800 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs font-medium"
                    >
                      Previous
                    </button>
                    <span className="px-2 font-medium text-stone-900">
                      {detailPage} / {totalSalesPages}
                    </span>
                    <button
                      type="button"
                      disabled={detailPage >= totalSalesPages}
                      onClick={() => setDetailPage((p) => Math.min(totalSalesPages, p + 1))}
                      className="px-3 py-1 border border-[#e7e5e4] rounded-lg bg-white text-stone-800 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs font-medium"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )
          ) : itemDeadLogs.length === 0 ? (
            /* Dead Stock Logs Empty State */
            <div className="bg-white border border-[#e7e5e4] rounded-xl shadow-2xs p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-stone-100/80 border border-stone-200 flex items-center justify-center text-stone-400 mb-4">
                <svg className="w-8 h-8 stroke-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 10l4 4m0-4l-4 4" />
                </svg>
              </div>
              <h3 className="font-bold text-stone-900 text-base">
                No dead stock logs yet
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mt-1">
                Keep an eye on your non-moving inventory. Update dead stock to see logs in this section.
              </p>
            </div>
          ) : (
            /* Dead Stock Logs Table */
            <div className="bg-white border border-[#e7e5e4] rounded-xl shadow-2xs overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#e7e5e4] bg-[#fafaf9] text-[11px] uppercase tracking-wider text-[#78716c] font-semibold sticky top-0 z-10 select-none">
                      <th className="py-3 px-5">Wasted quantity</th>
                      <th className="py-3 px-5">Reason</th>
                      <th className="py-3 px-5">Marked date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f5f5f4]">
                    {paginatedDeadLogs.map((log) => (
                      <tr key={log._id} className="hover:bg-stone-50/80 transition-colors">
                        <td className="py-3.5 px-5 font-semibold text-rose-600">
                          {log.quantity} {formatUnitDisplay(log.unit)}
                        </td>
                        <td className="py-3.5 px-5 text-stone-700 font-medium">
                          {log.reason}
                        </td>
                        <td className="py-3.5 px-5 text-stone-900 font-medium whitespace-nowrap">
                          {formatStoreDate(log.markedDate, activeOrg?.country, activeOrg?.organizationTimeZone) || "—"}
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
                    {itemDeadLogs.length === 0
                      ? 0
                      : `${(detailPage - 1) * detailLogsPerPage + 1} - ${Math.min(
                          detailPage * detailLogsPerPage,
                          itemDeadLogs.length
                        )}`}
                  </strong>{" "}
                  of <strong className="text-stone-900">{itemDeadLogs.length}</strong> logs
                </span>
                <div className="flex items-center space-x-2 text-xs">
                  <button
                    type="button"
                    disabled={detailPage <= 1}
                    onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 border border-[#e7e5e4] rounded-lg bg-white text-stone-800 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs font-medium"
                  >
                    Previous
                  </button>
                  <span className="px-2 font-medium text-stone-900">
                    {detailPage} / {totalDeadPages}
                  </span>
                  <button
                    type="button"
                    disabled={detailPage >= totalDeadPages}
                    onClick={() => setDetailPage((p) => Math.min(totalDeadPages, p + 1))}
                    className="px-3 py-1 border border-[#e7e5e4] rounded-lg bg-white text-stone-800 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs font-medium"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog Modal */}
        {isDeleteModalOpen && itemToDelete && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-stone-200 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-xl text-stone-900 font-bold">
                Delete {itemToDelete.name}
              </h3>
              <div className="space-y-2 text-xs text-stone-600">
                <p>Are you sure you want to delete this item from the inventory?</p>
                <p className="text-rose-600 font-medium bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  Warning: By deleting this item, all the items linked to this particular item will become unavailable everywhere.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-700 hover:text-stone-900 border border-stone-200 rounded-lg hover:bg-stone-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition cursor-pointer shadow-xs"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Drawer Overlay Backdrop */}
        {isDrawerOpen && (
          <div
            className="fixed inset-0 bg-stone-900/30 backdrop-blur-[2px] z-40 transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />
        )}

        {/* SLIDE-OVER DRAWERS: Edit Item / Add Item Stock */}
        <aside
          className={`fixed top-0 right-0 h-full w-full max-w-md md:max-w-lg bg-white border-l border-stone-200 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${
            isDrawerOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {drawerMode === "assign_stock" && editingItem ? (
            renderAddStockDrawer()
          ) : (
            /* EDIT ITEM DRAWER MODE (Screenshot 3) */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-6 border-b border-stone-200 flex items-start justify-between bg-white shrink-0">
                <h2 className="text-xl text-stone-900 font-semibold tracking-tight">
                  Edit item
                </h2>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="text-stone-500 hover:text-stone-900 p-1 rounded-md transition cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form
                id="editItemForm"
                onSubmit={handleFormSubmit}
                className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-stone-800"
              >
                <div>
                  <label className="block font-medium mb-1 text-stone-800">
                    Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 text-stone-800">Description</label>
                  <textarea
                    rows={3}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition placeholder:text-stone-400"
                    placeholder="Enter item description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 text-stone-800">
                    Select Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {DEFAULT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1 text-stone-800">SKU number</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition placeholder:text-stone-400"
                    placeholder="Enter item sku number"
                    value={skuNumber}
                    onChange={(e) => setSkuNumber(e.target.value)}
                  />
                </div>

                {/* Unit Details Header */}
                <div className="pt-2">
                  <h3 className="text-base font-semibold text-stone-900 mb-3">Unit details</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={drawerMode === "edit" ? "opacity-50 select-none" : ""}>
                      <label className="block font-medium mb-1 text-stone-800">
                        Buying unit <span className="text-rose-500">*</span>
                      </label>
                      <select
                        disabled={drawerMode === "edit"}
                        className={`w-full px-3 py-2 text-xs border rounded-md transition ${
                          drawerMode === "edit"
                            ? "bg-stone-200 text-stone-500 cursor-not-allowed border-stone-300 opacity-60"
                            : "bg-white border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
                        }`}
                        value={buyingUnit}
                        onChange={(e) => {
                          if (drawerMode !== "edit") {
                            handleBuyingUnitChange(e.target.value);
                          }
                        }}
                      >
                        {BUYING_UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium mb-1 text-stone-800">
                        Serving unit <span className="text-rose-500">*</span>
                      </label>
                      <select
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition"
                        value={servingUnit}
                        onChange={(e) => setServingUnit(e.target.value)}
                      >
                        {relatableUnits.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Stock Details Header */}
                <div className="pt-2">
                  <h3 className="text-base font-semibold text-stone-900 mb-3">Stock details</h3>

                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="col-span-2">
                      <label className="block font-medium mb-1 text-stone-800">
                        Minimum stock refill level <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition"
                        value={minimumStockRefillLevel}
                        onChange={(e) => setMinimumStockRefillLevel(Number(e.target.value))}
                      />
                    </div>
                    <div className="opacity-50 select-none">
                      <label className="block font-medium mb-1 text-stone-800">Unit *</label>
                      <input
                        type="text"
                        disabled
                        className="w-full px-3 py-2 bg-stone-200 text-stone-500 border border-stone-300 rounded-md capitalize font-medium cursor-not-allowed opacity-60"
                        value={buyingUnit}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block font-medium mb-1 text-stone-800">
                        Baseline stock level <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition"
                        value={baselineStockLevel}
                        onChange={(e) => setBaselineStockLevel(Number(e.target.value))}
                      />
                    </div>
                    <div className="opacity-50 select-none">
                      <label className="block font-medium mb-1 text-stone-800">Unit *</label>
                      <input
                        type="text"
                        disabled
                        className="w-full px-3 py-2 bg-stone-200 text-stone-500 border border-stone-300 rounded-md capitalize font-medium cursor-not-allowed opacity-60"
                        value={buyingUnit}
                      />
                    </div>
                  </div>

                  {/* Negative Stock Toggle */}
                  <div className="pt-3 border-t border-stone-100 mt-3">
                    <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200">
                      <div>
                        <span className="block font-semibold text-stone-900 text-xs">
                          Allow Negative Stock
                        </span>
                        <span className="text-[11px] text-stone-500">
                          Orders can deduct inventory past 0 during rush hours without halting sales.
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                        <input
                          type="checkbox"
                          checked={allowNegativeStock}
                          onChange={(e) => setAllowNegativeStock(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </form>

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
                  form="editItemForm"
                  disabled={isSubmitting}
                  className="w-1/2 py-2.5 rounded-lg bg-[#1c1917] hover:bg-[#292524] text-white !text-white text-xs font-semibold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  Update
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    );
}

  // RENDER ITEM LIBRARY MAIN TABLE PAGE
  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#fbf9f8] p-8">
      {/* Page Title & Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#e7e5e4]/70">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            Item library
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Manage raw ingredient catalog, buying units, serving units, and refill alert levels.
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
              placeholder="Search by item name, SKU no"
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
            <span>Add new item</span>
          </button>
        </div>
      </div>

      {/* Main Table / Empty State Container */}
      <div className="mt-6 flex-1 flex flex-col">
        {filteredAndSortedItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#e7e5e4] rounded-2xl p-12 bg-white/50 text-center my-2">
            <div className="w-14 h-14 rounded-full bg-[#f5f5f4] border border-[#e7e5e4] flex items-center justify-center text-stone-500 mb-4">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-stone-900">Empty item shelf</h3>
            <p className="text-xs md:text-sm text-stone-500 max-w-sm mt-1 mb-6">
              No items have been added yet. Start building your inventory list.
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
              <span>Add new item</span>
            </button>
          </div>
        ) : (
          <div className="bg-white border border-[#e7e5e4] rounded-xl shadow-2xs overflow-hidden flex flex-col flex-1">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#e7e5e4] bg-[#fafaf9] text-[11px] uppercase tracking-wider text-[#78716c] font-semibold sticky top-0 z-20 select-none">
                    <th
                      className="py-3 px-5 cursor-pointer hover:text-stone-900"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>Item name</span>
                        {sortField === "name" ? (
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
                      className="py-3 px-5 cursor-pointer hover:text-stone-900"
                      onClick={() => handleSort("category")}
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>Category</span>
                        {sortField === "category" ? (
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
                      onClick={() => handleSort("sku")}
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>SKU no.</span>
                        {sortField === "sku" ? (
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
                      className="py-3 px-5 cursor-pointer hover:text-stone-900 select-none w-72"
                      onClick={() => handleSort("availableStock")}
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>Available stock</span>
                        {sortField === "availableStock" ? (
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
                      onClick={() => handleSort("createdAt")}
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>Created/update time</span>
                        {sortField === "createdAt" ? (
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
                  {paginatedItems.map((item) => {
                    const available = item.availableStock || 0;
                    const minRefill = item.minimumStockRefillLevel || 0;
                    const baseline =
                      item.baselineStockLevel || Math.max(minRefill * 2, 50);
                    const shortUnit = getShortUnit(item.buyingUnit || "kg");

                    const maxScale =
                      Math.max(available, minRefill, baseline) * 1.2 || 100;
                    const availPct = Math.min(
                      100,
                      Math.max(2, (available / maxScale) * 100)
                    );
                    const minPct = Math.min(100, (minRefill / maxScale) * 100);
                    const basePct = Math.min(100, (baseline / maxScale) * 100);

                    const barColor =
                      available < 0
                        ? "#9333ea"
                        : available > baseline
                        ? "#219653"
                        : available > minRefill
                        ? "#FFB400"
                        : "#EB5757";

                    const formattedDate = formatStoreDateTime(
                      item.updatedAt || item.createdAt || Date.now(),
                      activeOrg?.country,
                      activeOrg?.organizationTimeZone
                    );

                    return (
                      <tr
                        key={item._id}
                        className="hover:bg-[#fafaf9] transition-colors group"
                      >
                        <td className="py-3.5 px-5">
                          <div
                            className="cursor-pointer"
                            onClick={() => setSelectedItemDetail(item)}
                          >
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-stone-900 hover:underline">
                                {item.name}
                              </span>
                              {available < 0 ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                  DEFICIT
                                </span>
                              ) : (item.isLowStock || available <= minRefill) ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                  LOW
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  OK
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-stone-500 mt-0.5">
                              {item.description || "Raw ingredient"}
                            </p>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-stone-700 font-medium">
                          Dairy items
                        </td>
                        <td className="py-3.5 px-5 font-mono text-[11px] text-stone-600">
                          {item.skuNumber || "—"}
                        </td>
                        <td className="py-3.5 px-5">
                          {/* Visual Stock Bar Slider Component */}
                          <div className="space-y-1.5">
                            <div className={`text-center text-[11px] font-semibold ${available < 0 ? "text-purple-700 font-bold" : "text-stone-900"}`}>
                              {shortUnit === "pc"
                                ? available.toFixed(2)
                                : Math.round(available * 100) / 100 !== available
                                ? available.toFixed(3)
                                : available.toFixed(2)}
                              {shortUnit}
                            </div>
                            <div className="relative w-full h-2.5 bg-stone-100 border border-stone-200 rounded-full overflow-hidden">
                              {/* Filled Available Stock Bar */}
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${availPct}%`,
                                  backgroundColor: barColor,
                                }}
                                title={`Available stock: ${available.toFixed(2)}${shortUnit}`}
                              />
                              {/* Min Refill Level Marker */}
                              <div
                                className="absolute top-0 bottom-0 w-0.5 bg-rose-500"
                                style={{ left: `${minPct}%` }}
                                title={`Minimum Stock Refill level: ${minRefill}${shortUnit}`}
                              />
                              {/* Baseline Stock Level Marker */}
                              <div
                                className="absolute top-0 bottom-0 w-0.5 bg-sky-500"
                                style={{ left: `${basePct}%` }}
                                title={`Baseline stock level: ${baseline}${shortUnit}`}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-stone-900 font-medium whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="py-3.5 px-5 text-right relative">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveMenuId(activeMenuId === item._id ? null : item._id)
                            }
                            className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </button>
                          {activeMenuId === item._id && (
                            <div className="absolute right-5 top-11 w-44 bg-white border border-[#e7e5e4] rounded-lg shadow-lg py-1 z-30 text-left font-sans text-xs">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedItemDetail(item);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 cursor-pointer"
                              >
                                View item logs
                              </button>
                              <button
                                type="button"
                                onClick={() => openAssignStockDrawer(item)}
                                className="w-full text-left px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 cursor-pointer"
                              >
                                Add item stock
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditDrawer(item)}
                                className="w-full text-left px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 cursor-pointer"
                              >
                                Edit item
                              </button>
                              <button
                                type="button"
                                onClick={() => openDeleteModal(item)}
                                className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 cursor-pointer"
                              >
                                Delete item
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="py-3.5 px-5 border-t border-[#e7e5e4] bg-[#fafaf9]/60 flex items-center justify-between text-xs text-[#78716c] shrink-0">
              <span>
                Showing{" "}
                <strong className="text-stone-900">
                  {filteredAndSortedItems.length === 0
                    ? 0
                    : `${(currentPage - 1) * itemsPerPage + 1} - ${Math.min(
                        currentPage * itemsPerPage,
                        filteredAndSortedItems.length
                      )}`}
                </strong>{" "}
                of <strong className="text-stone-900">{filteredAndSortedItems.length}</strong> items
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

      {/* Delete Confirmation Dialog Modal */}
      {isDeleteModalOpen && itemToDelete && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-xl text-stone-900 font-bold">
              Delete {itemToDelete.name}
            </h3>
            <div className="space-y-2 text-xs text-stone-600">
              <p>Are you sure you want to delete this item from the inventory?</p>
              <p className="text-rose-600 font-medium bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                Warning: By deleting this item, all the items linked to this particular item will become unavailable everywhere.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-stone-700 hover:text-stone-900 border border-stone-200 rounded-lg hover:bg-stone-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition cursor-pointer shadow-xs"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer Overlay Backdrop */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-[#0c0a09]/30 backdrop-blur-[2px] z-40 transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Slide-over Drawer for Add / Edit Item or Add Stock */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md md:max-w-lg bg-white border-l border-[#e7e5e4] shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {drawerMode === "assign_stock" && editingItem ? (
          renderAddStockDrawer()
        ) : (
          /* ADD / EDIT ITEM DRAWER MODE */
          <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-[#e7e5e4] flex items-start justify-between bg-white shrink-0">
            <div>
              <h2 className="text-xl font-bold text-[#0c0a09] tracking-tight">
                {drawerMode === "edit" ? "Edit item" : "Add new item"}
              </h2>
              <p className="text-xs text-[#78716c] mt-0.5">
                Configure ingredient specs, buying & serving units, and refill alert thresholds.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="text-[#78716c] hover:text-[#0c0a09] p-1.5 rounded-full hover:bg-[#f5f5f4] transition cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form
            id="itemFormMain"
            onSubmit={handleFormSubmit}
            className="flex-1 overflow-y-auto p-6 space-y-6 text-xs"
          >
            {/* Group 1: Item Details */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-[#f5f5f4]">
                <h4 className="font-mono text-[11px] font-semibold tracking-wider uppercase text-[#78716c]">
                  Item Details
                </h4>
                <span className="text-[10px] text-[#a8a29e]">* Required fields</span>
              </div>

              <div>
                <label className="block font-medium text-[#1c1917] mb-1">
                  Item name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  className={`w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border ${
                    nameError
                      ? "border-rose-500 focus:ring-rose-500 focus:border-rose-500"
                      : "border-[#e7e5e4] focus:ring-[#0c0a09] focus:border-[#0c0a09]"
                  } rounded-lg focus:outline-none focus:ring-1 focus:bg-white placeholder:text-[#a8a29e] transition`}
                  placeholder="Enter item name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError("");
                  }}
                />
                {nameError && (
                  <p className="text-[11px] text-rose-500 mt-1">{nameError}</p>
                )}
              </div>

              <div>
                <label className="block font-medium text-[#1c1917] mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] placeholder:text-[#a8a29e] transition resize-y"
                  placeholder="Enter item description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-medium text-[#1c1917] mb-1">
                  Select category <span className="text-rose-500">*</span>
                </label>
                <select
                  className={`w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border ${
                    categoryError
                      ? "border-rose-500 focus:ring-rose-500 focus:border-rose-500"
                      : "border-[#e7e5e4] focus:ring-[#0c0a09] focus:border-[#0c0a09]"
                  } rounded-lg focus:outline-none focus:ring-1 transition`}
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    if (categoryError) setCategoryError("");
                  }}
                >
                  <option value="">Search category</option>
                  {DEFAULT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                {categoryError && (
                  <p className="text-[11px] text-rose-500 mt-1">{categoryError}</p>
                )}
              </div>

              <div>
                <label className="block font-medium text-[#1c1917] mb-1">SKU no</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] placeholder:text-[#a8a29e] transition font-mono"
                  placeholder="Enter SKU number"
                  value={skuNumber}
                  onChange={(e) => setSkuNumber(e.target.value)}
                />
              </div>
            </div>

            {/* Group 2: Unit Specs */}
            <div className="space-y-4 pt-2">
              <div className="pb-1 border-b border-[#f5f5f4]">
                <h4 className="font-mono text-[11px] font-semibold tracking-wider uppercase text-[#78716c]">
                  Unit Specs
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className={drawerMode === "edit" ? "opacity-50 select-none" : ""}>
                  <label className="block font-medium text-[#1c1917] mb-1">
                    Buying unit <span className="text-rose-500">*</span>
                  </label>
                  <select
                    disabled={drawerMode === "edit"}
                    className={`w-full px-3 py-2 text-xs border ${
                      drawerMode === "edit"
                        ? "bg-[#e7e5e4] text-[#78716c] cursor-not-allowed border-[#d6d3d1] opacity-60"
                        : buyingUnitError
                        ? "bg-[#fbf9f8] hover:bg-white border-rose-500 focus:ring-rose-500 focus:border-rose-500"
                        : "bg-[#fbf9f8] hover:bg-white border-[#e7e5e4] focus:ring-[#0c0a09] focus:border-[#0c0a09]"
                    } rounded-lg focus:outline-none focus:ring-1 transition`}
                    value={buyingUnit}
                    onChange={(e) => {
                      if (drawerMode !== "edit") {
                        handleBuyingUnitChange(e.target.value);
                        if (buyingUnitError) setBuyingUnitError("");
                      }
                    }}
                  >
                    <option value="">Select buying unit</option>
                    {BUYING_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                  {buyingUnitError && (
                    <p className="text-[11px] text-rose-500 mt-1">{buyingUnitError}</p>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-[#1c1917] mb-1">
                    Serving unit <span className="text-rose-500">*</span>
                  </label>
                  <select
                    className={`w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border ${
                      servingUnitError
                        ? "border-rose-500 focus:ring-rose-500 focus:border-rose-500"
                        : "border-[#e7e5e4] focus:ring-[#0c0a09] focus:border-[#0c0a09]"
                    } rounded-lg focus:outline-none focus:ring-1 transition`}
                    value={servingUnit}
                    onChange={(e) => {
                      setServingUnit(e.target.value);
                      if (servingUnitError) setServingUnitError("");
                    }}
                  >
                    <option value="">Select serving unit</option>
                    {relatableUnits.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                  {servingUnitError && (
                    <p className="text-[11px] text-rose-500 mt-1">{servingUnitError}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Group 3: Stock Details */}
            <div className="space-y-4 pt-2">
              <div className="pb-1 border-b border-[#f5f5f4]">
                <h4 className="font-mono text-[11px] font-semibold tracking-wider uppercase text-[#78716c]">
                  Stock details
                </h4>
              </div>

              <div className="grid grid-cols-3 gap-3 items-end">
                <div className="col-span-2">
                  <label className="block font-medium text-[#1c1917] mb-1">
                    Minimum stock refill level <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    className={`w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border ${
                      minRefillError
                        ? "border-rose-500 focus:ring-rose-500 focus:border-rose-500"
                        : "border-[#e7e5e4] focus:ring-[#0c0a09] focus:border-[#0c0a09]"
                    } rounded-lg focus:outline-none focus:ring-1 font-mono`}
                    placeholder="Enter stock refill level"
                    value={minimumStockRefillLevel}
                    onChange={(e) => {
                      setMinimumStockRefillLevel(e.target.value === "" ? ("" as any) : Number(e.target.value));
                      if (minRefillError) setMinRefillError("");
                    }}
                  />
                  {minRefillError && (
                    <p className="text-[11px] text-rose-500 mt-1">{minRefillError}</p>
                  )}
                </div>
                <div className="opacity-50 select-none">
                  <label className="block font-medium text-[#78716c] mb-1">Unit</label>
                  <input
                    type="text"
                    disabled
                    className="w-full px-3 py-2 bg-[#e7e5e4] text-xs border border-[#d6d3d1] rounded-lg text-[#78716c] font-mono capitalize cursor-not-allowed opacity-60"
                    value={buyingUnit}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-end">
                <div className="col-span-2">
                  <label className="block font-medium text-[#1c1917] mb-1">
                    Baseline stock level <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    className={`w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border ${
                      baselineError
                        ? "border-rose-500 focus:ring-rose-500 focus:border-rose-500"
                        : "border-[#e7e5e4] focus:ring-[#0c0a09] focus:border-[#0c0a09]"
                    } rounded-lg focus:outline-none focus:ring-1 font-mono`}
                    placeholder="Enter baseline stock level"
                    value={baselineStockLevel}
                    onChange={(e) => {
                      setBaselineStockLevel(e.target.value === "" ? ("" as any) : Number(e.target.value));
                      if (baselineError) setBaselineError("");
                    }}
                  />
                  {baselineError && (
                    <p className="text-[11px] text-rose-500 mt-1">{baselineError}</p>
                  )}
                </div>
                <div className="opacity-50 select-none">
                  <label className="block font-medium text-[#78716c] mb-1">Unit</label>
                  <input
                    type="text"
                    disabled
                    className="w-full px-3 py-2 bg-[#e7e5e4] text-xs border border-[#d6d3d1] rounded-lg text-[#78716c] font-mono capitalize cursor-not-allowed opacity-60"
                    value={buyingUnit}
                  />
                </div>
              </div>

              {/* Allow Negative Stock Toggle */}
              <div className="pt-2">
                <div className="flex items-center justify-between p-3.5 bg-[#fbf9f8] rounded-xl border border-[#e7e5e4]">
                  <div>
                    <span className="block font-medium text-[#1c1917] text-xs">
                      Allow Negative Stock
                    </span>
                    <span className="text-[11px] text-[#78716c]">
                      Permit orders to deduct stock past 0 without blocking checkout (auto-reconciles on PO restock).
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                    <input
                      type="checkbox"
                      checked={allowNegativeStock}
                      onChange={(e) => setAllowNegativeStock(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#d6d3d1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#d6d3d1] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0c0a09]"></div>
                  </label>
                </div>
              </div>
            </div>
          </form>

          <div className="p-4 px-6 border-t border-[#e7e5e4] bg-[#fafaf9] flex items-center justify-end space-x-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#e7e5e4] text-[#57534e] hover:text-[#0c0a09] hover:bg-white text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="itemFormMain"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white !text-white text-xs font-semibold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              <span>
                {isSubmitting ? "Saving..." : drawerMode === "edit" ? "Update" : "Create"}
              </span>
            </button>
          </div>
        </div>
      )}
    </aside>
    </div>
  );
}
