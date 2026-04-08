"use client";

import { useState } from "react";
import Header from "@/components/Header";
import ProductGrid from "@/components/ProductGrid";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";

export default function ProductsPage() {
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <>
      <Header onCartOpen={() => setCartOpen(true)} />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            All Products
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Browse our full collection
          </p>
        </div>
        <ProductGrid />
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
