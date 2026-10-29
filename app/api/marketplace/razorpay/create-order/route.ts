import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    const body = await req.json().catch(() => ({}));
    const {
      amount,
      paymentMethod = "upi",
      orderNumber,
      organizationName = "PREST POS Store",
      explicitOrgId,
    } = body;

    const parsedAmount = Number(amount || 0);

    // Validate top-up range
    if (!parsedAmount || parsedAmount < 500 || parsedAmount > 100000) {
      return NextResponse.json(
        {
          success: false,
          error: "Deposit amount must be between ₹500.00 and ₹1,00,000.00 INR.",
        },
        { status: 400 }
      );
    }

    const keyId =
      process.env.RZ_KEY_ID?.trim() ||
      process.env.RAZORPAY_KEY_ID?.trim() ||
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() ||
      "";

    const keySecret =
      process.env.RZ_KEY_SECRET?.trim() ||
      process.env.RAZORPAY_KEY_SECRET?.trim() ||
      "";

    // Minor units for INR is paise (1 INR = 100 paise)
    const amountInPaise = Math.round(parsedAmount * 100);
    const receipt = `rcpt_topup_${Date.now().toString().slice(-8)}`;

    let razorpayOrderId: string | null = null;
    let isRemoteOrder = false;

    if (keyId && keySecret && !keySecret.includes("mock") && !keySecret.includes("test_placeholder")) {
      try {
        const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
        const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${authHeader}`,
          },
          body: JSON.stringify({
            amount: amountInPaise,
            currency: "INR",
            receipt,
            notes: {
              purpose: "marketplace_wallet_topup",
              paymentMethod: String(paymentMethod),
              userId: String(userId || "anonymous_admin"),
              orderNumber: String(orderNumber || receipt),
              organizationName: String(organizationName),
              explicitOrgId: explicitOrgId ? String(explicitOrgId) : "",
            },
          }),
        });

        if (rzpRes.ok) {
          const rzpData = await rzpRes.json();
          if (rzpData?.id && typeof rzpData.id === "string" && rzpData.id.startsWith("order_")) {
            razorpayOrderId = rzpData.id;
            isRemoteOrder = true;
          }
        } else {
          const errData = await rzpRes.json().catch(() => ({}));
          console.warn("[Razorpay Marketplace Orders API Warning]:", errData);
          // If remote API returns error (e.g., test credentials restricted), provide fallback order
          razorpayOrderId = `order_sim_${Date.now()}`;
        }
      } catch (fetchErr: unknown) {
        console.warn("[Razorpay Orders Network Warning]:", fetchErr);
        razorpayOrderId = `order_sim_${Date.now()}`;
      }
    } else {
      // Local/Test mock order
      razorpayOrderId = `order_mock_${Date.now()}`;
    }

    return NextResponse.json({
      success: true,
      orderId: razorpayOrderId,
      isRemoteOrder,
      amount: amountInPaise,
      currency: "INR",
      keyId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create Razorpay order";
    console.error("[Razorpay Create Order Error]:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

