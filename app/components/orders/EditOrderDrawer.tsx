"use client";

import React, { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface EditOrderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onSuccess?: (message: string) => void;
}

export default function EditOrderDrawer({
  isOpen,
  onClose,
  order,
  onSuccess,
}: EditOrderDrawerProps) {
  const updateOrderCustomer = useMutation(api.orders.updateOrderCustomer);
  const deleteMultipleOrderItems = useMutation(api.orders.deleteMultipleOrderItems);

  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Item Checkbox State
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Populate initial values when drawer opens or order changes
  useEffect(() => {
    if (order) {
      const nameParts = (order.customerName || "").trim().split(" ");
      if (nameParts.length > 1) {
        setFirstName(nameParts[0]);
        setLastName(nameParts.slice(1).join(" "));
      } else {
        setFirstName(order.customerName || "");
        setLastName("");
      }

      const rawPhone = (order.customerPhone || "").trim();
      if (rawPhone.startsWith("+91")) {
        setCountryCode("+91");
        setPhone(rawPhone.replace(/^\+91\s*/, ""));
      } else if (rawPhone.startsWith("+1")) {
        setCountryCode("+1");
        setPhone(rawPhone.replace(/^\+1\s*/, ""));
      } else {
        setCountryCode("+91");
        setPhone(rawPhone);
      }

      setPhoneError(null);
      setSelectedItemIds(new Set());
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const items = order.items || [];

  const handleToggleItem = (itemId: string) => {
    const next = new Set(selectedItemIds);
    if (next.has(itemId)) {
      next.delete(itemId);
    } else {
      next.add(itemId);
    }
    setSelectedItemIds(next);
  };

  const handleToggleAll = () => {
    if (selectedItemIds.size === items.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(items.map((i: any) => i._id)));
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);

    const cleanPhone = phone.trim();
    if (cleanPhone && cleanPhone.replace(/\D/g, "").length < 10) {
      setPhoneError("At least 10 digits are required");
      return;
    }

    const fullCustomerName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    const fullPhone = cleanPhone ? `${countryCode} ${cleanPhone}` : "";

    setIsUpdating(true);
    try {
      await updateOrderCustomer({
        orderId: order._id as Id<"orders">,
        customerName: fullCustomerName || undefined,
        customerPhone: fullPhone || undefined,
      });

      onSuccess?.("Successfully updated order customer information!");
      onClose();
    } catch (err: any) {
      console.error("Failed to update customer:", err);
      setPhoneError(err.message || "Failed to update customer");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteItems = async () => {
    if (selectedItemIds.size === 0) return;

    setIsDeleting(true);
    try {
      const idsToDelete = Array.from(selectedItemIds) as Id<"orderItems">[];
      await deleteMultipleOrderItems({
        orderId: order._id as Id<"orders">,
        orderItemIds: idsToDelete,
      });

      onSuccess?.(`Successfully deleted ${idsToDelete.length} order item${idsToDelete.length > 1 ? "s" : ""}!`);
      setSelectedItemIds(new Set());
      setShowDeleteConfirm(false);
    } catch (err: any) {
      console.error("Failed to delete order items:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50 transition-opacity backdrop-blur-xs"
        onClick={onClose}
      />

      {/* Slide-Over Drawer Container */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col h-full transform transition-transform animate-in slide-in-from-right duration-300 ease-out">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#e7e5e4]">
          <h2 className="text-xl font-bold text-[#0c0a09] tracking-tight">Edit order</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#78716c] hover:text-[#0c0a09] hover:bg-[#f5f5f4] rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <form id="edit-order-form" onSubmit={handleUpdateCustomer} className="space-y-5">
            {/* Customer Details Section */}
            <div>
              <h3 className="text-sm font-bold text-[#0c0a09] mb-3">Customer Details</h3>

              {/* First Name & Last Name Grid */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-[#44403c] mb-1">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First Name"
                    className="w-full px-3 py-2 text-sm text-[#0c0a09] bg-white border border-[#d6d3d1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#78716c] focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#44403c] mb-1">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last Name"
                    className="w-full px-3 py-2 text-sm text-[#0c0a09] bg-white border border-[#d6d3d1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#78716c] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Phone Number with Country Flag Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#44403c] mb-1">Phone Number</label>
                <div className="flex rounded-lg border border-[#d6d3d1] focus-within:ring-2 focus-within:ring-[#78716c] focus-within:border-transparent overflow-hidden bg-white">
                  {/* Country Flag Dropdown */}
                  <div className="flex items-center gap-1.5 px-3 bg-[#f5f5f4] border-r border-[#d6d3d1] text-xs font-medium text-[#44403c]">
                    <span className="text-base leading-none">🇮🇳</span>
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="bg-transparent border-none text-xs font-semibold text-[#1c1917] focus:outline-none cursor-pointer pr-1"
                    >
                      <option value="+91">+91</option>
                      <option value="+1">+1</option>
                      <option value="+44">+44</option>
                      <option value="+971">+971</option>
                    </select>
                  </div>
                  {/* Phone Input */}
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (phoneError) setPhoneError(null);
                    }}
                    placeholder="98989 89898"
                    className="flex-1 px-3 py-2 text-sm text-[#0c0a09] bg-transparent focus:outline-none"
                  />
                </div>
                {phoneError && (
                  <p className="text-xs text-red-500 font-medium mt-1">{phoneError}</p>
                )}
              </div>
            </div>

            {/* Item Details Section */}
            {items.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-[#0c0a09]">Item Details</h3>
                  <button
                    type="button"
                    disabled={selectedItemIds.size === 0 || isDeleting}
                    onClick={() => setShowDeleteConfirm(true)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      selectedItemIds.size > 0
                        ? "bg-[#e05252] hover:bg-[#c93b3b] text-white shadow-xs"
                        : "bg-[#e05252]/40 text-white/70 cursor-not-allowed"
                    }`}
                  >
                    Delete selected items
                  </button>
                </div>

                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-[#78716c] pb-2 border-b border-[#f5f5f4] items-center">
                  <div className="col-span-7 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && selectedItemIds.size === items.length}
                      onChange={handleToggleAll}
                      className="w-4 h-4 rounded border-[#d6d3d1] text-[#0c0a09] focus:ring-0 cursor-pointer accent-[#1c1917]"
                    />
                    <span>Items</span>
                  </div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-3 text-right">Price</div>
                </div>

                {/* Item List Rows */}
                <div className="divide-y divide-[#f5f5f4]">
                  {items.map((item: any) => {
                    const isChecked = selectedItemIds.has(item._id);
                    const formattedPrice = item.display_item_price
                      ? `₹${Math.round(parseFloat(item.display_item_price))}`
                      : `₹${Math.round(item.itemPrice / 100)}`;

                    return (
                      <div
                        key={item._id}
                        className={`grid grid-cols-12 gap-2 py-3 items-center text-sm transition-colors ${
                          isChecked ? "bg-[#fef2f2]/40 rounded-lg px-1 -mx-1" : ""
                        }`}
                      >
                        {/* Item Checkbox & Name */}
                        <div className="col-span-7 flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleItem(item._id)}
                            className="w-4 h-4 mt-0.5 rounded border-[#d6d3d1] text-[#0c0a09] focus:ring-0 cursor-pointer accent-[#1c1917]"
                          />
                          <div>
                            <span className="font-semibold text-[#1c1917] leading-tight block">
                              {item.itemName}
                            </span>
                            {item.customizations && item.customizations.length > 0 && (
                              <span className="text-[11px] text-[#78716c] block mt-0.5">
                                ({item.customizations.map((c: any) => c.optionName || "Customized").join(", ")})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quantity */}
                        <div className="col-span-2 text-center font-bold text-[#1c1917]">
                          {item.quantity}
                        </div>

                        {/* Price */}
                        <div className="col-span-3 text-right font-bold text-[#1c1917]">
                          {formattedPrice}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Drawer Bottom Actions */}
        <div className="p-6 border-t border-[#e7e5e4] bg-[#fafaf9] grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 px-4 bg-[#e5e7eb] hover:bg-[#d1d5db] text-[#1f2937] font-bold text-sm rounded-lg transition-colors cursor-pointer text-center"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-order-form"
            disabled={isUpdating}
            className="w-full py-3 px-4 bg-[#6b7280] hover:bg-[#4b5563] text-white font-bold text-sm rounded-lg transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isUpdating ? "Updating..." : "Update"}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl border border-[#e7e5e4] animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-[#0c0a09] mb-2">Delete Selected Items?</h3>
            <p className="text-xs text-[#78716c] leading-relaxed mb-5">
              Are you sure you want to delete{" "}
              <strong className="text-[#0c0a09]">{selectedItemIds.size}</strong> item(s) from this order?
              The order subtotal and taxes will automatically recalculate.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full py-2.5 px-3 bg-[#f5f5f4] hover:bg-[#e7e5e4] text-[#44403c] font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteItems}
                className="w-full py-2.5 px-3 bg-[#e05252] hover:bg-[#c93b3b] text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
