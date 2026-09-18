"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

export function SuppliersView({ organizationId }: { organizationId: Id<"organizations"> }) {
  const suppliers = useQuery(api.inventory.listSuppliers, { organizationId });
  const createSupplierMutation = useMutation(api.inventory.createSupplier);
  const updateSupplierMutation = useMutation(api.inventory.updateSupplier);
  const deleteSupplierMutation = useMutation(api.inventory.deleteSupplier);

  const [searchQuery, setSearchQuery] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);

  // Form State matching backend args exactly
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

  // Active Dropdown menu state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Filtered List
  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];
    if (!searchQuery.trim()) return suppliers;
    const q = searchQuery.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.supplierName.toLowerCase().includes(q) ||
        (s.companyName && s.companyName.toLowerCase().includes(q)) ||
        (s.phoneNumber && s.phoneNumber.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.gstNumber && s.gstNumber.toLowerCase().includes(q)) ||
        (s.city && s.city.toLowerCase().includes(q))
    );
  }, [suppliers, searchQuery]);

  const openAddDrawer = () => {
    setEditingSupplier(null);
    setSupplierName("");
    setCompanyName("");
    setPhoneNumber("");
    setWhatsappNumber("");
    setEmail("");
    setGstNumber("");
    setFssaiLicNumber("");
    setAddress("");
    setCountry("India");
    setState("Gujarat");
    setCity("");
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (s: any) => {
    setEditingSupplier(s);
    setSupplierName(s.supplierName || "");
    setCompanyName(s.companyName || "");
    setPhoneNumber(s.phoneNumber || "");
    setWhatsappNumber(s.whatsappNumber || "");
    setEmail(s.email || "");
    setGstNumber(s.gstNumber || "");
    setFssaiLicNumber(s.fssaiLicNumber || "");
    setAddress(s.address || "");
    setCity(s.city || "");
    setActiveMenuId(null);
    setIsDrawerOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      alert("Supplier name is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingSupplier) {
        // Backend updateSupplier args: { id, supplierName, companyName, phoneNumber, email, address, city }
        await updateSupplierMutation({
          id: editingSupplier._id,
          supplierName: supplierName.trim(),
          companyName: companyName.trim() || undefined,
          phoneNumber: phoneNumber.trim() || undefined,
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
        });
      } else {
        // Backend createSupplier args: { organizationId, supplierName, companyName, phoneNumber, whatsappNumber, email, gstNumber, fssaiLicNumber, address, city }
        await createSupplierMutation({
          organizationId,
          supplierName: supplierName.trim(),
          companyName: companyName.trim() || undefined,
          phoneNumber: phoneNumber.trim() || undefined,
          whatsappNumber: whatsappNumber.trim() || undefined,
          email: email.trim() || undefined,
          gstNumber: gstNumber.trim() || undefined,
          fssaiLicNumber: fssaiLicNumber.trim() || undefined,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
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

  const handleDelete = async (id: Id<"suppliers">) => {
    if (!confirm("Are you sure you want to delete this supplier profile?")) return;
    try {
      await deleteSupplierMutation({ id });
      setActiveMenuId(null);
    } catch (err) {
      console.error("Failed to delete supplier:", err);
      alert("Failed to delete supplier profile.");
    }
  };

  if (suppliers === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-[#fbf9f8]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-stone-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-stone-500 font-medium">Loading suppliers directory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#fbf9f8] p-8">
      {/* Page Title & Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#e7e5e4]/70">
        <div>
          <h1 className="font-serif text-3xl md:text-[32px] text-[#0c0a09] font-medium tracking-tight">Suppliers</h1>
          <p className="text-xs md:text-sm text-[#78716c] mt-0.5">Manage the people and companies you buy ingredients from.</p>
        </div>

        {/* Actions & Search */}
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <svg
              className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a8a29e]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              className="w-full pl-9.5 pr-4 py-2 bg-white text-xs text-[#1c1917] border border-[#e7e5e4] rounded-full focus:outline-none focus:ring-1 focus:ring-[#0c0a09] focus:border-[#0c0a09] placeholder:text-[#a8a29e] transition shadow-2xs"
              placeholder="Search by supplier or company name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={openAddDrawer}
            className="inline-flex items-center space-x-2 bg-[#0c0a09] hover:bg-[#292524] text-white !text-white text-xs font-medium px-4 py-2.5 rounded-full transition shadow-sm cursor-pointer whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5 text-white stroke-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-white !text-white font-medium">+ Add Supplier</span>
          </button>
        </div>
      </div>

      {/* Main Table / Empty State Container */}
      <div className="mt-6 flex-1 flex flex-col overflow-hidden">
        {filteredSuppliers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#e7e5e4] rounded-2xl p-12 bg-white/50 text-center my-2">
            <div className="w-14 h-14 rounded-full bg-[#f5f5f4] border border-[#e7e5e4] flex items-center justify-center text-[#78716c] mb-4">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="font-serif text-2xl font-medium text-[#0c0a09]">No suppliers yet</h3>
            <p className="text-xs md:text-sm text-[#78716c] max-w-sm mt-1 mb-6">
              Add a supplier before creating a purchase order to replenish ingredients and track wholesale vendors.
            </p>
            <button
              type="button"
              onClick={openAddDrawer}
              className="inline-flex items-center space-x-2 bg-[#0c0a09] hover:bg-[#292524] text-white !text-white text-xs font-medium px-5 py-2.5 rounded-full transition shadow-sm cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-white stroke-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-white !text-white font-medium">Add Supplier</span>
            </button>
          </div>
        ) : (
          <div className="bg-white border border-[#e7e5e4] rounded-xl shadow-xs overflow-hidden flex flex-col flex-1">
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#e7e5e4] bg-[#fafaf9]/80 text-[11px] uppercase tracking-wider text-[#78716c] font-medium sticky top-0 bg-white z-10">
                    <th className="py-3 px-5 font-normal">
                      <div className="flex items-center space-x-1 cursor-pointer hover:text-[#0c0a09]">
                        <span>Supplier</span>
                        <svg className="w-3 h-3 text-[#0c0a09]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </th>
                    <th className="py-3 px-5 font-normal">
                      <div className="flex items-center space-x-1 cursor-pointer hover:text-[#0c0a09]">
                        <span>Company</span>
                        <svg className="w-3 h-3 text-[#d6d3d1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                      </div>
                    </th>
                    <th className="py-3 px-5 font-normal">Phone</th>
                    <th className="py-3 px-5 font-normal">GST Number</th>
                    <th className="py-3 px-5 text-right font-normal">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7e5e4]/70 text-xs">
                  {filteredSuppliers.map((s) => (
                    <tr key={s._id} className="hover:bg-[#fafaf9] transition-colors group">
                      <td className="py-4 px-5">
                        <div className="flex items-center space-x-3">
                          <div className="w-7 h-7 rounded-full bg-[#f5f5f4] text-[#44403c] border border-[#e7e5e4] flex items-center justify-center font-serif font-medium text-xs shrink-0">
                            {s.supplierName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-[#0c0a09]">{s.supplierName}</p>
                            <p className="text-[11px] text-[#a8a29e]">
                              {s.email || (s.city ? `City: ${s.city}` : "Primary contact")}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-[#44403c] font-medium">{s.companyName || "—"}</td>
                      <td className="py-4 px-5 text-[#57534e] font-mono text-[11px]">
                        {s.phoneNumber ? (
                          <div className="flex items-center space-x-2">
                            <span>{s.phoneNumber}</span>
                            {s.whatsappNumber && (
                              <a
                                href={`https://wa.me/${s.whatsappNumber.replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-600 hover:text-emerald-700 text-[10px] font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200"
                                title="Chat on WhatsApp"
                              >
                                WA
                              </a>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-4 px-5">
                        {s.gstNumber ? (
                          <span className="inline-block font-mono text-[11px] bg-[#f5f5f4] text-[#44403c] px-2 py-0.5 rounded border border-[#e7e5e4]">
                            {s.gstNumber}
                          </span>
                        ) : (
                          <span className="text-[#a8a29e]">—</span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-right relative">
                        <button
                          type="button"
                          onClick={() => setActiveMenuId(activeMenuId === s._id ? null : s._id)}
                          className="text-[#78716c] hover:text-[#0c0a09] p-1.5 rounded hover:bg-[#e7e5e4]/50 transition cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>
                        {activeMenuId === s._id && (
                          <div className="absolute right-5 top-12 w-36 bg-white border border-[#e7e5e4] rounded-lg shadow-lg py-1 z-30 text-left">
                            <button
                              type="button"
                              onClick={() => openEditDrawer(s)}
                              className="w-full text-left px-3 py-1.5 text-xs text-[#0c0a09] hover:bg-[#fafaf9] cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(s._id)}
                              className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="py-3.5 px-5 border-t border-[#e7e5e4] bg-[#fafaf9]/50 flex items-center justify-between text-xs text-[#78716c] shrink-0">
              <span>
                Showing <strong className="text-[#0c0a09]">{filteredSuppliers.length}</strong> registered suppliers
              </span>
              <div className="flex items-center space-x-2 text-xs">
                <button disabled className="px-2.5 py-1 border border-[#e7e5e4] rounded bg-white text-[#a8a29e] cursor-not-allowed">
                  Previous
                </button>
                <button disabled className="px-2.5 py-1 border border-[#e7e5e4] rounded bg-white text-[#a8a29e] cursor-not-allowed">
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drawer Overlay Backdrop */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-[#0c0a09]/30 backdrop-blur-[2px] z-40 transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Slide-over Drawer for Add / Edit Supplier */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md md:max-w-lg bg-white border-l border-[#e7e5e4] shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-[#e7e5e4] flex items-start justify-between bg-white shrink-0">
          <div>
            <h2 className="font-serif text-2xl text-[#0c0a09] font-medium tracking-tight">
              {editingSupplier ? "Edit Supplier" : "Add Supplier"}
            </h2>
            <p className="text-xs text-[#78716c] mt-0.5">Save the details of the person or company you buy ingredients from.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            className="text-[#78716c] hover:text-[#0c0a09] p-1.5 rounded-full hover:bg-[#f5f5f4] transition cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer Form Body */}
        <form id="supplierForm" onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Group 1: Contact Details */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-[#f5f5f4]">
              <h4 className="font-mono text-[11px] font-semibold tracking-wider uppercase text-[#78716c]">Contact Details</h4>
              <span className="text-[10px] text-[#a8a29e]">* Required fields</span>
            </div>

            <div>
              <label className="block font-medium text-[#1c1917] mb-1">
                Supplier name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] focus:border-[#0c0a09] focus:bg-white placeholder:text-[#a8a29e] transition"
                placeholder="Name of the person you usually contact"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
              />
            </div>

            <div>
              <label className="block font-medium text-[#1c1917] mb-1">Company name</label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] focus:border-[#0c0a09] focus:bg-white placeholder:text-[#a8a29e] transition"
                placeholder="Business or company name, if available"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            <div>
              <label className="block font-medium text-[#1c1917] mb-1">Phone number</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-[#e7e5e4] bg-[#f5f5f4] text-[#57534e] text-xs font-mono">
                  🇮🇳 +91
                </span>
                <input
                  type="tel"
                  className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-r-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] focus:border-[#0c0a09] focus:bg-white placeholder:text-[#a8a29e] transition font-mono"
                  placeholder="98765 43210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
            </div>

            {!editingSupplier && (
              <div>
                <label className="block font-medium text-[#1c1917] mb-1">WhatsApp number</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-[#e7e5e4] bg-[#f5f5f4] text-[#57534e] text-xs font-mono">
                    🇮🇳 +91
                  </span>
                  <input
                    type="tel"
                    className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-r-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] focus:border-[#0c0a09] focus:bg-white placeholder:text-[#a8a29e] transition font-mono"
                    placeholder="98765 43210"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block font-medium text-[#1c1917] mb-1">Email address</label>
              <input
                type="email"
                className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] focus:border-[#0c0a09] focus:bg-white placeholder:text-[#a8a29e] transition"
                placeholder="name@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Group 2: Business Details */}
          {!editingSupplier && (
            <div className="space-y-4 pt-2">
              <div className="pb-1 border-b border-[#f5f5f4]">
                <h4 className="font-mono text-[11px] font-semibold tracking-wider uppercase text-[#78716c]">Business Details</h4>
              </div>

              <div>
                <label className="block font-medium text-[#1c1917] mb-1">GST number</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 uppercase bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] focus:border-[#0c0a09] focus:bg-white placeholder:text-[#a8a29e] transition font-mono"
                  placeholder="Enter supplier GST number"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-medium text-[#1c1917] mb-1">FSSAI license number</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] focus:border-[#0c0a09] focus:bg-white placeholder:text-[#a8a29e] transition font-mono"
                  placeholder="Enter supplier FSSAI license number"
                  value={fssaiLicNumber}
                  onChange={(e) => setFssaiLicNumber(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Group 3: Registered Address */}
          <div className="space-y-4 pt-2">
            <div className="pb-1 border-b border-[#f5f5f4]">
              <h4 className="font-mono text-[11px] font-semibold tracking-wider uppercase text-[#78716c]">Registered Address</h4>
            </div>

            <div>
              <label className="block font-medium text-[#1c1917] mb-1">Address</label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] focus:border-[#0c0a09] focus:bg-white placeholder:text-[#a8a29e] transition resize-none"
                placeholder="Enter complete supplier address, unit, building..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-[#1c1917] mb-1">Country</label>
                <select
                  className="w-full px-3 py-2 bg-[#fbf9f8] text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09]"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  <option value="India">India</option>
                  <option value="United Arab Emirates">United Arab Emirates</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="United States">United States</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-[#1c1917] mb-1">State</label>
                <select
                  className="w-full px-3 py-2 bg-[#fbf9f8] text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09]"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                >
                  <option value="Gujarat">Gujarat</option>
                  <option value="Maharashtra">Maharashtra</option>
                  <option value="Karnataka">Karnataka</option>
                  <option value="Delhi">Delhi</option>
                  <option value="Rajasthan">Rajasthan</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-medium text-[#1c1917] mb-1">City</label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-[#fbf9f8] hover:bg-white text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0c0a09] focus:border-[#0c0a09] focus:bg-white placeholder:text-[#a8a29e] transition"
                placeholder="e.g. Ahmedabad"
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
            className="px-5 py-2.5 rounded-full border border-[#e7e5e4] text-[#57534e] hover:text-[#0c0a09] hover:bg-white text-xs font-medium transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="supplierForm"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-full bg-[#0c0a09] hover:bg-[#292524] text-white !text-white text-xs font-medium transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            <span className="text-white !text-white font-medium">
              {isSubmitting ? "Saving..." : editingSupplier ? "Update Supplier" : "Save Supplier"}
            </span>
          </button>
        </div>
      </aside>
    </div>
  );
}
