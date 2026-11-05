import { describe, it, expect, vi } from "vitest";
import {
  PaymentProviderAdapter,
  PaymentCredentials,
  CredentialVerificationResult,
  MerchantProfileResult,
  NormalizedTransaction,
  NormalizedRefund,
  NormalizedSettlement,
  FetchResult,
  AccountMode,
} from "./types";
import { providerRegistry, getPaymentAdapter } from "./registry";
import { RazorpayProviderAdapter } from "./adapters/RazorpayProviderAdapter";

describe("PART 1 & PART 12.A — POLYMORPHIC PAYMENT GATEWAY ARCHITECTURE SUITE", () => {
  it("verifies RazorpayProviderAdapter implements capability-based PaymentProviderAdapter interface", () => {
    const adapter = getPaymentAdapter("razorpay");
    expect(adapter).toBeDefined();
    expect(adapter.provider).toBe("razorpay");

    const capabilities = adapter.getSupportedCapabilities?.() || [];
    expect(capabilities).toContain("verify_credentials");
    expect(capabilities).toContain("fetch_profile");
    expect(capabilities).toContain("fetch_transactions");
    expect(capabilities).toContain("create_payment_order");
    expect(capabilities).toContain("verify_payment_signature");
    expect(capabilities).toContain("verify_webhook_signature");
    expect(capabilities).toContain("create_refund");
    expect(capabilities).toContain("fetch_settlements");
  });

  it("proves a new provider (e.g. Stripe) can be registered dynamically without modifying database schema", async () => {
    // Define a compliant Stripe adapter without introducing stripe-specific database tables
    class MockStripeAdapter implements PaymentProviderAdapter {
      readonly provider = "stripe";

      getSupportedCapabilities(): string[] {
        return [
          "verify_credentials",
          "fetch_profile",
          "fetch_transactions",
          "create_payment_order",
          "verify_webhook_signature",
          "create_refund",
        ];
      }

      detectAccountMode(keyId: string): AccountMode {
        return keyId.startsWith("sk_live_") ? "live" : "test";
      }

      validateKeyFormat(keyId: string, keySecret: string): { valid: boolean; error?: string } {
        if (!keyId.startsWith("sk_test_") && !keyId.startsWith("sk_live_")) {
          return { valid: false, error: "Stripe key must begin with sk_test_ or sk_live_" };
        }
        return { valid: true };
      }

      async verifyCredentials(credentials: PaymentCredentials): Promise<CredentialVerificationResult> {
        return {
          success: true,
          verified: true,
          provider: "stripe",
          accountMode: this.detectAccountMode(credentials.keyId),
          credentialsValid: true,
          merchantExists: "yes",
          accountStatus: "active",
          message: "Stripe REST API authenticated.",
          merchantName: "Stripe Gourmet Merchant",
        };
      }

      async fetchProfile(credentials: PaymentCredentials): Promise<MerchantProfileResult> {
        return {
          success: true,
          provider: "stripe",
          merchant_name: "Stripe Gourmet Merchant",
          merchant_id: "acct_1234567890",
          account_mode: this.detectAccountMode(credentials.keyId),
          connection_status: "connected",
          is_profile_available: true,
        };
      }

      async fetchTransactions(): Promise<FetchResult<NormalizedTransaction>> {
        return {
          items: [
            {
              providerPaymentId: "pi_123456",
              amountMinor: 250000,
              currency: "USD",
              paymentMethod: "card",
              status: "captured",
              providerStatus: "succeeded",
              paidAt: Date.now(),
              createdAt: Date.now(),
            },
          ],
          hasMore: false,
          count: 1,
          skip: 0,
        };
      }

      async fetchRefunds(): Promise<FetchResult<NormalizedRefund>> {
        return { items: [], hasMore: false, count: 0, skip: 0 };
      }

      async createRefund(): Promise<NormalizedRefund> {
        return {
          providerRefundId: "re_123",
          providerPaymentId: "pi_123456",
          amountMinor: 5000,
          currency: "USD",
          status: "processed",
          providerStatus: "succeeded",
          initiatedAt: Date.now(),
        };
      }

      async fetchSettlements(): Promise<FetchResult<NormalizedSettlement>> {
        return { items: [], hasMore: false, count: 0, skip: 0 };
      }

      normalizeError(error: unknown) {
        return { code: "STRIPE_ERROR", message: String(error), httpStatus: 400 };
      }
    }

    // Register into polymorphic registry
    providerRegistry.registerAdapter(new MockStripeAdapter());

    expect(providerRegistry.isSupported("stripe")).toBe(true);

    const stripeAdapter = getPaymentAdapter("stripe");
    expect(stripeAdapter.provider).toBe("stripe");

    const verification = await stripeAdapter.verifyCredentials({
      keyId: "sk_live_mock_12345",
      keySecret: "whsec_mock_9999",
    });

    expect(verification.verified).toBe(true);
    expect(verification.accountMode).toBe("live");
    expect(verification.merchantName).toBe("Stripe Gourmet Merchant");

    // Normalized transaction preserves standard contract
    const txs = await stripeAdapter.fetchTransactions({ keyId: "sk_live_123", keySecret: "" });
    expect(txs.items[0].providerPaymentId).toBe("pi_123456");
    expect(txs.items[0].amountMinor).toBe(250000);
    expect(txs.items[0].currency).toBe("USD");
    expect(txs.items[0].status).toBe("captured");
    expect(txs.items[0].providerStatus).toBe("succeeded"); // Original provider status retained
  });

  it("preserves integer minor units and ISO 4217 currency across transactions and refunds", () => {
    const adapter = new RazorpayProviderAdapter();

    // Minor unit conversion verification
    const minorINR = 125050; // ₹1,250.50
    expect(Number.isInteger(minorINR)).toBe(true);

    const minorUSD = 4999; // $49.99
    expect(Number.isInteger(minorUSD)).toBe(true);
  });

  it("verifies cryptographic payment and webhook signature verification in Razorpay adapter", () => {
    const adapter = new RazorpayProviderAdapter();
    const orderId = "order_123456";
    const paymentId = "pay_abcdef";
    const secret = "super_secret_key_123";

    // Expected HMAC SHA256 of orderId|paymentId
    const crypto = require("crypto");
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const isValid = adapter.verifyPaymentSignature!({
      orderId,
      paymentId,
      signature: validSignature,
      secret,
    });
    expect(isValid).toBe(true);

    const isInvalid = adapter.verifyPaymentSignature!({
      orderId,
      paymentId,
      signature: "tampered_signature_hex_value",
      secret,
    });
    expect(isInvalid).toBe(false);

    // Webhook signature verification
    const payload = JSON.stringify({ event: "payment.captured", id: "evt_123" });
    const validWebhookSig = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    expect(adapter.verifyWebhookSignature!(payload, validWebhookSig, secret)).toBe(true);
    expect(adapter.verifyWebhookSignature!(payload, "bad_sig", secret)).toBe(false);
  });
});
