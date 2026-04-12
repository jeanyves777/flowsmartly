import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db/client";
import { getPresignedUrl } from "@/lib/utils/s3-client";
import { resolveTheme, getGoogleFontsUrl, getThemeCSSVars } from "@/lib/store/theme-utils";
import { CartProvider } from "@/components/store/cart-provider";
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
              {/* Logo + store name */}
              <a href={storeUrl} className="flex items-center gap-3">
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
                <span
                  className="text-lg font-semibold hidden sm:block"
                  style={{ fontFamily: "var(--store-font-heading), sans-serif" }}
                >
                  {store.name}
                </span>
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
        <main className="flex-1">
          {children}
        </main>

        {/* Footer — minimal, branded */}
        <footer
          className="border-t py-6 mt-auto"
          style={{ backgroundColor: "var(--store-background)" }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm opacity-50">
              &copy; {new Date().getFullYear()} {store.name}
            </p>
            <div className="flex items-center gap-4 text-sm opacity-50">
              <a href={storeUrl} className="hover:opacity-100 transition-opacity">Shop</a>
              <a href={`${storeUrl}/about`} className="hover:opacity-100 transition-opacity">About</a>
              <a href={`/store/${store.slug}/account`} className="hover:opacity-100 transition-opacity">My Account</a>
            </div>
            <p className="text-xs opacity-30">
              Powered by <a href="https://flowsmartly.com" className="hover:opacity-100">FlowSmartly</a>
            </p>
          </div>
        </footer>
      </div>
    </CartProvider>
  );
}
