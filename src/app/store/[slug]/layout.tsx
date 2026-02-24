import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { cookies } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db/client";
import { getPresignedUrl } from "@/lib/utils/s3-client";
import { ShoppingBag } from "lucide-react";
import { resolveTheme, getGoogleFontsUrl, getThemeCSSVars } from "@/lib/store/theme-utils";
import { generateStoreJsonLd } from "@/lib/store/seo-utils";
import { MobileNav } from "@/components/store/mobile-nav";
import { CartProvider } from "@/components/store/cart-provider";
import { CartButton } from "@/components/store/cart-button";
import { CartDrawer } from "@/components/store/cart-drawer";
import { PreviewListener } from "@/components/store/preview-listener";

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
      settings: true,
    },
  });

  if (!store) {
    notFound();
  }

  // Fetch categories in parallel
  const categories = await prisma.productCategory.findMany({
    where: { storeId: store.id, parentId: null },
    orderBy: { sortOrder: "asc" },
    take: 8,
    select: { id: true, name: true, slug: true },
  });

  // Parse store settings
  let storeSettings: Record<string, unknown> = {};
  try { storeSettings = JSON.parse(store.settings as string || "{}"); } catch {}
  const shippingConfig = storeSettings.shipping as { freeShippingThresholdCents?: number } | undefined;
  const storeContent = storeSettings.storeContent as { returnPolicy?: string; shippingPolicy?: string; showBrandName?: boolean } | undefined;
  const showBrandName = storeContent?.showBrandName !== false; // default true

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

  // Presign S3 logo URL so the image actually loads
  const STORAGE_URL = process.env.NEXT_PUBLIC_STORAGE_URL || "";
  const logoUrl = store.logoUrl && STORAGE_URL && store.logoUrl.startsWith(STORAGE_URL)
    ? await getPresignedUrl(store.logoUrl)
    : store.logoUrl;

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
        fontFamily: 'var(--store-font-body), sans-serif',
        color: 'var(--store-text)',
        backgroundColor: 'var(--store-background)',
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
        <header className="border-b sticky top-0 z-50" style={{ backgroundColor: 'var(--store-background)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 relative">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center justify-between w-full md:justify-center">
                <Link href={`/store/${store.slug}`} className="flex items-center gap-3">
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
                      className="h-12 w-12 rounded-lg flex items-center justify-center text-white"
                      style={{ backgroundColor: 'var(--store-primary)' }}
                    >
                      <ShoppingBag className="h-6 w-6" />
                    </div>
                  )}
                  {showBrandName && (
                    <span
                      className="text-xl font-bold"
                      style={{ fontFamily: 'var(--store-font-heading), sans-serif' }}
                    >
                      {store.name}
                    </span>
                  )}
                </Link>
                <div className="flex items-center gap-1">
                  <CartButton />
                  <MobileNav
                    storeSlug={store.slug}
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
                <CartButton />
              </nav>
              {/* Search bar below logo - full width */}
              <form method="GET" action={`/store/${store.slug}/products`} className="flex items-center w-full max-w-md">
                <input
                  type="text"
                  name="search"
                  placeholder="Search products..."
                  className="w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
                  style={{
                    borderColor: `color-mix(in srgb, var(--store-text) 12%, transparent)`,
                    backgroundColor: 'var(--store-background)',
                    '--tw-ring-color': 'var(--store-primary)',
                  } as React.CSSProperties}
                />
              </form>
            </div>
          </div>
        </header>
      ) : headerStyle === "bold" ? (
        /* BOLD: logo left, large font, colored background header */
        <header className="sticky top-0 z-50" style={{ backgroundColor: 'var(--store-primary)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="flex items-center justify-between h-20">
              <Link href={`/store/${store.slug}`} className="flex items-center gap-3">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt={store.name}
                    width={160}
                    height={44}
                    className="h-11 w-auto max-w-[160px] object-contain"
                  />
                ) : (
                  <div className="h-11 w-11 rounded-lg flex items-center justify-center bg-white/20">
                    <ShoppingBag className="h-6 w-6 text-white" />
                  </div>
                )}
                {showBrandName && (
                  <span
                    className="text-2xl font-extrabold text-white"
                    style={{ fontFamily: 'var(--store-font-heading), sans-serif' }}
                  >
                    {store.name}
                  </span>
                )}
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
                {/* Search bar - bold header style */}
                <form method="GET" action={`/store/${store.slug}/products`} className="flex items-center">
                  <input
                    type="text"
                    name="search"
                    placeholder="Search products..."
                    className="w-40 lg:w-56 rounded-lg px-3 py-1.5 text-sm focus:outline-none bg-white/15 text-white placeholder-white/60 border border-white/20 focus:bg-white/25"
                  />
                </form>
                <CartButton textColor="#ffffff" />
              </nav>
              <div className="flex items-center gap-1 md:hidden">
                <CartButton textColor="#ffffff" />
                <MobileNav
                  storeSlug={store.slug}
                  textColor="#ffffff"
                  bgColor="var(--store-primary)"
                />
              </div>
            </div>
          </div>
        </header>
      ) : (
        /* MINIMAL (default): logo left, nav right */
        <header className="border-b sticky top-0 z-50" style={{ backgroundColor: 'var(--store-background)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="flex items-center justify-between h-16">
              <Link href={`/store/${store.slug}`} className="flex items-center gap-3">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt={store.name}
                    width={160}
                    height={40}
                    className="h-10 w-auto max-w-[160px] object-contain"
                  />
                ) : (
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: 'var(--store-primary)' }}
                  >
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                )}
                {showBrandName && (
                  <span
                    className="text-lg font-semibold"
                    style={{ fontFamily: 'var(--store-font-heading), sans-serif' }}
                  >
                    {store.name}
                  </span>
                )}
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
                {/* Search bar - minimal header */}
                <form method="GET" action={`/store/${store.slug}/products`} className="flex items-center">
                  <input
                    type="text"
                    name="search"
                    placeholder="Search products..."
                    className="w-40 lg:w-56 rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
                    style={{
                      borderColor: `color-mix(in srgb, var(--store-text) 12%, transparent)`,
                      backgroundColor: 'var(--store-background)',
                      '--tw-ring-color': 'var(--store-primary)',
                    } as React.CSSProperties}
                  />
                </form>
                <CartButton />
              </nav>
              <div className="flex items-center gap-1 md:hidden">
                <CartButton />
                <MobileNav
                  storeSlug={store.slug}
                />
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Category Navigation Bar */}
      {categories.length >= 2 && (
        <nav className="border-b overflow-x-auto scrollbar-hide" style={{ backgroundColor: 'var(--store-background)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-1 py-2 -mx-1">
              <Link
                href={`/store/${store.slug}/products`}
                className="shrink-0 px-3 py-1 rounded-md text-xs font-medium transition-colors hover:opacity-100 opacity-70"
              >
                All Products
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/store/${store.slug}/products?category=${cat.id}`}
                  className="shrink-0 px-3 py-1 rounded-md text-xs font-medium transition-colors hover:opacity-100 opacity-70"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </nav>
      )}

      {/* Cart Drawer */}
      <CartDrawer />

      {/* Preview Listener */}
      {isPreview && <PreviewListener />}

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t" style={{ backgroundColor: 'var(--store-background)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Col 1: Store Info */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                {logoUrl ? (
                  <Image src={logoUrl} alt={store.name} width={120} height={32} className="h-8 w-auto max-w-[120px] object-contain" />
                ) : (
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: 'var(--store-primary)' }}>
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                )}
                {showBrandName && <span className="font-semibold" style={{ fontFamily: 'var(--store-font-heading), sans-serif' }}>{store.name}</span>}
              </div>
              {store.description && <p className="text-sm opacity-60 leading-relaxed">{store.description}</p>}
            </div>

            {/* Col 2: Quick Links */}
            <div>
              <h4 className="text-sm font-semibold mb-3 opacity-80">Shop</h4>
              <ul className="space-y-2">
                <li><Link href={`/store/${store.slug}`} className="text-sm opacity-60 hover:opacity-100 transition-opacity">Home</Link></li>
                <li><Link href={`/store/${store.slug}/products`} className="text-sm opacity-60 hover:opacity-100 transition-opacity">All Products</Link></li>
                {categories.slice(0, 4).map(cat => (
                  <li key={cat.id}><Link href={`/store/${store.slug}/products?category=${cat.id}`} className="text-sm opacity-60 hover:opacity-100 transition-opacity">{cat.name}</Link></li>
                ))}
              </ul>
            </div>

            {/* Col 3: Policies (only if configured) */}
            {(storeContent?.shippingPolicy || storeContent?.returnPolicy) && (
              <div>
                <h4 className="text-sm font-semibold mb-3 opacity-80">Policies</h4>
                <ul className="space-y-2">
                  {storeContent.shippingPolicy && <li className="text-sm opacity-60">Shipping Policy</li>}
                  {storeContent.returnPolicy && <li className="text-sm opacity-60">Return Policy</li>}
                </ul>
              </div>
            )}

            {/* Col 4: Trust Badges */}
            <div>
              <h4 className="text-sm font-semibold mb-3 opacity-80">Why Shop With Us</h4>
              <ul className="space-y-2.5">
                <li className="flex items-center gap-2 text-sm opacity-60">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                  Secure Checkout
                </li>
                {shippingConfig?.freeShippingThresholdCents && (
                  <li className="flex items-center gap-2 text-sm opacity-60">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>
                    Free Shipping over {new Intl.NumberFormat("en-US", { style: "currency", currency: store.currency || "USD" }).format(shippingConfig.freeShippingThresholdCents / 100)}
                  </li>
                )}
                {storeContent?.returnPolicy && (
                  <li className="flex items-center gap-2 text-sm opacity-60">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
                    Easy Returns
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs opacity-40">&copy; {new Date().getFullYear()} {store.name}. All rights reserved.</p>
            <div className="flex items-center gap-3">
              {/* Payment icons */}
              <div className="flex items-center gap-1.5 opacity-30">
                <span className="text-[10px] font-bold px-1.5 py-0.5 border rounded">VISA</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 border rounded">MC</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 border rounded">AMEX</span>
              </div>
              <span className="text-xs opacity-30">|</span>
              <p className="text-xs opacity-40">
                Powered by{" "}
                <a href="https://flowsmartly.com" className="hover:underline" style={{ color: 'var(--store-primary)' }}>
                  FlowSmartly
                </a>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
    </CartProvider>
  );
}
