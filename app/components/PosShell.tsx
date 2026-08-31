"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { ReactNode } from "react";

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
      className={`flex items-center gap-3 rounded-full px-4 py-3 text-[15px] transition ${
        active ? "bg-[#e8e1dc] text-[#1f1a17] font-medium" : "text-[#6f655e] hover:bg-[#f3eeea]"
      }`}
    >
      <span className={`w-5 text-center ${active ? "text-[#1f1a17]" : "text-[#6f655e]"}`}>{icon}</span>
      <span>{label}</span>
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
    <div className="min-h-screen bg-[#f7f3ef] text-[#1f1a17]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[238px] shrink-0 flex-col border-r border-[#eadfd6] bg-[#faf6f3] lg:flex">
          <div className="px-4 pt-5">
            <div className="flex items-center gap-3 px-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2e2824] text-white">
                <span className="text-sm">🍽</span>
              </div>
              <div>
                <div className="text-[17px] font-medium leading-none">CulinaryPro</div>
                <div className="mt-1 text-[13px] text-[#786d65]">Kitchen Suite</div>
              </div>
            </div>

            <button className="mt-10 flex w-full items-center justify-center gap-3 rounded-full bg-[#191513] px-5 py-4 text-[16px] font-medium text-white shadow-[0_1px_0_rgba(0,0,0,0.08)]">
              <span className="text-xl leading-none">+</span>
              New Order
            </button>
          </div>

          <nav className="mt-10 flex flex-1 flex-col gap-2 px-3">
            {navItems.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-[#eadfd6] bg-[#fbf8f5]/95 backdrop-blur">
            <div className="flex items-center justify-between gap-4 px-5 py-4 lg:px-8">
              <div>
                <div className="text-[14px] font-medium text-[#2a2320]">{title}</div>
                {subtitle ? <div className="mt-1 text-[12px] text-[#7d726a]">{subtitle}</div> : null}
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-2 rounded-full bg-[#f0ebe6] px-4 py-2 text-[#7b7169] md:flex">
                  <span>⌕</span>
                  <span className="text-[14px]">Search...</span>
                </div>
                <button className="h-11 w-11 rounded-full border border-[#e7ddd4] text-[#4f4741]">🔔</button>
                <button className="h-11 w-11 rounded-full border border-[#e7ddd4] text-[#4f4741]">↻</button>
                <UserButton afterSignOutUrl="/sign-in" />
                <button className="rounded-full border border-[#1f1a17] px-5 py-2.5 text-[14px] font-medium text-[#1f1a17]">
                  Check Out
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-5 py-8 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
