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
}

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
  defaultCurrency?: string;
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
  const currency = org?.defaultCurrency?.toUpperCase();
  const sym = org?.currencySymbol || org?.defaultCurrency;

  if (!sym || sym === "₹" || currency === "INR" || sym.toLowerCase() === "rs" || sym.toLowerCase() === "rs.") {
    // POS thermal printers (ESC/POS) use single-byte ASCII/CP437 code pages.
    // The Unicode Rupee symbol '₹' (U+20B9) renders as '?' on physical printers.
    // 'Rs.' is the universally compatible POS standard across all thermal hardware in India.
    return "Rs.";
  }

  // International currencies (e.g. AED, $, SAR, QAR, EUR, GBP)
  if (currency === "AED" || sym === "AED") return "AED";
  if (currency === "USD" || sym === "$") return "$";
  if (currency === "SAR" || sym === "SAR") return "SAR";
  if (currency === "QAR" || sym === "QAR") return "QAR";
  if (currency === "KWD" || sym === "KWD") return "KWD";
  if (currency === "OMR" || sym === "OMR") return "OMR";
  if (currency === "BHD" || sym === "BHD") return "BHD";

  return sym;
}

export function generateDefxReceiptPlainString(
  order: ReceiptOrder | null | undefined,
  org: ReceiptOrganization | null | undefined,
  width = DEFAULT_LINE_WIDTH,
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
  // 1. STORE HEADER & TAX INVOICE
  // ==========================================
  const storeName = org?.name?.trim() || "PREST RESTAURANT";
  const wrappedStoreName = wrapText(storeName, width);
  for (const line of wrappedStoreName) {
    lines.push(center(line, width));
  }

  lines.push(center("TAX INVOICE", width));

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

  const taxTotal =
    order.display_tax_total ||
    (order.taxTotal !== undefined
      ? (order.taxTotal / 100).toFixed(2)
      : "0.00");
  lines.push(twoColRow("GST (Tax)", `${curr} ${taxTotal}`, width));

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
