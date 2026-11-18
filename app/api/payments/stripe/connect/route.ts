import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getPaymentAdapter } from "../../../../lib/payments/registry";
import { requireStoreAdminContext } from "../../../../lib/payments/authHelper";
import { PaymentSyncEngine } from "../../../../lib/payments/syncEngine";
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

    const publishableKey = String(
      body?.publishableKey || body?.publishable_key || body?.key_id || body?.keyId || ""
    ).trim().replace(/^['"]|['"]$/g, "");

    const secretKey = String(
      body?.secretKey || body?.secret_key || body?.key_secret || body?.keySecret || ""
    ).trim().replace(/^['"]|['"]$/g, "");

    let webhookSecret = String(body?.webhookSecret || body?.webhook_secret || "").trim();
    if (!webhookSecret) {
      webhookSecret = `whsec_${crypto.randomBytes(16).toString("hex")}`;
    }

    if (!publishableKey) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_CREDENTIALS",
          error: "Publishable Key is required.",
        },
        { status: 400 }
      );
    }

    if (!secretKey) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_CREDENTIALS",
          error: "Secret Key is required.",
        },
        { status: 400 }
      );
    }

    const adapter = getPaymentAdapter("stripe");

    // 3. Syntactic Validation
    const formatCheck = adapter.validateKeyFormat(publishableKey, secretKey);
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

    // 4. Verify Credentials with Stripe
    const verifyResult = await adapter.verifyCredentials({
      keyId: publishableKey,
      keySecret: secretKey,
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
        { status: normalized.httpStatus || 400 }
      );
    }

    // 5. Fetch Profile
    const profileResult = await adapter.fetchProfile({
      keyId: publishableKey,
      keySecret: secretKey,
    });

    const merchantName =
      profileResult.merchant_name || verifyResult.merchantName || "Stripe Merchant";
    const providerAccountId =
      profileResult.merchant_id || verifyResult.providerAccountId || publishableKey;

    // 6. Encrypt & Save to Polymorphic payment_gateway_connections Table
    const connectionId = await storeContext.storeConvexClient.mutation(
      api.paymentGateways.saveConnection,
      {
        organizationId: storeContext.orgId,
        provider: "stripe",
        connectionType: "api_key",
        providerAccountId: providerAccountId.trim(),
        merchantName,
        accountMode: verifyResult.accountMode,
        status: "connected",
        rawCredentials: {
          keyId: publishableKey.trim(),
          keySecret: secretKey.trim(),
          webhookSecret: webhookSecret,
        },
        isDefault: false,
        metadata: {
          isProfileAvailable: profileResult.is_profile_available ?? true,
          connectedVia: "api_keys",
          webhookConfigured: true,
          webhookSecretLast4: webhookSecret.slice(-4),
        },
      }
    );

    // 7. Trigger initial background sync
    const credentials = {
      keyId: publishableKey.trim(),
      keySecret: secretKey.trim(),
    };

    Promise.allSettled([
      PaymentSyncEngine.syncTransactions({
        convexClient: storeContext.storeConvexClient,
        connectionId,
        adapter,
        credentials,
        syncType: "initial",
      }),
      PaymentSyncEngine.syncRefunds({
        convexClient: storeContext.storeConvexClient,
        connectionId,
        adapter,
        credentials,
        syncType: "initial",
      }),
      PaymentSyncEngine.syncSettlements({
        convexClient: storeContext.storeConvexClient,
        connectionId,
        adapter,
        credentials,
        syncType: "initial",
      }),
    ]).catch((syncErr) => {
      console.warn("[Stripe Initial Sync Background Error]:", syncErr);
    });

    return NextResponse.json({
      success: true,
      verified: true,
      connectionId,
      provider: "stripe",
      accountMode: verifyResult.accountMode,
      merchantName,
      providerAccountId,
      initialSyncStarted: true,
      message: "Stripe account connected successfully.",
    });
  } catch (error: any) {
    const adapter = getPaymentAdapter("stripe");
    const normalized = adapter.normalizeError(error);
    return NextResponse.json(
      {
        success: false,
        code: normalized.code || "INTERNAL_ERROR",
        error: normalized.message || "An unexpected error occurred while connecting Stripe.",
      },
      { status: normalized.httpStatus || 500 }
    );
  }
}
