"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import {
  type CartItem,
  loadCart,
  saveCart,
  clearCartStorage,
  addItemToCart,
  removeItemFromCart,
  updateItemQuantity,
  getCartSubtotal,
  getCartItemCount,
} from "@/lib/store/cart";

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotalCents: number;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, variantId: string | undefined, quantity: number) => void;
  clearCart: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  currency: string;
  storeSlug: string;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export function CartProvider({
  storeSlug,
  currency,
  children,
}: {
  storeSlug: string;
  currency: string;
  children: ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    setItems(loadCart(storeSlug));
    setMounted(true);
  }, [storeSlug]);

  // Persist to localStorage on change
  useEffect(() => {
    if (mounted) {
      saveCart(storeSlug, items);
    }
  }, [items, storeSlug, mounted]);

  // Sync across tabs
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === `flowshop-cart-${storeSlug}`) {
        try {
          setItems(e.newValue ? JSON.parse(e.newValue) : []);
        } catch {
          setItems([]);
        }
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [storeSlug]);

  const addItem = useCallback(
    (item: CartItem) => {
      setItems((prev) => addItemToCart(prev, item));
      setIsOpen(true);
    },
    []
  );

  const removeItem = useCallback(
    (productId: string, variantId?: string) => {
      setItems((prev) => removeItemFromCart(prev, productId, variantId));
    },
    []
  );

  const updateQuantity = useCallback(
    (productId: string, variantId: string | undefined, quantity: number) => {
      setItems((prev) => updateItemQuantity(prev, productId, variantId, quantity));
    },
    []
  );

  const clearCart = useCallback(() => {
    setItems([]);
    clearCartStorage(storeSlug);
  }, [storeSlug]);

  const subtotalCents = getCartSubtotal(items);
  const itemCount = getCartItemCount(items);

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotalCents,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        isOpen,
        setIsOpen,
        currency,
        storeSlug,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
