import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getFunctionName } from "convex/server";
import { StripeProviderAdapter } from "../../../lib/payments/adapters/StripeProviderAdapter";
import { POST as verifyHandler } from "./verify/route";
import { POST as connectHandler } from "./connect/route";
import { GET as statusHandler } from "./status/route";
import { GET as dashboardHandler } from "./dashboard/route";
import { GET as transactionsHandler } from "./transactions/route";
import { GET as refundsGetHandler, POST as refundsPostHandler } from "./refunds/route";
import { GET as settlementsGetHandler, POST as settlementsPostHandler } from "./settlements/route";
import { GET as eligibilityHandler } from "./settlements/eligibility/route";
import { GET as healthHandler } from "./health/route";
import { POST as disconnectHandler } from "./disconnect/route";
import { POST as reconnectHandler } from "./reconnect/route";

const mockStoreAdmin = {
  userId: "user_stripe_admin_1",
  storeId: "store_stripe_test",
  orgId: "org_stripe_test_1" as any,
  role: "org:admin",
  storeCountry: "US",
  defaultCurrency: "USD",
  defaultCurrencySymbol: "$",
  storeConvexClient: null as any,
};

vi.mock("../../../lib/payments/authHelper", () => ({
  requireStoreAdminContext: vi.fn(async () => mockStoreAdmin),
  getStoreAdminContext: vi.fn(async () => mockStoreAdmin),
}));

vi.mock("../../../../convex/paymentGatewayCrypto", async () => {
  const actual = (await vi.importActual("../../../../convex/paymentGatewayCrypto")) as any;
  return {
    ...actual,
    decryptCredentials: vi.fn(async () => ({
      keyId: "pk_live_51M0abcdef1234567890",
      keySecret: "sk_live_51M0abcdef1234567890",
      webhookSecret: "whsec_test1234567890",
    })),
    encryptCredentials: vi.fn(async () => ({
      encryptedString: "ciphertext:iv:tag",
      version: 1,
    })),
  };
});

vi.mock("../../../lib/payments/registry", async () => {
  const actual = (await vi.importActual("../../../lib/payments/registry")) as any;
  return {
    ...actual,
    getPaymentAdapter: vi.fn((provider: string) => {
      const realAdapter = actual.getPaymentAdapter(provider);
      return Object.assign(Object.create(realAdapter), {
        verifyCredentials: vi.fn(async (creds: any) => {
          const formatCheck = realAdapter.validateKeyFormat(creds.keyId, creds.keySecret);
          if (!formatCheck.valid) {
            return {
              success: false,
              verified: false,
              provider: "stripe",
              accountMode: realAdapter.detectAccountMode(creds.keyId),
              credentialsValid: false,
              merchantExists: "unknown",
              accountStatus: "unknown",
              code: "INVALID_KEY_FORMAT",
              message: formatCheck.error || "Invalid key format",
            };
          }
          return {
            success: true,
            verified: true,
            provider: "stripe",
            accountMode: "live",
            credentialsValid: true,
            merchantExists: "yes",
            accountStatus: "active",
            merchantName: "Le Bistro Gourmand",
            providerAccountId: "acct_1NZ4xX2eR9K21",
            message: "Stripe credentials verified successfully.",
          };
        }),
        fetchProfile: vi.fn(async () => ({
          success: true,
          provider: "stripe",
          merchant_name: "Le Bistro Gourmand",
          merchant_id: "acct_1NZ4xX2eR9K21",
          account_mode: "live",
          connection_status: "connected",
          is_profile_available: true,
        })),
        createRefund: vi.fn(async () => ({
          providerRefundId: "re_9281",
          providerPaymentId: "pi_3M9u7x",
          amountMinor: 4250,
          currency: "USD",
          status: "processed",
          providerStatus: "succeeded",
          initiatedAt: Date.now(),
        })),
        requestSettlement: vi.fn(async () => ({
          success: true,
          settlement: {
            providerSettlementId: "po_1456",
            amountMinor: 185000,
            currency: "USD",
            netAmountMinor: 185000,
            status: "processed",
            providerStatus: "paid",
            settlementDate: Date.now(),
          },
        })),
        normalizeError: vi.fn((err: any) => ({
          code: err.code || "STRIPE_ERROR",
          message: err.message || "Stripe error",
          httpStatus: 400,
        })),
        fetchSettlementEligibility: vi.fn(async () => ({
          success: true,
          supportsManualSettlement: true,
          isBalanceAvailable: true,
          availableBalanceMinor: 250000,
          currency: "USD",
          settlementDestination: {
            bankName: "Stripe Registered Bank",
            maskedAccount: "•••• 4242",
            isDefault: true,
            isVerified: true,
          },
        })),
      });
    }),
  };
});

function matchesFunc(path: any, name: string): boolean {
  if (!path) return false;
  if (path === name) return true;
  try {
    const fnName = getFunctionName(path);
    return fnName.includes(name);
  } catch {
    try {
      return String(path).includes(name);
    } catch {
      return false;
    }
  }
}

describe("STRIPE BACKEND INTEGRATION & RAZORPAY PARITY SUITE", () => {
  let adapter: StripeProviderAdapter;
  let mockConvexClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new StripeProviderAdapter();

    mockConvexClient = {
      mutation: vi.fn(async (path: any, args: any) => {
        if (matchesFunc(path, "saveConnection")) {
          return "conn_stripe_live_123";
        }
        if (matchesFunc(path, "reserveRefund")) {
          return { refundId: "ref_doc_123", alreadyProcessed: false };
        }
        if (matchesFunc(path, "recordRefund")) {
          return { refundId: "ref_doc_123", success: true };
        }
        if (matchesFunc(path, "recordSettlement")) {
          return { settlementId: "po_doc_123", success: true };
        }
        if (matchesFunc(path, "disconnectGatewayConnection")) {
          return { connectionId: "conn_stripe_123", disconnectedAt: Date.now() };
        }
        if (matchesFunc(path, "reconnectGatewayConnection")) {
          return { connectionId: "conn_stripe_123", connectedAt: Date.now(), lastVerifiedAt: Date.now() };
        }
        return "doc_id_123";
      }),
      query: vi.fn(async (path: any, args: any) => {
        if (matchesFunc(path, "getConnectionCredentials")) {
          return {
            connectionId: "conn_stripe_live_123",
            organizationId: "org_stripe_test_1",
            provider: "stripe",
            accountMode: "live",
            status: "connected",
            providerAccountId: "acct_1NZ4xX2eR9K21",
            merchantName: "Le Bistro Gourmand",
            maskedKeyId: "pk_live_••••••9K21",
            encryptedCredentials: "mock_ciphertext:iv:tag",
            connectedAt: Date.now() - 86400000,
            lastVerifiedAt: Date.now(),
          };
        }
        if (matchesFunc(path, "listConnections")) {
          return [
            {
              _id: "conn_stripe_live_123",
              organizationId: "org_stripe_test_1",
              provider: "stripe",
              status: "connected",
              connectionType: "api_key",
              accountMode: "live",
              merchantName: "Le Bistro Gourmand",
              maskedKeyId: "pk_live_••••••9K21",
              connectedAt: Date.now() - 86400000,
            },
          ];
        }
        if (matchesFunc(path, "getDashboardAnalytics")) {
          return {
            todayRevenue: { grossMinor: 245000, refundsMinor: 12000, netMinor: 233000 },
            monthlyRevenue: { grossMinor: 4820000, refundsMinor: 125000, netMinor: 4695000 },
            successfulPayments: 45,
            failedPayments: 2,
            pendingPayments: 1,
            successfulGrossMinor: 245000,
            failedGrossMinor: 8500,
            pendingGrossMinor: 3400,
            totalGrossMinor: 256900,
            refundCount: 3,
            successRate: 95.7,
            primaryCurrency: "USD",
            currencies: { USD: { todayGrossMinor: 245000, todayRefundsMinor: 12000 } },
          };
        }
        if (matchesFunc(path, "listTransactions")) {
          return {
            transactions: [
              {
                _id: "tx_1",
                providerPaymentId: "pi_3M9u7x",
                providerOrderId: "PREST-1024",
                amountMinor: 4250,
                currency: "USD",
                paymentMethod: "card",
                status: "captured",
                createdAt: Date.now() - 3600000,
              },
            ],
            total: 1,
            page: 1,
            limit: 10,
            totalPages: 1,
            hasMore: false,
          };
        }
        if (matchesFunc(path, "listRefunds")) {
          return {
            refunds: [
              {
                _id: "ref_1",
                providerRefundId: "re_9281",
                providerPaymentId: "pi_3N5b2k",
                amountMinor: 4500,
                currency: "USD",
                status: "processed",
                initiatedAt: Date.now() - 7200000,
              },
            ],
            total: 1,
            page: 1,
            limit: 10,
            totalPages: 1,
            hasMore: false,
          };
        }
        if (matchesFunc(path, "listSettlements")) {
          return {
            settlements: [
              {
                _id: "po_1",
                providerSettlementId: "po_1456",
                amountMinor: 185000,
                currency: "USD",
                netAmountMinor: 185000,
                status: "processed",
                settlementDate: Date.now(),
              },
            ],
            total: 1,
            page: 1,
            limit: 10,
            totalPages: 1,
            hasMore: false,
          };
        }
        if (matchesFunc(path, "getTransactionForRefund")) {
          return {
            connectionId: "conn_stripe_live_123",
            providerPaymentId: "pi_3M9u7x",
            amountMinor: 4250,
            refundableBalanceMinor: 4250,
            currency: "USD",
            status: "captured",
            isEligibleForRefund: true,
          };
        }
        if (matchesFunc(path, "getIntegrationHealthData")) {
          return {
            connection: {
              _id: "conn_stripe_live_123",
              status: "connected",
              connectionType: "api_key",
              accountMode: "live",
              merchantName: "Le Bistro Gourmand",
              maskedKeyId: "pk_live_••••••9K21",
              connectedAt: Date.now() - 86400000,
              lastVerifiedAt: Date.now(),
              metadata: { webhookConfigured: true, webhookSecretLast4: "8a1b" },
            },
            webhooks: { totalEvents: 10, pendingEvents: 0, failedEvents: 0, deliveryRate: 100 },
            sync: { totalRuns: 5, completedRuns: 5, failedRuns: 0, totalRecordsSynced: 120 },
          };
        }
        return null;
      }),
    };

    mockStoreAdmin.storeConvexClient = mockConvexClient;
  });

  // =========================================================================
  // 1. STRIPE PROVIDER ADAPTER KEY VALIDATION & MODE DETECTION
  // =========================================================================
  describe("1. Stripe Provider Adapter Credentials & Validation", () => {
    it("detects live vs test account mode correctly", () => {
      expect(adapter.detectAccountMode("pk_live_51M0abcdef1234567890")).toBe("live");
      expect(adapter.detectAccountMode("sk_live_51M0abcdef1234567890")).toBe("live");
      expect(adapter.detectAccountMode("rk_live_51M0abcdef1234567890")).toBe("live");
      expect(adapter.detectAccountMode("pk_test_51M0abcdef1234567890")).toBe("test");
      expect(adapter.detectAccountMode("sk_test_51M0abcdef1234567890")).toBe("test");
      expect(adapter.detectAccountMode("rk_test_51M0abcdef1234567890")).toBe("test");
    });

    it("validates proper key formats and lengths", () => {
      const liveCheck = adapter.validateKeyFormat(
        "pk_live_51M0abcdef1234567890",
        "sk_live_51M0abcdef1234567890"
      );
      expect(liveCheck.valid).toBe(true);

      const testCheck = adapter.validateKeyFormat(
        "pk_test_51M0abcdef1234567890",
        "sk_test_51M0abcdef1234567890"
      );
      expect(testCheck.valid).toBe(true);
    });

    it("rejects invalid key prefixes", () => {
      const invalidPub = adapter.validateKeyFormat("invalid_pub_key", "sk_test_12345678901234567890");
      expect(invalidPub.valid).toBe(false);
      expect(invalidPub.error).toContain("Must begin with 'pk_live_' or 'pk_test_'");

      const invalidSec = adapter.validateKeyFormat(
        "pk_test_12345678901234567890",
        "invalid_sec_key"
      );
      expect(invalidSec.valid).toBe(false);
      expect(invalidSec.error).toContain("Must begin with 'sk_live_', 'sk_test_', 'rk_live_', or 'rk_test_'");
    });

    it("rejects mismatched key environments (mixing live publishable key with test secret key)", () => {
      const mismatched = adapter.validateKeyFormat(
        "pk_live_51M0abcdef1234567890",
        "sk_test_51M0abcdef1234567890"
      );
      expect(mismatched.valid).toBe(false);
      expect(mismatched.error).toContain("Mismatched key environments");
    });

    it("normalizes Stripe error types into standard representations", () => {
      const cardError = adapter.normalizeError({
        type: "StripeCardError",
        code: "card_declined",
        message: "Your card was declined.",
      });
      expect(cardError.code).toBe("STRIPE_CARD_DECLINED");
      expect(cardError.httpStatus).toBe(402);

      const rateLimitError = adapter.normalizeError({
        type: "StripeRateLimitError",
        statusCode: 429,
      });
      expect(rateLimitError.code).toBe("STRIPE_RATE_LIMITED");
      expect(rateLimitError.httpStatus).toBe(429);
    });
  });

  // =========================================================================
  // 2. CREDENTIAL VERIFICATION API (POST /api/payments/stripe/verify)
  // =========================================================================
  describe("2. POST /api/payments/stripe/verify", () => {
    it("rejects empty body with 400 Bad Request", async () => {
      const req = new NextRequest("http://localhost/api/payments/stripe/verify", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const res = await verifyHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.code).toBe("INVALID_CREDENTIALS");
    });

    it("rejects invalid key format without external API calls", async () => {
      const req = new NextRequest("http://localhost/api/payments/stripe/verify", {
        method: "POST",
        body: JSON.stringify({
          publishableKey: "bad_key",
          secretKey: "bad_secret",
        }),
      });
      const res = await verifyHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.code).toBe("INVALID_CREDENTIALS");
    });

    it("verifies valid credentials via adapter and returns merchant profile details", async () => {
      const req = new NextRequest("http://localhost/api/payments/stripe/verify", {
        method: "POST",
        body: JSON.stringify({
          publishableKey: "pk_live_51M0abcdef1234567890",
          secretKey: "sk_live_51M0abcdef1234567890",
        }),
      });
      const res = await verifyHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.verified).toBe(true);
      expect(data.merchantName).toBe("Le Bistro Gourmand");
      expect(data.providerAccountId).toBe("acct_1NZ4xX2eR9K21");
      expect(data.accountMode).toBe("live");
    });
  });

  // =========================================================================
  // 3. ACCOUNT CONNECTION & ENCRYPTION (POST /api/payments/stripe/connect)
  // =========================================================================
  describe("3. POST /api/payments/stripe/connect", () => {
    it("rejects missing secret key with 400 Bad Request", async () => {
      const req = new NextRequest("http://localhost/api/payments/stripe/connect", {
        method: "POST",
        body: JSON.stringify({
          publishableKey: "pk_test_12345678901234567890",
        }),
      });
      const res = await connectHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.code).toBe("INVALID_CREDENTIALS");
    });

    it("connects valid credentials, persists to Convex and starts sync", async () => {
      const req = new NextRequest("http://localhost/api/payments/stripe/connect", {
        method: "POST",
        body: JSON.stringify({
          publishableKey: "pk_live_51M0abcdef1234567890",
          secretKey: "sk_live_51M0abcdef1234567890",
          webhookSecret: "whsec_1234567890123456",
        }),
      });
      const res = await connectHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.verified).toBe(true);
      expect(data.provider).toBe("stripe");
      expect(data.accountMode).toBe("live");
      expect(data.connectionId).toBe("conn_stripe_live_123");
      expect(data.initialSyncStarted).toBe(true);
    });
  });

  // =========================================================================
  // 4. STATUS & SETTINGS (GET /api/payments/stripe/status)
  // =========================================================================
  describe("4. GET /api/payments/stripe/status", () => {
    it("returns public connection information without leaking secret keys", async () => {
      const req = new NextRequest("http://localhost/api/payments/stripe/status", {
        method: "GET",
      });
      const res = await statusHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.provider).toBe("stripe");
      expect(data.data.connected).toBe(true);
      expect(data.data.maskedKeyId).toBe("pk_live_••••••9K21");
      expect(data.data.encryptedCredentials).toBeUndefined();
      expect(data.data.keySecret).toBeUndefined();
    });
  });

  // =========================================================================
  // 5. DASHBOARD ANALYTICS (GET /api/payments/stripe/dashboard)
  // =========================================================================
  describe("5. GET /api/payments/stripe/dashboard", () => {
    it("returns store-isolated payment metrics for Stripe", async () => {
      const req = new NextRequest("http://localhost/api/payments/stripe/dashboard", {
        method: "GET",
      });
      const res = await dashboardHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.metrics.todayRevenue.grossMinor).toBe(245000);
      expect(data.metrics.monthlyRevenue.grossMinor).toBe(4820000);
      expect(data.metrics.successfulPayments).toBe(45);
      expect(data.metrics.currency).toBe("USD");
      expect(data.connection.status).toBe("connected");
    });
  });

  // =========================================================================
  // 6. TRANSACTIONS API (GET /api/payments/stripe/transactions)
  // =========================================================================
  describe("6. GET /api/payments/stripe/transactions", () => {
    it("lists transactions with pagination metadata", async () => {
      const req = new NextRequest("http://localhost/api/payments/stripe/transactions?page=1&limit=10", {
        method: "GET",
      });
      const res = await transactionsHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.length).toBe(1);
      expect(data.data[0].providerPaymentId).toBe("pi_3M9u7x");
      expect(data.pagination.page).toBe(1);
    });
  });

  // =========================================================================
  // 7. REFUNDS API (GET & POST /api/payments/stripe/refunds)
  // =========================================================================
  describe("7. Refunds API", () => {
    it("GET /api/payments/stripe/refunds returns refunds list", async () => {
      const req = new NextRequest("http://localhost/api/payments/stripe/refunds", {
        method: "GET",
      });
      const res = await refundsGetHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.length).toBe(1);
      expect(data.data[0].providerRefundId).toBe("re_9281");
    });

    it("POST /api/payments/stripe/refunds rejects missing payment_id", async () => {
      const req = new NextRequest("http://localhost/api/payments/stripe/refunds", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const res = await refundsPostHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.code).toBe("INVALID_PAYMENT_ID");
    });

    it("POST /api/payments/stripe/refunds creates a valid refund with atomic reservation", async () => {
      const req = new NextRequest("http://localhost/api/payments/stripe/refunds", {
        method: "POST",
        body: JSON.stringify({
          payment_id: "pi_3M9u7x",
          amount: 4250,
          notes: { reason: "requested_by_customer" },
        }),
      });
      const res = await refundsPostHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.refund.providerRefundId).toBe("re_9281");
      expect(data.refund.amountMinor).toBe(4250);
    });
  });

  // =========================================================================
  // 8. SETTLEMENTS & ELIGIBILITY (GET & POST /api/payments/stripe/settlements)
  // =========================================================================
  describe("8. Settlements & Payouts API", () => {
    it("GET /api/payments/stripe/settlements returns payouts ledger", async () => {
      const req = new NextRequest("http://localhost/api/payments/stripe/settlements", {
        method: "GET",
      });
      const res = await settlementsGetHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.length).toBe(1);
      expect(data.data[0].providerSettlementId).toBe("po_1456");
    });

    it("GET /api/payments/stripe/settlements/eligibility returns balance and destination", async () => {
      const req = new NextRequest("http://localhost/api/payments/stripe/settlements/eligibility", {
        method: "GET",
      });
      const res = await eligibilityHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.supportsManualSettlement).toBe(true);
      expect(data.availableBalanceMinor).toBe(250000);
      expect(data.currency).toBe("USD");
    });

    it("POST /api/payments/stripe/settlements rejects invalid amount", async () => {
      const req = new NextRequest("http://localhost/api/payments/stripe/settlements", {
        method: "POST",
        body: JSON.stringify({ amountMinor: -500 }),
      });
      const res = await settlementsPostHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.code).toBe("INVALID_AMOUNT");
    });

    it("POST /api/payments/stripe/settlements creates on-demand payout", async () => {
      const req = new NextRequest("http://localhost/api/payments/stripe/settlements", {
        method: "POST",
        body: JSON.stringify({ amountMinor: 185000, currency: "USD" }),
      });
      const res = await settlementsPostHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.settlement.providerSettlementId).toBe("po_1456");
      expect(data.settlement.amountMinor).toBe(185000);
    });
  });

  // =========================================================================
  // 9. HEALTH MONITORING (GET /api/payments/stripe/health)
  // =========================================================================
  describe("9. GET /api/payments/stripe/health", () => {
    it("returns complete health telemetry across connection, API, webhooks and sync", async () => {
      const req = new NextRequest("http://localhost/api/payments/stripe/health", {
        method: "GET",
      });
      const res = await healthHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.provider).toBe("stripe");
      expect(data.connection.connected).toBe(true);
      expect(data.webhooks.configured).toBe(true);
      expect(data.sync.status).toBe("healthy");
    });
  });

  // =========================================================================
  // 10. DISCONNECT & RECONNECT LIFECYCLE
  // =========================================================================
  describe("10. Gateway Lifecycle: Disconnect & Reconnect", () => {
    it("disconnects gateway while preserving data", async () => {
      const req = new NextRequest("http://localhost/api/payments/stripe/disconnect", {
        method: "POST",
        body: JSON.stringify({ connectionId: "conn_stripe_live_123" }),
      });
      const res = await disconnectHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe("disconnected");
      expect(data.data.historicalDataPreserved).toBe(true);
    });

    it("reconnects gateway after verifying credentials", async () => {
      const req = new NextRequest("http://localhost/api/payments/stripe/reconnect", {
        method: "POST",
        body: JSON.stringify({ connectionId: "conn_stripe_live_123" }),
      });
      const res = await reconnectHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe("connected");
    });
  });
});
