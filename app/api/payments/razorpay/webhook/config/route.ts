import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireStoreAdminContext } from "@/app/lib/payments/authHelper";
import { decryptCredentials } from "@/convex/paymentGatewayCrypto";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

const SUPPORTED_EVENTS = [
  "payment.authorized",
  "payment.captured",
  "payment.failed",
  "refund.created",
  "settlement.processed",
];

export async function GET(req: NextRequest) {
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

    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      "localhost:3000";
    const proto =
      req.headers.get("x-forwarded-proto") ||
      (host.includes("localhost") ? "http" : "https");

    const webhookUrl = `${proto}://${host}/api/payments/razorpay/webhook?store=${storeContext.storeSlug || "default"}`;

    const connDetails = await storeContext.storeConvexClient.query(
      api.paymentGateways.getWebhookVerificationDetails,
      { provider: "razorpay" }
    );

    let configured = false;
    let webhookSecretLast4: string | null = null;

    if (connDetails?.encryptedCredentials) {
      try {
        const decrypted = await decryptCredentials(connDetails.encryptedCredentials);
        if (decrypted.webhookSecret) {
          configured = true;
          webhookSecretLast4 = decrypted.webhookSecret.slice(-4);
        }
      } catch {
        // Decryption failed or not set
      }
    }

    if (!configured && connDetails?.metadata?.webhookSecret) {
      configured = true;
      webhookSecretLast4 = String(connDetails.metadata.webhookSecret).slice(-4);
    }

    const suggestedSecret = `whsec_${crypto.randomBytes(16).toString("hex")}`;

    return NextResponse.json({
      success: true,
      configured,
      webhookUrl,
      webhookSecretLast4,
      suggestedSecret,
      supportedEvents: SUPPORTED_EVENTS,
      accountMode: connDetails?.accountMode || "unknown",
      connectionStatus: connDetails?.status || "disconnected",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed retrieving webhook configuration" },
      { status: 500 }
    );
  }
}

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
    let secret = (body.webhookSecret || body.webhook_secret || "").trim();

    if (!secret || secret === "generate") {
      secret = `whsec_${crypto.randomBytes(16).toString("hex")}`;
    }

    const connDetails = await storeContext.storeConvexClient.query(
      api.paymentGateways.getWebhookVerificationDetails,
      { provider: "razorpay" }
    );

    if (!connDetails || !connDetails.connectionId) {
      return NextResponse.json(
        {
          success: false,
          error: "No active Razorpay gateway connection found for this store. Connect Razorpay first.",
        },
        { status: 400 }
      );
    }

    await storeContext.storeConvexClient.mutation(
      api.paymentGateways.updateWebhookSecret,
      {
        organizationId: storeContext.orgId,
        connectionId: connDetails.connectionId,
        webhookSecret: secret,
      }
    );

    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      "localhost:3000";
    const proto =
      req.headers.get("x-forwarded-proto") ||
      (host.includes("localhost") ? "http" : "https");

    const webhookUrl = `${proto}://${host}/api/payments/razorpay/webhook?store=${storeContext.storeSlug || "default"}`;

    return NextResponse.json({
      success: true,
      configured: true,
      webhookUrl,
      webhookSecret: secret,
      webhookSecretLast4: secret.slice(-4),
      supportedEvents: SUPPORTED_EVENTS,
      message: "Webhook secret configured successfully. Copy this secret and URL to your Razorpay Dashboard.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed configuring webhook secret" },
      { status: 500 }
    );
  }
}
