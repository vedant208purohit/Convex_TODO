"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

const COMMON_UNITS = [
  "gram",
  "kg",
  "ml",
  "liter",
  "piece",
  "portion",
  "tbsp",
  "tsp",
  "cup",
  "oz",
  "lb",
  "pack",
];

export function ItemRecipesView({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  // Existing backend queries (allMenus: true fetches all organization items)
  const inventoryItems = useQuery(api.inventory.listInventoryItems, {
    organizationId,
  });
  const menuData = useQuery((api.menu as any).getOrganizationMenu, {
    organizationId,
    allMenus: true,
  }) as any[] | undefined;
  const menus = useQuery(api.menu.listMenus, {
    organizationId,
  });

  // Existing mutations
  const linkRecipeMutation = useMutation(api.inventory.linkItemRecipe);
  const removeRecipeMutation = useMutation(api.inventory.removeItemRecipe);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] =
    useState<string>("ALL");

  // Track counts across dishes to detect empty state
  const [dishRowCounts, setDishRowCounts] = useState<Record<string, number>>(
    {},
  );

  const handleVisibilityChange = useCallback(
    (dishId: string, count: number) => {
      setDishRowCounts((prev) => {
        if (prev[dishId] === count) return prev;
        return { ...prev, [dishId]: count };
      });
    },
    [],
  );

  const totalRecipeRows = useMemo(() => {
    return Object.values(dishRowCounts).reduce((acc, count) => acc + count, 0);
  }, [dishRowCounts]);

  // Drawer / Add New Recipe State
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [recipeName, setRecipeName] = useState<string>("");
  const [recipeQuantity, setRecipeQuantity] = useState<number | "">("");
  const [recipeUnit, setRecipeUnit] = useState<string>("Kilogram (kg)");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  // Delete Confirmation State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    recipeId: Id<"recipes"> | null;
    ingredientName: string;
    dishName: string;
  }>({
    isOpen: false,
    recipeId: null,
    ingredientName: "",
    dishName: "",
  });
  const [isRemoving, setIsRemoving] = useState(false);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Extract categories list
  const categoriesList = useMemo(() => {
    if (!menuData) return [];
    return menuData.map((cat) => cat.name).filter(Boolean);
  }, [menuData]);

  // Extract menu items list
  const menuItemsList = useMemo(() => {
    if (!menuData) return [];
    const items: Array<{
      _id: string;
      name: string;
      price: number;
      categoryName?: string;
    }> = [];
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

  // Filtered menu items list based on category filter
  const filteredMenuItems = useMemo(() => {
    if (selectedCategoryFilter === "ALL") return menuItemsList;
    return menuItemsList.filter(
      (m) => m.categoryName === selectedCategoryFilter,
    );
  }, [menuItemsList, selectedCategoryFilter]);

  const openAddDrawer = () => {
    setDrawerError(null);
    setRecipeName("");
    setRecipeQuantity("");
    setRecipeUnit("Kilogram (kg)");
    setIsAddDrawerOpen(true);
  };

  const handleAddRecipeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDrawerError(null);

    const trimmedName = recipeName.trim();
    if (!trimmedName) {
      setDrawerError("Please enter a recipe name.");
      return;
    }
    if (!recipeQuantity || Number(recipeQuantity) <= 0) {
      setDrawerError("Please enter a valid recipe quantity greater than zero.");
      return;
    }
    if (!recipeUnit) {
      setDrawerError("Please select a unit.");
      return;
    }

    // Resolve dish from menuItemsList
    let targetDishId = menuItemsList.find(
      (m) => m.name.toLowerCase() === trimmedName.toLowerCase()
    )?._id;
    if (!targetDishId) {
      targetDishId = menuItemsList.find((m) =>
        m.name.toLowerCase().includes(trimmedName.toLowerCase())
      )?._id;
    }
    if (!targetDishId && menuItemsList.length > 0) {
      targetDishId = menuItemsList[0]._id;
    }

    // Resolve ingredient from inventoryItems
    let targetInvId = inventoryItems?.find(
      (i) => i.name.toLowerCase() === trimmedName.toLowerCase()
    )?._id;
    if (!targetInvId) {
      targetInvId = inventoryItems?.find((i) =>
        i.name.toLowerCase().includes(trimmedName.toLowerCase())
      )?._id;
    }
    if (!targetInvId && inventoryItems && inventoryItems.length > 0) {
      targetInvId = inventoryItems[0]._id;
    }

    if (!targetDishId) {
      setDrawerError("No menu item found.");
      return;
    }
    if (!targetInvId) {
      setDrawerError("No raw ingredient found.");
      return;
    }

    setIsSubmitting(true);
    try {
      await linkRecipeMutation({
        organizationId,
        itemId: targetDishId as Id<"items">,
        inventoryItemId: targetInvId as Id<"inventoryItems">,
        quantity: Number(recipeQuantity),
        unit: recipeUnit,
      });

      setIsAddDrawerOpen(false);
      setRecipeName("");
      setRecipeQuantity("");
      setRecipeUnit("Kilogram (kg)");
      showToast("New recipe created successfully.");
    } catch (err: any) {
      console.error("Link recipe failed:", err);
      setDrawerError(err?.message || "Failed to save recipe formula.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteDialog = (
    recipeId: Id<"recipes">,
    ingredientName: string,
    dishName: string,
  ) => {
    setDeleteConfirmation({
      isOpen: true,
      recipeId,
      ingredientName,
      dishName,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation.recipeId) return;
    setIsRemoving(true);
    try {
      await removeRecipeMutation({ id: deleteConfirmation.recipeId });
      showToast("Recipe line removed.", "success");
    } catch (err: any) {
      console.error("Failed to remove recipe line:", err);
      showToast(err?.message || "Failed to remove recipe line.", "error");
    } finally {
      setIsRemoving(false);
      setDeleteConfirmation({
        isOpen: false,
        recipeId: null,
        ingredientName: "",
        dishName: "",
      });
    }
  };

  if (inventoryItems === undefined || menuData === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-[#fbf9f8]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-stone-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-stone-500 font-medium">
            Loading recipe formulas...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#fbf9f8] p-8">
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

      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#e7e5e4]">
        <div>
          <h1 className="font-serif text-3xl font-medium text-[#0c0a09] tracking-tight">
            Item Recipes
          </h1>
          <p className="text-xs text-[#78716c] mt-0.5">
            Configure raw ingredient formulas depleted per dish order &
            calculate theoretical food costs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="relative w-64">
            <svg
              className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#a8a29e]"
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
              className="w-full pl-8 pr-3 py-2 bg-white text-xs text-[#1c1917] border border-[#e7e5e4] rounded-full focus:outline-none focus:ring-1 focus:ring-[#0c0a09] placeholder:text-[#a8a29e]"
              placeholder="Search by dish or ingredient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          {categoriesList.length > 0 && (
            <div className="relative">
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="appearance-none text-xs bg-white border border-[#e7e5e4] rounded-full px-3.5 py-2 pr-8 text-[#1c1917] focus:outline-none focus:ring-1 focus:ring-[#0c0a09] transition cursor-pointer font-medium"
              >
                <option value="ALL">All Categories</option>
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[#78716c]">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          )}

          {/* Add New Recipe Button */}
          <button
            type="button"
            onClick={openAddDrawer}
            className="inline-flex items-center space-x-2 bg-[#0c0a09] hover:bg-[#292524] active:scale-[0.98] text-white !text-white text-xs font-medium px-4 py-2.5 rounded-full transition shadow-sm cursor-pointer whitespace-nowrap"
            style={{ color: "#ffffff" }}
          >
            <svg
              className="w-3.5 h-3.5 shrink-0 text-white !text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ color: "#ffffff" }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span
              className="text-white !text-white font-medium"
              style={{ color: "#ffffff" }}
            >
              Add new recipe
            </span>
          </button>
        </div>
      </div>

      {/* Hidden row renderers to compute total rows reactively */}
      <div className="hidden">
        {filteredMenuItems.map((dish) => (
          <DishRecipeCounter
            key={dish._id}
            dish={dish}
            searchQuery={searchQuery}
            selectedCategory={selectedCategoryFilter}
            onVisibilityChange={handleVisibilityChange}
          />
        ))}
      </div>

      {/* Main Container */}
      <div className="mt-6 flex-1 bg-white border border-[#e7e5e4] rounded-xl shadow-xs flex flex-col overflow-hidden">
        {totalRecipeRows === 0 ? (
          /* Empty State View with Centered Add Button */
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[360px]">
            <div className="w-14 h-14 rounded-full bg-[#f5f5f4] border border-[#e7e5e4] flex items-center justify-center text-[#78716c] mb-4">
              <svg
                className="w-6 h-6 text-stone-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h3 className="font-serif text-xl font-medium text-[#0c0a09]">
              No item recipes found
            </h3>
            <p className="text-xs text-[#78716c] max-w-sm mt-1 mb-5">
              Create and manage recipe formulas here to streamline kitchen
              operations and raw ingredient depletion.
            </p>
            <button
              type="button"
              onClick={openAddDrawer}
              className="inline-flex items-center space-x-2 bg-[#0c0a09] hover:bg-[#292524] text-white !text-white text-xs font-medium px-5 py-2.5 rounded-full transition shadow-sm cursor-pointer"
              style={{ color: "#ffffff" }}
            >
              <svg
                className="w-3.5 h-3.5 shrink-0 text-white !text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: "#ffffff" }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span
                className="text-white !text-white font-medium"
                style={{ color: "#ffffff" }}
              >
                Add new recipe
              </span>
            </button>
          </div>
        ) : (
          /* Table View */
          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#e7e5e4] bg-[#fafaf9]/80 text-[11px] uppercase tracking-wider text-[#78716c] font-medium sticky top-0 bg-white z-10 select-none">
                  <th className="py-3.5 px-5 font-normal">Menu Item (Dish)</th>
                  <th className="py-3.5 px-5 font-normal">Raw Ingredient</th>
                  <th className="py-3.5 px-5 font-normal">Recipe Quantity</th>
                  <th className="py-3.5 px-5 font-normal">Unit Cost</th>
                  <th className="py-3.5 px-5 font-normal">Est. Line Cost</th>
                  <th className="py-3.5 px-5 text-right font-normal">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e7e5e4]/70 text-xs">
                {filteredMenuItems.map((dish) => (
                  <DishRecipeRows
                    key={dish._id}
                    dish={dish}
                    inventoryItems={inventoryItems || []}
                    searchQuery={searchQuery}
                    selectedCategory={selectedCategoryFilter}
                    onDelete={openDeleteDialog}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 bg-[#0c0a09]/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e7e5e4] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-serif text-lg font-medium text-[#0c0a09]">
                  Remove Recipe Line
                </h3>
                <p className="text-xs text-stone-500">
                  Dish: {deleteConfirmation.dishName}
                </p>
              </div>
            </div>

            <p className="text-xs text-[#57534e]">
              Are you sure you want to remove{" "}
              <strong className="text-[#0c0a09]">
                {deleteConfirmation.ingredientName}
              </strong>{" "}
              from{" "}
              <strong className="text-[#0c0a09]">
                {deleteConfirmation.dishName}
              </strong>
              ?
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  setDeleteConfirmation({
                    isOpen: false,
                    recipeId: null,
                    ingredientName: "",
                    dishName: "",
                  })
                }
                className="px-4 py-2 border border-[#e7e5e4] rounded-full text-xs text-[#57534e] hover:bg-stone-50 font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isRemoving}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white !text-white rounded-full text-xs font-medium transition cursor-pointer disabled:bg-rose-200 disabled:text-rose-400 disabled:cursor-not-allowed"
                style={{ color: "#ffffff" }}
              >
                <span
                  className="text-white !text-white"
                  style={{ color: "#ffffff" }}
                >
                  {isRemoving ? "Removing..." : "Confirm Delete"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer Backdrop */}
      {isAddDrawerOpen && (
        <div
          className="fixed inset-0 bg-[#0c0a09]/30 backdrop-blur-[2px] z-40 transition-opacity"
          onClick={() => setIsAddDrawerOpen(false)}
        />
      )}

      {/* Add New Recipe Drawer */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white border-l border-stone-200 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          isAddDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-5 px-6 border-b border-stone-200 flex items-center justify-between bg-white shrink-0">
          <h2 className="text-xl text-stone-900 font-bold tracking-tight">
            Create new recipe
          </h2>
          <button
            type="button"
            onClick={() => setIsAddDrawerOpen(false)}
            className="text-stone-500 hover:text-stone-900 p-1.5 rounded-full hover:bg-stone-100 transition cursor-pointer"
          >
            <svg
              className="w-5 h-5"
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
          </button>
        </div>

        <form
          id="addRecipeForm"
          onSubmit={handleAddRecipeSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5 text-sm"
        >
          {drawerError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center space-x-2">
              <svg
                className="w-4 h-4 text-rose-500 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{drawerError}</span>
            </div>
          )}

          {/* Recipe name */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Recipe name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              list="recipe-names-list"
              placeholder="Enter the recipe name"
              className="w-full px-3.5 py-2.5 bg-stone-50 hover:bg-white focus:bg-white text-sm border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition"
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
            />
            <datalist id="recipe-names-list">
              {menuItemsList.map((m) => (
                <option key={`m-${m._id}`} value={m.name} />
              ))}
              {(inventoryItems || []).map((i) => (
                <option key={`i-${i._id}`} value={i.name} />
              ))}
            </datalist>
          </div>

          {/* Recipe Quantity */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Recipe Quantity <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="0.01"
              step="any"
              required
              placeholder="Enter quantity"
              className="w-full px-3.5 py-2.5 bg-stone-50 hover:bg-white focus:bg-white text-sm border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition"
              value={recipeQuantity}
              onChange={(e) =>
                setRecipeQuantity(e.target.value ? Number(e.target.value) : "")
              }
            />
          </div>

          {/* Units */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Units <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                required
                className="w-full appearance-none px-3.5 py-2.5 bg-stone-50 hover:bg-white focus:bg-white text-sm border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 transition cursor-pointer pr-9 font-medium"
                value={recipeUnit}
                onChange={(e) => setRecipeUnit(e.target.value)}
              >
                <option value="Kilogram (kg)">Kilogram (kg)</option>
                <option value="Gram (g)">Gram (g)</option>
                <option value="Milligram (mg)">Milligram (mg)</option>
                <option value="Litre (l)">Litre (l)</option>
                <option value="Millilitre (ml)">Millilitre (ml)</option>
                <option value="Piece (pc)">Piece (pc)</option>
                <option value="Packet (pkt)">Packet (pkt)</option>
                <option value="Box">Box</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-stone-600">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsAddDrawerOpen(false)}
              className="w-full py-2.5 px-4 rounded-md bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold text-sm transition cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-md bg-[#212121] hover:bg-black text-white font-semibold text-sm transition shadow-sm cursor-pointer text-center disabled:bg-stone-300 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Saving..." : "Create"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function DishRecipeCounter({
  dish,
  searchQuery,
  selectedCategory,
  onVisibilityChange,
}: {
  dish: { _id: string; name: string; categoryName?: string };
  searchQuery: string;
  selectedCategory: string;
  onVisibilityChange: (dishId: string, count: number) => void;
}) {
  const recipes = useQuery(api.inventory.getItemRecipe, {
    itemId: dish._id as Id<"items">,
  });

  if (recipes && recipes.length > 0) {
    console.log("[RECIPE DEBUG] getItemRecipe result for dish:", dish.name, recipes);
  }

  const q = searchQuery.toLowerCase().trim();
  const count = useMemo(() => {
    if (!recipes || recipes.length === 0) return 0;
    if (selectedCategory !== "ALL" && dish.categoryName !== selectedCategory)
      return 0;
    return recipes.filter((r) => {
      if (!q) return true;
      const dishMatch = dish.name.toLowerCase().includes(q);
      const catMatch =
        dish.categoryName && dish.categoryName.toLowerCase().includes(q);
      const ingMatch = (r.ingredientName || "").toLowerCase().includes(q);
      return dishMatch || catMatch || ingMatch;
    }).length;
  }, [recipes, q, dish.name, dish.categoryName, selectedCategory]);

  useEffect(() => {
    onVisibilityChange(dish._id, count);
  }, [dish._id, count, onVisibilityChange]);

  return null;
}

function DishRecipeRows({
  dish,
  inventoryItems,
  searchQuery,
  selectedCategory,
  onDelete,
}: {
  dish: { _id: string; name: string; price: number; categoryName?: string };
  inventoryItems: any[];
  searchQuery: string;
  selectedCategory: string;
  onDelete: (
    recipeId: Id<"recipes">,
    ingredientName: string,
    dishName: string,
  ) => void;
}) {
  const recipes = useQuery(api.inventory.getItemRecipe, {
    itemId: dish._id as Id<"items">,
  });

  if (!recipes || recipes.length === 0) return null;

  const q = searchQuery.toLowerCase().trim();

  const matchingRecipes = recipes.filter((r) => {
    if (!q) return true;
    const dishMatch = dish.name.toLowerCase().includes(q);
    const catMatch =
      dish.categoryName && dish.categoryName.toLowerCase().includes(q);
    const ingMatch = (r.ingredientName || "").toLowerCase().includes(q);
    return dishMatch || catMatch || ingMatch;
  });

  if (matchingRecipes.length === 0) return null;

  if (selectedCategory !== "ALL" && dish.categoryName !== selectedCategory)
    return null;

  return (
    <>
      {matchingRecipes.map((r) => {
        const inv = inventoryItems.find((i) => i._id === r.inventoryItemId);
        const unitCost = inv?.unitCost ?? 0;
        const ingredientCost = (r.quantity || 0) * unitCost;

        return (
          <tr key={r._id} className="hover:bg-[#fafaf9] transition-colors">
            <td className="py-3.5 px-5 font-medium text-[#0c0a09]">
              <div>
                <p className="font-medium text-xs text-[#0c0a09]">
                  {dish.name}
                </p>
                {dish.categoryName && (
                  <span className="text-[10px] text-stone-400 font-normal">
                    {dish.categoryName}
                  </span>
                )}
              </div>
            </td>
            <td className="py-3.5 px-5 font-medium text-[#0c0a09]">
              {r.ingredientName}
            </td>
            <td className="py-3.5 px-5 font-semibold text-[#0c0a09]">
              {r.quantity} {r.unit || r.servingUnit || "gram"}
            </td>
            <td className="py-3.5 px-5 text-[#57534e]">
              {unitCost > 0 ? `₹${unitCost.toFixed(2)}` : "—"}
            </td>
            <td className="py-3.5 px-5 font-semibold text-[#0c0a09]">
              ₹{ingredientCost.toFixed(2)}
            </td>
            <td className="py-3.5 px-5 text-right">
              <button
                type="button"
                onClick={() => onDelete(r._id, r.ingredientName, dish.name)}
                className="text-stone-400 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50 transition cursor-pointer"
                title="Delete recipe line"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </td>
          </tr>
        );
      })}
    </>
  );
}
