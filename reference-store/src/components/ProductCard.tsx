"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, Heart, Check } from "lucide-react";
import { formatPrice } from "@/lib/data";
import { addToCart } from "@/lib/cart";
import type { Product } from "@/lib/products";

const STORE_SLUG = (() => {
  if (typeof window === "undefined") return "";
  try {
    const m = window.location.pathname.match(/\/stores\/([^/]+)/);
    return m?.[1] || "";
  } catch { return ""; }
})();
const API_BASE = "https://flowsmartly.com";

interface ProductCardProps {
  product: Product;
  index?: number;
}

export default function ProductCard({ product, index = 0 }: ProductCardProps) {
  const discount = product.comparePriceCents
    ? Math.round((1 - product.priceCents / product.comparePriceCents) * 100)
    : 0;

  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [added, setAdded] = useState(false);

  const productUrl = STORE_SLUG
    ? `/stores/${STORE_SLUG}/products/${product.slug}`
    : `/products/${product.slug}`;

  useEffect(() => {
    const sync = () => {
      setWishlisted(((window as any).__storeWishlist || []).includes(product.id));
    };
    sync();
    window.addEventListener("wishlist-updated", sync);
    return () => window.removeEventListener("wishlist-updated", sync);
  }, [product.id]);

  const handleAddToCart = () => {
    if (!product.inStock) return;
    addToCart({
      productId: product.id,
      variantId: product.variants?.[0]?.id,
      name: product.name,
      variantName: product.variants?.[0]?.name,
      priceCents: product.priceCents,
      imageUrl: product.images[0]?.url || "",
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleWishlist = () => {
    if (!(window as any).__storeCustomer) {
      // Open the AccountModal (sign in drawer) — stays on the same page
      window.dispatchEvent(new CustomEvent("toggle-account"));
      return;
    }
    if (wishlistLoading) return;
    setWishlistLoading(true);
    const action = wishlisted ? "DELETE" : "POST";
    fetch(`${API_BASE}/api/store/${STORE_SLUG}/account/wishlist`, {
      method: action,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id }),
    })
      .then(() => {
        if (wishlisted) {
          (window as any).__storeWishlist = ((window as any).__storeWishlist || []).filter((id: string) => id !== product.id);
        } else {
          (window as any).__storeWishlist = [...((window as any).__storeWishlist || []), product.id];
        }
        window.dispatchEvent(new CustomEvent("wishlist-updated"));
      })
      .catch(() => {})
      .finally(() => setWishlistLoading(false));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: (index || 0) * 0.05, duration: 0.4 }}
      className="group"
    >
      {/* Image container — note: group is on the outer motion.div so any
          hover inside this card triggers the desktop add-to-cart slide-up */}
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-4">
        {/* Clickable image area — links to product detail */}
        <a href={productUrl} className="block w-full h-full">
          {product.images[0] && (
            <img
              src={product.images[0].url}
              alt={product.images[0].alt}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          )}
        </a>

        {/* Badges — non-interactive */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
          {product.labels?.includes("sale") && discount > 0 && (
            <span className="px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-full">-{discount}%</span>
          )}
          {product.labels?.includes("discount") && discount > 0 && !product.labels?.includes("sale") && (
            <span className="px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-full">-{discount}%</span>
          )}
          {product.labels?.includes("new") && (
            <span className="px-2.5 py-1 bg-primary-600 text-white text-xs font-bold rounded-full">New</span>
          )}
          {product.labels?.includes("bestseller") && (
            <span className="px-2.5 py-1 bg-amber-500 text-white text-xs font-bold rounded-full">Bestseller</span>
          )}
          {product.labels?.includes("limited") && (
            <span className="px-2.5 py-1 bg-purple-600 text-white text-xs font-bold rounded-full">Limited</span>
          )}
        </div>

        {/* Wishlist heart — interactive, z-20 above everything */}
        <button
          type="button"
          onClick={handleWishlist}
          disabled={wishlistLoading}
          className={`absolute top-3 right-3 z-20 p-2.5 rounded-full shadow-md transition-all ${
            wishlisted
              ? "bg-red-500 text-white"
              : "bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 hover:text-red-500"
          } ${wishlistLoading ? "opacity-50" : ""}`}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart size={18} fill={wishlisted ? "currentColor" : "none"} />
        </button>

        {/* Add to Cart — two variants: mobile icon-only + desktop hover pill */}
        {product.inStock ? (
          <>
            {/* MOBILE (sm:hidden): small round icon-only button at bottom-right */}
            <button
              type="button"
              onClick={handleAddToCart}
              aria-label={added ? "Added to cart" : "Add to cart"}
              className={`sm:hidden absolute bottom-3 right-3 z-20 w-10 h-10 rounded-full shadow-md flex items-center justify-center transition-all active:scale-95 ${
                added
                  ? "bg-green-500 text-white"
                  : "bg-white/95 dark:bg-gray-900/95 text-gray-800 dark:text-white"
              }`}
            >
              {added ? <Check size={18} /> : <ShoppingBag size={18} />}
            </button>

            {/* DESKTOP (hidden sm:flex): full pill, slides up on card hover */}
            <div className="hidden sm:flex absolute inset-x-3 bottom-3 z-20 justify-center opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto">
              <button
                type="button"
                onClick={handleAddToCart}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-full shadow-lg transition-colors ${
                  added
                    ? "bg-green-500 text-white"
                    : "bg-white dark:bg-gray-900 text-gray-900 dark:text-white hover:bg-primary-600 hover:text-white"
                }`}
              >
                {added ? <Check size={16} /> : <ShoppingBag size={16} />}
                {added ? "Added!" : "Add to Cart"}
              </button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 z-10 bg-white/60 dark:bg-gray-900/60 flex flex-col items-center justify-center gap-2 pointer-events-none">
            <span className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-full">Out of Stock</span>
            <button
              type="button"
              onClick={handleWishlist}
              className="pointer-events-auto flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-medium rounded-full shadow-md hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
            >
              <Heart size={14} fill={wishlisted ? "currentColor" : "none"} className={wishlisted ? "text-red-500" : ""} />
              {wishlisted ? "Saved" : "Save for Later"}
            </button>
          </div>
        )}
      </div>

      {/* Product info — clickable */}
      <a href={productUrl} className="block space-y-1.5">
        <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2 sm:line-clamp-1">
          {product.name}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
          {product.shortDescription}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            {formatPrice(product.priceCents)}
          </span>
          {product.comparePriceCents && (
            <span className="text-sm text-gray-400 line-through">
              {formatPrice(product.comparePriceCents)}
            </span>
          )}
        </div>
        {!product.inStock && (
          <p className="text-xs font-medium text-red-500">Item unavailable</p>
        )}
        {product.inStock && product.variants && product.variants.length > 0 && (
          <p className="text-xs text-gray-400">
            {product.variants.length} {product.variants.length === 1 ? "variant" : "variants"}
          </p>
        )}
      </a>
    </motion.div>
  );
}
