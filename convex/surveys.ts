import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireMember, requireAuth, resolveStoreOrganization } from "./organizationUsers";

// ----------------------------------------------------
// AUTHORIZATION HELPERS
// ----------------------------------------------------

/**
 * Ensures caller is an active store member with survey administration permissions
 */
export async function requireSurveyAdmin(
  ctx: QueryCtx | MutationCtx,
  explicitOrgId?: Id<"organizations">
) {
  const { identity, org, callerMember } = await requireMember(ctx, explicitOrgId);

  const isOwnerOrUnowned = !org.ownerClerkId || org.ownerClerkId === identity.subject;
  if (isOwnerOrUnowned) {
    return { identity, org, callerMember };
  }

  const roles = Array.isArray(callerMember?.userType)
    ? callerMember!.userType
    : typeof (callerMember as any)?.userType === "string"
      ? [(callerMember as any)!.userType]
      : [];

  const isAdmin = roles.some((role) =>
    ["admin", "store_admin", "org_admin", "super_admin", "owner"].includes(
      (role || "").trim().toLowerCase()
    )
  );

  const hasSurveyPermission =
    roles.some((r) => r.toLowerCase() === "survey") ||
    Boolean(
      (callerMember?.userPermission as any)?.survey?.read ||
      (callerMember?.userPermission as any)?.survey?.create ||
      (callerMember?.userPermission as any)?.survey?.update ||
      (callerMember?.userPermission as any)?.survey?.delete
    );

  if (!isAdmin && !hasSurveyPermission) {
    throw new Error("Forbidden. Survey administration permission required.");
  }

  return { identity, org, callerMember };
}

// ----------------------------------------------------
// SURVEY QUERIES & MUTATIONS
// ----------------------------------------------------

/**
 * Lists all surveys for the current store, ordered by createdAt ascending.
 * Returns survey metadata along with computed question count.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireSurveyAdmin(ctx);

    const surveys = await ctx.db.query("surveys").collect();

    // Enrich each survey with question count
    const enriched = await Promise.all(
      surveys.map(async (survey) => {
        const questions = await ctx.db
          .query("surveyQuestions")
          .withIndex("by_survey_id", (q) => q.eq("surveyId", survey._id))
          .collect();
        return {
          ...survey,
          questionsCount: questions.length,
        };
      })
    );

    return enriched.sort((a, b) => a.createdAt - b.createdAt);
  },
});

/**
 * Gets a single survey by ID along with its questions ordered by position.
 */
export const get = query({
  args: {
    id: v.id("surveys"),
  },
  handler: async (ctx, args) => {
    await requireSurveyAdmin(ctx);

    const survey = await ctx.db.get(args.id);
    if (!survey) {
      throw new Error("Survey not found");
    }

    const questions = await ctx.db
      .query("surveyQuestions")
      .withIndex("by_survey_position", (q) => q.eq("surveyId", survey._id))
      .collect();

    return {
      ...survey,
      questions: questions.sort((a, b) => a.position - b.position),
    };
  },
});

/**
 * Returns the currently active survey for the store along with its ordered questions.
 * Accessible to both staff and public (returns null if no active survey).
 */
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const activeSurvey = await ctx.db
      .query("surveys")
      .withIndex("by_active", (q) => q.eq("active", true))
      .first();

    if (!activeSurvey) {
      return null;
    }

    const questions = await ctx.db
      .query("surveyQuestions")
      .withIndex("by_survey_position", (q) => q.eq("surveyId", activeSurvey._id))
      .collect();

    return {
      ...activeSurvey,
      questions: questions.sort((a, b) => a.position - b.position),
    };
  },
});

/**
 * Creates a new survey.
 * If copySurveyId is provided, clones all questions from the source survey.
 * When active is true, atomically deactivates any existing active survey in the store.
 */
export const create = mutation({
  args: {
    name: v.string(),
    introduction: v.optional(v.string()),
    afterSurveyContent: v.optional(v.string()),
    active: v.optional(v.boolean()),
    copySurveyId: v.optional(v.id("surveys")),
    legacyId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSurveyAdmin(ctx);

    const name = args.name.trim();
    if (!name) {
      throw new Error("Survey name is required");
    }

    const now = Date.now();
    let sourceQuestions: Doc<"surveyQuestions">[] = [];

    if (args.copySurveyId) {
      const sourceSurvey = await ctx.db.get(args.copySurveyId);
      if (!sourceSurvey) {
        throw new Error("Source survey to copy not found");
      }
      sourceQuestions = await ctx.db
        .query("surveyQuestions")
        .withIndex("by_survey_id", (q) => q.eq("surveyId", sourceSurvey._id))
        .collect();
    }

    const isActive = args.active ?? false;

    // If setting active=true, deactivate any other existing active surveys
    if (isActive) {
      const existingActiveSurveys = await ctx.db
        .query("surveys")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect();

      for (const s of existingActiveSurveys) {
        await ctx.db.patch(s._id, { active: false, updatedAt: now });
      }
    }

    const surveyId = await ctx.db.insert("surveys", {
      name: args.copySurveyId && !args.name.startsWith("Copy of ") ? `Copy of ${name}` : name,
      introduction: args.introduction,
      afterSurveyContent: args.afterSurveyContent,
      active: isActive,
      legacyId: args.legacyId,
      createdAt: now,
      updatedAt: now,
    });

    // If copying from source survey, clone all questions
    if (sourceQuestions.length > 0) {
      for (const sq of sourceQuestions.sort((a, b) => a.position - b.position)) {
        await ctx.db.insert("surveyQuestions", {
          surveyId,
          type: sq.type,
          questionText: sq.questionText,
          defaultText: sq.defaultText,
          placeholder: sq.placeholder,
          position: sq.position,
          answerOptions: sq.answerOptions ? [...sq.answerOptions] : undefined,
          validationRules: sq.validationRules ? { ...sq.validationRules } : undefined,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return surveyId;
  },
});

/**
 * Updates an existing survey.
 * When activating, atomically deactivates all other surveys.
 * Enforces that the only active survey cannot be intentionally deactivated without another active survey.
 */
export const update = mutation({
  args: {
    id: v.id("surveys"),
    name: v.optional(v.string()),
    introduction: v.optional(v.string()),
    afterSurveyContent: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireSurveyAdmin(ctx);

    const survey = await ctx.db.get(args.id);
    if (!survey) {
      throw new Error("Survey not found");
    }

    const now = Date.now();
    const patchData: Partial<Doc<"surveys">> = {
      updatedAt: now,
    };

    if (args.name !== undefined) {
      const trimmed = args.name.trim();
      if (!trimmed) throw new Error("Survey name cannot be blank");
      patchData.name = trimmed;
    }

    if (args.introduction !== undefined) {
      patchData.introduction = args.introduction;
    }

    if (args.afterSurveyContent !== undefined) {
      patchData.afterSurveyContent = args.afterSurveyContent;
    }

    if (args.active !== undefined) {
      if (args.active === true) {
        // Deactivate all other surveys
        const otherActive = await ctx.db
          .query("surveys")
          .withIndex("by_active", (q) => q.eq("active", true))
          .collect();

        for (const s of otherActive) {
          if (s._id !== survey._id) {
            await ctx.db.patch(s._id, { active: false, updatedAt: now });
          }
        }
        patchData.active = true;
      } else if (args.active === false && survey.active === true) {
        // Check if another active survey exists
        const allActive = await ctx.db
          .query("surveys")
          .withIndex("by_active", (q) => q.eq("active", true))
          .collect();

        const remainingActive = allActive.filter((s) => s._id !== survey._id);
        if (remainingActive.length === 0) {
          throw new Error("At least one survey must be active");
        }
        patchData.active = false;
      } else {
        patchData.active = args.active;
      }
    }

    await ctx.db.patch(survey._id, patchData);
    return { success: true };
  },
});

/**
 * Hard-deletes a survey and cascades to all its questions, attempts, and answers.
 */
export const remove = mutation({
  args: {
    id: v.id("surveys"),
  },
  handler: async (ctx, args) => {
    await requireSurveyAdmin(ctx);

    const survey = await ctx.db.get(args.id);
    if (!survey) {
      throw new Error("Survey not found");
    }

    // 1. Delete all questions
    const questions = await ctx.db
      .query("surveyQuestions")
      .withIndex("by_survey_id", (q) => q.eq("surveyId", survey._id))
      .collect();

    for (const q of questions) {
      await ctx.db.delete(q._id);
    }

    // 2. Delete all attempts and their answers
    const attempts = await ctx.db
      .query("surveyAttempts")
      .withIndex("by_survey_id", (q) => q.eq("surveyId", survey._id))
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

    // 3. Delete survey
    await ctx.db.delete(survey._id);
    return { success: true };
  },
});

/**
 * Calculates aggregate survey analytics across published attempts.
 * Computes frequency counts for choice questions, average/distribution for numeric ratings,
 * and extracts submitted text responses.
 */
export const getResults = query({
  args: {
    surveyId: v.id("surveys"),
    fromDate: v.optional(v.number()),
    toDate: v.optional(v.number()),
    attemptId: v.optional(v.id("surveyAttempts")),
  },
  handler: async (ctx, args) => {
    await requireSurveyAdmin(ctx);

    const survey = await ctx.db.get(args.surveyId);
    if (!survey) {
      throw new Error("Survey not found");
    }

    const questions = await ctx.db
      .query("surveyQuestions")
      .withIndex("by_survey_position", (q) => q.eq("surveyId", survey._id))
      .collect();

    // Fetch published attempts for this survey
    let attemptsQuery = await ctx.db
      .query("surveyAttempts")
      .withIndex("by_survey_published", (q) =>
        q.eq("surveyId", survey._id).eq("published", true)
      )
      .collect();

    if (args.attemptId) {
      attemptsQuery = attemptsQuery.filter((a) => a._id === args.attemptId);
    }

    if (args.fromDate !== undefined) {
      attemptsQuery = attemptsQuery.filter(
        (a) => (a.submittedAt ?? a.updatedAt) >= args.fromDate!
      );
    }

    if (args.toDate !== undefined) {
      attemptsQuery = attemptsQuery.filter(
        (a) => (a.submittedAt ?? a.updatedAt) <= args.toDate!
      );
    }

    const publishedAttemptIds = new Set(attemptsQuery.map((a) => a._id));

    // For each question, extract and aggregate answers across the filtered published attempts
    const questionResults = await Promise.all(
      questions.map(async (question) => {
        const answers = await ctx.db
          .query("surveyAnswers")
          .withIndex("by_question_id", (q) => q.eq("questionId", question._id))
          .collect();

        const filteredAnswers = answers.filter((a) => publishedAttemptIds.has(a.attemptId));

        switch (question.type) {
          case "checkbox":
          case "radio":
          case "select": {
            const counts: Record<string, number> = {};
            // Initialize count for configured options
            if (question.answerOptions) {
              for (const opt of question.answerOptions) {
                counts[opt] = 0;
              }
            }

            for (const a of filteredAnswers) {
              if (Array.isArray(a.selectedOptions) && a.selectedOptions.length > 0) {
                for (const opt of a.selectedOptions) {
                  counts[opt] = (counts[opt] || 0) + 1;
                }
              } else if (a.answerText) {
                counts[a.answerText] = (counts[a.answerText] || 0) + 1;
              }
            }

            return {
              questionId: question._id,
              type: question.type,
              questionText: question.questionText,
              position: question.position,
              totalResponses: filteredAnswers.length,
              optionCounts: counts,
            };
          }

          case "numeric": {
            const distribution: Record<number, number> = {};
            let sum = 0;
            let numericCount = 0;

            for (const a of filteredAnswers) {
              const val =
                a.numericValue !== undefined
                  ? a.numericValue
                  : a.answerText !== undefined && !isNaN(Number(a.answerText))
                    ? Number(a.answerText)
                    : null;

              if (val !== null) {
                distribution[val] = (distribution[val] || 0) + 1;
                sum += val;
                numericCount++;
              }
            }

            const average = numericCount > 0 ? Number((sum / numericCount).toFixed(2)) : 0;

            return {
              questionId: question._id,
              type: question.type,
              questionText: question.questionText,
              position: question.position,
              totalResponses: numericCount,
              averageRating: average,
              distribution,
            };
          }

          case "short":
          case "long":
          case "date":
          default: {
            const textResponses = filteredAnswers
              .filter((a) => a.answerText && a.answerText.trim().length > 0)
              .map((a) => ({
                attemptId: a.attemptId,
                answerText: a.answerText!,
                submittedAt: a.updatedAt,
              }));

            return {
              questionId: question._id,
              type: question.type,
              questionText: question.questionText,
              position: question.position,
              totalResponses: textResponses.length,
              responses: textResponses,
            };
          }
        }
      })
    );

    return {
      surveyId: survey._id,
      surveyName: survey.name,
      totalPublishedAttempts: attemptsQuery.length,
      questions: questionResults.sort((a, b) => a.position - b.position),
    };
  },
});

/**
 * Returns paginated survey responses (attempts) with customer and order summary.
 */
export const listResponses = query({
  args: {
    surveyId: v.id("surveys"),
    fromDate: v.optional(v.number()),
    toDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSurveyAdmin(ctx);

    const survey = await ctx.db.get(args.surveyId);
    if (!survey) {
      throw new Error("Survey not found");
    }

    let attempts = await ctx.db
      .query("surveyAttempts")
      .withIndex("by_survey_published", (q) =>
        q.eq("surveyId", survey._id).eq("published", true)
      )
      .collect();

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

    // Sort descending by submittedAt / updatedAt
    attempts.sort((a, b) => (b.submittedAt ?? b.updatedAt) - (a.submittedAt ?? a.updatedAt));

    const maxLimit = args.limit ? Math.min(args.limit, 100) : 50;
    const paginated = attempts.slice(0, maxLimit);

    const enriched = await Promise.all(
      paginated.map(async (attempt) => {
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

        const answersWithQuestions = await Promise.all(
          answers.map(async (a) => {
            const question = await ctx.db.get(a.questionId);
            return {
              questionId: a.questionId,
              questionText: question?.questionText,
              questionType: question?.type,
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
          customerId: attempt.customerId,
          submittedAt: attempt.submittedAt ?? attempt.updatedAt,
          answers: answersWithQuestions,
        };
      })
    );

    return {
      responses: enriched,
      totalCount: attempts.length,
    };
  },
});
