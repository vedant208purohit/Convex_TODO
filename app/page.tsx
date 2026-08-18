"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export default function StorePOSPage() {
  const organizations = useQuery(api.organizations.list);
  const updateOrg = useMutation(api.organizations.update);

  const primaryOrg = organizations && organizations.length > 0 ? organizations[0] : null;

  const toggleFeature = async (featureKey: string, currentValue: boolean) => {
    if (!primaryOrg) return;
    await updateOrg({
      id: primaryOrg._id,
      [featureKey]: !currentValue,
    });
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="border-b border-slate-800 pb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              {primaryOrg ? primaryOrg.name : "Store POS Application"}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Isolated Store Database Deployment
            </p>
          </div>
          {primaryOrg && (
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold">
                STORE ACTIVE
              </span>
              <div className="text-[11px] text-slate-500 font-mono mt-1">
                Legacy ID: {primaryOrg.legacyId}
              </div>
            </div>
          )}
        </header>

        {!organizations ? (
          <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
            Connecting to Store Convex Project...
          </div>
        ) : !primaryOrg ? (
          <div className="p-12 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
            <p className="text-lg font-medium text-white">No Organization Record Found in Store DB</p>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              This store Convex deployment is initialized and ready. Run the migration script to import the PostgreSQL Organization record into this project.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Core Identity Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
              <h2 className="text-base font-semibold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Core Store Identity
              </h2>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-slate-400 text-xs block">Legal Entity Name</span>
                  <span className="font-medium text-white">{primaryOrg.legalEntityName || primaryOrg.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">Slug</span>
                  <span className="font-mono text-slate-300">{primaryOrg.slug}</span>
                </div>
                <div className="flex justify-between py-1 border-t border-slate-800/60">
                  <span className="text-slate-400">Published:</span>
                  <span className={primaryOrg.published ? "text-emerald-400" : "text-slate-500"}>
                    {primaryOrg.published ? "Yes" : "No"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Pure Veg:</span>
                  <span className={primaryOrg.isVeg ? "text-emerald-400" : "text-amber-400"}>
                    {primaryOrg.isVeg ? "Yes (Veg)" : "Non-Veg / Mixed"}
                  </span>
                </div>
              </div>
            </div>

            {/* Feature Modules Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4 md:col-span-2">
              <h2 className="text-base font-semibold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                POS Feature Flags & Service Types
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { key: "isDineIn", label: "Dine-In" },
                  { key: "isTakeAway", label: "Take-Away" },
                  { key: "isDelivery", label: "Delivery" },
                  { key: "isCashier", label: "Cashier" },
                  { key: "isOrders", label: "Orders" },
                  { key: "isKds", label: "Kitchen Display (KDS)" },
                  { key: "isInventory", label: "Inventory" },
                  { key: "isWorkstation", label: "Workstation" },
                  { key: "isQueue", label: "Queue Mgmt" },
                  { key: "onlineStore", label: "Online Store" },
                  { key: "isCaptain", label: "Captain App" },
                  { key: "isReport", label: "Reports" },
                ].map(({ key, label }) => {
                  const val = (primaryOrg as any)[key] as boolean;
                  return (
                    <button
                      key={key}
                      onClick={() => toggleFeature(key, val)}
                      className={`p-3 rounded-lg border text-left transition-all flex justify-between items-center ${
                        val
                          ? "bg-indigo-600/10 border-indigo-500/30 text-indigo-300"
                          : "bg-slate-950/60 border-slate-800 text-slate-500 hover:border-slate-700"
                      }`}
                    >
                      <span className="text-xs font-medium">{label}</span>
                      <span className={`w-2.5 h-2.5 rounded-full ${val ? "bg-indigo-400" : "bg-slate-700"}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payment Configuration */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4 md:col-span-3">
              <h2 className="text-base font-semibold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Payment & Fulfillment Modes
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                  <div className="text-slate-400">Dine-In Payment</div>
                  <div className="font-semibold text-white">
                    {primaryOrg.dineinPrepaid ? "Prepaid" : primaryOrg.dineinPospaid ? "Postpaid" : "Not Set"}
                  </div>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                  <div className="text-slate-400">Take-Away Modes</div>
                  <div className="font-semibold text-white">
                    {[
                      primaryOrg.takeAwayCashPayment && "Cash",
                      primaryOrg.takeAwayOnlinePayment && "Online",
                    ].filter(Boolean).join(" + ") || "None"}
                  </div>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                  <div className="text-slate-400">Delivery Modes</div>
                  <div className="font-semibold text-white">
                    {[
                      primaryOrg.deliveryCashOnDelivery && "COD",
                      primaryOrg.deliveryOnlinePayment && "Online",
                    ].filter(Boolean).join(" + ") || "None"}
                  </div>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                  <div className="text-slate-400">Scheduled Fulfillment</div>
                  <div className="font-semibold text-white">
                    {primaryOrg.scheduledPickup || primaryOrg.scheduledDelivery ? "Enabled" : "Disabled"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
