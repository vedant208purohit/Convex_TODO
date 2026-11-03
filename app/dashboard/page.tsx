"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { PosShell } from "../components/PosShell";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { DashboardControlBar } from "../components/dashboard/DashboardControlBar";
import { DashboardSubBar } from "../components/dashboard/DashboardSubBar";
import { DashboardWidgetCard, DashboardPlacementItem } from "../components/dashboard/DashboardWidgetCard";
import { DashboardAddSlot } from "../components/dashboard/DashboardAddSlot";
import { DashboardPresetTray } from "../components/dashboard/DashboardPresetTray";
import { AddWidgetDrawer } from "../components/dashboard/AddWidgetDrawer";

const DEFAULT_STAGING_PLACEMENTS: DashboardPlacementItem[] = [
  {
    widgetId: "overview_sales_trends",
    gridRow: 0,
    gridCol: 0,
    width: 8,
    height: 2,
    displayOrder: 1,
    isEnabled: true,
  },
  {
    widgetId: "orders_dinein_occupancy",
    gridRow: 0,
    gridCol: 8,
    width: 4,
    height: 1,
    displayOrder: 2,
    isEnabled: true,
  },
  {
    widgetId: "iot_beverage_pour_rate",
    gridRow: 1,
    gridCol: 4,
    width: 4,
    height: 1,
    displayOrder: 3,
    isEnabled: true,
  },
  {
    widgetId: "queue_waiting_customers",
    gridRow: 1,
    gridCol: 8,
    width: 4,
    height: 1,
    displayOrder: 4,
    isEnabled: true,
  },
  {
    widgetId: "inventory_critical_reorder",
    gridRow: 2,
    gridCol: 0,
    width: 6,
    height: 1,
    displayOrder: 5,
    isEnabled: true,
  },
  {
    widgetId: "reports_hourly_velocity",
    gridRow: 2,
    gridCol: 6,
    width: 6,
    height: 1,
    displayOrder: 6,
    isEnabled: true,
  },
];

function pack12ColumnGrid(items: DashboardPlacementItem[]): DashboardPlacementItem[] {
  let currentRow = 0;
  let currentCol = 0;

  return items.map((item, index) => {
    const width = Math.min(12, Math.max(1, item.width || 4));
    const height = Math.max(1, item.height || 1);

    if (currentCol + width > 12) {
      currentRow += 1;
      currentCol = 0;
    }

    const assignedCol = currentCol;
    const assignedRow = currentRow;

    currentCol += width;
    if (currentCol >= 12) {
      currentRow += 1;
      currentCol = 0;
    }

    return {
      ...item,
      width,
      height,
      gridCol: assignedCol,
      gridRow: assignedRow,
      displayOrder: index + 1,
    };
  });
}

function reorderWithPlacement(
  items: DashboardPlacementItem[],
  sourceIndex: number,
  targetIndex: number,
  position: "before" | "after"
): DashboardPlacementItem[] {
  if (sourceIndex === targetIndex) return items;

  const result = [...items];
  const [movedItem] = result.splice(sourceIndex, 1);

  let insertIndex = targetIndex;
  if (sourceIndex < targetIndex) {
    insertIndex = position === "before" ? targetIndex - 1 : targetIndex;
  } else {
    insertIndex = position === "before" ? targetIndex : targetIndex + 1;
  }

  insertIndex = Math.max(0, Math.min(insertIndex, result.length));
  result.splice(insertIndex, 0, movedItem);

  return pack12ColumnGrid(result);
}

export default function DashboardPage() {
  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;

  const currentMembership = useQuery(
    api.organizationUsers.getCurrentMembership,
    activeOrg ? { organizationId: activeOrg._id } : "skip"
  );

  const dashboardData = useQuery(
    api.dashboards.getDashboard,
    activeOrg ? { organizationId: activeOrg._id } : "skip"
  );

  const draftData = useQuery(
    api.dashboards.getDraft,
    dashboardData?.dashboard
      ? { dashboardId: dashboardData.dashboard._id }
      : "skip"
  );

  const userPrefs = useQuery(
    api.dashboards.getUserPreferences,
    activeOrg ? { organizationId: activeOrg._id } : "skip"
  );

  // Mutations
  const initializeDefaultTemplatesMutation = useMutation(api.dashboards.initializeDefaultTemplates);
  const createOrUpdateDraftMutation = useMutation(api.dashboards.createOrUpdateDraft);
  const applyDraftMutation = useMutation(api.dashboards.applyDraft);
  const discardDraftMutation = useMutation(api.dashboards.discardDraft);
  const resetToDefaultsMutation = useMutation(api.dashboards.resetToDefaults);
  const applyTemplateMutation = useMutation(api.dashboards.applyTemplate);
  const updateUserPreferencesMutation = useMutation(api.dashboards.updateUserPreferences);

  // Auto-initialize default templates if organization has no dashboard yet
  const hasInitializedTemplates = useRef(false);
  useEffect(() => {
    if (
      activeOrg &&
      !hasInitializedTemplates.current &&
      (dashboardData === null ||
        dashboardData?.dashboard === null ||
        (dashboardData as any)?.requiresInitialization)
    ) {
      hasInitializedTemplates.current = true;
      initializeDefaultTemplatesMutation({ organizationId: activeOrg._id }).catch((e) => {
        console.warn("Auto-initialization of dashboard templates:", e);
      });
    }
  }, [activeOrg, dashboardData, initializeDefaultTemplatesMutation]);

  // Local state
  const [placements, setPlacements] = useState<DashboardPlacementItem[]>(DEFAULT_STAGING_PLACEMENTS);
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [gridResolution, setGridResolution] = useState<"1440px Fluid" | "Compact 1200px">("1440px Fluid");
  const [autoAlign, setAutoAlign] = useState(true);

  // Global Dashboard Timeframe State
  const [selectedPreset, setSelectedPreset] = useState<string>("Today");
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });

  const dateRangePresetArg = useMemo(() => {
    switch (selectedPreset) {
      case "Today":
        return "today";
      case "Yesterday":
        return "yesterday";
      case "Last 7 Days":
        return "last_7_days";
      case "Last 30 Days":
        return "last_30_days";
      case "This Month":
        return "this_month";
      case "Last Month":
        return "last_month";
      default:
        return "custom";
    }
  }, [selectedPreset]);

  // Drag & drop state
  const draggedIndexRef = useRef<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    index: number;
    position: "before" | "after";
  } | null>(null);

  // Track initial sync from backend
  const hasLoadedInitialPlacements = useRef(false);

  useEffect(() => {
    // Priority: draft -> saved dashboard placements -> default fallback
    if (draftData?.placements && draftData.placements.length > 0) {
      setPlacements(draftData.placements);
      hasLoadedInitialPlacements.current = true;
    } else if (dashboardData?.placements && dashboardData.placements.length > 0) {
      const mapped = dashboardData.placements.map((p, idx) => ({
        widgetId: p.widgetId,
        gridRow: p.gridRow,
        gridCol: p.gridCol,
        width: p.width,
        height: p.height,
        displayOrder: p.displayOrder ?? idx + 1,
        isEnabled: p.isEnabled,
        configuration: p.configuration,
      }));
      setPlacements(mapped);
      hasLoadedInitialPlacements.current = true;
    } else if (!hasLoadedInitialPlacements.current) {
      setPlacements(DEFAULT_STAGING_PLACEMENTS);
    }
  }, [dashboardData?.placements, draftData?.placements]);

  useEffect(() => {
    if (userPrefs?.gridResolution) {
      setGridResolution(userPrefs.gridResolution as any);
    }
    if (userPrefs?.autoAlign !== undefined) {
      setAutoAlign(userPrefs.autoAlign);
    }
  }, [userPrefs]);

  // Baseline placements from saved dashboard
  const baselinePlacements = useMemo(() => {
    if (dashboardData?.placements && dashboardData.placements.length > 0) {
      return dashboardData.placements;
    }
    return DEFAULT_STAGING_PLACEMENTS;
  }, [dashboardData?.placements]);

  // Compute modification count
  const modificationCount = useMemo(() => {
    let mods = 0;
    const baselineMap = new Map(baselinePlacements.map((p) => [p.widgetId, p]));

    for (const p of placements) {
      const base = baselineMap.get(p.widgetId);
      if (!base) {
        mods++; // Newly added widget
      } else if (base.width !== p.width || base.displayOrder !== p.displayOrder) {
        mods++; // Resized or reordered
      }
    }

    for (const base of baselinePlacements) {
      if (!placements.some((p) => p.widgetId === base.widgetId)) {
        mods++; // Removed widget
      }
    }

    return mods;
  }, [placements, baselinePlacements]);

  // Save changes to backend draft
  const persistDraft = async (updatedPlacements: DashboardPlacementItem[]) => {
    if (!activeOrg || !dashboardData?.dashboard) return;
    const packed = pack12ColumnGrid(updatedPlacements);
    try {
      await createOrUpdateDraftMutation({
        dashboardId: dashboardData.dashboard._id,
        baseRevision: dashboardData.dashboard.revision ?? 1,
        placements: packed.map((p, i) => ({
          widgetId: p.widgetId,
          gridRow: p.gridRow,
          gridCol: p.gridCol,
          width: p.width,
          height: p.height,
          displayOrder: i + 1,
          isEnabled: p.isEnabled ?? true,
          configuration: p.configuration,
        })),
      });
    } catch (err) {
      console.error("Failed to persist draft to Convex:", err);
    }
  };

  // Actions
  const handleRemoveWidget = (widgetId: string) => {
    const updated = placements.filter((p) => p.widgetId !== widgetId);
    const packed = pack12ColumnGrid(updated);
    setPlacements(packed);
    persistDraft(packed);
  };

  const handleResizeWidget = (widgetId: string, nextWidth: number) => {
    const updated = placements.map((p) =>
      p.widgetId === widgetId ? { ...p, width: nextWidth } : p
    );
    const packed = pack12ColumnGrid(updated);
    setPlacements(packed);
    persistDraft(packed);
  };

  const handleAddWidget = (widgetId: string, defaultWidth = 4) => {
    if (placements.some((p) => p.widgetId === widgetId)) return;
    const newPlacement: DashboardPlacementItem = {
      widgetId,
      gridRow: 0,
      gridCol: 0,
      width: defaultWidth,
      height: 1,
      displayOrder: placements.length + 1,
      isEnabled: true,
    };
    const updated = [...placements, newPlacement];
    const packed = pack12ColumnGrid(updated);
    setPlacements(packed);
    persistDraft(packed);
  };

  const handleApplyCanvas = async () => {
    if (!activeOrg) return;
    setIsSaving(true);
    try {
      if (!dashboardData?.dashboard) {
        await initializeDefaultTemplatesMutation({ organizationId: activeOrg._id });
      } else {
        await applyDraftMutation({
          dashboardId: dashboardData.dashboard._id,
        });
      }
    } catch (err) {
      console.error("Failed to apply canvas:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = async () => {
    if (!activeOrg || !dashboardData?.dashboard) return;
    setIsSaving(true);
    try {
      await discardDraftMutation({
        dashboardId: dashboardData.dashboard._id,
      });
      // Restore baseline
      const mapped = baselinePlacements.map((p, idx) => ({
        widgetId: p.widgetId,
        gridRow: p.gridRow,
        gridCol: p.gridCol,
        width: p.width,
        height: p.height,
        displayOrder: p.displayOrder ?? idx + 1,
        isEnabled: p.isEnabled,
        configuration: p.configuration,
      }));
      setPlacements(mapped);
    } catch (err) {
      console.error("Failed to discard draft:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!activeOrg) return;
    setIsSaving(true);
    try {
      if (dashboardData?.dashboard) {
        await resetToDefaultsMutation({ dashboardId: dashboardData.dashboard._id });
      } else {
        await initializeDefaultTemplatesMutation({ organizationId: activeOrg._id });
      }
    } catch (err) {
      console.error("Failed to reset defaults:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectTemplate = async (templateKey: string) => {
    if (!activeOrg) return;
    setIsSaving(true);
    try {
      if (!dashboardData?.dashboard) {
        await initializeDefaultTemplatesMutation({ organizationId: activeOrg._id });
      }
      await applyTemplateMutation({
        organizationId: activeOrg._id,
        templateKey,
      });
    } catch (err) {
      console.error("Failed to apply template:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAutoAlign = async () => {
    const nextVal = !autoAlign;
    setAutoAlign(nextVal);
    if (activeOrg) {
      await updateUserPreferencesMutation({
        organizationId: activeOrg._id,
        autoAlign: nextVal,
      });
    }
  };

  const handleResolutionChange = async (res: "1440px Fluid" | "Compact 1200px") => {
    setGridResolution(res);
    if (activeOrg) {
      await updateUserPreferencesMutation({
        organizationId: activeOrg._id,
        gridResolution: res,
      });
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    draggedIndexRef.current = index;
    setDraggedIndex(index);
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverCard = (
    e: React.DragEvent,
    index: number,
    pos: "before" | "after"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    const src = draggedIndexRef.current;
    if (src === null || src === index) {
      if (dropTarget !== null) setDropTarget(null);
      return;
    }

    if (!dropTarget || dropTarget.index !== index || dropTarget.position !== pos) {
      setDropTarget({ index, position: pos });
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropCard = (
    e: React.DragEvent,
    targetIndex: number,
    pos: "before" | "after"
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const sourceIndex = draggedIndexRef.current;
    draggedIndexRef.current = null;
    setDraggedIndex(null);
    setDropTarget(null);

    if (sourceIndex === null || sourceIndex === targetIndex) return;

    setPlacements((prev) => {
      const reordered = reorderWithPlacement(prev, sourceIndex, targetIndex, pos);
      persistDraft(reordered);
      return reordered;
    });
  };

  const handleDragEnd = () => {
    draggedIndexRef.current = null;
    setDraggedIndex(null);
    setDropTarget(null);
  };

  const handleDropAtEnd = () => {
    const sourceIndex = draggedIndexRef.current;
    draggedIndexRef.current = null;
    setDraggedIndex(null);
    setDropTarget(null);

    if (sourceIndex === null) return;
    setPlacements((prev) => {
      if (sourceIndex >= prev.length - 1) return prev;
      const reordered = reorderWithPlacement(
        prev,
        sourceIndex,
        prev.length - 1,
        "after"
      );
      persistDraft(reordered);
      return reordered;
    });
  };

  const handleMoveEarlier = (idx: number) => {
    if (idx <= 0) return;
    const reordered = [...placements];
    const temp = reordered[idx - 1];
    reordered[idx - 1] = reordered[idx];
    reordered[idx] = temp;
    const packed = pack12ColumnGrid(reordered);
    setPlacements(packed);
    persistDraft(packed);
  };

  const handleMoveLater = (idx: number) => {
    if (idx >= placements.length - 1) return;
    const reordered = [...placements];
    const temp = reordered[idx + 1];
    reordered[idx + 1] = reordered[idx];
    reordered[idx] = temp;
    const packed = pack12ColumnGrid(reordered);
    setPlacements(packed);
    persistDraft(packed);
  };

  const placedWidgetIds = useMemo(() => {
    return new Set(placements.map((p) => p.widgetId));
  }, [placements]);

  const userName = (currentMembership as any)?.user?.name || (currentMembership as any)?.name || "Executive User";
  const userRole = Array.isArray(currentMembership?.userType)
    ? currentMembership.userType[0] || "General Manager"
    : typeof currentMembership?.userType === "string"
      ? (currentMembership.userType as string)
      : "General Manager";

  return (
    <PosShell title="Executive Workstation" subtitle="Floor Operations & Live Velocity">
      <div className="flex flex-col w-full min-h-screen bg-surface">
        {/* Sticky Control Bar */}
        <DashboardControlBar
          modificationCount={modificationCount}
          onOpenAddDrawer={() => setIsAddDrawerOpen(true)}
          onResetDefaults={handleResetDefaults}
          onDiscard={handleDiscard}
          onApply={handleApplyCanvas}
          isSaving={isSaving}
        />

        {/* Editorial Sub-Bar with Global Timeframe Range Picker */}
        <DashboardSubBar
          userName={userName}
          userRole={userRole}
          gridResolution={gridResolution}
          onResolutionChange={handleResolutionChange}
          autoAlign={autoAlign}
          onToggleAutoAlign={handleToggleAutoAlign}
          startDate={startDate}
          endDate={endDate}
          datePreset={selectedPreset}
          onDateRangeChange={({ startDate, endDate, preset }) => {
            setStartDate(startDate);
            setEndDate(endDate);
            setSelectedPreset(preset);
          }}
          countryCode={activeOrg?.country || "IN"}
          timezone={activeOrg?.organizationTimeZone}
        />

        {/* Main 12-Column Canvas Layout */}
        <div
          className={`p-margin mx-auto w-full transition-all duration-300 ${
            gridResolution === "Compact 1200px" ? "max-w-[1200px]" : "max-w-[1440px]"
          }`}
        >
          <div
            className="grid grid-cols-12 gap-gutter relative"
            id="layout-grid"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dropTarget) {
                handleDropCard(e, dropTarget.index, dropTarget.position);
              }
            }}
          >
            {placements.map((placement, index) => {
              const isDraggingThis = draggedIndex === index;
              const isTarget = dropTarget?.index === index;
              const cardDropPosition = isTarget ? dropTarget.position : null;

              return (
                <DashboardWidgetCard
                  key={placement.widgetId}
                  organizationId={activeOrg?._id as Id<"organizations">}
                  placement={placement}
                  index={index}
                  onRemove={handleRemoveWidget}
                  onResize={handleResizeWidget}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOverCard}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDropCard}
                  onDragEnd={handleDragEnd}
                  onMoveEarlier={handleMoveEarlier}
                  onMoveLater={handleMoveLater}
                  canMoveEarlier={index > 0}
                  canMoveLater={index < placements.length - 1}
                  isDraggingThis={isDraggingThis}
                  isDraggingAny={draggedIndex !== null}
                  dropPosition={cardDropPosition}
                  dateRangePreset={dateRangePresetArg}
                  fromTimestamp={startDate.getTime()}
                  toTimestamp={endDate.getTime()}
                  dateLabel={selectedPreset}
                />
              );
            })}

            {/* Empty Custom Slot at Canvas Bottom */}
            <DashboardAddSlot
              onOpenDrawer={() => setIsAddDrawerOpen(true)}
              onQuickAdd={handleAddWidget}
              onDropWidgetAtEnd={handleDropAtEnd}
              isDraggingAny={draggedIndex !== null}
            />
          </div>
        </div>

        {/* Bottom Presets Tray */}
        <DashboardPresetTray
          activeTemplateKey={dashboardData?.dashboard?.templateKey || "executive_dinner_peak"}
          onSelectTemplate={handleSelectTemplate}
          isLoading={isSaving}
        />

        {/* Slide-Over Add Widget Drawer */}
        {activeOrg && (
          <AddWidgetDrawer
            isOpen={isAddDrawerOpen}
            onClose={() => setIsAddDrawerOpen(false)}
            organizationId={activeOrg._id}
            placedWidgetIds={placedWidgetIds}
            placements={placements}
            onAddWidget={handleAddWidget}
            dateRangePreset={dateRangePresetArg}
            fromTimestamp={selectedPreset === "Custom Range" ? startDate.getTime() : undefined}
            toTimestamp={selectedPreset === "Custom Range" ? endDate.getTime() : undefined}
          />
        )}
      </div>
    </PosShell>
  );
}
