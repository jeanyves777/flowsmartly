"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  ShoppingBag,
  Check,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface StoreProduct {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  images: string; // JSON string of [{url, alt}]
  status: string;
}

interface PromoteDefaults {
  headline: string;
  description: string;
  destinationUrl: string;
  mediaUrl: string | null;
  ctaText: string;
  adCategory: string;
  sourceProductId: string;
  sourceStoreId: string;
  name: string;
}

interface StoreProductPickerProps {
  onSelect: (product: {
    productId: string;
    storeId: string;
    headline: string;
    description: string;
    destinationUrl: string;
    mediaUrl: string | null;
    ctaText: string;
    adCategory: string;
    name: string;
  }) => void;
  onClear: () => void;
  selectedProductId: string | null;
}

function parseProductImages(
  imagesJson: string
): { url: string; alt: string }[] {
  try {
    const parsed = JSON.parse(imagesJson);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function StoreProductPicker({
  onSelect,
  onClear,
  selectedProductId,
}: StoreProductPickerProps) {
  const { toast } = useToast();

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [promotingId, setPromotingId] = useState<string | null>(null);

  // Fetch store products on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchProducts() {
      try {
        const res = await fetch(
          "/api/ecommerce/products?status=ACTIVE&limit=50"
        );
        const data = await res.json();

        if (cancelled) return;

        if (data.success && data.data?.products) {
          setProducts(data.data.products);
        } else {
          setProducts([]);
        }
      } catch {
        if (!cancelled) {
          setProducts([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(query));
  }, [products, searchQuery]);

  // Handle product selection - fetch promote defaults
  const handleSelect = useCallback(
    async (product: StoreProduct) => {
      if (promotingId) return;

      setPromotingId(product.id);

      try {
        const res = await fetch(
          `/api/ecommerce/promote?productId=${product.id}`
        );
        const data = await res.json();

        if (data.success && data.data?.defaults) {
          const defaults: PromoteDefaults = data.data.defaults;
          onSelect({
            productId: defaults.sourceProductId,
            storeId: defaults.sourceStoreId,
            headline: defaults.headline,
            description: defaults.description,
            destinationUrl: defaults.destinationUrl,
            mediaUrl: defaults.mediaUrl,
            ctaText: defaults.ctaText,
            adCategory: defaults.adCategory,
            name: defaults.name,
          });
        } else {
          toast({
            title: "Failed to load product details",
            description: "Please try again.",
          });
        }
      } catch {
        toast({
          title: "Something went wrong",
          description: "Could not fetch product promotion details.",
        });
      } finally {
        setPromotingId(null);
      }
    },
    [promotingId, onSelect, toast]
  );

  // Loading skeleton state
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full rounded-lg" />
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state - no store or no products
  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium">No products found</p>
        <p className="text-sm mt-1">
          Set up your FlowShop store to promote products
        </p>
        <Link
          href="/ecommerce"
          className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-brand-500 hover:text-brand-600 transition-colors"
        >
          Go to FlowShop
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Clear selection button */}
      {selectedProductId && (
        <button
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear Selection
        </button>
      )}

      {/* Product grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No products match your search</p>
        </div>
      ) : (
        <div className="max-h-[300px] overflow-y-auto pr-1 -mr-1">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {filteredProducts.map((product) => {
              const isSelected = selectedProductId === product.id;
              const isPromoting = promotingId === product.id;
              const images = parseProductImages(product.images);
              const firstImage = images[0] || null;

              return (
                <button
                  key={product.id}
                  onClick={() => handleSelect(product)}
                  disabled={!!promotingId}
                  className={`relative group rounded-xl overflow-hidden border-2 transition-all text-left ${
                    isSelected
                      ? "border-brand-500 ring-2 ring-brand-500/20"
                      : "border-transparent hover:border-muted-foreground/30"
                  } ${promotingId && !isPromoting ? "opacity-50" : ""}`}
                >
                  {/* Product image */}
                  <div className="aspect-[4/3] bg-muted relative">
                    {firstImage ? (
                      <img
                        src={firstImage.url}
                        alt={firstImage.alt || product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-brand-500/10 to-purple-500/10 flex items-center justify-center">
                        <ShoppingBag className="w-6 h-6 text-muted-foreground/40" />
                      </div>
                    )}

                    {/* Selection checkmark overlay */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-brand-500/20 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center">
                          <Check className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    )}

                    {/* Loading spinner overlay */}
                    {isPromoting && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Product info */}
                  <div className="p-2">
                    <p className="text-xs font-medium line-clamp-1">
                      {product.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      {formatPrice(product.priceCents)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
