"use client";

import { useState } from "react";
import { ShoppingCart, Check, AlertCircle } from "lucide-react";
import { useCart } from "./cart-provider";

interface Variant {
  id: string;
  name: string;
  priceCents: number;
  options: Record<string, string>;
  quantity: number;
  isActive: boolean;
}

interface AddToCartButtonProps {
  productId: string;
  productName: string;
  priceCents: number;
  currency: string;
  imageUrl?: string;
  trackInventory: boolean;
  quantity: number;
  variants: Variant[];
  primaryColor?: string;
}

export function AddToCartButton({
  productId,
  productName,
  priceCents,
  currency,
  imageUrl,
  trackInventory,
  quantity: stockQuantity,
  variants,
  primaryColor,
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    variants.length === 1 ? variants[0].id : ""
  );
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const activeVariants = variants.filter((v) => v.isActive);
  const selectedVariant = activeVariants.find((v) => v.id === selectedVariantId);

  const effectivePrice = selectedVariant ? selectedVariant.priceCents : priceCents;
  const effectiveStock = trackInventory
    ? selectedVariant
      ? selectedVariant.quantity
      : stockQuantity
    : Infinity;
  const isOutOfStock = trackInventory && effectiveStock <= 0;
  const maxQty = trackInventory ? effectiveStock : 99;

  function handleAddToCart() {
    if (isOutOfStock) return;
    if (activeVariants.length > 0 && !selectedVariantId) return;

    addItem({
      productId,
      variantId: selectedVariantId || undefined,
      name: productName,
      variantName: selectedVariant?.name,
      priceCents: effectivePrice,
      quantity: qty,
      imageUrl,
      maxQuantity: trackInventory ? effectiveStock : undefined,
      currency,
    });

    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  const btnColor = primaryColor || "var(--store-color-primary, #0ea5e9)";

  return (
    <div className="space-y-4">
      {/* Variant Selector */}
      {activeVariants.length > 1 && (
        <div>
          <label className="block text-sm font-medium mb-2">Select Option</label>
          <div className="space-y-2">
            {activeVariants.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setSelectedVariantId(v.id);
                  setQty(1);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                  selectedVariantId === v.id
                    ? "border-2 bg-opacity-5"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                style={
                  selectedVariantId === v.id
                    ? { borderColor: btnColor, backgroundColor: `${btnColor}08` }
                    : undefined
                }
              >
                <div>
                  <p className="text-sm font-medium">{v.name}</p>
                  {Object.keys(v.options).length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {Object.entries(v.options)
                        .map(([k, val]) => `${k}: ${val}`)
                        .join(", ")}
                    </p>
                  )}
                </div>
                <span className="text-sm font-semibold" style={{ color: btnColor }}>
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency,
                  }).format(v.priceCents / 100)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quantity Selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Qty</label>
        <div className="flex items-center border border-gray-200 rounded-lg">
          <button
            onClick={() => setQty(Math.max(1, qty - 1))}
            disabled={qty <= 1}
            className="px-3 py-2 text-gray-500 hover:text-gray-700 disabled:opacity-40"
          >
            -
          </button>
          <span className="px-3 py-2 text-sm font-medium min-w-[40px] text-center">
            {qty}
          </span>
          <button
            onClick={() => setQty(Math.min(maxQty, qty + 1))}
            disabled={qty >= maxQty}
            className="px-3 py-2 text-gray-500 hover:text-gray-700 disabled:opacity-40"
          >
            +
          </button>
        </div>
        {trackInventory && effectiveStock < 10 && effectiveStock > 0 && (
          <span className="text-xs text-amber-600">
            Only {effectiveStock} left
          </span>
        )}
      </div>

      {/* Add to Cart Button */}
      <button
        onClick={handleAddToCart}
        disabled={isOutOfStock || (activeVariants.length > 1 && !selectedVariantId)}
        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-white font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
        style={{ backgroundColor: isOutOfStock ? "#9ca3af" : btnColor }}
      >
        {isOutOfStock ? (
          <>
            <AlertCircle className="h-4 w-4" />
            Out of Stock
          </>
        ) : added ? (
          <>
            <Check className="h-4 w-4" />
            Added to Cart!
          </>
        ) : (
          <>
            <ShoppingCart className="h-4 w-4" />
            Add to Cart
          </>
        )}
      </button>

      {activeVariants.length > 1 && !selectedVariantId && (
        <p className="text-xs text-gray-400 text-center">
          Please select an option above
        </p>
      )}
    </div>
  );
}
