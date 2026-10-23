"use client";

import React, { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export default function CustomerFeedbackPortalPage() {
  const params = useParams();
  const rawId = params?.id as string | undefined;
  const attemptId = rawId as Id<"surveyAttempts"> | undefined;

  // Fetch attempt data using public respondent query
  const respondentData = useQuery(
    api.surveyAttempts.getForRespondent,
    attemptId ? { attemptId } : "skip"
  );

  const submitSurvey = useMutation(api.surveyAttempts.submit);

  // Form State: Mapping questionId to answer object
  // For standard questions: answers[qId] = { answerText, numericValue, selectedOptions }
  // For item-level questions: itemAnswers[`${qId}_${itemId}`] = { orderItemId, orderItemName, answerText, numericValue, selectedOptions }
  const [answers, setAnswers] = useState<Record<string, {
    answerText?: string;
    numericValue?: number;
    selectedOptions?: string[];
  }>>({});

  const [itemAnswers, setItemAnswers] = useState<Record<string, {
    orderItemId: string;
    orderItemName: string;
    answerText?: string;
    numericValue?: number;
    selectedOptions?: string[];
  }>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize with any previously saved answers if resuming
  React.useEffect(() => {
    if (respondentData?.questions) {
      const initialAnswers: Record<string, any> = {};
      for (const q of respondentData.questions) {
        if (q.currentAnswer) {
          initialAnswers[q.id] = {
            answerText: q.currentAnswer.answerText,
            numericValue: q.currentAnswer.numericValue,
            selectedOptions: q.currentAnswer.selectedOptions,
          };
        }
      }
      if (Object.keys(initialAnswers).length > 0) {
        setAnswers((prev) => ({ ...initialAnswers, ...prev }));
      }
    }
  }, [respondentData]);

  // Loading Skeleton State
  if (respondentData === undefined) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] text-[#1A1A1A] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-[#E8E6E3] p-6 sm:p-8 flex flex-col gap-6 animate-pulse">
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-stone-200" />
            <div className="h-6 w-48 bg-stone-200 rounded" />
            <div className="h-4 w-32 bg-stone-200 rounded" />
          </div>
          <div className="flex flex-col gap-4">
            <div className="h-20 bg-stone-100 rounded-xl" />
            <div className="h-20 bg-stone-100 rounded-xl" />
            <div className="h-20 bg-stone-100 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // Error / Not Found State
  if (!respondentData) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] text-[#1A1A1A] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-[#E8E6E3] p-8 text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[28px]">link_off</span>
          </div>
          <h2 className="text-xl font-bold text-[#1A1A1A]">Invalid or Expired Link</h2>
          <p className="text-sm text-[#5b5f64] mt-2 leading-relaxed">
            This dining survey link is either invalid, expired, or has already been removed by the restaurant.
          </p>
        </div>
      </div>
    );
  }

  // Already Published / Submitted State
  if (respondentData.published || submitSuccess) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] text-[#1A1A1A] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-[#E8E6E3] p-8 text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 shadow-xs">
            <span className="material-symbols-outlined text-[32px]">check_circle</span>
          </div>
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Feedback Received!</h2>
          <p className="text-sm text-[#5b5f64] mt-2 leading-relaxed">
            {respondentData.afterSurveyContent ||
              "Thank you for sharing your experience. Your feedback directly helps our culinary and floor staff improve."}
          </p>
          {respondentData.orderNumber && (
            <div className="mt-6 px-4 py-2 bg-[#FAF9F6] border border-[#E8E6E3] rounded-lg text-xs font-semibold text-[#5b5f64]">
              Receipt Ref: <span className="text-[#1A1A1A] font-bold">#{respondentData.orderNumber}</span>
              {respondentData.tableNumber && ` • Table ${respondentData.tableNumber}`}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attemptId) return;
    setValidationError(null);

    // Validate Required Answers
    for (const q of respondentData.questions) {
      if (q.validationRules?.presence) {
        if (q.frequency === "per_order_item" && respondentData.orderItems && respondentData.orderItems.length > 0) {
          // Check that each ordered item has an answer
          for (const item of respondentData.orderItems) {
            const itemKey = `${q.id}_${item.id}`;
            const ans = itemAnswers[itemKey];
            if (!ans || (ans.numericValue === undefined && !ans.answerText && (!ans.selectedOptions || ans.selectedOptions.length === 0))) {
              setValidationError(`Please provide feedback for "${item.name}" on: ${q.questionText}`);
              return;
            }
          }
        } else {
          const ans = answers[q.id];
          if (!ans) {
            setValidationError(`Please answer required question: "${q.questionText}"`);
            return;
          }
          if (q.type === "numeric" && ans.numericValue === undefined) {
            setValidationError(`Please select a rating for: "${q.questionText}"`);
            return;
          }
          if ((q.type === "short" || q.type === "long") && (!ans.answerText || !ans.answerText.trim())) {
            setValidationError(`Please enter text for: "${q.questionText}"`);
            return;
          }
          if ((q.type === "checkbox" || q.type === "radio" || q.type === "select") && (!ans.selectedOptions || ans.selectedOptions.length === 0) && !ans.answerText) {
            setValidationError(`Please select an option for: "${q.questionText}"`);
            return;
          }
        }
      }
    }

    try {
      setIsSubmitting(true);

      const payloadAnswers: Array<{
        questionId: Id<"surveyQuestions">;
        orderItemId?: string;
        orderItemName?: string;
        answerText?: string;
        selectedOptions?: string[];
        numericValue?: number;
      }> = [];

      // 1. Add standard questions
      for (const [qId, ans] of Object.entries(answers)) {
        payloadAnswers.push({
          questionId: qId as Id<"surveyQuestions">,
          answerText: ans.answerText?.trim() || undefined,
          numericValue: ans.numericValue,
          selectedOptions: ans.selectedOptions,
        });
      }

      // 2. Add per-item questions
      for (const [key, itemAns] of Object.entries(itemAnswers)) {
        const [qId] = key.split("_");
        payloadAnswers.push({
          questionId: qId as Id<"surveyQuestions">,
          orderItemId: itemAns.orderItemId,
          orderItemName: itemAns.orderItemName,
          answerText: itemAns.answerText?.trim() || undefined,
          numericValue: itemAns.numericValue,
          selectedOptions: itemAns.selectedOptions,
        });
      }

      await submitSurvey({
        attemptId,
        answers: payloadAnswers,
      });

      setSubmitSuccess(true);
    } catch (err: any) {
      console.error("Submission error:", err);
      setValidationError(err.message || "Failed to submit survey feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1A1A1A] py-8 px-4 flex flex-col items-center">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm border border-[#E8E6E3] overflow-hidden">
        {/* Header Banner */}
        <div className="bg-black text-white p-6 text-center flex flex-col items-center">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold text-lg mb-2">
            P
          </div>
          <h1 className="text-xl font-bold tracking-tight">{respondentData.surveyName}</h1>
          <div className="flex items-center gap-2 text-xs text-stone-300 mt-1 flex-wrap justify-center">
            {respondentData.orderNumber && (
              <>
                <span>Order #{respondentData.orderNumber}</span>
                <span>•</span>
              </>
            )}
            {respondentData.tableNumber && (
              <>
                <span>Table {respondentData.tableNumber}</span>
                <span>•</span>
              </>
            )}
            {respondentData.serverName && (
              <span>Server: {respondentData.serverName}</span>
            )}
          </div>
        </div>

        {/* Introduction */}
        {respondentData.introduction && (
          <div className="p-5 border-b border-[#E8E6E3] bg-[#FAF9F6] text-xs text-[#5b5f64] leading-relaxed text-center">
            {respondentData.introduction}
          </div>
        )}

        {/* Validation Alert */}
        {validationError && (
          <div className="m-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
            <span>{validationError}</span>
          </div>
        )}

        {/* Questions Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
          {respondentData.questions.map((q, idx) => {
            const isItemLevel = q.frequency === "per_order_item" && respondentData.orderItems && respondentData.orderItems.length > 0;

            return (
              <div
                key={q.id}
                className="p-5 bg-[#FAF9F6] border border-[#E8E6E3] rounded-xl flex flex-col gap-3"
              >
                {/* Question Header */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-[#1A1A1A]">
                    <span className="text-[#5b5f64] mr-1.5">{idx + 1}.</span>
                    {q.questionText}
                    {q.validationRules?.presence && (
                      <span className="text-red-500 ml-1" title="Required">*</span>
                    )}
                  </h3>
                </div>

                {/* 1. Item-Level Question Mode */}
                {isItemLevel ? (
                  <div className="flex flex-col gap-3 mt-1">
                    <span className="text-[11px] font-semibold text-[#5b5f64] uppercase tracking-wider">
                      Rate Each Ordered Dish
                    </span>
                    {respondentData.orderItems!.map((item) => {
                      const itemKey = `${q.id}_${item.id}`;
                      const currentVal = itemAnswers[itemKey]?.numericValue;

                      return (
                        <div
                          key={item.id}
                          className="bg-white p-3.5 rounded-lg border border-[#E8E6E3] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <span className="text-xs font-semibold text-[#1A1A1A]">{item.name}</span>
                          <div className="flex items-center gap-1.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => {
                                  setItemAnswers((prev) => ({
                                    ...prev,
                                    [itemKey]: {
                                      orderItemId: item.id,
                                      orderItemName: item.name,
                                      numericValue: star,
                                    },
                                  }));
                                }}
                                className="p-1 hover:scale-110 transition-transform cursor-pointer"
                              >
                                <span
                                  className={`material-symbols-outlined text-[24px] ${
                                    (currentVal ?? 0) >= star
                                      ? "text-black"
                                      : "text-stone-300"
                                  }`}
                                  style={{ fontVariationSettings: (currentVal ?? 0) >= star ? "'FILL' 1" : "'FILL' 0" }}
                                >
                                  star
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* 2. Standard Single Question Mode */
                  <div className="mt-1">
                    {/* Numeric / Stars */}
                    {q.type === "numeric" && (
                      <div className="flex flex-col items-center gap-2 py-2">
                        <div className="flex items-center gap-2">
                          {[1, 2, 3, 4, 5].map((star) => {
                            const val = answers[q.id]?.numericValue;
                            return (
                              <button
                                key={star}
                                type="button"
                                onClick={() => {
                                  setAnswers((prev) => ({
                                    ...prev,
                                    [q.id]: { ...prev[q.id], numericValue: star },
                                  }));
                                }}
                                className="p-1.5 hover:scale-110 transition-transform cursor-pointer"
                              >
                                <span
                                  className={`material-symbols-outlined text-[32px] ${
                                    (val ?? 0) >= star ? "text-black" : "text-stone-300"
                                  }`}
                                  style={{ fontVariationSettings: (val ?? 0) >= star ? "'FILL' 1" : "'FILL' 0" }}
                                >
                                  star
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {(q.lowLabel || q.highLabel) && (
                          <div className="w-full flex justify-between text-[11px] text-[#5b5f64] px-4 font-medium">
                            <span>{q.lowLabel || "1 = Poor"}</span>
                            <span>{q.highLabel || "5 = Excellent"}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Radio Choice */}
                    {q.type === "radio" && q.answerOptions && (
                      <div className="flex flex-col gap-2">
                        {q.answerOptions.map((opt) => {
                          const isSelected = answers[q.id]?.answerText === opt;
                          return (
                            <label
                              key={opt}
                              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                                isSelected
                                  ? "bg-black text-white border-black font-semibold"
                                  : "bg-white border-[#E8E6E3] hover:bg-stone-50 text-[#1A1A1A]"
                              }`}
                            >
                              <input
                                type="radio"
                                name={q.id}
                                value={opt}
                                checked={isSelected}
                                onChange={() => {
                                  setAnswers((prev) => ({
                                    ...prev,
                                    [q.id]: { answerText: opt, selectedOptions: [opt] },
                                  }));
                                }}
                                className="sr-only"
                              />
                              <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? "border-white" : "border-stone-400"}`}>
                                {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                              </span>
                              <span className="text-xs">{opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* Checkbox (Multi-select) */}
                    {q.type === "checkbox" && q.answerOptions && (
                      <div className="flex flex-col gap-2">
                        {q.answerOptions.map((opt) => {
                          const currentSelected = answers[q.id]?.selectedOptions || [];
                          const isSelected = currentSelected.includes(opt);
                          return (
                            <label
                              key={opt}
                              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                                isSelected
                                  ? "bg-black text-white border-black font-semibold"
                                  : "bg-white border-[#E8E6E3] hover:bg-stone-50 text-[#1A1A1A]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  let next = [...currentSelected];
                                  if (e.target.checked) next.push(opt);
                                  else next = next.filter((o) => o !== opt);
                                  setAnswers((prev) => ({
                                    ...prev,
                                    [q.id]: { selectedOptions: next },
                                  }));
                                }}
                                className="sr-only"
                              />
                              <span className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? "border-white bg-white text-black" : "border-stone-400"}`}>
                                {isSelected && <span className="material-symbols-outlined text-[14px]">check</span>}
                              </span>
                              <span className="text-xs">{opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* Dropdown Select */}
                    {q.type === "select" && q.answerOptions && (
                      <div className="relative">
                        <select
                          value={answers[q.id]?.answerText || ""}
                          onChange={(e) => {
                            setAnswers((prev) => ({
                              ...prev,
                              [q.id]: { answerText: e.target.value, selectedOptions: [e.target.value] },
                            }));
                          }}
                          className="w-full h-11 px-3 bg-white border border-[#D6D3CD] rounded-lg text-xs text-[#1A1A1A] appearance-none pr-8 cursor-pointer font-medium"
                        >
                          <option value="">Select an option...</option>
                          {q.answerOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-3 text-[18px] text-[#5b5f64] pointer-events-none">
                          expand_more
                        </span>
                      </div>
                    )}

                    {/* Short Text */}
                    {q.type === "short" && (
                      <input
                        type="text"
                        value={answers[q.id]?.answerText || ""}
                        placeholder={q.placeholder || "Enter your answer..."}
                        onChange={(e) => {
                          setAnswers((prev) => ({
                            ...prev,
                            [q.id]: { answerText: e.target.value },
                          }));
                        }}
                        className="w-full h-11 px-3 bg-white border border-[#D6D3CD] rounded-lg text-xs text-[#1A1A1A] focus:outline-none focus:border-black"
                      />
                    )}

                    {/* Long Text Feedback */}
                    {q.type === "long" && (
                      <textarea
                        rows={3}
                        value={answers[q.id]?.answerText || ""}
                        placeholder={q.placeholder || "Please share your comments or recommendations..."}
                        onChange={(e) => {
                          setAnswers((prev) => ({
                            ...prev,
                            [q.id]: { answerText: e.target.value },
                          }));
                        }}
                        className="w-full p-3 bg-white border border-[#D6D3CD] rounded-lg text-xs text-[#1A1A1A] focus:outline-none focus:border-black leading-relaxed"
                      />
                    )}

                    {/* Date */}
                    {q.type === "date" && (
                      <input
                        type="date"
                        value={answers[q.id]?.answerText || ""}
                        onChange={(e) => {
                          setAnswers((prev) => ({
                            ...prev,
                            [q.id]: { answerText: e.target.value },
                          }));
                        }}
                        className="w-full h-11 px-3 bg-white border border-[#D6D3CD] rounded-lg text-xs text-[#1A1A1A]"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 bg-black hover:bg-stone-800 disabled:bg-stone-400 text-white rounded-xl font-bold text-sm shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                <span>Submitting Feedback...</span>
              </>
            ) : (
              <span>Submit Feedback</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
