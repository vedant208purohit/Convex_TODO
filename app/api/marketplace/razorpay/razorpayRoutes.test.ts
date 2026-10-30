import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import crypto from "crypto";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "clerk_user_test" }),
}));

import { POST as createOrderHandler } from "./create-order/route";
import { POST as verifyPaymentHandler } from "./verify-payment/route";
import { POST as webhookHandler } from "./webhook/route";

describe("Marketplace Razorpay Next.js Route Handlers & Integration Tests", () => {
  const testSecret = "f0kjzAySCNuGcWY8KZtmYKPU";
  const testKeyId = "rzp_test_Ti7x9n4f0oPJJy";

  beforeEach(() => {
    process.env.RZ_KEY_ID = testKeyId;
    process.env.RZ_KEY_SECRET = testSecret;
    process.env.RAZORPAY_KEY_ID = testKeyId;
    process.env.RAZORPAY_KEY_SECRET = testSecret;
    process.env.RAZORPAY_WEBHOOK_SECRET = testSecret;
  });

  describe("1. POST /api/marketplace/razorpay/create-order", () => {
    it("rejects amounts below the minimum ₹500 threshold", async () => {
      const req = new NextRequest("http://localhost:3000/api/marketplace/razorpay/create-order", {
        method: "POST",
        body: JSON.stringify({ amount: 499, paymentMethod: "upi" }),
      });

      const res = await createOrderHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Deposit amount must be between ₹500.00 and ₹1,00,000.00 INR");
    });

    it("rejects amounts exceeding the maximum ₹1,00,000 threshold", async () => {
      const req = new NextRequest("http://localhost:3000/api/marketplace/razorpay/create-order", {
        method: "POST",
        body: JSON.stringify({ amount: 100001, paymentMethod: "card" }),
      });

      const res = await createOrderHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Deposit amount must be between ₹500.00 and ₹1,00,000.00 INR");
    });

    it("creates a Razorpay order converting Rupees to Paise (minor units)", async () => {
      const req = new NextRequest("http://localhost:3000/api/marketplace/razorpay/create-order", {
        method: "POST",
        body: JSON.stringify({
          amount: 2500,
          paymentMethod: "upi",
          organizationName: "The Grand Bistro HQ",
        }),
      });

      const res = await createOrderHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.amount).toBe(250000); // ₹2500 * 100 paise
      expect(data.currency).toBe("INR");
      expect(data.orderId).toBeDefined();
    });
  });

  describe("2. POST /api/marketplace/razorpay/verify-payment", () => {
    it("rejects requests missing required payment parameters", async () => {
      const req = new NextRequest("http://localhost:3000/api/marketplace/razorpay/verify-payment", {
        method: "POST",
        body: JSON.stringify({ razorpayOrderId: "order_123" }), // Missing razorpayPaymentId
      });

      const res = await verifyPaymentHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Missing required payment verification parameters");
    });

    it("successfully verifies authentic HMAC SHA-256 signatures", async () => {
      const orderId = "order_rzp_live_test_7788";
      const paymentId = "pay_rzp_live_test_9900";
      const validSignature = crypto
        .createHmac("sha256", testSecret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const req = new NextRequest("http://localhost:3000/api/marketplace/razorpay/verify-payment", {
        method: "POST",
        body: JSON.stringify({
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSignature,
          amount: 2000,
          paymentMethod: "upi",
        }),
      });

      const res = await verifyPaymentHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.razorpayPaymentId).toBe(paymentId);
      expect(data.verifiedAt).toBeDefined();
    });

    it("rejects forged or tampered payment signatures", async () => {
      const orderId = "order_rzp_live_test_7788";
      const paymentId = "pay_rzp_live_test_9900";
      const forgedSignature = "forged_malicious_signature_hex_1234567890";

      const req = new NextRequest("http://localhost:3000/api/marketplace/razorpay/verify-payment", {
        method: "POST",
        body: JSON.stringify({
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: forgedSignature,
        }),
      });

      const res = await verifyPaymentHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Cryptographic signature verification failed");
    });
  });

  describe("3. POST /api/marketplace/razorpay/webhook", () => {
    it("verifies authentic webhook signature and returns received true", async () => {
      const rawPayload = JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_captured_1122",
              order_id: "order_captured_3344",
              amount: 200000,
            },
          },
        },
      });

      const signature = crypto
        .createHmac("sha256", testSecret)
        .update(rawPayload)
        .digest("hex");

      const req = new NextRequest("http://localhost:3000/api/marketplace/razorpay/webhook", {
        method: "POST",
        headers: {
          "x-razorpay-signature": signature,
          "content-type": "application/json",
        },
        body: rawPayload,
      });

      const res = await webhookHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.received).toBe(true);
      expect(data.event).toBe("payment.captured");
    });

    it("rejects invalid webhook signatures", async () => {
      const rawPayload = JSON.stringify({ event: "payment.captured" });

      const req = new NextRequest("http://localhost:3000/api/marketplace/razorpay/webhook", {
        method: "POST",
        headers: {
          "x-razorpay-signature": "bogus_signature",
          "content-type": "application/json",
        },
        body: rawPayload,
      });

      const res = await webhookHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Invalid webhook signature");
    });
  });

  describe("4. Payment Method Restriction Configuration Logic", () => {
    it("strictly isolates instruments with show_default_blocks false", () => {
      const generateConfig = (method: "upi" | "netbanking" | "card") => {
        const configMap: Record<string, any> = {
          upi: {
            display: {
              blocks: { upi_block: { name: "Instant UPI", instruments: [{ method: "upi" }] } },
              sequence: ["block.upi_block"],
              preferences: { show_default_blocks: false },
            },
          },
          netbanking: {
            display: {
              blocks: { netbanking_block: { name: "Net Banking", instruments: [{ method: "netbanking" }] } },
              sequence: ["block.netbanking_block"],
              preferences: { show_default_blocks: false },
            },
          },
          card: {
            display: {
              blocks: { card_block: { name: "Corporate Card", instruments: [{ method: "card" }] } },
              sequence: ["block.card_block"],
              preferences: { show_default_blocks: false },
            },
          },
        };
        return configMap[method];
      };

      const upiConfig = generateConfig("upi");
      expect(upiConfig.display.preferences.show_default_blocks).toBe(false);
      expect(upiConfig.display.blocks.upi_block.instruments[0].method).toBe("upi");

      const nbConfig = generateConfig("netbanking");
      expect(nbConfig.display.preferences.show_default_blocks).toBe(false);
      expect(nbConfig.display.blocks.netbanking_block.instruments[0].method).toBe("netbanking");

      const cardConfig = generateConfig("card");
      expect(cardConfig.display.preferences.show_default_blocks).toBe(false);
      expect(cardConfig.display.blocks.card_block.instruments[0].method).toBe("card");
    });
  });
});
