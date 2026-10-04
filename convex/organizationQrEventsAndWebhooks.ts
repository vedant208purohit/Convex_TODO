import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAdminOrCashier } from "./organizationUsers";

/**
 * Subticket 06: Idempotent Event & Webhook Processor
 * Guarantees that duplicate events (same eventId) are processed exactly once.
 */
export const processEvent = mutation({
  args: {
    eventId: v.string(),
    eventType: v.string(), // "QR_SCANNED", "SESSION_STARTED", "CART_CREATED", "ORDER_CREATED", "ORDER_CANCELLED", "PAYMENT_CONFIRMED"
    entityId: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
    payload: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // 1. Idempotency Check: check if eventId was already processed
    const existingLogs = await ctx.db
      .query("organizationEventLogs")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .collect();

    const alreadyProcessed = existingLogs.find((l) => l.processingStatus === "PROCESSED");

    if (alreadyProcessed) {
      return {
        success: true,
        eventId: args.eventId,
        status: "PROCESSED",
        duplicateSkipped: true,
        logId: alreadyProcessed._id,
      };
    }

    // 2. Log initial event arrival
    const logId = await ctx.db.insert("organizationEventLogs", {
      eventId: args.eventId,
      eventType: args.eventType,
      entityId: args.entityId,
      organizationId: args.organizationId,
      receivedAt: now,
      processingStatus: "RECEIVED",
      payloadSnapshot: args.payload,
    });

    try {
      // Process logical events
      if (args.eventType === "QR_SCANNED" && args.payload?.qrId) {
        const qr = await ctx.db.get(args.payload.qrId as Id<"organizationQrCodes">);
        if (qr && (qr.status ?? "ACTIVE") === "ACTIVE") {
          await ctx.db.patch(qr._id, {
            counter: (qr.counter ?? 0) + 1,
            updatedAt: now,
          });

          await ctx.db.insert("organizationQrScans", {
            qrId: qr._id,
            organizationId: qr.organizationId,
            tableId: qr.tableId,
            sessionId: args.payload.sessionId || `sess_${args.eventId}`,
            scannedAt: now,
          });
        }
      } else if (args.eventType === "ORDER_CANCELLED" && args.payload?.orderId) {
        try {
          const order = await ctx.db.get(args.payload.orderId as Id<"orders">);
          if (order) {
            await ctx.db.patch(order._id, {
              isRejected: true,
              paymentStatus: "Refunded",
              updatedAt: now,
            });
          }
        } catch {
          // Ignore
        }
      }

      // Mark log as successfully processed
      await ctx.db.patch(logId, {
        processingStatus: "PROCESSED",
        processedAt: Date.now(),
      });

      return {
        success: true,
        eventId: args.eventId,
        status: "PROCESSED",
        duplicateSkipped: false,
        logId,
      };
    } catch (err: any) {
      await ctx.db.patch(logId, {
        processingStatus: "FAILED",
        processedAt: Date.now(),
        error: err.message || "Processing failed",
      });

      throw new Error(`EVENT_PROCESSING_FAILED: ${err.message}`);
    }
  },
});

/**
 * Queries audit logs for events
 */
export const getEventLog = query({
  args: {
    eventId: v.string(),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("organizationEventLogs")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .collect();

    return logs[0] ?? null;
  },
});
