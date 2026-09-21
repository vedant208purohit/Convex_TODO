"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

export function ItemRecipesView({ organizationId }: { organizationId: Id<"organizations"> }) {
  // Existing backend queries
  const inventoryItems = useQuery(api.inventory.listInventoryItems, { organizationId });
  const menuData = useQuery((api.menu as any).getOrganizationMenu, { organizationId }) as any[] | undefined;

  // Existing mutations
  const linkRecipeMutation = useMutation(api.inventory.linkItemRecipe);
  const removeRecipeMutation = useMutation(api.inventory.removeItemRecipe);

  // Selected Dish State
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Drawer / Add Ingredient State
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(100);
  const [unit, setUnit] = useState<string>("gram");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRemovingId, setIsRemovingId] = useState<string | null>(null);

  // Extract menu items list
  const menuItemsList = useMemo(() => {
    if (!menuData) return [];
    // Menu data structure contains categories with items
    const items: Array<{ _id: string; name: string; price: number; categoryName?: string }> = [];
    for (const cat of menuData) {
      if (cat.items && Array.isArray(cat.items)) {
        for (const item of cat.items) {
          items.push({
            _id: item._id,
            name: item.name,
            price: item.price ?? 0,
            categoryName: cat.name,
          });
        }
      }
    }
    return items;
  }, [menuData]);

  // Set default selected dish if not set
  const activeDish = useMemo(() => {
    if (selectedItemId) {
      return menuItemsList.find((m) => m._id === selectedItemId) || null;
    }
    if (menuItemsList.length > 0) {
      return menuItemsList[0];
    }
    return null;
  }, [menuItemsList, selectedItemId]);

  // Query existing recipe for the selected dish
  const activeDishRecipes = useQuery(
    api.inventory.getItemRecipe,
    activeDish ? { itemId: activeDish._id as Id<"items"> } : "skip"
  );

  // Filter menu items for selector
  const filteredMenuItems = useMemo(() => {
    if (!searchQuery.trim()) return menuItemsList;
    const q = searchQuery.toLowerCase();
    return menuItemsList.filter(
      (m) => m.name.toLowerCase().includes(q) || (m.categoryName && m.categoryName.toLowerCase().includes(q))
    );
  }, [menuItemsList, searchQuery]);

  // Detailed recipe lines with cost calculations
  const recipeLines = useMemo(() => {
    if (!activeDishRecipes || !inventoryItems) return [];
    return activeDishRecipes.map((r) => {
      const inv = inventoryItems.find((i) => i._id === r.inventoryItemId);
      const unitCost = inv?.unitCost ?? 0;
      // ingredientCost = quantity * unitCost (unit cost in ₹ per serving or buying unit)
      const ingredientCost = (r.quantity || 0) * unitCost;
      return {
        ...r,
        unitCost,
        ingredientCost,
        servingUnit: inv?.servingUnit || r.servingUnit || r.unit || "gram",
      };
    });
  }, [activeDishRecipes, inventoryItems]);

  // Theoretical Food Cost & Profit Calculations
  const theoreticalFoodCost = useMemo(() => {
    return recipeLines.reduce((acc, r) => acc + (r.ingredientCost || 0), 0);
  }, [recipeLines]);

  const grossProfitAmount = useMemo(() => {
    if (!activeDish) return 0;
    return Math.max(0, (activeDish.price || 0) - theoreticalFoodCost);
  }, [activeDish, theoreticalFoodCost]);

  const grossMarginPercentage = useMemo(() => {
    if (!activeDish || !activeDish.price || activeDish.price === 0) return 0;
    return Math.min(100, Math.max(0, (grossProfitAmount / activeDish.price) * 100));
  }, [activeDish, grossProfitAmount]);

  const openAddDrawer = () => {
    if (inventoryItems && inventoryItems.length > 0) {
      setSelectedIngredientId(inventoryItems[0]._id);
      setUnit(inventoryItems[0].servingUnit || "gram");
    } else {
      setSelectedIngredientId("");
      setUnit("gram");
    }
    setQuantity(100);
    setIsAddDrawerOpen(true);
  };

  const handleIngredientChange = (ingId: string) => {
    setSelectedIngredientId(ingId);
    const found = inventoryItems?.find((i) => i._id === ingId);
    if (found) {
      setUnit(found.servingUnit || "gram");
    }
  };

  const handleLinkRecipeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDish) {
      alert("Please select a menu dish first.");
      return;
    }
    if (!selectedIngredientId) {
      alert("Please select a raw inventory ingredient.");
      return;
    }
    if (quantity <= 0) {
      alert("Please enter a valid recipe quantity greater than zero.");
      return;
    }

    // Check duplicate entry
    const isDuplicate = activeDishRecipes?.some(
      (r) => r.inventoryItemId === selectedIngredientId
    );
    if (isDuplicate) {
      alert("This raw ingredient is already added to this dish recipe.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Backend linkItemRecipe args: { organizationId, itemId, customizationItemId, inventoryItemId, quantity, unit }
      await linkRecipeMutation({
        organizationId,
        itemId: activeDish._id as Id<"items">,
        inventoryItemId: selectedIngredientId as Id<"inventoryItems">,
        quantity: Number(quantity),
        unit,
      });
      setIsAddDrawerOpen(false);
    } catch (err) {
      console.error("Failed to link recipe ingredient:", err);
      alert("Failed to save recipe formula line.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveIngredient = async (recipeId: Id<"recipes">) => {
    if (!confirm("Are you sure you want to remove this raw ingredient from the dish formula?")) return;
    setIsRemovingId(recipeId);
    try {
      // Backend removeItemRecipe args: { id }
      await removeRecipeMutation({ id: recipeId });
    } catch (err) {
      console.error("Failed to remove recipe line:", err);
      alert("Failed to remove recipe ingredient.");
    } finally {
      setIsRemovingId(null);
    }
  };

  if (inventoryItems === undefined || menuData === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-[#fbf9f8]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-stone-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-stone-500 font-medium">Loading recipe builder & costing engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#fbf9f8] p-8">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#e7e5e4]">
        <div>
          <h1 className="font-serif text-3xl font-medium text-[#0c0a09] tracking-tight">Item Recipes (BOM)</h1>
          <p className="text-xs text-[#78716c] mt-0.5">
            Configure raw ingredient formulas depleted per dish order & calculate theoretical food costs.
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
              placeholder="Search dish by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={openAddDrawer}
            disabled={!activeDish}
            className="inline-flex items-center space-x-2 bg-[#0c0a09] hover:bg-[#292524] text-white text-xs font-medium px-4 py-2.5 rounded-full transition shadow-sm cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Ingredient Line</span>
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="mt-6 flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
        {/* Left: Menu Dish Selector List */}
        <div className="w-full md:w-72 bg-white border border-[#e7e5e4] rounded-xl shadow-xs flex flex-col shrink-0 overflow-hidden">
          <div className="p-3.5 border-b border-[#e7e5e4] bg-[#fafaf9] text-xs font-semibold text-[#0c0a09]">
            Select Menu Item ({filteredMenuItems.length})
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-[#e7e5e4]/60 text-xs">
            {filteredMenuItems.length === 0 ? (
              <div className="p-4 text-center text-stone-400">No menu items found.</div>
            ) : (
              filteredMenuItems.map((item) => {
                const isSelected = activeDish?._id === item._id;
                return (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => setSelectedItemId(item._id)}
                    className={`w-full text-left p-3.5 transition flex items-center justify-between cursor-pointer ${
                      isSelected ? "bg-[#0c0a09] text-white font-medium" : "hover:bg-[#fafaf9] text-[#1c1917]"
                    }`}
                  >
                    <div>
                      <p className="font-medium truncate max-w-[170px]">{item.name}</p>
                      {item.categoryName && (
                        <p className={`text-[10px] ${isSelected ? "text-stone-300" : "text-stone-400"}`}>
                          {item.categoryName}
                        </p>
                      )}
                    </div>
                    <span className={`font-semibold ${isSelected ? "text-white" : "text-stone-700"}`}>
                      ₹{item.price}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Recipe Formula Details & Costing Engine */}
        <div className="flex-1 bg-white border border-[#e7e5e4] rounded-xl shadow-xs flex flex-col overflow-hidden">
          {activeDish ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Dish Summary Bar */}
              <div className="p-5 border-b border-[#e7e5e4] bg-[#fafaf9]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="font-serif text-2xl font-medium text-[#0c0a09]">{activeDish.name}</h2>
                    {activeDish.categoryName && (
                      <span className="text-[10px] font-semibold uppercase bg-stone-100 px-2 py-0.5 rounded text-stone-600 border border-stone-200">
                        {activeDish.categoryName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#78716c] mt-0.5">
                    Menu Selling Price: <strong className="text-[#0c0a09]">₹{activeDish.price}</strong>
                  </p>
                </div>

                {/* Theoretical Food Cost Metrics */}
                <div className="flex items-center space-x-4 bg-white p-2.5 px-4 rounded-xl border border-[#e7e5e4] text-xs">
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase block">Food Cost</span>
                    <span className="font-bold text-[#0c0a09]">₹{theoreticalFoodCost.toFixed(2)}</span>
                  </div>
                  <div className="h-6 w-px bg-stone-200" />
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase block">Gross Margin</span>
                    <span className="font-bold text-emerald-700">
                      {grossMarginPercentage.toFixed(1)}% (₹{grossProfitAmount.toFixed(2)})
                    </span>
                  </div>
                </div>
              </div>

              {/* Recipe Lines Table */}
              <div className="flex-1 overflow-x-auto overflow-y-auto">
                {recipeLines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                    <div className="w-12 h-12 rounded-full bg-[#f5f5f4] border border-[#e7e5e4] flex items-center justify-center text-[#78716c] mb-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <h3 className="font-serif text-xl font-medium text-[#0c0a09]">No ingredients linked to {activeDish.name}</h3>
                    <p className="text-xs text-[#78716c] max-w-sm mt-1 mb-4">
                      Add ingredient lines to define the exact raw materials depleted when this dish is sold.
                    </p>
                    <button
                      type="button"
                      onClick={openAddDrawer}
                      className="inline-flex items-center space-x-2 bg-[#0c0a09] hover:bg-[#292524] text-white text-xs font-medium px-4 py-2 rounded-full transition shadow-sm cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add Ingredient Line</span>
                    </button>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#e7e5e4] bg-[#fafaf9]/80 text-[11px] uppercase tracking-wider text-[#78716c] font-medium sticky top-0 bg-white z-10">
                        <th className="py-3.5 px-5 font-normal">#</th>
                        <th className="py-3.5 px-5 font-normal">Raw Ingredient</th>
                        <th className="py-3.5 px-5 font-normal">Recipe Quantity</th>
                        <th className="py-3.5 px-5 font-normal">Unit Cost</th>
                        <th className="py-3.5 px-5 font-normal">Est. Ingredient Cost</th>
                        <th className="py-3.5 px-5 text-right font-normal">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e7e5e4]/70 text-xs">
                      {recipeLines.map((r, idx) => (
                        <tr key={r._id} className="hover:bg-[#fafaf9] transition-colors">
                          <td className="py-4 px-5 text-stone-400 font-medium">{idx + 1}</td>
                          <td className="py-4 px-5 font-medium text-[#0c0a09]">{r.ingredientName}</td>
                          <td className="py-4 px-5 font-semibold text-[#0c0a09]">
                            {r.quantity} {r.servingUnit}
                          </td>
                          <td className="py-4 px-5 text-[#57534e]">
                            {r.unitCost > 0 ? `₹${r.unitCost}` : "—"}
                          </td>
                          <td className="py-4 px-5 font-semibold text-[#0c0a09]">
                            ₹{r.ingredientCost.toFixed(2)}
                          </td>
                          <td className="py-4 px-5 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveIngredient(r._id)}
                              disabled={isRemovingId === r._id}
                              className="text-stone-400 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50 transition cursor-pointer disabled:opacity-50"
                              title="Remove ingredient line"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Bottom Summary Bar */}
              {recipeLines.length > 0 && (
                <div className="p-4 px-5 border-t border-[#e7e5e4] bg-[#fafaf9]/50 flex items-center justify-between text-xs text-[#78716c] shrink-0">
                  <span>Showing {recipeLines.length} ingredient line(s)</span>
                  <span>
                    Theoretical Food Cost: <strong className="text-[#0c0a09]">₹{theoreticalFoodCost.toFixed(2)}</strong>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center flex-1">
              <p className="text-xs text-stone-500">Please select a menu dish from the left sidebar.</p>
            </div>
          )}
        </div>
      </div>

      {/* Drawer Backdrop */}
      {isAddDrawerOpen && (
        <div
          className="fixed inset-0 bg-[#0c0a09]/30 backdrop-blur-[2px] z-40 transition-opacity"
          onClick={() => setIsAddDrawerOpen(false)}
        />
      )}

      {/* Add Ingredient Line Drawer */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white border-l border-[#e7e5e4] shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          isAddDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-6 border-b border-[#e7e5e4] flex items-start justify-between bg-white shrink-0">
          <div>
            <h2 className="font-serif text-2xl text-[#0c0a09] font-medium tracking-tight">Add Ingredient Line</h2>
            <p className="text-xs text-[#78716c] mt-0.5">
              Target Dish: <strong className="text-[#0c0a09]">{activeDish?.name}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddDrawerOpen(false)}
            className="text-[#78716c] hover:text-[#0c0a09] p-1.5 rounded-full hover:bg-[#f5f5f4] transition cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form id="recipeLineForm" onSubmit={handleLinkRecipeSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#1c1917] mb-1">
              Select Raw Ingredient <span className="text-rose-500">*</span>
            </label>
            <select
              required
              className="w-full px-3 py-2 bg-[#fbf9f8] border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] capitalize"
              value={selectedIngredientId}
              onChange={(e) => handleIngredientChange(e.target.value)}
            >
              {inventoryItems?.map((inv) => (
                <option key={inv._id} value={inv._id}>
                  {inv.name} ({inv.servingUnit}) — Unit Cost: ₹{inv.unitCost ?? 0}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#1c1917] mb-1">
                Recipe Quantity <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                required
                className="w-full px-3 py-2 bg-[#fbf9f8] border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09]"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block font-medium text-[#1c1917] mb-1">Consumption Unit</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 bg-[#fbf9f8] border border-[#e7e5e4] rounded-lg focus:outline-none capitalize"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
          </div>
        </form>

        <div className="p-4 px-6 border-t border-[#e7e5e4] bg-[#fafaf9] flex items-center justify-end space-x-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsAddDrawerOpen(false)}
            className="px-5 py-2.5 rounded-full border border-[#e7e5e4] text-[#57534e] hover:text-[#0c0a09] hover:bg-white text-xs font-medium transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="recipeLineForm"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-full bg-[#0c0a09] hover:bg-[#292524] text-white text-xs font-medium transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Recipe Formula"}
          </button>
        </div>
      </aside>
    </div>
  );
}
