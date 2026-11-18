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
        console.warn("Incremental payout sync error (continuing with cached records):", syncErr.message);
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
      payouts: queryResult.settlements,
      data: queryResult.settlements,
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
    console.error("[Stripe Payouts GET Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed retrieving payouts.",
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
    const amountMinor = body.amountMinor || body.amount;
    const currency = body.currency || "USD";
    const description = body.description || "PREST POS Stripe Payout Request";
    const notes = body.notes;
    const idempotencyKey =
      req.headers.get("Idempotency-Key") || body.idempotencyKey || `po_req_${Date.now()}`;

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
          error: "Payout amount must be a positive integer in minor units (cents).",
        },
        { status: 400 }
      );
    }

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
          error: "No Stripe connection found for this store.",
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

    const adapter = getPaymentAdapter("stripe");
    if (!adapter.requestSettlement) {
      return NextResponse.json(
        {
          success: false,
          code: "OPERATION_NOT_SUPPORTED",
          error: "Manual payout requests are not supported by the payment adapter.",
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
          code: result.code || "PAYOUT_REQUEST_FAILED",
          error: result.error || "Failed to process payout request with Stripe.",
        },
        { status: 400 }
      );
    }

    // Record payout idempotently in Convex
    await storeContext.storeConvexClient.mutation(
      api.paymentGateways.recordSettlement,
      {
        connectionId: connection.connectionId,
        providerSettlementId: result.settlement.providerSettlementId,
        amountMinor: result.settlement.amountMinor,
        currency: result.settlement.currency,
        feesMinor: result.settlement.feesMinor || 0,
        taxMinor: result.settlement.taxMinor || 0,
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
    const adapter = getPaymentAdapter("stripe");
    const normalized = adapter.normalizeError(err);
    return NextResponse.json(
      {
        success: false,
        code: normalized.code,
        error: normalized.message,
      },
      { status: normalized.httpStatus || 500 }
    );
  }
}

