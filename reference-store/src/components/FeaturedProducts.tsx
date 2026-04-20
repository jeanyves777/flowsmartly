"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useLiveProducts } from "@/lib/products-store";
import ProductCard from "./ProductCard";

export default function FeaturedProducts() {
  const { products, loading } = useLiveProducts();
  const featured = products.filter((p) => p.featured);

  // While loading the first time, render nothing — the grid appears as soon
  // as the API returns. Never show stale data.
  if (loading || featured.length === 0) return null;

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-10">
        <div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Featured Products
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Our hand-picked favorites
          </p>
        </div>
        <Link
          href="/products"
          className="hidden sm:inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 font-medium hover:gap-3 transition-all"
        >
          View All
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {featured.slice(0, 8).map((product, i) => (
          <ProductCard key={product.id} product={product} index={i} />
        ))}
      </div>

      <div className="sm:hidden text-center mt-8">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 px-6 py-3 border border-gray-200 dark:border-gray-700 rounded-full text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          View All Products
          <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}
