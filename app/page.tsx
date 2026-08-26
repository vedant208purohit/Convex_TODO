"use client";

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";
import {
  SignedIn,
  SignedOut,
  ClerkLoading,
  ClerkLoaded,
  RedirectToSignIn,
  UserButton,
  useUser,
} from "@clerk/nextjs";

function DashboardContent() {
  const { user } = useUser();
  const organizations = useQuery(api.organizations.list, {});
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [retryingOrgId, setRetryingOrgId] = useState<string | null>(null);

  const handleRetry = async (masterOrgId: string) => {
    setRetryingOrgId(masterOrgId);
    setError(null);
    try {
      const res = await fetch("/api/organizations/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masterOrgId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to retry provisioning");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRetryingOrgId(null);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/organizations/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to provision organization");
      }

      setName("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStoreAppUrl = (deploymentUrl?: string) => {
    const defaultAppHost = process.env.NEXT_PUBLIC_DEFAULT_APP_URL || "http://localhost:3000";
    if (!deploymentUrl) return defaultAppHost;
    return `${defaultAppHost}?convexUrl=${encodeURIComponent(deploymentUrl)}`;
  };

  return (
    <main className="admin-shell">
      <div className="admin-frame">
        {/* Header */}
        <header className="admin-header">
          <div className="admin-header-row">
            <div>
              <p className="eyebrow">Restaurant operations</p>
              <h1 className="admin-title">
                Restaurant Admin Console
              </h1>
              <p className="admin-subtitle">
                Restaurant control plane and isolated Store POS provisioning registry
              </p>
            </div>
            <div className="admin-user">
              {user && (
                <div className="admin-user-copy">
                  <p className="text-xs text-white font-medium">
                    {user.fullName || user.primaryEmailAddress?.emailAddress}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Restaurant Owner / Admin
                  </p>
                </div>
              )}
              <UserButton />
            </div>
          </div>
        </header>

        {/* Provision Form */}
        <section className="provision-card">
          <h2 className="section-title">
            Provision New Store Organization
          </h2>
          <form onSubmit={handleCreateOrg} className="provision-form">
            <input
              type="text"
              placeholder="e.g. Restaurant ABC"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="store-input"
            />
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="provision-button"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Provisioning Store...
                </>
              ) : (
                "Provision Store Project"
              )}
            </button>
          </form>

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}
        </section>

        {/* Organizations Registry Table */}
        <section className="registry-card">
          <div className="registry-heading">
            <h2 className="section-title">
              Provisioned Store Organizations & Convex Projects
            </h2>
            <span className="store-count">
              {organizations ? `${organizations.length} stores` : "Loading..."}
            </span>
          </div>

          {!organizations ? (
            <div className="empty-state">Loading registry...</div>
          ) : organizations.length === 0 ? (
            <div className="empty-state">
              No store organizations provisioned yet. Create one above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="registry-table">
                <thead>
                  <tr>
                    <th className="py-3.5 px-6">Organization</th>
                    <th className="py-3.5 px-6">Slug</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6">Convex Deployment</th>
                    <th className="py-3.5 px-6">Created At</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {organizations.map((org: any) => (
                    <tr key={org._id}>
                      <td className="py-4 px-6 font-medium text-white">
                        {org.name}
                      </td>
                      <td className="py-4 px-6 text-slate-400 font-mono text-xs">
                        {org.slug}
                      </td>
                      <td className="py-4 px-6">
                        {org.status === "active" && (
                          <span className="status-badge status-active">
                            ACTIVE
                          </span>
                        )}
                        {org.status === "provisioning" && (
                          <span className="status-badge status-provisioning">
                            PROVISIONING
                          </span>
                        )}
                        {org.status === "deploying" && (
                          <span className="status-badge bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 text-[11px] font-semibold rounded">
                            DEPLOYING
                          </span>
                        )}
                        {org.status === "failed" && (
                          <span className="status-badge status-failed" title={org.errorMessage}>
                            FAILED
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-slate-400 font-mono text-xs">
                        {org.deploymentId || org.deploymentUrl || "—"}
                      </td>
                      <td className="py-4 px-6 text-slate-400 text-xs">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {org.status === "active" && org.deploymentUrl ? (
                          <a
                            href={getStoreAppUrl(org.deploymentUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="store-link"
                          >
                            Open Store POS →
                          </a>
                        ) : org.status === "failed" ? (
                          <button
                            onClick={() => handleRetry(org._id)}
                            disabled={retryingOrgId === org._id}
                            className="text-xs px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                          >
                            {retryingOrgId === org._id ? "Retrying..." : "Retry Provisioning"}
                          </button>
                        ) : (
                          <span className="text-slate-500 text-xs animate-pulse">In Progress...</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function MasterDashboard() {
  const hasClerkPublishableKey = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim(),
  );

  if (!hasClerkPublishableKey) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans p-4">
        <div className="max-w-md rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
          <h1 className="text-xl font-semibold text-white">Authentication is not configured</h1>
          <p className="mt-3 text-sm text-slate-400">
            Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to the deployment environment and redeploy.
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <ClerkLoading>
        <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans p-4">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-400 tracking-wide">
              Verifying Authentication...
            </p>
          </div>
        </main>
      </ClerkLoading>

      <ClerkLoaded>
        <SignedIn>
          <DashboardContent />
        </SignedIn>

        <SignedOut>
          <RedirectToSignIn />
        </SignedOut>
      </ClerkLoaded>
    </>
  );
}
