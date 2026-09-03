"use client";

import React from "react";
import { OrderProcessDoc } from "./types";

interface WorkflowPreviewProps {
  processes: OrderProcessDoc[];
}

function getStageSubtitle(process: OrderProcessDoc): string {
  const nameLower = process.name.toLowerCase().trim();
  if (nameLower.includes("accept")) return "Initial acceptance";
  if (nameLower.includes("progress") || nameLower.includes("cook") || nameLower.includes("prep"))
    return "Kitchen prep";
  if (nameLower.includes("ready") || nameLower.includes("deliver"))
    return "Ready for handoff";
  if (nameLower.includes("deliver") || nameLower.includes("complete") || nameLower.includes("done"))
    return "Order completed";
  if (nameLower.includes("check") || nameLower.includes("quality"))
    return "Quality check";
  if (nameLower.includes("pack")) return "Packaging";
  return "Workflow stage";
}

export function WorkflowPreview({ processes }: WorkflowPreviewProps) {
  // Published sequential stages appear in the live visual chain
  const activeStages = processes.filter(
    (p) => p.published !== false && p.isSequence !== false
  );

  return (
    <div className="bg-[#f7f3f2] rounded-2xl p-6 lg:p-8 mb-8 shadow-sm relative overflow-hidden border border-[#e7e5e4]">
      {/* Background ambient glow matching reference */}
      <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full bg-[#ece7e6]/50 pointer-events-none blur-2xl" />

      {/* Card Header */}
      <div className="flex items-center justify-between mb-5 relative z-10">
        <span className="text-[12px] font-semibold text-[#4e4543] tracking-[0.96px] uppercase font-sans">
          ORDER FLOW — LIVE VISUAL CHAIN
        </span>
        <span className="text-[12px] font-semibold text-[#141010] tracking-[0.96px] uppercase font-sans">
          {activeStages.length} {activeStages.length === 1 ? "active stage" : "active stages"}
        </span>
      </div>

      {/* Chain Container with Horizontal Scroll support */}
      {activeStages.length > 0 ? (
        <div className="overflow-x-auto pb-2 pt-1 relative z-10 scrollbar-thin">
          <div className="flex items-center gap-4 min-w-full">
            {activeStages.map((stage, index) => (
              <React.Fragment key={stage._id}>
                {/* Stage Card */}
                <div className="flex-1 min-w-[200px] bg-[#ffffff] p-4 rounded-xl flex items-center gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-[#e7e5e4] shrink-0">
                  <div
                    className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: stage.processColor || "#262626" }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[#141010] text-[15px] leading-tight truncate">
                      {stage.name}
                    </div>
                    <div className="text-[11px] font-semibold text-[#4e4543] tracking-[0.5px] uppercase mt-0.5 truncate">
                      {getStageSubtitle(stage)}
                    </div>
                  </div>
                </div>

                {/* Arrow Connector between items */}
                {index < activeStages.length - 1 && (
                  <svg
                    className="text-[#7f7572] w-5 h-5 shrink-0 opacity-80"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14" />
                    <path d="M12 5l7 7-7 7" />
                  </svg>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-[#ffffff] p-6 rounded-xl text-center border border-[#e7e5e4] text-[#4e4543] text-sm relative z-10">
          No active stages in workflow.
        </div>
      )}
    </div>
  );
}
