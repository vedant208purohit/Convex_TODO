/**
 * Thermal POS Receipt Plain-Text Formatter
 * Generates an exact monospace receipt string compatible with
 * 80mm (48-column) & 58mm (32-column) thermal printers with currency support.
 */

export interface ReceiptOrder {
  orderNumber?: string;
  tokenNumber?: string | number;
  orderType?: string;
  orderStatusName?: string;
  paymentMode?: string;
  paymentStatus?: string;
  createdAt?: number | string | Date;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  table?: {
    number?: string | number;
    name?: string;
    sectionName?: string;
  } | null;
  serverName?: string;
  waiterName?: string;
  items?: Array<{
    itemName?: string;
    quantity?: number;
    display_item_price?: string;
    display_total_price?: string;
    itemPrice?: number;
    totalPrice?: number;
    customizations?: Array<{
      optionName?: string;
      groupName?: string;
      price?: number;
    }>;
  }>;
  display_sub_total?: string;
  display_discount_amount?: string;
  display_tax_total?: string;
  display_total_amount?: string;
  subTotal?: number;
  discountAmount?: number;
  taxTotal?: number;
  totalAmount?: number;
  taxInfoSnapshot?: {
    tax_mode?: string;
    tax_name?: string;
    tax_amount?: string;
    components?: Array<{
      name?: string;
      code?: string;
      rate?: number;
      amount?: string | number;
    }>;
  };
}

import { getCurrencyForCountry } from "../../lib/constants/countries";

export interface ReceiptOrganization {
  name?: string;
  legalEntityName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  fssaiRegistrationNumber?: string;
  currencySymbol?: string;
  country?: string;
  defaultCurrency?: string;
  defaultCurrencySymbol?: string;
}

const DEFAULT_LINE_WIDTH = 48; // Standard 80mm (3-inch) thermal printer grid

function padLeft(text: string, len: number): string {
  const s = String(text ?? "");
  if (s.length >= len) return s.slice(0, len);
  return " ".repeat(len - s.length) + s;
}

function padRight(text: string, len: number): string {
  const s = String(text ?? "");
  if (s.length >= len) return s.slice(0, len);
  return s + " ".repeat(len - s.length);
}

function center(text: string, width = DEFAULT_LINE_WIDTH): string {
  const s = String(text ?? "").trim();
  if (!s) return "";
  if (s.length >= width) return s;
  const leftPad = Math.floor((width - s.length) / 2);
  const rightPad = width - s.length - leftPad;
  return " ".repeat(leftPad) + s + " ".repeat(rightPad);
}

function divider(char = "-", width = DEFAULT_LINE_WIDTH): string {
  return char.repeat(width);
}

function wrapText(text: string, maxLen = DEFAULT_LINE_WIDTH): string[] {
  const str = String(text ?? "").trim();
  if (!str) return [];
  const words = str.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (!currentLine) {
      if (word.length > maxLen) {
        // Break huge words
        lines.push(word.slice(0, maxLen));
        currentLine = word.slice(maxLen);
      } else {
        currentLine = word;
      }
    } else if (currentLine.length + 1 + word.length <= maxLen) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      if (word.length > maxLen) {
        lines.push(word.slice(0, maxLen));
        currentLine = word.slice(maxLen);
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

function twoColRow(
  left: string,
  right: string,
  width = DEFAULT_LINE_WIDTH,
): string {
  const l = String(left ?? "").trim();
  const r = String(right ?? "").trim();
  const available = width - l.length;
  if (available <= 0) {
    return l.slice(0, Math.max(0, width - r.length - 1)) + " " + r;
  }
  return l + " ".repeat(available - r.length) + r;
}

function getCurrencyPrefix(org?: ReceiptOrganization | null): string {
  const customSymbol = org?.currencySymbol || org?.defaultCurrencySymbol;
  if (
    customSymbol &&
    customSymbol !== "₹" &&
    customSymbol !== "Rs." &&
    customSymbol !== "INR"
  ) {
    return customSymbol;
  }

  const country = org?.country || "IN";
  const currencyInfo = getCurrencyForCountry(country);

  // POS thermal receipt hardware uses standard single-byte ASCII code pages.
  // The Unicode '₹' character renders as '?' or blank on physical thermal paper.
  // 'Rs.' is the universally compatible standard for India across all thermal POS printers.
  if (
    country.toUpperCase() === "IN" ||
    country.toLowerCase() === "india" ||
    currencyInfo.code === "INR" ||
    currencyInfo.symbol === "₹"
  ) {
    return "Rs.";
  }

  return currencyInfo.symbol || currencyInfo.code || "$";
}

export function generateDefxReceiptPlainString(
  order: ReceiptOrder | null | undefined,
  org: ReceiptOrganization | null | undefined,
  width = DEFAULT_LINE_WIDTH,
  invoiceTitle = "ORDER INVOICE",
): string {
  if (!order) return "";

  const lines: string[] = [];
  const curr = getCurrencyPrefix(org);

  // Calculate proportional column widths for item summary table
  const qtyWidth = width >= 48 ? 5 : width >= 40 ? 4 : 3;
  const priceWidth = width >= 48 ? 11 : width >= 40 ? 10 : 8;
  const totalWidth = width >= 48 ? 11 : width >= 40 ? 10 : 8;
  const nameWidth = width - qtyWidth - priceWidth - totalWidth;

  // ==========================================
  // 1. STORE HEADER & ORDER INVOICE
  // ==========================================
  const storeName = org?.name?.trim() || "PREST RESTAURANT";
  const wrappedStoreName = wrapText(storeName, width);
  for (const line of wrappedStoreName) {
    lines.push(center(line, width));
  }

  lines.push(center(invoiceTitle, width));

  // Address
  const fullAddress = [
    org?.addressLine1,
    org?.addressLine2,
    org?.city,
    org?.state,
    org?.pincode,
  ]
    .filter(Boolean)
    .join(", ");

  if (fullAddress) {
    const wrappedAddr = wrapText(fullAddress, width);
    for (const addrLine of wrappedAddr) {
      lines.push(center(addrLine, width));
    }
  }

  if (org?.phone) {
    lines.push(twoColRow("Contact no:", org.phone, width));
  }
  if (org?.email) {
    lines.push(twoColRow("Email:", org.email, width));
  }
  if (org?.gstNumber) {
    lines.push(twoColRow("GSTIN:", org.gstNumber, width));
  }
  if (org?.fssaiRegistrationNumber) {
    lines.push(twoColRow("FSSAI:", org.fssaiRegistrationNumber, width));
  }

  // ==========================================
  // 2. CUSTOMER DETAILS (if available)
  // ==========================================
  if (order.customerPhone || order.customerName) {
    lines.push(divider("-", width));
    lines.push(center("CUSTOMER DETAILS", width));
    if (order.customerPhone) {
      lines.push(twoColRow("Phone No:", order.customerPhone, width));
    }
    if (order.customerName) {
      lines.push(twoColRow("Name:", order.customerName, width));
    }
  }

  // ==========================================
  // 3. ORDER DETAILS
  // ==========================================
  lines.push(divider("-", width));
  lines.push(center("ORDER DETAILS", width));

  const tokenStr = order.tokenNumber
    ? `#${order.tokenNumber}`
    : order.orderNumber?.slice(-3) || "-";
  lines.push(`Token No: ${tokenStr}`);

  // Table & Order Type
  const tableVal = order.table?.number
    ? String(order.table.number)
    : order.table?.name || "";
  const orderTypeVal = order.orderType || "DineIn";

  if (tableVal) {
    lines.push(
      twoColRow(`Table No: ${tableVal}`, `Order Type: ${orderTypeVal}`, width),
    );
  } else {
    lines.push(`Order Type: ${orderTypeVal}`);
  }

  // Bill #
  const billNum = order.orderNumber || "ORD-0000";
  lines.push(`Bill #: ${billNum}`);

  // Date & Time
  const createdDate = order.createdAt ? new Date(order.createdAt) : new Date();
  const day = String(createdDate.getDate()).padStart(2, "0");
  const month = String(createdDate.getMonth() + 1).padStart(2, "0");
  const year = createdDate.getFullYear();
  const formattedDate = `${day}/${month}/${year}`;
  const formattedTime = createdDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  lines.push(
    twoColRow(`Date: ${formattedDate}`, `Time: ${formattedTime}`, width),
  );

  // ==========================================
  // 4. ORDER SUMMARY (ITEMS TABLE)
  // ==========================================
  lines.push(divider("-", width));
  lines.push(center("ORDER SUMMARY", width));
  lines.push(
    padRight("Items", nameWidth) +
      padLeft("Qty", qtyWidth) +
      padLeft("Net Price", priceWidth) +
      padLeft("Value", totalWidth),
  );
  lines.push(divider("-", width));

  const items = order.items || [];
  if (items.length === 0) {
    lines.push(center("No items", width));
  } else {
    for (const it of items) {
      const name = it.itemName || "Item";
      const qty = String(it.quantity ?? 1);
      const priceVal =
        it.display_item_price ||
        (it.itemPrice !== undefined ? (it.itemPrice / 100).toFixed(2) : "0.00");
      const totalVal =
        it.display_total_price ||
        (it.totalPrice !== undefined
          ? (it.totalPrice / 100).toFixed(2)
          : "0.00");

      const nameLines = wrapText(name, nameWidth);
      const firstLineName = nameLines[0] || name;

      // Print first line with Qty, Net Price, Value including currency
      lines.push(
        padRight(firstLineName, nameWidth) +
          padLeft(qty, qtyWidth) +
          padLeft(`${curr}${priceVal}`, priceWidth) +
          padLeft(`${curr}${totalVal}`, totalWidth),
      );

      // Print remaining lines of wrapped item name
      for (let i = 1; i < nameLines.length; i++) {
        lines.push(padRight(nameLines[i], nameWidth));
      }

      // Print customizations if any
      if (it.customizations && it.customizations.length > 0) {
        for (const cust of it.customizations) {
          const custText = `  + ${cust.optionName || "Custom"}`;
          const wrappedCust = wrapText(custText, width);
          for (const cLine of wrappedCust) {
            lines.push(cLine);
          }
        }
      }
    }
  }

  // ==========================================
  // 5. BILL DETAILS
  // ==========================================
  lines.push(divider("-", width));
  lines.push(center("BILL DETAILS", width));

  const subTotal =
    order.display_sub_total ||
    (order.subTotal !== undefined ? (order.subTotal / 100).toFixed(2) : "0.00");
  lines.push(twoColRow("Sub Total", `${curr} ${subTotal}`, width));

  const discountNum =
    parseFloat(order.display_discount_amount || "0") ||
    (order.discountAmount ? order.discountAmount / 100 : 0);
  if (discountNum > 0) {
    const discountStr = order.display_discount_amount || discountNum.toFixed(2);
    lines.push(twoColRow("Discount", `-${curr} ${discountStr}`, width));
  }

  // Tax breakdown from organization taxation settings
  const subTotalPaise =
    order.subTotal ??
    Math.round(parseFloat(order.display_sub_total || "0") * 100);
  const discountPaise =
    order.discountAmount ??
    Math.round(parseFloat(order.display_discount_amount || "0") * 100);
  const totalAmountPaise =
    order.totalAmount ??
    Math.round(parseFloat(order.display_total_amount || "0") * 100);
  const derivedExclusivePaise = Math.max(
    0,
    totalAmountPaise - subTotalPaise + discountPaise,
  );

  // If exclusive tax was charged on top, show each component or total exclusive tax.
  // If no exclusive tax was charged (inclusive tax or zero tax), DO NOT print an extra tax line,
  // matching the order receipt format (inclusive taxes are already in item prices & subtotal).
  const taxComponents = order.taxInfoSnapshot?.components;
  if (
    Array.isArray(taxComponents) &&
    taxComponents.length > 0 &&
    derivedExclusivePaise > 0
  ) {
    const totalRate = taxComponents.reduce(
      (acc: number, c: any) => acc + (Number(c.rate) || 0),
      0,
    );
    for (const comp of taxComponents) {
      const compShare =
        totalRate > 0
          ? (Number(comp.rate) || 0) / totalRate
          : 1 / taxComponents.length;
      const compTaxPaise = Math.round(derivedExclusivePaise * compShare);
      const compTaxStr = (compTaxPaise / 100).toFixed(2);
      const taxLabel = comp.name
        ? `${comp.name}${comp.rate !== undefined ? ` (${comp.rate}%)` : ""}`
        : "Tax";
      lines.push(twoColRow(taxLabel, `+${curr} ${compTaxStr}`, width));
    }
  } else if (derivedExclusivePaise > 0) {
    const taxTotalPaise = derivedExclusivePaise;
    const taxTotalStr = (taxTotalPaise / 100).toFixed(2);
    const taxName = order.taxInfoSnapshot?.tax_name || "Tax";
    lines.push(twoColRow(taxName, `+${curr} ${taxTotalStr}`, width));
  }

  lines.push(divider("-", width));
  const grandTotal =
    order.display_total_amount ||
    (order.totalAmount !== undefined
      ? (order.totalAmount / 100).toFixed(2)
      : "0.00");
  lines.push(twoColRow("Grand Total", `${curr} ${grandTotal}`, width));

  // If tax is inclusive, display an informative note without altering line amounts
  if (
    derivedExclusivePaise <= 0 &&
    ((order.taxTotal && order.taxTotal > 0) ||
      order.taxInfoSnapshot?.tax_mode === "inclusive")
  ) {
    lines.push(center("(Inclusive of all taxes)", width));
  }

  lines.push(divider("-", width));

  // ==========================================
  // 6. PAYMENT DETAILS & FOOTER
  // ==========================================
  lines.push(center("PAYMENT DETAILS", width));
  const pMode = (order.paymentMode || "CASH").toUpperCase();
  lines.push(
    twoColRow(`Payment Mode: ${pMode}`, `${curr} ${grandTotal}`, width),
  );
  lines.push("");
  lines.push("");
  lines.push(center("Thank you for ordering and stay safe!", width));

  // Trailing line feeds (paper feed) to push footer past the physical tear blade/cutter
  lines.push("");
  lines.push(" ");
  lines.push(" ");
  lines.push(" ");
  lines.push(" ");
  lines.push(" ");
  lines.push(" ");
  lines.push(" ");
  lines.push(" ");

  return lines.join("\n");
}

// ==========================================
// KITCHEN ORDER TICKET (KOT) FORMATTER
// ==========================================

export interface KotItemCustomization {
  optionName?: string;
  groupName?: string;
  price?: number;
}

export interface KotItem {
  itemName?: string;
  quantity?: number;
  itemPrice?: number;
  display_item_price?: string;
  categoryName?: string;
  courseName?: string;
  customizations?: KotItemCustomization[];
  notes?: string;
  specialInstructions?: string;
  allergies?: string[];
  subItems?: Array<{ name: string; quantity: number }>;
}

export interface KotOrder {
  orderNumber?: string;
  tokenNumber?: string | number;
  kotNumber?: string | number;
  isAddon?: boolean;
  addonIndex?: number;
  isVoid?: boolean;
  voidReason?: string;
  authorizedBy?: string;
  orderType?: string;
  table?: {
    number?: string | number;
    name?: string;
    sectionName?: string;
  } | null;
  serverName?: string;
  waiterName?: string;
  guestCount?: number;
  customerName?: string;
  customerPhone?: string;
  stationName?: string;
  createdAt?: number | string | Date;
  firedAt?: number | string | Date;
  specialNotes?: string;
  allergies?: string[];
  items?: KotItem[];
}

export function generateDefxKotPlainString(
  order: KotOrder | null | undefined,
  featureFlags?: Record<string, boolean> | ((key: string) => boolean),
  width = DEFAULT_LINE_WIDTH,
): string {
  if (!order) return "";

  const getFlag = (key: string, defaultVal: boolean): boolean => {
    if (!featureFlags) return defaultVal;
    if (typeof featureFlags === "function") {
      const val = featureFlags(key);
      return val !== undefined ? val : defaultVal;
    }
    return featureFlags[key] !== undefined ? featureFlags[key] : defaultVal;
  };

  const lines: string[] = [];

  const showWaiter = getFlag("kds_print_waiter_name", true);
  const showGuestCount = getFlag("kds_print_guest_count", false);
  const showCustomer = getFlag("kds_print_customer_info", false);
  const showOrderType = getFlag("kds_print_order_type", true);
  const showTimestamp = getFlag("kds_print_timestamp", true);
  const showModifiers = getFlag("kds_print_item_modifiers", true);
  const showNotes = getFlag("kds_print_special_notes", true);
  const showPrices = getFlag("kds_print_show_prices", false);
  const expandCombos = getFlag("kds_print_combo_breakdown", true);

  const isVoid = order.isVoid === true;
  const isAddon = order.isAddon === true;
  const borderChar = isVoid ? "*" : "=";

  // Header Title
  lines.push(divider(borderChar, width));
  if (isVoid) {
    lines.push(center("*** CANCELLED / VOID KOT ***", width));
  } else if (isAddon) {
    const addonNum = order.addonIndex ? `#${order.addonIndex}` : "#2";
    lines.push(center(`*** RUNNING KOT ${addonNum} (ADD-ON) ***`, width));
  } else {
    lines.push(center("KITCHEN ORDER TICKET (KOT)", width));
  }
  lines.push(divider(borderChar, width));

  // Station and KOT Number
  const station = order.stationName ? `STATION: ${order.stationName.toUpperCase()}` : "STATION: MAIN";
  const kotNumStr = order.kotNumber ? `KOT #: ${order.kotNumber}` : order.orderNumber ? `ORD: ${order.orderNumber}` : "";
  lines.push(twoColRow(station, kotNumStr, width));

  // Timestamp
  if (showTimestamp) {
    const firedDate = order.firedAt ? new Date(order.firedAt) : order.createdAt ? new Date(order.createdAt) : new Date();
    const day = String(firedDate.getDate()).padStart(2, "0");
    const month = String(firedDate.getMonth() + 1).padStart(2, "0");
    const year = firedDate.getFullYear();
    const dateStr = `DATE: ${day}/${month}/${year}`;
    const timeStr = `TIME: ${firedDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}`;
    lines.push(twoColRow(dateStr, timeStr, width));
  }

  // Order Type & Waiter
  const orderTypeTag = showOrderType ? `ORDER TYPE: [ ${(order.orderType || "DINE-IN").toUpperCase()} ]` : `ORDER TYPE: ${(order.orderType || "DINE-IN").toUpperCase()}`;
  const waiterName = order.waiterName || order.serverName || "";
  const waiterTag = showWaiter && waiterName ? `WAITER: ${waiterName}` : "";
  lines.push(twoColRow(orderTypeTag, waiterTag, width));

  // Table & Token (Always included if present)
  const tableNum = order.table?.number ? String(order.table.number) : order.table?.name || "";
  const tableStr = tableNum ? `TABLE: ${tableNum}` : "";
  const tokenVal = order.tokenNumber ? `#${order.tokenNumber}` : "";
  const tokenTag = tokenVal ? `TOKEN: ${tokenVal}` : "";
  lines.push(twoColRow(tableStr, tokenTag, width));

  if (showGuestCount && order.guestCount) {
    lines.push(`GUESTS: ${order.guestCount}`);
  }

  if (showCustomer && (order.customerName || order.customerPhone)) {
    const custDetails = [order.customerName, order.customerPhone].filter(Boolean).join(" - ");
    lines.push(`CUSTOMER: ${custDetails}`);
  }

  // Void specific reason
  if (isVoid) {
    lines.push(divider("-", width));
    if (order.voidReason) {
      lines.push(`REASON: ${order.voidReason}`);
    }
    if (order.authorizedBy) {
      lines.push(`AUTHORIZED BY: ${order.authorizedBy}`);
    }
  }

  // Items Section
  lines.push(divider("=", width));
  if (isVoid) {
    lines.push("CANCELLED ITEMS:");
  } else if (isAddon) {
    lines.push("NEWLY ADDED ITEMS TO PREPARE:");
  } else {
    lines.push(twoColRow("QTY   ITEM DESCRIPTION", showPrices ? "PRICE" : "", width));
  }
  lines.push(divider("-", width));

  const items = order.items || [];
  if (items.length === 0) {
    lines.push(center("No items to prepare", width));
  } else {
    for (const it of items) {
      const qtyStr = isVoid ? `[-${it.quantity ?? 1}]` : `[${it.quantity ?? 1}]`;
      const name = (it.itemName || "Item").toUpperCase();
      const leftPart = `${qtyStr.padEnd(5)} ${name}`;

      if (showPrices && it.itemPrice !== undefined) {
        const pStr = it.display_item_price || (it.itemPrice / 100).toFixed(2);
        lines.push(twoColRow(leftPart, pStr, width));
      } else {
        const wrapped = wrapText(leftPart, width);
        for (const wl of wrapped) {
          lines.push(wl);
        }
      }

      // Modifiers
      if (showModifiers && it.customizations && it.customizations.length > 0) {
        for (const cust of it.customizations) {
          lines.push(`      --> [MOD]: ${cust.optionName || "Custom"}`);
        }
      }

      // Combo components breakdown
      if (expandCombos && it.subItems && it.subItems.length > 0) {
        for (const sub of it.subItems) {
          lines.push(`      • ${sub.quantity}x ${sub.name}`);
        }
      }

      // Special notes
      if (showNotes && (it.notes || it.specialInstructions)) {
        const note = it.notes || it.specialInstructions;
        lines.push(`      --> [NOTE]: ${note}`);
      }
    }
  }

  // Special Notes & Allergies
  const allAllergies: string[] = [];
  if (order.allergies && order.allergies.length > 0) {
    allAllergies.push(...order.allergies);
  }
  for (const it of items) {
    if (it.allergies && it.allergies.length > 0) {
      allAllergies.push(...it.allergies);
    }
  }

  if (showNotes) {
    if (allAllergies.length > 0 || order.specialNotes?.toLowerCase().includes("allerg")) {
      const allergyText = allAllergies.length > 0 ? allAllergies.join(", ") : order.specialNotes || "DIETARY RESTRICTION";
      lines.push(divider("=", width));
      lines.push(center(`*** ALLERGY: ${allergyText.toUpperCase()} ***`, width));
      lines.push(divider("=", width));
    } else if (order.specialNotes) {
      lines.push(divider("=", width));
      lines.push(`NOTE: ${order.specialNotes}`);
      lines.push(divider("=", width));
    } else {
      lines.push(divider("=", width));
    }
  } else {
    lines.push(divider("=", width));
  }

  if (isVoid) {
    lines.push(center("*** ATTENTION: DO NOT PREPARE THIS DISH ***", width));
    lines.push(divider("*", width));
  } else if (isAddon) {
    lines.push(center("(Do NOT recook items from previous KOT)", width));
    lines.push(divider("=", width));
  }

  // Trailing paper feed lines
  lines.push("");
  lines.push(" ");
  lines.push(" ");
  lines.push(" ");
  lines.push(" ");

  return lines.join("\n");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Converts a plain receipt string into raw ESC/POS binary data with
 * hardware-level center justification (\x1B\x61\x01) for headers and sections.
 */
function convertPlainStringToEscPos(receiptStr: string): Uint8Array {
  const lines = receiptStr.split("\n");
  const ESC = "\x1B";
  const GS = "\x1D";
  let output = ESC + "@"; // Initialize printer
  output += "\n"; // Safe buffer clearance after init

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      output += "\n";
      continue;
    }

    // Determine if the line is a centered header/section
    const isCentered =
      (line.startsWith("    ") && line.endsWith("    ")) ||
      trimmed === "ORDER INVOICE" ||
      trimmed === "TAX INVOICE" ||
      trimmed === "CUSTOMER DETAILS" ||
      trimmed === "ORDER DETAILS" ||
      trimmed === "ORDER SUMMARY" ||
      trimmed === "BILL DETAILS" ||
      trimmed === "PAYMENT DETAILS" ||
      trimmed.startsWith("Thank you");

    if (isCentered) {
      output += ESC + "a\x01"; // ESC a 1: Center Justification
      output += trimmed + "\n";
      output += ESC + "a\x00"; // ESC a 0: Left Justification
    } else {
      output += line + "\n";
    }
  }

  output += "\n\n\n\n\n" + GS + "V\x00"; // Full paper cut
  const encoder = new TextEncoder();
  return encoder.encode(output);
}

export interface ThermalPrintOptions {
  printerType?: string; // "Bluetooth" | "Usb" | "Lan"
  printerUrl?: string;
  printerPort?: string;
  stationId?: string;
}

/**
 * Triggers thermal receipt printing safely.
 * 1. Attempts direct hardware print via /api/printers/print-direct (silent, instant, supports Bluetooth COM, Windows Spooler, LAN).
 * 2. Attempts direct WebUSB transfer if connected.
 * 3. Falls back to invisible iframe browser print dialog.
 */
export async function printThermalReceiptDocument(
  receiptStr: string,
  documentTitle = "Receipt",
  options?: ThermalPrintOptions,
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // 1. Direct hardware socket printing ONLY for raw LAN socket or Bluetooth COM8 serial
  // (PowerShell Out-Printer for USB is bypassed because it forces 10 CPI text mode with 16-col line wraps)
  const isDirectLanOrBt =
    options?.printerType === "Lan" ||
    (options?.printerType === "Bluetooth" && options?.printerPort === "BT");

  if (isDirectLanOrBt) {
    try {
      const res = await fetch("/api/printers/print-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptStr,
          printerType: options.printerType,
          printerUrl: options.printerUrl || "Printer001",
          printerPort: options.printerPort || "BT",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          return true;
        }
      }
    } catch (directErr) {
      console.warn("Direct hardware printing bypassed, falling back:", directErr);
    }
  }

  // 2. Direct WebUSB byte transfer if device is opened and connected
  if (typeof navigator !== "undefined" && "usb" in navigator && options?.printerType !== "Bluetooth") {
    try {
      const devices = await (navigator as any).usb.getDevices();
      if (devices && devices.length > 0) {
        const dev = devices[0];
        if (dev) {
          if (!dev.opened) {
            await dev.open();
            if (dev.configuration === null) {
              await dev.selectConfiguration(1);
            }
            await dev.claimInterface(0);
          }
          if (dev.opened) {
            const data = convertPlainStringToEscPos(receiptStr);
            await dev.transferOut(1, data);
            return true;
          }
        }
      }
    } catch (e) {
      console.warn(
        "Direct WebUSB print transfer bypassed, using browser print dialog:",
        e,
      );
    }
  }

  // 3. Stable Browser Print Dialog via hidden iframe (restores the exact morning 80mm Courier New formatting)
  try {
    const existingIframe = document.getElementById("pos-thermal-print-frame");
    if (existingIframe) {
      existingIframe.remove();
    }

    const iframe = document.createElement("iframe");
    iframe.id = "pos-thermal-print-frame";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    iframe.style.zIndex = "-1";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return false;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>${documentTitle}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            @media print {
              html, body {
                width: 72mm;
                max-width: 72mm;
                margin: 0;
                padding: 0;
              }
            }
            body {
              font-family: Consolas, "Lucida Console", "Liberation Mono", Monaco, "Courier New", monospace;
              font-size: 10px;
              font-weight: 500;
              line-height: 1.25;
              letter-spacing: -0.15px;
              padding: 2mm 1mm 12mm 1mm;
              margin: 0;
              width: 72mm;
              max-width: 72mm;
              color: #000;
              background: #fff;
              word-break: normal;
              -webkit-print-color-adjust: exact;
            }
            pre {
              font-family: inherit;
              font-size: inherit;
              font-weight: inherit;
              line-height: inherit;
              letter-spacing: inherit;
              margin: 0;
              padding: 0;
              white-space: pre;
              word-break: normal;
            }
          </style>
        </head>
        <body><pre>${escapeHtml(receiptStr)}</pre></body>
      </html>
    `);
    doc.close();

    const frameWindow = iframe.contentWindow;
    if (frameWindow) {
      frameWindow.focus();
      setTimeout(() => {
        try {
          frameWindow.print();
        } catch (printErr) {
          console.error("Iframe print error:", printErr);
        }
      }, 250);
      return true;
    }
  } catch (err) {
    console.error("Thermal print failed:", err);
  }

  return false;
}

// ==========================================
// 8. WORKSTATION FOOD RUNNER / ASSEMBLY SLIP FORMATTER
// ==========================================

export interface RunnerSlipOrder {
  orderNumber: string;
  tokenNumber?: string | number;
  orderType?: string;
  tableName?: string;
  table?: { number?: string | number; name?: string } | null;
  serverName?: string;
  waiterName?: string;
  guestCount?: number;
  customerName?: string;
  customerPhone?: string;
  specialNotes?: string;
  createdAt?: number | string | Date;
  statusKey?: string;
  statusBadgeText?: string;
  primaryStationName?: string;
  destinationTypeLabel?: string;
  destinationDetails?: string;
  items: Array<{
    itemName?: string;
    name?: string;
    quantity?: number;
    qty?: number;
    spec?: string;
    specialNotes?: string;
    customizations?: any[];
    isReady?: boolean;
  }>;
}

export function generateWorkstationRunnerSlipPlainString(
  order: RunnerSlipOrder | null | undefined,
  org?: ReceiptOrganization | null,
  width = 48,
): string {
  if (!order) return "";
  const lines: string[] = [];
  const printWidth = width || 48;
  const storeName = (org?.name?.trim() || "PREST RESTAURANT").toUpperCase();

  lines.push(divider("=", printWidth));
  const wrappedStore = wrapText(storeName, printWidth);
  for (const sl of wrappedStore) {
    lines.push(center(sl, printWidth));
  }
  lines.push(center("FOOD RUNNER / ASSEMBLY SLIP", printWidth));
  lines.push(divider("=", printWidth));

  // Clean Token (never "##09")
  const rawToken = String(order.tokenNumber || "").replace(/^#+/, "");
  const tokenFormatted = rawToken ? `#${rawToken}` : "#00";
  const tableVal =
    order.table?.number ? `Table ${order.table.number}` : order.tableName || order.destinationDetails || "";
  const orderType = (order.orderType || "DineIn").toUpperCase();

  if (tableVal) {
    lines.push(twoColRow(`TOKEN: ${tokenFormatted}`, `TABLE: ${tableVal}`, printWidth));
  } else {
    lines.push(`TOKEN: ${tokenFormatted}`);
  }

  const now = order.createdAt ? new Date(order.createdAt) : new Date();
  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  if (order.orderNumber) {
    lines.push(twoColRow(`ORD: ${order.orderNumber}`, `TIME: ${timeStr}`, printWidth));
  } else {
    lines.push(`TIME: ${timeStr}`);
  }

  const waiter = order.waiterName || order.serverName || "";
  if (waiter) {
    lines.push(twoColRow(`SERVER: ${waiter}`, `TYPE: ${orderType}`, printWidth));
  } else {
    lines.push(`TYPE: ${orderType}`);
  }

  if (order.customerName) {
    lines.push(`GUEST: ${order.customerName}`);
  }

  lines.push(divider("-", printWidth));
  lines.push(center("PLATE ASSEMBLY CHECKLIST", printWidth));
  lines.push(divider("-", printWidth));

  for (const it of order.items || []) {
    const qty = it.quantity ?? (it as any).qty ?? 1;
    const name = (it.itemName || it.name || "Item").trim();
    const statusMark = (it as any).isReady ? "[READY]" : "[ ]";
    const itemLine = `${statusMark} ${qty}x ${name}`;
    const wrapped = wrapText(itemLine, printWidth);
    for (const wl of wrapped) {
      lines.push(wl);
    }
    if (it.customizations && it.customizations.length > 0) {
      for (const c of it.customizations) {
        lines.push(`   + ${c.name || c.optionName || "Custom"}`);
      }
    }
    if ((it as any).spec || (it as any).notes) {
      lines.push(`   * Note: ${(it as any).spec || (it as any).notes}`);
    }
  }

  if (order.specialNotes) {
    lines.push(divider("-", printWidth));
    lines.push("CHEF NOTES:");
    const wrappedNotes = wrapText(order.specialNotes, printWidth);
    for (const nl of wrappedNotes) {
      lines.push(nl);
    }
  }

  lines.push(divider("=", printWidth));
  const verifyLines = wrapText("VERIFY ALL ITEMS BEFORE DISPATCH", printWidth);
  for (const vl of verifyLines) {
    lines.push(center(vl, printWidth));
  }
  lines.push("");
  lines.push(" ");
  lines.push(" ");
  lines.push(" ");

  return lines.join("\n");
}

