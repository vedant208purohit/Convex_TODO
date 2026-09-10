"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  DrawerState,
  OrderProcessDoc,
  OrderProcessFormData,
  OrderProcessId,
} from "./types";
import { OrderProcessesHeader } from "./OrderProcessesHeader";
import { WorkflowPreview } from "./WorkflowPreview";
import { OrderProcessesTable } from "./OrderProcessesTable";
import { OrderProcessDrawer } from "./OrderProcessDrawer";

export function OrderProcessesView() {
  // Live Convex Query
  const convexProcesses = useQuery(api.organizationOrderProcesses.list, {});
  const createProcess = useMutation(api.organizationOrderProcesses.create);
  const updateProcess = useMutation(api.organizationOrderProcesses.update);
  const reorderProcess = useMutation(api.organizationOrderProcesses.reorder);

  // Pure Convex-driven data
  const processes = convexProcesses ?? [];
  const isLoading = convexProcesses === undefined;

  // Drawer State
  const [drawerState, setDrawerState] = useState<DrawerState>({
    isOpen: false,
    mode: "create",
    process: null,
  });

  // Action / Feedback States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  const handleOpenCreate = () => {
    setDrawerState({
      isOpen: true,
      mode: "create",
      process: null,
    });
  };

  const handleOpenEdit = (process: OrderProcessDoc) => {
    setDrawerState({
      isOpen: true,
      mode: "edit",
      process,
    });
  };

  const handleCloseDrawer = () => {
    setDrawerState((prev) => ({ ...prev, isOpen: false }));
  };

  // Form Submit Handler (Create & Edit)
  const handleFormSubmit = async (formData: OrderProcessFormData) => {
    setIsSubmitting(true);
    try {
      if (drawerState.mode === "edit" && formData.id) {
        await updateProcess({
          id: formData.id,
          name: formData.name,
          description: formData.description,
          processColor: formData.processColor,
          published: formData.published,
          isSequence: formData.isSequence ?? true,
        });
        showFeedback("success", `Process "${formData.name}" updated successfully.`);
      } else {
        await createProcess({
          name: formData.name,
          description: formData.description,
          processColor: formData.processColor,
          published: formData.published,
          isSequence: formData.isSequence ?? true,
        });
        showFeedback("success", `Process "${formData.name}" created successfully.`);
      }
      handleCloseDrawer();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message.replace("Uncaught Error: ", "")
          : "An unexpected error occurred.";
      showFeedback("error", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Published Toggle Handler
  const handleTogglePublished = async (process: OrderProcessDoc) => {
    const id = process._id;
    if (togglingIds.has(id)) return;

    setTogglingIds((prev) => new Set(prev).add(id));
    const nextPublished = !(process.published ?? true);

    try {
      await updateProcess({
        id,
        published: nextPublished,
      });
      showFeedback(
        "success",
        `"${process.name}" is now ${nextPublished ? "published" : "unpublished"}.`
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message.replace("Uncaught Error: ", "")
          : "Failed to update status.";
      showFeedback("error", msg);
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Drag and drop reordering handler
  const handleReorder = async (id: OrderProcessId, newPosition: number) => {
    try {
      await reorderProcess({
        id,
        position: newPosition,
      });
      showFeedback("success", "Workflow order updated.");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message.replace("Uncaught Error: ", "")
          : "Failed to reorder process.";
      showFeedback("error", msg);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden w-full bg-[#fdf8f7]">
      {/* Feedback Toast Banner */}
      {feedback && (
        <div
          role="status"
          className={`fixed top-20 right-8 z-50 px-5 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all animate-in fade-in slide-in-from-top-2 duration-200 flex items-center gap-3 ${
            feedback.type === "success"
              ? "bg-[#141010] text-[#ffffff] border-[#292524]"
              : "bg-[#ba1a1a] text-[#ffffff] border-[#93000a]"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-white/80 hover:text-white cursor-pointer"
            aria-label="Dismiss feedback"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Fixed / Sticky Page Header */}
      <div className="shrink-0 space-y-4 bg-[#fdf8f7] pb-3 border-b border-[#e7e5e4]">
        <OrderProcessesHeader
          processCount={processes.length}
          onAddProcess={handleOpenCreate}
        />
      </div>

      {/* 2. Scrollable Middle Content Area */}
      <div className="flex-1 overflow-y-auto pt-6 space-y-8 pr-1 pb-16">
        {/* Live Order Flow Preview */}
        <WorkflowPreview processes={processes} />

        {/* Main Process List / Table */}
        {isLoading ? (
          <div className="bg-[#ffffff] rounded-2xl shadow-sm border border-[#e7e5e4] p-12 text-center text-[#4e4543] animate-pulse">
            <div className="inline-block w-6 h-6 border-2 border-[#141010] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-medium">Loading order processes...</p>
          </div>
        ) : (
          <OrderProcessesTable
            processes={processes}
            onEdit={handleOpenEdit}
            onTogglePublished={handleTogglePublished}
            onReorder={handleReorder}
            togglingIds={togglingIds}
          />
        )}
      </div>

      {/* 4. Create / Edit Drawer */}
      <OrderProcessDrawer
        drawerState={drawerState}
        onClose={handleCloseDrawer}
        onSubmit={handleFormSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
