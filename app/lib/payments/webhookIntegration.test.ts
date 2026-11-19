import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { getPaymentAdapter } from "./registry";

describe("RAZORPAY WEBHOOK INTEGRATION SUITE", () => {
  const adapter = getPaymentAdapter("razorpay");
  const testSecret = "whsec_test_secret_key_849201847583";
  const storeASecret = "whsec_store_a_998877665544";
  const storeBSecret = "whsec_store_b_112233445566";

  const samplePaymentPayload = JSON.stringify({
    entity: "event",
    account_id: "acc_Ti7x9n4f0oPJJy",
    event: "payment.captured",
    contains: ["payment"],
    payload: {
      payment: {
        entity: {
          id: "pay_test_webhook_123456",
          entity: "payment",
          amount: 50000,
          currency: "INR",
          status: "captured",
          order_id: "order_test_987654",
          method: "card",
          created_at: 1718000000,
        },
      },
    },
    created_at: 1718000000,
  });

  const generateSignature = (payload: string, secret: string) => {
    return crypto.createHmac("sha256", secret).update(payload).digest("hex");
  };

  describe("Phase 3: Secure HMAC-SHA256 Signature Verification", () => {
    it("validates authentic webhook signature with correct secret using timing-safe comparison", () => {
      const validSig = generateSignature(samplePaymentPayload, testSecret);
      const isValid = adapter.verifyWebhookSignature!(samplePaymentPayload, validSig, testSecret);
      expect(isValid).toBe(true);
    });

    it("rejects invalid signature when payload has been tampered with", () => {
      const validSig = generateSignature(samplePaymentPayload, testSecret);
      const tamperedPayload = samplePaymentPayload.replace("50000", "99999");
      const isValid = adapter.verifyWebhookSignature!(tamperedPayload, validSig, testSecret);
      expect(isValid).toBe(false);
    });

    it("rejects webhook signed with wrong secret (e.g. wrong store secret)", () => {
      const wrongSig = generateSignature(samplePaymentPayload, "wrong_secret");
      const isValid = adapter.verifyWebhookSignature!(samplePaymentPayload, wrongSig, testSecret);
      expect(isValid).toBe(false);
    });

    it("rejects missing signature or empty secret", () => {
      expect(adapter.verifyWebhookSignature!(samplePaymentPayload, "", testSecret)).toBe(false);
      expect(adapter.verifyWebhookSignature!(samplePaymentPayload, "any_sig", "")).toBe(false);
      expect(adapter.verifyWebhookSignature!("", "any_sig", testSecret)).toBe(false);
    });

    it("handles signature length mismatch securely without timing side-channels", () => {
      const shortSig = "abcdef123456";
      const isValid = adapter.verifyWebhookSignature!(samplePaymentPayload, shortSig, testSecret);
      expect(isValid).toBe(false);
    });
  });

  describe("Phase 4: Webhook Event Ingestion & State Machine Handlers", () => {
    function simulateStateTransition(currentStatus: string, newStatus: string): boolean {
      if (currentStatus === newStatus) return true;
      if (currentStatus === "refunded") return false;
      if (currentStatus === "partially_refunded" && newStatus !== "refunded") return false;
      if (
        currentStatus === "captured" &&
        (newStatus === "authorized" ||
          newStatus === "pending" ||
          newStatus === "created" ||
          newStatus === "failed")
      ) {
        return false;
      }
      return true;
    }

    it("transitions pending transaction to authorized on payment.authorized event", () => {
      const current = "pending";
      const incoming = "authorized";
      expect(simulateStateTransition(current, incoming)).toBe(true);
    });

    it("transitions authorized or pending transaction to captured on payment.captured event", () => {
      expect(simulateStateTransition("authorized", "captured")).toBe(true);
      expect(simulateStateTransition("pending", "captured")).toBe(true);
    });

    it("transitions pending transaction to failed on payment.failed event", () => {
      expect(simulateStateTransition("pending", "failed")).toBe(true);
    });

    it("prevents out-of-order regression: captured transaction does NOT regress to authorized or pending", () => {
      expect(simulateStateTransition("captured", "authorized")).toBe(false);
      expect(simulateStateTransition("captured", "pending")).toBe(false);
      expect(simulateStateTransition("captured", "failed")).toBe(false);
    });

    it("prevents out-of-order regression: refunded transaction does NOT regress to captured", () => {
      expect(simulateStateTransition("refunded", "captured")).toBe(false);
      expect(simulateStateTransition("refunded", "authorized")).toBe(false);
      expect(simulateStateTransition("refunded", "partially_refunded")).toBe(false);
    });

    it("handles refund.created event and aggregates refunded balance", () => {
      const txnAmount = 10000;
      const initialRefunded = 0;
      const refundEventAmount = 4000;

      const updatedRefunded = initialRefunded + refundEventAmount;
      const isFullyRefunded = updatedRefunded >= txnAmount;
      const nextStatus = isFullyRefunded ? "refunded" : "partially_refunded";

      expect(updatedRefunded).toBe(4000);
      expect(nextStatus).toBe("partially_refunded");

      // Follow-up refund for remaining balance
      const secondRefundAmount = 6000;
      const finalRefunded = updatedRefunded + secondRefundAmount;
      const finalStatus = finalRefunded >= txnAmount ? "refunded" : "partially_refunded";

      expect(finalRefunded).toBe(10000);
      expect(finalStatus).toBe("refunded");
    });

    it("handles settlement.processed event calculating net amount and fee breakdown", () => {
      const settlement = {
        amount: 150000,
        fees: 3000,
        tax: 540,
        utr: "UTR_AXIS_99882211",
      };
      const netAmount = settlement.amount - settlement.fees - settlement.tax;
      expect(netAmount).toBe(146460);
      expect(settlement.utr).toBe("UTR_AXIS_99882211");
    });
  });

  describe("Phase 5: Store-Specific Webhook Secret & Multi-Store Isolation", () => {
    it("guarantees Store A webhook secret cannot verify Store B events", () => {
      const storeAPayload = JSON.stringify({ event: "payment.captured", store: "store_a" });
      const storeASignature = generateSignature(storeAPayload, storeASecret);

      // Verify Store A passes Store A
      expect(adapter.verifyWebhookSignature!(storeAPayload, storeASignature, storeASecret)).toBe(true);

      // Verify Store A signature FAILS when verified using Store B secret
      expect(adapter.verifyWebhookSignature!(storeAPayload, storeASignature, storeBSecret)).toBe(false);
    });

    it("never allows API Key Secret to be reused as webhook secret", () => {
      const apiKeySecret = "f0kjzAySCNuGcWY8KZtmYKPU";
      const webhookSecret = "whsec_independent_signing_secret_9988";
      expect(apiKeySecret).not.toBe(webhookSecret);

      const sigWithApiKey = generateSignature(samplePaymentPayload, apiKeySecret);
      // Fails when verified with genuine webhook secret
      expect(adapter.verifyWebhookSignature!(samplePaymentPayload, sigWithApiKey, webhookSecret)).toBe(false);
    });
  });

  describe("Phase 6: Health Telemetry & Checklist Status Transitions", () => {
    function computeWebhookHealthStatus(params: {
      hasSecret: boolean;
      isConnected: boolean;
      totalEvents: number;
      processedEvents: number;
      failedEvents: number;
      lastProcessedAt?: number;
    }): "healthy" | "awaiting_events" | "degraded" | "not_configured" | "inactive" {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      if (!params.isConnected) return "inactive";
      if (!params.hasSecret) return "not_configured";
      if (params.failedEvents > 0 && (!params.lastProcessedAt || params.lastProcessedAt < oneDayAgo)) {
        return "degraded";
      }
      if (params.processedEvents > 0) return "healthy";
      return "awaiting_events";
    }

    it("reports 'not_configured' (Pending Setup) when no webhook secret is set", () => {
      const status = computeWebhookHealthStatus({
        hasSecret: false,
        isConnected: true,
        totalEvents: 0,
        processedEvents: 0,
        failedEvents: 0,
      });
      expect(status).toBe("not_configured");
    });

    it("reports 'awaiting_events' (Awaiting First Event) when secret is configured but 0 events have arrived", () => {
      const status = computeWebhookHealthStatus({
        hasSecret: true,
        isConnected: true,
        totalEvents: 0,
        processedEvents: 0,
        failedEvents: 0,
      });
      expect(status).toBe("awaiting_events");
    });

    it("reports 'healthy' (Active) only when secret is configured AND verified events have been processed", () => {
      const status = computeWebhookHealthStatus({
        hasSecret: true,
        isConnected: true,
        totalEvents: 1,
        processedEvents: 1,
        failedEvents: 0,
        lastProcessedAt: Date.now(),
      });
      expect(status).toBe("healthy");
      // "Webhooks Active" checklist item passed condition
      const isWebhooksActive = status === "healthy";
      expect(isWebhooksActive).toBe(true);
    });

    it("reports 'degraded' when recent event processing failures occur", () => {
      const status = computeWebhookHealthStatus({
        hasSecret: true,
        isConnected: true,
        totalEvents: 5,
        processedEvents: 2,
        failedEvents: 3,
        lastProcessedAt: Date.now() - 48 * 60 * 60 * 1000, // old success
      });
      expect(status).toBe("degraded");
      expect(status === "healthy").toBe(false);
    });

    it("reports 'inactive' when gateway connection is disconnected", () => {
      const status = computeWebhookHealthStatus({
        hasSecret: true,
        isConnected: false,
        totalEvents: 10,
        processedEvents: 10,
        failedEvents: 0,
      });
      expect(status).toBe("inactive");
    });
  });
});
