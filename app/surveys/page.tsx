"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { PosShell } from "../components/PosShell";
import { Toast, ToastMessage } from "../components/Toast";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

type FilterStatus = "all" | "active" | "inactive";

interface SurveyRecord {
  _id: Id<"surveys">;
  name: string;
  introduction?: string;
  afterSurveyContent?: string;
  active: boolean;
  questionsCount: number;
  reviewsCount: number;
  publishedAttemptsCount?: number;
  createdAt: number;
  updatedAt: number;
}

export default function SurveysDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 1. Data Fetching
  const surveys = useQuery(api.surveys.list) as SurveyRecord[] | undefined;
  const totalReviewsData = useQuery(api.surveys.getTotalReviews);

  // Mutations
  const updateSurveyMutation = useMutation(api.surveys.update);
  const createSurveyMutation = useMutation(api.surveys.create);
  const deleteSurveyMutation = useMutation(api.surveys.remove);

  // 2. Component State
  const [currentFilter, setCurrentFilter] = useState<FilterStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPreviewEmpty, setIsPreviewEmpty] = useState(false);
  const [activeMenuSurveyId, setActiveMenuSurveyId] = useState<Id<"surveys"> | null>(null);

  // Modals & Notifications
  const [viewSurvey, setViewSurvey] = useState<SurveyRecord | null>(null);
  const [surveyToDelete, setSurveyToDelete] = useState<SurveyRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info", subtext?: string) => {
    setToast({
      id: String(Date.now()),
      type,
      message,
      subtext,
      duration: 4000,
    });
  };

  // Check for redirected creation parameter
  useEffect(() => {
    if (searchParams.get("created")) {
      const createdName = searchParams.get("name") || "Survey";
      showToast(
        "Survey Draft Created",
        "success",
        `"${createdName}" was saved as an initial draft. Question builder is scheduled next.`
      );
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/surveys");
      }
    }
  }, [searchParams]);

  // 3. Computed Metrics (Deriving from actual persisted records)
  const totalSurveysCount = surveys?.length ?? 0;
  const activeSurveysCount = surveys?.filter((s) => s.active).length ?? 0;
  const inactiveSurveysCount = totalSurveysCount - activeSurveysCount;

  // Use dedicated query if available, or sum individual review counts
  const totalReviewsCount = useMemo(() => {
    if (totalReviewsData?.totalReviews !== undefined) {
      return totalReviewsData.totalReviews;
    }
    if (!surveys) return 0;
    return surveys.reduce((acc, s) => acc + (s.reviewsCount || 0), 0);
  }, [totalReviewsData, surveys]);

  // 4. Filtering & Search Logic
  const filteredSurveys = useMemo(() => {
    if (!surveys || isPreviewEmpty) return [];

    const query = searchQuery.trim().toLowerCase();

    return surveys.filter((survey) => {
      // Status filter
      if (currentFilter === "active" && !survey.active) return false;
      if (currentFilter === "inactive" && survey.active) return false;

      // Search query filter (matches name or introduction)
      if (query) {
        const matchesName = survey.name.toLowerCase().includes(query);
        const matchesIntro = (survey.introduction || "").toLowerCase().includes(query);
        if (!matchesName && !matchesIntro) return false;
      }

      return true;
    });
  }, [surveys, currentFilter, searchQuery, isPreviewEmpty]);

  // Date and Time Formatter
  const formatDateTime = (timestamp?: number) => {
    if (!timestamp || isNaN(timestamp)) {
      return { date: "—", time: "—" };
    }
    const d = new Date(timestamp);
    const date = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const time = d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return { date, time };
  };

  // Mutation Handlers
  const handleToggleActive = async (survey: SurveyRecord) => {
    try {
      if (survey.active) {
        showToast("Single-Active Invariant", "info", "To change active survey, activate another survey.");
        return;
      }
      await updateSurveyMutation({
        id: survey._id,
        active: true,
      });
      showToast("Survey Activated", "success", `"${survey.name}" is now the active survey shown at checkout.`);
    } catch (err: any) {
      showToast("Activation Failed", "error", err?.message || "Could not activate survey");
    } finally {
      setActiveMenuSurveyId(null);
    }
  };

  const handleCloneSurvey = async (survey: SurveyRecord) => {
    try {
      setIsCloning(true);
      const newId = await createSurveyMutation({
        name: `Copy of ${survey.name}`,
        copySurveyId: survey._id,
        active: false,
      });
      showToast("Survey Cloned", "success", `Cloned "${survey.name}" with all its configured questions.`);
    } catch (err: any) {
      showToast("Clone Failed", "error", err?.message || "Failed to clone survey");
    } finally {
      setIsCloning(false);
      setActiveMenuSurveyId(null);
    }
  };

  const handleDeleteSurvey = async () => {
    if (!surveyToDelete) return;
    try {
      setIsDeleting(true);
      await deleteSurveyMutation({ id: surveyToDelete._id });
      showToast("Survey Deleted", "success", `"${surveyToDelete.name}" and its responses were permanently deleted.`);
      setSurveyToDelete(null);
    } catch (err: any) {
      showToast("Deletion Failed", "error", err?.message || "Failed to delete survey");
    } finally {
      setIsDeleting(false);
      setActiveMenuSurveyId(null);
    }
  };

  // Handlers for Unimplemented Actions (Providing clear status instead of broken routes)
  const handleCreateSurveyClick = () => {
    router.push("/surveys/create");
  };

  const handleEditClick = (survey: SurveyRecord) => {
    router.push(`/surveys/${survey._id}/questions`);
  };

  const handleAnalyticsClick = (survey: SurveyRecord) => {
    router.push(`/surveys/${survey._id}/analytics`);
  };

  return (
    <PosShell title="Surveys" subtitle="Guest Experience / Feedback Module">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="flex-1 overflow-y-auto bg-[#fff8f5] p-6 lg:p-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-6 pb-12">
        {/* Top Bar: Breadcrumb, Title & Global Actions */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-[#5b5f64] uppercase font-mono">
              <span>Guest Experience</span>
              <span className="text-[#5b5f64]/40 font-bold">/</span>
              <span className="text-[#1b1c1c] font-bold">Feedback Module</span>
            </div>
            <h1 className="text-[32px] leading-tight font-bold tracking-tight text-[#1b1c1c]">Surveys</h1>
            <p className="text-[14px] text-[#5b5f64]">
              Create and manage customer feedback surveys for your restaurant.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            <button
              onClick={() => setIsPreviewEmpty((prev) => !prev)}
              className="h-10 px-4 bg-white text-[#1b1c1c] border border-[#e3e2e2] font-medium text-[13px] rounded-lg shadow-xs hover:bg-[#f5f3f3] transition-colors flex items-center gap-2 cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px] text-[#5b5f64]">
                {isPreviewEmpty ? "visibility_off" : "visibility"}
              </span>
              <span>{isPreviewEmpty ? "Exit Empty Preview" : "Preview Empty State"}</span>
            </button>

            <button
              onClick={handleCreateSurveyClick}
              className="h-10 px-4 bg-black hover:bg-stone-800 text-white font-semibold text-[13px] rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Create Survey</span>
            </button>
          </div>
        </div>

        {/* Metric Summary Grid (3 Compact Understated Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Total Surveys */}
          <div className="bg-white rounded-xl p-5 shadow-xs border border-[#efeded] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#5b5f64] mb-2">
              <span className="text-[13px] font-medium text-[#5b5f64]">Total Surveys</span>
              <span className="material-symbols-outlined text-[18px] text-[#5b5f64]">ballot</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[32px] font-bold tracking-tight text-[#1b1c1c] leading-none">
                {surveys === undefined ? "—" : totalSurveysCount}
              </span>
              <span className="text-[12px] text-[#5b5f64] font-medium tracking-tight">registered</span>
            </div>
            <p className="text-[12px] text-[#5b5f64] mt-2">Created in restaurant catalog</p>
          </div>

          {/* Card 2: Active Survey */}
          <div className="bg-white rounded-xl p-5 shadow-xs border border-[#efeded] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#5b5f64] mb-2">
              <span className="text-[13px] font-medium text-[#5b5f64]">Active Survey</span>
              <span className="material-symbols-outlined text-[18px] text-[#5b5f64]">campaign</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[32px] font-bold tracking-tight text-[#1b1c1c] leading-none">
                {surveys === undefined ? "—" : activeSurveysCount}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#dde0e6] text-[#181c20] text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1b1c1c] animate-pulse"></span>
                {activeSurveysCount > 0 ? `${activeSurveysCount} In Rotation` : "None Active"}
              </span>
            </div>
            <p className="text-[12px] text-[#5b5f64] mt-2">Currently shown at checkout & guest devices</p>
          </div>

          {/* Card 3: Total Reviews Received */}
          <div className="bg-white rounded-xl p-5 shadow-xs border border-[#efeded] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#5b5f64] mb-2">
              <span className="text-[13px] font-medium text-[#5b5f64]">Total Reviews Received</span>
              <span className="material-symbols-outlined text-[18px] text-[#5b5f64]">rate_review</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[32px] font-bold tracking-tight text-[#1b1c1c] leading-none">
                {surveys === undefined ? "—" : totalReviewsCount}
              </span>
              <span className="text-[12px] text-[#5b5f64] font-medium tracking-tight">responses</span>
            </div>
            <p className="text-[12px] text-[#5b5f64] mt-2">Verified submitted customer attempts</p>
          </div>
        </div>

        {/* Table Management Section */}
        <div className="bg-white rounded-xl shadow-xs border border-[#efeded] flex flex-col">
          {/* Filter Bar & Search */}
          <div className="p-4 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#efeded] rounded-t-xl">
            {/* Segmented Filter Pills */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => {
                  setCurrentFilter("all");
                  setIsPreviewEmpty(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${
                  currentFilter === "all"
                    ? "bg-black text-white"
                    : "bg-[#f5f3f3] hover:bg-[#efeded] text-[#5b5f64]"
                }`}
                type="button"
              >
                All surveys <span className="ml-1 opacity-70">{totalSurveysCount}</span>
              </button>
              <button
                onClick={() => {
                  setCurrentFilter("active");
                  setIsPreviewEmpty(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${
                  currentFilter === "active"
                    ? "bg-black text-white"
                    : "bg-[#f5f3f3] hover:bg-[#efeded] text-[#5b5f64]"
                }`}
                type="button"
              >
                Active <span className="ml-1 opacity-70">{activeSurveysCount}</span>
              </button>
              <button
                onClick={() => {
                  setCurrentFilter("inactive");
                  setIsPreviewEmpty(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${
                  currentFilter === "inactive"
                    ? "bg-black text-white"
                    : "bg-[#f5f3f3] hover:bg-[#efeded] text-[#5b5f64]"
                }`}
                type="button"
              >
                Inactive <span className="ml-1 opacity-70">{inactiveSurveysCount}</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="w-full sm:w-72 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#5b5f64] pointer-events-none">
                search
              </span>
              <input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsPreviewEmpty(false);
                }}
                className="w-full h-9 pl-9 pr-3 bg-[#f5f3f3] text-[#1b1c1c] placeholder:text-[#5b5f64] rounded-lg text-[14px] focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 transition-all"
                placeholder="Search surveys..."
                type="text"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5b5f64] hover:text-[#1b1c1c] text-xs cursor-pointer"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Loading Skeleton */}
          {surveys === undefined && (
            <div className="p-8 flex flex-col gap-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-16 bg-[#f5f3f3] animate-pulse rounded-lg w-full" />
              ))}
            </div>
          )}

          {/* Main Surveys Table Container */}
          {surveys !== undefined && filteredSurveys.length > 0 && (
            <div className="w-full overflow-x-auto min-h-[300px] relative">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f5f3f3]/70 text-[#5b5f64] text-[11px] uppercase tracking-wider border-b border-[#efeded]">
                    <th className="py-3 px-4 font-semibold min-w-[200px]">SURVEY NAME</th>
                    <th className="py-3 px-4 font-semibold min-w-[110px]">QUESTIONS</th>
                    <th className="py-3 px-4 font-semibold min-w-[130px]">REVIEWS RECEIVED</th>
                    <th className="py-3 px-4 font-semibold min-w-[90px]">STATUS</th>
                    <th className="py-3 px-4 font-semibold min-w-[120px]">LAST UPDATED</th>
                    <th className="py-3 px-4 font-semibold text-right min-w-[190px]">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#efeded] text-[14px] text-[#1b1c1c]">
                  {filteredSurveys.map((survey, idx) => {
                    const { date, time } = formatDateTime(survey.updatedAt);
                    const isMenuOpen = activeMenuSurveyId === survey._id;

                    return (
                      <tr key={survey._id} className="hover:bg-[#f5f3f3]/40 transition-colors group">
                        {/* Survey Name & Desc */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[15px] text-[#1b1c1c] font-semibold truncate group-hover:text-black">
                                {survey.name}
                              </span>
                              <button
                                onClick={() => setViewSurvey(survey)}
                                className="text-[#5b5f64] opacity-0 group-hover:opacity-100 transition-opacity hover:text-black cursor-pointer"
                                title="Inspect Survey"
                              >
                                <span className="material-symbols-outlined text-[16px] align-middle">open_in_new</span>
                              </button>
                            </div>
                            <span className="text-[12px] text-[#5b5f64] truncate mt-0.5 max-w-sm">
                              {survey.introduction || "No introduction description configured"}
                            </span>
                          </div>
                        </td>

                        {/* Questions Badge */}
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#f5f3f3] text-[#1b1c1c] text-[11px] font-medium">
                            <span className="material-symbols-outlined text-[15px] text-[#5b5f64]">
                              format_list_bulleted
                            </span>
                            {survey.questionsCount} {survey.questionsCount === 1 ? "question" : "questions"}
                          </span>
                        </td>

                        {/* Reviews Received */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                survey.reviewsCount > 0 ? "bg-emerald-500" : "bg-stone-300"
                              }`}
                            />
                            <div className="flex items-baseline gap-1">
                              <span className="text-[16px] font-bold text-[#1b1c1c]">
                                {survey.reviewsCount}
                              </span>
                              <span className="text-[12px] text-[#5b5f64]">reviews</span>
                            </div>
                          </div>
                        </td>

                        {/* Status Pill */}
                        <td className="py-4 px-4">
                          {survey.active ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#dde0e6] text-[#181c20] text-[11px] font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#1b1c1c]"></span>
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#efeded] text-[#5b5f64] text-[11px] font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
                              Inactive
                            </span>
                          )}
                        </td>

                        {/* Last Updated */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col text-[#5b5f64] text-[12px]">
                            <span className="font-medium text-[#1b1c1c]">{date}</span>
                            <span className="text-[#5b5f64]/80">{time}</span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1 relative">
                            {/* View Action */}
                            <button
                              onClick={() => setViewSurvey(survey)}
                              className="px-2 py-1.5 rounded hover:bg-[#efeded] text-[#5b5f64] hover:text-[#1b1c1c] text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                              type="button"
                              title="View Survey Details"
                            >
                              <span className="material-symbols-outlined text-[16px]">visibility</span>
                              <span>View</span>
                            </button>

                            {/* Edit Action */}
                            <button
                              onClick={() => handleEditClick(survey)}
                              className="px-2 py-1.5 rounded hover:bg-[#efeded] text-[#5b5f64] hover:text-[#1b1c1c] text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                              type="button"
                              title="Edit Survey Questions"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                              <span>Edit</span>
                            </button>

                            {/* Analytics (Highlight Route Action) */}
                            <button
                              onClick={() => handleAnalyticsClick(survey)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#e9e8e7] hover:bg-[#e3e2e2] text-[#1b1c1c] text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                              type="button"
                              title="Survey Analytics"
                            >
                              <span className="material-symbols-outlined text-[16px] text-[#1b1c1c]">insights</span>
                              <span>Analytics</span>
                            </button>

                            {/* More Menu Dropdown Toggle */}
                            <div className="relative">
                              <button
                                onClick={() => setActiveMenuSurveyId(isMenuOpen ? null : survey._id)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5b5f64] hover:text-[#1b1c1c] hover:bg-[#efeded] transition-colors cursor-pointer"
                                type="button"
                                title="More Actions"
                              >
                                <span className="material-symbols-outlined text-[18px]">more_vert</span>
                              </button>

                              {/* Dropdown Menu Popover */}
                              {isMenuOpen && (
                                <>
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuSurveyId(null);
                                    }}
                                  />
                                  <div
                                    className={`absolute right-0 w-48 bg-white border border-[#e3e2e2] rounded-xl shadow-2xl py-1.5 z-50 text-left text-xs font-medium animate-in fade-in zoom-in-95 duration-100 ${
                                      filteredSurveys.length > 2 && idx >= filteredSurveys.length - 1
                                        ? "bottom-8 mb-1 origin-bottom-right"
                                        : "top-9 origin-top-right"
                                    }`}
                                  >
                                    <button
                                      onClick={() => handleToggleActive(survey)}
                                      disabled={survey.active}
                                      className={`w-full px-3 py-2 text-left flex items-center gap-2 ${
                                        survey.active
                                          ? "text-stone-300 cursor-not-allowed"
                                          : "text-[#1b1c1c] hover:bg-[#f5f3f3] cursor-pointer"
                                      }`}
                                    >
                                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                      <span>{survey.active ? "Currently Active" : "Set as Active"}</span>
                                    </button>

                                    <button
                                      onClick={() => handleCloneSurvey(survey)}
                                      disabled={isCloning}
                                      className="w-full px-3 py-2 text-left text-[#1b1c1c] hover:bg-[#f5f3f3] flex items-center gap-2 cursor-pointer"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                                      <span>Clone Survey</span>
                                    </button>

                                    <div className="my-1 border-t border-[#efeded]" />

                                    <button
                                      onClick={() => {
                                        setSurveyToDelete(survey);
                                        setActiveMenuSurveyId(null);
                                      }}
                                      className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">delete</span>
                                      <span>Delete Survey</span>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty State View (When empty preview is active, no surveys configured, or filters match 0) */}
          {surveys !== undefined && (filteredSurveys.length === 0 || isPreviewEmpty) && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white">
              <div className="w-16 h-16 rounded-full bg-[#f5f3f3] flex items-center justify-center mb-3 text-[#5b5f64]">
                <span className="material-symbols-outlined text-[32px]">rate_review</span>
              </div>
              <h3 className="text-[20px] font-semibold text-[#1b1c1c] mb-1">
                {totalSurveysCount === 0 || isPreviewEmpty
                  ? "No surveys configured"
                  : "No matching surveys found"}
              </h3>
              <p className="text-[14px] text-[#5b5f64] max-w-sm mb-6">
                {totalSurveysCount === 0 || isPreviewEmpty
                  ? "There are currently no customer feedback surveys configured for this restaurant location."
                  : "No surveys match your current search or status filter. Try clearing your search or filter pills."}
              </p>
              {totalSurveysCount === 0 || isPreviewEmpty ? (
                <button
                  onClick={handleCreateSurveyClick}
                  className="px-4 py-2 bg-black text-white text-[13px] font-semibold rounded-lg shadow-xs hover:bg-stone-800 transition-colors flex items-center gap-2 cursor-pointer"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  <span>Create Your First Survey</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentFilter("all");
                  }}
                  className="px-4 py-2 bg-[#f5f3f3] hover:bg-[#efeded] text-[#1b1c1c] text-[13px] font-semibold rounded-lg transition-colors cursor-pointer"
                  type="button"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}

          {/* Table Footer / Metadata Bar */}
          <div className="px-4 py-3 bg-white border-t border-[#efeded] rounded-b-xl flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[#5b5f64] relative z-10">
            <div>
              Showing <span className="font-semibold text-[#1b1c1c]">{filteredSurveys.length}</span> of{" "}
              <span className="font-semibold text-[#1b1c1c]">{totalSurveysCount}</span> surveys
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-stone-400"></span>
              <span className="font-semibold tracking-wider text-[#1b1c1c] uppercase text-[11px] font-mono">
                TERMINAL SYNC: CURRENT
              </span>
              <span className="text-[#5b5f64]/60 font-normal">• Cloud Relay Active</span>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* VIEW SURVEY INSPECTION MODAL */}
      {viewSurvey && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-mono font-bold text-stone-500">
                  Survey Inspection
                </span>
                <h3 className="text-[20px] font-bold text-stone-900 leading-snug">{viewSurvey.name}</h3>
              </div>
              <button
                onClick={() => setViewSurvey(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-stone-700">
              <div className="p-3 bg-stone-50 rounded-xl space-y-2 border border-stone-200">
                <div className="flex justify-between">
                  <span className="text-stone-500">Status</span>
                  <span className={`font-semibold ${viewSurvey.active ? "text-emerald-700" : "text-stone-500"}`}>
                    {viewSurvey.active ? "Active In Rotation" : "Inactive"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Configured Questions</span>
                  <span className="font-semibold text-stone-900">{viewSurvey.questionsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Verified Reviews</span>
                  <span className="font-semibold text-stone-900">{viewSurvey.reviewsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Last Modified</span>
                  <span className="font-mono text-stone-900">
                    {formatDateTime(viewSurvey.updatedAt).date} {formatDateTime(viewSurvey.updatedAt).time}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-stone-600 block mb-1">Introduction Text</label>
                <div className="p-3 bg-stone-50 rounded-lg text-stone-700 italic border border-stone-200">
                  {viewSurvey.introduction || "No intro text configured."}
                </div>
              </div>

              <div>
                <label className="font-semibold text-stone-600 block mb-1">Closing Message</label>
                <div className="p-3 bg-stone-50 rounded-lg text-stone-700 italic border border-stone-200">
                  {viewSurvey.afterSurveyContent || "No thank-you message configured."}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setViewSurvey(null)}
                className="px-4 py-2 bg-stone-900 text-white font-medium rounded-lg hover:bg-stone-800 text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {surveyToDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-red-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[24px]">delete</span>
            </div>
            <h3 className="text-lg font-bold text-stone-900 mb-1">Delete Survey?</h3>
            <p className="text-xs text-stone-600 mb-4 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <strong className="text-stone-900 font-semibold">"{surveyToDelete.name}"</strong>? This will cascade and
              delete all its configured questions, attempts, and submitted reviews.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSurveyToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-lg text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSurvey}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting && (
                  <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                )}
                <span>{isDeleting ? "Deleting..." : "Delete Permanently"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </PosShell>
  );
}
