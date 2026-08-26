"use client";

import { useQuery } from "convex/react";
import { PosShell } from "../components/PosShell";
import { api } from "../../convex/_generated/api";

function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
}) {
  return (
    <div className="rounded-2xl border border-[#eadfd6] bg-white/60 p-4">
      <div className="text-xs uppercase tracking-wide text-[#8a7e75]">{label}</div>
      <div className="mt-2 break-words text-sm font-medium text-[#1f1a17]">
        {String(value ?? "—")}
      </div>
    </div>
  );
}

export default function OrganizationPage() {
  const organizations = useQuery(api.organizations.list);
  const organization = organizations?.[0] ?? null;
  const isLoading = organizations === undefined;

  return (
    <PosShell title="Organization" subtitle="Management Portal">
      <div className="space-y-6">
        <div className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6">
          <h1 className="text-[20px] font-medium">Organization Details</h1>
          <p className="mt-2 text-[15px] text-[#6f655e]">
            Existing project data is displayed here.
          </p>
        </div>

        {isLoading ? (
          <div className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-10 text-center text-[#6f655e]">
            Loading organization data...
          </div>
        ) : !organization ? (
          <div className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-10 text-center text-[#6f655e]">
            No organization data available.
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-3">
            <section className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6 xl:col-span-1">
              <h2 className="text-lg font-medium">Core Info</h2>
              <div className="mt-5 space-y-4">
                <Field label="Name" value={organization.name} />
                <Field label="Slug" value={organization.slug} />
                <Field label="Legal Entity" value={organization.legalEntityName || organization.name} />
                <Field label="Published" value={organization.published ? "Yes" : "No"} />
                <Field label="Veg" value={organization.isVeg ? "Yes" : "No"} />
              </div>
            </section>

            <section className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6 xl:col-span-2">
              <h2 className="text-lg font-medium">Operational Flags</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Dine In" value={organization.isDineIn} />
                <Field label="Take Away" value={organization.isTakeAway} />
                <Field label="Delivery" value={organization.isDelivery} />
                <Field label="Dashboard" value={organization.isDashboard} />
                <Field label="Cashier" value={organization.isCashier} />
                <Field label="Orders" value={organization.isOrders} />
                <Field label="KDS" value={organization.isKds} />
                <Field label="Inventory" value={organization.isInventory} />
              </div>
            </section>

            <section className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6 xl:col-span-3">
              <h2 className="text-lg font-medium">Raw Record</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-4">
                <Field label="Organization ID" value={organization._id} />
                <Field label="Created" value={organization.createdAt} />
                <Field label="Updated" value={organization.updatedAt} />
                <Field label="Published" value={organization.published ? "Yes" : "No"} />
              </div>
            </section>
          </div>
        )}
      </div>
    </PosShell>
  );
}
