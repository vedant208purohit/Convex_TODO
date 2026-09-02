"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

type PrinterType = "Lan" | "Bluetooth" | "Usb";
type PrinterUseFor = "Cashier" | "Station" | "WorkStation";

interface PrinterFormData {
  id?: Id<"organizationPrinters">;
  printerUrl: string;
  printerPort: string;
  printerType: PrinterType;
  printerUseFor: PrinterUseFor;
  stationId: string;
}

export function OrganizationPrinters() {
  const printers = useQuery(api.organizationPrinters.list, {});
  const isLoading = printers === undefined;

  const createPrinter = useMutation(api.organizationPrinters.create);
  const updatePrinter = useMutation(api.organizationPrinters.update);
  const removePrinter = useMutation(api.organizationPrinters.remove);

  // Form State
  const [editingId, setEditingId] = useState<Id<"organizationPrinters"> | null>(null);
  const [formData, setFormData] = useState<PrinterFormData>({
    printerUrl: "192.168.1.100",
    printerPort: "9100",
    printerType: "Lan",
    printerUseFor: "Cashier",
    stationId: "",
  });

  // Action / Feedback States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRemovingId, setIsRemovingId] = useState<Id<"organizationPrinters"> | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      printerUrl: "192.168.1.100",
      printerPort: "9100",
      printerType: "Lan",
      printerUseFor: "Cashier",
      stationId: "",
    });
    setErrorMessage(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowFormModal(true);
  };

  const handleOpenEdit = (printer: any) => {
    setEditingId(printer._id);
    setFormData({
      id: printer._id,
      printerUrl: printer.printerUrl || "",
      printerPort: printer.printerPort || "9100",
      printerType: printer.printerType || "Lan",
      printerUseFor: printer.printerUseFor || "Cashier",
      stationId: printer.stationId || "",
    });
    setErrorMessage(null);
    setShowFormModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!formData.printerUrl.trim()) {
      setErrorMessage("Printer URL / IP Address cannot be blank.");
      return;
    }

    if (formData.printerType === "Lan" && formData.printerUseFor === "Station" && !formData.stationId.trim()) {
      setErrorMessage("Station reference is required for LAN station printers.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingId) {
        await updatePrinter({
          id: editingId,
          printerUrl: formData.printerUrl.trim(),
          printerPort: formData.printerPort.trim() || undefined,
          printerType: formData.printerType,
          printerUseFor: formData.printerUseFor,
          stationId: formData.stationId.trim() || undefined,
        });
        setSuccessMessage("Printer configuration updated successfully!");
      } else {
        await createPrinter({
          printerUrl: formData.printerUrl.trim(),
          printerPort: formData.printerPort.trim() || undefined,
          printerType: formData.printerType,
          printerUseFor: formData.printerUseFor,
          stationId: formData.stationId.trim() || undefined,
        });
        setSuccessMessage("New printer added successfully!");
      }

      setShowFormModal(false);
      resetForm();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to save printer configuration.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (id: Id<"organizationPrinters">) => {
    if (!confirm("Are you sure you want to remove this printer configuration?")) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsRemovingId(id);

    try {
      await removePrinter({ id });
      setSuccessMessage("Printer removed successfully.");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to remove printer.");
    } finally {
      setIsRemovingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-48 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[#6f655e]">
          <div className="h-6 w-6 animate-spin rounded-full border-3 border-[#191513] border-t-transparent" />
          <span className="text-xs font-medium">Loading store hardware printers...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-light text-[#1f1a17]">Hardware Printers</h2>
          <p className="mt-1 text-sm text-[#6f655e]">
            Configure thermal receipt printers, kitchen prep station ticket printers (KOT), and workstation label printers.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex h-10 items-center gap-2 rounded-full bg-[#191513] px-5 text-sm font-medium text-white shadow-sm transition hover:bg-[#2e2824]"
        >
          <span>+ Add Printer</span>
        </button>
      </div>

      {/* Feedback Messages */}
      {successMessage && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 shadow-sm">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-900">
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 shadow-sm">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-600 hover:text-red-900">
            ✕
          </button>
        </div>
      )}

      {/* Printers List */}
      {printers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#d1c4c1] bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fdf8f7] text-3xl">
            🖨️
          </div>
          <h3 className="mt-4 text-base font-medium text-[#1f1a17]">No Printers Configured</h3>
          <p className="mt-1 text-xs text-[#6f655e]">
            Add thermal printers for Cashier billing receipts, Kitchen station KOT tickets, or Workstation packaging labels.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="mt-5 inline-flex h-9 items-center gap-2 rounded-full bg-[#191513] px-5 text-xs font-medium text-white shadow-sm transition hover:bg-[#2e2824]"
          >
            + Configure First Printer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {printers.map((printer) => {
            const isRemoving = isRemovingId === printer._id;

            return (
              <div
                key={printer._id}
                className="flex flex-col justify-between rounded-2xl border border-[#eadfd6] bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-[#eadfd6] pb-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fdf8f7] border border-[#eadfd6] px-3 py-1 text-xs font-semibold text-[#1f1a17]">
                      <span>🖨️</span>
                      <span>{printer.printerUseFor}</span>
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        printer.printerType === "Lan"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : printer.printerType === "Bluetooth"
                          ? "bg-purple-50 text-purple-700 border border-purple-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {printer.printerType}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-xs text-[#6f655e]">
                    <div>
                      <span className="font-semibold text-[#1f1a17]">IP / URL:</span>{" "}
                      <span className="font-mono text-[#1f1a17]">{printer.printerUrl}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-[#1f1a17]">Port:</span>{" "}
                      <span className="font-mono text-[#1f1a17]">{printer.printerPort || "9100"}</span>
                    </div>
                    {printer.stationId && (
                      <div>
                        <span className="font-semibold text-[#1f1a17]">Station Reference:</span>{" "}
                        <span className="font-medium text-[#8c4a3b]">{printer.stationId}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#eadfd6] pt-3">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(printer)}
                    className="text-xs font-medium text-[#8c4a3b] hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(printer._id)}
                    disabled={isRemoving}
                    className="text-xs font-medium text-red-600 hover:underline disabled:opacity-40"
                  >
                    {isRemoving ? "Removing..." : "Remove"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl border border-[#eadfd6] bg-white p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#eadfd6] pb-4">
              <h3 className="font-serif text-xl font-light text-[#1f1a17]">
                {editingId ? "Edit Hardware Printer" : "Add Hardware Printer"}
              </h3>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="text-lg text-[#8a7e75] hover:text-[#1f1a17]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e]">
                  Printer IP Address / Hostname *
                </label>
                <input
                  type="text"
                  value={formData.printerUrl}
                  onChange={(e) => setFormData((p) => ({ ...p, printerUrl: e.target.value }))}
                  placeholder="e.g. 192.168.1.100"
                  required
                  className="mt-2 w-full rounded-xl border border-[#eadfd6] bg-[#fdf8f7] px-4 py-3 text-sm text-[#1f1a17] focus:border-[#1f1a17] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e]">
                    Network Port
                  </label>
                  <input
                    type="text"
                    value={formData.printerPort}
                    onChange={(e) => setFormData((p) => ({ ...p, printerPort: e.target.value }))}
                    placeholder="9100"
                    className="mt-2 w-full rounded-xl border border-[#eadfd6] bg-[#fdf8f7] px-4 py-3 text-sm text-[#1f1a17] focus:border-[#1f1a17] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e]">
                    Interface Type *
                  </label>
                  <select
                    value={formData.printerType}
                    onChange={(e) => setFormData((p) => ({ ...p, printerType: e.target.value as PrinterType }))}
                    className="mt-2 w-full rounded-xl border border-[#eadfd6] bg-[#fdf8f7] px-4 py-3 text-sm text-[#1f1a17] focus:border-[#1f1a17] focus:outline-none"
                  >
                    <option value="Lan">LAN (TCP/IP)</option>
                    <option value="Bluetooth">Bluetooth</option>
                    <option value="Usb">USB Direct</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e]">
                  Printer Purpose Role *
                </label>
                <select
                  value={formData.printerUseFor}
                  onChange={(e) => setFormData((p) => ({ ...p, printerUseFor: e.target.value as PrinterUseFor }))}
                  className="mt-2 w-full rounded-xl border border-[#eadfd6] bg-[#fdf8f7] px-4 py-3 text-sm text-[#1f1a17] focus:border-[#1f1a17] focus:outline-none"
                >
                  <option value="Cashier">Cashier Thermal Receipt Printer</option>
                  <option value="Station">Kitchen Station Ticket (KOT)</option>
                  <option value="WorkStation">Workstation Label Printer</option>
                </select>
                <p className="mt-1 text-[11px] text-[#8a7e75]">
                  Note: A store can have at most one active printer per purpose role.
                </p>
              </div>

              {formData.printerType === "Lan" && formData.printerUseFor === "Station" && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e]">
                    Kitchen Station Reference ID *
                  </label>
                  <input
                    type="text"
                    value={formData.stationId}
                    onChange={(e) => setFormData((p) => ({ ...p, stationId: e.target.value }))}
                    placeholder="e.g. kitchen_station_1"
                    required
                    className="mt-2 w-full rounded-xl border border-[#eadfd6] bg-[#fdf8f7] px-4 py-3 text-sm text-[#1f1a17] focus:border-[#1f1a17] focus:outline-none"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-[#eadfd6]">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="h-10 rounded-full border border-[#eadfd6] bg-white px-5 text-xs font-medium text-[#1f1a17] hover:bg-[#f3eeea]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex h-10 items-center justify-center rounded-full bg-[#191513] px-6 text-xs font-medium text-white shadow-sm transition hover:bg-[#2e2824] disabled:opacity-40"
                >
                  {isSubmitting ? "Saving..." : editingId ? "Update Printer" : "Add Printer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
