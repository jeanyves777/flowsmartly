"use client";

import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import { storeInfo } from "@/lib/data";

interface PolicyPageProps {
  title: string;
  content: string; // HTML string from policies object in data.ts
}

export default function PolicyPage({ title, content }: PolicyPageProps) {
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <>
      <Header onCartOpen={() => setCartOpen(true)} />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <article>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {title}
          </h1>
          <p className="text-sm text-gray-400 mb-8">
            Last updated: {new Date().toLocaleDateString()}
          </p>
          <div
            className="prose dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </article>
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
