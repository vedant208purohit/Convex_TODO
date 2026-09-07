"use client";

interface CustomizationOption {
  _id: string;
  name: string;
  price: number;
  isAvailable: boolean;
}

interface ItemCustomization {
  _id: string;
  name: string;
  customizationType: "AddOns" | "Preparations";
  required: boolean;
  maxSelected: number;
  items: CustomizationOption[];
}



import { useState, useEffect, useMemo, type FormEvent } from "react";
import { useQuery, useMutation } from "convex/react";
import { PosShell } from "../components/PosShell";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

// ==========================================
// PIXEL-PERFECT SVG ICONS
// ==========================================

function EditPencilIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function PlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ChevronDownIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ChevronRightIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function DragHandleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

function CloseIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ImageIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function SparklesIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </svg>
  );
}

// Quantity Metric Options from defx-pos-frontend
const QUANTITY_UNITS = [
  { value: "g", label: "Grams (g)" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "ml", label: "Milliliters (ml)" },
  { value: "l", label: "Liters (L)" },
  { value: "pc", label: "Piece (pc)" },
  { value: "pcs", label: "Pieces (pcs)" },
  { value: "portion", label: "Portion" },
  { value: "can", label: "Can" },
  { value: "bottle", label: "Bottle" },
  { value: "box", label: "Box" },
];

// Dietary Item Types from defx-pos-frontend
const DIETARY_TYPES = [
  { id: "veg", label: "Vegetarian", icon: "🟢" },
  { id: "non_veg", label: "Non-Veg", icon: "🔴" },
  { id: "vegan", label: "Vegan", icon: "🌿" },
  { id: "jain", label: "Jain", icon: "🟡" },
  { id: "egg", label: "Contains Egg", icon: "🥚" },
];

// ==========================================
// MAIN MENU COMPONENT
// ==========================================

export default function MenuPage() {
  const organizations = useQuery(api.organizations.list);
  const organization = organizations?.[0] ?? null;

  // Tax & Currency Configuration
  const taxSettings = useQuery(
    api.taxation.getStoreTaxSettings,
    organization?._id ? { organizationId: organization._id } : "skip"
  );
  const currencySymbol = taxSettings?.currencySymbol || organization?.defaultCurrencySymbol || "₹";

  // Multi-Menu Queries & Mutations
  const menus = useQuery(
    api.menu.listMenus,
    organization?._id ? { organizationId: organization._id } : "skip"
  );
  const createMenuMutation = useMutation(api.menu.createMenu);
  const updateMenuMutation = useMutation(api.menu.updateMenu);
  const setDefaultMenuMutation = useMutation(api.menu.setDefaultMenu);
  const deleteMenuMutation = useMutation(api.menu.deleteMenu);
  const seedSampleMenuMutation = useMutation(api.menu.seedSampleMenu);

  // Category Mutations
  const createCategoryMutation = useMutation(api.menu.createCategory);
  const updateCategoryMutation = useMutation(api.menu.updateCategory);
  const toggleCategoryPublishedMutation = useMutation(api.menu.toggleCategoryPublished);
  const deleteCategoryMutation = useMutation(api.menu.deleteCategory);
  const reorderCategoriesMutation = useMutation(api.menu.reorderCategories);

  // Item Mutations
  const createItemMutation = useMutation(api.menu.createItem);
  const addCategoryItemMutation = useMutation(api.menu.addCategoryItem);
  const updateItemMutation = useMutation(api.menu.updateItem);
  const toggleItemAvailabilityMutation = useMutation(api.menu.toggleItemAvailability);
  const deleteItemMutation = useMutation(api.menu.deleteItem);
  const reorderCategoryItemsMutation = useMutation(api.menu.reorderCategoryItems);
  const addExistingItemToCategoryMutation = useMutation(api.menu.addExistingItemToCategory);

  // Customization Mutations
  const createCustomizationMutation = useMutation(api.menu.createCustomization);
  const updateCustomizationMutation = useMutation(api.menu.updateCustomization);
  const deleteCustomizationMutation = useMutation(api.menu.deleteCustomization);
  const createCustomizationItemMutation = useMutation(api.menu.createCustomizationItem);
  const deleteCustomizationItemMutation = useMutation(api.menu.deleteCustomizationItem);

  // All Existing Items Query
  const allExistingItems = useQuery(
    api.menu.listAllItems,
    organization?._id ? { organizationId: organization._id } : "skip"
  );

  // Active Menu State
  const [selectedMenuId, setSelectedMenuId] = useState<Id<"menus"> | null>(null);
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false);

  // Active Category State
  const [selectedCategoryId, setSelectedCategoryId] = useState<Id<"categories"> | null>(null);

  // Active Item State (Level 2 Customization Drilldown)
  const [selectedItemId, setSelectedItemId] = useState<Id<"items"> | null>(null);
  const [selectedCustId, setSelectedCustId] = useState<string | null>(null);

  // Modal / Drawer States
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [isEditMenuOpen, setIsEditMenuOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isAddItemDropdownOpen, setIsAddItemDropdownOpen] = useState(false);
  const [isAddExistingItemOpen, setIsAddExistingItemOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isAddCustomizationOpen, setIsAddCustomizationOpen] = useState(false);

  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);

  // Existing Item Selection State
  const [existingItemSearchQuery, setExistingItemSearchQuery] = useState("");
  const [selectedExistingItem, setSelectedExistingItem] = useState<any | null>(null);
  const [isAddingExistingItem, setIsAddingExistingItem] = useState(false);
  const [existingItemError, setExistingItemError] = useState<string | null>(null);

  // Drag & Drop State
  const [draggedCategoryIdx, setDraggedCategoryIdx] = useState<number | null>(null);
  const [draggedItemIdx, setDraggedItemIdx] = useState<number | null>(null);

  // Form States - Create Menu
  const [menuName, setMenuName] = useState("");
  const [menuDescription, setMenuDescription] = useState("");
  const [isCreatingMenu, setIsCreatingMenu] = useState(false);
  const [createMenuError, setCreateMenuError] = useState<string | null>(null);

  // Form States - Edit Menu
  const [editMenuName, setEditMenuName] = useState("");
  const [editMenuDescription, setEditMenuDescription] = useState("");
  const [isUpdatingMenu, setIsUpdatingMenu] = useState(false);

  // Form States - Add/Edit Category
  const [categoryName, setCategoryName] = useState("");
  const [categoryPublished, setCategoryPublished] = useState(true);
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Form States - Add/Edit Item
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemIsVeg, setItemIsVeg] = useState(true);
  const [selectedDietaryType, setSelectedDietaryType] = useState<string>("veg");
  const [itemIsSpicy, setItemIsSpicy] = useState(false);
  const [itemIsAvailable, setItemIsAvailable] = useState(true);
  const [itemShowQuantity, setItemShowQuantity] = useState(false);
  const [itemQuantity, setItemQuantity] = useState("");
  const [itemQuantityUnit, setItemQuantityUnit] = useState("g");
  const [itemIsGst, setItemIsGst] = useState(false);
  const [itemMarkAsBestseller, setItemMarkAsBestseller] = useState(false);
  const [itemSkuNumber, setItemSkuNumber] = useState("");
  const [itemSelectedCategoryId, setItemSelectedCategoryId] = useState<string>("");

  const [isSavingItem, setIsSavingItem] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

  // Form States - Add Customization
  const [custName, setCustName] = useState("");
  const [custType, setCustType] = useState<"AddOns" | "Preparations">("AddOns");
  const [custRequired, setCustRequired] = useState(false);
  const [custMaxSelected, setCustMaxSelected] = useState("1");
  const [custOptions, setCustOptions] = useState<Array<{ name: string; price: string }>>([
    { name: "", price: "0.00" },
  ]);
  const [isSavingCustomization, setIsSavingCustomization] = useState(false);

  // Form State - Inline Choice / Option Addition
  const [newChoiceName, setNewChoiceName] = useState("");
  const [newChoicePrice, setNewChoicePrice] = useState("0.00");
  const [isAddingChoice, setIsAddingChoice] = useState(false);

  // Auto-select active/default menu
  useEffect(() => {
    if (menus && menus.length > 0 && !selectedMenuId) {
      const defaultMenu = menus.find((m) => m.isDefault) || menus[0];
      setSelectedMenuId(defaultMenu._id);
    }
  }, [menus, selectedMenuId]);

  const activeMenu = useMemo(() => {
    return menus?.find((m) => m._id === selectedMenuId) || menus?.[0] || null;
  }, [menus, selectedMenuId]);

  // Query categories for active menu
  const categories = useQuery(
    api.menu.listCategories,
    activeMenu?._id ? { menuId: activeMenu._id } : "skip"
  );

  // Auto-select first category
  useEffect(() => {
    if (categories && categories.length > 0) {
      const exists = categories.some((c) => c._id === selectedCategoryId);
      if (!exists || !selectedCategoryId) {
        setSelectedCategoryId(categories[0]._id);
      }
    } else if (categories && categories.length === 0) {
      setSelectedCategoryId(null);
    }
  }, [categories, selectedCategoryId]);

  const activeCategory = useMemo(() => {
    return categories?.find((c) => c._id === selectedCategoryId) || categories?.[0] || null;
  }, [categories, selectedCategoryId]);

  // Query items for active category
  const categoryItems = useQuery(
    api.menu.listCategoryItems,
    activeCategory?._id ? { categoryId: activeCategory._id } : "skip"
  );

  // Active Item for Customization View
  const activeItem = useMemo(() => {
    if (!selectedItemId || !categoryItems) return null;
    const found = categoryItems.find((ci) => ci.item._id === selectedItemId);
    return found ? found.item : null;
  }, [categoryItems, selectedItemId]);

  // Full Menu Data Query (Includes nested items & customizations)
  const fullMenuData = useQuery(
    api.menu.getOrganizationMenu,
    organization?._id
      ? {
          organizationId: organization._id,
          menuId: activeMenu?._id,
        }
      : "skip"
  );

  // Derive Active Item Customizations
  const activeItemCustomizations: ItemCustomization[] = useMemo(() => {
    if (!fullMenuData || !selectedItemId) return [];
    for (const catWrapper of fullMenuData) {
      const itemsList = catWrapper.category?.items || [];
      const found = itemsList.find(
        (it: any) => it.item?.id === selectedItemId || it.item?._id === selectedItemId
      );
      if (found && found.customizations) {
        return found.customizations.map((cust: any) => ({
          _id: cust.id || cust._id,
          name: cust.name,
          customizationType: cust.type === "Add-Ons" || cust.customizationType === "AddOns" ? "AddOns" : "Preparations",
          required: cust.required ?? false,
          maxSelected: cust.max_selected ?? cust.maxSelected ?? 1,
          items: (cust.customization_items || cust.items || []).map((ci: any) => ({
            _id: ci.id || ci._id,
            name: ci.name,
            price: ci.price ?? 0,
            isAvailable: ci.is_available ?? ci.isAvailable ?? true,
          })),
        }));
      }
    }
    return [];
  }, [fullMenuData, selectedItemId]);

  // Auto-select first customization
  useEffect(() => {
    if (activeItemCustomizations && activeItemCustomizations.length > 0) {
      const exists = activeItemCustomizations.some((c) => c._id === selectedCustId);
      if (!exists || !selectedCustId) {
        setSelectedCustId(activeItemCustomizations[0]._id);
      }
    } else if (activeItemCustomizations && activeItemCustomizations.length === 0) {
      setSelectedCustId(null);
    }
  }, [activeItemCustomizations, selectedCustId]);

  const activeCustomization = useMemo(() => {
    return activeItemCustomizations?.find((c) => c._id === selectedCustId) || activeItemCustomizations?.[0] || null;
  }, [activeItemCustomizations, selectedCustId]);

  // Seed sample menu if none exists
  const handleSeedSample = async () => {
    if (!organization?._id) return;
    try {
      const newMenuId = await seedSampleMenuMutation({ organizationId: organization._id });
      setSelectedMenuId(newMenuId);
    } catch (err) {
      console.error("Failed to seed sample menu:", err);
    }
  };

  // Handle Drag & Drop for Categories
  const handleCategoryDragStart = (e: React.DragEvent, index: number) => {
    setDraggedCategoryIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCategoryDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedCategoryIdx === null || draggedCategoryIdx === targetIndex || !categories) return;

    const newCategories = [...categories];
    const [movedCat] = newCategories.splice(draggedCategoryIdx, 1);
    newCategories.splice(targetIndex, 0, movedCat);

    setDraggedCategoryIdx(null);
    try {
      await reorderCategoriesMutation({
        categoryIds: newCategories.map((c) => c._id),
      });
    } catch (err) {
      console.error("Failed to reorder categories:", err);
    }
  };

  // Handle Drag & Drop for Items
  const handleItemDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItemIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleItemDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedItemIdx === null || draggedItemIdx === targetIndex || !categoryItems) return;

    const newItems = [...categoryItems];
    const [movedItem] = newItems.splice(draggedItemIdx, 1);
    newItems.splice(targetIndex, 0, movedItem);

    setDraggedItemIdx(null);
    try {
      await reorderCategoryItemsMutation({
        categoryItemIds: newItems.map((ci) => ci.categoryItemId),
      });
    } catch (err) {
      console.error("Failed to reorder items:", err);
    }
  };

  // Handle Create Menu Submit
  const handleCreateMenuSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!organization?._id || !menuName.trim()) return;

    setIsCreatingMenu(true);
    setCreateMenuError(null);
    try {
      const newId = await createMenuMutation({
        organizationId: organization._id,
        name: menuName.trim(),
        description: menuDescription.trim() || undefined,
      });
      setSelectedMenuId(newId);
      setIsCreateMenuOpen(false);
      setMenuName("");
      setMenuDescription("");
    } catch (err: any) {
      setCreateMenuError(err.message || "Failed to create menu");
    } finally {
      setIsCreatingMenu(false);
    }
  };

  // Handle Edit Menu Submit
  const handleEditMenuSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeMenu?._id || !editMenuName.trim()) return;

    setIsUpdatingMenu(true);
    try {
      await updateMenuMutation({
        id: activeMenu._id,
        name: editMenuName.trim(),
        description: editMenuDescription.trim() || undefined,
      });
      setIsEditMenuOpen(false);
    } catch (err) {
      console.error("Failed to update menu:", err);
    } finally {
      setIsUpdatingMenu(false);
    }
  };

  const openEditMenuDrawer = () => {
    if (!activeMenu) return;
    setEditMenuName(activeMenu.name);
    setEditMenuDescription(activeMenu.description || "");
    setIsEditMenuOpen(true);
    setIsMenuDropdownOpen(false);
  };

  // Handle Add/Edit Category Submit
  const handleSaveCategorySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;

    setIsSavingCategory(true);
    try {
      if (editingCategory) {
        await updateCategoryMutation({
          id: editingCategory._id,
          name: categoryName.trim(),
          published: categoryPublished,
        });
      } else {
        if (!organization?._id || !activeMenu?._id) return;
        const newCatId = await createCategoryMutation({
          organizationId: organization._id,
          menuId: activeMenu._id,
          name: categoryName.trim(),
        });
        setSelectedCategoryId(newCatId);
      }
      setIsAddCategoryOpen(false);
      setEditingCategory(null);
      setCategoryName("");
      setCategoryPublished(true);
    } catch (err) {
      console.error("Failed to save category:", err);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleToggleCategory = async (e: React.MouseEvent, catId: Id<"categories">, currentPublished: boolean) => {
    e.stopPropagation();
    try {
      await toggleCategoryPublishedMutation({
        id: catId,
        published: !currentPublished,
      });
    } catch (err) {
      console.error("Failed to toggle category published status:", err);
    }
  };

  const handleDeleteCategory = async (e: React.MouseEvent, catId: Id<"categories">, name: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;
    try {
      await deleteCategoryMutation({ id: catId });
      if (selectedCategoryId === catId) {
        setSelectedCategoryId(null);
        setSelectedItemId(null);
      }
    } catch (err) {
      console.error("Failed to delete category:", err);
    }
  };

  // Open Add Item Mode
  const handleOpenAddNewItem = () => {
    setEditingItem(null);
    setItemName("");
    setItemPrice("");
    setItemDescription("");
    setItemIsVeg(true);
    setSelectedDietaryType("veg");
    setItemIsSpicy(false);
    setItemIsAvailable(true);
    setItemShowQuantity(false);
    setItemQuantity("");
    setItemQuantityUnit("g");
    setItemIsGst(false);
    setItemMarkAsBestseller(false);
    setItemSkuNumber("");
    setItemSelectedCategoryId(activeCategory?._id || "");
    setItemError(null);
    setIsAddItemOpen(true);
    setIsAddItemDropdownOpen(false);
  };

  // Open Edit Item Mode
  const handleOpenEditItem = (item: any) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemPrice((item.price / 100).toFixed(2));
    setItemDescription(item.description || "");
    setItemIsVeg(item.isVeg ?? true);
    setSelectedDietaryType(item.isVeg ? "veg" : "non_veg");
    setItemIsSpicy(item.isSpicy ?? false);
    setItemIsAvailable(item.isAvailable ?? true);
    setItemShowQuantity(item.showQuantity ?? false);
    setItemQuantity(item.quantity ? String(item.quantity) : "");
    setItemQuantityUnit(item.quantityUnit || "g");
    setItemIsGst(item.isGst ?? false);
    setItemMarkAsBestseller(item.markAsBestseller ?? false);
    setItemSkuNumber(item.skuNumber || "");
    setItemSelectedCategoryId(activeCategory?._id || "");
    setItemError(null);
    setIsAddItemOpen(true);
  };

  // Handle Add/Edit Item Submit
  const handleSaveItemSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!organization?._id || !itemName.trim() || !itemPrice) {
      setItemError("Please provide an item name and price.");
      return;
    }

    const priceNum = parseFloat(itemPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setItemError("Please enter a valid price.");
      return;
    }

    const priceCents = Math.round(priceNum * 100);
    const targetCatId = (itemSelectedCategoryId || activeCategory?._id) as Id<"categories">;

    if (!targetCatId && !editingItem) {
      setItemError("Please select or create a category first.");
      return;
    }

    setIsSavingItem(true);
    setItemError(null);

    try {
      const isVegBool = selectedDietaryType === "veg" || selectedDietaryType === "vegan" || selectedDietaryType === "jain";

      if (editingItem) {
        await updateItemMutation({
          id: editingItem._id,
          name: itemName.trim(),
          price: priceCents,
          description: itemDescription.trim() || undefined,
          isVeg: isVegBool,
          isSpicy: itemIsSpicy,
          isAvailable: itemIsAvailable,
          markAsBestseller: itemMarkAsBestseller,
        });
      } else {
        const newItemId = await createItemMutation({
          organizationId: organization._id,
          name: itemName.trim(),
          price: priceCents,
          description: itemDescription.trim() || undefined,
          isVeg: isVegBool,
          isSpicy: itemIsSpicy,
          isAvailable: itemIsAvailable,
          isGst: itemIsGst,
          markAsBestseller: itemMarkAsBestseller,
          showQuantity: itemShowQuantity,
          quantity: itemQuantity ? parseFloat(itemQuantity) : undefined,
          quantityUnit: itemQuantity ? itemQuantityUnit : undefined,
          skuNumber: itemSkuNumber.trim() || undefined,
        });

        await addCategoryItemMutation({
          organizationId: organization._id,
          categoryId: targetCatId,
          itemId: newItemId,
        });
        setSelectedItemId(newItemId);
      }

      setIsAddItemOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      setItemError(err.message || "Failed to save item");
    } finally {
      setIsSavingItem(false);
    }
  };

  // Handle Add Customization Group Submit
  const handleSaveCustomizationSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!organization?._id || !selectedItemId || !custName.trim()) return;

    setIsSavingCustomization(true);
    try {
      const custId = await createCustomizationMutation({
        organizationId: organization._id,
        itemId: selectedItemId,
        name: custName.trim(),
        customizationType: custType,
        required: custRequired,
        maxSelected: parseInt(custMaxSelected, 10) || 1,
      });

      // Insert initial options
      for (let i = 0; i < custOptions.length; i++) {
        const opt = custOptions[i];
        if (opt.name.trim()) {
          const optPrice = Math.round(parseFloat(opt.price || "0") * 100);
          await createCustomizationItemMutation({
            organizationId: organization._id,
            customizationId: custId,
            name: opt.name.trim(),
            price: optPrice,
            position: i,
          });
        }
      }

      setSelectedCustId(custId);
      setIsAddCustomizationOpen(false);
      setCustName("");
      setCustType("AddOns");
      setCustRequired(false);
      setCustMaxSelected("1");
      setCustOptions([{ name: "", price: "0.00" }]);
    } catch (err) {
      console.error("Failed to save customization:", err);
    } finally {
      setIsSavingCustomization(false);
    }
  };

  // Handle Add Option / Choice to Selected Customization
  const handleAddChoiceSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!organization?._id || !selectedCustId || !newChoiceName.trim()) return;

    setIsAddingChoice(true);
    try {
      const priceCents = Math.round(parseFloat(newChoicePrice || "0") * 100);
      await createCustomizationItemMutation({
        organizationId: organization._id,
        customizationId: selectedCustId as Id<"customizations">,
        name: newChoiceName.trim(),
        price: priceCents,
        position: (activeCustomization?.items?.length || 0) + 1,
      });
      setNewChoiceName("");
      setNewChoicePrice("0.00");
    } catch (err) {
      console.error("Failed to add choice:", err);
    } finally {
      setIsAddingChoice(false);
    }
  };

  const handleDeleteChoice = async (choiceId: string) => {
    try {
      await deleteCustomizationItemMutation({ id: choiceId as Id<"customizationItems"> });
    } catch (err) {
      console.error("Failed to delete option:", err);
    }
  };

  const handleDeleteCustomization = async (e: React.MouseEvent, custId: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete customization group "${name}"?`)) return;
    try {
      await deleteCustomizationMutation({ id: custId as Id<"customizations"> });
      if (selectedCustId === custId) {
        setSelectedCustId(null);
      }
    } catch (err) {
      console.error("Failed to delete customization:", err);
    }
  };

  // Handle Add Existing Item Drawer
  const handleOpenAddExistingItemDrawer = () => {
    setIsAddItemDropdownOpen(false);
    setSelectedExistingItem(null);
    setExistingItemSearchQuery("");
    setExistingItemError(null);
    setIsAddExistingItemOpen(true);
  };

  const handleAddExistingItemSubmit = async () => {
    if (!organization?._id || !activeCategory?._id || !selectedExistingItem) return;

    setIsAddingExistingItem(true);
    setExistingItemError(null);
    try {
      await addExistingItemToCategoryMutation({
        organizationId: organization._id,
        categoryId: activeCategory._id,
        itemId: selectedExistingItem._id,
      });
      setIsAddExistingItemOpen(false);
      setSelectedExistingItem(null);
    } catch (err: any) {
      setExistingItemError(err.message || "Failed to add existing item");
    } finally {
      setIsAddingExistingItem(false);
    }
  };

  const filteredExistingItems = useMemo(() => {
    if (!allExistingItems) return [];
    if (!existingItemSearchQuery.trim()) return allExistingItems;
    const query = existingItemSearchQuery.toLowerCase();
    return allExistingItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        (item.categoryName && item.categoryName.toLowerCase().includes(query))
    );
  }, [allExistingItems, existingItemSearchQuery]);

  const handleToggleItemAvailability = async (itemId: Id<"items">, currentAvailable: boolean) => {
    try {
      await toggleItemAvailabilityMutation({
        id: itemId,
        isAvailable: !currentAvailable,
      });
    } catch (err) {
      console.error("Failed to toggle item availability:", err);
    }
  };

  const handleDeleteItem = async (itemId: Id<"items">, itemNameStr: string) => {
    if (!confirm(`Are you sure you want to delete "${itemNameStr}"?`)) return;
    try {
      await deleteItemMutation({
        id: itemId,
        categoryId: activeCategory?._id,
      });
      if (selectedItemId === itemId) {
        setSelectedItemId(null);
      }
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  };

  const activeItemsCount = categoryItems?.filter((ci) => ci.item.isAvailable).length || 0;

  return (
    <PosShell title="Menu Management" subtitle="Catalog & Customizations">
      <div className="flex flex-col flex-1 min-w-0 pb-16">
        {/* ======================================================== */}
        {/* VIEW 1: FULL SCREEN ADD / EDIT ITEM                      */}
        {/* ======================================================== */}
        {isAddItemOpen ? (
          <div className="w-full flex-1 flex flex-col font-sans">
            {/* Top Workspace & Breadcrumb Header */}
            <div className="bg-[#fdf8f7] px-6 lg:px-8 py-6 border-b border-[#e7e5e4] shrink-0">
              <div className="flex flex-col md:flex-row md:items-end justify-between w-full gap-4">
                <div>
                  <nav className="flex items-center text-[13px] text-[#5e5e5e] mb-2 gap-2 font-sans">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddItemOpen(false);
                        setEditingItem(null);
                      }}
                      className="hover:text-[#141010] transition-colors cursor-pointer"
                    >
                      Menu
                    </button>
                    <ChevronRightIcon className="w-3.5 h-3.5" />
                    <span>{activeMenu?.name || "Main Menu"}</span>
                    <ChevronRightIcon className="w-3.5 h-3.5" />
                    <span>{activeCategory?.name || "Category"}</span>
                    <ChevronRightIcon className="w-3.5 h-3.5" />
                    <span className="text-[#141010] font-semibold">
                      {editingItem ? "Edit Item" : "Add New Item"}
                    </span>
                  </nav>
                  <h1 className="font-garamond text-[32px] md:text-[36px] text-[#0c0a09] font-normal leading-tight">
                    {editingItem ? "Edit Item" : "Add New Item"}
                  </h1>
                  <p className="text-[#5e5e5e] text-[14px] mt-1">
                    Configure details, media, dietary types, settings, and nutritional metrics.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddItemOpen(false);
                      setEditingItem(null);
                    }}
                    className="h-10 px-6 border border-[#e7e5e4] rounded-full text-[#141010] hover:bg-[#f1edec] transition-colors font-medium text-[15px] bg-transparent cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="item-details-form"
                    disabled={isSavingItem}
                    className="btn-primary h-10 px-8 rounded-full bg-[#0c0a09] text-white font-medium text-[15px] hover:opacity-90 transition-opacity shadow-sm cursor-pointer disabled:opacity-50"
                    style={{ color: "#ffffff", backgroundColor: "#0c0a09" }}
                  >
                    {isSavingItem ? "Saving..." : editingItem ? "Save Changes" : "Save & Create Item"}
                  </button>
                </div>
              </div>
            </div>

            {/* Two Column Form Grid */}
            <div className="w-full p-6 lg:p-8 flex-1">
              <form id="item-details-form" onSubmit={handleSaveItemSubmit}>
                {itemError && (
                  <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {itemError}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* Left Column (Forms) */}
                  <div className="lg:col-span-7 xl:col-span-8 space-y-8">
                    
                    {/* Card 1: Item Details */}
                    <div className="bg-white rounded-xl border border-[#e7e5e4] p-6 lg:p-8 shadow-sm space-y-6">
                      <h2 className="font-sans text-[20px] font-semibold text-[#0c0a09]">Item Details</h2>

                      {/* Image Upload Area */}
                      <div className="border-2 border-dashed border-[#d1c4c1] rounded-xl p-6 lg:p-8 flex flex-col items-center justify-center text-center bg-[#f7f3f2] hover:bg-[#f1edec] transition-colors cursor-pointer group">
                        <div className="w-16 h-16 rounded-full bg-[#f0efed] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform border border-[#e7e5e4]">
                          <ImageIcon className="w-7 h-7 text-[#141010]" />
                        </div>
                        <h3 className="font-medium text-[15px] text-[#0c0a09] mb-1">Click to upload item image</h3>
                        <p className="text-xs text-[#5e5e5e] mb-4">or drag and drop. Supports JPG, PNG, WEBP (Max 5MB)</p>
                      </div>

                      {/* Category & Search Code / SKU */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-[#0c0a09]">Category</label>
                          <div className="relative">
                            <select
                              value={itemSelectedCategoryId || activeCategory?._id || ""}
                              onChange={(e) => setItemSelectedCategoryId(e.target.value)}
                              className="w-full bg-white border border-[#e7e5e4] rounded-lg px-4 py-2.5 appearance-none focus:outline-none focus:border-[#141010] focus:ring-1 focus:ring-[#141010] text-[#0c0a09] text-sm"
                            >
                              {categories?.map((cat) => (
                                <option key={cat._id} value={cat._id}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                            <span className="absolute right-3 top-3 text-[#5e5e5e] pointer-events-none">
                              <ChevronDownIcon className="w-4 h-4" />
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-[#0c0a09]">Search Code / SKU (Optional)</label>
                          <input
                            type="text"
                            value={itemSkuNumber}
                            onChange={(e) => setItemSkuNumber(e.target.value)}
                            placeholder="e.g. 1211 / VF-001"
                            className="w-full bg-white border border-[#e7e5e4] rounded-lg px-4 py-2.5 focus:outline-none focus:border-[#141010] focus:ring-1 focus:ring-[#141010] text-[#0c0a09] text-sm"
                          />
                        </div>
                      </div>

                      {/* Item Name */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-[#0c0a09]">Item Name *</label>
                        <input
                          type="text"
                          required
                          value={itemName}
                          onChange={(e) => setItemName(e.target.value)}
                          placeholder="Enter item name (e.g., Truffle Umami Burger)"
                          className="w-full bg-white border border-[#e7e5e4] rounded-lg px-4 py-2.5 focus:outline-none focus:border-[#141010] focus:ring-1 focus:ring-[#141010] text-[#0c0a09] text-sm"
                        />
                      </div>

                      {/* Price */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-[#0c0a09]">Price *</label>
                        <div className="relative">
                          <span className="absolute left-4 top-2.5 text-[#5e5e5e] text-sm font-semibold">{currencySymbol}</span>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={itemPrice}
                            onChange={(e) => setItemPrice(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-white border border-[#e7e5e4] rounded-lg pl-8 pr-4 py-2.5 focus:outline-none focus:border-[#141010] focus:ring-1 focus:ring-[#141010] text-[#0c0a09] text-sm font-medium"
                          />
                        </div>
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-[#0c0a09]">Description</label>
                        <textarea
                          rows={4}
                          value={itemDescription}
                          onChange={(e) => setItemDescription(e.target.value)}
                          placeholder="Describe ingredients, taste notes, and culinary highlights..."
                          className="w-full bg-white border border-[#e7e5e4] rounded-lg px-4 py-2.5 focus:outline-none focus:border-[#141010] focus:ring-1 focus:ring-[#141010] text-[#0c0a09] text-sm resize-y"
                        />
                      </div>
                    </div>

                    {/* Card 2: Dietary Classification & Settings */}
                    <div className="bg-white rounded-xl border border-[#e7e5e4] p-6 lg:p-8 shadow-sm space-y-6">
                      <h2 className="font-sans text-[20px] font-semibold text-[#0c0a09]">Dietary Classification & Settings</h2>
                      
                      {/* Dietary Type Selector */}
                      <div className="space-y-2.5">
                        <label className="block text-sm font-medium text-[#0c0a09]">
                          Dietary Classification (Item Type)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                          {DIETARY_TYPES.map((type) => {
                            const isSelected = selectedDietaryType === type.id;
                            return (
                              <button
                                key={type.id}
                                type="button"
                                onClick={() => {
                                  setSelectedDietaryType(type.id);
                                  setItemIsVeg(type.id === "veg" || type.id === "vegan" || type.id === "jain");
                                }}
                                className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all cursor-pointer select-none text-sm font-medium ${
                                  isSelected
                                    ? "bg-[#141010] text-white border-[#141010] shadow-sm scale-[1.02]"
                                    : "bg-[#f7f3f2] hover:bg-[#f1edec] text-[#141010] border-[#e7e5e4]"
                                }`}
                              >
                                <span>{type.icon}</span>
                                <span>{type.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Item Toggles Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        {/* Show Quantity */}
                        <div className="space-y-3 p-3.5 bg-[#f7f3f2] rounded-lg border border-[#e7e5e4]">
                          <div
                            onClick={() => setItemShowQuantity(!itemShowQuantity)}
                            className="flex items-center justify-between cursor-pointer select-none"
                          >
                            <span className="text-sm font-medium text-[#0c0a09]">Show quantity</span>
                            <div className={`w-9 h-5 rounded-full relative transition-colors ${itemShowQuantity ? "bg-[#0c0a09]" : "bg-[#d1c4c1]"}`}>
                              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${itemShowQuantity ? "right-0.5" : "left-0.5"}`} />
                            </div>
                          </div>
                          
                          {itemShowQuantity && (
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <input
                                type="number"
                                placeholder="Qty (e.g. 250)"
                                value={itemQuantity}
                                onChange={(e) => setItemQuantity(e.target.value)}
                                className="bg-white border border-[#e7e5e4] rounded px-3 py-1.5 text-xs text-[#0c0a09]"
                              />
                              <select
                                value={itemQuantityUnit}
                                onChange={(e) => setItemQuantityUnit(e.target.value)}
                                className="bg-white border border-[#e7e5e4] rounded px-2 py-1.5 text-xs text-[#0c0a09]"
                              >
                                {QUANTITY_UNITS.map((u) => (
                                  <option key={u.value} value={u.value}>{u.label}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Is Taxable */}
                        <div
                          onClick={() => setItemIsGst(!itemIsGst)}
                          className="flex items-center justify-between p-3.5 bg-[#f7f3f2] hover:bg-[#f1edec] rounded-lg border border-[#e7e5e4] cursor-pointer transition select-none"
                        >
                          <span className="text-sm font-medium text-[#0c0a09]">Is this item taxable? (GST)</span>
                          <div className={`w-9 h-5 rounded-full relative transition-colors ${itemIsGst ? "bg-[#0c0a09]" : "bg-[#d1c4c1]"}`}>
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${itemIsGst ? "right-0.5" : "left-0.5"}`} />
                          </div>
                        </div>

                        {/* Mark as Bestseller */}
                        <div
                          onClick={() => setItemMarkAsBestseller(!itemMarkAsBestseller)}
                          className="flex items-center justify-between p-3.5 bg-[#f7f3f2] hover:bg-[#f1edec] rounded-lg border border-[#e7e5e4] cursor-pointer transition select-none"
                        >
                          <span className="text-sm font-medium text-[#0c0a09]">Mark as Bestseller ⭐</span>
                          <div className={`w-9 h-5 rounded-full relative transition-colors ${itemMarkAsBestseller ? "bg-[#0c0a09]" : "bg-[#d1c4c1]"}`}>
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${itemMarkAsBestseller ? "right-0.5" : "left-0.5"}`} />
                          </div>
                        </div>

                        {/* Mark as Spicy */}
                        <div
                          onClick={() => setItemIsSpicy(!itemIsSpicy)}
                          className="flex items-center justify-between p-3.5 bg-[#f7f3f2] hover:bg-[#f1edec] rounded-lg border border-[#e7e5e4] cursor-pointer transition select-none"
                        >
                          <span className="text-sm font-medium text-[#0c0a09]">Mark as Spicy 🌶️</span>
                          <div className={`w-9 h-5 rounded-full relative transition-colors ${itemIsSpicy ? "bg-[#0c0a09]" : "bg-[#d1c4c1]"}`}>
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${itemIsSpicy ? "right-0.5" : "left-0.5"}`} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Live Preview */}
                  <div className="lg:col-span-5 xl:col-span-4 space-y-6 sticky top-6">
                    <div className="bg-white rounded-xl border border-[#e7e5e4] p-6 shadow-sm">
                      <h2 className="font-sans text-[16px] font-semibold text-[#0c0a09] mb-4">Live Item Preview</h2>
                      <div className="border border-[#e7e5e4] rounded-xl overflow-hidden bg-white shadow-sm">
                        <div className="aspect-[4/3] bg-[#f0efed] flex items-center justify-center relative">
                          <ImageIcon className="w-12 h-12 text-[#928c8a]" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-4 justify-between">
                            <span className="bg-white/90 backdrop-blur-sm text-[#0c0a09] text-xs font-semibold px-2.5 py-1 rounded-md shadow-sm">
                              {categories?.find((c) => c._id === (itemSelectedCategoryId || activeCategory?._id))?.name || "Category"}
                            </span>
                            <span className="bg-black/75 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded">
                              {DIETARY_TYPES.find((d) => d.id === selectedDietaryType)?.icon}{" "}
                              {DIETARY_TYPES.find((d) => d.id === selectedDietaryType)?.label}
                            </span>
                          </div>
                        </div>

                        <div className="p-5">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-garamond text-[24px] text-[#0c0a09] leading-snug truncate pr-3">
                              {itemName || "Item Name"}
                            </h3>
                            <span className="font-semibold text-[16px] text-[#0c0a09]">
                              {currencySymbol}{itemPrice ? parseFloat(itemPrice).toFixed(2) : "0.00"}
                            </span>
                          </div>
                          <p className="text-sm text-[#5e5e5e] line-clamp-2">
                            {itemDescription || "Description will appear here as you type..."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* VIEW 2: TWO-PANEL INTERFACE (CATEGORIES / ITEMS / CUST)   */
          /* ======================================================== */
          <>
            {/* Top Workspace Context (UNTOUCHED) */}
            <div className="bg-[#fdf8f7] px-6 lg:px-8 py-6 border-b border-[#e7e5e4] shrink-0">
              <div className="flex items-end justify-between w-full">
                <div>
                  <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-[#5e5e5e] mb-1">
                    Workspace
                  </p>
                  <div className="relative flex items-center gap-3">
                    {/* Menu Title Dropdown Button */}
                    <button
                      type="button"
                      onClick={() => setIsMenuDropdownOpen(!isMenuDropdownOpen)}
                      className="flex items-center gap-2 group cursor-pointer"
                    >
                      <span className="font-garamond text-[32px] text-[#141010] font-normal leading-tight">
                        {activeMenu?.name || "Main Menu"}
                      </span>
                      <span className="text-[#5e5e5e] group-hover:text-[#141010] transition-colors mt-1">
                        <ChevronDownIcon className="w-5 h-5" />
                      </span>
                    </button>

                    {/* Edit Pencil Circle Button */}
                    {activeMenu && (
                      <button
                        type="button"
                        onClick={openEditMenuDrawer}
                        className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] hover:text-[#141010] transition-colors cursor-pointer"
                        title="Edit Menu Name"
                      >
                        <EditPencilIcon className="w-4 h-4" />
                      </button>
                    )}

                    {activeMenu?.isActive && (
                      <span className="px-2 py-0.5 bg-[#f1edec] text-[#5e5e5e] font-sans text-[10px] font-semibold uppercase tracking-wider rounded border border-[#e7e5e4] self-center mt-1">
                        Active
                      </span>
                    )}

                    {/* Menu Dropdown Menu */}
                    {isMenuDropdownOpen && (
                      <div className="absolute left-0 top-full mt-2 w-64 rounded-xl bg-white border border-[#e7e5e4] shadow-xl py-2 z-50 divide-y divide-[#e7e5e4]">
                        <div className="py-1">
                          {menus?.map((m) => {
                            const isSelected = m._id === selectedMenuId;
                            return (
                              <button
                                key={m._id}
                                type="button"
                                onClick={() => {
                                  setSelectedMenuId(m._id);
                                  setSelectedItemId(null);
                                  setIsMenuDropdownOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2.5 flex items-center justify-between text-sm transition-colors cursor-pointer ${
                                  isSelected ? "bg-[#f1edec] font-semibold text-[#141010]" : "hover:bg-[#fafafa] text-[#5e5e5e]"
                                }`}
                              >
                                <span>{m.name}</span>
                                {m.isDefault && (
                                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                                    Default
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsMenuDropdownOpen(false);
                              setIsCreateMenuOpen(true);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-[#141010] hover:bg-[#fafafa] flex items-center gap-2 font-medium cursor-pointer"
                          >
                            <PlusIcon className="w-3.5 h-3.5" /> Create New Menu
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 font-sans">
                  {activeMenu && (
                    <button
                      type="button"
                      onClick={openEditMenuDrawer}
                      className="h-10 px-4 rounded-full border border-[#e7e5e4] bg-transparent hover:bg-[#f1edec] text-[#141010] font-medium text-[15px] transition-colors flex items-center gap-2 cursor-pointer shadow-none"
                    >
                      <EditPencilIcon className="w-4 h-4 text-[#141010]" />
                      <span>Edit Menu</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsCreateMenuOpen(true)}
                    className="btn-primary h-10 px-6 rounded-full bg-[#0c0a09] text-white font-medium text-[15px] hover:bg-[#252626] transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                    style={{ color: "#ffffff", backgroundColor: "#0c0a09" }}
                  >
                    <PlusIcon className="w-4 h-4" />
                    <span style={{ color: "#ffffff" }}>Create Menu</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Empty State Banner */}
            {(!menus || menus.length === 0) && (
              <div className="w-full p-8 text-center bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] mt-6">
                <div className="text-4xl">🍽</div>
                <h2 className="mt-3 font-garamond text-2xl font-normal text-[#141010]">No Menus Created Yet</h2>
                <p className="mt-1 text-sm text-[#5e5e5e]">
                  Get started by creating a new menu or loading sample categories (Viral Food, Starters, Mains).
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleSeedSample}
                    className="btn-primary rounded-full px-6 py-2.5 text-sm font-medium shadow-none hover:opacity-90 transition cursor-pointer"
                    style={{ color: "#ffffff", backgroundColor: "#0c0a09" }}
                  >
                    Load Sample Menu (Demo)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreateMenuOpen(true)}
                    className="rounded-full border border-[#e7e5e4] bg-transparent px-6 py-2.5 text-sm font-medium text-[#141010] hover:bg-[#f1edec] transition cursor-pointer"
                  >
                    + Create Custom Menu
                  </button>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TWO PANEL DRILLDOWN SYSTEM                                */}
            {/* LEVEL 1: Categories (Left) + Category Items (Right)      */}
            {/* LEVEL 2: Items in Category (Left) + Customizations (Right) */}
            {/* ======================================================== */}
            {activeMenu && (
              <>
                {/* Breadcrumb Navigation Strip */}
                <div className="px-6 lg:px-8 pt-5 pb-1">
                  <nav className="flex items-center text-[13px] text-[#5e5e5e] gap-2 font-sans select-none">
                    <button
                      type="button"
                      onClick={() => setSelectedItemId(null)}
                      className="hover:text-[#141010] transition-colors cursor-pointer font-medium hover:underline"
                    >
                      Menu
                    </button>
                    {activeCategory && (
                      <>
                        <span className="text-[#a8a29e]">/</span>
                        <button
                          type="button"
                          onClick={() => setSelectedItemId(null)}
                          className={`transition-colors cursor-pointer ${
                            !selectedItemId ? "text-[#141010] font-bold" : "hover:text-[#141010] font-medium hover:underline"
                          }`}
                        >
                          {activeCategory.name}
                        </button>
                      </>
                    )}
                    {selectedItemId && activeItem && (
                      <>
                        <span className="text-[#a8a29e]">/</span>
                        <span className="text-[#141010] font-bold">
                          {activeItem.name}
                        </span>
                      </>
                    )}
                  </nav>
                </div>

                <div className="flex-1 flex flex-col md:flex-row w-full p-6 lg:p-8 pt-3 gap-6 min-h-[calc(100vh-190px)] items-start font-sans">
                
                {/* ---------------------------------------------------- */}
                {/* LEFT PANEL: Categories (Level 1) OR Items (Level 2) */}
                {/* ---------------------------------------------------- */}
                <div className="w-full md:w-72 lg:w-80 xl:w-96 shrink-0 flex flex-col bg-white rounded-xl border border-[#e7e5e4] shadow-sm overflow-hidden sticky top-6">
                  {selectedItemId && activeItem ? (
                    /* Level 2 Left Panel: Items in Category */
                    <>
                      <div className="p-4 border-b border-[#e7e5e4] flex justify-between items-center bg-[#fdf8f7] shrink-0">
                        <div>
                          <div className="flex items-center text-xs text-[#5e5e5e] mb-1 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedItemId(null)}
                              className="hover:text-[#141010] cursor-pointer"
                            >
                              Menu
                            </button>
                            <ChevronRightIcon className="w-3 h-3" />
                            <button
                              type="button"
                              onClick={() => setSelectedItemId(null)}
                              className="hover:text-[#141010] cursor-pointer"
                            >
                              {activeCategory?.name}
                            </button>
                          </div>
                          <h2 className="font-sans text-[16px] font-bold text-[#141010]">
                            Items ({categoryItems?.length || 0})
                          </h2>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenAddNewItem}
                          className="px-3 py-1.5 rounded-full bg-[#0c0a09] text-white text-xs font-semibold hover:bg-[#252626] transition cursor-pointer flex items-center gap-1 shadow-sm"
                          style={{ color: "#ffffff", backgroundColor: "#0c0a09" }}
                        >
                          <PlusIcon className="w-3.5 h-3.5" />
                          <span>Add item</span>
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto divide-y divide-[#e7e5e4] max-h-[calc(100vh-280px)]">
                        {categoryItems && categoryItems.length > 0 ? (
                          categoryItems.map(({ categoryItemId, item }) => {
                            const isSelected = item._id === selectedItemId;
                            const initialLetter = item.name ? item.name.charAt(0).toUpperCase() : "I";
                            return (
                              <div
                                key={categoryItemId}
                                onClick={() => setSelectedItemId(item._id)}
                                className={`flex items-center justify-between p-3.5 cursor-pointer transition-all select-none ${
                                  isSelected
                                    ? "bg-[#141010] text-white font-semibold shadow-inner"
                                    : "hover:bg-[#f7f3f2] text-[#141010] bg-white"
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0 pr-2">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                    isSelected ? "bg-black text-white border border-white/20" : "bg-[#f1edec] text-[#141010]"
                                  }`}>
                                    {item.imageUrl ? (
                                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-full" />
                                    ) : (
                                      <span>{initialLetter}</span>
                                    )}
                                  </div>
                                  <span className={`text-[14px] truncate ${isSelected ? "text-white" : "text-[#141010]"}`}>
                                    {item.name}
                                  </span>
                                </div>
                                <span className={`text-xs font-semibold shrink-0 ${isSelected ? "text-white/90" : "text-[#5e5e5e]"}`}>
                                  {currencySymbol}{(item.price / 100).toFixed(0)}
                                </span>
                              </div>
                            );
                          })
                        ) : null}
                      </div>
                    </>
                  ) : (
                    /* Level 1 Left Panel: Categories List */
                    <>
                      <div className="p-4 border-b border-[#e7e5e4] flex justify-between items-center bg-[#fdf8f7] shrink-0">
                        <h2 className="font-sans text-[16px] font-bold text-[#141010]">
                          Categories ({categories?.length || 0})
                        </h2>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategory(null);
                            setCategoryName("");
                            setCategoryPublished(true);
                            setIsAddCategoryOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-full bg-[#0c0a09] text-white text-xs font-semibold hover:bg-[#252626] transition cursor-pointer flex items-center gap-1 shadow-sm"
                          style={{ color: "#ffffff", backgroundColor: "#0c0a09" }}
                        >
                          <PlusIcon className="w-3.5 h-3.5" />
                          <span>Add category</span>
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto divide-y divide-[#e7e5e4] max-h-[calc(100vh-280px)]">
                        {categories && categories.length > 0 ? (
                          categories.map((cat, index) => {
                            const isSelected = cat._id === selectedCategoryId;
                            return (
                              <div
                                key={cat._id}
                                draggable
                                onDragStart={(e) => handleCategoryDragStart(e, index)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleCategoryDrop(e, index)}
                                onClick={() => {
                                  setSelectedCategoryId(cat._id);
                                  setSelectedItemId(null);
                                }}
                                className={`flex items-center justify-between p-3.5 cursor-pointer transition-all select-none group ${
                                  isSelected
                                    ? "bg-[#141010] text-white font-semibold shadow-inner"
                                    : "hover:bg-[#f7f3f2] text-[#141010] bg-white"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                  <span
                                    className={`cursor-grab active:cursor-grabbing text-xs transition-opacity ${
                                      isSelected ? "opacity-70 text-white" : "opacity-40 text-[#5e5e5e] group-hover:opacity-80"
                                    }`}
                                  >
                                    <DragHandleIcon className="w-4 h-4" />
                                  </span>
                                  <span className={`text-[14px] truncate ${isSelected ? "text-white font-semibold" : "text-[#141010]"}`}>
                                    {cat.name}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Toggle Switch */}
                                  <div
                                    onClick={(e) => handleToggleCategory(e, cat._id, cat.published)}
                                    className={`w-7 h-4 rounded-full relative cursor-pointer transition-colors ${
                                      cat.published
                                        ? isSelected ? "bg-emerald-500" : "bg-[#0c0a09]"
                                        : isSelected ? "bg-stone-600" : "bg-[#e6e1e1] border border-[#e7e5e4]"
                                    }`}
                                  >
                                    <div
                                      className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                                        cat.published ? "right-0.5" : "left-0.5"
                                      }`}
                                    />
                                  </div>

                                  {/* Edit Button */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingCategory(cat);
                                      setCategoryName(cat.name);
                                      setCategoryPublished(cat.published);
                                      setIsAddCategoryOpen(true);
                                    }}
                                    className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                                      isSelected
                                        ? "text-white/80 hover:text-white hover:bg-white/20"
                                        : "text-[#5e5e5e] hover:text-[#141010] hover:bg-[#f1edec] opacity-0 group-hover:opacity-100"
                                    }`}
                                    title="Edit Category"
                                  >
                                    <EditPencilIcon className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Delete Button */}
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteCategory(e, cat._id, cat.name)}
                                    className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                                      isSelected
                                        ? "text-red-300 hover:text-red-100 hover:bg-red-500/20"
                                        : "text-[#5e5e5e] hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100"
                                    }`}
                                    title="Delete Category"
                                  >
                                    <CloseIcon className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-8 text-center text-xs text-[#5e5e5e]">
                            No categories found. Click <strong>+ Add category</strong> to create one.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* ---------------------------------------------------- */}
                {/* RIGHT PANEL: Items (Level 1) OR Customizations (Level 2) */}
                {/* ---------------------------------------------------- */}
                <div className="flex-1 min-w-0 w-full flex flex-col bg-white rounded-xl border border-[#e7e5e4] shadow-sm overflow-hidden min-h-[500px]">
                  {selectedItemId && activeItem ? (
                    /* ======================================================== */
                    /* LEVEL 2 RIGHT PANEL: ITEM & CUSTOMIZATIONS VIEW          */
                    /* ======================================================== */
                    <div className="flex flex-col divide-y divide-[#e7e5e4]">
                      {/* Top Item Header */}
                      <div className="p-6 bg-[#fdf8f7] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="font-garamond text-[32px] font-normal text-[#141010] leading-tight">
                              {activeItem.name}
                            </h2>
                            <span className="font-sans font-normal text-[24px] text-[#5e5e5e]">
                              {currencySymbol}{(activeItem.price / 100).toFixed(0)}
                            </span>
                          </div>
                          <p className="font-sans text-[13px] text-[#5e5e5e] mt-1">
                            {activeItem.description || "Manage customizations, availability status, and options for this menu item."}
                          </p>
                        </div>

                        {/* Control Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* In Stock Availability Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleItemAvailability(activeItem._id, activeItem.isAvailable)}
                            className={`h-9 px-3 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                              activeItem.isAvailable
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                                : "bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200"
                            }`}
                          >
                            <span>{activeItem.isAvailable ? "✓ In Stock" : "○ Unavailable"}</span>
                          </button>

                          {/* Edit Item Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditItem(activeItem)}
                            className="w-9 h-9 rounded-full border border-[#e7e5e4] bg-white hover:bg-[#f1edec] flex items-center justify-center text-[#141010] transition cursor-pointer shadow-sm"
                            title="Edit Item"
                          >
                            <EditPencilIcon className="w-4 h-4" />
                          </button>

                          {/* Delete Item Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(activeItem._id, activeItem.name)}
                            className="w-9 h-9 rounded-full border border-red-200 bg-white hover:bg-red-50 flex items-center justify-center text-red-600 transition cursor-pointer shadow-sm"
                            title="Delete Item"
                          >
                            <CloseIcon className="w-4 h-4" />
                          </button>

                          {/* Add Customization Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setCustName("");
                              setCustType("AddOns");
                              setCustRequired(false);
                              setCustMaxSelected("1");
                              setCustOptions([{ name: "", price: "0.00" }]);
                              setIsAddCustomizationOpen(true);
                            }}
                            className="btn-primary h-9 px-4 rounded-full bg-[#0c0a09] text-white font-medium text-[13px] hover:bg-[#252626] transition shadow-sm flex items-center gap-1.5 cursor-pointer ml-1"
                            style={{ color: "#ffffff", backgroundColor: "#0c0a09" }}
                          >
                            <PlusIcon className="w-4 h-4" />
                            <span>Add customization</span>
                          </button>
                        </div>
                      </div>

                      {/* Section 1: Customizations Groups */}
                      <div className="p-6 space-y-4">
                        <div>
                          <h3 className="font-garamond text-[24px] text-[#141010] font-normal">Customizations</h3>
                          <p className="text-xs text-[#5e5e5e] mt-0.5">
                            Add modifier groups like add-ons or preparation choices.
                          </p>
                        </div>

                        <div className="border border-[#e7e5e4] rounded-xl overflow-hidden shadow-sm">
                          <table className="w-full text-left border-collapse font-sans">
                            <thead>
                              <tr className="border-b border-[#e7e5e4] text-[12px] font-semibold text-[#5e5e5e] bg-[#fcf5f4]">
                                <th className="py-3 px-6 font-semibold w-1/2">Customization</th>
                                <th className="py-3 px-6 font-semibold">Type</th>
                                <th className="py-3 px-6 font-semibold text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e7e5e4] bg-white">
                              {activeItemCustomizations && activeItemCustomizations.length > 0 ? (
                                activeItemCustomizations.map((cust: ItemCustomization) => {
                                  const isSelected = cust._id === selectedCustId;
                                  return (
                                    <tr
                                      key={cust._id}
                                      onClick={() => setSelectedCustId(cust._id)}
                                      className={`cursor-pointer transition-colors ${
                                        isSelected ? "bg-[#f1edec]" : "hover:bg-[#fafafa]"
                                      }`}
                                    >
                                      <td className="py-3.5 px-6">
                                        <div className="flex items-center gap-3">
                                          <span className="text-[#5e5e5e] opacity-40">
                                            <DragHandleIcon className="w-4 h-4" />
                                          </span>
                                          <div>
                                            <div className="font-semibold text-[15px] text-[#141010] flex items-center gap-2">
                                              <span>{cust.name}</span>
                                              {cust.required && (
                                                <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-semibold">
                                                  Required
                                                </span>
                                              )}
                                            </div>
                                            <p className="text-xs text-[#5e5e5e] mt-0.5">
                                              Max choices: {cust.maxSelected || 1}
                                            </p>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="py-3.5 px-6">
                                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-800">
                                          {cust.customizationType === "AddOns" ? "Add-Ons" : "Preparations"}
                                        </span>
                                      </td>
                                      <td className="py-3.5 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                                        <button
                                          type="button"
                                          onClick={(e) => handleDeleteCustomization(e, cust._id, cust.name)}
                                          className="w-7 h-7 rounded-full hover:bg-red-50 text-[#5e5e5e] hover:text-red-600 inline-flex items-center justify-center transition cursor-pointer"
                                          title="Delete Customization"
                                        >
                                          <CloseIcon className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              ) : (
                                <tr>
                                  <td colSpan={3} className="py-8 text-center text-xs text-[#5e5e5e]">
                                    No customization groups yet. Click <strong>+ Add customization</strong> to create one.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Section 2: Choices for Selected Customization */}
                      {activeCustomization && (
                        <div className="p-6 space-y-4 bg-[#faf9f8]">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <h3 className="font-garamond text-[24px] text-[#141010] font-normal">
                                Choices for '{activeCustomization.name}'
                              </h3>
                              <p className="text-xs text-[#5e5e5e] mt-0.5">
                                Configure options and price modifiers for this customization group.
                              </p>
                            </div>
                          </div>

                          {/* Choices List */}
                          <div className="border border-[#e7e5e4] rounded-xl overflow-hidden bg-white shadow-sm divide-y divide-[#e7e5e4]">
                            {activeCustomization.items && activeCustomization.items.length > 0 ? (
                              activeCustomization.items.map((opt: CustomizationOption) => (
                                <div key={opt._id} className="p-3.5 flex items-center justify-between hover:bg-[#fdf8f7] transition">
                                  <div className="flex items-center gap-3">
                                    <span className="text-[#5e5e5e] opacity-40">
                                      <DragHandleIcon className="w-4 h-4" />
                                    </span>
                                    <span className="font-semibold text-sm text-[#141010]">{opt.name}</span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <span className="font-semibold text-sm text-[#141010]">
                                      {opt.price > 0 ? `+${currencySymbol}${(opt.price / 100).toFixed(2)}` : "Free"}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteChoice(opt._id)}
                                      className="w-7 h-7 rounded-full hover:bg-red-50 text-[#5e5e5e] hover:text-red-600 flex items-center justify-center transition cursor-pointer"
                                      title="Delete Option"
                                    >
                                      <CloseIcon className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="p-6 text-center text-xs text-[#5e5e5e]">
                                No choices added yet. Use the form below to add options.
                              </div>
                            )}

                            {/* Add Choice Form */}
                            <form onSubmit={handleAddChoiceSubmit} className="p-4 bg-[#fdf8f7] flex flex-col sm:flex-row items-center gap-3">
                              <input
                                type="text"
                                required
                                value={newChoiceName}
                                onChange={(e) => setNewChoiceName(e.target.value)}
                                placeholder="Choice name (e.g. Extra Cheese, Mild, Large)"
                                className="flex-1 w-full bg-white border border-[#e7e5e4] rounded-lg px-3.5 py-2 text-xs text-[#141010] outline-none"
                              />
                              <div className="relative w-full sm:w-36">
                                <span className="absolute left-3 top-2 text-xs font-semibold text-[#5e5e5e]">
                                  {currencySymbol}
                                </span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={newChoicePrice}
                                  onChange={(e) => setNewChoicePrice(e.target.value)}
                                  placeholder="0.00"
                                  className="w-full bg-white border border-[#e7e5e4] rounded-lg pl-7 pr-3 py-2 text-xs text-[#141010] font-semibold outline-none"
                                />
                              </div>
                              <button
                                type="submit"
                                disabled={isAddingChoice}
                                className="btn-primary w-full sm:w-auto px-5 py-2 rounded-lg bg-[#0c0a09] text-white text-xs font-semibold hover:bg-[#252626] transition cursor-pointer shrink-0 disabled:opacity-50"
                                style={{ color: "#ffffff", backgroundColor: "#0c0a09" }}
                              >
                                {isAddingChoice ? "Adding..." : "+ Add Choice"}
                              </button>
                            </form>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : activeCategory ? (
                    /* ======================================================== */
                    /* LEVEL 1 RIGHT PANEL: CATEGORY ITEMS TABLE                 */
                    /* ======================================================== */
                    <>
                      {/* Header with Title and Category Quick Control Group */}
                      <div className="p-5 lg:p-6 border-b border-[#e7e5e4] bg-[#fdf8f7] shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-1.5 text-[#5e5e5e] font-sans text-[11px] uppercase tracking-wider mb-1 font-semibold">
                            <span>{activeMenu.name}</span>
                            <ChevronRightIcon className="w-3.5 h-3.5" />
                            <span className="text-[#141010] font-bold">{activeCategory.name}</span>
                          </div>
                          <h2 className="font-garamond text-[26px] md:text-[30px] font-normal text-[#141010] leading-tight">
                            {activeCategory.name} ({categoryItems?.length || 0})
                          </h2>
                          <p className="font-sans text-[13px] text-[#5e5e5e] mt-0.5">
                            {activeItemsCount} active {activeItemsCount === 1 ? "item" : "items"} available in this category. Click an item to view customizations.
                          </p>
                        </div>

                        {/* Category Header Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Publish Category Toggle Button */}
                          <button
                            type="button"
                            onClick={(e) => handleToggleCategory(e, activeCategory._id, activeCategory.published)}
                            className={`h-9 px-3 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                              activeCategory.published
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                                : "bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200"
                            }`}
                            title={activeCategory.published ? "Category is Published (Visible Online)" : "Category is Draft (Hidden)"}
                          >
                            <span>{activeCategory.published ? "✓ Published" : "○ Draft"}</span>
                          </button>

                          {/* Edit Category Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategory(activeCategory);
                              setCategoryName(activeCategory.name);
                              setCategoryPublished(activeCategory.published);
                              setIsAddCategoryOpen(true);
                            }}
                            className="w-9 h-9 rounded-full border border-[#e7e5e4] bg-white hover:bg-[#f1edec] flex items-center justify-center text-[#141010] transition-colors cursor-pointer shadow-sm"
                            title="Edit Category Details"
                          >
                            <EditPencilIcon className="w-4 h-4" />
                          </button>

                          {/* Delete Category Button */}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCategory(e, activeCategory._id, activeCategory.name)}
                            className="w-9 h-9 rounded-full border border-red-200 bg-white hover:bg-red-50 flex items-center justify-center text-red-600 transition-colors cursor-pointer shadow-sm"
                            title="Delete Category"
                          >
                            <CloseIcon className="w-4 h-4" />
                          </button>

                          {/* Add Item Dropdown Button */}
                          <div className="relative ml-1">
                            <button
                              type="button"
                              onClick={() => setIsAddItemDropdownOpen(!isAddItemDropdownOpen)}
                              className="btn-primary h-9 px-4 rounded-full bg-[#0c0a09] text-white font-medium text-[14px] hover:bg-[#252626] transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                              style={{ color: "#ffffff", backgroundColor: "#0c0a09" }}
                            >
                              <PlusIcon className="w-4 h-4" />
                              <span style={{ color: "#ffffff" }}>Add item</span>
                              <ChevronDownIcon className="w-3.5 h-3.5 ml-0.5 opacity-80" />
                            </button>

                            {/* Dropdown Popover */}
                            {isAddItemDropdownOpen && (
                              <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-[#252626] text-white py-1.5 shadow-2xl z-40 border border-[#3a3a3a] font-sans divide-y divide-white/10">
                                <button
                                  type="button"
                                  onClick={handleOpenAddExistingItemDrawer}
                                  className="w-full text-center px-4 py-2.5 text-xs font-semibold hover:bg-white/10 transition cursor-pointer text-white"
                                >
                                  Add existing item
                                </button>
                                <button
                                  type="button"
                                  onClick={handleOpenAddNewItem}
                                  className="w-full text-center px-4 py-2.5 text-xs font-semibold hover:bg-white/10 transition cursor-pointer text-white"
                                >
                                  Create new item
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Items Table */}
                      <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-left border-collapse font-sans">
                          <thead>
                            <tr className="border-b border-[#e7e5e4] text-[12px] font-semibold text-[#5e5e5e] bg-[#fcf5f4]">
                              <th className="py-3.5 px-6 font-semibold">Item</th>
                              <th className="py-3.5 px-6 font-semibold text-right">Price</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#e7e5e4] bg-white">
                            {categoryItems && categoryItems.length > 0 ? (
                              categoryItems.map(({ categoryItemId, item }, index) => {
                                const initialLetter = item.name ? item.name.charAt(0).toUpperCase() : "I";
                                return (
                                  <tr
                                    key={categoryItemId}
                                    draggable
                                    onDragStart={(e) => handleItemDragStart(e, index)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleItemDrop(e, index)}
                                    className={`hover:bg-[#fdf8f7] transition-colors group select-none cursor-pointer ${
                                      !item.isAvailable ? "opacity-70 bg-stone-50/50" : ""
                                    }`}
                                    onClick={() => setSelectedItemId(item._id)}
                                  >
                                    {/* Item Column */}
                                    <td className="py-3.5 px-6">
                                      <div className="flex items-center gap-3.5">
                                        <span
                                          onClick={(e) => e.stopPropagation()}
                                          className="cursor-grab active:cursor-grabbing text-[#5e5e5e] opacity-0 group-hover:opacity-70 transition-opacity"
                                        >
                                          <DragHandleIcon className="w-4 h-4" />
                                        </span>

                                        {/* Circular Letter Avatar */}
                                        <div className="w-10 h-10 rounded-full bg-[#f1edec] border border-[#e7e5e4] overflow-hidden shrink-0 flex items-center justify-center font-bold text-[#141010] text-sm">
                                          {item.imageUrl ? (
                                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                          ) : (
                                            <span>{initialLetter}</span>
                                          )}
                                        </div>

                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-[15px] text-[#141010]">
                                              {item.name}
                                            </span>
                                            {item.isVeg !== undefined && (
                                              <span
                                                className={`w-2.5 h-2.5 rounded-full inline-block border ${
                                                  item.isVeg ? "bg-emerald-600 border-emerald-700" : "bg-red-600 border-red-700"
                                                }`}
                                                title={item.isVeg ? "Vegetarian" : "Non-Veg"}
                                              />
                                            )}
                                            {item.isSpicy && <span title="Spicy">🌶️</span>}
                                            {item.markAsBestseller && (
                                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-semibold rounded">
                                                Bestseller
                                              </span>
                                            )}
                                            {!item.isAvailable && (
                                              <span className="px-2 py-0.5 bg-stone-100 text-stone-600 text-[10px] font-medium rounded border border-stone-200">
                                                Unavailable
                                              </span>
                                            )}
                                          </div>
                                          {item.description && (
                                            <p className="text-[#5e5e5e] text-[13px] line-clamp-1 mt-0.5 max-w-lg">
                                              {item.description}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </td>

                                    {/* Price Column with Quick Actions on Hover */}
                                    <td className="py-3.5 px-6 text-right font-medium text-[15px] text-[#141010] whitespace-nowrap">
                                      <div className="flex items-center justify-end gap-3">
                                        <span className="font-semibold">
                                          {currencySymbol}{(item.price / 100).toFixed(2)}
                                        </span>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenEditItem(item)}
                                            className="w-7 h-7 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] hover:text-[#141010] transition-colors cursor-pointer"
                                            title="Edit Item Details"
                                          >
                                            <EditPencilIcon className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteItem(item._id, item.name)}
                                            className="w-7 h-7 rounded-full hover:bg-red-50 flex items-center justify-center text-[#5e5e5e] hover:text-red-600 transition-colors cursor-pointer"
                                            title="Delete Item"
                                          >
                                            <CloseIcon className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={2} className="py-16 text-center text-[#5e5e5e] text-sm">
                                  No items in this category yet. Click <strong>+ Add item</strong> to create one.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="p-12 text-center text-[#5e5e5e] text-sm">
                      Please select a category from the left panel.
                    </div>
                  )}
                </div>
              </div>
              </>
            )}
          </>
        )}

        {/* ---------------------------------------------------- */}
        {/* SLIDE-OVER DRAWER: ADD CUSTOMIZATION                 */}
        {/* ---------------------------------------------------- */}
        {isAddCustomizationOpen && (
          <div className="fixed inset-0 bg-[#0c0a09]/20 backdrop-blur-sm z-50 transition-opacity flex justify-end font-sans">
            <div className="h-full w-[480px] max-w-full bg-[#fdf8f7] shadow-2xl border-l border-[#e7e5e4] transform transition-transform duration-300 flex flex-col justify-between">
              <div>
                <div className="p-6 border-b border-[#e7e5e4] flex justify-between items-center bg-[#fdf8f7]">
                  <div>
                    <h2 className="font-garamond text-[24px] text-[#141010] font-normal leading-tight">Add Customization</h2>
                    <p className="text-xs text-[#5e5e5e] mt-0.5">Add add-ons or preparation options for {activeItem?.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddCustomizationOpen(false)}
                    className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] hover:text-[#141010] transition-colors cursor-pointer"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>

                <form id="customization-form" onSubmit={handleSaveCustomizationSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(100vh-180px)]">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#5e5e5e]">Customization Name *</label>
                    <input
                      type="text"
                      required
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      placeholder="e.g. Extra Cheese, Spice Level, Crust Type"
                      className="w-full rounded-lg border border-[#e7e5e4] bg-white px-3 py-2 text-sm text-[#141010] focus:border-[#141010] focus:ring-0 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#5e5e5e]">Customization Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setCustType("AddOns")}
                        className={`p-3 rounded-xl border text-center text-xs font-semibold transition cursor-pointer ${
                          custType === "AddOns" ? "bg-[#141010] text-white border-[#141010]" : "bg-white text-[#141010] border-[#e7e5e4]"
                        }`}
                      >
                        Add-Ons (Paid Extras)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustType("Preparations")}
                        className={`p-3 rounded-xl border text-center text-xs font-semibold transition cursor-pointer ${
                          custType === "Preparations" ? "bg-[#141010] text-white border-[#141010]" : "bg-white text-[#141010] border-[#e7e5e4]"
                        }`}
                      >
                        Preparations (Preferences)
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-[#e7e5e4]">
                    <div>
                      <span className="text-sm font-medium text-[#141010]">Mandatory Selection</span>
                      <p className="text-[11px] text-[#5e5e5e]">Customer must choose an option before adding to cart</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCustRequired(!custRequired)}
                      className={`w-10 h-5 rounded-full relative transition-colors ${custRequired ? "bg-[#0c0a09]" : "bg-[#d1c4c1]"}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${custRequired ? "right-0.5" : "left-0.5"}`} />
                    </button>
                  </div>

                  {/* Options List */}
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[#5e5e5e]">Options / Items</label>
                      <button
                        type="button"
                        onClick={() => setCustOptions([...custOptions, { name: "", price: "0.00" }])}
                        className="text-xs text-[#141010] font-semibold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <PlusIcon className="w-3.5 h-3.5" /> Add Option
                      </button>
                    </div>

                    <div className="space-y-2">
                      {custOptions.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            required
                            value={opt.name}
                            onChange={(e) => {
                              const newOpts = [...custOptions];
                              newOpts[idx].name = e.target.value;
                              setCustOptions(newOpts);
                            }}
                            placeholder="Option name (e.g. Cheddar Cheese)"
                            className="flex-1 rounded-lg border border-[#e7e5e4] bg-white px-3 py-2 text-xs text-[#141010] outline-none"
                          />
                          <div className="relative w-28 shrink-0">
                            <span className="absolute left-2.5 top-2 text-[#5e5e5e] text-xs font-semibold">{currencySymbol}</span>
                            <input
                              type="number"
                              step="0.01"
                              value={opt.price}
                              onChange={(e) => {
                                const newOpts = [...custOptions];
                                newOpts[idx].price = e.target.value;
                                setCustOptions(newOpts);
                              }}
                              placeholder="0.00"
                              className="w-full rounded-lg border border-[#e7e5e4] bg-white pl-6 pr-2 py-2 text-xs text-[#141010] font-medium outline-none"
                            />
                          </div>
                          {custOptions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setCustOptions(custOptions.filter((_, i) => i !== idx))}
                              className="w-7 h-7 rounded-full hover:bg-red-50 text-[#5e5e5e] hover:text-red-600 flex items-center justify-center shrink-0 cursor-pointer"
                            >
                              <CloseIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-[#e7e5e4] bg-[#fdf8f7] flex justify-end gap-3 font-sans">
                <button
                  type="button"
                  onClick={() => setIsAddCustomizationOpen(false)}
                  className="h-10 px-5 rounded-full border border-[#e7e5e4] bg-transparent text-[#141010] font-medium text-[15px] hover:bg-[#f1edec] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="customization-form"
                  disabled={isSavingCustomization}
                  className="btn-primary h-10 px-6 rounded-full bg-[#0c0a09] text-white font-medium text-[15px] hover:bg-[#252626] transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                  style={{ color: "#ffffff", backgroundColor: "#0c0a09" }}
                >
                  {isSavingCustomization ? "Saving..." : "Save Customization"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* SLIDE-OVER DRAWER: CREATE MENU                       */}
        {/* ---------------------------------------------------- */}
        {isCreateMenuOpen && (
          <div className="fixed inset-0 bg-[#0c0a09]/20 backdrop-blur-sm z-50 transition-opacity flex justify-end font-sans">
            <div className="h-full w-96 max-w-full bg-[#fdf8f7] shadow-2xl border-l border-[#e7e5e4] transform transition-transform duration-300 flex flex-col justify-between">
              <div>
                <div className="p-6 border-b border-[#e7e5e4] flex justify-between items-center bg-[#fdf8f7]">
                  <h2 className="font-garamond text-[24px] text-[#141010] font-normal leading-tight">Create New Menu</h2>
                  <button
                    type="button"
                    onClick={() => setIsCreateMenuOpen(false)}
                    className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] hover:text-[#141010] transition-colors cursor-pointer"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>

                <form id="create-menu-form" onSubmit={handleCreateMenuSubmit} className="p-6 space-y-4">
                  {createMenuError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                      {createMenuError}
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#5e5e5e]">Menu Name *</label>
                    <input
                      type="text"
                      required
                      value={menuName}
                      onChange={(e) => setMenuName(e.target.value)}
                      placeholder="e.g. Breakfast Menu"
                      className="w-full rounded-lg border border-[#e7e5e4] bg-white px-3 py-2 text-sm text-[#141010] focus:border-[#141010] focus:ring-0 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#5e5e5e]">Description</label>
                    <textarea
                      rows={3}
                      value={menuDescription}
                      onChange={(e) => setMenuDescription(e.target.value)}
                      placeholder="Optional details or service times..."
                      className="w-full rounded-lg border border-[#e7e5e4] bg-white px-3 py-2 text-sm text-[#141010] focus:border-[#141010] focus:ring-0 outline-none"
                    />
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-[#e7e5e4] bg-[#fdf8f7] flex justify-end gap-3 font-sans">
                <button
                  type="button"
                  onClick={() => setIsCreateMenuOpen(false)}
                  className="h-10 px-5 rounded-full border border-[#e7e5e4] bg-transparent text-[#141010] font-medium text-[15px] hover:bg-[#f1edec] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="create-menu-form"
                  disabled={isCreatingMenu}
                  className="btn-primary h-10 px-6 rounded-full bg-[#0c0a09] text-white font-medium text-[15px] hover:bg-[#252626] transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                  style={{ color: "#ffffff", backgroundColor: "#0c0a09" }}
                >
                  {isCreatingMenu ? "Creating..." : "Create Menu"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* SLIDE-OVER DRAWER: EDIT MENU                         */}
        {/* ---------------------------------------------------- */}
        {isEditMenuOpen && (
          <div className="fixed inset-0 bg-[#0c0a09]/20 backdrop-blur-sm z-50 transition-opacity flex justify-end font-sans">
            <div className="h-full w-96 max-w-full bg-[#fdf8f7] shadow-2xl border-l border-[#e7e5e4] transform transition-transform duration-300 flex flex-col justify-between">
              <div>
                <div className="p-6 border-b border-[#e7e5e4] flex justify-between items-center bg-[#fdf8f7]">
                  <h2 className="font-garamond text-[24px] text-[#141010] font-normal leading-tight">Edit Menu</h2>
                  <button
                    type="button"
                    onClick={() => setIsEditMenuOpen(false)}
                    className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] hover:text-[#141010] transition-colors cursor-pointer"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>

                <form id="edit-menu-form" onSubmit={handleEditMenuSubmit} className="p-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#5e5e5e]">Menu Name *</label>
                    <input
                      type="text"
                      required
                      value={editMenuName}
                      onChange={(e) => setEditMenuName(e.target.value)}
                      className="w-full rounded-lg border border-[#e7e5e4] bg-white px-3 py-2 text-sm text-[#141010] focus:border-[#141010] focus:ring-0 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#5e5e5e]">Description</label>
                    <textarea
                      rows={3}
                      value={editMenuDescription}
                      onChange={(e) => setEditMenuDescription(e.target.value)}
                      className="w-full rounded-lg border border-[#e7e5e4] bg-white px-3 py-2 text-sm text-[#141010] focus:border-[#141010] focus:ring-0 outline-none"
                    />
                  </div>

                  <div className="pt-4 border-t border-[#e7e5e4] space-y-2">
                    {!activeMenu?.isDefault && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!activeMenu?._id) return;
                          await setDefaultMenuMutation({ id: activeMenu._id });
                          setIsEditMenuOpen(false);
                        }}
                        className="w-full py-2 px-3 text-xs font-medium text-[#141010] bg-[#f1edec] hover:bg-[#e7e5e4] rounded-lg transition"
                      >
                        ⭐ Set as Default Menu
                      </button>
                    )}

                    {menus && menus.length > 1 && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!activeMenu?._id) return;
                          if (!confirm(`Delete menu "${activeMenu.name}"?`)) return;
                          await deleteMenuMutation({ id: activeMenu._id });
                          setSelectedMenuId(null);
                          setSelectedItemId(null);
                          setIsEditMenuOpen(false);
                        }}
                        className="w-full py-2 px-3 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition"
                      >
                        Delete Menu
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-[#e7e5e4] bg-[#fdf8f7] flex justify-end gap-3 font-sans">
                <button
                  type="button"
                  onClick={() => setIsEditMenuOpen(false)}
                  className="h-10 px-5 rounded-full border border-[#e7e5e4] bg-transparent text-[#141010] font-medium text-[15px] hover:bg-[#f1edec] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="edit-menu-form"
                  disabled={isUpdatingMenu}
                  className="btn-primary h-10 px-6 rounded-full bg-[#0c0a09] text-white font-medium text-[15px] hover:bg-[#252626] transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                  style={{ color: "#ffffff", backgroundColor: "#0c0a09" }}
                >
                  {isUpdatingMenu ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* SLIDE-OVER DRAWER: ADD / EDIT CATEGORY               */}
        {/* ---------------------------------------------------- */}
        {isAddCategoryOpen && (
          <div className="fixed inset-0 bg-[#0c0a09]/20 backdrop-blur-sm z-50 transition-opacity flex justify-end font-sans">
            <div className="h-full w-96 max-w-full bg-[#fdf8f7] shadow-2xl border-l border-[#e7e5e4] transform transition-transform duration-300 flex flex-col justify-between">
              <div>
                <div className="p-6 border-b border-[#e7e5e4] flex justify-between items-center bg-[#fdf8f7]">
                  <h2 className="font-garamond text-[24px] text-[#141010] font-normal leading-tight">
                    {editingCategory ? "Edit Category" : "Add Category"}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddCategoryOpen(false);
                      setEditingCategory(null);
                    }}
                    className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] hover:text-[#141010] transition-colors cursor-pointer"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>

                <form id="category-form" onSubmit={handleSaveCategorySubmit} className="p-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#5e5e5e]">Category Name *</label>
                    <input
                      type="text"
                      required
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      placeholder="e.g. Starters, Main Course, Drinks"
                      className="w-full rounded-lg border border-[#e7e5e4] bg-white px-3 py-2 text-sm text-[#141010] focus:border-[#141010] focus:ring-0 outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm font-medium text-[#141010]">Published on Menu</span>
                    <button
                      type="button"
                      onClick={() => setCategoryPublished(!categoryPublished)}
                      className={`w-10 h-5 rounded-full relative transition-colors ${
                        categoryPublished ? "bg-[#0c0a09]" : "bg-[#d1c4c1]"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                          categoryPublished ? "right-0.5" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-[#e7e5e4] bg-[#fdf8f7] flex justify-end gap-3 font-sans">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddCategoryOpen(false);
                    setEditingCategory(null);
                  }}
                  className="h-10 px-5 rounded-full border border-[#e7e5e4] bg-transparent text-[#141010] font-medium text-[15px] hover:bg-[#f1edec] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="category-form"
                  disabled={isSavingCategory}
                  className="btn-primary h-10 px-6 rounded-full bg-[#0c0a09] text-white font-medium text-[15px] hover:bg-[#252626] transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                  style={{ color: "#ffffff", backgroundColor: "#0c0a09" }}
                >
                  {isSavingCategory ? "Saving..." : editingCategory ? "Save Changes" : "Add Category"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* SLIDE-OVER DRAWER: ADD EXISTING ITEM                 */}
        {/* ---------------------------------------------------- */}
        {isAddExistingItemOpen && (
          <div className="fixed inset-0 bg-[#0c0a09]/20 backdrop-blur-sm z-50 transition-opacity flex justify-end font-sans">
            <aside className="w-full max-w-md bg-[#fdf8f7] h-full shadow-2xl flex flex-col border-l border-[#e7e5e4] transform transition-transform duration-300 justify-between">
              <div className="px-6 py-5 border-b border-[#e7e5e4] flex justify-between items-start bg-[#fdf8f7]">
                <div>
                  <h2 className="font-garamond text-[24px] text-[#141010] font-normal leading-tight">Add Existing Item</h2>
                  <p className="text-[#5e5e5e] text-[13px] mt-1 font-sans">Add an item that already exists in your menu.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddExistingItemOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] hover:text-[#141010] transition-colors cursor-pointer shrink-0"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 p-6 overflow-y-auto space-y-5">
                {existingItemError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {existingItemError}
                  </div>
                )}

                <div className="relative pt-2">
                  <label className="absolute top-0 left-3 bg-[#fdf8f7] px-1 text-[10px] font-semibold text-[#5e5e5e] z-10 uppercase tracking-wider">
                    Search any item from menu
                  </label>
                  <div className="relative flex items-center border border-[#e7e5e4] rounded-lg bg-[#fafafa] focus-within:border-[#141010] focus-within:ring-1 focus-within:ring-[#141010] transition-all">
                    <input
                      className="w-full bg-transparent border-none py-3 pl-4 pr-10 text-[#141010] placeholder:text-[#928c8a] focus:ring-0 font-sans text-[15px] outline-none"
                      style={{ backgroundColor: "transparent", color: "#141010" }}
                      placeholder="Search..."
                      type="text"
                      value={existingItemSearchQuery}
                      onChange={(e) => setExistingItemSearchQuery(e.target.value)}
                      autoFocus
                    />
                    <div className="absolute right-3 text-[#5e5e5e]">
                      <ChevronDownIcon className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="border border-[#e7e5e4] rounded-lg bg-white overflow-hidden shadow-sm max-h-64 overflow-y-auto">
                  {filteredExistingItems && filteredExistingItems.length > 0 ? (
                    <ul className="divide-y divide-[#e7e5e4]">
                      {filteredExistingItems.map((item) => {
                        const isCurrentSelected = selectedExistingItem?._id === item._id;
                        return (
                          <li
                            key={item._id}
                            onClick={() => setSelectedExistingItem(item)}
                            className={`p-3.5 hover:bg-[#fafafa] cursor-pointer transition-colors ${
                              isCurrentSelected ? "bg-[#f1edec]" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-[15px] text-[#141010] font-medium">{item.name}</div>
                                {item.categoryName && (
                                  <div className="text-[11px] text-[#5e5e5e] mt-0.5 italic">{item.categoryName}</div>
                                )}
                              </div>
                              <div className="text-sm font-semibold text-[#141010]">{currencySymbol}{item.displayPrice}</div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="p-4 text-center text-xs text-[#5e5e5e]">
                      No matching items found.
                    </div>
                  )}
                </div>

                {selectedExistingItem && (
                  <div className="mt-4">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#5e5e5e] mb-2">
                      Selected item
                    </h3>
                    <div className="flex items-center justify-between p-3.5 border border-[#e7e5e4] rounded-lg bg-[#f1edec]">
                      <div className="flex items-center gap-2.5">
                        <span className="text-emerald-700 font-bold text-sm">✓</span>
                        <div>
                          <span className="text-[15px] font-medium text-[#141010]">{selectedExistingItem.name}</span>
                          <span className="text-[#5e5e5e] ml-2 font-semibold text-sm">
                            {currencySymbol}{selectedExistingItem.displayPrice}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedExistingItem(null)}
                        className="text-[#5e5e5e] hover:text-red-600 transition-colors p-1 cursor-pointer"
                        title="Deselect"
                      >
                        <CloseIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-[#e7e5e4] bg-[#fdf8f7] flex justify-end gap-3 font-sans">
                <button
                  type="button"
                  onClick={() => setIsAddExistingItemOpen(false)}
                  className="h-10 px-5 rounded-full border border-[#e7e5e4] bg-transparent text-[#141010] font-medium text-[15px] hover:bg-[#f1edec] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddExistingItemSubmit}
                  disabled={!selectedExistingItem || isAddingExistingItem}
                  className="btn-primary h-10 px-6 rounded-full bg-[#0c0a09] text-white font-medium text-[15px] hover:bg-[#252626] transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                  style={{ color: "#ffffff", backgroundColor: "#0c0a09" }}
                >
                  {isAddingExistingItem ? "Adding..." : "Add Item"}
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </PosShell>
  );
}