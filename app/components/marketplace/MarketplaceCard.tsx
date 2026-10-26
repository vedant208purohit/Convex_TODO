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
      return "bg-[#ede7e4] text-[#4d4541] border border-[#d0c4be]";
    }
    if (app.badge === "Featured") {
      return "bg-[#eae1da] text-[#4c4641] border border-[#cec5be]";
    }
    if (app.badge === "Live") {
      return "bg-[#ede7e4] text-[#1d1b1a] border border-[#d0c4be]";
    }
    if (app.badge === "Attention") {
      return "bg-[#ffdad6] text-[#ba1a1a] border border-[#ba1a1a]/20";
    }
    return "bg-[#ede7e4] text-[#4d4541] border border-[#d0c4be]";
  };

  const getStatusDot = () => {
    if (isPurchased) {
      return "bg-emerald-500";
    }
    switch (app.statusType) {
      case "live":
        return "bg-emerald-500";
      case "attention":
        return "bg-[#ba1a1a]";
      case "installed":
        return "bg-stone-500";
      case "paid_required":
        return "bg-[#141010]";
      case "available":
      default:
        return "bg-stone-300";
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
      return "w-full py-2.5 px-4 rounded-lg bg-[#141010] text-white font-medium text-sm tracking-wide flex items-center justify-center gap-2 hover:bg-black transition-all shadow-sm cursor-pointer";
    }
    if (app.actionType === "fix") {
      return "w-full py-2.5 px-4 rounded-lg bg-[#f3ecea] hover:bg-[#e9e1dd] text-[#1d1b1a] font-medium text-sm tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#d0c4be]/60";
    }
    return "w-full py-2.5 px-4 rounded-lg bg-[#f3ecea] hover:bg-[#ede7e4] text-[#1d1b1a] font-medium text-sm tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#d0c4be]/50";
  };

  return (
    <article
      data-category={app.category}
      className={`flex flex-col justify-between bg-white rounded-2xl p-6 shadow-sm border border-stone-200/80 transition-all duration-300 hover:shadow-md group relative overflow-hidden ${
        isHeroApp ? "shadow-md hover:shadow-xl" : ""
      }`}
    >
      {/* Accent top bar indicator for Hero Card */}
      {isHeroApp && <div className="absolute top-0 left-0 right-0 h-1 bg-[#141010]" />}

      {/* Clickable Card Body (Opens Drawer) */}
      <div
        className="flex flex-col gap-4 cursor-pointer"
        onClick={() => onCardClick(app)}
        role="button"
        tabIndex={0}
      >
        {/* Header Row: Icon + Title + Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                isHeroApp ? "bg-[#141010] text-white" : "bg-[#f3ecea] text-[#1d1b1a]"
              }`}
            >
              <span className="material-symbols-outlined text-[26px]">
                {app.iconName}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-widest text-stone-500 font-semibold block">
                {app.vendor}
              </span>
              <h3 className="font-garamond text-[20px] font-semibold text-stone-900 leading-tight mt-0.5">
                {app.title}
              </h3>
            </div>
          </div>

          {badgeText && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] uppercase font-semibold shrink-0 ${getBadgeClass()}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot()}`} />
              {badgeText}
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-stone-600 leading-relaxed line-clamp-3">
          {app.description}
        </p>

        {/* Structured Spec Box */}
        <div className="flex flex-col gap-1.5 bg-[#faf2ee] p-3.5 rounded-xl border border-stone-200/60">
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase tracking-wider text-stone-500 font-medium text-[10px]">
              Category
            </span>
            <span className="font-medium text-stone-800">{app.category}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase tracking-wider text-stone-500 font-medium text-[10px]">
              Pricing
            </span>
            <span className="font-semibold text-stone-900">{app.priceText}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase tracking-wider text-stone-500 font-medium text-[10px]">
              Status
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-stone-800">
              <span className={`w-2 h-2 rounded-full ${getStatusDot()}`} />
              {getStatusText()}
            </span>
          </div>
        </div>
      </div>

      {/* Action Button Footer */}
      <div className="pt-5 mt-auto">
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
