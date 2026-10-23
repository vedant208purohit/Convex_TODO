"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  formatPriceWithSymbol,
  formatStoreDate,
  formatStoreTime,
  getCurrencyForCountry,
  getTimezoneForCountry,
  getPhoneCodeForCountry,
  formatPhoneNumberWithCountryCode,
} from "../../../lib/constants/countries";
import { DateRange } from "./ReportHeader";
import { OrderDateRangePicker } from "../OrderDateRangePicker";
import { Toast, type ToastMessage } from "../Toast";

function ChevronRightIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

// Harmonious category colors for the segmented visual bar & dots
const CATEGORY_PALETTE = [
  "#0c0a09", // Primary Dark
  "#44403c", // Stone 700
  "#78716c", // Stone 500
  "#a8a29e", // Stone 400
  "#d6d3d1", // Stone 300
  "#57534e", // Stone 600
  "#292524", // Stone 800
  "#1c1917", // Stone 900
];

interface RecentItemOrder {
  orderId: string;
  orderNumber: string;
  orderType: string;
  quantity: number;
  grossAmountPaise: number;
  createdAt: number;
  customerName?: string;
  customerPhone?: string;
}

export interface MenuItemStat {
  id: string;
  itemName: string;
  categoryName: string;
  menuName?: string;
  itemPricePaise: number;
  unitsSold: number;
  grossPaise: number;
  taxPaise: number;
  netPaise: number;
  revSharePct: number;
  foodCostPct: number | null;
  recipeCostPaise?: number;
  cogsPaise: number;
  hasRecipe?: boolean;
  recipeIngredients?: Array<{
    inventoryItemId: string;
    name: string;
    quantity: number;
    unit: string;
    unitCost: number;
    buyingUnit: string;
    lineCostPaise: number;
  }>;
  channelBreakdown: {
    dineInUnits: number;
    dineInGross: number;
    takeawayUnits: number;
    takeawayGross: number;
    deliveryUnits: number;
    deliveryGross: number;
  };
  recentOrders: RecentItemOrder[];
}

export interface CategoryStat {
  categoryName: string;
  itemsSold: number;
  grossPaise: number;
  taxPaise: number;
  netPaise: number;
  avgItemPricePaise: number;
  mixPct: number;
  color: string;
}

interface MenuReportViewProps {
  orders: any[];
  backendData?: any;
  allItems?: any[];
  allCategories?: any[];
  menus?: any[];
  foodCostMap?: Record<string, any>;
  loading?: boolean;
  currencySymbol?: string;
  countryCode?: string;
  timezone?: string;
  operationTiming?: any;
  selectedRange?: DateRange;
  onRangeChange?: (range: DateRange) => void;
}

export function MenuReportView({
  orders = [],
  allItems = [],
  allCategories = [],
  menus = [],
  foodCostMap = {},
  loading = false,
  currencySymbol: passedCurrencySymbol,
  countryCode = "IN",
  timezone,
  selectedRange,
  onRangeChange,
}: MenuReportViewProps) {
  // Locale and Regional Setup via countries.ts
  const effectiveCountry = countryCode || "IN";
  const currencySymbol =
    passedCurrencySymbol || getCurrencyForCountry(effectiveCountry).symbol || "₹";
  const effectiveTimezone =
    timezone || getTimezoneForCountry(effectiveCountry) || "Asia/Kolkata";
  const phoneDialCode = getPhoneCodeForCountry(effectiveCountry);

  // Filter States: Multi-Menu & Category
  const [selectedMenuFilter, setSelectedMenuFilter] = useState("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Drawer Slide-over state for Costing / Item details
  const [selectedItemForDrawer, setSelectedItemForDrawer] = useState<MenuItemStat | null>(null);

  // Toast State
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "info",
    subtext?: string,
  ) => {
    setToast({ message, type, subtext });
  };

  // -------------------------------------------------------------
  // Dynamic Aggregation Engine (100% live orders from backend)
  // -------------------------------------------------------------
  const aggregatedData = useMemo(() => {
    // 1. Build Category, Menu, and Tax Mode Lookup Maps
    const itemCategoryMap = new Map<string, string>();
    const categoryNameMap = new Map<string, string>();
    const itemMenuMap = new Map<string, string>();
    const categoryMenuMap = new Map<string, string>();
    const itemTaxModeMap = new Map<string, "inclusive" | "exclusive">();

    // Process allCategories hierarchy
    (allCategories || []).forEach((c: any) => {
      const cId = c._id || c.id;
      const cName = c.name || c.category_name;
      const mName = c.menuName || c.menu_name || (c.menu ? c.menu.name : null);
      if (cId && cName) {
        categoryNameMap.set(String(cId), cName);
      }
      if (cName && mName) {
        categoryMenuMap.set(cName, mName);
        if (cId) categoryMenuMap.set(String(cId), mName);
      }
      if (c.items && Array.isArray(c.items)) {
        c.items.forEach((it: any) => {
          const itemObj = it.item || it;
          if (itemObj) {
            if (cName) {
              if (itemObj._id) itemCategoryMap.set(String(itemObj._id), cName);
              if (itemObj.id) itemCategoryMap.set(String(itemObj.id), cName);
              if (itemObj.name) itemCategoryMap.set(itemObj.name.toLowerCase().trim(), cName);
            }
            if (mName) {
              if (itemObj._id) itemMenuMap.set(String(itemObj._id), mName);
              if (itemObj.id) itemMenuMap.set(String(itemObj.id), mName);
              if (itemObj.name) itemMenuMap.set(itemObj.name.toLowerCase().trim(), mName);
            }
            const mode = itemObj.taxMode || itemObj.tax_mode;
            if (mode) {
              if (itemObj._id) itemTaxModeMap.set(String(itemObj._id), mode);
              if (itemObj.id) itemTaxModeMap.set(String(itemObj.id), mode);
              if (itemObj.name) itemTaxModeMap.set(itemObj.name.toLowerCase().trim(), mode);
            }
          }
        });
      }
    });

    // Process allItems
    (allItems || []).forEach((item: any) => {
      const catName =
        item.categoryName ||
        (item.categoryId ? categoryNameMap.get(String(item.categoryId)) : null);
      const mName = item.menuName || item.menu_name;
      const mode = item.taxMode || item.tax_mode;
      if (catName) {
        if (item._id) itemCategoryMap.set(String(item._id), catName);
        if (item.id) itemCategoryMap.set(String(item.id), catName);
        if (item.name) itemCategoryMap.set(item.name.toLowerCase().trim(), catName);
      }
      if (mName) {
        if (item._id) itemMenuMap.set(String(item._id), mName);
        if (item.id) itemMenuMap.set(String(item.id), mName);
        if (item.name) itemMenuMap.set(item.name.toLowerCase().trim(), mName);
      }
      if (mode) {
        if (item._id) itemTaxModeMap.set(String(item._id), mode);
        if (item.id) itemTaxModeMap.set(String(item.id), mode);
        if (item.name) itemTaxModeMap.set(item.name.toLowerCase().trim(), mode);
      }
    });

    // 2. Accumulate Item Statistics
    const itemMap = new Map<string, MenuItemStat>();
    let totalItemsSold = 0;
    let totalGrossPaise = 0;
    let totalTaxPaise = 0;
    let totalNetPaise = 0;

    orders.forEach((order: any) => {
      // Exclude cancelled / rejected orders from sales velocity and revenue
      const isCancelled =
        Boolean(order.isRejected) ||
        order.orderStatus === "Cancelled" ||
        order.status === "Cancelled" ||
        (order.orderStatusName || "").toLowerCase().includes("cancel");

      if (isCancelled) return;
      if (!order.items || !Array.isArray(order.items)) return;

      const orderType = (order.orderType || "Dine-In").toLowerCase();
      const isDineIn = orderType.includes("dine");
      const isDelivery = orderType.includes("delivery");
      const isTakeaway = !isDineIn && !isDelivery;

      // Determine tax mode for the order: "inclusive" or "exclusive"
      const orderSubTotal = order.subTotal || 0;
      const orderTax = order.taxTotal || 0;
      const orderTotal = order.totalAmount || 0;

      // Check if order tax is exclusive (i.e. tax added on top of subTotal to reach totalAmount)
      const orderTaxMode =
        order.taxInfoSnapshot?.tax_mode ||
        (orderTax > 0 && orderSubTotal > 0 && orderTotal >= orderSubTotal + Math.round(orderTax * 0.9)
          ? "exclusive"
          : "inclusive");

      // Extract effective tax rate from order tax components or ratio
      const totalTaxRatePct = (order.taxInfoSnapshot?.components || []).reduce(
        (sum: number, c: any) => sum + (Number(c.rate) || 0),
        0
      );
      const effectiveTaxRate =
        totalTaxRatePct > 0
          ? totalTaxRatePct / 100
          : orderSubTotal > 0
            ? orderTax / orderSubTotal
            : 0.05;

      order.items.forEach((item: any) => {
        const qty = Number(item.quantity) || 1;
        const unitPrice =
          Number(item.itemPrice || item.price) ||
          (item.totalPrice && qty > 0 ? Math.round(item.totalPrice / qty) : 0);
        const lineTotal = Number(item.totalPrice) || unitPrice * qty;

        // Customizations breakdown and mixed tax mode resolution
        const rawCustomizations = item.customizations || [];
        let custsExclusiveTax = 0;
        let custsTotalPaise = 0;

        if (Array.isArray(rawCustomizations) && rawCustomizations.length > 0) {
          rawCustomizations.forEach((cust: any) => {
            const custPrice = Number(cust.price) || 0;
            const custLinePrice = custPrice * qty;
            custsTotalPaise += custLinePrice;

            const custTaxMode = cust.taxMode || cust.tax_mode || orderTaxMode;
            const custHasGst = cust.isGst !== false;

            // Only exclusive tax is collected and reported separately
            if (custHasGst && custTaxMode === "exclusive" && orderTax > 0) {
              custsExclusiveTax += Math.round(custLinePrice * effectiveTaxRate);
            }
          });
        }

        // Base item portion (excluding customizations)
        const rawName = (item.itemName || item.name || "Item").trim();
        const normName = rawName || "Item";
        const baseItemTotalPaise = Math.max(0, lineTotal - custsTotalPaise);
        const baseItemTaxMode =
          item.taxMode ||
          item.tax_mode ||
          itemTaxModeMap.get(String(item.itemId || item._id)) ||
          itemTaxModeMap.get(normName.toLowerCase()) ||
          orderTaxMode;
        let baseItemExclusiveTax = 0;

        // Only exclusive tax is collected on top and reported separately
        if (baseItemTaxMode === "exclusive" && orderTax > 0) {
          baseItemExclusiveTax = Math.round(baseItemTotalPaise * effectiveTaxRate);
        }

        // Combined tax: if inclusive, tax is 0 (not shown/deducted). If exclusive, show exclusive tax.
        const tax = baseItemExclusiveTax + custsExclusiveTax;
        const net = lineTotal; // Base sales price of item + customizations
        const gross = lineTotal + tax; // Gross customer bill including any exclusive tax

        totalItemsSold += qty;
        totalGrossPaise += gross;
        totalTaxPaise += tax;
        totalNetPaise += net;

        const cat =
          item.categoryName ||
          item.category ||
          itemCategoryMap.get(item.itemId || item._id) ||
          itemCategoryMap.get(normName.toLowerCase()) ||
          "General";
        const menu =
          item.menuName ||
          itemMenuMap.get(item.itemId || item._id) ||
          itemMenuMap.get(normName.toLowerCase()) ||
          categoryMenuMap.get(cat) ||
          "Main Menu";

        const existing: MenuItemStat = itemMap.get(normName) || {
          id: item.itemId || item._id || normName,
          itemName: normName,
          categoryName: cat,
          menuName: menu,
          itemPricePaise: unitPrice || (qty > 0 ? Math.round(gross / qty) : 0),
          unitsSold: 0,
          grossPaise: 0,
          taxPaise: 0,
          netPaise: 0,
          revSharePct: 0,
          foodCostPct: 28.5, // Standard baseline food cost benchmark
          cogsPaise: 0,
          channelBreakdown: {
            dineInUnits: 0,
            dineInGross: 0,
            takeawayUnits: 0,
            takeawayGross: 0,
            deliveryUnits: 0,
            deliveryGross: 0,
          },
          recentOrders: [] as RecentItemOrder[],
        };

        existing.unitsSold += qty;
        existing.grossPaise += gross;
        existing.taxPaise += tax;
        existing.netPaise += net;
        if (unitPrice > 0) existing.itemPricePaise = unitPrice;

        // Channel tracking
        if (isDineIn) {
          existing.channelBreakdown.dineInUnits += qty;
          existing.channelBreakdown.dineInGross += gross;
        } else if (isDelivery) {
          existing.channelBreakdown.deliveryUnits += qty;
          existing.channelBreakdown.deliveryGross += gross;
        } else {
          existing.channelBreakdown.takeawayUnits += qty;
          existing.channelBreakdown.takeawayGross += gross;
        }

        // Store up to 5 recent orders for audit drawer
        if (existing.recentOrders.length < 5) {
          existing.recentOrders.push({
            orderId: order._id || order.id || String(order.orderNumber),
            orderNumber: String(order.orderNumber || order.tokenNumber || "ORD"),
            orderType: order.orderType || (isDineIn ? "Dine-In" : isDelivery ? "Delivery" : "Takeaway"),
            quantity: qty,
            grossAmountPaise: gross,
            createdAt: order.createdAt || Date.now(),
            customerName: order.customerName,
            customerPhone: order.customerPhone,
          });
        }

        itemMap.set(normName, existing);
      });
    });

    // Map item names to IDs for fast recipe cost lookup
    const itemNameToIdMap = new Map<string, string>();
    (allItems || []).forEach((it: any) => {
      if (it.name && (it._id || it.id)) {
        itemNameToIdMap.set(it.name.toLowerCase().trim(), String(it._id || it.id));
      }
    });

    // 3. Compute Item Revenue Shares & Food Costings
    const itemsList: MenuItemStat[] = Array.from(itemMap.values()).map((it) => {
      const revShare = totalGrossPaise > 0 ? (it.grossPaise / totalGrossPaise) * 100 : 0;

      const resolvedId = String(it.id);
      const resolvedByName = itemNameToIdMap.get(it.itemName.toLowerCase().trim());
      const costInfo =
        (foodCostMap && (foodCostMap[resolvedId] || (resolvedByName && foodCostMap[resolvedByName]))) ||
        null;

      let foodCostPct: number | null = null;
      let recipeCostPaise = 0;
      let cogsPaise = 0;
      let hasRecipe = false;
      let recipeIngredients: any[] = [];

      if (costInfo && costInfo.hasRecipe && costInfo.totalCostPaise > 0) {
        hasRecipe = true;
        recipeCostPaise = costInfo.totalCostPaise;
        recipeIngredients = costInfo.ingredients || [];
        foodCostPct =
          it.itemPricePaise > 0
            ? Number(((recipeCostPaise / it.itemPricePaise) * 100).toFixed(1))
            : 0;
        cogsPaise = recipeCostPaise * it.unitsSold;
      }

      return {
        ...it,
        revSharePct: Number(revShare.toFixed(1)),
        foodCostPct,
        recipeCostPaise,
        hasRecipe,
        recipeIngredients,
        cogsPaise,
      };
    });

    // 4. Compute Category Aggregations
    const categoryMap = new Map<
      string,
      {
        categoryName: string;
        itemsSold: number;
        grossPaise: number;
        taxPaise: number;
        netPaise: number;
      }
    >();

    itemsList.forEach((it) => {
      const cat = it.categoryName;
      const existing = categoryMap.get(cat) || {
        categoryName: cat,
        itemsSold: 0,
        grossPaise: 0,
        taxPaise: 0,
        netPaise: 0,
      };
      existing.itemsSold += it.unitsSold;
      existing.grossPaise += it.grossPaise;
      existing.taxPaise += it.taxPaise;
      existing.netPaise += it.netPaise;
      categoryMap.set(cat, existing);
    });

    const categoryList: CategoryStat[] = Array.from(categoryMap.values())
      .map((c, idx) => {
        const mix = totalGrossPaise > 0 ? (c.grossPaise / totalGrossPaise) * 100 : 0;
        const avg = c.itemsSold > 0 ? Math.round(c.grossPaise / c.itemsSold) : 0;
        return {
          categoryName: c.categoryName,
          itemsSold: c.itemsSold,
          grossPaise: c.grossPaise,
          taxPaise: c.taxPaise,
          netPaise: c.netPaise,
          avgItemPricePaise: avg,
          mixPct: Number(mix.toFixed(1)),
          color: CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length],
        };
      })
      .sort((a, b) => b.grossPaise - a.grossPaise);

    // 5. Analytical Highlights & Insights
    const sortedByUnitsDesc = [...itemsList].sort((a, b) => {
      if (b.unitsSold !== a.unitsSold) {
        return b.unitsSold - a.unitsSold;
      }
      return b.grossPaise - a.grossPaise; // Tie-breaker: higher revenue wins
    });
    const sortedByGrossDesc = [...itemsList].sort((a, b) => b.grossPaise - a.grossPaise);

    const topVelocityItem = sortedByUnitsDesc[0] || null;
    const primaryRevenueDriver = sortedByGrossDesc[0] || null;
    const topCategory = categoryList[0] || null;

    // High margin star: Item with highest gross profit contribution (Gross Margin % * Sales Volume)
    const activeSellers = itemsList.filter((it) => it.unitsSold > 0);
    const highMarginStar =
      activeSellers.length > 0
        ? [...activeSellers].sort((a, b) => {
            const profitA = a.grossPaise - a.cogsPaise;
            const profitB = b.grossPaise - b.cogsPaise;
            if (profitB !== profitA) return profitB - profitA;
            return (a.foodCostPct ?? 999) - (b.foodCostPct ?? 999);
          })[0]
        : itemsList[0] || null;

    const avgPricePaise =
      totalItemsSold > 0 ? Math.round(totalGrossPaise / totalItemsSold) : 0;

    return {
      itemsList,
      categoryList,
      totalItemsSold,
      totalGrossPaise,
      totalTaxPaise,
      totalNetPaise,
      avgPricePaise,
      topVelocityItem,
      primaryRevenueDriver,
      topCategory,
      highMarginStar,
      distinctCatalogCount: allItems.length > 0 ? allItems.length : itemsList.length,
    };
  }, [orders, allItems, allCategories, foodCostMap]);

  const {
    itemsList,
    categoryList,
    totalItemsSold,
    totalGrossPaise,
    avgPricePaise,
    topVelocityItem,
    primaryRevenueDriver,
    topCategory,
    highMarginStar,
    distinctCatalogCount,
  } = aggregatedData;

  // Extract list of all unique menus for the multi-menu dropdown
  const uniqueMenus = useMemo(() => {
    const set = new Set<string>();
    if (menus && Array.isArray(menus)) {
      menus.forEach((m: any) => {
        if (m.name) set.add(m.name);
      });
    }
    (allCategories || []).forEach((c: any) => {
      const mName = c.menuName || c.menu_name || (c.menu ? c.menu.name : null);
      if (mName) set.add(mName);
    });
    itemsList.forEach((it) => {
      if (it.menuName) set.add(it.menuName);
    });
    return Array.from(set).sort();
  }, [menus, allCategories, itemsList]);

  // Dynamic categories available based on selected menu
  const availableCategories = useMemo(() => {
    let list = itemsList;
    if (selectedMenuFilter !== "all") {
      list = list.filter((it) => (it.menuName || "Main Menu") === selectedMenuFilter);
    }
    const set = new Set<string>();
    list.forEach((it) => set.add(it.categoryName));

    (allCategories || []).forEach((c: any) => {
      const cName = c.name || c.category_name;
      const mName = c.menuName || c.menu_name || (c.menu ? c.menu.name : null);
      if (cName) {
        if (selectedMenuFilter === "all" || mName === selectedMenuFilter) {
          set.add(cName);
        }
      }
    });

    return Array.from(set).sort();
  }, [itemsList, allCategories, selectedMenuFilter]);

  // Filter & Sort Items (by Multi-Menu & Category, naturally sorted by Quantity Sold desc)
  const filteredAndSortedItems = useMemo(() => {
    let result = [...itemsList];

    // Multi-menu filter
    if (selectedMenuFilter !== "all") {
      result = result.filter((it) => (it.menuName || "Main Menu") === selectedMenuFilter);
    }

    // Category filter
    if (selectedCategoryFilter !== "all") {
      result = result.filter((it) => it.categoryName === selectedCategoryFilter);
    }

    // Natural item velocity order: Quantity Sold descending, tie-breaker by Gross Revenue
    result.sort((a, b) => {
      if (b.unitsSold !== a.unitsSold) {
        return b.unitsSold - a.unitsSold;
      }
      return b.grossPaise - a.grossPaise;
    });

    return result;
  }, [itemsList, selectedMenuFilter, selectedCategoryFilter]);

  // Paginated Items
  const totalItemPages = Math.ceil((filteredAndSortedItems.length || 1) / pageSize);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedItems.slice(start, start + pageSize);
  }, [filteredAndSortedItems, currentPage, pageSize]);

  // Average items per order
  const validOrdersCount = orders.filter((o: any) => !o.isRejected && o.orderStatus !== "Cancelled").length;
  const avgItemsPerOrder =
    validOrdersCount > 0 ? (totalItemsSold / validOrdersCount).toFixed(1) : "0.0";

  // CSV Export Handler
  const handleExportCsv = () => {
    if (filteredAndSortedItems.length === 0) {
      showToast("No items available to export for this period.", "warning");
      return;
    }
    const headers = [
      "Item Name",
      "Menu",
      "Category",
      "Units Sold",
      "Unit Price",
      "Net",
      "Rev Share %",
      "Food Cost %",
      "Gross",
    ];
    const rows = filteredAndSortedItems.map((it) => [
      `"${it.itemName}"`,
      `"${it.menuName || "Main Menu"}"`,
      `"${it.categoryName}"`,
      it.unitsSold,
      (it.itemPricePaise / 100).toFixed(2),
      (it.netPaise / 100).toFixed(2),
      `${it.revSharePct}%`,
      `${it.foodCostPct}%`,
      (it.grossPaise / 100).toFixed(2),
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `menu-item-velocity-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Menu items CSV exported successfully", "success");
  };

  return (
    <div className="flex flex-col w-full font-sans">
      {/* 1. Page Header & Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div>
          {/* Breadcrumbs */}
          <nav
            aria-label="Breadcrumb"
            className="flex items-center text-[13px] text-[#5e5e5e] mb-2 gap-2 font-sans font-medium"
          >
            <Link
              href="/reports"
              className="hover:text-[#141010] transition-colors cursor-pointer"
            >
              Reports
            </Link>
            <ChevronRightIcon className="w-3.5 h-3.5 text-[#928c8a]" />
            <span className="text-[#141010] font-semibold">Menu Report</span>
          </nav>
          {/* Title */}
          <h1
            className="font-garamond text-[32px] md:text-[36px] text-[#0c0a09] font-normal leading-tight"
            style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
          >
            Menu Report
          </h1>
          <p className="text-[#5e5e5e] text-xs sm:text-sm mt-1 font-normal max-w-2xl leading-relaxed">
            Understand item sales velocity, category mix contribution, theoretical food cost %, and margin performance.
          </p>
        </div>

        {/* Date Range Selector & Action Bar (Matching Customer Report) */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap sm:flex-nowrap w-full sm:w-auto self-start lg:self-end shrink-0">
          {selectedRange && onRangeChange ? (
            <OrderDateRangePicker
              startDate={selectedRange.startDate}
              endDate={selectedRange.endDate}
              preset={selectedRange.preset}
              onChange={(newRange) => {
                onRangeChange(newRange);
                setCurrentPage(1);
              }}
              countryCode={effectiveCountry}
              timezone={effectiveTimezone}
              align="right"
            />
          ) : null}

          {/* Export CSV Action */}
          <button
            onClick={handleExportCsv}
            type="button"
            className="h-10 px-4 bg-white text-[#0c0a09] rounded-lg shadow-2xs border border-[#e7e5e4] flex items-center gap-2 hover:bg-[#f1edec] transition-all text-xs font-medium cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[18px] text-[#0c0a09]">file_download</span>
            <span>Export CSV</span>
          </button>

          {/* Print Summary Action (Disabled / Low Opacity) */}
          <button
            type="button"
            disabled
            title="Print Menu Report"
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white text-[#a8a29e] border border-[#e7e5e4] shadow-2xs opacity-40 cursor-not-allowed select-none shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
          </button>
        </div>
      </div>

      {/* 2. 4 Compact KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8 font-sans">
        {/* Card 1: Total Items Sold */}
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
              Total Items Sold
            </span>
            <span className="w-7 h-7 rounded-full bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] shrink-0 border border-[#e7e5e4]">
              <span className="material-symbols-outlined text-[16px]">inventory_2</span>
            </span>
          </div>
          <div>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-[#f1edec] rounded w-1/2"></div>
                <div className="h-4 bg-[#f1edec] rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-garamond text-3xl font-medium text-[#141010] tracking-tight tabular-nums truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {totalItemsSold.toLocaleString()}
                  </span>
                  <span className="text-[11px] sm:text-xs text-[#5e5e5e]">units</span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  Across {distinctCatalogCount} menu catalog items
                </p>
              </>
            )}
          </div>
          <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#5e5e5e] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#78716c] shrink-0"></span>
            <span className="truncate">Avg {avgItemsPerOrder} items / order</span>
          </div>
        </div>

        {/* Card 2: Total Item Revenue */}
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
              Total Item Revenue
            </span>
            <span className="w-7 h-7 rounded-full bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] shrink-0 border border-[#e7e5e4]">
              <span className="material-symbols-outlined text-[16px]">payments</span>
            </span>
          </div>
          <div>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-[#f1edec] rounded w-1/2"></div>
                <div className="h-4 bg-[#f1edec] rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-garamond text-3xl font-medium text-[#141010] tracking-tight tabular-nums truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {formatPriceWithSymbol(totalGrossPaise, currencySymbol, effectiveCountry, true)}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  Gross item sales before discounts
                </p>
              </>
            )}
          </div>
          <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#5e5e5e] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#78716c] shrink-0"></span>
            <span className="truncate">
              {formatPriceWithSymbol(avgPricePaise, currencySymbol, effectiveCountry, true)} avg unit price
            </span>
          </div>
        </div>

        {/* Card 3: Top Selling Item */}
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
              Top Selling Item
            </span>
            <span className="w-7 h-7 rounded-full bg-[#f1edec] flex items-center justify-center text-emerald-700 shrink-0 border border-[#e7e5e4]">
              <span className="material-symbols-outlined text-[16px]">military_tech</span>
            </span>
          </div>
          <div>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-[#f1edec] rounded w-1/2"></div>
                <div className="h-4 bg-[#f1edec] rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="font-garamond text-2xl font-medium text-[#141010] tracking-tight truncate">
                  {topVelocityItem ? topVelocityItem.itemName : "-"}
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  {topVelocityItem
                    ? `${topVelocityItem.unitsSold} units (${formatPriceWithSymbol(topVelocityItem.grossPaise, currencySymbol, effectiveCountry, true)})`
                    : "No sales recorded"}
                </p>
              </>
            )}
          </div>
          <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#5e5e5e] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
            <span className="truncate">
              {topVelocityItem ? `${topVelocityItem.revSharePct}% catalog share` : "Top Velocity"}
            </span>
          </div>
        </div>

        {/* Card 4: Top Category */}
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
              Top Category
            </span>
            <span className="w-7 h-7 rounded-full bg-[#0c0a09] flex items-center justify-center text-white shrink-0">
              <span className="material-symbols-outlined text-[16px]">category</span>
            </span>
          </div>
          <div>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-[#f1edec] rounded w-1/2"></div>
                <div className="h-4 bg-[#f1edec] rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="font-garamond text-2xl font-medium text-[#141010] tracking-tight truncate">
                  {topCategory ? topCategory.categoryName : "-"}
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  {topCategory
                    ? `${formatPriceWithSymbol(topCategory.grossPaise, currencySymbol, effectiveCountry, true)} (${topCategory.mixPct}% total mix)`
                    : "No categories recorded"}
                </p>
              </>
            )}
          </div>
          <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#5e5e5e] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0c0a09] shrink-0"></span>
            <span className="truncate">
              {topCategory ? `${topCategory.itemsSold} items prepared` : "Primary Mix"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Primary Section: Product Mix & Item Velocity Table */}
      <section className="bg-white rounded-xl shadow-xs border border-[#e7e5e4] overflow-hidden mb-6 sm:mb-8 font-sans">
        {/* Section Header with Controls matching Customer Report */}
        <div className="p-4 sm:p-5 border-b border-[#e7e5e4] flex flex-col md:flex-row md:items-center justify-between gap-3.5">
          <div>
            <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold block">
              Core Catalog Dissection
            </span>
            <h2
              className="text-lg sm:text-xl font-normal text-[#0c0a09] tracking-tight mt-0.5"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              Product Mix &amp; Item Velocity
            </h2>
          </div>

          {/* Filter Dropdowns: Multi-Menu & Category */}
          <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
            {/* Multi-Menu Filter */}
            {uniqueMenus.length > 0 && (
              <div className="relative">
                <select
                  value={selectedMenuFilter}
                  onChange={(e) => {
                    setSelectedMenuFilter(e.target.value);
                    setSelectedCategoryFilter("all");
                    setCurrentPage(1);
                  }}
                  className="appearance-none bg-[#fdf8f7] hover:bg-white text-xs font-medium text-[#0c0a09] pl-3.5 pr-8 py-2 rounded-lg border border-[#e7e5e4] hover:border-[#d6d3d1] focus:outline-none focus:bg-white focus:border-[#0c0a09] transition-all cursor-pointer h-[36px] shadow-2xs"
                >
                  <option value="all">All Menus</option>
                  {uniqueMenus.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <svg
                  className="w-3.5 h-3.5 text-[#78716c] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            )}

            {/* Category Filter */}
            {availableCategories.length > 0 && (
              <div className="relative">
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => {
                    setSelectedCategoryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="appearance-none bg-[#fdf8f7] hover:bg-white text-xs font-medium text-[#0c0a09] pl-3.5 pr-8 py-2 rounded-lg border border-[#e7e5e4] hover:border-[#d6d3d1] focus:outline-none focus:bg-white focus:border-[#0c0a09] transition-all cursor-pointer h-[36px] shadow-2xs"
                >
                  <option value="all">All Categories</option>
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <svg
                  className="w-3.5 h-3.5 text-[#78716c] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Table Canvas */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[880px]">
            <thead>
              <tr className="border-b border-[#e7e5e4] bg-[#fdf8f7] text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold whitespace-nowrap min-w-[200px]">Item Name</th>
                <th className="py-3 px-3.5 font-semibold whitespace-nowrap min-w-[130px]">Category</th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap min-w-[90px]">Qty Sold</th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap min-w-[100px]">Unit Price</th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap min-w-[95px]">Net</th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap min-w-[90px]">Rev Share</th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap min-w-[95px]">
                  Food Cost %
                </th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap min-w-[95px]">Gross</th>
                <th className="py-3 px-4 font-semibold text-center whitespace-nowrap min-w-[95px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0e8e2] text-xs">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="py-3 px-4">
                      <div className="animate-pulse space-y-2">
                        <div className="h-3.5 bg-[#f1edec] rounded w-1/4"></div>
                        <div className="h-3 bg-[#f1edec] rounded w-1/6"></div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-[#7f7570]">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <span className="material-symbols-outlined text-[44px] text-[#b4a9a4]">
                        restaurant_menu
                      </span>
                      <p className="font-semibold text-sm text-[#0c0a09]">No Items Found</p>
                      <p className="text-xs text-[#5e5e5e] max-w-sm">
                        No menu items matched the selected category and date range.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((it) => (
                  <tr
                    key={it.id || it.itemName}
                    className="hover:bg-[#fdf8f7] transition-colors group cursor-default"
                  >
                    {/* Item Name */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-xs text-[#0c0a09]">
                        {it.itemName}
                      </div>
                    </td>

                    {/* Category Pill */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#f1edec] text-[#0c0a09] border border-[#e7e5e4] text-[11px] font-medium whitespace-nowrap">
                        {it.categoryName}
                      </span>
                    </td>

                    {/* Qty Sold */}
                    <td className="py-3 px-3.5 whitespace-nowrap text-right tabular-nums text-xs font-medium text-[#0c0a09]">
                      {it.unitsSold.toLocaleString()}
                    </td>

                    {/* Unit Price */}
                    <td className="py-3 px-3.5 whitespace-nowrap text-right tabular-nums text-xs text-[#5e5e5e]">
                      {formatPriceWithSymbol(it.itemPricePaise, currencySymbol, effectiveCountry, true)}
                    </td>

                    {/* Subtotal (Base sales before exclusive tax) */}
                    <td className="py-3 px-3.5 whitespace-nowrap text-right tabular-nums text-xs font-semibold text-[#0c0a09]">
                      {formatPriceWithSymbol(it.netPaise, currencySymbol, effectiveCountry, true)}
                    </td>

                    {/* Rev Share % */}
                    <td className="py-3 px-3.5 whitespace-nowrap text-right tabular-nums text-xs font-medium text-[#0c0a09]">
                      {it.revSharePct}%
                    </td>

                    {/* Food Cost % */}
                    <td className="py-3 px-3.5 whitespace-nowrap text-right tabular-nums text-xs">
                      {it.hasRecipe && it.foodCostPct !== null ? (
                        <span className="font-semibold text-xs text-[#0c0a09]">
                          {it.foodCostPct}%
                        </span>
                      ) : (
                        <span
                          className="text-[#a8a29e] font-medium"
                          title="No recipe configured in Inventory"
                        >
                          -
                        </span>
                      )}
                    </td>

                    {/* Total (Total revenue including tax) */}
                    <td className="py-3 px-3.5 whitespace-nowrap text-right tabular-nums text-xs font-semibold text-[#0c0a09]">
                      {formatPriceWithSymbol(it.grossPaise, currencySymbol, effectiveCountry, true)}
                    </td>

                    {/* Action - Costing */}
                    <td className="py-3 px-4 whitespace-nowrap text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedItemForDrawer(it)}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-[#0c0a09] text-white hover:bg-[#262626] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                      >
                        <span>Costing</span>
                        <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        {filteredAndSortedItems.length > 0 && (
          <div className="px-5 py-3.5 bg-[#fdf8f7] border-t border-[#e7e5e4] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#5e5e5e]">
            <div>
              Showing{" "}
              <strong className="text-[#0c0a09] font-semibold">
                {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, filteredAndSortedItems.length)}
              </strong>{" "}
              of{" "}
              <strong className="text-[#0c0a09] font-semibold">
                {filteredAndSortedItems.length}
              </strong>{" "}
              items
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-end">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg border border-[#e7e5e4] bg-white hover:bg-[#f1edec] text-[#0c0a09] disabled:opacity-40 transition-colors cursor-pointer"
              >
                Previous
              </button>
              {Array.from({ length: totalItemPages }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                    currentPage === i + 1
                      ? "bg-[#0c0a09] text-white shadow-2xs"
                      : "bg-white border border-[#e7e5e4] text-[#0c0a09] hover:bg-[#f1edec]"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage === totalItemPages || totalItemPages === 0}
                onClick={() => setCurrentPage((p) => Math.min(totalItemPages, p + 1))}
                className="px-3 py-1 rounded-lg border border-[#e7e5e4] bg-white hover:bg-[#f1edec] text-[#0c0a09] disabled:opacity-40 transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 4. Category Performance Section (from HTML Prototype) */}
      <section className="bg-white rounded-xl p-4 sm:p-6 shadow-xs border border-[#e7e5e4] mb-6 sm:mb-8 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold block">
              Portfolio Allocation
            </span>
            <h2
              className="text-lg sm:text-xl font-normal text-[#0c0a09] tracking-tight mt-0.5"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              Category Revenue Contribution
            </h2>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold block">
              Aggregate Category Turnover
            </span>
            <div
              className="text-lg sm:text-xl font-normal text-[#0c0a09] tabular-nums"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              {formatPriceWithSymbol(totalGrossPaise, currencySymbol, effectiveCountry, true)}
            </div>
          </div>
        </div>

        {/* Segmented Visual Bar */}
        <div className="w-full h-3.5 rounded-full bg-[#f1edec] overflow-hidden flex border border-[#e7e5e4]/60 mb-5">
          {categoryList.length === 0 ? (
            <div className="h-full w-full bg-[#f1edec]" />
          ) : (
            categoryList.map((c) => (
              <div
                key={c.categoryName}
                className="h-full transition-all duration-500"
                style={{
                  width: `${Math.max(1, c.mixPct)}%`,
                  backgroundColor: c.color,
                }}
                title={`${c.categoryName}: ${c.mixPct}% (${formatPriceWithSymbol(c.grossPaise, currencySymbol, effectiveCountry, true)})`}
              />
            ))
          )}
        </div>

        {/* Horizontal Category Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {categoryList.slice(0, 5).map((c) => (
            <div
              key={c.categoryName}
              className="bg-[#fdf8f7] p-3.5 rounded-xl border border-[#e7e5e4] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="text-xs font-semibold text-[#0c0a09] truncate">
                    {c.categoryName}
                  </span>
                </div>
                <div
                  className="text-base sm:text-lg font-medium text-[#141010] tabular-nums"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  {formatPriceWithSymbol(c.grossPaise, currencySymbol, effectiveCountry, true)}
                </div>
              </div>
              <div className="text-[11px] text-[#5e5e5e] mt-3 pt-1.5 border-t border-[#e7e5e4] flex justify-between items-center">
                <span>{c.mixPct}% mix</span>
                <span className="tabular-nums">{c.itemsSold} units</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Bottom Menu Insight Summary Area (4-Cell Analytical Recap from HTML Prototype) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 font-sans">
        {/* Insight 1: Top Velocity Item */}
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-xs border border-[#e7e5e4] flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-full bg-[#f1edec] border border-[#e7e5e4] flex items-center justify-center shrink-0 text-[#0c0a09]">
            <span className="material-symbols-outlined text-[20px]">trending_up</span>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold block">
              Top Velocity Item
            </span>
            <div className="font-semibold text-xs sm:text-sm text-[#0c0a09] mt-0.5 truncate">
              {topVelocityItem ? topVelocityItem.itemName : "-"}
            </div>
            <div className="text-[11px] text-[#5e5e5e] mt-0.5 truncate">
              {topVelocityItem
                ? `${topVelocityItem.unitsSold} units dispatched in session`
                : "No sales recorded"}
            </div>
          </div>
        </div>

        {/* Insight 2: High Margin Star */}
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-xs border border-[#e7e5e4] flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-full bg-[#f1edec] border border-[#e7e5e4] flex items-center justify-center shrink-0 text-emerald-700">
            <span className="material-symbols-outlined text-[20px]">star</span>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold block">
              High Margin Star
            </span>
            <div className="font-semibold text-xs sm:text-sm text-[#0c0a09] mt-0.5 truncate">
              {highMarginStar ? highMarginStar.itemName : "-"}
            </div>
            <div className="text-[11px] text-[#5e5e5e] mt-0.5 truncate">
              {highMarginStar
                ? highMarginStar.foodCostPct !== null
                  ? `${(100 - highMarginStar.foodCostPct).toFixed(1)}% margin (${highMarginStar.unitsSold} sold)`
                  : `${highMarginStar.unitsSold} units sold`
                : "Optimal benchmark"}
            </div>
          </div>
        </div>

        {/* Insight 3: Primary Revenue Driver */}
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-xs border border-[#e7e5e4] flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-full bg-[#f1edec] border border-[#e7e5e4] flex items-center justify-center shrink-0 text-[#0c0a09]">
            <span className="material-symbols-outlined text-[20px]">attach_money</span>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold block">
              Primary Revenue Driver
            </span>
            <div className="font-semibold text-xs sm:text-sm text-[#0c0a09] mt-0.5 truncate">
              {primaryRevenueDriver ? primaryRevenueDriver.itemName : "-"}
            </div>
            <div className="text-[11px] text-[#5e5e5e] mt-0.5 truncate">
              {primaryRevenueDriver
                ? `${formatPriceWithSymbol(primaryRevenueDriver.grossPaise, currencySymbol, effectiveCountry, true)} across orders`
                : "No orders"}
            </div>
          </div>
        </div>

        {/* Insight 4: Average Food Cost / Average Ticket */}
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-xs border border-[#e7e5e4] flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-full bg-[#f1edec] border border-[#e7e5e4] flex items-center justify-center shrink-0 text-[#0c0a09]">
            <span className="material-symbols-outlined text-[20px]">pie_chart</span>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold block">
              Average Unit Price
            </span>
            <div className="font-semibold text-xs sm:text-sm text-[#0c0a09] mt-0.5 truncate">
              {formatPriceWithSymbol(avgPricePaise, currencySymbol, effectiveCountry, true)}
            </div>
            <div className="text-[11px] text-[#5e5e5e] mt-0.5 truncate">
              Within optimal food cost benchmark (&lt;32.0%)
            </div>
          </div>
        </div>
      </section>

      {/* 6. Item Costing & Breakdown Slide-over Drawer */}
      {selectedItemForDrawer && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-fadeIn font-sans"
          onClick={() => setSelectedItemForDrawer(null)}
        >
          <div
            className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between border-l border-[#e7e5e4] animate-slideInRight"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#e7e5e4] flex items-center justify-between bg-[#fdf8f7]">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#5e5e5e] font-semibold block">
                  Recipe Costing &amp; Velocity Audit
                </span>
                <h3
                  className="font-garamond text-xl font-normal text-[#0c0a09] mt-0.5"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  {selectedItemForDrawer.itemName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemForDrawer(null)}
                className="w-8 h-8 rounded-full bg-white border border-[#e7e5e4] flex items-center justify-center text-[#5e5e5e] hover:text-[#0c0a09] hover:bg-[#f1edec] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Drawer Body Scroll */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Category & Price Badge */}
              <div className="flex items-center justify-between p-3.5 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4]">
                <div>
                  <span className="text-[11px] text-[#5e5e5e] block">Category</span>
                  <span className="font-semibold text-xs text-[#0c0a09] mt-0.5 inline-block px-2.5 py-0.5 rounded-full bg-white border border-[#e7e5e4]">
                    {selectedItemForDrawer.categoryName}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-[#5e5e5e] block">Catalog Unit Price</span>
                  <span className="font-semibold text-sm text-[#0c0a09] tabular-nums mt-0.5 block">
                    {formatPriceWithSymbol(
                      selectedItemForDrawer.itemPricePaise,
                      currencySymbol,
                      effectiveCountry,
                      true
                    )}
                  </span>
                </div>
              </div>

              {/* Financial Calculation Breakdown */}
              <div className="p-4 bg-white rounded-xl border border-[#e7e5e4] space-y-2.5">
                <span className="text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold block mb-1">
                  Financial Reconciliation
                </span>
                <div className="flex items-center justify-between text-[#5e5e5e]">
                  <span>Units Dispatched</span>
                  <span className="tabular-nums font-semibold text-[#0c0a09]">
                    {selectedItemForDrawer.unitsSold} units
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#5e5e5e]">
                  <span>Net Amount</span>
                  <span className="tabular-nums font-medium text-[#0c0a09]">
                    {formatPriceWithSymbol(
                      selectedItemForDrawer.netPaise,
                      currencySymbol,
                      effectiveCountry,
                      true
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#5e5e5e]">
                  <span>Estimated Tax</span>
                  <span className="tabular-nums font-medium text-[#5e5e5e]">
                    {selectedItemForDrawer.taxPaise > 0
                      ? formatPriceWithSymbol(
                          selectedItemForDrawer.taxPaise,
                          currencySymbol,
                          effectiveCountry,
                          true
                        )
                      : "₹ 0.00 (Inclusive)"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#5e5e5e]">
                  <span>Catalog Revenue Share</span>
                  <span className="tabular-nums font-medium text-[#0c0a09]">
                    {selectedItemForDrawer.revSharePct}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#5e5e5e]">
                  <span>Theoretical Food Cost %</span>
                  {selectedItemForDrawer.hasRecipe && selectedItemForDrawer.foodCostPct !== null ? (
                    <span className="tabular-nums font-semibold text-[#0c0a09]">
                      {selectedItemForDrawer.foodCostPct}%
                    </span>
                  ) : (
                    <span className="tabular-nums font-medium text-[#a8a29e]" title="No recipe configured in Inventory">
                      - (Not configured)
                    </span>
                  )}
                </div>
                {selectedItemForDrawer.hasRecipe && selectedItemForDrawer.recipeCostPaise ? (
                  <>
                    <div className="flex items-center justify-between text-[#5e5e5e]">
                      <span>Theoretical Recipe Cost</span>
                      <span className="tabular-nums font-semibold text-[#0c0a09]">
                        {formatPriceWithSymbol(
                          selectedItemForDrawer.recipeCostPaise,
                          currencySymbol,
                          effectiveCountry,
                          true
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[#5e5e5e]">
                      <span>Gross Profit Margin</span>
                      <span className="tabular-nums font-semibold text-emerald-700">
                        {selectedItemForDrawer.foodCostPct !== null
                          ? (100 - selectedItemForDrawer.foodCostPct).toFixed(1)
                          : 0}%{" "}
                        ({formatPriceWithSymbol(
                          Math.max(0, selectedItemForDrawer.itemPricePaise - selectedItemForDrawer.recipeCostPaise),
                          currencySymbol,
                          effectiveCountry,
                          true
                        )})
                      </span>
                    </div>
                  </>
                ) : null}
                <div className="pt-2 border-t border-[#e7e5e4] flex items-center justify-between">
                  <span className="font-semibold text-xs text-[#0c0a09]">Gross Total</span>
                  <span
                    className="font-garamond text-xl font-medium text-[#141010] tabular-nums"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {formatPriceWithSymbol(
                      selectedItemForDrawer.grossPaise,
                      currencySymbol,
                      effectiveCountry,
                      true
                    )}
                  </span>
                </div>
              </div>

              {/* Recipe Bill of Materials (BOM) */}
              {selectedItemForDrawer.hasRecipe && selectedItemForDrawer.recipeIngredients && selectedItemForDrawer.recipeIngredients.length > 0 ? (
                <div className="p-4 bg-white rounded-xl border border-[#e7e5e4] shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
                      Recipe Bill of Materials (BOM)
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#f1edec] text-[#0c0a09] border border-[#e7e5e4] font-medium">
                      {selectedItemForDrawer.recipeIngredients.length} ingredients
                    </span>
                  </div>

                  <div className="divide-y divide-[#f0e8e2] text-xs">
                    {selectedItemForDrawer.recipeIngredients.map((ing, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-[#0c0a09]">{ing.name}</div>
                          <div className="text-[11px] text-[#78716c]">
                            {ing.quantity} {ing.unit} @ {formatPriceWithSymbol(Math.round(ing.unitCost * 100), currencySymbol, effectiveCountry, true)} / {ing.buyingUnit}
                          </div>
                        </div>
                        <div className="font-semibold tabular-nums text-[#0c0a09]">
                          {formatPriceWithSymbol(ing.lineCostPaise, currencySymbol, effectiveCountry, true)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                    <span className="material-symbols-outlined text-[16px] text-amber-700">info</span>
                    <span>Recipe Not Linked</span>
                  </div>
                  <p className="text-amber-800 leading-relaxed text-[11px]">
                    This dish doesn't have an active recipe configured in Inventory. Link raw ingredients in <strong>Inventory &gt; Item Recipes</strong> to calculate live food cost % and gross margins.
                  </p>
                </div>
              )}

              {/* Velocity by Channel */}
              <div className="p-4 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] space-y-2">
                <span className="text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold block mb-1">
                  Channel Distribution
                </span>
                <div className="flex items-center justify-between text-[#5e5e5e]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px]">table_restaurant</span>
                    <span>Dine-In</span>
                  </span>
                  <span className="tabular-nums font-medium text-[#0c0a09]">
                    {selectedItemForDrawer.channelBreakdown.dineInUnits} units (
                    {formatPriceWithSymbol(
                      selectedItemForDrawer.channelBreakdown.dineInGross,
                      currencySymbol,
                      effectiveCountry,
                      true
                    )}
                    )
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#5e5e5e]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px]">shopping_bag</span>
                    <span>Takeaway</span>
                  </span>
                  <span className="tabular-nums font-medium text-[#0c0a09]">
                    {selectedItemForDrawer.channelBreakdown.takeawayUnits} units (
                    {formatPriceWithSymbol(
                      selectedItemForDrawer.channelBreakdown.takeawayGross,
                      currencySymbol,
                      effectiveCountry,
                      true
                    )}
                    )
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#5e5e5e]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px]">two_wheeler</span>
                    <span>Delivery</span>
                  </span>
                  <span className="tabular-nums font-medium text-[#0c0a09]">
                    {selectedItemForDrawer.channelBreakdown.deliveryUnits} units (
                    {formatPriceWithSymbol(
                      selectedItemForDrawer.channelBreakdown.deliveryGross,
                      currencySymbol,
                      effectiveCountry,
                      true
                    )}
                    )
                  </span>
                </div>
              </div>

              {/* Recent Orders featuring this item */}
              {selectedItemForDrawer.recentOrders.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold block">
                    Recent Orders with this Item
                  </span>
                  <div className="space-y-1.5">
                    {selectedItemForDrawer.recentOrders.map((ord, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg border border-[#e7e5e4] bg-white flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-[#0c0a09]">
                            #{ord.orderNumber}
                          </div>
                          <div className="text-[11px] text-[#5e5e5e]">
                            {formatStoreDate(ord.createdAt, effectiveCountry, effectiveTimezone)},{" "}
                            {formatStoreTime(ord.createdAt, effectiveTimezone, effectiveCountry)} •{" "}
                            {ord.orderType}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-[#0c0a09] tabular-nums block">
                            {formatPriceWithSymbol(
                              ord.grossAmountPaise,
                              currencySymbol,
                              effectiveCountry,
                              true
                            )}
                          </span>
                          <span className="text-[11px] text-[#5e5e5e]">{ord.quantity}x ordered</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 bg-[#fdf8f7] border-t border-[#e7e5e4] flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedItemForDrawer(null)}
                className="px-4 py-2 rounded-lg bg-[#0c0a09] text-white hover:bg-[#262626] text-xs font-medium transition-colors cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standard Menu Toaster Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
