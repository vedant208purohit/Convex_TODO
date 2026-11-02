import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      amount,
      paymentMethod,
    } = body;

    if (!razorpayOrderId || !razorpayPaymentId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required payment verification parameters (razorpayOrderId, razorpayPaymentId).",
        },
        { status: 400 }
      );
    }

    const keySecret =
      process.env.RZ_KEY_SECRET?.trim() ||
      process.env.RAZORPAY_KEY_SECRET?.trim() ||
      "";

    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction) {
      if (!keySecret || keySecret === "mock_secret" || keySecret.includes("mock")) {
        return NextResponse.json(
          { success: false, error: "Razorpay secret key is not configured on the server." },
          { status: 500 }
        );
      }
      if (
        razorpaySignature === "valid_mock_signature" ||
        razorpaySignature?.startsWith("mock_sig_") ||
        razorpayPaymentId?.startsWith("pay_mock_") ||
        razorpayPaymentId?.startsWith("pay_sim_")
      ) {
        return NextResponse.json(
          { success: false, error: "Mock payments are disallowed in production." },
          { status: 400 }
        );
      }
    }

    const isMock =
      !keySecret ||
      keySecret === "mock_secret" ||
      keySecret.includes("mock") ||
      razorpaySignature === "valid_mock_signature" ||
      razorpaySignature?.startsWith("mock_sig_") ||
      razorpayPaymentId?.startsWith("pay_mock_") ||
      razorpayPaymentId?.startsWith("pay_sim_");

    if (!isMock && razorpaySignature) {
      const text = `${razorpayOrderId}|${razorpayPaymentId}`;
      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(text)
        .digest("hex");

      if (expectedSignature !== razorpaySignature) {
        return NextResponse.json(
          {
            success: false,
            error: "Cryptographic signature verification failed for Razorpay payment.",
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      razorpayOrderId,
      razorpayPaymentId,
      amount,
      paymentMethod,
      verifiedAt: Date.now(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Payment verification failed";
    console.error("[Razorpay Verify Payment Error]:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

