"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Home, Grid2X2, ShoppingBag, User, Globe } from "lucide-react";
import { storeInfo, storeUrl } from "@/lib/data";
import { getCart, getCartCount } from "@/lib/cart";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    // Initial count
    setCartCount(getCartCount(getCart()));

    // Listen for cart updates
    const handleCartUpdate = () => {
      setCartCount(getCartCount(getCart()));
    };

    window.addEventListener("cart-updated", handleCartUpdate);
    return () => window.removeEventListener("cart-updated", handleCartUpdate);
  }, []);

  const isActive = (href: string) => pathname === href;

  const buttons = [
    {
      href: storeUrl("/"),
      icon: Home,
      label: "Home",
    },
    {
      href: storeUrl("/products"),
      icon: Grid2X2,
      label: "Shop",
    },
    {
      href: storeUrl("/products"),
      icon: ShoppingBag,
      label: "Cart",
      badge: cartCount,
    },
    {
      href: storeInfo.accountUrl,
      icon: User,
      label: "Account",
      external: true,
    },
  ];

  // Insert Website button before Account if websiteUrl exists
  if (storeInfo.websiteUrl) {
    buttons.splice(3, 0, {
      href: storeInfo.websiteUrl,
      icon: Globe,
      label: "Website",
      external: true,
    });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      <div className="flex justify-around items-center h-14">
        {buttons.map((btn) => {
          const Icon = btn.icon;
          const active = !btn.external && isActive(btn.href);

          return (
            <a
              key={btn.label}
              href={btn.href}
              {...(btn.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className={`flex flex-col items-center justify-center flex-1 h-full relative transition-colors ${
                active
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <span className="relative">
                <Icon size={20} />
                {"badge" in btn && btn.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {btn.badge > 99 ? "99+" : btn.badge}
                  </span>
                )}
              </span>
              <span className="text-[10px] mt-0.5 leading-tight">{btn.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
