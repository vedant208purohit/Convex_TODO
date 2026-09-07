"use client";

import React from "react";
import { OrderProcessDoc } from "./types";

interface WorkflowPreviewProps {
  processes: OrderProcessDoc[];
}

interface MainStageTemplate {
  key: string;
  name: string;
  subtitle: string;
  defaultColor: string;
  matches: (proc: OrderProcessDoc) => boolean;
}

const MAIN_STAGE_TEMPLATES: MainStageTemplate[] = [
  {
    key: "accepted",
    name: "Accepted",
    subtitle: "Initial acceptance",
    defaultColor: "#141010",
    matches: (p) => {
      const n = p.name.trim().toLowerCase();
      return n === "accepted" || n.startsWith("accept");
    },
  },
  {
    key: "in_progress",
    name: "In progress",
    subtitle: "Kitchen prep",
    defaultColor: "#f59e0b",
    matches: (p) => {
      const n = p.name.trim().toLowerCase();
      return (
        n === "in progress" ||
        n.includes("progress") ||
        n.includes("kitchen") ||
        n.includes("prep")
      );
    },
  },
  {
    key: "ready_to_deliver",
    name: "Ready to deliver",
    subtitle: "Ready for handoff",
    defaultColor: "#f97316",
    matches: (p) => {
      const n = p.name.trim().toLowerCase();
      return (
        n === "ready to deliver" ||
        (n.includes("ready") && !n.includes("deliver"))
      );
    },
  },
  {
    key: "delivered",
    name: "Delivered",
    subtitle: "Order completed",
    defaultColor: "#22c55e",
    matches: (p) => {
      const n = p.name.trim().toLowerCase();
      return (
        n === "delivered" ||
        (n.includes("deliver") && !n.includes("ready")) ||
        n.includes("complete") ||
        n.includes("done")
      );
    },
  },
];

export function WorkflowPreview({ processes }: WorkflowPreviewProps) {
  // Show only the 4 main/default processes in this specific order
  const visualStages = MAIN_STAGE_TEMPLATES.map((template) => {
    const matched = processes.find((p) => template.matches(p));
    return {
      id: matched?._id || template.key,
      name: matched?.name || template.name,
      subtitle: template.subtitle,
      color: matched?.processColor || template.defaultColor,
      isActive: matched
        ? matched.published !== false && matched.isSequence !== false
        : true,
    };
  });

  const activeStages = visualStages.filter((stage) => stage.isActive);

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
          {activeStages.length} {activeStages.length === 1 ? "ACTIVE STAGE" : "ACTIVE STAGES"}
        </span>
      </div>

      {/* Chain Container with Horizontal Scroll support */}
      {activeStages.length > 0 ? (
        <div className="overflow-x-auto pb-2 pt-1 relative z-10 scrollbar-thin">
          <div className="flex items-center gap-4 min-w-full">
            {activeStages.map((stage, index) => (
              <React.Fragment key={stage.id}>
                {/* Stage Card */}
                <div className="flex-1 min-w-[200px] bg-[#ffffff] p-4 rounded-xl flex items-center gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-[#e7e5e4] shrink-0">
                  <div
                    className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: stage.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[#141010] text-[15px] leading-tight truncate">
                      {stage.name}
                    </div>
                    <div className="text-[11px] font-semibold text-[#4e4543] tracking-[0.5px] uppercase mt-0.5 truncate font-sans">
                      {stage.subtitle}
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

