"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";

// SVG Icons for Actions & Controls
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

// Store Staff Roles Config with Permissions Meta
const STAFF_ROLES = [
  { key: "admin", label: "Admin", desc: "Full administrative access", permTitle: "Full Access", permDesc: "All modules unrestricted" },
  { key: "cashier", label: "Cashier", desc: "POS checkout & billing", permTitle: "Standard Cashier + Orders", permDesc: "Payment terminal & billing" },
  { key: "captain", label: "Captain", desc: "Table ordering captain", permTitle: "Floor Management", permDesc: "Tables, Captain app & Queue" },
  { key: "waiter", label: "Waiter", desc: "Floor service staff", permTitle: "Floor Operations", permDesc: "Order placement & tables" },
  { key: "chef", label: "Chef", desc: "Kitchen chef", permTitle: "Kitchen Operations", permDesc: "Order processing & KDS view" },
  { key: "worker", label: "Worker", desc: "General store staff", permTitle: "General Access", permDesc: "Basic store functions" },
  { key: "orders", label: "Orders", desc: "Order management", permTitle: "Order Management", permDesc: "Order fulfillment & edits" },
  { key: "menu", label: "Menu Editor", desc: "Menu management", permTitle: "Catalog Access", permDesc: "Menu & item management" },
  { key: "kds", label: "KDS", desc: "Kitchen display system", permTitle: "Kitchen View", permDesc: "KDS screen access" },
  { key: "queue", label: "Queue Manager", desc: "Waitlist & bookings", permTitle: "Queue Control", permDesc: "Waitlist & table seating" },
  { key: "inventory", label: "Inventory", desc: "Stock management", permTitle: "Stock Control", permDesc: "Inventory & stock audits" },
  { key: "report", label: "Reports", desc: "Sales reporting", permTitle: "Analytics", permDesc: "Sales & revenue reporting" },
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

  const [formUserId, setFormUserId] = useState("");
  const [formRoles, setFormRoles] = useState<string[]>(["cashier"]);
  const [isSaving, setIsSaving] = useState(false);

  // View Details Modal State
  const [viewingTarget, setViewingTarget] = useState<Doc<"organizationUsers"> | null>(null);

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{ id: Id<"organizationUsers">; userId: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Helper to derive name / initials / phone from user ID string
  const getEmployeeDisplayMeta = (emp: Doc<"organizationUsers">) => {
    const raw = emp.userId || "";
    let name = raw;
    let email = raw.includes("@") ? raw : "";
    let phone = "";

    // If userId contains format or clean email format
    if (raw.includes("@")) {
      const parts = raw.split("@")[0].split(/[._-]/);
      name = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
    } else if (raw.startsWith("user_")) {
      name = "Staff Member";
    }

    // Avatar initials
    const nameWords = name.trim().split(" ");
    let initials = "EM";
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
      return { title: `Customized (${userTypes.length} roles)`, desc: "Multiple module access" };
    }
    if (userTypes.length === 1) {
      const roleObj = STAFF_ROLES.find((r) => r.key === userTypes[0]);
      if (roleObj) return { title: roleObj.permTitle, desc: roleObj.permDesc };
    }
    if (userTypes.includes("cashier")) {
      return { title: "Standard Cashier + Orders", desc: "Payment terminal & billing" };
    }
    if (userTypes.includes("chef") || userTypes.includes("kds")) {
      return { title: "Kitchen Operations", desc: "Order processing & KDS view" };
    }
    if (userTypes.includes("captain") || userTypes.includes("waiter")) {
      return { title: "Floor Management", desc: "Tables & order placement" };
    }
    return { title: "Standard Staff Access", desc: "Assigned branch permissions" };
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
        (selectedStatusFilter === "active" ? true : false); // Currently all loaded organization users are active

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
    setFormUserId("");
    setFormRoles(["cashier"]);
    setErrorMessage(null);
    setIsDrawerOpen(true);
    setTimeout(() => setIsDrawerVisible(true), 20);
  };

  const handleOpenEditDrawer = (emp: Doc<"organizationUsers">) => {
    setDrawerMode("edit");
    setEditingId(emp._id);
    setFormUserId(emp.userId);
    setFormRoles(emp.userType.length > 0 ? emp.userType : ["cashier"]);
    setErrorMessage(null);
    setIsDrawerOpen(true);
    setTimeout(() => setIsDrawerVisible(true), 20);
  };

  const handleCloseDrawer = () => {
    setIsDrawerVisible(false);
    setTimeout(() => setIsDrawerOpen(false), 300);
  };

  const handleToggleRole = (roleKey: string) => {
    setFormRoles((prev) =>
      prev.includes(roleKey)
        ? prev.filter((r) => r !== roleKey)
        : [...prev, roleKey]
    );
  };

  const handleSaveEmployee = async () => {
    if (!formUserId.trim()) {
      setErrorMessage("Employee User ID or Email is required.");
      return;
    }
    if (formRoles.length === 0) {
      setErrorMessage("Please select at least one role for the employee.");
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      if (drawerMode === "add") {
        await createEmployeeMutation({
          userId: formUserId.trim(),
          userType: formRoles,
        });
        setSuccessMessage(`Employee "${formUserId.trim()}" added successfully!`);
      } else if (editingId) {
        await updateEmployeeMutation({
          id: editingId,
          userType: formRoles,
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

  return (
    <div className="space-y-6">
      {/* Toast Feedback Alerts */}
      {successMessage && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-5 py-3 text-xs text-emerald-800 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span className="font-medium">{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-900">
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
          <button type="button" onClick={() => setErrorMessage(null)} className="text-red-600 hover:text-red-900">
            ✕
          </button>
        </div>
      )}

      {/* TOP HEADER SECTION */}
      <div className="space-y-4">
        {/* Row 1: Title & Subtitle (Full Width) */}
        <div className="border-b border-[#e7e5e4] pb-4">
          <h2 className="font-garamond text-2xl lg:text-3xl text-[#141010] font-normal leading-tight">
            Employees
          </h2>
          <p className="text-xs text-[#78716c] mt-1">
            Manage store staff, assign branch roles, and configure system permissions.
          </p>
        </div>

        {/* Row 2: Control Bar (Search, Dropdowns & Add Employee Button) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#faf8f7] p-3 rounded-xl border border-[#e7e5e4]">
          {/* Left Controls: Search + Filters */}
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5 min-w-0">
            {/* Search Input */}
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
                  className="absolute right-2.5 top-2.5 text-[#a8a29e] hover:text-[#1c1917] text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Role Filter Dropdown */}
            <select
              value={selectedRoleFilter}
              onChange={(e) => {
                setSelectedRoleFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-[#e7e5e4] bg-white px-3 py-2 text-xs font-medium text-[#44403c] shadow-xs cursor-pointer focus:border-[#141010] focus:outline-none shrink-0"
            >
              <option value="all">All roles</option>
              {STAFF_ROLES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>

            {/* Status Filter Dropdown */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => {
                setSelectedStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-[#e7e5e4] bg-white px-3 py-2 text-xs font-medium text-[#44403c] shadow-xs cursor-pointer focus:border-[#141010] focus:outline-none shrink-0"
            >
              <option value="all">Active</option>
              <option value="active">Active Status</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Right Action: Add Employee Button */}
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
                          {/* Avatar Circle with initials */}
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
                            const match = STAFF_ROLES.find((r) => r.key === type);
                            const label = match?.label || type;
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
                          {/* View Button */}
                          <button
                            type="button"
                            onClick={() => setViewingTarget(emp)}
                            className="p-1.5 text-[#78716c] hover:text-[#1c1917] hover:bg-[#f5f5f4] rounded-lg transition-colors cursor-pointer"
                            title="View Employee Details"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditDrawer(emp)}
                            className="p-1.5 text-[#78716c] hover:text-[#1c1917] hover:bg-[#f5f5f4] rounded-lg transition-colors cursor-pointer"
                            title="Edit Employee Roles"
                          >
                            <EditIcon className="w-4 h-4" />
                          </button>

                          {/* Delete Button */}
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
              className="px-3 py-1 text-xs font-medium border border-[#e7e5e4] rounded-lg bg-white text-[#78716c] hover:bg-[#f5f5f4] transition disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="px-3 py-1 text-xs font-medium border border-[#e7e5e4] rounded-lg bg-white text-[#78716c] hover:bg-[#f5f5f4] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* VIEW DETAILS MODAL */}
      {viewingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setViewingTarget(null)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs animate-fade-in"
          />

          <div className="relative w-full max-w-md rounded-xl border border-[#e7e5e4] bg-white p-6 shadow-2xl space-y-4 animate-scale-up z-10">
            <div className="flex items-center justify-between border-b border-[#e7e5e4] pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1c1917] text-white font-bold text-sm">
                  {getEmployeeDisplayMeta(viewingTarget).initials}
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-[#1c1917]">
                    {getEmployeeDisplayMeta(viewingTarget).name}
                  </h3>
                  <p className="text-xs text-[#78716c]">{viewingTarget.userId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingTarget(null)}
                className="text-[#78716c] hover:text-[#1c1917] text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-[#78716c] uppercase tracking-wider text-[10px]">Assigned Roles</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {viewingTarget.userType.map((r) => (
                    <span key={r} className="bg-[#f5f5f4] border border-[#e7e5e4] text-[#44403c] px-2 py-0.5 rounded font-medium">
                      {STAFF_ROLES.find((sr) => sr.key === r)?.label || r}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="font-semibold text-[#78716c] uppercase tracking-wider text-[10px]">Permissions Summary</span>
                <p className="text-[#1c1917] font-medium mt-0.5">
                  {getPermissionSummary(viewingTarget.userType).title}
                </p>
                <p className="text-[#78716c]">
                  {getPermissionSummary(viewingTarget.userType).desc}
                </p>
              </div>

              <div>
                <span className="font-semibold text-[#78716c] uppercase tracking-wider text-[10px]">Account Status</span>
                <div className="mt-0.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Active Account
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingTarget(null)}
                className="px-4 py-1.5 text-xs font-medium bg-[#141010] text-white rounded-lg hover:bg-[#2e2824] transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT EMPLOYEE SIDE DRAWER OVERLAY */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            onClick={handleCloseDrawer}
            className={`fixed inset-0 bg-black/30 backdrop-blur-xs transition-opacity duration-300 ${
              isDrawerVisible ? "opacity-100" : "opacity-0"
            }`}
          />

          <aside
            className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-lg bg-white border-l border-[#e7e5e4] shadow-2xl flex-col justify-between transform transition-transform duration-300 ease-in-out ${
              isDrawerVisible ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#e7e5e4] bg-[#faf8f7]">
              <h2 className="font-garamond text-2xl text-[#141010] font-normal">
                {drawerMode === "add" ? "Add Employee" : "Edit Employee Roles"}
              </h2>
              <button
                type="button"
                onClick={handleCloseDrawer}
                className="rounded-full p-2 text-[#78716c] hover:text-[#1c1917] hover:bg-[#f5f5f4] transition"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Employee ID Input */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#78716c]">
                  Employee User ID / Email*
                </label>
                <input
                  type="text"
                  disabled={drawerMode === "edit"}
                  value={formUserId}
                  onChange={(e) => setFormUserId(e.target.value)}
                  placeholder="e.g. user_2pX9K... or john@store.com"
                  className="mt-2 w-full rounded-xl border border-[#e7e5e4] bg-[#faf8f7] px-4 py-2.5 text-xs text-[#1c1917] placeholder-[#a8a29e] transition focus:border-[#141010] focus:outline-none disabled:opacity-60"
                />
                <p className="mt-1 text-[11px] text-[#78716c]">
                  {drawerMode === "add"
                    ? "Enter the unique user ID or email of the staff member."
                    : "User ID cannot be changed once created."}
                </p>
              </div>

              {/* Roles Multi-Select Checkboxes */}
              <div className="space-y-3">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#78716c]">
                  Assign Store Roles*
                </label>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {STAFF_ROLES.map((role) => {
                    const isChecked = formRoles.includes(role.key);

                    return (
                      <label
                        key={role.key}
                        onClick={() => handleToggleRole(role.key)}
                        className={`flex items-start justify-between rounded-xl border p-3.5 cursor-pointer transition ${
                          isChecked
                            ? "border-[#141010] bg-[#faf8f7] shadow-xs"
                            : "border-[#e7e5e4] bg-white hover:bg-[#fafafa]"
                        }`}
                      >
                        <div className="pr-3">
                          <p className="text-xs font-semibold text-[#1c1917]">
                            {role.label}
                          </p>
                          <p className="text-[11px] text-[#78716c] mt-0.5">
                            {role.desc}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="h-4 w-4 mt-0.5 rounded border-[#e7e5e4] text-[#141010] focus:ring-[#141010]"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e7e5e4] bg-[#faf8f7]">
              <button
                type="button"
                onClick={handleCloseDrawer}
                className="h-9 rounded-xl border border-[#e7e5e4] bg-white px-5 text-xs font-medium text-[#1c1917] transition hover:bg-[#f5f5f4]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEmployee}
                disabled={isSaving}
                className="flex h-9 items-center justify-center rounded-xl bg-[#141010] px-5 text-xs font-medium text-white shadow-sm transition hover:bg-[#2e2824] disabled:opacity-40"
              >
                {isSaving ? "Saving..." : drawerMode === "add" ? "Add Employee" : "Save Changes"}
              </button>
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
                className="h-9 rounded-xl border border-[#e7e5e4] bg-white px-4 text-xs font-medium text-[#1c1917] transition hover:bg-[#f5f5f4]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="h-9 rounded-xl bg-red-600 px-4 text-xs font-medium text-white shadow-sm transition hover:bg-red-700 disabled:opacity-40"
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
