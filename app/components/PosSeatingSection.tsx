"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";

export function PosSeatingSection() {
  const { isSignedIn } = useAuth();
  const organizations = useQuery(api.organizations.list);
  const organization = organizations?.[0] ?? null;
  const currentMembership = useQuery(
    api.organizationUsers.getCurrentMembership,
    organization?._id ? { organizationId: organization._id } : "skip"
  );
  const layouts = useQuery(
    api.organizationLayouts.list,
    isSignedIn && currentMembership ? {} : "skip"
  );
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);

  // Sort layouts by displayOrder when present
  const sortedLayouts = Array.isArray(layouts)
    ? [...layouts].sort((a, b) => {
        if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
          return a.displayOrder - b.displayOrder;
        }
        if (a.displayOrder !== undefined) return -1;
        if (b.displayOrder !== undefined) return 1;
        return a.name.localeCompare(b.name);
      })
    : [];

  // Default selection to first layout if not manually selected
  const activeLayoutId =
    selectedLayoutId && sortedLayouts.some((l) => l._id === selectedLayoutId)
      ? selectedLayoutId
      : sortedLayouts[0]?._id ?? null;

  // Query tables filtered by selected layout section
  const tables = useQuery(
    api.organizationTables.list,
    isSignedIn && currentMembership && activeLayoutId ? { layoutId: activeLayoutId as any } : "skip"
  );

  if (layouts === undefined) {
    return (
      <div className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6 text-center text-sm text-[#6f655e]">
        Loading seating sections...
      </div>
    );
  }

  if (layouts.length === 0) {
    return (
      <div className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6 text-center text-sm text-[#6f655e]">
        No seating sections configured.
      </div>
    );
  }

  const activeLayoutObj = sortedLayouts.find((l) => l._id === activeLayoutId);

  return (
    <div className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#eadfd6] pb-4">
        <div>
          <h2 className="text-lg font-medium text-[#1f1a17]">POS Seating & Table Grid</h2>
          <p className="mt-0.5 text-xs text-[#6f655e]">
            Cashier & Waiter floor plan section selector • Active Section:{" "}
            <span className="font-semibold text-[#1f1a17]">
              {activeLayoutObj?.name || "All Tables"}
            </span>
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700 self-start sm:self-auto">
          Live Seating
        </span>
      </div>

      {/* Floor Section Tabs */}
      <div className="mt-5 flex flex-wrap gap-2">
        {sortedLayouts.map((layout) => {
          const isSelected = layout._id === activeLayoutId;
          return (
            <button
              key={layout._id}
              type="button"
              onClick={() => setSelectedLayoutId(layout._id)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all ${
                isSelected
                  ? "bg-[#1f1a17] text-white shadow-sm"
                  : "border border-[#eadfd6] bg-white text-[#6f655e] hover:bg-[#f5efe9] hover:text-[#1f1a17]"
              }`}
            >
              <span>{layout.name}</span>
              {layout.displayOrder !== undefined ? (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    isSelected ? "bg-white/20 text-white" : "bg-[#f5efe9] text-[#8a7e75]"
                  }`}
                >
                  #{layout.displayOrder}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Tables Grid for Selected Section */}
      <div className="mt-6">
        {tables === undefined ? (
          <div className="rounded-2xl border border-[#eadfd6] bg-white px-4 py-3 text-sm text-[#6f655e]">
            Loading tables for {activeLayoutObj?.name}...
          </div>
        ) : tables.length === 0 ? (
          <div className="rounded-2xl border border-[#eadfd6] bg-white px-4 py-3 text-sm text-[#6f655e]">
            No active tables assigned to {activeLayoutObj?.name || "this section"}.
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {tables.map((table) => (
              <div
                key={table._id}
                className="flex flex-col justify-between rounded-2xl border border-[#eadfd6] bg-white p-4 shadow-sm hover:border-[#1f1a17] transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-[#8a7e75]">
                    Table
                  </span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500" title="Available" />
                </div>
                <div className="mt-2 text-xl font-bold text-[#1f1a17]">
                  #{table.tableNumber}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-[#6f655e] border-t border-[#eadfd6] pt-2">
                  <span>Capacity</span>
                  <span className="font-semibold text-[#1f1a17]">
                    {table.seatingCapacity} seats
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
