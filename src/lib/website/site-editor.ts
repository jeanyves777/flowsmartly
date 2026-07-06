import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { prisma } from "@/lib/db/client";
import { getSiteDir, buildSite, deploySite, buildSiteV3, deploySiteV3 } from "@/lib/website/site-builder";
import { runSectionUpdateAgent } from "@/lib/ai/section-update-agent";

/**
 * Shared site-editing engine. Both the editor API routes (update-data, rebuild)
 * AND the flow-agent's edit_website tool call THESE functions, so there is one
 * implementation of "write the user's structured content into the generated
 * site files" and "build + deploy" — no duplicated logic. Auth/credit gating
 * stays with each caller; this module only does the file work + build.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export interface WebsiteRef {
  id: string;
  slug: string;
  generatedPath: string | null;
  siteData: string | null;
}

/* ── image localization ───────────────────────────────────────────────── */

// Download external image URLs to the site's public directory.
async function localizeImage(url: string, siteDir: string, category: string, basePath: string): Promise<string> {
  if (!url) return url;
  if (url.startsWith("/sites/")) return url;
  if (url.startsWith("/images/")) return basePath + url;
  if (url.startsWith("http")) {
    try {
      let downloadUrl = url;
      if (url.includes("X-Amz-")) downloadUrl = url.split("?")[0];
      const res = await fetch(downloadUrl);
      if (!res.ok) { console.error(`[Localize] Failed: ${res.status}`); return url; }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 100) return url;
      const ext = downloadUrl.split("?")[0].match(/\.(png|jpg|jpeg|webp|gif|svg)$/i)?.[1] || "jpg";
      const name = `${category}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.${ext}`;
      const dir = join(siteDir, "public", "images", category);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, name), buffer);
      const localPath = `${basePath}/images/${category}/${name}`;
      console.log(`[Localize] ${localPath} (${buffer.length}b)`);
      return localPath;
    } catch (err: Any) {
      console.error(`[Localize] Error: ${err.message}`);
      return url;
    }
  }
  return url;
}

function escapeStr(s: string): string {
  return (s || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n");
}

function toUniqueStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const clean = String(value || "").trim().replace(/\s+/g, " ");
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
}

function writeExportedStringArray(source: string, exportName: string, values: string[]) {
  const code = `export const ${exportName} = [${values.map((value) => `'${escapeStr(value)}'`).join(", ")}]`;
  const pattern = new RegExp(`export const ${exportName}\\s*=\\s*\\[[\\s\\S]*?\\]`);
  if (pattern.test(source)) {
    return source.replace(pattern, code);
  }
  return `${source.trimEnd()}\n\n${code}\n`;
}

function syncGalleryCategoryFilters(siteDir: string, categories: string[]) {
  if (!categories.length) return;

  const candidates = [
    join(siteDir, "src", "app", "gallery", "page.tsx"),
    join(siteDir, "src", "components", "Gallery.tsx"),
  ];
  const values = ["All", ...categories];
  const arrayCode = `[${values.map((value) => `'${escapeStr(value)}'`).join(", ")}]`;
  const unionCode = values.map((value) => `'${escapeStr(value)}'`).join(" | ");

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    try {
      let content = readFileSync(filePath, "utf-8");
      const original = content;

      content = content.replace(/type\s+Category\s*=\s*[^;\n]+/, `type Category = ${unionCode}`);
      content = content.replace(
        /const\s+categories(?:\s*:\s*[^=]+)?\s*=\s*\[[\s\S]*?\]/,
        `const categories: Category[] = ${arrayCode}`
      );

      if (content !== original) {
        writeFileSync(filePath, content);
        console.log(`[UpdateData] Synced gallery category filters in ${filePath}`);
      }
    } catch (err) {
      console.error("[UpdateData] Gallery category sync failed:", err);
    }
  }
}

/* ── the main write pipeline ──────────────────────────────────────────── */

/**
 * Apply a (partial) structured site-data patch to the generated site files.
 * Mirrors POST /api/websites/[id]/update-data exactly — localize images, write
 * data.ts + component files, and AI-fix component mismatches. Does NOT build.
 * `data` may be partial: only the provided keys are written.
 */
export async function applySiteDataUpdate(params: { website: WebsiteRef; data: Any }): Promise<void> {
  const { website } = params;
  const data = params.data;
  const basePath = `/sites/${website.slug}`;
  const siteDir = website.generatedPath || getSiteDir(website.id);

  // ── STEP 1: Localize ALL images FIRST ──
  if (data.logo?.startsWith("http")) {
    data.logo = await localizeImage(data.logo, siteDir, "brand", basePath);
  }
  if (data.heroImages) {
    for (let i = 0; i < data.heroImages.length; i++) {
      if (data.heroImages[i]?.startsWith("http")) data.heroImages[i] = await localizeImage(data.heroImages[i], siteDir, "hero", basePath);
    }
  }
  if (data.services) {
    for (const svc of data.services) if (svc.image?.startsWith("http")) svc.image = await localizeImage(svc.image, siteDir, "services", basePath);
  }
  if (data.team) {
    for (const m of data.team) if (m.image?.startsWith("http")) m.image = await localizeImage(m.image, siteDir, "team", basePath);
  }
  if (data.blogPosts) {
    for (const p of data.blogPosts) if (p.image?.startsWith("http")) p.image = await localizeImage(p.image, siteDir, "blog", basePath);
  }
  if (data.galleryImages) {
    for (const g of data.galleryImages) if (g.src?.startsWith("http")) g.src = await localizeImage(g.src, siteDir, "gallery", basePath);
  }
  if (data.testimonials) {
    for (const t of data.testimonials) if (t.image?.startsWith("http")) t.image = await localizeImage(t.image, siteDir, "testimonials", basePath);
  }

  // ── STEP 2: Save to DB (merge partial patch over cached siteData) ──
  const prevSiteData = website.siteData ? (() => { try { return JSON.parse(website.siteData as string); } catch { return {}; } })() : {};
  const mergedForDb = { ...prevSiteData, ...data };
  await prisma.website.update({ where: { id: website.id }, data: { siteData: JSON.stringify(mergedForDb) } });

  // ── STEP 3: Write data.ts ──
  const dataPath = join(siteDir, "src", "lib", "data.ts");
  try {
    let content = readFileSync(dataPath, "utf-8");

    if (data.company) {
      const c = data.company;
      const fields: [string, string][] = [
        ["name", c.name], ["shortName", c.shortName], ["tagline", c.tagline],
        ["description", c.description], ["about", c.about], ["mission", c.mission],
        ["address", c.address], ["city", c.city], ["state", c.state], ["country", c.country],
        ["website", c.website], ["ctaText", c.ctaText], ["ctaUrl", c.ctaUrl],
      ];
      for (const [k, v] of fields) {
        if (v !== undefined && v !== null) {
          const escaped = v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
          content = content.replace(
            new RegExp(`(${k}:\\s*)(?:'(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*")`),
            `$1"${escaped}"`
          );
        }
      }
      if (c.phones?.length) {
        const items = c.phones.map((v: string) => `'${escapeStr(v)}'`).join(", ");
        content = content.replace(/phones:\s*\[[^\]]*\]/, `phones: [${items}]`);
      }
      if (c.emails?.length) {
        const items = c.emails.map((v: string) => `'${escapeStr(v)}'`).join(", ");
        content = content.replace(/emails:\s*\[[^\]]*\]/, `emails: [${items}]`);
      }
    }

    if (data.stats) {
      for (const s of data.stats) content = content.replace(new RegExp(`(${s.label}):\\s*\\d+`), `${s.label}: ${s.value}`);
    }

    if (data.navLinks) {
      const code = data.navLinks.map((l: Any) => {
        let href = l.href || "";
        if (href.startsWith("/") && !href.startsWith(basePath) && !href.startsWith("/http")) href = basePath + href;
        return `  { href: '${escapeStr(href)}', label: '${escapeStr(l.label || "")}' }`;
      }).join(",\n");
      content = content.replace(/export const navLinks\s*=\s*\[[\s\S]*?\n\]/, `export const navLinks = [\n${code}\n]`);
    }
    if (data.footerLinks) {
      const code = data.footerLinks.map((l: Any) => {
        let href = l.href || "";
        if (href.startsWith("/") && !href.startsWith(basePath) && !href.startsWith("/http")) href = basePath + href;
        return `  { href: '${escapeStr(href)}', label: '${escapeStr(l.label || "")}' }`;
      }).join(",\n");
      content = content.replace(
        /export const footerLinks\s*=\s*\[[\s\S]*?\n\]/,
        `export const footerLinks = [\n  ...navLinks,\n${code}\n]`
      );
    }

    if (data.services) {
      const code = data.services.map((s: Any) => `  {
    id: '${escapeStr(s.id || "")}',
    title: '${escapeStr(s.title || "")}',
    shortDescription: '${escapeStr(s.shortDescription || "")}',
    description: '${escapeStr(s.description || "")}',
    icon: '${escapeStr(s.icon || "Star")}',
    image: '${escapeStr(s.image || "")}',${s.link ? `\n    link: '${escapeStr(s.link)}',` : ""}
  }`).join(",\n");
      content = content.replace(/export const services\s*=\s*\[[\s\S]*?\n\]/, `export const services = [\n${code}\n]`);
    }

    if (data.team) {
      const exportName = content.match(/export const (teamMembers|team)\s*=/)?.[1] || "team";
      const code = data.team.map((t: Any) => `  {
    name: '${escapeStr(t.name || "")}',
    role: '${escapeStr(t.role || "")}',
    bio: '${escapeStr(t.bio || "")}',
    image: '${escapeStr(t.image || "")}',
  }`).join(",\n");
      content = content.replace(/export const (?:teamMembers|team)\s*=\s*\[[\s\S]*?\n\]/, `export const ${exportName} = [\n${code}\n]`);
    }

    if (data.faq) {
      const exportName = content.match(/export const (faqItems|faqs?)\s*=/)?.[1] || "faqItems";
      const code = data.faq.map((f: Any) => `  {
    question: '${escapeStr(f.question || "")}',
    answer: '${escapeStr(f.answer || "")}',
  }`).join(",\n");
      content = content.replace(/export const (?:faqItems|faqs?)\s*=\s*\[[\s\S]*?\n\]/, `export const ${exportName} = [\n${code}\n]`);
    }

    if (data.testimonials) {
      const code = data.testimonials.map((t: Any) => `  {
    name: '${escapeStr(t.name || "")}',
    role: '${escapeStr(t.role || "")}',
    rating: ${t.rating || 5},
    text: '${escapeStr(t.text || "")}',
    avatar: '${(t.name || "").split(" ").map((w: string) => w[0] || "").join("").substring(0, 2).toUpperCase()}',${t.image ? `\n    image: '${escapeStr(t.image)}',` : ""}${t.video ? `\n    video: '${escapeStr(t.video)}',` : ""}
  }`).join(",\n");
      content = content.replace(/export const testimonials\s*=\s*\[[\s\S]*?\n\]/, `export const testimonials = [\n${code}\n]`);
    }

    if (data.testimonialsLayout) {
      const layout = escapeStr(data.testimonialsLayout);
      if (content.includes("testimonialsLayout")) {
        content = content.replace(/export const testimonialsLayout\s*=\s*['"][^'"]*['"]/, `export const testimonialsLayout = '${layout}'`);
      } else {
        content = content.replace(/(export const testimonials\s*=\s*\[[\s\S]*?\n\])/, `$1\nexport const testimonialsLayout = '${layout}'`);
      }
    }

    if (data.googleReviews) {
      const gr = data.googleReviews;
      const reviewsCode = (gr.reviews || []).map((r: Any) => `    {
      name: '${escapeStr(r.name || "")}',
      date: '${escapeStr(r.date || "")}',
      rating: ${r.rating || 5},
      text: '${escapeStr(r.text || "")}',
      avatar: '${(r.name || "").split(" ").map((w: string) => w[0] || "").join("").substring(0, 2).toUpperCase()}',
    }`).join(",\n");
      const grCode = `export const googleReviews = {
  enabled: ${!!gr.enabled},
  businessName: '${escapeStr(gr.businessName || "")}',
  rating: ${gr.rating || 5},
  totalReviews: ${gr.totalReviews || 0},
  googleUrl: '${escapeStr(gr.googleUrl || "")}',
  reviews: [\n${reviewsCode}\n  ],
}`;
      if (content.includes("export const googleReviews")) {
        content = content.replace(/export const googleReviews\s*=\s*\{[\s\S]*?\n\}/, grCode);
      } else {
        content += `\n\n${grCode}\n`;
      }
    }

    if (data.contactInfo) {
      const ci = data.contactInfo;
      const contactCode = `export const contactInfo = {
  mapEmbedUrl: '${escapeStr(ci.mapEmbedUrl || "")}',
  mapAddress: '${escapeStr(ci.mapAddress || "")}',
}`;
      if (content.includes("export const contactInfo")) {
        content = content.replace(/export const contactInfo\s*=\s*\{[\s\S]*?\n\}/, contactCode);
      } else {
        content += `\n\n${contactCode}\n`;
      }
    }

    if (data.blogPosts) {
      const code = data.blogPosts.map((b: Any) => `  {
    id: '${escapeStr(b.id || "")}',
    slug: '${escapeStr(b.slug || b.id || "")}',
    title: '${escapeStr(b.title || "")}',
    excerpt: '${escapeStr(b.excerpt || "")}',
    content: '${escapeStr(b.content || "")}',
    category: '${escapeStr(b.category || "")}',
    date: '${escapeStr(b.date || "")}',
    author: '${escapeStr(b.author || "")}',
    image: '${escapeStr(b.image || "")}',
    source: '${escapeStr(b.source || "")}',
    automationId: '${escapeStr(b.automationId || "")}',
  }`).join(",\n");
      content = content.replace(/export const blogPosts\s*=\s*\[[\s\S]*?\n\]/, `export const blogPosts = [\n${code}\n]`);
    }

    if (data.galleryImages) {
      const code = data.galleryImages.map((g: Any) => `  {
    src: '${escapeStr(g.src || "")}',
    alt: '${escapeStr(g.alt || "")}',
    category: '${escapeStr(g.category || "")}',
  }`).join(",\n");
      content = content.replace(/export const galleryImages\s*=\s*\[[\s\S]*?\n\]/, `export const galleryImages = [\n${code}\n]`);
    }

    const galleryCategories = toUniqueStrings([
      ...(Array.isArray(data.galleryCategories) ? data.galleryCategories : []),
      ...(Array.isArray(data.galleryImages) ? data.galleryImages.map((g: Any) => g.category) : []),
    ]);
    if (galleryCategories.length > 0 || Array.isArray(data.galleryCategories)) {
      data.galleryCategories = galleryCategories;
      content = writeExportedStringArray(content, "galleryCategories", galleryCategories);
    }

    writeFileSync(dataPath, content);
    console.log(`[UpdateData] Written data.ts`);
  } catch (err) {
    console.error("[UpdateData] data.ts write error:", err);
  }

  // ── STEP 4: Update component files ──
  if (Array.isArray(data.galleryCategories)) syncGalleryCategoryFilters(siteDir, data.galleryCategories);

  if (data.heroImages?.length) {
    const heroPath = join(siteDir, "src", "components", "Hero.tsx");
    try {
      let c = readFileSync(heroPath, "utf-8");
      const hasImageSlides = /slides\s*=\s*\[[\s\S]*?(?:src|image):\s*['"]/m.test(c);
      if (hasImageSlides) {
        const code = data.heroImages.map((img: string, i: number) => `  {\n    src: '${escapeStr(img)}',\n    alt: 'Slide ${i + 1}',\n  }`).join(",\n");
        c = c.replace(/const slides\s*=\s*\[[\s\S]*?\];/, `const slides = [\n${code}\n];`);
        c = c.replace(/slide\.image/g, "slide.src");
        c = c.replace(/-z-10/g, "z-0");
        writeFileSync(heroPath, c);
        console.log(`[UpdateData] Hero.tsx slides updated (image-compatible)`);
      } else {
        const slidesCode = data.heroImages.map((img: string, i: number) => `  { src: '${escapeStr(img)}', alt: 'Slide ${i + 1}' }`).join(",\n");
        await rewriteComponent(heroPath, c,
          `The user has uploaded hero images for a slideshow. Add these images to the Hero component while PRESERVING the existing layout structure.

LAYOUT PRESERVATION (CRITICAL):
- First, analyze the current Hero layout: Is it a two-column grid (text left, content right)? A full-width hero? A centered layout?
- KEEP the same layout structure — if it has a two-column grid, put the image slideshow in the RIGHT column where any illustration/placeholder was
- If it's a single-column/centered layout, add the slideshow as a background behind the text with an overlay
- Preserve ALL existing text content (headline, tagline, description, CTA buttons, badges, stats)
- Preserve the existing color scheme, brand colors, and button styles

USE THESE EXACT IMAGE PATHS — copy them verbatim into a slides array:
const slides = [
${slidesCode}
];

Remove any emoji/text/icon placeholder slides but keep the layout structure they were in.

THEMING (CRITICAL):
- The component MUST support BOTH light and dark mode using Tailwind "dark:" prefix
- Do NOT hardcode dark backgrounds (bg-black, bg-gray-900, bg-neutral-900, etc.) without a light-mode default
- Section background: bg-white dark:bg-neutral-950 (or similar light/dark pair)
- Text colors: text-neutral-900 dark:text-white for headings, text-neutral-600 dark:text-neutral-300 for body
- Badge/pill backgrounds: use bg-yellow-50 dark:bg-yellow-500/10 or similar pairs
- Borders: border-neutral-200 dark:border-neutral-800

STATIC EXPORT RULES:
- Render ALL slides using .map(), absolutely positioned within a relative container
- The first slide (index 0) MUST have opacity-100, all others opacity-0 — use: className={\`... \${i === current ? 'opacity-100' : 'opacity-0'} transition-opacity duration-1000\`}
- Do NOT use framer-motion (AnimatePresence, motion.div) for the slideshow
- Use useState for slide index (default 0), useEffect for auto-advance timer
- Each slide image: <img src={slide.src} alt={slide.alt} className="w-full h-full object-cover" />
- The first slide MUST be visible without JavaScript
- The slideshow container MUST use z-0 (NOT -z-10 or any negative z-index — negative z puts images behind the parent background)
- If the slideshow is in a column (not full-width), wrap it in a rounded card with aspect-[4/3] and overflow-hidden
- Add prev/next buttons and dot indicators below or on top of the slideshow`,
          basePath
        );
      }
    } catch { /* Hero.tsx may not exist */ }
  }

  if (data.logo && data.logo !== "__svg__") {
    // Header
    try {
      const p = join(siteDir, "src", "components", "Header.tsx");
      let c = readFileSync(p, "utf-8");
      if (c.includes("<Logo")) {
        c = c.replace(/import Logo from ['"]@\/components\/Logo['"];?\n?/g, "");
        c = c.replace(/<Logo\s[^>]*\/>/g, `<img src="${escapeStr(data.logo)}" alt="Logo" className="h-8 sm:h-10 w-auto" />`);
        c = c.replace(/<Logo\s*\/>/g, `<img src="${escapeStr(data.logo)}" alt="Logo" className="h-8 sm:h-10 w-auto" />`);
      } else {
        c = c.replace(/(<img[^>]*alt=["']Logo["'][^>]*src=["'])[^"']*(["'])/i, `$1${escapeStr(data.logo)}$2`);
        c = c.replace(/(<img[^>]*src=["'])[^"']*(["'][^>]*alt=["']Logo["'])/i, `$1${escapeStr(data.logo)}$2`);
      }
      writeFileSync(p, c);
    } catch { /* Header may not exist */ }
    // Footer
    try {
      const p = join(siteDir, "src", "components", "Footer.tsx");
      let c = readFileSync(p, "utf-8");
      if (c.includes("<Logo")) {
        c = c.replace(/import Logo from ['"]@\/components\/Logo['"];?\n?/g, "");
        c = c.replace(/<Logo\s[^>]*\/>/g, `<img src="${escapeStr(data.logo)}" alt="Logo" className="h-10 w-auto" />`);
        c = c.replace(/<Logo\s*\/>/g, `<img src="${escapeStr(data.logo)}" alt="Logo" className="h-10 w-auto" />`);
      } else {
        c = c.replace(/(<img[^>]*alt=["']Logo["'][^>]*src=["'])[^"']*(["'])/i, `$1${escapeStr(data.logo)}$2`);
        c = c.replace(/(<img[^>]*src=["'])[^"']*(["'][^>]*alt=["']Logo["'])/i, `$1${escapeStr(data.logo)}$2`);
      }
      writeFileSync(p, c);
    } catch { /* Footer may not exist */ }
    // Favicon
    try {
      const p = join(siteDir, "src", "app", "layout.tsx");
      let c = readFileSync(p, "utf-8");
      c = c.replace(/icon:\s*['"][^'"]*['"]/, `icon: '${escapeStr(data.logo)}'`);
      writeFileSync(p, c);
    } catch { /* layout may not exist */ }
    console.log(`[UpdateData] Logo updated in Header, Footer, favicon`);
  }

  // Page images (replace SVG illustrations with uploaded images)
  if (data.pageImages) {
    for (const [pageSlug, imageUrl] of Object.entries(data.pageImages)) {
      if (!imageUrl) continue;
      let imgPath = imageUrl as string;
      if (imgPath.startsWith("http")) {
        imgPath = await localizeImage(imgPath, siteDir, pageSlug, basePath);
        data.pageImages[pageSlug] = imgPath;
      }
      const capitalSlug = pageSlug.charAt(0).toUpperCase() + pageSlug.slice(1);
      const filesToCheck = [
        join(siteDir, "src", "components", `${capitalSlug}.tsx`),
        join(siteDir, "src", "app", pageSlug, "page.tsx"),
      ];
      for (const filePath of filesToCheck) {
        try {
          let fileContent = readFileSync(filePath, "utf-8");
          const newTag = `<img src="${escapeStr(imgPath)}" alt="${capitalSlug}" className="w-full h-full object-cover rounded-2xl" />`;
          const svgComponentRegex = /<(?:ChurchBuilding|OfficeBuildingSVG|WorkersSVG|Illustration|SvgIllustration|[A-Z]\w*SVG|[A-Z]\w*Illustration)\s*\/>/g;
          const existingImgRegex = new RegExp(`<img\\b[^>]*\\balt="${capitalSlug}"[^>]*\\/>`, "g");
          if (svgComponentRegex.test(fileContent)) {
            fileContent = fileContent.replace(/<(?:ChurchBuilding|OfficeBuildingSVG|WorkersSVG|Illustration|SvgIllustration|[A-Z]\w*SVG|[A-Z]\w*Illustration)\s*\/>/g, newTag);
            writeFileSync(filePath, fileContent);
          } else if (existingImgRegex.test(fileContent)) {
            fileContent = fileContent.replace(new RegExp(`<img\\b[^>]*\\balt="${capitalSlug}"[^>]*\\/>`, "g"), newTag);
            writeFileSync(filePath, fileContent);
          }
        } catch { /* page may not exist */ }
      }
    }
  }
  if (data.aboutImage) {
    const aboutPath = join(siteDir, "src", "components", "About.tsx");
    try {
      let c = readFileSync(aboutPath, "utf-8");
      let imgPath = data.aboutImage;
      if (imgPath.startsWith("http")) imgPath = await localizeImage(imgPath, siteDir, "about", basePath);
      const newTag = `<img src="${escapeStr(imgPath)}" alt="About" className="w-full h-full object-cover rounded-2xl" />`;
      const svgRegex = /<(?:ChurchBuilding|OfficeBuildingSVG|WorkersSVG|[A-Z]\w*SVG|[A-Z]\w*Illustration)\s*\/>/g;
      const existingImgRegex = /<img\b[^>]*\balt="About"[^>]*\/>/g;
      if (svgRegex.test(c)) {
        c = c.replace(/<(?:ChurchBuilding|OfficeBuildingSVG|WorkersSVG|[A-Z]\w*SVG|[A-Z]\w*Illustration)\s*\/>/g, newTag);
        writeFileSync(aboutPath, c);
      } else if (existingImgRegex.test(c)) {
        c = c.replace(/<img\b[^>]*\balt="About"[^>]*\/>/g, newTag);
        writeFileSync(aboutPath, c);
      }
    } catch { /* About may not exist */ }
  }

  // NavLinks + FooterLinks (prefix bare paths with basePath)
  try {
    let content = readFileSync(dataPath, "utf-8");
    const prefixHref = (href: string) => (href.startsWith("/") && !href.startsWith(basePath) && !href.startsWith("/http")) ? basePath + href : href;
    if (data.navLinks) {
      const navCode = data.navLinks.map((l: Any) => `  { href: '${escapeStr(prefixHref(l.href || ""))}', label: '${escapeStr(l.label || "")}' }`).join(",\n");
      content = content.replace(/export const navLinks\s*=\s*\[[\s\S]*?\n\]/, `export const navLinks = [\n${navCode}\n]`);
    }
    if (data.footerLinks) {
      const fCode = data.footerLinks.map((l: Any) => `  { href: '${escapeStr(prefixHref(l.href || ""))}', label: '${escapeStr(l.label || "")}' }`).join(",\n");
      if (content.includes("export const footerLinks")) {
        content = content.replace(/export const footerLinks\s*=\s*\[[\s\S]*?\n\]/, `export const footerLinks = [\n${fCode}\n]`);
      } else {
        content += `\nexport const footerLinks = [\n${fCode}\n]\n`;
      }
    }
    writeFileSync(dataPath, content);
  } catch { /* ignore */ }

  // ── STEP 5: Detect & fix component mismatches ──
  await detectAndFixMismatches(siteDir, data, basePath);

  // ── STEP 6: Enhance newly added nav pages ──
  try {
    const prevNavHrefs = new Set((prevSiteData.navLinks || []).map((l: Any) => (l.href || "").replace(/^\/sites\/[^/]+/, "")));
    const newPages = (data.navLinks || [])
      .map((l: Any) => ({ href: (l.href || "").replace(/^\/sites\/[^/]+/, ""), label: l.label || "" }))
      .filter((l: Any) => l.href.startsWith("/") && l.href !== "/" && !prevNavHrefs.has(l.href));
    if (newPages.length > 0) {
      for (const page of newPages) {
        const slug = page.href.replace(/^\//, "");
        const pagePath = join(siteDir, "src", "app", slug, "page.tsx");
        if (!existsSync(pagePath)) continue;
        const pageCode = readFileSync(pagePath, "utf-8");
        if (pageCode.split("\n").length > 150) continue;
        await rewriteComponent(pagePath, pageCode,
          `This page "${page.label}" was just added to the site navigation. It currently has sparse/placeholder content.
Enhance it with real, detailed content for the "${page.label}" section of a "${data.company?.name || "business"}" website.

Company context:
- Name: ${data.company?.name || ""}
- Tagline: ${data.company?.tagline || ""}
- Description: ${data.company?.description || ""}
- About: ${data.company?.about || ""}

RULES:
- Keep the same component name and exports
- Import data from '@/lib/data' where appropriate (companyInfo, services, team, etc.)
- Make the page look professional and complete with real sections, proper spacing, and visual appeal
- Add multiple content sections appropriate for a "${page.label}" page
- Ensure proper dark mode support (dark: variants on all colors/backgrounds)
- Keep responsive design
- Add meaningful content based on the company description — not lorem ipsum`,
          basePath
        );
      }
    }
  } catch (err) {
    console.error("[UpdateData] Nav page enhancement error:", err);
  }

  console.log(`[UpdateData] Complete for ${website.slug}`);
}

/**
 * Detect mismatches between user data and component capabilities.
 * If the user added images/content the component can't render, AI rewrites it.
 */
async function detectAndFixMismatches(siteDir: string, data: Any, basePath: string) {
  const checks: Array<{ condition: boolean; filePath: string; detectField: string; prompt: string; force?: boolean }> = [
    { condition: data.services?.some((s: Any) => s.image), filePath: join(siteDir, "src", "app", "services", "page.tsx"), detectField: "image", prompt: `The user has added images to their services. Update this component to display each service's image (from the services array in data.ts). Show images as cards or alongside the service description.` },
    { condition: data.team?.some((t: Any) => t.image), filePath: join(siteDir, "src", "app", "team", "page.tsx"), detectField: "image", prompt: `The user has added photos for team members. Update this component to display each team member's photo (from the team array in data.ts). Show photos in a professional team grid layout.` },
    { condition: data.galleryImages?.length > 0, filePath: join(siteDir, "src", "app", "gallery", "page.tsx"), detectField: "galleryImages", prompt: `The user has added gallery images. Make sure this component imports and renders the galleryImages array from data.ts. Each item has {src, alt, category}. Show in a responsive grid layout.` },
    { condition: data.blogPosts?.some((b: Any) => b.image), filePath: join(siteDir, "src", "app", "blog", "page.tsx"), detectField: ".image", prompt: `The user has added images to blog posts. Update this component to display each blog post's image (from blogPosts in data.ts). Show images as card thumbnails.` },
    { condition: data.testimonials?.some((t: Any) => t.image), filePath: join(siteDir, "src", "components", "Testimonials.tsx"), detectField: "t.image", prompt: `The user has added photos to testimonials. Update this component to display each testimonial's photo (t.image from the testimonials array). Show a circular avatar photo if available, falling back to the avatar initials. Use a clean card layout with the photo alongside the review text.` },
    { condition: data.testimonials?.some((t: Any) => t.video), filePath: join(siteDir, "src", "components", "Testimonials.tsx"), detectField: "t.video", prompt: `The user has added video testimonials (t.video field). Update this component to render a video player (HTML5 <video> tag or YouTube/Vimeo embed) when t.video is present. Show the video above or alongside the text review.` },
    { condition: !!data.testimonialsLayout && data.testimonialsLayout !== "cards", filePath: join(siteDir, "src", "components", "Testimonials.tsx"), detectField: "testimonialsLayout", force: true, prompt: `The user wants the testimonials layout to be "${data.testimonialsLayout}". Import testimonialsLayout from data.ts and switch the rendering: "cards" = 3-col grid cards, "carousel" = horizontal auto-scrolling carousel with prev/next buttons, "list" = full-width stacked items, "masonry" = 2-col masonry grid. Implement the requested layout now.` },
    { condition: !!(data.contactInfo?.mapEmbedUrl), filePath: join(siteDir, "src", "components", "ContactSection.tsx"), detectField: "contactInfo", force: true, prompt: `The user has added a Google Map embed URL (contactInfo.mapEmbedUrl) and optional label (contactInfo.mapAddress) in data.ts. Import contactInfo from data.ts. Add a full-width map section below the contact form/info: show contactInfo.mapAddress as a label if present, then render an <iframe src={contactInfo.mapEmbedUrl} width="100%" height="400" ... /> in a rounded container. Only show if mapEmbedUrl is truthy.` },
    { condition: !!(data.googleReviews?.enabled && data.googleReviews?.reviews?.length), filePath: join(siteDir, "src", "components", "Testimonials.tsx"), detectField: "googleReviews", prompt: `The user has enabled Google Reviews (googleReviews in data.ts with: enabled, businessName, rating, totalReviews, googleUrl, reviews[]). Import googleReviews from data.ts. Add a second section BELOW the existing testimonials: a full-width "Google Reviews" block showing the Google G icon, businessName, overall rating (as stars), totalReviews count, individual review cards (name, date, rating stars, text excerpt), and a "See all reviews on Google" link using googleReviews.googleUrl. Only render this section if googleReviews.enabled is true.` },
  ];

  for (const check of checks) {
    if (!check.condition) continue;
    if (!existsSync(check.filePath)) continue;
    try {
      const code = readFileSync(check.filePath, "utf-8");
      if (check.force || !code.includes(check.detectField)) {
        await rewriteComponent(check.filePath, code, check.prompt, basePath);
      }
    } catch { /* ignore */ }
  }
}

/** AI component rewriter — reads current code, calls Claude, writes it back. */
async function rewriteComponent(filePath: string, currentCode: string, prompt: string, basePath: string) {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16000,
      system: `You are updating a React component for a Next.js STATIC EXPORT website.

RULES:
- Return ONLY the updated file content (no markdown fences, no explanations)
- Keep "use client" if present
- Use Tailwind CSS for styling
- basePath is "${basePath}" — all internal href links must start with "${basePath}/"
- All image src paths must start with "${basePath}/images/" or use the exact paths provided
- Support BOTH light and dark modes — use Tailwind "dark:" prefix for all color/background classes. NEVER hardcode dark-only backgrounds (bg-black, bg-neutral-900) without a corresponding light-mode default. Example: bg-white dark:bg-neutral-950
- Preserve the component name and export

CRITICAL STATIC EXPORT RULES (MUST FOLLOW):
- NEVER use framer-motion (motion.div, motion.span, AnimatePresence) for ANY visible content
- ALL text, images, buttons MUST be visible in the initial HTML without JavaScript
- For slideshows: render ALL slides using .map(), absolutely positioned with z-0 (NEVER -z-10), first slide opacity-100 others opacity-0, use transition-opacity for fading
- For animations: use Tailwind animate-* classes or CSS @keyframes, NOT framer-motion
- The page must look complete and styled with ZERO JavaScript loaded
- useState/useEffect are OK for interactivity (slide timer, toggles) but initial render must be visible`,
      messages: [{
        role: "user",
        content: `Current component:\n\`\`\`tsx\n${currentCode}\n\`\`\`\n\nREQUEST: ${prompt}\n\nReturn ONLY the updated code.`,
      }],
    });

    let updated = response.content
      .filter((c) => c.type === "text")
      .map((c) => c.type === "text" ? c.text : "")
      .join("")
      .replace(/^```(?:tsx|typescript|ts|javascript|jsx)?\n?/, "")
      .replace(/\n?```$/, "")
      .replace(/^(?:javascript|tsx?|jsx)\s*\n/i, "")
      .trim();

    if (currentCode.includes("'use client'") && !updated.startsWith("'use client'") && !updated.startsWith('"use client"')) {
      updated = "'use client'\n\n" + updated;
    }
    if (updated && updated.length > 100) {
      writeFileSync(filePath, updated);
      console.log(`[UpdateData] AI rewrote: ${filePath.split(/[\\/]/).pop()}`);
    }
  } catch (err) {
    console.error(`[UpdateData] AI rewrite failed:`, err);
  }
}

/* ── read structured site data (shared by the route + the agent) ─────── */

/**
 * Read the generated site's structured content — parses data.ts into the shape
 * the editor + the flow-agent use, and caches it on the Website row. Shared by
 * GET /site-data and the get_website_content tool so parsing lives in one place.
 */
export async function readSiteData(website: WebsiteRef): Promise<{ data: Any | null; pages: Array<{ slug: string; label: string }> }> {
  const siteDir = website.generatedPath || getSiteDir(website.id);
  const pages = detectPages(siteDir);

  // Prefer the DB cache when it already has the key fields.
  if (website.siteData && website.siteData !== "{}") {
    try {
      const cached = JSON.parse(website.siteData);
      if (cached.logo && cached.heroImages?.length && cached.navLinks?.length && Array.isArray(cached.galleryCategories)) {
        return { data: cached, pages };
      }
    } catch { /* fall through to re-parse */ }
  }

  const dataPath = join(siteDir, "src", "lib", "data.ts");
  try {
    const content = readFileSync(dataPath, "utf-8");
    const data: Record<string, Any> = {};

    const companyMatch = content.match(/export const companyInfo\s*=\s*(\{[\s\S]*?\n\})/);
    if (companyMatch) {
      const ci = companyMatch[1];
      data.company = {
        name: extractString(ci, "name"), shortName: extractString(ci, "shortName"), tagline: extractString(ci, "tagline"),
        description: extractString(ci, "description"), about: extractString(ci, "about"), mission: extractString(ci, "mission"),
        address: extractString(ci, "address"), city: extractString(ci, "city"), state: extractString(ci, "state"), country: extractString(ci, "country"),
        phones: extractArray(ci, "phones"), emails: extractArray(ci, "emails"), website: extractString(ci, "website"),
        ctaText: extractString(ci, "ctaText"), ctaUrl: extractString(ci, "ctaUrl"),
      };
      const statsBlock = ci.match(/stats:\s*\{([\s\S]*?)\}/);
      if (statsBlock) data.stats = [...statsBlock[1].matchAll(/(\w+):\s*(\d+)/g)].map(([, label, value]) => ({ label, value: parseInt(value) }));
    }

    data.navLinks = extractLinkArray(content, "navLinks");
    const navHrefs = new Set((data.navLinks || []).map((l: Any) => l.href));
    data.footerLinks = extractLinkArray(content, "footerLinks").filter((l: Any) => !navHrefs.has(l.href));

    data.services = extractObjectArray(content, "services", ["id", "title", "shortDescription", "description", "icon", "image", "link"]);
    data.testimonials = extractObjectArray(content, "testimonials", ["name", "role", "text"]);
    data.team = extractObjectArray(content, "team", ["name", "role", "bio", "image"]);
    if (!data.team?.length) data.team = extractObjectArray(content, "teamMembers", ["name", "role", "bio", "image"]);
    data.faq = extractObjectArray(content, "faqItems", ["question", "answer"]);
    if (!data.faq?.length) data.faq = extractObjectArray(content, "faqs", ["question", "answer"]);
    if (!data.faq?.length) data.faq = extractObjectArray(content, "faq", ["question", "answer"]);
    data.blogPosts = extractObjectArray(content, "blogPosts", ["id", "slug", "title", "excerpt", "content", "category", "date", "author", "image", "source", "automationId"]);
    data.galleryImages = extractObjectArray(content, "galleryImages", ["src", "alt", "category"]);
    data.galleryCategories = extractExportedStringArray(content, "galleryCategories");
    if (!data.galleryCategories.length && data.galleryImages?.length) {
      data.galleryCategories = Array.from(new Set(data.galleryImages.map((image: Any) => String(image.category || "").trim()).filter(Boolean)));
    }

    const slidesMatch = content.match(/(?:slides|heroImages|heroSlides)\s*=\s*\[([\s\S]*?)\]/);
    if (slidesMatch) {
      const imgPaths = [...slidesMatch[1].matchAll(/src:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
      if (imgPaths.length > 0) data.heroImages = imgPaths;
    }
    if (!data.heroImages?.length) {
      try {
        const heroContent = readFileSync(join(siteDir, "src", "components", "Hero.tsx"), "utf-8");
        const heroSlidesMatch = heroContent.match(/(?:const\s+)?slides\s*=\s*\[([\s\S]*?)\];/);
        if (heroSlidesMatch) {
          const imgPaths = [...heroSlidesMatch[1].matchAll(/src:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
          if (imgPaths.length > 0) data.heroImages = imgPaths;
        }
      } catch { /* Hero.tsx may not exist */ }
    }

    const logoMatch = content.match(/logo:\s*['"]([^'"]+)['"]/);
    if (logoMatch) data.logo = logoMatch[1];
    if (!data.logo) {
      for (const componentName of ["Logo.tsx", "Header.tsx"]) {
        if (data.logo && data.logo !== "__svg__") break;
        try {
          const componentContent = readFileSync(join(siteDir, "src", "components", componentName), "utf-8");
          const logoImgMatch = componentContent.match(/(?:alt=["']Logo["'][^>]*src=["']|src=["'])([^'"]+\.(?:png|jpg|jpeg|webp|svg|gif))["']/);
          if (logoImgMatch) data.logo = logoImgMatch[1];
          if (!data.logo && componentContent.includes("<svg")) data.logo = "__svg__";
        } catch { /* component may not exist */ }
      }
    }

    // Cache the merged parse back to the DB for faster future loads.
    const existingCached = website.siteData ? (() => { try { return JSON.parse(website.siteData as string); } catch { return {}; } })() : {};
    const cleanData = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)));
    const mergedData = { ...existingCached, ...cleanData };
    await prisma.website.update({ where: { id: website.id }, data: { siteData: JSON.stringify(mergedData) } });
    return { data: mergedData, pages };
  } catch {
    return { data: null, pages };
  }
}

function detectPages(siteDir: string): Array<{ slug: string; label: string }> {
  const appDir = join(siteDir, "src", "app");
  const pages: Array<{ slug: string; label: string }> = [];
  try { statSync(join(appDir, "page.tsx")); pages.push({ slug: "", label: "Home" }); } catch { /* no home */ }
  try {
    for (const entry of readdirSync(appDir)) {
      try {
        if (statSync(join(appDir, entry)).isDirectory() && !entry.startsWith("_") && !entry.startsWith(".") && !entry.startsWith("(")) {
          if (statSync(join(appDir, entry, "page.tsx")).isFile()) {
            pages.push({ slug: entry, label: entry.charAt(0).toUpperCase() + entry.slice(1).replace(/-/g, " ") });
          }
        }
      } catch { /* skip */ }
    }
  } catch { /* no app dir */ }
  return pages;
}

function extractObjectArray(content: string, exportName: string, fields: string[]): Any[] {
  const startMatch = new RegExp(`export const ${exportName}\\s*=\\s*\\[`).exec(content);
  if (!startMatch) return [];
  let depth = 1, i = startMatch.index + startMatch[0].length;
  while (i < content.length && depth > 0) { if (content[i] === "[") depth++; if (content[i] === "]") depth--; i++; }
  const arrayContent = content.substring(startMatch.index + startMatch[0].length, i - 1);
  return arrayContent.split(/\}\s*,\s*\{/).map((block) => {
    const obj: Record<string, Any> = {};
    for (const field of fields) { const val = extractString(block, field); if (val) obj[field] = val; }
    const ratingMatch = block.match(/rating:\s*(\d+)/);
    if (ratingMatch) obj.rating = parseInt(ratingMatch[1]);
    return obj;
  }).filter((obj) => Object.keys(obj).length > 0);
}

function extractString(text: string, key: string): string {
  const dblMatch = text.match(new RegExp(`${key}:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "m"));
  if (dblMatch) return dblMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  const sglMatch = text.match(new RegExp(`${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`, "m"));
  if (sglMatch) return sglMatch[1].replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  return "";
}

function extractArray(text: string, key: string): string[] {
  const match = text.match(new RegExp(`${key}:\\s*\\[([^\\]]*?)\\]`));
  if (!match) return [];
  return [...match[1].matchAll(/['"]([^'"]*)['"]/g)].map((m) => m[1]);
}

function extractExportedStringArray(content: string, exportName: string): string[] {
  const match = content.match(new RegExp(`export const ${exportName}\\s*=\\s*\\[([\\s\\S]*?)\\]`));
  if (!match) return [];
  return toUniqueStrings([...match[1].matchAll(/['"]([^'"]*)['"]/g)].map((m) => m[1]));
}

function extractLinkArray(content: string, exportName: string): Array<{ href: string; label: string }> {
  const startMatch = new RegExp(`export const ${exportName}\\s*=\\s*\\[`).exec(content);
  if (!startMatch) return [];
  let depth = 1, i = startMatch.index + startMatch[0].length;
  while (i < content.length && depth > 0) { if (content[i] === "[") depth++; if (content[i] === "]") depth--; i++; }
  const arrayContent = content.substring(startMatch.index + startMatch[0].length, i - 1);
  const links: Array<{ href: string; label: string }> = [];
  for (const block of arrayContent.split(/\},?\s*\n?\s*\{/)) {
    if (block.trim().startsWith("...")) continue;
    const hrefMatch = block.match(/href:\s*(?:siteUrl\(\s*['"]([^'"]*)['"]\s*\)|['"]([^'"]*)['"]\s*)/);
    const labelMatch = block.match(/label:\s*['"]([^'"]*)['"]/);
    if (hrefMatch && labelMatch) links.push({ href: hrefMatch[1] !== undefined ? hrefMatch[1] : hrefMatch[2], label: labelMatch[1] });
  }
  return links;
}

/* ── AI section redesign (shared by the route + the agent) ────────────── */

// Map section names to candidate file paths within the site's src directory.
function getSectionFiles(siteDir: string, section: string): string[] {
  const map: Record<string, string[]> = {
    hero: ["src/components/Hero.tsx"],
    header: ["src/components/Header.tsx"],
    footer: ["src/components/Footer.tsx"],
    about: ["src/app/about/page.tsx"],
    services: ["src/app/services/page.tsx", "src/components/Services.tsx"],
    team: ["src/app/team/page.tsx", "src/components/Team.tsx"],
    faq: ["src/app/faq/page.tsx", "src/components/FAQ.tsx"],
    blog: ["src/app/blog/page.tsx"],
    gallery: ["src/app/gallery/page.tsx", "src/components/Gallery.tsx"],
    contact: ["src/app/contact/page.tsx", "src/components/Contact.tsx"],
    testimonials: ["src/app/testimonials/page.tsx", "src/components/Testimonials.tsx"],
    homepage: ["src/app/page.tsx"],
    layout: ["src/app/layout.tsx"],
    data: ["src/lib/data.ts"],
  };
  return (map[section] || []).map((f) => join(siteDir, f)).filter((f) => existsSync(f));
}

// Parse @/components/* imports from a TSX file and return existing file paths.
function resolveComponentImports(fileContent: string, siteDir: string): string[] {
  const matches = fileContent.matchAll(/from\s+['"]@\/components\/([^'"]+)['"]/g);
  const result: string[] = [];
  for (const m of matches) {
    const candidates = [
      join(siteDir, "src", "components", m[1] + ".tsx"),
      join(siteDir, "src", "components", m[1] + ".ts"),
      join(siteDir, "src", "components", m[1], "index.tsx"),
    ];
    for (const c of candidates) {
      if (existsSync(c) && !result.includes(c)) { result.push(c); break; }
    }
  }
  return result;
}

/** Detect which editable sections exist in the generated site. */
export function detectSiteSections(siteDir: string): Array<{ id: string; label: string }> {
  const sections: Array<{ id: string; label: string }> = [];
  const checks: Array<[string, string, string[]]> = [
    ["hero", "Hero Section", ["src/components/Hero.tsx"]],
    ["header", "Header / Navigation", ["src/components/Header.tsx"]],
    ["footer", "Footer", ["src/components/Footer.tsx"]],
    ["homepage", "Home Page", ["src/app/page.tsx"]],
    ["about", "About Page", ["src/app/about/page.tsx"]],
    ["services", "Services", ["src/app/services/page.tsx", "src/components/Services.tsx"]],
    ["team", "Team", ["src/app/team/page.tsx", "src/components/Team.tsx"]],
    ["contact", "Contact", ["src/app/contact/page.tsx", "src/components/Contact.tsx"]],
    ["faq", "FAQ", ["src/app/faq/page.tsx", "src/components/FAQ.tsx"]],
    ["blog", "Blog", ["src/app/blog/page.tsx"]],
    ["gallery", "Gallery", ["src/app/gallery/page.tsx", "src/components/Gallery.tsx"]],
    ["testimonials", "Testimonials", ["src/app/testimonials/page.tsx", "src/components/Testimonials.tsx"]],
    ["data", "Site Data (company info, stats)", ["src/lib/data.ts"]],
  ];
  for (const [id, label, files] of checks) {
    if (files.some((f) => existsSync(join(siteDir, f)))) sections.push({ id, label });
  }
  // Also detect custom app pages.
  try {
    const appDir = join(siteDir, "src", "app");
    const dirs = readdirSync(appDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("("))
      .map((d) => d.name);
    for (const dir of dirs) {
      if (!sections.find((s) => s.id === dir) && existsSync(join(appDir, dir, "page.tsx"))) {
        sections.push({ id: dir, label: dir.charAt(0).toUpperCase() + dir.slice(1).replace(/-/g, " ") });
      }
    }
  } catch { /* app dir may not exist */ }
  return sections;
}

/**
 * AI-redesign a section: read the section's file(s), run the section-update
 * agent, and write the results. Does NOT gate credits or build — the caller
 * (the API route or the flow-agent tool) does that.
 */
export async function applySectionRedesign(params: { website: WebsiteRef; section: string; prompt: string }): Promise<{ ok: boolean; error?: string; file?: string }> {
  const { website, section, prompt } = params;
  const siteDir = website.generatedPath || getSiteDir(website.id);
  const files = getSectionFiles(siteDir, section);
  if (files.length === 0) return { ok: false, error: `Section "${section}" isn't part of this site.` };

  const primaryFile = files[0];
  const primaryContent = readFileSync(primaryFile, "utf-8");
  const extraComponentFiles = section === "homepage" ? resolveComponentImports(primaryContent, siteDir) : [];
  const fileContents = [primaryFile, ...extraComponentFiles].map((f) => ({
    path: f.replace(siteDir, "").replace(/\\/g, "/"),
    absPath: f,
    content: readFileSync(f, "utf-8"),
  }));

  let dataContent = "";
  try { dataContent = readFileSync(join(siteDir, "src", "lib", "data.ts"), "utf-8"); } catch { /* optional */ }

  const agentResult = await runSectionUpdateAgent({
    siteDir, section, prompt, basePath: `/sites/${website.slug}`, kind: "website", dataContent, files: fileContents,
  });
  for (const update of agentResult.updates) writeFileSync(update.absPath, update.content, "utf-8");
  return { ok: true, file: fileContents[0].path };
}

/* ── build + deploy ───────────────────────────────────────────────────── */

/**
 * Build then deploy the generated site (V2 or V3). Awaitable — resolves when
 * the build+deploy finish, so a background worker can report completion.
 * Updates pageCount for V2 sites (mirrors the rebuild route).
 */
export async function rebuildAndDeploy(website: { id: string; slug: string; generatedPath?: string | null; generatorVersion?: string | null }): Promise<{ success: boolean; error?: string }> {
  try {
    const isV3 = website.generatorVersion === "v3";
    if (isV3) {
      const buildResult = await buildSiteV3(website.id);
      if (!buildResult.success) return { success: false, error: buildResult.error || "Build failed" };
      await deploySiteV3(website.id, website.slug);
      return { success: true };
    }
    const buildResult = await buildSite(website.id);
    if (!buildResult.success) return { success: false, error: buildResult.error || "Build failed" };
    await deploySite(website.id, website.slug);
    // Update page count from output
    const siteDir = website.generatedPath || getSiteDir(website.id);
    const outputDir = process.platform === "win32"
      ? join(siteDir, "..", "..", "sites-output", website.slug)
      : `/var/www/flowsmartly/sites-output/${website.slug}`;
    try {
      const htmlFiles = readdirSync(outputDir).filter((f: string) => f.endsWith(".html") && f !== "404.html" && f !== "_error.html");
      await prisma.website.update({ where: { id: website.id }, data: { pageCount: htmlFiles.length } });
    } catch { /* output dir may not exist yet */ }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Build failed" };
  }
}
