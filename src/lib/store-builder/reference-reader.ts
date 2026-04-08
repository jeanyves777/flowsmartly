/**
 * Reference Store Reader — reads reference components for the store agent to study.
 * The agent reads these before writing each component to ensure quality/consistency.
 *
 * Mirrors src/lib/website/reference-reader.ts
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Reference store location (local dev vs server)
const REFERENCE_BASE = process.platform === "win32"
  ? "C:\\Users\\koffi\\Dev\\flowsmartly\\reference-store\\src"
  : "/opt/reference-store/src";

// Map of component names → file paths relative to REFERENCE_BASE
const COMPONENT_MAP: Record<string, string> = {
  // Components
  Header: "components/Header.tsx",
  Hero: "components/Hero.tsx",
  ProductCard: "components/ProductCard.tsx",
  ProductGrid: "components/ProductGrid.tsx",
  CategoryShowcase: "components/CategoryShowcase.tsx",
  FeaturedProducts: "components/FeaturedProducts.tsx",
  CartDrawer: "components/CartDrawer.tsx",
  Footer: "components/Footer.tsx",
  Newsletter: "components/Newsletter.tsx",
  AboutSection: "components/AboutSection.tsx",
  FAQ: "components/FAQ.tsx",
  PolicyPage: "components/PolicyPage.tsx",

  // Data files
  Data: "lib/data.ts",
  Products: "lib/products.ts",
  Cart: "lib/cart.ts",

  // Pages
  HomePage: "app/page.tsx",
  ProductsPage: "app/products/page.tsx",
  ProductDetailPage: "app/products/[slug]/page.tsx",
  ProductDetailClient: "app/products/[slug]/ProductDetailClient.tsx",
  CategoryPage: "app/category/[slug]/page.tsx",
  CategoryClient: "app/category/[slug]/CategoryClient.tsx",
  AboutPage: "app/about/page.tsx",
  FAQPage: "app/faq/page.tsx",
  ShippingPolicyPage: "app/shipping-policy/page.tsx",
};

// ADAPT warnings injected when reference uses patterns that need changing
const ADAPT_WARNINGS = [
  { pattern: /from ['"]next\/link['"]/, warning: "ADAPT: Replace next/link <Link> with plain <a> tags + storeUrl() for static export." },
  { pattern: /from ['"]next\/image['"]/, warning: "ADAPT: Replace next/image <Image> with plain <img> tags for static export (images.unoptimized is true)." },
  { pattern: /@tailwind\s+(base|components|utilities)/, warning: "ADAPT: Use Tailwind v4 syntax (@import 'tailwindcss'), NOT v3 (@tailwind directives)." },
];

/**
 * Read a reference component by name.
 * Returns the file content with ADAPT warnings prepended.
 */
export function readReferenceComponent(name: string): string | null {
  const relPath = COMPONENT_MAP[name];
  if (!relPath) return null;

  const fullPath = join(REFERENCE_BASE, relPath);
  if (!existsSync(fullPath)) return null;

  let content = readFileSync(fullPath, "utf-8");

  // Check for patterns that need adaptation
  const warnings: string[] = [];
  for (const { pattern, warning } of ADAPT_WARNINGS) {
    if (pattern.test(content)) {
      warnings.push(warning);
    }
  }

  if (warnings.length > 0) {
    const warningBlock = warnings.map(w => `// ⚠️ ${w}`).join("\n");
    content = `${warningBlock}\n\n${content}`;
  }

  return content;
}

/**
 * Get list of available reference components.
 */
export function getAvailableReferences(): string[] {
  return Object.keys(COMPONENT_MAP);
}
