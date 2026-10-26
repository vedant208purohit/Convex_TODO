"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { PosShell } from "../PosShell";

export interface Transaction {
  id: string;
  code: string;
  dateTime: string;
  description: string;
  detail?: string;
  type: "topup" | "subscription" | "purchase" | "refund";
  typeLabel: string;
  amount: number;
  status: "confirmed" | "pending" | "failed";
  statusLabel: string;
  actionText: string;
}

const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: "tx-1",
    code: "TXN-994820",
    dateTime: "Oct 20, 2026 14:32",
    description: "Wallet Top-up",
    detail: "(via UPI - HDFC Bank)",
    type: "topup",
    typeLabel: "Top-up",
    amount: 10000,
    status: "confirmed",
    statusLabel: "Confirmed",
    actionText: "View Receipt",
  },
  {
    id: "tx-2",
    code: "TXN-982144",
    dateTime: "Oct 18, 2026 09:15",
    description: "WhatsApp Catalog & Direct Order",
    detail: "(Monthly)",
    type: "subscription",
    typeLabel: "Subscription",
    amount: -999,
    status: "confirmed",
    statusLabel: "Confirmed",
    actionText: "Invoice",
  },
  {
    id: "tx-3",
    code: "TXN-973002",
    dateTime: "Oct 15, 2026 18:40",
    description: "PhonePe PG Integration Setup Fee",
    detail: "",
    type: "purchase",
    typeLabel: "Purchase",
    amount: -2500,
    status: "confirmed",
    statusLabel: "Confirmed",
    actionText: "Invoice",
  },
  {
    id: "tx-4",
    code: "TXN-962119",
    dateTime: "Oct 10, 2026 11:20",
    description: "Wallet Top-up",
    detail: "(via Net Banking - ICICI)",
    type: "topup",
    typeLabel: "Top-up",
    amount: 5000,
    status: "confirmed",
    statusLabel: "Confirmed",
    actionText: "View Receipt",
  },
  {
    id: "tx-5",
    code: "TXN-950183",
    dateTime: "Oct 05, 2026 16:05",
    description: "Top-up Attempt",
    detail: "(UPI QR)",
    type: "topup",
    typeLabel: "Top-up",
    amount: 2000,
    status: "pending",
    statusLabel: "Pending",
    actionText: "Check Status",
  },
  {
    id: "tx-6",
    code: "TXN-941092",
    dateTime: "Sep 28, 2026 12:10",
    description: "Zomato Dine-in Sync Extension",
    detail: "(Annual Plan)",
    type: "purchase",
    typeLabel: "Purchase",
    amount: -12000,
    status: "confirmed",
    statusLabel: "Confirmed",
    actionText: "Invoice",
  },
  {
    id: "tx-7",
    code: "TXN-938812",
    dateTime: "Sep 20, 2026 10:45",
    description: "Initial Organization Wallet Provisioning",
    detail: "(Wire Transfer)",
    type: "topup",
    typeLabel: "Top-up",
    amount: 30000,
    status: "confirmed",
    statusLabel: "Confirmed",
    actionText: "View Receipt",
  },
];

interface MarketplaceWalletViewProps {
  embeddedInMarketplace?: boolean;
  externalBalance?: number;
  onBalanceChange?: (newBalance: number) => void;
}

export function MarketplaceWalletView({
  embeddedInMarketplace = false,
  externalBalance,
  onBalanceChange,
}: MarketplaceWalletViewProps) {
  const [balance, setBalance] = useState<number>(
    externalBalance !== undefined ? externalBalance : 14500
  );
  const [filterType, setFilterType] = useState<
    "all" | "topup" | "purchase" | "subscription" | "refund"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddMoneyModalOpen, setIsAddMoneyModalOpen] = useState(false);
  const [isAutoTopupModalOpen, setIsAutoTopupModalOpen] = useState(false);
  const [autoTopupEnabled, setAutoTopupEnabled] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>("5000");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAddMoney = (amt: number) => {
    const updated = balance + amt;
    setBalance(updated);
    if (onBalanceChange) onBalanceChange(updated);
    setIsAddMoneyModalOpen(false);
    showToast(`₹${amt.toLocaleString("en-IN")} credited to your PREST Escrow Wallet.`);
  };

  const filteredTransactions = useMemo(() => {
    return INITIAL_TRANSACTIONS.filter((tx) => {
      const matchesType =
        filterType === "all" ? true : tx.type === filterType;
      const matchesSearch =
        searchQuery.trim() === "" ||
        tx.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.detail && tx.detail.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesType && matchesSearch;
    });
  }, [filterType, searchQuery]);

  const ITEMS_PER_PAGE = 5;
  const totalItems = filteredTransactions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const activePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (activePage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, searchQuery]);

  const walletContent = (
    <div className="p-6 lg:p-8 flex flex-col gap-6 w-full">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-1.5 text-stone-500 text-xs font-medium">
        <Link href="/marketplace" className="hover:text-stone-900 transition-colors">
          Marketplace
        </Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-stone-900 font-semibold">Wallet</span>
      </div>

      {/* 1. HERO SECTION: Luxurious, Cohesive Fintech-Grade Container */}
      <div className="relative w-full rounded-3xl bg-gradient-to-br from-[#FAF7F2] via-[#FAF3EC] to-[#F4ECE4] border border-[#E8E5DF] p-6 sm:p-8 md:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.03)] overflow-hidden">
        {/* Subtle decorative ambient gold warmth */}
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-[#F5B942]/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-[#E5D7C7]/25 blur-2xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* LEFT SIDE OF HERO */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Badge & Context */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF0E2] border border-[#E8D4B8] text-[#7A4B00] shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-[#D97706] animate-pulse" />
                <span className="text-[11px] tracking-wider font-semibold uppercase">
                  Marketplace Billing Wallet
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-stone-600">
                <span className="font-semibold text-stone-900">The Grand Bistro HQ</span>
                <span className="text-[#D0C4BE] font-bold">•</span>
                <span className="font-mono text-xs text-stone-500">
                  Escrow ID: PRST-WLT-88219
                </span>
              </div>
            </div>

            {/* Main Balance Display */}
            <div className="flex flex-col gap-2 pt-1">
              <span className="text-xs uppercase tracking-widest text-stone-500 font-semibold">
                Available Balance
              </span>
              <div className="flex items-baseline gap-3">
                <h1 className="font-garamond text-5xl sm:text-6xl md:text-[4.25rem] leading-none text-[#181818] tracking-tight font-normal">
                  ₹{balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </h1>
                <span className="text-xs font-bold text-stone-500 tracking-widest uppercase">
                  INR
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-600 max-w-xl leading-relaxed mt-1">
                Ready to use for instant app purchases, automated POS syncs, and recurring subscriptions with zero gateway surcharges.
              </p>
            </div>

            {/* Immediate High-Visibility Actions Row */}
            <div className="pt-2 flex flex-wrap items-center gap-3 md:gap-4">
              {/* Primary CTA */}
              <Link
                href="/marketplace/wallet/add"
                className="bg-[#171717] hover:bg-black text-white px-7 py-3 rounded-full font-medium shadow-md transition-all hover:scale-[1.02] active:scale-[0.99] flex items-center gap-2.5 text-sm sm:text-base cursor-pointer"
              >
                <span className="w-5 h-5 rounded-full bg-[#F5B942] text-[#181818] flex items-center justify-center font-bold text-sm leading-none">
                  +
                </span>
                <span>Add Money</span>
              </Link>

              {/* Secondary Action */}
              <button
                type="button"
                onClick={() => setIsAutoTopupModalOpen(true)}
                className="border border-[#D0C4BE] text-[#1e1b19] px-5 py-3 rounded-full font-medium hover:bg-black/5 transition-colors text-xs sm:text-sm flex items-center gap-2 cursor-pointer bg-white/50 backdrop-blur-xs"
              >
                <span className="material-symbols-outlined text-[18px] text-stone-600">tune</span>
                <span>{autoTopupEnabled ? "Auto-Topup Active" : "Configure Auto-Topup"}</span>
              </button>

              {/* Tertiary Action */}
              <button
                type="button"
                onClick={() =>
                  showToast("Ledger statement export generated. Download starting (CSV)...")
                }
                className="text-stone-600 hover:text-stone-900 px-4 py-3 rounded-full font-medium transition-colors text-xs sm:text-sm flex items-center gap-1.5 hover:bg-black/5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">file_download</span>
                <span>Download Ledger (CSV/PDF)</span>
              </button>
            </div>
          </div>

          {/* RIGHT SIDE OF HERO: 3D Wallet Illustration + Verification Pill */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
            <div className="relative flex items-center justify-center w-full max-w-[360px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="PREST Wallet Illustration"
                className="w-[280px] sm:w-[320px] h-auto object-contain drop-shadow-xl transition-transform duration-500 hover:scale-105"
                src="/images/prest-wallet.svg"
              />
            </div>

            {/* Floating Status Pill Overlay */}
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-[#E8E5DF] shadow-xs text-xs text-stone-900">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span className="font-semibold text-emerald-800">✓ Active &amp; Verified Escrow</span>
              <span className="text-[#D0C4BE]">•</span>
              <span className="text-stone-500 font-medium">RBI Compliant</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. REFINED SECONDARY METRICS: Crisp typography & subtle separators */}
      <div className="rounded-2xl bg-[#faf2ee]/70 border border-[#E8E5DF]/80 px-6 py-6 md:py-7">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E8E5DF]/80 gap-6 md:gap-0">
          {/* Metric 1: Total Deposited */}
          <div className="flex flex-col gap-1.5 md:pr-8">
            <div className="flex items-center justify-between text-stone-500">
              <span className="text-[11px] uppercase tracking-wider font-semibold">
                Total Deposited
              </span>
              <span className="material-symbols-outlined text-[18px]">arrow_downward_alt</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-garamond text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                ₹45,000.00
              </span>
              <span className="text-xs text-stone-500 font-medium">(6 deposits)</span>
            </div>
            <p className="text-xs text-stone-600 flex items-center gap-1.5 pt-0.5">
              <span className="material-symbols-outlined text-[14px] text-stone-400">history</span>
              <span>Last deposit on Oct 20, 2026</span>
            </p>
          </div>

          {/* Metric 2: Total Disbursed */}
          <div className="flex flex-col gap-1.5 pt-6 md:pt-0 md:px-8">
            <div className="flex items-center justify-between text-stone-500">
              <span className="text-[11px] uppercase tracking-wider font-semibold">
                Total Disbursed
              </span>
              <span className="material-symbols-outlined text-[18px]">arrow_outward</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-garamond text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                ₹30,500.00
              </span>
              <span className="text-xs text-stone-500 font-medium">(3 purchases · 12 cycles)</span>
            </div>
            <p className="text-xs text-stone-600 flex items-center gap-1.5 pt-0.5">
              <span className="material-symbols-outlined text-[14px] text-stone-400">receipt</span>
              <span>SaaS licenses &amp; micro-fees</span>
            </p>
          </div>

          {/* Metric 3: Monthly Burn Rate */}
          <div className="flex flex-col gap-1.5 pt-6 md:pt-0 md:pl-8">
            <div className="flex items-center justify-between text-stone-500">
              <span className="text-[11px] uppercase tracking-wider font-semibold">
                Monthly Burn Rate
              </span>
              <span className="material-symbols-outlined text-[18px]">donut_large</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-garamond text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                ₹2,198.00 <span className="text-sm font-normal text-stone-500">/ mo</span>
              </span>
            </div>
            <p className="text-xs text-stone-600 pt-0.5">
              <strong className="text-stone-900 font-semibold">4 Active Subscriptions</strong> • Next billing Nov 01, 2026 •{" "}
              <span className="text-emerald-800 font-semibold">6.5 mos runway</span>
            </p>
          </div>
        </div>
      </div>

      {/* 3. RECENT TRANSACTIONS LEDGER */}
      <div className="flex flex-col bg-white rounded-2xl border border-[#E8E5DF] shadow-xs overflow-hidden">
        {/* Table Filter Bar */}
        <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#faf2ee]/60 border-b border-[#E8E5DF]/70">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            {/* Search input */}
            <div className="relative flex items-center min-w-[240px] max-w-sm">
              <span className="material-symbols-outlined absolute left-3 text-stone-400 text-[18px] pointer-events-none">
                search
              </span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#E8E5DF] text-stone-900 placeholder:text-stone-400 text-xs outline-none focus:ring-1 focus:ring-stone-900 transition-all shadow-2xs"
                placeholder="Search by Transaction ID or App..."
                type="text"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  filterType === "all"
                    ? "bg-[#171717] text-white shadow-xs"
                    : "bg-[#ede7e4] text-stone-700 hover:bg-[#e4dcd7]"
                }`}
              >
                All Types
              </button>

              <button
                type="button"
                onClick={() => setFilterType("topup")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  filterType === "topup"
                    ? "bg-[#171717] text-white shadow-xs"
                    : "bg-[#ede7e4] text-stone-700 hover:bg-[#e4dcd7]"
                }`}
              >
                Top-ups
              </button>

              <button
                type="button"
                onClick={() => setFilterType("purchase")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  filterType === "purchase"
                    ? "bg-[#171717] text-white shadow-xs"
                    : "bg-[#ede7e4] text-stone-700 hover:bg-[#e4dcd7]"
                }`}
              >
                Purchases
              </button>

              <button
                type="button"
                onClick={() => setFilterType("subscription")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  filterType === "subscription"
                    ? "bg-[#171717] text-white shadow-xs"
                    : "bg-[#ede7e4] text-stone-700 hover:bg-[#e4dcd7]"
                }`}
              >
                Subscriptions
              </button>

              <button
                type="button"
                onClick={() => setFilterType("refund")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  filterType === "refund"
                    ? "bg-[#171717] text-white shadow-xs"
                    : "bg-[#ede7e4] text-stone-700 hover:bg-[#e4dcd7]"
                }`}
              >
                Refunds
              </button>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-2 self-start lg:self-auto">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#E8E5DF] shadow-2xs text-stone-800 text-xs font-medium cursor-pointer hover:bg-stone-50 transition-colors">
              <span className="material-symbols-outlined text-[16px] text-stone-500">calendar_today</span>
              <span>Last 30 Days</span>
              <span className="material-symbols-outlined text-[16px] text-stone-500">arrow_drop_down</span>
            </div>
          </div>
        </div>

        {/* Transaction Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#faf2ee]/70 border-b border-[#E8E5DF] text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                <th className="py-3 px-6">Date &amp; Time</th>
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E5DF]/60 text-stone-800">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-500 text-xs">
                    No transactions found matching your search and filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#faf2ee]/40 transition-colors">
                    <td className="py-3.5 px-6 whitespace-nowrap font-medium text-stone-900">
                      {tx.dateTime}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-mono text-xs text-stone-600 bg-[#ede7e4] px-2 py-0.5 rounded border border-stone-300/40 font-semibold">
                        {tx.code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-stone-900">
                      {tx.description}{" "}
                      {tx.detail && (
                        <span className="text-stone-500 font-normal">{tx.detail}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          tx.type === "topup"
                            ? "bg-[#ede7e4] text-stone-800"
                            : tx.type === "subscription"
                            ? "bg-[#FAF0E2] text-[#7A4B00]"
                            : "bg-stone-200/80 text-stone-800"
                        }`}
                      >
                        {tx.typeLabel}
                      </span>
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right whitespace-nowrap font-mono font-bold ${
                        tx.amount > 0 ? "text-emerald-700" : "text-[#181818]"
                      }`}
                    >
                      {tx.amount > 0 ? `+₹${tx.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : `-₹${Math.abs(tx.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {tx.status === "confirmed" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-semibold border border-emerald-200/50">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          Confirmed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-semibold border border-amber-200/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          showToast(`${tx.actionText} loaded for ${tx.code}.`)
                        }
                        className="text-xs text-stone-900 hover:underline font-semibold cursor-pointer"
                      >
                        {tx.actionText}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        <div className="p-4 sm:p-5 bg-[#faf2ee]/60 border-t border-[#E8E5DF] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-600">
          <span>
            Showing{" "}
            <strong className="text-stone-900 font-semibold">
              {totalItems === 0 ? 0 : `${startIndex + 1}–${endIndex}`}
            </strong>{" "}
            of{" "}
            <strong className="text-stone-900 font-semibold">{totalItems}</strong> transactions
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={activePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-[#E8E5DF] text-stone-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-50 cursor-pointer"
              title="Previous Page"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
              const isActive = pageNum === activePage;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#171717] text-white shadow-xs"
                      : "bg-white border border-[#E8E5DF] hover:bg-stone-50 text-stone-800"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              type="button"
              disabled={activePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-[#E8E5DF] text-stone-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-50 cursor-pointer"
              title="Next Page"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Institutional Notice & Escrow Guarantee */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#faf2ee] border border-[#E8E5DF] flex items-start gap-4 text-stone-600">
        <span className="material-symbols-outlined text-stone-500 text-[24px] shrink-0 mt-0.5">
          verified_user
        </span>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-stone-900 font-bold uppercase tracking-wider">
            PREST Marketplace Ledger Guarantee
          </span>
          <p className="text-xs leading-relaxed text-stone-600">
            This is your restaurant organization&apos;s dedicated Marketplace Billing Wallet. It is separated from POS table settlement accounts and protected by Reserve Bank escrow compliance guidelines. Funds deposited here are strictly utilized for procurement of software licenses, plugin integrations, and third-party SaaS services hosted on the PREST ecosystem.
          </p>
        </div>
      </div>

      {/* Quick Add Money Modal Dialog */}
      {isAddMoneyModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setIsAddMoneyModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-stone-200 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FAF0E2] text-[#7A4B00] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">add_card</span>
                </div>
                <div>
                  <h3 className="font-garamond text-xl font-bold text-stone-900">Add Wallet Balance</h3>
                  <p className="text-xs text-stone-500">Instant UPI & Net Banking deposit</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMoneyModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                Select Deposit Amount (INR)
              </span>
              <div className="grid grid-cols-3 gap-2.5">
                {[2000, 5000, 10000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCustomAmount(amt.toString())}
                    className={`py-3 px-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                      customAmount === amt.toString()
                        ? "bg-[#171717] text-white border-black shadow-xs"
                        : "bg-stone-50 border-stone-200 text-stone-800 hover:border-stone-400"
                    }`}
                  >
                    +₹{amt.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>

              <div className="relative mt-2">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 font-mono text-sm font-semibold">
                  ₹
                </span>
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-stone-300 text-stone-900 text-sm font-mono font-bold outline-none focus:ring-1 focus:ring-stone-900"
                  placeholder="Custom amount"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleAddMoney(Number(customAmount) || 5000)}
                className="flex-1 py-3 px-5 rounded-full bg-[#171717] hover:bg-black text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <span>Authorize Deposit</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddMoneyModalOpen(false)}
                className="py-3 px-4 rounded-full border border-stone-300 text-stone-700 text-xs font-medium hover:bg-stone-50 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Topup Modal Dialog */}
      {isAutoTopupModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setIsAutoTopupModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-stone-200 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">tune</span>
                </div>
                <div>
                  <h3 className="font-garamond text-xl font-bold text-stone-900">Configure Auto-Topup</h3>
                  <p className="text-xs text-stone-500">Maintain uninterrupted subscription runs</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAutoTopupModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs text-stone-600">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-50 border border-stone-200">
                <div className="flex flex-col">
                  <span className="font-semibold text-stone-900">Auto-Recharge Trigger</span>
                  <span className="text-[11px] text-stone-500">When balance drops below ₹1,500</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoTopupEnabled(!autoTopupEnabled)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    autoTopupEnabled ? "bg-[#171717]" : "bg-stone-300"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      autoTopupEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <p className="text-[11px] leading-relaxed text-stone-500">
                Auto-recharge utilizes your verified Mandate (HDFC Corporate Account ****4920) to maintain sufficient funds for recurring WhatsApp &amp; Cloud Backup subscriptions.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsAutoTopupModalOpen(false);
                  showToast(
                    autoTopupEnabled
                      ? "Auto-Topup rule enabled successfully."
                      : "Auto-Topup rule disabled."
                  );
                }}
                className="flex-1 py-3 px-5 rounded-full bg-[#171717] hover:bg-black text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                Save Settings
              </button>
              <button
                type="button"
                onClick={() => setIsAutoTopupModalOpen(false)}
                className="py-3 px-4 rounded-full border border-stone-300 text-stone-700 text-xs font-medium hover:bg-stone-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <div
        className={`fixed bottom-6 right-6 z-50 transform transition-all duration-300 ease-out ${
          toastMessage ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <div className="bg-[#141010] text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 max-w-md border border-stone-700">
          <span className="material-symbols-outlined text-[20px] text-[#ffb68e] shrink-0">
            check_circle
          </span>
          <span className="text-xs font-medium leading-relaxed">{toastMessage}</span>
        </div>
      </div>
    </div>
  );

  if (embeddedInMarketplace) {
    return walletContent;
  }

  return (
    <PosShell title="Marketplace" subtitle="Wallet">
      {walletContent}
    </PosShell>
  );
}
