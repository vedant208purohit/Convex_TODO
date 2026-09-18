"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface StockLedgerRecord {
  _id: string;
  organizationId?: string;
  inventoryItemId?: string;
  itemName?: string;
  stockType?: "credit" | "debit";
  quantity?: number;
  unit?: string;
  sourceType?: string;
  purchaseOrderId?: string;
  supplierId?: string;
  orderId?: string;
  isDeadStock?: boolean;
  reasonForDeadStock?: string;
  createdAt: number;
}

export function StockLedgerView({ organizationId }: { organizationId: Id<"organizations"> }) {
  // Query inventory items to resolve ingredient names if needed
  const inventoryItems = useQuery(api.inventory.listInventoryItems, { organizationId });

  // Real existing backend queries & mutations
  const rawLedgerRecords: any[] = [];

  // Filters state (frontend-only)
  const [searchQuery, setSearchQuery] = useState("");
  const [stockTypeFilter, setStockTypeFilter] = useState<"all" | "credit" | "debit">("all");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>("all");

  // Map inventory items by ID for quick lookup
  const itemMap = useMemo(() => {
    const map = new Map<string, string>();
    if (inventoryItems) {
      for (const item of inventoryItems) {
        map.set(item._id, item.name);
      }
    }
    return map;
  }, [inventoryItems]);

  // Normalized ledger entries
  const ledgerEntries = useMemo(() => {
    const records: StockLedgerRecord[] = (rawLedgerRecords ?? []).map((r) => {
      const itemName = r.itemName ?? (r.inventoryItemId ? itemMap.get(r.inventoryItemId) : undefined) ?? "Ingredient Item";
      return {
        _id: r._id,
        organizationId: r.organizationId,
        inventoryItemId: r.inventoryItemId,
        itemName,
        stockType: r.stockType ?? (r.quantity < 0 ? "debit" : "credit"),
        quantity: Math.abs(r.quantity ?? 0),
        unit: r.unit ?? "unit",
        sourceType: r.sourceType ?? (r.isDeadStock ? "DeadStock" : "Adjustment"),
        purchaseOrderId: r.purchaseOrderId,
        supplierId: r.supplierId,
        orderId: r.orderId,
        isDeadStock: r.isDeadStock,
        reasonForDeadStock: r.reasonForDeadStock,
        createdAt: r.createdAt ?? Date.now(),
      };
    });

    return records.sort((a, b) => b.createdAt - a.createdAt);
  }, [rawLedgerRecords, itemMap]);

  // Frontend filtering
  const filteredEntries = useMemo(() => {
    return ledgerEntries.filter((entry) => {
      // Stock type filter
      if (stockTypeFilter !== "all" && entry.stockType !== stockTypeFilter) {
        return false;
      }

      // Source type filter
      if (sourceTypeFilter !== "all" && entry.sourceType !== sourceTypeFilter) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = entry.itemName?.toLowerCase().includes(q);
        const matchesSource = entry.sourceType?.toLowerCase().includes(q);
        const matchesReason = entry.reasonForDeadStock?.toLowerCase().includes(q);
        const matchesUnit = entry.unit?.toLowerCase().includes(q);
        if (!matchesName && !matchesSource && !matchesReason && !matchesUnit) {
          return false;
        }
      }

      return true;
    });
  }, [ledgerEntries, stockTypeFilter, sourceTypeFilter, searchQuery]);

  // Summary Metrics
  const metrics = useMemo(() => {
    let creditCount = 0;
    let debitCount = 0;
    for (const e of ledgerEntries) {
      if (e.stockType === "credit") creditCount++;
      else if (e.stockType === "debit") debitCount++;
    }
    return { total: ledgerEntries.length, credits: creditCount, debits: debitCount };
  }, [ledgerEntries]);

  if (inventoryItems === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-[#fbf9f8]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-stone-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-stone-500 font-medium">Loading Stock Movement Ledger...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#fbf9f8] p-8">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#e7e5e4]">
        <div>
          <h1 className="font-serif text-3xl font-medium text-[#0c0a09] tracking-tight">Stock Movement Ledger</h1>
          <p className="text-xs text-[#78716c] mt-0.5">
            Immutable chronological audit log of all raw material credits, restocks, sales depletions, and spoilage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Bar */}
          <div className="relative w-64">
            <svg
              className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a8a29e]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              className="w-full pl-9 pr-4 py-2 bg-white text-xs text-[#1c1917] border border-[#e7e5e4] rounded-full focus:outline-none focus:ring-1 focus:ring-[#0c0a09] placeholder:text-[#a8a29e] transition shadow-xs"
              placeholder="Search by item, source, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Movement Type Filter */}
          <select
            className="px-3.5 py-2 bg-white text-xs text-[#1c1917] border border-[#e7e5e4] rounded-full focus:outline-none focus:ring-1 focus:ring-[#0c0a09] shadow-xs"
            value={stockTypeFilter}
            onChange={(e) => setStockTypeFilter(e.target.value as any)}
          >
            <option value="all">All Movement Types</option>
            <option value="credit">Credits (+ Inbound)</option>
            <option value="debit">Debits (- Outbound)</option>
          </select>

          {/* Source Type Filter */}
          <select
            className="px-3.5 py-2 bg-white text-xs text-[#1c1917] border border-[#e7e5e4] rounded-full focus:outline-none focus:ring-1 focus:ring-[#0c0a09] shadow-xs"
            value={sourceTypeFilter}
            onChange={(e) => setSourceTypeFilter(e.target.value)}
          >
            <option value="all">All Sources</option>
            <option value="PurchaseOrder">Purchase Order Restock</option>
            <option value="OrderSale">POS Order Sale</option>
            <option value="ManualAdjustment">Manual Adjustment</option>
            <option value="DeadStock">Dead Stock / Spoilage</option>
          </select>
        </div>
      </div>

      {/* Summary Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <div className="bg-white border border-[#e7e5e4] rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-medium text-[#78716c] uppercase tracking-wider">Total Audit Entries</span>
          <p className="font-serif text-2xl font-semibold text-[#0c0a09] mt-1">{metrics.total}</p>
        </div>
        <div className="bg-white border border-[#e7e5e4] rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-medium text-[#78716c] uppercase tracking-wider">Inbound Restocks (Credits)</span>
          <p className="font-serif text-2xl font-semibold text-emerald-700 mt-1">+{metrics.credits}</p>
        </div>
        <div className="bg-white border border-[#e7e5e4] rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-medium text-[#78716c] uppercase tracking-wider">Outbound Depletions (Debits)</span>
          <p className="font-serif text-2xl font-semibold text-rose-700 mt-1">-{metrics.debits}</p>
        </div>
      </div>

      {/* Main Table / Empty State */}
      <div className="mt-6 flex-1 flex flex-col overflow-hidden">
        {filteredEntries.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#e7e5e4] rounded-2xl p-12 bg-white/50 text-center my-2">
            <div className="w-14 h-14 rounded-full bg-[#f5f5f4] border border-[#e7e5e4] flex items-center justify-center text-[#78716c] mb-4">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="font-serif text-2xl font-medium text-[#0c0a09]">No stock movement records found</h3>
            <p className="text-xs text-[#78716c] max-w-sm mt-1">
              Stock movement audit entries will automatically appear here when purchase orders are settled, POS orders are completed, or dead stock is logged.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#e7e5e4] rounded-xl shadow-xs overflow-hidden flex flex-col flex-1">
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#e7e5e4] bg-[#fafaf9]/80 text-[11px] uppercase tracking-wider text-[#78716c] font-medium sticky top-0 bg-white z-10">
                    <th className="py-3.5 px-5 font-normal">Timestamp</th>
                    <th className="py-3.5 px-5 font-normal">Ingredient Item</th>
                    <th className="py-3.5 px-5 font-normal">Movement Type</th>
                    <th className="py-3.5 px-5 font-normal">Quantity & Unit</th>
                    <th className="py-3.5 px-5 font-normal">Trigger Source</th>
                    <th className="py-3.5 px-5 text-right font-normal">Audit Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7e5e4]/70 text-xs">
                  {filteredEntries.map((entry) => {
                    const isCredit = entry.stockType === "credit";
                    return (
                      <tr key={entry._id} className="hover:bg-[#fafaf9] transition-colors">
                        <td className="py-4 px-5 text-[#57534e] whitespace-nowrap">
                          {new Date(entry.createdAt).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-4 px-5 font-medium text-[#0c0a09]">{entry.itemName}</td>
                        <td className="py-4 px-5">
                          {isCredit ? (
                            <span className="inline-flex items-center space-x-1 text-[11px] font-medium bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              <span>Credit (+ Inbound)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-[11px] font-medium bg-rose-50 text-rose-800 px-2.5 py-0.5 rounded-full border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                              <span>Debit (- Outbound)</span>
                            </span>
                          )}
                        </td>
                        <td className={`py-4 px-5 font-semibold ${isCredit ? "text-emerald-700" : "text-rose-600"}`}>
                          {isCredit ? "+" : "-"}{entry.quantity} {entry.unit}
                        </td>
                        <td className="py-4 px-5 text-[#57534e]">
                          <span className="font-mono text-[11px] bg-[#f5f5f4] text-[#44403c] px-2 py-0.5 rounded border border-[#e7e5e4]">
                            {entry.sourceType}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right font-mono text-[11px] text-[#78716c]">
                          {entry.reasonForDeadStock ? (
                            <span className="text-rose-700">{entry.reasonForDeadStock}</span>
                          ) : entry.purchaseOrderId ? (
                            `PO: ${entry.purchaseOrderId.slice(-6)}`
                          ) : entry.orderId ? (
                            `Order: ${entry.orderId.slice(-6)}`
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="py-3.5 px-5 border-t border-[#e7e5e4] bg-[#fafaf9]/50 flex items-center justify-between text-xs text-[#78716c] shrink-0">
              <span>Showing {filteredEntries.length} of {ledgerEntries.length} movement log(s)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
