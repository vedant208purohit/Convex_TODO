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

// =========================================================
// 1. Total Orders Widget
// =========================================================
export function OrdersTotalVolumeWidget({
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

  const count =
    widgetData?.kpi?.value !== undefined && widgetData.kpi.value !== null
      ? widgetData.kpi.value
      : 0;

  const delta =
    widgetData?.kpi?.deltaLabel ||
    (widgetData?.kpi?.deltaPercent !== undefined
      ? `${widgetData.kpi.deltaPercent >= 0 ? "+" : ""}${widgetData.kpi.deltaPercent}%`
      : "+0.0%");

  const dineInCount =
    widgetData?.summary?.dineIn ??
    widgetData?.kpi?.secondaryMetrics?.find((m: any) =>
      String(m.label || "").toLowerCase().includes("dine"),
    )?.value ??
    0;

  const digitalCount =
    widgetData?.summary?.digital ??
    (Number(
      widgetData?.kpi?.secondaryMetrics?.find((m: any) =>
        String(m.label || "").toLowerCase().includes("takeaway"),
      )?.value || 0,
    ) +
      Number(
        widgetData?.kpi?.secondaryMetrics?.find((m: any) =>
          String(m.label || "").toLowerCase().includes("delivery"),
        )?.value || 0,
      ));

  return (
    <div className="flex flex-col justify-between h-full font-sans">
      {/* Header */}
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <span className="font-label-sm text-[10px] font-bold text-stone-400 tracking-widest uppercase">
            TICKET METRICS
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">
            Total Orders
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      {/* Visual Inset matching Drawer exactly */}
      <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-2.5 border border-[#f3ede6] my-auto">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-2xl sm:text-3xl text-stone-900 font-normal tracking-tight">
              {count}
            </span>
            <span className="text-xs font-sans text-stone-500 font-normal">
              Tkts
            </span>
          </div>
          <div className="inline-flex items-center gap-1 bg-[#ede6df] px-2 py-0.5 rounded-full text-[11px] font-semibold text-stone-800">
            <span className="material-symbols-outlined text-[13px]">
              trending_up
            </span>
            <span>{delta}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-1.5 pt-0.5">
          <span className="bg-white px-2.5 py-1 rounded text-[11px] font-medium text-stone-700 shadow-xs border border-stone-100 whitespace-nowrap shrink-0">
            {dineInCount} Dine-In
          </span>
          <span className="text-stone-300 text-xs">/</span>
          <span className="bg-white px-2.5 py-1 rounded text-[11px] font-medium text-stone-700 shadow-xs border border-stone-100 whitespace-nowrap shrink-0">
            {digitalCount} Digital
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60 mt-1">
        <span className="text-label-sm font-label-sm text-outline">Live Dispatch</span>
        <span className="flex items-center gap-1 text-on-surface text-label-sm font-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
          <span>Online</span>
        </span>
      </div>
    </div>
  );
}

// =========================================================
// 2. Live Orders Feed Widget
// =========================================================
export function OrdersLiveFeedWidget({
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

  const feedItems =
    widgetData?.liveFeed?.items && widgetData.liveFeed.items.length > 0
      ? widgetData.liveFeed.items.slice(0, 3)
      : widgetData?.table?.rows && widgetData.table.rows.length > 0
        ? widgetData.table.rows.slice(0, 3).map((r: any) => ({
            id: r.id || r._id,
            title:
              r.orderNumber ||
              r.orderNum ||
              r.ticket ||
              (r.id ? `#ORD-${String(r.id).slice(-4)}` : "#ORD-001"),
            subtitle: r.label || r.customer || "Dine-In",
            badge: { text: r.status || "Live" },
            timeAgo: r.time || r.elapsed || "now",
          }))
        : [];

  return (
    <div className="flex flex-col justify-between h-full font-sans">
      {/* Header */}
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <span className="font-label-sm text-[10px] font-bold text-stone-400 tracking-widest uppercase">
            DISPATCH STREAM
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">
            Live Orders Feed
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      {/* Visual Inset matching Drawer */}
      <div className="my-auto">
        {feedItems.length === 0 ? (
          <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col items-center justify-center min-h-[96px] text-center border border-[#f3ede6]">
            <span className="material-symbols-outlined text-stone-400 text-xl mb-1">
              receipt_long
            </span>
            <span className="text-xs font-medium text-stone-700">
              No incoming orders in this timeframe
            </span>
            <span className="text-[10px] text-stone-400">
              Live order feed updates dynamically
            </span>
          </div>
        ) : (
          <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-2 border border-[#f3ede6]">
            {feedItems.map((item: any, idx: number) => {
              const badgeBg =
                item.badge?.text === "Transit"
                  ? "bg-[#e8ded6] text-stone-800"
                  : item.badge?.text === "Completed"
                    ? "bg-[#e6f4ea] text-emerald-800"
                    : "bg-[#eee8e2] text-stone-800";

              return (
                <div
                  key={item.id || idx}
                  className="bg-white rounded-md px-2.5 py-1.5 flex items-center justify-between border border-stone-100 shadow-xs gap-1.5 min-w-0"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-900 shrink-0" />
                    <span className="text-[11px] font-bold text-stone-900 truncate max-w-[110px] sm:max-w-[130px] shrink-0">
                      {item.title}
                    </span>
                    <span className="text-[11px] text-stone-500 truncate min-w-0">
                      {item.subtitle}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${badgeBg}`}
                    >
                      {item.badge?.text || "Accepted"}
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono shrink-0 whitespace-nowrap">
                      {item.timeAgo || "now"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60 mt-1">
        <span className="text-label-sm font-label-sm text-outline">Realtime Queue</span>
        <span className="flex items-center gap-1 text-on-surface text-label-sm font-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
          <span>Online</span>
        </span>
      </div>
    </div>
  );
}

// =========================================================
// 3. Order Status Breakdown Widget
// =========================================================
export function OrdersByStatusWidget({
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

  const chartItems: Array<{ label: string; value: number; color?: string }> =
    widgetData?.chart?.data || [];
  const rawTotal =
    widgetData?.chart?.totalValue ??
    widgetData?.kpi?.value ??
    chartItems.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const total = Number(rawTotal) || 0;

  const defaultPalette = [
    "#262626", // Accepted
    "#EA9C1B", // In progress
    "#FC8019", // Ready to deliver
    "#219653", // Delivered
    "#7c604f", // Created
    "#8b5cf6", // Modify
    "#ef4444", // Reject
  ];

  // Dynamic segments for SVG Donut
  let cumulative = 0;
  const segments =
    total > 0
      ? chartItems
          .filter((d) => Number(d.value) > 0)
          .map((d, idx) => {
            const pct = Math.round((Number(d.value) / total) * 100);
            const offset = cumulative;
            cumulative += pct;
            return {
              label: d.label,
              value: Number(d.value),
              color: d.color || defaultPalette[idx % defaultPalette.length],
              pct,
              offset,
            };
          })
      : [];

  // Prioritize active stages with value > 0, then non-zero or top lifecycle processes
  const displayItems =
    chartItems.length > 0
      ? [
          ...chartItems.filter((d) => Number(d.value) > 0),
          ...chartItems.filter((d) => Number(d.value) === 0),
        ].slice(0, 4)
      : [
          { label: "Accepted", value: 0, color: "#262626" },
          { label: "In progress", value: 0, color: "#EA9C1B" },
          { label: "Ready to deliver", value: 0, color: "#FC8019" },
          { label: "Delivered", value: 0, color: "#219653" },
        ];

  return (
    <div className="flex flex-col justify-between h-full font-sans">
      {/* Header */}
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <span className="font-label-sm text-[10px] font-bold text-stone-400 tracking-widest uppercase">
            PARTITIONING
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">
            Order Status Breakdown
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      {/* Visual Inset: Dynamic Donut Chart with Process Legend from Settings */}
      <div className="bg-[#fcf8f5] rounded-lg p-2.5 sm:p-3 flex items-center justify-between gap-2.5 border border-[#f3ede6] my-auto">
        <div className="relative w-[72px] h-[72px] shrink-0 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18"
              cy="18"
              fill="none"
              r="14"
              pathLength="100"
              stroke="#f0ece6"
              strokeWidth="4.5"
            />
            {total > 0 &&
              segments.map((s, idx) => (
                <circle
                  key={idx}
                  cx="18"
                  cy="18"
                  fill="none"
                  r="14"
                  pathLength="100"
                  stroke={s.color}
                  strokeDasharray={`${s.pct} 100`}
                  strokeDashoffset={-s.offset}
                  strokeWidth="4.5"
                />
              ))}
          </svg>
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="font-serif text-base text-stone-900 font-normal leading-none">
              {total}
            </span>
            <span className="text-[8px] font-sans text-stone-400 uppercase tracking-wider mt-0.5">
              TOTAL
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-0">
          {displayItems.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-[11px] gap-1"
            >
              <span className="flex items-center gap-1.5 text-stone-700 truncate">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      item.color || defaultPalette[idx % defaultPalette.length],
                  }}
                />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="font-semibold text-stone-900 font-mono shrink-0 whitespace-nowrap ml-1">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60 mt-1">
        <span className="text-label-sm font-label-sm text-outline">Pipeline Pacing</span>
        <span className="flex items-center gap-1 text-on-surface text-label-sm font-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
          <span>Online</span>
        </span>
      </div>
    </div>
  );
}

// =========================================================
// 4. Top Orders by Value Widget
// =========================================================
export function OrdersHighValueWidget({
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

  const rows =
    widgetData?.table?.rows && widgetData.table.rows.length > 0
      ? widgetData.table.rows.slice(0, 3)
      : [];

  return (
    <div className="flex flex-col justify-between h-full font-sans">
      {/* Header */}
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <span className="font-label-sm text-[10px] font-bold text-stone-400 tracking-widest uppercase">
            HIGH VALUE TRANSACTIONS
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">
            Top Orders by Value
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      {/* Visual Inset matching Drawer */}
      <div className="my-auto">
        {rows.length === 0 ? (
          <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col items-center justify-center min-h-[96px] text-center border border-[#f3ede6]">
            <span className="material-symbols-outlined text-stone-400 text-xl mb-1">
              payments
            </span>
            <span className="text-xs font-medium text-stone-700">
              No high-value orders in this timeframe
            </span>
            <span className="text-[10px] text-stone-400">
              Orders exceeding ₹1,000 appear here
            </span>
          </div>
        ) : (
          <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-2 border border-[#f3ede6]">
            {rows.map((row: any, idx: number) => (
              <div
                key={idx}
                className="bg-white rounded-md p-2 flex flex-col gap-1 border border-stone-100 shadow-xs min-w-0"
              >
                {/* Line 1: Order # on left, Amount on right - Never Collide */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-[11px] font-bold text-stone-900 truncate">
                    {row.orderNumber ||
                      row.orderNum ||
                      row.ticket ||
                      `#ORD-${String(row.id || "").slice(-4)}`}
                  </span>
                  <span className="text-[11px] font-bold text-stone-900 font-mono shrink-0 whitespace-nowrap">
                    {row.amount || "₹0.00"}
                  </span>
                </div>
                {/* Line 2: Patron / Channel on left, Status badge on right */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-[10px] text-stone-500 truncate">
                    {row.label || row.customer || "Dine-In"}
                  </span>
                  <span
                    className={`text-[9.5px] font-semibold px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap ${row.statusBg || "bg-[#eee8e2] text-stone-800"}`}
                  >
                    {row.status || "Paid"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60 mt-1">
        <span className="text-label-sm font-label-sm text-outline">Folio Ledger</span>
        <span className="flex items-center gap-1 text-on-surface text-label-sm font-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
          <span>Online</span>
        </span>
      </div>
    </div>
  );
}

// =========================================================
// 5. Delayed Orders Alert Widget
// =========================================================
export function OrdersDelayedAlertsWidget({
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

  const delayedCount =
    widgetData?.alert?.count ?? widgetData?.table?.rows?.length ?? 0;
  const delayedOrder =
    (widgetData?.alert as any)?.delayedOrders?.[0] ||
    widgetData?.table?.rows?.[0] ||
    (widgetData?.alert as any)?.items?.[0];

  const hasDelayedOrders = delayedCount > 0 && Boolean(delayedOrder && (delayedOrder.orderNumber || delayedOrder.orderNum || delayedOrder.ticket));

  return (
    <div className="flex flex-col justify-between h-full font-sans">
      {/* Header */}
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <span className="font-label-sm text-[10px] font-bold text-stone-400 tracking-widest uppercase">
            SERVICE LATENCY
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">
            Delayed Orders Alert
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      {/* Visual Inset matching Drawer */}
      <div className="bg-[#fcf8f5] rounded-lg p-2.5 border border-[#f3ede6] my-auto">
        {!hasDelayedOrders ? (
          <div className="bg-[#f0f9f1] border border-[#cbe8cf] rounded-md p-2.5 flex flex-col items-center justify-center gap-1 text-center">
            <span className="material-symbols-outlined text-[#256334] text-xl">
              check_circle
            </span>
            <span className="text-xs font-bold text-[#256334]">
              All Orders Within SLA Target
            </span>
            <span className="text-[10px] text-stone-500">
              0 delayed kitchen or dispatch orders
            </span>
          </div>
        ) : (
          <div className="bg-[#fff4f2] border border-[#fed7d2] rounded-md p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 text-[#b3261e] min-w-0">
                <span className="material-symbols-outlined text-[15px] shrink-0">
                  warning
                </span>
                <span className="text-xs font-bold truncate">
                  Order Exceeding Target
                </span>
              </div>
              <span className="bg-white/90 text-[#b3261e] text-[9.5px] font-bold px-1.5 py-0.5 rounded-full border border-[#fec5bd] shrink-0 whitespace-nowrap">
                {delayedOrder?.delay || "+15m Over"}
              </span>
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-xs font-semibold text-stone-900 truncate">
                {delayedOrder?.orderNumber ||
                  delayedOrder?.orderNum ||
                  delayedOrder?.ticket ||
                  "Delayed Ticket"}{" "}
                • {delayedOrder?.label || "Kitchen Pass"}
              </span>
              <span className="text-[10.5px] text-stone-500 font-mono shrink-0 ml-1">
                {delayedOrder?.elapsed || "delayed"}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10.5px] text-stone-600 pt-0.5">
              <span className="material-symbols-outlined text-[13px] shrink-0">
                soup_kitchen
              </span>
              <span className="truncate">
                {delayedOrder?.note ||
                  "Kitchen station SLA threshold exceeded"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60 mt-1">
        <span className="text-label-sm font-label-sm text-outline">SLA Telemetry</span>
        <span className="flex items-center gap-1 text-on-surface text-label-sm font-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
          <span>Online</span>
        </span>
      </div>
    </div>
  );
}

// =========================================================
// 6. Orders Over Time Widget
// =========================================================
export function OrdersVolumeOverTimeWidget({
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

  const chartData = widgetData?.chart?.data || [];
  const maxVal = Math.max(
    ...chartData.map((d: any) => Number(d.value) || 0),
    0,
  );

  let selectedItems = chartData;
  if (chartData.length > 0) {
    const activeIndices = chartData
      .map((d: any, idx: number) => (Number(d.value) > 0 ? idx : -1))
      .filter((idx: number) => idx !== -1);

    if (activeIndices.length > 0) {
      const firstActive = Math.min(...activeIndices);
      const lastActive = Math.max(...activeIndices);
      let startIdx = Math.max(0, firstActive - 1);
      let endIdx = Math.min(chartData.length, lastActive + 2);
      if (endIdx - startIdx < 7) {
        const needed = 7 - (endIdx - startIdx);
        startIdx = Math.max(0, startIdx - Math.ceil(needed / 2));
        endIdx = Math.min(chartData.length, startIdx + 7);
        startIdx = Math.max(0, endIdx - 7);
      }
      selectedItems = chartData.slice(startIdx, endIdx);
    } else {
      // Default to daytime service window (9a to 5p)
      selectedItems = chartData.slice(0, 9);
    }
  }

  const hours =
    selectedItems.length > 0
      ? selectedItems.map((d: any) => {
          const val = Number(d.value) || 0;
          const pct = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
          return {
            label: d.label,
            height: `${Math.max(pct, val > 0 ? 15 : 0)}%`,
            isPeak: val === maxVal && maxVal > 0,
            value: val,
          };
        })
      : [
          { label: "10a", height: "0%", isPeak: false, value: 0 },
          { label: "12p", height: "0%", isPeak: false, value: 0 },
          { label: "2p", height: "0%", isPeak: false, value: 0 },
          { label: "4p", height: "0%", isPeak: false, value: 0 },
          { label: "6p", height: "0%", isPeak: false, value: 0 },
          { label: "8p", height: "0%", isPeak: false, value: 0 },
          { label: "10p", height: "0%", isPeak: false, value: 0 },
        ];

  return (
    <div className="flex flex-col justify-between h-full font-sans">
      {/* Header */}
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <span className="font-label-sm text-[10px] font-bold text-stone-400 tracking-widest uppercase">
            TEMPO PACING
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">
            Orders Over Time
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      {/* Visual Inset: Bar Histogram matching Drawer */}
      <div className="bg-[#fcf8f5] rounded-lg p-2.5 sm:p-3 flex flex-col justify-between border border-[#f3ede6] my-auto overflow-hidden">
        <div className="flex items-end justify-between h-18 px-0.5 gap-1 w-full overflow-hidden">
          {hours.map((h: any, i: number) => {
            const cleanLabel = String(h.label || "").replace(/^0/, "");
            return (
              <div
                key={i}
                className="flex flex-col items-center gap-1 flex-1 min-w-0 h-full justify-end group/bar overflow-hidden"
              >
                <div
                  className={`w-full rounded-t-sm transition-all ${
                    h.isPeak
                      ? "bg-stone-900"
                      : "bg-[#ded6ce] group-hover/bar:bg-stone-900"
                  }`}
                  style={{ height: h.height }}
                />
                <span
                  className={`text-[8px] sm:text-[9px] font-sans truncate text-center w-full block ${
                    h.isPeak ? "text-stone-900 font-bold" : "text-stone-400"
                  }`}
                  title={cleanLabel}
                >
                  {cleanLabel}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-xs text-stone-600 pt-2 border-t border-stone-200/50 mt-1 gap-1">
          <span className="text-[11px] truncate">Service Velocity</span>
          <span className="font-semibold text-stone-900 text-xs shrink-0 whitespace-nowrap">
            {maxVal > 0 ? `${maxVal} ${maxVal === 1 ? "tkt" : "tkts"}/peak` : "0 tkts/hr"}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60 mt-1">
        <span className="text-label-sm font-label-sm text-outline">Hourly Pacing</span>
        <span className="flex items-center gap-1 text-on-surface text-label-sm font-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
          <span>Online</span>
        </span>
      </div>
    </div>
  );
}
