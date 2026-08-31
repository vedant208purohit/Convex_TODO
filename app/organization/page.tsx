"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { PosShell } from "../components/PosShell";
import { api } from "../../convex/_generated/api";

const VALID_USER_TYPES = [
  "admin",
  "cashier",
  "captain",
  "waiter",
  "chef",
  "worker",
  "customer",
  "customer_data",
  "bot",
  "dashboard",
  "orders",
  "menu",
  "kds",
  "queue",
  "inventory",
  "report",
  "survey",
] as const;

const DEFAULT_FEATURE_KEYS = [
  "skip_phone_number_required",
  "show_waiter_on_cashier_card",
  "skip_payment_on_cashier_card",
  "show_table_on_cashier_card",
  "show_member_number_on_cashier_card",
  "show_table_tab_in_cashier",
  "auto_accept",
] as const;

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
  const currentMembership = useQuery(
    api.organizationUsers.getCurrentMembership,
    organization?._id ? { organizationId: organization._id } : "skip"
  );
  const members = useQuery(
    api.organizationUsers.list,
    currentMembership?.organizationId ? { organizationId: currentMembership.organizationId } : "skip"
  );
  const createMember = useMutation(api.organizationUsers.create);
  const updateMember = useMutation(api.organizationUsers.update);
  const addMemberTypes = useMutation(api.organizationUsers.addType);
  const removeMemberTypes = useMutation(api.organizationUsers.removeType);
  const removeMember = useMutation(api.organizationUsers.remove);
  const toggleFeature = useMutation(api.organizationFeatures.toggle);
  const initializeFeatureDefaults = useMutation(api.organizationFeatures.initializeDefaults);
  const softDeleteFeature = useMutation(api.organizationFeatures.softDelete);
  const repairStoreOwnerAdmin = useMutation(api.organizations.repairStoreOwnerAdmin);

  const [roleFilter, setRoleFilter] = useState("");
  const [selectedMemberUserId, setSelectedMemberUserId] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [addRoles, setAddRoles] = useState<string[]>([]);
  const [removeRoles, setRemoveRoles] = useState<string[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [isAddingRoles, setIsAddingRoles] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeSuccess, setRemoveSuccess] = useState<string | null>(null);
  const [isRemovingRoles, setIsRemovingRoles] = useState(false);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [createUserId, setCreateUserId] = useState("");
  const [createRoles, setCreateRoles] = useState<string[]>(["cashier"]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [featureKey, setFeatureKey] = useState<string>(DEFAULT_FEATURE_KEYS[0]);
  const [customFeatureKey, setCustomFeatureKey] = useState("");
  const featureKeyToFetch = customFeatureKey.trim() || featureKey;
  const [featureLoadError, setFeatureLoadError] = useState<string | null>(null);
  const [featureActionError, setFeatureActionError] = useState<string | null>(null);
  const [featureActionSuccess, setFeatureActionSuccess] = useState<string | null>(null);
  const [isTogglingFeatureKey, setIsTogglingFeatureKey] = useState<string | null>(null);
  const [isDeletingFeatureKey, setIsDeletingFeatureKey] = useState<string | null>(null);
  const [isInitializingFeatures, setIsInitializingFeatures] = useState(false);
  const feature = useQuery(
    api.organizationFeatures.get,
    featureKeyToFetch ? { featureKey: featureKeyToFetch } : "skip"
  );
  const featureFlags = useQuery(api.organizationFeatures.list, {});
  const filteredMembers = useQuery(
    api.organizationUsers.search,
    currentMembership?.organizationId && roleFilter.trim()
      ? {
          organizationId: currentMembership.organizationId,
          userType: roleFilter.trim().toLowerCase(),
        }
      : "skip"
  );
  const selectedMember = useQuery(
    api.organizationUsers.getByUserId,
    selectedMemberUserId && currentMembership?.organizationId
      ? {
          userId: selectedMemberUserId,
          organizationId: currentMembership.organizationId,
        }
      : "skip"
  );

  const isMembershipLoading = currentMembership === undefined;
  const currentRoles = Array.isArray(currentMembership?.userType)
    ? currentMembership.userType
    : typeof currentMembership?.userType === "string"
      ? [currentMembership.userType]
      : [];

  const isAdmin = Boolean(
    currentMembership &&
      currentRoles.some((role: string) =>
        ["admin", "store_admin", "org_admin", "super_admin"].includes(
          String(role).trim().toLowerCase()
        )
      )
  );

  const [hasAttemptedRepair, setHasAttemptedRepair] = useState(false);

  useEffect(() => {
    // Auto-repair pre-existing store owner admin membership ONCE if loaded and membership is null
    if (organization?._id && currentMembership === null && !hasAttemptedRepair) {
      setHasAttemptedRepair(true);
      repairStoreOwnerAdmin({ organizationId: organization._id }).catch(() => {});
    }
  }, [organization, currentMembership, hasAttemptedRepair, repairStoreOwnerAdmin]);

  useEffect(() => {
    console.log("AUTH DEBUG", {
      currentMembership,
      currentMembershipUserType: currentMembership?.userType,
      isMembershipLoading,
      isAdmin,
      organizations,
      currentOrganizationId: organization?._id,
    });
  }, [currentMembership, isMembershipLoading, isAdmin, organizations, organization]);

  const canCreate = Boolean(isAdmin && currentMembership?.organizationId);
  const canRemoveSelectedMember =
    Boolean(isAdmin && selectedMember && currentMembership?.userId !== selectedMember.userId);

  const toggleCreateRole = (role: string) => {
    setCreateRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role]
    );
  };

  useEffect(() => {
    if (selectedMember) {
      setEditRoles(selectedMember.userType);
      setAddRoles([]);
      setRemoveRoles([]);
      setAddError(null);
      setAddSuccess(null);
      setRemoveError(null);
      setRemoveSuccess(null);
      setUpdateError(null);
      setUpdateSuccess(null);
    }
  }, [selectedMember]);

  const toggleEditRole = (role: string) => {
    setEditRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role]
    );
  };

  const availableAddRoles = selectedMember
    ? VALID_USER_TYPES.filter((role) => !selectedMember.userType.includes(role))
    : [];

  const availableRemoveRoles = selectedMember ? selectedMember.userType : [];

  const toggleAddRole = (role: string) => {
    setAddRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role]
    );
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedMember || !currentMembership?.organizationId || !isAdmin) return;

    const roles = editRoles.filter((role) => VALID_USER_TYPES.includes(role as (typeof VALID_USER_TYPES)[number]));
    if (roles.length === 0) {
      setUpdateError("Select at least one valid role");
      return;
    }

    setUpdateError(null);
    setUpdateSuccess(null);
    setIsUpdating(true);
    try {
      await updateMember({
        id: selectedMember._id,
        userType: roles,
      });
      setUpdateSuccess(`Updated staff member ${selectedMember.userId}.`);
      setSelectedMemberUserId(selectedMember.userId);
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Failed to update staff member");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddRoles = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedMember || !currentMembership?.organizationId || !isAdmin) return;

    const types = addRoles.filter((role) => VALID_USER_TYPES.includes(role as (typeof VALID_USER_TYPES)[number]));
    if (types.length === 0) {
      setAddError("Select at least one valid role");
      return;
    }

    setAddError(null);
    setAddSuccess(null);
    setIsAddingRoles(true);
    try {
      await addMemberTypes({
        id: selectedMember._id,
        types,
      });
      setAddSuccess(`Added role${types.length > 1 ? "s" : ""} to ${selectedMember.userId}.`);
      setAddRoles([]);
      setSelectedMemberUserId(selectedMember.userId);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add roles");
    } finally {
      setIsAddingRoles(false);
    }
  };

  const toggleRemoveRole = (role: string) => {
    setRemoveRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role]
    );
  };

  const handleRemoveRoles = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedMember || !currentMembership?.organizationId || !isAdmin) return;

    const types = removeRoles.filter((role) => selectedMember.userType.includes(role));
    if (types.length === 0) {
      setRemoveError("Select at least one assigned role to remove");
      return;
    }

    setRemoveError(null);
    setRemoveSuccess(null);
    setIsRemovingRoles(true);
    try {
      await removeMemberTypes({
        id: selectedMember._id,
        types,
      });
      setRemoveSuccess(`Removed role${types.length > 1 ? "s" : ""} from ${selectedMember.userId}.`);
      setRemoveRoles([]);
      setSelectedMemberUserId(selectedMember.userId);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Failed to remove roles");
    } finally {
      setIsRemovingRoles(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember || !currentMembership?.organizationId || !isAdmin) return;

    const confirmed = window.confirm(
      `Remove staff member ${selectedMember.userId}? This will soft-delete the membership.`
    );
    if (!confirmed) return;

    setRemoveError(null);
    setRemoveSuccess(null);
    setIsRemovingMember(true);
    try {
      await removeMember({ id: selectedMember._id });
      setRemoveSuccess(`Removed staff member ${selectedMember.userId}.`);
      setSelectedMemberUserId(null);
      setEditRoles([]);
      setAddRoles([]);
      setRemoveRoles([]);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Failed to remove staff member");
    } finally {
      setIsRemovingMember(false);
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate || !currentMembership?.organizationId) return;

    const userId = createUserId.trim();
    const roles = createRoles.filter((role) => VALID_USER_TYPES.includes(role as (typeof VALID_USER_TYPES)[number]));
    if (!userId) {
      setCreateError("User ID is required");
      return;
    }
    if (roles.length === 0) {
      setCreateError("Select at least one valid role");
      return;
    }

    setCreateError(null);
    setCreateSuccess(null);
    setIsCreating(true);
    try {
      await createMember({
        organizationId: currentMembership.organizationId,
        userId,
        userType: roles,
      });
      setCreateSuccess(`Created staff member ${userId}.`);
      setCreateUserId("");
      setCreateRoles(["cashier"]);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create staff member");
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    setFeatureLoadError(null);
  }, [featureKeyToFetch]);

  const handleToggleFeature = async (featureKey: string, nextActive: boolean) => {
    setFeatureActionError(null);
    setFeatureActionSuccess(null);

    if (!isAdmin) {
      setFeatureActionError("Only organization administrators can manage features.");
      return;
    }

    setIsTogglingFeatureKey(featureKey);
    try {
      await toggleFeature({
        organizationId: currentMembership?.organizationId,
        featureKey,
        active: nextActive,
      });
      setFeatureActionSuccess(
        `${featureKey} is now ${nextActive ? "Enabled" : "Disabled"}.`
      );
    } catch (err) {
      setFeatureActionError(
        err instanceof Error ? err.message : "Failed to toggle feature flag"
      );
    } finally {
      setIsTogglingFeatureKey(null);
    }
  };

  const handleInitializeDefaultFeatures = async () => {
    setFeatureActionError(null);
    setFeatureActionSuccess(null);

    if (!isAdmin) {
      setFeatureActionError("Only organization administrators can manage features.");
      return;
    }

    const confirmed = window.confirm(
      "Initialize default feature flags for this store? Existing feature flags will be preserved."
    );
    if (!confirmed) return;

    setIsInitializingFeatures(true);
    try {
      await initializeFeatureDefaults({
        organizationId: currentMembership?.organizationId,
      });
      setFeatureActionSuccess("Default feature flags initialized.");
    } catch (err) {
      setFeatureActionError(
        err instanceof Error ? err.message : "Failed to initialize default feature flags"
      );
    } finally {
      setIsInitializingFeatures(false);
    }
  };

  const handleDeleteFeature = async (featureKey: string) => {
    setFeatureActionError(null);
    setFeatureActionSuccess(null);

    if (!isAdmin) {
      setFeatureActionError("Only organization administrators can manage features.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to remove this feature flag?"
    );
    if (!confirmed) return;

    setIsDeletingFeatureKey(featureKey);
    try {
      await softDeleteFeature({
        organizationId: currentMembership?.organizationId,
        featureKey,
      });
      if (featureKeyToFetch === featureKey) {
        setCustomFeatureKey("");
        setFeatureKey(DEFAULT_FEATURE_KEYS[0]);
      }
      setFeatureActionSuccess(`${featureKey} was removed.`);
    } catch (err) {
      setFeatureActionError(err instanceof Error ? err.message : "Failed to delete feature");
    } finally {
      setIsDeletingFeatureKey(null);
    }
  };

  return (
    <PosShell title="Organization" subtitle="Management Portal">
      <div className="space-y-6">
        <div className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6">
          <h1 className="text-[20px] font-medium">Organization Details</h1>
          <p className="mt-2 text-[15px] text-[#6f655e]">
            Existing project data is displayed here.
          </p>
        </div>

        {/* Status Diagnostics Banner */}
        <div className="rounded-2xl border border-[#eadfd6] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-[#eadfd6] pb-3">
            <div>
              <h2 className="text-sm font-semibold text-[#1f1a17]">Authorization & System Status</h2>
              <p className="text-xs text-[#6f655e]">Live store ownership and user role permissions</p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                isAdmin
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isAdmin ? "bg-emerald-500" : "bg-amber-500"}`} />
              {isAdmin ? "Admin Authorized" : isMembershipLoading ? "Loading..." : "Standard Access"}
            </span>
          </div>
          <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4 text-[#6f655e]">
            <div>
              <span className="font-medium text-[#1f1a17]">Store Loaded:</span> {organization ? "Yes" : "No"}
            </div>
            <div>
              <span className="font-medium text-[#1f1a17]">Membership Found:</span> {currentMembership ? "Yes" : "No"}
            </div>
            <div>
              <span className="font-medium text-[#1f1a17]">Assigned Roles:</span>{" "}
              {currentRoles.length > 0 ? currentRoles.join(", ") : "None"}
            </div>
            <div>
              <span className="font-medium text-[#1f1a17]">Feature Action Controls:</span>{" "}
              <span className={isAdmin ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                {isAdmin ? "Enabled" : "Restricted"}
              </span>
            </div>
          </div>
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
              <h2 className="text-lg font-medium">Current Membership</h2>
              <p className="mt-1 text-sm text-[#6f655e]">
                Membership details for the signed-in user in this organization.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-4">
                <Field label="Membership ID" value={currentMembership?._id ?? "-"} />
                <Field label="Organization ID" value={currentMembership?.organizationId ?? "-"} />
                <Field label="User ID" value={currentMembership?.userId ?? "-"} />
                <Field label="Roles" value={currentMembership?.userType.join(", ") || "-"} />
              </div>
            </section>

            <section className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6 xl:col-span-3">
              <h2 className="text-lg font-medium">Feature Flag Details</h2>
              <p className="mt-1 text-sm text-[#6f655e]">
                Read-only lookup for a single store feature flag.
              </p>

              <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1">
                  <label className="text-xs uppercase tracking-wide text-[#8a7e75]">
                    Select default feature
                  </label>
                  <select
                    value={featureKey}
                    onChange={(e) => {
                      setFeatureKey(e.target.value);
                      setCustomFeatureKey("");
                    }}
                    className="mt-1.5 w-full rounded-xl border border-[#eadfd6] bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-[#1f1a17]"
                  >
                    {DEFAULT_FEATURE_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs uppercase tracking-wide text-[#8a7e75]">
                    Or enter feature key
                  </label>
                  <input
                    value={customFeatureKey}
                    onChange={(e) => setCustomFeatureKey(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#eadfd6] bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-[#1f1a17]"
                    placeholder="custom_feature_key"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setCustomFeatureKey("")}
                  className="h-10 rounded-xl border border-[#eadfd6] bg-white px-5 text-sm font-medium text-[#1f1a17] hover:bg-[#f5efe9] transition-all"
                >
                  Use default
                </button>
              </div>

              {featureLoadError ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {featureLoadError}
                </div>
              ) : null}

              {feature === undefined ? (
                <div className="mt-4 rounded-2xl border border-[#eadfd6] bg-white px-4 py-3 text-sm text-[#6f655e]">
                  Loading feature flag...
                </div>
              ) : !feature ? (
                <div className="mt-4 rounded-2xl border border-[#eadfd6] bg-white px-4 py-3 text-sm text-[#6f655e]">
                  Feature flag "{featureKeyToFetch}" is not present in database.
                </div>
              ) : (
                <div className="mt-4 grid gap-4 rounded-2xl border border-[#eadfd6] bg-white p-4 sm:grid-cols-2 md:grid-cols-4">
                  <Field label="ID" value={feature._id} />
                  <Field label="Feature Key" value={feature.featureKey} />
                  <Field label="Status" value={feature.active ? "Enabled" : "Disabled"} />
                  <Field label="Created At" value={feature.createdAt ?? "-"} />
                </div>
              )}

              <div className="mt-6 border-t border-[#eadfd6] pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-[#1f1a17]">Feature Management</h3>
                    <p className="mt-1 text-xs text-[#6f655e]">
                      Enable, disable, delete, or initialize default organization features.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#f5efe9] px-3 py-1 text-xs text-[#6f655e]">
                    Active only
                  </span>
                </div>

                {featureActionSuccess ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {featureActionSuccess}
                  </div>
                ) : null}
                {featureActionError ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {featureActionError}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleInitializeDefaultFeatures}
                    disabled={isInitializingFeatures || isMembershipLoading || !isAdmin}
                    title={
                      isMembershipLoading
                        ? "Loading authorization state..."
                        : !isAdmin
                          ? "Only organization administrators can manage features."
                          : undefined
                    }
                    className="h-10 rounded-xl bg-[#1f1a17] px-5 text-sm font-medium text-white hover:bg-black transition-all disabled:opacity-50"
                  >
                    {isInitializingFeatures ? "Initializing..." : "Initialize Default Features"}
                  </button>
                </div>

                {featureFlags === undefined ? (
                  <div className="mt-4 rounded-2xl border border-[#eadfd6] bg-white px-4 py-3 text-sm text-[#6f655e]">
                    Loading active feature flags...
                  </div>
                ) : featureFlags.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-[#eadfd6] bg-white px-4 py-3 text-sm text-[#6f655e]">
                    No active feature flags found.
                  </div>
                ) : (
                  <div className="mt-4 overflow-x-auto rounded-2xl border border-[#eadfd6]">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#f5efe9] text-[#6f655e]">
                        <tr>
                          <th className="px-4 py-3">Feature Key</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Created At</th>
                          <th className="px-4 py-3">Updated At</th>
                          <th className="px-4 py-3">Action</th>
                          <th className="px-4 py-3">Delete</th>
                        </tr>
                      </thead>
                      <tbody>
                        {featureFlags.map((flag) => (
                          <tr key={flag._id} className="border-t border-[#eadfd6]">
                            <td className="px-4 py-3 font-medium">{flag.featureKey}</td>
                            <td className="px-4 py-3 text-[#6f655e]">
                              {flag.active ? "Enabled" : "Disabled"}
                            </td>
                            <td className="px-4 py-3 text-[#6f655e]">{flag.createdAt ?? "-"}</td>
                            <td className="px-4 py-3 text-[#6f655e]">{flag.updatedAt ?? "-"}</td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => handleToggleFeature(flag.featureKey, !flag.active)}
                                disabled={isTogglingFeatureKey === flag.featureKey || isMembershipLoading || !isAdmin}
                                title={
                                  isMembershipLoading
                                    ? "Loading authorization state..."
                                    : !isAdmin
                                      ? "Only organization administrators can manage features."
                                      : undefined
                                }
                                className="h-8 rounded-lg border border-[#eadfd6] bg-white px-3 text-xs font-medium text-[#1f1a17] hover:bg-[#f5efe9] transition-all disabled:opacity-50"
                              >
                                {isTogglingFeatureKey === flag.featureKey
                                  ? "Updating..."
                                  : flag.active
                                    ? "Disable"
                                    : "Enable"}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => handleDeleteFeature(flag.featureKey)}
                                disabled={isDeletingFeatureKey === flag.featureKey || isMembershipLoading || !isAdmin}
                                title={
                                  isMembershipLoading
                                    ? "Loading authorization state..."
                                    : !isAdmin
                                      ? "Only organization administrators can manage features."
                                      : undefined
                                }
                                className="h-8 rounded-lg border border-red-200 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50 transition-all disabled:opacity-50"
                              >
                                {isDeletingFeatureKey === flag.featureKey ? "Deleting..." : "Delete"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6 xl:col-span-3">
              <h2 className="text-lg font-medium">Active Staff</h2>
              <p className="mt-1 text-sm text-[#6f655e]">
                Active organization members excluding customer-only and bot records by default.
              </p>

              {/* Staff Onboarding Card */}
              <div className="mt-5 rounded-2xl border border-[#eadfd6] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b border-[#eadfd6] pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1f1a17]">Staff Onboarding</h3>
                    <p className="mt-0.5 text-xs text-[#6f655e]">
                      Create a new organization membership for a Clerk user.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#f5efe9] px-3 py-1 text-xs font-medium text-[#6f655e]">
                    Store Admin only
                  </span>
                </div>

                {createSuccess ? (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
                    {createSuccess}
                  </div>
                ) : null}
                {createError ? (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                    {createError}
                  </div>
                ) : null}

                {canCreate ? (
                  <form onSubmit={handleCreate} className="mt-4 space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <input
                        value={createUserId}
                        onChange={(e) => setCreateUserId(e.target.value)}
                        className="h-10 flex-1 rounded-xl border border-[#eadfd6] bg-white px-4 text-sm outline-none transition-all focus:border-[#1f1a17] focus:ring-1 focus:ring-[#1f1a17]"
                        placeholder="Enter Clerk User ID (e.g. user_2P...)"
                      />
                      <button
                        type="submit"
                        disabled={isCreating}
                        className="h-10 rounded-xl bg-[#1f1a17] px-6 text-sm font-medium text-white shadow-sm hover:bg-black transition-all disabled:opacity-50"
                      >
                        {isCreating ? "Creating..." : "Create Member"}
                      </button>
                    </div>

                    <div className="rounded-xl border border-[#eadfd6] bg-[#fbf7f4] p-4">
                      <div className="text-xs font-medium uppercase tracking-wider text-[#8a7e75]">
                        Assign User Roles
                      </div>
                      <div className="mt-3 grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                        {VALID_USER_TYPES.map((role) => {
                          const isChecked = createRoles.includes(role);
                          return (
                            <label
                              key={role}
                              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer select-none transition-all ${
                                isChecked
                                  ? "border-[#1f1a17] bg-white text-[#1f1a17] shadow-sm"
                                  : "border-[#eadfd6] bg-white/60 text-[#6f655e] hover:bg-white"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleCreateRole(role)}
                                className="h-3.5 w-3.5 rounded border-[#eadfd6] text-[#1f1a17] focus:ring-0 accent-[#1f1a17]"
                              />
                              <span>{role}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-xs text-[#8a7e75]">
                      Select one or more valid roles for this user. Default roles include cashier, dashboard, and admin.
                    </div>
                  </form>
                ) : (
                  <div className="mt-4 rounded-xl border border-[#eadfd6] bg-[#fbf7f4] px-4 py-3 text-sm text-[#6f655e]">
                    You need admin access to create staff members.
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="text-xs uppercase tracking-wide text-[#8a7e75]">
                    Role filter
                  </label>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#eadfd6] bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-[#1f1a17]"
                  >
                    <option value="">All active staff</option>
                    <option value="admin">admin</option>
                    <option value="cashier">cashier</option>
                    <option value="captain">captain</option>
                    <option value="waiter">waiter</option>
                    <option value="chef">chef</option>
                    <option value="worker">worker</option>
                    <option value="dashboard">dashboard</option>
                    <option value="orders">orders</option>
                    <option value="menu">menu</option>
                    <option value="kds">kds</option>
                    <option value="queue">queue</option>
                    <option value="inventory">inventory</option>
                    <option value="report">report</option>
                    <option value="survey">survey</option>
                  </select>
                </div>
                {roleFilter ? (
                  <button
                    type="button"
                    onClick={() => setRoleFilter("")}
                    className="h-10 rounded-xl border border-[#eadfd6] bg-white px-4 text-sm font-medium text-[#1f1a17] hover:bg-[#f5efe9] transition-all"
                  >
                    Clear filter
                  </button>
                ) : null}
              </div>
              {!currentMembership ? (
                <div className="mt-5 rounded-2xl border border-[#eadfd6] bg-white/70 px-4 py-3 text-sm text-[#6f655e]">
                  You need an active membership to view staff members for this organization.
                </div>
              ) : roleFilter.trim() ? (
                filteredMembers === undefined ? (
                  <div className="mt-5 rounded-2xl border border-[#eadfd6] bg-white/70 px-4 py-3 text-sm text-[#6f655e]">
                    Loading filtered staff...
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-[#eadfd6] bg-white/70 px-4 py-3 text-sm text-[#6f655e]">
                    No staff members match the selected role.
                  </div>
                ) : (
                  <div className="mt-5 overflow-x-auto rounded-2xl border border-[#eadfd6]">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#f5efe9] text-[#6f655e]">
                        <tr>
                          <th className="px-4 py-3">User ID</th>
                          <th className="px-4 py-3">Roles</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMembers.map((member) => (
                          <tr
                            key={member._id}
                            className="border-t border-[#eadfd6] hover:bg-white/50"
                          >
                            <td className="px-4 py-3 font-medium">{member.userId}</td>
                            <td className="px-4 py-3 text-[#6f655e]">{member.userType.join(", ")}</td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => setSelectedMemberUserId(member.userId)}
                                className="rounded-full border border-[#eadfd6] px-3 py-1.5 text-xs text-[#1f1a17]"
                              >
                                View details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : !members ? (
                <div className="mt-5 rounded-2xl border border-[#eadfd6] bg-white/70 px-4 py-3 text-sm text-[#6f655e]">
                  Loading staff members...
                </div>
              ) : members.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-[#eadfd6] bg-white/70 px-4 py-3 text-sm text-[#6f655e]">
                  No active staff members found.
                </div>
              ) : (
                <div className="mt-5 overflow-x-auto rounded-2xl border border-[#eadfd6]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#f5efe9] text-[#6f655e]">
                      <tr>
                        <th className="px-4 py-3">User ID</th>
                        <th className="px-4 py-3">Roles</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member) => (
                        <tr
                          key={member._id}
                          className="border-t border-[#eadfd6] hover:bg-white/50"
                        >
                          <td className="px-4 py-3 font-medium">{member.userId}</td>
                          <td className="px-4 py-3 text-[#6f655e]">{member.userType.join(", ")}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setSelectedMemberUserId(member.userId)}
                              className="rounded-full border border-[#eadfd6] px-3 py-1.5 text-xs text-[#1f1a17]"
                            >
                              View details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6 xl:col-span-3">
              <h2 className="text-lg font-medium">Staff Member Details</h2>
              <p className="mt-1 text-sm text-[#6f655e]">
                Details for the selected active staff member.
              </p>
              {!selectedMemberUserId ? (
                <div className="mt-5 rounded-2xl border border-[#eadfd6] bg-white/70 px-4 py-3 text-sm text-[#6f655e]">
                  Select a staff member to view their record.
                </div>
              ) : selectedMember === undefined ? (
                <div className="mt-5 rounded-2xl border border-[#eadfd6] bg-white/70 px-4 py-3 text-sm text-[#6f655e]">
                  Loading member details...
                </div>
              ) : selectedMember === null ? (
                <div className="mt-5 rounded-2xl border border-[#eadfd6] bg-white/70 px-4 py-3 text-sm text-[#6f655e]">
                  Member not found or no longer active.
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  {addSuccess ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      {addSuccess}
                    </div>
                  ) : null}
                  {addError ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {addError}
                    </div>
                  ) : null}
                  {removeSuccess ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      {removeSuccess}
                    </div>
                  ) : null}
                  {removeError ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {removeError}
                    </div>
                  ) : null}
                  {updateSuccess ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      {updateSuccess}
                    </div>
                  ) : null}
                  {updateError ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {updateError}
                    </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-4">
                    <Field label="Member ID" value={selectedMember._id} />
                    <Field label="Organization ID" value={selectedMember.organizationId} />
                    <Field label="User ID" value={selectedMember.userId} />
                    <Field label="Roles" value={selectedMember.userType.join(", ")} />
                  </div>

                  <div className="rounded-2xl border border-[#eadfd6] bg-white/70 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-[#1f1a17]">Edit Staff Member</h3>
                        <p className="mt-1 text-sm text-[#6f655e]">
                          Update the member roles. Permission sync is handled by the backend.
                        </p>
                      </div>
                      {isAdmin ? (
                        <span className="rounded-full bg-[#f5efe9] px-3 py-1 text-xs text-[#6f655e]">
                          Store Admin only
                        </span>
                      ) : null}
                    </div>

                    {isAdmin ? (
                      <form onSubmit={handleUpdate} className="mt-4 space-y-4">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {VALID_USER_TYPES.map((role) => (
                            <label
                              key={role}
                              className="flex items-center gap-2 rounded-full border border-[#eadfd6] px-3 py-2 text-sm text-[#1f1a17]"
                            >
                              <input
                                type="checkbox"
                                checked={editRoles.includes(role)}
                                onChange={() => toggleEditRole(role)}
                                disabled={isUpdating}
                              />
                              <span>{role}</span>
                            </label>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="submit"
                            disabled={isUpdating}
                            className="rounded-full bg-[#1f1a17] px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {isUpdating ? "Saving..." : "Save Changes"}
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => setEditRoles(selectedMember.userType)}
                            className="rounded-full border border-[#eadfd6] px-5 py-3 text-sm text-[#1f1a17] disabled:opacity-50"
                          >
                            Reset
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-[#eadfd6] bg-white/70 px-4 py-3 text-sm text-[#6f655e]">
                        You need admin access to edit this staff member.
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-[#eadfd6] bg-white/70 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-[#1f1a17]">Add Role</h3>
                        <p className="mt-1 text-sm text-[#6f655e]">
                          Append one or more additional roles without replacing existing roles.
                        </p>
                      </div>
                    </div>

                    {isAdmin ? (
                      <form onSubmit={handleAddRoles} className="mt-4 space-y-4">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {availableAddRoles.length === 0 ? (
                            <div className="rounded-2xl border border-[#eadfd6] bg-white px-4 py-3 text-sm text-[#6f655e] sm:col-span-2 lg:col-span-3">
                              No additional roles available to add.
                            </div>
                          ) : (
                            availableAddRoles.map((role) => (
                              <label
                                key={role}
                                className="flex items-center gap-2 rounded-full border border-[#eadfd6] px-3 py-2 text-sm text-[#1f1a17]"
                              >
                                <input
                                  type="checkbox"
                                  checked={addRoles.includes(role)}
                                  onChange={() => toggleAddRole(role)}
                                  disabled={isAddingRoles}
                                />
                                <span>{role}</span>
                              </label>
                            ))
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="submit"
                            disabled={isAddingRoles || availableAddRoles.length === 0}
                            className="rounded-full bg-[#1f1a17] px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {isAddingRoles ? "Adding..." : "Add Role"}
                          </button>
                          <button
                            type="button"
                            disabled={isAddingRoles}
                            onClick={() => setAddRoles([])}
                            className="rounded-full border border-[#eadfd6] px-5 py-3 text-sm text-[#1f1a17] disabled:opacity-50"
                          >
                            Reset
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-[#eadfd6] bg-white/70 px-4 py-3 text-sm text-[#6f655e]">
                        You need admin access to add roles to this staff member.
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-[#eadfd6] bg-white/70 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-[#1f1a17]">Remove Role</h3>
                        <p className="mt-1 text-sm text-[#6f655e]">
                          Remove one or more currently assigned roles from this member.
                        </p>
                      </div>
                    </div>

                    {isAdmin ? (
                      <form onSubmit={handleRemoveRoles} className="mt-4 space-y-4">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {availableRemoveRoles.length === 0 ? (
                            <div className="rounded-2xl border border-[#eadfd6] bg-white px-4 py-3 text-sm text-[#6f655e] sm:col-span-2 lg:col-span-3">
                              No roles available to remove.
                            </div>
                          ) : (
                            availableRemoveRoles.map((role) => (
                              <label
                                key={role}
                                className="flex items-center gap-2 rounded-full border border-[#eadfd6] px-3 py-2 text-sm text-[#1f1a17]"
                              >
                                <input
                                  type="checkbox"
                                  checked={removeRoles.includes(role)}
                                  onChange={() => toggleRemoveRole(role)}
                                  disabled={isRemovingRoles}
                                />
                                <span>{role}</span>
                              </label>
                            ))
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="submit"
                            disabled={isRemovingRoles || availableRemoveRoles.length === 0}
                            className="rounded-full bg-[#1f1a17] px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {isRemovingRoles ? "Removing..." : "Remove Role"}
                          </button>
                          <button
                            type="button"
                            disabled={isRemovingRoles}
                            onClick={() => setRemoveRoles([])}
                            className="rounded-full border border-[#eadfd6] px-5 py-3 text-sm text-[#1f1a17] disabled:opacity-50"
                          >
                            Reset
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-[#eadfd6] bg-white/70 px-4 py-3 text-sm text-[#6f655e]">
                        You need admin access to remove roles from this staff member.
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-red-200 bg-white/70 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-red-700">Remove Staff Member</h3>
                        <p className="mt-1 text-sm text-[#6f655e]">
                          Soft-delete this membership. This action requires confirmation.
                        </p>
                      </div>
                      {selectedMember && currentMembership?.userId === selectedMember.userId ? (
                        <span className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-700">
                          Current user
                        </span>
                      ) : null}
                    </div>

                    {removeError ? (
                      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {removeError}
                      </div>
                    ) : null}

                    {canRemoveSelectedMember ? (
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={handleRemoveMember}
                          disabled={isRemovingMember}
                          className="rounded-full border border-red-200 px-5 py-3 text-sm font-medium text-red-700 disabled:opacity-50"
                        >
                          {isRemovingMember ? "Removing..." : "Remove Staff Member"}
                        </button>
                        <button
                          type="button"
                          disabled={isRemovingMember}
                          onClick={() => setRemoveError(null)}
                          className="rounded-full border border-[#eadfd6] px-5 py-3 text-sm text-[#1f1a17] disabled:opacity-50"
                        >
                          Clear
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-[#eadfd6] bg-white/70 px-4 py-3 text-sm text-[#6f655e]">
                        You need admin access to remove this staff member.
                      </div>
                    )}
                  </div>
                </div>
              )}
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
