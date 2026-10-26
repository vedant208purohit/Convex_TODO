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

  // 4. Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3800);
  };

  // Switch Scenario Logic
  const handleScenarioChange = (scenario: "A" | "B") => {
    setActiveScenario(scenario);
    if (scenario === "A") {
      setWalletBalance(8000);
      showToast("Switched to Scenario A: Wallet loaded with ₹8,000.00 (Sufficient balance)");
    } else {
      setWalletBalance(2000);
      showToast("Switched to Scenario B: Wallet restricted to ₹2,000.00 (Insufficient balance warning)");
    }
    setSelectedApp(INITIAL_MARKETPLACE_APPS[0]);
    setIsPurchaseModalOpen(true);
  };

  // Add Money / Wallet Recharge Simulation
  const handleAddMoney = (amount: number = 5000) => {
    setWalletBalance((prev) => prev + amount);
    showToast(`Recharge Successful: Added ₹${amount.toLocaleString("en-IN")} to Marketplace Wallet.`);
  };

  // Handle Action Button Clicks
  const handleActionClick = (app: MarketplaceApp) => {
    const isHero = app.slug === "prest-whatsapp-automation";
    const isPurchased = purchasedAppIds.includes(app.id);

    if (isHero) {
      if (isPurchased) {
        showToast("PREST WhatsApp Automation is already installed. Opening configuration console.");
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
        showToast(`Launching ${app.title} integration setup wizard.`);
        break;
      case "settings":
        showToast(`Opening ${app.title} credentials and gateway parameters.`);
        break;
      case "fix":
        showToast(`Re-authenticating ${app.title} merchant secret tokens...`);
        break;
      case "open":
        showToast(`Redirecting to ${app.title} external reporting dashboard...`);
        break;
      case "install":
        showToast(`${app.title} package added to your restaurant POS pipeline.`);
        setPurchasedAppIds((prev) => [...prev, app.id]);
        break;
      default:
        showToast(`Opening ${app.title}...`);
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

    showToast(
      `Purchase Confirmed: ${app.title} successfully activated! Deducted ₹${price.toLocaleString(
        "en-IN"
      )} from wallet.`
    );
  };

  // Filter and Sort Apps
  const filteredApps = useMemo(() => {
    return filterAndSortApps(
      INITIAL_MARKETPLACE_APPS,
      activeCategory,
      searchQuery,
      sortOption,
      activeTab
    );
  }, [activeCategory, searchQuery, sortOption, activeTab]);

  return (
    <PosShell title="Marketplace" subtitle={activeTab === "wallet" ? "Wallet" : activeTab === "categories" ? "Categories" : "Integrations & Extensions"}>
      {activeTab === "categories" ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[460px]">
          <div className="w-16 h-16 rounded-2xl bg-[#ede7e4] flex items-center justify-center text-stone-700 mb-4 shadow-2xs border border-[#d0c4be]/40">
            <span className="material-symbols-outlined text-[32px]">category</span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-[#fffbeb] text-[#b45309] border border-[#fde68a] rounded-full mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
            Coming Soon
          </span>
          <h2 className="text-2xl sm:text-3xl font-garamond text-stone-900 font-normal">
            App Categories Directory
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 max-w-md mt-1.5 leading-relaxed">
            We are curating dedicated category directories for POS hardware, accounting connectors, delivery fleets, and guest loyalty.
          </p>
          <button
            type="button"
            onClick={() => handleTabChange("explore")}
            className="mt-6 px-4 py-2 bg-[#141010] hover:bg-black text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
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
        <div className="p-4 sm:p-6 lg:p-7 flex flex-col gap-5 w-full">
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

          {/* 12-App Bento Grid */}
          <section
            id="catalog-grid"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
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
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white rounded-3xl border border-stone-200 shadow-xs">
            <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 mb-4">
              <span className="material-symbols-outlined text-[28px]">search_off</span>
            </div>
            <h3 className="font-sans text-lg font-semibold text-stone-900">
              No matching integrations found
            </h3>
            <p className="text-xs text-stone-500 mt-1 max-w-sm">
              We couldn’t find any tools matching &quot;{searchQuery}&quot; in the {activeCategory} category.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setActiveCategory("all");
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Editorial Standards Footer Strip */}
        <section className="bg-[#faf2ee] rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-stone-200/60 shadow-xs">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-stone-900 shadow-xs shrink-0">
              <span className="material-symbols-outlined text-[24px]">verified_user</span>
            </div>
            <div className="flex flex-col">
              <h4 className="font-garamond text-base sm:text-lg text-stone-900 font-medium">
                Certified Hospitality Integrations
              </h4>
              <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                All PREST marketplace plugins undergo rigorous kitchen ticket concurrency testing and
                SOC2 compliance validation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-stone-900 shrink-0">
            <a href="#" className="hover:underline">
              Developer Documentation
            </a>
            <span className="text-stone-300">·</span>
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

      {/* Ambient Micro-Interaction Toast Notification */}
      <div
        className={`fixed bottom-6 right-6 z-50 transform transition-all duration-300 ease-out ${
          toastMessage
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <div className="bg-[#141010] text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 max-w-md border border-stone-700">
          <span className="material-symbols-outlined text-[20px] text-[#ffb68e] shrink-0">
            info
          </span>
          <span className="text-xs font-medium leading-relaxed">
            {toastMessage}
          </span>
        </div>
      </div>
    </PosShell>
  );
}
