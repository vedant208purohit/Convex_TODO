/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import {
  encryptCredentials,
  decryptCredentials,
  maskKeyIdentifier,
} from "./paymentGatewayCrypto";
import {
  SUPPORTED_PAYMENT_PROVIDERS,
  PAYMENT_CONNECTION_TYPES,
  PAYMENT_CONNECTION_STATUSES,
  PAYMENT_ACCOUNT_MODES,
  NORMALIZED_TRANSACTION_STATUSES,
  NORMALIZED_REFUND_STATUSES,
  NORMALIZED_SETTLEMENT_STATUSES,
  WEBHOOK_PROCESSING_STATUSES,
  SYNC_RESOURCE_TYPES,
  SYNC_TYPES,
  SYNC_RUN_STATUSES,
} from "./paymentGatewayTypes";

const modules = import.meta.glob("./**/*.*s");

describe("Polymorphic Payment Gateway Schema & Data Model Tests", () => {
  async function setupTestStore(storeName = "PREST Flagship Store", adminClerkId = "clerk_admin_1") {
    const t = convexTest(schema, modules);
    const orgId = await t.mutation(api.organizations.create, {
      name: storeName,
    });
    const admin = t.withIdentity({
      name: "Admin User",
      email: "admin@prestpos.com",
      subject: adminClerkId,
    });
    return { t, orgId, admin };
  }

  // -------------------------------------------------------------------------
  // 1. Razorpay connection record
  // -------------------------------------------------------------------------
  test("1. Razorpay connection record is created with normalized fields and encrypted credentials", async () => {
    const { admin, orgId } = await setupTestStore();

    const connId = await admin.mutation(api.paymentGateways.saveConnection, {
      organizationId: orgId,
      provider: "razorpay",
      connectionType: "api_key",
      providerAccountId: "rzp_live_K82HS91MNB0",
      merchantName: "Acme Foods",
      accountMode: "live",
      status: "connected",
      rawCredentials: {
        keyId: "rzp_live_K82HS91MNB0",
        keySecret: "SuperSecretKey99",
      },
      isDefault: true,
    });

    expect(connId).toBeDefined();

    const connection = await admin.query(api.paymentGateways.getConnection, {
      connectionId: connId,
    });

    expect(connection).not.toBeNull();
    expect(connection?.provider).toBe("razorpay");
    expect(connection?.status).toBe("connected");
    expect(connection?.accountMode).toBe("live");
    expect(connection?.isDefault).toBe(true);
    expect(connection?.providerAccountId).toBe("rzp_live_K82HS91MNB0");
  });

  // -------------------------------------------------------------------------
  // 2. Stripe connection record
  // -------------------------------------------------------------------------
  test("2. Stripe connection record is saved in the same shared table", async () => {
    const { admin, orgId } = await setupTestStore();

    const connId = await admin.mutation(api.paymentGateways.saveConnection, {
      organizationId: orgId,
      provider: "stripe",
      connectionType: "api_key",
      providerAccountId: "acct_1NtuABCD1234",
      merchantName: "Acme Retail Store",
      accountMode: "live",
      status: "connected",
      rawCredentials: {
        keyId: "pk_live_51NtuABCD",
        keySecret: "sk_live_51NtuABCDXYZ",
      },
    });

    const conn = await admin.query(api.paymentGateways.getConnection, { connectionId: connId });
    expect(conn?.provider).toBe("stripe");
    expect(conn?.providerAccountId).toBe("acct_1NtuABCD1234");
  });

  // -------------------------------------------------------------------------
  // 3. PayPal connection record
  // -------------------------------------------------------------------------
  test("3. PayPal connection record is saved in the shared table", async () => {
    const { admin, orgId } = await setupTestStore();

    const connId = await admin.mutation(api.paymentGateways.saveConnection, {
      organizationId: orgId,
      provider: "paypal",
      connectionType: "oauth",
      providerAccountId: "payer_paypal_99812",
      merchantName: "Acme Global Bistro",
      accountMode: "live",
      status: "connected",
      rawCredentials: {
        accessToken: "access_token_paypal_xyz",
        refreshToken: "refresh_token_paypal_abc",
      },
    });

    const conn = await admin.query(api.paymentGateways.getConnection, { connectionId: connId });
    expect(conn?.provider).toBe("paypal");
    expect(conn?.connectionType).toBe("oauth");
  });

  // -------------------------------------------------------------------------
  // 4. API-key connection
  // -------------------------------------------------------------------------
  test("4. API-key connection method is properly typed and stored", async () => {
    const { admin, orgId } = await setupTestStore();

    const connId = await admin.mutation(api.paymentGateways.saveConnection, {
      organizationId: orgId,
      provider: "razorpay",
      connectionType: "api_key",
      accountMode: "test",
      status: "connected",
      providerAccountId: "rzp_test_key123",
      rawCredentials: { keyId: "rzp_test_key123", keySecret: "test_secret_abc" },
    });

    const conn = await admin.query(api.paymentGateways.getConnection, { connectionId: connId });
    expect(conn?.connectionType).toBe("api_key");
  });

  // -------------------------------------------------------------------------
  // 5. OAuth connection
  // -------------------------------------------------------------------------
  test("5. OAuth connection method is properly typed and stored", async () => {
    const { admin, orgId } = await setupTestStore();

    const connId = await admin.mutation(api.paymentGateways.saveConnection, {
      organizationId: orgId,
      provider: "razorpay",
      connectionType: "oauth",
      accountMode: "live",
      status: "connected",
      providerAccountId: "acc_oauth_merchant_99",
      rawCredentials: { accessToken: "rzp_oauth_tok_xyz" },
    });

    const conn = await admin.query(api.paymentGateways.getConnection, { connectionId: connId });
    expect(conn?.connectionType).toBe("oauth");
  });

  // -------------------------------------------------------------------------
  // 6. Live and test modes
  // -------------------------------------------------------------------------
  test("6. Supports both test and live account modes independently", async () => {
    const { admin, orgId } = await setupTestStore();

    const testConnId = await admin.mutation(api.paymentGateways.saveConnection, {
      organizationId: orgId,
      provider: "razorpay",
      connectionType: "api_key",
      accountMode: "test",
      status: "connected",
      providerAccountId: "rzp_test_123",
    });

    const liveConnId = await admin.mutation(api.paymentGateways.saveConnection, {
      organizationId: orgId,
      provider: "razorpay",
      connectionType: "api_key",
      accountMode: "live",
      status: "connected",
      providerAccountId: "rzp_live_456",
    });

    expect(testConnId).not.toEqual(liveConnId);

    const testConn = await admin.query(api.paymentGateways.getConnection, { connectionId: testConnId });
    const liveConn = await admin.query(api.paymentGateways.getConnection, { connectionId: liveConnId });

    expect(testConn?.accountMode).toBe("test");
    expect(liveConn?.accountMode).toBe("live");
  });

  // -------------------------------------------------------------------------
  // 7. Transactions from multiple providers in the same shared table
  // -------------------------------------------------------------------------
  test("7. Transactions from multiple providers exist in the common payment_transactions table", async () => {
    const { t, admin, orgId } = await setupTestStore();

    // Create Razorpay & Stripe connections
    const rzpConn = await admin.mutation(api.paymentGateways.saveConnection, {
      organizationId: orgId,
      provider: "razorpay",
      connectionType: "api_key",
      accountMode: "live",
      status: "connected",
    });

    const stripeConn = await admin.mutation(api.paymentGateways.saveConnection, {
      organizationId: orgId,
      provider: "stripe",
      connectionType: "api_key",
      accountMode: "live",
      status: "connected",
    });

    // Record Razorpay transaction (INR 1250.00 -> 125000 paise)
    const rzpTxn = await admin.mutation(api.paymentGateways.recordTransaction, {
      connectionId: rzpConn,
      providerPaymentId: "pay_Rzp123456",
      providerOrderId: "order_Rzp_001",
      amountMinor: 125000,
      currency: "INR",
      paymentMethod: "upi",
      status: "captured",
      providerStatus: "captured",
      paidAt: Date.now(),
    });

    // Record Stripe transaction ($25.00 -> 2500 cents)
    const stripeTxn = await admin.mutation(api.paymentGateways.recordTransaction, {
      connectionId: stripeConn,
      providerPaymentId: "ch_Stripe98765",
      providerOrderId: "pi_Stripe_002",
      amountMinor: 2500,
      currency: "USD",
      paymentMethod: "card",
      status: "captured",
      providerStatus: "succeeded",
      paidAt: Date.now(),
    });

    // Query the database directly to verify shared table storage
    const allTransactions = await t.run(async (ctx) => {
      return await ctx.db.query("payment_transactions").collect();
    });

    expect(allTransactions.length).toBe(2);
    const providers = allTransactions.map((tx) => tx.provider);
    expect(providers).toContain("razorpay");
    expect(providers).toContain("stripe");

    const rzpDbRecord = allTransactions.find((tx) => tx.provider === "razorpay");
    expect(rzpDbRecord?.amountMinor).toBe(125000);
    expect(rzpDbRecord?.currency).toBe("INR");

    const stripeDbRecord = allTransactions.find((tx) => tx.provider === "stripe");
    expect(stripeDbRecord?.amountMinor).toBe(2500);
    expect(stripeDbRecord?.currency).toBe("USD");
  });

  // -------------------------------------------------------------------------
  // 8. Refunds linked to transactions
  // -------------------------------------------------------------------------
  test("8. Refunds are linked directly to transactions in the common table", async () => {
    const { t, admin, orgId } = await setupTestStore();

    const connId = await admin.mutation(api.paymentGateways.saveConnection, {
      organizationId: orgId,
      provider: "razorpay",
      connectionType: "api_key",
      accountMode: "live",
      status: "connected",
    });

    const txnRes = await admin.mutation(api.paymentGateways.recordTransaction, {
      connectionId: connId,
      providerPaymentId: "pay_ToRefund_1",
      amountMinor: 50000, // INR 500.00
      currency: "INR",
      paymentMethod: "card",
      status: "captured",
      providerStatus: "captured",
    });

    const refundRes = await admin.mutation(api.paymentGateways.recordRefund, {
      connectionId: connId,
      transactionId: txnRes.transactionId,
      providerRefundId: "rfnd_Rzp_001",
      amountMinor: 50000,
      currency: "INR",
      reason: "Customer request",
      status: "processed",
      providerStatus: "processed",
    });

    expect(refundRes.refundId).toBeDefined();

    // Verify refund document references
    const refundDoc = await t.run(async (ctx) => {
      return await ctx.db.get(refundRes.refundId);
    });

    expect(refundDoc?.transactionId).toEqual(txnRes.transactionId);
    expect(refundDoc?.connectionId).toEqual(connId);
    expect(refundDoc?.amountMinor).toBe(50000);

    // Verify transaction updated to "refunded"
    const updatedTxn = await t.run(async (ctx) => {
      return await ctx.db.get(txnRes.transactionId);
    });
    expect(updatedTxn?.status).toBe("refunded");
    expect(updatedTxn?.refundedAmountMinor).toBe(50000);
  });

  // -------------------------------------------------------------------------
  // 9. Partial refunds
  // -------------------------------------------------------------------------
  test("9. Supports multiple partial refunds against a single transaction", async () => {
    const { t, admin, orgId } = await setupTestStore();

    const connId = await admin.mutation(api.paymentGateways.saveConnection, {
      organizationId: orgId,
      provider: "razorpay",
      connectionType: "api_key",
      accountMode: "live",
      status: "connected",
    });

    const txn = await admin.mutation(api.paymentGateways.recordTransaction, {
      connectionId: connId,
      providerPaymentId: "pay_Partial_1",
      amountMinor: 10000, // ₹100.00
      currency: "INR",
      paymentMethod: "upi",
      status: "captured",
      providerStatus: "captured",
    });

    // 1st partial refund: ₹30.00 (3000 paise)
    await admin.mutation(api.paymentGateways.recordRefund, {
      connectionId: connId,
      transactionId: txn.transactionId,
      providerRefundId: "rfnd_part_1",
      amountMinor: 3000,
      currency: "INR",
      status: "processed",
      providerStatus: "processed",
    });

    let txnDoc = await t.run(async (ctx) => ctx.db.get(txn.transactionId));
    expect(txnDoc?.status).toBe("partially_refunded");
    expect(txnDoc?.refundedAmountMinor).toBe(3000);

    // 2nd partial refund: ₹70.00 (7000 paise) -> completes full refund
    await admin.mutation(api.paymentGateways.recordRefund, {
      connectionId: connId,
      transactionId: txn.transactionId,
      providerRefundId: "rfnd_part_2",
      amountMinor: 7000,
      currency: "INR",
      status: "processed",
      providerStatus: "processed",
    });

    txnDoc = await t.run(async (ctx) => ctx.db.get(txn.transactionId));
    expect(txnDoc?.status).toBe("refunded");
    expect(txnDoc?.refundedAmountMinor).toBe(10000);
  });

  // -------------------------------------------------------------------------
  // 10. Settlements from multiple providers
  // -------------------------------------------------------------------------
  test("10. Settlements from multiple providers are tracked in payment_settlements", async () => {
    const { t, admin, orgId } = await setupTestStore();

    const rzpConn = await admin.mutation(api.paymentGateways.saveConnection, {
      organizationId: orgId,
      provider: "razorpay",
      connectionType: "api_key",
      accountMode: "live",
      status: "connected",
    });

    const stripeConn = await admin.mutation(api.paymentGateways.saveConnection, {
      organizationId: orgId,
      provider: "stripe",
      connectionType: "api_key",
      accountMode: "live",
      status: "connected",
    });

    // Razorpay settlement
    await admin.mutation(api.paymentGateways.recordSettlement, {
      connectionId: rzpConn,
      providerSettlementId: "setl_Rzp_001",
      amountMinor: 500000, // ₹5000.00
      currency: "INR",
      feesMinor: 10000,    // ₹100.00
      taxMinor: 1800,      // ₹18.00
      netAmountMinor: 488200, // ₹4882.00
      status: "processed",
      providerStatus: "processed",
      settlementDate: Date.now(),
      utrOrReference: "UTR-HDFC-998822",
    });

    // Stripe settlement
    await admin.mutation(api.paymentGateways.recordSettlement, {
      connectionId: stripeConn,
      providerSettlementId: "po_Stripe_999",
      amountMinor: 100000, // $1000.00
      currency: "USD",
      feesMinor: 2900,
      taxMinor: 0,
      netAmountMinor: 97100,
      status: "processed",
      providerStatus: "paid",
      settlementDate: Date.now(),
      utrOrReference: "STRIPE_PAYOUT_123",
    });

    const settlements = await t.run(async (ctx) => {
      return await ctx.db.query("payment_settlements").collect();
    });

    expect(settlements.length).toBe(2);
    expect(settlements.find((s) => s.provider === "razorpay")?.netAmountMinor).toBe(488200);
    expect(settlements.find((s) => s.provider === "stripe")?.netAmountMinor).toBe(97100);
  });

  // -------------------------------------------------------------------------
  // 11. Webhook event storage
  // -------------------------------------------------------------------------
  test("11. Webhook events are stored with signature status and processing lifecycle", async () => {
    const { t, admin, orgId } = await setupTestStore();

    const webhookRes = await admin.mutation(api.paymentGateways.recordWebhookEvent, {
      organizationId: orgId,
      provider: "razorpay",
      providerEventId: "evt_webhook_rzp_1",
      eventType: "payment.captured",
      eventCategory: "payment",
      payload: JSON.stringify({ entity: "event", event: "payment.captured" }),
      signatureVerified: true,
      processingStatus: "verified",
    });

    expect(webhookRes.eventId).toBeDefined();

    const eventDoc = await t.run(async (ctx) => ctx.db.get(webhookRes.eventId));
    expect(eventDoc?.providerEventId).toBe("evt_webhook_rzp_1");
    expect(eventDoc?.signatureVerified).toBe(true);
    expect(eventDoc?.processingStatus).toBe("verified");
  });

  // -------------------------------------------------------------------------
  // 12. Duplicate webhook event prevention
  // -------------------------------------------------------------------------
  test("12. Duplicate webhook events are rejected idempotently", async () => {
    const { admin, orgId } = await setupTestStore();

    const first = await admin.mutation(api.paymentGateways.recordWebhookEvent, {
      organizationId: orgId,
      provider: "razorpay",
      providerEventId: "evt_duplicate_test_1",
      eventType: "order.paid",
      payload: JSON.stringify({ event: "order.paid" }),
      signatureVerified: true,
      processingStatus: "processed",
    });
    expect(first.alreadyExists).toBe(false);

    // Second duplicate attempt
    const second = await admin.mutation(api.paymentGateways.recordWebhookEvent, {
      organizationId: orgId,
      provider: "razorpay",
      providerEventId: "evt_duplicate_test_1",
      eventType: "order.paid",
      payload: JSON.stringify({ event: "order.paid" }),
      signatureVerified: true,
      processingStatus: "processed",
    });
    expect(second.alreadyExists).toBe(true);
    expect(second.eventId).toEqual(first.eventId);
  });

  // -------------------------------------------------------------------------
  // 13. Duplicate transaction prevention
  // -------------------------------------------------------------------------
  test("13. Duplicate transaction recording returns existing ID idempotently", async () => {
    const { admin, orgId } = await setupTestStore();

    const connId = await admin.mutation(api.paymentGateways.saveConnection, {
      organizationId: orgId,
      provider: "razorpay",
      connectionType: "api_key",
      accountMode: "live",
      status: "connected",
    });

    const first = await admin.mutation(api.paymentGateways.recordTransaction, {
      connectionId: connId,
      providerPaymentId: "pay_Idempotent_1",
      amountMinor: 25000,
      currency: "INR",
      paymentMethod: "upi",
      status: "captured",
      providerStatus: "captured",
    });
    expect(first.alreadyExists).toBe(false);

    // Duplicate call with same connectionId and providerPaymentId
    const second = await admin.mutation(api.paymentGateways.recordTransaction, {
      connectionId: connId,
      providerPaymentId: "pay_Idempotent_1",
      amountMinor: 25000,
      currency: "INR",
      paymentMethod: "upi",
      status: "captured",
      providerStatus: "captured",
    });
    expect(second.alreadyExists).toBe(true);
    expect(second.transactionId).toEqual(first.transactionId);
  });

  // -------------------------------------------------------------------------
  // 14. Sync run tracking
  // -------------------------------------------------------------------------
  test("14. Sync runs are recorded and connection lastSyncAt updated on success", async () => {
    const { t, admin, orgId } = await setupTestStore();

    const connId = await admin.mutation(api.paymentGateways.saveConnection, {
      organizationId: orgId,
      provider: "razorpay",
      connectionType: "api_key",
      accountMode: "live",
      status: "connected",
    });

    const runId = await admin.mutation(api.paymentGateways.recordSyncRun, {
      connectionId: connId,
      resourceType: "transactions",
      syncType: "incremental",
      status: "completed",
      startedAt: Date.now() - 5000,
      completedAt: Date.now(),
      recordsFetched: 15,
      recordsCreated: 3,
      recordsUpdated: 12,
      recordsSkipped: 0,
      errorCount: 0,
    });

    const runDoc = await t.run(async (ctx) => ctx.db.get(runId));
    expect(runDoc?.recordsFetched).toBe(15);
    expect(runDoc?.recordsCreated).toBe(3);
    expect(runDoc?.status).toBe("completed");

    const connDoc = await t.run(async (ctx) => ctx.db.get(connId));
    expect(connDoc?.lastSyncAt).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 15. Independent sync cursors
  // -------------------------------------------------------------------------
  test("15. Independent sync cursors for transactions, refunds, and settlements", async () => {
    const { t, admin, orgId } = await setupTestStore();

    const connId = await admin.mutation(api.paymentGateways.saveConnection, {
      organizationId: orgId,
      provider: "razorpay",
      connectionType: "api_key",
      accountMode: "live",
      status: "connected",
    });

    // Cursor for transactions
    await admin.mutation(api.paymentGateways.updateSyncCursor, {
      connectionId: connId,
      resourceType: "transactions",
      cursor: "pay_cursor_token_123",
      lastSuccessfulSyncAt: 1700000000000,
    });

    // Cursor for refunds
    await admin.mutation(api.paymentGateways.updateSyncCursor, {
      connectionId: connId,
      resourceType: "refunds",
      cursor: "rfnd_cursor_token_456",
      lastSuccessfulSyncAt: 1700000050000,
    });

    // Cursor for settlements
    await admin.mutation(api.paymentGateways.updateSyncCursor, {
      connectionId: connId,
      resourceType: "settlements",
      cursor: "setl_cursor_token_789",
      lastSuccessfulSyncAt: 1700000090000,
    });

    const cursors = await t.run(async (ctx) => {
      return await ctx.db
        .query("payment_sync_cursors")
        .withIndex("by_connection", (q) => q.eq("connectionId", connId))
        .collect();
    });

    expect(cursors.length).toBe(3);
    expect(cursors.find((c) => c.resourceType === "transactions")?.cursor).toBe("pay_cursor_token_123");
    expect(cursors.find((c) => c.resourceType === "refunds")?.cursor).toBe("rfnd_cursor_token_456");
    expect(cursors.find((c) => c.resourceType === "settlements")?.cursor).toBe("setl_cursor_token_789");
  });

  // -------------------------------------------------------------------------
  // 16. Correct organization/store scoping
  // -------------------------------------------------------------------------
  test("16. Scopes all gateway data strictly to the organization", async () => {
    const { admin: adminA, orgId: orgA } = await setupTestStore("Store Alpha", "clerk_alpha");
    const { admin: adminB, orgId: orgB } = await setupTestStore("Store Beta", "clerk_beta");

    // Connect Razorpay for Store Alpha
    await adminA.mutation(api.paymentGateways.saveConnection, {
      organizationId: orgA,
      provider: "razorpay",
      connectionType: "api_key",
      accountMode: "live",
      status: "connected",
    });

    // Connect Stripe for Store Beta
    await adminB.mutation(api.paymentGateways.saveConnection, {
      organizationId: orgB,
      provider: "stripe",
      connectionType: "api_key",
      accountMode: "live",
      status: "connected",
    });

    // Query Store Alpha connections
    const alphaConns = await adminA.query(api.paymentGateways.listConnections, {
      organizationId: orgA,
    });
    expect(alphaConns.length).toBe(1);
    expect(alphaConns[0].provider).toBe("razorpay");

    // Query Store Beta connections
    const betaConns = await adminB.query(api.paymentGateways.listConnections, {
      organizationId: orgB,
    });
    expect(betaConns.length).toBe(1);
    expect(betaConns[0].provider).toBe("stripe");
  });

  // -------------------------------------------------------------------------
  // 17. Credential protection
  // -------------------------------------------------------------------------
  test("17. Credential protection: public queries never expose secrets, decryption requires server key", async () => {
    const { admin, orgId } = await setupTestStore();

    const rawSecret = "rzp_secret_ultra_confidential_9988";
    const connId = await admin.mutation(api.paymentGateways.saveConnection, {
      organizationId: orgId,
      provider: "razorpay",
      connectionType: "api_key",
      providerAccountId: "rzp_live_K82HS91MNB0",
      accountMode: "live",
      status: "connected",
      rawCredentials: {
        keyId: "rzp_live_K82HS91MNB0",
        keySecret: rawSecret,
      },
    });

    // 1. Client query does NOT return encryptedCredentials or plaintext secrets
    const publicConn = await admin.query(api.paymentGateways.getConnection, { connectionId: connId });
    expect((publicConn as any).encryptedCredentials).toBeUndefined();
    expect((publicConn as any).keySecret).toBeUndefined();
    expect((publicConn as any).rawCredentials).toBeUndefined();
    expect(publicConn?.maskedKeyId).toBe("rzp_live••••MNB0");

    // 2. Encryption and Decryption roundtrip with key versioning
    const encrypted = await encryptCredentials({ keySecret: rawSecret }, 1);
    expect(encrypted.version).toBe(1);
    expect(encrypted.encryptedString).not.toContain(rawSecret);

    const decrypted = await decryptCredentials(encrypted.encryptedString);
    expect(decrypted.keySecret).toBe(rawSecret);
  });
});

