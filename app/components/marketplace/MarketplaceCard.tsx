"use client";

import { MarketplaceApp } from "./types";

interface MarketplaceCardProps {
  app: MarketplaceApp;
  onActionClick: (app: MarketplaceApp) => void;
  onCardClick: (app: MarketplaceApp) => void;
  isPurchased?: boolean;
}

/**
 * Official Razorpay brand logo mark vector (SVG).
 */
export function RazorpayIcon({
  className = "w-5 h-5 sm:w-[22px] sm:h-[22px] lg:w-[24px] lg:h-[24px]",
}: {
  className?: string;
}) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Razorpay"
    >
      <path d="M22.436 0l-11.91 7.773-1.174 4.276 6.625-4.297L11.65 24h4.391l6.395-24zM14.26 10.098L3.389 17.166 1.564 24h9.008l3.688-13.902Z" />
    </svg>
  );
}

/**
 * Official Stripe brand logo mark vector (SVG).
 */
export function StripeIcon({
  className = "w-5 h-5 sm:w-[22px] sm:h-[22px] lg:w-[24px] lg:h-[24px]",
}: {
  className?: string;
}) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Stripe"
    >
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697.5 12.52.5 7.02.5 3.09 3.398 3.09 8.289c0 5.438 4.675 6.772 8.683 8.238 2.378.868 3.385 1.554 3.385 2.502 0 .981-.884 1.488-2.277 1.488-2.41 0-5.184-1.077-7.05-2.078l-.947 5.568c1.986.993 4.965 1.493 7.997 1.493 5.766 0 9.774-2.83 9.774-7.85 0-5.698-4.708-6.938-8.679-8.498z" />
    </svg>
  );
}

export function PayPalIcon({
  className = "w-5 h-5",
}: {
  className?: string;
}) {
  return (
    <span className={`font-serif font-bold text-lg italic tracking-tighter text-[#0c0a09] ${className}`}>
      PP
    </span>
  );
}

export function AdyenIcon({
  className = "w-5 h-5",
}: {
  className?: string;
}) {
  return (
    <span className={`font-serif font-bold text-base tracking-tight lowercase text-[#0c0a09] ${className}`}>
      adyen
    </span>
  );
}

export function MarketplaceCard({
  app,
  onActionClick,
  onCardClick,
  isPurchased = false,
}: MarketplaceCardProps) {
  // Determine provider types
  const isHeroApp = app.slug === "prest-whatsapp-automation";
  const isRazorpay = app.slug === "razorpay" || app.iconName === "razorpay";
  const isStripe = app.slug === "stripe" || app.iconName === "stripe";
  const isPayPal = app.slug === "paypal-commerce" || app.iconName === "paypal";
  const isAdyen = app.slug === "adyen" || app.iconName === "adyen";

  // Check if Razorpay has an authentic connected merchant setup
  const isRazorpayConnected = Boolean(
    isRazorpay &&
      (isPurchased ||
        app.isInstalled ||
        app.statusType === "live" ||
        app.badge === "Connected" ||
        (app as any).configuration?.connected ||
        (app as any).credentials ||
        (app as any).connected)
  );

  // Check if Stripe has an authentic connected merchant setup
  const isStripeConnected = Boolean(
    isStripe &&
      (isPurchased ||
        app.isInstalled ||
        app.statusType === "live" ||
        app.badge === "Connected" ||
        (app as any).configuration?.connected ||
        (app as any).credentials ||
        (app as any).connected)
  );

  // Compute dynamic badge text and styling
  const badgeText = isStripe
    ? isStripeConnected
      ? "Connected"
      : (app.badge || "Recommended for Restaurants")
    : isRazorpay
      ? isRazorpayConnected
        ? app.badge === "Connected"
          ? "Connected"
          : isPurchased
            ? "Installed"
            : "Connected"
        : (app.badge || "Recommended for India")
      : isPurchased
        ? "Installed"
        : app.badge;
  
  const getBadgeClass = () => {
    if (badgeText === "Recommended for Restaurants" || app.badge === "Recommended for Restaurants") {
      return "bg-[#faf8f5] text-[#494541] border border-[#e7e5e4]";
    }
    if (badgeText === "Recommended for India" || app.badge === "Recommended for India") {
      return "bg-[#fdf8f7] text-[#0c0a09] border border-[#e7e5e4]";
    }
    if (badgeText === "Alternative" || app.badge === "Alternative") {
      return "bg-[#faf8f5] text-[#5e5e5e] border border-[#e7e5e4]";
    }
    if (badgeText === "Enterprise" || app.badge === "Enterprise") {
      return "bg-[#faf8f5] text-[#5e5e5e] border border-[#e7e5e4]";
    }
    if (isPurchased || app.badge === "Installed") {
      return "bg-[#fdf8f7] text-[#0c0a09] border border-[#e7e5e4]";
    }
    if (app.badge === "Featured") {
      return "bg-[#faf8f5] text-[#0c0a09] border border-[#e7e5e4]";
    }
    if (app.badge === "Live") {
      return "bg-emerald-50 text-emerald-800 border border-emerald-200";
    }
    if (app.badge === "Attention") {
      return "bg-red-50 text-red-700 border border-red-200";
    }
    return "bg-[#fdf8f7] text-[#5e5e5e] border border-[#e7e5e4]";
  };

  const getStatusDot = () => {
    if (isStripe) {
      return isStripeConnected ? "bg-emerald-500" : "bg-[#8B3A2B]";
    }
    if (isRazorpay && !isRazorpayConnected) {
      return "bg-[#a8a29e]";
    }
    if (isPurchased) {
      return "bg-emerald-500";
    }
    switch (app.statusType) {
      case "live":
        return "bg-emerald-500";
      case "attention":
        return "bg-red-600";
      case "installed":
        return "bg-[#5e5e5e]";
      case "paid_required":
        return "bg-[#0c0a09]";
      case "available":
      default:
        return "bg-[#e7e5e4]";
    }
  };

  const getStatusText = () => {
    if (isStripe) {
      return isStripeConnected ? "Connected" : "Not Connected";
    }
    if (isRazorpay) {
      if (isRazorpayConnected) {
        return "Connected & Active";
      }
      return "Not Connected";
    }
    if (isPurchased) {
      return "Installed — Setup Required";
    }
    return app.statusText;
  };

  const appDescription = isStripe
    ? "Connect your Stripe account to accept payments for eligible restaurant orders and manage payment activity directly through Prest."
    : isRazorpay
      ? "Accept UPI, Cards, Wallets, EMI and Net Banking payments."
      : app.description;

  const getButtonContent = () => {
    if (isRazorpay) {
      if (isRazorpayConnected) {
        if (app.actionType === "settings" || app.actionText === "Settings") {
          return (
            <>
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span>Settings</span>
            </>
          );
        }
        return (
          <>
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            <span>Open Dashboard</span>
          </>
        );
      }
      return <span>Connect</span>;
    }
    if (isPurchased && isHeroApp) {
      return (
        <>
          <span>Open Setup</span>
          <span className="material-symbols-outlined text-[16px]">settings</span>
        </>
      );
    }

    switch (app.actionType) {
      case "purchase":
        if (app.actionText === "Purchase App") {
          return (
            <>
              <span className="material-symbols-outlined text-[16px]">shopping_bag</span>
              <span>{app.actionText}</span>
            </>
          );
        }
        return (
          <>
            <span>{app.actionText}</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </>
        );
      case "setup":
        return (
          <>
            <span>{app.actionText}</span>
            <span className="material-symbols-outlined text-[16px]">settings</span>
          </>
        );
      case "settings":
        return (
          <>
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>{app.actionText}</span>
          </>
        );
      case "fix":
        return (
          <>
            <span className="material-symbols-outlined text-[16px] text-red-600">build</span>
            <span>{app.actionText}</span>
          </>
        );
      case "open":
        return (
          <>
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            <span>{app.actionText}</span>
          </>
        );
      case "details":
        return (
          <>
            <span className="material-symbols-outlined text-[16px]">visibility</span>
            <span>{app.actionText}</span>
          </>
        );
      case "install":
      default:
        return (
          <>
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>{app.actionText}</span>
          </>
        );
    }
  };

  const getButtonClass = () => {
    if (isRazorpay) {
      return "w-full py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg bg-[#0c0a09] hover:bg-[#262626] active:bg-[#171717] active:scale-[0.98] text-white font-medium text-xs sm:text-sm tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#0c0a09] hover:border-[#262626] shadow-xs";
    }
    if (!isPurchased && isHeroApp) {
      return "w-full py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg bg-[#0c0a09] text-white font-medium text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 hover:bg-[#262626] transition-all shadow-xs cursor-pointer";
    }
    if (app.actionType === "fix") {
      return "w-full py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg bg-[#fdf8f7] hover:bg-[#f1edec] text-red-700 font-medium text-xs sm:text-sm tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer border border-red-200";
    }
    return "w-full py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg bg-[#fdf8f7] hover:bg-[#f1edec] text-[#0c0a09] font-medium text-xs sm:text-sm tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#e7e5e4]";
  };

  return (
    <article
      data-category={app.category}
      className={`flex flex-col justify-between bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 shadow-xs border border-[#e7e5e4] transition-all duration-300 hover:shadow-md group relative overflow-hidden ${
        isHeroApp ? "shadow-sm hover:shadow-lg ring-1 ring-[#0c0a09]/10" : ""
      }`}
    >
      {/* Accent top bar indicator for Hero Card */}
      {isHeroApp && <div className="absolute top-0 left-0 right-0 h-1 bg-[#0c0a09]" />}

      {/* Clickable Card Body (Opens Drawer) */}
      <div
        className="flex flex-col gap-3 sm:gap-4 cursor-pointer"
        onClick={() => onCardClick(app)}
        role="button"
        tabIndex={0}
      >
        {/* Header Row: Icon + Title + Badge */}
        <div className="flex items-start justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div
              className={`w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                isHeroApp || isStripe
                  ? "bg-[#0c0a09] text-white"
                  : "bg-[#fdf8f7] text-[#0c0a09] border border-[#e7e5e4]"
              }`}
            >
              {isStripe ? (
                <StripeIcon className="w-5 h-5 sm:w-[22px] sm:h-[22px] lg:w-[24px] lg:h-[24px] text-white" />
              ) : isRazorpay ? (
                <RazorpayIcon className="w-5 h-5 sm:w-[22px] sm:h-[22px] lg:w-[24px] lg:h-[24px]" />
              ) : isPayPal ? (
                <PayPalIcon />
              ) : isAdyen ? (
                <AdyenIcon />
              ) : (
                <span className="material-symbols-outlined text-[20px] sm:text-[23px] lg:text-[26px]">
                  {app.iconName}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase tracking-widest text-[#5e5e5e] font-semibold block truncate">
                {app.vendor}
              </span>
              <h3 className="font-garamond text-[17px] sm:text-[19px] lg:text-[20px] font-semibold text-[#0c0a09] leading-tight mt-0.5 break-words">
                {app.title}
              </h3>
            </div>
          </div>

          {badgeText && (
            <span
              className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-[10px] sm:text-[11px] uppercase font-semibold shrink-0 self-start mt-0.5 ${getBadgeClass()}`}
            >
              {!(isRazorpay && !isRazorpayConnected) && !(isStripe && !isStripeConnected) && (
                <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot()}`} />
              )}
              <span className="whitespace-nowrap">{badgeText}</span>
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm text-[#5e5e5e] leading-relaxed line-clamp-3 min-h-[2.75rem] sm:min-h-[3.5rem]">
          {appDescription}
        </p>

        {/* Stripe Feature Labels */}
        {isStripe && (
          <div className="flex flex-wrap gap-1.5 -mt-1 sm:-mt-1.5">
            {["Dine-in & POS", "Online Orders", "QR Payments", "Apple Pay", "Cards"].map((tag) => (
              <span
                key={tag}
                className="bg-[#faf8f5] text-[#554F4A] font-medium text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-md border border-[#e7e5e4]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Razorpay Payment Method Tags */}
        {isRazorpay && (
          <div className="flex flex-wrap gap-1.5 -mt-1 sm:-mt-1.5">
            {["UPI", "Cards", "Wallets", "Net Banking"].map((tag) => (
              <span
                key={tag}
                className="bg-[#fdf8f7] text-[#5e5e5e] font-medium text-[10px] sm:text-[11px] px-2 py-0.5 rounded border border-[#e7e5e4]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* PayPal Feature Tags */}
        {isPayPal && (
          <div className="flex flex-wrap gap-1.5 -mt-1 sm:-mt-1.5">
            {["Venmo", "Online Pickup", "Pay Later"].map((tag) => (
              <span
                key={tag}
                className="bg-[#faf8f5] text-[#554F4A] font-medium text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-md border border-[#e7e5e4]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Adyen Feature Tags */}
        {isAdyen && (
          <div className="flex flex-wrap gap-1.5 -mt-1 sm:-mt-1.5">
            {["Smart Terminals", "Franchise Groups", "Unified Flow"].map((tag) => (
              <span
                key={tag}
                className="bg-[#faf8f5] text-[#554F4A] font-medium text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-md border border-[#e7e5e4]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Structured Spec Box */}
        <div className="flex flex-col gap-1.5 bg-[#fdf8f7] p-3 sm:p-3.5 rounded-xl border border-[#e7e5e4]">
          <div className="flex items-center justify-between text-[11px] sm:text-xs">
            <span className="uppercase tracking-wider text-[#5e5e5e] font-medium text-[10px]">
              Category
            </span>
            <span className="font-medium text-[#0c0a09] truncate max-w-[55%] text-right">{app.category}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] sm:text-xs">
            <span className="uppercase tracking-wider text-[#5e5e5e] font-medium text-[10px]">
              Pricing
            </span>
            <span className="font-semibold text-[#0c0a09] truncate max-w-[65%] text-right">{app.priceText}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] sm:text-xs">
            <span className="uppercase tracking-wider text-[#5e5e5e] font-medium text-[10px]">
              Status
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#0c0a09] truncate max-w-[65%] justify-end">
              <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 ${getStatusDot()}`} />
              <span className="truncate">{getStatusText()}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Action Button Footer */}
      <div className="pt-3.5 sm:pt-4 lg:pt-5 mt-auto">
        {isStripe ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onActionClick(app);
              }}
              className="flex-1 py-2 sm:py-2.5 px-3 rounded-xl bg-[#0c0a09] hover:bg-[#262626] active:scale-[0.99] text-white font-medium text-xs sm:text-sm tracking-wide transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs border border-[#0c0a09]"
            >
              <span>{isStripeConnected ? "Manage" : "Connect"}</span>
              <span className="material-symbols-outlined text-[16px]">
                {isStripeConnected ? "open_in_new" : "arrow_forward"}
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCardClick(app);
              }}
              className="px-3.5 py-2 sm:py-2.5 border border-[#e7e5e4] text-[#494541] rounded-xl text-xs font-medium hover:bg-[#faf8f5] transition-colors cursor-pointer"
            >
              View Details
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onActionClick(app);
            }}
            className={getButtonClass()}
          >
            {getButtonContent()}
          </button>
        )}
      </div>
    </article>
  );
}
