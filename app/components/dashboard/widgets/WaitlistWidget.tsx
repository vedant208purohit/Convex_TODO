"use client";

import React from "react";
import Link from "next/link";
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

export function WaitlistWidget({
  organizationId,
  widgetId,
  dateRangePreset = "today",
  fromTimestamp,
  toTimestamp,
  dateLabel,
}: WidgetProps) {
  const widgetData = useQuery(api.dashboards.getWidgetData, {
    organizationId,
    widgetId: widgetId || "queue_waiting_customers",
    dateRangePreset,
    fromTimestamp,
    toTimestamp,
  });

  const summary = (widgetData as any)?.summary || (widgetData as any)?.payload;
  const waitingPartiesCount = summary?.waitingPartiesCount ?? 0;
  const waitingPaxTotal = summary?.waitingPaxTotal ?? 0;
  const avgWaitTimeMinutes = waitingPartiesCount > 0 ? ((widgetData?.kpi?.value as number) ?? summary?.avgWaitTimeMinutes ?? 0) : 0;
  const queueItems: Array<{
    position: number;
    name: string;
    pax: number;
    requestNote: string;
    status: string;
  }> = summary?.queueItems ?? [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-sm">
        <div className="flex flex-col">
          <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
            Host Stand
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">Waitlist & Walk-ins</h3>
        </div>
        <span className={`font-label-md text-label-md px-2 py-0.5 rounded-full font-semibold ${
          waitingPartiesCount > 0 ? "bg-error-container text-on-error-container" : "bg-surface-container text-on-surface"
        }`}>
          {avgWaitTimeMinutes}m Avg Wait
        </span>
      </div>

      {/* Waitlist mini ledger */}
      {queueItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-6 text-center bg-surface-container-low rounded-lg text-secondary my-space-sm">
          <span className="material-symbols-outlined text-3xl mb-1 text-outline">people</span>
          <span className="text-body-sm font-medium">No parties currently on waitlist</span>
          <span className="text-label-sm text-outline">Walk-ins and waitlist entries appear here</span>
        </div>
      ) : (
        <div className="space-y-2 my-space-sm">
          {queueItems.slice(0, 2).map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded bg-surface-container-low text-body-sm font-body-sm"
            >
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-label-sm ${
                  idx === 0 ? "bg-primary text-on-primary" : "bg-surface-container-highest text-on-surface"
                }`}>
                  {item.position}
                </span>
                <div>
                  <div className="font-semibold text-on-surface">{item.name} ({item.pax})</div>
                  <div className="text-label-sm text-outline">{item.requestNote}</div>
                </div>
              </div>
              <span
                className={`font-label-sm text-label-sm px-2 py-0.5 rounded ${
                  item.status === "Paging"
                    ? "bg-surface-container text-on-surface font-medium animate-pulse"
                    : "text-outline"
                }`}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60">
        <span>
          In Line: <strong className="text-on-surface">{waitingPartiesCount} Parties ({waitingPaxTotal} Pax)</strong>
        </span>
        <Link
          href="/queue"
          className="text-label-sm font-label-sm text-primary font-semibold hover:underline"
        >
          Full Queue &rarr;
        </Link>
      </div>
    </div>
  );
}
