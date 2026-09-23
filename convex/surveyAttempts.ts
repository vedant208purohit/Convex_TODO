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
    orderId: v.id("orders"),
    customerId: v.optional(v.string()),
    publicBaseUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Resolve Order
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    // 2. Find active survey for the store
    const activeSurvey = await ctx.db
      .query("surveys")
      .withIndex("by_active", (q) => q.eq("active", true))
      .first();

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
    attemptId: v.id("surveyAttempts"),
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

    return {
      attemptId: attempt._id,
      surveyId: survey._id,
      surveyName: survey.name,
      introduction: survey.introduction,
      afterSurveyContent: survey.afterSurveyContent,
      published: attempt.published,
      orderId: attempt.orderId,
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
 * Public Mutation: Validates and persists customer answers for an attempt, transitioning to published state.
 */
export const submit = mutation({
  args: {
    attemptId: v.id("surveyAttempts"),
    answers: v.array(
      v.object({
        questionId: v.id("surveyQuestions"),
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

        for (const opt of submitted) {
          if (!allowedOptions.has(opt)) {
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
      const existing = await ctx.db
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
          answerText: ans.answerText,
          selectedOptions: ans.selectedOptions,
          numericValue: numVal,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("surveyAnswers", {
          attemptId: attempt._id,
          questionId: ans.questionId,
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
