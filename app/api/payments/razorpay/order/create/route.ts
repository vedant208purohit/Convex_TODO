import { NextRequest, NextResponse } from "next/server";
import { getPaymentAdapter } from "../../../../../lib/payments/registry";
import { requireStoreAdminContext } from "../../../../../lib/payments/authHelper";
import { decryptCredentials } from "../../../../../../convex/paymentGatewayCrypto";
import { api } from "../../../../../../convex/_generated/api";

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

    const body = await req.json().catch(() => ({}));
    const { amountMinor, currency = "INR", receipt, internalOrderId, notes } = body;

    const parsedAmount = Math.round(Number(amountMinor || 0));
    if (!parsedAmount || parsedAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_AMOUNT",
          error: "amountMinor must be a positive integer in currency minor units.",
        },
        { status: 400 }
      );
    }

    // 1. Resolve store's active Razorpay connection
    const connection = await storeContext.storeConvexClient.query(
      api.paymentGateways.getConnectionCredentials,
      {
        organizationId: storeContext.orgId,
        provider: "razorpay",
      }
    );

    if (!connection || connection.status !== "connected" || !connection.encryptedCredentials) {
      return NextResponse.json(
        {
          success: false,
          code: "GATEWAY_NOT_CONNECTED",
          error: "No active Razorpay payment gateway configured for this store.",
        },
        { status: 400 }
      );
    }

    // 2. Decrypt credentials securely on server
    const decrypted = await decryptCredentials(connection.encryptedCredentials);
    if (!decrypted.keyId || !decrypted.keySecret) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_CREDENTIALS",
          error: "Stored gateway credentials are invalid.",
        },
        { status: 500 }
      );
    }

    // 3. Create Order via Razorpay Adapter
    const adapter = getPaymentAdapter("razorpay");
    const orderResult = await adapter.createPaymentOrder!(
      {
        keyId: decrypted.keyId,
        keySecret: decrypted.keySecret,
      },
      {
        amountMinor: parsedAmount,
        currency: currency.toUpperCase(),
        receipt: receipt || `rcpt_pos_${Date.now().toString().slice(-8)}`,
        internalOrderId,
        notes,
      }
    );

    if (!orderResult.success || !orderResult.orderId) {
      return NextResponse.json(
        {
          success: false,
          code: orderResult.code || "ORDER_CREATION_FAILED",
          error: orderResult.error || "Failed to create payment order with provider.",
        },
        { status: 400 }
      );
    }

    // 4. Return safe checkout payload to client (NEVER expose keySecret)
    return NextResponse.json({
      success: true,
      provider: "razorpay",
      orderId: orderResult.orderId,
      amountMinor: parsedAmount,
      currency: currency.toUpperCase(),
      keyId: decrypted.keyId, // Public Key ID required by checkout modal
      connectionId: connection._id,
      internalOrderId,
    });
  } catch (err: any) {
    console.error("[Razorpay Order Create API Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to initiate payment order.",
      },
      { status: 500 }
    );
  }
}

