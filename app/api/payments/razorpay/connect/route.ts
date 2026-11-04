import { NextRequest, NextResponse } from "next/server";
import { getPaymentAdapter } from "../../../../lib/payments/registry";
import { requireStoreAdminContext } from "../../../../lib/payments/authHelper";
import { api } from "../../../../../convex/_generated/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Caller & Resolve Store Context
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

    // 2. Parse & Validate Body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          code: "BAD_REQUEST",
          error: "Invalid JSON request body.",
        },
        { status: 400 }
      );
    }

    const { key_id, key_secret } = body || {};

    if (!key_id || typeof key_id !== "string" || !key_id.trim()) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_CREDENTIALS",
          error: "key_id is required.",
        },
        { status: 400 }
      );
    }

    if (!key_secret || typeof key_secret !== "string" || !key_secret.trim()) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_CREDENTIALS",
          error: "key_secret is required.",
        },
        { status: 400 }
      );
    }

    const adapter = getPaymentAdapter("razorpay");

    // 3. Syntactic Validation
    const formatCheck = adapter.validateKeyFormat(key_id, key_secret);
    if (!formatCheck.valid) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_CREDENTIALS",
          error: formatCheck.error,
        },
        { status: 400 }
      );
    }

    // 4. Verify Credentials with Razorpay Before Saving
    const verifyResult = await adapter.verifyCredentials({
      keyId: key_id,
      keySecret: key_secret,
    });

    if (!verifyResult.verified) {
      const normalized = adapter.normalizeError({
        code: verifyResult.code,
        message: verifyResult.message,
      });

      return NextResponse.json(
        {
          success: false,
          code: normalized.code,
          error: verifyResult.message,
        },
        { status: normalized.httpStatus }
      );
    }

    // 5. Fetch Profile if supported
    const profileResult = await adapter.fetchProfile({
      keyId: key_id,
      keySecret: key_secret,
    });

    // 6. Encrypt & Save to Generic payment_gateway_connections Table
    const connectionId = await storeContext.storeConvexClient.mutation(
      api.paymentGateways.saveConnection,
      {
        organizationId: storeContext.orgId,
        provider: "razorpay",
        connectionType: "api_key",
        providerAccountId: key_id.trim(),
        merchantName: profileResult.merchant_name || undefined,
        accountMode: verifyResult.accountMode,
        status: "connected",
        rawCredentials: {
          keyId: key_id.trim(),
          keySecret: key_secret.trim(),
        },
        isDefault: true,
        metadata: {
          isProfileAvailable: profileResult.is_profile_available ?? false,
          connectedVia: "api_keys",
        },
      }
    );

    const now = new Date().toISOString();

    // 7. Safe Public Response
    return NextResponse.json({
      success: true,
      provider: "razorpay",
      status: "connected",
      connectionType: "api_key",
      accountMode: verifyResult.accountMode,
      merchantName: profileResult.merchant_name || null,
      merchantId: profileResult.merchant_id || null,
      connectedAt: now,
      connectionId,
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
