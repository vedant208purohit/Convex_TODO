import { NextRequest, NextResponse } from "next/server";
import { getPaymentAdapter } from "../../../../lib/payments/registry";
import { requireStoreAdminContext } from "../../../../lib/payments/authHelper";
import { decryptCredentials } from "../../../../../convex/paymentGatewayCrypto";
import { PaymentSyncEngine } from "../../../../lib/payments/syncEngine";
import { api } from "../../../../../convex/_generated/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    let storeContext: any;
    try {
      storeContext = await requireStoreAdminContext(req);
    } catch (authErr: any) {
      return NextResponse.json(
        {
          success: false,
          code: authErr.code || "UNAUTHORIZED",
          error: authErr.message || "Unauthorized access.",
        },
        { status: authErr.status || 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "10", 10), 1), 100);
    const status = searchParams.get("status") || undefined;
    const providerPaymentId = searchParams.get("payment_id") || undefined;
    const search = searchParams.get("search") || undefined;
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const shouldSync = searchParams.get("sync") === "true";

    const from = fromParam ? parseInt(fromParam, 10) : undefined;
    const to = toParam ? parseInt(toParam, 10) : undefined;

    const connection = await storeContext.storeConvexClient.query(
      api.paymentGateways.getConnectionCredentials,
      {
        organizationId: storeContext.orgId,
        provider: "razorpay",
      }
    );

    if (!connection) {
      return NextResponse.json(
        {
          success: false,
          code: "CONNECTION_NOT_FOUND",
          error: "No Razorpay connection found for this store. Please connect Razorpay in Marketplace.",
        },
        { status: 404 }
      );
    }

    if (connection.status !== "connected") {
      return NextResponse.json(
        {
          success: false,
          code: "CONNECTION_NOT_ACTIVE",
          error: `Razorpay connection is not active (current status: "${connection.status}").`,
        },
        { status: 400 }
      );
    }

    let syncResult = null;
    if (shouldSync && connection.encryptedCredentials) {
      try {
        const decryptedCreds = await decryptCredentials(connection.encryptedCredentials);
        const adapter = getPaymentAdapter("razorpay");

        syncResult = await PaymentSyncEngine.syncRefunds({
          convexClient: storeContext.storeConvexClient,
          connectionId: connection.connectionId,
          adapter,
          credentials: {
            keyId: decryptedCreds.keyId || "",
            keySecret: decryptedCreds.keySecret || "",
          },
          syncType: "manual",
          fromEpochMs: from,
          toEpochMs: to,
        });
      } catch (syncErr: any) {
        console.warn("Incremental refund sync error (continuing with cached records):", syncErr.message);
      }
    }

    const queryResult = await storeContext.storeConvexClient.query(
      api.paymentGateways.listRefunds,
      {
        organizationId: storeContext.orgId,
        connectionId: connection.connectionId,
        status,
        providerPaymentId,
        from,
        to,
        search,
        page,
        limit,
      }
    );

    return NextResponse.json({
      success: true,
      refunds: queryResult.refunds,
      pagination: {
        page: queryResult.page,
        limit: queryResult.limit,
        total: queryResult.total,
        hasMore: queryResult.hasMore,
      },
      filters: {
        status: status || null,
        payment_id: providerPaymentId || null,
        from: from || null,
        to: to || null,
        search: search || null,
      },
      syncResult: syncResult || undefined,
    });
  } catch (err: any) {
    const adapter = getPaymentAdapter("razorpay");
    const normalized = adapter.normalizeError(err);
    return NextResponse.json(
      {
        success: false,
        code: normalized.code,
        error: normalized.message,
      },
      { status: normalized.httpStatus }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let storeContext: any;
    try {
      storeContext = await requireStoreAdminContext(req);
    } catch (authErr: any) {
      return NextResponse.json(
        {
          success: false,
          code: authErr.code || "UNAUTHORIZED",
          error: authErr.message || "Unauthorized access.",
        },
        { status: authErr.status || 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const paymentId = (body.payment_id || body.paymentId || "").trim();
    const requestedAmountMinor = body.amount !== undefined ? Number(body.amount) : undefined;
    const speed = body.speed || "normal";
    const notes = body.notes || {};

    if (!paymentId) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_PAYMENT_ID",
          error: "payment_id is required to process a refund.",
        },
        { status: 400 }
      );
    }

    // 1. Verify payment eligibility and refundable balance in store records
    const txnEligibility = await storeContext.storeConvexClient.query(
      api.paymentGateways.getTransactionForRefund,
      {
        organizationId: storeContext.orgId,
        providerPaymentId: paymentId,
      }
    );

    if (!txnEligibility) {
      return NextResponse.json(
        {
          success: false,
          code: "PAYMENT_NOT_FOUND",
          error: `Payment "${paymentId}" was not found in this store's transactions.`,
        },
        { status: 404 }
      );
    }

    if (!txnEligibility.isEligibleForRefund) {
      return NextResponse.json(
        {
          success: false,
          code: "PAYMENT_INELIGIBLE_FOR_REFUND",
          error: `Payment "${paymentId}" is not eligible for refund (current status: "${txnEligibility.status}", remaining balance: ₹${(txnEligibility.refundableBalanceMinor / 100).toFixed(2)}).`,
        },
        { status: 400 }
      );
    }

    // Determine refund amount in minor units
    let finalAmountMinor: number;
    if (requestedAmountMinor !== undefined) {
      if (!Number.isInteger(requestedAmountMinor) || requestedAmountMinor <= 0) {
        return NextResponse.json(
          {
            success: false,
            code: "INVALID_REFUND_AMOUNT",
            error: "Refund amount must be a positive integer in minor units (paise).",
          },
          { status: 400 }
        );
      }
      if (requestedAmountMinor > txnEligibility.refundableBalanceMinor) {
        return NextResponse.json(
          {
            success: false,
            code: "REFUND_AMOUNT_EXCEEDS_BALANCE",
            error: `Requested refund of ₹${(requestedAmountMinor / 100).toFixed(2)} exceeds remaining refundable balance of ₹${(txnEligibility.refundableBalanceMinor / 100).toFixed(2)}.`,
          },
          { status: 400 }
        );
      }
      finalAmountMinor = requestedAmountMinor;
    } else {
      // Full refund
      finalAmountMinor = txnEligibility.refundableBalanceMinor;
    }

    // 2. Resolve credentials for gateway connection
    const connection = await storeContext.storeConvexClient.query(
      api.paymentGateways.getConnectionCredentials,
      {
        connectionId: txnEligibility.connectionId,
        organizationId: storeContext.orgId,
      }
    );

    if (!connection || connection.status !== "connected") {
      return NextResponse.json(
        {
          success: false,
          code: "CONNECTION_NOT_ACTIVE",
          error: "Associated Razorpay gateway connection is not active.",
        },
        { status: 400 }
      );
    }

    const decrypted = await decryptCredentials(connection.encryptedCredentials!);

    // 3. Call Razorpay API to execute the refund
    const adapter = getPaymentAdapter("razorpay");
    const refundResult = await adapter.createRefund(
      { keyId: decrypted.keyId || "", keySecret: decrypted.keySecret || "" },
      paymentId,
      {
        amount: finalAmountMinor,
        speed: speed === "optimum" ? "optimum" : "normal",
        notes,
      }
    );

    // 4. Record refund in database and update transaction state
    const recordResult = await storeContext.storeConvexClient.mutation(
      api.paymentGateways.recordRefund,
      {
        connectionId: connection.connectionId,
        transactionId: txnEligibility.transactionId,
        providerPaymentId: paymentId,
        providerRefundId: refundResult.providerRefundId,
        amountMinor: refundResult.amountMinor,
        currency: refundResult.currency,
        status: refundResult.status,
        providerStatus: refundResult.providerStatus,
        speed: refundResult.speed,
        reason: refundResult.reason,
        initiatedAt: refundResult.initiatedAt,
        processedAt: refundResult.processedAt,
        errorCode: refundResult.errorCode,
        errorMessage: refundResult.errorMessage,
        metadata: refundResult.metadata,
      }
    );

    return NextResponse.json({
      success: true,
      message: `Refund of ₹${(finalAmountMinor / 100).toFixed(2)} initiated successfully.`,
      refund: {
        refundId: recordResult.refundId,
        providerRefundId: refundResult.providerRefundId,
        providerPaymentId: paymentId,
        amountMinor: refundResult.amountMinor,
        currency: refundResult.currency,
        status: refundResult.status,
        providerStatus: refundResult.providerStatus,
        speed: refundResult.speed || speed,
        initiatedAt: refundResult.initiatedAt,
        processedAt: refundResult.processedAt,
      },
    });
  } catch (err: any) {
    const adapter = getPaymentAdapter("razorpay");
    const normalized = adapter.normalizeError(err);
    return NextResponse.json(
      {
        success: false,
        code: normalized.code,
        error: normalized.message,
      },
      { status: normalized.httpStatus }
    );
  }
}
