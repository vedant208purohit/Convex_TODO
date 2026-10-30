/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Complete Survey Analytics Response Count & Aggregation Audit Tests", () => {
  async function setupStoreWithAdmin(adminSubject = "user_admin_survey_audit") {
    const t = convexTest(schema, modules);
    const orgId = await t.mutation(api.organizations.create, {
      name: "Survey Audit Test Flagship",
      ownerClerkId: adminSubject,
      country: "United Arab Emirates",
    });
    const admin = t.withIdentity({ role: "admin", subject: adminSubject });
    return { t, orgId, admin };
  }

  async function createTestOrder(t: any, orgId: any, customerPhone = "+971501234567") {
    return await t.run(async (ctx: any) => {
      const now = Date.now();
      return await ctx.db.insert("orders", {
        organizationId: orgId,
        orderNumber: `#ORD-${Math.floor(1000 + Math.random() * 9000)}`,
        tokenNumber: "01",
        orderType: "DineIn",
        orderSource: "POS",
        orderStatusName: "Completed",
        isCompleted: true,
        isRejected: false,
        isModify: false,
        subTotal: 100,
        taxTotal: 5,
        totalAmount: 105,
        currency: "AED",
        currencySymbol: "AED",
        paymentMode: "Card",
        paymentStatus: "Paid",
        customerPhone,
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  // ====================================================
  // TEST 1: The Exact Screenshot Defect Repro & Resolution
  // 2 submissions where Q1 had overall score AND dish reviews attached
  // ====================================================
  test("1. Reproduction & Fix of Screenshot: Q1 reports exactly 2 responses (NOT 4) and 6.50 avg (NOT 5.25)", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();

    const surveyId = await admin.mutation(api.surveys.create, {
      name: "Customer Feedback Survey",
      active: true,
    });

    const q1Numeric = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "numeric",
      questionText: "On a scale of 1-10, How likely are you to recommend us?",
      validationRules: { greaterThanOrEqualTo: 1, lessThanOrEqualTo: 10, presence: true },
      position: 1,
    });

    const q2Checkbox = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "checkbox",
      questionText: "What went well?",
      answerOptions: ["Food / Product", "Service / Delivery Time", "Ambiance / Packaging"],
      position: 2,
    });

    const o1 = await createTestOrder(t, orgId);
    const o2 = await createTestOrder(t, orgId);

    const att1 = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: o1 });
    const att2 = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: o2 });

    // Submission 1: Q1 score 7, dish rating 4 for "Vadapav", checkbox has 2 selections
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: att1!.attemptId,
      answers: [
        { questionId: q1Numeric, numericValue: 7, answerText: "7 Score" },
        {
          questionId: q1Numeric,
          orderItemId: "item_vadapav_1",
          orderItemName: "Vadapav",
          numericValue: 4,
        },
        {
          questionId: q2Checkbox,
          selectedOptions: ["Food / Product", "Service / Delivery Time"],
        },
      ],
    });

    // Submission 2: Q1 score 6, dish rating 4 for "Dry manchurian", checkbox has 1 selection
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: att2!.attemptId,
      answers: [
        { questionId: q1Numeric, numericValue: 6, answerText: "6 Score" },
        {
          questionId: q1Numeric,
          orderItemId: "item_manchurian_2",
          orderItemName: "Dry manchurian",
          numericValue: 4,
        },
        {
          questionId: q2Checkbox,
          selectedOptions: ["Ambiance / Packaging"],
        },
      ],
    });

    // Query analytics results
    const results = await admin.query(api.surveys.getResults, { surveyId });

    // Summary Card: Total Submitted Reviews must be strictly 2
    expect(results.totalPublishedAttempts).toBe(2);

    // Q1 Analytics: Total responses must be strictly 2 (NOT 4!)
    const q1Res: any = results.questions.find((q) => q.questionId === q1Numeric);
    expect(q1Res).toBeDefined();
    expect(q1Res.totalResponses).toBe(2);

    // Distribution: Exactly one 7 and one 6 (NOT two 4s from dishes!)
    expect(q1Res.distribution[7]).toBe(1);
    expect(q1Res.distribution[6]).toBe(1);
    expect(q1Res.distribution[4] || 0).toBe(0);

    // Weighted Average: (7 + 6) / 2 = 6.50 (NOT 5.25!)
    expect(q1Res.averageRating).toBe(6.5);

    // Summary Overall Rating card: Must also be 6.50 and totalResponses 2
    expect(results.overallRating?.totalResponses).toBe(2);
    expect(results.overallRating?.average).toBe(6.5);

    // Q2 Checkbox Analytics:
    const q2Res: any = results.questions.find((q) => q.questionId === q2Checkbox);
    expect(q2Res).toBeDefined();
    // 2 distinct diners answered
    expect(q2Res.totalResponses).toBe(2);
    // Cumulative 3 selections picked
    expect(q2Res.totalSelections).toBe(3);
    expect(q2Res.optionCounts["Food / Product"]).toBe(1);
    expect(q2Res.optionCounts["Service / Delivery Time"]).toBe(1);
    expect(q2Res.optionCounts["Ambiance / Packaging"]).toBe(1);
  });

  // ====================================================
  // TEST 2: Optional Questions & Missing Answers Handling
  // ====================================================
  test("2. Optional unanswered questions correctly report 0 or 1 responses without breaking totals", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();

    const surveyId = await admin.mutation(api.surveys.create, {
      name: "Optional Questions Survey",
      active: true,
    });

    const q1Mandatory = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "numeric",
      questionText: "Mandatory Rating",
      validationRules: { presence: true },
      position: 1,
    });

    const q2Optional = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "short",
      questionText: "Optional Suggestions",
      validationRules: { presence: false },
      position: 2,
    });

    const q3Unanswered = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "radio",
      questionText: "Visit Frequency",
      answerOptions: ["First Time", "Weekly", "Monthly"],
      validationRules: { presence: false },
      position: 3,
    });

    const o1 = await createTestOrder(t, orgId);
    const o2 = await createTestOrder(t, orgId);

    const att1 = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: o1 });
    const att2 = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: o2 });

    // Respondent 1 answers Q1 and Q2
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: att1!.attemptId,
      answers: [
        { questionId: q1Mandatory, numericValue: 5 },
        { questionId: q2Optional, answerText: "Great job on the seating!" },
      ],
    });

    // Respondent 2 answers ONLY Q1 (skips Q2 and Q3)
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: att2!.attemptId,
      answers: [{ questionId: q1Mandatory, numericValue: 4 }],
    });

    const results = await admin.query(api.surveys.getResults, { surveyId });
    expect(results.totalPublishedAttempts).toBe(2);

    const q1: any = results.questions.find((q) => q.questionId === q1Mandatory);
    expect(q1.totalResponses).toBe(2);
    expect(q1.averageRating).toBe(4.5);

    const q2: any = results.questions.find((q) => q.questionId === q2Optional);
    expect(q2.totalResponses).toBe(1);
    expect(q2.responseRate).toBe(50);
    expect(q2.responses).toHaveLength(1);

    const q3: any = results.questions.find((q) => q.questionId === q3Unanswered);
    expect(q3.totalResponses).toBe(0);
    expect(q3.totalSelections).toBe(0);
  });

  // ====================================================
  // TEST 3: Duplicate Answer Documents & Retry Deduplication
  // ====================================================
  test("3. Duplicate answer documents and submission retries do not inflate response counts", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();

    const surveyId = await admin.mutation(api.surveys.create, {
      name: "Idempotency Survey",
      active: true,
    });

    const qRating = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "numeric",
      questionText: "Speed of Service",
      validationRules: { greaterThanOrEqualTo: 1, lessThanOrEqualTo: 5 },
    });

    const qComments = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "long",
      questionText: "Comments",
    });

    const orderId = await createTestOrder(t, orgId);
    const att = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId });

    // 1. Initial submission
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: att!.attemptId,
      answers: [
        { questionId: qRating, numericValue: 5 },
        { questionId: qComments, answerText: "Fast service!" },
      ],
    });

    // 2. Direct database injection of duplicate answers for the same attempt (simulating legacy data)
    await t.run(async (ctx: any) => {
      const now = Date.now();
      await ctx.db.insert("surveyAnswers", {
        attemptId: att!.attemptId,
        questionId: qRating,
        numericValue: 5,
        createdAt: now - 1000,
        updatedAt: now - 1000,
      });
      await ctx.db.insert("surveyAnswers", {
        attemptId: att!.attemptId,
        questionId: qComments,
        answerText: "Duplicate fast service!",
        createdAt: now - 1000,
        updatedAt: now - 1000,
      });
    });

    // 3. Verify analytics: Must deduplicate by attemptId and count exactly 1 respondent
    const results = await admin.query(api.surveys.getResults, { surveyId });
    expect(results.totalPublishedAttempts).toBe(1);

    const ratingRes: any = results.questions.find((q) => q.questionId === qRating);
    expect(ratingRes.totalResponses).toBe(1);
    expect(ratingRes.distribution[5]).toBe(1);
    expect(ratingRes.averageRating).toBe(5);

    const commentsRes: any = results.questions.find((q) => q.questionId === qComments);
    expect(commentsRes.totalResponses).toBe(1);
    expect(commentsRes.responses).toHaveLength(1);
  });

  // ====================================================
  // TEST 4: Date Range & Published Filtering Isolation
  // ====================================================
  test("4. Drafts and out-of-range submissions are excluded from both summary and question metrics", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();

    const surveyId = await admin.mutation(api.surveys.create, {
      name: "Date Filtering Survey",
      active: true,
    });

    const qNum = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "numeric",
      questionText: "Cleanliness",
    });

    const o1 = await createTestOrder(t, orgId);
    const o2 = await createTestOrder(t, orgId);
    const o3 = await createTestOrder(t, orgId);

    const att1 = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: o1 });
    const att2 = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: o2 });
    const attDraft = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: o3 });

    const now = Date.now();
    const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000;
    const fortyDaysAgo = now - 40 * 24 * 60 * 60 * 1000;

    // att1: Published 10 days ago (within 30-day window)
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: att1!.attemptId,
      answers: [{ questionId: qNum, numericValue: 5 }],
    });
    await t.run(async (ctx: any) => {
      await ctx.db.patch(att1!.attemptId, { submittedAt: tenDaysAgo, updatedAt: tenDaysAgo });
    });

    // att2: Published 40 days ago (outside 30-day window)
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: att2!.attemptId,
      answers: [{ questionId: qNum, numericValue: 3 }],
    });
    await t.run(async (ctx: any) => {
      await ctx.db.patch(att2!.attemptId, { submittedAt: fortyDaysAgo, updatedAt: fortyDaysAgo });
    });

    // attDraft: Unsubmitted draft
    await t.mutation(api.surveyAttempts.saveDraftAnswers, {
      attemptId: attDraft!.attemptId,
      answers: [{ questionId: qNum, numericValue: 2 }],
    });

    // Query with 30-day window: [now - 30d, now]
    const windowStart = now - 30 * 24 * 60 * 60 * 1000;
    const results = await admin.query(api.surveys.getResults, {
      surveyId,
      fromDate: windowStart,
      toDate: now,
    });

    // Only att1 is published and in-window
    expect(results.totalPublishedAttempts).toBe(1);
    expect(results.totalAttempts).toBe(3); // 3 total attempts exist in database

    const qRes: any = results.questions.find((q) => q.questionId === qNum);
    expect(qRes.totalResponses).toBe(1);
    expect(qRes.averageRating).toBe(5);
    expect(qRes.distribution[5]).toBe(1);
    expect(qRes.distribution[3] || 0).toBe(0);
    expect(qRes.distribution[2] || 0).toBe(0);
  });
});

