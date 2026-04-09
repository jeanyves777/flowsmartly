"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Home, ShoppingBag, Heart, User, Search } from "lucide-react";
import { storeInfo, storeUrl } from "@/lib/data";
import { getCart, getCartCount } from "@/lib/cart";

/**
 * Mobile Bottom Sticky Nav — md:hidden.
 * Pattern matches professional e-commerce: Shop, Search, Cart (badge), Account.
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

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/" || pathname === storeUrl("/");
    return pathname?.includes(path);
  };

  const items = [
    { label: "Shop", icon: Home, href: storeUrl("/products"), active: isActive("/products") },
    { label: "Search", icon: Search, href: storeUrl("/products"), active: false },
    { label: "Cart", icon: ShoppingBag, badge: cartCount, onClick: onCartOpen, active: false },
    { label: "Account", icon: User, href: storeInfo.accountUrl || "#", active: false, external: true },
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
                  <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </div>
              <span className={`text-[10px] leading-tight ${item.active ? "text-primary-600 font-semibold" : "text-gray-500 dark:text-gray-400"}`}>
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
            <a key={item.label} href={item.href} className="flex-1 flex items-center justify-center py-1"
              {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
              {content}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
