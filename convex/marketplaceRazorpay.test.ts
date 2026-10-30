/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Marketplace Razorpay Backend & Ledger Tests", () => {
  test("1. Pending Razorpay order recording with limits validation", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Razorpay Test Bistro",
    });

    const admin = t.withIdentity({
      name: "Bistro Admin",
      email: "admin@prest-bistro.com",
      subject: "clerk_admin_rzp_1",
    });

    await admin.mutation(api.marketplace.initializeMarketplace, {
      explicitOrgId: orgId,
    });

    const initialWallet = await admin.query(api.marketplace.getWallet, {
      explicitOrgId: orgId,
    });
    const startingBalance = initialWallet.balance;

    // A. Rejects below minimum limit (₹500)
    await expect(
      admin.mutation(api.marketplace.recordPendingRazorpayTopup, {
        amount: 400,
        paymentMethod: "upi",
        razorpayOrderId: "order_test_below_min",
        explicitOrgId: orgId,
      })
    ).rejects.toThrow(/Deposit amount must be between ₹500.00 and ₹1,00,000.00 INR/);

    // B. Rejects above maximum limit (₹1,00,000)
    await expect(
      admin.mutation(api.marketplace.recordPendingRazorpayTopup, {
        amount: 150000,
        paymentMethod: "card",
        razorpayOrderId: "order_test_above_max",
        explicitOrgId: orgId,
      })
    ).rejects.toThrow(/Deposit amount must be between ₹500.00 and ₹1,00,000.00 INR/);

    // C. Valid recording creates pending ledger entry
    const pendingResult = await admin.mutation(api.marketplace.recordPendingRazorpayTopup, {
      amount: 2500,
      paymentMethod: "upi",
      razorpayOrderId: "order_rzp_test_12345",
      explicitOrgId: orgId,
    });

    expect(pendingResult.transactionId).toBeDefined();
    expect(pendingResult.transactionCode).toMatch(/^TXN-\d{6}$/);

    // Balance remains unchanged while pending
    const walletAfterPending = await admin.query(api.marketplace.getWallet, {
      explicitOrgId: orgId,
    });
    expect(walletAfterPending.balance).toBe(startingBalance);

    // Ledger lists pending entry
    const txList = await admin.query(api.marketplace.listTransactions, {
      explicitOrgId: orgId,
    });
    const pendingTx = txList.find((tx) => tx.code === pendingResult.transactionCode);
    expect(pendingTx).toBeDefined();
    expect(pendingTx?.status).toBe("pending");
    expect(pendingTx?.statusLabel).toBe("Pending Authorization");
  });

  test("2. Atomic payment confirmation, wallet balance credit, and idempotency protection", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Razorpay Idempotency Cafe",
    });

    const admin = t.withIdentity({
      name: "Cafe Admin",
      email: "cafe_admin@prest.com",
      subject: "clerk_cafe_admin_rzp",
    });

    await admin.mutation(api.marketplace.initializeMarketplace, {
      explicitOrgId: orgId,
    });

    const initialWallet = await admin.query(api.marketplace.getWallet, {
      explicitOrgId: orgId,
    });
    const startingBalance = initialWallet.balance;

    // Step A: Record Pending Order
    const pending = await admin.mutation(api.marketplace.recordPendingRazorpayTopup, {
      amount: 5000,
      paymentMethod: "netbanking",
      razorpayOrderId: "order_netbanking_5000",
      explicitOrgId: orgId,
    });

    // Step B: Confirm Payment
    const confirmResult1 = await admin.mutation(api.marketplace.confirmRazorpayTopup, {
      razorpayOrderId: "order_netbanking_5000",
      razorpayPaymentId: "pay_verified_999888",
      razorpaySignature: "sig_crypto_valid_123",
      amount: 5000,
      paymentMethod: "netbanking",
      explicitOrgId: orgId,
    });

    expect(confirmResult1.success).toBe(true);
    expect(confirmResult1.newBalance).toBe(startingBalance + 5000);
    expect(confirmResult1.transactionCode).toBe(pending.transactionCode);

    // Verify wallet updated in DB
    const walletAfterConfirm = await admin.query(api.marketplace.getWallet, {
      explicitOrgId: orgId,
    });
    expect(walletAfterConfirm.balance).toBe(startingBalance + 5000);

    // Verify transaction updated in DB
    const txList = await admin.query(api.marketplace.listTransactions, {
      explicitOrgId: orgId,
    });
    const confirmedTx = txList.find((tx) => tx.code === pending.transactionCode);
    expect(confirmedTx?.status).toBe("confirmed");
    expect(confirmedTx?.statusLabel).toBe("Confirmed");

    // Step C: Strict Idempotency Check — Replaying same razorpayPaymentId must NOT double credit
    const confirmResult2 = await admin.mutation(api.marketplace.confirmRazorpayTopup, {
      razorpayOrderId: "order_netbanking_5000",
      razorpayPaymentId: "pay_verified_999888",
      razorpaySignature: "sig_crypto_valid_123",
      amount: 5000,
      paymentMethod: "netbanking",
      explicitOrgId: orgId,
    });

    expect(confirmResult2.success).toBe(true);
    expect(confirmResult2.idempotentReplay).toBe(true);
    expect(confirmResult2.newBalance).toBe(startingBalance + 5000); // Must remain identical!

    const walletAfterReplay = await admin.query(api.marketplace.getWallet, {
      explicitOrgId: orgId,
    });
    expect(walletAfterReplay.balance).toBe(startingBalance + 5000);
  });

  test("3. Multi-tenant isolation and unauthorized access denial", async () => {
    const t = convexTest(schema, modules);

    const org1 = await t.mutation(api.organizations.create, { name: "Tenant A" });
    const org2 = await t.mutation(api.organizations.create, { name: "Tenant B" });

    const adminA = t.withIdentity({
      name: "Admin A",
      email: "admin_a@tenant.com",
      subject: "clerk_admin_tenant_a",
    });

    await adminA.mutation(api.marketplace.initializeMarketplace, {
      explicitOrgId: org1,
    });

    // Unauthenticated user rejected
    const unauthenticated = t.withIdentity({
      name: "Stranger",
      email: "stranger@other.com",
      subject: "stranger_without_membership",
    });

    await expect(
      unauthenticated.mutation(api.marketplace.recordPendingRazorpayTopup, {
        amount: 1000,
        paymentMethod: "card",
        razorpayOrderId: "order_unauth",
        explicitOrgId: org1,
      })
    ).rejects.toThrow();

    await expect(
      unauthenticated.mutation(api.marketplace.confirmRazorpayTopup, {
        razorpayOrderId: "order_unauth",
        razorpayPaymentId: "pay_unauth",
        amount: 1000,
        explicitOrgId: org1,
      })
    ).rejects.toThrow();
  });
});

