"use client";

import { useState } from "react";
import Header from "@/components/Header";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";

export default function FAQPage() {
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <>
      <Header onCartOpen={() => setCartOpen(true)} />
      <main className="pt-24 pb-16">
        <FAQ />
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
