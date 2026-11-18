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
    const { paymentIntentId, paymentId, stripeOrderId, internalOrderId } = body;
    const effectivePaymentId = paymentIntentId || paymentId || stripeOrderId;

    if (!effectivePaymentId) {
      return NextResponse.json(
        {
          success: false,
          code: "MISSING_FIELDS",
          error: "paymentIntentId is required.",
        },
        { status: 400 }
      );
    }

    // 1. Resolve store's connection and credentials
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

    const decrypted = await decryptCredentials(connection.encryptedCredentials);
    if (!decrypted.keySecret || !decrypted.keyId) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_CREDENTIALS",
          error: "Stored gateway credentials missing keys.",
        },
        { status: 500 }
      );
    }

    // 2. Retrieve verified payment details from Stripe REST API
    const adapter = getPaymentAdapter("stripe");
    let paymentData: any = null;
    try {
      paymentData = await adapter.fetchPayment!(
        {
          keyId: decrypted.keyId!,
          keySecret: decrypted.keySecret!,
        },
        effectivePaymentId
      );
    } catch (fetchErr: any) {
      return NextResponse.json(
        {
          success: false,
          code: "PAYMENT_NOT_FOUND",
          error: fetchErr.message || "Failed verifying payment with Stripe.",
        },
        { status: 404 }
      );
    }

    if (paymentData.status !== "captured" && paymentData.status !== "authorized") {
      return NextResponse.json(
        {
          success: false,
          code: "PAYMENT_NOT_CAPTURED",
          error: `Payment is not captured (current status: "${paymentData.status}").`,
          paymentStatus: paymentData.status,
        },
        { status: 400 }
      );
    }

    // 3. Atomically record transaction in Convex
    const recordResult = await storeContext.storeConvexClient.mutation(
      api.paymentGateways.recordTransaction,
      {
        organizationId: storeContext.orgId,
        connectionId: connection.connectionId,
        providerPaymentId: effectivePaymentId,
        providerOrderId: paymentData.providerOrderId,
        internalOrderId,
        customerName: paymentData.customerName,
        customerEmail: paymentData.customerEmail,
        customerPhone: paymentData.customerPhone,
        amountMinor: paymentData.amountMinor,
        currency: paymentData.currency,
        paymentMethod: paymentData.paymentMethod || "card",
        status: paymentData.status,
        providerStatus: paymentData.providerStatus,
        paidAt: paymentData.paidAt || Date.now(),
        metadata: {
          ...paymentData.metadata,
          verifiedVia: "pos_order_verify",
        },
      }
    );

    return NextResponse.json({
      success: true,
      verified: true,
      transactionId: recordResult.transactionId,
      providerPaymentId: effectivePaymentId,
      status: paymentData.status,
      amountMinor: paymentData.amountMinor,
      currency: paymentData.currency,
      paidAt: paymentData.paidAt,
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

