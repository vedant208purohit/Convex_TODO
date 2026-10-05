"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id, Doc } from "../../../convex/_generated/dataModel";
import { COUNTRY_DIAL_OPTIONS } from "../../../lib/constants/countries";

interface EditCustomerModalProps {
  isOpen: boolean;
  customer: Doc<"customers"> | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EditCustomerModal({
  isOpen,
  customer,
  onClose,
  onSuccess,
}: EditCustomerModalProps) {
  const updateCustomerMutation = useMutation(api.customers.updateCustomer);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [email, setEmail] = useState("");
  const [razorpayCustomerId, setRazorpayCustomerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (customer) {
      setFirstName(customer.firstName || "");
      setLastName(customer.lastName || "");
      setPhone(customer.phone || "");
      setCountryCode(customer.countryCode || "+91");
      setEmail(customer.email || "");
      setRazorpayCustomerId(customer.razorpayCustomerId || "");
      setError(null);
    }
  }, [customer]);

  if (!isOpen || !customer) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPhone = phone.replace(/[\s\-\(\)\/\+]/g, "");
    if (!cleanPhone || !/^\d+$/.test(cleanPhone)) {
      setError("Please enter a valid phone number containing digits only.");
      return;
    }
    if (cleanPhone.length < 7 || cleanPhone.length > 15) {
      setError("Phone number must be between 7 and 15 digits.");
      return;
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateCustomerMutation({
        id: customer._id,
        firstName: firstName.trim() || "",
        lastName: lastName.trim() || "",
        phone: cleanPhone,
        countryCode: countryCode.trim() || "+91",
        email: email.trim() || undefined,
        razorpayCustomerId: razorpayCustomerId.trim() || undefined,
      });

      setIsSubmitting(false);
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err?.message || "Failed to update customer record.");
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-5 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl font-medium text-stone-900">
              Edit Customer Profile
            </h2>
            <p className="text-xs text-stone-500 font-mono uppercase tracking-wider mt-0.5">
              Customer ID: {customer._id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 focus:border-stone-900 rounded-lg px-3 py-2 text-sm text-stone-900 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 focus:border-stone-900 rounded-lg px-3 py-2 text-sm text-stone-900 outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="bg-stone-50 border border-stone-200 focus:border-stone-900 rounded-lg px-2.5 py-2 text-xs font-mono font-medium text-stone-900 outline-none shrink-0"
              >
                {COUNTRY_DIAL_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 bg-stone-50 border border-stone-200 focus:border-stone-900 rounded-lg px-3 py-2 text-sm font-mono text-stone-900 outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 focus:border-stone-900 rounded-lg px-3 py-2 text-sm text-stone-900 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
              Razorpay Customer ID
            </label>
            <input
              type="text"
              value={razorpayCustomerId}
              onChange={(e) => setRazorpayCustomerId(e.target.value)}
              placeholder="e.g. cust_K93js8dks92"
              className="w-full bg-stone-50 border border-stone-200 focus:border-stone-900 rounded-lg px-3 py-2 text-sm font-mono text-stone-900 outline-none transition-colors"
            />
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-full bg-stone-900 text-white hover:bg-stone-800 text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Updating..." : "Update Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
