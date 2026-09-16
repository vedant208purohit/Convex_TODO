"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { generateDefxReceiptPlainString } from "../utils/defxReceiptFormatter";
import { openReceiptPdfInNewTab } from "../utils/generateReceiptPdf";

// ==========================================
// TYPES
// ==========================================

interface CartItem {
  itemId: Id<"items">;
  name: string;
  price: number; // in minor units (paise)
  quantity: number;
  isVeg: boolean;
  unit?: string;
  description?: string;
  customizations?: Array<{
    customizationId: Id<"customizations">;
    optionId: Id<"customizationItems">;
    name?: string;
    price?: number;
  }>;
}

interface CartTab {
  id: string;
  label: string;
  items: CartItem[];
  orderType: "DineIn" | "TakeAway" | "Delivery";
  tableId?: string;
  tableName?: string;
  customerName: string;
  customerPhone: string;
  specialNotes: string;
  deliveryAddress?: {
    addressLine1: string;
    landmark?: string;
    city: string;
    zipCode: string;
  };
}

// ==========================================
// MAIN CASHIER PAGE COMPONENT
// ==========================================

export default function CashierPosPage() {
  const router = useRouter();

  // 1. Resolve Organization
  const orgs = useQuery(api.organizations.list, {});
  const activeOrg = useMemo(() => {
    if (!orgs || orgs.length === 0) return null;
    return orgs[0];
  }, [orgs]);

  // 2. Query Menu Data & Categories
  const menuCategories = useQuery(
    api.menu.getOrganizationMenu,
    activeOrg ? { organizationId: activeOrg._id } : "skip",
  );

  // 3. Query Tables, Payment Modes, and Printers
  const tables = useQuery(api.organizationTables.list, {});
  const paymentModesList = useQuery(
    api.paymentModes.list,
    activeOrg ? { organizationId: activeOrg._id } : {},
  );
  const printers = useQuery(api.organizationPrinters.list, {});

  // 4. Mutations
  const createOrderMutation = useMutation(api.orders.createOrder);

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  // Step Indicator: 1: Build Order | 2: Order Details | 3: Payment
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Multi-cart Tabs
  const [cartTabs, setCartTabs] = useState<CartTab[]>([
    {
      id: "cart-1",
      label: "Cart 1",
      items: [],
      orderType: "DineIn",
      customerName: "",
      customerPhone: "",
      specialNotes: "",
    },
  ]);
  const [activeCartId, setActiveCartId] = useState<string>("cart-1");

  // Search & Insertion State
  const [searchQuery, setSearchQuery] = useState("");
  const [inputQty, setInputQty] = useState<number>(1);
  const [selectedCategory, setSelectedCategory] = useState<string>("All Items");
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Payment Step State
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>("Cash");
  const [tenderCashGiven, setTenderCashGiven] = useState<string>("");
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [completedOrderData, setCompletedOrderData] = useState<any>(null);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

  // Live Printer Connection Probing
  const [printerStatus, setPrinterStatus] = useState<
    "checking" | "connected" | "disconnected"
  >("checking");

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Helper Toast
  const showToast = (msg: string) => {
    setNotificationToast(msg);
    setTimeout(() => {
      setNotificationToast(null);
    }, 4000);
  };

  // Active Cart Reference
  const activeCart = useMemo(() => {
    return cartTabs.find((c) => c.id === activeCartId) || cartTabs[0];
  }, [cartTabs, activeCartId]);

  // Extract Flat Menu Items for Search & Catalog
  const allCatalogItems = useMemo(() => {
    if (!menuCategories || menuCategories.length === 0) return [];
    const itemsList: Array<{
      categoryName: string;
      categoryId: string;
      item: any;
      itemImageUrl?: string;
      customizations?: any[];
    }> = [];

    for (const catEntry of menuCategories) {
      const catObj = catEntry?.category || catEntry;
      const categoryName = catObj?.name || "General";
      const categoryId = catObj?.id || catObj?._id || "";
      const rawItems = catObj?.items || [];

      if (Array.isArray(rawItems)) {
        for (const rawIt of rawItems) {
          const actualItem = rawIt?.item || rawIt;
          const itemImageUrl =
            rawIt?.item_image_url?.original ||
            (typeof rawIt?.item_image_url === "string" ? rawIt.item_image_url : undefined) ||
            actualItem?.imageUrl;
          const customizations = rawIt?.customizations || actualItem?.customizations || [];

          // Exclude unpublished and unavailable items matching defx-pos behavior
          if (
            actualItem.published === false ||
            actualItem.is_published === false ||
            actualItem.isAvailable === false ||
            actualItem.is_available === false
          ) {
            continue;
          }

          if (actualItem && (actualItem.name || actualItem._id || actualItem.id)) {
            itemsList.push({
              categoryName,
              categoryId,
              item: actualItem,
              itemImageUrl,
              customizations,
            });
          }
        }
      }
    }
    return itemsList;
  }, [menuCategories]);

  // Categories List
  const categoryNames = useMemo(() => {
    const list = ["All Items"];
    if (menuCategories && Array.isArray(menuCategories)) {
      for (const catEntry of menuCategories) {
        const catObj = catEntry?.category || catEntry;
        if (catObj?.name && !list.includes(catObj.name)) {
          list.push(catObj.name);
        }
      }
    }
    return list;
  }, [menuCategories]);

  // Filtered Catalog Items based on Category & Search
  const filteredCatalogItems = useMemo(() => {
    return allCatalogItems.filter((entry) => {
      const matchCat =
        selectedCategory === "All Items" ||
        entry.categoryName === selectedCategory;
      if (!matchCat) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const itemName = entry.item.name?.toLowerCase() || "";
      const skuNumber = entry.item.skuNumber?.toLowerCase() || "";
      const catName = entry.categoryName?.toLowerCase() || "";
      return (
        itemName.includes(q) ||
        skuNumber.includes(q) ||
        catName.includes(q)
      );
    });
  }, [allCatalogItems, selectedCategory, searchQuery]);

  // Autocomplete matching items for dropdown
  const autocompleteMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return allCatalogItems
      .filter((entry) => {
        const itemName = entry.item.name?.toLowerCase() || "";
        const skuNumber = entry.item.skuNumber?.toLowerCase() || "";
        return itemName.includes(q) || skuNumber.includes(q);
      })
      .slice(0, 6);
  }, [allCatalogItems, searchQuery]);

  // Cart Calculations
  const cartSubtotalPaise = useMemo(() => {
    if (!activeCart) return 0;
    return activeCart.items.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0,
    );
  }, [activeCart]);

  const taxGstPaise = useMemo(() => {
    return Math.round(cartSubtotalPaise * 0.05); // 5% GST
  }, [cartSubtotalPaise]);

  const totalPayablePaise = useMemo(() => {
    return cartSubtotalPaise + taxGstPaise;
  }, [cartSubtotalPaise, taxGstPaise]);

  const totalCartItemCount = useMemo(() => {
    if (!activeCart) return 0;
    return activeCart.items.reduce((acc, item) => acc + item.quantity, 0);
  }, [activeCart]);

  // ==========================================
  // CART ACTIONS
  // ==========================================

  // Add Item to Current Cart
  const handleAddItemToCart = useCallback(
    (item: any, quantityToAdd: number = 1) => {
      if (!item || quantityToAdd <= 0) return;
      setCartTabs((prevTabs) =>
        prevTabs.map((cart) => {
          if (cart.id !== activeCartId) return cart;
          const existingIndex = cart.items.findIndex(
            (ci) => ci.itemId === item._id || ci.itemId === item.id,
          );
          if (existingIndex > -1) {
            const updatedItems = [...cart.items];
            updatedItems[existingIndex].quantity += quantityToAdd;
            return { ...cart, items: updatedItems };
          } else {
            const newItem: CartItem = {
              itemId: item._id || item.id,
              name: item.name,
              price: item.price,
              quantity: quantityToAdd,
              isVeg: item.isVeg ?? true,
              unit: item.quantityUnit || (item.servingSize ? `${item.servingSize}` : "1 pc"),
              description: item.description,
            };
            return { ...cart, items: [...cart.items, newItem] };
          }
        }),
      );
      showToast(`Added ${quantityToAdd}x ${item.name} to ${activeCart.label}`);
    },
    [activeCartId, activeCart],
  );

  // Modify Quantity
  const handleUpdateItemQuantity = (itemId: string, newQty: number) => {
    setCartTabs((prevTabs) =>
      prevTabs.map((cart) => {
        if (cart.id !== activeCartId) return cart;
        if (newQty <= 0) {
          return {
            ...cart,
            items: cart.items.filter(
              (ci) => ci.itemId !== (itemId as unknown as Id<"items">),
            ),
          };
        }
        return {
          ...cart,
          items: cart.items.map((ci) =>
            ci.itemId === (itemId as unknown as Id<"items">)
              ? { ...ci, quantity: newQty }
              : ci,
          ),
        };
      }),
    );
  };

  // Remove Item
  const handleRemoveItem = (itemId: string) => {
    setCartTabs((prevTabs) =>
      prevTabs.map((cart) => {
        if (cart.id !== activeCartId) return cart;
        return {
          ...cart,
          items: cart.items.filter(
            (ci) => ci.itemId !== (itemId as unknown as Id<"items">),
          ),
        };
      }),
    );
  };

  // Clear Entire Active Cart
  const handleClearCart = () => {
    setCartTabs((prevTabs) =>
      prevTabs.map((cart) => {
        if (cart.id !== activeCartId) return cart;
        return { ...cart, items: [] };
      }),
    );
    showToast("Cart cleared");
  };

  // Add New Cart Tab
  const handleAddNewCartTab = () => {
    const newIndex = cartTabs.length + 1;
    const newCartId = `cart-${Date.now()}`;
    const newCart: CartTab = {
      id: newCartId,
      label: `Cart ${newIndex}`,
      items: [],
      orderType: "DineIn",
      customerName: "",
      customerPhone: "",
      specialNotes: "",
    };
    setCartTabs((prev) => [...prev, newCart]);
    setActiveCartId(newCartId);
    showToast(`Opened new simultaneous tab: Cart ${newIndex}`);
  };

  // Remove Cart Tab
  const handleCloseCartTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (cartTabs.length <= 1) {
      handleClearCart();
      return;
    }
    const remaining = cartTabs.filter((c) => c.id !== tabId);
    setCartTabs(remaining);
    if (activeCartId === tabId) {
      setActiveCartId(remaining[0].id);
    }
  };

  // ==========================================
  // HARDWARE PRINTER STATUS HOOK
  // ==========================================

  useEffect(() => {
    let isMounted = true;
    if (printers === undefined) return;
    if (!printers || printers.length === 0) {
      setPrinterStatus("disconnected");
      return;
    }

    const cashierPrinter =
      printers.find((p) => p.printerUseFor === "Cashier") || printers[0];
    if (!cashierPrinter || !cashierPrinter.printerUrl) {
      setPrinterStatus("disconnected");
      return;
    }

    const checkStatus = async () => {
      if (cashierPrinter.printerType === "Usb") {
        if (typeof navigator !== "undefined" && "usb" in navigator) {
          try {
            const devices = await (navigator as any).usb.getDevices();
            if (isMounted) {
              setPrinterStatus(devices.length > 0 ? "connected" : "disconnected");
            }
            return;
          } catch {
            if (isMounted) setPrinterStatus("disconnected");
            return;
          }
        }
        if (isMounted) setPrinterStatus("disconnected");
        return;
      }

      if (cashierPrinter.printerType === "Bluetooth") {
        if (typeof navigator !== "undefined" && "bluetooth" in navigator) {
          try {
            const devices = await (navigator as any).bluetooth.getDevices?.();
            if (devices && devices.length > 0) {
              if (isMounted) setPrinterStatus("connected");
              return;
            }
          } catch {}
        }
        if (isMounted) setPrinterStatus("disconnected");
        return;
      }

      // LAN Ping
      try {
        const res = await fetch("/api/printers/test-connection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            printerUrl: cashierPrinter.printerUrl,
            printerPort: cashierPrinter.printerPort || "9100",
            printerType: cashierPrinter.printerType,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (isMounted) {
          setPrinterStatus(data.online ? "connected" : "disconnected");
        }
      } catch {
        if (isMounted) setPrinterStatus("disconnected");
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [printers]);

  // ==========================================
  // KEYBOARD SHORTCUTS HANDLER
  // ==========================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F1: Focus Search
      if (e.key === "F1") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      // F3: Clear Cart
      if (e.key === "F3") {
        e.preventDefault();
        handleClearCart();
      }
      // Escape: Close Autocomplete & Blur
      if (e.key === "Escape") {
        setIsAutocompleteOpen(false);
        setSearchQuery("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ==========================================
  // ORDER SUBMISSION & PAYMENT FLOW
  // ==========================================

  const handleCompleteOrder = async () => {
    if (!activeOrg) return;
    if (activeCart.items.length === 0) {
      showToast("Cannot place order with an empty cart");
      return;
    }

    try {
      setIsProcessingOrder(true);

      const itemsPayload = activeCart.items.map((ci) => ({
        itemId: ci.itemId,
        quantity: ci.quantity,
      }));

      const tableObj = tables?.find((t) => t._id === activeCart.tableId);

      const res = await createOrderMutation({
        organizationId: activeOrg._id,
        orderType: activeCart.orderType,
        tableId: activeCart.orderType === "DineIn" ? (activeCart.tableId as any) : undefined,
        customerName: activeCart.customerName || "Walk-in Customer",
        customerPhone: activeCart.customerPhone || undefined,
        specialNotes: activeCart.specialNotes || undefined,
        paymentMode: selectedPaymentMode,
        items: itemsPayload,
      });

      setCompletedOrderData({
        ...res,
        items: activeCart.items,
        totalAmount: (totalPayablePaise / 100).toFixed(2),
        paymentMode: selectedPaymentMode,
        tableName: tableObj?.tableNumber,
      });

      // Clear the current cart
      handleClearCart();
      setCurrentStep(1);
      showToast(`Order ${res.orderNumber} created successfully!`);
    } catch (err: any) {
      showToast(err.message || "Failed to create order");
    } finally {
      setIsProcessingOrder(false);
    }
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="bg-[#f5f5f5] text-[#1c1b1b] font-sans antialiased h-screen flex flex-col overflow-hidden select-none">
      {/* Toast Notification */}
      {notificationToast && (
        <div className="fixed top-4 right-4 z-50 bg-[#0c0a09] text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{notificationToast}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BEGIN: TopBar                                                             */}
      {/* ========================================================================= */}
      <header className="bg-white border-b border-[#e7e5e4] px-6 py-2.5 flex items-center justify-between shrink-0 z-30">
        {/* Brand / Navigation Identity */}
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard"
            className="p-1.5 rounded-full hover:bg-[#f1edec] transition-colors text-[#5e5e5e] hover:text-[#141010] cursor-pointer"
            title="Back to dashboard"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </Link>
          <div className="flex items-baseline space-x-2.5">
            <span className="font-serif text-2xl tracking-tight text-[#141010] font-normal">
              Cashier
            </span>
            <span className="text-[#e7e5e4] font-light">|</span>
            <div className="flex items-center space-x-2 text-xs text-[#5e5e5e]">
              <span className="font-medium text-[#141010]">
                {activeOrg?.name || "Prest POS"}
              </span>
              <span className="w-1 h-1 rounded-full bg-[#8a7e75]" />
              <span>Main Floor POS</span>
            </div>
          </div>
        </div>

        {/* 3-Step Guided Workflow Indicator */}
        <nav
          aria-label="Order Workflow Progress"
          className="flex items-center bg-[#f1edec] p-1 rounded-full border border-[#eadfd6]"
        >
          {/* Step 1: Build Order */}
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={`flex items-center space-x-2 px-3.5 py-1 rounded-full text-xs transition-all cursor-pointer ${
              currentStep === 1
                ? "bg-[#0c0a09] text-white shadow-sm font-medium"
                : "text-[#5e5e5e] hover:text-black font-normal"
            }`}
          >
            {currentStep === 1 && (
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            )}
            <span>01 Build Order</span>
          </button>

          {/* Divider Arrow */}
          <svg
            className="w-3.5 h-3.5 mx-1 text-[#8a7e75] opacity-60"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M9 5l7 7-7 7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>

          {/* Step 2: Order Details */}
          <button
            type="button"
            onClick={() => {
              if (activeCart.items.length > 0) setCurrentStep(2);
              else showToast("Add items to cart first");
            }}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs transition-all cursor-pointer ${
              currentStep === 2
                ? "bg-[#0c0a09] text-white shadow-sm font-medium"
                : "text-[#5e5e5e] hover:text-black font-normal"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                currentStep === 2 ? "bg-[#10b981] animate-pulse" : "bg-[#8a7e75] opacity-40"
              }`}
            />
            <span>02 Order Details</span>
          </button>

          {/* Divider Arrow */}
          <svg
            className="w-3.5 h-3.5 mx-1 text-[#8a7e75] opacity-60"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M9 5l7 7-7 7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>

          {/* Step 3: Payment */}
          <button
            type="button"
            onClick={() => {
              if (activeCart.items.length > 0) setCurrentStep(3);
              else showToast("Add items to cart first");
            }}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs transition-all cursor-pointer ${
              currentStep === 3
                ? "bg-[#0c0a09] text-white shadow-sm font-medium"
                : "text-[#5e5e5e] hover:text-black font-normal"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                currentStep === 3 ? "bg-[#10b981] animate-pulse" : "bg-[#8a7e75] opacity-40"
              }`}
            />
            <span>03 Payment</span>
          </button>
        </nav>

        {/* Cashier Profile / Session & Printer Status */}
        <div className="flex items-center space-x-4 text-right">
          {/* Printer Widget */}
          <div className="flex items-center gap-1.5 text-xs text-[#7a716b] border-r border-[#e7e5e4] pr-4">
            <span className="text-[11px] font-medium">Printer:</span>
            {printerStatus === "connected" ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                Online
              </span>
            ) : printerStatus === "checking" ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Checking
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#78716c] bg-[#f5f5f4] px-2 py-0.5 rounded-full border border-[#e7e5e4]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#a8a29e]" />
                Offline
              </span>
            )}
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-medium text-[#141010] tracking-tight">
              Admin Cashier
            </span>
            <span className="text-[11px] text-[#8a7e75]">Terminal 01</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#0c0a09] text-white flex items-center justify-center text-xs font-semibold ring-2 ring-[#eadfd6]">
            POS
          </div>
        </div>
      </header>
      {/* END: TopBar */}

      {/* ========================================================================= */}
      {/* STEP 1: BUILD ORDER WORKSPACE (CART ON LEFT, CATALOG ON RIGHT)            */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <main className="flex-1 flex overflow-hidden p-4 gap-4">
          {/* ===================================================================== */}
          {/* BEGIN: LeftCartPanel (approx 41% width)                               */}
          {/* ===================================================================== */}
          <section
            className="w-[41%] flex flex-col bg-white rounded-2xl border border-[#e7e5e4] shadow-xs overflow-hidden"
            data-purpose="active-order-cart"
          >
            {/* Cart Switcher Header */}
            <div className="p-3.5 border-b border-[#e7e5e4] flex items-center justify-between bg-[#fdf8f7]/50">
              {/* Multiple Carts Tabs */}
              <div className="flex items-center space-x-1.5 overflow-x-auto max-w-[65%]">
                {cartTabs.map((c) => {
                  const isActive = c.id === activeCartId;
                  const count = c.items.reduce(
                    (acc, it) => acc + it.quantity,
                    0,
                  );
                  return (
                    <div key={c.id} className="relative group/tab flex items-center">
                      <button
                        type="button"
                        onClick={() => setActiveCartId(c.id)}
                        className={`px-3.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
                          isActive
                            ? "bg-[#0c0a09] text-white shadow-xs"
                            : "text-[#5e5e5e] hover:bg-[#f1edec]"
                        }`}
                      >
                        <span>{c.label}</span>
                        {count > 0 && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? "bg-[#10b981]" : "bg-[#8a7e75]"
                            }`}
                          />
                        )}
                      </button>
                      {cartTabs.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => handleCloseCartTab(c.id, e)}
                          className="ml-0.5 text-[#8a7e75] hover:text-red-500 text-xs p-0.5"
                          title="Close Cart"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={handleAddNewCartTab}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-dashed border-[#e7e5e4] hover:border-[#0c0a09] text-[#5e5e5e] hover:text-[#0c0a09] transition-all text-sm font-light cursor-pointer shrink-0"
                  title="Open new simultaneous cart tab"
                >
                  +
                </button>
              </div>

              {/* Cart Quick Actions */}
              <div className="flex items-center space-x-3">
                <span className="text-[11px] text-[#8a7e75] uppercase tracking-wider font-semibold">
                  {activeCart.items.length} items • {totalCartItemCount} pcs
                </span>
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="p-1.5 text-[#8a7e75] hover:text-red-600 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                  title="Clear Entire Cart (F3)"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 px-4 py-2 bg-[#f1edec]/40 text-[11px] font-semibold text-[#8a7e75] uppercase tracking-wider border-b border-[#e7e5e4]">
              <div className="col-span-5">Item</div>
              <div className="col-span-2 text-right">Price</div>
              <div className="col-span-3 text-center">Qty</div>
              <div className="col-span-2 text-right">Subtotal</div>
            </div>

            {/* Cart Item Rows List */}
            <div
              className="flex-1 overflow-y-auto divide-y divide-[#e7e5e4]/60 px-2"
              data-purpose="cart-items-list"
            >
              {activeCart.items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3 text-[#8a7e75]">
                  <div className="w-12 h-12 rounded-full bg-[#f1edec] flex items-center justify-center text-[#8a7e75]">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#141010]">
                      Your cart is empty
                    </p>
                    <p className="text-xs text-[#8a7e75] mt-1">
                      Search items or select from the catalog on the right (F1)
                    </p>
                  </div>
                </div>
              ) : (
                activeCart.items.map((cartItem) => {
                  const lineTotal = (
                    (cartItem.price * cartItem.quantity) /
                    100
                  ).toFixed(2);
                  const unitPrice = (cartItem.price / 100).toFixed(2);

                  return (
                    <div
                      key={cartItem.itemId}
                      className="grid grid-cols-12 items-center px-2 py-3 hover:bg-[#fdf8f7]/40 rounded-lg transition-colors group"
                    >
                      {/* Item Name & Veg Indicator */}
                      <div className="col-span-5 pr-1 flex items-start space-x-2">
                        <span
                          className={`w-3.5 h-3.5 mt-0.5 rounded-xs border p-[1.5px] flex items-center justify-center shrink-0 ${
                            cartItem.isVeg
                              ? "border-emerald-600"
                              : "border-red-600"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              cartItem.isVeg
                                ? "bg-emerald-600"
                                : "bg-red-600"
                            }`}
                          />
                        </span>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-[#141010] leading-snug">
                            {cartItem.name}
                          </span>
                          <span className="text-[11px] text-[#8a7e75] font-light">
                            {cartItem.unit}
                          </span>
                        </div>
                      </div>

                      {/* Unit Price */}
                      <div className="col-span-2 text-right text-xs text-[#5e5e5e] font-mono">
                        ₹{unitPrice}
                      </div>

                      {/* Quantity Stepper [- qty +] */}
                      <div className="col-span-3 flex justify-center">
                        <div className="inline-flex items-center border border-[#e7e5e4] rounded-md bg-white shadow-2xs">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateItemQuantity(
                                cartItem.itemId,
                                cartItem.quantity - 1,
                              )
                            }
                            className="w-6 h-6 flex items-center justify-center text-[#8a7e75] hover:text-[#141010] hover:bg-[#f5f5f5] rounded-l text-xs cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-7 text-center text-xs font-semibold text-[#141010]">
                            {cartItem.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateItemQuantity(
                                cartItem.itemId,
                                cartItem.quantity + 1,
                              )
                            }
                            className="w-6 h-6 flex items-center justify-center text-[#8a7e75] hover:text-[#141010] hover:bg-[#f5f5f5] rounded-r text-xs cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Line Subtotal & Delete Button */}
                      <div className="col-span-2 text-right flex items-center justify-end space-x-1.5">
                        <span className="text-xs font-semibold text-[#141010] font-mono">
                          ₹{lineTotal}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(cartItem.itemId)}
                          className="text-[#e7e5e4] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-0.5"
                          title="Remove item"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              d="M6 18L18 6M6 6l12 12"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* BEGIN: CartSummaryFooter */}
            <div className="border-t border-[#e7e5e4] bg-[#fdf8f7] p-4 flex flex-col space-y-3 shrink-0">
              <div className="space-y-1.5 text-xs text-[#5e5e5e]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono text-[#141010]">
                    ₹{(cartSubtotalPaise / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-[#8a7e75] text-[11px]">
                  <span>GST (5%)</span>
                  <span className="font-mono">
                    ₹{(taxGstPaise / 100).toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-[#e7e5e4]/60 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-widest text-[#8a7e75]">
                    Total Payable
                  </div>
                  <div className="font-serif text-2xl font-semibold text-[#141010] leading-none mt-0.5">
                    ₹{(totalPayablePaise / 100).toFixed(2)}
                  </div>
                </div>

                {/* Step 1 Primary Action: Proceed to Step 2 */}
                <button
                  type="button"
                  disabled={activeCart.items.length === 0}
                  onClick={() => setCurrentStep(2)}
                  className={`px-6 py-2.5 rounded-full shadow-md transition-all flex items-center space-x-2 group cursor-pointer ${
                    activeCart.items.length > 0
                      ? "bg-[#0c0a09] hover:bg-stone-900 active:scale-95 text-white"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  <span className="font-medium text-sm">Order</span>
                  <span className="text-[#8a7e75] font-light group-hover:translate-x-0.5 transition-transform text-base leading-none">
                    →
                  </span>
                </button>
              </div>
            </div>
            {/* END: CartSummaryFooter */}
          </section>
          {/* END: LeftCartPanel */}

          {/* ===================================================================== */}
          {/* BEGIN: RightCatalogPanel (approx 59% width)                           */}
          {/* ===================================================================== */}
          <section
            className="flex-1 flex flex-col bg-white rounded-2xl border border-[#e7e5e4] shadow-xs overflow-hidden relative"
            data-purpose="catalog-search-area"
          >
            {/* Top Search Area */}
            <div className="p-3.5 border-b border-[#e7e5e4] bg-white flex flex-col gap-2 relative z-20">
              <span className="text-xs font-bold text-[#141010]">Search menu</span>
              <div className="flex items-center gap-3">
                {/* Search Input with Clear Button and Dropdown Icon */}
                <div className="relative flex-1">
                  <input
                    ref={searchInputRef}
                    className="w-full pl-3 pr-8 py-2 text-xs border border-[#141010] rounded-lg focus:ring-1 focus:ring-[#141010] focus:border-[#141010] font-medium text-[#141010] placeholder-[#a8a29e] bg-white shadow-2xs focus:outline-none"
                    placeholder="Search via item name/number (Shortcut: F1)"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsAutocompleteOpen(Boolean(e.target.value.trim()));
                      setHighlightedIndex(0);
                    }}
                    onFocus={() => {
                      if (searchQuery.trim()) setIsAutocompleteOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (isAutocompleteOpen && autocompleteMatches.length > 0) {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setHighlightedIndex((prev) =>
                            prev < autocompleteMatches.length - 1 ? prev + 1 : 0,
                          );
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setHighlightedIndex((prev) =>
                            prev > 0 ? prev - 1 : autocompleteMatches.length - 1,
                          );
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          const selectedMatch =
                            autocompleteMatches[highlightedIndex];
                          if (selectedMatch) {
                            handleAddItemToCart(selectedMatch.item, inputQty);
                            setIsAutocompleteOpen(false);
                            setSearchQuery("");
                          }
                        }
                      } else if (e.key === "Enter") {
                        if (filteredCatalogItems.length > 0) {
                          handleAddItemToCart(
                            filteredCatalogItems[0].item,
                            inputQty,
                          );
                          setSearchQuery("");
                        }
                      }
                    }}
                  />
                  {/* Dropdown / Clear Icon */}
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setIsAutocompleteOpen(false);
                      }}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#8a7e75] hover:text-[#141010] cursor-pointer"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M6 18L18 6M6 6l12 12"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        />
                      </svg>
                    </button>
                  ) : (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#8a7e75]">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Quantity Control */}
                <div className="flex items-center border border-[#141010] rounded-lg bg-white px-2.5 py-1.5 space-x-1">
                  <span className="text-xs text-[#141010] font-medium">Qty:</span>
                  <input
                    className="w-8 text-center text-xs font-bold text-[#141010] border-0 bg-transparent p-0 focus:ring-0 focus:outline-none"
                    min="1"
                    type="number"
                    value={inputQty}
                    onChange={(e) =>
                      setInputQty(Math.max(1, parseInt(e.target.value) || 1))
                    }
                  />
                </div>

                {/* Add Item Enter Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (autocompleteMatches.length > 0) {
                      handleAddItemToCart(
                        autocompleteMatches[highlightedIndex || 0].item,
                        inputQty,
                      );
                      setSearchQuery("");
                      setIsAutocompleteOpen(false);
                    } else if (filteredCatalogItems.length > 0) {
                      handleAddItemToCart(
                        filteredCatalogItems[0].item,
                        inputQty,
                      );
                      setSearchQuery("");
                    }
                  }}
                  className="px-5 py-2 bg-[#78716c] hover:bg-[#141010] active:scale-98 text-white text-xs font-medium rounded-lg shadow-2xs transition-colors flex items-center space-x-1.5 shrink-0 cursor-pointer"
                >
                  <span>Add item</span>
                </button>
              </div>

              {/* BEGIN: Autocomplete Dropdown */}
              {isAutocompleteOpen && autocompleteMatches.length > 0 && (
                <div
                  className="absolute left-3.5 right-40 top-full mt-1.5 bg-white border border-[#e7e5e4] rounded-xl shadow-xl z-50 overflow-hidden"
                  data-purpose="autocomplete-results"
                >
                  <div className="px-3.5 py-1.5 bg-[#f1edec]/40 text-[10px] font-semibold text-[#8a7e75] uppercase tracking-wider border-b border-[#e7e5e4] flex justify-between items-center">
                    <span>Matching Menu Items</span>
                    <span className="font-mono text-[9px] text-[#8a7e75]">
                      PRESS ENTER TO ADD
                    </span>
                  </div>
                  <div className="divide-y divide-[#e7e5e4]/50 text-xs max-h-64 overflow-y-auto">
                    {autocompleteMatches.map((entry, idx) => {
                      const isHighlighted = idx === highlightedIndex;
                      const priceFormatted = (entry.item.price / 100).toFixed(
                        2,
                      );

                      return (
                        <div
                          key={entry.item._id || entry.item.id}
                          onClick={() => {
                            handleAddItemToCart(entry.item, inputQty);
                            setIsAutocompleteOpen(false);
                            setSearchQuery("");
                          }}
                          className={`px-3.5 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                            isHighlighted
                              ? "bg-[#fdf8f7] border-l-2 border-[#0c0a09]"
                              : "hover:bg-[#fdf8f7]/50"
                          }`}
                        >
                          <div className="flex items-center space-x-2.5">
                            <span
                              className={`w-3 h-3 rounded-xs border p-[1px] flex items-center justify-center shrink-0 ${
                                entry.item.isVeg
                                  ? "border-emerald-600"
                                  : "border-red-600"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  entry.item.isVeg
                                    ? "bg-emerald-600"
                                    : "bg-red-600"
                                  }`}
                              />
                            </span>
                            <span
                              className={`text-xs ${
                                isHighlighted
                                  ? "font-medium text-[#141010]"
                                  : "font-normal text-[#141010]"
                              }`}
                            >
                              {entry.item.name}
                            </span>
                            <span className="text-[10px] bg-white border border-[#e7e5e4] px-1.5 py-0.5 rounded text-[#5e5e5e]">
                              {entry.categoryName}
                            </span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="font-mono font-semibold text-[#141010]">
                              ₹{priceFormatted}
                            </span>
                            <span className="text-[10px] text-[#8a7e75] font-mono">
                              ↵ Add
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* END: Autocomplete Dropdown */}
            </div>

            {/* Category Filter Tabs Bar (Wrapped matching defx-pos) */}
            <div className="p-3 border-b border-[#e7e5e4] bg-white flex flex-wrap gap-2 z-10">
              {categoryNames.map((catName) => {
                const isSelected = selectedCategory === catName;
                return (
                  <button
                    key={catName}
                    type="button"
                    onClick={() => setSelectedCategory(catName)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? "bg-[#141010] text-white border border-[#141010] font-semibold shadow-2xs"
                        : "bg-white text-[#141010] border border-[#141010] hover:bg-neutral-50 font-normal"
                    }`}
                  >
                    {catName}
                  </button>
                );
              })}
            </div>

            {/* Menu Items Catalog Table View */}
            <div
              className="flex-1 overflow-y-auto divide-y divide-[#e7e5e4] px-4 py-1"
              data-purpose="catalog-item-list"
            >
              {/* Table Column Headers */}
              <div className="flex items-center justify-between py-2 text-xs font-semibold text-[#8a7e75]">
                <div className="w-28">Quantity</div>
                <div className="flex-1 px-4">Item</div>
                <div className="w-20 text-right">Price</div>
              </div>

              {filteredCatalogItems.length === 0 ? (
                <div className="py-16 text-center text-xs text-[#8a7e75]">
                  No menu items found in {selectedCategory}.
                </div>
              ) : (
                filteredCatalogItems.map((entry) => {
                  const it = entry.item;
                  const inCartItem = activeCart.items.find(
                    (ci) => ci.itemId === it._id || ci.itemId === it.id,
                  );
                  const currentCartQty = inCartItem?.quantity || 0;
                  const priceFormatted =
                    it.price % 100 === 0
                      ? (it.price / 100).toString()
                      : (it.price / 100).toFixed(2);

                  return (
                    <div
                      key={it._id || it.id}
                      className="flex items-center justify-between py-3 hover:bg-[#fafaf9] transition-colors"
                    >
                      {/* Quantity Stepper */}
                      <div className="w-28 flex items-center">
                        <div className="inline-flex items-center border border-[#141010] rounded-md bg-white">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateItemQuantity(
                                it._id || it.id,
                                currentCartQty - 1,
                              )
                            }
                            className="w-6 h-6 flex items-center justify-center text-sm font-medium text-[#141010] hover:bg-neutral-100 rounded-l border-r border-[#141010]/30 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-7 text-center text-xs font-bold text-[#141010]">
                            {currentCartQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddItemToCart(it, 1)}
                            className="w-6 h-6 flex items-center justify-center text-sm font-medium text-[#141010] hover:bg-neutral-100 rounded-r border-l border-[#141010]/30 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Menu Item Details */}
                      <div
                        className="flex-1 px-4 flex items-center space-x-2.5 cursor-pointer"
                        onClick={() => handleAddItemToCart(it, 1)}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-xs border p-[1.5px] flex items-center justify-center shrink-0 ${
                            it.isVeg !== false
                              ? "border-emerald-600"
                              : "border-red-600"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              it.isVeg !== false
                                ? "bg-emerald-600"
                                : "bg-red-600"
                            }`}
                          />
                        </span>
                        <span className="text-xs font-medium text-[#141010]">
                          {it.name}
                        </span>
                        {it.quantityUnit && (
                          <span className="text-[11px] text-[#8a7e75]">
                            ({it.quantityUnit})
                          </span>
                        )}
                        {currentCartQty > 0 && (
                          <span className="text-[9px] bg-[#0c0a09] text-white px-1.5 py-0.5 rounded-full font-medium tracking-wide">
                            In Cart ({currentCartQty})
                          </span>
                        )}
                      </div>

                      {/* Price */}
                      <div className="w-20 text-right text-xs font-semibold text-[#141010]">
                        ₹{priceFormatted}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Action Shortcuts Footer Strip */}
            <div className="p-2 px-4 border-t border-[#e7e5e4] bg-[#f1edec]/30 flex items-center justify-between text-[11px] text-[#8a7e75]">
              <div className="flex items-center space-x-4">
                <span>
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-[#e7e5e4] text-[10px] font-mono text-[#141010]">
                    F1
                  </kbd>{" "}
                  Search
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-[#e7e5e4] text-[10px] font-mono text-[#141010]">
                    ↑↓
                  </kbd>{" "}
                  Select
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-[#e7e5e4] text-[10px] font-mono text-[#141010]">
                    Enter
                  </kbd>{" "}
                  Add
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-[#e7e5e4] text-[10px] font-mono text-[#141010]">
                    F3
                  </kbd>{" "}
                  Clear
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[#141010] font-medium">
                  Catalog live sync: {allCatalogItems.length} active items
                </span>
              </div>
            </div>
          </section>
          {/* END: RightCatalogPanel */}
        </main>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: ORDER DETAILS (DINE-IN TABLE / CUSTOMER INFO / ORDER TYPE)        */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <main className="flex-1 overflow-y-auto p-6 flex justify-center bg-[#f5f5f5]">
          <div className="w-full max-w-4xl bg-white rounded-2xl border border-[#e7e5e4] shadow-sm p-8 space-y-8">
            <div className="flex items-center justify-between border-b border-[#e7e5e4] pb-5">
              <div>
                <h2 className="text-xl font-bold font-serif text-[#141010]">
                  Step 2: Order Details &amp; Dining Type
                </h2>
                <p className="text-xs text-[#7a716b] mt-1">
                  Assign order channel, dining table, and optional patron details.
                </p>
              </div>
              <div className="text-right font-mono text-sm font-semibold text-[#141010]">
                {activeCart.items.length} items • ₹
                {(totalPayablePaise / 100).toFixed(2)}
              </div>
            </div>

            {/* Order Type Tabs */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#7a716b]">
                Select Dining Channel
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    { type: "DineIn", label: "Dine-In", icon: "🍽️" },
                    { type: "TakeAway", label: "Takeaway / Parcel", icon: "🛍️" },
                    { type: "Delivery", label: "Direct Delivery", icon: "🛵" },
                  ] as const
                ).map((ch) => (
                  <button
                    key={ch.type}
                    type="button"
                    onClick={() =>
                      setCartTabs((prev) =>
                        prev.map((c) =>
                          c.id === activeCartId
                            ? { ...c, orderType: ch.type }
                            : c,
                        ),
                      )
                    }
                    className={`py-3.5 px-4 rounded-xl border text-center transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                      activeCart.orderType === ch.type
                        ? "bg-[#0c0a09] text-white border-[#0c0a09] shadow-md font-semibold"
                        : "bg-white text-[#141010] border-[#e7e5e4] hover:bg-[#fdf8f7]"
                    }`}
                  >
                    <span>{ch.icon}</span>
                    <span className="text-sm">{ch.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Table Selection for Dine-In */}
            {activeCart.orderType === "DineIn" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#7a716b]">
                    Assign Dining Table
                  </label>
                  <span className="text-xs text-[#7a716b]">
                    {tables?.length || 0} configured tables
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-2.5 max-h-48 overflow-y-auto p-1">
                  {tables && tables.length > 0 ? (
                    tables.map((tbl) => {
                      const isSelected = activeCart.tableId === tbl._id;
                      const isOccupied = Boolean(tbl.currentOrderId);

                      return (
                        <button
                          key={tbl._id}
                          type="button"
                          onClick={() =>
                            setCartTabs((prev) =>
                              prev.map((c) =>
                                c.id === activeCartId
                                  ? {
                                      ...c,
                                      tableId: tbl._id,
                                      tableName: tbl.tableNumber,
                                    }
                                  : c,
                              ),
                            )
                          }
                          className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                            isSelected
                              ? "bg-[#0c0a09] text-white border-[#0c0a09] shadow-sm"
                              : isOccupied
                                ? "bg-amber-50 text-amber-900 border-amber-200"
                                : "bg-white text-[#141010] border-[#e7e5e4] hover:bg-[#fdf8f7]"
                          }`}
                        >
                          <div className="text-xs font-bold">
                            T-{tbl.tableNumber}
                          </div>
                          <div className="text-[10px] opacity-75 mt-0.5">
                            {tbl.seatingCapacity} seats
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="col-span-6 text-center py-4 text-xs text-[#8a7e75]">
                      No tables found. You can configure tables in Settings.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Customer Information Form */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#141010] mb-1.5">
                  Customer Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Vikram Malhotra"
                  value={activeCart.customerName}
                  onChange={(e) =>
                    setCartTabs((prev) =>
                      prev.map((c) =>
                        c.id === activeCartId
                          ? { ...c, customerName: e.target.value }
                          : c,
                      ),
                    )
                  }
                  className="w-full px-3.5 py-2 text-xs border border-[#e7e5e4] rounded-xl focus:border-black focus:ring-black focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#141010] mb-1.5">
                  Customer Mobile (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={activeCart.customerPhone}
                  onChange={(e) =>
                    setCartTabs((prev) =>
                      prev.map((c) =>
                        c.id === activeCartId
                          ? { ...c, customerPhone: e.target.value }
                          : c,
                      ),
                    )
                  }
                  className="w-full px-3.5 py-2 text-xs border border-[#e7e5e4] rounded-xl focus:border-black focus:ring-black focus:outline-none bg-white"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-[#141010] mb-1.5">
                  Kitchen / Special Order Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Less spicy, serve drinks first..."
                  value={activeCart.specialNotes}
                  onChange={(e) =>
                    setCartTabs((prev) =>
                      prev.map((c) =>
                        c.id === activeCartId
                          ? { ...c, specialNotes: e.target.value }
                          : c,
                      ),
                    )
                  }
                  className="w-full px-3.5 py-2 text-xs border border-[#e7e5e4] rounded-xl focus:border-black focus:ring-black focus:outline-none bg-white"
                />
              </div>
            </div>

            {/* Navigation Footer */}
            <div className="flex justify-between items-center pt-6 border-t border-[#e7e5e4]">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-6 py-2.5 bg-[#f1edec] hover:bg-[#e7e5e4] text-[#141010] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                ← Back to Cart
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-8 py-2.5 bg-[#0c0a09] hover:bg-stone-900 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer flex items-center space-x-2"
              >
                <span>Proceed to Payment</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: PAYMENT & RECEIPT (FINAL SETTLEMENT)                              */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <main className="flex-1 overflow-y-auto p-6 flex justify-center bg-[#f5f5f5]">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-[#e7e5e4] shadow-sm p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-[#e7e5e4] pb-5">
              <div>
                <h2 className="text-xl font-bold font-serif text-[#141010]">
                  Step 3: Collect Payment &amp; Issue Receipt
                </h2>
                <p className="text-xs text-[#7a716b] mt-1">
                  Total Payable Amount: ₹{(totalPayablePaise / 100).toFixed(2)}
                </p>
              </div>
              <span className="font-serif text-3xl font-bold text-[#141010]">
                ₹{(totalPayablePaise / 100).toFixed(2)}
              </span>
            </div>

            {/* Payment Modes */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#7a716b]">
                Select Payment Mode
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(
                  ["Cash", "UPI QR", "Card / POS", "Split"] as const
                ).map((pm) => (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => {
                      setSelectedPaymentMode(pm);
                      if (pm !== "Cash") setTenderCashGiven("");
                    }}
                    className={`py-3 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                      selectedPaymentMode === pm
                        ? "bg-[#0c0a09] text-white border-[#0c0a09] shadow-md font-semibold text-xs"
                        : "bg-white text-[#141010] border-[#e7e5e4] hover:bg-[#fdf8f7] text-xs font-medium"
                    }`}
                  >
                    {pm}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash Tender Calculation */}
            {selectedPaymentMode === "Cash" && (
              <div className="p-4 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#7a716b] mb-1.5">
                    Customer Given Cash (Tender)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-sm font-semibold text-[#7a716b]">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="any"
                      placeholder={(totalPayablePaise / 100).toFixed(2)}
                      value={tenderCashGiven}
                      onChange={(e) => setTenderCashGiven(e.target.value)}
                      className="w-full pl-8 pr-4 py-2.5 font-sans text-sm font-bold text-[#141010] border border-[#e7e5e4] rounded-lg focus:border-black focus:ring-black focus:outline-none bg-white"
                    />
                  </div>
                </div>

                {/* Quick Cash Shortcuts */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[11px] font-semibold text-[#7a716b]">
                      Quick Currency Notes:
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[100, 200, 500, 2000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setTenderCashGiven(amt.toString())}
                        className="py-1.5 text-xs font-semibold bg-white border border-[#e7e5e4] rounded-lg hover:bg-[#f1edec] transition-colors cursor-pointer"
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Return Change Banner */}
                {(() => {
                  const billVal = totalPayablePaise / 100;
                  const givenVal = parseFloat(tenderCashGiven || billVal.toString());
                  const changeVal = Math.max(0, givenVal - billVal);

                  return (
                    <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <span className="text-xs font-semibold text-emerald-900 uppercase tracking-wider">
                        Return Change to Customer
                      </span>
                      <span className="font-mono text-base font-bold text-emerald-700">
                        ₹{changeVal.toFixed(2)}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Navigation & Submit Action */}
            <div className="flex justify-between items-center pt-6 border-t border-[#e7e5e4]">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-6 py-2.5 bg-[#f1edec] hover:bg-[#e7e5e4] text-[#141010] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                ← Back to Details
              </button>

              <button
                type="button"
                disabled={isProcessingOrder}
                onClick={handleCompleteOrder}
                className="px-8 py-3 bg-[#0c0a09] hover:bg-stone-900 text-white rounded-xl text-sm font-bold shadow-md transition-all cursor-pointer flex items-center space-x-2"
              >
                {isProcessingOrder ? (
                  <span>Processing...</span>
                ) : (
                  <span>
                    Confirm &amp; Place Order (₹
                    {(totalPayablePaise / 100).toFixed(2)})
                  </span>
                )}
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* ORDER CONFIRMATION MODAL & RECEIPT PRINT TRIGGER                          */}
      {/* ========================================================================= */}
      {completedOrderData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 text-center animate-scaleUp font-sans">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
              ✓
            </div>

            <div>
              <h3 className="text-xl font-bold font-serif text-[#141010]">
                Order Confirmed!
              </h3>
              <p className="text-xs text-[#7a716b] mt-1">
                {completedOrderData.orderNumber} • Token {completedOrderData.tokenNumber}
              </p>
            </div>

            <div className="p-4 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[#7a716b]">Total Paid:</span>
                <span className="font-bold text-[#141010]">
                  ₹{completedOrderData.totalAmount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7a716b]">Payment Mode:</span>
                <span className="font-semibold text-[#141010]">
                  {completedOrderData.paymentMode}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-2.5 bg-[#f1edec] hover:bg-[#e7e5e4] text-[#141010] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Print Thermal Receipt
              </button>

              <button
                type="button"
                onClick={() => setCompletedOrderData(null)}
                className="flex-1 py-2.5 bg-[#0c0a09] hover:bg-stone-900 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                New Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
