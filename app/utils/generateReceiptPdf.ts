import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface OrderReceiptData {
  order: any;
  org: any;
}

// Helper to reliably parse currency amounts whether given in paise, formatted string, or float
function parseAmount(val: any, fallbackPaise?: number): number {
  if (typeof val === "string") {
    const parsed = parseFloat(val.replace(/[^0-9.-]/g, ""));
    if (!isNaN(parsed)) return parsed;
  }
  if (typeof val === "number") {
    // If it's a fractional number (e.g. 24.72), it's already in main currency unit
    if (val % 1 !== 0) return val;
    // In Convex DB, integers in subTotal / totalAmount / itemPrice are stored in paise
    return val / 100;
  }
  if (typeof fallbackPaise === "number") {
    return fallbackPaise / 100;
  }
  return 0;
}

export function openReceiptPdfInNewTab({ order, org }: OrderReceiptData) {
  if (!order) return;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  let currentY = 22;

  // 1. Currency Symbol Resolution (PDF-safe currency formatting)
  const rawSymbol = org?.currencySymbol || "₹";
  const currencySymbol =
    !rawSymbol || rawSymbol === "₹" || rawSymbol === "INR" || rawSymbol.charCodeAt(0) > 127
      ? "Rs."
      : rawSymbol;

  // 2. Header Title: "Receipt"
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(20, 16, 16);
  doc.text("Receipt", margin, currentY);

  // Top Right: Store Logo / Badge
  const badgeSize = 12;
  const badgeX = pageWidth - margin - badgeSize;
  const badgeY = currentY - 7;
  doc.setFillColor(12, 10, 9);
  doc.roundedRect(badgeX, badgeY, badgeSize, badgeSize, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  const initialLetter = (org?.name ? org.name.charAt(0) : "P").toUpperCase();
  doc.text(initialLetter, badgeX + 3.8, badgeY + 8.5);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  const storeNameText = (org?.name || "PREST STORE").toUpperCase();
  doc.text(storeNameText, pageWidth - margin, badgeY + badgeSize + 4.5, { align: "right" });

  currentY += 8;

  // 3. Metadata (Receipt Number & Date & Token)
  const orderCreatedDate = order?.createdAt ? new Date(order.createdAt) : new Date();
  const day = String(orderCreatedDate.getDate()).padStart(2, "0");
  const month = String(orderCreatedDate.getMonth() + 1).padStart(2, "0");
  const year = orderCreatedDate.getFullYear();
  const formattedDate = `${day}/${month}/${year}`;
  const formattedTime = orderCreatedDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text("Receipt Number: ", margin, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(order.orderNumber || "#ORD-0000", margin + 28, currentY);

  if (order.tokenNumber) {
    doc.setFont("helvetica", "bold");
    doc.text("Token: ", margin + 85, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(order.tokenNumber, margin + 98, currentY);
  }

  currentY += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Date & Time: ", margin, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(`${formattedDate}, ${formattedTime}`, margin + 22, currentY);

  currentY += 8;

  // Divider Line
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 7;

  // 4. Two-Column Store & Customer Details
  const colWidth = (pageWidth - margin * 2) / 2;

  // Left Column (Store Details)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 16, 16);
  doc.text(org?.name || "Store", margin, currentY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);

  let storeY = currentY + 4.5;
  const storeAddressParts = [
    org?.addressLine1,
    org?.addressLine2,
    org?.landmark,
    org?.city,
    org?.state,
    org?.zipCode,
  ].filter(Boolean);

  if (storeAddressParts.length > 0) {
    const addressStr = storeAddressParts.join(", ");
    const splitAddress = doc.splitTextToSize(addressStr, colWidth - 5);
    doc.text(splitAddress, margin, storeY);
    storeY += splitAddress.length * 4;
  }

  if (org?.phone || org?.mobile) {
    doc.text(`Phone: ${org.phone || org.mobile}`, margin, storeY);
    storeY += 4;
  }

  if (org?.legalEntityName && org.legalEntityName !== org.name) {
    doc.text(`Legal: ${org.legalEntityName}`, margin, storeY);
    storeY += 4;
  }

  if (org?.gstNumber) {
    doc.text(`GSTIN: ${org.gstNumber}`, margin, storeY);
    storeY += 4;
  }

  if (org?.fssaiRegistrationNumber) {
    doc.text(`FSSAI: ${org.fssaiRegistrationNumber}`, margin, storeY);
    storeY += 4;
  }

  // Right Column (Customer & Order Info)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 16, 16);
  const custName =
    order.customerName ||
    (order.customerFirstName
      ? `${order.customerFirstName} ${order.customerLastName || ""}`.trim()
      : "Walk-in Customer");
  doc.text(custName, pageWidth - margin, currentY, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);

  let custY = currentY + 4.5;
  if (order.customerPhone) {
    doc.text(`Contact: ${order.customerPhone}`, pageWidth - margin, custY, { align: "right" });
    custY += 4;
  }

  if (order.customerEmail) {
    doc.text(`Email: ${order.customerEmail}`, pageWidth - margin, custY, { align: "right" });
    custY += 4;
  }

  const rawTableStr = order.table?.number || order.tableName || "";
  const tableDisplay = rawTableStr ? (/^table\b/i.test(rawTableStr.trim()) ? rawTableStr.trim() : `Table ${rawTableStr.trim()}`) : "";
  const tableLabel = tableDisplay ? ` • ${tableDisplay}` : "";
  const orderTypeStr = `Fulfillment: ${order.orderType || "DineIn"}${tableLabel}`;
  doc.text(orderTypeStr, pageWidth - margin, custY, { align: "right" });
  custY += 4;

  const paymentStr = `Payment: ${order.paymentMode || "Cash"} (${order.paymentStatus || "Paid"})`;
  doc.text(paymentStr, pageWidth - margin, custY, { align: "right" });
  custY += 4;

  currentY = Math.max(storeY, custY) + 6;

  // 5. Line Items Table
  const rawItems = order.items || [];
  let calculatedSubtotal = 0;

  const tableData = rawItems.map((it: any) => {
    let particularName = it.itemName || it.name || "Item";
    if (it.customizations && it.customizations.length > 0) {
      const customNotes = it.customizations
        .map((c: any) => c.optionName || c.name || "Option")
        .filter(Boolean)
        .join(", ");
      if (customNotes) particularName += `\n(${customNotes})`;
    }

    const qty = it.quantity || 1;
    let unitRate = 0;
    if (it.display_item_price) {
      unitRate = parseAmount(it.display_item_price);
    } else if (it.itemPrice !== undefined) {
      unitRate = parseAmount(it.itemPrice);
    } else if (it.price !== undefined) {
      unitRate = parseAmount(it.price);
    }

    let lineTotal = 0;
    if (it.display_total_price) {
      lineTotal = parseAmount(it.display_total_price);
    } else if (it.totalPrice !== undefined) {
      lineTotal = parseAmount(it.totalPrice);
    } else {
      lineTotal = unitRate * qty;
    }

    calculatedSubtotal += lineTotal;

    return [
      particularName,
      `${currencySymbol} ${unitRate.toFixed(2)}`,
      qty.toString(),
      `${currencySymbol} ${lineTotal.toFixed(2)}`,
    ];
  });

  // Calculate or Extract Financials
  let subTotalNum = 0;
  if (order.display_sub_total) {
    subTotalNum = parseAmount(order.display_sub_total);
  } else if (order.subTotal !== undefined) {
    subTotalNum = parseAmount(order.subTotal);
  } else {
    subTotalNum = calculatedSubtotal;
  }

  let taxTotalNum = 0;
  if (order.display_tax_total) {
    taxTotalNum = parseAmount(order.display_tax_total);
  } else if (order.taxTotal !== undefined) {
    taxTotalNum = parseAmount(order.taxTotal);
  }

  let discountNum = 0;
  if (order.display_discount_amount) {
    discountNum = parseAmount(order.display_discount_amount);
  } else if (order.discountAmount !== undefined) {
    discountNum = parseAmount(order.discountAmount);
  }

  let deliveryNum = 0;
  if (order.deliveryCharge !== undefined) {
    deliveryNum = parseAmount(order.deliveryCharge);
  }

  let grandTotalNum = 0;
  if (order.display_total_amount) {
    grandTotalNum = parseAmount(order.display_total_amount);
  } else if (order.totalAmount !== undefined) {
    grandTotalNum = parseAmount(order.totalAmount);
  } else {
    grandTotalNum = subTotalNum + taxTotalNum - discountNum + deliveryNum;
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [["PARTICULARS", "RATE", "QTY", "AMOUNT"]],
    body: tableData.length > 0 ? tableData : [["Order Item", `${currencySymbol} ${subTotalNum.toFixed(2)}`, "1", `${currencySymbol} ${subTotalNum.toFixed(2)}`]],
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: [40, 40, 40],
      cellPadding: 3.5,
    },
    headStyles: {
      fontStyle: "bold",
      textColor: [100, 100, 100],
      fontSize: 8,
      lineWidth: { bottom: 0.3 },
      lineColor: [229, 231, 235],
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 32 },
      2: { halign: "center", cellWidth: 20 },
      3: { halign: "right", cellWidth: 34, fontStyle: "bold" },
    },
  });

  // Get Y position after table
  const finalY = (doc as any).lastAutoTable?.finalY || currentY + 40;
  let summaryY = finalY + 8;

  // 6. Financial Summary Block (Right Aligned)
  const summaryBoxWidth = 85;
  const summaryBoxX = pageWidth - margin - summaryBoxWidth;

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 90, 90);

  // Sub Total
  doc.text("Sub Total:", summaryBoxX, summaryY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 16, 16);
  doc.text(`${currencySymbol} ${subTotalNum.toFixed(2)}`, pageWidth - margin, summaryY, { align: "right" });

  summaryY += 5;

  // Tax Breakdown (if components available or total tax > 0)
  const taxComponents = order?.taxInfoSnapshot?.components;
  if (Array.isArray(taxComponents) && taxComponents.length > 0) {
    for (const comp of taxComponents) {
      const compRate = comp.rate ? ` (${comp.rate}%)` : "";
      const compAmount = comp.amount !== undefined ? parseAmount(comp.amount) : (subTotalNum * (comp.rate || 0)) / 100;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(90, 90, 90);
      doc.text(`${comp.name || "GST"}${compRate}:`, summaryBoxX, summaryY);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20, 16, 16);
      doc.text(`${currencySymbol} ${compAmount.toFixed(2)}`, pageWidth - margin, summaryY, { align: "right" });
      summaryY += 5;
    }
  } else if (taxTotalNum > 0) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 90, 90);
    doc.text("GST (Tax Total):", summaryBoxX, summaryY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 16, 16);
    doc.text(`${currencySymbol} ${taxTotalNum.toFixed(2)}`, pageWidth - margin, summaryY, { align: "right" });
    summaryY += 5;
  }

  // Delivery Charge (if any)
  if (deliveryNum > 0) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 90, 90);
    doc.text("Delivery Fee:", summaryBoxX, summaryY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 16, 16);
    doc.text(`${currencySymbol} ${deliveryNum.toFixed(2)}`, pageWidth - margin, summaryY, { align: "right" });
    summaryY += 5;
  }

  // Discount if any
  if (discountNum > 0) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(5, 150, 105);
    doc.text("Discount:", summaryBoxX, summaryY);
    doc.setFont("helvetica", "bold");
    doc.text(`-${currencySymbol} ${discountNum.toFixed(2)}`, pageWidth - margin, summaryY, { align: "right" });
    summaryY += 5;
  }

  // Divider above Total
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.5);
  doc.line(summaryBoxX, summaryY, pageWidth - margin, summaryY);

  summaryY += 5.5;

  // Grand Total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(12, 10, 9);
  doc.text("Total Paid:", summaryBoxX, summaryY);
  doc.text(`${currencySymbol} ${grandTotalNum.toFixed(2)}`, pageWidth - margin, summaryY, { align: "right" });

  summaryY += 2;
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.5);
  doc.line(summaryBoxX, summaryY, pageWidth - margin, summaryY);

  // 7. Footer Note
  const footerY = Math.max(summaryY + 22, pageHeight - 20);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    "Thank you for dining with us! Please retain this receipt for your records.",
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  // 8. Output PDF Blob & Open in Native Browser PDF Viewer Tab
  const pdfBlob = doc.output("blob");
  const blobUrl = URL.createObjectURL(pdfBlob);
  window.open(blobUrl, "_blank");
}

