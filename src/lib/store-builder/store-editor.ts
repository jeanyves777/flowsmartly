import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { prisma } from "@/lib/db/client";
import { getStoreDir, buildStoreV3, deployStoreV3 } from "@/lib/store-builder/store-site-builder";
import { downloadImageToStoreDir } from "@/lib/store-builder/image-search";
import { runSectionUpdateAgent } from "@/lib/ai/section-update-agent";
import { isValidCurrency } from "@/lib/store/currency";

/**
 * Shared store-editing engine. The editor API routes (update-data, site-data,
 * update-section, rebuild) AND the flow-agent's edit_store / get_store_content
 * tools call THESE functions — one implementation of "write the storefront
 * content into the generated files", "parse it back", "AI-redesign a section",
 * and "build + deploy". Auth/credit gating stays with each caller. Mirrors the
 * website's site-editor.ts (the store has its own data model + V3 builder).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export interface StoreRef {
  id: string;
  slug: string;
  generatedPath: string | null;
  siteData: string | null;
}

/** The structured storefront content the editor + agent exchange. All optional. */
export interface StoreDataPatch {
  storeInfo?: Record<string, Any>;
  heroConfig?: Record<string, Any>;
  navLinks?: Array<{ href: string; label: string }>;
  footerLinks?: Array<{ href: string; label: string }>;
  faq?: Array<{ question: string; answer: string }>;
  products?: Array<Record<string, Any>>;
  categories?: Array<{ id: string; name: string; slug: string; description: string; image: string }>;
}

/* ── helpers (ported from the routes) ─────────────────────────────────── */

function escapeStr(str: string): string {
  return (str || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

// Replace a `field: 'value' | "value"` in TS source, emitting double-quoted output.
function replaceField(source: string, field: string, value: string): string {
  const escaped = escapeStr(value);
  const regex = new RegExp(`(${field}:\\s*)(?:'(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*")`);
  return source.replace(regex, `$1"${escaped}"`);
}

async function localizeImageUrl(url: string, storeDir: string, storeSlug: string, category: "brand" | "hero" | "categories" | "products", filename: string): Promise<string> {
  if (!url) return url;
  if (url.startsWith(`/stores/${storeSlug}/`) || url.startsWith("/images/")) return url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return url;
  try {
    const localPath = await downloadImageToStoreDir(url, storeDir, category, filename);
    return `/stores/${storeSlug}${localPath}`;
  } catch (err: Any) {
    console.error(`[StoreUpdateData] Failed to localize ${url.substring(0, 100)}:`, err?.message);
    return url;
  }
}

function updateProductsFile(productsPath: string, products: Array<Record<string, Any>>): void {
  let content = readFileSync(productsPath, "utf-8");
  for (const product of products) {
    if (!product.slug && !product.id) continue;
    const identifier = product.slug ? `slug:\\s*["']${product.slug}["']` : `id:\\s*["']${product.id}["']`;
    const productBlock = content.match(new RegExp(`\\{[\\s\\S]*?${identifier}[\\s\\S]*?\\}`, "m"));
    if (!productBlock) continue;
    let block = productBlock[0];
    const original = block;
    if (product.name !== undefined) block = replaceField(block, "name", product.name);
    if (product.description !== undefined) block = replaceField(block, "description", product.description);
    if (product.shortDescription !== undefined) block = replaceField(block, "shortDescription", product.shortDescription);
    if (product.priceCents !== undefined) block = block.replace(/priceCents:\s*\d+/, `priceCents: ${product.priceCents}`);
    if (block !== original) content = content.replace(original, block);
  }
  writeFileSync(productsPath, content, "utf-8");
}

async function rewriteSparseComponent(filePath: string, currentCode: string, pageLabel: string, storeInfo: Record<string, Any>, basePath: string): Promise<void> {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8000,
      system: `You are a Next.js expert. Rewrite this React component to have real, professional content.
Rules:
- Keep "use client" if present
- Keep the same export default function name
- Use Tailwind CSS v4 with dark: variants
- Use storeUrl() from '@/lib/data' for internal links (basePath: ${basePath})
- NEVER use bare "/about" links — always storeUrl("/about")
- Use <img> not next/image, <a> not next/link
- Make it visually appealing with proper spacing and sections
- Content must be relevant to the store, not lorem ipsum`,
      messages: [{
        role: "user",
        content: `Rewrite this "${pageLabel}" page component with real, detailed content for a store called "${storeInfo.name || ""}".
Store context: ${storeInfo.tagline || ""} — ${storeInfo.description || ""}

Current sparse code:
\`\`\`tsx
${currentCode}
\`\`\`

Return ONLY the complete rewritten component code, no explanation.`,
      }],
    });
    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const codeMatch = text.match(/```(?:tsx?|jsx?)\n([\s\S]*?)```/);
    const newCode = codeMatch ? codeMatch[1].trim() : text.trim();
    if (newCode && newCode.length > 100) {
      writeFileSync(filePath, newCode, "utf-8");
      console.log(`[StoreUpdateData] Enhanced "${pageLabel}" page (${newCode.split("\n").length} lines)`);
    }
  } catch (err: Any) {
    console.error(`[StoreUpdateData] Failed to enhance "${pageLabel}":`, err?.message);
  }
}

/* ── write pipeline ───────────────────────────────────────────────────── */

/** Write a (partial) storefront-content patch into the generated store files. */
export async function applyStoreDataUpdate(params: { store: StoreRef; patch: StoreDataPatch }): Promise<{ ok: boolean; error?: string }> {
  const { store, patch } = params;
  const storeDir = store.generatedPath || getStoreDir(store.id);
  const dataPath = join(storeDir, "src", "lib", "data.ts");
  if (!existsSync(dataPath)) return { ok: false, error: "Store data files not found" };

  const { storeInfo, heroConfig, navLinks, footerLinks, faq, products, categories } = patch;
  let data = readFileSync(dataPath, "utf-8");
  const storeBasePath = `/stores/${store.slug}`;
  // Store-column updates to flush at the end (currency/region are authoritative in
  // the DB — products/orders/checkout read them there, not from data.ts).
  const dbUpdate: Record<string, unknown> = {};

  if (storeInfo) {
    for (const field of ["name", "tagline", "description", "about", "mission", "address", "ctaText", "ctaUrl"]) {
      if (storeInfo[field] !== undefined) data = replaceField(data, field, storeInfo[field]);
    }
    // Currency & region: write into the storefront data AND the authoritative Store
    // columns. These were shown in the studio but silently dropped on Save.
    if (storeInfo.currency !== undefined) {
      const cur = String(storeInfo.currency).toUpperCase();
      if (isValidCurrency(cur)) {
        data = replaceField(data, "currency", cur);
        dbUpdate.currency = cur;
      }
    }
    if (storeInfo.region !== undefined) {
      const region = String(storeInfo.region);
      data = replaceField(data, "region", region);
      dbUpdate.region = region;
    }
    const imageFieldMap: Record<string, "brand" | "hero"> = { logoUrl: "brand", bannerUrl: "hero", favicon: "brand" };
    let resolvedBannerUrl: string | null = null;
    for (const field of ["logoUrl", "bannerUrl", "favicon"]) {
      if (storeInfo[field] !== undefined) {
        let url = storeInfo[field] as string;
        if (url.startsWith("/images/")) url = storeBasePath + url;
        else if (url.startsWith("http://") || url.startsWith("https://")) {
          const category = imageFieldMap[field];
          const filename = field === "logoUrl" ? "logo" : field === "favicon" ? "favicon" : "banner";
          url = await localizeImageUrl(url, storeDir, store.slug, category, filename);
        }
        data = replaceField(data, field, url);
        if (field === "bannerUrl") resolvedBannerUrl = url;
      }
    }
    // Hero reads heroConfig.backgroundImage — keep it in sync with the banner.
    if (resolvedBannerUrl) {
      const heroMatch = data.match(/heroConfig[^=]*=\s*\{[\s\S]*?\};/);
      if (heroMatch) {
        const original = heroMatch[0];
        const updated = replaceField(original, "backgroundImage", resolvedBannerUrl);
        if (updated === original && !original.includes("backgroundImage")) {
          const injected = original.replace(/(\};?\s*)$/, `  backgroundImage: "${escapeStr(resolvedBannerUrl)}",\n$1`);
          data = data.replace(original, injected);
        } else {
          data = data.replace(original, updated);
        }
      }
    }
    if (storeInfo.phones) {
      data = data.replace(/phones:\s*\[.*?\]/s, `phones: [${storeInfo.phones.map((p: string) => `"${escapeStr(p)}"`).join(", ")}]`);
    }
    if (storeInfo.emails) {
      data = data.replace(/emails:\s*\[.*?\]/s, `emails: [${storeInfo.emails.map((e: string) => `"${escapeStr(e)}"`).join(", ")}]`);
    }
  }

  if (heroConfig) {
    for (const field of ["headline", "subheadline", "ctaText", "ctaUrl", "style"]) {
      if (heroConfig[field] !== undefined) {
        const heroBlock = data.match(/heroConfig\s*=\s*\{([\s\S]*?)\};/);
        if (heroBlock) data = data.replace(heroBlock[1], replaceField(heroBlock[1], field, heroConfig[field]));
      }
    }
    if (Array.isArray(heroConfig.slides)) {
      const cleanSlide = (u: string): string => (!u ? "" : (u.includes("X-Amz-") || u.includes("?X-Amz")) ? u.split("?")[0] : u);
      const slidesJs = heroConfig.slides.map((u: string) => `    "${escapeStr(cleanSlide(u))}"`).join(",\n");
      const slidesBlock = `slides: [\n${slidesJs}${heroConfig.slides.length ? "\n  " : ""}] as string[]`;
      const heroBlock = data.match(/heroConfig\s*=\s*\{([\s\S]*?)\};/);
      if (heroBlock) {
        const heroBody = heroBlock[1];
        const hasSlides = /slides\s*:\s*\[[\s\S]*?\]/.test(heroBody);
        const newBody = hasSlides
          ? heroBody.replace(/slides\s*:\s*\[[\s\S]*?\](\s*as\s+string\[\])?/, slidesBlock)
          : `${heroBody.replace(/[\s,]+$/, "")},\n  ${slidesBlock},\n`;
        data = data.replace(heroBody, newBody);
      }
    }
  }

  if (navLinks && Array.isArray(navLinks)) {
    const navStr = navLinks.map((l) => `  { href: "${escapeStr(l.href)}", label: "${escapeStr(l.label)}" }`).join(",\n");
    data = data.replace(/export const navLinks[^=]*=\s*\[[\s\S]*?\];/, `export const navLinks = [\n${navStr},\n];`);
  }
  if (footerLinks && Array.isArray(footerLinks)) {
    const footerStr = footerLinks.map((l) => `  { href: "${escapeStr(l.href)}", label: "${escapeStr(l.label)}" }`).join(",\n");
    data = data.replace(/export const footerLinks[^=]*=\s*\[[\s\S]*?\];/, `export const footerLinks = [\n  ...navLinks,\n${footerStr},\n];`);
  }
  if (faq && Array.isArray(faq)) {
    const faqStr = faq.map((item) => `  {\n    question: "${escapeStr(item.question)}",\n    answer: "${escapeStr(item.answer)}",\n  }`).join(",\n");
    data = data.replace(/export const faq[^=]*=\s*\[[\s\S]*?\];/, `export const faq = [\n${faqStr},\n];`);
  }

  writeFileSync(dataPath, data, "utf-8");

  if (categories && Array.isArray(categories)) {
    for (const cat of categories) {
      if (cat.image) {
        if (cat.image.startsWith("/images/")) cat.image = storeBasePath + cat.image;
        else if (cat.image.startsWith("http://") || cat.image.startsWith("https://")) {
          cat.image = await localizeImageUrl(cat.image, storeDir, store.slug, "categories", cat.slug || cat.id);
        }
      }
    }
    for (const cat of categories) {
      if (!cat.id) continue;
      await prisma.productCategory.update({
        where: { id: cat.id },
        data: { name: cat.name, description: cat.description || null, imageUrl: cat.image || null },
      }).catch(() => {});
    }
    data = readFileSync(dataPath, "utf-8");
    const catStr = categories.map((c) => `  { id: "${escapeStr(c.id)}", name: "${escapeStr(c.name)}", slug: "${escapeStr(c.slug)}", description: "${escapeStr(c.description || "")}", image: "${escapeStr(c.image || "")}" }`).join(",\n");
    const updatedData = data.replace(/export const categories[^=]*=\s*\[[\s\S]*?\];/, `export const categories = [\n${catStr},\n];`);
    if (updatedData !== data) writeFileSync(dataPath, updatedData, "utf-8");
  }

  if (products && Array.isArray(products)) {
    const productsPath = join(storeDir, "src", "lib", "products.ts");
    if (existsSync(productsPath)) updateProductsFile(productsPath, products);
  }

  // Auto-enhance sparse pages newly added to navigation.
  if (navLinks && Array.isArray(navLinks)) {
    try {
      const prevSiteData = store.siteData ? (() => { try { return JSON.parse(store.siteData as string); } catch { return {}; } })() : {};
      const prevNavHrefs = new Set((prevSiteData.navLinks || []).map((l: Any) => (l.href || "").replace(/^\/stores\/[^/]+/, "")));
      const newPages = navLinks
        .map((l) => ({ href: (l.href || "").replace(/^\/stores\/[^/]+/, ""), label: l.label || "" }))
        .filter((l) => l.href.startsWith("/") && l.href !== "/" && !prevNavHrefs.has(l.href));
      for (const page of newPages) {
        const slug = page.href.replace(/^\//, "");
        const pagePath = join(storeDir, "src", "app", slug, "page.tsx");
        if (!existsSync(pagePath)) continue;
        const pageCode = readFileSync(pagePath, "utf-8");
        if (pageCode.split("\n").length > 150) continue;
        await rewriteSparseComponent(pagePath, pageCode, page.label, storeInfo || {}, `/stores/${store.slug}`);
      }
    } catch (err) {
      console.error("[StoreUpdateData] Auto-enhance failed:", err);
    }
  }

  // Invalidate the cached parse (+ flush any authoritative column updates).
  await prisma.store.update({ where: { id: store.id }, data: { siteData: "{}", ...dbUpdate } }).catch(() => {});
  return { ok: true };
}

/* ── read pipeline ────────────────────────────────────────────────────── */

/** Parse the generated store's structured content (+ DB categories). Caches it. */
export async function readStoreData(store: StoreRef, opts?: { forceRefresh?: boolean }): Promise<Record<string, Any> | null> {
  if (!opts?.forceRefresh && store.siteData && store.siteData !== "{}") {
    try { return JSON.parse(store.siteData); } catch { /* re-parse */ }
  }
  const storeDir = store.generatedPath || getStoreDir(store.id);
  const dataPath = join(storeDir, "src", "lib", "data.ts");
  const productsPath = join(storeDir, "src", "lib", "products.ts");
  if (!existsSync(dataPath)) return null;

  const dataContent = readFileSync(dataPath, "utf-8");
  const productsContent = existsSync(productsPath) ? readFileSync(productsPath, "utf-8") : "";
  const result: Record<string, Any> = {};

  result.storeInfo = {
    name: extractString(dataContent, "name"), tagline: extractString(dataContent, "tagline"),
    description: extractString(dataContent, "description"), about: extractString(dataContent, "about"),
    mission: extractString(dataContent, "mission"), currency: extractString(dataContent, "currency"),
    region: extractString(dataContent, "region"), logoUrl: extractString(dataContent, "logoUrl"),
    bannerUrl: extractString(dataContent, "bannerUrl"), address: extractString(dataContent, "address"),
    ctaText: extractString(dataContent, "ctaText"), ctaUrl: extractString(dataContent, "ctaUrl"),
  };

  const heroBlockMatch = dataContent.match(/heroConfig\s*=\s*\{([\s\S]*?)\};/);
  const heroBlockBody = heroBlockMatch ? heroBlockMatch[1] : "";
  const extractSlides = (body: string): string[] => {
    const m = body.match(/slides\s*:\s*\[([\s\S]*?)\](\s*as\s+string\[\])?/);
    if (!m) return [];
    return (m[1].match(/"([^"]*)"/g) || []).map((s) => s.slice(1, -1)).filter(Boolean);
  };
  const extractHeroStyle = (body: string): string | undefined => body.match(/style\s*:\s*"([^"]*)"/)?.[1];
  result.heroConfig = {
    headline: extractString(dataContent, "headline"), subheadline: extractString(dataContent, "subheadline"),
    ctaText: extractNestedString(dataContent, "heroConfig", "ctaText"), ctaUrl: extractNestedString(dataContent, "heroConfig", "ctaUrl"),
    slides: extractSlides(heroBlockBody), style: extractHeroStyle(heroBlockBody) || "slideshow",
  };

  result.navLinks = extractLinkArray(dataContent, "navLinks");
  result.footerLinks = extractLinkArray(dataContent, "footerLinks");

  const dbCategories = await prisma.productCategory.findMany({
    where: { storeId: store.id },
    select: { id: true, name: true, slug: true, description: true, imageUrl: true },
    orderBy: { createdAt: "asc" },
  });
  result.categories = dbCategories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description || "", image: c.imageUrl || "" }));

  result.faq = extractObjectArray(dataContent, "faq", ["question", "answer"]);
  if (productsContent) result.products = extractObjectArray(productsContent, "products", ["id", "slug", "name", "shortDescription", "description", "priceCents", "comparePriceCents", "categoryId", "featured"]);

  const appDir = join(storeDir, "src", "app");
  const pages: Array<{ slug: string; label: string }> = [];
  if (existsSync(appDir)) {
    for (const entry of readdirSync(appDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith("[") || entry.name.startsWith("_") || entry.name.startsWith("(")) continue;
      if (existsSync(join(appDir, entry.name, "page.tsx"))) {
        pages.push({ slug: entry.name, label: entry.name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) });
      }
    }
    if (existsSync(join(appDir, "page.tsx"))) pages.unshift({ slug: "", label: "Home" });
  }
  result.pages = pages;

  await prisma.store.update({ where: { id: store.id }, data: { siteData: JSON.stringify(result) } }).catch(() => {});
  return result;
}

function extractString(source: string, field: string): string {
  const doubleMatch = source.match(new RegExp(`${field}:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  if (doubleMatch) return doubleMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  const singleMatch = source.match(new RegExp(`${field}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  if (singleMatch) return singleMatch[1].replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  const storeUrlMatch = source.match(new RegExp(`${field}:\\s*storeUrl\\((['"])(.*?)\\1\\)`));
  if (storeUrlMatch) return storeUrlMatch[2];
  return "";
}

function extractNestedString(source: string, parent: string, field: string): string {
  const parentMatch = source.match(new RegExp(`${parent}\\s*=\\s*\\{([\\s\\S]*?)\\};`));
  return parentMatch ? extractString(parentMatch[1], field) : "";
}

function extractLinkArray(source: string, arrayName: string): Array<{ href: string; label: string }> {
  const links: Array<{ href: string; label: string }> = [];
  const arrayMatch = source.match(new RegExp(`${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!arrayMatch) return links;
  for (const item of arrayMatch[1].split(/\},?\s*\{/)) {
    let href = "";
    const storeUrlHref = item.match(/href:\s*storeUrl\(['"]([^'"]*)['"]\)/);
    if (storeUrlHref) href = storeUrlHref[1];
    else { const plainHref = item.match(/href:\s*['"]([^'"]*)['"]/); if (plainHref) href = plainHref[1]; }
    const label = extractString(item, "label");
    if (href || label) links.push({ href, label });
  }
  return links;
}

function extractObjectArray(source: string, arrayName: string, fields: string[]): Record<string, string>[] {
  const result: Record<string, string>[] = [];
  const arrayMatch = source.match(new RegExp(`(?:^|\\s)${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\];`, "m"));
  if (!arrayMatch) return result;
  for (const item of arrayMatch[1].split(/\},\s*\{/)) {
    const obj: Record<string, string> = {};
    for (const field of fields) {
      const val = extractString(item, field);
      if (val) obj[field] = val;
      if (!val) { const numMatch = item.match(new RegExp(`${field}:\\s*(\\d+)`)); if (numMatch) obj[field] = numMatch[1]; }
      if (!val) { const boolMatch = item.match(new RegExp(`${field}:\\s*(true|false)`)); if (boolMatch) obj[field] = boolMatch[1]; }
    }
    if (Object.keys(obj).length > 0) result.push(obj);
  }
  return result;
}

/* ── AI section redesign ──────────────────────────────────────────────── */

function getSectionFiles(storeDir: string, section: string): string[] {
  const map: Record<string, string[]> = {
    hero: ["src/components/Hero.tsx"],
    header: ["src/components/Header.tsx"],
    footer: ["src/components/Footer.tsx"],
    homepage: ["src/app/page.tsx"],
    products: ["src/app/products/page.tsx"],
    about: ["src/app/about/page.tsx"],
    contact: ["src/app/contact/page.tsx"],
    faq: ["src/app/faq/page.tsx"],
    policies: ["src/app/policies/page.tsx", "src/app/shipping-returns/page.tsx"],
    cart: ["src/app/cart/page.tsx", "src/components/Cart.tsx"],
    data: ["src/lib/data.ts"],
  };
  return (map[section] || []).map((f) => join(storeDir, f)).filter((f) => existsSync(f));
}

/** Detect which editable sections exist in the generated store. */
export function detectStoreSections(storeDir: string): Array<{ id: string; label: string }> {
  const sections: Array<{ id: string; label: string }> = [];
  const checks: Array<[string, string, string[]]> = [
    ["hero", "Hero Section", ["src/components/Hero.tsx"]],
    ["header", "Header / Navigation", ["src/components/Header.tsx"]],
    ["footer", "Footer", ["src/components/Footer.tsx"]],
    ["homepage", "Home Page", ["src/app/page.tsx"]],
    ["products", "Products Page", ["src/app/products/page.tsx"]],
    ["about", "About Page", ["src/app/about/page.tsx"]],
    ["contact", "Contact", ["src/app/contact/page.tsx"]],
    ["faq", "FAQ", ["src/app/faq/page.tsx"]],
    ["policies", "Policies", ["src/app/policies/page.tsx", "src/app/shipping-returns/page.tsx"]],
    ["data", "Store Data (company info, config)", ["src/lib/data.ts"]],
  ];
  for (const [id, label, files] of checks) {
    if (files.some((f) => existsSync(join(storeDir, f)))) sections.push({ id, label });
  }
  try {
    const appDir = join(storeDir, "src", "app");
    if (existsSync(appDir)) {
      const dirs = readdirSync(appDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("(") && !d.name.startsWith("["))
        .map((d) => d.name);
      for (const dir of dirs) {
        if (!sections.find((s) => s.id === dir) && existsSync(join(appDir, dir, "page.tsx"))) {
          sections.push({ id: dir, label: dir.charAt(0).toUpperCase() + dir.slice(1).replace(/-/g, " ") });
        }
      }
    }
  } catch { /* no app dir */ }
  return sections;
}

/** AI-redesign a store section. Does NOT gate credits or build (caller does). */
export async function applyStoreSectionRedesign(params: { store: StoreRef; section: string; prompt: string }): Promise<{ ok: boolean; error?: string; file?: string }> {
  const { store, section, prompt } = params;
  const storeDir = store.generatedPath || getStoreDir(store.id);
  const files = getSectionFiles(storeDir, section);
  if (files.length === 0) return { ok: false, error: `Section "${section}" isn't part of this store.` };

  const fileContents = files.map((f) => ({ path: f.replace(storeDir, "").replace(/\\/g, "/"), absPath: f, content: readFileSync(f, "utf-8") }));
  let dataContent = "";
  try { dataContent = readFileSync(join(storeDir, "src", "lib", "data.ts"), "utf-8"); } catch { /* optional */ }

  const agentResult = await runSectionUpdateAgent({
    siteDir: storeDir, section, prompt, basePath: `/stores/${store.slug}`, kind: "store", dataContent, files: fileContents,
  });
  for (const update of agentResult.updates) writeFileSync(update.absPath, update.content, "utf-8");
  return { ok: true, file: fileContents[0].path };
}

/* ── build + deploy ───────────────────────────────────────────────────── */

/** Build then deploy the V3 store. Awaitable; clears the site-data cache on success. */
export async function rebuildAndDeployStore(store: { id: string; slug: string }): Promise<{ success: boolean; error?: string }> {
  try {
    const buildResult = await buildStoreV3(store.id);
    if (!buildResult.success) return { success: false, error: buildResult.error || "Build failed" };
    const deployResult = await deployStoreV3(store.id, store.slug);
    if (!deployResult.success) {
      await prisma.store.update({ where: { id: store.id }, data: { buildStatus: "error", lastBuildError: `Deploy failed: ${deployResult.error}`.substring(0, 5000) } }).catch(() => {});
      return { success: false, error: deployResult.error || "Deploy failed" };
    }
    await prisma.store.update({ where: { id: store.id }, data: { siteData: "{}" } }).catch(() => {});
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Build failed";
    await prisma.store.update({ where: { id: store.id }, data: { buildStatus: "error", lastBuildError: `Fatal: ${message}`.substring(0, 5000), buildStartedAt: null } }).catch(() => {});
    return { success: false, error: message };
  }
}
