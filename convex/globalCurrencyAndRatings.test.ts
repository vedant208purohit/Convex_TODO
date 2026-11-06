/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { resolveOrganizationCurrency } from "../lib/constants/countries";

const modules = import.meta.glob("./**/*.*s");

describe("Global Multi-Currency Consistency & Survey Rating Accuracy Tests", () => {
  async function setupStoreWithAdmin(adminSubject = "user_admin_test") {
    const t = convexTest(schema, modules);
    const orgId = await t.mutation(api.organizations.create, {
      name: "DEFx POS Flagship",
      ownerClerkId: adminSubject,
    });
    const admin = t.withIdentity({ role: "admin", subject: adminSubject });
    return { t, orgId, admin };
  }

  async function createOrder(t: any, orgId: any) {
    return await t.run(async (ctx: any) => {
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
        subTotal: 2000,
        taxTotal: 100,
        totalAmount: 2100,
        paymentMode: "Cash",
        paymentStatus: "Paid",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  }

  describe("Phase 1 & Phase 2: Centralized Currency Resolution & Module Consistency", () => {
    test("UAE organization resolves to AED code and AED symbol across respondent data and order review", async () => {
      const { t, orgId, admin } = await setupStoreWithAdmin("user_uae_admin");

      await admin.mutation(api.organizations.update, {
        id: orgId,
        country: "AE",
        defaultCurrency: "AED",
        defaultCurrencySymbol: "AED",
      });

      const orderId = await t.run(async (ctx) => {
        return await ctx.db.insert("orders", {
          organizationId: orgId,
          orderNumber: "#ORD-DXB-101",
          tokenNumber: "01",
          orderType: "DineIn",
          orderSource: "POS",
          orderStatusName: "Completed",
          isCompleted: true,
          isRejected: false,
          isModify: false,
          subTotal: 15000,
          taxTotal: 750,
          totalAmount: 15750, // 157.50 AED
          currency: "AED",
          currencySymbol: "AED",
          paymentMode: "Card",
          paymentStatus: "Paid",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Fetch or create survey attempt for this order
      const attemptRes = await t.mutation(api.surveyAttempts.getOrCreateForOrder, {
        orderId,
      });

      // Verify respondent query returns AED
      const respondentData = await t.query(api.surveyAttempts.getForRespondent, {
        attemptId: attemptRes!.attemptId,
      });

      expect(respondentData).toBeDefined();
      expect(respondentData?.currencySymbol).toBe("AED");
      expect(respondentData?.country).toBe("AE");

      // Verify order review details returns AED
      const reviewDetails = await t.query(api.surveyAttempts.getOrderReviewDetails, {
        orderId,
      });

      expect(reviewDetails).toBeDefined();
      expect(reviewDetails?.order?.currencySymbol).toBe("AED");
      expect(reviewDetails?.order?.currencyCode).toBe("AED");
      expect(reviewDetails?.order?.country).toBe("AE");
    });

    test("Indian organization resolves to INR and ₹ symbol", async () => {
      const { t, orgId, admin } = await setupStoreWithAdmin("user_in_admin");

      await admin.mutation(api.organizations.update, {
        id: orgId,
        country: "IN",
        defaultCurrency: "INR",
        defaultCurrencySymbol: "₹",
      });

      const orderId = await t.run(async (ctx) => {
        return await ctx.db.insert("orders", {
          organizationId: orgId,
          orderNumber: "#ORD-MUM-202",
          tokenNumber: "02",
          orderType: "DineIn",
          orderSource: "POS",
          orderStatusName: "Completed",
          isCompleted: true,
          isRejected: false,
          isModify: false,
          subTotal: 50000,
          taxTotal: 2500,
          totalAmount: 52500, // ₹525.00
          currency: "INR",
          currencySymbol: "₹",
          paymentMode: "UPI",
          paymentStatus: "Paid",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const attemptRes = await t.mutation(api.surveyAttempts.getOrCreateForOrder, {
        orderId,
      });

      const respondentData = await t.query(api.surveyAttempts.getForRespondent, {
        attemptId: attemptRes!.attemptId,
      });

      expect(respondentData?.currencySymbol).toBe("₹");

      const reviewDetails = await t.query(api.surveyAttempts.getOrderReviewDetails, {
        orderId,
      });

      expect(reviewDetails?.order?.currencySymbol).toBe("₹");
      expect(reviewDetails?.order?.currencyCode).toBe("INR");
    });

    test("Central currency resolver handles missing organization fields safely", () => {
      // UAE with no defaultCurrencySymbol explicitly configured
      const uaeOrg = { country: "AE" };
      const uaeRes = resolveOrganizationCurrency(uaeOrg);
      expect(uaeRes.code).toBe("AED");
      expect(uaeRes.symbol).toBe("AED");

      // Empty org fallback
      const emptyRes = resolveOrganizationCurrency({});
      expect(emptyRes.code).toBe("INR");
      expect(emptyRes.symbol).toBe("₹");
    });
  });

  describe("Phase 4 & Phase 5: Survey Rating Accuracy & Bounded Validation", () => {
    test("Survey submission rejects star rating values greater than 5", async () => {
      const { t, orgId, admin } = await setupStoreWithAdmin("user_star_rating_admin");

      const surveyId = await admin.mutation(api.surveys.create, {
        name: "5-Star Dining Survey",
        active: true,
      });

      const questionId = await admin.mutation(api.surveyQuestions.create, {
        surveyId,
        type: "numeric",
        ratingDisplayMode: "stars",
        questionText: "How was your overall dining experience?",
        validationRules: {
          presence: true,
          greaterThanOrEqualTo: 1,
          lessThanOrEqualTo: 5,
        },
      });

      const orderId = await createOrder(t, orgId);

      const attemptRes = await t.mutation(api.surveyAttempts.getOrCreateForOrder, {
        orderId,
      });

      // Attempt submitting 6 out of 5 stars — MUST FAIL!
      await expect(
        t.mutation(api.surveyAttempts.submit, {
          attemptId: attemptRes!.attemptId,
          answers: [
            {
              questionId,
              numericValue: 6,
            },
          ],
        })
      ).rejects.toThrow(/Rating must be at most 5/);
    });

    test("Survey submission accepts valid rating within scale (1 to 5)", async () => {
      const { t, orgId, admin } = await setupStoreWithAdmin("user_valid_rating_admin");

      const surveyId = await admin.mutation(api.surveys.create, {
        name: "Valid Rating Dining Survey",
        active: true,
      });

      const questionId = await admin.mutation(api.surveyQuestions.create, {
        surveyId,
        type: "numeric",
        ratingDisplayMode: "stars",
        questionText: "How was your overall dining experience?",
        validationRules: {
          presence: true,
          greaterThanOrEqualTo: 1,
          lessThanOrEqualTo: 5,
        },
      });

      const orderId = await createOrder(t, orgId);

      const attemptRes = await t.mutation(api.surveyAttempts.getOrCreateForOrder, {
        orderId,
      });

      const submitRes = await t.mutation(api.surveyAttempts.submit, {
        attemptId: attemptRes!.attemptId,
        answers: [
          {
            questionId,
            numericValue: 5,
          },
        ],
      });

      expect(submitRes.success).toBe(true);
    });

    test("Order customer review details returns bounded overallScore <= maxScore", async () => {
      const { t, orgId, admin } = await setupStoreWithAdmin("user_review_details_admin");

      const surveyId = await admin.mutation(api.surveys.create, {
        name: "Order Review Survey",
        active: true,
      });

      const questionId = await admin.mutation(api.surveyQuestions.create, {
        surveyId,
        type: "numeric",
        ratingDisplayMode: "stars",
        questionText: "How was your overall dining experience?",
        validationRules: {
          presence: true,
          greaterThanOrEqualTo: 1,
          lessThanOrEqualTo: 5,
        },
      });

      const orderId = await createOrder(t, orgId);

      const attemptRes = await t.mutation(api.surveyAttempts.getOrCreateForOrder, {
        orderId,
      });

      await t.mutation(api.surveyAttempts.submit, {
        attemptId: attemptRes!.attemptId,
        answers: [
          {
            questionId,
            numericValue: 5,
          },
        ],
      });

      const reviewDetails = await t.query(api.surveyAttempts.getOrderReviewDetails, {
        orderId,
      });

      expect(reviewDetails?.hasReview).toBe(true);
      expect(reviewDetails?.review?.overallScore).toBeLessThanOrEqual(reviewDetails?.review?.maxScore!);
      expect(reviewDetails?.review?.maxScore).toBe(5.0);
      expect(reviewDetails?.review?.overallScore).toBe(5.0);
    });

    test("surveys.getAnalytics guarantees overallRating average is bounded by scaleMax", async () => {
      const { t, orgId, admin } = await setupStoreWithAdmin("user_analytics_admin");

      const surveyId = await admin.mutation(api.surveys.create, {
        name: "Analytics Bounded Dining Survey",
        active: true,
      });

      const questionId = await admin.mutation(api.surveyQuestions.create, {
        surveyId,
        type: "numeric",
        ratingDisplayMode: "stars",
        questionText: "How was your overall dining experience?",
        validationRules: {
          presence: true,
          greaterThanOrEqualTo: 1,
          lessThanOrEqualTo: 5,
        },
      });

      const orderId = await createOrder(t, orgId);

      const attemptRes = await t.mutation(api.surveyAttempts.getOrCreateForOrder, {
        orderId,
      });

      await t.mutation(api.surveyAttempts.submit, {
        attemptId: attemptRes!.attemptId,
        answers: [
          {
            questionId,
            numericValue: 4,
          },
        ],
      });

      const analytics = await admin.query(api.surveys.getResults, {
        surveyId,
      });

      expect(analytics.overallRating).not.toBeNull();
      expect(analytics.overallRating?.average).toBe(4);
      expect(analytics.overallRating?.scaleMin).toBe(1);
      expect(analytics.overallRating?.scaleMax).toBe(5);
      expect(analytics.overallRating?.average).toBeLessThanOrEqual(analytics.overallRating?.scaleMax!);
    });
  });
});
