"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus, ShoppingBag, Trash2 } from "lucide-react";
import { formatPrice } from "@/lib/data";
import {
  getCart,
  getCartTotal,
  getCartCount,
  updateQuantity,
  removeFromCart,
  redirectToCheckout,
  type CartItem,
} from "@/lib/cart";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  storeSlug: string;
}

export default function CartDrawer({ isOpen, onClose, storeSlug }: CartDrawerProps) {
  const [cart, setCart] = useState<CartItem[]>([]);

  // Sync cart state
  useEffect(() => {
    const update = () => setCart(getCart());
    update();
    window.addEventListener("cart-updated", update);
    return () => window.removeEventListener("cart-updated", update);
  }, []);

  // Also refresh when drawer opens
  useEffect(() => {
    if (isOpen) setCart(getCart());
  }, [isOpen]);

  const total = getCartTotal(cart);
  const count = getCartCount(cart);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <ShoppingBag size={20} className="text-primary-600" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Cart ({count})
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close cart"
              >
                <X size={20} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ShoppingBag size={48} className="text-gray-200 dark:text-gray-700 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 font-medium mb-2">
                    Your cart is empty
                  </p>
                  <p className="text-sm text-gray-400">
                    Add some products to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => {
                    const key = item.variantId
                      ? `${item.productId}:${item.variantId}`
                      : item.productId;

                    return (
                      <motion.div
                        key={key}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 50 }}
                        className="flex gap-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"
                      >
                        {/* Image */}
                        <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                          {item.imageUrl && (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                            {item.name}
                          </h3>
                          {item.variantName && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {item.variantName}
                            </p>
                          )}
                          <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">
                            {formatPrice(item.priceCents)}
                          </p>

                          {/* Quantity controls */}
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() =>
                                updateQuantity(item.productId, item.variantId, item.quantity - 1)
                              }
                              className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="text-sm font-medium w-6 text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateQuantity(item.productId, item.variantId, item.quantity + 1)
                              }
                              className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              <Plus size={12} />
                            </button>

                            <button
                              onClick={() => removeFromCart(item.productId, item.variantId)}
                              className="ml-auto p-1 text-gray-400 hover:text-red-500 transition-colors"
                              aria-label="Remove item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {cart.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatPrice(total)}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Shipping and taxes calculated at checkout
                </p>
                <button
                  onClick={() => redirectToCheckout(storeSlug)}
                  className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-full transition-colors"
                >
                  Checkout
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
