import { NextRequest, NextResponse } from "next/server";
import { requireStoreAdminContext } from "../../../../lib/payments/authHelper";
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

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    const connectionId = body?.connectionId;

    const result = await storeContext.storeConvexClient.mutation(
      api.paymentGateways.disconnectGatewayConnection,
      {
        connectionId,
        organizationId: storeContext.orgId,
        provider: "stripe",
      }
    );

    return NextResponse.json({
      success: true,
      message: "Stripe payment gateway disconnected successfully.",
      data: {
        connectionId: result.connectionId,
        provider: "stripe",
        status: "disconnected",
        disconnectedAt: result.disconnectedAt,
        historicalDataPreserved: true,
      },
    });
  } catch (err: any) {
    console.error("[Stripe Disconnect API Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to disconnect Stripe gateway.",
      },
      { status: 500 }
    );
  }
}

