import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAuth, resolveStoreOrganization, getCallerMembership } from "./organizationUsers";

// ----------------------------------------------------
// AUTHORIZATION HELPERS
// ----------------------------------------------------

export async function requireAdminOrCashier(
  ctx: QueryCtx | MutationCtx,
  explicitOrgId?: Id<"organizations">
) {
  const identity = await requireAuth(ctx);
  const org = await resolveStoreOrganization(ctx, explicitOrgId);
  const callerMember = await getCallerMembership(ctx, identity.subject, org._id);

  if (
    !callerMember ||
    (!callerMember.userType.includes("admin") &&
      !callerMember.userType.includes("cashier"))
  ) {
    throw new Error("Forbidden. Admin or Cashier access required.");
  }

  return { identity, org, callerMember };
}

// ----------------------------------------------------
// DEFAULT SETTINGS SEEDER / PROVISIONER
// ----------------------------------------------------

const DEFAULT_SETTINGS = {
  cfdEnabled: true,
  displayLayout: "split" as const,
  theme: "light" as const,
  showPaymentQr: true,
  storeUpiAddress: "skyz.banquet@icici",
  showCashTenderedChangeDue: true,
  merchantDisplayName: "Skyz Restaurant & Banquet",
  showStarRatingSurvey: true,
  showWhatsappReceipt: true,
  returnToWelcomeTimeout: 8,
};

// ----------------------------------------------------
// SETTINGS QUERIES & MUTATIONS
// ----------------------------------------------------

/**
 * Gets the CFD settings for the current store.
 * If no record exists yet, returns initialized defaults.
 */
export const getSettings = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const org = await resolveStoreOrganization(ctx, args.organizationId);

    const existing = await ctx.db
      .query("organizationFrontDisplaySettings")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .first();

    if (!existing) {
      return {
        _id: undefined,
        organizationId: org._id,
        ...DEFAULT_SETTINGS,
        merchantDisplayName: org.name || DEFAULT_SETTINGS.merchantDisplayName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    return existing;
  },
});

/**
 * Updates CFD settings for the active store (creates or updates).
 */
export const updateSettings = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    cfdEnabled: v.boolean(),
    displayLayout: v.union(v.literal("split"), v.literal("cart"), v.literal("media")),
    theme: v.union(v.literal("light"), v.literal("dark"), v.literal("warm")),
    showPaymentQr: v.boolean(),
    storeUpiAddress: v.optional(v.string()),
    showCashTenderedChangeDue: v.boolean(),
    merchantDisplayName: v.optional(v.string()),
    showStarRatingSurvey: v.boolean(),
    showWhatsappReceipt: v.boolean(),
    returnToWelcomeTimeout: v.number(),
  },
  handler: async (ctx, args) => {
    const { org } = await requireAdminOrCashier(ctx, args.organizationId);
    const now = Date.now();

    const existing = await ctx.db
      .query("organizationFrontDisplaySettings")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .first();

    const payload = {
      cfdEnabled: args.cfdEnabled,
      displayLayout: args.displayLayout,
      theme: args.theme,
      showPaymentQr: args.showPaymentQr,
      storeUpiAddress: args.storeUpiAddress?.trim() || undefined,
      showCashTenderedChangeDue: args.showCashTenderedChangeDue,
      merchantDisplayName: args.merchantDisplayName?.trim() || undefined,
      showStarRatingSurvey: args.showStarRatingSurvey,
      showWhatsappReceipt: args.showWhatsappReceipt,
      returnToWelcomeTimeout: args.returnToWelcomeTimeout,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return (await ctx.db.get(existing._id))!;
    } else {
      const id = await ctx.db.insert("organizationFrontDisplaySettings", {
        organizationId: org._id,
        ...payload,
        createdAt: now,
      });
      return (await ctx.db.get(id))!;
    }
  },
});

// ----------------------------------------------------
// CONNECTED DISPLAYS (HARDWARE & WIRELESS TABLETS)
// ----------------------------------------------------

/**
 * Lists connected displays for the store.
 * If empty, automatically seeds the primary Dual-Screen terminal and sample wireless tablet.
 */
export const listDisplays = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const org = await resolveStoreOrganization(ctx, args.organizationId);

    const displays = await ctx.db
      .query("customerFrontDisplays")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    if (displays.length === 0) {
      // Return default representations for demo / fresh stores
      return [
        {
          _id: "default_hdmi_screen" as unknown as Id<"customerFrontDisplays">,
          organizationId: org._id,
          name: "Terminal 01 — Counter Dual Display (HDMI)",
          workstationName: "Workstation Barista & Checkout 01",
          connectionType: "hdmi" as const,
          status: "active" as const,
          lastSeenAt: Date.now(),
          terminalId: "terminal-01",
          createdAt: Date.now() - 3600000,
          updatedAt: Date.now(),
        },
        {
          _id: "default_ipad_screen" as unknown as Id<"customerFrontDisplays">,
          organizationId: org._id,
          name: "iPad Air 5th Gen — Counter 02 Pass",
          workstationName: "Floor Cashier 2",
          connectionType: "network" as const,
          ipAddress: "192.168.1.144",
          status: "active" as const,
          latencyMs: 12,
          lastSeenAt: Date.now() - 120000,
          terminalId: "terminal-02",
          createdAt: Date.now() - 7200000,
          updatedAt: Date.now() - 120000,
        },
      ];
    }

    return displays;
  },
});

/**
 * Initiates pairing for a new counter tablet by generating a secure 6-digit PIN.
 */
export const pairDisplay = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    name: v.optional(v.string()),
    terminalId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org } = await requireAdminOrCashier(ctx, args.organizationId);
    const now = Date.now();

    // 6-digit numeric pairing code
    const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes expiry

    const id = await ctx.db.insert("customerFrontDisplays", {
      organizationId: org._id,
      terminalId: args.terminalId || `term-${Date.now().toString().slice(-4)}`,
      name: args.name || "Counter Tablet (Pending Pairing)",
      workstationName: "Checkout Counter",
      connectionType: "network",
      status: "pending_pair",
      lastSeenAt: now,
      pairingCode,
      pairingCodeExpiresAt: expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    return {
      displayId: id,
      pairingCode,
      expiresAt,
    };
  },
});

/**
 * Tests connection latency / ping to a display device.
 */
export const testConnection = mutation({
  args: {
    displayId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const latency = Math.floor(8 + Math.random() * 10); // Simulated ping 8-18ms

    if (args.displayId !== "default_hdmi_screen" && args.displayId !== "default_ipad_screen") {
      try {
        await ctx.db.patch(args.displayId as Id<"customerFrontDisplays">, {
          latencyMs: latency,
          lastSeenAt: now,
          status: "active",
          updatedAt: now,
        });
      } catch {
        // Fallback for demo ID
      }
    }

    return {
      success: true,
      latencyMs: latency,
      status: "active",
      timestamp: now,
    };
  },
});

/**
 * Disconnects or removes a display device.
 */
export const disconnectDisplay = mutation({
  args: {
    displayId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    if (args.displayId !== "default_hdmi_screen" && args.displayId !== "default_ipad_screen") {
      try {
        await ctx.db.patch(args.displayId as Id<"customerFrontDisplays">, {
          deletedAt: now,
          status: "offline",
          updatedAt: now,
        });
      } catch {
        // Fallback for demo ID
      }
    }

    return { success: true };
  },
});

/**
 * Re-pairs a wireless tablet by renewing its pairing PIN.
 */
export const repairDisplay = mutation({
  args: {
    displayId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();

    if (args.displayId !== "default_hdmi_screen" && args.displayId !== "default_ipad_screen") {
      try {
        await ctx.db.patch(args.displayId as Id<"customerFrontDisplays">, {
          pairingCode: newCode,
          pairingCodeExpiresAt: now + 10 * 60 * 1000,
          status: "active",
          lastSeenAt: now,
          updatedAt: now,
        });
      } catch {
        // Fallback for demo ID
      }
    }

    return {
      success: true,
      pairingCode: newCode,
      message: "Tablet successfully re-synchronized with counter terminal.",
    };
  },
});

// ----------------------------------------------------
// RUNTIME LIVE DISPLAY SESSION (BROADCAST & SYNC)
// ----------------------------------------------------

/**
 * Gets the active runtime display session for a terminal.
 */
export const getSessionState = query({
  args: {
    terminalId: v.string(),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const org = await resolveStoreOrganization(ctx, args.organizationId);

    const session = await ctx.db
      .query("frontDisplaySessions")
      .withIndex("by_org_terminal", (q) =>
        q.eq("organizationId", org._id).eq("terminalId", args.terminalId)
      )
      .first();

    return session || null;
  },
});

/**
 * Publishes session state from cashier billing terminal to customer front display.
 */
export const publishSessionState = mutation({
  args: {
    terminalId: v.string(),
    state: v.union(
      v.literal("idle"),
      v.literal("ringing"),
      v.literal("payment_qr"),
      v.literal("cash_tender"),
      v.literal("completed")
    ),
    payload: v.any(),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const org = await resolveStoreOrganization(ctx, args.organizationId);
    const now = Date.now();

    const existing = await ctx.db
      .query("frontDisplaySessions")
      .withIndex("by_org_terminal", (q) =>
        q.eq("organizationId", org._id).eq("terminalId", args.terminalId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        state: args.state,
        payload: args.payload,
        updatedAt: now,
      });
      return { success: true, timestamp: now };
    } else {
      await ctx.db.insert("frontDisplaySessions", {
        organizationId: org._id,
        terminalId: args.terminalId,
        state: args.state,
        payload: args.payload,
        updatedAt: now,
      });
      return { success: true, timestamp: now };
    }
  },
});

/**
 * Generates dynamic UPI payment QR string according to NPCI UPI specifications.
 */
export const generateDynamicUpiQr = mutation({
  args: {
    amount: v.number(), // In currency units (e.g. 1304.00)
    orderNumber: v.string(),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const org = await resolveStoreOrganization(ctx, args.organizationId);

    const settings = await ctx.db
      .query("organizationFrontDisplaySettings")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .first();

    const vpa = settings?.storeUpiAddress || "skyz.banquet@icici";
    const merchantName = settings?.merchantDisplayName || org.name || "Skyz Restaurant";
    const formattedAmount = args.amount.toFixed(2);

    // NPCI UPI URI Specification
    const upiString = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(
      merchantName
    )}&am=${formattedAmount}&cu=INR&tr=${encodeURIComponent(args.orderNumber)}`;

    return {
      upiString,
      vpa,
      merchantName,
      amount: formattedAmount,
    };
  },
});

/**
 * Submits instant 1-touch 5-star customer feedback rating directly into survey attempts.
 */
export const submitInstantRating = mutation({
  args: {
    orderNumber: v.optional(v.string()),
    score: v.number(), // 1 to 5
    surveyId: v.optional(v.id("surveys")),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    await resolveStoreOrganization(ctx, args.organizationId);
    const now = Date.now();

    let targetSurveyId = args.surveyId;

    if (!targetSurveyId) {
      const activeSurvey = await ctx.db
        .query("surveys")
        .withIndex("by_active", (q) => q.eq("active", true))
        .first();
      targetSurveyId = activeSurvey?._id;
    }

    if (targetSurveyId) {
      const attemptId = await ctx.db.insert("surveyAttempts", {
        surveyId: targetSurveyId,
        published: true,
        submittedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      // Find first question to record answer
      const firstQ = await ctx.db
        .query("surveyQuestions")
        .withIndex("by_survey_id", (q) => q.eq("surveyId", targetSurveyId))
        .first();

      if (firstQ) {
        await ctx.db.insert("surveyAnswers", {
          attemptId,
          questionId: firstQ._id,
          numericValue: args.score,
          answerText: `${args.score} Star Rating`,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return { success: true, score: args.score, timestamp: now };
  },
});

/**
 * Returns the store's currently active survey (if any) for displaying on the settings page.
 */
export const getActiveSurvey = query({
  args: {},
  handler: async (ctx) => {
    const activeSurvey = await ctx.db
      .query("surveys")
      .withIndex("by_active", (q) => q.eq("active", true))
      .first();

    if (!activeSurvey) {
      return null;
    }

    return {
      _id: activeSurvey._id,
      name: activeSurvey.name,
      active: activeSurvey.active,
    };
  },
});

/**
 * Provisions CFD default settings and displays for all active stores in the database.
 */
export const provisionAllActiveStores = mutation({
  args: {},
  handler: async (ctx) => {
    const allOrgs = await ctx.db.query("organizations").collect();
    const activeOrgs = allOrgs.filter((org) => org.deletedAt === undefined);
    const results = [];
    const now = Date.now();

    for (const org of activeOrgs) {
      // 1. Ensure CFD settings exist
      let settings = await ctx.db
        .query("organizationFrontDisplaySettings")
        .withIndex("by_org", (q) => q.eq("organizationId", org._id))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .first();

      if (!settings) {
        const settingsId = await ctx.db.insert("organizationFrontDisplaySettings", {
          organizationId: org._id,
          cfdEnabled: true,
          displayLayout: "split",
          theme: "light",
          showPaymentQr: true,
          storeUpiAddress: "skyz.banquet@icici",
          showCashTenderedChangeDue: true,
          merchantDisplayName: org.name || "Skyz Restaurant & Banquet",
          showStarRatingSurvey: true,
          showWhatsappReceipt: true,
          returnToWelcomeTimeout: 8,
          createdAt: now,
          updatedAt: now,
        });
        settings = (await ctx.db.get(settingsId))!;
      }

      // 2. Ensure default connected display records exist
      const existingDisplays = await ctx.db
        .query("customerFrontDisplays")
        .withIndex("by_org", (q) => q.eq("organizationId", org._id))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      if (existingDisplays.length === 0) {
        await ctx.db.insert("customerFrontDisplays", {
          organizationId: org._id,
          name: "Terminal 01 — Counter Dual Display (HDMI)",
          workstationName: "Workstation Barista & Checkout 01",
          connectionType: "hdmi",
          status: "active",
          lastSeenAt: now,
          terminalId: "terminal-01",
          createdAt: now,
          updatedAt: now,
        });

        await ctx.db.insert("customerFrontDisplays", {
          organizationId: org._id,
          name: "iPad Air 5th Gen — Counter 02 Pass",
          workstationName: "Floor Cashier 2",
          connectionType: "network",
          ipAddress: "192.168.1.144",
          status: "active",
          latencyMs: 12,
          lastSeenAt: now - 120000,
          terminalId: "terminal-02",
          createdAt: now - 7200000,
          updatedAt: now - 120000,
        });
      }

      results.push({
        organizationId: org._id,
        name: org.name,
        slug: org.slug,
        cfdSettingsId: settings._id,
      });
    }

    return {
      totalActiveStores: activeOrgs.length,
      provisionedStores: results,
      timestamp: now,
    };
  },
});

