"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id, Doc } from "../../../convex/_generated/dataModel";

export interface FallbackAddressItem {
  _id: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  zipCode: string;
  addressType?: string;
  isDefault?: boolean;
  completeAddress?: string;
  deliveryInstructions?: string;
}

interface AddressDrawerProps {
  isOpen: boolean;
  customerId: Id<"customers"> | null;
  customerName: string;
  customerPhone?: string;
  fallbackAddresses?: FallbackAddressItem[];
  onClose: () => void;
}

export function AddressDrawer({
  isOpen,
  customerId,
  customerName,
  customerPhone,
  fallbackAddresses = [],
  onClose,
}: AddressDrawerProps) {
  const addresses = useQuery(
    api.userAddresses.getCustomerAddresses,
    customerId ? { customerId } : "skip",
  );

  const createAddressMutation = useMutation(
    api.userAddresses.createUserAddress,
  );
  const updateAddressMutation = useMutation(
    api.userAddresses.updateUserAddress,
  );
  const setDefaultAddressMutation = useMutation(
    api.userAddresses.setDefaultUserAddress,
  );
  const deleteAddressMutation = useMutation(
    api.userAddresses.deleteUserAddress,
  );

  // Address Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] =
    useState<Doc<"userAddresses"> | null>(null);

  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("Ahmedabad");
  const [zipCode, setZipCode] = useState("");
  const [addressType, setAddressType] = useState<"Home" | "Work" | "Other">(
    "Home",
  );
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayList = useMemo(() => {
    const dbList = (addresses || []) as any[];
    if (!fallbackAddresses || fallbackAddresses.length === 0) return dbList;

    const result = [...dbList];
    const seen = new Set(
      dbList.map(
        (a) =>
          `${(a.addressLine1 || "").toLowerCase().trim()}_${(a.city || "").toLowerCase().trim()}`,
      ),
    );

    for (const fb of fallbackAddresses) {
      const key = `${(fb.addressLine1 || "").toLowerCase().trim()}_${(fb.city || "").toLowerCase().trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(fb);
      }
    }

    return result;
  }, [addresses, fallbackAddresses]);

  if (!isOpen) return null;

  const handleOpenAdd = () => {
    setEditingAddress(null);
    setAddressLine1("");
    setAddressLine2("");
    setLandmark("");
    setCity("Ahmedabad");
    setZipCode("");
    setAddressType("Home");
    setDeliveryInstructions("");
    setIsDefault(addresses ? addresses.length === 0 : true);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (addr: Doc<"userAddresses">) => {
    setEditingAddress(addr);
    setAddressLine1(addr.addressLine1 || "");
    setAddressLine2(addr.addressLine2 || "");
    setLandmark(addr.landmark || "");
    setCity(addr.city || "Ahmedabad");
    setZipCode(addr.zipCode || "");
    setAddressType((addr.addressType as "Home" | "Work" | "Other") || "Home");
    setDeliveryInstructions(addr.deliveryInstructions || "");
    setIsDefault(!!addr.isDefault);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!customerId) {
      setFormError(
        "Guest customer record is not registered in DB yet. Save customer details first.",
      );
      return;
    }
    if (!addressLine1.trim()) {
      setFormError("Address line 1 is required.");
      return;
    }
    if (!city.trim()) {
      setFormError("City is required.");
      return;
    }
    if (!zipCode.trim()) {
      setFormError("Zip code is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingAddress) {
        await updateAddressMutation({
          id: editingAddress._id,
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          landmark: landmark.trim() || undefined,
          city: city.trim(),
          zipCode: zipCode.trim(),
          addressType,
          deliveryInstructions: deliveryInstructions.trim() || undefined,
          isDefault,
        });
      } else {
        await createAddressMutation({
          customerId,
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          landmark: landmark.trim() || undefined,
          city: city.trim(),
          zipCode: zipCode.trim(),
          addressType,
          deliveryInstructions: deliveryInstructions.trim() || undefined,
          isDefault,
        });
      }
      setIsSubmitting(false);
      setIsFormOpen(false);
    } catch (err: any) {
      setIsSubmitting(false);
      setFormError(err?.message || "Failed to save address.");
    }
  };

  const handleSetDefault = async (addressId: Id<"userAddresses">) => {
    try {
      await setDefaultAddressMutation({ id: addressId });
    } catch (err: any) {
      alert(err?.message || "Failed to set default address.");
    }
  };

  const handleDeleteAddress = async (addressId: Id<"userAddresses">) => {
    if (!confirm("Are you sure you want to delete this address?")) return;
    try {
      await deleteAddressMutation({ id: addressId });
    } catch (err: any) {
      alert(err?.message || "Failed to delete address.");
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-stone-900/40 backdrop-blur-xs transition-opacity duration-300 ${
        isOpen
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
      }`}
      onClick={onClose}
    >
      <div
        className={`h-full w-full max-w-md bg-[#fff8f5] shadow-2xl flex flex-col justify-between border-l border-[#e9e1dd] transform transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="px-6 pt-6 pb-4 bg-[#faf2ee]/70 border-b border-[#e9e1dd] flex items-start justify-between shrink-0">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 text-stone-500 font-mono text-[10px] uppercase tracking-wider font-semibold">
              <svg
                className="w-3.5 h-3.5 text-stone-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>CUSTOMER FOLIO</span>
            </div>
            <h2 className="font-serif text-2xl font-normal text-stone-900 mt-1">
              Addresses
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              Saved delivery and billing addresses for{" "}
              <span className="font-semibold text-stone-900">
                {customerName}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-[#e9e1dd] hover:bg-stone-100 flex items-center justify-center text-stone-600 transition-colors shadow-2xs cursor-pointer"
            aria-label="Close addresses drawer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          {isFormOpen ? (
            <form
              onSubmit={handleSaveAddress}
              className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col gap-3.5"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-stone-100">
                <h3 className="font-serif text-base font-medium text-stone-900">
                  {editingAddress ? "Edit Address" : "Add New Address"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-[11px] text-stone-500 hover:text-stone-900 uppercase tracking-wider font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {formError && (
                <div className="p-2.5 bg-rose-50 text-rose-700 text-xs rounded-xl font-medium border border-rose-200">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-mono font-semibold text-stone-500 uppercase tracking-wider mb-1">
                  Address Type
                </label>
                <div className="flex gap-2">
                  {(["Home", "Work", "Other"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAddressType(type)}
                      className={`flex-1 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                        addressType === type
                          ? "bg-stone-900 text-white border-stone-900"
                          : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-semibold text-stone-500 uppercase tracking-wider mb-1">
                  Address Line 1 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="Flat/House No., Building, Street"
                  className="w-full bg-stone-50 border border-stone-200 focus:border-stone-900 rounded-xl px-3 py-2 text-xs text-stone-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-semibold text-stone-500 uppercase tracking-wider mb-1">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Locality, Sector, Apartment name"
                  className="w-full bg-stone-50 border border-stone-200 focus:border-stone-900 rounded-xl px-3 py-2 text-xs text-stone-900 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-stone-500 uppercase tracking-wider mb-1">
                    Landmark
                  </label>
                  <input
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="e.g. Near Metro Station"
                    className="w-full bg-stone-50 border border-stone-200 focus:border-stone-900 rounded-xl px-3 py-2 text-xs text-stone-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-stone-500 uppercase tracking-wider mb-1">
                    City <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 focus:border-stone-900 rounded-xl px-3 py-2 text-xs text-stone-900 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-stone-500 uppercase tracking-wider mb-1">
                    Zip / PIN Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    placeholder="380054"
                    className="w-full bg-stone-50 border border-stone-200 focus:border-stone-900 rounded-xl px-3 py-2 text-xs font-mono text-stone-900 outline-none"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-700 font-medium">
                    <input
                      type="checkbox"
                      checked={isDefault}
                      onChange={(e) => setIsDefault(e.target.checked)}
                      className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                    />
                    Set as Default
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-semibold text-stone-500 uppercase tracking-wider mb-1">
                  Delivery Instructions
                </label>
                <textarea
                  rows={2}
                  value={deliveryInstructions}
                  onChange={(e) => setDeliveryInstructions(e.target.value)}
                  placeholder="Instructions for courier / rider..."
                  className="w-full bg-stone-50 border border-stone-200 focus:border-stone-900 rounded-xl px-3 py-2 text-xs text-stone-900 outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-full bg-stone-900 text-white font-semibold text-xs uppercase tracking-wider hover:bg-stone-800 transition-colors mt-2 cursor-pointer"
              >
                {isSubmitting ? "Saving Address..." : "Save Address"}
              </button>
            </form>
          ) : (
            <>
              {displayList.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-stone-200/80 shadow-2xs">
                  <div className="w-12 h-12 rounded-full bg-[#faf2ee] flex items-center justify-center text-stone-500 mx-auto mb-3">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                      />
                    </svg>
                  </div>
                  <h3 className="font-serif text-base text-stone-800 font-normal">
                    No Saved Addresses
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    No delivery addresses found for this guest.
                  </p>
                </div>
              ) : (
                displayList.map((addr) => {
                  const isDef = !!addr.isDefault;
                  const typeLabel = addr.addressType || "Home";
                  return (
                    <div
                      key={addr._id}
                      className={`p-4.5 rounded-2xl flex flex-col gap-2.5 relative transition-all ${
                        isDef
                          ? "bg-[#faf2ee] border border-[#e9e1dd] shadow-2xs"
                          : "bg-white border border-stone-200 shadow-2xs hover:border-stone-300"
                      }`}
                    >
                      {/* Top Header Row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-stone-700">
                            {typeLabel === "Work" ? (
                              <svg
                                className="w-4 h-4 text-stone-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                />
                              </svg>
                            ) : typeLabel === "Other" ? (
                              <svg
                                className="w-4 h-4 text-stone-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="w-4 h-4 text-stone-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                                />
                              </svg>
                            )}
                          </span>
                          <span className="font-semibold text-xs text-stone-900">
                            {typeLabel}
                          </span>
                        </div>

                        {isDef ? (
                          <span className="px-2 py-0.5 rounded bg-stone-900 text-white font-mono text-[9px] uppercase font-bold tracking-wider">
                            DEFAULT
                          </span>
                        ) : (
                          <span className="text-[11px] text-stone-500 font-medium">
                            Secondary
                          </span>
                        )}
                      </div>

                      {/* Complete Address & Details */}
                      <div className="flex flex-col gap-0.5 text-stone-800 text-xs">
                        <p className="leading-relaxed font-normal">
                          {addr.completeAddress ||
                            `${addr.addressLine1}${addr.addressLine2 ? ", " + addr.addressLine2 : ""}${
                              addr.landmark ? ", Near " + addr.landmark : ""
                            }`}
                        </p>
                        <p className="font-mono text-stone-500 text-xs mt-0.5">
                          {addr.city}, {addr.state || "Gujarat"} —{" "}
                          {addr.zipCode}
                        </p>
                      </div>

                      {addr.deliveryInstructions && (
                        <p className="text-[11px] text-amber-900 bg-amber-50/80 p-2 rounded-xl font-mono border border-amber-200/60">
                          📌 {addr.deliveryInstructions}
                        </p>
                      )}

                      {/* Footer Info & Edit/Delete Actions */}
                      <div className="pt-2 border-t border-stone-200/50 flex items-center justify-between text-xs">
                        <span className="font-mono text-stone-900 text-[11px]">
                          {customerPhone || "-"}
                        </span>
                        <div className="flex items-center gap-3">
                          {!isDef && (
                            <button
                              type="button"
                              onClick={() => handleSetDefault(addr._id)}
                              className="text-[11px] font-semibold text-stone-500 hover:text-stone-900 uppercase tracking-wider cursor-pointer"
                            >
                              Set Default
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(addr)}
                            className="text-[11px] font-semibold text-stone-500 hover:text-stone-900 uppercase tracking-wider cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAddress(addr._id)}
                            className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 uppercase tracking-wider cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-5 bg-[#faf2ee]/60 border-t border-[#e9e1dd] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-full bg-stone-900 text-white font-semibold text-xs uppercase tracking-wider hover:bg-stone-800 transition-colors text-center shadow-xs cursor-pointer"
          >
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );
}
