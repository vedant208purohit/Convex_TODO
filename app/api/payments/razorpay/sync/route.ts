import { NextRequest, NextResponse } from "next/server";
import { getPaymentAdapter } from "../../../../lib/payments/registry";
import { requireStoreAdminContext } from "../../../../lib/payments/authHelper";
import { decryptCredentials } from "../../../../../convex/paymentGatewayCrypto";
import { PaymentSyncEngine } from "../../../../lib/payments/syncEngine";
import { api } from "../../../../../convex/_generated/api";

export const dynamic = "force-dynamic";

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
          code: "MISSING_CREDENTIALS",
          error: "No encrypted credentials found on active connection.",
        },
        { status: 400 }
      );
    }

    const decrypted = await decryptCredentials(connection.encryptedCredentials);
    if (!decrypted.keyId || !decrypted.keySecret) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_CREDENTIALS",
          error: "Stored credential bundle is missing keyId or keySecret.",
        },
        { status: 400 }
      );
    }

    const adapter = getPaymentAdapter("razorpay");
    const credentials = {
      keyId: decrypted.keyId,
      keySecret: decrypted.keySecret,
    };

    const effectiveConnId = connection.connectionId || connection._id;

    const [txResult, rfResult, stlResult] = await Promise.allSettled([
      PaymentSyncEngine.syncTransactions({
        convexClient: storeContext.storeConvexClient,
        connectionId: effectiveConnId,
        adapter,
        credentials,
        syncType: "manual",
      }),
      PaymentSyncEngine.syncRefunds({
        convexClient: storeContext.storeConvexClient,
        connectionId: effectiveConnId,
        adapter,
        credentials,
        syncType: "manual",
      }),
      PaymentSyncEngine.syncSettlements({
        convexClient: storeContext.storeConvexClient,
        connectionId: effectiveConnId,
        adapter,
        credentials,
        syncType: "manual",
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Razorpay synchronization completed successfully.",
      syncedAt: Date.now(),
      results: {
        transactions: txResult.status === "fulfilled" ? txResult.value : { error: (txResult as any).reason?.message },
        refunds: rfResult.status === "fulfilled" ? rfResult.value : { error: (rfResult as any).reason?.message },
        settlements: stlResult.status === "fulfilled" ? stlResult.value : { error: (stlResult as any).reason?.message },
      },
    });
  } catch (err: any) {
    console.error("[Razorpay Sync Route Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to trigger payment synchronization.",
      },
      { status: 500 }
    );
  }
}

