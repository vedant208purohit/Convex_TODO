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
          provider: "razorpay",
          accountMode: "test",
          credentialsValid: false,
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
          verified: false,
          provider: "razorpay",
          accountMode: "test",
          credentialsValid: false,
          code: "INVALID_CREDENTIALS",
          error: "key_id is required and must be a non-empty string.",
        },
        { status: 400 }
      );
    }

    if (!key_secret || typeof key_secret !== "string" || !key_secret.trim()) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          provider: "razorpay",
          accountMode: key_id.startsWith("rzp_live_") ? "live" : "test",
          credentialsValid: false,
          code: "INVALID_CREDENTIALS",
          error: "key_secret is required and must be a non-empty string.",
        },
        { status: 400 }
      );
    }

    const adapter = getPaymentAdapter("razorpay");

    // Syntactic validation
    const formatCheck = adapter.validateKeyFormat(key_id, key_secret);
    if (!formatCheck.valid) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          provider: "razorpay",
          accountMode: adapter.detectAccountMode(key_id),
          credentialsValid: false,
          code: "INVALID_CREDENTIALS",
          error: formatCheck.error,
        },
        { status: 400 }
      );
    }

    // Actual Razorpay verification via adapter
    const result = await adapter.verifyCredentials({
      keyId: key_id,
      keySecret: key_secret,
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
          provider: "razorpay",
          accountMode: result.accountMode,
          credentialsValid: false,
          merchantExists: result.merchantExists,
          accountStatus: result.accountStatus,
          code: normalized.code,
          error: result.message,
        },
        { status: normalized.httpStatus }
      );
    }

    return NextResponse.json({
      success: true,
      verified: true,
      provider: "razorpay",
      accountMode: result.accountMode,
      credentialsValid: true,
      merchantExists: result.merchantExists,
      accountStatus: result.accountStatus,
      message: result.message,
    });
  } catch (err: any) {
    const adapter = getPaymentAdapter("razorpay");
    const normalized = adapter.normalizeError(err);

    return NextResponse.json(
      {
        success: false,
        verified: false,
        provider: "razorpay",
        accountMode: "test",
        credentialsValid: false,
        code: normalized.code,
        error: normalized.message,
      },
      { status: normalized.httpStatus }
    );
  }
}
