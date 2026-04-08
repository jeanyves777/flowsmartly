"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Search, Menu, X } from "lucide-react";
import { storeInfo, navLinks, storeUrl } from "@/lib/data";
import { getCart, getCartCount } from "@/lib/cart";

export default function Header({ onCartOpen }: { onCartOpen?: () => void }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Listen for cart updates
  useEffect(() => {
    const update = () => setCartCount(getCartCount(getCart()));
    update();
    window.addEventListener("cart-updated", update);
    return () => window.removeEventListener("cart-updated", update);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <a href={storeUrl("/")} className="flex items-center gap-3">
            <img
              src={storeInfo.logoUrl}
              alt={`${storeInfo.name} logo`}
              className="h-16 sm:h-20 max-w-[200px] object-contain"
            />
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <a
              href={storeUrl("/products")}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-primary-600 transition-colors"
              aria-label="Search products"
            >
              <Search size={20} />
            </a>

            <button
              onClick={onCartOpen}
              className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-primary-600 transition-colors"
              aria-label="Open cart"
            >
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </button>

            {/* Mobile menu toggle — NEVER use AnimatePresence here (breaks static export) */}
            <button
              className="md:hidden p-2 text-gray-600 dark:text-gray-300"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800"
          >
            <nav className="px-4 py-4 space-y-3">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="block py-2 text-gray-700 dark:text-gray-200 hover:text-primary-600 font-medium"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
