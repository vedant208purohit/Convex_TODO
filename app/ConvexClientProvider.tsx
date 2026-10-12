"use client";

import { ConvexReactClient, useQuery, useMutation } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth, useClerk } from "@clerk/nextjs";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "../convex/_generated/api";

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

function StoreSessionGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { signOut } = useClerk();

  const isAuthPage =
    pathname === "/sign-in" ||
    pathname.startsWith("/sign-in/") ||
    pathname === "/sign-up" ||
    pathname.startsWith("/sign-up/") ||
    pathname === "/login" ||
    pathname.startsWith("/login/");

  if (isAuthPage) {
    return <>{children}</>;
  }

  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;
  const currentMembership = useQuery(
    api.organizationUsers.getCurrentMembership,
    activeOrg ? { organizationId: activeOrg._id } : "skip"
  );
  const acceptInvitationMutation = useMutation(api.organizationUsers.acceptInvitation);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const [hasTicket, setHasTicket] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const search = window.location.search;
      if (search.includes("__clerk_ticket") || search.includes("__clerk_status=sign_in")) {
        setHasTicket(true);
      }
    }
  }, []);

  const isOwner = Boolean(
    activeOrg?.ownerClerkId &&
    currentMembership?.userId &&
    currentMembership.userId === activeOrg.ownerClerkId
  );
  const isPendingInvitation = !isOwner && Boolean(
    currentMembership && (
      (currentMembership as any).status === "invited" ||
      (!(currentMembership as any).status && !(currentMembership as any).userType?.includes("admin"))
    )
  );

  // Only auto-sync invitation acceptance IF user came directly from email invitation ticket
  useEffect(() => {
    let isMounted = true;
    if (isPendingInvitation && hasTicket && activeOrg?._id && !isAccepting && !acceptError) {
      setIsAccepting(true);
      acceptInvitationMutation({ organizationId: activeOrg._id })
        .catch((err: any) => {
          if (isMounted) {
            console.error("Auto-sync invitation error:", err);
            setAcceptError(err?.message || "Failed to sync invitation. Please try again.");
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsAccepting(false);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isPendingInvitation, hasTicket, activeOrg?._id, acceptError, isAccepting]);

  if (organizations === undefined || (activeOrg && currentMembership === undefined)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#fdf8f7] text-[#1c1b1b]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ff5722] border-t-transparent" />
          <p className="text-sm font-medium text-stone-600">Verifying store access...</p>
        </div>
      </div>
    );
  }

  if (organizations.length === 0 || currentMembership === null) {
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
          <h2 className="text-xl font-semibold text-stone-900">No Store Assigned</h2>
          <p className="mt-2 text-sm text-stone-600 leading-relaxed">
            You do not have any assigned store or your access has been revoked. Please contact the store owner.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => signOut({ redirectUrl: "/sign-in" })}
              className="w-full rounded-xl border border-stone-200 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentMembership && currentMembership.status === "inactive") {
    const branchName = activeOrg?.name || "Flagship Main Store";
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
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-stone-900">Account Deactivated</h2>
          <p className="mt-2 text-sm text-stone-600 leading-relaxed">
            Your staff account for {branchName} has been deactivated. Please contact your store administrator.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => signOut({ redirectUrl: "/sign-in" })}
              className="w-full rounded-xl border border-stone-200 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isPendingInvitation) {
    const branchName = activeOrg?.name || "Flagship Main Store";

    if (hasTicket && !acceptError) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-[#fdf8f7] p-6 text-[#1c1b1b]">
          <div className="w-full max-w-md rounded-2xl border border-amber-100 bg-white p-8 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <svg className="h-7 w-7 animate-spin text-amber-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Invitation Verified
            </span>
            <h2 className="text-xl font-bold text-stone-900">
              Welcome to {branchName}
            </h2>
            <p className="mt-2 text-sm text-stone-600 leading-relaxed">
              Activating your workspace and entering store...
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#fdf8f7] p-6 text-[#1c1b1b]">
        <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 mb-3">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Invitation Pending
          </span>
          <h2 className="text-xl font-bold text-stone-900">
            Welcome to {branchName}
          </h2>
          <p className="mt-2 text-sm text-stone-600 leading-relaxed">
            You have been invited to join this store team. Please accept the invitation to access the point-of-sale system and start working.
          </p>

          {acceptError && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
              {acceptError}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              disabled={isAccepting}
              onClick={async () => {
                if (!activeOrg) return;
                setIsAccepting(true);
                setAcceptError(null);
                try {
                  await acceptInvitationMutation({ organizationId: activeOrg._id });
                } catch (err: any) {
                  setAcceptError(
                    err?.message || "Failed to accept invitation. Please try again."
                  );
                } finally {
                  setIsAccepting(false);
                }
              }}
              className="w-full inline-flex items-center justify-center rounded-xl bg-stone-900 py-3 text-sm font-semibold text-white shadow hover:bg-stone-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isAccepting ? "Activating account..." : "Accept Invitation & Enter Store"}
            </button>
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: "/sign-in" })}
              className="w-full rounded-xl border border-stone-200 bg-white py-2.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
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
        const search = typeof window !== "undefined" ? window.location.search : "";
        const res = await fetch(`/api/auth/resolve-store${search}`, {
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
              "You do not have any assigned store or your access has been revoked. Please contact the store owner.";
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

  const resolvedUrl = resolutionState.data?.deploymentUrl;
  const staticFallbackUrl = process.env.NEXT_PUBLIC_CONVEX_URL || null;
  const activeConvexUrl = isSignedIn ? resolvedUrl : (staticFallbackUrl || resolvedUrl);

  const convex = useMemo(() => {
    if (!activeConvexUrl) return null;
    return new ConvexReactClient(activeConvexUrl);
  }, [activeConvexUrl]);

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

  if (resolutionState.error || !convex) {
    const isUnassigned = resolutionState.errorCode === "STORE_NOT_ASSIGNED";
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
          <h2 className="text-xl font-semibold text-stone-900">{isUnassigned ? "No Store Assigned" : "Store Access Denied"}</h2>
          <p className="mt-2 text-sm text-stone-600 leading-relaxed">
            {resolutionState.error || "Unable to locate an authorized store database for your account."}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {!isUnassigned && (
              <button
                onClick={() => window.location.reload()}
                className="w-full rounded-xl bg-stone-900 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800"
              >
                Retry Connection
              </button>
            )}
            <button
              onClick={() => signOut({ redirectUrl: "/sign-in" })}
              className="w-full rounded-xl border border-stone-200 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 cursor-pointer"
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
      <StoreSessionGuard>
        {children}
      </StoreSessionGuard>
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
