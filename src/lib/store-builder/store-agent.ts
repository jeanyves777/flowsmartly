/**
 * Store Builder Agent V3 — Claude writes real Next.js SSR e-commerce files
 *
 * Claude gets tools to read reference store components, write .tsx files,
 * download images, search product images, build the store, and deploy it.
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db/client";
import { getPresignedUrl } from "@/lib/utils/s3-client";
import { readReferenceComponent, getAvailableReferences } from "./reference-reader";
import {
  writeStoreFile, getStoreDir,
  initStoreDirV3, buildStoreV3, deployStoreV3,
} from "./store-site-builder";
import { cleanupV3Patterns } from "@/lib/build-utils/validators";
import { searchProductImages, downloadImageToStoreDir } from "./image-search";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProductInput {
  name: string;
  description?: string;
  priceCents: number;
  comparePriceCents?: number;
  category?: string;
  images?: string[]; // URLs (user-uploaded or AI-generated)
  variants?: Array<{ name: string; options: Record<string, string>; priceCents: number }>;
  tags?: string[];
}

interface StoreAgentContext {
  storeId: string;
  storeSlug: string;
  userId: string;
  storeInfo: {
    name: string;
    industry?: string;
    niche?: string;
    targetAudience?: string;
    region?: string;
    currency: string;
  };
  products: ProductInput[];
  categories: string[];
  siteDir: string;
  onProgress?: (step: string, detail?: string) => void;
}

interface AgentProgress {
  step: string;
  detail?: string;
  toolCalls: number;
  done: boolean;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function safeParseJSON(val: string | null | undefined): unknown {
  if (!val) return null;
  try { return JSON.parse(val); } catch { return val; }
}

// ─── Product Sync (file → DB) ────────────────────────────────────────────────

async function syncProductsToDB(storeId: string, siteDir: string): Promise<void> {
  const { readFileSync, existsSync } = await import("fs");
  const { join } = await import("path");
  const productsPath = join(siteDir, "src", "lib", "products.ts");

  if (!existsSync(productsPath)) {
    console.warn("[StoreAgent] products.ts not found, skipping DB sync");
    return;
  }

  try {
    const content = readFileSync(productsPath, "utf-8");

    // Extract product data from the products array
    // We parse the exported array using a simple regex-based approach
    const productsMatch = content.match(/export const products[^=]*=\s*(\[[\s\S]*\]);/);
    if (!productsMatch) {
      console.warn("[StoreAgent] Could not parse products array from products.ts");
      return;
    }

    // Use Function constructor to evaluate the array (safe since we control the input)
    // First strip the storeUrl() calls and replace with simple string concat
    let productsCode = productsMatch[1];
    productsCode = productsCode.replace(/storeUrl\((['"].*?['"])\)/g, '$1');

    // eslint-disable-next-line no-new-func
    const productsArray = new Function(`return ${productsCode}`)();

    if (!Array.isArray(productsArray)) return;

    let synced = 0;
    for (const p of productsArray) {
      if (!p.id || !p.name || !p.slug) continue;

      await prisma.product.upsert({
        where: {
          storeId_slug: { storeId, slug: p.slug },
        },
        create: {
          storeId,
          name: p.name,
          slug: p.slug,
          description: p.description || "",
          shortDescription: p.shortDescription || "",
          priceCents: p.priceCents || 0,
          comparePriceCents: p.comparePriceCents || null,
          categoryId: p.categoryId || null,
          tags: JSON.stringify(p.tags || []),
          images: JSON.stringify(p.images || []),
          status: "ACTIVE",
        },
        update: {
          name: p.name,
          description: p.description || "",
          shortDescription: p.shortDescription || "",
          priceCents: p.priceCents || 0,
          comparePriceCents: p.comparePriceCents || null,
          tags: JSON.stringify(p.tags || []),
          images: JSON.stringify(p.images || []),
        },
      });
      synced++;
    }

    // Update product count
    await prisma.store.update({
      where: { id: storeId },
      data: { productCount: synced },
    });

    console.log(`[StoreAgent] Synced ${synced} products to DB for store ${storeId}`);
  } catch (err: any) {
    console.error("[StoreAgent] Product sync failed:", err.message);
  }
}

// ─── Prompt Builder ──────────────────────────────────────────────────────────

function buildStorePrompt(
  storeInfo: StoreAgentContext["storeInfo"],
  products: ProductInput[],
  categories: string[]
): string {
  const productSummary = products.length > 0
    ? `\n\nProducts to include (${products.length}):\n${products
        .map((p, i) => `${i + 1}. ${p.name} — ${p.description || "no description"} — $${(p.priceCents / 100).toFixed(2)}${p.category ? ` [${p.category}]` : ""}${p.images?.length ? ` (has ${p.images.length} image(s))` : " (needs product images)"}`)
        .join("\n")}`
    : "\n\nNo products provided — generate 6-10 starter products appropriate for this store type.";

  const categorySummary = categories.length > 0
    ? `\nCategories: ${categories.join(", ")}`
    : "\nNo categories provided — create 2-4 appropriate categories.";

  return [
    `Build a complete, production-quality e-commerce store for:`,
    ``,
    `Store: ${storeInfo.name}`,
    storeInfo.industry && `Industry: ${storeInfo.industry}`,
    storeInfo.niche && `Niche: ${storeInfo.niche}`,
    storeInfo.targetAudience && `Target Audience: ${storeInfo.targetAudience}`,
    `Region: ${storeInfo.region || "US"}`,
    `Currency: ${storeInfo.currency}`,
    categorySummary,
    productSummary,
    ``,
    `Start by calling get_brand_identity, then read reference components, then build the store step by step.`,
    `For products without images, use search_product_images to find appropriate stock photos.`,
    `For products WITH image URLs provided, download those images directly.`,
  ].filter(Boolean).join("\n");
}

// ═════════════════════════════════════════════════════════════════════════════
// V3: Independent SSR Store Agent
// ═════════════════════════════════════════════════════════════════════════════

const V3_SYSTEM_PROMPT = `You are a professional e-commerce store developer. You build REAL, production-quality online stores as fully independent Next.js SSR applications. Each store you build is a complete, self-hostable app — checkout, customer accounts, order tracking, everything built-in. No redirects to external URLs.

## YOUR PROCESS (follow this order strictly):

1. Call get_brand_identity to learn about the business, products, and brand
2. Download the brand logo via download_image (category: "brand", filename: "logo") — MANDATORY
3. Write src/lib/data.ts — store config, branding, navigation, policies
4. Write src/lib/products.ts — full product catalog with helpers
5. For EVERY product — download at least 1 image:
   a. If product has image URLs, call download_image for each
   b. If NO images, call search_product_images then download_image for the best result
   c. NEVER skip — every product MUST have at least 1 real image
   d. Download 1 image per category (for category cards)
   e. Download 1 hero background image (search for the store's INDUSTRY, not generic)
6. Write src/app/globals.css with brand colors using @theme {}
7. Write src/app/layout.tsx with unified layout (Header, Footer, MobileBottomNav, CartDrawer, Analytics, CookieConsent)
8. Write all components: Header (with mobile side drawer), Hero, CategoryShowcase, FeaturedProducts, ProductCard, ProductGrid, CartDrawer, MobileBottomNav, Footer, Newsletter, AboutSection, FAQ
9. Write storefront pages:
   - src/app/page.tsx (home)
   - src/app/products/page.tsx (product listing)
   - src/app/products/[slug]/page.tsx (product detail)
   - src/app/category/[slug]/page.tsx (category view)
   - src/app/search/page.tsx (search results)
   - src/app/about/page.tsx
   - src/app/faq/page.tsx
10. Write CHECKOUT page — src/app/checkout/page.tsx:
    - "use client" — fully client-side
    - Load cart from localStorage, show order summary sidebar
    - Contact info form: name, email, phone
    - Shipping address form: street, city, state, zip, country
    - Shipping method selector: standard / local pickup
    - Payment method selector: card, cod, mobile money, bank transfer
    - Submit handler: POST to /api/checkout with items + customer info + shipping + payment method
    - On success: clear cart, redirect to /order-confirmation?orderId={id}
    - Empty cart state with "Continue Shopping" link
    - Styled with brand colors, dark mode, Framer Motion
11. Write ACCOUNT pages — all "use client", all fetch from /api/:
    - src/app/account/login/page.tsx: email + password form → POST /api/auth/login → redirect /account
    - src/app/account/register/page.tsx: name + email + password + confirm → POST /api/auth/register → redirect /account
    - src/app/account/page.tsx: dashboard with greeting, recent orders, quick links (orders/addresses/settings). Fetch from /api/account/profile + /api/account/orders. If 401 → redirect to /account/login
    - src/app/account/orders/page.tsx: full order history from /api/account/orders
    - src/app/account/orders/[orderId]/page.tsx: order detail from /api/account/orders/{orderId}
    - src/app/account/addresses/page.tsx: saved addresses from /api/account/addresses
    - src/app/account/settings/page.tsx: profile settings, update via POST /api/account/profile
12. Write ORDER pages:
    - src/app/order-confirmation/page.tsx: "use client", reads ?orderId from URL, fetches order from /api/account/orders/{id}, shows order summary + "what happens next"
    - src/app/track/[orderId]/page.tsx: public order tracking page
13. Write policy pages (branded, using store name from data.ts):
    - shipping-policy, return-policy, privacy-policy, terms
14. Write not-found.tsx and error.tsx (branded)
15. SEO: metadata, og tags, robots.txt, sitemap.ts, JSON-LD Product schema on product pages
16. Call build_store to build
17. If errors, fix the files and rebuild
18. Call finish to deploy

## CRITICAL RULES:

### This is an SSR App (NOT static export):
- Use Next.js <Link> component for ALL internal navigation — NEVER bare <a> tags for internal links
- Use Next.js <Image> component for optimized images — it handles basePath automatically
- Internal link hrefs are root-relative ("/products", "/checkout", "/account") — Next.js Link/router handles basePath
- CRITICAL — images in plain <img> src: use the FULL path returned by download_image (it already includes basePath)
  - If you must hardcode: use "/stores/\${storeSlug}/images/..." (NOT "/images/...")
  - Plain <img> tags do NOT get basePath automatically — always use the full returned path
- NO generateStaticParams() needed — SSR handles dynamic routes natively
- Server components are default; add "use client" only when using hooks/state/motion

### API Gateway (CRITICAL — how backend works):
- The builder already wrote src/lib/api-client.ts and src/app/api/[...path]/route.ts
- All backend calls go through the local /api/ proxy which forwards to FlowSmartly
- Checkout: POST to /api/checkout (NOT to an external URL)
- Auth: POST to /api/auth/login, /api/auth/register, /api/auth/logout
- Account: GET /api/account/profile, /api/account/orders, /api/account/addresses
- Products: GET /api/products (for server-side fetching if needed)
- NEVER call external URLs for backend operations — always use /api/

### Cart & Checkout (CRITICAL — NO external redirects):
- Cart uses localStorage via src/lib/cart.ts (already provided by builder — DO NOT overwrite)
- goToCheckout() in cart.ts navigates to /checkout (local page)
- Checkout page is WITHIN the store at /checkout — NOT a redirect to FlowSmartly
- Payment processing happens via /api/checkout → FlowSmartly gateway → Stripe

### Customer Accounts (CRITICAL — built into the store):
- Login/register pages are WITHIN the store at /account/login and /account/register
- Auth tokens managed via httpOnly cookies (set by the API)
- Account dashboard at /account shows orders, addresses, settings
- NEVER link to external URLs for account management

### Quality Standard:
- Every component MUST use Framer Motion (whileInView, AnimatePresence, motion.div)
- Every component MUST have dark: Tailwind variants
- Import data from '@/lib/data' and products from '@/lib/products' — NEVER hardcode content
- Use brand colors from the brand identity throughout

### Data Structure:
- src/lib/data.ts MUST contain:
  export const storeInfo = { name, tagline, description, about, mission, currency, region, logoUrl, email, phone, address, ... }
  export function formatPrice(cents: number): string { ... }
  export const categories = [...]
  export const navLinks = [{ href: "/products", label: "Shop" }, { href: "/about", label: "About" }, ...]
  export const footerLinks = [...navLinks, { href: "/faq", label: "FAQ" }, { href: "/privacy-policy", label: "Privacy Policy" }, ...]
  export const heroConfig = { headline, subheadline, ctaText, ctaUrl, ... }
  export const faq = [...]
  export const policies = { shipping, returns, privacy, terms }

- src/lib/products.ts MUST contain:
  export interface Product { id, slug, name, description, shortDescription, priceCents, comparePriceCents, categoryId, tags, images, variants, badges, featured, inStock }
  export const products: Product[] = [...]
  export function getProductBySlug, getProductsByCategory, getFeaturedProducts, searchProducts

### Logo & Favicon:
- MUST download brand logo via download_image IMMEDIATELY after get_brand_identity
- NEVER create text/SVG placeholder logos
- Logo sizing: Header h-10 sm:h-12 md:h-14 max-w-[200px] object-contain — NEVER h-4, h-6, h-8
- Footer logo: h-12 md:h-14 max-w-[180px] object-contain
- Favicon: use exact downloaded file extension

### Desktop Header Layout (MANDATORY — prevents misaligned icons):
Header.tsx MUST have this 3-column structure with a SINGLE horizontal right-icon row:
  EXAMPLE JSX:
  <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b shadow-sm">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
      {/* Logo */}
      <Link href="/"><img src={storeInfo.logoUrl} className="h-10 sm:h-12 md:h-14 max-w-[200px] object-contain" alt={storeInfo.name} /></Link>

      {/* Nav — desktop only */}
      <nav className="hidden md:flex items-center gap-6">...</nav>

      {/* Right icons — desktop only, ONE horizontal row */}
      <div className="hidden md:flex items-center gap-3">
        <button aria-label="Search"><Search size={20} /></button>
        <button aria-label="Cart" className="relative" onClick={onCartOpen}>
          <ShoppingBag size={20} />
          {cartCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">{cartCount}</span>}
        </button>
        <Link href="/account" className="flex items-center gap-1"><User size={20} /><span className="text-sm">Account</span></Link>
      </div>

      {/* Hamburger — mobile only */}
      <button className="md:hidden p-2" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={24} /></button>
    </div>
  </header>
  END EXAMPLE
- RIGHT side MUST be "hidden md:flex items-center gap-3" — ONE row, NEVER flex-col, flex-wrap, or grid
- Icon order left-to-right: Search → Cart (with badge) → Account
- On mobile: ONLY show the hamburger button (md:hidden), hide the icon row entirely

### Footer (legal requirement):
- MUST render ALL footerLinks — NEVER .slice()
- MUST include: Shipping Policy, Return Policy, Privacy Policy, Terms
- These are legally required for e-commerce stores

### Layout Integration:
- layout.tsx imports: Header, Footer, MobileBottomNav, CartDrawer, Analytics, CookieConsent
- Main content pb-16 md:pb-0 for MobileBottomNav space
- CartDrawer shared between Header cart icon and MobileBottomNav cart button
- **CRITICAL**: \`<html>\` tag MUST be \`<html lang="en" suppressHydrationWarning>\` — NO \`className="dark"\`. Adding \`className="dark"\` hardcodes dark mode and breaks the light/dark toggle permanently.

### Mobile UX:
- Header hamburger → side drawer from LEFT (motion.div x:"-100%" → x:0)
- Drawer must: logo at top (h-10), nav links with chevrons, close button inside drawer
- Drawer locks body scroll when open (document.body.style.overflow = "hidden")
- MobileBottomNav (fixed bottom, md:hidden): Shop (Home icon), Search, Cart (badge), Account
- Cart badge from localStorage + 'cart-updated' event listener
- Account button links to /account (internal)
- Logo in header: h-10 sm:h-12 md:h-14 (NEVER h-4/h-6/h-8 — too tiny)
- 2-col product grids on mobile, 3 on md, 4 on lg
- Touch targets: min 44px

### Technical:
- Tailwind CSS v4 globals.css MUST start with EXACTLY these lines (dark mode will break without @custom-variant):
    @import "tailwindcss";
    @custom-variant dark (&:where(.dark, .dark *));
  Then @theme {} block with brand colors. NEVER omit the @custom-variant line.
- NO tailwind.config.ts
- Icons from lucide-react
- Use double-quoted strings for text with apostrophes: "What's New"

### Protected Files (DO NOT write these — builder already created them):
- package.json, tsconfig.json, postcss.config.mjs, next.config.ts
- src/lib/api-client.ts, src/lib/cart.ts
- src/app/api/[...path]/route.ts
- src/components/ThemeProvider.tsx, ThemeToggle.tsx, Analytics.tsx, CookieConsent.tsx
- .env.local

### Tailwind CSS v4 Colors (CRITICAL):
- In globals.css @theme {}, define ONLY base colors: --color-primary: #xxx; --color-secondary: #xxx;
- NEVER define numbered shades: --color-primary-600, --color-primary-700 are INVALID
- In components: use bg-primary, text-primary, border-primary — NOT bg-primary-500 or text-primary-700
- For lighter/darker: use opacity modifiers like bg-primary/80, bg-primary/20

### Animations in globals.css (CRITICAL):
- NEVER use @apply inside @keyframes blocks — Tailwind v4 forbids this
- Use raw CSS in @keyframes: { opacity: 0; } not { @apply opacity-0; }
- Use raw CSS transforms: { transform: translateY(1rem); } not { @apply translate-y-4; }

### useSearchParams (CRITICAL):
- Pages that use useSearchParams() MUST be wrapped in a Suspense boundary
- Pattern: create a "use client" component file, import it in a server page.tsx wrapped with <Suspense>
- Example: SearchClient.tsx ("use client" with useSearchParams) + page.tsx (import + Suspense wrapper)
- This applies to: search pages, order-confirmation pages, any page reading URL params

### Import Order:
- Write files in dependency order: data.ts → products.ts → globals.css → layout.tsx → components → pages → checkout → account

### Reference UI Patterns (build stores like these):

**Product Grid:**
- 2-column on mobile, 3 on md, 4 on lg
- Products with variants show "Select Options" button instead of "Add to Cart"
- Clicking "Select Options" opens the product detail page
- ProductCard: image hover zoom, "NEW" / "SALE" / "BESTSELLER" / "LIMITED" badges from product.tags
- Price: if comparePriceCents > 0 show original crossed out + sale price in red

**Filter Drawer (ProductGrid page):**
- Slide-in from left (mobile/desktop toggle)
- Sections: "Product Categories" (list of categories with count), "Price Range" (slider min/max)
- "Apply Filters" button at bottom, "Clear All" link at top
- Triggered by "Filters" button in MobileBottomNav and top of product grid

**Cart Drawer:**
- Slide from RIGHT (not left), dark overlay backdrop
- Empty state: ShoppingBag icon + "No products in cart" message + "Continue Shopping" link
- Filled state: list of items with qty +/-, remove button, subtotal
- "Checkout" button at bottom → /checkout

**Account Modal (CRITICAL — slide-in drawer from right):**
- DO NOT use a full /account/login page as the entry point
- Instead: clicking Account icon in Header/MobileBottomNav opens an AccountModal component
- AccountModal is a slide-in drawer from RIGHT (like cart), with:
  - "Sign In" heading
  - Email + Password fields
  - "Log In" button → POST /api/auth/login
  - Divider with "or" text
  - "No account yet? Create An Account" → shows registration form in same drawer
  - Google Sign In button (if configured)
  - After login success: close drawer, refresh page state
- If user IS logged in: clicking Account goes directly to /account (full page)
- AccountModal context provider: wrap in layout.tsx — provides openAccountModal() function
- Header and MobileBottomNav call openAccountModal() if !user, else navigate to /account

**MobileBottomNav (5 items — MANDATORY):**
- Fixed bottom, md:hidden
- Items: Shop (HomeIcon → /products), Filters (SlidersHorizontal → triggers filter drawer), Wishlist (Heart), Cart (ShoppingBag with badge), My Account (User)
- Active state: primary color icon + label
- "Filters" triggers filterDrawerOpen state (shared via context or prop)
- "Cart" triggers cartDrawerOpen
- "My Account" calls openAccountModal() if not logged in, else /account

### Pre-deploy Verification Checklist (VERIFY ALL before calling finish):
1. ✅ layout.tsx imports ThemeProvider (default from @/components/ThemeProvider)
2. ✅ layout.tsx imports AccountModalProvider (default from @/components/AccountModalProvider)
3. ✅ layout.tsx body: <ThemeProvider><AccountModalProvider><CartProvider>...content...</CartProvider></AccountModalProvider></ThemeProvider>
3b. ✅ layout.tsx <html> tag MUST be: <html lang="en" suppressHydrationWarning> — NEVER add className="dark" (ThemeProvider manages dark mode via JS, hardcoding it breaks light mode permanently)
4. ✅ NO hardcoded product names, descriptions, or prices — all from products.ts
5. ✅ NO hardcoded category names — all from data.ts categories[]
6. ✅ All product images use downloaded paths (from download_image return value)
7. ✅ MobileBottomNav exists with 5 items including Filters and My Account
8. ✅ AccountModal drawer exists for sign-in (NOT a plain redirect to /account/login)
9. ✅ ThemeToggle in Header — dark/light mode switch works
10. ✅ Footer sticks to bottom (min-h-screen flex flex-col on root layout, flex-1 on main)
11. ✅ All internal links use Next.js <Link> component — no <a href="..."> for internal pages
12. ✅ CartDrawer slides from right, AccountModal slides from right, FilterDrawer slides from left`;


// ─── V3 Tool Definitions ─────────────────────────────────────────────────────

const V3_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_brand_identity",
    description: "Get the user's brand identity (name, colors, fonts, logo, contacts) plus store details (currency, products, categories). Call this FIRST.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "read_reference",
    description: `Read a reference store component to study its code patterns, animations, and quality level. ALWAYS read the reference before writing a component. Available: ${getAvailableReferences().join(", ")}`,
    input_schema: {
      type: "object" as const,
      properties: {
        component: { type: "string", description: "Component name (e.g. 'Hero', 'ProductCard', 'Data', 'Products', 'Cart')" },
      },
      required: ["component"],
    },
  },
  {
    name: "write_file",
    description: "Write a file to the store project. Use for .tsx components, .css files, data files, page files, etc. Path is relative to project root (e.g. 'src/components/Hero.tsx', 'src/lib/data.ts', 'src/lib/products.ts').",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "File path relative to project root" },
        content: { type: "string", description: "Complete file content" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "download_image",
    description: "Download an image from a URL and save it to the store's public/images/ directory. Returns the local path to use in components.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "Image URL to download" },
        category: { type: "string", description: "Image category folder (products, brand, hero, categories)" },
        filename: { type: "string", description: "Filename without extension (e.g. 'logo', 'desk-lamp')" },
      },
      required: ["url", "category", "filename"],
    },
  },
  {
    name: "search_product_images",
    description: "Search Pexels for product images. Returns URLs you can download with download_image. Use for products that don't have user-provided images.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query describing the product (e.g. 'ceramic planter set')" },
        count: { type: "number", description: "Number of results (1-5, default 2)" },
      },
      required: ["query"],
    },
  },
  {
    name: "build_store",
    description: "Run next build (SSR mode) to compile the store. Returns build output or errors. If errors, fix the files and rebuild.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "finish",
    description: "Deploy the built store as an independent SSR app (starts PM2 process). Call this LAST after a successful build.",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: { type: "string", description: "Summary of what was built" },
      },
      required: ["summary"],
    },
  },
];

// ─── V3 Tool Execution ──────────────────────────────────────────────────────

async function executeToolV3(name: string, input: Record<string, unknown>, ctx: StoreAgentContext): Promise<string> {
  // Most tools are the same — only build_store and finish differ
  switch (name) {
    case "get_brand_identity": {
      // Same as V2 but change accountUrl to internal /account
      ctx.onProgress?.("Reading brand identity...");
      const brandKit = await prisma.brandKit.findFirst({
        where: { userId: ctx.userId },
        orderBy: { isDefault: "desc" },
      });

      const website = await prisma.website.findFirst({
        where: { userId: ctx.userId, status: "PUBLISHED", deletedAt: null },
        select: { slug: true, customDomain: true },
      });
      const websiteUrl = website
        ? (website.customDomain ? `https://${website.customDomain}` : `${process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com"}/sites/${website.slug}`)
        : "";

      const productList = ctx.products.map(p => ({
        name: p.name,
        description: p.description || "",
        priceCents: p.priceCents,
        comparePriceCents: p.comparePriceCents,
        category: p.category || "general",
        images: p.images || [],
        variants: p.variants || [],
        tags: p.tags || [],
      }));

      const brandData: Record<string, unknown> = {
        storeName: ctx.storeInfo.name,
        industry: ctx.storeInfo.industry,
        niche: ctx.storeInfo.niche,
        targetAudience: ctx.storeInfo.targetAudience,
        region: ctx.storeInfo.region,
        currency: ctx.storeInfo.currency,
        products: productList,
        categories: ctx.categories,
        productCount: productList.length,
        storeId: ctx.storeId,
        storeSlug: ctx.storeSlug,
        // V3: NO basePath, NO external accountUrl
        accountUrl: "/account",
        checkoutUrl: "/checkout",
        websiteUrl,
      };

      if (brandKit) {
        Object.assign(brandData, {
          name: brandKit.name,
          tagline: brandKit.tagline,
          description: brandKit.description,
          colors: safeParseJSON(brandKit.colors),
          fonts: safeParseJSON(brandKit.fonts),
          logoUrl: brandKit.logo ? await getPresignedUrl(brandKit.logo) : null,
          logoInstructions: brandKit.logo
            ? "IMPORTANT: Download this logo using download_image with the logoUrl above, category 'brand' and filename 'logo'. Then use the returned path in Header, Footer, and favicon."
            : "No logo available — use the store name as text in the header.",
          handles: safeParseJSON(brandKit.handles),
          email: brandKit.email,
          phone: brandKit.phone,
          website: brandKit.website,
          address: brandKit.address,
          city: brandKit.city,
          state: brandKit.state,
          country: brandKit.country,
          voiceTone: brandKit.voiceTone,
        });
      } else {
        brandData.noBrandKit = true;
      }

      return JSON.stringify(brandData);
    }

    case "read_reference": {
      const component = input.component as string;
      ctx.onProgress?.("Reading reference...", component);
      const source = readReferenceComponent(component);
      if (!source) return JSON.stringify({ error: `Could not read reference: ${component}. Available: ${getAvailableReferences().join(", ")}` });
      return source;
    }

    case "write_file": {
      const path = input.path as string;
      const content = input.content as string;
      ctx.onProgress?.("Writing file...", path);

      // V3 protected files (builder writes these — agent must NOT overwrite)
      const protectedFiles = [
        "package.json", "tsconfig.json", "postcss.config.mjs", "next.config.ts",
        ".env.local",
        "src/lib/api-client.ts", "src/lib/cart.ts",
        "src/app/api/[...path]/route.ts",
        "src/components/ThemeProvider.tsx", "src/components/ThemeToggle.tsx",
        "src/components/Analytics.tsx", "src/components/CookieConsent.tsx",
      ];
      if (protectedFiles.includes(path)) {
        return JSON.stringify({ skipped: true, reason: `${path} is provided by the builder — do not overwrite` });
      }

      try {
        writeStoreFile(ctx.storeId, path, content);
        return JSON.stringify({ success: true, path });
      } catch (err: any) {
        return JSON.stringify({ error: err.message });
      }
    }

    case "download_image": {
      const url = input.url as string;
      const category = input.category as string;
      const filename = input.filename as string;
      ctx.onProgress?.("Downloading image...", filename);

      try {
        const localPath = await downloadImageToStoreDir(url, ctx.siteDir, category, filename);
        // V3: prefix with basePath so <img src> works in the browser
        const fullPath = `/stores/${ctx.storeSlug}${localPath}`;
        return JSON.stringify({
          success: true,
          localPath: fullPath,
          usage: `Use as: src="${fullPath}" in <img> tags. For Next.js <Image>, you can use localPath="${localPath}" since Image auto-prepends basePath.`,
        });
      } catch (err: any) {
        return JSON.stringify({ error: err.message, localPath: `/stores/${ctx.storeSlug}/images/${category}/placeholder.jpg` });
      }
    }

    case "search_product_images": {
      const query = input.query as string;
      const count = Math.min((input.count as number) || 2, 5);
      ctx.onProgress?.("Searching product images...", query);
      try {
        const results = await searchProductImages(query, count);
        return JSON.stringify({ images: results });
      } catch (err: any) {
        return JSON.stringify({ error: err.message, images: [] });
      }
    }

    case "build_store": {
      ctx.onProgress?.("Building SSR store...");
      const result = await buildStoreV3(ctx.storeId);
      if (result.success) {
        return JSON.stringify({ success: true, message: "SSR build succeeded" });
      }
      return JSON.stringify({ success: false, error: result.error?.substring(0, 3000) });
    }

    case "finish": {
      ctx.onProgress?.("Deploying independent store...");
      const deployResult = await deployStoreV3(ctx.storeId, ctx.storeSlug);
      if (!deployResult.success) {
        return JSON.stringify({ error: deployResult.error });
      }

      await syncProductsToDB(ctx.storeId, ctx.siteDir);

      return JSON.stringify({
        success: true,
        url: `/stores/${ctx.storeSlug}`,
        summary: input.summary,
      });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// ─── V3 Agent Runner ─────────────────────────────────────────────────────────

export async function runStoreAgentV3(
  storeId: string,
  storeSlug: string,
  userId: string,
  storeInfo: StoreAgentContext["storeInfo"],
  products: ProductInput[],
  categories: string[],
  onProgress?: (progress: AgentProgress) => void
): Promise<{ success: boolean; error?: string }> {
  // Initialize V3 store directory (SSR templates, API proxy, cart, env)
  const siteDir = initStoreDirV3(storeId, storeSlug);

  const ctx: StoreAgentContext = {
    storeId,
    storeSlug,
    userId,
    storeInfo,
    products,
    categories,
    siteDir,
    onProgress: (step, detail) => {
      onProgress?.({ step, detail, toolCalls, done: false });
    },
  };

  let toolCalls = 0;
  const maxIterations = 50;

  const userPrompt = buildStorePrompt(storeInfo, products, categories);
  let messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt }];

  try {
    await prisma.store.update({
      where: { id: storeId },
      data: {
        buildStatus: "building",
        generatedPath: siteDir,
        generatorVersion: "v3",
      },
    });

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`[StoreAgent:V3] Iteration ${iteration + 1}, messages: ${messages.length}, tools: ${toolCalls}`);

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 16000,
        system: V3_SYSTEM_PROMPT,
        tools: V3_TOOLS,
        messages,
      });

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) {
        // Agent stopped without calling build_store — auto-build
        console.log("[StoreAgent:V3] No more tool calls — auto-building...");
        break; // Fall through to the auto-build block below the loop
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        toolCalls++;
        console.log(
          `[StoreAgent:V3] Tool #${toolCalls}: ${toolUse.name}${
            toolUse.name === "write_file" ? ` (${(toolUse.input as any).path})` : ""
          }`
        );

        try {
          const result = await executeToolV3(toolUse.name, toolUse.input as Record<string, unknown>, ctx);

          if (toolUse.name === "finish") {
            onProgress?.({ step: "Store deployed!", toolCalls, done: true });
            messages.push({ role: "assistant", content: response.content });
            messages.push({
              role: "user",
              content: [{ type: "tool_result", tool_use_id: toolUse.id, content: result }],
            });
            return { success: true };
          }

          toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
        } catch (err: any) {
          console.error(`[StoreAgent:V3] Tool ${toolUse.name} failed:`, err.message);
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: err.message }),
            is_error: true,
          });
        }
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
    }

    // Max iterations reached — agent wrote files but didn't call build_store/finish
    // Auto-build and deploy so the user isn't stuck
    console.warn(`[StoreAgent:V3] Max iterations reached (${toolCalls} tool calls). Auto-building...`);
    onProgress?.({ step: "Finalizing store...", toolCalls, done: false });

    try {
      // Run V3 cleanup validator before building
      cleanupV3Patterns(siteDir);

      const buildResult = await buildStoreV3(storeId);
      if (buildResult.success) {
        onProgress?.({ step: "Deploying store...", toolCalls, done: false });
        const deployResult = await deployStoreV3(storeId, storeSlug);
        if (deployResult.success) {
          await syncProductsToDB(storeId, siteDir);
          onProgress?.({ step: "Store ready!", toolCalls, done: true });
          return { success: true };
        } else {
          // Deploy failed but build succeeded — set error with details
          await prisma.store.update({
            where: { id: storeId },
            data: { buildStatus: "error", lastBuildError: `Deploy failed: ${deployResult.error}` },
          });
          return { success: false, error: deployResult.error };
        }
      } else {
        // Build failed — set error so UI shows it
        await prisma.store.update({
          where: { id: storeId },
          data: { buildStatus: "error", lastBuildError: buildResult.error?.substring(0, 2000) },
        });
        return { success: false, error: buildResult.error };
      }
    } catch (buildErr: any) {
      console.error("[StoreAgent:V3] Auto-build failed:", buildErr.message);
      await prisma.store.update({
        where: { id: storeId },
        data: { buildStatus: "error", lastBuildError: `Auto-build failed: ${buildErr.message}` },
      });
      return { success: false, error: buildErr.message };
    }
  } catch (err: any) {
    console.error("[StoreAgent:V3] Fatal error:", err.message);
    await prisma.store.update({
      where: { id: storeId },
      data: { buildStatus: "error", lastBuildError: err.message },
    });
    return { success: false, error: err.message };
  }
}
