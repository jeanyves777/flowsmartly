import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db/client";
import { getPresignedUrl } from "@/lib/utils/s3-client";
import { resolveTheme, getGoogleFontsUrl, getThemeCSSVars } from "@/lib/store/theme-utils";
import { CartProvider } from "@/components/store/cart-provider";
import { StoreClientShell } from "@/components/store/store-client-shell";
import { ArrowLeft, ShoppingBag } from "lucide-react";

/**
 * Shared layout for store SSR pages (checkout, account, tracking, order-confirmation).
 * Fully branded with the store's theme (logo, colors, fonts).
 * The static V2 store handles all browsing — this layout only wraps server-rendered pages.
 */

interface StoreLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function StoreLayout({ children, params }: StoreLayoutProps) {
  const { slug } = await params;

  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      isActive: true,
      theme: true,
      currency: true,
    },
  });

  if (!store || !store.isActive) {
    notFound();
  }

  // Presign S3 logo URL
  const STORAGE_URL = process.env.NEXT_PUBLIC_STORAGE_URL || "";
  const logoUrl = store.logoUrl && STORAGE_URL && store.logoUrl.startsWith(STORAGE_URL)
    ? await getPresignedUrl(store.logoUrl)
    : store.logoUrl;

  const theme = resolveTheme(store.theme);
  const fontsUrl = getGoogleFontsUrl(theme);
  const cssVars = getThemeCSSVars(theme);

  // Move background + text to a <style> block so html.dark can override them.
  // Inline CSS vars have highest specificity and cannot be overridden by any rule.
  const { "--store-background": storeBg, "--store-text": storeText, ...inlineCssVars } = cssVars as Record<string, string>;
  const darkModeStyle = `
    :root {
      --store-background: ${storeBg};
      --store-text: ${storeText};
    }
    html.dark {
      --store-background: #0f172a;
      --store-text: #f1f5f9;
      --store-input-bg: #1e293b;
    }
  `;

  // Static store URL (where the storefront lives)
  const storeUrl = `/stores/${store.slug}`;

  return (
    <CartProvider storeSlug={store.slug} currency={store.currency}>
      {/* Dark mode CSS vars — background/text must live here so html.dark can override them */}
      <style dangerouslySetInnerHTML={{ __html: darkModeStyle }} />
      <div
        style={{
          fontFamily: "var(--store-font-body), sans-serif",
          color: "var(--store-text)",
          backgroundColor: "var(--store-background)",
          ...inlineCssVars,
        } as React.CSSProperties}
        className="min-h-screen flex flex-col"
      >
        {/* Google Fonts */}
        {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}

        {/* Header — branded, clean */}
        <header
          className="border-b sticky top-0 z-50"
          style={{ backgroundColor: "var(--store-background)" }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo only — no store name text when logo exists */}
              <a href={storeUrl} className="flex items-center">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt={store.name}
                    width={160}
                    height={48}
                    className="h-12 w-auto max-w-[160px] object-contain"
                  />
                ) : (
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: "var(--store-primary)" }}
                  >
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                )}
              </a>

              {/* Back to store link */}
              <a
                href={storeUrl}
                className="flex items-center gap-1.5 text-sm font-medium opacity-70 hover:opacity-100 transition-opacity"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to Store</span>
                <span className="sm:hidden">Store</span>
              </a>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 pb-16 md:pb-0">
          {children}
        </main>

        {/* Cart drawer + mobile bottom nav */}
        <StoreClientShell storeSlug={store.slug} />

        {/* Footer — branded with policies, contact, newsletter */}
        <footer
          className="border-t mt-auto"
          style={{
            backgroundColor: "var(--store-background)",
            borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)",
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
              {/* Shop */}
              <div>
                <h3 className="font-semibold mb-3 text-sm" style={{ color: "var(--store-text)" }}>Shop</h3>
                <ul className="space-y-2 text-sm" style={{ color: "color-mix(in srgb, var(--store-text) 60%, transparent)" }}>
                  <li><a href={storeUrl} className="hover:opacity-100 transition-opacity">All Products</a></li>
                  <li><a href={`${storeUrl}/about`} className="hover:opacity-100 transition-opacity">About Us</a></li>
                  <li><a href={`${storeUrl}/faq`} className="hover:opacity-100 transition-opacity">FAQ</a></li>
                </ul>
              </div>
              {/* Policies */}
              <div>
                <h3 className="font-semibold mb-3 text-sm" style={{ color: "var(--store-text)" }}>Policies</h3>
                <ul className="space-y-2 text-sm" style={{ color: "color-mix(in srgb, var(--store-text) 60%, transparent)" }}>
                  <li><a href={`${storeUrl}/privacy-policy`} className="hover:opacity-100 transition-opacity">Privacy Policy</a></li>
                  <li><a href={`${storeUrl}/terms`} className="hover:opacity-100 transition-opacity">Terms of Service</a></li>
                  <li><a href={`${storeUrl}/shipping-policy`} className="hover:opacity-100 transition-opacity">Shipping</a></li>
                  <li><a href={`${storeUrl}/return-policy`} className="hover:opacity-100 transition-opacity">Returns</a></li>
                </ul>
              </div>
              {/* Account */}
              <div>
                <h3 className="font-semibold mb-3 text-sm" style={{ color: "var(--store-text)" }}>Account</h3>
                <ul className="space-y-2 text-sm" style={{ color: "color-mix(in srgb, var(--store-text) 60%, transparent)" }}>
                  <li><a href={`/store/${store.slug}/account`} className="hover:opacity-100 transition-opacity">My Account</a></li>
                  <li><a href={`/store/${store.slug}/account/orders`} className="hover:opacity-100 transition-opacity">Orders</a></li>
                  <li><a href={`/store/${store.slug}/account/wishlist`} className="hover:opacity-100 transition-opacity">Wishlist</a></li>
                </ul>
              </div>
              {/* Newsletter */}
              <div>
                <h3 className="font-semibold mb-3 text-sm" style={{ color: "var(--store-text)" }}>Stay Updated</h3>
                <p className="text-sm mb-3" style={{ color: "color-mix(in srgb, var(--store-text) 50%, transparent)" }}>
                  Get the latest on new products and deals.
                </p>
                <form className="flex gap-2" action="#" method="GET">
                  <input
                    type="email"
                    placeholder="Email"
                    className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border bg-transparent"
                    style={{
                      borderColor: "color-mix(in srgb, var(--store-text) 15%, transparent)",
                      color: "var(--store-text)",
                    }}
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium rounded-lg text-white shrink-0"
                    style={{ backgroundColor: "var(--store-color-primary)" }}
                  >
                    Join
                  </button>
                </form>
              </div>
            </div>
            {/* Bottom bar */}
            <div className="mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3"
              style={{ borderTop: "1px solid color-mix(in srgb, var(--store-text) 10%, transparent)" }}
            >
              <p className="text-xs" style={{ color: "color-mix(in srgb, var(--store-text) 40%, transparent)" }}>
                &copy; {new Date().getFullYear()} {store.name}. All rights reserved.
              </p>
              <p className="text-xs" style={{ color: "color-mix(in srgb, var(--store-text) 30%, transparent)" }}>
                Powered by <a href="https://flowsmartly.com" className="hover:opacity-100">FlowSmartly</a>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </CartProvider>
  );
}
