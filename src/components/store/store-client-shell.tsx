"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useCart } from "./cart-provider";
import { CartDrawer } from "./cart-drawer";

/**
 * Client shell for main app store pages (/store/[slug]/...).
 * Adds CartDrawer + sticky mobile bottom nav with Home, Shop, Cart, Account.
 * Cart button dispatches the "open-cart" custom event pattern.
 */
export function StoreClientShell({ storeSlug }: { storeSlug: string }) {
  const { setIsOpen, itemCount, mounted } = useCart();
  const pathname = usePathname();

  // Listen for "open-cart" custom events (from other components)
  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener("open-cart", handler);
    return () => window.removeEventListener("open-cart", handler);
  }, [setIsOpen]);

  const storeUrl = `/stores/${storeSlug}`;
  const accountUrl = `/store/${storeSlug}/account`;

  const isAccount = pathname?.startsWith(`/store/${storeSlug}/account`);

  return (
    <>
      <CartDrawer />

      {/* Mobile bottom navigation */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t"
        style={{
          backgroundColor: "var(--store-background)",
          borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)",
        }}
      >
        <nav className="flex items-center justify-around py-2 px-1 max-w-md mx-auto">
          <a
            href={storeUrl}
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-xs opacity-60 hover:opacity-100 transition-opacity"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <span>Home</span>
          </a>

          <a
            href={`${storeUrl}/products`}
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-xs opacity-60 hover:opacity-100 transition-opacity"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.15c0 .415.336.75.75.75z" />
            </svg>
            <span>Shop</span>
          </a>

          <button
            onClick={() => setIsOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-xs opacity-60 hover:opacity-100 transition-opacity relative"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            {mounted && itemCount > 0 && (
              <span
                className="absolute -top-0.5 right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: "var(--store-primary)" }}
              >
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            )}
            <span>Cart</span>
          </button>

          <Link
            href={accountUrl}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-opacity ${isAccount ? "opacity-100" : "opacity-60 hover:opacity-100"}`}
            style={isAccount ? { color: "var(--store-primary)" } : undefined}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <span>Account</span>
          </Link>
        </nav>
      </div>
    </>
  );
}
