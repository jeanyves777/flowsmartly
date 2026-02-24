"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";

interface Product {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  currency: string;
  imageUrl?: string;
  viewCount: number;
  orderCount: number;
}

interface RecentlyViewedItem {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  currency: string;
  imageUrl?: string;
}

interface RecommendationsData {
  similar: Product[];
  boughtTogether: Product[];
  trending: Product[];
}

interface ProductRecommendationsProps {
  storeSlug: string;
  productId: string;
  primaryColor: string;
  cardStyle?: "shadow" | "bordered" | "sharp" | "rounded" | "minimal";
}

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function getCardClasses(cardStyle?: string): string {
  switch (cardStyle) {
    case "shadow":
      return "shadow-md rounded-lg";
    case "bordered":
      return "border border-gray-200 rounded-lg";
    case "sharp":
      return "border border-gray-200 rounded-none";
    case "rounded":
      return "border border-gray-200 rounded-2xl";
    case "minimal":
      return "rounded-lg";
    default:
      return "border border-gray-200 rounded-lg";
  }
}

function getImageClasses(cardStyle?: string): string {
  switch (cardStyle) {
    case "sharp":
      return "rounded-none";
    case "rounded":
      return "rounded-t-2xl";
    default:
      return "rounded-t-lg";
  }
}

function ProductCard({
  product,
  storeSlug,
  primaryColor,
  cardStyle,
  size = "normal",
}: {
  product: Product | RecentlyViewedItem;
  storeSlug: string;
  primaryColor: string;
  cardStyle?: string;
  size?: "small" | "normal";
}) {
  const [isHovered, setIsHovered] = useState(false);
  const imgSize = size === "small" ? 150 : 200;

  return (
    <Link
      href={`/store/${storeSlug}/products/${product.slug}`}
      className={`block overflow-hidden transition-all ${getCardClasses(cardStyle)}`}
      style={{
        borderColor: isHovered ? 'var(--store-primary)' : undefined,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="aspect-square overflow-hidden bg-gray-100 relative">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            width={imgSize}
            height={imgSize}
            className={`w-full h-full object-cover ${getImageClasses(cardStyle)}`}
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${getImageClasses(cardStyle)}`}>
            <Package className="h-8 w-8 text-gray-300" />
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium truncate">{product.name}</p>
        <p className="text-sm font-semibold mt-1" style={{ color: 'var(--store-primary)' }}>
          {formatPrice(product.priceCents, product.currency)}
        </p>
      </div>
    </Link>
  );
}

function SkeletonLoader() {
  return (
    <div className="flex gap-4 mt-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="w-[150px] flex-shrink-0">
          <div className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
          <div className="mt-2 h-4 bg-gray-200 rounded animate-pulse w-3/4" />
          <div className="mt-1 h-4 bg-gray-200 rounded animate-pulse w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function ProductRecommendations({
  storeSlug,
  productId,
  primaryColor,
  cardStyle,
}: ProductRecommendationsProps) {
  const [data, setData] = useState<RecommendationsData | null>(null);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const storageKey = `flowshop-recently-viewed-${storeSlug}`;

  const updateRecentlyViewed = useCallback(
    (currentProduct: RecentlyViewedItem) => {
      try {
        const stored = localStorage.getItem(storageKey);
        const existing: RecentlyViewedItem[] = stored ? JSON.parse(stored) : [];

        // Remove duplicate if exists
        const filtered = existing.filter((item) => item.id !== currentProduct.id);

        // Add current product to front
        const updated = [currentProduct, ...filtered].slice(0, 10);

        localStorage.setItem(storageKey, JSON.stringify(updated));

        // Set display list excluding current product
        setRecentlyViewed(updated.filter((item) => item.id !== productId));
      } catch {
        // localStorage not available
      }
    },
    [storageKey, productId]
  );

  const loadRecentlyViewed = useCallback(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const items: RecentlyViewedItem[] = JSON.parse(stored);
        setRecentlyViewed(items.filter((item) => item.id !== productId));
      }
    } catch {
      // localStorage not available
    }
  }, [storageKey, productId]);

  useEffect(() => {
    let cancelled = false;

    // Load recently viewed immediately
    loadRecentlyViewed();

    async function fetchRecommendations() {
      try {
        const res = await fetch(
          `/api/store/${storeSlug}/recommendations?productId=${productId}`
        );

        if (!res.ok) {
          setLoading(false);
          return;
        }

        const json = await res.json();

        if (!cancelled && json.success) {
          const recData = json.data as RecommendationsData;
          setData(recData);

          // Build current product info from available data for recently viewed
          const allProducts = [
            ...recData.similar,
            ...recData.boughtTogether,
            ...recData.trending,
          ];
          // We don't have the current product in recommendations, so use minimal info
          // The current product info will come from the first available source
          // or we construct it from what we know
          const currentFromRecs = allProducts.find((p) => p.id === productId);

          if (currentFromRecs) {
            updateRecentlyViewed({
              id: currentFromRecs.id,
              name: currentFromRecs.name,
              slug: currentFromRecs.slug,
              priceCents: currentFromRecs.priceCents,
              currency: currentFromRecs.currency,
              imageUrl: currentFromRecs.imageUrl,
            });
          }
        }
      } catch {
        // Silently fail - recommendations are not critical
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchRecommendations();

    return () => {
      cancelled = true;
    };
  }, [storeSlug, productId, loadRecentlyViewed, updateRecentlyViewed]);

  if (loading) {
    return (
      <div className="mt-8">
        <SkeletonLoader />
      </div>
    );
  }

  const hasBoughtTogether = data && data.boughtTogether.length > 0;
  const hasSimilar = data && data.similar.length > 0;
  const hasRecentlyViewed = recentlyViewed.length > 0;

  // Render nothing if all sections are empty
  if (!hasBoughtTogether && !hasSimilar && !hasRecentlyViewed) {
    return null;
  }

  return (
    <div>
      {/* Frequently Bought Together */}
      {hasBoughtTogether && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Frequently Bought Together</h3>
          <div className="flex gap-4 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 lg:overflow-x-visible">
            {data!.boughtTogether.map((product) => (
              <div key={product.id} className="w-[170px] flex-shrink-0 lg:w-auto">
                <ProductCard
                  product={product}
                  storeSlug={storeSlug}
                  primaryColor={primaryColor}
                  cardStyle={cardStyle}
                  size="small"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* You May Also Like */}
      {hasSimilar && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">You May Also Like</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {data!.similar.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                storeSlug={storeSlug}
                primaryColor={primaryColor}
                cardStyle={cardStyle}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recently Viewed */}
      {hasRecentlyViewed && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Recently Viewed</h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {recentlyViewed.map((item) => (
              <div key={item.id} className="w-[150px] flex-shrink-0">
                <ProductCard
                  product={item}
                  storeSlug={storeSlug}
                  primaryColor={primaryColor}
                  cardStyle={cardStyle}
                  size="small"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
