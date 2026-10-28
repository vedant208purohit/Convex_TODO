import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Transaction } from "../components/marketplace/MarketplaceWalletView";

interface GenerateWalletLedgerPdfParams {
  transactions: Transaction[];
  balance: number;
  dateRange: {
    startDate: Date;
    endDate: Date;
    preset?: string;
  };
  escrowId?: string;
  storeName?: string;
}

export function generateWalletLedgerPdf({
  transactions,
  balance,
  dateRange,
  escrowId = "PRST-WLT-88219",
  storeName = "Mahendra Suthar",
}: GenerateWalletLedgerPdfParams) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let currentY = 20;

  // 1. Top Header: Brand & Document Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(12, 10, 9);
  doc.text("PREST MANAGEMENT SUITE", margin, currentY);

  // Escrow verification badge pill text (top right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(21, 128, 61); // emerald-700
  doc.text("VERIFIED ESCROW STATEMENT", pageWidth - margin, currentY, { align: "right" });

  currentY += 6;

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Marketplace Billing Wallet & Transaction Ledger", margin, currentY);

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("RBI Compliant • Escrow Escrow ID: " + escrowId, pageWidth - margin, currentY, { align: "right" });

  currentY += 6;

  // Horizontal Accent Divider
  doc.setDrawColor(231, 229, 228); // #e7e5e4
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 8;

  // 2. Account & Statement Period Details
  const startStr = dateRange.startDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const endStr = dateRange.endDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const generatedStr = new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text("Store / Account:", margin, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(storeName, margin + 28, currentY);

  doc.setFont("helvetica", "bold");
  doc.text("Statement Period:", margin + 95, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(`${startStr} to ${endStr}`, margin + 125, currentY);

  currentY += 5;

  doc.setFont("helvetica", "bold");
  doc.text("Generated On:", margin, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(generatedStr, margin + 28, currentY);

  doc.setFont("helvetica", "bold");
  doc.text("Total Records:", margin + 95, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(`${transactions.length} Transactions`, margin + 125, currentY);

  currentY += 9;

  // 3. Summary Cards Box
  const summaryBoxY = currentY;
  const summaryBoxHeight = 20;

  // Calculate totals from transactions
  let totalDeposited = 0;
  let totalDisbursed = 0;

  transactions.forEach((tx) => {
    if (tx.amount > 0) {
      totalDeposited += tx.amount;
    } else {
      totalDisbursed += Math.abs(tx.amount);
    }
  });

  // Background box
  doc.setFillColor(250, 248, 245); // #faf8f5
  doc.setDrawColor(231, 229, 228); // #e7e5e4
  doc.roundedRect(margin, summaryBoxY, contentWidth, summaryBoxHeight, 2, 2, "FD");

  const colWidth = contentWidth / 3;

  // Metric 1: Available Balance
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 110);
  doc.text("CURRENT WALLET BALANCE", margin + 6, summaryBoxY + 6.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(12, 10, 9);
  doc.text(`Rs. ${balance.toLocaleString("en-IN")}`, margin + 6, summaryBoxY + 14);

  // Metric 2: Total Deposited
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 110);
  doc.text("TOTAL DEPOSITED (PERIOD)", margin + colWidth + 6, summaryBoxY + 6.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(21, 128, 61); // emerald-700
  doc.text(`+ Rs. ${totalDeposited.toLocaleString("en-IN")}`, margin + colWidth + 6, summaryBoxY + 14);

  // Metric 3: Total Disbursed
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 110);
  doc.text("TOTAL DISBURSED (PERIOD)", margin + colWidth * 2 + 6, summaryBoxY + 6.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(185, 28, 28); // red-700
  doc.text(`- Rs. ${totalDisbursed.toLocaleString("en-IN")}`, margin + colWidth * 2 + 6, summaryBoxY + 14);

  currentY += summaryBoxHeight + 8;

  // 4. Ledger Transactions Table
  const tableRows = transactions.map((tx) => {
    const formattedAmount =
      tx.amount >= 0
        ? `+ Rs. ${tx.amount.toLocaleString("en-IN")}`
        : `- Rs. ${Math.abs(tx.amount).toLocaleString("en-IN")}`;

    const desc = tx.detail ? `${tx.description} ${tx.detail}` : tx.description;

    return [
      tx.dateTime,
      tx.code,
      desc,
      tx.typeLabel,
      formattedAmount,
      tx.statusLabel,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [["DATE & TIME", "TXN ID", "DESCRIPTION", "TYPE", "AMOUNT (INR)", "STATUS"]],
    body:
      tableRows.length > 0
        ? tableRows
        : [["-", "-", "No transactions found for the selected period", "-", "-", "-"]],
    theme: "plain",
    headStyles: {
      font: "helvetica",
      fontStyle: "bold",
      fontSize: 8,
      textColor: [12, 10, 9],
      fillColor: [241, 237, 236], // subtle warm gray
      lineWidth: { top: 0.5, bottom: 0.5, left: 0, right: 0 },
      lineColor: [200, 200, 200],
      cellPadding: { top: 3.5, bottom: 3.5, left: 2.5, right: 2.5 },
    },
    bodyStyles: {
      font: "helvetica",
      fontSize: 8,
      textColor: [40, 40, 40],
      lineWidth: { top: 0, bottom: 0.25, left: 0, right: 0 },
      lineColor: [235, 235, 235],
      cellPadding: { top: 3.5, bottom: 3.5, left: 2.5, right: 2.5 },
    },
    columnStyles: {
      0: { cellWidth: 32, halign: "left" },
      1: { cellWidth: 26, halign: "left" },
      2: { cellWidth: "auto", halign: "left" },
      3: { cellWidth: 24, halign: "left" },
      4: { cellWidth: 30, halign: "right", fontStyle: "bold" },
      5: { cellWidth: 22, halign: "center" },
    },
    didParseCell: (data) => {
      // Color-code positive vs negative amounts
      if (data.section === "body" && data.column.index === 4) {
        const text = String(data.cell.raw || "");
        if (text.startsWith("+")) {
          data.cell.styles.textColor = [21, 128, 61]; // emerald-700
        } else if (text.startsWith("-")) {
          data.cell.styles.textColor = [185, 28, 28]; // red-700
        }
      }
      // Color-code status
      if (data.section === "body" && data.column.index === 5) {
        const statusText = String(data.cell.raw || "").toLowerCase();
        if (statusText === "confirmed") {
          data.cell.styles.textColor = [21, 128, 61];
        } else if (statusText === "pending") {
          data.cell.styles.textColor = [217, 119, 6]; // amber-600
        } else if (statusText === "failed") {
          data.cell.styles.textColor = [185, 28, 28];
        }
      }
    },
    margin: { left: margin, right: margin },
  });

  // 5. Footer (Disclaimer & Page Numbers)
  const totalPages = (doc as any).internal.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);

    // Disclaimer
    doc.text(
      "This is a system-generated statement of PREST Escrow Wallet. Verified under RBI escrow guidelines. No signature required.",
      margin,
      pageHeight - 8
    );

    // Page indicator
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, {
      align: "right",
    });
  }

  // 6. Save PDF directly to user's browser
  const dateFormatted = new Date().toISOString().slice(0, 10);
  const fileName = `PREST_Wallet_Ledger_${dateFormatted}.pdf`;
  doc.save(fileName);
}
