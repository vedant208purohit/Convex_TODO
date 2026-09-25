"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

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

export function ItemLibraryView({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const rawItems = useQuery(api.inventory.listInventoryItems, { organizationId });
  const items = useMemo(() => rawItems ?? [], [rawItems]);

  const suppliers = useQuery(api.inventory.listSuppliers, { organizationId });
  const purchaseOrders = [
    { _id: "po_1", poNumber: "PO-2026-001", supplierName: "Self Employee" },
    { _id: "po_2", poNumber: "PO-2026-002", supplierName: "Fresh Wholesale" },
  ];

  const createItemMutation = useMutation(api.inventory.createInventoryItem);
  const updateItemMutation = useMutation(api.inventory.updateInventoryItem);

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selected item for full detail page view (e.g. TEA PREMIX)
  const [selectedItemDetail, setSelectedItemDetail] = useState<any | null>(null);
  const [detailActiveTab, setDetailActiveTab] = useState<"added_logs" | "dead_logs">(
    "added_logs"
  );

  // Column Sorting state
  const [sortField, setSortField] = useState<"name" | "category" | null>(null);
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

  // Add Item Stock Drawer Form State
  const [addStockQuantity, setAddStockQuantity] = useState<number | "">("");
  const [addStockSupplierId, setAddStockSupplierId] = useState<string>("");
  const [addStockPoNumber, setAddStockPoNumber] = useState<string>("");
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
  const handleSort = (field: "name" | "category") => {
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
        let valA = "";
        let valB = "";
        if (sortField === "name") {
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
        } else if (sortField === "category") {
          valA = "dairy items";
          valB = "dairy items";
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
    setCategory("Dairy items");
    setDescription("");
    setSkuNumber("");
    setBuyingUnit("piece");
    setServingUnit("piece");
    setMinimumStockRefillLevel(1);
    setBaselineStockLevel(1);
    setInitialStock(0);
    setUnitCost(0);
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (item: any) => {
    setEditingItem(item);
    setDrawerMode("edit");
    setName(item.name || "");
    setCategory("Dairy items");
    setDescription(item.description || "");
    setSkuNumber(item.skuNumber || "");
    setBuyingUnit(item.buyingUnit || "piece");
    setServingUnit(item.servingUnit || "piece");
    setMinimumStockRefillLevel(item.minimumStockRefillLevel || 1);
    setBaselineStockLevel(item.baselineStockLevel || 1);
    setInitialStock(item.availableStock || 0);
    setUnitCost(item.unitCost || 0);
    setActiveMenuId(null);
    setIsDrawerOpen(true);
  };

  const openAssignStockDrawer = (item: any) => {
    setEditingItem(item);
    setDrawerMode("assign_stock");
    setAddStockQuantity("");
    setAddStockSupplierId("");
    setAddStockPoNumber("");
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
      const qty = Number(addStockQuantity);
      if (!qty || qty <= 0) {
        alert("Please enter a valid stock quantity.");
        return;
      }
      setIsSubmitting(true);
      try {
        if (editingItem) {
          await updateItemMutation({
            id: editingItem._id,
            unitCost: Number(unitCost),
            minimumStockRefillLevel: Number(
              editingItem.minimumStockRefillLevel || 1
            ),
          });

          // Add to local stock logs
          const supplierObj = suppliers?.find((s) => s._id === addStockSupplierId);
          const newLog = {
            _id: `log_${Date.now()}`,
            quantity: qty,
            unit: editingItem.buyingUnit || "piece (pc)",
            supplierName: supplierObj?.supplierName || undefined,
            poNumber: addStockPoNumber || undefined,
            dateReceived: addStockDateReceived,
            itemExpiry: addStockItemExpiry,
          };

          setStockLogsMap((prev) => ({
            ...prev,
            [editingItem._id]: [newLog, ...(prev[editingItem._id] || [])],
          }));
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

    if (!name.trim()) {
      alert("Item name is required.");
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

  const confirmDelete = () => {
    if (selectedItemDetail && itemToDelete && selectedItemDetail._id === itemToDelete._id) {
      setSelectedItemDetail(null);
    }
    setIsDeleteModalOpen(false);
    setItemToDelete(null);
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
    const itemLogs = stockLogsMap[selectedItemDetail._id] || [];
    const itemDeadLogs = deadStockLogsMap[selectedItemDetail._id] || [];

    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white p-8">
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
        <div className="flex items-center justify-between pb-4">
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-stone-900 tracking-tight">
            {selectedItemDetail.name}
          </h1>

          <div className="flex items-center space-x-3">
            {/* Edit Pencil Button */}
            <button
              type="button"
              onClick={() => openEditDrawer(selectedItemDetail)}
              className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition cursor-pointer"
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
                className="bg-[#1c1917] hover:bg-[#292524] text-white !text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-xs cursor-pointer"
              >
                Add item stock
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-8 border-b border-stone-200 text-xs font-medium">
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
        <div className="flex-1 flex flex-col justify-center items-center py-12">
          {detailActiveTab === "added_logs" ? (
            itemLogs.length === 0 ? (
              /* Added Stock Logs Empty State (Screenshot 1) */
              <div className="flex flex-col items-center justify-center text-center">
                {/* Box icon with x */}
                <div className="w-16 h-16 rounded-2xl bg-stone-100/80 border border-stone-200 flex items-center justify-center text-stone-400 mb-4">
                  <svg className="w-8 h-8 stroke-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 10l4 4m0-4l-4 4" />
                  </svg>
                </div>
                <h3 className="font-semibold text-stone-800 text-sm">
                  No stock logs available for this item
                </h3>
                <p className="text-xs text-stone-500 max-w-sm mt-1 mb-5">
                  Update your item stocks, and the logs will automatically appear here.
                </p>
                <button
                  type="button"
                  onClick={() => openAssignStockDrawer(selectedItemDetail)}
                  className="bg-[#1c1917] hover:bg-[#292524] text-white !text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow-xs cursor-pointer"
                >
                  Add item stock
                </button>
              </div>
            ) : (
              /* Added Stock Logs Table */
              <div className="w-full h-full flex flex-col">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50 uppercase tracking-wider text-stone-500 font-medium select-none">
                      <th className="py-3 px-4 font-normal">Quantity Added</th>
                      <th className="py-3 px-4 font-normal">Supplier</th>
                      <th className="py-3 px-4 font-normal">PO Number</th>
                      <th className="py-3 px-4 font-normal">Date Received</th>
                      <th className="py-3 px-4 font-normal">Expiry Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {itemLogs.map((log) => (
                      <tr key={log._id} className="hover:bg-stone-50">
                        <td className="py-3.5 px-4 font-medium text-stone-900">
                          {log.quantity} {log.unit}
                        </td>
                        <td className="py-3.5 px-4 text-stone-600">
                          {log.supplierName || "—"}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-stone-600">
                          {log.poNumber || "—"}
                        </td>
                        <td className="py-3.5 px-4 text-stone-600 font-mono">
                          {log.dateReceived}
                        </td>
                        <td className="py-3.5 px-4 text-stone-600 font-mono">
                          {log.itemExpiry || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : itemDeadLogs.length === 0 ? (
            /* Dead Stock Logs Empty State (Screenshot 2) */
            <div className="flex flex-col items-center justify-center text-center">
              {/* Box icon with x */}
              <div className="w-16 h-16 rounded-2xl bg-stone-100/80 border border-stone-200 flex items-center justify-center text-stone-400 mb-4">
                <svg className="w-8 h-8 stroke-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 10l4 4m0-4l-4 4" />
                </svg>
              </div>
              <h3 className="font-semibold text-stone-800 text-sm">
                No dead stock logs yet
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mt-1">
                Keep an eye on your non-moving inventory. Update dead stock to see logs in this section.
              </p>
            </div>
          ) : (
            /* Dead Stock Logs Table */
            <div className="w-full h-full flex flex-col">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 uppercase tracking-wider text-stone-500 font-medium select-none">
                    <th className="py-3 px-4 font-normal">Wasted Quantity</th>
                    <th className="py-3 px-4 font-normal">Reason</th>
                    <th className="py-3 px-4 font-normal">Marked Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {itemDeadLogs.map((log) => (
                    <tr key={log._id} className="hover:bg-stone-50">
                      <td className="py-3.5 px-4 font-medium text-rose-600">
                        {log.quantity} {log.unit}
                      </td>
                      <td className="py-3.5 px-4 text-stone-600 font-medium">
                        {log.reason}
                      </td>
                      <td className="py-3.5 px-4 text-stone-600 font-mono">
                        {log.markedDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog Modal */}
        {isDeleteModalOpen && itemToDelete && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-stone-200 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
              <h3 className="font-serif text-xl text-stone-900 font-medium">
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
                  className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 border border-stone-200 rounded-full hover:bg-stone-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-5 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-full transition cursor-pointer shadow-xs"
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
            /* ADD ITEM STOCK DRAWER MODE (Screenshot 4) */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-6 border-b border-stone-200 flex items-start justify-between bg-white shrink-0">
                <h2 className="text-xl text-stone-900 font-semibold tracking-tight">
                  Add item stock
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
                      min="0.01"
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
                    <input
                      type="text"
                      disabled
                      className="w-full px-3 py-2 bg-stone-100 text-stone-600 border border-stone-300 rounded-md capitalize font-medium"
                      value={`${editingItem.buyingUnit || "piece"} (pc)`}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-stone-500 leading-normal">
                  Note: To change the unit for this item, you have to change the Buying unit from Edit item screen
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
                    value={addStockPoNumber}
                    onChange={(e) => setAddStockPoNumber(e.target.value)}
                  >
                    <option value="">Select purchase order number</option>
                    {purchaseOrders?.map((po: any) => (
                      <option key={po._id} value={po.poNumber}>
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
                  Add stock
                </button>
              </div>
            </div>
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
                    <div>
                      <label className="block font-medium mb-1 text-stone-800">
                        Buying unit <span className="text-rose-500">*</span>
                      </label>
                      <select
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition"
                        value={buyingUnit}
                        onChange={(e) => handleBuyingUnitChange(e.target.value)}
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
                    <div>
                      <label className="block font-medium mb-1 text-stone-800">Unit *</label>
                      <input
                        type="text"
                        disabled
                        className="w-full px-3 py-2 bg-stone-100 text-stone-600 border border-stone-300 rounded-md capitalize font-medium"
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
                    <div>
                      <label className="block font-medium mb-1 text-stone-800">Unit *</label>
                      <input
                        type="text"
                        disabled
                        className="w-full px-3 py-2 bg-stone-100 text-stone-600 border border-stone-300 rounded-md capitalize font-medium"
                        value={buyingUnit}
                      />
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
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#fbf9f8] p-8">
      {/* Page Title & Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#e7e5e4]/70">
        <div>
          <h1 className="font-serif text-3xl md:text-[32px] text-[#0c0a09] font-medium tracking-tight">
            Item library
          </h1>
          <p className="text-xs md:text-sm text-[#78716c] mt-0.5">
            Manage raw ingredient catalog, buying units, serving units, and refill alert levels.
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
            <span className="text-white !text-white font-medium">Add new item</span>
          </button>
        </div>
      </div>

      {/* Main Table / Empty State Container */}
      <div className="mt-6 flex-1 flex flex-col overflow-hidden">
        {filteredAndSortedItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#e7e5e4] rounded-2xl p-12 bg-white/50 text-center my-2">
            <div className="w-14 h-14 rounded-full bg-[#f5f5f4] border border-[#e7e5e4] flex items-center justify-center text-[#78716c] mb-4">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <h3 className="font-serif text-2xl font-medium text-[#0c0a09]">Empty item Shelf</h3>
            <p className="text-xs md:text-sm text-[#78716c] max-w-sm mt-1 mb-6">
              No items have been added yet. Start building your inventory list.
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
              <span className="text-white !text-white font-medium">Add new item</span>
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
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Item name</span>
                        {sortField === "name" ? (
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
                    <th
                      className="py-3 px-5 font-normal cursor-pointer hover:text-[#0c0a09]"
                      onClick={() => handleSort("category")}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Category</span>
                        {sortField === "category" ? (
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
                    <th className="py-3 px-5 font-normal">SKU no.</th>
                    <th className="py-3 px-5 font-normal w-72">Available stock</th>
                    <th className="py-3 px-5 font-normal">Created/update time</th>
                    <th className="py-3 px-5 text-right font-normal">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7e5e4]/70 text-xs">
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
                      available > baseline
                        ? "#219653"
                        : available > minRefill
                        ? "#FFB400"
                        : "#EB5757";

                    const formattedDate = new Date(
                      item.updatedAt || item.createdAt || Date.now()
                    ).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    });

                    return (
                      <tr
                        key={item._id}
                        className="hover:bg-[#fafaf9] transition-colors group"
                      >
                        <td className="py-4 px-5">
                          <div
                            className="flex items-center space-x-3 cursor-pointer"
                            onClick={() => setSelectedItemDetail(item)}
                          >
                            <div className="w-7 h-7 rounded-full bg-[#f5f5f4] text-[#44403c] border border-[#e7e5e4] flex items-center justify-center font-serif font-medium text-xs shrink-0">
                              {item.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-[#0c0a09] hover:underline">
                                {item.name}
                              </p>
                              <p className="text-[11px] text-[#a8a29e]">
                                {item.description || "Raw ingredient"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-[#44403c] font-medium">
                          Dairy items
                        </td>
                        <td className="py-4 px-5 font-mono text-[11px] text-[#57534e]">
                          {item.skuNumber || "—"}
                        </td>
                        <td className="py-4 px-5">
                          {/* Visual Stock Bar Slider Component */}
                          <div className="space-y-1.5">
                            <div className="text-center text-[11px] font-semibold text-[#0c0a09]">
                              {available.toFixed(2)}
                              {shortUnit}
                            </div>
                            <div className="relative w-full h-3 bg-[#f5f5f4] border border-[#e7e5e4] rounded-full overflow-hidden">
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
                                className="absolute top-0 bottom-0 w-0.5 bg-rose-600 z-10"
                                style={{ left: `${minPct}%` }}
                                title={`Minimum Stock Refill level: ${minRefill}${shortUnit}`}
                              />
                              {/* Baseline Stock Level Marker */}
                              <div
                                className="absolute top-0 bottom-0 w-0.5 bg-sky-600 z-10"
                                style={{ left: `${basePct}%` }}
                                title={`Baseline stock level: ${baseline}${shortUnit}`}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-[#57534e] text-[11px]">
                          {formattedDate}
                        </td>
                        <td className="py-4 px-5 text-right relative">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveMenuId(activeMenuId === item._id ? null : item._id)
                            }
                            className="text-[#78716c] hover:text-[#0c0a09] p-1.5 rounded hover:bg-[#e7e5e4]/50 transition cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </button>
                          {activeMenuId === item._id && (
                            <div className="absolute right-5 top-12 w-44 bg-white border border-[#e7e5e4] rounded-lg shadow-lg py-1 z-30 text-left font-sans">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedItemDetail(item);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs text-[#0c0a09] hover:bg-[#fafaf9] cursor-pointer"
                              >
                                View item logs
                              </button>
                              <button
                                type="button"
                                onClick={() => openAssignStockDrawer(item)}
                                className="w-full text-left px-3 py-1.5 text-xs text-[#0c0a09] hover:bg-[#fafaf9] cursor-pointer"
                              >
                                Add item stock
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditDrawer(item)}
                                className="w-full text-left px-3 py-1.5 text-xs text-[#0c0a09] hover:bg-[#fafaf9] cursor-pointer"
                              >
                                Edit item
                              </button>
                              <button
                                type="button"
                                onClick={() => openDeleteModal(item)}
                                className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 cursor-pointer"
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
            <div className="py-3.5 px-5 border-t border-[#e7e5e4] bg-[#fafaf9]/50 flex items-center justify-between text-xs text-[#78716c] shrink-0">
              <span>
                Showing <strong className="text-[#0c0a09]">{paginatedItems.length}</strong>{" "}
                of <strong className="text-[#0c0a09]">{filteredAndSortedItems.length}</strong>{" "}
                items
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

      {/* Delete Confirmation Dialog Modal */}
      {isDeleteModalOpen && itemToDelete && (
        <div className="fixed inset-0 bg-[#0c0a09]/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e7e5e4] rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-serif text-xl text-[#0c0a09] font-medium">
              Delete {itemToDelete.name}
            </h3>
            <div className="space-y-2 text-xs text-[#57534e]">
              <p>Are you sure you want to delete this item from the inventory?</p>
              <p className="text-rose-600 font-medium bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                Warning: By deleting this item, all the items linked to this particular item will become unavailable everywhere.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-[#57534e] hover:text-[#0c0a09] border border-[#e7e5e4] rounded-full hover:bg-[#f5f5f4] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-5 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-full transition cursor-pointer shadow-xs"
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

      {/* Slide-over Drawer for Add / Edit Item */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md md:max-w-lg bg-white border-l border-[#e7e5e4] shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ADD / EDIT ITEM DRAWER MODE */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-[#e7e5e4] flex items-start justify-between bg-white shrink-0">
            <div>
              <h2 className="font-serif text-2xl text-[#0c0a09] font-medium tracking-tight">
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
                  required
                  className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] placeholder:text-[#a8a29e] transition"
                  placeholder="Enter item name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-medium text-[#1c1917] mb-1">
                  Select category <span className="text-rose-500">*</span>
                </label>
                <select
                  className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] transition"
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
                <div>
                  <label className="block font-medium text-[#1c1917] mb-1">
                    Buying unit <span className="text-rose-500">*</span>
                  </label>
                  <select
                    className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] transition"
                    value={buyingUnit}
                    onChange={(e) => handleBuyingUnitChange(e.target.value)}
                  >
                    {BUYING_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-[#1c1917] mb-1">
                    Serving unit <span className="text-rose-500">*</span>
                  </label>
                  <select
                    className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] transition"
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
                    required
                    className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] font-mono"
                    placeholder="Enter stock refill level"
                    value={minimumStockRefillLevel}
                    onChange={(e) => setMinimumStockRefillLevel(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#78716c] mb-1">Unit</label>
                  <input
                    type="text"
                    disabled
                    className="w-full px-3 py-2 bg-[#f5f5f4] text-xs border border-[#e7e5e4] rounded-lg text-[#78716c] font-mono capitalize"
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
                    required
                    className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] font-mono"
                    placeholder="Enter baseline stock level"
                    value={baselineStockLevel}
                    onChange={(e) => setBaselineStockLevel(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#78716c] mb-1">Unit</label>
                  <input
                    type="text"
                    disabled
                    className="w-full px-3 py-2 bg-[#f5f5f4] text-xs border border-[#e7e5e4] rounded-lg text-[#78716c] font-mono capitalize"
                    value={buyingUnit}
                  />
                </div>
              </div>

              {drawerMode !== "edit" && (
                <div>
                  <label className="block font-medium text-[#1c1917] mb-1">Initial stock</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] font-mono"
                    placeholder="Enter initial stock quantity"
                    value={initialStock}
                    onChange={(e) => setInitialStock(Number(e.target.value))}
                  />
                </div>
              )}

              <div>
                <label className="block font-medium text-[#1c1917] mb-1">Unit cost (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] font-mono"
                  placeholder="Enter unit cost"
                  value={unitCost}
                  onChange={(e) => setUnitCost(Number(e.target.value))}
                />
              </div>
            </div>
          </form>

          <div className="p-4 px-6 border-t border-[#e7e5e4] bg-[#fafaf9] flex items-center justify-end space-x-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="px-5 py-2.5 rounded-full border border-[#e7e5e4] text-[#57534e] hover:text-[#0c0a09] hover:bg-white text-xs font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="itemFormMain"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-full bg-[#0c0a09] hover:bg-[#292524] text-white !text-white text-xs font-medium transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <span className="text-white !text-white font-medium">
                {isSubmitting ? "Saving..." : drawerMode === "edit" ? "Update" : "Create"}
              </span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
