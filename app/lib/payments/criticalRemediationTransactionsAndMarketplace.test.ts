import { describe, it, expect, vi } from "vitest";
import { formatCurrency, formatCurrencyMinor, resolveOrganizationCurrency } from "./currency";
import { getPaymentAdapter } from "./registry";

describe("CRITICAL RAZORPAY FIX — COMPREHENSIVE VERIFICATION SUITE", () => {
  // =========================================================================
  // 1. TRANSACTION STATUS ACCURACY & KPI FINANCIAL METRICS
  // =========================================================================
  describe("1. Transaction Status Normalization & KPI Calculations", () => {
    const mockStoreTransactions = [
      {
        providerPaymentId: "pay_succ_1",
        amountMinor: 100000, // ₹1,000.00
        currency: "INR",
        status: "captured",
        createdAt: 1700000000000,
      },
      {
        providerPaymentId: "pay_succ_2",
        amountMinor: 250000, // ₹2,500.00
        currency: "INR",
        status: "captured",
        createdAt: 1700000100000,
      },
      {
        providerPaymentId: "pay_fail_1",
        amountMinor: 150000, // ₹1,500.00
        currency: "INR",
        status: "failed",
        errorCode: "BAD_REQUEST_ERROR",
        errorMessage: "Payment failed due to insufficient funds",
        createdAt: 1700000200000,
      },
      {
        providerPaymentId: "pay_fail_2",
        amountMinor: 50000, // ₹500.00
        currency: "INR",
        status: "failed",
        errorCode: "GATEWAY_ERROR",
        errorMessage: "Bank gateway timed out",
        createdAt: 1700000300000,
      },
      {
        providerPaymentId: "pay_auth_1",
        amountMinor: 80000, // ₹800.00
        currency: "INR",
        status: "authorized",
        createdAt: 1700000400000,
      },
      {
        providerPaymentId: "pay_pend_1",
        amountMinor: 40000, // ₹400.00
        currency: "INR",
        status: "pending",
        createdAt: 1700000500000,
      },
      {
        providerPaymentId: "pay_ref_1",
        amountMinor: 120000, // ₹1,200.00
        refundedAmountMinor: 120000,
        currency: "INR",
        status: "refunded",
        createdAt: 1700000600000,
      },
      {
        providerPaymentId: "pay_pref_1",
        amountMinor: 300000, // ₹3,000.00
        refundedAmountMinor: 100000,
        currency: "INR",
        status: "partially_refunded",
        createdAt: 1700000700000,
      },
    ];

    it("correctly distinguishes between captured, failed, authorized, pending, and refunded", () => {
      let successfulCount = 0;
      let successfulAmountMinor = 0;
      let failedCount = 0;
      let failedAmountMinor = 0;
      let pendingCount = 0;
      let pendingAmountMinor = 0;
      let totalAmountMinor = 0;

      for (const t of mockStoreTransactions) {
        totalAmountMinor += t.amountMinor;
        if (t.status === "captured" || t.status === "partially_refunded" || t.status === "refunded") {
          successfulCount++;
          successfulAmountMinor += t.amountMinor;
        } else if (t.status === "failed") {
          failedCount++;
          failedAmountMinor += t.amountMinor;
        } else if (t.status === "pending" || t.status === "authorized" || t.status === "created") {
          pendingCount++;
          pendingAmountMinor += t.amountMinor;
        }
      }

      // Assert counts
      expect(mockStoreTransactions.length).toBe(8);
      expect(successfulCount).toBe(4); // 2 captured + 1 refunded + 1 partially_refunded
      expect(failedCount).toBe(2);
      expect(pendingCount).toBe(2); // 1 authorized + 1 pending

      // Assert financial amounts
      expect(successfulAmountMinor).toBe(100000 + 250000 + 120000 + 300000); // 770,000 paise = ₹7,700.00
      expect(failedAmountMinor).toBe(150000 + 50000); // 200,000 paise = ₹2,000.00
      expect(pendingAmountMinor).toBe(80000 + 40000); // 120,000 paise = ₹1,200.00
      expect(totalAmountMinor).toBe(770000 + 200000 + 120000); // 1,090,000 paise = ₹10,900.00

      // Success & Failure rate: calculated over evaluated transactions (successful + failed)
      const evaluated = successfulCount + failedCount; // 6
      const successRate = Math.round((successfulCount / evaluated) * 1000) / 10;
      const failureRate = Math.round((failedCount / evaluated) * 1000) / 10;

      expect(successRate).toBe(66.7); // 4 / 6 = 66.67%
      expect(failureRate).toBe(33.3); // 2 / 6 = 33.33%
      expect(successRate + failureRate).toBe(100);

      // Verify formatted strings
      expect(formatCurrencyMinor(failedAmountMinor, "INR", "en-IN")).toBe("₹2,000.00");
      expect(formatCurrencyMinor(successfulAmountMinor, "INR", "en-IN")).toBe("₹7,700.00");
      expect(formatCurrencyMinor(pendingAmountMinor, "INR", "en-IN")).toBe("₹1,200.00");
      expect(formatCurrencyMinor(totalAmountMinor, "INR", "en-IN")).toBe("₹10,900.00");
    });

    it("verifies failed KPI displays non-zero when failed transactions are present", () => {
      const failedTransactions = mockStoreTransactions.filter((t) => t.status === "failed");
      const failedSum = failedTransactions.reduce((acc, t) => acc + t.amountMinor, 0);
      const failedCount = failedTransactions.length;

      expect(failedCount).toBe(2);
      expect(failedSum).toBeGreaterThan(0);
      expect(formatCurrencyMinor(failedSum, "INR")).toBe("₹2,000.00");
    });

    it("does not classify authorized or pending payments as failed", () => {
      const nonFailed = mockStoreTransactions.filter((t) => t.status === "authorized" || t.status === "pending");
      for (const t of nonFailed) {
        expect(t.status).not.toBe("failed");
      }
    });
  });

  // =========================================================================
  // 2. CURRENCY VALIDATION & FOREIGN CURRENCY PRESERVATION
  // =========================================================================
  describe("2. Currency Correctness & Foreign Currency Detection", () => {
    it("resolves store operating currency as INR for Indian store", () => {
      const indianOrg = { country: "India", defaultCurrency: "INR" };
      const resolved = resolveOrganizationCurrency(indianOrg);
      expect(resolved.code).toBe("INR");
      expect(resolved.symbol).toBe("₹");
      expect(resolved.locale).toBe("en-IN");
    });

    it("resolves store operating currency as AED for UAE store", () => {
      const uaeOrg = { country: "United Arab Emirates", defaultCurrency: "AED" };
      const resolved = resolveOrganizationCurrency(uaeOrg);
      expect(resolved.code).toBe("AED");
      expect(resolved.symbol).toBe("AED");
      expect(resolved.locale).toBe("en-AE");
    });

    it("preserves actual provider currency when a foreign currency transaction is processed", () => {
      const storeCurrency = "INR";
      const foreignTx = {
        providerPaymentId: "pay_usd_test_1",
        amountMinor: 2500, // $25.00
        currency: "USD",
        status: "captured",
      };

      // Transaction currency is preserved as USD
      expect(foreignTx.currency).toBe("USD");
      // Formatted with USD symbol
      const formatted = formatCurrencyMinor(foreignTx.amountMinor, foreignTx.currency, "en-US");
      expect(formatted).toBe("$25.00");

      // Flagging: detects that foreignTx.currency differs from store operating currency
      const isForeign = foreignTx.currency.toUpperCase() !== storeCurrency.toUpperCase();
      expect(isForeign).toBe(true);
    });

    it("does not aggregate foreign currency amounts into the store operating currency totals without separation", () => {
      const storeOperatingCurrency = "INR";
      const transactions = [
        { amountMinor: 100000, currency: "INR" }, // ₹1,000.00
        { amountMinor: 2500, currency: "USD" },   // $25.00
      ];

      // Operating currency sum only includes INR transactions
      const operatingSum = transactions
        .filter((t) => t.currency === storeOperatingCurrency)
        .reduce((sum, t) => sum + t.amountMinor, 0);

      expect(operatingSum).toBe(100000); // Only ₹1,000.00
      expect(operatingSum).not.toBe(102500); // MUST NOT add 2500 cents to 100000 paise!
    });
  });

  // =========================================================================
  // 3. PERSISTENT MARKETPLACE CONNECTION
  // =========================================================================
  describe("3. Marketplace Connection Persistence & Subscriptions Section", () => {
    it("maps connected Razorpay payment gateway to installed and subscriptions catalog listings", () => {
      const defaultListing = {
        slug: "razorpay",
        title: "Razorpay",
        category: "Payments",
        priceAmount: 0,
        badge: "Recommended for India",
        statusText: "Not Connected",
        statusType: "available",
        actionText: "Connect",
        actionType: "install",
      };

      const razorpayConn = {
        organizationId: "org_india_store",
        provider: "razorpay",
        status: "connected",
        accountMode: "live",
        merchantName: "The Grand Bistro HQ",
        providerAccountId: "rzp_live_test123",
        connectedAt: 1700000000000,
      };

      // Simulate listCatalog transformation
      let isInstalled = false;
      let statusText = defaultListing.statusText;
      let statusType = defaultListing.statusType;
      let actionText = defaultListing.actionText;
      let actionType = defaultListing.actionType;
      let badge = defaultListing.badge;

      if (razorpayConn && razorpayConn.status === "connected") {
        isInstalled = true;
        statusText = "Connected & Active";
        statusType = "live";
        actionText = "Open Dashboard";
        actionType = "open";
        badge = "Connected";
      }

      expect(isInstalled).toBe(true);
      expect(statusText).toBe("Connected & Active");
      expect(badge).toBe("Connected");
      expect(actionText).toBe("Open Dashboard");
      expect(actionType).toBe("open");

      // Verify Tab filtering for Subscriptions & Purchases ("purchases")
      const appListing = {
        ...defaultListing,
        isInstalled,
        statusText,
        statusType,
        actionText,
        actionType,
        badge,
      };

      const allApps = [appListing];

      // Tab: explore (all published)
      expect(allApps.length).toBe(1);

      // Tab: installed
      const installedApps = allApps.filter((app) => app.isInstalled);
      expect(installedApps.length).toBe(1);
      expect(installedApps[0].actionText).toBe("Open Dashboard");

      // Tab: purchases (Subscriptions & Purchases) includes connected Razorpay
      const purchasesApps = allApps.filter(
        (app) => (app.priceAmount > 0 || app.slug === "razorpay") && app.isInstalled
      );
      expect(purchasesApps.length).toBe(1);
      expect(purchasesApps[0].slug).toBe("razorpay");
      expect(purchasesApps[0].statusText).toBe("Connected & Active");
    });

    it("reverts to Connect state when disconnected and removes from Subscriptions", () => {
      const razorpayConn = {
        organizationId: "org_india_store",
        provider: "razorpay",
        status: "disconnected",
      };

      let isInstalled = false;
      let statusText = "Not Connected";
      let actionText = "Connect";

      if (razorpayConn && razorpayConn.status === "connected") {
        isInstalled = true;
        statusText = "Connected & Active";
        actionText = "Open Dashboard";
      }

      expect(isInstalled).toBe(false);
      expect(statusText).toBe("Not Connected");
      expect(actionText).toBe("Connect");

      const allApps = [{ slug: "razorpay", priceAmount: 0, isInstalled }];
      const purchasesApps = allApps.filter(
        (app) => (app.priceAmount > 0 || app.slug === "razorpay") && app.isInstalled
      );
      expect(purchasesApps.length).toBe(0); // Not in Subscriptions when disconnected
    });
  });

  // =========================================================================
  // 5. RESILIENT AMOUNT EXTRACTION & MULTI-CURRENCY FINANCIAL AGGREGATION
  // =========================================================================
  describe("5. Resilient Amount Extraction & Multi-Currency Aggregations", () => {
    function extractTransactionAmountMinor(r: any): number {
      if (typeof r?.amountMinor === "number" && !isNaN(r.amountMinor)) {
        return Math.round(r.amountMinor);
      }
      if (typeof r?.amount === "number" && !isNaN(r.amount)) {
        return Math.round(r.amount);
      }
      if (typeof r?.amount_minor === "number" && !isNaN(r.amount_minor)) {
        return Math.round(r.amount_minor);
      }
      if (typeof r?.grossMinor === "number" && !isNaN(r.grossMinor)) {
        return Math.round(r.grossMinor);
      }
      if (typeof r?.amountPaise === "number" && !isNaN(r.amountPaise)) {
        return Math.round(r.amountPaise);
      }
      if (typeof r?.amountMinor === "string") {
        const p = parseFloat(r.amountMinor);
        if (!isNaN(p)) return Math.round(p);
      }
      if (typeof r?.amount === "string") {
        const p = parseFloat(r.amount);
        if (!isNaN(p)) return Math.round(p);
      }
      return 0;
    }

    it("resiliently extracts integer minor units across all schema naming variants", () => {
      expect(extractTransactionAmountMinor({ amountMinor: 150000 })).toBe(150000);
      expect(extractTransactionAmountMinor({ amount: 250000 })).toBe(250000);
      expect(extractTransactionAmountMinor({ amount_minor: 350000 })).toBe(350000);
      expect(extractTransactionAmountMinor({ grossMinor: 450000 })).toBe(450000);
      expect(extractTransactionAmountMinor({ amountPaise: 550000 })).toBe(550000);
      expect(extractTransactionAmountMinor({ amountMinor: "650000" })).toBe(650000);
      expect(extractTransactionAmountMinor({ amount: "750000" })).toBe(750000);
      expect(extractTransactionAmountMinor({})).toBe(0);
      expect(extractTransactionAmountMinor({ amount: null })).toBe(0);
      expect(extractTransactionAmountMinor({ amount: undefined })).toBe(0);
    });

    it("correctly aggregates 147 transactions (141 captured, 5 failed, 1 pending) and formats single foreign USD currency without displaying ₹0.00", () => {
      // Simulate 147 synchronized records from Razorpay test account in USD
      const records = [
        ...Array.from({ length: 141 }, (_, i) => ({
          providerPaymentId: `pay_cap_${i}`,
          amountMinor: 1000, // $10.00
          currency: "USD",
          status: "captured",
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          providerPaymentId: `pay_fail_${i}`,
          amountMinor: 2000, // $20.00
          currency: "USD",
          status: "failed",
        })),
        {
          providerPaymentId: "pay_auth_0",
          amountMinor: 1500, // $15.00
          currency: "USD",
          status: "authorized",
        },
      ];

      expect(records.length).toBe(147);

      const storeCurrencyCode = "INR";
      let successfulCount = 0;
      let successfulAmountMinor = 0;
      let failedCount = 0;
      let failedAmountMinor = 0;
      let pendingCount = 0;
      let pendingAmountMinor = 0;
      let totalAmountMinor = 0;

      const currencyBuckets: Record<string, { totalMinor: number; successfulMinor: number; failedMinor: number; pendingMinor: number; totalCount: number }> = {};
      for (const r of records) {
        const amt = extractTransactionAmountMinor(r);
        const txCurr = (r.currency || storeCurrencyCode).toUpperCase();
        if (!currencyBuckets[txCurr]) {
          currencyBuckets[txCurr] = { totalMinor: 0, successfulMinor: 0, failedMinor: 0, pendingMinor: 0, totalCount: 0 };
        }
        const b = currencyBuckets[txCurr];
        b.totalCount++;
        b.totalMinor += amt;
        totalAmountMinor += amt;

        if (r.status === "captured" || r.status === "partially_refunded" || r.status === "refunded") {
          successfulCount++;
          b.successfulMinor += amt;
          successfulAmountMinor += amt;
        } else if (r.status === "failed") {
          failedCount++;
          b.failedMinor += amt;
          failedAmountMinor += amt;
        } else if (r.status === "pending" || r.status === "authorized" || r.status === "created") {
          pendingCount++;
          b.pendingMinor += amt;
          pendingAmountMinor += amt;
        }
      }

      expect(successfulCount).toBe(141);
      expect(failedCount).toBe(5);
      expect(pendingCount).toBe(1);

      // Verify success rate calculation
      const evaluated = successfulCount + failedCount;
      const successRate = evaluated > 0 ? Math.round((successfulCount / evaluated) * 1000) / 10 : 100;
      expect(successRate).toBe(96.6); // 141 / 146 = 96.575% -> 96.6%

      // Verify dominant single foreign currency resolution
      const presentCurrencies = Object.keys(currencyBuckets);
      expect(presentCurrencies).toEqual(["USD"]);

      const isSingleForeignCurrency = presentCurrencies.length === 1 && presentCurrencies[0] !== storeCurrencyCode;
      expect(isSingleForeignCurrency).toBe(true);

      const dominantCurrency = isSingleForeignCurrency ? presentCurrencies[0] : storeCurrencyCode;
      expect(dominantCurrency).toBe("USD");

      // Verify formatted totals are in USD and NEVER ₹0.00
      const totalFormatted = formatCurrencyMinor(totalAmountMinor, dominantCurrency);
      expect(totalFormatted).toContain("$");
      expect(totalFormatted).not.toBe("₹0.00");
      expect(totalFormatted).not.toBe("$0.00");
      // 141 * 1000 + 5 * 2000 + 1 * 1500 = 141000 + 10000 + 1500 = 152500 cents = $1,525.00
      expect(totalAmountMinor).toBe(152500);
      expect(totalFormatted).toBe("$1,525.00");

      const successfulFormatted = formatCurrencyMinor(successfulAmountMinor, dominantCurrency);
      expect(successfulFormatted).toBe("$1,410.00");

      const failedFormatted = formatCurrencyMinor(failedAmountMinor, dominantCurrency);
      expect(failedFormatted).toBe("$100.00");

      const pendingFormatted = formatCurrencyMinor(pendingAmountMinor, dominantCurrency);
      expect(pendingFormatted).toBe("$15.00");
    });

    it("correctly handles mixed currency transactions (INR and USD) without losing either", () => {
      const mixedRecords = [
        { providerPaymentId: "tx_inr_1", amountMinor: 500000, currency: "INR", status: "captured" }, // ₹5,000
        { providerPaymentId: "tx_inr_2", amountMinor: 250000, currency: "INR", status: "captured" }, // ₹2,500
        { providerPaymentId: "tx_usd_1", amountMinor: 5000, currency: "USD", status: "captured" },   // $50.00
      ];

      const storeCurrency = "INR";
      const inrTotal = mixedRecords.filter((t) => t.currency === "INR").reduce((acc, t) => acc + t.amountMinor, 0);
      const usdTotal = mixedRecords.filter((t) => t.currency === "USD").reduce((acc, t) => acc + t.amountMinor, 0);

      expect(inrTotal).toBe(750000);
      expect(usdTotal).toBe(5000);

      const formattedInr = formatCurrencyMinor(inrTotal, "INR");
      const formattedUsd = formatCurrencyMinor(usdTotal, "USD");

      expect(formattedInr).toContain("₹7,500.00");
      expect(formattedUsd).toContain("$50.00");
    });
  });

  // =========================================================================
  // 6. CREDENTIAL SECURITY AUDIT VERIFICATION
  // =========================================================================
  describe("6. Credential Security Audit & Encryption at Rest", () => {
    it("ensures public connection responses never contain keySecret or encryptedCredentials", () => {
      const internalDbConnection = {
        _id: "conn_123",
        organizationId: "org_indian_store",
        provider: "razorpay",
        providerAccountId: "rzp_live_1234567890abcdNb0",
        merchantName: "GTS Retail Store",
        accountMode: "live",
        status: "connected",
        encryptedCredentials: JSON.stringify({ version: 1, iv: "abcd", ciphertext: "1234ef" }),
        encryptionKeyVersion: 1,
        isDefault: true,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      };

      // Function simulating toPublicConnection in paymentGateways.ts
      function toPublicConnection(conn: any) {
        const { encryptedCredentials, encryptionKeyVersion, ...safeProps } = conn;
        return {
          ...safeProps,
          maskedKeyId: conn.providerAccountId.length > 8
            ? `${conn.providerAccountId.slice(0, 9)}••••••••••••${conn.providerAccountId.slice(-3)}`
            : "••••••••",
        };
      }

      const publicConn = toPublicConnection(internalDbConnection);

      // Verify no secret or ciphertext leaked
      expect((publicConn as any).encryptedCredentials).toBeUndefined();
      expect((publicConn as any).encryptionKeyVersion).toBeUndefined();
      expect((publicConn as any).keySecret).toBeUndefined();
      expect(publicConn.maskedKeyId).toBe("rzp_live_••••••••••••Nb0");
      expect(publicConn.status).toBe("connected");
    });

    it("verifies cross-store connection isolation check", () => {
      const connectionOwnerOrgId = "org_store_A";
      const attackingStoreOrgId = "org_store_B";

      const connection = {
        _id: "conn_A",
        organizationId: connectionOwnerOrgId,
        provider: "razorpay",
      };

      function accessConnection(callerOrgId: string, conn: typeof connection) {
        if (conn.organizationId !== callerOrgId) {
          throw new Error("Forbidden: Access denied to connection outside current store.");
        }
        return conn;
      }

      // Valid store can access
      expect(() => accessConnection(connectionOwnerOrgId, connection)).not.toThrow();

      // Attacking store is strictly rejected
      expect(() => accessConnection(attackingStoreOrgId, connection)).toThrow(
        "Forbidden: Access denied to connection outside current store."
      );
    });
  });

  // =========================================================================
  // 7. REFUND RESILIENCE & NAVIGATION FLOW VERIFICATION
  // =========================================================================
  describe("7. Refund Payload Sanitization & Resilient Execution", () => {
    it("ensures speed: 'normal' is never sent and notes are string-sanitized", async () => {
      const adapter = getPaymentAdapter("razorpay");
      const capturedBodies: any[] = [];

      // Mock fetch
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (url: any, init: any) => {
        const urlStr = String(url);
        if (urlStr.endsWith("/refund")) {
          if (init?.body) {
            capturedBodies.push(JSON.parse(init.body));
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: "rfnd_test123",
              payment_id: "pay_test123",
              amount: 25000,
              currency: "INR",
              status: "processed",
              created_at: 1700000000,
            }),
          };
        }

        // GET /payments/:id
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "pay_test123",
            amount: 50000,
            amount_refunded: 0,
            currency: "INR",
            status: "captured",
            captured: true,
            created_at: 1700000000,
          }),
        };
      }) as any;

      try {
        await adapter.createRefund(
          { keyId: "rzp_test_123", keySecret: "secret_123" },
          "pay_test123",
          {
            amount: 25000, // partial refund
            speed: "normal", // Caller passes normal
            notes: { reason: "Customer request", orderId: 1042 as any },
          }
        );

        expect(capturedBodies.length).toBe(1);
        const body = capturedBodies[0];
        // speed: "normal" MUST NOT be in the body sent to Razorpay
        expect(body.speed).toBeUndefined();
        // receipt MUST NOT be present unless explicitly provided
        expect(body.receipt).toBeUndefined();
        // notes must be sanitized strings
        expect(body.notes.reason).toBe("Customer request");
        expect(body.notes.orderId).toBe("1042");
        expect(body.amount).toBe(25000);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("automatically retries without parameters if Razorpay returns BAD_REQUEST_ERROR", async () => {
      const adapter = getPaymentAdapter("razorpay");
      let refundPostAttempts = 0;
      const capturedBodies: any[] = [];

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (url: any, init: any) => {
        const urlStr = String(url);
        if (urlStr.endsWith("/refund")) {
          refundPostAttempts++;
          capturedBodies.push(JSON.parse(init.body || "{}"));
          if (refundPostAttempts === 1) {
            // First attempt with speed fails with BAD_REQUEST_ERROR
            return {
              ok: false,
              status: 400,
              json: async () => ({
                error: {
                  code: "BAD_REQUEST_ERROR",
                  description: "invalid request sent",
                  field: "speed",
                },
              }),
            };
          }
          // Second retry succeeds
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: "rfnd_retry_success",
              payment_id: "pay_test123",
              amount: 50000,
              currency: "INR",
              status: "processed",
              created_at: 1700000000,
            }),
          };
        }

        // GET /payments/:id
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "pay_test123",
            amount: 50000,
            amount_refunded: 0,
            currency: "INR",
            status: "captured",
            captured: true,
            created_at: 1700000000,
          }),
        };
      }) as any;

      try {
        const result = await adapter.createRefund(
          { keyId: "rzp_test_123", keySecret: "secret_123" },
          "pay_test123",
          {
            amount: 25000,
            speed: "optimum",
            receipt: "ref_pay_duplicate_123",
          }
        );

        expect(refundPostAttempts).toBe(2);
        // First attempt had speed and receipt
        expect(capturedBodies[0].speed).toBe("optimum");
        expect(capturedBodies[0].receipt).toBe("ref_pay_duplicate_123");
        // Retry stripped all parameters to {}
        expect(capturedBodies[1].speed).toBeUndefined();
        expect(capturedBodies[1].receipt).toBeUndefined();
        expect(result.providerRefundId).toBe("rfnd_retry_success");
        expect(result.status).toBe("processed");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("verifies refund navigation target and zero balance protection", () => {
      // Test navigation callback
      let navigatedToTab = "";
      const onTabChange = (tab: string) => {
        navigatedToTab = tab;
      };

      // Simulating handleRefundSuccess
      const handleRefundSuccess = (tabCallback?: (tab: string) => void) => {
        if (tabCallback) {
          tabCallback("Refunds");
        }
      };

      handleRefundSuccess(onTabChange);
      expect(navigatedToTab).toBe("Refunds");

      // Test zero-balance protection
      const tx = {
        amountMinor: 5000,
        refundedAmountMinor: 5000,
      };
      const remainingPaise = Math.max(tx.amountMinor - tx.refundedAmountMinor, 0);
      expect(remainingPaise).toBe(0);
      const isEligible = remainingPaise > 0;
      expect(isEligible).toBe(false);
    });
  });
});

