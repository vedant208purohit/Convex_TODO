import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireStoreAdminContext } from "../../../../../lib/payments/authHelper";
import { decryptCredentials } from "../../../../../../convex/paymentGatewayCrypto";
import { api } from "../../../../../../convex/_generated/api";

export const dynamic = "force-dynamic";

const SUPPORTED_EVENTS = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.amount_capturable_updated",
  "charge.succeeded",
  "charge.failed",
  "charge.refunded",
  "refund.created",
  "refund.updated",
  "payout.paid",
  "payout.failed",
  "payout.created",
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

    const webhookUrl = `${proto}://${host}/api/payments/stripe/webhook?store=${storeContext.storeSlug || "default"}`;

    const connDetails = await storeContext.storeConvexClient.query(
      api.paymentGateways.getWebhookVerificationDetails,
      { provider: "stripe" }
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
    const webhookSecret = (body.webhookSecret || body.webhook_secret || "").trim();

    if (!webhookSecret) {
      return NextResponse.json(
        { success: false, error: "webhookSecret is required" },
        { status: 400 }
      );
    }

    if (!webhookSecret.startsWith("whsec_")) {
      return NextResponse.json(
        { success: false, error: "Invalid Stripe webhook secret format. Must begin with 'whsec_'." },
        { status: 400 }
      );
    }

    const connDetails = await storeContext.storeConvexClient.query(
      api.paymentGateways.getConnectionCredentials,
      {
        organizationId: storeContext.orgId,
        provider: "stripe",
      }
    );

    if (!connDetails) {
      return NextResponse.json(
        { success: false, error: "No Stripe connection found for this store" },
        { status: 404 }
      );
    }

    await storeContext.storeConvexClient.mutation(api.paymentGateways.updateWebhookSecret, {
      organizationId: storeContext.orgId,
      connectionId: connDetails.connectionId,
      webhookSecret,
    });

    return NextResponse.json({
      success: true,
      configured: true,
      webhookSecretLast4: webhookSecret.slice(-4),
      message: "Stripe webhook signing secret updated and encrypted successfully.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed updating webhook configuration" },
      { status: 500 }
    );
  }
}

