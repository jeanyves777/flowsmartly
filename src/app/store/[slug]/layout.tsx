import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { cookies } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db/client";
import { ShoppingBag } from "lucide-react";
import { resolveTheme, getGoogleFontsUrl, getThemeCSSVars } from "@/lib/store/theme-utils";
import { generateStoreJsonLd } from "@/lib/store/seo-utils";
import { MobileNav } from "@/components/store/mobile-nav";
import { CartProvider } from "@/components/store/cart-provider";
import { CartButton } from "@/components/store/cart-button";
import { CartDrawer } from "@/components/store/cart-drawer";

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
      description: true,
      logoUrl: true,
      isActive: true,
      theme: true,
      currency: true,
      userId: true,
    },
  });

  if (!store) {
    notFound();
  }

  // Preview mode: allow store owner to view inactive store
  const headersList = await headers();
  const referer = headersList.get("referer") || "";
  const url = headersList.get("x-url") || referer;
  const isPreviewParam = url.includes("preview=true");

  let isPreview = false;
  if (!store.isActive && isPreviewParam) {
    // Verify the user owns this store via session cookie
    try {
      const cookieStore = await cookies();
      const sessionToken = cookieStore.get("session_token")?.value;
      if (sessionToken) {
        const session = await prisma.session.findUnique({
          where: { token: sessionToken },
          select: { userId: true },
        });
        if (session && session.userId === store.userId) {
          isPreview = true;
        }
      }
    } catch {}
  }

  if (!store.isActive && !isPreview) {
    notFound();
  }

  const theme = resolveTheme(store.theme);
  const fontsUrl = getGoogleFontsUrl(theme);
  const cssVars = getThemeCSSVars(theme);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";
  const storeUrl = `${baseUrl}/store/${store.slug}`;

  const jsonLd = generateStoreJsonLd({
    name: store.name,
    description: store.description || undefined,
    url: storeUrl,
    logoUrl: store.logoUrl || undefined,
  });

  const headerStyle = theme.layout.headerStyle;

  return (
    <CartProvider storeSlug={store.slug} currency={store.currency}>
    <div
      style={{
        fontFamily: `${theme.fonts.body}, sans-serif`,
        color: theme.colors.text,
        backgroundColor: theme.colors.background,
        ...cssVars,
      } as React.CSSProperties}
      className="min-h-screen flex flex-col"
    >
      {/* Google Fonts */}
      {fontsUrl && (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link rel="stylesheet" href={fontsUrl} />
      )}

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Store Header */}
      {headerStyle === "centered" ? (
        /* CENTERED: logo centered above, nav centered below */
        <header className="border-b sticky top-0 z-50" style={{ backgroundColor: theme.colors.background }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 relative">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center justify-between w-full md:justify-center">
                <Link href={`/store/${store.slug}`} className="flex items-center gap-3">
                  {store.logoUrl ? (
                    <Image
                      src={store.logoUrl}
                      alt={store.name}
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div
                      className="h-12 w-12 rounded-lg flex items-center justify-center text-white"
                      style={{ backgroundColor: theme.colors.primary }}
                    >
                      <ShoppingBag className="h-6 w-6" />
                    </div>
                  )}
                  <span
                    className="text-xl font-bold"
                    style={{ fontFamily: `${theme.fonts.heading}, sans-serif` }}
                  >
                    {store.name}
                  </span>
                </Link>
                <div className="flex items-center gap-1">
                  <CartButton textColor={theme.colors.text} />
                  <MobileNav
                    storeSlug={store.slug}
                    textColor={theme.colors.text}
                    bgColor={theme.colors.background}
                  />
                </div>
              </div>
              <nav className="hidden md:flex items-center gap-6">
                <Link
                  href={`/store/${store.slug}`}
                  className="text-sm font-medium transition-colors opacity-70 hover:opacity-100"
                >
                  Home
                </Link>
                <Link
                  href={`/store/${store.slug}/products`}
                  className="text-sm font-medium transition-colors opacity-70 hover:opacity-100"
                >
                  Products
                </Link>
                <CartButton textColor={theme.colors.text} />
              </nav>
            </div>
          </div>
        </header>
      ) : headerStyle === "bold" ? (
        /* BOLD: logo left, large font, colored background header */
        <header className="sticky top-0 z-50" style={{ backgroundColor: theme.colors.primary }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="flex items-center justify-between h-20">
              <Link href={`/store/${store.slug}`} className="flex items-center gap-3">
                {store.logoUrl ? (
                  <Image
                    src={store.logoUrl}
                    alt={store.name}
                    width={44}
                    height={44}
                    className="h-11 w-11 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-11 w-11 rounded-lg flex items-center justify-center bg-white/20">
                    <ShoppingBag className="h-6 w-6 text-white" />
                  </div>
                )}
                <span
                  className="text-2xl font-extrabold text-white"
                  style={{ fontFamily: `${theme.fonts.heading}, sans-serif` }}
                >
                  {store.name}
                </span>
              </Link>
              <nav className="hidden md:flex items-center gap-6">
                <Link
                  href={`/store/${store.slug}`}
                  className="text-sm font-medium text-white/80 hover:text-white transition-colors"
                >
                  Home
                </Link>
                <Link
                  href={`/store/${store.slug}/products`}
                  className="text-sm font-medium text-white/80 hover:text-white transition-colors"
                >
                  Products
                </Link>
                <CartButton textColor="#ffffff" />
              </nav>
              <div className="flex items-center gap-1 md:hidden">
                <CartButton textColor="#ffffff" />
                <MobileNav
                  storeSlug={store.slug}
                  textColor="#ffffff"
                  bgColor={theme.colors.primary}
                />
              </div>
            </div>
          </div>
        </header>
      ) : (
        /* MINIMAL (default): logo left, nav right */
        <header className="border-b sticky top-0 z-50" style={{ backgroundColor: theme.colors.background }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="flex items-center justify-between h-16">
              <Link href={`/store/${store.slug}`} className="flex items-center gap-3">
                {store.logoUrl ? (
                  <Image
                    src={store.logoUrl}
                    alt={store.name}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                ) : (
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: theme.colors.primary }}
                  >
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                )}
                <span
                  className="text-lg font-semibold"
                  style={{ fontFamily: `${theme.fonts.heading}, sans-serif` }}
                >
                  {store.name}
                </span>
              </Link>
              <nav className="hidden md:flex items-center gap-6">
                <Link
                  href={`/store/${store.slug}`}
                  className="text-sm font-medium transition-colors opacity-70 hover:opacity-100"
                >
                  Home
                </Link>
                <Link
                  href={`/store/${store.slug}/products`}
                  className="text-sm font-medium transition-colors opacity-70 hover:opacity-100"
                >
                  Products
                </Link>
                <CartButton textColor={theme.colors.text} />
              </nav>
              <div className="flex items-center gap-1 md:hidden">
                <CartButton textColor={theme.colors.text} />
                <MobileNav
                  storeSlug={store.slug}
                  textColor={theme.colors.text}
                  bgColor={theme.colors.background}
                />
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Cart Drawer */}
      <CartDrawer />

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t" style={{ backgroundColor: theme.colors.background, opacity: 0.9 }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm opacity-60">{store.name}</p>
            <p className="text-xs opacity-40">
              Powered by{" "}
              <a
                href="https://flowsmartly.com"
                className="hover:underline"
                style={{ color: theme.colors.primary }}
              >
                FlowSmartly
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
    </CartProvider>
  );
}
