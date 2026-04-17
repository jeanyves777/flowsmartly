"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, Minus, Plus, Trash2, ShoppingBag, Bookmark } from "lucide-react";
import { useCart } from "./cart-provider";
import { formatCents } from "@/lib/store/cart";

export function CartDrawer() {
  const {
    items,
    itemCount,
    subtotalCents,
    removeItem,
    updateQuantity,
    isOpen,
    setIsOpen,
    currency,
    storeSlug,
  } = useCart();

  const drawerRef = useRef<HTMLDivElement>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleSaveForLater = async (productId: string, variantId?: string) => {
    setSavingId(productId);
    try {
      const res = await fetch(`/api/store/${storeSlug}/account/cart/save-for-later`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, variantId }),
      });
      if (res.ok) {
        removeItem(productId, variantId);
      } else {
        // API failed (e.g. not logged in) — don't remove item from cart
        console.warn("Save for later failed:", res.status);
      }
    } catch {
      // Network error — don't remove item from cart
      console.warn("Save for later failed: network error");
    } finally {
      setSavingId(null);
    }
  };

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Cart ({itemCount})
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingBag className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">Your cart is empty</p>
              <Link
                href={`/store/${storeSlug}/products`}
                onClick={() => setIsOpen(false)}
                className="mt-4 text-sm font-medium hover:underline"
                style={{ color: "var(--store-color-primary, #0ea5e9)" }}
              >
                Continue Shopping
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={`${item.productId}-${item.variantId || ""}`}
                  className="flex gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-800"
                >
                  {/* Image */}
                  <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="h-6 w-6 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    {item.variantName && (
                      <p className="text-xs text-gray-500">{item.variantName}</p>
                    )}
                    <p className="text-sm font-semibold mt-1" style={{ color: "var(--store-color-primary, #0ea5e9)" }}>
                      {formatCents(item.priceCents, currency)}
                    </p>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-1 mt-2">
                      <button
                        onClick={() =>
                          updateQuantity(item.productId, item.variantId, item.quantity - 1)
                        }
                        className="w-9 h-9 flex items-center justify-center rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-sm font-medium w-6 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.productId, item.variantId, item.quantity + 1)
                        }
                        disabled={item.maxQuantity ? item.quantity >= item.maxQuantity : false}
                        className="w-9 h-9 flex items-center justify-center rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <div className="ml-auto flex items-center gap-1">
                      <button
                        onClick={() => removeItem(item.productId, item.variantId)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleSaveForLater(item.productId, item.variantId)}
                        disabled={savingId === item.productId}
                        className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                        title="Save for later"
                      >
                        <Bookmark className="h-4 w-4" />
                      </button>
                      </div>
                    </div>
                    </div>
                  </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
              <span className="font-semibold text-lg">
                {formatCents(subtotalCents, currency)}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Shipping & taxes calculated at checkout
            </p>
            <Link
              href={`/stores/${storeSlug}/checkout`}
              onClick={() => setIsOpen(false)}
              className="block w-full text-center py-3 rounded-lg text-white font-medium text-sm hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "var(--store-color-primary, #0ea5e9)" }}
            >
              Proceed to Checkout
            </Link>
            <button
              onClick={() => setIsOpen(false)}
              className="block w-full text-center py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
