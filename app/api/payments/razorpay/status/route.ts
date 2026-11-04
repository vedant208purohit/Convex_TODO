import { NextRequest, NextResponse } from "next/server";
import { requireStoreAdminContext } from "../../../../lib/payments/authHelper";
import { api } from "../../../../../convex/_generated/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate caller and verify store admin context
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

    // 2. Query public connection safe from secrets
    const connections = await storeContext.storeConvexClient.query(
      api.paymentGateways.listConnections,
      {
        organizationId: storeContext.orgId,
        provider: "razorpay",
      }
    );

    const connection =
      connections.find((c: any) => c.status === "connected") ||
      connections.find((c: any) => c.status === "disconnected") ||
      connections.find((c: any) => c.status === "needs_attention") ||
      connections[0];

    if (!connection) {
      return NextResponse.json({
        success: true,
        data: {
          provider: "razorpay",
          connected: false,
          status: "not_connected",
          connectionType: "api_key",
          accountMode: "test",
          connectedAt: null,
          lastVerifiedAt: null,
          disconnectedAt: null,
          canReconnect: false,
          message: "No Razorpay gateway account connected to this store.",
        },
      });
    }

    const isConnected = connection.status === "connected";
    const canReconnect = connection.status === "disconnected" || connection.status === "needs_attention";

    let safeMessage = "Razorpay gateway is active and operating normally.";
    if (connection.status === "disconnected") {
      safeMessage = "Gateway connection was disconnected by store administrator.";
    } else if (connection.status === "needs_attention") {
      safeMessage = "Credentials require verification or attention.";
    }

    return NextResponse.json({
      success: true,
      data: {
        id: connection._id,
        provider: "razorpay",
        connected: isConnected,
        status: connection.status,
        connectionType: connection.connectionType,
        accountMode: connection.accountMode,
        merchantName: connection.merchantName,
        maskedKeyId: connection.maskedKeyId,
        connectedAt: connection.connectedAt || null,
        lastVerifiedAt: connection.lastVerifiedAt || null,
        disconnectedAt: connection.disconnectedAt || null,
        canReconnect,
        message: safeMessage,
      },
    });
  } catch (err: any) {
    console.error("[Razorpay Status API Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to retrieve connection status.",
      },
      { status: 500 }
    );
  }
}
