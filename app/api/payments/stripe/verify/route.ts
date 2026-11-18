import { NextRequest, NextResponse } from "next/server";
import { getPaymentAdapter } from "../../../../lib/payments/registry";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          provider: "stripe",
          accountMode: "test",
          credentialsValid: false,
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

    if (!publishableKey) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          provider: "stripe",
          accountMode: "test",
          credentialsValid: false,
          code: "INVALID_CREDENTIALS",
          error: "Publishable key is required.",
        },
        { status: 400 }
      );
    }

    if (!secretKey) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          provider: "stripe",
          accountMode: publishableKey.startsWith("pk_live_") ? "live" : "test",
          credentialsValid: false,
          code: "INVALID_CREDENTIALS",
          error: "Secret key is required.",
        },
        { status: 400 }
      );
    }

    const adapter = getPaymentAdapter("stripe");

    // Syntactic validation
    const formatCheck = adapter.validateKeyFormat(publishableKey, secretKey);
    if (!formatCheck.valid) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          provider: "stripe",
          accountMode: adapter.detectAccountMode(publishableKey),
          credentialsValid: false,
          code: "INVALID_CREDENTIALS",
          error: formatCheck.error,
        },
        { status: 400 }
      );
    }

    // Actual Stripe verification via adapter
    const result = await adapter.verifyCredentials({
      keyId: publishableKey,
      keySecret: secretKey,
    });

    if (!result.verified) {
      const normalized = adapter.normalizeError({
        code: result.code,
        message: result.message,
      });

      return NextResponse.json(
        {
          success: false,
          verified: false,
          provider: "stripe",
          accountMode: result.accountMode,
          credentialsValid: false,
          merchantExists: result.merchantExists,
          accountStatus: result.accountStatus,
          code: normalized.code,
          error: result.message,
          rawError: result.rawError,
        },
        { status: normalized.httpStatus || 400 }
      );
    }

    // Retrieve profile details
    const profileResult = await adapter.fetchProfile({
      keyId: publishableKey,
      keySecret: secretKey,
    });

    return NextResponse.json({
      success: true,
      verified: true,
      provider: "stripe",
      accountMode: result.accountMode,
      credentialsValid: true,
      merchantExists: result.merchantExists,
      accountStatus: result.accountStatus,
      merchantName: result.merchantName || profileResult.merchant_name || "Stripe Merchant",
      providerAccountId: result.providerAccountId || publishableKey,
      message: result.message,
    });
  } catch (err: any) {
    const adapter = getPaymentAdapter("stripe");
    const normalized = adapter.normalizeError(err);

    return NextResponse.json(
      {
        success: false,
        verified: false,
        provider: "stripe",
        accountMode: "test",
        credentialsValid: false,
        code: normalized.code,
        error: normalized.message,
      },
      { status: normalized.httpStatus || 500 }
    );
  }
}

