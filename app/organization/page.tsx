"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuth, useUser } from "@clerk/nextjs";
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
  const { isSignedIn } = useAuth();
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

  // Organization Languages Hooks & Mutations
  const languages = useQuery(
    api.organizationLanguages.list,
    isSignedIn && currentMembership ? {} : "skip"
  );
  const createLanguage = useMutation(api.organizationLanguages.create);
  const updateLanguage = useMutation(api.organizationLanguages.update);
  const setDefaultLanguage = useMutation(api.organizationLanguages.setDefault);
  const removeLanguage = useMutation(api.organizationLanguages.remove);

  // Organization Layouts Hooks & Mutations
  const layouts = useQuery(
    api.organizationLayouts.list,
    isSignedIn && currentMembership ? {} : "skip"
  );
  const createLayout = useMutation(api.organizationLayouts.create);
  const updateLayout = useMutation(api.organizationLayouts.update);
  const removeLayout = useMutation(api.organizationLayouts.remove);

  const [layoutName, setLayoutName] = useState("");
  const [layoutDisplayOrder, setLayoutDisplayOrder] = useState<string>("");
  const [layoutActionError, setLayoutActionError] = useState<string | null>(null);
  const [layoutActionSuccess, setLayoutActionSuccess] = useState<string | null>(null);
  const [isCreatingLayout, setIsCreatingLayout] = useState(false);

  // Edit layout state
  const [editingLayoutId, setEditingLayoutId] = useState<string | null>(null);
  const [editLayoutName, setEditLayoutName] = useState("");
  const [editLayoutDisplayOrder, setEditLayoutDisplayOrder] = useState<string>("");
  const [isUpdatingLayout, setIsUpdatingLayout] = useState(false);
  const [isDeletingLayoutId, setIsDeletingLayoutId] = useState<string | null>(null);

  const formatLayoutErrorMessage = (err: unknown): string => {
    const message = err instanceof Error ? err.message : String(err ?? "An error occurred");
    if (message.includes("already taken") || message.includes("already exists")) {
      return "Layout name already exists.";
    }
    if (message.includes("Name can't be blank")) {
      return "Layout name can't be blank.";
    }
    if (message.includes("Layout not found")) {
      return "Layout section not found.";
    }
    if (message.includes("Unauthenticated")) {
      return "Unauthenticated. Please sign in again.";
    }
    if (message.includes("Active store membership required")) {
      return "Forbidden. Active store membership required.";
    }
    if (message.includes("Admin access required")) {
      return "Forbidden. Admin access required.";
    }
    return message;
  };

  const handleCreateLayout = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLayoutActionError(null);
    setLayoutActionSuccess(null);

    const trimmedName = layoutName.trim();
    if (!trimmedName) {
      setLayoutActionError("Layout name can't be blank.");
      return;
    }

    if (layouts) {
      const dupName = layouts.some(
        (l) => l.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (dupName) {
        setLayoutActionError("Layout name already exists.");
        return;
      }
    }

    const orderNum = layoutDisplayOrder.trim() !== "" ? parseInt(layoutDisplayOrder.trim(), 10) : undefined;
    if (orderNum !== undefined && isNaN(orderNum)) {
      setLayoutActionError("Display order must be a valid number.");
      return;
    }

    setIsCreatingLayout(true);
    try {
      await createLayout({
        name: trimmedName,
        ...(orderNum !== undefined ? { displayOrder: orderNum } : {}),
      });
      setLayoutActionSuccess(`Layout section "${trimmedName}" created successfully.`);
      setLayoutName("");
      setLayoutDisplayOrder("");
    } catch (err) {
      setLayoutActionError(formatLayoutErrorMessage(err));
    } finally {
      setIsCreatingLayout(false);
    }
  };

  const startEditingLayout = (layout: { _id: string; name: string; displayOrder?: number }) => {
    setEditingLayoutId(layout._id);
    setEditLayoutName(layout.name);
    setEditLayoutDisplayOrder(layout.displayOrder !== undefined ? String(layout.displayOrder) : "");
    setLayoutActionError(null);
    setLayoutActionSuccess(null);
  };

  const handleUpdateLayout = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingLayoutId) return;
    setLayoutActionError(null);
    setLayoutActionSuccess(null);

    const trimmedName = editLayoutName.trim();
    if (!trimmedName) {
      setLayoutActionError("Layout name can't be blank.");
      return;
    }

    if (layouts) {
      const dupName = layouts.some(
        (l) => l._id !== editingLayoutId && l.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (dupName) {
        setLayoutActionError("Layout name already exists.");
        return;
      }
    }

    const orderNum = editLayoutDisplayOrder.trim() !== "" ? parseInt(editLayoutDisplayOrder.trim(), 10) : undefined;
    if (orderNum !== undefined && isNaN(orderNum)) {
      setLayoutActionError("Display order must be a valid number.");
      return;
    }

    setIsUpdatingLayout(true);
    try {
      await updateLayout({
        id: editingLayoutId as any,
        name: trimmedName,
        ...(orderNum !== undefined ? { displayOrder: orderNum } : {}),
      });
      setLayoutActionSuccess(`Layout section "${trimmedName}" updated successfully.`);
      setEditingLayoutId(null);
    } catch (err) {
      setLayoutActionError(formatLayoutErrorMessage(err));
    } finally {
      setIsUpdatingLayout(false);
    }
  };

  const handleRemoveLayout = async (id: string, name: string) => {
    const confirmed = window.confirm(`Are you sure you want to remove the layout section "${name}"?`);
    if (!confirmed) return;

    setLayoutActionError(null);
    setLayoutActionSuccess(null);
    setIsDeletingLayoutId(id);
    try {
      await removeLayout({ id: id as any });
      setLayoutActionSuccess(`Layout section "${name}" was deleted successfully.`);
      if (editingLayoutId === id) {
        setEditingLayoutId(null);
      }
    } catch (err) {
      setLayoutActionError(formatLayoutErrorMessage(err));
    } finally {
      setIsDeletingLayoutId(null);
    }
  };

  const [langName, setLangName] = useState("");
  const [langCode, setLangCode] = useState("");
  const [langIsDefault, setLangIsDefault] = useState(false);
  const [langActionError, setLangActionError] = useState<string | null>(null);
  const [langActionSuccess, setLangActionSuccess] = useState<string | null>(null);
  const [isCreatingLang, setIsCreatingLang] = useState(false);

  // Edit language state
  const [editingLangId, setEditingLangId] = useState<string | null>(null);
  const [editLangName, setEditLangName] = useState("");
  const [editLangCode, setEditLangCode] = useState("");
  const [editLangIsDefault, setEditLangIsDefault] = useState(false);
  const [isUpdatingLang, setIsUpdatingLang] = useState(false);

  // Action loading indicators
  const [isSettingDefaultLangId, setIsSettingDefaultLangId] = useState<string | null>(null);
  const [isDeletingLangId, setIsDeletingLangId] = useState<string | null>(null);

  const formatLanguageErrorMessage = (err: unknown): string => {
    const message = err instanceof Error ? err.message : String(err ?? "An error occurred");
    if (message.includes("already taken") || message.includes("already exists")) {
      return "Language name or ISO code already exists.";
    }
    if (message.includes("Name can't be blank")) {
      return "Name can't be blank";
    }
    if (message.includes("Code can't be blank")) {
      return "Code can't be blank";
    }
    if (message.includes("Language not found")) {
      return "Language not found.";
    }
    if (message.includes("Unauthenticated")) {
      return "Unauthenticated. Please sign in again.";
    }
    if (message.includes("Active store membership required")) {
      return "Forbidden. Active store membership required.";
    }
    if (message.includes("Admin access required")) {
      return "Forbidden. Admin access required.";
    }
    return message;
  };

  const handleCreateLanguage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLangActionError(null);
    setLangActionSuccess(null);

    const trimmedName = langName.trim();
    const trimmedCode = langCode.trim();

    if (!trimmedName) {
      setLangActionError("Name can't be blank");
      return;
    }
    if (!trimmedCode) {
      setLangActionError("Code can't be blank");
      return;
    }

    if (languages) {
      const dupName = languages.some(
        (l) => l.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (dupName) {
        setLangActionError("Language name or ISO code already exists.");
        return;
      }
      const dupCode = languages.some(
        (l) => l.code.trim().toLowerCase() === trimmedCode.toLowerCase()
      );
      if (dupCode) {
        setLangActionError("Language name or ISO code already exists.");
        return;
      }
    }

    setIsCreatingLang(true);
    try {
      await createLanguage({
        name: trimmedName,
        code: trimmedCode,
        isDefault: langIsDefault,
      });
      setLangActionSuccess(`Language "${trimmedName}" (${trimmedCode.toUpperCase()}) created successfully.`);
      setLangName("");
      setLangCode("");
      setLangIsDefault(false);
    } catch (err) {
      setLangActionError(formatLanguageErrorMessage(err));
    } finally {
      setIsCreatingLang(false);
    }
  };

  const startEditingLang = (lang: { _id: string; name: string; code: string; isDefault: boolean }) => {
    setEditingLangId(lang._id);
    setEditLangName(lang.name);
    setEditLangCode(lang.code);
    setEditLangIsDefault(lang.isDefault);
    setLangActionError(null);
    setLangActionSuccess(null);
  };

  const handleUpdateLanguage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingLangId) return;
    setLangActionError(null);
    setLangActionSuccess(null);

    const trimmedName = editLangName.trim();
    const trimmedCode = editLangCode.trim();

    if (!trimmedName) {
      setLangActionError("Name can't be blank");
      return;
    }
    if (!trimmedCode) {
      setLangActionError("Code can't be blank");
      return;
    }

    if (languages) {
      const dupName = languages.some(
        (l) => l._id !== editingLangId && l.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (dupName) {
        setLangActionError("Language name or ISO code already exists.");
        return;
      }
      const dupCode = languages.some(
        (l) => l._id !== editingLangId && l.code.trim().toLowerCase() === trimmedCode.toLowerCase()
      );
      if (dupCode) {
        setLangActionError("Language name or ISO code already exists.");
        return;
      }
    }

    setIsUpdatingLang(true);
    try {
      await updateLanguage({
        id: editingLangId as any,
        name: trimmedName,
        code: trimmedCode,
        isDefault: editLangIsDefault,
      });
      setLangActionSuccess(`Language "${trimmedName}" updated successfully.`);
      setEditingLangId(null);
    } catch (err) {
      setLangActionError(formatLanguageErrorMessage(err));
    } finally {
      setIsUpdatingLang(false);
    }
  };

  const handleSetDefaultLanguage = async (id: string, name: string) => {
    setLangActionError(null);
    setLangActionSuccess(null);
    setIsSettingDefaultLangId(id);
    try {
      await setDefaultLanguage({ id: id as any });
      setLangActionSuccess(`"${name}" is now the default store language.`);
    } catch (err) {
      setLangActionError(formatLanguageErrorMessage(err));
    } finally {
      setIsSettingDefaultLangId(null);
    }
  };

  const handleRemoveLanguage = async (id: string, name: string) => {
    const confirmed = window.confirm(`Are you sure you want to remove the language "${name}"?`);
    if (!confirmed) return;

    setLangActionError(null);
    setLangActionSuccess(null);
    setIsDeletingLangId(id);
    try {
      await removeLanguage({ id: id as any });
      setLangActionSuccess(`Language "${name}" was removed.`);
      if (editingLangId === id) {
        setEditingLangId(null);
      }
    } catch (err) {
      setLangActionError(formatLanguageErrorMessage(err));
    } finally {
      setIsDeletingLangId(null);
    }
  };

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

  const { user } = useUser();
  const [hasAttemptedRepair, setHasAttemptedRepair] = useState(false);

  useEffect(() => {
    // Auto-repair pre-existing store owner admin membership ONCE if loaded, membership is null,
    // AND the store is either unowned or the current user is the recorded store owner.
    const isOwnerOrUnowned =
      !organization?.ownerClerkId || (user?.id && organization?.ownerClerkId === user.id);

    if (organization?._id && currentMembership === null && isOwnerOrUnowned && !hasAttemptedRepair) {
      setHasAttemptedRepair(true);
      repairStoreOwnerAdmin({ organizationId: organization._id }).catch(() => {});
    }
  }, [organization, currentMembership, user?.id, hasAttemptedRepair, repairStoreOwnerAdmin]);

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

            {/* Organization Languages Section */}
            <section className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6 xl:col-span-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium">Organization Languages</h2>
                  <p className="mt-1 text-sm text-[#6f655e]">
                    Manage store catalog languages and designate the active default language.
                  </p>
                </div>
                {isAdmin ? (
                  <span className="rounded-full bg-[#f5efe9] px-3 py-1 text-xs text-[#6f655e]">
                    Store Admin
                  </span>
                ) : null}
              </div>

              {/* Feedback messages */}
              {langActionSuccess ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
                  {langActionSuccess}
                </div>
              ) : null}
              {langActionError ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                  {langActionError}
                </div>
              ) : null}

              {/* Add Language Form Card */}
              <div className="mt-5 rounded-2xl border border-[#eadfd6] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b border-[#eadfd6] pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1f1a17]">Add New Language</h3>
                    <p className="mt-0.5 text-xs text-[#6f655e]">
                      Add an ISO language code and language name to the store catalog.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#f5efe9] px-3 py-1 text-xs font-medium text-[#6f655e]">
                    Store Admin only
                  </span>
                </div>

                {isAdmin ? (
                  <form onSubmit={handleCreateLanguage} className="mt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="text-xs uppercase tracking-wide text-[#8a7e75]">Language Name</label>
                        <input
                          type="text"
                          value={langName}
                          onChange={(e) => setLangName(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-[#eadfd6] bg-white px-4 py-2 text-sm outline-none transition-all focus:border-[#1f1a17]"
                          placeholder="e.g. English, Hindi, Arabic"
                          disabled={isCreatingLang}
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-wide text-[#8a7e75]">ISO Language Code</label>
                        <input
                          type="text"
                          value={langCode}
                          onChange={(e) => setLangCode(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-[#eadfd6] bg-white px-4 py-2 text-sm outline-none transition-all focus:border-[#1f1a17]"
                          placeholder="e.g. en, hi, ar"
                          disabled={isCreatingLang}
                        />
                      </div>
                      <div className="flex items-center pt-6 sm:pt-4">
                        <label className="flex items-center gap-2 text-sm font-medium text-[#1f1a17] cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={langIsDefault}
                            onChange={(e) => setLangIsDefault(e.target.checked)}
                            className="h-4 w-4 rounded border-[#eadfd6] accent-[#1f1a17]"
                            disabled={isCreatingLang}
                          />
                          <span>Set as default language</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={isCreatingLang}
                        className="rounded-xl bg-[#1f1a17] px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-black transition-all disabled:opacity-50"
                      >
                        {isCreatingLang ? "Adding..." : "Add Language"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLangName("");
                          setLangCode("");
                          setLangIsDefault(false);
                          setLangActionError(null);
                        }}
                        disabled={isCreatingLang}
                        className="rounded-xl border border-[#eadfd6] bg-white px-5 py-2.5 text-sm text-[#1f1a17] hover:bg-[#f5efe9] transition-all disabled:opacity-50"
                      >
                        Clear
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="mt-4 rounded-xl border border-[#eadfd6] bg-[#fbf7f4] px-4 py-3 text-sm text-[#6f655e]">
                    You need admin access to add organization languages.
                  </div>
                )}
              </div>

              {/* Edit Language Form Card */}
              {editingLangId && isAdmin ? (
                <div className="mt-5 rounded-2xl border border-[#1f1a17] bg-white p-5 shadow-md">
                  <div className="flex items-center justify-between gap-4 border-b border-[#eadfd6] pb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[#1f1a17]">Edit Language</h3>
                      <p className="mt-0.5 text-xs text-[#6f655e]">Update language name, code, or default status.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingLangId(null)}
                      className="text-xs font-medium text-[#6f655e] hover:text-[#1f1a17]"
                    >
                      ✕ Close
                    </button>
                  </div>

                  <form onSubmit={handleUpdateLanguage} className="mt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="text-xs uppercase tracking-wide text-[#8a7e75]">Language Name</label>
                        <input
                          type="text"
                          value={editLangName}
                          onChange={(e) => setEditLangName(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-[#eadfd6] bg-white px-4 py-2 text-sm outline-none focus:border-[#1f1a17]"
                          disabled={isUpdatingLang}
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-wide text-[#8a7e75]">ISO Code</label>
                        <input
                          type="text"
                          value={editLangCode}
                          onChange={(e) => setEditLangCode(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-[#eadfd6] bg-white px-4 py-2 text-sm outline-none focus:border-[#1f1a17]"
                          disabled={isUpdatingLang}
                        />
                      </div>
                      <div className="flex items-center pt-6 sm:pt-4">
                        <label className="flex items-center gap-2 text-sm font-medium text-[#1f1a17] cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={editLangIsDefault}
                            onChange={(e) => setEditLangIsDefault(e.target.checked)}
                            className="h-4 w-4 rounded border-[#eadfd6] accent-[#1f1a17]"
                            disabled={isUpdatingLang}
                          />
                          <span>Set as default language</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={isUpdatingLang}
                        className="rounded-xl bg-[#1f1a17] px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-black transition-all disabled:opacity-50"
                      >
                        {isUpdatingLang ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingLangId(null)}
                        disabled={isUpdatingLang}
                        className="rounded-xl border border-[#eadfd6] bg-white px-5 py-2.5 text-sm text-[#1f1a17] hover:bg-[#f5efe9] transition-all disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}

              {/* Languages Table */}
              {languages === undefined ? (
                <div className="mt-5 rounded-2xl border border-[#eadfd6] bg-white px-4 py-3 text-sm text-[#6f655e]">
                  Loading organization languages...
                </div>
              ) : languages.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-[#eadfd6] bg-white px-4 py-3 text-sm text-[#6f655e]">
                  No active organization languages found.
                </div>
              ) : (
                <div className="mt-5 overflow-x-auto rounded-2xl border border-[#eadfd6] bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#f5efe9] text-[#6f655e]">
                      <tr>
                        <th className="px-4 py-3">Language Name</th>
                        <th className="px-4 py-3">ISO Code</th>
                        <th className="px-4 py-3">Default Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {languages.map((lang) => (
                        <tr key={lang._id} className="border-t border-[#eadfd6] hover:bg-[#fbf7f4]/50">
                          <td className="px-4 py-3 font-medium text-[#1f1a17]">{lang.name}</td>
                          <td className="px-4 py-3 font-mono text-xs text-[#6f655e]">
                            {lang.code.toUpperCase()}
                          </td>
                          <td className="px-4 py-3">
                            {lang.isDefault ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                ★ Default
                              </span>
                            ) : (
                              <span className="text-xs text-[#8a7e75]">Standard</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {!lang.isDefault ? (
                                <button
                                  type="button"
                                  onClick={() => handleSetDefaultLanguage(lang._id, lang.name)}
                                  disabled={
                                    isSettingDefaultLangId === lang._id || isMembershipLoading || !isAdmin
                                  }
                                  title={!isAdmin ? "Store Admin only" : "Make this the default language"}
                                  className="rounded-lg border border-[#eadfd6] bg-white px-3 py-1 text-xs font-medium text-[#1f1a17] hover:bg-[#f5efe9] transition-all disabled:opacity-50"
                                >
                                  {isSettingDefaultLangId === lang._id ? "Setting..." : "Set Default"}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => startEditingLang(lang)}
                                disabled={isMembershipLoading || !isAdmin}
                                title={!isAdmin ? "Store Admin only" : "Edit language details"}
                                className="rounded-lg border border-[#eadfd6] bg-white px-3 py-1 text-xs font-medium text-[#1f1a17] hover:bg-[#f5efe9] transition-all disabled:opacity-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveLanguage(lang._id, lang.name)}
                                disabled={isDeletingLangId === lang._id || isMembershipLoading || !isAdmin}
                                title={!isAdmin ? "Store Admin only" : "Delete this language"}
                                className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 transition-all disabled:opacity-50"
                              >
                                {isDeletingLangId === lang._id ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Organization Layouts / Floor Plan Sections Section */}
            <section className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6 xl:col-span-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium">Organization Layouts (Floor Plan Sections)</h2>
                  <p className="mt-1 text-sm text-[#6f655e]">
                    Manage store seating areas, dining rooms, and floor layout sections.
                  </p>
                </div>
                {isAdmin ? (
                  <span className="rounded-full bg-[#f5efe9] px-3 py-1 text-xs text-[#6f655e]">
                    Store Admin
                  </span>
                ) : null}
              </div>

              {/* Feedback messages */}
              {layoutActionSuccess ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
                  {layoutActionSuccess}
                </div>
              ) : null}
              {layoutActionError ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                  {layoutActionError}
                </div>
              ) : null}

              {/* Add Layout Form Card */}
              <div className="mt-5 rounded-2xl border border-[#eadfd6] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b border-[#eadfd6] pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1f1a17]">Add Layout Section</h3>
                    <p className="mt-0.5 text-xs text-[#6f655e]">
                      Create a new floor plan section (e.g. Main Dining, Patio, Bar, Rooftop).
                    </p>
                  </div>
                  <span className="rounded-full bg-[#f5efe9] px-3 py-1 text-xs font-medium text-[#6f655e]">
                    Store Admin only
                  </span>
                </div>

                {isAdmin ? (
                  <form onSubmit={handleCreateLayout} className="mt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs uppercase tracking-wide text-[#8a7e75]">Section Name</label>
                        <input
                          type="text"
                          value={layoutName}
                          onChange={(e) => setLayoutName(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-[#eadfd6] bg-white px-4 py-2 text-sm outline-none transition-all focus:border-[#1f1a17]"
                          placeholder="e.g. Main Dining, Patio, Bar"
                          disabled={isCreatingLayout}
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-wide text-[#8a7e75]">Display Order (Optional)</label>
                        <input
                          type="number"
                          value={layoutDisplayOrder}
                          onChange={(e) => setLayoutDisplayOrder(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-[#eadfd6] bg-white px-4 py-2 text-sm outline-none transition-all focus:border-[#1f1a17]"
                          placeholder="e.g. 1, 2, 3"
                          disabled={isCreatingLayout}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={isCreatingLayout}
                        className="rounded-xl bg-[#1f1a17] px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-black transition-all disabled:opacity-50"
                      >
                        {isCreatingLayout ? "Adding..." : "Add Layout"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLayoutName("");
                          setLayoutDisplayOrder("");
                          setLayoutActionError(null);
                        }}
                        disabled={isCreatingLayout}
                        className="rounded-xl border border-[#eadfd6] bg-white px-5 py-2.5 text-sm text-[#1f1a17] hover:bg-[#f5efe9] transition-all disabled:opacity-50"
                      >
                        Clear
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="mt-4 rounded-xl border border-[#eadfd6] bg-[#fbf7f4] px-4 py-3 text-sm text-[#6f655e]">
                    You need admin access to add floor plan layout sections.
                  </div>
                )}
              </div>

              {/* Edit Layout Form Card */}
              {editingLayoutId && isAdmin ? (
                <div className="mt-5 rounded-2xl border border-[#1f1a17] bg-white p-5 shadow-md">
                  <div className="flex items-center justify-between gap-4 border-b border-[#eadfd6] pb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[#1f1a17]">Edit Layout Section</h3>
                      <p className="mt-0.5 text-xs text-[#6f655e]">Update layout section name or display order.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingLayoutId(null)}
                      className="text-xs font-medium text-[#6f655e] hover:text-[#1f1a17]"
                    >
                      ✕ Close
                    </button>
                  </div>

                  <form onSubmit={handleUpdateLayout} className="mt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs uppercase tracking-wide text-[#8a7e75]">Section Name</label>
                        <input
                          type="text"
                          value={editLayoutName}
                          onChange={(e) => setEditLayoutName(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-[#eadfd6] bg-white px-4 py-2 text-sm outline-none focus:border-[#1f1a17]"
                          disabled={isUpdatingLayout}
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-wide text-[#8a7e75]">Display Order (Optional)</label>
                        <input
                          type="number"
                          value={editLayoutDisplayOrder}
                          onChange={(e) => setEditLayoutDisplayOrder(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-[#eadfd6] bg-white px-4 py-2 text-sm outline-none focus:border-[#1f1a17]"
                          disabled={isUpdatingLayout}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={isUpdatingLayout}
                        className="rounded-xl bg-[#1f1a17] px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-black transition-all disabled:opacity-50"
                      >
                        {isUpdatingLayout ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingLayoutId(null)}
                        disabled={isUpdatingLayout}
                        className="rounded-xl border border-[#eadfd6] bg-white px-5 py-2.5 text-sm text-[#1f1a17] hover:bg-[#f5efe9] transition-all disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}

              {/* Layouts Table */}
              {layouts === undefined ? (
                <div className="mt-5 rounded-2xl border border-[#eadfd6] bg-white px-4 py-3 text-sm text-[#6f655e]">
                  Loading organization layouts...
                </div>
              ) : layouts.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-[#eadfd6] bg-white px-4 py-3 text-sm text-[#6f655e]">
                  No active organization layouts found.
                </div>
              ) : (
                <div className="mt-5 overflow-x-auto rounded-2xl border border-[#eadfd6] bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#f5efe9] text-[#6f655e]">
                      <tr>
                        <th className="px-4 py-3">Section Name</th>
                        <th className="px-4 py-3">Display Order</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {([...layouts].sort((a, b) => {
                        if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
                          return a.displayOrder - b.displayOrder;
                        }
                        if (a.displayOrder !== undefined) return -1;
                        if (b.displayOrder !== undefined) return 1;
                        return a.name.localeCompare(b.name);
                      })).map((layout) => (
                        <tr key={layout._id} className="border-t border-[#eadfd6] hover:bg-[#fbf7f4]/50">
                          <td className="px-4 py-3 font-medium text-[#1f1a17]">{layout.name}</td>
                          <td className="px-4 py-3 text-[#6f655e]">
                            {layout.displayOrder !== undefined ? (
                              <span className="inline-flex items-center rounded-full bg-[#f5efe9] px-2.5 py-0.5 text-xs font-medium text-[#1f1a17]">
                                #{layout.displayOrder}
                              </span>
                            ) : (
                              <span className="text-xs text-[#8a7e75]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => startEditingLayout(layout)}
                                disabled={isMembershipLoading || !isAdmin}
                                title={!isAdmin ? "Store Admin only" : "Edit layout details"}
                                className="rounded-lg border border-[#eadfd6] bg-white px-3 py-1 text-xs font-medium text-[#1f1a17] hover:bg-[#f5efe9] transition-all disabled:opacity-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveLayout(layout._id, layout.name)}
                                disabled={isDeletingLayoutId === layout._id || isMembershipLoading || !isAdmin}
                                title={!isAdmin ? "Store Admin only" : "Delete this layout section"}
                                className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 transition-all disabled:opacity-50"
                              >
                                {isDeletingLayoutId === layout._id ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
