"use client";

import React, { useState, useEffect, useRef } from "react";
import { DrawerState, OrderProcessFormData } from "./types";

interface OrderProcessDrawerProps {
  drawerState: DrawerState;
  onClose: () => void;
  onSubmit: (formData: OrderProcessFormData) => Promise<void>;
  isSubmitting: boolean;
}

interface DrawerFormProps {
  mode: "create" | "edit";
  process?: DrawerState["process"];
  onClose: () => void;
  onSubmit: (formData: OrderProcessFormData) => Promise<void>;
  isSubmitting: boolean;
}

function isValidHex(hex: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(hex.trim());
}

function normalizeHex(hex: string): string {
  const trimmed = hex.trim();
  if (!trimmed) return "#141010";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function DrawerForm({
  mode,
  process,
  onClose,
  onSubmit,
  isSubmitting,
}: DrawerFormProps) {
  const [name, setName] = useState(mode === "edit" && process ? process.name || "" : "");
  const [color, setColor] = useState(
    mode === "edit" && process ? process.processColor || "#141010" : "#141010"
  );
  const [description, setDescription] = useState(
    mode === "edit" && process ? process.description || "" : ""
  );
  const [published, setPublished] = useState(
    mode === "edit" && process ? (process.published ?? true) : true
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setValidationError("Status name is required.");
      return;
    }

    const normalizedColor = normalizeHex(color);
    if (!isValidHex(normalizedColor)) {
      setValidationError("Please enter a valid hex color (e.g. #ffffff or #141010).");
      return;
    }

    setValidationError(null);

    await onSubmit({
      id: process?._id,
      name: trimmedName,
      processColor: normalizedColor,
      description: description.trim() || undefined,
      published,
      isSequence: process ? (process.isSequence ?? true) : true,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      className="w-screen max-w-md bg-[#ffffff] h-full shadow-2xl flex flex-col justify-between p-8 border-l border-[#e7e5e4] transform transition-transform animate-in slide-in-from-right duration-300 ease-out"
    >
      {/* Drawer Top / Header & Form Body */}
      <div className="overflow-y-auto pr-1 -mr-1">
        <div className="flex items-center justify-between mb-8">
          <h2
            id="drawer-title"
            className="font-garamond text-2xl md:text-3xl text-[#141010] font-normal leading-tight tracking-tight"
          >
            {mode === "edit" ? "Edit Order Status" : "Add Order Status"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full bg-[#f7f3f2] hover:bg-[#ece7e6] flex items-center justify-center text-[#5e5e5e] hover:text-[#141010] transition-colors cursor-pointer"
            aria-label="Close drawer"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Validation / Server Error Banner */}
        {validationError && (
          <div className="mb-6 p-3 rounded-xl bg-[#ffdad6]/60 border border-[#ffdad6] text-[#ba1a1a] text-sm">
            {validationError}
          </div>
        )}

        <form id="order-process-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Field A: Status name */}
          <div>
            <label
              htmlFor="process-name"
              className="block text-[11px] font-semibold text-[#5e5e5e] tracking-[0.96px] uppercase mb-2 font-sans"
            >
              Status Name *
            </label>
            <input
              ref={nameInputRef}
              id="process-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Preparing"
              disabled={isSubmitting}
              className="w-full h-11 px-4 rounded-xl bg-[#f7f3f2] border border-[#e7e5e4] text-[#141010] placeholder:text-[#5e5e5e]/60 focus:outline-none focus:border-[#7f7572] transition-colors text-sm font-sans"
            />
          </div>

          {/* Field B: Status color */}
          <div>
            <label
              htmlFor="process-color"
              className="block text-[11px] font-semibold text-[#5e5e5e] tracking-[0.96px] uppercase mb-1 font-sans"
            >
              Status Color *
            </label>
            <p className="text-[13px] text-[#7f7572] font-normal font-sans mb-2.5">
              Choose a color or enter a hex code to help staff quickly identify this status.
            </p>
            <div className="flex items-center gap-3">
              <input
                id="process-color"
                type="color"
                value={isValidHex(color) && color.length === 7 ? color : "#141010"}
                onChange={(e) => setColor(e.target.value)}
                disabled={isSubmitting}
                className="w-11 h-11 p-1 rounded-xl bg-[#f7f3f2] border border-[#e7e5e4] cursor-pointer shrink-0"
                aria-label="Choose status color"
              />
              <div className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#f7f3f2] border border-[#e7e5e4] focus-within:border-[#7f7572] focus-within:bg-[#ffffff] transition-colors">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm border border-black/10"
                  style={{ backgroundColor: isValidHex(normalizeHex(color)) ? normalizeHex(color) : "#141010" }}
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (!val.startsWith("#") && val.length > 0 && !val.startsWith(" ")) {
                      val = "#" + val;
                    }
                    setColor(val);
                  }}
                  placeholder="#141010"
                  maxLength={7}
                  disabled={isSubmitting}
                  className="w-full bg-transparent font-mono text-sm text-[#141010] font-medium focus:outline-none uppercase"
                  aria-label="Hex color code"
                />
              </div>
            </div>
          </div>

          {/* Field C: Description */}
          <div>
            <label
              htmlFor="process-description"
              className="block text-[11px] font-semibold text-[#5e5e5e] tracking-[0.96px] uppercase mb-2 font-sans"
            >
              What does this status mean?
            </label>
            <textarea
              id="process-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Kitchen is preparing the order"
              disabled={isSubmitting}
              className="w-full h-24 p-4 rounded-xl bg-[#f7f3f2] border border-[#e7e5e4] text-[#141010] placeholder:text-[#5e5e5e]/60 focus:outline-none focus:border-[#7f7572] resize-none transition-colors text-sm font-sans"
            />
          </div>

          {/* Field D: Active */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <div className="font-medium text-[#141010] text-[15px] font-sans">
                Active
              </div>
              <div className="text-xs text-[#5e5e5e] font-sans">
                Turn this on to make this status available to staff.
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                disabled={isSubmitting}
                className="sr-only peer"
                aria-label="Active toggle"
              />
              <div className="w-11 h-6 bg-[#ece7e6] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#141010]" />
            </label>
          </div>
        </form>
      </div>

      {/* Drawer Footer */}
      <div className="flex items-center justify-end gap-3 pt-6 border-t border-[#e7e5e4] mt-6">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="px-5 py-2.5 rounded-full border border-[#e7e5e4] text-[#141010] hover:bg-[#ece7e6] text-xs md:text-sm font-medium transition-all cursor-pointer disabled:opacity-50 font-sans"
        >
          Cancel
        </button>
        <button
          type="submit"
          form="order-process-form"
          disabled={isSubmitting}
          className="px-5 py-2.5 rounded-full !bg-[#0c0a09] hover:!bg-[#292524] !text-[#ffffff] text-xs md:text-sm font-semibold transition-all cursor-pointer shadow-sm disabled:opacity-50 active:scale-[0.98] inline-flex items-center justify-center min-w-[120px] font-sans"
        >
          {isSubmitting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : mode === "edit" ? (
            "Save Changes"
          ) : (
            "Add Status"
          )}
        </button>
      </div>
    </div>
  );
}

export function OrderProcessDrawer({
  drawerState,
  onClose,
  onSubmit,
  isSubmitting,
}: OrderProcessDrawerProps) {
  const { isOpen, mode, process } = drawerState;

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#141010]/25 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200"
        onClick={() => {
          if (!isSubmitting) onClose();
        }}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <DrawerForm
          key={process?._id ?? mode}
          mode={mode}
          process={process}
          onClose={onClose}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}


