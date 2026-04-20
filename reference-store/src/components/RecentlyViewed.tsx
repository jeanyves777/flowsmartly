"use client";

import { useEffect, useState } from "react";
import ProductCard from "./ProductCard";
import { useLiveProducts } from "@/lib/products-store";
import type { Product } from "@/lib/products";

const STORAGE_KEY = "store-recently-viewed-product-ids";
const MAX_ITEMS = 10;

/**
 * Read the recently-viewed product IDs from localStorage.
 * Safe on SSR — returns [] when window is undefined.
 */
function readRecentIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Record a product view in localStorage. Most-recent-first, capped at MAX_ITEMS,
 * deduplicates by id. Fires a "recently-viewed-updated" event so mounted rails
 * re-render.
 */
export function trackProductView(productId: string): void {
  if (typeof window === "undefined" || !productId) return;
  try {
    const current = readRecentIds();
    const next = [productId, ...current.filter((id) => id !== productId)].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("recently-viewed-updated"));
  } catch {
    // Silent — localStorage may be disabled
  }
}

interface Props {
  excludeProductId?: string;
  title?: string;
  maxCount?: number;
}

/**
 * Horizontal rail of recently-viewed products. Pass excludeProductId on the
 * product-detail page to avoid showing the current product in its own rail.
 * Renders nothing if there are no tracked views or the live products list
 * hasn't resolved yet.
 */
export default function RecentlyViewed({
  excludeProductId,
  title = "Recently Viewed",
  maxCount = 8,
}: Props) {
  const { products, loading } = useLiveProducts();
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setIds(readRecentIds());
    sync();
    window.addEventListener("recently-viewed-updated", sync);
    return () => window.removeEventListener("recently-viewed-updated", sync);
  }, []);

  if (loading || ids.length === 0) return null;

  const byId = new Map(products.map((p) => [p.id, p]));
  const items: Product[] = ids
    .filter((id) => id !== excludeProductId)
    .map((id) => byId.get(id))
    .filter((p): p is Product => Boolean(p))
    .slice(0, maxCount);

  if (items.length === 0) return null;

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-6">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {items.map((product, i) => (
          <ProductCard key={product.id} product={product} index={i} />
        ))}
      </div>
    </section>
  );
}
