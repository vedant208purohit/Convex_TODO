import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { resolveNotificationsForOrderStatus } from "./processNotifications";
import { handleOrderCompletionTransfer } from "./providerPaymentTransfers";
import { Id } from "./_generated/dataModel";

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
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const todayStart = new Date(now).setHours(0, 0, 0, 0);

    // 0. Postpaid QR Verification Guard
    const reqTableId = args.tableId;
    if (reqTableId && !args.cashierUserId && !args.waiterUserId) {
      const org = await ctx.db.get(args.organizationId);
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

      lineItemConfigs.push({
        itemId: dbItem._id,
        itemName: dbItem.name,
        itemPrice: itemUnitPrice,
        quantity: inputItem.quantity,
        totalPrice: itemLineTotal,
        customizations: resolvedCustomizations,
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

    // 6. Insert Order Header
    const orderId = await ctx.db.insert("orders", {
      organizationId: args.organizationId,
      orderNumber,
      tokenNumber,
      orderType: args.orderType,
      orderSource: args.orderSource ?? "Prest-Cashier",
      orderStatusId: initialStatus?._id,
      orderStatusName: initialStatus?.name ?? "Accepted",
      isCompleted: resolvedPaymentStatus === "Paid",
      isRejected: false,
      isModify: false,
      tableId: args.tableId,
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
      await ctx.db.insert("orderItems", {
        organizationId: args.organizationId,
        orderId,
        itemId: line.itemId,
        itemName: line.itemName,
        itemPrice: line.itemPrice,
        quantity: line.quantity,
        totalPrice: line.totalPrice,
        customizations: line.customizations,
        isReady: false,
        isToGo: line.isToGo ?? false,
        createdAt: now,
      });
    }

    // 8. Log Initial Activity Entry
    await ctx.db.insert("orderActivities", {
      organizationId: args.organizationId,
      orderId,
      processId: initialStatus?._id,
      processName: initialStatus?.name ?? "Accepted",
      position: 1,
      createdAt: now,
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
    const netPaid = totalCredit - totalDebit;
    const remainingDue = Math.max(0, order.totalAmount - netPaid);
    const refundableAmount = Math.max(0, totalCredit - totalDebit);

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
    };
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
      itemsSummary: string;
    }> = [];

    // Return only the single most recent order (last order)
    for (const ord of sortedOrders.slice(0, 1)) {
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
        itemsSummary,
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

    // Appends entry in orderActivities
    const existingActivities = await ctx.db
      .query("orderActivities")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();

    const nextPosition = existingActivities.length + 1;

    await ctx.db.insert("orderActivities", {
      organizationId: order.organizationId,
      orderId: order._id,
      processId: process._id,
      processName: process.name,
      position: nextPosition,
      createdAt: now,
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
    await ctx.db.insert("orderActivities", {
      organizationId: order.organizationId,
      orderId: order._id,
      processName: `Removed ${args.orderItemIds.length} item(s)`,
      position: 50,
      createdAt: now,
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

    // Log activity
    await ctx.db.insert("orderActivities", {
      organizationId: order.organizationId,
      orderId: order._id,
      processName: "Cancelled",
      position: 99,
      createdAt: now,
    });

    return { success: true };
  },
});

// ==========================================
// 10. SEED SAMPLE / TEMPORARY ORDERS
// ==========================================

export const seedSampleOrders = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    let orgs = [];
    if (args.organizationId) {
      const singleOrg = await ctx.db.get(args.organizationId);
      if (!singleOrg) throw new Error("Organization not found");
      orgs.push(singleOrg);
    } else {
      orgs = await ctx.db.query("organizations").collect();
      if (!orgs.length) throw new Error("No organization found to seed orders");
    }

    let totalSeeded = 0;

    for (const org of orgs) {
      const orgId = org._id;
      const now = Date.now();

    // 1. Ensure at least one Menu, Category & Items exist
    let items = await ctx.db
      .query("items")
      .withIndex("by_org", (q) => q.eq("organizationId", orgId!))
      .collect();

    if (items.length === 0) {
      let menu = await ctx.db
        .query("menus")
        .withIndex("by_org", (q) => q.eq("organizationId", orgId!))
        .first();

      if (!menu) {
        const menuId = await ctx.db.insert("menus", {
          organizationId: orgId,
          name: "Main Dining Menu",
          isDefault: true,
          isActive: true,
          position: 0,
          createdAt: now,
          updatedAt: now,
        });
        menu = await ctx.db.get(menuId);
      }

      let category = await ctx.db
        .query("categories")
        .withIndex("by_org", (q) => q.eq("organizationId", orgId!))
        .first();

      if (!category) {
        const catId = await ctx.db.insert("categories", {
          organizationId: orgId,
          menuId: menu!._id,
          name: "Signature Specialties",
          published: true,
          position: 0,
          createdAt: now,
          updatedAt: now,
        });
        category = await ctx.db.get(catId);
      }

      const sampleItemDefs = [
        { name: "Truffle Butter Croissant", price: 35000 },
        { name: "Signature Cold Brew", price: 28000 },
        { name: "Margherita Sourdough Pizza", price: 65000 },
        { name: "Avocado & Poached Egg Toast", price: 42000 },
        { name: "Artisanal Tiramisu", price: 38000 },
      ];

      for (const def of sampleItemDefs) {
        const itemId = await ctx.db.insert("items", {
          organizationId: orgId,
          name: def.name,
          price: def.price,
          published: true,
          isAvailable: true,
          isGst: true,
          isVeg: true,
          isSpicy: false,
          showQuantity: false,
          markAsBestseller: false,
          showCalorie: false,
          createdAt: now,
          updatedAt: now,
        });
        const createdItem = await ctx.db.get(itemId);
        if (createdItem) items.push(createdItem);

        if (category) {
          await ctx.db.insert("categoryItems", {
            organizationId: orgId,
            categoryId: category._id,
            itemId,
            published: true,
            position: 0,
            createdAt: now,
          });
        }
      }
    }

    // 2. Ensure Sample Dine-In Tables exist & are linked to a Layout
    let tables = await ctx.db.query("organizationTables").collect();

    if (tables.length === 0) {
      let defaultLayout = (await ctx.db.query("organizationLayouts").collect()).find(
        (l) => l.deletedAt === undefined
      );
      if (!defaultLayout) {
        const layoutId = await ctx.db.insert("organizationLayouts", {
          name: "Indoor-DineIn",
          createdAt: now,
          updatedAt: now,
        });
        defaultLayout = await ctx.db.get(layoutId) || undefined;
      }

      const tableNumbers = ["01", "02", "04", "06", "10"];
      for (let i = 0; i < tableNumbers.length; i++) {
        const tNum = tableNumbers[i];
        const col = i % 4;
        const row = Math.floor(i / 4);
        const tId = await ctx.db.insert("organizationTables", {
          tableNumber: tNum,
          seatingCapacity: 4,
          layoutId: defaultLayout?._id,
          xPosition: (100 + col * 180).toString(),
          yPosition: (100 + row * 160).toString(),
          createdAt: now,
          updatedAt: now,
        });
        const tObj = await ctx.db.get(tId);
        if (tObj) tables.push(tObj);
      }
    }

    // 3. Clear existing orders for a clean state if any test orders exist
    const existingOrders = await ctx.db
      .query("orders")
      .withIndex("by_org", (q) => q.eq("organizationId", orgId!))
      .collect();

    for (const eo of existingOrders) {
      const itemsOfOrder = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", eo._id))
        .collect();
      for (const oi of itemsOfOrder) await ctx.db.delete(oi._id);

      const paymentsOfOrder = await ctx.db
        .query("orderPayments")
        .withIndex("by_order", (q) => q.eq("orderId", eo._id))
        .collect();
      for (const op of paymentsOfOrder) await ctx.db.delete(op._id);

      const activitiesOfOrder = await ctx.db
        .query("orderActivities")
        .withIndex("by_order", (q) => q.eq("orderId", eo._id))
        .collect();
      for (const oa of activitiesOfOrder) await ctx.db.delete(oa._id);

      await deleteOrderSurveys(ctx, eo._id);
      await ctx.db.delete(eo._id);
    }

    // 4. Resolve Order Processes for linking
    const processes = await ctx.db
      .query("organizationOrderProcesses")
      .collect();

    const processMap = new Map<string, any>();
    for (const p of processes) {
      processMap.set(p.name.toLowerCase(), p);
    }

    // 5. Create 6 Rich Temporary Orders matching defx-pos & defx-pos-frontend
    const sampleOrdersData = [
      {
        orderNumber: "#ORD-1081",
        tokenNumber: "01",
        orderType: "DineIn" as const,
        orderStatusName: "Accepted",
        customerName: "Vikram Malhotra",
        customerPhone: "+91 91234 56780",
        table: tables[2] || tables[0],
        paymentMode: "Cash",
        paymentStatus: "Pending" as const,
        specialNotes: "First time customer",
        itemsToPick: [items[1] || items[0]],
        timeOffsetMinutes: 5,
      },
      {
        orderNumber: "#ORD-1082",
        tokenNumber: "02",
        orderType: "DineIn" as const,
        orderStatusName: "In progress",
        customerName: "Rahul Verma",
        customerPhone: "+91 98765 43210",
        table: tables[1] || tables[0],
        paymentMode: "Cash",
        paymentStatus: "Pending" as const,
        specialNotes: "Extra spicy, serve starters first",
        itemsToPick: [items[0], items[1], items[2]],
        timeOffsetMinutes: 12,
      },
      {
        orderNumber: "#ORD-1083",
        tokenNumber: "03",
        orderType: "TakeAway" as const,
        orderStatusName: "In progress",
        customerName: "Priya Sharma",
        customerPhone: "+91 98234 56789",
        table: undefined,
        paymentMode: "UPI",
        paymentStatus: "Paid" as const,
        specialNotes: "Pack hot drinks separately",
        itemsToPick: [items[1], items[3] || items[0]],
        timeOffsetMinutes: 20,
      },
      {
        orderNumber: "#ORD-1084",
        tokenNumber: "04",
        orderType: "Delivery" as const,
        orderStatusName: "Ready to deliver",
        customerName: "Amit Patel",
        customerPhone: "+91 97123 45678",
        table: undefined,
        paymentMode: "Cash on Delivery",
        paymentStatus: "Pending" as const,
        specialNotes: "Ring doorbell twice, leave at reception if unavailable",
        deliveryAddress: {
          addressLine1: "Flat 402, Sunset Heights, Linking Road",
          landmark: "Near City Center Mall",
          city: "Mumbai",
          zipCode: "400050",
          addressType: "Home",
        },
        itemsToPick: [items[2], items[4] || items[0]],
        timeOffsetMinutes: 35,
      },
      {
        orderNumber: "#ORD-1085",
        tokenNumber: "05",
        orderType: "DineIn" as const,
        orderStatusName: "Delivered",
        customerName: "Sneha Rao",
        customerPhone: "+91 99887 66554",
        table: tables[0],
        paymentMode: "Card",
        paymentStatus: "Paid" as const,
        specialNotes: "Table anniversary celebration",
        itemsToPick: [items[0], items[2], items[3] || items[1], items[4] || items[0]],
        timeOffsetMinutes: 55,
      },
      {
        orderNumber: "#ORD-1086",
        tokenNumber: "06",
        orderType: "Delivery" as const,
        orderStatusName: "Cancelled",
        customerName: "Walk-in Customer",
        customerPhone: "",
        table: undefined,
        paymentMode: "Cash",
        paymentStatus: "Pending" as const,
        isRejected: true,
        specialNotes: "Cancelled: Customer requested cancellation before kitchen dispatch",
        deliveryAddress: {
          addressLine1: "12 Palm Grove, Sector 4",
          city: "Mumbai",
          zipCode: "400051",
          addressType: "Office",
        },
        itemsToPick: [items[2] || items[0]],
        timeOffsetMinutes: 90,
      },
    ];

    const seededOrderIds = [];

    for (const oData of sampleOrdersData) {
      const orderCreatedAt = now - oData.timeOffsetMinutes * 60 * 1000;
      let orderSubTotal = 0;

      const validItems = oData.itemsToPick.filter(Boolean);
      for (const it of validItems) {
        orderSubTotal += it.price;
      }

      const taxTotal = Math.round(orderSubTotal * 0.05); // 5% GST
      const totalAmount = orderSubTotal + taxTotal;

      const matchedProcess =
        processMap.get(oData.orderStatusName.toLowerCase()) ||
        processMap.get(
          oData.orderStatusName.includes("Kitchen")
            ? "in progress"
            : oData.orderStatusName.includes("Ready")
            ? "ready to deliver"
            : oData.orderStatusName.includes("Delivery")
            ? "delivered"
            : "accepted"
        );

      const orderId = await ctx.db.insert("orders", {
        organizationId: orgId,
        orderNumber: oData.orderNumber,
        tokenNumber: oData.tokenNumber,
        orderType: oData.orderType,
        orderSource: "Prest-Cashier",
        orderStatusId: matchedProcess?._id,
        orderStatusName: oData.orderStatusName,
        isCompleted: oData.orderStatusName === "Completed",
        isRejected: oData.isRejected ?? false,
        isModify: false,
        tableId: oData.table?._id,
        customerName: oData.customerName,
        customerPhone: oData.customerPhone || undefined,
        deliveryAddress: (oData as any).deliveryAddress,
        specialNotes: oData.specialNotes,
        subTotal: orderSubTotal,
        taxTotal,
        totalAmount,
        paymentMode: oData.paymentMode,
        paymentStatus: oData.paymentStatus,
        createdAt: orderCreatedAt,
        updatedAt: orderCreatedAt,
      });

      seededOrderIds.push(orderId);

      // Insert Order Items
      for (const it of validItems) {
        await ctx.db.insert("orderItems", {
          organizationId: orgId,
          orderId,
          itemId: it._id,
          itemName: it.name,
          itemPrice: it.price,
          quantity: 1,
          totalPrice: it.price,
          isReady: oData.orderStatusName === "Completed" || oData.orderStatusName === "Food Ready",
          createdAt: orderCreatedAt,
        });
      }

      // Insert Order Activity audit trail
      await ctx.db.insert("orderActivities", {
        organizationId: orgId,
        orderId,
        processId: matchedProcess?._id,
        processName: oData.orderStatusName,
        position: matchedProcess?.position ?? 1,
        createdAt: orderCreatedAt,
      });

      // Insert Payment if Paid
      if (oData.paymentStatus === "Paid") {
        await ctx.db.insert("orderPayments", {
          organizationId: orgId,
          orderId,
          paymentModeName: oData.paymentMode,
          paymentType: "Credit",
          amount: totalAmount,
          transactionReference: `TXN-${Date.now().toString().slice(-6)}`,
          createdAt: orderCreatedAt,
        });
      }
      totalSeeded += 1;
    }
  }

    return {
      success: true,
      message: `Successfully seeded ${totalSeeded} realistic manual orders across all store organizations with full defx-pos parity.`,
      orderCount: totalSeeded,
    };
  },
});

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

      const itemLineTotal = itemUnitPrice * inputItem.quantity;
      additionalSubTotal += itemLineTotal;

      lineItemConfigs.push({
        itemId: dbItem._id,
        itemName: dbItem.name,
        itemPrice: itemUnitPrice,
        quantity: inputItem.quantity,
        totalPrice: itemLineTotal,
        customizations: resolvedCustomizations,
        isToGo: inputItem.isToGo ?? false,
      });
    }

    // 1. Insert new order items
    for (const line of lineItemConfigs) {
      await ctx.db.insert("orderItems", {
        organizationId: order.organizationId,
        orderId: order._id,
        itemId: line.itemId,
        itemName: line.itemName,
        itemPrice: line.itemPrice,
        quantity: line.quantity,
        totalPrice: line.totalPrice,
        customizations: line.customizations,
        isReady: false,
        isToGo: line.isToGo ?? false,
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
    const existingActivities = await ctx.db
      .query("orderActivities")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();

    await ctx.db.insert("orderActivities", {
      organizationId: order.organizationId,
      orderId: order._id,
      processName: `Added ${args.items.length} item(s) to table order`,
      position: existingActivities.length + 1,
      createdAt: now,
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
    await ctx.db.insert("orderActivities", {
      organizationId: order.organizationId,
      orderId: order._id,
      processName: `Moved order to Table #${newTable.tableNumber}`,
      position: 60,
      createdAt: now,
    });

    return {
      success: true,
      newTableNumber: newTable.tableNumber,
    };
  },
});



