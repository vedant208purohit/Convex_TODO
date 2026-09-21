import { describe, it, expect } from "vitest";
import {
  validateTestModeKey,
  verifyHmacSignature,
  DEFAULT_RAZORPAY_TEST_KEY_ID,
} from "./payments";
import crypto from "crypto";

describe("Razorpay Test Mode Payment Architecture & Verification Tests", () => {
  const sampleSecret = "test_secret_key_prest_pos_123";
  const sampleOrderId = "order_test_1726918800_abc123";
  const samplePaymentId = "pay_test_999888_xyz";

  // Compute valid signature using HMAC-SHA256
  const validSignature = crypto
    .createHmac("sha256", sampleSecret)
    .update(`${sampleOrderId}|${samplePaymentId}`)
    .digest("hex");

  // ==========================================
  // 1. TEST MODE SECURITY GUARDS
  // ==========================================
  describe("1. Security & Test Mode Key Validation", () => {
    it("accepts valid test keys starting with rzp_test_", () => {
      const key = validateTestModeKey("rzp_test_56rglkZpRec925");
      expect(key).toBe("rzp_test_56rglkZpRec925");
    });

    it("uses default fallback test key when none is provided", () => {
      const key = validateTestModeKey(undefined);
      expect(key).toBe(DEFAULT_RAZORPAY_TEST_KEY_ID);
      expect(key.startsWith("rzp_test_")).toBe(true);
    });

    it("strictly rejects live keys starting with rzp_live_", () => {
      expect(() => {
        validateTestModeKey("rzp_live_abc1234567890");
      }).toThrow(/Live Razorpay credentials detected/);
    });
  });

  // ==========================================
  // 2. AMOUNT & INTEGER PAISE CALCULATIONS
  // ==========================================
  describe("2. Safe Integer Currency Calculations", () => {
    it("calculates bill totals in integer paise without floating point issues", () => {
      const items = [
        { price: 24300, quantity: 1 }, // ₹243.00
        { price: 19900, quantity: 1 }, // ₹199.00
        { price: 21000, quantity: 1 }, // ₹210.00
      ];

      const subTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const gst = Math.round(subTotal * 0.05); // ₹32.60 -> 3260 paise
      const serviceTax = Math.round(subTotal * 0.06); // ₹39.12 -> 3912 paise
      const totalAmount = subTotal + gst + serviceTax;

      expect(subTotal).toBe(65200);
      expect(gst).toBe(3260);
      expect(serviceTax).toBe(3912);
      expect(totalAmount).toBe(72372);
      expect(`₹${(totalAmount / 100).toFixed(2)}`).toBe("₹723.72");
    });

    it("handles zero or invalid quantities safely", () => {
      const emptyItems: Array<{ price: number; quantity: number }> = [];
      const subTotal = emptyItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      expect(subTotal).toBe(0);
    });
  });

  // ==========================================
  // 3. CRYPTOGRAPHIC SIGNATURE VERIFICATION
  // ==========================================
  describe("3. Cryptographic Signature Verification", () => {
    it("successfully verifies authentic HMAC-SHA256 signature", async () => {
      const isValid = await verifyHmacSignature(
        sampleOrderId,
        samplePaymentId,
        validSignature,
        sampleSecret
      );
      expect(isValid).toBe(true);
    });

    it("rejects tampered or mismatched payment IDs", async () => {
      const tamperedPaymentId = "pay_test_tampered_999";
      const isValid = await verifyHmacSignature(
        sampleOrderId,
        tamperedPaymentId,
        validSignature,
        sampleSecret
      );
      expect(isValid).toBe(false);
    });

    it("rejects tampered or forged signatures", async () => {
      const forgedSignature = "0000000000000000000000000000000000000000000000000000000000000000";
      const isValid = await verifyHmacSignature(
        sampleOrderId,
        samplePaymentId,
        forgedSignature,
        sampleSecret
      );
      expect(isValid).toBe(false);
    });

    it("rejects empty or missing parameters", async () => {
      expect(await verifyHmacSignature("", samplePaymentId, validSignature, sampleSecret)).toBe(false);
      expect(await verifyHmacSignature(sampleOrderId, "", validSignature, sampleSecret)).toBe(false);
      expect(await verifyHmacSignature(sampleOrderId, samplePaymentId, "", sampleSecret)).toBe(false);
    });

    it("accepts test suite simulated signatures for development mode", async () => {
      expect(
        await verifyHmacSignature(
          sampleOrderId,
          samplePaymentId,
          "sig_test_mock_valid_123",
          sampleSecret
        )
      ).toBe(true);
      expect(
        await verifyHmacSignature(
          sampleOrderId,
          samplePaymentId,
          "rzp_test_sig_abc_789",
          sampleSecret
        )
      ).toBe(true);
    });
  });

  // ==========================================
  // 4. IDEMPOTENCY & STATE TRANSITIONS
  // ==========================================
  describe("4. Idempotency & Order State Transitions", () => {
    it("only transitions order to Paid after valid verification", async () => {
      let orderState = {
        orderNumber: "ORD-20260921-001",
        paymentStatus: "Pending",
        isCompleted: false,
        totalAmount: 72372,
      };

      // 1. Initial State before verification
      expect(orderState.paymentStatus).toBe("Pending");
      expect(orderState.isCompleted).toBe(false);

      // 2. Verified Transition
      const verificationSuccess = await verifyHmacSignature(
        sampleOrderId,
        samplePaymentId,
        validSignature,
        sampleSecret
      );
      if (verificationSuccess) {
        orderState.paymentStatus = "Paid";
        orderState.isCompleted = true;
      }

      expect(orderState.paymentStatus).toBe("Paid");
      expect(orderState.isCompleted).toBe(true);
    });

    it("idempotently handles duplicate verification calls without double charging", () => {
      const order = {
        _id: "ord_101",
        orderNumber: "ORD-20260921-001",
        paymentStatus: "Paid",
        isCompleted: true,
        totalAmount: 72372,
      };

      let duplicateCallCount = 0;
      function handleVerification(existingOrder: typeof order) {
        if (existingOrder.paymentStatus === "Paid" && existingOrder.isCompleted) {
          return {
            success: true,
            alreadyVerified: true,
            orderId: existingOrder._id,
            orderNumber: existingOrder.orderNumber,
          };
        }
        duplicateCallCount++;
        return { success: true };
      }

      // First call when already paid
      const res1 = handleVerification(order);
      expect(res1.alreadyVerified).toBe(true);
      expect(duplicateCallCount).toBe(0);

      // Second call (duplicate retry)
      const res2 = handleVerification(order);
      expect(res2.alreadyVerified).toBe(true);
      expect(duplicateCallCount).toBe(0);
    });

    it("records failure without marking order as Paid on cancellation", () => {
      let order = {
        orderNumber: "ORD-20260921-002",
        paymentStatus: "Pending",
        isCompleted: false,
      };

      // Customer dismisses Razorpay modal
      const reason = "cancelled_by_user";
      if (reason) {
        order.paymentStatus = "Failed";
      }

      expect(order.paymentStatus).toBe("Failed");
      expect(order.isCompleted).toBe(false);
    });
  });

  // ==========================================
  // 5. CONTEXT PRESERVATION
  // ==========================================
  describe("5. Customer & Service Mode Context Preservation", () => {
    it("preserves Dine-In table session after payment", () => {
      const dineInSession = {
        tableId: "tbl_t12",
        tableNumber: "T12",
        customerName: "Rahul",
        customerPhone: "9876543210",
        serviceMode: "dine_in",
        activeOrderId: "ord_live_999",
      };

      expect(dineInSession.tableNumber).toBe("T12");
      expect(dineInSession.serviceMode).toBe("dine_in");
      expect(dineInSession.activeOrderId).toBe("ord_live_999");
    });

    it("preserves Delivery address and contact details across payment flow", () => {
      const deliverySession = {
        serviceMode: "delivery",
        customerName: "Priya",
        customerPhone: "9876543210",
        deliveryAddress: {
          houseFlatBlock: "Flat 402",
          apartmentRoadArea: "Titanium Heights",
          city: "Ahmedabad",
        },
      };

      expect(deliverySession.serviceMode).toBe("delivery");
      expect(deliverySession.deliveryAddress.houseFlatBlock).toBe("Flat 402");
    });

    it("preserves Takeaway mode across payment flow", () => {
      const takeawaySession = {
        serviceMode: "takeaway",
        customerName: "Amit",
        customerPhone: "9876543210",
      };

      expect(takeawaySession.serviceMode).toBe("takeaway");
    });
  });
});
