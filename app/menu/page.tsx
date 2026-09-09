"use client";

import { useState, useEffect, useMemo, useRef, type FormEvent } from "react";
import { useQuery, useMutation } from "convex/react";
import { PosShell } from "../components/PosShell";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

// ==========================================
// PIXEL-PERFECT ICONS (PREST THEME)
// ==========================================

function EditPencilIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function PlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
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

function ChevronRightIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function DragHandleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
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

function TrashIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}


function CopyIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function EyeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function AlertTriangleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ImageIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function ClockIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function PowerIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  );
}

function InfoIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function CheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function MoreVerticalIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

// Allergen Options
const ALLERGEN_OPTIONS = [
  { id: "Soy", name: "Soy", icon: "🫘" },
  { id: "Sulphite", name: "Sulphite", icon: "🧪" },
  { id: "Nuts", name: "Nuts", icon: "🥜" },
  { id: "Wheat", name: "Wheat", icon: "🌾" },
  { id: "Milk", name: "Milk", icon: "🥛" },
  { id: "Celery", name: "Celery", icon: "🥬" },
  { id: "Lupin", name: "Lupin", icon: "🌱" },
  { id: "Sesame", name: "Sesame", icon: "⚪" },
  { id: "Mustard", name: "Mustard", icon: "🫙" },
  { id: "Egg", name: "Egg", icon: "🥚" },
  { id: "Fish", name: "Fish", icon: "🐟" },
  { id: "Crustaceans", name: "Crustaceans", icon: "🦐" },
  { id: "Pork", name: "Pork", icon: "🥓" },
];

export interface ChildNutrient {
  id: string;
  name: string;
  quantity?: string;
  dailyValue?: string;
}

export interface NutrientItem {
  id: string;
  name: string;
  quantity?: string;
  dailyValue?: string;
  children?: ChildNutrient[];
}

function RichTextDescriptionEditor({
  value,
  onChange,
  placeholder = "Enter item description",
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);
  const [activeStates, setActiveStates] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    h1: false,
    h2: false,
    h3: false,
    orderedList: false,
    unorderedList: false,
    format: "normal",
  });

  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (editorRef.current && editorRef.current.innerHTML !== (value || "")) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const updateActiveStates = () => {
    if (!editorRef.current) return;
    try {
      const isBold = document.queryCommandState("bold");
      const isItalic = document.queryCommandState("italic");
      const isUnderline = document.queryCommandState("underline");
      const isStrike = document.queryCommandState("strikeThrough");
      const isOrdered = document.queryCommandState("insertOrderedList");
      const isUnordered = document.queryCommandState("insertUnorderedList");

      let currentBlock = "";
      try {
        currentBlock = (document.queryCommandValue("formatBlock") || "").replace(/[<>]/g, "").toLowerCase();
      } catch (e) {}

      // Fallback ancestor check
      const sel = window.getSelection();
      if (sel && sel.anchorNode && editorRef.current.contains(sel.anchorNode)) {
        let node: Node | null = sel.anchorNode;
        while (node && node !== editorRef.current) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = (node as HTMLElement).tagName?.toLowerCase();
            if (tag === "h1" || tag === "h2" || tag === "h3") {
              currentBlock = tag;
              break;
            }
          }
          node = node.parentNode;
        }
      }

      const format = currentBlock === "h1" ? "h1" : currentBlock === "h2" ? "h2" : currentBlock === "h3" ? "h3" : "normal";

      setActiveStates({
        bold: isBold,
        italic: isItalic,
        underline: isUnderline,
        strike: isStrike,
        h1: format === "h1",
        h2: format === "h2",
        h3: format === "h3",
        orderedList: isOrdered,
        unorderedList: isUnordered,
        format,
      });
    } catch (e) {}
  };

  const focusEditor = () => {
    if (!editorRef.current) return;
    if (document.activeElement !== editorRef.current) {
      editorRef.current.focus();
    }
  };

  const notifyChange = () => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
      updateActiveStates();
    }
  };

  const exec = (command: string, arg?: string) => {
    focusEditor();
    try {
      document.execCommand(command, false, arg);
    } catch (e) {
      console.error("execCommand error:", e);
    }
    notifyChange();
  };

  const toggleHeading = (level: "h1" | "h2") => {
    focusEditor();
    try {
      if (activeStates[level]) {
        // Toggle off back to normal paragraph
        const success = document.execCommand("formatBlock", false, "<p>");
        if (!success) document.execCommand("formatBlock", false, "p");
      } else {
        // Toggle heading on
        const success = document.execCommand("formatBlock", false, `<${level}>`);
        if (!success) document.execCommand("formatBlock", false, level);
      }
    } catch (e) {
      try {
        document.execCommand("formatBlock", false, level);
      } catch (err) {}
    }
    notifyChange();
  };

  const handleFormatChange = (format: string) => {
    focusEditor();
    try {
      if (format === "h1") {
        document.execCommand("formatBlock", false, "<h1>") || document.execCommand("formatBlock", false, "h1");
      } else if (format === "h2") {
        document.execCommand("formatBlock", false, "<h2>") || document.execCommand("formatBlock", false, "h2");
      } else if (format === "h3") {
        document.execCommand("formatBlock", false, "<h3>") || document.execCommand("formatBlock", false, "h3");
      } else {
        document.execCommand("formatBlock", false, "<p>") || document.execCommand("formatBlock", false, "p");
      }
    } catch (e) {}
    notifyChange();
  };

  const handleInput = () => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
      updateActiveStates();
    }
  };

  return (
    <div className="space-y-2 font-sans">
      {/* Quill-style Toolbar matching prest design */}
      <div className="bg-[#fcfbfa] border border-[#e7e5e4] rounded-xl p-2.5 space-y-2 select-none shadow-2xs">
        {/* Row 1: Inline & Block Controls */}
        <div className="flex flex-wrap items-center gap-1 text-[#0c0a09]">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              exec("bold");
            }}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors font-bold text-sm cursor-pointer ${
              activeStates.bold ? "bg-[#0c0a09] text-white" : "hover:bg-[#e7e5e4] text-[#0c0a09]"
            }`}
            title="Bold"
          >
            B
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              exec("italic");
            }}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors italic font-serif text-sm cursor-pointer ${
              activeStates.italic ? "bg-[#0c0a09] text-white" : "hover:bg-[#e7e5e4] text-[#0c0a09]"
            }`}
            title="Italic"
          >
            I
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              exec("underline");
            }}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors underline text-sm cursor-pointer ${
              activeStates.underline ? "bg-[#0c0a09] text-white" : "hover:bg-[#e7e5e4] text-[#0c0a09]"
            }`}
            title="Underline"
          >
            U
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              exec("strikeThrough");
            }}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors line-through text-sm cursor-pointer ${
              activeStates.strike ? "bg-[#0c0a09] text-white" : "hover:bg-[#e7e5e4] text-[#0c0a09]"
            }`}
            title="Strikethrough"
          >
            S
          </button>

          <span className="w-px h-4 bg-[#e7e5e4] mx-1" />

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              toggleHeading("h1");
            }}
            className={`w-8 h-7 rounded flex items-center justify-center transition-colors font-bold text-xs cursor-pointer ${
              activeStates.h1 ? "bg-[#0c0a09] text-white" : "hover:bg-[#e7e5e4] text-[#0c0a09]"
            }`}
            title="Heading 1"
          >
            H<sub className="text-[9px]">1</sub>
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              toggleHeading("h2");
            }}
            className={`w-8 h-7 rounded flex items-center justify-center transition-colors font-bold text-xs cursor-pointer ${
              activeStates.h2 ? "bg-[#0c0a09] text-white" : "hover:bg-[#e7e5e4] text-[#0c0a09]"
            }`}
            title="Heading 2"
          >
            H<sub className="text-[9px]">2</sub>
          </button>

          <span className="w-px h-4 bg-[#e7e5e4] mx-1" />

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              exec("insertOrderedList");
            }}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors text-xs cursor-pointer ${
              activeStates.orderedList ? "bg-[#0c0a09] text-white" : "hover:bg-[#e7e5e4] text-[#0c0a09]"
            }`}
            title="Numbered List"
          >
            <span className="font-mono text-[11px] leading-none">1≡</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              exec("insertUnorderedList");
            }}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors text-xs cursor-pointer ${
              activeStates.unorderedList ? "bg-[#0c0a09] text-white" : "hover:bg-[#e7e5e4] text-[#0c0a09]"
            }`}
            title="Bullet List"
          >
            <span className="font-mono text-[11px] leading-none">•≡</span>
          </button>

          <span className="w-px h-4 bg-[#e7e5e4] mx-1" />

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              exec("outdent");
            }}
            className="w-7 h-7 rounded flex items-center justify-center hover:bg-[#e7e5e4] transition-colors text-xs cursor-pointer text-[#0c0a09]"
            title="Outdent"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="21" y1="4" x2="11" y2="4" />
              <line x1="21" y1="12" x2="11" y2="12" />
              <line x1="21" y1="20" x2="11" y2="20" />
              <polyline points="7 8 3 12 7 16" />
            </svg>
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              exec("indent");
            }}
            className="w-7 h-7 rounded flex items-center justify-center hover:bg-[#e7e5e4] transition-colors text-xs cursor-pointer text-[#0c0a09]"
            title="Indent"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="21" y1="4" x2="11" y2="4" />
              <line x1="21" y1="12" x2="11" y2="12" />
              <line x1="21" y1="20" x2="11" y2="20" />
              <polyline points="3 8 7 12 3 16" />
            </svg>
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              handleFormatChange("normal");
            }}
            className="w-7 h-7 rounded flex items-center justify-center hover:bg-[#e7e5e4] transition-colors text-xs cursor-pointer text-[#0c0a09]"
            title="Paragraph"
          >
            ¶
          </button>
        </div>

        {/* Row 2: Heading Dropdown & Clean Format */}
        <div className="flex items-center gap-2 pt-1 border-t border-[#f0efed]">
          <div className="relative inline-flex items-center">
            <select
              value={activeStates.format}
              onChange={(e) => handleFormatChange(e.target.value)}
              className="bg-white border border-[#e7e5e4] rounded px-2.5 py-1 text-xs text-[#0c0a09] font-medium pr-6 focus:outline-none cursor-pointer"
            >
              <option value="normal">Normal</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
            </select>
          </div>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              exec("removeFormat");
              handleFormatChange("normal");
            }}
            className="px-2 py-1 hover:bg-[#e7e5e4] rounded text-xs font-semibold text-[#5e5e5e] hover:text-[#0c0a09] transition-colors flex items-center gap-1 cursor-pointer"
            title="Clear Formatting"
          >
            <span className="font-serif italic text-sm">T</span><sub className="text-[9px]">x</sub>
          </button>
        </div>
      </div>

      {/* Editor Content Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        onKeyUp={updateActiveStates}
        onMouseUp={updateActiveStates}
        data-placeholder={placeholder}
        className="rich-text-editor w-full bg-white border border-[#e7e5e4] rounded-lg p-3.5 min-h-[110px] focus:outline-none focus:border-[#141010] focus:ring-1 focus:ring-[#141010] text-[#0c0a09] text-sm leading-relaxed overflow-y-auto"
      />
    </div>
  );
}

// Helper to strip HTML tags for plain text table/list previews
function stripHtml(html?: string): string {
  if (!html) return "";
  return html.replace(/<[^>]*>?/gm, "").trim();
}

// Dietary Item Types
const DIETARY_TYPES = [
  { id: "veg", label: "Vegetarian", icon: "🟢" },
  { id: "non_veg", label: "Non-Veg", icon: "🔴" },
  { id: "vegan", label: "Vegan", icon: "🌿" },
  { id: "jain", label: "Jain", icon: "🟡" },
  { id: "egg", label: "Contains Egg", icon: "🥚" },
];

// Helper to generate next copy name e.g. Vadapav(1), Vadapav(2)
function getNextDuplicateName(baseName: string, existingNames: string[]): string {
  const match = baseName.match(/^(.*?)(?:\s*\(\d+\))?$/);
  const rootName = match && match[1] ? match[1].trim() : baseName;

  let counter = 1;
  let candidate = `${rootName}(${counter})`;
  while (existingNames.includes(candidate)) {
    counter++;
    candidate = `${rootName}(${counter})`;
  }
  return candidate;
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function MenuPage() {
  const organizations = useQuery(api.organizations.list);
  const organization = organizations?.[0] ?? null;

  // Tax & Currency Configuration
  const taxSettings = useQuery(
    api.taxation.getStoreTaxSettings,
    organization?._id ? { organizationId: organization._id } : "skip"
  );
  const taxGroups = useQuery(
    api.taxation.listTaxGroups,
    organization?._id ? { organizationId: organization._id } : "skip"
  );
  const taxComponents = useQuery(
    api.taxation.listTaxComponents,
    organization?._id ? { organizationId: organization._id } : "skip"
  );

  const currencySymbol = taxSettings?.currencySymbol || "₹";

  // Multi-Menu Queries & Mutations
  const menus = useQuery(
    api.menu.listMenus,
    organization?._id ? { organizationId: organization._id } : "skip"
  );
  const createMenuMutation = useMutation(api.menu.createMenu);
  const updateMenuMutation = useMutation(api.menu.updateMenu);
  const setDefaultMenuMutation = useMutation(api.menu.setDefaultMenu);
  const deleteMenuMutation = useMutation(api.menu.deleteMenu);
  const seedSampleMenuMutation = useMutation(api.menu.seedSampleMenu);

  // Category Mutations
  const createCategoryMutation = useMutation(api.menu.createCategory);
  const updateCategoryMutation = useMutation(api.menu.updateCategory);
  const toggleCategoryPublishedMutation = useMutation(api.menu.toggleCategoryPublished);
  const deleteCategoryMutation = useMutation(api.menu.deleteCategory);
  const reorderCategoriesMutation = useMutation(api.menu.reorderCategories);

  // Item Mutations
  const createItemMutation = useMutation(api.menu.createItem);
  const addCategoryItemMutation = useMutation(api.menu.addCategoryItem);
  const updateItemMutation = useMutation(api.menu.updateItem);
  const toggleItemAvailabilityMutation = useMutation(api.menu.toggleItemAvailability);
  const toggleItemPublishedMutation = useMutation(api.menu.toggleItemPublished);
  const deleteItemMutation = useMutation(api.menu.deleteItem);
  const reorderCategoryItemsMutation = useMutation(api.menu.reorderCategoryItems);
  const addExistingItemToCategoryMutation = useMutation(api.menu.addExistingItemToCategory);
  const duplicateItemMutation = useMutation(api.menu.duplicateItem);
  const setItemUnavailabilityMutation = useMutation(api.menu.setItemUnavailability);

  // Customization Mutations
  const createCustomizationMutation = useMutation(api.menu.createCustomization);
  const updateCustomizationMutation = useMutation(api.menu.updateCustomization);
  const deleteCustomizationMutation = useMutation(api.menu.deleteCustomization);
  const createCustomizationItemMutation = useMutation(api.menu.createCustomizationItem);
  const updateCustomizationItemMutation = useMutation(api.menu.updateCustomizationItem);
  const deleteCustomizationItemMutation = useMutation(api.menu.deleteCustomizationItem);
  const duplicateCustomizationItemMutation = useMutation(api.menu.duplicateCustomizationItem);
  const setCustomizationItemUnavailabilityMutation = useMutation(api.menu.setCustomizationItemUnavailability);
  const reorderCustomizationItemsMutation = useMutation(api.menu.reorderCustomizationItems);
  const reorderCustomizationsMutation = useMutation(api.menu.reorderCustomizations);
  const copyCustomizationToItemMutation = useMutation(api.menu.copyCustomizationToItem);

  // Dynamic Item Types from Convex itemTypes table
  const rawItemTypes = useQuery(
    api.menu.listItemTypes,
    organization?._id ? { organizationId: organization._id } : "skip"
  );
  const ensureItemTypesMutation = useMutation(api.menu.ensureDefaultItemTypes);

  useEffect(() => {
    if (organization?._id && rawItemTypes !== undefined && rawItemTypes.length === 0) {
      ensureItemTypesMutation({ organizationId: organization._id }).catch(console.error);
    }
  }, [organization?._id, rawItemTypes, ensureItemTypesMutation]);

  const availableItemTypes = useMemo(() => {
    if (rawItemTypes && rawItemTypes.length > 0) {
      return rawItemTypes.map((t) => ({
        id: t._id,
        name: t.name,
        label: t.name,
        icon: t.icon || (t.name.toLowerCase().includes("non") ? "🔴" : t.name.toLowerCase().includes("vegan") ? "🌿" : t.name.toLowerCase().includes("jain") ? "🟡" : t.name.toLowerCase().includes("egg") ? "🥚" : "🟢"),
      }));
    }
    return [
      { id: "veg", name: "Vegetarian", label: "Vegetarian", icon: "🟢" },
      { id: "non_veg", name: "Non-Veg", label: "Non-Veg", icon: "🔴" },
      { id: "vegan", name: "Vegan", label: "Vegan", icon: "🌿" },
      { id: "jain", name: "Jain", label: "Jain", icon: "🟡" },
      { id: "egg", name: "Contains Egg", label: "Contains Egg", icon: "🥚" },
    ];
  }, [rawItemTypes]);

  // Active Selections
  const [selectedMenuId, setSelectedMenuId] = useState<Id<"menus"> | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<Id<"categories"> | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<Id<"items"> | null>(null);
  const [selectedCustomizationId, setSelectedCustomizationId] = useState<Id<"customizations"> | null>(null);

  // Initialize Default Menu
  useEffect(() => {
    if (menus && menus.length > 0 && !selectedMenuId) {
      const def = menus.find((m) => m.isDefault) || menus[0];
      setSelectedMenuId(def._id);
    }
  }, [menus, selectedMenuId]);

  const activeMenu = useMemo(() => {
    return menus?.find((m) => m._id === selectedMenuId) || menus?.[0] || null;
  }, [menus, selectedMenuId]);

  // Categories query
  const categories = useQuery(
    api.menu.listCategories,
    activeMenu?._id ? { menuId: activeMenu._id } : "skip"
  );

  // Initialize Default Category
  useEffect(() => {
    if (categories && categories.length > 0) {
      if (!selectedCategoryId || !categories.some((c) => c._id === selectedCategoryId)) {
        setSelectedCategoryId(categories[0]._id);
      }
    } else {
      setSelectedCategoryId(null);
    }
  }, [categories, selectedCategoryId]);

  const activeCategory = useMemo(() => {
    return categories?.find((c) => c._id === selectedCategoryId) || categories?.[0] || null;
  }, [categories, selectedCategoryId]);

  // Category Items query
  const categoryItems = useQuery(
    api.menu.listCategoryItems,
    activeCategory?._id ? { categoryId: activeCategory._id } : "skip"
  );

  // Active selected item for customizations view
  const activeItem = useMemo(() => {
    if (!selectedItemId) return null;
    return categoryItems?.find((ci) => ci.item._id === selectedItemId)?.item || null;
  }, [categoryItems, selectedItemId]);

  // Customizations for Active Item
  const itemCustomizations = useQuery(
    api.menu.listCustomizations,
    selectedItemId ? { itemId: selectedItemId } : "skip"
  );

  // Active selected customization for choices / options view
  const activeCustomization = useMemo(() => {
    if (!selectedCustomizationId) return null;
    return itemCustomizations?.find((c) => c._id === selectedCustomizationId) || null;
  }, [itemCustomizations, selectedCustomizationId]);

  // Choice Item Search Query State
  const [choiceSearchQuery, setChoiceSearchQuery] = useState("");
  const [draggedChoiceIndex, setDraggedChoiceIndex] = useState<number | null>(null);
  const [dragOverChoiceIndex, setDragOverChoiceIndex] = useState<number | null>(null);
  const [draggedCustomizationIndex, setDraggedCustomizationIndex] = useState<number | null>(null);
  const [dragOverCustomizationIndex, setDragOverCustomizationIndex] = useState<number | null>(null);

  const filteredChoices = useMemo(() => {
    if (!activeCustomization?.items) return [];
    if (!choiceSearchQuery.trim()) return activeCustomization.items;
    const q = choiceSearchQuery.toLowerCase();
    return activeCustomization.items.filter(
      (c: any) =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [activeCustomization, choiceSearchQuery]);

  // All existing items for 'Add Existing Item' Drawer
  const allExistingItems = useQuery(
    api.menu.listAllItems,
    organization?._id
      ? {
          organizationId: organization._id,
          categoryId: activeCategory?._id,
        }
      : "skip"
  );

  // All existing customizations for 'Add Existing Customization' Drawer
  const allExistingCustomizations = useQuery(
    api.menu.listAllCustomizations,
    organization?._id
      ? {
          organizationId: organization._id,
          currentItemId: selectedItemId || undefined,
        }
      : "skip"
  );

  // Dropdown States
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false);
  const [isAddItemDropdownOpen, setIsAddItemDropdownOpen] = useState(false);
  const [isAddCustomizationDropdownOpen, setIsAddCustomizationDropdownOpen] = useState(false);

  // Drawer & Modal States
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [isEditMenuOpen, setIsEditMenuOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isAddExistingItemOpen, setIsAddExistingItemOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);

  // Customization Group Drawers & Modals
  const [isAddCustomizationOpen, setIsAddCustomizationOpen] = useState(false);
  const [isAddExistingCustomizationOpen, setIsAddExistingCustomizationOpen] = useState(false);
  const [selectedExistingCustomization, setSelectedExistingCustomization] = useState<any>(null);
  const [existingCustomizationSearchQuery, setExistingCustomizationSearchQuery] = useState("");
  const [isCopyingCustomization, setIsCopyingCustomization] = useState(false);
  const [existingCustomizationError, setExistingCustomizationError] = useState<string | null>(null);
  const [isEditCustomizationOpen, setIsEditCustomizationOpen] = useState(false);
  const [editingCustomization, setEditingCustomization] = useState<any>(null);
  const [isDeleteCustomizationOpen, setIsDeleteCustomizationOpen] = useState(false);
  const [deletingCustomizationId, setDeletingCustomizationId] = useState<Id<"customizations"> | null>(null);

  // Customization Choice (Item) Drawers & Modals
  const [isAddChoiceOpen, setIsAddChoiceOpen] = useState(false);
  const [isEditChoiceOpen, setIsEditChoiceOpen] = useState(false);
  const [editingChoice, setEditingChoice] = useState<any>(null);
  const [isDeleteChoiceOpen, setIsDeleteChoiceOpen] = useState(false);
  const [deletingChoiceId, setDeletingChoiceId] = useState<Id<"customizationItems"> | null>(null);

  // Change Unavailability Modal State
  const [isUnavailabilityModalOpen, setIsUnavailabilityModalOpen] = useState(false);
  const [targetUnavailabilityItem, setTargetUnavailabilityItem] = useState<any>(null);
  const [unavailabilityTargetType, setUnavailabilityTargetType] = useState<"item" | "choice">("item");
  const [unavailabilityToggle, setUnavailabilityToggle] = useState(true);
  const [unavailabilityDuration, setUnavailabilityDuration] = useState<"12" | "24" | "48" | "custom">("24");
  const [customDurationHours, setCustomDurationHours] = useState("72");
  const [isSavingUnavailability, setIsSavingUnavailability] = useState(false);

  // Duplicate Item Modal State
  const [isDuplicateItemModalOpen, setIsDuplicateItemModalOpen] = useState(false);
  const [targetDuplicateItem, setTargetDuplicateItem] = useState<any>(null);
  const [duplicateTargetType, setDuplicateTargetType] = useState<"item" | "choice">("item");
  const [duplicateItemNewName, setDuplicateItemNewName] = useState("");
  const [isDuplicatingItem, setIsDuplicatingItem] = useState(false);

  // Delete Item Modal State
  const [isDeleteItemModalOpen, setIsDeleteItemModalOpen] = useState(false);
  const [targetDeleteItem, setTargetDeleteItem] = useState<any>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  // Delete Category Modal State
  const [isDeleteCategoryModalOpen, setIsDeleteCategoryModalOpen] = useState(false);
  const [targetDeleteCategory, setTargetDeleteCategory] = useState<any>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  // Customization Form State
  const [customizationType, setCustomizationType] = useState<"AddOns" | "Preparations">("AddOns");
  const [customizationName, setCustomizationName] = useState("");
  const [customizationDesc, setCustomizationDesc] = useState("");
  const [customizationRequired, setCustomizationRequired] = useState(false);
  const [customizationMaxSelected, setCustomizationMaxSelected] = useState(1);
  const [customizationPublished, setCustomizationPublished] = useState(true);
  const [isSavingCustomization, setIsSavingCustomization] = useState(false);

  // Choice Item Form State
  const [choiceName, setChoiceName] = useState("");
  const [choicePrice, setChoicePrice] = useState("0");
  const [choiceDescription, setChoiceDescription] = useState("");
  const [choiceIsAvailable, setChoiceIsAvailable] = useState(true);
  const [choiceDietaryType, setChoiceDietaryType] = useState<string>("veg");
  const [choiceShowQuantity, setChoiceShowQuantity] = useState(false);
  const [choiceQuantity, setChoiceQuantity] = useState("");
  const [choiceQuantityUnit, setChoiceQuantityUnit] = useState("g");
  const [choiceShowCalorie, setChoiceShowCalorie] = useState(false);
  const [choiceCalorie, setChoiceCalorie] = useState("");
  const [choiceCalorieMetric, setChoiceCalorieMetric] = useState("kcal");
  const [choiceIsGst, setChoiceIsGst] = useState(false);
  const [choiceSelectedTaxGroupId, setChoiceSelectedTaxGroupId] = useState<string>("");
  const [choiceTaxMode, setChoiceTaxMode] = useState<"inclusive" | "exclusive">("inclusive");
  const [isChoiceAdvancedOpen, setIsChoiceAdvancedOpen] = useState(false);
  const [isSavingChoice, setIsSavingChoice] = useState(false);

  // Active Tax Group resolved for choice tax calculations
  const resolvedChoiceTaxGroup = useMemo(() => {
    if (!taxGroups || taxGroups.length === 0) return null;
    if (choiceSelectedTaxGroupId) {
      return taxGroups.find((g) => g._id === choiceSelectedTaxGroupId) || null;
    }
    return taxGroups.find((g) => g.isDefault) || taxGroups[0] || null;
  }, [taxGroups, choiceSelectedTaxGroupId]);

  // Choice Tax Breakdown computation
  const choiceTaxBreakdown = useMemo(() => {
    const rawPrice = parseFloat(choicePrice || "0");
    if (isNaN(rawPrice) || rawPrice <= 0 || !choiceIsGst || !resolvedChoiceTaxGroup) {
      return null;
    }

    let components = (taxComponents || []).filter((c) =>
      resolvedChoiceTaxGroup.componentIds?.includes(c._id)
    );

    if (components.length === 0) {
      components = [
        { _id: "tax_demo" as any, _creationTime: 0, name: "Tax", code: "TAX", rate: 5.0, organizationId: "" as any, createdAt: 0 },
      ];
    }
    const totalRate = components.reduce((sum, c) => sum + c.rate, 0) || 5;

    if (totalRate <= 0) return null;

    if (choiceTaxMode === "inclusive") {
      const base = rawPrice / (1 + totalRate / 100);
      const totalTax = rawPrice - base;
      const computedComponents = components.map((c) => ({
        name: c.name,
        rate: c.rate,
        amount: ((base * c.rate) / 100).toFixed(2),
      }));
      return {
        mode: "inclusive" as const,
        basePrice: base.toFixed(2),
        totalTax: totalTax.toFixed(2),
        finalPrice: rawPrice.toFixed(2),
        totalRate,
        components: computedComponents,
      };
    } else {
      const base = rawPrice;
      const computedComponents = components.map((c) => ({
        name: c.name,
        rate: c.rate,
        amount: ((base * c.rate) / 100).toFixed(2),
      }));
      const totalTax = computedComponents.reduce((sum, c) => sum + parseFloat(c.amount), 0);
      const finalPrice = base + totalTax;
      return {
        mode: "exclusive" as const,
        basePrice: base.toFixed(2),
        totalTax: totalTax.toFixed(2),
        finalPrice: finalPrice.toFixed(2),
        totalRate,
        components: computedComponents,
      };
    }
  }, [choicePrice, choiceIsGst, resolvedChoiceTaxGroup, taxComponents, choiceTaxMode]);

  // Menu Form State
  const [menuName, setMenuName] = useState("");
  const [menuDescription, setMenuDescription] = useState("");
  const [isCreatingMenu, setIsCreatingMenu] = useState(false);
  const [createMenuError, setCreateMenuError] = useState<string | null>(null);

  const [editMenuName, setEditMenuName] = useState("");
  const [editMenuDescription, setEditMenuDescription] = useState("");
  const [isSavingMenu, setIsSavingMenu] = useState(false);

  // Category Form State
  const [categoryName, setCategoryName] = useState("");
  const [categoryPublished, setCategoryPublished] = useState(true);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Item Form State (with International Tax Engine)
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemIsVeg, setItemIsVeg] = useState(true);
  const [selectedDietaryType, setSelectedDietaryType] = useState("veg");
  const [itemShowItemType, setItemShowItemType] = useState(true);
  const [itemIsSpicy, setItemIsSpicy] = useState(false);
  const [itemIsAvailable, setItemIsAvailable] = useState(true);
  const [itemShowQuantity, setItemShowQuantity] = useState(false);
  const [itemQuantity, setItemQuantity] = useState("");
  const [itemQuantityUnit, setItemQuantityUnit] = useState("g");
  const [itemMarkAsBestseller, setItemMarkAsBestseller] = useState(false);
  const [itemSkuNumber, setItemSkuNumber] = useState("");
  const [itemSelectedCategoryId, setItemSelectedCategoryId] = useState("");
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

  // Nutrition Information State (Configured during item edit)
  const [itemServingSize, setItemServingSize] = useState("");
  const [itemServing, setItemServing] = useState("");
  const [itemCaloriesPerServing, setItemCaloriesPerServing] = useState("");
  const [itemProtein, setItemProtein] = useState("");
  const [itemCarbs, setItemCarbs] = useState("");
  const [itemFat, setItemFat] = useState("");
  const [itemFiber, setItemFiber] = useState("");
  const [itemSugar, setItemSugar] = useState("");
  const [itemSodium, setItemSodium] = useState("");
  const [itemShowAllergens, setItemShowAllergens] = useState(false);
  const [itemSelectedAllergens, setItemSelectedAllergens] = useState<string[]>([]);
  const [itemNutrients, setItemNutrients] = useState<NutrientItem[]>([]);
  const [newNutrientName, setNewNutrientName] = useState("");
  const [activeNutrientMenuId, setActiveNutrientMenuId] = useState<string | null>(null);
  const [editingNutrientId, setEditingNutrientId] = useState<string | null>(null);
  const [editingNutrientName, setEditingNutrientName] = useState("");
  const [addingChildForNutrientId, setAddingChildForNutrientId] = useState<string | null>(null);
  const [childNutrientNameInput, setChildNutrientNameInput] = useState("");

  const handleToggleAllergen = (allergenName: string) => {
    setItemSelectedAllergens((prev) =>
      prev.includes(allergenName)
        ? prev.filter((a) => a !== allergenName)
        : [...prev, allergenName]
    );
  };

  const handleAddNutrient = () => {
    if (!newNutrientName.trim()) return;
    const newNutrient: NutrientItem = {
      id: `nut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: newNutrientName.trim(),
      quantity: "",
      dailyValue: "",
      children: [],
    };
    setItemNutrients((prev) => [...prev, newNutrient]);
    setNewNutrientName("");
  };

  const handleUpdateNutrient = (id: string, field: "name" | "quantity" | "dailyValue", val: string) => {
    setItemNutrients((prev) =>
      prev.map((n) => (n.id === id ? { ...n, [field]: val } : n))
    );
  };

  const handleRemoveNutrient = (id: string) => {
    setItemNutrients((prev) => prev.filter((n) => n.id !== id));
  };

  const handleAddChildNutrient = (parentId: string, childName: string) => {
    if (!childName.trim()) return;
    const newChild: ChildNutrient = {
      id: `child_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: childName.trim(),
      quantity: "",
      dailyValue: "",
    };
    setItemNutrients((prev) =>
      prev.map((n) =>
        n.id === parentId
          ? { ...n, children: [...(n.children || []), newChild] }
          : n
      )
    );
  };

  const handleUpdateChildNutrient = (
    parentId: string,
    childId: string,
    field: "name" | "quantity" | "dailyValue",
    val: string
  ) => {
    setItemNutrients((prev) =>
      prev.map((n) => {
        if (n.id !== parentId) return n;
        return {
          ...n,
          children: (n.children || []).map((c) =>
            c.id === childId ? { ...c, [field]: val } : c
          ),
        };
      })
    );
  };

  const handleRemoveChildNutrient = (parentId: string, childId: string) => {
    setItemNutrients((prev) =>
      prev.map((n) => {
        if (n.id !== parentId) return n;
        return {
          ...n,
          children: (n.children || []).filter((c) => c.id !== childId),
        };
      })
    );
  };

  // AI Assistant & Suggestions State
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiNameSuggestion, setAiNameSuggestion] = useState("Truffle Umami Burger");
  const [aiDescSuggestion, setAiDescSuggestion] = useState(
    "A decadent blend of wagyu beef, black truffle aioli, and aged gruyère on a toasted brioche bun."
  );
  const [aiNutritionSuggestion, setAiNutritionSuggestion] = useState({
    calories: "520 kcal",
    protein: "24",
    carbs: "42",
    fat: "28",
  });
  const [aiCopiedKey, setAiCopiedKey] = useState<string | null>(null);

  const handleGenerateAiSuggestions = () => {
    setIsGeneratingAi(true);
    const baseName = itemName.trim() || activeCategory?.name || "Specialty Item";
    setTimeout(() => {
      if (baseName.toLowerCase().includes("vadapav") || baseName.toLowerCase().includes("vada")) {
        setAiNameSuggestion("Artisanal Spiced Vadapav");
        setAiDescSuggestion("Crispy spiced potato dumpling encased in golden chickpea batter, served in a butter-toasted brioche pav with signature dry garlic chutney and mint relish.");
        setAiNutritionSuggestion({ calories: "290 kcal", protein: "7", carbs: "38", fat: "12" });
      } else if (baseName.toLowerCase().includes("burger")) {
        setAiNameSuggestion("Truffle Umami Burger");
        setAiDescSuggestion("A decadent blend of premium patty, black truffle aioli, caramelized onions, and aged melted cheese on a toasted brioche bun.");
        setAiNutritionSuggestion({ calories: "520 kcal", protein: "24", carbs: "42", fat: "28" });
      } else if (baseName.toLowerCase().includes("pizza")) {
        setAiNameSuggestion("Charred Sourdough Margherita");
        setAiDescSuggestion("Wood-fired 48-hour fermented sourdough crust topped with San Marzano tomatoes, fresh buffalo mozzarella, and fragrant sweet basil.");
        setAiNutritionSuggestion({ calories: "680 kcal", protein: "28", carbs: "78", fat: "22" });
      } else if (baseName.toLowerCase().includes("coffee") || baseName.toLowerCase().includes("beverage") || baseName.toLowerCase().includes("shake")) {
        setAiNameSuggestion("Velvet Cold Brew Latte");
        setAiDescSuggestion("Slow-steeped single-origin Arabica cold brew infused with organic oat milk and a touch of Madagascar vanilla bean.");
        setAiNutritionSuggestion({ calories: "140 kcal", protein: "4", carbs: "18", fat: "5" });
      } else {
        setAiNameSuggestion(`${baseName} Gourmet Supreme`);
        setAiDescSuggestion(`Signature chef-crafted ${baseName} prepared with premium fresh ingredients, balanced aromatic seasonings, and cooked to perfection.`);
        setAiNutritionSuggestion({ calories: "380 kcal", protein: "18", carbs: "32", fat: "14" });
      }
      setIsGeneratingAi(false);
    }, 450);
  };

  const handleCopyAiText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setAiCopiedKey(key);
    setTimeout(() => setAiCopiedKey(null), 1500);
  };

  // Tax Settings on Item Form
  const [itemIsGst, setItemIsGst] = useState(true);
  const [itemSelectedTaxGroupId, setItemSelectedTaxGroupId] = useState<string>("");
  const [itemTaxMode, setItemTaxMode] = useState<"inclusive" | "exclusive">("inclusive");

  // Add Existing Item State
  const [existingItemSearchQuery, setExistingItemSearchQuery] = useState("");
  const [selectedExistingItem, setSelectedExistingItem] = useState<any>(null);
  const [isAddingExistingItem, setIsAddingExistingItem] = useState(false);
  const [existingItemError, setExistingItemError] = useState<string | null>(null);

  // Active Tax Group resolved for item tax calculations
  const resolvedTaxGroup = useMemo(() => {
    if (!taxGroups || taxGroups.length === 0) return null;
    if (itemSelectedTaxGroupId) {
      return taxGroups.find((g) => g._id === itemSelectedTaxGroupId) || null;
    }
    return taxGroups.find((g) => g.isDefault) || taxGroups[0] || null;
  }, [taxGroups, itemSelectedTaxGroupId]);

  // Tax Breakdown computation
  const taxBreakdown = useMemo(() => {
    if (!itemIsGst) {
      return null;
    }

    const rawPrice = parseFloat(itemPrice || "0");
    const isDemo = isNaN(rawPrice) || rawPrice <= 0;
    const effectivePrice = isDemo ? 100 : rawPrice;

    let matchedComponents = (taxComponents || []).filter((c) =>
      resolvedTaxGroup?.componentIds?.includes(c._id)
    );

    if (matchedComponents.length === 0) {
      matchedComponents = [
        { _id: "tax_demo" as any, _creationTime: 0, name: "Tax", code: "TAX", rate: 5.0, organizationId: "" as any, createdAt: 0 },
      ];
    }

    const totalTaxRate = matchedComponents.reduce((sum, c) => sum + c.rate, 0) || 5;

    if (itemTaxMode === "inclusive") {
      const basePrice = effectivePrice / (1 + totalTaxRate / 100);
      const totalTaxAmount = effectivePrice - basePrice;
      const componentSplits = matchedComponents.map((c) => ({
        name: c.name,
        code: c.code,
        rate: c.rate,
        amount: (basePrice * (c.rate / 100)).toFixed(2),
      }));

      return {
        mode: "inclusive" as const,
        isDemo,
        basePrice: basePrice.toFixed(2),
        totalTaxAmount: totalTaxAmount.toFixed(2),
        finalPrice: effectivePrice.toFixed(2),
        components: componentSplits,
        totalRate: totalTaxRate,
      };
    } else {
      const basePrice = effectivePrice;
      const componentSplits = matchedComponents.map((c) => ({
        name: c.name,
        code: c.code,
        rate: c.rate,
        amount: (basePrice * (c.rate / 100)).toFixed(2),
      }));
      const totalTaxAmount = componentSplits.reduce((sum, c) => sum + parseFloat(c.amount), 0);
      const finalPrice = basePrice + totalTaxAmount;

      return {
        mode: "exclusive" as const,
        isDemo,
        basePrice: basePrice.toFixed(2),
        totalTaxAmount: totalTaxAmount.toFixed(2),
        finalPrice: finalPrice.toFixed(2),
        components: componentSplits,
        totalRate: totalTaxRate,
      };
    }
  }, [itemPrice, itemIsGst, resolvedTaxGroup, taxComponents, itemTaxMode]);

  // Auto seed demo menus if empty
  const handleSeedSample = async () => {
    if (!organization?._id) return;
    try {
      const menuId = await seedSampleMenuMutation({ organizationId: organization._id });
      setSelectedMenuId(menuId);
    } catch (err) {
      console.error("Failed to seed sample menu:", err);
    }
  };

  // Drag & Drop Handlers
  const handleCategoryDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleCategoryDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndexStr = e.dataTransfer.getData("text/plain");
    if (!dragIndexStr || !categories) return;
    const dragIndex = parseInt(dragIndexStr, 10);
    if (dragIndex === dropIndex) return;

    const newCategories = [...categories];
    const [moved] = newCategories.splice(dragIndex, 1);
    newCategories.splice(dropIndex, 0, moved);

    const categoryIds = newCategories.map((c) => c._id);
    try {
      await reorderCategoriesMutation({ categoryIds });
    } catch (err) {
      console.error("Failed to reorder categories:", err);
    }
  };

  const handleItemDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleItemDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndexStr = e.dataTransfer.getData("text/plain");
    if (!dragIndexStr || !categoryItems) return;
    const dragIndex = parseInt(dragIndexStr, 10);
    if (dragIndex === dropIndex) return;

    const newCategoryItems = [...categoryItems];
    const [moved] = newCategoryItems.splice(dragIndex, 1);
    newCategoryItems.splice(dropIndex, 0, moved);

    const categoryItemIds = newCategoryItems.map((ci) => ci.categoryItemId);
    try {
      await reorderCategoryItemsMutation({ categoryItemIds });
    } catch (err) {
      console.error("Failed to reorder items:", err);
    }
  };

  // Create Menu
  const handleCreateMenuSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!organization?._id || !menuName.trim()) return;
    setIsCreatingMenu(true);
    setCreateMenuError(null);
    try {
      const newMenuId = await createMenuMutation({
        organizationId: organization._id,
        name: menuName.trim(),
        description: menuDescription.trim() || undefined,
      });
      setSelectedMenuId(newMenuId);
      setIsCreateMenuOpen(false);
      setMenuName("");
      setMenuDescription("");
    } catch (err: any) {
      setCreateMenuError(err.message || "Failed to create menu");
    } finally {
      setIsCreatingMenu(false);
    }
  };

  // Edit Menu
  const openEditMenuDrawer = () => {
    if (!activeMenu) return;
    setEditMenuName(activeMenu.name);
    setEditMenuDescription(activeMenu.description || "");
    setIsEditMenuOpen(true);
  };

  const handleEditMenuSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeMenu?._id || !editMenuName.trim()) return;
    setIsSavingMenu(true);
    try {
      await updateMenuMutation({
        id: activeMenu._id,
        name: editMenuName.trim(),
        description: editMenuDescription.trim() || undefined,
      });
      setIsEditMenuOpen(false);
    } catch (err) {
      console.error("Failed to update menu:", err);
    } finally {
      setIsSavingMenu(false);
    }
  };

  // Category Actions
  const handleSaveCategorySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!organization?._id || !activeMenu?._id || !categoryName.trim()) return;
    setIsSavingCategory(true);
    try {
      if (editingCategory) {
        await updateCategoryMutation({
          id: editingCategory._id,
          name: categoryName.trim(),
          published: categoryPublished,
        });
      } else {
        const newCatId = await createCategoryMutation({
          organizationId: organization._id,
          menuId: activeMenu._id,
          name: categoryName.trim(),
        });
        setSelectedCategoryId(newCatId);
      }
      setIsAddCategoryOpen(false);
      setEditingCategory(null);
      setCategoryName("");
      setCategoryPublished(true);
    } catch (err) {
      console.error("Failed to save category:", err);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleToggleCategory = async (e: React.MouseEvent, catId: Id<"categories">, currentPublished: boolean) => {
    e.stopPropagation();
    try {
      await toggleCategoryPublishedMutation({
        id: catId,
        published: !currentPublished,
      });
    } catch (err) {
      console.error("Failed to toggle category published status:", err);
    }
  };

  const handleOpenDeleteCategory = (category: any) => {
    setTargetDeleteCategory(category);
    setIsDeleteCategoryModalOpen(true);
  };

  const handleConfirmDeleteCategory = async () => {
    if (!targetDeleteCategory?._id) return;
    setIsDeletingCategory(true);
    try {
      await deleteCategoryMutation({ id: targetDeleteCategory._id });
      if (selectedCategoryId === targetDeleteCategory._id) {
        setSelectedCategoryId(null);
      }
      setIsDeleteCategoryModalOpen(false);
      setTargetDeleteCategory(null);
      setIsAddCategoryOpen(false);
      setEditingCategory(null);
    } catch (err) {
      console.error("Failed to delete category:", err);
    } finally {
      setIsDeletingCategory(false);
    }
  };

  const handleDeleteCategory = async (e: React.MouseEvent, catId: Id<"categories">, name: string) => {
    e.stopPropagation();
    handleOpenDeleteCategory({ _id: catId, name });
  };

  // Open Add Item Mode
  const handleOpenAddNewItem = () => {
    setEditingItem(null);
    setItemName("");
    setItemPrice("");
    setItemDescription("");
    setItemIsVeg(true);
    setSelectedDietaryType("veg");
    setItemShowItemType(true);
    setItemIsSpicy(false);
    setItemIsAvailable(true);
    setItemShowQuantity(false);
    setItemQuantity("");
    setItemQuantityUnit("g");
    setItemIsGst(true);
    setItemSelectedTaxGroupId(taxGroups?.[0]?._id || "");
    setItemTaxMode(taxGroups?.[0]?.taxMode || "inclusive");
    setItemMarkAsBestseller(false);
    setItemSkuNumber("");
    setItemSelectedCategoryId(activeCategory?._id || "");
    setItemServingSize("");
    setItemServing("");
    setItemCaloriesPerServing("");
    setItemProtein("");
    setItemCarbs("");
    setItemFat("");
    setItemFiber("");
    setItemSugar("");
    setItemSodium("");
    setItemShowAllergens(false);
    setItemSelectedAllergens([]);
    setItemNutrients([]);
    setNewNutrientName("");
    setActiveNutrientMenuId(null);
    setEditingNutrientId(null);
    setAddingChildForNutrientId(null);
    setItemError(null);
    setIsAddItemOpen(true);
    setIsAddItemDropdownOpen(false);
  };

  // Open Edit Item Mode
  const handleOpenEditItem = (item: any) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemPrice((item.price / 100).toFixed(2));
    setItemDescription(item.description || "");
    setItemIsVeg(item.isVeg ?? true);
    setSelectedDietaryType(item.isVeg ? "veg" : "non_veg");
    setItemShowItemType(item.showItemType ?? true);
    setItemIsSpicy(item.isSpicy ?? false);
    setItemIsAvailable(item.isAvailable ?? true);
    setItemShowQuantity(item.showQuantity ?? false);
    setItemQuantity(item.quantity ? String(item.quantity) : "");
    setItemQuantityUnit(item.quantityUnit || "g");
    setItemIsGst(item.isGst ?? true);
    setItemSelectedTaxGroupId(item.taxGroupId || taxGroups?.[0]?._id || "");
    setItemTaxMode(item.taxMode || taxGroups?.[0]?.taxMode || "inclusive");
    setItemMarkAsBestseller(item.markAsBestseller ?? false);
    setItemSkuNumber(item.skuNumber || "");
    setItemSelectedCategoryId(activeCategory?._id || "");
    setItemServingSize(item.servingSize || "");
    setItemServing(item.serving ? String(item.serving) : "");
    setItemCaloriesPerServing(item.caloriesPerServing || item.calorie || "");
    setItemProtein(item.protein || "");
    setItemCarbs(item.carbs || "");
    setItemFat(item.fat || "");
    setItemFiber(item.fiber || "");
    setItemSugar(item.sugar || "");
    setItemSodium(item.sodium || "");
    setItemShowAllergens(item.showAllergenContents ?? false);
    setItemSelectedAllergens(item.allergens || []);
    setItemNutrients(item.nutrients || []);
    setNewNutrientName("");
    setActiveNutrientMenuId(null);
    setEditingNutrientId(null);
    setAddingChildForNutrientId(null);
    setItemError(null);
    setIsAddItemOpen(true);
  };

  // Save Item Submit
  const handleSaveItemSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!organization?._id || !itemName.trim() || !itemPrice) {
      setItemError("Please provide an item name and price.");
      return;
    }

    const priceNum = parseFloat(itemPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setItemError("Please enter a valid price.");
      return;
    }

    const priceCents = Math.round(priceNum * 100);
    const targetCatId = (itemSelectedCategoryId || activeCategory?._id) as Id<"categories">;

    if (!targetCatId && !editingItem) {
      setItemError("Please select or create a category first.");
      return;
    }

    setIsSavingItem(true);
    setItemError(null);

    try {
      const isVegBool = selectedDietaryType === "veg" || selectedDietaryType === "vegan" || selectedDietaryType === "jain";

      if (editingItem) {
        await updateItemMutation({
          id: editingItem._id,
          name: itemName.trim(),
          price: priceCents,
          description: itemDescription.trim() || undefined,
          isVeg: isVegBool,
          isSpicy: itemIsSpicy,
          showItemType: itemShowItemType,
          showQuantity: itemShowQuantity,
          quantity: itemShowQuantity && itemQuantity ? parseFloat(itemQuantity) : undefined,
          quantityUnit: itemShowQuantity ? itemQuantityUnit : undefined,
          isGst: itemIsGst,
          taxGroupId: (itemSelectedTaxGroupId as any) || undefined,
          taxMode: itemTaxMode,
          markAsBestseller: itemMarkAsBestseller,
          isAvailable: itemIsAvailable,
          servingSize: itemServingSize.trim() || undefined,
          serving: itemServing ? parseFloat(itemServing) : undefined,
          caloriesPerServing: itemCaloriesPerServing.trim() || undefined,
          calorie: itemCaloriesPerServing.trim() || undefined,
          protein: itemProtein.trim() || undefined,
          carbs: itemCarbs.trim() || undefined,
          fat: itemFat.trim() || undefined,
          fiber: itemFiber.trim() || undefined,
          sugar: itemSugar.trim() || undefined,
          sodium: itemSodium.trim() || undefined,
          showAllergenContents: itemShowAllergens,
          allergens: itemSelectedAllergens,
          nutrients: itemNutrients,
        });
      } else {
        const newItemId = await createItemMutation({
          organizationId: organization._id,
          name: itemName.trim(),
          price: priceCents,
          description: itemDescription.trim() || undefined,
          isVeg: isVegBool,
          isSpicy: itemIsSpicy,
          showItemType: itemShowItemType,
          isAvailable: itemIsAvailable,
          isGst: itemIsGst,
          taxGroupId: (itemSelectedTaxGroupId as any) || undefined,
          taxMode: itemTaxMode,
          showQuantity: itemShowQuantity,
          quantity: itemShowQuantity && itemQuantity ? parseFloat(itemQuantity) : undefined,
          quantityUnit: itemShowQuantity ? itemQuantityUnit : undefined,
          skuNumber: itemSkuNumber.trim() || undefined,
          markAsBestseller: itemMarkAsBestseller,
          servingSize: itemServingSize.trim() || undefined,
          serving: itemServing ? parseFloat(itemServing) : undefined,
          caloriesPerServing: itemCaloriesPerServing.trim() || undefined,
          calorie: itemCaloriesPerServing.trim() || undefined,
          protein: itemProtein.trim() || undefined,
          carbs: itemCarbs.trim() || undefined,
          fat: itemFat.trim() || undefined,
          fiber: itemFiber.trim() || undefined,
          sugar: itemSugar.trim() || undefined,
          sodium: itemSodium.trim() || undefined,
          showAllergenContents: itemShowAllergens,
          allergens: itemSelectedAllergens,
          nutrients: itemNutrients,
        });

        await addCategoryItemMutation({
          organizationId: organization._id,
          categoryId: targetCatId,
          itemId: newItemId,
        });

        // Set active item to newly created item to view its customizations!
        setSelectedItemId(newItemId);
      }

      setIsAddItemOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      setItemError(err.message || "Failed to save item");
    } finally {
      setIsSavingItem(false);
    }
  };

  // Open Duplicate Item Modal
  const handleOpenDuplicateItem = (item: any) => {
    if (!item) return;
    const existingNames = (categoryItems || []).map((ci: any) => ci.item?.name || "");
    const nextName = getNextDuplicateName(item.name, existingNames);
    setTargetDuplicateItem(item);
    setDuplicateTargetType("item");
    setDuplicateItemNewName(nextName);
    setIsDuplicateItemModalOpen(true);
  };

  // Open Duplicate Customization Item Modal
  const handleOpenDuplicateChoice = (choice: any) => {
    if (!choice) return;
    const existingNames = (activeCustomization?.items || []).map((c: any) => c.name || "");
    const nextName = getNextDuplicateName(choice.name, existingNames);
    setTargetDuplicateItem(choice);
    setDuplicateTargetType("choice");
    setDuplicateItemNewName(nextName);
    setIsDuplicateItemModalOpen(true);
  };

  const handleConfirmDuplicateItem = async () => {
    if (!organization?._id || !targetDuplicateItem) return;
    setIsDuplicatingItem(true);
    try {
      if (duplicateTargetType === "choice") {
        await duplicateCustomizationItemMutation({
          organizationId: organization._id,
          customizationItemId: targetDuplicateItem._id,
          newName: duplicateItemNewName.trim() || `${targetDuplicateItem.name}(1)`,
        });
        setIsDuplicateItemModalOpen(false);
        setTargetDuplicateItem(null);
      } else {
        if (!activeCategory?._id) return;
        const duplicatedId = await duplicateItemMutation({
          organizationId: organization._id,
          itemId: targetDuplicateItem._id,
          categoryId: activeCategory._id,
          newName: duplicateItemNewName.trim() || `${targetDuplicateItem.name}(1)`,
        });
        setIsDuplicateItemModalOpen(false);
        setTargetDuplicateItem(null);
        setSelectedItemId(duplicatedId);
      }
    } catch (err) {
      console.error("Failed to duplicate:", err);
    } finally {
      setIsDuplicatingItem(false);
    }
  };

  // Add Existing Item
  const handleOpenAddExistingItemDrawer = () => {
    setIsAddItemDropdownOpen(false);
    setSelectedExistingItem(null);
    setExistingItemSearchQuery("");
    setExistingItemError(null);
    setIsAddExistingItemOpen(true);
  };

  const handleAddExistingItemSubmit = async () => {
    if (!organization?._id || !activeCategory?._id || !selectedExistingItem) return;

    setIsAddingExistingItem(true);
    setExistingItemError(null);
    try {
      await addExistingItemToCategoryMutation({
        organizationId: organization._id,
        categoryId: activeCategory._id,
        itemId: selectedExistingItem._id,
      });
      setIsAddExistingItemOpen(false);
      setSelectedExistingItem(null);
    } catch (err: any) {
      setExistingItemError(err.message || "Failed to add existing item");
    } finally {
      setIsAddingExistingItem(false);
    }
  };

  const filteredExistingItems = useMemo(() => {
    if (!allExistingItems || !existingItemSearchQuery.trim()) return [];
    const query = existingItemSearchQuery.toLowerCase();
    return allExistingItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        (item.categoryName && item.categoryName.toLowerCase().includes(query))
    );
  }, [allExistingItems, existingItemSearchQuery]);

  // Add Existing Customization Handlers
  const handleOpenAddExistingCustomizationDrawer = () => {
    setIsAddCustomizationDropdownOpen(false);
    setSelectedExistingCustomization(null);
    setExistingCustomizationSearchQuery("");
    setExistingCustomizationError(null);
    setIsAddExistingCustomizationOpen(true);
  };

  const handleAddExistingCustomizationSubmit = async () => {
    if (!organization?._id || !selectedItemId || !selectedExistingCustomization) return;

    setIsCopyingCustomization(true);
    setExistingCustomizationError(null);
    try {
      await copyCustomizationToItemMutation({
        organizationId: organization._id,
        targetItemId: selectedItemId,
        customizationIds: [selectedExistingCustomization._id],
      });
      setIsAddExistingCustomizationOpen(false);
      setSelectedExistingCustomization(null);
    } catch (err: any) {
      setExistingCustomizationError(err.message || "Failed to add existing customization");
    } finally {
      setIsCopyingCustomization(false);
    }
  };

  const filteredExistingCustomizations = useMemo(() => {
    if (!allExistingCustomizations || !existingCustomizationSearchQuery.trim()) return [];
    const query = existingCustomizationSearchQuery.toLowerCase();
    return allExistingCustomizations.filter(
      (cust: any) =>
        cust.name.toLowerCase().includes(query) ||
        (cust.itemName && cust.itemName.toLowerCase().includes(query)) ||
        (cust.customizationType && cust.customizationType.toLowerCase().includes(query))
    );
  }, [allExistingCustomizations, existingCustomizationSearchQuery]);

  const handleToggleItemAvailability = async (itemId: Id<"items">, currentAvailable: boolean) => {
    try {
      await toggleItemAvailabilityMutation({
        id: itemId,
        isAvailable: !currentAvailable,
      });
    } catch (err) {
      console.error("Failed to toggle item availability:", err);
    }
  };

  const handleToggleItemPublished = async (itemId: Id<"items">, currentPublished: boolean) => {
    try {
      await toggleItemPublishedMutation({
        id: itemId,
        published: !currentPublished,
      });
    } catch (err) {
      console.error("Failed to toggle item published:", err);
    }
  };

  const handleOpenUnavailabilityModal = (item: any) => {
    setTargetUnavailabilityItem(item);
    setUnavailabilityTargetType("item");
    setUnavailabilityToggle(!item.isAvailable);
    const existingDays = item.daysOfUnavailable || 0;
    if (existingDays === 0.5) {
      setUnavailabilityDuration("12");
    } else if (existingDays === 1) {
      setUnavailabilityDuration("24");
    } else if (existingDays === 2) {
      setUnavailabilityDuration("48");
    } else if (existingDays > 0) {
      setUnavailabilityDuration("custom");
      setCustomDurationHours(String(existingDays * 24));
    } else {
      setUnavailabilityDuration("24");
    }
    setIsUnavailabilityModalOpen(true);
  };

  const handleOpenChoiceUnavailabilityModal = (choice: any) => {
    setTargetUnavailabilityItem(choice);
    setUnavailabilityTargetType("choice");
    setUnavailabilityToggle(!choice.isAvailable);
    const existingDays = choice.daysOfUnavailable || 0;
    if (existingDays === 0.5) {
      setUnavailabilityDuration("12");
    } else if (existingDays === 1) {
      setUnavailabilityDuration("24");
    } else if (existingDays === 2) {
      setUnavailabilityDuration("48");
    } else if (existingDays > 0) {
      setUnavailabilityDuration("custom");
      setCustomDurationHours(String(existingDays * 24));
    } else {
      setUnavailabilityDuration("24");
    }
    setIsUnavailabilityModalOpen(true);
  };

  const handleSaveUnavailabilityConfirm = async () => {
    if (!targetUnavailabilityItem?._id) return;
    setIsSavingUnavailability(true);
    try {
      let days = 1;
      if (unavailabilityDuration === "12") days = 0.5;
      else if (unavailabilityDuration === "24") days = 1;
      else if (unavailabilityDuration === "48") days = 2;
      else if (unavailabilityDuration === "custom") {
        const parsed = parseFloat(customDurationHours || "24");
        days = isNaN(parsed) || parsed <= 0 ? 1 : parsed / 24;
      }

      if (unavailabilityTargetType === "choice") {
        await setCustomizationItemUnavailabilityMutation({
          id: targetUnavailabilityItem._id,
          isAvailable: !unavailabilityToggle,
          daysOfUnavailable: unavailabilityToggle ? days : 0,
        });
      } else {
        await setItemUnavailabilityMutation({
          id: targetUnavailabilityItem._id,
          isAvailable: !unavailabilityToggle,
          daysOfUnavailable: unavailabilityToggle ? days : 0,
        });
      }
      setIsUnavailabilityModalOpen(false);
      setTargetUnavailabilityItem(null);
    } catch (err) {
      console.error("Failed to update unavailability:", err);
    } finally {
      setIsSavingUnavailability(false);
    }
  };

  // Open Delete Item Modal
  const handleOpenDeleteItem = (item: any) => {
    if (!item) return;
    setTargetDeleteItem(item);
    setIsDeleteItemModalOpen(true);
  };

  const handleConfirmDeleteItem = async () => {
    if (!targetDeleteItem) return;
    setIsDeletingItem(true);
    try {
      await deleteItemMutation({
        id: targetDeleteItem._id,
        categoryId: activeCategory?._id,
      });
      if (selectedItemId === targetDeleteItem._id) {
        setSelectedItemId(null);
        setSelectedCustomizationId(null);
      }
      setIsDeleteItemModalOpen(false);
      setTargetDeleteItem(null);
    } catch (err) {
      console.error("Failed to delete item:", err);
    } finally {
      setIsDeletingItem(false);
    }
  };

  // ==========================================
  // CUSTOMIZATION GROUP HANDLERS
  // ==========================================

  const handleOpenAddCustomization = () => {
    setCustomizationType("AddOns");
    setCustomizationName("");
    setCustomizationDesc("");
    setCustomizationRequired(false);
    setCustomizationMaxSelected(1);
    setCustomizationPublished(true);
    setIsAddCustomizationOpen(true);
  };

  const handleOpenEditCustomization = (cust: any) => {
    setEditingCustomization(cust);
    setCustomizationType(cust.customizationType || "AddOns");
    setCustomizationName(cust.name);
    setCustomizationDesc(cust.description || "");
    setCustomizationRequired(cust.required ?? false);
    setCustomizationMaxSelected(cust.maxSelected ?? 1);
    setCustomizationPublished(cust.published ?? true);
    setIsEditCustomizationOpen(true);
  };

  const handleSaveCustomizationSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!organization?._id || !selectedItemId || !customizationName.trim()) return;

    setIsSavingCustomization(true);
    try {
      if (editingCustomization) {
        await updateCustomizationMutation({
          id: editingCustomization._id,
          name: customizationName.trim(),
          customizationType,
          required: customizationRequired,
          maxSelected: customizationMaxSelected,
          published: customizationPublished,
        });
        setIsEditCustomizationOpen(false);
        setEditingCustomization(null);
      } else {
        const newCustId = await createCustomizationMutation({
          organizationId: organization._id,
          itemId: selectedItemId,
          name: customizationName.trim(),
          customizationType,
          required: customizationRequired,
          maxSelected: customizationMaxSelected,
          published: customizationPublished,
        });
        setIsAddCustomizationOpen(false);
        setSelectedCustomizationId(newCustId);
      }
    } catch (err) {
      console.error("Failed to save customization:", err);
    } finally {
      setIsSavingCustomization(false);
    }
  };

  const handleDeleteCustomizationConfirm = async () => {
    if (!deletingCustomizationId) return;
    try {
      await deleteCustomizationMutation({ id: deletingCustomizationId });
      if (selectedCustomizationId === deletingCustomizationId) {
        setSelectedCustomizationId(null);
      }
      setIsDeleteCustomizationOpen(false);
      setDeletingCustomizationId(null);
    } catch (err) {
      console.error("Failed to delete customization:", err);
    }
  };

  const handleToggleCustomizationPublished = async (cust: any) => {
    try {
      await updateCustomizationMutation({
        id: cust._id,
        published: !cust.published,
      });
    } catch (err) {
      console.error("Failed to toggle customization published status:", err);
    }
  };

  const handleCustomizationDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", index.toString());
    e.dataTransfer.effectAllowed = "move";
    setDraggedCustomizationIndex(index);
  };

  const handleCustomizationDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCustomizationIndex !== index) {
      setDragOverCustomizationIndex(index);
    }
  };

  const handleCustomizationDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedCustomizationIndex === null || draggedCustomizationIndex === targetIndex) {
      setDraggedCustomizationIndex(null);
      setDragOverCustomizationIndex(null);
      return;
    }

    if (!itemCustomizations) return;

    const items = [...itemCustomizations];
    const [movedItem] = items.splice(draggedCustomizationIndex, 1);
    items.splice(targetIndex, 0, movedItem);

    setDraggedCustomizationIndex(null);
    setDragOverCustomizationIndex(null);

    try {
      await reorderCustomizationsMutation({
        customizationIds: items.map((c) => c._id),
      });
    } catch (err) {
      console.error("Failed to reorder customizations:", err);
    }
  };

  const handleCustomizationDragEnd = () => {
    setDraggedCustomizationIndex(null);
    setDragOverCustomizationIndex(null);
  };

  // ==========================================
  // CUSTOMIZATION ITEM (CHOICE) HANDLERS
  // ==========================================

  const handleOpenAddChoice = () => {
    setEditingChoice(null);
    setChoiceName("");
    setChoicePrice("0.00");
    setChoiceDescription("");
    setChoiceIsAvailable(true);
    setChoiceDietaryType("veg");
    setChoiceShowQuantity(false);
    setChoiceQuantity("");
    setChoiceQuantityUnit("g");
    setChoiceShowCalorie(false);
    setChoiceCalorie("");
    setChoiceCalorieMetric("kcal");
    setChoiceIsGst(false);
    const defaultTg = taxGroups?.find((g) => g.isDefault) || taxGroups?.[0];
    setChoiceSelectedTaxGroupId(defaultTg?._id || "");
    setChoiceTaxMode(defaultTg?.taxMode || "inclusive");
    setIsChoiceAdvancedOpen(false);
    setIsAddChoiceOpen(true);
  };

  const handleOpenEditChoice = (choice: any) => {
    setEditingChoice(choice);
    setChoiceName(choice.name);
    setChoicePrice((choice.price / 100).toFixed(2));
    setChoiceDescription(choice.description || "");
    setChoiceIsAvailable(choice.isAvailable ?? true);
    setChoiceDietaryType(choice.dietaryType || (choice.isVeg === false ? "non_veg" : "veg"));
    setChoiceShowQuantity(!!choice.showQuantity);
    setChoiceQuantity(choice.quantity ? String(choice.quantity) : "");
    setChoiceQuantityUnit(choice.quantityUnit || "g");
    setChoiceShowCalorie(!!choice.showCalorie);
    setChoiceCalorie(choice.calorie || "");
    setChoiceCalorieMetric(choice.calorieMetric || "kcal");
    setChoiceIsGst(!!choice.isGst);
    setChoiceSelectedTaxGroupId(choice.taxGroupId || taxGroups?.find((g) => g.isDefault)?._id || taxGroups?.[0]?._id || "");
    setChoiceTaxMode(choice.taxMode || "inclusive");
    setIsChoiceAdvancedOpen(
      !!(choice.description || choice.isGst || choice.showQuantity || choice.showCalorie || (choice.dietaryType && choice.dietaryType !== "veg"))
    );
    setIsEditChoiceOpen(true);
  };

  const handleSaveChoiceSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!organization?._id || !selectedCustomizationId || !choiceName.trim()) return;

    const priceNum = parseFloat(choicePrice || "0");
    const priceCents = Math.round(priceNum * 100);
    const quantityNum = choiceShowQuantity && choiceQuantity ? parseFloat(choiceQuantity) : undefined;
    const isVeg = choiceDietaryType === "veg" || choiceDietaryType === "vegan" || choiceDietaryType === "jain";
    const matchedType = availableItemTypes.find(
      (t) =>
        t.id === choiceDietaryType ||
        t.name.toLowerCase() === choiceDietaryType.toLowerCase() ||
        (choiceDietaryType === "veg" && t.name.toLowerCase().includes("veg") && !t.name.toLowerCase().includes("non"))
    );
    const resolvedItemTypeIds =
      matchedType && matchedType.id && !["veg", "non_veg", "vegan", "jain", "egg"].includes(matchedType.id)
        ? [matchedType.id as any]
        : undefined;

    setIsSavingChoice(true);
    try {
      if (editingChoice) {
        await updateCustomizationItemMutation({
          id: editingChoice._id,
          name: choiceName.trim(),
          price: priceCents,
          description: choiceDescription.trim() || undefined,
          isVeg,
          dietaryType: choiceDietaryType,
          itemTypeIds: resolvedItemTypeIds,
          showQuantity: choiceShowQuantity,
          quantity: quantityNum,
          quantityUnit: choiceShowQuantity ? choiceQuantityUnit : undefined,
          showCalorie: choiceShowCalorie,
          calorie: choiceShowCalorie ? choiceCalorie.trim() || undefined : undefined,
          calorieMetric: choiceShowCalorie ? choiceCalorieMetric : undefined,
          isGst: choiceIsGst,
          taxGroupId: choiceIsGst && choiceSelectedTaxGroupId ? (choiceSelectedTaxGroupId as any) : undefined,
          taxMode: choiceIsGst ? choiceTaxMode : undefined,
          isAvailable: choiceIsAvailable,
        });
        setIsEditChoiceOpen(false);
        setEditingChoice(null);
      } else {
        await createCustomizationItemMutation({
          organizationId: organization._id,
          customizationId: selectedCustomizationId,
          name: choiceName.trim(),
          price: priceCents,
          description: choiceDescription.trim() || undefined,
          isVeg,
          dietaryType: choiceDietaryType,
          itemTypeIds: resolvedItemTypeIds,
          showQuantity: choiceShowQuantity,
          quantity: quantityNum,
          quantityUnit: choiceShowQuantity ? choiceQuantityUnit : undefined,
          showCalorie: choiceShowCalorie,
          calorie: choiceShowCalorie ? choiceCalorie.trim() || undefined : undefined,
          calorieMetric: choiceShowCalorie ? choiceCalorieMetric : undefined,
          isGst: choiceIsGst,
          taxGroupId: choiceIsGst && choiceSelectedTaxGroupId ? (choiceSelectedTaxGroupId as any) : undefined,
          taxMode: choiceIsGst ? choiceTaxMode : undefined,
          isAvailable: true,
        });
        setIsAddChoiceOpen(false);
      }
      setChoiceName("");
      setChoicePrice("0.00");
      setChoiceDescription("");
    } catch (err) {
      console.error("Failed to save choice option:", err);
    } finally {
      setIsSavingChoice(false);
    }
  };

  const handleDeleteChoiceConfirm = async () => {
    if (!deletingChoiceId) return;
    try {
      await deleteCustomizationItemMutation({ id: deletingChoiceId });
      setIsDeleteChoiceOpen(false);
      setDeletingChoiceId(null);
    } catch (err) {
      console.error("Failed to delete choice option:", err);
    }
  };

  const handleToggleChoiceAvailability = async (choice: any) => {
    try {
      await updateCustomizationItemMutation({
        id: choice._id,
        isAvailable: !choice.isAvailable,
      });
    } catch (err) {
      console.error("Failed to toggle choice availability:", err);
    }
  };

  const handleChoiceDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", index.toString());
    e.dataTransfer.effectAllowed = "move";
    setDraggedChoiceIndex(index);
  };

  const handleChoiceDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverChoiceIndex !== index) {
      setDragOverChoiceIndex(index);
    }
  };

  const handleChoiceDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedChoiceIndex === null || draggedChoiceIndex === targetIndex) {
      setDraggedChoiceIndex(null);
      setDragOverChoiceIndex(null);
      return;
    }

    if (!activeCustomization?.items) return;

    const items = [...activeCustomization.items];
    const [movedItem] = items.splice(draggedChoiceIndex, 1);
    items.splice(targetIndex, 0, movedItem);

    setDraggedChoiceIndex(null);
    setDragOverChoiceIndex(null);

    try {
      await reorderCustomizationItemsMutation({
        itemIds: items.map((i: any) => i._id),
      });
    } catch (err) {
      console.error("Failed to reorder customization items:", err);
    }
  };

  const handleChoiceDragEnd = () => {
    setDraggedChoiceIndex(null);
    setDragOverChoiceIndex(null);
  };

  const activeItemsCount = categoryItems?.filter((ci) => (ci.item.published ?? true)).length || 0;

  return (
    <PosShell title="Menu Management" subtitle="Catalog, Categories & Customizations">
      <div className="flex flex-col flex-1 min-w-0 bg-[#f5f5f5] text-[#1c1b1b] min-h-screen font-sans">
        
        {/* ======================================================== */}
        {/* VIEW 1: FULL SCREEN ADD / EDIT ITEM STUDIO (WITH TAXES) */}
        {/* ======================================================== */}
        {isAddItemOpen ? (
          <div className="w-full flex-1 flex flex-col font-sans bg-[#fdf8f7]">
            {/* Top Workspace & Breadcrumb Header */}
            <div className="bg-[#fdf8f7] px-6 lg:px-8 py-6 border-b border-[#e7e5e4] shrink-0">
              <div className="flex flex-col md:flex-row md:items-end justify-between w-full gap-4">
                <div>
                  <nav className="flex items-center text-[13px] text-[#5e5e5e] mb-2 gap-2 font-sans font-medium">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddItemOpen(false);
                        setEditingItem(null);
                        setSelectedItemId(null);
                        setSelectedCustomizationId(null);
                      }}
                      className="hover:text-[#141010] transition-colors cursor-pointer"
                    >
                      Menu
                    </button>
                    <ChevronRightIcon className="w-3.5 h-3.5 text-[#928c8a]" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddItemOpen(false);
                        setEditingItem(null);
                        setSelectedItemId(null);
                        setSelectedCustomizationId(null);
                      }}
                      className="hover:text-[#141010] transition-colors cursor-pointer"
                    >
                      {activeMenu?.name || "Main Menu"}
                    </button>
                    <ChevronRightIcon className="w-3.5 h-3.5 text-[#928c8a]" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddItemOpen(false);
                        setEditingItem(null);
                        setSelectedItemId(null);
                        setSelectedCustomizationId(null);
                      }}
                      className="hover:text-[#141010] transition-colors cursor-pointer"
                    >
                      {activeCategory?.name || "Category"}
                    </button>
                    <ChevronRightIcon className="w-3.5 h-3.5 text-[#928c8a]" />
                    <span className="text-[#141010] font-semibold">
                      {editingItem ? "Edit Item" : "Add New Item"}
                    </span>
                  </nav>
                  <h1 className="font-garamond text-[32px] md:text-[36px] text-[#0c0a09] font-normal leading-tight">
                    {editingItem ? "Edit Item" : "Add New Item"}
                  </h1>
                  <p className="text-[#5e5e5e] text-[14px] mt-1">
                    Configure details, taxes, dietary classification, and base pricing.
                  </p>
                </div>
              </div>
            </div>

            {/* Two Column Form Grid */}
            <div className="w-full p-6 lg:p-8 flex-1">
              <form id="item-details-form" onSubmit={handleSaveItemSubmit}>
                {itemError && (
                  <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {itemError}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* Left Column (Forms) */}
                  <div className="lg:col-span-7 xl:col-span-8 space-y-8">
                    
                    {/* Card 1: Item Details & Pricing */}
                    <div className="bg-white rounded-xl border border-[#e7e5e4] p-6 lg:p-8 shadow-sm space-y-6">
                      <h2 className="text-[20px] font-semibold text-[#0c0a09]">Item Details & Pricing</h2>

                      {/* Image Upload Area */}
                      <div className="border-2 border-dashed border-[#d1c4c1] rounded-xl p-6 lg:p-8 flex flex-col items-center justify-center text-center bg-[#f7f3f2] hover:bg-[#f1edec] transition-colors cursor-pointer group">
                        <div className="w-16 h-16 rounded-full bg-[#f0efed] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform border border-[#e7e5e4]">
                          <ImageIcon className="w-7 h-7 text-[#141010]" />
                        </div>
                        <h3 className="font-medium text-[15px] text-[#0c0a09] mb-1">Click to upload item image</h3>
                        <p className="text-xs text-[#5e5e5e] mb-4">or drag and drop. Supports JPG, PNG, WEBP (Max 5MB)</p>
                      </div>

                      {/* Category & Search Code / SKU */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-[#0c0a09]">Category *</label>
                          <div className="relative">
                            <select
                              value={itemSelectedCategoryId || activeCategory?._id || ""}
                              onChange={(e) => setItemSelectedCategoryId(e.target.value)}
                              className="w-full bg-white border border-[#e7e5e4] rounded-lg px-4 py-2.5 appearance-none focus:outline-none focus:border-[#141010] focus:ring-1 focus:ring-[#141010] text-[#0c0a09] text-sm"
                            >
                              {categories?.map((cat) => (
                                <option key={cat._id} value={cat._id}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDownIcon className="absolute right-3.5 top-3.5 w-4 h-4 text-[#5e5e5e] pointer-events-none" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-[#0c0a09]">Search Code / SKU (Optional)</label>
                          <input
                            type="text"
                            value={itemSkuNumber}
                            onChange={(e) => setItemSkuNumber(e.target.value)}
                            placeholder="e.g. 1211 / VF-001"
                            className="w-full bg-white border border-[#e7e5e4] rounded-lg px-4 py-2.5 focus:outline-none focus:border-[#141010] focus:ring-1 focus:ring-[#141010] text-[#0c0a09] text-sm"
                          />
                        </div>
                      </div>

                      {/* Item Name */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-[#0c0a09]">Item Name *</label>
                        <input
                          type="text"
                          required
                          value={itemName}
                          onChange={(e) => setItemName(e.target.value)}
                          placeholder="Enter item name (e.g., Vadapav / Truffle Umami Burger)"
                          className="w-full bg-white border border-[#e7e5e4] rounded-lg px-4 py-2.5 focus:outline-none focus:border-[#141010] focus:ring-1 focus:ring-[#141010] text-[#0c0a09] text-sm font-medium"
                        />
                      </div>

                      {/* Price */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-[#0c0a09]">Base Price *</label>
                        <div className="relative">
                          <span className="absolute left-4 top-2.5 text-[#5e5e5e] text-sm font-semibold">{currencySymbol}</span>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={itemPrice}
                            onChange={(e) => setItemPrice(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-white border border-[#e7e5e4] rounded-lg pl-9 pr-4 py-2.5 focus:outline-none focus:border-[#141010] focus:ring-1 focus:ring-[#141010] text-[#0c0a09] text-sm font-semibold"
                          />
                        </div>
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="block text-sm font-medium text-[#0c0a09]">Enter description</label>
                          <button
                            type="button"
                            onClick={() => {
                              handleGenerateAiSuggestions();
                              setItemDescription(aiDescSuggestion);
                            }}
                            className="text-xs text-[#5e5e5e] hover:text-[#0c0a09] flex items-center gap-1 transition-colors font-medium cursor-pointer"
                          >
                            <span>✨</span>
                            <span>Generate with AI</span>
                          </button>
                        </div>
                        <RichTextDescriptionEditor
                          value={itemDescription}
                          onChange={(val) => setItemDescription(val)}
                          placeholder="Enter item description"
                        />
                      </div>
                    </div>

                    {/* Card 2: Item Settings (Toggle Grid & Contextual Configuration) */}
                    <div className="bg-white rounded-xl border border-[#e7e5e4] p-6 lg:p-8 shadow-sm space-y-6">
                      <div>
                        <h2 className="text-[20px] font-semibold text-[#0c0a09]">Item Settings</h2>
                        <p className="text-xs text-[#5e5e5e] mt-0.5">
                          Enable attributes, portion sizes, dietary types, and tax configurations for this item.
                        </p>
                      </div>

                      {/* 2-Column Settings Toggle Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* 1. Show quantity */}
                        <div
                          onClick={() => setItemShowQuantity(!itemShowQuantity)}
                          className="flex items-center justify-between p-3.5 bg-[#f8f6f5] hover:bg-[#f2efee] rounded-xl border border-[#e7e5e4] cursor-pointer transition select-none"
                        >
                          <span className="text-sm font-medium text-[#0c0a09]">Show quantity</span>
                          <div className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${itemShowQuantity ? "bg-[#0c0a09]" : "bg-[#d1c4c1]"}`}>
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${itemShowQuantity ? "right-0.5" : "left-0.5"}`} />
                          </div>
                        </div>

                        {/* 2. Show item type */}
                        <div
                          onClick={() => setItemShowItemType(!itemShowItemType)}
                          className="flex items-center justify-between p-3.5 bg-[#f8f6f5] hover:bg-[#f2efee] rounded-xl border border-[#e7e5e4] cursor-pointer transition select-none"
                        >
                          <span className="text-sm font-medium text-[#0c0a09]">Show item type</span>
                          <div className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${itemShowItemType ? "bg-[#0c0a09]" : "bg-[#d1c4c1]"}`}>
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${itemShowItemType ? "right-0.5" : "left-0.5"}`} />
                          </div>
                        </div>

                        {/* 3. Is this item taxable? */}
                        <div
                          onClick={() => setItemIsGst(!itemIsGst)}
                          className="flex items-center justify-between p-3.5 bg-[#f8f6f5] hover:bg-[#f2efee] rounded-xl border border-[#e7e5e4] cursor-pointer transition select-none"
                        >
                          <span className="text-sm font-medium text-[#0c0a09]">Is this item taxable?</span>
                          <div className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${itemIsGst ? "bg-[#0c0a09]" : "bg-[#d1c4c1]"}`}>
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${itemIsGst ? "right-0.5" : "left-0.5"}`} />
                          </div>
                        </div>

                        {/* 4. Mark as Bestseller */}
                        <div
                          onClick={() => setItemMarkAsBestseller(!itemMarkAsBestseller)}
                          className="flex items-center justify-between p-3.5 bg-[#f8f6f5] hover:bg-[#f2efee] rounded-xl border border-[#e7e5e4] cursor-pointer transition select-none"
                        >
                          <span className="text-sm font-medium text-[#0c0a09]">Mark as Bestseller</span>
                          <div className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${itemMarkAsBestseller ? "bg-[#0c0a09]" : "bg-[#d1c4c1]"}`}>
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${itemMarkAsBestseller ? "right-0.5" : "left-0.5"}`} />
                          </div>
                        </div>

                        {/* 5. Mark as Spicy */}
                        <div
                          onClick={() => setItemIsSpicy(!itemIsSpicy)}
                          className="flex items-center justify-between p-3.5 bg-[#f8f6f5] hover:bg-[#f2efee] rounded-xl border border-[#e7e5e4] cursor-pointer transition select-none"
                        >
                          <span className="text-sm font-medium text-[#0c0a09]">Mark as Spicy</span>
                          <div className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${itemIsSpicy ? "bg-[#0c0a09]" : "bg-[#d1c4c1]"}`}>
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${itemIsSpicy ? "right-0.5" : "left-0.5"}`} />
                          </div>
                        </div>
                      </div>

                      {/* Contextual Section A: Portion & Quantity Configuration */}
                      {itemShowQuantity && (
                        <div className="p-4 bg-[#faf9f9] rounded-xl border border-[#e7e5e4] space-y-3">
                          <div className="flex items-center gap-2 text-xs font-semibold text-[#0c0a09] border-b border-[#e7e5e4] pb-2">
                            <span>⚖️</span>
                            <span>Portion &amp; Quantity Configuration</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="block text-xs font-medium text-[#5e5e5e]">Quantity / Portion Size</label>
                              <input
                                type="number"
                                step="any"
                                value={itemQuantity}
                                onChange={(e) => setItemQuantity(e.target.value)}
                                placeholder="e.g. 250, 1, 500"
                                className="w-full bg-white border border-[#e7e5e4] rounded-lg px-3 py-2 text-sm font-medium text-[#0c0a09] focus:outline-none focus:border-[#141010]"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-xs font-medium text-[#5e5e5e]">Unit of Measure</label>
                              <select
                                value={itemQuantityUnit}
                                onChange={(e) => setItemQuantityUnit(e.target.value)}
                                className="w-full bg-white border border-[#e7e5e4] rounded-lg px-3 py-2 text-sm font-medium text-[#0c0a09] focus:outline-none focus:border-[#141010]"
                              >
                                <option value="g">Grams (g)</option>
                                <option value="kg">Kilograms (kg)</option>
                                <option value="ml">Milliliters (ml)</option>
                                <option value="l">Liters (L)</option>
                                <option value="pcs">Pieces (pcs)</option>
                                <option value="plates">Plates</option>
                                <option value="slices">Slices</option>
                                <option value="servings">Servings</option>
                                <option value="oz">Ounces (oz)</option>
                                <option value="lbs">Pounds (lbs)</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Contextual Section B: Dietary Classification */}
                      {itemShowItemType && (
                        <div className="p-4 bg-[#faf9f9] rounded-xl border border-[#e7e5e4] space-y-3">
                          <div className="flex items-center gap-2 text-xs font-semibold text-[#0c0a09] border-b border-[#e7e5e4] pb-2">
                            <span>🏷️</span>
                            <span>Dietary Category</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                            {availableItemTypes.map((type) => (
                              <button
                                key={type.id}
                                type="button"
                                onClick={() => setSelectedDietaryType(type.id)}
                                className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition cursor-pointer ${
                                  selectedDietaryType === type.id || selectedDietaryType === type.name.toLowerCase()
                                    ? "border-[#141010] bg-[#f1edec] text-[#141010] ring-1 ring-[#141010]"
                                    : "border-[#e7e5e4] bg-white hover:bg-[#f1edec] text-[#5e5e5e]"
                                }`}
                              >
                                <span>{type.icon}</span>
                                <span>{type.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Contextual Section C: Taxation & Compliance Engine */}
                      {itemIsGst && (
                        <div className="p-4 bg-[#faf9f9] rounded-xl border border-[#e7e5e4] space-y-4">
                          <div className="flex items-center gap-2 text-xs font-semibold text-[#0c0a09] border-b border-[#e7e5e4] pb-2">
                            <span>🏛️</span>
                            <span>Taxation &amp; Calculation Mode</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Tax Group Selector */}
                            <div className="space-y-1.5">
                              <label className="block text-xs font-medium text-[#5e5e5e]">Tax Group / Rate</label>
                              <div className="relative">
                                <select
                                  value={itemSelectedTaxGroupId}
                                  onChange={(e) => setItemSelectedTaxGroupId(e.target.value)}
                                  className="w-full bg-white border border-[#e7e5e4] rounded-lg px-3 py-2 appearance-none focus:outline-none focus:border-[#141010] text-[#0c0a09] text-xs font-medium"
                                >
                                  {taxGroups && taxGroups.length > 0 ? (
                                    taxGroups.map((tg) => (
                                      <option key={tg._id} value={tg._id}>
                                        {tg.name} {tg.isDefault ? "⭐ (Store Default)" : ""}
                                      </option>
                                    ))
                                  ) : (
                                    <option value="">Default Store Tax</option>
                                  )}
                                </select>
                                <ChevronDownIcon className="absolute right-3 top-3 w-4 h-4 text-[#5e5e5e] pointer-events-none" />
                              </div>
                            </div>

                            {/* Tax Calculation Mode */}
                            <div className="space-y-1.5">
                              <label className="block text-xs font-medium text-[#5e5e5e]">Tax Calculation Mode</label>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setItemTaxMode("inclusive")}
                                  className={`py-2 px-2.5 text-xs font-semibold rounded-lg border text-center transition-all cursor-pointer ${
                                    itemTaxMode === "inclusive"
                                      ? "bg-[#0c0a09] text-white border-[#0c0a09] shadow-sm"
                                      : "bg-white text-[#5e5e5e] border-[#e7e5e4] hover:bg-[#f1edec]"
                                  }`}
                                >
                                  Tax Inclusive
                                  <span className="block text-[9px] font-normal opacity-80 mt-0.5">Price includes tax</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setItemTaxMode("exclusive")}
                                  className={`py-2 px-2.5 text-xs font-semibold rounded-lg border text-center transition-all cursor-pointer ${
                                    itemTaxMode === "exclusive"
                                      ? "bg-[#0c0a09] text-white border-[#0c0a09] shadow-sm"
                                      : "bg-white text-[#5e5e5e] border-[#e7e5e4] hover:bg-[#f1edec]"
                                  }`}
                                >
                                  Tax Exclusive
                                  <span className="block text-[9px] font-normal opacity-80 mt-0.5">Tax added at checkout</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Live Tax Computation Preview */}
                          {taxBreakdown && (
                            <div className="p-3.5 rounded-lg bg-white border border-[#e7e5e4] space-y-2 text-xs shadow-xs">
                              <div className="flex items-center justify-between font-semibold text-[#141010] border-b border-[#e7e5e4] pb-2 flex-wrap gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm">🧾</span>
                                  <span className="text-xs font-bold">Receipt Split Preview ({taxBreakdown.totalRate}% Total Tax):</span>
                                  {taxBreakdown.isDemo && (
                                    <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded font-medium">
                                      Demo for {currencySymbol}100
                                    </span>
                                  )}
                                </div>
                                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${
                                  taxBreakdown.mode === "inclusive"
                                    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                    : "text-blue-700 bg-blue-50 border-blue-200"
                                }`}>
                                  {taxBreakdown.mode === "inclusive" ? "Inclusive Pricing" : "Exclusive Pricing"}
                                </span>
                              </div>
                              <div className="flex justify-between text-[#5e5e5e] text-xs">
                                <span>Base Item Price:</span>
                                <span className="font-semibold text-[#141010]">{currencySymbol}{taxBreakdown.basePrice}</span>
                              </div>
                              {taxBreakdown.components.map((c, idx) => (
                                <div key={idx} className="flex justify-between text-[#5e5e5e] text-xs">
                                  <span>• {c.name} ({c.rate}%):</span>
                                  <span className="font-medium text-[#141010]">+{currencySymbol}{c.amount}</span>
                                </div>
                              ))}
                              <div className="flex justify-between text-[#141010] font-bold pt-1.5 border-t border-[#e7e5e4] text-xs">
                                <span>Total Customer Pays:</span>
                                <span className="text-xs font-bold text-[#0c0a09]">{currencySymbol}{taxBreakdown.finalPrice}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card 3: Nutrition Information (Shown ONLY in Edit Mode per specifications) */}
                    {editingItem && (
                      <div className="bg-white rounded-xl border border-[#e7e5e4] p-6 lg:p-8 shadow-sm space-y-6">
                        {/* Card Header with Show Allergen Contents Checkbox */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e7e5e4] pb-4 gap-3">
                          <div>
                            <h2 className="text-[20px] font-semibold text-[#0c0a09]">Nutrition Information</h2>
                            <p className="text-xs text-[#5e5e5e] mt-0.5">Configure nutritional breakdown, portion metrics, and allergen contents.</p>
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={itemShowAllergens}
                              onChange={(e) => setItemShowAllergens(e.target.checked)}
                              className="w-4 h-4 rounded text-[#0c0a09] focus:ring-[#0c0a09] border-[#d1c4c1] cursor-pointer"
                            />
                            <span className="text-xs text-[#0c0a09] font-medium">Show allergen contents</span>
                          </label>
                        </div>

                        {/* Allergen Pills Grid (when itemShowAllergens is checked) */}
                        {itemShowAllergens && (
                          <div className="space-y-2 pt-1">
                            <p className="text-xs font-medium text-[#5e5e5e]">Allergen Contents (Select all that apply)</p>
                            <div className="flex flex-wrap gap-2.5">
                              {ALLERGEN_OPTIONS.map((allergen) => {
                                const isSelected = itemSelectedAllergens.includes(allergen.name);
                                return (
                                  <button
                                    key={allergen.id}
                                    type="button"
                                    onClick={() => handleToggleAllergen(allergen.name)}
                                    className={`px-3.5 py-2 rounded-lg border text-sm font-medium flex items-center gap-2 transition-all cursor-pointer ${
                                      isSelected
                                        ? "bg-[#1c1b1b] text-white border-[#1c1b1b] shadow-xs"
                                        : "bg-white text-[#1c1b1b] border-[#e7e5e4] hover:bg-[#f7f3f2]"
                                    }`}
                                  >
                                    <span className="text-base leading-none">{allergen.icon}</span>
                                    <span>{allergen.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Base Serving Metrics */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-[#5e5e5e]">Serving size</label>
                            <input
                              type="text"
                              value={itemServingSize}
                              onChange={(e) => setItemServingSize(e.target.value)}
                              className="w-full bg-[#f7f3f2] border-0 rounded-lg px-3 py-2 text-sm text-[#0c0a09] focus:ring-1 focus:ring-[#141010]"
                              placeholder="Enter the serving size"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-[#5e5e5e]">Servings</label>
                            <input
                              type="text"
                              value={itemServing}
                              onChange={(e) => setItemServing(e.target.value)}
                              className="w-full bg-[#f7f3f2] border-0 rounded-lg px-3 py-2 text-sm text-[#0c0a09] focus:ring-1 focus:ring-[#141010]"
                              placeholder="Enter the servings"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-[#5e5e5e]">Calories per serving</label>
                            <input
                              type="text"
                              value={itemCaloriesPerServing}
                              onChange={(e) => setItemCaloriesPerServing(e.target.value)}
                              className="w-full bg-[#f7f3f2] border-0 rounded-lg px-3 py-2 text-sm text-[#0c0a09] focus:ring-1 focus:ring-[#141010]"
                              placeholder="Enter the quantity"
                            />
                          </div>
                        </div>

                        {/* Dynamic Nutrients Builder */}
                        <div className="space-y-4 pt-2 border-t border-[#e7e5e4]">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-[#5e5e5e]">Nutrient name</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newNutrientName}
                                onChange={(e) => setNewNutrientName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddNutrient();
                                  }
                                }}
                                placeholder="Enter nutrient name"
                                className="flex-1 bg-[#f7f3f2] border-0 rounded-lg px-3 py-2 text-sm text-[#0c0a09] focus:ring-1 focus:ring-[#141010]"
                              />
                              <button
                                type="button"
                                onClick={handleAddNutrient}
                                className="px-6 py-2 bg-[#0c0a09] text-white rounded-lg font-medium text-sm hover:bg-[#252626] transition-colors cursor-pointer"
                              >
                                Add
                              </button>
                            </div>
                          </div>

                          {/* Nutrients List */}
                          <div className="space-y-3">
                            {itemNutrients.map((nutrient) => {
                              const isMenuOpen = activeNutrientMenuId === nutrient.id;
                              const isRenaming = editingNutrientId === nutrient.id;
                              const isAddingChild = addingChildForNutrientId === nutrient.id;

                              return (
                                <div
                                  key={nutrient.id}
                                  className="border border-[#e7e5e4] rounded-xl p-4 bg-[#fcfbfa] space-y-3 shadow-2xs relative"
                                >
                                  {/* Nutrient Card Header */}
                                  <div className="flex items-center justify-between border-b border-[#f0efed] pb-2">
                                    {isRenaming ? (
                                      <div className="flex items-center gap-2 flex-1 mr-2">
                                        <input
                                          type="text"
                                          value={editingNutrientName}
                                          onChange={(e) => setEditingNutrientName(e.target.value)}
                                          className="bg-white border border-[#e7e5e4] rounded px-2.5 py-1 text-sm text-[#0c0a09] flex-1"
                                          autoFocus
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (editingNutrientName.trim()) {
                                              handleUpdateNutrient(nutrient.id, "name", editingNutrientName.trim());
                                            }
                                            setEditingNutrientId(null);
                                          }}
                                          className="px-3 py-1 bg-[#0c0a09] text-white text-xs rounded hover:bg-[#252626] font-medium"
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingNutrientId(null)}
                                          className="px-2.5 py-1 text-[#5e5e5e] text-xs hover:text-[#0c0a09]"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="font-semibold text-sm text-[#0c0a09]">{nutrient.name}</span>
                                    )}

                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() => setActiveNutrientMenuId(isMenuOpen ? null : nutrient.id)}
                                        className="p-1 text-[#5e5e5e] hover:text-[#0c0a09] rounded hover:bg-[#f0efed] cursor-pointer"
                                      >
                                        <MoreVerticalIcon className="w-4 h-4" />
                                      </button>

                                      {isMenuOpen && (
                                        <div className="absolute right-0 top-6 z-20 w-44 bg-white border border-[#e7e5e4] rounded-lg shadow-lg py-1 text-xs font-medium">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingNutrientId(nutrient.id);
                                              setEditingNutrientName(nutrient.name);
                                              setActiveNutrientMenuId(null);
                                            }}
                                            className="w-full text-left px-3 py-2 text-[#0c0a09] hover:bg-[#f7f3f2] flex items-center gap-2 cursor-pointer"
                                          >
                                            <EditPencilIcon className="w-3.5 h-3.5 text-[#5e5e5e]" />
                                            <span>Edit nutrient name</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              handleRemoveNutrient(nutrient.id);
                                              setActiveNutrientMenuId(null);
                                            }}
                                            className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                                          >
                                            <TrashIcon className="w-3.5 h-3.5 text-red-500" />
                                            <span>Remove nutrient</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Quantity & %DV */}
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                      <label className="text-xs font-medium text-[#5e5e5e]">Quantity</label>
                                      <input
                                        type="text"
                                        value={nutrient.quantity || ""}
                                        onChange={(e) => handleUpdateNutrient(nutrient.id, "quantity", e.target.value)}
                                        placeholder="Ex: 20g"
                                        className="w-full bg-white border border-[#e7e5e4] rounded-lg px-3 py-1.5 text-sm text-[#0c0a09] focus:ring-1 focus:ring-[#141010]"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-xs font-medium text-[#5e5e5e]">%DV</label>
                                      <input
                                        type="text"
                                        value={nutrient.dailyValue || ""}
                                        onChange={(e) => handleUpdateNutrient(nutrient.id, "dailyValue", e.target.value)}
                                        placeholder="Ex: 2%"
                                        className="w-full bg-white border border-[#e7e5e4] rounded-lg px-3 py-1.5 text-sm text-[#0c0a09] focus:ring-1 focus:ring-[#141010]"
                                      />
                                    </div>
                                  </div>

                                  {/* Child Nutrients List */}
                                  {nutrient.children && nutrient.children.length > 0 && (
                                    <div className="space-y-2 pt-2 border-t border-[#f0efed]">
                                      {nutrient.children.map((child) => (
                                        <div key={child.id} className="pl-3 border-l-2 border-[#d1c4c1] space-y-2 bg-[#f7f6f5] p-2.5 rounded-r-lg">
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-[#0c0a09]">{child.name}</span>
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveChildNutrient(nutrient.id, child.id)}
                                              className="text-[#928c8a] hover:text-red-600 p-0.5 cursor-pointer"
                                            >
                                              <TrashIcon className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                          <div className="grid grid-cols-2 gap-3">
                                            <input
                                              type="text"
                                              value={child.quantity || ""}
                                              onChange={(e) => handleUpdateChildNutrient(nutrient.id, child.id, "quantity", e.target.value)}
                                              placeholder="Ex: 5g"
                                              className="w-full bg-white border border-[#e7e5e4] rounded px-2.5 py-1 text-xs text-[#0c0a09]"
                                            />
                                            <input
                                              type="text"
                                              value={child.dailyValue || ""}
                                              onChange={(e) => handleUpdateChildNutrient(nutrient.id, child.id, "dailyValue", e.target.value)}
                                              placeholder="Ex: 1%"
                                              className="w-full bg-white border border-[#e7e5e4] rounded px-2.5 py-1 text-xs text-[#0c0a09]"
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Add Child Nutrient Inline Adder */}
                                  {isAddingChild ? (
                                    <div className="pt-2 border-t border-[#f0efed] space-y-2">
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="text"
                                          value={childNutrientNameInput}
                                          onChange={(e) => setChildNutrientNameInput(e.target.value)}
                                          placeholder="Enter child nutrient name"
                                          className="bg-white border border-[#e7e5e4] rounded px-2.5 py-1 text-xs text-[#0c0a09] flex-1"
                                          autoFocus
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              e.preventDefault();
                                              if (childNutrientNameInput.trim()) {
                                                handleAddChildNutrient(nutrient.id, childNutrientNameInput.trim());
                                                setChildNutrientNameInput("");
                                                setAddingChildForNutrientId(null);
                                              }
                                            }
                                          }}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (childNutrientNameInput.trim()) {
                                              handleAddChildNutrient(nutrient.id, childNutrientNameInput.trim());
                                              setChildNutrientNameInput("");
                                              setAddingChildForNutrientId(null);
                                            }
                                          }}
                                          className="px-3 py-1 bg-[#0c0a09] text-white text-xs rounded hover:bg-[#252626] font-medium cursor-pointer"
                                        >
                                          Add
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setAddingChildForNutrientId(null);
                                            setChildNutrientNameInput("");
                                          }}
                                          className="px-2 py-1 text-[#5e5e5e] text-xs hover:text-[#0c0a09] cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex justify-end pt-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAddingChildForNutrientId(nutrient.id);
                                          setChildNutrientNameInput("");
                                        }}
                                        className="px-3 py-1.5 bg-[#0c0a09] text-white rounded-lg text-xs font-medium hover:bg-[#252626] transition-colors cursor-pointer"
                                      >
                                        Add child nutrient
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Live Card Preview & AI Assistant */}
                  <div className="lg:col-span-5 xl:col-span-4 space-y-6 sticky top-6">
                    {/* Item Preview Card */}
                    <div className="bg-white rounded-xl border border-[#e7e5e4] p-6 shadow-sm">
                      <h2 className="text-[16px] font-semibold text-[#0c0a09] mb-4">Live Menu Preview Card</h2>
                      <div className="border border-[#e7e5e4] rounded-xl overflow-hidden bg-white shadow-sm">
                        <div className="aspect-[4/3] bg-[#f0efed] flex items-center justify-center relative">
                          <ImageIcon className="w-12 h-12 text-[#928c8a]" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4 justify-between">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="bg-white/90 backdrop-blur-sm text-[#0c0a09] text-xs font-semibold px-2.5 py-1 rounded-md shadow-sm">
                                {categories?.find((c) => c._id === (itemSelectedCategoryId || activeCategory?._id))?.name || "Category"}
                              </span>
                              {itemMarkAsBestseller && (
                                <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-xs flex items-center gap-1">
                                  <span>⭐</span>
                                  <span>Bestseller</span>
                                </span>
                              )}
                              {itemIsSpicy && (
                                <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-xs flex items-center gap-1">
                                  <span>🌶️</span>
                                  <span>Spicy</span>
                                </span>
                              )}
                            </div>
                            {itemShowItemType && (
                              <span className="bg-black/75 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
                                <span>{availableItemTypes.find((d) => d.id === selectedDietaryType || d.name.toLowerCase() === selectedDietaryType.toLowerCase())?.icon || "🟢"}</span>
                                <span>{availableItemTypes.find((d) => d.id === selectedDietaryType || d.name.toLowerCase() === selectedDietaryType.toLowerCase())?.label || "Vegetarian"}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-5 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-garamond text-[24px] text-[#0c0a09] leading-snug truncate pr-3">
                                {itemName || "Item Name"}
                              </h3>
                              {itemShowQuantity && itemQuantity && (
                                <p className="text-xs text-[#5e5e5e] font-medium mt-0.5">
                                  Portion: {itemQuantity} {itemQuantityUnit}
                                </p>
                              )}
                            </div>
                            <span className="font-semibold text-[16px] text-[#0c0a09]">
                              {currencySymbol}{itemPrice ? parseFloat(itemPrice).toFixed(2) : "0.00"}
                            </span>
                          </div>
                          {itemDescription ? (
                            <div
                              className="text-sm text-[#5e5e5e] rich-text-content line-clamp-3 overflow-hidden"
                              dangerouslySetInnerHTML={{ __html: itemDescription }}
                            />
                          ) : (
                            <p className="text-sm text-[#5e5e5e] italic">
                              Description will appear here as you type...
                            </p>
                          )}
                          {itemIsGst && taxBreakdown && (
                            <div className="text-[11px] text-[#5e5e5e] pt-1 border-t border-[#f0efed] mt-2">
                              Tax: {taxBreakdown.mode === "inclusive" ? "Included" : `+${currencySymbol}${taxBreakdown.totalTaxAmount}`} ({taxBreakdown.totalRate}% Tax)
                            </div>
                          )}

                          {/* Allergen Contents Preview */}
                          {itemShowAllergens && itemSelectedAllergens.length > 0 && (
                            <div className="text-[11px] text-amber-950 bg-amber-50/80 rounded-lg p-2 border border-amber-200/80 mt-2 flex items-start gap-1.5">
                              <span className="font-semibold shrink-0">⚠️ Allergens:</span>
                              <span className="truncate">{itemSelectedAllergens.join(", ")}</span>
                            </div>
                          )}

                          {/* Nutrition Preview */}
                          {(itemCaloriesPerServing || itemProtein || itemCarbs || itemFat || itemNutrients.length > 0) && (
                            <div className="mt-4 pt-3 border-t border-[#e7e5e4]">
                              <p className="text-[10px] uppercase tracking-wider text-[#5e5e5e] font-semibold mb-1">Nutrition Preview</p>
                              <p className="text-xs text-[#5e5e5e]">
                                {[
                                  itemCaloriesPerServing || "520 kcal",
                                  itemProtein ? `${itemProtein}g Protein` : null,
                                  itemCarbs ? `${itemCarbs}g Carbs` : null,
                                  itemFat ? `${itemFat}g Fat` : null,
                                ].filter(Boolean).join(" | ")}
                              </p>
                              {itemNutrients.length > 0 && (
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#5e5e5e] mt-1.5 pt-1.5 border-t border-[#f0efed]">
                                  {itemNutrients.map((n) => (
                                    <span key={n.id}>
                                      <strong className="text-[#0c0a09]">{n.name}</strong>: {n.quantity || "-"}{n.dailyValue ? ` (${n.dailyValue} DV)` : ""}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* AI Assistant Card */}
                    <div className="bg-white rounded-xl border border-[#e7e5e4] p-6 shadow-sm">
                      <h2 className="text-[16px] font-semibold text-[#0c0a09] mb-2 flex items-center gap-1.5">
                        <span>✨</span>
                        <span>AI Assistant</span>
                      </h2>
                      <p className="text-sm text-[#5e5e5e] mb-4">
                        Use AI to improve your item information and estimate nutrition values.
                      </p>
                      <button
                        type="button"
                        disabled={isGeneratingAi}
                        onClick={handleGenerateAiSuggestions}
                        className="w-full h-10 bg-[#0c0a09] text-white rounded-full font-medium text-[14px] hover:bg-[#252626] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shadow-sm"
                      >
                        {isGeneratingAi ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Generating AI Suggestions...</span>
                          </>
                        ) : (
                          <span>Confirm &amp; Generate AI Suggestions</span>
                        )}
                      </button>
                    </div>

                    {/* AI Suggestions Card (Lavender Accent) */}
                    <div className="bg-white rounded-xl border border-[#c8b8e0]/40 p-6 shadow-sm bg-[#c8b8e0]/5 space-y-4">
                      <h2 className="text-[16px] font-semibold text-[#0c0a09] flex items-center gap-2">
                        <span>✨</span>
                        <span>AI Suggestions</span>
                      </h2>

                      <div className="space-y-4">
                        {/* Suggested Name */}
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">Suggested Name</p>
                          <div className="p-3 bg-white rounded-lg border border-[#e7e5e4] flex justify-between items-center gap-2 shadow-xs">
                            <span className="text-sm font-medium text-[#0c0a09] truncate">{aiNameSuggestion}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setItemName(aiNameSuggestion)}
                                className="text-xs text-[#0c0a09] font-semibold hover:underline cursor-pointer"
                              >
                                Use
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyAiText(aiNameSuggestion, "name")}
                                className="text-xs text-[#5e5e5e] hover:text-[#0c0a09] cursor-pointer"
                              >
                                {aiCopiedKey === "name" ? "Copied!" : "Copy"}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Suggested Description */}
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">Suggested Description</p>
                          <div className="p-3 bg-white rounded-lg border border-[#e7e5e4] space-y-2 shadow-xs">
                            <p className="text-xs text-[#0c0a09] leading-relaxed">{aiDescSuggestion}</p>
                            <div className="flex justify-end gap-3 pt-1 border-t border-[#f0efed]">
                              <button
                                type="button"
                                onClick={() => setItemDescription(aiDescSuggestion)}
                                className="text-xs text-[#0c0a09] font-semibold hover:underline cursor-pointer"
                              >
                                Use
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyAiText(aiDescSuggestion, "desc")}
                                className="text-xs text-[#5e5e5e] hover:text-[#0c0a09] cursor-pointer"
                              >
                                {aiCopiedKey === "desc" ? "Copied!" : "Copy"}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Nutrition Estimate */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <p className="text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">Nutrition Estimate</p>
                            <button
                              type="button"
                              onClick={() => {
                                setItemCaloriesPerServing(aiNutritionSuggestion.calories);
                                setItemProtein(aiNutritionSuggestion.protein);
                                setItemCarbs(aiNutritionSuggestion.carbs);
                                setItemFat(aiNutritionSuggestion.fat);
                              }}
                              className="text-xs text-[#0c0a09] font-semibold hover:underline cursor-pointer"
                            >
                              Use All
                            </button>
                          </div>
                          <div className="bg-white rounded-lg border border-[#e7e5e4] overflow-hidden divide-y divide-[#e7e5e4] shadow-xs">
                            <div className="flex justify-between items-center p-2.5 text-xs">
                              <span className="text-[#0c0a09]">Calories: <strong>{aiNutritionSuggestion.calories}</strong></span>
                              <button
                                type="button"
                                onClick={() => setItemCaloriesPerServing(aiNutritionSuggestion.calories)}
                                className="text-[#0c0a09] font-semibold hover:underline cursor-pointer"
                              >
                                Use
                              </button>
                            </div>
                            <div className="flex justify-between items-center p-2.5 text-xs">
                              <span className="text-[#0c0a09]">Protein: <strong>{aiNutritionSuggestion.protein}g</strong></span>
                              <button
                                type="button"
                                onClick={() => setItemProtein(aiNutritionSuggestion.protein)}
                                className="text-[#0c0a09] font-semibold hover:underline cursor-pointer"
                              >
                                Use
                              </button>
                            </div>
                            <div className="flex justify-between items-center p-2.5 text-xs">
                              <span className="text-[#0c0a09]">Carbs: <strong>{aiNutritionSuggestion.carbs}g</strong></span>
                              <button
                                type="button"
                                onClick={() => setItemCarbs(aiNutritionSuggestion.carbs)}
                                className="text-[#0c0a09] font-semibold hover:underline cursor-pointer"
                              >
                                Use
                              </button>
                            </div>
                            <div className="flex justify-between items-center p-2.5 text-xs">
                              <span className="text-[#0c0a09]">Total Fat: <strong>{aiNutritionSuggestion.fat}g</strong></span>
                              <button
                                type="button"
                                onClick={() => setItemFat(aiNutritionSuggestion.fat)}
                                className="text-[#0c0a09] font-semibold hover:underline cursor-pointer"
                              >
                                Use
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sticky Bottom Action Bar */}
                <div className="sticky bottom-0 z-20 -mx-6 lg:-mx-8 -mb-6 lg:-mb-8 mt-12 bg-white/95 backdrop-blur-sm border-t border-[#e7e5e4] px-6 lg:px-8 py-4 flex items-center justify-between shadow-[0_-4px_16px_rgba(0,0,0,0.03)]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddItemOpen(false);
                      setEditingItem(null);
                    }}
                    className="h-11 px-6 border border-[#e7e5e4] rounded-full text-[#141010] hover:bg-[#f1edec] transition-colors font-medium text-[15px] bg-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingItem}
                    style={{ backgroundColor: "#0c0a09", color: "#ffffff" }}
                    className="h-11 px-8 rounded-full bg-[#0c0a09] text-white font-medium text-[15px] hover:bg-[#252626] transition-colors shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSavingItem ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : editingItem ? (
                      "Save Changes"
                    ) : (
                      "Save & Create Item"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : selectedCustomizationId && activeCustomization ? (

          /* ======================================================== */
          /* VIEW 2: CUSTOMIZATION CHOICES (OPTIONS) SCREEN           */
          /* ======================================================== */
          <div className="flex flex-col flex-1 min-w-0 bg-[#fdf8f7] font-sans">
            {/* Breadcrumb Navigation */}
            <div className="px-6 lg:px-8 pt-6 pb-2">
              <nav className="flex items-center text-xs font-medium text-[#5e5e5e] gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomizationId(null);
                    setSelectedItemId(null);
                    setSelectedCategoryId(null);
                  }}
                  className="hover:text-[#141010] transition-colors cursor-pointer"
                >
                  {activeMenu?.name || "Main Menu"}
                </button>
                <ChevronRightIcon className="w-3.5 h-3.5 text-[#928c8a]" />
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomizationId(null);
                    setSelectedItemId(null);
                  }}
                  className="hover:text-[#141010] transition-colors cursor-pointer"
                >
                  {activeCategory?.name || "Category"}
                </button>
                <ChevronRightIcon className="w-3.5 h-3.5 text-[#928c8a]" />
                <button
                  type="button"
                  onClick={() => setSelectedCustomizationId(null)}
                  className="hover:text-[#141010] transition-colors cursor-pointer"
                >
                  {activeItem?.name || "Item"}
                </button>
                <ChevronRightIcon className="w-3.5 h-3.5 text-[#928c8a]" />
                <span className="text-[#141010] font-bold uppercase">{activeCustomization.name}</span>
              </nav>
            </div>

            {/* Full-Width Customization Items Workspace */}
            <main className="flex-1 w-full px-6 lg:px-8 py-4 space-y-6 min-h-[calc(100vh-140px)]">
              {/* BEGIN: CustomizationGroupHeader */}
              <section className="bg-[#fdf8f7] rounded-2xl border border-[#e7e5e4] shadow-xs p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Title & Config Badges */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="font-garamond text-[32px] text-[#141010] font-normal leading-tight">
                        {activeCustomization.name}
                      </h1>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#f1edec] text-[#141010] border border-[#e7e5e4]">
                        {activeCustomization.customizationType === "AddOns" ? "Add-Ons" : "Preparations"}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        {activeCustomization.maxSelected === 1 ? "Single Selection Modifier" : `Multiple Selection Modifier (Max ${activeCustomization.maxSelected ?? 1})`}
                      </span>
                    </div>
                    {/* Parameters summary line */}
                    <p className="text-sm text-[#5e5e5e] flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[#141010]">
                        {activeCustomization.required ? "Required" : "Optional"}
                      </span>
                      <span className="text-[#e7e5e4]">•</span>
                      <span>Maximum {activeCustomization.maxSelected ?? 1} selection</span>
                      <span className="text-[#e7e5e4]">•</span>
                      <span className="font-medium text-[#141010]">
                        {(activeCustomization.items || []).length} customization items configured
                      </span>
                      <span className="text-[#e7e5e4]">•</span>
                      <span className="text-emerald-700 font-medium">
                        {(activeCustomization.items || []).filter((i: any) => i.isAvailable).length} Available to customers
                      </span>
                    </p>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center gap-3 self-start sm:self-center">
                    {/* Published Toggle */}
                    <div className="flex items-center gap-2.5 bg-[#f7f3f2] px-3.5 py-1.5 rounded-xl border border-[#e7e5e4]">
                      <span className="text-xs font-medium text-[#141010]">Group Published</span>
                      <div
                        onClick={() => handleToggleCustomizationPublished(activeCustomization)}
                        className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors ${
                          activeCustomization.published ? "bg-[#0c0a09]" : "bg-[#e6e1e1]"
                        }`}
                      >
                        <div
                          className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-transform ${
                            activeCustomization.published ? "right-[2px]" : "left-[2px]"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Edit Customization Settings */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditCustomization(activeCustomization)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#141010] bg-white border border-[#e7e5e4] rounded-xl hover:bg-[#f1edec] transition-colors cursor-pointer"
                    >
                      <EditPencilIcon className="w-3.5 h-3.5 text-[#5e5e5e]" />
                      <span>Edit Settings</span>
                    </button>
                  </div>
                </div>
              </section>
              {/* END: CustomizationGroupHeader */}

              {/* Contextual Helper Banner */}
              <div className="bg-[#eff6ff] border border-[#dbeafe] rounded-xl p-4 flex items-center gap-3 text-xs text-[#1e40af]">
                <InfoIcon className="w-4 h-4 text-[#2563eb] shrink-0" />
                <p className="font-normal">
                  <span className="font-semibold text-[#1e3a8a]">Customization Live:</span> Customization items configured here will be presented directly to cashier staff &amp; diners when adding <span className="underline decoration-blue-300 font-medium">{activeItem.name}</span> to orders. Reorder items using the drag handles on the left.
                </p>
              </div>

              {/* BEGIN: ChoicesSection */}
              <section className="space-y-4">
                {/* Table Section Header & Add Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div>
                    <h2 className="font-garamond text-[24px] text-[#141010] font-normal leading-tight">Customization Items</h2>
                    <p className="text-xs text-[#5e5e5e] mt-0.5">Manage, price, and toggle availability of items under this customization group.</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {/* Search / Quick Filter */}
                    <div className="relative">
                      <input
                        type="text"
                        value={choiceSearchQuery}
                        onChange={(e) => setChoiceSearchQuery(e.target.value)}
                        placeholder="Filter customization items..."
                        className="text-xs pl-8 pr-3 py-2 rounded-xl border border-[#e7e5e4] bg-[#f7f3f2] focus:bg-white focus:border-[#141010] text-[#141010] w-52 placeholder-[#928c8a] outline-none font-medium transition"
                      />
                      <svg className="w-3.5 h-3.5 text-[#928c8a] absolute left-2.5 top-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    {/* Primary Action Button: + Add customization item */}
                    <button
                      type="button"
                      onClick={handleOpenAddChoice}
                      style={{ backgroundColor: "#0c0a09", color: "#ffffff" }}
                      className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#0c0a09] hover:bg-[#252626] rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      <PlusIcon className="w-4 h-4 text-white" />
                      <span className="text-white font-semibold">Add customization item</span>
                    </button>
                  </div>
                </div>

                {/* Full-Width Clean Table Card */}
                <div className="bg-white border border-[#e7e5e4] rounded-2xl shadow-none overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[#e7e5e4] bg-[#fdf8f7] text-[#5e5e5e] uppercase tracking-wider font-semibold text-[11px]">
                            <th className="py-3.5 pl-5 pr-2 w-14 text-center" scope="col">#</th>
                            <th className="py-3.5 px-4" scope="col">Customization Item Name</th>
                            <th className="py-3.5 px-4" scope="col">Additional Price</th>
                            <th className="py-3.5 px-4" scope="col">Dietary Attributes</th>
                            <th className="py-3.5 px-4" scope="col">Availability</th>
                            <th className="py-3.5 pr-6 pl-4 text-right" scope="col">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f1edec] text-[#141010] font-normal">
                          {filteredChoices && filteredChoices.length > 0 ? (
                            filteredChoices.map((choice: any, index: number) => {
                              const isSnoozed = !choice.isAvailable;
                              const isDragging = draggedChoiceIndex === index;
                              const isDragOver = dragOverChoiceIndex === index;
                              return (
                                <tr
                                  key={choice._id}
                                  draggable
                                  onDragStart={(e) => handleChoiceDragStart(e, index)}
                                  onDragOver={(e) => handleChoiceDragOver(e, index)}
                                  onDrop={(e) => handleChoiceDrop(e, index)}
                                  onDragEnd={handleChoiceDragEnd}
                                  className={`transition-all duration-150 group select-none ${
                                    isDragging
                                      ? "opacity-25 bg-[#f1edec] scale-[0.99]"
                                      : isDragOver
                                      ? "bg-[#f1edec] border-t-2 border-[#141010]"
                                      : isSnoozed
                                      ? "bg-amber-50/30 hover:bg-amber-50/50"
                                      : "hover:bg-[#fafafa]"
                                  }`}
                                >
                                  {/* Handle & Index */}
                                  <td className="py-4 pl-5 pr-2 text-center cursor-grab active:cursor-grabbing">
                                    <div className="flex items-center justify-center gap-1 text-[#928c8a] group-hover:text-[#141010]">
                                      <DragHandleIcon className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
                                      <span className="text-[11px] font-mono font-medium text-[#928c8a]">{index + 1}</span>
                                    </div>
                                  </td>
                                  {/* Customization Item Name */}
                                  <td className="py-4 px-4">
                                    <div className="font-semibold text-[#141010] text-sm flex items-center gap-2">
                                      <span>{choice.name}</span>
                                      {isSnoozed && (
                                        <span className="text-[10px] bg-amber-100 text-amber-900 font-medium px-1.5 py-0.5 rounded border border-amber-200">
                                          Snoozed
                                        </span>
                                      )}
                                    </div>
                                    {choice.description && (
                                      <div className="text-[11px] text-[#5e5e5e] mt-0.5">{choice.description}</div>
                                    )}
                                  </td>
                                  {/* Additional Price */}
                                  <td className="py-4 px-4 font-semibold text-[#141010] text-sm">
                                    {choice.price > 0 ? `+${currencySymbol}${(choice.price / 100).toFixed(0)}` : `${currencySymbol}0`}
                                  </td>
                                  {/* Dietary / Attributes */}
                                  <td className="py-4 px-4">
                                    {(() => {
                                      const dtype = choice.dietaryType || (choice.isVeg === false ? "non_veg" : "veg");
                                      const dietaryObj = availableItemTypes.find((d) =>
                                        d.id === dtype ||
                                        d.name.toLowerCase() === dtype.toLowerCase() ||
                                        (dtype === "veg" && d.name.toLowerCase().includes("veg") && !d.name.toLowerCase().includes("non"))
                                      );
                                      const isVegType = !dietaryObj?.name?.toLowerCase().includes("non");
                                      return (
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium border ${
                                          isVegType
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                            : "bg-red-50 text-red-700 border-red-200"
                                        }`}>
                                          <span>{dietaryObj?.icon || "🟢"}</span>
                                          <span>{dietaryObj?.label || "Veg"}</span>
                                        </span>
                                      );
                                    })()}
                                  </td>
                                  {/* Availability Pill */}
                                  <td className="py-4 px-4">
                                    {choice.isAvailable ? (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                        Available
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                        <ClockIcon className="w-3.5 h-3.5 text-amber-600" />
                                        <span>Out of stock</span>
                                      </span>
                                    )}
                                  </td>
                                  {/* Actions */}
                                  <td className="py-4 pr-6 pl-4 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenChoiceUnavailabilityModal(choice)}
                                        className="p-1.5 text-[#5e5e5e] hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                        title="Quick restock / snooze timer"
                                      >
                                        <ClockIcon className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditChoice(choice)}
                                        className="p-1.5 text-[#5e5e5e] hover:text-[#141010] hover:bg-[#f1edec] rounded transition-colors cursor-pointer"
                                        title="Edit customization item details"
                                      >
                                        <EditPencilIcon className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenDuplicateChoice(choice)}
                                        className="p-1.5 text-[#5e5e5e] hover:text-[#141010] hover:bg-[#f1edec] rounded transition-colors cursor-pointer"
                                        title="Duplicate customization item"
                                      >
                                        <CopyIcon className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={6} className="py-12 text-center text-[#5e5e5e] text-xs">
                                No customization items found. Click <strong>+ Add customization item</strong> to add items.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {/* Bottom Table Footer Summary */}
                    <div className="px-6 py-3.5 bg-[#fdf8f7] border-t border-[#e7e5e4] flex flex-col sm:flex-row items-center justify-between text-xs text-[#5e5e5e] gap-2">
                      <div className="flex items-center gap-4">
                        <span>Showing <strong className="font-medium text-[#141010]">{filteredChoices.length}</strong> of {(activeCustomization.items || []).length} customization items</span>
                        <span className="text-[#e7e5e4]">•</span>
                        <span>All changes automatically synced with terminal registers</span>
                      </div>
                    </div>
                  </div>
                </section>
                {/* END: ChoicesSection */}

                {/* Advanced Technical Rules Box */}
                <section className="bg-white rounded-2xl border border-[#e7e5e4] p-5 shadow-none">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#f1edec] flex items-center justify-center text-[#141010]">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-garamond text-[18px] text-[#141010] font-normal leading-tight">Customization Tax &amp; Inventory Calculation</h3>
                        <p className="text-xs text-[#5e5e5e]">Tax calculation is configured for all customization items under this group. Stock deductions trigger recipe level debits on order fulfillment.</p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      Tax Configured
                    </span>
                  </div>
                </section>
              </main>
            </div>
          ) : selectedItemId && activeItem ? (
          
          /* ======================================================== */
          /* VIEW 3: ITEM CUSTOMIZATIONS MANAGEMENT VIEW (PREST THEME)*/
          /* ======================================================== */
          <div className="flex flex-col flex-1 min-w-0">
            {/* Workspace Header (Consistent with PREST) */}
            <div className="bg-[#fdf8f7] px-6 lg:px-8 py-6 border-b border-[#e7e5e4] shrink-0">
              <div className="flex items-end justify-between w-full">
                <div>
                  <nav className="flex items-center text-xs font-medium text-gray-500 mb-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItemId(null);
                        setSelectedCategoryId(null);
                      }}
                      className="hover:text-gray-900 transition-colors cursor-pointer"
                    >
                      {activeMenu?.name || "Main Menu"}
                    </button>
                    <ChevronRightIcon className="w-3.5 h-3.5 text-gray-400" />
                    <button
                      type="button"
                      onClick={() => setSelectedItemId(null)}
                      className="hover:text-gray-900 transition-colors cursor-pointer"
                    >
                      {activeCategory?.name || "Category"}
                    </button>
                    <ChevronRightIcon className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-900 font-bold uppercase">{activeItem.name}</span>
                  </nav>
                  <h1 className="font-garamond text-[32px] text-[#141010] font-normal leading-tight flex items-center gap-3">
                    <span>{activeItem.name}</span>
                    <span className="text-2xl font-normal text-[#5e5e5e]">
                      {currencySymbol}{(activeItem.price / 100).toFixed(2)}
                    </span>
                  </h1>
                </div>

                <div className="flex items-center gap-3 font-sans">
                  <button
                    type="button"
                    onClick={() => setSelectedItemId(null)}
                    className="h-10 px-5 rounded-full border border-[#e7e5e4] bg-transparent hover:bg-[#f1edec] text-[#141010] font-medium text-[14px] transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <ChevronRightIcon className="w-3.5 h-3.5 rotate-180" />
                    <span>Back to Items</span>
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsAddCustomizationDropdownOpen(!isAddCustomizationDropdownOpen)}
                      style={{ backgroundColor: "#0c0a09", color: "#ffffff" }}
                      className="h-10 px-5 rounded-full bg-[#0c0a09] text-white font-medium text-[14px] hover:bg-[#252626] transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                    >
                      <PlusIcon className="w-4 h-4 text-white" />
                      <span className="text-white font-medium text-[14px]">Add Customization</span>
                      <ChevronDownIcon className="w-4 h-4 text-white opacity-80" />
                    </button>

                    {isAddCustomizationDropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-white border border-[#e7e5e4] shadow-xl py-1 z-50 divide-y divide-[#e7e5e4]">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddCustomizationDropdownOpen(false);
                            handleOpenAddCustomization();
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm text-[#141010] hover:bg-[#fafafa] flex items-center gap-2 font-medium cursor-pointer"
                        >
                          <PlusIcon className="w-4 h-4" />
                          <span>New Customization</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleOpenAddExistingCustomizationDrawer}
                          className="w-full text-left px-4 py-2.5 text-sm text-[#141010] hover:bg-[#fafafa] flex items-center gap-2 font-medium cursor-pointer"
                        >
                          <CopyIcon className="w-4 h-4" />
                          <span>Existing Customization</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Two Column Layout: Left Item Switcher, Right Customizations Table */}
            <main className="flex-1 flex flex-row w-full px-4 lg:px-6 py-5 gap-5 items-start font-sans min-h-[calc(100vh-210px)]">
              
              {/* Left Items Column in Category */}
              <div className="w-60 lg:w-64 shrink-0 flex flex-col bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] overflow-hidden sticky top-6 shadow-xs">
                <div className="p-4 border-b border-[#e7e5e4] flex justify-between items-center bg-[#fdf8f7] shrink-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[18px] font-medium text-[#141010]">Items</h2>
                    <span className="px-2 py-0.5 rounded-full bg-[#f1edec] text-[#5e5e5e] text-xs font-semibold border border-[#e7e5e4]">
                      {categoryItems?.length || 0}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenAddNewItem}
                    className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#141010] transition-colors cursor-pointer"
                    title="Add Item"
                  >
                    <PlusIcon className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-[#e7e5e4] max-h-[calc(100vh-300px)]">
                  {categoryItems && categoryItems.length > 0 ? (
                    categoryItems.map(({ item }) => {
                      const isSelected = item._id === selectedItemId;
                      const initialLetter = item.name ? item.name.charAt(0).toUpperCase() : "I";
                      return (
                        <div
                          key={item._id}
                          onClick={() => {
                            setSelectedItemId(item._id);
                            setSelectedCustomizationId(null);
                          }}
                          className={`flex items-center justify-between p-4 cursor-pointer transition-colors border-l-2 group select-none ${
                            isSelected
                              ? "bg-[#fafafa] border-b border-[#e7e5e4] border-l-[#0c0a09]"
                              : "hover:bg-white border-b border-[#e7e5e4] border-l-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <span className={`cursor-grab text-[#5e5e5e] text-[18px] transition-opacity ${
                              isSelected ? "opacity-50 group-hover:opacity-100" : "opacity-0 group-hover:opacity-50"
                            }`}>
                              <DragHandleIcon className="w-4 h-4" />
                            </span>
                            <div className="w-7 h-7 rounded-full bg-[#f1edec] border border-[#e7e5e4] flex items-center justify-center font-bold text-[11px] text-[#141010] shrink-0">
                              {initialLetter}
                            </div>
                            <span className={`text-[15px] truncate ${isSelected ? "font-semibold text-[#141010]" : "text-[#5e5e5e]"}`}>
                              {item.name}
                            </span>
                          </div>

                          {isSelected && (
                            <ChevronRightIcon className="w-4 h-4 text-[#141010] shrink-0" />
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-xs text-[#5e5e5e]">
                      No items in this category.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Customizations Workspace */}
              <div className="flex-1 flex flex-col bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] overflow-hidden min-h-[500px] shadow-xs">
                
                {/* Item Hero Banner */}
                <div className="p-6 border-b border-[#e7e5e4] bg-[#fdf8f7] shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h2 className="font-garamond text-[26px] md:text-[30px] font-normal text-[#141010] leading-tight">
                        {activeItem.name}
                      </h2>
                      <span className="text-xl font-medium text-[#5e5e5e]">
                        {currencySymbol}{(activeItem.price / 100).toFixed(0)}
                      </span>

                      {/* Clean Availability badge */}
                      <div
                        onClick={() => handleToggleItemAvailability(activeItem._id, activeItem.isAvailable)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold cursor-pointer transition select-none ${
                          activeItem.isAvailable
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100"
                            : "bg-[#e6e1e1] text-[#5e5e5e] border-[#e7e5e4] hover:bg-[#ddd9d8]"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${activeItem.isAvailable ? "bg-emerald-500" : "bg-gray-400"}`} />
                        <span>{activeItem.isAvailable ? "Available" : "Sold Out"}</span>
                      </div>

                      {/* Published switch */}
                      <div className="flex items-center gap-2 pl-2 border-l border-gray-200 select-none">
                        <div
                          onClick={() => handleToggleItemPublished(activeItem._id, !!activeItem.published)}
                          className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors ${
                            activeItem.published ? "bg-black" : "bg-gray-300"
                          }`}
                        >
                          <div
                            className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-transform ${
                              activeItem.published ? "right-[2px]" : "left-[2px]"
                            }`}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700">Published</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                      Manage add-ons, availability, and customizations available for this item.
                    </p>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center gap-1 text-gray-500">
                    <button
                      type="button"
                      onClick={() => handleOpenEditItem(activeItem)}
                      className="p-2 hover:text-black hover:bg-gray-100 rounded-md transition cursor-pointer"
                      title="View details"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenUnavailabilityModal(activeItem)}
                      className="p-2 hover:text-black hover:bg-gray-100 rounded-md transition cursor-pointer"
                      title="Set unavailability timer"
                    >
                      <ClockIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDuplicateItem(activeItem)}
                      className="p-2 hover:text-black hover:bg-gray-100 rounded-md transition cursor-pointer"
                      title="Duplicate item"
                    >
                      <CopyIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditItem(activeItem)}
                      className="p-2 hover:text-black hover:bg-gray-100 rounded-md transition cursor-pointer"
                      title="Edit this item"
                    >
                      <EditPencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDeleteItem(activeItem)}
                      className="p-2 hover:text-red-600 hover:bg-red-50 rounded-md transition cursor-pointer"
                      title="Delete item"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Customizations Table */}
                <div className="flex-1 overflow-x-auto overflow-y-auto">
                  <table className="w-full text-left border-collapse font-sans min-w-[620px]">
                    <thead className="bg-white sticky top-0 border-b border-[#e7e5e4] z-10 text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">
                      <tr>
                        <th className="w-8 px-2 py-3 text-center"></th>
                        <th className="px-3 py-3">CUSTOMIZATION</th>
                        <th className="px-3 py-3">TYPE</th>
                        <th className="px-3 py-3">SELECTION RULES</th>
                        <th className="px-3 py-3">CUSTOMIZATION ITEMS</th>
                        <th className="px-2 py-3 text-center">PUBLISHED</th>
                        <th className="px-3 py-3 text-right">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="text-[13px] text-[#1c1b1b]">
                      {itemCustomizations && itemCustomizations.length > 0 ? (
                        itemCustomizations.map((cust, index) => {
                          const choicesCount = cust.items?.length || 0;
                          const isDragging = draggedCustomizationIndex === index;
                          const isDragOver = dragOverCustomizationIndex === index;
                          return (
                            <tr
                              key={cust._id}
                              draggable
                              onDragStart={(e) => handleCustomizationDragStart(e, index)}
                              onDragOver={(e) => handleCustomizationDragOver(e, index)}
                              onDrop={(e) => handleCustomizationDrop(e, index)}
                              onDragEnd={handleCustomizationDragEnd}
                              onClick={() => setSelectedCustomizationId(cust._id)}
                              className={`border-b border-[#e7e5e4] transition-all select-none cursor-pointer group ${
                                isDragging
                                  ? "opacity-25 bg-[#f1edec]"
                                  : isDragOver
                                  ? "bg-[#f1edec] border-t-2 border-[#141010]"
                                  : "hover:bg-[#fafafa]"
                              }`}
                              title="Click to manage customization items or drag to reorder"
                            >
                              <td className="px-2 py-3 text-center text-[#5e5e5e] opacity-40 group-hover:opacity-100 cursor-grab active:cursor-grabbing">
                                <DragHandleIcon className="w-4 h-4 mx-auto" />
                              </td>
                              <td className="px-3 py-3">
                                <span className="font-semibold text-[#141010] block">
                                  {cust.name}
                                </span>
                                <span className="text-[11px] text-[#5e5e5e] block">
                                  {cust.customizationType === "AddOns" ? "Add-on modifier group" : "Kitchen cook instruction"}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                                    cust.customizationType === "AddOns"
                                      ? "bg-[#f1edec] text-[#141010] border-[#e7e5e4]"
                                      : "bg-blue-50 text-blue-700 border-blue-200"
                                  }`}
                                >
                                  {cust.customizationType === "AddOns" ? "Add-Ons" : "Preparations"}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-[#5e5e5e]">
                                <span
                                  className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                                    cust.required
                                      ? "text-amber-800 bg-amber-100"
                                      : "text-[#5e5e5e] bg-[#f1edec]"
                                  }`}
                                >
                                  {cust.required ? "Required" : "Optional"}
                                </span>
                                <span className="text-[11px] text-[#5e5e5e] ml-1">
                                  · Max {cust.maxSelected ?? 1} {cust.maxSelected === 1 ? "item" : "items"}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <span className="font-medium text-[#141010] hover:underline">
                                  {choicesCount} {choicesCount === 1 ? "item" : "items"}
                                </span>
                              </td>
                              <td className="px-2 py-3 text-center">
                                <div className="inline-flex items-center justify-center gap-2">
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleCustomizationPublished(cust);
                                    }}
                                    className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${
                                      cust.published ? "bg-[#0c0a09]" : "bg-[#e6e1e1] border border-[#e7e5e4]"
                                    }`}
                                  >
                                    <div
                                      className={`absolute top-[2px] w-3 h-3 bg-white rounded-full transition-transform ${
                                        cust.published ? "right-[2px]" : "left-[2px]"
                                      }`}
                                    />
                                  </div>
                                  <span className={`text-[11px] font-semibold w-7 text-left ${cust.published ? "text-[#141010]" : "text-[#5e5e5e]"}`}>
                                    {cust.published ? "ON" : "OFF"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right space-x-1 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditCustomization(cust);
                                  }}
                                  className="p-1.5 hover:bg-[#f1edec] rounded text-[#5e5e5e] hover:text-[#141010] transition cursor-pointer"
                                  title="Edit customization"
                                >
                                  <EditPencilIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingCustomizationId(cust._id);
                                    setIsDeleteCustomizationOpen(true);
                                  }}
                                  className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded text-[#5e5e5e] transition cursor-pointer"
                                  title="Delete customization"
                                >
                                  <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-[#5e5e5e] text-xs">
                            No customizations configured for this item. Click <strong>+ Add Customization</strong> to add modifiers, portion sizes, or kitchen instructions.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </main>
          </div>
        ) : (
          
          /* ======================================================== */
          /* VIEW 4: TWO-PANEL INTERFACE (EXACT PREST MOCKUP)         */
          /* ======================================================== */
          <div className="flex flex-col flex-1 min-w-0">
            {/* Workspace Context (Top-level Menu Selector) */}
            <div className="bg-[#fdf8f7] px-6 lg:px-8 py-6 border-b border-[#e7e5e4] shrink-0">
              <div className="flex items-end justify-between w-full">
                <div>
                  <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-[#5e5e5e] mb-2">
                    Workspace
                  </p>
                  <div className="relative flex items-center gap-4">
                    {/* Menu Title Dropdown Button */}
                    <button
                      type="button"
                      onClick={() => setIsMenuDropdownOpen(!isMenuDropdownOpen)}
                      className="flex items-center gap-2 group cursor-pointer"
                    >
                      <span className="font-garamond text-[32px] text-[#141010] font-normal leading-tight">
                        {activeMenu?.name || "Main Menu"}
                      </span>
                      <span className="text-[#5e5e5e] group-hover:text-[#141010] transition-colors mt-1">
                        <ChevronDownIcon className="w-5 h-5" />
                      </span>
                    </button>

                    {activeMenu?.isActive && (
                      <span className="px-2 py-1 bg-[#f1edec] text-[#5e5e5e] font-sans text-[10px] font-semibold rounded uppercase tracking-wider border border-[#e7e5e4] self-center mt-2">
                        Active
                      </span>
                    )}

                    {/* Menu Dropdown Menu */}
                    {isMenuDropdownOpen && (
                      <div className="absolute left-0 top-full mt-2 w-64 rounded-xl bg-white border border-[#e7e5e4] shadow-xl py-2 z-50 divide-y divide-[#e7e5e4]">
                        <div className="py-1">
                          {menus?.map((m) => {
                            const isSelected = m._id === selectedMenuId;
                            return (
                              <button
                                key={m._id}
                                type="button"
                                onClick={() => {
                                  setSelectedMenuId(m._id);
                                  setIsMenuDropdownOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2.5 flex items-center justify-between text-sm transition-colors cursor-pointer ${
                                  isSelected ? "bg-[#f1edec] font-semibold text-[#141010]" : "hover:bg-[#fafafa] text-[#5e5e5e]"
                                }`}
                              >
                                <span>{m.name}</span>
                                {m.isDefault && (
                                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                                    Default
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsMenuDropdownOpen(false);
                              setIsCreateMenuOpen(true);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-[#141010] hover:bg-[#fafafa] flex items-center gap-2 font-medium cursor-pointer"
                          >
                            <PlusIcon className="w-4 h-4" />
                            <span>Create New Menu</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 font-sans">
                  {activeMenu && (
                    <button
                      type="button"
                      onClick={openEditMenuDrawer}
                      className="h-10 px-4 rounded-full border border-[#e7e5e4] bg-transparent hover:bg-[#f1edec] text-[#141010] font-medium text-[15px] transition-colors flex items-center gap-2 cursor-pointer shadow-none"
                    >
                      <EditPencilIcon className="w-4 h-4 text-[#141010]" />
                      <span>Edit Details</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsCreateMenuOpen(true)}
                    style={{ backgroundColor: "#0c0a09", color: "#ffffff" }}
                    className="h-10 px-6 rounded-full bg-[#0c0a09] text-white font-medium text-[15px] hover:bg-[#252626] transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                  >
                    <PlusIcon className="w-4 h-4 text-white" />
                    <span className="text-white font-medium text-[15px]">Create Menu</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Empty State Banner */}
            {(!menus || menus.length === 0) && (
              <div className="w-full p-8 text-center bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] mt-6">
                <div className="text-4xl">🍽</div>
                <h2 className="mt-3 font-garamond text-2xl font-normal text-[#141010]">No Menus Created Yet</h2>
                <p className="mt-1 text-sm text-[#5e5e5e]">
                  Get started by creating a new menu or loading sample categories (Viral Food, Starters, Mains).
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleSeedSample}
                    style={{ backgroundColor: "#0c0a09", color: "#ffffff" }}
                    className="rounded-full bg-[#0c0a09] text-white px-6 py-2.5 text-sm font-medium shadow-none hover:bg-[#252626] transition cursor-pointer"
                  >
                    Load Sample Menu (Demo)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreateMenuOpen(true)}
                    className="rounded-full border border-[#e7e5e4] bg-transparent px-6 py-2.5 text-sm font-medium text-[#141010] hover:bg-[#f1edec] transition cursor-pointer"
                  >
                    + Create Custom Menu
                  </button>
                </div>
              </div>
            )}

            {/* Two Panel Layout */}
            {activeMenu && (
              <main className="flex-1 flex flex-row w-full px-4 lg:px-6 py-5 gap-5 items-start font-sans min-h-[calc(100vh-210px)]">
                
                {/* ---------------------------------------------------- */}
                {/* LEFT PANEL (Categories)                              */}
                {/* ---------------------------------------------------- */}
                <div className="w-60 lg:w-64 shrink-0 flex flex-col bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] overflow-hidden sticky top-6 shadow-xs">
                  <div className="p-4 border-b border-[#e7e5e4] flex justify-between items-center bg-[#fdf8f7] shrink-0">
                    <h2 className="text-[18px] font-medium text-[#141010]">Categories</h2>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategory(null);
                        setCategoryName("");
                        setCategoryPublished(true);
                        setIsAddCategoryOpen(true);
                      }}
                      className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#141010] transition-colors cursor-pointer"
                      title="Add Category"
                    >
                      <PlusIcon className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-[#e7e5e4] max-h-[calc(100vh-300px)]">
                    {categories && categories.length > 0 ? (
                      categories.map((cat, index) => {
                        const isSelected = cat._id === selectedCategoryId;
                        return (
                          <div
                            key={cat._id}
                            draggable
                            onDragStart={(e) => handleCategoryDragStart(e, index)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleCategoryDrop(e, index)}
                            onClick={() => setSelectedCategoryId(cat._id)}
                            className={`flex items-center justify-between p-4 cursor-pointer transition-colors border-l-2 group ${
                              isSelected
                                ? "bg-[#fafafa] border-b border-[#e7e5e4] border-l-[#0c0a09]"
                                : "hover:bg-white border-b border-[#e7e5e4] border-l-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 pr-2">
                              <span
                                className={`cursor-grab active:cursor-grabbing text-[#5e5e5e] text-[18px] transition-opacity ${
                                  isSelected ? "opacity-50 group-hover:opacity-100" : "opacity-0 group-hover:opacity-50"
                                }`}
                              >
                                <DragHandleIcon className="w-4 h-4" />
                              </span>
                              <span className={`text-[15px] truncate ${isSelected ? "font-semibold text-[#141010]" : "text-[#5e5e5e]"}`}>
                                {cat.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {/* Toggle */}
                              <div
                                onClick={(e) => handleToggleCategory(e, cat._id, cat.published)}
                                className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${
                                  cat.published ? "bg-[#0c0a09]" : "bg-[#e6e1e1] border border-[#e7e5e4]"
                                }`}
                              >
                                <div
                                  className={`absolute top-[2px] w-3 h-3 bg-white rounded-full transition-transform ${
                                    cat.published ? "right-[2px]" : "left-[2px] bg-[#5e5e5e]"
                                  }`}
                                />
                              </div>

                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCategory(cat);
                                  setCategoryName(cat.name);
                                  setCategoryPublished(cat.published);
                                  setIsAddCategoryOpen(true);
                                }}
                                className="w-6 h-6 rounded hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                title="Edit Category"
                              >
                                <EditPencilIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-8 text-center text-xs text-[#5e5e5e]">
                        No categories found. Click <strong>+</strong> to create one.
                      </div>
                    )}
                  </div>
                </div>

                {/* ---------------------------------------------------- */}
                {/* RIGHT PANEL (Items Table - Clean & Clickable)        */}
                {/* ---------------------------------------------------- */}
                <div className="flex-1 flex flex-col bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] overflow-hidden min-h-[500px] shadow-xs">
                  {activeCategory ? (
                    <>
                      {/* Category Items Header */}
                      <div className="p-6 border-b border-[#e7e5e4] bg-[#fdf8f7] shrink-0 flex justify-between items-start">
                        <div>
                          <h2 className="font-garamond text-[26px] md:text-[30px] font-normal text-[#141010] leading-tight">
                            Items in {activeCategory.name}
                          </h2>
                          <p className="text-[14px] text-[#5e5e5e] mt-1">
                            {activeItemsCount} active items in this category.
                          </p>
                        </div>

                        {/* Add Item Dropdown Button */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setIsAddItemDropdownOpen(!isAddItemDropdownOpen)}
                            style={{ backgroundColor: "#0c0a09", color: "#ffffff" }}
                            className="h-10 px-5 rounded-full bg-[#0c0a09] text-white font-medium text-[15px] hover:bg-[#252626] transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                          >
                            <PlusIcon className="w-4 h-4 text-white" />
                            <span className="text-white font-medium text-[15px]">Add Item</span>
                            <ChevronDownIcon className="w-4 h-4 ml-1 text-white opacity-80" />
                          </button>

                          {/* Dropdown Popover */}
                          {isAddItemDropdownOpen && (
                            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-white border border-[#e7e5e4] shadow-xl py-1 z-50 divide-y divide-[#e7e5e4] font-sans">
                              <button
                                type="button"
                                onClick={handleOpenAddNewItem}
                                className="w-full text-left px-4 py-2.5 text-sm text-[#141010] hover:bg-[#fafafa] flex items-center gap-2 font-medium cursor-pointer"
                              >
                                <PlusIcon className="w-4 h-4" />
                                <span>New Item</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleOpenAddExistingItemDrawer}
                                className="w-full text-left px-4 py-2.5 text-sm text-[#141010] hover:bg-[#fafafa] flex items-center gap-2 font-medium cursor-pointer"
                              >
                                <CopyIcon className="w-4 h-4" />
                                <span>Existing Item</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Clean Items Table Matching Mockup */}
                      <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-left border-collapse font-sans">
                          <thead className="bg-white sticky top-0 border-b border-[#e7e5e4] z-10 text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">
                            <tr>
                              <th className="w-12 px-4 py-3"></th>
                              <th className="px-4 py-3">Item Details</th>
                              <th className="px-4 py-3 w-32 text-right">Base Price</th>
                              <th className="px-4 py-3 w-20 text-center">Status</th>
                              <th className="w-16 px-4 py-3 text-right"></th>
                            </tr>
                          </thead>
                          <tbody className="text-[14px] text-[#1c1b1b]">
                            {categoryItems && categoryItems.length > 0 ? (
                              categoryItems.map(({ categoryItemId, item }, index) => {
                                const initialLetter = item.name ? item.name.charAt(0).toUpperCase() : "I";
                                return (
                                  <tr
                                    key={categoryItemId}
                                    draggable
                                    onDragStart={(e) => handleItemDragStart(e, index)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleItemDrop(e, index)}
                                    onClick={() => setSelectedItemId(item._id)}
                                    className={`border-b border-[#e7e5e4] hover:bg-[#fafafa] transition-colors group select-none cursor-pointer ${
                                      !item.isAvailable ? "opacity-60" : ""
                                    }`}
                                    title="Click to manage item customizations"
                                  >
                                    {/* Drag Handle */}
                                    <td className="px-4 py-3 text-center">
                                      <span
                                        onClick={(e) => e.stopPropagation()}
                                        className="cursor-grab active:cursor-grabbing text-[#5e5e5e] text-[18px] opacity-0 group-hover:opacity-50 transition-opacity"
                                      >
                                        <DragHandleIcon className="w-4 h-4 mx-auto" />
                                      </span>
                                    </td>

                                    {/* Item Details */}
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-lg bg-[#f1edec] border border-[#e7e5e4] overflow-hidden shrink-0 flex items-center justify-center font-bold text-[#141010] text-sm">
                                          {item.imageUrl ? (
                                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                          ) : (
                                            <span>{initialLetter}</span>
                                          )}
                                        </div>
                                        <div>
                                          <p className="font-semibold text-[16px] text-[#141010] flex items-center gap-2">
                                            <span className={(item.published ?? true) ? "" : "text-[#928c8a]"}>{item.name}</span>
                                            {(item.published ?? true) && !item.isAvailable && (
                                              <span className="inline-block px-1.5 py-0.5 bg-[#e6e1e1] text-[#5e5e5e] text-[10px] uppercase font-bold tracking-wider rounded">
                                                Sold Out
                                              </span>
                                            )}
                                          </p>
                                          {item.description ? (
                                            <p className="text-[#5e5e5e] text-[13px] line-clamp-1 mt-0.5 max-w-xl">
                                              {stripHtml(item.description)}
                                            </p>
                                          ) : (
                                            <p className="text-[#928c8a] text-[12px] italic mt-0.5">No description</p>
                                          )}
                                        </div>
                                      </div>
                                    </td>

                                    {/* Base Price */}
                                    <td className="px-4 py-3 text-right font-medium text-[#141010] whitespace-nowrap">
                                      {currencySymbol}{(item.price / 100).toFixed(2)}
                                    </td>

                                    {/* Status Toggle */}
                                    <td className="px-4 py-3 text-center">
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleItemPublished(item._id, item.published ?? true);
                                        }}
                                        className={`w-8 h-4 rounded-full relative cursor-pointer inline-block transition-colors ${
                                          (item.published ?? true) ? "bg-[#0c0a09]" : "bg-[#e6e1e1] border border-[#e7e5e4]"
                                        }`}
                                        title={(item.published ?? true) ? "Published (Click to Unpublish)" : "Unpublished (Click to Publish)"}
                                      >
                                        <div
                                          className={`absolute top-[2px] w-3 h-3 bg-white rounded-full transition-transform ${
                                            (item.published ?? true) ? "right-[2px]" : "left-[2px] bg-[#5e5e5e]"
                                          }`}
                                        />
                                      </div>
                                    </td>

                                    {/* Edit Icon on Hover */}
                                    <td className="px-4 py-3 text-right">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenEditItem(item);
                                        }}
                                        className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] transition-colors inline-flex opacity-0 group-hover:opacity-100 cursor-pointer"
                                        title="Edit Item Details"
                                      >
                                        <EditPencilIcon className="w-4 h-4 text-[#141010]" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={5} className="py-16 text-center text-[#5e5e5e] text-sm">
                                  No items in this category yet. Click <strong>+ Add Item</strong> to create one.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="p-16 text-center text-[#5e5e5e] text-sm">
                      Please select a category from the left panel.
                    </div>
                  )}
                </div>
              </main>
            )}
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* SLIDE-OVER DRAWER: CREATE MENU                       */}
        {/* ---------------------------------------------------- */}
        {isCreateMenuOpen && (
          <div className="fixed inset-0 bg-[#0c0a09]/20 backdrop-blur-sm z-50 transition-opacity flex justify-end font-sans">
            <div className="h-full w-96 max-w-full bg-[#fdf8f7] shadow-2xl border-l border-[#e7e5e4] transform transition-transform duration-300 flex flex-col justify-between">
              <div>
                <div className="p-6 border-b border-[#e7e5e4] flex justify-between items-center bg-[#fdf8f7]">
                  <h2 className="font-garamond text-[24px] text-[#141010] font-normal leading-tight">Create New Menu</h2>
                  <button
                    type="button"
                    onClick={() => setIsCreateMenuOpen(false)}
                    className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] hover:text-[#141010] transition-colors cursor-pointer"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>

                <form id="create-menu-form" onSubmit={handleCreateMenuSubmit} className="p-6 space-y-4">
                  {createMenuError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                      {createMenuError}
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#5e5e5e]">Menu Name *</label>
                    <input
                      type="text"
                      required
                      value={menuName}
                      onChange={(e) => setMenuName(e.target.value)}
                      placeholder="e.g. Breakfast Menu"
                      className="w-full rounded-lg border border-[#e7e5e4] bg-white px-3 py-2 text-sm text-[#141010] focus:border-[#141010] focus:ring-0 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#5e5e5e]">Description</label>
                    <textarea
                      rows={3}
                      value={menuDescription}
                      onChange={(e) => setMenuDescription(e.target.value)}
                      placeholder="Optional details or service times..."
                      className="w-full rounded-lg border border-[#e7e5e4] bg-white px-3 py-2 text-sm text-[#141010] focus:border-[#141010] focus:ring-0 outline-none"
                    />
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-[#e7e5e4] bg-[#fdf8f7] flex justify-end gap-3 font-sans">
                <button
                  type="button"
                  onClick={() => setIsCreateMenuOpen(false)}
                  className="h-10 px-5 rounded-full border border-[#e7e5e4] bg-transparent text-[#141010] font-medium text-[15px] hover:bg-[#f1edec] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="create-menu-form"
                  disabled={isCreatingMenu}
                  style={{ backgroundColor: "#0c0a09", color: "#ffffff" }}
                  className="h-10 px-6 rounded-full bg-[#0c0a09] text-white font-medium text-[15px] hover:bg-[#252626] transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isCreatingMenu ? "Creating..." : "Create Menu"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* SLIDE-OVER DRAWER: EDIT MENU                         */}
        {/* ---------------------------------------------------- */}
        {isEditMenuOpen && (
          <div className="fixed inset-0 bg-[#0c0a09]/20 backdrop-blur-sm z-50 transition-opacity flex justify-end font-sans">
            <div className="h-full w-96 max-w-full bg-[#fdf8f7] shadow-2xl border-l border-[#e7e5e4] transform transition-transform duration-300 flex flex-col justify-between">
              <div>
                <div className="p-6 border-b border-[#e7e5e4] flex justify-between items-center bg-[#fdf8f7]">
                  <h2 className="font-garamond text-[24px] text-[#141010] font-normal leading-tight">Edit Menu</h2>
                  <button
                    type="button"
                    onClick={() => setIsEditMenuOpen(false)}
                    className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] hover:text-[#141010] transition-colors cursor-pointer"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>

                <form id="edit-menu-form" onSubmit={handleEditMenuSubmit} className="p-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#5e5e5e]">Menu Name *</label>
                    <input
                      type="text"
                      required
                      value={editMenuName}
                      onChange={(e) => setEditMenuName(e.target.value)}
                      className="w-full rounded-lg border border-[#e7e5e4] bg-white px-3 py-2 text-sm text-[#141010] focus:border-[#141010] focus:ring-0 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#5e5e5e]">Description</label>
                    <textarea
                      rows={3}
                      value={editMenuDescription}
                      onChange={(e) => setEditMenuDescription(e.target.value)}
                      className="w-full rounded-lg border border-[#e7e5e4] bg-white px-3 py-2 text-sm text-[#141010] focus:border-[#141010] focus:ring-0 outline-none"
                    />
                  </div>

                  <div className="pt-4 border-t border-[#e7e5e4] space-y-2">
                    {!activeMenu?.isDefault && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!activeMenu?._id) return;
                          await setDefaultMenuMutation({ id: activeMenu._id });
                          setIsEditMenuOpen(false);
                        }}
                        className="w-full py-2 px-3 text-xs font-medium text-[#141010] bg-[#f1edec] hover:bg-[#e7e5e4] rounded-lg transition cursor-pointer"
                      >
                        ⭐ Set as Default Menu
                      </button>
                    )}

                    {menus && menus.length > 1 && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!activeMenu?._id) return;
                          if (!confirm(`Delete menu "${activeMenu.name}"?`)) return;
                          await deleteMenuMutation({ id: activeMenu._id });
                          setSelectedMenuId(null);
                          setIsEditMenuOpen(false);
                        }}
                        className="w-full py-2 px-3 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                      >
                        Delete Menu
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-[#e7e5e4] bg-[#fdf8f7] flex justify-end gap-3 font-sans">
                <button
                  type="button"
                  onClick={() => setIsEditMenuOpen(false)}
                  className="h-10 px-5 rounded-full border border-[#e7e5e4] bg-transparent text-[#141010] font-medium text-[15px] hover:bg-[#f1edec] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="edit-menu-form"
                  disabled={isSavingMenu}
                  style={{ backgroundColor: "#0c0a09", color: "#ffffff" }}
                  className="h-10 px-6 rounded-full bg-[#0c0a09] text-white font-medium text-[15px] hover:bg-[#252626] transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSavingMenu ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* SLIDE-OVER DRAWER: ADD / EDIT CATEGORY               */}
        {/* ---------------------------------------------------- */}
        {isAddCategoryOpen && (
          <div className="fixed inset-0 bg-[#0c0a09]/20 backdrop-blur-sm z-50 transition-opacity flex justify-end font-sans">
            <div className="h-full w-96 max-w-full bg-[#fdf8f7] shadow-2xl border-l border-[#e7e5e4] transform transition-transform duration-300 flex flex-col justify-between">
              <div>
                <div className="p-6 border-b border-[#e7e5e4] flex justify-between items-center bg-[#fdf8f7]">
                  <h2 className="font-garamond text-[24px] text-[#141010] font-normal leading-tight">
                    {editingCategory ? "Edit Category" : "Add Category"}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddCategoryOpen(false);
                      setEditingCategory(null);
                    }}
                    className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] hover:text-[#141010] transition-colors cursor-pointer"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>

                <form id="category-form" onSubmit={handleSaveCategorySubmit} className="p-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#5e5e5e]">Category Name *</label>
                    <input
                      type="text"
                      required
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      placeholder="e.g. Starters, Desserts, Viral Food"
                      className="w-full rounded-lg border border-[#e7e5e4] bg-white px-3 py-2 text-sm text-[#141010] focus:border-[#141010] focus:ring-0 outline-none"
                    />
                  </div>

                  {editingCategory && (
                    <div className="pt-4 border-t border-[#e7e5e4]">
                      <button
                        type="button"
                        onClick={() => handleOpenDeleteCategory(editingCategory)}
                        className="w-full py-2 px-3 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                      >
                        Delete Category
                      </button>
                    </div>
                  )}
                </form>
              </div>

              <div className="p-6 border-t border-[#e7e5e4] bg-[#fdf8f7] flex justify-end gap-3 font-sans">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddCategoryOpen(false);
                    setEditingCategory(null);
                  }}
                  className="h-10 px-5 rounded-full border border-[#e7e5e4] bg-transparent text-[#141010] font-medium text-[15px] hover:bg-[#f1edec] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="category-form"
                  disabled={isSavingCategory}
                  style={{ backgroundColor: "#0c0a09", color: "#ffffff" }}
                  className="h-10 px-6 rounded-full bg-[#0c0a09] text-white font-medium text-[15px] hover:bg-[#252626] transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSavingCategory ? "Saving..." : editingCategory ? "Save Changes" : "Create Category"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* SLIDE-OVER DRAWER: ADD EXISTING ITEM TO CATEGORY     */}
        {/* ---------------------------------------------------- */}
        {isAddExistingItemOpen && (
          <div className="fixed inset-0 bg-[#0c0a09]/20 backdrop-blur-sm z-50 transition-opacity flex justify-end font-sans">
            <div className="h-full w-[450px] max-w-full bg-[#fdf8f7] shadow-2xl border-l border-[#e7e5e4] transform transition-transform duration-300 flex flex-col justify-between">
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-[#e7e5e4] flex justify-between items-center bg-[#fdf8f7] shrink-0">
                  <div>
                    <h2 className="font-garamond text-[24px] text-[#141010] font-normal leading-tight">Add Existing Item</h2>
                    <p className="text-xs text-[#5e5e5e] mt-0.5">
                      Attach an existing item from your catalog to <strong>{activeCategory?.name}</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddExistingItemOpen(false)}
                    className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] hover:text-[#141010] transition-colors cursor-pointer"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 border-b border-[#e7e5e4] bg-white shrink-0">
                  <input
                    type="text"
                    value={existingItemSearchQuery}
                    onChange={(e) => setExistingItemSearchQuery(e.target.value)}
                    placeholder="Search catalog by name or category..."
                    className="w-full rounded-lg border border-[#e7e5e4] bg-[#f7f3f2] px-3.5 py-2 text-sm text-[#141010] focus:bg-white focus:border-[#141010] outline-none"
                  />
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {existingItemError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                      {existingItemError}
                    </div>
                  )}

                  {!existingItemSearchQuery.trim() ? (
                    <div className="py-12 text-center text-xs text-[#5e5e5e]">
                      Type in the search box above to find items in your catalog.
                    </div>
                  ) : filteredExistingItems && filteredExistingItems.length > 0 ? (
                    filteredExistingItems.map((item) => {
                      const isSelected = selectedExistingItem?._id === item._id;
                      return (
                        <div
                          key={item._id}
                          onClick={() => setSelectedExistingItem(item)}
                          className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition select-none ${
                            isSelected
                              ? "border-[#141010] bg-[#f1edec] ring-1 ring-[#141010]"
                              : "border-[#e7e5e4] bg-white hover:bg-[#fafafa]"
                          }`}
                        >
                          <div>
                            <p className="font-semibold text-sm text-[#141010]">{item.name}</p>
                            <p className="text-xs text-[#5e5e5e] mt-0.5">
                              {item.categoryName ? `In category: ${item.categoryName}` : "Catalog item"}
                            </p>
                          </div>
                          <span className="font-medium text-sm text-[#141010]">
                            {currencySymbol}{(item.price / 100).toFixed(2)}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-12 text-center text-xs text-[#5e5e5e]">
                      No existing items found matching "{existingItemSearchQuery}".
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-[#e7e5e4] bg-[#fdf8f7] flex justify-end gap-3 font-sans shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddExistingItemOpen(false)}
                  className="h-10 px-5 rounded-full border border-[#e7e5e4] bg-transparent text-[#141010] font-medium text-[15px] hover:bg-[#f1edec] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddExistingItemSubmit}
                  disabled={!selectedExistingItem || isAddingExistingItem}
                  style={{ backgroundColor: "#0c0a09", color: "#ffffff" }}
                  className="h-10 px-6 rounded-full bg-[#0c0a09] text-white font-medium text-[15px] hover:bg-[#252626] transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isAddingExistingItem ? "Adding..." : "Add to Category"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* SLIDE-OVER DRAWER: ADD EXISTING CUSTOMIZATION        */}
        {/* ---------------------------------------------------- */}
        {isAddExistingCustomizationOpen && (
          <div className="fixed inset-0 bg-[#0c0a09]/20 backdrop-blur-sm z-50 transition-opacity flex justify-end font-sans">
            <div className="relative w-full max-w-md bg-[#fdf8f7] h-full shadow-2xl border-l border-[#e7e5e4] flex flex-col z-10 justify-between">
              
              <div>
                <div className="p-6 border-b border-[#e7e5e4] flex items-center justify-between bg-[#fdf8f7]">
                  <div>
                    <h3 className="font-garamond text-[24px] text-[#141010] font-normal leading-tight">
                      Add Existing Customization
                    </h3>
                    <p className="text-xs text-[#5e5e5e] mt-0.5">
                      Attach an existing customization from your catalog to <strong>{activeItem?.name}</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddExistingCustomizationOpen(false)}
                    className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] hover:text-[#141010] transition-colors cursor-pointer"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 border-b border-[#e7e5e4] bg-white shrink-0">
                  <input
                    type="text"
                    value={existingCustomizationSearchQuery}
                    onChange={(e) => setExistingCustomizationSearchQuery(e.target.value)}
                    placeholder="Search customization by name, type, or item..."
                    className="w-full rounded-lg border border-[#e7e5e4] bg-[#f7f3f2] px-3.5 py-2 text-sm text-[#141010] focus:bg-white focus:border-[#141010] outline-none"
                  />
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[calc(100vh-220px)]">
                  {existingCustomizationError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                      {existingCustomizationError}
                    </div>
                  )}

                  {!existingCustomizationSearchQuery.trim() ? (
                    <div className="py-12 text-center text-xs text-[#5e5e5e]">
                      Type in the search box above to find customizations from your catalog.
                    </div>
                  ) : filteredExistingCustomizations && filteredExistingCustomizations.length > 0 ? (
                    filteredExistingCustomizations.map((cust: any) => {
                      const isSelected = selectedExistingCustomization?._id === cust._id;
                      return (
                        <div
                          key={cust._id}
                          onClick={() => setSelectedExistingCustomization(cust)}
                          className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition select-none ${
                            isSelected
                              ? "border-[#141010] bg-[#f1edec] ring-1 ring-[#141010]"
                              : "border-[#e7e5e4] bg-white hover:bg-[#fafafa]"
                          }`}
                        >
                          <div>
                            <p className="font-semibold text-sm text-[#141010]">{cust.name}</p>
                            <p className="text-xs text-[#5e5e5e] mt-0.5">
                              {cust.itemName ? `${cust.itemName} (${cust.choiceCount} choices)` : `${cust.choiceCount} choices`}
                            </p>
                          </div>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#f1edec] text-[#5e5e5e] border border-[#e7e5e4]">
                            {cust.customizationType === "AddOns" ? "Add-Ons" : "Preparations"}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-12 text-center text-xs text-[#5e5e5e]">
                      No existing customizations found matching "{existingCustomizationSearchQuery}".
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-[#e7e5e4] bg-[#fdf8f7] flex justify-end gap-3 font-sans shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddExistingCustomizationOpen(false)}
                  className="h-10 px-5 rounded-full border border-[#e7e5e4] bg-transparent text-[#141010] font-medium text-[15px] hover:bg-[#f1edec] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddExistingCustomizationSubmit}
                  disabled={!selectedExistingCustomization || isCopyingCustomization}
                  style={{ backgroundColor: "#0c0a09", color: "#ffffff" }}
                  className="h-10 px-6 rounded-full bg-[#0c0a09] text-white font-medium text-[15px] hover:bg-[#252626] transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isCopyingCustomization ? "Adding..." : "Add to Item"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* SLIDE-OVER DRAWER: ADD / EDIT CUSTOMIZATION GROUP    */}
        {/* ---------------------------------------------------- */}
        {(isAddCustomizationOpen || isEditCustomizationOpen) && (
          <div className="fixed inset-0 bg-[#0c0a09]/20 backdrop-blur-sm z-50 transition-opacity flex justify-end font-sans">
            <div className="relative w-full max-w-md bg-[#fdf8f7] h-full shadow-2xl border-l border-[#e7e5e4] flex flex-col z-10 justify-between overflow-hidden">
              
              {/* Drawer Header */}
              <div className="p-6 border-b border-[#e7e5e4] flex items-center justify-between bg-[#fdf8f7] shrink-0">
                <div>
                  <h3 className="font-garamond text-[24px] text-[#141010] font-normal leading-tight">
                    {isEditCustomizationOpen ? "Edit Customization" : "Add Customization"}
                  </h3>
                  <p className="text-xs text-[#5e5e5e] mt-0.5">
                    Configure customization group for <strong>{activeItem?.name}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddCustomizationOpen(false);
                    setIsEditCustomizationOpen(false);
                    setEditingCustomization(null);
                  }}
                  className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] hover:text-[#141010] transition cursor-pointer"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Content Form (Scrollable) */}
              <form id="customization-form" onSubmit={handleSaveCustomizationSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Customization Type Tabs */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#5e5e5e] mb-2">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 p-1 bg-[#f1edec] rounded-lg border border-[#e7e5e4]">
                    <button
                      type="button"
                      onClick={() => setCustomizationType("AddOns")}
                      className={`py-2 text-xs font-semibold rounded-md transition cursor-pointer text-center ${
                        customizationType === "AddOns"
                          ? "bg-white text-[#141010] shadow-sm font-bold"
                          : "text-[#5e5e5e] hover:text-[#141010]"
                      }`}
                    >
                      Add-Ons
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomizationType("Preparations")}
                      className={`py-2 text-xs font-semibold rounded-md transition cursor-pointer text-center ${
                        customizationType === "Preparations"
                          ? "bg-white text-[#141010] shadow-sm font-bold"
                          : "text-[#5e5e5e] hover:text-[#141010]"
                      }`}
                    >
                      Preparations
                    </button>
                  </div>
                  <p className="text-[11px] text-[#5e5e5e] mt-1.5">
                    {customizationType === "AddOns"
                      ? "Add-ons can have prices (e.g. Extra Cheese, Truffle Dip)."
                      : "Preparation instructions are kitchen notes (e.g. Cooking Style, Mild/Spicy)."}
                  </p>
                </div>

                {/* Customization Name */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#5e5e5e]">
                    Customization Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customizationName}
                    onChange={(e) => setCustomizationName(e.target.value)}
                    placeholder="e.g. Cheese, Spice Level, Sauce, Size"
                    className="w-full rounded-lg border border-[#e7e5e4] bg-white px-3 py-2 text-sm text-[#141010] focus:border-[#141010] focus:ring-0 outline-none font-medium"
                  />
                </div>

                {/* Description / Note */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#5e5e5e]">
                    Description / Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={customizationDesc}
                    onChange={(e) => setCustomizationDesc(e.target.value)}
                    placeholder="e.g. Customer portion or spice level preference"
                    className="w-full rounded-lg border border-[#e7e5e4] bg-white px-3 py-2 text-sm text-[#141010] focus:border-[#141010] focus:ring-0 outline-none"
                  />
                </div>

                {/* Selection Rules Box */}
                <div className="border border-[#e7e5e4] rounded-xl p-4 bg-white space-y-4 shadow-none">
                  <span className="text-xs font-bold text-[#141010] uppercase tracking-wider block">
                    Selection Rules
                  </span>

                  {/* Required Selection Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-[#141010] block">Required Selection</span>
                      <span className="text-[11px] text-[#5e5e5e]">Customer must select at least 1 option</span>
                    </div>
                    <div
                      onClick={() => setCustomizationRequired(!customizationRequired)}
                      className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${
                        customizationRequired ? "bg-[#0c0a09]" : "bg-[#e6e1e1] border border-[#e7e5e4]"
                      }`}
                    >
                      <div
                        className={`absolute top-[2px] w-3 h-3 bg-white rounded-full transition-transform ${
                          customizationRequired ? "right-[2px]" : "left-[2px] bg-[#5e5e5e]"
                        }`}
                      />
                    </div>
                  </div>

                  {/* Maximum Selections */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#e7e5e4]">
                    <div>
                      <span className="text-xs font-medium text-[#141010] block">Maximum selections allowed</span>
                      <span className="text-[11px] text-[#5e5e5e]">Limit how many customization items can be chosen</span>
                    </div>
                    <div className="flex items-center border border-[#e7e5e4] rounded-lg bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setCustomizationMaxSelected(Math.max(1, customizationMaxSelected - 1))}
                        className="px-2.5 py-1 text-[#5e5e5e] hover:bg-[#f1edec] border-r border-[#e7e5e4] cursor-pointer"
                      >
                        -
                      </button>
                      <span className="px-3 text-xs font-bold text-[#141010]">{customizationMaxSelected}</span>
                      <button
                        type="button"
                        onClick={() => setCustomizationMaxSelected(customizationMaxSelected + 1)}
                        className="px-2.5 py-1 text-[#5e5e5e] hover:bg-[#f1edec] border-l border-[#e7e5e4] cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              {/* Drawer Footer */}
              <div className="p-6 border-t border-[#e7e5e4] flex items-center justify-between bg-[#fdf8f7] shrink-0 font-sans">
                {isEditCustomizationOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditCustomizationOpen(false);
                      setDeletingCustomizationId(editingCustomization?._id);
                      setIsDeleteCustomizationOpen(true);
                    }}
                    className="text-xs text-red-600 hover:text-red-700 font-semibold cursor-pointer"
                  >
                    Delete this customization
                  </button>
                ) : <div />}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddCustomizationOpen(false);
                      setIsEditCustomizationOpen(false);
                      setEditingCustomization(null);
                    }}
                    className="h-10 px-5 rounded-full border border-[#e7e5e4] bg-transparent text-[#141010] font-medium text-[14px] hover:bg-[#f1edec] transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="customization-form"
                    disabled={isSavingCustomization}
                    style={{ backgroundColor: "#0c0a09", color: "#ffffff" }}
                    className="h-10 px-6 rounded-full bg-[#0c0a09] text-white font-medium text-[14px] hover:bg-[#252626] transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isSavingCustomization ? "Saving..." : isEditCustomizationOpen ? "Save changes" : "Create customization"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* SLIDE-OVER DRAWER: ADD / EDIT CHOICE (OPTION)        */}
        {/* ---------------------------------------------------- */}
        {(isAddChoiceOpen || isEditChoiceOpen) && (
          <div className="fixed inset-0 z-50 overflow-hidden font-sans">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-neutral-900/40 backdrop-blur-[1px] transition-opacity"
              onClick={() => {
                setIsAddChoiceOpen(false);
                setIsEditChoiceOpen(false);
                setEditingChoice(null);
              }}
            />

            {/* Right Drawer */}
            <aside
              className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col border-l border-neutral-200 transition-transform duration-300 ease-out"
              data-purpose="add-choice-drawer"
            >
              {/* Drawer Header */}
              <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
                <h2 className="text-base font-bold text-neutral-900 tracking-tight">
                  {isEditChoiceOpen
                    ? `Edit customization item in "${activeCustomization?.name || "Customization"}"`
                    : `Add customization item to "${activeCustomization?.name || "Customization"}"`}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddChoiceOpen(false);
                    setIsEditChoiceOpen(false);
                    setEditingChoice(null);
                  }}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-md hover:bg-neutral-100 transition-colors cursor-pointer"
                  title="Close drawer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </button>
              </div>

              {/* Drawer Form Scrollable Body */}
              <form
                id="choice-form"
                onSubmit={handleSaveChoiceSubmit}
                className="flex-1 overflow-y-auto px-6 py-5 space-y-6"
              >
                {/* Field: Customization Item Name */}
                <div className="space-y-1.5" data-purpose="field-choice-name">
                  <label className="block text-xs font-semibold text-neutral-700" htmlFor="choice-name">
                    Customization item name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="choice-name"
                    type="text"
                    required
                    value={choiceName}
                    onChange={(e) => setChoiceName(e.target.value)}
                    placeholder="e.g. Extra Cheese"
                    className="block w-full rounded-md border border-neutral-300 text-xs px-3 py-2 text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 focus:ring-neutral-900 shadow-xs outline-none"
                  />
                </div>

                {/* Field: Additional Price */}
                <div className="space-y-1.5" data-purpose="field-price">
                  <label className="block text-xs font-semibold text-neutral-700" htmlFor="choice-price">
                    Additional price ({currencySymbol}) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative rounded-md shadow-xs">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-neutral-500 text-xs font-medium">{currencySymbol}</span>
                    </div>
                    <input
                      id="choice-price"
                      type="number"
                      step="0.01"
                      required
                      value={choicePrice}
                      onChange={(e) => setChoicePrice(e.target.value)}
                      placeholder="0.00"
                      className="block w-full rounded-md border border-neutral-300 pl-7 text-xs py-2 text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 focus:ring-neutral-900 outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-neutral-500 leading-tight">
                    Additional amount added to the item's base price. (Add 0 for free item)
                  </p>
                </div>

                {/* Advanced Details Collapsible (Accordion) */}
                <div className="border-t border-neutral-200 pt-3" data-purpose="advanced-details-accordion">
                  <button
                    type="button"
                    onClick={() => setIsChoiceAdvancedOpen(!isChoiceAdvancedOpen)}
                    className="w-full flex items-center justify-between py-1 text-xs font-semibold text-neutral-900 select-none cursor-pointer"
                  >
                    <span className="flex items-center">
                      <svg
                        className={`w-3.5 h-3.5 mr-1 text-neutral-500 transform transition-transform duration-200 ${
                          isChoiceAdvancedOpen ? "rotate-90" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                      Advanced details
                    </span>
                    <span className="text-[10px] text-neutral-400 font-normal uppercase tracking-wider">
                      {isChoiceAdvancedOpen ? "Configured" : "Optional"}
                    </span>
                  </button>

                  {/* Advanced Inner Inputs */}
                  {isChoiceAdvancedOpen && (
                    <div className="mt-4 space-y-4 pl-4 border-l-2 border-neutral-100">
                      {/* Description */}
                      <div className="space-y-1">
                        <label className="block text-[11px] font-medium text-neutral-700" htmlFor="adv-desc">
                          Description (Optional)
                        </label>
                        <textarea
                          id="adv-desc"
                          rows={2}
                          value={choiceDescription}
                          onChange={(e) => setChoiceDescription(e.target.value)}
                          placeholder="Short description for receipt or menu summary..."
                          className="block w-full rounded-md border border-neutral-300 text-xs text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 focus:ring-neutral-900 p-2.5 outline-none shadow-xs"
                        />
                      </div>

                      {/* Tax Checkbox & Calculation Engine */}
                      <div className="space-y-3 pt-1">
                        <div className="flex items-start">
                          <div className="flex h-5 items-center">
                            <input
                              id="is-taxable"
                              type="checkbox"
                              checked={choiceIsGst}
                              onChange={(e) => setChoiceIsGst(e.target.checked)}
                              className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 cursor-pointer"
                            />
                          </div>
                          <div className="ml-2.5 text-xs">
                            <label className="font-medium text-neutral-700 cursor-pointer" htmlFor="is-taxable">
                              Tax applicable
                            </label>
                            <p className="text-[11px] text-neutral-400">Include in regular item tax calculations</p>
                          </div>
                        </div>

                        {choiceIsGst && (
                          <div className="space-y-3 pl-6 pt-1">
                            <div className="space-y-1">
                              <label className="block text-[11px] font-medium text-neutral-600">Tax Group / Rate</label>
                              <div className="relative">
                                <select
                                  value={choiceSelectedTaxGroupId}
                                  onChange={(e) => setChoiceSelectedTaxGroupId(e.target.value)}
                                  className="w-full bg-white border border-neutral-300 rounded-md px-3 py-1.5 appearance-none focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 text-neutral-900 text-xs font-medium shadow-xs"
                                >
                                  {taxGroups && taxGroups.length > 0 ? (
                                    taxGroups.map((tg) => (
                                      <option key={tg._id} value={tg._id}>
                                        {tg.name} {tg.isDefault ? "⭐ (Default)" : ""}
                                      </option>
                                    ))
                                  ) : (
                                    <option value="">Default Store Tax</option>
                                  )}
                                </select>
                                <ChevronDownIcon className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[11px] font-medium text-neutral-600">Tax Calculation Mode</label>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setChoiceTaxMode("inclusive")}
                                  className={`py-1.5 px-2 text-xs font-medium rounded-md border text-center transition-all cursor-pointer ${
                                    choiceTaxMode === "inclusive"
                                      ? "bg-neutral-900 text-white border-neutral-900 shadow-xs font-semibold"
                                      : "bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50"
                                  }`}
                                >
                                  Tax Inclusive
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setChoiceTaxMode("exclusive")}
                                  className={`py-1.5 px-2 text-xs font-medium rounded-md border text-center transition-all cursor-pointer ${
                                    choiceTaxMode === "exclusive"
                                      ? "bg-neutral-900 text-white border-neutral-900 shadow-xs font-semibold"
                                      : "bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50"
                                  }`}
                                >
                                  Tax Exclusive
                                </button>
                              </div>
                            </div>

                            {choiceTaxBreakdown && (
                              <div className="p-2.5 rounded-md bg-neutral-50 border border-neutral-200 space-y-1 text-[11px]">
                                <div className="flex items-center justify-between font-semibold text-neutral-900 border-b border-neutral-200 pb-1">
                                  <span>Tax Breakdown ({choiceTaxBreakdown.totalRate}%):</span>
                                  <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    {choiceTaxBreakdown.mode === "inclusive" ? "Inclusive" : "Exclusive"}
                                  </span>
                                </div>
                                <div className="flex justify-between text-neutral-500">
                                  <span>Base:</span>
                                  <span className="font-medium text-neutral-900">
                                    {currencySymbol}{choiceTaxBreakdown.basePrice}
                                  </span>
                                </div>
                                {choiceTaxBreakdown.components.map((c, idx) => (
                                  <div key={idx} className="flex justify-between text-neutral-500">
                                    <span>• {c.name} ({c.rate}%):</span>
                                    <span className="font-medium text-neutral-900">+{currencySymbol}{c.amount}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between text-neutral-900 font-bold pt-1 border-t border-neutral-200">
                                  <span>Total Customer Pays:</span>
                                  <span>{currencySymbol}{choiceTaxBreakdown.finalPrice}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Show Quantity */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-neutral-700">Show quantity</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={choiceShowQuantity}
                            onClick={() => setChoiceShowQuantity(!choiceShowQuantity)}
                            className={`${
                              choiceShowQuantity ? "bg-neutral-900" : "bg-neutral-200"
                            } relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
                          >
                            <span
                              aria-hidden="true"
                              className={`${
                                choiceShowQuantity ? "translate-x-3" : "translate-x-0"
                              } pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                            />
                          </button>
                        </div>
                        {choiceShowQuantity && (
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              step="0.01"
                              value={choiceQuantity}
                              onChange={(e) => setChoiceQuantity(e.target.value)}
                              placeholder="Quantity (e.g. 50)"
                              className="block w-full rounded-md border border-neutral-300 text-xs py-1.5 px-3 text-neutral-900 focus:border-neutral-900 focus:ring-neutral-900 shadow-xs outline-none"
                            />
                            <select
                              value={choiceQuantityUnit}
                              onChange={(e) => setChoiceQuantityUnit(e.target.value)}
                              className="block w-full rounded-md border border-neutral-300 text-xs py-1.5 px-3 text-neutral-900 focus:border-neutral-900 focus:ring-neutral-900 shadow-xs outline-none"
                            >
                              <option value="g">gm (Grams)</option>
                              <option value="ml">ml (Millilitres)</option>
                              <option value="pcs">pcs (Pieces)</option>
                              <option value="portion">portion</option>
                              <option value="oz">oz (Ounces)</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Show Calories */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-neutral-700">Show calorie value</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={choiceShowCalorie}
                            onClick={() => setChoiceShowCalorie(!choiceShowCalorie)}
                            className={`${
                              choiceShowCalorie ? "bg-neutral-900" : "bg-neutral-200"
                            } relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
                          >
                            <span
                              aria-hidden="true"
                              className={`${
                                choiceShowCalorie ? "translate-x-3" : "translate-x-0"
                              } pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                            />
                          </button>
                        </div>
                        {choiceShowCalorie && (
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              value={choiceCalorie}
                              onChange={(e) => setChoiceCalorie(e.target.value)}
                              placeholder="Calories (e.g. 150)"
                              className="block w-full rounded-md border border-neutral-300 text-xs py-1.5 px-3 text-neutral-900 focus:border-neutral-900 focus:ring-neutral-900 shadow-xs outline-none"
                            />
                            <select
                              value={choiceCalorieMetric}
                              onChange={(e) => setChoiceCalorieMetric(e.target.value)}
                              className="block w-full rounded-md border border-neutral-300 text-xs py-1.5 px-3 text-neutral-900 focus:border-neutral-900 focus:ring-neutral-900 shadow-xs outline-none"
                            >
                              <option value="kcal">kcal</option>
                              <option value="cal">cal</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Dietary Type */}
                      <div className="space-y-1.5">
                        <span className="block text-[11px] font-medium text-neutral-700">Dietary classification</span>
                        <div className="flex flex-wrap gap-1.5">
                          {availableItemTypes.map((type) => {
                            const isSelected =
                              choiceDietaryType === type.id ||
                              choiceDietaryType.toLowerCase() === type.name.toLowerCase() ||
                              (choiceDietaryType === "veg" && type.name.toLowerCase() === "vegetarian");
                            return (
                              <button
                                key={type.id}
                                type="button"
                                onClick={() => setChoiceDietaryType(type.id)}
                                className={`inline-flex items-center px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                                  isSelected
                                    ? "font-semibold bg-neutral-900 text-white shadow-xs"
                                    : "font-medium bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50"
                                }`}
                              >
                                <span className="mr-1.5">{type.icon}</span>
                                {type.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </form>

              {/* Drawer Sticky Footer Actions */}
              <div
                className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end space-x-3 shrink-0"
                data-purpose="drawer-footer"
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsAddChoiceOpen(false);
                    setIsEditChoiceOpen(false);
                    setEditingChoice(null);
                  }}
                  className="px-4 py-2 border border-neutral-300 text-xs font-semibold rounded-md text-neutral-700 bg-white hover:bg-neutral-100 transition-colors shadow-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="choice-form"
                  disabled={isSavingChoice}
                  className="px-4 py-2 border border-transparent text-xs font-semibold rounded-md shadow-xs text-white bg-neutral-900 hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSavingChoice ? "Saving..." : isEditChoiceOpen ? "Save customization item" : "Save customization item"}
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODAL: CHANGE UNAVAILABILITY (PREST DESIGN)          */}
        {/* ---------------------------------------------------- */}
        {isUnavailabilityModalOpen && targetUnavailabilityItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-sans">
            <div
              className="fixed inset-0"
              onClick={() => {
                if (!isSavingUnavailability) {
                  setIsUnavailabilityModalOpen(false);
                  setTargetUnavailabilityItem(null);
                }
              }}
            />
            <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col z-10">
              {/* Header */}
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-gray-900 tracking-tight">
                    {unavailabilityTargetType === "choice" ? "Change unavailability" : "Change unavailability"}
                  </h3>
                  <div className="relative group inline-flex items-center">
                    <button
                      type="button"
                      className="text-gray-400 hover:text-gray-700 transition p-0.5 rounded cursor-pointer"
                    >
                      <InfoIcon className="w-4 h-4 text-gray-400 group-hover:text-gray-700 transition-colors" />
                    </button>
                    {/* Downward Tooltip with arrow */}
                    <div className="absolute left-0 top-full mt-2 hidden group-hover:flex flex-col w-64 p-3 bg-neutral-900 text-white rounded-lg shadow-xl z-50 pointer-events-none transition-all">
                      <div className="absolute -top-1 left-2 w-2 h-2 bg-neutral-900 rotate-45" />
                      <span className="font-bold text-xs text-white">
                        {unavailabilityTargetType === "choice" ? "Customization Item Unavailability" : "Item Unavailability"}
                      </span>
                      <span className="text-[11px] text-gray-300 leading-relaxed mt-1">
                        {unavailabilityTargetType === "choice"
                          ? "Temporarily hide this customization item from your online store and customer ordering for a specific duration or shift."
                          : "Temporarily hide this item from your online store and customer ordering for a specific duration or shift."}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isSavingUnavailability) {
                      setIsUnavailabilityModalOpen(false);
                      setTargetUnavailabilityItem(null);
                    }
                  }}
                  className="text-gray-400 hover:text-gray-700 p-1 rounded-md hover:bg-gray-100 transition cursor-pointer"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Body Content */}
              <div className="p-6 space-y-6 bg-white">
                {/* Item Price Box */}
                <div className="border border-gray-200 rounded-lg px-4 py-3.5 flex items-center justify-between bg-white shadow-xs">
                  <span className="text-sm font-bold text-gray-900 truncate pr-2">
                    {targetUnavailabilityItem.name}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 shrink-0">
                    {unavailabilityTargetType === "choice"
                      ? targetUnavailabilityItem.price > 0
                        ? `+${currencySymbol}${(targetUnavailabilityItem.price / 100).toFixed(2)}`
                        : `${currencySymbol}0.00 (Free)`
                      : `${currencySymbol}${(targetUnavailabilityItem.price / 100).toFixed(0)}`}
                  </span>
                </div>

                {/* Switch Row */}
                <div
                  onClick={() => setUnavailabilityToggle(!unavailabilityToggle)}
                  className="flex items-center justify-between pt-1 cursor-pointer select-none"
                >
                  <span className="text-sm font-bold text-gray-900">
                    {unavailabilityTargetType === "choice"
                      ? "Make this customization item unavailable"
                      : "Make this item unavailable"}
                  </span>
                  <div
                    className={`w-10 h-5 rounded-full relative transition-colors ${
                      unavailabilityToggle ? "bg-neutral-800" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-transform ${
                        unavailabilityToggle ? "right-[2px]" : "left-[2px]"
                      }`}
                    />
                  </div>
                </div>

                {/* Unavailability Duration */}
                {unavailabilityToggle && (
                  <div className="space-y-2 pt-1">
                    <label className="block text-xs font-semibold text-gray-500">
                      Unavailability duration
                    </label>
                    <div className="grid grid-cols-4 border border-gray-200 rounded-lg overflow-hidden bg-white text-xs divide-x divide-gray-200">
                      {[
                        { id: "12", label: "12 Hours" },
                        { id: "24", label: "24 Hours" },
                        { id: "48", label: "48 Hours" },
                        { id: "custom", label: "Custom" },
                      ].map((dur) => (
                        <button
                          key={dur.id}
                          type="button"
                          onClick={() => setUnavailabilityDuration(dur.id as any)}
                          className={`py-2.5 px-2 text-center transition cursor-pointer ${
                            unavailabilityDuration === dur.id
                              ? "bg-gray-100 text-gray-900 font-bold shadow-xs"
                              : "text-gray-600 hover:bg-gray-50 font-medium"
                          }`}
                        >
                          {dur.label}
                        </button>
                      ))}
                    </div>

                    {unavailabilityDuration === "custom" && (
                      <div className="pt-2">
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                          Custom Duration (Hours)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={customDurationHours}
                          onChange={(e) => setCustomDurationHours(e.target.value)}
                          placeholder="e.g. 72"
                          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:border-black outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUnavailabilityModalOpen(false);
                      setTargetUnavailabilityItem(null);
                    }}
                    className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-lg text-xs transition text-center cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveUnavailabilityConfirm}
                    disabled={isSavingUnavailability}
                    className="w-full py-2.5 px-4 bg-neutral-700 hover:bg-neutral-800 text-white font-semibold rounded-lg text-xs shadow-sm transition text-center cursor-pointer disabled:opacity-50"
                  >
                    {isSavingUnavailability ? "Saving..." : "Confirm"}
                  </button>
                </div>

                {/* Footnote text */}
                <p className="text-[11px] leading-relaxed text-gray-500 pt-1">
                  {unavailabilityTargetType === "choice"
                    ? "Note: This particular customization item will become unavailable to your online store till the duration you have selected above. To make this customization item available again before the fixed duration, just turn off the switch and hit confirm, so the customization item will be available again."
                    : "Note: This particular item will become unavailable to your online store till the duration you have selected above. To make this item available again before the fixed duration, just turn off the switch and hit confirm, so the item will be available again."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODAL: DUPLICATE ITEM / CHOICE (PREST DESIGN)        */}
        {/* ---------------------------------------------------- */}
        {isDuplicateItemModalOpen && targetDuplicateItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-sans">
            <div
              className="fixed inset-0"
              onClick={() => {
                if (!isDuplicatingItem) {
                  setIsDuplicateItemModalOpen(false);
                  setTargetDuplicateItem(null);
                }
              }}
            />
            <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col z-10">
              {/* Header */}
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">
                  {duplicateTargetType === "choice" ? "Duplicate Customization Item" : "Duplicate Item"}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    if (!isDuplicatingItem) {
                      setIsDuplicateItemModalOpen(false);
                      setTargetDuplicateItem(null);
                    }
                  }}
                  className="text-gray-400 hover:text-gray-700 p-1 rounded-md hover:bg-gray-100 transition cursor-pointer"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Body Content */}
              <div className="p-6 space-y-5 bg-white">
                {/* Source item info */}
                <div className="border border-gray-200 rounded-lg px-4 py-3.5 flex items-center justify-between bg-white shadow-xs">
                  <div>
                    <span className="text-xs text-gray-500 block">
                      {duplicateTargetType === "choice" ? "Source Customization Item" : "Source Item"}
                    </span>
                    <span className="text-sm font-bold text-gray-900 truncate">
                      {targetDuplicateItem.name}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 shrink-0">
                    {duplicateTargetType === "choice"
                      ? targetDuplicateItem.price > 0
                        ? `+${currencySymbol}${(targetDuplicateItem.price / 100).toFixed(2)}`
                        : `${currencySymbol}0.00 (Free)`
                      : `${currencySymbol}${(targetDuplicateItem.price / 100).toFixed(0)}`}
                  </span>
                </div>

                {/* New Item Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-700">
                    {duplicateTargetType === "choice" ? "New customization item name" : "New item name"}
                  </label>
                  <input
                    type="text"
                    value={duplicateItemNewName}
                    onChange={(e) => setDuplicateItemNewName(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-black outline-none font-medium"
                    placeholder={duplicateTargetType === "choice" ? "e.g. Spice(1)" : "e.g. Vadapav(1)"}
                  />
                  <p className="text-[11px] text-gray-500">
                    {duplicateTargetType === "choice"
                      ? "A clone will be created in this customization group with the same price and settings."
                      : "A clone will be created with all customization groups and items from the source item."}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDuplicateItemModalOpen(false);
                      setTargetDuplicateItem(null);
                    }}
                    className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-lg text-xs transition text-center cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDuplicateItem}
                    disabled={isDuplicatingItem || !duplicateItemNewName.trim()}
                    className="w-full py-2.5 px-4 bg-neutral-800 hover:bg-black text-white font-semibold rounded-lg text-xs shadow-sm transition text-center cursor-pointer disabled:opacity-50"
                  >
                    {isDuplicatingItem ? "Duplicating..." : "Duplicate"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODAL: DELETE ITEM (PREST DESIGN)                    */}
        {/* ---------------------------------------------------- */}
        {isDeleteItemModalOpen && targetDeleteItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-sans">
            <div
              className="fixed inset-0"
              onClick={() => {
                if (!isDeletingItem) {
                  setIsDeleteItemModalOpen(false);
                  setTargetDeleteItem(null);
                }
              }}
            />
            <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl p-6 z-10 space-y-4 border border-gray-200">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                <AlertTriangleIcon className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900">Delete item?</h4>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  Are you sure you want to delete <strong className="text-gray-900">{targetDeleteItem.name}</strong>? This action will remove this item and its customization settings. This action cannot be undone.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteItemModalOpen(false);
                    setTargetDeleteItem(null);
                  }}
                  className="px-3.5 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 rounded-md text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteItem}
                  disabled={isDeletingItem}
                  className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {isDeletingItem ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODAL: DELETE CATEGORY                               */}
        {/* ---------------------------------------------------- */}
        {isDeleteCategoryModalOpen && targetDeleteCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-sans">
            <div
              className="fixed inset-0"
              onClick={() => {
                if (!isDeletingCategory) {
                  setIsDeleteCategoryModalOpen(false);
                  setTargetDeleteCategory(null);
                }
              }}
            />
            <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl p-6 z-10 space-y-4 border border-gray-200">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                <AlertTriangleIcon className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900">Delete category?</h4>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  Are you sure you want to delete <strong className="text-gray-900">{targetDeleteCategory.name}</strong>? This action will remove this category and unassign its items from this category. This action cannot be undone.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteCategoryModalOpen(false);
                    setTargetDeleteCategory(null);
                  }}
                  className="px-3.5 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 rounded-md text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteCategory}
                  disabled={isDeletingCategory}
                  className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {isDeletingCategory ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PosShell>
  );
}
