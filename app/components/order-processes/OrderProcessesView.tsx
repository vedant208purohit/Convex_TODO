"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  DrawerState,
  OrderProcessDoc,
  OrderProcessFormData,
  OrderProcessId,
  REFERENCE_ORDER_PROCESSES,
} from "./types";
import { OrderProcessesHeader } from "./OrderProcessesHeader";
import { WorkflowPreview } from "./WorkflowPreview";
import { OrderProcessesTable } from "./OrderProcessesTable";
import { OrderProcessDrawer } from "./OrderProcessDrawer";

export function OrderProcessesView() {
  const convexProcesses = useQuery(api.organizationOrderProcesses.list, {});
  const createProcess = useMutation(api.organizationOrderProcesses.create);
  const updateProcess = useMutation(api.organizationOrderProcesses.update);
  const reorderProcess = useMutation(api.organizationOrderProcesses.reorder);

  // Unified list of order processes (contains reference + any new/updated processes)
  const [unifiedProcesses, setUnifiedProcesses] = useState<OrderProcessDoc[]>(
    REFERENCE_ORDER_PROCESSES
  );

  // Synchronize Convex changes into the unified processes list
  useEffect(() => {
    if (!convexProcesses || convexProcesses.length === 0) return;

    setUnifiedProcesses((prev) => {
      const result = [...prev];

      convexProcesses.forEach((c) => {
        const existingIdx = result.findIndex(
          (p) =>
            p._id === c._id ||
            p.name.toLowerCase().trim() === c.name.toLowerCase().trim()
        );

        if (existingIdx !== -1) {
          result[existingIdx] = c;
        } else {
          result.push(c);
        }
      });

      return result.map((proc, idx) => ({
        ...proc,
        position: idx + 1,
      }));
    });
  }, [convexProcesses]);

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
        const targetId = formData.id;
        const isRealId = !targetId.startsWith("ref_");

        // Optimistically update unified list
        setUnifiedProcesses((prev) =>
          prev.map((p) =>
            p._id === targetId
              ? {
                  ...p,
                  name: formData.name,
                  processColor: formData.processColor,
                  published: formData.published,
                  updatedAt: Date.now(),
                }
              : p
          )
        );

        if (isRealId) {
          await updateProcess({
            id: targetId,
            name: formData.name,
            processColor: formData.processColor,
            published: formData.published,
            isSequence: formData.isSequence ?? true,
          });
        } else {
          try {
            await createProcess({
              name: formData.name,
              processColor: formData.processColor,
              published: formData.published,
              isSequence: formData.isSequence ?? true,
            });
          } catch {
            // Maintained in unified state
          }
        }
        showFeedback("success", `Process "${formData.name}" updated successfully.`);
      } else {
        // Create genuinely new process (appended to the workflow)
        const newProcId = `proc_${Date.now()}` as OrderProcessId;
        const newProc: OrderProcessDoc = {
          _id: newProcId,
          _creationTime: Date.now(),
          name: formData.name,
          position: unifiedProcesses.length + 1,
          published: formData.published,
          isSequence: formData.isSequence ?? true,
          processColor: formData.processColor,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        setUnifiedProcesses((prev) => [...prev, newProc]);

        try {
          await createProcess({
            name: formData.name,
            processColor: formData.processColor,
            published: formData.published,
            isSequence: formData.isSequence ?? true,
          });
        } catch {
          // Maintained in unified list
        }
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

    // Optimistically update unified list
    setUnifiedProcesses((prev) =>
      prev.map((p) => (p._id === id ? { ...p, published: nextPublished } : p))
    );

    try {
      const isRealId = !id.startsWith("ref_");
      if (isRealId) {
        await updateProcess({
          id,
          published: nextPublished,
        });
      } else {
        try {
          await createProcess({
            name: process.name,
            processColor: process.processColor || "#262626",
            published: nextPublished,
            isSequence: true,
          });
        } catch {
          // Maintained in unified state
        }
      }
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

  // Drag and drop reordering handler across all processes
  const handleReorder = async (id: OrderProcessId, newPosition: number) => {
    setUnifiedProcesses((prev) => {
      const list = [...prev];
      const srcIdx = list.findIndex((p) => p._id === id);
      if (srcIdx === -1) return prev;
      const [moved] = list.splice(srcIdx, 1);
      const targetIdx = Math.max(0, Math.min(newPosition - 1, list.length));
      list.splice(targetIdx, 0, moved);
      return list.map((p, idx) => ({ ...p, position: idx + 1 }));
    });

    try {
      const isRealId = !id.startsWith("ref_");
      if (isRealId) {
        await reorderProcess({
          id,
          position: newPosition,
        });
      }
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
    <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-[#fdf8f7] flex flex-col w-full pb-24">
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

      {/* 1. Page Header */}
      <OrderProcessesHeader
        processCount={unifiedProcesses.length}
        onAddProcess={handleOpenCreate}
      />

      {/* 2. Live Order Flow Preview (with horizontal scroll bar when > 4) */}
      <WorkflowPreview processes={unifiedProcesses} />

      {/* 3. Main Process List / Table (circular dot color without hex) */}
      <OrderProcessesTable
        processes={unifiedProcesses}
        onEdit={handleOpenEdit}
        onTogglePublished={handleTogglePublished}
        onReorder={handleReorder}
        togglingIds={togglingIds}
      />

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
