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

/**
 * Normalizes a hex string to uppercase 6-digit #RRGGBB format if valid, or null.
 */
function normalizeHex(input: string): string | null {
  let val = input.trim();
  if (!val.startsWith("#")) {
    val = "#" + val;
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
    return val.toUpperCase();
  }
  if (/^#[0-9A-Fa-f]{3}$/.test(val)) {
    const r = val[1];
    const g = val[2];
    const b = val[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return null;
}

function DrawerForm({
  mode,
  process,
  onClose,
  onSubmit,
  isSubmitting,
}: DrawerFormProps) {
  const initialColor =
    mode === "edit" && process?.processColor
      ? normalizeHex(process.processColor) || process.processColor
      : "#141010";

  const [name, setName] = useState(
    mode === "edit" && process ? process.name || "" : ""
  );
  const [color, setColor] = useState(
    normalizeHex(initialColor) || "#141010"
  );
  const [hexInput, setHexInput] = useState(initialColor);
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

  // Sync color picker changes to both color state and manual hex input
  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value.toUpperCase();
    setColor(newColor);
    setHexInput(newColor);
  };

  // Allow manual hex typing and sync color swatch when valid
  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHexInput(val);
    const normalized = normalizeHex(val);
    if (normalized) {
      setColor(normalized);
    }
  };

  // On blur, normalize to standard uppercase #RRGGBB or revert to current valid color
  const handleHexInputBlur = () => {
    const normalized = normalizeHex(hexInput);
    if (normalized) {
      setColor(normalized);
      setHexInput(normalized);
    } else {
      setHexInput(color);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setValidationError("Process name is required.");
      return;
    }

    setValidationError(null);

    const effectiveColor = normalizeHex(hexInput) || color || "#141010";

    await onSubmit({
      id: process?._id,
      name: trimmedName,
      processColor: effectiveColor,
      description: description.trim() || undefined,
      published,
      isSequence: true,
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
            className="font-garamond text-[32px] text-[#141010] font-normal leading-[1.13] tracking-[-0.32px]"
          >
            {mode === "edit" ? "Edit Order Process" : "Create Order Process"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full bg-[#f7f3f2] hover:bg-[#ece7e6] flex items-center justify-center text-[#4e4543] hover:text-[#141010] transition-colors cursor-pointer"
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
          <div className="mb-6 p-3 rounded-xl bg-[#ffdad6]/60 border border-[#ffdad6] text-[#ba1a1a] text-sm font-sans">
            {validationError}
          </div>
        )}

        <form id="order-process-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Field A: Process name */}
          <div>
            <label
              htmlFor="process-name"
              className="block text-[12px] font-semibold text-[#4e4543] tracking-[0.96px] uppercase mb-2 font-sans"
            >
              Process name *
            </label>
            <input
              ref={nameInputRef}
              id="process-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Quality Check"
              disabled={isSubmitting}
              className="w-full h-11 px-4 rounded-xl bg-[#f7f3f2] border border-[#e7e5e4] text-[#141010] placeholder:text-[#4e4543]/60 focus:outline-none focus:border-[#7f7572] transition-colors text-[15px] font-sans"
            />
          </div>

          {/* Field B: Process color */}
          <div>
            <label
              htmlFor="process-color-input"
              className="block text-[12px] font-semibold text-[#4e4543] tracking-[0.96px] uppercase mb-2 font-sans"
            >
              Process color *
            </label>
            <div className="flex items-center gap-3">
              {/* Color Swatch & Native Color Picker Trigger */}
              <div className="relative w-12 h-11 rounded-xl bg-[#f7f3f2] border border-[#e7e5e4] overflow-hidden flex items-center justify-center cursor-pointer hover:border-[#7f7572] transition-colors shrink-0">
                <input
                  id="process-color-picker"
                  type="color"
                  value={color}
                  onChange={handleColorPickerChange}
                  disabled={isSubmitting}
                  className="absolute inset-[-10px] w-[200%] h-[200%] cursor-pointer opacity-0"
                  aria-label="Choose process color"
                />
                <span
                  className="w-5 h-5 rounded-md shadow-sm border border-black/10"
                  style={{ backgroundColor: color }}
                />
              </div>

              {/* Editable Hex Input */}
              <div className="flex-1">
                <input
                  id="process-color-input"
                  type="text"
                  value={hexInput}
                  onChange={handleHexInputChange}
                  onBlur={handleHexInputBlur}
                  placeholder="#141010"
                  maxLength={7}
                  disabled={isSubmitting}
                  className="w-full h-11 px-4 rounded-xl bg-[#f7f3f2] border border-[#e7e5e4] text-[#141010] placeholder:text-[#4e4543]/60 focus:outline-none focus:border-[#7f7572] transition-colors font-mono text-sm uppercase font-medium"
                />
              </div>
            </div>
          </div>

          {/* Field C: Description */}
          <div>
            <label
              htmlFor="process-description"
              className="block text-[12px] font-semibold text-[#4e4543] tracking-[0.96px] uppercase mb-2 font-sans"
            >
              Description
            </label>
            <textarea
              id="process-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of workflow stage"
              disabled={isSubmitting}
              className="w-full h-24 p-4 rounded-xl bg-[#f7f3f2] border border-[#e7e5e4] text-[#141010] placeholder:text-[#4e4543]/60 focus:outline-none focus:border-[#7f7572] resize-none transition-colors text-[15px] font-sans"
            />
          </div>

          {/* Field D: Published */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <div className="font-medium text-[#141010] text-[16px] font-sans">
                Published
              </div>
              <div className="text-[13px] text-[#4e4543] font-sans">
                Available immediately in terminals
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                disabled={isSubmitting}
                className="sr-only peer"
                aria-label="Published toggle"
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
          className="px-6 h-10 rounded-full border border-[#e7e5e4] text-[#141010] hover:bg-[#ece7e6] text-[15px] font-medium transition-all cursor-pointer disabled:opacity-50 font-sans"
        >
          Cancel
        </button>
        <button
          type="submit"
          form="order-process-form"
          disabled={isSubmitting}
          style={{ backgroundColor: "#141010", color: "#ffffff" }}
          className="px-6 h-10 rounded-full !bg-[#141010] hover:!bg-[#292524] !text-[#ffffff] text-[15px] font-medium transition-all cursor-pointer shadow-sm disabled:opacity-50 active:scale-[0.98] inline-flex items-center justify-center min-w-[130px] font-sans"
        >
          {isSubmitting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : mode === "edit" ? (
            <span style={{ color: "#ffffff" }} className="!text-[#ffffff] font-medium">Save changes</span>
          ) : (
            <span style={{ color: "#ffffff" }} className="!text-[#ffffff] font-medium">Create process</span>
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
