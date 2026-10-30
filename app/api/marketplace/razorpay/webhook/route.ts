import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    const webhookSecret =
      process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ||
      process.env.RZ_KEY_SECRET?.trim() ||
      process.env.RAZORPAY_KEY_SECRET?.trim() ||
      "";

    // Verify webhook signature if secret and signature are provided
    if (webhookSecret && signature && !webhookSecret.includes("mock")) {
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      if (expectedSignature !== signature) {
        console.warn("[Razorpay Webhook Warning]: Invalid webhook signature");
        return NextResponse.json(
          { success: false, error: "Invalid webhook signature" },
          { status: 400 }
        );
      }
    }

    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
    }

    const event = payload?.event;
    console.log(`[Razorpay Webhook]: Received event ${event}`);

    // If event is payment.captured or order.paid, webhook is acknowledged
    return NextResponse.json({ received: true, event });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook handler failed";
    console.error("[Razorpay Webhook Error]:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

