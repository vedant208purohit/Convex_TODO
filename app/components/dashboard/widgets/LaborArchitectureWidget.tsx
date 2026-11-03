"use client";

import React from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

interface WidgetProps {
  organizationId: Id<"organizations">;
  widgetId: string;
  width: number;
  dateRangePreset?: any;
  fromTimestamp?: number;
  toTimestamp?: number;
  dateLabel?: string;
}

export function LaborArchitectureWidget({
  organizationId,
  widgetId,
  dateRangePreset = "today",
  fromTimestamp,
  toTimestamp,
  dateLabel,
}: WidgetProps) {
  const widgetData = useQuery(api.dashboards.getWidgetData, {
    organizationId,
    widgetId: widgetId || "reports_hourly_velocity",
    dateRangePreset,
    fromTimestamp,
    toTimestamp,
  });

  const summary = (widgetData as any)?.summary || (widgetData as any)?.payload;
  const staffOnDutyCount = (widgetData?.kpi?.value as number) ?? summary?.staffOnDutyCount ?? 0;
  const laborCostPercent = staffOnDutyCount > 0 ? (summary?.laborCostPercent ?? 0) : 0;
  const laborCostTarget = summary?.laborCostTarget ?? 16;
  const staffRoster: Array<{
    name: string;
    section: string;
    salesFormatted: string;
    covers: number;
    progress: number;
  }> = summary?.staffRoster ?? [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-sm">
        <div className="flex flex-col">
          <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
            Labor Architecture
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">
            Floor Roster & Sales/Hour
          </h3>
        </div>
        <span className="font-label-md text-label-md px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold">
          {staffOnDutyCount} Staff On Duty
        </span>
      </div>

      {/* Mini Server Progress */}
      {staffRoster.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-6 text-center bg-surface-container-low rounded-lg text-secondary my-space-md">
          <span className="material-symbols-outlined text-3xl mb-1 text-outline">badge</span>
          <span className="text-body-sm font-medium">No active service shifts logged</span>
          <span className="text-label-sm text-outline">Staff assignments will appear here</span>
        </div>
      ) : (
        <div className="space-y-2.5 my-space-sm">
          {staffRoster.slice(0, 2).map((staff, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-body-sm font-body-sm">
                <span className="font-semibold text-on-surface">
                  {staff.name} ({staff.section})
                </span>
                <div className="flex items-center gap-space-md">
                  <span className="text-secondary">{staff.salesFormatted} Sales</span>
                  <span className="text-on-surface font-semibold">{staff.covers} Covers</span>
                </div>
              </div>
              <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${staff.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60">
        <span>
          Labor Cost vs Sales:{" "}
          <strong className="text-on-surface">
            {staffOnDutyCount > 0 ? `${laborCostPercent}%` : "--"} (Target: &lt;{laborCostTarget}%)
          </strong>
        </span>
        <span className="text-label-sm font-label-sm text-outline">Shift Active</span>
      </div>
    </div>
  );
}
