import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";
import { prisma } from "@/lib/db/client";
import { resolveTheme, type ResolvedTheme } from "@/lib/store/theme-utils";
import { ProductCard, type ProductCardData } from "@/components/store/product-card";

interface StorePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

export async function generateMetadata({ params }: StorePageProps): Promise<Metadata> {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    select: { name: true, slug: true, description: true, bannerUrl: true, logoUrl: true },
  });

  if (!store) return { title: "Store Not Found" };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";

  return {
    title: store.name,
    description: store.description || `Shop at ${store.name}`,
    openGraph: {
      type: "website",
      title: store.name,
      description: store.description || `Shop at ${store.name}`,
      url: `${baseUrl}/store/${store.slug}`,
      siteName: store.name,
      images: store.bannerUrl
        ? [{ url: store.bannerUrl, width: 1200, height: 630, alt: store.name }]
        : store.logoUrl
          ? [{ url: store.logoUrl, width: 512, height: 512, alt: store.name }]
          : [],
    },
    twitter: {
      card: "summary_large_image",
      title: store.name,
      description: store.description || `Shop at ${store.name}`,
    },
  };
}

// ─── Product select fields (shared by all queries) ──────────────────────────

const productSelect = {
  id: true,
  name: true,
  slug: true,
  priceCents: true,
  comparePriceCents: true,
  currency: true,
  images: true,
  shortDescription: true,
  createdAt: true,
  orderCount: true,
  trackInventory: true,
  quantity: true,
  lowStockThreshold: true,
} as const;

// ─── Section Types ──────────────────────────────────────────────────────────

interface SectionConfig {
  id: string;
  enabled: boolean;
  order: number;
  content: Record<string, unknown>;
}

interface CategoryData {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  _count: { products: number };
}

// ─── Section Renderers ──────────────────────────────────────────────────────

function HeroSection({
  content,
  theme,
  storeSlug,
  compact = false,
}: {
  content: Record<string, unknown>;
  theme: ResolvedTheme;
  storeSlug: string;
  compact?: boolean;
}) {
  const headline = (content.headline as string) || "";
  const subheadline = (content.subheadline as string) || "";
  const ctaText = (content.ctaText as string) || "";
  const ctaLink = (content.ctaLink as string) || "";
  const imageUrl = content.imageUrl as string | undefined;

  const heightClasses = compact ? "h-36 sm:h-44" : "h-48 sm:h-56";

  return (
    <section className="relative">
      {imageUrl ? (
        <div className={`${heightClasses} w-full relative`}>
          <Image src={imageUrl} alt={headline || "Hero"} fill className="object-cover" priority />
          <div className="absolute inset-0 bg-black/40" />
        </div>
      ) : (
        <div
          className={`${heightClasses} w-full`}
          style={{
            background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primary}88)`,
          }}
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center text-white px-4 max-w-3xl mx-auto">
          {headline && (
            <h1
              className={`${compact ? "text-2xl sm:text-3xl" : "text-2xl sm:text-4xl"} font-bold drop-shadow-lg`}
              style={{ fontFamily: `var(--store-font-heading), sans-serif` }}
            >
              {headline}
            </h1>
          )}
          {subheadline && (
            <p className={`mt-2 ${compact ? "text-sm sm:text-base" : "text-base sm:text-lg"} drop-shadow-md opacity-90`}>
              {subheadline}
            </p>
          )}
          {ctaText && (
            <Link
              href={ctaLink || `/store/${storeSlug}/products`}
              className="inline-block mt-4 px-6 py-2.5 rounded-lg text-white font-medium text-sm hover:opacity-90 transition-opacity"
              style={{ backgroundColor: theme.colors.primary }}
            >
              {ctaText}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function FeaturedProductsSection({
  content,
  products,
  theme,
  storeSlug,
  formatPrice,
  gridCols,
  spacingGap,
}: {
  content: Record<string, unknown>;
  products: ProductCardData[];
  theme: ResolvedTheme;
  storeSlug: string;
  formatPrice: (cents: number, currency: string) => string;
  gridCols: string;
  spacingGap: string;
}) {
  const title = (content.title as string) || "Featured Products";
  const count = Number(content.count) || 8;
  const displayProducts = products.slice(0, count);
  const primaryColor = theme.colors.primary;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-xl sm:text-2xl font-bold"
          style={{ fontFamily: `var(--store-font-heading), sans-serif` }}
        >
          {title}
        </h2>
        <Link
          href={`/store/${storeSlug}/products`}
          className="text-sm font-medium hover:underline"
          style={{ color: primaryColor }}
        >
          View all
        </Link>
      </div>

      {displayProducts.length === 0 ? (
        <div className="text-center py-16">
          <p className="opacity-60">No products available yet. Check back soon!</p>
        </div>
      ) : (
        <div className={`grid ${gridCols} ${spacingGap}`}>
          {displayProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              storeSlug={storeSlug}
              primaryColor={primaryColor}
              cardStyle={theme.layout.cardStyle}
              formatPrice={formatPrice}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AboutSection({
  content,
  theme,
}: {
  content: Record<string, unknown>;
  theme: ResolvedTheme;
}) {
  const title = (content.title as string) || "About Us";
  const body = (content.body as string) || "";
  const imageUrl = content.imageUrl as string | undefined;

  if (!body && !imageUrl) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className={`grid grid-cols-1 ${imageUrl ? "md:grid-cols-2" : ""} gap-8 items-center`}>
        <div>
          <h2
            className="text-2xl font-bold mb-4"
            style={{ fontFamily: `var(--store-font-heading), sans-serif` }}
          >
            {title}
          </h2>
          {body && (
            <div className="opacity-70 whitespace-pre-line leading-relaxed">{body}</div>
          )}
        </div>
        {imageUrl && (
          <div className="aspect-[4/3] rounded-xl overflow-hidden bg-gray-100">
            <Image
              src={imageUrl}
              alt={title}
              width={800}
              height={600}
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>
    </section>
  );
}

function TestimonialsSection({
  content,
  theme,
}: {
  content: Record<string, unknown>;
  theme: ResolvedTheme;
}) {
  const title = (content.title as string) || "What Our Customers Say";
  const items = (content.items as Array<{ name: string; text: string; rating?: number }>) || [];

  if (items.length === 0) return null;

  return (
    <section
      className="py-12"
      style={{ backgroundColor: `${theme.colors.primary}08` }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2
          className="text-2xl font-bold mb-8 text-center"
          style={{ fontFamily: `var(--store-font-heading), sans-serif` }}
        >
          {title}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="rounded-xl p-6"
              style={{
                backgroundColor: theme.colors.background,
                border: `1px solid ${theme.colors.text}10`,
              }}
            >
              {item.rating && item.rating > 0 && (
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg
                      key={i}
                      className="w-4 h-4"
                      fill={i < item.rating! ? theme.colors.primary : `${theme.colors.text}20`}
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              )}
              <p className="opacity-70 text-sm leading-relaxed mb-3">
                &ldquo;{item.text}&rdquo;
              </p>
              <p className="text-sm font-semibold">{item.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function NewsletterSection({
  content,
  theme,
}: {
  content: Record<string, unknown>;
  theme: ResolvedTheme;
}) {
  const title = (content.title as string) || "Stay Updated";
  const subtitle = (content.subtitle as string) || "Subscribe to our newsletter for the latest updates.";

  return (
    <section className="py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2
          className="text-2xl font-bold mb-2"
          style={{ fontFamily: `var(--store-font-heading), sans-serif` }}
        >
          {title}
        </h2>
        {subtitle && <p className="opacity-60 mb-6">{subtitle}</p>}
        <div className="flex gap-3 max-w-md mx-auto">
          <input
            type="email"
            placeholder="Enter your email"
            className="flex-1 rounded-lg border px-4 py-2.5 text-sm focus:outline-none"
            style={{
              backgroundColor: theme.colors.background,
              borderColor: `${theme.colors.text}20`,
            }}
            readOnly
          />
          <span
            className="px-5 py-2.5 rounded-lg text-white font-medium text-sm cursor-default"
            style={{ backgroundColor: theme.colors.primary }}
          >
            Subscribe
          </span>
        </div>
        <p className="text-xs opacity-40 mt-3">Newsletter signup coming soon.</p>
      </div>
    </section>
  );
}

function ContactSection({
  content,
  theme,
}: {
  content: Record<string, unknown>;
  theme: ResolvedTheme;
}) {
  const title = (content.title as string) || "Contact Us";
  const email = content.email as string | undefined;
  const phone = content.phone as string | undefined;
  const address = content.address as string | undefined;

  if (!email && !phone && !address) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h2
        className="text-2xl font-bold mb-6 text-center"
        style={{ fontFamily: `var(--store-font-heading), sans-serif` }}
      >
        {title}
      </h2>
      <div
        className="max-w-lg mx-auto rounded-xl p-6"
        style={{
          backgroundColor: `${theme.colors.primary}06`,
          border: `1px solid ${theme.colors.text}10`,
        }}
      >
        <div className="space-y-4">
          {email && (
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5 opacity-60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              <div>
                <p className="text-xs font-medium opacity-50 mb-0.5">Email</p>
                <a
                  href={`mailto:${email}`}
                  className="text-sm hover:underline"
                  style={{ color: theme.colors.primary }}
                >
                  {email}
                </a>
              </div>
            </div>
          )}
          {phone && (
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5 opacity-60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              <div>
                <p className="text-xs font-medium opacity-50 mb-0.5">Phone</p>
                <a href={`tel:${phone}`} className="text-sm hover:underline" style={{ color: theme.colors.primary }}>
                  {phone}
                </a>
              </div>
            </div>
          )}
          {address && (
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5 opacity-60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              <div>
                <p className="text-xs font-medium opacity-50 mb-0.5">Address</p>
                <p className="text-sm">{address}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── New Section Renderers ──────────────────────────────────────────────────

function CategoryShowcaseSection({
  categories,
  storeSlug,
  theme,
}: {
  categories: CategoryData[];
  storeSlug: string;
  theme: ResolvedTheme;
}) {
  if (categories.length === 0) return null;

  const primaryColor = theme.colors.primary;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h2
        className="text-xl sm:text-2xl font-bold mb-4"
        style={{ fontFamily: `var(--store-font-heading), sans-serif` }}
      >
        Shop by Category
      </h2>
      {/* Horizontal scroll on mobile, grid on desktop */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide sm:grid sm:grid-cols-4 lg:grid-cols-8 sm:overflow-visible">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/store/${storeSlug}/products?category=${cat.id}`}
            className="flex-shrink-0 w-28 sm:w-auto group"
          >
            <div
              className="aspect-square rounded-xl overflow-hidden mb-2 border transition-all group-hover:shadow-md group-hover:border-transparent"
              style={{ borderColor: `${theme.colors.text}12` }}
            >
              {cat.imageUrl ? (
                <Image
                  src={cat.imageUrl}
                  alt={cat.name}
                  width={200}
                  height={200}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor}15, ${primaryColor}08)`,
                  }}
                >
                  <svg
                    className="w-8 h-8 opacity-30"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                    />
                  </svg>
                </div>
              )}
            </div>
            <p className="text-xs sm:text-sm font-medium text-center line-clamp-1 group-hover:underline">
              {cat.name}
            </p>
            <p className="text-[10px] sm:text-xs text-center opacity-50">
              {cat._count.products} {cat._count.products === 1 ? "item" : "items"}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ProductGridSection({
  title,
  products,
  storeSlug,
  theme,
  formatPrice,
  gridCols,
  spacingGap,
  viewAllHref,
  emptyMessage,
}: {
  title: string;
  products: ProductCardData[];
  storeSlug: string;
  theme: ResolvedTheme;
  formatPrice: (cents: number, currency: string) => string;
  gridCols: string;
  spacingGap: string;
  viewAllHref: string;
  emptyMessage?: string;
}) {
  if (products.length === 0 && !emptyMessage) return null;

  const primaryColor = theme.colors.primary;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-xl sm:text-2xl font-bold"
          style={{ fontFamily: `var(--store-font-heading), sans-serif` }}
        >
          {title}
        </h2>
        <Link
          href={viewAllHref}
          className="text-sm font-medium hover:underline"
          style={{ color: primaryColor }}
        >
          View all
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-12">
          <p className="opacity-60">{emptyMessage}</p>
        </div>
      ) : (
        <div className={`grid ${gridCols} ${spacingGap}`}>
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              storeSlug={storeSlug}
              primaryColor={primaryColor}
              cardStyle={theme.layout.cardStyle}
              formatPrice={formatPrice}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default async function StorePage({ params, searchParams }: StorePageProps) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const isPreview = preview === "true";

  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      bannerUrl: true,
      theme: true,
      currency: true,
      settings: true,
    },
  });

  if (!store) {
    notFound();
  }

  const theme = resolveTheme(store.theme);
  const primaryColor = theme.colors.primary;

  // Parse store settings safely
  let sections: SectionConfig[] = [];
  let hasSections = false;

  try {
    const settings = store.settings ? JSON.parse(store.settings as string) : {};
    if (settings.sections && Array.isArray(settings.sections)) {
      sections = (settings.sections as SectionConfig[])
        .filter((s) => s.enabled)
        .sort((a, b) => a.order - b.order);
      hasSections = sections.length > 0;
    }
  } catch {
    // Invalid settings JSON — fall back to default layout
  }

  // Product status filter
  const baseProductWhere: Record<string, unknown> = {
    storeId: store.id,
    status: isPreview ? { in: ["ACTIVE", "DRAFT"] } : "ACTIVE",
    deletedAt: null,
  };

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Parallel data fetching for all homepage sections
  const [featuredProducts, newArrivals, dealProducts, categories] = await Promise.all([
    // Featured: top 8 by order count
    prisma.product.findMany({
      where: baseProductWhere,
      orderBy: { orderCount: "desc" },
      take: 8,
      select: productSelect,
    }),
    // New arrivals: created within 14 days
    prisma.product.findMany({
      where: {
        ...baseProductWhere,
        createdAt: { gte: fourteenDaysAgo },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: productSelect,
    }),
    // Deals: products with a compare price that is higher than current price
    prisma.product.findMany({
      where: {
        ...baseProductWhere,
        comparePriceCents: { not: null },
      },
      orderBy: { orderCount: "desc" },
      take: 16, // Fetch more, then filter in code since Prisma can't do column comparison
      select: productSelect,
    }),
    // Categories: top-level only
    prisma.productCategory.findMany({
      where: { storeId: store.id, parentId: null },
      orderBy: { sortOrder: "asc" },
      take: 8,
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        _count: { select: { products: { where: { status: "ACTIVE", deletedAt: null } } } },
      },
    }),
  ]);

  // Filter deals in code: comparePriceCents > priceCents
  const deals = dealProducts
    .filter((p) => p.comparePriceCents !== null && p.comparePriceCents > p.priceCents)
    .slice(0, 8);

  function formatPrice(cents: number, currency: string) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(cents / 100);
  }

  // Spacing classes based on theme
  const spacingGap = theme.layout.spacing === "compact" ? "gap-4" : theme.layout.spacing === "spacious" ? "gap-8" : "gap-6";
  const spacingPy = theme.layout.spacing === "compact" ? "py-8" : theme.layout.spacing === "spacious" ? "py-16" : "py-12";

  // Product grid columns based on theme
  const gridCols =
    theme.layout.productGrid === "2"
      ? "grid-cols-1 sm:grid-cols-2"
      : theme.layout.productGrid === "3"
        ? "grid-cols-2 md:grid-cols-3"
        : "grid-cols-2 md:grid-cols-4";

  // Cast products for type safety
  const featuredData = featuredProducts as ProductCardData[];
  const newArrivalsData = newArrivals as ProductCardData[];
  const dealsData = deals as ProductCardData[];

  // ─── Sections-based layout ──────────────────────────────────────────────

  if (hasSections) {
    return (
      <div>
        {sections.map((section) => {
          switch (section.id) {
            case "hero":
              return (
                <HeroSection
                  key="hero"
                  content={section.content}
                  theme={theme}
                  storeSlug={store.slug}
                />
              );
            case "featured_products":
              return (
                <FeaturedProductsSection
                  key="featured_products"
                  content={section.content}
                  products={featuredData}
                  theme={theme}
                  storeSlug={store.slug}
                  formatPrice={formatPrice}
                  gridCols={gridCols}
                  spacingGap={spacingGap}
                />
              );
            case "category_showcase":
              return (
                <CategoryShowcaseSection
                  key="category_showcase"
                  categories={categories}
                  storeSlug={store.slug}
                  theme={theme}
                />
              );
            case "new_arrivals":
              return (
                <ProductGridSection
                  key="new_arrivals"
                  title={(section.content.title as string) || "New Arrivals"}
                  products={newArrivalsData}
                  storeSlug={store.slug}
                  theme={theme}
                  formatPrice={formatPrice}
                  gridCols={gridCols}
                  spacingGap={spacingGap}
                  viewAllHref={`/store/${store.slug}/products?sort=newest`}
                />
              );
            case "deals":
              return (
                <ProductGridSection
                  key="deals"
                  title={(section.content.title as string) || "Deals & Offers"}
                  products={dealsData}
                  storeSlug={store.slug}
                  theme={theme}
                  formatPrice={formatPrice}
                  gridCols={gridCols}
                  spacingGap={spacingGap}
                  viewAllHref={`/store/${store.slug}/products?sort=deals`}
                />
              );
            case "about":
              return (
                <AboutSection
                  key="about"
                  content={section.content}
                  theme={theme}
                />
              );
            case "testimonials":
              return (
                <TestimonialsSection
                  key="testimonials"
                  content={section.content}
                  theme={theme}
                />
              );
            case "newsletter":
              return (
                <NewsletterSection
                  key="newsletter"
                  content={section.content}
                  theme={theme}
                />
              );
            case "contact":
              return (
                <ContactSection
                  key="contact"
                  content={section.content}
                  theme={theme}
                />
              );
            default:
              return null;
          }
        })}
      </div>
    );
  }

  // ─── Product-first fallback layout (Amazon/Shopify style) ────────────────

  // Find hero section config if it exists in settings (even if hasSections is false)
  let heroContent: Record<string, unknown> | null = null;
  try {
    const settings = store.settings ? JSON.parse(store.settings as string) : {};
    if (settings.sections && Array.isArray(settings.sections)) {
      const heroSection = (settings.sections as SectionConfig[]).find(
        (s) => s.id === "hero" && s.enabled
      );
      if (heroSection) heroContent = heroSection.content;
    }
  } catch {
    // ignore
  }

  // Find about and newsletter sections for fallback rendering
  let aboutContent: Record<string, unknown> | null = null;
  let newsletterContent: Record<string, unknown> | null = null;
  try {
    const settings = store.settings ? JSON.parse(store.settings as string) : {};
    if (settings.sections && Array.isArray(settings.sections)) {
      const aboutSection = (settings.sections as SectionConfig[]).find(
        (s) => s.id === "about" && s.enabled
      );
      if (aboutSection) aboutContent = aboutSection.content;

      const nlSection = (settings.sections as SectionConfig[]).find(
        (s) => s.id === "newsletter" && s.enabled
      );
      if (nlSection) newsletterContent = nlSection.content;
    }
  } catch {
    // ignore
  }

  return (
    <div>
      {/* 1. Compact Promo Banner */}
      {heroContent ? (
        <HeroSection
          content={heroContent}
          theme={theme}
          storeSlug={store.slug}
          compact
        />
      ) : (
        <section className="relative">
          {store.bannerUrl ? (
            <div className="h-32 sm:h-44 w-full relative">
              <Image
                src={store.bannerUrl}
                alt={store.name}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-black/40" />
            </div>
          ) : (
            <div
              className="h-32 sm:h-44 w-full"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc, ${primaryColor}88)`,
              }}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white px-4">
              <h1
                className="text-2xl sm:text-3xl font-bold drop-shadow-lg"
                style={{ fontFamily: `var(--store-font-heading), sans-serif` }}
              >
                {store.name}
              </h1>
              {store.description && (
                <p className="mt-1.5 text-sm sm:text-base drop-shadow-md opacity-90 max-w-xl mx-auto line-clamp-1">
                  {store.description}
                </p>
              )}
              <Link
                href={`/store/${store.slug}/products`}
                className="inline-block mt-3 px-5 py-2 rounded-lg text-white font-medium text-sm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: `${primaryColor}dd` }}
              >
                Shop All Products
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 2. Category Showcase */}
      <CategoryShowcaseSection
        categories={categories}
        storeSlug={store.slug}
        theme={theme}
      />

      {/* 3. Featured Products (top sellers) */}
      <ProductGridSection
        title="Featured Products"
        products={featuredData}
        storeSlug={store.slug}
        theme={theme}
        formatPrice={formatPrice}
        gridCols={gridCols}
        spacingGap={spacingGap}
        viewAllHref={`/store/${store.slug}/products`}
        emptyMessage="No products available yet. Check back soon!"
      />

      {/* 4. New Arrivals */}
      {newArrivalsData.length > 0 && (
        <div style={{ backgroundColor: `${theme.colors.primary}04` }}>
          <ProductGridSection
            title="New Arrivals"
            products={newArrivalsData}
            storeSlug={store.slug}
            theme={theme}
            formatPrice={formatPrice}
            gridCols={gridCols}
            spacingGap={spacingGap}
            viewAllHref={`/store/${store.slug}/products?sort=newest`}
          />
        </div>
      )}

      {/* 5. Deals & Offers */}
      {dealsData.length > 0 && (
        <ProductGridSection
          title="Deals & Offers"
          products={dealsData}
          storeSlug={store.slug}
          theme={theme}
          formatPrice={formatPrice}
          gridCols={gridCols}
          spacingGap={spacingGap}
          viewAllHref={`/store/${store.slug}/products?sort=deals`}
        />
      )}

      {/* 6. About (only if configured) */}
      {aboutContent && (
        <AboutSection
          content={aboutContent}
          theme={theme}
        />
      )}

      {/* 7. Newsletter (only if configured) */}
      {newsletterContent && (
        <NewsletterSection
          content={newsletterContent}
          theme={theme}
        />
      )}
    </div>
  );
}
