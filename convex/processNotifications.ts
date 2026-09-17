import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  requireMember,
} from "./organizationUsers";
import { requireAdminOrCashier } from "./organizationOrderProcesses";

// ----------------------------------------------------
// TYPES & INTERFACES
// ----------------------------------------------------

export type NotificationType = "At" | "Before" | "After";
export type NotificationVia = "sms" | "whatsapp" | "push" | "email";
export type CustomerType = "all" | "dine_in" | "takeaway" | "delivery";

export interface NotificationTemplateData {
  id?: string;
  tokenNumber?: string;
  paymentMode?: string;
  orderDate?: string;
  orderType?: string;
  orderStatus?: string;
  orderNumber?: string;
  orderTotal?: string;
  orderFrom?: string;
  trackOrderUrl?: string;
  invoiceUrl?: string;
  pastOrderUrl?: string;
  surveyQrUrl?: string;
  customerName?: string;
  organizationName?: string;
  [key: string]: string | undefined;
}

export interface ResolvedNotification {
  notificationId: Id<"processNotifications">;
  notificationType: string;
  notificationVia: string;
  customerType?: string;
  renderedText: string;
  recipientPhone?: string;
  recipientEmail?: string;
  recipientName?: string;
}

// ----------------------------------------------------
// TEMPLATE INTERPOLATION ENGINE
// ----------------------------------------------------

/**
 * Pure function to interpolate dynamic placeholders in notification templates.
 * Replaces case-sensitive [variable_name] placeholders with actual runtime order data.
 * Fallbacks:
 * - [customer_name] falls back to "Customer" if missing or blank.
 * - Missing URLs or other dynamic values fall back to "".
 * - Unknown placeholders are preserved as literal text per product design decision.
 */
export function renderNotificationTemplate(
  template: string,
  data: NotificationTemplateData
): string {
  if (!template) return "";

  const customerName =
    data.customerName && data.customerName.trim() ? data.customerName.trim() : "Customer";

  const placeholderMap: Record<string, string> = {
    id: data.id ?? "",
    token_number: data.tokenNumber ?? "",
    payment_mode: data.paymentMode ?? "",
    order_date: data.orderDate ?? "",
    order_type: data.orderType ?? "",
    order_status: data.orderStatus ?? "",
    order_number: data.orderNumber ?? "",
    order_total: data.orderTotal ?? "",
    order_from: data.orderFrom ?? "",
    track_order_url: data.trackOrderUrl ?? "",
    invoice_url: data.invoiceUrl ?? "",
    past_order_url: data.pastOrderUrl ?? "",
    survey_qr_url: data.surveyQrUrl ?? "",
    customer_name: customerName,
    organization_name: data.organizationName ?? "",
  };

  return template.replace(/\[([a-zA-Z0-9_]+)\]/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(placeholderMap, key)) {
      return placeholderMap[key];
    }
    // Unknown placeholder: preserve as literal
    return match;
  });
}

// ----------------------------------------------------
// NOTIFICATION RESOLUTION HELPER
// ----------------------------------------------------

/**
 * Checks whether a notification's customerType matches the order's orderType.
 */
export function isCustomerTypeMatch(
  notificationCustomerType: string | undefined,
  orderType: string | undefined
): boolean {
  if (!notificationCustomerType || notificationCustomerType === "all") {
    return true;
  }

  if (!orderType) {
    return true;
  }

  const normalizedOrderType = orderType.trim().toLowerCase();
  const normalizedCustomerType = notificationCustomerType.trim().toLowerCase();

  switch (normalizedCustomerType) {
    case "dine_in":
      return normalizedOrderType === "dinein" || normalizedOrderType === "dine_in";
    case "takeaway":
      return normalizedOrderType === "takeaway" || normalizedOrderType === "take_away";
    case "delivery":
      return (
        normalizedOrderType === "delivery" ||
        normalizedOrderType === "scheduleddelivery" ||
        normalizedOrderType === "scheduled_delivery"
      );
    default:
      return true;
  }
}

/**
 * Resolves all active notification configurations for a specific order process step
 * and renders interpolated messages for the given order data.
 */
export async function resolveNotificationsForOrderStatus(
  ctx: QueryCtx | MutationCtx,
  order: any,
  processId: Id<"organizationOrderProcesses">
): Promise<ResolvedNotification[]> {
  const processDoc = await ctx.db.get(processId);
  if (!processDoc || processDoc.deletedAt !== undefined) {
    return [];
  }

  const notifications = await ctx.db
    .query("processNotifications")
    .withIndex("by_process", (q) => q.eq("organizationOrderProcessId", processId))
    .collect();

  const activeNotifications = notifications.filter((n) => n.deletedAt === undefined);
  if (activeNotifications.length === 0) {
    return [];
  }

  // Resolve Store Organization for organization_name
  const org = await ctx.db.query("organizations").first();

  const templateData: NotificationTemplateData = {
    id: order._id?.toString() ?? order.id,
    tokenNumber: order.tokenNumber,
    paymentMode: order.paymentMode,
    orderDate: order.createdAt
      ? new Date(order.createdAt).toLocaleString("en-US", {
          timeZone: org?.organizationTimeZone || "UTC",
        })
      : undefined,
    orderType: order.orderType,
    orderStatus: order.orderStatusName ?? processDoc.name,
    orderNumber: order.orderNumber,
    orderTotal:
      typeof order.totalAmount === "number"
        ? (order.totalAmount / 100).toFixed(2)
        : order.totalAmount?.toString(),
    orderFrom: order.orderSource,
    customerName: order.customerName,
    organizationName: org?.name,
    trackOrderUrl: order.trackOrderUrl ?? "",
    invoiceUrl: order.invoiceUrl ?? "",
    pastOrderUrl: order.pastOrderUrl ?? "",
    surveyQrUrl: order.surveyQrUrl ?? "",
  };

  const results: ResolvedNotification[] = [];

  for (const notification of activeNotifications) {
    if (!isCustomerTypeMatch(notification.customerType, order.orderType)) {
      continue;
    }

    const renderedText = renderNotificationTemplate(
      notification.notificationText,
      templateData
    );

    results.push({
      notificationId: notification._id,
      notificationType: notification.notificationType,
      notificationVia: notification.notificationVia,
      customerType: notification.customerType,
      renderedText,
      recipientPhone: order.customerPhone,
      recipientEmail: order.customerEmail,
      recipientName: order.customerName,
    });
  }

  return results;
}

// ----------------------------------------------------
// DEFAULT NOTIFICATION SEEDS
// ----------------------------------------------------

export const DEFAULT_NOTIFICATION_SEEDS = [
  {
    processName: "Accepted",
    notificationType: "At" as const,
    notificationVia: "sms" as const,
    notificationText:
      "You have successfully placed on order with token is [token_number] at [organization_name]. track your order with [track_order_url]",
  },
  {
    processName: "In progress",
    notificationType: "At" as const,
    notificationVia: "sms" as const,
    notificationText: "Your order is in progress.",
  },
  {
    processName: "Ready to deliver",
    notificationType: "At" as const,
    notificationVia: "sms" as const,
    notificationText:
      "Your order is ready to pick up. Find your invoice here [past_order_url]",
  },
];

/**
 * Idempotently seeds default process notifications for standard order processes.
 */
export async function seedDefaultProcessNotifications(
  ctx: MutationCtx
): Promise<void> {
  const processes = await ctx.db.query("organizationOrderProcesses").collect();
  const activeProcesses = processes.filter((p) => p.deletedAt === undefined);

  const existingNotifications = await ctx.db.query("processNotifications").collect();
  const activeNotifications = existingNotifications.filter((n) => n.deletedAt === undefined);

  const now = Date.now();

  for (const seed of DEFAULT_NOTIFICATION_SEEDS) {
    const matchedProcess = activeProcesses.find(
      (p) => p.name.trim().toLowerCase() === seed.processName.toLowerCase()
    );

    if (!matchedProcess) continue;

    const alreadyExists = activeNotifications.some(
      (n) =>
        n.organizationOrderProcessId === matchedProcess._id &&
        n.notificationVia === seed.notificationVia &&
        n.notificationType === seed.notificationType
    );

    if (!alreadyExists) {
      await ctx.db.insert("processNotifications", {
        organizationOrderProcessId: matchedProcess._id,
        notificationType: seed.notificationType,
        notificationVia: seed.notificationVia,
        notificationText: seed.notificationText,
        customerType: "all",
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

// ----------------------------------------------------
// QUERIES
// ----------------------------------------------------

/**
 * Lists all active process notifications for a specific order process step.
 */
export const listByProcess = query({
  args: {
    organizationOrderProcessId: v.id("organizationOrderProcesses"),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    const processDoc = await ctx.db.get(args.organizationOrderProcessId);
    if (!processDoc || processDoc.deletedAt !== undefined) {
      return [];
    }

    const notifications = await ctx.db
      .query("processNotifications")
      .withIndex("by_process", (q) =>
        q.eq("organizationOrderProcessId", args.organizationOrderProcessId)
      )
      .collect();

    return notifications.filter((n) => n.deletedAt === undefined);
  },
});

/**
 * Lists all active process notifications across all processes for the store organization.
 */
export const listByOrganization = query({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);

    const allNotifications = await ctx.db.query("processNotifications").collect();
    return allNotifications.filter((n) => n.deletedAt === undefined);
  },
});

/**
 * Fetches a single process notification by ID.
 */
export const get = query({
  args: { id: v.id("processNotifications") },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    const notification = await ctx.db.get(args.id);
    if (!notification || notification.deletedAt !== undefined) {
      return null;
    }

    // Verify parent process is not deleted
    const processDoc = await ctx.db.get(notification.organizationOrderProcessId);
    if (!processDoc || processDoc.deletedAt !== undefined) {
      return null;
    }

    return notification;
  },
});

/**
 * Previews a notification template by rendering it with sample or mock data.
 */
export const preview = query({
  args: {
    template: v.string(),
    sampleData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    const org = await ctx.db.query("organizations").first();

    const defaultSampleData: NotificationTemplateData = {
      id: "ord_sample_123",
      tokenNumber: "T-101",
      paymentMode: "UPI / QR",
      orderDate: new Date().toLocaleString("en-US", {
        timeZone: org?.organizationTimeZone || "UTC",
      }),
      orderType: "TakeAway",
      orderStatus: "Ready to deliver",
      orderNumber: "ORD-9901",
      orderTotal: "450.00",
      orderFrom: "POS Terminal",
      customerName: "Alex Mercer",
      organizationName: org?.name ?? "Demo Restaurant",
      trackOrderUrl: "https://track.pos.com/o/sample_123",
      invoiceUrl: "https://bill.pos.com/inv/sample_123",
      pastOrderUrl: "https://store.pos.com/history",
      surveyQrUrl: "https://survey.pos.com/s/sample_123",
    };

    const mergedData: NotificationTemplateData = {
      ...defaultSampleData,
      ...(args.sampleData || {}),
    };

    return renderNotificationTemplate(args.template, mergedData);
  },
});

// ----------------------------------------------------
// MUTATIONS
// ----------------------------------------------------

/**
 * Creates a new process notification template attached to an order process step.
 */
export const create = mutation({
  args: {
    organizationOrderProcessId: v.id("organizationOrderProcesses"),
    notificationType: v.union(
      v.literal("At"),
      v.literal("Before"),
      v.literal("After")
    ),
    notificationVia: v.union(
      v.literal("sms"),
      v.literal("whatsapp"),
      v.literal("push"),
      v.literal("email")
    ),
    notificationText: v.string(),
    customerType: v.optional(
      v.union(
        v.literal("all"),
        v.literal("dine_in"),
        v.literal("takeaway"),
        v.literal("delivery")
      )
    ),
    legacyId: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    // 1. Verify parent process exists and is not soft-deleted
    const processDoc = await ctx.db.get(args.organizationOrderProcessId);
    if (!processDoc || processDoc.deletedAt !== undefined) {
      throw new Error("Order process not found");
    }

    // 2. Validate notification text is not empty or whitespace only
    if (!args.notificationText || !args.notificationText.trim()) {
      throw new Error("Notification text can't be blank");
    }

    const now = Date.now();

    const notificationId = await ctx.db.insert("processNotifications", {
      legacyId: args.legacyId,
      organizationOrderProcessId: args.organizationOrderProcessId,
      notificationType: args.notificationType,
      notificationVia: args.notificationVia,
      notificationText: args.notificationText.trim(),
      customerType: args.customerType ?? "all",
      createdAt: args.createdAt ?? now,
      updatedAt: args.updatedAt ?? now,
    });

    return notificationId;
  },
});

/**
 * Updates an existing process notification template.
 */
export const update = mutation({
  args: {
    id: v.id("processNotifications"),
    organizationOrderProcessId: v.optional(v.id("organizationOrderProcesses")),
    notificationType: v.optional(
      v.union(v.literal("At"), v.literal("Before"), v.literal("After"))
    ),
    notificationVia: v.optional(
      v.union(
        v.literal("sms"),
        v.literal("whatsapp"),
        v.literal("push"),
        v.literal("email")
      )
    ),
    notificationText: v.optional(v.string()),
    customerType: v.optional(
      v.union(
        v.literal("all"),
        v.literal("dine_in"),
        v.literal("takeaway"),
        v.literal("delivery")
      )
    ),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Notification not found");
    }

    // If changing organizationOrderProcessId, verify destination process exists
    if (
      args.organizationOrderProcessId &&
      args.organizationOrderProcessId !== existing.organizationOrderProcessId
    ) {
      const targetProcess = await ctx.db.get(args.organizationOrderProcessId);
      if (!targetProcess || targetProcess.deletedAt !== undefined) {
        throw new Error("Order process not found");
      }
    }

    // Validate notificationText if provided
    if (args.notificationText !== undefined) {
      if (!args.notificationText.trim()) {
        throw new Error("Notification text can't be blank");
      }
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      ...(args.organizationOrderProcessId !== undefined
        ? { organizationOrderProcessId: args.organizationOrderProcessId }
        : {}),
      ...(args.notificationType !== undefined
        ? { notificationType: args.notificationType }
        : {}),
      ...(args.notificationVia !== undefined
        ? { notificationVia: args.notificationVia }
        : {}),
      ...(args.notificationText !== undefined
        ? { notificationText: args.notificationText.trim() }
        : {}),
      ...(args.customerType !== undefined
        ? { customerType: args.customerType }
        : {}),
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Soft deletes a process notification template.
 */
export const remove = mutation({
  args: { id: v.id("processNotifications") },
  handler: async (ctx, args) => {
    await requireAdminOrCashier(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.deletedAt !== undefined) {
      throw new Error("Notification not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      deletedAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Mutation endpoint to seed default process notifications.
 */
export const seedDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCashier(ctx);
    await seedDefaultProcessNotifications(ctx);
    return { success: true };
  },
});
