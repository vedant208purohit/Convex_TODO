import { describe, it, expect } from "vitest";
import {
  generateDefxReceiptPlainString,
  generateWorkstationRunnerSlipPlainString,
} from "../app/utils/defxReceiptFormatter";

describe("defxReceiptFormatter", () => {
  const sampleOrg = {
    name: "TEST RESTAURANT 1",
    addressLine1: "34, Shreeji Nagar, Bhatkuwa road bombay",
    phone: "+919876543210",
    email: "mahendrasuthar962@gmail.com",
    gstNumber: "5356363625",
  };

  const sampleOrder = {
    orderNumber: "ORD-1082",
    tokenNumber: "02",
    orderType: "DineIn",
    customerName: "Rahul Verma",
    customerPhone: "+91 98765 43210",
    table: { number: "02" },
    createdAt: new Date("2026-09-11T18:11:00").getTime(),
    items: [
      {
        itemName: "Vadapav (Copy)",
        quantity: 1,
        display_item_price: "70.00",
        display_total_price: "70.00",
      },
      {
        itemName: "Cheese Dabeli",
        quantity: 1,
        display_item_price: "50.00",
        display_total_price: "50.00",
      },
    ],
    display_sub_total: "120.00",
    display_tax_total: "6.00",
    display_total_amount: "126.00",
    paymentMode: "CASH",
  };

  it("should generate a 48-column standard 80mm receipt with all sections and currency symbols", () => {
    const receipt = generateDefxReceiptPlainString(sampleOrder, sampleOrg, 48);
    expect(receipt).toBeDefined();

    const lines = receipt.split("\n");
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(48);
    }

    // Verify sections exist
    expect(receipt).toContain("TEST RESTAURANT 1");
    expect(receipt).toContain("ORDER INVOICE");
    expect(receipt).toContain("CUSTOMER DETAILS");
    expect(receipt).toContain("ORDER DETAILS");
    expect(receipt).toContain("ORDER SUMMARY");
    expect(receipt).toContain("BILL DETAILS");
    expect(receipt).toContain("PAYMENT DETAILS");
    expect(receipt).toContain("Thank you for ordering and stay safe!");
    expect(receipt).toContain("Vadapav (Copy)");
    expect(receipt).toContain("Cheese Dabeli");

    // Verify currency symbols appear on line items and totals
    expect(receipt).toContain("Rs.70.00");
    expect(receipt).toContain("Rs.50.00");
    expect(receipt).toContain("Rs. 120.00");
    expect(receipt).toContain("Rs. 126.00");
  });

  it("should always format amounts with Rs. currency symbol for thermal printer compatibility", () => {
    const customOrg = {
      ...sampleOrg,
      currencySymbol: "₹",
    };
    const receipt = generateDefxReceiptPlainString(sampleOrder, customOrg, 48);
    expect(receipt).toContain("Rs.70.00");
    expect(receipt).toContain("Rs. 126.00");
  });

  it("should dynamically format amounts for international store currencies (e.g. AED, USD)", () => {
    const uaeOrg = {
      ...sampleOrg,
      defaultCurrency: "AED",
      currencySymbol: "AED",
    };
    const uaeReceipt = generateDefxReceiptPlainString(sampleOrder, uaeOrg, 48);
    expect(uaeReceipt).toContain("AED70.00");
    expect(uaeReceipt).toContain("AED 126.00");

    const usOrg = {
      ...sampleOrg,
      defaultCurrency: "USD",
      currencySymbol: "$",
    };
    const usReceipt = generateDefxReceiptPlainString(sampleOrder, usOrg, 48);
    expect(usReceipt).toContain("$70.00");
    expect(usReceipt).toContain("$ 126.00");
  });

  it("should handle very long restaurant names and addresses gracefully with word-wrapping", () => {
    const longOrg = {
      name: "VERY LONG RESTAURANT AND CAFE NAME THAT EXCEEDS FORTY EIGHT CHARACTERS EASILY AND NICELY",
      addressLine1: "123 Long Street Name In Commercial Complex, Sector 15, Near City Metro Station",
    };

    const receipt = generateDefxReceiptPlainString(sampleOrder, longOrg, 48);
    const lines = receipt.split("\n");
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(48);
    }
    expect(receipt).toContain("VERY LONG RESTAURANT");
  });

  it("should NOT print an extra tax line when taxes are inclusive, matching order receipt format", () => {
    const inclusiveOrder = {
      ...sampleOrder,
      display_sub_total: "120.00",
      display_tax_total: "6.00",
      display_total_amount: "120.00", // Tax is included inside subtotal 120.00
      totalAmount: 12000,
      subTotal: 12000,
      taxTotal: 600,
      taxInfoSnapshot: {
        tax_mode: "inclusive",
        tax_amount: "6.00",
        components: [],
      },
    };

    const receipt = generateDefxReceiptPlainString(inclusiveOrder, sampleOrg, 48);

    // It should have Sub Total and Grand Total matching 120.00
    expect(receipt).toMatch(/Sub Total\s+Rs\.\s*120\.00/);
    expect(receipt).toMatch(/Grand Total\s+Rs\.\s*120\.00/);
    // It should NOT contain an extra tax addition line like "+Rs. 6.00"
    expect(receipt).not.toContain("+Rs. 6.00");
    expect(receipt).not.toContain("+Rs.6.00");
    // It indicates taxes are inclusive
    expect(receipt).toContain("(Inclusive of all taxes)");
  });

  it("should generate a clean food runner assembly slip for workstation", () => {
    const runnerOrder = {
      orderNumber: "ORD-1082",
      tokenNumber: "02",
      orderType: "DineIn",
      destinationDetails: "Table 04",
      customerName: "Rahul Verma",
      waiterName: "Ramesh",
      createdAt: new Date("2026-09-11T18:11:00").getTime(),
      specialNotes: "Serve piping hot directly upon dispatch.",
      items: [
        {
          name: "Vadapav (Copy)",
          qty: 2,
          isReady: true,
          spec: "Extra chutney",
        },
        {
          name: "Cheese Dabeli",
          qty: 1,
          isReady: false,
        },
      ],
    };

    const slip = generateWorkstationRunnerSlipPlainString(runnerOrder, sampleOrg, 48);
    expect(slip).toBeDefined();

    const lines = slip.split("\n");
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(48);
    }

    expect(slip).toContain("RUNNER / ASSEMBLY SLIP");
    expect(slip).toContain("TOKEN: #02");
    expect(slip).toContain("TABLE: Table 04");
    expect(slip).toContain("TYPE: DINEIN");
    expect(slip).toContain("ORD: ORD-1082");
    expect(slip).toContain("SERVER: Ramesh");
    expect(slip).toContain("PLATE ASSEMBLY CHECKLIST");
    expect(slip).toContain("[READY] 2x Vadapav (Copy)");
    expect(slip).toContain("[ ] 1x Cheese Dabeli");
    expect(slip).toContain("CHEF NOTES:");
    expect(slip).toContain("Serve piping hot directly upon dispatch.");
    expect(slip).toContain("VERIFY ALL ITEMS BEFORE DISPATCH");
  });
});
