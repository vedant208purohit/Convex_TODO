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
        provider: "stripe",
      }
    );

    if (!connection) {
      return NextResponse.json(
        {
          success: false,
          code: "CONNECTION_NOT_FOUND",
          error: "No Stripe connection found for this store. Please connect Stripe in Marketplace.",
        },
        { status: 404 }
      );
    }

    if (connection.status !== "connected") {
      return NextResponse.json(
        {
          success: false,
          code: "CONNECTION_NOT_ACTIVE",
          error: `Stripe connection is not active (current status: "${connection.status}").`,
        },
        { status: 400 }
      );
    }

    let syncResult = null;
    if (shouldSync && connection.encryptedCredentials) {
      try {
        const decryptedCreds = await decryptCredentials(connection.encryptedCredentials);
        const adapter = getPaymentAdapter("stripe");

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
      data: queryResult.refunds,
      kpis: queryResult.kpis,
      pagination: {
        page: queryResult.page,
        limit: queryResult.limit,
        total: queryResult.total,
        totalPages: queryResult.totalPages,
        hasMore: queryResult.hasMore,
      },
      sync: syncResult
        ? {
            performed: true,
            status: syncResult.status,
            created: syncResult.recordsCreated,
            updated: syncResult.recordsUpdated,
          }
        : { performed: false },
    });
  } catch (err: any) {
    console.error("[Stripe Refunds GET Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed retrieving refunds.",
      },
      { status: 500 }
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
    const rawAmount = body.amountMinor ?? body.amount_minor ?? body.amount;
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
          error: `Payment "${paymentId}" is not eligible for refund (current status: "${txnEligibility.status}", remaining balance: ${(txnEligibility.refundableBalanceMinor / 100).toFixed(2)}).`,
        },
        { status: 400 }
      );
    }

    // Determine refund amount in minor units
    let effectiveAmountMinor = txnEligibility.refundableBalanceMinor;

    if (rawAmount !== undefined && rawAmount !== null) {
      const parsed = Number(rawAmount);
      if (isNaN(parsed) || parsed <= 0) {
        return NextResponse.json(
          {
            success: false,
            code: "INVALID_REFUND_AMOUNT",
            error: "Refund amount must be greater than zero.",
          },
          { status: 400 }
        );
      }

      // If parsed is a decimal (e.g. 44.50) or if parsed <= txnEligibility.refundableBalanceMinor / 100,
      // it was passed in major currency units (e.g. ₹44.00 or $44.00). Convert to integer minor units!
      let resolvedMinor: number;
      if (
        !Number.isInteger(parsed) ||
        (parsed <= txnEligibility.refundableBalanceMinor / 100 &&
          parsed * 100 <= txnEligibility.refundableBalanceMinor)
      ) {
        resolvedMinor = Math.round(parsed * 100);
      } else {
        resolvedMinor = Math.round(parsed);
      }

      if (resolvedMinor <= 0) {
        return NextResponse.json(
          {
            success: false,
            code: "INVALID_REFUND_AMOUNT",
            error: "Refund amount must be a positive integer in minor units.",
          },
          { status: 400 }
        );
      }

      if (resolvedMinor > txnEligibility.refundableBalanceMinor) {
        return NextResponse.json(
          {
            success: false,
            code: "REFUND_AMOUNT_EXCEEDS_BALANCE",
            error: `Requested refund of ${(resolvedMinor / 100).toFixed(2)} exceeds remaining refundable balance of ${(txnEligibility.refundableBalanceMinor / 100).toFixed(2)}.`,
          },
          { status: 400 }
        );
      }
      effectiveAmountMinor = resolvedMinor;
    }

    if (effectiveAmountMinor <= 0) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REFUND_AMOUNT",
          error: "Refund amount must be greater than zero.",
        },
        { status: 400 }
      );
    }

    const idempotencyKey =
      req.headers.get("idempotency-key") ||
      body.idempotencyKey ||
      `ref_${paymentId}_${Date.now()}`;

    // 2. Reserve refund atomically
    const reservation = await storeContext.storeConvexClient.mutation(
      api.paymentGateways.reserveRefund,
      {
        organizationId: storeContext.orgId,
        connectionId: txnEligibility.connectionId,
        providerPaymentId: paymentId,
        amountMinor: effectiveAmountMinor,
        currency: txnEligibility.currency,
        idempotencyKey,
        reason: notes.reason || "Customer refund requested via POS",
        speed,
        metadata: {
          ...notes,
          idempotencyKey,
          source: "stripe_refunds_api",
        },
      }
    );

    if (reservation.alreadyProcessed && reservation.existingRefund) {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        refund: reservation.existingRefund,
      });
    }

    // 3. Resolve active connection credentials
    const connection = await storeContext.storeConvexClient.query(
      api.paymentGateways.getConnectionCredentials,
      {
        connectionId: txnEligibility.connectionId,
      }
    );

    if (!connection || !connection.encryptedCredentials) {
      await storeContext.storeConvexClient.mutation(
        api.paymentGateways.cancelReservedRefund,
        {
          refundId: reservation.refundId,
          error: "Credentials missing on active gateway connection.",
        }
      );

      return NextResponse.json(
        {
          success: false,
          code: "CREDENTIALS_MISSING",
          error: "Payment gateway credentials are not configured or available.",
        },
        { status: 400 }
      );
    }

    let credentials: any;
    try {
      credentials = await decryptCredentials(connection.encryptedCredentials);
    } catch {
      await storeContext.storeConvexClient.mutation(
        api.paymentGateways.cancelReservedRefund,
        {
          refundId: reservation.refundId,
          error: "Failed to decrypt gateway credentials.",
        }
      );

      return NextResponse.json(
        {
          success: false,
          code: "CREDENTIAL_DECRYPTION_FAILED",
          error: "Could not decrypt connection credentials.",
        },
        { status: 500 }
      );
    }

    const adapter = getPaymentAdapter("stripe");

    // 4. Execute refund against Stripe API
    let refundResult: any;
    try {
      refundResult = await adapter.createRefund(
        { keyId: credentials.keyId, keySecret: credentials.keySecret },
        paymentId,
        {
          amount: effectiveAmountMinor,
          speed,
          notes: {
            ...notes,
            idempotencyKey,
          },
        }
      );
    } catch (createErr: any) {
      await storeContext.storeConvexClient.mutation(
        api.paymentGateways.cancelReservedRefund,
        {
          refundId: reservation.refundId,
          error: createErr.message || "Stripe refund execution failed.",
        }
      );

      const normalized = adapter.normalizeError(createErr);
      return NextResponse.json(
        {
          success: false,
          code: normalized.code || "REFUND_EXECUTION_FAILED",
          error: normalized.message || "Failed to process refund with Stripe.",
        },
        { status: normalized.httpStatus || 400 }
      );
    }

    // 5. Update refund record in Convex
    await storeContext.storeConvexClient.mutation(
      api.paymentGateways.recordRefund,
      {
        connectionId: txnEligibility.connectionId,
        providerRefundId: refundResult.providerRefundId,
        providerPaymentId: paymentId,
        amountMinor: refundResult.amountMinor || effectiveAmountMinor,
        currency: refundResult.currency || txnEligibility.currency,
        reason: notes.reason || "Customer refund requested",
        status: refundResult.status || "processed",
        providerStatus: refundResult.providerStatus || "succeeded",
        speed,
        initiatedAt: refundResult.initiatedAt || Date.now(),
        processedAt: refundResult.processedAt,
        metadata: {
          ...notes,
          idempotencyKey,
        },
      }
    );

    return NextResponse.json({
      success: true,
      refund: {
        providerRefundId: refundResult.providerRefundId,
        providerPaymentId: paymentId,
        amountMinor: effectiveAmountMinor,
        currency: txnEligibility.currency,
        status: refundResult.status || "processed",
        providerStatus: refundResult.providerStatus || "succeeded",
        speed,
        initiatedAt: refundResult.initiatedAt || Date.now(),
        processedAt: refundResult.processedAt,
      },
    });
  } catch (err: any) {
    console.error("[Stripe Refunds POST Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed creating refund.",
      },
      { status: 500 }
    );
  }
}

