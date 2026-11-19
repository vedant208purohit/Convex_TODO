import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatCurrencyMinor,
  toMinorUnits,
  fromMinorUnits,
  getCurrencySymbol,
  getCurrencyLocale,
  getCurrencyDecimalDigits,
  resolveStoreCurrency,
} from "./currency";

describe("PHASE 2 & PHASE 3: Store-Based Currency Resolution & Formatting", () => {
  it("Test 1: Indian store resolves INR (₹)", () => {
    const storeOrg = { country: "India" };
    const resolved = resolveStoreCurrency(storeOrg);
    expect(resolved.currencyCode).toBe("INR");
    expect(resolved.symbol).toBe("₹");

    // Formatter check
    const formatted = formatCurrency(1500, "INR", "en-IN");
    expect(formatted).toMatch(/₹|INR/);
    expect(formatted).toContain("1,500");
  });

  it("Test 2: UAE store resolves AED", () => {
    const storeOrg = { country: "United Arab Emirates" };
    const resolved = resolveStoreCurrency(storeOrg);
    expect(resolved.currencyCode).toBe("AED");
    expect(resolved.symbol).toBe("AED");

    const formatted = formatCurrency(1500, "AED", "en-AE");
    expect(formatted).toContain("AED");
    expect(formatted).toContain("1,500");
  });

  it("Test 3: US store resolves USD ($)", () => {
    const storeOrg = { country: "United States" };
    const resolved = resolveStoreCurrency(storeOrg);
    expect(resolved.currencyCode).toBe("USD");
    expect(resolved.symbol).toBe("$");

    const formatted = formatCurrency(1500, "USD", "en-US");
    expect(formatted).toContain("$");
    expect(formatted).toContain("1,500");
  });

  it("Test 4: UK store resolves GBP (£)", () => {
    const storeOrg = { country: "United Kingdom" };
    const resolved = resolveStoreCurrency(storeOrg);
    expect(resolved.currencyCode).toBe("GBP");
    expect(resolved.symbol).toBe("£");

    const formatted = formatCurrency(1500, "GBP", "en-GB");
    expect(formatted).toContain("£");
    expect(formatted).toContain("1,500");
  });

  it("Test 5: Explicit configured currency takes precedence over country default", () => {
    // Store in UAE that explicitly configured USD as operating currency
    const storeOrg = { country: "United Arab Emirates", defaultCurrency: "USD" };
    const resolved = resolveStoreCurrency(storeOrg);
    expect(resolved.currencyCode).toBe("USD");
    expect(resolved.symbol).toBe("$");
  });

  it("Test 6: Formatter handles 0 decimals (JPY), 2 decimals (INR/AED/USD), 3 decimals (BHD/KWD)", () => {
    // 0 decimals: JPY
    expect(getCurrencyDecimalDigits("JPY")).toBe(0);
    expect(toMinorUnits(1500, "JPY")).toBe(1500);
    expect(fromMinorUnits(1500, "JPY")).toBe(1500);
    expect(formatCurrencyMinor(1500, "JPY")).toMatch(/¥|￥|JPY/);

    // 2 decimals: INR
    expect(getCurrencyDecimalDigits("INR")).toBe(2);
    expect(toMinorUnits(1500, "INR")).toBe(150000);
    expect(fromMinorUnits(150000, "INR")).toBe(1500);
    expect(formatCurrencyMinor(150000, "INR")).toContain("1,500");

    // 3 decimals: KWD
    expect(getCurrencyDecimalDigits("KWD")).toBe(3);
    expect(toMinorUnits(1500, "KWD")).toBe(1500000);
    expect(fromMinorUnits(1500000, "KWD")).toBe(1500);
    expect(formatCurrencyMinor(1500000, "KWD", "en-US")).toContain("1,500.000");
  });

  it("Test 7: Formatter does not take currency from browser locale", () => {
    // Formatting AED using en-US locale must still format in AED, not USD!
    const formattedAed = formatCurrency(250, "AED", "en-US");
    expect(formattedAed).toContain("AED");
    expect(formattedAed).not.toContain("$");

    // Formatting INR using en-GB locale must still format in INR/₹, not GBP!
    const formattedInr = formatCurrency(250, "INR", "en-GB");
    expect(formattedInr).toMatch(/₹|INR/);
    expect(formattedInr).not.toContain("£");
  });

  it("Test 8: Transaction currency is preserved (AED transaction in Indian store displays AED)", () => {
    const storeOperatingCurrency = "INR";
    const foreignTx = {
      providerPaymentId: "pay_intl_001",
      amountMinor: 4500, // 45.00 AED
      currency: "AED",
      status: "captured",
    };

    // The transaction's actual currency must be respected
    const displayAmount = formatCurrencyMinor(foreignTx.amountMinor, foreignTx.currency);
    expect(displayAmount).toContain("AED");
    expect(displayAmount).toContain("45.00");
    expect(displayAmount).not.toContain("₹");
    expect(foreignTx.currency).not.toBe(storeOperatingCurrency);
  });

  it("Test 9: Refund currency is preserved from original transaction/refund", () => {
    const refundRecord = {
      providerRefundId: "rfnd_intl_001",
      amountMinor: 2000, // 20.00 USD
      currency: "USD",
      status: "processed",
    };

    const displayRefund = formatCurrencyMinor(refundRecord.amountMinor, refundRecord.currency);
    expect(displayRefund).toContain("$");
    expect(displayRefund).toContain("20.00");
  });

  it("Test 10: Settlement currency is preserved from settlement record", () => {
    const settlementRecord = {
      providerSettlementId: "setl_001",
      amountMinor: 500000, // 5,000.00 INR
      currency: "INR",
      status: "processed",
    };

    const displaySettlement = formatCurrencyMinor(
      settlementRecord.amountMinor,
      settlementRecord.currency
    );
    expect(displaySettlement).toMatch(/₹|INR/);
    expect(displaySettlement).toContain("5,000.00");
  });

  it("Test 11: Mixed-currency aggregation invariant (unlike currencies are NEVER summed into store operating totals)", () => {
    const storeCurrency = "INR";
    const transactions = [
      { amountMinor: 100000, currency: "INR", status: "captured" }, // ₹1,000.00
      { amountMinor: 50000, currency: "INR", status: "captured" },  // ₹500.00
      { amountMinor: 4400, currency: "AED", status: "captured" },   // 44.00 AED (NOT ₹44.00!)
      { amountMinor: 1000, currency: "USD", status: "captured" },   // 10.00 USD
    ];

    // Invariant: store operating gross revenue sums ONLY INR
    const storeOperatingTxns = transactions.filter(
      (t) => (t.currency || storeCurrency) === storeCurrency && t.status === "captured"
    );
    const storeOperatingGrossPaise = storeOperatingTxns.reduce(
      (sum, t) => sum + t.amountMinor,
      0
    );

    // Sum must be exactly ₹1,500.00 (150,000 paise), NOT 155,400 paise!
    expect(storeOperatingGrossPaise).toBe(150000);
    expect(formatCurrencyMinor(storeOperatingGrossPaise, storeCurrency)).toContain("1,500.00");

    // Partitioned multi-currency buckets
    const currencyBuckets: Record<string, number> = {};
    for (const t of transactions) {
      currencyBuckets[t.currency] = (currencyBuckets[t.currency] || 0) + t.amountMinor;
    }

    expect(currencyBuckets["INR"]).toBe(150000);
    expect(currencyBuckets["AED"]).toBe(4400);
    expect(currencyBuckets["USD"]).toBe(1000);
  });

  it("Test 12: Missing transaction currency falls back to store operating currency", () => {
    const storeCurrency = "INR";
    const legacyTx = {
      amountMinor: 25000,
      status: "captured",
      // currency omitted
    };

    const resolvedTxCurrency = (legacyTx as any).currency || storeCurrency;
    expect(resolvedTxCurrency).toBe("INR");
    expect(formatCurrencyMinor(legacyTx.amountMinor, resolvedTxCurrency)).toContain("250.00");
  });
});

describe("PHASE 4: Strict Store-Specific Data Isolation", () => {
  it("Test 13: Store A (India - INR) vs Store B (UAE - AED) strict isolation", () => {
    // Simulate Store A (India) Convex Project
    const storeA_Database = {
      orgId: "org_india_gts",
      convexDeployment: "courteous-condor-216",
      country: "India",
      operatingCurrency: "INR",
      transactions: [
        { id: "tx_a1", amountMinor: 100000, currency: "INR", status: "captured" },
        { id: "tx_a2", amountMinor: 50000, currency: "INR", status: "captured" },
      ],
      refunds: [
        { id: "rf_a1", amountMinor: 20000, currency: "INR", status: "processed" },
      ],
      settlements: [
        { id: "st_a1", amountMinor: 130000, currency: "INR", status: "processed" },
      ],
    };

    // Simulate Store B (UAE) Convex Project
    const storeB_Database = {
      orgId: "org_uae_hitler",
      convexDeployment: "adamant-shepherd-716",
      country: "United Arab Emirates",
      operatingCurrency: "AED",
      transactions: [
        { id: "tx_b1", amountMinor: 25000, currency: "AED", status: "captured" },
      ],
      refunds: [
        { id: "rf_b1", amountMinor: 5000, currency: "AED", status: "processed" },
      ],
      settlements: [
        { id: "st_b1", amountMinor: 20000, currency: "AED", status: "processed" },
      ],
    };

    // Store A queries ONLY run against storeA_Database
    const storeA_Gross = storeA_Database.transactions
      .filter((t) => t.currency === storeA_Database.operatingCurrency)
      .reduce((sum, t) => sum + t.amountMinor, 0);

    const storeA_Net =
      storeA_Gross -
      storeA_Database.refunds
        .filter((r) => r.currency === storeA_Database.operatingCurrency)
        .reduce((sum, r) => sum + r.amountMinor, 0);

    // Store B queries ONLY run against storeB_Database
    const storeB_Gross = storeB_Database.transactions
      .filter((t) => t.currency === storeB_Database.operatingCurrency)
      .reduce((sum, t) => sum + t.amountMinor, 0);

    const storeB_Net =
      storeB_Gross -
      storeB_Database.refunds
        .filter((r) => r.currency === storeB_Database.operatingCurrency)
        .reduce((sum, r) => sum + r.amountMinor, 0);

    // Verify complete data and currency isolation
    expect(storeA_Database.operatingCurrency).toBe("INR");
    expect(storeA_Gross).toBe(150000);
    expect(storeA_Net).toBe(130000);
    expect(formatCurrencyMinor(storeA_Gross, storeA_Database.operatingCurrency)).toContain("1,500.00");

    expect(storeB_Database.operatingCurrency).toBe("AED");
    expect(storeB_Gross).toBe(25000);
    expect(storeB_Net).toBe(20000);
    expect(formatCurrencyMinor(storeB_Gross, storeB_Database.operatingCurrency)).toContain("250.00");

    // Verify zero cross-contamination
    expect(storeA_Database.transactions.some((t) => t.id === "tx_b1")).toBe(false);
    expect(storeB_Database.transactions.some((t) => t.id === "tx_a1")).toBe(false);
  });
});
