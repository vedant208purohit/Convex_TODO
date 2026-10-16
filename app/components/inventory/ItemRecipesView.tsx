"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { getCurrencyForCountry, formatStoreDateTime } from "@/lib/constants/countries";

function isValidConvexId(id: any): boolean {
  return typeof id === "string" && id.length > 10 && !id.startsWith("recipe_");
}

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
  const router = useRouter();
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
  const deleteRecipeDishMutation = useMutation(api.inventory.deleteRecipeDish);
  const duplicateRecipeDishMutation = useMutation(api.inventory.duplicateRecipeDish);
  const updateItemMutation = useMutation(api.menu.updateItem);
  const createItemMutation = useMutation(api.menu.createItem);
  const assignRecipeMutation = useMutation(api.inventory.assignRecipeToMenuItem);
  const unassignRecipeMutation = useMutation(api.inventory.unassignRecipeFromMenuItem);

  // Customization Options extracted from menuData for Modifier Mapping (safe, zero network errors)
  const customizationOptions = useMemo(() => {
    const list: Array<{ _id: string; name: string; groupName: string; price: number }> = [];
    if (menuData && Array.isArray(menuData)) {
      for (const cat of menuData) {
        if (cat.items && Array.isArray(cat.items)) {
          for (const item of cat.items) {
            if (item.customizations && Array.isArray(item.customizations)) {
              for (const cust of item.customizations) {
                if (cust.items && Array.isArray(cust.items)) {
                  for (const ci of cust.items) {
                    if (!list.some((existing) => existing._id === ci._id)) {
                      list.push({
                        _id: ci._id,
                        name: ci.name,
                        groupName: cust.name || "Modifier",
                        price: ci.price || 0,
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    return list;
  }, [menuData]);

  // View Navigation State ("LIST" Master View vs "DETAIL" Ingredients View)
  const [viewState, setViewState] = useState<"LIST" | "DETAIL">("LIST");
  const [selectedDishId, setSelectedDishId] = useState<Id<"items"> | null>(
    null,
  );

  // Recipe Mapped Menu Items & Modifiers Query
  const recipeAssignments = useQuery(
    api.inventory.getRecipeAssignments,
    selectedDishId && typeof selectedDishId === "string" && !selectedDishId.startsWith("recipe_")
      ? { organizationId, sourceRecipeItemId: selectedDishId as Id<"items"> }
      : "skip"
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

  // Editing existing recipe ID (null when creating new recipe)
  const [editingDishId, setEditingDishId] = useState<Id<"items"> | null>(null);

  // Row Selection State for Bulk Actions (Select All / Delete Selection)
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<Set<string>>(new Set());

  // Deleted Recipe IDs State (synced with localStorage for instant deletion and persistence)
  const [deletedRecipeIds, setDeletedRecipeIds] = useState<string[]>([]);

  // Sync deleted recipes from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedDeleted = localStorage.getItem("pos_deleted_recipes");
      if (savedDeleted) {
        try {
          const parsed = JSON.parse(savedDeleted);
          if (Array.isArray(parsed)) {
            setDeletedRecipeIds(parsed);
          }
        } catch (e) {
          console.error("Error reading saved deleted recipes from localStorage:", e);
        }
      }
    }
  }, []);

  // Persist deletedRecipeIds to localStorage whenever updated
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pos_deleted_recipes", JSON.stringify(deletedRecipeIds));
    }
  }, [deletedRecipeIds]);

  // Context Menu State (3-dots popup)
  const [openContextMenuId, setOpenContextMenuId] = useState<string | null>(
    null,
  );

  // Active Drawer State
  const [activeDrawer, setActiveDrawer] = useState<
    "ADD_RECIPE" | "ADD_INGREDIENT" | "ASSIGN_MENU_ITEM" | null
  >(null);

  // 1. Create / Edit Recipe Drawer Form State (EXACT 3 FIELDS ONLY)
  const [recipeDishName, setRecipeDishName] = useState("");
  const [recipeQuantity, setRecipeQuantity] = useState<number | "">("");
  const [recipeUnit, setRecipeUnit] = useState("Kilogram (kg)");

  // 2. Add Ingredient Drawer Form State
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>("");
  const [ingredientQuantity, setIngredientQuantity] = useState<number | "">("");
  const [ingredientUnit, setIngredientUnit] = useState("piece (pc)");

  // 3. Assign Menu Item Drawer Form State
  const [assignType, setAssignType] = useState<"item" | "customization">("item");
  const [selectedTargetItemId, setSelectedTargetItemId] = useState<string>("");
  const [selectedTargetCustId, setSelectedTargetCustId] = useState<string>("");
  const [portionMultiplier, setPortionMultiplier] = useState<number>(1);
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  // Submission & Error State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [recipeNameError, setRecipeNameError] = useState("");
  const [recipeQtyError, setRecipeQtyError] = useState("");

  // Delete Dialog Modal State (matching Menu modal styling and full impact factor)
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    mode: "SINGLE_RECIPE" | "BULK_RECIPES" | "INGREDIENT";
    dishName?: string;
    dishId?: Id<"items">;
    count?: number;
    ingredientId?: Id<"recipes">;
    ingredientName?: string;
  }>({
    isOpen: false,
    mode: "SINGLE_RECIPE",
  });
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Extract Combined Menu Dishes List (filtering out deleted recipes)
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

    const deletedSet = new Set(deletedRecipeIds);

    // 1. First add custom recipes created in recipe manager
    for (const item of customRecipes) {
      if (!deletedSet.has(item._id)) {
        map.set(item._id, item);
      }
    }

    // 2. Add menu categories items
    if (menuData && Array.isArray(menuData)) {
      for (const cat of menuData) {
        if (cat.items && Array.isArray(cat.items)) {
          for (const item of cat.items) {
            if (!deletedSet.has(item._id) && !map.has(item._id)) {
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
        if (!deletedSet.has(item._id) && !map.has(item._id)) {
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
  }, [menuData, allMenuItemsRaw, customRecipes, deletedRecipeIds]);

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

  // Selection Logic
  const isAllSelected =
    filteredMenuItems.length > 0 &&
    filteredMenuItems.every((d) => selectedRecipeIds.has(d._id));

  const isSomeSelected =
    selectedRecipeIds.size > 0 && !isAllSelected;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isAllSelected) {
      setSelectedRecipeIds(new Set());
    } else {
      setSelectedRecipeIds(new Set(filteredMenuItems.map((d) => d._id)));
    }
  };

  const handleToggleSelect = (dishId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedRecipeIds((prev) => {
      const next = new Set(prev);
      if (next.has(dishId)) {
        next.delete(dishId);
      } else {
        next.add(dishId);
      }
      return next;
    });
  };

  // Export Recipes to CSV Handler
  const handleExportRecipes = () => {
    const itemsToExport =
      selectedRecipeIds.size > 0
        ? filteredMenuItems.filter((d) => selectedRecipeIds.has(d._id))
        : filteredMenuItems;

    if (itemsToExport.length === 0) {
      showToast("No recipes to export.", "error");
      return;
    }

    const headers = [
      "Recipe Name",
      "Quantity / Yield",
      "Category",
      "Created On",
    ];

    const rows = itemsToExport.map((dish) => {
      const yieldObj = recipeYieldMap[dish._id];
      const yieldStr = yieldObj
        ? `${yieldObj.quantity} ${yieldObj.unit}`
        : "5 kilogram (kg)";
      const createdDate = dish.createdAt
        ? formatStoreDateTime(
            dish.createdAt,
            activeOrg?.country,
            activeOrg?.organizationTimeZone,
          )
        : "—";

      return [
        `"${(dish.name || "").replace(/"/g, '""')}"`,
        `"${yieldStr}"`,
        `"${(dish.categoryName || "General").replace(/"/g, '""')}"`,
        `"${createdDate}"`,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `item_recipes_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setOpenContextMenuId(null);
    showToast(`Exported ${itemsToExport.length} recipe(s) to CSV!`);
  };

  // Trigger Bulk Delete Selected Recipes Dialog
  const handleOpenBulkDeleteDialog = () => {
    if (selectedRecipeIds.size === 0) {
      showToast("Please select at least one recipe to delete.", "error");
      return;
    }
    setOpenContextMenuId(null);
    setDeleteDialog({
      isOpen: true,
      mode: "BULK_RECIPES",
      count: selectedRecipeIds.size,
    });
  };

  // Trigger Single Recipe Delete Dialog
  const handleOpenSingleDeleteDialog = (dish: {
    _id: Id<"items">;
    name: string;
  }) => {
    setOpenContextMenuId(null);
    setDeleteDialog({
      isOpen: true,
      mode: "SINGLE_RECIPE",
      dishId: dish._id,
      dishName: dish.name,
    });
  };

  // Confirm and Execute Deletion from Modal Dialog
  const handleConfirmDeleteDialog = async () => {
    setIsDeleting(true);
    try {
      if (deleteDialog.mode === "SINGLE_RECIPE" && deleteDialog.dishId) {
        const dishId = deleteDialog.dishId;
        const dishName = deleteDialog.dishName || "Recipe";

        // 1. Remove from local customRecipes
        setCustomRecipes((prev) => prev.filter((d) => d._id !== dishId));
        // 2. Add to deletedRecipeIds so it vanishes immediately from combined list
        setDeletedRecipeIds((prev) => [...new Set([...prev, dishId])]);
        // 3. Deselect if selected
        setSelectedRecipeIds((prev) => {
          const next = new Set(prev);
          next.delete(dishId);
          return next;
        });

        // 4. Delete database records if Convex ID
        if (isValidConvexId(dishId)) {
          try {
            await deleteRecipeDishMutation({ itemId: dishId as Id<"items"> });
          } catch (e) {
            console.warn("Delete recipe dish error:", e);
          }
        }

        showToast(`Recipe "${dishName}" deleted successfully!`);
      } else if (deleteDialog.mode === "BULK_RECIPES") {
        const count = selectedRecipeIds.size;
        const idsToDelete = Array.from(selectedRecipeIds);

        // 1. Remove from local customRecipes
        setCustomRecipes((prev) =>
          prev.filter((d) => !selectedRecipeIds.has(d._id)),
        );
        // 2. Add to deletedRecipeIds
        setDeletedRecipeIds((prev) => [...new Set([...prev, ...idsToDelete])]);

        // 3. Delete database records for valid Convex IDs
        for (const id of idsToDelete) {
          if (isValidConvexId(id)) {
            try {
              await deleteRecipeDishMutation({ itemId: id as Id<"items"> });
            } catch (e) {
              console.warn("Delete recipe dish error for", id, e);
            }
          }
        }

        setSelectedRecipeIds(new Set());
        showToast(`${count} recipe(s) deleted successfully!`);
      } else if (deleteDialog.mode === "INGREDIENT" && deleteDialog.ingredientId) {
        await removeRecipeMutation({ id: deleteDialog.ingredientId });
        showToast(`"${deleteDialog.ingredientName || "Ingredient"}" removed from recipe.`);
      }

      setDeleteDialog({ isOpen: false, mode: "SINGLE_RECIPE" });
    } catch (err: any) {
      console.error("Deletion failed:", err);
      showToast(err?.message || "Failed to delete.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Duplicate Recipe Handler
  const handleDuplicateRecipe = async (dish: {
    _id: Id<"items">;
    name: string;
    price: number;
    categoryName?: string;
  }) => {
    const copyName = `${dish.name} (Copy)`;
    const existingYield = recipeYieldMap[dish._id] || {
      quantity: 5,
      unit: "Kilogram (kg)",
    };

    let newDishId: Id<"items">;
    if (isValidConvexId(dish._id)) {
      try {
        const res = await duplicateRecipeDishMutation({
          organizationId,
          sourceItemId: dish._id as Id<"items">,
          newName: copyName,
        });
        newDishId = res.newItemId;
      } catch (e) {
        console.warn("Convex duplicate fallback:", e);
        newDishId = `recipe_${Date.now()}` as Id<"items">;
      }
    } else {
      newDishId = `recipe_${Date.now()}` as Id<"items">;
    }

    setCustomRecipes((prev) => [
      {
        _id: newDishId,
        name: copyName,
        price: dish.price,
        categoryName: dish.categoryName || "Item Recipe",
        createdAt: Date.now(),
      },
      ...prev,
    ]);

    setRecipeYieldMap((prev) => ({
      ...prev,
      [newDishId]: { ...existingYield },
    }));

    setOpenContextMenuId(null);
    showToast(`Recipe "${dish.name}" duplicated as "${copyName}"!`);
  };

  // Open Create Recipe Drawer
  const openCreateRecipeDrawer = () => {
    setDrawerError(null);
    setEditingDishId(null);
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

  // Handle Save Recipe Submit (Supporting both Edit and Create)
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
      // 1. If editing existing recipe, update name & yield
      if (editingDishId) {
        const updatedName = recipeDishName.trim();
        const updatedQty = Number(recipeQuantity) || 5;
        const updatedUnit = recipeUnit;

        setCustomRecipes((prev) =>
          prev.map((x) =>
            x._id === editingDishId ? { ...x, name: updatedName } : x,
          ),
        );

        setRecipeYieldMap((prev) => ({
          ...prev,
          [editingDishId]: {
            quantity: updatedQty,
            unit: updatedUnit,
          },
        }));

        if (isValidConvexId(editingDishId)) {
          try {
            await updateItemMutation({
              id: editingDishId as Id<"items">,
              name: updatedName,
            });
          } catch (dbErr) {
            console.warn("Backend updateItem error:", dbErr);
          }
        }

        setEditingDishId(null);
        setActiveDrawer(null);
        showToast(`Recipe "${updatedName}" updated successfully!`);
        return;
      }

      // 2. Otherwise creating a new recipe
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
      let activeItemId = selectedDishId;
      if (
        typeof activeItemId === "string" &&
        (activeItemId.startsWith("recipe_") || !activeItemId)
      ) {
        const dishName = selectedDish?.name || "Recipe Item";
        const createdId = await createItemMutation({
          organizationId,
          name: dishName,
          price: 0,
          published: true,
          isAvailable: true,
        });
        activeItemId = createdId;
        setSelectedDishId(createdId);
      }

      const dishYield = recipeYieldMap[selectedDishId] || {
        quantity: 1,
        unit: "Portion",
      };

      await linkRecipeMutation({
        organizationId,
        itemId: activeItemId as Id<"items">,
        inventoryItemId: selectedIngredientId as Id<"inventoryItems">,
        quantity: Number(ingredientQuantity),
        unit: ingredientUnit,
        yield: dishYield.quantity,
        yieldUnit: dishYield.unit,
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



  // Handle Assign Menu Item / Modifier Submit
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDishId) return;

    let activeSourceItemId = selectedDishId;
    if (
      typeof activeSourceItemId === "string" &&
      activeSourceItemId.startsWith("recipe_")
    ) {
      const dishName = selectedDish?.name || "Recipe Item";
      const createdId = await createItemMutation({
        organizationId,
        name: dishName,
        price: 0,
        published: true,
        isAvailable: true,
      });
      activeSourceItemId = createdId;
      setSelectedDishId(createdId);
    }

    if (assignType === "item" && !selectedTargetItemId) {
      alert("Please select a target menu item.");
      return;
    }
    if (assignType === "customization" && !selectedTargetCustId) {
      alert("Please select a target modifier option.");
      return;
    }

    setIsAssigning(true);
    try {
      await assignRecipeMutation({
        organizationId,
        sourceRecipeItemId: activeSourceItemId as Id<"items">,
        targetItemId:
          assignType === "item"
            ? (selectedTargetItemId as Id<"items">)
            : undefined,
        targetCustomizationItemId:
          assignType === "customization"
            ? (selectedTargetCustId as Id<"customizationItems">)
            : undefined,
        portionMultiplier: Number(portionMultiplier) || 1,
      });
      setActiveDrawer(null);
      setSelectedTargetItemId("");
      setSelectedTargetCustId("");
      setPortionMultiplier(1);
      showToast("Menu item linked to recipe successfully!");
    } catch (err: any) {
      console.error("Failed to assign recipe:", err);
      alert(err?.message || "Failed to link recipe.");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassign = async (assignmentId: Id<"recipeAssignments">) => {
    try {
      await unassignRecipeMutation({ id: assignmentId });
      showToast("Mapping removed.");
    } catch (err: any) {
      console.error("Failed to unassign:", err);
      alert(err?.message || "Failed to remove mapping.");
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
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
                Item recipes
              </h1>
              <p className="text-xs text-stone-500 mt-1">
                Set the ingredients used to prepare each menu item.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Search Bar */}
              <div className="relative w-64 md:w-72">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-stone-400">
                  search
                </span>
                <input
                  type="text"
                  className="w-full bg-white rounded-lg pl-9 pr-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 border border-[#e7e5e4] focus:outline-none focus:border-stone-800 shadow-2xs transition"
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
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-[#e7e5e4] hover:bg-stone-50 text-stone-700 shadow-2xs transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <span>Actions</span>
                  {selectedRecipeIds.size > 0 && (
                    <span className="bg-stone-900 text-white text-[10px] px-1.5 py-0.2 rounded-md font-mono">
                      {selectedRecipeIds.size}
                    </span>
                  )}
                  <span className="material-symbols-outlined text-[16px]">
                    expand_more
                  </span>
                </button>

                {openContextMenuId === "bulk" && (
                  <div className="absolute right-0 top-10 w-48 bg-white rounded-lg shadow-lg border border-[#e7e5e4] z-30 py-1 flex flex-col text-left text-xs">
                    <button
                      type="button"
                      className="px-4 py-2 hover:bg-stone-50 text-stone-800 text-left transition font-medium flex items-center justify-between cursor-pointer"
                      onClick={handleExportRecipes}
                    >
                      <span>Export recipes</span>
                      {selectedRecipeIds.size > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-stone-100 rounded text-stone-600 font-mono">
                          {selectedRecipeIds.size}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 hover:bg-rose-50 text-rose-600 text-left transition font-medium flex items-center justify-between cursor-pointer"
                      onClick={handleOpenBulkDeleteDialog}
                    >
                      <span>Delete selection</span>
                      {selectedRecipeIds.size > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded font-mono">
                          {selectedRecipeIds.size}
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Add New Recipe Button */}
              <button
                type="button"
                onClick={openCreateRecipeDrawer}
                className="inline-flex items-center space-x-1.5 bg-stone-900 hover:bg-stone-800 text-white !text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow-2xs cursor-pointer whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[18px] text-white">
                  add
                </span>
                <span>Add new recipe</span>
              </button>
            </div>
          </div>

          {/* Main Table Container matching PO & Item Library */}
          <div className="mt-6 flex-1 flex flex-col">
            {filteredMenuItems.length === 0 ? (
              /* Empty Master State */
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#e7e5e4] rounded-2xl p-12 bg-white/50 text-center my-2">
                <div className="w-14 h-14 rounded-full bg-[#f5f5f4] border border-[#e7e5e4] flex items-center justify-center text-stone-500 mb-4">
                  <span className="material-symbols-outlined text-stone-500 text-[28px]">
                    menu_book
                  </span>
                </div>
                <h2 className="text-xl font-bold text-stone-900">
                  No item recipes found
                </h2>
                <p className="text-xs text-stone-500 max-w-sm mt-1 mb-6">
                  Set the ingredients used to prepare each menu item to track
                  live depletion accurately.
                </p>
                <button
                  type="button"
                  onClick={openCreateRecipeDrawer}
                  className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 transition shadow-2xs cursor-pointer"
                >
                  <span>Add new recipe</span>
                </button>
              </div>
            ) : (
              /* Master Table Card View */
              <div className="bg-white border border-[#e7e5e4] rounded-xl shadow-2xs overflow-hidden flex flex-col flex-1">
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#e7e5e4] bg-[#fafaf9] text-[11px] font-semibold uppercase tracking-wider text-[#78716c] select-none">
                        <th className="py-3 px-5 w-12 text-center">
                          <input
                            type="checkbox"
                            checked={isAllSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = isSomeSelected;
                            }}
                            onChange={handleSelectAll}
                            className="rounded accent-stone-900 w-4 h-4 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-5 font-semibold w-[35%]">Supplier Name / Recipe</th>
                        <th className="py-3 px-5 font-semibold w-[20%]">Quantity</th>
                        <th className="py-3 px-5 font-semibold w-[20%]">Created on</th>
                        <th className="py-3 px-5 font-semibold w-[15%]">Updated on</th>
                        <th className="py-3 px-5 text-right font-semibold w-16">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f5f5f4] text-xs">
                      {filteredMenuItems.map((dish) => (
                        <MasterRecipeRowItem
                          key={dish._id}
                          dish={dish}
                          country={activeOrg?.country}
                          timezone={activeOrg?.organizationTimeZone}
                          yieldInfo={recipeYieldMap[dish._id]}
                          isSelected={selectedRecipeIds.has(dish._id)}
                          onToggleSelect={() => handleToggleSelect(dish._id)}
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
                            setEditingDishId(dish._id);
                            setRecipeDishName(dish.name);
                            const y = recipeYieldMap[dish._id];
                            setRecipeQuantity(y?.quantity ?? 5);
                            setRecipeUnit(y?.unit ?? "Kilogram (kg)");
                            setRecipeNameError("");
                            setRecipeQtyError("");
                            setDrawerError(null);
                            setActiveDrawer("ADD_RECIPE");
                          }}
                          onAssignMenuItem={() => {
                            setSelectedDishId(dish._id);
                            setActiveDrawer("ASSIGN_MENU_ITEM");
                          }}
                          onViewDeadStock={() => {
                            router.push("/inventory/dead-stock");
                          }}
                          onDuplicateRecipe={() => handleDuplicateRecipe(dish)}
                          onDeleteRecipe={() => handleOpenSingleDeleteDialog(dish)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer matching PO & Suppliers */}
                <div className="py-3.5 px-5 bg-[#fafaf9]/60 border-t border-[#e7e5e4] flex items-center justify-between text-xs text-[#78716c] shrink-0">
                  <span>
                    Showing <strong className="text-stone-900">{filteredMenuItems.length}</strong> of{" "}
                    <strong className="text-stone-900">{filteredMenuItems.length}</strong> recipes
                  </span>
                  <div className="flex items-center space-x-2 text-xs">
                    <button
                      type="button"
                      disabled
                      className="px-3 py-1 border border-[#e7e5e4] rounded-lg bg-white text-stone-800 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs font-medium"
                    >
                      Previous
                    </button>
                    <span className="px-2 font-medium text-stone-900">1 / 1</span>
                    <button
                      type="button"
                      disabled
                      className="px-3 py-1 border border-[#e7e5e4] rounded-lg bg-white text-stone-800 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs font-medium"
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
                <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
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

          {/* Assigned Menu Items Card */}
          <div className="mb-6 p-5 bg-white rounded-2xl border border-[#e9e1dd] shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="font-semibold text-xs text-[#1e1b19] uppercase tracking-wider flex items-center space-x-2">
                  <span>Assigned Menu Items</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f4ece8] text-[#1e1b19]">
                    {recipeAssignments?.length || 0}
                  </span>
                </h3>
                <p className="text-[11px] text-[#645d58] mt-0.5">
                  When any of these assigned menu items or modifiers are ordered at POS, this recipe's ingredients are automatically deducted.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedTargetItemId(menuItemsList[0]?._id || "");
                  setSelectedTargetCustId(customizationOptions?.[0]?._id || "");
                  setActiveDrawer("ASSIGN_MENU_ITEM");
                }}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#1e1b19] hover:bg-[#292524] text-white !text-white transition shadow-2xs cursor-pointer shrink-0 self-start sm:self-auto"
              >
                <span className="material-symbols-outlined text-[16px] text-white">link</span>
                <span className="text-white">Assign menu item</span>
              </button>
            </div>

            {(!recipeAssignments || recipeAssignments.length === 0) ? (
              <div className="p-3.5 bg-[#fbf9f8] rounded-xl border border-dashed border-[#e9e1dd] text-center text-xs text-[#78716c]">
                No menu items assigned yet. Click <strong className="text-[#1e1b19]">"Assign menu item"</strong> to attach this recipe formula to one or multiple POS dishes or modifiers.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {recipeAssignments.map((a) => (
                  <div
                    key={a._id}
                    className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#fafaf9] border border-[#e7e5e4] text-xs font-medium text-[#1c1917]"
                  >
                    <span className="text-[13px]">
                      {a.targetType === "MenuItem" ? "🍽️" : "✨"}
                    </span>
                    <span className="font-semibold">{a.targetName}</span>
                    <span className="text-[10px] text-stone-600 font-mono bg-stone-200/60 px-1.5 py-0.5 rounded font-semibold">
                      {a.portionMultiplier}x portion
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUnassign(a._id)}
                      className="text-stone-400 hover:text-rose-600 transition p-0.5 cursor-pointer ml-1"
                      title="Remove assignment"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sub-recipe Ingredients Breakdown Card */}
          <RecipeIngredientsBreakdownCard
            dish={selectedDish}
            inventoryItems={inventoryItems || []}
            currencySymbol={currencySymbol}
            onOpenAddIngredient={openAddIngredientDrawer}
            onDeleteIngredient={(recipeId, ingName) => {
              setDeleteDialog({
                isOpen: true,
                mode: "INGREDIENT",
                ingredientId: recipeId,
                ingredientName: ingName,
                dishName: selectedDish.name,
              });
            }}
          />
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: DELETE CONFIRMATION (MATCHING MENU PRESET DESIGN WITH FULL FACTOR BREAKDOWN) */}
      {/* ---------------------------------------------------- */}
      {deleteDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-sans animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => {
              if (!isDeleting) {
                setDeleteDialog((prev) => ({ ...prev, isOpen: false }));
              }
            }}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 z-10 space-y-4 border border-stone-200">
            {/* Warning Icon Badge */}
            <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px] text-rose-600">
                warning
              </span>
            </div>

            {/* Title & Description */}
            <div>
              <h4 className="text-base font-bold text-stone-900">
                {deleteDialog.mode === "SINGLE_RECIPE" && "Delete recipe?"}
                {deleteDialog.mode === "BULK_RECIPES" &&
                  `Delete ${deleteDialog.count} recipes?`}
                {deleteDialog.mode === "INGREDIENT" &&
                  "Remove ingredient from recipe?"}
              </h4>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                {deleteDialog.mode === "SINGLE_RECIPE" && (
                  <>
                    Are you sure you want to delete the recipe for{" "}
                    <strong className="text-stone-900">
                      {deleteDialog.dishName}
                    </strong>
                    ?
                  </>
                )}
                {deleteDialog.mode === "BULK_RECIPES" && (
                  <>
                    Are you sure you want to delete{" "}
                    <strong className="text-stone-900">
                      {deleteDialog.count} selected recipes
                    </strong>
                    ?
                  </>
                )}
                {deleteDialog.mode === "INGREDIENT" && (
                  <>
                    Are you sure you want to remove{" "}
                    <strong className="text-stone-900">
                      {deleteDialog.ingredientName}
                    </strong>{" "}
                    from{" "}
                    <strong className="text-stone-900">
                      {deleteDialog.dishName}
                    </strong>
                    ?
                  </>
                )}
              </p>
            </div>

            {/* "What will happen:" Factor Callout Box */}
            <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3.5 space-y-2 text-xs text-stone-700">
              <div className="font-semibold text-stone-900 flex items-center space-x-1.5">
                <span className="material-symbols-outlined text-[16px] text-amber-600">
                  info
                </span>
                <span>What will happen:</span>
              </div>
              <ul className="space-y-1 text-stone-600 list-disc list-inside text-[11px] leading-relaxed">
                {deleteDialog.mode === "SINGLE_RECIPE" && (
                  <>
                    <li>
                      All ingredient formulas and batch ratios for this recipe will be unlinked.
                    </li>
                    <li>
                      Automatic stock depletion will stop when this item or its assigned POS menu items are ordered.
                    </li>
                    <li>
                      Any menu item or modifier assignments linked to this recipe will be unmapped.
                    </li>
                    <li className="text-rose-600 font-medium">
                      This action cannot be undone.
                    </li>
                  </>
                )}
                {deleteDialog.mode === "BULK_RECIPES" && (
                  <>
                    <li>
                      All {deleteDialog.count} selected recipes and their ingredient formulas will be removed.
                    </li>
                    <li>
                      Automatic inventory deduction will stop for all menu items and modifiers mapped to these recipes.
                    </li>
                    <li>
                      All linked POS menu item and modifier assignments will be unmapped.
                    </li>
                    <li className="text-rose-600 font-medium">
                      This action cannot be undone.
                    </li>
                  </>
                )}
                {deleteDialog.mode === "INGREDIENT" && (
                  <>
                    <li>
                      This ingredient will be removed from the formula of {deleteDialog.dishName}.
                    </li>
                    <li>
                      Stock for this ingredient will no longer be deducted when this recipe is ordered.
                    </li>
                    <li className="text-rose-600 font-medium">
                      This action cannot be undone.
                    </li>
                  </>
                )}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() =>
                  setDeleteDialog((prev) => ({ ...prev, isOpen: false }))
                }
                className="px-4 py-2 border border-stone-300 text-stone-700 bg-white hover:bg-stone-50 rounded-full text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDialog}
                disabled={isDeleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                style={{ color: "#ffffff" }}
              >
                {isDeleting && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span className="text-white" style={{ color: "#ffffff" }}>
                  {isDeleting
                    ? "Deleting..."
                    : deleteDialog.mode === "SINGLE_RECIPE"
                      ? "Delete recipe"
                      : deleteDialog.mode === "BULK_RECIPES"
                        ? "Delete selection"
                        : "Remove ingredient"}
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
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">
            {editingDishId ? "Edit recipe name" : "Create new recipe"}
          </h2>
          <button
            type="button"
            onClick={() => {
              setActiveDrawer(null);
              setEditingDishId(null);
            }}
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
              onClick={() => {
                setActiveDrawer(null);
                setEditingDishId(null);
              }}
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
                {isSubmitting
                  ? editingDishId
                    ? "Updating..."
                    : "Saving..."
                  : editingDishId
                    ? "Update recipe"
                    : "Save recipe"}
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
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">
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
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">
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

        <form
          onSubmit={handleAssignSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-[#1e1b19]"
        >
          <p className="text-[#645d58]">
            Connect this recipe formula to a terminal menu item or modifier option to
            deduct inventory automatically upon order completion.
          </p>

          <div className="space-y-1.5">
            <label className="block font-semibold text-[#4d4541]">
              Assignment Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center space-x-2 p-3 rounded-lg cursor-pointer border transition ${
                  assignType === "item"
                    ? "bg-stone-100 border-stone-800 font-semibold"
                    : "bg-[#f4ece8] border-transparent"
                }`}
              >
                <input
                  type="radio"
                  name="assignType"
                  checked={assignType === "item"}
                  onChange={() => setAssignType("item")}
                  className="accent-[#000000]"
                />
                <span className="text-[#1e1b19]">Menu Item</span>
              </label>
              <label
                className={`flex items-center space-x-2 p-3 rounded-lg cursor-pointer border transition ${
                  assignType === "customization"
                    ? "bg-stone-100 border-stone-800 font-semibold"
                    : "bg-[#f4ece8] border-transparent"
                }`}
              >
                <input
                  type="radio"
                  name="assignType"
                  checked={assignType === "customization"}
                  onChange={() => setAssignType("customization")}
                  className="accent-[#000000]"
                />
                <span className="text-[#1e1b19]">
                  Modifier / Add-on
                </span>
              </label>
            </div>
          </div>

          {assignType === "item" ? (
            <div className="space-y-1.5">
              <label className="block font-semibold text-[#4d4541]">
                Select target menu item <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={selectedTargetItemId}
                onChange={(e) => setSelectedTargetItemId(e.target.value)}
                className="w-full bg-[#f4ece8]/50 px-3.5 py-2.5 rounded-lg border border-[#d0c4be] text-xs text-[#1e1b19] font-medium"
              >
                <option value="">Select menu dish</option>
                {menuItemsList.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name} ({m.categoryName || "General"})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="block font-semibold text-[#4d4541]">
                Select target modifier option <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={selectedTargetCustId}
                onChange={(e) => setSelectedTargetCustId(e.target.value)}
                className="w-full bg-[#f4ece8]/50 px-3.5 py-2.5 rounded-lg border border-[#d0c4be] text-xs text-[#1e1b19] font-medium"
              >
                <option value="">Select modifier option</option>
                {(customizationOptions || []).map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.groupName}: {c.name} (+{currencySymbol}{c.price})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block font-semibold text-[#4d4541]">
              Portion deducted per order <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0.01"
                step="any"
                required
                value={portionMultiplier}
                onChange={(e) =>
                  setPortionMultiplier(
                    e.target.value ? Number(e.target.value) : ("" as any)
                  )
                }
                className="w-32 bg-[#f4ece8]/50 px-3.5 py-2.5 rounded-lg border border-[#d0c4be] text-xs text-[#1e1b19] font-mono"
              />
              <span className="text-stone-500 text-xs font-medium">x portion</span>
            </div>
            <p className="text-[11px] text-stone-500">
              e.g. 1.0 for standard serving, 2.0 for large/double serving, 0.5 for half serving.
            </p>
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
              type="submit"
              disabled={isAssigning}
              className="px-5 py-2 rounded-full font-semibold bg-[#000000] text-white hover:bg-[#292524] transition shadow-xs cursor-pointer disabled:bg-stone-300"
              style={{ color: "#ffffff" }}
            >
              <span className="text-white" style={{ color: "#ffffff" }}>
                {isAssigning ? "Linking..." : "Link to recipe"}
              </span>
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

// Master Table Row Item Renderer
function MasterRecipeRowItem({
  dish,
  yieldInfo,
  country,
  timezone,
  isSelected,
  onToggleSelect,
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
  country?: string;
  timezone?: string;
  isSelected: boolean;
  onToggleSelect: () => void;
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
    ? formatStoreDateTime(dish.createdAt, country, timezone)
    : "—";

  const formattedYield = yieldInfo
    ? `${yieldInfo.quantity} ${yieldInfo.unit}`
    : recipeList.length > 0
      ? `${recipeList.reduce((a, b) => a + (b.quantity || 0), 0)} ${recipeList[0].unit || "kg"}`
      : "5 kilogram (kg)";

  return (
    <tr
      className={`hover:bg-[#fafaf9] transition-colors group ${
        isSelected ? "bg-stone-50/70" : ""
      }`}
    >
      <td
        className="py-3.5 px-5 w-12 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="rounded accent-stone-900 w-4 h-4 cursor-pointer"
        />
      </td>

      <td className="py-3.5 px-5 font-semibold text-stone-900 w-[35%]">
        <button
          type="button"
          onClick={onOpenDetail}
          className="text-left font-semibold text-stone-900 hover:underline focus:outline-none cursor-pointer"
        >
          {dish.name}
        </button>
      </td>

      <td className="py-3.5 px-5 text-stone-700 font-medium w-[20%]">
        {formattedYield}
      </td>

      <td className="py-3.5 px-5 text-stone-500 font-mono text-[11px] w-[20%]">
        {createdDateStr}
      </td>

      <td className="py-3.5 px-5 text-stone-500 text-[11px] w-[15%]">
        {createdDateStr}
      </td>

      <td className="py-3.5 px-5 text-right w-16 relative">
        <button
          type="button"
          onClick={onToggleMenu}
          className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-800 transition cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">
            more_vert
          </span>
        </button>

        {isOpenMenu && (
          <div className="absolute right-2 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-[#e7e5e4] z-50 py-1 flex flex-col text-left text-xs font-normal">
            <button
              type="button"
              onClick={onOpenDetail}
              className="px-4 py-2 hover:bg-stone-50 text-stone-800 text-left transition font-medium cursor-pointer"
            >
              Edit recipe items
            </button>
            <button
              type="button"
              onClick={onEditRecipeName}
              className="px-4 py-2 hover:bg-stone-50 text-stone-800 text-left transition cursor-pointer"
            >
              Edit recipe name
            </button>
            <button
              type="button"
              onClick={onOpenDetail}
              className="px-4 py-2 hover:bg-stone-50 text-stone-800 text-left transition cursor-pointer"
            >
              View item recipe
            </button>
            <button
              type="button"
              onClick={onAssignMenuItem}
              className="px-4 py-2 hover:bg-stone-50 text-stone-800 text-left transition cursor-pointer"
            >
              Assign menu item
            </button>
            <button
              type="button"
              onClick={onViewDeadStock}
              className="px-4 py-2 hover:bg-stone-50 text-stone-800 text-left transition cursor-pointer"
            >
              View dead stock log
            </button>
            <button
              type="button"
              onClick={onDuplicateRecipe}
              className="px-4 py-2 hover:bg-stone-50 text-stone-800 text-left transition cursor-pointer"
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
        <h2 className="text-xl font-bold text-stone-900">
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
