"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, Minus, Plus, ChevronLeft, Check, Package, Truck, RotateCcw } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import ProductCard from "@/components/ProductCard";
import { storeUrl, formatPrice } from "@/lib/data";
import { products, getProductBySlug, getProductsByCategory } from "@/lib/products";
import { addToCart } from "@/lib/cart";
import type { ProductVariant } from "@/lib/products";

// NOTE: Do NOT use generateStaticParams() with "use client" — they conflict in Next.js 15.
// For static export (output: 'export'), Next.js generates pages from the route structure.
// If you need static params, create a separate server component wrapper.

export default function ProductDetailPage({ params }: { params: { slug: string } }) {
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const product = getProductBySlug(params.slug);
  if (!product) {
    return (
      <>
        <Header onCartOpen={() => setCartOpen(true)} />
        <main className="pt-24 pb-16 px-4 max-w-7xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Product Not Found</h1>
          <a href={storeUrl("/products")} className="text-primary-600 hover:underline">
            Browse all products
          </a>
        </main>
        <Footer />
      </>
    );
  }

  const activeVariant = selectedVariant || product.variants[0];
  const price = activeVariant?.priceCents || product.priceCents;
  const comparePrice = activeVariant?.comparePriceCents || product.comparePriceCents;
  const relatedProducts = getProductsByCategory(product.categoryId)
    .filter(p => p.id !== product.id)
    .slice(0, 4);

  const handleAddToCart = () => {
    addToCart(
      {
        productId: product.id,
        variantId: activeVariant?.id,
        name: product.name,
        variantName: activeVariant?.name,
        priceCents: price,
        imageUrl: activeVariant?.imageUrl || product.images[0]?.url || "",
      },
      quantity
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <>
      <Header onCartOpen={() => setCartOpen(true)} />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <a
          href={storeUrl("/products")}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 mb-8"
        >
          <ChevronLeft size={14} />
          Back to Products
        </a>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Image gallery */}
          <div>
            <motion.div
              key={selectedImageIdx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-4"
            >
              {product.images[selectedImageIdx] && (
                <img
                  src={product.images[selectedImageIdx].url}
                  alt={product.images[selectedImageIdx].alt}
                  className="w-full h-full object-cover"
                />
              )}
            </motion.div>

            {/* Thumbnail strip */}
            {product.images.length > 1 && (
              <div className="flex gap-3">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImageIdx(i)}
                    className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-colors ${
                      i === selectedImageIdx
                        ? "border-primary-600"
                        : "border-transparent hover:border-gray-300"
                    }`}
                  >
                    <img src={img.url} alt={img.alt} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product info */}
          <div>
            {/* Badges */}
            <div className="flex gap-2 mb-4">
              {product.badges.map(badge => (
                <span
                  key={badge}
                  className={`px-3 py-1 text-xs font-bold rounded-full ${
                    badge === "sale"
                      ? "bg-red-100 text-red-600"
                      : badge === "new"
                      ? "bg-primary-100 text-primary-600"
                      : badge === "bestseller"
                      ? "bg-amber-100 text-amber-600"
                      : "bg-purple-100 text-purple-600"
                  }`}
                >
                  {badge.charAt(0).toUpperCase() + badge.slice(1)}
                </span>
              ))}
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
              {product.name}
            </h1>

            {/* Price */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatPrice(price)}
              </span>
              {comparePrice && comparePrice > price && (
                <>
                  <span className="text-lg text-gray-400 line-through">
                    {formatPrice(comparePrice)}
                  </span>
                  <span className="px-2 py-0.5 bg-red-100 text-red-600 text-sm font-bold rounded-full">
                    Save {Math.round((1 - price / comparePrice) * 100)}%
                  </span>
                </>
              )}
            </div>

            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-8">
              {product.description}
            </p>

            {/* Variants */}
            {product.variants.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Options
                </h3>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map(variant => (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedVariant(variant)}
                      disabled={!variant.inStock}
                      className={`px-4 py-2.5 rounded-full text-sm font-medium border transition-all ${
                        activeVariant?.id === variant.id
                          ? "border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-600"
                          : variant.inStock
                          ? "border-gray-200 dark:border-gray-700 hover:border-gray-400 text-gray-700 dark:text-gray-300"
                          : "border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 line-through cursor-not-allowed"
                      }`}
                    >
                      {variant.name}
                      {variant.priceCents !== product.priceCents && (
                        <span className="ml-1 text-xs">({formatPrice(variant.priceCents)})</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity + Add to cart */}
            <div className="flex items-center gap-4 mb-8">
              <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-full">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-3 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <Minus size={16} />
                </button>
                <span className="w-10 text-center font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-3 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={!product.inStock}
                className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-full font-semibold text-white transition-all ${
                  added
                    ? "bg-green-500"
                    : product.inStock
                    ? "bg-primary-600 hover:bg-primary-700 hover:shadow-lg hover:shadow-primary-600/25"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
              >
                {added ? (
                  <>
                    <Check size={18} />
                    Added to Cart!
                  </>
                ) : (
                  <>
                    <ShoppingBag size={18} />
                    {product.inStock ? "Add to Cart" : "Out of Stock"}
                  </>
                )}
              </button>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
              <div className="text-center">
                <Package size={20} className="mx-auto text-primary-600 mb-1.5" />
                <p className="text-xs text-gray-500 dark:text-gray-400">Quality Assured</p>
              </div>
              <div className="text-center">
                <Truck size={20} className="mx-auto text-primary-600 mb-1.5" />
                <p className="text-xs text-gray-500 dark:text-gray-400">Free Shipping $50+</p>
              </div>
              <div className="text-center">
                <RotateCcw size={20} className="mx-auto text-primary-600 mb-1.5" />
                <p className="text-xs text-gray-500 dark:text-gray-400">30-Day Returns</p>
              </div>
            </div>
          </div>
        </div>

        {/* Related products */}
        {relatedProducts.length > 0 && (
          <section className="mt-20">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
              You might also like
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {relatedProducts.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        storeSlug="example-store"
      />
    </>
  );
}
