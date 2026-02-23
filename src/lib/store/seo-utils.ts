/**
 * SEO Utilities for public storefront
 * Generates JSON-LD structured data for search engines
 */

export interface StoreJsonLdData {
  name: string;
  description?: string;
  url: string;
  logoUrl?: string;
  currency?: string;
}

export interface ProductJsonLdData {
  name: string;
  description?: string;
  url: string;
  imageUrl?: string;
  priceCents: number;
  currency: string;
  availability: "InStock" | "OutOfStock";
  storeName: string;
  sku?: string;
}

/**
 * Generate JSON-LD for a store (Organization + WebSite)
 */
export function generateStoreJsonLd(store: StoreJsonLdData): object[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: store.name,
      url: store.url,
      ...(store.logoUrl && { logo: store.logoUrl }),
      ...(store.description && { description: store.description }),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: store.name,
      url: store.url,
    },
  ];
}

/**
 * Generate JSON-LD for a product
 */
export function generateProductJsonLd(product: ProductJsonLdData): object {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.description && { description: product.description }),
    ...(product.imageUrl && { image: product.imageUrl }),
    ...(product.sku && { sku: product.sku }),
    offers: {
      "@type": "Offer",
      price: (product.priceCents / 100).toFixed(2),
      priceCurrency: product.currency,
      availability: `https://schema.org/${product.availability}`,
      seller: {
        "@type": "Organization",
        name: product.storeName,
      },
    },
  };
}

/**
 * Generate JSON-LD for breadcrumbs
 */
export function generateBreadcrumbJsonLd(items: Array<{ name: string; url: string }>): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
