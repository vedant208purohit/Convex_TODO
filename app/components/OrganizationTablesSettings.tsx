"use client";

import { useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";

// ==========================================
// SVG ICONS FOR TABLES & LAYOUTS UI
// ==========================================

function PlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function PencilIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
    </svg>
  );
}

function TrashIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

function ChevronDownIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function EyeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function InfoIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function CloseIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CanvasViewIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

function ListViewIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

// ==========================================
// COMPONENT: OrganizationTablesSettings
// ==========================================

export function OrganizationTablesSettings() {
  // Main Sub-Tab State: "layouts" | "tables"
  const [activeMainTab, setActiveMainTab] = useState<"layouts" | "tables">("layouts");

  // Selected Layout State for Tables view
  const [selectedLayoutId, setSelectedLayoutId] = useState<Id<"organizationLayouts"> | null>(null);
  const [isLayoutDropdownOpen, setIsLayoutDropdownOpen] = useState(false);

  // View Switcher State inside Tables tab: "designer" | "list"
  const [tablesViewMode, setTablesViewMode] = useState<"designer" | "list">("designer");

  // Drawer States
  const [showAddLayoutDrawer, setShowAddLayoutDrawer] = useState(false);
  const [editingLayout, setEditingLayout] = useState<Doc<"organizationLayouts"> | null>(null);

  const [showAddTableDrawer, setShowAddTableDrawer] = useState(false);
  const [editingTable, setEditingTable] = useState<Doc<"organizationTables"> | null>(null);

  // Delete Confirmation State
  const [deletingTarget, setDeletingTarget] = useState<{
    type: "layout" | "table";
    id: Id<"organizationLayouts"> | Id<"organizationTables">;
    name: string;
    hasTablesCount?: number;
  } | null>(null);

  // Inspector Popover State for Selected Canvas Table
  const [canvasSelectedTableId, setCanvasSelectedTableId] = useState<Id<"organizationTables"> | null>(null);
  // Active Left-Clicked Action Toolbar Table State
  const [activeActionTableId, setActiveActionTableId] = useState<Id<"organizationTables"> | null>(null);
  // Hovered Table State for Instant Hover Toolbar
  const [hoveredTableId, setHoveredTableId] = useState<Id<"organizationTables"> | null>(null);

  // Form Inputs
  const [layoutNameInput, setLayoutNameInput] = useState("");
  const [layoutErrorMessage, setLayoutErrorMessage] = useState<string | null>(null);
  const [isLayoutSubmitting, setIsLayoutSubmitting] = useState(false);

  const [tableNumberInput, setTableNumberInput] = useState("");
  const [seatingCapacityInput, setSeatingCapacityInput] = useState<number>(4);
  const [tableLayoutIdInput, setTableLayoutIdInput] = useState<Id<"organizationLayouts"> | "">("");
  const [isDrawerLayoutDropdownOpen, setIsDrawerLayoutDropdownOpen] = useState(false);
  const [kidsSeatInput, setKidsSeatInput] = useState(false);
  const [disabledSeatInput, setDisabledSeatInput] = useState(false);
  const [barbequeGrillInput, setBarbequeGrillInput] = useState(false);
  const [tableErrorMessage, setTableErrorMessage] = useState<string | null>(null);
  const [isTableSubmitting, setIsTableSubmitting] = useState(false);

  // Canvas Drag State & Zoom / Grid Snap State
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [gridSnapSize, setGridSnapSize] = useState<number>(24);
  const [isGridSnapDropdownOpen, setIsGridSnapDropdownOpen] = useState<boolean>(false);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(200, prev + 10));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(50, prev - 10));
  const handleResetZoom = () => setZoomLevel(100);

  const [draggingTableId, setDraggingTableId] = useState<Id<"organizationTables"> | null>(null);
  const [pendingDragTable, setPendingDragTable] = useState<Doc<"organizationTables"> | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const isHasDraggedRef = useRef(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [tempPositions, setTempPositions] = useState<Record<string, { x: number; y: number }>>({});
  const canvasRef = useRef<HTMLDivElement>(null);

  // ------------------------------------------
  // AUTH & CONVEX BACKEND QUERIES & MUTATIONS
  // ------------------------------------------
  const { isSignedIn } = useAuth();
  const organizations = useQuery(api.organizations.list, isSignedIn ? {} : "skip");
  const organization = organizations?.[0] ?? null;
  const currentMembership = useQuery(
    api.organizationUsers.getCurrentMembership,
    organization?._id && isSignedIn ? { organizationId: organization._id } : "skip"
  );
  const isAuthReady = Boolean(isSignedIn && currentMembership);

  // Organization Layouts APIs
  const layouts = useQuery(
    api.organizationLayouts.list,
    isAuthReady ? {} : "skip"
  );
  const createLayout = useMutation(api.organizationLayouts.create);
  const updateLayout = useMutation(api.organizationLayouts.update);
  const removeLayout = useMutation(api.organizationLayouts.remove);

  // Organization Tables APIs
  const allTables = useQuery(
    api.organizationTables.list,
    isAuthReady ? {} : "skip"
  );
  const createTable = useMutation(api.organizationTables.create);
  const updateTable = useMutation(api.organizationTables.update);
  const removeTable = useMutation(api.organizationTables.remove);

  const isLoadingLayouts = layouts === undefined;
  const isLoadingTables = allTables === undefined;

  // Auto-select first layout if none selected
  useEffect(() => {
    if (layouts && layouts.length > 0 && !selectedLayoutId) {
      setSelectedLayoutId(layouts[0]._id);
    }
  }, [layouts, selectedLayoutId]);

  // Derived metrics
  const activeLayoutsList = layouts ?? [];
  const allActiveTablesList = allTables ?? [];

  const selectedLayout = activeLayoutsList.find((l) => l._id === selectedLayoutId) ?? activeLayoutsList[0] ?? null;

  const tablesInSelectedLayout = selectedLayout
    ? allActiveTablesList.filter((t) => t.layoutId === selectedLayout._id)
    : [];

  const totalSeatsInSelectedLayout = tablesInSelectedLayout.reduce(
    (sum, t) => sum + (t.seatingCapacity || 0),
    0
  );

  const totalCapacityAllTables = allActiveTablesList.reduce(
    (sum, t) => sum + (t.seatingCapacity || 0),
    0
  );

  // Helper map for table count per layout
  const tableCountByLayout = activeLayoutsList.reduce<Record<string, number>>((acc, l) => {
    acc[l._id] = allActiveTablesList.filter((t) => t.layoutId === l._id).length;
    return acc;
  }, {});

  // ------------------------------------------
  // HANDLERS FOR LAYOUTS
  // ------------------------------------------

  const handleOpenAddLayout = () => {
    setLayoutNameInput("");
    setLayoutErrorMessage(null);
    setShowAddLayoutDrawer(true);
  };

  const handleOpenEditLayout = (layout: Doc<"organizationLayouts">) => {
    setEditingLayout(layout);
    setLayoutNameInput(layout.name);
    setLayoutErrorMessage(null);
  };

  const handleSaveLayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!layoutNameInput.trim()) {
      setLayoutErrorMessage("Layout name can't be blank");
      return;
    }

    setIsLayoutSubmitting(true);
    setLayoutErrorMessage(null);

    try {
      if (editingLayout) {
        await updateLayout({
          id: editingLayout._id,
          name: layoutNameInput.trim(),
        });
        setEditingLayout(null);
      } else {
        await createLayout({
          name: layoutNameInput.trim(),
        });
        setShowAddLayoutDrawer(false);
      }
    } catch (err: any) {
      setLayoutErrorMessage(err?.message || "Failed to save layout.");
    } finally {
      setIsLayoutSubmitting(false);
    }
  };

  const handleDeleteLayoutClick = (layout: Doc<"organizationLayouts">) => {
    const count = tableCountByLayout[layout._id] || 0;
    setDeletingTarget({
      type: "layout",
      id: layout._id,
      name: layout.name,
      hasTablesCount: count,
    });
  };

  // ------------------------------------------
  // HANDLERS FOR TABLES
  // ------------------------------------------

  const handleOpenAddTable = () => {
    setEditingTable(null);
    setTableNumberInput("");
    setSeatingCapacityInput(4);
    setTableLayoutIdInput(selectedLayoutId ?? (activeLayoutsList[0]?._id || ""));
    setKidsSeatInput(false);
    setDisabledSeatInput(false);
    setBarbequeGrillInput(false);
    setTableErrorMessage(null);
    setShowAddTableDrawer(true);
  };

  const handleOpenEditTable = (table: Doc<"organizationTables">) => {
    setEditingTable(table);
    setTableNumberInput(table.tableNumber);
    setSeatingCapacityInput(table.seatingCapacity);
    setTableLayoutIdInput(table.layoutId ?? "");
    setKidsSeatInput(Boolean(table.kidsSeatAvailability));
    setDisabledSeatInput(Boolean(table.disabledSeatAvailability));
    setBarbequeGrillInput(Boolean(table.barbequeGrillAvailability));
    setTableErrorMessage(null);
  };

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNumberInput.trim()) {
      setTableErrorMessage("Table number can't be blank");
      return;
    }
    if (!seatingCapacityInput || seatingCapacityInput <= 0) {
      setTableErrorMessage("Seating capacity must be greater than 0");
      return;
    }

    setIsTableSubmitting(true);
    setTableErrorMessage(null);

    const targetLayoutId = tableLayoutIdInput ? (tableLayoutIdInput as Id<"organizationLayouts">) : undefined;

    try {
      if (editingTable) {
        await updateTable({
          id: editingTable._id,
          tableNumber: tableNumberInput.trim(),
          seatingCapacity: Number(seatingCapacityInput),
          layoutId: targetLayoutId,
          kidsSeatAvailability: kidsSeatInput,
          disabledSeatAvailability: disabledSeatInput,
          barbequeGrillAvailability: barbequeGrillInput,
        });
        setEditingTable(null);
      } else {
        await createTable({
          tableNumber: tableNumberInput.trim(),
          seatingCapacity: Number(seatingCapacityInput),
          layoutId: targetLayoutId,
          kidsSeatAvailability: kidsSeatInput,
          disabledSeatAvailability: disabledSeatInput,
          barbequeGrillAvailability: barbequeGrillInput,
        });
        setShowAddTableDrawer(false);
      }
    } catch (err: any) {
      setTableErrorMessage(err?.message || "Failed to save table.");
    } finally {
      setIsTableSubmitting(false);
    }
  };

  const handleDeleteTableClick = (table: Doc<"organizationTables">) => {
    setDeletingTarget({
      type: "table",
      id: table._id,
      name: `Table ${table.tableNumber}`,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deletingTarget) return;

    try {
      if (deletingTarget.type === "layout") {
        if (deletingTarget.hasTablesCount && deletingTarget.hasTablesCount > 0) {
          alert("Tables must be reassigned before deleting a layout containing active tables.");
          setDeletingTarget(null);
          return;
        }
        await removeLayout({ id: deletingTarget.id as Id<"organizationLayouts"> });
      } else {
        await removeTable({ id: deletingTarget.id as Id<"organizationTables"> });
        if (canvasSelectedTableId === deletingTarget.id) {
          setCanvasSelectedTableId(null);
        }
      }
    } catch (err: any) {
      alert(err?.message || "Failed to delete item");
    } finally {
      setDeletingTarget(null);
    }
  };

  // ------------------------------------------
  // CANVAS DRAG & DROP LOGIC
  // ------------------------------------------

  const handleTableMouseDown = (
    e: React.MouseEvent,
    table: Doc<"organizationTables">
  ) => {
    // Only proceed on Left Mouse Click (button === 0), ignore Right Click
    if (e.button !== 0) return;
    e.stopPropagation();

    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const scale = zoomLevel / 100;
    const rect = canvasEl.getBoundingClientRect();
    const currentX = tempPositions[table._id]?.x ?? parseInt(table.xPosition || "80", 10);
    const currentY = tempPositions[table._id]?.y ?? parseInt(table.yPosition || "80", 10);

    const mouseX = (e.clientX - rect.left) / scale;
    const mouseY = (e.clientY - rect.top) / scale;

    setPendingDragTable(table);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    isHasDraggedRef.current = false;

    // Open 3 action buttons instantly on Left Mouse Down (if preview is not open)
    if (canvasSelectedTableId !== table._id) {
      setActiveActionTableId(table._id);
    }

    setDragOffset({
      x: mouseX - currentX,
      y: mouseY - currentY,
    });
  };

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!pendingDragTable || !canvasRef.current || !dragStartPos) return;

      const deltaX = Math.abs(e.clientX - dragStartPos.x);
      const deltaY = Math.abs(e.clientY - dragStartPos.y);

      // If mouse moved more than 4px threshold, enter active drag mode and hide popover
      if (!isHasDraggedRef.current && (deltaX > 4 || deltaY > 4)) {
        isHasDraggedRef.current = true;
        setDraggingTableId(pendingDragTable._id);
        setCanvasSelectedTableId(null);
      }

      if (isHasDraggedRef.current) {
        const scale = zoomLevel / 100;
        const rect = canvasRef.current.getBoundingClientRect();
        const rawX = (e.clientX - rect.left) / scale - dragOffset.x;
        const rawY = (e.clientY - rect.top) / scale - dragOffset.y;

        // Dynamic snap size based on selected gridSnapSize
        const snap = gridSnapSize > 0 ? gridSnapSize : 1;
        const snappedX = Math.max(24, Math.min(1400, Math.round(rawX / snap) * snap));
        const snappedY = Math.max(24, Math.min(1400, Math.round(rawY / snap) * snap));

        setTempPositions((prev) => ({
          ...prev,
          [pendingDragTable._id]: { x: snappedX, y: snappedY },
        }));
      }
    },
    [pendingDragTable, dragStartPos, dragOffset, zoomLevel, gridSnapSize]
  );

  const handleCanvasMouseUp = useCallback(async () => {
    if (!pendingDragTable) return;

    const table = pendingDragTable;
    const tableId = table._id;
    const wasDragged = isHasDraggedRef.current;

    setDraggingTableId(null);
    setPendingDragTable(null);
    setDragStartPos(null);

    if (wasDragged) {
      // User dragged table -> persist new position in Convex DB!
      const finalPos = tempPositions[tableId];
      if (finalPos) {
        try {
          await updateTable({
            id: tableId,
            xPosition: finalPos.x.toString(),
            yPosition: finalPos.y.toString(),
          });
        } catch (err) {
          console.error("Failed to save table position:", err);
        }
      }
    }

    // Always keep 3 action buttons active for table on mouse up (if preview is not open)
    if (canvasSelectedTableId !== tableId) {
      setActiveActionTableId(tableId);
    }
  }, [pendingDragTable, tempPositions, updateTable, canvasSelectedTableId]);

  // Selected table in 2D canvas inspector
  const canvasSelectedTable = tablesInSelectedLayout.find(
    (t) => t._id === canvasSelectedTableId
  );

  // Loading indicator
  if (isLoadingLayouts || isLoadingTables) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#5e5e5e]">
        <div className="w-8 h-8 border-2 border-[#0c0a09] border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">Loading Tables & Layouts...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 bg-[#fdf8f7]">
      {/* ------------------------------------------
          HEADER & BREADCRUMB
      ------------------------------------------ */}
      <div className="px-6 lg:px-8 pt-6 pb-4 bg-transparent shrink-0">
        <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-[11px] uppercase tracking-widest text-[#5e5e5e] font-medium">
          <span>SETTINGS</span>
          <span className="text-[#b8b3b0]">/</span>
          <span>STORE CONFIGURATION</span>
          <span className="text-[#b8b3b0]">/</span>
          <span className="text-[#0c0a09] font-semibold">TABLES & LAYOUTS</span>
        </nav>

        <div className="mt-4 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="font-garamond text-3xl md:text-[32px] font-normal tracking-tight text-[#0c0a09] leading-tight">
              {activeMainTab === "layouts" ? "Tables & Layouts" : "Tables"}
            </h1>
            <p className="text-sm text-[#5e5e5e] mt-1 font-normal">
              Set up your dining areas and manage the tables assigned to each area.
            </p>
          </div>

          {activeMainTab === "layouts" ? (
            <button
              onClick={handleOpenAddLayout}
              className="inline-flex items-center justify-center bg-[#0c0a09] text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-neutral-800 transition-all shadow-sm focus:outline-none shrink-0 cursor-pointer"
              type="button"
            >
              <PlusIcon className="w-4 h-4 mr-2 text-white stroke-white" />
              <span className="text-white">Add new layout</span>
            </button>
          ) : null}
        </div>

        {/* ------------------------------------------
            NAVIGATION TABS: Layout Setup vs Tables
        ------------------------------------------ */}
        <div className="mt-6 border-b border-[#e7e5e4] flex space-x-8" role="tablist">
          <button
            onClick={() => setActiveMainTab("layouts")}
            aria-selected={activeMainTab === "layouts"}
            className={`pb-3 text-sm font-medium transition-all flex items-center space-x-2 cursor-pointer ${
              activeMainTab === "layouts"
                ? "text-[#0c0a09] border-b-2 border-[#0c0a09]"
                : "text-[#5e5e5e] hover:text-[#0c0a09] border-b-2 border-transparent"
            }`}
            role="tab"
          >
            <span>Layout Setup</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#f1edec] text-[#0c0a09]">
              {activeLayoutsList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveMainTab("tables")}
            aria-selected={activeMainTab === "tables"}
            className={`pb-3 text-sm font-medium transition-all cursor-pointer ${
              activeMainTab === "tables"
                ? "text-[#0c0a09] border-b-2 border-[#0c0a09]"
                : "text-[#5e5e5e] hover:text-[#0c0a09] border-b-2 border-transparent"
            }`}
            role="tab"
          >
            <span>Tables</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------
          MAIN CONTENT AREA
      ------------------------------------------ */}
      <div className="px-6 lg:px-8 py-6 max-w-7xl flex-1 flex flex-col min-h-0">
        {/* ==========================================
            TAB 1: LAYOUT SETUP
        ========================================== */}
        {activeMainTab === "layouts" && (
          <section className="bg-white rounded-xl border border-[#e7e5e4] shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col">
            {/* Card Header */}
            <div className="p-6 border-b border-[#f1edec] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="font-garamond text-xl text-[#0c0a09] font-normal tracking-tight">
                  Dining Layouts
                </h2>
                <p className="text-xs text-[#5e5e5e] mt-0.5">
                  {activeLayoutsList.length} active dining zones configured across your restaurant
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center text-[11px] font-medium text-[#5e5e5e] bg-[#f7f3f2] px-3 py-1 rounded-full border border-[#e7e5e4]">
                  Total Capacity: {allActiveTablesList.length} Tables ({totalCapacityAllTables} Seats)
                </span>
              </div>
            </div>

            {/* Layouts Data Table */}
            <div className="p-6 overflow-auto max-h-[500px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f7f3f2] text-[#5e5e5e] text-[11px] uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4 rounded-l-lg font-medium">Layout Name</th>
                    <th className="py-3 px-4 font-medium">Tables Added</th>
                    <th className="py-3 px-4 rounded-r-lg text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1edec] text-sm">
                  {activeLayoutsList.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-sm text-[#5e5e5e]">
                        No dining layouts configured yet. Click "Add new layout" to create one.
                      </td>
                    </tr>
                  ) : (
                    activeLayoutsList.map((layout) => {
                      const count = tableCountByLayout[layout._id] || 0;
                      return (
                        <tr key={layout._id} className="hover:bg-[#faf2ee]/50 transition-colors group">
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-2 h-2 rounded-full bg-emerald-600"></div>
                              <span className="font-medium text-[#0c0a09]">{layout.name}</span>
                              {layout.name.toLowerCase().includes("indoor") ? (
                                <span className="text-[10px] text-[#5e5e5e] uppercase tracking-wider bg-[#f1edec] px-1.5 py-0.5 rounded font-mono">
                                  Main Floor
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#f1edec] text-[#0c0a09]">
                              {count} {count === 1 ? "table" : "tables"}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="inline-flex items-center space-x-2">
                              <button
                                onClick={() => handleOpenEditLayout(layout)}
                                className="p-1.5 text-[#5e5e5e] hover:text-[#0c0a09] hover:bg-[#f1edec] rounded-md transition-colors cursor-pointer"
                                title={`Edit ${layout.name}`}
                                type="button"
                              >
                                <PencilIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteLayoutClick(layout)}
                                className="p-1.5 text-[#5e5e5e] hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                title={`Delete ${layout.name}`}
                                type="button"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Operational Hint Footer */}
            <footer className="px-6 py-4 bg-[#faf2ee]/60 border-t border-[#f1edec] flex items-center">
              <span className="text-xs text-[#5e5e5e] flex items-center">
                <InfoIcon className="w-4 h-4 mr-2 text-[#5e5e5e]" />
                Tables must be reassigned before deleting a layout containing active tables.
              </span>
            </footer>
          </section>
        )}

        {/* ==========================================
            TAB 2: TABLES
        ========================================== */}
        {activeMainTab === "tables" && (
          <div className="flex flex-col flex-1 min-h-0 space-y-4">
            {/* Top Toolbar Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
              {/* Left: Layout Selector Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsLayoutDropdownOpen(!isLayoutDropdownOpen)}
                  className="inline-flex items-center justify-between gap-2.5 bg-white border border-[#1c1917] px-4 py-2 rounded-full text-xs font-semibold text-[#0c0a09] hover:bg-[#faf8f7] shadow-sm transition-all cursor-pointer"
                  type="button"
                >
                  <span className="text-[#a8a29e] font-normal">View:</span>
                  <span className="font-semibold text-[#0c0a09]">
                    {selectedLayout ? selectedLayout.name : "Select Layout"}
                  </span>
                  <ChevronDownIcon className={`w-4 h-4 text-[#0c0a09] transition-transform ${isLayoutDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Dropdown Popover */}
                {isLayoutDropdownOpen && (
                  <div
                    className="absolute left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-stone-200 p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-3 pt-2 pb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#a8a29e] block">
                        VIEW LAYOUT
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {activeLayoutsList.map((l) => {
                        const isSelected = selectedLayoutId === l._id;
                        const count = tableCountByLayout[l._id] || 0;
                        return (
                          <button
                            key={l._id}
                            onClick={() => {
                              setSelectedLayoutId(l._id);
                              setIsLayoutDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-[#f5efeb] text-[#0c0a09] font-medium"
                                : "text-[#1c1917] hover:bg-[#faf8f7]"
                            }`}
                            type="button"
                          >
                            {isSelected ? (
                              <div className="flex items-center gap-2">
                                <svg className="w-3.5 h-3.5 text-[#0c0a09] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span className="font-semibold text-[#0c0a09]">{l.name}</span>
                              </div>
                            ) : (
                              <span className="pl-5 text-[#1c1917] font-medium">{l.name}</span>
                            )}
                            <span className="text-[11px] text-[#a8a29e] font-normal">
                              {isSelected ? "Selected" : `${count} ${count === 1 ? "table" : "tables"}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="border-t border-[#f0eee9] mt-2 pt-2">
                      <button
                        onClick={() => {
                          setIsLayoutDropdownOpen(false);
                          setActiveMainTab("layouts");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#78716c] hover:text-[#0c0a09] font-medium rounded-lg hover:bg-[#faf8f7] transition-colors cursor-pointer text-left"
                        type="button"
                      >
                        <PlusIcon className="w-3.5 h-3.5 text-[#78716c]" />
                        <span>Manage layout zones...</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Middle & Right: View Switcher + Add Table CTA */}
              <div className="flex items-center gap-3">
                {/* View Switcher Segmented Control */}
                <div className="p-1 bg-[#f1edec] rounded-lg flex items-center gap-1 border border-[#e7e5e4]">
                  <button
                    onClick={() => setTablesViewMode("designer")}
                    className={`font-medium text-xs px-3.5 py-1.5 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                      tablesViewMode === "designer"
                        ? "bg-[#0c0a09] text-white shadow-sm font-semibold"
                        : "text-[#5e5e5e] hover:text-[#0c0a09]"
                    }`}
                    type="button"
                  >
                    <CanvasViewIcon className={`w-3.5 h-3.5 ${tablesViewMode === "designer" ? "text-white stroke-white" : "text-[#5e5e5e]"}`} />
                    <span className={tablesViewMode === "designer" ? "text-white" : "text-[#5e5e5e]"}>Table Designer</span>
                  </button>
                  <button
                    onClick={() => setTablesViewMode("list")}
                    className={`font-medium text-xs px-3.5 py-1.5 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                      tablesViewMode === "list"
                        ? "bg-[#0c0a09] text-white shadow-sm font-semibold"
                        : "text-[#5e5e5e] hover:text-[#0c0a09]"
                    }`}
                    type="button"
                  >
                    <ListViewIcon className={`w-3.5 h-3.5 ${tablesViewMode === "list" ? "text-white stroke-white" : "text-[#5e5e5e]"}`} />
                    <span className={tablesViewMode === "list" ? "text-white" : "text-[#5e5e5e]"}>Table list</span>
                  </button>
                </div>

                {/* Add New Table Button */}
                <button
                  onClick={handleOpenAddTable}
                  className="inline-flex items-center gap-1.5 bg-[#0c0a09] text-white hover:bg-neutral-800 transition px-4 py-2 rounded-full text-xs font-medium shadow-sm cursor-pointer"
                  type="button"
                >
                  <PlusIcon className="w-3.5 h-3.5 text-white stroke-white" />
                  <span className="text-white">Add new table</span>
                </button>
              </div>
            </div>

            {/* Selected Layout Status Banner */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-white border border-[#e7e5e4] rounded-lg text-xs text-[#0c0a09]">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-semibold text-[#0c0a09]">
                  Layout: {selectedLayout ? selectedLayout.name : "All"}
                </span>
                <span className="text-[#5e5e5e]">•</span>
                <span className="text-[#5e5e5e]">
                  {tablesInSelectedLayout.length} tables placed ({allActiveTablesList.length} total allocated)
                </span>
              </div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#5e5e5e]">
                {selectedLayout ? selectedLayout.name.toUpperCase() : "VENUE FLOOR"}
              </span>
            </div>

            {/* ------------------------------------------
                SUB-VIEW A: 2D TABLE DESIGNER (CANVAS)
            ------------------------------------------ */}
            {tablesViewMode === "designer" && (
              <section className="flex-1 min-h-[580px] bg-white rounded-xl border border-[#e7e5e4] shadow-sm flex flex-col relative overflow-hidden">
                {/* Canvas Mini Header */}
                <header className="px-5 py-2.5 border-b border-[#e7e5e4] bg-white flex items-center justify-between z-10 select-none">
                  <div className="flex items-center gap-3">
                    {/* Clean canvas header without Grid Snap dropdown */}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#5e5e5e]">
                    <div className="flex items-center gap-1 border border-[#e7e5e4] rounded-lg px-2 py-0.5 bg-stone-50 font-mono text-[11px]">
                      <button
                        type="button"
                        onClick={handleZoomOut}
                        disabled={zoomLevel <= 50}
                        className="hover:text-black px-1.5 py-0.5 font-bold cursor-pointer hover:bg-stone-200 rounded disabled:opacity-30 disabled:cursor-not-allowed select-none transition-colors"
                        title="Zoom Out (-10%)"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={handleResetZoom}
                        className="text-[#0c0a09] font-semibold px-2 py-0.5 border-x border-stone-200 hover:bg-stone-200 rounded transition-colors cursor-pointer select-none"
                        title="Reset Zoom to 100%"
                      >
                        {zoomLevel}%
                      </button>
                      <button
                        type="button"
                        onClick={handleZoomIn}
                        disabled={zoomLevel >= 200}
                        className="hover:text-black px-1.5 py-0.5 font-bold cursor-pointer hover:bg-stone-200 rounded disabled:opacity-30 disabled:cursor-not-allowed select-none transition-colors"
                        title="Zoom In (+10%)"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </header>

                {/* Canvas Floor Grid Container */}
                <div
                  ref={canvasRef}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onClick={() => {
                    setCanvasSelectedTableId(null);
                    setActiveActionTableId(null);
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  className="flex-1 relative p-8 cursor-crosshair overflow-auto select-none min-h-[500px] max-h-[650px]"
                  style={{
                    backgroundColor: "#ffffff",
                    backgroundImage: "radial-gradient(#d6d3d1 0.85px, transparent 0.85px)",
                    backgroundSize: `${gridSnapSize * (zoomLevel / 100)}px ${gridSnapSize * (zoomLevel / 100)}px`,
                  }}
                >
                  <div
                    style={{
                      transform: `scale(${zoomLevel / 100})`,
                      transformOrigin: "0 0",
                      width: `${100 / (zoomLevel / 100)}%`,
                      height: `${100 / (zoomLevel / 100)}%`,
                      minWidth: "1200px",
                      minHeight: "750px",
                      position: "relative",
                      transition: draggingTableId ? "none" : "transform 0.15s ease-out",
                    }}
                  >
                    {tablesInSelectedLayout.length === 0 ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 z-20 overflow-hidden">
                        {/* Subtle architectural floor background pattern */}
                        <div
                          className="absolute inset-0 opacity-[0.035] pointer-events-none"
                          style={{
                            backgroundImage: "radial-gradient(#0c0a09 1px, transparent 1px)",
                            backgroundSize: "24px 24px",
                          }}
                        ></div>

                        <div className="relative z-10 max-w-md flex flex-col items-center">
                          {/* Geometric Blueprint Table Illustration */}
                          <div className="w-20 h-20 rounded-2xl bg-[#faf2ee] border border-[#e4dcda] flex items-center justify-center mb-6 shadow-sm">
                            <svg
                              className="w-10 h-10 text-[#0c0a09] stroke-[1.25]"
                              fill="none"
                              viewBox="0 0 48 48"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              {/* Central Dining Table Blueprint */}
                              <rect fill="#fff" height="20" rx="3" stroke="currentColor" strokeDasharray="2 2" width="20" x="14" y="14"></rect>
                              {/* Surrounding chairs representing layout */}
                              <rect fill="currentColor" height="3" rx="1.5" stroke="currentColor" width="10" x="19" y="8"></rect>
                              <rect fill="currentColor" height="3" rx="1.5" stroke="currentColor" width="10" x="19" y="37"></rect>
                              <rect fill="currentColor" height="10" rx="1.5" stroke="currentColor" width="3" x="8" y="19"></rect>
                              <rect fill="currentColor" height="10" rx="1.5" stroke="currentColor" width="3" x="37" y="19"></rect>
                              {/* Center table accent dot */}
                              <circle cx="24" cy="24" fill="currentColor" r="2"></circle>
                            </svg>
                          </div>

                          {/* Empty State Copy */}
                          <h2 className="font-garamond text-[24px] leading-snug font-normal text-[#141010] mb-2">
                            No tables in this layout yet
                          </h2>
                          <p className="text-sm font-light text-[#5e5e5e] max-w-sm leading-relaxed mb-7">
                            Add your first table to start building the seating layout for{" "}
                            <strong className="font-medium text-[#141010]">{selectedLayout?.name || "this layout"}</strong>.
                          </p>

                          {/* Primary CTA Button */}
                          <button
                            onClick={handleOpenAddTable}
                            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0c0a09] text-white text-xs tracking-wider uppercase font-semibold hover:bg-neutral-800 transition-all shadow hover:shadow-md mb-8 cursor-pointer"
                            type="button"
                          >
                            <PlusIcon className="w-3.5 h-3.5 stroke-[2] text-white stroke-white" />
                            <span className="text-white font-semibold" style={{ color: "#ffffff" }}>
                              Add new table
                            </span>
                          </button>

                          {/* Subtle Helper Notice */}
                          <div className="pt-6 border-t border-[#eae3df]/70 w-full">
                            <p className="text-[12.5px] leading-relaxed text-[#8a8580] font-light">
                              You can place tables visually using the{" "}
                              <span
                                onClick={() => setTablesViewMode("designer")}
                                className="text-[#141010] font-normal underline underline-offset-2 decoration-[#eae3df] hover:decoration-[#141010] cursor-pointer"
                              >
                                Table Designer
                              </span>{" "}
                              or manage them directly from Table List once created.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      tablesInSelectedLayout.map((table) => {
                        const temp = tempPositions[table._id];
                        const posX = temp ? temp.x : parseInt(table.xPosition || "80", 10);
                        const posY = temp ? temp.y : parseInt(table.yPosition || "80", 10);
                        const isSelected = canvasSelectedTableId === table._id;

                        // Seating dot circles generator
                        const capacity = table.seatingCapacity || 4;
                        const topSeats = Math.ceil(capacity / 2);
                        const bottomSeats = Math.floor(capacity / 2);

                        const isDragging = draggingTableId === table._id;
                        const popoverLeftClass = posX > 800 ? "-left-[270px]" : "left-32";
                        const popoverTopClass = posY > 350 ? "-top-10" : "top-0";

                        return (
                          <div
                            key={table._id}
                            onMouseEnter={() => setHoveredTableId(table._id)}
                            onMouseLeave={() => setHoveredTableId(null)}
                            onMouseDown={(e) => handleTableMouseDown(e, table)}
                            onMouseUp={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              if (canvasSelectedTableId !== table._id) {
                                setActiveActionTableId((prev) => (prev === table._id ? null : table._id));
                              }
                            }}
                            className={`absolute group select-none transition-all duration-75 ${
                              isDragging
                                ? "z-50 cursor-grabbing scale-105"
                                : isSelected
                                ? "z-40 cursor-pointer"
                                : "z-10 cursor-grab hover:z-20"
                            }`}
                            style={{
                              left: `${posX}px`,
                              top: `${posY}px`,
                              touchAction: "none",
                            }}
                            data-purpose="visual-table-item"
                            title="Hover or click to show Edit, Preview, Delete buttons • Drag to reposition table"
                          >
                            {/* Moving Visual Indicator Badge */}
                            {isDragging && (
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#0c0a09] text-white text-[10px] font-mono px-2.5 py-0.5 rounded-full shadow-xl whitespace-nowrap z-50 flex items-center gap-1.5 animate-pulse border border-stone-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                <span>Moving: X:{posX}px Y:{posY}px</span>
                              </div>
                            )}

                            {/* UI Friendly 3 Mini Action Buttons: Edit, Preview, Delete */}
                            {/* Shown on hover or left-click when preview is NOT active */}
                            {!isDragging && !isSelected && (hoveredTableId === table._id || activeActionTableId === table._id) && (
                              <div
                                className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white/95 backdrop-blur-md border border-stone-200/90 p-1 rounded-lg shadow-md z-30 transition-all opacity-90 group-hover:opacity-100 whitespace-nowrap"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                              >
                                {/* Edit Button */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditTable(table);
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-800 text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                                  title="Edit Table"
                                >
                                  <PencilIcon className="w-3 h-3 text-stone-700" />
                                  <span>Edit</span>
                                </button>

                                {/* Preview Button */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCanvasSelectedTableId(isSelected ? null : table._id);
                                    setActiveActionTableId(null);
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                                    isSelected
                                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                      : "bg-stone-100 hover:bg-stone-200 text-stone-800"
                                  }`}
                                  title="Preview Table Details"
                                >
                                  <EyeIcon className={`w-3 h-3 ${isSelected ? "text-white" : "text-stone-700"}`} />
                                  <span>Preview</span>
                                </button>

                                {/* Delete Button */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTableClick(table);
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                                  title="Delete Table"
                                >
                                  <TrashIcon className="w-3 h-3 text-red-600" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}

                            {/* Top Circular Seats */}
                            <div className="flex items-center justify-center gap-2 mb-1.5">
                              {Array.from({ length: topSeats }).map((_, i) => (
                                <div
                                  key={i}
                                  className={`w-3.5 h-3.5 rounded-full shadow-sm transition-colors ${
                                    isDragging ? "bg-amber-500 scale-110" : "bg-[#141010]"
                                  }`}
                                ></div>
                              ))}
                            </div>

                            {/* Table Body */}
                            <div
                              className={`w-28 h-24 rounded-2xl flex flex-col items-center justify-center text-white shadow-xl transition-all relative ${
                                isDragging
                                  ? "bg-[#0c0a09] ring-4 ring-amber-500/80 shadow-2xl scale-[1.04]"
                                  : isSelected
                                  ? "bg-[#141010] ring-4 ring-[#0c0a09]/40 scale-[1.02]"
                                  : "bg-[#141010] hover:ring-2 hover:ring-stone-400"
                              }`}
                            >
                              <span className="text-sm font-semibold tracking-wide lowercase">
                                {table.tableNumber}
                              </span>
                              <span className="text-[10px] text-stone-400 uppercase tracking-widest font-mono mt-0.5">
                                {capacity} Seats
                              </span>
                              <span
                                className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                                  isDragging ? "bg-amber-400 animate-ping" : "bg-emerald-400"
                                }`}
                              ></span>
                            </div>

                            {/* Bottom Circular Seats */}
                            <div className="flex items-center justify-center gap-2 mt-1.5">
                              {Array.from({ length: bottomSeats }).map((_, i) => (
                                <div
                                  key={i}
                                  className={`w-3.5 h-3.5 rounded-full shadow-sm transition-colors ${
                                    isDragging ? "bg-amber-500 scale-110" : "bg-[#141010]"
                                  }`}
                                ></div>
                              ))}
                            </div>

                            {/* Inspector Edit / Delete Popover when Selected */}
                            {isSelected && !isDragging && (
                              <div
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                className={`absolute ${popoverLeftClass} ${popoverTopClass} w-[260px] bg-white border border-[#e7e5e4] rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 cursor-default`}
                              >
                                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#e7e5e4]">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-xs text-[#5e5e5e]">
                                      Table nr
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-stone-100 rounded text-[11px] font-mono font-bold text-stone-700">
                                      {table.tableNumber}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-semibold px-2.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-200">
                                      Ready
                                    </span>
                                    <button
                                      onClick={() => {
                                        setCanvasSelectedTableId(null);
                                        setActiveActionTableId(table._id);
                                      }}
                                      className="p-1 text-[#5e5e5e] hover:text-[#0c0a09] rounded-md transition cursor-pointer"
                                      title="Close"
                                      type="button"
                                    >
                                      <CloseIcon className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-y-2 text-[11px] text-[#5e5e5e] mb-4">
                                  <div>
                                    <span className="text-[#98928e] block text-[10px]">Capacity</span>
                                    <strong className="font-bold text-[#0c0a09]">
                                      {table.seatingCapacity} Persons
                                    </strong>
                                  </div>
                                  <div>
                                    <span className="text-[#98928e] block text-[10px]">Area</span>
                                    <strong className="font-bold text-[#0c0a09]">
                                      {selectedLayout?.name}
                                    </strong>
                                  </div>
                                  <div>
                                    <span className="text-[#98928e] block text-[10px]">Kids Seat</span>
                                    <span className="text-[#0c0a09] font-medium">{table.kidsSeatAvailability ? "Yes" : "No"}</span>
                                  </div>
                                  <div>
                                    <span className="text-[#98928e] block text-[10px]">Disabled Seat</span>
                                    <span className="text-[#0c0a09] font-medium">{table.disabledSeatAvailability ? "Yes" : "No"}</span>
                                  </div>
                                  <div className="col-span-2">
                                    <span className="text-[#98928e] block text-[10px]">Barbeque Grills</span>
                                    <span className="text-[#0c0a09] font-medium">{table.barbequeGrillAvailability ? "Yes" : "No"}</span>
                                  </div>
                                </div>

                                {/* Edit and Delete Actions */}
                                <div className="flex items-center justify-end gap-3 pt-2.5 border-t border-[#e7e5e4]">
                                  <button
                                    onClick={() => handleDeleteTableClick(table)}
                                    className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors cursor-pointer"
                                    type="button"
                                  >
                                    Delete
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditTable(table)}
                                    className="text-xs font-semibold text-[#0c0a09] bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                                    type="button"
                                  >
                                    Edit Table
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Canvas Footer */}
                <footer className="bg-white px-5 py-2.5 border-t border-[#e7e5e4] flex items-center justify-between text-xs text-[#5e5e5e]">
                  <span className="flex items-center">
                    <InfoIcon className="w-4 h-4 mr-2 text-[#5e5e5e]" />
                    Click any table to view seating info, drag to reposition, or switch to Table List to edit details.
                  </span>
                  <span className="font-mono text-[11px] text-[#5e5e5e]">
                    {canvasSelectedTable
                      ? `X: ${canvasSelectedTable.xPosition || 80}px Y: ${canvasSelectedTable.yPosition || 80}px • Auto-saved`
                      : "Auto-saved"}
                  </span>
                </footer>
              </section>
            )}

            {/* ------------------------------------------
                SUB-VIEW B: TABLE LIST (DATA GRID)
            ------------------------------------------ */}
            {tablesViewMode === "list" && (
              <div className="space-y-4">
                {tablesInSelectedLayout.length === 0 ? (
                  <div className="min-h-[460px] bg-white rounded-2xl border border-[#eae3df] shadow-sm flex flex-col items-center justify-center p-12 text-center relative overflow-hidden">
                    {/* Subtle architectural floor background pattern */}
                    <div
                      className="absolute inset-0 opacity-[0.035] pointer-events-none"
                      style={{
                        backgroundImage: "radial-gradient(#0c0a09 1px, transparent 1px)",
                        backgroundSize: "24px 24px",
                      }}
                    ></div>

                    <div className="relative z-10 max-w-md flex flex-col items-center">
                      {/* Geometric Blueprint Table Illustration */}
                      <div className="w-20 h-20 rounded-2xl bg-[#faf2ee] border border-[#e4dcda] flex items-center justify-center mb-6 shadow-sm">
                        <svg
                          className="w-10 h-10 text-[#0c0a09] stroke-[1.25]"
                          fill="none"
                          viewBox="0 0 48 48"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          {/* Central Dining Table Blueprint */}
                          <rect fill="#fff" height="20" rx="3" stroke="currentColor" strokeDasharray="2 2" width="20" x="14" y="14"></rect>
                          {/* Surrounding chairs representing layout */}
                          <rect fill="currentColor" height="3" rx="1.5" stroke="currentColor" width="10" x="19" y="8"></rect>
                          <rect fill="currentColor" height="3" rx="1.5" stroke="currentColor" width="10" x="19" y="37"></rect>
                          <rect fill="currentColor" height="10" rx="1.5" stroke="currentColor" width="3" x="8" y="19"></rect>
                          <rect fill="currentColor" height="10" rx="1.5" stroke="currentColor" width="3" x="37" y="19"></rect>
                          {/* Center table accent dot */}
                          <circle cx="24" cy="24" fill="currentColor" r="2"></circle>
                        </svg>
                      </div>

                      {/* Empty State Copy */}
                      <h2 className="font-garamond text-[24px] leading-snug font-normal text-[#141010] mb-2">
                        No tables in this layout yet
                      </h2>
                      <p className="text-sm font-light text-[#5e5e5e] max-w-sm leading-relaxed mb-7">
                        Add your first table to start building the seating layout for{" "}
                        <strong className="font-medium text-[#141010]">{selectedLayout?.name || "this layout"}</strong>.
                      </p>

                      {/* Primary CTA Button */}
                      <button
                        onClick={handleOpenAddTable}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0c0a09] text-white text-xs tracking-wider uppercase font-semibold hover:bg-neutral-800 transition-all shadow hover:shadow-md mb-8 cursor-pointer"
                        type="button"
                      >
                        <PlusIcon className="w-3.5 h-3.5 stroke-[2] text-white stroke-white" />
                        <span className="text-white font-semibold" style={{ color: "#ffffff" }}>
                          Add new table
                        </span>
                      </button>

                      {/* Subtle Helper Notice */}
                      <div className="pt-6 border-t border-[#eae3df]/70 w-full">
                        <p className="text-[12.5px] leading-relaxed text-[#8a8580] font-light">
                          You can place tables visually using the{" "}
                          <span
                            onClick={() => setTablesViewMode("designer")}
                            className="text-[#141010] font-normal underline underline-offset-2 decoration-[#eae3df] hover:decoration-[#141010] cursor-pointer"
                          >
                            Table Designer
                          </span>{" "}
                          or manage them directly from Table List once created.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <section className="bg-white border border-[#e7e5e4] rounded-2xl shadow-sm overflow-hidden flex flex-col" data-purpose="table-list-card">
                    <div className="overflow-auto max-h-[580px]">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#e7e5e4] bg-[#faf9f7] text-[11px] font-mono tracking-wider uppercase text-[#78716c]">
                            <th className="py-3.5 px-6 font-semibold" scope="col">TABLE</th>
                            <th className="py-3.5 px-6 font-semibold" scope="col">CAPACITY</th>
                            <th className="py-3.5 px-6 font-semibold" scope="col">KIDS SEAT</th>
                            <th className="py-3.5 px-6 font-semibold" scope="col">DISABLED SEAT</th>
                            <th className="py-3.5 px-6 font-semibold" scope="col">BARBEQUE GRILL</th>
                            <th className="py-3.5 px-6 text-right font-semibold" scope="col">ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f5f4f0] text-[13px] text-[#1c1917]">
                          {tablesInSelectedLayout.map((table) => {
                            const isBooth = table.tableNumber.toLowerCase().includes("booth") || table.tableNumber.toUpperCase().startsWith("B");
                            const initials = table.tableNumber.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "T1";
                            const defaultPlacement = isBooth ? "Wall Banquette" : table.tableNumber.toLowerCase().includes("round") ? "Round Center" : "Standard Dining Table";

                            return (
                              <tr
                                key={table._id}
                                onClick={() => handleOpenEditTable(table)}
                                className="hover:bg-[#faf2ee]/70 transition-colors group cursor-pointer"
                                title="Click to edit table details"
                              >
                                <td className="py-3.5 px-6 font-medium text-[#0c0a09]">
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`w-7 h-7 rounded-md flex items-center justify-center font-mono text-[11px] font-semibold shrink-0 ${
                                        isBooth
                                          ? "bg-[#292524] text-[#f5f5f4]"
                                          : "bg-[#f0eee9] text-[#1c1917] border border-[#e7e5e4]"
                                      }`}
                                    >
                                      {initials}
                                    </div>
                                    <div>
                                      <span className="font-semibold block text-[#0c0a09] leading-tight group-hover:underline decoration-[#d6d3d1]">{table.tableNumber}</span>
                                      <span className="text-[11px] text-[#a8a29e] font-normal">
                                        {table.placement || defaultPlacement}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3.5 px-6 font-medium">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] bg-[#f5f4f0] text-[#44403c] font-medium border border-stone-200/60">
                                    {table.seatingCapacity} Persons
                                  </span>
                                </td>
                                <td className="py-3.5 px-6">
                                  {table.kidsSeatAvailability ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-[#ecfdf5] text-[#065f46] font-medium border border-emerald-200/60">
                                      Yes
                                    </span>
                                  ) : (
                                    <span className="text-[#a8a29e]">No</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-6">
                                  {table.disabledSeatAvailability ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-[#ecfdf5] text-[#065f46] font-medium border border-emerald-200/60">
                                      Yes
                                    </span>
                                  ) : (
                                    <span className="text-[#a8a29e]">No</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-6">
                                  {table.barbequeGrillAvailability ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-[#ecfdf5] text-[#065f46] font-medium border border-emerald-200/60">
                                      Yes
                                    </span>
                                  ) : (
                                    <span className="text-[#a8a29e]">No</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-6 text-right">
                                  <div className="inline-flex items-center gap-2 justify-end">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenEditTable(table);
                                      }}
                                      className="px-2.5 py-1 text-xs font-medium text-[#0c0a09] bg-[#f5f4f0] hover:bg-[#e7e5e4] rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                      title="Edit Table"
                                      type="button"
                                    >
                                      <PencilIcon className="w-3.5 h-3.5 text-[#0c0a09]" />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteTableClick(table);
                                      }}
                                      className="px-2.5 py-1 text-xs font-medium text-[#dc2626] bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                      title="Delete Table"
                                      type="button"
                                    >
                                      <TrashIcon className="w-3.5 h-3.5 text-[#dc2626]" />
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Table Summary & Metric Bar */}
                    <div className="px-6 py-3.5 bg-[#faf9f7] border-t border-[#e7e5e4] flex items-center justify-between text-[12px] text-[#78716c]">
                      <div className="flex items-center gap-2">
                        <span>
                          Showing <span className="font-semibold text-[#0c0a09]">{tablesInSelectedLayout.length} tables</span> in {selectedLayout?.name || "this layout"}
                        </span>
                        <span className="text-[#d6d3d1]">•</span>
                        <span>
                          Total seating capacity: <span className="font-semibold text-[#0c0a09]">{totalSeatsInSelectedLayout} seats</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[11px] text-[#a8a29e] font-mono">Synchronized with Table Designer</span>
                        <div className="flex items-center gap-1">
                          <button className="px-2 py-1 border border-[#e7e5e4] bg-white rounded text-[#d6d3d1] cursor-not-allowed" disabled type="button">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
                          </button>
                          <button className="px-2 py-1 border border-[#e7e5e4] bg-white rounded text-[#d6d3d1] cursor-not-allowed" disabled type="button">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* Secondary Info Note Callout */}
                <aside className="p-3.5 bg-[#f5f4f0] border border-[#e7e5e4] rounded-lg flex items-center gap-3" data-purpose="status-callout">
                  <InfoIcon className="w-4 h-4 text-[#78716c] flex-shrink-0" />
                  <p className="text-[12px] text-[#57534e]">
                    Switch back to <span className="font-medium text-[#1c1917]">Table Designer</span> anytime to re-arrange floor grid positions or inspect live visual seating reservations.
                  </p>
                </aside>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==========================================
          DRAWERS & MODALS
      ========================================== */}

      {/* ------------------------------------------
          1. ADD LAYOUT DRAWER
      ------------------------------------------ */}
      {showAddLayoutDrawer && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1.5px] transition-opacity duration-300 flex justify-end">
          <div className="w-[440px] max-w-full h-full bg-white border-l border-[#e7e5e4] shadow-2xl flex flex-col justify-between relative animate-in slide-in-from-right duration-300">
            <div className="flex-1 overflow-y-auto">
              <div className="p-8 pb-6 border-b border-stone-100 relative">
                <button
                  onClick={() => setShowAddLayoutDrawer(false)}
                  className="absolute top-7 right-7 text-[#5e5e5e] hover:text-[#0c0a09] w-8 h-8 rounded-full flex items-center justify-center hover:bg-stone-100 transition cursor-pointer"
                  type="button"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
                <h2 className="font-garamond text-[26px] font-normal leading-tight text-[#0c0a09]">
                  Add layout
                </h2>
                <p className="text-[13px] text-[#5e5e5e] mt-1.5 font-normal">
                  Create a new dining section or floor area for your venue.
                </p>
              </div>

              <form onSubmit={handleSaveLayout} className="p-8 space-y-6" id="add-layout-form">
                {layoutErrorMessage && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                    {layoutErrorMessage}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-[11px] uppercase font-semibold tracking-wider text-[#5e5e5e]" htmlFor="layout-name">
                    Layout name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="layout-name"
                    type="text"
                    value={layoutNameInput}
                    onChange={(e) => setLayoutNameInput(e.target.value)}
                    placeholder="Enter layout name"
                    className="w-full h-[44px] px-3.5 bg-white border border-[#e7e5e4] rounded-lg text-sm text-[#0c0a09] placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#0c0a09] focus:border-[#0c0a09] transition shadow-sm"
                    required
                  />
                  <p className="text-[12px] text-[#5e5e5e]">
                    Use a name such as Main Dining, Outdoor or Rooftop.
                  </p>
                </div>

                <div className="bg-[#f7f3f2] border border-[#e7e5e4] rounded-lg p-4 text-[12px] text-[#0c0a09] leading-relaxed flex items-start gap-3">
                  <InfoIcon className="w-4 h-4 text-[#5e5e5e] mt-0.5 shrink-0" />
                  <span>
                    Layout names must be unique across your organization. Once created, tables can be created and placed inside this dining area.
                  </span>
                </div>
              </form>
            </div>

            <footer className="border-t border-[#e7e5e4] px-8 py-5 bg-white flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={() => setShowAddLayoutDrawer(false)}
                className="font-medium text-sm text-[#0c0a09] bg-white border border-[#e7e5e4] rounded-full px-5 py-2.5 hover:bg-stone-50 transition cursor-pointer"
                type="button"
              >
                Cancel
              </button>
              <button
                disabled={isLayoutSubmitting}
                className="font-medium text-sm text-white bg-[#0c0a09] rounded-full px-6 py-2.5 hover:bg-black transition shadow-sm cursor-pointer disabled:opacity-50"
                form="add-layout-form"
                type="submit"
              >
                <span className="text-white font-medium" style={{ color: "#ffffff" }}>
                  {isLayoutSubmitting ? "Creating..." : "Create"}
                </span>
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ------------------------------------------
          2. EDIT LAYOUT DRAWER
      ------------------------------------------ */}
      {editingLayout && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1.5px] transition-opacity duration-300 flex justify-end">
          <div className="w-[440px] max-w-full h-full bg-white border-l border-[#e7e5e4] shadow-2xl flex flex-col justify-between relative animate-in slide-in-from-right duration-300">
            <div className="flex-1 overflow-y-auto">
              <div className="p-8 pb-6 border-b border-stone-100 relative">
                <button
                  onClick={() => setEditingLayout(null)}
                  className="absolute top-7 right-7 text-[#5e5e5e] hover:text-[#0c0a09] w-8 h-8 rounded-full flex items-center justify-center hover:bg-stone-100 transition cursor-pointer"
                  type="button"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
                <h2 className="font-garamond text-[26px] font-normal leading-tight text-[#0c0a09]">
                  Edit layout
                </h2>
                <p className="text-[13px] text-[#5e5e5e] mt-1.5 font-normal">
                  Modify dining section details and terminal display name.
                </p>
              </div>

              <form onSubmit={handleSaveLayout} className="p-8 space-y-6" id="edit-layout-form">
                {layoutErrorMessage && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                    {layoutErrorMessage}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <label className="block text-[11px] uppercase font-semibold tracking-wider text-[#5e5e5e]" htmlFor="edit-layout-name">
                      Layout name <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] text-[#5e5e5e]">Required</span>
                  </div>
                  <input
                    id="edit-layout-name"
                    type="text"
                    value={layoutNameInput}
                    onChange={(e) => setLayoutNameInput(e.target.value)}
                    placeholder="e.g. Indoor-DineIn"
                    className="w-full h-[44px] px-3.5 bg-white border border-[#e7e5e4] rounded-lg text-sm text-[#0c0a09] placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#0c0a09] focus:border-[#0c0a09] transition shadow-sm"
                    required
                  />
                  <p className="text-[12px] text-[#5e5e5e]">
                    Ex: Bar, Indoor, Outdoor etc
                  </p>
                </div>

                <div className="rounded-lg bg-[#faf9f8] border border-[#e7e5e4] p-4 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-medium text-[#0c0a09]">
                      Currently contains {tableCountByLayout[editingLayout._id] || 0} active tables
                    </span>
                  </div>
                  <div className="pt-3 border-t border-[#e7e5e4]/60 text-[11px] text-[#5e5e5e] flex items-start gap-2 leading-relaxed">
                    <InfoIcon className="w-3.5 h-3.5 text-[#5e5e5e] shrink-0 mt-0.5" />
                    <span>Case-insensitive layout name uniqueness is enforced across your venue terminals.</span>
                  </div>
                </div>
              </form>
            </div>

            <footer className="border-t border-[#e7e5e4] px-8 py-5 bg-white flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={() => setEditingLayout(null)}
                className="font-medium text-sm text-[#0c0a09] bg-white border border-[#e7e5e4] rounded-full px-5 py-2.5 hover:bg-stone-50 transition cursor-pointer"
                type="button"
              >
                Cancel
              </button>
              <button
                disabled={isLayoutSubmitting}
                className="font-medium text-sm text-white bg-[#0c0a09] rounded-full px-6 py-2.5 hover:bg-black transition shadow-sm cursor-pointer disabled:opacity-50"
                form="edit-layout-form"
                type="submit"
              >
                <span className="text-white font-medium" style={{ color: "#ffffff" }}>
                  {isLayoutSubmitting ? "Updating..." : "Update"}
                </span>
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ------------------------------------------
          3. ADD / EDIT TABLE DRAWER
      ------------------------------------------ */}
      {(showAddTableDrawer || editingTable) && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1.5px] transition-opacity duration-300 flex justify-end">
          <div className="w-[440px] max-w-full h-full bg-white border-l border-[#e7e5e4] shadow-2xl flex flex-col justify-between relative animate-in slide-in-from-right duration-300">
            <div className="flex-1 overflow-y-auto">
              <div className="p-8 pb-6 border-b border-stone-100 relative">
                <button
                  onClick={() => {
                    setShowAddTableDrawer(false);
                    setEditingTable(null);
                  }}
                  className="absolute top-7 right-7 text-[#5e5e5e] hover:text-[#0c0a09] w-8 h-8 rounded-full flex items-center justify-center hover:bg-stone-100 transition cursor-pointer"
                  type="button"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
                <p className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#98928e] mb-1">
                  {editingTable ? `EDITING TABLE: ${editingTable.tableNumber}` : "NEW TABLE"}
                </p>
                <h2 className="font-garamond text-[28px] font-normal leading-tight text-[#0c0a09]">
                  {editingTable ? "Edit table" : "Add table"}
                </h2>
                <p className="text-xs text-[#5e5e5e] mt-1 font-normal">
                  {editingTable
                    ? "Update table details and seating options."
                    : "Add a table to your selected dining area."}
                </p>
              </div>

              <form onSubmit={handleSaveTable} className="p-8 space-y-6" id="table-form">
                {tableErrorMessage && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                    {tableErrorMessage}
                  </div>
                )}

                {/* Table Number */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold tracking-wider text-[#5e5e5e] uppercase" htmlFor="table-num">
                    Table number <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    id="table-num"
                    type="text"
                    value={tableNumberInput}
                    onChange={(e) => setTableNumberInput(e.target.value)}
                    placeholder="Enter table number"
                    className="w-full text-xs text-[#0c0a09] placeholder-stone-400 rounded-lg border border-[#e7e5e4] px-3.5 py-2.5 shadow-sm focus:border-[#0c0a09] focus:ring-1 focus:ring-[#0c0a09] transition"
                    required
                  />
                  <p className="text-[11px] text-[#5e5e5e]">
                    Table number is unique within this dining layout.
                  </p>
                </div>

                {/* Seating Capacity */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold tracking-wider text-[#5e5e5e] uppercase" htmlFor="seating-cap">
                    Seating capacity <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    id="seating-cap"
                    type="number"
                    min={1}
                    max={50}
                    value={seatingCapacityInput}
                    onChange={(e) => setSeatingCapacityInput(Number(e.target.value))}
                    placeholder="Enter seating capacity"
                    className="w-full text-xs text-[#0c0a09] placeholder-stone-400 rounded-lg border border-[#e7e5e4] px-3.5 py-2.5 shadow-sm focus:border-[#0c0a09] focus:ring-1 focus:ring-[#0c0a09] transition"
                    required
                  />
                  <p className="text-[11px] text-[#5e5e5e]">
                    Enter the number of seats available at this table.
                  </p>
                </div>

                {/* Select Layout */}
                <div className="space-y-1.5 relative">
                  <label className="block text-[11px] font-semibold tracking-wider text-[#5e5e5e] uppercase">
                    Select layout <span className="text-red-500 font-bold">*</span>
                  </label>
                  
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsDrawerLayoutDropdownOpen(!isDrawerLayoutDropdownOpen)}
                      className="w-full flex items-center justify-between h-[44px] px-3.5 bg-white border border-[#e7e5e4] rounded-lg text-xs text-[#0c0a09] shadow-sm hover:border-[#0c0a09] focus:outline-none focus:ring-1 focus:ring-[#0c0a09] transition cursor-pointer text-left"
                    >
                      <span className="font-medium text-[#0c0a09]">
                        {activeLayoutsList.find((l) => l._id === tableLayoutIdInput)?.name || "-- Select Layout --"}
                      </span>
                      <ChevronDownIcon className={`w-4 h-4 text-[#5e5e5e] transition-transform ${isDrawerLayoutDropdownOpen ? "rotate-180" : ""}`} />
                    </button>

                    {/* Popover Options List */}
                    {isDrawerLayoutDropdownOpen && (
                      <div
                        className="absolute left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-stone-200 p-1.5 z-50 animate-in fade-in duration-100 max-h-52 overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {activeLayoutsList.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-stone-500">
                            No layouts available. Create a layout first.
                          </div>
                        ) : (
                          activeLayoutsList.map((l) => {
                            const isSelected = tableLayoutIdInput === l._id;
                            return (
                              <button
                                key={l._id}
                                type="button"
                                onClick={() => {
                                  setTableLayoutIdInput(l._id);
                                  setIsDrawerLayoutDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                                  isSelected
                                    ? "bg-[#f5efeb] text-[#0c0a09] font-bold"
                                    : "text-[#1c1917] hover:bg-[#faf8f7]"
                                }`}
                              >
                                <span>{l.name}</span>
                                {isSelected && (
                                  <svg className="w-3.5 h-3.5 text-[#0c0a09]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-[#5e5e5e]">
                    Assigns table coordinates and floor availability to this zone.
                  </p>
                </div>

                {/* Table Amenities Checkboxes */}
                <div className="space-y-2">
                  <h3 className="text-[11px] font-bold text-[#5e5e5e] uppercase tracking-wider">
                    Table amenities
                  </h3>
                  <div className="bg-[#faf9f8] border border-[#e7e5e4] rounded-xl p-4 space-y-3">
                    <label className="flex items-center justify-between w-full group cursor-pointer select-none py-0.5">
                      <span className="text-xs text-[#0c0a09] font-medium">
                        Kids seat available
                      </span>
                      <input
                        type="checkbox"
                        checked={kidsSeatInput}
                        onChange={(e) => setKidsSeatInput(e.target.checked)}
                        className="w-4 h-4 rounded border-[#d6d3d1] text-[#0c0a09] focus:ring-0 cursor-pointer accent-[#0c0a09]"
                      />
                    </label>

                    <label className="flex items-center justify-between w-full group cursor-pointer select-none py-0.5">
                      <span className="text-xs text-[#0c0a09] font-medium">
                        Disabled seat available
                      </span>
                      <input
                        type="checkbox"
                        checked={disabledSeatInput}
                        onChange={(e) => setDisabledSeatInput(e.target.checked)}
                        className="w-4 h-4 rounded border-[#d6d3d1] text-[#0c0a09] focus:ring-0 cursor-pointer accent-[#0c0a09]"
                      />
                    </label>

                    <label className="flex items-center justify-between w-full group cursor-pointer select-none py-0.5">
                      <span className="text-xs text-[#0c0a09] font-medium">
                        Barbeque grills available
                      </span>
                      <input
                        type="checkbox"
                        checked={barbequeGrillInput}
                        onChange={(e) => setBarbequeGrillInput(e.target.checked)}
                        className="w-4 h-4 rounded border-[#d6d3d1] text-[#0c0a09] focus:ring-0 cursor-pointer accent-[#0c0a09]"
                      />
                    </label>
                  </div>
                </div>

                {/* Informational Callout Box */}
                <div className="bg-[#faf9f8] border border-[#e7e5e4] rounded-xl p-4 text-[12px] text-[#5e5e5e] leading-relaxed flex items-start gap-3">
                  <InfoIcon className="w-4 h-4 text-[#5e5e5e] shrink-0 mt-0.5" />
                  <span>
                    Changes to capacity and amenities will update seating assignments and waiter handheld indicators immediately across all devices.
                  </span>
                </div>
              </form>
            </div>

            <footer className="p-6 border-t border-[#e7e5e4] bg-white flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={() => {
                  setShowAddTableDrawer(false);
                  setEditingTable(null);
                }}
                className="px-5 py-2.5 text-xs font-medium text-[#0c0a09] bg-white border border-[#e7e5e4] rounded-full hover:bg-stone-50 transition cursor-pointer"
                type="button"
              >
                Cancel
              </button>
              <button
                disabled={isTableSubmitting}
                className="px-6 py-2.5 text-xs font-medium bg-[#0c0a09] rounded-full hover:bg-black transition shadow-sm cursor-pointer disabled:opacity-50"
                form="table-form"
                type="submit"
              >
                <span className="text-white font-medium" style={{ color: "#ffffff" }}>
                  {isTableSubmitting
                    ? editingTable
                      ? "Updating..."
                      : "Creating..."
                    : editingTable
                    ? "Update"
                    : "Create"}
                </span>
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ------------------------------------------
          4. DELETE CONFIRMATION MODAL
      ------------------------------------------ */}
      {deletingTarget && (
        <div className="fixed inset-0 z-50 bg-[#0c0a09]/55 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            aria-labelledby="modal-headline"
            aria-modal="true"
            className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-[480px] p-6 relative z-50 transform transition-all"
            data-purpose="delete-confirmation-modal"
            role="dialog"
          >
            {/* Close Button (X) */}
            <button
              onClick={() => setDeletingTarget(null)}
              aria-label="Close modal"
              className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 p-1.5 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
              type="button"
            >
              <CloseIcon className="w-4 h-4" />
            </button>

            {/* Delete Icon Badge */}
            <div className="mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center border border-red-100">
                <TrashIcon className="w-5 h-5 text-red-500" />
              </div>
            </div>

            {/* Modal Heading & Subject */}
            <div className="space-y-1 mb-4">
              <h2 className="font-garamond text-2xl font-normal text-[#141010] leading-snug" id="modal-headline">
                {deletingTarget.type === "layout" ? "Delete layout?" : "Delete table?"}
              </h2>
              <p className="text-sm font-medium text-[#1c1b1b]">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-stone-900">{deletingTarget.name}</span>?
              </p>
            </div>

            {/* Explanatory Impact Callout Box */}
            <div className="bg-[#faf8f7] border border-stone-200 rounded-xl p-4 text-xs leading-relaxed text-stone-600 space-y-2.5 mb-6">
              {deletingTarget.type === "table" ? (
                <>
                  <div className="flex items-start gap-2">
                    <span className="text-stone-400 font-bold select-none">•</span>
                    <p>
                      This table will no longer be available for seating or orders in{" "}
                      <strong className="text-stone-800 font-medium">
                        {selectedLayout?.name || "this layout"}
                      </strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-stone-400 font-bold select-none">•</span>
                    <p>
                      Table position coordinates and amenity configurations will be permanently cleared from this layout.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-stone-400 font-bold select-none">•</span>
                    <p>
                      Historical orders, guest checks, and KOT records associated with this table will retain their historical audit log.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2">
                    <span className="text-stone-400 font-bold select-none">•</span>
                    <p>
                      This layout zone and floor canvas configuration will be permanently removed.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-stone-400 font-bold select-none">•</span>
                    <p>
                      Tables assigned to this layout must be reassigned before deletion can proceed.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e7e5e4]">
              <button
                onClick={() => setDeletingTarget(null)}
                className="px-5 py-2.5 rounded-full border border-[#e7e5e4] text-xs font-medium text-[#141010] bg-white hover:bg-stone-50 active:bg-stone-100 transition-colors shadow-sm cursor-pointer"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 rounded-full bg-[#dc2626] hover:bg-[#b91c1c] active:bg-[#991b1b] text-white text-xs font-medium transition-colors shadow-sm cursor-pointer"
                type="button"
              >
                {deletingTarget.type === "layout" ? "Delete layout" : "Delete table"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
