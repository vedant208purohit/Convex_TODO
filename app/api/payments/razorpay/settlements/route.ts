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

        syncResult = await PaymentSyncEngine.syncSettlements({
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
        console.warn("Incremental settlement sync error (continuing with cached records):", syncErr.message);
      }
    }

    const queryResult = await storeContext.storeConvexClient.query(
      api.paymentGateways.listSettlements,
      {
        organizationId: storeContext.orgId,
        connectionId: connection.connectionId,
        status,
        from,
        to,
        search,
        page,
        limit,
      }
    );

    return NextResponse.json({
      success: true,
      settlements: queryResult.settlements,
      pagination: {
        page: queryResult.page,
        limit: queryResult.limit,
        total: queryResult.total,
        hasMore: queryResult.hasMore,
      },
      filters: {
        status: status || null,
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
    const amountMinor = body.amountMinor;
    const currency = body.currency || "INR";
    const description = body.description || "PREST Marketplace Settlement Request";
    const notes = body.notes;
    const idempotencyKey =
      req.headers.get("Idempotency-Key") || body.idempotencyKey || `req_${Date.now()}`;

    if (
      !amountMinor ||
      typeof amountMinor !== "number" ||
      amountMinor <= 0 ||
      !Number.isInteger(amountMinor)
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_AMOUNT",
          error: "Settlement amount must be a positive integer in minor units.",
        },
        { status: 400 }
      );
    }

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
          error: "No Razorpay connection found for this store.",
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

    if (!connection.encryptedCredentials) {
      return NextResponse.json(
        {
          success: false,
          code: "CREDENTIALS_MISSING",
          error: "No credentials found for this payment connection.",
        },
        { status: 400 }
      );
    }

    let credentials: any;
    try {
      credentials = await decryptCredentials(connection.encryptedCredentials);
    } catch {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_CREDENTIALS",
          error: "Failed to decrypt gateway credentials.",
        },
        { status: 500 }
      );
    }

    const adapter = getPaymentAdapter("razorpay");
    if (!adapter.requestSettlement) {
      return NextResponse.json(
        {
          success: false,
          code: "OPERATION_NOT_SUPPORTED",
          error: "Manual settlement requests are not supported by the payment adapter.",
        },
        { status: 400 }
      );
    }

    const result = await adapter.requestSettlement(
      { keyId: credentials.keyId, keySecret: credentials.keySecret },
      { amountMinor, currency, description, notes: { ...notes, idempotencyKey } }
    );

    if (!result.success || !result.settlement) {
      return NextResponse.json(
        {
          success: false,
          code: result.code || "SETTLEMENT_REQUEST_FAILED",
          error: result.error || "Failed to process settlement request with Razorpay.",
        },
        { status: 400 }
      );
    }

    // Record settlement idempotently in Convex
    await storeContext.storeConvexClient.mutation(
      api.paymentGateways.recordSettlement,
      {
        connectionId: connection.connectionId,
        providerSettlementId: result.settlement.providerSettlementId,
        amountMinor: result.settlement.amountMinor,
        currency: result.settlement.currency,
        feesMinor: result.settlement.feesMinor,
        taxMinor: result.settlement.taxMinor,
        netAmountMinor: result.settlement.netAmountMinor,
        status: result.settlement.status,
        providerStatus: result.settlement.providerStatus,
        settlementDate: result.settlement.settlementDate,
        utrOrReference: result.settlement.utrOrReference,
        metadata: {
          ...result.settlement.metadata,
          idempotencyKey,
          requestedAt: Date.now(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      settlement: result.settlement,
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
