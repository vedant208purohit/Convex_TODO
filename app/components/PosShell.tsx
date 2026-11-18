"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { UserButton, useClerk } from "@clerk/nextjs";
import { ReactNode, useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStoreResolution } from "../ConvexClientProvider";

// ==========================================
// PIXEL-PERFECT SIDEBAR SVG ICONS
// ==========================================

function DashboardIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function WorkstationIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  );
}

function MenuIcon({ className = "w-4 h-4" }: { className?: string }) {

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  );
}

function OrdersIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function InventoryIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

function KdsIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
      <path d="m7 8 2 2 4-4" />
    </svg>
  );
}

function SettingsIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SupportIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function CashierIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 14h2" />
      <path d="M10 14h2" />
      <path d="M14 14h4" />
      <path d="M6 17h4" />
      <path d="M14 17h4" />
    </svg>
  );
}

function CaptainIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5m-4 0h4" />
    </svg>
  );
}

function QueueNavIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function QrCodesIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="5" height="5" x="3" y="3" rx="1" />
      <rect width="5" height="5" x="16" y="3" rx="1" />
      <rect width="5" height="5" x="3" y="16" rx="1" />
      <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
      <path d="M12 7v3a2 2 0 0 1-2 2H7" />
    </svg>
  );
}

function CustomersNavIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ReportsIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function SurveysIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  disabledTooltip?: string;
  badge?: string;
};

function MarketplaceIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <path d="M2 7h20" />
      <path d="M22 7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2" />
    </svg>
  );
}

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: <DashboardIcon className="w-4 h-4" />,
  },
  {
    href: "/menu",
    label: "Menu",
    icon: <MenuIcon className="w-4 h-4" />,
  },
  {
    href: "/orders",
    label: "Orders",
    icon: <OrdersIcon className="w-4 h-4" />,
  },
  {
    href: "/workstation",
    label: "Workstation",
    icon: <WorkstationIcon className="w-4 h-4" />,
  },
  {
    href: "/kds",
    label: "KDS",
    icon: <KdsIcon className="w-4 h-4" />,
  },
  {
    href: "/cashier",
    label: "Cashier",
    icon: <CashierIcon className="w-4 h-4" />,
  },
  {
    href: "/captain",
    label: "Captain",
    icon: <CaptainIcon className="w-4 h-4" />,
  },
  {
    href: "/queue",
    label: "Queue",
    icon: <QueueNavIcon className="w-4 h-4" />,
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: <InventoryIcon className="w-4 h-4" />,
  },
  {
    href: "/reports",
    label: "Reports",
    icon: <ReportsIcon className="w-4 h-4" />,
  },
  {
    href: "/customers",
    label: "Customers",
    icon: <CustomersNavIcon className="w-4 h-4" />,
  },
  {
    href: "/surveys",
    label: "Surveys",
    icon: <SurveysIcon className="w-4 h-4" />,
  },
  {
    href: "/qr-codes",
    label: "QR Codes",
    icon: <QrCodesIcon className="w-4 h-4" />,
  },
  {
    href: "/marketplace",
    label: "Marketplace",
    icon: <MarketplaceIcon className="w-4 h-4" />,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: <SettingsIcon className="w-4 h-4" />,
  },
  {
    href: "/support",
    label: "Support",
    icon: <SupportIcon className="w-4 h-4" />,
  },
];

const menuSubItems = [
  { label: "Items & Categories", path: "/menu" },
  { label: "Chef Prep Preferences", path: "/menu/chef-prep-preferences" },
];

const inventorySubItems = [
  { label: "Purchase order", tab: "purchaseOrders", path: "/inventory/purchase-orders" },
  { label: "Supplier", tab: "suppliers", path: "/inventory/suppliers" },
  { label: "Item library", tab: "itemLibrary", path: "/inventory/item-library" },
  { label: "Dead stock", tab: "deadStock", path: "/inventory/dead-stock" },
  { label: "Item recipes", tab: "itemRecipes", path: "/inventory/item-recipes" },
];

const marketplaceSubItems: {
  label: string;
  tab: string;
  path: string;
  disabled?: boolean;
  badge?: string;
}[] = [
  { label: "Explore Products", tab: "explore", path: "/marketplace?tab=explore" },
  { label: "Installed Products", tab: "installed", path: "/marketplace?tab=installed" },
  { label: "Subscriptions", tab: "purchases", path: "/marketplace?tab=purchases" },
  { label: "Wallet", tab: "wallet", path: "/marketplace/wallet" },
];

type CollapsedNavFlyoutSubItem = {
  label: string;
  path: string;
  tab?: string;
  disabled?: boolean;
  badge?: string;
};

function CollapsedNavFlyout({
  href,
  active,
  icon,
  title,
  subItems,
  isSubActive,
  widthClass = "w-60",
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  title: string;
  subItems: CollapsedNavFlyoutSubItem[];
  isSubActive: (sub: CollapsedNavFlyoutSubItem) => boolean;
  widthClass?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [positionStyle, setPositionStyle] = useState<{ top?: number; bottom?: number }>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const calculatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const approxHeight = subItems.length * 40 + 52;
    const spaceBelow = window.innerHeight - rect.top;

    if (spaceBelow < approxHeight + 20) {
      const bottom = Math.max(12, window.innerHeight - rect.bottom);
      setPositionStyle({ bottom });
    } else {
      const top = Math.max(12, rect.top);
      setPositionStyle({ top });
    }
  };

  const handleMouseEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    calculatePosition();
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onScrollOrResize = () => {
      calculatePosition();
    };
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative group flex items-center justify-center my-0.5"
    >
      <Link
        href={href}
        className={`flex items-center justify-center w-12 h-12 mx-auto rounded-xl transition-all cursor-pointer ${
          active
            ? "bg-[#141010] text-white shadow-xs"
            : "text-[#5e5e5e] hover:bg-[#f1edec] hover:text-[#141010]"
        }`}
      >
        <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
      </Link>

      {isOpen && (
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            position: "fixed",
            left: "84px",
            ...(positionStyle.bottom !== undefined
              ? { bottom: `${positionStyle.bottom}px` }
              : { top: `${positionStyle.top ?? 12}px` }),
          }}
          className="z-[9999] pointer-events-auto transition-opacity duration-150"
        >
          {/* Bridge element to allow smooth mouse transit across the gap */}
          <div className="absolute -left-3 top-0 bottom-0 w-3 pointer-events-auto" />

          <div
            className={`${widthClass} bg-[#ffffff] border border-[#e7e5e4] rounded-2xl shadow-xl p-2 flex flex-col gap-1 text-xs`}
          >
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#78716c] border-b border-[#f1edec] mb-0.5">
              <span>{title}</span>
            </div>
            {subItems.map((sub) => {
              const activeItem = isSubActive(sub);
              if (sub.disabled) {
                return (
                  <div
                    key={sub.tab || sub.path}
                    className="flex items-center justify-between px-3 py-2 text-xs rounded-xl opacity-60 cursor-not-allowed select-none text-[#78716c]"
                    title="Coming Soon"
                  >
                    <span>{sub.label}</span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] leading-none font-medium bg-[#fffbeb] text-[#b45309] border border-[#fde68a] rounded-full">
                      {sub.badge || "Coming Soon"}
                    </span>
                  </div>
                );
              }
              return (
                <Link
                  key={sub.tab || sub.path}
                  href={sub.path}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center justify-between px-3 py-2 text-xs transition-all rounded-xl cursor-pointer ${
                    activeItem
                      ? "bg-[#0c0a09] text-white font-medium shadow-xs"
                      : "text-[#5e5e5e] hover:text-[#141010] hover:bg-[#f1edec] font-normal"
                  }`}
                >
                  <span>{sub.label}</span>
                  {activeItem && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-2" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function NavLink({
  href,
  label,
  icon,
  badge,
  isCollapsed,
  disabled,
  disabledTooltip,
}: NavItem & { isCollapsed?: boolean; disabled?: boolean; disabledTooltip?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active =
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href === "/settings" && pathname === "/organization") ||
    (href === "/qr-codes" && pathname.startsWith("/qr"));
  const qs = searchParams.toString();
  const targetHref =
    href === "/inventory"
      ? "/inventory/purchase-orders"
      : href === "/menu"
        ? "/menu"
        : href === "/qr-codes" || href === "/settings"
          ? href
          : qs
            ? `${href}?${qs}`
            : href;

  if (isCollapsed) {
    return (
      <div className="relative group flex items-center justify-center my-0.5">
        {disabled ? (
          <div
            className="flex items-center justify-center w-12 h-12 mx-auto rounded-xl opacity-40 cursor-not-allowed text-[#8a7e75] select-none"
            title={disabledTooltip || "Disabled in settings"}
          >
            <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
          </div>
        ) : (
          <Link
            href={targetHref}
            className={`flex items-center justify-center w-12 h-12 mx-auto rounded-xl transition-all cursor-pointer ${active
              ? "bg-[#141010] text-white shadow-xs"
              : "text-[#5e5e5e] hover:bg-[#f1edec] hover:text-[#141010]"
              }`}
          >
            <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
          </Link>
        )}
        <div className="fixed left-[76px] z-[9999] hidden group-hover:block transition-all pointer-events-none">
          <div className="px-3 py-1.5 bg-[#141010] text-white text-xs font-medium rounded-xl shadow-lg whitespace-nowrap flex items-center gap-1.5">
            <span>{label}</span>
            {badge && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] leading-none font-medium bg-[#fffbeb] text-[#b45309] rounded-full">
                {badge}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (disabled) {
    return (
      <div
        className="flex items-center gap-3 px-6 py-3 text-[15px] opacity-40 cursor-not-allowed text-[#8a7e75] select-none"
        title={disabledTooltip || "Disabled in settings"}
      >
        <span className="w-5 text-center flex items-center justify-center shrink-0">{icon}</span>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-medium text-[15px] shrink-0">{label}</span>
          {badge && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] leading-none font-medium bg-[#fffbeb] text-[#b45309] border border-[#fde68a] rounded-full shrink-0 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] shrink-0" />
              {badge}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <Link
      href={targetHref}
      className={`flex items-center gap-3 px-6 py-3 text-[15px] transition-colors cursor-pointer ${active
        ? "text-[#141010] font-bold border-r-2 border-[#141010] bg-[#f1edec] opacity-100"
        : "text-[#5e5e5e] hover:bg-[#f1edec]"
        }`}
    >
      <span className="w-5 text-center flex items-center justify-center shrink-0">{icon}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-medium text-[15px] shrink-0">{label}</span>
        {badge && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] leading-none font-medium bg-[#fffbeb] text-[#b45309] border border-[#fde68a] rounded-full shrink-0 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] shrink-0" />
            {badge}
          </span>
        )}
      </div>
    </Link>
  );
}

export function PosShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMenuPage = pathname.startsWith("/menu");
  const isInventoryPage = pathname.startsWith("/inventory");
  const isMarketplacePage = pathname.startsWith("/marketplace");
  const currentTab = searchParams.get("tab") || "purchaseOrders";

  const [isMenuExpanded, setIsMenuExpanded] = useState(isMenuPage);
  const [isInventoryExpanded, setIsInventoryExpanded] = useState(isInventoryPage);
  const [isMarketplaceExpanded, setIsMarketplaceExpanded] = useState(isMarketplacePage);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pos_main_sidebar_collapsed") === "true";
    }
    return false;
  });

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("pos_main_sidebar_collapsed", String(next));
      }
      return next;
    });
  };

  useEffect(() => {
    if (isMenuPage) {
      setIsMenuExpanded(true);
    }
  }, [isMenuPage]);

  useEffect(() => {
    if (isInventoryPage) {
      setIsInventoryExpanded(true);
    }
  }, [isInventoryPage]);

  useEffect(() => {
    if (isMarketplacePage) {
      setIsMarketplaceExpanded(true);
    }
  }, [isMarketplacePage]);

  const navRef = useRef<HTMLElement | null>(null);
  const activeMarketplaceSubRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (!isMarketplacePage || !isMarketplaceExpanded) return;

    const scrollToActive = () => {
      if (!navRef.current || !activeMarketplaceSubRef.current) return;
      const nav = navRef.current;
      const item = activeMarketplaceSubRef.current;
      const navRect = nav.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();

      const isAbove = itemRect.top < navRect.top + 24;
      const isBelow = itemRect.bottom > navRect.bottom - 24;

      if (isAbove || isBelow) {
        const currentScrollTop = nav.scrollTop;
        const relativeItemTop = itemRect.top - navRect.top;
        const targetScrollTop = currentScrollTop + relativeItemTop - (nav.clientHeight / 2) + (item.clientHeight / 2);
        nav.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: "smooth",
        });
      }
    };

    const t1 = setTimeout(scrollToActive, 60);
    const t2 = setTimeout(scrollToActive, 250);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [pathname, searchParams, isMarketplacePage, isMarketplaceExpanded]);

  const { signOut } = useClerk();
  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;
  const currentMembership = useQuery(
    api.organizationUsers.getCurrentMembership,
    activeOrg ? { organizationId: activeOrg._id } : "skip"
  );
  const acceptInvitationMutation = useMutation(api.organizationUsers.acceptInvitation);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const isDineInActive = activeOrg?.isDineIn !== false;
  const branchName = activeOrg?.name || (isMarketplacePage ? "The Grand Bistro HQ" : "Flagship Main Store");

  const { activeOrganization, availableStores, switchStore, openStoreSelector, isSwitching } = useStoreResolution();
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const storeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(event.target as Node)) {
        setStoreDropdownOpen(false);
      }
    }
    if (storeDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [storeDropdownOpen]);

  const isOwner = Boolean(
    activeOrg?.ownerClerkId &&
    currentMembership?.userId &&
    currentMembership.userId === activeOrg.ownerClerkId
  );

  const areAllChecklistStepsCompleted = Boolean(
    activeOrg?.onboardingCompleted === true ||
    (Array.isArray(activeOrg?.onboardingChecklist) &&
      [1, 2, 3, 4, 5, 6].every((id) => activeOrg.onboardingChecklist?.includes(id)))
  );

  const isOnboardingIncomplete = Boolean(
    isOwner && activeOrg && !areAllChecklistStepsCompleted
  );
  const isPendingInvitation = !isOwner && Boolean(
    currentMembership && (
      (currentMembership as any).status === "invited" ||
      !(currentMembership as any).status
    )
  );

  const [hasTicket, setHasTicket] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const search = window.location.search;
      if (search.includes("__clerk_ticket") || search.includes("__clerk_status=sign_in")) {
        setHasTicket(true);
      }
    }
  }, []);

  // Auto-sync invitation acceptance when user arrives with ticket or pending invitation
  useEffect(() => {
    let isMounted = true;
    if (isPendingInvitation && activeOrg?._id && !isAccepting && !acceptError) {
      setIsAccepting(true);
      acceptInvitationMutation({ organizationId: activeOrg._id })
        .catch((err: any) => {
          if (isMounted) {
            console.error("Auto-sync invitation error:", err);
            setAcceptError(err?.message || "Failed to sync invitation. Please try again.");
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsAccepting(false);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isPendingInvitation, activeOrg?._id, acceptError, isAccepting]);

  if (!isMarketplacePage && organizations !== undefined && (organizations.length === 0 || currentMembership === null)) {
    if (organizations.length === 0) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-[#fdf8f7] p-6 text-[#1c1b1b]">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-700">
              <span className="material-symbols-outlined text-[24px]">storefront</span>
            </div>
            <h2 className="text-xl font-semibold text-stone-900">Get Started with PREST</h2>
            <p className="mt-2 text-sm text-stone-600 leading-relaxed">
              You haven't set up your store workspace yet. Start the onboarding wizard to configure your restaurant.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                href="/onboarding"
                className="w-full rounded-xl bg-stone-900 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 text-center cursor-pointer shadow-xs"
              >
                Start Store Onboarding
              </Link>
              <button
                onClick={() => signOut({ redirectUrl: "/sign-in" })}
                className="w-full rounded-xl border border-stone-200 py-2.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#fdf8f7] p-6 text-[#1c1b1b]">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-stone-900">No Store Assigned</h2>
          <p className="mt-2 text-sm text-stone-600 leading-relaxed">
            You do not have any assigned store or your access has been revoked. Please contact the store owner.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => signOut({ redirectUrl: "/sign-in" })}
              className="w-full rounded-xl border border-stone-200 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isMarketplacePage && currentMembership && currentMembership.status === "inactive") {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#fdf8f7] p-6 text-[#1c1b1b]">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-stone-900">Account Deactivated</h2>
          <p className="mt-2 text-sm text-stone-600 leading-relaxed">
            Your staff account for {branchName} has been deactivated. Please contact your store administrator.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => signOut({ redirectUrl: "/sign-in" })}
              className="w-full rounded-xl border border-stone-200 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isMarketplacePage && isPendingInvitation) {
    if (hasTicket && !acceptError) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-[#fdf8f7] p-6 text-[#1c1b1b]">
          <div className="w-full max-w-md rounded-2xl border border-amber-100 bg-white p-8 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <svg className="h-7 w-7 animate-spin text-amber-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Invitation Verified
            </span>
            <h2 className="text-xl font-bold text-stone-900">
              Welcome to {branchName}
            </h2>
            <p className="mt-2 text-sm text-stone-600 leading-relaxed">
              Activating your workspace and entering store...
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#fdf8f7] p-6 text-[#1c1b1b]">
        <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 mb-3">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Invitation Pending
          </span>
          <h2 className="text-xl font-bold text-stone-900">
            Welcome to {branchName}
          </h2>
          <p className="mt-2 text-sm text-stone-600 leading-relaxed">
            You have been invited to join this store team. Please accept the invitation to access the point-of-sale system and start working.
          </p>

          <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            {acceptError}
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              disabled={isAccepting}
              onClick={async () => {
                if (!activeOrg) return;
                setIsAccepting(true);
                setAcceptError(null);
                try {
                  await acceptInvitationMutation({ organizationId: activeOrg._id });
                } catch (err: any) {
                  setAcceptError(
                    err?.message || "Failed to accept invitation. Please try again."
                  );
                } finally {
                  setIsAccepting(false);
                }
              }}
              className="w-full inline-flex items-center justify-center rounded-xl bg-stone-900 py-3 text-sm font-semibold text-white shadow hover:bg-stone-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isAccepting ? "Activating account..." : "Accept Invitation & Enter Store"}
            </button>
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: "/sign-in" })}
              className="w-full rounded-xl border border-stone-200 bg-white py-2.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#f5f5f5] text-[#1c1b1b] font-sans flex overflow-hidden">
      {/* SideNavBar */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-[#e7e5e4] bg-[#fdf8f7] lg:flex h-full transition-all duration-300 ease-in-out relative z-50 ${isCollapsed ? "w-20 overflow-visible" : "w-64 overflow-hidden"
          }`}
      >
        {/* Logo Header */}
        <div
          className={`px-4 py-5 border-b border-[#e7e5e4] flex items-center justify-between shrink-0 ${isCollapsed ? "flex-col gap-3 px-2 py-4" : "px-6 py-6"
            }`}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#f1edec] flex items-center justify-center overflow-hidden border border-[#e7e5e4] shrink-0 font-serif font-bold text-[#141010]">
              P
            </div>
            {!isCollapsed && (
              <div className="truncate">
                <h1 className="font-garamond text-[24px] text-[#141010] font-normal leading-none">PREST</h1>
                <p className="font-sans text-[10px] font-semibold text-[#5e5e5e] uppercase tracking-widest mt-1 truncate">
                  Management Suite
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg bg-[#f1edec] hover:bg-[#e7e5e4] text-[#141010] transition cursor-pointer shrink-0"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? "rotate-180" : ""
                }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav ref={navRef} className="flex-1 py-4 flex flex-col gap-1.5 overflow-y-auto min-h-0">
          {navItems.map((item) => {
            const updatedItem = item;
            if (item.href === "/menu") {
              if (isCollapsed) {
                return (
                  <CollapsedNavFlyout
                    key={item.href}
                    href="/menu"
                    active={isMenuPage}
                    icon={item.icon}
                    title="Menu"
                    widthClass="w-56"
                    subItems={menuSubItems}
                    isSubActive={(sub) =>
                      sub.path === "/menu"
                        ? pathname === "/menu" || (pathname.startsWith("/menu") && !pathname.startsWith("/menu/chef-prep-preferences"))
                        : pathname === sub.path || pathname.startsWith(sub.path)
                    }
                  />
                );
              }

              return (
                <div key={item.href} className="flex flex-col px-3 my-0.5">
                  <button
                    type="button"
                    onClick={() => setIsMenuExpanded((prev) => !prev)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[15px] transition-colors cursor-pointer ${isMenuPage
                      ? "bg-[#f1edec] text-[#141010] font-bold"
                      : "text-[#5e5e5e] hover:bg-[#f1edec]"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 flex items-center justify-center">{item.icon}</span>
                      <span className="font-medium text-[15px]">{item.label}</span>
                    </div>
                    <svg
                      className={`w-3.5 h-3.5 text-[#78716c] transition-transform duration-200 ${isMenuExpanded ? "rotate-180" : ""
                        }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isMenuExpanded && (
                    <div className="ml-5 pl-3 my-1.5 border-l border-[#e7e5e4] flex flex-col gap-1">
                      {menuSubItems.map((sub) => {
                        const isSubActive =
                          sub.path === "/menu"
                            ? pathname === "/menu" || (pathname.startsWith("/menu") && !pathname.startsWith("/menu/chef-prep-preferences"))
                            : pathname === sub.path || pathname.startsWith(sub.path);
                        return (
                          <Link
                            key={sub.path}
                            href={sub.path}
                            className={`flex items-center justify-between px-3.5 py-2 text-xs transition-all cursor-pointer ${isSubActive
                              ? "bg-[#0c0a09] text-white font-medium rounded-full shadow-xs"
                              : "text-[#5e5e5e] hover:text-[#141010] hover:bg-[#f1edec] rounded-lg font-normal"
                              }`}
                          >
                            <span>{sub.label}</span>
                            {isSubActive && (
                              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-2" />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            if (item.href === "/inventory") {
              if (isCollapsed) {
                return (
                  <CollapsedNavFlyout
                    key={item.href}
                    href="/inventory/purchase-orders"
                    active={isInventoryPage}
                    icon={item.icon}
                    title="Inventory"
                    widthClass="w-60"
                    subItems={inventorySubItems}
                    isSubActive={(sub) =>
                      pathname === sub.path ||
                      (pathname === "/inventory" && currentTab === sub.tab) ||
                      (pathname === "/inventory" && sub.tab === "purchaseOrders" && !searchParams.get("tab"))
                    }
                  />
                );
              }

              return (
                <div key={item.href} className="flex flex-col px-3 my-0.5">
                  <button
                    type="button"
                    onClick={() => setIsInventoryExpanded((prev) => !prev)}
                    className={`w-full flex items-center justify-between gap-1.5 px-3 py-2.5 rounded-xl text-[15px] transition-colors cursor-pointer ${isInventoryPage
                      ? "bg-[#f1edec] text-[#141010] font-bold"
                      : "text-[#5e5e5e] hover:bg-[#f1edec]"
                      }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 text-left">
                      <span className="w-5 flex items-center justify-center shrink-0">{item.icon}</span>
                      <span className="font-medium text-[14px] shrink-0">{item.label}</span>
                    </div>
                    <svg
                      className={`w-3.5 h-3.5 text-[#78716c] shrink-0 ml-1 transition-transform duration-200 ${isInventoryExpanded ? "rotate-180" : ""
                        }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isInventoryExpanded && (
                    <div className="ml-5 pl-3 my-1.5 border-l border-[#e7e5e4] flex flex-col gap-1">
                      {inventorySubItems.map((sub) => {
                        const isSubActive =
                          pathname === sub.path ||
                          (pathname === "/inventory" && currentTab === sub.tab) ||
                          (pathname === "/inventory" && sub.tab === "purchaseOrders" && !searchParams.get("tab"));
                        return (
                          <Link
                            key={sub.tab}
                            href={sub.path}
                            className={`flex items-center justify-between px-3.5 py-2 text-xs transition-all cursor-pointer ${isSubActive
                              ? "bg-[#0c0a09] text-white font-medium rounded-full shadow-xs"
                              : "text-[#5e5e5e] hover:text-[#141010] hover:bg-[#f1edec] rounded-lg font-normal"
                              }`}
                          >
                            <span>{sub.label}</span>
                            {isSubActive && (
                              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-2" />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            if (item.href === "/marketplace") {
              const currentMarketplaceTab = searchParams.get("tab") || "explore";
              if (isCollapsed) {
                return (
                  <CollapsedNavFlyout
                    key={item.href}
                    href="/marketplace?tab=explore"
                    active={isMarketplacePage}
                    icon={item.icon}
                    title="Marketplace"
                    widthClass="w-60"
                    subItems={marketplaceSubItems}
                    isSubActive={(sub) =>
                      pathname.startsWith("/marketplace/wallet")
                        ? sub.tab === "wallet"
                        : pathname === "/marketplace/checkout"
                        ? sub.tab === "explore"
                        : pathname === "/marketplace"
                        ? (searchParams.get("tab") || "explore") === sub.tab
                        : false
                    }
                  />
                );
              }

              return (
                <div key={item.href} className="flex flex-col px-3 my-0.5">
                  <button
                    type="button"
                    onClick={() => setIsMarketplaceExpanded((prev) => !prev)}
                    className={`w-full flex items-center justify-between gap-1.5 px-3 py-2.5 rounded-xl text-[15px] transition-colors cursor-pointer ${isMarketplacePage
                      ? "bg-[#f1edec] text-[#141010] font-bold"
                      : "text-[#5e5e5e] hover:bg-[#f1edec]"
                      }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 text-left">
                      <span className="w-5 flex items-center justify-center shrink-0">{item.icon}</span>
                      <span className="font-medium text-[14px] shrink-0">{item.label}</span>
                    </div>
                    <svg
                      className={`w-3.5 h-3.5 text-[#78716c] shrink-0 ml-1 transition-transform duration-200 ${isMarketplaceExpanded ? "rotate-180" : ""
                        }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isMarketplaceExpanded && (
                    <div className="ml-5 pl-3 my-1.5 border-l border-[#e7e5e4] flex flex-col gap-1">
                      {marketplaceSubItems.map((sub) => {
                        const isSubActive = pathname.startsWith("/marketplace/wallet")
                          ? sub.tab === "wallet"
                          : pathname === "/marketplace/checkout"
                          ? sub.tab === "explore"
                          : pathname === "/marketplace"
                          ? (searchParams.get("tab") || "explore") === sub.tab
                          : false;
                        if (sub.disabled) {
                          return (
                            <div
                              key={sub.tab}
                              className="flex items-center justify-between px-3.5 py-2 text-xs opacity-60 cursor-not-allowed select-none text-[#78716c]"
                              title="Coming Soon"
                            >
                              <span>{sub.label}</span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] leading-none font-medium bg-[#fffbeb] text-[#b45309] border border-[#fde68a] rounded-full shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] shrink-0" />
                                {sub.badge || "Coming Soon"}
                              </span>
                            </div>
                          );
                        }
                        return (
                          <Link
                            key={sub.tab}
                            href={sub.path}
                            ref={isSubActive ? activeMarketplaceSubRef : null}
                            className={`flex items-center justify-between px-3.5 py-2 text-xs transition-all cursor-pointer whitespace-nowrap ${isSubActive
                              ? "bg-[#0c0a09] text-white font-medium rounded-full shadow-xs"
                              : "text-[#5e5e5e] hover:text-[#141010] hover:bg-[#f1edec] rounded-lg font-normal"
                              }`}
                          >
                            <span className="truncate">{sub.label}</span>
                            {isSubActive && (
                              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-2" />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isCaptainDisabled = item.href === "/captain" && !isDineInActive;
            return (
              <NavLink
                key={updatedItem.href}
                {...updatedItem}
                isCollapsed={isCollapsed}
                disabled={isCaptainDisabled || item.disabled}
                disabledTooltip={
                  isCaptainDisabled
                    ? "Dine-in & Captain POS is disabled in Settings > Features"
                    : item.disabledTooltip
                }
              />
            );
          })}
        </nav>

        {/* Footer Toggle Bar */}
        <div className="p-3 border-t border-[#e7e5e4] flex items-center justify-between shrink-0 bg-[#fdf8f7]">
          {!isCollapsed && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#7a716b] px-2">
              Sidebar View
            </span>
          )}
          <button
            type="button"
            onClick={toggleSidebar}
            className={`p-2 rounded-xl bg-[#f1edec] hover:bg-[#e7e5e4] text-[#141010] transition cursor-pointer ${isCollapsed ? "w-full flex justify-center" : ""
              }`}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? "rotate-180" : ""
                }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#f5f5f5] h-full overflow-hidden">
        {/* TopAppBar */}
        <header className="w-full h-16 border-b border-[#e7e5e4] bg-[#fdf8f7] flex justify-between items-center px-6 lg:px-8 z-40 relative shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold tracking-wider uppercase text-stone-400 font-mono">Store Branch:</span>
            <div className="relative z-50" ref={storeDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  if (availableStores.length > 1) {
                    setStoreDropdownOpen((prev) => !prev);
                  }
                }}
                disabled={isSwitching}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold text-[#141010] bg-[#f1edec] hover:bg-[#e7e5e4] px-3 py-1.5 rounded-lg border border-[#e7e5e4] transition-colors ${
                  availableStores.length > 1
                    ? "cursor-pointer shadow-2xs"
                    : "cursor-default"
                }`}
                title={availableStores.length > 1 ? "Click to switch store" : undefined}
              >
                <span>{isSwitching ? "Switching store..." : branchName}</span>
                {availableStores.length > 1 && (
                  <svg
                    className={`w-3.5 h-3.5 text-stone-500 transition-transform ${
                      storeDropdownOpen ? "rotate-180" : ""
                    }`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                )}
              </button>

              {storeDropdownOpen && availableStores.length > 1 && (
                <div className="absolute left-0 mt-2 w-64 rounded-xl border border-[#e7e5e4] bg-white p-2 shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold text-[#78716c] uppercase tracking-wider border-b border-[#e7e5e4] mb-1">
                    Your Restaurants ({availableStores.length})
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {availableStores.map((store) => {
                      const isCurrent =
                        store.id === activeOrganization?.id ||
                        store.name === branchName ||
                        store.slug === activeOrg?.slug;
                      return (
                        <button
                          key={store.id}
                          type="button"
                          disabled={isCurrent || isSwitching}
                          onClick={async () => {
                            setStoreDropdownOpen(false);
                            await switchStore(store.id);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors text-left ${
                            isCurrent
                              ? "bg-[#faf9f8] text-[#141010] font-semibold border border-[#141010] cursor-default"
                              : "text-[#141010] hover:bg-[#f1edec] cursor-pointer"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-serif text-[11px] font-bold shrink-0 border ${
                                isCurrent
                                  ? "bg-[#141010] text-white border-[#141010]"
                                  : "bg-[#f1edec] text-[#141010] border-[#e7e5e4]"
                              }`}
                            >
                              {store.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="truncate font-medium">{store.name}</span>
                              <span className="text-[10px] text-[#78716c] capitalize">Role: {store.role}</span>
                            </div>
                          </div>
                          {isCurrent && (
                            <span className="shrink-0 text-[10px] font-semibold text-white bg-[#141010] px-2 py-0.5 rounded-full">
                              Current
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="pt-1.5 mt-1 border-t border-[#e7e5e4]">
                    <button
                      type="button"
                      onClick={() => {
                        setStoreDropdownOpen(false);
                        openStoreSelector();
                      }}
                      className="w-full text-center py-1.5 text-xs font-semibold text-[#141010] hover:bg-[#f1edec] rounded-lg transition-colors cursor-pointer"
                    >
                      Choose Restaurant...
                    </button>
                  </div>
                </div>
              )}
            </div>

            {isOnboardingIncomplete && (
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1f1f1f] hover:bg-black text-white text-xs font-medium rounded-lg shadow-xs transition-colors cursor-pointer ml-2"
              >
                <span className="material-symbols-outlined text-xs">arrow_back</span>
                <span>Back to Onboarding Checklist</span>
              </Link>
            )}
          </div>
          <div className="flex flex-1 justify-end items-center gap-4">
            <button
              type="button"
              className="w-10 h-10 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] transition-colors cursor-pointer"
              title="Notifications"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </button>

            <button
              type="button"
              className="w-10 h-10 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] transition-colors cursor-pointer"
              title="Settings"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>

            <div className="flex items-center ml-2">
              <UserButton afterSignOutUrl="/sign-in" />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">{children}</main>
      </div>
    </div>
  );
}