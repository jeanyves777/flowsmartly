"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "./cart-provider";

export function CartButton({ textColor }: { textColor?: string }) {
  const { itemCount, setIsOpen } = useCart();

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="relative p-2 rounded-lg hover:bg-black/5 transition-colors"
      aria-label={`Cart (${itemCount} items)`}
      style={{ color: textColor || 'var(--store-text)' }}
    >
      <ShoppingCart className="h-5 w-5" />
      {itemCount > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ backgroundColor: "var(--store-primary, #0ea5e9)" }}
        >
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
    </button>
  );
}
