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
  isGst?: boolean;
  taxGroupId?: any;
  taxMode?: "inclusive" | "exclusive";
  customizationOptions?: any[];
  customizations?: any[];
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

function getLayoutSignIcon(name?: string, isSelected?: boolean) {
  const n = (name || "").toLowerCase();
  const iconColorClass = isSelected ? "text-white stroke-white" : "text-[#5e5e5e] stroke-[#5e5e5e]";
  if (n.includes("outdoor") || n.includes("garden") || n.includes("patio") || n.includes("terrace") || n.includes("balcony")) {
    return (
      <svg className={`w-3.5 h-3.5 mr-1.5 shrink-0 ${iconColorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    );
  }
  if (n.includes("bar") || n.includes("lounge") || n.includes("pub") || n.includes("drink")) {
    return (
      <svg className={`w-3.5 h-3.5 mr-1.5 shrink-0 ${iconColorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 21h8m-4-7v7m-7-14l7 7 7-7H5z" />
      </svg>
    );
  }
  if (n.includes("vip") || n.includes("private") || n.includes("banquet") || n.includes("hall")) {
    return (
      <svg className={`w-3.5 h-3.5 mr-1.5 shrink-0 ${iconColorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 16l-3-9 6 3 4-6 4 6 6-3-3 9H5z" />
      </svg>
    );
  }
  // Default / Indoor / DineIn
  return (
    <svg className={`w-3.5 h-3.5 mr-1.5 shrink-0 ${iconColorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function renderTableSeatingCapacity(table: any) {
  return (
    <span className="flex items-center gap-1 font-semibold" title={`Seating Capacity: ${table.seatingCapacity}`}>
      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
      </svg>
      <span>{table.seatingCapacity}</span>
    </span>
  );
}

function renderTableAmenitiesRight(table: any, badgeExtra?: string) {
  return (
    <div className="flex items-center gap-1 ml-auto shrink-0 max-w-[65%] justify-end overflow-hidden">
      {/* Table Amenities Icons on the Right */}
      {table.kidsSeatAvailability && (
        <span title="Kids seat available" className="inline-flex items-center shrink-0">
          <svg className="w-3.5 h-3.5 shrink-0 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12h.01" />
            <path d="M15 12h.01" />
            <path d="M10 16c.5.5 1.5 1 2 1s1.5-.5 2-1" />
            <path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 5 6.3" />
            <path d="M12 2v2" />
          </svg>
        </span>
      )}
      {table.disabledSeatAvailability && (
        <span title="Disabled seat available" className="inline-flex items-center shrink-0">
          <svg className="w-3.5 h-3.5 shrink-0 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="4" r="2" />
            <path d="M18 19l-4-4h-3a2 2 0 0 1-2-2V7h4v4h3" />
            <path d="M7 13a5 5 0 1 0 5 5" />
          </svg>
        </span>
      )}
      {table.barbequeGrillAvailability && (
        <span title="Barbeque grill available" className="inline-flex items-center shrink-0">
          <svg className="w-3.5 h-3.5 shrink-0 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 11h16" />
            <path d="M6 11c.8 3.5 3.2 6 6 6s5.2-2.5 6-6" />
            <path d="M8 17l-3 4" />
            <path d="M16 17l3 4" />
            <path d="M9 7c0-1.5 1-2.5 1-3.5 1 1 2 2 2 3.5" />
            <path d="M14 8c0-1 1-2 1-3 1 1 1.5 1.5 1.5 3" />
          </svg>
        </span>
      )}

      {badgeExtra && (
        <span className="text-[9px] font-mono tracking-tighter font-bold uppercase truncate shrink-0 ml-0.5 text-white" title={badgeExtra}>
          {badgeExtra}
        </span>
      )}
    </div>
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

  // Query Taxation Engine (Store Settings, Tax Groups & Components) matching Cashier
  const storeTaxSettings = useQuery(
    api.taxation.getStoreTaxSettings,
    activeOrg ? { organizationId: activeOrg._id } : "skip"
  );
  const taxGroups = useQuery(
    api.taxation.listTaxGroups,
    activeOrg ? { organizationId: activeOrg._id } : "skip"
  );
  const taxComponents = useQuery(
    api.taxation.listTaxComponents,
    activeOrg ? { organizationId: activeOrg._id } : "skip"
  );

  const currencySymbol = storeTaxSettings?.currencySymbol || "₹";

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

  // Multi-Menu and Tax Engine Queries
  const [selectedMenuId, setSelectedMenuId] = useState<string>("all");

  const menusList = useQuery(
    api.menu.listMenus,
    orgId ? { organizationId: orgId } : "skip"
  );

  const storeMenu = useQuery(
    api.menu.getOrganizationMenu,
    orgId
      ? {
          organizationId: orgId,
          allMenus: selectedMenuId === "all",
          menuId: selectedMenuId !== "all" ? (selectedMenuId as Id<"menus">) : undefined,
        }
      : "skip"
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
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Customer Form State
  const [customerCountryCode, setCustomerCountryCode] = useState<string>("+91");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerCount, setCustomerCount] = useState<number>(2);
  const [isCustomerVerified, setIsCustomerVerified] = useState<boolean>(false);
  const [selectedWaiter, setSelectedWaiter] = useState<{ id?: string; name: string }>({
    id: undefined,
    name: "",
  });

  const fullCustomerPhone = customerPhone
    ? formatPhoneNumberWithCountryCode(customerPhone, customerCountryCode)
    : "";
  const hasCustomerPhone = Boolean(customerPhone && customerPhone.trim().length >= 10);

  const customerStats = useQuery(
    api.orders.getCustomerStats,
    activeOrg && hasCustomerPhone
      ? {
          organizationId: activeOrg._id,
          phone: fullCustomerPhone,
        }
      : "skip"
  );

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
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [txnRef, setTxnRef] = useState<string>("");
  const [nonCashTendered, setNonCashTendered] = useState<number | null>(null);

  // Real-time Clock & Live Table Ticker Timestamp
  const [nowMs, setNowMs] = useState<number>(Date.now());

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setNowMs(now.getTime());
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

  // Item Customization Selection Modal State
  const [customizingCatalogEntry, setCustomizingCatalogEntry] = useState<{
    item: any;
    customizations: any[];
    menuName?: string;
  } | null>(null);
  const [customizationQty, setCustomizationQty] = useState<number>(1);
  const [selectedCustomizationOptions, setSelectedCustomizationOptions] = useState<
    Record<string, Array<{ id?: string; _id?: string; name: string; price: number; [key: string]: any }>>
  >({});

  // Extract Flat Menu Items for Search & Catalog matching Cashier logic
  const allCatalogItems = useMemo(() => {
    if (!storeMenu || !Array.isArray(storeMenu)) return [];
    const itemsList: Array<{
      categoryName: string;
      categoryId: string;
      menuName?: string;
      menuId?: string;
      item: any;
      itemImageUrl?: string;
      customizations?: any[];
    }> = [];

    for (const catEntry of storeMenu) {
      const catObj = catEntry?.category || catEntry;
      const categoryName = catObj?.name || "General";
      const categoryId = catObj?.id || catObj?._id || "";
      const menuName = catObj?.menuName || catObj?.menu_name;
      const menuId = catObj?.menuId || catObj?.menu_id;
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
              menuName,
              menuId,
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

  // Dynamic Multi-Component Taxation Calculation (Item-level & Customization-level compliant matching Cashier)
  const cartTaxCalculation = useMemo(() => {
    if (!runningCart || runningCart.length === 0) {
      return {
        subtotalPaise: 0,
        taxExclusivePaise: 0,
        taxInclusivePaise: 0,
        totalTaxPaise: 0,
        totalPayablePaise: 0,
        componentBreakdown: [] as Array<{
          name: string;
          rate: number;
          code?: string;
          taxAmountPaise: number;
          isInclusive: boolean;
        }>,
        currencySymbol: storeTaxSettings?.currencySymbol || "₹",
      };
    }

    const defaultTaxGroup =
      taxGroups?.find((g) => g.isDefault) ||
      (taxGroups && taxGroups.length > 0 ? taxGroups[0] : null);

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

    for (const item of runningCart) {
      const lineTotalPaise = item.price * item.quantity;
      subtotalPaise += lineTotalPaise;

      const catalogEntry = allCatalogItems.find(
        (ci) => ci.item?._id === item.itemId || ci.item?.id === item.itemId
      );
      const liveItem = catalogEntry?.item;

      // 1. Base Item Tax
      const addonsUnitPrice = (item.customizationOptions || (item as any).customizations || []).reduce(
        (sum: number, c: any) => sum + (c.price || 0),
        0
      );
      const baseItemUnitPrice = Math.max(
        0,
        liveItem?.price !== undefined ? liveItem.price : item.price - addonsUnitPrice
      );
      const baseLineTotalPaise = baseItemUnitPrice * item.quantity;

      const itemTaxGroupId = liveItem?.taxGroupId || liveItem?.tax_group_id || item.taxGroupId;
      const itemTaxMode = liveItem?.taxMode || liveItem?.tax_mode || item.taxMode;
      const isGst = liveItem?.isGst ?? liveItem?.is_gst ?? item.isGst ?? false;

      if (isGst && baseLineTotalPaise > 0) {
        let groupComps: Array<{ name: string; rate: number; code?: string }> = [];
        let groupTotalRate = 0;
        let mode: "inclusive" | "exclusive" = "inclusive";

        if (liveItem?.tax_info?.components && liveItem.tax_info.components.length > 0) {
          groupComps = liveItem.tax_info.components.map((c: any) => ({
            name: c.name,
            rate: c.rate,
            code: c.code || c.name,
          }));
          groupTotalRate = liveItem.tax_info.total_tax_rate || groupComps.reduce((acc: number, c: any) => acc + c.rate, 0);
          mode = (liveItem.taxMode || liveItem.tax_mode || liveItem.tax_info.tax_mode || "inclusive") as "inclusive" | "exclusive";
        } else {
          let targetGroup = null;
          if (itemTaxGroupId && taxGroups) {
            targetGroup = taxGroups.find((g) => g._id === itemTaxGroupId) || null;
          }
          if (!targetGroup) {
            targetGroup = defaultTaxGroup;
          }

          if (targetGroup && targetGroup.componentIds && targetGroup.componentIds.length > 0) {
            mode = (itemTaxMode || targetGroup.taxMode || "inclusive") as "inclusive" | "exclusive";
            for (const cid of targetGroup.componentIds) {
              const comp = compMap.get(cid);
              if (comp) {
                groupComps.push({ name: comp.name, rate: comp.rate, code: comp.code });
                groupTotalRate += comp.rate;
              }
            }
          }
        }

        if (groupTotalRate > 0 && groupComps.length > 0) {
          let lineTaxPaise = 0;
          if (mode === "inclusive") {
            lineTaxPaise = Math.round(baseLineTotalPaise * (groupTotalRate / (100 + groupTotalRate)));
            taxInclusivePaise += lineTaxPaise;
          } else {
            lineTaxPaise = Math.round(baseLineTotalPaise * (groupTotalRate / 100));
            taxExclusivePaise += lineTaxPaise;

            for (const comp of groupComps) {
              const compShare = groupTotalRate > 0 ? comp.rate / groupTotalRate : 0;
              const compTaxPaise = Math.round(lineTaxPaise * compShare);
              const key = `${comp.name}_${comp.rate}`;
              const existing = compAccumulator.get(key);
              if (existing) {
                existing.taxAmountPaise += compTaxPaise;
              } else {
                compAccumulator.set(key, {
                  name: comp.name,
                  rate: comp.rate,
                  code: comp.code,
                  taxAmountPaise: compTaxPaise,
                  isInclusive: false,
                });
              }
            }
          }
        }
      }

      // 2. Customization Addons Tax
      const custs = item.customizationOptions || (item as any).customizations || [];
      if (custs.length > 0) {
        for (const cust of custs) {
          const custUnitPrice = cust.price || 0;
          const custLineTotalPaise = custUnitPrice * item.quantity;
          if (custLineTotalPaise <= 0) continue;

          let custIsGst = cust.isGst ?? cust.is_gst;
          let custTaxGroupId = cust.taxGroupId ?? cust.tax_group_id;
          let custTaxMode = cust.taxMode ?? cust.tax_mode;
          let custTaxInfo: any = cust.tax_info;

          if (catalogEntry?.customizations) {
            for (const cg of catalogEntry.customizations) {
              const foundCi = (cg.customization_items || []).find(
                (ci: any) => (ci.id || ci._id) === (cust.optionId || cust.id || cust._id)
              );
              if (foundCi) {
                if (custIsGst === undefined) custIsGst = foundCi.is_gst ?? foundCi.isGst;
                if (!custTaxGroupId) custTaxGroupId = foundCi.tax_group_id ?? foundCi.taxGroupId;
                if (!custTaxMode) custTaxMode = foundCi.tax_mode ?? foundCi.taxMode;
                if (!custTaxInfo) custTaxInfo = foundCi.tax_info;
                break;
              }
            }
          }

          if (custIsGst === false) continue; // Customization item exempt

          let custComps: Array<{ name: string; rate: number; code?: string }> = [];
          let custTotalRate = 0;
          let mode: "inclusive" | "exclusive" = "inclusive";

          if (custTaxInfo?.components && custTaxInfo.components.length > 0) {
            custComps = custTaxInfo.components.map((c: any) => ({
              name: c.name,
              rate: c.rate,
              code: c.code || c.name,
            }));
            custTotalRate = custTaxInfo.total_tax_rate || custComps.reduce((acc: number, c: any) => acc + c.rate, 0);
            mode = (custTaxMode || custTaxInfo.tax_mode || "inclusive") as "inclusive" | "exclusive";
          } else {
            let targetGroup = null;
            if (custTaxGroupId && taxGroups) {
              targetGroup = taxGroups.find((g) => g._id === custTaxGroupId) || null;
            }
            if (!targetGroup) {
              targetGroup = defaultTaxGroup;
            }

            if (targetGroup && targetGroup.componentIds && targetGroup.componentIds.length > 0) {
              mode = (custTaxMode || targetGroup.taxMode || "inclusive") as "inclusive" | "exclusive";
              for (const cid of targetGroup.componentIds) {
                const comp = compMap.get(cid);
                if (comp) {
                  custComps.push({ name: comp.name, rate: comp.rate, code: comp.code });
                  custTotalRate += comp.rate;
                }
              }
            }
          }

          if (custTotalRate > 0 && custComps.length > 0) {
            let lineTaxPaise = 0;
            if (mode === "inclusive") {
              lineTaxPaise = Math.round(custLineTotalPaise * (custTotalRate / (100 + custTotalRate)));
              taxInclusivePaise += lineTaxPaise;
            } else {
              lineTaxPaise = Math.round(custLineTotalPaise * (custTotalRate / 100));
              taxExclusivePaise += lineTaxPaise;

              for (const comp of custComps) {
                const compShare = custTotalRate > 0 ? comp.rate / custTotalRate : 0;
                const compTaxPaise = Math.round(lineTaxPaise * compShare);
                const key = `${comp.name}_${comp.rate}`;
                const existing = compAccumulator.get(key);
                if (existing) {
                  existing.taxAmountPaise += compTaxPaise;
                } else {
                  compAccumulator.set(key, {
                    name: comp.name,
                    rate: comp.rate,
                    code: comp.code,
                    taxAmountPaise: compTaxPaise,
                    isInclusive: false,
                  });
                }
              }
            }
          }
        }
      }
    }

    const totalTaxPaise = taxExclusivePaise + taxInclusivePaise;
    const totalPayablePaise = subtotalPaise + taxExclusivePaise;

    return {
      subtotalPaise,
      taxExclusivePaise,
      taxInclusivePaise,
      totalTaxPaise,
      totalPayablePaise,
      componentBreakdown: Array.from(compAccumulator.values()),
      currencySymbol: storeTaxSettings?.currencySymbol || "₹",
    };
  }, [runningCart, allCatalogItems, storeTaxSettings, taxGroups, taxComponents]);

  // Total Payable calculation
  const totalPayableAmount = useMemo(() => {
    if (activeOrder) {
      return (activeOrder.totalAmount || 0) / 100;
    }
    return cartTaxCalculation.totalPayablePaise / 100;
  }, [activeOrder, cartTaxCalculation.totalPayablePaise]);

  const exclusiveTaxAmount = useMemo(() => {
    if (activeOrder) {
      const sub = activeOrder.subTotal || activeOrder.totalAmount || 0;
      const tot = activeOrder.totalAmount || 0;
      const del = activeOrder.deliveryCharge || 0;
      const disc = activeOrder.discountAmount || 0;
      const diff = tot - (sub + del - disc);
      return diff > 0 ? diff / 100 : 0;
    }
    return cartTaxCalculation.taxExclusivePaise / 100;
  }, [activeOrder, cartTaxCalculation.taxExclusivePaise]);

  const hasExclusiveTax = exclusiveTaxAmount > 0;

  // Cash change return calculation
  const cashChangeReturn = useMemo(() => {
    const ret = cashTendered - totalPayableAmount;
    return ret > 0 ? ret : 0;
  }, [cashTendered, totalPayableAmount]);

  // Sync cashTendered with totalPayableAmount when entering payment tab or total updates
  useEffect(() => {
    if (drawerSubTab === "payment") {
      setCashTendered(totalPayableAmount);
    }
  }, [totalPayableAmount, drawerSubTab]);

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
      setIsCustomerVerified(true);
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
        setCustomerPhone(localDigits.replace(/\D/g, ""));
      } else {
        setCustomerPhone("");
        setCustomerCountryCode(defaultOrgCountryCode);
      }
      if (table.currentOrder.membersOnTable) {
        setCustomerCount(table.currentOrder.membersOnTable);
      }
    } else {
      setIsCustomerVerified(false);
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
    const digits = customerPhone.replace(/\D/g, "");
    const isIndia = customerCountryCode === "+91" || customerCountryCode === "IN +91";

    if (!digits) {
      showToast("Please enter customer phone number");
      return;
    }

    if (isIndia && digits.length !== 10) {
      showToast("Please enter a valid 10-digit mobile number");
      return;
    }

    if (!isIndia && (digits.length < 7 || digits.length > 15)) {
      showToast("Please enter a valid mobile number (7-15 digits)");
      return;
    }

    setIsCustomerVerified(true);
    setDrawerSubTab("menu");
    showToast("✅ Customer details verified");
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

  const handleCatalogItemClick = (entry: any, qty: number = 1) => {
    if (entry.customizations && entry.customizations.length > 0) {
      const initialSelected: Record<string, any[]> = {};
      for (const group of entry.customizations) {
        const gid = group.id || group._id;
        const isRequired = Boolean(
          group.required ??
          group.is_required ??
          group.isRequired ??
          (group.min_selected && group.min_selected > 0)
        );
        const isSingleChoice = (group.max_selected ?? (isRequired ? 1 : 99)) === 1;
        const avail = (group.customization_items || []).filter(
          (ci: any) => ci.is_available !== false && ci.isAvailable !== false
        );
        if (isSingleChoice && isRequired && avail.length > 0) {
          initialSelected[gid] = [avail[0]];
        }
      }
      setSelectedCustomizationOptions(initialSelected);
      setCustomizationQty(qty);
      setCustomizingCatalogEntry(entry);
    } else {
      handleAddMenuItemToCart(entry.item, qty);
    }
  };

  const handleToggleCustomizationOption = (group: any, option: any) => {
    const gid = group.id || group._id;
    const isRequired = Boolean(
      group.required ??
      group.is_required ??
      group.isRequired ??
      (group.min_selected && group.min_selected > 0)
    );
    const isSingleChoice = (group.max_selected ?? (isRequired ? 1 : 99)) === 1;

    setSelectedCustomizationOptions((prev) => {
      const current = prev[gid] || [];
      const optionId = option.id || option._id;
      const exists = current.some((o) => (o.id || o._id) === optionId);

      if (isSingleChoice) {
        if (exists) {
          // If group is REQUIRED: cannot unselect the single selected option into empty state.
          // If group is OPTIONAL: user CAN unselect/toggle off to empty.
          if (isRequired) {
            return prev;
          } else {
            const next = { ...prev };
            delete next[gid];
            return next;
          }
        }
        return { ...prev, [gid]: [option] };
      }

      // Multiple Choice Group:
      if (exists) {
        const minLimit = isRequired ? (group.min_selected || 1) : 0;
        if (current.length <= minLimit) {
          return prev; // Cannot deselect below required minimum
        }
        return {
          ...prev,
          [gid]: current.filter((o) => (o.id || o._id) !== optionId),
        };
      }

      const maxLimit = group.max_selected || 99;
      if (current.length >= maxLimit) {
        return prev;
      }

      return {
        ...prev,
        [gid]: [...current, option],
      };
    });
  };

  const handleConfirmCustomizedItem = () => {
    if (!customizingCatalogEntry) return;

    const { item, customizations } = customizingCatalogEntry;
    const selectedOptionsList: Array<{
      id: string;
      name: string;
      price: number;
      groupName: string;
      customizationId?: string;
      optionId?: string;
    }> = [];

    // Validate required customization groups
    for (const group of customizations) {
      const isRequired = Boolean(
        group.required ??
        group.is_required ??
        group.isRequired ??
        (group.min_selected && group.min_selected > 0)
      );
      const gid = group.id || group._id;
      const chosen = selectedCustomizationOptions[gid] || [];
      if (isRequired && chosen.length === 0) {
        showToast(`Please select a required option for ${group.name}`);
        return;
      }
    }

    let extraPrice = 0;
    for (const group of customizations) {
      const gid = group.id || group._id;
      const chosen = selectedCustomizationOptions[gid] || [];
      for (const opt of chosen) {
        extraPrice += opt.price || 0;
        selectedOptionsList.push({
          id: opt._id || opt.id || "",
          name: opt.name,
          price: opt.price || 0,
          groupName: group.name,
          customizationId: group._id || group.id,
          optionId: opt._id || opt.id,
        });
      }
    }

    const unitPrice = item.price + extraPrice;
    const itemId = item._id || item.id;

    setRunningCart((prev) => {
      const optionsKey = selectedOptionsList.map((o) => o.id).sort().join(",");
      const existingIdx = prev.findIndex((ci) => {
        if (ci.itemId !== itemId) return false;
        const ciOptsKey = ((ci as any).customizationOptions || []).map((o: any) => o.id || o._id).sort().join(",");
        return ciOptsKey === optionsKey;
      });

      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity += customizationQty;
        return updated;
      }

      return [
        ...prev,
        {
          itemId,
          name: item.name,
          price: unitPrice,
          quantity: customizationQty,
          customizationOptions: selectedOptionsList,
        } as any,
      ];
    });

    setCustomizingCatalogEntry(null);
    setSelectedCustomizationOptions({});
    setCustomizationQty(1);
    showToast(`Added ${customizingCatalogEntry.item.name} (Customized)`);
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
      const itemsPayload = runningCart.map((i) => {
        const custOptions = i.customizationOptions || (i as any).customizations || [];
        const custPayload = custOptions
          .filter((opt: any) => (opt.customizationId || opt.groupId) && (opt.optionId || opt.id))
          .map((opt: any) => ({
            customizationId: (opt.customizationId || opt.groupId) as Id<"customizations">,
            optionId: (opt.optionId || opt.id) as Id<"customizationItems">,
          }));

        return {
          itemId: i.itemId,
          quantity: i.quantity,
          isToGo: Boolean(i.isToGo),
          ...(custPayload.length > 0 ? { customizations: custPayload } : {}),
        };
      });

      if (activeOrder) {
        // Appending KOT #2 / #3 to existing active order
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
      const paymentModeLabel =
        paymentMode === "cash"
          ? "Cash"
          : paymentMode === "cc"
          ? "Credit Card"
          : paymentMode === "dc"
          ? "Debit Card"
          : "UPI";

      const refText = txnRef.trim() || `CAPTAIN-${Date.now().toString().slice(-6)}`;

      await completeOrderMutation({
        orderId: activeOrder._id,
        paymentMode: paymentModeLabel,
        transactionReference: refText,
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
          <div className="h-14 px-4 sm:px-6 border-b border-[#e7e5e4] bg-white flex items-center justify-between shrink-0 gap-3">
            <div className="flex items-center space-x-3 shrink-0">
              <Link
                href="/dashboard"
                className="text-[#5e5e5e] hover:text-[#0c0a09] p-1.5 transition rounded-lg hover:bg-[#f1edec]"
                title="Go to dashboard"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </Link>
              <div className="flex items-center space-x-2 whitespace-nowrap">
                <h1 className="font-sans font-bold text-2xl sm:text-[26px] md:text-[28px] text-[#0c0a09] leading-none whitespace-nowrap">
                  Captain POS
                </h1>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse shadow-sm shrink-0" title="Live Synced" />
              </div>
            </div>

            {/* Status Counts Pill Filters & Clock/Waiter */}
            <div className="flex items-center space-x-3 min-w-0 overflow-hidden">
              <div className="flex items-center space-x-1.5 text-xs font-sans overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink">
                <span className="px-2.5 py-1 rounded-full bg-white border border-[#e7e5e4] font-semibold text-[#141010] shadow-2xs whitespace-nowrap">
                  All ({captainTables?.length || 0})
                </span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-semibold shadow-2xs whitespace-nowrap">
                  Available ({captainTables?.filter((t) => !t.currentOrder && !t.isBlock && !t.postpaidOrderRequest).length || 0})
                </span>
                <span className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200/80 font-semibold shadow-2xs whitespace-nowrap">
                  Occupied ({captainTables?.filter((t) => t.currentOrder).length || 0})
                </span>
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200/80 font-semibold shadow-2xs whitespace-nowrap">
                  QR Request ({captainTables?.filter((t) => t.postpaidOrderRequest).length || 0})
                </span>
                <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200/80 font-semibold shadow-2xs whitespace-nowrap">
                  Blocked ({captainTables?.filter((t) => t.isBlock).length || 0})
                </span>
              </div>

              <div className="flex items-center space-x-2 text-xs font-sans pl-2.5 border-l border-[#e7e5e4] shrink-0 whitespace-nowrap">
                <span className="font-mono text-[#0c0a09] font-semibold">{systemTime || "04:21 PM"}</span>
                {selectedWaiter.name && (
                  <span className="hidden sm:inline bg-[#f1edec] border border-[#e7e5e4] px-2 py-0.5 rounded-md text-[11px] text-[#141010] font-medium truncate max-w-[110px]">
                    {selectedWaiter.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section Tabs (Layouts) with Zoom Controls */}
          <div className="h-12 px-4 sm:px-6 border-b border-[#e7e5e4] bg-white flex items-center justify-between shrink-0 text-sm">
            <div className="flex items-center space-x-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-w-0 py-1">
              {layouts?.map((layout) => {
                const isSelected = selectedLayoutId === layout._id;
                return (
                  <button
                    key={layout._id}
                    type="button"
                    onClick={() => setSelectedLayoutId(layout._id)}
                    className={`px-3.5 py-1.5 font-medium text-xs rounded-lg transition-all cursor-pointer flex items-center shrink-0 ${
                      isSelected
                        ? "bg-[#0c0a09] !text-white border border-[#0c0a09] shadow-xs font-semibold"
                        : "bg-[#f1edec] text-[#44403c] hover:text-[#0c0a09] hover:bg-[#e7e5e4] border border-[#e7e5e4]"
                    }`}
                  >
                    {getLayoutSignIcon(layout.name, isSelected)}
                    <span className={isSelected ? "!text-white font-semibold" : "text-[#44403c]"}>
                      {layout.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Floor Map Zoom Controls */}
            <div className="flex items-center gap-1 border border-[#e7e5e4] rounded-lg px-2 py-0.5 bg-stone-50 font-mono text-[11px] shrink-0 ml-3">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                disabled={zoomLevel <= 50}
                className="hover:text-black px-1.5 py-0.5 font-bold cursor-pointer hover:bg-stone-200 rounded disabled:opacity-30 disabled:cursor-not-allowed select-none transition-colors"
                title="Zoom Out (-10%)"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(100)}
                className="text-[#0c0a09] font-semibold px-2 py-0.5 border-x border-stone-200 hover:bg-stone-200 rounded transition-colors cursor-pointer select-none"
                title="Reset Zoom to 100%"
              >
                {zoomLevel}%
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                disabled={zoomLevel >= 150}
                className="hover:text-black px-1.5 py-0.5 font-bold cursor-pointer hover:bg-stone-200 rounded disabled:opacity-30 disabled:cursor-not-allowed select-none transition-colors"
                title="Zoom In (+10%)"
              >
                +
              </button>
            </div>
          </div>

          {/* Floor Table 2D Spatial Canvas */}
          <div
            className="flex-1 relative p-6 overflow-auto select-none min-h-[500px]"
            style={{
              backgroundColor: "#fdf8f7",
              backgroundImage: "radial-gradient(#d6d3d1 0.85px, transparent 0.85px)",
              backgroundSize: `${24 * (zoomLevel / 100)}px ${24 * (zoomLevel / 100)}px`,
            }}
          >
            <div
              style={{
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: "0 0",
                width: `${100 / (zoomLevel / 100)}%`,
                height: `${100 / (zoomLevel / 100)}%`,
                minWidth: "1200px",
                minHeight: "750px",
                position: "relative",
                transition: "transform 0.15s ease-out",
              }}
            >
              {captainTables?.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                  <p className="text-sm text-[#8a7e75]">No tables placed in this layout yet.</p>
                </div>
              ) : (
                captainTables?.map((table, idx) => {
                  const posX = table.xPosition ? parseInt(table.xPosition, 10) : 60 + (idx % 4) * 160;
                  const posY = table.yPosition ? parseInt(table.yPosition, 10) : 60 + Math.floor(idx / 4) * 150;

                  const isOccupied = Boolean(table.currentOrder);
                  const isBlocked = Boolean(table.isBlock);
                  const hasRequest = Boolean(table.postpaidOrderRequest);

                  const orderCreatedAt = table.currentOrder?.createdAt;
                  const elapsedMs = orderCreatedAt ? Math.max(0, nowMs - orderCreatedAt) : 0;
                  const elapsedSecondsTotal = Math.floor(elapsedMs / 1000);
                  const elapsedHours = Math.floor(elapsedSecondsTotal / 3600);
                  const elapsedMins = Math.floor((elapsedSecondsTotal % 3600) / 60);
                  const elapsedSecs = elapsedSecondsTotal % 60;

                  const isOver2Hours = elapsedSecondsTotal >= 7200;

                  let badgeBg = "bg-emerald-600";
                  let badgeExtra = "";

                  if (isBlocked) {
                    badgeBg = "bg-rose-700";
                    badgeExtra = "Blocked";
                  } else if (hasRequest) {
                    badgeBg = "bg-amber-600 animate-pulse";
                    badgeExtra = "Alert";
                  } else if (isOccupied) {
                    if (isOver2Hours) {
                      badgeBg = "bg-amber-500 animate-pulse";
                    } else {
                      badgeBg = "bg-sky-600";
                    }
                    badgeExtra = `👥 ${table.currentOrder?.membersOnTable || table.seatingCapacity}`;
                  }

                  return (
                    <div
                      key={table._id}
                      onClick={() => handleOpenTable(table)}
                      style={{
                        position: "absolute",
                        left: `${posX}px`,
                        top: `${posY}px`,
                      }}
                      className="cursor-pointer transition-all duration-200 transform hover:-translate-y-1 active:translate-y-0 w-28 sm:w-32 rounded-xl overflow-hidden shadow-md hover:shadow-xl border border-stone-200 bg-stone-900 text-white flex flex-col group z-10 hover:z-20"
                    >
                      {/* Table Header Badge with Seating on Left & Amenities/Status on Right */}
                      <div className={`${badgeBg} px-2.5 py-1 text-[11px] font-semibold flex items-center justify-between text-white transition-colors duration-300`}>
                        {renderTableSeatingCapacity(table)}
                        {renderTableAmenitiesRight(table, badgeExtra)}
                      </div>

                      {/* Table Body */}
                      <div className="p-3.5 sm:p-4 text-center flex flex-col items-center justify-center min-h-[84px] sm:min-h-[92px] bg-stone-900 text-white">
                        <span className="font-sans text-base sm:text-lg font-bold tracking-wide leading-tight">
                          {getDisplayTableTitle(table.tableNumber)}
                        </span>
                        {isOccupied && (
                          <span
                            className={`text-[10px] font-mono mt-0.5 ${
                              isOver2Hours ? "text-amber-400 font-bold animate-pulse" : "text-stone-300"
                            }`}
                          >
                            {elapsedHours}:{elapsedMins.toString().padStart(2, "0")}:{elapsedSecs.toString().padStart(2, "0")}
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
                })
              )}
            </div>
          </div>

          {/* Bottom Status Legend */}
          <footer className="h-10 bg-white border-t border-stone-200 flex items-center justify-center shrink-0 px-4 overflow-x-auto" data-purpose="status-legend">
            <div className="bg-stone-200/70 backdrop-blur px-4 py-1 rounded-md text-[11px] flex items-center space-x-4 sm:space-x-5 text-stone-700 font-medium whitespace-nowrap">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block shrink-0" />
                <span>Available</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-600 inline-block shrink-0" />
                <span>Order request</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shrink-0" />
                <span>Time over 2hrs</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-600 inline-block shrink-0" />
                <span>In use</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block shrink-0" />
                <span>Blocked</span>
              </div>
            </div>
          </footer>
        </main>

        {/* Workflow Side Drawer */}
        {isDrawerOpen && (
          <aside className="w-full sm:w-[380px] md:w-[400px] lg:w-[440px] xl:w-[480px] max-w-full bg-white flex flex-col border-l border-[#e7e5e4] shadow-2xl z-40 transition-all duration-200 font-sans shrink-0">
            {/* Drawer Header */}
            <div className="h-14 sm:h-16 px-5 sm:px-6 border-b border-[#e7e5e4] flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center space-x-3">
                <h2 className="font-sans font-bold text-xl sm:text-2xl md:text-[26px] text-[#0c0a09] leading-tight">
                  {getDisplayTableTitle(selectedTable?.tableNumber || "")}
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

            {/* Drawer Body Content */}
            {selectedTable?.isBlock ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#faf8f7] space-y-4 font-sans select-none">
                <div className="w-16 h-16 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 shadow-xs">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <h3 className="font-sans font-bold text-2xl text-[#0c0a09]">Table is Blocked</h3>
                  <p className="text-xs text-[#5e5e5e] max-w-xs mx-auto leading-relaxed">
                    This table is currently reserved / blocked. Unblock the table from the top menu or button below to start taking orders.
                  </p>
                </div>
                <button
                  onClick={handleToggleBlockTable}
                  className="px-6 py-2.5 bg-[#c40038] hover:bg-[#a0002e] text-white font-bold text-xs rounded-full shadow-sm transition cursor-pointer flex items-center space-x-2"
                >
                  <svg className="w-4 h-4 text-white shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                  <span className="text-white font-bold tracking-wide">Unblock Table #{selectedTable.tableNumber}</span>
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
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
            {(() => {
              const isCustomerValid = Boolean(activeOrder || isCustomerVerified);
              const handleTabClick = (tab: "user" | "menu" | "tab" | "payment") => {
                if (tab !== "user" && !isCustomerValid) {
                  showToast("Please enter customer details and click Proceed to Menu");
                  return;
                }
                setDrawerSubTab(tab);
              };

              return (
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
                    onClick={() => handleTabClick("menu")}
                    className={`py-2 text-xs font-semibold rounded-lg transition-all text-center ${
                      drawerSubTab === "menu"
                        ? "bg-[#0c0a09] text-white shadow-xs cursor-pointer"
                        : isCustomerValid
                        ? "bg-[#f1edec] text-[#5e5e5e] hover:text-[#0c0a09] hover:bg-[#e7e5e4] border border-[#e7e5e4] cursor-pointer"
                        : "bg-[#f5f5f4] text-[#a8a29e] border border-[#e7e5e4] opacity-50 cursor-not-allowed"
                    }`}
                  >
                    Menu
                  </button>
                  <button
                    onClick={() => handleTabClick("tab")}
                    className={`py-2 text-xs font-semibold rounded-lg transition-all text-center ${
                      drawerSubTab === "tab"
                        ? "bg-[#0c0a09] text-white shadow-xs cursor-pointer"
                        : isCustomerValid
                        ? "bg-[#f1edec] text-[#5e5e5e] hover:text-[#0c0a09] hover:bg-[#e7e5e4] border border-[#e7e5e4] cursor-pointer"
                        : "bg-[#f5f5f4] text-[#a8a29e] border border-[#e7e5e4] opacity-50 cursor-not-allowed"
                    }`}
                  >
                    Tab ({activeOrder?.items?.length || runningCart.length})
                  </button>
                  <button
                    onClick={() => handleTabClick("payment")}
                    className={`py-2 text-xs font-semibold rounded-lg transition-all text-center ${
                      drawerSubTab === "payment"
                        ? "bg-[#0c0a09] text-white shadow-xs cursor-pointer"
                        : isCustomerValid
                        ? "bg-[#f1edec] text-[#5e5e5e] hover:text-[#0c0a09] hover:bg-[#e7e5e4] border border-[#e7e5e4] cursor-pointer"
                        : "bg-[#f5f5f4] text-[#a8a29e] border border-[#e7e5e4] opacity-50 cursor-not-allowed"
                    }`}
                  >
                    Payment
                  </button>
                </div>
              );
            })()}

            {/* Drawer Body Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-white">
              {/* VIEW 1: CUSTOMER & WAITER ASSIGNMENT */}
              {drawerSubTab === "user" && (
                <div className="space-y-6 font-sans">
                  <div>
                    <h3 className="font-sans font-bold text-xl text-[#0c0a09]">Customer Details</h3>
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
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          const isIndia = customerCountryCode === "+91" || customerCountryCode === "IN +91";
                          const maxLen = isIndia ? 10 : 15;
                          setCustomerPhone(val.slice(0, maxLen));
                          setIsCustomerVerified(false);
                        }}
                        maxLength={customerCountryCode === "+91" || customerCountryCode === "IN +91" ? 10 : 15}
                        className="w-full text-sm font-sans px-3.5 py-2.5 border-none focus:outline-none text-[#0c0a09] placeholder:text-[#a8a29e] placeholder:font-normal bg-transparent font-medium"
                        placeholder={customerCountryCode === "+91" || customerCountryCode === "IN +91" ? "Enter 10-digit mobile number..." : "Enter mobile number..."}
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

                  {/* Customer Previous Order History & Insights */}
                  {hasCustomerPhone && customerStats && (
                    <div className="space-y-3 pt-3 border-t border-[#e7e5e4]">
                      <h4 className="text-xs font-bold text-[#0c0a09] uppercase tracking-wide">
                        Customer Insights & Past History
                      </h4>

                      {/* Stats Pills */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-stone-50 border border-stone-200 rounded-lg p-2 text-center">
                          <span className="block text-[10px] text-stone-500 font-medium uppercase">Dine-in</span>
                          <span className="text-xs font-bold text-stone-900 font-sans">
                            {customerStats.dineInCount ?? 0} visits
                          </span>
                        </div>
                        <div className="bg-stone-50 border border-stone-200 rounded-lg p-2 text-center">
                          <span className="block text-[10px] text-stone-500 font-medium uppercase">Takeaway</span>
                          <span className="text-xs font-bold text-stone-900 font-sans">
                            {customerStats.takeawayCount ?? 0} visits
                          </span>
                        </div>
                        <div className="bg-stone-50 border border-stone-200 rounded-lg p-2 text-center">
                          <span className="block text-[10px] text-stone-500 font-medium uppercase">Total Spend</span>
                          <span className="text-xs font-bold text-emerald-700 font-sans">
                            {currencySymbol}{((customerStats.totalSpends || 0) / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Recent Past Orders */}
                      {customerStats.recentOrders && customerStats.recentOrders.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-stone-600 block">Recent Orders ({customerStats.recentOrders.length})</span>
                          </div>
                          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-[#141010]">
                            {customerStats.recentOrders.map((ord: any, idx: number) => (
                              <div key={ord._id || idx} className="bg-white border border-stone-200 rounded-lg p-2 text-xs space-y-1 hover:border-stone-400 transition-colors">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-sans font-bold text-stone-900">{ord.orderNumber}</span>
                                  <span className="text-stone-500 text-[10px]">
                                    {new Date(ord.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-stone-600">
                                  <span className="truncate max-w-[180px]">
                                    {ord.items?.map((i: any) => i.itemName).join(", ") || ord.itemsSummary || "Dine-in Items"}
                                  </span>
                                  <span className="font-sans font-bold text-stone-900 shrink-0 ml-1">
                                    {currencySymbol}{((ord.totalAmount || 0) / 100).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-stone-500 italic">First time guest at this restaurant!</p>
                      )}
                    </div>
                  )}

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
                  {/* Multi-Menu Selector Bar */}
                  {menusList && menusList.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 bg-[#f5f5f4] p-1 rounded-xl border border-[#e7e5e4]">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMenuId("all");
                          setSelectedCategory("All Items");
                        }}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                          selectedMenuId === "all"
                            ? "bg-white text-[#141010] shadow-2xs font-semibold"
                            : "text-[#78716c] hover:text-[#141010]"
                        }`}
                      >
                        All Menus
                      </button>
                      {menusList.map((m) => (
                        <button
                          key={m._id}
                          type="button"
                          onClick={() => {
                            setSelectedMenuId(m._id);
                            setSelectedCategory("All Items");
                          }}
                          className={`px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                            selectedMenuId === m._id
                              ? "bg-white text-[#141010] shadow-2xs font-semibold"
                              : "text-[#78716c] hover:text-[#141010]"
                          }`}
                        >
                          {m.name}
                          {m.isDefault && (
                            <span className="ml-1 text-[10px] text-[#a8a29e] font-normal">
                              (Default)
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

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
                      <div
                        className="w-14 text-center cursor-help underline decoration-dotted"
                        title="Togo is used when you want the food for to go while dining"
                      >
                        To go
                      </div>
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
                        const hasCustomizations = Boolean(entry.customizations && entry.customizations.length > 0);

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
                                  onClick={() => handleCatalogItemClick(entry, 1)}
                                  className="w-6 h-6 flex items-center justify-center text-sm font-medium text-[#141010] hover:bg-neutral-100 rounded-r border-l border-[#141010]/30 cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* To go Checkbox Column */}
                            <div className="w-14 flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={Boolean(inCartItem?.isToGo)}
                                onChange={(e) => {
                                  const idx = runningCart.findIndex((ci) => ci.itemId === itemId);
                                  if (idx > -1) {
                                    const nextCart = [...runningCart];
                                    nextCart[idx] = { ...nextCart[idx], isToGo: e.target.checked };
                                    setRunningCart(nextCart);
                                  } else if (e.target.checked) {
                                    setRunningCart((prev) => [
                                      ...prev,
                                      {
                                        itemId: itemId as Id<"items">,
                                        name: it.name,
                                        price: it.price || 0,
                                        quantity: 1,
                                        isVeg: it.isVeg ?? it.is_veg ?? true,
                                        isToGo: true,
                                      },
                                    ]);
                                  }
                                }}
                                title="Togo is used when you want the food for to go while dining"
                                className="w-4 h-4 accent-[#0c0a09] rounded cursor-pointer"
                              />
                            </div>

                            {/* Menu Item Details */}
                            <div
                              className="flex-1 px-3 flex items-center space-x-2.5 cursor-pointer"
                              onClick={() => handleCatalogItemClick(entry, 1)}
                            >
                              <div>
                                <span className="text-xs font-semibold text-[#141010] block leading-snug">
                                  {it.name}
                                </span>
                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                  {entry.menuName && (selectedMenuId === "all" || (menusList && menusList.length > 1)) && (
                                    <span className="text-[9px] bg-stone-100 text-stone-600 border border-[#e7e5e4] px-1.5 py-0.5 rounded font-normal">
                                      {entry.menuName}
                                    </span>
                                  )}
                                  {hasCustomizations && (
                                    <span
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCatalogItemClick(entry, 1);
                                      }}
                                      className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-medium cursor-pointer hover:bg-amber-100"
                                    >
                                      Customise
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Price */}
                            <div className="w-20 text-right">
                              <span className="font-mono text-xs font-semibold text-[#141010]">
                                {currencySymbol}{priceFormatted}
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
                        <span>{currencySymbol}{(runningCartTotalPaise / 100).toFixed(2)}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 3: TAB & RUNNING KOTs */}
              {drawerSubTab === "tab" && (
                <div className="space-y-5 font-sans">
                  {/* Running Cart 2 (Unplaced items) */}
                  {runningCart.length > 0 && (
                    <div className="border border-[#e7e5e4] rounded-xl p-4 bg-[#fdf8f7] shadow-2xs">
                      <div className="flex items-center justify-between text-xs font-bold text-[#0c0a09] pb-2 border-b border-[#e7e5e4]">
                        <span>Cart 2 <span className="font-normal text-[#5e5e5e]">({runningCart.length} items)</span></span>
                        <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded font-semibold uppercase">
                          Unplaced
                        </span>
                      </div>
                      <div className="space-y-2 pt-3">
                        {runningCart.map((it, idx) => (
                          <div key={idx} className="flex items-start justify-between text-xs py-1.5 border-b border-[#f1edec] last:border-none">
                            <div className="min-w-0 flex-1 pr-2">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-medium text-[#0c0a09]">{it.name}</span>
                                {it.isToGo && (
                                  <span className="text-[9px] text-amber-800 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block">
                                    🛍️ To go
                                  </span>
                                )}
                              </div>
                              {((it.customizationOptions && it.customizationOptions.length > 0) || ((it as any).customizations && (it as any).customizations.length > 0)) && (
                                <div className="text-[10px] text-stone-500 font-mono space-y-0.5 mt-0.5">
                                  {(it.customizationOptions || (it as any).customizations).map((c: any, cIdx: number) => (
                                    <span key={cIdx} className="block">
                                      + {c.name || c.optionName} {c.price ? `(${currencySymbol}${(c.price / 100).toFixed(2)})` : ""}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 shrink-0 ml-1">
                              <span className="font-mono text-[#5e5e5e]">
                                {it.quantity}x {currencySymbol}{(it.price / 100).toFixed(2)}
                              </span>
                              <button
                                onClick={() => handleUpdateRunningItemCount(idx, -it.quantity)}
                                className="text-[#a8a29e] hover:text-rose-600 cursor-pointer text-xs"
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
                            <span>Placing Order...</span>
                          ) : (
                            <span>Place Order</span>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Cart 1 (Placed Order Items) */}
                  {activeOrder && activeOrder.items && (
                    <div className="border border-[#e7e5e4] rounded-xl p-4 bg-white shadow-2xs">
                      <div className="flex items-center justify-between text-xs font-bold text-[#0c0a09] pb-2 border-b border-[#e7e5e4]">
                        <span>Cart 1 <span className="font-normal text-[#5e5e5e]">({activeOrder.items.length} items)</span></span>
                        <span className="text-[11px] font-mono text-[#7a716b]">
                          {new Date(activeOrder.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="space-y-2.5 pt-3">
                        {activeOrder.items.map((it: any) => (
                          <div key={it._id} className="flex items-start justify-between text-xs py-1 border-b border-[#f1edec] last:border-none">
                            <div>
                              <div className="flex items-center space-x-1.5">
                                <p className="font-medium text-[#0c0a09]">{it.itemName}</p>
                                {it.isToGo && (
                                  <span className="text-[9px] text-amber-800 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block">
                                    🛍️ To go
                                  </span>
                                )}
                              </div>
                              {it.customizations && it.customizations.length > 0 && (
                                <div className="text-[10px] text-stone-500 font-mono space-y-0.5 mt-0.5">
                                  {it.customizations.map((c: any, cIdx: number) => (
                                    <span key={cIdx} className="block">
                                      + {c.optionName || c.name} {c.price ? `(${currencySymbol}${(c.price / 100).toFixed(2)})` : ""}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {it.isReady && (
                                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-1 inline-block">
                                  ✓ Food Ready
                                </span>
                              )}
                            </div>
                            <span className="font-mono font-medium text-[#0c0a09] shrink-0 ml-2">
                              {it.quantity}x {currencySymbol}{it.display_item_price}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bill & Taxes Breakdown Summary (Matching Cashier Taxation Engine) */}
                  <div className="border border-[#e7e5e4] rounded-xl p-3.5 bg-stone-50/70 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-stone-600 font-medium">
                      <span>Subtotal</span>
                      <span className="font-mono font-semibold text-stone-900">
                        {currencySymbol}{((activeOrder ? (activeOrder.subTotal || activeOrder.totalAmount) : cartTaxCalculation.subtotalPaise) / 100).toFixed(2)}
                      </span>
                    </div>

                    {hasExclusiveTax && (
                      cartTaxCalculation.componentBreakdown.length > 0 ? (
                        cartTaxCalculation.componentBreakdown.map((comp, cIdx) => (
                          <div key={cIdx} className="flex items-center justify-between text-stone-600 text-[11px]">
                            <span>{comp.name} ({comp.rate}%)</span>
                            <span className="font-mono text-stone-900 font-medium">
                              {currencySymbol}{(comp.taxAmountPaise / 100).toFixed(2)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center justify-between text-stone-600 text-[11px]">
                          <span>Taxes & Charges (GST)</span>
                          <span className="font-mono text-stone-900 font-medium">
                            {currencySymbol}{exclusiveTaxAmount.toFixed(2)}
                          </span>
                        </div>
                      )
                    )}

                    <div className="pt-2 border-t border-[#e7e5e4] flex items-center justify-between font-bold text-stone-900 text-sm">
                      <span>Grand Total</span>
                      <span className="font-mono text-emerald-700">
                        {currencySymbol}{totalPayableAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-2">
                    <button
                      onClick={() => setDrawerSubTab("menu")}
                      className="w-full py-2.5 bg-[#f1edec] hover:bg-[#e7e5e4] text-[#141010] text-xs font-medium rounded-lg border border-[#e7e5e4] transition cursor-pointer"
                    >
                      + Add More Items
                    </button>
                    {activeOrder ? (
                      <button
                        onClick={() => setDrawerSubTab("payment")}
                        className="w-full py-2.5 bg-[#0c0a09] hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg transition shadow-xs cursor-pointer"
                      >
                        Proceed to Payment ({currencySymbol}{totalPayableAmount.toFixed(2)})
                      </button>
                    ) : (
                      <button
                        onClick={() => setDrawerSubTab("payment")}
                        className="w-full py-2.5 bg-[#0c0a09] hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg transition shadow-xs cursor-pointer"
                      >
                        Proceed to Payment ({currencySymbol}{totalPayableAmount.toFixed(2)})
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* VIEW 4: PAYMENT SETTLEMENT */}
              {drawerSubTab === "payment" && (
                <div className="space-y-5 font-sans">
                  <div>
                    <h3 className="font-sans font-bold text-xl text-[#0c0a09]">Payment Settlement</h3>
                    <p className="text-xs text-[#5e5e5e] mt-0.5">Collect bill & settle table occupancy</p>
                  </div>

                  {/* Bill & Taxes Breakdown Summary Card */}
                  <div className="border border-[#e7e5e4] rounded-xl p-3.5 bg-stone-50/70 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-stone-600 font-medium">
                      <span>Subtotal</span>
                      <span className="font-mono font-semibold text-stone-900">
                        {currencySymbol}{((activeOrder ? (activeOrder.subTotal || activeOrder.totalAmount) : cartTaxCalculation.subtotalPaise) / 100).toFixed(2)}
                      </span>
                    </div>

                    {hasExclusiveTax && (
                      cartTaxCalculation.componentBreakdown.length > 0 ? (
                        cartTaxCalculation.componentBreakdown.map((comp, cIdx) => (
                          <div key={cIdx} className="flex items-center justify-between text-stone-600 text-[11px]">
                            <span>{comp.name} ({comp.rate}%)</span>
                            <span className="font-mono text-stone-900 font-medium">
                              {currencySymbol}{(comp.taxAmountPaise / 100).toFixed(2)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center justify-between text-stone-600 text-[11px]">
                          <span>Taxes & Charges (GST)</span>
                          <span className="font-mono text-stone-900 font-medium">
                            {currencySymbol}{exclusiveTaxAmount.toFixed(2)}
                          </span>
                        </div>
                      )
                    )}

                    <div className="pt-2 border-t border-[#e7e5e4] flex items-center justify-between font-bold text-stone-900 text-sm">
                      <span>Total Payable</span>
                      <span className="font-mono text-emerald-700">
                        {currencySymbol}{totalPayableAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Total Payable Card */}
                  <div className="border border-[#e7e5e4] rounded-xl overflow-hidden flex shadow-2xs">
                    <div className="flex-1 p-3.5 bg-white flex items-center">
                      <span className="text-xs font-semibold text-[#0c0a09]">Total payable amount</span>
                    </div>
                    <div className="bg-[#0c0a09] text-white px-5 py-3 flex items-center justify-center font-bold text-base font-mono">
                      {currencySymbol}{totalPayableAmount.toFixed(2)}
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
                          <label className="block text-xs font-medium text-[#5e5e5e] mb-1">Tender Amount ({currencySymbol})</label>
                          <input
                            type="number"
                            value={cashTendered}
                            onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                            className="w-full text-xs px-3 py-2 bg-white border border-[#e7e5e4] rounded-lg font-mono text-[#0c0a09] focus:outline-none focus:border-[#141010]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#5e5e5e] mb-1">Change Return ({currencySymbol})</label>
                          <input
                            type="text"
                            readOnly
                            value={`${currencySymbol} ${cashChangeReturn.toFixed(2)}`}
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
                            {currencySymbol}{amt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Card / UPI Input Section */}
                  {paymentMode !== "cash" && (
                    <div className="space-y-3 p-4 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4]">
                      <div>
                        <label className="block text-xs font-medium text-[#5e5e5e] mb-1">
                          {paymentMode === "upi"
                            ? `Tender / UPI Amount (${currencySymbol})`
                            : paymentMode === "cc"
                            ? `Tender / Credit Card Amount (${currencySymbol})`
                            : `Tender / Debit Card Amount (${currencySymbol})`}
                        </label>
                        <input
                          type="number"
                          value={nonCashTendered !== null ? nonCashTendered : totalPayableAmount}
                          onChange={(e) => setNonCashTendered(parseFloat(e.target.value) || 0)}
                          className="w-full text-xs px-3 py-2 bg-white border border-[#e7e5e4] rounded-lg font-mono text-[#0c0a09] focus:outline-none focus:border-[#141010]"
                        />
                      </div>

                      {/* Quick Exact Amount Button */}
                      <div className="flex items-center space-x-2 pt-1">
                        <button
                          onClick={() => setNonCashTendered(totalPayableAmount)}
                          className="px-3 py-1.5 text-xs bg-white hover:bg-[#f1edec] text-[#0c0a09] rounded-lg border border-[#e7e5e4] font-mono transition cursor-pointer shadow-2xs font-semibold"
                        >
                          Exact Amount ({currencySymbol}{totalPayableAmount.toFixed(2)})
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Settle Action */}
                  <div className="pt-3">
                    <button
                      onClick={handleCompletePayment}
                      className="w-full py-3.5 bg-[#059669] hover:bg-[#047857] text-white text-sm font-bold rounded-xl transition shadow-md hover:shadow-lg flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.99]"
                    >
                      <svg className="w-4 h-4 text-white shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                      </svg>
                      <span className="text-white font-bold tracking-wide">Complete Settle & Free Table</span>
                    </button>
                  </div>
                </div>
              )}
              </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Move Table Modal */}
      {isMoveTableModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-[#e7e5e4]">
            <h3 className="font-sans font-bold text-2xl text-[#0c0a09] leading-tight">Transfer Table Order</h3>
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

      {/* Item Customization Selection Modal */}
      {customizingCatalogEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 font-sans animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col border border-[#e7e5e4]">
            {/* Top Item Summary Row */}
            <div className="flex items-center justify-between gap-4">
              {/* Stepper */}
              <div className="inline-flex items-center border border-stone-800 rounded-lg bg-white overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => setCustomizationQty((prev) => Math.max(1, prev - 1))}
                  className="w-8 h-8 flex items-center justify-center text-sm font-bold text-stone-900 hover:bg-stone-100 border-r border-stone-800/20 cursor-pointer"
                >
                  -
                </button>
                <span className="w-8 text-center text-xs font-bold text-stone-900">
                  {customizationQty}
                </span>
                <button
                  type="button"
                  onClick={() => setCustomizationQty((prev) => prev + 1)}
                  className="w-8 h-8 flex items-center justify-center text-sm font-bold text-stone-900 hover:bg-stone-100 border-l border-stone-800/20 cursor-pointer"
                >
                  +
                </button>
              </div>

              {/* Item Details */}
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <span className="font-semibold text-xs sm:text-sm text-stone-900 truncate">
                  {customizingCatalogEntry.item.name}
                  {customizingCatalogEntry.item.quantityUnit && (
                    <span className="text-stone-500 font-normal ml-1">
                      ({customizingCatalogEntry.item.quantityUnit})
                    </span>
                  )}
                </span>
              </div>

              {/* Base Price */}
              <div className="text-sm font-bold text-stone-900 shrink-0 font-mono">
                {currencySymbol}
                {customizingCatalogEntry.item.price % 100 === 0
                  ? (customizingCatalogEntry.item.price / 100).toString()
                  : (customizingCatalogEntry.item.price / 100).toFixed(2)}
              </div>
            </div>

            <hr className="border-stone-200" />

            {/* Subtitle */}
            <h4 className="text-center font-bold text-xs sm:text-sm text-stone-900">
              Customise as per requirements
            </h4>

            {/* Scrollable Customization Groups & Items */}
            <div className="flex-1 overflow-y-auto space-y-5 pr-1 max-h-[50vh]">
              {customizingCatalogEntry.customizations.map((group) => {
                const gid = group.id || group._id;
                const isRequired = Boolean(
                  group.required ??
                  group.is_required ??
                  group.isRequired ??
                  (group.min_selected && group.min_selected > 0)
                );
                const isSingleChoice = (group.max_selected ?? (isRequired ? 1 : 99)) === 1;
                const selectedInGroup = selectedCustomizationOptions[gid] || [];
                const availableOptions = (group.customization_items || []).filter(
                  (ci: any) => ci.is_available !== false && ci.isAvailable !== false
                );

                return (
                  <div key={gid} className="space-y-2">
                    {/* Group Header */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900 uppercase tracking-wide">
                        {group.name}
                      </span>
                      <span className="text-[11px] text-stone-500 font-normal">
                        {isSingleChoice
                          ? isRequired
                            ? "Select any 1 (Required)"
                            : "Select any 1 (Optional)"
                          : isRequired
                          ? `Select up to ${group.max_selected || 1} (Required)`
                          : `Select up to ${group.max_selected || "any"} (Optional)`}
                      </span>
                    </div>

                    {/* Options List */}
                    <div className="space-y-2">
                      {availableOptions.map((option: any) => {
                        const oid = option.id || option._id;
                        const isSelected = selectedInGroup.some((o) => (o.id || o._id) === oid);
                        const optPrice = option.price || 0;
                        const optPriceFormatted =
                          optPrice % 100 === 0 ? (optPrice / 100).toString() : (optPrice / 100).toFixed(2);

                        return (
                          <div
                            key={oid}
                            onClick={() => handleToggleCustomizationOption(group, option)}
                            className={`w-full border rounded-xl p-3 flex items-center justify-between transition-all cursor-pointer select-none ${
                              isSelected
                                ? "border-stone-900 bg-stone-50/70 shadow-2xs"
                                : "border-stone-200 hover:border-stone-300 bg-white"
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 min-w-0 pr-3">
                              <div className="min-w-0">
                                <span
                                  className={`text-xs block truncate ${
                                    isSelected ? "font-bold text-stone-950" : "font-medium text-stone-800"
                                  }`}
                                >
                                  {option.name}
                                </span>
                                {option.description && (
                                  <p className="text-[10px] text-stone-400 mt-0.5 line-clamp-1">
                                    {option.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center space-x-3 shrink-0">
                              <span className="text-xs font-semibold text-stone-900 font-mono">
                                {optPrice > 0 ? `${currencySymbol}${optPriceFormatted}` : "Free"}
                              </span>

                              {isSingleChoice ? (
                                <div
                                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                                    isSelected ? "border-stone-900 bg-stone-900" : "border-stone-300 bg-white"
                                  }`}
                                >
                                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                              ) : (
                                <div
                                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                    isSelected ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white"
                                  }`}
                                >
                                  {isSelected && (
                                    <svg className="w-3 h-3 stroke-current" fill="none" viewBox="0 0 24 24">
                                      <path d="M5 13l4 4L19 7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Bottom CTA */}
            <div className="pt-2 border-t border-stone-200 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setCustomizingCatalogEntry(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCustomizedItem}
                className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
              >
                Confirm Customization & Add
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
