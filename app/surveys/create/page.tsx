"use client";

import { useState, useEffect, useMemo, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { PosShell } from "../../components/PosShell";
import { Toast, ToastMessage } from "../../components/Toast";
import { api } from "../../../convex/_generated/api";

const DRAFT_STORAGE_KEY = "prest_survey_create_draft";
const MAX_NAME_LENGTH = 64;
const MAX_INTRO_LENGTH = 300;
const MAX_THANK_YOU_LENGTH = 250;

export default function CreateSurveyPage() {
  const router = useRouter();
  const createSurveyMutation = useMutation(api.surveys.create);

  // Form Field States
  const [surveyName, setSurveyName] = useState("");
  const [introduction, setIntroduction] = useState("");
  const [thankYouMessage, setThankYouMessage] = useState("");

  // UI & Flow States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info", subtext?: string) => {
    setToast({
      id: String(Date.now()),
      type,
      message,
      subtext,
      duration: 5000,
    });
  };

  // Restore draft state from sessionStorage on mount if present
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name) setSurveyName(parsed.name);
        if (parsed.introduction) setIntroduction(parsed.introduction);
        if (parsed.thankYouMessage) setThankYouMessage(parsed.thankYouMessage);
      }
    } catch {
      // Ignore storage errors in restricted contexts
    } finally {
      setHasLoadedDraft(true);
    }
  }, []);

  // Sync draft to sessionStorage on changes
  useEffect(() => {
    if (!hasLoadedDraft) return;
    try {
      if (!surveyName && !introduction && !thankYouMessage) {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      } else {
        sessionStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({
            name: surveyName,
            introduction,
            thankYouMessage,
          })
        );
      }
    } catch {
      // Ignore storage errors
    }
  }, [surveyName, introduction, thankYouMessage, hasLoadedDraft]);

  const isDirty = useMemo(() => {
    return Boolean(surveyName.trim() || introduction.trim() || thankYouMessage.trim());
  }, [surveyName, introduction, thankYouMessage]);

  // Validation rules
  const trimmedName = surveyName.trim();
  const isNameEmpty = trimmedName.length === 0;
  const isNameTooShort = trimmedName.length > 0 && trimmedName.length < 3;
  const isNameValid = trimmedName.length >= 3 && trimmedName.length <= MAX_NAME_LENGTH;

  const handleNameChange = (val: string) => {
    if (val.length <= MAX_NAME_LENGTH) {
      setSurveyName(val);
    }
  };

  const handleIntroChange = (val: string) => {
    if (val.length <= MAX_INTRO_LENGTH) {
      setIntroduction(val);
    }
  };

  const handleThankYouChange = (val: string) => {
    if (val.length <= MAX_THANK_YOU_LENGTH) {
      setThankYouMessage(val);
    }
  };

  const handleBackOrCancel = () => {
    if (isDirty) {
      setShowDiscardModal(true);
    } else {
      router.push("/surveys");
    }
  };

  const handleConfirmDiscard = () => {
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    setShowDiscardModal(false);
    router.push("/surveys");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!isNameValid) {
      if (isNameEmpty) {
        showToast("Survey Name Required", "error", "Please provide a name for this survey.");
      } else {
        showToast("Invalid Name", "error", "Survey name must contain at least 3 characters.");
      }
      return;
    }

    try {
      setIsSubmitting(true);

      const surveyId = await createSurveyMutation({
        name: trimmedName,
        introduction: introduction.trim() ? introduction.trim() : undefined,
        afterSurveyContent: thankYouMessage.trim() ? thankYouMessage.trim() : undefined,
        active: false, // Saves as initial draft
      });

      // Clear local saved draft on successful persistence
      try {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // Ignore
      }

      // Step 2 (Question Builder): Navigate directly to configure questions for this survey.
      router.push(`/surveys/${surveyId}/questions`);
    } catch (err: any) {
      setIsSubmitting(false);
      showToast(
        "Creation Failed",
        "error",
        err?.message || "Could not save the survey draft. Your entered values have been preserved."
      );
    }
  };

  return (
    <PosShell title="Surveys" subtitle="Create Survey">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="flex-1 overflow-y-auto bg-[#fff8f5] p-6 lg:p-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-6 pb-12">
          {/* Top Navigation & Breadcrumbs Bar */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBackOrCancel}
                  className="inline-flex items-center gap-1.5 text-xs text-[#5b5f64] hover:text-[#1b1c1c] transition-colors py-1 px-2 -ml-2 rounded-lg hover:bg-stone-200/50 cursor-pointer font-medium"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  <span>Back to Surveys</span>
                </button>
                <span className="text-stone-300 text-xs">/</span>
                <nav className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={handleBackOrCancel}
                    className="text-[#5b5f64] hover:text-[#1b1c1c] transition-colors cursor-pointer"
                  >
                    Surveys
                  </button>
                  <span className="text-stone-300">/</span>
                  <span className="text-[#1b1c1c] font-semibold">Create Survey</span>
                </nav>
              </div>

              {/* Quick Shift & Terminal Status Indicator */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-stone-200/80 text-stone-600 text-xs shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="tracking-wide uppercase font-semibold text-[11px] font-mono">
                  POS Engine Online
                </span>
              </div>
            </div>

            {/* Header Title & Subtitle with Micro-Metas */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-2 pb-1">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] uppercase tracking-widest text-[#5b5f64] font-bold font-mono">
                    Module · Feedback Engine
                  </span>
                  <span className="text-stone-300 text-[10px]">•</span>
                  <span className="text-[12px] text-[#5b5f64] font-medium">Step 1 of 2</span>
                </div>
                <h1 className="text-3xl lg:text-[32px] leading-tight font-bold tracking-tight text-[#1b1c1c]">
                  Create Survey
                </h1>
                <p className="text-sm text-[#5b5f64] mt-1">
                  Start with the basic details. You can add questions next.
                </p>
              </div>

              {/* Live Context Metric Chip */}
              <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-stone-200 shadow-2xs self-start md:self-auto">
                <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-700">
                  <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
                </div>
                <div className="flex flex-col pr-1">
                  <span className="text-[11px] text-[#5b5f64] leading-none uppercase font-mono tracking-wider font-semibold">
                    Drafting Flow
                  </span>
                  <span className="text-xs text-[#1b1c1c] font-semibold mt-0.5">
                    Customer Experience POS
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Centered Form Shell */}
          <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
            {/* Progress Indicator Strip */}
            <div className="w-full bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex items-center justify-between">
              {/* Step 1: Basic Setup */}
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold shrink-0">
                  1
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-[#1b1c1c] leading-tight">Basic Setup</span>
                  <span className="text-[11px] text-[#5b5f64]">Title &amp; conversational copy</span>
                </div>
              </div>

              {/* Progress Bar (half-filled) */}
              <div className="flex-1 mx-4 sm:mx-6 h-0.5 bg-stone-100 rounded-full overflow-hidden">
                <div className="w-1/2 h-full bg-black rounded-full"></div>
              </div>

              {/* Step 2: Question Builder (Upcoming) */}
              <div className="flex items-center gap-3 opacity-60">
                <div className="w-6 h-6 rounded-full bg-stone-200 text-stone-600 flex items-center justify-center text-xs font-bold shrink-0">
                  2
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-stone-600 leading-tight">
                    Question Builder
                  </span>
                  <span className="text-[11px] text-stone-400">Ratings &amp; prompts</span>
                </div>
              </div>
            </div>

            {/* Elevated Form Card */}
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-xl border border-stone-200 shadow-xs p-6 lg:p-8 flex flex-col gap-6 relative overflow-hidden"
            >
              {/* Top Card Header Banner */}
              <div className="flex items-start justify-between pb-4 border-b border-stone-100 -mx-6 lg:-mx-8 -mt-6 lg:-mt-8 p-6 lg:p-8 bg-stone-50/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-stone-200 flex items-center justify-center shadow-2xs text-black">
                    <span className="material-symbols-outlined text-[22px]">quiz</span>
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[#1b1c1c]">General Configuration</h2>
                    <p className="text-xs text-[#5b5f64]">
                      Configure how this questionnaire presents itself on guest-facing tablets and receipts.
                    </p>
                  </div>
                </div>
                <span className="text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-stone-200/80 font-bold text-stone-700 font-mono">
                  INITIAL DRAFT
                </span>
              </div>

              {/* Field 1: Survey Name */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="surveyName" className="text-xs font-semibold text-[#1b1c1c] flex items-center gap-1">
                    <span>Survey name</span>
                    <span className="text-red-500 font-bold">*</span>
                  </label>
                  <span className="text-[11px] font-mono text-[#5b5f64]">
                    {surveyName.length} / {MAX_NAME_LENGTH}
                  </span>
                </div>

                <div className="relative flex items-center">
                  <input
                    id="surveyName"
                    type="text"
                    required
                    maxLength={MAX_NAME_LENGTH}
                    value={surveyName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Dining Experience Feedback"
                    className="w-full bg-white text-[#1b1c1c] text-sm rounded-lg px-3.5 py-2.5 pr-10 border border-stone-200 shadow-2xs placeholder:text-stone-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                  />
                  {isNameValid && (
                    <div className="absolute right-3 flex items-center pointer-events-none text-emerald-600">
                      <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-0.5 text-xs">
                  <p className="text-[#5b5f64] text-[12px]">
                    Choose a name your team will recognise on reports and daily logs.
                  </p>
                  {isNameEmpty ? (
                    <span className="text-[11px] font-medium text-red-600">Required field</span>
                  ) : isNameTooShort ? (
                    <span className="text-[11px] font-medium text-amber-600">Minimum 3 characters required</span>
                  ) : (
                    <span className="text-[11px] font-medium text-emerald-700">Valid identifier</span>
                  )}
                </div>
              </div>

              {/* Field 2: Introduction (Optional) */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label htmlFor="surveyIntro" className="text-xs font-semibold text-[#1b1c1c]">
                      Introduction
                    </label>
                    <span className="text-[10px] text-[#5b5f64] px-1.5 py-0.5 rounded bg-stone-100 border border-stone-200/60 font-medium">
                      Optional
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#5b5f64]">
                    {introduction.length} / {MAX_INTRO_LENGTH}
                  </span>
                </div>

                <div className="relative">
                  <textarea
                    id="surveyIntro"
                    rows={3}
                    maxLength={MAX_INTRO_LENGTH}
                    value={introduction}
                    onChange={(e) => handleIntroChange(e.target.value)}
                    placeholder="Tell customers why you are asking for feedback."
                    className="w-full bg-white text-[#1b1c1c] text-sm rounded-lg p-3 border border-stone-200 shadow-2xs placeholder:text-stone-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black resize-y transition-all"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-[#5b5f64]">
                  <span className="material-symbols-outlined text-[16px] text-stone-400">info</span>
                  <p className="text-[12px]">
                    This message appears at the beginning of the survey before interactive questions begin.
                  </p>
                </div>
              </div>

              {/* Field 3: Thank-you Message (Optional) */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label htmlFor="afterSurveyContent" className="text-xs font-semibold text-[#1b1c1c]">
                      Thank-you message
                    </label>
                    <span className="text-[10px] text-[#5b5f64] px-1.5 py-0.5 rounded bg-stone-100 border border-stone-200/60 font-medium">
                      Optional
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#5b5f64]">
                    {thankYouMessage.length} / {MAX_THANK_YOU_LENGTH}
                  </span>
                </div>

                <div className="relative">
                  <textarea
                    id="afterSurveyContent"
                    rows={3}
                    maxLength={MAX_THANK_YOU_LENGTH}
                    value={thankYouMessage}
                    onChange={(e) => handleThankYouChange(e.target.value)}
                    placeholder="Thank you for sharing your feedback!"
                    className="w-full bg-white text-[#1b1c1c] text-sm rounded-lg p-3 border border-stone-200 shadow-2xs placeholder:text-stone-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black resize-y transition-all"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-[#5b5f64]">
                  <span className="material-symbols-outlined text-[16px] text-stone-400">sentiment_satisfied</span>
                  <p className="text-[12px]">
                    Show this message after a customer submits the survey on payment terminals or guest tablets.
                  </p>
                </div>
              </div>

              {/* In-context Live Visualizer Preview */}
              <div className="bg-stone-50 rounded-xl p-4 border border-stone-200/70 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-[#5b5f64] flex items-center gap-1.5 font-mono">
                    <span className="material-symbols-outlined text-[16px] text-black">smartphone</span>
                    Terminal Live View Preview
                  </span>
                  <span className="text-[10px] font-medium text-stone-600 bg-white border border-stone-200 px-2 py-0.5 rounded shadow-2xs">
                    Instant Preview
                  </span>
                </div>

                <div className="bg-white rounded-lg p-4 border border-stone-200/60 shadow-2xs flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-black text-white text-[12px] flex items-center justify-center font-bold font-serif">
                        P
                      </div>
                      <span className="text-sm font-semibold text-[#1b1c1c]">
                        {trimmedName || "Guest Dining Experience"}
                      </span>
                    </div>
                    <span className="text-[11px] text-stone-400 font-mono">Station 01 Preview</span>
                  </div>
                  <p className="text-xs text-[#5b5f64] leading-relaxed">
                    {introduction.trim() ||
                      "We strive to deliver exceptional culinary artistry and hospitality. Please take 60 seconds to review your experience tonight."}
                  </p>
                </div>
              </div>

              {/* Action Panel & Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-stone-100">
                <div className="flex items-center gap-2 text-[#5b5f64] w-full sm:w-auto">
                  <span className="material-symbols-outlined text-[18px] text-black">east</span>
                  <span className="text-xs font-medium">
                    Next: You will be directed to add and configure questions.
                  </span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleBackOrCancel}
                    className="px-4 py-2.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-[#1b1c1c] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !isNameValid}
                    className={`px-5 py-2.5 rounded-lg text-white text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      isSubmitting || !isNameValid
                        ? "bg-stone-300 cursor-not-allowed opacity-75"
                        : "bg-black hover:bg-stone-800"
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        <span>Creating Survey...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Survey</span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Bottom Informational Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex items-start gap-3">
                <span className="material-symbols-outlined text-[20px] text-stone-400 mt-0.5">timer</span>
                <div>
                  <h3 className="text-xs font-semibold text-[#1b1c1c]">Optimal Length</h3>
                  <p className="text-[12px] text-[#5b5f64] mt-0.5 leading-relaxed">
                    Surveys under 3 questions maintain an 84% completion rate at payment handoff.
                  </p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex items-start gap-3">
                <span className="material-symbols-outlined text-[20px] text-stone-400 mt-0.5">hub</span>
                <div>
                  <h3 className="text-xs font-semibold text-[#1b1c1c]">Channel Routing</h3>
                  <p className="text-[12px] text-[#5b5f64] mt-0.5 leading-relaxed">
                    Can be linked to digital receipts, SMS dispatch, or customer display devices.
                  </p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex items-start gap-3">
                <span className="material-symbols-outlined text-[20px] text-stone-400 mt-0.5">lock_clock</span>
                <div>
                  <h3 className="text-xs font-semibold text-[#1b1c1c]">Instant Draft Sync</h3>
                  <p className="text-[12px] text-[#5b5f64] mt-0.5 leading-relaxed">
                    State saves locally so counter interruptions won't erase work during rushes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unsaved Changes Confirmation Modal */}
      {showDiscardModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[20px]">warning</span>
            </div>
            <h3 className="text-base font-bold text-stone-900 leading-snug">Discard unsaved changes?</h3>
            <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
              You have entered details for this survey draft. If you leave now, your changes will be discarded.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDiscardModal(false)}
                className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-lg text-xs cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-xs cursor-pointer"
              >
                Discard &amp; Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </PosShell>
  );
}
