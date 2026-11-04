import { describe, it, expect, vi, beforeEach } from "vitest";
import { RazorpayProviderAdapter } from "../../../lib/payments/adapters/RazorpayProviderAdapter";
import { PaymentSyncEngine } from "../../../lib/payments/syncEngine";
import { GET as getTransactionsRoute } from "./transactions/route";
import { GET as getRefundsRoute, POST as postRefundsRoute } from "./refunds/route";
import { GET as getSettlementsRoute } from "./settlements/route";
import { NextRequest } from "next/server";

// Mock authHelper
const mockStoreAdmin = {
  userId: "user_test_admin_1",
  storeId: "store_test_gts",
  orgId: "org_test_gts_1" as any,
  role: "org:admin",
  storeConvexClient: null as any,
};

vi.mock("../../../lib/payments/authHelper", () => ({
  requireStoreAdminContext: vi.fn(async () => mockStoreAdmin),
  getStoreAdminContext: vi.fn(async () => mockStoreAdmin),
}));

// Mock credential decryption
vi.mock("../../../../convex/paymentGatewayCrypto", () => ({
  decryptCredentials: vi.fn(async () => ({
    keyId: "rzp_test_validKey123",
    keySecret: "validSecret456789",
  })),
  maskKeyIdentifier: vi.fn((key) => key ? `${key.slice(0, 8)}...` : undefined),
}));

describe("RAZORPAY TRANSACTIONS, REFUNDS & SETTLEMENTS SUITE", () => {
  const credentials = {
    keyId: "rzp_test_ABC1234567890",
    keySecret: "secretKeyXYZ123456",
  };

  let adapter: RazorpayProviderAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new RazorpayProviderAdapter("https://api.razorpay.com/v1");
  });

  // =========================================================================
  // 1. ADAPTER UNIT TESTS (TRANSACTIONS, REFUNDS, SETTLEMENTS)
  // =========================================================================

  describe("1. Adapter Payments / Transactions Fetching", () => {
    it("fetches payments with count, skip, and date filters", async () => {
      const mockPayments = {
        entity: "collection",
        count: 2,
        items: [
          {
            id: "pay_TXN001",
            entity: "payment",
            amount: 15000,
            currency: "INR",
            status: "captured",
            method: "upi",
            email: "alice@test.com",
            contact: "+919999999999",
            created_at: 1700000000,
            amount_refunded: 0,
            captured: true,
          },
          {
            id: "pay_TXN002",
            entity: "payment",
            amount: 25000,
            currency: "INR",
            status: "captured",
            method: "card",
            email: "bob@test.com",
            created_at: 1700001000,
            amount_refunded: 5000,
            captured: true,
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockPayments,
      } as any);

      const result = await adapter.fetchTransactions(credentials, {
        count: 10,
        skip: 0,
        from: 1699990000,
        to: 1700002000,
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0].providerPaymentId).toBe("pay_TXN001");
      expect(result.items[0].amountMinor).toBe(15000); // 15000 paise = ₹150
      expect(result.items[0].status).toBe("captured");
      expect(result.items[0].paymentMethod).toBe("upi");

      // Check partially refunded status mapping
      expect(result.items[1].providerPaymentId).toBe("pay_TXN002");
      expect(result.items[1].status).toBe("partially_refunded");
      expect(result.items[1].refundedAmountMinor).toBe(5000);
    });

    it("handles Razorpay API errors when fetching payments", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { description: "Invalid API credentials" } }),
      } as any);

      await expect(adapter.fetchTransactions(credentials)).rejects.toThrow(
        "RAZORPAY_API_ERROR: 401 - Invalid API credentials"
      );
    });
  });

  describe("2. Adapter Refunds Fetching and Creation", () => {
    it("fetches refunds with payment filter", async () => {
      const mockRefunds = {
        entity: "collection",
        count: 1,
        items: [
          {
            id: "rfnd_001",
            entity: "refund",
            amount: 5000,
            currency: "INR",
            payment_id: "pay_TXN002",
            status: "processed",
            speed_processed: "normal",
            created_at: 1700001500,
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockRefunds,
      } as any);

      const result = await adapter.fetchRefunds(credentials, {
        paymentId: "pay_TXN002",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].providerRefundId).toBe("rfnd_001");
      expect(result.items[0].providerPaymentId).toBe("pay_TXN002");
      expect(result.items[0].amountMinor).toBe(5000);
      expect(result.items[0].status).toBe("processed");
    });

    it("creates a refund successfully with exact minor amount", async () => {
      const mockRefundResp = {
        id: "rfnd_NEW_001",
        entity: "refund",
        amount: 3000,
        currency: "INR",
        payment_id: "pay_TXN001",
        status: "processed",
        speed_processed: "normal",
        created_at: 1700003000,
        notes: { reason: "Customer request" },
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockRefundResp,
      } as any);

      const result = await adapter.createRefund(credentials, "pay_TXN001", {
        amount: 3000,
        speed: "normal",
        notes: { reason: "Customer request" },
      });

      expect(result.providerRefundId).toBe("rfnd_NEW_001");
      expect(result.amountMinor).toBe(3000);
      expect(result.status).toBe("processed");
      expect(result.reason).toBe("Customer request");
    });

    it("rejects invalid refund amounts", async () => {
      await expect(
        adapter.createRefund(credentials, "pay_TXN001", { amount: -500 })
      ).rejects.toThrow("INVALID_REFUND_AMOUNT");

      await expect(
        adapter.createRefund(credentials, "pay_TXN001", { amount: 15.5 })
      ).rejects.toThrow("INVALID_REFUND_AMOUNT");
    });
  });

  describe("3. Adapter Settlements Fetching", () => {
    it("fetches settlements with UTR and fee deduction details", async () => {
      const mockSettlements = {
        entity: "collection",
        count: 1,
        items: [
          {
            id: "setl_001",
            entity: "settlement",
            amount: 100000,
            status: "processed",
            fees: 2000,
            tax: 360,
            utr: "UTR_BANK_REF_999",
            created_at: 1700005000,
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSettlements,
      } as any);

      const result = await adapter.fetchSettlements(credentials);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].providerSettlementId).toBe("setl_001");
      expect(result.items[0].amountMinor).toBe(100000);
      expect(result.items[0].feesMinor).toBe(2000);
      expect(result.items[0].taxMinor).toBe(360);
      expect(result.items[0].netAmountMinor).toBe(97640);
      expect(result.items[0].utrOrReference).toBe("UTR_BANK_REF_999");
      expect(result.items[0].status).toBe("processed");
    });

    it("handles missing UTR gracefully without inventing values", async () => {
      const mockSettlements = {
        entity: "collection",
        count: 1,
        items: [
          {
            id: "setl_002",
            entity: "settlement",
            amount: 50000,
            status: "pending",
            created_at: 1700006000,
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSettlements,
      } as any);

      const result = await adapter.fetchSettlements(credentials);
      expect(result.items[0].utrOrReference).toBeUndefined();
      expect(result.items[0].status).toBe("pending");
    });
  });

  // =========================================================================
  // 4. SYNCHRONIZATION ENGINE TESTS
  // =========================================================================

  describe("4. Synchronization Engine Lifecycle", () => {
    it("executes incremental transaction sync and updates cursor", async () => {
      const recordedRuns: any[] = [];
      const recordedCursors: any[] = [];
      const recordedTransactions: any[] = [];

      const mockConvexClient = {
        query: vi.fn(async (queryFn, args) => {
          return {
            cursors: [{ resourceType: "transactions", lastSuccessfulSyncAt: 1700000000000 }],
          };
        }),
        mutation: vi.fn(async (mutationFn, args) => {
          if (args.providerPaymentId) {
            recordedTransactions.push(args);
            return { transactionId: "txn_123", alreadyExists: false };
          }
          if (args.resourceType && args.lastSuccessfulSyncAt) {
            recordedCursors.push(args);
            return "cursor_123";
          }
          if (args.resourceType && args.syncType) {
            recordedRuns.push(args);
            return "run_123";
          }
          return {};
        }),
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          entity: "collection",
          count: 1,
          items: [
            {
              id: "pay_SYNC_1",
              amount: 50000,
              currency: "INR",
              status: "captured",
              method: "upi",
              created_at: 1700001000,
              captured: true,
            },
          ],
        }),
      } as any);

      const result = await PaymentSyncEngine.syncTransactions({
        convexClient: mockConvexClient,
        connectionId: "conn_123" as any,
        adapter,
        credentials,
        syncType: "incremental",
      });

      expect(result.status).toBe("completed");
      expect(result.recordsFetched).toBe(1);
      expect(result.recordsCreated).toBe(1);
      expect(recordedTransactions).toHaveLength(1);
      expect(recordedTransactions[0].providerPaymentId).toBe("pay_SYNC_1");
      expect(recordedCursors).toHaveLength(1);
      expect(recordedRuns).toHaveLength(1);
      expect(recordedRuns[0].status).toBe("completed");
    });

    it("prevents duplicate concurrent synchronizations using in-process lock", async () => {
      const mockConvexClient = {
        query: vi.fn(async () => ({ cursors: [] })),
        mutation: vi.fn(async () => ({})),
      };

      let resolveFetch: any;
      const slowFetch = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      globalThis.fetch = vi.fn().mockReturnValueOnce(
        slowFetch.then(() => ({
          ok: true,
          status: 200,
          json: async () => ({ entity: "collection", count: 0, items: [] }),
        }))
      );

      // Start first sync
      const firstSyncPromise = PaymentSyncEngine.syncTransactions({
        convexClient: mockConvexClient,
        connectionId: "conn_concurrency_test" as any,
        adapter,
        credentials,
      });

      // Attempt second sync concurrently while first is in flight
      const secondSyncResult = await PaymentSyncEngine.syncTransactions({
        convexClient: mockConvexClient,
        connectionId: "conn_concurrency_test" as any,
        adapter,
        credentials,
      });

      expect(secondSyncResult.status).toBe("skipped");

      resolveFetch();
      const firstSyncResult = await firstSyncPromise;
      expect(firstSyncResult.status).toBe("completed");
    });
  });

  // =========================================================================
  // 5. NEXT.JS HTTP ROUTE HANDLER TESTS
  // =========================================================================

  describe("5. HTTP API Routes", () => {
    it("GET /api/payments/razorpay/transactions returns paginated normalized records", async () => {
      const mockTxns = [
        {
          _id: "txn_1",
          providerPaymentId: "pay_001",
          amountMinor: 12000,
          currency: "INR",
          status: "captured",
          paymentMethod: "upi",
          createdAt: 1700000000000,
        },
      ];

      mockStoreAdmin.storeConvexClient = {
        query: vi.fn(async (fn, args) => {
          if (args.provider === "razorpay") {
            return {
              connectionId: "conn_1",
              status: "connected",
              provider: "razorpay",
              encryptedCredentials: "mockCiphertext",
              encryptionKeyVersion: 1,
            };
          }
          return {
            transactions: mockTxns,
            total: 1,
            page: 1,
            limit: 10,
            hasMore: false,
          };
        }),
      };

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/transactions?page=1&limit=10");
      const res = await getTransactionsRoute(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.transactions).toHaveLength(1);
      expect(data.transactions[0].providerPaymentId).toBe("pay_001");
      expect(data.pagination.total).toBe(1);
    });

    it("POST /api/payments/razorpay/refunds creates a partial refund with balance validation", async () => {
      mockStoreAdmin.storeConvexClient = {
        query: vi.fn(async (fn, args) => {
          if (args.providerPaymentId) {
            return {
              transactionId: "txn_1",
              connectionId: "conn_1",
              provider: "razorpay",
              providerPaymentId: "pay_ELIGIBLE_1",
              amountMinor: 10000, // ₹100
              refundedAmountMinor: 2000, // ₹20 previously refunded
              refundableBalanceMinor: 8000, // ₹80 remaining
              status: "partially_refunded",
              isEligibleForRefund: true,
            };
          }
          return {
            connectionId: "conn_1",
            status: "connected",
            encryptedCredentials: "mockCiphertext",
            encryptionKeyVersion: 1,
          };
        }),
        mutation: vi.fn(async () => ({ refundId: "rfnd_record_123" })),
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: "rfnd_RZP_999",
          payment_id: "pay_ELIGIBLE_1",
          amount: 5000, // ₹50
          currency: "INR",
          status: "processed",
          created_at: 1700000000,
        }),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/refunds", {
        method: "POST",
        body: JSON.stringify({
          payment_id: "pay_ELIGIBLE_1",
          amount: 5000, // ₹50 minor units
          speed: "normal",
        }),
      });

      const res = await postRefundsRoute(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.refund.providerRefundId).toBe("rfnd_RZP_999");
      expect(data.refund.amountMinor).toBe(5000);
    });

    it("POST /api/payments/razorpay/refunds rejects amounts exceeding balance", async () => {
      mockStoreAdmin.storeConvexClient = {
        query: vi.fn(async () => ({
          transactionId: "txn_1",
          providerPaymentId: "pay_EXCEED",
          amountMinor: 10000,
          refundedAmountMinor: 8000,
          refundableBalanceMinor: 2000, // Only ₹20 remaining
          status: "partially_refunded",
          isEligibleForRefund: true,
        })),
      };

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/refunds", {
        method: "POST",
        body: JSON.stringify({
          payment_id: "pay_EXCEED",
          amount: 5000, // Requesting ₹50 when only ₹20 is left
        }),
      });

      const res = await postRefundsRoute(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.code).toBe("REFUND_AMOUNT_EXCEEDS_BALANCE");
    });

    it("GET /api/payments/razorpay/settlements returns settlements list", async () => {
      const mockSettlements = [
        {
          _id: "setl_1",
          providerSettlementId: "setl_ABC",
          amountMinor: 95000,
          currency: "INR",
          status: "processed",
          settlementDate: 1700000000000,
          utrOrReference: "UTR_TEST_1",
        },
      ];

      mockStoreAdmin.storeConvexClient = {
        query: vi.fn(async (fn, args) => {
          if (args.provider === "razorpay") {
            return {
              connectionId: "conn_1",
              status: "connected",
            };
          }
          return {
            settlements: mockSettlements,
            total: 1,
            page: 1,
            limit: 10,
            hasMore: false,
          };
        }),
      };

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/settlements?page=1&limit=10");
      const res = await getSettlementsRoute(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.settlements).toHaveLength(1);
      expect(data.settlements[0].providerSettlementId).toBe("setl_ABC");
    });
  });
});
