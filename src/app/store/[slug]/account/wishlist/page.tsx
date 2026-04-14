"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface WishlistItem {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    slug: string;
    priceCents: number;
    currency: string;
    images: string;
  } | null;
}

export default function WishlistPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchWishlist = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/store/${slug}/account/wishlist`);
      if (res.status === 401) { router.push(`/store/${slug}/account/login`); return; }
      const data = await res.json();
      setItems(data.items || []);
    } catch { /* network error */ } finally {
      setLoading(false);
    }
  }, [slug, router]);

  useEffect(() => { fetchWishlist(); }, [fetchWishlist]);

  async function removeFromWishlist(productId: string) {
    setRemovingId(productId);
    try {
      await fetch(`/api/store/${slug}/account/wishlist`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      setItems((prev) => prev.filter((i) => i.productId !== productId));
    } catch { /* ignore */ } finally {
      setRemovingId(null);
    }
  }

  function formatMoney(cents: number, currency: string) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(cents / 100);
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/store/${slug}/account`} className="text-sm opacity-50 hover:opacity-80">← Account</Link>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--store-font-heading), sans-serif" }}>
          Wishlist
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color: "var(--store-primary)" }} />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border p-10 text-center" style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}>
          <p className="opacity-50 mb-3">Your wishlist is empty</p>
          <Link href={`/stores/${slug}/products`} className="text-sm font-medium hover:underline" style={{ color: "var(--store-primary)" }}>
            Browse products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => {
            const product = item.product;
            if (!product) return null;
            let imageUrl = "";
            try {
              const imgs = JSON.parse(product.images || "[]");
              imageUrl = imgs[0]?.url || "";
            } catch { /* empty */ }
            return (
              <div key={item.id} className="rounded-xl border overflow-hidden group relative" style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}>
                {/* Remove button */}
                <button
                  onClick={() => removeFromWishlist(item.productId)}
                  disabled={removingId === item.productId}
                  className="absolute top-2 right-2 z-10 h-7 w-7 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/70 transition-colors disabled:opacity-50"
                  title="Remove from wishlist"
                >
                  {removingId === item.productId ? (
                    <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent block" />
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
                <Link href={`/stores/${slug}/products/${product.slug}`}>
                  <div className="aspect-square bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    {imageUrl ? (
                      <img src={imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center opacity-20">
                        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </Link>
                <div className="p-3">
                  <p className="font-medium text-sm line-clamp-1">{product.name}</p>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--store-primary)" }}>
                    {formatMoney(product.priceCents, product.currency)}
                  </p>
                  <Link
                    href={`/stores/${slug}/products/${product.slug}`}
                    className="mt-2 block text-center text-xs py-1.5 rounded-lg text-white font-medium"
                    style={{ backgroundColor: "var(--store-primary)" }}
                  >
                    Add to Cart
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
