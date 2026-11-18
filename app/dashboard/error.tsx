"use client";

import { useEffect, useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;

  const initializeDefaultTemplates = useMutation(api.dashboards.initializeDefaultTemplates);

  const isTemplateInitError =
    error?.message?.includes("initialize default templates") ||
    error?.message?.includes("No active dashboard");

  const handleInitialize = useCallback(async () => {
    if (!activeOrg || isInitializing) return;
    setIsInitializing(true);
    setInitError(null);
    try {
      await initializeDefaultTemplates({ organizationId: activeOrg._id });
      setTimeout(() => {
        reset();
      }, 600);
    } catch (err: unknown) {
      console.error("Failed to initialize templates:", err);
      const msg = err instanceof Error ? err.message : "Failed to initialize default templates";
      setInitError(msg);
      setIsInitializing(false);
    }
  }, [activeOrg, isInitializing, initializeDefaultTemplates, reset]);

  // Attempt auto-initialization once if it is the template error and activeOrg is loaded
  useEffect(() => {
    if (isTemplateInitError && activeOrg && !isInitializing && !initError) {
      handleInitialize();
    }
  }, [isTemplateInitError, activeOrg, isInitializing, initError, handleInitialize]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#FCFBF7] border border-[#EBE7DF] rounded-xl p-8 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-[#F3EFE6] border border-[#E5DFD3] flex items-center justify-center mx-auto mb-4 text-[#8B3A2B]">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
        </div>

        <h3 className="font-serif text-2xl font-normal text-[#1A1A1A] mb-2">
          {isTemplateInitError ? "Dashboard Setup Required" : "Dashboard Unavailable"}
        </h3>

        <p className="text-sm text-[#736B5E] mb-6 leading-relaxed">
          {isTemplateInitError
            ? "Your restaurant's workspace has not yet seeded its default operational dashboard templates."
            : error?.message || "An unexpected error occurred while loading your dashboard."}
        </p>

        {initError && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2 text-left">
            <svg className="w-4 h-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{initError}</span>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {isTemplateInitError ? (
            <button
              onClick={handleInitialize}
              disabled={isInitializing || !activeOrg}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#8B3A2B] hover:bg-[#722F23] disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              {isInitializing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Initializing Templates...
                </>
              ) : (
                "Initialize Default Dashboard"
              )}
            </button>
          ) : (
            <button
              onClick={() => reset()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#8B3A2B] hover:bg-[#722F23] text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Try Again
            </button>
          )}

          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 border border-[#EBE7DF] hover:bg-[#F7F5EE] text-[#736B5E] rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}
