import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface PurchaseOrderPdfData {
  po: any;
  org: any;
  supplier?: any;
}

export function downloadPurchaseOrderPdf({ po, org, supplier }: PurchaseOrderPdfData) {
  if (!po) return;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let currentY = 22;

  // Currency Symbol
  const rawSymbol = org?.defaultCurrencySymbol || org?.currencySymbol || "$";
  const currencySymbol =
    !rawSymbol || rawSymbol === "₹" || rawSymbol === "INR" || rawSymbol.charCodeAt(0) > 127
      ? "Rs."
      : rawSymbol;

  // 1. Header Title: "PURCHASE ORDER" (Centered, Bold, Size 18)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text("PURCHASE ORDER", pageWidth / 2, currentY, { align: "center" });

  currentY += 14;

  // Helper function to print wrapped text and increment Y
  const printLine = (
    text: string,
    isBold: boolean = false,
    fontSize: number = 10,
    lineHeight: number = 4.8
  ) => {
    if (!text) return;
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(0, 0, 0);
    const splitLines = doc.splitTextToSize(text, contentWidth);
    for (const line of splitLines) {
      doc.text(line, margin, currentY);
      currentY += lineHeight;
    }
  };

  // Resolved Supplier Object
  const resolvedSupplier = supplier || po.supplier;
  const supplierName =
    resolvedSupplier?.supplierName ||
    po.supplierName ||
    resolvedSupplier?.companyName ||
    po.companyName ||
    "";
  const supplierAddressParts = [
    resolvedSupplier?.address || po.supplierAddress || po.address,
    resolvedSupplier?.city || po.supplierCity,
    resolvedSupplier?.state || po.supplierState,
    resolvedSupplier?.country || po.supplierCountry,
  ].filter(Boolean);
  const supplierAddress = supplierAddressParts.join(", ");
  const supplierGst =
    resolvedSupplier?.gstNumber ||
    po.supplierGstNumber ||
    po.supplierGst ||
    po.gstNumber;
  const supplierPhone =
    resolvedSupplier?.phoneNumber ||
    po.supplierPhoneNumber ||
    po.supplierPhone ||
    po.phoneNumber;
  const supplierEmail =
    resolvedSupplier?.email || po.supplierEmail || po.email;

  // 2. Supplier Section
  printLine("Supplier", true, 13, 5.5);
  if (supplierName) printLine(supplierName, false, 10, 4.8);
  if (supplierAddress) printLine(supplierAddress, false, 10, 4.8);
  if (supplierGst) printLine(`GST: ${supplierGst}`, false, 10, 4.8);
  if (supplierPhone) printLine(`Phone: ${supplierPhone}`, false, 10, 4.8);
  if (supplierEmail) printLine(`Email: ${supplierEmail}`, false, 10, 4.8);

  currentY += 3.5;

  // 3. Buyer Section
  const buyerName = org?.name || "";
  const buyerAddressParts = [
    org?.addressLine1,
    org?.addressLine2,
    org?.landmark,
    org?.city,
    org?.state,
    org?.country,
    org?.zipCode,
  ].filter(Boolean);
  const buyerAddress = buyerAddressParts.join(", ");
  const buyerGst = org?.gstNumber;
  const buyerPhone = org?.phone || org?.mobile;
  const buyerEmail = org?.email;

  printLine("Buyer", true, 13, 5.5);
  if (buyerName) printLine(buyerName, false, 10, 4.8);
  if (buyerAddress) printLine(buyerAddress, false, 10, 4.8);
  if (buyerGst) printLine(`GST: ${buyerGst}`, false, 10, 4.8);
  if (buyerPhone) printLine(`Phone: ${buyerPhone}`, false, 10, 4.8);
  if (buyerEmail) printLine(`Email: ${buyerEmail}`, false, 10, 4.8);

  currentY += 3.5;

  // 4. PO Details Section
  printLine("PO Details", true, 13, 5.5);
  if (po.poNumber) printLine(`PO Number: ${po.poNumber}`, false, 10, 4.8);

  const poDateFormatted = formatPoDate(po.createdAt);
  if (poDateFormatted) printLine(`PO Date: ${poDateFormatted}`, false, 10, 4.8);

  const priorityVal = po.purchasePriority || "low";
  printLine(`Priority: ${priorityVal}`, false, 10, 4.8);

  currentY += 6;

  // 5. Line Items Table (Matching Photo 1 style + price columns)
  const items = po.items || [];
  const tableData = items.map((item: any, idx: number) => {
    const qty = typeof item.orderedQuantity === "number" ? item.orderedQuantity : 0;
    const unitCost = typeof item.unitCost === "number" ? item.unitCost : 0;
    const totalCost = typeof item.totalCost === "number" ? item.totalCost : qty * unitCost;

    return [
      idx + 1,
      item.name || item.inventoryItemName || item.itemName || `Item #${idx + 1}`,
      item.sku || item.skuNumber || "",
      qty.toString(),
      item.buyingUnit || item.unit || "",
      `${currencySymbol} ${unitCost.toFixed(2)}`,
      `${currencySymbol} ${totalCost.toFixed(2)}`,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [["SR NO", "Item Name", "SKU", "Ordered Quantity", "Buying Unit", "Unit Price", "Total Amount"]],
    body: tableData.length > 0 ? tableData : [["-", "No line items found", "-", "-", "-", "-", "-"]],
    theme: "plain",
    headStyles: {
      font: "helvetica",
      fontStyle: "bold",
      fontSize: 9.5,
      textColor: [0, 0, 0],
      halign: "left",
      lineWidth: { top: 0.5, bottom: 0.5, left: 0, right: 0 },
      lineColor: [0, 0, 0],
      cellPadding: { top: 3.5, bottom: 3.5, left: 2, right: 2 },
    },
    bodyStyles: {
      font: "helvetica",
      fontStyle: "normal",
      fontSize: 9,
      textColor: [0, 0, 0],
      lineWidth: { top: 0, bottom: 0.25, left: 0, right: 0 },
      lineColor: [30, 30, 30],
      cellPadding: { top: 3.5, bottom: 3.5, left: 2, right: 2 },
    },
    columnStyles: {
      0: { cellWidth: 16, halign: "left" },
      1: { cellWidth: "auto", halign: "left" },
      2: { cellWidth: 24, halign: "left" },
      3: { cellWidth: 30, halign: "left" },
      4: { cellWidth: 24, halign: "left" },
      5: { cellWidth: 26, halign: "right" },
      6: { cellWidth: 30, halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || currentY + 30;
  let summaryY = finalY + 6;

  // Total Amount below table
  const totalAmountNum = typeof po.totalAmount === "number" ? po.totalAmount : 0;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(
    `Total Amount: ${currencySymbol} ${totalAmountNum.toFixed(2)}`,
    pageWidth - margin,
    summaryY,
    { align: "right" }
  );

  // Notes if any
  if (po.notes) {
    summaryY += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("Notes:", margin, summaryY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(po.notes, margin, summaryY + 4.5);
  }

  // Save & Download PDF File
  const filename = `${po.poNumber || "PO"}_Voucher.pdf`;
  doc.save(filename);
}

function formatPoDate(val: number | string | Date | undefined): string {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}
