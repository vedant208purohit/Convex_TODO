"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  MarketplaceApp,
  MarketplaceCategory,
  MarketplaceSortOption,
  MarketplaceTab,
} from "./types";
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

  // 1. URL & Filter State
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

  // 2. Real Convex Backend Subscriptions
  const wallet = useQuery(api.marketplace.getWallet, {});
  const catalogData = useQuery(api.marketplace.listCatalog, {
    category: activeCategory,
    searchQuery: searchQuery.trim(),
    sortOption,
    tab: activeTab,
  });

  // 3. Convex Mutations
  const purchaseAppMutation = useMutation(api.marketplace.purchaseApp);
  const installAppMutation = useMutation(api.marketplace.installApp);
  const topupWalletMutation = useMutation(api.marketplace.topupWallet);

  const walletBalance = wallet?.balance ?? 14500;
  const filteredApps = (catalogData?.apps as MarketplaceApp[]) ?? [];
  const isLoading = catalogData === undefined;

  // 4. Modal & Drawer State
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<MarketplaceApp | null>(null);

  // 5. Standard Toast Notification State
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "success",
    subtext?: string
  ) => {
    setToast({ message, type, subtext });
  };

  // Add Money / Wallet Recharge
  const handleAddMoney = async (amount: number = 5000) => {
    try {
      const suffix = Math.random().toString(36).substring(2, 9);
      await topupWalletMutation({
        amount,
        paymentMethod: "upi",
        idempotencyKey: `client_topup_${suffix}`,
      });
      showToast(`₹${amount.toLocaleString("en-IN")} added to wallet`, "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add money";
      showToast(msg, "error");
    }
  };

  // Handle Action Button Clicks
  const handleActionClick = async (app: MarketplaceApp) => {
    const isHero = app.slug === "prest-whatsapp-automation";

    if (isHero) {
      if (app.isInstalled) {
        showToast("WhatsApp Automation is active", "success");
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

    if (app.actionType === "install") {
      try {
        await installAppMutation({ appIdOrSlug: app.slug || app.id });
        showToast(`${app.title} installed successfully!`, "success");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : `Failed to install ${app.title}`;
        showToast(msg, "error");
      }
      return;
    }

    // Interactive Toast feedback for other actions
    switch (app.actionType) {
      case "setup":
      case "settings":
      case "open":
        showToast(`Opening ${app.title}`);
        break;
      case "fix":
        showToast(`Authenticating ${app.title}`);
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
  const handleConfirmPurchase = async (app: MarketplaceApp) => {
    try {
      const suffix = Math.random().toString(36).substring(2, 9);
      const res = await purchaseAppMutation({
        appIdOrSlug: app.slug || app.id,
        idempotencyKey: `client_purchase_${app.slug}_${suffix}`,
      });
      showToast(`${app.title} activated successfully!`, "success", `Ref: ${res.transactionCode}`);
      setIsPurchaseModalOpen(false);
      setIsDrawerOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to purchase ${app.title}`;
      showToast(msg, "error");
    }
  };

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
        />
      ) : (
        <div className="p-3.5 sm:p-5 md:p-6 lg:p-7 xl:p-8 flex flex-col gap-4 sm:gap-5 w-full max-w-[1920px] mx-auto">
          {/* Header Section */}
          <MarketplaceHeader
            walletBalance={walletBalance}
            activeTab={activeTab}
            activeCategory={activeCategory}
            searchQuery={searchQuery}
            sortOption={sortOption}
            onTabChange={handleTabChange}
            onCategoryChange={setActiveCategory}
            onSearchChange={setSearchQuery}
            onSortChange={setSortOption}
            onAddMoneyClick={() => router.push("/marketplace/wallet/add")}
          />

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5 sm:gap-4 md:gap-5 py-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="animate-pulse bg-white rounded-2xl p-6 border border-[#e7e5e4] flex flex-col gap-4 min-h-[280px]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-stone-200" />
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="h-3 w-16 bg-stone-200 rounded" />
                      <div className="h-4 w-32 bg-stone-200 rounded" />
                    </div>
                  </div>
                  <div className="h-3 bg-stone-200 rounded w-full mt-2" />
                  <div className="h-3 bg-stone-200 rounded w-4/5" />
                  <div className="h-20 bg-[#fdf8f7] rounded-xl mt-auto" />
                  <div className="h-10 bg-stone-200 rounded-lg" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* 12-App Bento Grid */}
              <section
                id="catalog-grid"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5 sm:gap-4 md:gap-5"
              >
                {filteredApps.map((app) => (
                  <MarketplaceCard
                    key={app.id || app.slug}
                    app={app}
                    isPurchased={Boolean(app.isInstalled)}
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
            </>
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
        isAlreadyPurchased={Boolean(selectedApp?.isInstalled)}
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
        isPurchased={Boolean(selectedApp?.isInstalled)}
        onClose={() => setIsDrawerOpen(false)}
        onActionClick={handleActionClick}
      />

      {/* Standard Menu Toast Notification Component */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </PosShell>
  );
}
