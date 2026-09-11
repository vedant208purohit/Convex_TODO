"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth, useClerk } from "@clerk/nextjs";
import { ReactNode, useEffect, useMemo, useState } from "react";

interface StoreResolutionData {
  organization?: {
    id: string;
    slug: string;
    name: string;
  };
  deploymentUrl?: string;
  user?: {
    role: string;
    status: string;
  };
}

function DynamicConvexProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { signOut } = useClerk();

  const [resolutionState, setResolutionState] = useState<{
    loading: boolean;
    error: string | null;
    errorCode: string | null;
    data: StoreResolutionData | null;
  }>({
    loading: true,
    error: null,
    errorCode: null,
    data: null,
  });

  useEffect(() => {
    let isCancelled = false;

    async function resolveStoreDeployment() {
      if (!isLoaded) return;

      if (!isSignedIn || !userId) {
        // When not signed in, reset resolution state
        setResolutionState({
          loading: false,
          error: null,
          errorCode: null,
          data: null,
        });
        return;
      }

      setResolutionState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const res = await fetch("/api/auth/resolve-store", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
        });

        const data = await res.json().catch(() => ({}));

        if (isCancelled) return;

        if (!res.ok || !data.success || !data.deploymentUrl) {
          let errorMsg = data.error || "Failed to resolve your store database.";
          if (data.code === "STORE_NOT_ASSIGNED") {
            errorMsg =
              "Your staff account is not assigned to an active store. Please contact your store owner.";
          } else if (data.code === "ACCOUNT_INACTIVE") {
            errorMsg =
              "Your staff account has been deactivated. Please contact your administrator.";
          } else if (data.code === "DEPLOYMENT_UNAVAILABLE") {
            errorMsg =
              "Your store database is currently provisioning or deploying. Please wait a few moments.";
          }

          setResolutionState({
            loading: false,
            error: errorMsg,
            errorCode: data.code || "UNKNOWN_ERROR",
            data: null,
          });
          return;
        }

        setResolutionState({
          loading: false,
          error: null,
          errorCode: null,
          data: {
            organization: data.organization,
            deploymentUrl: data.deploymentUrl,
            user: data.user,
          },
        });
      } catch (err: any) {
        if (isCancelled) return;
        setResolutionState({
          loading: false,
          error: "Unable to reach store resolution service. Check your connection.",
          errorCode: "NETWORK_ERROR",
          data: null,
        });
      }
    }

    resolveStoreDeployment();

    return () => {
      isCancelled = true;
    };
  }, [isLoaded, isSignedIn, userId]);

  // Determine active Convex URL strictly from server resolution or fallback for unauthenticated pages
  const resolvedUrl = resolutionState.data?.deploymentUrl;
  const staticFallbackUrl = process.env.NEXT_PUBLIC_CONVEX_URL || null;
  const activeConvexUrl = isSignedIn ? resolvedUrl : (staticFallbackUrl || resolvedUrl);

  const convex = useMemo(() => {
    if (!activeConvexUrl) return null;
    return new ConvexReactClient(activeConvexUrl);
  }, [activeConvexUrl]);

  // Unauthenticated loading / rendering
  if (!isLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#fdf8f7] text-[#1c1b1b]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ff5722] border-t-transparent" />
          <p className="text-sm font-medium text-stone-600">Initializing POS session...</p>
        </div>
      </div>
    );
  }

  // Not signed in: render children (e.g. sign-in/sign-up pages) with fallback client or wait
  if (!isSignedIn) {
    if (convex) {
      return (
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          {children}
        </ConvexProviderWithClerk>
      );
    }
    return <>{children}</>;
  }

  // Signed in: resolving store
  if (resolutionState.loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#fdf8f7] text-[#1c1b1b]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ff5722] border-t-transparent" />
          <p className="text-sm font-medium text-stone-700">Connecting to store database...</p>
        </div>
      </div>
    );
  }

  // Signed in: resolution failed (unassigned, inactive, or deployment error)
  if (resolutionState.error || !convex) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#fdf8f7] p-6 text-[#1c1b1b]">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-stone-900">Store Access Denied</h2>
          <p className="mt-2 text-sm text-stone-600 leading-relaxed">
            {resolutionState.error || "Unable to locate an authorized store database for your account."}
          </p>
          {resolutionState.errorCode && (
            <div className="mt-3 inline-block rounded-md bg-stone-100 px-2.5 py-1 text-xs font-mono text-stone-500">
              {resolutionState.errorCode}
            </div>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full rounded-xl bg-stone-900 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800"
            >
              Retry Connection
            </button>
            <button
              onClick={() => signOut({ redirectUrl: "/sign-in" })}
              className="w-full rounded-xl border border-stone-200 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return <DynamicConvexProvider>{children}</DynamicConvexProvider>;
}
