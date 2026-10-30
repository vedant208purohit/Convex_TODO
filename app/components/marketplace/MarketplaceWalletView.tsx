"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PosShell } from "../PosShell";
import { OrderDateRangePicker, getPresetDateRange } from "../OrderDateRangePicker";
import { generateWalletLedgerPdf } from "../../utils/generateWalletLedgerPdf";
import { Toast, type ToastMessage } from "../Toast";

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
  // 1. Live Convex Queries
  const wallet = useQuery(api.marketplace.getWallet, {});
  const [filterType, setFilterType] = useState<
    "all" | "topup" | "purchase" | "subscription" | "refund"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState(() => {
    const preset = "Last 30 Days";
    const { start, end } = getPresetDateRange(preset);
    return { startDate: start, endDate: end, preset };
  });

  const transactionsData = useQuery(api.marketplace.listTransactions, {
    type: filterType === "all" ? undefined : filterType,
    searchQuery: searchQuery.trim(),
    startDate: dateRange.startDate.getTime(),
    endDate: dateRange.endDate.getTime(),
  });

  // 2. Live Convex Mutations
  const topupWalletMutation = useMutation(api.marketplace.topupWallet);
  const updateAutoTopupMutation = useMutation(api.marketplace.updateAutoTopup);

  const balance =
    wallet?.balance !== undefined
      ? wallet.balance
      : externalBalance !== undefined
        ? externalBalance
        : 14500;

  const storeName = wallet?.storeName || "The Grand Bistro HQ";
  const escrowId = wallet?.escrowId || "PRST-WLT-88219";

  const [isAddMoneyModalOpen, setIsAddMoneyModalOpen] = useState(false);
  const [isAutoTopupModalOpen, setIsAutoTopupModalOpen] = useState(false);
  const [autoTopupEnabled, setAutoTopupEnabled] = useState(false);

  useEffect(() => {
    if (wallet?.autoTopupEnabled !== undefined) {
      setAutoTopupEnabled(wallet.autoTopupEnabled);
    }
  }, [wallet?.autoTopupEnabled]);

  const [customAmount, setCustomAmount] = useState<string>("5000");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "success",
    subtext?: string
  ) => {
    setToast({ message, type, subtext });
  };

  const handleAddMoney = async (amt: number) => {
    try {
      const suffix = Math.random().toString(36).substring(2, 9);
      const res = await topupWalletMutation({
        amount: amt,
        paymentMethod: "upi",
        idempotencyKey: `wallet_topup_${suffix}`,
      });
      if (onBalanceChange) onBalanceChange(res.newBalance);
      setIsAddMoneyModalOpen(false);
      showToast(`₹${amt.toLocaleString("en-IN")} added to wallet`, "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add money";
      showToast(msg, "error");
    }
  };

  const handleSaveAutoTopup = async () => {
    try {
      await updateAutoTopupMutation({
        enabled: autoTopupEnabled,
      });
      setIsAutoTopupModalOpen(false);
      showToast(
        autoTopupEnabled
          ? "Auto-Topup enabled successfully"
          : "Auto-Topup disabled"
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update auto-topup";
      showToast(msg, "error");
    }
  };

  const filteredTransactions: Transaction[] = useMemo(() => {
    return (transactionsData as Transaction[]) ?? [];
  }, [transactionsData]);

  const ITEMS_PER_PAGE = 5;
  const totalItems = filteredTransactions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const activePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (activePage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  // Close download menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        downloadMenuRef.current &&
        !downloadMenuRef.current.contains(e.target as Node)
      ) {
        setIsDownloadMenuOpen(false);
      }
    };

    if (isDownloadMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isDownloadMenuOpen]);

  // CSV Export Handler (Frontend-based Blob download)
  const handleDownloadCsv = () => {
    setIsDownloadMenuOpen(false);
    if (filteredTransactions.length === 0) {
      showToast("No transactions found", "info");
      return;
    }

    const escapeCsv = (val: unknown): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      "Date & Time",
      "Transaction ID",
      "Description",
      "Detail",
      "Type",
      "Amount (INR)",
      "Status",
    ];

    const rows = filteredTransactions.map((tx) =>
      [
        escapeCsv(tx.dateTime),
        escapeCsv(tx.code),
        escapeCsv(tx.description),
        escapeCsv(tx.detail || ""),
        escapeCsv(tx.typeLabel),
        escapeCsv(tx.amount),
        escapeCsv(tx.statusLabel),
      ].join(",")
    );

    let totalDeposited = 0;
    let totalDisbursed = 0;
    filteredTransactions.forEach((tx) => {
      if (tx.amount > 0) totalDeposited += tx.amount;
      else totalDisbursed += Math.abs(tx.amount);
    });

    const summaryRows = [
      "",
      [escapeCsv("--- STATEMENT SUMMARY ---"), "", "", "", "", "", ""].join(","),
      [escapeCsv("Available Balance"), "", "", "", "", escapeCsv(balance), ""].join(","),
      [escapeCsv("Total Deposited (Period)"), "", "", "", "", escapeCsv(totalDeposited), ""].join(","),
      [escapeCsv("Total Disbursed (Period)"), "", "", "", "", escapeCsv(-totalDisbursed), ""].join(","),
      [escapeCsv("Total Records"), "", "", "", "", escapeCsv(filteredTransactions.length), ""].join(","),
      [escapeCsv("Escrow ID"), escapeCsv("PRST-WLT-88219 (RBI Compliant)"), "", "", "", "", ""].join(","),
    ];

    const csvContent =
      headers.map(escapeCsv).join(",") +
      "\r\n" +
      rows.join("\r\n") +
      "\r\n" +
      summaryRows.join("\r\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateFormatted = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute("download", `PREST_Wallet_Ledger_${dateFormatted}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    showToast("CSV downloaded");
  };

  // PDF Export Handler (Frontend jsPDF statement download)
  const handleDownloadPdf = () => {
    setIsDownloadMenuOpen(false);
    if (filteredTransactions.length === 0) {
      showToast("No transactions found", "info");
      return;
    }

    try {
      generateWalletLedgerPdf({
        transactions: filteredTransactions,
        balance,
        dateRange,
        escrowId,
        storeName,
      });
      showToast("PDF downloaded");
    } catch (err) {
      console.error("PDF generation failed:", err);
      showToast("Failed to download PDF", "error");
    }
  };

  const walletContent = (
    <div className="p-3.5 sm:p-5 md:p-6 lg:p-7 xl:p-8 flex flex-col gap-4 sm:gap-6 w-full max-w-[1920px] mx-auto">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-1.5 text-[#5e5e5e] text-[11px] sm:text-xs font-medium">
        <Link href="/marketplace" className="hover:text-[#0c0a09] transition-colors">
          Marketplace
        </Link>
        <span className="material-symbols-outlined text-[13px] sm:text-[14px]">chevron_right</span>
        <span className="text-[#0c0a09] font-semibold">Wallet</span>
      </div>

      {/* 1. HERO SECTION: Luxurious, Cohesive Fintech-Grade Container */}
      <div className="relative w-full rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#faf8f5] via-[#fdf8f7] to-[#faf8f5] border border-[#e7e5e4] p-4 sm:p-6 md:p-8 lg:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
        {/* Subtle decorative ambient gold warmth isolated in an overflow-hidden wrapper */}
        <div className="absolute inset-0 rounded-2xl sm:rounded-3xl overflow-hidden pointer-events-none">
          <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-[#F5B942]/10 blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-[#E5D7C7]/25 blur-2xl pointer-events-none" />
        </div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-8 xl:gap-12 items-center">
          {/* LEFT SIDE OF HERO */}
          <div className="lg:col-span-8 xl:col-span-7 flex flex-col gap-4 sm:gap-5">
            {/* Badge & Context */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-[#FAF0E2] border border-[#E8D4B8] text-[#7A4B00] shadow-2xs">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#D97706] animate-pulse" />
                <span className="text-[10px] sm:text-[11px] tracking-wider font-semibold uppercase">
                  Marketplace Billing Wallet
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-[#5e5e5e] flex-wrap">
                <span className="font-semibold text-[#0c0a09]">{storeName}</span>
              </div>
            </div>

            {/* Main Balance Display */}
            <div className="flex flex-col gap-1.5 sm:gap-2 pt-1">
              <span className="text-[10.5px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold">
                Available Balance
              </span>
              <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
                <h1 className="font-garamond text-3xl xs:text-4xl sm:text-5xl md:text-6xl lg:text-[4rem] leading-none text-[#0c0a09] tracking-tight font-normal break-words">
                  ₹{balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </h1>
                <span className="text-xs font-bold text-[#5e5e5e] tracking-widest uppercase">
                  INR
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#5e5e5e] max-w-xl leading-relaxed mt-1">
                Ready to use for instant app purchases, automated POS syncs, and recurring subscriptions with zero gateway surcharges.
              </p>
            </div>

            {/* Immediate High-Visibility Actions Row */}
            <div className="pt-2 flex flex-wrap items-center gap-2 sm:gap-2.5 md:gap-3">
              {/* Primary CTA */}
              <Link
                href="/marketplace/wallet/add"
                className="w-full sm:w-auto bg-[#0c0a09] hover:bg-[#262626] text-white px-4 sm:px-5 lg:px-6 py-2.5 sm:py-3 rounded-lg font-medium shadow-md transition-all hover:scale-[1.02] active:scale-[0.99] flex items-center justify-center gap-2 text-xs sm:text-sm md:text-base cursor-pointer whitespace-nowrap"
              >
                <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#F5B942] text-[#0c0a09] flex items-center justify-center font-bold text-xs sm:text-sm leading-none">
                  +
                </span>
                <span>Add Money</span>
              </Link>

              {/* Secondary Action */}
              <button
                type="button"
                onClick={() => setIsAutoTopupModalOpen(true)}
                className="w-full sm:w-auto border border-[#e7e5e4] text-[#0c0a09] px-3.5 sm:px-4 lg:px-4.5 py-2.5 sm:py-3 rounded-lg font-medium hover:bg-[#f1edec] transition-colors text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer bg-white/80 backdrop-blur-xs whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[16px] sm:text-[18px] text-[#5e5e5e]">tune</span>
                <span>{autoTopupEnabled ? "Auto-Topup Active" : "Configure Auto-Topup"}</span>
              </button>

              {/* Tertiary Action: Download Ledger (CSV/PDF) Dropdown */}
              <div className="relative w-full sm:w-auto z-30 shrink-0" ref={downloadMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsDownloadMenuOpen((prev) => !prev)}
                  className="w-full sm:w-auto text-[#5e5e5e] hover:text-[#0c0a09] px-2.5 sm:px-3 py-2 sm:py-3 rounded-lg font-medium transition-colors text-xs sm:text-sm flex items-center justify-center gap-1.5 hover:bg-[#f1edec] cursor-pointer bg-white/60 sm:bg-transparent whitespace-nowrap"
                  aria-haspopup="true"
                  aria-expanded={isDownloadMenuOpen}
                >
                  <span className="material-symbols-outlined text-[16px] sm:text-[18px]">file_download</span>
                  <span>Download Ledger (CSV/PDF)</span>
                  <span
                    className={`material-symbols-outlined text-[16px] text-[#78716c] transition-transform duration-200 ${isDownloadMenuOpen ? "rotate-180" : ""
                      }`}
                  >
                    expand_more
                  </span>
                </button>

                {/* Dropdown Menu */}
                {isDownloadMenuOpen && (
                  <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-full sm:w-72 bg-white border border-[#e7e5e4] rounded-xl shadow-xl p-1.5 z-50">
                    <div className="px-3 py-2 border-b border-[#f1edec] mb-1">
                      <p className="text-[10px] uppercase font-bold text-[#78716c] tracking-wider">
                        Export Ledger Statement
                      </p>
                      <p className="text-[11px] text-[#a8a29e]">
                        {filteredTransactions.length} transaction{filteredTransactions.length === 1 ? "" : "s"} selected
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[#faf8f5] transition-colors flex items-center gap-3 text-xs text-[#0c0a09] font-medium cursor-pointer group"
                    >
                      <span className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                      </span>
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs text-[#0c0a09]">Download PDF</span>
                        <span className="text-[11px] text-[#78716c]">Official verified escrow statement</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadCsv}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[#faf8f5] transition-colors flex items-center gap-3 text-xs text-[#0c0a09] font-medium cursor-pointer group"
                    >
                      <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <span className="material-symbols-outlined text-[18px]">table_view</span>
                      </span>
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs text-[#0c0a09]">Download CSV</span>
                        <span className="text-[11px] text-[#78716c]">Spreadsheet for Excel & Sheets</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT SIDE OF HERO: 3D Wallet Illustration + Verification Pill */}
          <div className="lg:col-span-4 xl:col-span-5 flex flex-col items-center justify-center relative">
            <div className="relative flex items-center justify-center w-full max-w-[280px] sm:max-w-[340px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="PREST Wallet Illustration"
                className="w-[180px] xs:w-[220px] sm:w-[260px] md:w-[300px] h-auto object-contain drop-shadow-xl transition-transform duration-500 hover:scale-105"
                src="/images/prest-wallet.svg"
              />
            </div>

            {/* Floating Status Pill Overlay */}
            <div className="mt-2.5 sm:mt-3 inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-[#e7e5e4] shadow-xs text-[11px] sm:text-xs text-[#0c0a09] flex-wrap justify-center">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-600" />
              <span className="font-semibold text-emerald-800">✓ Active &amp; Verified Escrow</span>
              <span className="text-[#D0C4BE] hidden xs:inline">•</span>
              <span className="text-[#5e5e5e] font-medium">RBI Compliant</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. REFINED SECONDARY METRICS: Crisp typography & subtle separators */}
      <div className="rounded-xl sm:rounded-2xl bg-[#faf8f5] border border-[#e7e5e4] p-4 sm:p-6 md:py-7">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#e7e5e4] gap-5 md:gap-0">
          {/* Metric 1: Total Deposited */}
          <div className="flex flex-col gap-1.5 md:pr-6 lg:pr-8">
            <div className="flex items-center justify-between text-[#5e5e5e]">
              <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold">
                Total Deposited
              </span>
              <span className="material-symbols-outlined text-[16px] sm:text-[18px]">arrow_downward_alt</span>
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-garamond text-2xl sm:text-3xl font-bold text-[#0c0a09] tracking-tight">
                ₹45,000.00
              </span>
              <span className="text-[11px] sm:text-xs text-[#5e5e5e] font-medium">(6 deposits)</span>
            </div>
            <p className="text-[11px] sm:text-xs text-[#5e5e5e] flex items-center gap-1.5 pt-0.5">
              <span className="material-symbols-outlined text-[13px] sm:text-[14px] text-stone-400">history</span>
              <span>Last deposit on Oct 20, 2026</span>
            </p>
          </div>

          {/* Metric 2: Total Disbursed */}
          <div className="flex flex-col gap-1.5 pt-5 md:pt-0 md:px-6 lg:px-8">
            <div className="flex items-center justify-between text-[#5e5e5e]">
              <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold">
                Total Disbursed
              </span>
              <span className="material-symbols-outlined text-[16px] sm:text-[18px]">arrow_outward</span>
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-garamond text-2xl sm:text-3xl font-bold text-[#0c0a09] tracking-tight">
                ₹30,500.00
              </span>
              <span className="text-[11px] sm:text-xs text-[#5e5e5e] font-medium">(3 purchases · 12 cycles)</span>
            </div>
            <p className="text-[11px] sm:text-xs text-[#5e5e5e] flex items-center gap-1.5 pt-0.5">
              <span className="material-symbols-outlined text-[13px] sm:text-[14px] text-stone-400">receipt</span>
              <span>SaaS licenses &amp; micro-fees</span>
            </p>
          </div>

          {/* Metric 3: Monthly Burn Rate */}
          <div className="flex flex-col gap-1.5 pt-5 md:pt-0 md:pl-6 lg:pl-8">
            <div className="flex items-center justify-between text-[#5e5e5e]">
              <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold">
                Monthly Burn Rate
              </span>
              <span className="material-symbols-outlined text-[16px] sm:text-[18px]">donut_large</span>
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-garamond text-2xl sm:text-3xl font-bold text-[#0c0a09] tracking-tight">
                ₹2,198.00 <span className="text-xs sm:text-sm font-normal text-[#5e5e5e]">/ mo</span>
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-[#5e5e5e] pt-0.5 flex-wrap">
              <strong className="text-[#0c0a09] font-semibold">4 Active Subscriptions</strong> • Next billing Nov 01, 2026 •{" "}
              <span className="text-emerald-800 font-semibold">6.5 mos runway</span>
            </p>
          </div>
        </div>
      </div>

      {/* 3. RECENT TRANSACTIONS LEDGER */}
      <div className="flex flex-col bg-white rounded-xl sm:rounded-2xl border border-[#e7e5e4] shadow-xs relative z-30">
        {/* Table Filter Bar */}
        <div className="p-3.5 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 bg-[#faf8f5] border-b border-[#e7e5e4] rounded-t-xl sm:rounded-t-2xl">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
            {/* Search input */}
            <div className="relative flex items-center w-full sm:min-w-[220px] sm:max-w-xs shrink-0">
              <span className="material-symbols-outlined absolute left-3 text-stone-400 text-[18px] pointer-events-none">
                search
              </span>
              <input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-[#e7e5e4] text-[#0c0a09] placeholder:text-[#a8a29e] text-xs outline-none focus:ring-1 focus:ring-[#0c0a09] transition-all shadow-2xs font-sans"
                placeholder="Search Transaction ID or App..."
                type="text"
              />
            </div>

            {/* Filter Pills with touch scrolling */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden touch-pan-x">
              {(
                [
                  { label: "All Types", val: "all" },
                  { label: "Top-ups", val: "topup" },
                  { label: "Purchases", val: "purchase" },
                  { label: "Subscriptions", val: "subscription" },
                  { label: "Refunds", val: "refund" },
                ] as const
              ).map((pill) => (
                <button
                  key={pill.val}
                  type="button"
                  onClick={() => {
                    setFilterType(pill.val);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${filterType === pill.val
                      ? "bg-[#0c0a09] text-white shadow-xs"
                      : "bg-[#fdf8f7] text-[#5e5e5e] hover:bg-[#f1edec] border border-[#e7e5e4]"
                    }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range Filter (OrderDateRangePicker matching Menu & Reports) */}
          <div className="flex items-center gap-2 self-start lg:self-auto shrink-0">
            <OrderDateRangePicker
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              preset={dateRange.preset}
              onChange={(newRange) => {
                setDateRange(newRange);
                setCurrentPage(1);
              }}
              countryCode="IN"
              align="right"
            />
          </div>
        </div>

        {/* Transaction Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#faf8f5] border-b border-[#e7e5e4] text-[10px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
                <th className="py-3 px-4 sm:px-6">Date &amp; Time</th>
                <th className="py-3 px-3 sm:px-4">Transaction ID</th>
                <th className="py-3 px-3 sm:px-4">Description</th>
                <th className="py-3 px-3 sm:px-4">Type</th>
                <th className="py-3 px-3 sm:px-4 text-right">Amount</th>
                <th className="py-3 px-3 sm:px-4 text-center">Status</th>
                <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7e5e4] text-[#0c0a09]">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#5e5e5e] text-xs">
                    No transactions found matching your search and filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#faf8f5] transition-colors">
                    <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap font-medium text-[#0c0a09]">
                      {tx.dateTime}
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                      <span className="font-mono text-xs text-[#5e5e5e] bg-[#fdf8f7] px-2 py-0.5 rounded border border-[#e7e5e4] font-semibold">
                        {tx.code}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 font-medium text-[#0c0a09]">
                      {tx.description}{" "}
                      {tx.detail && (
                        <span className="text-[#5e5e5e] font-normal">{tx.detail}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${tx.type === "topup"
                            ? "bg-[#fdf8f7] text-[#0c0a09] border border-[#e7e5e4]"
                            : tx.type === "subscription"
                              ? "bg-amber-50 text-amber-900 border border-amber-200"
                              : "bg-[#fdf8f7] text-[#5e5e5e] border border-[#e7e5e4]"
                          }`}
                      >
                        {tx.typeLabel}
                      </span>
                    </td>
                    <td
                      className={`py-3.5 px-3 sm:px-4 text-right whitespace-nowrap font-mono font-bold ${tx.amount > 0 ? "text-emerald-700" : "text-[#0c0a09]"
                        }`}
                    >
                      {tx.amount > 0 ? `+₹${tx.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : `-₹${Math.abs(tx.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center whitespace-nowrap">
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
                    <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          showToast(`${tx.actionText} opened`)
                        }
                        className="text-xs text-[#0c0a09] hover:underline font-semibold cursor-pointer"
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
        <div className="p-3.5 sm:p-5 bg-[#faf8f5] border-t border-[#e7e5e4] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#5e5e5e] rounded-b-xl sm:rounded-b-2xl">
          <span>
            Showing{" "}
            <strong className="text-[#0c0a09] font-semibold">
              {totalItems === 0 ? 0 : `${startIndex + 1}–${endIndex}`}
            </strong>{" "}
            of{" "}
            <strong className="text-[#0c0a09] font-semibold">{totalItems}</strong> transactions
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={activePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-[#e7e5e4] text-[#5e5e5e] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f1edec] cursor-pointer"
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
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold transition-all cursor-pointer ${isActive
                      ? "bg-[#0c0a09] text-white shadow-xs"
                      : "bg-white border border-[#e7e5e4] hover:bg-[#f1edec] text-[#0c0a09]"
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
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-[#e7e5e4] text-[#5e5e5e] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f1edec] cursor-pointer"
              title="Next Page"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Institutional Notice & Escrow Guarantee */}
      <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-[#faf8f5] border border-[#e7e5e4] flex items-start gap-3 sm:gap-4 text-[#5e5e5e]">
        <span className="material-symbols-outlined text-[#5e5e5e] text-[20px] sm:text-[24px] shrink-0 mt-0.5">
          verified_user
        </span>
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-[11px] sm:text-xs text-[#0c0a09] font-bold uppercase tracking-wider">
            PREST Marketplace Ledger Guarantee
          </span>
          <p className="text-xs leading-relaxed text-[#5e5e5e]">
            This is your restaurant organization&apos;s dedicated Marketplace Billing Wallet. It is separated from POS table settlement accounts and protected by Reserve Bank escrow compliance guidelines. Funds deposited here are strictly utilized for procurement of software licenses, plugin integrations, and third-party SaaS services hosted on the PREST ecosystem.
          </p>
        </div>
      </div>

      {/* Quick Add Money Modal Dialog */}
      {isAddMoneyModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setIsAddMoneyModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-[#e7e5e4] flex flex-col gap-4 sm:gap-5 my-auto max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#e7e5e4]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FAF0E2] text-[#7A4B00] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">add_card</span>
                </div>
                <div>
                  <h3 className="font-garamond text-lg sm:text-xl font-bold text-[#0c0a09]">Add Wallet Balance</h3>
                  <p className="text-[11px] sm:text-xs text-[#5e5e5e]">Instant UPI &amp; Net Banking deposit</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMoneyModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#5e5e5e] hover:text-[#0c0a09] hover:bg-[#f1edec] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-2.5 sm:gap-3">
              <span className="text-[11px] sm:text-xs font-semibold text-[#0c0a09] uppercase tracking-wider">
                Select Deposit Amount (INR)
              </span>
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                {[2000, 5000, 10000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCustomAmount(amt.toString())}
                    className={`py-2.5 sm:py-3 px-1.5 sm:px-2 rounded-lg text-[11px] sm:text-xs font-mono font-bold border transition-all cursor-pointer ${customAmount === amt.toString()
                        ? "bg-[#0c0a09] text-white border-[#0c0a09] shadow-xs"
                        : "bg-[#fdf8f7] border-[#e7e5e4] text-[#0c0a09] hover:bg-[#f1edec]"
                      }`}
                  >
                    +₹{amt.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>

              <div className="relative mt-1 sm:mt-2">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5e5e5e] font-mono text-sm font-semibold">
                  ₹
                </span>
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 sm:py-2.5 rounded-lg border border-[#e7e5e4] text-[#0c0a09] text-xs sm:text-sm font-mono font-bold outline-none focus:ring-1 focus:ring-[#0c0a09]"
                  placeholder="Custom amount"
                />
              </div>
            </div>

            <div className="flex flex-col xs:flex-row items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleAddMoney(Number(customAmount) || 5000)}
                className="w-full xs:flex-1 py-2.5 sm:py-3 px-4 sm:px-5 rounded-lg bg-[#0c0a09] hover:bg-[#262626] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <span>Authorize Deposit</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddMoneyModalOpen(false)}
                className="w-full xs:w-auto py-2.5 sm:py-3 px-4 rounded-lg border border-[#e7e5e4] text-[#0c0a09] text-xs font-medium hover:bg-[#f1edec] cursor-pointer text-center"
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
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setIsAutoTopupModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-[#e7e5e4] flex flex-col gap-4 sm:gap-5 my-auto max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#e7e5e4]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#fdf8f7] text-[#0c0a09] border border-[#e7e5e4] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">tune</span>
                </div>
                <div>
                  <h3 className="font-garamond text-lg sm:text-xl font-bold text-[#0c0a09]">Configure Auto-Topup</h3>
                  <p className="text-[11px] sm:text-xs text-[#5e5e5e]">Maintain uninterrupted subscription runs</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAutoTopupModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#5e5e5e] hover:text-[#0c0a09] hover:bg-[#f1edec] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-3.5 sm:gap-4 text-xs text-[#5e5e5e]">
              <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#fdf8f7] border border-[#e7e5e4] gap-3">
                <div className="flex flex-col">
                  <span className="font-semibold text-[#0c0a09] text-xs sm:text-sm">Auto-Recharge Trigger</span>
                  <span className="text-[11px] text-[#5e5e5e]">When balance drops below ₹1,500</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoTopupEnabled(!autoTopupEnabled)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${autoTopupEnabled ? "bg-[#0c0a09]" : "bg-stone-300"
                    }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${autoTopupEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>

              <p className="text-[11px] leading-relaxed text-[#5e5e5e]">
                Auto-recharge utilizes your verified Mandate (HDFC Corporate Account ****4920) to maintain sufficient funds for recurring WhatsApp &amp; Cloud Backup subscriptions.
              </p>
            </div>

            <div className="flex flex-col xs:flex-row items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveAutoTopup}
                className="w-full xs:flex-1 py-2.5 sm:py-3 px-4 sm:px-5 rounded-lg bg-[#0c0a09] hover:bg-[#262626] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                Save Settings
              </button>
              <button
                type="button"
                onClick={() => setIsAutoTopupModalOpen(false)}
                className="w-full xs:w-auto py-2.5 sm:py-3 px-4 rounded-lg border border-[#e7e5e4] text-[#0c0a09] text-xs font-medium hover:bg-[#f1edec] cursor-pointer text-center"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standard Menu Toast Notification Component */}
      <Toast toast={toast} onClose={() => setToast(null)} />
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
