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
