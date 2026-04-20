"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, Minus, Plus, ChevronLeft, ChevronRight, Check, Package, Truck, RotateCcw, Heart, Star, ShieldCheck, Share2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import ProductCard from "@/components/ProductCard";
import Link from "next/link";
import { formatPrice, storeInfo } from "@/lib/data";
import type { Product, ProductVariant } from "@/lib/products";
import { useLiveProduct, useLiveProducts } from "@/lib/products-store";
import { addToCart } from "@/lib/cart";

const STORE_SLUG = (() => {
  if (typeof window === "undefined") return "";
  try {
    const m = window.location.pathname.match(/\/stores\/([^/]+)/);
    return m?.[1] || "";
  } catch { return ""; }
})();
const API_BASE = "https://flowsmartly.com";

interface Review {
  id: string;
  customerName: string;
  rating: number;
  title: string | null;
  comment: string | null;
  verified: boolean;
  createdAt: string;
}

export default function ProductDetailClient({ params }: { params: { slug: string } }) {
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  // Wishlist
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  // Share link copied indicator
  const [linkCopied, setLinkCopied] = useState(false);

  // Reviews
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState({ avgRating: 0, reviewCount: 0, salesCount: 0 });
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const { product, loading: productLoading } = useLiveProduct(params.slug);
  const { products: allLiveProducts } = useLiveProducts();

  // Sync wishlist
  useEffect(() => {
    if (!product) return;
    const sync = () => setWishlisted((window.__storeWishlist || []).includes(product.id));
    sync();
    window.addEventListener("wishlist-updated", sync);
    return () => window.removeEventListener("wishlist-updated", sync);
  }, [product?.id]);

  // Keyboard arrows navigate between product images
  useEffect(() => {
    if (!product || product.images.length <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      const len = product.images.length;
      if (e.key === "ArrowLeft") setSelectedImageIdx((i) => (i - 1 + len) % len);
      else if (e.key === "ArrowRight") setSelectedImageIdx((i) => (i + 1) % len);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [product?.id, product?.images.length]);

  // Touch-swipe navigation for the main image on mobile
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    swipeRef.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!swipeRef.current || !product || product.images.length <= 1) return;
    const start = swipeRef.current;
    const end = e.changedTouches[0];
    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    swipeRef.current = null;
    // Horizontal swipe only — require ≥50px and more horizontal than vertical motion
    if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return;
    const len = product.images.length;
    if (dx > 0) setSelectedImageIdx((i) => (i - 1 + len) % len);
    else setSelectedImageIdx((i) => (i + 1) % len);
  };

  // Fetch reviews
  useEffect(() => {
    if (!product || !STORE_SLUG) return;
    fetch(`${API_BASE}/api/store/${STORE_SLUG}/products/${product.slug}/reviews`)
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setReviews(json.data.reviews || []);
          setReviewStats(json.data.stats || { avgRating: 0, reviewCount: 0, salesCount: 0 });
        }
      })
      .catch(() => {});
  }, [product?.slug]);

  if (productLoading) {
    return (
      <>
        <Header onCartOpen={() => setCartOpen(true)} />
        <main className="pt-24 pb-16 px-4 max-w-7xl mx-auto text-center">
          <div className="animate-pulse text-gray-400 dark:text-gray-500 text-sm">Loading product…</div>
        </main>
        <Footer />
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Header onCartOpen={() => setCartOpen(true)} />
        <main className="pt-24 pb-16 px-4 max-w-7xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Product Not Found</h1>
          <Link href="/products" className="text-primary-600 hover:underline">Browse all products</Link>
        </main>
        <Footer />
      </>
    );
  }

  const activeVariant = selectedVariant || product.variants[0];
  const price = activeVariant?.priceCents || product.priceCents;
  const comparePrice = activeVariant?.comparePriceCents || product.comparePriceCents;
  const relatedProducts: Product[] = allLiveProducts
    .filter((p) => p.categoryId === product.categoryId && p.id !== product.id)
    .slice(0, 4);
  const labels = product.labels || [];
  const shippingThreshold = (storeInfo as Record<string, unknown>).freeShippingThresholdCents as number || 5000;

  const handleAddToCart = () => {
    addToCart({ productId: product.id, variantId: activeVariant?.id, name: product.name, variantName: activeVariant?.name, priceCents: price, imageUrl: activeVariant?.imageUrl || product.images[0]?.url || "" }, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const shareData = {
      title: product.name,
      text: product.shortDescription || product.description || product.name,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      // User cancelled or share failed — fall through to copy
    }
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Last resort: nothing to do if clipboard unavailable
    }
  };

  const handleWishlist = async () => {
    if (!window.__storeCustomer) {
      window.dispatchEvent(new CustomEvent("open-account-modal"));
      return;
    }
    if (wishlistLoading) return;
    setWishlistLoading(true);
    try {
      if (wishlisted) {
        await fetch(`${API_BASE}/api/store/${STORE_SLUG}/account/wishlist`, { method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: product.id }) });
        window.__storeWishlist = (window.__storeWishlist || []).filter(id => id !== product.id);
      } else {
        await fetch(`${API_BASE}/api/store/${STORE_SLUG}/account/wishlist`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: product.id }) });
        window.__storeWishlist = [...(window.__storeWishlist || []), product.id];
      }
      window.dispatchEvent(new CustomEvent("wishlist-updated"));
    } catch {} finally { setWishlistLoading(false); }
  };

  const handleSubmitReview = async () => {
    if (!window.__storeCustomer) {
      window.dispatchEvent(new CustomEvent("open-account-modal"));
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await fetch(`${API_BASE}/api/store/${STORE_SLUG}/products/${product.slug}/reviews`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: reviewRating, title: reviewTitle, comment: reviewComment }),
      });
      const json = await res.json();
      if (json.success) {
        setReviewSubmitted(true);
        setShowReviewForm(false);
        setReviews(prev => [json.data, ...prev]);
        setReviewStats(prev => ({ ...prev, reviewCount: prev.reviewCount + 1 }));
      }
    } catch {} finally { setSubmittingReview(false); }
  };

  const renderStars = (rating: number, size = 16) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={size} className={i <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300 dark:text-gray-600"} />
      ))}
    </div>
  );

  return (
    <>
      <Header onCartOpen={() => setCartOpen(true)} />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <Link href="/products" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 mb-8">
          <ChevronLeft size={14} /> Back to Products
        </Link>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Image gallery */}
          <div>
            <div
              className="aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-4 relative group touch-pan-y"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <motion.img
                key={selectedImageIdx}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                src={product.images[selectedImageIdx]?.url}
                alt={product.images[selectedImageIdx]?.alt}
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Prev / Next arrows */}
              {product.images.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedImageIdx((i) => (i - 1 + product.images.length) % product.images.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 shadow-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity hover:scale-105"
                    aria-label="Previous image"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={() => setSelectedImageIdx((i) => (i + 1) % product.images.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 shadow-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity hover:scale-105"
                    aria-label="Next image"
                  >
                    <ChevronRight size={20} />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-2.5 py-1 rounded-full bg-black/50 text-white text-xs font-medium">
                    {selectedImageIdx + 1} / {product.images.length}
                  </div>
                </>
              )}
              {/* Wishlist + Share stacked */}
              <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                <button
                  onClick={handleWishlist}
                  disabled={wishlistLoading}
                  className={`p-3 rounded-full shadow-lg transition-all ${
                    wishlisted ? "bg-red-500 text-white" : "bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 hover:text-red-500"
                  }`}
                  aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                >
                  <Heart size={22} fill={wishlisted ? "currentColor" : "none"} />
                </button>
                <button
                  onClick={handleShare}
                  className="p-3 rounded-full shadow-lg transition-all bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 hover:text-primary-600 relative"
                  aria-label="Share this product"
                >
                  <Share2 size={22} />
                  {linkCopied && (
                    <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md bg-gray-900 text-white text-xs whitespace-nowrap shadow-lg">
                      Link copied
                    </span>
                  )}
                </button>
              </div>
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-3 flex-wrap">
                {product.images.map((img, i) => (
                  <button key={i} onClick={() => setSelectedImageIdx(i)} className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-colors ${i === selectedImageIdx ? "border-primary-600" : "border-transparent hover:border-gray-300"}`}>
                    <img src={img.url} alt={img.alt} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product info */}
          <div>
            {/* Labels */}
            {labels.length > 0 && (
              <div className="flex gap-2 mb-4">
                {labels.map((badge: string) => (
                  <span key={badge} className={`px-3 py-1 text-xs font-bold rounded-full ${
                    badge === "sale" || badge === "discount" ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" :
                    badge === "new" ? "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400" :
                    badge === "bestseller" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" :
                    "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                  }`}>
                    {badge.charAt(0).toUpperCase() + badge.slice(1)}
                  </span>
                ))}
              </div>
            )}

            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">{product.name}</h1>

            {/* Rating + sales */}
            <div className="flex items-center gap-3 mb-4">
              {reviewStats.reviewCount > 0 && (
                <>
                  {renderStars(Math.round(reviewStats.avgRating))}
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {reviewStats.avgRating.toFixed(1)} ({reviewStats.reviewCount} review{reviewStats.reviewCount !== 1 ? "s" : ""})
                  </span>
                </>
              )}
              {reviewStats.salesCount > 0 && (
                <span className="text-sm text-gray-400 dark:text-gray-500">
                  {reviewStats.salesCount} sold
                </span>
              )}
            </div>

            {/* Price */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{formatPrice(price)}</span>
              {comparePrice && comparePrice > price && (
                <>
                  <span className="text-lg text-gray-400 line-through">{formatPrice(comparePrice)}</span>
                  <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-bold rounded-full">
                    Save {Math.round((1 - price / comparePrice) * 100)}%
                  </span>
                </>
              )}
            </div>

            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-8">{product.description}</p>

            {/* Variants */}
            {product.variants.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Options</h3>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map(variant => (
                    <button key={variant.id} onClick={() => setSelectedVariant(variant)} disabled={!variant.inStock}
                      className={`px-4 py-2.5 rounded-full text-sm font-medium border transition-all ${
                        activeVariant?.id === variant.id ? "border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-600" :
                        variant.inStock ? "border-gray-200 dark:border-gray-700 hover:border-gray-400 text-gray-700 dark:text-gray-300" :
                        "border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 line-through cursor-not-allowed"
                      }`}
                    >{variant.name}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Add to Cart + Wishlist */}
            <div className="flex items-center gap-3 mb-8">
              <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-full">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"><Minus size={16} /></button>
                <span className="w-10 text-center font-medium text-gray-900 dark:text-white">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="p-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"><Plus size={16} /></button>
              </div>
              <button onClick={handleAddToCart} disabled={!product.inStock}
                className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-full font-semibold text-white transition-all ${
                  added ? "bg-green-500" : product.inStock ? "bg-primary-600 hover:bg-primary-700" : "bg-gray-400 cursor-not-allowed"
                }`}
              >
                {added ? (<><Check size={18} />Added!</>) : (<><ShoppingBag size={18} />{product.inStock ? "Add to Cart" : "Out of Stock"}</>)}
              </button>
              <button onClick={handleWishlist} disabled={wishlistLoading}
                className={`p-4 rounded-full border transition-all ${
                  wishlisted ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-500" : "border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-500 hover:border-red-200"
                }`}
                aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
              >
                <Heart size={20} fill={wishlisted ? "currentColor" : "none"} />
              </button>
            </div>

            {/* Trust badges — dynamic shipping threshold */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
              <div className="text-center"><Package size={20} className="mx-auto text-primary-600 mb-1.5" /><p className="text-xs text-gray-500 dark:text-gray-400">Quality Assured</p></div>
              <div className="text-center"><Truck size={20} className="mx-auto text-primary-600 mb-1.5" /><p className="text-xs text-gray-500 dark:text-gray-400">Free Shipping {formatPrice(shippingThreshold)}+</p></div>
              <div className="text-center"><RotateCcw size={20} className="mx-auto text-primary-600 mb-1.5" /><p className="text-xs text-gray-500 dark:text-gray-400">30-Day Returns</p></div>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <section className="mt-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Customer Reviews</h2>
              {reviewStats.reviewCount > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  {renderStars(Math.round(reviewStats.avgRating))}
                  <span className="text-sm text-gray-500">{reviewStats.avgRating.toFixed(1)} out of 5 ({reviewStats.reviewCount} review{reviewStats.reviewCount !== 1 ? "s" : ""})</span>
                </div>
              )}
            </div>
            {!reviewSubmitted && !showReviewForm && (
              <button onClick={() => setShowReviewForm(true)} className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors">
                Write a Review
              </button>
            )}
          </div>

          {/* Review Form */}
          {showReviewForm && (
            <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Write Your Review</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Rating</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <button key={i} onClick={() => setReviewRating(i)} className="p-1">
                        <Star size={28} className={i <= reviewRating ? "text-yellow-400 fill-yellow-400" : "text-gray-300 dark:text-gray-600"} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title (optional)</label>
                  <input type="text" value={reviewTitle} onChange={e => setReviewTitle(e.target.value)} placeholder="Summarize your experience"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Review</label>
                  <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} rows={3} placeholder="What did you like or dislike?"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
                </div>
                <div className="flex gap-3">
                  <button onClick={handleSubmitReview} disabled={submittingReview}
                    className="px-6 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-full hover:bg-primary-700 disabled:opacity-50 transition-colors">
                    {submittingReview ? "Submitting..." : "Submit Review"}
                  </button>
                  <button onClick={() => setShowReviewForm(false)} className="px-6 py-2.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {reviewSubmitted && (
            <div className="mb-8 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
              <p className="text-sm font-medium text-green-700 dark:text-green-300">Thank you! Your review has been submitted.</p>
            </div>
          )}

          {/* Reviews List */}
          {reviews.length > 0 ? (
            <div className="space-y-6">
              {reviews.map(review => (
                <div key={review.id} className="border-b border-gray-100 dark:border-gray-800 pb-6 last:border-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-sm font-bold text-primary-600">
                      {review.customerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{review.customerName}</span>
                        {review.verified && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <ShieldCheck size={12} /> Verified Purchase
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {renderStars(review.rating, 14)}
                        <span className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  {review.title && <p className="font-medium text-gray-900 dark:text-white text-sm mb-1">{review.title}</p>}
                  {review.comment && <p className="text-sm text-gray-600 dark:text-gray-300">{review.comment}</p>}
                </div>
              ))}
            </div>
          ) : !showReviewForm && !reviewSubmitted && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <Star size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No reviews yet. Be the first to review this product!</p>
            </div>
          )}
        </section>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="mt-20">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">You might also like</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {relatedProducts.map((p, i) => (<ProductCard key={p.id} product={p} index={i} />))}
            </div>
          </section>
        )}
      </main>
      <Footer />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} storeSlug={STORE_SLUG} />

      {/* Sticky mobile Add-to-Cart bar — sits above the MobileBottomNav (h-16) */}
      <div className="sm:hidden fixed left-0 right-0 bottom-16 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 px-3 py-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 flex items-baseline gap-1.5">
            <span className="text-base font-bold text-gray-900 dark:text-white">{formatPrice(price)}</span>
            {comparePrice && comparePrice > price && (
              <span className="text-[11px] text-gray-400 line-through">{formatPrice(comparePrice)}</span>
            )}
          </div>
          <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-full flex-shrink-0 ml-auto">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
              aria-label="Decrease quantity"
            >
              <Minus size={14} />
            </button>
            <span className="w-7 text-center text-sm font-medium text-gray-900 dark:text-white">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
              aria-label="Increase quantity"
            >
              <Plus size={14} />
            </button>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={!product.inStock}
            className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full font-semibold text-white text-sm transition-all flex-shrink-0 ${
              added ? "bg-green-500" : product.inStock ? "bg-primary-600 active:bg-primary-700" : "bg-gray-400"
            }`}
          >
            {added ? (
              <>
                <Check size={15} /> Added
              </>
            ) : (
              <>
                <ShoppingBag size={15} /> {product.inStock ? "Add" : "Out"}
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
