import { NextRequest, NextResponse } from "next/server";
import { requireStoreAdminContext } from "../../../../../lib/payments/authHelper";
import { api } from "../../../../../../convex/_generated/api";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_ID",
          error: "Payout identifier is required.",
        },
        { status: 400 }
      );
    }

    const settlement = await storeContext.storeConvexClient.query(
      api.paymentGateways.getSettlement,
      {
        organizationId: storeContext.orgId,
        settlementId: id,
      }
    );

    if (!settlement) {
      return NextResponse.json(
        {
          success: false,
          code: "SETTLEMENT_NOT_FOUND",
          error: `Payout record "${id}" was not found or does not belong to this store.`,
        },
        { status: 404 }
      );
    }

    // Resolve destination bank account
    const rawBank =
      settlement.metadata?.bankAccount ||
      settlement.metadata?.bankName ||
      "Stripe Settlement Bank •••• 4242";
    const last4 = String(rawBank).replace(/\D/g, "").slice(-4) || "4242";
    const bankName = settlement.metadata?.bankName || "Stripe Settlement Bank";
    const maskedAccount = `${bankName} •••• ${last4}`;

    // Build timeline events from persisted record
    const timelineEvents: Array<{
      id: string;
      title: string;
      status: "completed" | "current" | "pending" | "failed";
      timestamp?: number;
      description?: string;
    }> = [];

    // Event 1: Request Submitted
    timelineEvents.push({
      id: "submitted",
      title: "Request Submitted",
      status: "completed",
      timestamp: settlement.createdAt || settlement.settlementDate,
    });

    // Event 2: Processing / Processed
    if (settlement.status === "processed") {
      timelineEvents.push({
        id: "processed",
        title: "Processed",
        status: "completed",
        timestamp: settlement.updatedAt || settlement.settlementDate,
      });
    } else if (settlement.status === "failed") {
      timelineEvents.push({
        id: "failed",
        title: "Failed",
        status: "failed",
        timestamp: settlement.updatedAt || settlement.settlementDate,
        description: settlement.metadata?.errorDescription || "Gateway rejected payout.",
      });
    } else {
      timelineEvents.push({
        id: "processing",
        title: "In Transit / Processing",
        status: "current",
        timestamp: settlement.updatedAt,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...settlement,
        bankAccount: maskedAccount,
        bankName,
        timelineEvents,
      },
    });
  } catch (err: any) {
    console.error("[Stripe Single Settlement GET Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed retrieving payout details.",
      },
      { status: 500 }
    );
  }
}

