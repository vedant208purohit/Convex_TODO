import { NextRequest, NextResponse } from "next/server";
import { requireStoreAdminContext } from "../../../../lib/payments/authHelper";
import { api } from "../../../../../convex/_generated/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate caller and verify admin authorization
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

    // 2. Resolve target connection
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    const connectionId = body?.connectionId;

    // 3. Disconnect connection in Convex
    // Preserves all financial transactions, refunds, settlements, and sync logs.
    const result = await storeContext.storeConvexClient.mutation(
      api.paymentGateways.disconnectGatewayConnection,
      {
        connectionId,
        organizationId: storeContext.orgId,
        provider: "razorpay",
      }
    );

    return NextResponse.json({
      success: true,
      message: "Razorpay payment gateway disconnected successfully.",
      data: {
        connectionId: result.connectionId,
        provider: "razorpay",
        status: "disconnected",
        disconnectedAt: result.disconnectedAt,
        historicalDataPreserved: true,
      },
    });
  } catch (err: any) {
    console.error("[Razorpay Disconnect API Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to disconnect Razorpay gateway.",
      },
      { status: 500 }
    );
  }
}
