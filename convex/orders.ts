import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    customerEmail: v.optional(v.string()),

    // Financial Overrides (in minor units)
    discountAmount: v.optional(v.number()),
    deliveryCharge: v.optional(v.number()),

    // Delivery Address
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

    // 3. Resolve Store Default Tax Group
    const defaultTaxGroups = await ctx.db
      .query("taxGroups")
      .withIndex("by_org_default", (q) =>
        q.eq("organizationId", args.organizationId).eq("isDefault", true)
      )
      .collect();

    const taxGroup = defaultTaxGroups.length > 0 ? defaultTaxGroups[0] : null;
    let taxMode: "inclusive" | "exclusive" = "exclusive";
    let totalTaxRate = 0;
    const taxComponents: Array<any> = [];

    if (taxGroup) {
      taxMode = taxGroup.taxMode;
      for (const compId of taxGroup.componentIds) {
        const comp = await ctx.db.get(compId);
        if (comp) {
          taxComponents.push(comp);
          totalTaxRate += comp.rate;
        }
      }
    }

    // 4. Calculate Subtotal, Line Items, and Tax Amounts
    let rawSubTotal = 0;
    let rawTaxTotal = 0;
    const lineItemConfigs: Array<any> = [];

    for (const inputItem of args.items) {
      const dbItem = await ctx.db.get(inputItem.itemId);
      if (!dbItem) throw new Error("Item not found");

      let itemUnitPrice = dbItem.price; // in minor units
      const resolvedCustomizations: Array<any> = [];

      if (inputItem.customizations) {
        for (const custInput of inputItem.customizations) {
          const custGroup = await ctx.db.get(custInput.customizationId);
          const custOption = await ctx.db.get(custInput.optionId);
          if (custGroup && custOption) {
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
      rawSubTotal += itemLineTotal;

      // Item level tax calculation if isGst is true
      if (dbItem.isGst && totalTaxRate > 0) {
        const linePriceUnits = itemLineTotal / 100.0;
        if (taxMode === "inclusive") {
          rawTaxTotal += linePriceUnits * (totalTaxRate / (100 + totalTaxRate)) * 100;
        } else {
          rawTaxTotal += linePriceUnits * (totalTaxRate / 100.0) * 100;
        }
      }

      lineItemConfigs.push({
        itemId: dbItem._id,
        itemName: dbItem.name,
        itemPrice: itemUnitPrice,
        quantity: inputItem.quantity,
        totalPrice: itemLineTotal,
        customizations: resolvedCustomizations,
      });
    }

    const subTotal = Math.round(rawSubTotal);
    const taxTotal = Math.round(rawTaxTotal);
    const discount = args.discountAmount ?? 0;
    const delivery = args.deliveryCharge ?? 0;

    let baseAmount = taxMode === "inclusive" ? subTotal : subTotal + taxTotal;
    const totalAmount = Math.max(0, baseAmount - discount + delivery);

    // Build Tax Snapshot
    const taxInfoSnapshot = {
      tax_mode: taxMode,
      total_tax_rate: totalTaxRate,
      tax_amount: (taxTotal / 100).toFixed(2),
      sub_total: (subTotal / 100).toFixed(2),
      discount_amount: (discount / 100).toFixed(2),
      delivery_charge: (delivery / 100).toFixed(2),
      total_amount: (totalAmount / 100).toFixed(2),
      components: taxComponents.map((c) => ({
        name: c.name,
        code: c.code ?? c.name,
        rate: c.rate,
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

    // 6. Insert Order Header
    const orderId = await ctx.db.insert("orders", {
      organizationId: args.organizationId,
      orderNumber,
      tokenNumber,
      orderType: args.orderType,
      orderSource: args.orderSource ?? "Prest-Cashier",
      orderStatusId: initialStatus?._id,
      orderStatusName: initialStatus?.name ?? "Accepted",
      isCompleted: false,
      isRejected: false,
      isModify: false,
      tableId: args.tableId,
      waiterUserId: args.waiterUserId,
      cashierUserId: args.cashierUserId,
      membersOnTable: args.membersOnTable ?? 1,
      customerName: args.customerName,
      customerPhone: args.customerPhone,
      customerEmail: args.customerEmail,
      subTotal,
      taxTotal,
      discountAmount: args.discountAmount,
      deliveryCharge: args.deliveryCharge,
      deliveryAddress: args.deliveryAddress,
      totalAmount,
      paymentMode: args.paymentMode ?? "Cash",
      paymentStatus: "Pending",
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

    // 9. Dine-In Table Locking
    if (args.tableId) {
      const table = await ctx.db.get(args.tableId);
      if (table) {
        await ctx.db.patch(args.tableId, {
          currentOrderId: orderId,
          isRequested: false,
          updatedAt: now,
        });
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
  args: { id: v.id("orders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) return null;

    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();

    const activities = await ctx.db
      .query("orderActivities")
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

    return {
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
      payments,
      table: tableInfo ? { id: tableInfo._id, number: tableInfo.tableNumber } : null,
    };
  },
});

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

    return { success: true, statusName: process.name };
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
    transactionReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    const now = Date.now();

    // 1. Mark Order Completed & Paid
    await ctx.db.patch(order._id, {
      isCompleted: true,
      paymentStatus: "Paid",
      updatedAt: now,
    });

    // 2. Record Payment Log
    let payModeName = order.paymentMode;
    if (args.paymentModeId) {
      const pm = await ctx.db.get(args.paymentModeId);
      if (pm) payModeName = pm.name;
    }

    await ctx.db.insert("orderPayments", {
      organizationId: order.organizationId,
      orderId: order._id,
      paymentModeId: args.paymentModeId,
      paymentModeName: payModeName,
      amount: order.totalAmount,
      transactionReference: args.transactionReference,
      createdAt: now,
    });

    // 3. Clear Dine-In Table Occupancy
    if (order.tableId) {
      const table = await ctx.db.get(order.tableId);
      if (table && table.currentOrderId === order._id.toString()) {
        await ctx.db.patch(order.tableId, {
          currentOrderId: undefined,
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

    return {
      success: true,
      orderId: order._id,
      orderNumber: order.orderNumber,
      isCompleted: true,
    };
  },
});
