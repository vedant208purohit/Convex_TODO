import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { resolveNotificationsForOrderStatus } from "./processNotifications";
import { handleOrderCompletionTransfer } from "./providerPaymentTransfers";
import { Id } from "./_generated/dataModel";
import { validateActivePaymentMode } from "./paymentModes";
import { resolveOrderItemStation } from "./stations";

// ==========================================
// ORDER ACTIVITY DURATION & LIFECYCLE HELPER
// ==========================================

/**
 * Authoritative server-side helper to record order activity transitions and elapsed duration.
 * Legacy behavior:
 * - Position 1 / Initial step: totalDuration = 0.
 * - Subsequent steps: totalDuration = Math.max(0, Math.round((now - sinceFirstStep) / 1000)) (integer seconds).
 * - Closes previous active activity by setting completedAt = now.
 */
export async function recordOrderActivity(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    orderId: Id<"orders">;
    processId?: Id<"organizationOrderProcesses">;
    processName: string;
    position?: number;
    now?: number;
  }
) {
  const now = args.now ?? Date.now();

  const existingActivities = await ctx.db
    .query("orderActivities")
    .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
    .collect();

  const activeActivities = existingActivities.filter((a) => a.deletedAt === undefined);

  let totalDuration = 0;
  if (activeActivities.length > 0) {
    const sorted = [...activeActivities].sort(
      (a, b) => a.position - b.position || a.createdAt - b.createdAt
    );
    const firstActivity = sorted[0];
    const sinceFirstStep = firstActivity.startedAt ?? firstActivity.createdAt;
    totalDuration = Math.max(0, Math.round((now - sinceFirstStep) / 1000));

    // Close the previous active activity if not already completed
    const lastActivity = sorted[sorted.length - 1];
    if (lastActivity && lastActivity.completedAt === undefined) {
      await ctx.db.patch(lastActivity._id, {
        completedAt: now,
        updatedAt: now,
      });
    }
  }

  const nextPosition = args.position ?? activeActivities.length + 1;

  const activityId = await ctx.db.insert("orderActivities", {
    organizationId: args.organizationId,
    orderId: args.orderId,
    processId: args.processId,
    processName: args.processName,
    position: nextPosition,
    totalDuration,
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  return { activityId, totalDuration, position: nextPosition };
}


async function resolveWaiterInfo(ctx: any, waiterUserId?: string) {
  if (!waiterUserId || !waiterUserId.trim()) return null;
  const idStr = waiterUserId.trim();

  try {
    const userDoc = await ctx.db.get(idStr as any);
    if (userDoc) {
      const name = `${userDoc.firstName || ""} ${userDoc.lastName || ""}`.trim() || userDoc.name || userDoc.email || idStr;
      return { id: userDoc._id, name };
    }
  } catch {}

  const orgUser = await ctx.db
    .query("organizationUsers")
    .withIndex("by_user", (q: any) => q.eq("userId", idStr))
    .first();
  if (orgUser) {
    const name = `${orgUser.firstName || ""} ${orgUser.lastName || ""}`.trim() || orgUser.email || idStr;
    return { id: orgUser._id, name };
  }

  return { id: idStr, name: idStr };
}

// ==========================================
// SCHEDULING TIMING & SLOT VALIDATION HELPERS
// ==========================================

export function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr || typeof timeStr !== "string") return null;
  const trimmed = timeStr.trim();

  // 12-hour format: e.g. "11:00 AM", "2:30 PM", "12:39 PM"
  const match12h = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (match12h) {
    let h = parseInt(match12h[1], 10);
    const m = parseInt(match12h[2], 10);
    const period = match12h[3].toUpperCase();
    if (period === "PM" && h < 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return h * 60 + m;
  }

  // 24-hour format: e.g. "11:00", "23:59"
  const match24h = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match24h) {
    const h = parseInt(match24h[1], 10);
    const m = parseInt(match24h[2], 10);
    return h * 60 + m;
  }

  // Full date string format
  const parsedDate = new Date(trimmed);
  if (!isNaN(parsedDate.getTime())) {
    return parsedDate.getHours() * 60 + parsedDate.getMinutes();
  }

  return null;
}

export function parseLeadTimeMinutes(limit?: string | number | null): number {
  if (typeof limit === "number" && limit >= 0) {
    if (limit <= 72) return limit * 60;
    return limit;
  }
  if (!limit || typeof limit !== "string") return 30;

  const trimmed = limit.trim().toLowerCase();
  const matchNum = trimmed.match(/\d+/);
  if (!matchNum) return 30;

  const num = parseInt(matchNum[0], 10);
  if (trimmed.includes("day")) return num * 24 * 60;
  if (trimmed.includes("hour") || trimmed.includes("hr")) return num * 60;
  if (trimmed.includes("min") || trimmed.includes("m")) return num;
  if (num > 0 && num <= 72) return num * 60;
  return num;
}

export function parseAdvanceDaysCount(
  limit?: number | string | null,
  limitType?: string | null
): number {
  const num = typeof limit === "number" ? limit : parseInt(String(limit || 7), 10);
  const count = isNaN(num) || num <= 0 ? 7 : num;
  const type = (limitType || "days").trim().toLowerCase();

  if (type.startsWith("month")) {
    return count * 30;
  }
  if (type.startsWith("week")) {
    return count * 7;
  }
  return count;
}

export function getStoreTimeContext(timestamp: number, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "long",
  });

  const parts = formatter.formatToParts(new Date(timestamp));
  let year = "", month = "", day = "", hour = "0", minute = "0", weekday = "";
  for (const p of parts) {
    if (p.type === "year") year = p.value;
    if (p.type === "month") month = p.value;
    if (p.type === "day") day = p.value;
    if (p.type === "hour") hour = p.value === "24" ? "00" : p.value;
    if (p.type === "minute") minute = p.value;
    if (p.type === "weekday") weekday = p.value;
  }

  const ymd = `${year}-${month}-${day}`;
  const totalMinutes = parseInt(hour, 10) * 60 + parseInt(minute, 10);

  return {
    ymd,
    weekday,
    totalMinutes,
  };
}

export function normalizeTargetDateYMD(dateStr: string, timeZone: string): { ymd: string; weekday: string } {
  const trimmed = dateStr.trim();
  // If in YYYY-MM-DD format
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const d = new Date(parseInt(ymdMatch[1], 10), parseInt(ymdMatch[2], 10) - 1, parseInt(ymdMatch[3], 10), 12, 0, 0);
    const dayFormatter = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" });
    return { ymd: trimmed, weekday: dayFormatter.format(d) };
  }

  // Clean conversational prefixes: e.g. "Today (Fri, Oct 9)" -> "Fri, Oct 9"
  const cleaned = trimmed.replace(/^(today|tomorrow)\s*\(/i, "").replace(/\)$/, "").trim();

  // If missing 4-digit year, attach current store year
  let parseTarget = cleaned;
  if (!/\b\d{4}\b/.test(cleaned)) {
    const currentStoreContext = getStoreTimeContext(Date.now(), timeZone);
    const currentYear = currentStoreContext.ymd.split("-")[0];
    parseTarget = `${cleaned}, ${currentYear}`;
  }

  const parsed = new Date(parseTarget);
  if (!isNaN(parsed.getTime())) {
    const ctx = getStoreTimeContext(parsed.getTime(), timeZone);
    return { ymd: ctx.ymd, weekday: ctx.weekday };
  }

  return { ymd: trimmed, weekday: "Monday" };
}

export function validateScheduledOrderSlot(args: {
  dateStr: string;
  timeSlotStr: string;
  isPickup: boolean;
  scheduleConfig?: any;
  timeZone: string;
  currentTimeMs?: number;
}) {
  const now = args.currentTimeMs ?? Date.now();
  const currentStoreTime = getStoreTimeContext(now, args.timeZone);
  const targetDate = normalizeTargetDateYMD(args.dateStr, args.timeZone);

  // 1. Check Date is not in the past
  if (targetDate.ymd < currentStoreTime.ymd) {
    throw new Error("Selected schedule date cannot be in the past.");
  }

  // 1.5 Check Date does not exceed configured advance booking horizon
  const advanceLimit = args.isPickup
    ? args.scheduleConfig?.advancePickupLimit
    : args.scheduleConfig?.advanceDeliveryLimit;
  const advanceLimitType = args.isPickup
    ? args.scheduleConfig?.advancePickupLimitType
    : args.scheduleConfig?.advanceDeliveryLimitType;
  const horizonDays = parseAdvanceDaysCount(advanceLimit, advanceLimitType);

  const [cYear, cMonth, cDay] = currentStoreTime.ymd.split("-").map(Number);
  const maxDate = new Date(cYear, cMonth - 1, cDay + horizonDays, 23, 59, 59);
  const maxYear = maxDate.getFullYear();
  const maxM = String(maxDate.getMonth() + 1).padStart(2, "0");
  const maxD = String(maxDate.getDate()).padStart(2, "0");
  const maxYMD = `${maxYear}-${maxM}-${maxD}`;

  if (targetDate.ymd > maxYMD) {
    throw new Error(`Selected date is beyond the maximum advance booking limit (${horizonDays} days).`);
  }

  // 2. Parse slot window: e.g. "12:00 PM – 12:30 PM" or "12:00 PM - 12:30 PM"
  const slotParts = args.timeSlotStr.split(/[–\-]/);
  let slotStartMinutes: number | null = null;
  let slotEndMinutes: number | null = null;

  if (slotParts.length >= 2) {
    slotStartMinutes = parseTimeToMinutes(slotParts[0]);
    slotEndMinutes = parseTimeToMinutes(slotParts[1]);
  } else {
    slotStartMinutes = parseTimeToMinutes(args.timeSlotStr);
    slotEndMinutes = slotStartMinutes !== null ? slotStartMinutes + 30 : null;
  }

  if (slotStartMinutes === null || slotEndMinutes === null) {
    throw new Error(`Invalid scheduled time slot format: ${args.timeSlotStr}`);
  }

  // 3. Resolve lead time buffer
  const rawLeadTime = args.isPickup
    ? args.scheduleConfig?.advanceOrderTimeLimit
    : args.scheduleConfig?.advanceScheduleDeliveryOrderTimeLimit;
  const leadTimeMinutes = parseLeadTimeMinutes(rawLeadTime);

  // 4. Real-time filtering for today: past slots or slots that have already started are rejected
  const isToday = targetDate.ymd === currentStoreTime.ymd;
  if (isToday) {
    // A slot that has ended (slotEnd <= currentStoreTime) is strictly expired
    if (slotEndMinutes <= currentStoreTime.totalMinutes) {
      throw new Error("Selected time slot has already ended. Please select an upcoming slot.");
    }

    // A slot that has already started (slotStart <= currentStoreTime) cannot be booked
    if (slotStartMinutes <= currentStoreTime.totalMinutes) {
      throw new Error("Selected time slot is no longer available. Please select an upcoming slot.");
    }

    // A slot within minimum preparation lead time buffer cannot be booked
    if (slotStartMinutes < currentStoreTime.totalMinutes + leadTimeMinutes) {
      throw new Error("Selected time slot does not meet the minimum advance preparation lead time.");
    }
  }

  // 5. Operating Hours & Weekly Schedule validation
  const weeklyTimings = args.isPickup
    ? args.scheduleConfig?.pickupTimings
    : args.scheduleConfig?.deliveryTimings;

  if (weeklyTimings) {
    const daySchedule = weeklyTimings[targetDate.weekday];
    if (daySchedule && !daySchedule.is_open) {
      throw new Error(`The store is closed for ${args.isPickup ? "pickup" : "delivery"} on ${targetDate.weekday}.`);
    }

    if (daySchedule && Array.isArray(daySchedule.hours) && daySchedule.hours.length > 0) {
      let isWithinAnyShift = false;
      for (const shift of daySchedule.hours) {
        const shiftStart = parseTimeToMinutes(shift.start_time);
        const shiftEnd = parseTimeToMinutes(shift.end_time);
        if (shiftStart !== null && shiftEnd !== null) {
          if (slotStartMinutes >= shiftStart && slotEndMinutes <= shiftEnd) {
            isWithinAnyShift = true;
            break;
          }
        }
      }

      if (!isWithinAnyShift) {
        throw new Error("Selected time slot is outside the store's configured operating hours.");
      }
    }
  }
}

// ==========================================
// 1. ORDER CREATION MUTATION (POS & ONLINE)
// ==========================================

export const createOrder = mutation({
  args: {
    organizationId: v.id("organizations"),
    orderType: v.union(
      v.literal("DineIn"),
      v.literal("TakeAway"),
      v.literal("Delivery"),
      v.literal("ScheduledPickup"),
      v.literal("ScheduledDelivery")
    ),
    orderSource: v.optional(v.string()), // "Prest-Cashier", "Prest-Captain", "Prest-Online"
    tableId: v.optional(v.id("organizationTables")),
    qrId: v.optional(v.union(v.id("organizationQrCodes"), v.string())),
    waiterUserId: v.optional(v.string()),
    cashierUserId: v.optional(v.string()),
    membersOnTable: v.optional(v.number()),

    // Customer Information
    customerId: v.optional(v.id("customers")),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    customerEmail: v.optional(v.string()),

    // Financial Overrides (in minor units)
    discountAmount: v.optional(v.number()),
    deliveryCharge: v.optional(v.number()),
    paymentStatus: v.optional(
      v.union(v.literal("Pending"), v.literal("Paid"), v.literal("Failed"))
    ),

    // Delivery Address Details
    userAddressId: v.optional(v.id("userAddresses")),
    deliveryAddress: v.optional(
      v.object({
        addressLine1: v.string(),
        addressLine2: v.optional(v.string()),
        landmark: v.optional(v.string()),
        city: v.optional(v.string()),
        zipCode: v.optional(v.string()),
        addressType: v.optional(v.string()),
      })
    ),

    // Scheduled Delivery & Pickup Timing
    scheduledDeliveryDate: v.optional(v.string()),
    scheduledDeliveryTime: v.optional(v.string()),
    scheduledPickupDate: v.optional(v.string()),
    scheduledPickupTime: v.optional(v.string()),

    paymentMode: v.optional(v.string()),
    specialNotes: v.optional(v.string()),
    items: v.array(
      v.object({
        itemId: v.id("items"),
        quantity: v.number(),
        isToGo: v.optional(v.boolean()),
        customizations: v.optional(
          v.array(
            v.object({
              customizationId: v.id("customizations"),
              optionId: v.id("customizationItems"),
            })
          )
        ),
        prepPreferences: v.optional(
          v.array(
            v.union(
              v.string(),
              v.object({
                preferenceId: v.optional(v.id("chefPrepPreferences")),
                name: v.string(),
              })
            )
          )
        ),
        chefPrepPreferences: v.optional(
          v.array(
            v.union(
              v.string(),
              v.object({
                preferenceId: v.optional(v.id("chefPrepPreferences")),
                name: v.string(),
              })
            )
          )
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const todayStart = new Date(now).setHours(0, 0, 0, 0);

    const org = await ctx.db.get(args.organizationId);
    if (!org || org.deletedAt !== undefined) {
      throw new Error("Organization not found or inactive.");
    }
    const orgTimeZone = org?.organizationTimeZone || "Asia/Kolkata";

    // 0. Service-Mode Feature Toggle Enforcement
    if (
      args.orderSource === "PREST-QR" ||
      args.orderSource === "PREST-DIGITAL-STORE" ||
      args.orderSource === "PREST-ONLINE" ||
      args.orderSource === "Prest-Online" ||
      args.orderSource === "ONLINE"
    ) {
      if (args.orderType === "DineIn" && org.isDineIn === false) {
        throw new Error("Dine In service is currently disabled for this store.");
      }
      if (args.orderType === "TakeAway" && org.isTakeAway === false) {
        throw new Error("Takeaway service is currently disabled for this store.");
      }
      if (args.orderType === "ScheduledPickup") {
        if (org.isTakeAway === false) {
          throw new Error("Takeaway service is currently disabled for this store.");
        }
        if (org.scheduledPickup === false) {
          throw new Error("Scheduled pickup is currently disabled for this store.");
        }
      }
      if (args.orderType === "Delivery" && org.isDelivery === false) {
        throw new Error("Delivery service is currently disabled for this store.");
      }
      if (args.orderType === "ScheduledDelivery") {
        if (org.isDelivery === false) {
          throw new Error("Delivery service is currently disabled for this store.");
        }
        if (org.scheduledDelivery === false) {
          throw new Error("Scheduled delivery is currently disabled for this store.");
        }
      }
    } else {
      if (args.orderType === "ScheduledPickup" && org.scheduledPickup === false) {
        throw new Error("Scheduled pickup is currently disabled for this store.");
      }
      if (args.orderType === "ScheduledDelivery" && org.scheduledDelivery === false) {
        throw new Error("Scheduled delivery is currently disabled for this store.");
      }
    }

    // Validation for Scheduled Delivery timing fields & operating hours slot
    if (args.orderType === "ScheduledDelivery") {
      if (!args.scheduledDeliveryDate || !args.scheduledDeliveryTime) {
        throw new Error(
          "Scheduled delivery requires scheduledDeliveryDate and scheduledDeliveryTime."
        );
      }
    }

    // Validation for Scheduled Pickup timing fields
    if (args.orderType === "ScheduledPickup") {
      const pickupDate = args.scheduledPickupDate || args.scheduledDeliveryDate;
      const pickupTime = args.scheduledPickupTime || args.scheduledDeliveryTime;
      if (!pickupDate || !pickupTime) {
        throw new Error(
          "Scheduled pickup requires scheduledPickupDate and scheduledPickupTime."
        );
      }
    }

    // Validate scheduled slot against organization operating schedule
    if (args.orderType === "ScheduledDelivery" || args.orderType === "ScheduledPickup") {
      const isPickup = args.orderType === "ScheduledPickup";
      const targetDate = (isPickup ? args.scheduledPickupDate || args.scheduledDeliveryDate : args.scheduledDeliveryDate)!;
      const targetSlot = (isPickup ? args.scheduledPickupTime || args.scheduledDeliveryTime : args.scheduledDeliveryTime)!;

      const scheduleConfigs = await ctx.db.query("organizationSchedulePickups").collect();
      const activeSchedule = scheduleConfigs.find((c) => c.deletedAt === undefined);

      validateScheduledOrderSlot({
        dateStr: targetDate,
        timeSlotStr: targetSlot,
        isPickup,
        scheduleConfig: activeSchedule,
        timeZone: orgTimeZone,
        currentTimeMs: now,
      });
    }

    // 0. Postpaid QR Verification Guard
    const reqTableId = args.tableId;
    const isOnlinePayment =
      args.paymentMode === "Razorpay" ||
      args.paymentMode === "Online" ||
      args.paymentMode === "Stripe" ||
      args.paymentMode === "UPI" ||
      args.paymentMode === "Card";

    if (!isOnlinePayment && reqTableId && !args.cashierUserId && !args.waiterUserId) {
      if (org && org.dineinPospaid) {
        const identity = await ctx.auth.getUserIdentity();
        if (identity) {
          const activeReqs = await ctx.db
            .query("postpaidOrderRequests")
            .withIndex("by_table_and_status", (q) =>
              q.eq("tableId", reqTableId).eq("status", "approved")
            )
            .collect();

          const validReq = activeReqs.find(
            (r) =>
              r.deletedAt === undefined &&
              r.userId === identity.subject &&
              r.otpVerifiedAt !== undefined
          );

          if (!validReq) {
            throw new Error(
              "Unverified postpaid order request. OTP verification is required before placing a QR dine-in order."
            );
          }
        }
      }
    }

    // 1. Calculate Daily Token Number (#01, #02, #03...)
    const todayOrders = await ctx.db
      .query("orders")
      .withIndex("by_created_at", (q) =>
        q.eq("organizationId", args.organizationId).gte("createdAt", todayStart)
      )
      .collect();

    const tokenCount = todayOrders.length + 1;
    const tokenNumber = "#" + tokenCount.toString().padStart(2, "0");

    // 2. Generate Formatted Order Number (e.g. ORD-20260901-001)
    const dateStr = new Date(now).toISOString().slice(0, 10).replace(/-/g, "");
    const orderNumber = "ORD-" + dateStr + "-" + tokenCount.toString().padStart(3, "0");

    // 3. Resolve Organization Taxes & Default Groups
    const defaultTaxGroups = await ctx.db
      .query("taxGroups")
      .withIndex("by_org_default", (q) =>
        q.eq("organizationId", args.organizationId).eq("isDefault", true)
      )
      .collect();

    const fallbackTaxGroup = defaultTaxGroups.length > 0 ? defaultTaxGroups[0] : null;

    // Cache tax groups and components
    const taxGroupCache = new Map<string, any>();
    const taxCompCache = new Map<string, any>();

    // 4. Calculate Subtotal, Line Items, and Tax Amounts
    let rawSubTotal = 0;
    let rawTaxInclusive = 0;
    let rawTaxExclusive = 0;
    const lineItemConfigs: Array<any> = [];
    const taxCompAccumulator = new Map<string, { name: string; code: string; rate: number; amountPaise: number }>();

    for (const inputItem of args.items) {
      const dbItem = await ctx.db.get(inputItem.itemId);
      if (!dbItem) throw new Error("Item not found");

      let itemUnitPrice = dbItem.price; // in minor units
      const resolvedCustomizations: Array<any> = [];

      if (inputItem.customizations) {
        for (const custInput of inputItem.customizations) {
          const custGroup = await ctx.db.get(custInput.customizationId);
          const custOption = await ctx.db.get(custInput.optionId);
          if (custGroup && custOption && custOption.deletedAt === undefined) {
            itemUnitPrice += custOption.price;
            resolvedCustomizations.push({
              customizationId: custGroup._id,
              customizationName: custGroup.name,
              optionId: custOption._id,
              optionName: custOption.name,
              price: custOption.price,
              isGst: custOption.isGst !== undefined ? custOption.isGst : dbItem.isGst,
              taxGroupId: custOption.taxGroupId,
              taxMode: custOption.taxMode,
            });
          }
        }
      }

      const itemLineTotal = itemUnitPrice * inputItem.quantity;
      rawSubTotal += itemLineTotal;

      // 1. Base item tax calculation
      const baseLineTotal = dbItem.price * inputItem.quantity;
      if (dbItem.isGst && baseLineTotal > 0) {
        let itemTg = null;
        const tgId = dbItem.taxGroupId || fallbackTaxGroup?._id;
        if (tgId) {
          if (taxGroupCache.has(tgId)) {
            itemTg = taxGroupCache.get(tgId);
          } else {
            itemTg = await ctx.db.get(tgId);
            taxGroupCache.set(tgId, itemTg);
          }
        }

        if (itemTg && itemTg.componentIds && itemTg.componentIds.length > 0) {
          const itemMode = dbItem.taxMode || itemTg.taxMode || "inclusive";
          const comps: Array<any> = [];
          let totalRate = 0;

          for (const cid of itemTg.componentIds) {
            let comp = null;
            if (taxCompCache.has(cid)) {
              comp = taxCompCache.get(cid);
            } else {
              comp = await ctx.db.get(cid);
              taxCompCache.set(cid, comp);
            }
            if (comp) {
              comps.push(comp);
              totalRate += comp.rate;
            }
          }

          if (totalRate > 0) {
            let lineTaxPaise = 0;
            if (itemMode === "inclusive") {
              lineTaxPaise = Math.round(baseLineTotal * (totalRate / (100 + totalRate)));
              rawTaxInclusive += lineTaxPaise;
            } else {
              lineTaxPaise = Math.round(baseLineTotal * (totalRate / 100));
              rawTaxExclusive += lineTaxPaise;

              for (const comp of comps) {
                const compShare = totalRate > 0 ? comp.rate / totalRate : 0;
                const compTaxPaise = Math.round(lineTaxPaise * compShare);
                const key = `${comp.name}_${comp.rate}`;
                const existing = taxCompAccumulator.get(key);
                if (existing) {
                  existing.amountPaise += compTaxPaise;
                } else {
                  taxCompAccumulator.set(key, {
                    name: comp.name,
                    code: comp.code ?? comp.name,
                    rate: comp.rate,
                    amountPaise: compTaxPaise,
                  });
                }
              }
            }
          }
        }
      }

      // 2. Customization items tax calculation
      for (const cust of resolvedCustomizations) {
        const custLineTotal = (cust.price || 0) * inputItem.quantity;
        const custIsGstActive = cust.isGst !== undefined ? cust.isGst : dbItem.isGst;
        if (custIsGstActive && custLineTotal > 0) {
          let custTg = null;
          const tgId = cust.taxGroupId || fallbackTaxGroup?._id;
          if (tgId) {
            if (taxGroupCache.has(tgId)) {
              custTg = taxGroupCache.get(tgId);
            } else {
              custTg = await ctx.db.get(tgId);
              taxGroupCache.set(tgId, custTg);
            }
          }

          if (custTg && custTg.componentIds && custTg.componentIds.length > 0) {
            const custMode = cust.taxMode || custTg.taxMode || "inclusive";
            const comps: Array<any> = [];
            let totalRate = 0;

            for (const cid of custTg.componentIds) {
              let comp = null;
              if (taxCompCache.has(cid)) {
                comp = taxCompCache.get(cid);
              } else {
                comp = await ctx.db.get(cid);
                taxCompCache.set(cid, comp);
              }
              if (comp) {
                comps.push(comp);
                totalRate += comp.rate;
              }
            }

            if (totalRate > 0) {
              let lineTaxPaise = 0;
              if (custMode === "inclusive") {
                lineTaxPaise = Math.round(custLineTotal * (totalRate / (100 + totalRate)));
                rawTaxInclusive += lineTaxPaise;
              } else {
                lineTaxPaise = Math.round(custLineTotal * (totalRate / 100));
                rawTaxExclusive += lineTaxPaise;

                for (const comp of comps) {
                  const compShare = totalRate > 0 ? comp.rate / totalRate : 0;
                  const compTaxPaise = Math.round(lineTaxPaise * compShare);
                  const key = `${comp.name}_${comp.rate}`;
                  const existing = taxCompAccumulator.get(key);
                  if (existing) {
                    existing.amountPaise += compTaxPaise;
                  } else {
                    taxCompAccumulator.set(key, {
                      name: comp.name,
                      code: comp.code ?? comp.name,
                      rate: comp.rate,
                      amountPaise: compTaxPaise,
                    });
                  }
                }
              }
            }
          }
        }
      }

      // Resolve Chef Prep Preferences
      const rawPrepPrefs = (inputItem as any).prepPreferences || (inputItem as any).chefPrepPreferences || [];
      const resolvedPrepPreferences: Array<{ preferenceId?: Id<"chefPrepPreferences">; name: string }> = [];
      for (const pref of rawPrepPrefs) {
        if (typeof pref === "string" && pref.trim()) {
          resolvedPrepPreferences.push({ name: pref.trim() });
        } else if (pref && typeof pref === "object" && pref.name) {
          resolvedPrepPreferences.push({
            preferenceId: pref.preferenceId,
            name: pref.name.trim(),
          });
        }
      }

      lineItemConfigs.push({
        itemId: dbItem._id,
        itemName: dbItem.name,
        itemPrice: itemUnitPrice,
        quantity: inputItem.quantity,
        totalPrice: itemLineTotal,
        customizations: resolvedCustomizations,
        prepPreferences: resolvedPrepPreferences.length > 0 ? resolvedPrepPreferences : undefined,
        chefPrepPreferences: resolvedPrepPreferences.length > 0 ? resolvedPrepPreferences : undefined,
        isToGo: inputItem.isToGo ?? false,
      });
    }

    const subTotal = Math.round(rawSubTotal);
    const taxTotal = Math.round(rawTaxInclusive + rawTaxExclusive);
    const discount = args.discountAmount ?? 0;
    const delivery = args.deliveryCharge ?? 0;

    // Inclusive tax is already inside subTotal, exclusive tax is added on top
    const totalAmount = Math.max(0, subTotal + rawTaxExclusive - discount + delivery);

    // Build Tax Snapshot
    const taxInfoSnapshot = {
      tax_mode: rawTaxExclusive > 0 ? "exclusive" : "inclusive",
      tax_amount: (taxTotal / 100).toFixed(2),
      sub_total: (subTotal / 100).toFixed(2),
      discount_amount: (discount / 100).toFixed(2),
      delivery_charge: (delivery / 100).toFixed(2),
      total_amount: (totalAmount / 100).toFixed(2),
      components: Array.from(taxCompAccumulator.values()).map((c) => ({
        name: c.name,
        code: c.code,
        rate: c.rate,
        amount: (c.amountPaise / 100).toFixed(2),
      })),
    };

    // 5. Resolve Initial Order Process Status
    const orgProcesses = await ctx.db
      .query("organizationOrderProcesses")
      .collect();

    const sequenceProcesses = orgProcesses
      .filter((p) => p.published && p.isSequence)
      .sort((a, b) => a.position - b.position);

    const initialStatus = sequenceProcesses.length > 0 ? sequenceProcesses[0] : null;

    const resolvedPaymentStatus =
      args.paymentStatus ??
      (args.orderSource === "Prest-Cashier" || (args.paymentMode && args.orderSource !== "Prest-Online")
        ? "Paid"
        : "Pending");

    // Fallback unique non-repeating phone number generator for guest orders
    const generateUniquePhone = () => {
      const timeSlice = (now % 1000000).toString().padStart(6, "0");
      const randomSeed = Math.floor(10 + Math.random() * 90).toString();
      return `+91 90${timeSlice}${randomSeed}`;
    };

    const resolvedCustomerPhone = args.customerPhone?.trim() || generateUniquePhone();
    const resolvedCustomerName = args.customerName?.trim() || "Guest Customer";

    // 5.5 Validate Payment Mode Availability for Store Checkout
    if (args.paymentMode && args.paymentMode !== "Pending") {
      await validateActivePaymentMode(ctx, args.organizationId, {
        paymentModeName: args.paymentMode,
      });
    }

    // Resolve QR Code reference for attribution
    let autoQrId: Id<"organizationQrCodes"> | undefined = undefined;

    if (args.qrId) {
      try {
        const directQr = await ctx.db.get(args.qrId as Id<"organizationQrCodes">);
        if (directQr && directQr.deletedAt === undefined) {
          autoQrId = directQr._id;
        }
      } catch { }
    }

    if (!autoQrId && args.tableId) {
      const tableQrs = await ctx.db
        .query("organizationQrCodes")
        .withIndex("by_table", (q) => q.eq("tableId", args.tableId!.toString()))
        .collect();
      const activeQr = tableQrs.find((q) => q.deletedAt === undefined);
      if (activeQr) {
        autoQrId = activeQr._id;
      }
    }

    const isOnlineOrQrSource =
      !args.orderSource ||
      args.orderSource === "Prest-Online" ||
      args.orderSource.toUpperCase().includes("QR");

    if (!autoQrId && isOnlineOrQrSource) {
      const isTakeawayType = args.orderType === "TakeAway" || args.orderType === "ScheduledPickup";
      const isDeliveryType = args.orderType === "Delivery" || args.orderType === "ScheduledDelivery";

      if (isTakeawayType || isDeliveryType) {
        const orgQrs = await ctx.db
          .query("organizationQrCodes")
          .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
          .collect();

        const activeQr = orgQrs.find((q) => {
          if (q.deletedAt !== undefined || q.status === "INACTIVE") return false;
          const normalized = q.qrType ? q.qrType.toUpperCase().replace(/[-_\s]/g, "") : "";
          if (isTakeawayType && (normalized === "TAKEAWAY" || q.qrType === "TakeAway")) return true;
          if (isDeliveryType && (normalized === "DELIVERY" || q.qrType === "Delivery")) return true;
          return false;
        });

        if (activeQr) {
          autoQrId = activeQr._id;
        }
      }
    }

    // 6. Insert Order Header
    const orderId = await ctx.db.insert("orders", {
      organizationId: args.organizationId,
      orderNumber,
      tokenNumber,
      orderType: args.orderType,
      orderSource: args.orderSource ?? "Prest-Cashier",
      orderStatusId: initialStatus?._id,
      orderStatusName: initialStatus?.name ?? "Accepted",
      isCompleted: args.orderType === "DineIn" ? false : resolvedPaymentStatus === "Paid",
      isRejected: false,
      isModify: false,
      tableId: args.tableId,
      qrId: autoQrId,
      waiterUserId: args.waiterUserId,
      cashierUserId: args.cashierUserId,
      membersOnTable: args.membersOnTable ?? 1,
      customerId: args.customerId,
      customerName: resolvedCustomerName,
      customerPhone: resolvedCustomerPhone,
      customerEmail: args.customerEmail,
      subTotal,
      taxTotal,
      discountAmount: args.discountAmount,
      deliveryCharge: args.deliveryCharge,
      userAddressId: args.userAddressId,
      deliveryAddress: args.deliveryAddress,
      scheduledDeliveryDate:
        args.scheduledDeliveryDate ||
        args.scheduledPickupDate ||
        (args.orderType === "ScheduledDelivery" || args.orderType === "ScheduledPickup"
          ? new Date(now).toLocaleDateString("en-GB", { timeZone: orgTimeZone })
          : undefined),
      scheduledDeliveryTime:
        args.scheduledDeliveryTime ||
        args.scheduledPickupTime ||
        (args.orderType === "ScheduledDelivery" || args.orderType === "ScheduledPickup"
          ? new Date(now).toLocaleTimeString("en-US", { timeZone: orgTimeZone, hour: "numeric", minute: "2-digit", hour12: true })
          : undefined),
      totalAmount,
      paymentMode: args.paymentMode ?? "Cash",
      paymentStatus: resolvedPaymentStatus,
      specialNotes: args.specialNotes,
      taxInfoSnapshot,
      createdAt: now,
      updatedAt: now,
    });

    // 7. Insert Order Line Items
    for (const line of lineItemConfigs) {
      const stationId = await resolveOrderItemStation(
        ctx,
        args.organizationId,
        line.itemId
      );

      await ctx.db.insert("orderItems", {
        organizationId: args.organizationId,
        orderId,
        itemId: line.itemId,
        itemName: line.itemName,
        itemPrice: line.itemPrice,
        quantity: line.quantity,
        totalPrice: line.totalPrice,
        customizations: line.customizations,
        prepPreferences: line.prepPreferences,
        chefPrepPreferences: line.chefPrepPreferences,
        isReady: false,
        isToGo: line.isToGo ?? false,
        stationId,
        createdAt: now,
      });
    }

    // 8. Log Initial Activity Entry
    await recordOrderActivity(ctx, {
      organizationId: args.organizationId,
      orderId,
      processId: initialStatus?._id,
      processName: initialStatus?.name ?? "Accepted",
      position: 1,
      now,
    });

    // 8.5 Record Initial Order Credit Payment Entry (if settled)
    if (resolvedPaymentStatus === "Paid") {
      await ctx.db.insert("orderPayments", {
        organizationId: args.organizationId,
        orderId,
        paymentModeName: args.paymentMode ?? "Cash",
        paymentType: "Credit",
        amount: totalAmount,
        payAmount: totalAmount,
        refundAmount: 0,
        createdAt: now,
      });
    }

    // 8.6 Auto-sync customer to organizationUsers (matching defx-pos v1 set_order_user)
    if (args.customerPhone || args.customerName) {
      const cleanPhone = args.customerPhone?.replace(/\D/g, "");
      const existingUsers = await ctx.db
        .query("organizationUsers")
        .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
        .collect();

      const existingCust = existingUsers.find((u) => {
        if (!cleanPhone || !u.phone) return false;
        const uDigits = u.phone.replace(/\D/g, "");
        return uDigits.endsWith(cleanPhone) || cleanPhone.endsWith(uDigits);
      });

      if (existingCust) {
        // Update customer profile details
        await ctx.db.patch(existingCust._id, {
          firstName: existingCust.firstName || args.customerName?.split(" ")[0],
          lastName: existingCust.lastName || args.customerName?.split(" ").slice(1).join(" ") || undefined,
          email: args.customerEmail || existingCust.email,
          updatedAt: now,
        });
      } else if (cleanPhone && cleanPhone.length >= 4) {
        // Insert new customer record
        const nameParts = (args.customerName || "Customer").trim().split(" ");
        const firstName = nameParts[0] || "Customer";
        const lastName = nameParts.slice(1).join(" ") || undefined;
        await ctx.db.insert("organizationUsers", {
          organizationId: args.organizationId,
          userId: "cust_" + now + "_" + Math.random().toString(36).slice(2, 7),
          firstName,
          lastName,
          phone: args.customerPhone,
          email: args.customerEmail,
          userType: ["customer"],
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // 9. Dine-In Table Locking & Postpaid Request Linking
    if (reqTableId) {
      const table = await ctx.db.get(reqTableId);
      if (table) {
        await ctx.db.patch(reqTableId, {
          currentOrderId: orderId,
          isRequested: false,
          updatedAt: now,
        });
      }

      // Link orderId to active approved postpaid request for this table
      const activePostpaidReqs = await ctx.db
        .query("postpaidOrderRequests")
        .withIndex("by_table_and_status", (q) =>
          q.eq("tableId", reqTableId).eq("status", "approved")
        )
        .collect();

      for (const req of activePostpaidReqs) {
        if (req.deletedAt === undefined) {
          await ctx.db.patch(req._id, {
            orderId,
            updatedAt: now,
          });
        }
      }
    }

    return {
      orderId,
      orderNumber,
      tokenNumber,
      totalAmount: (totalAmount / 100).toFixed(2),
    };
  },
});

// ==========================================
// 2. LIVE REALTIME ORDERS SUBSCRIPTION QUERY
// ==========================================

export const listLiveOrders = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const activeOrders = await ctx.db
      .query("orders")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("isCompleted"), false))
      .collect();

    const sortedOrders = activeOrders.sort((a, b) => b.createdAt - a.createdAt);

    const result: Array<any> = [];
    for (const order of sortedOrders) {
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      const activities = await ctx.db
        .query("orderActivities")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      let tableInfo: any = null;
      if (order.tableId) {
        tableInfo = await ctx.db.get(order.tableId);
      }

      result.push({
        ...order,
        display_sub_total: (order.subTotal / 100).toFixed(2),
        display_tax_total: (order.taxTotal / 100).toFixed(2),
        display_discount_amount: order.discountAmount ? (order.discountAmount / 100).toFixed(2) : "0.00",
        display_total_amount: (order.totalAmount / 100).toFixed(2),
        items: items.map((i) => ({
          ...i,
          display_item_price: (i.itemPrice / 100).toFixed(2),
          display_total_price: (i.totalPrice / 100).toFixed(2),
        })),
        activities: activities.sort((a, b) => a.position - b.position),
        table: tableInfo ? { id: tableInfo._id, number: tableInfo.tableNumber } : null,
        waiter: await resolveWaiterInfo(ctx, order.waiterUserId),
      });
    }

    return result;
  },
});

export const getOrderDetails = query({
  args: { id: v.union(v.id("orders"), v.string()) },
  handler: async (ctx, args) => {
    let order = null;
    const normalizedId = ctx.db.normalizeId("orders", args.id);
    if (normalizedId) {
      order = await ctx.db.get(normalizedId);
    }
    if (!order) {
      order = await ctx.db
        .query("orders")
        .filter((q) => q.eq(q.field("orderNumber"), args.id))
        .first();
    }
    if (!order) return null;

    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();

    const activities = await ctx.db
      .query("orderActivities")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();

    let tableInfo: any = null;
    if (order.tableId) {
      tableInfo = await ctx.db.get(order.tableId);
    }

    const payments = await ctx.db
      .query("orderPayments")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();

    let totalCredit = 0;
    let totalDebit = 0;
    for (const p of payments) {
      if (p.paymentType === "Debit") {
        totalDebit += p.refundAmount || p.amount || 0;
      } else {
        totalCredit += p.payAmount || p.amount || 0;
      }
    }
    const netPaid = totalCredit - totalDebit;
    const remainingDue = Math.max(0, order.totalAmount - netPaid);
    const refundableAmount = Math.max(0, totalCredit - totalDebit);

    let effectivePaymentStatus = order.paymentStatus;
    let effectiveOrderStatusName = order.orderStatusName;

    if (payments.length > 0) {
      if (netPaid >= order.totalAmount) {
        effectivePaymentStatus = "Paid";
        if (effectiveOrderStatusName === "Cancelled / Refunded") {
          effectiveOrderStatusName = "Accepted";
        }
      } else if (netPaid <= 0 && totalCredit > 0 && totalDebit >= totalCredit) {
        effectivePaymentStatus = "Refunded";
        effectiveOrderStatusName = "Cancelled / Refunded";
      } else if (totalDebit > 0 && netPaid > 0 && netPaid < order.totalAmount) {
        effectivePaymentStatus = "Partially Refunded";
      } else if (netPaid > 0 && netPaid < order.totalAmount) {
        effectivePaymentStatus = "Pending";
      }
    }

    // Look up active survey attempt if any exists
    let surveyQrUrl: string | null = null;
    const activeSurvey = await ctx.db
      .query("surveys")
      .withIndex("by_active", (q) => q.eq("active", true))
      .first();

    if (activeSurvey) {
      const attempt = await ctx.db
        .query("surveyAttempts")
        .withIndex("by_order_survey", (q) =>
          q.eq("orderId", order._id).eq("surveyId", activeSurvey._id)
        )
        .first();

      if (attempt) {
        const baseUrl =
          process.env.FRONTEND_URL ||
          process.env.PUBLIC_URL ||
          "";
        surveyQrUrl = baseUrl
          ? `${baseUrl.replace(/\/$/, "")}/attempts/${attempt._id}`
          : `/attempts/${attempt._id}`;
      }
    }

    return {
      ...order,
      paymentStatus: effectivePaymentStatus,
      orderStatusName: effectiveOrderStatusName,
      surveyQrUrl,
      totalCredit,
      totalDebit,
      netPaid,
      remainingDue,
      refundableAmount,
      display_sub_total: (order.subTotal / 100).toFixed(2),
      display_tax_total: (order.taxTotal / 100).toFixed(2),
      display_discount_amount: order.discountAmount ? (order.discountAmount / 100).toFixed(2) : "0.00",
      display_total_amount: (order.totalAmount / 100).toFixed(2),
      display_credit_amount: (totalCredit / 100).toFixed(2),
      display_debit_amount: (totalDebit / 100).toFixed(2),
      display_net_paid: (netPaid / 100).toFixed(2),
      display_remaining_due: (remainingDue / 100).toFixed(2),
      display_refundable_amount: (refundableAmount / 100).toFixed(2),
      items: items.map((i) => ({
        ...i,
        display_item_price: (i.itemPrice / 100).toFixed(2),
        display_total_price: (i.totalPrice / 100).toFixed(2),
      })),
      activities: activities.sort((a, b) => a.position - b.position),
      payments,
      table: tableInfo ? { id: tableInfo._id, number: tableInfo.tableNumber } : null,
      waiter: await resolveWaiterInfo(ctx, order.waiterUserId),
    };
  },
});

// ==========================================
// 2.5 AUTHENTICATED CUSTOMER ORDERS QUERY
// ==========================================

export const listCustomerOrders = query({
  args: {
    organizationId: v.id("organizations"),
    orderIds: v.optional(v.array(v.string())),
    placedOrderIds: v.optional(v.array(v.string())),
    customerPhone: v.optional(v.string()),
    tableId: v.optional(v.union(v.id("organizationTables"), v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const sessionOrderIds = args.orderIds || args.placedOrderIds || [];
    const placedSet = new Set(sessionOrderIds);

    if (!identity && placedSet.size === 0) {
      return [];
    }

    const clerkUserId = identity?.subject;
    const userEmail = identity?.email?.toLowerCase().trim();
    const rawPhone = ((identity?.phoneNumber || (identity as any)?.phone || "") as string).trim();
    const cleanPhoneDigits = rawPhone.replace(/\D/g, "");

    // Collect allowed email and phone identifiers for this user
    const allowedEmails = new Set<string>();
    if (userEmail) allowedEmails.add(userEmail);

    const allowedPhoneDigits = new Set<string>();
    if (cleanPhoneDigits && cleanPhoneDigits.length >= 7) {
      allowedPhoneDigits.add(cleanPhoneDigits.slice(-10));
    }

    if (clerkUserId) {
      const userOrgRecords = await ctx.db
        .query("organizationUsers")
        .withIndex("by_user_and_org", (q) =>
          q.eq("userId", clerkUserId).eq("organizationId", args.organizationId)
        )
        .collect();

      for (const u of userOrgRecords) {
        if (u.deletedAt !== undefined) continue;
        if (u.email) allowedEmails.add(u.email.toLowerCase().trim());
        if (u.phone) {
          const uDig = u.phone.replace(/\D/g, "");
          if (uDig.length >= 7) {
            allowedPhoneDigits.add(uDig.slice(-10));
          }
        }
      }
    }

    // Query orders for this store
    const orgOrders = await ctx.db
      .query("orders")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    // Strictly filter to orders belonging to this authenticated customer or placed in session
    const filteredOrders = orgOrders.filter((order) => {
      // Placed in current browser session
      if (placedSet.has(order._id) || placedSet.has(order.orderNumber)) {
        return true;
      }

      if (order.customerEmail) {
        const oEmail = order.customerEmail.toLowerCase().trim();
        if (allowedEmails.has(oEmail)) return true;
      }

      if (order.customerPhone) {
        const oDigits = order.customerPhone.replace(/\D/g, "");
        if (oDigits.length >= 7) {
          const oLast10 = oDigits.slice(-10);
          if (allowedPhoneDigits.has(oLast10)) return true;
        }
      }

      return false;
    });

    const sorted = filteredOrders.sort((a, b) => b.createdAt - a.createdAt);

    const enrichedOrders: Array<any> = [];
    for (const order of sorted) {
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      const activities = await ctx.db
        .query("orderActivities")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      let tableInfo: any = null;
      if (order.tableId) {
        tableInfo = await ctx.db.get(order.tableId);
      }

      enrichedOrders.push({
        ...order,
        display_sub_total: (order.subTotal / 100).toFixed(2),
        display_tax_total: (order.taxTotal / 100).toFixed(2),
        display_discount_amount: order.discountAmount ? (order.discountAmount / 100).toFixed(2) : "0.00",
        display_total_amount: (order.totalAmount / 100).toFixed(2),
        items: items.map((i) => ({
          ...i,
          display_item_price: (i.itemPrice / 100).toFixed(2),
          display_total_price: (i.totalPrice / 100).toFixed(2),
        })),
        activities: activities.sort((a, b) => a.position - b.position),
        table: tableInfo ? { id: tableInfo._id, number: tableInfo.tableNumber } : null,
      });
    }

    return enrichedOrders;
  },
});

export const getCustomerStats = query({
  args: {
    organizationId: v.id("organizations"),
    phone: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.phone || !args.phone.trim() || args.phone.trim().replace(/\D/g, "").length < 10) {
      return {
        dineInCount: 0,
        takeawayCount: 0,
        totalSpends: 0,
        recentOrders: [],
      };
    }

    const cleanP = args.phone.trim().replace(/\D/g, "");
    const allOrders = await ctx.db
      .query("orders")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const customerOrders = allOrders.filter((o) => {
      if (!o.customerPhone) return false;
      const oClean = o.customerPhone.replace(/\D/g, "");
      return oClean.endsWith(cleanP) || cleanP.endsWith(oClean);
    });

    const dineInCount = customerOrders.filter((o) => o.orderType === "DineIn").length;
    const takeawayCount = customerOrders.filter((o) => o.orderType === "TakeAway" || o.orderType === "ScheduledPickup").length;
    const totalSpends = customerOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const sortedOrders = customerOrders.sort((a, b) => b.createdAt - a.createdAt);
    const recentOrders: Array<{
      _id: any;
      orderNumber: string;
      createdAt: number;
      totalAmount: number;
      orderType: string;
      scheduledDeliveryDate?: string;
      scheduledDeliveryTime?: string;
      paymentStatus?: string;
      orderStatusName?: string;
      isCompleted?: boolean;
      itemsSummary: string;
      items: Array<{ itemName: string; quantity: number }>;
    }> = [];

    // Return recent orders with item details
    for (const ord of sortedOrders.slice(0, 15)) {
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", ord._id))
        .collect();
      const itemsSummary = items.length > 0
        ? items.map((it) => `${it.quantity} x ${it.itemName}`).join(", ")
        : "Standard order items";

      recentOrders.push({
        _id: ord._id,
        orderNumber: ord.orderNumber,
        createdAt: ord.createdAt,
        totalAmount: ord.totalAmount,
        orderType: ord.orderType,
        scheduledDeliveryDate: ord.scheduledDeliveryDate,
        scheduledDeliveryTime: ord.scheduledDeliveryTime,
        paymentStatus: ord.paymentStatus,
        orderStatusName: ord.orderStatusName,
        isCompleted: ord.isCompleted,
        itemsSummary,
        items: items.map((it) => ({ itemName: it.itemName, quantity: it.quantity })),
      });
    }

    return {
      dineInCount,
      takeawayCount,
      totalSpends,
      recentOrders,
    };
  },
});

/**
 * Cascading cleanup helper: deletes all survey attempts and answers associated with an order.
 */
export async function deleteOrderSurveys(
  ctx: MutationCtx,
  orderId: Id<"orders">
) {
  const attempts = await ctx.db
    .query("surveyAttempts")
    .withIndex("by_order_id", (q) => q.eq("orderId", orderId))
    .collect();

  for (const attempt of attempts) {
    const answers = await ctx.db
      .query("surveyAnswers")
      .withIndex("by_attempt_id", (q) => q.eq("attemptId", attempt._id))
      .collect();

    for (const a of answers) {
      await ctx.db.delete(a._id);
    }
    await ctx.db.delete(attempt._id);
  }
}

// ==========================================
// 3. ORDER STATUS ADVANCEMENT & KDS MUTATIONS
// ==========================================

export const updateOrderStatus = mutation({
  args: {
    orderId: v.id("orders"),
    processId: v.id("organizationOrderProcesses"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    const process = await ctx.db.get(args.processId);
    if (!process) throw new Error("Order process step not found");

    const now = Date.now();

    // Appends entry in orderActivities with duration calculation
    await recordOrderActivity(ctx, {
      organizationId: order.organizationId,
      orderId: order._id,
      processId: process._id,
      processName: process.name,
      now,
    });

    await ctx.db.patch(order._id, {
      orderStatusId: process._id,
      orderStatusName: process.name,
      updatedAt: now,
    });

    // 4. Resolve process notifications if order status actually transitioned and not suppressed
    let notifications: any[] = [];
    try {
      if (!order.isModify) {
        notifications = await resolveNotificationsForOrderStatus(
          ctx,
          { ...order, orderStatusId: process._id, orderStatusName: process.name },
          process._id
        );
      }
    } catch (err) {
      console.error("Failed to resolve process notifications:", err);
    }

    return { success: true, statusName: process.name, notifications };
  },
});

export const toggleOrderItemReady = mutation({
  args: {
    orderItemId: v.id("orderItems"),
    isReady: v.boolean(),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.orderItemId);
    if (!item) throw new Error("Order item not found");

    await ctx.db.patch(args.orderItemId, {
      isReady: args.isReady,
    });

    return { success: true };
  },
});

// ==========================================
// 4. ORDER COMPLETION & INVENTORY DESTRUCTION HOOK
// ==========================================

export const completeOrder = mutation({
  args: {
    orderId: v.id("orders"),
    paymentModeId: v.optional(v.id("paymentModes")),
    paymentMode: v.optional(v.string()),
    transactionReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    const now = Date.now();

    // 0. Validate Payment Mode Availability
    if (args.paymentModeId || args.paymentMode) {
      await validateActivePaymentMode(ctx, order.organizationId, {
        paymentModeId: args.paymentModeId,
        paymentModeName: args.paymentMode,
      });
    }

    // 2. Record Payment Log
    let payModeName = args.paymentMode || order.paymentMode;
    if (args.paymentModeId) {
      const pm = await ctx.db.get(args.paymentModeId);
      if (pm) payModeName = pm.name;
    }

    // 1. Mark Order Completed & Paid
    await ctx.db.patch(order._id, {
      isCompleted: true,
      paymentStatus: "Paid",
      ...(payModeName ? { paymentMode: payModeName } : {}),
      updatedAt: now,
    });

    await ctx.db.insert("orderPayments", {
      organizationId: order.organizationId,
      orderId: order._id,
      paymentModeId: args.paymentModeId,
      paymentModeName: payModeName,
      amount: order.totalAmount,
      transactionReference: args.transactionReference,
      createdAt: now,
    });

    // Close any open order activities on completion
    const openActivities = await ctx.db
      .query("orderActivities")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    for (const act of openActivities) {
      if (act.completedAt === undefined && act.deletedAt === undefined) {
        await ctx.db.patch(act._id, { completedAt: now, updatedAt: now });
      }
    }

    // 3. Clear Dine-In Table Occupancy & Complete Postpaid Order Request
    const orderTableId = order.tableId;
    if (orderTableId) {
      const postpaidByOrder = await ctx.db
        .query("postpaidOrderRequests")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      const toComplete =
        postpaidByOrder.length > 0
          ? postpaidByOrder
          : await ctx.db
            .query("postpaidOrderRequests")
            .withIndex("by_table_and_status", (q) =>
              q.eq("tableId", orderTableId).eq("status", "approved")
            )
            .collect();

      for (const req of toComplete) {
        if (
          req.deletedAt === undefined &&
          (req.status === "approved" || req.status === "requested")
        ) {
          await ctx.db.patch(req._id, {
            status: "completed",
            updatedAt: now,
          });
        }
      }

      const table = await ctx.db.get(orderTableId);
      if (table && table.currentOrderId === order._id.toString()) {
        await ctx.db.patch(orderTableId, {
          currentOrderId: undefined,
          isRequested: false,
          updatedAt: now,
        });
      }
    }

    // 4. AUTOMATIC INVENTORY STOCK DEDUCTION HOOK
    const orderItems = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();

    for (const orderItem of orderItems) {
      // 4a. Deduct stock for base menu item recipes
      const itemRecipes = await ctx.db
        .query("recipes")
        .withIndex("by_item", (q) => q.eq("itemId", orderItem.itemId))
        .collect();

      for (const recipe of itemRecipes) {
        const invItem = await ctx.db.get(recipe.inventoryItemId);
        if (invItem) {
          const consumedQty = recipe.quantity * orderItem.quantity;
          const newStock = Math.max(0, invItem.availableStock - consumedQty);

          await ctx.db.insert("inventoryItemStocks", {
            organizationId: order.organizationId,
            inventoryItemId: invItem._id,
            stockType: "debit",
            quantity: consumedQty,
            unit: recipe.unit,
            sourceType: "OrderSale",
            orderId: order._id,
            createdAt: now,
          });

          await ctx.db.patch(invItem._id, {
            availableStock: newStock,
            updatedAt: now,
          });
        }
      }

      // 4b. Deduct stock for customization option recipes
      if (orderItem.customizations) {
        for (const cust of orderItem.customizations) {
          const custRecipes = await ctx.db
            .query("recipes")
            .withIndex("by_customization", (q) => q.eq("customizationItemId", cust.optionId))
            .collect();

          for (const recipe of custRecipes) {
            const invItem = await ctx.db.get(recipe.inventoryItemId);
            if (invItem) {
              const consumedQty = recipe.quantity * orderItem.quantity;
              const newStock = Math.max(0, invItem.availableStock - consumedQty);

              await ctx.db.insert("inventoryItemStocks", {
                organizationId: order.organizationId,
                inventoryItemId: invItem._id,
                stockType: "debit",
                quantity: consumedQty,
                unit: recipe.unit,
                sourceType: "OrderSale",
                orderId: order._id,
                createdAt: now,
              });

              await ctx.db.patch(invItem._id, {
                availableStock: newStock,
                updatedAt: now,
              });
            }
          }
        }
      }
    }

    // 5. Automated Provider Payment Transfer Hook (Fail-safe marketplace payout routing)
    await handleOrderCompletionTransfer(ctx, order._id);

    return {
      success: true,
      orderId: order._id,
      orderNumber: order.orderNumber,
      isCompleted: true,
    };
  },
});

// ==========================================
// 5. LIST ORDERS WITH SEARCH & FILTERING
// ==========================================

export const listOrders = query({
  args: {
    organizationId: v.id("organizations"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    search: v.optional(v.string()),
    orderStatusId: v.optional(v.id("organizationOrderProcesses")),
    stage: v.optional(v.string()),
    orderType: v.optional(
      v.union(
        v.literal("DineIn"),
        v.literal("TakeAway"),
        v.literal("Delivery"),
        v.literal("ScheduledPickup"),
        v.literal("ScheduledDelivery")
      )
    ),
    paymentStatus: v.optional(
      v.union(
        v.literal("Pending"),
        v.literal("Paid"),
        v.literal("Failed"),
        v.literal("Refunded"),
        v.literal("Partially Refunded")
      )
    ),
    minPrice: v.optional(v.number()),
    maxPrice: v.optional(v.number()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let ordersQuery = ctx.db
      .query("orders")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId));

    const allOrders = await ordersQuery.collect();

    // Base filtered orders (matching date, price, search, orderType, paymentStatus) for status counts & metrics
    const baseFiltered = allOrders.filter((order) => {
      if (args.startDate && order.createdAt < args.startDate) return false;
      if (args.endDate && order.createdAt > args.endDate) return false;
      if (args.orderType && order.orderType !== args.orderType) return false;
      if (args.paymentStatus && order.paymentStatus !== args.paymentStatus) return false;
      if (args.minPrice !== undefined && order.totalAmount < args.minPrice) return false;
      if (args.maxPrice !== undefined && order.totalAmount > args.maxPrice) return false;

      if (args.search) {
        const queryLower = args.search.toLowerCase().trim();
        const matchesOrderNumber = order.orderNumber.toLowerCase().includes(queryLower);
        const matchesToken = order.tokenNumber.toLowerCase().includes(queryLower);
        const matchesName = order.customerName ? order.customerName.toLowerCase().includes(queryLower) : false;
        const matchesPhone = order.customerPhone ? order.customerPhone.includes(queryLower) : false;
        if (!matchesOrderNumber && !matchesToken && !matchesName && !matchesPhone) {
          return false;
        }
      }

      return true;
    });

    const totalGrossAmount = baseFiltered.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

    const statusCounts: Record<string, number> = { All: baseFiltered.length };
    for (const order of baseFiltered) {
      const statusName = order.orderStatusName || "Accepted";
      statusCounts[statusName] = (statusCounts[statusName] || 0) + 1;
    }

    // Apply stage / orderStatusId filter for the paginated table list
    const filtered = baseFiltered.filter((order) => {
      if (args.orderStatusId && order.orderStatusId !== args.orderStatusId) return false;
      if (args.stage && args.stage !== "All") {
        const name = (order.orderStatusName || "").toLowerCase();
        const target = args.stage.toLowerCase();
        if (target === "cancelled" || target === "reject") {
          return order.isRejected === true || name.includes("cancel") || name.includes("reject");
        }
        if (target === "completed" || target === "delivered") {
          return order.isCompleted === true || name.includes("deliver") || name.includes("complete");
        }
        return name.includes(target) || target.includes(name);
      }
      return true;
    });

    const sorted = filtered.sort((a, b) => b.createdAt - a.createdAt);
    const totalCount = sorted.length;
    const page = args.page ?? 1;
    const pageSize = args.pageSize ?? 15;
    const startIndex = (page - 1) * pageSize;
    const paginatedOrders = sorted.slice(startIndex, startIndex + pageSize);

    const enrichedOrders: Array<any> = [];
    for (const order of paginatedOrders) {
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      const payments = await ctx.db
        .query("orderPayments")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      let tableInfo: any = null;
      if (order.tableId) {
        tableInfo = await ctx.db.get(order.tableId);
      }

      enrichedOrders.push({
        ...order,
        display_sub_total: (order.subTotal / 100).toFixed(2),
        display_tax_total: (order.taxTotal / 100).toFixed(2),
        display_discount_amount: order.discountAmount ? (order.discountAmount / 100).toFixed(2) : "0.00",
        display_total_amount: (order.totalAmount / 100).toFixed(2),
        item_count: items.length,
        items: items.map((i) => ({
          ...i,
          display_item_price: (i.itemPrice / 100).toFixed(2),
          display_total_price: (i.totalPrice / 100).toFixed(2),
        })),
        payments,
        table: tableInfo ? { id: tableInfo._id, number: tableInfo.tableNumber } : null,
        waiter: await resolveWaiterInfo(ctx, order.waiterUserId),
      });
    }

    return {
      orders: enrichedOrders,
      totalCount,
      totalGrossAmount,
      statusCounts,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  },
});

// ==========================================
// 6. RECORD PAYMENT OR ISSUE REFUND
// ==========================================

export const addOrderPayment = mutation({
  args: {
    orderId: v.id("orders"),
    paymentModeId: v.optional(v.union(v.id("paymentModes"), v.string())),
    paymentModeName: v.string(),
    paymentType: v.union(v.literal("Credit"), v.literal("Debit")),
    amount: v.number(), // in minor units
    transactionReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    const now = Date.now();
    const paymentModeId = args.paymentModeId ? ctx.db.normalizeId("paymentModes", args.paymentModeId) : undefined;

    // 0. Validate Payment Mode Availability for payment settlement tenders
    if (args.paymentType === "Credit") {
      await validateActivePaymentMode(ctx, order.organizationId, {
        paymentModeId: paymentModeId ?? undefined,
        paymentModeName: args.paymentModeName,
      });
    }

    // 1. Insert transaction into orderPayments
    await ctx.db.insert("orderPayments", {
      organizationId: order.organizationId,
      orderId: order._id,
      paymentModeId: paymentModeId ?? undefined,
      paymentModeName: args.paymentModeName,
      paymentType: args.paymentType,
      amount: args.amount,
      payAmount: args.paymentType === "Credit" ? args.amount : 0,
      refundAmount: args.paymentType === "Debit" ? args.amount : 0,
      transactionReference: args.transactionReference,
      createdAt: now,
    });

    // 2. Compute net paid vs total
    const allPayments = await ctx.db
      .query("orderPayments")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();

    let totalCredit = 0;
    let totalDebit = 0;
    for (const p of allPayments) {
      if (p.paymentType === "Debit") {
        totalDebit += p.amount;
      } else {
        totalCredit += p.amount;
      }
    }

    const netPaid = totalCredit - totalDebit;
    let nextPaymentStatus: "Paid" | "Pending" | "Failed" | "Refunded" | "Partially Refunded" = "Pending";
    let nextOrderStatusName = order.orderStatusName;
    let isCompleted = order.isCompleted;
    let isRejected = order.isRejected;

    if (netPaid >= order.totalAmount) {
      nextPaymentStatus = "Paid";
      isCompleted = true;
      isRejected = false;
      if (nextOrderStatusName === "Cancelled / Refunded") {
        nextOrderStatusName = "Accepted";
      }
    } else if (netPaid <= 0 && totalCredit > 0 && totalDebit >= totalCredit) {
      nextPaymentStatus = "Refunded";
      nextOrderStatusName = "Cancelled / Refunded";
      isCompleted = false;
      isRejected = true;
    } else if (totalDebit > 0 && netPaid > 0 && netPaid < order.totalAmount) {
      nextPaymentStatus = "Partially Refunded";
      isCompleted = false;
    } else {
      nextPaymentStatus = "Pending";
      isCompleted = false;
    }

    await ctx.db.patch(order._id, {
      paymentStatus: nextPaymentStatus,
      orderStatusName: nextOrderStatusName,
      isCompleted,
      isRejected,
      paymentMode: args.paymentModeName,
      updatedAt: now,
    });

    return {
      success: true,
      netPaid: (netPaid / 100).toFixed(2),
      paymentStatus: nextPaymentStatus,
    };
  },
});

// ==========================================
// 7. UPDATE CUSTOMER INFO ON ORDER
// ==========================================

export const updateOrderCustomer = mutation({
  args: {
    orderId: v.id("orders"),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    deliveryAddress: v.optional(
      v.object({
        addressLine1: v.string(),
        addressLine2: v.optional(v.string()),
        landmark: v.optional(v.string()),
        city: v.optional(v.string()),
        zipCode: v.optional(v.string()),
        addressType: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    const patch: any = { updatedAt: Date.now() };
    if (args.customerName !== undefined) patch.customerName = args.customerName;
    if (args.customerPhone !== undefined) patch.customerPhone = args.customerPhone;
    if (args.customerEmail !== undefined) patch.customerEmail = args.customerEmail;
    if (args.deliveryAddress !== undefined) patch.deliveryAddress = args.deliveryAddress;

    await ctx.db.patch(order._id, patch);

    return { success: true };
  },
});

// ==========================================
// 8. VOID / DELETE MULTIPLE ORDER ITEMS
// ==========================================

export const deleteMultipleOrderItems = mutation({
  args: {
    orderId: v.id("orders"),
    orderItemIds: v.array(v.id("orderItems")),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    const now = Date.now();

    // 1. Delete selected items
    for (const itemId of args.orderItemIds) {
      await ctx.db.delete(itemId);
    }

    // 2. Fetch remaining items & recalculate
    const remainingItems = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();

    let newRawSubTotal = 0;
    for (const item of remainingItems) {
      newRawSubTotal += item.totalPrice;
    }

    const subTotal = Math.round(newRawSubTotal);
    // Recalculate tax proportionally
    const taxRatio = order.subTotal > 0 ? order.taxTotal / order.subTotal : 0;
    const taxTotal = Math.round(subTotal * taxRatio);
    const discount = order.discountAmount ?? 0;
    const delivery = order.deliveryCharge ?? 0;

    const totalAmount = Math.max(0, subTotal + taxTotal - discount + delivery);

    await ctx.db.patch(order._id, {
      subTotal,
      taxTotal,
      totalAmount,
      isModify: true,
      updatedAt: now,
    });

    // Log modification activity
    await recordOrderActivity(ctx, {
      organizationId: order.organizationId,
      orderId: order._id,
      processName: `Removed ${args.orderItemIds.length} item(s)`,
      position: 50,
      now,
    });

    return {
      success: true,
      remainingItemCount: remainingItems.length,
      newTotal: (totalAmount / 100).toFixed(2),
    };
  },
});

// ==========================================
// 9. CANCEL / DELETE ORDER
// ==========================================

export const cancelOrder = mutation({
  args: {
    orderId: v.id("orders"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    const now = Date.now();

    await ctx.db.patch(order._id, {
      isRejected: true,
      orderStatusName: "Cancelled",
      specialNotes: args.reason ? `Cancellation Reason: ${args.reason}` : order.specialNotes,
      updatedAt: now,
    });

    // Release table if Dine-In
    if (order.tableId) {
      const table = await ctx.db.get(order.tableId);
      if (table && table.currentOrderId === order._id.toString()) {
        await ctx.db.patch(order.tableId, {
          currentOrderId: undefined,
          updatedAt: now,
        });
      }
    }

    // Log cancellation activity
    await recordOrderActivity(ctx, {
      organizationId: order.organizationId,
      orderId: order._id,
      processName: "Cancelled",
      position: 99,
      now,
    });

    return { success: true };
  },
});

// ==========================================
// 10. SEED SAMPLE / TEMPORARY ORDERS

// ==========================================
// 11. CAPTAIN ORDER MANAGEMENT MUTATIONS
// ==========================================

/**
 * Appends new items (KOT #2, KOT #3...) to an ongoing Dine-In order
 */
export const addItemsToExistingOrder = mutation({
  args: {
    orderId: v.id("orders"),
    items: v.array(
      v.object({
        itemId: v.id("items"),
        quantity: v.number(),
        isToGo: v.optional(v.boolean()),
        customizations: v.optional(
          v.array(
            v.object({
              customizationId: v.id("customizations"),
              optionId: v.id("customizationItems"),
            })
          )
        ),
        prepPreferences: v.optional(
          v.array(
            v.union(
              v.string(),
              v.object({
                preferenceId: v.optional(v.id("chefPrepPreferences")),
                name: v.string(),
              })
            )
          )
        ),
        chefPrepPreferences: v.optional(
          v.array(
            v.union(
              v.string(),
              v.object({
                preferenceId: v.optional(v.id("chefPrepPreferences")),
                name: v.string(),
              })
            )
          )
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    if (order.isCompleted || order.isRejected) {
      throw new Error("Cannot add items to a completed or cancelled order");
    }

    const now = Date.now();
    let additionalSubTotal = 0;
    const lineItemConfigs: Array<any> = [];

    for (const inputItem of args.items) {
      const dbItem = await ctx.db.get(inputItem.itemId);
      if (!dbItem) throw new Error("Item not found");

      let itemUnitPrice = dbItem.price;
      const resolvedCustomizations: Array<any> = [];

      if (inputItem.customizations) {
        for (const custInput of inputItem.customizations) {
          const custGroup = await ctx.db.get(custInput.customizationId);
          const custOption = await ctx.db.get(custInput.optionId);
          if (custGroup && custOption && custOption.deletedAt === undefined) {
            itemUnitPrice += custOption.price;
            resolvedCustomizations.push({
              customizationId: custGroup._id,
              customizationName: custGroup.name,
              optionId: custOption._id,
              optionName: custOption.name,
              price: custOption.price,
            });
          }
        }
      }

      // Resolve Chef Prep Preferences
      const rawPrepPrefs = (inputItem as any).prepPreferences || (inputItem as any).chefPrepPreferences || [];
      const resolvedPrepPreferences: Array<{ preferenceId?: Id<"chefPrepPreferences">; name: string }> = [];
      for (const pref of rawPrepPrefs) {
        if (typeof pref === "string" && pref.trim()) {
          resolvedPrepPreferences.push({ name: pref.trim() });
        } else if (pref && typeof pref === "object" && pref.name) {
          resolvedPrepPreferences.push({
            preferenceId: pref.preferenceId,
            name: pref.name.trim(),
          });
        }
      }

      const itemLineTotal = itemUnitPrice * inputItem.quantity;
      additionalSubTotal += itemLineTotal;

      lineItemConfigs.push({
        itemId: dbItem._id,
        itemName: dbItem.name,
        itemPrice: itemUnitPrice,
        quantity: inputItem.quantity,
        totalPrice: itemLineTotal,
        customizations: resolvedCustomizations,
        prepPreferences: resolvedPrepPreferences.length > 0 ? resolvedPrepPreferences : undefined,
        chefPrepPreferences: resolvedPrepPreferences.length > 0 ? resolvedPrepPreferences : undefined,
        isToGo: inputItem.isToGo ?? false,
      });
    }

    // 1. Insert new order items
    for (const line of lineItemConfigs) {
      const stationId = await resolveOrderItemStation(
        ctx,
        order.organizationId,
        line.itemId
      );

      await ctx.db.insert("orderItems", {
        organizationId: order.organizationId,
        orderId: order._id,
        itemId: line.itemId,
        itemName: line.itemName,
        itemPrice: line.itemPrice,
        quantity: line.quantity,
        totalPrice: line.totalPrice,
        customizations: line.customizations,
        prepPreferences: line.prepPreferences,
        chefPrepPreferences: line.chefPrepPreferences,
        isReady: false,
        isToGo: line.isToGo ?? false,
        stationId,
        createdAt: now,
      });
    }

    // 2. Fetch all order items and recalculate
    const allItems = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();

    let newSubTotal = 0;
    for (const it of allItems) {
      newSubTotal += it.totalPrice;
    }

    const taxRatio = order.subTotal > 0 ? order.taxTotal / order.subTotal : 0.05;
    const newTaxTotal = Math.round(newSubTotal * taxRatio);
    const discount = order.discountAmount ?? 0;
    const delivery = order.deliveryCharge ?? 0;
    const newTotalAmount = Math.max(0, newSubTotal + newTaxTotal - discount + delivery);

    await ctx.db.patch(order._id, {
      subTotal: newSubTotal,
      taxTotal: newTaxTotal,
      totalAmount: newTotalAmount,
      isModify: true,
      updatedAt: now,
    });

    // 3. Log modification activity
    await recordOrderActivity(ctx, {
      organizationId: order.organizationId,
      orderId: order._id,
      processName: `Added ${args.items.length} item(s) to table order`,
      now,
    });

    return {
      success: true,
      orderId: order._id,
      newTotalAmount: (newTotalAmount / 100).toFixed(2),
      itemCount: allItems.length,
    };
  },
});

/**
 * Updates item quantity on an open table order
 */
export const updateOrderItemQuantity = mutation({
  args: {
    orderItemId: v.id("orderItems"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const orderItem = await ctx.db.get(args.orderItemId);
    if (!orderItem) throw new Error("Order item not found");

    const order = await ctx.db.get(orderItem.orderId);
    if (!order) throw new Error("Associated order not found");
    if (order.isCompleted || order.isRejected) {
      throw new Error("Cannot modify a completed or cancelled order");
    }

    const now = Date.now();

    if (args.quantity <= 0) {
      await ctx.db.delete(args.orderItemId);
    } else {
      await ctx.db.patch(args.orderItemId, {
        quantity: args.quantity,
        totalPrice: orderItem.itemPrice * args.quantity,
      });
    }

    // Recalculate
    const remainingItems = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();

    let newSubTotal = 0;
    for (const it of remainingItems) {
      newSubTotal += it.totalPrice;
    }

    const taxRatio = order.subTotal > 0 ? order.taxTotal / order.subTotal : 0.05;
    const newTaxTotal = Math.round(newSubTotal * taxRatio);
    const discount = order.discountAmount ?? 0;
    const delivery = order.deliveryCharge ?? 0;
    const newTotalAmount = Math.max(0, newSubTotal + newTaxTotal - discount + delivery);

    await ctx.db.patch(order._id, {
      subTotal: newSubTotal,
      taxTotal: newTaxTotal,
      totalAmount: newTotalAmount,
      isModify: true,
      updatedAt: now,
    });

    return {
      success: true,
      newTotalAmount: (newTotalAmount / 100).toFixed(2),
      remainingItemCount: remainingItems.length,
    };
  },
});

/**
 * Transfers an active Dine-In order to another table
 */
export const moveOrderTable = mutation({
  args: {
    orderId: v.id("orders"),
    newTableId: v.id("organizationTables"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    const newTable = await ctx.db.get(args.newTableId);
    if (!newTable || newTable.deletedAt !== undefined) {
      throw new Error("Destination table not found");
    }

    if (
      newTable.currentOrderId &&
      newTable.currentOrderId !== order._id.toString()
    ) {
      throw new Error(`Table ${newTable.tableNumber} is already occupied by another order`);
    }

    const now = Date.now();

    // 1. Release old table if any
    if (order.tableId && order.tableId !== args.newTableId) {
      const oldTable = await ctx.db.get(order.tableId);
      if (oldTable && oldTable.currentOrderId === order._id.toString()) {
        await ctx.db.patch(order.tableId, {
          currentOrderId: undefined,
          isRequested: false,
          updatedAt: now,
        });
      }
    }

    // 2. Bind new table
    await ctx.db.patch(args.newTableId, {
      currentOrderId: order._id.toString(),
      isRequested: false,
      updatedAt: now,
    });

    // 3. Update order tableId
    await ctx.db.patch(order._id, {
      tableId: args.newTableId,
      updatedAt: now,
    });

    // 4. Log activity
    await recordOrderActivity(ctx, {
      organizationId: order.organizationId,
      orderId: order._id,
      processName: `Moved order to Table #${newTable.tableNumber}`,
      position: 60,
      now,
    });

    return {
      success: true,
      newTableNumber: newTable.tableNumber,
    };
  },
});



/**
 * Lists all activity transitions and duration metrics for an order.
 */
export const listOrderActivities = query({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      return [];
    }

    const activities = await ctx.db
      .query("orderActivities")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();

    return activities
      .filter((a) => a.deletedAt === undefined)
      .sort((a, b) => a.position - b.position || a.createdAt - b.createdAt);
  },
});



