"use client";

import React from "react";
import { CustomerTable, CustomerQr } from "./types";
import { QrScannerIcon } from "./CustomerIcons";

interface TableContextCardProps {
  table?: CustomerTable;
  qr?: CustomerQr | null;
}

export function TableContextCard({ table, qr }: TableContextCardProps) {
  const tableNum = table?.tableNumber || "T12";
  const layout = table?.layoutName;
  const tableDisplay = layout ? `Table ${tableNum} • ${layout}` : `Table ${tableNum}`;

  return (
    <div className="flex items-center justify-between bg-[#eaedff] px-3.5 py-2.5 rounded-xl shadow-xs border border-indigo-100/60">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-2.5 h-2.5 rounded-full bg-[#005e3f] animate-pulse flex-shrink-0" />
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold text-[#131b2e] truncate">
            {tableDisplay}
          </span>
          <span className="text-[11px] text-stone-500 truncate">
            Contactless Dining
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-[#4338ca]/10 text-[#4338ca] px-2 py-0.5 rounded-full flex-shrink-0">
        <QrScannerIcon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-bold tracking-wider">ACTIVE</span>
      </div>
    </div>
  );
}
