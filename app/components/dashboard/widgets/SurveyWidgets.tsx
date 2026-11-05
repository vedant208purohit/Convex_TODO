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

// 1. Survey Response Count (1x1 Square)
export function SurveyResponseCountWidget({
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

  const summary = (widgetData as any)?.summary || {};
  const totalResponses = summary.totalResponses ?? "0";
  const deltaPercent = summary.deltaPercent ?? "+0.0%";
  const qrReceiptPercent = summary.qrReceiptPercent ?? 0;
  const cfdPercent = summary.cfdPercent ?? 0;

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              KPI
            </span>
            <span className="font-label-sm text-[11px] text-secondary">RESPONSE VOLUME</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Survey Response Count
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-space-xs my-auto min-h-[110px] justify-center">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="font-serif text-3xl font-bold text-on-surface">{totalResponses}</span>
            <span className="text-xs text-secondary font-medium ml-1.5">Responses</span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-full">
            {deltaPercent}
          </span>
        </div>

        <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden flex mt-1">
          {qrReceiptPercent + cfdPercent > 0 ? (
            <>
              <div className="bg-primary h-full transition-all" style={{ width: `${qrReceiptPercent}%` }}></div>
              <div className="bg-secondary h-full opacity-60 transition-all" style={{ width: `${cfdPercent}%` }}></div>
            </>
          ) : (
            <div className="bg-surface-container-high h-full w-full opacity-30"></div>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-secondary pt-0.5">
          <span>QR Receipt: {qrReceiptPercent}%</span>
          <span>CFD Counter: {cfdPercent}%</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Intake Channels</span>
        <span>QR & Terminal</span>
      </div>
    </div>
  );
}

// 2. Average Survey Rating (1x1 Square)
export function SurveyAverageRatingWidget({
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

  const summary = (widgetData as any)?.summary || {};
  const avgScore = summary.avgScore ?? "0.00";
  const positivePercent = summary.positivePercent ?? 0;
  const neutralPercent = summary.neutralPercent ?? 0;
  const negativePercent = summary.negativePercent ?? 0;

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              KPI
            </span>
            <span className="font-label-sm text-[11px] text-secondary">OVERALL CSAT</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Average Survey Rating
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-space-xs my-auto min-h-[110px] justify-center">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-3xl font-bold text-on-surface">{avgScore}</span>
            <span className="text-xs text-secondary font-medium">/ 5.0</span>
          </div>
          <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold text-xs">
            <span className="material-symbols-outlined text-[15px] text-amber-600 fill-1">star</span>
            <span>CSAT Score</span>
          </div>
        </div>

        <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden flex mt-1">
          {positivePercent + neutralPercent + negativePercent > 0 ? (
            <>
              <div className="bg-emerald-600 h-full" style={{ width: `${positivePercent}%` }}></div>
              <div className="bg-amber-500 h-full" style={{ width: `${neutralPercent}%` }}></div>
              <div className="bg-rose-500 h-full" style={{ width: `${negativePercent}%` }}></div>
            </>
          ) : (
            <div className="bg-surface-container-high h-full w-full opacity-30"></div>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-secondary pt-0.5">
          <span className="text-emerald-700 font-medium">Pos: {positivePercent}%</span>
          <span className="text-amber-700 font-medium">Neu: {neutralPercent}%</span>
          <span className="text-rose-700 font-medium">Neg: {negativePercent}%</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Sentiment Spread</span>
        <span>Quality Index</span>
      </div>
    </div>
  );
}

// 3. Recent Feedback (1x1 Square)
export function SurveyRecentFeedbackWidget({
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

  const summary = (widgetData as any)?.summary || {};
  const feedbackItems = summary.feedbackItems || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              TABLE
            </span>
            <span className="font-label-sm text-[11px] text-secondary">LIVE FEEDBACK FEED</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Recent Feedback
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-xs flex flex-col gap-1.5 my-auto min-h-[110px] justify-center">
        {feedbackItems.length === 0 ? (
          <div className="text-center py-4 text-xs text-secondary">
            No customer survey reviews submitted yet
          </div>
        ) : (
          feedbackItems.slice(0, 2).map((item: any, idx: number) => (
            <div
              key={item.id || idx}
              className="bg-surface-container-lowest p-2 rounded-DEFAULT flex flex-col gap-0.5 shadow-2xs"
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 font-semibold text-amber-700">
                  {item.score}
                </span>
                <span className="text-secondary text-[10px]">
                  {item.table} • {item.time}
                </span>
              </div>
              <p className="text-xs text-on-surface line-clamp-1 italic font-serif">
                {item.quote}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Verified Reviews</span>
        <span>Floor Feedback</span>
      </div>
    </div>
  );
}

// 4. Satisfaction Trend (1x1 Square)
export function SurveySatisfactionTrendWidget({
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

  const summary = (widgetData as any)?.summary || {};
  const currentRating = summary.currentRating ?? "--";
  const slaTarget = summary.slaTarget ?? "SLA: 4.5+";

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              CHART
            </span>
            <span className="font-label-sm text-[11px] text-secondary">TEMPORAL CSAT</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Satisfaction Trend
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col justify-between my-auto min-h-[110px]">
        <div className="flex items-center justify-between text-[11px] text-secondary">
          <span>7-Day Rolling Index</span>
          <span className="text-emerald-700 font-semibold">{slaTarget}</span>
        </div>

        <div className="w-full h-12 relative flex items-end my-1">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 200 65">
            <line
              className="text-outline-variant/60"
              stroke="currentColor"
              strokeDasharray="3 3"
              strokeWidth="1"
              x1="0"
              x2="200"
              y1="22"
              y2="22"
            />
            <path
              d="M0,45 C30,42 60,30 90,32 C120,34 150,15 200,10"
              fill="none"
              stroke="currentColor"
              className="text-primary"
              strokeWidth="2.5"
            />
            <circle cx="200" cy="10" r="3.5" className="fill-primary" />
          </svg>
        </div>

        <div className="flex items-center justify-between text-[10px] text-secondary border-t border-outline-variant/15 pt-1">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
          <span className="font-bold text-on-surface">Sun ({currentRating}★)</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Consistency Curve</span>
        <span>Weekly CSAT</span>
      </div>
    </div>
  );
}

// 5. Low-Rating Alerts (1x1 Square)
export function SurveyLowRatingAlertsWidget({
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

  const summary = (widgetData as any)?.summary || {};
  const alerts = summary.alerts || [];
  const topAlert = alerts[0];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-rose-100 text-rose-800 font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              ALERT
            </span>
            <span className="font-label-sm text-[11px] text-secondary">SERVICE ESCALATION</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Low-Rating Alerts
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col justify-center my-auto min-h-[110px]">
        {alerts.length === 0 ? (
          <div className="bg-emerald-50 border border-emerald-200/60 p-2.5 rounded-DEFAULT flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-700 text-lg">verified</span>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-emerald-900">Guest Sentiment Positive</span>
              <span className="text-[10px] text-emerald-700">No critical ≤ 2★ reviews logged</span>
            </div>
          </div>
        ) : (
          <div className="bg-rose-50 border border-rose-200/80 p-2.5 rounded-DEFAULT flex flex-col gap-1 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs text-rose-800 flex items-center gap-1 font-semibold">
                <span className="material-symbols-outlined text-[15px]">warning</span>
                {topAlert?.stars || "2★ Review: Table T-07"}
              </span>
              <span className="text-[10px] text-secondary">{topAlert?.bill || "Bill #8074"}</span>
            </div>
            <p className="text-xs text-on-surface font-medium italic line-clamp-1 font-serif">
              {topAlert?.quote || "“Food arrived lukewarm after 35 mins wait.”"}
            </p>
            <div className="flex items-center justify-between pt-1 border-t border-rose-200/40 text-[10px]">
              <span className="px-1.5 py-0.2 bg-rose-200/70 text-rose-900 rounded font-semibold">
                Callback Requested
              </span>
              <span className="text-secondary">{topAlert?.staff || "Guest Feedback"}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Escalation Protocol</span>
        <span>{alerts.length} Flagged</span>
      </div>
    </div>
  );
}

// 6. Survey Response Rate (1x1 Square)
export function SurveyResponseRateWidget({
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

  const summary = (widgetData as any)?.summary || {};
  const conversionPercent = summary.conversionPercent ?? "0%";
  const benchmark = summary.benchmark ?? "Industry benchmark: 15–20%";
  const status = summary.status ?? "Active Trend • Above Benchmark";

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              KPI
            </span>
            <span className="font-label-sm text-[11px] text-secondary">CONVERSION RATIO</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Survey Response Rate
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-space-xs my-auto min-h-[110px] justify-center">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-3xl font-bold text-on-surface">{conversionPercent}</span>
            <span className="text-xs text-secondary font-medium">Conversion</span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-full">
            Active Trend
          </span>
        </div>

        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-DEFAULT bg-surface-container-highest text-[11px]">
          <span className="text-secondary">{benchmark}</span>
          <span className="font-semibold text-emerald-700">Optimal</span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-secondary pt-0.5">
          <span>{status}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Guest Engagement</span>
        <span>Response Pacing</span>
      </div>
    </div>
  );
}

