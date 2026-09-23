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

    expect(respondentData.surveyName).toBe("Public Validation Survey");
    expect(respondentData.published).toBe(false);
    expect(respondentData.questions.length).toBe(3);

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
    expect(updatedRespondentData.published).toBe(true);
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
});
