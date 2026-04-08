"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import Header from "@/components/Header";
import ProductGrid from "@/components/ProductGrid";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import { categories, storeUrl } from "@/lib/data";

// Static export: generate all category pages at build time
export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }));
}

export default function CategoryPage({ params }: { params: { slug: string } }) {
  const [cartOpen, setCartOpen] = useState(false);
  const category = categories.find(c => c.slug === params.slug);

  if (!category) {
    return (
      <>
        <Header onCartOpen={() => setCartOpen(true)} />
        <main className="pt-24 pb-16 px-4 max-w-7xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Category Not Found
          </h1>
          <a href={storeUrl("/products")} className="text-primary-600 hover:underline">
            Browse all products
          </a>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header onCartOpen={() => setCartOpen(true)} />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <a
          href={storeUrl("/products")}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 mb-6"
        >
          <ChevronLeft size={14} />
          All Products
        </a>

        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            {category.name}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {category.description}
          </p>
        </div>

        <ProductGrid initialCategory={category.id} />
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
