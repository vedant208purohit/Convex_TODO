import {
  mutation,
  query,
  action,
  internalMutation,
  internalAction,
  QueryCtx,
  MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  requireAuth,
  resolveStoreOrganization,
  getCallerMembership,
} from "./organizationUsers";
import {
  DeliveryStatus,
  TERMINAL_STATUSES,
  isValidTransition,
  isTerminalStatus,
  mapPorterStatusToCanonical,
  sanitizePayload,
  requestPorterQuote,
  createPorterOrder,
  cancelPorterOrder,
  trackPorterOrder,
  PorterQuoteRequest,
  PorterCreateOrderPayload,
} from "./deliveryProvider";

// ----------------------------------------------------
// AUTHORIZATION HELPERS
// ----------------------------------------------------

/**
 * Requires caller to be an active Store Admin or Cashier in the store database.
 */
export async function requireAdminOrCashier(
  ctx: QueryCtx | MutationCtx,
  explicitOrgId?: Id<"organizations">
) {
  const identity = await requireAuth(ctx);
  const org = await resolveStoreOrganization(ctx, explicitOrgId);
  const callerMember = await getCallerMembership(ctx, identity.subject, org._id);

  if (
    !callerMember ||
    callerMember.deletedAt !== undefined ||
    (!callerMember.userType.includes("admin") &&
      !callerMember.userType.includes("cashier"))
  ) {
    throw new Error("Forbidden. Admin or Cashier access required.");
  }

  return { identity, org, callerMember };
}

/**
 * Requires caller to be an active Store Staff member (Admin, Cashier, Captain, Waiter).
 */
export async function requireStaffMember(
  ctx: QueryCtx | MutationCtx,
  explicitOrgId?: Id<"organizations">
) {
  const identity = await requireAuth(ctx);
  const org = await resolveStoreOrganization(ctx, explicitOrgId);
  const callerMember = await getCallerMembership(ctx, identity.subject, org._id);

  const isStaff =
    callerMember &&
    callerMember.deletedAt === undefined &&
    ["admin", "cashier", "captain", "waiter"].some((role) =>
      callerMember.userType.includes(role)
    );

  if (!isStaff) {
    throw new Error("Forbidden. Staff access required.");
  }

  return { identity, org, callerMember };
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Staff Query: Retrieves all delivery dispatch attempts for a specific order.
 */
export const getOrderDeliveries = query({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    await requireStaffMember(ctx);

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found.");
    }

    const deliveries = await ctx.db
      .query("orderDelivers")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();

    return deliveries
      .filter((d) => d.deletedAt === undefined)
      .sort((a, b) => b.createdAt - a.createdAt || b._creationTime - a._creationTime);
  },
});

/**
 * Staff Query: Retrieves a single delivery dispatch record by ID.
 */
export const getDeliveryAttempt = query({
  args: {
    id: v.id("orderDelivers"),
  },
  handler: async (ctx, args) => {
    await requireStaffMember(ctx);

    const delivery = await ctx.db.get(args.id);
    if (!delivery || delivery.deletedAt !== undefined) {
      return null;
    }

    return delivery;
  },
});

/**
 * Public / Customer Query: Retrieves sanitized live tracking details for an order.
 * Strictly omits raw API snapshots, failure diagnostics, and provider secrets.
 */
export const getDeliveryTracking = query({
  args: {
    orderId: v.id("orders"),
    trackingToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      return null;
    }

    // Customer or staff authentication check if no trackingToken is used
    const identity = await ctx.auth.getUserIdentity();
    if (!identity && !args.trackingToken) {
      throw new Error("Unauthorized. Please authenticate or provide a tracking token.");
    }

    if (identity) {
      const member = await getCallerMembership(
        ctx,
        identity.subject,
        order.organizationId
      );

      const isStaff =
        member &&
        member.deletedAt === undefined &&
        ["admin", "cashier", "captain", "waiter"].some((role) =>
          member.userType.includes(role)
        );

      const isOrderCustomer =
        (order.customerPhone && identity.phoneNumber && order.customerPhone === identity.phoneNumber) ||
        (order.customerEmail && identity.email && order.customerEmail.toLowerCase() === identity.email.toLowerCase()) ||
        (order.customerName && identity.name && order.customerName === identity.name);

      if (!isStaff && !isOrderCustomer && !args.trackingToken) {
        throw new Error("Forbidden. You are not authorized to view delivery tracking for this order.");
      }
    }

    const deliveries = await ctx.db
      .query("orderDelivers")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();

    const activeDeliveries = deliveries
      .filter((d) => d.deletedAt === undefined)
      .sort((a, b) => b.createdAt - a.createdAt || b._creationTime - a._creationTime);

    if (activeDeliveries.length === 0) {
      return null;
    }

    // Return the latest delivery attempt
    const latest = activeDeliveries[0];

    return {
      orderId: latest.orderId,
      status: latest.status,
      provider: latest.provider,
      providerOrderId: latest.providerOrderId,
      trackingUrl: latest.trackingUrl,
      fare: latest.fare,
      partnerInfo: latest.partnerInfo,
      estimatedPickupTime: latest.estimatedPickupTime,
      orderTimings: latest.orderTimings,
      createdAt: latest.createdAt,
      updatedAt: latest.updatedAt,
    };
  },
});

// ----------------------------------------------------
// MUTATIONS (STAFF DISPATCH & LIFECYCLE)
// ----------------------------------------------------

/**
 * Staff Mutation: Initiates a new delivery dispatch attempt for an eligible order.
 * Prevents concurrent duplicate active dispatches.
 */
export const dispatchOrderDelivery = mutation({
  args: {
    orderId: v.id("orders"),
    provider: v.optional(
      v.union(v.literal("porter"), v.literal("internal"), v.literal("custom"))
    ),
  },
  handler: async (ctx, args) => {
    const { org } = await requireAdminOrCashier(ctx);

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found.");
    }

    if (String(order.organizationId) !== String(org._id)) {
      throw new Error("Forbidden. Order does not belong to current store organization.");
    }

    if (order.orderType !== "Delivery" && order.orderType !== "ScheduledDelivery") {
      throw new Error(
        `Order is not eligible for delivery dispatch. Current orderType: ${order.orderType}`
      );
    }

    // Concurrency / Duplicate active dispatch check
    const existingDeliveries = await ctx.db
      .query("orderDelivers")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();

    const hasActiveAttempt = existingDeliveries.some(
      (d) =>
        d.deletedAt === undefined &&
        !isTerminalStatus(d.status as DeliveryStatus)
    );

    if (hasActiveAttempt) {
      throw new Error(
        "An active delivery dispatch is already in progress for this order."
      );
    }

    const now = Date.now();
    const provider = args.provider || "porter";

    const deliveryId = await ctx.db.insert("orderDelivers", {
      orderId: args.orderId,
      provider,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("orderDeliverStatuses", {
      deliveryId,
      status: "pending",
      providerStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return { deliveryId, success: true };
  },
});

/**
 * Staff Mutation: Cancels an active delivery dispatch attempt and resets order delivery charge.
 */
export const cancelOrderDelivery = mutation({
  args: {
    id: v.id("orderDelivers"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org } = await requireAdminOrCashier(ctx);

    const delivery = await ctx.db.get(args.id);
    if (!delivery || delivery.deletedAt !== undefined) {
      throw new Error("Delivery record not found.");
    }

    const order = await ctx.db.get(delivery.orderId);
    if (!order || String(order.organizationId) !== String(org._id)) {
      throw new Error("Forbidden. Delivery does not belong to current store organization.");
    }

    if (isTerminalStatus(delivery.status as DeliveryStatus)) {
      throw new Error(
        `Cannot cancel delivery in terminal status '${delivery.status}'.`
      );
    }

    const now = Date.now();

    await ctx.db.patch(delivery._id, {
      status: "cancelled",
      failureReason: args.reason || "Cancelled by store staff",
      updatedAt: now,
    });

    await ctx.db.insert("orderDeliverStatuses", {
      deliveryId: delivery._id,
      status: "cancelled",
      providerStatus: "cancelled",
      notes: args.reason || "Cancelled by store staff",
      createdAt: now,
      updatedAt: now,
    });

    // Reset delivery charge on the order
    if (order.deliveryCharge && order.deliveryCharge > 0) {
      const newTotal = Math.max(0, order.totalAmount - order.deliveryCharge);
      await ctx.db.patch(order._id, {
        deliveryCharge: 0,
        totalAmount: newTotal,
        updatedAt: now,
      });
    }

    return { success: true, status: "cancelled" };
  },
});

/**
 * Staff Mutation: Retries delivery for an order after previous terminal failure or cancellation.
 * Creates a NEW delivery attempt record while retaining failed records in history.
 */
export const retryOrderDelivery = mutation({
  args: {
    orderId: v.id("orders"),
    provider: v.optional(
      v.union(v.literal("porter"), v.literal("internal"), v.literal("custom"))
    ),
  },
  handler: async (ctx, args) => {
    const { org } = await requireAdminOrCashier(ctx);

    const order = await ctx.db.get(args.orderId);
    if (!order || String(order.organizationId) !== String(org._id)) {
      throw new Error("Order not found or forbidden.");
    }

    if (order.orderType !== "Delivery" && order.orderType !== "ScheduledDelivery") {
      throw new Error(
        `Order is not eligible for delivery dispatch. Current orderType: ${order.orderType}`
      );
    }

    const existingDeliveries = await ctx.db
      .query("orderDelivers")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();

    // Verify all existing attempts are in terminal state
    const nonTerminal = existingDeliveries.find(
      (d) =>
        d.deletedAt === undefined &&
        !isTerminalStatus(d.status as DeliveryStatus)
    );

    if (nonTerminal) {
      throw new Error(
        `Cannot retry while delivery attempt ${nonTerminal._id} is still in active status '${nonTerminal.status}'.`
      );
    }

    const now = Date.now();
    const provider = args.provider || "porter";

    // Insert a fresh pending record (do not overwrite the old attempt!)
    const deliveryId = await ctx.db.insert("orderDelivers", {
      orderId: args.orderId,
      provider,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("orderDeliverStatuses", {
      deliveryId,
      status: "pending",
      providerStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return { deliveryId, success: true };
  },
});

// ----------------------------------------------------
// ACTIONS (OUTBOUND 3PL CALLS)
// ----------------------------------------------------

/**
 * Action: Fetches real-time vehicle quotes and ETAs from Porter.
 */
export const fetchDeliveryQuote = action({
  args: {
    pickup: v.object({ lat: v.number(), lng: v.number() }),
    drop: v.object({ lat: v.number(), lng: v.number() }),
    customer: v.object({
      name: v.string(),
      phone: v.string(),
      countryCode: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const quoteReq: PorterQuoteRequest = {
      pickup: args.pickup,
      drop: args.drop,
      customer: {
        name: args.customer.name,
        mobile: {
          country_code: (args.customer.countryCode || "91").replace("+", ""),
          number: args.customer.phone,
        },
      },
    };

    return await requestPorterQuote(quoteReq);
  },
});

/**
 * Action: Calls Porter order creation API and finalizes delivery status via internal mutations.
 */
export const createPorterDispatch = action({
  args: {
    deliveryId: v.id("orderDelivers"),
    pickupDetails: v.object({
      name: v.string(),
      phone: v.string(),
      addressLine1: v.string(),
      addressLine2: v.optional(v.string()),
      city: v.string(),
      state: v.optional(v.string()),
      pincode: v.string(),
      country: v.optional(v.string()),
      lat: v.number(),
      lng: v.number(),
    }),
    dropDetails: v.object({
      name: v.string(),
      phone: v.string(),
      addressLine1: v.string(),
      addressLine2: v.optional(v.string()),
      city: v.string(),
      state: v.optional(v.string()),
      pincode: v.string(),
      country: v.optional(v.string()),
      lat: v.number(),
      lng: v.number(),
    }),
    instructions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const payload: PorterCreateOrderPayload = {
      request_id: args.deliveryId.toString(),
      additional_comments: "Please contact restaurant for pickup.",
      delivery_instructions: {
        instructions_list: [
          {
            type: "text",
            description: args.instructions || "Handle food with care",
          },
        ],
      },
      pickup_details: {
        address: {
          street_address1: args.pickupDetails.addressLine1,
          street_address2: args.pickupDetails.addressLine2 || "",
          city: args.pickupDetails.city,
          state: args.pickupDetails.state || "",
          pincode: args.pickupDetails.pincode,
          country: args.pickupDetails.country || "India",
          lat: args.pickupDetails.lat,
          lng: args.pickupDetails.lng,
          contact_details: {
            name: args.pickupDetails.name,
            phone_number: args.pickupDetails.phone,
          },
        },
      },
      drop_details: {
        address: {
          street_address1: args.dropDetails.addressLine1,
          street_address2: args.dropDetails.addressLine2 || "",
          city: args.dropDetails.city,
          state: args.dropDetails.state || "",
          pincode: args.dropDetails.pincode,
          country: args.dropDetails.country || "India",
          lat: args.dropDetails.lat,
          lng: args.dropDetails.lng,
          contact_details: {
            name: args.dropDetails.name,
            phone_number: args.dropDetails.phone,
          },
        },
      },
    };

    const sanitizedReq = sanitizePayload(payload);

    try {
      const response = await createPorterOrder(payload);
      const sanitizedRes = sanitizePayload(response);

      await ctx.runMutation(internal.orderDelivers.finalizePorterDispatchSuccess, {
        deliveryId: args.deliveryId,
        providerOrderId: response.order_id || "",
        trackingUrl: response.tracking_url,
        fare: response.estimated_fare_details?.minor_amount,
        partnerInfo: response.partner_info
          ? {
              name: response.partner_info.name,
              phone: response.partner_info.phone,
              vehicleNumber: response.partner_info.vehicle_number,
              vehicleType: response.partner_info.vehicle_type,
              latitude: response.partner_info.location?.lat,
              longitude: response.partner_info.location?.long,
            }
          : undefined,
        estimatedPickupTime: response.estimated_pickup_time,
        apiRequestSnapshot: sanitizedReq,
        apiResponseSnapshot: sanitizedRes,
      });

      return { success: true, data: response };
    } catch (err: any) {
      await ctx.runMutation(internal.orderDelivers.finalizePorterDispatchFailure, {
        deliveryId: args.deliveryId,
        failureReason: err?.message || "Porter order dispatch failed.",
        apiRequestSnapshot: sanitizedReq,
        apiResponseSnapshot: { error: err?.message || "Unknown error" },
      });

      return { success: false, error: err?.message };
    }
  },
});

// ----------------------------------------------------
// INTERNAL MUTATIONS (CALLBACKS & STATE TRANSITIONS)
// ----------------------------------------------------

/**
 * Internal Mutation: Finalizes a successful outbound Porter dispatch.
 */
export const finalizePorterDispatchSuccess = internalMutation({
  args: {
    deliveryId: v.id("orderDelivers"),
    providerOrderId: v.string(),
    trackingUrl: v.optional(v.string()),
    fare: v.optional(v.number()),
    partnerInfo: v.optional(
      v.object({
        name: v.optional(v.string()),
        vehicleNumber: v.optional(v.string()),
        vehicleType: v.optional(v.string()),
        phone: v.optional(v.string()),
        secondaryPhone: v.optional(v.string()),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
      })
    ),
    estimatedPickupTime: v.optional(v.number()),
    apiRequestSnapshot: v.optional(v.any()),
    apiResponseSnapshot: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery || delivery.deletedAt !== undefined) {
      throw new Error("Delivery record not found.");
    }

    if (!isValidTransition(delivery.status as DeliveryStatus, "open")) {
      throw new Error(
        `Invalid status transition from '${delivery.status}' to 'open'.`
      );
    }

    const now = Date.now();

    await ctx.db.patch(delivery._id, {
      status: "open",
      providerOrderId: args.providerOrderId,
      trackingUrl: args.trackingUrl,
      fare: args.fare,
      partnerInfo: args.partnerInfo,
      estimatedPickupTime: args.estimatedPickupTime,
      apiRequestSnapshot: args.apiRequestSnapshot,
      apiResponseSnapshot: args.apiResponseSnapshot,
      updatedAt: now,
    });

    await ctx.db.insert("orderDeliverStatuses", {
      deliveryId: delivery._id,
      status: "open",
      providerStatus: "open",
      payloadSnapshot: args.apiResponseSnapshot,
      createdAt: now,
      updatedAt: now,
    });

    // Update order delivery charge if fare is provided
    if (args.fare && args.fare > 0) {
      const order = await ctx.db.get(delivery.orderId);
      if (order && (!order.deliveryCharge || order.deliveryCharge === 0)) {
        await ctx.db.patch(order._id, {
          deliveryCharge: args.fare,
          totalAmount: order.totalAmount + args.fare,
          updatedAt: now,
        });
      }
    }

    return { success: true };
  },
});

/**
 * Internal Mutation: Finalizes a failed outbound Porter dispatch.
 */
export const finalizePorterDispatchFailure = internalMutation({
  args: {
    deliveryId: v.id("orderDelivers"),
    failureReason: v.string(),
    apiRequestSnapshot: v.optional(v.any()),
    apiResponseSnapshot: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery || delivery.deletedAt !== undefined) {
      return { success: false };
    }

    const now = Date.now();

    await ctx.db.patch(delivery._id, {
      status: "failed",
      failureReason: args.failureReason,
      apiRequestSnapshot: args.apiRequestSnapshot,
      apiResponseSnapshot: args.apiResponseSnapshot,
      updatedAt: now,
    });

    await ctx.db.insert("orderDeliverStatuses", {
      deliveryId: delivery._id,
      status: "failed",
      providerStatus: "failed",
      notes: args.failureReason,
      payloadSnapshot: args.apiResponseSnapshot,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Internal Mutation: Processes an inbound Porter webhook payload.
 * Enforces idempotency, non-regression, partner details updates, and order fee adjustments.
 */
export const processPorterWebhook = internalMutation({
  args: {
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const payload = args.payload || {};
    const providerOrderId = payload.order_id || payload.orderId;
    const rawStatus = payload.status;
    const details = payload.order_details || {};
    const partnerInfoRaw = payload.partner_info || {};

    if (!providerOrderId) {
      return { acknowledged: true, error: "Missing order_id in webhook payload" };
    }

    // 1. Resolve delivery attempt by providerOrderId index
    const delivery = await ctx.db
      .query("orderDelivers")
      .withIndex("by_provider_order_id", (q) =>
        q.eq("providerOrderId", providerOrderId)
      )
      .first();

    if (!delivery || delivery.deletedAt !== undefined) {
      // Return 200 acknowledged to prevent webhook retry storms for orphaned orders
      return { acknowledged: true, found: false, message: "Order delivery not found." };
    }

    const currentStatus = delivery.status as DeliveryStatus;
    const targetStatus = mapPorterStatusToCanonical(rawStatus);

    const now = Date.now();

    // 2. Parse Partner Info
    const partnerInfo = partnerInfoRaw.name
      ? {
          name: partnerInfoRaw.name,
          vehicleNumber: partnerInfoRaw.vehicle_number || partnerInfoRaw.vehicleNumber,
          vehicleType: partnerInfoRaw.vehicle_type || partnerInfoRaw.vehicleType,
          phone:
            partnerInfoRaw.mobile?.number ||
            partnerInfoRaw.phone ||
            partnerInfoRaw.mobileNumber,
          secondaryPhone: partnerInfoRaw.partner_secondary_mobile?.mobile_number,
          latitude:
            partnerInfoRaw.location?.lat ||
            partnerInfoRaw.latitude,
          longitude:
            partnerInfoRaw.location?.long ||
            partnerInfoRaw.location?.lng ||
            partnerInfoRaw.longitude,
        }
      : delivery.partnerInfo;

    // 3. Update Order Timings
    const orderTimings = { ...(delivery.orderTimings || {}) };
    if (targetStatus === "accepted" && !orderTimings.orderAcceptedTime) {
      orderTimings.orderAcceptedTime = now;
    } else if (targetStatus === "live" && !orderTimings.orderStartedTime) {
      orderTimings.orderStartedTime = now;
      if (!orderTimings.pickupTime) {
        orderTimings.pickupTime = now;
      }
    } else if (targetStatus === "ended" && !orderTimings.orderEndedTime) {
      orderTimings.orderEndedTime = now;
    }

    // 4. State Machine & Idempotency Check
    let nextStatus = currentStatus;
    if (isTerminalStatus(currentStatus)) {
      // Terminal state protection: Do not move out of ended/cancelled/failed
      nextStatus = currentStatus;
    } else if (isValidTransition(currentStatus, targetStatus)) {
      nextStatus = targetStatus;
    }

    // 5. Apply Delivery Record Patch
    await ctx.db.patch(delivery._id, {
      status: nextStatus,
      partnerInfo,
      orderTimings,
      updatedAt: now,
    });

    // 5b. Append status history record if canonical transition occurred
    if (nextStatus !== currentStatus) {
      await ctx.db.insert("orderDeliverStatuses", {
        deliveryId: delivery._id,
        status: nextStatus,
        providerStatus: rawStatus || targetStatus,
        payloadSnapshot: sanitizePayload(payload),
        createdAt: now,
        updatedAt: now,
      });
    }

    // 6. Handle Side Effects (e.g. cancellation removes delivery charge from order)
    if (targetStatus === "cancelled") {
      const order = await ctx.db.get(delivery.orderId);
      if (order && order.deliveryCharge && order.deliveryCharge > 0) {
        const updatedTotal = Math.max(0, order.totalAmount - order.deliveryCharge);
        await ctx.db.patch(order._id, {
          deliveryCharge: 0,
          totalAmount: updatedTotal,
          updatedAt: now,
        });
      }
    }

    return { acknowledged: true, deliveryId: delivery._id, status: nextStatus };
  },
});
