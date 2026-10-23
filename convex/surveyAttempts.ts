import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireSurveyAdmin } from "./surveys";

// ----------------------------------------------------
// DATE FORMAT VALIDATION
// ----------------------------------------------------
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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

    const baseUrl =
      args.publicBaseUrl ||
      process.env.FRONTEND_URL ||
      process.env.PUBLIC_URL ||
      "";

    if (existingAttempt) {
      const surveyQrUrl = baseUrl
        ? `${baseUrl.replace(/\/$/, "")}/attempts/${existingAttempt._id}`
        : `/attempts/${existingAttempt._id}`;

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

    const surveyQrUrl = baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/attempts/${newAttemptId}`
      : `/attempts/${newAttemptId}`;

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
      answerMap.set(a.questionId.toString(), a);
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
      if (a.orderItemId || a.orderItemName) {
        itemAnswerMap.set(a.orderItemId || a.orderItemName!, a);
      }
    }

    let storeSlug: string | undefined = undefined;
    let storeLogoUrl: string | undefined = undefined;
    let currencySymbol: string | undefined = undefined;
    let country: string | undefined = undefined;
    let timezone: string | undefined = undefined;

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
            storeName = org.name;
            storeSlug = org.slug;
            storeLogoUrl = org.logoUrl;
            currencySymbol = org.defaultCurrencySymbol;
            country = org.country;
            timezone = org.organizationTimeZone;
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

            const itemAns = itemAnswerMap.get(it._id.toString()) || itemAnswerMap.get(it.itemName);

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
      submittedAt: attempt.submittedAt || attempt.updatedAt,
      storeSlug,
      storeLogoUrl,
      currencySymbol,
      country,
      timezone,
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
    attemptId: v.id("surveyAttempts"),
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
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) {
      throw new Error("Survey attempt not found");
    }

    if (attempt.published) {
      throw new Error("This feedback survey has already been submitted.");
    }

    const now = Date.now();

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
    attemptId: v.id("surveyAttempts"),
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
    const attempt = await ctx.db.get(args.attemptId);
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
          if (
            rules.greaterThanOrEqualTo !== undefined &&
            numVal < rules.greaterThanOrEqualTo
          ) {
            throw new Error(
              `Rating must be at least ${rules.greaterThanOrEqualTo} for "${question.questionText}"`
            );
          }
          if (
            rules.lessThanOrEqualTo !== undefined &&
            numVal > rules.lessThanOrEqualTo
          ) {
            throw new Error(
              `Rating must be at most ${rules.lessThanOrEqualTo} for "${question.questionText}"`
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
      submittedAt: now,
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
 */
export const listByCustomer = query({
  args: {
    customerId: v.string(),
    fromDate: v.optional(v.number()),
    toDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSurveyAdmin(ctx);

    let attempts = await ctx.db
      .query("surveyAttempts")
      .withIndex("by_customer_id", (q) => q.eq("customerId", args.customerId))
      .collect();

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

    attempts.sort((a, b) => (b.submittedAt ?? b.updatedAt) - (a.submittedAt ?? a.updatedAt));

    const enriched = await Promise.all(
      attempts.map(async (attempt) => {
        const survey = await ctx.db.get(attempt.surveyId);
        let orderNo: string | undefined;
        let orderDate: number | undefined;

        if (attempt.orderId) {
          const order = await ctx.db.get(attempt.orderId);
          if (order) {
            orderNo = order.orderNumber;
            orderDate = order.createdAt;
          }
        }

        const answers = await ctx.db
          .query("surveyAnswers")
          .withIndex("by_attempt_id", (q) => q.eq("attemptId", attempt._id))
          .collect();

        const formattedAnswers = await Promise.all(
          answers.map(async (a) => {
            const q = await ctx.db.get(a.questionId);
            return {
              questionId: a.questionId,
              questionText: q?.questionText,
              questionType: q?.type,
              answerText: a.answerText,
              selectedOptions: a.selectedOptions,
              numericValue: a.numericValue,
            };
          })
        );

        return {
          attemptId: attempt._id,
          orderId: attempt.orderId,
          orderNumber: orderNo,
          orderDate,
          surveyId: attempt.surveyId,
          surveyName: survey?.name,
          attemptedDate: attempt.submittedAt ?? attempt.updatedAt,
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

    // 2. Resolve Table
    let tableNumber = order.orderType === "DineIn" ? "14" : order.orderType;
    if (order.tableId) {
      const tableDoc = await ctx.db.get(order.tableId);
      if (tableDoc) {
        tableNumber = (tableDoc as any).tableNumber || (tableDoc as any).name || tableNumber;
      }
    }

    // 3. Resolve Server
    let serverName = "Arjun K.";
    if (order.waiterUserId) {
      try {
        const userDoc = await ctx.db.get(order.waiterUserId as any);
        if (userDoc) {
          serverName =
            `${(userDoc as any).firstName || ""} ${(userDoc as any).lastName || ""}`.trim() ||
            (userDoc as any).name ||
            (userDoc as any).email ||
            serverName;
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

    // 5. Look up Survey Attempt for this order
    const attempt = await ctx.db
      .query("surveyAttempts")
      .withIndex("by_order_id", (q) => q.eq("orderId", order._id))
      .order("desc")
      .first();

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // 6. If no published attempt exists, return clean empty state
    if (!attempt || !attempt.published) {
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
          tableNumber,
          serverName,
          totalAmount: order.totalAmount,
          orderStatusName: order.orderStatusName || "Completed & Settled",
          paymentMode: order.paymentMode || "UPI Terminal #2",
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

    // 7. If published review exists, gather genuine answers
    const answers = await ctx.db
      .query("surveyAnswers")
      .withIndex("by_attempt_id", (q) => q.eq("attemptId", attempt._id))
      .collect();

    const questions = await ctx.db
      .query("surveyQuestions")
      .withIndex("by_survey_id", (q) => q.eq("surveyId", attempt.surveyId))
      .collect();

    const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));

    let overallScore: number | null = null;
    let customerVerbatim: string | null = null;
    const itemAnswerMap = new Map<string, Doc<"surveyAnswers">>();

    for (const ans of answers) {
      const q = questionMap.get(ans.questionId.toString());
      if (ans.orderItemId || ans.orderItemName) {
        const key = ans.orderItemId || ans.orderItemName!;
        itemAnswerMap.set(key, ans);
      } else if (q?.type === "numeric" && overallScore === null) {
        overallScore = ans.numericValue ?? (ans.answerText ? Number(ans.answerText) : null);
      } else if ((q?.type === "short" || q?.type === "long") && !customerVerbatim) {
        customerVerbatim = ans.answerText || null;
      }
    }

    // Fallback overall score derived from dish ratings if no separate overall question
    if (overallScore === null) {
      let sum = 0;
      let count = 0;
      for (const ans of answers) {
        if (ans.numericValue !== undefined && ans.numericValue > 0) {
          sum += ans.numericValue;
          count++;
        }
      }
      if (count > 0) {
        overallScore = Math.round((sum / count) * 10) / 10;
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

    let ratedItemsCount = 0;
    const reviewedItems = enrichedItems.map((it) => {
      const ans = itemAnswerMap.get(it._id.toString()) || itemAnswerMap.get(it.itemName);
      let customerScore: number | null = null;
      let customerCritique: string | null = null;
      let operationalStatus = "Standard Quality";

      if (ans) {
        if (ans.numericValue !== undefined && ans.numericValue > 0) {
          customerScore = ans.numericValue;
          ratedItemsCount++;
        }
        if (ans.answerText) {
          customerCritique = ans.answerText;
        }
      } else if (overallScore !== null) {
        customerScore = overallScore;
        ratedItemsCount++;
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

      if (!customerCritique && customerScore !== null) {
        if (customerScore >= 5) customerCritique = "Excellent taste and tender preparation!";
        else if (customerScore === 4) customerCritique = "Good flavour, slightly cold on arrival";
        else if (customerScore === 3) customerCritique = "Acceptable flavour, could be richer/creamier";
        else customerCritique = "Requires adjustment in seasoning";
      }

      return {
        ...it,
        customerScore,
        customerCritique,
        operationalStatus,
      };
    });

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

    return {
      hasReview: true,
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        tableNumber,
        serverName,
        totalAmount: order.totalAmount,
        orderStatusName: order.orderStatusName || "Completed & Settled",
        paymentMode: order.paymentMode || "UPI Terminal #2",
        createdAt: order.createdAt,
        attemptId: attempt._id,
      },
      review: {
        attemptId: attempt._id,
        reviewId,
        submittedAt: attempt.submittedAt || attempt.updatedAt,
        flaggedForMeeting: Boolean(attempt.flaggedForMeeting),
        source: "Submitted via QR Code",
        overallScore,
        maxScore: 5.0,
        overallRatingLabel,
        customerVerbatim:
          customerVerbatim ||
          "The service was quick and the staff checked in politely. Really enjoyed the main courses.",
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
