"use client";

import React, { useState } from "react";

interface ReportTableProps {
  columns: string[];
  data?: any[];
  loading?: boolean;
  tableTitle?: string | null;
  pageSize?: number;
  totalLength?: number;
}

export function ReportTable({
  columns,
  data = [],
  loading = false,
  tableTitle,
  pageSize = 10,
  totalLength,
}: ReportTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const effectiveTotal = totalLength !== undefined ? totalLength : (data ? data.length : 0);
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize));

  // Determine displayed rows (if data contains full dataset, slice by current page)
  const isPagingOnClient = (totalLength === undefined || totalLength === data.length) && data.length > pageSize;
  const displayedRows = isPagingOnClient
    ? data.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : data;

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
  };

  return (
    <div className="flex flex-col rounded-2xl border border-[#eadfd6] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
      {/* Table Heading Title (if present) */}
      {tableTitle && (
        <div className="px-6 py-4 border-b border-[#f1edec] bg-[#fbf7f4]">
          <h3 className="text-base font-bold text-[#141010] tracking-tight">
            {tableTitle}
          </h3>
        </div>
      )}

      {/* Main Table Container */}
      <div className="overflow-x-auto min-w-full">
        {loading ? (
          <div className="p-8 space-y-4 animate-pulse">
            <div className="flex gap-4 border-b border-[#f1edec] pb-3">
              {columns.map((_, i) => (
                <div key={i} className="h-4 flex-1 bg-[#f1edec] rounded" />
              ))}
            </div>
            {[1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="flex gap-4 py-2 border-b border-[#fbf9f8]">
                {columns.map((_, col) => (
                  <div key={col} className="h-4 flex-1 bg-[#fbf7f4] rounded" />
                ))}
              </div>
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          /* Empty State Screen */
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 mb-4 rounded-2xl bg-[#fbf7f4] border border-[#eadfd6] flex items-center justify-center text-[#78716c]">
              <svg
                className="w-8 h-8 text-[#78716c]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <h4 className="text-base font-semibold text-[#141010]">
              No Reports Available Yet
            </h4>
            <p className="mt-1 text-xs text-[#78716c] max-w-sm">
              Reports will appear once you start recording transactions for the selected date range.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#e7e5e4] bg-[#fbf7f4] text-[#78716c]">
                {columns.map((col, idx) => (
                  <th
                    key={idx}
                    className="px-5 py-3.5 font-semibold uppercase tracking-wider text-[11px] text-[#5e5e5e] whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1edec]">
              {displayedRows.map((row, rowIndex) => {
                const values = Array.isArray(row) ? row : Object.values(row);
                return (
                  <tr
                    key={rowIndex}
                    className="hover:bg-[#fbf7f4] transition-colors"
                  >
                    {values.map((cell: any, cellIdx: number) => (
                      <td
                        key={cellIdx}
                        className="px-5 py-3.5 text-[#141010] font-medium whitespace-nowrap"
                      >
                        {cell !== undefined && cell !== null && cell !== ""
                          ? String(cell)
                          : "-"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      {!loading && effectiveTotal > pageSize && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#f1edec] bg-[#fbf7f4] text-xs text-[#78716c]">
          <div>
            Showing{" "}
            <span className="font-semibold text-[#141010]">
              {(currentPage - 1) * pageSize + 1}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-[#141010]">
              {Math.min(currentPage * pageSize, effectiveTotal)}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-[#141010]">
              {effectiveTotal}
            </span>{" "}
            records
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
              className="px-3 py-1.5 rounded-lg border border-[#e7e5e4] bg-white text-[#141010] font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f1edec] transition cursor-pointer"
            >
              Previous
            </button>
            <div className="flex items-center gap-1 px-2">
              <span className="font-semibold text-[#141010]">
                {currentPage}
              </span>
              <span>/</span>
              <span>{totalPages}</span>
            </div>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              className="px-3 py-1.5 rounded-lg border border-[#e7e5e4] bg-white text-[#141010] font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f1edec] transition cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
