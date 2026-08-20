"use client";

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";

export default function MasterDashboard() {
  const organizations = useQuery(api.organizations.list, {});
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="border-b border-slate-800 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                POS Master App
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Control Plane & Isolated Store Project Provisioning Registry
              </p>
            </div>
            <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-xs font-semibold">
              Phase 1: Organization Domain
            </div>
          </div>
        </header>

        {/* Provision Form */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4">
            Provision New Store Organization
          </h2>
          <form onSubmit={handleCreateOrg} className="flex gap-4">
            <input
              type="text"
              placeholder="e.g. Restaurant ABC"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2"
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
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">
              {error}
            </div>
          )}
        </section>

        {/* Organizations Registry Table */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">
              Provisioned Store Organizations & Convex Projects
            </h2>
            <span className="text-xs text-slate-400">
              {organizations ? `${organizations.length} stores` : "Loading..."}
            </span>
          </div>

          {!organizations ? (
            <div className="p-12 text-center text-slate-500">Loading registry...</div>
          ) : organizations.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              No store organizations provisioned yet. Create one above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[11px] tracking-wider font-semibold">
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
                    <tr key={org._id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-4 px-6 font-medium text-white">
                        {org.name}
                      </td>
                      <td className="py-4 px-6 text-slate-400 font-mono text-xs">
                        {org.slug}
                      </td>
                      <td className="py-4 px-6">
                        {org.status === "active" && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ACTIVE
                          </span>
                        )}
                        {org.status === "provisioning" && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            PROVISIONING
                          </span>
                        )}
                        {org.status === "failed" && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20" title={org.errorMessage}>
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
                            className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-medium text-xs bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-3 py-1.5 rounded-md transition-colors"
                          >
                            Open Store POS →
                          </a>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
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
