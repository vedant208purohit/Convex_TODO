"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { CartItem, CustomerMenuItem, SelectedCustomization } from "./types";

interface CustomerCartContextType {
  items: CartItem[];
  totalItemCount: number;
  subTotal: number; // in paise (minor units)
  formattedTotal: string; // e.g. "₹699.00"
  addItem: (item: CustomerMenuItem, customizations?: SelectedCustomization[], quantity?: number) => void;
  updateQuantity: (cartItemId: string, delta: number) => void;
  setItemQuantity: (cartItemId: string, quantity: number) => void;
  getItemQuantity: (itemId: string) => number;
  getCartItemByItemId: (itemId: string) => CartItem | undefined;
  clearCart: () => void;
  currencySymbol: string;
}

const CustomerCartContext = createContext<CustomerCartContextType | undefined>(undefined);

function buildCartItemId(itemId: string, customizations?: SelectedCustomization[]): string {
  if (!customizations || customizations.length === 0) {
    return itemId;
  }
  const optionIds = customizations.map((c) => c.optionId).sort().join("_");
  return `${itemId}_${optionIds}`;
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
  const [items, setItems] = useState<CartItem[]>([]);
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
    } catch {
      setItems([]);
    } finally {
      setIsInitialized(true);
    }
  }, [storageKey]);

  // Persist to localStorage
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // Storage quota or private browsing handling
    }
  }, [items, storageKey, isInitialized]);

  const addItem = useCallback(
    (item: CustomerMenuItem, customizations: SelectedCustomization[] = [], quantity = 1) => {
      const cartItemId = buildCartItemId(item.id, customizations);
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
              imageUrl: item.item_image_url,
              isVeg: item.is_veg,
              customizations: customizations.length > 0 ? customizations : undefined,
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

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subTotal = items.reduce((sum, i) => sum + i.totalUnitPrice * i.quantity, 0);
  const formattedTotal = `${currencySymbol}${(subTotal / 100).toFixed(2)}`;

  return (
    <CustomerCartContext.Provider
      value={{
        items,
        totalItemCount,
        subTotal,
        formattedTotal,
        addItem,
        updateQuantity,
        setItemQuantity,
        getItemQuantity,
        getCartItemByItemId,
        clearCart,
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
