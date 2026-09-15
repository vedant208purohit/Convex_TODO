import { describe, it, expect } from "vitest";
import { generateDefxReceiptPlainString } from "../app/utils/defxReceiptFormatter";

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
    expect(receipt).toContain("TAX INVOICE");
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
});
