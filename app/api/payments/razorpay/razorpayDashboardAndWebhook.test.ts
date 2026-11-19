import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { GET as getDashboardRoute } from "./dashboard/route";
import { POST as postWebhookRoute } from "./webhook/route";

// Mock authHelper
const mockStoreAdmin = {
  userId: "user_test_admin_analytics",
  storeId: "store_test_gts",
  orgId: "org_test_gts_1" as any,
  role: "org:admin",
  organizationTimeZone: "Asia/Kolkata",
  storeConvexClient: null as any,
};

vi.mock("../../../lib/payments/authHelper", () => ({
  requireStoreAdminContext: vi.fn(async () => mockStoreAdmin),
  getStoreAdminContext: vi.fn(async () => mockStoreAdmin),
}));

// Mock ConvexHttpClient
let mockConvexClient: any;
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = vi.fn((fn, args) => mockConvexClient.query(fn, args));
    mutation = vi.fn((fn, args) => mockConvexClient.mutation(fn, args));
    setAuth = vi.fn();
  },
}));

describe("RAZORPAY DASHBOARD ANALYTICS & WEBHOOK INTEGRATION SUITE", () => {
  const webhookSecret = "whsec_test_secret_123456789";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;
    (process.env as any).NODE_ENV = "development";
  });

  function generateSignature(body: string, secret = webhookSecret): string {
    return crypto.createHmac("sha256", secret).update(body).digest("hex");
  }

  // =========================================================================
  // 1. WEBHOOK SIGNATURE VERIFICATION TESTS
  // =========================================================================
  describe("1. Razorpay Webhook Signature Verification", () => {
    it("accepts valid HMAC-SHA256 signature matching the exact raw body", async () => {
      const payloadObj = {
        event: "payment.captured",
        id: "evt_valid_1",
        payload: {
          payment: {
            entity: {
              id: "pay_valid_1",
              amount: 50000,
              currency: "INR",
              status: "captured",
              created_at: 1700000000,
            },
          },
        },
      };
      const rawBody = JSON.stringify(payloadObj);
      const signature = generateSignature(rawBody);

      mockConvexClient = {
        query: vi.fn().mockResolvedValue([]),
        mutation: vi.fn().mockResolvedValue({
          eventId: "webhook_evt_1",
          alreadyProcessed: false,
          status: "processed",
        }),
      };

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": signature,
        },
        body: rawBody,
      });

      const res = await postWebhookRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.received).toBe(true);
      expect(json.eventId).toBe("webhook_evt_1");
    });

    it("rejects invalid HMAC-SHA256 signature with HTTP 400", async () => {
      const rawBody = JSON.stringify({ event: "payment.captured" });
      const badSignature = "a".repeat(64);

      mockConvexClient = {
        query: vi.fn().mockResolvedValue([]),
        mutation: vi.fn(),
      };

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": badSignature,
        },
        body: rawBody,
      });

      const res = await postWebhookRoute(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/invalid.*signature/i);
    });

    it("rejects request when signature header is missing and secret is set", async () => {
      const rawBody = JSON.stringify({ event: "payment.captured" });

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: rawBody,
      });

      const res = await postWebhookRoute(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/invalid.*signature/i);
    });

    it("detects payload tampering: modified raw body fails verification", async () => {
      const originalPayload = JSON.stringify({ event: "payment.captured", amount: 1000 });
      const signature = generateSignature(originalPayload);
      const tamperedBody = JSON.stringify({ event: "payment.captured", amount: 999999 });

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": signature,
        },
        body: tamperedBody,
      });

      const res = await postWebhookRoute(req);
      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // 2. WEBHOOK EVENT HANDLERS & DEDUPLICATION
  // =========================================================================
  describe("2. Webhook Event Handlers & Idempotency", () => {
    it("handles payment.captured event and records mutation", async () => {
      const payloadObj = {
        event: "payment.captured",
        id: "evt_captured_99",
        payload: {
          payment: {
            entity: {
              id: "pay_captured_99",
              amount: 75000,
              currency: "INR",
              status: "captured",
              method: "upi",
              email: "customer@upi.com",
              contact: "+919876543210",
              created_at: 1700000000,
            },
          },
        },
      };
      const rawBody = JSON.stringify(payloadObj);
      const signature = generateSignature(rawBody);

      let mutationArgs: any;
      mockConvexClient = {
        query: vi.fn().mockResolvedValue([]),
        mutation: vi.fn(async (_fn, args) => {
          mutationArgs = args;
          return { eventId: "evt_captured_doc_1", alreadyProcessed: false, status: "processed" };
        }),
      };

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": signature,
        },
        body: rawBody,
      });

      const res = await postWebhookRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mutationArgs.provider).toBe("razorpay");
      expect(mutationArgs.eventType).toBe("payment.captured");
      expect(mutationArgs.providerEventId).toBe("evt_captured_99");
    });

    it("handles refund.created / refund.processed event", async () => {
      const payloadObj = {
        event: "refund.processed",
        id: "evt_ref_88",
        payload: {
          refund: {
            entity: {
              id: "rfnd_88",
              payment_id: "pay_captured_99",
              amount: 25000,
              currency: "INR",
              status: "processed",
              speed_processed: "optimum",
              created_at: 1700001000,
            },
          },
        },
      };
      const rawBody = JSON.stringify(payloadObj);
      const signature = generateSignature(rawBody);

      let mutationArgs: any;
      mockConvexClient = {
        query: vi.fn().mockResolvedValue([]),
        mutation: vi.fn(async (_fn, args) => {
          mutationArgs = args;
          return { eventId: "evt_ref_doc_88", alreadyProcessed: false, status: "processed" };
        }),
      };

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": signature,
        },
        body: rawBody,
      });

      const res = await postWebhookRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mutationArgs.eventType).toBe("refund.processed");
      expect(mutationArgs.providerEventId).toBe("evt_ref_88");
    });

    it("handles settlement.processed event", async () => {
      const payloadObj = {
        event: "settlement.processed",
        id: "evt_stl_77",
        payload: {
          settlement: {
            entity: {
              id: "setl_77",
              amount: 1000000,
              currency: "INR",
              fees: 2000,
              tax: 360,
              status: "processed",
              utr: "UTR987654321",
              created_at: 1700002000,
            },
          },
        },
      };
      const rawBody = JSON.stringify(payloadObj);
      const signature = generateSignature(rawBody);

      let mutationArgs: any;
      mockConvexClient = {
        query: vi.fn().mockResolvedValue([]),
        mutation: vi.fn(async (_fn, args) => {
          mutationArgs = args;
          return { eventId: "evt_stl_doc_77", alreadyProcessed: false, status: "processed" };
        }),
      };

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": signature,
        },
        body: rawBody,
      });

      const res = await postWebhookRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mutationArgs.eventType).toBe("settlement.processed");
      expect(json.eventId).toBe("evt_stl_doc_77");
    });

    it("idempotently handles duplicate webhooks without re-executing", async () => {
      const payloadObj = {
        event: "payment.captured",
        id: "evt_duplicate_55",
        payload: { payment: { entity: { id: "pay_dup_55", amount: 1000 } } },
      };
      const rawBody = JSON.stringify(payloadObj);
      const signature = generateSignature(rawBody);

      mockConvexClient = {
        query: vi.fn().mockResolvedValue([]),
        mutation: vi.fn().mockResolvedValue({
          eventId: "evt_existing_doc_55",
          alreadyProcessed: true,
          status: "processed",
        }),
      };

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": signature,
        },
        body: rawBody,
      });

      const res = await postWebhookRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.duplicate).toBe(true);
      expect(json.eventId).toBe("evt_existing_doc_55");
    });

    it("gracefully ignores unsupported webhook events with HTTP 200", async () => {
      const payloadObj = {
        event: "dummy.unsupported.event",
        id: "evt_unsupported_1",
        payload: {},
      };
      const rawBody = JSON.stringify(payloadObj);
      const signature = generateSignature(rawBody);

      mockConvexClient = {
        query: vi.fn().mockResolvedValue([]),
        mutation: vi.fn().mockResolvedValue({
          eventId: "evt_ignored_doc_1",
          alreadyProcessed: false,
          status: "ignored",
        }),
      };

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": signature,
        },
        body: rawBody,
      });

      const res = await postWebhookRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.status).toBe("ignored");
    });
  });

  // =========================================================================
  // 3. DASHBOARD ANALYTICS API TESTS
  // =========================================================================
  describe("3. GET /api/payments/razorpay/dashboard Analytics API", () => {
    it("returns all 6 required dashboard metrics formatted correctly", async () => {
      const mockConnection = {
        connectionId: "conn_rzp_live_1",
        status: "connected",
        accountMode: "live",
        merchantName: "Acme Gourmet Cafe",
        maskedKeyId: "rzp_live_xxxx...",
        connectedAt: 1690000000,
        metadata: { timezone: "Asia/Kolkata" },
      };

      const mockAnalytics = {
        organizationId: "org_test_gts_1",
        primaryCurrency: "INR",
        todayRevenue: {
          grossMinor: 1500000, // ₹15,000.00
          refundsMinor: 200000, // ₹2,000.00
          netMinor: 1300000, // ₹13,000.00
          currency: "INR",
        },
        monthlyRevenue: {
          grossMinor: 45000000, // ₹450,000.00
          refundsMinor: 1500000, // ₹15,000.00
          netMinor: 43500000, // ₹435,000.00
          currency: "INR",
        },
        successfulPayments: 120,
        failedPayments: 5,
        pendingPayments: 3,
        refundCount: 2,
        successRate: 96.0,
        currencies: {
          INR: {
            todayGrossMinor: 1500000,
            todayRefundsMinor: 200000,
            monthGrossMinor: 45000000,
            monthRefundsMinor: 1500000,
            successfulPayments: 120,
            failedPayments: 5,
            pendingPayments: 3,
          },
        },
      };

      mockStoreAdmin.storeConvexClient = {
        query: vi.fn(async (_fn, args) => {
          if (args?.startOfTodayMs !== undefined) {
            return mockAnalytics;
          }
          if (args?.provider === "razorpay") {
            return mockConnection;
          }
          return null;
        }),
      };

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/dashboard");
      const res = await getDashboardRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);

      // Verify all 6 metrics
      const { metrics } = json;
      expect(metrics.todayRevenue.grossMinor).toBe(1500000);
      expect(metrics.todayRevenue.refundsMinor).toBe(200000);
      expect(metrics.todayRevenue.netMinor).toBe(1300000);
      expect(metrics.todayRevenue.formattedNet).toContain("13,000");

      expect(metrics.monthlyRevenue.grossMinor).toBe(45000000);
      expect(metrics.monthlyRevenue.refundsMinor).toBe(1500000);
      expect(metrics.monthlyRevenue.netMinor).toBe(43500000);
      expect(metrics.monthlyRevenue.formattedNet).toContain("4,35,000");

      expect(metrics.successfulPayments).toBe(120);
      expect(metrics.failedPayments).toBe(5);
      expect(metrics.pendingPayments).toBe(3);
      expect(metrics.refundCount).toBe(2);
      expect(metrics.successRate).toBe(96.0);

      expect(json.timezone).toBe("Asia/Kolkata");
      expect(json.boundaries.startOfToday).toBeDefined();
      expect(json.boundaries.endOfToday).toBeDefined();
    });

    it("returns 404 when store has no connected Razorpay account", async () => {
      mockStoreAdmin.storeConvexClient = {
        query: vi.fn(async () => null),
      };

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/dashboard");
      const res = await getDashboardRoute(req);
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.code).toBe("CONNECTION_NOT_FOUND");
    });
  });
});
