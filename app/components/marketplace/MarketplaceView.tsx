"use client";

import { useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  MarketplaceApp,
  MarketplaceCategory,
  MarketplaceSortOption,
  MarketplaceTab,
} from "./types";
import {
  INITIAL_MARKETPLACE_APPS,
  filterAndSortApps,
} from "../../lib/services/marketplaceService";
import { PosShell } from "../PosShell";
import { MarketplaceHeader } from "./MarketplaceHeader";
import { MarketplaceCard } from "./MarketplaceCard";
import { MarketplacePurchaseModal } from "./MarketplacePurchaseModal";
import { MarketplaceDetailDrawer } from "./MarketplaceDetailDrawer";
import { MarketplaceWalletView } from "./MarketplaceWalletView";
import { Toast, type ToastMessage } from "../Toast";

export function MarketplaceView() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // 1. Interactive State
  const [walletBalance, setWalletBalance] = useState<number>(8000);
  const [activeScenario, setActiveScenario] = useState<"A" | "B">("A");
  const tabParam = searchParams.get("tab") as MarketplaceTab | null;
  const [internalTab, setInternalTab] = useState<MarketplaceTab>("explore");

  const activeTab: MarketplaceTab =
    tabParam && ["explore", "installed", "categories", "purchases", "wallet"].includes(tabParam)
      ? tabParam
      : internalTab;

  const handleTabChange = (tab: MarketplaceTab) => {
    setInternalTab(tab);
    router.push(`/marketplace?tab=${tab}`, { scroll: false });
  };
  const [activeCategory, setActiveCategory] = useState<MarketplaceCategory>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortOption, setSortOption] = useState<MarketplaceSortOption>("recommended");

  // 2. Purchased Apps State
  const [purchasedAppIds, setPurchasedAppIds] = useState<string[]>([]);

  // 3. Modal & Drawer State
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<MarketplaceApp | null>(null);

  // 4. Standard Toast Notification State (same as Menu)
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "success",
    subtext?: string
  ) => {
    setToast({ message, type, subtext });
  };

  // Switch Scenario Logic
  const handleScenarioChange = (scenario: "A" | "B") => {
    setActiveScenario(scenario);
    if (scenario === "A") {
      setWalletBalance(8000);
      showToast("Wallet balance: ₹8,000");
    } else {
      setWalletBalance(2000);
      showToast("Wallet balance: ₹2,000", "warning");
    }
    setSelectedApp(INITIAL_MARKETPLACE_APPS[0]);
    setIsPurchaseModalOpen(true);
  };

  // Add Money / Wallet Recharge Simulation
  const handleAddMoney = (amount: number = 5000) => {
    setWalletBalance((prev) => prev + amount);
    showToast(`₹${amount.toLocaleString("en-IN")} added to wallet`);
  };

  // Handle Action Button Clicks
  const handleActionClick = (app: MarketplaceApp) => {
    const isHero = app.slug === "prest-whatsapp-automation";
    const isPurchased = purchasedAppIds.includes(app.id);

    if (isHero) {
      if (isPurchased) {
        showToast("WhatsApp Automation is active");
        return;
      }
      setSelectedApp(app);
      setIsPurchaseModalOpen(true);
      return;
    }

    if (app.actionType === "purchase") {
      setSelectedApp(app);
      setIsPurchaseModalOpen(true);
      return;
    }

    if (app.actionType === "details") {
      setSelectedApp(app);
      setIsDrawerOpen(true);
      return;
    }

    // Interactive Toast feedback for other apps
    switch (app.actionType) {
      case "setup":
      case "settings":
      case "open":
        showToast(`Opening ${app.title}`);
        break;
      case "fix":
        showToast(`Authenticating ${app.title}`);
        break;
      case "install":
        showToast(`${app.title} installed`);
        setPurchasedAppIds((prev) => [...prev, app.id]);
        break;
      default:
        showToast(`Opening ${app.title}`);
    }
  };

  // Handle Card Body Click (Opens Drawer)
  const handleCardClick = (app: MarketplaceApp) => {
    setSelectedApp(app);
    setIsDrawerOpen(true);
  };

  // Handle Purchase Confirmation in Modal
  const handleConfirmPurchase = (app: MarketplaceApp) => {
    const price = app.priceAmount > 0 ? app.priceAmount : 5000;

    // Deduct from wallet: e.g. ₹8,000 - ₹5,000 = ₹3,000
    setWalletBalance((prev) => Math.max(0, prev - price));

    // Register as purchased
    setPurchasedAppIds((prev) => (prev.includes(app.id) ? prev : [...prev, app.id]));

    showToast(`${app.title} activated successfully`);
  };

  // Filter and Sort Apps
  const filteredApps = useMemo(() => {
    const appsWithPurchased = INITIAL_MARKETPLACE_APPS.map((app) => ({
      ...app,
      isInstalled: app.isInstalled || purchasedAppIds.includes(app.id),
    }));

    return filterAndSortApps(
      appsWithPurchased,
      activeCategory,
      searchQuery,
      sortOption,
      activeTab
    );
  }, [activeCategory, searchQuery, sortOption, activeTab, purchasedAppIds]);

  return (
    <PosShell
      title="Marketplace"
      subtitle={
        activeTab === "wallet"
          ? "Wallet"
          : activeTab === "installed"
          ? "Installed Products"
          : activeTab === "purchases"
          ? "Subscriptions & Purchases"
          : "Integrations & Extensions"
      }
    >
      {activeTab === "categories" ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[460px]">
          <div className="w-16 h-16 rounded-2xl bg-[#fdf8f7] flex items-center justify-center text-[#0c0a09] mb-4 shadow-2xs border border-[#e7e5e4]">
            <span className="material-symbols-outlined text-[32px]">category</span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-[#fffbeb] text-[#b45309] border border-[#fde68a] rounded-full mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
            Coming Soon
          </span>
          <h2 className="text-2xl sm:text-3xl font-garamond text-[#0c0a09] font-normal">
            App Categories Directory
          </h2>
          <p className="text-xs sm:text-sm text-[#5e5e5e] max-w-md mt-1.5 leading-relaxed">
            We are curating dedicated category directories for POS hardware, accounting connectors, delivery fleets, and guest loyalty.
          </p>
          <button
            type="button"
            onClick={() => handleTabChange("explore")}
            className="mt-6 px-4 py-2 bg-[#0c0a09] hover:bg-[#262626] text-white text-xs font-semibold rounded-lg transition-all shadow-xs cursor-pointer"
          >
            ← Back to Explore Products
          </button>
        </div>
      ) : activeTab === "wallet" ? (
        <MarketplaceWalletView
          embeddedInMarketplace={true}
          externalBalance={walletBalance}
          onBalanceChange={(newBal) => setWalletBalance(newBal)}
        />
      ) : (
        <div className="p-3.5 sm:p-5 md:p-6 lg:p-7 xl:p-8 flex flex-col gap-4 sm:gap-5 w-full max-w-[1920px] mx-auto">
          {/* Header Section */}
          <MarketplaceHeader
            walletBalance={walletBalance}
            activeScenario={activeScenario}
            activeTab={activeTab}
            activeCategory={activeCategory}
            searchQuery={searchQuery}
            sortOption={sortOption}
            onScenarioChange={handleScenarioChange}
            onTabChange={handleTabChange}
            onCategoryChange={setActiveCategory}
            onSearchChange={setSearchQuery}
            onSortChange={setSortOption}
            onAddMoneyClick={() => router.push("/marketplace/wallet/add")}
          />

          {/* 12-App Bento Grid: 1 col on mobile, 2 on tablet/small laptop, 3 on desktop, 4 on big screens */}
          <section
            id="catalog-grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5 sm:gap-4 md:gap-5"
          >
          {filteredApps.map((app) => (
            <MarketplaceCard
              key={app.id}
              app={app}
              isPurchased={purchasedAppIds.includes(app.id)}
              onActionClick={handleActionClick}
              onCardClick={handleCardClick}
            />
          ))}
        </section>

        {/* Empty Search Feedback */}
        {filteredApps.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center bg-white rounded-2xl sm:rounded-3xl border border-[#e7e5e4] shadow-xs">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#fdf8f7] border border-[#e7e5e4] flex items-center justify-center text-[#5e5e5e] mb-3 sm:mb-4">
              <span className="material-symbols-outlined text-[24px] sm:text-[28px]">search_off</span>
            </div>
            <h3 className="font-sans text-base sm:text-lg font-semibold text-[#0c0a09]">
              {activeTab === "installed"
                ? "No installed apps found"
                : activeTab === "purchases"
                ? "No subscriptions or purchases found"
                : "No matching integrations found"}
            </h3>
            <p className="text-xs text-[#5e5e5e] mt-1 max-w-sm leading-relaxed">
              {activeTab === "installed"
                ? "You haven’t installed or connected any apps matching your filters yet. Explore the marketplace catalog to add tools."
                : activeTab === "purchases"
                ? "No active subscriptions or paid plans match your filters. Browse the catalog to explore available add-ons."
                : `We couldn’t find any tools matching "${searchQuery}" in the ${activeCategory} category.`}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setActiveCategory("all");
                if (
                  (activeTab === "installed" || activeTab === "purchases") &&
                  filteredApps.length === 0 &&
                  !searchQuery &&
                  activeCategory === "all"
                ) {
                  handleTabChange("explore");
                }
              }}
              className="mt-4 px-4 py-2 rounded-lg bg-[#0c0a09] text-white text-xs font-semibold hover:bg-[#262626] transition-colors cursor-pointer"
            >
              {(activeTab === "installed" || activeTab === "purchases") &&
              !searchQuery &&
              activeCategory === "all"
                ? "Explore Marketplace Products"
                : "Reset Filters"}
            </button>
          </div>
        )}

        {/* Editorial Standards Footer Strip */}
        <section className="bg-[#faf8f5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 border border-[#e7e5e4] shadow-xs">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white flex items-center justify-center text-[#0c0a09] border border-[#e7e5e4] shadow-xs shrink-0">
              <span className="material-symbols-outlined text-[20px] sm:text-[24px]">verified_user</span>
            </div>
            <div className="flex flex-col min-w-0">
              <h4 className="font-garamond text-base sm:text-lg text-[#0c0a09] font-medium">
                Certified Hospitality Integrations
              </h4>
              <p className="text-xs text-[#5e5e5e] mt-0.5 leading-relaxed">
                All PREST marketplace plugins undergo rigorous kitchen ticket concurrency testing and
                SOC2 compliance validation.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-semibold text-[#0c0a09] shrink-0">
            <a href="#" className="hover:underline">
              Developer Documentation
            </a>
            <span className="text-[#e7e5e4]">·</span>
            <a href="#" className="hover:underline">
              Request Custom Plugin
            </a>
          </div>
        </section>
      </div>
      )}

      {/* Interactive Purchase Modal */}
      <MarketplacePurchaseModal
        isOpen={isPurchaseModalOpen}
        app={selectedApp}
        walletBalance={walletBalance}
        isAlreadyPurchased={selectedApp ? purchasedAppIds.includes(selectedApp.id) : false}
        onClose={() => setIsPurchaseModalOpen(false)}
        onConfirmPurchase={handleConfirmPurchase}
        onSimulateRecharge={(amount) => {
          handleAddMoney(amount);
        }}
      />

      {/* Slide-Over App Details Drawer */}
      <MarketplaceDetailDrawer
        isOpen={isDrawerOpen}
        app={selectedApp}
        walletBalance={walletBalance}
        isPurchased={selectedApp ? purchasedAppIds.includes(selectedApp.id) : false}
        onClose={() => setIsDrawerOpen(false)}
        onActionClick={handleActionClick}
      />

      {/* Standard Menu Toast Notification Component */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </PosShell>
  );
}
