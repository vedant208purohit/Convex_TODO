"use client";

import React, { useState } from "react";
import { OrderProcessDoc, OrderProcessId } from "./types";

interface OrderProcessesTableProps {
  processes: OrderProcessDoc[];
  onEdit: (process: OrderProcessDoc) => void;
  onTogglePublished: (process: OrderProcessDoc) => Promise<void>;
  onReorder: (id: OrderProcessId, newPosition: number) => Promise<void>;
  togglingIds: Set<string>;
}

function getProcessDescription(process: OrderProcessDoc): string {
  if (process.description && process.description.trim()) {
    return process.description.trim();
  }
  const nameLower = process.name.toLowerCase().trim();
  if (nameLower.includes("accept")) return "The order has been received and accepted.";
  if (nameLower.includes("progress") || nameLower.includes("cook") || nameLower.includes("prep"))
    return "The kitchen is currently preparing the order.";
  if (nameLower.includes("ready") || nameLower.includes("deliver"))
    return "The order is ready to be served or handed over.";
  if (nameLower.includes("deliver") || nameLower.includes("complete") || nameLower.includes("done"))
    return "The order has been completed.";
  if (nameLower.includes("check") || nameLower.includes("quality"))
    return "Quality and standard check";
  if (nameLower.includes("pack")) return "Order packaging and labeling";
  return "Custom order status";
}

export function OrderProcessesTable({
  processes,
  onEdit,
  onTogglePublished,
  onReorder,
  togglingIds,
}: OrderProcessesTableProps) {
  const [draggedId, setDraggedId] = useState<OrderProcessId | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, id: OrderProcessId) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
    if (!draggedId) return;

    const sourceIndex = processes.findIndex((p) => p._id === draggedId);
    if (sourceIndex === -1 || sourceIndex === targetIndex) {
      setDraggedId(null);
      return;
    }

    const targetPosition = targetIndex + 1;
    const currentDraggedId = draggedId;
    setDraggedId(null);
    await onReorder(currentDraggedId, targetPosition);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverIndex(null);
  };

  return (
    <div className="bg-[#ffffff] rounded-2xl shadow-sm border border-[#e7e5e4] overflow-hidden">
      {/* Horizontal Scroll Bar Container Matching Order Flow */}
      <div className="overflow-x-auto pb-2 pt-1 relative z-10 scrollbar-thin">
        <table className="w-full min-w-[680px] text-left border-collapse">
          {/* Table Header */}
          <thead>
            <tr className="bg-[#f7f3f2] text-[11px] font-semibold text-[#5e5e5e] tracking-[0.96px] uppercase border-b border-[#e7e5e4] font-sans">
              <th scope="col" className="py-3.5 pl-6 pr-4 font-semibold w-[120px] whitespace-nowrap">
                Step
              </th>
              <th scope="col" className="py-3.5 px-4 font-semibold whitespace-nowrap">
                Order Status
              </th>
              <th scope="col" className="py-3.5 px-4 font-semibold w-[180px] whitespace-nowrap">
                Active
              </th>
              <th scope="col" className="py-3.5 px-4 font-semibold w-[100px] whitespace-nowrap">
                Color
              </th>
              <th scope="col" className="py-3.5 pl-4 pr-6 font-semibold text-right w-[100px] whitespace-nowrap">
                Action
              </th>
            </tr>
          </thead>

          {/* Rows */}
          {processes.length > 0 ? (
            <tbody className="divide-y divide-[#e7e5e4]">
              {processes.map((process, index) => {
                const isDragging = draggedId === process._id;
                const isDragOver = dragOverIndex === index && draggedId !== process._id;
                const isToggling = togglingIds.has(process._id);
                const isPublished = process.published ?? true;
                const stepLabel = `Step ${index + 1}`;

                return (
                  <tr
                    key={process._id}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, process._id)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`transition-colors select-none ${
                      isDragging ? "opacity-30 bg-[#f7f3f2]" : "hover:bg-[#f7f3f2]/50"
                    } ${isDragOver ? "border-t-2 border-t-[#141010] bg-[#f7f3f2]" : ""}`}
                  >
                    {/* 1. Step with Drag Handle */}
                    <td className="py-3.5 pl-6 pr-4 align-middle whitespace-nowrap">
                      <div className="flex items-center gap-2.5 text-[#5e5e5e]">
                        <span
                          className="cursor-grab active:cursor-grabbing text-[#78716c] hover:text-[#141010] hover:bg-[#ece7e6] p-1 rounded transition-colors"
                          title="Drag to reorder step"
                          aria-label={`Drag handle for ${process.name} - ${stepLabel}`}
                        >
                          <svg
                            className="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <circle cx="9" cy="6" r="1.5" />
                            <circle cx="15" cy="6" r="1.5" />
                            <circle cx="9" cy="12" r="1.5" />
                            <circle cx="15" cy="12" r="1.5" />
                            <circle cx="9" cy="18" r="1.5" />
                            <circle cx="15" cy="18" r="1.5" />
                          </svg>
                        </span>

                        <span className="font-sans text-xs font-semibold text-[#1c1b1b] whitespace-nowrap">
                          {stepLabel}
                        </span>
                      </div>
                    </td>

                    {/* 2. Order Status Name & Description */}
                    <td className="py-4 px-4 align-middle">
                      <div className="font-medium text-[#141010] text-sm leading-snug font-sans">
                        {process.name}
                      </div>
                      <div className="text-xs text-[#5e5e5e] leading-tight mt-0.5 truncate font-sans">
                        {getProcessDescription(process)}
                      </div>
                    </td>

                    {/* 3. Active / Inactive Toggle */}
                    <td
                      className="py-4 px-4 align-middle whitespace-nowrap"
                      draggable={false}
                      onDragStart={(e) => e.stopPropagation()}
                    >
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isPublished}
                          disabled={isToggling}
                          onChange={() => onTogglePublished(process)}
                          className="sr-only peer"
                          aria-label={`Toggle active status for ${process.name}`}
                        />
                        <div
                          className={`w-9 h-5 rounded-full peer transition-colors duration-200 ease-in-out ${
                            isPublished ? "bg-[#141010]" : "bg-[#ece7e6]"
                          } relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform after:duration-200 ${
                            isPublished ? "after:translate-x-4" : ""
                          } ${isToggling ? "opacity-50 cursor-wait" : ""}`}
                        />
                        <span className="ml-2.5 text-xs font-medium text-[#141010] whitespace-nowrap font-sans">
                          {isPublished ? "Active ●" : "Inactive ○"}
                        </span>
                      </label>
                    </td>

                    {/* 4. Color Swatch */}
                    <td className="py-4 px-4 align-middle whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm inline-block"
                          style={{ backgroundColor: process.processColor || "#262626" }}
                        />
                        <span className="font-mono text-xs text-[#5e5e5e] uppercase">
                          {process.processColor || "#262626"}
                        </span>
                      </div>
                    </td>

                    {/* 5. Actions */}
                    <td
                      className="py-4 pl-4 pr-6 align-middle text-right whitespace-nowrap"
                      draggable={false}
                      onDragStart={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onEdit(process)}
                        className="px-3 py-1.5 rounded-lg border border-[#e7e5e4] text-[#141010] hover:bg-[#ece7e6] text-xs font-semibold transition-all cursor-pointer inline-flex items-center justify-center active:scale-95 font-sans"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ) : null}
        </table>
      </div>

      {processes.length === 0 && (
        <div className="px-6 py-12 text-center text-[#5e5e5e]">
          <p className="text-sm font-medium text-[#141010] mb-1 font-sans">
            No order statuses found
          </p>
          <p className="text-xs text-[#5e5e5e] font-sans">
            Click &ldquo;Add Order Status&rdquo; to create your first order step.
          </p>
        </div>
      )}
    </div>
  );
}
