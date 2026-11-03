"use client";

import React from "react";
import { OrdersCatalogWidget } from "../AddWidgetDrawer";

export interface DrawerCardProps {
  widget: OrdersCatalogWidget;
  isPlaced: boolean;
  placement?: { gridRow: number; gridCol: number };
  onAdd: () => void;
  data?: any;
}

export const SURVEY_CATALOG_WIDGETS: OrdersCatalogWidget[] = [
  {
    id: "surveys_response_counts",
    categoryTrack: "Response Volume",
    title: "Survey Response Count",
    type: "KPI",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Total completed guest feedback submissions and rating attempts in the active period.",
    defaultWidth: 4,
  },
  {
    id: "surveys_average_rating",
    categoryTrack: "Overall CSAT",
    title: "Average Survey Rating",
    type: "KPI",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Average star and numeric rating across food quality, service pacing, and ambiance.",
    defaultWidth: 4,
  },
  {
    id: "surveys_recent_feedback",
    categoryTrack: "Live Feedback Feed",
    title: "Recent Feedback",
    type: "TABLE",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Chronological stream of guest reviews, direct compliments, and specific server mentions.",
    defaultWidth: 4,
  },
  {
    id: "surveys_satisfaction_trends",
    categoryTrack: "Temporal CSAT",
    title: "Satisfaction Trend",
    type: "CHART",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Weekly and monthly rolling CSAT index trend tracking kitchen and floor service consistency.",
    defaultWidth: 4,
  },
  {
    id: "surveys_low_rating_alerts",
    categoryTrack: "Service Escalation",
    title: "Low-Rating Alerts",
    type: "ALERT",
    typeBadgeBg: "bg-rose-100 text-rose-800",
    description: "Real-time alert list of responses with rating ≤ 2 stars requiring manager intervention.",
    defaultWidth: 4,
  },
  {
    id: "surveys_response_rates",
    categoryTrack: "Conversion Ratio",
    title: "Survey Response Rate",
    type: "KPI",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Percentage of dining guests completing feedback survey against total bills printed.",
    defaultWidth: 4,
  },
];

// 1. Survey Response Count
export function DrawerSurveyResponseCountCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const summary = data?.summary || {};
  const totalResponses = summary.totalResponses ?? "0";
  const deltaPercent = summary.deltaPercent ?? "▲ +18.2%";
  const qrReceiptPercent = summary.qrReceiptPercent ?? 68;
  const cfdPercent = summary.cfdPercent ?? 32;

  return (
    <article className="bg-white rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1]">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">{widget.title}</h3>
          </div>
          <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}>
            {widget.type}
          </span>
        </div>
        <p className="text-xs text-stone-500 min-h-[32px]">{widget.description}</p>

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1.5 border border-[#f3ede6] min-h-[95px] justify-center text-xs">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="font-serif text-2xl font-bold text-stone-900">{totalResponses}</span>
              <span className="text-stone-500 text-xs">Responses</span>
            </div>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
              {deltaPercent}
            </span>
          </div>
          <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden flex">
            <div className="bg-black h-full" style={{ width: `${qrReceiptPercent}%` }}></div>
            <div className="bg-stone-400 h-full" style={{ width: `${cfdPercent}%` }}></div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-stone-500 pt-0.5">
            <span>QR Receipt: {qrReceiptPercent}%</span>
            <span>CFD Counter: {cfdPercent}%</span>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-[#f0eae3] flex items-center justify-between mt-3">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {isPlaced && placement ? `SLOT: ROW ${placement.gridRow} COL ${placement.gridCol}` : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all">
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// 2. Average Survey Rating
export function DrawerSurveyAverageRatingCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const summary = data?.summary || {};
  const avgScore = summary.avgScore ?? "0.00";
  const positivePercent = summary.positivePercent ?? 92;
  const neutralPercent = summary.neutralPercent ?? 6;
  const negativePercent = summary.negativePercent ?? 2;

  return (
    <article className="bg-white rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1]">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">{widget.title}</h3>
          </div>
          <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}>
            {widget.type}
          </span>
        </div>
        <p className="text-xs text-stone-500 min-h-[32px]">{widget.description}</p>

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1.5 border border-[#f3ede6] min-h-[95px] justify-center text-xs">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="font-serif text-2xl font-bold text-stone-900">{avgScore}</span>
              <span className="text-stone-500 text-xs">/ 5.0</span>
            </div>
            <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold text-[10px]">
              <span className="material-symbols-outlined text-[13px] text-amber-600 fill-1">star</span>
              <span>CSAT</span>
            </div>
          </div>
          <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden flex">
            <div className="bg-emerald-600 h-full" style={{ width: `${positivePercent}%` }}></div>
            <div className="bg-amber-500 h-full" style={{ width: `${neutralPercent}%` }}></div>
            <div className="bg-rose-500 h-full" style={{ width: `${negativePercent}%` }}></div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-stone-500 pt-0.5">
            <span className="text-emerald-700 font-medium">Pos: {positivePercent}%</span>
            <span className="text-amber-700 font-medium">Neu: {neutralPercent}%</span>
            <span className="text-rose-700 font-medium">Neg: {negativePercent}%</span>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-[#f0eae3] flex items-center justify-between mt-3">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {isPlaced && placement ? `SLOT: ROW ${placement.gridRow} COL ${placement.gridCol}` : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all">
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// 3. Recent Feedback
export function DrawerSurveyRecentFeedbackCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const summary = data?.summary || {};
  const feedbackItems = summary.feedbackItems || [];

  return (
    <article className="bg-white rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1]">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">{widget.title}</h3>
          </div>
          <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}>
            {widget.type}
          </span>
        </div>
        <p className="text-xs text-stone-500 min-h-[32px]">{widget.description}</p>

        <div className="bg-[#fcf8f5] rounded-lg p-2 flex flex-col gap-1 border border-[#f3ede6] min-h-[95px] justify-center text-xs">
          {feedbackItems.length === 0 ? (
            <div className="text-center py-2 text-xs text-stone-400">No recent customer reviews</div>
          ) : (
            feedbackItems.slice(0, 2).map((item: any, idx: number) => (
              <div key={idx} className="p-1 rounded bg-white border border-[#f0eae3] flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-amber-700">{item.score}</span>
                  <span className="text-stone-400">{item.table} • {item.time}</span>
                </div>
                <p className="text-[10.5px] text-stone-800 line-clamp-1 italic font-serif">{item.quote}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-[#f0eae3] flex items-center justify-between mt-3">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {isPlaced && placement ? `SLOT: ROW ${placement.gridRow} COL ${placement.gridCol}` : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all">
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// 4. Satisfaction Trend
export function DrawerSurveySatisfactionTrendCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const summary = data?.summary || {};
  const currentRating = summary.currentRating ?? "4.8";
  const slaTarget = summary.slaTarget ?? "SLA: 4.5+";

  return (
    <article className="bg-white rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1]">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">{widget.title}</h3>
          </div>
          <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}>
            {widget.type}
          </span>
        </div>
        <p className="text-xs text-stone-500 min-h-[32px]">{widget.description}</p>

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col justify-between border border-[#f3ede6] min-h-[95px] text-xs">
          <div className="flex items-center justify-between text-[10px] text-stone-500">
            <span>7-Day Rolling Index</span>
            <span className="text-emerald-700 font-bold">{slaTarget}</span>
          </div>
          <div className="w-full h-7 relative flex items-end my-1">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 200 50">
              <line className="text-stone-300" stroke="currentColor" strokeDasharray="2 2" strokeWidth="1" x1="0" x2="200" y1="18" y2="18" />
              <path d="M0,35 C40,32 80,24 120,25 C160,26 180,12 200,8" fill="none" stroke="currentColor" className="text-stone-900" strokeWidth="2" />
            </svg>
          </div>
          <div className="flex items-center justify-between text-[9px] text-stone-400 border-t border-[#f0eae3] pt-0.5">
            <span>Mon</span>
            <span>Wed</span>
            <span>Fri</span>
            <span className="font-bold text-stone-900">Sun ({currentRating}★)</span>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-[#f0eae3] flex items-center justify-between mt-3">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {isPlaced && placement ? `SLOT: ROW ${placement.gridRow} COL ${placement.gridCol}` : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all">
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// 5. Low-Rating Alerts
export function DrawerSurveyLowRatingAlertsCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const summary = data?.summary || {};
  const alerts = summary.alerts || [];
  const topAlert = alerts[0];

  return (
    <article className="bg-white rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1]">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">{widget.title}</h3>
          </div>
          <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}>
            {widget.type}
          </span>
        </div>
        <p className="text-xs text-stone-500 min-h-[32px]">{widget.description}</p>

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col justify-center border border-[#f3ede6] min-h-[95px] text-xs">
          {alerts.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-200/60 p-2 rounded flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-700 text-base">verified</span>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-emerald-900">Sentiment Positive</span>
                <span className="text-[9.5px] text-emerald-700">No critical ≤ 2★ reviews</span>
              </div>
            </div>
          ) : (
            <div className="bg-rose-50 border border-rose-200/80 p-2 rounded flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] text-rose-800 flex items-center gap-1 font-bold">
                  <span className="material-symbols-outlined text-[13px]">warning</span>
                  {topAlert?.stars || "2★ Review"}
                </span>
                <span className="text-[9.5px] text-stone-500">{topAlert?.bill || "Bill #8074"}</span>
              </div>
              <p className="text-[10px] text-stone-800 italic line-clamp-1">{topAlert?.quote || "“Food arrived lukewarm”"}</p>
              <div className="flex items-center justify-between pt-0.5 border-t border-rose-200/40 text-[9px]">
                <span className="px-1 py-0.2 bg-rose-200 text-rose-900 rounded font-semibold">Callback Requested</span>
                <span className="text-stone-500">{topAlert?.staff || "Assigned: Amina K."}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-[#f0eae3] flex items-center justify-between mt-3">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {isPlaced && placement ? `SLOT: ROW ${placement.gridRow} COL ${placement.gridCol}` : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all">
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// 6. Survey Response Rate
export function DrawerSurveyResponseRateCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const summary = data?.summary || {};
  const conversionPercent = summary.conversionPercent ?? "0%";
  const benchmark = summary.benchmark ?? "Industry benchmark: 15–20%";

  return (
    <article className="bg-white rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1]">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">{widget.title}</h3>
          </div>
          <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}>
            {widget.type}
          </span>
        </div>
        <p className="text-xs text-stone-500 min-h-[32px]">{widget.description}</p>

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1 border border-[#f3ede6] min-h-[95px] justify-center text-xs">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="font-serif text-2xl font-bold text-stone-900">{conversionPercent}</span>
              <span className="text-stone-500 text-xs">Rate</span>
            </div>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
              Active Trend
            </span>
          </div>
          <div className="flex items-center justify-between px-2 py-1 rounded bg-stone-100 text-[10.5px]">
            <span className="text-stone-600 truncate">{benchmark}</span>
            <span className="font-bold text-emerald-700 shrink-0">Optimal</span>
          </div>
          <div className="text-[10px] text-stone-400 pt-0.5">High Guest Engagement</div>
        </div>
      </div>

      <div className="pt-3 border-t border-[#f0eae3] flex items-center justify-between mt-3">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {isPlaced && placement ? `SLOT: ROW ${placement.gridRow} COL ${placement.gridCol}` : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all">
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

export function renderSurveyDrawerCard(props: DrawerCardProps) {
  switch (props.widget.id) {
    case "surveys_response_count":
    case "surveys_response_counts":
      return <DrawerSurveyResponseCountCard key={props.widget.id} {...props} />;
    case "surveys_average_rating":
      return <DrawerSurveyAverageRatingCard key={props.widget.id} {...props} />;
    case "surveys_recent_feedback":
      return <DrawerSurveyRecentFeedbackCard key={props.widget.id} {...props} />;
    case "surveys_satisfaction_trend":
    case "surveys_satisfaction_trends":
      return <DrawerSurveySatisfactionTrendCard key={props.widget.id} {...props} />;
    case "surveys_low_rating_alerts":
      return <DrawerSurveyLowRatingAlertsCard key={props.widget.id} {...props} />;
    case "surveys_response_rate":
    case "surveys_response_rates":
      return <DrawerSurveyResponseRateCard key={props.widget.id} {...props} />;
    default:
      return null;
  }
}

