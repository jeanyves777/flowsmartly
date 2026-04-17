"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, Heart } from "lucide-react";
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

  // Sync with global wishlist state
  useEffect(() => {
    const sync = () => {
      setWishlisted((window.__storeWishlist || []).includes(product.id));
    };
    sync();
    window.addEventListener("wishlist-updated", sync);
    return () => window.removeEventListener("wishlist-updated", sync);
  }, [product.id]);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({
      productId: product.id,
      variantId: product.variants[0]?.id,
      name: product.name,
      variantName: product.variants[0]?.name,
      priceCents: product.priceCents,
      imageUrl: product.images[0]?.url || "",
    });
  };

  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.__storeCustomer) {
      window.dispatchEvent(new CustomEvent("open-account-modal"));
      return;
    }
    if (wishlistLoading) return;
    setWishlistLoading(true);
    try {
      if (wishlisted) {
        await fetch(`${API_BASE}/api/store/${STORE_SLUG}/account/wishlist`, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: product.id }),
        });
        window.__storeWishlist = (window.__storeWishlist || []).filter((id) => id !== product.id);
      } else {
        await fetch(`${API_BASE}/api/store/${STORE_SLUG}/account/wishlist`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: product.id }),
        });
        window.__storeWishlist = [...(window.__storeWishlist || []), product.id];
      }
      window.dispatchEvent(new CustomEvent("wishlist-updated"));
    } catch { /* silent */ } finally {
      setWishlistLoading(false);
    }
  };

  return (
    <motion.a
      href={STORE_SLUG ? `/stores/${STORE_SLUG}/products/${product.slug}` : `/products/${product.slug}`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className="group block"
    >
      {/* Image */}
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-4">
        {product.images[0] && (
          <img
            src={product.images[0].url}
            alt={product.images[0].alt}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.labels?.includes("sale") && discount > 0 && (
            <span className="px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
              -{discount}%
            </span>
          )}
          {product.labels?.includes("discount") && discount > 0 && !product.labels?.includes("sale") && (
            <span className="px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
              -{discount}%
            </span>
          )}
          {product.labels?.includes("new") && (
            <span className="px-2.5 py-1 bg-primary-600 text-white text-xs font-bold rounded-full">
              New
            </span>
          )}
          {product.labels?.includes("bestseller") && (
            <span className="px-2.5 py-1 bg-amber-500 text-white text-xs font-bold rounded-full">
              Bestseller
            </span>
          )}
          {product.labels?.includes("limited") && (
            <span className="px-2.5 py-1 bg-purple-600 text-white text-xs font-bold rounded-full">
              Limited
            </span>
          )}
          {product.labels?.includes("featured") && (
            <span className="px-2.5 py-1 bg-pink-600 text-white text-xs font-bold rounded-full">
              Featured
            </span>
          )}
        </div>

        {/* Wishlist heart — always visible on mobile, top-right */}
        <button
          onClick={handleWishlist}
          disabled={wishlistLoading}
          className={`absolute top-3 right-3 z-10 p-2.5 rounded-full shadow-md transition-all ${
            wishlisted
              ? "bg-red-500 text-white"
              : "bg-white/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 hover:text-red-500"
          } ${wishlistLoading ? "opacity-50" : ""}`}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart size={18} fill={wishlisted ? "currentColor" : "none"} />
        </button>

        {/* Add to Cart — visible on hover (desktop) */}
        <div className="absolute inset-0 flex items-end justify-center pb-4 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <button
            onClick={handleAddToCart}
            className="pointer-events-auto flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm font-medium rounded-full shadow-lg hover:bg-primary-600 hover:text-white transition-colors"
          >
            <ShoppingBag size={16} />
            Add to Cart
          </button>
        </div>

        {/* Out of stock overlay */}
        {!product.inStock && (
          <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 flex items-center justify-center">
            <span className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-full">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="space-y-1.5">
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
        {product.variants.length > 0 && (
          <p className="text-xs text-gray-400">
            {product.variants.length} {product.variants.length === 1 ? "variant" : "variants"}
          </p>
        )}
      </div>
    </motion.a>
  );
}
