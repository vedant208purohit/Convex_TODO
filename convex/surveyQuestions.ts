import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireSurveyAdmin } from "./surveys";

// ----------------------------------------------------
// QUESTION MANAGEMENT MUTATIONS & QUERIES
// ----------------------------------------------------

/**
 * Creates a new question attached to a survey.
 * Automatically calculates the next position if not specified.
 */
export const create = mutation({
  args: {
    surveyId: v.id("surveys"),
    type: v.union(
      v.literal("numeric"),
      v.literal("checkbox"),
      v.literal("radio"),
      v.literal("select"),
      v.literal("short"),
      v.literal("long"),
      v.literal("date")
    ),
    questionText: v.string(),
    defaultText: v.optional(v.string()),
    placeholder: v.optional(v.string()),
    position: v.optional(v.number()),
    answerOptions: v.optional(v.array(v.string())),
    validationRules: v.optional(
      v.object({
        presence: v.optional(v.boolean()),
        minimumLength: v.optional(v.number()),
        maximumLength: v.optional(v.number()),
        greaterThanOrEqualTo: v.optional(v.number()),
        lessThanOrEqualTo: v.optional(v.number()),
      })
    ),
    legacyId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSurveyAdmin(ctx);

    const survey = await ctx.db.get(args.surveyId);
    if (!survey) {
      throw new Error("Survey not found");
    }

    const questionText = args.questionText.trim();
    if (!questionText) {
      throw new Error("Question text is required");
    }

    // Determine position if not explicitly supplied
    let position = args.position;
    if (position === undefined) {
      const existingQuestions = await ctx.db
        .query("surveyQuestions")
        .withIndex("by_survey_id", (q) => q.eq("surveyId", survey._id))
        .collect();

      const maxPos = existingQuestions.reduce(
        (max, q) => (q.position > max ? q.position : max),
        0
      );
      position = maxPos + 1;
    }

    // Clean up empty option strings if answerOptions provided
    const cleanedOptions = args.answerOptions
      ?.map((o) => o.trim())
      .filter((o) => o.length > 0);

    const now = Date.now();
    const questionId = await ctx.db.insert("surveyQuestions", {
      surveyId: survey._id,
      type: args.type,
      questionText,
      defaultText: args.defaultText?.trim() || undefined,
      placeholder: args.placeholder?.trim() || undefined,
      position,
      answerOptions: cleanedOptions && cleanedOptions.length > 0 ? cleanedOptions : undefined,
      validationRules: args.validationRules,
      legacyId: args.legacyId,
      createdAt: now,
      updatedAt: now,
    });

    return questionId;
  },
});

/**
 * Updates a question.
 * Enforces that question type cannot be changed once answers exist.
 */
export const update = mutation({
  args: {
    id: v.id("surveyQuestions"),
    questionText: v.optional(v.string()),
    defaultText: v.optional(v.string()),
    placeholder: v.optional(v.string()),
    answerOptions: v.optional(v.array(v.string())),
    validationRules: v.optional(
      v.object({
        presence: v.optional(v.boolean()),
        minimumLength: v.optional(v.number()),
        maximumLength: v.optional(v.number()),
        greaterThanOrEqualTo: v.optional(v.number()),
        lessThanOrEqualTo: v.optional(v.number()),
      })
    ),
    type: v.optional(
      v.union(
        v.literal("numeric"),
        v.literal("checkbox"),
        v.literal("radio"),
        v.literal("select"),
        v.literal("short"),
        v.literal("long"),
        v.literal("date")
      )
    ),
  },
  handler: async (ctx, args) => {
    await requireSurveyAdmin(ctx);

    const question = await ctx.db.get(args.id);
    if (!question) {
      throw new Error("Question not found");
    }

    // Type change check: if type changed, verify no answers exist
    if (args.type && args.type !== question.type) {
      const existingAnswer = await ctx.db
        .query("surveyAnswers")
        .withIndex("by_question_id", (q) => q.eq("questionId", question._id))
        .first();

      if (existingAnswer) {
        throw new Error("Question type cannot be changed after answers have been added");
      }
    }

    const patchData: Partial<Doc<"surveyQuestions">> = {
      updatedAt: Date.now(),
    };

    if (args.type !== undefined) patchData.type = args.type;
    if (args.questionText !== undefined) {
      const trimmed = args.questionText.trim();
      if (!trimmed) throw new Error("Question text cannot be blank");
      patchData.questionText = trimmed;
    }
    if (args.defaultText !== undefined) patchData.defaultText = args.defaultText.trim() || undefined;
    if (args.placeholder !== undefined) patchData.placeholder = args.placeholder.trim() || undefined;
    if (args.answerOptions !== undefined) {
      const cleaned = args.answerOptions.map((o) => o.trim()).filter((o) => o.length > 0);
      patchData.answerOptions = cleaned.length > 0 ? cleaned : undefined;
    }
    if (args.validationRules !== undefined) {
      patchData.validationRules = args.validationRules;
    }

    await ctx.db.patch(question._id, patchData);
    return { success: true };
  },
});

/**
 * Reorders questions within a survey based on the provided ordered array of question IDs.
 */
export const reorder = mutation({
  args: {
    surveyId: v.id("surveys"),
    questionIds: v.array(v.id("surveyQuestions")),
  },
  handler: async (ctx, args) => {
    await requireSurveyAdmin(ctx);

    const survey = await ctx.db.get(args.surveyId);
    if (!survey) {
      throw new Error("Survey not found");
    }

    const now = Date.now();
    for (let i = 0; i < args.questionIds.length; i++) {
      const questionId = args.questionIds[i];
      const question = await ctx.db.get(questionId);
      if (question && question.surveyId === survey._id) {
        await ctx.db.patch(questionId, {
          position: i + 1,
          updatedAt: now,
        });
      }
    }

    return { success: true };
  },
});

/**
 * Duplicates a question within the same survey and appends it to the end.
 */
export const copy = mutation({
  args: {
    questionId: v.id("surveyQuestions"),
  },
  handler: async (ctx, args) => {
    await requireSurveyAdmin(ctx);

    const sourceQuestion = await ctx.db.get(args.questionId);
    if (!sourceQuestion) {
      throw new Error("Question not found");
    }

    const allQuestions = await ctx.db
      .query("surveyQuestions")
      .withIndex("by_survey_id", (q) => q.eq("surveyId", sourceQuestion.surveyId))
      .collect();

    const maxPos = allQuestions.reduce((max, q) => (q.position > max ? q.position : max), 0);
    const now = Date.now();

    const newQuestionId = await ctx.db.insert("surveyQuestions", {
      surveyId: sourceQuestion.surveyId,
      type: sourceQuestion.type,
      questionText: `Copy of ${sourceQuestion.questionText}`,
      defaultText: sourceQuestion.defaultText,
      placeholder: sourceQuestion.placeholder,
      position: maxPos + 1,
      answerOptions: sourceQuestion.answerOptions ? [...sourceQuestion.answerOptions] : undefined,
      validationRules: sourceQuestion.validationRules ? { ...sourceQuestion.validationRules } : undefined,
      createdAt: now,
      updatedAt: now,
    });

    return newQuestionId;
  },
});

/**
 * Hard-deletes a question and cascades to all its answers.
 */
export const remove = mutation({
  args: {
    id: v.id("surveyQuestions"),
  },
  handler: async (ctx, args) => {
    await requireSurveyAdmin(ctx);

    const question = await ctx.db.get(args.id);
    if (!question) {
      throw new Error("Question not found");
    }

    // Delete associated answers
    const answers = await ctx.db
      .query("surveyAnswers")
      .withIndex("by_question_id", (q) => q.eq("questionId", question._id))
      .collect();

    for (const a of answers) {
      await ctx.db.delete(a._id);
    }

    await ctx.db.delete(question._id);
    return { success: true };
  },
});
