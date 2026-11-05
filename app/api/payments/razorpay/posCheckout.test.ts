import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as createOrderHandler } from "./order/create/route";
import { POST as verifyOrderHandler } from "./order/verify/route";

const mockStoreAdmin = {
  userId: "user_test_cashier",
  storeId: "store_test_pos",
  orgId: "org_test_pos_1" as any,
  role: "org:admin",
  storeConvexClient: null as any,
};

vi.mock("../../../lib/payments/authHelper", () => ({
  requireStoreAdminContext: vi.fn(async () => mockStoreAdmin),
  getStoreAdminContext: vi.fn(async () => mockStoreAdmin),
}));

vi.mock("../../../../convex/paymentGatewayCrypto", () => ({
  decryptCredentials: vi.fn(async () => ({
    keyId: "rzp_test_checkout123",
    keySecret: "secret_checkout_secret_456",
  })),
}));

const mockAdapter = {
  provider: "razorpay",
  createPaymentOrder: vi.fn(),
  verifyPaymentSignature: vi.fn(),
  fetchPayment: vi.fn(),
};

vi.mock("../../../lib/payments/registry", () => ({
  getPaymentAdapter: vi.fn(() => mockAdapter),
}));

describe("PART 7 & PART 12.E — POS PAYMENT INTEGRATION SUITE", () => {
  let mockConvexClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConvexClient = {
      query: vi.fn(async (_path: any, _args: any) => ({
        _id: "conn_pos_active",
        status: "connected",
        encryptedCredentials: "mockEncryptedPayload",
      })),
      mutation: vi.fn(async (_path: any, _args: any) => ({
        transactionId: "tx_recorded_999",
        alreadyExists: false,
      })),
    };
    mockStoreAdmin.storeConvexClient = mockConvexClient;
  });

  describe("1. POST /api/payments/razorpay/order/create", () => {
    it("creates a Razorpay order from internal POS order and returns safe checkout details", async () => {
      mockAdapter.createPaymentOrder.mockResolvedValueOnce({
        success: true,
        orderId: "order_rzp_mock_12345",
        amountMinor: 450000, // ₹4,500.00
        currency: "INR",
        receipt: "rcpt_pos_123",
        providerStatus: "created",
      });

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/order/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountMinor: 450000,
          currency: "INR",
          internalOrderId: "order_pos_internal_789",
        }),
      });

      const res = await createOrderHandler(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.orderId).toBe("order_rzp_mock_12345");
      expect(body.amountMinor).toBe(450000);
      expect(body.currency).toBe("INR");
      expect(body.keyId).toBe("rzp_test_checkout123");
      expect(body.internalOrderId).toBe("order_pos_internal_789");

      // Zero secrets exposed in checkout response
      expect(body.keySecret).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain("secret_checkout_secret_456");
    });

    it("rejects non-positive minor unit amounts", async () => {
      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/order/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountMinor: 0,
          currency: "INR",
        }),
      });

      const res = await createOrderHandler(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.code).toBe("INVALID_AMOUNT");
    });
  });

  describe("2. POST /api/payments/razorpay/order/verify", () => {
    it("verifies server-side signature and records payment in payment_transactions", async () => {
      mockAdapter.verifyPaymentSignature.mockReturnValueOnce(true);
      mockAdapter.fetchPayment.mockResolvedValueOnce({
        providerPaymentId: "pay_live_test_777",
        providerOrderId: "order_rzp_mock_12345",
        amountMinor: 450000,
        currency: "INR",
        paymentMethod: "upi",
        status: "captured",
        providerStatus: "captured",
        paidAt: 1700000000000,
      });

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/order/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpayOrderId: "order_rzp_mock_12345",
          razorpayPaymentId: "pay_live_test_777",
          razorpaySignature: "valid_signature_hash_hex_123",
          internalOrderId: "order_pos_internal_789",
        }),
      });

      const res = await verifyOrderHandler(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.verified).toBe(true);
      expect(body.providerPaymentId).toBe("pay_live_test_777");
      expect(body.status).toBe("captured");
      expect(body.transactionId).toBe("tx_recorded_999");

      // Verify transaction recorded in Convex
      expect(mockConvexClient.mutation).toHaveBeenCalledTimes(1);
      const recordArgs = mockConvexClient.mutation.mock.calls[0][1];
      expect(recordArgs.providerPaymentId).toBe("pay_live_test_777");
      expect(recordArgs.providerOrderId).toBe("order_rzp_mock_12345");
      expect(recordArgs.status).toBe("captured");
      expect(recordArgs.amountMinor).toBe(450000);
    });

    it("rejects untrusted callbacks with invalid HMAC signature", async () => {
      mockAdapter.verifyPaymentSignature.mockReturnValueOnce(false);

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/order/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpayOrderId: "order_rzp_mock_12345",
          razorpayPaymentId: "pay_fake_tampered_999",
          razorpaySignature: "tampered_fake_signature",
        }),
      });

      const res = await verifyOrderHandler(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.code).toBe("INVALID_SIGNATURE");
      expect(mockConvexClient.mutation).not.toHaveBeenCalled();
    });
  });
});

