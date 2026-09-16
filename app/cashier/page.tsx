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
  isGst?: boolean;
  taxGroupId?: Id<"taxGroups">;
  taxMode?: "inclusive" | "exclusive";
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
  orderType: "DineIn" | "TakeAway" | "Delivery" | "Scheduled";
  isTableRequired?: boolean;
  tableId?: string;
  tableName?: string;
  waiterId?: string;
  waiterName?: string;
  guestCount?: number;
  customerFirstName?: string;
  customerLastName?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  pickupLocation?: string;
  includeCarryBag?: boolean;
  includeCutlery?: boolean;
  contactlessHandoff?: boolean;
  deliveryRider?: string;
  deliveryInstructions?: string;
  scheduledSubtype?: "ScheduledPickup" | "ScheduledDelivery";
  scheduledDate?: string;
  scheduledTime?: string;
  scheduledPickupCounter?: string;
  specialNotes: string;
  deliveryAddress?: {
    addressLine1: string;
    landmark?: string;
    city: string;
    zipCode: string;
    label?: string;
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

  // 3. Query Taxation Engine (Store Settings, Tax Groups & Split Components)
  const storeTaxSettings = useQuery(
    api.taxation.getStoreTaxSettings,
    activeOrg ? { organizationId: activeOrg._id } : "skip",
  );
  const taxGroups = useQuery(
    api.taxation.listTaxGroups,
    activeOrg ? { organizationId: activeOrg._id } : "skip",
  );
  const taxComponents = useQuery(
    api.taxation.listTaxComponents,
    activeOrg ? { organizationId: activeOrg._id } : "skip",
  );

  // 4. Query Tables, Staff (Employees), Customers, Payment Modes, and Printers
  const tables = useQuery(api.organizationTables.list, {});
  const employeesList = useQuery(
    api.organizationUsers.list,
    activeOrg ? { organizationId: activeOrg._id } : {},
  );
  const customersList = useQuery(
    api.organizationUsers.list,
    activeOrg ? { organizationId: activeOrg._id, includeCustomers: true } : "skip",
  );
  const paymentModesList = useQuery(
    api.paymentModes.list,
    activeOrg ? { organizationId: activeOrg._id } : {},
  );
  const printers = useQuery(api.organizationPrinters.list, {});

  // 5. Mutations
  const createOrderMutation = useMutation(api.orders.createOrder);

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  // Step Indicator: 1: Build Order | 2: Order Details | 3: Payment
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Multi-cart Tabs (by default no table selected, clean patron fields)
  const [cartTabs, setCartTabs] = useState<CartTab[]>([
    {
      id: "cart-1",
      label: "Cart 1",
      items: [],
      orderType: "DineIn",
      isTableRequired: false,
      guestCount: 2,
      customerFirstName: "",
      customerLastName: "",
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      specialNotes: "",
    },
  ]);
  const [activeCartId, setActiveCartId] = useState<string>("cart-1");
  const [isCartSwitcherOpen, setIsCartSwitcherOpen] = useState(false);

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

  // Dynamic Multi-Component Taxation Calculation (Item-level isGst & taxMode compliant)
  const taxCalculation = useMemo(() => {
    if (!activeCart || activeCart.items.length === 0) {
      return {
        subtotalPaise: 0,
        taxExclusivePaise: 0,
        taxInclusivePaise: 0,
        totalTaxPaise: 0,
        deliveryFeePaise: activeCart?.orderType === "Delivery" ? 5800 : 0,
        totalPayablePaise: activeCart?.orderType === "Delivery" ? 5800 : 0,
        componentBreakdown: [] as Array<{
          name: string;
          rate: number;
          code?: string;
          taxAmountPaise: number;
          isInclusive: boolean;
        }>,
        isTaxExempt: false,
        currencySymbol: storeTaxSettings?.currencySymbol || "₹",
      };
    }

    // Resolve default tax group
    const defaultTaxGroup =
      taxGroups?.find((g) => g.isDefault) ||
      (taxGroups && taxGroups.length > 0 ? taxGroups[0] : null);

    // Component map for fast lookup
    const compMap = new Map<string, any>();
    if (taxComponents) {
      for (const comp of taxComponents) {
        compMap.set(comp._id, comp);
      }
    }

    let subtotalPaise = 0;
    let taxExclusivePaise = 0;
    let taxInclusivePaise = 0;
    const compAccumulator = new Map<
      string,
      { name: string; rate: number; code?: string; taxAmountPaise: number; isInclusive: boolean }
    >();

    for (const item of activeCart.items) {
      const lineTotalPaise = item.price * item.quantity;
      subtotalPaise += lineTotalPaise;

      // Item tax exemption check
      const isGst = item.isGst ?? true;
      if (!isGst) continue; // 100% Tax Exempt item

      // Resolve tax group for item
      let targetGroup = null;
      if (item.taxGroupId && taxGroups) {
        targetGroup = taxGroups.find((g) => g._id === item.taxGroupId) || null;
      }
      if (!targetGroup) {
        targetGroup = defaultTaxGroup;
      }

      if (!targetGroup || !targetGroup.componentIds || targetGroup.componentIds.length === 0) {
        continue;
      }

      const mode = item.taxMode || targetGroup.taxMode || "inclusive";
      const groupComps: Array<any> = [];
      let groupTotalRate = 0;

      for (const cid of targetGroup.componentIds) {
        const comp = compMap.get(cid);
        if (comp) {
          groupComps.push(comp);
          groupTotalRate += comp.rate;
        }
      }

      if (groupTotalRate <= 0) continue;

      let lineTaxPaise = 0;
      if (mode === "inclusive") {
        // Tax is included inside lineTotalPaise: Tax = Price * (Rate / (100 + Rate))
        lineTaxPaise = Math.round(lineTotalPaise * (groupTotalRate / (100 + groupTotalRate)));
        taxInclusivePaise += lineTaxPaise;
      } else {
        // Tax is exclusive: Tax = Price * (Rate / 100)
        lineTaxPaise = Math.round(lineTotalPaise * (groupTotalRate / 100));
        taxExclusivePaise += lineTaxPaise;
      }

      // Distribute tax to components proportionally
      for (const comp of groupComps) {
        const compShare = groupTotalRate > 0 ? comp.rate / groupTotalRate : 0;
        const compTaxPaise = Math.round(lineTaxPaise * compShare);
        const key = `${comp.name}_${comp.rate}_${mode}`;
        const existing = compAccumulator.get(key);
        if (existing) {
          existing.taxAmountPaise += compTaxPaise;
        } else {
          compAccumulator.set(key, {
            name: comp.name,
            rate: comp.rate,
            code: comp.code,
            taxAmountPaise: compTaxPaise,
            isInclusive: mode === "inclusive",
          });
        }
      }
    }

    const deliveryFeePaise = activeCart.orderType === "Delivery" ? 5800 : 0;
    // For inclusive taxes: subtotalPaise already includes tax, so payable is subtotal + deliveryFee
    // For exclusive taxes: taxExclusivePaise is added on top of subtotal
    const totalPayablePaise = subtotalPaise + taxExclusivePaise + deliveryFeePaise;
    const totalTaxPaise = taxInclusivePaise + taxExclusivePaise;

    return {
      subtotalPaise,
      taxExclusivePaise,
      taxInclusivePaise,
      totalTaxPaise,
      deliveryFeePaise,
      totalPayablePaise,
      componentBreakdown: Array.from(compAccumulator.values()),
      isTaxExempt: subtotalPaise > 0 && totalTaxPaise === 0,
      currencySymbol: storeTaxSettings?.currencySymbol || "₹",
    };
  }, [activeCart, storeTaxSettings, taxGroups, taxComponents]);

  // Backward-compatible calculation variables
  const cartSubtotalPaise = taxCalculation.subtotalPaise;
  const taxGstPaise = taxCalculation.totalTaxPaise;
  const deliveryFeePaise = taxCalculation.deliveryFeePaise;
  const totalPayablePaise = taxCalculation.totalPayablePaise;

  const totalCartItemCount = useMemo(() => {
    if (!activeCart) return 0;
    return activeCart.items.reduce((acc, item) => acc + item.quantity, 0);
  }, [activeCart]);

  // Active Employees with Waiter / Captain role available for table assignment
  const availableWaitersAndStaff = useMemo(() => {
    if (!employeesList || employeesList.length === 0) return [];

    const list: Array<{ id: string; name: string; roleDisplay: string }> = [];

    for (const emp of employeesList) {
      const roles = Array.isArray(emp.userType) ? emp.userType.map((r: string) => r.toLowerCase()) : [];
      const isWaiter = roles.includes("waiter") || roles.includes("captain") || roles.includes("server");

      // Strictly include staff who have the Waiter/Captain role
      if (!isWaiter) continue;

      const fullName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.email || emp.userId;
      const roleStr = roles.includes("captain") ? "Captain" : "Waiter";

      list.push({
        id: emp._id,
        name: fullName,
        roleDisplay: roleStr,
      });
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [employeesList]);

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
              isGst: item.isGst ?? item.is_gst ?? true,
              taxGroupId: item.taxGroupId || item.tax_group_id,
              taxMode: item.taxMode || item.tax_mode,
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

  // Matched customer profile for active cart
  const matchedCustomer = useMemo(() => {
    if (!customersList || !activeCart?.customerPhone) return null;
    const cleanPhone = activeCart.customerPhone.replace(/\D/g, "");
    if (cleanPhone.length < 4) return null;
    return (
      customersList.find((u) => {
        const uPhone = (u.phone || "").replace(/\D/g, "");
        return uPhone && (uPhone.endsWith(cleanPhone) || cleanPhone.endsWith(uPhone));
      }) || null
    );
  }, [customersList, activeCart?.customerPhone]);

  // Handle phone input change with auto-lookup
  const handleCustomerPhoneChange = (phoneVal: string) => {
    const cleanDigits = phoneVal.replace(/\D/g, "");
    const match =
      cleanDigits.length >= 4 && customersList
        ? customersList.find((u) => {
            const uPhone = (u.phone || "").replace(/\D/g, "");
            return uPhone && (uPhone.endsWith(cleanDigits) || cleanDigits.endsWith(uPhone));
          })
        : null;

    setCartTabs((prev) =>
      prev.map((c) => {
        if (c.id !== activeCartId) return c;
        if (match) {
          const first = match.firstName || c.customerFirstName || "";
          const last = match.lastName || c.customerLastName || "";
          return {
            ...c,
            customerPhone: phoneVal,
            customerFirstName: first,
            customerLastName: last,
            customerName: `${first} ${last}`.trim(),
            customerEmail: match.email || c.customerEmail || "",
          };
        }
        return { ...c, customerPhone: phoneVal };
      }),
    );
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
      isTableRequired: false,
      guestCount: 2,
      customerFirstName: "",
      customerLastName: "",
      customerName: "",
      customerPhone: "",
      customerEmail: "",
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
  // ORDER SUBMISSION & PAYMENT FLOW
  // ==========================================

  const handleCompleteOrder = useCallback(async () => {
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

      const resolvedCustomerName =
        activeCart.customerName ||
        (activeCart.customerFirstName
          ? `${activeCart.customerFirstName} ${activeCart.customerLastName || ""}`.trim()
          : "Walk-in Customer");

      let resolvedNotes = activeCart.specialNotes || "";
      if (activeCart.orderType === "TakeAway") {
        const prefs: string[] = [];
        if (activeCart.pickupLocation) prefs.push(`Pickup: ${activeCart.pickupLocation}`);
        if (activeCart.includeCarryBag !== false) prefs.push("Carry bag included");
        if (activeCart.includeCutlery !== false) prefs.push("Cutlery included");
        if (activeCart.contactlessHandoff) prefs.push("Contactless handoff");
        if (prefs.length > 0) {
          resolvedNotes = resolvedNotes ? `[${prefs.join(" • ")}] ${resolvedNotes}` : `[${prefs.join(" • ")}]`;
        }
      } else if (activeCart.orderType === "Delivery") {
        if (activeCart.deliveryInstructions) {
          resolvedNotes = resolvedNotes
            ? `[Delivery Note: ${activeCart.deliveryInstructions}] ${resolvedNotes}`
            : `[Delivery Note: ${activeCart.deliveryInstructions}]`;
        }
      } else if (activeCart.orderType === "Scheduled") {
        const sDate = activeCart.scheduledDate || "Tomorrow — Sep 17, 2026";
        const sTime = activeCart.scheduledTime || "01:30 PM - 02:00 PM (Lunch Slot)";
        const sType = activeCart.scheduledSubtype === "ScheduledDelivery" ? "Delivery" : "Pickup";
        resolvedNotes = resolvedNotes
          ? `[Scheduled ${sType}: ${sDate} @ ${sTime}] ${resolvedNotes}`
          : `[Scheduled ${sType}: ${sDate} @ ${sTime}]`;
      }

      const resolvedOrderType =
        activeCart.orderType === "Scheduled"
          ? activeCart.scheduledSubtype === "ScheduledDelivery"
            ? "ScheduledDelivery"
            : "ScheduledPickup"
          : activeCart.orderType;

      const res = await createOrderMutation({
        organizationId: activeOrg._id,
        orderType: resolvedOrderType,
        tableId:
          activeCart.orderType === "DineIn" && activeCart.isTableRequired !== false
            ? (activeCart.tableId as any)
            : undefined,
        waiterUserId: activeCart.waiterId,
        membersOnTable: activeCart.guestCount,
        customerName: resolvedCustomerName,
        customerPhone: activeCart.customerPhone || undefined,
        customerEmail: activeCart.customerEmail || undefined,
        deliveryCharge:
          activeCart.orderType === "Delivery" ||
          (activeCart.orderType === "Scheduled" &&
            activeCart.scheduledSubtype === "ScheduledDelivery")
            ? 5800
            : undefined,
        deliveryAddress:
          activeCart.orderType === "Delivery" ||
          (activeCart.orderType === "Scheduled" &&
            activeCart.scheduledSubtype === "ScheduledDelivery")
            ? activeCart.deliveryAddress || {
                addressLine1: "34, Example Street, Near Sunshine Heights, Bandra West",
                landmark: "Opposite Lotus Park",
                city: "Mumbai",
                zipCode: "400001",
                addressType: "Home",
              }
            : undefined,
        specialNotes: resolvedNotes || undefined,
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
  }, [
    activeOrg,
    activeCart,
    tables,
    createOrderMutation,
    selectedPaymentMode,
    totalPayablePaise,
  ]);

  // Primary Action (Order / Next Step / Settle) triggered by F5 or UI button
  const handlePrimaryStepAdvance = useCallback(() => {
    if (completedOrderData) {
      setCompletedOrderData(null);
      return;
    }
    if (currentStep === 1) {
      if (activeCart.items.length > 0) {
        setCurrentStep(2);
      } else {
        showToast("Please add items to cart before proceeding");
      }
    } else if (currentStep === 2) {
      setCurrentStep(3);
    } else if (currentStep === 3) {
      handleCompleteOrder();
    }
  }, [currentStep, activeCart.items.length, completedOrderData, handleCompleteOrder]);

  // ==========================================
  // KEYBOARD SHORTCUTS HANDLER (F1: Search, F3: Clear, F5: Order/Checkout, Esc: Blur)
  // ==========================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F5: Primary Order / Payment Checkout / Step Progression
      if (e.key === "F5") {
        e.preventDefault();
        handlePrimaryStepAdvance();
      }
      // F1: Focus Search
      else if (e.key === "F1") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      // F3: Clear Cart
      else if (e.key === "F3") {
        e.preventDefault();
        handleClearCart();
      }
      // Escape: Close Autocomplete & Blur
      else if (e.key === "Escape") {
        setIsAutocompleteOpen(false);
        setSearchQuery("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrimaryStepAdvance]);

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
      {/* BEGIN: MainHeader                                                         */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white border-b border-stone-200 px-6 py-3.5 flex items-center justify-between shrink-0">
        {/* Left: Navigation & Restaurant Identity */}
        <div className="flex items-center space-x-4">
          <button
            aria-label="Go Back"
            onClick={() => {
              if (currentStep > 1) {
                setCurrentStep((prev) => ((prev - 1) as 1 | 2));
              } else {
                router.push("/dashboard");
              }
            }}
            className="p-1.5 -ml-1.5 text-stone-700 hover:text-stone-950 transition-colors rounded-full hover:bg-stone-100 cursor-pointer"
            type="button"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
          <div className="flex items-baseline space-x-2.5">
            <h1 className="font-serif text-2xl tracking-tight text-stone-900 font-medium">Cashier</h1>
            <div className="flex items-center text-xs font-normal text-stone-500 space-x-1.5">
              <span>{activeOrg?.name || "Skyz Restaurant & Banquet"}</span>
              <span className="inline-block w-1 h-1 rounded-full bg-stone-300" />
              <span>Main Floor POS</span>
            </div>
          </div>
        </div>

        {/* Center: 3-Step Wizard Breadcrumbs */}
        <nav
          aria-label="Checkout Progress"
          className="flex items-center space-x-2 bg-stone-100/80 p-1 rounded-full border border-stone-200/60"
        >
          {/* Step 1 */}
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={`flex items-center space-x-1.5 px-3.5 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
              currentStep === 1
                ? "bg-stone-950 text-white shadow-sm"
                : currentStep > 1
                ? "text-emerald-700 hover:bg-stone-200/60"
                : "text-stone-400 hover:text-stone-600"
            }`}
          >
            {currentStep > 1 ? (
              <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
            <span>01 Build Order</span>
          </button>

          <svg className="w-3 h-3 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>

          {/* Step 2 */}
          <button
            type="button"
            onClick={() => {
              if (activeCart.items.length > 0) setCurrentStep(2);
              else showToast("Add items to cart first");
            }}
            className={`flex items-center space-x-1.5 px-3.5 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
              currentStep === 2
                ? "bg-stone-950 text-white shadow-sm"
                : currentStep > 2
                ? "text-emerald-700 hover:bg-stone-200/60"
                : "text-stone-400 hover:text-stone-600"
            }`}
          >
            {currentStep === 2 ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            ) : currentStep > 2 ? (
              <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <span className="w-1.5 h-1.5 rounded-full border border-stone-400" />
            )}
            <span>02 Order Details</span>
          </button>

          <svg className="w-3 h-3 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>

          {/* Step 3 */}
          <button
            type="button"
            onClick={() => {
              if (activeCart.items.length > 0) setCurrentStep(3);
              else showToast("Add items to cart first");
            }}
            className={`flex items-center space-x-1.5 px-3.5 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
              currentStep === 3
                ? "bg-stone-950 text-white shadow-sm"
                : "text-stone-400 hover:text-stone-600"
            }`}
          >
            {currentStep === 3 ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full border border-stone-400" />
            )}
            <span>03 Payment</span>
          </button>
        </nav>

        {/* Right: Cashier / Terminal Info */}
        <div className="flex items-center space-x-3">
          {/* Printer status pill */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-stone-500 border-r border-stone-200 pr-3">
            <span className="text-[11px] font-medium text-stone-400">Printer:</span>
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
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200">
                <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                Offline
              </span>
            )}
          </div>

          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-stone-900 leading-tight">
              Mahendra Suthar
            </div>
            <div className="text-[11px] text-stone-500 leading-tight">Admin POS terminal</div>
          </div>
          <div className="w-9 h-9 rounded-full bg-stone-950 text-white font-medium text-xs flex items-center justify-center tracking-wider">
            MS
          </div>
        </div>
      </header>
      {/* END: MainHeader */}

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
                    {taxCalculation.currencySymbol}{(cartSubtotalPaise / 100).toFixed(2)}
                  </span>
                </div>

                {/* Dynamic Multi-Component Split Tax Lines */}
                {taxCalculation.componentBreakdown.length > 0 ? (
                  taxCalculation.componentBreakdown.map((comp, cIdx) => (
                    <div
                      key={`${comp.name}_${comp.rate}_${cIdx}`}
                      className="flex justify-between text-[#8a7e75] text-[11px]"
                    >
                      <span className="flex items-center gap-1">
                        {comp.name} ({comp.rate}%)
                        {comp.isInclusive && (
                          <span className="text-[9px] bg-stone-100 text-stone-600 px-1 py-0.2 rounded border border-stone-200">
                            Incl.
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-stone-700">
                        {taxCalculation.currencySymbol}{(comp.taxAmountPaise / 100).toFixed(2)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between text-[#8a7e75] text-[11px]">
                    <span>Tax (0% / Exempt)</span>
                    <span className="font-mono">{taxCalculation.currencySymbol}0.00</span>
                  </div>
                )}
              </div>
              <div className="pt-2 border-t border-[#e7e5e4]/60 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-widest text-[#8a7e75]">
                    Total Payable
                  </div>
                  <div className="font-serif text-2xl font-semibold text-[#141010] leading-none mt-0.5">
                    {taxCalculation.currencySymbol}{(totalPayablePaise / 100).toFixed(2)}
                  </div>
                </div>

                {/* Step 1 Primary Action: Proceed to Step 2 */}
                <button
                  type="button"
                  disabled={activeCart.items.length === 0}
                  onClick={() => setCurrentStep(2)}
                  className={`px-5 py-2.5 rounded-full shadow-md transition-all flex items-center space-x-2 group cursor-pointer ${
                    activeCart.items.length > 0
                      ? "bg-[#0c0a09] hover:bg-stone-900 active:scale-95 text-white"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  <span className="font-medium text-sm">Order</span>
                  <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded font-mono font-medium">
                    F5
                  </span>
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

      {/* =====================================================      {/* ========================================================================= */}
      {/* STEP 2: ORDER DETAILS (FULL-WIDTH WORKSPACE WITH STICKY ACTION BAR)       */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <>
          <main className="flex-1 w-full px-6 lg:px-8 py-6 pb-32 overflow-y-auto">
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* BEGIN: LeftOrderSummaryColumn */}
              <aside className="w-full lg:w-96 xl:w-[420px] flex-shrink-0">
                <div className="bg-white border border-[#e7e5e4] rounded-2xl p-6 shadow-sm">
                  {/* Order Summary Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                    <div className="flex items-center space-x-2.5">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsCartSwitcherOpen(!isCartSwitcherOpen)}
                          className="inline-flex items-center gap-1.5 bg-[#0c0a09] hover:bg-stone-850 text-white text-[11px] font-semibold pl-3 pr-2.5 py-1 rounded-full shadow-xs border border-stone-800 transition-all cursor-pointer select-none"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span>{activeCart.label}</span>
                          <svg
                            className={`w-3 h-3 text-stone-300 transition-transform ${
                              isCartSwitcherOpen ? "rotate-180" : ""
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                          </svg>
                        </button>

                        {isCartSwitcherOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setIsCartSwitcherOpen(false)}
                            />
                            <div
                              className="absolute left-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-stone-200 p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150 font-sans"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-2.5 py-1 flex items-center justify-between">
                                <span>Active Carts</span>
                                <span>{cartTabs.length}</span>
                              </div>
                              <div className="space-y-1 mt-1 max-h-48 overflow-y-auto">
                                {cartTabs.map((ct) => {
                                  const isSelected = ct.id === activeCartId;
                                  const count = ct.items.reduce((sum, it) => sum + it.quantity, 0);
                                  const total = ct.items.reduce((sum, it) => sum + it.price * it.quantity, 0);
                                  return (
                                    <button
                                      key={ct.id}
                                      type="button"
                                      onClick={() => {
                                        setActiveCartId(ct.id);
                                        setIsCartSwitcherOpen(false);
                                      }}
                                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition cursor-pointer text-left ${
                                        isSelected
                                          ? "bg-stone-900 text-white font-medium"
                                          : "text-stone-800 hover:bg-stone-100"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`w-1.5 h-1.5 rounded-full ${
                                            isSelected ? "bg-emerald-400" : "bg-stone-400"
                                          }`}
                                        />
                                        <span className="font-semibold">{ct.label}</span>
                                      </div>
                                      <span
                                        className={`text-[11px] ${
                                          isSelected ? "text-stone-300" : "text-stone-500"
                                        }`}
                                      >
                                        {count} items • ₹{(total / 100).toFixed(2)}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="border-t border-stone-100 mt-2 pt-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleAddNewCartTab();
                                    setIsCartSwitcherOpen(false);
                                  }}
                                  className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                                >
                                  <span>+ Open New Cart</span>
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      <h2 className="font-serif text-xl font-medium text-stone-900">Order Summary</h2>
                    </div>
                    <button
                      onClick={() => setCurrentStep(1)}
                      className="text-xs font-medium text-stone-500 hover:text-stone-950 underline underline-offset-2 cursor-pointer"
                      type="button"
                    >
                      Edit
                    </button>
                  </div>

                  {/* Items Counter */}
                  <div className="pt-3 pb-4 text-xs text-stone-400 font-medium">
                    {activeCart.items.length} items •{" "}
                    {activeCart.items.reduce((sum, item) => sum + item.quantity, 0)} pcs
                  </div>

                  {/* Line Items List */}
                  <ul className="space-y-4 text-sm pb-5 border-b border-stone-100 max-h-80 overflow-y-auto pr-1">
                    {activeCart.items.map((item, idx) => (
                      <li key={item.itemId + "_" + idx} className="flex items-start justify-between">
                        <div className="flex items-start space-x-2.5">
                          <span
                            className={`mt-1 flex items-center justify-center w-3.5 h-3.5 border ${
                              item.isVeg ? "border-emerald-600" : "border-rose-600"
                            } p-0.5 rounded-[3px] shrink-0`}
                          >
                            <span
                              className={`w-1.5 h-1.5 ${
                                item.isVeg ? "bg-emerald-600" : "bg-rose-600"
                              } rounded-full`}
                            />
                          </span>
                          <div>
                            <div className="font-medium text-stone-900 leading-tight">{item.name}</div>
                            <div className="text-xs text-stone-400 mt-0.5">
                              Qty: {item.quantity} × ₹{(item.price / 100).toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <span className="font-medium text-stone-900 shrink-0">
                          ₹{((item.price * item.quantity) / 100).toFixed(2)}
                        </span>
                      </li>
                    ))}
                    {activeCart.items.length === 0 && (
                      <li className="text-xs text-stone-400 italic py-4 text-center">Cart is empty</li>
                    )}
                  </ul>

                  {/* Financial Breakdown */}
                  <div className="py-4 space-y-2 text-xs text-stone-600">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-medium text-stone-900">
                        {taxCalculation.currencySymbol}{(cartSubtotalPaise / 100).toFixed(2)}
                      </span>
                    </div>

                    {/* Dynamic Split Tax Component Breakdown */}
                    {taxCalculation.componentBreakdown.length > 0 ? (
                      taxCalculation.componentBreakdown.map((comp, cIdx) => (
                        <div
                          key={`step2_${comp.name}_${comp.rate}_${cIdx}`}
                          className="flex justify-between text-stone-500"
                        >
                          <span className="flex items-center gap-1">
                            {comp.name} ({comp.rate}%)
                            {comp.isInclusive && (
                              <span className="text-[9px] bg-stone-100 text-stone-600 px-1 py-0.2 rounded border border-stone-200 font-normal">
                                Incl.
                              </span>
                            )}
                          </span>
                          <span className="font-medium text-stone-900">
                            {taxCalculation.currencySymbol}{(comp.taxAmountPaise / 100).toFixed(2)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between text-stone-500">
                        <span>Tax (0% / Exempt)</span>
                        <span className="font-medium text-stone-900">{taxCalculation.currencySymbol}0.00</span>
                      </div>
                    )}

                    {activeCart.orderType === "Delivery" && (
                      <div className="flex justify-between text-stone-700 font-medium">
                        <span className="flex items-center gap-1">
                          Delivery Fee
                          <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded border border-stone-200">
                            Zone 1
                          </span>
                        </span>
                        <span className="text-stone-900">{taxCalculation.currencySymbol}58.00</span>
                      </div>
                    )}
                  </div>

                  {/* Total Due Section */}
                  <div className="pt-4 border-t border-dashed border-stone-200">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider font-semibold text-stone-500">
                          TOTAL PAYABLE
                        </span>
                        <span className="text-[11px] text-stone-400">
                          {taxCalculation.taxExclusivePaise > 0
                            ? "(incl. subtotal & taxes)"
                            : "(incl. all hospitality taxes)"}
                        </span>
                      </div>
                      <div className="font-serif text-2xl font-bold text-stone-950 tracking-tight">
                        {taxCalculation.currencySymbol}{(totalPayablePaise / 100).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Scheduled Badge Status */}
                  {activeCart.orderType === "Scheduled" && (
                    <div className="mt-4 bg-amber-50 border border-amber-200/80 rounded-xl p-3 flex items-center space-x-2.5 text-amber-900">
                      <span className="text-base">📅</span>
                      <div className="text-xs">
                        <span className="font-bold block">
                          Scheduled for {activeCart.scheduledDate || "Tomorrow"}
                        </span>
                        <span className="text-[11px] text-amber-800">
                          Slot: {activeCart.scheduledTime || "01:30 PM - 02:00 PM"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Return Action */}
                  <div className="mt-8 pt-4 border-t border-dotted border-stone-200 text-center">
                    <button
                      onClick={() => setCurrentStep(1)}
                      className="inline-flex items-center text-xs font-medium text-stone-600 hover:text-stone-950 transition-colors cursor-pointer"
                      type="button"
                    >
                      <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          d="M10 19l-7-7m0 0l7-7m-7 7h18"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        />
                      </svg>
                      Return to Menu catalog
                    </button>
                  </div>
                </div>
              </aside>
              {/* END: LeftOrderSummaryColumn */}

              {/* BEGIN: RightDetailsColumn */}
              <section className="flex-1 w-full space-y-6">
                {/* 1. Customer Information Card */}
                <div className="bg-white border border-[#e7e5e4] rounded-2xl p-7 md:p-8 shadow-sm">
                  <div>
                    <h3 className="font-serif text-2xl text-stone-900 font-normal">Customer Information</h3>
                    <p className="text-xs text-stone-500 mt-1">
                      Look up returning guest by phone number or enter new contact information
                    </p>
                  </div>

                  {/* Dynamic VIP / Returning Patron Badge */}
                  <div className="mt-5 p-3.5 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-2.5 text-xs text-stone-800">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          matchedCustomer ? "bg-emerald-500 animate-pulse" : "bg-blue-500"
                        } shrink-0`}
                      />
                      <span className="font-semibold text-stone-900">
                        {matchedCustomer
                          ? `Returning VIP Guest: ${matchedCustomer.firstName || ""} ${
                              matchedCustomer.lastName || ""
                            }`
                          : activeCart.customerFirstName || activeCart.customerPhone
                          ? `Guest: ${activeCart.customerFirstName || "Patron"} ${
                              activeCart.customerLastName || ""
                            }`
                          : "Walk-in Guest Patron"}
                      </span>
                      <span className="text-stone-500 hidden sm:inline">
                        {matchedCustomer
                          ? `• Store Member (${matchedCustomer.phone || activeCart.customerPhone})`
                          : "• Patron record will be associated with order"}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-md ${
                        matchedCustomer
                          ? "text-emerald-800 bg-emerald-100 border border-emerald-300"
                          : "text-stone-700 bg-stone-200/80 border border-stone-300"
                      }`}
                    >
                      {matchedCustomer ? "VERIFIED PROFILE" : "GUEST PROFILE"}
                    </span>
                  </div>

                  {/* Form Inputs */}
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* First Name */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1.5" htmlFor="first-name">
                        FIRST NAME *
                      </label>
                      <input
                        id="first-name"
                        className="w-full text-sm border border-stone-200 rounded-lg px-3.5 py-2.5 text-stone-900 font-medium focus:ring-1 focus:ring-stone-900 focus:border-stone-900 focus:outline-none bg-white"
                        type="text"
                        placeholder="e.g. Rohit"
                        value={activeCart.customerFirstName || ""}
                        onChange={(e) => {
                          const first = e.target.value;
                          setCartTabs((prev) =>
                            prev.map((c) =>
                              c.id === activeCartId
                                ? {
                                    ...c,
                                    customerFirstName: first,
                                    customerName: `${first} ${c.customerLastName || ""}`.trim(),
                                  }
                                : c,
                            ),
                          );
                        }}
                      />
                    </div>

                    {/* Last Name */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1.5" htmlFor="last-name">
                        LAST NAME
                      </label>
                      <input
                        id="last-name"
                        className="w-full text-sm border border-stone-200 rounded-lg px-3.5 py-2.5 text-stone-900 font-medium focus:ring-1 focus:ring-stone-900 focus:border-stone-900 focus:outline-none bg-white"
                        type="text"
                        placeholder="e.g. Chauhan"
                        value={activeCart.customerLastName || ""}
                        onChange={(e) => {
                          const last = e.target.value;
                          setCartTabs((prev) =>
                            prev.map((c) =>
                              c.id === activeCartId
                                ? {
                                    ...c,
                                    customerLastName: last,
                                    customerName: `${c.customerFirstName || ""} ${last}`.trim(),
                                  }
                                : c,
                            ),
                          );
                        }}
                      />
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1.5" htmlFor="phone-number">
                        PHONE NUMBER *
                      </label>
                      <div className="flex rounded-lg shadow-sm border border-stone-200 overflow-hidden focus-within:ring-1 focus-within:ring-stone-900 focus-within:border-stone-900">
                        <button
                          className="inline-flex items-center px-3 border-r border-stone-200 bg-stone-50 text-stone-700 text-xs font-medium hover:bg-stone-100"
                          type="button"
                        >
                          <span className="mr-1.5 text-base">🇮🇳</span>
                          <span>+91</span>
                          <svg className="ml-1 w-3 h-3 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                          </svg>
                        </button>
                        <input
                          id="phone-number"
                          className="flex-1 min-w-0 block w-full px-3.5 py-2.5 text-sm text-stone-900 font-medium focus:outline-none bg-white"
                          type="tel"
                          placeholder="98250 14820"
                          value={activeCart.customerPhone || ""}
                          onChange={(e) => handleCustomerPhoneChange(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Email Address */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1.5" htmlFor="email-address">
                        EMAIL ADDRESS <span className="font-normal text-stone-400">(OPTIONAL)</span>
                      </label>
                      <input
                        id="email-address"
                        className="w-full text-sm border border-stone-200 rounded-lg px-3.5 py-2.5 text-stone-900 font-medium focus:ring-1 focus:ring-stone-900 focus:border-stone-900 focus:outline-none bg-white"
                        type="email"
                        placeholder="guest@example.com"
                        value={activeCart.customerEmail || ""}
                        onChange={(e) =>
                          setCartTabs((prev) =>
                            prev.map((c) =>
                              c.id === activeCartId ? { ...c, customerEmail: e.target.value } : c,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Order Type & Fulfillment Section */}
                <div className="bg-white border border-[#e7e5e4] rounded-2xl p-7 md:p-8 shadow-sm">
                  <div>
                    <h3 className="font-serif text-2xl text-stone-900 font-normal">Order Type &amp; Fulfillment</h3>
                    <p className="text-xs text-stone-500 mt-1">Specify how this order should be prepared and fulfilled.</p>
                  </div>

                  {/* Service Mode Selector (Tabs with Explicit High Contrast) */}
                  <div className="mt-6">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-2">
                      Select Order Service Mode
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Dine In */}
                      <button
                        onClick={() =>
                          setCartTabs((prev) =>
                            prev.map((c) => (c.id === activeCartId ? { ...c, orderType: "DineIn" } : c)),
                          )
                        }
                        className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-medium text-xs transition cursor-pointer ${
                          activeCart.orderType === "DineIn"
                            ? "bg-black text-white shadow-md border-2 border-black"
                            : "bg-white hover:bg-stone-50 border border-stone-200 text-stone-800"
                        }`}
                        type="button"
                      >
                        <svg
                          className={`w-4 h-4 ${
                            activeCart.orderType === "DineIn" ? "text-white stroke-[2.5]" : "text-stone-700"
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                          />
                        </svg>
                        <span
                          className={
                            activeCart.orderType === "DineIn"
                              ? "text-white font-semibold"
                              : "text-stone-800 font-medium"
                          }
                        >
                          Dine In
                        </span>
                      </button>

                      {/* Takeaway */}
                      <button
                        onClick={() =>
                          setCartTabs((prev) =>
                            prev.map((c) => (c.id === activeCartId ? { ...c, orderType: "TakeAway" } : c)),
                          )
                        }
                        className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-medium text-xs transition cursor-pointer ${
                          activeCart.orderType === "TakeAway"
                            ? "bg-black text-white shadow-md border-2 border-black"
                            : "bg-white hover:bg-stone-50 border border-stone-200 text-stone-800"
                        }`}
                        type="button"
                      >
                        <svg
                          className={`w-4 h-4 ${
                            activeCart.orderType === "TakeAway" ? "text-white stroke-[2.5]" : "text-stone-700"
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                          />
                        </svg>
                        <span
                          className={
                            activeCart.orderType === "TakeAway"
                              ? "text-white font-semibold"
                              : "text-stone-800 font-medium"
                          }
                        >
                          Takeaway
                        </span>
                      </button>

                      {/* Delivery */}
                      <button
                        onClick={() =>
                          setCartTabs((prev) =>
                            prev.map((c) => (c.id === activeCartId ? { ...c, orderType: "Delivery" } : c)),
                          )
                        }
                        className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-medium text-xs transition cursor-pointer ${
                          activeCart.orderType === "Delivery"
                            ? "bg-black text-white shadow-md border-2 border-black"
                            : "bg-white hover:bg-stone-50 border border-stone-200 text-stone-800"
                        }`}
                        type="button"
                      >
                        <svg
                          className={`w-4 h-4 ${
                            activeCart.orderType === "Delivery" ? "text-white stroke-[2.5]" : "text-stone-700"
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                          />
                        </svg>
                        <span
                          className={
                            activeCart.orderType === "Delivery"
                              ? "text-white font-semibold"
                              : "text-stone-800 font-medium"
                          }
                        >
                          Delivery
                        </span>
                      </button>

                      {/* Scheduled */}
                      <button
                        onClick={() =>
                          setCartTabs((prev) =>
                            prev.map((c) => (c.id === activeCartId ? { ...c, orderType: "Scheduled" } : c)),
                          )
                        }
                        className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-medium text-xs transition cursor-pointer ${
                          activeCart.orderType === "Scheduled"
                            ? "bg-black text-white shadow-md border-2 border-black"
                            : "bg-white hover:bg-stone-50 border border-stone-200 text-stone-800"
                        }`}
                        type="button"
                      >
                        <svg
                          className={`w-4 h-4 ${
                            activeCart.orderType === "Scheduled" ? "text-white stroke-[2.5]" : "text-stone-700"
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                          />
                        </svg>
                        <span
                          className={
                            activeCart.orderType === "Scheduled"
                              ? "text-white font-semibold"
                              : "text-stone-800 font-medium"
                          }
                        >
                          Scheduled
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Dine-in Table Options */}
                  {activeCart.orderType === "DineIn" && (
                    <>
                      {/* STATE 1: Table & Service Details Container */}
                      <div className="mt-5 pt-5 border-t border-stone-100">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-2">
                          Table Required?
                        </label>
                        <div className="inline-flex p-1 bg-stone-100/90 rounded-xl border border-stone-200/80 space-x-1">
                          {/* Option 1: Yes, assign a table */}
                          <button
                            type="button"
                            onClick={() =>
                              setCartTabs((prev) =>
                                prev.map((c) =>
                                  c.id === activeCartId ? { ...c, isTableRequired: true } : c,
                                ),
                              )
                            }
                            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs transition cursor-pointer ${
                              activeCart.isTableRequired === true
                                ? "bg-[#0c0a09] text-white shadow-sm ring-1 ring-stone-900"
                                : "text-stone-700 hover:text-black hover:bg-white/80"
                            }`}
                          >
                            {activeCart.isTableRequired === true && (
                              <svg
                                className="w-3.5 h-3.5 stroke-[2.5] text-emerald-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                            <span className={activeCart.isTableRequired === true ? "text-white font-semibold" : "text-stone-700 font-medium"}>
                              Yes, assign a table
                            </span>
                          </button>

                          {/* Option 2: No table (DEFAULT) */}
                          <button
                            type="button"
                            onClick={() =>
                              setCartTabs((prev) =>
                                prev.map((c) =>
                                  c.id === activeCartId
                                    ? {
                                        ...c,
                                        isTableRequired: false,
                                        tableId: undefined,
                                        tableName: undefined,
                                      }
                                    : c,
                                ),
                              )
                            }
                            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs transition cursor-pointer ${
                              activeCart.isTableRequired !== true
                                ? "bg-[#0c0a09] text-white shadow-sm ring-1 ring-stone-900"
                                : "text-stone-700 hover:text-black hover:bg-white/80"
                            }`}
                          >
                            {activeCart.isTableRequired !== true && (
                              <svg
                                className="w-3.5 h-3.5 stroke-[2.5] text-emerald-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                            <span className={activeCart.isTableRequired !== true ? "text-white font-semibold" : "text-stone-700 font-medium"}>
                              No table
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* STATE A: No Table Selected Card (Direct-to-Counter / Open Dining) */}
                      {activeCart.isTableRequired !== true && (
                        <div className="mt-6 border border-stone-200 rounded-xl p-6 bg-white space-y-5">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-100">
                            <div>
                              <div className="flex items-center space-x-2">
                                <h4 className="text-sm font-semibold text-stone-900">Dine-In without table</h4>
                                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                  <svg
                                    className="w-3 h-3 stroke-[2.5]"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                  <span>Direct-to-Counter / Open Dining</span>
                                </span>
                              </div>
                              <p className="text-xs text-stone-500 mt-1 max-w-xl">
                                This order can continue without assigning a table. Suitable for waiting guests, standing bar, or when table assignment will happen later.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* STATE B: If Table is Required, show Table Assignment Grid */}
                      {activeCart.isTableRequired === true && (
                        <div className="mt-6 border border-stone-200 rounded-xl p-6 bg-white space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {/* Table Assignment */}
                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                                Table Assignment *
                              </label>
                              <div className="relative">
                                <select
                                  value={activeCart.tableId || ""}
                                  onChange={(e) => {
                                    const selectedTbl = tables?.find((t) => t._id === e.target.value);
                                    setCartTabs((prev) =>
                                      prev.map((c) =>
                                        c.id === activeCartId
                                          ? {
                                              ...c,
                                              tableId: e.target.value,
                                              tableName: selectedTbl?.tableNumber,
                                              guestCount: selectedTbl?.seatingCapacity || c.guestCount || 2,
                                            }
                                          : c,
                                      ),
                                    );
                                  }}
                                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2.5 text-stone-900 font-medium appearance-none pr-8 focus:ring-1 focus:ring-stone-900 focus:border-stone-900 focus:outline-none bg-white cursor-pointer"
                                >
                                  <option value="">Select Table</option>
                                  {tables && tables.length > 0 ? (
                                    tables.map((tbl) => (
                                      <option key={tbl._id} value={tbl._id}>
                                        {tbl.tableNumber} ({tbl.seatingCapacity} Seater)
                                      </option>
                                    ))
                                  ) : (
                                    <option value="" disabled>No tables configured in settings</option>
                                  )}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-stone-500">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                  </svg>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1.5 mt-2 text-[11px] text-emerald-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>Table Status: Clean &amp; Ready</span>
                              </div>
                            </div>

                            {/* Assigned Waiter / Captain */}
                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                                Assigned Waiter / Captain
                              </label>
                              <div className="relative">
                                <select
                                  value={activeCart.waiterId || ""}
                                  onChange={(e) => {
                                    const selectedStaff = availableWaitersAndStaff.find((w) => w.id === e.target.value);
                                    setCartTabs((prev) =>
                                      prev.map((c) =>
                                        c.id === activeCartId
                                          ? {
                                              ...c,
                                              waiterId: e.target.value,
                                              waiterName: selectedStaff ? selectedStaff.name : undefined,
                                            }
                                          : c,
                                      ),
                                    );
                                  }}
                                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2.5 text-stone-900 font-medium appearance-none pr-8 focus:ring-1 focus:ring-stone-900 focus:border-stone-900 focus:outline-none bg-white cursor-pointer"
                                >
                                  <option value="">Select Waiter / Captain</option>
                                  {availableWaitersAndStaff.length > 0 ? (
                                    availableWaitersAndStaff.map((w) => (
                                      <option key={w.id} value={w.id}>
                                        {w.name} ({w.roleDisplay})
                                      </option>
                                    ))
                                  ) : (
                                    <option value="" disabled>No staff configured</option>
                                  )}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-stone-500">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                  </svg>
                                </div>
                              </div>
                              <p className="mt-2 text-[11px] text-stone-500">Duty Shift: Floor Station A</p>
                            </div>

                            {/* Guest Count (PAX) */}
                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                                Guest Count (PAX)
                              </label>
                              <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden bg-stone-50/50">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const current = activeCart.guestCount || 2;
                                    if (current > 1) {
                                      setCartTabs((prev) =>
                                        prev.map((c) =>
                                          c.id === activeCartId ? { ...c, guestCount: current - 1 } : c,
                                        ),
                                      );
                                    }
                                  }}
                                  className="px-3 py-2 text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M20 12H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                  </svg>
                                </button>
                                <div className="flex-1 text-center text-xs font-semibold text-stone-900 py-2">
                                  {activeCart.guestCount || 2} Guests
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const current = activeCart.guestCount || 2;
                                    setCartTabs((prev) =>
                                      prev.map((c) =>
                                        c.id === activeCartId ? { ...c, guestCount: current + 1 } : c,
                                      ),
                                    );
                                  }}
                                  className="px-3 py-2 text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                  </svg>
                                </button>
                              </div>
                              <p className="mt-2 text-[11px] text-stone-500">
                                {activeCart.tableId && tables?.find((t) => t._id === activeCart.tableId)
                                  ? `Table capacity: ${tables.find((t) => t._id === activeCart.tableId)?.seatingCapacity} Pax`
                                  : "Seating capacity"}
                              </p>
                            </div>
                          </div>

                          {/* Routing Banner Notice */}
                          <div className="pt-2 border-t border-stone-100 flex items-center space-x-2 text-xs text-stone-600">
                            <svg className="w-4 h-4 text-stone-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                              />
                            </svg>
                            <span>
                              Kitchen Order Ticket (KOT) will route Table{" "}
                              <strong>{activeCart.tableName || "assigned table"}</strong> straight to
                              the <strong>Main Kitchen KDS Display</strong>.
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Takeaway Details Section */}
                  {activeCart.orderType === "TakeAway" && (
                    <div className="mt-6 bg-[#fdf8f7] border border-[#eadfd6] rounded-xl p-6 space-y-6">
                      <h3 className="text-xs font-semibold tracking-wider text-stone-500 uppercase">
                        TAKEAWAY DETAILS
                      </h3>

                      {/* 2-Column Pickup & Prep Config */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Pickup Location Selector */}
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                            PICKUP LOCATION *
                          </label>
                          <div className="relative">
                            <select
                              value={activeCart.pickupLocation || "Main Counter (Front Desk)"}
                              onChange={(e) =>
                                setCartTabs((prev) =>
                                  prev.map((c) =>
                                    c.id === activeCartId ? { ...c, pickupLocation: e.target.value } : c,
                                  ),
                                )
                              }
                              className="w-full appearance-none bg-white border border-stone-300 rounded-lg px-3.5 py-2.5 text-sm text-stone-900 pr-10 focus:ring-1 focus:ring-stone-900 focus:border-stone-900 focus:outline-none cursor-pointer"
                            >
                              <option value="Main Counter (Front Desk)">Main Counter (Front Desk)</option>
                              <option value="Express Pickup Window">Express Pickup Window</option>
                              <option value="Curbside Station">Curbside Station</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-stone-400">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                              </svg>
                            </div>
                          </div>
                          <p className="text-[11px] text-stone-500 mt-1.5 flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 shrink-0" />
                            Ready for customer collection upon KOT completion
                          </p>
                        </div>

                        {/* Estimated Prep Time */}
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                            ESTIMATED PREPARATION TIME
                          </label>
                          <div className="flex items-center px-3.5 py-2.5 bg-white border border-stone-300 rounded-lg text-sm text-stone-900">
                            <svg className="w-4 h-4 text-stone-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                            </svg>
                            <span className="font-semibold text-stone-900 mr-2">15 - 20 mins</span>
                            <span className="text-xs text-stone-400">| Kitchen Priority: Normal</span>
                          </div>
                          <p className="text-[11px] text-stone-500 mt-1.5">Order will be flagged as Express Takeaway in Kitchen</p>
                        </div>
                      </div>

                      {/* Packaging & Cutlery Preferences */}
                      <div className="pt-2 border-t border-[#eadfd6]/60">
                        <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-3">
                          PACKAGING &amp; CUTLERY PREFERENCES
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <label className="flex items-center space-x-2.5 text-xs text-stone-800 bg-white/75 p-3 rounded-lg border border-stone-200 cursor-pointer hover:bg-white transition-colors">
                            <input
                              type="checkbox"
                              checked={activeCart.includeCarryBag !== false}
                              onChange={(e) =>
                                setCartTabs((prev) =>
                                  prev.map((c) =>
                                    c.id === activeCartId ? { ...c, includeCarryBag: e.target.checked } : c,
                                  ),
                                )
                              }
                              className="rounded border-stone-300 text-stone-900 focus:ring-stone-900 w-4 h-4 cursor-pointer"
                            />
                            <span className="font-medium">Eco-friendly carry bag included</span>
                          </label>
                          <label className="flex items-center space-x-2.5 text-xs text-stone-800 bg-white/75 p-3 rounded-lg border border-stone-200 cursor-pointer hover:bg-white transition-colors">
                            <input
                              type="checkbox"
                              checked={activeCart.includeCutlery !== false}
                              onChange={(e) =>
                                setCartTabs((prev) =>
                                  prev.map((c) =>
                                    c.id === activeCartId ? { ...c, includeCutlery: e.target.checked } : c,
                                  ),
                                )
                              }
                              className="rounded border-stone-300 text-stone-900 focus:ring-stone-900 w-4 h-4 cursor-pointer"
                            />
                            <span className="font-medium">Include disposable wooden cutlery &amp; napkins</span>
                          </label>
                          <label className="flex items-center space-x-2.5 text-xs text-stone-800 bg-white/75 p-3 rounded-lg border border-stone-200 cursor-pointer hover:bg-white transition-colors">
                            <input
                              type="checkbox"
                              checked={activeCart.contactlessHandoff === true}
                              onChange={(e) =>
                                setCartTabs((prev) =>
                                  prev.map((c) =>
                                    c.id === activeCartId ? { ...c, contactlessHandoff: e.target.checked } : c,
                                  ),
                                )
                              }
                              className="rounded border-stone-300 text-stone-900 focus:ring-stone-900 w-4 h-4 cursor-pointer"
                            />
                            <span className="font-medium">Contactless handoff requested</span>
                          </label>
                        </div>
                      </div>

                      {/* Pickup Note / Kitchen Instructions */}
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                          PICKUP NOTE / KITCHEN INSTRUCTIONS <span className="text-stone-400 font-normal">(OPTIONAL)</span>
                        </label>
                        <textarea
                          className="w-full bg-white border border-stone-300 rounded-lg p-3 text-sm text-stone-900 focus:ring-1 focus:ring-stone-900 focus:border-stone-900 focus:outline-none placeholder:text-stone-400"
                          placeholder="Add a note for the kitchen or packing station (e.g., pack condiments separately, double seal soup)..."
                          rows={2}
                          value={activeCart.specialNotes || ""}
                          onChange={(e) =>
                            setCartTabs((prev) =>
                              prev.map((c) =>
                                c.id === activeCartId ? { ...c, specialNotes: e.target.value } : c,
                              ),
                            )
                          }
                        />
                      </div>

                      {/* Context Banner */}
                      <div className="flex items-center space-x-2 bg-stone-100/70 text-stone-600 rounded-lg p-3 text-xs border border-stone-200/80">
                        <svg className="w-4 h-4 text-stone-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                          />
                        </svg>
                        <span>
                          Takeaway orders bypass dining table allocation and generate an Express Token (<strong>Token #TK-84</strong>) for counter display.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* STATE C: DELIVERY DETAILS CONTAINER */}
                  {activeCart.orderType === "Delivery" && (
                    <div className="mt-6 bg-[#fdf8f7] border border-[#eadfd6] rounded-xl p-6 space-y-5" data-purpose="delivery-details-card">
                      {/* Delivery Details Section Title */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-600">
                          Delivery Details
                        </span>
                        <span className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Instant Dispatch Active
                        </span>
                      </div>

                      {/* Customer Address Section */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-stone-900">
                            Customer Delivery Address
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const newAddr = prompt("Enter new delivery address:");
                              if (newAddr) {
                                setCartTabs((prev) =>
                                  prev.map((c) =>
                                    c.id === activeCartId
                                      ? {
                                          ...c,
                                          deliveryAddress: {
                                            addressLine1: newAddr,
                                            city: "Mumbai",
                                            zipCode: "400001",
                                            landmark: "Near Landmark",
                                            label: "Delivery Address",
                                          },
                                        }
                                      : c,
                                  ),
                                );
                              }
                            }}
                            className="text-xs font-medium text-stone-800 hover:text-stone-950 border border-stone-300 rounded-full px-3 py-1 bg-white hover:bg-stone-50 transition shadow-2xs cursor-pointer"
                          >
                            + Add New Address
                          </button>
                        </div>

                        {/* Selected Saved Address Card */}
                        <div className="p-4 bg-white rounded-xl border-2 border-stone-900 shadow-xs flex items-start space-x-3.5">
                          <div className="mt-0.5">
                            <span className="w-4 h-4 rounded-full border-4 border-stone-900 bg-white flex items-center justify-center shrink-0" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold tracking-wider uppercase bg-stone-900 text-white px-2 py-0.5 rounded">
                                {activeCart.deliveryAddress?.label || "Home"}
                              </span>
                              <p className="text-xs font-semibold text-stone-950">
                                {activeCart.deliveryAddress?.addressLine1 ||
                                  "34, Example Street, Near Sunshine Heights, Bandra West, Mumbai, Maharashtra 400001"}
                              </p>
                            </div>
                            <p className="text-xs text-stone-500 mt-1.5 flex items-center gap-2 flex-wrap">
                              <span>
                                <strong className="font-medium text-stone-700">Landmark:</strong>{" "}
                                {activeCart.deliveryAddress?.landmark || "Opposite Lotus Park"}
                              </span>
                              <span>•</span>
                              <span>
                                <strong className="font-medium text-stone-700">Contact on delivery:</strong>{" "}
                                {activeCart.customerPhone || "+91 98250 14820"}
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Operational Delivery Metrics Row (3-column cards) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        {/* 1. Expected Delivery */}
                        <div className="bg-white border border-stone-200 rounded-lg p-3.5 shadow-2xs">
                          <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block">
                            Expected Delivery
                          </span>
                          <div className="mt-1 flex items-baseline gap-1.5">
                            <span className="font-serif text-xl font-bold text-stone-950">38 mins</span>
                          </div>
                          <p className="text-[11px] text-stone-500 mt-0.5">Estimated dispatch in 18 min</p>
                        </div>

                        {/* 2. Delivery Charge */}
                        <div className="bg-white border border-stone-200 rounded-lg p-3.5 shadow-2xs">
                          <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block">
                            Delivery Charge
                          </span>
                          <div className="mt-1 flex items-baseline gap-1.5">
                            <span className="font-serif text-xl font-bold text-stone-950">₹58.00</span>
                          </div>
                          <p className="text-[11px] text-stone-500 mt-0.5">Standard zone (within 4.5 km)</p>
                        </div>

                        {/* 3. Delivery Partner / Rider */}
                        <div className="bg-white border border-stone-200 rounded-lg p-3.5 shadow-2xs">
                          <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block">
                            Delivery Partner / Rider
                          </span>
                          <div className="mt-1 flex items-center justify-between">
                            <span className="font-serif text-lg font-bold text-stone-950">PORTER Express</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[11px]">
                            <span className="bg-stone-100 text-stone-800 font-medium px-1.5 py-0.5 rounded border border-stone-200 text-[10px]">
                              Assigned: {activeCart.deliveryRider || "Rajesh K."}
                            </span>
                            <span className="text-stone-400">#PTR-9942</span>
                          </div>
                        </div>
                      </div>

                      {/* Delivery Instructions for Rider */}
                      <div>
                        <label
                          className="block text-[11px] font-semibold uppercase tracking-wider text-stone-600 mb-1.5"
                          htmlFor="delivery-notes"
                        >
                          Delivery Instructions for Rider
                        </label>
                        <input
                          id="delivery-notes"
                          type="text"
                          className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs text-stone-900 focus:border-stone-950 focus:ring-1 focus:ring-stone-950 focus:outline-none transition"
                          placeholder="Ring doorbell twice, leave at reception desk if unavailable..."
                          value={activeCart.deliveryInstructions || ""}
                          onChange={(e) =>
                            setCartTabs((prev) =>
                              prev.map((c) =>
                                c.id === activeCartId
                                  ? { ...c, deliveryInstructions: e.target.value }
                                  : c,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* STATE D: SCHEDULE ORDER CONTAINER */}
                  {activeCart.orderType === "Scheduled" && (
                    <div className="mt-6 bg-[#fdf8f7] border border-[#eadfd6] rounded-xl p-6 space-y-5" data-purpose="scheduled-order-config">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <span className="text-[11px] uppercase font-bold tracking-wider text-stone-700">
                          SCHEDULE ORDER FULFILLMENT
                        </span>
                        {/* Sub-segment selector for fulfillment type */}
                        <div className="flex items-center space-x-1.5 bg-stone-200/60 p-1 rounded-lg">
                          <button
                            type="button"
                            onClick={() =>
                              setCartTabs((prev) =>
                                prev.map((c) =>
                                  c.id === activeCartId
                                    ? { ...c, scheduledSubtype: "ScheduledPickup" }
                                    : c,
                                ),
                              )
                            }
                            className={`text-xs font-semibold px-3 py-1 rounded-md shadow-sm transition-colors cursor-pointer ${
                              activeCart.scheduledSubtype !== "ScheduledDelivery"
                                ? "bg-stone-900 text-white"
                                : "bg-white border border-stone-200 text-stone-700 hover:text-black"
                            }`}
                          >
                            Scheduled Pickup
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCartTabs((prev) =>
                                prev.map((c) =>
                                  c.id === activeCartId
                                    ? { ...c, scheduledSubtype: "ScheduledDelivery" }
                                    : c,
                                ),
                              )
                            }
                            className={`text-xs font-semibold px-3 py-1 rounded-md shadow-sm transition-colors cursor-pointer ${
                              activeCart.scheduledSubtype === "ScheduledDelivery"
                                ? "bg-stone-900 text-white"
                                : "bg-white border border-stone-200 text-stone-700 hover:text-black"
                            }`}
                          >
                            Scheduled Delivery
                          </button>
                        </div>
                      </div>

                      {/* Date & Time Picker Row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                        {/* Scheduled Date */}
                        <div>
                          <label
                            className="block text-[11px] uppercase font-bold tracking-wider text-stone-600 mb-1.5"
                            htmlFor="scheduled-date"
                          >
                            SCHEDULED DATE *
                          </label>
                          <div className="relative">
                            <select
                              id="scheduled-date"
                              value={activeCart.scheduledDate || "Tomorrow — Sep 17, 2026"}
                              onChange={(e) =>
                                setCartTabs((prev) =>
                                  prev.map((c) =>
                                    c.id === activeCartId
                                      ? { ...c, scheduledDate: e.target.value }
                                      : c,
                                  ),
                                )
                              }
                              className="w-full bg-white border border-stone-200 rounded-lg pl-9 pr-8 py-2.5 text-xs font-semibold text-stone-900 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 focus:outline-none appearance-none cursor-pointer"
                            >
                              <option value="Tomorrow — Sep 17, 2026">Tomorrow — Sep 17, 2026</option>
                              <option value="Fri, Sep 18, 2026">Fri, Sep 18, 2026</option>
                              <option value="Sat, Sep 19, 2026">Sat, Sep 19, 2026</option>
                              <option value="Sun, Sep 20, 2026">Sun, Sep 20, 2026</option>
                              <option value="Mon, Sep 21, 2026">Mon, Sep 21, 2026</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-stone-500">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                />
                              </svg>
                            </div>
                            <div className="pointer-events-none absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                              </svg>
                            </div>
                          </div>
                          <div className="text-[11px] text-stone-500 mt-1.5 flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span>Pre-order buffer: Minimum 3 hours required</span>
                          </div>
                        </div>

                        {/* Scheduled Time Window */}
                        <div>
                          <label
                            className="block text-[11px] uppercase font-bold tracking-wider text-stone-600 mb-1.5"
                            htmlFor="scheduled-time"
                          >
                            SCHEDULED TIME WINDOW *
                          </label>
                          <div className="relative">
                            <select
                              id="scheduled-time"
                              value={activeCart.scheduledTime || "01:30 PM - 02:00 PM (Lunch Slot)"}
                              onChange={(e) =>
                                setCartTabs((prev) =>
                                  prev.map((c) =>
                                    c.id === activeCartId
                                      ? { ...c, scheduledTime: e.target.value }
                                      : c,
                                  ),
                                )
                              }
                              className="w-full bg-white border border-stone-200 rounded-lg pl-9 pr-8 py-2.5 text-xs font-semibold text-stone-900 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 focus:outline-none appearance-none cursor-pointer"
                            >
                              <option value="01:30 PM - 02:00 PM (Lunch Slot)">01:30 PM - 02:00 PM (Lunch Slot)</option>
                              <option value="02:00 PM - 02:30 PM">02:00 PM - 02:30 PM</option>
                              <option value="07:00 PM - 07:30 PM (Dinner Slot)">07:00 PM - 07:30 PM (Dinner Slot)</option>
                              <option value="08:00 PM - 08:30 PM (Dinner Slot)">08:00 PM - 08:30 PM (Dinner Slot)</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-stone-500">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                />
                              </svg>
                            </div>
                            <div className="pointer-events-none absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                              </svg>
                            </div>
                          </div>
                          <div className="text-[11px] text-stone-500 mt-1.5 flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Slot availability: 8 slots open</span>
                          </div>
                        </div>
                      </div>

                      {/* Dynamic Fulfillment Location Details */}
                      <div className="border-t border-[#eadfd6] pt-4 mt-2">
                        {activeCart.scheduledSubtype === "ScheduledDelivery" ? (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-xs font-semibold text-stone-900">
                                Delivery Address for Scheduled Drop
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  const newAddr = prompt("Enter scheduled delivery address:");
                                  if (newAddr) {
                                    setCartTabs((prev) =>
                                      prev.map((c) =>
                                        c.id === activeCartId
                                          ? {
                                              ...c,
                                              deliveryAddress: {
                                                addressLine1: newAddr,
                                                city: "Mumbai",
                                                zipCode: "400001",
                                                landmark: "Near Landmark",
                                                label: "Scheduled Address",
                                              },
                                            }
                                          : c,
                                      ),
                                    );
                                  }
                                }}
                                className="text-xs font-medium text-stone-800 hover:text-stone-950 border border-stone-300 rounded-full px-3 py-1 bg-white hover:bg-stone-50 transition shadow-2xs cursor-pointer"
                              >
                                + Change Address
                              </button>
                            </div>
                            <div className="p-3.5 bg-white rounded-xl border border-stone-200 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase bg-stone-900 text-white px-2 py-0.5 rounded">
                                  {activeCart.deliveryAddress?.label || "Home"}
                                </span>
                                <span className="font-semibold text-stone-900">
                                  {activeCart.deliveryAddress?.addressLine1 ||
                                    "34, Example Street, Near Sunshine Heights, Bandra West, Mumbai"}
                                </span>
                              </div>
                              <span className="text-stone-500 text-[11px]">
                                Contact: {activeCart.customerPhone || "+91 98250 14820"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                              <label
                                className="block text-[11px] uppercase font-bold tracking-wider text-stone-600 mb-1.5"
                                htmlFor="pickup-counter"
                              >
                                PICKUP COUNTER
                              </label>
                              <div className="relative">
                                <select
                                  id="pickup-counter"
                                  value={activeCart.scheduledPickupCounter || "Main Counter (Front Desk)"}
                                  onChange={(e) =>
                                    setCartTabs((prev) =>
                                      prev.map((c) =>
                                        c.id === activeCartId
                                          ? { ...c, scheduledPickupCounter: e.target.value }
                                          : c,
                                      ),
                                    )
                                  }
                                  className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs font-semibold text-stone-900 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 focus:outline-none appearance-none cursor-pointer"
                                >
                                  <option value="Main Counter (Front Desk)">Main Counter (Front Desk)</option>
                                  <option value="Express Drive-thru Bay 2">Express Drive-thru Bay 2</option>
                                  <option value="Banquet Concierge">Banquet Concierge</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                            <div>
                              <label className="block text-[11px] uppercase font-bold tracking-wider text-stone-600 mb-1.5">
                                KITCHEN PREPARATION KICKOFF
                              </label>
                              <div className="bg-stone-100 border border-stone-200 rounded-lg px-3 py-2 flex items-center space-x-2 text-stone-700">
                                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                                <span className="text-xs font-medium">
                                  Auto-release to KDS at <strong className="font-semibold text-stone-900">01:00 PM</strong> (30 min prep window)
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* WhatsApp Reminder Notice */}
                      <div className="bg-white/80 border border-[#eadfd6] rounded-lg p-3 flex items-start space-x-2 text-xs text-stone-600">
                        <svg className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.599 2.679-.702c.971.531 1.769.82 2.781.821h.001c3.182 0 5.767-2.587 5.767-5.766.001-3.182-2.585-5.805-5.768-5.805zm0 10.377c-.901 0-1.745-.251-2.484-.716l-.178-.112-1.844.484.492-1.799-.122-.194c-.521-.832-.796-1.791-.795-2.774.001-2.628 2.138-4.765 4.767-4.765 2.627 0 4.765 2.137 4.765 4.765 0 2.628-2.138 4.811-4.601 4.911z" />
                        </svg>
                        <span>
                          <strong className="font-semibold text-stone-800">Reminder:</strong> Customer will receive an automated WhatsApp confirmation &amp; pickup alert 15 minutes before the scheduled time slot.
                        </span>
                      </div>

                      {/* Special Event / Packaging Note */}
                      <div>
                        <label
                          className="block text-[11px] uppercase font-bold tracking-wider text-stone-600 mb-1.5"
                          htmlFor="event-notes"
                        >
                          SPECIAL EVENT / PACKAGING NOTE
                        </label>
                        <textarea
                          id="event-notes"
                          className="w-full bg-white border border-stone-200 rounded-lg p-3 text-xs text-stone-800 placeholder-stone-400 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 focus:outline-none transition-colors"
                          placeholder="Corporate luncheon order. Please keep hot items in insulated containers..."
                          rows={2}
                          value={activeCart.specialNotes || ""}
                          onChange={(e) =>
                            setCartTabs((prev) =>
                              prev.map((c) =>
                                c.id === activeCartId ? { ...c, specialNotes: e.target.value } : c,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Kitchen Prep Notes (For Non-Takeaway, Non-Delivery, Non-Scheduled orders) */}
                  {activeCart.orderType !== "TakeAway" &&
                    activeCart.orderType !== "Delivery" &&
                    activeCart.orderType !== "Scheduled" && (
                      <div className="mt-6">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                          Kitchen Preparation Notes / Dietary Requests
                        </label>
                        <textarea
                          className="w-full text-xs border border-stone-200 rounded-lg p-3 text-stone-900 font-normal focus:ring-1 focus:ring-stone-900 focus:border-stone-900 focus:outline-none bg-white"
                          placeholder="Add custom notes for chefs..."
                          rows={2}
                          value={activeCart.specialNotes || ""}
                          onChange={(e) =>
                            setCartTabs((prev) =>
                              prev.map((c) =>
                                c.id === activeCartId ? { ...c, specialNotes: e.target.value } : c,
                              ),
                            )
                          }
                        />
                      </div>
                    )}
                </div>
              </section>
              {/* END: RightDetailsColumn */}
            </div>
          </main>

          {/* BEGIN: BottomStickyBar */}
          <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-stone-200 z-50 py-3.5 px-6 md:px-8">
            <div className="w-full flex items-center justify-between">
              {/* Back Navigation Button */}
              <button
                onClick={() => setCurrentStep(1)}
                className="inline-flex items-center px-6 py-2.5 rounded-full border border-stone-300 bg-white text-xs font-semibold text-stone-800 hover:bg-stone-50 transition shadow-sm cursor-pointer"
                type="button"
              >
                <svg className="w-3.5 h-3.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
                Back to Order Catalog
              </button>

              {/* Right Action & Total Section */}
              <div className="flex items-center space-x-6">
                <div className="text-right">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Total to Collect
                  </span>
                  <span className="font-serif text-2xl font-bold text-stone-950 tracking-tight leading-tight">
                    ₹{(totalPayablePaise / 100).toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => setCurrentStep(3)}
                  className="inline-flex items-center px-7 py-3 rounded-full bg-stone-950 text-white text-xs font-semibold hover:bg-stone-850 transition shadow-md group cursor-pointer"
                  type="button"
                >
                  <span>Continue to Payment</span>
                  <span className="ml-2 text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded font-mono font-medium">
                    F5
                  </span>
                  <svg
                    className="w-3.5 h-3.5 ml-2 transform group-hover:translate-x-0.5 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          {/* END: BottomStickyBar */}
        </>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: PAYMENT & SETTLEMENT WORKSPACE (PREST POS LUXURY EDITORIAL)       */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <>
          <main className="flex-1 overflow-y-auto w-full px-6 lg:px-8 py-6 sm:py-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT PANEL: Financial Summary & Ticket Recap (lg:col-span-5) */}
              <section className="lg:col-span-5 bg-white border border-[#e7e5e4] rounded-2xl p-6 lg:p-7 shadow-sm transition-all" data-purpose="order-summary-panel">
                {/* Header & Cart Tag */}
                <div className="flex items-center justify-between pb-4 border-b border-[#e7e5e4]">
                  <div className="flex items-center space-x-2.5">
                    <span className="inline-flex items-center gap-1.5 bg-[#0c0a09] text-white text-[11px] font-bold pl-2.5 pr-3 py-1 rounded-full shadow-xs tracking-wide">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span>{activeCart.label}</span>
                    </span>
                    <h2 className="font-serif text-2xl text-[#141010] font-normal">Order Summary</h2>
                  </div>
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="text-xs font-medium text-[#5e5e5e] hover:text-[#141010] underline underline-offset-4 decoration-stone-300 transition cursor-pointer"
                    type="button"
                  >
                    Edit
                  </button>
                </div>

                {/* Guest & Routing Context Card */}
                <div className="mt-4 p-3 bg-[#f1edec]/60 rounded-xl border border-[#eadfd6] flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-600 shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#141010] truncate">
                      {activeCart.customerFirstName
                        ? `${activeCart.customerFirstName} ${activeCart.customerLastName || ""}`.trim()
                        : activeCart.customerName || "Walk-in Guest"}
                      {activeCart.orderType === "DineIn"
                        ? activeCart.isTableRequired !== false
                          ? ` • Table: ${activeCart.tableName || "Assigned"} (${activeCart.guestCount || 1} Pax)`
                          : ` • Dine-In (Direct Counter / No Table)`
                        : activeCart.orderType === "TakeAway"
                        ? ` • Takeaway`
                        : activeCart.orderType === "Delivery"
                        ? ` • Delivery (Porter)`
                        : ` • Scheduled (${activeCart.scheduledDate || "Tomorrow"})`}
                    </p>
                    <p className="text-[11px] text-[#8a7e75] truncate">
                      {activeCart.orderType === "DineIn"
                        ? activeCart.isTableRequired !== false
                          ? `Assigned: ${activeCart.waiterName || "Staff assigned"}`
                          : "Direct-to-Counter • Open Dining"
                        : activeCart.orderType === "TakeAway"
                        ? `Pickup: ${activeCart.pickupLocation || "Main Counter (Front Desk)"}`
                        : activeCart.orderType === "Delivery"
                        ? `Rider: ${activeCart.deliveryRider || "Porter Rider"}`
                        : `Slot: ${activeCart.scheduledTime || "01:30 PM - 02:00 PM"}`}
                    </p>
                  </div>
                </div>

                {/* Itemized Ticket Lines */}
                <div className="mt-5 space-y-3.5" data-purpose="ticket-items-list">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-[#8a7e75]">
                    {activeCart.items.length} Items •{" "}
                    {activeCart.items.reduce((sum, it) => sum + it.quantity, 0)} Portions
                  </div>

                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {activeCart.items.map((item, idx) => (
                      <div key={item.itemId + "_" + idx} className="flex items-start justify-between text-sm pt-1">
                        <div className="flex items-start space-x-2.5">
                          <span
                            className={`inline-flex items-center justify-center w-3.5 h-3.5 mt-0.5 border ${
                              item.isVeg ? "border-emerald-600" : "border-rose-600"
                            } rounded-[3px] p-[2px] shrink-0`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.isVeg ? "bg-emerald-600" : "bg-rose-600"
                              }`}
                            />
                          </span>
                          <div>
                            <p className="font-medium text-[#1c1b1b] leading-tight">{item.name}</p>
                            <p className="text-xs text-[#8a7e75] mt-0.5">
                              Qty: {item.quantity} × ₹{(item.price / 100).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <span className="font-medium text-[#1c1b1b] shrink-0">
                          ₹{((item.price * item.quantity) / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}

                    {activeCart.items.length === 0 && (
                      <p className="text-xs text-stone-400 italic py-4 text-center">Cart is empty</p>
                    )}
                  </div>
                </div>

                {/* Taxes and Subtotal Breakdown */}
                <div className="mt-6 pt-5 border-t border-[#e7e5e4] space-y-2 text-xs">
                  <div className="flex justify-between text-[#5e5e5e]">
                    <span>Subtotal</span>
                    <span className="font-medium text-[#1c1b1b]">
                      {taxCalculation.currencySymbol}{(cartSubtotalPaise / 100).toFixed(2)}
                    </span>
                  </div>

                  {/* Dynamic Multi-Component Split Tax Lines */}
                  {taxCalculation.componentBreakdown.length > 0 ? (
                    taxCalculation.componentBreakdown.map((comp, cIdx) => (
                      <div
                        key={`step3_${comp.name}_${comp.rate}_${cIdx}`}
                        className="flex justify-between text-[#5e5e5e]"
                      >
                        <span className="flex items-center gap-1">
                          {comp.name} ({comp.rate}%)
                          {comp.isInclusive && (
                            <span className="text-[9px] bg-[#f1edec] text-[#5e5e5e] px-1 py-0.2 rounded border border-[#eadfd6] font-normal">
                              Incl.
                            </span>
                          )}
                        </span>
                        <span className="font-medium text-[#1c1b1b]">
                          {taxCalculation.currencySymbol}{(comp.taxAmountPaise / 100).toFixed(2)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="flex justify-between text-[#5e5e5e]">
                      <span>Tax (0% / Exempt)</span>
                      <span className="font-medium text-[#1c1b1b]">{taxCalculation.currencySymbol}0.00</span>
                    </div>
                  )}

                  {activeCart.orderType === "Delivery" && (
                    <div className="flex justify-between text-[#5e5e5e]">
                      <span>Delivery Fee (Zone 1)</span>
                      <span className="font-medium text-[#1c1b1b]">{taxCalculation.currencySymbol}58.00</span>
                    </div>
                  )}
                </div>

                {/* Grand Total Payable Section */}
                <div className="mt-6 pt-5 border-t-2 border-dashed border-stone-200">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="text-[11px] tracking-wider uppercase font-semibold text-[#8a7e75]">Total Payable</p>
                      <p className="text-[11px] text-[#8a7e75]">
                        {taxCalculation.taxExclusivePaise > 0
                          ? "(incl. subtotal & taxes)"
                          : "(incl. all hospitality taxes)"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-serif text-4xl sm:text-5xl font-normal tracking-tight text-[#141010]">
                        {taxCalculation.currencySymbol}{(totalPayablePaise / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Draft Bill Link */}
                <div className="mt-6 pt-4 border-t border-[#e7e5e4] text-center">
                  <button
                    onClick={() => {
                      if (activeCart.items.length === 0) {
                        showToast("Add items to cart before generating pre-bill");
                        return;
                      }
                      openReceiptPdfInNewTab({
                        order: {
                          orderNumber: "DRAFT-KOT",
                          createdAt: Date.now(),
                          totalAmount: (totalPayablePaise / 100).toFixed(2),
                          orderType: activeCart.orderType,
                          customerName: activeCart.customerFirstName || "Walk-in Guest",
                          customerPhone: activeCart.customerPhone,
                        },
                        org: activeOrg,
                      });
                      showToast("Generated Draft KOT / Pre-Bill");
                    }}
                    className="inline-flex items-center text-xs font-medium text-[#5e5e5e] hover:text-[#141010] transition cursor-pointer"
                    type="button"
                  >
                    <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                    Print Draft KOT / Pre-Bill
                  </button>
                </div>
              </section>

              {/* RIGHT PANEL: Settlement Workspace (lg:col-span-7) */}
              <section className="lg:col-span-7 space-y-6" data-purpose="payment-workspace">
                <div className="bg-white border border-[#e7e5e4] rounded-2xl p-6 sm:p-8 shadow-sm">
                  {/* Section Heading */}
                  <div className="mb-6">
                    <h2 className="font-serif text-2xl sm:text-3xl text-[#141010] font-normal">Select Payment Method</h2>
                    <p className="text-xs sm:text-sm text-[#5e5e5e] mt-1">Choose the settlement channel for this ticket</p>
                  </div>

                  {/* Payment Channel Filter / Mode Pills */}
                  <div aria-label="Payment Channels" className="flex flex-wrap gap-2.5 pb-6 border-b border-[#e7e5e4]" role="tablist">
                    {/* Cash */}
                    <button
                      onClick={() => {
                        setSelectedPaymentMode("Cash");
                        if (!tenderCashGiven) {
                          setTenderCashGiven((totalPayablePaise / 100).toFixed(2));
                        }
                      }}
                      className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-medium transition cursor-pointer ${
                        selectedPaymentMode === "Cash"
                          ? "bg-[#0c0a09] text-white shadow-sm ring-1 ring-[#0c0a09]"
                          : "bg-white text-[#5e5e5e] hover:text-[#141010] border border-[#e7e5e4] hover:border-stone-400"
                      }`}
                      role="tab"
                      type="button"
                    >
                      <svg className={`w-4 h-4 ${selectedPaymentMode === "Cash" ? "text-white" : "text-stone-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                      <span>Cash</span>
                    </button>

                    {/* Credit Card */}
                    <button
                      onClick={() => setSelectedPaymentMode("Credit Card")}
                      className={`inline-flex items-center space-x-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-medium border transition cursor-pointer ${
                        selectedPaymentMode === "Credit Card"
                          ? "bg-[#0c0a09] text-white shadow-sm ring-1 ring-[#0c0a09] border-[#0c0a09]"
                          : "bg-white text-[#5e5e5e] hover:text-[#141010] border-[#e7e5e4] hover:border-stone-400"
                      }`}
                      role="tab"
                      type="button"
                    >
                      <svg className={`w-4 h-4 ${selectedPaymentMode === "Credit Card" ? "text-white" : "text-stone-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                      <span>Credit Card</span>
                    </button>

                    {/* Debit Card */}
                    <button
                      onClick={() => setSelectedPaymentMode("Debit Card")}
                      className={`inline-flex items-center space-x-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-medium border transition cursor-pointer ${
                        selectedPaymentMode === "Debit Card"
                          ? "bg-[#0c0a09] text-white shadow-sm ring-1 ring-[#0c0a09] border-[#0c0a09]"
                          : "bg-white text-[#5e5e5e] hover:text-[#141010] border-[#e7e5e4] hover:border-stone-400"
                      }`}
                      role="tab"
                      type="button"
                    >
                      <svg className={`w-4 h-4 ${selectedPaymentMode === "Debit Card" ? "text-white" : "text-stone-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                      <span>Debit Card</span>
                    </button>

                    {/* UPI QR */}
                    <button
                      onClick={() => setSelectedPaymentMode("UPI QR")}
                      className={`inline-flex items-center space-x-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-medium border transition cursor-pointer ${
                        selectedPaymentMode === "UPI QR"
                          ? "bg-[#0c0a09] text-white shadow-sm ring-1 ring-[#0c0a09] border-[#0c0a09]"
                          : "bg-white text-[#5e5e5e] hover:text-[#141010] border-[#e7e5e4] hover:border-stone-400"
                      }`}
                      role="tab"
                      type="button"
                    >
                      <svg className={`w-4 h-4 ${selectedPaymentMode === "UPI QR" ? "text-white" : "text-stone-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                      <span>UPI QR</span>
                    </button>

                    {/* Split Payment */}
                    <button
                      onClick={() => setSelectedPaymentMode("Split Payment")}
                      className={`inline-flex items-center space-x-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-medium border transition cursor-pointer ${
                        selectedPaymentMode === "Split Payment"
                          ? "bg-[#0c0a09] text-white shadow-sm ring-1 ring-[#0c0a09] border-[#0c0a09]"
                          : "bg-white text-[#5e5e5e] hover:text-[#141010] border-[#e7e5e4] hover:border-stone-400"
                      }`}
                      role="tab"
                      type="button"
                    >
                      <svg className={`w-4 h-4 ${selectedPaymentMode === "Split Payment" ? "text-white" : "text-stone-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                      <span>Split Payment</span>
                    </button>
                  </div>

                  {/* TAB 1: CASH SETTLEMENT FLOW */}
                  {selectedPaymentMode === "Cash" && (
                    <div className="mt-6 space-y-6" data-purpose="cash-settlement-flow">
                      {/* Target Payable Display Card */}
                      <div className="p-4 bg-[#f1edec]/50 rounded-xl border border-stone-200/80 flex items-center justify-between">
                        <div>
                          <span className="text-xs text-[#5e5e5e] font-medium block">Total Payable Net Amount</span>
                          <span className="text-xs text-[#8a7e75]">Ticket reference: #CK-8942-02</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-bold text-[#141010]">
                            ₹{(totalPayablePaise / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Cash Tender Input Field */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#5e5e5e] mb-2" htmlFor="cash-tendered-input">
                          Cash Tendered / Received *
                        </label>
                        <div className="relative rounded-xl shadow-xs">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="text-[#5e5e5e] font-medium text-lg">₹</span>
                          </div>
                          <input
                            id="cash-tendered-input"
                            name="cash-tendered"
                            type="text"
                            placeholder={(totalPayablePaise / 100).toFixed(2)}
                            value={tenderCashGiven}
                            onChange={(e) => setTenderCashGiven(e.target.value)}
                            className="block w-full pl-9 pr-4 py-3.5 bg-white border border-stone-300 rounded-xl text-xl font-semibold text-[#141010] focus:ring-2 focus:ring-[#0c0a09] focus:border-[#0c0a09] transition focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Quick Cash Buttons (Fast Tender Shortcuts) */}
                      <div>
                        <span className="text-xs font-medium text-[#8a7e75] block mb-2.5">Fast Tender Shortcuts</span>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                          {/* Exact Button */}
                          <button
                            type="button"
                            onClick={() => setTenderCashGiven((totalPayablePaise / 100).toFixed(2))}
                            className={`px-3 py-2.5 rounded-lg border text-xs transition text-center shadow-xs cursor-pointer ${
                              parseFloat(tenderCashGiven || "0") === totalPayablePaise / 100
                                ? "border-2 border-[#0c0a09] bg-[#0c0a09] text-white font-semibold"
                                : "border-[#e7e5e4] bg-[#fdf8f7] hover:bg-stone-100 font-medium text-[#141010]"
                            }`}
                          >
                            Exact ₹{(totalPayablePaise / 100).toFixed(2)}
                          </button>

                          {/* Dynamic Fast Denominations */}
                          {(() => {
                            const exactVal = totalPayablePaise / 100;
                            const d1 = Math.ceil(exactVal / 100) * 100;
                            const d2 = Math.ceil(exactVal / 500) * 500;
                            const d3 = Math.ceil((exactVal + 500) / 500) * 500;
                            const d4 = Math.ceil((exactVal + 1000) / 1000) * 1000;

                            const uniqueShortcuts = Array.from(
                              new Set([
                                d1 > exactVal ? d1 : d1 + 100,
                                d2 > exactVal ? d2 : d2 + 500,
                                d3,
                                d4 > d3 ? d4 : d3 + 1000,
                              ])
                            ).slice(0, 4);

                            return uniqueShortcuts.map((amt) => {
                              const isSelected = parseFloat(tenderCashGiven || "0") === amt;
                              return (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() => setTenderCashGiven(amt.toFixed(2))}
                                  className={`px-3 py-2.5 rounded-lg border text-xs transition text-center shadow-xs cursor-pointer ${
                                    isSelected
                                      ? "border-2 border-[#0c0a09] bg-[#0c0a09] text-white font-semibold"
                                      : "border-[#e7e5e4] bg-[#fdf8f7] hover:bg-stone-100 font-medium text-[#141010]"
                                  }`}
                                >
                                  ₹{amt.toLocaleString("en-IN")}
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* Return / Change Due Callout Box */}
                      {(() => {
                        const billVal = totalPayablePaise / 100;
                        const givenVal = parseFloat(tenderCashGiven || billVal.toString());
                        const changeVal = givenVal - billVal;

                        if (changeVal >= 0) {
                          return (
                            <div className="p-5 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="space-y-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                                  Change / Return Due
                                </span>
                                <p className="text-xs text-emerald-700 flex items-center space-x-1.5">
                                  <svg className="w-4 h-4 text-emerald-600 inline shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" fillRule="evenodd" />
                                  </svg>
                                  <span>Tender satisfied &amp; ready to print receipt</span>
                                </p>
                              </div>
                              <div className="text-left sm:text-right">
                                <span className="font-serif text-3xl sm:text-4xl font-semibold text-emerald-800 tracking-tight">
                                  ₹{changeVal.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          );
                        } else {
                          return (
                            <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="space-y-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                                  Short Tender / Remaining Balance
                                </span>
                                <p className="text-xs text-amber-800">
                                  Additional cash required to settle this ticket
                                </p>
                              </div>
                              <div className="text-left sm:text-right">
                                <span className="font-serif text-3xl sm:text-4xl font-semibold text-amber-900 tracking-tight">
                                  ₹{Math.abs(changeVal).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          );
                        }
                      })()}

                      {/* Receipt & Communication Options */}
                      <div className="pt-4 border-t border-[#e7e5e4] space-y-3">
                        <label className="flex items-center space-x-3 cursor-pointer select-none">
                          <input
                            defaultChecked
                            className="w-4 h-4 rounded text-[#0c0a09] border-stone-300 focus:ring-[#0c0a09] cursor-pointer"
                            type="checkbox"
                          />
                          <span className="text-xs sm:text-sm text-[#1c1b1b]">
                            Print thermal customer tax invoice receipt
                          </span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer select-none">
                          <input
                            defaultChecked
                            className="w-4 h-4 rounded text-[#0c0a09] border-stone-300 focus:ring-[#0c0a09] cursor-pointer"
                            type="checkbox"
                          />
                          <span className="text-xs sm:text-sm text-[#1c1b1b]">
                            Send digital WhatsApp / SMS invoice to{" "}
                            <strong className="font-semibold text-[#141010]">
                              {activeCart.customerPhone || "+91 98250 14820"}
                            </strong>
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* TAB 2 & 3: CARD SETTLEMENT (Credit / Debit) */}
                  {(selectedPaymentMode === "Credit Card" || selectedPaymentMode === "Debit Card") && (
                    <div className="mt-6 space-y-6">
                      <div className="p-5 bg-stone-50 border border-stone-200 rounded-xl space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                            POS Terminal Reader / EDC Swipe
                          </span>
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Pinelabs / PayTM Terminal Connected
                          </span>
                        </div>
                        <div className="p-4 bg-white rounded-xl border border-stone-200 flex items-center justify-between">
                          <div>
                            <span className="text-xs text-stone-500 block">Total Amount to Charge Card</span>
                            <span className="font-serif text-3xl font-bold text-stone-900">
                              ₹{(totalPayablePaise / 100).toFixed(2)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => showToast("EDC Terminal triggered: Tap or Insert card")}
                            className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-semibold hover:bg-black transition cursor-pointer"
                          >
                            Push to Terminal (Swipe)
                          </button>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
                            Optional Auth / Transaction Ref Code (RRN)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. TXN-89324810"
                            className="w-full bg-white border border-stone-300 rounded-lg px-3.5 py-2.5 text-xs text-stone-900 font-medium focus:ring-1 focus:ring-stone-900 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: UPI QR SETTLEMENT */}
                  {selectedPaymentMode === "UPI QR" && (
                    <div className="mt-6 space-y-6">
                      <div className="p-6 bg-stone-50 border border-stone-200 rounded-xl flex flex-col sm:flex-row items-center gap-6">
                        {/* Dynamic Mock QR Code */}
                        <div className="w-40 h-40 bg-white p-2.5 rounded-xl border-2 border-stone-900 flex flex-col items-center justify-center shrink-0 shadow-sm">
                          <svg className="w-32 h-32 text-stone-900" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm14 0h4v2h-4v-2zm-4 0h2v4h-2v-4zm4 4h4v2h-4v-2zm-2-2h2v2h-2v-2zm-6-2h2v2h-2v-2zm2 4h2v2h-2v-2z" />
                          </svg>
                          <span className="text-[10px] font-bold tracking-widest uppercase text-stone-700 mt-1">BHIM UPI</span>
                        </div>
                        <div className="flex-1 space-y-3 text-center sm:text-left">
                          <div>
                            <span className="text-xs text-stone-500 block">Scan with any UPI App</span>
                            <span className="font-serif text-3xl font-bold text-stone-900">
                              ₹{(totalPayablePaise / 100).toFixed(2)}
                            </span>
                          </div>
                          <p className="text-xs text-stone-600">
                            UPI ID: <strong className="font-mono text-stone-900">prestpos.9825014820@icici</strong>
                          </p>
                          <div className="flex items-center gap-2 text-xs text-stone-500 justify-center sm:justify-start">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Listening for live webhook callback (300s window)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => showToast("Simulated UPI payment verified successfully!")}
                            className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 transition cursor-pointer"
                          >
                            Fetch QR Payment Status
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: SPLIT PAYMENT SETTLEMENT */}
                  {selectedPaymentMode === "Split Payment" && (
                    <div className="mt-6 space-y-4">
                      <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-stone-700 block">
                          Split Tender Allocation
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="p-3 bg-white rounded-lg border border-stone-200 flex justify-between items-center">
                            <span>Part 1: Cash</span>
                            <span className="font-semibold text-stone-900">
                              ₹{(totalPayablePaise / 200).toFixed(2)}
                            </span>
                          </div>
                          <div className="p-3 bg-white rounded-lg border border-stone-200 flex justify-between items-center">
                            <span>Part 2: UPI / Card</span>
                            <span className="font-semibold text-stone-900">
                              ₹{(totalPayablePaise / 200).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-stone-500 text-center">
                          Total split matches payable sum (₹{(totalPayablePaise / 100).toFixed(2)})
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </main>

          {/* BEGIN: BottomActionFooter */}
          <footer className="bg-white border-t border-[#e7e5e4] sticky bottom-0 z-30 px-6 py-4 transition-all" data-purpose="checkout-navigation-footer">
            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Back Link */}
              <button
                onClick={() => setCurrentStep(2)}
                className="inline-flex items-center px-4 py-2.5 rounded-full border border-[#e7e5e4] hover:bg-stone-50 text-xs sm:text-sm font-medium text-[#141010] transition cursor-pointer"
                type="button"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
                Back to Order Details
              </button>

              {/* Settlement Status and Final CTA */}
              <div className="flex items-center space-x-5 w-full sm:w-auto justify-between sm:justify-end">
                <div className="text-right">
                  <span className="text-[11px] text-[#8a7e75] uppercase tracking-wider block">Total Received</span>
                  <span className="text-base font-semibold text-[#141010]">
                    ₹{tenderCashGiven ? parseFloat(tenderCashGiven).toFixed(2) : (totalPayablePaise / 100).toFixed(2)}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isProcessingOrder}
                  onClick={handleCompleteOrder}
                  className="inline-flex items-center justify-center space-x-2.5 px-7 py-3 rounded-full bg-[#0c0a09] hover:bg-stone-800 text-white text-sm font-semibold shadow-md transition transform active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  {isProcessingOrder ? (
                    <span>Settle &amp; Processing...</span>
                  ) : (
                    <>
                      <span>Settle &amp; Complete Payment</span>
                      <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded font-mono font-medium">
                        F5
                      </span>
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </footer>
          {/* END: BottomActionFooter */}
        </>
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
              <h3 className="text-xl font-bold font-serif text-[#141010]">Order Settled &amp; Confirmed!</h3>
              <p className="text-xs text-[#7a716b] mt-1">
                {completedOrderData.orderNumber} • Token {completedOrderData.tokenNumber}
              </p>
            </div>

            <div className="p-4 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[#7a716b]">Total Paid:</span>
                <span className="font-bold text-[#141010]">₹{completedOrderData.totalAmount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7a716b]">Payment Mode:</span>
                <span className="font-semibold text-[#141010]">{completedOrderData.paymentMode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7a716b]">Invoice / Token:</span>
                <span className="font-mono text-emerald-700 font-bold">{completedOrderData.tokenNumber}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  openReceiptPdfInNewTab({
                    order: completedOrderData,
                    org: activeOrg,
                  });
                }}
                className="flex-1 py-2.5 bg-[#f1edec] hover:bg-[#e7e5e4] text-[#141010] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Download PDF Invoice
              </button>

              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-[#141010] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Thermal Print
              </button>

              <button
                type="button"
                onClick={() => setCompletedOrderData(null)}
                className="flex-1 py-2.5 bg-[#0c0a09] hover:bg-stone-900 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                New Order (F5)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

