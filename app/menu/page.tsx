"use client";

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
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function PlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ChevronDownIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ChevronRightIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
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
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ImageIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function TrashIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

// ==========================================
// MAIN MENU COMPONENT
// ==========================================

export default function MenuPage() {
  const organizations = useQuery(api.organizations.list);
  const organization = organizations?.[0] ?? null;

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

  // All Existing Items Query (for Add Existing Item drawer)
  const allExistingItems = useQuery(
    api.menu.listAllItems,
    organization?._id ? { organizationId: organization._id } : "skip"
  );

  // Active Menu State
  const [selectedMenuId, setSelectedMenuId] = useState<Id<"menus"> | null>(null);
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false);

  // Active Category State
  const [selectedCategoryId, setSelectedCategoryId] = useState<Id<"categories"> | null>(null);

  // Modal / Drawer States
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [isEditMenuOpen, setIsEditMenuOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isAddItemDropdownOpen, setIsAddItemDropdownOpen] = useState(false);
  const [isAddExistingItemOpen, setIsAddExistingItemOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
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
  const [itemIsSpicy, setItemIsSpicy] = useState(false);
  const [itemIsAvailable, setItemIsAvailable] = useState(true);
  const [itemShowQuantity, setItemShowQuantity] = useState(false);
  const [itemShowItemType, setItemShowItemType] = useState(false);
  const [itemIsGst, setItemIsGst] = useState(false);
  const [itemMarkAsBestseller, setItemMarkAsBestseller] = useState(false);
  const [itemSkuNumber, setItemSkuNumber] = useState("");
  const [itemAdd3dAndroid, setItemAdd3dAndroid] = useState(false);
  const [itemAdd3dIos, setItemAdd3dIos] = useState(false);
  const [itemAddVideo, setItemAddVideo] = useState(false);
  const [itemDrawerTab, setItemDrawerTab] = useState<"general" | "nutrition">("general");
  const [itemSelectedCategoryId, setItemSelectedCategoryId] = useState<string>("");
  const [itemImageUrl, setItemImageUrl] = useState("");
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

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
    if (!organization?._id) return;
    const trimmed = menuName.trim();
    if (!trimmed) {
      setCreateMenuError("Menu name is required");
      return;
    }

    setIsCreatingMenu(true);
    setCreateMenuError(null);
    try {
      const newMenuId = await createMenuMutation({
        organizationId: organization._id,
        name: trimmed,
        description: menuDescription.trim() || undefined,
        isActive: true,
      });
      setSelectedMenuId(newMenuId);
      setMenuName("");
      setMenuDescription("");
      setIsCreateMenuOpen(false);
    } catch (err) {
      setCreateMenuError(err instanceof Error ? err.message : "Failed to create menu");
    } finally {
      setIsCreatingMenu(false);
    }
  };

  // Open Edit Menu Drawer
  const openEditMenuDrawer = () => {
    if (!activeMenu) return;
    setEditMenuName(activeMenu.name);
    setEditMenuDescription(activeMenu.description || "");
    setIsEditMenuOpen(true);
  };

  // Handle Edit Menu Submit
  const handleEditMenuSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeMenu) return;
    const trimmed = editMenuName.trim();
    if (!trimmed) return;

    setIsUpdatingMenu(true);
    try {
      await updateMenuMutation({
        id: activeMenu._id,
        name: trimmed,
        description: editMenuDescription.trim() || undefined,
      });
      setIsEditMenuOpen(false);
    } catch (err) {
      console.error("Failed to update menu:", err);
    } finally {
      setIsUpdatingMenu(false);
    }
  };

  // Handle Set Default Menu
  const handleSetDefaultMenu = async (menuId: Id<"menus">) => {
    try {
      await setDefaultMenuMutation({ id: menuId });
      setSelectedMenuId(menuId);
      setIsMenuDropdownOpen(false);
    } catch (err) {
      console.error("Failed to set default menu:", err);
    }
  };

  // Handle Delete Menu
  const handleDeleteMenu = async () => {
    if (!activeMenu) return;
    if (!window.confirm(`Are you sure you want to delete menu "${activeMenu.name}"?`)) return;

    try {
      await deleteMenuMutation({ id: activeMenu._id });
      setSelectedMenuId(null);
      setIsEditMenuOpen(false);
    } catch (err) {
      console.error("Failed to delete menu:", err);
    }
  };

  // Handle Category Toggle (Published)
  const handleToggleCategory = async (e: React.MouseEvent, categoryId: Id<"categories">, currentPublished: boolean) => {
    e.stopPropagation();
    try {
      await toggleCategoryPublishedMutation({
        id: categoryId,
        published: !currentPublished,
      });
    } catch (err) {
      console.error("Failed to toggle category status:", err);
    }
  };

  // Handle Save Category
  const handleSaveCategorySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!organization?._id || !activeMenu?._id) return;
    const trimmed = categoryName.trim();
    if (!trimmed) return;

    setIsSavingCategory(true);
    try {
      if (editingCategory) {
        await updateCategoryMutation({
          id: editingCategory._id,
          name: trimmed,
          published: categoryPublished,
        });
      } else {
        const newCatId = await createCategoryMutation({
          organizationId: organization._id,
          menuId: activeMenu._id,
          name: trimmed,
          published: categoryPublished,
          position: (categories?.length || 0),
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

  // Handle Delete Category
  const handleDeleteCategory = async (e: React.MouseEvent, catId: Id<"categories">, name: string) => {
    e.stopPropagation();
    if (!window.confirm(`Delete category "${name}" and unassign all its items?`)) return;

    try {
      await deleteCategoryMutation({ id: catId });
      if (selectedCategoryId === catId) {
        setSelectedCategoryId(null);
      }
    } catch (err) {
      console.error("Failed to delete category:", err);
    }
  };

  // Handle Item Status Toggle (Availability)
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

  // Open Add Item Modal
  const openAddItemDrawer = () => {
    setEditingItem(null);
    setItemName("");
    setItemPrice("");
    setItemDescription("");
    setItemIsVeg(true);
    setItemIsSpicy(false);
    setItemIsAvailable(true);
    setItemShowQuantity(false);
    setItemShowItemType(false);
    setItemIsGst(false);
    setItemMarkAsBestseller(false);
    setItemSkuNumber("");
    setItemAdd3dAndroid(false);
    setItemAdd3dIos(false);
    setItemAddVideo(false);
    setItemDrawerTab("general");
    setItemSelectedCategoryId(activeCategory?._id || "");
    setItemImageUrl("");
    setItemError(null);
    setIsAddItemOpen(true);
  };

  // Open Edit Item Modal
  const openEditItemDrawer = (item: any) => {
    setEditingItem(item);
    setItemName(item.name || "");
    setItemPrice((item.price / 100).toFixed(2));
    setItemDescription(item.description || "");
    setItemIsVeg(item.isVeg ?? true);
    setItemIsSpicy(item.isSpicy ?? false);
    setItemIsAvailable(item.isAvailable ?? true);
    setItemShowQuantity(item.showQuantity ?? false);
    setItemShowItemType(false);
    setItemIsGst(item.isGst ?? false);
    setItemMarkAsBestseller(item.markAsBestseller ?? false);
    setItemSkuNumber(item.skuNumber || "");
    setItemAdd3dAndroid(false);
    setItemAdd3dIos(false);
    setItemAddVideo(false);
    setItemDrawerTab("general");
    setItemSelectedCategoryId(activeCategory?._id || "");
    setItemImageUrl(item.imageUrl || "");
    setItemError(null);
    setIsAddItemOpen(true);
  };

  // Handle Save Item Submit
  const handleSaveItemSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!organization?._id) return;
    const targetCatId = (itemSelectedCategoryId as Id<"categories">) || activeCategory?._id;
    if (!targetCatId) {
      setItemError("Please select a category");
      return;
    }

    const trimmed = itemName.trim();
    const priceNum = parseFloat(itemPrice);

    if (!trimmed) {
      setItemError("Item name is required");
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      setItemError("Please enter a valid price");
      return;
    }

    setIsSavingItem(true);
    setItemError(null);
    const priceInCents = Math.round(priceNum * 100);

    try {
      if (editingItem) {
        await updateItemMutation({
          id: editingItem._id,
          name: trimmed,
          price: priceInCents,
          description: itemDescription.trim() || undefined,
          isVeg: itemIsVeg,
          isSpicy: itemIsSpicy,
          isAvailable: itemIsAvailable,
          markAsBestseller: itemMarkAsBestseller,
        });
      } else {
        const newItemId = await createItemMutation({
          organizationId: organization._id,
          name: trimmed,
          price: priceInCents,
          description: itemDescription.trim() || undefined,
          isVeg: itemIsVeg,
          isSpicy: itemIsSpicy,
          isAvailable: itemIsAvailable,
          isGst: itemIsGst,
          showQuantity: itemShowQuantity,
          skuNumber: itemSkuNumber.trim() || undefined,
          markAsBestseller: itemMarkAsBestseller,
          published: true,
        });

        await addCategoryItemMutation({
          organizationId: organization._id,
          categoryId: targetCatId,
          itemId: newItemId,
          position: (categoryItems?.length || 0),
          published: true,
        });
      }
      setIsAddItemOpen(false);
      setEditingItem(null);
    } catch (err) {
      setItemError(err instanceof Error ? err.message : "Failed to save item");
    } finally {
      setIsSavingItem(false);
    }
  };

  // Filter existing items for search in drawer
  const filteredExistingItems = useMemo(() => {
    if (!allExistingItems) return [];
    if (!existingItemSearchQuery.trim()) return allExistingItems;
    const q = existingItemSearchQuery.toLowerCase();
    return allExistingItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.categoryName && item.categoryName.toLowerCase().includes(q))
    );
  }, [allExistingItems, existingItemSearchQuery]);

  const handleOpenAddExistingItemDrawer = () => {
    setIsAddItemDropdownOpen(false);
    setExistingItemSearchQuery("");
    setSelectedExistingItem(null);
    setExistingItemError(null);
    setIsAddExistingItemOpen(true);
  };

  const handleAddExistingItemSubmit = async (e: FormEvent) => {
    e.preventDefault();
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
    } catch (err) {
      setExistingItemError(err instanceof Error ? err.message : "Failed to add existing item");
    } finally {
      setIsAddingExistingItem(false);
    }
  };

  // Handle Delete Item
  const handleDeleteItem = async (itemId: Id<"items">, itemNameStr: string) => {
    if (!activeCategory?._id) return;
    if (!window.confirm(`Remove "${itemNameStr}" from this category?`)) return;

    try {
      await deleteItemMutation({
        id: itemId,
        categoryId: activeCategory._id,
      });
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  };

  const activeItemsCount = categoryItems?.filter((ci) => ci.item.isAvailable).length || 0;

  return (
    <PosShell title="Menu Management" subtitle="Catalog & Categories">
      <div className="flex flex-col flex-1 min-w-0">
        {/* Workspace Context (Top-level Menu Selector matching Stitch) */}
        <div className="bg-[#fdf8f7] px-6 lg:px-8 py-6 border-b border-[#e7e5e4] shrink-0">
          <div className="flex items-end justify-between max-w-7xl mx-auto w-full">
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
                  <div className="absolute top-full left-0 z-40 mt-2 w-64 rounded-xl border border-[#e7e5e4] bg-[#fdf8f7] p-2 shadow-xl font-sans">
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">
                      Select Menu
                    </div>
                    {menus && menus.length > 0 ? (
                      menus.map((m) => (
                        <button
                          key={m._id}
                          type="button"
                          onClick={() => {
                            setSelectedMenuId(m._id);
                            setIsMenuDropdownOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                            m._id === selectedMenuId
                              ? "bg-[#f1edec] font-semibold text-[#141010]"
                              : "text-[#5e5e5e] hover:bg-[#fafafa]"
                          }`}
                        >
                          <span>{m.name}</span>
                          {m.isDefault && (
                            <span className="text-[10px] bg-[#e6e1e1] text-[#5e5e5e] px-1.5 py-0.5 rounded font-semibold uppercase">
                              Default
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-[#5e5e5e]">No menus available</div>
                    )}

                    <div className="mt-2 border-t border-[#e7e5e4] pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuDropdownOpen(false);
                          setIsCreateMenuOpen(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#141010] hover:bg-[#f1edec] transition cursor-pointer"
                      >
                        <PlusIcon className="w-3.5 h-3.5" /> Create New Menu
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons matching Stitch */}
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
          <div className="max-w-7xl mx-auto w-full p-8 text-center bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] mt-6">
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

        {/* Two Panel Layout (Matching Stitch HTML + Drag & Drop Reordering) */}
        {activeMenu && (
          <div className="flex-1 flex flex-col lg:flex-row w-full max-w-7xl mx-auto p-6 gap-6 min-h-[calc(100vh-190px)]">
            {/* Left Panel (Categories) */}
            <div className="w-full lg:w-1/3 flex flex-col bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] overflow-hidden min-h-[500px]">
              {/* Header */}
              <div className="p-4 border-b border-[#e7e5e4] flex justify-between items-center bg-[#fdf8f7] shrink-0">
                <h2 className="font-sans text-[18px] font-semibold text-[#141010]">Categories</h2>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCategory(null);
                    setCategoryName("");
                    setCategoryPublished(true);
                    setIsAddCategoryOpen(true);
                  }}
                  className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#141010] transition-colors cursor-pointer"
                  title="Add Category"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Category List */}
              <div className="flex-1 overflow-y-auto divide-y divide-[#e7e5e4]">
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
                        onClick={() => setSelectedCategoryId(cat._id)}
                        className={`flex items-center justify-between p-4 cursor-pointer transition-colors select-none group ${
                          isSelected
                            ? "bg-[#fafafa] border-l-2 border-l-[#0c0a09]"
                            : "hover:bg-white border-l-2 border-l-transparent"
                        }`}
                        title="Drag to reorder category"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`cursor-grab active:cursor-grabbing text-[#5e5e5e] text-[18px] transition-opacity ${
                              isSelected ? "opacity-70" : "opacity-0 group-hover:opacity-50"
                            }`}
                          >
                            <DragHandleIcon className="w-4 h-4" />
                          </span>
                          <span
                            className={`text-[15px] font-medium ${
                              isSelected ? "text-[#141010] font-semibold" : "text-[#5e5e5e]"
                            }`}
                          >
                            {cat.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Toggle Capsule Switch */}
                          <div
                            onClick={(e) => handleToggleCategory(e, cat._id, cat.published)}
                            className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${
                              cat.published
                                ? "bg-[#0c0a09]"
                                : "bg-[#e6e1e1] border border-[#e7e5e4]"
                            }`}
                            title={cat.published ? "Category Published" : "Category Hidden"}
                          >
                            <div
                              className={`absolute top-[2px] w-3 h-3 rounded-full transition-all ${
                                cat.published
                                  ? "right-[2px] bg-white"
                                  : "left-[2px] bg-[#5e5e5e]"
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
                            className={`w-6 h-6 rounded hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] transition-colors cursor-pointer ${
                              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                            }`}
                            title="Edit Category"
                          >
                            <EditPencilIcon className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteCategory(e, cat._id, cat.name)}
                            className="opacity-0 group-hover:opacity-100 text-[#5e5e5e] hover:text-red-600 transition cursor-pointer p-0.5"
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
                    No categories found. Click <strong>+</strong> to add one.
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel (Items) */}
            <div className="flex-1 flex flex-col bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] overflow-hidden min-h-[500px]">
              {activeCategory ? (
                <>
                  {/* Breadcrumb & Header matching Stitch */}
                  <div className="p-6 border-b border-[#e7e5e4] bg-[#fdf8f7] shrink-0 flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-1.5 text-[#5e5e5e] font-sans text-[11px] uppercase tracking-wider mb-2 font-semibold">
                        <span>{activeMenu.name}</span>
                        <ChevronRightIcon className="w-3.5 h-3.5" />
                        <span className="text-[#141010] font-bold">{activeCategory.name}</span>
                      </div>
                      <h2 className="font-garamond text-[26px] md:text-[30px] font-normal text-[#141010] leading-tight">
                        Items in {activeCategory.name}
                      </h2>
                      <p className="font-sans text-[13px] text-[#5e5e5e] mt-1">
                        {activeItemsCount} active {activeItemsCount === 1 ? "item" : "items"} in this category.
                      </p>
                    </div>

                    {/* Add Item Dropdown Container matching User Image */}
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsAddItemDropdownOpen(!isAddItemDropdownOpen)}
                        className="btn-primary h-10 px-5 rounded-full bg-[#0c0a09] text-white font-medium text-[15px] hover:bg-[#252626] transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                        style={{ color: "#ffffff", backgroundColor: "#0c0a09" }}
                      >
                        <PlusIcon className="w-4 h-4" />
                        <span style={{ color: "#ffffff" }}>Add Item</span>
                        <ChevronDownIcon className="w-4 h-4 ml-0.5 opacity-80" />
                      </button>

                      {/* Dropdown Popover */}
                      {isAddItemDropdownOpen && (
                        <div className="absolute right-0 top-full mt-2 w-44 rounded-xl bg-[#252626] text-white py-1.5 shadow-2xl z-40 border border-[#3a3a3a] font-sans divide-y divide-white/10">
                          <button
                            type="button"
                            onClick={handleOpenAddExistingItemDrawer}
                            className="w-full text-center px-4 py-3 text-sm font-semibold hover:bg-white/10 transition cursor-pointer text-white"
                            style={{ color: "#ffffff" }}
                          >
                            Existing item
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddItemDropdownOpen(false);
                              openAddItemDrawer();
                            }}
                            className="w-full text-center px-4 py-3 text-sm font-semibold hover:bg-white/10 transition cursor-pointer text-white"
                            style={{ color: "#ffffff" }}
                          >
                            New item
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items Table matching Stitch */}
                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-white sticky top-0 border-b border-[#e7e5e4] z-10 font-sans text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
                        <tr>
                          <th className="w-10 px-3 py-3 text-center"></th>
                          <th className="px-4 py-3">Item Details</th>
                          <th className="px-4 py-3 w-32 text-right">Base Price</th>
                          <th className="px-4 py-3 w-24 text-center">Status</th>
                          <th className="w-16 px-3 py-3 text-right"></th>
                        </tr>
                      </thead>
                      <tbody className="font-sans divide-y divide-[#e7e5e4]">
                        {categoryItems && categoryItems.length > 0 ? (
                          categoryItems.map(({ categoryItemId, item }, index) => {
                            const isSoldOut = !item.isAvailable;
                            return (
                              <tr
                                key={categoryItemId}
                                draggable
                                onDragStart={(e) => handleItemDragStart(e, index)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleItemDrop(e, index)}
                                className={`hover:bg-[#fafafa] transition-colors group cursor-default ${
                                  isSoldOut ? "opacity-65" : ""
                                }`}
                                title="Drag to reorder item"
                              >
                                {/* Drag Handle */}
                                <td className="px-3 py-3 text-center">
                                  <span className="cursor-grab active:cursor-grabbing text-[#5e5e5e] text-[18px] opacity-0 group-hover:opacity-60 transition-opacity">
                                    <DragHandleIcon className="w-4 h-4" />
                                  </span>
                                </td>

                                {/* Item Details */}
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-[#f1edec] border border-[#e7e5e4] overflow-hidden shrink-0 flex items-center justify-center">
                                      {item.imageUrl ? (
                                        <img
                                          src={item.imageUrl}
                                          alt={item.name}
                                          className={`w-full h-full object-cover ${isSoldOut ? "grayscale" : ""}`}
                                        />
                                      ) : item.name.toLowerCase().includes("burger") ? (
                                        <div className="h-full w-full bg-[linear-gradient(135deg,#4a2c1d,#b87333)] flex items-center justify-center text-lg text-white">
                                          🍔
                                        </div>
                                      ) : item.name.toLowerCase().includes("cake") ? (
                                        <div className="h-full w-full bg-[#7a9a7a] flex items-center justify-center text-lg text-white">
                                          🍰
                                        </div>
                                      ) : (
                                        <span className="text-lg text-[#5e5e5e]">🖼</span>
                                      )}
                                    </div>

                                    <div>
                                      <p className="text-[16px] font-medium text-[#141010] leading-snug">
                                        {item.name}
                                      </p>
                                      {item.description && (
                                        <p className="text-[#5e5e5e] text-[13px] line-clamp-1 mt-0.5 max-w-md">
                                          {item.description}
                                        </p>
                                      )}
                                      {isSoldOut && (
                                        <span className="inline-block mt-1 px-1.5 py-0.5 bg-[#e6e1e1] text-[#5e5e5e] text-[10px] uppercase font-bold tracking-wider rounded">
                                          Sold Out
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* Base Price */}
                                <td className="px-4 py-3 text-right font-medium text-[#141010] text-[15px]">
                                  ${item.displayPrice}
                                </td>

                                {/* Status Toggle */}
                                <td className="px-4 py-3 text-center">
                                  <div
                                    onClick={() =>
                                      handleToggleItemAvailability(item._id, item.isAvailable)
                                    }
                                    className={`w-8 h-4 rounded-full relative cursor-pointer inline-block transition-colors ${
                                      item.isAvailable
                                        ? "bg-[#0c0a09]"
                                        : "bg-[#e6e1e1] border border-[#e7e5e4]"
                                    }`}
                                    title={item.isAvailable ? "Available" : "Sold Out"}
                                  >
                                    <div
                                      className={`absolute top-[2px] w-3 h-3 rounded-full transition-all ${
                                        item.isAvailable
                                          ? "right-[2px] bg-white"
                                          : "left-[2px] bg-[#5e5e5e]"
                                      }`}
                                    />
                                  </div>
                                </td>

                                {/* Edit Actions */}
                                <td className="px-3 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => openEditItemDrawer(item)}
                                      className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] hover:text-[#141010] transition-colors cursor-pointer"
                                      title="Edit Item"
                                    >
                                      <EditPencilIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteItem(item._id, item.name)}
                                      className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center text-[#5e5e5e] hover:text-red-600 transition-colors cursor-pointer"
                                      title="Delete Item"
                                    >
                                      <TrashIcon className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-16 text-center text-sm text-[#5e5e5e]">
                              No items in this category yet. Click <strong>+ Add Item</strong> to create one.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="py-24 text-center text-sm text-[#5e5e5e]">
                  Select or create a category on the left to view its items.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* SLIDE-OVER DRAWER: CREATE MENU                       */}
        {/* ---------------------------------------------------- */}
        {isCreateMenuOpen && (
          <div className="fixed inset-0 bg-[#0c0a09]/20 backdrop-blur-sm z-50 transition-opacity flex justify-end font-sans">
            <div className="h-full w-96 max-w-full bg-[#fdf8f7] shadow-2xl border-l border-[#e7e5e4] transform transition-transform duration-300 flex flex-col justify-between">
              {/* Header */}
              <div className="px-6 py-5 border-b border-[#e7e5e4] flex items-start justify-between bg-[#fdf8f7]">
                <div>
                  <h3 className="font-garamond text-[24px] text-[#141010] font-normal leading-tight">Create Menu</h3>
                  <p className="text-[#5e5e5e] text-[13px] mt-1 font-sans">Create a menu to organize your categories and items.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateMenuOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] hover:text-[#141010] transition-colors cursor-pointer shrink-0"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 p-6 overflow-y-auto">
                {createMenuError && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {createMenuError}
                  </div>
                )}

                <form id="create-menu-form" onSubmit={handleCreateMenuSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="font-sans text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">
                      Menu Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={menuName}
                      onChange={(e) => setMenuName(e.target.value)}
                      placeholder="Enter menu name (e.g., Dessert Menu)"
                      className="w-full h-12 px-4 rounded-lg border border-[#e7e5e4] bg-[#fafafa] text-[#141010] placeholder:text-[#928c8a] focus:outline-none focus:border-[#141010] focus:ring-1 focus:ring-[#141010] transition-colors font-sans text-[15px]"
                      style={{ backgroundColor: "#fafafa", color: "#141010", borderColor: "#e7e5e4" }}
                      autoFocus
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="font-sans text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">
                      Description (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={menuDescription}
                      onChange={(e) => setMenuDescription(e.target.value)}
                      placeholder="Add an optional description for this menu..."
                      className="w-full p-3.5 rounded-lg border border-[#e7e5e4] bg-[#fafafa] text-[#141010] placeholder:text-[#928c8a] focus:outline-none focus:border-[#141010] focus:ring-1 focus:ring-[#141010] transition-colors font-sans text-[14px]"
                      style={{ backgroundColor: "#fafafa", color: "#141010", borderColor: "#e7e5e4" }}
                    />
                  </div>
                </form>
              </div>

              {/* Footer */}
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
        {/* SLIDE-OVER DRAWER: EDIT MENU DETAILS                 */}
        {/* ---------------------------------------------------- */}
        {isEditMenuOpen && activeMenu && (
          <div className="fixed inset-0 bg-[#0c0a09]/20 backdrop-blur-sm z-50 transition-opacity flex justify-end font-sans">
            <div className="h-full w-96 max-w-full bg-[#fdf8f7] shadow-2xl border-l border-[#e7e5e4] transform transition-transform duration-300 flex flex-col justify-between">
              {/* Header */}
              <div className="px-6 py-5 border-b border-[#e7e5e4] flex items-start justify-between bg-[#fdf8f7]">
                <div>
                  <h3 className="font-garamond text-[24px] text-[#141010] font-normal leading-tight">Edit Menu</h3>
                  <p className="text-[#5e5e5e] text-[13px] mt-1 font-sans">
                    Update menu settings or set as default active menu.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditMenuOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] hover:text-[#141010] transition-colors cursor-pointer shrink-0"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 p-6 overflow-y-auto">
                <form id="edit-menu-form" onSubmit={handleEditMenuSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="font-sans text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">
                      Menu Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editMenuName}
                      onChange={(e) => setEditMenuName(e.target.value)}
                      placeholder="Enter menu name (e.g., Dessert Menu)"
                      className="w-full h-12 px-4 rounded-lg border border-[#e7e5e4] bg-[#fafafa] text-[#141010] placeholder:text-[#928c8a] focus:outline-none focus:border-[#141010] focus:ring-1 focus:ring-[#141010] transition-colors font-sans text-[15px]"
                      style={{ backgroundColor: "#fafafa", color: "#141010", borderColor: "#e7e5e4" }}
                      autoFocus
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="font-sans text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">
                      Description (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={editMenuDescription}
                      onChange={(e) => setEditMenuDescription(e.target.value)}
                      placeholder="Add an optional description for this menu..."
                      className="w-full p-3.5 rounded-lg border border-[#e7e5e4] bg-[#fafafa] text-[#141010] placeholder:text-[#928c8a] focus:outline-none focus:border-[#141010] focus:ring-1 focus:ring-[#141010] transition-colors font-sans text-[14px]"
                      style={{ backgroundColor: "#fafafa", color: "#141010", borderColor: "#e7e5e4" }}
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleSetDefaultMenu(activeMenu._id)}
                      className="w-full rounded-lg border border-[#e7e5e4] bg-[#f1edec] py-3 text-xs font-medium text-[#141010] hover:bg-[#ece7e6] transition cursor-pointer"
                    >
                      {activeMenu.isDefault ? "✓ Currently Default Menu" : "Set as Default Active Menu"}
                    </button>
                  </div>

                  <div className="pt-3 border-t border-[#e7e5e4]">
                    <button
                      type="button"
                      onClick={handleDeleteMenu}
                      className="w-full rounded-lg border border-red-200 bg-red-50 py-3 text-xs font-medium text-red-700 hover:bg-red-100 transition cursor-pointer"
                    >
                      Delete this Menu
                    </button>
                  </div>
                </form>
              </div>

              {/* Footer */}
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
        {/* MODAL / DRAWER: ADD / EDIT CATEGORY                  */}
        {/* ---------------------------------------------------- */}
        {isAddCategoryOpen && (
          <div className="fixed inset-0 bg-[#0c0a09]/20 backdrop-blur-sm z-50 transition-opacity flex justify-end font-sans">
            <div className="h-full w-96 max-w-full bg-[#fdf8f7] shadow-2xl border-l border-[#e7e5e4] transform transition-transform duration-300 flex flex-col justify-between">
              {/* Header */}
              <div className="px-6 py-5 border-b border-[#e7e5e4] flex items-start justify-between bg-[#fdf8f7]">
                <div>
                  <h3 className="font-garamond text-[24px] text-[#141010] font-normal leading-tight">
                    {editingCategory ? "Edit Category" : "Add Category"}
                  </h3>
                  <p className="text-[#5e5e5e] text-[13px] mt-1 font-sans">
                    Categories group your dishes on the menu.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddCategoryOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] hover:text-[#141010] transition-colors cursor-pointer shrink-0"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 p-6 overflow-y-auto">
                <form id="category-form" onSubmit={handleSaveCategorySubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="font-sans text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">
                      Category Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      placeholder="e.g., Viral Food, Beverages, Starters"
                      className="w-full h-12 px-4 rounded-lg border border-[#e7e5e4] bg-[#fafafa] focus:outline-none focus:border-[#141010] focus:ring-1 focus:ring-[#141010] transition-colors font-sans text-[15px] text-[#141010] placeholder:text-[#928c8a]"
                      style={{ backgroundColor: "#fafafa", color: "#141010", borderColor: "#e7e5e4" }}
                      autoFocus
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-[#e7e5e4] bg-[#f1edec] p-4">
                    <div>
                      <div className="text-sm font-medium text-[#141010]">Active / Published</div>
                      <div className="text-[11px] text-[#5e5e5e] mt-0.5">Visible to customers and staff</div>
                    </div>
                    <div
                      onClick={() => setCategoryPublished(!categoryPublished)}
                      className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${
                        categoryPublished ? "bg-[#0c0a09]" : "bg-[#e6e1e1] border border-[#e7e5e4]"
                      }`}
                    >
                      <div
                        className={`absolute top-[2px] w-3 h-3 rounded-full transition-all ${
                          categoryPublished ? "right-[2px] bg-white" : "left-[2px] bg-[#5e5e5e]"
                        }`}
                      />
                    </div>
                  </div>
                </form>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-[#e7e5e4] bg-[#fdf8f7] flex justify-end gap-3 font-sans">
                <button
                  type="button"
                  onClick={() => setIsAddCategoryOpen(false)}
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
              {/* Drawer Header */}
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

              {/* Drawer Body */}
              <div className="flex-1 p-6 overflow-y-auto space-y-5">
                {existingItemError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {existingItemError}
                  </div>
                )}

                {/* Search Input with floating label */}
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

                {/* Search Results List */}
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
                              <div className="text-sm font-semibold text-[#141010]">${item.displayPrice}</div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="p-4 text-center text-xs text-[#5e5e5e]">
                      {allExistingItems && allExistingItems.length === 0
                        ? "No items in catalog yet. Create a new item first."
                        : "No matching items found."}
                    </div>
                  )}
                </div>

                {/* Selected Item Box */}
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
                            ${selectedExistingItem.displayPrice}
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

              {/* Drawer Footer */}
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

        {/* ---------------------------------------------------- */}
        {/* SLIDE-OVER DRAWER: ADD / EDIT ITEM (STITCH MATCH)    */}
        {/* ---------------------------------------------------- */}
        {isAddItemOpen && (
          <div className="fixed inset-0 bg-[#0c0a09]/20 backdrop-blur-sm z-50 transition-opacity flex justify-end font-sans">
            <aside className="w-full max-w-md bg-[#fdf8f7] h-full shadow-2xl flex flex-col border-l border-[#e7e5e4] transform transition-transform duration-300 justify-between">
              {/* Drawer Header */}
              <div className="px-6 py-4 border-b border-[#e7e5e4] flex items-center justify-between bg-white">
                <h2 className="font-garamond text-[24px] text-[#141010] font-normal leading-tight">
                  {editingItem ? "Edit item" : "Add new item"}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsAddItemOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] hover:text-[#141010] transition-colors cursor-pointer shrink-0"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex px-6 border-b border-[#e7e5e4] bg-white">
                <button
                  type="button"
                  onClick={() => setItemDrawerTab("general")}
                  className={`px-4 py-3 font-medium text-[15px] border-b-2 mr-4 transition-colors cursor-pointer ${
                    itemDrawerTab === "general"
                      ? "text-[#141010] border-[#141010]"
                      : "text-[#5e5e5e] hover:text-[#141010] border-transparent"
                  }`}
                >
                  General
                </button>
                <button
                  type="button"
                  onClick={() => setItemDrawerTab("nutrition")}
                  className={`px-4 py-3 font-medium text-[15px] border-b-2 transition-colors cursor-pointer ${
                    itemDrawerTab === "nutrition"
                      ? "text-[#141010] border-[#141010]"
                      : "text-[#5e5e5e] hover:text-[#141010] border-transparent"
                  }`}
                >
                  Nutrition info
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 bg-white">
                {itemError && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {itemError}
                  </div>
                )}

                {itemDrawerTab === "general" ? (
                  <form id="item-form" onSubmit={handleSaveItemSubmit} className="space-y-6">
                    {/* Section 1: Item Image */}
                    <section className="space-y-3">
                      <h3 className="font-sans text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">
                        Item image
                      </h3>
                      <div className="space-y-3">
                        {/* Upload Area */}
                        <div className="border border-dashed border-[#d1c4c1] rounded-lg p-6 flex flex-col items-center justify-center text-center bg-[#fafafa] hover:bg-[#f1edec] transition-colors cursor-pointer group">
                          <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-2 group-hover:scale-105 transition-transform border border-[#e7e5e4]">
                            <ImageIcon className="w-5 h-5 text-[#5e5e5e]" />
                          </div>
                          <span className="font-medium text-[14px] text-[#141010] mb-0.5">+ Add Image</span>
                          <span className="text-[12px] text-[#5e5e5e]">Drag and drop or click to upload</span>
                        </div>

                        {/* Image Options */}
                        <div className="space-y-2 pt-1">
                          <label className="flex items-center space-x-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={itemAdd3dAndroid}
                              onChange={(e) => setItemAdd3dAndroid(e.target.checked)}
                              className="w-4 h-4 rounded border-[#d1c4c1] text-[#141010] focus:ring-[#141010]"
                            />
                            <span className="text-[14px] text-[#4e4543] group-hover:text-[#141010] transition-colors">
                              Add 3d images (Android)
                            </span>
                          </label>
                          <label className="flex items-center space-x-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={itemAdd3dIos}
                              onChange={(e) => setItemAdd3dIos(e.target.checked)}
                              className="w-4 h-4 rounded border-[#d1c4c1] text-[#141010] focus:ring-[#141010]"
                            />
                            <span className="text-[14px] text-[#4e4543] group-hover:text-[#141010] transition-colors">
                              Add 3d images (Ios)
                            </span>
                          </label>
                          <label className="flex items-center space-x-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={itemAddVideo}
                              onChange={(e) => setItemAddVideo(e.target.checked)}
                              className="w-4 h-4 rounded border-[#d1c4c1] text-[#141010] focus:ring-[#141010]"
                            />
                            <span className="text-[14px] text-[#4e4543] group-hover:text-[#141010] transition-colors">
                              Add video
                            </span>
                          </label>
                        </div>
                      </div>
                    </section>

                    <div className="h-px bg-[#e7e5e4] w-full" />

                    {/* Section 2: Category */}
                    <section className="space-y-2">
                      <label className="block font-sans text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">
                        Select category
                      </label>
                      <div className="relative">
                        <select
                          value={itemSelectedCategoryId || activeCategory?._id || ""}
                          onChange={(e) => setItemSelectedCategoryId(e.target.value)}
                          className="w-full appearance-none bg-[#fafafa] border border-[#e7e5e4] rounded-lg px-4 py-3 font-sans text-[15px] text-[#141010] focus:outline-none focus:border-[#141010] transition-colors cursor-pointer"
                          style={{ backgroundColor: "#fafafa", color: "#141010", borderColor: "#e7e5e4" }}
                        >
                          {categories?.map((cat) => (
                            <option key={cat._id} value={cat._id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#5e5e5e]">
                          <ChevronDownIcon className="w-4 h-4" />
                        </div>
                      </div>
                    </section>

                    {/* Section 3: Item Details */}
                    <section className="space-y-4">
                      <div className="space-y-2">
                        <label className="block font-sans text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">
                          Item name *
                        </label>
                        <input
                          type="text"
                          required
                          value={itemName}
                          onChange={(e) => setItemName(e.target.value)}
                          placeholder="Enter item name"
                          className="w-full bg-[#fafafa] border border-[#e7e5e4] rounded-lg px-4 py-3 font-sans text-[15px] text-[#141010] placeholder:text-[#928c8a] focus:outline-none focus:border-[#141010] transition-colors"
                          style={{ backgroundColor: "#fafafa", color: "#141010", borderColor: "#e7e5e4" }}
                          autoFocus
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block font-sans text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">
                          Add price *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="text-[#5e5e5e] text-[15px]">₹</span>
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={itemPrice}
                            onChange={(e) => setItemPrice(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-[#fafafa] border border-[#e7e5e4] rounded-lg pl-9 pr-4 py-3 font-sans text-[15px] text-[#141010] placeholder:text-[#928c8a] focus:outline-none focus:border-[#141010] transition-colors"
                            style={{ backgroundColor: "#fafafa", color: "#141010", borderColor: "#e7e5e4" }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block font-sans text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">
                          Enter description
                        </label>
                        <div className="border border-[#e7e5e4] rounded-lg overflow-hidden focus-within:border-[#141010] transition-colors bg-[#fafafa]">
                          {/* Formatting Toolbar */}
                          <div className="flex items-center space-x-1 p-2 border-b border-[#e7e5e4] bg-[#f1edec] text-[#5e5e5e]">
                            <button
                              type="button"
                              className="px-2 py-1 hover:bg-white rounded transition-colors text-xs font-bold"
                            >
                              B
                            </button>
                            <button
                              type="button"
                              className="px-2 py-1 hover:bg-white rounded transition-colors text-xs italic font-serif"
                            >
                              I
                            </button>
                            <button
                              type="button"
                              className="px-2 py-1 hover:bg-white rounded transition-colors text-xs underline"
                            >
                              U
                            </button>
                            <div className="w-px h-4 bg-[#e7e5e4] mx-1" />
                            <button
                              type="button"
                              className="px-2 py-1 hover:bg-white rounded transition-colors text-xs"
                            >
                              • List
                            </button>
                          </div>
                          <textarea
                            rows={3}
                            value={itemDescription}
                            onChange={(e) => setItemDescription(e.target.value)}
                            placeholder="Enter item description"
                            className="w-full bg-[#fafafa] border-none px-4 py-3 font-sans text-[14px] text-[#141010] placeholder:text-[#928c8a] focus:outline-none resize-none"
                            style={{ backgroundColor: "#fafafa", color: "#141010" }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block font-sans text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">
                          Search code
                        </label>
                        <input
                          type="text"
                          value={itemSkuNumber}
                          onChange={(e) => setItemSkuNumber(e.target.value)}
                          placeholder="Enter search code for this item. Ex: 1211"
                          className="w-full bg-[#fafafa] border border-[#e7e5e4] rounded-lg px-4 py-3 font-sans text-[15px] text-[#141010] placeholder:text-[#928c8a] focus:outline-none focus:border-[#141010] transition-colors"
                          style={{ backgroundColor: "#fafafa", color: "#141010", borderColor: "#e7e5e4" }}
                        />
                        <p className="text-[11px] text-[#5e5e5e] leading-tight">
                          Note: Assign a unique code to this menu item. Each code must be different, as it will be used in the Cashier section to speed up the billing process.
                        </p>
                      </div>
                    </section>

                    <div className="h-px bg-[#e7e5e4] w-full" />

                    {/* Section 4: Item Settings */}
                    <section className="space-y-3">
                      <label className="flex items-center space-x-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={itemShowQuantity}
                          onChange={(e) => setItemShowQuantity(e.target.checked)}
                          className="w-4 h-4 rounded border-[#d1c4c1] text-[#141010] focus:ring-[#141010]"
                        />
                        <span className="text-[14px] text-[#141010]">Show quantity</span>
                      </label>

                      <label className="flex items-center space-x-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={itemShowItemType}
                          onChange={(e) => setItemShowItemType(e.target.checked)}
                          className="w-4 h-4 rounded border-[#d1c4c1] text-[#141010] focus:ring-[#141010]"
                        />
                        <span className="text-[14px] text-[#141010]">Show item type</span>
                      </label>

                      <label className="flex items-center space-x-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={itemIsGst}
                          onChange={(e) => setItemIsGst(e.target.checked)}
                          className="w-4 h-4 rounded border-[#d1c4c1] text-[#141010] focus:ring-[#141010]"
                        />
                        <span className="text-[14px] text-[#141010]">Is this item taxable?</span>
                      </label>

                      <label className="flex items-center space-x-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={itemMarkAsBestseller}
                          onChange={(e) => setItemMarkAsBestseller(e.target.checked)}
                          className="w-4 h-4 rounded border-[#d1c4c1] text-[#141010] focus:ring-[#141010]"
                        />
                        <span className="text-[14px] text-[#141010]">Mark this item as Bestseller</span>
                      </label>

                      <label className="flex items-center space-x-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={itemIsSpicy}
                          onChange={(e) => setItemIsSpicy(e.target.checked)}
                          className="w-4 h-4 rounded border-[#d1c4c1] text-[#141010] focus:ring-[#141010]"
                        />
                        <span className="text-[14px] text-[#141010]">Mark this item as Spicy</span>
                      </label>

                      <label className="flex items-center space-x-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={itemIsVeg}
                          onChange={(e) => setItemIsVeg(e.target.checked)}
                          className="w-4 h-4 rounded border-[#d1c4c1] text-[#141010] focus:ring-[#141010]"
                        />
                        <span className="text-[14px] text-[#141010]">Vegetarian item</span>
                      </label>

                      <div className="flex items-center justify-between rounded-lg border border-[#e7e5e4] bg-[#fafafa] p-3.5 mt-2">
                        <div>
                          <div className="text-sm font-medium text-[#141010]">In Stock / Available</div>
                          <div className="text-[11px] text-[#5e5e5e] mt-0.5">Displays as Sold Out when off</div>
                        </div>
                        <div
                          onClick={() => setItemIsAvailable(!itemIsAvailable)}
                          className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${
                            itemIsAvailable ? "bg-[#0c0a09]" : "bg-[#e6e1e1] border border-[#e7e5e4]"
                          }`}
                        >
                          <div
                            className={`absolute top-[2px] w-3 h-3 rounded-full transition-all ${
                              itemIsAvailable ? "right-[2px] bg-white" : "left-[2px] bg-[#5e5e5e]"
                            }`}
                          />
                        </div>
                      </div>
                    </section>
                  </form>
                ) : (
                  /* Nutrition Info Tab */
                  <div className="h-full flex flex-col items-center justify-center text-center py-16">
                    <div className="w-16 h-16 rounded-full bg-[#f1edec] flex items-center justify-center mb-4 text-[#5e5e5e]">
                      <span className="text-2xl font-serif">⚖</span>
                    </div>
                    <h3 className="font-garamond text-[24px] text-[#141010] mb-1">Nutrition information</h3>
                    <p className="font-sans text-[14px] text-[#5e5e5e] max-w-[250px]">
                      Nutrition details will be available soon.
                    </p>
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-6 border-t border-[#e7e5e4] bg-[#fdf8f7] flex justify-end gap-3 font-sans">
                <button
                  type="button"
                  onClick={() => setIsAddItemOpen(false)}
                  className="h-10 px-6 rounded-full border border-[#e7e5e4] bg-transparent text-[#141010] font-medium text-[15px] hover:bg-[#f1edec] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="item-form"
                  disabled={isSavingItem}
                  className="btn-primary h-10 px-6 rounded-full bg-[#0c0a09] text-white font-medium text-[15px] hover:bg-[#252626] transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                  style={{ color: "#ffffff", backgroundColor: "#0c0a09" }}
                >
                  {isSavingItem ? "Saving..." : editingItem ? "Save Changes" : "Create"}
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </PosShell>
  );
}
