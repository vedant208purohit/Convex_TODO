"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";
import {
  generateDefxReceiptPlainString,
  generateDefxKotPlainString,
  printThermalReceiptDocument,
} from "../utils/defxReceiptFormatter";
import { Toast, type ToastMessage, type ToastType } from "./Toast";

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

  // Active expanded section matching defx-pos-frontend (default to "Cashier")
  const [selectedSection, setSelectedSection] = useState<PrinterUseFor | null>("Cashier");

  // Live Socket Connection Health Map
  const [connectionMap, setConnectionMap] = useState<Record<string, ConnectionState>>({});

  // Slide-over Right Drawer Form State (Add / Edit LAN printer)
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

  // Standard Menu Toast Notification State (Top Right)
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (
    message: string,
    type: ToastType = "success",
    subtext?: string
  ) => {
    setToast({ message, type, subtext });
  };

  const showFeedback = (
    message: string,
    type: "success" | "error" = "success",
    subtext?: string
  ) => {
    showToast(message, type, subtext);
  };

  // ----------------------------------------------------
  // LIVE SOCKET & DEVICE PING
  // ----------------------------------------------------

  const testConnection = useCallback(async (printer: Doc<"organizationPrinters">, isSilent = false) => {
    const id = printer._id;
    if (!isSilent) {
      setConnectionMap((prev) => {
        if (prev[id]?.status === "online" || prev[id]?.status === "offline") {
          return prev; // Retain current status quietly during background checks
        }
        return { ...prev, [id]: { status: "testing" } };
      });
    }

    // 1. BLUETOOTH PRINTER: Browser Check + Local Machine Hardware Probe
    if (printer.printerType === "Bluetooth" || printer.printerPort === "BT") {
      if (typeof navigator !== "undefined" && "bluetooth" in navigator) {
        try {
          const isAvailable = await (navigator as any).bluetooth.getAvailability?.();
          if (isAvailable === false) {
            setConnectionMap((prev) => ({
              ...prev,
              [id]: {
                status: "offline",
                error: "Bluetooth is turned OFF in computer settings.",
              },
            }));
            return;
          }
        } catch {}
      }

      try {
        const res = await fetch("/api/printers/test-connection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            printerUrl: printer.printerUrl,
            printerPort: printer.printerPort || "BT",
            printerType: "Bluetooth",
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
          [id]: { status: "offline", error: err?.message || "Bluetooth printer unreachable." },
        }));
      }
      return;
    }

    // 2. USB PRINTER: WebUSB Check + Windows Hardware Check
    if (printer.printerType === "Usb" || printer.printerPort === "USB") {
      if (typeof navigator !== "undefined" && "usb" in navigator) {
        try {
          const devices = await (navigator as any).usb.getDevices();
          if (devices && devices.length > 0) {
            setConnectionMap((prev) => ({
              ...prev,
              [id]: { status: "online", latencyMs: 1 },
            }));
            return;
          }
        } catch {}
      }

      try {
        const res = await fetch("/api/printers/test-connection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            printerUrl: printer.printerUrl,
            printerPort: printer.printerPort || "USB",
            printerType: "Usb",
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
          [id]: { status: "offline", error: err?.message || "USB printer unreachable." },
        }));
      }
      return;
    }

    // 3. LAN PRINTER: TCP Socket Ping via API route (Port 9100)
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

  // Live Auto-Probing + Event Listeners for Bluetooth toggles and USB hot-plugging
  useEffect(() => {
    if (!printers || printers.length === 0) return;

    const probeAll = (isSilent = true) => {
      for (const p of printers) {
        testConnection(p, isSilent);
      }
    };

    // Initial probe on mount
    probeAll(false);

    // 1. Instant Bluetooth toggle listener (detects when user turns off/on Bluetooth)
    const bt = typeof navigator !== "undefined" && "bluetooth" in navigator
      ? (navigator as any).bluetooth
      : null;

    const handleBtAvailability = () => {
      probeAll(true);
    };

    if (bt && bt.addEventListener) {
      bt.addEventListener("availabilitychanged", handleBtAvailability);
    }

    // 2. Instant USB plug / unplug listener
    const usb = typeof navigator !== "undefined" && "usb" in navigator
      ? (navigator as any).usb
      : null;

    const handleUsbChange = () => {
      probeAll(true);
    };

    if (usb && usb.addEventListener) {
      usb.addEventListener("connect", handleUsbChange);
      usb.addEventListener("disconnect", handleUsbChange);
    }

    // 3. Tab / Window Focus listener: Only refresh state when operator returns to this window
    const handleFocus = () => {
      probeAll(true);
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      if (bt && bt.removeEventListener) {
        bt.removeEventListener("availabilitychanged", handleBtAvailability);
      }
      if (usb && usb.removeEventListener) {
        usb.removeEventListener("connect", handleUsbChange);
        usb.removeEventListener("disconnect", handleUsbChange);
      }
      window.removeEventListener("focus", handleFocus);
    };
  }, [printers, testConnection]);

  const featuresList = useQuery(api.organizationFeatures.list, {});

  // ----------------------------------------------------
  // DEMO PRINT HANDLER
  // ----------------------------------------------------

  const handleDemoPrint = async (printer: Doc<"organizationPrinters">) => {
    // If testing a Kitchen Station printer, print a dedicated KOT thermal ticket with active KDS feature flags
    if (printer.printerUseFor === "Station") {
      const getFlag = (k: string) => featuresList?.find((f) => f.featureKey === k)?.active ?? false;
      const kotStr = generateDefxKotPlainString(
        {
          orderNumber: "DEMO-KOT",
          tokenNumber: "18",
          kotNumber: "KOT-01",
          orderType: "Dine In",
          table: { number: "T-04", sectionName: "AC Hall" },
          serverName: "Rahul Sharma",
          waiterName: "Rahul Sharma",
          stationName: printer.stationId || "Station",
          guestCount: 4,
          customerName: "Priya Sharma",
          customerPhone: "+91 98765 11223",
          createdAt: Date.now(),
          firedAt: Date.now(),
          specialNotes: "Severe nut allergy test",
          allergies: ["Peanuts / Tree Nuts"],
          items: [
            {
              itemName: `Self-Test: ${printer.printerType} (${printer.printerUrl})`,
              quantity: 1,
              itemPrice: 0,
              display_item_price: "Rs.0.00",
              courseName: "Diagnostics",
              customizations: [
                { optionName: `Port: ${printer.printerPort || "9100"}`, groupName: "Interface" },
                { optionName: "Paper: 80mm ESC/POS", groupName: "Hardware" },
              ],
              notes: "Thermal printhead & cutter test successful",
            },
          ],
        },
        getFlag,
        48
      );

      const printed = await printThermalReceiptDocument(
        kotStr,
        `Station KOT Self-Test - ${printer.printerUrl}`,
        {
          printerType: printer.printerType,
          printerUrl: printer.printerUrl,
          printerPort: printer.printerPort,
          stationId: printer.stationId,
        }
      );
      if (printed) {
        showFeedback(`KOT Test ticket sent to ${printer.printerUrl}!`);
      } else {
        showFeedback(`KOT Print triggered for ${printer.printerUrl}`);
      }
      return;
    }

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
          itemName: `Interface: ${printer.printerType} (${printer.printerUrl}${printer.printerPort ? `:${printer.printerPort}` : ""})`,
          quantity: 1,
          display_item_price: "0.00",
          display_total_price: "0.00",
        },
        ...(printer.stationId
          ? [
              {
                itemName: `Assigned Station: ${printer.stationId}`,
                quantity: 1,
                display_item_price: "0.00",
                display_total_price: "0.00",
              },
            ]
          : []),
      ],
      display_sub_total: "0.00",
      display_tax_total: "0.00",
      display_total_amount: "0.00",
      paymentMode: "DIAGNOSTIC",
    };

    const receiptStr = generateDefxReceiptPlainString(testOrder, activeOrg || undefined, 48);
    const printed = await printThermalReceiptDocument(
      receiptStr,
      `Printer Self-Test - ${printer.printerUseFor}`,
      {
        printerType: printer.printerType,
        printerUrl: printer.printerUrl,
        printerPort: printer.printerPort,
        stationId: printer.stationId,
      }
    );
    if (printed) {
      showFeedback(`Test receipt successfully sent to ${printer.printerUrl}!`);
    } else {
      showFeedback(`Print triggered for ${printer.printerUrl}`);
    }
  };

  // ----------------------------------------------------
  // USB & BLUETOOTH SCANNING (WebUSB / WebBluetooth)
  // ----------------------------------------------------

  const handleScanUsb = async (section: PrinterUseFor) => {
    // 1. Guard against duplicate printer assignment for this role
    const existing = printers?.find((p) => p.printerUseFor === section);
    if (existing) {
      showFeedback(
        `Hey! ${section} printer is already taken (${existing.printerType}: ${existing.printerUrl}). Please delete the existing printer first before connecting a new one.`,
        "error"
      );
      return;
    }

    if (typeof navigator === "undefined" || !("usb" in navigator)) {
      showFeedback("WebUSB is not supported in this browser. Please use Chrome or Edge.", "error");
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
        const msg = err.message || "Failed to connect USB device.";
        showFeedback(
          msg.includes("already taken")
            ? `Hey! ${section} printer is already taken. Please delete the existing printer first before connecting a new one.`
            : msg,
          "error"
        );
      }
    }
  };

  const handleScanBluetooth = async (section: PrinterUseFor) => {
    // 1. Guard against duplicate printer assignment for this role
    const existing = printers?.find((p) => p.printerUseFor === section);
    if (existing) {
      showFeedback(
        `Hey! ${section} printer is already taken (${existing.printerType}: ${existing.printerUrl}). Please delete the existing printer first before connecting a new one.`,
        "error"
      );
      return;
    }

    if (typeof navigator === "undefined" || !("bluetooth" in navigator)) {
      showFeedback("WebBluetooth is not supported in this browser. Please use Chrome or Edge over HTTPS.", "error");
      return;
    }

    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          "000018f0-0000-1000-8000-00805f9b34fb", // Standard POS print service (defx-pos-frontend)
          "0000ffe0-0000-1000-8000-00805f9b34fb", // Common HM-10 Bluetooth UART
          "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC transparent UART (POS-80/58 standard)
          "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // Xprinter / Rongta BLE service
        ],
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
        const msg = err.message || "Failed to scan Bluetooth device.";
        if (
          msg.toLowerCase().includes("adapter not available") ||
          msg.toLowerCase().includes("bluetooth is not powered")
        ) {
          showFeedback(
            "Bluetooth adapter is off. Please turn ON Bluetooth in your Windows laptop settings.",
            "error",
          );
        } else if (msg.includes("already taken")) {
          showFeedback(
            `Hey! ${section} printer is already taken. Please delete the existing printer first before connecting a new one.`,
            "error",
          );
        } else {
          showFeedback(msg, "error");
        }
      }
    }
  };

  // ----------------------------------------------------
  // LAN DRAWER HANDLERS (Add / Edit)
  // ----------------------------------------------------

  const openLanModal = (section: PrinterUseFor, printer?: Doc<"organizationPrinters">) => {
    setFormError(null);
    if (!printer) {
      const existing = printers?.find((p) => p.printerUseFor === section);
      if (existing) {
        showFeedback(
          `Hey! ${section} printer is already taken (${existing.printerType}: ${existing.printerUrl}). Please delete the existing printer first before adding a new one.`,
          "error"
        );
        return;
      }
    }

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

    if (lanModal.type === "create") {
      const existing = printers?.find((p) => p.printerUseFor === lanModal.section);
      if (existing) {
        setFormError(
          `Hey! ${lanModal.section} printer is already taken (${existing.printerType}: ${existing.printerUrl}). Please delete the existing printer first before adding a new one.`
        );
        return;
      }
    }

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
        showFeedback("Successfully updated LAN printer");
      } else {
        await createPrinter({
          printerUrl: formData.printerUrl.trim(),
          printerPort: formData.printerPort.trim() || undefined,
          printerType: "Lan",
          printerUseFor: lanModal.section,
          stationId: lanModal.section === "Station" ? formData.stationId.trim() : undefined,
        });
        showFeedback("Successfully added LAN printer");
      }

      setLanModal((prev) => ({ ...prev, isOpen: false }));
    } catch (err: any) {
      const msg = err?.message || "Failed to save LAN printer.";
      if (msg.includes("already taken")) {
        setFormError(
          `Hey! ${lanModal.section} printer is already taken. Please delete the existing printer first before adding a new one.`
        );
      } else {
        setFormError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeletePrinter = async () => {
    if (!printerToDelete) return;
    setIsDeleting(true);

    try {
      await removePrinter({ id: printerToDelete._id });
      showFeedback(`Successfully deleted ${printerToDelete.printerType} printer`);
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
      <div className="flex h-64 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-stone-500">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#141010] border-t-transparent" />
          <span className="text-xs font-medium">Loading printer settings...</span>
        </div>
      </div>
    );
  }

  const totalPrinters = printers ? printers.length : 0;
  const onlineCount = Object.values(connectionMap).filter((c) => c.status === "online").length;

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full overflow-y-auto pr-1">
      <div className="max-w-5xl w-full mx-auto space-y-6 pb-12">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-stone-200/80">
          <div>
            <h2 className="font-serif text-2xl font-normal text-[#141010] tracking-tight">
              Printer Settings
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Configure thermal receipt and kitchen order printers via LAN (TCP/IP), Bluetooth, or USB.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-700 border border-stone-200">
              <span className={`w-2 h-2 rounded-full ${onlineCount > 0 ? "bg-emerald-500" : "bg-stone-400"}`} />
              {totalPrinters} configured • {onlineCount} online
            </span>
          </div>
        </div>


        {/* Main Printer Cards Container */}
        <div className="space-y-4">
          {/* 1. Cashier Printer Section */}
          <PrinterSectionCard
            title="Cashier printer"
            subtitle="Customer receipts, bill estimates, and settlement printouts at checkout."
            icon="🧾"
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
          <PrinterSectionCard
            title="Workstation printer"
            subtitle="Central kitchen dispatch overview, expeditor summary, and workstation tickets."
            icon="🖥️"
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
          <PrinterSectionCard
            title="Station printer"
            subtitle="Kitchen Order Tickets (KOT) routed directly to cooking stations (Bar, Grill, Tandoor, etc.)."
            icon="🍳"
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
            SLIDE-OVER RIGHT DRAWER: ADD / EDIT LAN PRINTER
        ------------------------------------------ */}
        {lanModal.isOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-in fade-in duration-200">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-[#0c0a09]/40 backdrop-blur-xs transition-opacity cursor-pointer"
              onClick={() => setLanModal((prev) => ({ ...prev, isOpen: false }))}
            />

            {/* Slide Drawer Content */}
            <div className="relative z-10 w-full max-w-md bg-white shadow-2xl h-full flex flex-col justify-between border-l border-stone-200">
              <div>
                {/* Drawer Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-stone-200/80">
                  <div>
                    <h3 className="font-serif text-lg font-medium text-[#141010]">
                      {lanModal.type === "update" ? "Edit" : "Add"} LAN Printer
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Configuring for {lanModal.section} printer
                    </p>
                  </div>
                  <button
                    onClick={() => setLanModal((prev) => ({ ...prev, isOpen: false }))}
                    className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition cursor-pointer"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Form Fields */}
                <form id="lan-printer-form" onSubmit={handleSaveLanPrinter} className="p-6 space-y-4">
                  {formError && (
                    <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                      {formError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1.5">
                      Printer URL / IP Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.printerUrl}
                      onChange={(e) => setFormData((p) => ({ ...p, printerUrl: e.target.value }))}
                      placeholder="e.g. 192.168.1.100"
                      required
                      className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-xs text-[#141010] focus:border-[#141010] focus:bg-white focus:outline-none transition"
                    />
                    <p className="text-[11px] text-stone-400 mt-1">
                      Static IP address or local hostname of the network thermal printer.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1.5">
                      Port Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.printerPort}
                      onChange={(e) => setFormData((p) => ({ ...p, printerPort: e.target.value }))}
                      placeholder="9100"
                      required
                      className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-xs text-[#141010] focus:border-[#141010] focus:bg-white focus:outline-none transition font-mono"
                    />
                    <p className="text-[11px] text-stone-400 mt-1">
                      Standard RAW printing port for ESC/POS is 9100.
                    </p>
                  </div>

                  {lanModal.section === "Station" && (
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1.5">
                        Target Kitchen Station <span className="text-red-500">*</span>
                      </label>
                      {stations && stations.length > 0 ? (
                        <select
                          value={formData.stationId}
                          onChange={(e) => setFormData((p) => ({ ...p, stationId: e.target.value }))}
                          required
                          className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-xs text-[#141010] focus:border-[#141010] focus:bg-white focus:outline-none transition"
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
                          className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-xs text-[#141010] focus:border-[#141010] focus:bg-white focus:outline-none transition"
                        />
                      )}
                      <p className="text-[11px] text-stone-400 mt-1">
                        Select which kitchen station this printer will receive KOT tickets for.
                      </p>
                    </div>
                  )}
                </form>
              </div>

              {/* Drawer Footer Actions */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-stone-200 bg-stone-50/50">
                <button
                  type="button"
                  onClick={() => setLanModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 rounded-full border border-stone-200 text-xs font-medium text-stone-700 bg-white hover:bg-stone-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="lan-printer-form"
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-full bg-[#141010] hover:bg-black text-xs font-medium text-white shadow-xs disabled:opacity-50 transition cursor-pointer"
                >
                  {isSubmitting ? "Saving..." : lanModal.type === "update" ? "Update Printer" : "Save Printer"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------
            DELETE CONFIRMATION MODAL (defx standard)
        ------------------------------------------ */}
        {printerToDelete && (
          <div className="fixed inset-0 z-50 bg-[#0c0a09]/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div
              aria-modal="true"
              className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-[440px] p-6 relative z-50"
              role="dialog"
            >
              <button
                onClick={() => setPrinterToDelete(null)}
                aria-label="Close modal"
                className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 p-1.5 rounded-full hover:bg-stone-100 transition cursor-pointer"
                type="button"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="mb-4">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100">
                  <svg className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </div>
              </div>

              <div className="space-y-1 mb-5">
                <h2 className="text-lg font-medium text-[#141010]">
                  Delete {printerToDelete.printerPort || printerToDelete.printerType} printer?
                </h2>
                <p className="text-xs text-stone-500">
                  Are you sure you want to delete this {printerToDelete.printerType} printer ({printerToDelete.printerUrl})? This will detach it from {printerToDelete.printerUseFor} print routing.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
                <button
                  onClick={() => setPrinterToDelete(null)}
                  className="px-4 py-2 rounded-full border border-stone-200 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 transition cursor-pointer"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeletePrinter}
                  disabled={isDeleting}
                  className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition disabled:opacity-50 cursor-pointer shadow-xs"
                  type="button"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Standard Menu Toast Notification - Top Right */}
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    </div>
  );
}

// ----------------------------------------------------
// PRINTER SECTION CARD (Cashier / Workstation / Station)
// ----------------------------------------------------

interface PrinterSectionCardProps {
  title: string;
  subtitle: string;
  icon: string;
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

function PrinterSectionCard(props: PrinterSectionCardProps) {
  const {
    title,
    subtitle,
    icon,
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
    <div className="rounded-2xl border border-stone-200/90 bg-white shadow-xs transition overflow-hidden">
      {/* Section Header Row */}
      <div className="flex items-center justify-between p-5">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-stone-50 border border-stone-200/60 flex items-center justify-center text-lg shrink-0">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#141010]">{title}</h3>
              {printers.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-stone-100 text-stone-700 border border-stone-200/60">
                  {printers.length} configured
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onToggle(section)}
          className={`px-5 py-2 rounded-full text-xs font-medium transition cursor-pointer shrink-0 ml-4 ${
            isExpanded
              ? "bg-[#141010] text-white shadow-xs"
              : "bg-white text-stone-800 border border-stone-300 hover:border-stone-400 hover:bg-stone-50"
          }`}
        >
          {isExpanded ? "Close" : "Add / Manage"}
        </button>
      </div>

      {/* Expanded Details matching defx-pos-frontend architecture */}
      {isExpanded && (
        <div className="border-t border-stone-100 bg-[#faf8f7] p-6 space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
              Added / Paired Hardware
            </h4>
            <span className="text-[11px] text-stone-400">
              Select an interface below to connect or scan
            </span>
          </div>


          {/* 1. Bluetooth Printers */}
          <div className="space-y-3 rounded-xl border border-stone-200/80 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-[#141010] block">
                  Bluetooth Printers {bluetoothPrinters.length > 0 ? `(${bluetoothPrinters.length})` : ""}
                </span>
                <span className="text-[11px] text-stone-400">
                  Pair via WebBluetooth (Chrome / Edge over HTTPS)
                </span>
              </div>
              <button
                type="button"
                onClick={onScanBluetooth}
                className="px-4 py-1.5 rounded-full bg-[#141010] hover:bg-black text-white text-xs font-medium transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span>📡</span>
                <span>Scan Bluetooth</span>
              </button>
            </div>

            {bluetoothPrinters.length > 0 ? (
              <div className="space-y-2 pt-1">
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
            ) : (
              <div className="text-center py-2 text-[11.5px] text-stone-400 italic">
                No Bluetooth printers paired for this role. Click Scan Bluetooth to pair.
              </div>
            )}
          </div>

          {/* 2. USB Printers */}
          <div className="space-y-3 rounded-xl border border-stone-200/80 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-[#141010] block">
                  USB Printers {usbPrinters.length > 0 ? `(${usbPrinters.length})` : ""}
                </span>
                <span className="text-[11px] text-stone-400">
                  Direct cable connection via WebUSB (POS thermal standard)
                </span>
              </div>
              <button
                type="button"
                onClick={onScanUsb}
                className="px-4 py-1.5 rounded-full bg-[#141010] hover:bg-black text-white text-xs font-medium transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span>🔌</span>
                <span>Scan USB</span>
              </button>
            </div>

            {usbPrinters.length > 0 ? (
              <div className="space-y-2 pt-1">
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
            ) : (
              <div className="text-center py-2 text-[11.5px] text-stone-400 italic">
                No USB printers detected. Connect your thermal printer cable and click Scan USB.
              </div>
            )}
          </div>

          {/* 3. LAN Network Printers */}
          <div className="space-y-3 rounded-xl border border-stone-200/80 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-[#141010] block">
                  LAN Printers {lanPrinters.length > 0 ? `(${lanPrinters.length})` : ""}
                </span>
                <span className="text-[11px] text-stone-400">
                  Ethernet / Wi-Fi thermal printers communicating via TCP port 9100
                </span>
              </div>
              <button
                type="button"
                onClick={() => onOpenLanModal()}
                className="px-4 py-1.5 rounded-full bg-[#141010] hover:bg-black text-white text-xs font-medium transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span className="text-sm font-bold leading-none">+</span>
                <span>Add LAN Printer</span>
              </button>
            </div>

            {lanPrinters.length > 0 ? (
              <div className="space-y-2 pt-1">
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
            ) : (
              <div className="text-center py-2 text-[11.5px] text-stone-400 italic">
                No LAN printers configured. Click Add LAN Printer to enter IP address and port.
              </div>
            )}
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
  const isOffline = connection?.status === "offline";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-stone-200/80 bg-stone-50/50 p-3.5 transition hover:bg-white hover:border-stone-300">
      <div className="flex items-start sm:items-center gap-3">
        {/* Status Indicator Dot */}
        <span
          className={`h-2.5 w-2.5 rounded-full shrink-0 mt-1 sm:mt-0 transition-colors ${
            isTesting
              ? "bg-amber-400 animate-pulse"
              : isOnline
                ? "bg-[#219653]"
                : "bg-rose-500"
          }`}
          title={isOnline ? "Printer Online" : isOffline ? connection?.error || "Offline" : "Checking status"}
        />

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-[#141010]">
              {printer.printerUrl}
            </span>

            {printer.printerPort && (
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200/60">
                Port: {printer.printerPort}
              </span>
            )}

            {printer.stationId && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80">
                Station: {printer.stationId}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-stone-400">
              Type: {printer.printerType}
            </span>

            <span className="text-stone-300">•</span>

            {isTesting && (
              <span className="text-[11px] text-amber-600 font-medium animate-pulse">
                Checking reachability...
              </span>
            )}

            {isOnline && (
              <span className="text-[11px] text-[#219653] font-medium">
                Online {connection?.latencyMs !== undefined ? `(${connection.latencyMs}ms)` : ""}
              </span>
            )}

            {isOffline && (
              <span className="text-[11px] text-rose-600 font-medium" title={connection?.error}>
                Offline {connection?.error ? `— ${connection.error.slice(0, 45)}...` : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 self-end sm:self-center">
        {/* Test Connection Button */}
        <button
          type="button"
          onClick={onTestConnection}
          disabled={isTesting}
          title="Test Connection"
          className="px-2.5 py-1 text-xs font-medium text-stone-700 hover:text-black border border-stone-300 rounded-lg bg-white hover:bg-stone-50 transition cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-2xs"
        >
          {isTesting ? (
            <>
              <svg className="w-3 h-3 animate-spin text-amber-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Testing...</span>
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>Test</span>
            </>
          )}
        </button>

        {/* LAN Edit Icon */}
        {printer.printerType === "Lan" && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            title="Edit LAN Printer"
            className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition cursor-pointer"
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

        {/* Delete Icon */}
        <button
          type="button"
          onClick={onDelete}
          title="Delete Printer"
          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
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
          className="px-3 py-1 text-xs font-medium text-stone-800 hover:text-black border border-stone-300 rounded-lg bg-white hover:bg-stone-50 transition cursor-pointer shadow-2xs"
        >
          Demo Print
        </button>
      </div>
    </div>
  );
}
