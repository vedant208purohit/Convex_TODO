"use client";

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { generateDefxReceiptPlainString } from "../utils/defxReceiptFormatter";
import { openReceiptPdfInNewTab } from "../utils/generateReceiptPdf";

// ==========================================
// TYPES
// ==========================================

interface CartItem {
  cartItemId?: string;
  itemId: Id<"items">;
  name: string;
  price: number; // in minor units (paise)
  quantity: number;
  isVeg?: boolean;
  showItemType?: boolean;
  dietaryIcon?: string;
  dietaryName?: string;
  items_item_types?: Array<{ id: string; name: string; icon?: string }>;
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
    isGst?: boolean;
    is_gst?: boolean;
    taxGroupId?: Id<"taxGroups">;
    tax_group_id?: Id<"taxGroups">;
    taxMode?: "inclusive" | "exclusive";
    tax_mode?: "inclusive" | "exclusive";
    tax_info?: any;
  }>;
}

// ==========================================
// DYNAMIC DIETARY MARK RENDERER
// ==========================================

function renderDietaryMark(_it: any) {
  // Veg / Non-Veg labels/marks disabled for items
  return null;
}

const COUNTRY_DIAL_OPTIONS = [
  { code: "+91", label: "IN +91", country: "India", iso: "IN" },
  { code: "+1", label: "US +1", country: "United States", iso: "US" },
  { code: "+971", label: "AE +971", country: "United Arab Emirates", iso: "AE" },
  { code: "+44", label: "UK +44", country: "United Kingdom", iso: "GB" },
  { code: "+33", label: "FR +33", country: "France", iso: "FR" },
  { code: "+61", label: "AU +61", country: "Australia", iso: "AU" },
  { code: "+65", label: "SG +65", country: "Singapore", iso: "SG" },
  { code: "+49", label: "DE +49", country: "Germany", iso: "DE" },
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

  if (currentCode === "+91") {
    // Standard Indian mobile number is 10 digits (can start with 6, 7, 8, 9, or 91...)
    if (digits.length === 12 && digits.startsWith("91")) {
      return `+91 ${digits.slice(2)}`;
    }
    return `+91 ${digits}`;
  } else if (currentCode === "+1") {
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+1 ${digits.slice(1)}`;
    }
    return `+1 ${digits}`;
  } else if (currentCode === "+971") {
    if (digits.length === 12 && digits.startsWith("971")) {
      return `+971 ${digits.slice(3)}`;
    }
    return `+971 ${digits}`;
  } else if (currentCode === "+44") {
    if (digits.length === 12 && digits.startsWith("44")) {
      return `+44 ${digits.slice(2)}`;
    }
    return `+44 ${digits}`;
  } else if (currentCode === "+33") {
    if (digits.length === 11 && digits.startsWith("33")) {
      return `+33 ${digits.slice(2)}`;
    }
    return `+33 ${digits}`;
  } else if (currentCode === "+61") {
    if (digits.length === 11 && digits.startsWith("61")) {
      return `+61 ${digits.slice(2)}`;
    }
    return `+61 ${digits}`;
  }

  const dialDigits = currentCode.replace(/\D/g, "");
  if (digits.startsWith(dialDigits) && digits.length > dialDigits.length + 8) {
    return `${currentCode} ${digits.slice(dialDigits.length)}`;
  }
  return `${currentCode} ${digits}`;
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
  customerCountryCode?: string;
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
// MAIN CASHIER POS CONTENT COMPONENT
// ==========================================

function CashierPosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 1. Resolve Organization
  const orgs = useQuery(api.organizations.list, {});
  const activeOrg = useMemo(() => {
    if (!orgs || orgs.length === 0) return null;
    return orgs[0];
  }, [orgs]);

  // Dynamic Country Dial Code resolved from Store Organization Country
  const defaultOrgCountryCode = useMemo(() => {
    const c = (activeOrg?.country || "").toLowerCase().trim();
    if (c === "india" || c === "in" || c === "+91") return "+91";
    if (c === "united arab emirates" || c === "uae" || c === "ae" || c === "+971") return "+971";
    if (c === "united states" || c === "usa" || c === "us" || c === "canada" || c === "ca" || c === "+1") return "+1";
    if (c === "united kingdom" || c === "uk" || c === "gb" || c === "+44") return "+44";
    if (c === "france" || c === "fr" || c === "+33") return "+33";
    if (c === "australia" || c === "au" || c === "+61") return "+61";
    if (c === "germany" || c === "de" || c === "+49") return "+49";
    if (c === "singapore" || c === "sg" || c === "+65") return "+65";
    if (c === "saudi arabia" || c === "ksa" || c === "sa" || c === "+966") return "+966";
    if (c === "qatar" || c === "qa" || c === "+974") return "+974";
    return "+91";
  }, [activeOrg?.country]);

  // 2. Query Multi-Menu Data & Categories
  const [selectedMenuId, setSelectedMenuId] = useState<string>("all");
  const menusList = useQuery(
    api.menu.listMenus,
    activeOrg ? { organizationId: activeOrg._id } : "skip",
  );
  const menuCategories = useQuery(
    api.menu.getOrganizationMenu,
    activeOrg
      ? {
          organizationId: activeOrg._id,
          allMenus: selectedMenuId === "all",
          menuId: selectedMenuId !== "all" ? (selectedMenuId as Id<"menus">) : undefined,
        }
      : "skip",
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
  // STATE MANAGEMENT WITH URL & LOCALSTORAGE PERSISTENCE
  // ==========================================

  const [isHydrated, setIsHydrated] = useState(false);

  // Step Indicator: 1: Build Order | 2: Order Details | 3: Payment
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const s = sp.get("step");
      if (s === "2") return 2;
      if (s === "3") return 3;
    }
    return 1;
  });

  // Multi-cart Tabs
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

  const [activeCartId, setActiveCartId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const c = sp.get("cart");
      if (c) return c;
    }
    return "cart-1";
  });

  const [isCartSwitcherOpen, setIsCartSwitcherOpen] = useState(false);
  const [isScheduleStatsOpen, setIsScheduleStatsOpen] = useState(false);

  // Search & Insertion State
  const [searchQuery, setSearchQuery] = useState("");
  const [inputQty, setInputQty] = useState<number>(1);
  const [selectedCategory, setSelectedCategory] = useState<string>("All Items");
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Item Customizations Selection Modal State (Defx-POS matching)
  const [customizingCatalogEntry, setCustomizingCatalogEntry] = useState<{
    item: any;
    customizations: any[];
  } | null>(null);
  const [customizationQty, setCustomizationQty] = useState<number>(1);
  const [selectedCustomizationOptions, setSelectedCustomizationOptions] = useState<
    Record<string, Array<{ id?: string; _id?: string; name: string; price: number; isGst?: boolean; items_item_types?: any[]; [key: string]: any }>>
  >({});

  // Payment Step State
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>("Cash");
  const [tenderCashGiven, setTenderCashGiven] = useState<string>("");
  const [tenderCardGiven, setTenderCardGiven] = useState<string>("");
  const [tenderUpiGiven, setTenderUpiGiven] = useState<string>("");
  const [cardAuthRef, setCardAuthRef] = useState<string>("");
  const [upiAuthRef, setUpiAuthRef] = useState<string>("");
  const [customTenderGiven, setCustomTenderGiven] = useState<string>("");
  const [customTenderRef, setCustomTenderRef] = useState<string>("");
  const [splitPart1Amount, setSplitPart1Amount] = useState<string>("");
  const [splitPart1Mode, setSplitPart1Mode] = useState<string>("Cash");
  const [splitPart2Amount, setSplitPart2Amount] = useState<string>("");
  const [splitPart2Mode, setSplitPart2Mode] = useState<string>("UPI QR");
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

  // Always purge legacy localStorage persistence on mount so cashier starts fresh
  useEffect(() => {
    try {
      localStorage.removeItem("pos_cashier_cart_tabs");
      localStorage.removeItem("pos_cashier_active_cart_id");

      const sp = new URLSearchParams(window.location.search);
      const urlStep = sp.get("step");
      const urlCart = sp.get("cart");

      if (urlStep === "2") setCurrentStep(2);
      else if (urlStep === "3") setCurrentStep(3);
      else setCurrentStep(1);

      if (urlCart) {
        setActiveCartId(urlCart);
      }
    } catch (e) {
      console.error("Error initializing cashier state", e);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Synchronize Step & URL query parameter seamlessly
  const goToStep = useCallback((step: 1 | 2 | 3, targetCartId?: string) => {
    setCurrentStep(step);
    const cId = targetCartId || activeCartId;
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (step === 1) {
        url.searchParams.delete("step");
        url.searchParams.delete("cart");
      } else {
        url.searchParams.set("step", step.toString());
        url.searchParams.set("cart", cId);
      }
      window.history.replaceState(null, "", url.toString());
    }
  }, [activeCartId]);

  const switchActiveCart = useCallback((newCartId: string) => {
    setActiveCartId(newCartId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (currentStep > 1) {
        url.searchParams.set("cart", newCartId);
        url.searchParams.set("step", currentStep.toString());
      }
      window.history.replaceState(null, "", url.toString());
    }
  }, [currentStep]);

  // Active Cart Reference
  const activeCart = useMemo(() => {
    return cartTabs.find((c) => c.id === activeCartId) || cartTabs[0];
  }, [cartTabs, activeCartId]);

  // Customer History & Stats for Cashier Details (Only queried when full 10-digit phone is entered)
  const hasCustomerPhone = Boolean(
    activeCart?.customerPhone && activeCart.customerPhone.trim().replace(/\D/g, "").length >= 10
  );
  const customerStats = useQuery(
    api.orders.getCustomerStats,
    activeOrg && hasCustomerPhone
      ? {
          organizationId: activeOrg._id,
          phone: activeCart?.customerPhone?.trim() || undefined,
        }
      : "skip",
  );

  // Extract Flat Menu Items for Search & Catalog
  const allCatalogItems = useMemo(() => {
    if (!menuCategories || menuCategories.length === 0) return [];
    const itemsList: Array<{
      categoryName: string;
      categoryId: string;
      menuName?: string;
      menuId?: string;
      item: any;
      itemImageUrl?: string;
      customizations?: any[];
    }> = [];

    for (const catEntry of menuCategories) {
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

      // Look up current catalog item to ensure latest taxMode & taxGroupId are used
      const catalogEntry = allCatalogItems.find(
        (ci) => ci.item?._id === item.itemId || ci.item?.id === item.itemId
      );
      const liveItem = catalogEntry?.item;

      // 1. Base item tax calculation
      const addonsUnitPrice = (item.customizations || []).reduce((sum, c) => sum + (c.price || 0), 0);
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

      // 2. Customizations tax calculation
      if (item.customizations && item.customizations.length > 0) {
        for (const cust of item.customizations) {
          const custUnitPrice = cust.price || 0;
          const custLineTotalPaise = custUnitPrice * item.quantity;
          if (custLineTotalPaise <= 0) continue;

          // Resolve customization details from live catalogEntry or cust object
          let custIsGst = cust.isGst ?? cust.is_gst;
          let custTaxGroupId = cust.taxGroupId ?? cust.tax_group_id;
          let custTaxMode = cust.taxMode ?? cust.tax_mode;
          let custTaxInfo: any = cust.tax_info;

          if (catalogEntry?.customizations) {
            for (const cg of catalogEntry.customizations) {
              const foundCi = (cg.customization_items || []).find(
                (ci: any) => (ci.id || ci._id) === (cust.optionId || (cust as any).id || (cust as any)._id)
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

          if (!custIsGst) continue; // Customization item is tax exempt

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
  }, [activeCart, storeTaxSettings, taxGroups, taxComponents, allCatalogItems]);

  // Backward-compatible calculation variables
  const cartSubtotalPaise = taxCalculation.subtotalPaise;
  const taxGstPaise = taxCalculation.totalTaxPaise;
  const deliveryFeePaise = taxCalculation.deliveryFeePaise;
  const totalPayablePaise = taxCalculation.totalPayablePaise;

  // Dynamic Payment Channels derived from active organization payment modes
  const activePaymentChannels = useMemo(() => {
    if (paymentModesList && paymentModesList.length > 0) {
      const channels = paymentModesList.map((m: any) => {
        const name = m.name;
        const lower = name.toLowerCase();
        let icon = (
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        );

        if (lower.includes("credit") || (lower.includes("card") && !lower.includes("debit"))) {
          icon = (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          );
        } else if (lower.includes("debit")) {
          icon = (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          );
        } else if (lower.includes("upi") || lower.includes("qr") || lower.includes("gpay") || lower.includes("phonepe") || lower.includes("paytm")) {
          icon = (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          );
        } else if (lower.includes("split")) {
          icon = (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          );
        } else {
          icon = (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          );
        }

        return {
          id: m._id || m.id,
          name: m.name,
          icon,
        };
      });

      if (!channels.some((m: any) => m.name.toLowerCase().includes("split"))) {
        channels.push({
          id: "split-payment",
          name: "Split Payment",
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          ),
        });
      }

      return channels;
    }

    return [
      {
        id: "pm_cash",
        name: "Cash",
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        ),
      },
      {
        id: "pm_credit",
        name: "Credit Card",
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        ),
      },
      {
        id: "pm_debit",
        name: "Debit Card",
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        ),
      },
      {
        id: "pm_upi",
        name: "UPI QR",
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        ),
      },
      {
        id: "pm_split",
        name: "Split Payment",
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        ),
      },
    ];
  }, [paymentModesList]);

  // Ensure selectedPaymentMode is valid for current store's active payment modes
  useEffect(() => {
    if (activePaymentChannels.length > 0) {
      const exists = activePaymentChannels.some((m: any) => m.name === selectedPaymentMode);
      if (!exists) {
        setSelectedPaymentMode(activePaymentChannels[0].name);
      }
    }
  }, [activePaymentChannels, selectedPaymentMode]);

  // Auto-fill exact cash/card/upi/split tendered when entering Step 3 Payment screen or when cart total updates
  useEffect(() => {
    if (currentStep === 3) {
      const required = (totalPayablePaise / 100).toFixed(2);
      const half1 = (Math.floor(totalPayablePaise / 2) / 100).toFixed(2);
      const half2 = ((totalPayablePaise - Math.floor(totalPayablePaise / 2)) / 100).toFixed(2);
      const lower = selectedPaymentMode.toLowerCase();

      if (lower.includes("cash")) {
        setTenderCashGiven((prev) => {
          const parsed = parseFloat(prev || "0");
          if (!prev.trim() || isNaN(parsed) || Math.round(parsed * 100) < totalPayablePaise) {
            return required;
          }
          return prev;
        });
      } else if (lower.includes("card")) {
        setTenderCardGiven((prev) => (!prev.trim() || prev === "0" ? required : prev));
      } else if (lower.includes("upi") || lower.includes("qr")) {
        setTenderUpiGiven((prev) => (!prev.trim() || prev === "0" ? required : prev));
      } else if (lower.includes("split")) {
        setSplitPart1Amount((prev) => (!prev.trim() || prev === "0" ? half1 : prev));
        setSplitPart2Amount((prev) => (!prev.trim() || prev === "0" ? half2 : prev));
      } else {
        setCustomTenderGiven((prev) => (!prev.trim() || prev === "0" ? required : prev));
      }
    }
  }, [currentStep, selectedPaymentMode, totalPayablePaise]);

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

  // Add Item to Current Cart (Standard Direct)
  const handleAddItemToCart = useCallback(
    (item: any, quantityToAdd: number = 1) => {
      if (!item || quantityToAdd <= 0) return;
      setCartTabs((prevTabs) =>
        prevTabs.map((cart) => {
          if (cart.id !== activeCartId) return cart;
          const existingIndex = cart.items.findIndex(
            (ci) => (ci.itemId === item._id || ci.itemId === item.id) && (!ci.customizations || ci.customizations.length === 0),
          );
          if (existingIndex > -1) {
            const updatedItems = [...cart.items];
            updatedItems[existingIndex].quantity += quantityToAdd;
            return { ...cart, items: updatedItems };
          } else {
            const types = item.items_item_types || item.itemTypes || item.itemsItemTypes || [];
            const primaryType = Array.isArray(types) && types.length > 0 ? types[0] : null;

            const newItem: CartItem = {
              cartItemId: `${item._id || item.id}_standard_${Date.now()}`,
              itemId: item._id || item.id,
              name: item.name,
              price: item.price,
              quantity: quantityToAdd,
              isVeg: item.isVeg ?? item.is_veg,
              showItemType: item.showItemType ?? item.show_item_type,
              dietaryIcon: primaryType?.icon,
              dietaryName: primaryType?.name,
              items_item_types: types,
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

  // Catalog Item Click - Opens Customization Modal if published customizations exist
  const handleCatalogItemClick = useCallback(
    (entry: { item: any; customizations?: any[] }, quantityToAdd: number = 1) => {
      if (!entry?.item) return;
      const rawCusts = entry.customizations || entry.item?.customizations || [];
      const activeCusts = Array.isArray(rawCusts)
        ? rawCusts.filter(
            (c: any) =>
              c.published !== false &&
              Array.isArray(c.customization_items) &&
              c.customization_items.length > 0,
          )
        : [];

      if (activeCusts.length > 0) {
        setCustomizingCatalogEntry({ item: entry.item, customizations: activeCusts });
        setCustomizationQty(quantityToAdd);
        const initialMap: Record<string, any[]> = {};
        for (const group of activeCusts) {
          const availableItems = (group.customization_items || []).filter(
            (ci: any) => ci.is_available !== false,
          );
          if (group.required && availableItems.length > 0) {
            initialMap[group.id || group._id] = [availableItems[0]];
          } else {
            initialMap[group.id || group._id] = [];
          }
        }
        setSelectedCustomizationOptions(initialMap);
      } else {
        handleAddItemToCart(entry.item, quantityToAdd);
      }
    },
    [handleAddItemToCart],
  );

  // Toggle Customization Option inside Modal
  const handleToggleCustomizationOption = (group: any, option: any) => {
    const gid = group.id || group._id;
    const maxSelected = group.max_selected ?? (group.required ? 1 : 99);
    const currentSelections = selectedCustomizationOptions[gid] || [];
    const isAlreadySelected = currentSelections.some(
      (o) => (o.id || o._id) === (option.id || option._id),
    );

    if (maxSelected === 1) {
      // Radio single-choice behavior
      if (isAlreadySelected) {
        if (!group.required) {
          // If group is optional / not required, allow toggling off (unselecting)
          setSelectedCustomizationOptions((prev) => ({
            ...prev,
            [gid]: [],
          }));
        }
      } else {
        setSelectedCustomizationOptions((prev) => ({
          ...prev,
          [gid]: [option],
        }));
      }
    } else {
      // Multi-choice behavior up to max_selected
      if (isAlreadySelected) {
        setSelectedCustomizationOptions((prev) => ({
          ...prev,
          [gid]: prev[gid]?.filter((o) => (o.id || o._id) !== (option.id || option._id)) || [],
        }));
      } else {
        if (currentSelections.length >= maxSelected) {
          showToast(`You can select at most ${maxSelected} option${maxSelected > 1 ? "s" : ""}`);
          return;
        }
        setSelectedCustomizationOptions((prev) => ({
          ...prev,
          [gid]: [...(prev[gid] || []), option],
        }));
      }
    }
  };

  // Confirm Customization Modal and Add Customized Item to Cart
  const handleConfirmCustomizationModal = useCallback(() => {
    if (!customizingCatalogEntry) return;

    const item = customizingCatalogEntry.item;
    const activeCusts = customizingCatalogEntry.customizations;

    // Validation: ensure required groups have a selection
    for (const group of activeCusts) {
      const gid = group.id || group._id;
      const selectedInGroup = selectedCustomizationOptions[gid] || [];
      if (group.required && selectedInGroup.length === 0) {
        showToast(`Please make a selection for "${group.name}"`);
        return;
      }
    }

    const flatCustomizations: Array<{
      customizationId: Id<"customizations">;
      optionId: Id<"customizationItems">;
      name: string;
      price: number;
      isGst?: boolean;
      taxGroupId?: Id<"taxGroups">;
      taxMode?: "inclusive" | "exclusive";
      tax_info?: any;
    }> = [];

    let totalAddonPaise = 0;
    for (const [groupId, options] of Object.entries(selectedCustomizationOptions)) {
      for (const opt of options) {
        flatCustomizations.push({
          customizationId: groupId as Id<"customizations">,
          optionId: (opt.id || opt._id) as Id<"customizationItems">,
          name: opt.name,
          price: opt.price || 0,
          isGst: opt.isGst ?? opt.is_gst,
          taxGroupId: opt.taxGroupId ?? opt.tax_group_id,
          taxMode: opt.taxMode ?? opt.tax_mode,
          tax_info: opt.tax_info,
        });
        totalAddonPaise += opt.price || 0;
      }
    }

    const finalUnitPrice = item.price + totalAddonPaise;
    const types = item.items_item_types || item.itemTypes || item.itemsItemTypes || [];
    const primaryType = Array.isArray(types) && types.length > 0 ? types[0] : null;

    const custKey = flatCustomizations
      .map((c) => `${c.customizationId}_${c.optionId}`)
      .sort()
      .join("|");

    const newItem: CartItem = {
      cartItemId: `${item._id || item.id}_${custKey}_${Date.now()}`,
      itemId: item._id || item.id,
      name: item.name,
      price: finalUnitPrice,
      quantity: customizationQty,
      isVeg: item.isVeg ?? item.is_veg,
      showItemType: item.showItemType ?? item.show_item_type,
      dietaryIcon: primaryType?.icon,
      dietaryName: primaryType?.name,
      items_item_types: types,
      unit: item.quantityUnit || (item.servingSize ? `${item.servingSize}` : "1 pc"),
      description: item.description,
      isGst: item.isGst ?? item.is_gst ?? true,
      taxGroupId: item.taxGroupId || item.tax_group_id,
      taxMode: item.taxMode || item.tax_mode,
      customizations: flatCustomizations,
    };

    setCartTabs((prevTabs) =>
      prevTabs.map((cart) => {
        if (cart.id !== activeCartId) return cart;
        const existingIndex = cart.items.findIndex(
          (ci) =>
            (ci.itemId === item._id || ci.itemId === item.id) &&
            (ci.customizations || [])
              .map((c) => `${c.customizationId}_${c.optionId}`)
              .sort()
              .join("|") === custKey,
        );

        if (existingIndex > -1) {
          const updatedItems = [...cart.items];
          updatedItems[existingIndex].quantity += customizationQty;
          return { ...cart, items: updatedItems };
        } else {
          return { ...cart, items: [...cart.items, newItem] };
        }
      }),
    );

    showToast(`Added ${customizationQty}x ${item.name} to ${activeCart.label}`);
    setCustomizingCatalogEntry(null);
  }, [customizingCatalogEntry, selectedCustomizationOptions, customizationQty, activeCartId, activeCart]);

  // Modify Quantity
  const handleUpdateItemQuantity = (cartItemKey: string, newQty: number) => {
    setCartTabs((prevTabs) =>
      prevTabs.map((cart) => {
        if (cart.id !== activeCartId) return cart;
        if (newQty <= 0) {
          return {
            ...cart,
            items: cart.items.filter(
              (ci) => ci.cartItemId !== cartItemKey && (ci.itemId as unknown as string) !== cartItemKey,
            ),
          };
        }
        return {
          ...cart,
          items: cart.items.map((ci) =>
            ci.cartItemId === cartItemKey || (ci.itemId as unknown as string) === cartItemKey
              ? { ...ci, quantity: newQty }
              : ci,
          ),
        };
      }),
    );
  };

  // Remove Item
  const handleRemoveItem = (cartItemKey: string) => {
    setCartTabs((prevTabs) =>
      prevTabs.map((cart) => {
        if (cart.id !== activeCartId) return cart;
        return {
          ...cart,
          items: cart.items.filter(
            (ci) => ci.cartItemId !== cartItemKey && (ci.itemId as unknown as string) !== cartItemKey,
          ),
        };
      }),
    );
  };

  // Clear Entire Active Cart & Reset All Associated Order Details
  const handleClearCart = useCallback(() => {
    setCartTabs((prevTabs) =>
      prevTabs.map((cart) => {
        if (cart.id !== activeCartId) return cart;
        return {
          id: cart.id,
          label: cart.label,
          items: [],
          orderType: "DineIn",
          isTableRequired: false,
          guestCount: 2,
          customerFirstName: "",
          customerLastName: "",
          customerName: "",
          customerCountryCode: defaultOrgCountryCode,
          customerPhone: "",
          customerEmail: "",
          specialNotes: "",
          tableId: undefined,
          tableName: undefined,
          waiterId: undefined,
          waiterName: undefined,
          deliveryAddress: undefined,
          deliveryInstructions: undefined,
          scheduledDate: undefined,
          scheduledTime: undefined,
        };
      }),
    );
    setTenderCashGiven("");
    setTenderCardGiven("");
    setTenderUpiGiven("");
    setCardAuthRef("");
    setUpiAuthRef("");
    setCustomTenderGiven("");
    setCustomTenderRef("");
    setSplitPart1Amount("");
    setSplitPart2Amount("");
    setSearchQuery("");
  }, [activeCartId, defaultOrgCountryCode]);

  // Complete Reset of Active Cart & Modal for a Brand New Order
  const handleResetToNewOrder = useCallback(() => {
    handleClearCart();
    setCompletedOrderData(null);
    goToStep(1);
  }, [handleClearCart, goToStep]);

  // Matched customer profile for active cart
  const matchedCustomer = useMemo(() => {
    if (!customersList || !activeCart?.customerPhone) return null;
    const cleanPhone = activeCart.customerPhone.replace(/\D/g, "");
    if (cleanPhone.length < 10) return null;
    return (
      customersList.find((u) => {
        const uPhone = (u.phone || "").replace(/\D/g, "");
        return uPhone && (uPhone.endsWith(cleanPhone) || cleanPhone.endsWith(uPhone));
      }) || null
    );
  }, [customersList, activeCart?.customerPhone]);

  // Handle phone input change with auto-lookup & dynamic country code detection
  const handleCustomerPhoneChange = (phoneVal: string) => {
    let updatedCode: string | undefined = undefined;
    let localDigits = phoneVal;

    // Check if user pasted number with country code like +91 98250...
    for (const opt of COUNTRY_DIAL_OPTIONS) {
      if (phoneVal.startsWith(opt.code)) {
        updatedCode = opt.code;
        localDigits = phoneVal.slice(opt.code.length).trim();
        break;
      }
    }

    const cleanDigits = localDigits.replace(/\D/g, "");
    const match =
      cleanDigits.length >= 10 && customersList
        ? customersList.find((u) => {
            const uPhone = (u.phone || "").replace(/\D/g, "");
            return uPhone && (uPhone.endsWith(cleanDigits) || cleanDigits.endsWith(uPhone));
          })
        : null;

    setCartTabs((prev) =>
      prev.map((c) => {
        if (c.id !== activeCartId) return c;
        const currentCode = updatedCode || c.customerCountryCode || defaultOrgCountryCode;
        if (match) {
          const first = match.firstName || c.customerFirstName || "";
          const last = match.lastName || c.customerLastName || "";
          let matchCode = currentCode;
          let matchPhone = localDigits;
          if (match.phone) {
            for (const opt of COUNTRY_DIAL_OPTIONS) {
              if (match.phone.startsWith(opt.code)) {
                matchCode = opt.code;
                matchPhone = match.phone.slice(opt.code.length).trim();
                break;
              }
            }
          }
          return {
            ...c,
            customerCountryCode: matchCode,
            customerPhone: localDigits || matchPhone,
            customerFirstName: first,
            customerLastName: last,
            customerName: `${first} ${last}`.trim(),
            customerEmail: match.email || c.customerEmail || "",
          };
        }
        return {
          ...c,
          customerCountryCode: currentCode,
          customerPhone: localDigits,
        };
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
      customerCountryCode: defaultOrgCountryCode,
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

    const lowerMode = selectedPaymentMode.toLowerCase();
    if (lowerMode.includes("cash")) {
      const cashStr = tenderCashGiven.trim() || (totalPayablePaise / 100).toFixed(2);
      const given = parseFloat(cashStr);
      const required = totalPayablePaise / 100;
      if (isNaN(given) || given <= 0) {
        showToast("Please enter a valid cash tendered amount.");
        return;
      }
      if (Math.round(given * 100) < totalPayablePaise) {
        showToast(
          `Insufficient cash tendered (${taxCalculation.currencySymbol}${given.toFixed(2)}). Total payable is ${taxCalculation.currencySymbol}${required.toFixed(2)}.`
        );
        return;
      }
    } else if (lowerMode.includes("card")) {
      const cardStr = tenderCardGiven.trim() || (totalPayablePaise / 100).toFixed(2);
      const given = parseFloat(cardStr);
      if (isNaN(given) || given <= 0) {
        showToast("Please enter a valid card charge amount.");
        return;
      }
    } else if (lowerMode.includes("upi") || lowerMode.includes("qr")) {
      const upiStr = tenderUpiGiven.trim() || (totalPayablePaise / 100).toFixed(2);
      const given = parseFloat(upiStr);
      if (isNaN(given) || given <= 0) {
        showToast("Please enter a valid UPI amount.");
        return;
      }
    } else if (lowerMode.includes("split")) {
      const p1 = parseFloat(splitPart1Amount.trim() || "0");
      const p2 = parseFloat(splitPart2Amount.trim() || "0");
      if (isNaN(p1) || p1 <= 0 || isNaN(p2) || p2 <= 0) {
        showToast("Both split payment amounts must be greater than zero.");
        return;
      }
      const totalSplitPaise = Math.round((p1 + p2) * 100);
      if (totalSplitPaise !== totalPayablePaise) {
        showToast(
          `Split amounts total (${taxCalculation.currencySymbol}${(totalSplitPaise / 100).toFixed(2)}) must equal payable total (${taxCalculation.currencySymbol}${(totalPayablePaise / 100).toFixed(2)}).`
        );
        return;
      }
    } else {
      const customStr = customTenderGiven.trim() || (totalPayablePaise / 100).toFixed(2);
      const given = parseFloat(customStr);
      if (isNaN(given) || given <= 0) {
        showToast(`Please enter a valid amount for ${selectedPaymentMode}.`);
        return;
      }
    }

    try {
      setIsProcessingOrder(true);

      const itemsPayload = activeCart.items.map((ci) => ({
        itemId: ci.itemId,
        quantity: ci.quantity,
        customizations:
          ci.customizations && ci.customizations.length > 0
            ? ci.customizations.map((c) => ({
                customizationId: c.customizationId,
                optionId: c.optionId,
              }))
            : undefined,
      }));

      const tableObj = tables?.find((t) => t._id === activeCart.tableId);

      const firstName = activeCart.customerFirstName?.trim() || "Guest";
      const lastName = activeCart.customerLastName?.trim() || "Customer";
      const resolvedCustomerName =
        activeCart.customerName?.trim() ||
        (activeCart.customerFirstName?.trim()
          ? `${activeCart.customerFirstName.trim()} ${activeCart.customerLastName?.trim() || ""}`.trim()
          : `${firstName} ${lastName}`);

      let resolvedNotes = activeCart.specialNotes || "";
      if (activeCart.orderType === "Delivery") {
        if (activeCart.deliveryInstructions) {
          resolvedNotes = resolvedNotes
            ? `[Delivery Note: ${activeCart.deliveryInstructions}] ${resolvedNotes}`
            : `[Delivery Note: ${activeCart.deliveryInstructions}]`;
        }
      } else if (activeCart.orderType === "Scheduled") {
        const sDate = activeCart.scheduledDate || "Today";
        const sTime = activeCart.scheduledTime || "Standard Slot";
        resolvedNotes = resolvedNotes
          ? `[Scheduled Pickup: ${sDate} @ ${sTime}] ${resolvedNotes}`
          : `[Scheduled Pickup: ${sDate} @ ${sTime}]`;
      }

      if (
        customTenderRef.trim() &&
        !lowerMode.includes("cash") &&
        !lowerMode.includes("card") &&
        !lowerMode.includes("upi") &&
        !lowerMode.includes("qr") &&
        !lowerMode.includes("split")
      ) {
        resolvedNotes = resolvedNotes
          ? `[${selectedPaymentMode} Ref: ${customTenderRef.trim()}] ${resolvedNotes}`
          : `[${selectedPaymentMode} Ref: ${customTenderRef.trim()}]`;
      }

      const resolvedOrderType =
        activeCart.orderType === "Scheduled"
          ? "ScheduledPickup"
          : activeCart.orderType;

      // Build full international phone number with dynamic country dial code
      // Auto-generate unique non-repeating 10-digit series starting with 90 if customer phone is not provided
      const currentDial = activeCart.customerCountryCode || defaultOrgCountryCode || "+91";
      let rawPhone = activeCart.customerPhone?.trim();
      if (!rawPhone) {
        const timeSlice = (Date.now() % 1000000).toString().padStart(6, "0");
        const randomSeed = Math.floor(10 + Math.random() * 90).toString();
        rawPhone = `90${timeSlice}${randomSeed}`;
      }
      const resolvedCustomerPhone = formatPhoneNumberWithCountryCode(rawPhone, currentDial);

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
        customerPhone: resolvedCustomerPhone,
        customerEmail: activeCart.customerEmail || undefined,
        deliveryCharge:
          activeCart.orderType === "Delivery"
            ? 5800
            : undefined,
        deliveryAddress:
          activeCart.orderType === "Delivery"
            ? activeCart.deliveryAddress || {
                addressLine1: "34, Example Street, Near Sunshine Heights, Bandra West",
                landmark: "Opposite Lotus Park",
                city: "Mumbai",
                zipCode: "400001",
                addressType: "Home",
              }
            : undefined,
        specialNotes: resolvedNotes || undefined,
        orderSource: "Prest-Cashier",
        paymentMode: selectedPaymentMode,
        items: itemsPayload,
      });

      const itemsSnapshot = activeCart.items.map((ci) => {
        const itemRate = ci.price;
        const itemQty = ci.quantity || 1;
        const lineTotal = itemRate * itemQty;
        return {
          itemId: ci.itemId,
          itemName: ci.name,
          name: ci.name,
          itemPrice: itemRate,
          price: itemRate,
          display_item_price: (itemRate / 100).toFixed(2),
          quantity: itemQty,
          totalPrice: lineTotal,
          display_total_price: (lineTotal / 100).toFixed(2),
          customizations: ci.customizations?.map((c) => ({
            optionName: c.name,
            name: c.name,
          })),
        };
      });

      setCompletedOrderData({
        ...res,
        _id: res.orderId,
        orderId: res.orderId,
        orderNumber: res.orderNumber,
        tokenNumber: res.tokenNumber,
        orderType: resolvedOrderType,
        orderSource: "Prest-Cashier",
        customerName: resolvedCustomerName,
        customerPhone: resolvedCustomerPhone,
        customerEmail: activeCart.customerEmail || undefined,
        paymentMode: selectedPaymentMode,
        paymentStatus: "Paid",
        tableName: tableObj?.tableNumber,
        table: tableObj ? { number: tableObj.tableNumber } : undefined,
        subTotal: cartSubtotalPaise,
        taxTotal: taxGstPaise,
        deliveryCharge: deliveryFeePaise,
        totalAmount: totalPayablePaise,
        display_sub_total: (cartSubtotalPaise / 100).toFixed(2),
        display_tax_total: (taxGstPaise / 100).toFixed(2),
        display_discount_amount: "0.00",
        display_total_amount: (totalPayablePaise / 100).toFixed(2),
        taxInfoSnapshot: {
          tax_mode: taxCalculation.taxExclusivePaise > 0 ? "exclusive" : "inclusive",
          tax_amount: (taxGstPaise / 100).toFixed(2),
          components: taxCalculation.componentBreakdown.map((c) => ({
            name: c.name,
            rate: c.rate,
            amount: (c.taxAmountPaise / 100).toFixed(2),
          })),
        },
        items: itemsSnapshot,
        createdAt: Date.now(),
      });

      // Clear the current cart
      handleClearCart();
      setTenderCashGiven("");
      setTenderCardGiven("");
      setTenderUpiGiven("");
      setCardAuthRef("");
      setUpiAuthRef("");
      setCustomTenderGiven("");
      setCustomTenderRef("");
      setSplitPart1Amount("");
      setSplitPart2Amount("");
      goToStep(1);
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
    tenderCashGiven,
    tenderCardGiven,
    tenderUpiGiven,
    cardAuthRef,
    upiAuthRef,
    customTenderGiven,
    customTenderRef,
    splitPart1Amount,
    splitPart2Amount,
    defaultOrgCountryCode,
    totalPayablePaise,
    cartSubtotalPaise,
    taxGstPaise,
    deliveryFeePaise,
    taxCalculation,
    goToStep,
    handleClearCart,
  ]);

  // Primary Action (Order / Next Step / Settle) triggered by F5 or UI button
  const handlePrimaryStepAdvance = useCallback(() => {
    if (completedOrderData) {
      handleResetToNewOrder();
      return;
    }
    if (currentStep === 1) {
      if (activeCart.items.length > 0) {
        goToStep(2);
      } else {
        showToast("Please add items to cart before proceeding");
      }
    } else if (currentStep === 2) {
      goToStep(3);
    } else if (currentStep === 3) {
      handleCompleteOrder();
    }
  }, [currentStep, activeCart.items.length, completedOrderData, handleCompleteOrder, handleResetToNewOrder, goToStep]);

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
                goToStep((currentStep - 1) as 1 | 2);
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
            onClick={() => goToStep(1)}
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
              if (activeCart.items.length > 0) goToStep(2);
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
              if (activeCart.items.length > 0) goToStep(3);
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
                        onClick={() => switchActiveCart(c.id)}
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
                      key={cartItem.cartItemId || cartItem.itemId}
                      className="grid grid-cols-12 items-center px-2 py-3 hover:bg-[#fdf8f7]/40 rounded-lg transition-colors group"
                    >
                      {/* Item Name & Dietary Indicator */}
                      <div className="col-span-5 pr-1 flex items-start space-x-2">
                        {renderDietaryMark(cartItem)}
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-[#141010] leading-snug">
                            {cartItem.name}
                          </span>
                          <span className="text-[11px] text-[#8a7e75] font-light">
                            {cartItem.unit}
                          </span>
                          {cartItem.customizations && cartItem.customizations.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {cartItem.customizations.map((c, cIdx) => (
                                <span
                                  key={cIdx}
                                  className="text-[10px] bg-[#f1edec] text-[#141010] px-1.5 py-0.5 rounded font-normal"
                                >
                                  + {c.name || "Add-on"}{" "}
                                  {c.price ? `(+${taxCalculation.currencySymbol}${(c.price / 100).toFixed(2)})` : ""}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Unit Price */}
                      <div className="col-span-2 text-right text-xs text-[#5e5e5e] font-mono">
                        {taxCalculation.currencySymbol}{unitPrice}
                      </div>

                      {/* Quantity Stepper [- qty +] */}
                      <div className="col-span-3 flex justify-center">
                        <div className="inline-flex items-center border border-[#e7e5e4] rounded-md bg-white shadow-2xs">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateItemQuantity(
                                cartItem.cartItemId || cartItem.itemId,
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
                                cartItem.cartItemId || cartItem.itemId,
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
                          {taxCalculation.currencySymbol}{lineTotal}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(cartItem.cartItemId || cartItem.itemId)}
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

                {/* Dynamic Multi-Component Split Tax Lines (Exclusive Taxes Only) */}
                {taxCalculation.componentBreakdown.map((comp, cIdx) => (
                  <div
                    key={`${comp.name}_${comp.rate}_${cIdx}`}
                    className="flex justify-between text-[#8a7e75] text-[11px]"
                  >
                    <span>
                      {comp.name} ({comp.rate}%)
                    </span>
                    <span className="font-mono text-stone-700">
                      {taxCalculation.currencySymbol}{(comp.taxAmountPaise / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
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
                  onClick={() => goToStep(2)}
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
            {/* Top Menu Switcher & Search Area */}
            <div className="p-3.5 border-b border-[#e7e5e4] bg-white flex flex-col gap-2.5 relative z-20">
              {menusList && menusList.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <div className="flex flex-wrap items-center gap-1 bg-[#f5f5f4] p-0.5 rounded-lg border border-[#e7e5e4]">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMenuId("all");
                        setSelectedCategory("All Items");
                      }}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
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
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
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
                </div>
              )}
              <div className="flex items-center gap-3">
                {/* Search Input with Clear Button and Dropdown Icon */}
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8a7e75]">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <input
                    ref={searchInputRef}
                    className="w-full pl-8 pr-8 py-2 text-xs border border-[#141010] rounded-lg focus:ring-1 focus:ring-[#141010] focus:border-[#141010] font-medium text-[#141010] placeholder-[#a8a29e] bg-white shadow-2xs focus:outline-none"
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
                            handleCatalogItemClick(selectedMatch, inputQty);
                            setIsAutocompleteOpen(false);
                            setSearchQuery("");
                          }
                        }
                      } else if (e.key === "Enter") {
                        if (filteredCatalogItems.length > 0) {
                          handleCatalogItemClick(
                            filteredCatalogItems[0],
                            inputQty,
                          );
                          setSearchQuery("");
                        }
                      }
                    }}
                  />
                  {/* Clear Button */}
                  {searchQuery && (
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
                      handleCatalogItemClick(
                        autocompleteMatches[highlightedIndex || 0],
                        inputQty,
                      );
                      setSearchQuery("");
                      setIsAutocompleteOpen(false);
                    } else if (filteredCatalogItems.length > 0) {
                      handleCatalogItemClick(
                        filteredCatalogItems[0],
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
                            handleCatalogItemClick(entry, inputQty);
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
                            {renderDietaryMark(entry.item)}
                            <span
                              className={`text-xs ${
                                isHighlighted
                                  ? "font-medium text-[#141010]"
                                  : "font-normal text-[#141010]"
                              }`}
                            >
                              {entry.item.name}
                            </span>
                            {entry.menuName && selectedMenuId === "all" && menusList && menusList.length > 1 && (
                              <span className="text-[10px] bg-stone-100 text-stone-600 border border-[#e7e5e4] px-1.5 py-0.5 rounded font-normal">
                                {entry.menuName}
                              </span>
                            )}
                            <span className="text-[10px] bg-white border border-[#e7e5e4] px-1.5 py-0.5 rounded text-[#5e5e5e]">
                              {entry.categoryName}
                            </span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="font-mono font-semibold text-[#141010]">
                              {taxCalculation.currencySymbol}{priceFormatted}
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
                  {selectedCategory === "All Items"
                    ? "No menu items found in this menu."
                    : `No menu items found in ${selectedCategory}.`}
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
                            onClick={() => handleCatalogItemClick(entry, 1)}
                            className="w-6 h-6 flex items-center justify-center text-sm font-medium text-[#141010] hover:bg-neutral-100 rounded-r border-l border-[#141010]/30 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Menu Item Details */}
                      <div
                        className="flex-1 px-4 flex items-center space-x-2.5 cursor-pointer"
                        onClick={() => handleCatalogItemClick(entry, 1)}
                      >
                        {renderDietaryMark(it)}
                        <span className="text-xs font-medium text-[#141010]">
                          {it.name}
                        </span>
                        {entry.menuName && selectedMenuId === "all" && menusList && menusList.length > 1 && (
                          <span className="text-[10px] text-stone-500 bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded font-normal">
                            {entry.menuName}
                          </span>
                        )}
                        {it.quantityUnit && (
                          <span className="text-[11px] text-[#8a7e75]">
                            ({it.quantityUnit})
                          </span>
                        )}
                        {entry.customizations &&
                          entry.customizations.filter(
                            (c: any) =>
                              c.published !== false &&
                              Array.isArray(c.customization_items) &&
                              c.customization_items.length > 0,
                          ).length > 0 && (
                            <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-normal">
                              Customise
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
                        {taxCalculation.currencySymbol}{priceFormatted}
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
                                        switchActiveCart(ct.id);
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
                                        {count} items • {taxCalculation.currencySymbol}{(total / 100).toFixed(2)}
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
                      <li key={(item.cartItemId || item.itemId) + "_" + idx} className="flex items-start justify-between">
                        <div className="flex items-start space-x-2.5">
                          {renderDietaryMark(item)}
                          <div>
                            <div className="font-medium text-stone-900 leading-tight">{item.name}</div>
                            {item.customizations && item.customizations.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {item.customizations.map((c, cIdx) => (
                                  <span
                                    key={cIdx}
                                    className="text-[10px] bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded font-normal"
                                  >
                                    + {c.name || "Add-on"}{" "}
                                    {c.price ? `(+${taxCalculation.currencySymbol}${(c.price / 100).toFixed(2)})` : ""}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="text-xs text-stone-400 mt-0.5">
                              Qty: {item.quantity} × {taxCalculation.currencySymbol}{(item.price / 100).toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <span className="font-medium text-stone-900 shrink-0">
                          {taxCalculation.currencySymbol}{((item.price * item.quantity) / 100).toFixed(2)}
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

                    {/* Dynamic Split Tax Component Breakdown (Exclusive Taxes Only) */}
                    {taxCalculation.componentBreakdown.map((comp, cIdx) => (
                      <div
                        key={`step2_${comp.name}_${comp.rate}_${cIdx}`}
                        className="flex justify-between text-stone-500"
                      >
                        <span>
                          {comp.name} ({comp.rate}%)
                        </span>
                        <span className="font-medium text-stone-900">
                          {taxCalculation.currencySymbol}{(comp.taxAmountPaise / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}

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
                      onClick={() => goToStep(1)}
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
                        FIRST NAME <span className="font-normal text-stone-400">(OPTIONAL)</span>
                      </label>
                      <input
                        id="first-name"
                        className="w-full text-sm border border-stone-200 rounded-lg px-3.5 py-2.5 text-stone-900 font-medium focus:ring-1 focus:ring-stone-900 focus:border-stone-900 focus:outline-none bg-white placeholder:text-stone-300 placeholder:font-normal placeholder:italic"
                        type="text"
                        placeholder="Enter first name..."
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
                        LAST NAME <span className="font-normal text-stone-400">(OPTIONAL)</span>
                      </label>
                      <input
                        id="last-name"
                        className="w-full text-sm border border-stone-200 rounded-lg px-3.5 py-2.5 text-stone-900 font-medium focus:ring-1 focus:ring-stone-900 focus:border-stone-900 focus:outline-none bg-white placeholder:text-stone-300 placeholder:font-normal placeholder:italic"
                        type="text"
                        placeholder="Enter last name..."
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
                        PHONE NUMBER <span className="font-normal text-stone-400">(OPTIONAL)</span>
                      </label>
                      <div className="flex rounded-lg shadow-sm border border-stone-200 overflow-hidden focus-within:ring-1 focus-within:ring-stone-900 focus-within:border-stone-900 bg-white">
                        {/* Dynamic Country Selector */}
                        <div className="relative flex items-center bg-stone-50 border-r border-stone-200">
                          <select
                            value={activeCart.customerCountryCode || defaultOrgCountryCode}
                            onChange={(e) => {
                              const newCode = e.target.value;
                              setCartTabs((prev) =>
                                prev.map((c) =>
                                  c.id === activeCartId ? { ...c, customerCountryCode: newCode } : c
                                )
                              );
                            }}
                            className="appearance-none bg-transparent h-full pl-3 pr-7 py-2.5 text-xs font-semibold text-stone-800 focus:outline-none cursor-pointer flex items-center"
                          >
                            {COUNTRY_DIAL_OPTIONS.map((opt) => (
                              <option key={opt.code} value={opt.code} className="text-stone-900">
                                {opt.iso} {opt.code}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute right-2 flex items-center text-stone-400">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                            </svg>
                          </div>
                        </div>
                        <input
                          id="phone-number"
                          className="flex-1 min-w-0 block w-full px-3.5 py-2.5 text-sm text-stone-900 font-medium focus:outline-none bg-white placeholder:text-stone-300 placeholder:font-normal placeholder:italic"
                          type="tel"
                          placeholder="Enter 10-digit mobile number..."
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
                        className="w-full text-sm border border-stone-200 rounded-lg px-3.5 py-2.5 text-stone-900 font-medium focus:ring-1 focus:ring-stone-900 focus:border-stone-900 focus:outline-none bg-white placeholder:text-stone-300 placeholder:font-normal placeholder:italic"
                        type="email"
                        placeholder="Enter email address..."
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

                      {/* Delivery (Disabled / Coming Soon) */}
                      <button
                        type="button"
                        disabled
                        className="relative flex items-center justify-center space-x-1.5 py-3 px-3.5 rounded-xl font-medium text-xs bg-stone-100/75 border border-dashed border-stone-300 text-stone-400 cursor-not-allowed select-none opacity-75"
                        title="Delivery service mode is coming soon"
                      >
                        <svg
                          className="w-4 h-4 text-stone-400 shrink-0"
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
                        <span className="text-stone-500 font-medium">Delivery</span>
                        <span className="text-[9px] font-semibold uppercase tracking-wider bg-stone-200/80 text-stone-500 px-1.5 py-0.5 rounded-full ml-1 border border-stone-300/60 shrink-0">
                          Soon
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
                          Scheduled pickup
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
                              Kitchen Order Ticket (KOT) will route{" "}
                              <strong>
                                {activeCart.tableName
                                  ? (/^table\b/i.test(activeCart.tableName.trim())
                                      ? activeCart.tableName.trim()
                                      : `Table ${activeCart.tableName.trim()}`)
                                  : "assigned table"}
                              </strong>{" "}
                              straight to the <strong>Main Kitchen KDS Display</strong>.
                            </span>
                          </div>
                        </div>
                      )}
                    </>
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
                                {activeCart.customerPhone
                                  ? `${activeCart.customerCountryCode || defaultOrgCountryCode} ${activeCart.customerPhone}`
                                  : "Not provided"}
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

                  {/* STATE D: SCHEDULED PICKUP CONTAINER */}
                  {activeCart.orderType === "Scheduled" && (
                    <div className="mt-6 border border-stone-200 rounded-xl p-5 bg-white space-y-4" data-purpose="scheduled-pickup-config">
                      <div>
                        <label className="block text-xs font-semibold text-stone-900 mb-2">
                          Set pickup date &amp; time
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Select Date */}
                          <div className="relative">
                            <select
                              value={activeCart.scheduledDate || ""}
                              onChange={(e) =>
                                setCartTabs((prev) =>
                                  prev.map((c) =>
                                    c.id === activeCartId
                                      ? { ...c, scheduledDate: e.target.value }
                                      : c,
                                  ),
                                )
                              }
                              className="w-full bg-white border border-stone-300 hover:border-stone-400 rounded-md px-3.5 py-2.5 text-xs text-stone-900 font-medium focus:border-stone-900 focus:ring-1 focus:ring-stone-900 focus:outline-none appearance-none cursor-pointer pr-10"
                            >
                              <option value="">Select date</option>
                              {Array.from({ length: 7 }).map((_, idx) => {
                                const d = new Date();
                                d.setDate(d.getDate() + idx);
                                const label =
                                  idx === 0
                                    ? `Today (${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`
                                    : idx === 1
                                    ? `Tomorrow (${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`
                                    : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                                const val = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
                                return (
                                  <option key={val} value={val}>
                                    {label}
                                  </option>
                                );
                              })}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                              </svg>
                            </div>
                          </div>

                          {/* Select Time */}
                          <div className="relative">
                            <select
                              value={activeCart.scheduledTime || ""}
                              onChange={(e) =>
                                setCartTabs((prev) =>
                                  prev.map((c) =>
                                    c.id === activeCartId
                                      ? { ...c, scheduledTime: e.target.value }
                                      : c,
                                  ),
                                )
                              }
                              className="w-full bg-white border border-stone-300 hover:border-stone-400 rounded-md px-3.5 py-2.5 text-xs text-stone-900 font-medium focus:border-stone-900 focus:ring-1 focus:ring-stone-900 focus:outline-none appearance-none cursor-pointer pr-10"
                            >
                              <option value="">Select time</option>
                              <option value="10:00 AM - 10:30 AM">10:00 AM - 10:30 AM</option>
                              <option value="10:30 AM - 11:00 AM">10:30 AM - 11:00 AM</option>
                              <option value="11:00 AM - 11:30 AM">11:00 AM - 11:30 AM</option>
                              <option value="11:30 AM - 12:00 PM">11:30 AM - 12:00 PM</option>
                              <option value="12:00 PM - 12:30 PM">12:00 PM - 12:30 PM</option>
                              <option value="12:30 PM - 01:00 PM">12:30 PM - 01:00 PM</option>
                              <option value="01:00 PM - 01:30 PM">01:00 PM - 01:30 PM</option>
                              <option value="01:30 PM - 02:00 PM">01:30 PM - 02:00 PM</option>
                              <option value="02:00 PM - 02:30 PM">02:00 PM - 02:30 PM</option>
                              <option value="02:30 PM - 03:00 PM">02:30 PM - 03:00 PM</option>
                              <option value="06:30 PM - 07:00 PM">06:30 PM - 07:00 PM</option>
                              <option value="07:00 PM - 07:30 PM">07:00 PM - 07:30 PM</option>
                              <option value="07:30 PM - 08:00 PM">07:30 PM - 08:00 PM</option>
                              <option value="08:00 PM - 08:30 PM">08:00 PM - 08:30 PM</option>
                              <option value="08:30 PM - 09:00 PM">08:30 PM - 09:00 PM</option>
                              <option value="09:00 PM - 09:30 PM">09:00 PM - 09:30 PM</option>
                              <option value="09:30 PM - 10:00 PM">09:30 PM - 10:00 PM</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Universal Customer Stats Section (Shown for DineIn, TakeAway, Delivery, and Scheduled) */}
                  <div className="mt-6 border border-stone-200 rounded-md overflow-hidden bg-stone-50/50">
                    <button
                      type="button"
                      onClick={() => setIsScheduleStatsOpen(!isScheduleStatsOpen)}
                      className="w-full flex items-center space-x-2 px-4 py-3 text-xs font-semibold text-stone-900 hover:bg-stone-100/70 transition cursor-pointer"
                    >
                      <svg
                        className={`w-3.5 h-3.5 text-stone-600 transition-transform ${isScheduleStatsOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                      <span>Stats</span>
                    </button>
                    {isScheduleStatsOpen && (
                      <div className="p-4 border-t border-stone-200 bg-white space-y-3">
                        {/* Customer Metrics Summary Card */}
                        <div className="border border-stone-200 rounded-lg p-5 bg-white grid grid-cols-3 text-center">
                          <div>
                            <span className="text-xs font-medium text-stone-700 block">Dine in orders</span>
                            <span className="text-base font-bold text-stone-950 mt-1.5 block">
                              {customerStats?.dineInCount !== undefined ? customerStats.dineInCount : 0}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-stone-700 block">Take away orders</span>
                            <span className="text-base font-bold text-stone-950 mt-1.5 block">
                              {customerStats?.takeawayCount !== undefined ? customerStats.takeawayCount : 0}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-stone-700 block">Total spends</span>
                            <span className="text-base font-bold text-stone-950 mt-1.5 block">
                              {customerStats
                                ? `${taxCalculation.currencySymbol}${(customerStats.totalSpends / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : `${taxCalculation.currencySymbol}0.00`}
                            </span>
                          </div>
                        </div>

                        {/* Customer Recent Orders List */}
                        {customerStats?.recentOrders && customerStats.recentOrders.length > 0 ? (
                          customerStats.recentOrders.map((ord, idx) => (
                            <div key={ord._id || idx} className="border border-stone-200 rounded-lg p-4 bg-white">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-stone-500 font-medium">Created date</span>
                                <Link
                                  href={`/orders/${ord.orderNumber || ord._id}`}
                                  className="text-xs font-semibold text-stone-900 hover:underline"
                                  target="_blank"
                                >
                                  View order
                                </Link>
                              </div>
                              <span className="text-xs text-stone-700 font-normal block mt-0.5">
                                {`${new Date(ord.createdAt).toLocaleDateString("en-GB")} ${new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`}
                              </span>
                              <p className="text-xs font-semibold text-stone-950 mt-2">
                                {ord.itemsSummary}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4 text-xs text-stone-400 font-medium bg-stone-50/60 rounded-lg border border-dashed border-stone-200">
                            No previous orders found for this customer.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Universal Special Notes / Kitchen Preparation Notes */}
                  <div className="mt-6 border border-stone-200 rounded-xl p-5 bg-white">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Special Notes / Kitchen Instructions (Optional)
                    </label>
                    <textarea
                      className="w-full text-xs border border-stone-200 rounded-lg p-3 text-stone-900 placeholder-stone-400 font-normal focus:ring-1 focus:ring-stone-900 focus:border-stone-900 focus:outline-none bg-white transition-colors"
                      placeholder="Add a note for the kitchen or packing station (e.g., extra spicy, pack condiments separately)..."
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
              </section>
              {/* END: RightDetailsColumn */}
            </div>
          </main>

          {/* BEGIN: BottomStickyBar */}
          <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-stone-200 z-50 py-3.5 px-6 md:px-8">
            <div className="w-full flex items-center justify-between">
              {/* Back Navigation Button */}
              <button
                onClick={() => goToStep(1)}
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
                    {taxCalculation.currencySymbol}{(totalPayablePaise / 100).toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => goToStep(3)}
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
                    onClick={() => goToStep(1)}
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
                      <div key={(item.cartItemId || item.itemId) + "_" + idx} className="flex items-start justify-between text-sm pt-1">
                        <div className="flex items-start space-x-2.5">
                          {renderDietaryMark(item)}
                          <div>
                            <p className="font-medium text-[#1c1b1b] leading-tight">{item.name}</p>
                            {item.customizations && item.customizations.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {item.customizations.map((c, cIdx) => (
                                  <span
                                    key={cIdx}
                                    className="text-[10px] bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded font-normal"
                                  >
                                    + {c.name || "Add-on"}{" "}
                                    {c.price ? `(+${taxCalculation.currencySymbol}${(c.price / 100).toFixed(2)})` : ""}
                                  </span>
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-[#8a7e75] mt-0.5">
                              Qty: {item.quantity} × {taxCalculation.currencySymbol}{(item.price / 100).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <span className="font-medium text-[#1c1b1b] shrink-0">
                          {taxCalculation.currencySymbol}{((item.price * item.quantity) / 100).toFixed(2)}
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
                  {taxCalculation.componentBreakdown.map((comp, cIdx) => (
                    <div
                      key={`step3_${comp.name}_${comp.rate}_${cIdx}`}
                      className="flex justify-between text-[#5e5e5e]"
                    >
                      <span>
                        {comp.name} ({comp.rate}%)
                      </span>
                      <span className="font-medium text-[#1c1b1b]">
                        {taxCalculation.currencySymbol}{(comp.taxAmountPaise / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}

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
                  <div
                    aria-label="Payment Channels"
                    className="bg-[#f5f2f0] p-1.5 rounded-2xl border border-[#e5ded8] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2"
                    role="tablist"
                  >
                    {activePaymentChannels.map((mode: any) => {
                      const isSelected = selectedPaymentMode === mode.name;
                      return (
                        <button
                          key={mode.id || mode.name}
                          type="button"
                          role="tab"
                          aria-selected={isSelected}
                          onClick={() => {
                            setSelectedPaymentMode(mode.name);
                            const required = (totalPayablePaise / 100).toFixed(2);
                            const lower = mode.name.toLowerCase();
                            if (lower.includes("cash") && (!tenderCashGiven.trim() || tenderCashGiven === "0")) {
                              setTenderCashGiven(required);
                            } else if (
                              (lower.includes("card") || lower.includes("credit") || lower.includes("debit")) &&
                              (!tenderCardGiven.trim() || tenderCardGiven === "0")
                            ) {
                              setTenderCardGiven(required);
                            } else if (
                              (lower.includes("upi") ||
                                lower.includes("qr") ||
                                lower.includes("gpay") ||
                                lower.includes("phonepe") ||
                                lower.includes("paytm")) &&
                              (!tenderUpiGiven.trim() || tenderUpiGiven === "0")
                            ) {
                              setTenderUpiGiven(required);
                            } else if (lower.includes("split")) {
                              const half1 = (Math.floor(totalPayablePaise / 2) / 100).toFixed(2);
                              const half2 = ((totalPayablePaise - Math.floor(totalPayablePaise / 2)) / 100).toFixed(2);
                              if (!splitPart1Amount.trim()) setSplitPart1Amount(half1);
                              if (!splitPart2Amount.trim()) setSplitPart2Amount(half2);
                            } else {
                              if (!customTenderGiven.trim() || customTenderGiven === "0") {
                                setCustomTenderGiven(required);
                              }
                            }
                          }}
                          className={`w-full min-h-[46px] inline-flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer select-none whitespace-nowrap ${
                            isSelected
                              ? "bg-[#0c0a09] text-white shadow-sm border border-[#0c0a09]"
                              : "bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-950 border border-stone-200/80 hover:border-stone-300 shadow-2xs"
                          }`}
                        >
                          <span className={isSelected ? "text-white" : "text-stone-500"}>
                            {mode.icon}
                          </span>
                          <span className={isSelected ? "text-white font-semibold" : "text-stone-700 font-medium"}>
                            {mode.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* TAB 1: CASH SETTLEMENT FLOW */}
                  {selectedPaymentMode.toLowerCase().includes("cash") && (
                    <div className="mt-6 space-y-6" data-purpose="cash-settlement-flow">
                      {/* Target Payable Display Card */}
                      <div className="p-4 bg-[#f1edec]/50 rounded-xl border border-stone-200/80 flex items-center justify-between">
                        <div>
                          <span className="text-xs text-[#5e5e5e] font-medium block">Total Payable Net Amount</span>
                          <span className="text-xs text-[#8a7e75]">Ticket: {activeCart.label} • {activeCart.orderType}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-bold text-[#141010]">
                            {taxCalculation.currencySymbol}{(totalPayablePaise / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Cash Tender Input Field */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[#5e5e5e]" htmlFor="cash-tendered-input">
                            Cash Tendered / Received <span className="text-rose-500">*</span>
                          </label>
                          {!tenderCashGiven.trim() && (
                            <span className="text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              Required to settle
                            </span>
                          )}
                        </div>
                        <div className="relative rounded-xl shadow-xs">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className={`font-medium text-lg transition-colors ${
                              tenderCashGiven.trim() ? "text-[#141010]" : "text-stone-300"
                            }`}>
                              {taxCalculation.currencySymbol}
                            </span>
                          </div>
                          <input
                            id="cash-tendered-input"
                            name="cash-tendered"
                            type="text"
                            placeholder="0.00"
                            value={tenderCashGiven}
                            onChange={(e) => setTenderCashGiven(e.target.value)}
                            className="block w-full pl-9 pr-4 py-3.5 bg-white border border-stone-300 rounded-xl text-xl font-semibold text-[#141010] placeholder:text-stone-300/80 placeholder:font-light placeholder:italic focus:ring-2 focus:ring-[#0c0a09] focus:border-[#0c0a09] transition focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Quick Cash Buttons (Fast Tender Shortcuts) */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                            Fast Tender Shortcuts
                          </span>
                          <span className="text-[11px] text-stone-400">Click to auto-fill tender amount</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                          {/* Exact Button */}
                          <button
                            type="button"
                            onClick={() => setTenderCashGiven((totalPayablePaise / 100).toFixed(2))}
                            className={`p-3 rounded-xl border text-xs transition-all text-center cursor-pointer select-none ${
                              tenderCashGiven.trim() && parseFloat(tenderCashGiven) === totalPayablePaise / 100
                                ? "border-stone-900 bg-stone-900 text-white font-bold shadow-xs"
                                : "border-stone-200/90 bg-white hover:bg-stone-50 text-stone-800 font-semibold shadow-2xs hover:border-stone-300"
                            }`}
                          >
                            <span className={`block text-[10px] uppercase tracking-wider mb-0.5 ${
                              tenderCashGiven.trim() && parseFloat(tenderCashGiven) === totalPayablePaise / 100 ? "text-stone-300" : "text-stone-400"
                            }`}>
                              Exact Total
                            </span>
                            <span className="text-sm font-serif font-bold">
                              {taxCalculation.currencySymbol}{(totalPayablePaise / 100).toFixed(2)}
                            </span>
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
                              const isSelected = tenderCashGiven.trim() && parseFloat(tenderCashGiven) === amt;
                              return (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() => setTenderCashGiven(amt.toFixed(2))}
                                  className={`p-3 rounded-xl border text-xs transition-all text-center cursor-pointer select-none ${
                                    isSelected
                                      ? "border-stone-900 bg-stone-900 text-white font-bold shadow-xs"
                                      : "border-stone-200/90 bg-white hover:bg-stone-50 text-stone-800 font-semibold shadow-2xs hover:border-stone-300"
                                  }`}
                                >
                                  <span className={`block text-[10px] uppercase tracking-wider mb-0.5 ${
                                    isSelected ? "text-stone-300" : "text-stone-400"
                                  }`}>
                                    Cash Note
                                  </span>
                                  <span className="text-sm font-serif font-bold">
                                    {taxCalculation.currencySymbol}{amt.toLocaleString("en-IN")}
                                  </span>
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* Return / Change Due Callout Box */}
                      {(() => {
                        const billVal = totalPayablePaise / 100;
                        const isGivenFilled = !!tenderCashGiven.trim();
                        const givenVal = parseFloat(tenderCashGiven || "0");
                        const changeVal = givenVal - billVal;

                        if (!isGivenFilled) {
                          return (
                            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between">
                              <div className="flex items-center space-x-2 text-stone-500 text-xs">
                                <span className="text-base">ℹ️</span>
                                <span>Enter cash tendered amount or click a quick shortcut above to calculate return change.</span>
                              </div>
                            </div>
                          );
                        }

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
                                  {taxCalculation.currencySymbol}{changeVal.toFixed(2)}
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
                                  {taxCalculation.currencySymbol}{Math.abs(changeVal).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  )}

                  {/* TAB 2 & 3: CARD SETTLEMENT (Credit / Debit / Card) */}
                  {(selectedPaymentMode.toLowerCase().includes("card") ||
                    selectedPaymentMode.toLowerCase().includes("credit") ||
                    selectedPaymentMode.toLowerCase().includes("debit")) &&
                    !selectedPaymentMode.toLowerCase().includes("split") && (
                      <div className="mt-6 space-y-6" data-purpose="card-settlement-flow">
                        {/* Target Payable Display Card */}
                        <div className="p-4 bg-[#f1edec]/50 rounded-xl border border-stone-200/80 flex items-center justify-between">
                          <div>
                            <span className="text-xs text-[#5e5e5e] font-medium block">Total Payable Net Amount</span>
                            <span className="text-xs text-[#8a7e75]">Settling via {selectedPaymentMode} • {activeCart.label}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-bold text-[#141010]">
                              {taxCalculation.currencySymbol}{(totalPayablePaise / 100).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Card Tender Input Field */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5e5e5e]" htmlFor="card-tendered-input">
                              {selectedPaymentMode} Amount to Charge <span className="text-rose-500">*</span>
                            </label>
                            {!tenderCardGiven.trim() && (
                              <span className="text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                Required to settle
                              </span>
                            )}
                          </div>
                          <div className="relative rounded-xl shadow-xs">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                              <span className={`font-medium text-lg transition-colors ${
                                tenderCardGiven.trim() ? "text-[#141010]" : "text-stone-300"
                              }`}>
                                {taxCalculation.currencySymbol}
                              </span>
                            </div>
                            <input
                              id="card-tendered-input"
                              name="card-tendered"
                              type="text"
                              placeholder="0.00"
                              value={tenderCardGiven}
                              onChange={(e) => setTenderCardGiven(e.target.value)}
                              className="block w-full pl-9 pr-4 py-3.5 bg-white border border-stone-300 rounded-xl text-xl font-semibold text-[#141010] placeholder:text-stone-300/80 placeholder:font-light placeholder:italic focus:ring-2 focus:ring-[#0c0a09] focus:border-[#0c0a09] transition focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Quick Card Shortcuts (Fast Tender Shortcuts) */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                              Fast Tender Shortcuts
                            </span>
                            <span className="text-[11px] text-stone-400">Click to auto-fill tender amount</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                            {/* Exact Button */}
                            <button
                              type="button"
                              onClick={() => setTenderCardGiven((totalPayablePaise / 100).toFixed(2))}
                              className={`p-3 rounded-xl border text-xs transition-all text-center cursor-pointer select-none ${
                                tenderCardGiven.trim() && parseFloat(tenderCardGiven) === totalPayablePaise / 100
                                  ? "border-stone-900 bg-stone-900 text-white font-bold shadow-xs"
                                  : "border-stone-200/90 bg-white hover:bg-stone-50 text-stone-800 font-semibold shadow-2xs hover:border-stone-300"
                              }`}
                            >
                              <span className={`block text-[10px] uppercase tracking-wider mb-0.5 ${
                                tenderCardGiven.trim() && parseFloat(tenderCardGiven) === totalPayablePaise / 100 ? "text-stone-300" : "text-stone-400"
                              }`}>
                                Exact Total
                              </span>
                              <span className="text-sm font-serif font-bold">
                                {taxCalculation.currencySymbol}{(totalPayablePaise / 100).toFixed(2)}
                              </span>
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
                                const isSelected = tenderCardGiven.trim() && parseFloat(tenderCardGiven) === amt;
                                return (
                                  <button
                                    key={amt}
                                    type="button"
                                    onClick={() => setTenderCardGiven(amt.toFixed(2))}
                                    className={`p-3 rounded-xl border text-xs transition-all text-center cursor-pointer select-none ${
                                      isSelected
                                        ? "border-stone-900 bg-stone-900 text-white font-bold shadow-xs"
                                        : "border-stone-200/90 bg-white hover:bg-stone-50 text-stone-800 font-semibold shadow-2xs hover:border-stone-300"
                                    }`}
                                  >
                                    <span className={`block text-[10px] uppercase tracking-wider mb-0.5 ${
                                      isSelected ? "text-stone-300" : "text-stone-400"
                                    }`}>
                                      Note
                                    </span>
                                    <span className="text-sm font-serif font-bold">
                                      {taxCalculation.currencySymbol}{amt.toLocaleString("en-IN")}
                                    </span>
                                  </button>
                                );
                              });
                            })()}
                          </div>
                        </div>

                        {/* Optional Auth / Transaction Ref Code */}
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 uppercase tracking-wider mb-1.5" htmlFor="card-ref-code">
                            Optional Auth / Transaction Ref Code (RRN)
                          </label>
                          <input
                            id="card-ref-code"
                            type="text"
                            value={cardAuthRef}
                            onChange={(e) => setCardAuthRef(e.target.value)}
                            placeholder="e.g. TXN-89324810"
                            className="w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-sm text-stone-900 font-medium focus:ring-2 focus:ring-[#0c0a09] focus:border-[#0c0a09] focus:outline-none transition"
                          />
                        </div>
                      </div>
                    )}

                  {/* TAB 3: UPI / QR SETTLEMENT */}
                  {(selectedPaymentMode.toLowerCase().includes("upi") ||
                    selectedPaymentMode.toLowerCase().includes("qr") ||
                    selectedPaymentMode.toLowerCase().includes("gpay") ||
                    selectedPaymentMode.toLowerCase().includes("phonepe") ||
                    selectedPaymentMode.toLowerCase().includes("paytm")) &&
                    !selectedPaymentMode.toLowerCase().includes("split") && (
                      <div className="mt-6 space-y-6" data-purpose="upi-settlement-flow">
                        {/* Target Payable Display Card */}
                        <div className="p-4 bg-[#f1edec]/50 rounded-xl border border-stone-200/80 flex items-center justify-between">
                          <div>
                            <span className="text-xs text-[#5e5e5e] font-medium block">Total Payable Net Amount</span>
                            <span className="text-xs text-[#8a7e75]">Settling via {selectedPaymentMode} • {activeCart.label}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-bold text-[#141010]">
                              {taxCalculation.currencySymbol}{(totalPayablePaise / 100).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* UPI Tender Input Field */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5e5e5e]" htmlFor="upi-tendered-input">
                              UPI Settlement Amount <span className="text-rose-500">*</span>
                            </label>
                            {!tenderUpiGiven.trim() && (
                              <span className="text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                Required to settle
                              </span>
                            )}
                          </div>
                          <div className="relative rounded-xl shadow-xs">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                              <span className={`font-medium text-lg transition-colors ${
                                tenderUpiGiven.trim() ? "text-[#141010]" : "text-stone-300"
                              }`}>
                                {taxCalculation.currencySymbol}
                              </span>
                            </div>
                            <input
                              id="upi-tendered-input"
                              name="upi-tendered"
                              type="text"
                              placeholder="0.00"
                              value={tenderUpiGiven}
                              onChange={(e) => setTenderUpiGiven(e.target.value)}
                              className="block w-full pl-9 pr-4 py-3.5 bg-white border border-stone-300 rounded-xl text-xl font-semibold text-[#141010] placeholder:text-stone-300/80 placeholder:font-light placeholder:italic focus:ring-2 focus:ring-[#0c0a09] focus:border-[#0c0a09] transition focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Quick UPI Shortcuts (Fast Tender Shortcuts) */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                              Fast Tender Shortcuts
                            </span>
                            <span className="text-[11px] text-stone-400">Click to auto-fill tender amount</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                            {/* Exact Button */}
                            <button
                              type="button"
                              onClick={() => setTenderUpiGiven((totalPayablePaise / 100).toFixed(2))}
                              className={`p-3 rounded-xl border text-xs transition-all text-center cursor-pointer select-none ${
                                tenderUpiGiven.trim() && parseFloat(tenderUpiGiven) === totalPayablePaise / 100
                                  ? "border-stone-900 bg-stone-900 text-white font-bold shadow-xs"
                                  : "border-stone-200/90 bg-white hover:bg-stone-50 text-stone-800 font-semibold shadow-2xs hover:border-stone-300"
                              }`}
                            >
                              <span className={`block text-[10px] uppercase tracking-wider mb-0.5 ${
                                tenderUpiGiven.trim() && parseFloat(tenderUpiGiven) === totalPayablePaise / 100 ? "text-stone-300" : "text-stone-400"
                              }`}>
                                Exact Total
                              </span>
                              <span className="text-sm font-serif font-bold">
                                {taxCalculation.currencySymbol}{(totalPayablePaise / 100).toFixed(2)}
                              </span>
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
                                const isSelected = tenderUpiGiven.trim() && parseFloat(tenderUpiGiven) === amt;
                                return (
                                  <button
                                    key={amt}
                                    type="button"
                                    onClick={() => setTenderUpiGiven(amt.toFixed(2))}
                                    className={`p-3 rounded-xl border text-xs transition-all text-center cursor-pointer select-none ${
                                      isSelected
                                        ? "border-stone-900 bg-stone-900 text-white font-bold shadow-xs"
                                        : "border-stone-200/90 bg-white hover:bg-stone-50 text-stone-800 font-semibold shadow-2xs hover:border-stone-300"
                                    }`}
                                  >
                                    <span className={`block text-[10px] uppercase tracking-wider mb-0.5 ${
                                      isSelected ? "text-stone-300" : "text-stone-400"
                                    }`}>
                                      Note
                                    </span>
                                    <span className="text-sm font-serif font-bold">
                                      {taxCalculation.currencySymbol}{amt.toLocaleString("en-IN")}
                                    </span>
                                  </button>
                                );
                              });
                            })()}
                          </div>
                        </div>

                        {/* Optional UTR / Reference Input */}
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 uppercase tracking-wider mb-1.5" htmlFor="upi-ref-code">
                            Optional UPI UTR / Transaction ID
                          </label>
                          <input
                            id="upi-ref-code"
                            type="text"
                            value={upiAuthRef}
                            onChange={(e) => setUpiAuthRef(e.target.value)}
                            placeholder="e.g. UTR-202609170123"
                            className="w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-sm text-stone-900 font-medium focus:ring-2 focus:ring-[#0c0a09] focus:border-[#0c0a09] focus:outline-none transition"
                          />
                        </div>
                      </div>
                    )}

                  {/* TAB 4: SPLIT PAYMENT SETTLEMENT */}
                  {selectedPaymentMode.toLowerCase().includes("split") && (
                    <div className="mt-6 space-y-6" data-purpose="split-settlement-flow">
                      {/* Target Payable Display Card */}
                      <div className="p-4 bg-[#f1edec]/50 rounded-xl border border-stone-200/80 flex items-center justify-between">
                        <div>
                          <span className="text-xs text-[#5e5e5e] font-medium block">Total Payable Net Amount</span>
                          <span className="text-xs text-[#8a7e75]">Ticket: {activeCart.label} • {activeCart.orderType}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-bold text-[#141010]">
                            {taxCalculation.currencySymbol}{(totalPayablePaise / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Editable Split Fields Grid */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                            Split Tender Channels (Editable)
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const p1 = parseFloat(splitPart1Amount || "0");
                              const p1Paise = Math.round(p1 * 100);
                              const remPaise = Math.max(0, totalPayablePaise - p1Paise);
                              setSplitPart2Amount((remPaise / 100).toFixed(2));
                            }}
                            className="text-xs font-semibold text-stone-900 hover:text-black underline underline-offset-4 cursor-pointer"
                          >
                            Auto-Balance Part 2
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Part 1 Split Card */}
                          <div className="p-4 bg-white border border-stone-200/90 rounded-2xl space-y-3 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                                Split 1
                              </span>
                              <select
                                value={splitPart1Mode}
                                onChange={(e) => setSplitPart1Mode(e.target.value)}
                                className="text-xs font-semibold bg-stone-100 border border-stone-200 rounded-lg px-2.5 py-1 text-stone-800 focus:outline-none cursor-pointer"
                              >
                                {activePaymentChannels
                                  .filter((m: any) => !m.name.toLowerCase().includes("split"))
                                  .map((m: any) => (
                                    <option key={`split1_${m.name}`} value={m.name}>
                                      {m.name}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div className="relative rounded-xl">
                              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <span className="font-semibold text-base text-stone-900">
                                  {taxCalculation.currencySymbol}
                                </span>
                              </div>
                              <input
                                type="text"
                                value={splitPart1Amount}
                                onChange={(e) => setSplitPart1Amount(e.target.value)}
                                placeholder="0.00"
                                className="block w-full pl-8 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-lg font-bold text-stone-900 focus:bg-white focus:ring-2 focus:ring-stone-900 focus:outline-none transition"
                              />
                            </div>
                          </div>

                          {/* Part 2 Split Card */}
                          <div className="p-4 bg-white border border-stone-200/90 rounded-2xl space-y-3 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                                Split 2
                              </span>
                              <select
                                value={splitPart2Mode}
                                onChange={(e) => setSplitPart2Mode(e.target.value)}
                                className="text-xs font-semibold bg-stone-100 border border-stone-200 rounded-lg px-2.5 py-1 text-stone-800 focus:outline-none cursor-pointer"
                              >
                                {activePaymentChannels
                                  .filter((m: any) => !m.name.toLowerCase().includes("split"))
                                  .map((m: any) => (
                                    <option key={`split2_${m.name}`} value={m.name}>
                                      {m.name}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div className="relative rounded-xl">
                              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <span className="font-semibold text-base text-stone-900">
                                  {taxCalculation.currencySymbol}
                                </span>
                              </div>
                              <input
                                type="text"
                                value={splitPart2Amount}
                                onChange={(e) => setSplitPart2Amount(e.target.value)}
                                placeholder="0.00"
                                className="block w-full pl-8 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-lg font-bold text-stone-900 focus:bg-white focus:ring-2 focus:ring-stone-900 focus:outline-none transition"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Live Allocation Balance Card */}
                      {(() => {
                        const p1 = parseFloat(splitPart1Amount.trim() || "0");
                        const p2 = parseFloat(splitPart2Amount.trim() || "0");
                        const allocatedPaise = Math.round((p1 + p2) * 100);
                        const diffPaise = allocatedPaise - totalPayablePaise;

                        if (diffPaise === 0) {
                          return (
                            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-800 font-medium">
                              <div className="flex items-center space-x-2">
                                <span className="text-base">✓</span>
                                <span>100% Balanced &amp; Allocated across split channels</span>
                              </div>
                              <span className="font-bold text-sm">
                                {taxCalculation.currencySymbol}{(allocatedPaise / 100).toFixed(2)}
                              </span>
                            </div>
                          );
                        } else if (diffPaise < 0) {
                          return (
                            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-800 font-medium">
                              <div className="flex items-center space-x-2">
                                <span className="text-base">⚠️</span>
                                <span>
                                  Remaining {taxCalculation.currencySymbol}{(Math.abs(diffPaise) / 100).toFixed(2)} unallocated
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const p1Val = parseFloat(splitPart1Amount || "0");
                                  const remPaise = Math.max(0, totalPayablePaise - Math.round(p1Val * 100));
                                  setSplitPart2Amount((remPaise / 100).toFixed(2));
                                }}
                                className="text-xs bg-amber-900 text-white px-2.5 py-1 rounded-lg font-semibold hover:bg-amber-950 transition cursor-pointer"
                              >
                                Fix Balance
                              </button>
                            </div>
                          );
                        } else {
                          return (
                            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs text-rose-800 font-medium">
                              <div className="flex items-center space-x-2">
                                <span className="text-base">⚠️</span>
                                <span>
                                  Split exceeds total by {taxCalculation.currencySymbol}{(diffPaise / 100).toFixed(2)}
                                </span>
                              </div>
                              <span className="font-bold">
                                {taxCalculation.currencySymbol}{(allocatedPaise / 100).toFixed(2)} / {taxCalculation.currencySymbol}{(totalPayablePaise / 100).toFixed(2)}
                              </span>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  )}

                  {/* TAB 5: CUSTOM PAYMENT MODE SETTLEMENT */}
                  {!selectedPaymentMode.toLowerCase().includes("cash") &&
                    !selectedPaymentMode.toLowerCase().includes("card") &&
                    !selectedPaymentMode.toLowerCase().includes("credit") &&
                    !selectedPaymentMode.toLowerCase().includes("debit") &&
                    !selectedPaymentMode.toLowerCase().includes("upi") &&
                    !selectedPaymentMode.toLowerCase().includes("qr") &&
                    !selectedPaymentMode.toLowerCase().includes("gpay") &&
                    !selectedPaymentMode.toLowerCase().includes("phonepe") &&
                    !selectedPaymentMode.toLowerCase().includes("paytm") &&
                    !selectedPaymentMode.toLowerCase().includes("split") && (
                      <div className="mt-6 space-y-6" data-purpose="custom-settlement-flow">
                        {/* Target Payable Display Card */}
                        <div className="p-4 bg-[#f1edec]/50 rounded-xl border border-stone-200/80 flex items-center justify-between">
                          <div>
                            <span className="text-xs text-[#5e5e5e] font-medium block">Total Payable Net Amount</span>
                            <span className="text-xs text-[#8a7e75]">Settling via {selectedPaymentMode} • {activeCart.label}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-bold text-[#141010]">
                              {taxCalculation.currencySymbol}{(totalPayablePaise / 100).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Custom Tender Input Field */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5e5e5e]" htmlFor="custom-tendered-input">
                              {selectedPaymentMode} Amount <span className="text-rose-500">*</span>
                            </label>
                            {!customTenderGiven.trim() && (
                              <span className="text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                Required to settle
                              </span>
                            )}
                          </div>
                          <div className="relative rounded-xl shadow-xs">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                              <span className={`font-medium text-lg transition-colors ${
                                customTenderGiven.trim() ? "text-[#141010]" : "text-stone-300"
                              }`}>
                                {taxCalculation.currencySymbol}
                              </span>
                            </div>
                            <input
                              id="custom-tendered-input"
                              name="custom-tendered"
                              type="text"
                              placeholder="0.00"
                              value={customTenderGiven}
                              onChange={(e) => setCustomTenderGiven(e.target.value)}
                              className="block w-full pl-9 pr-4 py-3.5 bg-white border border-stone-300 rounded-xl text-xl font-semibold text-[#141010] placeholder:text-stone-300/80 placeholder:font-light placeholder:italic focus:ring-2 focus:ring-[#0c0a09] focus:border-[#0c0a09] transition focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Quick Exact Button */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                              Fast Tender Shortcuts
                            </span>
                            <span className="text-[11px] text-stone-400">Click to auto-fill tender amount</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            <button
                              type="button"
                              onClick={() => setCustomTenderGiven((totalPayablePaise / 100).toFixed(2))}
                              className={`p-3 rounded-xl border text-xs transition-all text-center cursor-pointer select-none ${
                                customTenderGiven.trim() && parseFloat(customTenderGiven) === totalPayablePaise / 100
                                  ? "border-stone-900 bg-stone-900 text-white font-bold shadow-xs"
                                  : "border-stone-200/90 bg-white hover:bg-stone-50 text-stone-800 font-semibold shadow-2xs hover:border-stone-300"
                              }`}
                            >
                              <span className={`block text-[10px] uppercase tracking-wider mb-0.5 ${
                                customTenderGiven.trim() && parseFloat(customTenderGiven) === totalPayablePaise / 100 ? "text-stone-300" : "text-stone-400"
                              }`}>
                                Exact Total
                              </span>
                              <span className="text-sm font-serif font-bold">
                                {taxCalculation.currencySymbol}{(totalPayablePaise / 100).toFixed(2)}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Optional Reference / Voucher / Note Input */}
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 uppercase tracking-wider mb-1.5" htmlFor="custom-ref-code">
                            Optional {selectedPaymentMode} Reference / Note / Voucher #
                          </label>
                          <input
                            id="custom-ref-code"
                            type="text"
                            value={customTenderRef}
                            onChange={(e) => setCustomTenderRef(e.target.value)}
                            placeholder={`e.g. ${selectedPaymentMode} Reference ID or Note`}
                            className="w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-sm text-stone-900 font-medium focus:ring-2 focus:ring-[#0c0a09] focus:border-[#0c0a09] focus:outline-none transition"
                          />
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
                onClick={() => goToStep(2)}
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
                    {selectedPaymentMode.toLowerCase().includes("cash")
                      ? tenderCashGiven.trim()
                        ? `${taxCalculation.currencySymbol}${parseFloat(tenderCashGiven).toFixed(2)}`
                        : `${taxCalculation.currencySymbol}0.00`
                      : selectedPaymentMode.toLowerCase().includes("card") ||
                        selectedPaymentMode.toLowerCase().includes("credit") ||
                        selectedPaymentMode.toLowerCase().includes("debit")
                      ? tenderCardGiven.trim()
                        ? `${taxCalculation.currencySymbol}${parseFloat(tenderCardGiven).toFixed(2)}`
                        : `${taxCalculation.currencySymbol}${(totalPayablePaise / 100).toFixed(2)}`
                      : selectedPaymentMode.toLowerCase().includes("upi") ||
                        selectedPaymentMode.toLowerCase().includes("qr") ||
                        selectedPaymentMode.toLowerCase().includes("gpay") ||
                        selectedPaymentMode.toLowerCase().includes("phonepe") ||
                        selectedPaymentMode.toLowerCase().includes("paytm")
                      ? tenderUpiGiven.trim()
                        ? `${taxCalculation.currencySymbol}${parseFloat(tenderUpiGiven).toFixed(2)}`
                        : `${taxCalculation.currencySymbol}${(totalPayablePaise / 100).toFixed(2)}`
                      : selectedPaymentMode.toLowerCase().includes("split")
                      ? `${taxCalculation.currencySymbol}${(
                          parseFloat(splitPart1Amount || "0") + parseFloat(splitPart2Amount || "0")
                        ).toFixed(2)}`
                      : customTenderGiven.trim()
                      ? `${taxCalculation.currencySymbol}${parseFloat(customTenderGiven).toFixed(2)}`
                      : `${taxCalculation.currencySymbol}${(totalPayablePaise / 100).toFixed(2)}`}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={
                    isProcessingOrder ||
                    (selectedPaymentMode.toLowerCase().includes("cash") &&
                      (!tenderCashGiven.trim() ||
                        isNaN(parseFloat(tenderCashGiven)) ||
                        Math.round(parseFloat(tenderCashGiven) * 100) < totalPayablePaise)) ||
                    ((selectedPaymentMode.toLowerCase().includes("card") ||
                      selectedPaymentMode.toLowerCase().includes("credit") ||
                      selectedPaymentMode.toLowerCase().includes("debit")) &&
                      (!tenderCardGiven.trim() ||
                        isNaN(parseFloat(tenderCardGiven)) ||
                        parseFloat(tenderCardGiven) <= 0)) ||
                    ((selectedPaymentMode.toLowerCase().includes("upi") ||
                      selectedPaymentMode.toLowerCase().includes("qr") ||
                      selectedPaymentMode.toLowerCase().includes("gpay") ||
                      selectedPaymentMode.toLowerCase().includes("phonepe") ||
                      selectedPaymentMode.toLowerCase().includes("paytm")) &&
                      (!tenderUpiGiven.trim() ||
                        isNaN(parseFloat(tenderUpiGiven)) ||
                        parseFloat(tenderUpiGiven) <= 0)) ||
                    (selectedPaymentMode.toLowerCase().includes("split") &&
                      Math.round(
                        (parseFloat(splitPart1Amount || "0") + parseFloat(splitPart2Amount || "0")) * 100
                      ) !== totalPayablePaise) ||
                    (!selectedPaymentMode.toLowerCase().includes("cash") &&
                      !selectedPaymentMode.toLowerCase().includes("card") &&
                      !selectedPaymentMode.toLowerCase().includes("credit") &&
                      !selectedPaymentMode.toLowerCase().includes("debit") &&
                      !selectedPaymentMode.toLowerCase().includes("upi") &&
                      !selectedPaymentMode.toLowerCase().includes("qr") &&
                      !selectedPaymentMode.toLowerCase().includes("gpay") &&
                      !selectedPaymentMode.toLowerCase().includes("phonepe") &&
                      !selectedPaymentMode.toLowerCase().includes("paytm") &&
                      !selectedPaymentMode.toLowerCase().includes("split") &&
                      (!customTenderGiven.trim() ||
                        isNaN(parseFloat(customTenderGiven)) ||
                        parseFloat(customTenderGiven) <= 0))
                  }
                  onClick={handleCompleteOrder}
                  className={`inline-flex items-center justify-center space-x-2.5 px-7 py-3 rounded-full text-white text-sm font-semibold shadow-md transition transform active:scale-98 ${
                    isProcessingOrder ||
                    (selectedPaymentMode.toLowerCase().includes("cash") &&
                      (!tenderCashGiven.trim() ||
                        isNaN(parseFloat(tenderCashGiven)) ||
                        Math.round(parseFloat(tenderCashGiven) * 100) < totalPayablePaise)) ||
                    ((selectedPaymentMode.toLowerCase().includes("card") ||
                      selectedPaymentMode.toLowerCase().includes("credit") ||
                      selectedPaymentMode.toLowerCase().includes("debit")) &&
                      (!tenderCardGiven.trim() ||
                        isNaN(parseFloat(tenderCardGiven)) ||
                        parseFloat(tenderCardGiven) <= 0)) ||
                    ((selectedPaymentMode.toLowerCase().includes("upi") ||
                      selectedPaymentMode.toLowerCase().includes("qr") ||
                      selectedPaymentMode.toLowerCase().includes("gpay") ||
                      selectedPaymentMode.toLowerCase().includes("phonepe") ||
                      selectedPaymentMode.toLowerCase().includes("paytm")) &&
                      (!tenderUpiGiven.trim() ||
                        isNaN(parseFloat(tenderUpiGiven)) ||
                        parseFloat(tenderUpiGiven) <= 0)) ||
                    (selectedPaymentMode.toLowerCase().includes("split") &&
                      Math.round(
                        (parseFloat(splitPart1Amount || "0") + parseFloat(splitPart2Amount || "0")) * 100
                      ) !== totalPayablePaise) ||
                    (!selectedPaymentMode.toLowerCase().includes("cash") &&
                      !selectedPaymentMode.toLowerCase().includes("card") &&
                      !selectedPaymentMode.toLowerCase().includes("credit") &&
                      !selectedPaymentMode.toLowerCase().includes("debit") &&
                      !selectedPaymentMode.toLowerCase().includes("upi") &&
                      !selectedPaymentMode.toLowerCase().includes("qr") &&
                      !selectedPaymentMode.toLowerCase().includes("gpay") &&
                      !selectedPaymentMode.toLowerCase().includes("phonepe") &&
                      !selectedPaymentMode.toLowerCase().includes("paytm") &&
                      !selectedPaymentMode.toLowerCase().includes("split") &&
                      (!customTenderGiven.trim() ||
                        isNaN(parseFloat(customTenderGiven)) ||
                        parseFloat(customTenderGiven) <= 0))
                      ? "bg-stone-400 cursor-not-allowed opacity-60"
                      : "bg-[#0c0a09] hover:bg-stone-800 cursor-pointer"
                  }`}
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
                <span className="font-bold text-[#141010]">
                  {taxCalculation.currencySymbol}
                  {completedOrderData.display_total_amount ||
                    (completedOrderData.totalAmount / 100).toFixed(2)}
                </span>
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
                onClick={handleResetToNewOrder}
                className="flex-1 py-2.5 bg-[#0c0a09] hover:bg-stone-900 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                New Order (F5)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ITEM CUSTOMIZATION MODAL (Defx-POS Layout & Dietary / Price Responsive)    */}
      {/* ========================================================================= */}
      {customizingCatalogEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 font-sans animate-scaleUp max-h-[90vh] flex flex-col">
            {/* Top Item Summary Row matching screenshot */}
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

              {/* Item Details with Dietary Icon */}
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                {renderDietaryMark(customizingCatalogEntry.item)}
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
              <div className="text-sm font-bold text-stone-900 shrink-0">
                {taxCalculation.currencySymbol}
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

            {/* Scrollable Groups & Items Area */}
            <div className="flex-1 overflow-y-auto space-y-5 pr-1 max-h-[50vh]">
              {customizingCatalogEntry.customizations.map((group) => {
                const gid = group.id || group._id;
                const isSingleChoice = (group.max_selected ?? (group.required ? 1 : 99)) === 1;
                const selectedInGroup = selectedCustomizationOptions[gid] || [];
                const availableOptions = (group.customization_items || []).filter(
                  (ci: any) => ci.is_available !== false && ci.isAvailable !== false
                );

                return (
                  <div key={gid} className="space-y-2">
                    {/* Group Header */}
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-900 uppercase tracking-wide">
                          {group.name}
                        </span>
                        <span className="text-[11px] text-stone-500 font-normal">
                          {isSingleChoice
                            ? "Select any 1"
                            : group.required
                            ? `Select up to ${group.max_selected || 1} (Required)`
                            : `Select up to ${group.max_selected || "any"} (Optional)`}
                        </span>
                      </div>
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
                            {/* Left: Dietary Icon + Option Name */}
                            <div className="flex items-center space-x-2.5 min-w-0 pr-3">
                              {renderDietaryMark(option)}
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

                            {/* Right: Extra Price + Check/Radio Box */}
                            <div className="flex items-center space-x-3 shrink-0">
                              <span className="text-xs font-semibold text-stone-900">
                                {optPrice > 0 ? `${taxCalculation.currencySymbol}${optPriceFormatted}` : "Free"}
                              </span>

                              {isSingleChoice ? (
                                <div
                                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                                    isSelected ? "border-stone-900 bg-stone-900" : "border-stone-300 bg-white"
                                  }`}
                                >
                                  <div
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isSelected ? "bg-white" : "bg-transparent"
                                    }`}
                                  />
                                </div>
                              ) : (
                                <div
                                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                    isSelected ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white"
                                  }`}
                                >
                                  {isSelected && (
                                    <svg
                                      className="w-3 h-3"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        d="M5 13l4 4L19 7"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2.5"
                                      />
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

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-stone-200 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setCustomizingCatalogEntry(null)}
                className="px-6 py-2.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Close
              </button>

              {(() => {
                const totalAddonPaise = Object.values(selectedCustomizationOptions)
                  .flat()
                  .reduce((acc, curr) => acc + (curr.price || 0), 0);
                const modalTotalPaise = (customizingCatalogEntry.item.price + totalAddonPaise) * customizationQty;
                const modalTotalFormatted =
                  modalTotalPaise % 100 === 0
                    ? (modalTotalPaise / 100).toString()
                    : (modalTotalPaise / 100).toFixed(2);

                return (
                  <button
                    type="button"
                    onClick={handleConfirmCustomizationModal}
                    className="px-6 py-2.5 bg-[#0c0a09] hover:bg-stone-800 active:scale-98 text-white rounded-lg text-xs font-semibold shadow-md transition cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Add to cart | {modalTotalFormatted}</span>
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// DEFAULT EXPORT WITH SUSPENSE BOUNDARY
// ==========================================

export default function CashierPosPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen bg-[#f5f5f5] flex items-center justify-center text-xs font-semibold text-[#8a7e75]">
          Loading Cashier POS...
        </div>
      }
    >
      <CashierPosContent />
    </Suspense>
  );
}

