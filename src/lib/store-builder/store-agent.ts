/**
 * Store Builder Agent V2 — Claude writes real Next.js e-commerce files
 *
 * Claude gets tools to read reference store components, write .tsx files,
 * download images, search product images, build the store, and deploy it.
 *
 * Mirrors src/lib/website/website-agent.ts but for e-commerce stores.
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db/client";
import { getPresignedUrl } from "@/lib/utils/s3-client";
import { readReferenceComponent, getAvailableReferences } from "./reference-reader";
import {
  initStoreDir, writeStoreFile, buildStore, deployStore, getStoreDir,
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

export interface StoreAgentContext {
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

export interface AgentProgress {
  step: string;
  detail?: string;
  toolCalls: number;
  done: boolean;
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
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
    description: "Run npm install and next build to compile the store. Returns build output or errors. If errors, fix the files and rebuild.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "finish",
    description: "Deploy the built store and finalize. Call this LAST after a successful build.",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: { type: "string", description: "Summary of what was built" },
      },
      required: ["summary"],
    },
  },
];

// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a professional e-commerce store developer. You build REAL, production-quality online stores by writing actual React component code with Framer Motion animations, Tailwind CSS, dark mode, and proper e-commerce UX.

## YOUR PROCESS (follow this order strictly):

1. Call get_brand_identity to learn about the business, products, and brand
2. Call read_reference for "Data" to see the reference data structure, then write src/lib/data.ts
3. Call read_reference for "Products" to see the product structure, then write src/lib/products.ts
4. Call read_reference for "Cart" to see the cart logic, then write src/lib/cart.ts
5. Download the brand logo via download_image (category: "brand", filename: "logo") — MANDATORY
6. For EVERY product — download at least 1 image:
   a. If product has image URLs provided, call download_image for each
   b. If NO images provided, call search_product_images with the product name, then download_image for the best result
   c. NEVER skip image download — every product MUST have at least 1 real image
   d. Also search and download 1 image per category (for category showcase cards)
   e. Search and download 1 hero background image — search for the store's INDUSTRY (e.g. "electronics store", "fashion boutique") NOT generic "store" or "shopping"
7. Call read_reference for "GlobalCSS" then write src/app/globals.css with the brand's colors
8. Call read_reference for "Layout" then write src/app/layout.tsx
9. For each component (Header, Hero, CategoryShowcase, FeaturedProducts, ProductCard, ProductGrid, CartDrawer, MobileBottomNav, Footer, Newsletter, AboutSection, FAQ):
   a. Call read_reference to see the reference component
   b. Write an ADAPTED version for THIS store — same quality, same animations, different content/branding
10. Write pages: src/app/page.tsx (home), src/app/products/page.tsx, src/app/products/[slug]/page.tsx, src/app/category/[slug]/page.tsx, src/app/about/page.tsx, src/app/faq/page.tsx
11. Write branded policy pages using storeInfo from data.ts:
    - src/app/shipping-policy/page.tsx
    - src/app/return-policy/page.tsx
    - src/app/privacy-policy/page.tsx
    - src/app/terms/page.tsx
12. Write src/app/not-found.tsx (branded 404) and src/app/error.tsx (error boundary)
13. SEO verification (same as website builder — metadata, og, robots.txt, sitemap.ts, JSON-LD Product schema)
14. Call build_store to build
15. If errors, fix the files and rebuild
16. Call finish to deploy

## CRITICAL RULES:

### Quality Standard:
- Every component MUST use Framer Motion (whileInView, AnimatePresence, motion.div)
- Every component MUST have dark: Tailwind variants
- Import data from '@/lib/data' and products from '@/lib/products' — NEVER hardcode content
- Follow the reference patterns for animation timings, easing, stagger delays

### E-Commerce UX:
- Product cards MUST show: image, name, price (formatted), compare price (strikethrough), badges, add-to-cart button
- Cart uses localStorage via src/lib/cart.ts — checkout redirects to the main FlowSmartly app
- Product detail pages: image gallery, variant selector, quantity picker, add-to-cart, related products, trust badges
- Category navigation with product count badges
- Client-side search (filter products array by name/description/tags)
- Currency formatting via formatPrice() helper in data.ts

### Data Structure (CRITICAL):
- src/lib/data.ts MUST contain:
  export const STORE_BASE = "{storeBasePath}";
  export function storeUrl(path: string): string { return STORE_BASE + path; }
  export const storeInfo = { name, tagline, description, about, mission, currency, region, logoUrl, ... }
  export function formatPrice(cents: number, currency?: string): string { ... }
  export const categories = [...];
  export const navLinks = [...];
  export const footerLinks = [...]; // MUST include ALL links, NEVER .slice()
  export const heroConfig = { headline, subheadline, ctaText, ctaUrl, ... }
  export const faq = [...]
  export const policies = { shipping, returns, privacy, terms }

- src/lib/products.ts MUST contain:
  export interface Product { id, slug, name, description, shortDescription, priceCents, comparePriceCents, categoryId, tags, images, variants, badges, featured, inStock }
  export const products: Product[] = [...]
  export function getProductBySlug(slug): Product | undefined { ... }
  export function getProductsByCategory(categoryId): Product[] { ... }
  export function getFeaturedProducts(): Product[] { ... }
  export function searchProducts(query): Product[] { ... }

- src/lib/cart.ts: localStorage-based cart with addToCart, removeFromCart, updateQuantity, getCartTotal, redirectToCheckout

### Internal Links (CRITICAL):
- ALL internal links MUST use storeUrl() — NEVER bare "/products" or "/about"
- NEVER use href="#" — use storeUrl("/#section") or storeUrl("/products")
- NEVER use Next.js <Link> component — use <a> tags for static export
- External links (https://, mailto:, tel:) stay unchanged

### Logo & Favicon (MANDATORY):
- STEP 1: Call get_brand_identity — it includes "logoUrl"
- STEP 2: MUST call download_image with logoUrl (category: "brand", filename: "logo") IMMEDIATELY
- STEP 3: Use downloaded path in Header AND Footer
- NEVER create text/SVG placeholder logos
- Logo sizing: Header h-12 sm:h-14 md:h-16 max-w-[200px] object-contain
- Footer logo: h-14 md:h-16 object-contain
- Favicon in layout.tsx: MUST use exact downloaded file extension

### Customer Account Integration:
- storeInfo includes accountUrl — the URL to the customer login/register page
- Header side drawer MUST include a "Sign In / Register" link pointing to storeInfo.accountUrl
- MobileBottomNav MUST include an Account button pointing to storeInfo.accountUrl
- These are external links (target="_blank") because they go to the main FlowSmartly app SSR

### Layout Integration (MANDATORY):
- layout.tsx MUST import and render: Header, Footer, MobileBottomNav, CartDrawer, Analytics, CookieConsent
- MobileBottomNav receives onCartOpen prop to open the cart drawer
- Main content wrapper MUST have pb-16 md:pb-0 so content isn't hidden behind MobileBottomNav on mobile
- CartDrawer is shared — Header cart icon AND MobileBottomNav cart button both open it via onCartOpen

### Image Paths (CRITICAL — read carefully):
- The download_image tool returns BARE paths like "/images/products/lamp.jpg"
- Use these paths DIRECTLY in src="" attributes: src="/images/products/lamp.jpg"
- Do NOT wrap image paths in storeUrl() — that causes double-prefixing
- The pre-build system (syncBasePath) automatically adds the basePath prefix to all /images/ paths
- storeUrl() is ONLY for navigation links (href), NEVER for image src
- In data.ts: logoUrl: "/images/brand/logo.jpg" (NOT storeUrl("/images/..."))
- In products.ts: url: "/images/products/lamp.jpg" (NOT storeUrl("/images/..."))

### Footer (CRITICAL — legal requirement):
- Footer MUST render ALL footerLinks — NEVER use .slice() to limit
- MUST include: Shipping Policy, Return Policy, Privacy Policy, Terms & Conditions
- These are legally required for e-commerce stores

### Navigation:
- navLinks: header navigation (Home, Shop, About, FAQ)
- footerLinks: ALL pages including legal — spread navLinks + add policy pages
- EVERY page MUST appear in either navLinks or footerLinks

### Checkout Flow:
- Cart uses localStorage (client-side only)
- "Checkout" button calls redirectToCheckout(storeSlug) from cart.ts
- This redirects to the main FlowSmartly app: {apiBaseUrl}/store/{slug}/checkout?cart={base64}
- The SSR checkout page handles payment processing

### Technical:
- Tailwind CSS v4: @import "tailwindcss" (NOT @tailwind directives)
- Dark mode: @custom-variant dark in globals.css + dark: prefix
- @theme {} block in globals.css for brand colors
- NO tailwind.config.ts — CSS-based config only
- Components are "use client" when using hooks/motion
- Icons from lucide-react
- Images use <img> tags (static export)
- CRITICAL: Dynamic [slug] routes with output:'export' need generateStaticParams() BUT it CANNOT be in a "use client" file
- PATTERN FOR DYNAMIC ROUTES: Split into TWO files:
  1. page.tsx (SERVER component, NO "use client"): exports generateStaticParams() + renders the client component
  2. ProductDetailClient.tsx or CategoryClient.tsx ("use client"): all the interactive UI with hooks/state
- Example page.tsx: import products from data, export generateStaticParams returning slugs, default export renders <ProductDetailClient params={params} />
- Example ProductDetailClient.tsx: "use client", useState, motion, all the UI
- The reference store shows this exact pattern — read it before writing dynamic route pages

### String Escaping in data.ts (CRITICAL):
- Use double-quoted strings for text with apostrophes: "What's New" NOT 'What's New'
- This prevents syntax errors that break the build

### Import Safety (CRITICAL):
- Write files in dependency order: data.ts → products.ts → cart.ts → globals.css → layout.tsx → components → pages
- NEVER import a file you haven't written yet
- DO NOT write: package.json, tsconfig.json, postcss.config.mjs, next.config.ts, ThemeProvider.tsx, ThemeToggle.tsx, Analytics.tsx, CookieConsent.tsx

### Mobile UX (CRITICAL — most users access on phone):

#### Mobile Menu — SIDE DRAWER (NOT dropdown):
- Header hamburger button opens a SIDE DRAWER that slides from the LEFT
- Drawer must: have logo at top, navigation links with chevrons, category links, contact info at bottom
- Drawer uses AnimatePresence + motion.div with x:"-100%" → x:0 transition
- The hamburger ICON itself must use simple conditional: {menuOpen ? nothing : <Menu />} — the X close button is INSIDE the drawer
- Drawer must lock body scroll when open (document.body.style.overflow = "hidden")
- NEVER use a dropdown menu from the top — always side drawer on mobile

#### Mobile Bottom Nav (MANDATORY):
- Write src/components/MobileBottomNav.tsx — fixed bottom bar, md:hidden
- 4 buttons: Shop (Home icon), Search, Cart (ShoppingBag icon with red badge), Account (User icon)
- Cart badge: use getCart()/getCartCount() from '@/lib/cart' + listen to 'cart-updated' event
- Cart button opens CartDrawer (pass onCartOpen prop)
- Account links to storeInfo.accountUrl (external URL to main app)
- Import and render in layout.tsx AFTER Footer, BEFORE </body>
- Add pb-16 to the page wrapper on mobile so content isn't hidden behind the bar
- Use safe-area-inset-bottom for iPhone notch: pb-[env(safe-area-inset-bottom)]

#### Mobile-First Design:
- ALL components must be mobile-first (base styles for mobile, sm:/md:/lg: for larger)
- Product grids: 2 columns on mobile (grid-cols-2), 3 on md, 4 on lg
- Hero: full-width on mobile with readable text (text-3xl not text-6xl)
- Logo in header: h-10 on mobile (NOT h-16/h-20 which is too large on phone)
- Logo in footer: h-12 on mobile
- Touch targets: minimum 44px tap area for all buttons/links on mobile`;

// ─── Tool Execution ──────────────────────────────────────────────────────────

function safeParseJSON(val: string | null | undefined): unknown {
  if (!val) return null;
  try { return JSON.parse(val); } catch { return val; }
}

async function executeTool(name: string, input: Record<string, unknown>, ctx: StoreAgentContext): Promise<string> {
  switch (name) {
    case "get_brand_identity": {
      ctx.onProgress?.("Reading brand identity...");
      const brandKit = await prisma.brandKit.findFirst({
        where: { userId: ctx.userId },
        orderBy: { isDefault: "desc" },
      });

      // Check if the user has a published website for cross-linking
      const website = await prisma.website.findFirst({
        where: { userId: ctx.userId, status: "PUBLISHED", deletedAt: null },
        select: { slug: true, customDomain: true },
      });
      const websiteUrl = website
        ? (website.customDomain ? `https://${website.customDomain}` : `${process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com"}/sites/${website.slug}`)
        : "";

      // Build product list for the agent
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
        // Store info
        storeName: ctx.storeInfo.name,
        industry: ctx.storeInfo.industry,
        niche: ctx.storeInfo.niche,
        targetAudience: ctx.storeInfo.targetAudience,
        region: ctx.storeInfo.region,
        currency: ctx.storeInfo.currency,
        // Products from onboarding
        products: productList,
        categories: ctx.categories,
        productCount: productList.length,
        // Site config
        storeId: ctx.storeId,
        storeBasePath: `/stores/${ctx.storeSlug}`,
        storeSlug: ctx.storeSlug,
        apiBaseUrl: process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com",
        accountUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com"}/store/${ctx.storeSlug}/account`,
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

      const protectedFiles = [
        "package.json", "tsconfig.json", "postcss.config.mjs", "next.config.ts",
        "src/components/ThemeProvider.tsx", "src/components/ThemeToggle.tsx",
        "src/components/Analytics.tsx", "src/components/CookieConsent.tsx",
      ];
      if (protectedFiles.includes(path)) {
        return JSON.stringify({ skipped: true, reason: `${path} is a template file — already provided` });
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
        // Return the bare path (e.g. "/images/products/lamp.jpg") — NOT prefixed with basePath.
        // The agent should use this path directly in src="" attributes.
        // The pre-build validator syncBasePath() will add the basePath prefix automatically.
        return JSON.stringify({
          success: true,
          localPath: localPath,
          usage: `Use as: src="${localPath}" — do NOT wrap in storeUrl(). The build system auto-prefixes image paths.`,
        });
      } catch (err: any) {
        return JSON.stringify({ error: err.message, localPath: `/images/${category}/placeholder.jpg` });
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
      ctx.onProgress?.("Building store...");
      const result = await buildStore(ctx.storeId);
      if (result.success) {
        return JSON.stringify({ success: true, message: "Build succeeded" });
      }
      return JSON.stringify({ success: false, error: result.error?.substring(0, 3000) });
    }

    case "finish": {
      ctx.onProgress?.("Deploying store...");
      const deployResult = await deployStore(ctx.storeId, ctx.storeSlug);
      if (!deployResult.success) {
        return JSON.stringify({ error: deployResult.error });
      }

      // Sync products from the agent's products.ts back to the database
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

// ─── Agent Loop ──────────────────────────────────────────────────────────────

export async function runStoreAgent(
  storeId: string,
  storeSlug: string,
  userId: string,
  storeInfo: StoreAgentContext["storeInfo"],
  products: ProductInput[],
  categories: string[],
  onProgress?: (progress: AgentProgress) => void
): Promise<{ success: boolean; error?: string }> {
  // Initialize store directory with template files
  const siteDir = initStoreDir(storeId, storeSlug);

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
        generatorVersion: "v2",
      },
    });

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`[StoreAgent] Iteration ${iteration + 1}, messages: ${messages.length}, tools: ${toolCalls}`);

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) {
        console.log("[StoreAgent] No more tool calls, done");
        onProgress?.({ step: "Store ready!", toolCalls, done: true });
        return { success: true };
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        toolCalls++;
        console.log(
          `[StoreAgent] Tool #${toolCalls}: ${toolUse.name}${
            toolUse.name === "write_file" ? ` (${(toolUse.input as any).path})` : ""
          }`
        );

        try {
          const result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>, ctx);

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
          console.error(`[StoreAgent] Tool ${toolUse.name} failed:`, err.message);
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

    console.warn("[StoreAgent] Max iterations reached");
    onProgress?.({ step: "Store ready!", toolCalls, done: true });
    return { success: true };
  } catch (err: any) {
    console.error("[StoreAgent] Fatal error:", err.message);
    await prisma.store.update({
      where: { id: storeId },
      data: { buildStatus: "error", lastBuildError: err.message },
    });
    return { success: false, error: err.message };
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
- Use Next.js <Image> component for optimized images
- NO basePath, NO storeUrl() — all links are root-relative ("/products", "/checkout", "/account")
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
- Logo sizing: Header h-12 sm:h-14 md:h-16, Footer h-14 md:h-16, max-w-[200px] object-contain
- Favicon: use exact downloaded file extension

### Footer (legal requirement):
- MUST render ALL footerLinks — NEVER .slice()
- MUST include: Shipping Policy, Return Policy, Privacy Policy, Terms
- These are legally required for e-commerce stores

### Layout Integration:
- layout.tsx imports: Header, Footer, MobileBottomNav, CartDrawer, Analytics, CookieConsent
- Main content pb-16 md:pb-0 for MobileBottomNav space
- CartDrawer shared between Header cart icon and MobileBottomNav cart button

### Mobile UX:
- Header hamburger → side drawer from LEFT (motion.div x:"-100%" → x:0)
- MobileBottomNav (fixed bottom, md:hidden): Shop, Search, Cart (with badge), Account
- Cart badge from localStorage + 'cart-updated' event listener
- Account button links to /account (internal, NOT external)
- 2-col product grids on mobile, 3 on md, 4 on lg
- Touch targets: min 44px

### Technical:
- Tailwind CSS v4: @import "tailwindcss", @theme {}, @custom-variant dark
- NO tailwind.config.ts
- Icons from lucide-react
- Use double-quoted strings for text with apostrophes: "What's New"

### Protected Files (DO NOT write these — builder already created them):
- package.json, tsconfig.json, postcss.config.mjs, next.config.ts
- src/lib/api-client.ts, src/lib/cart.ts
- src/app/api/[...path]/route.ts
- src/components/ThemeProvider.tsx, ThemeToggle.tsx, Analytics.tsx, CookieConsent.tsx
- .env.local

### Import Order:
- Write files in dependency order: data.ts → products.ts → globals.css → layout.tsx → components → pages → checkout → account`;

// ─── V3 Tool Definitions ─────────────────────────────────────────────────────

const V3_TOOLS: Anthropic.Tool[] = [
  TOOLS[0], // get_brand_identity
  TOOLS[1], // read_reference
  TOOLS[2], // write_file
  TOOLS[3], // download_image
  TOOLS[4], // search_product_images
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

    case "read_reference":
      return executeTool("read_reference", input, ctx);

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
        // V3: paths are root-relative (no basePath needed)
        return JSON.stringify({
          success: true,
          localPath: localPath,
          usage: `Use as: src="${localPath}" in <Image> or <img> tags.`,
        });
      } catch (err: any) {
        return JSON.stringify({ error: err.message, localPath: `/images/${category}/placeholder.jpg` });
      }
    }

    case "search_product_images":
      return executeTool("search_product_images", input, ctx);

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
