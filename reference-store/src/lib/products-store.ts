/**
 * Live products store — fetches products from the DB-backed API so changes
 * (name, price, deletion) show up on the storefront without any rebuild.
 *
 * Pattern: module-scoped cache with a 15s TTL + subscribers. Components opt
 * in via useLiveProducts() / useLiveProduct(slug). The first consumer kicks
 * off the fetch; subsequent mounts within the TTL reuse the cache. After
 * TTL, the next useLiveProducts call refreshes in the background.
 *
 * This replaces the static `products` array in @/lib/products as the source
 * of truth for runtime data. The types in @/lib/products remain authoritative.
 */

"use client";

import { useEffect, useState } from "react";
import { storeInfo } from "./data";
import type { Product } from "./products";

const STORE_SLUG = storeInfo.logoUrl.match(/\/stores\/([^/]+)\//)?.[1] || "";
const API_BASE = "https://flowsmartly.com";
const CACHE_TTL_MS = 15_000;

let cache: Product[] | null = null;
let cacheAt = 0;
let inflight: Promise<Product[]> | null = null;
const listeners = new Set<(p: Product[]) => void>();

function normalizeProduct(raw: unknown): Product {
  const p = raw as Record<string, unknown>;
  return {
    id: String(p.id || ""),
    slug: String(p.slug || ""),
    name: String(p.name || ""),
    description: String(p.description || ""),
    shortDescription: String(p.shortDescription || ""),
    priceCents: Number(p.priceCents || 0),
    comparePriceCents: p.comparePriceCents ? Number(p.comparePriceCents) : undefined,
    categoryId: String(p.categoryId || ""),
    tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
    images: Array.isArray(p.images) ? (p.images as Product["images"]) : [],
    variants: Array.isArray(p.variants) ? (p.variants as Product["variants"]) : [],
    labels: Array.isArray(p.labels) ? (p.labels as Product["labels"]) : [],
    featured: Boolean(p.featured),
    inStock: Boolean(p.inStock),
  };
}

export async function loadLiveProducts(force = false): Promise<Product[]> {
  const fresh = cache !== null && Date.now() - cacheAt < CACHE_TTL_MS;
  if (fresh && !force) return cache!;
  if (inflight) return inflight;

  inflight = fetch(`${API_BASE}/api/store/${STORE_SLUG}/products?limit=500`, {
    cache: "no-store",
  })
    .then((r) => r.json())
    .then((json) => {
      const raw = json?.success ? json?.data?.products : [];
      const list = Array.isArray(raw) ? raw.map(normalizeProduct) : [];
      cache = list;
      cacheAt = Date.now();
      listeners.forEach((l) => l(list));
      return list;
    })
    .catch(() => cache || [])
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function useLiveProducts(): { products: Product[]; loading: boolean } {
  const [products, setProducts] = useState<Product[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    listeners.add(setProducts);
    loadLiveProducts().then((p) => {
      setProducts(p);
      setLoading(false);
    });
    return () => {
      listeners.delete(setProducts);
    };
  }, []);

  return { products, loading };
}

export async function loadLiveProductBySlug(slug: string): Promise<Product | null> {
  try {
    // Strip any trailing slash — stores with trailingSlash:true in their
    // next.config can pass "foo/" as params.slug. encodeURIComponent would
    // turn that into "foo%2F" and the API would 404.
    const cleanSlug = slug.replace(/\/+$/, "");
    if (!cleanSlug) return null;
    const res = await fetch(
      `${API_BASE}/api/store/${STORE_SLUG}/products/${encodeURIComponent(cleanSlug)}`,
      { cache: "no-store" }
    );
    const json = await res.json();
    if (!json?.success || !json?.data?.product) return null;
    const p = json.data.product as Record<string, unknown>;
    return normalizeProduct({
      ...p,
      featured: Array.isArray(p.labels) && (p.labels as string[]).includes("featured"),
      inStock: p.trackInventory ? Number(p.quantity || 0) > 0 : true,
    });
  } catch {
    return null;
  }
}

export function useLiveProduct(slug: string): { product: Product | null; loading: boolean } {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadLiveProductBySlug(slug).then((p) => {
      if (!cancelled) {
        setProduct(p);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { product, loading };
}
