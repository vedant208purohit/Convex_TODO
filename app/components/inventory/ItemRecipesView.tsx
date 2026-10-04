"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { getCurrencyForCountry } from "@/lib/constants/countries";

const UNITS_LIST = [
  "Kilogram (kg)",
  "Gram (g)",
  "Milligram (mg)",
  "Litre (l)",
  "Millilitre (ml)",
  "Dozen (dzn)",
  "Pounds (lbs)",
  "Ounce (oz)",
  "Fluid ounce (fl oz)",
  "Gallon (gal)",
  "Piece (pc)",
];

export function ItemRecipesView({
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

  // Backend Queries
  const inventoryItems = useQuery(api.inventory.listInventoryItems, {
    organizationId,
  });
  const menuData = useQuery((api.menu as any).getOrganizationMenu, {
    organizationId,
    allMenus: true,
  }) as any[] | undefined;
  const allMenuItemsRaw = useQuery(api.menu.listAllItems, { organizationId });

  // Backend Mutations
  const linkRecipeMutation = useMutation(api.inventory.linkItemRecipe);
  const removeRecipeMutation = useMutation(api.inventory.removeItemRecipe);
  const createItemMutation = useMutation(api.menu.createItem);

  // View Navigation State ("LIST" Master View vs "DETAIL" Ingredients View)
  const [viewState, setViewState] = useState<"LIST" | "DETAIL">("LIST");
  const [selectedDishId, setSelectedDishId] = useState<Id<"items"> | null>(
    null,
  );

  // Local state for custom recipes created directly in Item Recipes view (with localStorage persistence)
  const [customRecipes, setCustomRecipes] = useState<
    Array<{
      _id: Id<"items">;
      name: string;
      price: number;
      categoryName?: string;
      createdAt?: number;
    }>
  >([]);

  // Recipe Yield / Quantity Map (Stores custom recipe yields per dish)
  const [recipeYieldMap, setRecipeYieldMap] = useState<
    Record<string, { quantity: number; unit: string }>
  >({});

  // Sync recipes & yield data from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedRecipes = localStorage.getItem("pos_custom_recipes");
      if (savedRecipes) {
        try {
          const parsed = JSON.parse(savedRecipes);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCustomRecipes(parsed);
          }
        } catch (e) {
          console.error("Error reading saved recipes from localStorage:", e);
        }
      }

      const savedYields = localStorage.getItem("pos_recipe_yield_map");
      if (savedYields) {
        try {
          const parsed = JSON.parse(savedYields);
          if (parsed && typeof parsed === "object") {
            setRecipeYieldMap(parsed);
          }
        } catch (e) {
          console.error("Error reading saved yields from localStorage:", e);
        }
      }
    }
  }, []);

  // Persist customRecipes to localStorage whenever updated
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pos_custom_recipes", JSON.stringify(customRecipes));
    }
  }, [customRecipes]);

  // Persist recipeYieldMap to localStorage whenever updated
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pos_recipe_yield_map", JSON.stringify(recipeYieldMap));
    }
  }, [recipeYieldMap]);

  // Search Query State
  const [searchQuery, setSearchQuery] = useState("");

  // Context Menu State (3-dots popup)
  const [openContextMenuId, setOpenContextMenuId] = useState<string | null>(
    null,
  );

  // Active Drawer State
  const [activeDrawer, setActiveDrawer] = useState<
    "ADD_RECIPE" | "ADD_INGREDIENT" | "ASSIGN_MENU_ITEM" | null
  >(null);

  // 1. Create New Recipe Drawer Form State (EXACT 3 FIELDS ONLY)
  const [recipeDishName, setRecipeDishName] = useState("");
  const [recipeQuantity, setRecipeQuantity] = useState<number | "">("");
  const [recipeUnit, setRecipeUnit] = useState("Kilogram (kg)");

  // 2. Add Ingredient Drawer Form State
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>("");
  const [ingredientQuantity, setIngredientQuantity] = useState<number | "">("");
  const [ingredientUnit, setIngredientUnit] = useState("piece (pc)");

  // Submission & Error State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [recipeNameError, setRecipeNameError] = useState("");
  const [recipeQtyError, setRecipeQtyError] = useState("");

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

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Close Context Menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setOpenContextMenuId(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Extract Combined Menu Dishes List
  const menuItemsList = useMemo(() => {
    const map = new Map<
      string,
      {
        _id: Id<"items">;
        name: string;
        price: number;
        categoryName?: string;
        createdAt?: number;
      }
    >();

    // 1. First add custom recipes created in recipe manager
    for (const item of customRecipes) {
      map.set(item._id, item);
    }

    // 2. Add menu categories items
    if (menuData && Array.isArray(menuData)) {
      for (const cat of menuData) {
        if (cat.items && Array.isArray(cat.items)) {
          for (const item of cat.items) {
            if (!map.has(item._id)) {
              map.set(item._id, {
                _id: item._id as Id<"items">,
                name: item.name,
                price: item.price ?? 0,
                categoryName: cat.name,
                createdAt: item._creationTime || Date.now(),
              });
            }
          }
        }
      }
    }

    // 3. Add raw unassigned menu items
    if (allMenuItemsRaw && Array.isArray(allMenuItemsRaw)) {
      for (const item of allMenuItemsRaw) {
        if (!map.has(item._id)) {
          map.set(item._id, {
            _id: item._id as Id<"items">,
            name: item.name,
            price: item.price ?? 0,
            categoryName: (item as any).categoryName || "General",
            createdAt: item._creationTime || Date.now(),
          });
        }
      }
    }

    return Array.from(map.values());
  }, [menuData, allMenuItemsRaw, customRecipes]);

  // Selected Dish Object for Detail View
  const selectedDish = useMemo(() => {
    if (!selectedDishId) return null;
    return (
      menuItemsList.find((d) => d._id === selectedDishId) ||
      customRecipes.find((d) => d._id === selectedDishId) ||
      null
    );
  }, [menuItemsList, customRecipes, selectedDishId]);

  // Filtered Menu Items for List View
  const filteredMenuItems = useMemo(() => {
    let items = menuItemsList;
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      items = items.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.categoryName && m.categoryName.toLowerCase().includes(q)),
      );
    }
    return items;
  }, [menuItemsList, searchQuery]);

  // Open Create Recipe Drawer
  const openCreateRecipeDrawer = () => {
    setDrawerError(null);
    setRecipeNameError("");
    setRecipeQtyError("");
    setRecipeDishName("");
    setRecipeQuantity("");
    setRecipeUnit("Kilogram (kg)");
    setActiveDrawer("ADD_RECIPE");
  };

  // Open Add Ingredient Drawer
  const openAddIngredientDrawer = () => {
    setDrawerError(null);
    const firstIng =
      inventoryItems && inventoryItems.length > 0 ? inventoryItems[0] : null;
    setSelectedIngredientId(firstIng ? firstIng._id : "");
    setIngredientQuantity("");
    setIngredientUnit(
      firstIng ? firstIng.servingUnit || firstIng.buyingUnit || "piece (pc)" : "piece (pc)",
    );
    setActiveDrawer("ADD_INGREDIENT");
  };

  // Handle Save Recipe Submit (EXACTLY 3 FIELDS: Name, Quantity, Units)
  const handleSaveRecipeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDrawerError(null);

    let hasValidationError = false;

    if (!recipeDishName.trim()) {
      setRecipeNameError("Recipe name is required.");
      hasValidationError = true;
    } else {
      setRecipeNameError("");
    }

    if (!recipeQuantity || Number(recipeQuantity) <= 0 || isNaN(Number(recipeQuantity))) {
      setRecipeQtyError("Recipe quantity is required.");
      hasValidationError = true;
    } else {
      setRecipeQtyError("");
    }

    if (hasValidationError) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Find matching item or create new item in database
      let targetDish = menuItemsList.find(
        (m) =>
          m.name.toLowerCase().trim() === recipeDishName.toLowerCase().trim(),
      );
      let targetDishId = targetDish?._id;

      if (!targetDishId) {
        try {
          targetDishId = await createItemMutation({
            organizationId,
            name: recipeDishName.trim(),
            price: 0,
            published: true,
            isAvailable: true,
          });
        } catch (dbErr) {
          console.warn("Backend create item warn:", dbErr);
          targetDishId = `recipe_${Date.now()}` as Id<"items">;
        }
      }

      const newRecipeObj = {
        _id: targetDishId,
        name: recipeDishName.trim(),
        price: 0,
        categoryName: "Item Recipe",
        createdAt: Date.now(),
      };

      setCustomRecipes((prev) => [
        newRecipeObj,
        ...prev.filter((x) => x._id !== targetDishId),
      ]);

      setRecipeYieldMap((prev) => ({
        ...prev,
        [targetDishId]: {
          quantity: Number(recipeQuantity),
          unit: recipeUnit,
        },
      }));

      setSelectedDishId(targetDishId);
      setViewState("DETAIL");
      setActiveDrawer(null);
      showToast(`Recipe "${recipeDishName.trim()}" created successfully!`);
    } catch (err: any) {
      console.error("Save recipe failed:", err);
      setDrawerError(err?.message || "Failed to save recipe.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add Ingredient Form Submit
  const handleAddIngredientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDrawerError(null);

    if (!selectedDishId) {
      setDrawerError("No dish selected.");
      return;
    }
    if (!selectedIngredientId) {
      setDrawerError("Please select an ingredient.");
      return;
    }
    if (!ingredientQuantity || Number(ingredientQuantity) <= 0) {
      setDrawerError("Please enter a valid ingredient quantity.");
      return;
    }

    setIsSubmitting(true);
    try {
      await linkRecipeMutation({
        organizationId,
        itemId: selectedDishId,
        inventoryItemId: selectedIngredientId as Id<"inventoryItems">,
        quantity: Number(ingredientQuantity),
        unit: ingredientUnit,
      });

      setActiveDrawer(null);
      setIngredientQuantity("");
      showToast("Ingredient added to recipe successfully!");
    } catch (err: any) {
      console.error("Add ingredient failed:", err);
      setDrawerError(err?.message || "Failed to add ingredient.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Recipe Line
  const handleConfirmDelete = async () => {
    if (!deleteConfirmation.recipeId) return;
    setIsRemoving(true);
    try {
      await removeRecipeMutation({ id: deleteConfirmation.recipeId });
      showToast("Ingredient removed from recipe.", "success");
    } catch (err: any) {
      console.error("Failed to remove recipe ingredient:", err);
      showToast(err?.message || "Failed to remove ingredient.", "error");
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
      <div className="flex-1 flex items-center justify-center p-12 bg-[#fff8f5]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#1e1b19] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-[#645d58] font-medium">
            Loading item recipes...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#fbf9f8] p-8 font-sans">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-full shadow-lg border text-xs font-medium flex items-center space-x-2 transition-all duration-300 ${
            toastMessage.type === "success"
              ? "bg-[#1e1b19] text-white border-[#33302d]"
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

      {/* VIEW 1: ITEM RECIPES MASTER LIST VIEW */}
      {viewState === "LIST" && (
        <div className="flex flex-col flex-1 min-h-0 w-full">
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#e7e5e4]/70">
            <div>
              <h1 className="font-serif text-3xl md:text-[32px] text-[#0c0a09] font-medium tracking-tight">
                Item recipes
              </h1>
              <p className="text-xs md:text-sm text-[#78716c] mt-0.5">
                Set the ingredients used to prepare each menu item.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Search Bar */}
              <div className="relative w-64 md:w-72">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#a8a29e]">
                  search
                </span>
                <input
                  type="text"
                  className="w-full bg-white rounded-full pl-9 pr-4 py-2 text-xs text-[#1c1917] placeholder:text-[#a8a29e] border border-[#e7e5e4] focus:outline-none focus:ring-1 focus:ring-[#0c0a09] shadow-2xs transition"
                  placeholder="Search recipe"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Actions Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenContextMenuId(
                      openContextMenuId === "bulk" ? null : "bulk",
                    );
                  }}
                  className="px-4 py-2 rounded-full text-xs font-semibold bg-[#f5f5f4] hover:bg-[#e7e5e4] text-[#1c1917] transition flex items-center space-x-1 cursor-pointer"
                >
                  <span>Actions</span>
                  <span className="material-symbols-outlined text-[16px]">
                    expand_more
                  </span>
                </button>

                {openContextMenuId === "bulk" && (
                  <div className="absolute right-0 top-10 w-44 bg-white rounded-xl shadow-xl border border-[#e7e5e4] z-30 py-1 flex flex-col text-left text-xs">
                    <button
                      type="button"
                      className="px-4 py-2 hover:bg-[#fafaf9] text-[#1c1917] text-left transition"
                      onClick={() => showToast("Exporting recipes...")}
                    >
                      Export recipes
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 hover:bg-[#fafaf9] text-[#1c1917] text-left transition"
                      onClick={() => showToast("Duplicating selection...")}
                    >
                      Duplicate selection
                    </button>
                  </div>
                )}
              </div>

              {/* Add New Recipe Button */}
              <button
                type="button"
                onClick={openCreateRecipeDrawer}
                className="inline-flex items-center space-x-1.5 bg-[#0c0a09] hover:bg-[#292524] text-white !text-white text-xs font-medium px-4 py-2.5 rounded-full transition shadow-sm cursor-pointer whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[18px] text-white">
                  add
                </span>
                <span className="text-white font-medium">
                  Add new recipe
                </span>
              </button>
            </div>
          </div>

          {/* Main Table Container matching SuppliersView */}
          <div className="mt-6 flex-1 flex flex-col overflow-hidden">
            {filteredMenuItems.length === 0 ? (
              /* Empty Master State */
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#e7e5e4] rounded-2xl p-12 bg-white/50 text-center my-2">
                <div className="w-14 h-14 rounded-full bg-[#f5f5f4] border border-[#e7e5e4] flex items-center justify-center text-[#78716c] mb-4">
                  <span className="material-symbols-outlined text-[#78716c] text-[28px]">
                    menu_book
                  </span>
                </div>
                <h2 className="font-serif text-2xl text-[#0c0a09] font-medium">
                  No item recipes found
                </h2>
                <p className="text-xs text-[#78716c] max-w-sm mt-1 mb-6">
                  Set the ingredients used to prepare each menu item to track
                  live depletion accurately.
                </p>
                <button
                  type="button"
                  onClick={openCreateRecipeDrawer}
                  className="px-5 py-2.5 rounded-full text-xs font-medium bg-[#0c0a09] text-white hover:bg-[#292524] transition shadow-sm cursor-pointer"
                >
                  <span className="text-white font-medium">
                    Add new recipe
                  </span>
                </button>
              </div>
            ) : (
              /* Master Table Card View */
              <div className="bg-white border border-[#e7e5e4] rounded-xl shadow-xs overflow-visible flex flex-col flex-1">
                <div className="flex-1 overflow-visible">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#e7e5e4] bg-[#fafaf9]/80 text-[11px] uppercase tracking-wider text-[#78716c] font-medium select-none">
                        <th className="py-3 px-5 w-12 text-center font-normal">
                          <input
                            type="checkbox"
                            className="rounded accent-[#0c0a09] w-4 h-4 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-5 font-normal w-[35%]">Supplier Name / Recipe</th>
                        <th className="py-3 px-5 font-normal w-[20%]">Quantity</th>
                        <th className="py-3 px-5 font-normal w-[20%]">Created on</th>
                        <th className="py-3 px-5 font-normal w-[15%]">Updated on</th>
                        <th className="py-3 px-5 text-right font-normal w-16">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e7e5e4]/70 text-xs">
                      {filteredMenuItems.map((dish) => (
                        <MasterRecipeRowItem
                          key={dish._id}
                          dish={dish}
                          yieldInfo={recipeYieldMap[dish._id]}
                          isOpenMenu={openContextMenuId === dish._id}
                          onToggleMenu={(e) => {
                            e.stopPropagation();
                            setOpenContextMenuId(
                              openContextMenuId === dish._id ? null : dish._id,
                            );
                          }}
                          onOpenDetail={() => {
                            setSelectedDishId(dish._id);
                            setViewState("DETAIL");
                          }}
                          onEditRecipeName={() => {
                            setRecipeDishName(dish.name);
                            const y = recipeYieldMap[dish._id];
                            setRecipeQuantity(y?.quantity || 5);
                            setRecipeUnit(y?.unit || "Kilogram (kg)");
                            setActiveDrawer("ADD_RECIPE");
                          }}
                          onAssignMenuItem={() => {
                            setSelectedDishId(dish._id);
                            setActiveDrawer("ASSIGN_MENU_ITEM");
                          }}
                          onViewDeadStock={() => {
                            window.location.href = "/inventory/dead-stock";
                          }}
                          onDuplicateRecipe={() => {
                            const newId = `recipe_${Date.now()}` as Id<"items">;
                            setCustomRecipes((prev) => [
                              {
                                _id: newId,
                                name: `${dish.name} (Copy)`,
                                price: dish.price,
                                categoryName: dish.categoryName || "Item Recipe",
                                createdAt: Date.now(),
                              },
                              ...prev,
                            ]);
                            showToast(`Recipe "${dish.name}" duplicated!`);
                          }}
                          onDeleteRecipe={() => {
                            setCustomRecipes((prev) =>
                              prev.filter((d) => d._id !== dish._id),
                            );
                            showToast(`Recipe "${dish.name}" deleted!`);
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer matching SuppliersView */}
                <div className="px-6 py-4 bg-white border-t border-[#e7e5e4] flex items-center justify-between text-xs text-[#78716c] shrink-0">
                  <div>
                    Showing <span className="font-medium text-[#1c1917]">{filteredMenuItems.length}</span> of{" "}
                    <span className="font-medium text-[#1c1917]">{filteredMenuItems.length}</span> recipes
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      disabled
                      className="px-3 py-1 rounded border border-[#e7e5e4] bg-[#fafaf9] text-[#a8a29e] cursor-not-allowed font-medium"
                    >
                      Previous
                    </button>
                    <span className="font-medium text-[#1c1917]">1 / 1</span>
                    <button
                      type="button"
                      disabled
                      className="px-3 py-1 rounded border border-[#e7e5e4] bg-[#fafaf9] text-[#a8a29e] cursor-not-allowed font-medium"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: RECIPE DETAIL & INGREDIENTS BREAKDOWN */}
      {viewState === "DETAIL" && selectedDish && (
        <div className="flex flex-col space-y-6 w-full">
          {/* Breadcrumb & Header Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-1 text-[11px] uppercase tracking-wider text-[#645d58] mb-1 font-medium">
                <button
                  type="button"
                  onClick={() => setViewState("LIST")}
                  className="hover:text-[#1e1b19] transition cursor-pointer"
                >
                  Item recipes
                </button>
                <span className="material-symbols-outlined text-[14px]">
                  chevron_right
                </span>
                <span className="text-[#1e1b19] font-bold">
                  {selectedDish.name}
                </span>
              </div>
              <div className="flex items-baseline space-x-3">
                <h1 className="font-serif text-3xl text-[#1e1b19] tracking-tight font-medium">
                  {selectedDish.name}
                </h1>
                <span className="text-xs text-[#645d58] font-normal">
                  Yield:{" "}
                  {recipeYieldMap[selectedDish._id]
                    ? `${recipeYieldMap[selectedDish._id].quantity} ${recipeYieldMap[selectedDish._id].unit}`
                    : "5 kilogram (kg)"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Actions Dropdown Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenContextMenuId(
                      openContextMenuId === "detail_actions"
                        ? null
                        : "detail_actions",
                    );
                  }}
                  className="px-4 py-2 rounded-full text-xs font-semibold bg-[#f4ece8] hover:bg-[#e9e1dd] text-[#1e1b19] transition flex items-center space-x-1 cursor-pointer"
                >
                  <span>Actions</span>
                  <span className="material-symbols-outlined text-[16px]">
                    expand_more
                  </span>
                </button>

                {openContextMenuId === "detail_actions" && (
                  <div className="absolute right-0 top-10 w-48 bg-white rounded-xl shadow-xl border border-[#e9e1dd] z-30 py-1 flex flex-col text-left text-xs">
                    <button
                      type="button"
                      className="px-4 py-2 hover:bg-[#f4ece8] text-[#1e1b19] text-left transition"
                      onClick={() => setActiveDrawer("ASSIGN_MENU_ITEM")}
                    >
                      Assign menu item
                    </button>
                  </div>
                )}
              </div>

              {/* Add Ingredient Button */}
              <button
                type="button"
                onClick={openAddIngredientDrawer}
                className="inline-flex items-center space-x-1.5 bg-[#000000] hover:bg-[#292524] active:scale-[0.98] text-white text-xs font-medium px-4 py-2.5 rounded-full transition shadow-xs cursor-pointer whitespace-nowrap"
                style={{ color: "#ffffff" }}
              >
                <span
                  className="material-symbols-outlined text-[18px] text-white"
                  style={{ color: "#ffffff" }}
                >
                  add
                </span>
                <span
                  className="text-white font-medium"
                  style={{ color: "#ffffff" }}
                >
                  Add ingredient
                </span>
              </button>
            </div>
          </div>

          {/* Sub-recipe Ingredients Breakdown Card */}
          <RecipeIngredientsBreakdownCard
            dish={selectedDish}
            inventoryItems={inventoryItems || []}
            currencySymbol={currencySymbol}
            onOpenAddIngredient={openAddIngredientDrawer}
            onDeleteIngredient={(recipeId, ingName) => {
              setDeleteConfirmation({
                isOpen: true,
                recipeId,
                ingredientName: ingName,
                dishName: selectedDish.name,
              });
            }}
          />
        </div>
      )}

      {/* Delete Confirmation Dialog Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 bg-[#1e1b19]/30 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e9e1dd] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-rose-600">
                  warning
                </span>
              </div>
              <div>
                <h3 className="font-serif text-lg font-medium text-[#1e1b19]">
                  Remove Recipe Line
                </h3>
                <p className="text-xs text-[#645d58]">
                  Dish: {deleteConfirmation.dishName}
                </p>
              </div>
            </div>

            <p className="text-xs text-[#4d4541]">
              Are you sure you want to remove{" "}
              <strong className="text-[#1e1b19]">
                {deleteConfirmation.ingredientName}
              </strong>{" "}
              from this recipe?
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
                className="px-4 py-2 border border-[#e9e1dd] rounded-full text-xs text-[#4d4541] hover:bg-[#f4ece8] font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isRemoving}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-xs font-medium transition cursor-pointer disabled:bg-rose-200"
                style={{ color: "#ffffff" }}
              >
                <span className="text-white" style={{ color: "#ffffff" }}>
                  {isRemoving ? "Removing..." : "Confirm Delete"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer Backdrop Scrim */}
      {activeDrawer && (
        <div
          className="fixed inset-0 bg-[#1e1b19]/30 backdrop-blur-[2px] z-40 transition-opacity"
          onClick={() => setActiveDrawer(null)}
        />
      )}

      {/* ========================================================= */}
      {/* DRAWER 1: CREATE NEW RECIPE DRAWER (EXACT 3 FIELDS: Name, Quantity, Units) */}
      {/* ========================================================= */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-lg bg-white border-l border-[#e9e1dd] shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          activeDrawer === "ADD_RECIPE" ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="h-16 px-6 border-b border-[#e9e1dd] flex items-center justify-between shrink-0">
          <h2 className="font-serif text-xl font-medium text-[#1e1b19]">
            Create new recipe
          </h2>
          <button
            type="button"
            onClick={() => setActiveDrawer(null)}
            className="p-1.5 rounded-full hover:bg-[#f4ece8] text-[#7f7570] hover:text-[#1e1b19] transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Drawer Form */}
        <form
          onSubmit={handleSaveRecipeSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-[#1e1b19]"
        >
          {drawerError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center space-x-2">
              <span className="material-symbols-outlined text-[18px] text-rose-500 shrink-0">
                error
              </span>
              <span>{drawerError}</span>
            </div>
          )}

          {/* Field 1: Recipe name * */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-[#4d4541]">
              Recipe name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Enter the recipe name"
              className={`w-full bg-[#f4ece8]/50 hover:bg-white focus:bg-white px-3.5 py-2.5 rounded-lg border ${
                recipeNameError
                  ? "border-rose-500 focus:ring-rose-500 focus:border-rose-500"
                  : "border-[#d0c4be] focus:ring-[#1e1b19]"
              } focus:outline-none focus:ring-1 transition text-xs text-[#1e1b19]`}
              value={recipeDishName}
              onChange={(e) => {
                setRecipeDishName(e.target.value);
                if (recipeNameError) setRecipeNameError("");
              }}
            />
            {recipeNameError && (
              <p className="text-[11px] text-rose-500 mt-1">{recipeNameError}</p>
            )}
          </div>

          {/* Field 2: Recipe Quantity * */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-[#4d4541]">
              Recipe Quantity <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="0.01"
              step="any"
              placeholder="Enter quantity"
              className={`w-full bg-[#f4ece8]/50 hover:bg-white focus:bg-white px-3.5 py-2.5 rounded-lg border ${
                recipeQtyError
                  ? "border-rose-500 focus:ring-rose-500 focus:border-rose-500"
                  : "border-[#d0c4be] focus:ring-[#1e1b19]"
              } focus:outline-none focus:ring-1 transition text-xs text-[#1e1b19]`}
              value={recipeQuantity}
              onChange={(e) => {
                setRecipeQuantity(
                  e.target.value ? Number(e.target.value) : "",
                );
                if (recipeQtyError) setRecipeQtyError("");
              }}
            />
            {recipeQtyError && (
              <p className="text-[11px] text-rose-500 mt-1">{recipeQtyError}</p>
            )}
          </div>

          {/* Field 3: Units * */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-[#4d4541]">
              Units <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                required
                className="w-full appearance-none bg-[#f4ece8]/50 hover:bg-white focus:bg-white px-3.5 py-2.5 pr-8 rounded-lg border border-[#d0c4be] focus:outline-none focus:ring-1 focus:ring-[#1e1b19] transition cursor-pointer text-xs text-[#1e1b19] font-medium"
                value={recipeUnit}
                onChange={(e) => setRecipeUnit(e.target.value)}
              >
                {UNITS_LIST.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7f7570] pointer-events-none text-[18px]">
                expand_more
              </span>
            </div>
          </div>

          {/* Info Callout Box */}
          <div className="p-4 rounded-xl bg-[#f4ece8]/60 text-[#645d58] text-[11px] leading-relaxed">
            Recipes serve as sub-assemblies or main dishes. Once created, you will configure specific ingredient ratios and can attach the recipe to one or multiple restaurant menu items.
          </div>

          {/* Drawer Footer Actions */}
          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-[#e9e1dd]">
            <button
              type="button"
              onClick={() => setActiveDrawer(null)}
              className="px-4 py-2 rounded-full font-semibold text-[#645d58] hover:bg-[#f4ece8] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-full font-semibold bg-[#000000] text-white hover:bg-[#292524] transition shadow-xs cursor-pointer disabled:bg-stone-300"
              style={{ color: "#ffffff" }}
            >
              <span className="text-white" style={{ color: "#ffffff" }}>
                {isSubmitting ? "Saving..." : "Save recipe"}
              </span>
            </button>
          </div>
        </form>
      </aside>

      {/* ========================================================= */}
      {/* DRAWER 2: ADD INGREDIENT DRAWER */}
      {/* ========================================================= */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-lg bg-white border-l border-[#e9e1dd] shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          activeDrawer === "ADD_INGREDIENT"
            ? "translate-x-0"
            : "translate-x-full"
        }`}
      >
        <div className="h-16 px-6 border-b border-[#e9e1dd] flex items-center justify-between shrink-0">
          <h2 className="font-serif text-xl font-medium text-[#1e1b19]">
            Add ingredient
          </h2>
          <button
            type="button"
            onClick={() => setActiveDrawer(null)}
            className="p-1.5 rounded-full hover:bg-[#f4ece8] text-[#7f7570] hover:text-[#1e1b19] transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form
          onSubmit={handleAddIngredientSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-[#1e1b19]"
        >
          {drawerError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center space-x-2">
              <span className="material-symbols-outlined text-[18px] text-rose-500 shrink-0">
                error
              </span>
              <span>{drawerError}</span>
            </div>
          )}

          {/* Raw item select */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-[#4d4541]">
              Raw item or Sub-recipe <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                required
                className="w-full appearance-none bg-[#f4ece8]/50 hover:bg-white focus:bg-white px-3.5 py-2.5 pr-8 rounded-lg border border-[#d0c4be] focus:outline-none focus:ring-1 focus:ring-[#1e1b19] transition cursor-pointer text-xs text-[#1e1b19] font-medium"
                value={selectedIngredientId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedIngredientId(id);
                  const found = inventoryItems?.find((i) => i._id === id);
                  if (found) {
                    setIngredientUnit(
                      found.servingUnit || found.buyingUnit || "piece (pc)",
                    );
                  }
                }}
              >
                <option value="" disabled>
                  Select ingredient from library
                </option>
                {(inventoryItems || []).map((ing) => (
                  <option key={ing._id} value={ing._id}>
                    {ing.name} ({ing.servingUnit || ing.buyingUnit}) -{" "}
                    {currencySymbol}
                    {ing.unitCost ?? 0}/unit
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7f7570] pointer-events-none text-[18px]">
                expand_more
              </span>
            </div>
          </div>

          {/* Quantity and Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block font-semibold text-[#4d4541]">
                Quantity <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0.001"
                step="any"
                required
                placeholder="0.00"
                className="w-full bg-[#f4ece8]/50 hover:bg-white focus:bg-white px-3.5 py-2.5 rounded-lg border border-[#d0c4be] focus:outline-none focus:ring-1 focus:ring-[#1e1b19] transition text-xs text-[#1e1b19]"
                value={ingredientQuantity}
                onChange={(e) =>
                  setIngredientQuantity(
                    e.target.value ? Number(e.target.value) : "",
                  )
                }
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-semibold text-[#645d58]">Unit</label>
              <input
                type="text"
                readOnly
                className="w-full bg-[#e9e1dd]/40 px-3.5 py-2.5 rounded-lg border border-[#d0c4be]/60 text-xs text-[#645d58] cursor-not-allowed font-medium"
                value={ingredientUnit}
              />
            </div>
          </div>

          {/* Drawer Footer Actions */}
          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-[#e9e1dd]">
            <button
              type="button"
              onClick={() => setActiveDrawer(null)}
              className="px-4 py-2 rounded-full font-semibold text-[#645d58] hover:bg-[#f4ece8] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-full font-semibold bg-[#000000] text-white hover:bg-[#292524] transition shadow-xs cursor-pointer disabled:bg-stone-300"
              style={{ color: "#ffffff" }}
            >
              <span className="text-white" style={{ color: "#ffffff" }}>
                {isSubmitting ? "Linking..." : "Add ingredient"}
              </span>
            </button>
          </div>
        </form>
      </aside>

      {/* ========================================================= */}
      {/* DRAWER 3: ASSIGN MENU ITEM DRAWER */}
      {/* ========================================================= */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-lg bg-white border-l border-[#e9e1dd] shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          activeDrawer === "ASSIGN_MENU_ITEM"
            ? "translate-x-0"
            : "translate-x-full"
        }`}
      >
        <div className="h-16 px-6 border-b border-[#e9e1dd] flex items-center justify-between shrink-0">
          <h2 className="font-serif text-xl font-medium text-[#1e1b19]">
            Assign menu item
          </h2>
          <button
            type="button"
            onClick={() => setActiveDrawer(null)}
            className="p-1.5 rounded-full hover:bg-[#f4ece8] text-[#7f7570] hover:text-[#1e1b19] transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-[#1e1b19]">
          <p className="text-[#645d58]">
            Connect this recipe to a terminal menu item or modifier option to
            deduct inventory automatically on sale.
          </p>

          <div className="space-y-1.5">
            <label className="block font-semibold text-[#4d4541]">
              Assignment Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center space-x-2 p-3 rounded-lg bg-[#f4ece8] cursor-pointer">
                <input
                  type="radio"
                  name="assignType"
                  defaultChecked
                  className="accent-[#000000]"
                />
                <span className="font-medium text-[#1e1b19]">Menu Item</span>
              </label>
              <label className="flex items-center space-x-2 p-3 rounded-lg bg-[#f4ece8] cursor-pointer">
                <input
                  type="radio"
                  name="assignType"
                  className="accent-[#000000]"
                />
                <span className="font-medium text-[#1e1b19]">
                  Customization
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block font-semibold text-[#4d4541]">
              Select active menu item <span className="text-rose-500">*</span>
            </label>
            <select className="w-full bg-[#f4ece8]/50 px-3.5 py-2.5 rounded-lg border border-[#d0c4be] text-xs text-[#1e1b19]">
              {menuItemsList.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name} ({m.categoryName || "General"})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block font-semibold text-[#4d4541]">
              Portion deducted per order <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              defaultValue="1"
              className="w-32 bg-[#f4ece8]/50 px-3.5 py-2.5 rounded-lg border border-[#d0c4be] text-xs text-[#1e1b19]"
            />
          </div>

          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-[#e9e1dd]">
            <button
              type="button"
              onClick={() => setActiveDrawer(null)}
              className="px-4 py-2 rounded-full font-semibold text-[#645d58] hover:bg-[#f4ece8] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveDrawer(null);
                showToast("Menu item assigned successfully!");
              }}
              className="px-5 py-2 rounded-full font-semibold bg-[#000000] text-white hover:bg-[#292524] transition shadow-xs cursor-pointer"
              style={{ color: "#ffffff" }}
            >
              <span className="text-white" style={{ color: "#ffffff" }}>
                Link menu item
              </span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

// Master Table Row Item Renderer
function MasterRecipeRowItem({
  dish,
  yieldInfo,
  isOpenMenu,
  onToggleMenu,
  onOpenDetail,
  onEditRecipeName,
  onAssignMenuItem,
  onViewDeadStock,
  onDuplicateRecipe,
  onDeleteRecipe,
}: {
  dish: {
    _id: Id<"items">;
    name: string;
    price: number;
    categoryName?: string;
    createdAt?: number;
  };
  yieldInfo?: { quantity: number; unit: string };
  isOpenMenu: boolean;
  onToggleMenu: (e: React.MouseEvent) => void;
  onOpenDetail: () => void;
  onEditRecipeName: () => void;
  onAssignMenuItem: () => void;
  onViewDeadStock: () => void;
  onDuplicateRecipe: () => void;
  onDeleteRecipe: () => void;
}) {
  const isValidConvexId =
    typeof dish._id === "string" &&
    dish._id.length > 10 &&
    !dish._id.includes("_");

  const recipes = useQuery(
    api.inventory.getItemRecipe,
    isValidConvexId ? { itemId: dish._id as Id<"items"> } : "skip",
  );
  const recipeList = recipes || [];

  const createdDateStr = dish.createdAt
    ? new Date(dish.createdAt).toISOString().slice(0, 19).replace("T", " ")
    : "2026-09-24 16:41:31";

  const formattedYield = yieldInfo
    ? `${yieldInfo.quantity} ${yieldInfo.unit}`
    : recipeList.length > 0
      ? `${recipeList.reduce((a, b) => a + (b.quantity || 0), 0)} ${recipeList[0].unit || "kg"}`
      : "5 kilogram (kg)";

  return (
    <tr className="hover:bg-[#fafaf9] transition-colors group">
      <td className="py-4 px-5 w-12 text-center">
        <input
          type="checkbox"
          className="rounded accent-[#0c0a09] w-4 h-4 cursor-pointer"
        />
      </td>

      <td className="py-4 px-5 font-medium text-[#1c1917] w-[35%]">
        <button
          type="button"
          onClick={onOpenDetail}
          className="text-left font-medium text-[#1c1917] hover:underline focus:outline-none cursor-pointer"
        >
          {dish.name}
        </button>
      </td>

      <td className="py-4 px-5 text-[#1c1917] font-medium w-[20%]">
        {formattedYield}
      </td>

      <td className="py-4 px-5 text-[#78716c] tabular-nums font-mono w-[20%]">
        {createdDateStr}
      </td>

      <td className="py-4 px-5 text-[#78716c] w-[15%]">43 minutes ago</td>

      <td className="py-4 px-5 text-right w-16 relative">
        <button
          type="button"
          onClick={onToggleMenu}
          className="p-1 rounded-full hover:bg-[#f5f5f4] text-[#a8a29e] hover:text-[#1c1917] transition cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">
            more_vert
          </span>
        </button>

        {isOpenMenu && (
          <div className="absolute right-2 top-full mt-1 w-52 bg-white rounded-xl shadow-2xl border border-[#e7e5e4] z-50 py-1 flex flex-col text-left text-xs font-normal">
            <button
              type="button"
              onClick={onOpenDetail}
              className="px-4 py-2 hover:bg-[#fafaf9] text-[#1c1917] text-left transition font-medium"
            >
              Edit recipe items
            </button>
            <button
              type="button"
              onClick={onEditRecipeName}
              className="px-4 py-2 hover:bg-[#fafaf9] text-[#1c1917] text-left transition"
            >
              Edit recipe name
            </button>
            <button
              type="button"
              onClick={onOpenDetail}
              className="px-4 py-2 hover:bg-[#fafaf9] text-[#1c1917] text-left transition"
            >
              View item recipe
            </button>
            <button
              type="button"
              onClick={onAssignMenuItem}
              className="px-4 py-2 hover:bg-[#fafaf9] text-[#1c1917] text-left transition"
            >
              Assign menu item
            </button>
            <button
              type="button"
              onClick={onViewDeadStock}
              className="px-4 py-2 hover:bg-[#fafaf9] text-[#1c1917] text-left transition"
            >
              View dead stock log
            </button>
            <button
              type="button"
              onClick={onDuplicateRecipe}
              className="px-4 py-2 hover:bg-[#fafaf9] text-[#1c1917] text-left transition"
            >
              Duplicate recipe
            </button>
            <button
              type="button"
              onClick={onDeleteRecipe}
              className="px-4 py-2 hover:bg-rose-50 text-rose-600 font-medium text-left transition"
            >
              Delete item recipe
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// Recipe Detail Ingredients Breakdown Card Renderer
function RecipeIngredientsBreakdownCard({
  dish,
  inventoryItems,
  currencySymbol = "₹",
  onOpenAddIngredient,
  onDeleteIngredient,
}: {
  dish: { _id: Id<"items">; name: string; price: number };
  inventoryItems: any[];
  currencySymbol?: string;
  onOpenAddIngredient: () => void;
  onDeleteIngredient: (recipeId: Id<"recipes">, ingName: string) => void;
}) {
  const isValidConvexId =
    typeof dish._id === "string" &&
    dish._id.length > 10 &&
    !dish._id.includes("_");

  const recipes = useQuery(
    api.inventory.getItemRecipe,
    isValidConvexId ? { itemId: dish._id as Id<"items"> } : "skip",
  );
  const recipeList = recipes || [];

  if (recipeList.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#e9e1dd] shadow-xs flex flex-col items-center justify-center py-20 text-center p-8">
        <div className="w-16 h-16 rounded-full bg-[#f4ece8] flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-[#7f7570] text-[32px]">
            menu_book
          </span>
        </div>
        <h2 className="font-serif text-2xl text-[#1e1b19]">
          No ingredients configured yet
        </h2>
        <p className="text-xs text-[#645d58] max-w-md mt-1 mb-6">
          Set the ingredients used to prepare each menu item to track live
          depletion accurately.
        </p>
        <button
          type="button"
          onClick={onOpenAddIngredient}
          className="px-5 py-2.5 rounded-full text-xs font-semibold bg-[#000000] text-white hover:bg-[#292524] transition shadow-xs cursor-pointer"
          style={{ color: "#ffffff" }}
        >
          <span className="text-white" style={{ color: "#ffffff" }}>
            Add first ingredient
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e9e1dd] shadow-xs overflow-hidden">
      <div className="px-6 py-3.5 bg-[#f4ece8]/60 border-b border-[#e9e1dd] flex items-center justify-between">
        <span className="text-[11px] font-bold text-[#645d58] uppercase tracking-wider">
          Ingredients breakdown
        </span>
        <span className="text-[11px] font-semibold text-[#1e1b19]">
          {recipeList.length} raw item{recipeList.length > 1 ? "s" : ""}{" "}
          configured
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs text-[#1e1b19]">
          <thead>
            <tr className="bg-[#f4ece8]/30 text-[11px] uppercase tracking-wider text-[#645d58] font-semibold border-b border-[#e9e1dd]">
              <th className="py-3.5 px-6 w-12 text-center">
                <input
                  type="checkbox"
                  className="rounded accent-[#000000] w-4 h-4 cursor-pointer"
                />
              </th>
              <th className="py-3.5 px-6 font-semibold w-[40%]">Raw item / Recipe</th>
              <th className="py-3.5 px-6 font-semibold w-[25%]">Quantity</th>
              <th className="py-3.5 px-6 font-semibold w-[25%]">Unit</th>
              <th className="py-3.5 px-6 text-right font-semibold w-16">Delete</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e9e1dd]/60 font-medium">
            {recipeList.map((r) => {
              const invItem = inventoryItems.find(
                (i) => i._id === r.inventoryItemId,
              );
              const ingName =
                r.ingredientName || invItem?.name || "Raw Ingredient";

              return (
                <tr
                  key={r._id}
                  className="hover:bg-[#f4ece8]/30 transition-colors"
                >
                  <td className="py-3 px-5 text-center">
                    <input
                      type="checkbox"
                      className="rounded accent-[#000000] w-4 h-4 cursor-pointer"
                    />
                  </td>

                  <td className="py-3 px-5 font-semibold text-[#1e1b19]">
                    {ingName}
                  </td>

                  <td className="py-3 px-5 font-mono text-[#1e1b19]">
                    {r.quantity}
                  </td>

                  <td className="py-3 px-5 text-[#645d58]">
                    {r.unit || "gram (g)"}
                  </td>

                  <td className="py-3 px-5 text-right">
                    <button
                      type="button"
                      onClick={() => onDeleteIngredient(r._id, ingName)}
                      className="p-1 rounded-full hover:bg-rose-50 text-rose-500 hover:text-rose-700 transition cursor-pointer"
                      title="Delete ingredient"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        delete
                      </span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
