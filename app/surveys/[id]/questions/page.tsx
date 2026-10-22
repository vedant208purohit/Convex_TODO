"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { PosShell } from "../../../components/PosShell";
import { Toast, ToastMessage } from "../../../components/Toast";
import { api } from "../../../../convex/_generated/api";
import { Id, Doc } from "../../../../convex/_generated/dataModel";

type QuestionType =
  | "numeric"
  | "checkbox"
  | "radio"
  | "select"
  | "short"
  | "long"
  | "date";

type RatingDisplayMode = "stars" | "numeric";
type QuestionFrequency = "once_per_order" | "per_order_item";

interface QuestionWithStatus extends Doc<"surveyQuestions"> {
  hasResponses?: boolean;
}

const TYPE_METADATA: Record<
  QuestionType,
  { name: string; icon: string; color: string }
> = {
  numeric: {
    name: "Rating / Number",
    icon: "pin",
    color: "bg-blue-50 text-blue-700 border-blue-200/60",
  },
  radio: {
    name: "Single Choice",
    icon: "radio_button_checked",
    color: "bg-purple-50 text-purple-700 border-purple-200/60",
  },
  checkbox: {
    name: "Multiple Choice",
    icon: "check_box",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  },
  select: {
    name: "Dropdown",
    icon: "arrow_drop_down_circle",
    color: "bg-amber-50 text-amber-700 border-amber-200/60",
  },
  short: {
    name: "Short Text",
    icon: "short_text",
    color: "bg-stone-100 text-stone-700 border-stone-200/60",
  },
  long: {
    name: "Long Text",
    icon: "notes",
    color: "bg-stone-100 text-stone-700 border-stone-200/60",
  },
  date: {
    name: "Date Selection",
    icon: "calendar_today",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200/60",
  },
};

export default function SurveyQuestionBuilderPage() {
  const params = useParams();
  const rawId = params?.id as string;
  const surveyId = rawId as Id<"surveys"> | undefined;

  // 1. Backend Data Fetching
  const survey = useQuery(api.surveys.get, surveyId ? { id: surveyId } : "skip");

  // Mutations
  const createQuestionMutation = useMutation(api.surveyQuestions.create);
  const updateQuestionMutation = useMutation(api.surveyQuestions.update);
  const copyQuestionMutation = useMutation(api.surveyQuestions.copy);
  const removeQuestionMutation = useMutation(api.surveyQuestions.remove);
  const reorderQuestionsMutation = useMutation(api.surveyQuestions.reorder);

  // 2. Component State
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Drawer (Create / Edit) State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionWithStatus | null>(null);
  const [isDrawerSubmitting, setIsDrawerSubmitting] = useState(false);
  const [showDrawerDiscardModal, setShowDrawerDiscardModal] = useState(false);

  // Drawer Form Fields
  const [formText, setFormText] = useState("");
  const [formType, setFormType] = useState<QuestionType>("numeric");
  const [formRequired, setFormRequired] = useState(true);

  // Advanced Rating Settings (Phase 4)
  const [formRatingDisplayMode, setFormRatingDisplayMode] = useState<RatingDisplayMode>("stars");
  const [formMinVal, setFormMinVal] = useState(1);
  const [formMaxVal, setFormMaxVal] = useState(5);
  const [formMinLabel, setFormMinLabel] = useState("Poor");
  const [formMaxLabel, setFormMaxLabel] = useState("Exceptional");

  // Question Frequency / Scope (Phase 5)
  const [formFrequency, setFormFrequency] = useState<QuestionFrequency>("once_per_order");

  // Choice Settings (radio, checkbox, select)
  const [formOptions, setFormOptions] = useState<string[]>([]);

  // Text Settings (short, long)
  const [formPlaceholder, setFormPlaceholder] = useState("");
  const [formMinChars, setFormMinChars] = useState(0);
  const [formMaxChars, setFormMaxChars] = useState(300);

  // Delete Confirmation State
  const [questionToDelete, setQuestionToDelete] = useState<QuestionWithStatus | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "info",
    subtext?: string
  ) => {
    setToast({
      id: String(Date.now()),
      type,
      message,
      subtext,
      duration: 4000,
    });
  };

  const questions: QuestionWithStatus[] = useMemo(() => {
    return (survey?.questions as QuestionWithStatus[]) || [];
  }, [survey?.questions]);

  // Handle Opening Drawer for Creation
  const handleOpenCreateDrawer = () => {
    setEditingQuestion(null);
    setFormText("");
    setFormType("numeric");
    setFormRequired(true);

    // Advanced Rating Configs
    setFormRatingDisplayMode("stars");
    setFormMinVal(1);
    setFormMaxVal(5);
    setFormMinLabel("Poor");
    setFormMaxLabel("Exceptional");

    // Frequency Scope
    setFormFrequency("once_per_order");

    // Choice configs
    setFormOptions(["Option 1", "Option 2", "Option 3"]);

    // Text configs
    setFormPlaceholder("");
    setFormMinChars(0);
    setFormMaxChars(300);

    setIsDrawerOpen(true);
  };

  // Handle Opening Drawer for Editing
  const handleOpenEditDrawer = (q: QuestionWithStatus) => {
    setEditingQuestion(q);
    setFormText(q.questionText);
    setFormType(q.type);
    setFormRequired(q.validationRules?.presence ?? true);

    // Rating Display Mode
    setFormRatingDisplayMode(q.ratingDisplayMode || "numeric");

    // Scope / Frequency
    setFormFrequency(q.frequency || "once_per_order");

    if (q.type === "numeric") {
      setFormMinVal(q.validationRules?.greaterThanOrEqualTo ?? 1);
      setFormMaxVal(q.validationRules?.lessThanOrEqualTo ?? 5);

      if (q.lowLabel || q.highLabel) {
        setFormMinLabel(q.lowLabel || "");
        setFormMaxLabel(q.highLabel || "");
      } else if (q.placeholder && q.placeholder.includes("=")) {
        const parts = q.placeholder.split(",").map((p) => p.trim());
        const low = parts[0]?.split("=")[1]?.trim() || "";
        const high = parts[1]?.split("=")[1]?.trim() || "";
        setFormMinLabel(low);
        setFormMaxLabel(high);
      } else {
        setFormMinLabel("");
        setFormMaxLabel("");
      }
    } else if (q.type === "radio" || q.type === "checkbox" || q.type === "select") {
      setFormOptions(
        q.answerOptions && q.answerOptions.length > 0
          ? [...q.answerOptions]
          : ["Option 1", "Option 2"]
      );
    } else if (q.type === "short" || q.type === "long") {
      setFormPlaceholder(q.placeholder || "");
      setFormMinChars(q.validationRules?.minimumLength ?? 0);
      setFormMaxChars(q.validationRules?.maximumLength ?? (q.type === "long" ? 300 : 100));
    }

    setIsDrawerOpen(true);
  };

  // Check if drawer is dirty
  const isDrawerDirty = useMemo(() => {
    if (!isDrawerOpen) return false;
    if (editingQuestion) {
      return (
        formText !== editingQuestion.questionText ||
        formType !== editingQuestion.type ||
        formRequired !== (editingQuestion.validationRules?.presence ?? true) ||
        formRatingDisplayMode !== (editingQuestion.ratingDisplayMode || "numeric") ||
        formFrequency !== (editingQuestion.frequency || "once_per_order")
      );
    }
    return Boolean(formText.trim());
  }, [
    isDrawerOpen,
    editingQuestion,
    formText,
    formType,
    formRequired,
    formRatingDisplayMode,
    formFrequency,
  ]);

  const handleRequestCloseDrawer = () => {
    if (isDrawerDirty) {
      setShowDrawerDiscardModal(true);
    } else {
      setIsDrawerOpen(false);
      setEditingQuestion(null);
    }
  };

  const handleConfirmDiscardDrawer = () => {
    setShowDrawerDiscardModal(false);
    setIsDrawerOpen(false);
    setEditingQuestion(null);
  };

  // Drawer Form Save Handler
  const handleSaveQuestion = async () => {
    if (!surveyId) return;
    const trimmed = formText.trim();
    if (!trimmed) {
      showToast("Question Text Required", "error", "Please write the question text.");
      return;
    }

    // Prepare validationRules and options based on type
    const validationRules: any = {
      presence: formRequired,
    };
    let answerOptions: string[] | undefined = undefined;
    let placeholder: string | undefined = undefined;

    if (formType === "numeric") {
      const min = Math.min(formMinVal, formMaxVal);
      const max = Math.max(formMinVal, formMaxVal);
      if (min >= max) {
        showToast("Invalid Scale", "error", "Minimum value must be strictly less than maximum value.");
        return;
      }
      validationRules.greaterThanOrEqualTo = min;
      validationRules.lessThanOrEqualTo = max;
      if (formMinLabel.trim() || formMaxLabel.trim()) {
        placeholder = `${min} = ${formMinLabel.trim() || "Low"}, ${max} = ${formMaxLabel.trim() || "High"}`;
      }
    } else if (formType === "radio" || formType === "checkbox" || formType === "select") {
      const cleaned = formOptions.map((o) => o.trim()).filter((o) => o.length > 0);
      if (cleaned.length < 1) {
        showToast("Options Required", "error", "Add at least 1 answer option.");
        return;
      }
      answerOptions = cleaned;
    } else if (formType === "short" || formType === "long") {
      if (formMinChars > 0) validationRules.minimumLength = formMinChars;
      if (formMaxChars > 0) validationRules.maximumLength = formMaxChars;
      placeholder = formPlaceholder.trim() || undefined;
    }

    try {
      setIsDrawerSubmitting(true);
      if (editingQuestion) {
        await updateQuestionMutation({
          id: editingQuestion._id,
          questionText: trimmed,
          type: editingQuestion.hasResponses ? undefined : formType,
          answerOptions,
          validationRules,
          placeholder,
          ratingDisplayMode: formType === "numeric" ? formRatingDisplayMode : undefined,
          lowLabel: formType === "numeric" ? formMinLabel.trim() || undefined : undefined,
          highLabel: formType === "numeric" ? formMaxLabel.trim() || undefined : undefined,
          frequency: formFrequency,
        });
        showToast("Question Updated", "success", "Question modifications saved.");
      } else {
        await createQuestionMutation({
          surveyId,
          type: formType,
          questionText: trimmed,
          answerOptions,
          validationRules,
          placeholder,
          ratingDisplayMode: formType === "numeric" ? formRatingDisplayMode : undefined,
          lowLabel: formType === "numeric" ? formMinLabel.trim() || undefined : undefined,
          highLabel: formType === "numeric" ? formMaxLabel.trim() || undefined : undefined,
          frequency: formFrequency,
        });
        showToast("Question Created", "success", "Added new question to survey.");
      }
      setIsDrawerOpen(false);
      setEditingQuestion(null);
    } catch (err: any) {
      showToast("Save Failed", "error", err?.message || "Could not save question.");
    } finally {
      setIsDrawerSubmitting(false);
    }
  };

  // Reorder Questions (Move Up / Down)
  const handleMoveQuestion = async (index: number, direction: "up" | "down") => {
    if (!surveyId) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const newOrder = [...questions];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    try {
      await reorderQuestionsMutation({
        surveyId,
        questionIds: newOrder.map((q) => q._id),
      });
      showToast("Order Updated", "info", "Question sequence adjusted.");
    } catch (err: any) {
      showToast("Reorder Failed", "error", err?.message || "Could not update question order.");
    }
  };

  // Duplicate Question
  const handleDuplicateQuestion = async (questionId: Id<"surveyQuestions">) => {
    try {
      await copyQuestionMutation({ questionId });
      showToast("Question Duplicated", "success", "A copy has been appended to the survey.");
    } catch (err: any) {
      showToast("Duplicate Failed", "error", err?.message || "Failed to duplicate question.");
    }
  };

  // Delete Question
  const handleDeleteQuestion = async () => {
    if (!questionToDelete) return;
    try {
      setIsDeleting(true);
      await removeQuestionMutation({ id: questionToDelete._id });
      showToast("Question Deleted", "success", "Question removed from survey.");
      setQuestionToDelete(null);
    } catch (err: any) {
      showToast("Deletion Failed", "error", err?.message || "Could not delete question.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Save Draft Notice
  const handleSaveDraftNotice = () => {
    setIsSavingDraft(true);
    setTimeout(() => {
      setIsSavingDraft(false);
      showToast(
        "Draft Saved",
        "success",
        `All ${questions.length} questions for "${survey?.name || "Survey"}" are synchronized in cloud storage.`
      );
    }, 400);
  };

  return (
    <PosShell title="Surveys" subtitle="Question Builder">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-6 lg:p-8">
        <div className="max-w-6xl mx-auto flex flex-col gap-6 pb-20">
          {/* Breadcrumb & Workflow Stepper Header Bar */}
          <div className="flex flex-col gap-4 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#686866] font-medium">
                <Link href="/surveys" className="hover:text-[#1A1A1A] transition-colors">
                  Surveys
                </Link>
                <span className="text-[#9E9C98]">/</span>
                <Link href="/surveys" className="hover:text-[#1A1A1A] transition-colors font-medium">
                  {survey?.name || "Loading..."}
                </Link>
                <span className="text-[#9E9C98]">/</span>
                <span className="text-[#1A1A1A] font-bold">Questions</span>
              </nav>

              {/* Stepper Widget: 1 Basic Setup -> 2 Question Builder -> 3 Preview & Activation */}
              <div className="flex items-center bg-white px-3.5 py-1.5 rounded-full border border-[#E8E6E3] shadow-2xs gap-2.5 text-xs">
                {/* Step 1 Done */}
                <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[12px] text-emerald-800 font-bold">
                    ✓
                  </span>
                  <span>1. Basic Setup</span>
                </div>
                <span className="w-4 h-px bg-[#D6D3CD]"></span>
                {/* Step 2 Active */}
                <div className="flex items-center gap-1.5 text-[#1A1A1A] font-bold">
                  <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[11px] font-bold">
                    2
                  </span>
                  <span>2. Question Builder</span>
                </div>
                <span className="w-4 h-px bg-[#D6D3CD]"></span>
                {/* Step 3 Upcoming */}
                <div className="flex items-center gap-1.5 text-[#9E9C98]">
                  <span className="w-5 h-5 rounded-full bg-[#EBE9E4] text-[#686866] flex items-center justify-center text-[11px]">
                    3
                  </span>
                  <span>3. Preview &amp; Activation</span>
                </div>
              </div>
            </div>

            {/* Title Row with Action Cluster */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">
              <div>
                <h1 className="text-2xl font-extrabold text-[#1A1A1A] tracking-tight">Question Builder</h1>
                <p className="text-sm text-[#686866] mt-0.5">
                  Add and arrange the questions customers will answer.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsPreviewModalOpen(true)}
                  className="h-10 px-4 rounded-lg bg-white border border-[#D6D3CD] text-[#1A1A1A] text-xs font-bold hover:bg-[#F5F3EF] transition-colors flex items-center gap-2 shadow-2xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[17px] text-[#686866]">visibility</span>
                  <span>Preview Survey</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveDraftNotice}
                  disabled={isSavingDraft}
                  className="h-10 px-4 rounded-lg bg-white border border-[#D6D3CD] text-[#1A1A1A] text-xs font-bold hover:bg-[#F5F3EF] transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingDraft && <span className="w-3 h-3 rounded-full border-2 border-stone-800 border-t-transparent animate-spin" />}
                  <span>Save Draft</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenCreateDrawer}
                  className="h-10 px-4 rounded-lg bg-black text-white text-xs font-bold hover:bg-stone-800 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  <span>Add Question</span>
                </button>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {survey === undefined && (
            <div className="max-w-4xl py-24 flex flex-col items-center justify-center bg-white rounded-xl border border-[#E8E6E3] shadow-xs">
              <span className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin mb-3" />
              <p className="text-xs text-[#686866] font-medium">Loading survey questions...</p>
            </div>
          )}

          {/* Survey Not Found State */}
          {survey === null && (
            <div className="max-w-4xl py-16 px-6 text-center bg-white rounded-xl border border-red-200 shadow-xs">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-[24px]">error</span>
              </div>
              <h3 className="text-base font-bold text-stone-900">Survey Not Found</h3>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                The requested survey ID does not exist or you do not have permission to access it.
              </p>
              <Link
                href="/surveys"
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-black text-white rounded-lg text-xs font-semibold hover:bg-stone-800 transition-colors"
              >
                Return to Surveys Dashboard
              </Link>
            </div>
          )}

          {/* Question Cards Container */}
          {survey && (
            <div className="flex flex-col gap-4 max-w-4xl">
              {/* Empty Question State */}
              {questions.length === 0 && (
                <div className="py-16 px-6 text-center bg-white rounded-xl border border-dashed border-[#D6D3CD] flex flex-col items-center justify-center shadow-2xs">
                  <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-[24px]">quiz</span>
                  </div>
                  <h3 className="text-base font-bold text-[#1A1A1A]">No Questions Configured</h3>
                  <p className="text-xs text-[#686866] mt-1 max-w-sm">
                    Start creating questions for this survey to collect feedback from guests.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenCreateDrawer}
                    className="mt-4 px-4 py-2.5 rounded-lg bg-black text-white text-xs font-semibold hover:bg-stone-800 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>Add First Question</span>
                  </button>
                </div>
              )}

              {/* Render Question Cards */}
              {questions.map((q, idx) => {
                const meta = TYPE_METADATA[q.type] || {
                  name: q.type,
                  icon: "help",
                  color: "bg-gray-100 text-gray-700 border-gray-200",
                };
                const isFirst = idx === 0;
                const isLast = idx === questions.length - 1;
                const isStarRating = q.type === "numeric" && q.ratingDisplayMode === "stars";
                const isPerItem = q.frequency === "per_order_item";

                return (
                  <div
                    key={q._id}
                    className="bg-white rounded-xl p-5 border border-[#E8E6E3] shadow-xs hover:border-[#D6D3CD] transition-all group relative"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 flex-1">
                        {/* Accessible Reorder Controls */}
                        <div className="flex flex-col items-center text-[#9E9C98] mt-0.5">
                          <button
                            type="button"
                            disabled={isFirst}
                            onClick={() => handleMoveQuestion(idx, "up")}
                            className={`p-0.5 rounded hover:text-black hover:bg-stone-100 transition-colors ${
                              isFirst ? "opacity-25 cursor-not-allowed" : "cursor-pointer"
                            }`}
                            title="Move Up"
                          >
                            <span className="material-symbols-outlined text-[16px]">keyboard_arrow_up</span>
                          </button>
                          <span className="material-symbols-outlined text-[16px] text-stone-300 pointer-events-none -my-1">
                            drag_indicator
                          </span>
                          <button
                            type="button"
                            disabled={isLast}
                            onClick={() => handleMoveQuestion(idx, "down")}
                            className={`p-0.5 rounded hover:text-black hover:bg-stone-100 transition-colors ${
                              isLast ? "opacity-25 cursor-not-allowed" : "cursor-pointer"
                            }`}
                            title="Move Down"
                          >
                            <span className="material-symbols-outlined text-[16px]">keyboard_arrow_down</span>
                          </button>
                        </div>

                        {/* Title and Badges */}
                        <div className="flex flex-col gap-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-[#686866] uppercase tracking-wider font-mono">
                              Question {idx + 1}
                            </span>
                            <span className="text-[#D6D3CD]">•</span>

                            {/* Type Badge */}
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.color}`}
                            >
                              <span className="material-symbols-outlined text-[13px]">{meta.icon}</span>
                              <span>
                                {q.type === "numeric"
                                  ? isStarRating
                                    ? "Star Rating"
                                    : "Numeric Rating"
                                  : meta.name}
                              </span>
                            </span>

                            {/* Required / Optional Badge */}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                q.validationRules?.presence
                                  ? "bg-[#EBE9E4] text-[#1A1A1A]"
                                  : "bg-neutral-100 text-[#9E9C98]"
                              }`}
                            >
                              {q.validationRules?.presence ? "Required" : "Optional"}
                            </span>

                            {/* Question Frequency Badge */}
                            {isPerItem && (
                              <span className="inline-flex items-center gap-1 bg-[#F1EFEB] text-[#1A1A1A] border border-[#D6D3CD] px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono tracking-wider">
                                <span className="material-symbols-outlined text-[12px]">restaurant</span>
                                <span>Repeats per dish</span>
                              </span>
                            )}

                            {/* Locked Status Badge */}
                            {q.hasResponses && (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                <span className="material-symbols-outlined text-[12px]">lock</span>
                                <span>Has Responses</span>
                              </span>
                            )}
                          </div>

                          <h3 className="text-sm font-bold text-[#1A1A1A] leading-snug mt-0.5">
                            {q.questionText}
                          </h3>
                        </div>
                      </div>

                      {/* In-Card Actions */}
                      <div className="flex items-center gap-1 text-[#686866]">
                        <button
                          type="button"
                          onClick={() => handleOpenEditDrawer(q)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F2EFEA] hover:text-[#1A1A1A] transition-colors cursor-pointer"
                          title="Edit question"
                        >
                          <span className="material-symbols-outlined text-[17px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateQuestion(q._id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F2EFEA] hover:text-[#1A1A1A] transition-colors cursor-pointer"
                          title="Duplicate question"
                        >
                          <span className="material-symbols-outlined text-[17px]">content_copy</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuestionToDelete(q)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Delete question"
                        >
                          <span className="material-symbols-outlined text-[17px]">delete</span>
                        </button>
                      </div>
                    </div>

                    {/* In-Card Interactive Preview */}
                    <div className="mt-3.5 pt-3 border-t border-[#E8E6E3]/80">
                      {q.type === "numeric" && isStarRating && (
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-1 text-amber-400">
                            {Array.from({
                              length:
                                (q.validationRules?.lessThanOrEqualTo ?? 5) -
                                (q.validationRules?.greaterThanOrEqualTo ?? 1) +
                                1,
                            }).map((_, i) => (
                              <span
                                key={i}
                                className="material-symbols-outlined text-[24px]"
                                style={{ fontVariationSettings: "'FILL' 1" }}
                              >
                                star
                              </span>
                            ))}
                          </div>
                          <span className="text-[11px] text-[#686866]">
                            {q.lowLabel && q.highLabel
                              ? `${q.validationRules?.greaterThanOrEqualTo ?? 1} = ${q.lowLabel}, ${q.validationRules?.lessThanOrEqualTo ?? 5} = ${q.highLabel}`
                              : q.placeholder ||
                                `${q.validationRules?.greaterThanOrEqualTo ?? 1} = Poor, ${q.validationRules?.lessThanOrEqualTo ?? 5} = Exceptional`}
                          </span>
                        </div>
                      )}

                      {q.type === "numeric" && !isStarRating && (
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            {Array.from(
                              {
                                length:
                                  (q.validationRules?.lessThanOrEqualTo ?? 5) -
                                  (q.validationRules?.greaterThanOrEqualTo ?? 1) +
                                  1,
                              },
                              (_, i) => {
                                const val = (q.validationRules?.greaterThanOrEqualTo ?? 1) + i;
                                const isMax = val === (q.validationRules?.lessThanOrEqualTo ?? 5);
                                return (
                                  <button
                                    key={val}
                                    type="button"
                                    className={`w-10 h-10 rounded-lg text-xs font-bold transition-all pointer-events-none ${
                                      isMax
                                        ? "bg-black text-white shadow-2xs"
                                        : "bg-[#FAF9F6] border border-[#D6D3CD] text-[#1A1A1A]"
                                    }`}
                                  >
                                    {val}
                                  </button>
                                );
                              }
                            )}
                          </div>
                          <span className="text-[11px] text-[#686866] ml-2">
                            {q.lowLabel && q.highLabel
                              ? `${q.validationRules?.greaterThanOrEqualTo ?? 1} = ${q.lowLabel}, ${q.validationRules?.lessThanOrEqualTo ?? 5} = ${q.highLabel}`
                              : q.placeholder ||
                                `${q.validationRules?.greaterThanOrEqualTo ?? 1} = Poor, ${q.validationRules?.lessThanOrEqualTo ?? 5} = Exceptional`}
                          </span>
                        </div>
                      )}

                      {q.type === "radio" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(q.answerOptions || []).map((opt, i) => (
                            <label
                              key={i}
                              className="flex items-center gap-2.5 p-2 rounded-lg bg-[#FAF9F6] border border-[#E8E6E3] text-xs text-[#1A1A1A] cursor-pointer hover:bg-white transition-colors"
                            >
                              <input
                                type="radio"
                                name={`preview-radio-${q._id}`}
                                defaultChecked={i === 0}
                                className="text-black focus:ring-black w-3.5 h-3.5 border-[#D6D3CD]"
                              />
                              <span className="truncate">{opt}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {q.type === "checkbox" && (
                        <div className="flex flex-wrap gap-2">
                          {(q.answerOptions || []).map((opt, i) => (
                            <label
                              key={i}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FAF9F6] border border-[#E8E6E3] text-xs text-[#1A1A1A] cursor-pointer hover:bg-white transition-colors"
                            >
                              <input
                                type="checkbox"
                                defaultChecked={i === 0}
                                className="rounded text-black focus:ring-black w-3.5 h-3.5 border-[#D6D3CD]"
                              />
                              <span className="truncate">{opt}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {q.type === "select" && (
                        <div className="max-w-sm">
                          <div className="relative">
                            <select
                              disabled
                              defaultValue=""
                              className="w-full bg-[#FAF9F6] border border-[#D6D3CD] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] pr-8 appearance-none cursor-pointer"
                            >
                              <option value="" disabled>
                                Select an option...
                              </option>
                              {(q.answerOptions || []).map((o, i) => (
                                <option key={i} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                            <span className="material-symbols-outlined text-[18px] text-[#686866] pointer-events-none absolute right-2.5 top-2">
                              expand_more
                            </span>
                          </div>
                        </div>
                      )}

                      {q.type === "short" && (
                        <div className="max-w-md">
                          <input
                            type="text"
                            disabled
                            placeholder={q.placeholder || "Short answer response..."}
                            className="w-full bg-[#FAF9F6] border border-[#E8E6E3] rounded-lg px-3 py-2 text-xs text-[#686866] cursor-not-allowed"
                          />
                        </div>
                      )}

                      {q.type === "long" && (
                        <div className="max-w-lg flex flex-col gap-1">
                          <textarea
                            disabled
                            rows={2}
                            placeholder={q.placeholder || "Share what stood out or what we could refine..."}
                            className="w-full bg-[#FAF9F6] border border-[#E8E6E3] rounded-lg p-2.5 text-xs text-[#686866] resize-none cursor-not-allowed"
                          />
                          <div className="text-[10px] text-[#9E9C98] text-right font-mono">
                            Max {q.validationRules?.maximumLength ?? 300} characters
                          </div>
                        </div>
                      )}

                      {q.type === "date" && (
                        <div className="max-w-xs">
                          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#FAF9F6] border border-[#D6D3CD] text-xs text-[#686866]">
                            <span>Select visit date (MM/DD/YYYY)</span>
                            <span className="material-symbols-outlined text-[17px] text-[#686866]">event</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add Another Question bottom button */}
              {questions.length > 0 && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={handleOpenCreateDrawer}
                    className="w-full py-5 rounded-xl border-2 border-dashed border-[#D6D3CD] hover:border-black bg-white/70 hover:bg-white transition-all flex items-center justify-center gap-2 text-[#686866] hover:text-black group shadow-2xs cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#F1EFEB] group-hover:bg-black group-hover:text-white flex items-center justify-center transition-colors">
                      <span className="material-symbols-outlined text-[18px]">add</span>
                    </div>
                    <span className="text-sm font-bold tracking-tight">+ Add Another Question</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* DRAWER BACKDROP */}
      {isDrawerOpen && (
        <div
          aria-hidden="true"
          onClick={handleRequestCloseDrawer}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity"
        />
      )}

      {/* CREATE / EDIT QUESTION SLIDE-OVER DRAWER */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className={`fixed top-0 right-0 h-screen w-full sm:w-[540px] md:w-[600px] bg-white shadow-2xl z-50 flex flex-col justify-between transition-transform duration-300 ease-in-out border-l border-[#E8E6E3] ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
      >
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-[#E8E6E3] flex items-start justify-between bg-white shrink-0">
          <div className="flex flex-col pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-[#EBE9E4] text-[#1A1A1A] text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                {editingQuestion ? "CONFIGURATION" : "NEW QUESTION"}
              </span>
              <span className="text-xs font-semibold text-[#9E9C98]">
                {editingQuestion
                  ? `Question #${questions.findIndex((q) => q._id === editingQuestion._id) + 1}`
                  : `Question #${questions.length + 1}`}
              </span>
            </div>
            <h2 id="drawer-title" className="text-xl font-bold text-[#1A1A1A] leading-tight">
              {editingQuestion ? "Edit Question" : "Create Question"}
            </h2>
            <p className="text-xs text-[#686866] mt-0.5">
              Configure question parameters, scope, and guest review layout.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRequestCloseDrawer}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#686866] hover:text-[#1A1A1A] hover:bg-[#F2EFEA] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Drawer Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5 bg-white text-xs">
          {/* Existing Responses Lock Warning */}
          {editingQuestion?.hasResponses && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-amber-900">
              <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0 mt-0.5">
                lock
              </span>
              <div>
                <p className="font-bold text-xs">Question type locked</p>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  This question already has live customer responses. Question text and labels can still be revised, but changing type is restricted to preserve data integrity.
                </p>
              </div>
            </div>
          )}

          {/* Section 1: Question Text */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="drawer-question-text" className="text-xs font-bold text-[#1A1A1A] flex items-center gap-1">
              <span>Question text</span>
              <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              id="drawer-question-text"
              type="text"
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              placeholder="Enter your question (e.g. How would you rate the quality and taste of this dish?)"
              className="w-full bg-[#FAF9F6] border border-[#D6D3CD] rounded-lg px-3.5 py-2.5 text-xs text-[#1A1A1A] placeholder:text-[#9E9C98] focus:bg-white focus:outline-none focus:ring-1 focus:ring-black focus:border-black transition-all"
            />
            <span className="text-[11px] text-[#9E9C98]">
              Displayed directly to the customer during their survey prompt.
            </span>
          </div>

          {/* Section 2: Question Type */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="drawer-question-type" className="text-xs font-bold text-[#1A1A1A] flex items-center justify-between">
              <span>Question type</span>
              {editingQuestion?.hasResponses && (
                <span className="text-[10px] font-bold text-amber-600 uppercase flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">lock</span> Locked
                </span>
              )}
            </label>
            <div className="relative">
              <select
                id="drawer-question-type"
                value={formType}
                disabled={Boolean(editingQuestion?.hasResponses)}
                onChange={(e) => setFormType(e.target.value as QuestionType)}
                className={`w-full appearance-none bg-[#FAF9F6] border border-[#D6D3CD] rounded-lg px-3.5 py-2.5 text-xs text-[#1A1A1A] focus:bg-white focus:outline-none focus:ring-1 focus:ring-black focus:border-black pr-9 font-medium ${
                  editingQuestion?.hasResponses ? "cursor-not-allowed opacity-75" : "cursor-pointer"
                }`}
              >
                <option value="numeric">Rating / Number (numeric)</option>
                <option value="radio">Single choice (radio)</option>
                <option value="checkbox">Multiple choice (checkbox)</option>
                <option value="select">Dropdown (select)</option>
                <option value="short">Short answer (short)</option>
                <option value="long">Long answer (long)</option>
                <option value="date">Date (date)</option>
              </select>
              <span className="material-symbols-outlined text-[18px] text-[#686866] pointer-events-none absolute right-3 top-2.5">
                expand_more
              </span>
            </div>
            <span className="text-[11px] text-[#9E9C98]">Select how guests can submit their responses.</span>
          </div>

          {/* Section 3: Rating / Number Settings (Phase 4) */}
          {formType === "numeric" && (
            <div className="flex flex-col gap-3.5 p-4 rounded-xl bg-[#FAF9F6] border border-[#E8E6E3]">
              <div className="flex items-center justify-between border-b border-[#E8E6E3] pb-2">
                <h4 className="text-xs font-bold text-[#1A1A1A]">Rating / Number Settings</h4>
                <span className="text-[11px] text-[#9E9C98] font-mono">Display &amp; Scale</span>
              </div>

              {/* Rating Display Mode (Segmented Toggle) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-[#686866]">Rating Display Mode</label>
                <div className="grid grid-cols-2 gap-2 bg-white p-1 rounded-lg border border-[#D6D3CD]">
                  <button
                    type="button"
                    onClick={() => setFormRatingDisplayMode("stars")}
                    className={`py-2 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      formRatingDisplayMode === "stars"
                        ? "bg-black text-white shadow-xs"
                        : "text-[#686866] hover:bg-stone-50"
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-[16px]"
                      style={{ fontVariationSettings: formRatingDisplayMode === "stars" ? "'FILL' 1" : undefined }}
                    >
                      star
                    </span>
                    <span>Star Rating (Stars)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormRatingDisplayMode("numeric")}
                    className={`py-2 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      formRatingDisplayMode === "numeric"
                        ? "bg-black text-white shadow-xs"
                        : "text-[#686866] hover:bg-stone-50"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">pin</span>
                    <span>Numeric Rating (1–N)</span>
                  </button>
                </div>
              </div>

              {/* Minimum & Maximum Values */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#686866]">Minimum Value</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={formMinVal}
                    onChange={(e) => setFormMinVal(parseInt(e.target.value) || 1)}
                    className="w-full bg-white border border-[#D6D3CD] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#686866]">Maximum Value</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={formMaxVal}
                    onChange={(e) => setFormMaxVal(parseInt(e.target.value) || 5)}
                    className="w-full bg-white border border-[#D6D3CD] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                  />
                </div>
              </div>

              {/* Low & High Label Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#686866]">Low Label Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Poor"
                    value={formMinLabel}
                    onChange={(e) => setFormMinLabel(e.target.value)}
                    className="w-full bg-white border border-[#D6D3CD] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#686866]">High Label Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Exceptional"
                    value={formMaxLabel}
                    onChange={(e) => setFormMaxLabel(e.target.value)}
                    className="w-full bg-white border border-[#D6D3CD] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Choice / Text / Date Specific Settings */}
          {(formType === "radio" || formType === "checkbox" || formType === "select") && (
            <div className="flex flex-col gap-2.5 p-4 rounded-xl bg-[#FAF9F6] border border-[#E8E6E3]">
              <div className="flex items-center justify-between border-b border-[#E8E6E3] pb-1.5">
                <div>
                  <h4 className="text-xs font-bold text-[#1A1A1A]">Answer Options</h4>
                  <p className="text-[11px] text-[#686866]">Enter the choices customers can select from.</p>
                </div>
                <span className="text-[11px] font-semibold text-[#686866] bg-white border border-[#E8E6E3] px-2 py-0.5 rounded-full">
                  {formOptions.length} options
                </span>
              </div>

              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                {formOptions.map((opt, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-2 bg-white border border-[#E8E6E3] p-1.5 rounded-lg shadow-2xs">
                    <span className="text-[#9E9C98] p-0.5">
                      <span className="material-symbols-outlined text-[16px]">drag_indicator</span>
                    </span>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const copy = [...formOptions];
                        copy[oIdx] = e.target.value;
                        setFormOptions(copy);
                      }}
                      className="flex-1 bg-transparent border-0 px-2 py-1 text-xs text-[#1A1A1A] focus:outline-none focus:ring-0"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (formOptions.length <= 1) {
                          showToast("Minimum 1 Option Required", "error");
                          return;
                        }
                        setFormOptions(formOptions.filter((_, idx) => idx !== oIdx));
                      }}
                      className="w-6 h-6 rounded flex items-center justify-center text-[#686866] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remove option"
                    >
                      <span className="material-symbols-outlined text-[15px]">close</span>
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setFormOptions([...formOptions, `Option ${formOptions.length + 1}`])}
                className="h-8 px-3 rounded-lg bg-white border border-[#D6D3CD] hover:bg-[#F2EFEA] text-[#1A1A1A] font-bold text-xs transition-colors flex items-center justify-center gap-1.5 w-full cursor-pointer shadow-2xs"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Add Option</span>
              </button>
            </div>
          )}

          {(formType === "short" || formType === "long") && (
            <div className="flex flex-col gap-3 p-4 rounded-xl bg-[#FAF9F6] border border-[#E8E6E3]">
              <div className="flex items-center justify-between border-b border-[#E8E6E3] pb-1.5">
                <h4 className="text-xs font-bold text-[#1A1A1A]">Text Answer Settings</h4>
                <span className="text-[11px] text-[#9E9C98]">
                  {formType === "long" ? "Multi-line feedback" : "Single line"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-[#686866]">Placeholder hint text</label>
                <input
                  type="text"
                  placeholder="e.g. Tell us about your visit..."
                  value={formPlaceholder}
                  onChange={(e) => setFormPlaceholder(e.target.value)}
                  className="w-full bg-white border border-[#D6D3CD] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#686866]">Min characters (0 = no min)</label>
                  <input
                    type="number"
                    min={0}
                    value={formMinChars}
                    onChange={(e) => setFormMinChars(parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-[#D6D3CD] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#686866]">Max characters limit</label>
                  <input
                    type="number"
                    min={10}
                    max={1000}
                    value={formMaxChars}
                    onChange={(e) =>
                      setFormMaxChars(parseInt(e.target.value) || (formType === "long" ? 300 : 100))
                    }
                    className="w-full bg-white border border-[#D6D3CD] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
              </div>
            </div>
          )}

          {formType === "date" && (
            <div className="flex flex-col gap-2 p-4 rounded-xl bg-[#FAF9F6] border border-[#E8E6E3]">
              <h4 className="text-xs font-bold text-[#1A1A1A] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#686866]">calendar_today</span>
                <span>Date Settings</span>
              </h4>
              <p className="text-[11px] text-[#686866] leading-relaxed">
                Customers will select a date using an on-screen calendar modal on the terminal. Appropriate for dining date verification, event bookings, or receipt lookup.
              </p>
            </div>
          )}

          {/* Section 5: Question Frequency and Scope (Phase 5) */}
          <div className="flex flex-col gap-2.5 p-4 rounded-xl bg-[#FAF9F6] border border-[#E8E6E3]">
            <div className="flex flex-col">
              <h4 className="text-xs font-bold text-[#1A1A1A]">How Should This Question Be Asked?</h4>
              <p className="text-[11px] text-[#686866] mt-0.5">
                Configure question evaluation frequency across order lines.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 mt-1">
              {/* Option 1: Once per order */}
              <label
                onClick={() => setFormFrequency("once_per_order")}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                  formFrequency === "once_per_order"
                    ? "bg-white border-black shadow-xs ring-1 ring-black"
                    : "bg-white/80 border-[#E8E6E3] hover:border-[#D6D3CD]"
                }`}
              >
                <div className="pt-0.5">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      formFrequency === "once_per_order"
                        ? "border-black bg-black text-white"
                        : "border-[#D6D3CD] bg-white"
                    }`}
                  >
                    {formFrequency === "once_per_order" && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                </div>
                <div className="flex flex-col flex-1">
                  <span className="text-xs font-bold text-[#1A1A1A]">Once per order</span>
                  <span className="text-[11px] text-[#686866] mt-0.5 leading-relaxed">
                    The customer answers this question once for the entire order or visit.
                  </span>
                </div>
              </label>

              {/* Option 2: For each item in the order */}
              <label
                onClick={() => setFormFrequency("per_order_item")}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                  formFrequency === "per_order_item"
                    ? "bg-white border-black shadow-xs ring-1 ring-black"
                    : "bg-white/80 border-[#E8E6E3] hover:border-[#D6D3CD]"
                }`}
              >
                <div className="pt-0.5">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      formFrequency === "per_order_item"
                        ? "border-black bg-black text-white"
                        : "border-[#D6D3CD] bg-white"
                    }`}
                  >
                    {formFrequency === "per_order_item" && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                </div>
                <div className="flex flex-col flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#1A1A1A]">For each item in the order</span>
                    <span className="px-2 py-0.5 rounded-full bg-[#EBE9E4] text-[#1A1A1A] text-[10px] font-extrabold uppercase font-mono tracking-wider">
                      REPEATS PER DISH
                    </span>
                  </div>
                  <span className="text-[11px] text-[#686866] mt-0.5 leading-relaxed">
                    The question repeats automatically for every ordered item (e.g. 4 dishes = 4 rating inputs). Displays actual dish name alongside response field.
                  </span>
                  <div className="mt-2 p-2 rounded-lg bg-[#FAF9F6] border border-[#E8E6E3] text-[11px] text-[#686866] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-[#9E9C98]">info</span>
                    <span>Applies dynamically to ordered ticket items (e.g. Paneer Tikka, Butter Naan).</span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Section 6: Required Answer Toggle (Phase 6) */}
          <div className="flex items-center justify-between p-4 bg-[#FAF9F6] rounded-xl border border-[#E8E6E3]">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[#1A1A1A]">Required Answer</span>
              <span className="text-[11px] text-[#686866]">
                Customers must answer this question before submitting the review.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formRequired}
                onChange={(e) => setFormRequired(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-[#D6D3CD] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>

          {/* Section 7: In-Drawer Guest Terminal Live Preview (Phase 9) */}
          <div className="rounded-xl border border-[#D6D3CD] bg-[#FAF9F6] p-4 flex flex-col gap-2.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#E8E6E3] pb-2">
              <span className="text-[10px] font-bold text-[#686866] tracking-wider uppercase flex items-center gap-1.5 font-mono">
                <span className="material-symbols-outlined text-[14px]">touch_app</span>
                <span>GUEST TERMINAL PREVIEW</span>
              </span>
              <span className="text-[10px] text-[#9E9C98] font-mono">LIVE PREVIEW</span>
            </div>

            <div className="bg-white rounded-lg p-3.5 border border-[#E8E6E3] shadow-2xs flex flex-col gap-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 text-[10px] text-[#686866] font-bold uppercase font-mono">
                    <span>Terminal Display</span>
                    {formRequired ? (
                      <span className="text-red-600 font-bold">* Required</span>
                    ) : (
                      <span className="text-[#9E9C98]">Optional</span>
                    )}
                    {formFrequency === "per_order_item" && (
                      <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-semibold">
                        • Dish: Paneer Tikka
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-[#1A1A1A] mt-0.5 leading-snug">
                    {formText.trim() || "Untitled Question"}
                  </p>
                </div>
              </div>

              {/* Dynamic live response visual */}
              {formType === "numeric" && formRatingDisplayMode === "stars" && (
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center gap-1 text-amber-400">
                    {Array.from({
                      length: Math.max(1, formMaxVal - formMinVal + 1),
                    }).map((_, i) => (
                      <span
                        key={i}
                        className="material-symbols-outlined text-[26px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        star
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#686866] px-1 font-mono">
                    <span>{formMinVal} = {formMinLabel || "Poor"}</span>
                    <span>{formMaxVal} = {formMaxLabel || "Exceptional"}</span>
                  </div>
                </div>
              )}

              {formType === "numeric" && formRatingDisplayMode === "numeric" && (
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {Array.from(
                      { length: Math.max(1, formMaxVal - formMinVal + 1) },
                      (_, i) => formMinVal + i
                    ).map((val) => (
                      <button
                        key={val}
                        type="button"
                        className="h-9 px-3.5 rounded-lg bg-[#FAF9F6] border border-[#D6D3CD] text-xs font-bold text-[#1A1A1A] hover:bg-[#F2EFEA] transition-colors pointer-events-none"
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#686866] px-1 font-mono">
                    <span>{formMinVal} = {formMinLabel || "Low"}</span>
                    <span>{formMaxVal} = {formMaxLabel || "High"}</span>
                  </div>
                </div>
              )}

              {formType === "radio" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {formOptions.map((opt, i) => (
                    <label key={i} className="flex items-center gap-2 p-2 rounded-lg bg-[#FAF9F6] border border-[#E8E6E3] text-xs text-[#1A1A1A]">
                      <input type="radio" name="preview-radio" defaultChecked={i === 0} className="text-black focus:ring-black w-3.5 h-3.5 border-[#D6D3CD]" />
                      <span className="truncate">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {formType === "checkbox" && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {formOptions.map((opt, i) => (
                    <label key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FAF9F6] border border-[#E8E6E3] text-xs text-[#1A1A1A]">
                      <input type="checkbox" defaultChecked={i === 0} className="rounded text-black focus:ring-black w-3.5 h-3.5 border-[#D6D3CD]" />
                      <span className="truncate">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {formType === "select" && (
                <div className="pt-1">
                  <div className="relative">
                    <select
                      disabled
                      defaultValue=""
                      className="w-full bg-[#FAF9F6] border border-[#D6D3CD] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] pr-8 appearance-none"
                    >
                      <option value="" disabled>Select an option...</option>
                      {formOptions.map((o, i) => (
                        <option key={i} value={o}>{o}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined text-[18px] text-[#686866] pointer-events-none absolute right-2.5 top-2">
                      expand_more
                    </span>
                  </div>
                </div>
              )}

              {formType === "short" && (
                <div className="pt-1 flex flex-col gap-1">
                  <input
                    type="text"
                    disabled
                    placeholder={formPlaceholder || "Type your answer..."}
                    className="w-full bg-[#FAF9F6] border border-[#D6D3CD] rounded-lg px-3 py-2 text-xs text-[#1A1A1A]"
                  />
                  <span className="text-[10px] text-[#9E9C98] text-right font-mono">{formMaxChars} chars max</span>
                </div>
              )}

              {formType === "long" && (
                <div className="pt-1 flex flex-col gap-1">
                  <textarea
                    rows={3}
                    disabled
                    placeholder={formPlaceholder || "Type detailed feedback here..."}
                    className="w-full bg-[#FAF9F6] border border-[#D6D3CD] rounded-lg p-2.5 text-xs text-[#1A1A1A] resize-none"
                  />
                  <span className="text-[10px] text-[#9E9C98] text-right font-mono">{formMaxChars} chars limit</span>
                </div>
              )}

              {formType === "date" && (
                <div className="pt-1">
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#FAF9F6] border border-[#D6D3CD] text-xs text-[#1A1A1A]">
                    <span className="font-medium">
                      {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span className="material-symbols-outlined text-[18px] text-[#686866]">calendar_month</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Drawer Sticky Bottom Bar (Phase 2) */}
        <div className="p-4 px-6 bg-white border-t border-[#E8E6E3] flex items-center justify-end gap-3 shadow-lg shrink-0">
          <button
            type="button"
            onClick={handleRequestCloseDrawer}
            className="h-10 px-4 rounded-lg bg-white border border-[#D6D3CD] text-[#1A1A1A] text-xs font-bold hover:bg-[#F5F3EF] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveQuestion}
            disabled={isDrawerSubmitting}
            className="h-10 px-5 rounded-lg bg-black text-white text-xs font-bold hover:bg-stone-800 transition-colors flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            {isDrawerSubmitting ? (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-[17px]">check</span>
            )}
            <span>{editingQuestion ? "Save Changes" : "Create Question"}</span>
          </button>
        </div>
      </aside>

      {/* Drawer Discard Confirmation Modal */}
      {showDrawerDiscardModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[20px]">warning</span>
            </div>
            <h3 className="text-base font-bold text-stone-900 leading-snug">Discard question edits?</h3>
            <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
              You have unsaved changes in this question. If you leave now, your edits will not be saved.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDrawerDiscardModal(false)}
                className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-lg text-xs cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscardDrawer}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-xs cursor-pointer"
              >
                Discard &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {questionToDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[20px]">delete_forever</span>
            </div>
            <h3 className="text-base font-bold text-stone-900 leading-snug">Delete this question?</h3>
            <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
              Are you sure you want to remove &quot;{questionToDelete.questionText}&quot;?
              {questionToDelete.hasResponses && (
                <span className="block mt-1 font-semibold text-red-600">
                  Warning: Live customer responses associated with this question will also be removed.
                </span>
              )}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setQuestionToDelete(null)}
                className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-lg text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteQuestion}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting && <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                <span>{isDeleting ? "Deleting..." : "Delete Permanently"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL SURVEY PREVIEW MODAL */}
      {isPreviewModalOpen && survey && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#E8E6E3] flex items-center justify-between bg-stone-50/80 shrink-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-black text-white text-[10px] font-bold uppercase tracking-wider font-mono">
                  PREVIEW MODE
                </span>
                <span className="text-xs text-stone-500 font-medium">• No responses will be recorded</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body: Guest Terminal Experience Simulation */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {/* Survey Header Banner */}
              <div className="flex flex-col gap-2 pb-4 border-b border-stone-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-serif font-bold text-base">
                    P
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-stone-900 leading-tight">{survey.name}</h2>
                    <span className="text-[11px] text-stone-400 font-mono">Terminal Checkout Display Simulation</span>
                  </div>
                </div>
                {survey.introduction && (
                  <p className="text-xs text-stone-600 leading-relaxed mt-1 italic bg-stone-50 p-3 rounded-lg border border-stone-200/60">
                    &quot;{survey.introduction}&quot;
                  </p>
                )}
              </div>

              {/* Questions List */}
              <div className="flex flex-col gap-5">
                {questions.map((q, idx) => {
                  const isStar = q.type === "numeric" && q.ratingDisplayMode === "stars";
                  const isPerDish = q.frequency === "per_order_item";

                  return (
                    <div key={q._id} className="p-4 rounded-xl border border-stone-200 bg-white shadow-2xs flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold text-stone-400 uppercase">
                          Question {idx + 1} of {questions.length}
                        </span>
                        <div className="flex items-center gap-2">
                          {isPerDish && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-mono uppercase">
                              Repeats per dish
                            </span>
                          )}
                          {q.validationRules?.presence ? (
                            <span className="text-[10px] font-bold text-red-600 uppercase font-mono">* Required</span>
                          ) : (
                            <span className="text-[10px] text-stone-400 font-mono">Optional</span>
                          )}
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-stone-900 leading-snug">{q.questionText}</h4>

                      {isPerDish && (
                        <div className="px-2.5 py-1 bg-[#FAF9F6] border border-[#E8E6E3] rounded text-[11px] text-stone-600 font-mono">
                          Target Dish: Paneer Tikka Masala
                        </div>
                      )}

                      {/* Interactive Widget Previews */}
                      {q.type === "numeric" && isStar && (
                        <div className="flex flex-col gap-2 pt-1">
                          <div className="flex items-center gap-1.5 text-amber-400">
                            {Array.from({
                              length:
                                (q.validationRules?.lessThanOrEqualTo ?? 5) -
                                (q.validationRules?.greaterThanOrEqualTo ?? 1) +
                                1,
                            }).map((_, i) => (
                              <button
                                key={i}
                                type="button"
                                className="hover:scale-110 transition-transform cursor-pointer"
                              >
                                <span
                                  className="material-symbols-outlined text-[28px]"
                                  style={{ fontVariationSettings: "'FILL' 1" }}
                                >
                                  star
                                </span>
                              </button>
                            ))}
                          </div>
                          <div className="text-[10px] text-stone-500 font-mono">
                            {q.lowLabel && q.highLabel
                              ? `${q.validationRules?.greaterThanOrEqualTo ?? 1} = ${q.lowLabel}, ${q.validationRules?.lessThanOrEqualTo ?? 5} = ${q.highLabel}`
                              : q.placeholder ||
                                `${q.validationRules?.greaterThanOrEqualTo ?? 1} = Poor, ${q.validationRules?.lessThanOrEqualTo ?? 5} = Exceptional`}
                          </div>
                        </div>
                      )}

                      {q.type === "numeric" && !isStar && (
                        <div className="flex flex-col gap-2 pt-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {Array.from(
                              {
                                length:
                                  (q.validationRules?.lessThanOrEqualTo ?? 5) -
                                  (q.validationRules?.greaterThanOrEqualTo ?? 1) +
                                  1,
                              },
                              (_, i) => (q.validationRules?.greaterThanOrEqualTo ?? 1) + i
                            ).map((val) => (
                              <button
                                key={val}
                                type="button"
                                className="w-10 h-10 rounded-lg bg-stone-50 border border-stone-300 text-xs font-bold text-stone-900 hover:bg-stone-900 hover:text-white transition-colors cursor-pointer"
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                          <div className="text-[10px] text-stone-500 font-mono">
                            {q.lowLabel && q.highLabel
                              ? `${q.validationRules?.greaterThanOrEqualTo ?? 1} = ${q.lowLabel}, ${q.validationRules?.lessThanOrEqualTo ?? 5} = ${q.highLabel}`
                              : q.placeholder ||
                                `${q.validationRules?.greaterThanOrEqualTo ?? 1} = Poor, ${q.validationRules?.lessThanOrEqualTo ?? 5} = Exceptional`}
                          </div>
                        </div>
                      )}

                      {q.type === "radio" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {(q.answerOptions || []).map((opt, i) => (
                            <label key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-900 cursor-pointer hover:bg-stone-100">
                              <input type="radio" name={`modal-radio-${q._id}`} defaultChecked={i === 0} className="text-black focus:ring-black w-3.5 h-3.5" />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {q.type === "checkbox" && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {(q.answerOptions || []).map((opt, i) => (
                            <label key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-900 cursor-pointer hover:bg-stone-100">
                              <input type="checkbox" defaultChecked={i === 0} className="rounded text-black focus:ring-black w-3.5 h-3.5" />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {q.type === "select" && (
                        <div className="pt-1 max-w-sm">
                          <select
                            disabled
                            defaultValue=""
                            className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900"
                          >
                            <option value="" disabled>Select an option...</option>
                            {(q.answerOptions || []).map((o, i) => (
                              <option key={i} value={o}>{o}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {q.type === "short" && (
                        <div className="pt-1">
                          <input
                            type="text"
                            placeholder={q.placeholder || "Customer response goes here..."}
                            className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900"
                          />
                        </div>
                      )}

                      {q.type === "long" && (
                        <div className="pt-1 flex flex-col gap-1">
                          <textarea
                            rows={2}
                            placeholder={q.placeholder || "Customer multiline feedback..."}
                            className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-xs text-stone-900"
                          />
                        </div>
                      )}

                      {q.type === "date" && (
                        <div className="pt-1 max-w-xs">
                          <input
                            type="date"
                            defaultValue={new Date().toISOString().split("T")[0]}
                            className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Thank You Note Footer Simulation */}
              {survey.afterSurveyContent && (
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/60 text-emerald-900 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-emerald-700 text-[20px] mt-0.5">
                    check_circle
                  </span>
                  <div>
                    <h5 className="font-bold text-xs">Submission Thank-You Message</h5>
                    <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed italic">
                      &quot;{survey.afterSurveyContent}&quot;
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 px-6 border-t border-stone-200 flex items-center justify-end bg-stone-50 shrink-0">
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-semibold hover:bg-stone-800 transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </PosShell>
  );
}
