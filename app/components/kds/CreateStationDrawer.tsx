"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface CreateStationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId?: Id<"organizations">;
  existingStationNames?: string[];
  onSuccess?: (newStationId: Id<"stations">, stationName: string) => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

export function CreateStationDrawer({
  isOpen,
  onClose,
  organizationId,
  existingStationNames = [],
  onSuccess,
  triggerRef,
}: CreateStationDrawerProps) {
  const [stationName, setStationName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const createStationMutation = useMutation(api.stations.create);

  // Clean form state when drawer opens or closes
  useEffect(() => {
    if (isOpen) {
      setStationName("");
      setValidationError(null);
      setServerError(null);
      setIsSubmitting(false);

      // Focus input after opening animation
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // Restore focus to trigger element when drawer closes
      if (triggerRef?.current) {
        triggerRef.current.focus();
      }
    }
  }, [isOpen, triggerRef]);

  // Handle Escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Live preview title
  const trimmedForPreview = stationName.trim();
  const displayPreviewName = trimmedForPreview || "STATION NAME";

  // Validate station name input
  const validate = (): string | null => {
    const trimmed = stationName.trim();
    if (!trimmed) {
      return "Station name is required.";
    }

    // Check duplicate name in current organization (legacy parity)
    const isDuplicate = existingStationNames.some(
      (name) => name.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (isDuplicate) {
      return `Hey! ${trimmed} is already taken.`;
    }

    return null;
  };

  const handleInputChange = (value: string) => {
    setStationName(value);
    if (validationError || serverError) {
      setValidationError(null);
      setServerError(null);
    }
  };

  const handleSubmit = async (e?: FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (isSubmitting) return;

    const error = validate();
    if (error) {
      setValidationError(error);
      inputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    setServerError(null);

    try {
      const res = await createStationMutation({
        organizationId,
        name: stationName.trim(),
        isMain: false,
      });

      if (res && res.id) {
        onSuccess?.(res.id, stationName.trim());
        onClose();
      }
    } catch (err: any) {
      console.error("Failed to create station:", err);
      const rawMsg = err.message || "Failed to create station. Please try again.";
      // Clean up Convex error prefix if present
      const cleanMsg = rawMsg.replace(/^.*?Server Error\s*/i, "").replace(/^Uncaught Error:\s*/i, "");
      setServerError(cleanMsg);
      inputRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        id="create-station-backdrop"
        data-testid="create-station-backdrop"
        onClick={() => {
          if (!isSubmitting) onClose();
        }}
        className={`fixed inset-0 bg-[#000000]/30 backdrop-blur-[2px] z-50 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside
        ref={drawerRef}
        id="create-station-drawer"
        data-testid="create-station-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-station-title"
        className={`fixed top-0 right-0 h-full w-full max-w-lg bg-[#ffffff] z-50 shadow-2xl transition-transform duration-300 flex flex-col justify-between border-l border-[#d0c4be]/40 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-6 bg-[#faf2ee] border-b border-[#e9e1dd] shrink-0">
          <div className="space-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#7f7570] block">
              CONFIGURATION MODULE
            </span>
            <h2
              id="create-station-title"
              className="text-2xl lg:text-3xl font-garamond text-[#1e1b19] font-normal tracking-tight"
            >
              Create station
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            aria-label="Close drawer"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#645d58] hover:text-[#1e1b19] hover:bg-[#eae1da] transition-colors focus:outline-none focus:ring-2 focus:ring-[#000000] cursor-pointer disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-[#1e1b19]">
          {/* Informational Panel */}
          <div className="p-4 rounded-xl bg-[#faf2ee] border border-[#d0c4be]/40 text-xs text-[#4d4541] flex items-start gap-3 leading-relaxed">
            <div className="w-7 h-7 rounded-full bg-[#eae1da] text-[#1e1b19] flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
              </svg>
            </div>
            <p className="mt-0.5">
              Add a new kitchen terminal to route specific menu categories and food orders.
            </p>
          </div>

          {/* Form */}
          <form id="create-station-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="station-name-input" className="text-xs font-semibold text-[#1e1b19] block">
                Station name <span className="text-[#ba1a1a]">*</span>
              </label>
              <input
                ref={inputRef}
                id="station-name-input"
                name="stationName"
                type="text"
                value={stationName}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="Enter station name"
                disabled={isSubmitting}
                aria-required="true"
                aria-invalid={Boolean(validationError || serverError)}
                aria-describedby={
                  validationError
                    ? "station-name-error"
                    : serverError
                    ? "station-name-server-error"
                    : "station-name-helper"
                }
                className={`w-full px-4 py-2.5 bg-[#ffffff] text-[#1e1b19] placeholder:text-[#7f7570] text-sm rounded-full border transition-all focus:outline-none focus:ring-2 ${
                  validationError || serverError
                    ? "border-[#ba1a1a] focus:ring-[#ba1a1a]"
                    : "border-[#d0c4be] focus:border-[#000000] focus:ring-[#000000]"
                }`}
              />

              {/* Inline Validation Error */}
              {validationError && (
                <p
                  id="station-name-error"
                  role="alert"
                  className="text-xs text-[#ba1a1a] font-medium flex items-center gap-1.5 mt-1"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
                    <circle cx="12" cy="16" r="1" fill="currentColor" />
                  </svg>
                  <span>{validationError}</span>
                </p>
              )}

              {/* Server Error Message */}
              {serverError && (
                <p
                  id="station-name-server-error"
                  role="alert"
                  className="text-xs text-[#ba1a1a] font-medium flex items-center gap-1.5 mt-1"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{serverError}</span>
                </p>
              )}

              {/* Helper Text */}
              <p id="station-name-helper" className="text-xs text-[#645d58] leading-relaxed pt-0.5">
                Station names appear on KDS screens, order routing tags, and kitchen order tickets (KOT).
              </p>
            </div>
          </form>

          {/* Live Station Display Preview */}
          <div className="space-y-2 pt-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#7f7570] block">
              STATION DISPLAY PREVIEW
            </span>

            <div className="p-5 rounded-2xl bg-[#faf2ee] border border-[#d0c4be]/40 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#000000] text-white flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 01-6.23-.693L4.2 13.9" />
                  </svg>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#7f7570] block">
                    TICKET HEADER OUTPUT
                  </span>
                  <div
                    data-testid="station-preview-output"
                    className={`text-xl lg:text-2xl font-garamond font-normal uppercase tracking-tight transition-colors ${
                      trimmedForPreview ? "text-[#1e1b19]" : "text-[#7f7570]/70 italic"
                    }`}
                  >
                    {displayPreviewName}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#d0c4be]/30 flex items-center justify-between text-[11px] text-[#645d58]">
                <span>Status: Line Active</span>
                <span className="font-mono text-[10px]">0 queued tickets</span>
              </div>
            </div>
          </div>
        </div>

        {/* Drawer Sticky Footer */}
        <div className="p-6 bg-[#faf2ee] border-t border-[#e9e1dd] flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-full text-[#645d58] text-xs font-semibold hover:text-[#1e1b19] hover:bg-[#eae1da] transition-colors focus:outline-none focus:ring-2 focus:ring-[#000000] cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-station-form"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#000000] text-white text-xs font-semibold shadow-xs hover:bg-[#1d1b1a] transition-colors focus:outline-none focus:ring-2 focus:ring-[#000000] cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-1 h-3.5 w-3.5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                <span>Creating station...</span>
              </>
            ) : (
              <span>Create station</span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
