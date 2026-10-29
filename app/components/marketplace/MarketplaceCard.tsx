"use client";

import { MarketplaceApp } from "./types";

interface MarketplaceCardProps {
  app: MarketplaceApp;
  onActionClick: (app: MarketplaceApp) => void;
  onCardClick: (app: MarketplaceApp) => void;
  isPurchased?: boolean;
}

export function MarketplaceCard({
  app,
  onActionClick,
  onCardClick,
  isPurchased = false,
}: MarketplaceCardProps) {
  // Determine if this is the hero app (PREST WhatsApp Automation)
  const isHeroApp = app.slug === "prest-whatsapp-automation";

  // Compute dynamic badge text and styling
  const badgeText = isPurchased ? "Installed" : app.badge;
  
  const getBadgeClass = () => {
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
    if (isPurchased) {
      return "Installed — Setup Required";
    }
    return app.statusText;
  };

  const getButtonContent = () => {
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
                isHeroApp ? "bg-[#0c0a09] text-white" : "bg-[#fdf8f7] text-[#0c0a09] border border-[#e7e5e4]"
              }`}
            >
              <span className="material-symbols-outlined text-[20px] sm:text-[23px] lg:text-[26px]">
                {app.iconName}
              </span>
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
              <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot()}`} />
              <span className="whitespace-nowrap">{badgeText}</span>
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm text-[#5e5e5e] leading-relaxed line-clamp-3 min-h-[2.75rem] sm:min-h-[3.5rem]">
          {app.description}
        </p>

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
      </div>
    </article>
  );
}
