"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { CustomerCartProvider, useCustomerCart } from "./CustomerCartContext";
import { CustomerCartView } from "./CustomerCartView";
import { CustomerHeader } from "./CustomerHeader";
import { TableContextCard } from "./TableContextCard";
import { ServiceModeSwitcher } from "./ServiceModeSwitcher";
import { PromotionHeroCard } from "./PromotionHeroCard";
import { MenuCategoryScroll } from "./MenuCategoryScroll";
import { PopularProductsSection } from "./PopularProductsSection";
import { KitchenInfoBanner } from "./KitchenInfoBanner";
import { StickyCartBar } from "./StickyCartBar";
import { CustomerBottomNav, CustomerNavTab } from "./CustomerBottomNav";
import { CustomerLoadingSkeleton } from "./CustomerLoadingSkeleton";
import { CustomerErrorView } from "./CustomerErrorView";
import {
  CustomerCategory,
  CustomerMenuItem,
  CustomerSessionResult,
  CustomerOrganization,
  CustomerTable,
} from "./types";

interface CustomerOrderingHomeProps {
  qrId?: string;
  tableId?: string;
  tableNumber?: string;
  identifier?: string;
  initialTab?: CustomerNavTab;
}

// Fallback demo categories & items if the store menu has not been populated yet
const DEMO_CATEGORIES: CustomerCategory[] = [
  {
    category: {
      id: "demo_cat_combos",
      name: "Combos",
      position: 1,
      published: true,
      items: [
        {
          category_item_id: "demo_ci_1",
          customizations: [],
          item: {
            id: "demo_item_1",
            name: "Signature Veg Bao Bun",
            price: 21900,
            display_price: "219.00",
            original_price: 24900,
            badge: "Bestseller",
            serving_size: "2 pcs • House Pickles",
            description:
              "Fluffy steamed lotus buns filled with crisp pickled veggies, micro herbs & umami glaze.",
            published: true,
            is_available: true,
            is_veg: true,
            item_image_url:
              "https://lh3.googleusercontent.com/aida-public/AB6AXuAwEvQvX2aQQolwfaJuMZhSxwEP0SMCD3ek-nBXPlzNHMVFqHMI1j_4uZiqKLZZl-mUMF1YC86yPr-sg42KFkOEeFC0v8OmfxTG08srpUr9ErMX9i0csp9larL30VHJbRlwZAWWVDqiVj-1TSm1n0XK7Cp2SDejWO2RoOaRIlS481XfhuBxxzv15M4NjF4r4UD7_gzVesDT200s8byK13pJzOhmOhVcXVtq-_5xqaqF5oqMSkeuXgYU4w",
            customizations: [
              {
                id: "cust_required_option",
                name: "Choose Option",
                customization_type: "Add-Ons",
                required: true,
                max_selected: 1,
                position: 1,
                published: true,
                customization_items: [
                  {
                    id: "opt_bao_duo",
                    name: "Standard Bao Duo (2 pcs)",
                    price: 0,
                    display_price: "0.00",
                    is_available: true,
                    position: 1,
                    description: "2 freshly steamed bao buns with house garnish",
                  },
                  {
                    id: "opt_meal_combo",
                    name: "Medium Meal Combo",
                    price: 8000,
                    display_price: "80.00",
                    is_available: true,
                    position: 2,
                    description: "Includes salted crisps & iced refresher drink",
                  },
                  {
                    id: "opt_feast_box",
                    name: "Bao Feast Box",
                    price: 13000,
                    display_price: "130.00",
                    is_available: true,
                    position: 3,
                    description: "4 bao buns + 2 signature dips + beverage",
                  },
                ],
              },
              {
                id: "cust_addons",
                name: "Add-Ons & Extras",
                customization_type: "Add-Ons",
                required: false,
                max_selected: 4,
                position: 2,
                published: true,
                customization_items: [
                  {
                    id: "addon_cheese",
                    name: "Extra Melted Cheese Slice",
                    price: 2400,
                    display_price: "24.00",
                    is_available: true,
                    position: 1,
                  },
                  {
                    id: "addon_dip",
                    name: "Extra Peri Peri Dip",
                    price: 3500,
                    display_price: "35.00",
                    is_available: true,
                    position: 2,
                  },
                  {
                    id: "addon_patty",
                    name: "Extra Crispy Patty",
                    price: 6500,
                    display_price: "65.00",
                    is_available: true,
                    position: 3,
                  },
                ],
              },
              {
                id: "cust_preparations",
                name: "Chef Prep Preferences",
                customization_type: "Preparations",
                required: false,
                max_selected: 5,
                position: 3,
                published: true,
                customization_items: [
                  {
                    id: "prep_no_onion",
                    name: "No Onion",
                    price: 0,
                    display_price: "0.00",
                    is_available: true,
                    position: 1,
                  },
                  {
                    id: "prep_no_tomato",
                    name: "No Tomato",
                    price: 0,
                    display_price: "0.00",
                    is_available: true,
                    position: 2,
                  },
                  {
                    id: "prep_no_lettuce",
                    name: "No Lettuce",
                    price: 0,
                    display_price: "0.00",
                    is_available: true,
                    position: 3,
                  },
                  {
                    id: "prep_less_spicy",
                    name: "Less Spicy",
                    price: 0,
                    display_price: "0.00",
                    is_available: true,
                    position: 4,
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  },
  {
    category: {
      id: "demo_cat_momos",
      name: "Momos",
      position: 2,
      published: true,
      items: [
        {
          category_item_id: "demo_ci_2",
          customizations: [],
          item: {
            id: "demo_item_2",
            name: "Steamed Veg Momos",
            price: 19900,
            display_price: "199.00",
            badge: "Chef Recommended",
            serving: 6,
            serving_size: "6 pcs • Spicy Dip Included",
            description:
              "Hand-pleated parcels stuffed with seasoned garden vegetables, scallions, and roasted garlic.",
            published: true,
            is_available: true,
            is_veg: true,
            item_image_url:
              "https://lh3.googleusercontent.com/aida-public/AB6AXuDa4aAuZCoS9KksZ3ZJOKBckCu5x3mGmPtTyJIQ3TgiOdYuOxy9MpDK_WS6CmcSrgCYDcal5pV3_Dis_AD5ePBhHOysZPgI_dLcqfvQ0Go-AEFGoc46gHzwjL1I_UjffalAF2cMazCYq8Eiq_MT6tEQMXT5pR_AFMKP1K3K64h38toEH8ym7VOcqhZaogmJqtqguW9WOlvjz000V8KLYSU5akkXjlW3CHKWRfWIfUb2mSuOEsvZlMzHnw",
          },
        },
      ],
    },
  },
  {
    category: {
      id: "demo_cat_bao",
      name: "Bao & Breads",
      position: 3,
      published: true,
      items: [
        {
          category_item_id: "demo_ci_3",
          customizations: [],
          item: {
            id: "demo_item_3",
            name: "Cheese Filled Garlic Bread",
            price: 19900,
            display_price: "199.00",
            serving_size: "3 slices • Herb Marinara",
            description:
              "Toasted artisan baguette overloaded with melted mozzarella, roasted garlic butter and oregano.",
            published: true,
            is_available: true,
            is_veg: true,
            item_image_url:
              "https://lh3.googleusercontent.com/aida-public/AB6AXuBhZ_oBAA9FHlpgn6QN8B3x57mKe8bB3U-_7R4z263yVKyH8tyDxlaM_pAK-XrAcdOtaqjHUVkGJF8y-uMhCwx3Ffm9oaPRpjmtPIBT9mj5c2X3MAzy439m5Y9wN6LueSe8-P1zkUQQVlWHhuQw_BdVPJrEXsdohsm92ZirG1YDdMFMgU-jGbCuEDsQO51B61r2-1BktLffFHlBXe1vr83txLlBRu-p9bc6vpDzacvCuctev3-ejjxPwQ",
          },
        },
      ],
    },
  },
  {
    category: {
      id: "demo_cat_beverages",
      name: "Beverages",
      position: 4,
      published: true,
      items: [
        {
          category_item_id: "demo_ci_4",
          customizations: [],
          item: {
            id: "demo_item_4",
            name: "Iced Vietnamese Cold Brew",
            price: 21000,
            display_price: "210.00",
            badge: "Barista Choice",
            serving_size: "330 ml • Slow Dripped",
            description:
              "18-hour cold brew steeped dark roast coffee poured over sweetened condensed milk & crushed ice.",
            published: true,
            is_available: true,
            is_veg: true,
            item_image_url:
              "https://lh3.googleusercontent.com/aida-public/AB6AXuDWdXlOFjycMfdbmYNC7YUe1B4fBsrWJdn7kWWzt2YDZW-_v3ZFuzyVU6uKymjyNxFqSFLZT3kQQfrEQ_fpjWnLPgqiFRwWKqqEgRGytU8DLCBMTgLl2Y8ibGmVyDDp_Dp8CEV7wOnr82ABMiTIZYNZ2BQ_nTHkV_1Y9WJBwaZU7Dcgd04PnP2Qy9sz6Gx3VM_bHq4T3f4tlrk1xxe-FgQAahTMi9J2e3EJsrpAITJIYKktrsHrXwwA6w",
          },
        },
      ],
    },
  },
];

export function CustomerOrderingHome({
  qrId,
  tableId,
  tableNumber,
  identifier,
  initialTab = "home",
}: CustomerOrderingHomeProps) {
  // Navigation & Search State
  const [activeTab, setActiveTab] = useState<CustomerNavTab>(initialTab);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // 1. Resolve Session from Convex (Public Query)
  const sessionResult = useQuery(api.organizationQrCodes.resolveCustomerSession, {
    qrId: qrId || undefined,
    tableId: tableId || undefined,
    tableNumber: tableNumber || (!qrId && !tableId && !identifier ? "T12" : undefined),
    identifier: identifier || undefined,
  }) as CustomerSessionResult | undefined;

  // 2. Fetch Menu for resolved organization (Public Query)
  const orgId = sessionResult?.valid ? (sessionResult.organization?._id as Id<"organizations">) : undefined;

  const rawMenu = useQuery(
    api.menu.getOrganizationMenu,
    orgId ? { organizationId: orgId } : "skip"
  ) as Array<any> | undefined;

  // 3. Fetch Promotional Carousel Slides (Public Query)
  const carouselSlides = useQuery(api.organizationCarouselScreens.listPublic, {}) as
    | Array<{ _id: string; imageUrl?: string | null; fileName?: string; position?: number }>
    | undefined;

  // Loading State
  if (sessionResult === undefined) {
    return <CustomerLoadingSkeleton />;
  }

  // Error / Inactive Table State
  if (!sessionResult.valid) {
    return (
      <CustomerErrorView
        title={sessionResult.errorCode === "TABLE_BLOCKED" ? "Table Unavailable" : "Table QR Not Active"}
        message={sessionResult.error}
        organization={sessionResult.organization}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const organization: CustomerOrganization = sessionResult.organization || {
    _id: "org_default",
    name: "Skyz Bistro & Banquet",
    slug: "skyz-bistro",
    isVeg: false,
    defaultCurrencySymbol: "₹",
  };

  const table: CustomerTable = sessionResult.table || {
    _id: "tbl_default",
    tableNumber: tableNumber || "T12",
    placement: "Ground Terrace",
    seatingCapacity: 4,
    layoutName: "Ground Terrace",
  };

  return (
    <CustomerCartProvider
      tableId={table._id}
      currencySymbol={organization.defaultCurrencySymbol || "₹"}
    >
      <CustomerOrderingHomeView
        organization={organization}
        table={table}
        qr={sessionResult.qr}
        rawMenu={rawMenu}
        carouselSlides={carouselSlides}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isSearchOpen={isSearchOpen}
        onToggleSearch={() => setIsSearchOpen((prev) => !prev)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
      />
    </CustomerCartProvider>
  );
}

function CustomerOrderingHomeView({
  organization,
  table,
  qr,
  rawMenu,
  carouselSlides,
  activeTab,
  onSelectTab,
  isSearchOpen,
  onToggleSearch,
  searchQuery,
  onSearchChange,
  selectedCategoryId,
  onSelectCategory,
}: {
  organization: CustomerOrganization;
  table: CustomerTable;
  qr?: any;
  rawMenu?: Array<any>;
  carouselSlides?: Array<any>;
  activeTab: CustomerNavTab;
  onSelectTab: (tab: CustomerNavTab) => void;
  isSearchOpen: boolean;
  onToggleSearch: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
}) {
  // Normalize categories & items
  const categories: CustomerCategory[] = useMemo(() => {
    if (rawMenu && rawMenu.length > 0) {
      return rawMenu.map((item: any) => ({
        category: {
          id: item.category.id,
          name: item.category.name,
          position: item.category.position,
          published: item.category.published ?? true,
          imageUrl: item.category.imageUrl || null,
          items: (item.category.items || []).map((ci: any) => {
            const resolvedImg =
              ci.item_image_url ||
              ci.item?.item_image_url ||
              ci.item?.imageUrl ||
              ci.imageUrl ||
              (typeof ci.item?.image === "string" ? ci.item.image : undefined) ||
              (typeof ci.image === "string" ? ci.image : undefined);

            return {
              category_item_id: ci.category_item_id || ci._id || `ci_${ci.item?.id || ci.item?._id}`,
              customizations: ci.customizations || ci.item?.customizations || [],
              item_image_url: resolvedImg,
              item: {
                id: ci.item.id || ci.item._id,
                name: ci.item.name,
                price: ci.item.price,
                display_price: ci.item.display_price || (ci.item.price / 100).toFixed(2),
                description: ci.item.description,
                published: ci.item.published ?? true,
                is_available: ci.item.is_available ?? true,
                is_veg: ci.item.is_veg ?? true,
                is_spicy: ci.item.is_spicy,
                serving_size: ci.item.serving_size,
                serving: ci.item.serving,
                mark_as_bestseller: ci.item.mark_as_bestseller,
                badge: ci.item.mark_as_bestseller
                  ? "Bestseller"
                  : ci.item.favourite_item
                    ? "Chef Recommended"
                    : undefined,
                customizations: ci.customizations || ci.item?.customizations || [],
                item_image_url: resolvedImg,
              },
            };
          }),
        },
      }));
    }
    return DEMO_CATEGORIES;
  }, [rawMenu]);

  // Smooth scroll to products section
  const scrollToProducts = () => {
    onSelectCategory(null);
    const el = document.getElementById("products-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Flatten and filter products
  const displayProducts: CustomerMenuItem[] = useMemo(() => {
    let allItems: CustomerMenuItem[] = [];

    if (selectedCategoryId) {
      const selectedCat = categories.find((c) => c.category.id === selectedCategoryId);
      if (selectedCat) {
        allItems = selectedCat.category.items.map((ci) => ci.item);
      }
    } else {
      categories.forEach((catObj) => {
        catObj.category.items.forEach((ci) => {
          allItems.push(ci.item);
        });
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      allItems = allItems.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query)
      );
    }

    return allItems;
  }, [categories, selectedCategoryId, searchQuery]);

  const { totalItemCount } = useCustomerCart();

  const activeCategoryTitle = selectedCategoryId
    ? categories.find((c) => c.category.id === selectedCategoryId)?.category.name
    : undefined;

  // Render SCREEN 3: Your Cart / Table Order when on the "orders" tab
  if (activeTab === "orders") {
    return (
      <div className="bg-[#faf8ff] font-sans antialiased text-[#131b2e] min-h-screen flex flex-col selection:bg-[#e3dfff] selection:text-[#2a14b4]">
        {/* 1. Fixed Header */}
        <CustomerHeader
          organization={organization}
          isSearchOpen={isSearchOpen}
          onToggleSearch={onToggleSearch}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
        />

        {/* 2. Main Content Container (Max 480px with top & bottom clearance) */}
        <main className="flex-1 w-full max-w-[480px] mx-auto pt-20 pb-44 px-4 flex flex-col gap-3 min-h-screen">
          <CustomerCartView
            organization={organization}
            table={table}
            rawMenu={rawMenu}
            onBackToMenu={() => onSelectTab("home")}
          />
        </main>

        {/* 3. Fixed Bottom Navigation */}
        <CustomerBottomNav
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          orderCount={totalItemCount}
        />
      </div>
    );
  }

  return (
    <div className="bg-[#faf8ff] font-sans antialiased text-[#131b2e] min-h-screen flex flex-col selection:bg-[#e3dfff] selection:text-[#2a14b4]">
      {/* 1. Header */}
      <CustomerHeader
        organization={organization}
        isSearchOpen={isSearchOpen}
        onToggleSearch={onToggleSearch}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
      />

      {/* 2. Main Content Container (Max 480px) */}
      <main className="flex-1 w-full max-w-[480px] mx-auto pt-20 pb-44 px-4 flex flex-col gap-5">
        {/* Table Context Card */}
        <TableContextCard table={table} qr={qr} />

        {/* Service Mode Switcher */}
        <ServiceModeSwitcher table={table} organization={organization} />

        {/* Promotional / Hero Card */}
        <PromotionHeroCard
          slides={carouselSlides}
          onExploreSpecials={scrollToProducts}
        />

        {/* Menu Category Scroll */}
        <MenuCategoryScroll
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={onSelectCategory}
          onViewAllClick={scrollToProducts}
        />

        {/* Popular Right Now Products */}
        <PopularProductsSection
          items={displayProducts}
          organization={organization}
          categoryTitle={activeCategoryTitle}
          isFiltered={!!selectedCategoryId || !!searchQuery}
        />

        {/* Kitchen Information Banner */}
        <KitchenInfoBanner table={table} />

        {/* Sticky Floating Dine-In Cart Bar */}
        <StickyCartBar
          table={table}
          onViewCart={() => onSelectTab("orders")}
        />

        {/* Extra Bottom Scroll Clearance for Mobile Screens */}
        <div className="h-20 w-full flex-shrink-0" aria-hidden="true" />
      </main>

      {/* 3. Fixed Bottom Navigation */}
      <CustomerBottomNav
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        orderCount={totalItemCount}
      />
    </div>
  );
}
