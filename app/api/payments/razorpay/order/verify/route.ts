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
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, internalOrderId } = body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json(
        {
          success: false,
          code: "MISSING_FIELDS",
          error: "razorpayOrderId, razorpayPaymentId, and razorpaySignature are required.",
        },
        { status: 400 }
      );
    }

    // 1. Resolve store's connection and credentials
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

    const decrypted = await decryptCredentials(connection.encryptedCredentials);
    if (!decrypted.keySecret || !decrypted.keyId) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_CREDENTIALS",
          error: "Stored gateway credentials missing keyId or keySecret.",
        },
        { status: 500 }
      );
    }

    // 2. Cryptographic signature verification using server-managed secret
    const adapter = getPaymentAdapter("razorpay");
    const isSignatureValid = adapter.verifyPaymentSignature!({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
      secret: decrypted.keySecret,
    });

    if (!isSignatureValid) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_SIGNATURE",
          error: "Payment completion signature verification failed. Untrusted payload.",
        },
        { status: 400 }
      );
    }

    // 3. Retrieve verified payment details from Razorpay REST API
    let paymentData: any = null;
    try {
      paymentData = await adapter.fetchPayment!(
        {
          keyId: decrypted.keyId!,
          keySecret: decrypted.keySecret!,
        },
        razorpayPaymentId
      );
    } catch (fetchErr: any) {
      console.warn("[Razorpay Fetch Payment Warning]:", fetchErr.message);
    }

    const amountMinor = paymentData?.amountMinor || 0;
    const currency = paymentData?.currency || "INR";
    const paymentMethod = paymentData?.paymentMethod || "card";
    const paidAt = paymentData?.paidAt || Date.now();

    // 4. Record transaction in generic payment_transactions table idempotently
    const recordResult = await storeContext.storeConvexClient.mutation(
      api.paymentGateways.recordTransaction,
      {
        connectionId: connection._id,
        providerPaymentId: razorpayPaymentId,
        providerOrderId: razorpayOrderId,
        internalOrderId: internalOrderId ? (internalOrderId as any) : undefined,
        amountMinor,
        currency,
        paymentMethod,
        status: "captured",
        providerStatus: paymentData?.providerStatus || "captured",
        paidAt,
        metadata: {
          signatureVerified: true,
          verifiedVia: "checkout_callback",
          internalOrderId,
        },
      }
    );

    return NextResponse.json({
      success: true,
      verified: true,
      providerPaymentId: razorpayPaymentId,
      providerOrderId: razorpayOrderId,
      amountMinor,
      currency,
      status: "captured",
      transactionId: recordResult.transactionId,
      alreadyExists: recordResult.alreadyExists,
    });
  } catch (err: any) {
    console.error("[Razorpay Order Verify API Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to verify payment completion.",
      },
      { status: 500 }
    );
  }
}
