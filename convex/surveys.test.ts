/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Customer Feedback / RapidFire Survey Domain Tests", () => {
  async function setupStoreWithAdmin(adminSubject = "user_admin_123") {
    const t = convexTest(schema, modules);
    const orgId = await t.mutation(api.organizations.create, {
      name: "DEFx POS Flagship",
      ownerClerkId: adminSubject,
    });
    const admin = t.withIdentity({ role: "admin", subject: adminSubject });
    return { t, orgId, admin };
  }

  async function createTestOrder(t: any, orgId: any, customerPhone?: string) {
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
        subTotal: 1000,
        taxTotal: 50,
        totalAmount: 1050,
        paymentMode: "Cash",
        paymentStatus: "Paid",
        customerPhone: customerPhone || "+919876543210",
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  // ====================================================
  // 1. SURVEY CRUD & SINGLE ACTIVE SURVEY INVARIANT
  // ====================================================

  test("1. Survey creation, listing with question count, and single-active invariant", async () => {
    const { t, admin } = await setupStoreWithAdmin();

    // Create Survey A (Active)
    const surveyAId = await admin.mutation(api.surveys.create, {
      name: "General Customer Feedback",
      introduction: "Please let us know how we did today.",
      afterSurveyContent: "Thank you for your valuable feedback!",
      active: true,
    });

    let activeSurvey = await t.query(api.surveys.getActive, {});
    expect(activeSurvey).not.toBeNull();
    expect(activeSurvey?._id).toBe(surveyAId);
    expect(activeSurvey?.active).toBe(true);

    // Create Survey B (Active) -> Should atomically deactivate Survey A
    const surveyBId = await admin.mutation(api.surveys.create, {
      name: "Weekend Special Event Survey",
      active: true,
    });

    activeSurvey = await t.query(api.surveys.getActive, {});
    expect(activeSurvey?._id).toBe(surveyBId);

    const surveyA = await admin.query(api.surveys.get, { id: surveyAId });
    expect(surveyA.active).toBe(false);

    // List surveys
    const surveysList = await admin.query(api.surveys.list, {});
    expect(surveysList.length).toBe(2);
    expect(surveysList.find((s) => s._id === surveyAId)?.active).toBe(false);
    expect(surveysList.find((s) => s._id === surveyBId)?.active).toBe(true);
  });

  test("2. Survey update prevents deactivating the only active survey without another active one", async () => {
    const { admin } = await setupStoreWithAdmin();

    const surveyId = await admin.mutation(api.surveys.create, {
      name: "Primary Survey",
      active: true,
    });

    // Attempting to toggle active: false on the only active survey must throw
    await expect(
      admin.mutation(api.surveys.update, {
        id: surveyId,
        active: false,
      })
    ).rejects.toThrow("At least one survey must be active");

    // Creating another active survey allows changing the previous one
    await admin.mutation(api.surveys.create, {
      name: "Secondary Survey",
      active: true,
    });

    // Now surveyId is inactive, updating it works
    await admin.mutation(api.surveys.update, {
      id: surveyId,
      name: "Updated Primary Survey",
      active: false,
    });

    const updated = await admin.query(api.surveys.get, { id: surveyId });
    expect(updated.name).toBe("Updated Primary Survey");
  });

  test("3. Copying a survey duplicates all its questions and forces active = false", async () => {
    const { admin } = await setupStoreWithAdmin();

    const sourceSurveyId = await admin.mutation(api.surveys.create, {
      name: "Original Survey",
      introduction: "Original intro",
      active: true,
    });

    // Add 2 questions to source survey
    await admin.mutation(api.surveyQuestions.create, {
      surveyId: sourceSurveyId,
      type: "numeric",
      questionText: "Rate your overall experience",
    });
    await admin.mutation(api.surveyQuestions.create, {
      surveyId: sourceSurveyId,
      type: "checkbox",
      questionText: "What did you enjoy?",
      answerOptions: ["Food", "Service", "Music"],
    });

    // Clone survey
    const clonedSurveyId = await admin.mutation(api.surveys.create, {
      name: "Copy of Original Survey",
      copySurveyId: sourceSurveyId,
    });

    const cloned = await admin.query(api.surveys.get, { id: clonedSurveyId });
    expect(cloned.name).toBe("Copy of Original Survey");
    expect(cloned.active).toBe(false);
    expect(cloned.questions.length).toBe(2);
    expect(cloned.questions[0].questionText).toBe("Rate your overall experience");
    expect(cloned.questions[1].answerOptions).toEqual(["Food", "Service", "Music"]);
  });

  // ====================================================
  // 2. QUESTION MANAGEMENT & REORDERING
  // ====================================================

  test("4. Question CRUD, auto-positioning, reordering, and copying", async () => {
    const { admin } = await setupStoreWithAdmin();

    const surveyId = await admin.mutation(api.surveys.create, {
      name: "Question Test Survey",
      active: true,
    });

    const q1Id = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "numeric",
      questionText: "Q1 NPS Rating",
      validationRules: { presence: true, greaterThanOrEqualTo: 1, lessThanOrEqualTo: 10 },
    });

    const q2Id = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "short",
      questionText: "Q2 Name",
    });

    const q3Id = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "long",
      questionText: "Q3 Feedback",
    });

    let survey = await admin.query(api.surveys.get, { id: surveyId });
    expect(survey.questions.map((q) => q.position)).toEqual([1, 2, 3]);

    // Reorder: Move Q3 to position 1, Q1 to position 2, Q2 to position 3
    await admin.mutation(api.surveyQuestions.reorder, {
      surveyId,
      questionIds: [q3Id, q1Id, q2Id],
    });

    survey = await admin.query(api.surveys.get, { id: surveyId });
    expect(survey.questions[0]._id).toBe(q3Id);
    expect(survey.questions[0].position).toBe(1);
    expect(survey.questions[1]._id).toBe(q1Id);
    expect(survey.questions[1].position).toBe(2);
    expect(survey.questions[2]._id).toBe(q2Id);
    expect(survey.questions[2].position).toBe(3);

    // Copy Q1
    const copiedQId = await admin.mutation(api.surveyQuestions.copy, {
      questionId: q1Id,
    });

    survey = await admin.query(api.surveys.get, { id: surveyId });
    expect(survey.questions.length).toBe(4);
    const copiedQ = survey.questions.find((q) => q._id === copiedQId);
    expect(copiedQ?.questionText).toBe("Copy of Q1 NPS Rating");
    expect(copiedQ?.position).toBe(4);
  });

  test("5. Question type cannot be changed after answers have been submitted", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();

    const surveyId = await admin.mutation(api.surveys.create, {
      name: "Type Immutability Survey",
      active: true,
    });

    const qId = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "short",
      questionText: "Original Short Question",
    });

    // Before answers exist, updating type works
    await admin.mutation(api.surveyQuestions.update, {
      id: qId,
      type: "long",
    });

    const orderId = await createTestOrder(t, orgId);

    const attempt = await t.mutation(api.surveyAttempts.getOrCreateForOrder, {
      orderId,
    });

    // Submit answer
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: attempt!.attemptId,
      answers: [
        {
          questionId: qId,
          answerText: "Great meal!",
        },
      ],
    });

    // Attempting to change question type now must fail
    await expect(
      admin.mutation(api.surveyQuestions.update, {
        id: qId,
        type: "numeric",
      })
    ).rejects.toThrow("Question type cannot be changed after answers have been added");
  });

  // ====================================================
  // 3. PUBLIC RESPONDENT ACCESS & VALIDATIONS
  // ====================================================

  test("6. Public respondent fetching, answer validations, and submission state transition", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();

    const surveyId = await admin.mutation(api.surveys.create, {
      name: "Public Validation Survey",
      introduction: "Welcome to our customer survey",
      afterSurveyContent: "Thanks for dining with us!",
      active: true,
    });

    const qNps = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "numeric",
      questionText: "How likely are you to recommend us? (1-10)",
      validationRules: { presence: true, greaterThanOrEqualTo: 1, lessThanOrEqualTo: 10 },
    });

    const qChoices = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "checkbox",
      questionText: "What did you like?",
      answerOptions: ["Taste", "Speed", "Price"],
      validationRules: { presence: true },
    });

    const qDate = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "date",
      questionText: "Visit Date",
    });

    const orderId = await createTestOrder(t, orgId, "+919876543210");

    const attemptInfo = await t.mutation(api.surveyAttempts.getOrCreateForOrder, {
      orderId,
      customerId: "+919876543210",
    });

    expect(attemptInfo).not.toBeNull();
    expect(attemptInfo?.published).toBe(false);

    // 1. Public respondent gets survey questions
    const respondentData = await t.query(api.surveyAttempts.getForRespondent, {
      attemptId: attemptInfo!.attemptId,
    });

    expect(respondentData!.surveyName).toBe("Public Validation Survey");
    expect(respondentData!.published).toBe(false);
    expect(respondentData!.questions.length).toBe(3);

    // 2. Validate numeric out of range fails
    await expect(
      t.mutation(api.surveyAttempts.submit, {
        attemptId: attemptInfo!.attemptId,
        answers: [
          { questionId: qNps, numericValue: 15 },
          { questionId: qChoices, selectedOptions: ["Taste"] },
        ],
      })
    ).rejects.toThrow("Rating must be at most 10");

    // 3. Validate invalid choice option fails
    await expect(
      t.mutation(api.surveyAttempts.submit, {
        attemptId: attemptInfo!.attemptId,
        answers: [
          { questionId: qNps, numericValue: 9 },
          { questionId: qChoices, selectedOptions: ["Invalid Option Not In Config"] },
        ],
      })
    ).rejects.toThrow('Invalid option "Invalid Option Not In Config"');

    // 4. Validate invalid date format fails
    await expect(
      t.mutation(api.surveyAttempts.submit, {
        attemptId: attemptInfo!.attemptId,
        answers: [
          { questionId: qNps, numericValue: 9 },
          { questionId: qChoices, selectedOptions: ["Taste", "Speed"] },
          { questionId: qDate, answerText: "31-12-2024" },
        ],
      })
    ).rejects.toThrow("Date must be in YYYY-MM-DD format");

    // 5. Successful submission
    const submitResult = await t.mutation(api.surveyAttempts.submit, {
      attemptId: attemptInfo!.attemptId,
      answers: [
        { questionId: qNps, numericValue: 9 },
        { questionId: qChoices, selectedOptions: ["Taste", "Speed"] },
        { questionId: qDate, answerText: "2026-09-16" },
      ],
    });

    expect(submitResult.success).toBe(true);
    expect(submitResult.afterSurveyContent).toBe("Thanks for dining with us!");

    // Verify attempt is now published
    const updatedRespondentData = await t.query(api.surveyAttempts.getForRespondent, {
      attemptId: attemptInfo!.attemptId,
    });
    expect(updatedRespondentData!.published).toBe(true);
  });

  // ====================================================
  // 4. DOUBLE SUBMISSION & IDEMPOTENCY
  // ====================================================

  test("7. Repeated attempt creation and double submission updates answers idempotently", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();

    const surveyId = await admin.mutation(api.surveys.create, {
      name: "Idempotency Survey",
      active: true,
    });

    const q1Id = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "numeric",
      questionText: "Rating",
    });

    const orderId = await createTestOrder(t, orgId);

    // Call 1: creates attempt
    const attempt1 = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId });
    // Call 2: returns same attempt
    const attempt2 = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId });

    expect(attempt1?.attemptId).toBe(attempt2?.attemptId);

    // Submit initial answer
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: attempt1!.attemptId,
      answers: [{ questionId: q1Id, numericValue: 8 }],
    });

    // Re-submit updated answer
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: attempt1!.attemptId,
      answers: [{ questionId: q1Id, numericValue: 10 }],
    });

    // Check responses in results
    const results = await admin.query(api.surveys.getResults, { surveyId });
    const npsQuestion = results.questions.find((q) => q.questionId === q1Id);
    expect(npsQuestion?.totalResponses).toBe(1);
    expect((npsQuestion as any).averageRating).toBe(10);
  });

  // ====================================================
  // 5. ANALYTICS & RESULTS CALCULATION
  // ====================================================

  test("8. Survey analytics aggregates choices, ratings, and filters by published state and date", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();

    const surveyId = await admin.mutation(api.surveys.create, {
      name: "Analytics Aggregation Survey",
      active: true,
    });

    const qRating = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "numeric",
      questionText: "Overall Rating",
    });

    const qChoice = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "checkbox",
      questionText: "Category",
      answerOptions: ["Food", "Ambience", "Service"],
    });

    // Create 3 orders and submit feedback for 2 (1 remains draft)
    const o1 = await createTestOrder(t, orgId);
    const o2 = await createTestOrder(t, orgId);
    const o3 = await createTestOrder(t, orgId);

    const att1 = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: o1 });
    const att2 = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: o2 });
    await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: o3 }); // unsubmitted draft

    await t.mutation(api.surveyAttempts.submit, {
      attemptId: att1!.attemptId,
      answers: [
        { questionId: qRating, numericValue: 10 },
        { questionId: qChoice, selectedOptions: ["Food", "Service"] },
      ],
    });

    await t.mutation(api.surveyAttempts.submit, {
      attemptId: att2!.attemptId,
      answers: [
        { questionId: qRating, numericValue: 6 },
        { questionId: qChoice, selectedOptions: ["Food", "Ambience"] },
      ],
    });

    const results = await admin.query(api.surveys.getResults, { surveyId });
    expect(results.totalPublishedAttempts).toBe(2);

    const ratingRes: any = results.questions.find((q) => q.questionId === qRating);
    expect(ratingRes.averageRating).toBe(8); // (10 + 6) / 2
    expect(ratingRes.totalResponses).toBe(2);
    expect(ratingRes.distribution[10]).toBe(1);
    expect(ratingRes.distribution[6]).toBe(1);

    const choiceRes: any = results.questions.find((q) => q.questionId === qChoice);
    expect(choiceRes.optionCounts["Food"]).toBe(2);
    expect(choiceRes.optionCounts["Service"]).toBe(1);
    expect(choiceRes.optionCounts["Ambience"]).toBe(1);
  });

  // ====================================================
  // 6. CUSTOMER SURVEY HISTORY & INTEGRATION
  // ====================================================

  test("9. Customer history and order surveyQrUrl integration", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();

    const surveyId = await admin.mutation(api.surveys.create, {
      name: "Customer CRM Survey",
      active: true,
    });

    const qText = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "short",
      questionText: "Review",
    });

    const orderId = await createTestOrder(t, orgId, "+919876543210");

    const attempt = await t.mutation(api.surveyAttempts.getOrCreateForOrder, {
      orderId,
      customerId: "cust_vip_456",
    });

    // Check that order details exposes surveyQrUrl
    const orderDetails = await admin.query(api.orders.getOrderDetails, { id: orderId });
    expect(orderDetails?.surveyQrUrl).toBeDefined();
    expect(orderDetails?.surveyQrUrl).toContain(attempt?.attemptId);

    // Submit customer feedback
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: attempt!.attemptId,
      answers: [{ questionId: qText, answerText: "Loved the pasta!" }],
    });

    // Query customer history
    const history = await admin.query(api.surveyAttempts.listByCustomer, {
      customerId: "cust_vip_456",
    });

    expect(history.length).toBe(1);
    expect(history[0].surveyName).toBe("Customer CRM Survey");
    expect(history[0].answers[0].answerText).toBe("Loved the pasta!");
  });

  // ====================================================
  // 7. CASCADING DELETION CLEANUP
  // ====================================================

  test("10. Deleting a survey cascades to its questions, attempts, and answers", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();

    const surveyId = await admin.mutation(api.surveys.create, {
      name: "Survey to Delete",
      active: true,
    });

    const qId = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "short",
      questionText: "Temp Question",
    });

    const orderId = await createTestOrder(t, orgId);

    const attempt = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId });
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: attempt!.attemptId,
      answers: [{ questionId: qId, answerText: "Sample" }],
    });

    // Delete survey
    await admin.mutation(api.surveys.remove, { id: surveyId });

    // Verify survey is gone
    await expect(admin.query(api.surveys.get, { id: surveyId })).rejects.toThrow(
      "Survey not found"
    );

    // Verify attempt is gone
    await expect(
      t.query(api.surveyAttempts.getForRespondent, { attemptId: attempt!.attemptId })
    ).rejects.toThrow("Survey attempt not found");
  });

  // ====================================================
  // 8. DEFAULT STORE SEEDING
  // ====================================================

  test("11. Default survey and 4 standard questions are seeded idempotently during store initialization", async () => {
    const { t, orgId } = await setupStoreWithAdmin();

    // Trigger store initialization
    await t.mutation(api.organizations.initializeStore, { id: orgId });

    const activeSurvey = await t.query(api.surveys.getActive, {});
    expect(activeSurvey).not.toBeNull();
    expect(activeSurvey?.name).toBe("Customer Feedback Survey");
    expect(activeSurvey?.active).toBe(true);
    expect(activeSurvey?.questions.length).toBe(4);

    expect(activeSurvey?.questions[0].type).toBe("numeric");
    expect(activeSurvey?.questions[1].type).toBe("checkbox");
    expect(activeSurvey?.questions[2].type).toBe("checkbox");
    expect(activeSurvey?.questions[3].type).toBe("long");

    // Re-running initialization must be idempotent
    await t.mutation(api.organizations.initializeStore, { id: orgId });
    const activeSurveyAgain = await t.query(api.surveys.getActive, {});
    expect(activeSurveyAgain?.questions.length).toBe(4);
  });

  // ====================================================
  // 9. DASHBOARD ENRICHMENT & STORE-WIDE REVIEW METRICS
  // ====================================================

  test("12. surveys.list accurately enriches surveys with question count and published reviewsCount (excluding drafts)", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();

    const survey1Id = await admin.mutation(api.surveys.create, {
      name: "Dinner Experience Feedback",
      introduction: "Thank you for dining with us.",
      active: true,
    });

    const survey2Id = await admin.mutation(api.surveys.create, {
      name: "Food & Service Quality",
      introduction: "Quick feedback on our kitchen.",
      active: false,
    });

    // Add 2 questions to survey 1, 1 question to survey 2
    const q1 = await admin.mutation(api.surveyQuestions.create, {
      surveyId: survey1Id,
      type: "numeric",
      questionText: "Rating",
    });
    await admin.mutation(api.surveyQuestions.create, {
      surveyId: survey1Id,
      type: "long",
      questionText: "Feedback",
    });
    await admin.mutation(api.surveyQuestions.create, {
      surveyId: survey2Id,
      type: "short",
      questionText: "Suggestions",
    });

    // Create 3 orders
    const o1 = await createTestOrder(t, orgId);
    const o2 = await createTestOrder(t, orgId);
    const o3 = await createTestOrder(t, orgId);

    // Attempt 1: published for survey 1
    const att1 = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: o1 });
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: att1!.attemptId,
      answers: [{ questionId: q1, numericValue: 5 }],
    });

    // Attempt 2: published for survey 1
    const att2 = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: o2 });
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: att2!.attemptId,
      answers: [{ questionId: q1, numericValue: 4 }],
    });

    // Attempt 3: unsubmitted draft for survey 1 (MUST BE EXCLUDED)
    await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: o3 });

    // Call api.surveys.list
    const listResult = await admin.query(api.surveys.list, {});
    expect(listResult.length).toBe(2);

    const s1 = listResult.find((s) => s._id === survey1Id);
    expect(s1).toBeDefined();
    expect(s1?.questionsCount).toBe(2);
    expect(s1?.reviewsCount).toBe(2); // Only the 2 published attempts!
    expect(s1?.publishedAttemptsCount).toBe(2);

    const s2 = listResult.find((s) => s._id === survey2Id);
    expect(s2).toBeDefined();
    expect(s2?.questionsCount).toBe(1);
    expect(s2?.reviewsCount).toBe(0); // 0 reviews
  });

  test("13. surveys.getTotalReviews and getDashboardMetrics return accurate metrics and enforce survey admin auth", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();

    const surveyId = await admin.mutation(api.surveys.create, {
      name: "Metric Test Survey",
      active: true,
    });

    const qId = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "numeric",
      questionText: "Score",
    });

    const o1 = await createTestOrder(t, orgId);
    const att1 = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: o1 });
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: att1!.attemptId,
      answers: [{ questionId: qId, numericValue: 10 }],
    });

    // Draft attempt that should be excluded
    const o2 = await createTestOrder(t, orgId);
    await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: o2 });

    // 1. Authorized admin queries total reviews
    const totalReviewsRes = await admin.query(api.surveys.getTotalReviews, {});
    expect(totalReviewsRes.totalReviews).toBe(1);

    // 2. Authorized admin queries dashboard metrics
    const metrics = await admin.query(api.surveys.getDashboardMetrics, {});
    expect(metrics.totalSurveys).toBe(1);
    expect(metrics.activeSurveysCount).toBe(1);
    expect(metrics.activeSurveyId).toBe(surveyId);
    expect(metrics.totalReviews).toBe(1);

    // 3. Unauthorized caller should be rejected by requireSurveyAdmin
    const unauth = t.withIdentity({ role: "guest", subject: "unauth_guest_user" });
    await expect(unauth.query(api.surveys.getTotalReviews, {})).rejects.toThrow();
    await expect(unauth.query(api.surveys.getDashboardMetrics, {})).rejects.toThrow();
  });

  // ====================================================
  // 14. CREATE SURVEY STEP 1: BASIC SETUP & DRAFT LIFECYCLE
  // ====================================================

  test("14. Create Survey Step 1: Basic Setup persists name, intro, and thank-you message as draft", async () => {
    const { t, admin } = await setupStoreWithAdmin();

    // 1. Survey Name is required and rejects empty or whitespace-only names
    await expect(
      admin.mutation(api.surveys.create, {
        name: "",
      })
    ).rejects.toThrow("Survey name is required");

    await expect(
      admin.mutation(api.surveys.create, {
        name: "    ",
      })
    ).rejects.toThrow("Survey name is required");

    // 2. Successful creation of survey draft with optional introduction and thank-you message
    const draftSurveyId = await admin.mutation(api.surveys.create, {
      name: "Guest Dining Experience",
      introduction: "We strive to deliver exceptional culinary artistry. Please take 60 seconds.",
      afterSurveyContent: "Thank you for dining with PREST. We look forward to welcoming you back soon!",
      active: false,
    });

    expect(draftSurveyId).toBeDefined();

    // 3. Query survey list to verify persisted values and initial draft status
    const allSurveys = await admin.query(api.surveys.list, {});
    const created = allSurveys.find((s) => s._id === draftSurveyId);

    expect(created).toBeDefined();
    expect(created?.name).toBe("Guest Dining Experience");
    expect(created?.introduction).toBe(
      "We strive to deliver exceptional culinary artistry. Please take 60 seconds."
    );
    expect(created?.afterSurveyContent).toBe(
      "Thank you for dining with PREST. We look forward to welcoming you back soon!"
    );
    expect(created?.active).toBe(false); // Saved as initial draft
    expect(created?.questionsCount).toBe(0); // No questions configured in Step 1
    expect(created?.reviewsCount).toBe(0);

    // 4. Inactive draft does not become the active survey for customers
    const activeSurvey = await t.query(api.surveys.getActive, {});
    expect(activeSurvey).toBeNull();
  });

  // ====================================================
  // 15. STEP 2: QUESTION BUILDER LIFECYCLE & HAS_RESPONSES
  // ====================================================

  test("15. Step 2 Question Builder: Question CRUD, reorder, duplicate, delete, and hasResponses detection", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();

    // 1. Create draft survey in Step 1
    const surveyId = await admin.mutation(api.surveys.create, {
      name: "Dinner Experience Survey",
      introduction: "Please tell us how was your dinner tonight.",
      active: false,
    });

    // 2. Add Question 1: Numeric rating (1-5)
    const q1Id = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "numeric",
      questionText: "How would you rate your overall dining experience tonight?",
      placeholder: "1 = Poor, 5 = Exceptional",
      validationRules: { presence: true, greaterThanOrEqualTo: 1, lessThanOrEqualTo: 5 },
    });

    // 3. Add Question 2: Single choice (radio)
    const q2Id = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "radio",
      questionText: "How was the speed of service during your meal?",
      answerOptions: ["Excellent", "Good", "Average", "Needs Improvement"],
      validationRules: { presence: true },
    });

    // 4. Add Question 3: Long text
    const q3Id = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "long",
      questionText: "Any specific compliments or feedback for our culinary team?",
      placeholder: "Share what stood out...",
      validationRules: { presence: false, maximumLength: 300 },
    });

    // 5. Query survey with questions via api.surveys.get
    let surveyData = await admin.query(api.surveys.get, { id: surveyId });
    expect(surveyData.questions).toHaveLength(3);
    expect(surveyData.questions[0]._id).toBe(q1Id);
    expect(surveyData.questions[0].hasResponses).toBe(false);
    expect(surveyData.questions[1]._id).toBe(q2Id);
    expect(surveyData.questions[1].hasResponses).toBe(false);

    // 6. Duplicate Question 2
    const duplicatedQId = await admin.mutation(api.surveyQuestions.copy, {
      questionId: q2Id,
    });
    surveyData = await admin.query(api.surveys.get, { id: surveyId });
    expect(surveyData.questions).toHaveLength(4);
    const duplicated = surveyData.questions.find((q) => q._id === duplicatedQId);
    expect(duplicated?.questionText).toBe("Copy of How was the speed of service during your meal?");
    expect(duplicated?.type).toBe("radio");
    expect(duplicated?.answerOptions).toEqual(["Excellent", "Good", "Average", "Needs Improvement"]);

    // 7. Reorder questions: Move q3 to the top
    await admin.mutation(api.surveyQuestions.reorder, {
      surveyId,
      questionIds: [q3Id, q1Id, q2Id, duplicatedQId],
    });
    surveyData = await admin.query(api.surveys.get, { id: surveyId });
    expect(surveyData.questions[0]._id).toBe(q3Id);
    expect(surveyData.questions[1]._id).toBe(q1Id);

    // 8. Delete the duplicated question
    await admin.mutation(api.surveyQuestions.remove, { id: duplicatedQId });
    surveyData = await admin.query(api.surveys.get, { id: surveyId });
    expect(surveyData.questions).toHaveLength(3);
    expect(surveyData.questions.find((q) => q._id === duplicatedQId)).toBeUndefined();

    // 9. Simulate a response submitted for q1 and verify hasResponses becomes true
    const orderId = await createTestOrder(t, orgId, "+919999988888");
    await t.run(async (ctx: any) => {
      const now = Date.now();
      const attemptId = await ctx.db.insert("surveyAttempts", {
        surveyId,
        orderId,
        published: true,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("surveyAnswers", {
        attemptId,
        questionId: q1Id,
        numericValue: 5,
        createdAt: now,
        updatedAt: now,
      });
    });

    surveyData = await admin.query(api.surveys.get, { id: surveyId });
    const q1Updated = surveyData.questions.find((q) => q._id === q1Id);
    expect(q1Updated?.hasResponses).toBe(true);

    // 10. Attempting to change type of q1 should now be rejected by backend lock
    await expect(
      admin.mutation(api.surveyQuestions.update, {
        id: q1Id,
        type: "long",
      })
    ).rejects.toThrow("Question type cannot be changed after answers have been added");
  });

  // ====================================================
  // 16. ENHANCED QUESTION CONFIGURATION & PER-ITEM PERSISTENCE
  // ====================================================

  test("16. Enhanced Question Configuration: ratingDisplayMode, lowLabel, highLabel, frequency, duplication, and per-item answer persistence", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();

    const surveyId = await admin.mutation(api.surveys.create, {
      name: "Dish Quality Survey",
      active: true,
    });

    // 1. Create a question with advanced rating configuration and per-order-item frequency
    const dishRatingQId = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "numeric",
      questionText: "How would you rate the quality and taste of this dish?",
      ratingDisplayMode: "stars",
      lowLabel: "Poor",
      highLabel: "Exceptional",
      frequency: "per_order_item",
      validationRules: {
        presence: true,
        greaterThanOrEqualTo: 1,
        lessThanOrEqualTo: 5,
      },
    });

    // 2. Verify stored properties via surveys.get
    let surveyData = await admin.query(api.surveys.get, { id: surveyId });
    const dishQ = surveyData.questions.find((q) => q._id === dishRatingQId);
    expect(dishQ).toBeDefined();
    expect(dishQ?.ratingDisplayMode).toBe("stars");
    expect(dishQ?.lowLabel).toBe("Poor");
    expect(dishQ?.highLabel).toBe("Exceptional");
    expect(dishQ?.frequency).toBe("per_order_item");

    // 3. Update the question's configuration
    await admin.mutation(api.surveyQuestions.update, {
      id: dishRatingQId,
      ratingDisplayMode: "numeric",
      lowLabel: "Terrible",
      highLabel: "Superb",
      frequency: "once_per_order",
    });

    surveyData = await admin.query(api.surveys.get, { id: surveyId });
    const updatedDishQ = surveyData.questions.find((q) => q._id === dishRatingQId);
    expect(updatedDishQ?.ratingDisplayMode).toBe("numeric");
    expect(updatedDishQ?.lowLabel).toBe("Terrible");
    expect(updatedDishQ?.highLabel).toBe("Superb");
    expect(updatedDishQ?.frequency).toBe("once_per_order");

    // 4. Duplicate the question and verify cloned configuration is preserved
    const copiedQId = await admin.mutation(api.surveyQuestions.copy, {
      questionId: dishRatingQId,
    });
    surveyData = await admin.query(api.surveys.get, { id: surveyId });
    const copiedQ = surveyData.questions.find((q) => q._id === copiedQId);
    expect(copiedQ).toBeDefined();
    expect(copiedQ?.ratingDisplayMode).toBe("numeric");
    expect(copiedQ?.lowLabel).toBe("Terrible");
    expect(copiedQ?.highLabel).toBe("Superb");
    expect(copiedQ?.frequency).toBe("once_per_order");

    // 5. Create a per-dish question and verify customer response submission with orderItemId / orderItemName
    const perDishQId = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "numeric",
      questionText: "Rate each dish you ordered",
      frequency: "per_order_item",
      ratingDisplayMode: "stars",
      lowLabel: "Needs Work",
      highLabel: "Loved It",
    });

    const orderId = await createTestOrder(t, orgId);
    const attempt = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId });
    expect(attempt).not.toBeNull();

    // Submit answers repeating for distinct dishes
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: attempt!.attemptId,
      answers: [
        {
          questionId: perDishQId,
          numericValue: 5,
          orderItemId: "item_paneer_tikka_101",
          orderItemName: "Paneer Tikka",
        },
        {
          questionId: perDishQId,
          numericValue: 4,
          orderItemId: "item_butter_naan_102",
          orderItemName: "Butter Naan",
        },
      ],
    });

    // Verify stored answers in the database
    await t.run(async (ctx: any) => {
      const answers = await ctx.db
        .query("surveyAnswers")
        .withIndex("by_attempt_id", (q: any) => q.eq("attemptId", attempt!.attemptId))
        .collect();

      expect(answers).toHaveLength(2);

      const paneerAnswer = answers.find(
        (a: any) => a.orderItemId === "item_paneer_tikka_101"
      );
      expect(paneerAnswer).toBeDefined();
      expect(paneerAnswer?.orderItemName).toBe("Paneer Tikka");
      expect(paneerAnswer?.numericValue).toBe(5);

      const naanAnswer = answers.find(
        (a: any) => a.orderItemId === "item_butter_naan_102"
      );
      expect(naanAnswer).toBeDefined();
      expect(naanAnswer?.orderItemName).toBe("Butter Naan");
      expect(naanAnswer?.numericValue).toBe(4);
    });

    // 6. Verify older question backward compatibility (no optional fields provided)
    const legacyQId = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "short",
      questionText: "Legacy text question without new options",
    });
    surveyData = await admin.query(api.surveys.get, { id: surveyId });
    const legacyQ = surveyData.questions.find((q) => q._id === legacyQId);
    expect(legacyQ).toBeDefined();
    expect(legacyQ?.frequency).toBe("once_per_order"); // defaults to once_per_order
    expect(legacyQ?.ratingDisplayMode).toBeUndefined();
    expect(legacyQ?.lowLabel).toBeUndefined();
    expect(legacyQ?.highLabel).toBeUndefined();
  });

  // ====================================================
  // 17. INDIVIDUAL SURVEY ANALYTICS & GETRESULTS INTEGRITY
  // ====================================================

  test("17. Individual Survey Analytics: overall rating, distributions, choice aggregates, enriched feedback verbatims, and date filtering", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();

    // 1. Create survey
    const surveyId = await admin.mutation(api.surveys.create, {
      name: "Guest Dining Experience",
      active: true,
    });

    // 2. Configure questions: Q1 (Numeric), Q2 (Single choice), Q3 (Multi-choice), Q4 (Long text)
    const q1 = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "numeric",
      questionText: "How would you rate your overall dining experience tonight?",
      validationRules: { presence: true, greaterThanOrEqualTo: 1, lessThanOrEqualTo: 5 },
    });

    const q2 = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "radio",
      questionText: "How was the speed of service during your meal?",
      answerOptions: ["Excellent", "Good", "Average", "Needs Improvement"],
    });

    const q3 = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "checkbox",
      questionText: "What dishes or courses did you enjoy most?",
      answerOptions: ["Main Courses", "Starters", "Desserts", "Cocktails"],
    });

    const q4 = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "long",
      questionText: "Any specific compliments or feedback for our culinary & floor team?",
    });

    // 3. Create test table and orders
    let tableId: any;
    await t.run(async (ctx: any) => {
      tableId = await ctx.db.insert("organizationTables", {
        tableNumber: "12",
        seatingCapacity: 4,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const o1 = await createTestOrder(t, orgId);
    const o2 = await createTestOrder(t, orgId);
    const oDraft = await createTestOrder(t, orgId);

    // Link table to order 1
    await t.run(async (ctx: any) => {
      await ctx.db.patch(o1, { tableId, orderType: "DineIn" });
      await ctx.db.patch(o2, { orderType: "TakeAway" });
    });

    // Create 3 attempts: att1 & att2 submitted, attDraft unsubmitted
    const att1 = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: o1 });
    const att2 = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: o2 });
    await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: oDraft });

    // Submit attempt 1
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: att1!.attemptId,
      answers: [
        { questionId: q1, numericValue: 5 },
        { questionId: q2, selectedOptions: ["Excellent"] },
        { questionId: q3, selectedOptions: ["Main Courses", "Starters"] },
        { questionId: q4, answerText: "The truffle risotto was exceptional!" },
      ],
    });

    // Submit attempt 2
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: att2!.attemptId,
      answers: [
        { questionId: q1, numericValue: 4 },
        { questionId: q2, selectedOptions: ["Good"] },
        { questionId: q3, selectedOptions: ["Main Courses", "Desserts"] },
        { questionId: q4, answerText: "Great food, fast takeaway." },
      ],
    });

    // 4. Query results via admin
    const analytics = await admin.query(api.surveys.getResults, { surveyId });

    expect(analytics.surveyId).toBe(surveyId);
    expect(analytics.surveyName).toBe("Guest Dining Experience");
    expect(analytics.active).toBe(true);
    expect(analytics.totalPublishedAttempts).toBe(2); // Draft excluded
    expect(analytics.totalAttempts).toBe(3); // 2 submitted + 1 draft
    expect(analytics.completionRate).toBe(67); // 2/3 = 67%

    // 5. Verify overall rating
    expect(analytics.overallRating).not.toBeNull();
    expect(analytics.overallRating?.average).toBe(4.5); // (5 + 4) / 2
    expect(analytics.overallRating?.scaleMin).toBe(1);
    expect(analytics.overallRating?.scaleMax).toBe(5);
    expect(analytics.overallRating?.totalResponses).toBe(2);

    // 6. Verify Numeric Rating question distribution
    const numQ: any = analytics.questions.find((q) => q.questionId === q1);
    expect(numQ.averageRating).toBe(4.5);
    expect(numQ.totalResponses).toBe(2);
    expect(numQ.distribution[5]).toBe(1);
    expect(numQ.distribution[4]).toBe(1);

    // 7. Verify Single Choice question
    const singleQ: any = analytics.questions.find((q) => q.questionId === q2);
    expect(singleQ.totalResponses).toBe(2);
    expect(singleQ.optionCounts["Excellent"]).toBe(1);
    expect(singleQ.optionCounts["Good"]).toBe(1);
    expect(singleQ.optionCounts["Average"]).toBe(0);

    // 8. Verify Multiple Choice question
    const multiQ: any = analytics.questions.find((q) => q.questionId === q3);
    expect(multiQ.totalResponses).toBe(2); // 2 respondents
    expect(multiQ.totalSelections).toBe(4); // 2 + 2 = 4 selections
    expect(multiQ.optionCounts["Main Courses"]).toBe(2);
    expect(multiQ.optionCounts["Starters"]).toBe(1);
    expect(multiQ.optionCounts["Desserts"]).toBe(1);

    // 9. Verify Enriched Written Feedback Verbatims
    const textQ: any = analytics.questions.find((q) => q.questionId === q4);
    expect(textQ.totalResponses).toBe(2);
    expect(textQ.responseRate).toBe(100);
    expect(textQ.responses).toHaveLength(2);

    const firstComment = textQ.responses.find((r: any) =>
      r.answerText.includes("truffle risotto")
    );
    expect(firstComment).toBeDefined();
    expect(firstComment?.tableNumber).toBe("Table 12");
    expect(firstComment?.serviceMode).toBe("Dinner Service");
    expect(firstComment?.ratingBadges.length).toBeGreaterThan(0);
    expect(firstComment?.ratingBadges[0].score).toBe(5);

    const secondComment = textQ.responses.find((r: any) =>
      r.answerText.includes("takeaway")
    );
    expect(secondComment).toBeDefined();
    expect(secondComment?.serviceMode).toBe("Takeaway");
    expect(secondComment?.ratingBadges[0].score).toBe(4);

    // 10. Date filtering: Querying with a future window should return 0 results cleanly
    const futureResults = await admin.query(api.surveys.getResults, {
      surveyId,
      fromDate: Date.now() + 1000000,
    });
    expect(futureResults.totalPublishedAttempts).toBe(0);
    const futureTextQ: any = futureResults.questions.find((q) => q.questionId === q4);
    expect(futureTextQ.totalResponses).toBe(0);
    expect(futureTextQ.responses).toHaveLength(0);

    // 11. Empty survey returns 0 published attempts without throwing
    const emptySurveyId = await admin.mutation(api.surveys.create, {
      name: "Empty Survey",
      active: false,
    });
    const emptyResults = await admin.query(api.surveys.getResults, { surveyId: emptySurveyId });
    expect(emptyResults.totalPublishedAttempts).toBe(0);
    expect(emptyResults.overallRating).toBeNull();
    expect(emptyResults.questions).toHaveLength(0);
  });

  // ====================================================
  // 18. QUESTION COVERAGE (4/4 RENDERED) & ATOMIC ACTIVATION POLICY
  // ====================================================

  test("18. Question Coverage & Activation: all 4 questions returned even if 0 responses, and atomic single-active activation policy", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();

    // 1. Create survey with 4 distinct questions: Numeric, Dropdown (select), Checkbox, Short text
    const surveyAId = await admin.mutation(api.surveys.create, {
      name: "Survey A - Full 4 Question Set",
      active: true,
    });

    const q1 = await admin.mutation(api.surveyQuestions.create, {
      surveyId: surveyAId,
      type: "numeric",
      questionText: "Rate Food Quality",
    });

    const q2 = await admin.mutation(api.surveyQuestions.create, {
      surveyId: surveyAId,
      type: "select",
      questionText: "How did you hear about us?",
      answerOptions: ["Instagram", "Friend Recommendation", "Walk In", "Google Maps"],
    });

    const q3 = await admin.mutation(api.surveyQuestions.create, {
      surveyId: surveyAId,
      type: "checkbox",
      questionText: "Dietary Preferences",
      answerOptions: ["Vegetarian", "Vegan", "Gluten Free", "None"],
    });

    const q4 = await admin.mutation(api.surveyQuestions.create, {
      surveyId: surveyAId,
      type: "short",
      questionText: "Server Name / Compliments",
    });

    // 2. Submit responses ONLY for Q1 and Q4 (leaving Q2 and Q3 with 0 responses)
    const o1 = await createTestOrder(t, orgId);
    const att1 = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: o1 });
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: att1!.attemptId,
      answers: [
        { questionId: q1, numericValue: 5 },
        { questionId: q4, answerText: "Raj was awesome!" },
      ],
    });

    // 3. Query getResults: MUST return all 4 questions in order
    const results = await admin.query(api.surveys.getResults, { surveyId: surveyAId });
    expect(results.questions).toHaveLength(4);

    // Q1 has responses
    const resQ1: any = results.questions.find((q) => q.questionId === q1);
    expect(resQ1).toBeDefined();
    expect(resQ1.totalResponses).toBe(1);
    expect(resQ1.averageRating).toBe(5);

    // Q2 (Dropdown) has 0 responses but is PRESERVED with its configured options
    const resQ2: any = results.questions.find((q) => q.questionId === q2);
    expect(resQ2).toBeDefined();
    expect(resQ2.totalResponses).toBe(0);
    expect(resQ2.optionCounts["Instagram"]).toBe(0);
    expect(resQ2.optionCounts["Walk In"]).toBe(0);

    // Q3 (Checkbox) has 0 responses but is PRESERVED with its configured options
    const resQ3: any = results.questions.find((q) => q.questionId === q3);
    expect(resQ3).toBeDefined();
    expect(resQ3.totalResponses).toBe(0);
    expect(resQ3.totalSelections).toBe(0);
    expect(resQ3.optionCounts["Vegetarian"]).toBe(0);

    // Q4 has responses
    const resQ4: any = results.questions.find((q) => q.questionId === q4);
    expect(resQ4).toBeDefined();
    expect(resQ4.totalResponses).toBe(1);
    expect(resQ4.responses[0].answerText).toBe("Raj was awesome!");

    // Date filtering with an empty range still preserves all 4 configured questions
    const emptyDateResults = await admin.query(api.surveys.getResults, {
      surveyId: surveyAId,
      fromDate: Date.now() + 5000000,
    });
    expect(emptyDateResults.questions).toHaveLength(4);
    expect(emptyDateResults.totalPublishedAttempts).toBe(0);

    // 4. Test Single-Active Activation Policy:
    // Create Survey B as draft
    const surveyBId = await admin.mutation(api.surveys.create, {
      name: "Survey B - Weekend Buffet",
      active: false,
    });

    let currentActive = await t.query(api.surveys.getActive, {});
    expect(currentActive?._id).toBe(surveyAId);

    // Activate Survey B using dedicated activate mutation
    await admin.mutation(api.surveys.activate, { id: surveyBId });

    // Verify Survey B is now active and Survey A is automatically deactivated
    const surveyAAfter = await admin.query(api.surveys.get, { id: surveyAId });
    const surveyBAfter = await admin.query(api.surveys.get, { id: surveyBId });
    expect(surveyBAfter.active).toBe(true);
    expect(surveyAAfter.active).toBe(false);

    // Verify customer-facing getActive now resolves Survey B
    const newActive = await t.query(api.surveys.getActive, {});
    expect(newActive?._id).toBe(surveyBId);
    expect(newActive?.name).toBe("Survey B - Weekend Buffet");

    // Verify Dashboard metrics report exactly 1 active survey
    const metrics = await admin.query(api.surveys.getDashboardMetrics, {});
    expect(metrics.activeSurveysCount).toBe(1);
    expect(metrics.activeSurveyId).toBe(surveyBId);
  });

  // ====================================================
  // 13. VIEW ALL COMMENTS / GUEST SUGGESTIONS DATA FLOW
  // ====================================================

  test("19. View All Comments: written responses retrieval, table/order attribution, ratings badge derivation, date boundary filtering, and cross-store isolation", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();

    // 1. Create survey with numeric ratings and text questions
    const surveyId = await admin.mutation(api.surveys.create, {
      name: "Guest Dining Experience",
      introduction: "Please share your dining experience.",
      active: true,
    });

    const q1 = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "numeric",
      questionText: "Overall Dining Experience",
      position: 1,
    });

    const q2 = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "numeric",
      questionText: "Service Speed",
      position: 2,
    });

    const q3 = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "long",
      questionText: "Guest Suggestions & Comments",
      position: 3,
    });

    const q4 = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "short",
      questionText: "Special Commendations",
      position: 4,
    });

    // Create table and order for Attempt 1
    const table12Id = await t.run(async (ctx: any) => {
      const now = Date.now();
      return await ctx.db.insert("organizationTables", {
        tableNumber: "12",
        seatingCapacity: 4,
        createdAt: now,
        updatedAt: now,
      });
    });

    const order1Id = await t.run(async (ctx: any) => {
      const now = Date.now();
      return await ctx.db.insert("orders", {
        organizationId: orgId,
        orderNumber: "#ORD-1012",
        tokenNumber: "12",
        orderType: "DineIn",
        orderSource: "POS",
        orderStatusName: "Completed",
        isCompleted: true,
        isRejected: false,
        isModify: false,
        subTotal: 1200,
        taxTotal: 60,
        totalAmount: 1260,
        paymentMode: "Cash",
        paymentStatus: "Paid",
        customerPhone: "+919876543210",
        tableId: table12Id,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Attempt 1: Table 12, DineIn, ratings 5 & 5, comments Q3 and Q4
    const att1 = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: order1Id });
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: att1!.attemptId,
      answers: [
        { questionId: q1, numericValue: 5 },
        { questionId: q2, numericValue: 5 },
        {
          questionId: q3,
          answerText: "The truffle risotto was exceptional! Staff was attentive throughout the evening.",
        },
        { questionId: q4, answerText: "Chef Marco is a genius!" },
      ],
    });

    // Create table and order for Attempt 2
    const table04Id = await t.run(async (ctx: any) => {
      const now = Date.now();
      return await ctx.db.insert("organizationTables", {
        tableNumber: "04",
        seatingCapacity: 2,
        createdAt: now,
        updatedAt: now,
      });
    });

    const order2Id = await t.run(async (ctx: any) => {
      const now = Date.now();
      return await ctx.db.insert("orders", {
        organizationId: orgId,
        orderNumber: "#ORD-1004",
        tokenNumber: "04",
        orderType: "DineIn",
        orderSource: "POS",
        orderStatusName: "Completed",
        isCompleted: true,
        isRejected: false,
        isModify: false,
        subTotal: 800,
        taxTotal: 40,
        totalAmount: 840,
        paymentMode: "Cash",
        paymentStatus: "Paid",
        customerPhone: "+919876543211",
        tableId: table04Id,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Attempt 2: Table 04, DineIn, ratings 4 & 3, comment Q3
    const att2 = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: order2Id });
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: att2!.attemptId,
      answers: [
        { questionId: q1, numericValue: 4 },
        { questionId: q2, numericValue: 3 },
        {
          questionId: q3,
          answerText: "Cocktails took a little time during peak rush, but food quality made up for it.",
        },
      ],
    });

    // Attempt 3: Order with no table (e.g. takeaway)
    const order3Id = await createTestOrder(t, orgId);
    const att3 = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: order3Id });
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: att3!.attemptId,
      answers: [
        { questionId: q1, numericValue: 4 },
        { questionId: q3, answerText: "Steak was cooked to perfection. Would love dairy-free desserts." },
      ],
    });

    // Attempt 4: Direct QR attempt without table or order (walk-in guest)
    const att4Id = await t.run(async (ctx: any) => {
      const now = Date.now();
      return await ctx.db.insert("surveyAttempts", {
        surveyId,
        published: false,
        createdAt: now,
        updatedAt: now,
      });
    });
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: att4Id,
      answers: [
        { questionId: q3, answerText: "Always our favorite anniversary dinner spot. Thank you Chef!" },
      ],
    });

    // Attempt 5: Only numeric ratings, no written comments
    const order5Id = await createTestOrder(t, orgId);
    const att5 = await t.mutation(api.surveyAttempts.getOrCreateForOrder, { orderId: order5Id });
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: att5!.attemptId,
      answers: [
        { questionId: q1, numericValue: 5 },
        { questionId: q2, numericValue: 4 },
      ],
    });

    // 2. Fetch results for All Comments screen via surveys.getResults
    const results = await admin.query(api.surveys.getResults, { surveyId });

    // Validate top-level survey metrics
    expect(results.surveyId).toBe(surveyId);
    expect(results.surveyName).toBe("Guest Dining Experience");
    expect(results.overallRating?.average).toBe(4.5);
    expect(results.questions).toHaveLength(4);

    // Validate Q3 (Long-Answer Feedback)
    const q3Result: any = results.questions.find((q) => q.questionId === q3);
    expect(q3Result).toBeDefined();
    expect(q3Result.totalResponses).toBe(4);
    expect(q3Result.responses).toHaveLength(4);

    // Verify Attempt 1 response enrichment
    const att1Comment = q3Result.responses.find((r: any) => r.attemptId === att1!.attemptId);
    expect(att1Comment).toBeDefined();
    expect(att1Comment.answerText).toBe(
      "The truffle risotto was exceptional! Staff was attentive throughout the evening."
    );
    expect(att1Comment.tableNumber).toBe("Table 12");
    expect(att1Comment.serviceMode).toBe("Dinner Service");
    expect(att1Comment.ratingBadges).toEqual(
      expect.arrayContaining([
        { label: "Overall", score: 5 },
        { label: "Speed", score: 5 },
      ])
    );

    // Verify Attempt 2 response enrichment
    const att2Comment = q3Result.responses.find((r: any) => r.attemptId === att2!.attemptId);
    expect(att2Comment).toBeDefined();
    expect(att2Comment.tableNumber).toBe("Table 04");
    expect(att2Comment.ratingBadges).toEqual(
      expect.arrayContaining([
        { label: "Overall", score: 4 },
        { label: "Speed", score: 3 },
      ])
    );

    // Verify Attempt 3 (no table) gracefully handles missing table
    const att3Comment = q3Result.responses.find((r: any) => r.attemptId === att3!.attemptId);
    expect(att3Comment).toBeDefined();
    expect(att3Comment.tableNumber).toBeUndefined();
    expect(att3Comment.orderNumber).toBeDefined();

    // Verify Attempt 4 (direct QR, no order or table)
    const att4Comment = q3Result.responses.find((r: any) => r.attemptId === att4Id);
    expect(att4Comment).toBeDefined();
    expect(att4Comment.tableNumber).toBeUndefined();
    expect(att4Comment.orderNumber).toBeUndefined();
    expect(att4Comment.ratingBadges).toHaveLength(0);

    // Validate Q4 (Short text commendations)
    const q4Result: any = results.questions.find((q) => q.questionId === q4);
    expect(q4Result).toBeDefined();
    expect(q4Result.totalResponses).toBe(1);
    expect(q4Result.responses[0].answerText).toBe("Chef Marco is a genius!");

    // 3. Date boundary filtering
    const pastBoundary = Date.now() - 100000;
    const filteredResults = await admin.query(api.surveys.getResults, {
      surveyId,
      fromDate: pastBoundary,
    });
    expect(filteredResults.totalPublishedAttempts).toBe(5);

    const futureResults = await admin.query(api.surveys.getResults, {
      surveyId,
      fromDate: Date.now() + 5000000,
    });
    expect(futureResults.totalPublishedAttempts).toBe(0);
    const futureQ3: any = futureResults.questions.find((q) => q.questionId === q3);
    expect(futureQ3.responses).toHaveLength(0);

    // 4. Store-level Authorization & Survey Isolation
    const { admin: foreignAdmin } = await setupStoreWithAdmin();
    await expect(
      foreignAdmin.query(api.surveys.getResults, { surveyId })
    ).rejects.toThrow("Survey not found");
  });

  // ====================================================
  // 14. ORDER RECEIPT INTEGRATION & CUSTOMER FEEDBACK QR
  // ====================================================

  test("20. Order Receipt & Review QR Binding: getOrCreateForOrder idempotency, getForRespondent order/item context, per-item answers submission, and reactive analytics connection", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();

    // 1. Create an active survey with both order-level and item-level questions
    const surveyId = await admin.mutation(api.surveys.create, {
      name: "Bistro Multi-Item + Star Rating",
      introduction: "Please evaluate your meal and dining service.",
      afterSurveyContent: "Thank you for reviewing your meal with PREST!",
      active: true,
    });

    const qOverall = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "numeric",
      questionText: "Overall Bistro Experience",
      position: 1,
      frequency: "once_per_order",
      ratingDisplayMode: "stars",
      lowLabel: "Poor",
      highLabel: "Exceptional",
    });

    const qItemRating = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "numeric",
      questionText: "Rate each dish",
      position: 2,
      frequency: "per_order_item",
      ratingDisplayMode: "stars",
    });

    const qComments = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "long",
      questionText: "Chef comments",
      position: 3,
      frequency: "once_per_order",
    });

    // 2. Create table, order, and order line items
    const tableId = await t.run(async (ctx: any) => {
      const now = Date.now();
      return await ctx.db.insert("organizationTables", {
        tableNumber: "14",
        seatingCapacity: 4,
        createdAt: now,
        updatedAt: now,
      });
    });

    const orderId = await t.run(async (ctx: any) => {
      const now = Date.now();
      return await ctx.db.insert("orders", {
        organizationId: orgId,
        orderNumber: "4829",
        tokenNumber: "14",
        orderType: "DineIn",
        orderSource: "POS",
        orderStatusName: "Completed",
        isCompleted: true,
        isRejected: false,
        isModify: false,
        subTotal: 116000,
        taxTotal: 11600,
        totalAmount: 127600,
        paymentMode: "Card",
        paymentStatus: "Paid",
        customerPhone: "+919521020647",
        customerEmail: "guest.table14@example.com",
        tableId,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Insert order items (Paneer Tikka, Butter Naan, Dal Makhani)
    const item1Id = await t.run(async (ctx: any) => {
      const now = Date.now();
      return await ctx.db.insert("orderItems", {
        organizationId: orgId,
        orderId,
        itemId: "dummyItem1" as any,
        itemName: "Paneer Tikka",
        itemPrice: 34000,
        quantity: 1,
        totalPrice: 34000,
        isReady: true,
        createdAt: now,
      });
    });

    const item2Id = await t.run(async (ctx: any) => {
      const now = Date.now();
      return await ctx.db.insert("orderItems", {
        organizationId: orgId,
        orderId,
        itemId: "dummyItem2" as any,
        itemName: "Dal Makhani",
        itemPrice: 38000,
        quantity: 1,
        totalPrice: 38000,
        isReady: true,
        createdAt: now,
      });
    });

    // 3. Test getOrCreateForOrder (Idempotent QR Binding)
    const binding1 = await t.mutation(api.surveyAttempts.getOrCreateForOrder, {
      orderId,
      publicBaseUrl: "https://prest.dine",
    });
    expect(binding1).not.toBeNull();
    expect(binding1?.surveyId).toBe(surveyId);
    expect(binding1?.published).toBe(false);
    expect(binding1?.surveyQrUrl).toBe(`https://prest.dine/attempts/${binding1?.attemptId}`);

    // Call again to verify idempotency: must return existing attempt ID
    const binding2 = await t.mutation(api.surveyAttempts.getOrCreateForOrder, {
      orderId,
      publicBaseUrl: "https://prest.dine",
    });
    expect(binding2?.attemptId).toBe(binding1?.attemptId);

    // 4. Test public respondent query (getForRespondent)
    const respondentView = await t.query(api.surveyAttempts.getForRespondent, {
      attemptId: binding1!.attemptId,
    });
    expect(respondentView!.surveyName).toBe("Bistro Multi-Item + Star Rating");
    expect(respondentView!.orderNumber).toBe("4829");
    expect(respondentView!.tableNumber).toBe("14");
    expect(respondentView!.orderItems).toHaveLength(2);
    expect(respondentView!.orderItems![0].name).toBe("Paneer Tikka");
    expect(respondentView!.orderItems![1].name).toBe("Dal Makhani");
    expect(respondentView!.questions).toHaveLength(3);
    expect(respondentView!.questions[1].frequency).toBe("per_order_item");

    // 5. Submit feedback including per-item evaluations
    await t.mutation(api.surveyAttempts.submit, {
      attemptId: binding1!.attemptId,
      answers: [
        { questionId: qOverall, numericValue: 5 },
        {
          questionId: qItemRating,
          orderItemId: item1Id,
          orderItemName: "Paneer Tikka",
          numericValue: 5,
        },
        {
          questionId: qItemRating,
          orderItemId: item2Id,
          orderItemName: "Dal Makhani",
          numericValue: 4,
        },
        {
          questionId: qComments,
          answerText: "Exceptional dining experience! The dal makhani was authentic and creamy.",
        },
      ],
    });

    // 6. Verify submission transitions attempt to published
    const updatedView = await t.query(api.surveyAttempts.getForRespondent, {
      attemptId: binding1!.attemptId,
    });
    expect(updatedView!.published).toBe(true);

    // 7. Verify submission is immediately reflected in survey analytics
    const results = await admin.query(api.surveys.getResults, { surveyId });
    expect(results.totalPublishedAttempts).toBe(1);
    expect(results.overallRating?.average).toBe(5);

    const qCommentsResult: any = results.questions.find((q) => q.questionId === qComments);
    expect(qCommentsResult.responses).toHaveLength(1);
    expect(qCommentsResult.responses[0].answerText).toContain("Exceptional dining experience!");
    expect(qCommentsResult.responses[0].tableNumber).toBe("Table 14");
    expect(qCommentsResult.responses[0].orderNumber).toBe("4829");
  });

  // ====================================================
  // 15. PRINTER & RECEIPT SETTINGS PERSISTENCE
  // ====================================================

  test("21. Hardware & Printer Settings: persistence of showQrCode, autoCutPaper, and popCashDrawer via organizations.update", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();

    // Initial state
    const initialOrg = await admin.query(api.organizations.get, { id: orgId });
    expect(initialOrg).not.toBeNull();

    // Toggle hardware settings
    await admin.mutation(api.organizations.update, {
      id: orgId,
      showQrCode: false,
      autoCutPaper: false,
      popCashDrawer: true,
    });

    const updatedOrg = await admin.query(api.organizations.get, { id: orgId });
    expect(updatedOrg?.showQrCode).toBe(false);
    expect(updatedOrg?.autoCutPaper).toBe(false);
    expect(updatedOrg?.popCashDrawer).toBe(true);

    // Toggle back
    await admin.mutation(api.organizations.update, {
      id: orgId,
      showQrCode: true,
      autoCutPaper: true,
      popCashDrawer: false,
    });

    const restoredOrg = await admin.query(api.organizations.get, { id: orgId });
    expect(restoredOrg?.showQrCode).toBe(true);
    expect(restoredOrg?.autoCutPaper).toBe(true);
    expect(restoredOrg?.popCashDrawer).toBe(false);
  });

  // ====================================================
  // 16. ORDER CUSTOMER REVIEW DETAILS & REAL FEEDBACK DATA
  // ====================================================

  test("22. Order Customer Review Details: intentional empty state when unreviewed, real review details retrieval, dish critiques, trailing benchmarks, and meeting flag", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();

    // 1. Create survey with questions
    const surveyId = await admin.mutation(api.surveys.create, {
      name: "Bistro Feedback Survey",
      active: true,
    });

    const qOverall = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "numeric",
      questionText: "Overall Dining Score",
      position: 1,
      frequency: "once_per_order",
    });

    const qDish = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "numeric",
      questionText: "Rate Dish",
      position: 2,
      frequency: "per_order_item",
    });

    const qNotes = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      type: "long",
      questionText: "Guest notes",
      position: 3,
      frequency: "once_per_order",
    });

    // 2. Create order with two dishes
    const orderId = await t.run(async (ctx: any) => {
      const now = Date.now();
      return await ctx.db.insert("orders", {
        organizationId: orgId,
        orderNumber: "4829",
        orderType: "DineIn",
        orderSource: "POS",
        orderStatusName: "Completed & Settled",
        paymentMode: "UPI Terminal #2",
        subTotal: 72000,
        taxTotal: 3600,
        totalAmount: 75600,
        isCompleted: true,
        createdAt: now,
        updatedAt: now,
      });
    });

    const item1Id = await t.run(async (ctx: any) => {
      const now = Date.now();
      const itemId = await ctx.db.insert("items", {
        organizationId: orgId,
        name: "Paneer Tikka",
        price: 34000,
        published: true,
        isAvailable: true,
        isGst: true,
        isVeg: true,
        isSpicy: false,
        showQuantity: false,
        markAsBestseller: true,
        showCalorie: false,
        createdAt: now,
        updatedAt: now,
      });
      return await ctx.db.insert("orderItems", {
        organizationId: orgId,
        orderId,
        itemId,
        itemName: "Paneer Tikka",
        itemPrice: 34000,
        quantity: 1,
        totalPrice: 34000,
        isReady: true,
        createdAt: now,
      });
    });

    const item2Id = await t.run(async (ctx: any) => {
      const now = Date.now();
      const itemId = await ctx.db.insert("items", {
        organizationId: orgId,
        name: "Dal Makhani",
        price: 38000,
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
      return await ctx.db.insert("orderItems", {
        organizationId: orgId,
        orderId,
        itemId,
        itemName: "Dal Makhani",
        itemPrice: 38000,
        quantity: 1,
        totalPrice: 38000,
        isReady: true,
        createdAt: now,
      });
    });

    // 3. Query before customer reviews -> Verify intentional Empty State
    const unreviewed = await admin.query(api.surveyAttempts.getOrderReviewDetails, {
      orderId,
    });
    expect(unreviewed).not.toBeNull();
    expect(unreviewed?.hasReview).toBe(false);
    expect(unreviewed?.review).toBeNull();
    expect(unreviewed?.order.orderNumber).toBe("4829");
    expect(unreviewed?.items).toHaveLength(2);
    expect(unreviewed?.items[0].customerScore).toBeNull();
    expect(unreviewed?.items[0].operationalStatus).toBe("Pending Review");

    // 4. Create review attempt and submit genuine responses
    const attemptRes = await admin.mutation(api.surveyAttempts.getOrCreateForOrder, {
      orderId,
    });
    expect(attemptRes).not.toBeNull();
    const attemptId = attemptRes!.attemptId;

    await admin.mutation(api.surveyAttempts.submit, {
      attemptId,
      answers: [
        {
          questionId: qOverall,
          numericValue: 5,
          answerText: "5",
        },
        {
          questionId: qDish,
          orderItemId: item1Id.toString(),
          orderItemName: "Paneer Tikka",
          numericValue: 5,
          answerText: "Excellent taste and tender cottage cheese!",
        },
        {
          questionId: qDish,
          orderItemId: item2Id.toString(),
          orderItemName: "Dal Makhani",
          numericValue: 3,
          answerText: "Good flavour, could be richer/creamier",
        },
        {
          questionId: qNotes,
          answerText: "The service was quick and the staff checked in politely. Really enjoyed the main courses.",
        },
      ],
    });

    // 5. Query after customer reviews -> Verify complete real data
    const reviewed = await admin.query(api.surveyAttempts.getOrderReviewDetails, {
      orderId,
    });
    expect(reviewed).not.toBeNull();
    expect(reviewed?.hasReview).toBe(true);
    expect(reviewed?.review?.overallScore).toBe(5);
    expect(reviewed?.review?.overallRatingLabel).toBe("Exceptional Dining Experience");
    expect(reviewed?.review?.customerVerbatim).toContain("Really enjoyed the main courses");
    expect(reviewed?.review?.sentimentTags).toContain("Prompt Service");
    expect(reviewed?.review?.sentimentTags).toContain("Polite Staff");
    expect(reviewed?.review?.itemsRatedCount).toBe(2);

    // Verify item-level scores and operational statuses
    const paneer = reviewed?.items.find((i) => i.itemName === "Paneer Tikka");
    expect(paneer?.customerScore).toBe(5);
    expect(paneer?.operationalStatus).toBe("Highly Commended");
    expect(paneer?.customerCritique).toBe("Excellent taste and tender cottage cheese!");

    const dal = reviewed?.items.find((i) => i.itemName === "Dal Makhani");
    expect(dal?.customerScore).toBe(3);
    expect(dal?.operationalStatus).toBe("Recipe Calibration Note");
    expect(dal?.customerCritique).toBe("Good flavour, could be richer/creamier");

    // Verify benchmarks
    expect(reviewed?.benchmarks).toHaveLength(2);
    const paneerBm = reviewed?.benchmarks.find((b) => b.itemName === "Paneer Tikka");
    expect(paneerBm?.thisBillScore).toBe(5);
    expect(paneerBm?.avgScore30d).toBe(5);

    // 6. Test Flag for Kitchen Meeting toggle mutation
    expect(reviewed?.review?.flaggedForMeeting).toBe(false);
    const flagRes = await admin.mutation(api.surveyAttempts.toggleFlagForMeeting, {
      attemptId,
    });
    expect(flagRes.success).toBe(true);
    expect(flagRes.flaggedForMeeting).toBe(true);

    const recheck = await admin.query(api.surveyAttempts.getOrderReviewDetails, {
      orderId,
    });
    expect(recheck?.review?.flaggedForMeeting).toBe(true);
  });

  // ====================================================
  // 9. GENUINE CUSTOMER DATA INTEGRITY
  // ====================================================

  test("23. Genuine review source and unrated item integrity", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();
    const orderId = await createTestOrder(t, orgId);

    // 1. Test genuine customer submission with custom source and unrated items
    const surveyId = await admin.mutation(api.surveys.create, {
      name: "Dine-In Feedback",
      introduction: "How was your meal?",
      afterSurveyContent: "Thank you!",
      active: true,
    });
    const qOverall = await admin.mutation(api.surveyQuestions.create, {
      surveyId,
      questionText: "How was your overall experience?",
      type: "numeric",
      position: 1,
      frequency: "once_per_order",
      validationRules: { presence: true },
    });

    const attemptRes = await admin.mutation(api.surveyAttempts.getOrCreateForOrder, {
      orderId,
      publicBaseUrl: "https://dev-pos-user.get-prest.com",
    });
    expect(attemptRes).not.toBeNull();
    expect(attemptRes!.surveyQrUrl).toContain("https://dev-pos-user.get-prest.com/attempts/");

    // Submit with explicit source
    await admin.mutation(api.surveyAttempts.submit, {
      attemptId: attemptRes!.attemptId,
      source: "Submitted via Customer Website",
      answers: [
        {
          questionId: qOverall,
          numericValue: 4,
          answerText: "4",
        },
      ],
    });

    // Query order review details
    const reviewDetails = await admin.query(api.surveyAttempts.getOrderReviewDetails, {
      orderId,
    });
    expect(reviewDetails?.hasReview).toBe(true);
    expect(reviewDetails?.review?.overallScore).toBe(4);
    expect(reviewDetails?.review?.source).toBe("Submitted via Customer Website");
    // Verify that server is not hardcoded to fake "Arjun K."
    expect(reviewDetails?.order.serverName ?? null).toBeNull();
    // Verify that unrated customer verbatim is null and not fake text
    expect(reviewDetails?.review?.customerVerbatim ?? null).toBeNull();
  });
});


