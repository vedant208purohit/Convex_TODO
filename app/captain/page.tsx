"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface CartLineItem {
  itemId: Id<"items">;
  name: string;
  price: number; // in paise
  quantity: number;
  isToGo?: boolean;
  isVeg?: boolean;
}

const COUNTRY_DIAL_OPTIONS = [
  { code: "+91", label: "IN +91", country: "India", iso: "IN" },
  { code: "+1", label: "US/CA +1", country: "United States / Canada", iso: "US" },
  { code: "+44", label: "UK +44", country: "United Kingdom", iso: "GB" },
  { code: "+971", label: "UAE +971", country: "United Arab Emirates", iso: "AE" },
  { code: "+61", label: "AU +61", country: "Australia", iso: "AU" },
  { code: "+65", label: "SG +65", country: "Singapore", iso: "SG" },
  { code: "+49", label: "DE +49", country: "Germany", iso: "DE" },
  { code: "+33", label: "FR +33", country: "France", iso: "FR" },
  { code: "+81", label: "JP +81", country: "Japan", iso: "JP" },
  { code: "+966", label: "SA +966", country: "Saudi Arabia", iso: "SA" },
  { code: "+974", label: "QA +974", country: "Qatar", iso: "QA" },
];

function formatPhoneNumberWithCountryCode(rawPhone: string, defaultCode: string = "+91"): string {
  if (!rawPhone || !rawPhone.trim()) return "";
  const trimmed = rawPhone.trim();

  // If already starts with '+', ensure clean spacing between dial code and number
  if (trimmed.startsWith("+")) {
    const digitsOnly = trimmed.replace(/\D/g, "");
    for (const opt of COUNTRY_DIAL_OPTIONS) {
      const codeDigits = opt.code.replace(/\D/g, "");
      if (digitsOnly.startsWith(codeDigits)) {
        const local = digitsOnly.slice(codeDigits.length);
        return `${opt.code} ${local}`;
      }
    }
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;

  const currentCode = defaultCode.startsWith("+") ? defaultCode : `+${defaultCode}`;
  return `${currentCode} ${digits}`;
}

function getLayoutSignIcon(name?: string) {
  const n = (name || "").toLowerCase();
  if (n.includes("outdoor") || n.includes("garden") || n.includes("patio") || n.includes("terrace") || n.includes("balcony")) {
    return (
      <svg className="w-3.5 h-3.5 mr-1.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    );
  }
  if (n.includes("bar") || n.includes("lounge") || n.includes("pub") || n.includes("drink")) {
    return (
      <svg className="w-3.5 h-3.5 mr-1.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 21h8m-4-7v7m-7-14l7 7 7-7H5z" />
      </svg>
    );
  }
  if (n.includes("vip") || n.includes("private") || n.includes("banquet") || n.includes("hall")) {
    return (
      <svg className="w-3.5 h-3.5 mr-1.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 16l-3-9 6 3 4-6 4 6 6-3-3 9H5z" />
      </svg>
    );
  }
  // Default / Indoor / DineIn
  return (
    <svg className="w-3.5 h-3.5 mr-1.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function renderTableAmenityBadge(table: any) {
  if (table.kidsSeatAvailability) {
    return (
      <span className="flex items-center gap-1" title="Kids Seat Available">
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="7" r="4" />
          <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        </svg>
        <span>{table.seatingCapacity}</span>
      </span>
    );
  }
  if (table.disabledSeatAvailability) {
    return (
      <span className="flex items-center gap-1" title="Disabled Seat Available">
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="4" r="2" />
          <path d="M18 19l-4-4h-3a2 2 0 0 1-2-2V7h4v4h3" />
          <path d="M7 13a5 5 0 1 0 5 5" />
        </svg>
        <span>{table.seatingCapacity}</span>
      </span>
    );
  }
  if (table.barbequeGrillAvailability) {
    return (
      <span className="flex items-center gap-1" title="Barbeque Grill Available">
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
        <span>{table.seatingCapacity}</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1" title={`Capacity: ${table.seatingCapacity}`}>
      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5m-4 0h4" />
      </svg>
      <span>{table.seatingCapacity}</span>
    </span>
  );
}

function getDisplayTableTitle(tableNumber: string) {
  const clean = (tableNumber || "").trim();
  if (clean.toLowerCase().startsWith("table")) {
    return clean;
  }
  return `Table ${clean}`;
}

export default function CaptainPage() {
  // ----------------------------------------------------
  // CONVEX LIVE DATA HOOKS
  // ----------------------------------------------------
  const orgs = useQuery(api.organizations.list);
  const activeOrg = orgs && orgs.length > 0 ? orgs[0] : null;
  const orgId = activeOrg?._id;

  const defaultOrgCountryCode = useMemo(() => {
    if (!activeOrg) return "+91";
    const country = (activeOrg.country || "").toUpperCase();
    if (country === "US" || country === "USA" || country === "UNITED STATES") return "+1";
    if (country === "UK" || country === "GB" || country === "UNITED KINGDOM") return "+44";
    if (country === "AE" || country === "UAE" || country === "UNITED ARAB EMIRATES") return "+971";
    if (country === "AU" || country === "AUSTRALIA") return "+61";
    if (country === "SG" || country === "SINGAPORE") return "+65";
    if (country === "CA" || country === "CANADA") return "+1";
    return "+91";
  }, [activeOrg]);

  const layouts = useQuery(api.organizationLayouts.list);
  const [selectedLayoutId, setSelectedLayoutId] = useState<Id<"organizationLayouts"> | undefined>(undefined);

  useEffect(() => {
    if (layouts && layouts.length > 0 && !selectedLayoutId) {
      setSelectedLayoutId(layouts[0]._id);
    }
  }, [layouts, selectedLayoutId]);

  const captainTables = useQuery(
    api.organizationTables.listCaptainTables,
    selectedLayoutId ? { layoutId: selectedLayoutId } : {}
  );

  // Fetch employees from store organizationUsers
  const employees = useQuery(
    api.organizationUsers.list,
    orgId ? { organizationId: orgId } : {}
  );

  // Filter employees whose role/userType is 'waiter' (or fallback to staff)
  const waiterEmployees = useMemo(() => {
    if (!employees || !Array.isArray(employees)) return [];

    const specificWaiters = employees.filter((emp: any) =>
      Array.isArray(emp.userType) &&
      emp.userType.some((role: string) => role.toLowerCase() === "waiter")
    );

    if (specificWaiters.length > 0) {
      return specificWaiters.map((emp) => ({
        id: emp._id,
        name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.phone || emp.email || "Waiter",
        phone: emp.phone,
        role: "Waiter",
      }));
    }

    // Fallback if no specific waiter tag found: list active employees
    return employees.map((emp) => ({
      id: emp._id,
      name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.phone || emp.email || "Staff",
      phone: emp.phone,
      role: emp.userType?.[0] || "Employee",
    }));
  }, [employees]);

  // Use the rich store menu query
  const storeMenu = useQuery(
    api.menu.getOrganizationMenu,
    orgId ? { organizationId: orgId, allMenus: true } : "skip"
  );

  // Mutations
  const createOrderMutation = useMutation(api.orders.createOrder);
  const addItemsMutation = useMutation(api.orders.addItemsToExistingOrder);
  const toggleBlockMutation = useMutation(api.organizationTables.toggleTableBlock);
  const clearOrderMutation = useMutation(api.organizationTables.clearOrder);
  const completeOrderMutation = useMutation(api.orders.completeOrder);
  const moveTableMutation = useMutation(api.orders.moveOrderTable);

  // ----------------------------------------------------
  // UI STATES
  // ----------------------------------------------------
  const [systemTime, setSystemTime] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Selected Table & Drawer State
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [drawerSubTab, setDrawerSubTab] = useState<"user" | "menu" | "tab" | "payment">("user");
  const [isTableMenuOpen, setIsTableMenuOpen] = useState<boolean>(false);
  const [isMoveTableModalOpen, setIsMoveTableModalOpen] = useState<boolean>(false);
  const [moveTargetTableId, setMoveTargetTableId] = useState<string>("");

  // Customer Form State
  const [customerCountryCode, setCustomerCountryCode] = useState<string>("+91");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerCount, setCustomerCount] = useState<number>(2);
  const [selectedWaiter, setSelectedWaiter] = useState<{ id?: string; name: string }>({
    id: undefined,
    name: "",
  });

  // Sync initial country code from store organization
  useEffect(() => {
    if (defaultOrgCountryCode) {
      setCustomerCountryCode(defaultOrgCountryCode);
    }
  }, [defaultOrgCountryCode]);

  // Automatically select the first waiter from the store's employee list if available
  useEffect(() => {
    if (waiterEmployees.length > 0 && !selectedWaiter.id) {
      const first = waiterEmployees[0];
      setSelectedWaiter({
        id: first.id,
        name: first.name,
      });
    }
  }, [waiterEmployees, selectedWaiter.id]);

  // Menu Search & Filter State
  const [selectedCategory, setSelectedCategory] = useState<string>("All Items");
  const [menuSearch, setMenuSearch] = useState<string>("");

  // Running Cart (KOT #2 items before dispatching)
  const [runningCart, setRunningCart] = useState<CartLineItem[]>([]);
  const [isPlacingCart, setIsPlacingCart] = useState<boolean>(false);

  // Payment Calculation State
  const [paymentMode, setPaymentMode] = useState<"cash" | "cc" | "dc" | "upi">("cash");
  const [cashTendered, setCashTendered] = useState<number>(5000);

  // Real-time Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setSystemTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  // Extract Flat Menu Items for Search & Catalog matching Cashier logic
  const allCatalogItems = useMemo(() => {
    if (!storeMenu || !Array.isArray(storeMenu)) return [];
    const itemsList: Array<{
      categoryName: string;
      categoryId: string;
      item: any;
      itemImageUrl?: string;
      customizations?: any[];
    }> = [];

    for (const catEntry of storeMenu) {
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

          // Exclude unpublished and unavailable items matching defx-pos / cashier behavior
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
  }, [storeMenu]);

  // Categories List matching Cashier
  const categoryNames = useMemo(() => {
    const list = ["All Items"];
    if (storeMenu && Array.isArray(storeMenu)) {
      for (const catEntry of storeMenu) {
        const catObj = catEntry?.category || catEntry;
        if (catObj?.name && !list.includes(catObj.name)) {
          list.push(catObj.name);
        }
      }
    }
    return list;
  }, [storeMenu]);

  // Filtered Catalog Items based on Category & Search
  const filteredCatalogItems = useMemo(() => {
    return allCatalogItems.filter((entry) => {
      const matchCat =
        selectedCategory === "All Items" ||
        selectedCategory === "All" ||
        entry.categoryName === selectedCategory;
      if (!matchCat) return false;

      if (!menuSearch.trim()) return true;
      const q = menuSearch.toLowerCase().trim();
      const itemName = entry.item.name?.toLowerCase() || "";
      const skuNumber = entry.item.skuNumber?.toLowerCase() || "";
      return itemName.includes(q) || skuNumber.includes(q);
    });
  }, [allCatalogItems, selectedCategory, menuSearch]);

  // Dietary Mark helper (Green = Veg, Red = Non-Veg)
  const renderDietaryMark = (item: any) => {
    const isVeg = item.isVeg ?? item.is_veg ?? true;
    return (
      <span
        className={`w-3.5 h-3.5 border ${
          isVeg ? "border-emerald-600 text-emerald-600" : "border-rose-600 text-rose-600"
        } flex items-center justify-center p-0.5 rounded-xs shrink-0`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            isVeg ? "bg-emerald-600" : "bg-rose-600"
          }`}
        />
      </span>
    );
  };

  // Current active order on selected table
  const activeOrder = selectedTable?.currentOrder;

  // Calculate Running Cart Total
  const runningCartTotalPaise = useMemo(() => {
    return runningCart.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
  }, [runningCart]);

  // Total Payable calculation
  const totalPayableAmount = useMemo(() => {
    if (activeOrder) {
      return (activeOrder.totalAmount || 0) / 100;
    }
    return runningCartTotalPaise / 100;
  }, [activeOrder, runningCartTotalPaise]);

  // Cash change return calculation
  const cashChangeReturn = useMemo(() => {
    const ret = cashTendered - totalPayableAmount;
    return ret > 0 ? ret : 0;
  }, [cashTendered, totalPayableAmount]);

  // Keep selected table updated with live Convex query data
  useEffect(() => {
    if (selectedTable && captainTables) {
      const updated = captainTables.find((t) => t._id === selectedTable._id);
      if (updated) {
        setSelectedTable(updated);
      }
    }
  }, [captainTables, selectedTable?._id]);

  // ----------------------------------------------------
  // HANDLERS & MUTATIONS
  // ----------------------------------------------------
  const handleOpenTable = (table: any) => {
    setSelectedTable(table);
    setIsDrawerOpen(true);
    setIsTableMenuOpen(false);

    if (table.currentOrder) {
      setDrawerSubTab("tab");
      if (table.currentOrder.waiter) {
        setSelectedWaiter({
          id: table.currentOrder.waiter.id,
          name: `${table.currentOrder.waiter.waiterCode ? `${table.currentOrder.waiter.waiterCode} | ` : ""}${table.currentOrder.waiter.firstName} ${table.currentOrder.waiter.lastName || ""}`.trim(),
        });
      }
      if (table.currentOrder.customerPhone) {
        const raw = table.currentOrder.customerPhone.trim();
        let matchedCode = defaultOrgCountryCode;
        let localDigits = raw;
        for (const opt of COUNTRY_DIAL_OPTIONS) {
          if (raw.startsWith(opt.code)) {
            matchedCode = opt.code;
            localDigits = raw.slice(opt.code.length).trim();
            break;
          }
        }
        setCustomerCountryCode(matchedCode);
        setCustomerPhone(localDigits);
      } else {
        setCustomerPhone("");
        setCustomerCountryCode(defaultOrgCountryCode);
      }
      if (table.currentOrder.membersOnTable) {
        setCustomerCount(table.currentOrder.membersOnTable);
      }
    } else {
      setDrawerSubTab("user");
      setRunningCart([]);
      setCustomerPhone("");
      setCustomerCountryCode(defaultOrgCountryCode);
    }
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setIsTableMenuOpen(false);
  };

  const handleToggleBlockTable = async () => {
    if (!selectedTable) return;
    try {
      await toggleBlockMutation({
        id: selectedTable._id,
      });
      showToast(
        selectedTable.isBlock
          ? `Table #${selectedTable.tableNumber} unblocked`
          : `Table #${selectedTable.tableNumber} blocked`
      );
      setIsTableMenuOpen(false);
    } catch (err: any) {
      showToast(err.message || "Failed to toggle table block");
    }
  };

  const handleClearTable = async () => {
    if (!selectedTable) return;
    try {
      await clearOrderMutation({
        id: selectedTable._id,
      });
      showToast(`Table #${selectedTable.tableNumber} cleared & freed`);
      setIsTableMenuOpen(false);
      setIsDrawerOpen(false);
    } catch (err: any) {
      showToast(err.message || "Failed to clear table");
    }
  };

  const handleSaveCustomerInfo = () => {
    if (!customerPhone.trim()) {
      showToast("Please enter customer phone number");
      return;
    }
    setDrawerSubTab("menu");
  };

  const handleAddMenuItemToCart = (item: any, qty: number = 1) => {
    const itemId = item._id || item.id;
    setRunningCart((prev) => {
      const idx = prev.findIndex((i) => i.itemId === itemId);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          quantity: next[idx].quantity + qty,
        };
        return next;
      }
      return [
        ...prev,
        {
          itemId,
          name: item.name,
          price: item.price || 0,
          quantity: qty,
          isVeg: item.isVeg ?? item.is_veg ?? true,
        },
      ];
    });
    showToast(`Added ${item.name} to Cart`);
  };

  const handleUpdateRunningItemQuantity = (
    itemId: string,
    newQty: number,
    itemFallback?: any
  ) => {
    setRunningCart((prev) => {
      if (newQty <= 0) {
        return prev.filter((ci) => (ci.itemId as unknown as string) !== itemId);
      }
      const idx = prev.findIndex((ci) => (ci.itemId as unknown as string) === itemId);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: newQty };
        return next;
      }
      if (itemFallback) {
        return [
          ...prev,
          {
            itemId: itemId as Id<"items">,
            name: itemFallback.name,
            price: itemFallback.price || 0,
            quantity: newQty,
            isVeg: itemFallback.isVeg ?? itemFallback.is_veg ?? true,
          },
        ];
      }
      return prev;
    });
  };

  const handleUpdateRunningItemCount = (index: number, delta: number) => {
    setRunningCart((prev) => {
      const next = [...prev];
      const newQty = next[index].quantity + delta;
      if (newQty <= 0) {
        return next.filter((_, i) => i !== index);
      }
      next[index] = { ...next[index], quantity: newQty };
      return next;
    });
  };

  const handlePlaceOrder = async () => {
    if (!selectedTable) return;
    if (runningCart.length === 0) {
      showToast("No items in running cart to place");
      return;
    }

    setIsPlacingCart(true);
    try {
      if (activeOrder) {
        // Appending KOT #2 / #3 to existing active order
        const itemsPayload = runningCart.map((i) => ({
          itemId: i.itemId,
          quantity: i.quantity,
        }));

        await addItemsMutation({
          orderId: activeOrder._id,
          items: itemsPayload,
        });

        showToast("✅ KOT #2 Sent to Kitchen Printer");
      } else {
        if (!orgId) {
          showToast("Organization not loaded");
          setIsPlacingCart(false);
          return;
        }

        const itemsPayload = runningCart.map((i) => ({
          itemId: i.itemId,
          quantity: i.quantity,
        }));

        const resolvedPhone = customerPhone.trim()
          ? formatPhoneNumberWithCountryCode(customerPhone, customerCountryCode)
          : undefined;

        await createOrderMutation({
          organizationId: orgId,
          orderType: "DineIn",
          orderSource: "Prest-Captain",
          tableId: selectedTable._id,
          waiterUserId: selectedWaiter.id,
          customerPhone: resolvedPhone,
          membersOnTable: customerCount,
          paymentMode: "Pending",
          paymentStatus: "Pending",
          items: itemsPayload,
        });

        showToast("✅ Order Created & KOT #1 Dispatched");
      }

      setRunningCart([]);
      setDrawerSubTab("tab");
    } catch (err: any) {
      showToast(err.message || "Failed to dispatch KOT");
    } finally {
      setIsPlacingCart(false);
    }
  };

  const handleMoveTable = async () => {
    if (!activeOrder || !moveTargetTableId) {
      showToast("Please select a target table");
      return;
    }
    try {
      await moveTableMutation({
        orderId: activeOrder._id,
        newTableId: moveTargetTableId as Id<"organizationTables">,
      });
      showToast(`Order successfully moved to new table`);
      setIsMoveTableModalOpen(false);
      setIsDrawerOpen(false);
    } catch (err: any) {
      showToast(err.message || "Failed to move table");
    }
  };

  const handleCompletePayment = async () => {
    if (!activeOrder) {
      showToast("No active order to settle");
      return;
    }
    try {
      await completeOrderMutation({
        orderId: activeOrder._id,
        transactionReference: `CAPTAIN-${Date.now().toString().slice(-6)}`,
      });
      showToast("✅ Payment Received & Table Settled");
      setTimeout(() => {
        setIsDrawerOpen(false);
      }, 800);
    } catch (err: any) {
      showToast(err.message || "Payment completion failed");
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#fdf8f7] text-[#141010] font-sans select-none">
      {/* Main Floor Container */}
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 flex flex-col min-w-0 bg-[#fdf8f7] border-r border-[#e7e5e4] overflow-hidden">
          {/* Top Bar with Layout Stats & Live Sync Indicator */}
          <div className="h-14 px-6 border-b border-[#e7e5e4] bg-white flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3.5">
              <Link
                href="/dashboard"
                className="text-[#5e5e5e] hover:text-[#0c0a09] p-1.5 transition rounded-lg hover:bg-[#f1edec]"
                title="Go to dashboard"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </Link>
              <div className="flex items-center space-x-2.5">
                <h1 className="font-garamond text-[26px] md:text-[30px] text-[#0c0a09] font-normal leading-tight">
                  Captain POS
                </h1>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse shadow-sm" title="Live Synced" />
              </div>
            </div>

            {/* Status Counts Pill Filters & Clock/Waiter */}
            <div className="flex items-center space-x-4">
              <div className="hidden lg:flex items-center space-x-2 text-xs font-sans">
                <span className="px-3 py-1 rounded-full bg-white border border-[#e7e5e4] font-semibold text-[#141010] shadow-2xs">
                  All ({captainTables?.length || 0})
                </span>
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-semibold shadow-2xs">
                  Available ({captainTables?.filter((t) => !t.currentOrder && !t.isBlock && !t.postpaidOrderRequest).length || 0})
                </span>
                <span className="px-3 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200/80 font-semibold shadow-2xs">
                  Occupied ({captainTables?.filter((t) => t.currentOrder).length || 0})
                </span>
                <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200/80 font-semibold shadow-2xs">
                  QR Request ({captainTables?.filter((t) => t.postpaidOrderRequest).length || 0})
                </span>
                <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200/80 font-semibold shadow-2xs">
                  Blocked ({captainTables?.filter((t) => t.isBlock).length || 0})
                </span>
              </div>

              <div className="flex items-center space-x-2 text-xs font-sans pl-3 border-l border-[#e7e5e4]">
                <span className="font-mono text-[#0c0a09] font-semibold">{systemTime || "04:21 PM"}</span>
                {selectedWaiter.name && (
                  <span className="hidden sm:inline bg-[#f1edec] border border-[#e7e5e4] px-2.5 py-0.5 rounded-md text-[11px] text-[#141010] font-medium">
                    {selectedWaiter.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section Tabs (Layouts) */}
          <div className="h-12 px-6 border-b border-[#e7e5e4] bg-white flex items-center space-x-2 shrink-0 overflow-x-auto text-sm">
            {layouts?.map((layout) => {
              const isSelected = selectedLayoutId === layout._id;
              return (
                <button
                  key={layout._id}
                  onClick={() => setSelectedLayoutId(layout._id)}
                  className={`px-4 py-1.5 font-medium text-xs rounded-lg transition-colors cursor-pointer flex items-center ${
                    isSelected
                      ? "text-white bg-[#0c0a09] font-semibold shadow-xs"
                      : "text-[#5e5e5e] hover:text-[#0c0a09] bg-[#f1edec] hover:bg-[#e7e5e4] border border-[#e7e5e4]"
                  }`}
                >
                  {getLayoutSignIcon(layout.name)}
                  <span>{layout.name}</span>
                </button>
              );
            })}
          </div>

          {/* Floor Table Grid */}
          <div className="flex-1 p-6 overflow-y-auto relative bg-[#fdf8f7]">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-5">
              {captainTables?.map((table) => {
                const isOccupied = Boolean(table.currentOrder);
                const isBlocked = Boolean(table.isBlock);
                const hasRequest = Boolean(table.postpaidOrderRequest);

                const elapsedMinutes = table.currentOrder?.createdAt
                  ? Math.floor((Date.now() - table.currentOrder.createdAt) / 60000)
                  : 0;
                const isOver2Hours = elapsedMinutes >= 120;

                let badgeBg = "bg-emerald-600";
                let badgeExtra = "";

                if (isBlocked) {
                  badgeBg = "bg-rose-700";
                  badgeExtra = "Blocked";
                } else if (hasRequest) {
                  badgeBg = "bg-amber-600 animate-pulse";
                  badgeExtra = "Alert";
                } else if (isOccupied) {
                  badgeBg = "bg-sky-600";
                  badgeExtra = `👥 ${table.currentOrder?.membersOnTable || table.seatingCapacity}`;
                }

                return (
                  <div
                    key={table._id}
                    onClick={() => handleOpenTable(table)}
                    className="cursor-pointer transition-all duration-200 transform hover:-translate-y-1 active:translate-y-0 w-28 rounded-lg overflow-hidden shadow-md border border-stone-200 bg-stone-900 text-white flex flex-col group"
                  >
                    {/* Table Header Badge with Amenity Sign */}
                    <div className={`${badgeBg} px-2 py-1 text-[11px] font-semibold flex items-center justify-between text-white transition-colors duration-300`}>
                      {renderTableAmenityBadge(table)}
                      {badgeExtra && <span className="text-[10px] font-mono tracking-tight">{badgeExtra}</span>}
                    </div>

                    {/* Table Body */}
                    <div className="p-3 text-center flex flex-col items-center justify-center min-h-[60px] bg-stone-900 text-white">
                      <span className="font-garamond text-base font-bold tracking-wide">
                        {getDisplayTableTitle(table.tableNumber)}
                      </span>
                      {isOccupied && (
                        <span
                          className={`text-[10px] font-mono mt-0.5 ${
                            isOver2Hours ? "text-amber-400 font-bold" : "text-stone-300"
                          }`}
                        >
                          {Math.floor(elapsedMinutes / 60)}:{(elapsedMinutes % 60).toString().padStart(2, "0")}:00
                        </span>
                      )}
                      {hasRequest && (
                        <span className="text-[10px] text-amber-300 font-medium mt-0.5">
                          QR Request
                        </span>
                      )}
                      {isBlocked && (
                        <span className="text-[10px] text-stone-400 font-medium mt-0.5">
                          Reserved
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Status Legend */}
          <footer className="h-10 bg-white border-t border-stone-200 flex items-center justify-center shrink-0" data-purpose="status-legend">
            <div className="bg-stone-200/70 backdrop-blur px-4 py-1 rounded-md text-[11px] flex items-center space-x-5 text-stone-700 font-medium">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                <span>Available</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-600 inline-block" />
                <span>Order request</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                <span>Time over 2hrs</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-600 inline-block" />
                <span>In use</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" />
                <span>Blocked</span>
              </div>
            </div>
          </footer>
        </main>

        {/* Workflow Side Drawer */}
        {isDrawerOpen && (
          <aside className="w-full md:w-[480px] xl:w-[500px] bg-white flex flex-col border-l border-[#e7e5e4] shadow-2xl z-40 transition-all duration-200 font-sans">
            {/* Drawer Header */}
            <div className="h-16 px-6 border-b border-[#e7e5e4] flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center space-x-3">
                <h2 className="font-garamond text-2xl md:text-[28px] text-[#0c0a09] font-normal leading-tight">
                  Table {selectedTable?.tableNumber}
                </h2>
                {selectedTable?.isBlock && (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold uppercase">
                    Blocked
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2 text-[#5e5e5e] relative">
                {/* 3-Dots Action Menu */}
                <button
                  onClick={() => setIsTableMenuOpen(!isTableMenuOpen)}
                  className="p-2 hover:text-[#0c0a09] transition rounded-lg hover:bg-[#f1edec] cursor-pointer"
                  title="Table Options"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </button>

                {isTableMenuOpen && (
                  <div className="absolute right-6 top-10 w-48 bg-white border border-[#e7e5e4] rounded-xl shadow-xl py-1.5 z-50 text-xs font-sans">
                    <button
                      onClick={handleToggleBlockTable}
                      className="w-full text-left px-4 py-2 hover:bg-[#f1edec] font-medium text-[#141010] cursor-pointer"
                    >
                      {selectedTable?.isBlock ? "Unblock Table" : "Block Table"}
                    </button>
                    {activeOrder && (
                      <button
                        onClick={() => {
                          setIsMoveTableModalOpen(true);
                          setIsTableMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-[#f1edec] font-medium text-[#141010] cursor-pointer"
                      >
                        Move Table
                      </button>
                    )}
                    <button
                      onClick={handleClearTable}
                      className="w-full text-left px-4 py-2 hover:bg-rose-50 font-medium text-rose-600 border-t border-[#e7e5e4] cursor-pointer"
                    >
                      Clear Table
                    </button>
                  </div>
                )}

                <button
                  onClick={handleCloseDrawer}
                  className="p-2 hover:text-[#0c0a09] transition rounded-lg hover:bg-[#f1edec] cursor-pointer"
                  title="Close Drawer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Customer Summary Bar */}
            {activeOrder && (
              <div className="px-6 py-2.5 bg-[#fdf8f7] border-b border-[#e7e5e4] flex items-center justify-between text-xs font-sans">
                <span className="text-[#5e5e5e] font-medium">
                  {activeOrder.customerPhone || "Dine-In Guest"} • <strong className="text-[#0c0a09]">{activeOrder.membersOnTable || 2} guests</strong>
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-white border border-[#e7e5e4] text-[#0c0a09] font-medium">
                  {activeOrder.waiter?.firstName ? `${activeOrder.waiter.firstName} ${activeOrder.waiter.lastName || ""}` : selectedWaiter.name}
                </span>
              </div>
            )}

            {/* Workflow Navigation Tabs */}
            <div className="px-6 pt-3.5 pb-2.5 border-b border-[#e7e5e4] grid grid-cols-4 gap-2 bg-white">
              <button
                onClick={() => setDrawerSubTab("user")}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors text-center cursor-pointer ${
                  drawerSubTab === "user"
                    ? "bg-[#0c0a09] text-white shadow-xs"
                    : "bg-[#f1edec] text-[#5e5e5e] hover:text-[#0c0a09] hover:bg-[#e7e5e4] border border-[#e7e5e4]"
                }`}
              >
                Customer
              </button>
              <button
                onClick={() => setDrawerSubTab("menu")}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors text-center cursor-pointer ${
                  drawerSubTab === "menu"
                    ? "bg-[#0c0a09] text-white shadow-xs"
                    : "bg-[#f1edec] text-[#5e5e5e] hover:text-[#0c0a09] hover:bg-[#e7e5e4] border border-[#e7e5e4]"
                }`}
              >
                Menu
              </button>
              <button
                onClick={() => setDrawerSubTab("tab")}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors text-center cursor-pointer ${
                  drawerSubTab === "tab"
                    ? "bg-[#0c0a09] text-white shadow-xs"
                    : "bg-[#f1edec] text-[#5e5e5e] hover:text-[#0c0a09] hover:bg-[#e7e5e4] border border-[#e7e5e4]"
                }`}
              >
                Tab ({activeOrder?.items?.length || runningCart.length})
              </button>
              <button
                onClick={() => setDrawerSubTab("payment")}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors text-center cursor-pointer ${
                  drawerSubTab === "payment"
                    ? "bg-[#0c0a09] text-white shadow-xs"
                    : "bg-[#f1edec] text-[#5e5e5e] hover:text-[#0c0a09] hover:bg-[#e7e5e4] border border-[#e7e5e4]"
                }`}
              >
                Payment
              </button>
            </div>

            {/* Drawer Body Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-white">
              {/* VIEW 1: CUSTOMER & WAITER ASSIGNMENT */}
              {drawerSubTab === "user" && (
                <div className="space-y-6 font-sans">
                  <div>
                    <h3 className="font-garamond text-xl font-normal text-[#0c0a09]">Customer Details</h3>
                    <p className="text-xs text-[#5e5e5e] mt-0.5">Enter dining guest contact and assign table server</p>
                  </div>

                  {/* Phone Input with Dynamic Country Code Dropdown */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#0c0a09]">
                      Customer Phone <span className="text-rose-600">*</span>
                    </label>
                    <div className="flex rounded-xl border border-[#e7e5e4] bg-white overflow-hidden shadow-2xs transition-all focus-within:border-[#0c0a09] focus-within:ring-1 focus-within:ring-[#0c0a09]">
                      {/* Dynamic Country Dial Selector */}
                      <div className="relative flex items-center bg-[#faf8f7] border-r border-[#e7e5e4]">
                        <select
                          value={customerCountryCode}
                          onChange={(e) => setCustomerCountryCode(e.target.value)}
                          className="appearance-none bg-transparent h-full pl-3.5 pr-7 py-2.5 text-xs font-semibold text-[#141010] focus:outline-none cursor-pointer flex items-center select-none"
                        >
                          {COUNTRY_DIAL_OPTIONS.map((opt) => (
                            <option key={opt.code} value={opt.code} className="text-[#0c0a09] font-sans">
                              {opt.iso} {opt.code}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute right-2 flex items-center text-[#5e5e5e]">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                          </svg>
                        </div>
                      </div>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full text-sm font-sans px-3.5 py-2.5 border-none focus:outline-none text-[#0c0a09] placeholder:text-[#a8a29e] placeholder:font-normal bg-transparent"
                        placeholder="Enter mobile number..."
                      />
                    </div>
                  </div>

                  {/* Members Input */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#0c0a09]">Number of Guests</label>
                    <input
                      type="number"
                      value={customerCount}
                      min={1}
                      onChange={(e) => setCustomerCount(parseInt(e.target.value) || 1)}
                      className="w-full text-sm font-sans px-3.5 py-2.5 border border-[#e7e5e4] rounded-xl shadow-2xs focus:outline-none focus:border-[#0c0a09] focus:ring-1 focus:ring-[#0c0a09] bg-white text-[#0c0a09] placeholder:text-[#a8a29e]"
                      placeholder="e.g. 2"
                    />
                  </div>

                  {/* Waiter Selection from Employees */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-[#0c0a09]">Assign Waiter / Server</label>
                    <div className="flex flex-wrap gap-2">
                      {waiterEmployees.map((w) => {
                        const isSelected = selectedWaiter.id === w.id;
                        return (
                          <button
                            key={w.id}
                            onClick={() =>
                              setSelectedWaiter({
                                id: w.id,
                                name: w.name,
                              })
                            }
                            className={`px-3.5 py-2 text-xs rounded-lg font-medium transition cursor-pointer flex items-center space-x-1.5 ${
                              isSelected
                                ? "bg-[#0c0a09] text-white shadow-xs"
                                : "bg-white border border-[#e7e5e4] text-[#141010] hover:bg-[#f1edec]"
                            }`}
                          >
                            <span>{w.name}</span>
                          </button>
                        );
                      })}
                      {waiterEmployees.length === 0 && (
                        <span className="text-xs text-[#7a716b] italic">No employees found</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#e7e5e4]">
                    <button
                      onClick={handleCloseDrawer}
                      className="w-full py-2.5 bg-[#f1edec] hover:bg-[#e7e5e4] text-[#141010] border border-[#e7e5e4] text-xs font-semibold rounded-lg transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveCustomerInfo}
                      className="w-full py-2.5 bg-[#0c0a09] hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg transition cursor-pointer shadow-xs"
                    >
                      Proceed to Menu →
                    </button>
                  </div>
                </div>
              )}

              {/* VIEW 2: MENU ORDERING */}
              {drawerSubTab === "menu" && (
                <div className="space-y-4 font-sans flex flex-col h-full">
                  {/* Search Bar */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#0c0a09]">Search Dishes</label>
                    <input
                      type="text"
                      placeholder="Search items by name or code..."
                      value={menuSearch}
                      onChange={(e) => setMenuSearch(e.target.value)}
                      className="w-full text-sm font-sans px-3.5 py-2.5 border border-[#e7e5e4] rounded-xl shadow-2xs focus:outline-none focus:border-[#0c0a09] focus:ring-1 focus:ring-[#0c0a09] bg-white text-[#0c0a09] placeholder:text-[#a8a29e]"
                    />
                  </div>

                  {/* Category Filter Pills (matching Cashier style) */}
                  <div className="flex flex-wrap gap-1.5 py-1">
                    {categoryNames.map((catName) => {
                      const isSelected = selectedCategory === catName;
                      return (
                        <button
                          key={catName}
                          type="button"
                          onClick={() => setSelectedCategory(catName)}
                          className={`px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap cursor-pointer ${
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
                  <div className="flex-1 overflow-y-auto divide-y divide-[#e7e5e4] pt-1" data-purpose="catalog-item-list">
                    {/* Table Column Headers */}
                    <div className="flex items-center justify-between py-2 text-xs font-semibold text-[#8a7e75]">
                      <div className="w-24">Quantity</div>
                      <div className="flex-1 px-3">Item</div>
                      <div className="w-20 text-right">Price</div>
                    </div>

                    {filteredCatalogItems.length === 0 ? (
                      <div className="py-12 text-center text-xs text-[#8a7e75]">
                        {selectedCategory === "All Items"
                          ? "No menu items found in this store."
                          : `No menu items found in ${selectedCategory}.`}
                      </div>
                    ) : (
                      filteredCatalogItems.map((entry) => {
                        const it = entry.item;
                        const itemId = it._id || it.id;
                        const inCartItem = runningCart.find((ci) => ci.itemId === itemId);
                        const currentCartQty = inCartItem?.quantity || 0;
                        const priceFormatted =
                          it.price % 100 === 0
                            ? (it.price / 100).toString()
                            : (it.price / 100).toFixed(2);

                        return (
                          <div
                            key={itemId}
                            className="flex items-center justify-between py-2.5 hover:bg-[#fafaf9] transition-colors"
                          >
                            {/* Quantity Stepper */}
                            <div className="w-24 flex items-center">
                              <div className="inline-flex items-center border border-[#141010] rounded-md bg-white">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateRunningItemQuantity(itemId, currentCartQty - 1, it)
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
                                  onClick={() => handleAddMenuItemToCart(it, 1)}
                                  className="w-6 h-6 flex items-center justify-center text-sm font-medium text-[#141010] hover:bg-neutral-100 rounded-r border-l border-[#141010]/30 cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Menu Item Details */}
                            <div
                              className="flex-1 px-3 flex items-center space-x-2.5 cursor-pointer"
                              onClick={() => handleAddMenuItemToCart(it, 1)}
                            >
                              {renderDietaryMark(it)}
                              <div>
                                <span className="text-xs font-medium text-[#141010] block leading-snug">
                                  {it.name}
                                </span>
                                {entry.categoryName && (
                                  <span className="text-[10px] text-[#78716c]">
                                    {entry.categoryName}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Price */}
                            <div className="w-20 text-right">
                              <span className="font-mono text-xs font-semibold text-[#141010]">
                                ₹{priceFormatted}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Bottom View Cart CTA */}
                  {runningCart.length > 0 && (
                    <div className="pt-3 border-t border-[#e7e5e4] shrink-0">
                      <button
                        onClick={() => setDrawerSubTab("tab")}
                        className="w-full py-3 bg-[#0c0a09] hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center space-x-2 transition shadow-sm cursor-pointer"
                      >
                        <span>View Running Cart ({runningCart.length} items)</span>
                        <span>•</span>
                        <span>₹{(runningCartTotalPaise / 100).toFixed(2)}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 3: TAB & RUNNING KOTs */}
              {drawerSubTab === "tab" && (
                <div className="space-y-5 font-sans">
                  {/* Running Cart 2 (Unplaced KOT items) */}
                  {runningCart.length > 0 && (
                    <div className="border border-[#e7e5e4] rounded-xl p-4 bg-[#fdf8f7] shadow-2xs">
                      <div className="flex items-center justify-between text-xs font-bold text-[#0c0a09] pb-2 border-b border-[#e7e5e4]">
                        <span>Cart 2 (New KOT) <span className="font-normal text-[#5e5e5e]">({runningCart.length} items)</span></span>
                        <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded font-semibold uppercase">
                          Unplaced
                        </span>
                      </div>
                      <div className="space-y-2 pt-3">
                        {runningCart.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="font-medium text-[#0c0a09]">{it.name}</span>
                            <div className="flex items-center space-x-3">
                              <span className="font-mono text-[#5e5e5e]">
                                {it.quantity}x ₹{(it.price / 100).toFixed(2)}
                              </span>
                              <button
                                onClick={() => handleUpdateRunningItemCount(idx, -it.quantity)}
                                className="text-[#a8a29e] hover:text-rose-600 cursor-pointer"
                                title="Remove"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="pt-3 mt-3 border-t border-[#e7e5e4]">
                        <button
                          onClick={handlePlaceOrder}
                          disabled={isPlacingCart}
                          className="w-full py-2.5 bg-[#0c0a09] hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer"
                        >
                          {isPlacingCart ? (
                            <span>Dispatching KOT...</span>
                          ) : (
                            <span>Place Order & Send KOT</span>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Cart 1 (Placed Order Items) */}
                  {activeOrder && activeOrder.items && (
                    <div className="border border-[#e7e5e4] rounded-xl p-4 bg-white shadow-2xs">
                      <div className="flex items-center justify-between text-xs font-bold text-[#0c0a09] pb-2 border-b border-[#e7e5e4]">
                        <span>Cart 1 (Active KOTs) <span className="font-normal text-[#5e5e5e]">({activeOrder.items.length} items)</span></span>
                        <span className="text-[11px] font-mono text-[#7a716b]">
                          {new Date(activeOrder.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="space-y-2.5 pt-3">
                        {activeOrder.items.map((it: any) => (
                          <div key={it._id} className="flex items-center justify-between text-xs py-1 border-b border-[#f1edec] last:border-none">
                            <div>
                              <p className="font-medium text-[#0c0a09]">{it.itemName}</p>
                              {it.isReady && (
                                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  ✓ Food Ready
                                </span>
                              )}
                            </div>
                            <span className="font-mono font-medium text-[#0c0a09]">
                              {it.quantity}x ₹{it.display_item_price}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="space-y-2 pt-2">
                    <button
                      onClick={() => setDrawerSubTab("menu")}
                      className="w-full py-2.5 bg-[#f1edec] hover:bg-[#e7e5e4] text-[#141010] text-xs font-medium rounded-lg border border-[#e7e5e4] transition cursor-pointer"
                    >
                      + Add More Items
                    </button>
                    {activeOrder && (
                      <button
                        onClick={() => setDrawerSubTab("payment")}
                        className="w-full py-2.5 bg-[#0c0a09] hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg transition shadow-xs cursor-pointer"
                      >
                        Proceed to Payment (₹{((activeOrder?.totalAmount || 0) / 100).toFixed(2)})
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* VIEW 4: PAYMENT SETTLEMENT */}
              {drawerSubTab === "payment" && (
                <div className="space-y-5 font-sans">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-garamond text-xl font-normal text-[#0c0a09]">Payment Settlement</h3>
                      <p className="text-xs text-[#5e5e5e] mt-0.5">Collect bill & settle table occupancy</p>
                    </div>
                    <button
                      onClick={() => showToast("🖨️ Bill sent to POS Thermal Printer")}
                      className="px-3.5 py-1.5 bg-[#0c0a09] hover:bg-neutral-800 text-white text-xs font-medium rounded-lg transition cursor-pointer shadow-2xs"
                    >
                      Print Receipt
                    </button>
                  </div>

                  {/* Total Payable Card */}
                  <div className="border border-[#e7e5e4] rounded-xl overflow-hidden flex shadow-2xs">
                    <div className="flex-1 p-3.5 bg-white flex items-center">
                      <span className="text-xs font-semibold text-[#0c0a09]">Total payable amount</span>
                    </div>
                    <div className="bg-[#0c0a09] text-white px-5 py-3 flex items-center justify-center font-bold text-base font-mono">
                      ₹{totalPayableAmount.toFixed(2)}
                    </div>
                  </div>

                  {/* Payment Type */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-[#0c0a09]">Select Payment Mode</label>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => setPaymentMode("cash")}
                        className={`py-2 text-xs font-medium rounded-lg transition cursor-pointer ${
                          paymentMode === "cash"
                            ? "bg-[#0c0a09] text-white font-bold shadow-2xs"
                            : "bg-white border border-[#e7e5e4] text-[#141010] hover:bg-[#f1edec]"
                        }`}
                      >
                        Cash
                      </button>
                      <button
                        onClick={() => setPaymentMode("cc")}
                        className={`py-2 text-xs font-medium rounded-lg transition cursor-pointer ${
                          paymentMode === "cc"
                            ? "bg-[#0c0a09] text-white font-bold shadow-2xs"
                            : "bg-white border border-[#e7e5e4] text-[#141010] hover:bg-[#f1edec]"
                        }`}
                      >
                        Credit Card
                      </button>
                      <button
                        onClick={() => setPaymentMode("dc")}
                        className={`py-2 text-xs font-medium rounded-lg transition cursor-pointer ${
                          paymentMode === "dc"
                            ? "bg-[#0c0a09] text-white font-bold shadow-2xs"
                            : "bg-white border border-[#e7e5e4] text-[#141010] hover:bg-[#f1edec]"
                        }`}
                      >
                        Debit Card
                      </button>
                      <button
                        onClick={() => setPaymentMode("upi")}
                        className={`py-2 text-xs font-medium rounded-lg transition cursor-pointer ${
                          paymentMode === "upi"
                            ? "bg-[#0c0a09] text-white font-bold shadow-2xs"
                            : "bg-white border border-[#e7e5e4] text-[#141010] hover:bg-[#f1edec]"
                        }`}
                      >
                        UPI
                      </button>
                    </div>
                  </div>

                  {/* Cash Calculator */}
                  {paymentMode === "cash" && (
                    <div className="space-y-3 p-4 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4]">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[#5e5e5e] mb-1">Tender Amount (₹)</label>
                          <input
                            type="number"
                            value={cashTendered}
                            onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                            className="w-full text-xs px-3 py-2 bg-white border border-[#e7e5e4] rounded-lg font-mono text-[#0c0a09] focus:outline-none focus:border-[#141010]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#5e5e5e] mb-1">Change Return (₹)</label>
                          <input
                            type="text"
                            readOnly
                            value={`₹ ${cashChangeReturn.toFixed(2)}`}
                            className="w-full text-xs px-3 py-2 bg-[#f1edec] border border-[#e7e5e4] rounded-lg text-[#0c0a09] font-mono font-semibold"
                          />
                        </div>
                      </div>

                      {/* Quick Denomination Shortcuts */}
                      <div className="flex items-center space-x-2 pt-1">
                        {[
                          Math.ceil(totalPayableAmount),
                          Math.ceil(totalPayableAmount / 10) * 10,
                          Math.ceil(totalPayableAmount / 100) * 100,
                          Math.ceil(totalPayableAmount / 500) * 500,
                        ].map((amt, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCashTendered(amt)}
                            className="px-3 py-1.5 text-xs bg-white hover:bg-[#f1edec] text-[#0c0a09] rounded-lg border border-[#e7e5e4] font-mono transition cursor-pointer shadow-2xs"
                          >
                            ₹{amt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Settle Action */}
                  <div className="pt-3">
                    <button
                      onClick={handleCompletePayment}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition shadow-sm flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                      <span>Complete Settle & Free Table</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Move Table Modal */}
      {isMoveTableModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-[#e7e5e4]">
            <h3 className="font-garamond text-2xl text-[#0c0a09] font-normal leading-tight">Transfer Table Order</h3>
            <p className="text-xs text-[#5e5e5e]">
              Select an available vacant table to transfer active order from Table #{selectedTable?.tableNumber}.
            </p>
            <select
              value={moveTargetTableId}
              onChange={(e) => setMoveTargetTableId(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 border border-[#e7e5e4] rounded-lg focus:outline-none focus:border-[#141010] bg-white text-[#0c0a09]"
            >
              <option value="">Select Destination Table</option>
              {captainTables
                ?.filter((t) => !t.currentOrder && t._id !== selectedTable?._id)
                ?.map((t) => (
                  <option key={t._id} value={t._id}>
                    Table #{t.tableNumber} ({t.seatingCapacity} seats - {t.layoutName})
                  </option>
                ))}
            </select>
            <div className="flex justify-end space-x-2 pt-2 border-t border-[#e7e5e4]">
              <button
                onClick={() => setIsMoveTableModalOpen(false)}
                className="px-4 py-2 text-xs text-[#141010] bg-[#f1edec] hover:bg-[#e7e5e4] border border-[#e7e5e4] rounded-lg font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleMoveTable}
                className="px-4 py-2 text-xs text-white bg-[#0c0a09] hover:bg-neutral-800 rounded-lg font-semibold cursor-pointer shadow-xs"
              >
                Confirm Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-14 left-1/2 transform -translate-x-1/2 bg-[#0c0a09] text-white px-5 py-2.5 rounded-xl shadow-2xl text-xs font-medium z-50 flex items-center space-x-2 font-sans border border-[#292524]">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
