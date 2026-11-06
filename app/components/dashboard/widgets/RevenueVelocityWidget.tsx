"use client";

import React from "react";
import { Doc, Id } from "../../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { formatPriceWithSymbol } from "@/lib/constants/countries";

interface WidgetProps {
  organizationId: Id<"organizations">;
  widgetId: string;
  width: number;
  dateRangePreset?: any;
  fromTimestamp?: number;
  toTimestamp?: number;
  dateLabel?: string;
}

export function RevenueVelocityWidget({
  organizationId,
  widgetId,
  dateRangePreset = "today",
  fromTimestamp,
  toTimestamp,
  dateLabel,
}: WidgetProps) {
  const widgetData = useQuery(api.dashboards.getWidgetData, {
    organizationId,
    widgetId,
    dateRangePreset,
    fromTimestamp,
    toTimestamp,
  });

  const payload = (widgetData as any)?.payload;
  const currencySymbol = (widgetData as any)?.currencySymbol || "₹";
  const country = (widgetData as any)?.country;
  const netRevenueFormatted =
    widgetData?.kpi?.displayValue ||
    payload?.netRevenueFormatted ||
    formatPriceWithSymbol(0, currencySymbol, country);
  const deltaPercent = widgetData?.kpi?.deltaPercent ?? payload?.deltaPercent ?? 0;
  const deltaLabel = widgetData?.kpi?.deltaLabel || payload?.deltaLabel || "+0.0% vs Last Cycle";
  const coversCount = (widgetData?.kpi?.secondaryMetrics?.find((m) => m.label.includes("Paid"))?.value as number) ?? payload?.coversCount ?? payload?.totalOrders ?? 0;
  const averageCheckFormatted =
    payload?.averageCheckFormatted ||
    formatPriceWithSymbol(0, currencySymbol, country);
  const avgPacingMinutes = coversCount > 0 ? (payload?.avgPacingMinutes ?? 0) : null;
  const chartPoints: Array<{ label: string; value: number }> =
    widgetData?.chart?.data?.map((d: any) => ({ label: d.label, value: Number(d.value) })) ||
    payload?.chartPoints ||
    [];

  // Generate SVG path from points if available or flat baseline
  const points = chartPoints.length > 0 ? chartPoints.map((p) => p.value) : [0, 0, 0, 0, 0, 0, 0, 0];
  const maxVal = Math.max(...points, 100);
  const minVal = Math.min(...points, 0);
  const range = Math.max(1, maxVal - minVal);
  const svgWidth = 600;
  const svgHeight = 70;

  const coords = points.map((val, idx) => {
    const x = (idx / Math.max(1, points.length - 1)) * svgWidth;
    const y = svgHeight - ((val - minVal) / range) * 55 - 10;
    return { x, y };
  });

  const pathD = coords.reduce((acc, curr, idx, arr) => {
    if (idx === 0) return `M ${curr.x},${curr.y}`;
    const prev = arr[idx - 1];
    const cp1x = prev.x + (curr.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (curr.x - prev.x) / 2;
    const cp2y = curr.y;
    return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${curr.x},${curr.y}`;
  }, "");

  const areaD = coords.length > 0
    ? `${pathD} L ${coords[coords.length - 1].x},${svgHeight + 10} L ${coords[0].x},${svgHeight + 10} Z`
    : "";

  return (
    <div className="flex flex-col justify-between h-full">
      {/* Widget Internal Header */}
      <div className="flex items-start justify-between mb-space-md">
        <div className="flex flex-col">
          <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
            Revenue & Velocity Stream
          </span>
          <div className="flex items-baseline gap-space-md mt-0.5">
            <h2 className="font-display-sm text-display-sm text-on-surface">
              {netRevenueFormatted}
            </h2>
            <span
              className={`font-label-sm text-label-sm px-2 py-0.5 rounded-full ${
                deltaPercent >= 0
                  ? "text-on-surface bg-surface-container"
                  : "text-error bg-error-container/40"
              }`}
            >
              {deltaPercent >= 0 ? `+${deltaPercent.toFixed(1)}%` : `${deltaPercent.toFixed(1)}%`} vs Last Cycle
            </span>
          </div>
        </div>
        <div className="flex items-center gap-space-xs text-label-sm font-label-sm bg-surface-container-low px-space-md py-1 rounded-full text-secondary">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          <span>{dateLabel || "Today"}</span>
        </div>
      </div>

      {/* Inline SVG Visualization: Velocity Curve */}
      <div className="w-full h-32 flex flex-col justify-end">
        <svg className="w-full h-24 overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${svgWidth} ${svgHeight + 10}`}>
          <defs>
            <linearGradient id="curveGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.12"></stop>
              <stop offset="100%" stopColor="#000000" stopOpacity="0.0"></stop>
            </linearGradient>
          </defs>
          {areaD && <path d={areaD} fill="url(#curveGradient)" />}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#1e1b19"
              strokeLinecap="round"
              strokeWidth="2.5"
            />
          )}
          {coords.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={i === coords.length - 1 ? 5 : 3.5}
              className={i === coords.length - 1 ? "fill-primary" : "fill-surface stroke-primary"}
              strokeWidth="2"
            />
          ))}
        </svg>

        <div className="flex justify-between items-center text-label-sm font-label-sm text-outline mt-2 pt-2 bg-surface-container-low/40 rounded px-space-sm">
          <span>16:00</span>
          <span>18:00</span>
          <span>20:00</span>
          <span>22:00</span>
        </div>
      </div>

      {/* Card Footnote */}
      <div className="mt-space-md pt-space-sm flex items-center justify-between text-body-sm font-body-sm text-secondary border-t border-surface-container/60">
        <div className="flex items-center gap-space-lg">
          <span>
            Covers: <strong className="text-on-surface">{coversCount} Pax</strong>
          </span>
          <span>
            Avg Check: <strong className="text-on-surface">{averageCheckFormatted}</strong>
          </span>
          <span>
            Pacing: <strong className="text-on-surface">{avgPacingMinutes !== null ? `${avgPacingMinutes} min/ticket` : "--"}</strong>
          </span>
        </div>
        <span className="font-label-sm text-label-sm text-outline">Live Sync</span>
      </div>
    </div>
  );
}
