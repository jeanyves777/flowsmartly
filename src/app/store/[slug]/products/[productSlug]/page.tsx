import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Metadata } from "next";
import { prisma } from "@/lib/db/client";
import { Mail, ChevronLeft } from "lucide-react";
import { AddToCartButton } from "@/components/store/add-to-cart-button";
import { ProductRecommendations } from "@/components/store/product-recommendations";
import { resolveTheme } from "@/lib/store/theme-utils";
import { generateProductJsonLd, generateBreadcrumbJsonLd } from "@/lib/store/seo-utils";

interface ProductPageProps {
  params: Promise<{ slug: string; productSlug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug, productSlug } = await params;

  const store = await prisma.store.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });

  if (!store) return { title: "Not Found" };

  const product = await prisma.product.findUnique({
    where: { storeId_slug: { storeId: store.id, slug: productSlug } },
    select: { name: true, slug: true, shortDescription: true, description: true, images: true, priceCents: true, currency: true },
  });

  if (!product) return { title: "Product Not Found" };

  const images = JSON.parse(product.images || "[]") as { url: string }[];
  const firstImage = images[0]?.url;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";
  const productUrl = `${baseUrl}/store/${store.slug}/products/${product.slug}`;
  const description = product.shortDescription || product.description?.slice(0, 160) || product.name;

  return {
    title: `${product.name} - ${store.name}`,
    description,
    openGraph: {
      type: "website",
      title: product.name,
      description,
      url: productUrl,
      siteName: store.name,
      images: firstImage ? [{ url: firstImage, width: 800, height: 800, alt: product.name }] : [],
    },
    twitter: {
      card: firstImage ? "summary_large_image" : "summary",
      title: product.name,
      description,
      images: firstImage ? [firstImage] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug, productSlug } = await params;

  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      theme: true,
      currency: true,
      user: {
        select: { email: true },
      },
    },
  });

  if (!store) {
    notFound();
  }

  const product = await prisma.product.findUnique({
    where: { storeId_slug: { storeId: store.id, slug: productSlug } },
    include: {
      variants: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!product || product.status !== "ACTIVE" || product.deletedAt) {
    notFound();
  }

  // Fire-and-forget: increment view count
  prisma.product.update({
    where: { id: product.id },
    data: { viewCount: { increment: 1 } },
  }).catch(() => {});

  const theme = resolveTheme(store.theme);
  const primaryColor = theme.colors.primary;

  const images = JSON.parse(product.images || "[]") as { url: string; alt?: string }[];

  function formatPrice(cents: number, currency: string) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(cents / 100);
  }

  const variants = product.variants.map((v) => ({
    ...v,
    options: JSON.parse(v.options || "{}") as Record<string, string>,
  }));

  // Spacing classes
  const spacingPy = theme.layout.spacing === "compact" ? "py-6" : theme.layout.spacing === "spacious" ? "py-12" : "py-8";

  // Card style for variant cards
  function getVariantCardStyle(): React.CSSProperties {
    switch (theme.layout.cardStyle) {
      case "shadow":
        return { boxShadow: "0 1px 3px rgba(0,0,0,0.1)" };
      case "bordered":
        return { border: `1px solid ${theme.colors.text}15` };
      default:
        return { border: `1px solid ${theme.colors.text}15` };
    }
  }

  // Image border radius based on card style
  const imageRadius =
    theme.layout.cardStyle === "sharp"
      ? "rounded-none"
      : theme.layout.cardStyle === "rounded"
        ? "rounded-2xl"
        : "rounded-xl";

  // SEO: JSON-LD structured data
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";
  const storeUrl = `${baseUrl}/store/${store.slug}`;
  const productUrl = `${storeUrl}/products/${product.slug}`;

  const productJsonLd = generateProductJsonLd({
    name: product.name,
    description: product.shortDescription || product.description || undefined,
    url: productUrl,
    imageUrl: images[0]?.url,
    priceCents: product.priceCents,
    currency: product.currency,
    availability: product.status === "ACTIVE" ? "InStock" : "OutOfStock",
    storeName: store.name,
    sku: product.id,
  });

  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: store.name, url: storeUrl },
    { name: "Products", url: `${storeUrl}/products` },
    { name: product.name, url: productUrl },
  ]);

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${spacingPy}`}>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Back Link */}
      <Link
        href={`/store/${store.slug}/products`}
        className="inline-flex items-center gap-1 text-sm opacity-60 hover:opacity-100 transition-opacity mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Products
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Image Gallery */}
        <div>
          {images.length > 0 ? (
            <div>
              <div className={`aspect-square overflow-hidden bg-gray-100 mb-4 ${imageRadius}`}>
                <Image
                  src={images[0].url}
                  alt={images[0].alt || product.name}
                  width={800}
                  height={800}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>
              {images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {images.slice(1).map((img, idx) => (
                    <div
                      key={idx}
                      className={`aspect-square overflow-hidden bg-gray-100 ${
                        theme.layout.cardStyle === "sharp" ? "rounded-none" : "rounded-lg"
                      }`}
                    >
                      <Image
                        src={img.url}
                        alt={img.alt || `${product.name} - Image ${idx + 2}`}
                        width={200}
                        height={200}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className={`aspect-square bg-gray-100 flex items-center justify-center ${imageRadius}`}>
              <svg className="w-20 h-20 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold"
            style={{ fontFamily: `var(--store-font-heading), sans-serif` }}
          >
            {product.name}
          </h1>

          {/* Price */}
          <div className="flex items-center gap-3 mt-4">
            <span className="text-2xl font-bold" style={{ color: primaryColor }}>
              {formatPrice(product.priceCents, product.currency)}
            </span>
            {product.comparePriceCents && product.comparePriceCents > product.priceCents && (
              <span className="text-lg line-through opacity-40">
                {formatPrice(product.comparePriceCents, product.currency)}
              </span>
            )}
          </div>

          {/* Short Description */}
          {product.shortDescription && (
            <p className="mt-4 opacity-70">{product.shortDescription}</p>
          )}

          {/* Add to Cart */}
          <div className="mt-6">
            <AddToCartButton
              productId={product.id}
              productName={product.name}
              priceCents={product.priceCents}
              currency={product.currency}
              imageUrl={images[0]?.url}
              trackInventory={product.trackInventory}
              quantity={product.quantity}
              variants={variants}
              primaryColor={primaryColor}
            />
          </div>

          {/* Contact Seller */}
          <div className="mt-4">
            <a
              href={`mailto:${store.user.email}?subject=Inquiry about ${product.name}`}
              className="inline-flex items-center gap-2 text-sm opacity-60 hover:opacity-100 transition-opacity"
            >
              <Mail className="h-4 w-4" />
              Contact Seller
            </a>
          </div>

          {/* Full Description */}
          {product.description && (
            <div className="mt-8 pt-8" style={{ borderTop: `1px solid ${theme.colors.text}15` }}>
              <h3
                className="text-lg font-semibold mb-3"
                style={{ fontFamily: `var(--store-font-heading), sans-serif` }}
              >
                Description
              </h3>
              <div className="prose prose-sm max-w-none opacity-70 whitespace-pre-line">
                {product.description}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Product Recommendations */}
      <div className="mt-12 pt-8" style={{ borderTop: `1px solid ${theme.colors.text}15` }}>
        <ProductRecommendations
          storeSlug={store.slug}
          productId={product.id}
          primaryColor={primaryColor}
          cardStyle={theme.layout.cardStyle as "shadow" | "bordered" | "sharp" | "rounded" | "minimal"}
        />
      </div>
    </div>
  );
}
