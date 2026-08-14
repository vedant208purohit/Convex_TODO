"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function MasterDashboard() {
  const companies = useQuery(api.companies.list);
  const [companyName, setCompanyName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const defaultAppBaseUrl =
    process.env.NEXT_PUBLIC_DEFAULT_APP_URL || "http://localhost:3000";

  // Function to run reconciliation sync
  async function triggerSync(showSuccessBanner = false) {
    try {
      setIsSyncing(true);
      const res = await fetch("/api/companies/reconcile", { method: "POST" });
      const data = await res.json();
      if (data.cleanedCount > 0) {
        setSuccessMsg(`Reconciliation active: Cleaned up ${data.cleanedCount} orphaned Convex project(s).`);
      } else if (showSuccessBanner) {
        setSuccessMsg("Reconciliation complete: All Convex projects are in sync.");
      }
    } catch (err: any) {
      console.error("[Reconciliation Error]", err);
    } finally {
      setIsSyncing(false);
    }
  }

  // Run reconciliation automatically on page load AND poll every 5 seconds
  useEffect(() => {
    triggerSync(false);

    const interval = setInterval(() => {
      triggerSync(false);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  async function handleCreateCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/companies/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: companyName.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to provision company.");
      }

      setSuccessMsg(`Successfully provisioned company "${data.company.name}"!`);
      setCompanyName("");
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function getStatusBadgeStyle(status: string) {
    switch (status) {
      case "active":
        return { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" };
      case "provisioning":
        return { backgroundColor: "#fef9c3", color: "#854d0e", border: "1px solid #fef08a" };
      case "failed":
        return { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" };
      default:
        return { backgroundColor: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" };
    }
  }

  return (
    <main
      style={{
        maxWidth: "1000px",
        margin: "40px auto",
        padding: "32px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <header style={{ marginBottom: "32px", borderBottom: "1px solid #e2e8f0", paddingBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "2rem", fontWeight: "700", color: "#0f172a" }}>
              Convex Master Control Plane
            </h1>
            <p style={{ color: "#64748b", marginTop: "4px" }}>
              Multi-Project SaaS Provisioning & Management System
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              onClick={() => triggerSync(true)}
              disabled={isSyncing}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#334155",
                fontSize: "0.85rem",
                fontWeight: "500",
                cursor: isSyncing ? "not-allowed" : "pointer",
              }}
            >
              {isSyncing ? "Syncing..." : "🔄 Sync / Clean Up Projects"}
            </button>
            <div style={{ fontSize: "0.875rem", backgroundColor: "#eff6ff", color: "#1d4ed8", padding: "6px 12px", borderRadius: "20px", fontWeight: "500" }}>
              Separate Convex Database Architecture
            </div>
          </div>
        </div>
      </header>

      {/* Global Notifications */}
      {errorMsg && (
        <div
          style={{
            padding: "14px 18px",
            backgroundColor: "#fef2f2",
            color: "#991b1b",
            borderRadius: "8px",
            marginBottom: "24px",
            fontSize: "0.95rem",
            border: "1px solid #fecaca",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span><strong>Action Failed:</strong> {errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            style={{ background: "none", border: "none", color: "#991b1b", cursor: "pointer", fontWeight: "bold" }}
          >
            ✕
          </button>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            padding: "14px 18px",
            backgroundColor: "#f0fdf4",
            color: "#166534",
            borderRadius: "8px",
            marginBottom: "24px",
            fontSize: "0.95rem",
            border: "1px solid #bbf7d0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{successMsg}</span>
          <button
            onClick={() => setSuccessMsg(null)}
            style={{ background: "none", border: "none", color: "#166534", cursor: "pointer", fontWeight: "bold" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Provision New Company Section */}
      <section
        style={{
          backgroundColor: "#ffffff",
          padding: "24px",
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          marginBottom: "32px",
          border: "1px solid #e2e8f0",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "16px" }}>
          Provision New Company
        </h2>

        <form onSubmit={handleCreateCompany} style={{ display: "flex", gap: "12px" }}>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Company name"
            disabled={isSubmitting}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              fontSize: "1rem",
            }}
          />
          <button
            type="submit"
            disabled={isSubmitting || !companyName.trim()}
            style={{
              padding: "12px 24px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: isSubmitting ? "#94a3b8" : "#2563eb",
              color: "white",
              fontSize: "1rem",
              fontWeight: "600",
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting ? "Provisioning..." : "Provision Company"}
          </button>
        </form>
      </section>

      {/* Provisioned Companies & Databases */}
      <section
        style={{
          backgroundColor: "#ffffff",
          padding: "24px",
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          border: "1px solid #e2e8f0",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "16px" }}>
          Provisioned Companies & Databases
        </h2>

        {companies === undefined ? (
          <p style={{ color: "#64748b" }}>Loading company register...</p>
        ) : companies.length === 0 ? (
          <p style={{ color: "#64748b" }}>No companies provisioned yet. Use the form above to create Company 1.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                fontSize: "0.95rem",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0", color: "#475569" }}>
                  <th style={{ padding: "12px 8px" }}>Company</th>
                  <th style={{ padding: "12px 8px" }}>Status</th>
                  <th style={{ padding: "12px 8px" }}>Convex Deployment</th>
                  <th style={{ padding: "12px 8px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => {
                  const targetUrl = company.deploymentUrl
                    ? `${defaultAppBaseUrl}?convexUrl=${encodeURIComponent(company.deploymentUrl)}`
                    : null;

                  return (
                    <tr
                      key={company._id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      <td style={{ padding: "14px 8px", fontWeight: "600", color: "#0f172a" }}>
                        {company.name}
                      </td>
                      <td style={{ padding: "14px 8px" }}>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "12px",
                            fontSize: "0.8rem",
                            fontWeight: "600",
                            textTransform: "uppercase",
                            ...getStatusBadgeStyle(company.status),
                          }}
                        >
                          {company.status}
                        </span>
                      </td>
                      <td style={{ padding: "14px 8px", color: "#64748b", fontFamily: "monospace", fontSize: "0.85rem" }}>
                        {company.deploymentId || "-"}
                      </td>
                      <td style={{ padding: "14px 8px" }}>
                        {company.status === "active" && targetUrl ? (
                          <a
                            href={targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-block",
                              padding: "6px 14px",
                              backgroundColor: "#0284c7",
                              color: "white",
                              borderRadius: "6px",
                              textDecoration: "none",
                              fontSize: "0.875rem",
                              fontWeight: "500",
                            }}
                          >
                            Open Application →
                          </a>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
                            -
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
