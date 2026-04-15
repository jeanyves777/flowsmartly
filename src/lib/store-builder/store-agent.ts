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
  labels?: string[]; // Product labels: "new", "sale", "bestseller", "limited", "discount", "featured"
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
  shippingMethods: Array<{ id: string; name: string; description?: string | null; priceCents: number; estimatedDays?: string | null; isActive: boolean }>;
  freeShippingThresholdCents: number;
  flatRateShippingCents: number;
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
          labels: JSON.stringify(p.labels || []),
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
          labels: JSON.stringify(p.labels || []),
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
    ? `\nCategories (USE THESE EXACT NAMES — do NOT rename or invent new ones): ${categories.join(", ")}`
    : "\nNo categories provided — derive categories from the products' category field. Do NOT invent category names.";

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
    - Load cart from localStorage, show order summary sidebar with per-item prices + subtotal + shipping + total
    - 3-step checkout with animated stepper (Info → Shipping → Payment):
      Step 0 (Info): contact form — Full Name, Email, Phone (pre-fill from window.__storeCustomer)
      Step 1 (Shipping): address form (street, city, state, zip, country) + shipping method radio buttons from shippingMethods[] in data.ts
      Step 2 (Payment) — INLINE Stripe flow, NO /checkout/confirm redirect:
        MANDATORY — fetch GET /api/checkout/options. Render ONE radio per returned entry in data.paymentMethods.
        When an entry's provider === "stripe" and stripeMethods is an array, render the sub-methods as small chips
        under the label (e.g. "Apple Pay · Link · Cash App Pay"). Trust the API response — do NOT hardcode or invent.
        Default selection: the first entry in data.paymentMethods.

        CRITICAL — INLINE STRIPE: When the selected entry has provider === "stripe", you MUST embed Stripe Elements
        on THIS page (step 2). DO NOT redirect to /checkout/confirm anymore.
        Flow:
          1. As soon as the user lands on step 2 AND a Stripe method is selected AND contact/shipping are filled,
             POST to /api/checkout once to create the PendingCheckout + PaymentIntent and receive { clientSecret, orderNumber, orderId }.
             Re-POST whenever the user switches Stripe method (so the PI is pinned to the right rail).
             Use credentials: "include" — this attaches the logged-in Stripe Customer, which makes saved cards appear
             in PaymentElement and auto-saves new cards for reuse.
          2. Wrap the page in <Elements stripe={stripePromise} options={{ clientSecret, appearance }} key={clientSecret}>.
          3. Render <PaymentElement options={{ layout: "tabs" }} />.
          4. On "Pay" click: call stripe.confirmPayment({ elements, redirect: "if_required", confirmParams: { return_url } }).
             On paymentIntent.status === "succeeded" OR "processing": clearCart() + render the inline success screen.
             On error: show the error message below PaymentElement and allow retry.
          5. For non-Stripe methods (cod / mobile_money / bank_transfer): show the existing info panels and POST /api/checkout
             on "Place Order" click — the backend creates the Order immediately (no payment step). Clear cart + success screen.

        DO NOT write src/app/checkout/confirm/page.tsx — it is pre-built by the system as a legacy fallback only.
        DO NOT redirect to it. All card payments must complete inline on src/app/checkout/page.tsx.
    - Required import: import { loadStripe } from "@stripe/stripe-js"; import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
    - POST /api/checkout body (both paths):
      {
        items: [{ productId, variantId?, quantity }],
        customerName: form.name,
        customerEmail: form.email,
        customerPhone: form.phone || undefined,
        shippingAddress: { street, city, state, zip, country },
        shippingMethod: selectedMethod?.name?.toLowerCase().includes("pickup") ? "local_pickup" : "standard",
        paymentMethod: selectedPayment.method  // "card" | "stripe_klarna" | "stripe_affirm" | "cod" | "mobile_money" | "bank_transfer"
      }
    - Empty cart state with "Continue Shopping" link
    - Styled with brand colors, dark mode, Framer Motion
    CRITICAL: DO NOT write src/app/checkout/confirm/page.tsx — it is PRE-BUILT by the system (Stripe
    PaymentElement). Writing it would overwrite the Stripe integration and break all card payments.
11. Write ACCOUNT pages — all "use client", all fetch from /api/:
    - src/app/account/login/page.tsx: email + password form → POST /api/auth/login → redirect /account
      MANDATORY ANTI-SPAM: import { Turnstile } from "@marsidev/react-turnstile"; add turnstileToken state;
      render <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""} onSuccess={setTurnstileToken} onError={() => setTurnstileToken("")} onExpire={() => setTurnstileToken("")} />;
      Submit button: disabled={loading || (!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken)};
      Google Sign In link: add onClick={(e) => { if (!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken) e.preventDefault(); }} and apply opacity-50 cursor-not-allowed when token missing;
      Send turnstileToken in POST body.
    - src/app/account/register/page.tsx: name + email + password + confirm → POST /api/auth/register → redirect /account
      MANDATORY ANTI-SPAM: same Turnstile pattern as login — import, state, widget, disabled button until validated, send token in body.
    - src/app/account/page.tsx: dashboard with greeting, recent orders, quick links (orders/addresses/settings). Fetch from /api/account/profile + /api/account/orders. If 401 → redirect to /account/login
    - src/app/account/orders/page.tsx: PRE-BUILT — DO NOT WRITE OR OVERWRITE. Includes real order list from /api/account/orders, pending card payment banner with "Complete Payment" CTA + "Cancel Order" button (PATCH /api/account/orders/{id} with { action: "cancel" }), pagination, status badges. getBasePath() used for all window.location.href navigations.
    - src/app/account/orders/[orderId]/page.tsx: PRE-BUILT — DO NOT WRITE OR OVERWRITE. Real order detail: status timeline, items, cancel (PENDING/CONFIRMED/PROCESSING only via PATCH {action:"cancel"}), change address (PENDING/CONFIRMED/PROCESSING only via PATCH {action:"update_address"}), return request (DELIVERED only via PUT with reason). getBasePath() used for all window.location.href navigations.
    - CRITICAL — getBasePath() pattern: Any page that does window.location.href navigation MUST use getBasePath() to prefix all paths:
      function getBasePath() { return window.location.pathname.match(/^(\/stores\/[^/]+)/)?.[1] || ""; }
      Use it for: checkout redirect, login redirect, any hard nav. Never hardcode /stores/slug/ — read it from the URL.
    - CRITICAL — NO BROWSER DIALOGS: NEVER use window.alert(), window.confirm(), or window.prompt(). They are ugly, unstyled OS popups that break the store's brand. Instead:
      - Confirmations: render an inline branded modal overlay with store CSS vars (--store-background, --store-text, --store-primary)
      - Errors: render an inline error message below the button, or a dismissible banner styled with CSS vars
      - Pattern: use a React state { type: "confirm"|"error", message, ... } | null and render a fixed inset-0 overlay div
    - CRITICAL — products links: When linking to the products page, ALWAYS use /stores/{SLUG}/products (the store app). Never use /store/{SLUG}/products (that path does not exist on the main app and causes 404).
    - src/app/account/wishlist/page.tsx (if written): MUST be a "use client" component. Fetch from /api/account/wishlist (GET returns items with product details). Remove button: DELETE /api/account/wishlist with { productId } body. No server-rendered wishlist pages — always client component for interactive remove.
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

### Product Management (LEGAL REQUIREMENT):
- NEVER HARDCODE product attributes like labels, "featured", "inStock" status, or badges
- These attributes MUST be user-controlled through the admin Product Management dashboard
- Product labels ("new", "sale", "bestseller", "limited", "discount", "featured") are ONLY set by users via the dashboard, NOT in the codebase
- Generate all products with EMPTY labels array: labels: []
- Generate all products with default values: featured: false, inStock: true
- Violating this rule creates locked-in product data that users cannot manage, degrading the product UI and user trust

### This is an SSR App (NOT static export):
- Use Next.js <Link> component for ALL internal navigation — NEVER bare <a> tags for internal links
- Use Next.js <Image> component for optimized images — it handles basePath automatically
- Internal link hrefs are root-relative ("/products", "/checkout", "/account") — Next.js Link/router handles basePath
- CRITICAL — images in plain <img> src: use the FULL path returned by download_image (it already includes basePath)
  - If you must hardcode: use "/stores/\${storeSlug}/images/..." (NOT "/images/...")
  - Plain <img> tags do NOT get basePath automatically — always use the full returned path
- window.location.href does NOT respect Next.js basePath — NEVER use window.location.href = "/some-path"; instead use:
  function getBasePath() { return window.location.pathname.match(/^(\/stores\/[^/]+)/)?.[1] || ""; }
  window.location.href = getBasePath() + "/some-path";
  Or prefer router.push("/path") when inside a component (Next.js router handles basePath automatically)
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
- src/app/checkout/confirm/page.tsx (Stripe PaymentElement) is already provided by the builder — DO NOT overwrite
- goToCheckout() in cart.ts navigates to /checkout (local page)
- Checkout page is WITHIN the store at /checkout — NOT a redirect to FlowSmartly
- Checkout MUST use the store's own Header and Footer components — NEVER create a separate/fabricated nav
  import Header from "@/components/Header"; import Footer from "@/components/Footer"; import CartDrawer from "@/components/CartDrawer";
- Account pages MUST also use the store's Header and Footer — same consistent nav everywhere
- Payment processing happens via /api/checkout → FlowSmartly gateway → Stripe
- Checkout shipping methods MUST come from data.ts shippingMethods array (NEVER hardcoded):
  import { shippingMethods } from "@/lib/data";
  import { storeInfo } from "@/lib/data";
  // Display only active methods from shippingMethods array
  // Each has: id, name, description, priceCents, estimatedDays
  // Free shipping: if storeInfo.freeShippingThresholdCents > 0 && total >= threshold → shipping is free
  const freeThreshold = (storeInfo as any).freeShippingThresholdCents || 0;
  const isFreeShipping = freeThreshold > 0 && cartTotal >= freeThreshold;
  const shippingCost = isFreeShipping ? 0 : selectedMethod.priceCents;
- NEVER hardcode shipping method names, prices, or delivery times (no "599", no "Standard Shipping")
- NEVER create static shipping options — always read from shippingMethods[]
- Checkout MUST pre-fill customer data from window.__storeCustomer on mount:
  useEffect(() => {
    setCart(getCart());
    const c = (window as any).__storeCustomer;
    if (c) {
      const names = (c.name || "").split(" ");
      setOrderData(prev => ({ ...prev,
        firstName: prev.firstName || names[0] || "",
        lastName: prev.lastName || names.slice(1).join(" ") || "",
        email: prev.email || c.email || "",
        phone: prev.phone || c.phone || "",
      }));
    }
  }, []);
- NEVER leave checkout fields empty when customer is logged in

### Checkout & Order Flow Rules (CRITICAL — prevent broken logic):
- CART CLEARING: NEVER call clearCart() on order creation. Cart items must ONLY be cleared AFTER payment is fully confirmed (card: after confirmCardPayment succeeds; non-card: after checkout API returns orderId). If payment fails, cart must remain intact so customer can retry.
- RESUME PAYMENT: When a customer resumes payment for a pending order (e.g. from My Orders), redirect to the FULL checkout page with payment method selection (not directly to payment). The customer may want to choose a different payment method. Use: window.location.href = getBasePath() + "/checkout?resumeOrder=" + orderId
- RESUME ORDER ITEMS: When checkout loads with resumeOrder param, use the order's items (from server) directly for display and submission. Do NOT depend on cart localStorage for resume orders — the cart may have different/newer items.
- ADDRESS SAVING: When a logged-in customer completes checkout, always save the shipping address to their account (StoreCustomer.addresses) if it does not already exist. This enables address pre-fill on future orders.
- CANCELLED ORDERS: When querying "Payment Required" / pending orders, ALWAYS exclude cancelled orders (status !== "CANCELLED"). An order can have paymentStatus "pending" AND status "CANCELLED" simultaneously.
- API RESPONSE CHECK: When checking if an API call succeeded, use res.ok (HTTP status) not data.success — different endpoints return different shapes. Some return { success: true, data } while others return the object directly.

### Customer Accounts (CRITICAL — built into the store):
- Login/register pages are WITHIN the store at /account/login and /account/register
- Auth tokens managed via httpOnly cookies (set by the API)
- Account dashboard at /account shows orders, addresses, settings
- NEVER link to external URLs for account management

### Quality Standard:
- Every component MUST use Framer Motion (whileInView, AnimatePresence, motion.div)
- Every component MUST have dark: Tailwind variants — NO exceptions:
  - Backgrounds: bg-white → bg-white dark:bg-gray-900 (panels), bg-gray-50 → bg-gray-50 dark:bg-gray-800 (sections)
  - Inputs/textareas: always include dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500
  - Text: text-gray-900 → dark:text-white, text-gray-600 → dark:text-gray-300, text-gray-400 → dark:text-gray-500
  - Borders: border-gray-200 → dark:border-gray-700, divide-gray-200 → dark:divide-gray-700
  - Cards/drawers: bg-white dark:bg-gray-900 or bg-gray-50 dark:bg-gray-800
- Import data from '@/lib/data' and products from '@/lib/products' — NEVER hardcode content
- Use brand colors from the brand identity throughout

### Data Structure:
- src/lib/data.ts MUST contain:
  export const storeInfo = { name, tagline, description, about, mission, currency, region, logoUrl, email, phone, address, flatRateShippingCents, freeShippingThresholdCents, ... }
  export function formatPrice(cents: number): string { ... }
  export const categories = [...]
  export const navLinks = [{ href: "/products", label: "Shop" }, { href: "/about", label: "About" }, ...]
  export const footerLinks = [...navLinks, { href: "/faq", label: "FAQ" }, { href: "/privacy-policy", label: "Privacy Policy" }, ...]
  export const heroConfig = { headline, subheadline, ctaText, ctaUrl, ... }
  export const faq = [...]
  export const policies = { shipping, returns, privacy, terms }
  export const shippingMethods = [{ id, name, description, priceCents, estimatedDays, isActive }]
    // CRITICAL: Copy the EXACT shippingMethods array from the get_brand_identity response.
    // Each entry MUST have the same id, name, priceCents, estimatedDays as the DB record.
    // If shippingMethods was empty in get_brand_identity, use 1 default:
    //   { id: "standard", name: "Standard Shipping", description: "5-7 business days", priceCents: 599, estimatedDays: "5-7 days", isActive: true }
    // storeInfo.freeShippingThresholdCents and flatRateShippingCents MUST come from get_brand_identity values, not hardcoded

- src/lib/products.ts MUST contain:
  export interface Product { id, slug, name, description, shortDescription, priceCents, comparePriceCents, categoryId, tags, images, variants, labels, featured, inStock }
  export const products: Product[] = [...]
  export function getProductBySlug, getProductsByCategory, getFeaturedProducts, searchProducts

- Product labels (CRITICAL — NEVER hardcode):
  - NEVER hardcode product.labels (badges, bestseller tags, "New", "Sale") in products.ts
  - Labels are ONLY managed through the Product Management dashboard
  - Generate ALL products with EMPTY labels array: labels: []
  - Labels like "new", "sale", "bestseller", "limited", "discount", "featured" are set by users via the admin UI, NOT in code
  - Never set product.featured, product.inStock, or product.labels to hardcoded values — all controlled by the user

- Categories (CRITICAL — NEVER invent):
  - Categories in data.ts MUST be EXACTLY the categories provided in get_brand_identity response
  - NEVER invent, rename, or create new categories — use ONLY the user's existing categories from the database
  - If the user has categories ["Electronics", "Fashion & Accessories", "Home & Garden", "Health & Fitness"], use those EXACT names
  - Category slugs must be derived from the exact category names (slugified)
  - Category images should be downloaded from search, but the category NAME and ID must match the database exactly
  - If no categories are provided, use the product.category field to derive categories — do NOT invent new ones

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
- layout.tsx MUST import and use RootLayoutClient to wrap {children}. RootLayoutClient is a "use client" component that renders Header, Footer, MobileBottomNav, CartDrawer, Analytics, CookieConsent — and holds the cart open/close state + open-cart event listener.
- layout.tsx structure: <ThemeProvider><AccountModalProvider><RootLayoutClient>{children}</RootLayoutClient></AccountModalProvider></ThemeProvider>
- NEVER render Header, Footer, MobileBottomNav, or CartDrawer directly in layout.tsx — layout.tsx is a server component and cannot have useState/useEffect. All interactive UI must be in RootLayoutClient.
- CRITICAL: RootLayoutClient MUST have useEffect that listens for "open-cart" CustomEvent and sets cart drawer open. Without this, MobileBottomNav cart button does nothing.
- Main content pb-16 md:pb-0 for MobileBottomNav space
- CartDrawer shared between Header cart icon and MobileBottomNav cart button via the same state in RootLayoutClient
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
  Then @theme {} block with brand colors + all shade variants. NEVER omit the @custom-variant line.
- globals.css @layer base MUST include cursor-pointer rule:
    button:not(:disabled), [role="button"]:not(:disabled) { cursor: pointer; }
- NO tailwind.config.ts
- Icons from lucide-react
- Use double-quoted strings for text with apostrophes: "What's New"

### Protected Files (DO NOT write these — builder already created them):
- package.json, tsconfig.json, postcss.config.mjs, next.config.ts
- src/lib/api-client.ts, src/lib/cart.ts
- src/app/api/[...path]/route.ts
- src/components/ThemeProvider.tsx, ThemeToggle.tsx, Analytics.tsx, CookieConsent.tsx
- src/app/checkout/page.tsx (3-step checkout with payment methods — pre-built, DO NOT OVERWRITE)
- src/app/checkout/confirm/page.tsx (Stripe PaymentElement — pre-built, DO NOT OVERWRITE)
- src/app/account/orders/page.tsx (real order list with pending CTA — pre-built, DO NOT OVERWRITE)
- src/app/account/orders/[orderId]/page.tsx (order detail: cancel/address/return gating — pre-built, DO NOT OVERWRITE)
- .env.local

### Tailwind CSS v4 Colors (CRITICAL):
- In globals.css @theme {}, define the base color AND all shade variants using color-mix():
    --color-primary: #xxx;
    --color-primary-50: color-mix(in oklab, #xxx 15%, white);
    --color-primary-100: color-mix(in oklab, #xxx 25%, white);
    --color-primary-200: color-mix(in oklab, #xxx 45%, white);
    --color-primary-300: color-mix(in oklab, #xxx 65%, white);
    --color-primary-400: color-mix(in oklab, #xxx 80%, white);
    --color-primary-500: #xxx;
    --color-primary-600: color-mix(in oklab, #xxx 85%, black);
    --color-primary-700: color-mix(in oklab, #xxx 70%, black);
    --color-primary-800: color-mix(in oklab, #xxx 55%, black);
    --color-primary-900: color-mix(in oklab, #xxx 40%, black);
  Replace #xxx with the actual primary hex color throughout. Do the same for secondary and accent if used.
- In components: use bg-primary-600, text-primary-600, border-primary-500 etc. — these work because shades are defined above
- For subtle tints: bg-primary-50, bg-primary-100 for card backgrounds; bg-primary-600 for primary buttons
- ALWAYS add cursor-pointer to button elements: <button className="... cursor-pointer ...">

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
- ProductCard: image hover zoom, "NEW" / "SALE" / "BESTSELLER" / "LIMITED" / "DISCOUNT" / "FEATURED" badges from product.labels
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
- CRITICAL — MOBILE PADDING: The CartDrawer footer (subtotal + checkout button) MUST have pb-20 md:pb-4 (or md:pb-6) so the checkout button is NOT hidden behind the fixed MobileBottomNav on mobile. Without this padding, the checkout button is unreachable on phones.

**Account Modal (CRITICAL — slide-in drawer from right):**
- DO NOT use a full /account/login page as the entry point
- Instead: clicking Account icon in Header/MobileBottomNav opens an AccountModal component
- AccountModal is a slide-in drawer from RIGHT (like cart), with:
  - Tab switcher: "Sign In" / "Sign Up"
  - Email + Password fields (with show/hide toggle)
  - Google Sign In button above the divider
  - DARK MODE (MANDATORY — all AccountModal elements MUST support dark mode):
    Panel: bg-white dark:bg-gray-900
    Inputs: border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500
    Labels: text-gray-700 dark:text-gray-300
    Secondary text: text-gray-500 dark:text-gray-400
    Google button border: border-gray-200 dark:border-gray-700
    Overlay backdrop: bg-black/50
  - Cloudflare Turnstile (MANDATORY — loaded via CDN, NO npm package):
    Load script in useEffect: script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
    Render widget: window.turnstile.render(divRef.current, { sitekey: "0x4AAAAAAC121vHcMbDFP4WY", theme: "auto", callback: token => setTurnstileToken(token), "expired-callback": () => setTurnstileToken(""), "error-callback": () => setTurnstileToken("") })
    Re-render the widget on tab switch; reset on error.
  - ANTI-SPAM RULE: ALL buttons (Sign In, Create Account, Google) are disabled/blocked until turnstileToken is non-empty — no exceptions
  - isReady = !!turnstileToken; button disabled={loading || !isReady}; Google <a> gets href={isReady ? url : undefined} onClick={(e) => { if (!isReady) e.preventDefault(); }}
- REAL AUTH (MANDATORY — NOT localStorage):
  Extract storeSlug from storeInfo.logoUrl: const STORE_SLUG = storeInfo.logoUrl.match(/\\/stores\\/([^/]+)\\//)?.[1] || "";
  const API_BASE = "https://flowsmartly.com";
  Login: POST to API_BASE + "/api/store/" + STORE_SLUG + "/auth/login" with credentials: "include"
  Register: POST to API_BASE + "/api/store/" + STORE_SLUG + "/auth/register" with credentials: "include"
  Logout: POST to API_BASE + "/api/store/" + STORE_SLUG + "/auth/logout" with credentials: "include"
  Check session: GET API_BASE + "/api/store/" + STORE_SLUG + "/account/profile" with credentials: "include" (on mount)
  Google OAuth: href = API_BASE + "/api/store-auth/google?storeSlug=" + STORE_SLUG + "&callbackUrl=" + encodeURIComponent(window.location.href)
- If user IS logged in: show logged-in view with links to /store/SLUG/account/orders, /addresses, /settings on flowsmartly.com
- AccountModal context provider: wrap in layout.tsx — provides openAccountModal() function
- Header and MobileBottomNav call openAccountModal() if !user, else navigate to account page

**MobileBottomNav (5 items — MANDATORY):**
- Fixed bottom, md:hidden
- Items: Shop (HomeIcon → /products), Filters (SlidersHorizontal → triggers filter drawer), Wishlist (Heart), Cart (ShoppingBag with badge), My Account (User)
- Active state: primary color icon + label
- "Filters" triggers filterDrawerOpen state (shared via context or prop)
- "Cart" dispatches CustomEvent("toggle-cart") — TOGGLE behavior, not just open
- "My Account" dispatches CustomEvent("toggle-account") — TOGGLE behavior, not just open
- CRITICAL — TOGGLE + MUTUAL EXCLUSION: Cart and Account buttons MUST be toggles (click opens, click again closes). When one opens, the other MUST close first. Implementation:
  - MobileBottomNav dispatches "toggle-cart" / "toggle-account" CustomEvents
  - RootLayoutClient listens for "toggle-cart": toggles cart state, dispatches "close-account" when opening
  - AccountModalProvider listens for "toggle-account": toggles account state, dispatches "close-cart" when opening
  - Both also listen for "open-cart"/"close-cart" and "open-account"/"close-account" for programmatic control (e.g. Header cart icon uses "open-cart")
- CRITICAL — EVENT-BASED COMMUNICATION: MobileBottomNav MUST use window.dispatchEvent(new CustomEvent(...)) — NOT useCart() or direct state. MobileBottomNav renders OUTSIDE provider wrappers, so context hooks return no-ops.
- CRITICAL — CartDrawer MUST be rendered inside RootLayoutClient (inside providers) so the drawer is available on ALL pages including account pages. Never omit CartDrawer from the layout.

### Account Pages (CRITICAL — mobile-first):
- NEVER use HTML <table> elements for order lists — tables break on mobile screens
- ALWAYS use stacked card layout for orders: each order is a tappable/clickable card with order number, status badge, date, and total
- Example pattern: rounded-lg border p-4 cards in a space-y-3 container
- Account dashboard recent orders + full orders list page MUST both use cards, not tables
- Main content area MUST have pb-16 md:pb-0 to avoid content hidden behind the fixed MobileBottomNav

### Product Detail Page (MANDATORY features):
- Wishlist heart button on product image (top-right, always visible)
- Wishlist heart button next to Add to Cart button
- Star rating display with review count and sales count (fetched from /api/store/{slug}/products/{productSlug}/reviews)
- Customer reviews section with:
  - Write a Review button (opens form)
  - Review form: star rating selector, title, comment, submit
  - Reviews list: avatar, name, verified badge, stars, date, title, comment
- Trust badges (Quality Assured, Free Shipping, 30-Day Returns) — shipping threshold from storeInfo.freeShippingThresholdCents (NOT hardcoded)
- NEVER hardcode "Free Shipping $50+" — read from storeInfo or data.ts
- Labels/badges: use product.labels (or product.badges for compatibility), NOT product.badges only

### ProductCard Wishlist Heart (MANDATORY):
- ProductCard MUST have a Heart icon button at top-right of the product image
- Heart is ALWAYS visible (not hidden behind hover) — works on mobile and desktop
- Uses absolute positioning: top-3 right-3 z-10
- When not wishlisted: semi-transparent white bg, gray icon, hover turns red
- When wishlisted: red bg, white filled heart icon
- On click: if not logged in → opens AccountModal; if logged in → toggles wishlist via API
- Wishlist API: POST/DELETE /api/store/{slug}/account/wishlist with { productId }
- Global state via window.__storeWishlist array + "wishlist-updated" custom event
- Add to Cart button appears on hover (desktop only) at bottom center

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
9b. ✅ ALL components use dark: Tailwind variants — bg-white components have dark:bg-gray-900, all inputs have dark:bg-gray-800 dark:bg-gray-700 dark:text-white, all text has dark: counterparts
14. ✅ ProductCard has always-visible Heart wishlist button at top-right of image
15. ✅ ProductDetail has wishlist heart, star ratings, reviews section, dynamic shipping threshold
16. ✅ NO hardcoded "Free Shipping $50+" — uses storeInfo.freeShippingThresholdCents
17. ✅ Checkout pre-fills customer name/email/phone from window.__storeCustomer
17b. ✅ Checkout 3-step flow: Info → Shipping → Payment (Stripe confirm at /checkout/confirm — pre-built, DO NOT write)
17c. ✅ Checkout submit redirects to /checkout/confirm with clientSecret + orderId + amount (does NOT clear cart before redirect)
18. ✅ All internal links use Next.js <Link> — NEVER <a href="/products"> (goes to main app)
10. ✅ Footer sticks to bottom (min-h-screen flex flex-col on root layout, flex-1 on main)
11. ✅ All internal links use Next.js <Link> component — no <a href="..."> for internal pages
12. ✅ CartDrawer slides from right, AccountModal slides from right, FilterDrawer slides from left
13. ✅ Turnstile anti-spam in AccountModal, login/page.tsx, register/page.tsx — ALL submit + social buttons disabled until Turnstile validates`;


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
        labels: p.labels || [],
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
        shippingMethods: ctx.shippingMethods,
        freeShippingThresholdCents: ctx.freeShippingThresholdCents,
        flatRateShippingCents: ctx.flatRateShippingCents,
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
        "src/app/checkout/confirm/page.tsx",
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

  // Fetch real shipping config from DB
  const [storeRecord, dbShippingMethods] = await Promise.all([
    prisma.store.findUnique({
      where: { id: storeId },
      select: { freeShippingThresholdCents: true, flatRateShippingCents: true },
    }),
    prisma.storeShippingMethod.findMany({
      where: { storeId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, description: true, priceCents: true, estimatedDays: true, isActive: true },
    }),
  ]);

  const ctx: StoreAgentContext = {
    storeId,
    storeSlug,
    userId,
    storeInfo,
    products,
    categories,
    shippingMethods: dbShippingMethods,
    freeShippingThresholdCents: storeRecord?.freeShippingThresholdCents ?? 5000,
    flatRateShippingCents: storeRecord?.flatRateShippingCents ?? 599,
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
