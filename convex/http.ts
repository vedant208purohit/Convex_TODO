import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

/**
 * Porter 3PL Delivery Webhook Handler:
 * - Validates header `x-api-key` against `PORTER_WEBHOOK_TOKEN` / `PORTER_API_KEY`.
 * - Invokes internal mutation `processPorterWebhook`.
 * - Routes: POST `/porter/order_update` (Legacy Rails route) and `/porter-webhook`.
 */
export const handlePorterWebhook = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const expectedToken =
    process.env.PORTER_WEBHOOK_TOKEN || process.env.PORTER_API_KEY;
  const receivedToken = request.headers.get("x-api-key");

  if (!expectedToken || receivedToken !== expectedToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await request.json();
    const result = await ctx.runMutation(
      internal.orderDelivers.processPorterWebhook,
      {
        payload,
      }
    );

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Invalid webhook payload" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

http.route({
  path: "/porter/order_update",
  method: "POST",
  handler: handlePorterWebhook,
});

http.route({
  path: "/porter-webhook",
  method: "POST",
  handler: handlePorterWebhook,
});

export default http;
