import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { decryptCredentials } from "../../../../../convex/paymentGatewayCrypto";

export const dynamic = "force-dynamic";

/**
 * Validates the Razorpay webhook signature using timing-safe HMAC-SHA256 comparison.
 */
function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  if (!rawBody || !signature || !secret) return false;
  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const sigBuf = Buffer.from(signature, "utf8");
    const expBuf = Buffer.from(expected, "utf8");

    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    // 1. Read raw body text before any parsing to preserve exact byte sequence for HMAC-SHA256
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";

    // 2. Resolve target store's Convex deployment URL
    const { searchParams } = new URL(req.url);
    const storeSlug =
      searchParams.get("store") ||
      searchParams.get("slug") ||
      req.headers.get("x-store-slug") ||
      undefined;

    let convexUrl =
      process.env.NEXT_PUBLIC_CONVEX_URL ||
      process.env.CONVEX_URL ||
      (process.env.NODE_ENV !== "production" ? "https://mock-store.convex.cloud" : undefined);

    // In a shared multi-store deployment, if a store slug is provided, resolve via pos-master bridge
    const bridgeSecret = process.env.BRIDGE_SECRET;
    const masterBaseUrl =
      process.env.MASTER_POS_URL ||
      process.env.NEXT_PUBLIC_MASTER_POS_URL;

    if (storeSlug && bridgeSecret && masterBaseUrl) {
      try {
        const resolveTimestamp = Date.now();
        const resolveSignature = crypto
          .createHmac("sha256", bridgeSecret)
          .update(`webhook:${storeSlug}:${resolveTimestamp}`)
          .digest("hex");

        const res = await fetch(
          `${masterBaseUrl.replace(/\/$/, "")}/api/bridge/resolve-store`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-bridge-signature": resolveSignature,
              "x-bridge-timestamp": resolveTimestamp.toString(),
            },
            body: JSON.stringify({ slug: storeSlug }),
            cache: "no-store",
          }
        );
        const resData = await res.json().catch(() => ({}));
        if (res.ok && resData.deployment?.url) {
          convexUrl = resData.deployment.url;
        }
      } catch (bridgeErr) {
        console.warn("[Razorpay Webhook Bridge Warning]: Failed resolving store deployment:", bridgeErr);
      }
    }

    if (!convexUrl) {
      console.error("[Razorpay Webhook Error]: No Convex deployment configured for store.");
      return NextResponse.json(
        { success: false, error: "Server misconfiguration: No Convex deployment target found." },
        { status: 500 }
      );
    }

    const convexClient = new ConvexHttpClient(convexUrl);

    // 3. Resolve store-specific payment gateway connection & encrypted credentials
    const connDetails = await convexClient.query(
      api.paymentGateways.getWebhookVerificationDetails,
      { provider: "razorpay" }
    ).catch(() => null);

    let webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || "";

    if (connDetails?.encryptedCredentials) {
      try {
        const decrypted = await decryptCredentials(connDetails.encryptedCredentials);
        if (decrypted.webhookSecret) {
          webhookSecret = String(decrypted.webhookSecret).trim();
        }
      } catch (decryptErr) {
        console.warn("[Razorpay Webhook]: Failed decrypting connection credentials:", decryptErr);
      }
    }

    if (!webhookSecret && connDetails?.metadata?.webhookSecret) {
      webhookSecret = String(connDetails.metadata.webhookSecret).trim();
    }

    // 4. Strict Signature Verification
    if (!signature) {
      if (connDetails) {
        await convexClient.mutation(api.paymentGateways.processWebhookEvent, {
          organizationId: connDetails.organizationId,
          connectionId: connDetails.connectionId,
          provider: "razorpay",
          providerEventId: `missing_sig_${Date.now()}`,
          eventType: "unknown",
          payload: rawBody,
          signatureVerified: false,
        }).catch(() => {});
      }
      return NextResponse.json(
        { success: false, error: "Missing x-razorpay-signature header." },
        { status: 400 }
      );
    }

    if (!webhookSecret) {
      if (connDetails) {
        await convexClient.mutation(api.paymentGateways.processWebhookEvent, {
          organizationId: connDetails.organizationId,
          connectionId: connDetails.connectionId,
          provider: "razorpay",
          providerEventId: `no_secret_${Date.now()}`,
          eventType: "unknown",
          payload: rawBody,
          signatureVerified: false,
        }).catch(() => {});
      }
      return NextResponse.json(
        {
          success: false,
          error: "WEBHOOK_NOT_CONFIGURED: Webhook secret has not been configured for this store.",
        },
        { status: 400 }
      );
    }

    const signatureVerified = verifySignature(rawBody, signature, webhookSecret);
    if (!signatureVerified) {
      console.warn("[Razorpay Webhook Warning]: Invalid webhook signature.");
      if (connDetails) {
        await convexClient.mutation(api.paymentGateways.processWebhookEvent, {
          organizationId: connDetails.organizationId,
          connectionId: connDetails.connectionId,
          provider: "razorpay",
          providerEventId: `invalid_sig_${Date.now()}`,
          eventType: "unknown",
          payload: rawBody,
          signatureVerified: false,
        }).catch(() => {});
      }
      return NextResponse.json(
        { success: false, error: "Invalid webhook signature." },
        { status: 400 }
      );
    }

    // 5. Parse JSON payload
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON payload." },
        { status: 400 }
      );
    }

    const eventType = payload.event;
    if (!eventType) {
      return NextResponse.json(
        { success: false, error: "Missing event type in webhook payload." },
        { status: 400 }
      );
    }

    // 6. Extract unique event identifier for idempotency
    const entityId =
      payload.payload?.payment?.entity?.id ||
      payload.payload?.refund?.entity?.id ||
      payload.payload?.settlement?.entity?.id ||
      payload.payment?.entity?.id ||
      "";

    const providerEventId =
      payload.id ||
      payload.event_id ||
      (entityId ? `${eventType}_${entityId}_${payload.created_at || ""}` : `${eventType}_${Date.now()}`);

    // 7. Persist and process event atomically in Convex
    const result = await convexClient.mutation(api.paymentGateways.processWebhookEvent, {
      organizationId: connDetails?.organizationId,
      connectionId: connDetails?.connectionId,
      provider: "razorpay",
      providerEventId,
      eventType,
      payload: rawBody,
      signatureVerified: true,
    });

    const elapsedMs = Date.now() - startTime;

    return NextResponse.json(
      {
        success: true,
        received: true,
        eventId: result.eventId,
        duplicate: Boolean(result.alreadyProcessed),
        status: result.status || "processed",
        eventType,
        elapsedMs,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[Razorpay Webhook Handler Error]:", err?.message || err);
    return NextResponse.json(
      {
        success: false,
        error: "Failed processing webhook notification.",
      },
      { status: 500 }
    );
  }
}
