/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("International Taxation Engine & isGst Integration", () => {
  test("1. India (IN) Auto Setup: Split 5% GST (2.5% CGST + 2.5% SGST)", async () => {
    const t = convexTest(schema, modules);

    // Create Org
    const orgId = await t.mutation(api.organizations.create, {
      name: "Tandoori Nights India",
    });

    // Run Auto Setup for India
    const setupResult = await t.mutation(api.taxation.autoSetupStoreTaxation, {
      organizationId: orgId,
      countryCode: "IN",
    });

    expect(setupResult.countryCode).toBe("IN");
    expect(setupResult.currencyCode).toBe("INR");
    expect(setupResult.currencySymbol).toBe("₹");

    // Fetch tax components
    const components = await t.query(api.taxation.listTaxComponents, {
      organizationId: orgId,
    });
    expect(components).toHaveLength(2);
    expect(components.map((c) => c.name)).toContain("CGST");
    expect(components.map((c) => c.name)).toContain("SGST");

    // Test Item Tax Calculation for ₹250.00 Paneer Tikka (isGst = true)
    const taxCalc = await t.query(api.taxation.calculateItemTax, {
      organizationId: orgId,
      price: 25000,
      isGst: true,
      taxGroupId: setupResult.taxGroupId,
    });

    expect(taxCalc.is_gst).toBe(true);
    expect(taxCalc.tax_mode).toBe("inclusive");
    expect(taxCalc.total_tax_rate).toBe(5);
    expect(taxCalc.components).toHaveLength(2);
  });

  test("2. USA (US) Auto Setup: 8.5% Exclusive Sales Tax", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "NYC Diner USA",
    });

    const setupResult = await t.mutation(api.taxation.autoSetupStoreTaxation, {
      organizationId: orgId,
      countryCode: "US",
    });

    expect(setupResult.countryCode).toBe("US");
    expect(setupResult.currencyCode).toBe("USD");
    expect(setupResult.currencySymbol).toBe("$");

    // Calculate tax for $100.00 burger (isGst = true)
    const taxCalc = await t.query(api.taxation.calculateItemTax, {
      organizationId: orgId,
      price: 10000,
      isGst: true,
      taxGroupId: setupResult.taxGroupId,
    });

    expect(taxCalc.is_gst).toBe(true);
    expect(taxCalc.tax_mode).toBe("exclusive");
    expect(taxCalc.total_tax_rate).toBe(8.5);
    expect(taxCalc.tax_amount).toBe("8.50");
    expect(taxCalc.final_price).toBe("108.50");
  });

  test("3. UK Auto Setup: 20% Inclusive VAT", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "London Pub UK",
    });

    const setupResult = await t.mutation(api.taxation.autoSetupStoreTaxation, {
      organizationId: orgId,
      countryCode: "UK",
    });

    expect(setupResult.countryCode).toBe("UK");
    expect(setupResult.currencyCode).toBe("GBP");
    expect(setupResult.currencySymbol).toBe("£");

    // Calculate tax for £12.00 Fish & Chips (isGst = true, VAT inclusive)
    const taxCalc = await t.query(api.taxation.calculateItemTax, {
      organizationId: orgId,
      price: 1200,
      isGst: true,
      taxGroupId: setupResult.taxGroupId,
    });

    expect(taxCalc.is_gst).toBe(true);
    expect(taxCalc.tax_mode).toBe("inclusive");
    expect(taxCalc.total_tax_rate).toBe(20);
    expect(taxCalc.final_price).toBe("12.00");
    expect(parseFloat(taxCalc.tax_amount)).toBeCloseTo(2.0, 1);
  });

  test("4. Item with isGst = false Returns Zero Tax", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Exempt Grocery",
    });

    await t.mutation(api.taxation.autoSetupStoreTaxation, {
      organizationId: orgId,
      countryCode: "US",
    });

    const taxCalc = await t.query(api.taxation.calculateItemTax, {
      organizationId: orgId,
      price: 5000,
      isGst: false, // Tax Exempt Item!
    });

    expect(taxCalc.is_gst).toBe(false);
    expect(taxCalc.total_tax_rate).toBe(0);
    expect(taxCalc.tax_amount).toBe("0.00");
    expect(taxCalc.final_price).toBe("50.00");
  });
});
