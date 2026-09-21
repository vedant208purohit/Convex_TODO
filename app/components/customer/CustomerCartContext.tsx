"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from "react";
import { CartItem, CustomerMenuItem, SelectedCustomization, BillSummary, CustomerServiceMode, DeliveryAddress } from "./types";

interface CustomerCartContextType {
  items: CartItem[];
  totalItemCount: number;
  subTotal: number; // in paise (minor units)
  formattedTotal: string; // e.g. "₹699.00"
  serviceMode: CustomerServiceMode;
  setServiceMode: (mode: CustomerServiceMode) => void;
  customerPhone: string;
  setCustomerPhone: (phone: string) => void;
  customerName: string;
  setCustomerName: (name: string) => void;
  kitchenInstructions: string;
  setKitchenInstructions: (instructions: string) => void;
  deliveryAddress: DeliveryAddress | null;
  setDeliveryAddress: (address: DeliveryAddress | null) => void;
  activeOrderId: string | null;
  setActiveOrderId: (id: string | null) => void;
  activeOrderNumber: string | null;
  setActiveOrderNumber: (num: string | null) => void;
  clearActiveOrder: () => void;
  addItem: (
    item: CustomerMenuItem,
    customizations?: SelectedCustomization[],
    quantity?: number,
    preferences?: string[]
  ) => void;
  updateQuantity: (cartItemId: string, delta: number) => void;
  setItemQuantity: (cartItemId: string, quantity: number) => void;
  removeItem: (cartItemId: string) => void;
  updateItemCustomizations: (
    oldCartItemId: string,
    item: CustomerMenuItem,
    customizations: SelectedCustomization[],
    quantity: number,
    preferences?: string[]
  ) => void;
  getItemQuantity: (itemId: string) => number;
  getCartItemByItemId: (itemId: string) => CartItem | undefined;
  getCartItemById: (cartItemId: string) => CartItem | undefined;
  clearCart: () => void;
  billSummary: BillSummary;
  currencySymbol: string;
}

const CustomerCartContext = createContext<CustomerCartContextType | undefined>(undefined);

export function buildCartItemId(
  itemId: string,
  customizations?: SelectedCustomization[],
  preferences?: string[]
): string {
  const custKeys = (customizations || [])
    .map((c) => c.optionId)
    .sort()
    .join("_");
  const prefKeys = (preferences || [])
    .sort()
    .join("_");
  const suffix = [custKeys, prefKeys].filter(Boolean).join("__");
  return suffix ? `${itemId}_${suffix}` : itemId;
}

export function CustomerCartProvider({
  children,
  tableId,
  currencySymbol = "₹",
}: {
  children: ReactNode;
  tableId?: string;
  currencySymbol?: string;
}) {
  const storageKey = `prest_customer_cart_${tableId || "default"}`;
  const metadataStorageKey = `prest_customer_meta_${tableId || "default"}`;

  const [items, setItems] = useState<CartItem[]>([]);
  const [serviceMode, setServiceMode] = useState<CustomerServiceMode>("dine_in");
  const [customerPhone, setCustomerPhone] = useState<string>("9876543210");
  const [customerName, setCustomerName] = useState<string>("Rahul");
  const [kitchenInstructions, setKitchenInstructions] = useState<string>("Please serve beverages first");
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeOrderNumber, setActiveOrderNumber] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount or table change
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      } else {
        setItems([]);
      }

      const storedMeta = localStorage.getItem(metadataStorageKey);
      if (storedMeta) {
        const parsedMeta = JSON.parse(storedMeta);
        if (parsedMeta.serviceMode) setServiceMode(parsedMeta.serviceMode);
        if (parsedMeta.customerPhone) setCustomerPhone(parsedMeta.customerPhone);
        if (parsedMeta.customerName) setCustomerName(parsedMeta.customerName);
        if (parsedMeta.kitchenInstructions) setKitchenInstructions(parsedMeta.kitchenInstructions);
        if (parsedMeta.deliveryAddress) setDeliveryAddress(parsedMeta.deliveryAddress);
        if (parsedMeta.activeOrderId) setActiveOrderId(parsedMeta.activeOrderId);
        if (parsedMeta.activeOrderNumber) setActiveOrderNumber(parsedMeta.activeOrderNumber);
      }
    } catch {
      setItems([]);
    } finally {
      setIsInitialized(true);
    }
  }, [storageKey, metadataStorageKey]);

  // Persist items to localStorage
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // Quota handling
    }
  }, [items, storageKey, isInitialized]);

  // Persist metadata to localStorage
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(
        metadataStorageKey,
        JSON.stringify({
          serviceMode,
          customerPhone,
          customerName,
          kitchenInstructions,
          deliveryAddress,
          activeOrderId,
          activeOrderNumber,
        })
      );
    } catch {
      // Quota handling
    }
  }, [serviceMode, customerPhone, customerName, kitchenInstructions, deliveryAddress, activeOrderId, activeOrderNumber, metadataStorageKey, isInitialized]);

  const clearActiveOrder = useCallback(() => {
    setActiveOrderId(null);
    setActiveOrderNumber(null);
  }, []);


  const addItem = useCallback(
    (
      item: CustomerMenuItem,
      customizations: SelectedCustomization[] = [],
      quantity = 1,
      preferences: string[] = []
    ) => {
      const cartItemId = buildCartItemId(item.id, customizations, preferences);
      const customAddonsPrice = customizations.reduce((acc, c) => acc + (c.price || 0), 0);
      const totalUnitPrice = item.price + customAddonsPrice;

      setItems((prev) => {
        const existingIdx = prev.findIndex((i) => i.cartItemId === cartItemId);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: updated[existingIdx].quantity + quantity,
          };
          return updated;
        } else {
          return [
            ...prev,
            {
              cartItemId,
              itemId: item.id,
              name: item.name,
              price: item.price,
              totalUnitPrice,
              quantity,
              imageUrl:
                item.item_image_url ||
                (item as any).imageUrl ||
                (typeof (item as any).image === "string" ? (item as any).image : undefined),
              isVeg: item.is_veg,
              customizations: customizations.length > 0 ? customizations : undefined,
              preferences: preferences.length > 0 ? preferences : undefined,
            },
          ];
        }
      });
    },
    []
  );

  const updateQuantity = useCallback((cartItemId: string, delta: number) => {
    setItems((prev) => {
      return prev
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  }, []);

  const setItemQuantity = useCallback((cartItemId: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) {
        return prev.filter((i) => i.cartItemId !== cartItemId);
      }
      return prev.map((item) =>
        item.cartItemId === cartItemId ? { ...item, quantity } : item
      );
    });
  }, []);

  const removeItem = useCallback((cartItemId: string) => {
    setItems((prev) => prev.filter((i) => i.cartItemId !== cartItemId));
  }, []);

  const updateItemCustomizations = useCallback(
    (
      oldCartItemId: string,
      item: CustomerMenuItem,
      customizations: SelectedCustomization[] = [],
      quantity = 1,
      preferences: string[] = []
    ) => {
      const newCartItemId = buildCartItemId(item.id, customizations, preferences);
      const customAddonsPrice = customizations.reduce((acc, c) => acc + (c.price || 0), 0);
      const totalUnitPrice = item.price + customAddonsPrice;

      setItems((prev) => {
        const filtered = prev.filter((i) => i.cartItemId !== oldCartItemId);
        const existingIdx = filtered.findIndex((i) => i.cartItemId === newCartItemId);

        if (existingIdx >= 0) {
          const updated = [...filtered];
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: updated[existingIdx].quantity + quantity,
          };
          return updated;
        } else {
          return [
            ...filtered,
            {
              cartItemId: newCartItemId,
              itemId: item.id,
              name: item.name,
              price: item.price,
              totalUnitPrice,
              quantity,
              imageUrl:
                item.item_image_url ||
                (item as any).imageUrl ||
                (typeof (item as any).image === "string" ? (item as any).image : undefined),
              isVeg: item.is_veg,
              customizations: customizations.length > 0 ? customizations : undefined,
              preferences: preferences.length > 0 ? preferences : undefined,
            },
          ];
        }
      });
    },
    []
  );

  const getItemQuantity = useCallback(
    (itemId: string) => {
      return items
        .filter((i) => i.itemId === itemId)
        .reduce((sum, i) => sum + i.quantity, 0);
    },
    [items]
  );

  const getCartItemByItemId = useCallback(
    (itemId: string) => {
      return items.find((i) => i.itemId === itemId);
    },
    [items]
  );

  const getCartItemById = useCallback(
    (cartItemId: string) => {
      return items.find((i) => i.cartItemId === cartItemId);
    },
    [items]
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItemCount = useMemo(() => {
    return items.reduce((sum, i) => sum + i.quantity, 0);
  }, [items]);

  const subTotal = useMemo(() => {
    return items.reduce((sum, i) => sum + i.totalUnitPrice * i.quantity, 0);
  }, [items]);

  const formattedTotal = useMemo(() => {
    return `${currencySymbol}${(subTotal / 100).toFixed(2)}`;
  }, [subTotal, currencySymbol]);

  // Bill Summary Calculations
  const billSummary: BillSummary = useMemo(() => {
    const itemTotal = subTotal;
    const gstRate = 5; // 5% GST standard
    const gstAmount = Math.round(itemTotal * (gstRate / 100));
    const serviceTaxRate = 6; // 6% restaurant service tax standard
    const serviceTaxAmount = Math.round(itemTotal * (serviceTaxRate / 100));
    const coverCharge = 0; // FREE for dine-in
    const grandTotal = itemTotal + gstAmount + serviceTaxAmount + coverCharge;

    return {
      itemTotal,
      gstRate,
      gstAmount,
      serviceTaxRate,
      serviceTaxAmount,
      coverCharge,
      grandTotal,
      formattedItemTotal: `${currencySymbol}${(itemTotal / 100).toFixed(2)}`,
      formattedGstAmount: `${currencySymbol}${(gstAmount / 100).toFixed(2)}`,
      formattedServiceTaxAmount: `${currencySymbol}${(serviceTaxAmount / 100).toFixed(2)}`,
      formattedGrandTotal: `${currencySymbol}${(grandTotal / 100).toFixed(2)}`,
    };
  }, [subTotal, currencySymbol]);

  return (
    <CustomerCartContext.Provider
      value={{
        items,
        totalItemCount,
        subTotal,
        formattedTotal,
        serviceMode,
        setServiceMode,
        customerPhone,
        setCustomerPhone,
        customerName,
        setCustomerName,
        kitchenInstructions,
        setKitchenInstructions,
        deliveryAddress,
        setDeliveryAddress,
        activeOrderId,
        setActiveOrderId,
        activeOrderNumber,
        setActiveOrderNumber,
        clearActiveOrder,
        addItem,
        updateQuantity,
        setItemQuantity,
        removeItem,
        updateItemCustomizations,
        getItemQuantity,
        getCartItemByItemId,
        getCartItemById,
        clearCart,
        billSummary,
        currencySymbol,
      }}
    >
      {children}
    </CustomerCartContext.Provider>
  );
}

export function useCustomerCart() {
  const context = useContext(CustomerCartContext);
  if (!context) {
    throw new Error("useCustomerCart must be used within a CustomerCartProvider");
  }
  return context;
}
