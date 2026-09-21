"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

export function ItemLibraryView({ organizationId }: { organizationId: Id<"organizations"> }) {
  const items = useQuery(api.inventory.listInventoryItems, { organizationId }) ?? [];
  const createItemMutation = useMutation(api.inventory.createInventoryItem);
  const updateItemMutation = useMutation(api.inventory.updateInventoryItem);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterLowStock, setFilterLowStock] = useState(false);

  // Drawer States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Form State matching backend args exactly
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [skuNumber, setSkuNumber] = useState("");
  const [buyingUnit, setBuyingUnit] = useState("kilogram");
  const [servingUnit, setServingUnit] = useState("gram");
  const [minimumStockRefillLevel, setMinimumStockRefillLevel] = useState<number>(10);
  const [baselineStockLevel, setBaselineStockLevel] = useState<number>(50);
  const [initialStock, setInitialStock] = useState<number>(0);
  const [unitCost, setUnitCost] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Computed Values
  const filteredItems = useMemo(() => {
    let list = items;
    if (filterLowStock) {
      list = list.filter((i) => i.isLowStock);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.skuNumber && i.skuNumber.toLowerCase().includes(q)) ||
          (i.description && i.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [items, filterLowStock, searchQuery]);

  const totalInventoryValue = useMemo(() => {
    return items.reduce((acc, i) => acc + (i.availableStock || 0) * (i.unitCost || 0), 0);
  }, [items]);

  const lowStockCount = useMemo(() => {
    return items.filter((i) => i.isLowStock).length;
  }, [items]);

  const openAddDrawer = () => {
    setEditingItem(null);
    setName("");
    setDescription("");
    setSkuNumber("");
    setBuyingUnit("kilogram");
    setServingUnit("gram");
    setMinimumStockRefillLevel(10);
    setBaselineStockLevel(50);
    setInitialStock(0);
    setUnitCost(0);
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (item: any) => {
    setEditingItem(item);
    setName(item.name || "");
    setDescription(item.description || "");
    setSkuNumber(item.skuNumber || "");
    setBuyingUnit(item.buyingUnit || "kilogram");
    setServingUnit(item.servingUnit || "gram");
    setMinimumStockRefillLevel(item.minimumStockRefillLevel || 0);
    setBaselineStockLevel(item.baselineStockLevel || 0);
    setInitialStock(item.availableStock || 0);
    setUnitCost(item.unitCost || 0);
    setIsDrawerOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingItem) {
        // Backend updateInventoryItem args: { id, name, description, minimumStockRefillLevel, unitCost }
        await updateItemMutation({
          id: editingItem._id,
          name: name.trim(),
          description: description.trim() || undefined,
          minimumStockRefillLevel: Number(minimumStockRefillLevel),
          unitCost: Number(unitCost),
        });
      } else {
        // Backend createInventoryItem args: { organizationId, name, description, skuNumber, buyingUnit, servingUnit, minimumStockRefillLevel, baselineStockLevel, initialStock, unitCost }
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

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#fbf9f8] p-8">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#e7e5e4]">
        <div>
          <h1 className="font-serif text-3xl font-medium text-[#0c0a09] tracking-tight">Item Library</h1>
          <p className="text-xs text-[#78716c] mt-0.5">
            Manage raw ingredient catalog, buying units, serving units, and refill alert thresholds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Low Stock Filter Button */}
          <button
            type="button"
            onClick={() => setFilterLowStock(!filterLowStock)}
            className={`px-3.5 py-2 rounded-full text-xs font-medium border transition cursor-pointer ${
              filterLowStock
                ? "bg-rose-50 text-rose-700 border-rose-300 shadow-2xs"
                : "bg-white text-stone-600 border-[#e7e5e4] hover:bg-stone-50"
            }`}
          >
            ⚠️ Low Stock ({lowStockCount})
          </button>

          {/* Search Input */}
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
              placeholder="Search by name, SKU or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={openAddDrawer}
            className="inline-flex items-center space-x-2 bg-[#0c0a09] hover:bg-[#292524] text-white text-xs font-medium px-4 py-2.5 rounded-full transition shadow-sm cursor-pointer whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Raw Ingredient</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mt-6 flex-1 flex flex-col overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#e7e5e4] rounded-2xl p-12 bg-white/50 text-center my-4">
            <div className="w-14 h-14 rounded-full bg-[#f5f5f4] border border-[#e7e5e4] flex items-center justify-center text-[#78716c] mb-4">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="font-serif text-2xl font-medium text-[#0c0a09]">No inventory items found</h3>
            <p className="text-xs text-[#78716c] max-w-sm mt-1 mb-6">
              Add raw ingredients like dairy, coffee beans, spices, or packaging items to track kitchen stock.
            </p>
            <button
              type="button"
              onClick={openAddDrawer}
              className="inline-flex items-center space-x-2 bg-[#0c0a09] hover:bg-[#292524] text-white text-xs font-medium px-5 py-2.5 rounded-full transition shadow-sm cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Raw Ingredient</span>
            </button>
          </div>
        ) : (
          <div className="bg-white border border-[#e7e5e4] rounded-xl shadow-xs overflow-hidden flex flex-col flex-1">
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#e7e5e4] bg-[#fafaf9]/80 text-[11px] uppercase tracking-wider text-[#78716c] font-medium sticky top-0 bg-white z-10">
                    <th className="py-3.5 px-5 font-normal">SKU / Item Name</th>
                    <th className="py-3.5 px-5 font-normal">Buying Unit</th>
                    <th className="py-3.5 px-5 font-normal">Serving Unit</th>
                    <th className="py-3.5 px-5 font-normal w-48">Available Stock</th>
                    <th className="py-3.5 px-5 font-normal">Min. Refill</th>
                    <th className="py-3.5 px-5 font-normal">Unit Cost</th>
                    <th className="py-3.5 px-5 font-normal">Status</th>
                    <th className="py-3.5 px-5 text-right font-normal">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7e5e4]/70 text-xs">
                  {filteredItems.map((item) => {
                    const percentage = Math.min(
                      100,
                      Math.max(5, (item.availableStock / (item.minimumStockRefillLevel * 2.5 || 1)) * 100)
                    );
                    return (
                      <tr key={item._id} className="hover:bg-[#fafaf9] transition-colors group">
                        <td className="py-4 px-5">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-800 font-serif font-bold text-xs shrink-0">
                              {item.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-[#0c0a09]">{item.name}</p>
                              <p className="text-[11px] text-[#a8a29e]">
                                {item.skuNumber ? `SKU: ${item.skuNumber}` : item.description || "No description"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-[#44403c] capitalize font-medium">{item.buyingUnit}</td>
                        <td className="py-4 px-5 text-[#57534e] capitalize">{item.servingUnit}</td>
                        <td className="py-4 px-5">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className={item.isLowStock ? "text-rose-600 font-semibold" : "text-stone-800 font-medium"}>
                                {item.availableStock} {item.servingUnit}
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-stone-100 overflow-hidden border border-stone-200">
                              <div
                                className={`h-full ${item.isLowStock ? "bg-rose-500" : "bg-emerald-500"}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-[#57534e]">
                          {item.minimumStockRefillLevel} {item.servingUnit}
                        </td>
                        <td className="py-4 px-5 font-medium text-[#0c0a09]">
                          {item.unitCost !== undefined ? `₹${item.unitCost}` : "—"}
                        </td>
                        <td className="py-4 px-5">
                          {item.isLowStock ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              🔴 LOW
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              🟢 OK
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-5 text-right">
                          <button
                            type="button"
                            onClick={() => openEditDrawer(item)}
                            className="px-3 py-1 bg-white hover:bg-[#0c0a09] hover:text-white text-[#0c0a09] border border-[#e7e5e4] rounded-full text-xs font-medium transition cursor-pointer shadow-2xs"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="py-3.5 px-5 border-t border-[#e7e5e4] bg-[#fafaf9]/50 flex items-center justify-between text-xs text-[#78716c] shrink-0">
              <span>Showing {filteredItems.length} of {items.length} raw ingredient(s)</span>
              <span>
                Total Inventory Value: <strong className="text-[#0c0a09]">₹{totalInventoryValue.toLocaleString("en-IN")}</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Drawer for Add / Edit Item */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-[#0c0a09]/30 backdrop-blur-[2px] z-40 transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white border-l border-[#e7e5e4] shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-6 border-b border-[#e7e5e4] flex items-start justify-between bg-white shrink-0">
          <div>
            <h2 className="font-serif text-2xl text-[#0c0a09] font-medium tracking-tight">
              {editingItem ? "Edit Inventory Item" : "Add Raw Ingredient"}
            </h2>
            <p className="text-xs text-[#78716c] mt-0.5">Configure ingredient specs, dual units, and refill alert levels.</p>
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

        <form id="itemForm" onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#1c1917] mb-1">
              Ingredient Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09]"
              placeholder="e.g. Amul Butter, Basmati Rice, Boneless Chicken"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block font-medium text-[#1c1917] mb-1">SKU / Barcode Number</label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] font-mono"
              placeholder="e.g. SKU-DAIRY-004"
              value={skuNumber}
              onChange={(e) => setSkuNumber(e.target.value)}
            />
          </div>

          <div>
            <label className="block font-medium text-[#1c1917] mb-1">Description / Storage Notes</label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] resize-none"
              placeholder="e.g. Deep freezer cold storage section 2..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#1c1917] mb-1">Buying Unit (Procurement)</label>
              <select
                disabled={!!editingItem}
                className="w-full px-3 py-2 bg-[#fbf9f8] border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] capitalize disabled:opacity-60"
                value={buyingUnit}
                onChange={(e) => setBuyingUnit(e.target.value)}
              >
                <option value="kilogram">Kilogram (kg)</option>
                <option value="litre">Litre (L)</option>
                <option value="packet">Packet</option>
                <option value="box">Box</option>
                <option value="piece">Piece</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-[#1c1917] mb-1">Serving Unit (Recipe Depletion)</label>
              <select
                disabled={!!editingItem}
                className="w-full px-3 py-2 bg-[#fbf9f8] border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] capitalize disabled:opacity-60"
                value={servingUnit}
                onChange={(e) => setServingUnit(e.target.value)}
              >
                <option value="gram">Gram (g)</option>
                <option value="millilitre">Millilitre (ml)</option>
                <option value="piece">Piece</option>
                <option value="portion">Portion</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#1c1917] mb-1">
                {editingItem ? "Current Stock" : "Initial Stock"} ({servingUnit})
              </label>
              <input
                type="number"
                disabled={!!editingItem}
                className="w-full px-3 py-2 bg-[#fbf9f8] border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] disabled:opacity-60"
                value={initialStock}
                onChange={(e) => setInitialStock(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block font-medium text-[#1c1917] mb-1">Min Refill Level ({servingUnit})</label>
              <input
                type="number"
                required
                className="w-full px-3 py-2 bg-[#fbf9f8] border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09]"
                value={minimumStockRefillLevel}
                onChange={(e) => setMinimumStockRefillLevel(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#1c1917] mb-1">Baseline Target Level ({servingUnit})</label>
              <input
                type="number"
                disabled={!!editingItem}
                className="w-full px-3 py-2 bg-[#fbf9f8] border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] disabled:opacity-60"
                value={baselineStockLevel}
                onChange={(e) => setBaselineStockLevel(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block font-medium text-[#1c1917] mb-1">Unit Cost (₹)</label>
              <input
                type="number"
                step="0.01"
                className="w-full px-3 py-2 bg-[#fbf9f8] border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09]"
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
            form="itemForm"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-full bg-[#0c0a09] hover:bg-[#292524] text-white text-xs font-medium transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : editingItem ? "Update Item" : "Save Ingredient"}
          </button>
        </div>
      </aside>
    </div>
  );
}
