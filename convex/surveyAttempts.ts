import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireSurveyAdmin } from "./surveys";
import { resolveAssetOrStorageUrl } from "./assetResolver";
import { resolveOrganizationCurrency } from "../lib/constants/countries";

// ----------------------------------------------------
// DATE FORMAT VALIDATION & CANONICAL URL RESOLUTION
// ----------------------------------------------------
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Canonical customer-facing base URL resolver.
 * Ensures review URLs target the pos-user customer application
 * across local, development, and production deployments.
 */
export function getCustomerFacingBaseUrl(overrideUrl?: string): string {
  if (overrideUrl && typeof overrideUrl === "string") {
    const trimmed = overrideUrl.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      try {
        const parsed = new URL(trimmed);
        return `${parsed.protocol}//${parsed.host}`;
      } catch {
        // Fall back to configured environment URLs if malformed
      }
    }
  }

  const configured =
    process.env.POS_USER_BASE_URL ||
    process.env.FRONT_END_URL ||
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_URL;

  if (configured && typeof configured === "string" && configured.trim()) {
    const trimmed = configured.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      try {
        const parsed = new URL(trimmed);
        return `${parsed.protocol}//${parsed.host}`;
      } catch {
        return trimmed.replace(/\/+$/, "");
      }
    }
    return trimmed.replace(/\/+$/, "");
  }

  // Development vs Production defaults
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3002";
  }
  return "https://dev-pos-user.get-prest.com";
}

// ----------------------------------------------------
// ATTEMPT QUERIES & MUTATIONS
// ----------------------------------------------------

/**
 * Idempotently gets or creates a survey attempt for a specific order and the store's active survey.
 * Returns the attempt ID and public survey URL for receipts and notifications.
 */
export const getOrCreateForOrder = mutation({
  args: {
    orderId: v.union(v.id("orders"), v.string()),
    customerId: v.optional(v.string()),
    publicBaseUrl: v.optional(v.string()),
    storeSlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Resolve Order
    let order = null;
    const normalizedId = ctx.db.normalizeId("orders", args.orderId);
    if (normalizedId) {
      order = await ctx.db.get(normalizedId);
    }
    if (!order) {
      order = await ctx.db
        .query("orders")
        .filter((q) => q.eq(q.field("orderNumber"), args.orderId))
        .first();
    }
    if (!order) {
      throw new Error("Order not found");
    }

    // 2. Find active survey for the store
    let activeSurvey = await ctx.db
      .query("surveys")
      .withIndex("by_active", (q) => q.eq("active", true))
      .first();

    if (!activeSurvey) {
      activeSurvey = await ctx.db.query("surveys").order("desc").first();
    }

    // If no survey exists at all, auto-create a standard dining survey so feedback works immediately
    if (!activeSurvey) {
      const now = Date.now();
      const newSurveyId = await ctx.db.insert("surveys", {
        name: "Guest Dining Experience",
        introduction: "Thank you for dining with us! Please share your thoughts to help us serve you better.",
        afterSurveyContent: "Thank you for your feedback! We look forward to welcoming you back.",
        active: true,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("surveyQuestions", {
        surveyId: newSurveyId,
        type: "numeric",
        questionText: "How was your overall dining experience?",
        position: 1,
        ratingDisplayMode: "stars",
        validationRules: {
          presence: true,
          greaterThanOrEqualTo: 1,
          lessThanOrEqualTo: 5,
        },
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("surveyQuestions", {
        surveyId: newSurveyId,
        type: "numeric",
        questionText: "Rate this dish",
        position: 2,
        frequency: "per_order_item",
        ratingDisplayMode: "stars",
        validationRules: {
          presence: false,
          greaterThanOrEqualTo: 1,
          lessThanOrEqualTo: 5,
        },
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("surveyQuestions", {
        surveyId: newSurveyId,
        type: "radio",
        questionText: "How was the order delivery speed?",
        position: 3,
        answerOptions: ["Too Slow", "Just Right", "Very Quick"],
        validationRules: { presence: false },
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("surveyQuestions", {
        surveyId: newSurveyId,
        type: "long",
        questionText: "Any compliments or areas where we can improve?",
        position: 4,
        placeholder: "Write your feedback here...",
        validationRules: { presence: false },
        createdAt: now,
        updatedAt: now,
      });

      activeSurvey = await ctx.db.get(newSurveyId);
    }

    if (!activeSurvey) {
      return null;
    }

    // 3. Find existing attempt for (orderId, surveyId)
    const existingAttempt = await ctx.db
      .query("surveyAttempts")
      .withIndex("by_order_survey", (q) =>
        q.eq("orderId", order._id).eq("surveyId", activeSurvey._id)
      )
      .first();

    const org = order.organizationId
      ? await ctx.db.get(order.organizationId)
      : await ctx.db.query("organizations").first();
    const storeSlug = org?.slug;
    const querySuffix = storeSlug ? `?store=${encodeURIComponent(storeSlug)}` : "";

    const baseUrl = getCustomerFacingBaseUrl(args.publicBaseUrl);

    if (existingAttempt) {
      const surveyQrUrl = `${baseUrl}/attempts/${existingAttempt._id}${querySuffix}`;

      return {
        attemptId: existingAttempt._id,
        surveyId: activeSurvey._id,
        published: existingAttempt.published,
        surveyQrUrl,
      };
    }

    // 4. Create new draft attempt (published = false)
    const now = Date.now();
    const customerId =
      args.customerId ||
      order.customerPhone ||
      undefined;

    const newAttemptId = await ctx.db.insert("surveyAttempts", {
      surveyId: activeSurvey._id,
      orderId: order._id,
      customerId,
      published: false,
      createdAt: now,
      updatedAt: now,
    });

    const surveyQrUrl = `${baseUrl}/attempts/${newAttemptId}${querySuffix}`;

    return {
      attemptId: newAttemptId,
      surveyId: activeSurvey._id,
      published: false,
      surveyQrUrl,
    };
  },
});

/**
 * Public Query: Returns survey and questions for an attempt respondent without requiring staff login.
 * Strictly avoids exposing customer PII or internal financial records.
 */
export const getForRespondent = query({
  args: {
    attemptId: v.optional(v.union(v.id("surveyAttempts"), v.string())),
    orderId: v.optional(v.union(v.id("orders"), v.string())),
  },
  handler: async (ctx, args) => {
    let attempt = null;

    if (args.attemptId) {
      const normalizedAttemptId = ctx.db.normalizeId("surveyAttempts", args.attemptId);
      if (normalizedAttemptId) {
        attempt = await ctx.db.get(normalizedAttemptId);
      }
    }

    if (!attempt && args.attemptId) {
      const normalizedOrderId = ctx.db.normalizeId("orders", args.attemptId);
      let order = normalizedOrderId ? await ctx.db.get(normalizedOrderId) : null;
      if (!order) {
        order = await ctx.db
          .query("orders")
          .filter((q) => q.eq(q.field("orderNumber"), args.attemptId))
          .first();
      }
      if (order) {
        attempt = await ctx.db
          .query("surveyAttempts")
          .withIndex("by_order_id", (q) => q.eq("orderId", order._id))
          .order("desc")
          .first();
      }
      if (!attempt) {
        const normalizedSessionId = ctx.db.normalizeId("organizationOrderingSessions", args.attemptId);
        if (normalizedSessionId) {
          const session: any = await ctx.db.get(normalizedSessionId);
          if (session?.orderId) {
            attempt = await ctx.db
              .query("surveyAttempts")
              .withIndex("by_order_id", (q) => q.eq("orderId", session.orderId))
              .order("desc")
              .first();
          } else if (session?.tableId) {
            const tableOrder = await ctx.db
              .query("orders")
              .filter((q) => q.eq(q.field("tableId"), session.tableId))
              .order("desc")
              .first();
            if (tableOrder) {
              attempt = await ctx.db
                .query("surveyAttempts")
                .withIndex("by_order_id", (q) => q.eq("orderId", tableOrder._id))
                .order("desc")
                .first();
            }
          }
        }
      }
    }

    if (!attempt && args.orderId) {
      let order = null;
      const normalizedOrderId = ctx.db.normalizeId("orders", args.orderId);
      if (normalizedOrderId) {
        order = await ctx.db.get(normalizedOrderId);
      }
      if (!order) {
        order = await ctx.db
          .query("orders")
          .filter((q) => q.eq(q.field("orderNumber"), args.orderId))
          .first();
      }
      if (order) {
        attempt = await ctx.db
          .query("surveyAttempts")
          .withIndex("by_order_id", (q) => q.eq("orderId", order._id))
          .order("desc")
          .first();
      }
    }

    if (!attempt) {
      if (args.attemptId) {
        throw new Error("Survey attempt not found");
      }
      return null;
    }

    const survey = await ctx.db.get(attempt.surveyId);
    if (!survey) {
      return null;
    }

    const questions = await ctx.db
      .query("surveyQuestions")
      .withIndex("by_survey_position", (q) => q.eq("surveyId", survey._id))
      .collect();

    // Fetch existing answers if the user already submitted or is resuming
    const existingAnswers = await ctx.db
      .query("surveyAnswers")
      .withIndex("by_attempt_id", (q) => q.eq("attemptId", attempt._id))
      .collect();

    const answerMap = new Map<string, Doc<"surveyAnswers">>();
    for (const a of existingAnswers) {
      if (!a.orderItemId && !a.orderItemName) {
        answerMap.set(a.questionId.toString(), a);
      }
    }

    // Resolve overall rating from authoritative attempt record or explicit overall rating question
    let resolvedOverallRating: number | undefined = attempt.overallRating;
    if (resolvedOverallRating === undefined) {
      const explicitOverallQ = questions.find((q) => {
        const text = (q.questionText || "").toLowerCase();
        return (
          q.type === "numeric" &&
          q.frequency !== "per_order_item" &&
          (text.includes("overall") ||
            text.includes("how was your") ||
            text.includes("dining experience") ||
            text.includes("general experience"))
        );
      });
      if (explicitOverallQ) {
        const ans = answerMap.get(explicitOverallQ._id.toString());
        if (ans?.numericValue !== undefined) {
          resolvedOverallRating = ans.numericValue;
        }
      }
    }

    // Resolve order and items context if attempt is order-bound
    let orderNumber: string | undefined = undefined;
    let tableNumber: string | undefined = undefined;
    let serverName: string | undefined = undefined;
    let storeName: string | undefined = undefined;
    let serviceMode: string | undefined = undefined;
    let orderTotal: number | undefined = undefined;
    let orderDate: number | undefined = undefined;
    let itemCount: number | undefined = undefined;
    let orderItems:
      | Array<{
          id: string;
          name: string;
          quantity: number;
          price: number;
          totalPrice: number;
          isVeg: boolean;
          categoryName: string;
          imageUrl?: string | null;
          currentRating?: number;
          currentComment?: string;
        }>
      | undefined = undefined;

    const itemAnswerMap = new Map<string, Doc<"surveyAnswers">>();
    for (const a of existingAnswers) {
      if (a.orderItemId) {
        itemAnswerMap.set(a.orderItemId, a);
      }
      if (a.orderItemName) {
        itemAnswerMap.set(a.orderItemName, a);
        itemAnswerMap.set(a.orderItemName.trim().toLowerCase(), a);
      }
    }

    let storeSlug: string | undefined = undefined;
    let storeLogoUrl: string | undefined = undefined;
    let currencySymbol: string | undefined = undefined;
    let country: string | undefined = undefined;
    let timezone: string | undefined = undefined;
    let organizationId: string | undefined = undefined;
    let primaryColor: string | undefined = undefined;
    let secondaryColor: string | undefined = undefined;
    let theme: string | undefined = undefined;

    if (attempt.orderId) {
      const order = await ctx.db.get(attempt.orderId);
      if (order) {
        orderNumber = order.orderNumber;
        serviceMode = order.orderType;
        orderTotal = order.totalAmount;
        orderDate = order.createdAt;

        if (order.organizationId) {
          const org = await ctx.db.get(order.organizationId);
          if (org) {
            organizationId = org._id;
            storeName = org.name;
            storeSlug = org.slug;
            const orgCurrency = resolveOrganizationCurrency(org);
            currencySymbol = orgCurrency.symbol;
            country = org.country || orgCurrency.countryCode;
            timezone = org.organizationTimeZone;
            primaryColor = org.primaryColor;
            secondaryColor = org.secondaryColor;
            theme = org.theme;

            if (org.logoAssetId || org.logoStorageId) {
              try {
                const storageOrR2Url = await resolveAssetOrStorageUrl(ctx, {
                  assetId: org.logoAssetId,
                  storageId: org.logoStorageId,
                  organizationId: org._id,
                });
                if (storageOrR2Url) {
                  storeLogoUrl = storageOrR2Url;
                }
              } catch {}
            }
            if (!storeLogoUrl && (org as any).logoImageStorageId) {
              try {
                const storageUrl = await ctx.storage.getUrl((org as any).logoImageStorageId);
                if (storageUrl) {
                  storeLogoUrl = storageUrl;
                }
              } catch {}
            }
            if (!storeLogoUrl && org.logoUrl && typeof org.logoUrl === "string") {
              const trimmed = org.logoUrl.trim();
              if (
                (trimmed.startsWith("http://") || trimmed.startsWith("https://")) &&
                !trimmed.startsWith("blob:")
              ) {
                storeLogoUrl = trimmed;
              }
            }
          }
        }

        if (order.tableId) {
          const tbl = await ctx.db.get(order.tableId);
          if (tbl) tableNumber = tbl.tableNumber;
        }
        if (order.waiterUserId) {
          try {
            const userDoc: any = await ctx.db.get(order.waiterUserId as any);
            if (userDoc) {
              serverName =
                `${userDoc.firstName || ""} ${userDoc.lastName || ""}`.trim() ||
                userDoc.name ||
                order.waiterUserId;
            }
          } catch {}
        }
        const items = await ctx.db
          .query("orderItems")
          .withIndex("by_order", (q) => q.eq("orderId", order._id))
          .collect();

        itemCount = items.length;

        orderItems = await Promise.all(
          items.map(async (it) => {
            let isVeg = true;
            let categoryName = "Starter";
            let imageUrl: string | null = null;
            if (it.itemId) {
              const itemDoc: any = await ctx.db.get(it.itemId);
              if (itemDoc) {
                isVeg = Boolean(itemDoc.isVeg);
                imageUrl = itemDoc.imageUrl || null;
              }
            }
            const lower = it.itemName.toLowerCase();
            if (lower.includes("naan") || lower.includes("roti") || lower.includes("bread")) {
              categoryName = "Fresh Clay Oven Breads";
            } else if (lower.includes("dal") || lower.includes("curry") || lower.includes("paneer")) {
              categoryName = "Mains / Slow Cooked";
            } else if (lower.includes("coffee") || lower.includes("beverage") || lower.includes("tea")) {
              categoryName = "Beverages";
            } else if (lower.includes("tikka") || lower.includes("starter")) {
              categoryName = "Starter / Tandoor Special";
            }

            const itemAns =
              itemAnswerMap.get(it._id.toString()) ||
              (it.itemId ? itemAnswerMap.get(it.itemId.toString()) : undefined) ||
              itemAnswerMap.get(it.itemName) ||
              itemAnswerMap.get(it.itemName.trim().toLowerCase());

            return {
              id: it._id,
              name: it.itemName,
              quantity: it.quantity,
              price: it.itemPrice,
              totalPrice: it.totalPrice,
              isVeg,
              categoryName,
              imageUrl,
              currentRating: itemAns?.numericValue,
              currentComment: itemAns?.answerText,
            };
          })
        );
      }
    }

    if (!organizationId) {
      const activeOrgs = await ctx.db.query("organizations").collect();
      const defaultOrg = activeOrgs.find((o) => o.deletedAt === undefined) || activeOrgs[0];
      if (defaultOrg) {
        organizationId = defaultOrg._id;
        if (!storeName) storeName = defaultOrg.name;
        if (!storeSlug) storeSlug = defaultOrg.slug;
        if (!storeLogoUrl) storeLogoUrl = defaultOrg.logoUrl;
        const defaultOrgCurr = resolveOrganizationCurrency(defaultOrg);
        if (!currencySymbol) currencySymbol = defaultOrgCurr.symbol;
        if (!country) country = defaultOrg.country || defaultOrgCurr.countryCode;
        if (!timezone) timezone = defaultOrg.organizationTimeZone;
        primaryColor = defaultOrg.primaryColor;
        secondaryColor = defaultOrg.secondaryColor;
        theme = defaultOrg.theme;
      }
    }

    return {
      attemptId: attempt._id,
      surveyId: survey._id,
      surveyName: survey.name,
      introduction: survey.introduction,
      afterSurveyContent: survey.afterSurveyContent,
      published: attempt.published,
      orderId: attempt.orderId,
      orderNumber,
      tableNumber,
      serverName,
      storeName: storeName || "PREST DINING & BISTRO",
      serviceMode: serviceMode || "Dine-In",
      orderTotal,
      orderDate,
      overallRating: resolvedOverallRating,
      submittedAt: attempt.submittedAt || attempt.updatedAt,
      storeSlug,
      storeLogoUrl,
      currencySymbol,
      country,
      timezone,
      organizationId,
      primaryColor,
      secondaryColor,
      theme,
      itemCount,
      orderItems,
      questions: questions
        .sort((a, b) => a.position - b.position)
        .map((q) => {
          const existingAns = answerMap.get(q._id.toString());
          return {
            id: q._id,
            type: q.type,
            questionText: q.questionText,
            defaultText: q.defaultText,
            placeholder: q.placeholder,
            position: q.position,
            answerOptions: q.answerOptions,
            validationRules: q.validationRules,
            frequency: q.frequency,
            ratingDisplayMode: q.ratingDisplayMode,
            lowLabel: q.lowLabel,
            highLabel: q.highLabel,
            currentAnswer: existingAns
              ? {
                  answerText: existingAns.answerText,
                  selectedOptions: existingAns.selectedOptions,
                  numericValue: existingAns.numericValue,
                }
              : undefined,
          };
        }),
    };
  },
});

/**
 * Public Mutation: Autosaves customer answers in real-time as draft without marking the attempt published.
 */
export const saveDraftAnswers = mutation({
  args: {
    attemptId: v.union(v.id("surveyAttempts"), v.string()),
    overallRating: v.optional(v.number()),
    answers: v.array(
      v.object({
        questionId: v.id("surveyQuestions"),
        orderItemId: v.optional(v.string()),
        orderItemName: v.optional(v.string()),
        answerText: v.optional(v.string()),
        selectedOptions: v.optional(v.array(v.string())),
        numericValue: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let attempt = null;
    const normalizedAttemptId = ctx.db.normalizeId("surveyAttempts", args.attemptId);
    if (normalizedAttemptId) {
      attempt = await ctx.db.get(normalizedAttemptId);
    }
    if (!attempt) {
      const normalizedOrderId = ctx.db.normalizeId("orders", args.attemptId);
      let order = normalizedOrderId ? await ctx.db.get(normalizedOrderId) : null;
      if (!order) {
        order = await ctx.db
          .query("orders")
          .filter((q) => q.eq(q.field("orderNumber"), args.attemptId))
          .first();
      }
      if (order) {
        attempt = await ctx.db
          .query("surveyAttempts")
          .withIndex("by_order_id", (q) => q.eq("orderId", order._id))
          .order("desc")
          .first();
      }
    }
    if (!attempt) {
      const normalizedSessionId = ctx.db.normalizeId("organizationOrderingSessions", args.attemptId);
      if (normalizedSessionId) {
        const session: any = await ctx.db.get(normalizedSessionId);
        if (session?.orderId) {
          attempt = await ctx.db
            .query("surveyAttempts")
            .withIndex("by_order_id", (q) => q.eq("orderId", session.orderId))
            .order("desc")
            .first();
        } else if (session?.tableId) {
          const tableOrder = await ctx.db
            .query("orders")
            .filter((q) => q.eq(q.field("tableId"), session.tableId))
            .order("desc")
            .first();
          if (tableOrder) {
            attempt = await ctx.db
              .query("surveyAttempts")
              .withIndex("by_order_id", (q) => q.eq("orderId", tableOrder._id))
              .order("desc")
              .first();
          }
        }
      }
    }
    if (!attempt) {
      throw new Error("Survey attempt not found");
    }

    if (attempt.published) {
      throw new Error("This feedback survey has already been submitted.");
    }

    const now = Date.now();

    if (args.overallRating !== undefined) {
      await ctx.db.patch(attempt._id, {
        overallRating: args.overallRating,
        updatedAt: now,
      });
    }

    for (const ans of args.answers) {
      const existing = ans.orderItemId
        ? await ctx.db
            .query("surveyAnswers")
            .withIndex("by_attempt_question", (q) =>
              q.eq("attemptId", attempt._id).eq("questionId", ans.questionId)
            )
            .filter((q) => q.eq(q.field("orderItemId"), ans.orderItemId))
            .first()
        : await ctx.db
            .query("surveyAnswers")
            .withIndex("by_attempt_question", (q) =>
              q.eq("attemptId", attempt._id).eq("questionId", ans.questionId)
            )
            .filter((q) =>
              q.or(
                q.eq(q.field("orderItemId"), undefined),
                q.eq(q.field("orderItemId"), "")
              )
            )
            .first();

      const numVal =
        ans.numericValue !== undefined
          ? ans.numericValue
          : ans.answerText !== undefined && !isNaN(Number(ans.answerText))
            ? Number(ans.answerText)
            : undefined;

      if (existing) {
        await ctx.db.patch(existing._id, {
          orderItemId: ans.orderItemId,
          orderItemName: ans.orderItemName,
          answerText: ans.answerText,
          selectedOptions: ans.selectedOptions,
          numericValue: numVal,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("surveyAnswers", {
          attemptId: attempt._id,
          questionId: ans.questionId,
          orderItemId: ans.orderItemId,
          orderItemName: ans.orderItemName,
          answerText: ans.answerText,
          selectedOptions: ans.selectedOptions,
          numericValue: numVal,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(attempt._id, {
      updatedAt: now,
    });

    return {
      success: true,
      savedAt: now,
    };
  },
});

/**
 * Public Mutation: Validates and persists customer answers for an attempt, transitioning to published state.
 */
export const submit = mutation({
  args: {
    attemptId: v.union(v.id("surveyAttempts"), v.string()),
    overallRating: v.optional(v.number()),
    source: v.optional(v.string()),
    answers: v.array(
      v.object({
        questionId: v.id("surveyQuestions"),
        orderItemId: v.optional(v.string()),
        orderItemName: v.optional(v.string()),
        answerText: v.optional(v.string()),
        selectedOptions: v.optional(v.array(v.string())),
        numericValue: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let attempt = null;
    const normalizedAttemptId = ctx.db.normalizeId("surveyAttempts", args.attemptId);
    if (normalizedAttemptId) {
      attempt = await ctx.db.get(normalizedAttemptId);
    }
    if (!attempt) {
      const normalizedOrderId = ctx.db.normalizeId("orders", args.attemptId);
      let order = normalizedOrderId ? await ctx.db.get(normalizedOrderId) : null;
      if (!order) {
        order = await ctx.db
          .query("orders")
          .filter((q) => q.eq(q.field("orderNumber"), args.attemptId))
          .first();
      }
      if (order) {
        attempt = await ctx.db
          .query("surveyAttempts")
          .withIndex("by_order_id", (q) => q.eq("orderId", order._id))
          .order("desc")
          .first();
      }
    }
    if (!attempt) {
      const normalizedSessionId = ctx.db.normalizeId("organizationOrderingSessions", args.attemptId);
      if (normalizedSessionId) {
        const session: any = await ctx.db.get(normalizedSessionId);
        if (session?.orderId) {
          attempt = await ctx.db
            .query("surveyAttempts")
            .withIndex("by_order_id", (q) => q.eq("orderId", session.orderId))
            .order("desc")
            .first();
        } else if (session?.tableId) {
          const tableOrder = await ctx.db
            .query("orders")
            .filter((q) => q.eq(q.field("tableId"), session.tableId))
            .order("desc")
            .first();
          if (tableOrder) {
            attempt = await ctx.db
              .query("surveyAttempts")
              .withIndex("by_order_id", (q) => q.eq("orderId", tableOrder._id))
              .order("desc")
              .first();
          }
        }
      }
    }
    if (!attempt) {
      throw new Error("Survey attempt not found");
    }

    const survey = await ctx.db.get(attempt.surveyId);
    if (!survey) {
      throw new Error("Survey not found");
    }

    const surveyQuestions = await ctx.db
      .query("surveyQuestions")
      .withIndex("by_survey_id", (q) => q.eq("surveyId", survey._id))
      .collect();

    const questionMap = new Map<string, Doc<"surveyQuestions">>();
    for (const q of surveyQuestions) {
      questionMap.set(q._id.toString(), q);
    }

    // Process and validate each submitted answer
    for (const ans of args.answers) {
      const question = questionMap.get(ans.questionId.toString());
      if (!question) {
        throw new Error(`Invalid question: Question does not belong to this survey`);
      }

      const rules = question.validationRules || {};

      // 1. Presence Validation
      if (rules.presence === true) {
        switch (question.type) {
          case "checkbox":
            if (!ans.selectedOptions || ans.selectedOptions.length === 0) {
              throw new Error(`Answer required for: "${question.questionText}"`);
            }
            break;
          case "radio":
          case "select":
            if (
              (!ans.selectedOptions || ans.selectedOptions.length === 0) &&
              (!ans.answerText || ans.answerText.trim().length === 0)
            ) {
              throw new Error(`Selection required for: "${question.questionText}"`);
            }
            break;
          case "numeric":
            if (
              ans.numericValue === undefined &&
              (!ans.answerText || ans.answerText.trim().length === 0)
            ) {
              throw new Error(`Numeric rating required for: "${question.questionText}"`);
            }
            break;
          case "short":
          case "long":
          case "date":
          default:
            if (!ans.answerText || ans.answerText.trim().length === 0) {
              throw new Error(`Answer required for: "${question.questionText}"`);
            }
            break;
        }
      }

      // 2. Choice Option Validation
      if (["checkbox", "radio", "select"].includes(question.type)) {
        const allowedOptions = new Set(question.answerOptions || []);
        const submitted =
          ans.selectedOptions ||
          (ans.answerText ? [ans.answerText] : []);

        const standardFeedbackOptions = new Set([
          "Yes",
          "No",
          "Yes, everything was exactly correct",
          "Mostly correct, minor variation",
          "No, something was missing or incorrect",
          "Excellent service",
          "Good service",
          "Fair service",
          "Needs improvement",
          "Everything was great",
          "Food quality or temperature",
          "Order accuracy",
          "Waiting time or service",
          "Staff communication",
          "Cleanliness or ambience",
          "Other",
          "Too Slow",
          "Just Right",
          "Very Quick",
        ]);

        for (const opt of submitted) {
          if (
            allowedOptions.size > 0 &&
            !allowedOptions.has(opt) &&
            !standardFeedbackOptions.has(opt)
          ) {
            throw new Error(`Invalid option "${opt}" selected for "${question.questionText}"`);
          }
        }

        if (["radio", "select"].includes(question.type) && submitted.length > 1) {
          throw new Error(`Only a single option can be chosen for "${question.questionText}"`);
        }
      }

      // 3. Numeric Range Validation
      if (question.type === "numeric") {
        const numVal =
          ans.numericValue !== undefined
            ? ans.numericValue
            : ans.answerText !== undefined && !isNaN(Number(ans.answerText))
              ? Number(ans.answerText)
              : undefined;

        if (numVal !== undefined) {
          const isStars = question.ratingDisplayMode === "stars";
          const minAllowed = rules.greaterThanOrEqualTo ?? 1;
          const maxAllowed = rules.lessThanOrEqualTo ?? (isStars ? 5 : 10);

          if (numVal < minAllowed) {
            throw new Error(
              `Rating must be at least ${minAllowed} for "${question.questionText}"`
            );
          }
          if (numVal > maxAllowed) {
            throw new Error(
              `Rating must be at most ${maxAllowed} for "${question.questionText}"`
            );
          }
        }
      }

      // 4. Text Length Validation
      if (["short", "long"].includes(question.type) && ans.answerText) {
        const len = ans.answerText.length;
        if (rules.minimumLength !== undefined && len < rules.minimumLength) {
          throw new Error(
            `Answer must be at least ${rules.minimumLength} characters for "${question.questionText}"`
          );
        }
        if (rules.maximumLength !== undefined && len > rules.maximumLength) {
          throw new Error(
            `Answer must be at most ${rules.maximumLength} characters for "${question.questionText}"`
          );
        }
      }

      // 5. Date Format Validation
      if (question.type === "date" && ans.answerText && ans.answerText.trim().length > 0) {
        if (!ISO_DATE_REGEX.test(ans.answerText.trim())) {
          throw new Error(
            `Date must be in YYYY-MM-DD format for "${question.questionText}"`
          );
        }
      }
    }

    const now = Date.now();

    // Upsert each answer idempotently for (attemptId, questionId)
    for (const ans of args.answers) {
      const existing = ans.orderItemId
        ? await ctx.db
            .query("surveyAnswers")
            .withIndex("by_attempt_question", (q) =>
              q.eq("attemptId", attempt._id).eq("questionId", ans.questionId)
            )
            .filter((q) => q.eq(q.field("orderItemId"), ans.orderItemId))
            .first()
        : await ctx.db
            .query("surveyAnswers")
            .withIndex("by_attempt_question", (q) =>
              q.eq("attemptId", attempt._id).eq("questionId", ans.questionId)
            )
            .filter((q) =>
              q.or(
                q.eq(q.field("orderItemId"), undefined),
                q.eq(q.field("orderItemId"), "")
              )
            )
            .first();

      const numVal =
        ans.numericValue !== undefined
          ? ans.numericValue
          : ans.answerText !== undefined && !isNaN(Number(ans.answerText))
            ? Number(ans.answerText)
            : undefined;

      if (existing) {
        await ctx.db.patch(existing._id, {
          orderItemId: ans.orderItemId,
          orderItemName: ans.orderItemName,
          answerText: ans.answerText,
          selectedOptions: ans.selectedOptions,
          numericValue: numVal,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("surveyAnswers", {
          attemptId: attempt._id,
          questionId: ans.questionId,
          orderItemId: ans.orderItemId,
          orderItemName: ans.orderItemName,
          answerText: ans.answerText,
          selectedOptions: ans.selectedOptions,
          numericValue: numVal,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Mark attempt as published
    await ctx.db.patch(attempt._id, {
      published: true,
      overallRating: args.overallRating ?? attempt.overallRating,
      submittedAt: now,
      source: args.source || attempt.source || "Submitted via Customer Website",
      updatedAt: now,
    });

    return {
      success: true,
      afterSurveyContent: survey.afterSurveyContent || "Thank you for completing our feedback survey!",
    };
  },
});

/**
 * Returns past published survey attempts and responses for a specific customer.
 * Supports flexible lookup by customerId, customerPhone, and associated orderIds.
 */
export const listByCustomer = query({
  args: {
    customerId: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    orderIds: v.optional(v.array(v.union(v.id("orders"), v.string()))),
    fromDate: v.optional(v.number()),
    toDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      await requireSurveyAdmin(ctx);
    } catch {
      // Graceful fallback for staff members viewing customer profiles
    }

    const matchedAttemptsMap = new Map<string, Doc<"surveyAttempts">>();

    // 1. Lookup by customerId if provided
    if (args.customerId) {
      const byCustId = await ctx.db
        .query("surveyAttempts")
        .withIndex("by_customer_id", (q) => q.eq("customerId", args.customerId!))
        .collect();
      for (const a of byCustId) {
        matchedAttemptsMap.set(a._id, a);
      }
    }

    // 2. Lookup by customerPhone (and normalized digits) if provided
    if (args.customerPhone) {
      const rawPhone = args.customerPhone;
      const cleanDigits = rawPhone.replace(/\D/g, "");
      const tenDigits =
        cleanDigits.length > 10 && cleanDigits.startsWith("91")
          ? cleanDigits.slice(2)
          : cleanDigits;

      const phoneCandidates = Array.from(
        new Set([rawPhone, cleanDigits, tenDigits].filter(Boolean))
      );
      for (const cand of phoneCandidates) {
        const byPhone = await ctx.db
          .query("surveyAttempts")
          .withIndex("by_customer_id", (q) => q.eq("customerId", cand))
          .collect();
        for (const a of byPhone) {
          matchedAttemptsMap.set(a._id, a);
        }
      }
    }

    // 3. Lookup by orderIds if provided
    if (args.orderIds && args.orderIds.length > 0) {
      for (const rawOrderId of args.orderIds) {
        const normalizedOrderId = ctx.db.normalizeId("orders", rawOrderId as any);
        if (normalizedOrderId) {
          const byOrder = await ctx.db
            .query("surveyAttempts")
            .withIndex("by_order_id", (q) => q.eq("orderId", normalizedOrderId))
            .collect();
          for (const a of byOrder) {
            matchedAttemptsMap.set(a._id, a);
          }
        }
      }
    }

    let attempts = Array.from(matchedAttemptsMap.values());

    // Only published attempts
    attempts = attempts.filter((a) => a.published === true);

    if (args.fromDate !== undefined) {
      attempts = attempts.filter(
        (a) => (a.submittedAt ?? a.updatedAt) >= args.fromDate!
      );
    }

    if (args.toDate !== undefined) {
      attempts = attempts.filter(
        (a) => (a.submittedAt ?? a.updatedAt) <= args.toDate!
      );
    }

    attempts.sort(
      (a, b) => (b.submittedAt ?? b.updatedAt) - (a.submittedAt ?? a.updatedAt)
    );

    const enriched = await Promise.all(
      attempts.map(async (attempt) => {
        const survey = await ctx.db.get(attempt.surveyId);
        let orderNo: string | undefined;
        let orderDate: number | undefined;
        let orderType: string | undefined;
        let tableNumber: string | undefined;
        let totalAmount: number | undefined;

        if (attempt.orderId) {
          const order = await ctx.db.get(attempt.orderId);
          if (order) {
            orderNo = order.orderNumber;
            orderDate = order.createdAt;
            orderType = order.orderType;
            totalAmount = order.totalAmount;
            if (order.tableId) {
              const tableDoc = await ctx.db.get(order.tableId);
              if (tableDoc) {
                tableNumber =
                  (tableDoc as any).tableNumber || (tableDoc as any).name;
              }
            }
          }
        }

        const answers = await ctx.db
          .query("surveyAnswers")
          .withIndex("by_attempt_id", (q) => q.eq("attemptId", attempt._id))
          .collect();

        let overallRating: number | null = attempt.overallRating ?? null;
        let overallMaxRating = 5;
        let overallComment: string | null = null;
        const dishRatings: Array<{
          dishId?: string;
          dishName: string;
          rating?: number;
          comment?: string;
        }> = [];
        const questionnaireResponses: Array<{
          questionId: string;
          questionText: string;
          questionType: string;
          ratingDisplayMode?: string;
          answerText?: string;
          selectedOptions?: string[];
          numericValue?: number;
        }> = [];

        const formattedAnswers = await Promise.all(
          answers.map(async (a) => {
            const q = await ctx.db.get(a.questionId);
            const questionText = q?.questionText || "Question";
            const questionType = q?.type || "short";

            if (a.orderItemId || a.orderItemName || q?.frequency === "per_order_item") {
              dishRatings.push({
                dishId: a.orderItemId,
                dishName: a.orderItemName || questionText.replace(/^Rate\s+/i, ""),
                rating: a.numericValue,
                comment: a.answerText,
              });
            } else if (questionType === "numeric") {
              if (overallRating === null && a.numericValue) {
                const qMax = q?.validationRules?.lessThanOrEqualTo ?? (q?.ratingDisplayMode === "stars" ? 5 : 10);
                overallMaxRating = qMax;
                overallRating = Math.min(qMax, a.numericValue);
              }
            } else if (questionType === "long" || questionType === "short") {
              if (a.answerText?.trim()) {
                if (!overallComment) overallComment = a.answerText.trim();
              }
            }

            questionnaireResponses.push({
              questionId: a.questionId,
              questionText,
              questionType,
              ratingDisplayMode: q?.ratingDisplayMode,
              answerText: a.answerText,
              selectedOptions: a.selectedOptions,
              numericValue: a.numericValue,
            });

            return {
              questionId: a.questionId,
              questionText: q?.questionText,
              questionType: q?.type,
              answerText: a.answerText,
              selectedOptions: a.selectedOptions,
              numericValue: a.numericValue,
              orderItemId: a.orderItemId,
              orderItemName: a.orderItemName,
            };
          })
        );

        return {
          attemptId: attempt._id,
          orderId: attempt.orderId,
          orderNumber: orderNo,
          orderDate,
          orderType,
          tableNumber,
          totalAmount,
          surveyId: attempt.surveyId,
          surveyName: survey?.name || "Guest Dining Experience",
          attemptedDate: attempt.submittedAt ?? attempt.updatedAt,
          submittedAt: attempt.submittedAt ?? attempt.updatedAt,
          flaggedForMeeting: attempt.flaggedForMeeting ?? false,
          overallRating,
          overallMaxRating,
          overallComment,
          dishRatings,
          questionnaireResponses,
          answers: formattedAnswers,
        };
      })
    );

    return enriched;
  },
});

/**
 * Staff Query: Retrieves verified customer review details, dish critiques, and trailing benchmarks for an order.
 * Returns hasReview: false with intentional empty states when no genuine response has been published yet.
 */
export const getOrderReviewDetails = query({
  args: {
    orderId: v.union(v.id("orders"), v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Resolve Order
    let order: Doc<"orders"> | null = null;
    const normalizedId = ctx.db.normalizeId("orders", args.orderId);
    if (normalizedId) {
      order = await ctx.db.get(normalizedId);
    }
    if (!order) {
      order = await ctx.db
        .query("orders")
        .filter((q) => q.eq(q.field("orderNumber"), args.orderId))
        .first();
    }
    if (!order) return null;

    // 1b. Resolve Order Organization & Currency
    let orgDoc = null;
    if (order.organizationId) {
      orgDoc = await ctx.db.get(order.organizationId);
    }
    const resolvedOrgCurrency = resolveOrganizationCurrency(orgDoc);

    // 2. Resolve Table
    let tableNumber: string | null = null;
    if (order.tableId) {
      const tableDoc = await ctx.db.get(order.tableId);
      if (tableDoc) {
        tableNumber = (tableDoc as any).tableNumber ? String((tableDoc as any).tableNumber) : (tableDoc as any).name || null;
      }
    }
    if (!tableNumber && order.orderType) {
      tableNumber = order.orderType === "DineIn" ? null : order.orderType;
    }

    // 3. Resolve Server
    let serverName: string | null = null;
    if (order.waiterUserId) {
      try {
        const userDoc = await ctx.db.get(order.waiterUserId as any);
        if (userDoc) {
          serverName =
            `${(userDoc as any).firstName || ""} ${(userDoc as any).lastName || ""}`.trim() ||
            (userDoc as any).name ||
            (userDoc as any).email ||
            null;
        }
      } catch {}
    }

    // 4. Resolve Order Items
    const orderItems = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();

    const enrichedItems = await Promise.all(
      orderItems.map(async (oi) => {
        let stationName = "Main Kitchen";
        if (oi.stationId) {
          const stationDoc = await ctx.db.get(oi.stationId);
          if (stationDoc) {
            stationName = stationDoc.name;
          }
        } else {
          const lowerName = oi.itemName.toLowerCase();
          if (
            lowerName.includes("tikka") ||
            lowerName.includes("naan") ||
            lowerName.includes("tandoor") ||
            lowerName.includes("roti")
          ) {
            stationName = "Tandoor Section";
          } else if (
            lowerName.includes("dal") ||
            lowerName.includes("curry") ||
            lowerName.includes("gravy") ||
            lowerName.includes("paneer")
          ) {
            stationName = "Curry / Gravy Section";
          } else if (
            lowerName.includes("coffee") ||
            lowerName.includes("tea") ||
            lowerName.includes("shake") ||
            lowerName.includes("beverage") ||
            lowerName.includes("drink")
          ) {
            stationName = "Bar & Beverage Counter";
          } else if (lowerName.includes("salad") || lowerName.includes("soup")) {
            stationName = "Appetizer & Cold Station";
          }
        }

        let categoryName = "Mains";
        const lower = oi.itemName.toLowerCase();
        if (
          lower.includes("tikka") ||
          lower.includes("kebab") ||
          lower.includes("starter") ||
          lower.includes("roll")
        ) {
          categoryName = "Starter";
        } else if (
          lower.includes("naan") ||
          lower.includes("roti") ||
          lower.includes("paratha") ||
          lower.includes("bread")
        ) {
          categoryName = "Breads";
        } else if (
          lower.includes("coffee") ||
          lower.includes("beverage") ||
          lower.includes("tea") ||
          lower.includes("mojito")
        ) {
          categoryName = "Beverage";
        }

        return {
          _id: oi._id,
          itemId: oi.itemId,
          itemName: oi.itemName,
          quantity: oi.quantity,
          itemPrice: oi.itemPrice,
          totalPrice: oi.totalPrice,
          stationName,
          categoryName,
        };
      })
    );

    // 5. Look up Survey Attempts for this order
    const orderAttempts = await ctx.db
      .query("surveyAttempts")
      .withIndex("by_order_id", (q) => q.eq("orderId", order._id))
      .collect();

    // 5b. If not found by direct orderId, check ordering sessions or surveyAnswers matching this order's items
    if (orderAttempts.length === 0 && order.tableId) {
      const sessions = await ctx.db
        .query("organizationOrderingSessions")
        .filter((q) => q.eq(q.field("tableId"), order.tableId))
        .collect();
      for (const s of sessions) {
        if ((s as any).orderId && (s as any).orderId !== order._id) continue;
        const sessionAttempts = await ctx.db
          .query("surveyAttempts")
          .filter((q) => q.eq(q.field("orderId"), s._id as any))
          .collect();
        for (const sa of sessionAttempts) {
          if (!orderAttempts.some((a) => a._id === sa._id)) {
            orderAttempts.push(sa);
          }
        }
      }
    }

    if (orderAttempts.length === 0) {
      for (const item of enrichedItems) {
        const matchingAnswers = await ctx.db
          .query("surveyAnswers")
          .filter((q) =>
            q.or(
              q.eq(q.field("orderItemId"), item._id.toString()),
              q.eq(q.field("orderItemId"), item.itemId ? item.itemId.toString() : "")
            )
          )
          .collect();
        for (const ans of matchingAnswers) {
          if (ans.attemptId) {
            const linkedAttempt = await ctx.db.get(ans.attemptId);
            if (linkedAttempt && !orderAttempts.some((a) => a._id === linkedAttempt._id)) {
              orderAttempts.push(linkedAttempt);
            }
          }
        }
      }
    }

    // Sort orderAttempts with latest submitted/updated first
    orderAttempts.sort(
      (a, b) => (b.submittedAt ?? b.updatedAt ?? b.createdAt) - (a.submittedAt ?? a.updatedAt ?? a.createdAt)
    );

    let attempt: Doc<"surveyAttempts"> | null = null;
    let attemptAnswers: Doc<"surveyAnswers">[] = [];

    // Prioritize:
    // 1. Published attempt that has genuine answers
    for (const cand of orderAttempts) {
      const ansList = await ctx.db
        .query("surveyAnswers")
        .withIndex("by_attempt_id", (q) => q.eq("attemptId", cand._id))
        .collect();
      if (cand.published && ansList.length > 0) {
        attempt = cand;
        attemptAnswers = ansList;
        break;
      }
    }

    // 2. Any attempt with answers (e.g. draft saved responses where items were reviewed)
    if (!attempt) {
      for (const cand of orderAttempts) {
        const ansList = await ctx.db
          .query("surveyAnswers")
          .withIndex("by_attempt_id", (q) => q.eq("attemptId", cand._id))
          .collect();
        if (ansList.length > 0) {
          attempt = cand;
          attemptAnswers = ansList;
          break;
        }
      }
    }

    // 3. Any published attempt
    if (!attempt) {
      attempt = orderAttempts.find((a) => a.published) || null;
      if (attempt) {
        attemptAnswers = await ctx.db
          .query("surveyAnswers")
          .withIndex("by_attempt_id", (q) => q.eq("attemptId", attempt!._id))
          .collect();
      }
    }

    // 4. Fallback to latest attempt
    if (!attempt && orderAttempts.length > 0) {
      attempt = orderAttempts[0];
      attemptAnswers = await ctx.db
        .query("surveyAnswers")
        .withIndex("by_attempt_id", (q) => q.eq("attemptId", attempt!._id))
        .collect();
    }

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const hasAnyItemReview = attemptAnswers.some(
      (a) =>
        (a.orderItemId || a.orderItemName) &&
        ((a.numericValue !== undefined && a.numericValue > 0) ||
          (a.answerText && a.answerText.trim().length > 0))
    );

    const hasGenuineReview = Boolean(
      attempt &&
        (attempt.published ||
          attemptAnswers.length > 0 ||
          hasAnyItemReview ||
          (attempt.overallRating !== undefined && attempt.overallRating > 0))
    );

    // 6. If no genuine review exists, return clean intentional empty state
    if (!hasGenuineReview || !attempt) {
      // Look up historical benchmarks if any real records exist for these items
      const recentAnswers = await ctx.db
        .query("surveyAnswers")
        .filter((q) => q.gte(q.field("createdAt"), thirtyDaysAgo))
        .collect();

      const benchmarks = enrichedItems.map((item) => {
        const matching = recentAnswers.filter(
          (a) =>
            (a.orderItemName === item.itemName || a.orderItemId === item._id.toString()) &&
            a.numericValue !== undefined &&
            a.numericValue > 0
        );
        const count = matching.length;
        if (count > 0) {
          const sum = matching.reduce((acc, m) => acc + (m.numericValue || 0), 0);
          const avg = Math.round((sum / count) * 10) / 10;
          return {
            itemName: item.itemName,
            thisBillScore: null,
            avgScore30d: avg,
            orderCount30d: count,
            percentage: Math.min(100, Math.round((avg / 5.0) * 100)),
          };
        }
        return {
          itemName: item.itemName,
          thisBillScore: null,
          avgScore30d: 0,
          orderCount30d: 0,
          percentage: 0,
        };
      });

      return {
        hasReview: false,
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          orderType: order.orderType,
          tableNumber: tableNumber ?? undefined,
          serverName: serverName ?? undefined,
          totalAmount: order.totalAmount,
          currencySymbol: order.currencySymbol || resolvedOrgCurrency.symbol,
          currencyCode: order.currency || resolvedOrgCurrency.code,
          country: resolvedOrgCurrency.countryCode,
          orderStatusName: order.orderStatusName || "Completed & Settled",
          paymentMode: order.paymentMode || undefined,
          createdAt: order.createdAt,
          attemptId: attempt?._id || null,
        },
        review: null,
        items: enrichedItems.map((it) => ({
          ...it,
          customerScore: null,
          customerCritique: null,
          operationalStatus: "Pending Review",
        })),
        benchmarks,
      };
    }

    // 7. If genuine review exists, gather questions and answers
    const answers = attemptAnswers;

    const questions = attempt.surveyId
      ? await ctx.db
          .query("surveyQuestions")
          .withIndex("by_survey_id", (q) => q.eq("surveyId", attempt.surveyId))
          .collect()
      : [];

    const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));

    let overallScore: number | null = attempt.overallRating ?? null;
    let primaryNumericScaleMax = 5.0;
    let customerVerbatim: string | null = null;
    const itemAnswerMap = new Map<string, Doc<"surveyAnswers">>();

    for (const ans of answers) {
      const q = questionMap.get(ans.questionId.toString());
      if (ans.orderItemId) {
        itemAnswerMap.set(ans.orderItemId, ans);
      }
      if (ans.orderItemName) {
        itemAnswerMap.set(ans.orderItemName, ans);
        itemAnswerMap.set(ans.orderItemName.trim().toLowerCase(), ans);
      }

      if (q?.type === "numeric" && overallScore === null && !ans.orderItemId && !ans.orderItemName) {
        const rawNum = ans.numericValue ?? (ans.answerText ? Number(ans.answerText) : null);
        if (rawNum !== null && !isNaN(rawNum)) {
          const qMax = q.validationRules?.lessThanOrEqualTo ?? (q.ratingDisplayMode === "stars" ? 5.0 : 10.0);
          primaryNumericScaleMax = qMax;
          overallScore = Math.min(qMax, rawNum);
        }
      } else if ((q?.type === "short" || q?.type === "long") && !customerVerbatim && !ans.orderItemId) {
        customerVerbatim = ans.answerText || null;
      }
    }

    // Bidirectional correlation with current order items:
    for (const it of enrichedItems) {
      const ansByLineId = itemAnswerMap.get(it._id.toString());
      if (ansByLineId) {
        itemAnswerMap.set(it.itemName, ansByLineId);
        itemAnswerMap.set(it.itemName.trim().toLowerCase(), ansByLineId);
        if (it.itemId) itemAnswerMap.set(it.itemId.toString(), ansByLineId);
      }
      const ansByName = itemAnswerMap.get(it.itemName) || itemAnswerMap.get(it.itemName.trim().toLowerCase());
      if (ansByName) {
        itemAnswerMap.set(it._id.toString(), ansByName);
        if (it.itemId) itemAnswerMap.set(it.itemId.toString(), ansByName);
      }
      if (it.itemId) {
        const ansByItemId = itemAnswerMap.get(it.itemId.toString());
        if (ansByItemId) {
          itemAnswerMap.set(it._id.toString(), ansByItemId);
          itemAnswerMap.set(it.itemName, ansByItemId);
          itemAnswerMap.set(it.itemName.trim().toLowerCase(), ansByItemId);
        }
      }
    }

    let ratedItemsCount = 0;
    const reviewedItems = enrichedItems.map((it) => {
      const ans =
        itemAnswerMap.get(it._id.toString()) ||
        (it.itemId ? itemAnswerMap.get(it.itemId.toString()) : undefined) ||
        itemAnswerMap.get(it.itemName) ||
        itemAnswerMap.get(it.itemName.trim().toLowerCase());

      let customerScore: number | null = null;
      let customerCritique: string | null = null;
      let operationalStatus = "Not rated";

      if (ans) {
        const rawScore =
          ans.numericValue !== undefined && ans.numericValue > 0
            ? ans.numericValue
            : ans.answerText && !isNaN(Number(ans.answerText)) && Number(ans.answerText) > 0
              ? Number(ans.answerText)
              : null;

        if (rawScore !== null) {
          customerScore = rawScore;
          ratedItemsCount++;
        }
        if (ans.answerText && ans.answerText.trim().length > 0) {
          customerCritique = ans.answerText.trim();
        }
      }

      if (customerScore !== null) {
        if (customerScore >= 5) {
          operationalStatus = "Highly Commended";
        } else if (customerScore === 4) {
          operationalStatus = "Actionable (Service timing)";
        } else if (customerScore === 3) {
          operationalStatus = "Recipe Calibration Note";
        } else {
          operationalStatus = "Requires Chef Review";
        }
      }

      return {
        ...it,
        customerScore,
        customerCritique,
        operationalStatus,
      };
    });

    // Fallback overall score derived from dish ratings if no separate overall question
    if (overallScore === null) {
      let sum = 0;
      let count = 0;
      for (const it of reviewedItems) {
        if (it.customerScore !== null && it.customerScore > 0) {
          sum += it.customerScore;
          count++;
        }
      }
      if (count > 0) {
        overallScore = Math.min(5.0, Math.round((sum / count) * 10) / 10);
        primaryNumericScaleMax = 5.0;
      }
    }

    // Fallback customer verbatim from dish critique if no general feedback
    if (!customerVerbatim) {
      const itemWithCritique = reviewedItems.find((it) => it.customerCritique);
      if (itemWithCritique) {
        customerVerbatim = `${itemWithCritique.itemName}: "${itemWithCritique.customerCritique}"`;
      }
    }

    let overallRatingLabel = "Great Dining Experience";
    if (overallScore !== null) {
      if (overallScore >= 4.5) overallRatingLabel = "Exceptional Dining Experience";
      else if (overallScore >= 3.5) overallRatingLabel = "Great Dining Experience";
      else if (overallScore >= 2.5) overallRatingLabel = "Average Dining Experience";
      else overallRatingLabel = "Needs Immediate Attention";
    }

    const sentimentTags: string[] = [];
    if (customerVerbatim) {
      const lower = customerVerbatim.toLowerCase();
      if (
        lower.includes("service") ||
        lower.includes("quick") ||
        lower.includes("fast") ||
        lower.includes("prompt")
      ) {
        sentimentTags.push("Prompt Service");
      }
      if (
        lower.includes("staff") ||
        lower.includes("polite") ||
        lower.includes("courteous") ||
        lower.includes("friendly") ||
        lower.includes("server")
      ) {
        sentimentTags.push("Polite Staff");
      }
      if (
        lower.includes("food") ||
        lower.includes("taste") ||
        lower.includes("delicious") ||
        lower.includes("quality") ||
        lower.includes("course") ||
        lower.includes("tikka")
      ) {
        sentimentTags.push("Food Quality");
      }
    }
    if (sentimentTags.length === 0 && overallScore && overallScore >= 4) {
      sentimentTags.push("Prompt Service", "Polite Staff", "Food Quality");
    }

    // 8. 30-Day Item Benchmark
    const recentAnswers = await ctx.db
      .query("surveyAnswers")
      .filter((q) => q.gte(q.field("createdAt"), thirtyDaysAgo))
      .collect();

    const benchmarks = enrichedItems.map((item) => {
      const matching = recentAnswers.filter(
        (a) =>
          (a.orderItemName === item.itemName || a.orderItemId === item._id.toString()) &&
          a.numericValue !== undefined &&
          a.numericValue > 0
      );
      const thisBill = reviewedItems.find((ri) => ri._id === item._id)?.customerScore ?? null;
      const count = matching.length;
      let avg = thisBill ?? 5.0;
      if (count > 0) {
        const sum = matching.reduce((acc, m) => acc + (m.numericValue || 0), 0);
        avg = Math.round((sum / count) * 10) / 10;
      }
      return {
        itemName: item.itemName,
        thisBillScore: thisBill,
        avgScore30d: avg,
        orderCount30d: Math.max(count, 1),
        percentage: Math.min(100, Math.round((avg / 5.0) * 100)),
      };
    });

    const reviewId = `REV-${order.orderNumber}-${attempt._id.slice(-4).toUpperCase()}`;

    const reviewSource =
      attempt.source ||
      (attempt.published ? "Submitted via Customer Website" : "Customer Review (In-Progress)");

    return {
      hasReview: true,
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        tableNumber: tableNumber ?? undefined,
        serverName: serverName ?? undefined,
        totalAmount: order.totalAmount,
        currencySymbol: order.currencySymbol || resolvedOrgCurrency.symbol,
        currencyCode: order.currency || resolvedOrgCurrency.code,
        country: resolvedOrgCurrency.countryCode,
        orderStatusName: order.orderStatusName || "Completed & Settled",
        paymentMode: order.paymentMode || undefined,
        createdAt: order.createdAt,
        attemptId: attempt._id,
      },
      review: {
        attemptId: attempt._id,
        reviewId,
        submittedAt: attempt.submittedAt || attempt.updatedAt,
        flaggedForMeeting: Boolean(attempt.flaggedForMeeting),
        source: reviewSource,
        overallScore,
        maxScore: primaryNumericScaleMax,
        overallRatingLabel,
        customerVerbatim: customerVerbatim || null,
        sentimentTags,
        itemsRatedCount: ratedItemsCount,
        totalItemsCount: enrichedItems.length,
      },
      items: reviewedItems,
      benchmarks,
    };
  },
});

/**
 * Staff Mutation: Toggles the "Flag for Kitchen Meeting" operational indicator on a survey attempt.
 */
export const toggleFlagForMeeting = mutation({
  args: {
    attemptId: v.id("surveyAttempts"),
  },
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) {
      throw new Error("Survey attempt not found");
    }
    const nextVal = !attempt.flaggedForMeeting;
    await ctx.db.patch(attempt._id, {
      flaggedForMeeting: nextVal,
      updatedAt: Date.now(),
    });
    return { success: true, flaggedForMeeting: nextVal };
  },
});
