"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";

// ====================================================
// SVG ICONS & VISUAL ASSETS (Pixel-Perfect Match)
// ====================================================

function EyeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EditIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function TrashIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function SearchIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function PlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ShieldAdminIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function PosIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

function TableIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h18M3 7v10M21 7v10M7 17v4M17 17v4" />
    </svg>
  );
}

function RoomServiceIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 18h20M4 18a8 8 0 0 1 16 0M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
    </svg>
  );
}

function ChefHatIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 13.8V4a2 2 0 0 1 4 0v9.8M14 13.8V4a2 2 0 0 1 4 0v9.8M10 13.8V4M6 18h12v3H6z" />
    </svg>
  );
}

function ComputerWorkstationIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function PersonSearchIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="8" r="4" />
      <path d="M2 20a8 8 0 0 1 14 0" />
      <circle cx="17" cy="17" r="3" />
      <line x1="19" y1="19" x2="22" y2="22" />
    </svg>
  );
}

function DashboardIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function ReceiptLongIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="16" y2="11" />
      <line x1="8" y1="15" x2="12" y2="15" />
    </svg>
  );
}

function MenuBookIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function SoupKitchenIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9z" />
      <path d="M7 8V4M12 8V4M17 8V4" />
    </svg>
  );
}

function GroupsIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function InventoryIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function BarChartIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  );
}

function RateReviewIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="9" y1="10" x2="15" y2="10" />
    </svg>
  );
}

function InfoIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function EnvelopeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function PhoneIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function CheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function LockIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// ====================================================
// CONFIGURATION MATRICES (Roles & Modules)
// ====================================================

const STAFF_ROLE_CARDS = [
  {
    key: "admin",
    label: "Admin",
    badge: "ALL MODULES • UNRESTRICTED",
    desc: "Full store administrator. Complete control over store settings, staff, billing, menus, and reports.",
    icon: ShieldAdminIcon,
    permTitle: "Full Access",
    permDesc: "All modules unrestricted",
  },
  {
    key: "cashier",
    label: "Cashier",
    badge: "CASHIER • ORDERS",
    desc: "Front-of-house register operator. Manages active orders, bills, settlements, and payments.",
    icon: PosIcon,
    permTitle: "Standard Cashier + Orders",
    permDesc: "Payment terminal & billing",
  },
  {
    key: "captain",
    label: "Captain",
    badge: "TABLES • WAITERS",
    desc: "Floor lead. Manages tables, seating, waiter assignments, and order supervision.",
    icon: TableIcon,
    permTitle: "Floor Management",
    permDesc: "Tables, Captain app & Queue",
  },
  {
    key: "waiter",
    label: "Waiter",
    badge: "TABLE ORDERS",
    desc: "Floor service staff. Takes table orders and handles guest table service.",
    icon: RoomServiceIcon,
    permTitle: "Floor Operations",
    permDesc: "Order placement & tables",
  },
  {
    key: "chef",
    label: "Chef",
    badge: "KITCHEN • KDS",
    desc: "Kitchen staff. Works with KDS and manages food preparation stages.",
    icon: ChefHatIcon,
    permTitle: "Kitchen Operations",
    permDesc: "Order processing & KDS view",
  },
  {
    key: "worker",
    label: "Worker",
    badge: "WORKSTATION",
    desc: "General operational staff. Works with assigned workstation views.",
    icon: ComputerWorkstationIcon,
    permTitle: "General Access",
    permDesc: "Basic store functions",
  },
];

const MODULE_ACCESS_CARDS = [
  { key: "customer_data", label: "Customer Data", desc: "Profiles & CRM", icon: PersonSearchIcon },
  { key: "dashboard", label: "Dashboard", desc: "Store overview", icon: DashboardIcon },
  { key: "orders", label: "Orders", desc: "Live orders & logs", icon: ReceiptLongIcon },
  { key: "menu", label: "Menu", desc: "Items & pricing", icon: MenuBookIcon },
  { key: "kds", label: "KDS", desc: "Kitchen display", icon: SoupKitchenIcon },
  { key: "queue", label: "Queue", desc: "Waitlist & diners", icon: GroupsIcon },
  { key: "inventory", label: "Inventory", desc: "Stock & recipes", icon: InventoryIcon },
  { key: "report", label: "Report", desc: "Sales & tax", icon: BarChartIcon },
  { key: "survey", label: "Survey", desc: "Guest feedback", icon: RateReviewIcon },
];

export function OrganizationEmployees() {
  // Query Convex Database for Employees / Staff List
  const employees = useQuery(api.organizationUsers.list, {});
  const currentMembership = useQuery(api.organizationUsers.getCurrentMembership, {});

  // Convex Mutations
  const createEmployeeMutation = useMutation(api.organizationUsers.create);
  const updateEmployeeMutation = useMutation(api.organizationUsers.update);
  const removeEmployeeMutation = useMutation(api.organizationUsers.remove);

  // Local State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Drawer & Modal States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<Id<"organizationUsers"> | null>(null);

  // Form Fields State
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formCountryCode, setFormCountryCode] = useState("+91");
  const [formPhone, setFormPhone] = useState("");
  const [formUserIdentifier, setFormUserIdentifier] = useState("");
  const [formRoles, setFormRoles] = useState<string[]>(["cashier", "orders"]);
  const [customPermissions, setCustomPermissions] = useState<
    Record<string, { create: boolean; read: boolean; update: boolean; delete: boolean }>
  >({});
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // View Details Modal / Drawer State
  const [viewingTarget, setViewingTarget] = useState<Doc<"organizationUsers"> | null>(null);
  const [isViewGranularOpen, setIsViewGranularOpen] = useState(false);

  // Live Query single employee document when viewing
  const fetchedViewingDetail = useQuery(
    api.organizationUsers.get,
    viewingTarget ? { id: viewingTarget._id } : "skip"
  );
  const activeViewingDoc = fetchedViewingDetail || viewingTarget;

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{ id: Id<"organizationUsers">; userId: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Helper to derive name / initials / phone / email from user ID string
  const getEmployeeDisplayMeta = (emp: Doc<"organizationUsers">) => {
    const raw = emp.userId || "";
    let name = raw;
    let email = raw.includes("@") ? raw : `${raw.toLowerCase()}@example.com`;
    let phone = "+91 95210 20647";

    if (raw.includes("@")) {
      const parts = raw.split("@")[0].split(/[._-]/);
      name = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
    } else if (raw.startsWith("user_") || raw.startsWith("usr_")) {
      name = "MAHENDRA SUTHAR";
    }

    const nameWords = name.trim().split(" ");
    let initials = "MS";
    if (nameWords.length >= 2) {
      initials = (nameWords[0].charAt(0) + nameWords[1].charAt(0)).toUpperCase();
    } else if (nameWords.length === 1 && nameWords[0].length > 0) {
      initials = nameWords[0].slice(0, 2).toUpperCase();
    }

    return { name, email, phone, initials };
  };

  // Derive Permission Summary
  const getPermissionSummary = (userTypes: string[]) => {
    if (userTypes.includes("admin")) {
      return { title: "Full Access", desc: "All modules unrestricted" };
    }
    if (userTypes.length > 2) {
      return { title: `Customized (${userTypes.length} items)`, desc: "Multiple roles and modules assigned" };
    }
    if (userTypes.length === 1) {
      const roleObj = STAFF_ROLE_CARDS.find((r) => r.key === userTypes[0]);
      if (roleObj) return { title: roleObj.permTitle, desc: roleObj.permDesc };
    }
    if (userTypes.includes("cashier")) {
      return { title: "Standard Cashier + Orders", desc: "Payment terminal & billing" };
    }
    return { title: "Standard Staff Access", desc: "Assigned store permissions" };
  };

  // Filtered Employees List
  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    return employees.filter((emp: Doc<"organizationUsers">) => {
      const search = searchTerm.trim().toLowerCase();
      const meta = getEmployeeDisplayMeta(emp);

      const matchesSearch =
        !search ||
        emp.userId.toLowerCase().includes(search) ||
        meta.name.toLowerCase().includes(search) ||
        emp.userType.some((r: string) => r.toLowerCase().includes(search));

      const matchesRole =
        selectedRoleFilter === "all" ||
        emp.userType.includes(selectedRoleFilter);

      const matchesStatus =
        selectedStatusFilter === "all" ||
        (selectedStatusFilter === "active" ? true : false);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [employees, searchTerm, selectedRoleFilter, selectedStatusFilter]);

  // Paginated employees
  const totalPages = Math.ceil((filteredEmployees.length || 1) / itemsPerPage);
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredEmployees.slice(start, start + itemsPerPage);
  }, [filteredEmployees, currentPage]);

  // Drawer Handlers
  const handleOpenAddDrawer = () => {
    setDrawerMode("add");
    setEditingId(null);
    setFormFirstName("");
    setFormLastName("");
    setFormPhone("");
    setFormCountryCode("+91");
    setFormUserIdentifier("");
    setFormRoles(["cashier", "orders"]);
    setCustomPermissions({});
    setIsAdvancedOpen(false);
    setErrorMessage(null);
    setIsDrawerOpen(true);
    setTimeout(() => setIsDrawerVisible(true), 20);
  };

  const handleOpenEditDrawer = (emp: Doc<"organizationUsers">) => {
    setDrawerMode("edit");
    setEditingId(emp._id);
    const meta = getEmployeeDisplayMeta(emp);
    const nameParts = meta.name.split(" ");
    setFormFirstName(nameParts[0] || "");
    setFormLastName(nameParts.slice(1).join(" ") || "");
    setFormPhone(meta.phone || "");
    setFormUserIdentifier(emp.userId);
    setFormRoles(emp.userType.length > 0 ? emp.userType : ["cashier"]);
    setCustomPermissions(emp.userPermission || {});
    setIsAdvancedOpen(false);
    setErrorMessage(null);
    setIsDrawerOpen(true);
    setTimeout(() => setIsDrawerVisible(true), 20);
  };

  const handleCloseDrawer = () => {
    setIsDrawerVisible(false);
    setTimeout(() => setIsDrawerOpen(false), 300);
  };

  const handleToggleItem = (key: string) => {
    setFormRoles((prev) =>
      prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]
    );
  };

  const handleTogglePermission = (
    key: string,
    action: "create" | "read" | "update" | "delete"
  ) => {
    setCustomPermissions((prev) => {
      const currentObj = prev[key] || { create: true, read: true, update: true, delete: true };
      return {
        ...prev,
        [key]: {
          ...currentObj,
          [action]: !currentObj[action],
        },
      };
    });
  };

  const handleSaveEmployee = async () => {
    if (!formFirstName.trim()) {
      setErrorMessage("First name is required.");
      return;
    }
    if (!formLastName.trim()) {
      setErrorMessage("Last name is required.");
      return;
    }
    if (!formPhone.trim()) {
      setErrorMessage("Phone number is required.");
      return;
    }
    if (formRoles.length === 0) {
      setErrorMessage("Please select at least one role or module access.");
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      let effectiveUserId = formUserIdentifier.trim();
      if (!effectiveUserId) {
        const cleanPhone = formPhone.trim().replace(/\s+/g, "");
        effectiveUserId = `${cleanPhone}@phone.user`;
      }

      const permissionPayload =
        Object.keys(customPermissions).length > 0 ? customPermissions : undefined;

      if (drawerMode === "add") {
        await createEmployeeMutation({
          userId: effectiveUserId,
          userType: formRoles,
          ...(permissionPayload ? { userPermission: permissionPayload } : {}),
        });
        setSuccessMessage(`Employee "${formFirstName} ${formLastName}" created successfully!`);
      } else if (editingId) {
        await updateEmployeeMutation({
          id: editingId,
          userType: formRoles,
          ...(permissionPayload ? { userPermission: permissionPayload } : {}),
        });
        setSuccessMessage(`Employee updated successfully!`);
      }

      handleCloseDrawer();
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to save employee record.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setErrorMessage(null);
    setIsDeleting(true);

    try {
      await removeEmployeeMutation({ id: deleteTarget.id });
      setSuccessMessage(`Employee removed successfully.`);
      setDeleteTarget(null);
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to remove employee.");
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  if (employees === undefined) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[#78716c]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#141010] border-t-transparent"></div>
          <span className="text-xs font-medium">Loading employees from Convex...</span>
        </div>
      </div>
    );
  }

  // Selected Roles & Modules for Section 4 Summary
  const selectedRoles = formRoles.filter((r) => STAFF_ROLE_CARDS.some((c) => c.key === r));
  const selectedModules = formRoles.filter((m) => MODULE_ACCESS_CARDS.some((c) => c.key === m));

  return (
    <div className="space-y-6">
      {/* Toast Feedback Alerts */}
      {successMessage && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-5 py-3 text-xs text-emerald-800 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span className="font-medium">{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center justify-between rounded-xl bg-red-50 border border-red-200 px-5 py-3 text-xs text-red-800 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-red-600 hover:text-red-900 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* TOP HEADER SECTION */}
      <div className="space-y-4">
        {/* Title & Subtitle */}
        <div className="border-b border-[#e7e5e4] pb-4">
          <h2 className="font-garamond text-2xl lg:text-3xl text-[#141010] font-normal leading-tight">
            Employees
          </h2>
          <p className="text-xs text-[#78716c] mt-1">
            Manage store staff, assign branch roles, and configure system permissions.
          </p>
        </div>

        {/* Control Bar (Search, Dropdowns & Add Employee Button) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#faf8f7] p-3 rounded-xl border border-[#e7e5e4]">
          {/* Left Controls: Search + Filters */}
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5 min-w-0">
            <div className="relative flex-1 min-w-[200px]">
              <SearchIcon className="w-4 h-4 absolute left-3 top-2.5 text-[#a8a29e]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search employees..."
                className="w-full rounded-lg border border-[#e7e5e4] bg-white px-3.5 py-2 pl-9 text-xs text-[#1c1917] placeholder-[#a8a29e] transition focus:border-[#141010] focus:outline-none shadow-xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 text-[#a8a29e] hover:text-[#1c1917] text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Role Filter */}
            <div className="relative inline-flex items-center shrink-0">
              <select
                value={selectedRoleFilter}
                onChange={(e) => {
                  setSelectedRoleFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="appearance-none rounded-xl border border-[#e7e5e4] bg-white pl-3.5 pr-8 py-2 text-xs font-semibold text-[#1c1917] shadow-xs cursor-pointer hover:border-[#a8a29e] focus:border-[#141010] focus:outline-none transition shrink-0"
              >
                <option value="all">All roles</option>
                {STAFF_ROLE_CARDS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
              <svg className="w-3.5 h-3.5 text-[#78716c] pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {/* Status Filter */}
            <div className="relative inline-flex items-center shrink-0">
              <select
                value={selectedStatusFilter}
                onChange={(e) => {
                  setSelectedStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="appearance-none rounded-xl border border-[#e7e5e4] bg-white pl-3.5 pr-8 py-2 text-xs font-semibold text-[#1c1917] shadow-xs cursor-pointer hover:border-[#a8a29e] focus:border-[#141010] focus:outline-none transition shrink-0"
              >
                <option value="all">Active</option>
                <option value="active">Active Status</option>
                <option value="inactive">Inactive</option>
              </select>
              <svg className="w-3.5 h-3.5 text-[#78716c] pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          {/* Add Employee Button */}
          <button
            type="button"
            onClick={handleOpenAddDrawer}
            className="flex items-center justify-center gap-1.5 bg-[#141010] text-white hover:bg-[#282320] active:scale-95 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer shrink-0 border border-[#282320]"
          >
            <PlusIcon className="w-4 h-4 text-white" />
            <span className="text-white font-semibold text-xs">Add employee</span>
          </button>
        </div>
      </div>

      {/* MAIN EMPLOYEE TABLE CARD */}
      <div className="rounded-xl border border-[#e7e5e4] bg-white shadow-sm overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[640px] text-left border-collapse table-fixed">
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[24%]" />
              <col className="w-[16%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-[#e7e5e4] bg-[#faf8f7]">
                <th className="py-3 px-3.5 text-[11px] font-semibold uppercase tracking-wider text-[#78716c] truncate">
                  EMPLOYEE
                </th>
                <th className="py-3 px-3.5 text-[11px] font-semibold uppercase tracking-wider text-[#78716c] truncate">
                  ROLES
                </th>
                <th className="py-3 px-3.5 text-[11px] font-semibold uppercase tracking-wider text-[#78716c] truncate">
                  JOINED
                </th>
                <th className="py-3 px-3.5 text-[11px] font-semibold uppercase tracking-wider text-[#78716c] truncate">
                  STATUS
                </th>
                <th className="py-3 px-3.5 text-[11px] font-semibold uppercase tracking-wider text-[#78716c] text-right truncate">
                  ACTION
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3efe]">
              {paginatedEmployees.length > 0 ? (
                paginatedEmployees.map((emp) => {
                  const isCurrentCaller = currentMembership?.userId === emp.userId;
                  const meta = getEmployeeDisplayMeta(emp);

                  const formattedJoined = emp.createdAt
                    ? new Date(emp.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "12 Aug 2024";

                  return (
                    <tr key={emp._id} className="transition-colors hover:bg-[#fdfbfb]">
                      {/* EMPLOYEE COLUMN */}
                      <td className="py-3.5 px-3.5 min-w-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1c1917] text-xs font-bold text-white border border-[#e7e5e4] shadow-xs">
                            {meta.initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-semibold text-xs text-[#1c1917] tracking-wide truncate">
                                {meta.name}
                              </span>
                              {isCurrentCaller && (
                                <span className="rounded bg-[#e7e5e4] px-1.5 py-0.2 text-[9px] font-semibold text-[#44403c] shrink-0">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#78716c] mt-0.5 truncate" title={emp.userId}>
                              {emp.userId}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* ROLES COLUMN */}
                      <td className="py-3.5 px-3.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {emp.userType.map((type) => {
                            const matchRole = STAFF_ROLE_CARDS.find((r) => r.key === type);
                            const matchMod = MODULE_ACCESS_CARDS.find((m) => m.key === type);
                            const label = matchRole?.label || matchMod?.label || type;
                            const isAdmin = type === "admin";

                            return (
                              <span
                                key={type}
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                                  isAdmin
                                    ? "bg-[#1c1917] text-white shadow-xs"
                                    : "bg-[#f5f5f4] border border-[#e7e5e4] text-[#44403c]"
                                }`}
                              >
                                {isAdmin && <ShieldAdminIcon className="w-3 h-3 text-white" />}
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      {/* JOINED COLUMN */}
                      <td className="py-3.5 px-3.5 text-xs text-[#57534e] whitespace-nowrap">
                        {formattedJoined}
                      </td>

                      {/* STATUS COLUMN */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                          Active
                        </span>
                      </td>

                      {/* ACTION COLUMN */}
                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingTarget(emp)}
                            className="p-1.5 text-[#78716c] hover:text-[#1c1917] hover:bg-[#f5f5f4] rounded-lg transition-colors cursor-pointer"
                            title="View Employee Details"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditDrawer(emp)}
                            className="p-1.5 text-[#78716c] hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Employee Roles & Permissions"
                          >
                            <EditIcon className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            disabled={isCurrentCaller}
                            onClick={() => setDeleteTarget({ id: emp._id, userId: emp.userId })}
                            className="p-1.5 text-[#78716c] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title={isCurrentCaller ? "You cannot remove yourself" : "Remove Employee"}
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#78716c]">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-2xl">👤</span>
                      <p className="text-xs font-semibold text-[#1c1917]">
                        {searchTerm || selectedRoleFilter !== "all"
                          ? "No employees match your search criteria."
                          : "No staff members found."}
                      </p>
                      <p className="text-[11px] text-[#78716c]">
                        Click "+ Add employee" to onboard your team to this organization.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER PAGINATION BAR */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#e7e5e4] bg-[#faf8f7]">
          <div className="text-xs text-[#78716c] font-medium">
            Showing {paginatedEmployees.length} of {filteredEmployees.length} employees
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 text-xs font-medium border border-[#e7e5e4] rounded-lg bg-white text-[#78716c] hover:bg-[#f5f5f4] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-xs font-semibold bg-[#141010] text-white rounded-lg">
              {currentPage}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 text-xs font-medium border border-[#e7e5e4] rounded-lg bg-white text-[#78716c] hover:bg-[#f5f5f4] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* VIEW EMPLOYEE SLIDE-OVER DRAWER (Matches Design Mockup) */}
      {/* ==================================================== */}
      {activeViewingDoc && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop Overlay */}
          <div
            onClick={() => setViewingTarget(null)}
            className="fixed inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity duration-300 opacity-100"
          />

          {/* View Drawer Panel */}
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[540px] bg-white shadow-2xl flex-col border-l border-neutral-200 transform transition-transform duration-300 ease-in-out translate-x-0">
            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-neutral-200 flex items-start justify-between bg-white shrink-0">
              <div>
                <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
                  Employee details
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Store staff profile, clearance, and assigned capabilities.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close drawer"
                onClick={() => setViewingTarget(null)}
                className="w-8 h-8 -mr-1 -mt-1 inline-flex items-center justify-center rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition focus:outline-none cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>
            </div>

            {/* Drawer Body Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {/* SECTION 1: PROFILE / AVATAR CARD */}
              {(() => {
                const meta = getEmployeeDisplayMeta(activeViewingDoc);
                const isAdmin = activeViewingDoc.userType.includes("admin");

                return (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl border border-neutral-200/90 bg-neutral-50/50 space-y-3.5">
                      <div className="flex items-start gap-3.5">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black text-white font-black text-base shadow-sm">
                          {meta.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-extrabold text-neutral-900 tracking-tight">
                              {meta.name}
                            </h3>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Active Employee
                            </span>
                          </div>

                          <div className="mt-1.5 space-y-1 text-xs text-neutral-600">
                            <div className="flex items-center gap-2 truncate">
                              <EnvelopeIcon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                              <span className="font-mono text-neutral-700">{meta.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <PhoneIcon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                              <span className="font-mono text-neutral-700">{meta.phone}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sole Administrator Banner */}
                      {isAdmin && (
                        <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-lg flex items-start gap-2 text-xs text-amber-900">
                          <LockIcon className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                          <div className="leading-snug">
                            <strong>Sole Administrator</strong> — This employee is the primary administrator. Assign Admin role to another employee before deactivating.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <hr className="border-neutral-200" />

              {/* SECTION 2: ASSIGNED ROLES */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                    ASSIGNED ROLES ({activeViewingDoc.userType.length})
                  </h3>
                  <span className="text-[11px] font-medium text-neutral-500">
                    Level 4 Clearance
                  </span>
                </div>

                <div className="space-y-2">
                  {activeViewingDoc.userType.map((roleKey) => {
                    const rObj = STAFF_ROLE_CARDS.find((c) => c.key === roleKey);
                    const mObj = MODULE_ACCESS_CARDS.find((c) => c.key === roleKey);
                    const label = rObj?.label || mObj?.label || roleKey;
                    const desc = rObj?.desc || mObj?.desc || "Assigned store operational module access.";
                    const badge = rObj?.badge || "ACTIVE MODULE";
                    const RoleIconComp = rObj?.icon || mObj?.icon || ShieldAdminIcon;

                    return (
                      <div
                        key={roleKey}
                        className="p-3.5 rounded-lg border border-neutral-200 bg-white space-y-1.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-neutral-900">{label}</span>
                            <span className="px-2 py-0.5 rounded bg-black text-white text-[10px] font-bold uppercase tracking-wide">
                              {badge}
                            </span>
                          </div>
                          <RoleIconComp className="w-4 h-4 text-neutral-500" />
                        </div>
                        <p className="text-xs text-neutral-500 leading-relaxed">{desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <hr className="border-neutral-200" />

              {/* SECTION 3: WHAT CAN THEY ACCESS? */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                    WHAT CAN THEY ACCESS?
                  </h3>
                  <span className="px-2 py-0.5 rounded bg-black text-white text-[10px] font-bold uppercase tracking-wide">
                    FULL ACCESS
                  </span>
                </div>

                <div className="p-3.5 bg-neutral-50/80 rounded-xl border border-neutral-200/90 space-y-2.5 text-xs text-neutral-700">
                  <div className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Store settings & business configuration</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Employee management, roles, and access control</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Cashier, billing, settlements, and payment gateways</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Menu items, categories, pricing, and tax rules</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Operational, sales, orders, and customer reports</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Workstations, KDS, and live operational screens</span>
                  </div>
                </div>
              </div>

              <hr className="border-neutral-200" />

              {/* SECTION 4: PERMISSIONS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                    PERMISSIONS
                  </h3>
                  <span className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                    <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{activeViewingDoc.userType.length * 2} Modules enabled</span>
                  </span>
                </div>

                <div className="p-3.5 bg-white border border-neutral-200 rounded-lg flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900">
                      Complete Master Control
                    </h4>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Create, Read, Update, Delete granted on all features
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsViewGranularOpen((prev) => !prev)}
                    className="text-xs font-semibold text-neutral-900 underline hover:text-black cursor-pointer"
                  >
                    {isViewGranularOpen ? "Hide granular matrix" : "View granular permissions (CRUD)"}
                  </button>
                </div>

                {isViewGranularOpen && (
                  <div className="border border-neutral-200 rounded-lg p-3 bg-neutral-50/40 text-[11px] text-neutral-500">
                    <div className="flex items-center justify-between font-semibold text-neutral-600 mb-2 uppercase text-[10px]">
                      <span>Granular CRUD Permissions Matrix</span>
                      <div className="flex gap-4 pr-1">
                        <span className="w-8 text-center">Create</span>
                        <span className="w-8 text-center">View</span>
                        <span className="w-8 text-center">Update</span>
                        <span className="w-8 text-center">Delete</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 font-normal">
                      {activeViewingDoc.userType.map((itemKey) => {
                        const rObj = STAFF_ROLE_CARDS.find((c) => c.key === itemKey);
                        const mObj = MODULE_ACCESS_CARDS.find((c) => c.key === itemKey);
                        const label = rObj?.label || mObj?.label || itemKey;
                        const perms = activeViewingDoc.userPermission?.[itemKey] || {
                          create: true,
                          read: true,
                          update: true,
                          delete: itemKey === "admin",
                        };

                        return (
                          <div key={itemKey} className="flex items-center justify-between py-1 border-b border-neutral-200/50 last:border-b-0">
                            <span className="text-neutral-800 font-medium text-xs">{label}</span>
                            <div className="flex gap-4 pr-1">
                              {(["create", "read", "update", "delete"] as const).map((act) => (
                                <span
                                  key={act}
                                  className={`w-8 text-center font-bold text-xs ${
                                    perms[act] ? "text-emerald-600" : "text-neutral-300"
                                  }`}
                                >
                                  {perms[act] ? "✓" : "—"}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Sticky Footer */}
            <div className="border-t border-neutral-200 bg-white px-6 py-4 flex items-center justify-between shrink-0">
              <button
                type="button"
                disabled={Boolean(currentMembership?._id === activeViewingDoc._id)}
                onClick={() => {
                  const docToDel = activeViewingDoc;
                  setViewingTarget(null);
                  setDeleteTarget({ id: docToDel._id, userId: docToDel.userId });
                }}
                className="px-3.5 py-2 text-xs font-medium text-rose-400 hover:text-rose-500 bg-white hover:bg-rose-50/60 rounded-xl border border-rose-200 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-2xs"
              >
                <TrashIcon className="w-3.5 h-3.5 text-rose-400" />
                <span>Deactivate employee</span>
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setViewingTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition focus:outline-none cursor-pointer shadow-2xs"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const docToEdit = activeViewingDoc;
                    setViewingTarget(null);
                    handleOpenEditDrawer(docToEdit);
                  }}
                  className="px-4.5 py-2 text-xs font-bold text-white bg-black hover:bg-neutral-800 active:scale-95 rounded-xl transition-all shadow-sm focus:outline-none cursor-pointer flex items-center gap-2 border border-black"
                >
                  <svg className="w-3.5 h-3.5 text-amber-400 fill-current shrink-0" viewBox="0 0 24 24">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                  </svg>
                  <span className="text-white font-bold text-xs tracking-wide">Edit employee</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ==================================================== */}
      {/* ADD / EDIT EMPLOYEE SLIDE-OVER DRAWER (Matches Design) */}
      {/* ==================================================== */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop Overlay */}
          <div
            onClick={handleCloseDrawer}
            className={`fixed inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity duration-300 ${
              isDrawerVisible ? "opacity-100" : "opacity-0"
            }`}
          />

          {/* Slide Over Drawer Container */}
          <aside
            className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[540px] bg-white shadow-2xl flex-col border-l border-neutral-200 transform transition-transform duration-300 ease-in-out ${
              isDrawerVisible ? "translate-x-0" : "translate-x-full"
            }`}
          >
            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-neutral-200 flex items-start justify-between bg-white shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
                    {drawerMode === "add" ? "Add employee" : "Edit employee"}
                  </h2>
                  {drawerMode === "edit" && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500">
                  {drawerMode === "add"
                    ? "Create a staff profile and assign the access they need."
                    : "Update staff profile, assigned roles, and access permissions."}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close drawer"
                onClick={handleCloseDrawer}
                className="w-8 h-8 -mr-1 -mt-1 inline-flex items-center justify-center rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition focus:outline-none cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {/* SECTION 1: EMPLOYEE DETAILS */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                    EMPLOYEE DETAILS
                  </h3>
                  {drawerMode === "edit" && formUserIdentifier && (
                    <span className="text-[11px] text-neutral-400 font-mono truncate max-w-[200px]" title={formUserIdentifier}>
                      ID: {formUserIdentifier}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-neutral-700" htmlFor="first-name">
                      First name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="first-name"
                      type="text"
                      value={formFirstName}
                      onChange={(e) => setFormFirstName(e.target.value)}
                      placeholder="e.g. John"
                      className="w-full text-sm rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 focus:border-black focus:ring-1 focus:ring-black transition"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-neutral-700" htmlFor="last-name">
                      Last name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="last-name"
                      type="text"
                      value={formLastName}
                      onChange={(e) => setFormLastName(e.target.value)}
                      placeholder="e.g. Doe"
                      className="w-full text-sm rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 focus:border-black focus:ring-1 focus:ring-black transition"
                    />
                  </div>
                </div>

                {/* Phone number input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-neutral-700" htmlFor="phone-number">
                    Phone number <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex rounded-md border border-neutral-300 overflow-hidden focus-within:border-black focus-within:ring-1 focus-within:ring-black bg-white transition">
                    <div className="flex items-center gap-1 bg-neutral-50 px-3 py-2 border-r border-neutral-200 text-xs text-neutral-700 select-none shrink-0 font-medium">
                      <span className="text-base leading-none">🇮🇳</span>
                      <span className="ml-1">{formCountryCode}</span>
                    </div>
                    <input
                      id="phone-number"
                      type="tel"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="95210 20647"
                      className="flex-1 text-sm border-0 bg-transparent px-3 py-2 focus:ring-0 text-neutral-900 font-mono tracking-wide focus:outline-none"
                    />
                  </div>
                </div>

                {/* User identifier / Email */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-neutral-700" htmlFor="user-identifier">
                    User identifier / Email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                      <EnvelopeIcon className="w-4 h-4" />
                    </div>
                    <input
                      id="user-identifier"
                      type="text"
                      disabled={drawerMode === "edit"}
                      value={formUserIdentifier}
                      onChange={(e) => setFormUserIdentifier(e.target.value)}
                      placeholder="e.g. clerk_user_id or name@restaurant.com"
                      className="w-full text-sm rounded-md border border-neutral-300 bg-white pl-9 pr-3 py-2 text-neutral-800 focus:border-black focus:ring-1 focus:ring-black transition disabled:bg-neutral-50 disabled:text-neutral-500"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-neutral-200" />

              {/* SECTION 2: STAFF ROLES (6 Explanatory Cards) */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                    STAFF ROLES
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Select one or more roles based on what this employee does.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {STAFF_ROLE_CARDS.map((card) => {
                    const isChecked = formRoles.includes(card.key);
                    const IconComp = card.icon;

                    return (
                      <label
                        key={card.key}
                        onClick={() => handleToggleItem(card.key)}
                        className={`flex flex-col justify-between p-3 rounded-lg cursor-pointer select-none transition ${
                          isChecked
                            ? "border-2 border-black bg-neutral-50 shadow-sm"
                            : "border border-neutral-200 hover:border-neutral-300 bg-white"
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-1.5">
                              <IconComp className={`w-4 h-4 ${isChecked ? "text-neutral-900" : "text-neutral-700"}`} />
                              <span className={`text-xs font-bold ${isChecked ? "text-neutral-900" : "text-neutral-800"}`}>
                                {card.label}
                              </span>
                            </div>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="h-4 w-4 rounded border-neutral-400 text-black focus:ring-black cursor-pointer"
                            />
                          </div>
                          <p className="text-[11px] text-neutral-600 mt-1.5 leading-tight">
                            {card.desc}
                          </p>
                        </div>
                        <div className="mt-2.5 text-[10px] uppercase tracking-tight">
                          <span className={`px-2 py-0.5 rounded font-semibold ${isChecked ? "bg-neutral-200/80 text-neutral-800" : "text-neutral-400"}`}>
                            {card.badge}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <hr className="border-neutral-200" />

              {/* SECTION 3: MODULE ACCESS (9 Specific Cards) */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                    MODULE ACCESS
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Give this employee access to additional POS modules.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {MODULE_ACCESS_CARDS.map((mod) => {
                    const isChecked = formRoles.includes(mod.key);
                    const ModIcon = mod.icon;

                    return (
                      <label
                        key={mod.key}
                        onClick={() => handleToggleItem(mod.key)}
                        className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer select-none transition ${
                          isChecked
                            ? "border-2 border-black bg-neutral-50 shadow-sm"
                            : "border border-neutral-200 hover:border-neutral-300 bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-black cursor-pointer"
                        />
                        <span className={`text-xs font-medium truncate ${isChecked ? "text-neutral-900 font-bold" : "text-neutral-700"}`}>
                          {mod.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <hr className="border-neutral-200" />

              {/* SECTION 4: SELECTED ACCESS SUMMARY */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                  SELECTED ACCESS
                </h3>
                <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {selectedRoles.map((rk) => {
                      const rObj = STAFF_ROLE_CARDS.find((c) => c.key === rk);
                      return (
                        <span key={rk} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-black text-white text-xs font-medium shadow-sm">
                          <span>{rObj?.label || rk}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${rObj?.label || rk} role`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleItem(rk);
                            }}
                            className="text-neutral-300 hover:text-white ml-0.5 focus:outline-none cursor-pointer"
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })}

                    {selectedModules.map((mk) => {
                      const mObj = MODULE_ACCESS_CARDS.find((c) => c.key === mk);
                      return (
                        <span key={mk} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-800 text-white text-xs font-medium shadow-sm">
                          <span>{mObj?.label || mk}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${mObj?.label || mk} module`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleItem(mk);
                            }}
                            className="text-neutral-300 hover:text-white ml-0.5 focus:outline-none cursor-pointer"
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })}
                  </div>

                  <div className="text-xs text-neutral-700 bg-white p-2.5 rounded border border-neutral-200/90 flex items-center gap-2">
                    <InfoIcon className="w-4 h-4 text-neutral-600 shrink-0" />
                    <div className="leading-relaxed">
                      Assigned as{" "}
                      <strong>
                        {selectedRoles.map((r) => STAFF_ROLE_CARDS.find((c) => c.key === r)?.label || r).join(", ") || "Staff"}
                      </strong>{" "}
                      with active{" "}
                      <strong>
                        {selectedModules.map((m) => MODULE_ACCESS_CARDS.find((c) => c.key === m)?.label || m).join(", ") || "standard"}
                      </strong>{" "}
                      management access.
                    </div>
                  </div>
                </div>
              </div>

              <hr className="border-neutral-200" />

              {/* SECTION 5: ADVANCED PERMISSIONS */}
              <div className="space-y-2.5">
                <div className="border border-neutral-200 rounded-lg p-3 bg-white flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                      ADVANCED PERMISSIONS
                    </h4>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Customize specific permissions when standard role access is not enough.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAdvancedOpen((prev) => !prev)}
                    className="px-2.5 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded border border-neutral-200 flex items-center gap-1.5 transition focus:outline-none shrink-0 ml-3 cursor-pointer"
                  >
                    <span>{isAdvancedOpen ? "Hide matrix" : "Customize permissions"}</span>
                    <span className="text-[10px] text-neutral-500">{isAdvancedOpen ? "▲" : "▾"}</span>
                  </button>
                </div>

                {isAdvancedOpen && (
                  <div className="border border-neutral-200 rounded-lg p-3 bg-neutral-50/40 text-[11px] text-neutral-500">
                    <div className="flex items-center justify-between font-semibold text-neutral-600 mb-2 uppercase text-[10px]">
                      <span>Module Override Matrix</span>
                      <div className="flex gap-4 pr-1">
                        <span className="w-8 text-center">Create</span>
                        <span className="w-8 text-center">View</span>
                        <span className="w-8 text-center">Update</span>
                        <span className="w-8 text-center">Delete</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 font-normal">
                      {formRoles.map((itemKey) => {
                        const rObj = STAFF_ROLE_CARDS.find((c) => c.key === itemKey);
                        const mObj = MODULE_ACCESS_CARDS.find((c) => c.key === itemKey);
                        const label = rObj?.label || mObj?.label || itemKey;
                        const perms = customPermissions[itemKey] || {
                          create: true,
                          read: true,
                          update: true,
                          delete: itemKey === "admin",
                        };

                        return (
                          <div key={itemKey} className="flex items-center justify-between py-1.5 border-b border-neutral-200/50 last:border-b-0">
                            <span className="text-neutral-800 font-medium text-xs">{label}</span>
                            <div className="flex gap-4 pr-1">
                              {(["create", "read", "update", "delete"] as const).map((act) => (
                                <button
                                  key={act}
                                  type="button"
                                  onClick={() => handleTogglePermission(itemKey, act)}
                                  className={`w-8 text-center font-bold text-xs cursor-pointer select-none rounded py-0.5 transition ${
                                    perms[act]
                                      ? "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                                      : "text-neutral-300 bg-neutral-100 hover:bg-neutral-200"
                                  }`}
                                >
                                  {perms[act] ? "✓" : "—"}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 6: DANGER ZONE (Only when editing) */}
              {drawerMode === "edit" && (
                <>
                  <hr className="border-neutral-200" />
                  <div className="p-3.5 bg-rose-50/40 border border-rose-200 rounded-lg flex items-center justify-between">
                    <div className="pr-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-rose-700 mb-0.5">
                        Danger Zone
                      </div>
                      <p className="text-[11px] text-neutral-600">
                        Deactivating this employee immediately revokes their access to this store.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(editingId && currentMembership?._id === editingId)}
                      onClick={() => {
                        if (editingId) {
                          setDeleteTarget({ id: editingId, userId: formUserIdentifier });
                          handleCloseDrawer();
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 border border-rose-300 hover:border-rose-400 bg-white rounded-md transition focus:outline-none flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <TrashIcon className="w-3.5 h-3.5 text-rose-600" />
                      <span>Deactivate employee</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Sticky Drawer Footer */}
            <div className="border-t border-neutral-200 bg-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="text-xs text-neutral-400">
                Changes apply across all store terminals.
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseDrawer}
                  className="px-4 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition focus:outline-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEmployee}
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-black hover:bg-neutral-800 rounded-md transition shadow-sm focus:outline-none disabled:opacity-40 cursor-pointer flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{drawerMode === "add" ? "Create employee" : "Save changes"}</span>
                  )}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setDeleteTarget(null)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs animate-fade-in"
          />

          <div className="relative w-full max-w-md rounded-xl border border-[#e7e5e4] bg-white p-6 shadow-2xl space-y-4 animate-scale-up z-10">
            <div className="flex items-center gap-3 text-red-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-xl border border-red-200">
                🗑️
              </div>
              <h3 className="font-garamond text-xl font-normal text-[#1c1917]">
                Remove Employee
              </h3>
            </div>

            <p className="text-xs text-[#78716c]">
              Are you sure you want to remove staff member{" "}
              <strong className="text-[#1c1917]">{deleteTarget.userId}</strong>? They will lose access to the store portal.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-9 rounded-xl border border-[#e7e5e4] bg-white px-4 text-xs font-medium text-[#1c1917] transition hover:bg-[#f5f5f4] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="h-9 rounded-xl bg-red-600 px-4 text-xs font-medium text-white shadow-sm transition hover:bg-red-700 disabled:opacity-40 cursor-pointer"
              >
                {isDeleting ? "Removing..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
