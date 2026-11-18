"use client";

import { useState, useEffect } from "react";
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
import { RazorpayMethodSelection } from "./RazorpayMethodSelection";
import { RazorpayApiKeysForm } from "./RazorpayApiKeysForm";
import { RazorpayOnboardingIntro } from "./RazorpayOnboardingIntro";
import { RazorpaySuccessView } from "./RazorpaySuccessView";
import { RazorpayDashboardView } from "./RazorpayDashboardView";
import { StripeMethodSelection } from "./StripeMethodSelection";
import { StripeApiKeysForm } from "./StripeApiKeysForm";
import { StripeOnboard } from "./StripeOnboard";
import { StripeSuccessView } from "./StripeSuccessView";
import { StripeDashboardView } from "./StripeDashboardView";
import { StripeTransactionsView } from "./StripeTransactionsView";
import { StripeRefundsView } from "./StripeRefundsView";
import { StripePayoutsView } from "./StripePayoutsView";
import { StripeRequestPayoutView } from "./StripeRequestPayoutView";
import { StripeReviewPayoutView } from "./StripeReviewPayoutView";
import { StripeProcessingWithdrawalView } from "./StripeProcessingWithdrawalView";
import { StripeWithdrawalSuccessView } from "./StripeWithdrawalSuccessView";
import { StripePayoutDetailsView } from "./StripePayoutDetailsView";
import { StripeInsightsView } from "./StripeInsightsView";
import { StripeHealthView } from "./StripeHealthView";
import { StripeSettingsView } from "./StripeSettingsView";
import { Toast, type ToastMessage } from "../Toast";

export function MarketplaceView() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // 1. URL & Filter State
  const tabParam = searchParams.get("tab") as MarketplaceTab | null;
  const categoryParam = searchParams.get("category");
  const appParam = searchParams.get("app");
  const flowParam = searchParams.get("flow");
  const [internalTab, setInternalTab] = useState<MarketplaceTab>("explore");
  const [internalRazorpayFlow, setInternalRazorpayFlow] = useState<
    "select-method" | "api-keys" | "onboarding" | "success" | "dashboard" | null
  >(
    flowParam === "razorpay-dashboard"
      ? "dashboard"
      : flowParam === "razorpay-success"
        ? "success"
        : flowParam === "razorpay-api-keys"
          ? "api-keys"
          : flowParam === "razorpay-onboarding"
            ? "onboarding"
            : flowParam === "razorpay-connect"
              ? "select-method"
              : null
  );

  const razorpayFlow =
    flowParam === "razorpay-dashboard"
      ? "dashboard"
      : flowParam === "razorpay-success"
        ? "success"
        : flowParam === "razorpay-api-keys"
          ? "api-keys"
          : flowParam === "razorpay-onboarding"
            ? "onboarding"
            : flowParam === "razorpay-connect"
              ? "select-method"
              : internalRazorpayFlow;

  const activeTab: MarketplaceTab =
    tabParam && ["explore", "installed", "categories", "purchases", "wallet"].includes(tabParam)
      ? tabParam
      : internalTab;

  const handleTabChange = (tab: MarketplaceTab) => {
    setInternalTab(tab);
    router.push(`/marketplace?tab=${tab}`, { scroll: false });
  };
  const [activeCategory, setActiveCategory] = useState<MarketplaceCategory>(
    categoryParam === "Payments" || categoryParam === "payments" || tabParam === ("payments" as any)
      ? "Payments"
      : "all"
  );
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

  // Auto-open drawer if requested via URL query (e.g. ?app=stripe)
  useEffect(() => {
    if (appParam && filteredApps.length > 0 && !selectedApp) {
      const match = filteredApps.find((a) => a.slug === appParam || a.id === appParam);
      if (match) {
        setSelectedApp(match);
        setIsDrawerOpen(true);
      }
    }
  }, [appParam, filteredApps, selectedApp]);

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
    const isRazorpay = app.slug === "razorpay" || app.iconName === "razorpay";

    if (isRazorpay) {
      const isConnected =
        Boolean(app.isInstalled) ||
        app.statusType === "live" ||
        app.actionType === "open" ||
        app.actionText === "Manage" ||
        app.badge === "Connected" ||
        Boolean((app as any).configuration?.connected) ||
        Boolean((app as any).credentials) ||
        Boolean((app as any).connected);

      if (isConnected) {
        setIsDrawerOpen(false);
        setInternalRazorpayFlow("dashboard");
        router.push("/marketplace/razorpay/dashboard");
        return;
      }

      if (app.actionType === "fix" || app.statusType === "attention") {
        setIsDrawerOpen(false);
        setInternalRazorpayFlow("api-keys");
        router.push("/marketplace?flow=razorpay-api-keys", { scroll: false });
        return;
      }

      if (isDrawerOpen) {
        setIsDrawerOpen(false);
        setInternalRazorpayFlow("select-method");
        router.push("/marketplace/razorpay/connect");
      } else {
        setSelectedApp(app);
        setIsDrawerOpen(true);
      }
      return;
    }

    const isStripe = app.slug === "stripe" || app.iconName === "stripe";
    if (isStripe) {
      const isConnected =
        Boolean(app.isInstalled) ||
        app.statusType === "live" ||
        app.actionType === "open" ||
        app.actionText === "Manage" ||
        app.badge === "Connected" ||
        Boolean((app as any).configuration?.connected) ||
        Boolean((app as any).credentials) ||
        Boolean((app as any).connected);

      if (isConnected) {
        setIsDrawerOpen(false);
        router.push("/marketplace?flow=stripe-dashboard", { scroll: false });
        return;
      }

      setIsDrawerOpen(false);
      router.push("/marketplace?flow=stripe-connect", { scroll: false });
      return;
    }

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
        flowParam === "stripe-api-keys"
          ? "Stripe Credentials Setup"
          : flowParam === "stripe-connect"
            ? "Stripe Setup"
            : razorpayFlow === "dashboard"
            ? "Razorpay Payments"
            : razorpayFlow === "success"
              ? "Connection Success"
              : razorpayFlow === "api-keys"
                ? "API Keys Setup"
                : razorpayFlow === "onboarding"
                  ? "Razorpay Onboarding"
                  : razorpayFlow === "select-method"
                    ? "Razorpay Setup"
                    : activeTab === "wallet"
                      ? "Wallet"
                      : activeTab === "installed"
                        ? "Installed Products"
                        : activeTab === "purchases"
                          ? "Subscriptions & Purchases"
                          : "Integrations & Extensions"
      }
    >
      {razorpayFlow === "dashboard" ? (
        <RazorpayDashboardView embeddedInMarketplace={true} />
      ) : razorpayFlow === "success" ? (
        <RazorpaySuccessView
          embeddedInMarketplace={true}
          onGoToDashboard={() => {
            setInternalRazorpayFlow("dashboard");
            router.push("/marketplace/razorpay/dashboard");
          }}
          onReturnToMarketplace={() => {
            setInternalRazorpayFlow(null);
            router.push("/marketplace", { scroll: false });
          }}
        />
      ) : razorpayFlow === "onboarding" ? (
        <RazorpayOnboardingIntro
          embeddedInMarketplace={true}
          onBack={() => {
            setInternalRazorpayFlow("select-method");
            router.push("/marketplace?flow=razorpay-connect", { scroll: false });
          }}
          onContinue={() => {
            setInternalRazorpayFlow("success");
            router.push("/marketplace?flow=razorpay-success", { scroll: false });
          }}
        />
      ) : razorpayFlow === "api-keys" ? (
        <RazorpayApiKeysForm
          embeddedInMarketplace={true}
          onBack={() => {
            setInternalRazorpayFlow("select-method");
            router.push("/marketplace?flow=razorpay-connect", { scroll: false });
          }}
          onVerify={async ({ keyId, keySecret }) => {
            const cleanKeyId = (keyId || "").trim().replace(/^['"]|['"]$/g, "");
            const cleanKeySecret = (keySecret || "").trim().replace(/^['"]|['"]$/g, "");
            const res = await fetch("/api/payments/razorpay/connect", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                key_id: cleanKeyId,
                key_secret: cleanKeySecret,
              }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
              throw new Error(data.error || "Failed to verify and connect Razorpay API keys.");
            }
            setInternalRazorpayFlow("success");
            const queryParams = new URLSearchParams({
              flow: "razorpay-success",
              method: "api_keys",
              mode: data.accountMode || "live",
              name: data.merchantName || "",
              mid: data.merchantId || cleanKeyId,
            });
            router.push(`/marketplace?${queryParams.toString()}`, { scroll: false });
          }}
        />
      ) : flowParam === "stripe-api-keys" ? (
        <StripeApiKeysForm
          embeddedInMarketplace={true}
          onBack={() => {
            router.push("/marketplace?flow=stripe-connect", { scroll: false });
          }}
          onVerify={async ({ publishableKey, secretKey }) => {
            const res = await fetch("/api/payments/stripe/connect", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                publishableKey,
                secretKey,
              }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
              throw new Error(data.error || "Failed to verify and connect Stripe credentials.");
            }
            showToast("Stripe Connected Successfully!", "success", `${data.accountMode?.toUpperCase()} mode active`);
            router.push("/marketplace?flow=stripe-dashboard", { scroll: false });
          }}
        />
      ) : flowParam === "stripe-success" ? (
        <StripeSuccessView
          embeddedInMarketplace={true}
          onGoToDashboard={() => {
            router.push("/marketplace?flow=stripe-dashboard", { scroll: false });
          }}
          onReturnToMarketplace={() => {
            router.push("/marketplace?category=Payments", { scroll: false });
          }}
        />
      ) : flowParam === "stripe-dashboard" ||
        flowParam === "stripe-transactions" ||
        flowParam === "stripe-refunds" ||
        flowParam === "stripe-payouts" ||
        flowParam === "stripe-insights" ||
        flowParam === "stripe-health" ||
        flowParam === "stripe-settings" ? (
        <StripeDashboardView
          embeddedInMarketplace={true}
          initialTab={
            flowParam === "stripe-transactions"
              ? "Transactions"
              : flowParam === "stripe-refunds"
                ? "Refunds"
                : flowParam === "stripe-payouts"
                  ? "Payouts"
                  : flowParam === "stripe-insights"
                    ? "Insights"
                    : flowParam === "stripe-health"
                      ? "Health"
                      : flowParam === "stripe-settings"
                        ? "Settings"
                        : "Dashboard"
          }
          onNavigateToTransactions={() => {
            router.push("/marketplace?flow=stripe-transactions", { scroll: false });
          }}
          onNavigateToRefunds={() => {
            router.push("/marketplace?flow=stripe-refunds", { scroll: false });
          }}
          onNavigateToPayouts={() => {
            router.push("/marketplace?flow=stripe-payouts", { scroll: false });
          }}
          onNavigateToHealth={() => {
            router.push("/marketplace?flow=stripe-health", { scroll: false });
          }}
          onNavigateToSettings={() => {
            router.push("/marketplace?flow=stripe-settings", { scroll: false });
          }}
          onNavigateToInsights={() => {
            router.push("/marketplace?flow=stripe-insights", { scroll: false });
          }}
          onBackToMarketplace={() => {
            router.push("/marketplace?category=Payments", { scroll: false });
          }}
        />
      ) : flowParam === "stripe-request-payout" ? (
        <StripeRequestPayoutView
          embeddedInMarketplace={true}
          onBackToPayouts={() => {
            router.push("/marketplace?flow=stripe-payouts", { scroll: false });
          }}
          onContinueToReview={(amount) => {
            router.push(`/marketplace?flow=stripe-review-payout&amount=${amount}`, { scroll: false });
          }}
          onNavigateToRefunds={() => {
            router.push("/marketplace?flow=stripe-refunds", { scroll: false });
          }}
          onNavigateToTransactions={() => {
            router.push("/marketplace?flow=stripe-transactions", { scroll: false });
          }}
        />
      ) : flowParam === "stripe-review-payout" ? (
        <StripeReviewPayoutView
          embeddedInMarketplace={true}
          onBack={() => {
            router.push("/marketplace?flow=stripe-request-payout", { scroll: false });
          }}
          onConfirmPayout={(amount) => {
            router.push(`/marketplace?flow=stripe-processing-payout&amount=${amount}`, { scroll: false });
          }}
        />
      ) : flowParam === "stripe-processing-payout" ? (
        <StripeProcessingWithdrawalView
          embeddedInMarketplace={true}
          onComplete={() => {
            showToast("Withdrawal processed successfully", "success", "Funds dispatched to primary account");
            router.push("/marketplace?flow=stripe-withdrawal-success", { scroll: false });
          }}
        />
      ) : flowParam === "stripe-withdrawal-success" ? (
        <StripeWithdrawalSuccessView
          embeddedInMarketplace={true}
          onViewHistory={() => {
            router.push("/marketplace?flow=stripe-payouts", { scroll: false });
          }}
          onBackToDashboard={() => {
            router.push("/marketplace?flow=stripe-dashboard", { scroll: false });
          }}
          onViewDetails={(id) => {
            router.push(`/marketplace?flow=stripe-payout-details&id=${encodeURIComponent(id)}`, { scroll: false });
          }}
        />
      ) : flowParam === "stripe-payout-details" ? (
        <StripePayoutDetailsView
          embeddedInMarketplace={true}
          onBack={() => {
            router.push("/marketplace?flow=stripe-payouts", { scroll: false });
          }}
        />
      ) : flowParam === "stripe-connect" ? (
        <StripeMethodSelection
          embeddedInMarketplace={true}
          onBackToMarketplace={() => {
            router.push("/marketplace?category=Payments", { scroll: false });
          }}
          onSelectExistingAccount={() => {
            router.push("/marketplace?flow=stripe-api-keys", { scroll: false });
          }}
          onSelectNewAccount={() => {
            router.push("/marketplace?flow=stripe-onboarding", { scroll: false });
          }}
        />
      ) : flowParam === "stripe-onboarding" ? (
        <StripeOnboard
          embeddedInMarketplace={true}
          onBackToMarketplace={() => {
            router.push("/marketplace?flow=stripe-connect", { scroll: false });
          }}
          onContinueWithStripe={() => {
            showToast("Stripe Onboarding Window Ready", "success", "Stripe verification session initialized.");
          }}
        />
      ) : razorpayFlow === "select-method" ? (
        <RazorpayMethodSelection
          embeddedInMarketplace={true}
          onBackToMarketplace={() => {
            setInternalRazorpayFlow(null);
            router.push("/marketplace", { scroll: false });
          }}
          onSelectApiKeys={() => {
            setInternalRazorpayFlow("api-keys");
            router.push("/marketplace?flow=razorpay-api-keys", { scroll: false });
          }}
          onSelectOnboarding={() => {
            setInternalRazorpayFlow("onboarding");
            router.push("/marketplace?flow=razorpay-onboarding", { scroll: false });
          }}
        />
      ) : activeTab === "categories" ? (
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

              {/* Restaurant Operational Info Bento Cards (Rendered for Payments view matching reference design) */}
              {activeCategory === "Payments" && (
                <section
                  id="restaurant-operational-bento"
                  aria-label="Restaurant Operational Standards"
                  className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mt-2 sm:mt-4"
                >
                  {/* Card 1: Direct POS & Table Sync */}
                  <div className="bg-[#FAF6F0] rounded-2xl p-5 sm:p-6 border border-[#E5DFD7] flex flex-col justify-between min-h-[190px] shadow-2xs">
                    <div>
                      <div className="w-9 h-9 rounded-lg bg-white/80 border border-[#E5DFD7] flex items-center justify-center text-[#0c0a09] mb-4">
                        <span className="material-symbols-outlined text-[20px]">point_of_sale</span>
                      </div>
                      <h3 className="font-garamond text-lg sm:text-xl font-normal text-[#0c0a09] leading-snug">
                        Direct POS &amp; Table Sync
                      </h3>
                      <p className="text-xs sm:text-[13px] text-[#5e5e5e] mt-2 leading-relaxed font-sans">
                        Every guest transaction maps automatically to bill numbers, server assignments, and inventory batch deductions in real time.
                      </p>
                    </div>
                    <div className="pt-4 mt-2 border-t border-[#E5DFD7]/60">
                      <span className="text-[10px] tracking-wider font-semibold text-[#8C827A] uppercase">
                        Zero Manual Reconciliation
                      </span>
                    </div>
                  </div>

                  {/* Card 2: Hospitality PCI-DSS Standards */}
                  <div className="bg-[#FAF6F0] rounded-2xl p-5 sm:p-6 border border-[#E5DFD7] flex flex-col justify-between min-h-[190px] shadow-2xs">
                    <div>
                      <div className="w-9 h-9 rounded-lg bg-white/80 border border-[#E5DFD7] flex items-center justify-center text-[#0c0a09] mb-4">
                        <span className="material-symbols-outlined text-[20px]">verified_user</span>
                      </div>
                      <h3 className="font-garamond text-lg sm:text-xl font-normal text-[#0c0a09] leading-snug">
                        Hospitality PCI-DSS Standards
                      </h3>
                      <p className="text-xs sm:text-[13px] text-[#5e5e5e] mt-2 leading-relaxed font-sans">
                        End-to-end tokenized card present and contactless payments to ensure stringent hospitality compliance across all POS stations.
                      </p>
                    </div>
                    <div className="pt-4 mt-2 border-t border-[#E5DFD7]/60">
                      <span className="text-[10px] tracking-wider font-semibold text-[#8C827A] uppercase">
                        Bank-Grade Encryption
                      </span>
                    </div>
                  </div>

                  {/* Card 3: Automated Shift Payouts */}
                  <div className="bg-[#FAF6F0] rounded-2xl p-5 sm:p-6 border border-[#E5DFD7] flex flex-col justify-between min-h-[190px] shadow-2xs">
                    <div>
                      <div className="w-9 h-9 rounded-lg bg-white/80 border border-[#E5DFD7] flex items-center justify-center text-[#0c0a09] mb-4">
                        <span className="material-symbols-outlined text-[20px]">account_balance</span>
                      </div>
                      <h3 className="font-garamond text-lg sm:text-xl font-normal text-[#0c0a09] leading-snug">
                        Automated Shift Payouts
                      </h3>
                      <p className="text-xs sm:text-[13px] text-[#5e5e5e] mt-2 leading-relaxed font-sans">
                        Track tips, server pooled gratuities, and morning batch settlements directly to your business account with daily payout feeds.
                      </p>
                    </div>
                    <div className="pt-4 mt-2 border-t border-[#E5DFD7]/60">
                      <span className="text-[10px] tracking-wider font-semibold text-[#8C827A] uppercase">
                        Next-Day Availability
                      </span>
                    </div>
                  </div>
                </section>
              )}

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
