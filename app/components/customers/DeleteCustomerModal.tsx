"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc } from "../../../convex/_generated/dataModel";

interface DeleteCustomerModalProps {
  isOpen: boolean;
  customer: Doc<"customers"> | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DeleteCustomerModal({
  isOpen,
  customer,
  onClose,
  onSuccess,
}: DeleteCustomerModalProps) {
  const deleteCustomerMutation = useMutation(api.customers.deleteCustomer);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !customer) return null;

  const fullName = `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.phone;

  const handleDelete = async () => {
    setError(null);
    setIsDeleting(true);
    try {
      await deleteCustomerMutation({ id: customer._id });
      setIsDeleting(false);
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      setIsDeleting(false);
      setError(err?.message || "Failed to delete customer.");
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-5 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-lg font-medium text-red-900">
              Delete Customer
            </h2>
            <p className="text-xs text-stone-500 uppercase tracking-wider font-mono">
              Soft Deletion Confirmation
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

        <div className="p-6 flex flex-col gap-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
              {error}
            </div>
          )}

          <p className="text-sm text-stone-700 leading-relaxed">
            Are you sure you want to remove <span className="font-semibold text-stone-900">{fullName}</span> (+{customer.phone})? This will archive the guest record.
          </p>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-5 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : "Delete Customer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
