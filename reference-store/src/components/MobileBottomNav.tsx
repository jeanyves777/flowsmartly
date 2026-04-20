"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, ShoppingBag, User, Search } from "lucide-react";
import { getCart, getCartCount } from "@/lib/cart";

/**
 * Mobile Bottom Sticky Nav — md:hidden.
 * Pattern matches professional e-commerce: Shop, Search, Cart (badge), Account.
 *
 * All internal hrefs go through Next.js <Link>, which auto-prepends the
 * store's basePath (set in next.config.js as "/stores/{slug}"). Never use
 * `storeUrl()` from data.ts — generated stores don't export it.
 */
export default function MobileBottomNav({
  onCartOpen,
}: {
  onCartOpen?: () => void;
}) {
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const update = () => setCartCount(getCartCount(getCart()));
    update();
    window.addEventListener("cart-updated", update);
    return () => window.removeEventListener("cart-updated", update);
  }, []);

  const isHome = (() => {
    if (!pathname) return false;
    // Home == the store root — matches "/stores/{slug}" or "/stores/{slug}/"
    return /^\/stores\/[^/]+\/?$/.test(pathname) || pathname === "/";
  })();
  const isProducts = pathname?.includes("/products") ?? false;

  type NavItem = {
    label: string;
    icon: typeof Home;
    href?: string;
    onClick?: () => void;
    badge?: number;
    active: boolean;
  };

  // Layout matches professional mobile commerce (Amazon / Temu / Shein):
  //   [Home] → store homepage        [Search] → product listing
  //   [Cart] → opens cart drawer     [Account] → opens login/register modal
  const items: NavItem[] = [
    { label: "Home", icon: Home, href: "/", active: isHome },
    { label: "Search", icon: Search, href: "/products", active: isProducts },
    { label: "Cart", icon: ShoppingBag, badge: cartCount, onClick: onCartOpen, active: false },
    { label: "Account", icon: User, onClick: () => window.dispatchEvent(new CustomEvent("toggle-account")), active: false },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-around h-14 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const Icon = item.icon;
          const content = (
            <div className="flex flex-col items-center gap-0.5 relative">
              <div className="relative">
                <Icon size={22} className={item.active ? "text-primary-600" : "text-gray-500 dark:text-gray-400"} />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-2.5 bg-primary-600 text-white text-[9px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </div>
              <span className={`text-[11px] leading-tight ${item.active ? "text-primary-600 font-semibold" : "text-gray-500 dark:text-gray-400"}`}>
                {item.label}
              </span>
            </div>
          );

          if (item.onClick) {
            return (
              <button key={item.label} onClick={item.onClick} className="flex-1 flex items-center justify-center py-1">
                {content}
              </button>
            );
          }

          return (
            <Link key={item.label} href={item.href || "/"} className="flex-1 flex items-center justify-center py-1">
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
