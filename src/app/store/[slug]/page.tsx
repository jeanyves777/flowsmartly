import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";
import { prisma } from "@/lib/db/client";
import { resolveTheme, type ResolvedTheme } from "@/lib/store/theme-utils";

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

// ─── Section Types ──────────────────────────────────────────────────────────

interface SectionConfig {
  id: string;
  enabled: boolean;
  order: number;
  content: Record<string, unknown>;
}

// ─── Section Renderers ──────────────────────────────────────────────────────

function HeroSection({
  content,
  theme,
  storeSlug,
}: {
  content: Record<string, unknown>;
  theme: ResolvedTheme;
  storeSlug: string;
}) {
  const headline = (content.headline as string) || "";
  const subheadline = (content.subheadline as string) || "";
  const ctaText = (content.ctaText as string) || "";
  const ctaLink = (content.ctaLink as string) || "";
  const imageUrl = content.imageUrl as string | undefined;

  return (
    <section className="relative">
      {imageUrl ? (
        <div className="h-72 sm:h-[28rem] w-full relative">
          <Image src={imageUrl} alt={headline || "Hero"} fill className="object-cover" priority />
          <div className="absolute inset-0 bg-black/40" />
        </div>
      ) : (
        <div
          className="h-72 sm:h-[28rem] w-full"
          style={{
            background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primary}88)`,
          }}
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center text-white px-4 max-w-3xl mx-auto">
          {headline && (
            <h1
              className="text-3xl sm:text-5xl font-bold drop-shadow-lg"
              style={{ fontFamily: `var(--store-font-heading), sans-serif` }}
            >
              {headline}
            </h1>
          )}
          {subheadline && (
            <p className="mt-3 text-lg sm:text-xl drop-shadow-md opacity-90">{subheadline}</p>
          )}
          {ctaText && (
            <Link
              href={ctaLink || `/store/${storeSlug}/products`}
              className="inline-block mt-6 px-8 py-3 rounded-lg text-white font-medium text-sm hover:opacity-90 transition-opacity"
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
  cardClasses,
  imageClasses,
  gridCols,
  spacingGap,
}: {
  content: Record<string, unknown>;
  products: Array<{
    id: string;
    name: string;
    slug: string;
    priceCents: number;
    currency: string;
    images: string | null;
    shortDescription: string | null;
  }>;
  theme: ResolvedTheme;
  storeSlug: string;
  formatPrice: (cents: number, currency: string) => string;
  cardClasses: string;
  imageClasses: string;
  gridCols: string;
  spacingGap: string;
}) {
  const title = (content.title as string) || "Featured Products";
  const count = Number(content.count) || 8;
  const displayProducts = products.slice(0, count);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: `var(--store-font-heading), sans-serif` }}
        >
          {title}
        </h2>
        <Link
          href={`/store/${storeSlug}/products`}
          className="text-sm font-medium hover:underline"
          style={{ color: theme.colors.primary }}
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
          {displayProducts.map((product) => {
            const images = JSON.parse(product.images || "[]") as { url: string; alt?: string }[];
            const mainImage = images[0];
            return (
              <Link
                key={product.id}
                href={`/store/${storeSlug}/products/${product.slug}`}
                className={`group ${cardClasses}`}
              >
                <div className={`aspect-square overflow-hidden bg-gray-100 mb-3 ${imageClasses}`}>
                  {mainImage ? (
                    <Image
                      src={mainImage.url}
                      alt={mainImage.alt || product.name}
                      width={400}
                      height={400}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <h3 className="text-sm font-medium group-hover:underline line-clamp-2">
                  {product.name}
                </h3>
                <p className="text-sm font-semibold mt-1" style={{ color: theme.colors.primary }}>
                  {formatPrice(product.priceCents, product.currency)}
                </p>
              </Link>
            );
          })}
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

  // Fetch featured products (include DRAFT in preview mode)
  const products = await prisma.product.findMany({
    where: {
      storeId: store.id,
      status: isPreview ? { in: ["ACTIVE", "DRAFT"] } : "ACTIVE",
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      name: true,
      slug: true,
      priceCents: true,
      currency: true,
      images: true,
      shortDescription: true,
    },
  });

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

  // Card style classes
  function getCardClasses(): string {
    switch (theme.layout.cardStyle) {
      case "rounded":
        return "rounded-xl p-2 bg-white/50";
      case "sharp":
        return "rounded-none";
      case "shadow":
        return "rounded-lg shadow-md hover:shadow-lg transition-shadow";
      case "bordered":
        return "rounded-lg border";
      case "minimal":
      default:
        return "";
    }
  }

  function getImageClasses(): string {
    switch (theme.layout.cardStyle) {
      case "rounded":
        return "rounded-xl";
      case "sharp":
        return "rounded-none";
      case "shadow":
        return "rounded-lg";
      case "bordered":
        return "rounded-lg";
      case "minimal":
      default:
        return "rounded-xl";
    }
  }

  const cardClasses = getCardClasses();
  const imageClasses = getImageClasses();

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
                  products={products}
                  theme={theme}
                  storeSlug={store.slug}
                  formatPrice={formatPrice}
                  cardClasses={cardClasses}
                  imageClasses={imageClasses}
                  gridCols={gridCols}
                  spacingGap={spacingGap}
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

  // ─── Fallback: original Group C theme-aware layout ────────────────────

  return (
    <div>
      {/* Hero Section — varies by heroStyle */}
      {theme.layout.heroStyle === "full-bleed" ? (
        /* FULL-BLEED: full-width banner image with text overlay centered */
        <div className="relative">
          {store.bannerUrl ? (
            <div className="h-72 sm:h-96 w-full relative">
              <Image
                src={store.bannerUrl}
                alt={store.name}
                fill
                className="object-cover"
                priority
              />
            </div>
          ) : (
            <div
              className="h-72 sm:h-96 w-full"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}88)`,
              }}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <h1
                className="text-3xl sm:text-5xl font-bold drop-shadow-lg"
                style={{ fontFamily: `var(--store-font-heading), sans-serif` }}
              >
                {store.name}
              </h1>
              {store.description && (
                <p className="mt-3 text-lg sm:text-xl max-w-2xl mx-auto drop-shadow-md opacity-90 px-4">
                  {store.description}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : theme.layout.heroStyle === "split" ? (
        /* SPLIT: left text + right image, 50/50 */
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 items-center ${spacingPy}`}>
            <div>
              <h1
                className="text-3xl sm:text-5xl font-bold"
                style={{ fontFamily: `var(--store-font-heading), sans-serif` }}
              >
                {store.name}
              </h1>
              {store.description && (
                <p className="mt-4 text-lg opacity-70 max-w-md">{store.description}</p>
              )}
              <Link
                href={`/store/${store.slug}/products`}
                className="inline-block mt-6 px-6 py-3 rounded-lg text-white font-medium text-sm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: primaryColor }}
              >
                Browse Products
              </Link>
            </div>
            <div className="aspect-[4/3] rounded-xl overflow-hidden bg-gray-100">
              {store.bannerUrl ? (
                <Image
                  src={store.bannerUrl}
                  alt={store.name}
                  width={800}
                  height={600}
                  className="w-full h-full object-cover"
                  priority
                />
              ) : (
                <div
                  className="w-full h-full"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor}44, ${primaryColor}22)`,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      ) : theme.layout.heroStyle === "overlay" ? (
        /* OVERLAY: dark gradient overlay on banner with white text */
        <div className="relative">
          {store.bannerUrl ? (
            <div className="h-72 sm:h-96 w-full relative">
              <Image
                src={store.bannerUrl}
                alt={store.name}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />
            </div>
          ) : (
            <div
              className="h-72 sm:h-96 w-full relative"
              style={{ backgroundColor: "#0f172a" }}
            >
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  background: `radial-gradient(ellipse at center, ${primaryColor}, transparent 70%)`,
                }}
              />
            </div>
          )}
          <div className="absolute inset-0 flex items-center">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <h1
                className="text-3xl sm:text-5xl font-bold text-white drop-shadow-lg max-w-xl"
                style={{ fontFamily: `var(--store-font-heading), sans-serif` }}
              >
                {store.name}
              </h1>
              {store.description && (
                <p className="mt-3 text-lg text-white/80 max-w-lg">{store.description}</p>
              )}
              <Link
                href={`/store/${store.slug}/products`}
                className="inline-block mt-6 px-6 py-3 rounded-lg text-white font-medium text-sm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: primaryColor }}
              >
                Shop Now
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* BANNER (default): simple colored banner with text */
        <div className="relative">
          {store.bannerUrl ? (
            <div className="h-64 sm:h-80 w-full relative">
              <Image
                src={store.bannerUrl}
                alt={store.name}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-black/30" />
            </div>
          ) : (
            <div
              className="h-64 sm:h-80 w-full"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}88)`,
              }}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <h1
                className="text-3xl sm:text-5xl font-bold drop-shadow-lg"
                style={{ fontFamily: `var(--store-font-heading), sans-serif` }}
              >
                {store.name}
              </h1>
              {store.description && (
                <p className="mt-3 text-lg sm:text-xl max-w-2xl mx-auto drop-shadow-md opacity-90 px-4">
                  {store.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Featured Products */}
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${spacingPy}`}>
        <div className="flex items-center justify-between mb-8">
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: `var(--store-font-heading), sans-serif` }}
          >
            Featured Products
          </h2>
          <Link
            href={`/store/${store.slug}/products`}
            className="text-sm font-medium hover:underline"
            style={{ color: primaryColor }}
          >
            View all
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-16">
            <p className="opacity-60">No products available yet. Check back soon!</p>
          </div>
        ) : (
          <div className={`grid ${gridCols} ${spacingGap}`}>
            {products.slice(0, 8).map((product) => {
              const images = JSON.parse(product.images || "[]") as { url: string; alt?: string }[];
              const mainImage = images[0];
              return (
                <Link
                  key={product.id}
                  href={`/store/${store.slug}/products/${product.slug}`}
                  className={`group ${cardClasses}`}
                >
                  <div className={`aspect-square overflow-hidden bg-gray-100 mb-3 ${imageClasses}`}>
                    {mainImage ? (
                      <Image
                        src={mainImage.url}
                        alt={mainImage.alt || product.name}
                        width={400}
                        height={400}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <h3 className="text-sm font-medium group-hover:underline line-clamp-2">
                    {product.name}
                  </h3>
                  <p className="text-sm font-semibold mt-1" style={{ color: primaryColor }}>
                    {formatPrice(product.priceCents, product.currency)}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
