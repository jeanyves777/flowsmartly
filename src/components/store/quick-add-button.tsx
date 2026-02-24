"use client";

import { useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { useCart } from "./cart-provider";

interface QuickAddButtonProps {
  productId: string;
  productName: string;
  priceCents: number;
  currency: string;
  imageUrl?: string;
  primaryColor?: string;
}

export function QuickAddButton({
  productId,
  productName,
  priceCents,
  currency,
  imageUrl,
  primaryColor,
}: QuickAddButtonProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      productId,
      name: productName,
      priceCents,
      quantity: 1,
      currency,
      imageUrl,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <button
      onClick={handleAdd}
      className="absolute bottom-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0 hover:scale-105 active:scale-95"
      style={{ backgroundColor: added ? "#16a34a" : 'var(--store-primary, #111827)' }}
      aria-label={added ? "Added to cart" : `Add ${productName} to cart`}
    >
      {added ? (
        <>
          <Check className="h-3.5 w-3.5" />
          Added
        </>
      ) : (
        <>
          <ShoppingCart className="h-3.5 w-3.5" />
          Add
        </>
      )}
    </button>
  );
}
