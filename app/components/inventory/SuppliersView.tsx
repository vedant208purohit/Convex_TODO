"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  COUNTRIES_MASTER,
  COUNTRY_OPTIONS,
  PHONE_CODE_OPTIONS,
  getStatesForCountry,
  getPhoneCodeForCountry,
  formatPhoneNumberWithCountryCode,
  getCountryMaster,
} from "@/lib/constants/countries";
import { ComingSoonOverlay } from "../ComingSoonOverlay";

function parseLocalPhoneDigits(
  rawPhone: string | undefined | null,
  dialCode: string = "+91"
): string {
  if (!rawPhone || !rawPhone.trim()) return "";
  let trimmed = rawPhone.trim();
  if (trimmed.startsWith("+")) {
    const match = PHONE_CODE_OPTIONS.find((opt) => trimmed.startsWith(opt.code));
    if (match) {
      trimmed = trimmed.slice(match.code.length).trim();
    }
  }
  const digits = trimmed.replace(/\D/g, "");
  const dialDigits = dialCode.replace(/\D/g, "");
  if (dialDigits && digits.startsWith(dialDigits) && digits.length > 10) {
    return digits.slice(dialDigits.length);
  }
  return digits.slice(0, 10);
}

export function SuppliersView({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations?.find((o) => o?._id === organizationId) || organizations?.[0];
  const orgCountryCode = activeOrg?.country || "IN";
  const orgPhoneCode = getPhoneCodeForCountry(orgCountryCode);

  const suppliers = useQuery(api.inventory.listSuppliers, { organizationId });
  const inventoryItems = useQuery(api.inventory.listInventoryItems, {
    organizationId,
  });

  const createSupplierMutation = useMutation(api.inventory.createSupplier);
  const updateSupplierMutation = useMutation(api.inventory.updateSupplier);
  const deleteSupplierMutation = useMutation(api.inventory.deleteSupplier);
  const assignItemsMutation = useMutation(api.inventory.assignItemsToSupplier);

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Sorting state
  const [sortField, setSortField] = useState<
    "supplierName" | "companyName" | null
  >(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | "view">(
    "create",
  );
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);

  // Delete Modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Assign Item Modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [supplierToAssign, setSupplierToAssign] = useState<any | null>(null);
  const [assignSearchQuery, setAssignSearchQuery] = useState("");
  const [tempAssignedItemIds, setTempAssignedItemIds] = useState<string[]>([]);
  const [assignedItemIdsMap, setAssignedItemIdsMap] = useState<
    Record<string, string[]>
  >({});

  const openAssignModal = (s: any) => {
    setSupplierToAssign(s);
    setAssignSearchQuery("");
    const existing = (inventoryItems ?? [])
      .filter((it: any) =>
        (it.supplierIds ?? []).some((id: any) => String(id) === String(s._id))
      )
      .map((it: any) => it._id);
    setTempAssignedItemIds(existing);
    setActiveMenuId(null);
    setIsAssignModalOpen(true);
  };

  const handleSaveAssignments = async () => {
    if (!supplierToAssign) return;
    try {
      await assignItemsMutation({
        organizationId,
        supplierId: supplierToAssign._id as Id<"suppliers">,
        itemIds: tempAssignedItemIds as Id<"inventoryItems">[],
      });
      setAssignedItemIdsMap((prev) => ({
        ...prev,
        [supplierToAssign._id]: tempAssignedItemIds,
      }));
    } catch (e) {
      console.error("Failed to assign items to supplier:", e);
    }
    setIsAssignModalOpen(false);
  };

  // Form State
  const [supplierName, setSupplierName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [email, setEmail] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [fssaiLicNumber, setFssaiLicNumber] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("India");
  const [state, setState] = useState("Gujarat");
  const [city, setCity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Validation Error States
  const [phoneError, setPhoneError] = useState("");
  const [whatsappError, setWhatsappError] = useState("");
  const [emailError, setEmailError] = useState("");

  const availableStates = useMemo(() => getStatesForCountry(country), [country]);

  // Filter items specifically assigned to the currently viewed supplier
  const supplierAssignedItems = useMemo(() => {
    if (!selectedSupplier || !inventoryItems) return [];
    return inventoryItems.filter((item: any) =>
      (item.supplierIds ?? []).some((id: any) => String(id) === String(selectedSupplier._id))
    );
  }, [selectedSupplier, inventoryItems]);

  // Active Dropdown menu state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number; openUp: boolean } | null>(null);

  useEffect(() => {
    if (!activeMenuId) return;
    const handleClose = () => {
      setActiveMenuId(null);
      setMenuPos(null);
    };
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [activeMenuId]);

  // Sorting Handler
  const handleSort = (field: "supplierName" | "companyName") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Filtered and Sorted List
  const filteredAndSortedSuppliers = useMemo(() => {
    if (!suppliers) return [];
    let list = [...suppliers];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.supplierName.toLowerCase().includes(q) ||
          (s.companyName && s.companyName.toLowerCase().includes(q)) ||
          (s.phoneNumber && s.phoneNumber.toLowerCase().includes(q)) ||
          (s.email && s.email.toLowerCase().includes(q)) ||
          (s.gstNumber && s.gstNumber.toLowerCase().includes(q)) ||
          (s.city && s.city.toLowerCase().includes(q)),
      );
    }

    // Sort
    if (sortField) {
      list.sort((a, b) => {
        const valA = (a[sortField] || "").toString().toLowerCase();
        const valB = (b[sortField] || "").toString().toLowerCase();
        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [suppliers, searchQuery, sortField, sortOrder]);

  // Paginated List
  const totalPages =
    Math.ceil(filteredAndSortedSuppliers.length / itemsPerPage) || 1;
  const paginatedSuppliers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedSuppliers.slice(start, start + itemsPerPage);
  }, [filteredAndSortedSuppliers, currentPage]);

  const openAddDrawer = () => {
    setSelectedSupplier(null);
    setDrawerMode("create");
    setSupplierName("");
    setCompanyName("");
    setPhoneNumber("");
    setWhatsappNumber("");
    setEmail("");
    setGstNumber("");
    setFssaiLicNumber("");
    setAddress("");
    const defaultCountry = activeOrg?.country || "India";
    const master = getCountryMaster(defaultCountry);
    const countryName = master?.name || defaultCountry;
    setCountry(countryName);
    const states = getStatesForCountry(countryName);
    setState(states[0]?.name || "Gujarat");
    setCity("");
    setPhoneError("");
    setWhatsappError("");
    setEmailError("");
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (s: any) => {
    setSelectedSupplier(s);
    setDrawerMode("edit");
    setSupplierName(s.supplierName || "");
    setCompanyName(s.companyName || "");
    const sCountry = s.country || activeOrg?.country || "India";
    const master = getCountryMaster(sCountry);
    const countryName = master?.name || sCountry;
    setCountry(countryName);
    setState(s.state || "Gujarat");
    const sDialCode = getPhoneCodeForCountry(countryName);
    setPhoneNumber(parseLocalPhoneDigits(s.phoneNumber, sDialCode));
    setWhatsappNumber(parseLocalPhoneDigits(s.whatsappNumber, sDialCode));
    setEmail(s.email || "");
    setGstNumber(s.gstNumber || "");
    setFssaiLicNumber(s.fssaiLicNumber || "");
    setAddress(s.address || "");
    setCity(s.city || "");
    setPhoneError("");
    setWhatsappError("");
    setEmailError("");
    setActiveMenuId(null);
    setIsDrawerOpen(true);
  };

  const openViewDrawer = (s: any) => {
    setSelectedSupplier(s);
    setDrawerMode("view");
    setActiveMenuId(null);
    setIsDrawerOpen(true);
  };

  const openDeleteModal = (s: any) => {
    setSupplierToDelete(s);
    setActiveMenuId(null);
    setIsDeleteModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let hasValidationError = false;

    if (!supplierName.trim()) {
      alert("Supplier name is required.");
      return;
    }
    if (!companyName.trim()) {
      alert("Company name is required.");
      return;
    }

    const currentDialCode = getPhoneCodeForCountry(country || orgCountryCode);
    const cleanPhoneDigits = phoneNumber.replace(/\D/g, "");
    if (cleanPhoneDigits) {
      if (cleanPhoneDigits.length !== 10) {
        setPhoneError("Please enter a valid 10-digit phone number.");
        hasValidationError = true;
      } else {
        setPhoneError("");
      }
    } else {
      setPhoneError("");
    }

    const cleanWhatsappDigits = whatsappNumber.replace(/\D/g, "");
    if (cleanWhatsappDigits) {
      if (cleanWhatsappDigits.length !== 10) {
        setWhatsappError("Please enter a valid 10-digit WhatsApp number.");
        hasValidationError = true;
      } else {
        setWhatsappError("");
      }
    } else {
      setWhatsappError("");
    }

    // Email address validation
    const cleanEmail = email.trim();
    if (cleanEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        setEmailError("Please enter a valid email address (e.g. name@example.com).");
        hasValidationError = true;
      } else {
        setEmailError("");
      }
    } else {
      setEmailError("");
    }

    if (hasValidationError) {
      return;
    }

    const fullPhone = cleanPhoneDigits ? `${currentDialCode}${cleanPhoneDigits}` : undefined;
    const fullWhatsapp = cleanWhatsappDigits ? `${currentDialCode}${cleanWhatsappDigits}` : undefined;

    setIsSubmitting(true);
    try {
      if (drawerMode === "edit" && selectedSupplier) {
        await updateSupplierMutation({
          id: selectedSupplier._id,
          supplierName: supplierName.trim(),
          companyName: companyName.trim() || undefined,
          phoneNumber: fullPhone,
          whatsappNumber: fullWhatsapp,
          email: email.trim() || undefined,
          gstNumber: gstNumber.trim() || undefined,
          fssaiLicNumber: fssaiLicNumber.trim() || undefined,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          country: country.trim() || undefined,
          state: state.trim() || undefined,
        });
      } else {
        await createSupplierMutation({
          organizationId,
          supplierName: supplierName.trim(),
          companyName: companyName.trim() || undefined,
          phoneNumber: fullPhone,
          whatsappNumber: fullWhatsapp,
          email: email.trim() || undefined,
          gstNumber: gstNumber.trim() || undefined,
          fssaiLicNumber: fssaiLicNumber.trim() || undefined,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          country: country.trim() || undefined,
          state: state.trim() || undefined,
        });
      }
      setIsDrawerOpen(false);
    } catch (err) {
      console.error("Failed to save supplier:", err);
      alert("Failed to save supplier profile. Please check details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!supplierToDelete) return;
    setIsDeleting(true);
    try {
      await deleteSupplierMutation({ id: supplierToDelete._id });
      setIsDeleteModalOpen(false);
      setSupplierToDelete(null);
    } catch (err) {
      console.error("Failed to delete supplier:", err);
      alert("Failed to delete supplier profile.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (suppliers === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-[#fbf9f8]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-stone-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-stone-500 font-medium">
            Loading suppliers directory...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#fbf9f8] p-6 md:p-8 space-y-6">
      {/* Page Title & Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#e7e5e4]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0c0a09] tracking-tight">
            Supplier
          </h1>
        </div>

        {/* Actions & Search */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="relative w-64 sm:w-80">
            <input
              type="text"
              className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-[#e7e5e4] rounded-lg focus:outline-none focus:border-stone-800 shadow-2xs"
              placeholder="Search by supplier name, company name"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
            <svg
              className="w-4 h-4 text-stone-400 absolute left-3 top-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <button
            type="button"
            onClick={openAddDrawer}
            className="px-4 py-2 bg-[#1c1917] hover:bg-[#292524] text-white !text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-2 shadow-2xs whitespace-nowrap"
          >
            <svg
              className="w-3.5 h-3.5 text-white stroke-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span className="text-white !text-white font-semibold">
              Add new supplier
            </span>
          </button>
        </div>
      </div>

      {/* Main Table / Empty State Container */}
      <div className="flex-1 flex flex-col">
        {filteredAndSortedSuppliers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#e7e5e4] rounded-2xl p-12 bg-white/50 text-center my-2">
            <div className="w-14 h-14 rounded-full bg-[#f5f5f4] border border-[#e7e5e4] flex items-center justify-center text-[#78716c] mb-4">
              <svg
                className="w-7 h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-[#0c0a09]">
              Your Supplier List is Empty!
            </h3>
            <p className="text-xs md:text-sm text-[#78716c] max-w-sm mt-1 mb-6">
              Start adding suppliers to enhance your sourcing options and track
              wholesale vendors.
            </p>
            <button
              type="button"
              onClick={openAddDrawer}
              className="px-4 py-2 bg-[#1c1917] hover:bg-[#292524] text-white !text-white text-xs font-semibold rounded-lg transition shadow-2xs cursor-pointer inline-flex items-center space-x-2"
            >
              <svg
                className="w-3.5 h-3.5 text-white stroke-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="text-white !text-white font-semibold">
                Add new supplier
              </span>
            </button>
          </div>
        ) : (
          <div className="bg-white border border-[#e7e5e4] rounded-xl shadow-2xs overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#e7e5e4] bg-[#fafaf9] text-[11px] font-semibold text-[#78716c]">
                    <th
                      className="py-3.5 px-6 cursor-pointer hover:text-[#0c0a09] transition select-none"
                      onClick={() => handleSort("supplierName")}
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>Supplier name</span>
                        {sortField === "supplierName" ? (
                          <span className="text-[#0c0a09] font-bold text-xs">
                            {sortOrder === "asc" ? "↑" : "↓"}
                          </span>
                        ) : (
                          <svg
                            className="w-3.5 h-3.5 text-[#a8a29e]"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                            />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th
                      className="py-3.5 px-6 cursor-pointer hover:text-[#0c0a09] transition select-none"
                      onClick={() => handleSort("companyName")}
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>Company name</span>
                        {sortField === "companyName" ? (
                          <span className="text-[#0c0a09] font-bold text-xs">
                            {sortOrder === "asc" ? "↑" : "↓"}
                          </span>
                        ) : (
                          <svg
                            className="w-3.5 h-3.5 text-[#a8a29e]"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                            />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th className="py-3.5 px-6 font-semibold">Phone no.</th>
                    <th className="py-3.5 px-6 font-semibold">GST number</th>
                    <th className="py-3.5 px-6 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f5f5f4] text-xs">
                  {paginatedSuppliers.map((s) => (
                    <tr
                      key={s._id}
                      className="hover:bg-[#fafaf9] transition-colors"
                    >
                      <td className="py-4 px-6">
                        <span
                          className="font-semibold text-[#0c0a09] hover:underline cursor-pointer text-xs"
                          onClick={() => openViewDrawer(s)}
                        >
                          {s.supplierName}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-[#44403c] font-medium text-xs">
                        {s.companyName || "—"}
                      </td>
                      <td className="py-4 px-6 text-[#57534e] text-xs">
                        {s.phoneNumber ? (
                          <div className="flex items-center space-x-2">
                            <span>
                              {formatPhoneNumberWithCountryCode(
                                s.phoneNumber,
                                getPhoneCodeForCountry((s as any).country || orgCountryCode)
                              )}
                            </span>
                            {s.whatsappNumber && (
                              <a
                                href={`https://wa.me/${s.whatsappNumber.replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-600 hover:text-emerald-700 text-[10px] font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200"
                                title="Chat on WhatsApp"
                                onClick={(e) => e.stopPropagation()}
                              >
                                WA
                              </a>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-4 px-6 text-[#57534e] text-xs">
                        {s.gstNumber || "—"}
                      </td>
                      <td className="py-4 px-6 text-right relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeMenuId === s._id) {
                              setActiveMenuId(null);
                              setMenuPos(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const spaceBelow = window.innerHeight - rect.bottom;
                              const openUp = spaceBelow < 220;
                              setMenuPos({
                                top: openUp ? rect.top - 6 : rect.bottom + 6,
                                right: window.innerWidth - rect.right,
                                openUp,
                              });
                              setActiveMenuId(s._id);
                            }
                          }}
                          className="text-[#78716c] hover:text-[#0c0a09] p-1.5 rounded-lg hover:bg-[#e7e5e4]/50 transition cursor-pointer"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>
                        {activeMenuId === s._id && menuPos && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(null);
                                setMenuPos(null);
                              }}
                            />
                            <div
                              className="fixed z-50 w-44 bg-white border border-[#e7e5e4] rounded-xl shadow-xl py-1.5 text-left text-xs"
                              style={{
                                top: menuPos.openUp ? undefined : `${menuPos.top}px`,
                                bottom: menuPos.openUp ? `${window.innerHeight - menuPos.top}px` : undefined,
                                right: `${menuPos.right}px`,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setMenuPos(null);
                                  openEditDrawer(s);
                                }}
                                className="w-full text-left px-3.5 py-2 text-stone-700 hover:bg-stone-50 transition cursor-pointer"
                              >
                                Edit supplier
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setMenuPos(null);
                                  openViewDrawer(s);
                                }}
                                className="w-full text-left px-3.5 py-2 text-stone-700 hover:bg-stone-50 transition cursor-pointer"
                              >
                                View supplier
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setMenuPos(null);
                                  openAssignModal(s);
                                }}
                                className="w-full text-left px-3.5 py-2 text-stone-700 hover:bg-stone-50 transition cursor-pointer"
                              >
                                Assign item
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setMenuPos(null);
                                  openDeleteModal(s);
                                }}
                                className="w-full text-left px-3.5 py-2 text-rose-600 hover:bg-rose-50 font-medium transition cursor-pointer"
                              >
                                Delete supplier
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="py-3.5 px-6 border-t border-[#e7e5e4] bg-[#fafaf9]/60 flex items-center justify-between text-xs text-[#78716c] shrink-0">
              <span>
                Showing{" "}
                <strong className="text-[#0c0a09]">
                  {filteredAndSortedSuppliers.length === 0
                    ? 0
                    : `${(currentPage - 1) * itemsPerPage + 1} - ${Math.min(
                        currentPage * itemsPerPage,
                        filteredAndSortedSuppliers.length
                      )}`}
                </strong>{" "}
                of{" "}
                <strong className="text-[#0c0a09]">
                  {filteredAndSortedSuppliers.length}
                </strong>{" "}
                suppliers
              </span>
              <div className="flex items-center space-x-2 text-xs">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 border border-[#e7e5e4] rounded-lg bg-white text-[#1c1917] hover:bg-[#f5f5f4] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs font-medium"
                >
                  Previous
                </button>
                <span className="px-2 font-medium text-[#0c0a09]">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  className="px-3 py-1 border border-[#e7e5e4] rounded-lg bg-white text-[#1c1917] hover:bg-[#f5f5f4] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs font-medium"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog Modal */}
      {isDeleteModalOpen && supplierToDelete && (
        <div className="fixed inset-0 bg-[#0c0a09]/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e7e5e4] rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-xl font-bold text-[#0c0a09]">
              Delete supplier
            </h3>
            <div className="space-y-1 text-xs text-[#57534e] bg-[#fafaf9] p-3 rounded-lg border border-[#e7e5e4]">
              <p>
                <span className="font-semibold text-[#0c0a09]">
                  Supplier name:
                </span>{" "}
                {supplierToDelete.supplierName}
              </p>
              <p>
                <span className="font-semibold text-[#0c0a09]">
                  Company name:
                </span>{" "}
                {supplierToDelete.companyName || "—"}
              </p>
            </div>
            <p className="text-xs text-[#78716c]">
              Are you sure you want to delete this supplier?
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-[#57534e] hover:text-[#0c0a09] border border-[#e7e5e4] rounded-lg hover:bg-[#f5f5f4] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition cursor-pointer shadow-2xs disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer Overlay Backdrop */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-[#0c0a09]/30 backdrop-blur-[2px] z-40 transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Slide-over Drawer for Add / Edit / View Supplier */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md md:max-w-lg bg-white border-l border-[#e7e5e4] shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* VIEW SUPPLIER DRAWER MODE */}
        {drawerMode === "view" && selectedSupplier ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="p-6 border-b border-[#e7e5e4] flex items-center justify-between bg-white shrink-0">
              <h2 className="text-xl font-bold text-[#0c0a09] tracking-tight">
                View Supplier
              </h2>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="text-[#78716c] hover:text-[#0c0a09] p-1.5 rounded-lg hover:bg-[#f5f5f4] transition cursor-pointer"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* View Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {/* Supplier Info Cards */}
              <div className="grid grid-cols-1 gap-4 bg-[#fafaf9] p-4 rounded-xl border border-[#e7e5e4]">
                <div>
                  <p className="text-[11px] font-medium text-[#78716c] uppercase">
                    Supplier name
                  </p>
                  <p className="font-semibold text-[#0c0a09] text-sm mt-0.5">
                    {selectedSupplier.supplierName}
                  </p>
                </div>
                {selectedSupplier.companyName && (
                  <div>
                    <p className="text-[11px] font-medium text-[#78716c] uppercase">
                      Company name
                    </p>
                    <p className="font-medium text-[#1c1917] mt-0.5">
                      {selectedSupplier.companyName}
                    </p>
                  </div>
                )}
                {selectedSupplier.phoneNumber && (
                  <div>
                    <p className="text-[11px] font-medium text-[#78716c] uppercase">
                      Phone no
                    </p>
                    <p className="text-xs text-[#1c1917] mt-0.5">
                      {formatPhoneNumberWithCountryCode(selectedSupplier.phoneNumber, getPhoneCodeForCountry(selectedSupplier.country || orgCountryCode))}
                    </p>
                  </div>
                )}
                {selectedSupplier.whatsappNumber && (
                  <div>
                    <p className="text-[11px] font-medium text-[#78716c] uppercase">
                      WhatsApp no
                    </p>
                    <p className="text-xs text-[#1c1917] mt-0.5">
                      {formatPhoneNumberWithCountryCode(selectedSupplier.whatsappNumber, getPhoneCodeForCountry(selectedSupplier.country || orgCountryCode))}
                    </p>
                  </div>
                )}
                {selectedSupplier.email && (
                  <div>
                    <p className="text-[11px] font-medium text-[#78716c] uppercase">
                      Email address
                    </p>
                    <p className="text-[#1c1917] mt-0.5">
                      {selectedSupplier.email}
                    </p>
                  </div>
                )}
                {selectedSupplier.gstNumber && (
                  <div>
                    <p className="text-[11px] font-medium text-[#78716c] uppercase">
                      GST no
                    </p>
                    <p className="text-xs text-[#1c1917] mt-0.5">
                      {selectedSupplier.gstNumber}
                    </p>
                  </div>
                )}
                {selectedSupplier.fssaiLicNumber && (
                  <div>
                    <p className="text-[11px] font-medium text-[#78716c] uppercase">
                      FSSAI Lic no
                    </p>
                    <p className="text-xs text-[#1c1917] mt-0.5">
                      {selectedSupplier.fssaiLicNumber}
                    </p>
                  </div>
                )}
                {selectedSupplier.city && (
                  <div>
                    <p className="text-[11px] font-medium text-[#78716c] uppercase">
                      City
                    </p>
                    <p className="text-[#1c1917] mt-0.5">
                      {selectedSupplier.city}
                    </p>
                  </div>
                )}
                {selectedSupplier.address && (
                  <div>
                    <p className="text-[11px] font-medium text-[#78716c] uppercase">
                      Address
                    </p>
                    <p className="text-[#1c1917] mt-0.5">
                      {selectedSupplier.address}
                    </p>
                  </div>
                )}
              </div>

              {/* Assigned Items Section */}
              <div className="space-y-3 pt-2">
                <div className="pb-1 border-b border-[#e7e5e4]">
                  <h4 className="text-base font-bold text-[#0c0a09]">
                    Assigned items ({supplierAssignedItems.length})
                  </h4>
                </div>

                {supplierAssignedItems.length > 0 ? (
                  <div className="border border-[#e7e5e4] rounded-lg overflow-hidden bg-white">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#fafaf9] text-[10px] uppercase font-semibold text-[#78716c] border-b border-[#e7e5e4]">
                          <th className="py-2.5 px-3">Item name</th>
                          <th className="py-2.5 px-3">SKU no</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e7e5e4] text-xs">
                        {supplierAssignedItems.map((item: any) => (
                          <tr key={item._id} className="hover:bg-[#fafaf9]">
                            <td className="py-2.5 px-3 font-medium text-[#0c0a09]">
                              {item.name}
                            </td>
                            <td className="py-2.5 px-3 text-[#78716c] text-[11px]">
                              {item.skuNumber || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 border border-dashed border-[#e7e5e4] rounded-lg text-center text-[#78716c]">
                    <p className="text-xs">No assigned items</p>
                  </div>
                )}
              </div>
            </div>

            {/* View Footer */}
            <div className="p-4 px-6 border-t border-[#e7e5e4] bg-[#fafaf9] flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#e7e5e4] text-[#57534e] hover:text-[#0c0a09] hover:bg-white text-xs font-semibold transition cursor-pointer shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          /* ADD / EDIT SUPPLIER DRAWER MODE */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="p-6 border-b border-[#e7e5e4] flex items-start justify-between bg-white shrink-0">
              <div>
                <h2 className="text-xl font-bold text-[#0c0a09] tracking-tight">
                  {drawerMode === "edit" ? "Edit Supplier" : "Add Supplier"}
                </h2>
                <p className="text-xs text-[#78716c] mt-0.5">
                  Save the details of the person or company you buy ingredients
                  from.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="text-[#78716c] hover:text-[#0c0a09] p-1.5 rounded-lg hover:bg-[#f5f5f4] transition cursor-pointer"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Drawer Form Body */}
            <form
              id="supplierForm"
              onSubmit={handleFormSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-6 text-xs"
            >
              {/* Group 1: Contact Details */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-1 border-b border-[#f5f5f4]">
                  <h4 className="text-[11px] font-semibold tracking-wider uppercase text-[#78716c]">
                    Contact Details
                  </h4>
                  <span className="text-[10px] text-[#a8a29e]">
                    * Required fields
                  </span>
                </div>

                <div>
                  <label className="block font-medium text-[#1c1917] mb-1">
                    Supplier name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] focus:border-[#0c0a09] focus:bg-white placeholder:text-[#a8a29e] transition"
                    placeholder="Enter supplier name"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#1c1917] mb-1">
                    Company name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] focus:border-[#0c0a09] focus:bg-white placeholder:text-[#a8a29e] transition"
                    placeholder="Enter company name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#1c1917] mb-1">
                    Phone no
                  </label>
                  <div
                    className={`flex rounded-lg border ${
                      phoneError
                        ? "border-rose-500 focus-within:ring-rose-500 focus-within:border-rose-500"
                        : "border-[#e7e5e4] focus-within:ring-[#0c0a09] focus-within:border-[#0c0a09]"
                    } bg-[#fbf9f8] hover:bg-white focus-within:bg-white focus-within:ring-1 transition overflow-hidden`}
                  >
                    <span className="inline-flex items-center px-3 py-2 bg-stone-100 border-r border-[#e7e5e4] text-xs font-medium text-stone-600 select-none whitespace-nowrap">
                      {getPhoneCodeForCountry(country || orgCountryCode)}
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      className="flex-1 px-3 py-2 bg-transparent text-xs text-[#0c0a09] placeholder:text-[#a8a29e] focus:outline-none"
                      placeholder="Enter 10-digit contact number"
                      value={phoneNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setPhoneNumber(val);
                        if (phoneError) setPhoneError("");
                      }}
                    />
                  </div>
                  {phoneError && (
                    <p className="text-[11px] text-rose-500 mt-1">{phoneError}</p>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-[#1c1917] mb-1">
                    WhatsApp no
                  </label>
                  <div
                    className={`flex rounded-lg border ${
                      whatsappError
                        ? "border-rose-500 focus-within:ring-rose-500 focus-within:border-rose-500"
                        : "border-[#e7e5e4] focus-within:ring-[#0c0a09] focus-within:border-[#0c0a09]"
                    } bg-[#fbf9f8] hover:bg-white focus-within:bg-white focus-within:ring-1 transition overflow-hidden`}
                  >
                    <span className="inline-flex items-center px-3 py-2 bg-stone-100 border-r border-[#e7e5e4] text-xs font-medium text-stone-600 select-none whitespace-nowrap">
                      {getPhoneCodeForCountry(country || orgCountryCode)}
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      className="flex-1 px-3 py-2 bg-transparent text-xs text-[#0c0a09] placeholder:text-[#a8a29e] focus:outline-none"
                      placeholder="Enter 10-digit WhatsApp number"
                      value={whatsappNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setWhatsappNumber(val);
                        if (whatsappError) setWhatsappError("");
                      }}
                    />
                  </div>
                  {whatsappError && (
                    <p className="text-[11px] text-rose-500 mt-1">{whatsappError}</p>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-[#1c1917] mb-1">
                    Email address
                  </label>
                  <input
                    type="email"
                    className={`w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border ${
                      emailError ? "border-rose-500 focus:ring-rose-500 focus:border-rose-500" : "border-[#e7e5e4] focus:ring-[#0c0a09] focus:border-[#0c0a09]"
                    } rounded-lg focus:outline-none focus:ring-1 focus:bg-white placeholder:text-[#a8a29e] transition`}
                    placeholder="Enter supplier email address"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError("");
                    }}
                  />
                  {emailError && (
                    <p className="text-[11px] text-rose-500 mt-1">{emailError}</p>
                  )}
                </div>
              </div>

              {/* Group 2: Business Details */}
              <div className="space-y-4 pt-2">
                <div className="pb-1 border-b border-[#f5f5f4]">
                  <h4 className="text-[11px] font-semibold tracking-wider uppercase text-[#78716c]">
                    Business Details
                  </h4>
                </div>

                <div>
                  <label className="block font-medium text-[#1c1917] mb-1">
                    GST No
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] focus:border-[#0c0a09] focus:bg-white placeholder:text-[#a8a29e] text-[#0c0a09] transition"
                    placeholder="Enter supplier GST number"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#1c1917] mb-1">
                    FSSAI Lic no
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] focus:border-[#0c0a09] focus:bg-white placeholder:text-[#a8a29e] text-[#0c0a09] transition"
                    placeholder="Enter supplier FSSAI license number"
                    value={fssaiLicNumber}
                    onChange={(e) => setFssaiLicNumber(e.target.value)}
                  />
                </div>
              </div>

              {/* Group 3: Registered Address */}
              <div className="space-y-4 pt-2">
                <div className="pb-1 border-b border-[#f5f5f4]">
                  <h4 className="text-[11px] font-semibold tracking-wider uppercase text-[#78716c]">
                    Registered Address
                  </h4>
                </div>

                <div>
                  <label className="block font-medium text-[#1c1917] mb-1">
                    Address
                  </label>
                  <textarea
                    rows={3}
                    className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] focus:border-[#0c0a09] focus:bg-white placeholder:text-[#a8a29e] transition resize-none"
                    placeholder="Enter supplier address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-[#1c1917] mb-1">
                      Country
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] focus:border-[#0c0a09] focus:bg-white text-[#0c0a09] transition"
                      value={country}
                      onChange={(e) => {
                        const newCountry = e.target.value;
                        setCountry(newCountry);
                        const states = getStatesForCountry(newCountry);
                        setState(states[0]?.name || "");
                      }}
                    >
                      {COUNTRY_OPTIONS.map((cName) => (
                        <option key={cName} value={cName}>
                          {cName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-[#1c1917] mb-1">
                      State
                    </label>
                    {availableStates.length > 0 ? (
                      <select
                        className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] focus:border-[#0c0a09] focus:bg-white text-[#0c0a09] transition"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                      >
                        {availableStates.map((st) => (
                          <option key={st.code} value={st.name}>
                            {st.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] focus:border-[#0c0a09] focus:bg-white placeholder:text-[#a8a29e] transition text-[#0c0a09]"
                        placeholder="Enter state"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-[#1c1917] mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] focus:border-[#0c0a09] focus:bg-white placeholder:text-[#a8a29e] transition"
                    placeholder="Enter your city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
              </div>
            </form>

            {/* Drawer Footer Actions */}
            <div className="p-4 px-6 border-t border-[#e7e5e4] bg-[#fafaf9] flex items-center justify-end space-x-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#e7e5e4] text-[#57534e] hover:text-[#0c0a09] hover:bg-white text-xs font-semibold transition cursor-pointer shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="supplierForm"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-[#0c0a09] hover:bg-[#292524] text-white !text-white text-xs font-semibold transition shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <span className="text-white !text-white font-semibold">
                  {isSubmitting
                    ? "Saving..."
                    : drawerMode === "edit"
                      ? "Update"
                      : "Create"}
                </span>
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Assign Item Modal */}
      {isAssignModalOpen && supplierToAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-mono text-[#78716c] uppercase">
                  INVENTORY ASSIGNMENT
                </span>
                <h3 className="text-xl font-bold text-[#0c0a09]">
                  Assign Items to {supplierToAssign.supplierName}
                </h3>
                <p className="text-xs text-[#78716c]">
                  {supplierToAssign.companyName ||
                    supplierToAssign.supplierName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded cursor-pointer"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search inventory items by name or SKU..."
                value={assignSearchQuery}
                onChange={(e) => setAssignSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#fafaf9] text-xs border border-[#e7e5e4] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0c0a09]"
              />
              <svg
                className="w-4 h-4 text-stone-400 absolute left-3 top-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* Item list selection */}
            <div className="max-h-60 overflow-y-auto border border-[#e7e5e4] rounded-xl divide-y divide-[#e7e5e4]/70 text-xs">
              {inventoryItems && inventoryItems.length > 0 ? (
                inventoryItems
                  .filter((item) => {
                    if (!assignSearchQuery.trim()) return true;
                    const q = assignSearchQuery.toLowerCase();
                    return (
                      item.name.toLowerCase().includes(q) ||
                      (item.skuNumber &&
                        item.skuNumber.toLowerCase().includes(q))
                    );
                  })
                  .map((item) => {
                    const isChecked = tempAssignedItemIds.includes(item._id);
                    return (
                      <label
                        key={item._id}
                        className={`flex items-center justify-between p-3 hover:bg-[#fafaf9] cursor-pointer transition ${
                          isChecked ? "bg-emerald-50/40" : ""
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setTempAssignedItemIds((prev) => [
                                  ...prev,
                                  item._id,
                                ]);
                              } else {
                                setTempAssignedItemIds((prev) =>
                                  prev.filter((id) => id !== item._id),
                                );
                              }
                            }}
                            className="rounded border-stone-300 cursor-pointer"
                          />
                          <div>
                            <p className="font-semibold text-[#0c0a09]">
                              {item.name}
                            </p>
                            <p className="text-[11px] text-stone-400 font-mono">
                              SKU: {item.skuNumber || "N/A"} • Unit:{" "}
                              {item.buyingUnit || "unit"}
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] font-medium text-stone-500">
                          Stock: {item.availableStock ?? 0}
                        </span>
                      </label>
                    );
                  })
              ) : (
                <div className="p-8 text-center text-stone-400 text-xs">
                  No inventory items found.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs pt-2">
              <span className="text-stone-500 font-medium">
                {tempAssignedItemIds.length} item(s) selected
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    if (inventoryItems) {
                      setTempAssignedItemIds(inventoryItems.map((i) => i._id));
                    }
                  }}
                  className="text-stone-600 hover:text-stone-900 underline text-[11px] cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-stone-300">|</span>
                <button
                  type="button"
                  onClick={() => setTempAssignedItemIds([])}
                  className="text-stone-600 hover:text-stone-900 underline text-[11px] cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#e7e5e4]">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#e7e5e4] text-[#57534e] hover:bg-stone-50 text-xs font-semibold cursor-pointer shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAssignments}
                className="px-4 py-2 rounded-lg bg-[#0c0a09] hover:bg-[#292524] text-white !text-white text-xs font-semibold shadow-2xs transition cursor-pointer"
              >
                Save Assignments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
