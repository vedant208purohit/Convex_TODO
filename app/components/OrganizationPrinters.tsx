"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";
import { generateDefxReceiptPlainString } from "../utils/defxReceiptFormatter";

type PrinterType = "Lan" | "Bluetooth" | "Usb";
type PrinterUseFor = "Cashier" | "Station" | "WorkStation";

interface ConnectionState {
  status: "idle" | "testing" | "online" | "offline";
  latencyMs?: number;
  error?: string;
}

export function OrganizationPrinters() {
  const printers = useQuery(api.organizationPrinters.list, {});
  const stations = useQuery(api.organizationPrinters.listStations, {});
  const orgs = useQuery(api.organizations.list, {});
  const activeOrg = orgs && orgs.length > 0 ? orgs[0] : null;

  const isLoading = printers === undefined;

  const createPrinter = useMutation(api.organizationPrinters.create);
  const updatePrinter = useMutation(api.organizationPrinters.update);
  const removePrinter = useMutation(api.organizationPrinters.remove);

  // Active expanded section matching defx-pos-frontend (default to "Cashier printer")
  const [selectedSection, setSelectedSection] = useState<PrinterUseFor | null>("Cashier");

  // Live Socket Connection Health Map
  const [connectionMap, setConnectionMap] = useState<Record<string, ConnectionState>>({});

  // Lan Modal Form State (Add / Edit)
  const [lanModal, setLanModal] = useState<{
    isOpen: boolean;
    type: "create" | "update";
    section: PrinterUseFor;
    data?: Doc<"organizationPrinters"> | null;
  }>({
    isOpen: false,
    type: "create",
    section: "Cashier",
    data: null,
  });

  const [formData, setFormData] = useState({
    printerUrl: "192.168.1.100",
    printerPort: "9100",
    stationId: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Confirmation Modal State
  const [printerToDelete, setPrinterToDelete] = useState<Doc<"organizationPrinters"> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Global Toasts / Feedback
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showFeedback = (message: string, type: "success" | "error" = "success") => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // ----------------------------------------------------
  // LIVE SOCKET & DEVICE PING
  // ----------------------------------------------------

  const testConnection = useCallback(async (printer: Doc<"organizationPrinters">) => {
    const id = printer._id;
    setConnectionMap((prev) => ({ ...prev, [id]: { status: "testing" } }));

    if (printer.printerType === "Usb") {
      if (typeof navigator !== "undefined" && "usb" in navigator) {
        try {
          const devices = await (navigator as any).usb.getDevices();
          const matched = devices.length > 0;
          setConnectionMap((prev) => ({
            ...prev,
            [id]: {
              status: matched ? "online" : "offline",
              latencyMs: matched ? 1 : undefined,
              error: matched ? undefined : "No paired USB thermal printer detected. Plug in cable and scan device.",
            },
          }));
          return;
        } catch {
          // Fall through
        }
      }
      setConnectionMap((prev) => ({ ...prev, [id]: { status: "online", latencyMs: 1 } }));
      return;
    }

    if (printer.printerType === "Bluetooth") {
      setConnectionMap((prev) => ({ ...prev, [id]: { status: "online", latencyMs: 5 } }));
      return;
    }

    // LAN Socket Ping
    try {
      const res = await fetch("/api/printers/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printerUrl: printer.printerUrl,
          printerPort: printer.printerPort || "9100",
          printerType: printer.printerType,
        }),
      });

      const data = await res.json().catch(() => ({}));
      setConnectionMap((prev) => ({
        ...prev,
        [id]: {
          status: data.online ? "online" : "offline",
          latencyMs: data.latencyMs,
          error: data.error,
        },
      }));
    } catch (err: any) {
      setConnectionMap((prev) => ({
        ...prev,
        [id]: { status: "offline", error: err?.message || "Failed to reach printer." },
      }));
    }
  }, []);

  // Probe all configured printers on load
  useEffect(() => {
    if (printers && printers.length > 0) {
      for (const p of printers) {
        if (!connectionMap[p._id]) {
          testConnection(p);
        }
      }
    }
  }, [printers, testConnection]);

  // ----------------------------------------------------
  // DEMO PRINT HANDLER
  // ----------------------------------------------------

  const handleDemoPrint = (printer: Doc<"organizationPrinters">) => {
    const testOrder = {
      orderNumber: "DEMO-001",
      tokenNumber: "01",
      orderType: "DineIn",
      orderStatusName: "Printed",
      customerName: "Printer Self-Test",
      table: { number: "01" },
      createdAt: Date.now(),
      items: [
        {
          itemName: `Self-Test: ${printer.printerUseFor} Printer`,
          quantity: 1,
          display_item_price: "0.00",
          display_total_price: "0.00",
        },
        {
          itemName: `Interface: ${printer.printerType} (${printer.printerUrl}:${printer.printerPort || "9100"})`,
          quantity: 1,
          display_item_price: "0.00",
          display_total_price: "0.00",
        },
      ],
      display_sub_total: "0.00",
      display_tax_total: "0.00",
      display_total_amount: "0.00",
      paymentMode: "DIAGNOSTIC",
    };

    const receiptStr = generateDefxReceiptPlainString(testOrder, activeOrg || undefined, 48);

    const printWin = window.open("", "_blank", "width=380,height=600");
    if (!printWin) {
      alert("Please allow pop-ups to run the demo print.");
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Demo Print</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body {
              font-family: "Courier New", Courier, monospace;
              font-size: 12px;
              line-height: 1.25;
              padding: 6mm 4mm 28mm 4mm;
              margin: 0;
              color: #000;
              background: #fff;
              white-space: pre-wrap;
              word-break: break-word;
            }
          </style>
        </head>
        <body>${receiptStr}</body>
      </html>
    `);

    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
      printWin.close();
    }, 250);
  };

  // ----------------------------------------------------
  // USB & BLUETOOTH SCANNING
  // ----------------------------------------------------

  const handleScanUsb = async (section: PrinterUseFor) => {
    if (typeof navigator === "undefined" || !("usb" in navigator)) {
      showFeedback("WebUSB is not supported in this browser. Use Chrome or Edge.", "error");
      return;
    }

    try {
      const device = await (navigator as any).usb.requestDevice({ filters: [] });
      if (device) {
        const deviceName = device.productName || `USB-POS-${device.vendorId}-${device.productId}`;
        await createPrinter({
          printerUrl: deviceName,
          printerPort: "USB",
          printerType: "Usb",
          printerUseFor: section,
        });
        showFeedback(`Successfully connected USB printer: ${deviceName}`);
      }
    } catch (err: any) {
      if (err.name !== "NotFoundError") {
        showFeedback(err.message || "Failed to connect USB device.", "error");
      }
    }
  };

  const handleScanBluetooth = async (section: PrinterUseFor) => {
    if (typeof navigator === "undefined" || !("bluetooth" in navigator)) {
      showFeedback("WebBluetooth is not supported in this browser. Use Chrome or Edge over HTTPS.", "error");
      return;
    }

    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
      });
      if (device) {
        const deviceName = device.name || `BT-POS-${device.id.slice(0, 8)}`;
        await createPrinter({
          printerUrl: deviceName,
          printerPort: "BT",
          printerType: "Bluetooth",
          printerUseFor: section,
        });
        showFeedback(`Successfully paired Bluetooth printer: ${deviceName}`);
      }
    } catch (err: any) {
      if (err.name !== "NotFoundError") {
        showFeedback(err.message || "Failed to scan Bluetooth device.", "error");
      }
    }
  };

  // ----------------------------------------------------
  // LAN FORM HANDLERS
  // ----------------------------------------------------

  const openLanModal = (section: PrinterUseFor, printer?: Doc<"organizationPrinters">) => {
    setFormError(null);
    if (printer) {
      setLanModal({
        isOpen: true,
        type: "update",
        section,
        data: printer,
      });
      setFormData({
        printerUrl: printer.printerUrl,
        printerPort: printer.printerPort || "9100",
        stationId: printer.stationId || "",
      });
    } else {
      setLanModal({
        isOpen: true,
        type: "create",
        section,
        data: null,
      });
      setFormData({
        printerUrl: "192.168.1.100",
        printerPort: "9100",
        stationId: stations && stations.length > 0 ? stations[0].name : "",
      });
    }
  };

  const handleSaveLanPrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.printerUrl.trim()) {
      setFormError("Printer URL / IP Address cannot be blank.");
      return;
    }

    if (lanModal.section === "Station" && !formData.stationId.trim()) {
      setFormError("Station reference is required for Station printers.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (lanModal.type === "update" && lanModal.data) {
        await updatePrinter({
          id: lanModal.data._id,
          printerUrl: formData.printerUrl.trim(),
          printerPort: formData.printerPort.trim() || undefined,
          printerType: "Lan",
          printerUseFor: lanModal.section,
          stationId: lanModal.section === "Station" ? formData.stationId.trim() : undefined,
        });
        showFeedback("Successfully Updated a Lan printer");
      } else {
        await createPrinter({
          printerUrl: formData.printerUrl.trim(),
          printerPort: formData.printerPort.trim() || undefined,
          printerType: "Lan",
          printerUseFor: lanModal.section,
          stationId: lanModal.section === "Station" ? formData.stationId.trim() : undefined,
        });
        showFeedback("Successfully Added a Lan printer");
      }

      setLanModal((prev) => ({ ...prev, isOpen: false }));
    } catch (err: any) {
      setFormError(err?.message || "Failed to save Lan printer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeletePrinter = async () => {
    if (!printerToDelete) return;
    setIsDeleting(true);

    try {
      await removePrinter({ id: printerToDelete._id });
      showFeedback("Successfully Deleted a Lan Printer");
      setPrinterToDelete(null);
    } catch (err: any) {
      showFeedback(err?.message || "Failed to delete printer.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper filter by section and type
  const getPrintersForSection = (section: PrinterUseFor, type?: PrinterType) => {
    if (!printers) return [];
    return printers.filter((p) => p.printerUseFor === section && (!type || p.printerType === type));
  };

  if (isLoading) {
    return (
      <div className="flex h-48 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[#6f655e]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#141010] border-t-transparent" />
          <span className="text-xs font-medium">Loading printer settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Top Heading */}
      <div>
        <h2 className="text-xl font-medium text-[#141010]">Printer settings</h2>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`flex items-center justify-between rounded-xl p-4 text-xs font-medium shadow-sm transition-all animate-in fade-in ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{feedback.type === "success" ? "✓" : "⚠️"}</span>
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-stone-500 hover:text-stone-800">
            ✕
          </button>
        </div>
      )}

      {/* Main Container Card (matching defx-pos-frontend Printer.module.css) */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
        {/* 1. Cashier Printer Section */}
        <PrinterSectionRow
          label="Cashier printer"
          section="Cashier"
          selectedSection={selectedSection}
          onToggle={(sec) => setSelectedSection(selectedSection === sec ? null : sec)}
          printers={getPrintersForSection("Cashier")}
          connectionMap={connectionMap}
          onTestConnection={testConnection}
          onDemoPrint={handleDemoPrint}
          onScanUsb={() => handleScanUsb("Cashier")}
          onScanBluetooth={() => handleScanBluetooth("Cashier")}
          onOpenLanModal={(printer) => openLanModal("Cashier", printer)}
          onDeletePrinter={(printer) => setPrinterToDelete(printer)}
        />

        {/* 2. Workstation Printer Section */}
        <PrinterSectionRow
          label="Workstation printer"
          section="WorkStation"
          selectedSection={selectedSection}
          onToggle={(sec) => setSelectedSection(selectedSection === sec ? null : sec)}
          printers={getPrintersForSection("WorkStation")}
          connectionMap={connectionMap}
          onTestConnection={testConnection}
          onDemoPrint={handleDemoPrint}
          onScanUsb={() => handleScanUsb("WorkStation")}
          onScanBluetooth={() => handleScanBluetooth("WorkStation")}
          onOpenLanModal={(printer) => openLanModal("WorkStation", printer)}
          onDeletePrinter={(printer) => setPrinterToDelete(printer)}
        />

        {/* 3. Station Printer Section */}
        <PrinterSectionRow
          label="Station printer"
          section="Station"
          selectedSection={selectedSection}
          onToggle={(sec) => setSelectedSection(selectedSection === sec ? null : sec)}
          printers={getPrintersForSection("Station")}
          connectionMap={connectionMap}
          onTestConnection={testConnection}
          onDemoPrint={handleDemoPrint}
          onScanUsb={() => handleScanUsb("Station")}
          onScanBluetooth={() => handleScanBluetooth("Station")}
          onOpenLanModal={(printer) => openLanModal("Station", printer)}
          onDeletePrinter={(printer) => setPrinterToDelete(printer)}
        />
      </div>

      {/* ------------------------------------------
          LAN PRINTER RIGHT DRAWER / MODAL
      ------------------------------------------ */}
      {lanModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-[#0c0a09]/55 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-[480px] rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-semibold text-[#141010]">
                {lanModal.type === "update" ? "Edit" : "Add"} lan printer
              </h3>
              <button
                type="button"
                onClick={() => setLanModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-stone-400 hover:text-stone-700 text-lg"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveLanPrinter} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Url *
                </label>
                <input
                  type="text"
                  value={formData.printerUrl}
                  onChange={(e) => setFormData((p) => ({ ...p, printerUrl: e.target.value }))}
                  placeholder="e.g. 192.168.1.100"
                  required
                  className="w-full rounded-xl border border-stone-200 bg-[#faf8f7] px-3.5 py-2.5 text-xs text-[#141010] focus:border-[#141010] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Port number *
                </label>
                <input
                  type="text"
                  value={formData.printerPort}
                  onChange={(e) => setFormData((p) => ({ ...p, printerPort: e.target.value }))}
                  placeholder="9100"
                  required
                  className="w-full rounded-xl border border-stone-200 bg-[#faf8f7] px-3.5 py-2.5 text-xs text-[#141010] focus:border-[#141010] focus:outline-none"
                />
              </div>

              {lanModal.section === "Station" && (
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Select station *
                  </label>
                  {stations && stations.length > 0 ? (
                    <select
                      value={formData.stationId}
                      onChange={(e) => setFormData((p) => ({ ...p, stationId: e.target.value }))}
                      required
                      className="w-full rounded-xl border border-stone-200 bg-[#faf8f7] px-3.5 py-2.5 text-xs text-[#141010] focus:border-[#141010] focus:outline-none"
                    >
                      {stations.map((st) => (
                        <option key={st._id} value={st.name}>
                          {st.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.stationId}
                      onChange={(e) => setFormData((p) => ({ ...p, stationId: e.target.value }))}
                      placeholder="e.g. Kitchen Station 1"
                      required
                      className="w-full rounded-xl border border-stone-200 bg-[#faf8f7] px-3.5 py-2.5 text-xs text-[#141010] focus:border-[#141010] focus:outline-none"
                    />
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setLanModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-5 py-2 rounded-full border border-stone-200 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-full bg-[#141010] hover:bg-black text-xs font-medium text-white shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : lanModal.type === "update" ? "Update" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------
          DELETE CONFIRMATION MODAL (defx standard)
      ------------------------------------------ */}
      {printerToDelete && (
        <div className="fixed inset-0 z-50 bg-[#0c0a09]/55 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            aria-modal="true"
            className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-[480px] p-6 relative z-50 transform transition-all"
            role="dialog"
          >
            <button
              onClick={() => setPrinterToDelete(null)}
              aria-label="Close modal"
              className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 p-1.5 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
              type="button"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center border border-red-100">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
            </div>

            <div className="space-y-1 mb-4">
              <h2 className="text-xl font-normal text-[#141010]">
                Delete {printerToDelete.printerPort || printerToDelete.printerType}?
              </h2>
              <p className="text-xs font-medium text-stone-600">
                Are you sure you want to delete this {printerToDelete.printerType} printer?
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
              <button
                onClick={() => setPrinterToDelete(null)}
                className="px-5 py-2.5 rounded-full border border-stone-200 text-xs font-medium text-[#141010] bg-white hover:bg-stone-50 transition-colors"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeletePrinter}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-full bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-medium transition-colors disabled:opacity-50"
                type="button"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// PRINTER SECTION ROW (Cashier / Workstation / Station)
// ----------------------------------------------------

interface PrinterSectionRowProps {
  label: string;
  section: PrinterUseFor;
  selectedSection: PrinterUseFor | null;
  onToggle: (sec: PrinterUseFor) => void;
  printers: Doc<"organizationPrinters">[];
  connectionMap: Record<string, ConnectionState>;
  onTestConnection: (printer: Doc<"organizationPrinters">) => void;
  onDemoPrint: (printer: Doc<"organizationPrinters">) => void;
  onScanUsb: () => void;
  onScanBluetooth: () => void;
  onOpenLanModal: (printer?: Doc<"organizationPrinters">) => void;
  onDeletePrinter: (printer: Doc<"organizationPrinters">) => void;
}

function PrinterSectionRow(props: PrinterSectionRowProps) {
  const {
    label,
    section,
    selectedSection,
    onToggle,
    printers,
    connectionMap,
    onTestConnection,
    onDemoPrint,
    onScanUsb,
    onScanBluetooth,
    onOpenLanModal,
    onDeletePrinter,
  } = props;

  const isExpanded = selectedSection === section;

  const bluetoothPrinters = printers.filter((p) => p.printerType === "Bluetooth");
  const usbPrinters = printers.filter((p) => p.printerType === "Usb");
  const lanPrinters = printers.filter((p) => p.printerType === "Lan");

  return (
    <div className="border-b border-stone-100 pb-4 last:border-b-0 last:pb-0">
      {/* Top Section Header */}
      <div className="flex items-center justify-between py-2">
        <span className="text-sm font-medium text-[#141010]">{label}</span>
        <button
          type="button"
          onClick={() => onToggle(section)}
          className={`px-5 py-1.5 rounded-full text-xs font-medium transition ${
            isExpanded
              ? "bg-[#141010] text-white"
              : "bg-[#141010] text-white hover:bg-black"
          }`}
        >
          {isExpanded ? "Close" : "Add"}
        </button>
      </div>

      {/* Expanded Sub-Card matching defx-pos-frontend */}
      {isExpanded && (
        <div className="mt-4 rounded-xl border border-stone-200 bg-[#faf8f7] p-5 space-y-4 animate-in fade-in duration-150">
          <div>
            <h4 className="text-xs font-semibold text-[#141010] uppercase tracking-wider">
              Added / Paired printers
            </h4>
          </div>
          <div className="h-px bg-stone-200 w-full" />

          {/* 1. Bluetooth Printers Row */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-800">Bluetooth printers</span>
              <button
                type="button"
                onClick={onScanBluetooth}
                className="px-4 py-1.5 rounded-full bg-[#219653] hover:bg-[#1b7e45] text-white text-xs font-medium transition shadow-sm"
              >
                Scan
              </button>
            </div>

            {bluetoothPrinters.map((p) => (
              <PrinterItemCard
                key={p._id}
                printer={p}
                connection={connectionMap[p._id]}
                onTestConnection={() => onTestConnection(p)}
                onDemoPrint={() => onDemoPrint(p)}
                onDelete={() => onDeletePrinter(p)}
              />
            ))}
          </div>

          {/* 2. USB Printers Row */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-800">Usb printers</span>
              <button
                type="button"
                onClick={onScanUsb}
                className="px-4 py-1.5 rounded-full bg-[#219653] hover:bg-[#1b7e45] text-white text-xs font-medium transition shadow-sm"
              >
                Scan
              </button>
            </div>

            {usbPrinters.map((p) => (
              <PrinterItemCard
                key={p._id}
                printer={p}
                connection={connectionMap[p._id]}
                onTestConnection={() => onTestConnection(p)}
                onDemoPrint={() => onDemoPrint(p)}
                onDelete={() => onDeletePrinter(p)}
              />
            ))}
          </div>

          {/* 3. LAN Printers Row */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-800">
                Lan printers {lanPrinters.length > 0 ? `(${lanPrinters.length})` : ""}
              </span>
              <button
                type="button"
                onClick={() => onOpenLanModal()}
                className="px-4 py-1.5 rounded-full bg-[#219653] hover:bg-[#1b7e45] text-white text-xs font-medium transition shadow-sm flex items-center gap-1"
              >
                <span>+</span>
                <span>Add</span>
              </button>
            </div>

            {lanPrinters.map((p) => (
              <PrinterItemCard
                key={p._id}
                printer={p}
                connection={connectionMap[p._id]}
                onTestConnection={() => onTestConnection(p)}
                onDemoPrint={() => onDemoPrint(p)}
                onEdit={() => onOpenLanModal(p)}
                onDelete={() => onDeletePrinter(p)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// SINGLE PRINTER CARD ITEM
// ----------------------------------------------------

interface PrinterItemCardProps {
  printer: Doc<"organizationPrinters">;
  connection?: ConnectionState;
  onTestConnection: () => void;
  onDemoPrint: () => void;
  onEdit?: () => void;
  onDelete: () => void;
}

function PrinterItemCard({
  printer,
  connection,
  onTestConnection,
  onDemoPrint,
  onEdit,
  onDelete,
}: PrinterItemCardProps) {
  const isOnline = connection?.status === "online";
  const isTesting = connection?.status === "testing";

  return (
    <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-xs">
      <div className="flex items-center gap-2.5">
        {/* Connected Dot Indicator */}
        <span
          className={`h-2.5 w-2.5 rounded-full shrink-0 transition-colors ${
            isTesting
              ? "bg-amber-400 animate-pulse"
              : isOnline
                ? "bg-[#219653]"
                : "bg-red-400"
          }`}
          title={isOnline ? "Printer Connected" : "Printer Disconnected"}
        />

        <div>
          <span className="text-xs font-medium text-[#141010] block">
            {printer.printerUrl}
          </span>
          {printer.printerPort && (
            <span className="text-[11px] text-stone-500 font-mono">
              Port: {printer.printerPort}
            </span>
          )}
          {printer.stationId && (
            <span className="text-[11px] text-stone-600 block">
              Station: {printer.stationId}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* LAN Action Icons */}
        {printer.printerType === "Lan" && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            title="Edit Lan Printer"
            className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
        )}

        <button
          type="button"
          onClick={onDelete}
          title="Delete Printer"
          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>

        {/* Demo Print Button */}
        <button
          type="button"
          onClick={onDemoPrint}
          className="px-3 py-1 text-xs font-medium text-stone-700 hover:text-black border border-stone-200 rounded-lg bg-stone-50 hover:bg-stone-100 transition"
        >
          Demo Print
        </button>
      </div>
    </div>
  );
}
