"use client";

import { ConvexReactClient, useQuery, useMutation } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth, useClerk } from "@clerk/nextjs";
import {
  createContext,
  useCallback,
  useContext,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { api } from "../convex/_generated/api";

export interface AvailableStore {
  id: string;
  slug: string;
  name: string;
  role: string;
  status: string;
}

export interface StoreResolutionContextValue {
  activeOrganization: { id?: string; slug?: string; name?: string } | null;
  availableStores: AvailableStore[];
  switchStore: (orgId: string) => Promise<void>;
  openStoreSelector: () => void;
  isSwitching: boolean;
}

export const StoreResolutionContext = createContext<StoreResolutionContextValue>({
  activeOrganization: null,
  availableStores: [],
  switchStore: async () => {},
  openStoreSelector: () => {},
  isSwitching: false,
});

export function useStoreResolution() {
  return useContext(StoreResolutionContext);
}

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
  availableStores?: AvailableStore[];
}

function StoreSessionGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isAuthPage =
    pathname === "/sign-in" ||
    pathname.startsWith("/sign-in/") ||
    pathname === "/sign-up" ||
    pathname.startsWith("/sign-up/") ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/onboarding" ||
    pathname.startsWith("/onboarding/");

  if (isAuthPage) {
    return <>{children}</>;
  }

  return <AuthenticatedStoreSessionGuard>{children}</AuthenticatedStoreSessionGuard>;
}

function AuthenticatedStoreSessionGuard({ children }: { children: ReactNode }) {
  const { signOut } = useClerk();

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
      !(currentMembership as any).status
    )
  );

  // Auto-sync invitation acceptance when user arrives with ticket or pending invitation
  useEffect(() => {
    let isMounted = true;
    if (isPendingInvitation && activeOrg?._id && !isAccepting && !acceptError) {
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
  }, [isPendingInvitation, activeOrg?._id, acceptError, isAccepting]);

  if (organizations === undefined || (activeOrg && currentMembership === undefined)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#fdf8f7] text-[#1c1b1b]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#141010] border-t-transparent" />
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

function StoreSelectorModal({
  stores,
  currentOrgId,
  onSelect,
  isSwitching,
}: {
  stores: AvailableStore[];
  currentOrgId?: string;
  onSelect: (orgId: string) => Promise<void>;
  isSwitching: boolean;
}) {
  const { signOut } = useClerk();

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 sm:p-8 shadow-2xl border border-[#e7e5e4]">
        <div className="flex items-center justify-between border-b border-[#e7e5e4] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#f1edec] border border-[#e7e5e4] flex items-center justify-center font-serif font-bold text-lg text-[#141010] shrink-0">
              P
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#141010] tracking-tight">Select Restaurant</h2>
              <p className="text-xs text-[#78716c]">Choose which restaurant you want to work at today</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ redirectUrl: "/sign-in" })}
            className="text-xs font-medium text-[#78716c] hover:text-[#141010] px-2.5 py-1.5 rounded-lg hover:bg-[#f1edec] transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>

        <div className="mt-5 space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {stores.map((store) => {
            const isCurrent = store.id === currentOrgId;
            return (
              <button
                key={store.id}
                type="button"
                disabled={isSwitching}
                onClick={() => onSelect(store.id)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left cursor-pointer group ${
                  isCurrent
                    ? "border-2 border-[#141010] bg-[#faf9f8] shadow-xs"
                    : "border-[#e7e5e4] bg-white hover:border-[#141010] hover:bg-[#faf9f8]"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-serif font-bold text-sm shrink-0 border ${
                      isCurrent
                        ? "bg-[#141010] text-white border-[#141010]"
                        : "bg-[#f1edec] text-[#141010] border-[#e7e5e4] group-hover:bg-[#e7e5e4]"
                    }`}
                  >
                    {store.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-sm text-[#141010] truncate">
                      {store.name}
                    </span>
                    <span className="text-xs text-[#78716c] capitalize">
                      Role: <strong className="font-medium text-[#141010]">{store.role}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isCurrent && (
                    <span className="text-[10px] font-semibold tracking-wide uppercase text-white bg-[#141010] px-2.5 py-0.5 rounded-full">
                      Current
                    </span>
                  )}
                  <span
                    className={`text-xs font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform ${
                      isCurrent
                        ? "text-[#141010]"
                        : "text-[#78716c] group-hover:text-[#141010]"
                    }`}
                  >
                    {isSwitching ? "Opening..." : "Enter →"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-center text-xs text-[#a8a29e]">
          You can also switch restaurants at any time from the top header bar inside the POS.
        </p>
      </div>
    </div>
  );
}

function DynamicConvexProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { signOut } = useClerk();
  const lastResolvedUserIdRef = useRef<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [storeSelectionPrompt, setStoreSelectionPrompt] = useState(false);

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

  const switchStore = useCallback(
    async (orgId: string) => {
      if (typeof window !== "undefined" && userId) {
        sessionStorage.setItem(`prest_session_store_chosen_${userId}`, orgId);
        localStorage.setItem(`prest_active_store_${userId}`, orgId);
      }
      setIsSwitching(true);
      setResolutionState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const res = await fetch(
          `/api/auth/resolve-store?organizationId=${encodeURIComponent(orgId)}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(12000),
            cache: "no-store",
          }
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success && data.deploymentUrl) {
          lastResolvedUserIdRef.current = userId;
          setResolutionState({
            loading: false,
            error: null,
            errorCode: null,
            data: {
              organization: data.organization,
              deploymentUrl: data.deploymentUrl,
              user: data.user,
              availableStores: data.availableStores || [],
            },
          });
          setStoreSelectionPrompt(false);
          if (typeof window !== "undefined" && window.location.pathname !== "/dashboard") {
            window.location.href = "/dashboard";
          }
        } else {
          setResolutionState((prev) => ({
            ...prev,
            loading: false,
            error: data.error || "Failed to switch store.",
            errorCode: data.code || "SWITCH_FAILED",
          }));
        }
      } catch (err: any) {
        const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
        setResolutionState((prev) => ({
          ...prev,
          loading: false,
          error: isTimeout
            ? "Switching store timed out. Please try again."
            : err?.message || "Failed to switch store.",
          errorCode: isTimeout ? "GATEWAY_TIMEOUT" : "NETWORK_ERROR",
        }));
      } finally {
        setIsSwitching(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    let isCancelled = false;

    async function resolveStoreDeployment() {
      if (!isLoaded) return;

      if (!isSignedIn || !userId) {
        lastResolvedUserIdRef.current = null;
        setResolutionState({
          loading: false,
          error: null,
          errorCode: null,
          data: null,
        });
        return;
      }

      // If store is already resolved for this user, do not re-fetch and unmount on every internal route navigation
      if (resolutionState.data?.deploymentUrl && lastResolvedUserIdRef.current === userId) {
        return;
      }

      setResolutionState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem("prest_active_store_org_id");
        }

        const userKey = `prest_active_store_${userId}`;
        const sessionKey = `prest_session_store_chosen_${userId}`;
        const sessionChosenOrgId =
          typeof window !== "undefined" ? sessionStorage.getItem(sessionKey) : null;

        const currentSearch = typeof window !== "undefined" ? window.location.search : "";
        const searchParams = new URLSearchParams(currentSearch);
        const rawUrlTarget =
          searchParams.get("organizationId") ||
          searchParams.get("orgId") ||
          searchParams.get("slug") ||
          searchParams.get("store");

        // If the URL has an explicit target (?slug=... or ?organizationId=...), prioritize it!
        // Otherwise, if the user already chose a store during this active browser session, use that.
        // If neither, do NOT auto-inject storedOrgId into the request so that Master returns all available stores
        // and we can prompt the user to choose their store!
        if (sessionChosenOrgId && !rawUrlTarget) {
          searchParams.set("organizationId", sessionChosenOrgId);
        }

        const search = searchParams.toString() ? `?${searchParams.toString()}` : "";

        const res = await fetch(`/api/auth/resolve-store${search}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(12000),
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
          } else if (data.code === "GATEWAY_TIMEOUT") {
            errorMsg =
              "Connecting to store directory timed out. Please click Retry Connection.";
          }

          setResolutionState({
            loading: false,
            error: errorMsg,
            errorCode: data.code || "UNKNOWN_ERROR",
            data: null,
          });
          return;
        }

        lastResolvedUserIdRef.current = userId;
        const availableStores = data.availableStores || [];

        // If user belongs to multiple stores, and did NOT arrive with an explicit link (?slug or ?orgId),
        // and hasn't chosen a store in this session -> prompt them to choose!
        if (availableStores.length > 1 && !rawUrlTarget && !sessionChosenOrgId) {
          setStoreSelectionPrompt(true);
        } else {
          setStoreSelectionPrompt(false);
          if (data.organization?.id && typeof window !== "undefined") {
            sessionStorage.setItem(sessionKey, data.organization.id);
            localStorage.setItem(userKey, data.organization.id);
          }
        }

        setResolutionState({
          loading: false,
          error: null,
          errorCode: null,
          data: {
            organization: data.organization,
            deploymentUrl: data.deploymentUrl,
            user: data.user,
            availableStores,
          },
        });
      } catch (err: any) {
        if (isCancelled) return;
        const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
        setResolutionState({
          loading: false,
          error: isTimeout
            ? "Connecting to store database timed out. Please click Retry Connection."
            : "Unable to reach store resolution service. Check your connection.",
          errorCode: isTimeout ? "GATEWAY_TIMEOUT" : "NETWORK_ERROR",
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

  // Fallback to static Convex URL if resolution fails or if user is on onboarding/setting up their store
  const activeConvexUrl =
    resolvedUrl || staticFallbackUrl;

  const convex = useMemo(() => {
    if (!activeConvexUrl) return null;
    return new ConvexReactClient(activeConvexUrl, {
      logger: {
        logVerbose: (...args: any[]) => console.debug(...args),
        log: (...args: any[]) => console.log(...args),
        warn: (...args: any[]) => console.warn(...args),
        error: (...args: any[]) => {
          // If it's an application-level business logic ConvexError (e.g. out of stock, validation failure),
          // log as console.warn so Next.js Turbopack dev overlay does not pop up a full-screen modal,
          // while still remaining visible in developer console.
          const isAppError = args.some(
            (a) =>
              typeof a === "string" &&
              (a.includes("ConvexError") ||
                a.includes("Server Error\nUncaught ConvexError") ||
                a.includes("Uncaught ConvexError"))
          );
          if (isAppError) {
            console.warn(...args);
          } else {
            console.error(...args);
          }
        },
      },
    });
  }, [activeConvexUrl]);

  if (!isLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#fdf8f7] text-[#1c1b1b]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#141010] border-t-transparent" />
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
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#141010] border-t-transparent" />
          <p className="text-sm font-medium text-stone-700">Connecting to store database...</p>
        </div>
      </div>
    );
  }

  if (resolutionState.error) {
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
          <h2 className="text-xl font-semibold text-stone-900">{isUnassigned ? "No Store Assigned" : "Store Connection Error"}</h2>
          <p className="mt-2 text-sm text-stone-600 leading-relaxed">
            {resolutionState.error}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {!isUnassigned && (
              <button
                type="button"
                onClick={() => {
                  lastResolvedUserIdRef.current = null;
                  window.location.reload();
                }}
                className="w-full rounded-xl bg-stone-900 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 cursor-pointer shadow"
              >
                Retry Connection
              </button>
            )}
            <button
              type="button"
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

  if (storeSelectionPrompt && (resolutionState.data?.availableStores?.length || 0) > 1) {
    return (
      <StoreResolutionContext.Provider
        value={{
          activeOrganization: resolutionState.data?.organization || null,
          availableStores: resolutionState.data?.availableStores || [],
          switchStore,
          openStoreSelector: () => setStoreSelectionPrompt(true),
          isSwitching,
        }}
      >
        <StoreSelectorModal
          stores={resolutionState.data?.availableStores || []}
          currentOrgId={resolutionState.data?.organization?.id}
          onSelect={async (orgId) => {
            if (typeof window !== "undefined" && userId) {
              sessionStorage.setItem(`prest_session_store_chosen_${userId}`, orgId);
              localStorage.setItem(`prest_active_store_${userId}`, orgId);
            }
            setStoreSelectionPrompt(false);
            if (resolutionState.data?.organization?.id === orgId) {
              if (typeof window !== "undefined" && window.location.pathname !== "/dashboard") {
                window.location.href = "/dashboard";
              }
            } else {
              await switchStore(orgId);
            }
          }}
          isSwitching={isSwitching}
        />
      </StoreResolutionContext.Provider>
    );
  }

  if (!convex) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#fdf8f7] text-[#1c1b1b]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#141010] border-t-transparent" />
          <p className="text-sm font-medium text-stone-600">Initializing store database...</p>
        </div>
      </div>
    );
  }

  return (
    <StoreResolutionContext.Provider
      value={{
        activeOrganization: resolutionState.data?.organization || null,
        availableStores: resolutionState.data?.availableStores || [],
        switchStore,
        openStoreSelector: () => setStoreSelectionPrompt(true),
        isSwitching,
      }}
    >
      {storeSelectionPrompt && (resolutionState.data?.availableStores?.length || 0) > 1 && (
        <StoreSelectorModal
          stores={resolutionState.data?.availableStores || []}
          currentOrgId={resolutionState.data?.organization?.id}
          onSelect={async (orgId) => {
            if (typeof window !== "undefined" && userId) {
              sessionStorage.setItem(`prest_session_store_chosen_${userId}`, orgId);
              localStorage.setItem(`prest_active_store_${userId}`, orgId);
            }
            setStoreSelectionPrompt(false);
            if (resolutionState.data?.organization?.id === orgId) {
              if (typeof window !== "undefined" && window.location.pathname !== "/dashboard") {
                window.location.href = "/dashboard";
              }
            } else {
              await switchStore(orgId);
            }
          }}
          isSwitching={isSwitching}
        />
      )}
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <StoreSessionGuard>
          {children}
        </StoreSessionGuard>
      </ConvexProviderWithClerk>
    </StoreResolutionContext.Provider>
  );
}

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return <DynamicConvexProvider>{children}</DynamicConvexProvider>;
}
