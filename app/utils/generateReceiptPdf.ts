import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface OrderReceiptData {
  order: any;
  org: any;
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

  // 1. Header Title: "Receipt"
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
  doc.text("P", badgeX + 4, badgeY + 8.5);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  const storeNameText = (org?.name || "PREST POS").toUpperCase();
  doc.text(storeNameText, pageWidth - margin, badgeY + badgeSize + 4, { align: "right" });

  currentY += 8;

  // 2. Metadata (Receipt Number & Date)
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

  currentY += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Date: ", margin, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(`${formattedDate} ${formattedTime} IST`, margin + 12, currentY);

  currentY += 10;

  // Divider Line
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 7;

  // 3. Two-Column Store & Customer Details
  const colWidth = (pageWidth - margin * 2) / 2;
  const rightColX = margin + colWidth;

  // Left Column (Store Details)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 16, 16);
  doc.text(org?.name || "Store Location", margin, currentY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text(org?.addressLine1 || "Main Street, Ground Floor, Commercial Arcade", margin, currentY + 4.5);

  doc.text(`Legal Entity: ${org?.legalEntityName || org?.name || "Prest Retail Corp"}`, margin, currentY + 9);
  doc.text(`GSTIN: ${org?.gstNumber || "UNREGISTERED"}`, margin, currentY + 13);
  doc.text(`FSSAI: ${org?.fssaiRegistrationNumber || "UNREGISTERED"}`, margin, currentY + 17);

  // Right Column (Customer & Order Info)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 16, 16);
  doc.text(order.customerName || "Walk-in Patron", pageWidth - margin, currentY, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text(order.customerPhone || "+91 98765 43210", pageWidth - margin, currentY + 4.5, { align: "right" });

  const orderTypeStr = `Order Type: ${order.orderType || "DineIn"}${order.table ? ` • Table ${order.table.number}` : ""}`;
  doc.text(orderTypeStr, pageWidth - margin, currentY + 9, { align: "right" });

  doc.text(`Payment Mode: ${order.paymentMode || "Cash"}`, pageWidth - margin, currentY + 13, { align: "right" });

  currentY += 23;

  // 4. Line Items Table
  const items = order.items || [];
  const tableData = items.map((it: any) => {
    let particularName = it.itemName || "Item";
    if (it.customizations && it.customizations.length > 0) {
      const customNotes = it.customizations.map((c: any) => c.optionName || "Customized").join(", ");
      particularName += `\n(${customNotes})`;
    }

    const itemPrice = it.display_item_price || (it.itemPrice ? (it.itemPrice / 100).toFixed(2) : "0.00");
    const itemTotal = it.display_total_price || (it.totalPrice ? (it.totalPrice / 100).toFixed(2) : "0.00");
    const itemTax = ((parseFloat(itemTotal) * 0.05) || 0).toFixed(2);

    return [
      particularName,
      `Rs. ${itemPrice}`,
      it.quantity?.toString() || "1",
      `Rs. ${itemTax}`,
      `Rs. ${itemTotal}`,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [["PARTICULARS", "RATE", "QTY", "TAX (5%)", "TOTAL"]],
    body: tableData,
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
      1: { halign: "right", cellWidth: 26 },
      2: { halign: "center", cellWidth: 16 },
      3: { halign: "right", cellWidth: 26 },
      4: { halign: "right", cellWidth: 28, fontStyle: "bold" },
    },
  });

  // Get Y position after table
  const finalY = (doc as any).lastAutoTable?.finalY || currentY + 40;
  let summaryY = finalY + 8;

  // 5. Financial Summary Block (Right Aligned)
  const summaryBoxWidth = 85;
  const summaryBoxX = pageWidth - margin - summaryBoxWidth;

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 90, 90);

  // Sub Total
  doc.text("Sub Total:", summaryBoxX, summaryY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 16, 16);
  doc.text(`Rs. ${order.display_sub_total || "0.00"}`, pageWidth - margin, summaryY, { align: "right" });

  summaryY += 5;

  // GST (Tax Total)
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 90, 90);
  doc.text("GST (Tax Total):", summaryBoxX, summaryY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 16, 16);
  doc.text(`Rs. ${order.display_tax_total || "0.00"}`, pageWidth - margin, summaryY, { align: "right" });

  summaryY += 5;

  // Discount if any
  if (parseFloat(order.display_discount_amount || "0") > 0) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(5, 150, 105);
    doc.text("Discount:", summaryBoxX, summaryY);
    doc.setFont("helvetica", "bold");
    doc.text(`-Rs. ${order.display_discount_amount}`, pageWidth - margin, summaryY, { align: "right" });
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
  doc.text("Total:", summaryBoxX, summaryY);
  doc.text(`Rs. ${order.display_total_amount || "0.00"}`, pageWidth - margin, summaryY, { align: "right" });

  summaryY += 2;
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.5);
  doc.line(summaryBoxX, summaryY, pageWidth - margin, summaryY);

  // 6. Footer Note
  const footerY = Math.max(summaryY + 22, pageHeight - 20);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    "Thanks for your business. Please contact us if you have any questions.",
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  // 7. Output PDF Blob & Open in Native Browser PDF Viewer Tab
  const pdfBlob = doc.output("blob");
  const blobUrl = URL.createObjectURL(pdfBlob);
  window.open(blobUrl, "_blank");
}
