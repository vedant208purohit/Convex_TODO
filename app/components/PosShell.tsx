"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { ReactNode, useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

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

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

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
    href: "/inventory",
    label: "Inventory",
    icon: <InventoryIcon className="w-4 h-4" />,
  },
  {
    href: "/kds",
    label: "KDS",
    icon: <KdsIcon className="w-4 h-4" />,
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

const inventorySubItems = [
  { label: "Purchase order", tab: "purchaseOrders" },
  { label: "Supplier", tab: "suppliers" },
  { label: "Item library", tab: "itemLibrary" },
  { label: "Dead stock", tab: "deadStock" },
  { label: "Item recipes", tab: "itemRecipes" },
  { label: "Stock ledger", tab: "stockLedger" },
];

function NavLink({ href, label, icon }: NavItem) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = pathname === href || (href === "/settings" && pathname === "/organization");
  const qs = searchParams.toString();
  const targetHref = qs ? `${href}?${qs}` : href;

  return (
    <Link
      href={targetHref}
      className={`flex items-center gap-3 px-6 py-3 text-[15px] transition-colors cursor-pointer ${
        active
          ? "text-[#141010] font-bold border-r-2 border-[#141010] bg-[#f1edec] opacity-100"
          : "text-[#5e5e5e] hover:bg-[#f1edec]"
      }`}
    >
      <span className="w-5 text-center flex items-center justify-center">{icon}</span>
      <span className="font-medium text-[15px]">{label}</span>
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
  const isInventoryPage = pathname === "/inventory";
  const currentTab = searchParams.get("tab") || "purchaseOrders";

  const [isInventoryExpanded, setIsInventoryExpanded] = useState(isInventoryPage);

  useEffect(() => {
    if (isInventoryPage) {
      setIsInventoryExpanded(true);
    }
  }, [isInventoryPage]);

  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;
  const branchName = activeOrg?.name || "Flagship Main Store";

  return (
    <div className="h-screen bg-[#f5f5f5] text-[#1c1b1b] font-sans flex overflow-hidden">
      {/* SideNavBar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#e7e5e4] bg-[#fdf8f7] lg:flex h-full overflow-hidden">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-[#e7e5e4] flex items-center gap-4 shrink-0">
          <div className="w-10 h-10 rounded-full bg-[#f1edec] flex items-center justify-center overflow-hidden border border-[#e7e5e4] shrink-0 font-serif font-bold text-[#141010]">
            P
          </div>
          <div>
            <h1 className="font-garamond text-[24px] text-[#141010] font-normal leading-none">PREST</h1>
            <p className="font-sans text-[10px] font-semibold text-[#5e5e5e] uppercase tracking-widest mt-1">
              Management Suite
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 flex flex-col gap-1">
          {navItems.map((item) => {
            if (item.href === "/inventory") {
              return (
                <div key={item.href} className="flex flex-col px-3 my-0.5">
                  <button
                    type="button"
                    onClick={() => setIsInventoryExpanded((prev) => !prev)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[15px] transition-colors cursor-pointer ${
                      isInventoryPage
                        ? "bg-[#f1edec] text-[#141010] font-bold"
                        : "text-[#5e5e5e] hover:bg-[#f1edec]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 flex items-center justify-center">{item.icon}</span>
                      <span className="font-medium text-[15px]">{item.label}</span>
                    </div>
                    <svg
                      className={`w-3.5 h-3.5 text-[#78716c] transition-transform duration-200 ${
                        isInventoryExpanded ? "rotate-180" : ""
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
                          isInventoryPage &&
                          (currentTab === sub.tab || (sub.tab === "purchaseOrders" && !searchParams.get("tab")));
                        return (
                          <Link
                            key={sub.tab}
                            href={`/inventory?tab=${sub.tab}`}
                            className={`flex items-center justify-between px-3.5 py-2 text-xs transition-all cursor-pointer ${
                              isSubActive
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

            return <NavLink key={item.href} {...item} />;
          })}
        </nav>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#f5f5f5] h-full overflow-hidden">
        {/* TopAppBar */}
        <header className="w-full h-16 border-b border-[#e7e5e4] bg-[#fdf8f7] flex justify-between items-center px-6 lg:px-8 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold tracking-wider uppercase text-stone-400 font-mono">Store Branch:</span>
            <span className="text-xs font-semibold text-stone-800 bg-stone-100 px-2.5 py-1 rounded border border-[#eadfd6]">
              {branchName}
            </span>
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
        <main className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</main>
      </div>
    </div>
  );
}