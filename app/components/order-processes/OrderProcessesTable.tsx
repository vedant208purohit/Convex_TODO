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
  // If the process has a saved description in the backend, always use it
  if (process.description && process.description.trim()) {
    return process.description.trim();
  }

  // Fallback defaults for standard initial workflow stages without a custom description
  const nameLower = process.name.toLowerCase().trim();
  if (nameLower === "delivered" || (nameLower.includes("deliver") && !nameLower.includes("ready"))) {
    return "Order completed";
  }
  if (nameLower.includes("ready")) return "Ready for handoff";
  if (nameLower.includes("accept")) return "Initial order acceptance";
  if (nameLower.includes("progress") || nameLower.includes("cook") || nameLower.includes("prep"))
    return "Kitchen preparation";
  if (nameLower.includes("check") || nameLower.includes("quality"))
    return "Quality and standard check";
  if (nameLower.includes("pack")) return "Order packaging and labeling";
  return "";
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

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    if (!draggedId) return;

    const sourceIndex = processes.findIndex((p) => p._id === draggedId);
    if (sourceIndex === -1 || sourceIndex === targetIndex) {
      setDraggedId(null);
      return;
    }

    const newPosition = targetIndex + 1;
    await onReorder(draggedId, newPosition);
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverIndex(null);
  };

  return (
    <div className="bg-[#ffffff] rounded-2xl shadow-sm border border-[#e7e5e4] overflow-hidden">
      <table className="w-full text-left border-collapse">
        {/* Table Header */}
        <thead>
          <tr className="bg-[#f7f3f2] text-[12px] font-semibold text-[#4e4543] tracking-[0.96px] uppercase border-b border-[#e7e5e4] font-sans">
            <th scope="col" className="py-4 pl-6 pr-4 font-semibold w-[120px]">
              Position
            </th>
            <th scope="col" className="py-4 px-4 font-semibold">
              Process
            </th>
            <th scope="col" className="py-4 px-4 font-semibold w-[200px]">
              Status
            </th>
            <th scope="col" className="py-4 px-4 font-semibold w-[120px]">
              Color
            </th>
            <th scope="col" className="py-4 pl-4 pr-6 font-semibold text-right w-[100px]">
              Actions
            </th>
          </tr>
        </thead>

        {/* Rows */}
        {processes.length > 0 ? (
          <tbody className="divide-y divide-[#e7e5e4]">
            {processes.map((process, index) => {
              const isDragging = draggedId === process._id;
              const isDragOver = dragOverIndex === index;
              const isToggling = togglingIds.has(process._id);
              const isPublished = process.published ?? true;
              const posFormatted = String(index + 1).padStart(2, "0");
              const descriptionText = getProcessDescription(process);

              return (
                <tr
                  key={process._id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, process._id)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`transition-colors ${
                    isDragging ? "opacity-40 bg-[#f7f3f2]" : "hover:bg-[#f7f3f2]/50"
                  } ${isDragOver ? "border-t-2 border-t-[#141010] bg-[#f7f3f2]" : ""}`}
                >
                  {/* 1. Position with Drag Handle */}
                  <td className="py-4 pl-6 pr-4 align-middle">
                    <div className="flex items-center gap-2 text-[#4e4543]">
                      <span
                        className="cursor-grab active:cursor-grabbing text-[#4e4543] hover:text-[#141010] transition-colors p-0.5"
                        title="Drag to reorder"
                        aria-label={`Drag handle for ${process.name}`}
                      >
                        <svg
                          className="w-[18px] h-[18px]"
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
                      <span className="font-mono text-sm text-[#1c1b1b]">
                        {posFormatted}
                      </span>
                    </div>
                  </td>

                  {/* 2. Process Name & Description */}
                  <td className="py-4 px-4 align-middle">
                    <div className="font-medium text-[#141010] text-[15px] leading-snug font-sans">
                      {process.name}
                    </div>
                    {descriptionText ? (
                      <div className="text-[13px] text-[#4e4543] leading-tight mt-0.5 truncate font-sans">
                        {descriptionText}
                      </div>
                    ) : null}
                  </td>

                  {/* 3. Status Published Toggle */}
                  <td className="py-4 px-4 align-middle">
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isPublished}
                        disabled={isToggling}
                        onChange={() => onTogglePublished(process)}
                        className="sr-only peer"
                        aria-label={`Toggle published status for ${process.name}`}
                      />
                      <div
                        className={`w-9 h-5 rounded-full peer transition-colors duration-200 ease-in-out ${
                          isPublished ? "bg-[#141010]" : "bg-[#ece7e6]"
                        } relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform after:duration-200 ${
                          isPublished ? "after:translate-x-4" : ""
                        } ${isToggling ? "opacity-50 cursor-wait" : ""}`}
                      />
                      <span className="ml-2 text-xs font-medium text-[#141010] whitespace-nowrap font-sans">
                        {isPublished ? "Published ●" : "Unpublished ○"}
                      </span>
                    </label>
                  </td>

                  {/* 4. Color Swatch */}
                  <td className="py-4 px-4 align-middle">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm inline-block align-middle border border-black/10"
                      style={{ backgroundColor: process.processColor || "#262626" }}
                    />
                  </td>

                  {/* 5. Actions */}
                  <td className="py-4 pl-4 pr-6 align-middle text-right">
                    <button
                      type="button"
                      onClick={() => onEdit(process)}
                      className="px-3 py-1.5 rounded-lg border border-[#e7e5e4] text-[#141010] hover:bg-[#ece7e6] text-[13px] font-medium transition-all cursor-pointer inline-flex items-center justify-center active:scale-95 font-sans"
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

      {processes.length === 0 && (
        <div className="px-6 py-12 text-center text-[#4e4543]">
          <p className="text-base font-medium text-[#141010] mb-1 font-sans">
            No order processes found
          </p>
          <p className="text-sm text-[#4e4543] font-sans">
            Click &ldquo;Add order process&rdquo; to create your first workflow stage.
          </p>
        </div>
      )}
    </div>
  );
}
