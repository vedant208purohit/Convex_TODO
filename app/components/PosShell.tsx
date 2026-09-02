"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { ReactNode } from "react";

import { LanguageSelector } from "./LanguageSelector";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: <span className="text-lg leading-none">▣</span>,
  },
  {
    href: "/menu",
    label: "Menu",
    icon: <span className="text-lg leading-none">🍽</span>,
  },
  {
    href: "/orders",
    label: "Orders",
    icon: <span className="text-lg leading-none">⌵</span>,
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: <span className="text-lg leading-none">▭</span>,
  },
  {
    href: "/kds",
    label: "KDS",
    icon: <span className="text-lg leading-none">✕</span>,
  },
  {
    href: "/organization",
    label: "Organization",
    icon: <span className="text-lg leading-none">◫</span>,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: <span className="text-lg leading-none">⚙</span>,
  },
  {
    href: "/support",
    label: "Support",
    icon: <span className="text-lg leading-none">?</span>,
  },
];

function NavLink({ href, label, icon }: NavItem) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = pathname === href;
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
  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#1c1b1b] font-sans flex">
      {/* SideNavBar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#e7e5e4] bg-[#fdf8f7] lg:flex">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-[#e7e5e4] flex items-center gap-4">
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
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#f5f5f5]">
        {/* TopAppBar */}
        <header className="w-full h-16 border-b border-[#e7e5e4] bg-[#fdf8f7] flex justify-between items-center px-6 lg:px-8 z-30 shrink-0">
          <div className="flex items-center gap-6" />
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
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
