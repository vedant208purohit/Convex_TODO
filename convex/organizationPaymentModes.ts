import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

const DEFAULT_PAYMENT_MODES = [
  "Cash",
  "Credit Card",
  "Debit Card",
  "UPI",
  "Pay later",
  "Wallet",
];

/**
 * List all active/published payment modes for an organization.
 * Provides full parity with organizationPaymentModes:list.
 */
export const list = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    let orgId = args.organizationId;
    if (!orgId) {
      const org = await ctx.db.query("organizations").first();
      if (!org) {
        return DEFAULT_PAYMENT_MODES.map((name, i) => ({
          _id: `pm_${i}`,
          name,
          active: true,
        }));
      }
      orgId = org._id;
    }

    try {
      const modes = await ctx.db
        .query("paymentModes" as any)
        .withIndex("by_org", (q: any) => q.eq("organizationId", orgId!))
        .collect();

      if (modes && modes.length > 0) {
        return modes.filter((m: any) => m.active !== false);
      }
    } catch {
      // Fallback to default payment modes
    }

    return DEFAULT_PAYMENT_MODES.map((name, i) => ({
      _id: `pm_${i}`,
      name,
      active: true,
    }));
  },
});
