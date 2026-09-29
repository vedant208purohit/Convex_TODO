import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PurchaseOrderPdfData {
  po: any;
  org: any;
}

export function downloadPurchaseOrderPdf({ po, org }: PurchaseOrderPdfData) {
  if (!po) return;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  let currentY = 20;

  // Currency Symbol
  const rawSymbol = org?.defaultCurrencySymbol || org?.currencySymbol || "$";
  const currencySymbol =
    !rawSymbol || rawSymbol === "₹" || rawSymbol === "INR" || rawSymbol.charCodeAt(0) > 127
      ? "Rs."
      : rawSymbol;

  // 1. Header Title: "PURCHASE ORDER"
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(20, 20, 20);
  doc.text("PURCHASE ORDER", margin, currentY);

  // Top Right Store Badge
  const badgeSize = 12;
  const badgeX = pageWidth - margin - badgeSize;
  const badgeY = currentY - 7;
  doc.setFillColor(20, 20, 19);
  doc.roundedRect(badgeX, badgeY, badgeSize, badgeSize, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  const initialLetter = (org?.name ? org.name.charAt(0) : "P").toUpperCase();
  doc.text(initialLetter, badgeX + 3.8, badgeY + 8.5);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  const storeNameText = (org?.name || "PREST STORE").toUpperCase();
  doc.text(storeNameText, pageWidth - margin, badgeY + badgeSize + 4.5, { align: "right" });

  currentY += 10;

  // 2. PO Metadata Box
  doc.setLineWidth(0.3);
  doc.setDrawColor(220, 218, 210);
  doc.setFillColor(250, 249, 247);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 22, 2, 2, "FD");

  const createdDate = po.createdAt ? new Date(po.createdAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }) : "N/A";

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);

  // Col 1: PO Number
  doc.text("PO NUMBER", margin + 6, currentY + 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(po.poNumber || "PO-0000", margin + 6, currentY + 15);

  // Col 2: Date
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  doc.text("DATE", margin + 60, currentY + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(createdDate, margin + 60, currentY + 15);

  // Col 3: Priority
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  doc.text("PRIORITY", margin + 110, currentY + 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const priorityText = (po.purchasePriority || "low").toUpperCase();
  doc.setTextColor(
    priorityText === "HIGH" ? 225 : priorityText === "MEDIUM" ? 180 : 100,
    priorityText === "HIGH" ? 29 : priorityText === "MEDIUM" ? 115 : 100,
    priorityText === "HIGH" ? 72 : priorityText === "MEDIUM" ? 20 : 100
  );
  doc.text(priorityText, margin + 110, currentY + 15);

  // Col 4: Status
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  doc.text("STATUS", margin + 155, currentY + 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text((po.status || "DRAFTED").toUpperCase(), margin + 155, currentY + 15);

  currentY += 28;

  // 3. Supplier Details Box
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text("VENDOR / SUPPLIER DETAILS", margin, currentY);

  currentY += 4;
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.setDrawColor(225, 222, 215);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 26, 2, 2, "FD");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text(po.supplierName || "Supplier Name N/A", margin + 6, currentY + 8);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 90, 90);
  if (po.companyName) {
    doc.text(`Company: ${po.companyName}`, margin + 6, currentY + 14);
  }
  if (po.supplierEmail || po.email) {
    doc.text(`Email: ${po.supplierEmail || po.email}`, margin + 6, currentY + 20);
  }
  if (po.supplierPhone || po.phoneNumber) {
    doc.text(`Phone: ${po.supplierPhone || po.phoneNumber}`, margin + 100, currentY + 14);
  }

  currentY += 32;

  // 4. Line Items Table (jspdf-autotable)
  const items = po.items || [];
  const tableData = items.map((item: any, idx: number) => [
    idx + 1,
    item.inventoryItemName || item.itemName || `Item #${idx + 1}`,
    `${item.orderedQuantity || 0} ${item.unit || "unit"}`,
    `${currencySymbol} ${(item.unitCost || 0).toFixed(2)}`,
    `${currencySymbol} ${((item.orderedQuantity || 0) * (item.unitCost || 0)).toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [["#", "Item Description", "Quantity & Unit", "Unit Cost", "Total Cost"]],
    body: tableData.length > 0 ? tableData : [["-", "No line items found", "-", "-", "-"]],
    theme: "grid",
    headStyles: {
      fillColor: [244, 243, 239],
      textColor: [80, 80, 80],
      fontSize: 8.5,
      fontStyle: "bold",
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 35, halign: "center" },
      3: { cellWidth: 35, halign: "right" },
      4: { cellWidth: 35, halign: "right" },
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3.5,
      textColor: [30, 30, 30],
      lineColor: [230, 228, 220],
      lineWidth: 0.2,
    },
    margin: { left: margin, right: margin },
  });

  const finalY = (doc as any).lastAutoTable.finalY || currentY + 40;

  // 5. Total & Notes Summary Section
  let summaryY = finalY + 8;

  if (po.notes) {
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("NOTES / INSTRUCTIONS:", margin, summaryY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    doc.text(po.notes, margin, summaryY + 5);
  }

  // Right Aligned Total Box
  const totalBoxWidth = 70;
  const totalBoxX = pageWidth - margin - totalBoxWidth;
  doc.setFillColor(248, 247, 243);
  doc.setDrawColor(220, 218, 210);
  doc.roundedRect(totalBoxX, summaryY, totalBoxWidth, 16, 2, 2, "FD");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text("TOTAL AMOUNT:", totalBoxX + 6, summaryY + 10);
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(
    `${currencySymbol} ${(po.totalAmount || 0).toFixed(2)}`,
    totalBoxX + totalBoxWidth - 6,
    summaryY + 10,
    { align: "right" }
  );

  // 6. Authorized Signature Footer
  const footerY = Math.max(summaryY + 30, 260);
  doc.setLineWidth(0.3);
  doc.setDrawColor(200, 198, 190);
  doc.line(pageWidth - margin - 50, footerY, pageWidth - margin, footerY);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Authorized Signature", pageWidth - margin - 25, footerY + 4, { align: "center" });

  // Save & Download PDF File
  const filename = `${po.poNumber || "PO"}_Voucher.pdf`;
  doc.save(filename);
}
