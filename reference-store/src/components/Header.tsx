"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Search, Menu, X, ChevronRight, User } from "lucide-react";
import { storeInfo, navLinks, categories, formatPrice } from "@/lib/data";
import { getCart, getCartCount } from "@/lib/cart";
import ThemeToggle from "./ThemeToggle";

const ANNOUNCEMENT_MESSAGES = [
  "Secure checkout · Easy returns",
] as const;

export default function Header({ onCartOpen }: { onCartOpen?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const update = () => setCartCount(getCartCount(getCart()));
    update();
    window.addEventListener("cart-updated", update);
    return () => window.removeEventListener("cart-updated", update);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const freeShippingThreshold = (storeInfo as Record<string, unknown>).freeShippingThresholdCents as number | undefined;
  const announcementLines: string[] = [];
  if (freeShippingThreshold && freeShippingThreshold > 0) {
    announcementLines.push(`Free shipping on orders over ${formatPrice(freeShippingThreshold)}`);
  }
  for (const m of ANNOUNCEMENT_MESSAGES) announcementLines.push(m);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled
            ? "bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-sm"
            : "bg-white dark:bg-gray-900"
        }`}
      >
        {/* Announcement bar — free shipping threshold + trust signals */}
        {announcementLines.length > 0 && !scrolled && (
          <div className="bg-gray-900 dark:bg-gray-950 text-white overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 text-center text-[11px] sm:text-xs font-medium tracking-wide">
              <span className="inline-flex items-center gap-2">
                {announcementLines.map((line, i) => (
                  <span key={i} className="inline-flex items-center gap-2">
                    {i > 0 && <span className="hidden sm:inline text-white/30">•</span>}
                    <span className={i === 0 ? "" : "hidden sm:inline"}>{line}</span>
                  </span>
                ))}
              </span>
            </div>
          </div>
        )}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <Link href="/" className="flex items-center gap-3">
              {storeInfo.logoUrl ? (
                <img
                  src={storeInfo.logoUrl}
                  alt={`${storeInfo.name} logo`}
                  className="h-12 sm:h-14 md:h-16 max-w-[220px] object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    const sibling = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                    if (sibling) sibling.style.display = "flex";
                  }}
                />
              ) : null}
              <span
                className="font-bold text-lg text-gray-900 dark:text-white"
                style={{ display: storeInfo.logoUrl ? "none" : "flex" }}
              >
                {storeInfo.name}
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-1">
              <Link
                href="/products"
                className="hidden sm:flex p-2 text-gray-600 dark:text-gray-300 hover:text-primary-600 transition-colors"
                aria-label="Search"
              >
                <Search size={20} />
              </Link>

              <button
                onClick={() => window.dispatchEvent(new CustomEvent("toggle-account"))}
                className="hidden md:flex p-2 text-gray-600 dark:text-gray-300 hover:text-primary-600 transition-colors"
                aria-label="Account"
              >
                <User size={20} />
              </button>

              <ThemeToggle className="hidden sm:flex" />

              <button
                onClick={onCartOpen}
                className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-primary-600 transition-colors"
                aria-label="Cart"
              >
                <ShoppingBag size={20} />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-primary-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </button>

              <button
                className="md:hidden p-2 text-gray-600 dark:text-gray-300"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
              >
                <Menu size={24} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />

            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-[85%] max-w-sm bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <Link href="/" onClick={() => setMenuOpen(false)}>
                  {storeInfo.logoUrl ? (
                    <img src={storeInfo.logoUrl} alt={storeInfo.name} className="h-12 max-w-[180px] object-contain" />
                  ) : (
                    <span className="font-bold text-lg">{storeInfo.name}</span>
                  )}
                </Link>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto py-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-between px-5 py-3.5 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <span className="font-medium">{link.label}</span>
                    <ChevronRight size={16} className="text-gray-400" />
                  </Link>
                ))}

                {categories.length > 0 && (
                  <>
                    <div className="mx-5 my-3 border-t border-gray-100 dark:border-gray-800" />
                    <p className="px-5 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Categories
                    </p>
                    {categories.map((cat: any) => (
                      <Link
                        key={cat.id}
                        href={`/category/${cat.slug}`}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center justify-between px-5 py-3 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <span className="text-sm">{cat.name}</span>
                        <span className="text-xs text-gray-400">{cat.productCount || ""}</span>
                      </Link>
                    ))}
                  </>
                )}
              </nav>

              <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-4">
                <div className="text-xs text-gray-400 space-y-1">
                  {storeInfo.phones?.[0] && <p>{storeInfo.phones[0]}</p>}
                  {storeInfo.emails?.[0] && <p>{storeInfo.emails[0]}</p>}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
