"use client";

import { useState } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import CategoryShowcase from "@/components/CategoryShowcase";
import FeaturedProducts from "@/components/FeaturedProducts";
import AboutSection from "@/components/AboutSection";
import Newsletter from "@/components/Newsletter";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";

export default function HomePage() {
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <>
      <Header onCartOpen={() => setCartOpen(true)} />
      <main>
        <Hero />
        <CategoryShowcase />
        <FeaturedProducts />
        <AboutSection />
        <Newsletter />
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
