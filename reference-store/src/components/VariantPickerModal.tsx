"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingBag, Check, Minus, Plus } from "lucide-react";
import { formatPrice } from "@/lib/data";
import { addToCart } from "@/lib/cart";
import type { Product } from "@/lib/products";

interface VariantPickerModalProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}

/**
 * Variant picker modal — opens from a ProductCard's Add-to-Cart when the
 * product has more than one variant. Users select one value per option
 * dimension (density, length, color, size, ...). We resolve the selected
 * combination against the `variants[]` array and only enable Add-to-Cart
 * once a valid variant matches.
 *
 * Why this exists: the card-level Add-to-Cart used to hardcode variants[0],
 * which shipped the wrong SKU whenever the product had real variant
 * dimensions. This modal forces a conscious selection.
 *
 * Variant shape in products.ts (synced from DB):
 *   { id, name, options: Record<string,string>, priceCents,
 *     comparePriceCents?, imageUrl?, inStock }
 *
 * We derive the option dimensions from the union of all variant.options keys.
 */
export default function VariantPickerModal({ product, open, onClose }: VariantPickerModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);

  // Build a map of option-dimension → unique values across all variants.
  // Stable iteration order based on first-seen so the picker row order
  // mirrors how the admin laid the variants out.
  const dimensions = useMemo(() => {
    if (!product?.variants?.length) return [] as Array<{ key: string; values: string[] }>;
    const ordered: string[] = [];
    const seen = new Map<string, Set<string>>();
    for (const v of product.variants) {
      const opts = (v.options || {}) as Record<string, string>;
      for (const [k, val] of Object.entries(opts)) {
        if (!seen.has(k)) {
          seen.set(k, new Set());
          ordered.push(k);
        }
        seen.get(k)!.add(String(val));
      }
    }
    return ordered.map((k) => ({ key: k, values: Array.from(seen.get(k)!) }));
  }, [product]);

  // Find the matching variant for the current selection. Requires every
  // dimension to be set — otherwise returns null so we can disable ATC.
  const matchedVariant = useMemo(() => {
    if (!product?.variants?.length) return null;
    if (dimensions.length === 0) return product.variants[0];
    if (dimensions.some((d) => !selected[d.key])) return null;
    return (
      product.variants.find((v) =>
        dimensions.every((d) => String((v.options || {})[d.key] ?? "") === selected[d.key]),
      ) || null
    );
  }, [product, dimensions, selected]);

  // Reset state on open with first in-stock variant pre-selected so the
  // user sees an initial price without clicking.
  useEffect(() => {
    if (!open || !product) return;
    setQuantity(1);
    setAdded(false);
    const first = product.variants?.find((v) => v.inStock) || product.variants?.[0];
    if (first?.options) {
      const next: Record<string, string> = {};
      for (const [k, val] of Object.entries(first.options as Record<string, string>)) {
        next[k] = String(val);
      }
      setSelected(next);
    } else {
      setSelected({});
    }
  }, [open, product]);

  // Close on ESC + lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const isVariantInStock = (dimKey: string, value: string): boolean => {
    if (!product?.variants) return true;
    // A value is in stock if at least one variant with that value (+ the
    // other currently-selected values) is in stock. Greys out impossible combos.
    return product.variants.some((v) => {
      const opts = (v.options || {}) as Record<string, string>;
      if (String(opts[dimKey] ?? "") !== value) return false;
      for (const d of dimensions) {
        if (d.key === dimKey) continue;
        if (selected[d.key] && String(opts[d.key] ?? "") !== selected[d.key]) return false;
      }
      return v.inStock;
    });
  };

  const handleAdd = () => {
    if (!product || !matchedVariant || !matchedVariant.inStock) return;
    const priceCents = matchedVariant.priceCents ?? product.priceCents;
    for (let i = 0; i < quantity; i++) {
      addToCart({
        productId: product.id,
        variantId: matchedVariant.id,
        name: product.name,
        variantName: matchedVariant.name,
        priceCents,
        imageUrl: matchedVariant.imageUrl || product.images?.[0]?.url || "",
      });
    }
    setAdded(true);
    setTimeout(() => {
      onClose();
      setAdded(false);
    }, 900);
  };

  const displayPrice = matchedVariant?.priceCents ?? product?.priceCents ?? 0;
  const displayCompare = matchedVariant?.comparePriceCents ?? product?.comparePriceCents;
  const displayImage = matchedVariant?.imageUrl || product?.images?.[0]?.url;

  return (
    <AnimatePresence>
      {open && product && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel — bottom-sheet on mobile, centered card on sm+ */}
          <motion.div
            key="panel"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 sm:inset-0 sm:flex sm:items-center sm:justify-center pointer-events-none"
          >
            <div
              className="bg-white dark:bg-gray-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
              role="dialog"
              aria-modal="true"
              aria-labelledby="variant-modal-title"
            >
              {/* Header */}
              <div className="flex items-start gap-4 p-5 border-b border-gray-100 dark:border-gray-800">
                {displayImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayImage}
                    alt={product.name}
                    className="w-20 h-20 rounded-xl object-cover bg-gray-100 dark:bg-gray-800 flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h2
                    id="variant-modal-title"
                    className="text-base font-semibold text-gray-900 dark:text-white line-clamp-2"
                  >
                    {product.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatPrice(displayPrice)}
                    </span>
                    {displayCompare && displayCompare > displayPrice && (
                      <span className="text-sm text-gray-400 line-through">
                        {formatPrice(displayCompare)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Pickers */}
              <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
                {dimensions.map((dim) => (
                  <div key={dim.key}>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2.5 capitalize">
                      {dim.key}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {dim.values.map((val) => {
                        const isSelected = selected[dim.key] === val;
                        const inStock = isVariantInStock(dim.key, val);
                        return (
                          <button
                            key={val}
                            type="button"
                            disabled={!inStock}
                            onClick={() => setSelected((s) => ({ ...s, [dim.key]: val }))}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                              isSelected
                                ? "border-primary-600 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                                : inStock
                                  ? "border-gray-200 dark:border-gray-700 hover:border-gray-400 text-gray-700 dark:text-gray-200"
                                  : "border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 line-through cursor-not-allowed"
                            }`}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Quantity */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2.5">
                    Quantity
                  </h3>
                  <div className="inline-flex items-center border border-gray-200 dark:border-gray-700 rounded-full">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="p-2.5 text-gray-500 hover:text-gray-900 dark:hover:text-white"
                      aria-label="Decrease"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-10 text-center font-medium text-gray-900 dark:text-white">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.min(20, quantity + 1))}
                      className="p-2.5 text-gray-500 hover:text-gray-900 dark:hover:text-white"
                      aria-label="Increase"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!matchedVariant?.inStock || added}
                  className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-full font-semibold text-white transition-all ${
                    added
                      ? "bg-green-500"
                      : matchedVariant?.inStock
                        ? "bg-primary-600 hover:bg-primary-700"
                        : "bg-gray-400 cursor-not-allowed"
                  }`}
                >
                  {added ? (
                    <>
                      <Check size={18} />
                      Added to cart
                    </>
                  ) : !matchedVariant ? (
                    "Select options"
                  ) : !matchedVariant.inStock ? (
                    "Out of stock"
                  ) : (
                    <>
                      <ShoppingBag size={18} />
                      Add to Cart — {formatPrice(displayPrice * quantity)}
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
