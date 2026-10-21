import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireStaffMember } from "./stations";
import { recordOrderActivity } from "./orders";

// ==========================================
// WORKSTATION LIFECYCLE CONSTANTS & HELPERS
// ==========================================

export type WorkstationStatusKey = "ACCEPTED" | "IN_PROGRESS" | "READY" | "COMPLETED";

export function deriveWorkstationStatusKey(order: {
  isCompleted?: boolean;
  isRejected?: boolean;
  orderStatusName?: string;
  orderStatusId?: Id<"organizationOrderProcesses">;
}): WorkstationStatusKey {
  if (order.isCompleted) return "COMPLETED";
  const name = (order.orderStatusName || "").toLowerCase();
  if (name.includes("served") || name.includes("delivered") || name.includes("handed over") || name.includes("completed")) {
    return "COMPLETED";
  }
  if (name.includes("ready")) return "READY";
  if (name.includes("progress") || name.includes("prepar") || name.includes("cook") || name.includes("plating")) {
    return "IN_PROGRESS";
  }
  return "ACCEPTED";
}

function formatRelativeTime(timestamp: number, now: number): string {
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatClockTime(timestamp: number, timeZone = "Asia/Kolkata"): string {
  try {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }
}

// ==========================================
// 1. LIST WORKSTATION ORDERS (REACTIVE QUEUE)
// ==========================================

export const listWorkstationOrders = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    filter: v.optional(
      v.union(
        v.literal("all"),
        v.literal("dine-in"),
        v.literal("takeaway"),
        v.literal("delivery")
      )
    ),
    viewMode: v.optional(v.union(v.literal("active"), v.literal("completed"))),
  },
  handler: async (ctx, args) => {
    let org = null;
    if (args.organizationId) {
      org = await ctx.db.get(args.organizationId);
    } else {
      const orgs = await ctx.db.query("organizations").collect();
      org = orgs.find((o) => o.deletedAt === undefined) || null;
    }

    if (!org) {
      return {
        orders: [],
        counts: { all: 0, dineIn: 0, takeaway: 0, delivery: 0, completed: 0 },
        activeStation: null,
      };
    }

    const orgId = org._id;
    const timeZone = org.organizationTimeZone || "Asia/Kolkata";
    const now = Date.now();

    // Query orders for this organization
    const allOrgOrders = await ctx.db
      .query("orders")
      .withIndex("by_org", (q) => q.eq("organizationId", orgId))
      .order("desc")
      .collect();

    // Stations lookup map
    const stations = await ctx.db
      .query("stations")
      .withIndex("by_org", (q) => q.eq("organizationId", orgId))
      .collect();
    const activeStations = stations.filter((s) => s.deletedAt === undefined);
    const stationMap = new Map<string, string>();
    activeStations.forEach((st) => stationMap.set(st._id, st.name));

    const mainStation = activeStations.find((s) => s.isMain) || activeStations[0] || null;

    // Filter by active vs completed
    const viewMode = args.viewMode ?? "active";
    const activeFilter = args.filter ?? "all";

    let allActiveCount = 0;
    let dineInCount = 0;
    let takeawayCount = 0;
    let deliveryCount = 0;
    let completedCount = 0;

    // Pre-calculate counts across all orders
    for (const o of allOrgOrders) {
      if (o.isCompleted || o.isRejected) {
        completedCount++;
      } else {
        allActiveCount++;
        if (o.orderType === "DineIn") dineInCount++;
        else if (o.orderType === "TakeAway" || o.orderType === "ScheduledPickup") takeawayCount++;
        else if (o.orderType === "Delivery" || o.orderType === "ScheduledDelivery") deliveryCount++;
      }
    }

    // Select candidate orders based on viewMode
    const candidateOrders = allOrgOrders.filter((o) => {
      const isSettled = o.isCompleted || o.isRejected;
      if (viewMode === "active") return !isSettled;
      return isSettled;
    });

    // Apply type filter if specified
    const filteredOrders = candidateOrders.filter((o) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "dine-in") return o.orderType === "DineIn";
      if (activeFilter === "takeaway") return o.orderType === "TakeAway" || o.orderType === "ScheduledPickup";
      if (activeFilter === "delivery") return o.orderType === "Delivery" || o.orderType === "ScheduledDelivery";
      return true;
    });

    // Enrich each order with line items, destination, customer profile, and next action
    const enrichedOrders = await Promise.all(
      filteredOrders.map(async (order) => {
        // 1. Fetch Line Items
        const items = await ctx.db
          .query("orderItems")
          .withIndex("by_order", (q) => q.eq("orderId", order._id))
          .collect();

        let primaryStationName = mainStation?.name || "Front Prep Counter #01";
        const enrichedItems = items.map((item) => {
          const stName = item.stationId ? stationMap.get(item.stationId) : mainStation?.name;
          if (stName && primaryStationName === "Front Prep Counter #01") {
            primaryStationName = stName;
          }

          // Build specs string
          const specs: string[] = [];
          if (item.prepPreferences && item.prepPreferences.length > 0) {
            item.prepPreferences.forEach((p) => {
              if (p?.name) specs.push(p.name);
            });
          }
          if (item.customizations && item.customizations.length > 0) {
            item.customizations.forEach((c) => {
              if (c?.optionName) specs.push(c.optionName);
            });
          }

          return {
            _id: item._id,
            itemId: item.itemId,
            name: item.itemName,
            qty: item.quantity,
            price: `₹${((item.itemPrice || 0) / 100).toFixed(2)}`,
            rawPrice: item.itemPrice,
            spec: specs.join(", "),
            isReady: Boolean(item.isReady),
            stationId: item.stationId,
            stationName: stName || "Front Prep Counter #01",
          };
        });

        const allItemsReady = enrichedItems.length > 0 && enrichedItems.every((i) => i.isReady);
        const someItemsReady = enrichedItems.some((i) => i.isReady);

        // 2. Resolve Destination info
        let destinationTypeLabel = "Dine In";
        let destinationDetails = "Direct Counter";
        let tableNumberStr = "";
        let covers = order.membersOnTable || 1;

        if (order.orderType === "DineIn") {
          destinationTypeLabel = "Dine In";
          if (order.tableId) {
            const tbl = await ctx.db.get(order.tableId);
            if (tbl) {
              tableNumberStr = tbl.tableNumber;
              destinationDetails = `Table ${tbl.tableNumber} · ${covers} Covers`;
            }
          }
          if (!tableNumberStr && order.qrId) {
            const qr = await ctx.db.get(order.qrId);
            if (qr?.tableNumber) {
              tableNumberStr = qr.tableNumber;
              destinationDetails = `Table ${qr.tableNumber} · ${covers} Covers`;
            }
          }
          if (!tableNumberStr) {
            destinationDetails = `Dine In · ${covers} Covers`;
          }
        } else if (order.orderType === "TakeAway" || order.orderType === "ScheduledPickup") {
          destinationTypeLabel = order.orderType === "ScheduledPickup" ? "Scheduled Pickup" : "Takeaway";
          const pickupToken = order.tokenNumber ? `Counter Box #${order.tokenNumber.slice(-2)}` : "Counter Pickup";
          destinationDetails = pickupToken;
        } else {
          destinationTypeLabel = order.orderType === "ScheduledDelivery" ? "Scheduled Delivery" : "Delivery";
          if (order.deliveryAddress) {
            const city = order.deliveryAddress.city ? `, ${order.deliveryAddress.city}` : "";
            destinationDetails = `${order.deliveryAddress.addressLine1}${city}`;
          } else {
            destinationDetails = "Doorstep Delivery";
          }
        }

        // 3. Status key & Next Action configuration
        const statusKey = deriveWorkstationStatusKey(order);
        let statusBadgeText = "ACCEPTED";
        let nextActionLabel: string | null = "START PREPARING";
        let nextActionStatus: WorkstationStatusKey | null = "IN_PROGRESS";

        if (statusKey === "COMPLETED") {
          statusBadgeText = order.orderType === "DineIn" ? "SERVED" : order.orderType === "TakeAway" ? "PICKED UP" : "DELIVERED";
          nextActionLabel = null;
          nextActionStatus = null;
        } else if (statusKey === "READY") {
          statusBadgeText = "READY TO DELIVER";
          if (order.orderType === "DineIn") {
            nextActionLabel = "MARK SERVED";
          } else if (order.orderType === "TakeAway" || order.orderType === "ScheduledPickup") {
            nextActionLabel = "MARK HANDED OVER";
          } else {
            nextActionLabel = "MARK DELIVERED";
          }
          nextActionStatus = "COMPLETED";
        } else if (statusKey === "IN_PROGRESS") {
          statusBadgeText = "IN PROGRESS";
          nextActionLabel = "MARK READY";
          nextActionStatus = "READY";
        } else {
          statusBadgeText = "ACCEPTED";
          nextActionLabel = "START PREPARING";
          nextActionStatus = "IN_PROGRESS";
        }

        const customerName = order.customerName || "Walk-in Guest";
        const customerPhone = order.customerPhone || "-";
        const avatarInitial = (customerName.charAt(0) || "G").toUpperCase();

        return {
          _id: order._id,
          orderId: order._id,
          orderNumber: order.orderNumber,
          tokenNumber: order.tokenNumber,
          orderType: order.orderType,
          orderTypeFilter:
            order.orderType === "DineIn"
              ? "dine-in"
              : order.orderType === "TakeAway" || order.orderType === "ScheduledPickup"
              ? "takeaway"
              : "delivery",
          destinationTypeLabel,
          destinationDetails,
          tableNumber: tableNumberStr,
          covers,
          customerName,
          customerPhone,
          avatarInitial,
          primaryStationName,
          items: enrichedItems,
          allItemsReady,
          someItemsReady,
          specialNotes: order.specialNotes || null,
          formattedTime: formatClockTime(order.createdAt, timeZone),
          relativeAge: formatRelativeTime(order.createdAt, now),
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          statusKey,
          statusBadgeText,
          nextActionLabel,
          nextActionStatus,
          isCompleted: Boolean(order.isCompleted),
          isRejected: Boolean(order.isRejected),
          totalAmountPaise: order.totalAmount,
          formattedTotalAmount: `₹${(order.totalAmount / 100).toFixed(2)}`,
        };
      })
    );

    return {
      orders: enrichedOrders,
      counts: {
        all: allActiveCount,
        dineIn: dineInCount,
        takeaway: takeawayCount,
        delivery: deliveryCount,
        completed: completedCount,
      },
      activeStation: mainStation
        ? { _id: mainStation._id, name: mainStation.name, isMain: mainStation.isMain }
        : { _id: "default", name: "Front Prep Counter #01", isMain: true },
    };
  },
});

// ==========================================
// 2. ADVANCE ORDER LIFECYCLE (AUTHORITATIVE MUTATION)
// ==========================================

export const advanceOrderLifecycle = mutation({
  args: {
    orderId: v.id("orders"),
    targetStatus: v.optional(
      v.union(v.literal("IN_PROGRESS"), v.literal("READY"), v.literal("COMPLETED"))
    ),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.isCompleted || order.isRejected) {
      throw new Error("Cannot advance a completed or cancelled order");
    }

    const { org } = await requireStaffMember(ctx, order.organizationId);
    const now = Date.now();

    // Determine current status key
    const currentStatusKey = deriveWorkstationStatusKey(order);
    let nextStatusKey: WorkstationStatusKey = args.targetStatus || "IN_PROGRESS";

    if (!args.targetStatus) {
      if (currentStatusKey === "ACCEPTED") {
        nextStatusKey = "IN_PROGRESS";
      } else if (currentStatusKey === "IN_PROGRESS") {
        nextStatusKey = "READY";
      } else if (currentStatusKey === "READY") {
        nextStatusKey = "COMPLETED";
      } else {
        return { success: true, message: "Order is already completed", status: "COMPLETED" };
      }
    }

    // Retrieve active sequence order processes for this store
    const processes = await ctx.db
      .query("organizationOrderProcesses")
      .collect();

    const activeSequence = processes
      .filter((p) => p.deletedAt === undefined && p.published && p.isSequence)
      .sort((a, b) => a.position - b.position);

    let targetProcess = null;
    let newStatusName = "";

    if (nextStatusKey === "IN_PROGRESS") {
      targetProcess =
        activeSequence.find(
          (p) =>
            p.position === 2 ||
            p.name.toLowerCase().includes("progress") ||
            p.name.toLowerCase().includes("prepar") ||
            p.name.toLowerCase().includes("cook")
        ) ||
        activeSequence[1] ||
        activeSequence[0];

      newStatusName = targetProcess?.name || "Cooking & Plating";

      await ctx.db.patch(order._id, {
        orderStatusId: targetProcess?._id,
        orderStatusName: newStatusName,
        updatedAt: now,
      });

      await recordOrderActivity(ctx, {
        organizationId: org._id,
        orderId: order._id,
        processId: targetProcess?._id,
        processName: newStatusName,
        position: targetProcess?.position ?? 2,
        now,
      });
    } else if (nextStatusKey === "READY") {
      targetProcess =
        activeSequence.find(
          (p) =>
            p.position === 3 ||
            p.name.toLowerCase().includes("ready")
        ) ||
        (activeSequence.length >= 3 ? activeSequence[2] : activeSequence[activeSequence.length - 1]);

      newStatusName = targetProcess?.name || "Ready to Serve";

      // Cascading item completion: mark all orderItems ready across all stations
      const orderItems = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      for (const itm of orderItems) {
        if (!itm.isReady) {
          await ctx.db.patch(itm._id, { isReady: true });
        }
      }

      await ctx.db.patch(order._id, {
        orderStatusId: targetProcess?._id,
        orderStatusName: newStatusName,
        updatedAt: now,
      });

      await recordOrderActivity(ctx, {
        organizationId: org._id,
        orderId: order._id,
        processId: targetProcess?._id,
        processName: newStatusName,
        position: targetProcess?.position ?? 3,
        now,
      });
    } else if (nextStatusKey === "COMPLETED") {
      targetProcess =
        activeSequence.find((p) => p.position >= 4) ||
        activeSequence[activeSequence.length - 1] ||
        null;

      if (order.orderType === "DineIn") {
        newStatusName = targetProcess?.name || "Served at Table";
      } else if (order.orderType === "TakeAway" || order.orderType === "ScheduledPickup") {
        newStatusName = targetProcess?.name || "Picked Up / Handed Over";
      } else {
        newStatusName = targetProcess?.name || "Delivered";
      }

      // Mark order completed & paid
      await ctx.db.patch(order._id, {
        orderStatusId: targetProcess?._id,
        orderStatusName: newStatusName,
        isCompleted: true,
        paymentStatus: "Paid",
        updatedAt: now,
      });

      await recordOrderActivity(ctx, {
        organizationId: org._id,
        orderId: order._id,
        processId: targetProcess?._id,
        processName: newStatusName,
        position: targetProcess?.position ?? 4,
        now,
      });

      // Record credit payment entry if not already logged
      const existingPayments = await ctx.db
        .query("orderPayments")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      if (existingPayments.length === 0) {
        await ctx.db.insert("orderPayments", {
          organizationId: org._id,
          orderId: order._id,
          paymentModeName: order.paymentMode || "Cash",
          paymentType: "Credit",
          amount: order.totalAmount,
          payAmount: order.totalAmount,
          createdAt: now,
        });
      }
    }

    return {
      success: true,
      newStatus: newStatusName,
      statusKey: nextStatusKey,
      isCompleted: nextStatusKey === "COMPLETED",
    };
  },
});
