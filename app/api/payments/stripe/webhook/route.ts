import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { decryptCredentials } from "../../../../../convex/paymentGatewayCrypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    // 1. Read raw body text before any parsing to preserve exact byte sequence for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature") || "";

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
        console.warn("[Stripe Webhook Bridge Warning]: Failed resolving store deployment:", bridgeErr);
      }
    }

    if (!convexUrl) {
      console.error("[Stripe Webhook Error]: No Convex deployment configured for store.");
      return NextResponse.json(
        { success: false, error: "Server misconfiguration: No Convex deployment target found." },
        { status: 500 }
      );
    }

    const convexClient = new ConvexHttpClient(convexUrl);

    // 3. Resolve store-specific payment gateway connection & encrypted credentials
    const connDetails = await convexClient.query(
      api.paymentGateways.getWebhookVerificationDetails,
      { provider: "stripe" }
    ).catch(() => null);

    let webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";

    if (connDetails?.encryptedCredentials) {
      try {
        const decrypted = await decryptCredentials(connDetails.encryptedCredentials);
        if (decrypted.webhookSecret) {
          webhookSecret = String(decrypted.webhookSecret).trim();
        }
      } catch (decryptErr) {
        console.warn("[Stripe Webhook]: Failed decrypting connection credentials:", decryptErr);
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
          provider: "stripe",
          providerEventId: `missing_sig_${Date.now()}`,
          eventType: "unknown",
          payload: rawBody,
          signatureVerified: false,
        }).catch(() => {});
      }
      return NextResponse.json(
        { success: false, error: "Missing stripe-signature header." },
        { status: 400 }
      );
    }

    if (!webhookSecret) {
      if (connDetails) {
        await convexClient.mutation(api.paymentGateways.processWebhookEvent, {
          organizationId: connDetails.organizationId,
          connectionId: connDetails.connectionId,
          provider: "stripe",
          providerEventId: `no_secret_${Date.now()}`,
          eventType: "unknown",
          payload: rawBody,
          signatureVerified: false,
        }).catch(() => {});
      }
      return NextResponse.json(
        {
          success: false,
          error: "WEBHOOK_NOT_CONFIGURED: Stripe webhook secret has not been configured for this store.",
        },
        { status: 400 }
      );
    }

    let event: Stripe.Event;
    try {
      const stripe = new Stripe(webhookSecret, {
        apiVersion: "2025-02-24.acacia" as any,
      });
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      console.warn("[Stripe Webhook Warning]: Invalid webhook signature:", err?.message);
      if (connDetails) {
        await convexClient.mutation(api.paymentGateways.processWebhookEvent, {
          organizationId: connDetails.organizationId,
          connectionId: connDetails.connectionId,
          provider: "stripe",
          providerEventId: `invalid_sig_${Date.now()}`,
          eventType: "unknown",
          payload: rawBody,
          signatureVerified: false,
        }).catch(() => {});
      }
      return NextResponse.json(
        { success: false, error: `Invalid webhook signature: ${err?.message}` },
        { status: 400 }
      );
    }

    const eventType = event.type;
    const providerEventId = event.id;

    // 5. Persist and process event atomically in Convex
    const result = await convexClient.mutation(api.paymentGateways.processWebhookEvent, {
      organizationId: connDetails?.organizationId,
      connectionId: connDetails?.connectionId,
      provider: "stripe",
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
    console.error("[Stripe Webhook Handler Error]:", err?.message || err);
    return NextResponse.json(
      {
        success: false,
        error: "Failed processing webhook notification.",
      },
      { status: 500 }
    );
  }
}

