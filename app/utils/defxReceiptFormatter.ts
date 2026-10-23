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

function twoColRow(left: string, right: string, width = DEFAULT_LINE_WIDTH): string {
  const l = String(left ?? "").trim();
  const r = String(right ?? "").trim();
  const available = width - l.length;
  if (available <= 0) {
    return l.slice(0, Math.max(0, width - r.length - 1)) + " " + r;
  }
  return l + " ".repeat(available - r.length) + r;
}

function getCurrencyPrefix(org?: ReceiptOrganization | null): string {
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

  // For international countries, retrieve dynamic currency from countries.ts
  if (org?.defaultCurrencySymbol && org.defaultCurrencySymbol !== "₹") {
    return org.defaultCurrencySymbol;
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
    lines.push(twoColRow(`Order Type:`, orderTypeVal, width));
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

  lines.push(twoColRow(`Date: ${formattedDate}`, `Time: ${formattedTime}`, width));

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
        (it.itemPrice !== undefined
          ? (it.itemPrice / 100).toFixed(2)
          : "0.00");
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
    (order.subTotal !== undefined
      ? (order.subTotal / 100).toFixed(2)
      : "0.00");
  lines.push(twoColRow("Sub Total", `${curr} ${subTotal}`, width));

  const discountNum =
    parseFloat(order.display_discount_amount || "0") ||
    (order.discountAmount ? order.discountAmount / 100 : 0);
  if (discountNum > 0) {
    const discountStr =
      order.display_discount_amount || discountNum.toFixed(2);
    lines.push(twoColRow("Discount", `-${curr} ${discountStr}`, width));
  }

  // Tax breakdown from organization taxation settings
  const subTotalPaise =
    order.subTotal ?? Math.round(parseFloat(order.display_sub_total || "0") * 100);
  const discountPaise =
    order.discountAmount ?? Math.round(parseFloat(order.display_discount_amount || "0") * 100);
  const totalAmountPaise =
    order.totalAmount ?? Math.round(parseFloat(order.display_total_amount || "0") * 100);
  const derivedExclusivePaise = Math.max(0, totalAmountPaise - subTotalPaise + discountPaise);

  const taxComponents = order.taxInfoSnapshot?.components;
  if (Array.isArray(taxComponents) && taxComponents.length > 0 && derivedExclusivePaise > 0) {
    const totalRate = taxComponents.reduce((acc: number, c: any) => acc + (Number(c.rate) || 0), 0);
    for (const comp of taxComponents) {
      const compShare = totalRate > 0 ? (Number(comp.rate) || 0) / totalRate : 1 / taxComponents.length;
      const compTaxPaise = Math.round(derivedExclusivePaise * compShare);
      const compTaxStr = (compTaxPaise / 100).toFixed(2);
      const taxLabel = comp.name
        ? `${comp.name}${comp.rate !== undefined ? ` (${comp.rate}%)` : ""}`
        : "Tax";
      lines.push(twoColRow(taxLabel, `+${curr} ${compTaxStr}`, width));
    }
  } else if (derivedExclusivePaise > 0 || (order.taxTotal && order.taxTotal > 0)) {
    const taxTotalPaise = derivedExclusivePaise > 0 ? derivedExclusivePaise : (order.taxTotal || 0);
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
  lines.push(divider("-", width));

  // ==========================================
  // 6. PAYMENT DETAILS & FOOTER
  // ==========================================
  lines.push(center("PAYMENT DETAILS", width));
  const pMode = (order.paymentMode || "CASH").toUpperCase();
  lines.push(twoColRow(`Payment Mode: ${pMode}`, `${curr} ${grandTotal}`, width));
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

/**
 * Triggers thermal receipt printing safely using an invisible iframe.
 * Avoids popup blockers and locks centered lines directly above each other.
 */
export async function printThermalReceiptDocument(
  receiptStr: string,
  documentTitle = "Receipt"
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // 1. Direct WebUSB byte transfer if device is opened and connected
  if (typeof navigator !== "undefined" && "usb" in navigator) {
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
      console.warn("Direct WebUSB print transfer bypassed, using browser print dialog:", e);
    }
  }

  // 2. Stable Browser Print Dialog via hidden iframe (does NOT vanish or close prematurely)
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

    // Convert centered lines into explicit text-align: center divs so they are 100% aligned
    const rawLines = receiptStr.split("\n");
    const htmlBodyContent = rawLines
      .map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return "<div style='height: 1.1em;'>&nbsp;</div>";
        }

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
          const isStoreName = idx === 0;
          const extraStyle = isStoreName
            ? "font-size: 14px; font-weight: bold; margin-bottom: 2px;"
            : trimmed === "ORDER INVOICE"
            ? "font-size: 12px; font-weight: bold; margin-bottom: 2px;"
            : "font-weight: bold;";

          return `<div style="text-align: center; width: 100%; ${extraStyle}">${escapeHtml(trimmed)}</div>`;
        }

        return `<div style="white-space: pre;">${escapeHtml(line)}</div>`;
      })
      .join("");

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
                width: 80mm;
                margin: 0;
                padding: 0;
              }
            }
            body {
              font-family: "Courier New", Courier, monospace;
              font-size: 12px;
              line-height: 1.25;
              padding: 4mm 2mm 16mm 2mm;
              margin: 0 auto;
              max-width: 76mm;
              color: #000;
              background: #fff;
              word-break: normal;
            }
          </style>
        </head>
        <body>${htmlBodyContent}</body>
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

