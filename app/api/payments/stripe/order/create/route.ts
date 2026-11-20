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
    const storeCurrency = storeContext.storeCurrency || "USD";
    const { amountMinor, currency, receipt, internalOrderId, notes } = body;
    const resolvedCurrency = (currency || storeCurrency).toUpperCase();

    const parsedAmount = Math.round(Number(amountMinor || 0));
    if (!parsedAmount || parsedAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_AMOUNT",
          error: "amountMinor must be a positive integer in currency minor units (cents).",
        },
        { status: 400 }
      );
    }

    // 1. Resolve store's active Stripe connection
    const connection = await storeContext.storeConvexClient.query(
      api.paymentGateways.getConnectionCredentials,
      {
        organizationId: storeContext.orgId,
        provider: "stripe",
      }
    );

    if (!connection || connection.status !== "connected" || !connection.encryptedCredentials) {
      return NextResponse.json(
        {
          success: false,
          code: "GATEWAY_NOT_CONNECTED",
          error: "No active Stripe payment gateway configured for this store.",
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

    // 3. Create PaymentIntent via Stripe Adapter
    const adapter = getPaymentAdapter("stripe");
    const orderResult = await adapter.createPaymentOrder!(
      {
        keyId: decrypted.keyId,
        keySecret: decrypted.keySecret,
      },
      {
        amountMinor: parsedAmount,
        currency: resolvedCurrency,
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
          error: orderResult.error || "Failed to create payment intent with Stripe.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      provider: "stripe",
      paymentIntentId: orderResult.orderId,
      orderId: orderResult.orderId,
      amountMinor: orderResult.amountMinor,
      currency: orderResult.currency,
      publishableKey: decrypted.keyId,
      receipt: orderResult.receipt,
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

